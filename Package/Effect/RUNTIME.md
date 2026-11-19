# Effect runtime on Bedrock

`@bedform/effect` includes the Effect runtime from `effect@4.0.5`: `Effect`, `Exit`,
`Cause`, `Context`, `Layer`, `Scope`, fibers, `Deferred`, `Ref`, `Clock`, `Scheduler`,
`Schedule` and `ManagedRuntime`, with their supporting modules. The
`@bedform/effect/Bedrock` module connects that runtime to the game loop.

## Setting up an add-on

Bedrock's script engine has no `setTimeout`, `setImmediate` or `performance`.
Without help, Effect cannot hand work back to the game, and `Effect.sleep` has
no timer. `Bedrock.layer(system)` supplies both, using the `system` object that
the add-on imports from `@minecraft/server`. The library never imports a
Minecraft module itself.

Build one `ManagedRuntime` per add-on from `Bedrock.layer(system)` and the
add-on's own services, and run effects through it from event handlers:

```ts
import { system, world } from "@minecraft/server";
import { Bedrock, Context, Effect, Layer, ManagedRuntime } from "@bedform/effect";

class Greeter extends Context.Service<Greeter, {
    readonly greet: (name: string) => Effect.Effect<void>;
}>()("my-addon/Greeter") {}

const GreeterLive = Layer.succeed(Greeter, {
    greet: (name) => Effect.sync(() => world.sendMessage(`Welcome, ${name}`))
});

const Runtime = ManagedRuntime.make(Layer.mergeAll(Bedrock.layer(system), GreeterLive));
Bedrock.disposeOnShutdown(Runtime, system.beforeEvents.shutdown);

world.afterEvents.playerSpawn.subscribe((event) =>
{
    Runtime.runFork(Effect.gen(function* ()
    {
        yield* Effect.sleep(Bedrock.ticks(20));
        yield* Greeter.use((greeter) => greeter.greet(event.player.name));
    }));
});
```

An effect run without `Bedrock.layer` still works as long as it never waits. If
it sleeps, it fails with a defect that tells you to provide the layer.

## Time is measured in ticks

- **Sleeps round up to ticks.** `Clock.sleep` waits through
  `system.runTimeout`, rounded up to whole 50 ms ticks, with a minimum of one
  tick. `Bedrock.ticks(n)` builds a `Duration` of exactly `n` ticks. The same
  rounding applies to `Schedule.spaced`, `Effect.timeout` and the other
  time-based APIs.
- **Lag stretches waits.** Ticks slow down when the server lags, so a sleep
  lasts at least its duration, not exactly its duration.
- **Clock readings have millisecond resolution.** Wall-clock and monotonic
  readings come from `Date.now`.
- **Long work is spread over ticks.** Fibers share each tick's time budget
  (`Bedrock.DefaultBudgetMillis`, 5 ms, configurable with
  `Bedrock.layer(system, { budgetMillis })`). Within the budget, fibers yield
  to each other through microtasks; after it, they continue on the next tick
  through `system.run`. This keeps long loops from tripping the script
  watchdog. `budgetMillis: 0` makes every yield wait for the next tick.

## Event handlers

**Before-events.** A before-event handler must decide synchronously, so use
`Effect.runSync` there, with layers that need no waiting. An effect that waits
resumes after the handler has returned, when the event can no longer be
cancelled: setting `cancel` then has no effect.

**Writing to the world.** A before-event handler runs in read-only mode, and so
does an effect run synchronously inside it. Read-only mode ends when the
handler returns. A fiber forked there that waits at all, even for
`Effect.yieldNow`, resumes in a microtask in the same tick and may change the
world. Yield `Bedrock.nextTick` to act on the following tick instead.
Dynamic properties are writable even in read-only mode.

**After-events and timers.** Use `Runtime.runFork` or `Runtime.runPromise`.

**Stale game objects.** An entity or block captured before a sleep may be gone
afterwards. Check `isValid` after waiting.

## Shutdown

