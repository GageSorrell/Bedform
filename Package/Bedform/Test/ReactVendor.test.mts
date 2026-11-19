/**
 * Qualifies the vendored React port: reproducible generation, imports and rendering inside a
 * restricted script realm that records every Node or browser global probe, tick-budget yielding,
 * cancellation, urgent work ahead of transitions, host error routing and the Bedrock System host.
 *
 * @module bedform/Test/ReactVendor.test
 *
 * @file      ReactVendor.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fakes mirror untyped upstream host-configuration and scheduler callback shapes. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import type * as HostModule from "../Source/Spatial/Internal/React/Host.js";
import { NoticesFile, OutputDirectory, Outputs, Run, Shadows } from "../Tool/ReactVendor.mjs";
import type { ReconcilerFactory, SchedulerModule, VendorModule } from "../Source/Spatial/Internal/React/Types.js";
import { createContext, runInContext } from "node:vm";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Node and browser globals the vendored sources must never read. ECMAScript intrinsics and the
 * script engine's `console`, which Bedrock also provides, are permitted.
 *
 * @category Testing
 * @since 1.0.0
 */
const Forbidden: ReadonlyArray<string> = [
    "process", "Buffer", "global", "require", "module", "exports", "__dirname", "__filename",
    "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate",
    "queueMicrotask", "structuredClone", "performance", "MessageChannel", "MessagePort", "MessageEvent",
    "Event", "EventTarget", "ErrorEvent", "CustomEvent", "AbortController", "AbortSignal", "TextEncoder",
    "TextDecoder", "URL", "URLSearchParams", "fetch", "crypto", "navigator", "window", "self", "document",
    "location", "history", "reportError", "requestAnimationFrame", "cancelAnimationFrame",
    "requestIdleCallback", "localStorage", "sessionStorage", "__REACT_DEVTOOLS_GLOBAL_HOOK__",
    "IS_REACT_ACT_ENVIRONMENT", "Deno", "Bun"
];

/**
 * Upstream build flavor.
 *
 * @category Testing
 * @since 1.0.0
 */
type Flavor = "development" | "production";

/**
 * A state setter accepting a value or an updater.
 *
 * @category Testing
 * @since 1.0.0
 */
type Setter<S> = (next: S | ((previous: S) => S)) => void;

/**
 * An effect callback with optional cleanup.
 *
 * @category Testing
 * @since 1.0.0
 */
type Effect = () => void | (() => void);

export namespace ReactApi
{
    /**
     * A mutable ref object.
     *
     * @category Testing
     * @since 1.0.0
     */
    export interface Ref<R>
    {
        current: R;
    }
}

/**
 * React element creation and hooks used by these fixtures.
 *
 * @category Testing
 * @since 1.0.0
 */
export interface ReactApi
{
    readonly version: string;
    readonly createElement: (type: unknown, props?: object | null, ...children: ReadonlyArray<unknown>) => unknown;
    readonly createContext: (value: unknown) => unknown;
    readonly startTransition: (scope: () => void) => void;
    readonly useState: <S>(initial: S) => [ S, Setter<S> ];
    readonly useEffect: (effect: Effect, dependencies?: ReadonlyArray<unknown>) => void;
    readonly useLayoutEffect: (effect: Effect, dependencies?: ReadonlyArray<unknown>) => void;
    readonly useMemo: <R>(factory: () => R, dependencies: ReadonlyArray<unknown>) => R;
    readonly useReducer: <S, A>(reducer: (state: S, action: A) => S, initial: S) => [ S, (action: A) => void ];
    readonly useRef: <R>(initial: R) => ReactApi.Ref<R>;
    readonly useId: () => string;
}

/**
 * Reconciler exports used by these fixtures.
 *
 * @category Testing
 * @since 1.0.0
 */
interface ReconcilerApi
{
    readonly createContainer: (...arguments_: ReadonlyArray<unknown>) => unknown;
    readonly updateContainer: (element: unknown, root: unknown, parent: null, callback: null) => unknown;
    readonly defaultOnUncaughtError: (error: unknown) => void;
    readonly defaultOnCaughtError: (error: unknown) => void;
    readonly defaultOnRecoverableError: (error: unknown) => void;
}

