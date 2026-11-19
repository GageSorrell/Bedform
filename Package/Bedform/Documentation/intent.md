# Intent request client

`bedform/Spatial/Intent` provides inert intent definitions and an explicitly started
connection to BedformCanvas. The same API is available as `Spatial.Intent` from
`bedform`, or `Intent` from `bedform/Spatial`.

```ts
import { system, world } from "@minecraft/server";
import * as Intent from "bedform/Spatial/Intent";

const intents = Intent.Start({
    Id: "example:addon",
    World: world,
    System: system,
    OnError: (error) => console.warn(error.message)
});

// Called by your add-on when it has a valid player or other native entity.
await intents.Set(player, Intent.Builtin.Thinking, { DurationTicks: 60 });
await intents.Set(npc, Intent.Glyphs("\uE200\uE201", { Advances: [8, 16], Height: 16 }));
await intents.Clear(player);

// Called when your add-on releases this connection.
await intents.Dispose();
```

The [typechecked example](../Test/Intent.types.mts) also consumes the shared
`ImageDescriptor` from `bedform/Canvas/Image`. Generated Canvas.Images descriptors
are passed directly to `Set`; Intent does not own a second image compiler or load
images at runtime. The descriptor schema records version 1, namespaced registration
and particle IDs, per-frame width/height in pixels, frame count and ticks per frame.
Frame timing is measured from elapsed intent ticks so particle refreshes do not
restart animation. Descriptor compiler/output integration remains `MineCraft-zcmm.6`.

`Builtin` and each of its 19 definitions are frozen: Interrogative, Exclamatory,
ExclamatoryInterrogative, Thinking, SOS, Sleep, Affirmative, Negative, Knowledgeable,
Affectionate, Hunger, and ArrowUp/UpRight/Right/DownRight/Down/DownLeft/Left/UpLeft.
Arrows are screen-relative. Definitions describe artwork; importing or constructing
them starts no native services and allocates no glyphs.

`Glyphs` accepts exactly one to three BMP PUA code points (`U+E000`–`U+F8FF`).
Ordinary text, supplementary PUA characters and strings outside this length fail.
Optional metrics use positive finite logical-pixel `Advances` (one per character)
and `Height`. Omitted metrics remain omitted on the wire for runtime resolution
against Canvas's registered inventory and font fallback. Supply measured metrics
for third-party fonts; this client does not invent their widths. Canvas glyph ink
is baked `#4D4D4D`; other resource packs retain their authored glyph colors. Font
pixels are not recolored by this API. Shared glyph/particle generation and arbitrary
particle tint are separate deliverables.

Options default to indefinite duration (`null` on the wire), `Scale: 1`,
`Offset: { x: 0, y: 0.25, z: 0 }`, and `MaxDistance: 32`. Offset locates the
downward pointer tip relative to the current head position in world-axis blocks.
Explicit duration is a positive safe integer number of ticks. Scale/range must
be positive finite numbers and every offset component finite. Inputs are validated
and snapshotted before waiting for readiness, including caller-supplied definitions
that bypass `Glyphs`. Subjects must be valid native entities available from the
configured World; players and nonplayers use the same request contract.

## Acceptance, startup and disposal

`Start` requires an explicit World/System and a unique namespaced add-on `Id` of
at most 64 ASCII characters. Duplicate active IDs on the same supplied System are
rejected locally; Canvas must enforce identity ownership across independent pack
realms. One connection owns one script-event listener. The first hello is deferred
to a native tick, allowing early startup. The client repeats the same hello every
5 ticks for at most 100 ticks. It sends no mutations until a matching ready reply.

`Set` and `Clear` resolve only after Canvas accepts their correlated command. This
is not confirmation of delivery, visibility or appearance on any player's client.
Acceptance is unknown after a lost acknowledgement; mutations are never replayed.
Missing service, rejection, malformed correlated replies, protocol mismatch, native
transport failure and runtime restart produce actionable rejected promises.
`OnError` observes transport/runtime failures, including a startup failure before
the first operation. User validation errors reject the operation directly. Exceptions
from `OnError` cannot interrupt request settlement or cleanup.
After a startup failure, dispose the connection before creating another with the
same Id; operations on the failed connection keep the original startup failure.

`Dispose` immediately forbids later operations and rejects outstanding work. It
sends one fenced cleanup request if any traffic could have reached Canvas, even
if disposal races the hello acknowledgement. Calls share the same promise. Cleanup
releases only intents still owned by that connection; another add-on's newer
replacement survives. Local timers/listeners are released after acceptance or a
100-tick cleanup timeout; timeout rejects because remote cleanup is unconfirmed.
Disposal before the first transmitted hello needs no remote cleanup. Late replies
and retained scheduler callbacks cannot revive disposed requests.

## Shared public wire contract