`Bedrock.disposeOnShutdown(runtime, system.beforeEvents.shutdown)` closes the
runtime's layers when the world shuts down, running their finalizers. The
shutdown handler runs synchronously, so only finalizers that finish without
waiting can complete. If any finalizer waits, or disposal fails, the module
writes a warning to the console. A script reload (`/reload`) drops pending tick
callbacks without running finalizers.

## Differences from upstream Effect

None of these install anything on the global object.

| Upstream use | On Bedrock |
| --- | --- |
| `setTimeout` in the default `Clock` | Used if the host has it; otherwise `sleep` fails with guidance to provide `Bedrock.layer(system)`. |
| `setImmediate`/`setTimeout` in the default `Scheduler` | Used if present; otherwise microtasks, as upstream does when timers are unavailable. `Bedrock.layer` replaces the scheduler. |
| `AbortController` for `Effect.callback`, `Effect.tryPromise` and `Effect.abortSignal` | The host's controller if present; otherwise a private fallback. Signals are typed by a structural `AbortSignal` interface that standard signals satisfy. |
| `crypto.getRandomValues` for the default `Random` seed | Used if present; otherwise `Math.random`. The default `Random` is not cryptographically secure on Bedrock. |
| `TextEncoder` for string seeds of `Random.withSeed` | The package's private UTF-8 encoder. |
| `performance.now` and `process.hrtime` | Used if present; otherwise `Date.now`, as upstream already allows. |
| Default `Console` service | Reads `globalThis.console`. Bedrock's console has `log`, `warn`, `error` and `info`; console methods beyond those are unavailable. |
| Tracing stack frames | Captured through `Error` stacks. Bedrock's QuickJS engine formats stacks differently from V8, so span locations may be missing. |
| `Cron` named time zones | Need `Intl.DateTimeFormat`, which Bedrock may lack. UTC and fixed offsets need no `Intl`. |

The upstream modules `Logger`, `RequestResolver`, `DateTime`, `Stream`, `Channel`,
`Queue`, `PubSub`, `Semaphore` and their platform modules are not included. The
runtime refers to some of their types through private declarations only.

## Verification

Run `npm run verify:runtime --workspace @bedform/effect`. It checks:

- **Parity with upstream.** Every runtime module's runtime exports and emitted
  declarations match `effect@4.0.5`, apart from the documented namespace
  extractions.
- **Behavior against upstream.** Scenarios covering layers, scopes, fibers,
  schedules, refs and `ManagedRuntime` give the same results as upstream.
- **Simulated Bedrock.** Programs run in a sandbox with only ECMAScript
  built-ins, driven by a simulated tick loop. A simulated clock checks that
  each tick's work stays within the scheduler budget plus one slice.
- **Emitted code.** No unguarded host globals and no imports outside the
  package.
- **Packed consumers.** A packed package type-checks against
  `@minecraft/server`'s `System`, and pure imports tree-shake the runtime away.

`npm run test:bds --workspace @bedform/effect` runs a fixture add-on on a copy
of Bedrock Dedicated Server at the fixed
`dist/bds-runtime/bedrock_server.exe`, which `npm run firewall:configure`
covers. Set `BDS_PATH` (or `BDS_ROOT`) to the installation to copy and
`BDS_EXPECTED_VERSION` when it is not 1.26.60. Missing prerequisites are
reported as unrun, never as a pass. The fixture checks:

- layers, scoped resources, schedules, interruption and `Deferred`;
- sleeps rounded up to whole ticks, and `Bedrock.nextTick`;
- 200,000 effect steps spread over ticks without tripping the watchdog;
- world writes after a microtask and after a tick;
- `Random` and abort signals without host `crypto` or `AbortController`;
- a weather before-event raised with `weather rain`: the handler is read-only,
  `runSync` cancels the event, a forked fiber resumes in a microtask in the
  same tick and may write, and cancelling after a wait has no effect;
- layer finalizers run by `disposeOnShutdown` when the server stops.

It passed on BDS 1.26.60.6 (`MineCraft-isg.21.5`) and on 1.26.63.1. One run
spread the 200,000 steps over 49 ticks.
