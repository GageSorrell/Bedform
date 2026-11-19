/**
 * Qualifies inert spatial startup, real shared reconciliation, audience leases and complete disposal.
 *
 * @module bedform/Test/SpatialRuntime.test
 *
 * @file      SpatialRuntime.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Scenarios retain event order and infer callbacks from the typed runtime and React contracts. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */

import * as React from "../Source/Spatial/React/index.js";
import * as Renderer from "../Source/Spatial/Renderer.js";
import { Realm, Scene, Text } from "./SpatialRuntimeHarness.mjs";
import type { Session } from "./SpatialRuntimeHarness.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
const A: Renderer.Viewer = Object.freeze({ id: "a",
    isValid: true });
const B: Renderer.Viewer = Object.freeze({ id: "b",
    isValid: true });
const C: Renderer.Viewer = Object.freeze({ id: "c",
    isValid: true });

/**
 * Reads the most recent committed text for one recorded private presentation.
 *
 * @category Testing
 * @since 1.0.0
 */
function Last(session: Session | undefined): string
{
    return Text(session?.Frames.at(-1));
}

test("public runtime imports are inert and execute without Node/browser/native modules", async () =>
{
    const api = await Realm();
    const scene = new Scene();
    scene.Players = [ A ];
    let constructions = 0;
    class NativeText
    {
        constructor()
        {
            constructions++;
        }
    }
    const runtime = scene.Start(api.Renderer, { Native: { TextPrimitive: NativeText } });
    const root = api.Renderer.CreateRoot(runtime, { Player: A });
    assert.equal(scene.Sessions.length, 0);
    await scene.System.Step();
    assert.equal(scene.Sessions.length, 0, "Unrendered roots allocate no surfaces.");
    assert.equal(constructions, 0);
    const Component = (): React.ReactNode =>
    {
        const [ value ] = api.React.useState("restricted");
        return api.React.createElement("label", null, value);
    };

    root.Render(api.React.createElement(Component));
    await scene.System.Until(() => Last(scene.Sessions[0]) === "restricted");
    assert.equal(scene.Sessions[0]?.Context.Native.TextPrimitive, NativeText);
    await runtime.Dispose();
    assert.equal(constructions, 0);
    assert.equal(scene.Live.size, 0);
    assert.equal(scene.System.Timers.size, 0);
    api.CheckGlobals();
});
test("private and shared roots isolate viewers, retain state and replace audience leases before refresh",
    async (context) =>
    {
        const scene = new Scene();
        scene.Players = [ A, B, C ];
        const runtime = scene.Start(Renderer);
        context.after(() => runtime.Dispose());
        let audience = [ B, B ];
        const privateRoot = Renderer.CreateRoot(runtime, { Player: A });
        const shared = Renderer.CreateRoot(runtime, { Shared: true,
            Audience: () => audience });
        let mounts = 0;
        let update!: React.Dispatch<React.SetStateAction<number>>;
        const Application = (): React.ReactNode =>
        {
            const [ value, set ] = React.useState(1);
            update = set;
            React.useEffect(() =>
            {
                mounts++;
                return () =>
                {
                    mounts--;
                };
            }, []);
            return React.createElement("shared", null, value);
        };

        privateRoot.Render(React.createElement("private", null, "private"));
        shared.Render(React.createElement(Application));
        await scene.System.Until(() => scene.Sessions.length === 2 && mounts === 1);
        assert.deepEqual(scene.Sessions.map((session) => session.Context.Viewer), [ A, B ]);
        const original = scene.Sessions[1]!;
        const frame = original.Frames.at(-1);
        const oldUpdates = original.Updates;
        audience = [ C ];
        await scene.System.Step();
        assert.equal(original.Disposals, 1);
        assert.equal(original.Updates, oldUpdates);
        assert.equal(scene.Sessions[2]?.Context.Viewer, C);
        assert.equal(scene.Sessions[2]?.Frames[0], frame, "An audience change does not remount React.");
        assert.equal(mounts, 1);
        update((value) => value + 1);
        assert.equal(Last(scene.Sessions[2]), "1", "Rendering is deferred until a commit.");
        await scene.System.Until(() => Last(scene.Sessions[2]) === "2");
        assert.equal(Last(scene.Sessions[0]), "private");
        audience = [];
        await scene.System.Step();
        assert.equal(scene.Sessions[2]?.Disposals, 1);
        assert.equal(scene.Live.size, 1, "Empty shared audiences never become public.");
        await shared.Unmount();
        assert.equal(mounts, 0);
        await privateRoot.Unmount();
        assert.equal(scene.Live.size, 0);
    });
