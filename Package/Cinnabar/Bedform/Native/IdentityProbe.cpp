// Bedform's disposable-world native identity probe, under the MIT license.

#include "ll/api/event/EventBus.h"
#include "ll/api/event/world/ServerLevelTickEvent.h"
#include "ll/api/base/ScopedValue.h"
#include "ll/api/memory/Hook.h"
#define LL_MEMORY_OPERATORS
#include "ll/api/memory/MemoryOperators.h"
#include "ll/api/mod/RegisterHelper.h"
#include "ll/api/service/Bedrock.h"
#include "mc/gametest/framework/BaseGameTestHelper.h"
#include "mc/deps/core/utility/BinaryStream.h"
#include "mc/deps/cereal/ReflectionCtx.h"
#include "mc/legacy/ActorRuntimeID.h"
#include "mc/legacy/ActorUniqueID.h"
#include "mc/network/LoopbackPacketSender.h"
#include "mc/network/MinecraftPackets.h"
#include "mc/network/NetworkIdentifier.h"
#include "mc/network/NetworkPeer.h"
#include "mc/network/NetworkSystem.h"
#include "mc/network/ServerNetworkHandler.h"
#include "mc/network/packet/RequestChunkRadiusPacket.h"
#include "mc/network/packet/StartGamePacket.h"
#include "mc/network/packet/SubChunkRequestPacket.h"
#include "mc/platform/UUID.h"
#include "mc/server/NetworkChunkPublisher.h"
#include "mc/server/SimulatedPlayer.h"
#include "mc/world/level/chunk/LevelChunk.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <map>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_set>
#include "FixtureTransport.h"

namespace bedform::native_probe {

bool enabledFlag(char const* name) {
    char* value = nullptr;
    size_t length = 0;
    auto found = _dupenv_s(&value, &length, name) == 0 && length == 2 && value[0] == '1';
    std::free(value);
    return found;
}

struct BootstrapTrace {
    SimulatedPlayer const& player;
    nlohmann::json packets = nlohmann::json::array();

    void capture(Packet const& packet, std::string_view route) {
        auto record = nlohmann::json{{"name", packet.getName()}, {"route", route}};
        if (packet.getId() == MinecraftPacketIds::StartGame) {
            auto const& start = static_cast<StartGamePacket const&>(packet);
            record["uniqueId"] = std::to_string(start.mEntityId->rawID);
            record["runtimeId"] = std::to_string(start.mRuntimeId->rawID);
        }
        packets.push_back(std::move(record));
    }
};

// The diagnostic records only the synchronous native bootstrap on the server thread.
thread_local BootstrapTrace* activeBootstrap = nullptr;

struct TerrainTrace {
    NetworkIdentifier identifier;
    ActorUniqueID actor;
    SubClientId subClient;
    std::map<std::string, size_t> packets;
    size_t maxQueuedChunks = 0;
    bool hasPublisher = false;
    bool hasChunkSource = false;
    std::optional<bool> queuedChunkSent;
    std::map<std::string, size_t> serializedBytes;
    std::unique_ptr<FixtureTransport> transport;
    bool publishedSpawn = false;
};

thread_local std::optional<TerrainTrace> activeTerrain;

class FixturePeer final : public NetworkPeer {
public:
    size_t packets = 0;
    size_t bytes = 0;

    void sendPacket(std::string const& data, Reliability, Compressibility) override {
        ++packets;
        bytes += data.size();
    }

    NetworkStatus getNetworkStatus() const override { return {}; }

