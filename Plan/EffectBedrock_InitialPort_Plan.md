# Create `effect-bedrock`

Use only `MAJOR.MINOR.PATCH` in symbol-level `@since` tags. Prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`, or any other prerelease identifier) and build metadata (`+...`) must never appear in `@since` tags; for example, package version `1.0.0-alpha.1` uses `@since 1.0.0`.

Module TSDoc headers must not contain `@category` or `@since`; these tags apply only to symbol documentation. Follow the repository's TypeScript module header format for file-level metadata.

Approved initial-port design, recorded October 28, 2026.

Scope update, October 29, 2026: the user requested the complete `Data` module
in addition to the original 51 modules. This includes its yieldable error
constructors, supported by private failure-protocol and type extractions;
it does not add an Effect executor, scheduler or fiber runtime. The work is
tracked by `MineCraft-isg.14`.

Scope update, October 29, 2026: `MineCraft-isg.15` adds the synchronous Schema
subset described in `Package/Effect/SCHEMA.md` and its checked compatibility
manifest. This explicitly permits partial Schema companion modules, Result-based
callbacks and private document conversion machinery. It includes local-reference
JSON Schema generation without URL APIs. It adds no Effect executor or services.
The Schema epic has host/type/package acceptance only; live BDS testing is
deferred by explicit user choice and remains separate from those results.

Beads epic: `MineCraft-isg` — Create effect-bedrock initial BDS port from Effect 4.0.5.

Scope update, October 29, 2026: the user requested the complete `Brand` module
(`MineCraft-isg.16`). It reuses the synchronous Schema checks and issue formatting
added above, preserving all upstream constructors and nominal type helpers.
It introduces no Effect executor or runtime dependency. Host/type/package checks
are recorded independently of the broader BDS acceptance work.

Scope update, November 10, 2026: `MineCraft-isg.21` adds the Effect runtime (Effect,
Exit, Cause, Context, Layer, Scope, fibers, Clock, Scheduler, Schedule and their
dependency closure, plus Fiber, ManagedRuntime, Ref and MutableRef) and a Bedrock
tick-service module that receives `system` by injection. See
[EffectBedrock_Runtime_Plan.md](EffectBedrock_Runtime_Plan.md).

This document records the approved design and its work breakdown. Beads is authoritative for task status, ownership, dependencies, blockers, and implementation evidence; the table below is an issue map, not a separate status tracker.

## Summary

Replace the empty scaffold in `Package/Effect` with a self-contained port of `effect@4.0.5`, initially targeting **BDS 1.26.60.6 only**. Preserve complete public modules, their types, and their implementations wherever small internal extractions make that possible.

## Package and public API

- Rename the package to `effect-bedrock`; retain version `1.0.0`.
- Provide ESM JavaScript, TypeScript declarations, source maps, and explicit package exports.
- Support namespace imports from the root and direct imports such as `effect-bedrock/Option`. Preserve upstream root-level Function exports.
- Include these 51 top-level modules:

  `Array`, `BigDecimal`, `BigInt`, `Boolean`, `ByteSize`, `Chunk`, `Combiner`, `Differ`, `Duration`, `Equal`, `Equivalence`, `Formatter`, `Function`, `Hash`, `HashMap`, `HashRing`, `HashSet`, `HKT`, `Inspectable`, `Iterable`, `JsonPatch`, `JsonPointer`, `Match`, `MutableHashMap`, `MutableHashSet`, `MutableList`, `MutableRef`, `NonEmptyIterable`, `Number`, `Option`, `Order`, `Ordering`, `Pipeable`, `Predicate`, `PrimaryKey`, `Record`, `Redacted`, `Reducer`, `RegExp`, `Result`, `StandardSchema`, `String`, `Struct`, `Symbol`, `Trie`, `Tuple`, `Types`, `UndefinedOr`, `Unify`, `Utils`, `Version`.

- Expose complete `Ini`, `Toml`, and `Yaml` modules through `effect-bedrock/encoding` and their direct subpaths.
- Keep internal modules inaccessible through package exports. Do not provide placeholders for excluded modules.

## Implementation

- Vendor sources from the pinned upstream release. Preserve algorithms, overloads, data representations, protocol symbols, mutation behavior, and error behavior.
- Extract small private dependencies where necessary: inspection prototypes, the pure Filter signature, branded types, JSON value types, and stack-trace typing.
- Retain private formatting/redaction support with upstream behavior in the absence of a fiber; introduce no Effect runtime services.
- Defer mixed public modules, including `Filter`, `Context`, `Redactable`, `Graph`, and `Optic`. `Data`, `Brand`, and the synchronous Schema/JSON Schema subset are included by the October 29 scope updates above.
- Exclude `Effect`, fibers, clocks, schedulers, and associated runtime implementations. Permanently exclude `FileSystem` and `Path`. Superseded for the runtime by the November 10, 2026 scope update in [EffectBedrock_Runtime_Plan.md](EffectBedrock_Runtime_Plan.md) (`MineCraft-isg.21`); `FileSystem` and `Path` remain permanently excluded.
- Require no runtime npm dependencies, Minecraft API imports, host globals, or installed polyfills. Use upstream Effect only as a pinned development dependency.
- Build ES2022 ESM into `Distribution` using package-local TypeScript `6.0.3`; keep host-only tooling separate.
- Preserve upstream licenses and third-party notices, record source provenance and adaptations, and normalize TSDoc to repository conventions.
- Document exports, exclusions, bundling into behavior packs, native string locale limitations, and the BDS-only compatibility claim. Preserve upstream `Version`'s default value of `4.0.5`.

The host-API restriction applies to the shipped library and consumer bundle. Development tooling and test runners may use Node APIs; the disposable fixture add-on may use Minecraft APIs needed to execute its assertions. Neither becomes a runtime dependency of `effect-bedrock`.

Every symbol flagged by `jsdoc/require-jsdoc` must have TSDoc. Describe parameters and return behavior in prose without `@param` or `@returns`; write thrown types as `@throws { Error }`. End each TSDoc comment with a blank line, an appropriate `@category`, and `@since 1.0.0`. Preserve upstream source-version provenance separately from the port's documentation version.

## Validation

- Add build, typecheck, lint, host-test, package-verification, and BDS-test commands.
- Compare runtime exports and TypeScript public signatures against upstream for every included module.
- Run differential behavior tests covering generators, overloads, collections, equality/hashing, numeric boundaries, Unicode, JSON patches, redaction, parser failures, and mutation guarantees.
- Audit source, emitted JavaScript, declarations, and consumer bundles for excluded dependencies and unsupported host APIs.
- Verify root and direct imports from a packed consumer, including tree-shaking.
- Add a disposable fixture add-on that imports every runtime module and exercises representative operations on BDS 1.26.60.6. Validate bundled and unbundled ESM loading.
- Use the fixed `Package/Effect/dist/bds-runtime/bedrock_server.exe`, a runtime lock, isolated worlds, retained logs, and bounded execution. Extend the existing firewall setup and documentation; ordinary tests must never elevate. Report unavailable prerequisites as unrun validation.

Missing prerequisites, timeouts, missing success markers, wrong engine versions, and script/content errors must not count as passing BDS evidence. Required BDS validation remains outstanding until both fixture modes pass against the final candidate. Do not modify the source server installation or its worlds during fixture execution.

## Beads work breakdown

Each issue contains its implementation scope and acceptance criteria. Dependencies below are blocking edges in Beads, in addition to every task's parent relationship with `MineCraft-isg`.

| Issue | Deliverable | Depends on |
| --- | --- | --- |
| `MineCraft-isg.1` | Record this approved plan and create the dependency-linked Beads breakdown. | None |
| `MineCraft-isg.2` | Establish package identity, pinned toolchain, separate compiler contexts, upstream provenance, and required license notices. | `MineCraft-isg.1` |
| `MineCraft-isg.3` | Port all 51 complete core modules, extract pure private dependencies, preserve upstream semantics, and normalize TSDoc. | `MineCraft-isg.2` |
| `MineCraft-isg.4` | Port complete INI, TOML, and YAML parsers with their behavior, limitations, and third-party notices. | `MineCraft-isg.2` |
| `MineCraft-isg.5` | Implement root/direct exports, the encoding barrel, private-path restrictions, distribution builds, declarations, source maps, and build/typecheck/lint commands. | `MineCraft-isg.3`, `MineCraft-isg.4` |
| `MineCraft-isg.6` | Verify runtime and TypeScript API parity for every module and differential behavior across the required scenarios. | `MineCraft-isg.5` |
| `MineCraft-isg.7` | Audit source and artifact dependencies; verify isolated packed consumers, declaration resolution, private-path rejection, and tree-shaking. | `MineCraft-isg.5` |
| `MineCraft-isg.8` | Add bundled/unbundled BDS fixture modes, an isolated fixed-path runner, locks, retained evidence, and explicit firewall integration. | `MineCraft-isg.5` |
| `MineCraft-isg.9` | Document consumption, compatibility limits, exclusions, verification commands, provenance, adaptations, and licenses. | `MineCraft-isg.5`, `MineCraft-isg.8` |
| `MineCraft-isg.10` | Run final host/package/BDS acceptance, record exact evidence and outstanding validation, and hand off the scoped changes. | `MineCraft-isg.6`, `MineCraft-isg.7`, `MineCraft-isg.8`, `MineCraft-isg.9` |

The core port is grouped into one issue because its foundational utilities, collections, Option/Result implementations, equality, and hashing have shared and cyclic dependencies. Porting those together avoids inventing an incomplete intermediate public API. The parser port can proceed independently after package setup. API tests, packaging audits, and BDS infrastructure become independently actionable after public exports and builds are available.

## Workflow and defaults

- Create and claim the applicable Beads issue before implementation. Close an issue only when its acceptance criteria are met, and keep remaining work in Beads.
- Leave existing add-on consumers and unrelated work unchanged.
- Do not publish, commit, push, or synchronize remote Beads data.
- BDS 1.26.60.6 is the sole initial compatibility target. Hosted-world and experimental client-script compatibility are outside this initial port.
- The initial public scope is the 51 approved top-level modules plus the three parsers. Other platform-focused subpackages are deferred.
- Complete public modules and small private extractions are allowed; partial public modules, compatibility stubs, and polyfills are not.
- The package version is `1.0.0`; the preserved upstream baseline and `Version` default are `4.0.5`.
- At handoff, report changed files, validation results, issue status, and any unavailable prerequisites. Documentation or host-test completion alone does not establish BDS compatibility.
