# Gizmo adapter foundation

`Diagetic.Gizmo` is available through `import { Diagetic } from "bedform"`,
`import * as Diagetic from "bedform/Diagetic"`, and the dedicated
`import * as Gizmo from "bedform/Diagetic/Gizmo"` entrypoint.
Imports and `Make` never acquire a native host, invoke hooks, spawn objects, or install listeners.
`Start({ Definitions })` creates a disposable discovery/recovery registry. It currently provides
`Discover(itemId, query)` and `Resolve(definitionId, targetKey)`, with no native input or editing driver.
`Gizmo.Geometry` supplies pure shared handle geometry, picking, focus and drag projection.
Native held-use routing, transactions, persistence journals, shared ownership,
tutorials and rendering are subsequent stages of `MineCraft-74ii`; callbacks and policies below
define their contracts and do not claim those interactions are already implemented.

Definitions associate a stable namespaced `Id`, one or more item identifiers, ordered enabled
`Modes`, and a generic `Adapter<T>`. The first enabled mode is the initial mode; mode cycling
uses that same order. Duplicate modes, empty capabilities, malformed identifiers, invalid numbers,
and incomplete private-preview hooks are rejected. A runtime rejects duplicate definition IDs
and overlapping item capabilities. Existing scalar `Kind`, attachment, persistence and toggle APIs
remain independent.

## Geometry, focus and captured drags

`Gizmo.Geometry.Build({ Transform, Parent, View, Mode, Size?, Tolerance? })` builds a frozen
snapshot of local X/Y/Z handles in world coordinates. X/Y/Z are red/green/blue. Translation uses
arrow shafts and four converging head struts, local XY/XZ/YZ patches and a camera-plane center patch.
Rotation uses three closed 48-segment rings. Scaling uses axis stems and cubes, local plane patches,
and a uniform center cube. `Parts[].Primitives` contains the exact capsule and oriented-box solids
used by `Pick`; the later particle renderer must consume these descriptors. Size defaults to one
block and tube radius/tolerance to 0.08 blocks. Target scale does not shrink the handles.

`Pick(geometry, ray)` returns the nearest forward solid intersection, independently of the target's
broad focus region. Equal-distance overlaps use stable geometry order, X then Y then Z then planes
then center. Rays inside a solid return distance zero. Arrow heads, stems, ring endcaps and patch
thickness participate in the same tests. There are no collidable helper entities.

`Focus(runtime, itemId, query, mode?)` returns at most one focused target and its `Geometry` plus
optional `Hover`. It uses the registry's existing candidate ranking, capability, validity, eligibility,
range, bounds-angle and explicit occlusion checks. A focused target can have no hovered handle.
The initial mode follows the definition's order; an explicit mode must be enabled. Adapters remain
responsible for body-bound geometry and world occlusion queries: pure geometry cannot inspect a world.

After a successful pick, call `Begin(geometry, picked.Handle, currentRay, adapter.ReadDegrees(target))`.
Use geometry freshly built for that grab. The returned controller's `Sample(ray)` projects normal
camera aim analytically and never repicks. It captures the local basis, parent frame, original pose,
handle and camera plane. Initial projection offsets prevent a jump when grabbing away from the
center. Axis movement uses closest ray/axis projection; plane and ring movement uses ray/plane
intersection. Camera-plane movement captures the camera normal at grab time. Invalid, nearly
parallel, behind-camera and ring-center projections return `Valid: false` with the previous pose
and measurements unchanged. If acquisition itself is degenerate, the first valid sample establishes
the zero-delta anchor. Well-formed rays must have finite origins and unit directions.

`Result.Transform` is an unsnapped segment proposal. `Translation` is parent-frame displacement,
`ScaleChange` is additive component change, and `AngleDegrees` is a continuous selected-axis angle.
X pitch/Z roll follow right-handed rotation; positive Minecraft Y yaw has the opposite sign.
`RotationDegrees` follows the nearest continuous Y-X-Z Euler branch, retaining winding through seams
and pitch singularities instead of normalizing away full turns. Sample rotations less than 180 degrees
apart so winding is unambiguous. Axis/plane scaling is additive and works from zero. Uniform scaling
preserves proportions using the largest absolute starting component; when all components are zero
it uses an equal-component direction. No division by a zero target-scale component occurs.

On release, discard the pure controller. For a regrab or new mode, build geometry from the current
transform and begin a new segment. This refreshes local axes and anchors without moving the target.
The future transaction driver preserves the whole edit's original snapshot across these segments;
limits, snapping, weighted motion and native input are separate layers. These helpers never apply
adapter transforms, lock players, create presentation resources or emit lifecycle callbacks.

## Target adapters

