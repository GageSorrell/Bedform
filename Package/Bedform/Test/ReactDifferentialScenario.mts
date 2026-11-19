/**
 * Runs identical observable React contracts against an independent Node oracle or restricted port.
 *
 * @module bedform/Test/ReactDifferentialScenario
 *
 * @file      ReactDifferentialScenario.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/* Fixtures retain hook call order and infer callbacks from the public React signatures. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */
import type * as Api from "../Source/Spatial/React/index.js";
import * as Host from "../Source/Spatial/Internal/React/Host.js";
import type { Bundle, Root, RootOptions } from "./ReactHarness.mjs";
import { Capture, CreateRoot, FakeSystem, Install, Print, Restricted } from "./ReactHarness.mjs";
import type { Flavor } from "../Tool/ReactVendor.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Observable server-side behavior, without scheduler turn counts, generated IDs or diagnostic stacks.
 *
 * @category Testing
 * @since 1.0.0
 */
export interface Observation {
    readonly Events: Array<string>;
    readonly Snapshots: Array<string>;
    readonly Commits: Array<Array<string>>;
}

/**
 * A manually settled resource used to reach pending, successful and failed render checkpoints.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Deferred<Value> {
    readonly Promise: Promise<Value>;
    readonly Resolve: (value: Value) => void;
    readonly Reject: (reason: Error) => void;
}

/**
 * Creates a resource whose settlement is controlled by the scenario.
 *
 * @category Testing
 * @since 1.0.0
 */
function Defer<Value>(): Deferred<Value>
{
    let Resolve!: (value: Value) => void;
    let Reject!: (reason: Error) => void;
    const resource = new Promise<Value>((resolve, reject) =>
    {
        Resolve = resolve;
        Reject = reject;
    });
    // The rejection is also observed by React; this prevents the fixture itself becoming unhandled.
    void resource.catch(() => undefined);
    return { Promise: resource,
        Resolve,
        Reject };
}

/**
 * A scenario's shared host, React instance, root ownership and observations.
 *
 * @category Testing
 * @since 1.0.0
 */
class Fixture
{
    readonly React: typeof Api;
    readonly System = new FakeSystem();
    readonly Roots: Array<Root> = [];
    readonly Events: Array<string> = [];
    readonly Snapshots: Array<string> = [];
    constructor(readonly Vendor: Bundle)
    {
        this.React = Vendor.React as unknown as typeof Api;
    }

    /**
     * Binds the same observation-only renderer for either React implementation.
     *
     * @category Testing
     * @since 1.0.0
     */
    Root(options: RootOptions = {}): Root
    {
        const root = CreateRoot(this.Vendor, this.System, {
            OnCaughtError: (error) => this.Events.push(`caught:${(error as Error).message}`),
            OnUncaughtError: (error) => this.Events.push(`uncaught:${(error as Error).message}`),
            OnRecoverableError: (error) => this.Events.push(`recoverable:${(error as Error).message}`),
            ...options
        });
        this.Roots.push(root);
        return root;
    }

    /**
     * Records a stable semantic checkpoint after its effects have run.
     *
     * @category Testing
     * @since 1.0.0
     */
    Mark(label: string): void
    {
        for (const root of this.Roots)
        {
            root.FlushEffects();
        }

        this.Snapshots.push(`${label}:${this.Roots.map((root) => Print(root.Container)).join(" / ")}`);
    }

    /**
     * Pumps Node tasks, Promise jobs and injected host ticks without assuming equal scheduling latency.
     *
     * @throws { assert.AssertionError } When the checkpoint does not become observable.
     *
     * @category Testing
     * @since 1.0.0
     */
    async Until(predicate: () => boolean, label: string): Promise<void>
    {
        for (let turn = 0; turn < 300; turn++)
        {
            for (const root of this.Roots)
            {
                root.FlushEffects();
            }

            if (predicate())
            {
                return;
            }

            await this.System.Step();
        }

        assert.fail(`No ${label}; tree=${this.Roots.map((root) => Print(root.Container)).join(" / ")}`);
    }

