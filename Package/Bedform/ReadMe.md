# Bedform

**The framework for creating *MineCraft: Bedrock Edition* add-ons.**

Inert lever, slider and wheel definitions, fixed-step motion, persistence, recoverable sessions,
synchronized pose publication and low-level custom-control hooks are available through `bedform/Diagetic`
and the root `Diagetic` export; BedformCommon ships the built-in control entities, models and runtime.
The separate [Gizmo adapter foundation](Documentation/gizmo.md) adds inert item capabilities and
explicit generic transform-target discovery through `Diagetic.Gizmo` and `bedform/Diagetic/Gizmo`.
See [Diagetic definitions](Documentation/diagetic.md) for spawn/attach handles, projection,
weighted simulation, camera/look capture, block-face bindings, runtime ownership, recovery, custom controls,
built-in controls and the demonstration server.

The [Intent request client](Documentation/intent.md) is available through
`bedform/Spatial/Intent` and root `Spatial.Intent`, with frozen built-in definitions,
PUA glyph validation and an explicitly started, acknowledged Canvas transport.
Canvas supplies the shared state service, built-in artwork and private renderer;
[automatic pack inclusion](Documentation/canvas-packs.md) follows surviving
asset-backed runtime use. Pure
[text measurement](Documentation/measurement.md) is available at
`bedform/Spatial/Measurement` and `Spatial.Measurement`, including font presence,
byte limits, wrapping, centering pads and resource-pack overrides.

Register static PNGs and vertical flipbooks through
[Canvas.Images](Documentation/canvas-images.md). Builds supply a typed virtual
descriptor module and stage image textures and particles into the selected
resource pack, shared by Intent and spatial consumers.

Prototype-world authoring contracts are available through `bedform/Prototype`;
see [Create and configure Prototype demonstrations](Documentation/prototype-guide.md) for
code authoring and the planned in-game setup workflow, or the
[Prototype API reference](Documentation/prototype.md) for the implemented foundation and remaining services.

