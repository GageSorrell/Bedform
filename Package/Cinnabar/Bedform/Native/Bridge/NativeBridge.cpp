// Bedform native virtual sessions, under the MIT license.
#include "LocalTransport.h"
#include "BridgeConfig.h"
#include "UiState.h"
#include "../../Contract/AutomationContract.h"

#include "ll/api/event/EventBus.h"
#include "ll/api/event/server/ServerStoppingEvent.h"
#include "ll/api/event/world/ServerLevelTickEvent.h"
#include "ll/api/memory/Hook.h"
#define LL_MEMORY_OPERATORS
#include "ll/api/memory/MemoryOperators.h"
#include "ll/api/mod/RegisterHelper.h"
#include "ll/api/service/Bedrock.h"
#include "mc/deps/cereal/ReflectionCtx.h"
#include "mc/deps/core/utility/BinaryStream.h"
#include "mc/deps/core/utility/ReadOnlyBinaryStream.h"
#include "mc/legacy/ActorRuntimeID.h"
#include "mc/legacy/ActorUniqueID.h"
#include "mc/network/IPacketHandlerDispatcher.h"
#include "mc/network/LoopbackPacketSender.h"
#include "mc/network/MinecraftPackets.h"
#include "mc/network/NetworkIdentifierWithSubId.h"
#include "mc/network/NetworkSystem.h"
#include "mc/network/ServerNetworkHandler.h"
#include "mc/network/ServerNetworkSystem.h"
#include "mc/network/packet/PlayerAuthInputPacket.h"
#include "mc/network/packet/PlayStatusPacket.h"
#include "mc/network/packet/RequestChunkRadiusPacket.h"
#include "mc/network/packet/StartGamePacket.h"
#include "mc/network/packet/SubChunkRequestPacket.h"
#include "mc/platform/UUID.h"
#include "mc/server/NetworkChunkPublisher.h"
#include "mc/server/SimulatedPlayer.h"
#include "mc/world/actor/provider/MobMovement.h"
#include "mc/world/level/Tick.h"
#include "mc/world/level/chunk/LevelChunk.h"
#include "mc/world/level/storage/LevelData.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <map>
#include <ranges>
#include <set>
#include <stdexcept>
#include <tuple>
#include <vector>

namespace bedform::native {
using namespace std::chrono_literals;
using PacketId = MinecraftPacketIds;
constexpr int MaxSessions = 8;
constexpr int MaxControlClients = 16;
constexpr std::size_t MaxTerminal = 256;
constexpr std::size_t MaxEvents = 1024;
constexpr std::size_t MaxPacketQueue = 16 * 1024 * 1024;

namespace {
std::string encode(Packet const& packet, cereal::ReflectionCtx const& context) {
    std::string bytes;
    appendVaruint(bytes, static_cast<std::uint32_t>(packet.getId()));
    BinaryStream stream(bytes);
    packet.writeWithSerializationMode(stream, context, std::nullopt);
    return bytes;
}

void appendPacket(std::string& batch, std::string_view packet) {
    appendVaruint(batch, static_cast<std::uint32_t>(packet.size()));
    batch.append(packet);
}

std::string dimensionName(int dimension) {
    switch (dimension) {
    case 0: return "overworld";
    case 1: return "nether";
    case 2: return "the_end";
    default: return std::to_string(dimension);
    }
}

struct Session {
    Json handle;
    Json state;
    NetworkIdentifier network;
    SubClientId subClient;
    Socket listener;
    std::optional<Channel> channel;
    std::string token;
    Clock::time_point expires;
    std::string startup;
    std::deque<std::string> delayed;
    std::size_t delayedBytes = 0;
    std::vector<Pack const*> packs;
    std::size_t packIndex = 0;
    std::size_t packOffset = 0;
    bool bound = false;
    bool bootstrapping = false;
    bool spawnSent = false;
    bool overflow = false;
    int dimension = 0;
    Vec2 movement{};
    std::uint64_t moveExpires = 0;
    std::uint64_t observations = 0;
    std::set<std::tuple<int, int, bool>> chunks;

    bool virtualLease() const {
        return state.contains("lease") && state["lease"]["owner"] == "virtual";
    }

    void queue(std::string bytes) {
        if (!channel || overflow) return;
        auto framed = frame(std::move(bytes));
        if (packIndex < packs.size()) {
            if (delayedBytes + framed.size() > MaxPacketQueue) { overflow = true; return; }
            delayedBytes += framed.size();
            delayed.push_back(std::move(framed));
            return;
        }
        overflow = !channel->send(std::move(framed), MaxPacketQueue);
    }
};

struct ControlClient {
    Channel channel;
    Clock::time_point accepted = Clock::now();
    bool answered = false;
};
} // namespace

class NativeBridge {
public:
    bool load() { return true; }
    bool enable();
    bool disable();
    void onTick(Level& level);
    void capture(NetworkIdentifier const& id, SubClientId subClient, Packet const& packet, cereal::ReflectionCtx const& context);
    void captureFor(std::int64_t actor, Packet const& packet, cereal::ReflectionCtx const& context);
    void broadcast(Packet const& packet, NetworkIdentifier const* except, SubClientId subClient);
    std::optional<Vec2> authorizedMovement(EntityContext& context);

private:
    Json control(HttpRequest const& request, Level& level, Clock::time_point accepted);
    Json operation(std::string const& op, Json const& args, Level& level);
    Json attach(Json const& args, Level& level);
    void pumpHttp(Level& level);
    void pumpSession(Session& session, Level& level, SimulatedPlayer& player, ServerNetworkHandler& handler);
    void bootstrap(Session& session, SimulatedPlayer& player, ServerNetworkHandler& handler);
    void ingress(Session& session, std::string_view payload, SimulatedPlayer& player, ServerNetworkHandler& handler);
    void pumpChunks(Session& session, SimulatedPlayer& player, ServerNetworkHandler& handler);
    void stop();
    void revoke(Session& session, SimulatedPlayer* player);
    void finish(std::map<std::int64_t, Session>::iterator entry, std::string_view reason, SimulatedPlayer* player);
    void publish(Session const& session);
    static SimulatedPlayer* lookup(Level& level, std::int64_t target);

