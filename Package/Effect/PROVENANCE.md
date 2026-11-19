# Effect Bedrock source provenance

Use only `MAJOR.MINOR.PATCH` in symbol-level `@since` tags. Prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`, or any other prerelease identifier) and build metadata (`+...`) must never appear in `@since` tags; for example, package version `1.0.0-alpha.1` uses `@since 1.0.0`.

Module TSDoc headers must not contain `@category` or `@since`; these tags apply only to symbol documentation. Follow the repository's TypeScript module header format for file-level metadata.

This port uses the npm release `effect@4.0.5` from
https://www.npmjs.com/package/effect/v/4.0.5, maintained at
https://github.com/Effect-TS/effect. Its MIT license appears in `License.md`.
The package version is 1.0.0; upstream documentation versions are available
in the pinned development dependency.

The initial `Option` dependency closure is copied from that release. Imports
of the mixed `Filter` module use the private pure signature in
`internal/filter.ts`; the inspection prototype is extracted from upstream
`internal/core.ts` into `internal/inspection.ts`; and the stack-trace limit
helper's type is extracted from `internal/tracer.ts`. `Formatter` and
`Inspectable` use private redaction support. It supplies the upstream empty
context instead of looking up an active Effect fiber, because this port has no
fiber runtime. Upstream documentation versions are normalized to 1.0.0.

The public package exposes `Data`, `Option`, `Function`, `Predicate`, `String`,
the pure Schema data dependencies and the documented synchronous Schema subset,
alongside root-level Function exports.
This intermediate package has not been validated on BDS and makes no runtime
compatibility claim. Development tooling may use Node; library source must not
depend on Node or Minecraft APIs. The source compiler excludes Node ambient
types, while the separate tools compiler is intended for host-only code.
The SingleShotGen class omits its upstream implements Iterator<T, A> clause because TypeScript 5.5 rejects that declaration. This does not change the class members or runtime implementation.
`Schema.Uint8Array` and `SchemaTransformation.uint8ArrayFromBase64String` write their upstream
`Uint8Array<ArrayBufferLike>` types as plain `Uint8Array`, because TypeScript 5.5 typed arrays are not
generic and consumers check these declarations. From TypeScript 5.7 a plain `Uint8Array` defaults to
`Uint8Array<ArrayBufferLike>`, so the types are unchanged there. `Test/SchemaDeclarations.test.mts`
typechecks every exported declaration with the workspace's TypeScript 5.5 to keep them compatible.

`Function` retains the complete upstream implementation, all 22 runtime exports,
all three upstream type exports, and every overload. The local type-only
`Thunk<A = never>` extension describes a side-effecting callback returning
`void`: its default takes no arguments, while a tuple supplies its arguments.
It is available through both `@bedform/effect/Function` and the package root.
Declaration parity checks verify this extension separately and compare every
remaining declaration exactly against upstream. Its only dependency is the local
`Pipeable` helper at runtime and `HKT` for types. Relative source imports use
`.js` for the emitted ESM. Documentation uses the port's package name and version;
generic names, contextual typing, `arguments` forwarding and callable inputs
retain narrow file-local lint exceptions to preserve upstream behavior and API.

Run `npm run test:function --workspace @bedform/effect` for host differential
coverage, emitted declaration parity, package export checks and a runtime
dependency-closure check. Run `npm run typecheck:tools --workspace @bedform/effect`
for positive and negative consumer type checks, and
`npm run lint:function --workspace @bedform/effect` for the module and its tests.
These host checks do not establish BDS compatibility; the epic's isolated BDS
fixture and acceptance campaign remain separate work.

The October 29, 2026 scope extension adds the complete `Data` module, including
`Class`, `TaggedClass`, `taggedEnum`, `Error`, `TaggedError`, and all tagged-enum
types and overloads. Inline property object types are extracted into interfaces
in the containing type's namespace, as required by the repository conventions.
Declaration parity checks expand these interfaces before comparison.

`internal/data.ts` extracts the yieldable error constructors and their failure
primitive, cause/reason, annotation and inspection support from upstream
`internal/core.ts`. The original prototype, iterator, evaluation, continuation
and interruption logic is retained; private identifiers use PascalCase and
unneeded internal fiber/Cause/Exit type annotations are erased. The public
`YieldableError` contract and its Effect variance, iterator and unification
types are extracted from `Cause.ts` and `Effect.ts` into `internal/data-types.ts`.
These are private protocol definitions, with no executor, scheduler, fiber
implementation or runtime import of upstream Effect. This is an addition to
the previously deferred public scope, authorized by the user and recorded in
the initial-port plan and `MineCraft-isg.14`.

Run `npm run test:data --workspace @bedform/effect` for Data export and declaration
parity, private type-contract parity, runtime dependency checks, class/enum/error
behavior, and host-only interoperability with the pinned Effect executor.
The tests use assertions at the cross-package type boundary because the two
packages declare distinct unique inspection symbols. The host-only
`Test/UpstreamWeb.d.mts` aliases Node's `QueuingStrategy` type for upstream's
declaration graph; it emits no code and is excluded from library compilation.
`npm run lint:data --workspace @bedform/effect` and the shared tools typecheck
cover the new sources and consumer inference checks for all four generic enum
arities. BDS execution remains unverified.

The Schema foundation milestone for `MineCraft-isg.15` vendors the complete
`BigDecimal`, `BigInt`, `ByteSize`, `Chunk`, `Duration`, `HashMap`, `HashSet`,
`NonEmptyIterable`, `Redacted` and `RegExp` modules from the same pinned release.
They and the existing `Result` module have explicit root/direct exports.
`internal/hashMap.ts` and `internal/hashSet.ts` retain the upstream HAMT and set
implementations. Redacted reuses the existing pure inspection prototype and
adds the original private weak registry. ByteSize uses the private nominal
`Brand`/`Branded` contracts; Chunk uses the existing private Filter signature.
Private constants follow repository naming, and Chunk's nested variance object
is an interface in its merged namespace. Public APIs retain upstream names.

Private Base64, Base64Url, Hex and EncodingError implementations are vendored
from upstream. EncodingError inherits the ported Data.TaggedError protocols.
The new `internal/utf8.ts` implementation replaces TextEncoder/TextDecoder use
inside those codecs. It encodes lone surrogates as replacement characters,
decodes malformed sequences using maximal-subpart replacement, and strips one
leading BOM, matching the default Web text codec behavior without accessing or
installing Web globals. These encoding helpers remain private package paths.

`SCHEMA.md` records the approved subset exception. `SchemaCompatibility.json`
contains the pinned source hashes and export/member/annotation-hook inventory;
`Tool/SchemaManifest.mts` regenerates its classifications and
`Test/SchemaInventory.mts` independently discovers declaration paths.
The completed synchronous subset retains upstream AST structures, SchemaIssue
formatters, pure getters/transformations, schema combinators and Data-backed
classes. `SchemaParser.ts` and `internal/schema/synchronous.ts` implement direct
Result execution, sequential product parsing, recursion caches and lazy
construction defaults. No Effect executor or compiler registry is included.
`internal/schema/ast.ts` holds AST implementation details behind the explicit
`SchemaAST` facade; `internal/schema/representation.ts`, `toRepresentation.ts`,
`toCodec.ts`, `toJsonSchemaDocument.ts`, `toFormatter.ts` and `toEquivalence.ts`
extract the pure derivation machinery. Unsupported hooks are stripped; private
representation metadata is stored under `~representation`.

`JsonPointer.ts` retains pure pointer escaping and URI fragment handling.
`internal/schema/jsonSchema.ts` extracts Draft-07 conversion and rewrites local
references by structural pointer paths without URL APIs. External references,
anchors and resource identifiers fail explicitly. Its facade exports only the
approved document types and Draft-07 converter. Standard Schema validation runs
synchronously and converts thrown defects into standard issues; validation and
JSON Schema capabilities coexist on the same schema.

Service type parameters are constrained to `never`; fallible getters use Result
and defaults accept lazy callbacks. Internal success/missing/unchanged markers
never escape public parsers. Public error adapters wrap SchemaIssue in the
ported Data-based SchemaError; ordinary adapters preserve thrown defects.
The manifest inventory now accounts for aliased exports as well as declarations.
`SchemaSurface.test.mts` checks every retained/adapted path and rejects omitted
exports and members using TypeScript's semantic declarations.

`npm run verify:schema --workspace @bedform/effect` runs host differential tests,
type checks, focused lint, packed consumers, restricted-host execution and
Function/Data regressions. These checks do not establish BDS compatibility.

The complete `Brand` module is also vendored from pinned `effect@4.0.5`, tracked
by `MineCraft-isg.16`. All five runtime exports (`BrandError`, `nominal`, `make`,
`check`, `all`) and the full `Brand`, `Constructor`, `Branded` and namespace type
helpers are retained. Its imports resolve to local Array, Option, Result,
SchemaAST and SchemaIssue implementations; Schema and Types are type-only.
The private `internal/brand.ts` contracts now re-export these public types, so
ByteSize and Schema branding use the same nominal key and constructor contract.
Algorithms and error behavior are unchanged, including BrandError being an
error-like object rather than a native Error, collected checks, and thrown
predicate defects. Documentation uses version `1.0.0` and retains upstream MIT
provenance.

The pinned `src/Brand.ts` SHA-256 is
`ca72b8c5b47a8c4d734e792c76abb6c4acd891e8ede0c0603f5805af0ddfc103`.

```ts
import { Brand, Schema } from "@bedform/effect";

