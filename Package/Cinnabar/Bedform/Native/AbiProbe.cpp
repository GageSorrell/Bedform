// Bedform's native feasibility probe. Original integration code under the MIT license.
// API declarations remain owned by LeviLamina; see ../LeviLamina.COPYING*.
// This file does not create, attach, disconnect or replace any player.

#include "mc/network/ServerNetworkHandler.h"
#include "mc/server/ServerPlayer.h"
#include "mc/server/SimulatedPlayer.h"
#include "mc/world/actor/player/Player.h"

namespace bedform::native_probe {

// Taking addresses of the concrete thunks requires linkable symbols, rather than merely
// proving that a virtual declaration exists in a header. No method is invoked by this probe.
auto volatile ResolvePlayer = &ServerNetworkHandler::$_getServerPlayer;
auto volatile SendLevelData = &ServerNetworkHandler::_sendLevelData;
auto volatile SendPlayerPacket = &ServerPlayer::$sendNetworkPacket;
auto volatile CreateSimulatedChunkSource = &SimulatedPlayer::$_createChunkSource;
auto volatile CreatePlayerChunkSource = &Player::$_createChunkSource;
auto volatile UpdatePlayerChunkView = &ServerPlayer::$_updateChunkPublisherView;
auto volatile PlayerSpawnChunkLimit = &ServerPlayer::$_getSpawnChunkLimit;

using AuthInputHandler = void (ServerNetworkHandler::*)(
    NetworkIdentifier const&, PlayerAuthInputPacket const&);
auto volatile HandleAuthInput = static_cast<AuthInputHandler>(&ServerNetworkHandler::$handle);

} // namespace bedform::native_probe

// Exported solely to keep every import alive through release-link elimination. This is not
// a LeviLamina module entrypoint and must not be installed into a BDS mods directory.
extern "C" __declspec(dllexport) bool CinnabarNativeAbiReferencesPresent() {
    using namespace bedform::native_probe;
    return ResolvePlayer != nullptr && SendLevelData != nullptr && SendPlayerPacket != nullptr
        && CreateSimulatedChunkSource != nullptr && CreatePlayerChunkSource != nullptr
        && UpdatePlayerChunkView != nullptr && PlayerSpawnChunkLimit != nullptr
        && HandleAuthInput != nullptr;
}
