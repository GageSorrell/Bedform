# Native Intent qualification

`MineCraft-zcmm.9` runs Canvas Intent on a real Bedrock Dedicated Server. From the
repository root:

```powershell
npm run test:native --workspace bedform-canvas
```

The command builds Bedform's published `Distribution/`, then runs
`Tool/Native.mts`. It needs no administrator rights and no Minecraft client.

## Isolation

- The server is the fixed executable `Addon/BedformCanvas/dist/bds-runtime/bedrock_server.exe`.
  The runner refuses to start if that executable is already running, and holds
  `dist/native.lock` while it runs.
- Engine files (executable, DLLs, `data`, `definitions` and the stock vanilla,
  experimental and chemistry packs) are copied from `BDS_PATH`, by default
  `C:/MineCraft/Server`. The source installation is only read. Its worlds,
  configuration, properties, allowlist and permissions are never copied or changed.
- Each run creates a new world, `dist/bds-runtime/worlds/canvas-native-*`. Earlier
  worlds and other servers are left alone. Player joining and LAN visibility are
  off, and the ports are chosen by the operating system.
- The executable is listed in `npm run firewall:configure`, like the other test
  runners. Ordinary runs never request elevation and never change firewall rules.
  Install the rule with that explicit command if Windows prompts.

## What is installed

| Pack | Contents |
| --- | --- |
| Bedform Canvas BP/RP | Unpacked from the `dist/bedform-canvas.mcaddon` that the run builds |
| Canvas Native Consumer A and B | Two separate script packs. Each bundles `Test/Native/Consumer.mts` against the published `bedform/Spatial/Intent`, with its own Intent `Id`, and depends on the Canvas behavior pack the way a Bedform build declares it |
| Canvas Native Driver | `Test/Native/Driver.mts`, using `@minecraft/server` 2.10.0 and `@minecraft/server-gametest` 1.0.0-beta for simulated players |

The world enables the `gametest` (Beta APIs) experiment. The driver sends commands
to each consumer, and each consumer calls `Set`, `Clear`, `Dispose` or `Start` and
reports the result. The two consumers share nothing except Canvas.

## Three server processes

1. **Observed.** `Test/Native/Observer.mts` is placed in front of the built Canvas
   script. It wraps Canvas's own `Player.spawnParticle`, `addText`,
   `TextPrimitive.remove` and `setLocation`, and records each call after it
   succeeds. The driver asks it what was sent. It can also make one viewer's
   `spawnParticle` throw, to test fault isolation. The rest of the Canvas script
   is byte-identical to the build. The observer is needed because the native
   `getShapes()` lists only the calling pack's shapes. This process runs the full
   matrix below and stops the server with requests still active.
2. **Observed restart.** The same world is reopened. The old subject is loaded and
   watched, but Canvas draws nothing until new requests arrive. A connection from
   the previous process is refused with the restart message. Fresh connections
   then render privately again, and replace, clear and dispose correctly.
3. **Unmodified.** The byte-identical Canvas script is reinstalled. Wire traffic,
   the restart fence, set, replace, expiry, clear and dispose all work. After the
   server stops, the runner compares every installed Canvas file with the archive.

The runner fails if any process times out, exits with a nonzero code, logs an
`ERROR`, or logs a script warning other than the expected injected-fault report.

## Matrix

