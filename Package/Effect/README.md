# @bedform/effect

Effect utilities and the Effect runtime for Bedrock, version 1.0.0. See [PROVENANCE.md](PROVENANCE.md)
for the pinned upstream source and port boundaries.

`Function`, `Predicate` and `String` are complete ports of the pinned Effect 4.0.5
modules, available through root namespaces and direct subpaths. Function helpers
such as `pipe` are also root exports. The local `Thunk` type extension is described
in [PROVENANCE.md](PROVENANCE.md).

Run `npm run verify:primitives --workspace @bedform/effect` for source/tool
typechecks, focused lint, Function tests, Predicate/String runtime and declaration
parity, differential behavior, dependency closure, and isolated packed-consumer
checks. The packed check runs without Node/Web globals and checks tree shaking
and private-path rejection. Locale operations retain native host behavior;
these checks do not establish BDS or client compatibility.

`npm run test:host --workspace @bedform/effect` builds the package and runs every
host test with bounded concurrency, including the isolated packed-consumer tests.
Run through npm so those tests receive npm's executable path.

The caller audit retains existing String consumers in World Realism and the
server manager, and root/direct Function consumers
across add-ons and packages. IndustrialCraft's compatibility module now re-exports
the shared `pipe` and `Pipeable.pipeArguments` under its existing `Pipe` and
`PipeArguments` names. The audit found no remaining executable imports of upstream
Function/Predicate/String in add-on or package consumers. Native string methods,
domain-specific predicates, and Node services using upstream Effect retain their
existing contracts; they do not require wholesale syntactic replacement.

The public protocol modules are available as root namespaces and direct subpaths:

```ts
import { Equal, Hash, Equivalence, Order, Ordering, Pipeable, Inspectable, Formatter } from "@bedform/effect";
// Each namespace also has a direct import, for example:
import * as DirectHash from "@bedform/effect/Hash";
```

| Module | Use |
| --- | --- |
| `Equal` | Implement `[Equal.symbol]` for custom value equality. |
| `Hash` | Implement `[Hash.symbol]` with matching hashes for equal values; this supports HashMap and HashSet keys. |
| `Equivalence` | Build comparison relations with `make` and composition helpers. |
| `Order` | Build typed ordering functions with `make`, primitive orders and `mapInput`. |
| `Ordering` | Work with the comparison results `-1`, `0`, and `1`, including `reverse` and `match`. |
| `Pipeable` | Reuse `Prototype.pipe`, extend `Class`, or delegate a method to `pipeArguments(this, arguments)`. |
| `Inspectable` | Extend `Class` and implement `toJSON`, or reuse `BaseProto` with your own JSON representation. |
| `Formatter` | Format values with `format`, or produce JSON text with `formatJson`. |

For example, an application can define an inspectable value that supports equality
and hash collections entirely through public imports:

```ts
import { Equal, Hash, HashSet, Inspectable, Pipeable } from "@bedform/effect";

class Coordinate extends Inspectable.Class implements Equal.Equal, Pipeable.Pipeable {
    constructor(readonly x: number) { super(); }
    readonly pipe = Pipeable.Prototype.pipe;
    [Equal.symbol](other: Equal.Equal): boolean {
        return other instanceof Coordinate && Equal.equals(this.x, other.x);
    }
    [Hash.symbol](): number { return Hash.hash(this.x); }
    toJSON() { return { _id: "Coordinate", x: this.x }; }
}

const values = HashSet.make(new Coordinate(3), new Coordinate(3));
HashSet.size(values); // 1
new Coordinate(3).pipe(value => value.x, x => x * 2); // 6
```

Inspection uses the shared custom-inspection symbol without importing Node.
Formatting and protocols require no Node, Web or Minecraft runtime imports.
Root imports and all eight direct subpaths include declarations and legacy
`typesVersions` mappings. Package-internal paths remain private.

Run `npm run verify:protocols --workspace @bedform/effect` from the repository
root for source and tool typechecks, focused lint, public protocol integration,
clean packed-consumer modern/legacy declaration checks, restricted-host execution,
Number tests and collection regressions. These host checks do not prove live BDS
or client compatibility.

## Units

