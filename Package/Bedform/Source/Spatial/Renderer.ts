/**
 * Explicit spatial runtime ownership, shared React reconciliation and private per-player surface leases.
 *
 * @module bedform/Spatial/Renderer
 *
 * @file      Renderer.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Layout from "./Layout.js";
import type * as Surface from "./Internal/Surface.js";
import { EngineReactConsole, InstallReactHost } from "./Internal/React/Host.js";
import { Configuration as HostConfiguration, Snapshot } from "./Internal/HostConfig.js";
import type { ReactHost, ReactHostSystem } from "./Internal/React/Host.js";
import type { Container } from "./Internal/HostConfig.js";
import { ManagedHost } from "./Internal/ManagedHost.js";
import type { ReactNode } from "./React/index.js";
import { Module as ReconcilerConstants } from "./Internal/React/Vendor/ReconcilerConstants.development.generated.js";
import { Module as ReconcilerFactory } from "./Internal/React/Vendor/Reconciler.development.generated.js";
import { Scope } from "./Internal/Scope.js";

/**
 * Backend contracts shared by particle, display and future cuboid presenters.
 *
 * @category Interface
 * @since 1.0.0
 */
export type {
    Context as SurfaceContext,
    Factory as SurfaceFactory,
    Frame as SurfaceFrame,
    Node as SurfaceNode,
    Surface
} from "./Internal/Surface.js";

/**
 * A native player session. The default session identity is object identity as well as id; a replaced
 * player object cannot inherit an earlier private root, even when the id is reused.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Viewer {
    readonly id: string;
    readonly isValid: boolean;
}

/**
 * Online session enumeration injected from the native world; no world is imported or started here.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface World {
    readonly getAllPlayers: () => ReadonlyArray<Viewer>;
}

/**
 * Tick scheduling used by this runtime. Native System satisfies this structural interface.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface System extends ReactHostSystem {
    readonly runInterval: (callback: () => void, ticks?: number) => number;
}

/**
 * Opaque native constructors carried to a backend without instantiating them. A concrete backend
 * narrows the experimental TextPrimitive ABI it supports; the runtime never invents that ABI.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface NativeConstructors {
    readonly TextPrimitive: abstract new (...arguments_: Array<never>) => object;
    readonly [name: string]: unknown;
}

/**
 * Scoped failure reporting; errors in a reporter cannot escape into another root or stop cleanup.
 *
 * @category Error
 * @since 1.0.0
 */
export interface Failure {
    readonly RootId?: number;
    readonly Phase:
        | "render"
        | "caught"
        | "recoverable"
        | "audience"
        | "surface"
        | "cleanup"
        | "scheduling"
        | "reporting";
    readonly Cause: unknown;
}

/**
 * Explicit native services and optional default surface factory. TickBudget is milliseconds.
 * Starting owns one presentation interval and the exclusive shared React host in this environment.
 * Surface factories allocate only after an application commits for an eligible online viewer.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Configuration {
    readonly World: World;
    readonly System: System;
    readonly Native: NativeConstructors;
    readonly Surface?: Surface.Factory;
    readonly TickBudget?: number;
    readonly Now?: () => number;
    readonly Console?: ReactHost.Console;
    readonly OnError?: (failure: Failure) => void;
}

/**
 * Shared root configuration; validators run during rendering, before any surface allocation.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface RootConfiguration {
    readonly Surface?: Surface.Factory;
    readonly StrictMode?: boolean;
    readonly OnError?: (failure: Failure) => void;
}

/**
 * Default private root tied to one particular online player session; no audience fallback exists.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface PrivateRoot extends RootConfiguration {
    readonly Shared?: false;
    readonly Player: Viewer;
}

/**
 * Explicitly shared root. Audience is sampled each tick and intersected with current valid sessions.
 * Empty, missing, disconnected and replaced sessions receive no presentation or input lease.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface SharedRoot extends RootConfiguration {
    readonly Shared: true;
    readonly Audience: () => Iterable<Viewer>;
}

/**
 * Private by default; sharing must be explicit and supply an audience provider.
 *
 * @category Model
 * @since 1.0.0
 */