test("disconnects and replaced player objects cannot inherit a private root", async (context) =>
{
    const scene = new Scene();
    scene.Players = [ A ];
    const runtime = scene.Start(Renderer);
    context.after(() => runtime.Dispose());
    const root = Renderer.CreateRoot(runtime, { Player: A });
    root.Render(React.createElement("private", null, "secret"));
    await scene.System.Until(() => scene.Live.size === 1);
    scene.Players = [];
    await scene.System.Step();
    assert.equal(scene.Live.size, 0);
    scene.Players = [ { id: A.id,
        isValid: true } ];
    await scene.System.Step();
    assert.equal(scene.Sessions.length, 1);
    assert.equal(scene.Live.size, 0);
    await root.Unmount();
});
test("audience and world failures revoke presentation and recover without remounting state",
    async (context) =>
    {
        const scene = new Scene();
        scene.Players = [ A ];
        let worldFails = false;
        let audienceFails = false;
        const runtime = scene.Start(Renderer, { World: { getAllPlayers: () =>
        {
            if (worldFails)
            {
                throw new Error("world failure");
            }

            return scene.Players;
        } } });
        context.after(() => runtime.Dispose());
        const root = Renderer.CreateRoot(runtime, { Shared: true,
            Audience: () =>
            {
                if (audienceFails)
                {
                    throw new Error("audience failure");
                }

                return [ A ];
            } });
        root.Render(React.createElement("label", null, "retained"));
        await scene.System.Until(() => scene.Live.size === 1);
        audienceFails = true;
        await scene.System.Step();
        assert.equal(scene.Live.size, 0);
        assert.equal(root.Disposed, false);
        audienceFails = false;
        await scene.System.Step();
        assert.equal(Last(scene.Sessions.at(-1)), "retained");
        worldFails = true;
        await scene.System.Step();
        assert.equal(scene.Live.size, 0);
        worldFails = false;
        await scene.System.Step();
        assert.equal(Last(scene.Sessions.at(-1)), "retained");
        assert.equal(scene.Errors.filter((error) => error.Phase === "audience").length, 2);
    });
test("unmount is Promise-idempotent and releases refs, effects, subscriptions and owned resources",
    async (context) =>
    {
        const scene = new Scene();
        scene.Players = [ A, B ];
        const runtime = scene.Start(Renderer);
        context.after(() => runtime.Dispose());
        const listeners = new Set<() => void>();
        let value = 0;
        let effects = 0;
        let owned = 0;
        const ref = React.createRef<object>();
        const subscribe = (listener: () => void): (() => void) =>
        {
            listeners.add(listener);
            return () =>
            {
                listeners.delete(listener);
            };
        };

        const read = (): number => value;
        const Component = ({ expose }: {
            expose?: boolean;
        }): React.ReactNode =>
        {
            const snapshot = React.useSyncExternalStore(subscribe, read);
            React.useEffect(() =>
            {
                effects++;
                return () =>
                {
                    effects--;
                };
            }, []);
            return React.createElement("state", { ref: expose ? ref : undefined }, snapshot);
        };

        const first = Renderer.CreateRoot(runtime, { Player: A });
        const second = Renderer.CreateRoot(runtime, { Player: B });
        first.Own(() =>
        {
            owned++;
        });
        first.Render(React.createElement(Component, { expose: true }));
        second.Render(React.createElement(Component));
        await scene.System.Until(() => listeners.size === 2 && scene.Live.size === 2);
        assert.ok(ref.current && Object.isFrozen(ref.current));
        const unmount = first.Unmount();
        assert.equal(first.Disposed, true);
        assert.equal(first.Unmount(), unmount);
        assert.throws(() => first.Render(null), /disposed/u);
        assert.throws(() => first.Own(() => undefined), /disposed/u);
        await unmount;
        assert.equal(ref.current, null);
        assert.equal(listeners.size, 1);
        assert.equal(effects, 1);
        assert.equal(owned, 1);
        value = 3;
        for (const notify of listeners)
        {
            notify();
        }

        await scene.System.Until(() => Last(scene.Sessions[1]) === "3");
        await runtime.Dispose();
        assert.equal(listeners.size, 0);
        assert.equal(effects, 0);
        assert.equal(scene.Live.size, 0);
        assert.throws(() => scene.Sessions[0]!.Context.Own(() => undefined), /disposed/u);
    });
