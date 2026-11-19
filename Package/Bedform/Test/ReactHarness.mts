/**
 * Provides isolated React test realms, a deterministic tick host and an observation-only reconciler.
 *
 * @module bedform/Test/ReactHarness
 *
 * @file      ReactHarness.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fakes mirror untyped upstream host-configuration and scheduler callback shapes. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import type * as HostModule from "../Source/Spatial/Internal/React/Host.js";
import type {
    ReconcilerFactory, SchedulerModule, VendorModule
} from "../Source/Spatial/Internal/React/Types.js";
import { createContext, runInContext } from "node:vm";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

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
export type Flavor = "development" | "production" | "public";

/**
 * A state setter accepting a value or an updater.
 *
 * @category Testing
 * @since 1.0.0
 */
export type Setter<S> = (next: S | ((previous: S) => S)) => void;

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
    readonly createElement: (type: unknown, props?: object | null,
        ...children: ReadonlyArray<unknown>) => unknown;
    readonly createContext: (value: unknown) => unknown;
    readonly startTransition: (scope: () => void) => void;
    readonly useState: <S>(initial: S) => [ S, Setter<S> ];
    readonly useEffect: (effect: Effect, dependencies?: ReadonlyArray<unknown>) => void;
    readonly useLayoutEffect: (effect: Effect, dependencies?: ReadonlyArray<unknown>) => void;
    readonly useMemo: <R>(factory: () => R, dependencies: ReadonlyArray<unknown>) => R;
    readonly useReducer: <S, A>(reducer: (state: S, action: A) => S,
        initial: S) => [ S, (action: A) => void ];
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
    readonly flushSyncFromReconciler: (action: () => void) => void;
    readonly flushPassiveEffects: () => boolean;
}

/**
 * Exports of a bundle evaluated in a restricted realm.
 *
 * @category Testing
 * @since 1.0.0
 */
export interface Bundle
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
export interface Realm
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

    const names = [ "React", "JsxRuntime", "JsxDevRuntime", "Scheduler", "Reconciler",
        "ReconcilerConstants" ];
    const result = await build({
        stdin: {
            contents: [
                "export * as Host from \"./Host.ts\";",
                ...names.map((name) =>
                {
                    if (flavor === "public" && name === "React")
                    {
                        return "export * as React from \"../../React/index.ts\";";
                    }

                    if (flavor === "public" && (name === "JsxRuntime" || name === "JsxDevRuntime"))
                    {
                        const runtime = name === "JsxRuntime" ? "jsx-runtime" : "jsx-dev-runtime";
                        return `export * as ${name} from "../../React/${runtime}.ts";`;
                    }

                    const buildFlavor = flavor === "public" ? "development" : flavor;
                    return `export { Module as ${name} } from "./Vendor/${name}.${buildFlavor}.generated.ts";`;
                })
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
export async function Restricted(flavor: Flavor, bundled?: string): Promise<Realm>
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
    const vendor = runInContext(`${bundled ?? await Bundled(flavor)}\nVendor;`, context) as Bundle;
    return { Vendor: vendor,
        Accesses: accesses };
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
export class FakeSystem implements HostModule.ReactHostSystem
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
        this.Timers.set(id, { Due: this.Tick + ticks,
            Callback: callback });
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
export interface Captured
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
export function Capture(): Captured
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
export interface HostNode
{
    readonly type?: string;
    props?: Record<string, unknown>;
    text?: string;
    readonly children: Array<HostNode>;
    hidden?: boolean;
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
export function Print(node: HostNode): string
{
    if (node.hidden)
    {
        return "";
    }

    if (node.text !== undefined)
    {
        return JSON.stringify(node.text);
    }

    const attributes = Object.entries(node.props ?? {})
        .map(([ key, value ]) => ` ${key}=${String(value)}`).join("");
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
function Configuration(
    vendor: Bundle, system: FakeSystem, commits: Array<string>, container: HostNode
): object
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
            ({ type,
                props: Attributes(props),
                children: [] }),
        createTextInstance: (text: string): HostNode => ({ text,
            children: [] }),
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
        insertBefore: (parent: HostNode, child: HostNode, before: HostNode): void =>
            Insert(parent, child, before),
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
        hideInstance: (node: HostNode): void => { node.hidden = true; },
        unhideInstance: (node: HostNode): void => { node.hidden = false; },
        hideTextInstance: (node: HostNode): void => { node.hidden = true; },
        unhideTextInstance: (node: HostNode): void => { node.hidden = false; },
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
export interface Root
{
    readonly Container: HostNode;
    readonly Commits: Array<string>;
    readonly Render: (element: unknown) => void;
    readonly Sync: (action: () => void) => void;
    readonly FlushEffects: () => boolean;
}

/**
 * Root-level diagnostics, identifier scope and development replay configuration.
 *
 * @category Testing
 * @since 1.0.0
 */
export interface RootOptions
{
    readonly Strict?: boolean;
    readonly Prefix?: string;
    readonly OnCaughtError?: (error: unknown) => void;
    readonly OnUncaughtError?: (error: unknown) => void;
    readonly OnRecoverableError?: (error: unknown) => void;
}

/**
 * Creates a concurrent root through the vendored reconciler.
 *
 * @category Testing
 * @since 1.0.0
 */
export function CreateRoot(vendor: Bundle, system: FakeSystem, options: RootOptions = {}): Root
{
    const container: HostNode = { children: [] };
    const commits: Array<string> = [];
    const configuration = Configuration(vendor, system, commits, container);
    const reconciler = vendor.Reconciler(configuration) as unknown as ReconcilerApi;
    const root = reconciler.createContainer(container, vendor.ReconcilerConstants.ConcurrentRoot,
        null, options.Strict ?? false, null,
        options.Prefix ?? "", options.OnUncaughtError ?? reconciler.defaultOnUncaughtError,
        options.OnCaughtError ?? reconciler.defaultOnCaughtError,
        options.OnRecoverableError ?? reconciler.defaultOnRecoverableError, null, null);
    return {
        Container: container,
        Commits: commits,
        Sync: (action: () => void): void => reconciler.flushSyncFromReconciler(action),
        FlushEffects: (): boolean => reconciler.flushPassiveEffects(),
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
export function Install(
    vendor: Bundle,
    system: FakeSystem,
    options: HostModule.ReactHostSystemOptions = {}
): () => void
{
    return vendor.Host.InstallReactHost(vendor.Host.CreateSystemReactHost(system,
        { Now: () => system.Clock,
            ...options }));
}