export type RootOptions = PrivateRoot | SharedRoot;

/**
 * Managed application lifetime. Render rejects after retirement. Unmount retires immediately and
 * returns the same Promise on every call, resolving after React cleanup and all resource releases.
 * Native presentation is fenced immediately, including during reentrant effect/backend callbacks.
 * Own supports subscriptions and other root resources beyond per-viewer surface leases.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Root {
    readonly Id: number;
    readonly Disposed: boolean;
    readonly Layout: Layout.Result | undefined;
    readonly Render: (node: ReactNode) => void;
    readonly Unmount: () => Promise<void>;
    readonly Own: (cleanup: () => void) => () => void;
}

/**
 * Explicit runtime lifetime. Dispose retires every root immediately, is Promise-idempotent, and
 * releases the shared host only after React bookkeeping and native timer cleanup settle. Await it
 * before starting another runtime. Cleanup failures reject after all remaining releases are tried.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Runtime {
    readonly Disposed: boolean;
    readonly Dispose: () => Promise<void>;
}

/**
 * Pinned reconciler operations used by this renderer; native and browser details remain outside it.
 *
 * @category Interface
 * @since 1.0.0
 */
interface Reconciler {
    readonly createContainer: (...arguments_: ReadonlyArray<unknown>) => unknown;
    readonly updateContainer: (node: ReactNode, root: unknown, parent: null, callback: null) => void;
    readonly flushSyncFromReconciler: (action: () => void) => void;
    readonly flushPassiveEffects: () => boolean;
}

/**
 * A viewer's surface and independent rollback ledger.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
interface Lease {
    readonly Viewer: Viewer;
    readonly Scope: Scope;
    readonly Surface: Surface.Surface;
    Revision: number;
}
const Runtimes: WeakMap<Runtime, Controller> = new WeakMap();
let NextRootId = 0;

/**
 * Checks native viewer identity without letting an invalid native handle escape a tick.
 *
 * @category Predicate
 * @since 1.0.0
 */
function Valid(viewer: Viewer): boolean
{
    try
    {
        return (
            !!viewer && typeof viewer.id === "string" && viewer.id.length > 0 && viewer.isValid === true
        );
    }
    catch
    {
        return false;
    }
}

/**
 * Snapshots factory methods so caller mutation cannot replace an active root's backend.
 *
 * @throws { TypeError } If the backend factory or a supplied validator is malformed.
 *
 * @category Validation
 * @since 1.0.0
 */
function Factory(factory: Surface.Factory | undefined): Surface.Factory
{
    if (
        !factory ||
        typeof factory.Create !== "function" ||
        (factory.CustomHost !== undefined && typeof factory.CustomHost !== "boolean") ||
        (factory.Validate !== undefined && typeof factory.Validate !== "function") ||
        (factory.ValidateText !== undefined && typeof factory.ValidateText !== "function")
    )
    {
        throw new TypeError(
            "A spatial root requires a surface factory with Create and optional validators."
        );
    }

    return Object.freeze({
        Create: factory.Create.bind(factory),
        CustomHost: factory.CustomHost,
        Validate: factory.Validate?.bind(factory),
        ValidateText: factory.ValidateText?.bind(factory)
    });
}

