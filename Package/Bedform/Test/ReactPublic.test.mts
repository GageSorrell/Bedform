/**
 * Qualifies the bounded public React API, resource reads, ref identity and effect isolation.
 *
 * @module bedform/Test/ReactPublic.test
 *
 * @file      ReactPublic.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixture props and observations retain behavioral order. */
/* eslint-disable sort-keys */

import type * as Api from "../Source/Spatial/React/index.js";
import { Capture, CreateRoot, FakeSystem, Install, Print, Restricted } from "./ReactHarness.mjs";
import assert from "node:assert/strict";
import test from "node:test";

test("public imports and both JSX runtimes share the pinned inert client", async () =>
{
    const { Vendor, Accesses } = await Restricted("public");
    const React = Vendor.React as unknown as typeof Api;
    assert.equal(React.version, "19.3.1");
    assert.equal(React.default.useState, React.useState);
    for (const name of [ "useState", "useReducer", "useOptimistic", "useContext", "useRef",
        "useImperativeHandle", "useEffect", "useLayoutEffect", "useInsertionEffect", "useEffectEvent",
        "useMemo", "useCallback", "useTransition", "useDeferredValue", "useDebugValue", "useId",
        "useSyncExternalStore", "useActionState", "use" ] as const)
    {
        assert.equal(typeof React[name], "function", name);
        assert.equal(React[name], React.default[name], `${name} uses one dispatcher`);
    }

    const system = new FakeSystem();
    const dispose = Install(Vendor, system, { Console: Capture().Console });
    const Component = (): Api.ReactNode =>
    {
        const [ value ] = React.useState("shared");
        return React.createElement("value", null, value);
    };

    const root = CreateRoot(Vendor, system);
    const jsx = Vendor.JsxRuntime.jsx as (type: unknown, props: object) => unknown;
    const jsxDEV = Vendor.JsxDevRuntime.jsxDEV as (...args: Array<unknown>) => unknown;
    root.Render(jsx(React.ViewTransition, { children: jsx(Component, {}) }));
    await system.Settle();
    assert.equal(Print(root.Container), "<value>\"shared\"</value>");
    root.Render(jsxDEV(Component, {}, undefined, false, undefined, undefined));
    await system.Settle();
    assert.equal(Print(root.Container), "<value>\"shared\"</value>");
    root.Render(null);
    await system.Settle();
    assert.deepEqual(Accesses, []);
    dispose();
});