`Adapter<T>` has synchronous `Discover`, `Resolve`, `Key`, `IsValid`, `HitTest`, `Read`,
`ReadDegrees`, `Parent`, and `Apply` hooks. Hook functions should close over their dependencies
rather than rely on a mutable `this`. `Discover` returns a bounded array of candidates in the query's
dimension. `HitTest` measures the actual target body or bounds, independently of handle geometry:
positive distance in blocks, angle in degrees from the view ray to the bounds, and explicit occlusion.
Direct hits rank before angular near misses, nearest direct hits first, then angle and distance.
The default range is 3 blocks, targeting allowance 15 degrees, with occluded targets excluded.
`Eligible` can reject a target for the given player. Discovery never applies a transform.

Keys identify underlying objects or parts across wrappers, add-ons and reloads. Include a durable
object identity and part identity, not an array index. Block coordinates alone are insufficient when
a replacement block represents a different object: include the object's persisted generation/identity.
`Resolve` returns `undefined` while unloaded or unavailable, verifies the returned object's key,
and never creates a target. Recovery drivers must retain unresolved receipts and prevent conflicting
reacquisition until restoration succeeds.

`Read` returns position in blocks, unit Hamilton quaternion orientation, and component scale in the
declared parent frame. `Parent` returns a rigid parent-to-world position/quaternion frame. Use Bedform's
Quat/Rotator conventions for conversion. Scaled or sheared ancestry must be handled explicitly
inside the adapter. `ReadDegrees` supplies continuous parent-frame x/pitch, y/yaw, z/roll channels;
these retain values such as 720 degrees. `Apply(target, transform, degrees)` receives both orientation
and updated continuous channels, allowing the developer to preserve turns without quaternion
decomposition. `Snapshot` copies and freezes transform data, checks finite components and a unit
quaternion, and preserves zero/negative scale. It does not enforce an edit's bounds.

The compiled examples in [Gizmo.types.mts](../Test/Gizmo.types.mts) cover two adapters:

- **Entity parts:** key each part by durable entity ID plus authored part name; store its local pose
  and continuous channels in developer data, expose the developer's parent frame, and publish changes
  through authored properties or animations. There is no assumed native bone/roll/scale setter.
- **Block-backed objects:** resolve a persisted object record, check its backing block, and publish its
  local transform through a developer-owned model renderer. Applying object scale does not claim to
  resize a native block or its native collision box.

## Editing contracts

Translation, rotation and scale channels accept `Bounds.Actual` and `Bounds.Change` with inclusive
optional `x/y/z` min/max endpoints. Actual values use the adapter's parent frame; changes refer to
the whole edit's original snapshot. Rotation uses continuous degree channels. Scale actual minima
default to 0.001 per component; an explicit minimum of zero or a negative number overrides it.
Snapping defaults off. Positive per-axis increments use absolute or whole-edit-relative origins;
snapping runs before bounds enforcement. Bounds take precedence.

Walking locks by default. `AllowWalking` suits edits large relative to the player and may feel slightly
janky. Cycling, guides, confirmation review and physics default off. Optional physics specifies positive
inertia/strength, nonnegative damping/friction, and freeze or coast on release. Measurements default on,
translation precision is zero or one decimal place, and scale precision zero through three.

Shared preview provisionally applies transforms through the adapter. Private preview requires all
three synchronous `Create`, `Update`, and `Dispose` hooks and leaves the real target unchanged until
commit. `OnPreview`, `OnCommit`, `OnCancel`, `OnAbandonment`, and `FormatText` receive the original
and current transform, original/current continuous rotation channels, player (when available), target,
stable key, session token, mode, selected handle, transition reason, and all abandonment reasons.
Callbacks are never called by `Make` or registry-only `Start`.

Abandonment defaults to cancel with no timeout. Optional per-reason outcomes cover timeout, distance,
held-item change, death, disconnect, dimension change, invalid targets, disposal and a developer
predicate. Evaluate simultaneous reasons together; cancel wins conflicting outcomes. Commit must
never recreate an invalid target. Future transaction drivers own journals and cleanup; the discovery
registry has no target mutation or permission receipts to restore.

## Item content and experimental text

Merge `Gizmo.UseComponents()` into the authored item's components. It emits a frozen
`minecraft:use_modifiers` fragment with `use_duration: 3600`, `movement_modifier: 1`, and
`start_using: "always"`; optionally pass a different positive duration in seconds. See the
[official component reference](https://github.com/MicrosoftDocs/minecraft-creator/blob/main/creator/Reference/Content/ItemReference/Examples/ItemComponents/minecraft_use_modifiers.md).
The interaction driver will own native item-start/stop-use signals, repeated-event suppression and
session-token fencing of stale releases. The helper does not register a script-owned item key.

`StartOptions.Presentation` structurally injects synchronous `Create`, `Update`, and `Dispose`
operations around the experimental text constructor and manager. `TextRequest` explicitly requests
billboarding, `DepthTest: false`, and a player visibility list. Import native experimental classes in
the consumer bridge, using release-matching beta typings; no native experimental runtime import is
part of this public module. The foundation validates but does not call the bridge. Bedform Common's
stable dependencies and existing scalar controls are unchanged. A later versioned Common contract
will own rendering resources, acknowledgments, session tokens and durable tutorial aggregation.