/**
 * Exports of a bundle evaluated in a restricted realm.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Bundle
{
    readonly Host: typeof HostModule;
    readonly React: ReactApi & VendorModule;
    readonly JsxRuntime: VendorModule;
    readonly JsxDevRuntime: VendorModule;
    readonly Scheduler: SchedulerModule;
    readonly Reconciler: ReconcilerFactory;
    readonly ReconcilerConstants: VendorModule;
}

/**
 * A restricted realm and the forbidden globals its code touched.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Realm
{
    readonly Vendor: Bundle;
    readonly Accesses: Array<string>;
}

const Directory = fileURLToPath(new URL("../Source/Spatial/Internal/React/", import.meta.url));
const Code = new Map<Flavor, string>();

/**
 * Bundles one flavor of the vendored modules and the host into an IIFE, once per flavor.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Bundled(flavor: Flavor): Promise<string>
{
    const cached = Code.get(flavor);
    if (cached !== undefined)
    {
        return cached;
    }

    const names = [ "React", "JsxRuntime", "JsxDevRuntime", "Scheduler", "Reconciler", "ReconcilerConstants" ];
    const result = await build({
        stdin: {
            contents: [
                "export * as Host from \"./Host.ts\";",
                ...names.map((name) => `export { Module as ${name} } from "./Vendor/${name}.${flavor}.generated.ts";`)
            ].join("\n"),
            resolveDir: Directory,
            loader: "ts"
        },
        bundle: true,
        format: "iife",
        globalName: "Vendor",
        platform: "neutral",
        target: "es2022",
        write: false,
        logLevel: "silent"
    });
    const code = result.outputFiles[0]?.text ?? "";
    Code.set(flavor, code);
    return code;
}

/**
 * Evaluates a flavor's bundle in a fresh realm whose forbidden globals record every read.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Restricted(flavor: Flavor): Promise<Realm>
{
    const accesses: Array<string> = [];
    const sandbox: Record<string, unknown> = {};
    for (const name of Forbidden)
    {
        Object.defineProperty(sandbox, name, {
            get(): never
            {
                accesses.push(name);
                throw new ReferenceError(`Restricted host: ${name} is not available.`);
            },
            configurable: false,
            enumerable: false
        });
    }

    const context = createContext(sandbox);
    const vendor = runInContext(`${await Bundled(flavor)}\nVendor;`, context) as Bundle;
    return { Vendor: vendor, Accesses: accesses };
}

/**
 * A timer queued on the fake System.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Timer
{
    readonly Due: number;
    readonly Callback: () => void;
}

/**
 * Minecraft System fake with an explicit tick counter and a millisecond clock at 50 ms per tick.
 *
 * @category Testing
 * @since 1.0.0
 */
class FakeSystem implements HostModule.ReactHostSystem
{
    Tick = 0;
    Clock = 0;
    readonly Calls: Array<string> = [];
    private Next = 1;
    private readonly Timers = new Map<number, Timer>();

    readonly run = (callback: () => void): number =>
    {
        this.Calls.push("run");
        return this.Add(callback, 1);
    };

    readonly runTimeout = (callback: () => void, tickDelay = 1): number =>
    {
        this.Calls.push(`runTimeout:${tickDelay}`);
        return this.Add(callback, Math.max(1, tickDelay));
    };

    readonly clearRun = (runId: number): void =>
    {
        this.Calls.push(`clearRun:${runId}`);
        this.Timers.delete(runId);
    };

    /**
     * Number of queued timers.
     *
     * @category Testing
     * @since 1.0.0
     */
    get Pending(): number
    {
        return this.Timers.size;
    }

    /**
     * Queues a timer due after the given number of ticks.
     *
     * @category Testing
     * @since 1.0.0
     */
    private Add(callback: () => void, ticks: number): number
    {
        const id = this.Next++;
        this.Timers.set(id, { Due: this.Tick + ticks, Callback: callback });
        return id;
    }

    /**
     * Advances one tick, runs due timers in request order, then drains microtasks.
     *
     * @category Testing
     * @since 1.0.0
     */
    async Step(): Promise<void>
    {
        this.Tick += 1;
        this.Clock = this.Tick * 50;
        const due = [ ...this.Timers ].filter(([ , timer ]) => timer.Due <= this.Tick);
        for (const [ id, timer ] of due)
        {
            this.Timers.delete(id);
            timer.Callback();
        }

        await new Promise<void>((resolve) => setImmediate(resolve));
    }