test("runtime disposal cancels owned timers, fences dequeued work and permits restart after pending renders",
    async () =>
    {
        const scene = new Scene();
        scene.Players = [ A ];
        const unrelated = scene.System.runInterval(() => undefined, 1);
        for (let iteration = 0; iteration < 4; iteration++)
        {
            const runtime = scene.Start(Renderer);
            const root = Renderer.CreateRoot(runtime, { Player: A });
            root.Render(React.createElement("label", null, "pending"));
            const callbacks = [ ...scene.System.Timers ].filter(([ id ]) => id !== unrelated)
                .map(([ , timer ]) => timer.Callback);
            const closing = runtime.Dispose();
            assert.equal(runtime.Dispose(), closing);
            assert.equal(root.Disposed, true);
            assert.throws(() => Renderer.CreateRoot(runtime, { Player: A }), /disposed/u);
            await closing;
            for (const callback of callbacks)
            {
                callback();
            }

            assert.equal(scene.System.Timers.size, 1);
            assert.ok(scene.System.Timers.has(unrelated));
            assert.equal(scene.Live.size, 0);
        }

        const runtime = scene.Start(Renderer);
        const root = Renderer.CreateRoot(runtime, { Player: A });
        root.Render(React.createElement("label", null, "restarted"));
        await scene.System.Until(() => Last(scene.Sessions.at(-1)) === "restarted");
        await runtime.Dispose();
        scene.System.clearRun(unrelated);
        assert.equal(scene.System.Timers.size, 0);
    });
test("late suspended resources cannot revive a disposed root or block a later runtime", async () =>
{
    const scene = new Scene();
    scene.Players = [ A ];
    const runtime = scene.Start(Renderer);
    let resolve!: (value: string) => void;
    const promise = new Promise<string>((done) =>
    {
        resolve = done;
    });
    const Component = (): React.ReactNode => React.createElement("resource", null, React.use(promise));
    const root = Renderer.CreateRoot(runtime, { Player: A });
    root.Render(React.createElement(React.Suspense, { fallback: React.createElement("pending") },
        React.createElement(Component)));
    await scene.System.Until(() => scene.Live.size === 1);
    await runtime.Dispose();
    const allocations = scene.Sessions.length;
    resolve("late");
    await scene.System.Step();
    assert.equal(scene.Sessions.length, allocations);
    assert.equal(scene.System.Timers.size, 0);
    const successor = scene.Start(Renderer);
    Renderer.CreateRoot(successor, { Player: A }).Render(React.createElement("next", null, "next"));
    await scene.System.Until(() => Last(scene.Sessions.at(-1)) === "next");
    await successor.Dispose();
});
test("factory, commit and update failures roll back per-viewer resources without stopping healthy roots",
    async () =>
    {
        for (const phase of [ "OnCreate", "OnCommit", "OnUpdate" ] as const)
        {
            const scene = new Scene();
            scene.Players = [ A, B ];
            const runtime = scene.Start(Renderer);
            const broken = Renderer.CreateRoot(runtime, { Player: A });
            const healthy = Renderer.CreateRoot(runtime, { Player: B });
            scene[phase] = (session) =>
            {
                if (session.Context.RootId === broken.Id)
                {
                    throw new Error(phase);
                }
            };

            broken.Render(React.createElement("bad", null, "bad"));
            healthy.Render(React.createElement("good", null, "good"));
            await scene.System.Until(() => broken.Disposed && scene.Live.size === 1);
            await broken.Unmount();
            assert.equal(Last(scene.Sessions.find((session) =>
                session.Context.RootId === healthy.Id)), "good");
            assert.equal(scene.Errors[0]?.RootId, broken.Id);
            assert.equal(healthy.Disposed, false);
            await runtime.Dispose();
            assert.equal(scene.Live.size, 0);
        }
    });