    /**
     * Lets scheduled retries and subscriptions run after a checkpoint or resource settlement.
     *
     * @category Testing
     * @since 1.0.0
     */
    async Drain(): Promise<void>
    {
        for (let turn = 0; turn < 8; turn++)
        {
            await this.System.Step();
            for (const root of this.Roots)
            {
                root.FlushEffects();
            }
        }
    }

    /**
     * Unmounts every owned root and returns observations after cleanup and stale retries.
     *
     * @category Testing
     * @since 1.0.0
     */
    async Finish(): Promise<Observation>
    {
        for (const root of this.Roots)
        {
            root.Sync(() => root.Render(null));
        }

        await this.Drain();
        assert.ok(this.Roots.every((root) => Print(root.Container) === ""));
        return { Events: this.Events,
            Snapshots: this.Snapshots,
            Commits: this.Roots.map((root) => root.Commits) };
    }
}

/**
 * State initialization, functional updates, reducers, refs, memoization and identifier invariants.
 *
 * @category Testing
 * @since 1.0.0
 */
async function State(fixture: Fixture): Promise<void>
{
    const { React, Events } = fixture;
    const root = fixture.Root({ Prefix: "state-" });
    let set!: Api.Dispatch<Api.SetStateAction<number>>;
    let dispatch!: Api.Dispatch<number>;
    let firstRef: Api.RefObject<number> | undefined;
    let firstId: string | undefined;
    let lastMemo: object | undefined;
    let lastCallback: (() => number) | undefined;
    let lastCount: number | undefined;
    let renders = 0;
    const Probe = ({ initial }: {
        initial: number;
    }): Api.ReactNode =>
    {
        renders++;
        const [ count, update ] = React.useState(() =>
        {
            Events.push("state:init");
            return 1;
        });
        const [ total, add ] = React.useReducer((value: number, delta: number) => value + delta, 2, (value) =>
        {
            Events.push("reducer:init");
            return value * 2;
        });
        set = update;
        dispatch = add;
        const ref = React.useRef(initial);
        const id = React.useId();
        const memo = React.useMemo(() =>
        {
            Events.push(`memo:${count}`);
            return { count };
        }, [ count ]);
        const callback = React.useCallback(() => count, [ count ]);
        if (firstRef === undefined)
        {
            firstRef = ref;
            firstId = id;
        }
        else
        {
            assert.equal(ref, firstRef);
            assert.equal(id, firstId);
            assert.equal(memo === lastMemo, count === lastCount);
            assert.equal(callback === lastCallback, count === lastCount);
        }

        assert.ok(id.includes("state-"));
        lastMemo = memo;
        lastCallback = callback;
        lastCount = count;
        return React.createElement("state", { count,
            total,
            ref: undefined,
            stored: ref.current,
            memo: memo.count,
            callback: callback() });
    };

    root.Sync(() => root.Render(React.createElement(Probe, { initial: 3 })));
    fixture.Mark("initial");
    root.Sync(() =>
    {
        set((value) => value + 1);
        dispatch(5);
    });
    fixture.Mark("updated");
    const before = renders;
    firstRef!.current = 9;
    await fixture.Drain();
    assert.equal(renders, before, "Ref mutation must not schedule a render.");
    root.Sync(() => root.Render(React.createElement(Probe, { initial: 99 })));
    assert.ok(Print(root.Container).includes("stored=9"));
    fixture.Mark("later-initial-ignored");
}