    /**
     * Steps until no timers remain.
     *
     * @throws { assert.AssertionError } When work does not settle within the limit.
     *
     * @category Testing
     * @since 1.0.0
     */
    async Settle(limit = 40): Promise<void>
    {
        await new Promise<void>((resolve) => setImmediate(resolve));
        for (let step = 0; this.Pending > 0; step++)
        {
            assert.ok(step < limit, "React work did not settle.");
            await this.Step();
        }
    }
}

/**
 * Captured console output.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Captured
{
    readonly Console: HostModule.ReactHost.Console;
    readonly Lines: Array<string>;
}

/**
 * Creates a console that records every call.
 *
 * @category Testing
 * @since 1.0.0
 */
function Capture(): Captured
{
    const lines: Array<string> = [];
    const record = (method: string) => (...data: ReadonlyArray<unknown>): void =>
    {
        lines.push(`${method}: ${data.map(String).join(" ")}`);
    };
    return {
        Console: {
            error: record("error"),
            warn: record("warn"),
            info: record("info"),
            log: record("log"),
            group: record("group"),
            groupCollapsed: record("groupCollapsed"),
            groupEnd: record("groupEnd")
        },
        Lines: lines
    };
}

/**
 * Test host instance tree node.
 *
 * @category Testing
 * @since 1.0.0
 */
interface HostNode
{
    readonly type?: string;
    props?: Record<string, unknown>;
    text?: string;
    readonly children: Array<HostNode>;
}

/**
 * Copies props without `children`.
 *
 * @category Testing
 * @since 1.0.0
 */
function Attributes(props: Record<string, unknown>): Record<string, unknown>
{
    return Object.fromEntries(Object.entries(props).filter(([ key ]) => key !== "children"));
}

/**
 * Serializes a host tree for assertions.
 *
 * @category Testing
 * @since 1.0.0
 */
function Print(node: HostNode): string
{
    if (node.text !== undefined)
    {
        return JSON.stringify(node.text);
    }

    const attributes = Object.entries(node.props ?? {}).map(([ key, value ]) => ` ${key}=${String(value)}`).join("");
    const children = node.children.map(Print).join("");
    return node.type === undefined ? children : `<${node.type}${attributes}>${children}</${node.type}>`;
}

/**
 * Moves or inserts a child before a sibling, or at the end.
 *
 * @category Testing
 * @since 1.0.0
 */
function Insert(parent: HostNode, child: HostNode, before?: HostNode): void
{
    const existing = parent.children.indexOf(child);
    if (existing !== -1)
    {
        parent.children.splice(existing, 1);
    }

    const index = before === undefined ? -1 : parent.children.indexOf(before);
    parent.children.splice(index === -1 ? parent.children.length : index, 0, child);
}

/**
 * Removes a child.
 *
 * @category Testing
 * @since 1.0.0
 */
function Remove(parent: HostNode, child: HostNode): void
{
    parent.children.splice(parent.children.indexOf(child), 1);
}

/**
 * Builds a minimal mutation host configuration for react-reconciler@0.34.0.
 *
 * @category Testing
 * @since 1.0.0
 */