/**
 * Owns one shared reconciler and host for independent private/shared application roots.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
class Controller
{
    Active: boolean = true;
    readonly Reconciler: Reconciler;
    readonly Roots: Set<Application> = new Set();
    readonly Host: ManagedHost;
    private readonly Uninstall: () => void;
    private readonly Interval: number;
    private Closing: Promise<void> | undefined;
    constructor(readonly Options: Configuration)
    {
        this.Host = new ManagedHost(Options.System, {
            Console: Options.Console,
            Now: Options.Now,
            ReportError: (error: unknown): void =>
                this.Report({
                    Cause: error,
                    Phase: "scheduling"
                }),
            TickBudget: Options.TickBudget
        });
        this.Uninstall = InstallReactHost(this.Host.Host);
        try
        {
            this.Reconciler = ReconcilerFactory(HostConfiguration(this.Host)) as unknown as Reconciler;
            this.Interval = Options.System.runInterval((): void => this.Tick(), 1);
        }
        catch (error)
        {
            this.Active = false;
            try
            {
                this.Host.Drain();
            }
            finally
            {
                try
                {
                    this.Host.Close();
                }
                finally
                {
                    this.Uninstall();
                }
            }

            throw error;
        }
    }

    /**
     * Reports one scoped failure without allowing a failing observer to abort another application.
     *
     * @category ErrorHandling
     * @since 1.0.0
     */
    Report(failure: Failure, reporter?: (failure: Failure) => void): void
    {
        const output = this.Options.Console ?? EngineReactConsole;
        try
        {
            const report =
                reporter ??
                this.Options.OnError ??
                ((error: Failure): void => output.error(error.Cause));
            report(failure);
        }
        catch (error)
        {
            try
            {
                output.error(error);
            }
            catch
            {
                /* A broken native logger cannot stop cleanup. */
            }
        }
    }

    /**
     * Samples online sessions once, removes revoked leases before presentation, and isolates root failures.
     *
     * @category Running
     * @since 1.0.0
     */
    private Tick(): void
    {
        if (!this.Active)
        {
            return;
        }

        const online = new Map<string, Viewer>();
        try
        {
            for (const viewer of this.Options.World.getAllPlayers())
            {
                if (Valid(viewer))
                {
                    online.set(viewer.id, viewer);
                }
            }
        }
        catch (error)
        {
            online.clear();
            this.Report({
                Cause: error,
                Phase: "audience"
            });
        }

        for (const root of [ ...this.Roots ])
        {
            if (!this.Active)
            {
                break;
            }

            root.Tick(online);
        }
    }

    /**
     * Retires roots now and releases host ownership after their asynchronous, reentrancy-safe cleanup.
     *
     * @category ResourceManagement
     * @since 1.0.0
     */
    Dispose(): Promise<void>
    {
        if (this.Closing)
        {
            return this.Closing;
        }

        this.Active = false;
        const roots = [ ...this.Roots ];
        const unmounts = roots.map((root: Application): Promise<void> => root.Unmount());
        this.Closing = Promise.resolve().then(async (): Promise<void> =>
        {
            const errors: Array<unknown> = [];
            try
            {
                this.Options.System.clearRun(this.Interval);
            }
            catch (error)
            {
                errors.push(error);
            }

            const settled = await Promise.allSettled(unmounts);
            for (const result of settled)
            {
                if (result.status === "rejected")
                {
                    errors.push(result.reason);
                }
            }

            try
            {
                this.Host.Drain();
            }
            catch (error)
            {
                errors.push(error);
            }
            finally
            {
                try
                {
                    this.Host.Close();
                }
                catch (error)
                {
                    errors.push(error);
                }
                finally
                {
                    this.Uninstall();
                }
            }

            if (errors.length)
            {
                throw new AggregateError(errors, "Spatial runtime cleanup failed.");
            }
        });
        return this.Closing;
    }
}

