/**
 * Bundles the `@bedform/server` entry point against a mocked native host, proving that it imports inertly,
 * runs derived gesture signals without Node or Web globals and releases every resource.
 *
 * @module @bedform/server/Test/Entry.test
 *
 * @file      Entry.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import Assert from "node:assert/strict";
import type { PluginBuild } from "esbuild";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

/** The package root, from which the bundled entry resolves `@bedform/server` through its own exports. */
const Package = fileURLToPath(new URL("..", import.meta.url));

/**
 * Bundles the package entry point against a mocked native host and runs its derived signals
 * without Node or Web globals, proving filters, counts, phases, option rejection and full cleanup.
 *
 * @category Tests
 * @since 2.11.0
 */
const verifyEntryGestures = async (): Promise<void> =>
{
    const subscriptions = new Map<string, Set<(event: unknown) => void>>();
    let interval: (() => void) | undefined;
    const player = { id: "a",
        inputInfo: { getMovementVector: (): Record<"x" | "y", number> => ({ x: 0,
            y: 0 }) },
        isValid: true };
    const afterEvents = Object.fromEntries([ "playerButtonInput", "playerLeave", "playerSpawn",
        "playerDimensionChange", "entityDie" ].map((name: string) =>
    {
        const callbacks = new Set<(event: unknown) => void>();
        subscriptions.set(name, callbacks);
        return [ name, { subscribe: (callback: (event: unknown) => void): (event: unknown) => void =>
        {
            callbacks.add(callback);
            return callback;
        },
        unsubscribe: (callback: (event: unknown) => void): void =>
        {
            Assert.ok(callbacks.delete(callback));
        } } ];
    }));
    const host = { system: { clearRun: (): void =>
    {
        interval = undefined;
    },
    currentTick: 0,
    runInterval: (callback: () => void): number =>
    {
        interval = callback;
        return 1;
    } },
    world: { afterEvents,
        getAllPlayers: (): Array<typeof player> => [ player ] } };
    const bundle = await build({
        bundle: true,
        format: "iife",
        metafile: true,
        platform: "neutral",
        plugins: [ { name: "bedrock-host",
            setup: (builder: PluginBuild): void =>
            {
                // esbuild filters are Go regular expressions, which reject JavaScript flags.
                builder.onResolve({ filter: new RegExp("^@minecraft/server$") }, () => ({ namespace: "host",
                    path: "server" }));
                builder.onLoad({ filter: new RegExp(".*"),
                    namespace: "host" }, () => ({ contents: "export const system = globalThis.host.system;" +
                        "export const world = globalThis.host.world;" +
                        "export const InputButton = { Jump: \"Jump\", Sneak: \"Sneak\" };" +
                        "export const ButtonState = { Pressed: \"Pressed\", Released: \"Released\" };",
                loader: "js" }));
            } } ],
        stdin: { contents: `
            import { InputButton, world } from "@bedform/server";
            const log = [];
            const record = (kind) => (event) => log.push([ kind, event.button, event.playerId, event.tick,
                event.tapCount, event.duration, event.phase ?? "", event.reason ?? "" ].join(":"));
            const signals = world.afterEvents;
            const press = record("Press");
            const double = record("NTap");
            const hold = record("Hold");
            signals.playerButtonPress.subscribe(press, { buttons: [ InputButton.Sneak ] });
            signals.playerButtonNTap.subscribe(double, { buttons: [ InputButton.Sneak ], count: 2 });
            signals.playerButtonHold.subscribe(hold, { buttons: [ InputButton.Jump ], holdTicks: 3,
                maxPressTicks: 2, phase: "End" });
            let rejected = 0;
            for (const attempt of [
                () => signals.playerButtonNTap.subscribe(() => {}, {}),
                () => signals.playerButtonPress.subscribe(() => {}, { buttons: [ "ItemUse" ] }),
                () => signals.playerButtonPress.subscribe(() => {}, { phase: "End" }),
                () => signals.playerButtonHold.subscribe(() => {}, { holdTicks: 5 }) ])
            {
                try { attempt(); } catch (error) { rejected += error instanceof TypeError ? 1 : 0; }
            }
            globalThis.WorldProof = { log, rejected, release: () =>
            {
                signals.playerButtonPress.unsubscribe(press);
                signals.playerButtonNTap.unsubscribe(double);
                signals.playerButtonHold.unsubscribe(hold);
            } };
        `,
        resolveDir: Package },
        target: "es2022",
        write: false
    });
    const Leak = new RegExp([ "^node:", "platform-node", "node_modules/effect/", "jiti", "esbuild",
        "typescript", "ProjectConfig", "/Build/", "/CLI/" ].join("|"), "u");
    Assert.ok(Object.keys(bundle.metafile.inputs).every((path: string) => !Leak.test(path)));
    Assert.ok(Object.keys(bundle.metafile.inputs).some((path: string) =>
        path.endsWith("Distribution/World.js")));
    const sandbox = { Buffer: undefined,
        TextDecoder: undefined,
        TextEncoder: undefined,
        URL: undefined,
        URLSearchParams: undefined,
        WorldProof: undefined as undefined | { log: Array<string>;
            rejected: number;
            release: () => void },
        clearTimeout: undefined,
        console: undefined,
        host,
        process: undefined,
        setInterval: undefined,
        setTimeout: undefined };
    runInNewContext(bundle.outputFiles[0].text, sandbox);
    const proof = sandbox.WorldProof!;
    Assert.equal(proof.rejected, 4);
    const button = (name: string, pressed: boolean): void =>
    {
        for (const callback of [ ...subscriptions.get("playerButtonInput")! ])
        {
            callback({ button: name,
                newButtonState: pressed ? "Pressed" : "Released",
                player });
        }
    };

    const tick = (): void =>
    {
        host.system.currentTick++;
        (interval as (() => void) | undefined)?.();
    };

    for (const [ name, pressed ] of [ [ "Sneak", true ], [ "Sneak", false ], [ "Sneak", true ],
        [ "Sneak", false ], [ "Jump", true ], [ "Jump", true ], [ "Jump", true ], [ "Jump", true ],
        [ "Jump", false ] ] as const)
    {
        tick();
        button(name, pressed);
    }

    // Copy out of the sandbox realm so strict equality does not compare foreign Array prototypes.
    Assert.deepEqual(Array.from(proof.log), [ "Press:Sneak:a:2:1:1::", "Press:Sneak:a:4:1:1::",
        "NTap:Sneak:a:4:2:1::",
        "Hold:Jump:a:9:0:4:End:Release" ]);
    Assert.equal([ ...subscriptions.values() ].reduce((total: number, callbacks: Set<unknown>) =>
        total + callbacks.size, 0), 5);
    proof.release();
    Assert.equal([ ...subscriptions.values() ].reduce((total: number, callbacks: Set<unknown>) =>
        total + callbacks.size, 0), 0);
    Assert.equal(interval, undefined);
};