/**
 * Insertion, layout and passive ordering; effect events; imperative handles and cleanup signatures.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Effects(fixture: Fixture): Promise<void>
{
    const { React, Events } = fixture;
    const root = fixture.Root();
    const ref = React.createRef<{
        Value: number;
    }>();
    const Probe = ({ value }: {
        value: number;
    }): Api.ReactNode =>
    {
        const event = React.useEffectEvent(() => value);
        React.useDebugValue(value, () =>
        {
            assert.fail("Debug formatting requires DevTools.");
        });
        React.useImperativeHandle(ref, () => ({ Value: value }), [ value ]);
        for (const [ name, effect ] of [ [ "insertion", React.useInsertionEffect ],
            [ "layout", React.useLayoutEffect ], [ "passive", React.useEffect ] ] as const)
        {
            effect(() =>
            {
                Events.push(`${name}:setup:${value}`);
                return (...args: Array<unknown>): void =>
                {
                    assert.equal(args.length, 0);
                    Events.push(`${name}:cleanup:${value}`);
                };
            }, [ value ]);
        }

        React.useEffect(() =>
        {
            Events.push(`event:${event()}`);
        });
        React.useEffect(() =>
        {
            Events.push("once");
        }, []);
        return React.createElement("effects", { value });
    };

    root.Sync(() => root.Render(React.createElement(Probe, { value: 1 })));
    fixture.Mark("mount");
    assert.equal(ref.current?.Value, 1);
    root.Sync(() => root.Render(React.createElement(Probe, { value: 1 })));
    fixture.Mark("same-dependency");
    root.Sync(() => root.Render(React.createElement(Probe, { value: 2 })));
    fixture.Mark("changed-dependency");
    assert.equal(ref.current?.Value, 2);
    root.Sync(() => root.Render(null));
    fixture.Mark("removed");
    assert.equal(ref.current, null);
    assert.deepEqual(Events.filter((event) => event.startsWith("event:")),
        [ "event:1", "event:1", "event:2" ]);
    assert.equal(Events.filter((event) => event === "once").length, 1);
    for (const name of [ "insertion", "layout", "passive" ])
    {
        assert.deepEqual(Events.filter((event) => event.startsWith(name + ":")), [
            `${name}:setup:1`, `${name}:cleanup:1`, `${name}:setup:2`, `${name}:cleanup:2`
        ]);
    }

    await fixture.Drain();
}

/**
 * Context propagation and the context form of use(), including nested providers and isolated roots.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Context(fixture: Fixture): Promise<void>
{
    const { React } = fixture;
    const ContextValue = React.createContext("default");
    const ids = new Map<string, string>();
    const Probe = ({ name }: {
        name: string;
    }): Api.ReactNode =>
    {
        const id = React.useId();
        const previous = ids.get(name);
        if (previous !== undefined)
        {
            assert.equal(id, previous);
        }

        ids.set(name, id);
        return React.createElement("context", { name,
            hook: React.useContext(ContextValue),
            resource: React.use(ContextValue) });
    };

    const a = fixture.Root({ Prefix: "a-" });
    const b = fixture.Root({ Prefix: "b-" });
    const tree = (value: string): Api.ReactNode => React.createElement(ContextValue, { value },
        React.createElement(Probe, { name: "outer" }),
        React.createElement(ContextValue, { value: "nested" },
            React.createElement(Probe, { name: "nested" })));
    a.Sync(() => a.Render(tree("first")));
    b.Sync(() => b.Render(React.createElement(Probe, { name: "other-root" })));
    fixture.Mark("provided");
    a.Sync(() => a.Render(tree("second")));
    fixture.Mark("propagated");
    assert.equal(new Set(ids.values()).size, 3);
    assert.ok(Print(b.Container).includes("hook=default resource=default"));
    await fixture.Drain();
}

/**
 * External snapshot consistency, subscribe-time mutations and per-root unsubscribe ownership.
 *
 * @category Testing
 * @since 1.0.0
 */