    std::optional<Config> config;
    Socket controlListener;
    std::vector<ControlClient> clients;
    std::map<std::int64_t, Session> sessions;
    std::map<std::int64_t, std::uint64_t> generations;
    std::map<std::int64_t, UiState> ui;
    std::deque<Json> terminal;
    std::deque<Json> events;
    std::vector<Channel> closing;
    ll::event::ListenerPtr tickListener;
    ll::event::ListenerPtr stopListener;
    std::string serverInstance;
    Clock::time_point origin = Clock::now();
    std::uint64_t sequence = 0;
    std::uint64_t tick = 0;
    bool authorized = false;
    bool stopping = false;
    bool winsock = false;
};

NativeBridge instance;
thread_local bool serverThread = false;
thread_local bool captureInProgress = false;
thread_local SimulatedPlayer* routedPlayer = nullptr;

struct RoutePlayer {
    SimulatedPlayer* previous;
    explicit RoutePlayer(SimulatedPlayer& player) : previous(std::exchange(routedPlayer, &player)) {}
    ~RoutePlayer() { routedPlayer = previous; }
};

struct CaptureGuard {
    bool previous = std::exchange(captureInProgress, true);
    ~CaptureGuard() { captureInProgress = previous; }
};

LL_TYPE_INSTANCE_HOOK(WireSend, ll::memory::HookPriority::Normal, NetworkSystem, &NetworkSystem::send, void,
    NetworkIdentifier const& id, Packet const& packet, SubClientId recipient) {
    if (serverThread && !captureInProgress) instance.capture(id, recipient, packet, *mReflectionCtx);
    origin(id, packet, recipient);
}

using TargetSend = void (LoopbackPacketSender::*)(NetworkIdentifier const&, Packet const&, SubClientId);
LL_TYPE_INSTANCE_HOOK(TargetSendHook, ll::memory::HookPriority::Normal, LoopbackPacketSender,
    static_cast<TargetSend>(&LoopbackPacketSender::$sendToClient), void,
    NetworkIdentifier const& id, Packet const& packet, SubClientId recipient) {
    auto handler = ll::service::getServerNetworkHandler();
    if (serverThread && !captureInProgress && handler) instance.capture(id, recipient, packet, *handler->mNetwork.mReflectionCtx);
    CaptureGuard guard;
    origin(id, packet, recipient);
}

LL_TYPE_INSTANCE_HOOK(PlayerLookupHook, ll::memory::HookPriority::Normal, ServerNetworkHandler,
    &ServerNetworkHandler::$_getServerPlayer, ServerPlayer*, NetworkIdentifier const& id, SubClientId subClient) {
    if (routedPlayer && routedPlayer->getNetworkIdentifier() == id && routedPlayer->getClientSubId() == subClient)
        return routedPlayer;
    return origin(id, subClient);
}

LL_TYPE_INSTANCE_HOOK(PlayerSendHook, ll::memory::HookPriority::Normal, ServerPlayer,
    &ServerPlayer::$sendNetworkPacket, void, Packet& packet) {
    auto handler = ll::service::getServerNetworkHandler();
    if (!serverThread || captureInProgress || !isSimulated() || !handler) return origin(packet);
    instance.captureFor(getOrCreateUniqueID().rawID, packet, *handler->mNetwork.mReflectionCtx);
    CaptureGuard guard;
    origin(packet);
}

using EntitySend = void (LoopbackPacketSender::*)(UserEntityIdentifierComponent const*, Packet const&);
LL_TYPE_INSTANCE_HOOK(EntitySendHook, ll::memory::HookPriority::Normal, LoopbackPacketSender,
    static_cast<EntitySend>(&LoopbackPacketSender::$sendToClient), void,
    UserEntityIdentifierComponent const* recipient, Packet const& packet) {
    if (!serverThread || captureInProgress || !recipient) return origin(recipient, packet);
    auto level = ll::service::getLevel();
    auto handler = ll::service::getServerNetworkHandler();
    if (level && handler) {
        level->forEachPlayer([&](Player& player) {
            if (&player.getUserEntityIdentifier() != recipient) return true;
            if (player.isSimulated())
                instance.captureFor(player.getOrCreateUniqueID().rawID, packet, *handler->mNetwork.mReflectionCtx);
            return false;
        });
        CaptureGuard guard;
        return origin(recipient, packet);
    }
    origin(recipient, packet);
}

using BroadcastSend = void (LoopbackPacketSender::*)(Packet const&);
LL_TYPE_INSTANCE_HOOK(BroadcastHook, ll::memory::HookPriority::Normal, LoopbackPacketSender,
    static_cast<BroadcastSend>(&LoopbackPacketSender::$sendBroadcast), void, Packet const& packet) {
    if (serverThread && !captureInProgress) instance.broadcast(packet, nullptr, SubClientId::PrimaryClient);
    CaptureGuard guard;
    origin(packet);
}

using SetVelocity = void(*)(EntityContext&, std::optional<float>, std::optional<float>, std::optional<float>);
LL_TYPE_STATIC_HOOK(MovementHook, ll::memory::HookPriority::Normal, NativeBridge,
    static_cast<SetVelocity>(&MobMovement::setLocalMoveVelocity), void,
    EntityContext& context, std::optional<float> x, std::optional<float> y, std::optional<float> z) {
    if (serverThread) {
        if (auto movement = instance.authorizedMovement(context)) {
            x = movement->x;
            z = movement->y;
        }
    }
    origin(context, x, y, z);
}

using Hooks = ll::memory::HookRegistrar<WireSend, TargetSendHook, PlayerLookupHook, PlayerSendHook, EntitySendHook,
    BroadcastHook, MovementHook>;
std::optional<Hooks> hooks;

SimulatedPlayer* NativeBridge::lookup(Level& level, std::int64_t target) {
    SimulatedPlayer* result = nullptr;
    level.forEachPlayer([&](Player& player) {
        if (player.isSimulated() && player.getOrCreateUniqueID().rawID == target) {
            result = static_cast<SimulatedPlayer*>(&player);
            return false;
        }
        return true;
    });
    return result;
}

void NativeBridge::publish(Session const& session) {
    events.push_back({{"v", automation::Version}, {"kind", "event"}, {"event", automation::EventSessionChanged},
        {"sequence", ++sequence}, {"value", session.state}});
    if (events.size() > MaxEvents) events.pop_front();
}

void NativeBridge::revoke(Session& session, SimulatedPlayer* player) {
    session.moveExpires = 0;
    session.movement = {};
    if (session.virtualLease() && player) {
        RoutePlayer route(*player);
        player->simulateStopMoving();
        player->simulateStopUsingItem();
        player->simulateStopDestroyingBlock();
        player->simulateStopInteracting();
        player->simulateStopSneaking();
    }
    session.state.erase("lease");
}

void NativeBridge::finish(std::map<std::int64_t, Session>::iterator entry, std::string_view reason, SimulatedPlayer* player) {
    auto& session = entry->second;
    revoke(session, player);
    session.state["phase"] = "ended";
    session.state["endReason"] = reason;
    if (!player) { session.state["alive"] = false; ui.erase(entry->first); }
    publish(session);
    terminal.push_back(session.state);
    if (terminal.size() > MaxTerminal) terminal.pop_front();
    if (session.channel && session.bound && closing.size() < MaxSessions) {
        if (session.channel->offset == 0) {
            session.channel->outbound.clear();
            session.channel->queued = 0;
        }
        auto body = Json{{"reason", 0}, {"message", reason}, {"filtered_message", ""}, {"hide_screen", false}}.dump();
        session.channel->send(frame(std::string(1, DisconnectKind) + body));
        session.channel->write();
        if (!session.channel->outbound.empty()) closing.push_back(std::move(*session.channel));
    }
    sessions.erase(entry);
}

Json NativeBridge::attach(Json const& args, Level& level) {
    shape(args, {"entityId", "runId"}, {"renderer", "fixedClock"});
    auto unique = entityId(args.at("entityId"));
    auto run = id(args.at("runId"));
    auto renderer = args.value("renderer", "hidden");
    if (renderer != "hidden" && renderer != "visible") reject("Malformed", "Unknown renderer mode");
    if (args.value("fixedClock", false)) reject("UnsupportedCapability", "Live BDS requires real time");
    auto player = lookup(level, unique);
    if (!player) reject("InvalidPlayer", "Simulated player was not found");
    if (!player->isAlive()) reject("PlayerDead", "Simulated player is dead");
    auto handler = ll::service::getServerNetworkHandler();
    if (!handler) reject("NotReady", "BDS network handler is unavailable", true);
    if (sessions.contains(unique)) reject("AlreadyAttached", "Simulated player is already attached");
    if (sessions.size() == MaxSessions || (!generations.contains(unique) && generations.size() >= 65536))
        reject("ResourceLimit", "Native session capacity exhausted");
    Socket listener = Socket::listen();
    auto port = listener ? listener.port() : 0;
    if (!port) reject("ResourceLimit", "Unable to allocate a local packet endpoint", true);
    auto runtime = std::to_string(player->getRuntimeID().rawID);
    auto dimension = static_cast<int>(player->getDimensionId());
    auto handle = Json{{"runId", run}, {"sessionId", randomToken()}, {"generation", ++generations[unique]},
        {"player", {{"serverInstanceId", serverInstance}, {"entityId", std::to_string(unique)}, {"runtimeId", runtime},
            {"spawn", *player->mGameTestHelper ? "gameTest" : "standalone"}}}};
    auto state = Json{{"session", handle}, {"phase", "attaching"}, {"alive", true},
        {"dimension", dimensionName(dimension)}, {"runtimeId", runtime}, {"renderer", renderer}};
    auto& session = sessions.emplace(unique, Session{std::move(handle), std::move(state),
        player->getNetworkIdentifier(), player->getClientSubId(), std::move(listener), std::nullopt,
        randomToken(), Clock::now() + 10s}).first->second;
    session.dimension = dimension;
    try {
        auto world = std::filesystem::path("worlds") / utf8Path(level.getLevelId()) / "world_resource_packs.json";
        if (std::filesystem::exists(world)) {
            auto list = Json::parse(readFile(world, automation::ControlBytes));
            if (!list.is_array() || list.size() > 64) reject("Incompatible", "Invalid active world resource-pack list");
            for (auto const& pack : list) {
                auto packId = text(pack.at("pack_id"), 36);
                auto version = pack.at("version");
                std::string versionString;
                if (version.is_string()) versionString = text(version, 64);
                else if (version.is_array() && version.size() == 3)
                    versionString = std::to_string(uint(version[0])) + "." + std::to_string(uint(version[1])) + "." + std::to_string(uint(version[2]));
                else reject("Incompatible", "Invalid active resource-pack version");
                auto resolved = config->packs.find({packId, versionString});
                if (resolved == config->packs.end()) reject("Incompatible", "An active world resource pack needs a verified archive");
                session.packs.push_back(&resolved->second);
            }
        }
    } catch (...) {
        sessions.erase(unique);
        throw;
    }
    publish(session);
    return {{"state", session.state}, {"packets", {{"port", port}, {"token", session.token}}}};
}

Json NativeBridge::operation(std::string const& op, Json const& args, Level& level) {
    if (op == automation::OperationCapabilities) {
        shape(args, {});
        return Json::array({"NativeSession", "VirtualInput", "Observations"});
    }
    if (op == automation::OperationPollEvents) {
        shape(args, {"after"}, {"session", "limit"});
        auto after = uint(args.at("after"));
        auto limit = args.contains("limit") ? uint(args.at("limit"), 128) : 128;
        if (!limit) reject("Malformed", "Event page size must be positive");
        if (!events.empty() && after + 1 < uint(events.front().at("sequence")))
            reject("ResourceLimit", "Event cursor expired");
        auto selected = Json::array();
        auto next = after;
        std::size_t bytes = 0;
        for (auto const& event : events) {
            auto current = uint(event.at("sequence"));
            if (current <= after || (args.contains("session") && event["value"]["session"] != args["session"])) continue;
            bytes += event.dump().size() + 1;
            if (bytes + 1024 > automation::ControlBytes) break;
            selected.push_back(event);
            next = current;
            if (selected.size() == limit) break;
        }
        return {{"events", std::move(selected)}, {"next", next}};
    }
    if (op == automation::OperationAttach) return attach(args, level);
    if (op == automation::OperationState || op == automation::OperationDetach) shape(args, {"session"});
    else if (op == automation::OperationAcquireLease) shape(args, {"session", "owner"});
    else if (op == automation::OperationReleaseLease) shape(args, {"session", "lease"});
    else if (op == automation::OperationObserve) shape(args, {"session"}, {"facts"});
    else reject("UnsupportedCapability", "The native bridge does not provide this operation");

    auto const& handle = args.at("session");
    shape(handle, {"runId", "sessionId", "generation", "player"});
    shape(handle.at("player"), {"serverInstanceId", "entityId", "runtimeId", "spawn"});
    auto unique = entityId(handle["player"]["entityId"]);
    auto at = sessions.find(unique);
    if (at == sessions.end() || at->second.handle != handle) {
        if (op == automation::OperationState) {
            auto ended = std::ranges::find_if(terminal, [&](Json const& state) { return state["session"] == handle; });
            if (ended != terminal.end()) return *ended;
        }
        reject("StaleSession", "Session handle is stale");
    }
    auto& session = at->second;
    if (op == automation::OperationState) return session.state;
    auto player = lookup(level, unique);
    if (op == automation::OperationDetach) {
        finish(at, "detached", player);
        return terminal.back();
    }
    if (!player) reject("InvalidPlayer", "Simulated player was removed");
    if (op == automation::OperationReleaseLease) {
        if (!session.state.contains("lease") || session.state["lease"] != args["lease"])
            reject("LeaseLost", "The lease is no longer current");
        revoke(session, player);
        publish(session);
        return nullptr;
    }
    if (op == automation::OperationAcquireLease) {
        auto owner = text(args.at("owner"));
        if (owner != "native" && owner != "virtual") reject("Malformed", "Unknown lease owner");
        if (!player->isAlive()) reject("PlayerDead", "Simulated player is dead");
        if (session.state["phase"] != "ready") reject("NotReady", "Session is transitioning", true);
        if (session.state.contains("lease")) reject("LeaseBusy", "Session already has an exclusive lease", true);
        if (owner == "virtual") player->simulateStopMoving();
        session.state["lease"] = {{"id", randomToken()}, {"owner", owner}};
        publish(session);
        return session.state["lease"];
    }
    auto facts = args.value("facts", Json::array());
    if (!facts.is_array() || facts.size() > 128) reject("Malformed", "Invalid observation request");
    auto result = Json::array();
    auto add = [&](std::string_view source, std::string_view name, Json value) {
        auto key = Json{{"source", source}, {"name", name}};
        if (facts.empty() || std::ranges::find(facts, key) != facts.end())
            result.push_back({{"fact", std::move(key)}, {"value", std::move(value)}});
    };
    for (auto const& fact : facts) {
        shape(fact, {"source", "name"}, {"subject"});
        auto source = text(fact.at("source"));
        if (source != "world" && source != "player" && source != "inventory" && source != "hud" && source != "ui" && source != "script")
            reject("Malformed", "Unknown fact source");
        text(fact.at("name"));
        if (fact.contains("subject")) text(fact.at("subject"));
    }
    auto const& position = player->getPosition();
    auto rotation = player->getRotation();
    add("world", "dimension", session.state["dimension"]);
    add("player", "alive", player->isAlive());
    add("player", "x", position.x);
    add("player", "y", position.y);
    add("player", "z", position.z);
    add("player", "pitch", rotation.x);
    add("player", "yaw", rotation.y);
    return {{"session", handle}, {"observed", {{"tick", tick},
        {"monotonicMs", std::chrono::duration<double, std::milli>(Clock::now() - origin).count()}}},
        {"sequence", ++session.observations}, {"facts", std::move(result)}};
}

Json NativeBridge::control(HttpRequest const& request, Level& level, Clock::time_point accepted) {
    auto message = parse(request.body);
    if (!message.contains("id")) reject("Malformed", "Uncorrelatable request");
    auto correlation = id(message.at("id"));
    Json response{{"v", automation::Version}, {"kind", "response"}, {"id", correlation}};
    try {
        if (!tokenMatches(request.token, config->token)) reject("Unauthorized", "Invalid bridge credential");
        shape(message, {"v", "kind", "id", "op", "args"}, {"timeoutMs"});
        if (message.at("kind") != "request") reject("Malformed", "Expected a request envelope");
        auto op = text(message.at("op"));
        bool local = op == automation::OperationHello || op == automation::OperationCapabilities ||
            op == automation::OperationPollEvents || op == automation::OperationAttach || op == automation::OperationDetach ||
            op == automation::OperationState || op == automation::OperationAcquireLease || op == automation::OperationReleaseLease ||
            op == automation::OperationObserve;
        if (local) response["op"] = op;
        if (uint(message.at("v")) != automation::Version) reject("UnsupportedVersion", "Unsupported protocol revision");
        auto timeout = message.contains("timeoutMs") ? uint(message.at("timeoutMs"), automation::MaximumTimeoutMs) : automation::DefaultTimeoutMs;
        if (!timeout) reject("Malformed", "Timeout must be positive");
        if (Clock::now() - accepted >= std::chrono::milliseconds(timeout)) reject("Timeout", "Request expired before execution", true);
        auto const& args = message.at("args");
        if (op == automation::OperationHello) {
            shape(args, {"role", "compatibility"});
            if (args["role"] != "host") reject("Unauthorized", "Bridge accepts its automation host only");
            if (args["compatibility"] != config->compatibility) reject("Incompatible", "Automation compatibility tuple does not match");
            authorized = true;
            response["value"] = {{"role", "bridge"}, {"capabilities", operation(std::string(automation::OperationCapabilities), Json::object(), level)},
                {"compatibility", config->compatibility}};
        } else {
            if (!authorized) reject("Unauthorized", "Successful Hello required");
            if (stopping) reject("Shutdown", "Server is shutting down");
            response["value"] = operation(op, args, level);
        }
        response["ok"] = true;
    } catch (Refusal const& error) {
        response["ok"] = false;
        response["error"] = {{"code", error.code}, {"message", error.message}, {"retryable", error.retryable}};
    } catch (Json::exception const&) {
        response["ok"] = false;
        response["error"] = {{"code", "Malformed"}, {"message", "Invalid request or world metadata"}, {"retryable", false}};
    } catch (std::exception const&) {
        response["ok"] = false;
        response["error"] = {{"code", "Internal"}, {"message", "Native bridge operation failed"}, {"retryable", false}};
    }
    return response;
}

void NativeBridge::pumpHttp(Level& level) {
    while (clients.size() < MaxControlClients) {
        auto socket = controlListener.accept();
        if (!socket) break;
        clients.push_back({Channel(std::move(socket))});
    }
    std::erase_if(clients, [&](ControlClient& client) {
        auto& channel = client.channel;
        if (Clock::now() - client.accepted > 5s) return true;
        if (!client.answered) {
            std::string reply;
            try {
                if (!channel.read(automation::ControlBytes + 8196)) return true;
                auto parsed = parseHttp(channel.inbound);
                if (!parsed) return false;
                auto body = control(*parsed, level, client.accepted).dump();
                reply = body.size() <= automation::ControlBytes ? httpResponse(200, body) : httpResponse(413);
            } catch (std::length_error const&) {
                reply = httpResponse(413);
            } catch (...) {
                reply = httpResponse(400);
            }
            channel.send(std::move(reply));
            client.answered = true;
        }
        return !channel.write() || channel.outbound.empty();
    });
}

void NativeBridge::capture(NetworkIdentifier const& id, SubClientId subClient, Packet const& packet, cereal::ReflectionCtx const& context) {
    if (routedPlayer && routedPlayer->getNetworkIdentifier() == id && routedPlayer->getClientSubId() == subClient) {
        captureFor(routedPlayer->getOrCreateUniqueID().rawID, packet, context);
        return;
    }
    auto level = ll::service::getLevel();
    if (!level) return;
    std::optional<std::int64_t> actor;
    bool ambiguous = false;
    level->forEachPlayer([&](Player& player) {
        if (player.getNetworkIdentifier() != id || player.getClientSubId() != subClient) return true;
        if (actor) { ambiguous = true; return false; }
        actor = player.getOrCreateUniqueID().rawID;
        return true;
    });
    if (actor && !ambiguous) captureFor(*actor, packet, context);
}

void NativeBridge::captureFor(std::int64_t actor, Packet const& packet, cereal::ReflectionCtx const& context) {
    auto at = sessions.find(actor);
    auto session = at != sessions.end() && at->second.bound ? &at->second : nullptr;
    try {
        std::string bytes;
        if (UiState::applies(packet) && (ui.size() < 64 || ui.contains(actor))) {
            auto& snapshot = ui[actor];
            if (auto slot = snapshot.update(packet)) {
                bytes = encode(packet, context);
                snapshot.remember(*slot, bytes, tick);
            }
            if (!session || !session->spawnSent) return;
        }
        if (!session) return;
        if (bytes.empty()) bytes = encode(packet, context);
        if (session->bootstrapping) {
            if (session->startup.size() + bytes.size() + 5 > MaxPacketQueue) { session->overflow = true; return; }
            appendPacket(session->startup, bytes);
        } else {
            std::string batch(1, BatchKind);
            appendPacket(batch, bytes);
            session->queue(std::move(batch));
        }
    } catch (...) {
        if (session) session->overflow = true;
    }
}

void NativeBridge::broadcast(Packet const& packet, NetworkIdentifier const* except, SubClientId subClient) {
    auto handler = ll::service::getServerNetworkHandler();
    if (!handler) return;
    for (auto& [id, session] : sessions)
        if (session.bound && (!except || session.network != *except || session.subClient != subClient))
            captureFor(id, packet, *handler->mNetwork.mReflectionCtx);
}

void NativeBridge::bootstrap(Session& session, SimulatedPlayer& player, ServerNetworkHandler& handler) {
    session.bootstrapping = true;
    handler._sendLevelData(player, session.network);
    session.bootstrapping = false;
    std::string_view packets = session.startup;
    bool started = false;
    while (!packets.empty()) {
        auto length = readVaruint(packets);
        if (!length || !*length || *length > packets.size()) break;
        auto header = packets.substr(0, *length);
        auto type = readVaruint(header);
        if (type && (*type & 1023) == static_cast<unsigned>(PacketId::StartGame)) {
            auto trailing = std::string(packets.substr(*length));
            session.startup.resize(session.startup.size() - trailing.size());
            if (!trailing.empty()) {
                // Preserve packets that BDS sent after the StartGame boundary.
                session.queue(std::string(1, BatchKind) + trailing);
            }
            started = true;
            break;
        }
        packets.remove_prefix(*length);
    }
    if (!started || session.overflow) reject("NotReady", "Native StartGame bootstrap failed");
    auto packList = Json::array();
    for (auto pack : session.packs) packList.push_back(pack->meta);
    auto metadata = Json{{"identity", {{"display_name", player.getRealName()}, {"xuid", player.getXuid()},
        {"uuid", player.getUuid().asString()}}}, {"client_cache", false},
        {"packs_required", static_cast<bool>(player.getLevel().getLevelData().mTexturePacksRequired)},
        {"packs", std::move(packList)}}.dump();
    std::string handoff(1, HandoffKind);
    appendWord(handoff, static_cast<std::uint32_t>(metadata.size()));
    handoff += metadata;
    handoff += session.startup;
    session.startup = {};
    auto framed = frame(std::move(handoff));
    session.channel->queued += framed.size();
    session.channel->outbound.push_front(std::move(framed));

    auto packet = MinecraftPackets::createPacket(PacketId::RequestChunkRadius);
    auto& request = static_cast<RequestChunkRadiusPacket&>(*packet);
    request.mChunkRadius = 4;
    request.mMaxChunkRadius = 4;
    request.mSenderSubId = session.subClient;
    handler.handle(session.network, request);
    player.sendInventory(true);
}

std::optional<Vec2> NativeBridge::authorizedMovement(EntityContext& context) {
    if (sessions.empty()) return std::nullopt;
    auto player = SimulatedPlayer::tryGetFromEntity(context, false);
    if (!player) return std::nullopt;
    auto at = sessions.find(player->getOrCreateUniqueID().rawID);
    if (at == sessions.end() || !at->second.virtualLease()) return std::nullopt;
    auto const& session = at->second;
    return tick < session.moveExpires ? session.movement : Vec2{};
}

void NativeBridge::ingress(Session& session, std::string_view payload, SimulatedPlayer& player, ServerNetworkHandler& handler) {
    if (payload.size() < 6) reject("Malformed", "Missing native ingress metadata");
    auto length = readWord(payload);
    payload.remove_prefix(4);
    if (!length || length > automation::ControlBytes || length + 1 >= payload.size()) reject("Malformed", "Invalid ingress header length");
    auto header = parse(payload.substr(0, length));
    shape(header, {"v", "session"}, {"lease"});
    if (header["v"] != automation::Version || header["session"] != session.handle) reject("StaleSession", "Invalid packet session handle");
    payload.remove_prefix(length);
    if (payload.front() != BatchKind) reject("Malformed", "Expected a Bedrock Batch");
    payload.remove_prefix(1);
    auto hasLease = session.virtualLease() && header.contains("lease") && header["lease"] == session.state["lease"];
    std::vector<std::shared_ptr<Packet>> packets;
    while (!payload.empty()) {
        auto packetLength = readVaruint(payload);
        if (!packetLength || !*packetLength || *packetLength > payload.size() || packets.size() == 64)
            reject("Malformed", "Invalid Bedrock packet batch");
        auto bytes = payload.substr(0, *packetLength);
        payload.remove_prefix(*packetLength);
        auto code = readVaruint(bytes);
        if (!code || *code >= 16384) reject("Malformed", "Invalid Bedrock packet header");
        auto packetId = static_cast<PacketId>(*code & 1023);
        auto passive = packetId == PacketId::SubChunkRequestPacket || packetId == PacketId::RequestChunkRadius;
        if (!passive && (!hasLease || session.state["phase"] != "ready" || !player.isAlive())) continue;
        switch (packetId) {
        case PacketId::SubChunkRequestPacket: case PacketId::RequestChunkRadius:
        case PacketId::PlayerAuthInputPacket: case PacketId::ModalFormResponse: case PacketId::ServerboundDataDrivenScreenClosed:
        case PacketId::Interact: case PacketId::PlayerAction: case PacketId::InventoryTransaction:
        case PacketId::ItemStackRequest: case PacketId::ContainerClose: case PacketId::PlayerEquipment:
        case PacketId::Animate: case PacketId::Text: case PacketId::CommandRequest: case PacketId::Respawn:
        case PacketId::ServerboundLoadingScreenPacket:
            break;
        default: continue;
        }
        auto packet = MinecraftPackets::createPacket(packetId);
        if (!packet) reject("Malformed", "Unregistered Bedrock packet");
        ReadOnlyBinaryStream stream(std::string(bytes), true);
        if (!packet->read(stream, *handler.mNetwork.mReflectionCtx) || !stream.ensureReadCompleted() || !packet->isValid())
            reject("Malformed", "Native Bedrock packet decode rejected");
        packet->mSenderSubId = session.subClient;
        packets.push_back(std::move(packet));
    }
    for (auto& packet : packets) {
        if (packet->getId() == PacketId::PlayerAuthInputPacket) {
            auto& auth = static_cast<PlayerAuthInputPacket&>(*packet);
            auto rotation = *auth.mRot;
            auto movement = *auth.mMove;
            if (!std::isfinite(rotation.x) || !std::isfinite(rotation.y) ||
                !std::isfinite(movement.x) || !std::isfinite(movement.y)) continue;
            handler.handle(session.network, auth);
            player.simulateLookAt(player.getHeadPos() + Vec3::directionFromRotation(rotation));
            session.movement = {std::clamp(movement.x, -1.0f, 1.0f), std::clamp(movement.y, -1.0f, 1.0f)};
            session.moveExpires = tick + 4;
        } else if (packet->getId() == PacketId::SubChunkRequestPacket) {
            handler.handle(session.network, static_cast<SubChunkRequestPacket const&>(*packet));
        } else if (packet->getId() == PacketId::RequestChunkRadius) {
            auto& request = static_cast<RequestChunkRadiusPacket&>(*packet);
            request.mChunkRadius = std::clamp(static_cast<int>(request.mChunkRadius), 1, 6);
            request.mMaxChunkRadius = 6;
            handler.handle(session.network, request);
        } else if (packet->mHandler) {
            auto snapshot = ui.find(player.getOrCreateUniqueID().rawID);
            if (snapshot != ui.end()) snapshot->second.close(packet->getId());
            packet->mHandler->handle(session.network, handler, packet);
        }
    }
}

void NativeBridge::pumpChunks(Session& session, SimulatedPlayer& player, ServerNetworkHandler& handler) {
    auto& publisher = player.mChunkPublisherView;
    if (!publisher || !publisher->mSource) return;
    player.ServerPlayer::$_updateChunkPublisherView(player.getPosition(), 0.0f);
    std::vector<ChunkPositionAndDimension> ready;
    for (auto const& [position, queued] : *publisher->mQueuedChunks) {
        if (session.chunks.contains({position.mPos->x, position.mPos->z, position.mIsBiomeOverride})) continue;
        if (auto chunk = queued.lock(); chunk && chunk->mLoadState->load() == ChunkState::Loaded) {
            ready.push_back(position);
            if (ready.size() >= 8) break;
        }
    }
    for (auto const& position : ready) {
        if (!publisher->_sendQueuedChunk(position, nullptr)) continue;
        if (session.chunks.size() > 4096) session.chunks.clear();
        session.chunks.emplace(position.mPos->x, position.mPos->z, position.mIsBiomeOverride);
        if (session.spawnSent) continue;
        auto packet = MinecraftPackets::createPacket(PacketId::PlayStatus);
        static_cast<PlayStatusPacket&>(*packet).mStatus = PlayStatus::PlayerSpawn;
        capture(session.network, session.subClient, *packet, *handler.mNetwork.mReflectionCtx);
        session.spawnSent = true;
        auto snapshot = ui.find(player.getOrCreateUniqueID().rawID);
        if (snapshot != ui.end()) snapshot->second.replay(tick, [&](std::string const& bytes) {
            std::string batch(1, BatchKind);
            appendPacket(batch, bytes);
            session.queue(std::move(batch));
        });
    }
}

void NativeBridge::pumpSession(Session& session, Level&, SimulatedPlayer& player, ServerNetworkHandler& handler) {
    RoutePlayer route(player);
    if (!session.bound && Clock::now() > session.expires) reject("Timeout", "Packet attachment expired");
    if (!session.channel) {
        auto socket = session.listener.accept();
        if (!socket) return;
        session.channel.emplace(std::move(socket));
    }
    auto& channel = *session.channel;
    if (!channel.read(PacketInputBytes + 128 * 1024)) reject("Disconnected", "Packet peer disconnected");
    if (!session.bound) {
        try {
            auto frame = channel.popFrame(automation::ControlBytes);
            if (!frame) {
                if (Clock::now() - channel.progress > 2s) session.channel.reset();
                return;
            }
            auto bind = parse(*frame);
            shape(bind, {"v", "session", "token"});
            if (bind["v"] != automation::Version || bind["session"] != session.handle ||
                !tokenMatches(text(bind.at("token"), 64), session.token)) {
                session.channel.reset();
                return;
            }
        } catch (...) {
            session.channel.reset();
            return;
        }
        session.bound = true;
        session.listener.close();
        session.token.clear();
        bootstrap(session, player, handler);
    }
    for (int count = 0; count < 8; ++count) {
        auto frame = channel.popFrame(PacketInputBytes);
        if (!frame) break;
        ingress(session, *frame, player, handler);
    }
    if (session.virtualLease()) {
        // Clear navigation intent and use the native movement component for authorized inputs.
        player.simulateStopMoving();
        auto movement = tick < session.moveExpires ? session.movement : Vec2{};
        MobMovement::setLocalMoveVelocity(player.getEntityContext(), movement.x, std::nullopt, movement.y);
    }
    if (session.packIndex < session.packs.size() && channel.queued < PackChunkBytes) {
        auto const& bytes = session.packs[session.packIndex]->archive;
        auto size = std::min(PackChunkBytes, bytes.size() - session.packOffset);
        std::string chunk(1, PackKind);
        appendWord(chunk, static_cast<std::uint32_t>(session.packIndex));
        chunk.append(bytes, session.packOffset, size);
        if (!channel.send(frame(std::move(chunk)), MaxPacketQueue)) reject("ResourceLimit", "Resource-pack output queue is full");
        session.packOffset += size;
        if (session.packOffset == bytes.size()) {
            ++session.packIndex;
            session.packOffset = 0;
        }
    }
    if (session.packIndex == session.packs.size()) {
        while (!session.delayed.empty() && channel.queued + session.delayed.front().size() <= MaxPacketQueue) {
            session.delayedBytes -= session.delayed.front().size();
            channel.send(std::move(session.delayed.front()), MaxPacketQueue);
            session.delayed.pop_front();
        }
        if (session.delayed.empty() && player.isAlive()) pumpChunks(session, player, handler);
    }
    if (session.spawnSent && player.isAlive() && session.state["phase"] != "ready") {
        session.state["phase"] = "ready";
        publish(session);
    }
    if (session.overflow || (!channel.outbound.empty() && Clock::now() - channel.progress > 5s))
        reject("ResourceLimit", "Packet output queue exceeded limits");
    if (!channel.write()) reject("Disconnected", "Packet peer disconnected");
}

void NativeBridge::onTick(Level& level) {
    serverThread = true;
    tick = level.getCurrentTick().tickID;
    auto handler = ll::service::getServerNetworkHandler();
    for (auto at = sessions.begin(); at != sessions.end();) {
        auto entry = at++;
        auto& session = entry->second;
        auto player = lookup(level, entry->first);
        if (!player) {
            finish(entry, session.handle["player"]["spawn"] == "gameTest" ? "testEnded" : "playerRemoved", nullptr);
            continue;
        }
        if (!handler) {
            finish(entry, "disconnected", player);
            continue;
        }
        auto alive = player->isAlive();
        auto dimension = static_cast<int>(player->getDimensionId());
        auto runtime = std::to_string(player->getRuntimeID().rawID);
        if (session.state["alive"] != alive || session.dimension != dimension || session.state["runtimeId"] != runtime ||
            player->getNetworkIdentifier() != session.network || player->getClientSubId() != session.subClient) {
            revoke(session, player);
            session.chunks.clear();
            session.spawnSent = false;
            session.dimension = dimension;
            session.network = player->getNetworkIdentifier();
            session.subClient = player->getClientSubId();
            session.state["alive"] = alive;
            session.state["dimension"] = dimensionName(dimension);
            session.state["runtimeId"] = runtime;
            session.state["phase"] = "transitioning";
            publish(session);
        }
        try {
            pumpSession(session, level, *player, *handler);
        } catch (Refusal const& error) {
            if (error.code != "Disconnected") std::fprintf(stderr, "BedformNativeBridge: packet session ended with %.*s\n",
                static_cast<int>(error.code.size()), error.code.data());
            finish(entry, error.code == "Disconnected" ? "disconnected" : "failed", player);
        } catch (...) {
            finish(entry, "failed", player);
        }
    }
    pumpHttp(level);
    std::erase_if(closing, [](Channel& channel) {
        return Clock::now() - channel.progress > 2s || !channel.write() || channel.outbound.empty();
    });
}

bool NativeBridge::enable() {
    auto path = optionalEnv("BEDFORM_CINNABAR_BRIDGE_CONFIG");
    if (path.empty()) return true;
    stopping = false;
    authorized = false;
    origin = Clock::now();
    try {
        config = Config::load(utf8Path(path));
        WSADATA data{};
        winsock = WSAStartup(MAKEWORD(2, 2), &data) == 0;
        if (!winsock) throw std::runtime_error("Winsock startup failed");
        controlListener = Socket::listen(config->port);
        if (!controlListener) throw std::runtime_error("Loopback control listener bind failed");
        serverInstance = randomToken();
        hooks.emplace();
        auto& events = ll::event::EventBus::getInstance();
        tickListener = events.emplaceListener<ll::event::ServerLevelTickEvent>(
            [this](ll::event::ServerLevelTickEvent& event) { onTick(event.level()); });
        stopListener = events.emplaceListener<ll::event::ServerStoppingEvent>([this](auto&) { stop(); });
        if (!tickListener || !stopListener) throw std::runtime_error("Unable to register BDS lifecycle hooks");
        std::printf("BEDFORM_CINNABAR_BRIDGE_READY %u\n", config->port);
        std::fflush(stdout);
        return true;
    } catch (Refusal const& error) {
        std::fprintf(stderr, "BedformNativeBridge: %.*s\n", static_cast<int>(error.message.size()), error.message.data());
    } catch (...) {
        std::fprintf(stderr, "BedformNativeBridge: private configuration or local listener failed\n");
    }
    disable();
    return false;
}

void NativeBridge::stop() {
    if (stopping) return;
    stopping = true;
    auto level = ll::service::getLevel();
    while (!sessions.empty()) {
        auto entry = sessions.begin();
        finish(entry, "shutdown", level ? lookup(*level, entry->first) : nullptr);
    }
    controlListener.close();
}

bool NativeBridge::disable() {
    stop();
    auto& bus = ll::event::EventBus::getInstance();
    if (tickListener) bus.removeListener(tickListener);
    if (stopListener) bus.removeListener(stopListener);
    tickListener.reset();
    stopListener.reset();
    hooks.reset();
    clients.clear();
    closing.clear();
    terminal.clear();
    events.clear();
    generations.clear();
    ui.clear();
    sequence = 0;
    tick = 0;
    config.reset();
    if (std::exchange(winsock, false)) WSACleanup();
    return true;
}
} // namespace bedform::native

LL_REGISTER_MOD(bedform::native::NativeBridge, bedform::native::instance);
