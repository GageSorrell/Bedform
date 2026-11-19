/**
 * Shared React client APIs and upstream signatures for spatial consumers; importing starts no runtime.
 *
 * @module bedform/Spatial/React/index
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as ReactTypes from "react";
import { Core } from "../Internal/React/Core.js";

/**
 * Upstream public component, element, context, hook and JSX types.
 *
 * @category Model
 * @since 1.0.0
 */
export type {
    ReactNode,
    ReactElement,
    ReactPortal,
    Key,
    Ref,
    RefCallback,
    RefObject,
    LegacyRef,
    ForwardedRef,
    MutableRefObject,
    ComponentType,
    JSXElementConstructor,
    ElementType,
    ComponentProps,
    ComponentPropsWithRef,
    ComponentPropsWithoutRef,
    ComponentRef,
    ElementRef,
    FunctionComponent,
    FC,
    FunctionComponentElement,
    ComponentElement,
    CElement,
    ClassicElement,
    ComponentClass,
    ClassicComponentClass,
    ComponentState,
    ErrorInfo,
    Context,
    Provider,
    Consumer,
    ProviderProps,
    ConsumerProps,
    ContextType,
    PropsWithChildren,
    PropsWithoutRef,
    PropsWithRef,
    RefAttributes,
    Attributes,
    ClassAttributes,
    ExoticComponent,
    NamedExoticComponent,
    ForwardRefExoticComponent,
    MemoExoticComponent,
    LazyExoticComponent,
    FragmentProps,
    SuspenseProps,
    ActivityProps,
    ViewTransitionProps,
    ViewTransitionInstance,
    ViewTransitionClass,
    ViewTransitionClassPerType,
    ProfilerProps,
    ProfilerOnRenderCallback,
    DependencyList,
    EffectCallback,
    SetStateAction,
    Dispatch,
    DispatchWithoutAction,
    Reducer,
    ReducerState,
    ReducerWithoutAction,
    TransitionFunction,
    TransitionStartFunction,
    Usable,
    CacheSignal,
    JSX
} from "react";

/**
 * Preserves state while hiding a subtree and disconnecting its effects.
 *
 * @category Combinator
 * @since 1.0.0
 */
export const Activity: typeof ReactTypes.Activity = Core.Activity;

/**
 * Inspects and transforms opaque React children.
 *
 * @category Transforming
 * @since 1.0.0
 */
export const Children: typeof ReactTypes.Children = Core.Children;

/**
 * Base class for stateful components and error boundaries.
 *
 * @category Model
 * @since 1.0.0
 */
export const Component: typeof ReactTypes.Component = Core.Component;

/**
 * Instance type of the upstream Component class.
 *
 * @category Model
 * @since 1.0.0
 */
export type Component<Props = {}, State = {}, Snapshot = any> =
    ReactTypes.Component<Props, State, Snapshot>;

/**
 * Base class for components with shallow prop and state comparison.
 *
 * @category Model
 * @since 1.0.0
 */
export const PureComponent: typeof ReactTypes.PureComponent = Core.PureComponent;

/**
 * Instance type of the upstream PureComponent class.
 *
 * @category Model
 * @since 1.0.0
 */
export type PureComponent<Props = {}, State = {}, Snapshot = any> =
    ReactTypes.PureComponent<Props, State, Snapshot>;

/**
 * Groups children without a host instance.
 *
 * @category Combinator
 * @since 1.0.0
 */
export const Fragment: typeof ReactTypes.Fragment = Core.Fragment;

/**
 * Collects renderer profiling observations when the renderer enables profiling.
 *
 * @category Tracing
 * @since 1.0.0
 */
export const Profiler: typeof ReactTypes.Profiler = Core.Profiler;

/**
 * Enables upstream development checks for its subtree.
 *
 * @category Testing
 * @since 1.0.0
 */
export const StrictMode: typeof ReactTypes.StrictMode = Core.StrictMode;

/**
 * Displays a fallback while children suspend.
 *
 * @category ErrorHandling
 * @since 1.0.0
 */
export const Suspense: typeof ReactTypes.Suspense = Core.Suspense;

/**
 * Adds an upstream transition type; browser animation is unavailable.
 *
 * @category Annotation
 * @since 1.0.0
 */
export const addTransitionType: typeof ReactTypes.addTransitionType = Core.addTransitionType;