async function ExternalStore(fixture: Fixture): Promise<void>
{
    const { React, Events } = fixture;
    const listeners = new Set<() => void>();
    let snapshot = 0;
    let changedDuringSubscribe = false;
    const subscribe = (listener: () => void): (() => void) =>
    {
        listeners.add(listener);
        Events.push("subscribe");
        if (!changedDuringSubscribe)
        {
            changedDuringSubscribe = true;
            snapshot = 1;
        }

        return () =>
        {
            assert.ok(listeners.delete(listener));
            Events.push("unsubscribe");
        };
    };

    const read = (): number => snapshot;
    const Probe = (): Api.ReactNode => React.createElement("store", {
        value: React.useSyncExternalStore(subscribe, read)
    });
    const a = fixture.Root();
    const b = fixture.Root();
    a.Sync(() => a.Render(React.createElement(Probe)));
    await fixture.Until(() => Print(a.Container).includes("value=1"), "subscribe-time recheck");
    b.Sync(() => b.Render(React.createElement(Probe)));
    fixture.Mark("subscribed");
    assert.equal(listeners.size, 2);
    a.Sync(() =>
    {
        snapshot = 2;
        for (const notify of listeners)
        {
            notify();
        }
    });
    fixture.Mark("notified");
    a.Sync(() => a.Render(null));
    fixture.Mark("one-root-removed");
    assert.equal(listeners.size, 1);
    b.Sync(() =>
    {
        snapshot = 3;
        for (const notify of listeners)
        {
            notify();
        }
    });
    fixture.Mark("remaining-root");
    b.Sync(() => b.Render(null));
    fixture.Mark("unsubscribed");
    assert.equal(listeners.size, 0);
}

/**
 * Constructs an ordinary class error boundary, retaining lifecycle observations.
 *
 * @category Testing
 * @since 1.0.0
 */
function Boundary(fixture: Fixture): Api.ComponentClass<Api.PropsWithChildren>
{
    const { React, Events } = fixture;
    return class Boundary extends React.Component<Api.PropsWithChildren, {
        Failed: boolean;
    }>
    {
        state = { Failed: false };

        /**
         * Switches the boundary to its fallback after a child fails.
         *
         * @category ErrorHandling
         * @since 1.0.0
         */
        static getDerivedStateFromError(): {
            Failed: boolean;
        }
        {
            return { Failed: true };
        }

        /**
         * Records the caught error independently of diagnostic stack formatting.
         *
         * @category Testing
         * @since 1.0.0
         */
        componentDidCatch(error: Error): void
        {
            Events.push(`boundary:${error.message}`);
        }

        /**
         * Returns children or the error fallback.
         *
         * @category Testing
         * @since 1.0.0
         */
        render(): Api.ReactNode
        {
            return this.state.Failed ? React.createElement("failure") : this.props.children;
        }
    };
}