| Contract | Native evidence |
| --- | --- |
| Command and acknowledgement delivery | Raw hello reaches `ready`. Acknowledgements arrive with `sourceType` `Server`. Consumer operations settle in about one tick |
| Incompatible protocol version | Version 2 hello is rejected with the version message |
| Malformed traffic | Uncorrelated JSON is never acknowledged. A bad body is rejected. A missing subject is rejected as unavailable. A repeated request number is rejected as stale |
| Cross-pack Id ownership | A second hello under consumer A's Id is rejected while A is connected |
| Player subject privacy | Two opposite viewers each get particles and one private text. The subject gets nothing. A viewer 40 blocks away and one in the Nether get nothing |
| Text presentation | Exactly one viewer per text, depth test on, transparent background, no rotation or back faces, color `#4D4D4D`, scale 1.25 |
| Range boundary | Head-to-head distance 40: a range of 40.01 includes the viewer, 39.99 excludes it, and replacement removes the old texts |
| Movement | After a teleport, the text moves by exactly the head's movement |
| Replacement and disposal | B replaces A's glyph, and the texts disappear. A's disposal leaves B's newer request in place. A late `Set` on the disposed connection is rejected locally. A reconnects under the same Id |
| NPC subject and expiry | A villager's bubble reaches all three nearby players, including a player who is a subject elsewhere. A replaced request's expiry does not remove the replacement. The replacement then expires. B can clear A's request |
| Fault isolation | One viewer's particle calls fail for several ticks. Every other viewer keeps its particles and text. Canvas logs one report per subject-viewer pair, and the failing viewer recovers when the fault ends |
| Dimension changes | A player and a villager each move to the Nether. Only the Nether viewer then sees their bubbles, and nothing is left in the overworld. The villager keeps its entity id |
| Unload and reload | When a ticking area is removed, its villagers unload within 2 ticks and are no longer drawn. A request without a duration resumes on reload. A 300-tick request that expired while unloaded does not come back |
| Death | `kill()` stops drawing immediately. The dying villager stays valid during its death animation, and a later `Set` is rejected with "has died" |
| Disconnect | A disconnecting subject's bubble disappears, and it is removed from every audience |
| Scoped disposal | Disposing B removes only B's requests. A's remote request survives |
| Restart cleanup | Shown by processes 2 and 3 above |

## Findings

- `system.sendScriptEvent` delivers between packs with `sourceType` `Server`, as the
  protocol requires.
- An already-rejected promise must be awaited before the native callback returns.
  If a handler is attached one microtask later (for example by returning the
  promise from an `async` wrapper), BDS logs `Unhandled promise rejection` as an
  `ERROR`, even though the rejection is handled afterwards. A direct `await` of
  `Set`, `Clear` or `Dispose` logs nothing.
- Mobs stay valid during their death animation, and players stay valid until they
  respawn. Canvas now rejects requests for a subject whose health is 0 or less, so
  a request sent right after death is not drawn on the corpse.
- Simulated players do not load or tick chunks here. Native `spawnParticle` fails
  outside ticking chunks ("not in a chunk currently loaded and ticking"). The
  fixture therefore uses ticking areas, and Canvas reports and isolates the error
  for that viewer.
- `PrimitiveShapesManager.getShapes()` lists only the calling pack's shapes (see
  [TextPrimitive](../../../Documentation/TextPrimitive.md#3-server-side-text-limits)).
- Teleporting a villager to another dimension keeps its entity id, and the move is
  visible on the next tick.

## Recorded run

[Native.results.json](Native.results.json) is a copy of `dist/native.results.json`
from the passing run on November 18, 2026:

- BDS 1.26.63.1, build 53340801, from `C:/MineCraft/Server`
- Canvas `@minecraft/server` 2.10.0, and the driver's `@minecraft/server-gametest`
  1.0.0-beta
- Processes of 46 s, 6 s and 6 s, each stopped cleanly with exit code 0 and no unexpected warnings
- 112 installed Canvas files matching the archive, SHA-256
  `330b802e13f24fd2756949fb1ab9a5c73b6d6561b9abd93c0af2ba9172df4922`

The full server logs are `dist/native-observed.log`, `dist/native-restart.log` and
`dist/native-unmodified.log`.

## What this does not establish

All audience checks are server-side. They show what Canvas asked the engine to send
to each player. They do not show what a client receives or draws. Real-client
appearance, privacy, billboarding, occlusion, text alignment, particle trails and
tint fidelity belong to `MineCraft-zcmm.10`. A passing run therefore records
`NativeAcceptance: true` and `ClientAcceptance: false`.