test("cleanup and error-observer failures still release every registered resource and sibling root",
    async () =>
    {
        const scene = new Scene();
        scene.Players = [ A, B ];
        const runtime = scene.Start(Renderer);
        const root = Renderer.CreateRoot(runtime, { Player: A,
            OnError: () =>
            {
                throw new Error("observer");
            } });
        const sibling = Renderer.CreateRoot(runtime, { Player: B });
        let cleanup = 0;
        root.Own(() =>
        {
            cleanup++;
            throw new Error("owned cleanup");
        });
        root.Own(() =>
        {
            cleanup++;
        });
        scene.OnDispose = () =>
        {
            throw new Error("surface cleanup");
        };

        root.Render(React.createElement("first"));
        sibling.Render(React.createElement("second"));
        await scene.System.Until(() => scene.Live.size === 2);
        const closing = runtime.Dispose();
        await assert.rejects(closing, AggregateError);
        assert.equal(runtime.Dispose(), closing);
        assert.equal(cleanup, 2);
        assert.equal(scene.Live.size, 0);
        assert.equal(scene.System.Timers.size, 0);
        assert.equal(root.Disposed && sibling.Disposed, true);
        const next = scene.Start(Renderer);
        await next.Dispose();
    });
test("pure host validation errors reach a React boundary before native allocation", async (context) =>
{
    const scene = new Scene();
    scene.Players = [ A ];
    const runtime = scene.Start(Renderer);
    context.after(() => runtime.Dispose());
    const factory: Renderer.SurfaceFactory = { ...scene.Factory,
        Validate: (type) =>
        {
            if (type === "invalid")
            {
                throw new Error("invalid host node");
            }
        } };
    class Boundary extends React.Component<React.PropsWithChildren, {
        Failed: boolean;
    }>
    {
        state = { Failed: false };

        /**
         * Switches to the boundary fallback.
         *
         * @category Testing
         * @since 1.0.0
         */
        static getDerivedStateFromError(): {
            Failed: boolean;
        }
        {
            return { Failed: true };
        }

        /**
         * Renders the safe fallback after a host validator throws.
         *
         * @category Testing
         * @since 1.0.0
         */
        render(): React.ReactNode
        {
            return this.state.Failed ? React.createElement("safe", null, "fallback") : this.props.children;
        }
    }
    const root = Renderer.CreateRoot(runtime, { Player: A,
        Surface: factory });
    root.Render(React.createElement(Boundary, null, React.createElement("invalid")));
    await scene.System.Until(() => Last(scene.Sessions[0]) === "fallback");
    assert.equal(root.Disposed, false);
    assert.equal(scene.Errors[0]?.Phase, "caught");
    assert.ok(scene.Sessions[0]!.Frames.every((frame) =>
        frame.Nodes.every((node) => node.Type !== "invalid")));
});
test("committed snapshots retain keyed identity, freeze structure and propagate Activity visibility",
    async (context) =>
    {
        const scene = new Scene();
        scene.Players = [ A ];
        const runtime = scene.Start(Renderer);
        context.after(() => runtime.Dispose());
        const root = Renderer.CreateRoot(runtime, { Player: A });
        const tree = (names: Array<string>, hidden = false): React.ReactNode =>
            React.createElement(React.Activity, { mode: hidden ? "hidden" : "visible",
                children: names.map((name) => React.createElement("item", { key: name,
                    name }, name)) });
        root.Render(tree([ "a", "b" ]));
        await scene.System.Until(() => Last(scene.Sessions[0]) === "ab");
        const first = scene.Sessions[0]!.Frames.at(-1)!;
        const ids = first.Nodes.map((node) => node.Id);
        assert.ok(Object.isFrozen(first) && Object.isFrozen(first.Nodes) &&
        Object.isFrozen(first.Nodes[0]!.Props));
        root.Render(tree([ "b", "a" ]));
        await scene.System.Until(() => Last(scene.Sessions[0]) === "ba");
        assert.deepEqual(scene.Sessions[0]!.Frames.at(-1)!.Nodes.map((node) => node.Id),
            [ ...ids ].reverse());
        root.Render(tree([ "b", "a" ], true));
        await scene.System.Until(() => scene.Sessions[0]!.Frames.at(-1)!.Nodes.every((node) => node.Hidden));
        assert.equal(Last(scene.Sessions[0]), "");
        root.Render(tree([ "b", "a" ]));
        await scene.System.Until(() => Last(scene.Sessions[0]) === "ba");
    });