test("refs, effect forms, dependencies, context and roots remain isolated", async () =>
{
    const { Vendor, Accesses } = await Restricted("public");
    const React = Vendor.React as unknown as typeof Api;
    const system = new FakeSystem();
    const dispose = Install(Vendor, system, { Console: Capture().Console });
    const Context = React.createContext("default");
    const refs = new Map<string, Api.RefObject<number>>();
    const log: Array<string> = [];
    let renders = 0;
    const Probe = ({ id, initial, dependency }: { id: string;
        initial: number;
        dependency: number }): Api.ReactNode =>
    {
        renders++;
        const ref = React.useRef(initial);
        const context = React.useContext(Context);
        const previous = refs.get(id);
        if (previous !== undefined)
        {
            assert.equal(ref, previous);
        }

        refs.set(id, ref);
        React.useEffect(() =>
        {
            log.push(`void:${id}`);
        });
        React.useEffect(() =>
        {
            log.push(`mount:${id}`);
            return (...args: Array<unknown>): void =>
            {
                assert.equal(args.length, 0);
                log.push(`unmount:${id}`);
            };
        }, []);
        React.useEffect(() =>
        {
            log.push(`effect:${id}:${dependency}`);
            return (...args: Array<unknown>): void =>
            {
                assert.equal(args.length, 0);
                log.push(`cleanup:${id}:${dependency}`);
            };
        }, [ dependency ]);
        return React.createElement("probe", { id,
            context,
            value: ref.current });
    };

    const a = CreateRoot(Vendor, system);
    const b = CreateRoot(Vendor, system);
    const element = (id: string, initial: number, dependency: number = 0): Api.ReactElement =>
        React.createElement(Probe, { id,
            initial,
            dependency });
    a.Render(React.createElement(Context, { value: "a" }, element("a", 1)));
    b.Render(element("b", 2));
    await system.Settle();
    assert.notEqual(refs.get("a"), refs.get("b"));
    const before = renders;
    refs.get("a")!.current = 7;
    await system.Settle();
    assert.equal(renders, before, "ref mutation schedules no render");
    assert.ok(Print(a.Container).includes("value=1"), "a ref mutation alone does not commit");
    log.length = 0;
    a.Render(React.createElement(Context, { value: "changed" }, element("a", 99)));
    await system.Settle();
    assert.equal(Print(a.Container), "<probe id=a context=changed value=7></probe>");
    assert.equal(Print(b.Container), "<probe id=b context=default value=2></probe>");
    assert.deepEqual(log, [ "void:a" ]);
    log.length = 0;
    a.Render(React.createElement(Context, { value: "changed" }, element("a", 999, 1)));
    await system.Settle();
    assert.deepEqual(log, [ "cleanup:a:0", "void:a", "effect:a:1" ]);
    assert.equal(refs.get("b")?.current, 2);
    a.Render(null);
    await system.Settle();
    log.length = 0;
    b.Render(element("b", 99, 1));
    await system.Settle();
    assert.deepEqual(log, [ "cleanup:b:0", "void:b", "effect:b:1" ]);
    b.Render(null);
    await system.Settle();
    assert.ok(log.includes("unmount:b"));
    assert.ok(log.includes("cleanup:b:1"));
    assert.deepEqual(Accesses, []);
    dispose();
});

test("use reads contexts and thenables through Suspense and an error boundary", async () =>
{
    const { Vendor, Accesses } = await Restricted("public");
    const React = Vendor.React as unknown as typeof Api;
    const system = new FakeSystem();
    const dispose = Install(Vendor, system, { Console: Capture().Console });
    const Context = React.createContext("context");
    let resolve!: (value: string) => void;
    const pending = new Promise<string>((done: (value: string) => void) =>
    {
        resolve = done;
    });
    const Read = ({ resource }: { resource: Promise<string> }): Api.ReactNode =>
        React.createElement("resource", null, React.use(Context), React.use(resource));
    class Boundary extends React.Component<Api.PropsWithChildren, { failed: boolean }>
    {
        state: { failed: boolean } = { failed: false };

        /**
         * Converts a rejected resource into boundary state.
         *
         * @category ErrorHandling
         * @since 1.0.0
         */
        static getDerivedStateFromError(): { failed: boolean }
        {
            return { failed: true };
        }

        /**
         * Displays the error fallback after a rejected resource.
         *
         * @category Testing
         * @since 1.0.0
         */
        render(): Api.ReactNode
        {
            return this.state.failed ? React.createElement("failure") : this.props.children;
        }
    }

    const root = CreateRoot(Vendor, system);
    root.Render(React.createElement(React.Suspense, { fallback: React.createElement("pending") },
        React.createElement(Read, { resource: pending })));
    await system.Settle();
    assert.equal(Print(root.Container), "<pending></pending>");
    resolve("resolved");
    await system.Settle();
    assert.equal(Print(root.Container), "<resource>\"context\"\"resolved\"</resource>");
    const rejected = Promise.reject<string>(new Error("resource rejected"));
    await rejected.catch(() => undefined);
    root.Render(React.createElement(Boundary, null, React.createElement(Read, { resource: rejected })));
    await system.Settle();
    assert.equal(Print(root.Container), "<failure></failure>");
    root.Render(null);
    await system.Settle();
    assert.deepEqual(Accesses, []);
    dispose();
});