/**
 * Preserves upstream client cache behavior, which calls through without server caching.
 *
 * @category Combinator
 * @since 1.0.0
 */
export const cache: typeof ReactTypes.cache = Core.cache;

/**
 * Returns the upstream client cache signal, which is null outside a server cache.
 *
 * @category Accessor
 * @since 1.0.0
 */
export const cacheSignal: typeof ReactTypes.cacheSignal = Core.cacheSignal;

/**
 * Clones an element with replacement props and optional children.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const cloneElement: typeof ReactTypes.cloneElement = Core.cloneElement;

/**
 * Creates an isolated context with a default value.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const createContext: typeof ReactTypes.createContext = Core.createContext;

/**
 * Creates a React element with upstream key, ref and children semantics.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const createElement: typeof ReactTypes.createElement = Core.createElement;

/**
 * Creates a mutable ref initialized to null.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const createRef: typeof ReactTypes.createRef = Core.createRef;

/**
 * Forwards a ref to a component render function.
 *
 * @category Combinator
 * @since 1.0.0
 */
export const forwardRef: typeof ReactTypes.forwardRef = Core.forwardRef;

/**
 * Determines whether a value is a React element.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isValidElement: typeof ReactTypes.isValidElement = Core.isValidElement;

/**
 * Loads a component asynchronously through Suspense.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const lazy: typeof ReactTypes.lazy = Core.lazy;

/**
 * Memoizes a component with the optional upstream props comparison.
 *
 * @category Combinator
 * @since 1.0.0
 */
export const memo: typeof ReactTypes.memo = Core.memo;

/**
 * Marks updates in a scope as nonurgent transition work.
 *
 * @category Sequencing
 * @since 1.0.0
 */
export const startTransition: typeof ReactTypes.startTransition = Core.startTransition;

/**
 * Reads a context or thenable, suspending or throwing according to its state.
 *
 * @category Accessor
 * @since 1.0.0
 */
export const use: typeof ReactTypes.use = Core.use;

/**
 * Tracks action state, pending work and action failures.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const useActionState: typeof ReactTypes.useActionState = Core.useActionState;

/**
 * Preserves a callback while its dependencies remain equal.
 *
 * @category Mapping
 * @since 1.0.0
 */
export const useCallback: typeof ReactTypes.useCallback = Core.useCallback;

/**
 * Reads and subscribes to the nearest context provider.
 *
 * @category Accessor
 * @since 1.0.0
 */
export const useContext: typeof ReactTypes.useContext = Core.useContext;

/**
 * Provides an upstream hook debug label; browser DevTools are unavailable.
 *
 * @category Tracing
 * @since 1.0.0
 */
export const useDebugValue: typeof ReactTypes.useDebugValue = Core.useDebugValue;

/**
 * Defers a value to a lower priority render.
 *
 * @category Sequencing
 * @since 1.0.0
 */
export const useDeferredValue: typeof ReactTypes.useDeferredValue = Core.useDeferredValue;

/**
 * Runs a passive effect with optional zero-argument cleanup.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const useEffect: typeof ReactTypes.useEffect = Core.useEffect;

/**
 * Creates an effect event that reads the latest committed values.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const useEffectEvent: typeof ReactTypes.useEffectEvent = Core.useEffectEvent;

/**
 * Creates a stable identifier scoped by the renderer root.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const useId: typeof ReactTypes.useId = Core.useId;

/**
 * Exposes an imperative handle through a ref and cleans it up on removal.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const useImperativeHandle: typeof ReactTypes.useImperativeHandle = Core.useImperativeHandle;

/**
 * Runs an insertion effect during the upstream commit phase.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const useInsertionEffect: typeof ReactTypes.useInsertionEffect = Core.useInsertionEffect;

/**
 * Runs an effect synchronously during server commit; client paint timing is independent.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const useLayoutEffect: typeof ReactTypes.useLayoutEffect = Core.useLayoutEffect;

/**
 * Memoizes a computed value while its dependencies remain equal.
 *
 * @category Mapping
 * @since 1.0.0
 */
export const useMemo: typeof ReactTypes.useMemo = Core.useMemo;

/**
 * Projects optimistic state while an action is pending.
 *
 * @category Mapping
 * @since 1.0.0
 */