function Configuration(vendor: Bundle, system: FakeSystem, commits: Array<string>, container: HostNode): object
{
    let priority = 0;
    const noop = (): void => undefined;
    return {
        rendererPackageName: "bedform-react-vendor-test",
        rendererVersion: "1.0.0",
        supportsMutation: true,
        supportsPersistence: false,
        supportsHydration: false,
        supportsMicrotasks: true,
        supportsResources: false,
        supportsSingletons: false,
        supportsTestSelectors: false,
        isPrimaryRenderer: true,
        warnsIfNotActing: false,
        noTimeout: -1,
        NotPendingTransition: null,
        HostTransitionContext: vendor.React.createContext(null),
        scheduleMicrotask: (callback: () => void): void => void Promise.resolve().then(callback),
        scheduleTimeout: (callback: () => void, delay: number): number =>
            system.runTimeout(callback, Math.max(1, Math.ceil(delay / 50))),
        cancelTimeout: (id: number): void => system.clearRun(id),
        setCurrentUpdatePriority: (next: number): void =>
        {
            priority = next;
        },
        getCurrentUpdatePriority: (): number => priority,
        resolveUpdatePriority: (): number => priority === 0 ? 32 : priority,
        resolveEventType: (): null => null,
        resolveEventTimeStamp: (): number => -1.1,
        shouldAttemptEagerTransition: (): boolean => false,
        trackSchedulerEvent: noop,
        requestPostPaintCallback: noop,
        maySuspendCommit: (): boolean => false,
        maySuspendCommitOnUpdate: (): boolean => false,
        maySuspendCommitInSyncRender: (): boolean => false,
        preloadInstance: (): boolean => true,
        startSuspendingCommit: (): null => null,
        suspendInstance: noop,
        waitForCommitToBeReady: (): null => null,
        getSuspendedCommitReason: (): null => null,
        suspendOnActiveViewTransition: noop,
        createInstance: (type: string, props: Record<string, unknown>): HostNode =>
            ({ type, props: Attributes(props), children: [] }),
        createTextInstance: (text: string): HostNode => ({ text, children: [] }),
        appendInitialChild: (parent: HostNode, child: HostNode): void => Insert(parent, child),
        finalizeInitialChildren: (): boolean => false,
        shouldSetTextContent: (): boolean => false,
        getRootHostContext: (): object => ({}),
        getChildHostContext: (parent: object): object => parent,
        getPublicInstance: (instance: HostNode): HostNode => instance,
        prepareForCommit: (): null => null,
        resetAfterCommit: (): void =>
        {
            commits.push(Print(container));
        },
        preparePortalMount: noop,
        appendChild: (parent: HostNode, child: HostNode): void => Insert(parent, child),
        appendChildToContainer: (parent: HostNode, child: HostNode): void => Insert(parent, child),
        insertBefore: (parent: HostNode, child: HostNode, before: HostNode): void => Insert(parent, child, before),
        insertInContainerBefore: (parent: HostNode, child: HostNode, before: HostNode): void =>
            Insert(parent, child, before),
        removeChild: Remove,
        removeChildFromContainer: Remove,
        commitTextUpdate: (node: HostNode, _: string, text: string): void =>
        {
            node.text = text;
        },
        commitUpdate: (node: HostNode, ...[ , , props ]: [ string, object, Record<string, unknown> ]): void =>
        {
            node.props = Attributes(props);
        },
        commitMount: noop,
        resetTextContent: noop,
        clearContainer: (parent: HostNode): void =>
        {
            parent.children.length = 0;
        },
        hideInstance: noop,
        unhideInstance: noop,
        hideTextInstance: noop,
        unhideTextInstance: noop,
        detachDeletedInstance: noop,
        getInstanceFromNode: (): null => null,
        beforeActiveInstanceBlur: noop,
        afterActiveInstanceBlur: noop,
        prepareScopeUpdate: noop,
        getInstanceFromScope: (): null => null,
        resetFormInstance: noop,
        bindToConsole: () => noop
    };
}

/**
 * A rendered root and its observations.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Root
{
    readonly Container: HostNode;
    readonly Commits: Array<string>;
    readonly Render: (element: unknown) => void;
}

/**
 * Creates a concurrent root through the vendored reconciler.
 *
 * @category Testing
 * @since 1.0.0
 */
function CreateRoot(vendor: Bundle, system: FakeSystem): Root
{
    const container: HostNode = { children: [] };
    const commits: Array<string> = [];
    const configuration = Configuration(vendor, system, commits, container);
    const reconciler = vendor.Reconciler(configuration) as unknown as ReconcilerApi;
    const root = reconciler.createContainer(container, vendor.ReconcilerConstants.ConcurrentRoot, null, false, null,
        "", reconciler.defaultOnUncaughtError, reconciler.defaultOnCaughtError,
        reconciler.defaultOnRecoverableError, null, null);
    return {
        Container: container,
        Commits: commits,
        Render: (element: unknown): void =>
        {
            reconciler.updateContainer(element, root, null, null);
        }
    };
}