test("reentrant runtime disposal from a layout effect or surface commit fences future presentation",
    async () =>
    {
        for (const phase of [ "layout", "surface" ])
        {
            const scene = new Scene();
            scene.Players = [ A ];
            const runtime = scene.Start(Renderer);
            let closing: Promise<void> | undefined;
            const Component = (): React.ReactNode =>
            {
                React.useLayoutEffect(() =>
                {
                    if (phase === "layout")
                    {
                        closing = runtime.Dispose();
                    }
                }, []);
                return React.createElement("value", null, "value");
            };

            if (phase === "surface")
            {
                scene.OnCommit = () =>
                {
                    closing = runtime.Dispose();
                };
            }

            Renderer.CreateRoot(runtime, { Player: A }).Render(React.createElement(Component));
            await scene.System.Until(() => closing !== undefined);
            await closing;
            assert.equal(scene.Live.size, 0);
            assert.equal(scene.System.Timers.size, 0);
            if (phase === "surface")
            {
                assert.equal(scene.Sessions[0]?.Updates, 0);
            }
        }
    });
test("invalid configuration and exclusive startup fail without allocating native resources", async () =>
{
    const scene = new Scene();
    scene.Players = [ A ];
    assert.throws(() => scene.Start(Renderer, { TickBudget: 0 }), RangeError);
    assert.equal(scene.System.Timers.size, 0);
    assert.throws(() => Renderer.Start({} as Renderer.Configuration), /TextPrimitive/u);
    const runtime = scene.Start(Renderer);
    assert.throws(() => scene.Start(Renderer), /already installed/u);
    assert.equal(scene.System.Timers.size, 1);
    assert.throws(() => Renderer.CreateRoot(runtime, {} as Renderer.RootOptions), /private Player/u);
    assert.throws(() => Renderer.CreateRoot(runtime, { Shared: true } as Renderer.RootOptions), /Audience/u);
    await runtime.Dispose();
    assert.equal(scene.System.Timers.size, 0);
    const runInterval = scene.System.runInterval;
    scene.System.runInterval = () =>
    {
        throw new Error("interval failure");
    };

    assert.throws(() => scene.Start(Renderer), /interval failure/u);
    scene.System.runInterval = runInterval;
    const next = scene.Start(Renderer);
    await next.Dispose();
});

test("an uncaught update retires only its root and releases its previous committed presentation",
    async (context) =>
    {
        const scene = new Scene();
        scene.Players = [ A, B ];
        const runtime = scene.Start(Renderer);
        context.after(() => runtime.Dispose());
        const faulty = Renderer.CreateRoot(runtime, { Player: A });
        const healthy = Renderer.CreateRoot(runtime, { Player: B });
        faulty.Render(React.createElement("initial", null, "first"));
        healthy.Render(React.createElement("healthy", null, "healthy"));
        await scene.System.Until(() => scene.Live.size === 2);
        const Broken = (): never =>
        {
            throw new Error("render failure");
        };

        faulty.Render(React.createElement(Broken));
        await scene.System.Until(() => faulty.Disposed);
        await faulty.Unmount();
        assert.equal(scene.Live.size, 1);
        assert.equal(scene.Errors[0]?.RootId, faulty.Id);
        assert.equal(scene.Errors[0]?.Phase, "render");
        assert.equal(healthy.Disposed, false);
        const session = scene.Sessions.find((entry) => entry.Context.RootId === healthy.Id)!;
        const updates = session.Updates;
        await scene.System.Step();
        assert.ok(session.Updates > updates);
    });

test("early resource releases are idempotent and retired audience contexts reject new ownership", async () =>
{
    const scene = new Scene();
    scene.Players = [ A ];
    const runtime = scene.Start(Renderer, { Surface: undefined });
    assert.throws(() => Renderer.CreateRoot(runtime, { Player: A }), /surface factory/u);
    const root = Renderer.CreateRoot(runtime, { Player: A,
        Surface: scene.Factory });
    let rootReleases = 0;
    let viewerReleases = 0;
    const release = root.Own(() =>
    {
        rootReleases++;
    });
    release();
    release();
    root.Render(React.createElement("owned"));
    await scene.System.Until(() => scene.Live.size === 1);
    const surfaceContext = scene.Sessions[0]!.Context;
    const releaseViewer = surfaceContext.Own(() =>
    {
        viewerReleases++;
    });
    releaseViewer();
    releaseViewer();
    scene.Players = [];
    await scene.System.Step();
    assert.throws(() => surfaceContext.Own(() => undefined), /disposed/u);
    await runtime.Dispose();
    release();
    releaseViewer();
    assert.equal(rootReleases, 1);
    assert.equal(viewerReleases, 1);
    assert.equal(scene.Live.size, 0);
    assert.equal(scene.System.Timers.size, 0);
});