export const useOptimistic: typeof ReactTypes.useOptimistic = Core.useOptimistic;

/**
 * Stores state updated through a reducer.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const useReducer: typeof ReactTypes.useReducer = Core.useReducer;

/**
 * Keeps one mutable ref per mounted component; later initial values are ignored.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const useRef: typeof ReactTypes.useRef = Core.useRef;

/**
 * Stores component state with value or functional updates.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const useState: typeof ReactTypes.useState = Core.useState;

/**
 * Subscribes to consistent snapshots of an external store.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const useSyncExternalStore: typeof ReactTypes.useSyncExternalStore = Core.useSyncExternalStore;

/**
 * Tracks pending transitions and starts nonurgent updates.
 *
 * @category Sequencing
 * @since 1.0.0
 */
export const useTransition: typeof ReactTypes.useTransition = Core.useTransition;

/**
 * Pinned upstream React version.
 *
 * @category Constant
 * @since 1.0.0
 */
export const version: typeof ReactTypes.version = Core.version;

/**
 * Renders children without browser animations, transition callbacks or a native transition ref.
 *
 * @category Combinator
 * @since 1.0.0
 */
export const ViewTransition: ReactTypes.FunctionComponent<ReactTypes.ViewTransitionProps> =
    (props: ReactTypes.ViewTransitionProps) => props.children;

/**
 * Captures the diagnostic owner stack when called during supported React execution.
 *
 * @category Tracing
 * @since 1.0.0
 */
export const captureOwnerStack: typeof ReactTypes.captureOwnerStack = Core.captureOwnerStack;

/**
 * Supported React client value exports shared by default and named imports.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Client
{
    readonly Activity: typeof Activity;
    readonly Children: typeof Children;
    readonly Component: typeof Component;
    readonly PureComponent: typeof PureComponent;
    readonly Fragment: typeof Fragment;
    readonly Profiler: typeof Profiler;
    readonly StrictMode: typeof StrictMode;
    readonly Suspense: typeof Suspense;
    readonly addTransitionType: typeof addTransitionType;
    readonly cache: typeof cache;
    readonly cacheSignal: typeof cacheSignal;
    readonly cloneElement: typeof cloneElement;
    readonly createContext: typeof createContext;
    readonly createElement: typeof createElement;
    readonly createRef: typeof createRef;
    readonly forwardRef: typeof forwardRef;
    readonly isValidElement: typeof isValidElement;
    readonly lazy: typeof lazy;
    readonly memo: typeof memo;
    readonly startTransition: typeof startTransition;
    readonly use: typeof use;
    readonly useActionState: typeof useActionState;
    readonly useCallback: typeof useCallback;
    readonly useContext: typeof useContext;
    readonly useDebugValue: typeof useDebugValue;
    readonly useDeferredValue: typeof useDeferredValue;
    readonly useEffect: typeof useEffect;
    readonly useEffectEvent: typeof useEffectEvent;
    readonly useId: typeof useId;
    readonly useImperativeHandle: typeof useImperativeHandle;
    readonly useInsertionEffect: typeof useInsertionEffect;
    readonly useLayoutEffect: typeof useLayoutEffect;
    readonly useMemo: typeof useMemo;
    readonly useOptimistic: typeof useOptimistic;
    readonly useReducer: typeof useReducer;
    readonly useRef: typeof useRef;
    readonly useState: typeof useState;
    readonly useSyncExternalStore: typeof useSyncExternalStore;
    readonly useTransition: typeof useTransition;
    readonly version: typeof version;
    readonly ViewTransition: typeof ViewTransition;
    readonly captureOwnerStack: typeof captureOwnerStack;
}

/* Aliases preserve upstream names and generic constraints for arbitrary component props. */
/* eslint-disable @typescript-eslint/naming-convention */

namespace React
{

    /**
     * Instance type of the upstream PureComponent class.
     *
     * @category Model
     * @since 1.0.0
     */
    export type PureComponent<Props = {}, State = {}, Snapshot = any> =
        ReactTypes.PureComponent<Props, State, Snapshot>;