`bedform build` packages complete add-ons with shared project configuration and
strict-aware TSX compilation. Every complete build includes the shared BedformCommon
behavior and resource packs, including content-only and single-kind builds.
See [Script add-on builds](Documentation/configuration.md#script-add-on-builds) for pack discovery,
script mappings and output paths, and [Common packs](Documentation/common-packs.md) for automatic
inclusion, staged dependencies and shared pack versions.

## Features

- Game mechanics not found in Bedrock, including:
   - physics simulation
   - custom models, including non-cuboid geometry
   - procedurally-generated geometry
   - procedural tools (like noise and statistical sampling),

- Custom physics simulation
  - 4-tick sub-stepping with smooth motion driven by per-tick animations (object transform updates 20 times per second, animation makes it look real-time)
  - custom, multi-part collision of various shapes, including per-face ("complex") collision
  - customizable gravity (magnitude *and* direction), vertical drag, and linear/angular velocity
  - sub-tick rendering via animations driven by a root bone
  - automatic addition of root bone to simulating models that are boneless, when you run `bedform build`
- Custom model rendering via particle systems
  - allows for rendering models that previously relied on `poly_mesh`
  - allows for non-cuboid geometry, including *n*-gons via masked textures, generated automatically with `bedform build`
  - renders using ambient light (brightness)
  - can have collision just like other simulated bodies
  - can be used with the custom physics simulator
  - automatically creates a TypeScript module that exports a `ParticleModel` containing controls to create and manage in-game instances of your model
- `@bedform/server` input signals, allowing add-ons to subscribe to presses, holds, double-taps and tap-and-holds of Jump, Sneak and eight player-relative movement directions
- mathematical structures and utilities, including implementations of
  - quaternions and rotators (Euler angles)
  - matrices (4×4, useful for transformations in ℝ³)
  - transforms (structures that describe a location and orientation in ℝ³)
- functional libraries for Bedrock's `Vector2` and `Vector3`, which include operations that `@minecraft/math` does not offer
- `bedform/Voxel` block-lattice coordinates in meters, with Bedrock-compatible faces, neighborhoods, boxes and segment traversal
- `bedform/Microvoxel` 1/16 m lattice coordinates with in-block local and index addressing
- simulated cables, with customizable stiffness, number of segments, and appearance (supporting both cuboid and flat segments)
- custom audio at runtime (including streamed audio and audio procedurally-generated at runtime) on BDS servers that have `@minecraft/server-net` via the Bedform Sound companion app (available for free on Android, iOS, and Windows)

## Installation

To use `bedform` in your add-ons, first install `@minecraft/math`, which is a required peer dependency,

```bash
npm install --save @minecraft/math
```

then add `bedform` as a dependency,

```bash
npm install --save bedform
```

You might wish to add `bedform` globally as well, to use its CLI application directly in the terminal,

```bash
npm install -g bedform
```

`bedform` has *not* been tested with other package managers, but the author expects that `yarn` or `pnpm` can be used with no issue.

## Usage

Generate Minecraft-themed names with `bedform/Utility/Name`:

```ts
import { Name } from "bedform/Utility";

const Generated = Name.Make(); // Three random words, such as "creeper-copper-mending".
const Compact = Name.MakeFast(); // Three words from the smaller Minecraft-focused vocabulary.
const Custom = Name.Make({ Dictionary: [ "stone", "slime" ], NumWords: 2, Separator: "_" });
const Vocabulary: ReadonlyArray<string> = Name.Dictionary;
```

`Name` is also available as `Utility.Name` from `bedform`. The default dictionary
contains 765 frozen, unique lowercase words collected from vanilla BDS 1.26.63.1
block, item, entity, effect, enchantment and dimension registries. Names sample
with replacement and do not guarantee uniqueness. `NumWords` must be a nonnegative
safe integer; zero returns an empty string. Requesting words from an empty
dictionary throws `RangeError`. Custom dictionary strings are preserved as supplied.

`Name.DictionaryFast` is a frozen subset of 256 recognizable Minecraft words,
favoring iconic blocks, mobs, tools and resources over generic or obscure terms.
`Name.MakeFast` accepts the same configuration as `Name.Make`, defaulting to this
smaller dictionary. Three-word names have 16,777,216 possible combinations;
uniqueness is still not guaranteed. Increase `NumWords` when generating many names.
Tree-shaking bundles using only `MakeFast` can omit the full dictionary; unbundled
imports initialize both exported dictionaries.

Host-side project configuration is available through `bedform/Config`.
See [shared project configuration](Documentation/configuration.md) for the schema,
TypeScript constructor, JSON generation, and current integration boundaries.

Player input signals (`world`, `InputButton` and the button gesture after-events) moved to
[`@bedform/server`](../Server/ReadMe.md), which re-exports `@minecraft/server` with them in place.

`@TODO`

## Development

From the repository root:

```sh
npm run build --workspace @bedform/effect
npm run build --workspace bedform
npm run verify --workspace bedform
```

The source build uses only the ES2022 standard library plus Bedrock declarations. Host tests cover
recognition boundaries, lifecycle cancellation, resource cleanup, errors, public declarations,
packed consumers, README examples, and execution without Node/browser globals. World input tests
use mocked Bedrock signals and clocks; they do not require or modify a live world.
The reserved CLI entrypoint currently performs no actions.

## Immutable vectors

`Vector2` and `Vector3` are pure namespaces, also imported directly from
`bedform/Vector2` and `bedform/Vector3`. They accept plain readonly Bedrock
coordinates and return Bedform-owned frozen values with shared prototypes.
`@minecraft/math` is a required `^2.4.1` peer; development and differential tests
use exactly `2.4.1`. Production vector modules do not import it or Bedrock at runtime.

```ts
import { Vector2, Vector3 } from "bedform";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const direction = Option.getOrThrow(Vector3.Vector3(3, 0, 4));
const unit = Option.getOrThrow(Vector3.normalize(direction));
const offset = pipe(direction, Vector3.subtract({ x: 1 })); // (2, 0, 4)
const normal = pipe(Vector3.UnitX, Vector3.cross(Vector3.UnitY)); // +Z
const halfTurn = Option.getOrThrow(Vector3.slerp(Vector3.UnitX, Vector3.West, 0.5));
const text = Vector2.format({ x: 1.25, y: 2.5 }, { decimals: 2, delimiter: "|" });
const parsed = Vector2.fromString(text, { delimiter: "|" });
```

| API family | Exports in both modules |
| --- | --- |
| Construction and guards | `Vector2(x,y)` / `Vector3(x,y,z)` return Option; corresponding `Vector2Unsafe` / `Vector3Unsafe` preserve raw values. `isVector2` / `isVector3` identify enriched values; `isFinite` accepts plain coordinates. |
| Raw arithmetic | `add`, `subtract` accept partial coordinates (omissions are zero); `scale`, component `multiply`, `min`, `max`, `dot`, `magnitude`, `magnitudeSquared`, `distance`, `floor`, `ceil`, `clamp`. Overflow and nonfinite raw arithmetic remain ordinary numeric results. |
| Interpolation | `lerp` returns raw component interpolation; `slerp` returns Option, interpolating direction on a great circle and magnitude linearly. Parameters are unclamped. |
| Text | `format` / `toString` accept optional `decimals` and `delimiter`; default formatting preserves full precision. `fromString` / `parse` return Option and accept a delimiter option. Empty fields, numeric prefixes with trailing text, and nonfinite components are rejected. |
| Common constants | `Zero`, `One`, `Half`, `NegativeOne`, `UnitX`, `UnitY`. |

Vector3 additionally exports `cross`, `rotateX`, `rotateY`, `rotateZ`, `UnitZ`,
`East`, `West`, `South`, `North`, `Up`, `Down`, `Forward`, `Back`, `Right`, and `Left`.
Rotations use radians about positive coordinate axes. Minecraft coordinates are
X-east, Y-up, Z-south. North is -Z and south is +Z, correcting the pinned upstream
cardinal reversal. At zero facing, forward is +Z and facing-right is -X; use
`UnitX` for the positive coordinate axis. Vector2 uses mathematical X/Y coordinates
and does not infer world-facing directions.

Binary operations support `operation(a,b)` and `pipe(a, operation(b))`, retaining
operand order. Interpolation uses `operation(a,b,t)` or `operation(b,t)(a)`.
Formatting, parsing and clamp accept options directly or as curried operations;
`clamp` defaults omitted bounds to safe-integer limits, matching the reference.
Invalid decimal precision follows native `toFixed` RangeError behavior. Formatting
without decimal options is intentionally more precise than the reference's two decimals.

Validating construction rejects nonfinite components; zero is valid. Normalization
returns None for zero/nonfinite vectors and remains stable for huge/tiny finite inputs.
Slerp rejects either zero/nonfinite endpoint, nonfinite t, and unrepresentable results.
It handles parallel directions without division by zero. For exact antipodes,
Vector2 takes the counterclockwise perpendicular; Vector3 uses the least-aligned
positive coordinate axis (ties X, then Y, then Z), with tangent `axis cross start`.
For example +X to -X travels through -Z in 3D. This defines a deterministic path
rather than relying on the reference's undefined parallel/antiparallel behavior.

`Equal`, `Hash`, piping, Effect formatting, custom inspection and full-precision
`toJSON` are implemented on shared frozen prototypes. Equality uses exact components:
NaN equals NaN and signed zeros agree; Vector2 and Vector3 remain distinct kinds.
No fuzzy rotation quantization is applied to vectors. JSON includes `_id` and stored
coordinates; finite default text round trips through the strict parser.

`npm run verify:vectors --workspace bedform` checks the pure root surface, tools,
full package lint and all pure tests without the CLI dependency closure. `test:pure`
runs the package/adapter/gesture/recognizer/vector suites, including a clean
packed installation with required-peer enforcement and compiled README examples.
The unchanged full source build currently reports six upstream Effect Stream
`QueuingStrategy` declaration errors; the pure build uses ES2022 without host types
and does not suppress or weaken that full build. No live BDS/client validation is
claimed for this pure math work.

## Quat core

`Quat` is a pure root namespace and `bedform/Quat` subpath. Its same-named
interface has readonly `x`, `y`, `z`, `w` components and Effect protocols.
`Quat(...)` constructs a checked value; `QuatUnsafe(...)` preserves raw components.

```ts
import { Quat, Vector3 } from "bedform";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const parent = Option.getOrThrow(Quat.fromAxisAngle(Vector3.UnitY, Math.PI / 2));
const local = Option.getOrThrow(Quat.fromAxisAngle(Vector3.UnitX, Math.PI / 2));
const localComposition = pipe(parent, Quat.multiply(local)); // parent * local
const worldComposition = Quat.multiply(local, parent); // local * parent
const localResult = Option.getOrThrow(Quat.rotateVector(localComposition, Vector3.UnitY)); // +X
const worldResult = Option.getOrThrow(Quat.rotateVector(worldComposition, Vector3.UnitY)); // +Z
const matrix = Option.getOrThrow(Quat.toMatrix(parent));
const restored = Quat.fromMatrix(matrix);
const angleOrder = Option.getOrThrow(Quat.orderByAngleDistance(parent));
```

| API family | Exports |
| --- | --- |
| Construction/guards | `Quat(x,y,z,w)` returns Option for finite nonzero components; `QuatUnsafe` preserves raw components; `Identity`, `isQuat`, `isFinite`, `isNormalized`, `isIdentity`. |
| Raw algebra | `add`, `subtract`, `scale`, `divide`, `multiply`, `dot`, `magnitude`, `magnitudeSquared`, `conjugate`, `negate`. Division is raw native arithmetic, including division by zero. |
| Partial rotation math | `normalize`, algebraic `inverse`, `rotateVector`, `unrotateVector`, `alignShortestArc`, `fromVectors`, `fromUnitNormals`. |
| Conversion/directions | `fromAxisAngle`, `toAxisAngle`, `fromRotationVector`, `toRotationVector`, `fromMatrix`, `toMatrix`, `axes`, `axisX`, `axisY`, `axisZ`, `forward`, `up`, `right`. |
| Comparisons | `equals`, `equalsComponents`, `hashComponents`, `canonicalKey`, `equalsApprox`, `angularDistance`, `error`, `errorAngle`. |
| Orders/observability | `OrderLexicographic`, `OrderAngleDistance`, `orderByAngleDistance`, `format` / `toString`, `fromString` / `parse`, piping, JSON, custom inspection, Equal and Hash protocols. |

Hamilton multiplication applies the second rotation before the first. Binary
functions support data-first and data-last forms, preserving the order in the
example. Axis-angle and rotation vectors use radians. Positive yaw in Minecraft
uses a negative-Y-axis angle; positive pitch uses a positive-X-axis angle.
Positive roll uses positive Z. Neutral forward/up/facing-right are +Z/+Y/-X;
`axisX` describes the positive coordinate axis rather than facing-right.

Component algebra preserves stored signs and magnitudes and may emit nonfinite raw
results. Rotation interpretation normalizes stably without changing those fields.
Partial operations return None for invalid rotations, zero direction inputs, or
unrepresentable results. `fromUnitNormals` additionally requires unit lengths
within `1e-12`; `fromVectors` accepts arbitrary finite nonzero magnitudes. Exactly
antiparallel vectors use the least-aligned positive coordinate axis projected
perpendicular to the start direction (ties X, then Y, then Z). Shortest-arc
alignment only selects the raw sign and retains full magnitude and precision.

Axis-angle and rotation-vector extraction use a principal angle in `[0, pi]`;
identity uses positive X with angle zero. A zero rotation vector is identity,
whereas a zero axis is invalid even for a zero angle. Matrices are frozen readonly
row-major 4x4 tuples acting on column vectors, with a homogeneous bottom row and
no translation. Matrix construction rejects nonfinite entries, scale, reflection,
shear and invalid homogeneous terms using absolute `1e-10` acceptance tolerance.

Rotation protocols use stable normalization, positive-w sign selection (at w=0,
the first nonzero x/y/z is positive), rounding to 12 decimal places, another sign
selection after rounding, and signed-zero collapse. `canonicalKey` exposes that
frozen key for downstream protocol integration. Stored raw fields, JSON and text
retain full precision; this key never overwrites inputs or interpolation paths.
`equalsComponents` / `hashComponents` inspect the raw representation instead.
Approximate equality is a separate Option-returning operation with an explicit
finite nonnegative angular tolerance in radians.

`angularDistance` returns shortest angle in radians. `error` is normalized dot
error `1 - abs(unitDot)`; `errorAngle` is angular distance divided by pi, both in
`[0,1]`. Guard tolerances default to `1e-12`: raw absolute length for `isNormalized`
and angular radians for `isIdentity`. Invalid tolerances make guards false.

Both orders derive all valid comparison keys from canonical orientations and use
lexicographic ties, so comparison zero agrees with protocol equality and hashing.
Lexicographic order compares x/y/z/w; angle order compares distance from identity
or the factory's canonical reference. Invalid unsafe rotations sort after valid
ones and compare raw components with `-Infinity < finite < Infinity < NaN`;
signed zeros agree and NaN is reflexive. Invalid references return None.

Default text is `Quat(x, y, z, w)` with complete numeric fields. The parser
rejects nonfinite/zero rotations, malformed fields and trailing numeric text.
Full-precision JSON includes `_id: "Quat"`. The core and packed consumers run
without Node, Web or Bedrock runtime imports. `verify:quat` runs the pure
build/typechecks, full package lint, and all package tests. The existing full CLI
build's six upstream `QueuingStrategy` errors remain reported separately.
Advanced Quat operations and the bidirectional degree-based Rotator conversions
are described below.

## Quat interpolation and decomposition

All operations below return `Option`, support the direct/curried forms shown in
their signatures, produce frozen values, and leave inputs unchanged. Parameters
are finite and unclamped. Invalid input rotations, undefined intermediate geometry
or unrepresentable numerical results yield None.

```ts
import { Quat as Q, Vector3 as V } from "bedform";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const end = Option.getOrThrow(Q.fromAxisAngle(V.UnitY, Math.PI / 2));
const midpoint = Option.getOrThrow(pipe(Q.Identity, Q.slerp(end, 0.5)));
const fullTurnMidpoint = Option.getOrThrow(Q.slerpFullPath(Q.Identity, Q.negate(Q.Identity), 0.5));
const startControl = Option.getOrThrow(Q.calculateTangent(Q.Identity, Q.Identity, end));
const endControl = Option.getOrThrow(Q.calculateTangent(end, Q.Identity, end));
const spline = Q.squad(Q.Identity, startControl, end, endControl, 0.5);
const logarithm = Option.getOrThrow(Q.log(end));
const reconstructed = Q.exp(logarithm);
const parts = Option.getOrThrow(Q.toSwingTwist(Q.scale(end, 2), V.UnitY));
const rawProduct = Q.multiply(parts.swing, parts.twist); // Reconstructs the scaled input.
const twistRadians = Q.twistAngle(end, V.UnitY);
```

| Operation | Contract |
| --- | --- |
| `fastLerp(a,b,t)` | Shortest-path component lerp, aligning b to a; output is unnormalized and retains endpoint magnitudes. |
| `fastBilerp(q00,q10,q01,q11,u,v)` | Fast lerp along each horizontal row, then vertically between rows. Curried form supplies the last five arguments before q00. Degenerate intermediate rotations yield None. |
| `slerp(a,b,t)` | Normalizes input rotations and samples the shortest unit arc. Positive input scale does not affect the path. |
| `slerpFullPath(a,b,t)` | Normalizes input magnitudes but honors endpoint signs and the full signed arc. |
| `slerpUnnormalized(a,b,t)` / `slerpFullPathUnnormalized(a,b,t)` | Apply spherical weights to raw endpoint components with the corresponding sign policy; no input/output magnitude normalization. Unit directions determine the weights. |
| `squad(a,startControl,b,endControl,t)` / `squadFullPath(...)` | Unit squad with shortest or full-path spherical sampling throughout. Curried form supplies controls, end and t before a. |
| `calculateTangent(current,previous,next,tension?)` | Unit squad control; default tension 0, finite values unclamped. Both `(previous,next)(current)` and `(previous,next,tension)(current)` are supported. Tension 1 returns the current unit key. |
| `log(q)` / `exp(logarithm)` | Sign-preserving unit-rotation logarithm and pure-imaginary rotation exponential. |
| `toSwingTwist(q,axis)` | A frozen `{ swing, twist }`: twist is unit and axis-aligned; swing retains q's raw magnitude, and `q = swing * twist`. |
| `twistAngle(q,axis)` | Principal signed axis twist in radians, in `[-pi,pi)`; q and -q give the same angle. |
| `errorAutoNormalize(a,b)` | Alias of `error`, which already normalizes both rotations before normalized dot-error comparison. |

Three-argument interpolators support `operation(b,t)(a)`. Decomposition and twist
angle use `operation(axis)(q)`. Canonical equality keys never participate in path
selection: q and -q compare equal, but their full-path midpoint is a half-turn,
while their shortest-path midpoint retains the starting orientation.

Parallel directions avoid division by zero. Exact full-path antipodes use a
perpendicular formed by projecting the least-aligned positive coordinate axis in
four-dimensional quaternion space (tie order X, Y, Z, W). Thus Identity to negative
Identity travels through quaternion `(1,0,0,0)` at t=0.5. Near-antipodal inputs keep
their actual great-circle plane. Tiny and huge finite values use stable
normalization and scaled/cancellation-aware arithmetic.

Unnormalized spherical variants retain the raw spherical-weight blend; they are
not a unit sampler multiplied by a linearly blended length. Parallel limits use
component lerp. At exact full antipodes, where spherical weights have no unique
limit, the deterministic great circle uses linearly interpolated magnitude.
Unnormalized fast/spherical results can be raw zero quaternions under extrapolation;
normalizing those values returns None. The normalized spherical and squad variants
always return unit rotations on success.

`calculateTangent` aligns neighboring signs to the current key and uses the
standard logarithmic control `current * exp(-(1-tension)/4 * (log(relativePrevious)
+ log(relativeNext)))`. Adjacent shortest-path squad segments with shared controls
have matching angular velocity; no renderer clock or physics integration is added.

The rotation logarithm normalizes magnitude without canonicalizing sign. Its vector
is the axis times quaternion half-angle, with magnitude in `[0,pi]`, and w=0.
Identity maps to the raw zero logarithm; negative Identity maps to positive X times
pi. `exp` accepts finite pure-imaginary inputs (w must equal zero), including the
zero logarithm, and returns a unit rotation using sine/cosine of the vector length.
It is a rotation exponential, rather than an exponential of a general quaternion
with a nonzero scalar part. `exp(log(q))` reconstructs q's normalized path sign,
within floating-point precision.

Swing/twist normalizes a nonzero finite requested axis. A perpendicular half-turn
has no unique twist; this implementation selects identity twist and leaves the
whole raw rotation in swing. Its twist angle is zero. Other half-turn twist angles
use -pi at the principal range boundary. Tiny signed twist angles are preserved.
An unrepresentable raw swing factor yields None; `twistAngle` queries the unit twist
independently. Neither operation changes the existing canonical Equal/Hash/orders.

The executable Quat operation inventory includes every core and advanced
family. `verify:quat` covers analytic endpoints/extrapolation, path signs,
parallel/antipodal boundaries, normalized/raw output promises, squad continuity,
log/exp and swing/twist reconstruction, Option failures, declaration inference,
required-peer packed consumers and restricted-host execution. The known full CLI
`QueuingStrategy` declaration errors remain a separate baseline limitation.

## Minecraft Rotator angles

`Rotator` is a pure root namespace and `bedform/Rotator` entrypoint. Values retain
readonly raw `pitch`, `yaw`, and `roll` in degrees, including winding. `EulerAngle`
is exactly an empty interface extending `Rotator` inside that module: it adds no
runtime value, root namespace, or package subpath. Validating `Rotator(pitch,yaw,roll)`
returns Option for finite components; zero is valid. `RotatorUnsafe` copies raw
values without validation. Both construct frozen shared-prototype values.

```ts
import { Rotator as R, Quat as Q, Vector3 as V } from "bedform";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const angles = Option.getOrThrow(R.Rotator(30, 40, 50));
const quaternion = Option.getOrThrow(R.toQuat(angles));
const recovered = Option.getOrThrow(Q.toRotator(quaternion));
const eulerVector = R.toEuler(angles); // x=pitch, y=yaw, z=roll, in degrees.
const changed = pipe(angles, R.setAxis(R.Axis.Roll, 90));
const componentSum = R.add(angles, changed); // Raw angle addition.
const composition = R.compose(angles, changed); // changed acts before angles.
const pole = Option.getOrThrow(R.principal(R.RotatorUnsafe(90, 30, 20))); // (90,50,0)
const midpoint = R.slerp(R.RotatorUnsafe(0, 170, 0), R.RotatorUnsafe(0, -170, 0), 0.5);
const forward = R.forward(angles);
const encodedYaw = R.compressAxisToByte(angles.yaw);
```

| Family | Exports |
| --- | --- |
| Construction/guards | `Rotator`, `RotatorUnsafe`, `isRotator`, `isFinite`, `isZero`, `isNearlyZero`, `isNormalized`, `isIdentity`, `Zero`, `Identity`. |
| Raw angle utilities | `add`, `subtract`, `scale`, `negate`, `Axis`, `getAxis`, `setAxis`, `manhattanDistance`, `gridSnap`. |
| Angle representation | `wrapAxis` / `clampAxis`, `normalizeAxis`, `wrap` / `clamp`, `normalize`, `principal`, `windingAndRemainder`, `equivalent`, `closest`. |
| Unsigned encoding | `compressAxisToByte`, `decompressAxisFromByte`, `compressAxisToShort`, `decompressAxisFromShort`. |
| Orientation operations | `compose` / `multiply`, `inverse`, `slerp`, `rotateVector`, `unrotateVector`, `angularDistance`, `equalsApprox`. |
| Conversion/directions | `toQuat`, `fromQuat`, `toEuler`, `fromEuler`, `axisX`, `axisY`, `axisZ`, `forward`, `up`, `right`, `axes`. |
| Protocols/text/orders | `canonicalKey`, `equals`, `equalsComponents`, `hashComponents`, `format` / `toString`, `fromString` / `parse`, `OrderLexicographic`, `OrderAngleDistance`, `orderByAngleDistance`. |

Minecraft coordinates are X-east, Y-up, Z-south. Neutral forward/up/facing-right
are +Z/+Y/-X. Positive yaw turns toward -X, positive pitch looks down, and positive
roll is clockwise looking forward. Intrinsic yaw, pitch, roll converts through
`qY(-yaw) * qX(pitch) * qZ(roll)`. `Quat.fromRotator` / `toRotator` and
`Rotator.toQuat` / `fromQuat` are bidirectional public entrypoints.
`Quat.fromEuler` / `toEuler` and `Rotator.fromEuler` / `toEuler` use
`Vector3 { x: pitch, y: yaw, z: roll }`, in degrees. Rotator-to-vector mapping is raw
component copying; Quat-to-Euler mapping returns principal angles.

`principal` and Quat extraction choose pitch in `[-90,90]` and yaw/roll in
`[-180,180)`. At pitch poles, roll is zero and yaw absorbs the remaining rotation:
`(90,yaw,roll)` becomes `(90,yaw+roll,0)`, while negative pitch uses `yaw-roll`.
The numerical pole threshold is cosine-pitch <= `1e-12`. Coupled half-angle formulas
preserve the combined rotation near poles. Euler coordinates retain representational
singularities; quaternion composition/interpolation does not remove those singularities.
Shared conversion and value-construction modules avoid runtime import cycles.

Component `normalize` reduces each angle independently to `[-180,180)`; it does not
select a principal Euler representation. `wrap` / `clamp` use `[0,360)` instead.
Scalar angle reducers support direct calls, empty-argument currying and piping.
Nonfinite raw reducer inputs produce NaN. Tiny negative finite signed angles are
preserved by `normalizeAxis`; signed zeros collapse in reductions. `isZero` tests
component zero modulo 360, while `isIdentity` tests canonical orientation equality
and includes equivalent representations such as `(180,180,180)`. `isNearlyZero`
requires an explicit finite nonnegative component tolerance in degrees.

`windingAndRemainder` returns a frozen record of complete-turn `winding` and signed
`remainder`, both Rotators. It returns None for nonfinite inputs or when complete
turns cannot be represented and exactly recombined at the input's floating-point
magnitude. `equivalent` returns the alternate normalized representation derived
from `(180-pitch,yaw+180,roll+180)`. `closest(value,reference)` selects winding near
the reference from principal and alternate representations, minimizing raw degree
Manhattan distance; ties favor the principal candidate, with negative half-turn
winding ties. Unrepresentable candidates that fail `1e-9` radian orientation
agreement are rejected; the operation yields None when neither candidate remains.

`getAxis` / `setAxis` use `Axis.Pitch`, `Axis.Yaw`, or `Axis.Roll`. Binary operations
support `operation(a,b)` and `operation(b)(a)`; axis updates use
`setAxis(axis,value)(angles)`. `gridSnap` takes uniform or per-axis degree spacing;
spacings must be finite and nonnegative, and zero disables that axis. Rounding uses
native nearest-integer ties toward positive infinity. `manhattanDistance` and
component arithmetic retain raw angle semantics, including ordinary overflow.

Byte/short compression wraps finite degrees to `[0,360)`, rounds to the nearest
of 256/65536 codes, and wraps the last rounding boundary to zero. Decoding requires
an integer in `0..255` / `0..65535` and yields degrees in `[0,360)`. Both directions
return Option and support direct, curried and piped scalar forms.

`compose` / `multiply` apply the second orientation before the first; component
`add` remains addition. `inverse` is quaternion-based and generally differs from
component `negate`. `slerp` follows the shortest quaternion arc with unclamped t,
then returns principal degree angles. `angularDistance` and explicit
`equalsApprox` tolerances use degrees; these differ from Quat's radian units.
Partial orientation operations reject nonfinite angles, invalid quaternions/vectors,
or unrepresentable results with None.

Protocols share Quat's canonical normalization/sign/12-decimal key policy,
after reducing complete angle turns. Raw stored fields, JSON and default
`Rotator(pitch, yaw, roll)` text retain full precision and winding. Exact raw
helpers use Effect NaN and signed-zero semantics; fuzzy comparisons are separate.
Kinds remain distinct, so Rotator identity does not equal Quat identity.
Lexicographic order uses principal pitch/yaw/roll decoded from the canonical key,
with quaternion-key ties. Angle orders use canonical identity/reference distance
and lexicographic ties. Invalid raw angles sort after valid rotations with the
same `-Infinity < finite < Infinity < NaN` fallback policy. Reference factories
snapshot their valid canonical orientation, or return None when invalid.

`verify:rotator` runs the ES2022 pure build/typechecks, tool checks, full package
lint and all tests, including import-order isolation, public alias/overload fixtures,
compiled README examples, and clean required-peer restricted-host consumers. The
full CLI build's six known upstream `QueuingStrategy` errors remain separate;
compiler checks are unchanged. No live world or client validation is claimed.

## Rigid poses with Transform

`bedform/Transform` (also `Transform` from the root) stores a position in blocks
and a quaternion orientation, with no scale or motion. `Transform(position,
rotation)` returns `Option<Transform>`, rejects nonfinite positions and zero or
nonfinite orientations, and stably normalizes valid orientations. It copies and
freezes both nested values. `TransformUnsafe` copies and freezes raw components
without normalization; mathematical operations validate the pose and normalize
the rotation interpretation. Caller-owned objects remain unchanged and unfrozen.

```ts
import { Transform as T, Quat as Q, Vector3 as V } from "bedform";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const parent = Option.getOrThrow(T.Transform({ x: 10, y: 0, z: 0 },
    Option.getOrThrow(Q.fromEuler({ x: 0, y: 90, z: 0 }))));
const local = Option.getOrThrow(T.Transform({ x: 0, y: 0, z: 2 }, Q.Identity));
const world = Option.getOrThrow(pipe(parent, T.compose(local)));
// The local offset rotates with parent: world.position is approximately (8, 0, 0).
const point = Option.getOrThrow(T.transformPoint(world, V.One));
const original = Option.getOrThrow(T.untransformPoint(world, point));
const matrix = Option.getOrThrow(T.toMatrix(world));
const restored = Option.getOrThrow(T.fromMatrix(matrix));
const halfway = Option.getOrThrow(T.interpolate(parent, world, 0.5));
void [original, restored, halfway];
```

| API | Behavior |
| --- | --- |
| `Transform`, `TransformUnsafe`, `Identity` | Validated/raw deeply frozen construction and zero-translation identity. |
| `isTransform`, `isValid` | Enriched-kind guard and mathematical-domain test for structural inputs. |
| `compose(a, b)` | Applies `b` before `a`: translated position `a.position + rotate(a.rotation, b.position)` and Hamilton orientation `a.rotation * b.rotation`. |
| `inverse` | Inverts translation and rotation together. |
| `transformPoint`, `untransformPoint` | Map points between local and containing frames, including translation. |
| `transformDirection`, `untransformDirection` | Rotate directions without translation or changing their magnitude. |
| `toMatrix`, `fromMatrix` | Readonly row-major homogeneous matrices acting on column vectors; translation occupies indices 3, 7 and 11. |
| `interpolate`, `lerp` | Componentwise position lerp and shortest-path quaternion slerp, with finite unclamped `t`. |
| `equals` | Exact stored position plus Quat's canonical orientation equality. |
| `format`, `toString`, `fromString`, `parse` | Full-precision `Transform(px, py, pz, qx, qy, qz, qw)` text and strict finite parsing. |

Binary and receiver-plus-argument operations support direct and curried calls:
`pipe(a, T.compose(b))` means `T.compose(a, b)`. For an existing world pose `a`,
`compose(a, delta)` applies a local delta, while `compose(delta, a)` applies a
containing-frame delta, rotating the existing position around that frame's origin.
Neither component addition nor scalar multiplication substitutes for composition.

Geometric operations, matrix conversions and interpolation return `Option`;
invalid unsafe inputs and unrepresentable intermediate/output coordinates yield
`None`. Directions also reject invalid pose positions even though translation is
unused. `fromMatrix` rejects scale, reflection, shear, perspective and invalid
homogeneous terms, using Quat's absolute `1e-10` numerical tolerance for
basis/homogeneous validation. It never extracts a rigid approximation from a
scaled matrix. Position interpolation avoids avoidable intermediate overflow,
including a finite midpoint between opposite extreme coordinates. Mathematical
pose interpolation leaves the renderer's separately specified quaternion
normalized-lerp policy unchanged.

Equal/Hash, Pipeable and Inspectable use shared frozen protocols. Position
comparison uses Effect number semantics (NaN agrees with NaN; signed zeros agree),
and orientation uses Quat's canonical key and raw invalid fallback. The
Transform discriminator keeps other spatial kinds distinct. JSON retains full
stored precision with nested Vector3/Quat discriminators; no canonical
rounding alters stored values. Parsing preserves finite raw orientation magnitude
for unsafe text round trips while rejecting zero/nonfinite orientation.

`verify:transform` runs pure/tool typechecks, the pure build, full package lint
and all tests, including operation coverage, declaration inference, README
examples and clean packed-consumer/restricted-host checks. Full-source CLI checks
remain separate from pure math validation.

## Origin-based motion with RigidTransform

`bedform/RigidTransform` (also `RigidTransform` from the root) extends the
Transform interface with `linearVelocity` and `angularVelocity`, both immutable
Vector3 values expressed in the containing frame. That frame is world space for
a standalone physics pose. Linear velocity belongs to the transform origin and
uses blocks/second; angular velocity uses radians/second. There is no scale or
COM field. A physics solver that stores COM velocity converts it explicitly:

```ts
import { RigidTransform as R, Quat as Q, Vector3 as V } from "bedform";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const origin = V.Zero;
const centerOfMass = V.UnitX;
const angularVelocity = { x: 0, y: 0, z: 2 };
const velocityAtCOM = { x: 3, y: 4, z: 5 };
const velocityAtOrigin = V.add(velocityAtCOM,
    V.cross(angularVelocity, V.subtract(origin, centerOfMass)));
const moving = Option.getOrThrow(R.RigidTransform(origin, Q.Identity,
    velocityAtOrigin, angularVelocity));
// Origin velocity is (3, 2, 5); querying COM recovers (3, 4, 5).
const recovered = Option.getOrThrow(pipe(moving, R.velocityAtPoint(centerOfMass)));
const pose = Option.getOrThrow(R.toTransform(moving));
const inverse = Option.getOrThrow(R.inverse(moving));
const identityMotion = Option.getOrThrow(pipe(moving, R.compose(inverse)));
void [recovered, pose, identityMotion];
```

| API | Behavior |
| --- | --- |
| `RigidTransform(position, rotation, linearVelocity, angularVelocity)` | Validates finite coordinates/velocities and normalizes a finite nonzero quaternion; returns Option. |
| `RigidTransformUnsafe`, `Identity` | Raw copied/frozen construction and zero-motion identity. |
| `fromTransform`, `toTransform` | Add explicitly origin-based velocities to a pose, or extract a normalized pose; both return Option and copy nested values. |
| `isRigidTransform`, `isValid` | Enriched-kind guard and full mathematical-domain test. |
| `compose(a, b)` | Applies `b` before `a`, transporting both velocities into the containing frame. |
| `inverse` | Inverts pose and motion consistently, including origin-offset velocity. |
| `velocityAtPoint` | Containing-frame velocity at a containing-frame point, in blocks/second. |
| `interpolate`, `lerp` | Transform pose interpolation plus independent componentwise velocity lerps; finite `t` permits extrapolation. |
| `equals` | Exact stored position/velocities and canonical Quat orientation. |
| `format`, `toString`, `fromString`, `parse` | Full-precision text and strict finite parsing with preserved raw orientation magnitude. |

For `compose(a, b)`, `b` and its velocities are expressed in `a`'s frame. Let
`r = rotate(a.rotation, b.position)`. The output velocities are
`a.linearVelocity + cross(a.angularVelocity, r) + rotate(a.rotation, b.linearVelocity)`
and `a.angularVelocity + rotate(a.rotation, b.angularVelocity)`. The cross term
accounts for the child origin moving with the rotating parent frame. For inverse
rotation `Rinv`, inverse angular velocity is `-rotate(Rinv, angularVelocity)` and
inverse linear velocity is `rotate(Rinv, cross(angularVelocity, position) - linearVelocity)`.
Simply negating linear velocity does not invert a moving offset frame.

`velocityAtPoint(motion, point)` computes
`linearVelocity + cross(angularVelocity, point - position)`. The explicit COM
conversions are `vOrigin = vCOM + cross(angularVelocity, origin - COM)` and
`vCOM = vOrigin + cross(angularVelocity, COM - origin)`. Rotation does not rotate
these vectors again when querying a containing-frame point.

Receiver-plus-argument operations support both call styles without reversing
operands. `pipe(pose, R.fromTransform(v, omega))` constructs motion, and
`pipe(a, R.compose(b))` applies `b` before `a`. Mathematical operations return
Option and reject invalid unsafe inputs or unrepresentable intermediate/output
coordinates. Pose extraction also validates both velocities. Interpolation
validates both endpoints even at `t=0` or `t=1`; it does not advance the pose using
velocity or introduce a dynamics integrator. The renderer's pose-only interpolation
contract remains unchanged.

Values copy and deeply freeze position, orientation and both velocity vectors,
with shared piping/inspection/protocol functions. Unsafe construction preserves
raw components; geometric operations normalize only their rotation interpretation.
Protocols distinguish a RigidTransform from a pose-only Transform in both equality
directions, including zero motion; the value still satisfies the Transform type
and `T.isTransform`. Position/velocity comparison uses exact Effect number
semantics, while orientation uses Quat's canonical key and invalid fallback.
JSON retains all stored precision and nested discriminators. Default text is
`RigidTransform(px, py, pz, qx, qy, qz, qw, vx, vy, vz, wx, wy, wz)`.

`verify:rigid-transform` runs pure/tool typechecks, pure build, package lint and
all tests, including analytic and finite-difference velocity checks, COM/origin
conversion fixtures, public declarations, README examples and clean packed
restricted-host consumers. The known upstream full-source typecheck limitation
is reported separately.

## Unit-direction forward rays

`bedform/Ray` (also `Ray` from the root) stores a finite origin and unit direction.
`Ray(origin, direction)` returns Option, copies the inputs and stably normalizes
any finite nonzero direction, including very large and very small directions.
Parameters and distances are in blocks, starting at zero and extending forward.
`RayUnsafe` copies and freezes raw coordinates without changing direction length;
queries reject a nonunit unsafe ray rather than silently changing distance units.

```ts
import { Ray as R, Transform as T, Quat as Q, Vector3 as V } from "bedform";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const ray = Option.getOrThrow(R.Ray(V.Zero, { x: 0, y: 0, z: 10 }));
const point = Option.getOrThrow(pipe(ray, R.at(5))); // (0, 0, 5), five blocks away
const closest = Option.getOrThrow(R.closestPoint(ray, { x: 3, y: 4, z: -2 }));
// The target is behind the forward ray, so closest is the origin.
const distance = Option.getOrThrow(R.distanceToPoint(ray, { x: 3, y: 4, z: 5 })); // 5
const pose = Option.getOrThrow(T.Transform({ x: 10, y: 0, z: 0 },
    Option.getOrThrow(Q.fromEuler({ x: 0, y: 90, z: 0 }))));
const worldRay = Option.getOrThrow(pipe(ray, R.transform(pose)));
const worldPoint = Option.getOrThrow(R.at(worldRay, 5)); // approximately (5, 0, 0)
const futureShapeHit: Option.Option<R.Hit> = Option.none();
void [point, closest, distance, worldPoint, futureShapeHit];
```

| API | Behavior |
| --- | --- |
| `Ray`, `RayUnsafe` | Validated unit-direction or raw deeply copied/frozen construction. |
| `isRay`, `isValid` | Enriched-kind guard and finite/unit domain check for structural inputs. |
| `at(ray, distance)` | Evaluates `origin + distance * direction` for finite nonnegative block distance. |
| `closestParameter`, `closestPoint` | Forward-ray projection, clamped to the origin for points behind it. |
| `distanceToPoint` | Euclidean distance in blocks from a point to the forward ray. |
| `transform(ray, pose)` | Rigidly maps origin as a point and direction as a vector into the containing frame. |
| `equals` | Exact stored origin/direction comparison, without geometric tolerances or normalization. |
| `format`, `toString`, `fromString`, `parse` | Full-precision `Ray(ox, oy, oz, dx, dy, dz)` text and strict valid unit-ray parsing. |
| `Hit` | Shared readonly shape result: distance, enriched point and `Option<Vector3>` normal. |

All receiver-plus-argument operations support direct and curried calls with the
same operand order. Queries and rigid transformation return Option: invalid
inputs, negative/nonfinite evaluation parameters or unrepresentable positive
parameters/coordinates/distances yield None. Projection scales intermediate
differences to avoid avoidable overflow and retain subnormal coordinates. A
behind-origin target still has closest parameter zero when its raw coordinate
difference overflows. Results are copied frozen values; callers are not mutated.

Unit validation allows eight machine epsilons of length error solely for
floating-point normalization roundoff. This fixed numerical allowance does not
repair nonunit inputs, change stored direction or introduce fuzzy equality.
Rigid transformation first validates the input ray, then normalizes the rotated
direction to remove accumulated rotation roundoff. It accepts the existing
Transform interpretation of nonunit finite nonzero quaternion orientations.
Evaluation commutes with rigid transformation, up to floating-point precision,
and transformed rays retain block-distance parameters.

Equal/Hash use exact raw stored coordinates with Effect NaN and signed-zero
semantics, even for unsafe invalid values. Ray's discriminator keeps other
spatial kinds distinct. Shared frozen protocols provide piping and custom
inspection. JSON preserves raw component precision with nested Vector3
discriminators. Parsing valid unit-ray text preserves stored direction components
exactly; it rejects nonunit unsafe text instead of normalizing it.

`Ray.Hit` provides the shared contract for future shape intersections. Shapes
own Plane/AABB/OBB/ConvexHull intersections; Ray imports no shape modules. A hit's
distance starts at zero in blocks, its point and normal use the containing frame,
and a nonunique normal is represented by None. The shape implementation owns
copying/freezing the result and its nested values. Inside-origin solid hits have
distance zero. This milestone adds the shared type and foundational ray queries;
shape intersections remain in their own planned milestones.

`verify:ray` runs pure/tool typechecks, the pure build, full package lint and all
tests, including extreme normalization/projection cases, forward-domain checks,
rigid covariance and inverse round trips, protocol/hash collections, public
declarations, README examples and packed restricted-host consumers.

## Oriented planes and half-spaces

`bedform/Plane` (also `Plane` from the root) stores a unit normal and signed
offset with equation `dot(normal, point) + offset = 0`. Negative signed distance
is the interior half-space. `Plane(normal, offset)` returns Option and divides
both coefficients by the same positive normal length, preserving normal sign.
Stable normalization supports extreme finite magnitudes even when the unscaled
normal length would overflow. Zero/nonfinite normals, nonfinite offsets and
unrepresentable normalized offsets are rejected. `PlaneUnsafe` copies/freezes
raw coefficients without validation; queries reject nonunit unsafe planes.

```ts
import { Plane as P, Ray as R, Vector3 as V } from "bedform";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const floor = Option.getOrThrow(P.Plane({ x: 0, y: 2, z: 0 }, -4)); // y=2, interior y<=2
const distance = Option.getOrThrow(P.signedDistance(floor, { x: 3, y: 5, z: 4 })); // 3
const projected = Option.getOrThrow(pipe(floor, P.projectPoint({ x: 3, y: 5, z: 4 })));
const ray = Option.getOrThrow(R.Ray({ x: 3, y: 5, z: 4 }, V.Down));
const hit = Option.getOrThrow(pipe(floor, P.intersectRay(ray))); // distance 3, point (3,2,4)
const wall = Option.getOrThrow(P.Plane(V.UnitX, -1));
const line = Option.getOrThrow(P.intersectPlane(floor, wall)); // infinite line through (1,2,0)
const exactOutside = Option.getOrThrow(P.contains(floor, { x: 0, y: 2.001, z: 0 },
    { absoluteTolerance: 0, relativeTolerance: 0 })); // false
void [distance, projected, hit, line, exactOutside];
```

| API | Behavior |
| --- | --- |
| `Plane`, `PlaneUnsafe` | Validated normalized or raw deeply copied/frozen coefficients. |
| `fromPointNormal` | Constructs through a finite point with a finite nonzero normal. |
| `fromPoints` | Uses `cross(second-first, third-first)` orientation; duplicate/collinear inputs return None. |
| `isPlane`, `isValid` | Enriched-kind guard and finite/unit-domain test. |
| `signedDistance`, `projectPoint` | Signed block distance and orthogonal point projection. |
| `Side`, `classify`, `contains` | Inside/Boundary/Outside classification and closed negative-half-space membership. |
| `flip` | Reverses normal and offset together, swapping interior/exterior. |
| `transform` | Rigidly rotates normal and updates offset by subtracting the rotated normal's dot with translation. |
| `intersectPlane` | Unique infinite `Plane.Line` with enriched point/direction, or None for parallel/coincident inputs. |
| `intersectRay` | Optional forward `Ray.Hit` on the plane surface, with the plane's oriented normal. |
| `equals` | Exact stored coefficients, without scaling equivalence or fuzzy tolerances. |
| `format`, `toString`, `fromString`, `parse` | Full-precision `Plane(nx, ny, nz, offset)` text and valid-unit-plane parsing. |

Receiver-plus-argument operations support direct and curried calls, preserving
operand order. For example, `pipe(plane, P.classify(point, options))` and
`P.classify(plane, point, options)` agree. `fromPoints` also supports
`pipe(first, P.fromPoints(second, third))`. Partial mathematical operations return
Option. Invalid geometry/options and unrepresentable results return None; valid
outside-half-space containment returns Some(false).

`QueryOptions` exposes finite nonnegative `absoluteTolerance` and
`relativeTolerance`, defaulting to `1e-9` each. For classification and ray-origin
boundary contact, the block-distance threshold is
`absoluteTolerance + relativeTolerance * equationScale`, where equationScale is
the largest absolute individual normal-coordinate product or offset. This
accounts for scale and cancellation in the plane equation. Classification stays
scaled, so finite inputs can still produce a valid half-space answer even when
the signed distance exceeds numeric range. For angular
parallelism, the dimensionless threshold uses scale one: compare the normals'
cross-product length, or the normal/ray-direction dot magnitude, against
`absoluteTolerance + relativeTolerance`. Set both tolerances to zero for strict
representable comparisons. Options never alter stored coefficients or protocol
equality. Unit-domain validation separately allows eight machine epsilons of
normal-length roundoff; it does not normalize unsafe input during queries.

The intersection line extends in both directions and is distinct from a Ray.
Its point is closest to the origin; the first nonzero coordinate of its unit
direction is positive, with signed zeros collapsed. Parallel and coincident
planes have no unique line and return None. Near-parallel planes within tolerance
also return None. Ray intersections test the plane surface, rather than treating
the negative half-space as a closed solid. Origins on the boundary within
tolerance hit at distance zero, including coplanar rays. Parallel separated rays,
behind-origin hits and invalid nonunit rays return None. Every plane hit has
Some(normal), including coplanar hits, because the oriented plane has a unique
surface normal. Hit distance remains in blocks. Hit/line records and all nested
coordinate values are copied and frozen.

Equal/Hash use exact normal and offset with Effect NaN/signed-zero semantics.
Opposite orientations and unsafe scaled coefficient representations remain
distinct. Shared frozen protocols provide piping/custom inspection; full-precision
JSON retains raw coefficients with nested Vector3 discriminators. Parsing valid
unit-plane text preserves stored coefficients; it rejects nonunit unsafe text.
All operations preserve caller-owned inputs. Compensated scaled sums and
normalized construction edges avoid avoidable overflow in plane equations and
three-point construction.

`verify:plane` runs pure/tool typechecks, the pure build, full package lint and
all tests, including orientation and extreme normalization, projections,
tolerance boundaries, infinite-line and ray degeneracies, rigid covariance,
protocol collections, public declarations, README examples and packed
restricted-host consumers. AABB/OBB/ConvexHull remain separate milestones.

## Axis-aligned bounds with AABB

`bedform/AABB` (also `AABB` from the root) stores finite `min` and `max` Vector3
corners, with `min <= max` componentwise. `AABB(min, max)` returns Option and
copies/freezes both bounds. Zero extents are valid: a box may be a plane, line
or point. Inverted/nonfinite bounds are rejected. `AABBUnsafe` copies/freezes raw
bounds without sorting, repairing or computing derived geometry. Caller-owned
coordinates and point arrays remain unchanged and unfrozen.

```ts
import { AABB as B, Ray as R, Transform as T, Quat as Q, Vector3 as V } from "bedform";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const bounds = Option.getOrThrow(B.AABB(V.Zero, V.One));
const closest = Option.getOrThrow(pipe(bounds, B.closestPoint({ x: -3, y: 5, z: 0.5 })));
const distance = Option.getOrThrow(B.distanceToPoint(bounds, { x: -3, y: 5, z: 0.5 })); // 5
const ray = Option.getOrThrow(R.Ray({ x: -2, y: 0.5, z: 0.5 }, V.UnitX));
const hit = Option.getOrThrow(pipe(bounds, B.intersectRay(ray))); // distance 2, outward normal -X
const frame = Option.getOrThrow(T.Transform({ x: 10, y: 0, z: 0 },
    Option.getOrThrow(Q.fromEuler({ x: 0, y: 45, z: 0 }))));
const enclosing = Option.getOrThrow(B.transform(bounds, frame));
// Enclosing contains every transformed corner of the rotated box.
const contracted = Option.getOrThrow(B.expand(bounds, -0.5)); // valid point box at (0.5,0.5,0.5)
void [closest, distance, hit, enclosing, contracted];
```

| API | Behavior |
| --- | --- |
| `AABB`, `AABBUnsafe`, `isAABB`, `isValid` | Validated/raw copied bounds, kind guard and finite ordered-bound domain check. |
| `fromPoints` | Smallest enclosure of a nonempty finite point array; duplicates are allowed. |
| `fromCenterHalfExtents` | Finite center plus nonnegative componentwise half extents. |
| `center`, `size`, `halfExtents` | Stable center/half extents; unrepresentable full size returns None. |
| `corners`, `Corners` | Frozen eight-element tuple in binary xyz order: x changes fastest, then y, then z. |
| `containsPoint`, `contains`, `containsBox` | Closed point/box containment; `contains` aliases `containsPoint`. |
| `overlaps` | Static overlap, including touching faces/edges/corners and lower-dimensional cases. |
| `union`, `intersection` | Exact smallest enclosing union or exact intersection; empty intersection is None. |
| `expand` | Finite uniform/per-axis expansion; negative amounts contract. Inversion/overflow is rejected. |
| `closestPoint`, `distanceToPoint` | Closest point in the closed solid and block distance; interior distance is zero. |
| `supportPoint` | Maximizes the direction dot product; zero direction coordinates deterministically choose min. |
| `transform` | Enclosing AABB of all eight rigidly transformed corners. |
| `intersectRay` | First forward unit-ray slab hit, or None for a miss/invalid input. |
| `equals`, `format`, `toString`, `fromString`, `parse` | Exact stored-bound comparison and full-precision `AABB(minx,miny,minz,maxx,maxy,maxz)` serialization. |

Receiver-plus-argument operations support direct and data-last calls preserving
operand order. Mathematical operations return Option. Valid outside/disjoint
predicates return Some(false); invalid unsafe geometry, invalid options and
unrepresentable numeric outputs return None. Point construction rejects empty,
sparse or nonfinite point arrays. The center and half extents remain available
for finite bounds spanning opposite numeric extremes, even when full size is
unrepresentable. Corners retain repeated coordinates for zero extents.

`QueryOptions` contains finite nonnegative absolute/relative tolerances, each
defaulting to `1e-9`. Each scalar coordinate comparison permits a gap of
`absoluteTolerance + relativeTolerance * max(abs(a), abs(b))`; scaled comparison
avoids subtraction overflow. Closed contact counts as containment/overlap. Set
both values to zero for strict comparisons. Options never modify stored bounds,
protocol equality, exact intersection/union/expansion or nearest/support points.
Consequently `overlaps(a,b)` may accept tolerance contact while exact
`intersection(a,b)` remains None for a positive gap.

Ray intersection uses slab intervals and treats only exactly zero direction
coordinates as parallel, preserving legitimate nearly parallel rays. Inside
origins hit at distance zero. A unique boundary face yields Some(outwardNormal);
strict interior, edge/corner ties and opposing degenerate faces yield None for
the normal. Origins within contact tolerance count as boundary/inside contact.
Interval comparisons use the same tolerance formula with block-distance
parameters, and the resulting point is checked against coordinate bounds.
Entry ties use those tolerances; boundary-face detection includes all contacting
faces. Misses and invalid nonunit unsafe rays return None. Hit records, optional
normal wrappers and all nested vectors are frozen.

A rigidly rotated box generally ceases to be axis aligned. `transform` explicitly
returns the enclosing AABB of the transformed corners; it does not represent the
rotated solid's exact interior. OBB owns oriented-box queries. Support selection
uses direction signs without computing a potentially overflowing dot product.
No broad-phase tree maintenance or contact-solving scope is introduced.

Equal/Hash use exact raw min/max components with Effect NaN/signed-zero semantics
and an AABB discriminator, including reflexive invalid unsafe values. Shared
frozen protocols provide piping and custom inspection. JSON retains full stored
precision and nested Vector3 discriminators. Parsing accepts only valid finite
ordered bounds and preserves their component precision.

`verify:aabb` runs pure/tool typechecks, the pure build, full package lint and all
tests, including degenerate/extreme bounds, operations and tolerance boundaries,
independent corner/support fixtures, forward ray cases, transformed enclosures,
protocol collections, public declarations, README examples and clean packed
restricted-host consumers. OBB and ConvexHull remain separate milestones.

## Block lattice with Voxel

`bedform/Voxel` (also `Voxel` from the root) addresses whole blocks. A `Voxel` is a
plain frozen `{ x, y, z }` at the block's minimum corner, and each coordinate is an
`@bedform/effect/Unit/Meter` `Meter<Int>`: a branded whole number of meters. A voxel
can therefore be passed anywhere Bedrock expects a `Vector3`, while a plain object of
numbers is rejected where a `Voxel` is expected. `Face` names the six block faces
with the same strings as Bedrock's `Direction`, so `Face.Up`, `Direction.Up` and a
raycast hit's `face` are all accepted.

```ts
import { Voxel as X, Vector3 as V } from "bedform";
import * as Int from "@bedform/effect/Int";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const block = Option.getOrThrow(X.fromPoint({ x: -0.5, y: 64.2, z: 3.9 })); // -1,64,3
const above = X.neighbor(block, X.Face.Up);
const far = pipe(block, X.neighbor(X.Face.East, Int.makeUnsafe(4)));
const ring = X.neighbors(block, 26); // 26 voxels, ordered by y, then z, then x
for (const step of X.traverse(V.Zero, { x: 3.5, y: 1.5, z: 0.5 }))
{
    // step.voxel, entered through Option step.face
}
const middle: V.Vector3 = X.center(above);
const key = X.key(far); // "3,64,3"
```

| Exports | Behavior |
| --- | --- |
| `Voxel`, `VoxelUnsafe`, `isVoxel` | Safe-integer construction without rounding (Option, or a `RangeError`) and a structural guard. |
| `fromPoint` | The voxel containing a point, flooring each coordinate, so −0.5 lies in voxel −1. |
| `Face`, `Faces`, `faceNormal`, `faceAxis`, `opposite`, `fromNormal` | Bedrock-compatible face names and their unit normals, axes and opposites; `fromNormal` accepts a vector with exactly one nonzero finite component. |
| `add`, `subtract`, `neighbor`, `neighbors` | Whole-block moves by partial `Int` offsets or across a face, and the 6-, 18- or 26-connected neighborhood. |
| `box`, `traverse` | Re-iterable inclusive boxes in canonical order and Amanatides–Woo segment walks that yield `{ voxel, face }`. |
| `distanceManhattan`, `distanceChebyshev`, `distance` | `Int` step counts and the Euclidean center distance in meters. |
| `Equivalence`, `equals`, `Order`, `key`, `fromKey` | Coordinate equality, the canonical y-then-z-then-x order, and `"x,y,z"` keys that round-trip exactly. |
| `center`, `bounds` | The center as a `bedform/Vector3` and the block cube as a `bedform/AABB`. |

Results that leave the safe integer range throw `RangeError`. `traverse` visits a
face-connected path from the voxel holding the start to the voxel holding the end;
where the segment passes exactly through an edge or corner it steps x before y
before z, so it also visits a voxel the segment only touches. `verify:voxel` runs the
typechecks, focused lint and `Test/Voxel*.test.mts`, which checks traversal against
dense sampling of random segments.

## Sixteenth-block lattice with Microvoxel

`bedform/Microvoxel` (also `Microvoxel` from the root) addresses 1/16 m cubes, the
precision of a sixteen-pixel block texture. A `Microvoxel` is a plain frozen
`{ x, y, z }` at the cube's minimum corner. Each coordinate is a `Meter` that is a
whole multiple of `Size` (0.0625 m), which binary floating point represents exactly,
so a microvoxel also fits a Bedrock `Vector3`. Inside its block a microvoxel has
`Local` coordinates 0..15 and an `index` 0..4095 (`x + 16 * (z + 16 * y)`); across
the world it has integer `steps`, its coordinates times `Resolution` (16).

```ts
import { Microvoxel as M, Voxel as X } from "bedform";
import * as Int from "@bedform/effect/Int";
import * as Option from "@bedform/effect/Option";

const cell = Option.getOrThrow(M.fromPoint({ x: 2.3, y: 64.01, z: -0.2 })); // 2.25, 64, -0.25
const block: X.Voxel = M.voxel(cell); // 2,64,-1
const local = M.local(cell); // { x: 4, y: 0, z: 12 }
const same = M.fromIndex(block, M.index(cell)); // Option.some(cell)
const right = M.offset(cell, { x: Int.one }); // one 6.25 cm step, not one meter
const up = M.neighbor(cell, X.Face.Up, M.Resolution); // one meter up
let count = 0;
for (const part of M.inVoxel(block))
{
    count += M.index(part) >= 0 ? 1 : 0; // 4096 microvoxels in index order
}
```

| Exports | Behavior |
| --- | --- |
| `Resolution`, `Size`, `PerVoxel` | 16 steps per meter, 0.0625 m, and 4096 microvoxels per block. |
| `Microvoxel`, `MicrovoxelUnsafe`, `isMicrovoxel` | Construction from meters that must already lie on the lattice (Option, or a `RangeError`) and a structural guard. |
| `fromPoint` | The microvoxel containing a point, flooring to the lattice, so −0.01 lies in the microvoxel at −0.0625. |
| `fromVoxel`, `fromVoxelUnsafe`, `fromIndex`, `voxel`, `local`, `index` | Local addressing inside a block; locals outside 0..15 and indices outside 0..4095 are rejected. |
| `steps`, `fromSteps` | Global integer step coordinates. |
| `offset`, `neighbor` | Moves in microvoxel steps by partial `Int` offsets or across a `bedform/Voxel` face. |
| `inVoxel`, `box`, `traverse` | Re-iterable block contents, inclusive boxes in canonical order, and Amanatides–Woo walks yielding `{ microvoxel, face }`. |
| `Equivalence`, `equals`, `Order`, `key`, `fromKey` | Coordinate equality, the canonical y-then-z-then-x order, and step-valued `"x,y,z"` keys. |
| `center`, `bounds` | The center as a `bedform/Vector3` and the cube as a `bedform/AABB`. |

`traverse` is `bedform/Voxel`'s walk at 16 times the scale, with the same guarantees.
Results whose step counts leave the safe integer range throw `RangeError`.
`verify:microvoxel` runs the typechecks, focused lint and `Test/Microvoxel*.test.mts`,
which checks all 4096 local, global and index round trips in several blocks and
traversal against dense sampling of random segments.

## Oriented bounds with OBB

`bedform/OBB` (also `OBB` from the root) stores a finite center, componentwise
nonnegative local half extents and quaternion rotation. `OBB(center, halfExtents,
rotation)` returns Option, copies/freezes all nested values and stably normalizes
a finite nonzero quaternion. Zero extents are valid, including plane/line/point
boxes. `OBBUnsafe` copies/freezes raw fields without repairing extents,
normalizing orientation or computing derived geometry. Geometric operations
normalize finite nonzero unsafe rotations when interpreting them.

```ts
import { OBB as S, AABB as B, Ray as R, Quat as Q, Vector3 as V } from "bedform";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const rotation = Option.getOrThrow(Q.fromEuler({ x: 0, y: 90, z: 0 }));
const box = Option.getOrThrow(S.OBB({ x: 10, y: 0, z: 0 },
    { x: 2, y: 1, z: 0.5 }, rotation));
const world = Option.getOrThrow(S.toWorldPoint(box, { x: 2, y: 0, z: 0.5 })); // (9.5,0,2)
const local = Option.getOrThrow(pipe(box, S.toLocalPoint(world)));
const enclosure = Option.getOrThrow(S.toAABB(box));
const other = Option.getOrThrow(B.AABB({ x: 20, y: 0, z: 0 }, { x: 21, y: 1, z: 1 }));
const overlaps = Option.getOrThrow(pipe(box, S.overlapsAABB(other))); // false
const ray = Option.getOrThrow(R.Ray({ x: 10, y: 0, z: -5 }, V.UnitZ));
const hit = Option.getOrThrow(S.intersectRay(box, ray)); // distance 3, normal approximately -Z
void [local, enclosure, overlaps, hit];
```

| API | Behavior |
| --- | --- |
| `OBB`, `OBBUnsafe`, `isOBB`, `isValid` | Validated/raw copied fields, enriched-kind guard and mathematical domain test. |
| `toWorldPoint`, `toLocalPoint` | Point conversions between local box coordinates and the containing frame. |
| `corners`, `Corners` | Frozen eight-element corner tuple in binary local xyz order, transformed to world/containing coordinates. |
| `containsPoint`, `contains` | Closed point containment; `contains` aliases `containsPoint`. |
| `closestPoint`, `distanceToPoint` | Nearest point in the closed oriented solid and block distance; interior points retain their coordinates and have zero distance. |
| `supportPoint` | Maximizes a containing-frame direction dot product; computed zero local components choose negative extents. |
| `toAABB` | Axis-aligned enclosure of all eight rotated/translated corners. |
| `transform` | Rigidly transforms center and orientation, preserving local half extents and oriented shape. |
| `overlaps`, `overlapsOBB`, `overlapsAABB` | Complete static box overlap; `overlapsOBB` aliases `overlaps`. |
| `intersectRay` | First forward unit-ray hit, mapping unique normals back to the containing frame. |
| `equals`, `format`, `toString`, `fromString`, `parse` | Exact stored center/extents plus canonical orientation equality, and full-precision serialization. |

All receiver-plus-argument operations support direct and curried calls with the
same operand order. Partial operations return Option; invalid inputs/options or
unrepresentable intermediate/output coordinates yield None. Valid outside or
separated queries yield Some(false). Caller-owned inputs remain untouched and
unfrozen. Operations return copied frozen values. Large finite support directions
are normalized before rotation because only their direction signs are needed.

OBB overlap uses the full separating-axis test: three axes from each box and all
nine pairwise edge-cross axes. Only exactly zero cross vectors are skipped;
near-parallel nonzero axes are normalized and tested. This preserves touching and
lower-dimensional cases without using enclosing AABBs as overlap proxies.
AABB overlap projects the original bounds directly, avoiding center/half-extents
rounding that could erase a subnormal-width box. Computation scales finite center
differences before considering absolute centers, preserving tiny separations near
a large shared origin and avoiding subtraction overflow for distant boxes.

`QueryOptions` uses finite nonnegative `absoluteTolerance` and
`relativeTolerance`, defaulting to `1e-9` each. For OBB/OBB projections, contact
permits a gap of `absoluteTolerance + relativeTolerance * max(centerSeparation,
combinedProjectedRadius)`, using absolute projected separation. AABB comparisons
use the corresponding local projected endpoint/radius scale. These scales are
independent of a common world translation. Set both tolerances to zero for strict
representable comparisons. Containment uses the same SAT with a zero-extent
point box. Options never affect stored data, protocol equality, nearest/support
points or returned corner/enclosure geometry.

Ray intersection maps origin and direction into the local box frame, uses the
AABB slab query, and returns the original ray's point at the resulting block
distance. Rotation does not turn that distance into an arbitrary parameter.
Unique outward normals rotate back into the containing frame. Inside origins hit
at zero; strict interior and edge/corner/degenerate-face ties have None for the
normal. Ray contact tolerances use the local AABB coordinate/interval policy.
Invalid nonunit unsafe rays are rejected. Frozen hit wrappers own their copied
optional normals and never freeze Effect's shared None value.

Equal/Hash compare exact stored center/half extents with Effect NaN/signed-zero
semantics, and orientation with Quat's canonical key and invalid fallback.
OBB is a distinct kind from AABB. Alternate half-extents/orientation
parameterizations of the same geometric set are not promised equal. Shared
frozen protocols provide piping and custom inspection. JSON retains raw stored
precision and nested discriminators. Default text is
`OBB(cx,cy,cz,hx,hy,hz,qx,qy,qz,qw)`; parsing validates its domains while preserving
raw quaternion magnitude. `toAABB` provides an enclosure for bounds use, while
oriented queries continue to use the original box.

`verify:obb` runs pure/tool typechecks, pure build, full package lint and all
tests. Fixtures include enclosure false positives, a separator missed by six
face axes, degenerate contact, huge/common-origin and subnormal cases, independent
corner/support projections, ray normals/distances, rigid covariance, protocols,
public declarations, README examples and clean packed restricted-host consumers.
ConvexHull and final integration remain separate milestones.

## Solid convex hulls

`bedform/ConvexHull` (also `ConvexHull` from the root) represents bounded,
full-dimensional convex 3D solids with copied frozen vertices and indexed outward
polygon faces. `ConvexHull(points)` builds a deterministic incremental convex
envelope from a finite point cloud, allowing duplicates and interior points.
Empty, point-only, collinear and coplanar clouds return None. Input sorting and
exact finite-double orientation signs make construction independent of point
order; indices and face ordering are canonicalized deterministically.

```ts
import { ConvexHull as H, AABB as B, Ray as R, Vector3 as V } from "bedform";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const solid = Option.getOrThrow(H.ConvexHull([V.Zero, V.UnitX, V.UnitY, V.UnitZ]));
const volume = Option.getOrThrow(H.volume(solid)); // 1/6 cubic blocks
const center = Option.getOrThrow(H.centroid(solid)); // (0.25,0.25,0.25)
const nearest = Option.getOrThrow(pipe(solid, H.closestPoint(V.One))); // (1/3,1/3,1/3)
const outside = Option.getOrThrow(H.containsPoint(solid, V.One)); // false, despite bounding-box inclusion
const ray = Option.getOrThrow(R.Ray({x: -1, y: 0.1, z: 0.1}, V.UnitX));
const hit = Option.getOrThrow(H.intersectRay(solid, ray)); // distance 1, normal -X
const box = Option.getOrThrow(B.AABB(V.Zero, V.One));
const boxHull = Option.getOrThrow(H.fromAABB(box));
void [volume, center, nearest, outside, hit, boxHull];
```

| API | Behavior |
| --- | --- |
| `ConvexHull(points)` | Deterministic triangulated convex envelope; returns Option of a valid full-dimensional solid. |
| `fromFaces(vertices, faces)` | Validates indexed polygon topology before canonicalizing indices, cycle starts and face order. Preserves winding/tessellation. |
| `ConvexHullUnsafe(vertices, faces?)` | Copies/freezes raw vertices and face arrays without construction, validation or derived calculations. Omitted faces remain empty invalid topology. |
| `isConvexHull`, `isValid` | Enriched-kind guard and complete solid/topology domain test. |
| `edges`, `planes` | Frozen derived edges (ascending indices) and outward unit planes in stored face order. |
| `bounds`, `toAABB` | Enclosing axis-aligned bounds of a valid solid. |
| `fromAABB`, `fromOBB` | Convert full-dimensional boxes, rejecting zero-volume or numerically collapsed corner sets. |
| `volume`, `centroid` | Positive cubic-block volume and volume centroid. Unrepresentable final numeric results return None. |
| `containsPoint`, `contains` | Closed convex-solid containment against every outward half-space. |
| `closestPoint`, `distanceToPoint` | Nearest point/distance to the closed solid, with interior points copied unchanged and distance zero. |
| `supportPoint` | First stored exact dot-product maximizer for a finite direction, including deterministic zero-direction ties. |
| `transform` | Rigidly maps vertices, preserves polygon topology and revalidates the result. |
| `intersectRay` | First forward half-space clipping hit in blocks, with an optional unique outward normal. |
| `overlaps`, `overlapsConvexHull`, `overlapsAABB`, `overlapsOBB` | Complete face-normal/edge-cross separating-axis queries. |
| `equals`, `format`, `toString`, `fromString`, `parse` | Exact stored topology protocols and full-precision indexed text round trips. |

This is a solid-only type. `fromFaces` checks finite unique vertices, integer index
ranges, nondegenerate strictly convex planar polygons, outward supporting faces,
closed oppositely paired edges, connected face and vertex fans, spherical Euler
characteristic and positive conditioned volume. Unused vertices and malformed,
concave, inward or nonmanifold topology are rejected rather than repaired.
Topology decisions use exact BigInt signs decoded from finite IEEE doubles.
Plane/support certification allows only `64 * Number.EPSILON` in conditioned
coordinates for floating-point roundoff, independently of query tolerances. This
allows rigidly transformed polygon faces to retain topology after rounding;
nonplanar or nonconvex deviations beyond that allowance are rejected. If numeric
conditioning cannot produce finite valid planes or positive conditioned mass
data, construction returns None. Exact predicates use standard ES2022 BigInt,
ArrayBuffer and DataView, with no Node, Web or Bedrock runtime dependencies.

A point cloud explicitly requests its convex envelope. Never use that operation
to silently replace a concave physics solid, fill a cavity or approximate an
unsupported mesh. Indexed physics solids must first pass their own provenance
and convex partition validation. Hulls retain indexed topology, not arbitrary
geometric-set identity: alternate tessellations can compare unequal even when
surfaces describe the same set. Physics keeps source/partition metadata alongside
hulls; this math module does not add contact solving, GJK/EPA, continuous collision
detection, concave decomposition or a dynamics integrator.

Receiver-plus-argument operations support direct and data-last calls preserving
operand order. Mathematical operations return Option. Valid outside/separated
queries return Some(false); invalid geometry, point/ray/options or unrepresentable
results return None. Box-to-hull conversion rejects zero volume, while overlap
queries accept valid lower-dimensional boxes directly. Derived data is lazy for
unsafe values and cached only for owned immutable hulls. Mutable structural
inputs are validated on every call. Callers' vertices and nested arrays are never
mutated or frozen. Edges, planes, hits, JSON and their nested coordinate/topology
values are frozen; optional hit-normal wrappers are owned copies.

Closest-boundary queries consider every face triangle and edge, using exact
triangle-region/segment-parameter predicates and exact candidate distance
ordering. This preserves finite nearest coordinates even for extremely distant
queries whose squared distances overflow ordinary doubles. Support comparisons
also use exact finite-coordinate dot products. Mass properties use conditioned
coordinates, compensated sums and binary exponent bookkeeping; volume may be
unrepresentable even though the solid and centroid are valid. None reports final
volume overflow/underflow rather than returning Infinity or zero for a positive
solid. Incremental construction and complete static queries favor deterministic
correctness; they do not introduce a spatial index or broad-phase accelerator.

`QueryOptions` exposes finite nonnegative absolute/relative tolerances, each
`1e-9` by default. Containment compares each signed supporting-plane distance
against absolute tolerance plus relative tolerance times hull/point-offset scale.
SAT projects every vertex onto all face normals and pairwise edge-cross axes,
using exact interval comparisons. Relative SAT scale is the maximum projected
span or corresponding endpoint separation, symmetric between operands and
independent of common translation. Absolute tolerance remains in blocks. This
avoids losing tiny separating gaps beside a box spanning numeric extremes.
Set both tolerances to zero for strict representable comparisons. Options do not
alter stored vertices, topology or protocol equality.

Ray clipping treats only exactly zero plane-direction dot products as parallel;
inside origins hit at distance zero. Strict interior has None for its normal.
Coplanar triangulation faces share one normal; genuine edge/corner ties have
None. Unique normals retain their outward orientation. Ray boundary tolerance
uses hull/distance scale, and interval contact uses block-distance parameter
scale. Invalid nonunit unsafe rays are rejected, rather than renormalized.

Equal/Hash use exact stored vertex components and face indices with Effect
NaN/signed-zero semantics and a distinct hull discriminator. Full-precision JSON
contains vertices and stored faces. Default text is
`ConvexHull([x,y,z];[x,y,z];...|[i,j,k];[i,j,k];...)`; the parser validates a solid
and preserves stored order/tessellation, including valid noncanonical unsafe
representations. Invalid unsafe values remain observable and reflexive without
eager geometry construction.

`verify:convex-hull` runs pure/tool typechecks, pure build, full package lint and
all tests, including malformed/degenerate topology, deterministic point clouds,
analytic mass properties, extreme coordinates, nearest/support queries,
non-proxy SAT across hull/AABB/OBB pairs, ray degeneracies, rigid covariance,
protocol collections, public declarations, README examples and packed restricted
hosts. The final documentation acceptance record follows below.

## Spatial math acceptance record

On November 1, 2026, the user changed final integration `MineCraft-ner.7` to
documentation-only acceptance. The math epic `MineCraft-ner` is complete under
that scope. This records the existing implementation evidence; no tests, builds,
typechecks, lint, package installation or runtime checks were run for this final
documentation pass. Historical results below come from the closed Beads
implementation records and are not a fresh certification of this checkout.

### Public surface and operation inventory

All eleven spatial namespaces appear in `Source/index.ts`, with matching
JavaScript and declaration targets in `package.json`. `EulerAngle` remains an
empty extending interface exported from Rotator, with no separate root namespace
or package subpath. The sections above document
the APIs, units, partial results, coordinate conventions and examples.

| Surface | Operation families | Existing evidence sources |
| --- | --- | --- |
| `Vector2`, `Vector3` | Immutable construction, arithmetic, normalization, interpolation, directions, parsing and protocols | `Test/Vector.test.mts`, `Test/Vector.types.mts`; `MineCraft-ner.3` |
| `Quat` | Algebra, conversions, rotation, canonical equality/hash/orders, shortest/full-path interpolation, splines, log/exp and swing/twist | `Test/Quat.test.mts`, `Test/QuatAdvanced.test.mts` and their type fixtures; `MineCraft-ner.4`, `.5` |
| `Rotator` | Degree utilities, winding, compression, principal Euler conversion and quaternion-backed composition/interpolation | `Test/Rotator.test.mts`, `Test/Rotator.types.mts`; `MineCraft-ner.6` |
| `Transform` | No-scale poses, composition/inverse, matrices, frame conversion and interpolation | `Test/Transform.test.mts`, `Test/Transform.types.mts`; `MineCraft-ner.8` |
| `RigidTransform` | Origin motion, rotating-frame transport, point velocity, COM conversion and interpolation | `Test/RigidTransform.test.mts`, `Test/RigidTransform.types.mts`; `MineCraft-ner.9` |
| `Ray` | Unit directions, forward block distances, projections and rigid mapping | `Test/Ray.test.mts`, `Test/Ray.types.mts`; `MineCraft-ner.10` |
| `Plane` | Oriented normalized planes, half-spaces, projection and intersections | `Test/Plane.test.mts`, `Test/Plane.types.mts`; `MineCraft-ner.11` |
| `AABB` | Degenerate bounds, nearest/support queries, overlaps, ray slabs and rigid enclosures | `Test/AABB.test.mts`, `Test/AABB.types.mts`; `MineCraft-ner.12` |
| `OBB` | Local/world frames, corners, nearest/support queries and complete separating-axis overlap | `Test/OBB.test.mts`, `Test/OBB.types.mts`; `MineCraft-ner.13` |
| `ConvexHull` | Solid topology, construction, mass properties, nearest/support queries, ray clipping and complete static overlap | `Test/ConvexHull.test.mts`, `Test/ConvexHull.types.mts`; `MineCraft-ner.14` |

The existing test files contain callable operation inventories. Cross-cutting
package metadata checks are in `Test/Package.test.mts`; clean packed consumers,
public type fixtures, fourteen README examples and restricted-host execution
are covered by `Test/Consumer.test.mts`. These files were inspected as evidence
locations, without executing them during final acceptance.

### Foundations and dependency contract

Bedform is `1.0.0-alpha.2`, depending on `@bedform/effect` exactly `1.0.0-alpha.1`.
Its math development dependency is exactly `@minecraft/math@2.4.1`; its required
peer range is `^2.4.1`, with no optional math peer metadata. Production math uses
Effect Number/protocol helpers; the reference math package supports API
comparison and differential fixtures. Pure spatial imports require no Bedrock
subscriptions or Node/Web runtime APIs. ConvexHull uses ES2022 BigInt/DataView.

Effect's Number foundation and public Equal, Hash, Equivalence, Order, Ordering,
Pipeable, Inspectable and Formatter exports are recorded in `MineCraft-ner.1`
and `.2`. Existing `Package/Effect/Test/Number.test.mts`, `Protocols.test.mts`
and collection fixtures cover numeric call styles, public protocol resolution,
hash collections and restricted hosts.

### Recorded results and limits

The final implementation milestone, `MineCraft-ner.14`, records
`npm run verify:convex-hull --workspace bedform` passing 175 tests, pure/tool
typechecks, pure build, package lint, packed declarations, fourteen README
examples and restricted-host consumers. It also records
`npm run verify:protocols --workspace @bedform/effect` passing 20 regressions.

That milestone separately records full Bedform typechecking exiting with six
pre-existing `QueuingStrategy` errors in optional upstream Effect Stream
declarations. This limitation is retained and accepted for documentation-only
closure; it has not been fixed or rechecked here, and a successful full CLI
build is not claimed. Compiler settings and dependencies were not changed by
final acceptance. No live-world/client validation, deployment or physics solver
acceptance is implied. Contact solving, manifolds, CCD and concave decomposition
belong to the downstream physics work.


## Physics asset compiler

`bedform build --config bedform.config.json --out Intermediate/physics` compiles rigid-body assets as behavior/resource-pack overlays and an immutable TypeScript catalog. It does not bundle scripts, create pack manifests, install packs, or simulate bodies. Use `bedform/Build` for the explicit Node host API (`compile`, `publish`, `fingerprint`, `canonical`, `Config`, `Registration`, `SolidError`, `Limits`). The root namespaces `CollisionShape`, `PhysicsModel`, and `PhysicsRenderer`, their matching subpaths, and `bedform/keys` have no host or Bedrock runtime dependency.

A minimal configuration is:

```json
{
  "schemaVersion": 1,
  "namespace": "example",
  "behaviorPack": "BehaviorPack",
  "resourcePack": "ResourcePack",
  "models": [{
    "name": "crate",
    "representation": "cuboid",
    "geometry": "models/entity/crate.geo.json",
    "geometryIdentifier": "geometry.crate",
    "textures": { "default": "textures/entity/crate" },
    "materials": { "default": "entity_alphatest" },
    "density": 20,
    "collision": { "kind": "complex" }
  }]
}
```

Pack roots resolve relative to the configuration file. Cuboid geometry and PNG texture paths resolve from the resource pack; texture references omit `.png`. Texture/material aliases require a `default` entry; additional material aliases select matching bones and additional textures become controller layers. Authored geometry is copied into the overlay with a unique generated identifier, preserving UVs, locators, hierarchy, fixed transforms and appearance. Mirror flags affect UVs, not physical volume. Cubes use sixteenths of blocks, X-then-Y-then-Z rotations about their cube/bone pivots, inherited bone inflation and cube overrides; coordinates become `(x/16,y/16,-z/16)` after authored transforms. Deprecated `poly_mesh`, texture meshes, binding and collision deformation are rejected. Animated visual deformation is outside this rigid compiler.

A particle registration instead supplies `representation: "particle"`, `meshSolid` and `rendererDescriptor` paths relative to the configuration. The version-one renderer descriptor contains `identifier`, `geometry`, `geometryIdentifier`, and an `assets` array enumerating compatible generated assets; geometry/assets resolve from that descriptor. Its anchor geometry may be bone-less. Particle authoring, Blender export and live renderer attachment remain downstream work; this compiler consumes that interchange without importing Blender or ParticleRuntime. Particle owners are invisible and persistent; the renderer owns its separate transient anchor.

`PhysicsModel.MeshSolid` contains `schemaVersion: 1`, `coordinates: "minecraft" | "blender"`, positive `metresPerUnit`, evaluated `vertices` (`x/y/z`), oriented `triangles` (`indices` and original `source.object/source.face`), and `fingerprint`. Compute the fingerprint with `fingerprint` over every other field. Blender converts `(x,y,z)` to `(x,z,-y)` and applies the unit scale exactly once. Weld evaluated topology before export and correct winding after mirrored transforms. Rendering masks, UVs and particle region merging must not alter this source solid. Exterior shells wind outward; enclosed cavities wind inward, alternating for nested islands. Open boundaries, disconnected vertex fans, nonmanifold edges, degeneracy, self-intersections, touching/intersecting shells and ambiguous nesting fail with source diagnostics.

Compilation partitions overlapping cuboids or validated mesh solids by their boundary planes, classifies each convex region against the original solid, and marks internal cell faces for contact suppression. It preserves cavities, through openings and disconnected solids. It never substitutes an enclosing hull for a failed partition. Published `sourceGeometry` retains converted boundary topology and provenance; `sourceCells` retain the nonoverlapping convex partition independently of the selected collider. Signed tetrahedron integration derives volume, centroid and all nine inertia components, including cavity subtraction and the parallel-axis adjustment for a COM override.

Geometric tolerance is `1e-9 * max(1, maximumExtent)` blocks. The current budgets are 1,024 source triangles, 128 distinct boundary planes, 4,096 arrangement cells, 256 unique vertices per convex cell, 256 vertices per clipped face, four million plane/vertex classification operations, 64 cuboids, 256 bones, 1,024 blocks of model extent and absolute local coordinates at most one million blocks. Input beyond these budgets or a failed geometric predicate is rejected. Plane-arrangement cost can exceed budgets even for a model with few faces; simplify that source instead of relying on approximation. Mesh partition volume must agree with the source integral within `1e-7` relative error. These limits are compilation limits, not runtime performance claims.

Mass and density are mutually exclusive at both the typed and JSON boundaries. Default mass is 1 kg. Optional `centerOfMass`, `restitution` (0..1), `gravity`, `linearVelocity` (COM blocks/second), and `angularVelocity` (world radians/second) are model defaults. Restitution and velocities default to zero; omitted gravity defers to the physics world's gravity. Inertia always uses the source solid, regardless of selected collider. Omitted collision selects a fitted model-local box. Fit another enclosing primitive with `kind: "sphere" | "ellipsoid" | "capsule"` and `fit: true`. Explicit primitives use `halfExtents` and an optional `pose` (`position`, quaternion `rotation`); spheres require equal radii, capsules use X/Z radius and Y straight-segment half-length. A `compound` contains `children`; `complex` uses the exact source partition. Primitives and compound descriptions are pure immutable data.

Outputs include `behavior_pack`, `resource_pack`, `catalog/models.ts`, `catalog/models.json`, and per-model `catalog/*.renderer.json` attachment metadata. Import `Models` from the generated TypeScript catalog during the consumer's script build; it reconstructs frozen shared math values, so no host loader is needed at runtime. Fingerprints cover physical inputs, rendering descriptors, compatible asset bytes, configuration and generated visual contracts. The `.bedform-physics.json` ownership manifest records generated-file hashes. Rebuilds remove only recorded stale files, preserve unrelated files, and refuse to replace or delete edited/unowned files or follow symlinks. Compilation validates every model before output publication; authored sources remain unchanged.

Every representation has one common root at the model origin. An existing identity root at the origin is reused. A new parent preserves a nonidentity authored root or multiple roots, and a bone-less anchor gets one trivial root. All descendant bones and face locators inherit its pose. Generated `client_sync` integer properties carry committed start/end model-origin poses, sequence/reset, and render-base information; `PhysicsRenderer.encode` validates and encodes them. `PhysicsRenderer.Renderer`/`Attachment` define explicit commit, rebase, pause and idempotent disposal, including restoration, dimension changes and rollback. They do not subscribe to engine events.

The presentation contract uses one linear alpha over 50 ms, component-wise position lerp and shortest-path normalized quaternion lerp. Duplicate/stale packets do not restart its clock; incomplete packets hold the last interval; skipped intervals and reset markers snap to the latest endpoint. Each payload word carries its sequence modulo 128. Runtime transports must retire stale payloads within 127 commits, publish payload/reset before the sequence marker, keep sequence monotonic through resets and recreate the owner before sequence exhaustion (8,388,607). Reset ranges from 0 to 65,535. Local endpoints have 1/4096 block precision within [-8,8) of the render base; rebase or explicitly reset discontinuities outside that range. Quat components have 1/32767 precision and are renormalized per frame. The render base uses signed 32-bit integer block coordinates plus a 1/65535 fractional word. Twenty-five properties stay within exact 23-bit integer payloads. Native owner/anchor rotation must stay neutral. Per-frame root offsets compensate against the rendered entity origin instead of adding a second translation stream.

Compiler acceptance is host-side: analytic boxes/tetrahedra, overlap unions, cavity subtraction, concave manifold openings, disconnected/mirrored/unit-converted solids, malformed topology, deterministic assets, cleanup, packed consumers and generated-expression frame fixtures. Actual engine property timing, native interpolation, helper collision behavior, two-player visuals, runtime physics and sustained performance remain acceptance work in `MineCraft-8zu.2` through `.5`; these compiler checks do not establish those results.


## Authoritative collision queries

`bedform/Collision` (also the root `Collision` namespace) prepares immutable collider handles and performs distance, contact and continuous queries. `prepare(model.collision)` copies and validates primitive, compound and exact convex-cell data, preserving source paths and internal-face flags. Prepared handles own a balanced model-local AABB hierarchy; they retain no caller-owned mutable arrays. An `Instance` supplies the handle and an authoritative model-origin `Transform`. Rendering intervals, common-root offsets and frame-rate samples are not query inputs.

`distance(a,b,options)` returns `Result<Distance,Diagnostic>`, including world-space witnesses, a normal from A toward B, and nonnegative separation. `collide(a,b,options)` returns frozen exterior manifolds; successful empty output means separated solids. Both support the data-last form `distance(b,options)(a)` / `collide(b,options)(a)`. Each manifold has at most four spatially spread contact points with paired world-space witnesses, penetration depth and deterministic feature identifiers. Distinct surface normal patches remain separate rather than inventing one global translation for a concave solid. `bounds(instance)` returns an enclosing world AABB for broad-phase use.

Sphere/capsule pairs use analytic segment distance, including point degeneracy and coincident-axis ties. Other convex pairs use support-mapped GJK distance and EPA penetration on their true support maps: boxes, spheres, capsules, ellipsoids and validated convex hulls are not replaced by bounding proxies. EPA seed sampling constructs an interior polytope only; the final support gap bounds convergence against the original shapes. Repeated support without a certified GJK gap, missing interior EPA seeds and exhausted work are typed failures. Polyhedral contacts clip incident polygons against reference side planes; coplanar triangles are joined into face polygons. Complex models query their actual cells through the hierarchy, recover exterior contacts when a shallow axis points through a partition, suppress internal-only/edge-lip witnesses and merge compatible exterior patches. A pair exposing only unresolved internal witnesses reports a diagnostic rather than a false miss.

`Collision.Options` defaults to absolute and model-radius-relative tolerance `1e-7` each: the pair tolerance is `absoluteTolerance + relativeTolerance * max(radiusA,radiusB)`. At least one tolerance must be positive. The defaults are 64 GJK iterations, 128 EPA iterations, 128 CCD advances, 16,384 convex leaf pairs and 65,536 model node pairs per query. Iteration limits may be set from 1 to 256; leaf-pair limits up to 65,536 and node-pair limits up to 262,144. EPA has an additional 1,024-facet cap and deterministic seed/simplex bounds. Model preparation permits 4,096 leaves, compound depth eight and at most 256 vertices/faces per cell. Model-local reach must stay within one million blocks, primitive radii/box or ellipsoid half extents must be at least `1e-9` blocks, and authoritative positions must stay within one billion blocks. Capsule straight-segment half length may be zero. Invalid topology, forged handles, nonfinite inputs and unsupported numerical domains fail explicitly. These are numerical/work limits, not sustained runtime performance claims.

`Collision.Diagnostic` has `_tag: "CollisionError"`, a `code` (`InvalidInput`, `ComplexityLimit` or `NonConvergence`), a stage (`validation`, `gjk`, `epa`, `manifold`, `bvh` or `ccd`) and a message. The dynamics layer must report the diagnostic and pause the affected island; callers must not interpret a failed Result as separation, delete a body or substitute a hull. Published shapes, witnesses and contact arrays are frozen. Exact-zero/tied normals choose deterministic coordinate/perpendicular directions. Feature identifiers distinguish the selected contact vertices but do not replace persistent body identifiers.

### Continuous trajectories

`sweep(a,b,duration,options)` returns `Result<Option<Hit>,Diagnostic>`; `None` certifies a miss over the requested constant-velocity trajectory, while a hit includes seconds, horizon fraction and witnesses within the contact tolerance. The data-last form is `sweep(b,duration,options)(a)`. Horizons must be finite and in `(0,60]` seconds. Each `Motion` supplies a prepared shape, a shared `RigidTransform` state and an optional model-local COM offset. State linear velocity is at the model origin, in blocks/second; angular velocity is world-space radians/second. CCD explicitly computes `vCOM = vOrigin + cross(omega, COM-origin)`, advances the COM linearly, integrates full world angular motion, then derives the model-origin pose from the rotated COM offset. Full turns are supported; endpoint quaternion interpolation does not stand in for the authoritative path.

Advancement uses the current exact-leaf distance divided by a global relative-COM-speed bound plus both angular-speed/reach bounds. The global bound remains conservative when the nearest convex cell changes in a concave, cavity-bearing or disconnected model. Thin obstacles are checked along the path rather than only at discrete endpoints. A stalled or exhausted advance returns a typed CCD failure, never a false miss. `sweptBounds(motion,duration)` (also `sweptBounds(duration)(motion)`) encloses the complete COM segment expanded by angular reach, for use in broad-phase candidate generation. Accelerations, forces, response and changing velocities belong to the later fixed-step dynamics layer.

### Dynamic broad phase

`bedform/CollisionBroadPhase` (root `CollisionBroadPhase`) creates explicit dynamic AABB indexes with `make`. The frozen handle owns private mutable AVL buffers, surface-area-guided insertion and conservative fat boxes. `set(tree,entry)` inserts/updates an ID with copied authoritative bounds and `dynamic`, `static` or `kinematic` mode; updates inside the fat box avoid reinsertion. `remove` is idempotent and reports whether the ID existed. `query` returns frozen ordered entries whose actual bounds overlap the requested box, and `snapshot` returns ordered body entries. These binary operations support data-last calls.

`pairs(tree,maxPairs?,maxNodes?)` traverses paired tree nodes, excludes static/static subtrees, and returns ordered, unique actual-AABB pairs. It also supports `pairs(maxPairs?,maxNodes?)(tree)`. Defaults are 65,536 output pairs and 262,144 node-pair visits, each configurable up to one million. Work exhaustion reports `ComplexityLimit`. The default fat margin is 0.1 blocks and capacity 16,384 bodies; valid limits are nonnegative margin up to one million blocks and capacity 1..65,536. Body IDs are nonempty strings of at most 256 characters. Old snapshots survive updates/removals unchanged, and the index has no event subscriptions or implicit tick processing. Feed it conservative swept bounds when building CCD candidates.

Collision acceptance includes all 36 ordered primitive/complex/compound shape pairings for rotated separation, overlap and boundary contact; analytic witnesses and four-point box clipping; independent rotated-box SAT fixtures; equivalent cuboid/mesh responses; cavities, openings, disconnected solids and seam crossings; thin-wall, rotation-only, full-turn and offset-COM sweeps; all shape CCD pairings; brute-force broad-phase comparisons after updates/removals; deterministic failures; declaration inference; packed restricted-host consumers; and invariance under differing presentation sampling. This completes the pure collision stage (`MineCraft-8zu.2`). Impulse response, sleeping/islands, world/runtime integration, engine/client behavior and sustained performance remain in `.3` through `.5`.

Algorithm references: [Van den Bergen's GJK distance work](https://research.tue.nl/en/publications/a-fast-and-robust-gjk-implementation-for-collision-detection-of-c/) and [controlled conservative advancement](https://graphics.ewha.ac.kr/C2A/C2A.pdf). The implementation uses a conservative global speed bound for changing nearest cells and reports its own bounded convergence failures. Single convex pairs can use the separating-plane closing bound for linear motion; angular reach remains conservative.

## Immutable rigid-body dynamics

`bedform/PhysicsEntity` and `bedform/PhysicsWorld` (also root namespaces) implement the pure dynamics stage. They import neither Bedrock runtime APIs nor host/build tools, and start no subscriptions. Bodies/worlds and their nested physical data, vectors, intervals, options and events are immutable. Updates return `@bedform/effect/Result`; lookups distinguish absence with `Option`. Bodies and worlds implement `Equal`, `Hash`, `Pipeable` and `Inspectable` with shared prototypes. Equality includes catalog geometry/physical data and complete state; world equality also includes private frozen warm-start data because it affects future steps. Diagnostic JSON is not the later versioned engine persistence format.

Register a compiled model once with `PhysicsEntity.define(model)`, then call `make(definition,{id,...})` for each body. `make(model,options)` also registers directly. IDs are explicit deterministic strings of 1..256 characters. A definition owns prepared collision geometry and copies compiled source-solid mass properties without freezing or retaining a mutable caller model graph. Source-centroid inertia is recovered by subtracting the original parallel-axis contribution, normalized by source mass, then scaled/recentered for requested mass/density/COM. It remains independent of collision approximation or rendering. Invalid, nonfinite, nonpositive, asymmetric or ill-conditioned physical data fails instead of becoming a diagonal proxy. Tensor inversion uses a conditioned Cholesky/inverse check; unsupported inverse-mass domains fail explicitly.

Body options include `mode` (`dynamic`, `static`, `kinematic`), model-origin `pose`, mutually exclusive positive `mass`/`density`, local `centerOfMass`, `restitution` in [0,1], `gravity` as `Option<Vector3>`, COM `linearVelocity`, world `angularVelocity` and `allowSleep`. Defaults come from the model, with dynamic mode, identity pose and sleeping permitted. `None` gravity inherits world gravity; `Some(Zero)` disables it for that body. `gravityFrom(magnitude,direction)` validates a nonnegative magnitude and unitizes direction; zero gravity accepts a zero direction. Static bodies reject nonzero velocities. Kinematic velocities are caller-prescribed, contribute contact motion and are unaffected by loads/impulses.

| Body operation | Behavior |
| --- | --- |
| `configure(body,properties)` | Rebuild source-solid mass/inertia, preserve world pose/velocities and wake. |
| `setPose(body,pose)` | Explicit discontinuity; reset both visual endpoints and increment reset marker. |
| `setLinearVelocity` / `setAngularVelocity` | Independently replace COM/world velocities and update angular momentum. |
| `applyForce(body,force,point?)` | Accumulate force and world-point torque for the next complete tick; omitted point means COM. |
| `applyTorque(body,torque)` | Accumulate world torque without adding COM force. |
| `applyImpulse(body,impulse,point?)` | Immediate COM and full-tensor angular response. |
| `clearForces` / `wake` | Clear loads, or wake without automatically resuming a failed body. |
| `pause` / `resume` | Hold/retry retained state; pause preserves loads/velocities and is idempotent. |
| `centerOfMass` / `motion` | Inspect world COM, or shared origin-motion `RigidTransform`. |

Binary updates support data-last calls, such as `applyImpulse(impulse,point)(body)` and `configure(properties)(body)`. Public linear velocity remains authoritative COM motion. `motion(body)` computes `vOrigin = vCOM + cross(angularVelocity, origin-COM)`; it never labels COM velocity as origin motion. Paused/sleeping/static bodies report zero effective motion while paused saved velocities remain retained. Pose-preserving mass/COM changes recompute momentum for existing angular velocity. Static/kinematic loads are validated and ignored. Friction is fixed at 0.5 and cannot be overridden.

### World updates and stepping

`PhysicsWorld.make(options)` creates an empty value with gravity `(0,-9.81,0)`. `add` rejects duplicate IDs, `set` replaces an existing body, `modify(world,id,operation)` applies an atomic Result-returning update, `get` returns `Result<Option<PhysicsEntity>>`, and `remove` is idempotent. Receiver operations support direct/curried calls. `setGravity` wakes world-gravity dependents. Anchor changes wake old contacts and newly overlapping sleepers; removing support wakes the unsupported contact chain. Load/velocity-only updates retain warm starts; pose, physical-data, mode, restitution and pause changes invalidate affected caches. Callback exceptions become typed failures, with no partial update.

`step(world)` advances exactly 0.05 seconds using four fixed 0.0125-second substeps. There is no elapsed-frame-time input or second render-driven simulation. COM velocities use semi-implicit force/gravity integration. World angular momentum integrates torque and contact impulses; full tensors are transported through shared quaternions. A midpoint angular prediction defines each constant-angular-velocity segment; CCD and actual advancement use that same trajectory, then angular velocity is recovered from momentum and the new orientation. Kinematics retain prescribed velocities. Successful ticks consume force/torque once across all four substeps.

Each regular substep performs ten warm-started sequential-impulse velocity iterations. Normal impulses accumulate/clamp, restitution uses the larger participant coefficient above a 1 block/second closing-speed threshold, and coupled tangent directions clamp to the fixed Coulomb cone. Cached tangents project onto the new tangent plane; local anchors/normals validate reuse. Separate inverse-mass position correction uses `1e-4` block slop, factor 0.2 and at most 0.1 block translation per body/substep, without correction velocity. Contact queries use four times geometric tolerance to keep conservative TOI witnesses/resting patches coherent. Additional localized ten-iteration solves resolve bounded CCD impacts without adding full simulation substeps.

Continuous response advances to the earliest collision, resolves it and continues through the remaining substep using authoritative COM/origin transport and angular reach. Conservative moving contact islands do not connect unrelated bodies through static anchors. If an impact accelerates a body beyond its original motion envelope, the tick restarts transactionally with enlarged bounds and regrouped islands. At most four replans are allowed. Exhaustion pauses/reports retained state instead of missing an impact. A bounded position-correction allowance stays inside the envelopes. This catches subsequent obstacles beyond a light body's initial bounds after a high mass-ratio impact.

World defaults are 4,096 bodies, 65,536 broad-phase pairs and eight CCD impacts per substep. Valid ranges are 1..4,096 bodies, 1..1,000,000 pairs and 1..64 impacts; `options.collision` supplies collision-stage tolerances/limits. Numerical, effective-mass and work failures never publish NaN or partial state. A failed moving island rolls back its entire tick to original pose, velocities, loads and properties and becomes paused; independent islands continue. A local invalid bound is isolated at its retained pose; a global broad-phase/replan budget failure conservatively holds the moving scene. `world.diagnostics` records affected IDs and typed collision/numerical/solver causes. Repair inputs and explicitly resume; elapsed held time is not replayed.

Dynamic islands sleep together after 0.5 seconds below 0.03 blocks/second and 0.03 radians/second without outstanding loads. Moving kinematics prevent associated sleeping. Waking updates propagate through the conservative moving contact group, and sleepers retain contact/event discovery. `world.events` supplies deterministic `begin`/`end` transitions ordered by within-tick time and IDs, including transient CCD impacts and removal ends; `world.contacts` is the committed ordered pair snapshot. Events and diagnostics describe the most recent operation rather than an unbounded log.

Committed bodies publish pose-only `interval.start` from the previous model origin and `interval.end` from the four-substep result, with duration 0.05 and monotonic sequence. Explicit discontinuities/first pauses reset endpoints; ordinary load/velocity updates preserve the stream. These `Transform` values are distinct from COM and motion-bearing `RigidTransform`. Intervals are unquantized; the later runtime adapter must respect renderer transport/rebase/sequence limits independently. Rendering cannot alter authoritative physics.

Acceptance fixtures cover analytic trajectories, forces/torques, source-solid mass, off-center/full-tensor impulses, gravity, kinematics, elastic momentum/energy, thin-wall and rotation-only response, high mass-ratio replanning, friction/sliding, stacking, sleep/wake/support removal, free rotation, offset-COM paths, rollback/repair, immutable options, events, protocols, overload declarations and packed restricted-host execution. Scalar fixtures use `1e-7` tolerances, elastic response `1e-5`, two-second rotation energy `5e-4`, isolated large-inertia friction `2e-3` blocks/second, and two-body stacking 0.02/0.04 block height error over two seconds. These host checks establish neither engine visuals nor sustained runtime performance.

This completes pure dynamics (`MineCraft-8zu.3`). Explicit native contacts, engine owners, persistence and renderer lifecycle are available through [PhysicsRuntime](Documentation/physics-runtime.md). `MineCraft-8zu.4` retains its engine/client acceptance boundaries; sustained performance and broader client acceptance remain in `.5`. Design references include [sequential impulses](https://box2d.org/files/ErinCatto_SequentialImpulses_GDC2006.pdf) and [accumulation/warm starting](https://box2d.org/posts/2024/02/solver2d/); this implementation is three-dimensional with the package's fixed physical contracts.

The [physics acceptance record](Documentation/physics-acceptance.md) contains reproducible host/BDS benchmark commands, measured mesh costs, runtime instrumentation and failed performance gates. The [two-client procedure](Documentation/physics-client-validation.md) prepares a disposable cuboid fixture for the remaining captures. The ten-minute 128-body benchmark failed the 15 ms p95 target; `.5` remains in progress, and client acceptance remains open.
