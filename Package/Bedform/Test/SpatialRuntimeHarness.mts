/**
 * Deterministic native adapters and recording per-viewer surfaces for spatial runtime qualification.
 *
 * @module bedform/Test/SpatialRuntimeHarness
 *
 * @file      SpatialRuntimeHarness.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Recording fixtures retain lifecycle order and infer native callback types. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */

import type * as React from "../Source/Spatial/React/index.js";
import type * as Renderer from "../Source/Spatial/Renderer.js";
import { Restricted } from "./ReactHarness.mjs";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * One deterministic native scheduled callback.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Timer {
    readonly Callback: () => void;
    Due: number;
    readonly Repeat: number;
}

/**
 * Native System fake that can retain already-dequeued callbacks to qualify lifetime fences.
 *
 * @category Testing
 * @since 1.0.0
 */
export class System implements Renderer.System
{
    Tick = 0;
    private Next = 1;
    readonly Timers = new Map<number, Timer>();
    readonly Cleared: Array<number> = [];
    readonly run = (callback: () => void): number => this.Add(callback, 1, 0);
    readonly runTimeout = (callback: () => void, delay = 1): number =>
        this.Add(callback, Math.max(1, delay), 0);
    runInterval = (callback: () => void, delay = 1): number => this.Add(callback, delay, delay);
    readonly clearRun = (handle: number): void =>
    {
        this.Cleared.push(handle);
        this.Timers.delete(handle);
    };

    /**
     * Retains a callback until its due tick.
     *
     * @category Testing
     * @since 1.0.0
     */
    private Add(callback: () => void, delay: number, repeat: number): number
    {
        const handle = this.Next++;
        this.Timers.set(handle, { Callback: callback,
            Due: this.Tick + delay,
            Repeat: repeat });
        return handle;
    }

    /**
     * Advances native callbacks, then drains Promise jobs and the Node task boundary.
     *
     * @category Testing
     * @since 1.0.0
     */
    async Step(): Promise<void>
    {
        this.Tick++;
        const due = [ ...this.Timers ].filter(([ , timer ]) => timer.Due <= this.Tick);
        for (const [ handle, timer ] of due)
        {
            if (!this.Timers.has(handle))
            {
                continue;
            }

            if (timer.Repeat)
            {
                timer.Due += timer.Repeat;
            }
            else
            {
                this.Timers.delete(handle);
            }

            timer.Callback();
        }

        await new Promise<void>((resolve) => setImmediate(resolve));
    }

    /**
     * Reaches an observable checkpoint without assuming reconciler latency in ticks.
     *
     * @throws { assert.AssertionError } When work does not reach the checkpoint.
     *
     * @category Testing
     * @since 1.0.0
     */
    async Until(predicate: () => boolean): Promise<void>
    {
        for (let turn = 0; turn < 100 && !predicate(); turn++)
        {await this.Step();}

        assert.ok(predicate(), "Spatial work failed to reach the checkpoint.");
    }
}

/**
 * A recorded native surface lease, including lifetime and revision history.
 *
 * @category Testing
 * @since 1.0.0
 */
export interface Session {
    readonly Context: Renderer.SurfaceContext;
    readonly Frames: Array<Renderer.SurfaceFrame>;
    Updates: number;
    Disposals: number;
}

/**
 * Adapters that record allocation, release, failures and audience isolation without drawing primitives.
 *
 * @category Testing
 * @since 1.0.0
 */
export class Scene
{
    readonly System = new System();
    Players: Array<Renderer.Viewer> = [];
    readonly Sessions: Array<Session> = [];
    readonly Live = new Set<Session>();
    readonly Errors: Array<Renderer.Failure> = [];
    OnCreate?: (session: Session) => void;
    OnCommit?: (session: Session) => void;
    OnUpdate?: (session: Session) => void;
    OnDispose?: (session: Session) => void;
    readonly Factory: Renderer.SurfaceFactory = {
        CustomHost: true,
        Create: (Context) =>
        {
            const session: Session = { Context,
                Frames: [],
                Updates: 0,
                Disposals: 0 };
            this.Sessions.push(session);
            this.Live.add(session);
            Context.Own(() =>
            {
                assert.ok(this.Live.delete(session));
            });
            this.OnCreate?.(session);
            return {
                Commit: (frame) =>
                {
                    assert.equal(session.Disposals, 0);
                    session.Frames.push(frame);
                    this.OnCommit?.(session);
                },
                Update: () =>
                {
                    assert.equal(session.Disposals, 0);
                    session.Updates++;
                    this.OnUpdate?.(session);
                },
                Dispose: () =>
                {
                    session.Disposals++;
                    assert.equal(session.Disposals, 1);
                    this.OnDispose?.(session);
                }
            };
        }
    };

    /**
     * Starts a runtime through either the source module or a restricted/installed bundle.
     *
     * @category Testing
     * @since 1.0.0
     */
    Start(api: typeof Renderer, options: Partial<Renderer.Configuration> = {}): Renderer.Runtime
    {
        return api.Start({ World: { getAllPlayers: () => this.Players },
            System: this.System,
            Native: { TextPrimitive: class
            {
            } },
            Surface: this.Factory,
            Now: () => this.System.Tick * 50,
            Console: { error: () => undefined,
                warn: () => undefined,
                log: () => undefined,
                info: () => undefined,
                group: () => undefined,
                groupCollapsed: () => undefined,
                groupEnd: () => undefined },
            OnError: (error) => this.Errors.push(error),
            ...options });
    }
}

/**
 * Source or independently bundled runtime API and its matching React singleton.
 *
 * @category Testing
 * @since 1.0.0
 */
export interface Api {
    readonly Renderer: typeof Renderer;
    readonly React: typeof React;
    readonly CheckGlobals: () => void;
    readonly Spatial: typeof import("../Source/Spatial/index.js");
}

/**
 * Bundles every public runtime path and rejects any Node, browser or native-module import at execution.
 *
 * @category Testing
 * @since 1.0.0
 */
export async function Realm(contents?: string, directory?: string): Promise<Api>
{
    const result = await build({ stdin: {
        contents: contents ?? "export * as Renderer from \"./Renderer.ts\";\n" +
                "export * as React from \"./React/index.ts\";\n" +
                "export * as Spatial from \"./index.ts\";",
        resolveDir: directory ?? fileURLToPath(new URL("../Source/Spatial", import.meta.url)),
        loader: "ts"
    },
    bundle: true,
    format: "iife",
    globalName: "Vendor",
    platform: "neutral",
    target: "es2022",
    write: false,
    metafile: true,
    logLevel: "silent" });
    assert.ok(Object.keys(result.metafile!.inputs).every((name) => !name.includes("@minecraft")));
    if (directory)
    {
        assert.ok(Object.keys(result.metafile!.inputs).every((name) => name === "<stdin>" ||
            path.resolve(name).startsWith(path.resolve(directory) + path.sep)),
        "Installed runtime bundle escaped the isolated consumer.");
    }

    const realm = await Restricted("public", result.outputFiles[0]!.text);
    assert.deepEqual(realm.Accesses, []);
    return { ...realm.Vendor as unknown as Api,
        CheckGlobals: (): void => assert.deepEqual(realm.Accesses, []) };
}

/**
 * Extracts visible text from a committed surface frame without depending on private host instances.
 *
 * @category Testing
 * @since 1.0.0
 */
export function Text(frame: Renderer.SurfaceFrame | undefined): string
{
    const read = (node: Renderer.SurfaceNode): string => node.Hidden ? "" :
        (node.Text ?? "") + node.Children.map(read).join("");
    return frame?.Nodes.map(read).join("") ?? "";
}
