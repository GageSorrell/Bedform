# Shared spatial React client

Bedform vendors `react@19.3.1`, `react-reconciler@0.34.0` and its scheduler contract,
`scheduler@0.28.0`, so React can run inside Bedrock's script engine without Node, a
browser or global polyfills. The public client is available at
`bedform/Spatial/React`, `bedform/Spatial/React/jsx-runtime` and
`bedform/Spatial/React/jsx-dev-runtime`, and as `Spatial.React` from `bedform`.
The shared [spatial runtime and root lifetimes](spatial-runtime.md) are available
separately; concrete drawing and widget layout retain their own implementation gates.

## Consumer configuration

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "bedform/Spatial/React"
  }
}
```

Use `react-jsxdev` for the development JSX transform. Named and default imports
share the same vendored React singleton, including both JSX runtimes. The public
client deliberately uses upstream's diagnostic build in both modes; it never
reads `process.env` to select a build. Consumers need no runtime `react` install.
Declarations reference the exact production dependency `@types/react@19.3.0`, so
React's generic signatures and overloads are available in an independent install.
The definitions work with only the ES2022 library, without ambient Node or DOM
libraries. Upstream DOM type names do not imply renderer support for DOM elements.

```tsx
import { useEffect, useRef, useState } from "bedform/Spatial/React";

