# Spatial runtime and React roots

`Spatial.Start` and `bedform/Spatial/Renderer` provide the shared application
lifetime for spatial widgets, Ink and Window. They use the single
[spatial React client](react-port.md). Imports create no timers, subscriptions,
entities, primitives, Ink application or VM.

The runtime provides reconciliation, lifetime ownership and audience routing.
A surface backend must be injected. [Spatial components and layout](spatial-layout.md)
provide typed widgets and their text/ancestry rules. Particle drawing and native
component presentation have separate owners.

## Startup

```ts
import { Spatial } from "bedform";
import * as Renderer from "bedform/Spatial/Renderer";
import { world, system, TextPrimitive } from "@minecraft/server";

// `backend` implements Renderer.SurfaceFactory for the presentation being used.
const runtime = Spatial.Start({
    World: world,
    System: system,
    Native: { TextPrimitive },
    Surface: backend,
    TickBudget: 5,
    OnError: failure => report(failure)
});

const privateRoot = Renderer.CreateRoot(runtime, { Player: player });
privateRoot.Render(application);

const sharedRoot = Renderer.CreateRoot(runtime, {
    Shared: true,
    Audience: () => currentAudience
});
sharedRoot.Render(sharedApplication);

await privateRoot.Unmount();
await runtime.Dispose();
```

Supply the native API version that contains the constructors required by the
backend. Stable server declarations need not contain the experimental
`TextPrimitive` API: the runtime carries that constructor opaquely and never
instantiates, places, measures or styles it. Concrete text backends must follow
[TextPrimitive findings](../../../Documentation/TextPrimitive.md).

`World` enumerates online player objects. `System` supplies `run`, `runTimeout`,
`runInterval` and `clearRun`. Other native services/constructors can be included
in `Native` and are forwarded to backend contexts. A root can override the
default `Surface`; omitting both factories is an error before allocation.

Startup installs the exclusive React host and one presentation interval. A
second runtime cannot start until the first runtime's `Dispose` promise settles.
Independent applications share that runtime/reconciler, not component state,
context providers, refs, subscriptions, native resource ledgers or error channels.
No native objects are allocated just by creating a root.

## Commit and audience behavior

`Render` schedules an upstream React update; it does not synchronously draw.
Only committed trees reach surfaces. Abandoned renders allocate inert host
descriptors and can never create a viewer's native presentation.

Private roots require a particular valid player object. Shared roots require
`Shared: true` and an explicit audience function. Each tick intersects the policy
with current valid objects from `World.getAllPlayers()`, deduplicating by id.
Session matching also uses object identity: a replacement object with a reused
id cannot inherit a previous private root or surface lease. Adapters whose native
API returns fresh wrappers must supply stable session objects; wrapper stability
and native privacy still require qualification on the target server/client.

Revoked, invalid and disconnected sessions are removed before any new
presentation is committed or refreshed. Empty audiences allocate nothing and
never become public. An audience-provider or world-enumeration failure revokes
presentation for that tick and reports an error. Recovery recreates private
leases from the last committed tree without remounting application state.

A presentation tick may precede a React commit in the same native tick, in which
case the new frame is presented on the following presentation tick. Tick budgets
only govern React work between units; component execution cannot be preempted.
Server commits and cleanup completion do not guarantee client paint timing.
Particle backends retain their documented bounded lifetime after emission stops.

## Surface contract

`Renderer.SurfaceFactory` is the shared internal protocol for particle, terminal
display and future cuboid adapters. The public type aliases let consumers type an
injected adapter without importing private package paths.

