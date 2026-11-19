# Bedform sidecar Workflows (`bedform/Workflow`)

Use only `MAJOR.MINOR.PATCH` in symbol-level `@since` tags. Prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`, or any other prerelease identifier) and build metadata (`+...`) must never appear in `@since` tags; for example, package version `1.0.0-alpha.1` uses `@since 1.0.0`.

Module TSDoc headers must not contain `@category` or `@since`; these tags apply only to symbol documentation. Follow the repository's TypeScript module header format for file-level metadata.

## Summary

Bedrock's QuickJS script runtime has no wall-clock timers and can't run durable, long, CPU-heavy, or I/O-heavy work. It also has no persistent SQL, no general HTTP with binary data, no image processing, and no AI access. This plan adds a NodeJS **sidecar** that BDS add-ons drive through a new `bedform/Workflow` module. Add-ons define `Task`s and `Workflow`s in TypeScript. Their *instructions* reach the sidecar once and are cached; later calls send only arguments. The sidecar then runs them as one-offs, timers, schedules, or durable workflows, inside resource limits set by the server administrator.

The sidecar exists only on paper so far. It is planned as `Application/BedformSettings/CLI` in `Plan/Bedform_Settings_Plan.md` (epic `MineCraft-ikm`, all open, SQLite). Decisions:

- **One unified sidecar.** `Application/BedformSidecar` hosts both Settings and Workflow on one embedded Postgres. It replaces the planned SQLite and retargets `MineCraft-ikm.3`.
- **Direct HTTP for each add-on.** Each consumer add-on calls the sidecar over `@minecraft/server-net`. It sends a per-add-on token from BDS `config/<script-module-uuid>/secrets.json`, so its identity can't be forged and its results stay private. WorldRealism already uses server-net and server-admin this way.
- **Timer results follow each original.** `setTimeout`, `setInterval` and `setImmediate` return handles and discard results. `scheduler.postTask` and the `timers/promises` equivalents resolve with, or yield, values exactly as their originals do.
- **AI providers:** Claude and OpenAI.

Key design decision: *instructions* are a **typed, serializable expression IR**. Add-ons build it with `bedform/Workflow` builders that mirror effect-bedrock modules. The sidecar interprets it. Arbitrary JS is never shipped or `eval`ed. This makes definitions hashable and cacheable. It also makes them safe to run, meterable for the resource governor, and deterministic for durable replay.

## Architecture

```
Add-on (QuickJS)                               Sidecar (Node 24, Effect 4.0.5)
bedform/Workflow builders ──► IR + hash        @bedform/sidecar  (exe: bedform-sidecar)
bedform/Workflow/Bedrock  ──HTTP JSON RPC──►   RpcServer (127.0.0.1:19133/rpc/workflow) + token auth middleware
  (server-net + server-admin secret header)    ├─ Definition cache (system DB, by content hash)
  ◄── long-poll events (timers, results) ──    ├─ Interpreter: orchestration on main; pure segments → compute worker pool (RpcWorker)
                                               ├─ Durable engine: effect/workflow + effect/cluster SingleRunner + ClusterWorkflowEngine
                                               ├─ Scheduler (timers, schedules, cron via effect/Cron)
                                               ├─ Storage: system PGlite (main) · add-on PGlite (storage worker, role per add-on)
                                               ├─ Services: Settings · Crypto · Http/File · Numeric · Image · Path · Ai
                                               └─ Resource governor (CPU/RAM % bounds, priorities)