`@bedform/effect/Unit` provides typed quantities and unit conversions, ported from
[effect-units](https://github.com/rjdellecese/effect-units) 1.0.1 under its
BSD-3-Clause license (see [Unit.License.md](Unit.License.md)). Each effect-units
module is a namespace:

```ts
import { BigRational, Int, Rational, Schema, Unit } from "@bedform/effect";

const speed = Unit.Quantity.per(Unit.Length.kilometers(3), Unit.Duration.minutes(10));
Unit.Speed.inKilometersPerHour(speed); // 18

const foot = Unit.Length.feet(1n); // a Length<BigRational>
BigRational.format(Unit.Length.inMeters(foot)); // "381/1250"

Unit.Quantity.divide(foot, 3n); // Option.some, since the division is exact
Unit.Quantity.divide(Unit.Length.feet(1), 0); // a float Length of Infinity

const half = Rational.makeUnsafe(Int.makeUnsafe(1), Int.makeUnsafe(2));
Rational.format(Unit.Length.inInches(Unit.Length.feet(half))); // "6"

Schema.encodeSync(Unit.Length.LengthFromStruct)(Unit.Length.meters(2)); // { unit: "Meters", value: 2 }
```

A quantity stores its value in the base unit as one of three kinds: a float, a
`Rational` or a `BigRational`. Every constructor and converter accepts a
`number` (including `Int` and `UInt`), a `Rational`, a `bigint`, a `BigRational`
or a `BigDecimal`, and tests for a `number` first. The other kinds are tested in
that order:

- A float stays a float, and gives the same bits as effect-units.
- A `Rational` stays a `Rational`. Its arithmetic is exact, and throws a
  `RangeError` when a result's reduced numerator or denominator needs more than
  53 bits. A light year in meters, or anything with the `Quecto` prefix, is
  too large.
- A `bigint`, `BigRational` or `BigDecimal` becomes a `BigRational`, because unit
  conversions are closed over neither the integers nor the terminating decimals.

When two kinds meet, as in `Quantity.sum` or `Quantity.per`, any float operand
makes the result a float. Otherwise two `Rational`s give a `Rational`, and
anything else gives a `BigRational`. Float division follows IEEE semantics.
Exact division returns `Option`, and each dividing operation has an `Unsafe`
variant that throws instead. Conversions with an irrational factor, such as
`Length.parsecs` and most of `Angle`, always produce floats.

`Quantity.Quantity(unit)` and every unit module's schema hold floats. Pass a
value schema to hold an exact kind, as in
`Quantity.Quantity(Length.Meters, BigRational.BigRational)`. Exact values encode
as canonical rational strings (`"3/2"`), the wire format of effect-units'
`Exact` modules. The `DateTime` interop and arbitrary generation helpers of
effect-units are omitted; see [PROVENANCE.md](PROVENANCE.md). Run
`npm run verify:unit --workspace @bedform/effect` to check the module.

### Meters for Bedrock coordinates

`Unit.Meter`, also published as `@bedform/effect/Unit/Meter`, is original to
@bedform/effect. A `Meter` is a finite `number` with a `"Meter"` brand rather
than a quantity object, so a plain number is rejected where a `Meter` is
expected, while every `Meter` still fits a Bedrock `Vector3` component.
`Meter<Int>` is a whole number of meters and is also an `Int`:

```ts
import * as Int from "@bedform/effect/Int";
import * as Meter from "@bedform/effect/Unit/Meter";
import * as Unit from "@bedform/effect/Unit";

const x = Meter.fromInt(Int.makeUnsafe(12));   // Meter<Int>
const size = Meter.makeUnsafe(0.0625);         // throws RangeError unless finite
Meter.makeInt(-2.5);                           // Option.some(-3), floored like Int.make
Meter.fromLength(Unit.Length.centimeters(50)); // 0.5
Meter.toLength(size);                          // a float Length of 0.0625 m
```

## Numbers

- `@bedform/effect/Int` is a branded `number` that always satisfies
  `Number.isSafeInteger`. Its constructors floor non-integral input. Arithmetic
  that leaves the safe range throws a `RangeError`, and division floors.
- `@bedform/effect/UInt` is an `Int` that is at least zero, and can be used
  anywhere an `Int` can. Its `subtract` and `decrement` return `Option` rather
  than going negative.
- `@bedform/effect/BigRational` holds exact fractions of `bigint`s. It is
  effect-units' `Rational` module.
- `@bedform/effect/Rational` has the same API as `BigRational`, but its
  numerator and denominator are `Int`s.

Run `npm run verify:numeric --workspace @bedform/effect` to check these modules.

## Effect runtime

`@bedform/effect` includes the Effect runtime: `Effect`, `Exit`, `Cause`, `Context`,
`Layer`, `Scope`, `Fiber`, `Deferred`, `Ref`, `MutableRef`, `Clock`, `Scheduler`,
`Schedule`, `ManagedRuntime` and their supporting modules. Each is available as a
root namespace and as a direct subpath such as `@bedform/effect/Effect`.

`@bedform/effect/Bedrock` runs the runtime on the game tick. Pass it the `system`
object from `@minecraft/server`; the library never imports a Minecraft module.

```ts
import { system } from "@minecraft/server";
import { Bedrock, Effect, Layer, ManagedRuntime } from "@bedform/effect";

const Runtime = ManagedRuntime.make(Layer.mergeAll(Bedrock.layer(system), AppLive));
Bedrock.disposeOnShutdown(Runtime, system.beforeEvents.shutdown);
Runtime.runFork(Effect.andThen(Effect.sleep(Bedrock.ticks(20)), Effect.log("one second later")));
```

See [RUNTIME.md](RUNTIME.md) for tick semantics, event-handler rules, shutdown and the
differences from upstream. Run `npm run verify:runtime --workspace @bedform/effect` to
check the runtime.