/**
 * Installs a System host on the realm's vendored modules.
 *
 * @category Testing
 * @since 1.0.0
 */
function Install(
    vendor: Bundle,
    system: FakeSystem,
    options: HostModule.ReactHostSystemOptions = {}
): () => void
{
    return vendor.Host.InstallReactHost(vendor.Host.CreateSystemReactHost(system,
        { Now: () => system.Clock, ...options }));
}

const Flavors: ReadonlyArray<Flavor> = [ "production", "development" ];

test("generation reproduces every vendored module and the notices byte for byte", async () =>
{
    assert.deepEqual(await Run(true), []);
    const notices = readFileSync(new URL(`../${NoticesFile}`, import.meta.url), "utf8");
    for (const pin of [ "react@19.3.1", "react-reconciler@0.34.0", "scheduler@0.28.0" ])
    {
        assert.ok(notices.includes(`\n## ${pin}\n`), `Notices record ${pin}.`);
    }

    assert.equal(notices.split("MIT License").length - 1, 3);
    for (const output of Outputs)
    {
        const file = new URL(`../${OutputDirectory}/${output.Name}.generated.ts`, import.meta.url);
        const text = readFileSync(file, "utf8");
        assert.match(text, /This module is auto-generated by Tool\/ReactVendor\.mts\./u);
        assert.match(text, /@license React/u);
        assert.ok(Shadows.every(([ name ]) => text.includes(`, ${name}`)));
    }
});

