# Exact-player feasibility on Windows

Bedform-8ww.2 demonstrated the native attachment on the user-selected Windows
development host with BDS 1.26.60.6 and the pinned loader and SDK. The fixture
attached Cinnabar to players created through both native script APIs.

## Reproducible ABI prerequisite

The xmake project builds the probes against LeviLamina 26.60.8, the
26.60.6-server.16 runtime data, and LeviBuildScript 0.6.1. Copy
`compatibility.json` and the `Native` directory into an ignored scratch
directory, preserving their relative layout. From the scratch `Native`
directory, build each target independently because LeviBuildScript uses a
shared intermediate import library.

```powershell
xmake f -P . -a x64 -m release -p windows -y
xmake -P . -j 1 CinnabarNativeAbiProbe
xmake -P . -j 1 CinnabarNativeIdentityProbe
```

`CinnabarNativeIdentityProbe.dll` uses LeviLamina's shared allocation operators
and runs its probe on the server level tick. Load it alongside its manifest
only in an isolated fixture on the fixed package BDS executable. Set
`BEDFORM_CINNABAR_IDENTITY_PROBE=1` to enable the identity scan.
`IdentityFixture.js` creates the standalone player, then the runner can issue
`execute positioned 1 -59 1 run gametest run CinnabarProof:Identity` after
standalone disconnect. The fixture needs the GameTest experiment, the pinned
server and GameTest script modules, and a small `proof:identity` structure
with a solid floor at relative `(0,0,0)`.

Set `BEDFORM_CINNABAR_BOOTSTRAP_PROBE=1` to invoke the native level-data
path and submit a chunk-radius request for each existing player. The publisher
and peer experiments are separately opt-in through
`BEDFORM_CINNABAR_PUBLISHER_PROBE` and `BEDFORM_CINNABAR_PEER_PROBE`.
The latter supplies a scoped diagnostic peer solely for the queued-chunk
call. It counts writes and has no renderer transport.

The CMake project checks the existing `../compatibility.json` before selecting a
compiler, resolving dependencies or linking. It accepts the selected aligned
1.26.60.6 tuple and refuses mismatches. It never downloads tools or changes global
defaults. Run from the repository root using the installed CMake:

```powershell
cmake -S Package/Cinnabar/Bedform/Native -B Package/Cinnabar/.local/native-abi
```

Supply explicit SDK include and import
library paths through the named CMake cache variables. `AbiProbe.cpp` references the
concrete SDK methods needed for player resolution, outgoing packets, level bootstrap,
chunk publication and incoming auth-input dispatch. It has no player-construction
calls, loader entrypoint or install target. Building it will establish symbol linkage
only. It cannot establish correct layouts, successful attachment, renderer output,
server-thread dispatch, identity preservation or teardown behavior.

## Source findings

The LeviLamina findings below use commit
`db7ea1f1a964baa9c9612845ea60575d76a012ec`, recorded with the exact file hashes
and source URLs in `source-audit.json`.
The Cinnabar session finding uses the upstream import commit recorded in
`../import.json`, specifically `core/proxy/session_messages.go` and
`crates/protocol/src/session_wire.rs`.

- `ServerNetworkHandler` exposes `_getServerPlayer`/its concrete thunk and
  `_sendLevelData`. Ordinary `createNewPlayer`, `createSimulatedPlayer` and login
  entrypoints create or initialize a login path; they are not evidence that an
  existing script-created player can be attached without replacement.
- `ServerPlayer` supplies outgoing packet and chunk-publisher methods.
  `LoopbackPacketSender` has targeted and broadcast paths. A real adapter must
  capture both while routing incoming packets against the existing native identity,
  not fabricate an ordinary RakNet/NetherNet login.
- `SimulatedPlayerFixes.cpp` deliberately excludes GameTest-associated players from
  its ordinary-player chunk-loading path, using both a spawning scope and the
  player's GameTest helper. Therefore the ordinary-player fix is not sufficient
  evidence for `Test.spawnSimulatedPlayer`. An attachment must preserve that helper
  and its teardown ownership while supplying the required chunk stream.
- The Cinnabar session boundary accepts a handoff containing identity, resource-pack
  metadata and startup packets. The native adapter must populate these from the
  actual existing player and actual world, including StartGame and its true runtime
  ID. The current Go path owns a normal network login; that path does not prove the
  requested native attachment.

## Windows results

BDS 1.26.60.6 build 52886189, protocol 2225, ran under PreLoader 1.16.8 and
LeviLamina 26.60.8. The two xmake targets compiled and linked with xmake 3.1.2
and Visual Studio 18's `clang-cl`. The loader enabled the allocator-integrated
identity probe. Raw logs and the disposable experiment driver are ignored
under `Package/Cinnabar/.local`.

