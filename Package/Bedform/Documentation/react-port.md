# React port foundation

Bedform vendors `react@19.3.1`, `react-reconciler@0.34.0` and its scheduler contract,
`scheduler@0.28.0`, so React can run inside Bedrock's script engine without Node, a
browser or global polyfills. This is the internal foundation for the public
`bedform/Spatial/React` port. That port, its hooks and JSX runtimes, and the spatial
renderer are tracked separately and are not exported yet.

## Provenance and regeneration

`Tool/ReactVendor.mts` generates every file in
`Source/Spatial/Internal/React/Vendor` and the package's
[third-party notices](../ThirdPartyNotices.md) from the pinned npm tarballs:

```sh
npm run react-vendor --workspace bedform        # write
npm run react-vendor:check --workspace bedform  # fail if anything differs
```

The tool rejects a tarball whose `sha512` integrity differs from its pin, and it
confirms each manifest's name, version and MIT licence. It also checks that the
reconciler still declares `scheduler@^0.28.0` and the `react@^19.3.0` peer. Tarballs
are cached in `node_modules/.cache/bedform-react-vendor` and downloaded only when
absent; `-- --tarballs DIR` reads them from another directory instead. Generation
is deterministic: the check compares every generated file byte for byte and
reports extraneous files in the vendor directory.

The notices record each tarball's URL and integrity, the SHA-256 of every
vendored upstream file and the full upstream licence texts. Each generated module
keeps its upstream `@license React` banner, which survives compilation.

### Vendored builds

The production and development builds of these entry points are vendored:

| Package | Entry points |
| --- | --- |
| `react` | Core, `jsx-runtime`, `jsx-dev-runtime` |
| `react-reconciler` | Reconciler factory, `constants` |
| `scheduler` | Default scheduler |

Server, profiling, compiler-runtime, reflection, native, mock and post-task
builds are excluded. Each flavor imports the same flavor of its dependencies, as
upstream's `NODE_ENV` resolution would. The production `jsx-dev-runtime` exports
an undefined `jsxDEV`, exactly as upstream does.

## Adaptation

Each upstream CommonJS body is wrapped, unchanged, in a function whose parameters
shadow the host globals it would otherwise read:

- `process` is a frozen object containing only `env.NODE_ENV`, set to the module's
  flavor.
- `setTimeout`, `clearTimeout`, `performance.now`, `reportError` and `console`
  delegate to the installed React host when they are called.
- `window`, `self`, `global`, `globalThis`, `document`, `navigator`, `location`,
  `setImmediate`, `clearImmediate`, `setInterval`, `clearInterval`,
  `MessageChannel`, `queueMicrotask`, `requestAnimationFrame`,
  `cancelAnimationFrame`, `AbortController`, `IS_REACT_ACT_ENVIRONMENT` and
  `__REACT_DEVTOOLS_GLOBAL_HOOK__` are `undefined`.

Upstream's own `typeof` probes then take their host-less paths. For example, the
scheduler falls back to `setTimeout(…, 0)` for its work loop, and the reconciler
uses its internal `AbortController` replacement. DevTools, `act` environments and
browser error events are unavailable. Only `console` is read from the engine, and
only when no host is installed, because Bedrock's script engine provides it.

Only one textual change is applied, and only after its exact occurrence count is
confirmed. In both scheduler builds, the per-turn yield check compares elapsed
time with the host's tick budget instead of upstream's fixed `frameInterval`.

## Hosts

`Source/Spatial/Internal/React/Host.ts` holds the single host shared by every
vendored module in a script environment:

```ts
import { system } from "@minecraft/server";
import { CreateSystemReactHost, InstallReactHost } from "./Host.js";

const uninstall = InstallReactHost(CreateSystemReactHost(system, { TickBudget: 5 }));
```

- **Importing is inert.** Importing creates no timers, subscriptions or entities, and
  neither does creating a reconciler or root.
- **Deferred timers.** Timers requested before installation are deferred, then
  replayed through the first installed host. Clearing a timer always reaches the
  host that issued it.
- **One host at a time.** Installing a second host throws. The function returned by
  `InstallReactHost` uninstalls idempotently.
- **System scheduling.** `CreateSystemReactHost` runs zero-delay work through
  `system.run`, which executes on the next tick. Positive delays round up to whole
  ticks through `system.runTimeout`, at 50 ms per tick, and clearing uses
  `system.clearRun`. The clock defaults to `Date.now`, errors go to the console's
  `error`, and any of these can be overridden. The module imports nothing from
  `@minecraft/server`; it accepts any object with `run`, `runTimeout` and `clearRun`.

## Scheduling model

Upstream's priority queue is unchanged. Immediate and user-blocking work runs
before normal, low and idle work, and the reconciler renders urgent lanes before
transition lanes.

Within one host turn, the scheduler performs units of work until the tick budget
has elapsed, then yields to the next turn. The default is upstream's 5 ms, or the
value set by `unstable_forceFrameRate`; a host's `TickBudget` overrides both.
Cancelled tasks never run. A delayed task becomes ready once its delay has elapsed,
then runs on the following host turn, so on Bedrock it runs one tick after its timer
fires.

### Limits

- **Component execution cannot be preempted.** The budget is checked only between
  units of work, so a component, effect or task that runs long overruns the budget
  and delays the server tick. Upstream behaves the same way in browsers.
- **Server commits cannot guarantee client paint timing.** A commit changes
  server-side state during a tick. When clients see the result depends on
  networking, client frame rate and the particles or entities the renderer emits.
  `unstable_requestPaint` is only a scheduling hint.

## Verification

```sh
npm run test:react-vendor --workspace bedform
```

The suite checks byte-for-byte regeneration, notices and generated headers.
It bundles each flavor and evaluates it in a `vm` realm in which every
Node and browser global name, the DevTools hook and `IS_REACT_ACT_ENVIRONMENT` are
accessors that record any read, including `typeof` probes. In that realm it
imports the modules, binds a reconciler, renders hooks and effects across ticks,
commits an urgent update before a transition, routes an uncaught render error to
the host and runs the scheduler tests, and it asserts that nothing was read. The
scheduler tests cover tick budgets of 5, 10 and 50 ms, cancellation of immediate
and delayed work, priority order and deferred-timer replay. Further tests cover
host validation, exclusivity and the `System` delay mapping.

These are host-side checks. Differential tests against the upstream releases, the
public port and BDS qualification are separate work.
