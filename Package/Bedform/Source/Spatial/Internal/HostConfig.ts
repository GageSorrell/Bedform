/**
 * Minecraft-independent React mutation host and immutable committed surface snapshots.
 *
 * @module bedform/Spatial/Internal/HostConfig
 *
 * @file      HostConfig.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as Surface from "./Surface.js";
import { CheckText, ChildContext } from "./ComponentRules.js";
import type { Context } from "./ComponentRules.js";
import { Core } from "./React/Core.js";
import { InternalProp } from "./ComponentKind.js";

/**
 * Stable ref identity for a structural host node; native actors remain backend-owned.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Handle {
    readonly Id: number;
    readonly Type: string;
}

/**
 * Mutable child list used only during reconciliation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Parent {
    readonly Children: Array<HostNode>;
}

/**
 * Unpublished host state; aborted renders cannot allocate native resources.
 *
 * @category Model
 * @since 1.0.0
 */
export interface HostNode extends Parent {
    readonly Handle: Handle;
    Props: Readonly<Record<string, unknown>>;
    Text?: string;
    Hidden: boolean;
    Failure?: (error: Error) => void;
}

/**
 * One application root and its pure schema validator.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Container extends Parent {
    readonly Factory: Surface.Factory;
    NextId: number;
    readonly Commit: () => void;
}

/**
 * Runtime-owned scheduling callbacks shared by all roots of one reconciler.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Environment {
    readonly Microtask: (callback: () => void) => void;
    readonly SetTimeout: (callback: () => void, delay: number) => unknown;
    readonly ClearTimeout: (handle: unknown) => void;
}

/**
 * Copies props without React children, refs or key metadata; nested consumer values remain opaque.
 *
 * @category Mapping
 * @since 1.0.0
 */
function Attributes(props: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>
{
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(props))
    {
        if (key !== "children" && key !== "ref" && key !== "key" && key !== InternalProp.Failure)
        {
            result[key] = props[key];
        }
    }

    return Object.freeze(result);
}

/**
 * Allocates an inert host node whose handle survives keyed movement.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Make(container: Container, type: string, props: Readonly<Record<string, unknown>>): HostNode
{
    return {
        Children: [],
        Handle: Object.freeze({ Id: ++container.NextId,
            Type: type }),
        Hidden: false,
        Props: props };
}

/**
 * Moves an existing child or inserts a new child before a sibling.
 *
 * @category Sequencing
 * @since 1.0.0
 */
function Insert(parent: Parent, child: HostNode, before?: HostNode): void
{
    const previous = parent.Children.indexOf(child);
    if (previous !== -1)
    {
        parent.Children.splice(previous, 1);
    }

    const index = before === undefined ? -1 : parent.Children.indexOf(before);
    parent.Children.splice(index === -1 ? parent.Children.length : index, 0, child);
}

/**
 * Removes a child from a committed parent.
 *
 * @category Filtering
 * @since 1.0.0
 */
function Remove(parent: Parent, child: HostNode): void
{
    const index = parent.Children.indexOf(child);
    if (index !== -1)
    {
        parent.Children.splice(index, 1);
    }
}

/**
 * Copies committed host structure, propagating hidden state without exposing mutable child lists.
 *
 * @category Mapping
 * @since 1.0.0
 */
export function Snapshot(parent: Parent, hidden: boolean = false): ReadonlyArray<Surface.Node>
{
    return Object.freeze(parent.Children.map((node: HostNode): Surface.Node => Object.freeze({
        Children: Snapshot(node, hidden || node.Hidden),
        Hidden: hidden || node.Hidden,
        Id: node.Handle.Id,
        Props: node.Props,
        Text: node.Text,
        Type: node.Handle.Type
    })));
}

/**
 * Binds the pinned reconciler host contract without DOM, hydration or browser animation support.
 *
 * @category Factory
 * @since 1.0.0
 */