    /**
     * Instance type of the upstream Component class.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Component<Props = {}, State = {}, Snapshot = any> =
        ReactTypes.Component<Props, State, Snapshot>;

    /**
     * Upstream ReactNode type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ReactNode = ReactTypes.ReactNode;

    /**
     * Upstream ReactElement type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ReactElement<
        P = unknown,
        T extends string | ReactTypes.JSXElementConstructor<any> =
            string | ReactTypes.JSXElementConstructor<any>
    > = ReactTypes.ReactElement<P, T>;

    /**
     * Upstream ReactPortal type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ReactPortal = ReactTypes.ReactPortal;

    /**
     * Upstream Key type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Key = ReactTypes.Key;

    /**
     * Upstream Ref type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Ref<T> = ReactTypes.Ref<T>;

    /**
     * Upstream RefCallback type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type RefCallback<T> = ReactTypes.RefCallback<T>;

    /**
     * Upstream RefObject type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type RefObject<T> = ReactTypes.RefObject<T>;

    /**
     * Upstream LegacyRef type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type LegacyRef<T> = ReactTypes.LegacyRef<T>;

    /**
     * Upstream ForwardedRef type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ForwardedRef<T> = ReactTypes.ForwardedRef<T>;

    /**
     * Upstream MutableRefObject type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type MutableRefObject<T> = ReactTypes.MutableRefObject<T>;

    /**
     * Upstream ComponentType type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ComponentType<P = {}> = ReactTypes.ComponentType<P>;

    /**
     * Upstream JSXElementConstructor type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type JSXElementConstructor<P> = ReactTypes.JSXElementConstructor<P>;

    /**
     * Upstream ElementType type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ElementType<
        P = any,
        Tag extends keyof ReactTypes.JSX.IntrinsicElements = keyof ReactTypes.JSX.IntrinsicElements
    > = ReactTypes.ElementType<P, Tag>;

    /**
     * Upstream ComponentProps type available through the default React namespace.
     *
     * @category UtilityType
     * @since 1.0.0
     */
    export type ComponentProps<
        T extends keyof ReactTypes.JSX.IntrinsicElements | ReactTypes.JSXElementConstructor<any>
    > = ReactTypes.ComponentProps<T>;

    /**
     * Upstream ComponentPropsWithRef type available through the default React namespace.
     *
     * @category UtilityType
     * @since 1.0.0
     */
    export type ComponentPropsWithRef<T extends ReactTypes.ElementType> = ReactTypes.ComponentPropsWithRef<T>;

    /**
     * Upstream ComponentPropsWithoutRef type available through the default React namespace.
     *
     * @category UtilityType
     * @since 1.0.0
     */
    export type ComponentPropsWithoutRef<
        T extends ReactTypes.ElementType
    > = ReactTypes.ComponentPropsWithoutRef<T>;

    /**
     * Upstream ComponentRef type available through the default React namespace.
     *
     * @category UtilityType
     * @since 1.0.0
     */
    export type ComponentRef<T extends ReactTypes.ElementType> = ReactTypes.ComponentRef<T>;

    /**
     * Upstream ElementRef type available through the default React namespace.
     *
     * @category UtilityType
     * @since 1.0.0
     */
    export type ElementRef<C extends
            | ReactTypes.ForwardRefExoticComponent<any>
            | { new(props: any, context: any): ReactTypes.Component<any> }
            | ((props: any) => ReactTypes.ReactNode)
            | keyof ReactTypes.JSX.IntrinsicElements> = ReactTypes.ElementRef<C>;