function Counter() {
  const [count, setCount] = useState(0);
  const latest = useRef(count);
  useEffect(() => {
    latest.current = count;
    return () => { /* release this effect's resources */ };
  }, [count]);
  // Return components supplied by the chosen renderer.
  return null;
}
```

This entry is a client API, not a root constructor. Imports create no host,
subscriptions, timers, entities, Ink runtime or VM. A renderer must explicitly
install a host and bind the matching diagnostic reconciler to the singleton in
`Spatial/Internal/React/Core`. Do not mix it with an independently installed React
or a production reconciler's separate core.

## Compatibility matrix

| API family | Status | Contract |
| --- | --- | --- |
| All 18 stable hooks | Supported | `useState`, `useReducer`, `useOptimistic`, `useContext`, `useRef`, `useImperativeHandle`, `useEffect`, `useLayoutEffect`, `useInsertionEffect`, `useEffectEvent`, `useMemo`, `useCallback`, `useTransition`, `useDeferredValue`, `useDebugValue`, `useId`, `useSyncExternalStore`, `useActionState`; upstream dispatchers and signatures. |
| `use` | Supported | Context values, fulfilled/pending/rejected thenables, Suspense and boundary propagation retain client semantics. |
| Elements, `Children`, contexts and refs | Supported | Upstream `createElement`, `cloneElement`, `isValidElement`, `createContext`, `createRef` and `forwardRef`. Ref objects are mutable; hook refs retain first initialization and identity, and mutation does not schedule a render. |
| Classes, memoization, `lazy`, Suspense | Supported | `Component`, `PureComponent`, error boundaries, `memo`, `lazy`, `useMemo` and `useCallback` use upstream client behavior. |
| Fragment, Activity, StrictMode | Supported | Host-independent client behavior; visibility and effect connection are the renderer's responsibility. StrictMode diagnostic replays depend on root configuration. |
| Both automatic JSX runtimes | Supported | Upstream `jsx`, `jsxs`, `jsxDEV` and `Fragment`, using one diagnostic client. |
| Effects, transitions, scheduling | Adapted | Work uses injected tick scheduling. Layout/insertion effects run during server commits; they provide no browser style insertion or client paint guarantee. |
| `ViewTransition`, `addTransitionType` | Adapted | `ViewTransition` is an ordinary function component that returns its children. Animation names, classes, callbacks and native transition refs are ignored. `addTransitionType` retains upstream transition bookkeeping but causes no browser animation. |
| `cache`, `cacheSignal` | Adapted | Upstream client semantics: calls pass through without server caching and `cacheSignal()` returns null. No Server Components runtime starts. |
| `Profiler`, `useDebugValue` | Adapted | Upstream diagnostic exports; profiling requires renderer support. Browser DevTools are unavailable. |
| DOM, portals, browser animation | Excluded | No DOM renderer, browser events, CSS processing, `react-dom`, portal constructor or browser transition objects. |
| Hydration and Server Components | Excluded | No hydration, server entry points, server actions transport or server cache dispatcher. |
| `act`, compiler and unstable internals | Excluded | No public test environment or compiler-runtime entry. Internal reconciler wiring is not a supported consumer API. |

`captureOwnerStack` retains the upstream diagnostic behavior. Private fields and
unstable exports remain internal to the vendored core. DDUI remains independently
imperative; this port adds no React-style DDUI wrapper. Removal of the older DDUI
JSX layer belongs to `9rdk.12`.

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

`npm run test:react --workspace bedform` also checks the public singleton,
ref initialization/identity/mutation, both effect return forms, zero-argument
cleanup, dependency changes, context/root isolation, `use` suspension and resource
failure. The packed suite installs actual npm archives outside the monorepo with
scripts disabled, compiles a consumer with both JSX transforms and ES2022-only
types, then executes every stable hook in a restricted realm. Its bundle inputs
must all come from the independent install. The archive includes this matrix and
provenance notices.

### Differential qualification

```sh
npm run test:react:differential --workspace bedform
```

The differential suite compares 11 scenarios in both development and production
(22 comparisons). The development candidate is the public diagnostic client; the
production candidate is the internal production build. Each candidate executes in
a restricted realm that rejects Node and browser global access. Its oracle runs
**unmodified upstream packages on Node**, with the upstream scheduler using Node's
work-loop timers and clock. Both implementations receive the same deterministic
renderer timeout and microtask callbacks from the test host; those callbacks are
separate from the scheduler adaptation under test. The oracle uses the same
exact integrity-checked React, reconciler and
scheduler tarballs as the vendor pins. Every extracted regular file is compared
byte for byte with its archive; Node's CommonJS resolver selects the upstream
entry points with an explicit `NODE_ENV`. No adaptation, generated source,
installation script or port timer shim participates in the oracle.

Each implementation/scenario/flavor runs in a fresh process, isolating module
caches, dispatcher state, identifiers and scheduler queues. The same minimal
mutation host records ordered commit trees, semantic checkpoint snapshots,
subscription lifetimes, effects and error messages. Assertions independently
require each scenario to exercise its intended state changes, including an actual
suspended render attempt before it is abandoned. Comparisons retain event and
commit order. They exclude elapsed time, tick/turn counts, diagnostic stacks and
the literal generated ID strings; ID stability, uniqueness and root prefixes are
asserted instead. Checkpoints pump real Node tasks, Promise jobs and port ticks
until an asserted condition holds, rather than assuming equal scheduler latency.

| Scenario | Observable contracts |
| --- | --- |
| State | `useState`, `useReducer`, `useRef`, `useMemo`, `useCallback`, `useId`; initialization, functional updates, identity, ignored later ref initial values and no render on ref mutation. |
| Effects | `useInsertionEffect`, `useLayoutEffect`, `useEffect`, `useEffectEvent`, `useImperativeHandle`, `useDebugValue`; ordering, dependency equality/change, current committed event values, both effect return forms, zero-argument cleanup and ref removal. |
| Context | `useContext` and `use(context)` through nested providers and independent roots; stable distinct IDs. |
| ExternalStore | `useSyncExternalStore`; subscribe-time mutation recheck, notifications and per-root unsubscribe cleanup. |
| Resource | `use(promise)`, Suspense fallback/reveal and rejected-resource boundary propagation. |
| Actions | `useActionState`, `useOptimistic`, `startTransition`; pending projection, settled state, subsequent action state and failure rollback into a boundary. |
| Keyed | Keyed moves preserve host identity and hook state; memoized items, insertion/removal and per-item cleanup. |
| LazyErrors | Lazy module suspension/loading, mount cleanup, class error boundaries and caught/uncaught error routing. |
| Transitions | `useTransition`, `useDeferredValue`; urgent commit before queued work, deferred catch-up and cleared pending state. |
| Abandoned | A suspended transition is superseded before commit; its effects never start, mounted effects clean up and stale resource resolution cannot resurrect it. |
| StrictActivity | Development StrictMode effect replay, Activity visibility/effect disconnection and retained state on reveal. |

This qualifies shared React behavior with an observation-only test renderer.
The [shared runtime and root lifecycle](spatial-runtime.md) has its own host and
installed-consumer tests; concrete particle/widget rendering remains separate.
Native BDS and real-client visual qualification remain separate; no comparison
claims equal wall-clock scheduling or client paint timing. Browser animation is
excluded, and the documented `ViewTransition` adapter is not compared as if it
were a native browser transition. No npm publication or deployment is performed
by these checks.