type Positive = Brand.Branded<number, "Positive">;
const Positive = Brand.make<Positive>(value => value > 0 || "must be positive");
const value: Positive = Positive(1);
const schema = Schema.Number.pipe(Schema.fromBrand("Positive", Positive));
```

Run `npm run verify:brand --workspace @bedform/effect` for source/tools checks,
focused lint, full declaration/runtime parity, constructor differentials,
Schema integration, isolated packed consumers and restricted-host execution,
followed by the Schema regression suite. BDS compatibility remains unverified.

The complete `Match` module and `internal/matcher.ts` are vendored from the same
pinned release, tracked by `MineCraft-isg.17`. Public declarations preserve all
constructors, ordered and logical patterns, discriminator/tag combinators,
primitive and instance patterns, return constraints, finalizers and type helpers.
The private interpreter retains the original algorithms, including immediate
versus reusable matching, prefix-array patterns, inherited object properties,
own-handler lookup, short-circuit order and selector argument forwarding.
It requires no Effect executor or host-specific APIs.

The nominal variance objects in `TypeMatcher` and `ValueMatcher` are extracted
into their merged namespace interfaces as required by repository conventions.
The private error-message constant uses PascalCase, and its matcher protocol
constant uses `as const`. No runtime semantics are changed. Documentation uses
the port package name and version `1.0.0` while preserving the upstream MIT notice.
The pinned source SHA-256 values are:

- `src/Match.ts`: `6d5fd74e9834feb6be0de7f5274c15adbba70d6eb4107408a4eb5200de475239`
- `src/internal/matcher.ts`: `911614c28282b6ff665521df4b2c5b0360ae37a3c4bff5610d553eac3b6285f7`

```ts
import { Match } from "@bedform/effect";