/**
 * Reads pending and fulfilled Promise resources through use(), propagating rejections to a boundary.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Resource(fixture: Fixture): Promise<void>
{
    const { React } = fixture;
    const root = fixture.Root();
    const resource = Defer<string>();
    const Read = ({ promise }: {
        promise: Promise<string>;
    }): Api.ReactNode => React.createElement("resource", null, React.use(promise));
    const Catch = Boundary(fixture);
    root.Sync(() => root.Render(React.createElement(React.Suspense, {
        fallback: React.createElement("pending")
    }, React.createElement(Read, { promise: resource.Promise }))));
    assert.equal(Print(root.Container), "<pending></pending>");
    fixture.Mark("pending");
    resource.Resolve("fulfilled");
    await fixture.Until(() => Print(root.Container).includes("fulfilled"), "fulfilled resource");
    fixture.Mark("fulfilled");
    const failed = Defer<string>();
    root.Sync(() => root.Render(React.createElement(Catch, null,
        React.createElement(React.Suspense, { fallback: React.createElement("pending") },
            React.createElement(Read, { promise: failed.Promise })))));
    failed.Reject(new Error("resource failed"));
    await fixture.Until(() => Print(root.Container) === "<failure></failure>", "rejected resource boundary");
    fixture.Mark("rejected");
}

/**
 * Action state and optimistic projection retain pending state, successful commits and failure rollback.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Actions(fixture: Fixture): Promise<void>
{
    const { React, Events } = fixture;
    const root = fixture.Root();
    const Catch = Boundary(fixture);
    let gate = Defer<void>();
    let invoke!: (value: number) => void;
    const Probe = (): Api.ReactNode =>
    {
        const [ state, dispatch, pending ] = React.useActionState(async (previous: number, delta: number) =>
        {
            Events.push(`action:${previous}+${delta}`);
            await gate.Promise;
            return previous + delta;
        }, 0);
        const [ optimistic, project ] = React.useOptimistic(state,
            (value: number, delta: number) => value + delta);
        invoke = (delta) => React.startTransition(() =>
        {
            project(delta);
            dispatch(delta);
        });
        return React.createElement("action", { value: optimistic,
            pending });
    };

    root.Sync(() => root.Render(React.createElement(Catch, null, React.createElement(Probe))));
    fixture.Mark("initial");
    invoke(3);
    await fixture.Until(() => Print(root.Container).includes("value=3 pending=true"), "optimistic action");
    fixture.Mark("optimistic");
    gate.Resolve();
    await fixture.Until(() => Print(root.Container).includes("value=3 pending=false"), "completed action");
    fixture.Mark("completed");
    gate = Defer<void>();
    invoke(4);
    await fixture.Until(() => Print(root.Container).includes("value=7 pending=true"),
        "second optimistic action");
    fixture.Mark("optimistic-failure");
    gate.Reject(new Error("action failed"));
    await fixture.Until(() => Print(root.Container) === "<failure></failure>", "action failure boundary");
    fixture.Mark("failed");
    assert.deepEqual(Events.filter((event) => event.startsWith("action:")), [ "action:0+3", "action:3+4" ]);
    assert.ok(!Print(root.Container).includes("value=7"));
}

/**
 * Keys preserve hook state and host identity through movement; removal cleans up only the removed item.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Keyed(fixture: Fixture): Promise<void>
{
    const { React, Events } = fixture;
    const root = fixture.Root();
    let next = 0;
    const Item = React.memo(({ name }: {
        name: string;
    }): Api.ReactNode =>
    {
        const [ token ] = React.useState(() => ++next);
        React.useEffect(() =>
        {
            Events.push(`mount:${name}`);
            return () =>
            {
                Events.push(`remove:${name}`);
            };
        }, []);
        return React.createElement("item", { name,
            token });
    });
    const tree = (names: Array<string>): Api.ReactNode =>
        names.map((name) => React.createElement(Item, { key: name,
            name }));
    root.Sync(() => root.Render(tree([ "a", "b", "c" ])));
    fixture.Mark("initial");
    const [ a, b, c ] = root.Container.children;
    root.Sync(() => root.Render(tree([ "c", "a", "b" ])));
    fixture.Mark("moved");
    assert.deepEqual(root.Container.children, [ c, a, b ]);
    assert.equal(root.Container.children[0], c);
    assert.equal(next, 3);
    root.Sync(() => root.Render(tree([ "c", "d", "a" ])));
    fixture.Mark("replaced");
    assert.equal(root.Container.children[0], c);
    assert.equal(root.Container.children[2], a);
    assert.equal(next, 4);
    assert.ok(Events.includes("remove:b"));
    await fixture.Drain();
}

/**
 * Lazy components suspend, mount after module resolution and route both caught and uncaught errors.
 *
 * @category Testing
 * @since 1.0.0
 */