/**
 * Isolates React state, committed frames, audience leases, errors and root-owned resources.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
class Application
{
    readonly Id: number = ++NextRootId;
    Active: boolean = true;
    private Faulted: boolean = false;
    private readonly Container: Container;
    private readonly Root: unknown;
    private readonly Resources: Scope = new Scope();
    private readonly Leases: Map<string, Lease> = new Map();
    private Frame: Surface.Frame = Object.freeze({
        Nodes: Object.freeze([]),
        Revision: 0
    });
    private Closing: Promise<void> | undefined;
    constructor(
        private readonly Runtime: Controller,
        private readonly Options: RootOptions,
        private readonly Factory: Surface.Factory
    )
    {
        this.Container = {
            Children: [],
            Commit: (): void =>
            {
                if (this.Active)
                {
                    const nodes = Snapshot(this.Container);
                    const revision = this.Frame.Revision + 1;
                    let layout: Layout.Result;
                    try
                    {
                        layout = Layout.Compute(nodes, revision);
                    }
                    catch (error)
                    {
                        const failure = error instanceof Error ? error : new Error(String(error));
                        const id = error instanceof Layout.LayoutError ? error.NodeId : undefined;
                        const find = (
                            parent: Container | import("./Internal/HostConfig.js").HostNode,
                            inherited?: (error: Error) => void
                        ): ((error: Error) => void) | undefined =>
                        {
                            for (const child of parent.Children)
                            {
                                const guard = child.Failure ?? inherited;
                                if (child.Handle.Id === id)
                                {
                                    return guard;
                                }

                                const nested = find(child, guard);
                                if (nested)
                                {
                                    return nested;
                                }
                            }

                            return undefined;
                        };

                        const guard = find(this.Container);
                        if (guard)
                        {
                            guard(failure);
                        }
                        else
                        {
                            this.Faulted = true;
                            this.Report("render", failure);
                        }

                        return;
                    }

                    this.Frame = Object.freeze({
                        Layout: layout.Views.length ? layout : undefined,
                        Nodes: nodes,
                        Revision: revision
                    });
                }
            },
            Factory,
            NextId: 0
        };
        this.Root = Runtime.Reconciler.createContainer(
            this.Container,
            ReconcilerConstants.ConcurrentRoot,
            null,
            Options.StrictMode ?? false,
            null,
            `spatial-${this.Id}-`,
            (error: unknown): void =>
            {
                this.Faulted = true;
                this.Report("render", error);
            },
            (error: unknown): void => this.Report("caught", error),
            (error: unknown): void => this.Report("recoverable", error),
            null,
            null
        );
    }

    /**
     * Returns the same immutable layout revision supplied to surface presentation.
     *
     * @category Getter
     * @since 1.0.0
     */
    GetLayout(): Layout.Result | undefined
    {
        return this.Frame.Layout;
    }

    /**
     * Reports an error through this application's own observer or the trusted runtime observer.
     *
     * @category ErrorHandling
     * @since 1.0.0
     */
    private Report(phase: Failure["Phase"], cause: unknown): void
    {
        this.Runtime.Report(
            {
                Cause: cause,
                Phase: phase,
                RootId: this.Id
            },
            this.Options.OnError
        );
    }

    /**
     * Rejects operations on retired applications before scheduling or registering any resources.
     *
     * @throws { Error } If this root or its runtime is disposed.
     *
     * @category Validation
     * @since 1.0.0
     */
    Check(): void
    {
        if (!this.Active || !this.Runtime.Active)
        {
            throw new Error("Spatial root is disposed.");
        }
    }

    /**
     * Schedules a React update; presentation consumes only subsequent committed snapshots.
     *
     * @category Running
     * @since 1.0.0
     */
    Render(node: ReactNode): void
    {
        this.Check();
        this.Runtime.Reconciler.updateContainer(node, this.Root, null, null);
    }

    /**
     * Registers root-wide cleanup independent of any particular viewer.
     *
     * @category ResourceManagement
     * @since 1.0.0
     */
    Own(cleanup: () => void): () => void
    {
        this.Check();
        return this.Resources.Own(cleanup);
    }

    /**
     * Releases one viewer's whole resource ledger, even when the surface's Dispose fails.
     *
     * @category ResourceManagement
     * @since 1.0.0
     */
    private Release(id: string): void
    {
        const lease = this.Leases.get(id);
        this.Leases.delete(id);
        lease?.Scope.Dispose();
    }

    /**
     * Reconciles current audience membership before committing or refreshing private presentations.
     * Provider failures revoke presentation immediately and can recover without remounting React.
     *
     * @category Running
     * @since 1.0.0
     */
    Tick(online: ReadonlyMap<string, Viewer>): void
    {
        if (!this.Active)
        {
            return;
        }

        if (this.Faulted)
        {
            this.Retire();
            return;
        }

        const audience = new Map<string, Viewer>();
        try
        {
            const viewers = this.Options.Shared ? this.Options.Audience() : [ this.Options.Player ];
            for (const viewer of viewers)
            {
                if (Valid(viewer) && online.get(viewer.id) === viewer)
                {
                    audience.set(viewer.id, viewer);
                }
            }
        }
        catch (error)
        {
            audience.clear();
            this.Report("audience", error);
        }

        try
        {
            for (const [ id, lease ] of this.Leases)
            {
                if (
                    !this.Frame.Nodes.length ||
                    audience.get(id) !== lease.Viewer ||
                    !Valid(lease.Viewer)
                )
                {
                    this.Release(id);
                }
            }

            if (!this.Frame.Nodes.length)
            {
                return;
            }

            for (const [ id, viewer ] of audience)
            {
                if (!this.Active || !this.Runtime.Active)
                {
                    break;
                }

                let lease = this.Leases.get(id);
                if (!lease)
                {
                    const scope = new Scope();
                    try
                    {
                        const surface = this.Factory.Create({
                            Native: this.Runtime.Options.Native,
                            Own: (cleanup: () => void): (() => void) =>
                            {
                                this.Check();
                                return scope.Own(cleanup);
                            },
                            RootId: this.Id,
                            System: this.Runtime.Options.System,
                            Viewer: viewer,
                            World: this.Runtime.Options.World
                        });
                        if (surface && typeof surface.Dispose === "function")
                        {
                            scope.Own((): void => surface.Dispose());
                        }

                        if (
                            !surface ||
                            typeof surface.Commit !== "function" ||
                            typeof surface.Update !== "function" ||
                            typeof surface.Dispose !== "function"
                        )
                        {
                            throw new TypeError("Spatial surface requires Commit, Update and Dispose.");
                        }

                        if (!this.Active || !this.Runtime.Active)
                        {
                            scope.Dispose();
                            break;
                        }

                        lease = {
                            Revision: -1,
                            Scope: scope,
                            Surface: surface,
                            Viewer: viewer
                        };
                        this.Leases.set(id, lease);
                    }
                    catch (error)
                    {
                        try
                        {
                            scope.Dispose();
                        }
                        catch (cleanup)
                        {
                            throw new AggregateError(
                                [ error, cleanup ],
                                "Spatial surface creation rollback failed."
                            );
                        }

                        throw error;
                    }
                }

                if (lease.Revision !== this.Frame.Revision)
                {
                    lease.Surface.Commit(this.Frame);
                    lease.Revision = this.Frame.Revision;
                }

                if (this.Active && this.Runtime.Active && this.Leases.get(id) === lease)
                {
                    lease.Surface.Update();
                }
            }
        }
        catch (error)
        {
            this.Report("surface", error);
            this.Retire();
        }
    }

    /**
     * Retires a failed application without creating an unhandled cleanup rejection.
     *
     * @category ErrorHandling
     * @since 1.0.0
     */
    private Retire(): void
    {
        void this.Unmount().catch((error: unknown): void => this.Report("cleanup", error));
    }

    /**
     * Fences new work immediately; React and native cleanup run outside the current commit stack.
     *
     * @category ResourceManagement
     * @since 1.0.0
     */
    Unmount(): Promise<void>
    {
        if (this.Closing)
        {
            return this.Closing;
        }

        this.Active = false;
        this.Closing = Promise.resolve().then((): void =>
        {
            const errors: Array<unknown> = [];
            try
            {
                this.Runtime.Reconciler.flushSyncFromReconciler((): void =>
                    this.Runtime.Reconciler.updateContainer(null, this.Root, null, null)
                );
                this.Runtime.Reconciler.flushPassiveEffects();
            }
            catch (error)
            {
                errors.push(error);
            }

            for (const id of [ ...this.Leases.keys() ])
            {
                try
                {
                    this.Release(id);
                }
                catch (error)
                {
                    errors.push(error);
                }
            }

            try
            {
                this.Resources.Dispose();
            }
            catch (error)
            {
                errors.push(error);
            }

            this.Runtime.Roots.delete(this);
            this.Container.Children.length = 0;
            this.Frame = Object.freeze({
                Nodes: Object.freeze([]),
                Revision: this.Frame.Revision + 1
            });
            if (errors.length)
            {
                const failure = new AggregateError(errors, "Spatial root cleanup failed.");
                this.Report("cleanup", failure);
                throw failure;
            }
        });
        return this.Closing;
    }
}