type Command = { _tag: "Start"; speed: number } | { _tag: "Stop" };
const handle = Match.type<Command>().pipe(Match.tagsExhaustive({
    Start: command => `speed:${command.speed}`,
    Stop: () => "stopped"
}));
handle({ _tag: "Start", speed: 2 });
```

Run `npm run verify:match --workspace @bedform/effect` for source/tools typechecks,
focused lint, runtime export parity, full declaration parity after expanding the
variance interfaces, full private typed-source parity and emitted implementation
parity. Behavioral and
consumer fixtures cover inference, exhaustive/partial patterns, generic immediate
matchers, selector arguments, errors, packed root/direct imports, private-path
rejection, tree-shaking and execution without Web text/URL globals. Function,
Data and Brand regressions also run. BDS compatibility remains unverified.

The `Unit` module vendors the npm release `effect-units@1.0.1` from
https://www.npmjs.com/package/effect-units/v/1.0.1, maintained at
https://github.com/rjdellecese/effect-units and tracked by `MineCraft-isg.19`.
Its BSD-3-Clause license appears in `Unit.License.md`; the package license is
therefore `MIT AND BSD-3-Clause`. Every file under `Source/Unit`, along with
`Source/Unit.ts`, `Source/BigRational.ts`, `Source/Rational.ts` and
`Source/Internal/valueObject.ts`, carries the BSD-3-Clause `@license` tag. The tarball integrity is
`sha512-qYU+dlplCkNkHSHcNUsvxUpSaaJQj0iEt6wTEXxwNL4oylvC6RJn/mTrv5XiBS8e1uDrNsynMa5ftaSpKqjGvQ==`.
The sources were taken from a checkout whose `src` matches that release apart
from formatting.

Each public effect-units float module is a namespace of `@bedform/effect/Unit` and
of the root `Unit` export, for example `Unit.Length` and `Unit.Unit`; the private
`internal` helpers have no public path.

`Source/Unit/Meter.ts` (`Unit.Meter`, tracked by `MineCraft-8rve.1`) is original
to @bedform/effect and has no effect-units counterpart. It carries the
BSD-3-Clause tag only because it lives in the `Unit` tree, and it is the one
Unit module with its own public subpath, `@bedform/effect/Unit/Meter`.

The port departs from effect-units in how it handles exact values (tracked by
`MineCraft-ohgs`):

- Each `Exact` module is merged into its float module. A merged function tests
  for a `number` argument first and keeps the upstream float expression, so
  float results are bit-identical. Otherwise it takes the upstream exact
  expression, dispatching in `Source/Unit/Internal/numeric.ts` on `Rational`,
  `bigint`, `BigRational` and `BigDecimal`, in that order.
- `QuantityExact`'s operations, along with its `Unsafe` variants and its
  conversions between kinds, are merged into `Quantity` the same way.
- `Rational` became the top-level `@bedform/effect/BigRational`, renamed
  throughout (`isBigRational`, `BigRationalFromString`, and the
  `@bedform/effect/BigRational` type identifier). The prefix factors of
  `internal/prefixExact.ts` moved into `Prefix`.
- `Source/Rational.ts` is a new module derived from it, with `Int` numerators
  and denominators. Upstream was developed against Effect
4.1.2; its `effect/*` imports resolve here to the local 4.0.5 port, which provides
every API it uses except the adaptations below. Algorithms, wire formats, issue
messages, type identifiers (`Symbol.for("effect-units/...")`) and public names are
unchanged.

- The canonical string codecs `BigRational.BigRationalFromString` and
  `Unit.UnitFromString` use `SchemaGetter.transformResult` with `Result.fail` and
  `Result.succeed` instead of `transformEffect` with `Effect`, as the synchronous
  Schema subset requires.
- `Duration.between`, `Duration.addTo`, `DurationExact.between` and
  `DurationExact.addTo` are omitted, because `DateTime` is excluded from this port.
  `fromDuration`, `fromDurationBigRational` (formerly `DurationExact.fromDuration`)
  and `toDuration` interoperate with `@bedform/effect/Duration`.
- `Quantity.arbitraryOnGrid`, its `ArbitraryOnGridOptions` interface and the
  `toCodecArbitrary` annotation on `BigRational.BigRational` are omitted, because
  arbitrary generation and that annotation hook are excluded.

Upstream formatting was converted to repository style, and imports use `.js`
specifiers. Exported declarations without upstream documentation gained TSDoc
comments derived from their signatures, and every exported comment ends with
`@category` and `@since 1.0.0`. The upstream description of
`BigRational.fromNumberUnsafe`, which sat above a private helper, now documents that
function. File-level lint exceptions preserve upstream type-parameter names,
contextual typing and property order.

Run `npm run verify:unit --workspace @bedform/effect` for source and tool
typechecks, focused lint, and `Test/Unit.test.mts`, followed by the Schema
regression suite. The Unit tests cover the public facade, mixed numeric kinds,
Result-based codecs, nested JSON codec derivation, float and exact constant
agreement, private-path rejection and execution without Node or Web globals.
BDS compatibility remains unverified.

The November 10, 2026 runtime scope extension, tracked by `MineCraft-isg.21` and
described in `Plan/EffectBedrock_Runtime_Plan.md`, vendors the Effect runtime from the
same pinned release. Its public modules are `Cause`, `Clock`, `Console`, `Context`,
`Cron`, `Deferred`, `Effect`, `Effectable`, `ErrorReporter`, `ExecutionPlan`, `Exit`,
`Fiber`, `Filter`, `Latch`, `Layer`, `LogLevel`, `ManagedRuntime`, `Metric`,
`MutableHashMap`, `MutableRef`, `Pull`, `Random`, `Redactable`, `Ref`, `References`,
`Request`, `Schedule`, `Scheduler`, `Scope`, `Tracer` and `TxRef`, with the private
`internal/core`, `effect`, `layer`, `schedule`, `references`, `tracer`, `request`,
`executionPlan`, `metric`, `random` and `dateTime` implementations. `Console`,
`Latch`, `LogLevel`, `Random`, `ErrorReporter` and `TxRef` are complete modules
whose runtime already lives in those internals; the runtime's declarations need
their types. `internal/dateTime` serves `Cron` only; `DateTime` remains unexported.

`Logger`, `RequestResolver`, `DateTime`, `Stream` and `Channel` are referenced by the
runtime's declarations only. Their needed declarations are extracted verbatim into
the private `internal/logger-types`, `requestResolver-types`, `dateTime-types`,
`stream-types` and `channel-types` modules, whose type identifiers are ambient
declarations with no runtime value. Those public modules are not ported; `Logger`
depends on the permanently excluded `FileSystem`.

`internal/core` is now the single home of the Effect protocol, Cause and Exit
primitives and the yieldable errors. The earlier private extractions
`internal/data`, `internal/data-types`, `internal/inspection`, `internal/filter` and
`internal/redactable` are removed. `Data`, `Option`, `Result`, `Redacted`, `Chunk`,
`Formatter`, `Inspectable` and `Schema` import `internal/core`, `Cause`, `Filter` and
`Redactable` exactly as upstream does. `Data`, `Option` and `Schema` still pull in no
part of the executor, and `Data.TaggedError` values fail directly into the ported
fibers. `Redactable` restores upstream's lookup of the current fiber's context
through `globalThis["~effect/Fiber/currentFiber"]`, which the fiber runtime sets and
restores while it runs. It is upstream behavior and is local to each pack's script
context.

Host globals are read through the private `internal/host` view, and nothing is
installed on the global object:

- `Clock.sleep` uses `setTimeout` when the host has it. Otherwise it fails with a
  defect that names `Bedrock.layer(system)`, instead of upstream's `ReferenceError`.
- The default `Scheduler` reads `setImmediate`, `setTimeout` and their clear
  functions through the host view. Without them it keeps upstream's microtask
  fallback. Its two `@ts-ignore` lookups are replaced by typed reads.
- `Effect.callback` with a signal, `Effect.tryPromise` and `Effect.abortSignal` use
  the host's `AbortController` when present, and otherwise the private
  `internal/abort` fallback. Public declarations name a structural `AbortSignal`
  from `internal/abort` instead of the DOM global; standard signals satisfy it.
- The default `Random` seed uses `crypto.getRandomValues` when present, and
  otherwise `Math.random`. `Random`'s string seeds use `internal/utf8` instead of
  constructing a `TextEncoder` at module load.
- The monotonic clock reads `performance` through the host view. The default
  `Console` reads `globalThis.console` the same way.
- `Effect.ts` and `ManagedRuntime.ts` carry a preserved
  `/// <reference lib="esnext.disposable" />` because upstream signatures use the
  disposable types. Consumers on the workspace's TypeScript 5.5 therefore need no
  extra `lib` setting. The package compiler now sets `lib` to `ES2022` and
  `ESNext.Disposable` without DOM, so any unguarded host global fails to compile.

The vendoring keeps upstream algorithms, overloads and names. Headers, `.js`
specifiers, `@since 1.0.0`, PascalCase private constants (`MaxTimerMillis`) and
generic descriptions and `@category Utilities` on tag-only upstream comments
follow the earlier ports. Twelve inline property object types are extracted into
same-named namespaces:

- `Context.TypeId`;
- `Cron.First`, `Last`, `Next` and `Prev`;
- `Deferred.Variance.TypeId`;
- `Effect.IgnoreSymbol`;
- `Layer`'s `Variance.TypeId` and `Any.TypeId`;
- `Ref.Variance.TypeId`;
- `Request`'s `Variance.TypeId`;
- `RequestResolver.Variance.TypeId`.

Lint exceptions are file-local and limited to rules that would change upstream
layout, generics or signatures. The emitted declarations keep upstream's
`@internal` members, which upstream strips with `stripInternal`.

The port-specific `Bedrock` module provides:

- a structural `TickSystem`;
- `ticks`;
- a budgeted `MixedScheduler` (`makeScheduler`) and a tick `Clock` (`makeClock`);
- `TickSystemService`, `layer`, `nextTick` and `disposeOnShutdown`.

The add-on passes `system` in; the library imports no Minecraft API.

Run `npm run verify:runtime --workspace @bedform/effect`. It covers:

- the source and tool typechecks and focused lint;
- `Test/Runtime.test.mts`, which checks runtime-export and declaration parity for
  every runtime module and differential behavior against upstream;
- `Test/Bedrock.test.mts`, which runs programs in a sandbox with only ECMAScript
  built-ins on a simulated tick loop, audits the emitted JavaScript for
  unguarded host globals, and checks packed consumers against `@minecraft/server`
  and tree-shaking;
- the Data, Schema, Match and collections regressions.

`npm run test:bds --workspace @bedform/effect` runs the fixture add-on
`Tool/BdsFixture` on BDS at the fixed `dist/bds-runtime/bedrock_server.exe`.
It passed on BDS 1.26.60.6 (`MineCraft-isg.21.5`) and 1.26.63.1; see `RUNTIME.md`.

The pinned source SHA-256 values are:

- `src/Cause.ts`: `b6d524696c3dff82613634df6b562385b547194c3c8cbec191ea4416283f6f81`
- `src/Clock.ts`: `01032c918731e5703385587a47277cc7d319c521e528918b6fba915aa0a45698`
- `src/Console.ts`: `a9b151b8ee83e1d24d2bb0c3624b4d84d2e2026aed26999ba2a484d3aad35f0b`
- `src/Context.ts`: `b87badfe006cc1a7202b217e73321bc2f03a6ba04ac70eb959c680ab34d190e4`
- `src/Cron.ts`: `daa4728b99383ada0fd8210db8f132990858e662055ad8c52eaf9fa6f2a3c8d9`
- `src/Deferred.ts`: `da8edb7ac9a0d7ee145656d9003a17fd9b7a1a2bc2e61af48ea403335c95672f`
- `src/Effect.ts`: `4d46ff7a5a852a4c724848be9ee83920b08586a5578ec58165a5f188be1f5386`
- `src/Effectable.ts`: `78850b67ad526ae6e65939027d5f92c29bd1bf2d4f3b075bbf2eb12e48dea30c`
- `src/ErrorReporter.ts`: `b922e953e0611ca3b40835ebad9c7f3152e6c576ebc65d14ff0f20ad006b143f`
- `src/ExecutionPlan.ts`: `256c29e1c6c51f20256fb05cb3ebb89e93261e3a976f31506975675f7854b754`
- `src/Exit.ts`: `04591894e71445710498435b2c73ec34c45df79e36094efe3b43361f2d8b246b`
- `src/Fiber.ts`: `4454a7ce05a176315ad0579d349ac3721b22e7d25ebcd14d6583e0ab2d501c71`
- `src/Filter.ts`: `9dd0629a29315bfbf4f47b72e18c0719a8bba8396cf3511c1e1b85c81e4c7f52`
- `src/Latch.ts`: `ba440b708e551547d0c986108a6424aa92d7c07edf1a6fb1c0efaa077c79a8cb`
- `src/Layer.ts`: `7bab77f7856661fe6abac1575d8e71d69167d9b0f07f2eb1470d97a26a828a90`
- `src/LogLevel.ts`: `61faeaa93dd4e62451d2e089c74716640ed408be874f21be55f875aa446f20f6`
- `src/ManagedRuntime.ts`: `a995ed09821d7d3fa4dd953a9e2dc76f354c8c88fe5f7df7f848c83bbd96586b`
- `src/Metric.ts`: `3b3a0e5f71e3758aae88eff782a90b27e0a4a9f53194189500bc2aa4c22e6aa4`
- `src/MutableHashMap.ts`: `d6e9ff00e9e35d73e0ca35cc7ba519a0dc3e546c1cd52db1ccbe3d77a722e999`
- `src/MutableRef.ts`: `e68860d40fa40808c1d92c8dcf235725c50cac029d0b82b87b47613847610adf`
- `src/Pull.ts`: `f863ce08f96896c1c3f957b72a46700eea1d665bffded58a49ecb6cd17b38423`
- `src/Random.ts`: `76a76f69e0d1b99ba25f85619d8bacaa976e2c69e1f6657a51e99054cb1822f9`
- `src/Redactable.ts`: `9c8d6e9f10ba03c16fe4247eeddf656373ad80cd63ea0581697e5137f192478a`
- `src/Ref.ts`: `5c544a85d8d99a92adb60db73e345324b4c303dc850577cc87e06f219c7f7f7e`
- `src/References.ts`: `7368c958598e2778f600c0d5a28fb2e5bf251a81439f26cabffbb950c7cb6571`
- `src/Request.ts`: `d683ae8badb3b8193db689043f8b0e4198a845e0258cf5569328bcfe2dc5449d`
- `src/Schedule.ts`: `3ef42da2c031d4899d1d780386a7570b8b514295d46dff40caf128d5e210e68a`
- `src/Scheduler.ts`: `7dcb21648d54e521afd7a22334a8aa7693a8ad1069d726d7b8f1da65504bc199`
- `src/Scope.ts`: `8eea1f8af6d390d1305e8428025e0fb95a1c34896729c4115ecce91597cba39d`
- `src/Tracer.ts`: `3f12af934160ddccb3a3b53be928f39805013532e7ec11ff2d5518f6bb2d2b76`
- `src/TxRef.ts`: `62375130d8365ca7501c4462511acb603e42fcc2c43198d49e5c4dfd396fdcbe`
- `src/internal/core.ts`: `6ce33b6d0106a49a358e7fb8d3409d27cc9c75336bb5e526b1b30ab640363125`
- `src/internal/dateTime.ts`: `b202fd1c02edeec9b4d11dee7398bf5994a37bec529553e485566e9395133924`
- `src/internal/effect.ts`: `29200eee28c991b77b9f62317831332d4330179d8ab654fec8dea4472732d0af`
- `src/internal/executionPlan.ts`: `b4ff06d0e5825f4cae67ff801b2c4dbfbce0c99f3cc64e0b022be4cd75a01498`
- `src/internal/layer.ts`: `6ad3c8e779bae54dc0b3e57cd99fcd2087354df0c673d6335619d5cd95a74187`
- `src/internal/metric.ts`: `d487aac1cec03520cef8ca3c8327c189bf4ad78148d3cb932bf647e85ee40e54`
- `src/internal/random.ts`: `dbd0721edf26a2c02abe5d24dcaa52a930355f40a7ceffb485c6f032dba20acb`
- `src/internal/references.ts`: `5e948c38858d152ad2286faeccea8c86cd030439ef204d27671cd6be69624fa9`
- `src/internal/request.ts`: `d83de809052c3083d3dfe937c54621b9a8dcfa3ad669598ce39247576d9ca286`
- `src/internal/schedule.ts`: `32576111b0416e5d0ae9964afd0c13594aac0f9ac1d4ebf616d86b8fa4f1f9e2`
- `src/internal/tracer.ts`: `b49f635dfb930f109df57b0281c51e05109cd355738d2707cb54e885224d92f2`
- `src/DateTime.ts` (type extraction): `7a6a06aa4088f12977ed097f0eb62b116db8b07eb50c7012271486cec5aa6f5b`
- `src/Logger.ts` (type extraction): `b2b8aa170d6617024ef0a551558f96074170448123bec36d69ea3d73f2cd2c8d`
- `src/RequestResolver.ts` (type extraction): `62daa954d8fc2c2720d66e491d117afa8921a9de64557a1de7d618388d24c810`
- `src/Stream.ts` (type extraction): `ae67d88dac521aa1ca6be52fea98ced97a339b567072a5a1e7ace8c36245bb8c`
- `src/Channel.ts` (type extraction): `9c940537b44d82f4ab6f1a317b25536d10153ce7e11aaf99d06d1ecdb11fd700`