```

| Location | Contents |
|---|---|
| `Package/Bedform/Source/Workflow/` | `index.ts` (`Task`, `Workflow`, `Expr`, `Progress`, `Schedule`, `Timers`, `Scheduler`), `Protocol.ts` (the shared contract: IR, Wire codec, PortableSchema, RPC payloads, errors, descriptor schema and contract keys), generated mirrors (`Array.ts`, `Record.ts`, …), domain modules (`Storage`, `Settings`, `Crypto`, `Http`, `File`, `Numeric`, `Image`, `Path`, `Ai`), and `Bedrock.ts` (runtime client, the only file importing `@minecraft/*`) |
| `Package/Bedform/Tool/workflow-mirror.mts` | Generator for the mirror modules, the op registry and the exclusion report |
| `Package/Effect` | Export `Iterable`; port `Optic` from `effect@4.0.5` |
| `Application/BedformSidecar/` (new, `@bedform/sidecar@1.0.0`) | Effect sidecar: `Source/{Cli,Config,Setup,Rpc,Engine,Interpreter,Governor,Storage,Scheduler,Service/*}`, `Test/` |
| `Application/BedformSettings/Web` | Unchanged settings frontend (served by the unified sidecar per ikm.6) |
| Root `package.json` | Add `./Application/*` to `workspaces` |

Dependencies for the sidecar: `effect@4.0.5`, `@effect/platform-node@4.0.5`, `@effect/sql-pglite@4.0.5` (with `@electric-sql/pglite@^0.5.8` and its `vector` extension), `sharp@0.35.5`, `@anthropic-ai/sdk@1.3.0`, `openai@7.47.0`, `bedform` (for the protocol) and `effect-bedrock` (op implementations, so results match in-game semantics). Bedform gains optional peer dependencies `@minecraft/server-net` and `@minecraft/server-admin`, used only by `bedform/Workflow/Bedrock`, with typings matching BDS 1.26.60.

## `bedform/Workflow` API

**Expressions.** `Expr<A, R = never>` is a symbolic value of type `A`. `R` is the union of capabilities it needs (`"Http" | "Storage" | "Crypto" | "Ai" | "Image" | "Settings" | "Durable" | …`). Lambdas passed to pure mirror functions must have `R = never`. Effectful sequencing uses `Workflow.gen(function* (input) { … })`, which traces `yield*` into `Let` chains. Data-dependent control flow uses `Expr.if`, `Expr.match`, `Workflow.forEach` (with concurrency), `Workflow.all`, `Workflow.race` and `Workflow.retry`. Expressions throw on primitive coercion, so a JS `if` written over an `Expr` fails when the definition is built. Struct-typed expressions expose fields through a Proxy. Reserved names fall back to `Struct.get`.

**Definitions.**

- `Task.make({ name, input?, output?, error?, priority? }, body)` defines simple one-off work. Schemas are optional effect-bedrock `Schema`s in the portable subset.
- `Workflow.make({ …, progress?: "percent" | { steps: n }, onFailure?: "fail" | "suspend" }, body)` returns a `Workflow`, which **is a `Task`** with durable execution and advanced controls. Any API that accepts a `Task` also accepts a `Workflow`.

**Running.** These are in `bedform/Workflow/Bedrock`.

- `Task.run(task, input, opts?)` returns `Promise<A>` and rejects with `TaskFailure`. `Task.runResult` returns `Promise<Result<A, TaskError<E>>>`.
- `Workflow.start(wf, input, { id?, priority? })` returns a `WorkflowHandle`. `Workflow.attach(wf, id)` reconnects to an execution after a restart. `Workflow.list(wf, filter)` lists executions.
- A `WorkflowHandle` offers `status()`, `progress()`, `result()` (awaits an `Exit`), `poll()`, `cancel()`, `pause()`, `resume()` and `signal(name, value)`. `poll()` returns `Complete(exit)` or `Incomplete(status, progress)`.
- Statuses are `Queued` (including deferral by the governor), `Running`, `Paused`, `Suspended`, `Succeeded`, `Failed` and `Cancelled`.

**Progress, standardized.** A progress value is either:

- `Progress.Percent { value }`, with `0 ≤ value ≤ 100`, or
- `Progress.Steps { completed, total }`, with integers, `total ≥ 1` and `0 ≤ completed ≤ total`.

The IR ops are `Progress.percent`, `Progress.steps` and `Progress.advance(n = 1)`. A workflow declared with `steps: n` gets `Steps` progress automatically from `Progress.advance`. An invalid report fails with `InvalidProgress`. Persistence is throttled to at most one write every 250 ms.

**Timers.** These mirror their originals.

- `Timers.setTimeout`, `setInterval` and `setImmediate`, with matching `clear*`, discard results. Each accepts one of three targets:
  - a closure, which runs in-game and isn't durable;
  - a named durable handler, `Timers.handler("ns:id", fn)`, registered at startup and delivered even after BDS or sidecar restarts;
  - a `Task`, which runs on the sidecar.
- `Timers.Promises.setTimeout(delay, value)` returns `Promise<value>`, and `Timers.Promises.setInterval(delay, value)` returns an `AsyncIterable<value>`.
- `Scheduler.postTask(task, input, { priority, delay, signal })` returns `Promise<result>`. Web priorities map as `user-blocking` → high, `user-visible` → medium and `background` → low; Bedform ranks are accepted too.

**Schedules.** `Schedules.create(taskOrWorkflow, input, schedule, opts)`:

- `schedule` is `Schedule.at(date)`, `.after(duration)`, `.every(duration, { startAt, times, until })` or `.cron(expr, { timeZone })`.
- Options are `overlap: skip | queue | cancelPrevious | allow` and `catchUp: skip | once | all`, plus an optional durable handler for results.
- Each run gets the deterministic execution ID `<scheduleId>:<occurrence>`. The handle supports `next()`, `runs()`, `pause()`, `resume()` and `cancel()`.

**Errors.** `TaskError<E>` is one of `Failure(E)`, `Defect`, `Cancelled`, `Interrupted` (a non-durable task lost to a sidecar restart), `ResourceExhausted`, `PermissionDenied`, `InvalidInput`, `Timeout`, `Unavailable` or `UnsupportedOperation`.

## Instruction IR, caching, and wire format

- **Nodes:** `Lit`, `Arg`, `Var` (de Bruijn), `Lam`, `App`, `Op(id, args)`, `Let`, `If`, `Match`, `Do`, `Step(name)`, `Try`, `Fail`, `Loop` (bounded), `Par`, `Race`, `Sleep`, `Await(signal)`, `Progress`, `Call(definitionRef)`.
- **Definition document:** `{ v, kind, name, input, output, error, body, capabilities, options }`. It is serialized as canonical JSON (sorted keys, normalized variables) and hashed with SHA-256 in pure JS. The ID is `<addon>/<name>@<hash>`.
- **Caching:**
  - The client registers known definitions in one batch after `Hello`.
  - Each call sends `{ definition: hash, input }`.
  - An `UnknownDefinition` reply triggers a single upload and retry.
  - The sidecar persists definitions per add-on in the system DB, so durable executions resume without the add-on. It keeps a compiled-closure LRU in memory.
- **Wire codec:** tagged JSON shared by both ends. It covers `bigint`, `undefined`, `NaN`, `±Infinity`, `-0`, bytes (base64), Option, Result, Exit, Chunk, HashMap, HashSet, BigDecimal, Duration, `_tag`ged data, and redacted references, which are never revealed back.
- **PortableSchema:** the subset of effect-bedrock Schema AST that the sidecar can rebuild as upstream `effect/Schema`. Both ends validate.
- **Limits:** node count, depth and literal size per definition; fuel per execution. `Hello` exchanges the IR version and an op-catalog hash. Unknown ops fail with `UnsupportedOperation`.

## Mirror modules of effect-bedrock

The generator `Tool/workflow-mirror.mts` reads effect-bedrock declarations with the TS compiler API and emits:

- `Source/Workflow/<Module>.ts` with lifted signatures. Values become `Expr.Input<T>`, function parameters become functions over `Expr`, results become `Expr<R>`, and both dual (data-first and data-last) forms are kept. TSDoc follows repository rules with `@since 1.0.0`.
- The sidecar op registry, mapping `"Array.map"` to the effect-bedrock implementation with IR-lambda adapters.
- `docs/workflow-mirror-exclusions.md`, listing every skipped export and why: type-only, protocol or class construction, mutating or unsafe, or a non-portable argument.

Modules mirrored: `Array`, `Chunk`, `Iterable`, `Record`, `Struct`, `Tuple`, `String`, `Number`, `BigInt`, `BigDecimal`, `Duration`, `ByteSize`, `HashMap`, `HashSet`, `Option`, `Result`, `Predicate`, `Function`, `Order`, `Equivalence`, `Ordering`, `Combiner`, `Reducer`, `Equal`, `Hash`, `Data` (value constructors), `RegExp` (as `{ source, flags }`), `Redacted`, `Encoding` (Base64, Base64Url, Hex), `JsonPointer`, `Formatter`, `Schema` (decode, encode and `is` with portable schemas), `JsonSchema`, `Match` (with patterns as data), and `Optic` once ported.

Package exports are generated as explicit `./Workflow/<Module>` entries. Prerequisite work in effect-bedrock: export `./Iterable`, and port `Optic` with its dependency closure, tests and PROVENANCE notes.

## Domain modules

**Storage.** `Storage.sql` is a tagged template producing parameterized statements. Alongside it:

- `query` (rows decoded by schema), `execute`, `transaction`, and per-add-on versioned `migrate`;
- a `Kv` key-value store in `_bedform_kv`;
- `Storage.dependency(id)` to qualify a dependency's schema;
- the file store (see Http/File).

**Settings.** `get(player, key)`, `getAll`, `set(player, values, { expectedRevision })`, `reset` and `definition`. These go through the Settings service, which handles validation, revisions and sync to the game. A player is `{ worldId, playerId }`. This module depends on `MineCraft-ikm.1` and `.3`. The user called it `bedform/Settings`; the settings plan names it `bedform/ServerSettings`.

**Crypto.** Built on `node:crypto` and WebCrypto:

- random bytes, UUID v4 and v7;
- SHA-2 and SHA-3 hashes, HMAC, HKDF, PBKDF2, scrypt;
- AES-GCM and ChaCha20-Poly1305;
- Ed25519, ECDSA P-256 and X25519.

Keys live in a per-add-on keystore as `KeyRef`s, encrypted with a sidecar master key. They can't be extracted unless created `extractable`.

**Http and File.**

- Requests support any method, headers, and text, JSON, bytes, `FileRef` or multipart bodies. Responses can be read as text, JSON or bytes, or saved to a file.
- `download(url)` returns a `FileRef` and reports progress in bytes. `upload(FileRef, url)` sends raw or multipart data. Redirects, retries, timeouts and size limits are supported.
- Admin policy:
  - Per-add-on host allowlists and denylists.
  - Loopback, private, link-local and metadata addresses are blocked unless allowlisted. DNS is pinned, and every redirect is rechecked.
  - Rate limits.
  - Named secrets from the config are inserted as redacted headers and never returned.
- Files live under `.bedform/sidecar/files/<addon>/` with quotas and metadata in Postgres. Add-ons can read them in chunks.

**Numeric.**

- A string formula grammar: integers in decimal, hex, octal and binary with `_` separators, arbitrary precision with an `n` suffix, floats with exponents, and `Infinity` and `NaN`. Operators follow JS precedence plus `**`, integer division, bitwise operators and comparisons. A parser on the add-on side produces IR.
- Math functions: trig, hyperbolic and inverse; exp and log variants; hypot; rounding modes, including half-even; clamp.
- Integer functions: gcd, lcm, modPow, modInverse, isPrime, factorial, binomial.
- Compensated sums and statistics.
- BigInt and BigDecimal arithmetic.
- The EBNF is documented in `docs/workflow-numeric.md`.

**Image.**

- Sources: a `FileRef`, bytes, or `Texture.ref(spec)`. Specs look like `block:<id>[#face][?states]`, `item:<id>`, `entity:<id>[#key]` and `path:<pack>/<file>`.
- The resolver indexes BDS `resource_packs`, `behavior_packs` and world pack stacks. It reads:
  - `blocks.json`, `terrain_texture.json` (including variations and overlay colors), `item_texture.json` and `flipbook_textures.json`;
  - custom block `minecraft:material_instances`, including permutations;
  - entity client `textures`;
  - texture sets.
- BDS ships no vanilla textures, so `textures.vanilla` in the config names a client vanilla pack path or opts in to the pinned `Mojang/bedrock-samples` download.
- Operations:
  - decode PNG, JPG and TGA (a TGA decoder is included);
  - crop, resize (nearest by default), rotate, flip;
  - tint and overlay, composite with blend modes, masks, color adjustment, quantize and palette mapping;
  - flipbook frame extraction and atlas packing;
  - average or dominant color, pixel get and set, drawing primitives;
  - creating images, including procedural `Image.generate(w, h, (x, y) => Color)`;
  - mapping an image to nearest block colors;
  - encoding PNG, JPEG and WebP.

**Path.**

- Algorithms: BFS, Dijkstra, A*, bidirectional A*, JPS, Theta*, flow fields, flood fill and components, path smoothing and simplification. Heuristics: Manhattan, Chebyshev, octile and Euclidean.
- The Minecraft voxel movement model: walk, step up, maximum fall, jump gaps, swim, climb, doors, per-block costs, entity width and height, and fly mode.
- The add-on helper `Path.capture(dimension, volume, classifier)` runs as a `system.runJob` budgeted sampler. It uploads a palette-plus-RLE `GridRef` and supports incremental `update`s.
- Results are waypoints with movement types.

**Ai.** A provider-neutral interface with two providers:

- **Anthropic**, through the official `@anthropic-ai/sdk`. Its default model is `claude-opus-5-5`. It uses adaptive thinking with explicit `effort` (default `medium`, overridable per call) and streams with `finalMessage()` for long outputs. Structured output goes through `output_config.format` and strict tools. `tool_choice` is always `auto`, because forced choices return a 400. It checks `stop_reason` for refusals, applies top-level prompt caching, and keeps tool order deterministic. It also enables server-side `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`); admins can disable this.
- **OpenAI**, through the official `openai` SDK. The admin configures the model, with no built-in default ID. An optional `baseUrl` is supported. This provider also offers `Ai.embed`, which Anthropic has no endpoint for, with storage in pgvector.

Ops:

- `generateText`, `generateObject` (schema-typed), `chat` with append-only conversations stored in add-on storage (thinking blocks are passed back unchanged), and `embed`;
- tools, defined as `Ai.tool({ name, description, input, run })` and run on the sidecar, or as in-game handlers through events with timeouts;
- a bounded agent loop.

`Ai.Format` converts between AI-friendly and add-on-friendly formats:

- portable Schema ↔ JSON Schema, and model JSON → validated values;
- Bedrock RawMessage and `§` codes ↔ Markdown, with splitting for chat, sign, book and DDUI limits;
- voxel regions ↔ layered text with a legend, or JSON RLE;
- `.mcstructure` ↔ JSON;
- block permutation strings ↔ objects;
- item and entity descriptors;
- textures and images → model image parts;
- model-proposed commands → a validated `CommandPlan` that the add-on executes.

Admin limits cover providers and models per add-on, token budgets and concurrency.

## Sidecar application

- **Commands:** `bedform-sidecar setup | serve | status`, replacing the planned `bedform-settings`. Existing setup rules still apply: an explicit, stopped BDS directory, backups, and preserving unrelated fields.
- **Provisioning with `setup`:**
  - It discovers sidecar-enabled packs. Each has a `bedform.sidecar.json` descriptor in its behavior pack, giving the add-on ID, script module UUID, requested capabilities and `storage.shareWithDependents: none | read | readWrite`. `bedform build` generates the descriptor once `bedform/Config` lands; it can also be written by hand.
  - For each pack it writes `secrets.json` (`ServerSecret.SidecarToken`, 256-bit) and `variables.json` (`ServerVariable.SidecarUrl`).
  - It merges `permissions.json` `allowed_modules` with the default list.
  - It stores token hashes in the system DB.
  - `Script/install-addon.mts` calls provisioning after installing a sidecar-enabled add-on.
- **RPC:** `effect/rpc` `RpcServer` over HTTP with `RpcSerialization.json`. This is buffered, so it suits server-net, which can't stream. The auth middleware reads the merged request headers. The group covers:
  - `Hello`, `Register`, `Define`;
  - `Run`, `Start`, `Poll`, `Await` (long poll), `Cancel`, `Pause`, `Resume`, `Signal`;
  - `Schedules.*`;
  - `Events.next(cursor)`, a long poll of about 20 s, and `Events.ack`.

  Domain payloads are decoded with the shared `Protocol` codecs at the handler boundary.
- **Execution:**
  - A **Task** is an interpreter fiber with an execution record. It doesn't survive a sidecar restart and fails with `Interrupted`.
  - A **Workflow** is the single effect `Workflow.make({ name: "bedform/Execution", idempotencyKey: executionId })`. It is registered with `ClusterWorkflowEngine` on `SingleRunner.layer` over the system PGlite `SqlClient`, which uses the pg dialect.
  - IR `Step` nodes and each effectful op become `Activity` steps, so they are journaled and not repeated on replay. `Sleep` uses `DurableClock`. Signals and pause gates use `DurableDeferred`.
  - Cancel maps to `engine.interrupt`, which runs compensations. Resume handles pause gates and the `SuspendOnFailure` (`onFailure: "suspend"`) case.
  - Pure segments run in a compute worker pool through `effect/rpc` `RpcWorker` and `@effect/platform-node` workers. Workers can be terminated and have `resourceLimits` set.
- **Events:** a durable per-add-on outbox with at-least-once delivery, event IDs for idempotent handlers, and bounded retention. Results are retained for a configurable time (default 7 days) for `attach`.
- **Configuration:** `<BDS>/.bedform/sidecar/config.json` is validated by an Effect Schema and has a `$schema`. Resource limits, policies and providers reload while the sidecar runs. It shares the existing `127.0.0.1:19133` listener: `/bridge/settings/*` per the settings plan, and `/rpc/workflow`.

## Storage and permission scoping

- **Two PGlite instances.**
  - The **system DB** is on the main thread. It holds settings tables (replacing the planned SQLite) and the workflow and cluster tables, plus Bedform tables: definitions, executions, progress, schedules, outbox, tokens, grants, file metadata, AI usage and keystore.
  - The **add-on DB** runs in a storage worker so long queries can't block the event loop. Add-on queries can never reach the system DB.
- **Isolation:**
  - Each add-on has schema `addon_<id>`, owned by role `addon_<id>`. Every statement runs in a transaction with `SET LOCAL ROLE`, a `search_path` of its own schema, `statement_timeout` and a row cap.
  - Quotas are enforced from periodic size sums.
- **Sharing:**
  - Add-on A may access dependency B only when all of these hold:
    - B is a *direct* dependency in A's behavior-pack manifest. The sidecar reads this from installed manifests and never trusts what the add-on states at runtime.
    - B's descriptor allows sharing.
    - The admin config doesn't deny it.
  - Access is granted through the `addon_<b>_read` and `addon_<b>_write` group roles. The same rule covers B's files, KV and settings.
  - Grants are recomputed at startup and after setup or config changes.

## Resource governor

- **Config:**

  ```json
  "resources": {
    "cpu": { "maxPercent": 40 },
    "memory": { "maxPercent": 20 },
    "defaultPriority": "medium",
    "addons": { "<id>": { "priority": "low|medium|high|very_high", "cpu": {}, "memory": {}, "maxConcurrent": 4 } }
  }
  ```

  A task may request a priority at or below its add-on's ceiling.
- **Measurement:**
  - CPU is the `process.cpuUsage()` delta divided by (elapsed time × `os.availableParallelism()`). It covers all threads, WASM and workers, as a 2 s EWMA.
  - Memory is `process.memoryUsage().rss` against `os.totalmem()`.
  - A ledger attributes buffers (images, bodies) and worker heaps to executions.
- **Policy:**
  - **Normal:** weighted fair share of 8, 4, 2 and 1 for very_high, high, medium and low.
  - **CPU over the bound:**
    - Stop admitting low, then medium, executions.
    - Pause running executions at interpreter yield points and activity boundaries, lowest priority first.
    - Shrink pool parallelism.
  - **Memory over 90 % of its bound (soft):**
    - Admit only very_high work.
    - Pause the lowest-priority executions.
    - Evict caches.
  - **Memory over the bound for longer than the grace period (hard):**
    - Cancel the newest, lowest-priority **Tasks** with `ResourceExhausted`.
    - Durably *suspend* Workflows, and resume them later, unless `cancelWorkflowsUnderPressure` is set.
    - Terminate a worker that runs away.
  - Per-add-on caps use the same mechanism.
  - `sharp.concurrency` and `UV_THREADPOOL_SIZE` are derived from the CPU bound at launch.
  - OS hard caps (Job Objects or cgroups) are not part of this version.

## Changes to existing plans

`MineCraft-z2w.5` updates `Plan/Bedform_Settings_Plan.md` and beads `MineCraft-ikm.3`, `.6` and `.9` for the unified `Application/BedformSidecar`: PGlite in place of SQLite, the `bedform-sidecar` executable and the shared listener. It also makes `MineCraft-ikm.3` depend on `MineCraft-z2w.5`. The settings plan and the `MineCraft-ikm` beads are unchanged until then.

## Conventions

- TSDoc follows CLAUDE.md, with no `@param` or `@returns` and with `@category` and `@since` tags. The symbol-level `@since` version is `1.0.0` for Bedform, effect-bedrock and the sidecar; Bedform's package version may retain its prerelease suffix.
- Nested object types are extracted into namespaces. Constants use PascalCase.
- Contract keys live in `Workflow/Protocol`: `ServerSecret`, `ServerVariable` and the RPC tags. Bedform-owned dynamic properties live in `Source/keys.ts`.
- Implementation tracking stays in Beads. There are no commits, pushes, Dolt sync or live-server deployment without explicit authorization.

## Verification

- **Bedform** (`npm run verify --workspace bedform`):
  - Golden hashes for canonicalization.
  - Wire and PortableSchema round-trip property tests.
  - Positive and negative type tests: purity of lambdas, lifted signatures, `Workflow` assignable to `Task`.
  - Differential tests for every mirrored export: interpreter vs direct effect-bedrock.
  - An exclusion-report snapshot.
  - A restricted-host QuickJS-style execution check, following effect-bedrock's approach.
  - A check that no `@minecraft` or Node imports occur outside `Workflow/Bedrock`.
- **Sidecar** (`npm run verify --workspace @bedform/sidecar`), using Effect layer tests with temporary PGlite directories:
  - Durable resume after kill -9 without repeated activities.
  - Pause, resume, cancel, poll and progress validation.
  - Timers and schedules after restart, including catch-up and overlap.
  - Storage isolation: cross-schema access denied, and dependency access only with share plus manifest plus admin allowance.
  - Forged and missing tokens rejected.
  - Governor ordering under synthetic CPU and memory load: Tasks are cancelled and Workflows suspended.
  - SSRF guards.
  - Crypto test vectors (RFC and NIST).
  - Image goldens against fixture packs: TGA, flipbooks, `material_instances` permutations.
  - Pathfinding vs brute-force BFS on random grids.
  - AI with fake and recorded providers. Live Claude and OpenAI smoke tests run only behind an explicit opt-in environment variable, because they cost money.
- **Contract:** the Bedrock client on Node against the real `RpcServer`.
- **BDS** (`npm run test:workflow:bds --workspace bedform`), through the fixed `Package/Bedform/dist/bds-runtime/bedrock_server.exe`, with `firewall:configure` extended if that path isn't covered:
  - Provisioning and an in-game `setTimeout`.
  - Task results, and workflow progress and cancel across BDS and sidecar restarts.
  - Two packs exercising dependency sharing on and off.
  - Disposable worlds only.
- Report host, BDS and live-provider evidence separately. Unmet live acceptance keeps its bead open.

## Beads implementation tracking

Epic: `MineCraft-z2w`. Beads is the source of truth for task status; all implementation entries start open. The table maps this specification to its implementation entries, not a separate task-status checklist.

| Issue | Implementation area | Prerequisites |
| --- | --- | --- |
| `MineCraft-z2w.1` | Spike (gate): PGlite role isolation, PGlite-backed durable workflows, BDS server-net transport and QuickJS costs, with documented fallbacks | None |
| `MineCraft-z2w.2` | Protocol, instruction IR, Wire codec, PortableSchema, hashing, `Task`/`Workflow`/`Progress` and errors | None |
| `MineCraft-z2w.3` | effect-bedrock `Iterable` export and `Optic` port | None |
| `MineCraft-z2w.4` | Mirror generator, generated modules, op registry and exclusion report | `.2`, `.3` |
| `MineCraft-z2w.5` | Unified sidecar foundation: config, provisioning, system database, RPC, definition cache, settings retargeting | `.1`, `.2` |
| `MineCraft-z2w.6` | Interpreter, Tasks, durable Workflows and controls, compute pool, event outbox | `.4`, `.5` |
| `MineCraft-z2w.7` | `bedform/Workflow/Bedrock` runtime client, handles and long-poll delivery | `.2`, `.5` |
| `MineCraft-z2w.8` | Timers, `postTask`, durable handlers and Schedules | `.6`, `.7` |
| `MineCraft-z2w.9` | Scoped add-on storage, dependency sharing, quotas and file store | `.1`, `.5` |
| `MineCraft-z2w.10` | Resource governor | `.6` |
| `MineCraft-z2w.11` | Crypto | `.6`, `.9` |
| `MineCraft-z2w.12` | Http and File transfers | `.6`, `.9` |
| `MineCraft-z2w.13` | Numeric and the formula grammar | `.6`, `.9` |
| `MineCraft-z2w.14` | Settings | `.6`, `.9`, `MineCraft-ikm.1`, `MineCraft-ikm.3` |
| `MineCraft-z2w.15` | Image and texture resolution | `.6`, `.9` |
| `MineCraft-z2w.16` | Path and voxel capture | `.6`, `.9` |
| `MineCraft-z2w.17` | Ai with Claude and OpenAI, and AI format conversion | `.6`, `.9`, `.15`, `.16` |
| `MineCraft-z2w.18` | Docs, examples, BDS runner and end-to-end acceptance | `.6` to `.17` |

Dependencies above use the `MineCraft-z2w` prefix unless written in full. Unmet BDS, client or live-provider acceptance keeps its owning entry and the epic open even when automated verification passes.