for (const flavor of Flavors)
{
    test(`${flavor} imports are inert and read no Node or browser globals`, async () =>
    {
        const { Vendor, Accesses } = await Restricted(flavor);
        assert.deepEqual(Accesses, []);
        assert.equal(Vendor.React.version, "19.3.1");
        assert.equal(typeof Vendor.Reconciler, "function");
        assert.equal(Vendor.Scheduler.unstable_NormalPriority, 3);
        assert.equal(Vendor.ReconcilerConstants.ConcurrentRoot, 1);
        assert.equal(typeof Vendor.JsxRuntime.jsx, "function");
        assert.equal(typeof Vendor.JsxDevRuntime.jsxDEV, flavor === "development" ? "function" : "undefined");
        assert.equal(Vendor.Host.GetReactHost(), undefined);
        const system = new FakeSystem();
        CreateRoot(Vendor, system);
        assert.deepEqual(Accesses, [], "Binding a host configuration probes no globals.");
        assert.equal(system.Pending, 0, "Creating a root schedules nothing.");
    });

    test(`${flavor} renders hooks and effects on ticks without global access`, async () =>
    {
        const { Vendor, Accesses } = await Restricted(flavor);
        const system = new FakeSystem();
        const output = Capture();
        const dispose = Install(Vendor, system, { Console: output.Console });
        const React = Vendor.React;
        const h = React.createElement;
        const effects: Array<string> = [];
        const Counter = (): unknown =>
        {
            const [ count, setCount ] = React.useState(0);
            const [ total, add ] = React.useReducer((sum: number, value: number) => sum + value, 0);
            const doubled = React.useMemo(() => count * 2, [ count ]);
            const renders = React.useRef(0);
            const id = React.useId();
            renders.current += 1;
            React.useLayoutEffect(() =>
            {
                effects.push(`layout ${count}`);
            }, [ count ]);
            React.useEffect(() =>
            {
                effects.push(`passive ${count}`);
                if (count < 3)
                {
                    setCount((previous) => previous + 1);
                    add(count);
                }
            }, [ count ]);
            return h("counter", { count, doubled, total, id: id.length > 0 }, `count ${count}`);
        };

        const root = CreateRoot(Vendor, system);
        root.Render(h(Counter));
        assert.deepEqual(root.Commits, [], "Rendering waits for a host tick.");
        await system.Settle();
        assert.equal(Print(root.Container), "<counter count=3 doubled=6 total=3 id=true>\"count 3\"</counter>");
        assert.deepEqual(effects, [ "layout 0", "passive 0", "layout 1", "passive 1", "layout 2", "passive 2",
            "layout 3", "passive 3" ]);
        root.Render(null);
        await system.Settle();
        assert.equal(Print(root.Container), "");
        assert.ok(system.Calls.includes("run"));
        assert.deepEqual(Accesses, []);
        assert.deepEqual(output.Lines, []);
        dispose();
    });

    test(`${flavor} renders urgent updates ahead of transitions`, async () =>
    {
        const { Vendor, Accesses } = await Restricted(flavor);
        const system = new FakeSystem();
        const dispose = Install(Vendor, system, { Console: Capture().Console });
        const React = Vendor.React;
        const h = React.createElement;
        const setters: Array<Setter<number>> = [];
        const Pair = (): unknown =>
        {
            const [ urgent, setUrgent ] = React.useState(0);
            const [ transition, setTransition ] = React.useState(0);
            setters.splice(0, setters.length, setUrgent, setTransition);
            return h("pair", { urgent, transition });
        };

        const root = CreateRoot(Vendor, system);
        root.Render(h(Pair));
        await system.Settle();
        root.Commits.length = 0;
        const [ setUrgent, setTransition ] = setters;
        React.startTransition(() => setTransition?.(1));
        setUrgent?.(1);
        await system.Settle();
        assert.deepEqual(root.Commits, [ "<pair urgent=1 transition=0></pair>", "<pair urgent=1 transition=1></pair>" ]);
        assert.deepEqual(Accesses, []);
        dispose();
    });

    test(`${flavor} reports uncaught render errors through the host`, async () =>
    {
        const { Vendor, Accesses } = await Restricted(flavor);
        const system = new FakeSystem();
        const reported: Array<unknown> = [];
        const output = Capture();
        const dispose = Install(Vendor, system, {
            Console: output.Console,
            ReportError: (error) => void reported.push(error)
        });
        const failure = new Error("render failure");
        const Broken = (): never =>
        {
            throw failure;
        };

        const root = CreateRoot(Vendor, system);
        root.Render(Vendor.React.createElement(Broken));
        await system.Settle();
        assert.deepEqual(reported, [ failure ]);
        assert.deepEqual(Accesses, []);
        if (flavor === "development")
        {
            assert.ok(output.Lines.some((line) => line.startsWith("warn: ") || line.startsWith("error: ")),
                "Development diagnostics reach the host console.");
        }

        dispose();
    });

    test(`${flavor} scheduler yields within the tick budget`, async () =>
    {
        for (const [ budget, perTick ] of [ [ 10, 3 ], [ undefined, 2 ], [ 50, 13 ] ] as const)
        {
            const { Vendor, Accesses } = await Restricted(flavor);
            const system = new FakeSystem();
            const dispose = Install(Vendor, system, { TickBudget: budget });
            const scheduler = Vendor.Scheduler;
            const ticks: Array<number> = [];
            for (let index = 0; index < 26; index++)
            {
                scheduler.unstable_scheduleCallback(scheduler.unstable_NormalPriority, () =>
                {
                    ticks.push(system.Tick);
                    system.Clock += 4;
                });
            }

            assert.deepEqual(ticks, [], "Scheduling never runs work synchronously.");
            await system.Settle();
            const counts = new Map<number, number>();
            for (const tick of ticks)
            {
                counts.set(tick, (counts.get(tick) ?? 0) + 1);
            }

            assert.equal(ticks.length, 26);
            assert.deepEqual([ ...counts.values() ].slice(0, -1), Array<number>(counts.size - 1).fill(perTick),
                `Budget ${String(budget)} ms runs ${perTick} 4 ms units per tick, then yields.`);
            assert.deepEqual(Accesses, []);
            dispose();
        }
    });

    test(`${flavor} scheduler cancels immediate and delayed work`, async () =>
    {
        const { Vendor, Accesses } = await Restricted(flavor);
        const system = new FakeSystem();
        const dispose = Install(Vendor, system);
        const scheduler = Vendor.Scheduler;
        const normal = scheduler.unstable_NormalPriority;
        const ran: Array<string> = [];
        const cancelled = scheduler.unstable_scheduleCallback(normal, () => void ran.push("cancelled"));
        scheduler.unstable_scheduleCallback(normal, () => void ran.push("kept"));
        const delayed = scheduler.unstable_scheduleCallback(normal, () => void ran.push("delayed cancelled"),
            { delay: 120 });
        scheduler.unstable_scheduleCallback(normal, () => void ran.push(`delayed at ${system.Tick}`), { delay: 120 });
        scheduler.unstable_cancelCallback(cancelled);
        scheduler.unstable_cancelCallback(delayed);
        await system.Settle();
        /* The host timeout re-arms for the remaining 70 ms after tick 1 and fires at tick 3 (150 ms); the *
         * scheduler then runs the released task on the following host turn, as upstream does.            */
        assert.deepEqual(ran, [ "kept", "delayed at 4" ]);
        assert.ok(system.Calls.includes("runTimeout:2"));
        assert.deepEqual(Accesses, []);
        dispose();
    });

    test(`${flavor} scheduler runs urgent priorities first`, async () =>
    {
        const { Vendor } = await Restricted(flavor);
        const system = new FakeSystem();
        const dispose = Install(Vendor, system);
        const order: Array<string> = [];
        const tasks: ReadonlyArray<readonly [ string, SchedulerModule.Priority ]> = [
            [ "idle", 5 ], [ "low", 4 ], [ "normal", 3 ], [ "user-blocking", 2 ], [ "immediate", 1 ]
        ];
        for (const [ name, priority ] of tasks)
        {
            Vendor.Scheduler.unstable_scheduleCallback(priority, () => void order.push(name));
        }

        await system.Settle();
        assert.deepEqual(order, [ "immediate", "user-blocking", "normal", "low", "idle" ]);
        dispose();
    });
}

