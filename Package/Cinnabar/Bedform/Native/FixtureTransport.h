#include "mc/deps/core/utility/BinaryStream.h"
#include "mc/deps/core/utility/ReadOnlyBinaryStream.h"
#include "mc/deps/cereal/ReflectionCtx.h"
#include "mc/network/MinecraftPackets.h"
#include "mc/network/NetworkSystem.h"
#include "mc/network/ServerNetworkHandler.h"
#include "mc/network/ServerNetworkSystem.h"
#include "mc/network/packet/PlayerAuthInputPacket.h"
#include "mc/network/packet/SubChunkRequestPacket.h"
#include "mc/network/packet/PlayStatusPacket.h"
#include "mc/server/SimulatedPlayer.h"

#include <array>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <set>
#include <string>
#include <tuple>

class FixtureTransport {
    std::filesystem::path directory;
    std::ofstream outbound;
    size_t incoming = 0;
    size_t authPackets = 0;
    std::set<std::tuple<int, int, bool>> publishedChunks;

    static void varuint(std::string& bytes, unsigned value) {
        while (value > 127) {
            bytes.push_back(static_cast<char>((value & 127) | 128));
            value >>= 7;
        }
        bytes.push_back(static_cast<char>(value));
    }

public:
    FixtureTransport(std::filesystem::path root, std::string const& actor, std::string const& uuid)
        : directory(std::move(root) / actor) {
        std::filesystem::create_directory(directory);
        outbound.open(directory / "out.bin", std::ios::binary | std::ios::trunc);
        outbound.exceptions(std::ios::failbit | std::ios::badbit);
        std::ofstream(directory / "uuid") << uuid;
    }

    ~FixtureTransport() {
        outbound.close();
        std::ofstream(directory / "ended");
    }

    bool detached() const { return std::filesystem::exists(directory / "detach"); }

    bool hasChunk(ChunkPositionAndDimension const& key) const {
        return publishedChunks.contains({key.mPos->x, key.mPos->z, key.mIsBiomeOverride});
    }

    void addChunk(ChunkPositionAndDimension const& key) {
        publishedChunks.emplace(key.mPos->x, key.mPos->z, key.mIsBiomeOverride);
    }

    void capture(Packet const& packet, cereal::ReflectionCtx const& ctx) {
        std::string bytes;
        varuint(bytes, static_cast<unsigned>(packet.getId()));
        BinaryStream stream(bytes);
        packet.writeWithSerializationMode(stream, ctx, std::nullopt);
        auto size = bytes.size();
        std::array<char, 4> prefix{
            static_cast<char>(size >> 24), static_cast<char>(size >> 16),
            static_cast<char>(size >> 8), static_cast<char>(size)
        };
        outbound.write(prefix.data(), prefix.size());
        outbound.write(bytes.data(), size);
        outbound.flush();
    }

    void forward(ServerNetworkHandler& handler, SimulatedPlayer& player) {
        auto const& ctx = *handler.mNetwork.mReflectionCtx;
        for (int budget = 0; budget < 64; ++budget) {
            auto file = directory / (std::to_string(incoming) + ".in");
            std::error_code error;
            auto size = std::filesystem::file_size(file, error);
            if (error) {
                break;
            }
            ++incoming;
            if (size == 0 || size > 1024 * 1024) {
                continue;
            }
            std::string bytes(static_cast<size_t>(size), '\0');
            std::ifstream input(file, std::ios::binary);
            if (!input.read(bytes.data(), bytes.size())) {
                continue;
            }
            input.close();
            std::filesystem::remove(file, error);
            ReadOnlyBinaryStream stream(bytes, false);
            auto header = stream.getUnsignedVarInt();
            if (!header) {
                continue;
            }
            auto id = static_cast<MinecraftPacketIds>(*header & 1023);
            if (id != MinecraftPacketIds::PlayerAuthInputPacket && id != MinecraftPacketIds::SubChunkRequestPacket) {
                continue;
            }
            auto packet = MinecraftPackets::createPacket(id);
            if (!packet || !packet->read(stream, ctx) || !stream.ensureReadCompleted()) {
                if (incoming <= 5) std::printf("BEDFORM_CINNABAR_INPUT_DECODE_REJECT %d %zu\n",
                                               static_cast<int>(id), size);
                continue;
            }
            packet->mSenderSubId = player.getClientSubId();
            if (id == MinecraftPacketIds::PlayerAuthInputPacket) {
                auto const& auth = static_cast<PlayerAuthInputPacket const&>(*packet);
                handler.handle(player.getNetworkIdentifier(), auth);
                auto const rotation = *auth.mRot;
                // A simulated player retains its own native look controller. Apply the
                // real client's look to that same actor while the fixture owns the lease.
                if (std::isfinite(rotation.x) && std::isfinite(rotation.y)) {
                    player.simulateLookAt(player.getHeadPos() + Vec3::directionFromRotation(rotation));
                }
                if (++authPackets % 20 == 1) {
                    std::printf("BEDFORM_CINNABAR_AUTH_INPUT %lld %.3f %.3f\n",
                                static_cast<long long>(player.getOrCreateUniqueID().rawID), rotation.x, rotation.y);
                    std::fflush(stdout);
                }
            } else {
                handler.handle(player.getNetworkIdentifier(), static_cast<SubChunkRequestPacket const&>(*packet));
            }
        }
    }

    void ready(cereal::ReflectionCtx const& ctx) {
        auto packet = MinecraftPackets::createPacket(MinecraftPacketIds::PlayStatus);
        static_cast<PlayStatusPacket&>(*packet).mStatus = PlayStatus::PlayerSpawn;
        capture(*packet, ctx);
    }
};