`bedform/Canvas/IntentProtocol` is the canonical contract, forwarded by
`Addon/BedformCanvas/Public/Intent.ts` for the shared runtime. Script-event IDs are
defined exactly once in its frozen `ScriptEvent` record. Use System's native
[`sendScriptEvent`](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/system?view=minecraft-bedrock-stable#sendscriptevent)
and [`scriptEventReceive`](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/systemafterevents?view=minecraft-bedrock-stable#scripteventreceive).
Only server-origin acknowledgements are consumed. Installed add-ons and server
operators share a cooperative transport; it does not authenticate mutually hostile
packs. Neither client nor runtime should interpret payload text as a command.

Version 1 commands are `hello`, `set`, `clear` and `dispose`. Every message includes
Version, ClientId, a fresh ConnectionId and increasing RequestId. Acknowledgements
echo those fields and Operation, identify the current boot with RuntimeId, and use
`ready` for hello, `accepted` for mutations, or `rejected` with an actionable Message.
UTF-8 JSON is bounded to 2048 bytes; rejection messages are bounded to 256 characters.
Entity IDs and runtime IDs are bounded to 128 characters. Exact tuple/operation
matching prevents duplicate, stale or unrelated replies from settling another request.

The Canvas runtime must validate all untrusted command fields independently, enforce
cross-pack ownership, cache repeated hello results, fence disposed connection tokens
and stale request sequences, and reject commands naming another RuntimeId. Disposal
without RuntimeId must fence the connection even when its hello is delayed. A hello
ready response means the complete Intent service is installed, not merely that the
Canvas pack loaded. Intent state is session-only; lifecycle cleanup and rendering
are runtime responsibilities under `MineCraft-zcmm.3` and `.5`.

## Canvas runtime lifecycle

`MineCraft-zcmm.3` implements the shared arbitration service in
`Addon/BedformCanvas/Script/IntentRuntime.ts`, started by the Canvas pack entry. It
answers hello only after its complete handler is installed and keeps one current
request per entity across all connections. A newer accepted `Set` replaces it and
restarts its animation clock; reordered requests at or below a connection's last
sequence are rejected. Each duration timer removes only the generation that scheduled
it, and disposal removes only entries the disposing connection still owns.

Death and player disconnect clear the subject immediately. Dying mobs stay valid during
their death animation and dead players stay valid until they respawn, so `Set` rejects a
subject whose health is 0 or less with a "has died" message. Bedrock's `entityRemove`
event also fires for chunk unloads and gives no reason, so Canvas never clears on it.
An absent subject is suspended: it is not rendered, its duration keeps elapsing, and
the same request and animation clock resume when the entity reloads, including in
another dimension. A permanently removed entity's dormant record ends when its
duration expires, on `Clear`, when its owning connection disposes, or on restart.
Nothing is written to the world; a restart begins empty with a new RuntimeId, so
operations from older connections fail with the restart diagnostic.

## Current delivery boundary

`MineCraft-zcmm.2` delivers definitions, exports, validation, handshake and the
request client; `.3` delivers the Canvas arbitration runtime above. Canvas now starts
the `.5` private renderer and includes the `.4` built-in artwork. Builds now
[include Canvas automatically](canvas-packs.md) for surviving Intent runtime use.
Shared [Canvas image compilation](canvas-images.md)
now supplies static PNG and vertical-flipbook descriptors. Native transport, the
lifecycle matrix and server-side audiences are qualified by `.9` on an isolated BDS
([native qualification](../../../Addon/BedformCanvas/Documentation/Native.md)).
Real-client acceptance remains `.10`; neither host relay tests nor server-side audience
checks are visual evidence. No existing world or production installation is modified
by these APIs.

Run focused host and npm archive checks with `npm run test:intent --workspace bedform`.
The full `npm run verify --workspace bedform` also checks the independent offline
installed consumer; `npm run check --workspace bedform-canvas` verifies the Canvas
packs, the arbitration runtime against this client, and the shared contract module.
Run `npm run verify:intent --workspace bedform` for the complete
[automated qualification matrix and retained evidence](intent-qualification.md),
including artifact equality after pure and prepack preparation.

## Private rendering

Canvas's explicitly started `IntentRenderer` reads the arbitration snapshot every tick.
It follows the current head, ending the panel pointer at `head + Offset` (default
0.25 blocks above the head). The default panel is 32 by 24 logical pixels plus a
four-pixel pointer, at 32 pixels per block. `Scale` multiplies the presentation;
`Offset` remains in world-axis blocks. Same-dimension players within `MaxDistance`
(32 blocks by default, inclusive, measured head to head) receive private particles.
The subject player is excluded. Opposing viewers receive independently positioned
camera-aligned panels. Text and particles share the camera plane, with separate
depth offsets for the shadow, border, face, bevel and content. World occlusion uses
the normal depth-tested particle material and `TextPrimitive.depthTest = true`.

PUA primitives have one viewer each, assigned before `addText`. They use transparent
backgrounds, native camera billboarding and default dark gray `#4D4D4D` text, including
reset behavior; PUA texture ink retains its baked color. Panel expansion uses supplied
glyph metrics first, then Canvas's registered advance, then the bundled native font
fallback. The text pixel-to-block estimate remains subject to real-client calibration.
An inactive, replaced, unloaded, out-of-range or wrong-dimension primitive is removed;
Canvas never clears its `visibleTo` array (an empty native audience means public).

Particles refresh every tick and expire after two ticks. Static and animated custom
image descriptors use the shared Surface size/UV/tint variable contract. The frame is
`floor(ElapsedTicks / FrameTicks) % FrameCount`, independent of particle age. Images
fit within panel padding and preserve aspect ratio. Thinking advances every six ticks;
sleep has six frames at four ticks each. SOS reuses the existing Canvas Ten source.

The renderer bounds particle spawns (2048 per tick) and retained text (256), rejects a
whole viewer frame on capacity failure and reports affected subjects/viewers through
`OnError`. Other viewers continue. Errors are deduplicated until recovery, and work
retries next tick. Failed removals remain privately owned for retry. Disposal stops
drawing immediately and retries removal before releasing its ticker. It only touches
its own handles, never `removeAll`. This is cooperative presentation privacy, not a
security boundary against other packs or modified clients.

Host tests qualify these adapter calls and packed resources. `.9` qualifies native
delivery and per-viewer particle and text audiences on the server. Occlusion, pixel
calibration, billboarding, alpha, text alignment and two-client appearance/privacy still
require `.10`. Custom images use the shared
[Canvas image compiler](canvas-images.md);
Canvas dependency staging is automatic when the feature survives bundling.