    /**
     * Upstream FunctionComponent type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type FunctionComponent<P = {}> = ReactTypes.FunctionComponent<P>;

    /**
     * Upstream FC type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type FC<P = {}> = ReactTypes.FC<P>;

    /**
     * Upstream FunctionComponentElement type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type FunctionComponentElement<P> = ReactTypes.FunctionComponentElement<P>;

    /**
     * Upstream ComponentElement type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ComponentElement<
        P,
        T extends ReactTypes.Component<P, ReactTypes.ComponentState>
    > = ReactTypes.ComponentElement<P, T>;

    /**
     * Upstream CElement type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type CElement<
        P,
        T extends ReactTypes.Component<P, ReactTypes.ComponentState>
    > = ReactTypes.CElement<P, T>;

    /**
     * Upstream ClassicElement type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ClassicElement<P> = ReactTypes.ClassicElement<P>;

    /**
     * Upstream ComponentClass type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ComponentClass<P = {}, S = ReactTypes.ComponentState> = ReactTypes.ComponentClass<P, S>;

    /**
     * Upstream ClassicComponentClass type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ClassicComponentClass<P = {}> = ReactTypes.ClassicComponentClass<P>;

    /**
     * Upstream ComponentState type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ComponentState = ReactTypes.ComponentState;

    /**
     * Upstream ErrorInfo type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ErrorInfo = ReactTypes.ErrorInfo;

    /**
     * Upstream Context type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Context<T> = ReactTypes.Context<T>;

    /**
     * Upstream Provider type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Provider<T> = ReactTypes.Provider<T>;

    /**
     * Upstream Consumer type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Consumer<T> = ReactTypes.Consumer<T>;

    /**
     * Upstream ProviderProps type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ProviderProps<T> = ReactTypes.ProviderProps<T>;

    /**
     * Upstream ConsumerProps type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ConsumerProps<T> = ReactTypes.ConsumerProps<T>;

    /**
     * Upstream ContextType type available through the default React namespace.
     *
     * @category UtilityType
     * @since 1.0.0
     */
    export type ContextType<C extends ReactTypes.Context<any>> = ReactTypes.ContextType<C>;

    /**
     * Upstream PropsWithChildren type available through the default React namespace.
     *
     * @category UtilityType
     * @since 1.0.0
     */
    export type PropsWithChildren<P = unknown> = ReactTypes.PropsWithChildren<P>;

    /**
     * Upstream PropsWithoutRef type available through the default React namespace.
     *
     * @category UtilityType
     * @since 1.0.0
     */
    export type PropsWithoutRef<Props> = ReactTypes.PropsWithoutRef<Props>;

    /**
     * Upstream PropsWithRef type available through the default React namespace.
     *
     * @category UtilityType
     * @since 1.0.0
     */
    export type PropsWithRef<Props> = ReactTypes.PropsWithRef<Props>;

    /**
     * Upstream RefAttributes type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type RefAttributes<T> = ReactTypes.RefAttributes<T>;

    /**
     * Upstream Attributes type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Attributes = ReactTypes.Attributes;

    /**
     * Upstream ClassAttributes type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ClassAttributes<T> = ReactTypes.ClassAttributes<T>;

    /**
     * Upstream ExoticComponent type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ExoticComponent<P = {}> = ReactTypes.ExoticComponent<P>;

    /**
     * Upstream NamedExoticComponent type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type NamedExoticComponent<P = {}> = ReactTypes.NamedExoticComponent<P>;

    /**
     * Upstream ForwardRefExoticComponent type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ForwardRefExoticComponent<P> = ReactTypes.ForwardRefExoticComponent<P>;

    /**
     * Upstream MemoExoticComponent type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type MemoExoticComponent<
        T extends ReactTypes.ComponentType<any>
    > = ReactTypes.MemoExoticComponent<T>;

    /**
     * Upstream LazyExoticComponent type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type LazyExoticComponent<
        T extends ReactTypes.ComponentType<any>
    > = ReactTypes.LazyExoticComponent<T>;

    /**
     * Upstream FragmentProps type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type FragmentProps = ReactTypes.FragmentProps;

    /**
     * Upstream SuspenseProps type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type SuspenseProps = ReactTypes.SuspenseProps;

    /**
     * Upstream ActivityProps type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ActivityProps = ReactTypes.ActivityProps;

    /**
     * Upstream ViewTransitionProps type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ViewTransitionProps = ReactTypes.ViewTransitionProps;

    /**
     * Upstream ViewTransitionInstance type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ViewTransitionInstance = ReactTypes.ViewTransitionInstance;

    /**
     * Upstream ViewTransitionClass type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ViewTransitionClass = ReactTypes.ViewTransitionClass;

    /**
     * Upstream ViewTransitionClassPerType type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ViewTransitionClassPerType = ReactTypes.ViewTransitionClassPerType;

    /**
     * Upstream ProfilerProps type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ProfilerProps = ReactTypes.ProfilerProps;

    /**
     * Upstream ProfilerOnRenderCallback type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ProfilerOnRenderCallback = ReactTypes.ProfilerOnRenderCallback;

    /**
     * Upstream DependencyList type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type DependencyList = ReactTypes.DependencyList;

    /**
     * Upstream EffectCallback type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type EffectCallback = ReactTypes.EffectCallback;

    /**
     * Upstream SetStateAction type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type SetStateAction<S> = ReactTypes.SetStateAction<S>;

    /**
     * Upstream Dispatch type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Dispatch<A> = ReactTypes.Dispatch<A>;

    /**
     * Upstream DispatchWithoutAction type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type DispatchWithoutAction = ReactTypes.DispatchWithoutAction;

    /**
     * Upstream Reducer type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Reducer<S, A> = ReactTypes.Reducer<S, A>;

    /**
     * Upstream ReducerState type available through the default React namespace.
     *
     * @category UtilityType
     * @since 1.0.0
     */
    export type ReducerState<R extends ReactTypes.Reducer<any, any>> = ReactTypes.ReducerState<R>;