| Member | Contract |
| --- | --- |
| `Factory.CustomHost` | Explicit opt-in for custom raw host types outside widget trees. Defaults to strict spatial component and Text rules; never relaxes rules inside View. |
| `Factory.Create(context)` | Creates one private lease for exactly `context.Viewer`. Receives root id, native services and a scoped `Own` function. |
| `Factory.Validate(type, props, ancestors)` | Optional pure render-time validation. May be repeated or abandoned; throws into a React error boundary. Allocates no native resources. |
| `Factory.ValidateText(text, ancestors)` | Optional additional pure text validation after the shared Text ancestry check. |
| `Surface.Commit(frame)` | Replaces the entire committed revision. A newly admitted viewer receives the current frame, even if React did not commit this tick. |
| `Surface.Update()` | Refreshes the current private presentation every tick. Must respect hidden ancestors and stop all drawing/input after disposal. |
| `Surface.Dispose()` | Stops presentation/input and releases backend-owned resources. Called at most once for that lease. |

Frames and descriptor trees are frozen snapshots. Node identities survive keyed
moves. Child arrays and prop records are frozen; nested consumer prop values are
opaque and are not deep-cloned or frozen. React children, keys and refs are not
forwarded as backend props. Host refs expose stable frozen `{ Id, Type }` handles;
native actors and imperative component handles belong to their concrete adapter.
Hidden state propagates through descendants, including Activity/Suspense trees.

`Root.Audience` lists the ids of viewers holding a presentation lease as of the
last tick, which [pointer targeting](spatial-pointer.md) uses as the set of
players that can aim at the root.

Valid widget commits include `frame.Layout`, also available as `Root.Layout`, for
the same presentation and hit-testing geometry. Resolved child-contract failures
withhold the invalid frame and return through the nearest component's React error
boundary before native presentation.

Register native cleanup with `context.Own` before continuing allocation. Each
registration returns an idempotent early release function. The runtime attempts
all remaining releases in reverse registration order, including after partial
factory failure or a throwing surface disposer. Registering native release
independently of `Surface.Dispose` prevents one throwing destructor from skipping
the rest of a lease's resources. A retained context rejects new registrations
after its root retires or its audience lease closes.

## Disposal and failures

`Unmount` immediately retires a root and rejects subsequent `Render`/`Own` calls.
Every call returns the same promise. Cleanup runs outside the current React
commit/backend stack, so reentrant disposal from effects or a surface callback
cannot continue presenting a retired application. Await completion to observe
effect cleanup, ref clearing, external-store unsubscribe and native release.

`Root.Own` also registers root-wide subscriptions or other resources that are
independent of viewers. `Runtime.Dispose` retires all its roots, stops its
presentation interval, awaits their cleanup, drains canceled React bookkeeping,
cancels remaining owned native handles and uninstalls the shared host. Draining
clears upstream scheduled-work flags, allowing a subsequent runtime to start.
Unrelated native System callbacks are never canceled. Already-dequeued callbacks
and late Promise/Suspense resolutions cannot restore a retired root.

Render errors without a boundary and surface create/commit/update errors retire
the affected root. Caught errors remain inside their boundary. Root error
handlers receive scoped `RootId`, `Phase` and `Cause`; the runtime handler is the
trusted fallback. A failing handler cannot stop another application or interrupt
resource release. Cleanup attempts every registered release and rejects with an
aggregate error if anything fails. A failing external native destructor cannot
be proven successful by the runtime; callers must handle that rejection.

## Verification boundary

```sh
npm run test:spatial-runtime --workspace bedform
```

Host tests exercise inert imports, private/shared audience changes, replaced
sessions, actual reconciliation and hook cleanup, keyed snapshots, Activity
visibility, failures, reentrant disposal, pending renders, late resources,
restart and unrelated native timer preservation. The packed React consumer test
also loads every public runtime path from an independent install, executes it in
a restricted realm and compiles the bounded `Spatial/Renderer` types with ES2022
and no ambient Node/DOM types or native declaration peers. The broader Spatial
namespace retains its existing native peer requirements through Intent. Full React differential tests remain in the normal React suite.

These checks qualify the shared runtime and backend protocol. They do not prove
particle/text drawing, native player wrapper identity, server transport privacy,
client visibility or real-client cleanup timing. Fixed-path BDS and separate
client acceptance remain with those deliverables. No production deployment or
npm publication is performed by these checks.
