# Two-client cuboid acceptance

Client acceptance is **open**, per the user's November 2, 2026 instruction. There are no recorded client captures. The fixture and server smoke described here prepare that work; neither server snapshots nor host interpolation tests prove rendered intermediate frames.

From the repository root, prepare a disposable world:

```powershell
npm run prepare:physics:client --workspace bedform
npm run preview:physics --workspace bedform
```

BDS discovery uses `BDS_PATH` when supplied, otherwise `<repository>/Server`, otherwise the existing `Package/Bedform/dist/bds-runtime`. WorldRealism files and saved test worlds are not required. If your extracted BDS installation is elsewhere, set its actual directory before preparation:

```powershell
$env:BDS_PATH = 'C:\path\to\your\bedrock-server'
npm run prepare:physics:client --workspace bedform
npm run preview:physics --workspace bedform
```

The selected directory must contain `bedrock_server.exe`, `behavior_packs` and `resource_packs`. It is read only; the demo runs from Bedform's fixed runtime. An invalid explicit `BDS_PATH` or `BDS_TEST_WORLD` fails with a targeted diagnostic. The world template is created automatically unless `BDS_TEST_WORLD` is explicitly supplied. The engine must match the Bedrock client version you intend to connect with.

Preview defaults to the latest prepared gallery via `dist/physics-client-session.json`; an explicit generated `client-session.json` path is also accepted. Preparation retains all previous demo worlds and saves the previous server configuration in the new run directory. The foreground preview forwards console commands; enter `stop` for a clean save. Preparation and preview share the ordinary BDS lock and fixed `dist/bds-runtime/bedrock_server.exe`. Preparing another fixture changes that runtime's configuration, so prepare again if preview reports a configuration mismatch. The runtime/template overrides documented in [PhysicsRuntime](physics-runtime.md#validation) also apply to preparation. Preparation briefly boots and cleanly stops a private disposable vanilla world to obtain engine-saved metadata; it does not install packs into an existing world or leave the preview server running.

Startup logs `BF_CLIENT_WAITING` while checking every gallery chunk. It retries unloaded/undefined block reads for up to 120 probes five ticks apart, then either starts the scene or emits an explicit `BF_FAIL`. A ticking-area creation failure is reported separately. Wait for `BF_CLIENT_READY` before using scene controls. If an older generated pack reports `LocationInUnloadedChunkError` at startup, stop it, update the fixture sources and run preparation again; restarting an old session does not rebuild its bundled script. Players join in creative mode at `(-8,99,6)`, facing east along the path. The world uses peaceful difficulty, permanent noon, clear weather and a true flat grass generator with the surface at y=98. Partial startup failures release the runtime before reporting their structured diagnostics.

Connect two matching-version Bedrock clients to the test machine at port **19142**, accept the generated resource pack, and record both clients' exact versions, settings and display/recording frame rates. Preparation retains **NetherNet**, required by the tested engine; its bundled `bedrock_server_how_to.html` documents the dual-stack TCP signaling socket on `server-port` and negotiated UDP connection. `server-portv6` is ignored by that transport. Network/firewall setup remains the repository's explicit administrator operation; ordinary fixture commands never elevate. The fixture uses online authentication and allows joining. Use the printed server log and `BF_CLIENT_READY`, rather than a timeout alone, to establish readiness. No successful client connection is claimed by preparation or smoke.

The gallery contains six separate, automatically running demonstrations in a line east along X. Walk along the stone path at z=6. Each station has a wall-mounted stone button at y=100 (head height) with a waxed sign immediately above it. Pressing a button resets only that station and restarts its motion. The travel and rotation stations reverse direction within their bays, so their owners cannot drift away. The stop-and-hold station stays stopped until its button is pressed again. The drop repeats every nine seconds.

| Station | Center | Demonstration |
| --- | --- | --- |
| 1. Full rotation | `(0,101,0)` | Colored cube translates slowly and rotates about all three axes. |
| 2. Smooth travel | `(16,101,0)` | Colored cube shuttles over ten blocks, crossing render-base changes. |
| 3. Stop and hold | `(32,101,0)` | Cube moves for one second, stops and holds its endpoint. Press reset to repeat. |
| 4. Teleport reset | `(48,101,0)` | Cube jumps between two positions every three seconds. |
| 5. Gravity drop | `(64,103,0)` | Dynamic cube falls under gravity, contacts the floor and settles. |
| 6. Moving floor | `(80,99.375,0)` | Four-block-wide platform translates and yaws; stand, walk and jump on it. |

No scenario script events are needed or handled by this gallery. The earlier `rotate` and `support` events changed two existing owners rather than spawning demonstrations, and continuous motion could carry them out of view. Existing prepared sessions retain their old bundled code: stop the old server and prepare a fresh gallery after updating sources. Generated client geometry now has explicit UVs and enlarged visible bounds for root motion; actual client rendering still requires visual verification. Accept the newly generated resource pack on connection.

For capture automation only, `scriptevent bedform_fixture:capture label` logs a bounded label, timestamp/tick, participant count, poses and sequence/reset markers. Reset button presses also log snapshots. Two clients should use different viewpoints and exchange roles for support tests.