/**
 * Starts one runtime with explicit native adapters. Imports, constructor validation and root creation
 * allocate no entities or primitives. A backend must be supplied before creating a root. Native
 * constructors are forwarded, not instantiated here. Await Dispose before starting another runtime.
 *
 * @throws { TypeError } If required native services are missing.
 * @throws { RangeError } If the tick budget is invalid.
 * @throws { Error } If another React host is already installed.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Start(configuration: Configuration): Runtime
{
    if (
        !configuration ||
        !configuration.World ||
        typeof configuration.World.getAllPlayers !== "function" ||
        !configuration.System ||
        typeof configuration.System.runInterval !== "function" ||
        !configuration.Native ||
        typeof configuration.Native.TextPrimitive !== "function"
    )
    {
        throw new TypeError(
            "Spatial.Start requires World, System and native TextPrimitive constructor injection."
        );
    }

    const options: Configuration = Object.freeze({
        ...configuration,
        Native: Object.freeze({ ...configuration.Native }),
        Surface: configuration.Surface === undefined ? undefined : Factory(configuration.Surface)
    });
    const controller = new Controller(options);
    const runtime: Runtime = Object.freeze({
        Dispose: (): Promise<void> => controller.Dispose(),
        get Disposed(): boolean
        {
            return !controller.Active;
        }
    });
    Runtimes.set(runtime, controller);
    return runtime;
}

/**
 * Creates an independent React root, defaulting to a specified private player. Shared roots must
 * explicitly opt in and provide an audience function. Retired/replaced player objects are never
 * implicitly promoted to public visibility. Initial native allocation waits for a committed tree.
 *
 * @throws { TypeError } If the runtime, audience policy or surface factory is invalid.
 * @throws { Error } If the runtime is disposed.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function CreateRoot(runtime: Runtime, options: RootOptions): Root
{
    const controller = Runtimes.get(runtime);
    if (!controller)
    {
        throw new TypeError("Renderer.CreateRoot requires a runtime from Spatial.Start.");
    }

    if (!controller.Active)
    {
        throw new Error("Spatial runtime is disposed.");
    }

    if (
        !options ||
        (options.Shared !== undefined && typeof options.Shared !== "boolean") ||
        (options.Shared ? typeof options.Audience !== "function" : !Valid(options.Player))
    )
    {
        throw new TypeError("Specify a valid private Player or Shared: true with an Audience provider.");
    }

    const configuration = Object.freeze({ ...options });
    const application = new Application(
        controller,
        configuration,
        Factory(options.Surface ?? controller.Options.Surface)
    );
    controller.Roots.add(application);
    return Object.freeze({
        get Disposed(): boolean
        {
            return !application.Active;
        },
        Id: application.Id,
        get Layout(): Layout.Result | undefined
        {
            return application.GetLayout();
        },
        Own: (cleanup: () => void): (() => void) => application.Own(cleanup),
        Render: (node: ReactNode): void => application.Render(node),
        Unmount: (): Promise<void> => application.Unmount()
    });
}
