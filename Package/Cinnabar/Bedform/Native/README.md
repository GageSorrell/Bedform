# Exact-player feasibility: not yet demonstrated

Bedform-8ww.2 is in progress. The user explicitly selected the development machine
instead of the originally planned VM. That changes the execution location; it does
not qualify a different BDS/SDK version. No BDS instance has been started or changed
by this investigation, and no native player has been attached.

## Reproducible ABI prerequisite

The CMake project checks the existing `../compatibility.json` before selecting a
compiler, resolving dependencies or linking. It refuses the currently mismatched
version tuple and never downloads tools, changes global defaults or falls back to
an older BDS. Run from the repository root using the installed CMake:

```powershell
cmake -S Package/Cinnabar/Bedform/Native -B Package/Cinnabar/.local/native-abi
```

Once the exact tuple is qualified, supply explicit qualified SDK include and import
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

## Remaining acceptance

The checked SDK and codec/assets target 1.26.60.6, while Bedform requires 1.26.66.1.
Mojang's [protocol changelog](https://mojang.github.io/bedrock-protocol-docs/changelog/)
lists protocol 2225 and no packet changes for 1.26.61, 1.26.62, 1.26.65 and
1.26.66. This establishes published packet-schema continuity across those hotfixes;
it does not establish registry equality, native layout/symbol compatibility or the
correctness of the client's codec implementation. The version difference alone
must not be described as proof of wire incompatibility.
The existing local BDS source inspected during this investigation reports 1.26.63.1;
it was not copied, launched or modified. These are concrete version blockers, not
proof that attachment can never be implemented. Retargeting and native execution
remain required before accepting any result.

Both the global and Test-associated spawning paths still need before/after script
IDs, native pointer/unique/runtime IDs, complete player-count observations, a real
rendered world frame, input-induced server observations, standalone detach and
GameTest teardown evidence. All BDS operations must execute on the server thread.
Normal network logins, mocked screenshots and manually invoked script callbacks
cannot satisfy this gate. Neither this source audit nor a successful ABI link probe
closes the issue or unblocks production integration.
