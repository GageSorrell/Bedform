/**
 * Exercises installed React declarations and automatic JSX without DOM or ambient Node types.
 *
 * @module bedform/Test/ReactConsumer
 *
 * @file      ReactConsumer.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import React, * as API from "bedform/Spatial/React";
import type { ReactNode, RefObject } from "bedform/Spatial/React";

const DefaultNamespaceType: React.ReactNode = null;
const ClassInstance: API.Component<{ Value: number }> | React.Component<{ Value: number }> | null = null;
void ClassInstance;
void DefaultNamespaceType;

const Context = React.createContext("context");
const Subscribe = (): (() => void) => () => undefined;
const Snapshot = (): string => "store";

/**
 * Creates the fixture's host leaf without requiring spatial widget types.
 *
 * @category Testing
 * @since 1.0.0
 */
function Leaf({ children }: API.PropsWithChildren): ReactNode
{
    return React.createElement("sample", null, children);
}

/**
 * Runs every stable hook against the installed public singleton.
 *
 * @category Testing
 * @since 1.0.0
 */
export function Sample(): ReactNode
{
    const [ state ] = API.useState(() => 1);
    const [ reduced ] = API.useReducer((previous: number, next: number) => previous + next, 2);
    const [ optimistic ] = API.useOptimistic(3);
    const context = API.useContext(Context);
    const ref: RefObject<number> = API.useRef(4);
    const imperative = API.useRef<{ Value: number } | null>(null);
    API.useImperativeHandle(imperative, () => ({ Value: ref.current }), []);
    API.useEffect(() => undefined, []);
    API.useEffect(() => () => undefined, []);
    API.useLayoutEffect(() => undefined, []);
    API.useInsertionEffect(() => undefined, []);
    const event = API.useEffectEvent(() => ref.current);
    API.useEffect(() =>
    {
        event();
    }, []);
    const memo = API.useMemo(() => 5, []);
    const callback = API.useCallback(() => 6, []);
    const [ pending ] = API.useTransition();
    const deferred = API.useDeferredValue(7);
    API.useDebugValue("sample");
    const id = API.useId();
    const store = API.useSyncExternalStore(Subscribe, Snapshot);
    const [ action ] = API.useActionState((previous: number) => previous + 1, 8);
    const resource = API.use(Context);
    return <API.ViewTransition><Leaf>{[
        state, reduced, optimistic, context, ref.current, memo, callback(), pending,
        deferred, id.length > 0, store, action, resource
    ].join("|")}</Leaf></API.ViewTransition>;
}

/**
 * Checks rejected hook argument shapes without running them.
 *
 * @category Testing
 * @since 1.0.0
 */
export function InvalidTypes(): void
{
    // @ts-expect-error Cleanup receives no argument.
    API.useEffect(() => (value: number) =>
    {
        void value;
    });
    // @ts-expect-error Effects cannot return a Promise.
    API.useEffect(async () => undefined);
    const ref = API.useRef(1);
    ref.current = 2;
    // @ts-expect-error Ref mutation preserves its inferred value type.
    ref.current = "invalid";
    // @ts-expect-error Resources must be contexts or thenables.
    API.use(1);
}
