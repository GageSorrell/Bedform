# Diagetic definitions

Import `Diagetic` from `bedform`, or use `import * as Diagetic from
"bedform/Diagetic"`. Both resolve to the same implementation. Imports and
constructors are inert: they have no native runtime imports, obtain no host
objects, spawn no entities, install no listeners and invoke no user callbacks.
The spelling `Diagetic` is intentional.

Definitions, pure motion, recoverable native sessions, persistence,
[custom-control hooks](#custom-controls) and [built-in controls with shared models](#built-in-controls-and-shared-models)
(`b2bb.2` through `.7`) are implemented. `Start` subscribes to `playerInteractWithEntity`
for both grab and release, using the user's explicit assumption that this event supplies
both edges. Physical input and rendered presentation remain later client acceptance
work. BedformCommon 1.1.0 supplies the shared camera and player presentation, the
`bedform:diagetic_lever`, `bedform:diagetic_slider` and `bedform:diagetic_wheel`
entities with their models, and a runtime that registers those three types.

```ts
import { Diagetic } from "bedform";

export const Throttle = Diagetic.Make({
    Kind: "slider",
    EntityType: "example:throttle",
    InitialValue: 0.25,
    Length: 0.5,
    Sensitivity: 1,
    Inertia: 1,
    Damping: 8,
    Friction: 0,
    InteractionRange: 3,
    OnChange: ({ Control, Value }) => {
        Control.Entity.nameTag = `Throttle: ${Value}`;
    }
});
```

`Lever(options)`, `Slider(options)` and `Wheel(options)` supply their own kind.
`Make` requires a discriminated configuration with `Kind` equal to `"lever"`,
`"slider"` or `"wheel"`. Buttons and mismatched geometry options are rejected by
the types. Invalid kinds and invalid numeric policies are also rejected at runtime.

| Policy | Lever | Slider | Wheel |
| --- | --- | --- | --- |
| Default entity type | `bedform:diagetic_lever` | `bedform:diagetic_slider` | `bedform:diagetic_wheel` |
| Value units | Normalized | Normalized | Unwrapped degrees |
| Default limits | 0 to 1 | 0 to 1 | Unbounded |
| Default initial value | Lower limit | Lower limit | 0 |
| Default detents | Both limits | None | None |
| Geometry | `ArcDegrees: 90`, `ArmLength: 0.375` blocks | `Length: 0.5` blocks | `Radius: 0.25`, `DeadZone: 0.05` blocks |

Shared configuration includes `Limits: { Min, Max }`, scalar `Detents`,
`Spring: { Target, Strength }`, `Sensitivity`, positive `Inertia`, nonnegative
`Damping` and `Friction`, positive `InteractionRange`, `Eligible`, `OnGrab`,
`OnChange`, `OnRelease` and `OnCancel`. `DriveStrength` defaults to 120 and controls
attraction to the held target; `DetentStrength` defaults to 40 and controls
attraction to a released detent. Setting detent strength to zero disables it.
Motion policies are implemented by the simulation below and advanced by a started
runtime. Acquisition callbacks run during native sessions. Built-in handles publish
their pose to [synchronized properties](#built-in-controls-and-shared-models).
All numeric parameters must be finite. A wheel's dead zone must be smaller than
its radius. Configuration and nested data are copied and frozen; callback
functions retain their identity and are synchronous.

## Spawn and attach

Pass an explicit native `Dimension` to `Throttle.Spawn(dimension, location,
options)`. `options` extends native
[`SpawnEntityOptions`](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/spawnentityoptions?view=minecraft-bedrock-stable):
`initialPersistence`, `initialRotation` and `spawnEvent` are forwarded unchanged.
All remaining native options are forwarded too; Bedform consumes only these additions:

- `Value`: overrides the definition's initial value for this instance.
- `Pose`: optional local `Offset` in blocks and Euler `Rotation` in degrees.
  Missing components use zero vectors. Free controls compose this with native
  entity orientation; bound controls compose it with the selected block face.
  Native spawn options, including `initialRotation`, are forwarded unchanged.
- `Binding`: dimension identifier, integer `Position`, native `Face` and
  `ExpectedBlockType` for an optional supporting block. A started runtime monitors
  support without loading chunks or changing the block.
- `Initialize(entity, handle)`: runs once after a newly spawned entity is attached.

Validation of the value, model pose, binding, initialization function and spawn
position occurs before spawning. If native spawning throws, that error propagates.
If initialization or attachment fails, Bedform removes the newly created entity.
A rollback failure throws an `AggregateError` retaining both errors. A handle
captured by a failing initializer becomes invalid. Initialization must not return
an asynchronous operation; callbacks are synchronous.

`Throttle.Attach(entity)` attaches to an already valid entity of the configured
type without spawning or initializing it. Repeated attachment through the same
definition shares state without resetting its value or spawn metadata. Another
definition cannot attach to that same native object. Handles themselves need not
have identical JavaScript identity. A fresh attachment after unload/restart
restores the durable scalar, pose and binding from the same native entity.

Handles expose `Entity`, `Definition`, `Value`, `Pose`, `Binding`, `IsValid`,
`Motion`, `SetValue(value)` and `Remove()`. `SetValue` rejects non-finite/out-of-range values,
commits an actual change, then synchronously emits `OnChange` with `Control`,
`PreviousValue`, `Value` and `Source: "programmatic"`. The callback observes the
committed value; a thrown callback does not undo it. Assigning the same value
emits nothing. Invalid handles reject updates. Removal is idempotent after success;
if native removal fails, it can be retried. Removing an entity invalidates all
handles sharing its state.

## Persistence and block-face mounting

The entity dynamic property `Diagetic.Keys.DynamicProperty.Control` contains a
version-one record with the control kind, scalar value, pose and optional binding.
The first attachment writes defaults only when no record exists. Spawn writes its
validated initial value and metadata before `Initialize`. Programmatic changes and
each actual simulation value change commit before `OnChange`, including when the
callback throws. A rejected programmatic write leaves motion unchanged. A failed
simulation write restores the previous scalar, clears velocity and reports the
failure; a running session is cancelled by the runtime's error path.

Restoration validates the record against the current definition's kind and limits.
Malformed, oversized, unsupported or incompatible records fail closed and remain
untouched; Bedform does not clamp them, replace them with defaults, spawn recovery
actors or invoke change callbacks during restoration. Correct or migrate the
record explicitly before reattaching. Control property names are a saved-world
contract: back up and migrate worlds before changing them. Native dynamic
properties remain scoped to the owning behavior pack identity, which must stay
stable across upgrades.

Velocity, targets and held input are transient. A reloaded control starts from its
last saved value with zero velocity and no grab. Released springs/detents can
settle again under the current policy after discovery. Player recovery uses its
separate write-ahead journal; control restoration never resumes an interrupted
session. Entity removal removes its native durable data along with the actor.

For a binding, the interaction frame starts at the selected block-face center and
local +Z points outward. The `Pose.Offset` is measured in that face's axes;
`Pose.Rotation` rotates the local control axes within the face frame. North, South,
East and West retain local +Y as world up; Up and Down retain local +X as world +X.
Native carrier location/rotation are not changed. Without a binding the origin
and axes continue to follow the native entity and authored pose. Pose publication
uses the same frame, so the rendered model sits exactly on the interaction plane.

The runtime checks loaded supporting blocks every tick, including settled controls.
Air, a different block type, or moving the carrier to a different dimension retires
the bound control. A missing block result or native read error defers checking;
no chunk load or ticking area is requested, and acquisition waits until support can
be verified. Ordinary permutation/state changes retain a matching block type.
Observed player breaks, placements and block explosions at a tracked binding retire
it even if the same block type immediately returns. Changes made without those
events are detected by comparing the currently loaded block type.

Retirement first records `Diagetic.Keys.DynamicProperty.Retired`, cancels the holder
and restores player state, then removes the actor. Failed removal stays quarantined
and retries; the durable marker prevents reacquisition after reload/restart even
if the supporting type matches again. Cleanup failures report through `OnError`
without repeated identical retirement reports. No replacement actors are spawned.
Unbound controls have no support dependency and remain untouched by these checks.

## Projection and fixed-step motion

`Diagetic.Simulation.Make(configuration, initialValue?)` creates a standalone pure
controller. It retains only numeric configuration, never user callbacks, entities
or a native host. `handle.Motion` exposes the same controller operations against
the handle's shared live value, with change callbacks. Calling `Step()` advances
exactly **0.05 seconds**; no variable elapsed time is accepted. No constructor
or import steps it. A started runtime advances attached, loaded controls once per
native tick, including motion that continues after release. Standalone controllers
remain manually stepped; avoid also stepping a handle owned by a started runtime.

```ts
import { Diagetic } from "bedform";

const motion = Diagetic.Simulation.Make({ Kind: "slider", InitialValue: 0.5 });
motion.Begin({
    Camera: {
        Position: { x: 0, y: 0, z: 2 },
        Right: { x: 1, y: 0, z: 0 },
        Up: { x: 0, y: 1, z: 0 },
        Forward: { x: 0, y: 0, z: -1 }
    },
    Mount: {
        Position: { x: 0, y: 0, z: 0 },
        Right: { x: 1, y: 0, z: 0 },
        Up: { x: 0, y: 1, z: 0 },
        Normal: { x: 0, y: 0, z: 1 }
    }
});
motion.Look({ Delta: { x: 1, y: 0 }, Estimated: false });
const held = motion.Step();
motion.Release();
for (let tick = 0; tick < 200; tick++) motion.Step();
const settled = motion.State;
```

`Begin(frame, pointer?)` copies the camera and final world-space interaction frame.
The caller supplies the frame after applying the entity and authored model pose;
the simulation does not read native transforms or move entities. The default
grab point is the current handle point; an explicit `pointer` is local XY in
blocks. Acquisition never jumps the scalar value or executes a callback.

All axes must be unit and orthogonal. Camera `Right × Up = -Forward`; mount
`Right × Up = Normal`. Reversed, rotated and six-face mounts use the same projection.
The plane must be visible from the camera: acquisition fails for behind-camera
or unprojectable geometry. Later look rays that are parallel to the plane or
point behind the camera return `false` without changing committed state.

`Look({ Delta, Estimated? })` uses signed **degree deltas**, with yaw positive to
screen-right and pitch positive down. Sensitivity scales these deltas in the
frozen camera's unit-depth screen plane; ray/plane intersection converts them
into local pointer displacement. There is no FOV override, client setting lookup,
rotation recentering or second application of native player rotation. The native
input bridge supplies already measured/estimated deltas. `Look` changes the
target; `Step` advances the actual weighted value.

- Sliders project onto local X and constrain `State.Point` to the configured track.
- Levers derive signed angular movement around the local hub and constrain their
  point to `ArmLength`, with an arc centered around local +Y. Increasing value
  sweeps toward +X. Values map across the configured limits and `ArcDegrees`.
- Wheels integrate signed counterclockwise angular changes around the hub in
  local XY. The value is unwrapped degrees; crossing ±180 degrees does not jump.
  Radial motion contributes zero angle. Dead-zone entry/exit rebases the pointer,
  and a segment through the dead zone is rejected even when both endpoints lie
  outside it. An exact hub crossing remains ambiguous even with `DeadZone: 0`.
  Straight drags offset from the hub can describe a **bounded angular arc**, but
  do not become unrestricted rotation proportional to horizontal distance.

Implicit spring/damper integration applies inertia, damping and Coulomb friction
at every fixed tick. It remains stable for stiff positive systems and includes
numerical dissipation; it is not an energy-conserving rigid-body solver. Limits
clamp both values and outward velocity. Target increments at a stop do not build
up a reversal delay. Finite checks reject unrepresentable policy coefficients,
look input or arithmetic before a partial state update can be committed.

`Release()` preserves momentum and permits continued stepping. A positive return
spring takes precedence over detents. Otherwise a detent is selected from the
actual release value, with positive velocity choosing the upper detent at a tie
and zero/negative velocity choosing the lower. Default levers settle at their
two endpoints. Without springs/detents, sliders and wheels retain the position
reached after damping/friction dissipates momentum. With both damping and
friction zero, free motion intentionally keeps coasting. Static friction can
hold a control away from an attractor. Small residual motion is snapped at a
relative value tolerance of `1e-7` (scaled by the configured span, or 360 for a wheel).

`State` and `Step()` return frozen `Value`, `Velocity`, `Target`, `Dragging`,
`Settled`, `Estimated`, optional local `Pointer` and constrained local `Point`.
Velocity is measured in value units per second. `Estimated` tracks the most
recent accepted look until begin, release or a programmatic reset. Snapshots are
observations, not mutable state to restore. `SetValue` clears velocity and rebases
the pointer of an active drag so the next sample cannot create a phantom jump.

Stepping `handle.Motion` reports actual value changes through `OnChange`, with
`Source: "input"` while dragging and `"simulation"` while settling. Programmatic
updates still use `"programmatic"`. Callback failures propagate after the state
commit. Invalid/removed entities reject motion mutation; release remains available
for cleanup. Motion shared between attachments remains independent of handle
wrapper identity. The entity-keyed registry retains no actor, handle or callback
reference in its value, avoiding a self-referencing WeakMap retention path.

## Native sessions and explicit lifetime

```ts
import { system, world } from "@minecraft/server";
import { Diagetic } from "bedform";
import { Throttle } from "./Throttle.js";

const runtime = Diagetic.Start({
    World: world,
    System: system,
    Controls: [Throttle],
    OnError: (error) => console.warn(error)
});
// At shutdown:
runtime.Dispose();
```

`Start` requires real definitions with unique entity types and explicit `World`
and `System` dependencies. It returns immutable `Controls`, a live `Disposed`
flag, `IsInteracting(player)`, `Interact(player, entity)` and idempotent `Dispose()`.
It never removes consumer-owned controls. A deferred startup scans the three
vanilla dimensions for registered types; entity-load events and explicit
Spawn/Attach calls keep the registry current. Only active motion is stepped.
Registrations, subscriptions, queued work and the timer belong to this lifetime.
Disposal cancels sessions and fences stale callbacks even if native unsubscription
fails. Resource teardown failures are aggregated. Imports install no startup hook.

Use on a registered entity queues acquisition outside restricted before-event
execution. A later Use releases the player's current session. While the displayed
camera is frozen the player's hidden aim can drift off the control, so during a
session a first-press block interaction (`isFirstEvent`) or an item use also
releases; held-button repeats do not. Only duplicate observations within the same
tick are coalesced. `Interact` exposes that same
queued observation path for adapters and diagnostics: its boolean says whether
the observation was handled, not whether acquisition succeeded. It does not
synthesize physical input. Native item use and block interaction are cancelled
while acquisition is pending or a session is active. Inventory is never replaced.

The runtime claims both player and control before invoking eligibility or changing
native state. Only one player can hold a control, and a player can hold only one
control. Runtimes sharing the native interaction signal coordinate claims and
reject duplicate entity registrations. Cooperative session tags also prevent
acquisition while another script pack owns the player or control.

Before locking, Bedform commits a versioned recovery receipt to world dynamic
properties. It records the activation rotation and every native input-permission
category, including movement children. Acquisition requires the shared player
presentation property, locks body rotation and movement, clears velocity, and
freezes the native eye position and rotation with `anchored eyes`. No authored eye
offset or FOV is used. Camera input stays available; measured look deltas feed the
control while yaw/pitch recentering and bounded correction-gap estimates reuse
LookInputDemo's algorithm. Entity orientation or the binding's face and authored `Pose` compose the mount
frame once at acquisition. The action bar is refreshed with this exact prompt:

```text
§o§7Press §e:_input_key.use: §o§7to let go.§r
```

Release preserves motion for settling and calls `OnRelease`. Death, respawn,
disconnect, dimension change, leaving interaction range, invalid/removed controls,
runtime disposal and runtime errors cancel with `OnCancel` and the corresponding
reason. Retirement callbacks run while ownership is still held. Callback failures
cannot skip restoration; `OnError` observes runtime and recovery failures, and an
error in that observer cannot interrupt cleanup.

Restoration independently attempts activation rotation at the player's **current**
position, camera/FOV clearing, body unlock, each saved permission and prompt
clearing. Aggregate movement permissions restore before their child overrides.
It does not teleport the player back to the acquisition location. Only successful
restoration retires the exact receipt and ownership markers. Failed cleanup retains
the journal for retry while releasing local claims. Startup, online ticks and spawn
recover stale receipts without resuming the grab; unloaded control markers retire
when the entity loads. Exact receipt bytes fence stale cleanup from a newer
session. Corrupt receipts and foreign ownership fail closed, preserving saved data
instead of assuming default permissions. A corrupt receipt requires inspection
and repair by its owner before that player can acquire another control.

Shared player JSON must be merged with other packs that override `minecraft:player`;
see [common packs](common-packs.md). A missing presentation property rejects
acquisition before any lock or journal write.

Host tests cover immutability, numeric validation, native option forwarding,
initialization failure, shared handle state, removal retry, callback failure,
registration validation and inert imports in a restricted host. Packed-consumer
verification imports both entrypoints in an independent Node installation and
compiles the public type fixtures against the packed declarations.

Session tests additionally cover toggle contention, partial activation failures,
independent restoration failures, callback errors, lifecycle cancellation, exact
prompt preservation, corrupt/stale receipts and listener/timer teardown.

## Custom controls

`Diagetic.Custom.Make<S>(configuration)` creates a control whose behavior is supplied
by low-level hooks while the shared runtime keeps everything else: Use toggling,
one-player/one-control claims, claim-before-lock journaling, eye-anchored camera
capture, look measurement with correction-gap estimates, the exact release prompt,
range/lifecycle cancellation, recovery and player restoration. Register custom
definitions with `Start` alongside built-in ones; entity types must remain unique.
Bedform provides no branched-path, gate or transmission solver: any such geometry
belongs in the consumer's hooks.

`S` is the consumer's value type. Hooks are synchronous, and `Make` invokes none of
them. A value hook returns a new value to change state; returning `undefined` or the
identical value changes nothing, so treat values as immutable. `undefined` is
therefore not a valid value.

| Hook | Called | Receives | Returns |
| --- | --- | --- | --- |
| `Eligible` | After both claims, before any player mutation | Player, handle | `false` rejects |
| `Acquire` | After journaling and locking, before the camera freezes | `Value`, `Player`, frozen `Frame` | Next value |
| `Look` | Every held tick, before `Simulate` | `Value`, `Player`, `Frame`, `Delta`, `Estimated` | Next value |
| `Simulate` | Every fixed 0.05 s step while held or settling | `Value`, `Held`, `Estimated`, `StepSeconds`, held `Frame`/`Player` | `{ Value?, Settled }` |
| `Release` | Once per returned `Acquire`, before restoration | `Value`, `Player`, `Reason` (absent for Use) | Next value |
| `Save` / `Load` | Every changed commit / fresh attachment of a saved entity | Value / saved JSON | JSON data / value |
| `Publish` | After every commit and each fresh attachment | `Value`, `Source` (`"attach"` on attachment) | — |
| `OnChange` | After `Publish` for every commit | `PreviousValue`, `Value`, `Source` | — |

`Look` deltas use the built-in convention: degrees, positive yaw to screen-right and
positive pitch down. `Estimated` is `true` for samples reconstructed across a
rotation-recentering gap, so a control can damp, ignore or trust them. The same flag
is passed to `Simulate` and reported by `handle.Motion.State.Estimated` until release.
`Diagetic.Simulation.MovePointer(frame, pointer, delta, sensitivity?)` moves a
local plane pointer through the frozen frame exactly as built-in controls do and
returns `undefined` for rays that cannot reach the plane. `Simulation.CopyFrame`
validates and freezes a frame.

Each change commits in a fixed order: `Save` encodes the value, the entity record is
written only if the encoded bytes differ, the value is committed in memory, then
`Publish` and `OnChange` run. A throwing `Save` or a failed write commits nothing.
`Publish`/`OnChange` errors are raised after both have run; the value stays committed.
Fields omitted by `Save`, such as a transient pointer or velocity, can change without
a write. The record uses `Diagetic.Keys.DynamicProperty.Control` with `Kind: "custom"`;
`Load` must validate saved data and throw to fail closed, leaving the record
untouched. Built-in and custom definitions cannot attach to each other's records.
Reattachment after unload or restart restores the loaded value released, never held.

`Release` receives a `Reason` for every cancellation (`"error"`, `"disposed"`,
`"entityLost"` and the other built-in reasons) and none for a second Use. A throwing
`Acquire` acquires nothing and gets no `Release`; once `Acquire` returns, `Release`
runs exactly once even when a later hook, `Save` or write fails. Hook errors cancel
the session with reason `"error"` and report through `OnError`; restoration always
runs. After release the runtime keeps stepping until `Simulate` reports
`Settled: true` (omitting `Simulate` settles immediately). `SetValue` commits a
programmatic value through the same path. Custom configurations have no
`OnGrab`/`OnRelease`/`OnCancel`; `Acquire` and `Release` serve those roles.

Handles expose `Entity`, `Definition`, `Value`, `Pose`, `Binding`, `IsValid`,
`SetValue`, `Remove` and a low-level `Motion` driver (`Begin`, `Look`, `Step`,
`Release`, `State`) that the runtime calls. Spawn and Attach behave like built-in
definitions, with `Value` in spawn options typed as `S`; initialization or
`Publish` failure during Spawn removes the new entity.

The [example joystick](../Test/DiageticCustomExample.mts) composes every hook: a
spring-centred two-axis stick that places a pointer at its deflection on `Acquire`,
moves it with `MovePointer` on `Look` (halving estimated samples), follows it in
`Simulate` and springs back to centre after `Release`, persists only `X`/`Y`, and
publishes both axes as synchronized entity properties:

```ts
import { Diagetic } from "bedform";

export const Joystick = Diagetic.Custom.Make<Stick>({
    EntityType: "example:joystick",
    Initial: { X: 0, Y: 0 },
    Acquire: ({ Value }) => ({ ...Value, Pointer: { x: Value.X * Reach, y: Value.Y * Reach } }),
    Look: ({ Value, Frame, Delta, Estimated }) => {
        const moved = Diagetic.Simulation.MovePointer(Frame, Value.Pointer!, Delta, Estimated ? 0.5 : 1);
        return moved && { ...Value, Pointer: moved };
    },
    Simulate: ({ Value, Held }) => { /* follow Pointer while held, spring to centre after release */ },
    Release: ({ Value }) => ({ X: Value.X, Y: Value.Y }),
    Save: ({ X, Y }) => ({ X, Y }),
    Load: (saved) => { /* validate finite X/Y inside the unit disc or throw */ },
    Publish: ({ Control, Value }) => {
        Control.Entity.setProperty("example:stick_x", Value.X);
        Control.Entity.setProperty("example:stick_y", Value.Y);
    }
});

const runtime = Diagetic.Start({ World: world, System: system, Controls: [Throttle, Joystick] });
```

Host tests in `Test/DiageticCustom.test.mts` drive that example through the shared
harness and cover hook order relative to journaling, locking and camera capture,
estimated samples, durable versus transient fields, restore-released reloads,
fail-closed records, `Acquire`/`Look`/`Release`/`Simulate`/write failures, spawn
rollback and mixed built-in/custom registration. The packed-consumer test compiles
the example against the installed package. Native and physical-client coverage of
custom controls remains with the later acceptance entries.

## Built-in controls and shared models

BedformCommon 1.1.0 ships three entity types and registers them in its own script
runtime: `bedform:diagetic_lever`, `bedform:diagetic_slider` and
`bedform:diagetic_wheel`, using the default `Lever()`, `Slider()` and `Wheel()`
policies. Do not register these identifiers in another pack's runtime; give tuned
controls their own entity types (see below). Common's runtime also attaches entities
spawned by other packs or `/summon`, through `entitySpawn`.

Place a built-in control with a script event. From a player, `lever`, `slider` or
`wheel` binds to the block face in view (within 8 blocks); add `free` to float one
1.5 blocks ahead, facing the player, and an optional initial value:

```text
/scriptevent bedform:diagetic_place lever
/scriptevent bedform:diagetic_place wheel free
/scriptevent bedform:diagetic_place {"Kind":"slider","Dimension":"overworld","Position":{"x":0,"y":64,"z":0},"Face":"North","Value":0.5}
```

A JSON request without `Face` places a free control at `Position` facing `Yaw`.
The identifier is `Diagetic.Keys.ScriptEvent.Place`. Errors are sent to the player,
or logged when there is no player source.

| Model | Shape | Textures (vanilla paths) |
| --- | --- | --- |
| Lever | Vanilla 8 × 6 × 3 px base split by a 2.5 px channel; 2 × 2 × 10 px stick pivoting 1 px above the support and sweeping ±45° toward local ±X through the channel | `textures/blocks/cobblestone`, `textures/blocks/lever` |
| Slider | Button-shaped 6 × 4 × 2 px knob, longer along a narrow 14 × 2 × 1 px raised track; ±4 px travel | `textures/blocks/stone`, `textures/blocks/planks_oak` |
| Wheel | Blocky oak rim and four spokes, 8 px (0.5 block) across, with a grip at local +Y and a stone axle | `textures/blocks/stone`, `textures/blocks/planks_oak` |

Resource-pack overrides of those vanilla textures apply naturally. Each texture slot
has its own render controller that hides the other slot's bones.

### Pose publication

Control entities declare seven client-synchronized float properties,
`Diagetic.Keys.PoseProperty`: `OffsetX/Y/Z` (model-space bone translation in
pixels), `Yaw`, `Pitch` and `Roll` (nested mount bone rotations in degrees) and
`Motion` (the moving bone: lever handle Y rotation, slider knob X translation in
pixels, wheel Z rotation). Built-in handles publish after every attachment and
committed value change, before `OnChange`; only changed values are written, and each
value is clamped into `Diagetic.Keys.PoseRange`. Entity types without the schema are
left untouched. Custom controls that reuse the shared bone layout can call
`Diagetic.PublishPose(handle, motion)` from their `Publish` hook.

The shared models nest `root` → `offset` → `mount_yaw` → `mount_pitch` →
`mount_roll` → parts. `root` cancels `query.body_y_rotation`, so the model follows
the interaction frame regardless of the carrier's yaw; `offset` moves from the
carrier to the mount; the three mount bones orient the support plane. The client
animations only read properties: Bedform computes the Bedrock conventions. Model
geometry maps to world space at yaw zero as (x, y, −z) / 16, and bone X, Y and Z
rotations act as right-handed world rotations by X, −Y and −Z. The mount basis is
factored as Ry(a) Rx(b) Rz(c) and published as (−a, b, −c). Host tests rebuild
every face and several free poses through that chain. The convention matches the
repository's earlier Bedrock rigs, but rendered orientation still needs a client.

Carriers have a 0.75-block collision box (`Diagetic.CarrierSize`), no gravity or
collision, no damage or knockback, no pushing, persistence, blocked body rotation and
an entity interaction labelled "Grab". `Diagetic.BindingLocation(binding)` returns
the spawn location that centres that box a quarter block out from the support face.
Free controls render at the carrier location plus their `Pose.Offset`; place them
with an `Offset` of `CarrierSize / 2` upward so the box surrounds the model.

### Your own control types

`bedform/Build/DiageticControls` generates the shared content from source:
`BehaviorEntity(identifier)` and `ClientEntity(identifier, kind)` for your own
identifier, plus the shared `Geometry(model)`, `Animations()`, `RenderControllers()`
and `Localization()` that BedformCommon ships. Your client entity references
BedformCommon's geometry, animations and render controllers, so only the two entity
files and a name are needed. Register the identifier with a tuned definition in your
own runtime:

```ts
export const HeavyLever = Diagetic.Lever({
    EntityType: "example:heavy_lever",
    Inertia: 5,
    DriveStrength: 30,
    OnChange: ({ Control, Value }) => { Control.Entity.nameTag = Value >= 0.5 ? "On" : "Off"; }
});
```

The shared slider track is drawn for the default 0.5-block `Length`, and the lever
handle for the default 90° arc; other values still work but no longer match the model.

### Demonstration server

`Addon/DiageticDemo` prepares an isolated BDS world with all three built-ins on all six
faces of floating blocks, free controls that are tilted, rolled and turned, and
tuned controls: a heavy lever lighting a lamp, a spring-return throttle filling a
gauge, and a dial with 45° detents. See its [ReadMe](../../../Addon/DiageticDemo/ReadMe.md).

Native regression commands use LookInputDemo's fixed isolated BDS runner:

```sh
npm run test:diagetic --workspace @sorrell/look-input-demo
npm run test:native --workspace @sorrell/look-input-demo
```

Both passed on BDS 1.26.63.1, build 53340801. The Diagetic fixture verifies camera
and body presentation state, movement permissions, toggle contention, journal/tag
cleanup, unchanged inventory, settling and runtime restart using simulated players
and scripted `Interact` observations. It explicitly reports
`physicalInputVerified: false`. The standalone demo regression checks its native
item-Use toggle and look-correction path. Neither proves physical mouse/controller
input or rendered pixel alignment; those remain client acceptance work. Logs and
JSON evidence are written under `Addon/LookInputDemo/dist/`.
The retained [native result](diagetic-native.results.json) records the session
probe's engine version and assertions.

The persistence probe deliberately stops BDS with an active grab and reopens the
same saved world in a second process at the same fixed executable path:

```sh
npm run test:diagetic:persistence --workspace @sorrell/look-input-demo
```

On BDS 1.26.63.1, build 53340801, it restored seven actors without duplicates,
preserved values and poses, verified all six bound face frames, retained controls
through a normal log-axis state change, and removed only bound controls when the
support type changed. The reloaded motion was inactive with zero velocity. Retained
[save evidence](diagetic-persistence-save.results.json) and
[reopen evidence](diagetic-persistence.results.json) distinguish the two processes.
Host tests additionally cover unavailable chunks, malformed records, unload/load,
failed writes/removals and same-type replacement retirement across runtime restart.
