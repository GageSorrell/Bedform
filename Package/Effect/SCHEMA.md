# Synchronous Schema subset

The approved scope is Beads epic `MineCraft-isg.15`, based on `effect@4.0.5`.
This is an explicit exception to the initial complete-public-module policy.
Package version remains `1.0.0`.

The synchronous subset is available through root namespaces and direct imports
for `Schema`, `SchemaAST`, `SchemaIssue`, `SchemaParser`, `SchemaGetter`,
`SchemaTransformation`, `StandardSchema` and `JsonSchema`. The pure data modules
used by these schemas also have root and direct exports.

The interpreter executes directly with `Result<Value, SchemaIssue.Issue>`.
There is no Effect executor, fiber, scheduler, service lookup, or asynchronous
fallback. Service requirements are constrained to `never`. Ordinary synchronous,
Result and Option adapters propagate unexpected callback exceptions unchanged.
Standard Schema validation catches those exceptions and reports standard issues.
Schema adapters report `SchemaError`; lower-level SchemaParser adapters report
`SchemaIssue.Issue`.

The subset includes primitives, literals, enums, template literals, structs,
records, arrays, tuples and rest elements, unions, recursion, optional and mutable
fields, annotations, brands, checks, declarations, defaults and transformations.
It includes Date, RegExp, Map, Set, Error, Uint8Array, JSON codecs, Option, Result,
Chunk, HashMap, HashSet, BigDecimal, ByteSize, Duration and Redacted schemas.
Schema classes and errors reuse Data and its inherited protocols.

Upstream names are preserved for `declareConstructor` and default combinators.
Effect-valued arguments become lazy Result callbacks, preserving their upstream
failure types. Defaults run only when the relevant input is absent. Getters run
synchronously and return Result; fallible constructors are named
`transformResult`, `transformOptionalResult`, and `checkResult`.

| API | Approved callback result |
| --- | --- |
| `Schema.declareConstructor` decoder | `Result<T, SchemaIssue.Issue>` |
| `Schema.withConstructorDefault` | `() => Result<S["~type.make.in"], SchemaIssue.Issue>` |
| `Schema.withDecodingDefaultKey` / `withDecodingDefault` | `() => Result<S["Encoded"], SchemaError>` |
| `Schema.withDecodingDefaultTypeKey` / `withDecodingDefaultType` | `() => Result<S["Type"], SchemaError>` |
| `SchemaGetter.withDefault` | `() => Result<T, SchemaIssue.Issue>` |
| `SchemaGetter.transformResult` | `Result<T, SchemaIssue.Issue>` |
| `SchemaGetter.transformOptionalResult` | `Result<Option<T>, SchemaIssue.Issue>` |
| `SchemaGetter.checkResult` | `Result<undefined \| boolean \| Schema.FilterIssue, never>` |

Getter transformations receive parse options, and optional getters distinguish
missing keys from present `undefined` values. Result-based transformation
constructors accept separate decoding and encoding callbacks. Callback results
must be validated; malformed results are defects, not validation mismatches.
Constructor defaults apply only during construction; decoding defaults retain
their encoded/type-side distinctions and upstream omission strategies.

Schema Result adapters report `SchemaError`. Lower-level SchemaParser Result
adapters report `SchemaIssue.Issue`; its throwing adapters use a native Error
with the issue in `cause`, while Schema throwing adapters throw SchemaError.
Option adapters discard validation failures only, preserving thrown defects.

Formatting, equivalence, Standard Schema validation, Draft 2020-12 document
generation, Draft-07 output and Standard JSON Schema input/output adapters are
included. Recursive local references must work without URL APIs. External
references and resource identifiers needing URI resolution are rejected.
Private UTF-8 codecs replace Web text APIs without modifying global objects.

Excluded APIs include Effect/Exit/Promise adapters, services, concurrency,
`makeEffect`, runtime middleware and context recovery, platform/network schemas,
DateTime and time zones, Graph, optics, differs, XML, arbitrary generation,
compiler/JIT integration, schema importing, general representation tooling,
OpenAPI conversion and external URI resolution. Unsupported methods and
annotation hooks must be absent at runtime and in declarations.

`SchemaCompatibility.json` records the upstream export and member inventory and
the retained/adapted/omitted surface. Acceptance checks both upstream inventory
coverage and the implemented declarations/runtime, including renamed constants,
namespace-extracted property types, aliases and absent annotation hooks.
Beads tracks implementation and acceptance evidence.

```ts
import { Result, Schema, SchemaGetter } from "@bedform/effect";

const Person = Schema.Struct({
    name: Schema.String,
    age: Schema.NumberFromString.pipe(
        Schema.withDecodingDefaultKey(() => Result.succeed("18"))
    )
});
Schema.decodeUnknownSync(Person)({ name: "Alex" }); // { name: "Alex", age: 18 }
Schema.encodeSync(Person)({ name: "Alex", age: 18 }); // { name: "Alex", age: "18" }

const Rounded = Schema.Number.pipe(Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform(Math.round),
    encode: SchemaGetter.passthrough()
}));

class Player extends Schema.Class<Player>("Player")({ name: Schema.String }) {}
const player = Schema.decodeUnknownSync(Player)({ name: "Alex" });

const json = Schema.fromJsonString(Person);
Schema.decodeUnknownSync(json)('{"name":"Alex"}');

const document = Schema.toJsonSchemaDocument(Person);
const standard = Schema.toStandardJSONSchemaV1(Schema.toStandardSchemaV1(Person));
standard["~standard"].jsonSchema.input({ target: "draft-07" });
standard["~standard"].jsonSchema.output({ target: "draft-2020-12" });
```

Use `JsonSchema.toDocumentDraft07(document)` for document-level conversion.
Result-returning custom codecs use `SchemaGetter.transformResult` or
`SchemaTransformation.transformResult` with lazy defaults as shown above.
Unexpected callback exceptions propagate through ordinary adapters; only
Standard Schema converts them into validation messages.

Run `npm run verify:schema --workspace @bedform/effect` for source/tools typechecks,
the Schema host and packed-consumer tests, focused lint and Function/Data
regressions. `test:schema:foundation` remains available for dependency-only checks.

Acceptance is host/type/package verification, including differential fixtures,
restricted-host execution, packed consumers and Function/Data regressions.
Live BDS testing is explicitly deferred; host results do not establish BDS
compatibility. No addon migration, publication, commit, push or remote Dolt sync
is part of this epic.