    DataStatus _receivePacket(std::string&, PacketRecvTimepointPtr const&) override { return DataStatus::NoData; }
};

thread_local FixturePeer* activePeer = nullptr;

LL_TYPE_INSTANCE_HOOK(
    FixturePeerLookup,
    ll::memory::HookPriority::Normal,
    NetworkSystem,
    &NetworkSystem::getPeerForUser,
    NetworkPeer*,
    NetworkIdentifier const& identifier
) {
    if (activePeer && activeTerrain && identifier == activeTerrain->identifier) {
        return activePeer;
    }
    return origin(identifier);
}

LL_TYPE_INSTANCE_HOOK(
    TerrainPacket,
    ll::memory::HookPriority::Normal,
    NetworkSystem,
    &NetworkSystem::send,
    void,
    NetworkIdentifier const& identifier,
    Packet const& packet,
    SubClientId subClient
) {
    if (activeTerrain && subClient == activeTerrain->subClient && identifier == activeTerrain->identifier) {
        auto name = std::string{packet.getName()};
        ++activeTerrain->packets[name];
        if (activeTerrain->transport) {
            activeTerrain->transport->capture(packet, *mReflectionCtx);
        }
        if (packet.getId() == MinecraftPacketIds::StartGame ||
            packet.getId() == MinecraftPacketIds::FullChunkData ||
            packet.getId() == MinecraftPacketIds::SubChunkPacket ||
            packet.getId() == MinecraftPacketIds::ItemRegistryPacket) {
            BinaryStream stream;
            packet.writeWithSerializationMode(stream, *mReflectionCtx, std::nullopt);
            activeTerrain->serializedBytes[name] += stream.mBuffer.size();
        }
    }
    origin(identifier, packet, subClient);
}

using SendToClient = void (LoopbackPacketSender::*)(NetworkIdentifier const&, Packet const&, SubClientId);

LL_TYPE_INSTANCE_HOOK(
    BootstrapTargetedPacket,
    ll::memory::HookPriority::Normal,
    LoopbackPacketSender,
    static_cast<SendToClient>(&LoopbackPacketSender::$sendToClient),
    void,
    NetworkIdentifier const& identifier,
    Packet const& packet,
    SubClientId subClient
) {
    if (activeBootstrap && identifier == activeBootstrap->player.getNetworkIdentifier() &&
        subClient == activeBootstrap->player.getClientSubId()) {
        activeBootstrap->capture(packet, "targeted");
    }
    origin(identifier, packet, subClient);
}

LL_TYPE_INSTANCE_HOOK(
    BootstrapPlayerPacket,
    ll::memory::HookPriority::Normal,
    ServerPlayer,
    &ServerPlayer::$sendNetworkPacket,
    void,
    Packet& packet
) {
    if (activeBootstrap && static_cast<ServerPlayer const*>(this) == &activeBootstrap->player) {
        activeBootstrap->capture(packet, "player");
    }
    origin(packet);
}

class IdentityProbe {
    ll::event::ListenerPtr listener;
    std::string previous;
    std::optional<ll::memory::HookRegistrar<BootstrapTargetedPacket, BootstrapPlayerPacket, TerrainPacket>> bootstrap;
    std::optional<ll::memory::HookRegistrar<FixturePeerLookup>> peerLookup;
    std::unordered_set<ActorUniqueID> attempted;
    bool pumpPublisher = false;