test("timers requested before installation replay through the first host", async () =>
{
    const { Vendor, Accesses } = await Restricted("production");
    const scheduler = Vendor.Scheduler;
    const ran: Array<string> = [];
    scheduler.unstable_scheduleCallback(scheduler.unstable_NormalPriority, () => void ran.push("early"));
    const cancelled = scheduler.unstable_scheduleCallback(scheduler.unstable_NormalPriority,
        () => void ran.push("cancelled"), { delay: 60 });
    scheduler.unstable_cancelCallback(cancelled);
    const system = new FakeSystem();
    assert.equal(system.Pending, 0);
    const dispose = Install(Vendor, system);
    await system.Settle();
    assert.deepEqual(ran, [ "early" ]);
    assert.deepEqual(Accesses, []);
    dispose();
});

test("host installation is exclusive, validated and idempotently reversible", async () =>
{
    const { Vendor } = await Restricted("production");
    const { CreateSystemReactHost, GetReactHost, InstallReactHost } = Vendor.Host;
    const system = new FakeSystem();
    const host = CreateSystemReactHost(system);
    const dispose = InstallReactHost(host);
    assert.equal(GetReactHost(), host);
    assert.throws(() => InstallReactHost(CreateSystemReactHost(system)), /already installed/u);
    dispose();
    dispose();
    assert.equal(GetReactHost(), undefined);
    const again = InstallReactHost(CreateSystemReactHost(system));
    again();
    assert.throws(() => InstallReactHost({} as HostModule.ReactHost), /requires Now/u);
    assert.throws(() => CreateSystemReactHost({} as HostModule.ReactHostSystem), /run, runTimeout and clearRun/u);
    for (const budget of [ 0, -1, Number.NaN, Number.POSITIVE_INFINITY ])
    {
        assert.throws(() => CreateSystemReactHost(system, { TickBudget: budget }), { name: "RangeError" });
    }
});

test("the System host maps delays to whole ticks and clears through clearRun", async () =>
{
    const { Vendor } = await Restricted("production");
    const system = new FakeSystem();
    const host = Vendor.Host.CreateSystemReactHost(system);
    for (const delay of [ 0, -5, Number.NaN, 1, 50, 51, 120 ])
    {
        host.SetTimeout(() => undefined, delay);
    }

    assert.deepEqual(system.Calls,
        [ "run", "run", "run", "runTimeout:1", "runTimeout:1", "runTimeout:2", "runTimeout:3" ]);
    host.ClearTimeout(4);
    host.ClearTimeout("not a run id");
    assert.deepEqual(system.Calls.slice(-1), [ "clearRun:4" ]);
    assert.equal(Vendor.Host.MillisecondsPerTick, 50);
});