test("public World entrypoint imports inertly, starts derived signals, and releases resources", async () =>
{
    let subscribed = 0;
    let unsubscribed = 0;
    let interval: (() => void) | undefined;
    const callbacks = new Map<string, (event: unknown) => void>();
    const player = { id: "a",
        inputInfo: { getMovementVector: (): Record<"x" | "y", number> => ({ x: 0,
            y: 0 }) } };
    const events = Object.fromEntries([ "playerButtonInput", "playerLeave", "playerSpawn",
        "playerDimensionChange", "entityDie" ]
        .map((name: string) => [ name, {
            subscribe: (callback: (event: unknown) => void): (event: unknown) => void =>
            {
                subscribed++;
                callbacks.set(name, callback);
                return callback;
            },
            unsubscribe: (callback: (event: unknown) => void): void =>
            {
                Assert.equal(callbacks.get(name), callback);
                unsubscribed++;
                callbacks.delete(name);
            }
        } ]));
    const host = {
        system: {
            clearRun: (): void => { interval = undefined; },
            currentTick: 0,
            runInterval: (callback: () => void): number =>
            {
                interval = callback;
                return 1;
            }
        },
        world: { afterEvents: events,
            getAllPlayers: (): Array<typeof player> => [ player ] }
    };
    const bundle = await build({
        bundle: true,
        format: "iife",
        platform: "neutral",
        plugins: [ {
            name: "bedrock-host",
            setup: (builder: PluginBuild): void =>
            {
                builder.onResolve({ filter: /^@minecraft\/server$/ }, () =>
                    ({ namespace: "host",
                        path: "server" }));
                builder.onLoad({ filter: /.*/,
                    namespace: "host" }, () => ({
                    contents: "export const system = globalThis.host.system;" +
                        "export const world = globalThis.host.world;" +
                        "export const InputButton = { Jump: \"Jump\", Sneak: \"Sneak\" };" +
                        "export const ButtonState = { Pressed: \"Pressed\", Released: \"Released\" };",
                    loader: "js"
                }));
            }
        } ],
        stdin: {
            contents: `
                import { InputButton, world } from "@bedform/server";
                globalThis.install = () =>
                {
                    const signal = world.afterEvents.playerButtonPress;
                    const callback = (event) => globalThis.responses.push(
                        event.button + ":" + event.playerId + ":" + event.tapCount + ":" + event.duration);
                    signal.subscribe(callback, { buttons: [ InputButton.Jump ] });
                    return { dispose: () => signal.unsubscribe(callback) };
                };
            `,
            resolveDir: Package
        },
        target: "es2022",
        write: false
    });
    const sandbox = { host,
        install: undefined as undefined | (() => { dispose: () => void }),
        responses: [] as Array<string> };
    runInNewContext(bundle.outputFiles[0].text, sandbox);
    Assert.equal(subscribed, 0);
    Assert.equal(interval, undefined);
    Assert.ok(sandbox.install);
    const handle = sandbox.install();
    Assert.equal(subscribed, 5);
    const sample = (): void =>
    {
        const scheduled = interval as (() => void) | undefined;
        if (!scheduled)
        {
            throw new Error("The World sampler must be scheduled while a listener exists.");
        }

        scheduled();
    };

    sample();
    callbacks.get("playerButtonInput")!({ button: "Jump",
        newButtonState: "Pressed",
        player });
    host.system.currentTick = 1;
    sample();
    host.system.currentTick = 2;
    callbacks.get("playerButtonInput")!({ button: "Jump",
        newButtonState: "Released",
        player });
    Assert.deepEqual(sandbox.responses, [ "Jump:a:1:2" ]);
    handle.dispose();
    Assert.equal(unsubscribed, 5);
    Assert.equal(interval, undefined);
});

test("entry point runs filtered, counted and phased gestures, rejects bad options and cleans up", async () =>
{
    await verifyEntryGestures();
});