Both spawn APIs resolved to the same native player via
`ServerNetworkHandler::_getServerPlayer`. Script ID, native unique ID,
and native `StartGame` unique ID agreed. The packet runtime ID matched the
native runtime ID. The fixture's script and native player counts each
recorded 0 → 1 → 0, with scripted disconnect for standalone and
`test.succeed()` for GameTest teardown. Neither player had a connection request.

The server serialized `StartGame` and `ItemRegistry` on its targeted send
path and answered each radius request with `ChunkRadiusUpdated`. The ordinary
publisher queued up to 121 chunks for standalone and zero for GameTest in
the fixture window. Calling the base publisher update queued up to 121
chunks for each. The pinned import library could not resolve
`NetworkChunkPublisher::sendQueuedChunks` (LNK2019). Calling the linkable
`_sendQueuedChunk` instead on an initially queued entry returned false for
both players. The subsequent explicit player-centered subchunk experiment
observed one `LevelChunk` and one `SubChunk` packet at
`NetworkSystem::send` for each original player. BDS serialized the subchunk
payloads to 1,348 bytes for standalone and 3,224 bytes for GameTest. The
scoped diagnostic peer received zero writes. The subsequent fixture relay
delivered each player's native handoff and terrain stream to Cinnabar.

See `8ww-2-native/subchunk-experiment.log` for the terrain, identity and
teardown records, `8ww-2-native/bedform-build/publisher-build.log` for the
unresolved SDK symbol, and `8ww-2-native/live-relay-retry.log` for loopback
packet delivery. Windows restarted during the first local relay run. The
stock BDS executable and configuration were restored and rehashed.

## Visible renderer proof

The November 23, 2026 run used Cinnabar 0.2.1, the protocol 2225 vanilla carrier,
and the RTX 3060 through D3D12 with driver 32.0.15.9186. The local runner loaded
the fixture DLL at Bedform's fixed BDS test path. The renderer opened a normal
window for each fixture. Windows UI Automation reported a Cinnabar taskbar
entry with one running window for each launch. Win32 desktop captures show the
live terrain, HUD and script-set title in both sessions. A second run showed the
required resource pack's magenta terrain override in the standalone window.
Both clients logged that they prepared that pack for the join.

| Spawn API | Script/native unique ID | Native runtime ID | Native address | Server yaw after look input |
| --- | --- | --- | --- | --- |
| `spawnSimulatedPlayer` | `4294967297` | `1` | `00000345E0E97880` | 45° |
| `Test.spawnSimulatedPlayer` | `4294967314` | `24` | `00000345E0E9DC80` | 44.99998° |

Each handoff carried the original IDs in `StartGame`. Native lookup returned
the original player with a player count of one and no connection request. The
bridge used the existing player's native `simulateLookAt` on the level tick to
apply Cinnabar look input. The standalone player retained its identity after
renderer detach and remained present until script disconnect. The GameTest
completed normally, removed its player and caused the relay to end the renderer
session. Both fixtures returned the player count to zero.

From the repository root, run the local fixture with Node 24.19.0 and the
pinned native and renderer outputs already built:

```powershell
$node = (Get-ChildItem Package/Cinnabar/.local/node24.19 -Filter node.exe -Recurse |
    Select-Object -First 1).FullName
$env:WGPU_BACKEND = 'dx12'
$env:WGPU_ADAPTER_NAME = 'NVIDIA GeForce RTX 3060'
& $node --import tsx Package/Cinnabar/.local/taskbar-proof.mjs renderer
```

Local evidence is under `Package/Cinnabar/.local/8ww-2-native/`:

- `renderer-taskbar.log` and `cinnabar-identity-fdd3336d-218e-42ce-8fe5-bd3ac614038b/`
  contain the identity and lifecycle evidence and both Windows captures. Each
  session directory includes its taskbar screenshot and window diagnostics.
- `renderer-taskbar-pack.log` and `cinnabar-identity-90590ba2-e79d-41c0-a781-5d5a36e88406/`
  contain the required pack archive, renderer preparation logs and the standalone
  terrain override capture. This run used `taskbar-pack-proof.mjs` with `CINNABAR_LOG`
  set to `info,wgpu=warn,naga=warn` and `capture-fixture-windows.ps1` on the same
  interactive desktop.

The proof uses the Windows desktop capture. Cinnabar's internal PNG readback
returned black frames in the earlier comparison and remains unqualified for
automated capture.