    void observe(Level& level) {
        auto observed = nlohmann::json::array();
        size_t count = 0;
        auto handler = ll::service::getServerNetworkHandler();
        SimulatedPlayer* bootstrapPlayer = nullptr;
        SimulatedPlayer* terrainPlayer = nullptr;
        level.forEachPlayer([&](Player& player) {
            ++count;
            if (!player.isSimulated()) {
                return true;
            }
            auto& simulated = static_cast<SimulatedPlayer&>(player);
            auto name = simulated.getRealName();
            if (name != "BedformStandalone" && name != "BedformGameTest") {
                return true;
            }

            char address[2 + 2 * sizeof(void*) + 1]{};
            std::snprintf(address, sizeof(address), "%p", static_cast<void*>(&simulated));
            auto* resolved = handler
                ? handler->_getServerPlayer(simulated.getNetworkIdentifier(), simulated.getClientSubId())
                : nullptr;
            if (bootstrap && resolved == &simulated && !attempted.contains(simulated.getOrCreateUniqueID())) {
                bootstrapPlayer = &simulated;
            }
            if (activeTerrain && activeTerrain->actor == simulated.getOrCreateUniqueID()) {
                terrainPlayer = &simulated;
            }
            observed.push_back({
                {"name", name},
                {"uniqueId", std::to_string(simulated.getOrCreateUniqueID().rawID)},
                {"runtimeId", std::to_string(simulated.getRuntimeID().rawID)},
                {"address", address},
                {"gameTestOwned", static_cast<bool>(*simulated.mGameTestHelper)},
                {"hasConnectionRequest", static_cast<bool>(simulated.getConnectionRequest())},
                {"networkLookup", resolved == &simulated ? "same" : (resolved ? "different" : "missing")}
            });
            return true;
        });

        auto record = nlohmann::json{{"playerCount", count}, {"fixturePlayers", observed}}.dump();
        if (record != previous) {
            std::printf("BEDFORM_CINNABAR_NATIVE_IDENTITY %s\n", record.c_str());
            std::fflush(stdout);
            previous = std::move(record);
        }

        if (activeTerrain && !terrainPlayer) {
            auto result = nlohmann::json{
                {"networkPackets", activeTerrain->packets},
                {"hasPublisher", activeTerrain->hasPublisher},
                {"hasChunkSource", activeTerrain->hasChunkSource},
                {"maxQueuedChunks", activeTerrain->maxQueuedChunks},
                {"serializedBytes", activeTerrain->serializedBytes},
                {"queuedChunkSent", activeTerrain->queuedChunkSent
                    ? nlohmann::json(*activeTerrain->queuedChunkSent) : nlohmann::json(nullptr)}
            }.dump();
            std::printf("BEDFORM_CINNABAR_TERRAIN_WINDOW %lld %s\n",
                        static_cast<long long>(activeTerrain->actor.rawID), result.c_str());
            std::fflush(stdout);
            activeTerrain.reset();
        }

        if (terrainPlayer && handler && activeTerrain->transport) {
            if (activeTerrain->transport->detached()) {
                activeTerrain->transport.reset();
                std::printf("BEDFORM_CINNABAR_DETACHED %lld %p\n",
                            static_cast<long long>(activeTerrain->actor.rawID), static_cast<void*>(terrainPlayer));
                std::fflush(stdout);
                activeTerrain.reset();
                terrainPlayer = nullptr;
            } else {
                activeTerrain->transport->forward(*handler, *terrainPlayer);
            }
        }
        if (terrainPlayer) {
            if (auto& publisher = terrainPlayer->mChunkPublisherView) {
                activeTerrain->hasPublisher = true;
                activeTerrain->hasChunkSource |= static_cast<bool>(publisher->mSource);
                activeTerrain->maxQueuedChunks =
                    std::max(activeTerrain->maxQueuedChunks, publisher->mQueuedChunks->size());
                if (pumpPublisher && publisher->mSource) {
                    terrainPlayer->ServerPlayer::$_updateChunkPublisherView(terrainPlayer->getPosition(), 0.0f);
                    if (activeTerrain->transport) {
                        std::vector<ChunkPositionAndDimension> readyChunks;
                        for (auto const& [position, queued] : *publisher->mQueuedChunks) {
                            if (activeTerrain->transport->hasChunk(position)) {
                                continue;
                            }
                            if (auto chunk = queued.lock(); chunk && chunk->mLoadState->load() == ChunkState::Loaded) {
                                readyChunks.push_back(position);
                                if (readyChunks.size() == 8) {
                                    break;
                                }
                            }
                        }
                        for (auto const& key : readyChunks) {
                            if (publisher->_sendQueuedChunk(key, nullptr)) {
                                activeTerrain->transport->addChunk(key);
                                if (!activeTerrain->publishedSpawn) {
                                    activeTerrain->transport->ready(*handler->mNetwork.mReflectionCtx);
                                    activeTerrain->publishedSpawn = true;
                                }
                            }
                        }
                    } else if (!activeTerrain->queuedChunkSent) {
                        for (auto const& [position, queued] : *publisher->mQueuedChunks) {
                            if (auto chunk = queued.lock(); chunk && chunk->mLoadState->load() == ChunkState::Loaded) {
                                auto key = position;
                                FixturePeer peer;
                                ll::ScopedValue scope{activePeer, peerLookup ? &peer : nullptr};
                                activeTerrain->queuedChunkSent = publisher->_sendQueuedChunk(key, nullptr);
                                auto packet = MinecraftPackets::createPacket(MinecraftPacketIds::SubChunkRequestPacket);
                                if (packet && handler) {
                                    auto& request = static_cast<SubChunkRequestPacket&>(*packet);
                                    auto const& origin = terrainPlayer->getPosition();
                                    request.mCenterPos = SubChunkPos{
                                        static_cast<int>(std::floor(origin.x / 16)),
                                        static_cast<int>(std::floor(origin.y / 16)),
                                        static_cast<int>(std::floor(origin.z / 16))
                                    };
                                    request.mDimensionType = terrainPlayer->getDimensionId();
                                    request.mSubChunkPosOffsets->emplace_back();
                                    request.mSenderSubId = terrainPlayer->getClientSubId();
                                    handler->handle(terrainPlayer->getNetworkIdentifier(), request);
                                }
                                std::printf("BEDFORM_CINNABAR_PEER_SEND %zu %zu\n", peer.packets, peer.bytes);
                                std::fflush(stdout);
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (bootstrapPlayer) {
            auto const uniqueId = bootstrapPlayer->getOrCreateUniqueID();
            attempted.insert(uniqueId);
            activeTerrain.emplace(
                bootstrapPlayer->getNetworkIdentifier(), uniqueId, bootstrapPlayer->getClientSubId()
            );
            char* bridgeDir = nullptr;
            size_t bridgeDirLength = 0;
            if (_dupenv_s(&bridgeDir, &bridgeDirLength, "BEDFORM_CINNABAR_CAPTURE_RELAY") == 0 && bridgeDirLength > 1) {
                activeTerrain->transport = std::make_unique<FixtureTransport>(
                    bridgeDir, std::to_string(uniqueId.rawID), bootstrapPlayer->getUuid().asString()
                );
            }
            std::free(bridgeDir);
            BootstrapTrace trace{*bootstrapPlayer};
            ll::ScopedValue scope{activeBootstrap, &trace};
            std::printf("BEDFORM_CINNABAR_BOOTSTRAP_BEGIN %lld\n", static_cast<long long>(uniqueId.rawID));
            std::fflush(stdout);
            handler->_sendLevelData(*bootstrapPlayer, bootstrapPlayer->getNetworkIdentifier());
            auto result = trace.packets.dump();
            std::printf("BEDFORM_CINNABAR_BOOTSTRAP_PACKETS %lld %s\n",
                        static_cast<long long>(uniqueId.rawID), result.c_str());
            std::fflush(stdout);

            auto packet = MinecraftPackets::createPacket(MinecraftPacketIds::RequestChunkRadius);
            if (packet) {
                auto& request = static_cast<RequestChunkRadiusPacket&>(*packet);
                request.mChunkRadius = 4;
                request.mMaxChunkRadius = 4;
                request.mSenderSubId = bootstrapPlayer->getClientSubId();
                trace.packets.clear();
                handler->handle(bootstrapPlayer->getNetworkIdentifier(), request);
                auto radius = trace.packets.dump();
                std::printf("BEDFORM_CINNABAR_CHUNK_REQUEST %lld %s\n",
                            static_cast<long long>(uniqueId.rawID), radius.c_str());
                std::fflush(stdout);
            }
        }
    }

public:
    bool load() { return true; }

    bool enable() {
        if (!enabledFlag("BEDFORM_CINNABAR_IDENTITY_PROBE")) {
            return true;
        }
        if (enabledFlag("BEDFORM_CINNABAR_BOOTSTRAP_PROBE")) {
            bootstrap.emplace();
        }
        pumpPublisher = enabledFlag("BEDFORM_CINNABAR_PUBLISHER_PROBE");
        if (pumpPublisher && enabledFlag("BEDFORM_CINNABAR_PEER_PROBE")) {
            peerLookup.emplace();
        }
        listener = ll::event::EventBus::getInstance().emplaceListener<ll::event::ServerLevelTickEvent>(
            [this](ll::event::ServerLevelTickEvent& event) { observe(event.level()); }
        );
        return listener != nullptr;
    }

    bool disable() {
        if (listener) {
            ll::event::EventBus::getInstance().removeListener<ll::event::ServerLevelTickEvent>(listener);
            listener.reset();
        }
        previous.clear();
        peerLookup.reset();
        bootstrap.reset();
        attempted.clear();
        return true;
    }
};

IdentityProbe instance;

} // namespace bedform::native_probe

LL_REGISTER_MOD(bedform::native_probe::IdentityProbe, bedform::native_probe::instance);