async function LazyErrors(fixture: Fixture): Promise<void>
{
    const { React, Events } = fixture;
    const root = fixture.Root();
    const module = Defer<{
        default: Api.ComponentType;
    }>();
    const Lazy = React.lazy(() =>
    {
        Events.push("lazy:load");
        return module.Promise;
    });
    const Loaded = (): Api.ReactNode =>
    {
        React.useEffect(() =>
        {
            Events.push("lazy:mount");
            return () =>
            {
                Events.push("lazy:cleanup");
            };
        }, []);
        return React.createElement("loaded");
    };

    root.Sync(() => root.Render(React.createElement(React.Suspense,
        { fallback: React.createElement("pending") }, React.createElement(Lazy))));
    fixture.Mark("loading");
    module.Resolve({ default: Loaded });
    await fixture.Until(() => Print(root.Container) === "<loaded></loaded>", "lazy module");
    fixture.Mark("loaded");
    const Broken = (): never =>
    {
        throw new Error("render failed");
    };

    root.Sync(() => root.Render(React.createElement(Boundary(fixture), null, React.createElement(Broken))));
    fixture.Mark("caught");
    assert.equal(Print(root.Container), "<failure></failure>");
    root.Sync(() => root.Render(React.createElement(Broken)));
    fixture.Mark("uncaught");
    assert.equal(Print(root.Container), "");
    assert.ok(Events.includes("uncaught:render failed"));
}

/**
 * Urgent lanes precede transitions, deferred values catch up and transition pending state clears.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Transitions(fixture: Fixture): Promise<void>
{
    const { React } = fixture;
    const root = fixture.Root();
    let urgent!: Api.Dispatch<number>;
    let transition!: () => void;
    const Probe = (): Api.ReactNode =>
    {
        const [ fast, setFast ] = React.useState(0);
        const [ slow, setSlow ] = React.useState(0);
        const [ pending, start ] = React.useTransition();
        const deferred = React.useDeferredValue(fast);
        urgent = setFast;
        transition = () => start(() => setSlow(1));
        return React.createElement("lanes", { fast,
            slow,
            deferred,
            pending });
    };

    root.Sync(() => root.Render(React.createElement(Probe)));
    fixture.Mark("initial");
    transition();
    root.Sync(() => urgent(1));
    fixture.Mark("urgent");
    assert.ok(Print(root.Container).includes("fast=1 slow=0 deferred=0 pending=true"));
    await fixture.Until(() => Print(root.Container).includes("fast=1 slow=1 deferred=1 pending=false"),
        "transition and deferred value completion");
    fixture.Mark("completed");
}

/**
 * An attempted suspended transition is superseded; neither its effects nor stale resource retries commit.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Abandoned(fixture: Fixture): Promise<void>
{
    const { React, Events } = fixture;
    const root = fixture.Root();
    const gate = Defer<void>();
    let advance!: Api.Dispatch<number>;
    let attempted = false;
    const Probe = (): Api.ReactNode =>
    {
        const [ value, set ] = React.useState(0);
        advance = set;
        React.useLayoutEffect(() =>
        {
            Events.push(`layout:${value}`);
            return () =>
            {
                Events.push(`layout-cleanup:${value}`);
            };
        }, [ value ]);
        React.useEffect(() =>
        {
            Events.push(`passive:${value}`);
            return () =>
            {
                Events.push(`passive-cleanup:${value}`);
            };
        }, [ value ]);
        if (value === 1)
        {
            attempted = true;
            React.use(gate.Promise);
        }

        return React.createElement("attempt", { value });
    };

    root.Sync(() => root.Render(React.createElement(React.Suspense, {
        fallback: React.createElement("pending")
    }, React.createElement(Probe))));
    fixture.Mark("initial");
    React.startTransition(() => advance(1));
    await fixture.Until(() => attempted, "an actual abandoned render attempt");
    assert.ok(Print(root.Container).includes("value=0"));
    fixture.Mark("attempted-without-commit");
    root.Sync(() => root.Render(React.createElement("replacement")));
    fixture.Mark("superseded");
    gate.Resolve();
    await fixture.Drain();
    fixture.Mark("stale-resource-resolved");
    assert.equal(Print(root.Container), "<replacement></replacement>");
    assert.ok(!Events.includes("layout:1") && !Events.includes("passive:1"));
    assert.ok(root.Commits.every((commit) => !commit.includes("value=1")));
}

/**
 * StrictMode effect replay and Activity visibility retain state while disconnecting hidden effects.
 *
 * @category Testing
 * @since 1.0.0
 */