Record uncut, timestamped videos from both clients, preferably at 120 fps, and retain original files. For each continuous interval, compare position and full orientation at **0, 12.5, 25, 37.5 and 50 ms** against the common-root position lerp and shortest-path normalized quaternion lerp. Report actual sample times; 60 fps recordings cannot directly resolve every requested time. The presentation is buffered by one tick. Confirm ordinary transitions have intermediate poses, no 20 Hz visual stepping, no double native smoothing, and no render-base snap. Correlate captures with sequence snapshots, but do not infer client property coherence from server write order alone.

Exercise late joining during motion, exit/rejoin, unloading/reloading, clean server stop/restart and explicit reset/teleport. A restart reports restored owners instead of spawning duplicates, then resets all six stations to reproducible starting poses; initial visual intervals settle. Repeat moving/rotating support while each player stands still, walks independently and jumps. Record foot jitter, launch motion, side contacts, helper counts and any diagnostics. Qualify the documented terrain approximations on the intended content version separately; the flat-floor fixture does not cover every block family or dimension.

The fixture is the starting scene, not the complete capture matrix. Add recorded cases for q/-q equivalence, half-turn ties and wrapping, nonzero origin/COM offsets, existing versus generated trivial roots, varied client frame rates, sequence timing and transient reset behavior. Numerical/compiler fixtures cover these contracts on the host; corresponding real-client cases remain unverified until captured.

Store an evidence manifest with engine/client versions, hardware, frame rates, scenario commands/times, both video hashes, selected frame timestamps, measured errors, raw `client.log`, and the generated session/catalog/asset hashes. `BF_CLIENT_SNAPSHOT` and `client-smoke.json` are server evidence only. The smoke command adds `--smoke` to preview, stops after readiness and explicitly records zero participants and no captures.

Remaining cuboid evidence is tracked in **MineCraft-8zu.5.2**, also serving the shared `.4` acceptance boundary. Actual generated particle visual/lifecycle and combined grabbing evidence remain downstream in **MineCraft-2zx**; retain its fixed 4096 mask policy without adding an all-platform resolution campaign.

## Gallery implementation check - November 2, 2026

The initial gallery check used `dist/physics-bds-sw36Qv/client-session.json`. The BDS startup smoke verifies generated grass at y=98, six placed signs/buttons, all six active physics owners, translation/full rotation, endpoint hold, dynamic floor contact, creative mode and peaceful difficulty. It does not press a button as a player or establish client rendering. The moving platform has a quarter-block clearance above the ground to avoid the existing flush-terrain CCD failure. Previous disposable worlds remain retained.

Five focused host tests and lint of the changed engine/tool files pass. Tooling TypeScript checking passes with `--skipLibCheck`; the ordinary command reports six `QueuingStrategy` errors in upstream Effect declarations. Runtime remains visibly slow on this machine, even in this small scene; startup smoke is not sustained cadence/performance qualification. Keep the performance follow-up `MineCraft-8zu.5.1` and real-client acceptance `MineCraft-8zu.5.2` open.

The portability fix `MineCraft-8zu.5.5` was checked with no `BDS_PATH` or `BDS_TEST_WORLD` override: preparation reused Bedform's fixed runtime, created `physics-bds-uJu510-bootstrap` through BDS, then generated `physics-bds-uJu510` without WorldRealism inputs. Preparation and headless preview smoke exited 0; all six station owners were active. The current latest-session alias selects that gallery. Seven focused host tests, changed-file lint and tooling typechecking with `--skipLibCheck` passed; this is not a full package or client qualification. Bootstrap logs and `client-smoke.json` are in `dist/physics-bds-uJu510`.

## Invisible-owner diagnosis - November 2, 2026

User observation: the path, signs and buttons render, but physics owners do not. `MineCraft-8zu.5.6` identified a reproducible precision defect in the generated animation: combining biased 16-bit coordinate words near 2^31 before subtracting the bias loses small coordinates in float arithmetic. For an owner at y=101, float32 evaluation of the old generated expression returned -1616 geometry units rather than zero, putting the model 101 blocks below its native owner. The prior JavaScript-double expression test did not expose this defect. Molang's numeric values are floats; see the [Molang syntax guide](https://learn.microsoft.com/en-us/minecraft/creator/documents/molang/syntax-guide#values).

The generator now removes the high-word bias before scaling, subtracts the native origin before adding low/fraction words, and then adds the interpolated local offset. A test evaluates the generated expressions with float32 intermediate arithmetic across gallery, negative, fractional and 65536-boundary coordinates, including native-origin movement and interpolated local poses. It fails with the old generator and passes with the fix; all 13 physics compiler tests pass. The transient rendering correction leaves simulation/persistence and the 50 ms presentation contract unchanged.

The regenerated session is `dist/physics-bds-ZNNyuF/client-session.json`, selected by the latest-session alias. Preparation gives it new pack UUIDs, so reconnect and accept that new resource pack after rebuilding on the machine hosting the demo. This diagnosis and numerical fix do not establish real-client visibility; keep the issue open until a client confirms the objects render.