export function Configuration(environment: Environment): object
{
    let priority = 0;
    const noop = (): void => undefined;
    return {
        HostTransitionContext: Core.createContext(null),
        NotPendingTransition: null,
        afterActiveInstanceBlur: noop,
        appendChild: (parent: Parent, child: HostNode): void => Insert(parent, child),
        appendChildToContainer: (parent: Parent, child: HostNode): void => Insert(parent, child),
        appendInitialChild: (parent: Parent, child: HostNode): void => Insert(parent, child),
        beforeActiveInstanceBlur: noop,
        bindToConsole: () => noop,
        cancelTimeout: environment.ClearTimeout,
        clearContainer: (parent: Parent): void =>
        {
            parent.Children.length = 0;
        },
        commitMount: noop,
        commitTextUpdate: (node: HostNode, _: string, text: string): void =>
        {
            node.Text = text;
        },
        commitUpdate: (node: HostNode, ...[ , , props ]: [
            string,
            object,
            Record<string, unknown>
        ]): void =>
        {
            node.Props = Attributes(props);
            node.Failure = props[InternalProp.Failure] as HostNode["Failure"];
        },
        createInstance: (type: string, props: Record<string, unknown>, container: Container,
            context: Context): HostNode =>
        {
            const attributes = Attributes(props);
            container.Factory.Validate?.(type, attributes, context.Ancestors);
            const node = Make(container, type, attributes);
            node.Failure = props[InternalProp.Failure] as HostNode["Failure"];
            return node;
        },
        createTextInstance: (text: string, container: Container, context: Context): HostNode =>
        {
            CheckText(context);
            container.Factory.ValidateText?.(text, context.Ancestors);
            const node = Make(container, "#text", Object.freeze({}));
            node.Text = text;
            return node;
        },
        detachDeletedInstance: noop,
        finalizeInitialChildren: (): boolean => false,
        getChildHostContext: ChildContext,
        getCurrentUpdatePriority: (): number => priority,
        getInstanceFromNode: (): null => null,
        getInstanceFromScope: (): null => null,
        getPublicInstance: (instance: HostNode): Handle => instance.Handle,
        getRootHostContext: (container: Container): Context => ({ Ancestors: [],
            Custom: container.Factory.CustomHost === true,
            InText: false,
            Spatial: false }),
        getSuspendedCommitReason: (): null => null,
        hideInstance: (node: HostNode): void =>
        {
            node.Hidden = true;
        },
        hideTextInstance: (node: HostNode): void =>
        {
            node.Hidden = true;
        },
        insertBefore: (parent: Parent, child: HostNode, before: HostNode): void =>
            Insert(parent, child, before),
        insertInContainerBefore: (parent: Parent, child: HostNode, before: HostNode): void =>
            Insert(parent, child, before),
        isPrimaryRenderer: true,
        maySuspendCommit: (): boolean => false,
        maySuspendCommitInSyncRender: (): boolean => false,
        maySuspendCommitOnUpdate: (): boolean => false,
        noTimeout: -1,
        preloadInstance: (): boolean => true,
        prepareForCommit: (): null => null,
        preparePortalMount: noop,
        prepareScopeUpdate: noop,
        removeChild: Remove,
        removeChildFromContainer: Remove,
        rendererPackageName: "bedform-spatial",
        rendererVersion: "1.0.0",
        requestPostPaintCallback: noop,
        resetAfterCommit: (container: Container): void => container.Commit(),
        resetFormInstance: noop,
        resetTextContent: noop,
        resolveEventTimeStamp: (): number => -1.1,
        resolveEventType: (): null => null,
        resolveUpdatePriority: (): number => priority === 0 ? 32 : priority,
        scheduleMicrotask: environment.Microtask,
        scheduleTimeout: environment.SetTimeout,
        setCurrentUpdatePriority: (next: number): void =>
        {
            priority = next;
        },
        shouldAttemptEagerTransition: (): boolean => false,
        shouldSetTextContent: (): boolean => false,
        startSuspendingCommit: (): null => null,
        supportsHydration: false,
        supportsMicrotasks: true,
        supportsMutation: true,
        supportsPersistence: false,
        supportsResources: false,
        supportsSingletons: false,
        supportsTestSelectors: false,
        suspendInstance: noop,
        suspendOnActiveViewTransition: noop,
        trackSchedulerEvent: noop,
        unhideInstance: (node: HostNode): void =>
        {
            node.Hidden = false;
        },
        unhideTextInstance: (node: HostNode): void =>
        {
            node.Hidden = false;
        },
        waitForCommitToBeReady: (): null => null,
        warnsIfNotActing: false
    };
}