async function StrictActivity(fixture: Fixture): Promise<void>
{
    const { React, Events } = fixture;
    const root = fixture.Root({ Strict: true });
    let update!: Api.Dispatch<number>;
    const Probe = (): Api.ReactNode =>
    {
        const [ value, set ] = React.useState(1);
        update = set;
        React.useEffect(() =>
        {
            Events.push("connected");
            return () =>
            {
                Events.push("disconnected");
            };
        }, []);
        return React.createElement("activity", { value });
    };

    const tree = (mode: "visible" | "hidden"): Api.ReactNode => React.createElement(React.Activity, { mode,
        children: React.createElement(Probe) });
    root.Sync(() => root.Render(tree("visible")));
    fixture.Mark("visible");
    assert.deepEqual(Events, process.env.NODE_ENV === "development"
        ? [ "connected", "disconnected", "connected" ] : [ "connected" ]);
    root.Sync(() => update(2));
    fixture.Mark("updated");
    root.Sync(() => root.Render(tree("hidden")));
    fixture.Mark("hidden");
    assert.equal(Print(root.Container), "");
    root.Sync(() => root.Render(tree("visible")));
    fixture.Mark("visible-again");
    assert.equal(Print(root.Container), "<activity value=2></activity>");
    await fixture.Drain();
}

/**
 * Explicit scenario inventory; both implementations execute the same functions and assertions.
 *
 * @category Testing
 * @since 1.0.0
 */
export const Scenarios = Object.freeze({ State,
    Effects,
    Context,
    ExternalStore,
    Resource,
    Actions,
    Keyed,
    LazyErrors,
    Transitions,
    Abandoned,
    StrictActivity });

/**
 * Selects unmodified packages loaded through Node's CommonJS resolver, or a restricted adapted realm.
 *
 * @throws { Error } When an implementation, flavor or scenario cannot be loaded.
 *
 * @category Testing
 * @since 1.0.0
 */
export async function Run(
    implementation: "upstream" | "port", flavor: Flavor, directory: string, scenario: keyof typeof Scenarios
): Promise<Observation>
{
    let vendor: Bundle;
    let accesses: Array<string> = [];
    if (implementation === "upstream")
    {
        assert.equal(process.env.NODE_ENV, flavor);
        const require = createRequire(path.join(directory, "package.json"));
        for (const name of [ "react", "react-reconciler", "scheduler" ])
        {
            assert.ok(require.resolve(name).startsWith(path.join(directory, "node_modules")));
        }

        vendor = { Host,
            React: require("react"),
            Reconciler: require("react-reconciler"),
            Scheduler: require("scheduler"),
            ReconcilerConstants: require("react-reconciler/constants"),
            JsxRuntime: require("react/jsx-runtime"),
            JsxDevRuntime: require("react/jsx-dev-runtime") };
    }
    else
    {
        const realm = await Restricted(flavor === "development" ? "public" : "production");
        vendor = realm.Vendor;
        accesses = realm.Accesses;
    }

    assert.equal(vendor.React.version, "19.3.1");
    const fixture = new Fixture(vendor);
    const uninstall = implementation === "port"
        ? Install(vendor, fixture.System, { Console: Capture().Console }) : () => undefined;
    try
    {
        await Scenarios[scenario](fixture);
        const observation = await fixture.Finish();
        assert.deepEqual(accesses, [], "The port read a forbidden host global.");
        return observation;
    }
    finally
    {
        uninstall();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
{
    const [ implementation, flavor, directory, scenario ] = process.argv.slice(2);
    assert.ok(implementation === "port" || implementation === "upstream");
    assert.ok(flavor === "development" || flavor === "production");
    assert.ok(directory && scenario && Object.hasOwn(Scenarios, scenario));
    const observation = await Run(implementation, flavor, directory, scenario as keyof typeof Scenarios);
    process.send?.(observation);
    process.disconnect?.();
}