    /**
     * Upstream ReducerWithoutAction type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type ReducerWithoutAction<S> = ReactTypes.ReducerWithoutAction<S>;

    /**
     * Upstream TransitionFunction type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type TransitionFunction = ReactTypes.TransitionFunction;

    /**
     * Upstream TransitionStartFunction type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type TransitionStartFunction = ReactTypes.TransitionStartFunction;

    /**
     * Upstream Usable type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Usable<T> = ReactTypes.Usable<T>;

    /**
     * Upstream CacheSignal type available through the default React namespace.
     *
     * @category Model
     * @since 1.0.0
     */
    export type CacheSignal = ReactTypes.CacheSignal;

    export namespace JSX
    {

        /**
         * Upstream JSX ElementType contract.
         *
         * @category Model
         * @since 1.0.0
         */
        export type ElementType = ReactTypes.JSX.ElementType;

        /**
         * Upstream JSX Element contract.
         *
         * @category Model
         * @since 1.0.0
         */
        export type Element = ReactTypes.JSX.Element;

        /**
         * Upstream JSX ElementClass contract.
         *
         * @category Model
         * @since 1.0.0
         */
        export type ElementClass = ReactTypes.JSX.ElementClass;

        /**
         * Upstream JSX ElementAttributesProperty contract.
         *
         * @category Model
         * @since 1.0.0
         */
        export type ElementAttributesProperty = ReactTypes.JSX.ElementAttributesProperty;

        /**
         * Upstream JSX ElementChildrenAttribute contract.
         *
         * @category Model
         * @since 1.0.0
         */
        export type ElementChildrenAttribute = ReactTypes.JSX.ElementChildrenAttribute;

        /**
         * Upstream JSX IntrinsicAttributes contract.
         *
         * @category Model
         * @since 1.0.0
         */
        export type IntrinsicAttributes = ReactTypes.JSX.IntrinsicAttributes;

        /**
         * Upstream JSX IntrinsicClassAttributes contract.
         *
         * @category UtilityType
         * @since 1.0.0
         */
        export type IntrinsicClassAttributes<T> = ReactTypes.JSX.IntrinsicClassAttributes<T>;

        /**
         * Upstream JSX IntrinsicElements contract.
         *
         * @category Model
         * @since 1.0.0
         */
        export type IntrinsicElements = ReactTypes.JSX.IntrinsicElements;

        /**
         * Upstream JSX LibraryManagedAttributes contract.
         *
         * @category UtilityType
         * @since 1.0.0
         */
        export type LibraryManagedAttributes<C, P> = ReactTypes.JSX.LibraryManagedAttributes<C, P>;
    }

}
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * React namespace for default imports, sharing all hooks with the named exports.
 *
 * @category Instance
 * @since 1.0.0
 */
const React: Client = {
    Activity,
    Children,
    Component,
    Fragment,
    Profiler,
    PureComponent,
    StrictMode,
    Suspense,
    ViewTransition,
    addTransitionType,
    cache,
    cacheSignal,
    captureOwnerStack,
    cloneElement,
    createContext,
    createElement,
    createRef,
    forwardRef,
    isValidElement,
    lazy,
    memo,
    startTransition,
    use,
    useActionState,
    useCallback,
    useContext,
    useDebugValue,
    useDeferredValue,
    useEffect,
    useEffectEvent,
    useId,
    useImperativeHandle,
    useInsertionEffect,
    useLayoutEffect,
    useMemo,
    useOptimistic,
    useReducer,
    useRef,
    useState,
    useSyncExternalStore,
    useTransition,
    version
};

export default React;
