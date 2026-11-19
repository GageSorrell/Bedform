/**
 * Exercises two independently bundled consumers against the packaged Canvas entry point.
 *
 * @module bedform/Test/IntentCanvas
 *
 * @file      IntentCanvas.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native fixtures retain contextual inference and protocol ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import type * as Intent from "bedform/Spatial/Intent";
import * as Surface from "bedform/Canvas/Surface";
import type { DimensionLocation, Entity, Player } from "@minecraft/server";
import { strFromU8, unzipSync } from "fflate";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

/**
 * Loads the actual packed runtime and renderer in a third realm, with a shared deterministic
 * native-shaped bus. This establishes host integration, not native-engine or client acceptance.
 *
 * @category Testing
 * @since 1.0.0
 */
export async function VerifyIntentCanvas(directory: string): Promise<void>
{
    const archive = unzipSync(await readFile(join(directory,
        "node_modules/bedform/Asset/bedform-canvas.mcaddon")));
    const behavior = unzipSync(archive["bedform-canvas-bp.mcpack"]);
    const resources = unzipSync(archive["bedform-canvas-rp.mcpack"]);
    const effects = new Map<string, { Width: number;
        Height: number }>();
    for (const [ path, bytes ] of Object.entries(resources))
    {
        if (path.startsWith("particles/") && path.endsWith(".json"))
        {
            const effect = JSON.parse(strFromU8(bytes)).particle_effect;
            const uv = effect.components["minecraft:particle_appearance_billboard"].uv;
            assert.ok(resources[`${effect.description.basic_render_parameters.texture}.png`]);
            effects.set(effect.description.identifier, { Width: uv.texture_width,
                Height: uv.texture_height });
        }
    }

    let tick = 0;
    let serial = 0;
    const timers = new Map<number, { At: number;
        Every: number;
        Run: () => void }>();
    const listeners = new Set<(event: unknown) => void>();
    const deaths = new Set<(event: { deadEntity: Entity }) => void>();
    const leaves = new Set<(event: { playerId: string }) => void>();
    const events: Array<unknown> = [];
    const errors: Array<string> = [];
    const actors = new Map<string, Entity>();
    const spawns: Array<{ Tick: number;
        Viewer: string;
        Particle: string;
        Values: Record<string, unknown> }> = [];
    const texts = new Set<Text>();
    const signal = <Listener extends object>(set: Set<Listener>) => ({
        subscribe: (callback: Listener) => (set.add(callback), callback),
        unsubscribe: (callback: Listener) => void set.delete(callback)
    });
    const schedule = (run: () => void, delay = 1, every = 0): number =>
    {
        timers.set(++serial, { At: tick + Math.max(1, delay),
            Every: every,
            Run: run });
        return serial;
    };

    const system = {
        get currentTick() { return tick; },
        afterEvents: { scriptEventReceive: signal(listeners) },
        runTimeout: (run: () => void, delay = 1) => schedule(run, delay),
        runInterval: (run: () => void, delay = 1) => schedule(run, delay, delay),
        clearRun: (id: number) => void timers.delete(id),
        sendScriptEvent: (id: string, message: string) =>
            events.push({ id,
                message,
                sourceType: "Server" })
    };

    /**
     * Captures the native Molang setter boundary before the renderer reuses its map.
     *
     * @category Testing
     * @since 1.0.0
     */
    class Variables
    {
        Values: Record<string, unknown> = {};
        setFloat(name: string, value: number): void { this.Values[name] = value; }
        setColorRGBA(name: string, value: unknown): void { this.Values[name] = value; }
        setVector3(name: string, value: unknown): void { this.Values[name] = value; }
    }

    /**
     * An unregistered shape whose audience is checked at the manager boundary.
     *
     * @category Testing
     * @since 1.0.0
     */
    class Text
    {
        visibleTo: ReadonlyArray<Player> = [];
        color: unknown;
        backgroundColorOverride: unknown;
        depthTest = false;
        useRotation = true;
        scale = 0;
        constructor(public location: DimensionLocation, public text: string) {}
        setLocation(location: DimensionLocation): void { this.location = location; }
        remove(): void
        {
            assert.equal(this.visibleTo.length, 1, "cleanup never exposes a private shape");
            texts.delete(this);
        }
    }

    const actor = (id: string, typeId = "minecraft:player", z = 0) =>
    {
        const value = { id,
            typeId,
            isValid: true,
            dimension: { id: "minecraft:overworld" },
            location: { x: 0,
                y: 64,
                z },
            getHeadLocation()
            {
                return { ...value.location,
                    y: value.location.y + 1.62 };
            },
            getViewDirection()
            {
                return { x: 0,
                    y: 0,
                    z: z > 0 ? -1 : 1 };
            },
            spawnParticle(particle: string, _location: unknown, variables: Variables)
            {
                const effect = effects.get(particle);
                assert.ok(effect, `particle resolves in packaged resources: ${particle}`);
                const data = variables.Values;
                const key = Surface.ParticleVariable;
                assert.ok(Number(data[key.U]) >= 0 && Number(data[key.V]) >= 0);
                assert.ok(Number(data[key.U]) + Number(data[key.Width]) <= effect.Width);
                assert.ok(Number(data[key.V]) + Number(data[key.Height]) <= effect.Height);
                spawns.push({ Tick: tick,
                    Viewer: id,
                    Particle: particle,
                    Values: JSON.parse(JSON.stringify(data)) });
            } };
        actors.set(id, value as unknown as Entity);
        return value;
    };

    const north = actor("north", "minecraft:player", 4);
    const south = actor("south", "minecraft:player", -4);
    const npc = actor("npc", "minecraft:pig");
    const world = { getEntity: (id: string) => actors.get(id),
        getAllPlayers: () => [ north, south ],
        afterEvents: { entityDie: signal(deaths),
            playerLeave: signal(leaves) },
        primitiveShapesManager: { addText: (text: Text) =>
        {
            assert.equal(text.visibleTo.length, 1, "privacy precedes native registration");
            assert.equal(text.depthTest, true);
            assert.equal(text.useRotation, false);
            assert.equal(JSON.stringify(text.color), JSON.stringify(Surface.DefaultTint));
            assert.equal(JSON.stringify(text.backgroundColorOverride),
                JSON.stringify({ alpha: 0,
                    blue: 0,
                    green: 0,
                    red: 0 }));
            assert.ok(text.location.dimension);
            texts.add(text);
        } } };
    const native = { world,
        system,
        TextPrimitive: Text,
        MolangVariableMap: Variables };
    const evaluate = async (contents: string, resolveDir = directory) =>
    {
        const bundle = await build({ bundle: true,
            write: false,
            format: "iife",
            platform: "neutral",
            external: [ "@bedform/effect", "@bedform/effect/*" ],
            stdin: { contents,
                resolveDir },
            plugins: [ { name: "native-boundary",
                setup(builder)
                {
                    // esbuild uses Go regular expressions and rejects the Unicode flag.

                    builder.onResolve({ filter: /^@minecraft\/server$/ }, () => ({
                        path: "native",
                        namespace: "fixture" }));

                    builder.onLoad({ filter: /.*/,
                        namespace: "fixture" }, () => ({ contents:
                        "export const {world,system,TextPrimitive,MolangVariableMap}=globalThis.native;" }));
                } } ] });
        const sandbox: Record<string, unknown> = { native,
            console: { warn: (message: string) => errors.push(message) },
            process: undefined,
            require: undefined,
            Buffer: undefined,
            fetch: undefined,
            TextEncoder: undefined,
            TextDecoder: undefined,
            setTimeout: undefined,
            setInterval: undefined };
        runInNewContext(bundle.outputFiles[0].text, sandbox);
        return sandbox.api as typeof Intent;
    };

    const a = await evaluate("import * as I from \"bedform/Spatial/Intent\"; globalThis.api=I;");
    const b = await evaluate("import {Spatial} from \"bedform\"; globalThis.api=Spatial.Intent;");
    assert.notEqual(a.Start, b.Start, "independently bundled client module state");
    assert.equal(timers.size, 0, "consumer imports are inert");
    const options = { World: world,
        System: system } as unknown as Pick<Intent.Configuration, "World" | "System">;
    const first = a.Start({ ...options,
        Id: "qualification:first" });
    const second = b.Start({ ...options,
        Id: "qualification:second" });
    await evaluate(strFromU8(behavior["scripts/main.js"]));
    const advance = async (count = 1): Promise<void> =>
    {
        for (let i = 0; i < count; ++i)
        {
            for (let flush = 0; flush < 16; ++flush)
            {
                await Promise.resolve();
            }

            ++tick;
            for (const event of events.splice(0))
            {
                for (const callback of [ ...listeners ])
                {
                    callback(event);
                }
            }

            for (const [ id, timer ] of [ ...timers ])
            {
                if (timer.At <= tick && timers.has(id))
                {
                    if (timer.Every)
                    {
                        timer.At = tick + timer.Every;
                    }
                    else
                    {
                        timers.delete(id);
                    }

                    timer.Run();
                }
            }
        }
    };

    const settle = async (promise: Promise<void>): Promise<void> =>
    {
        let done = false;
        let failure: unknown;
        void promise.then(() =>
        {
            done = true;
        }, (error: unknown) =>
        {
            done = true;
            failure = error;
        });
        for (let wait = 0; !done && wait < 160; ++wait)
        {
            await advance();
        }

        assert.equal(done, true, "operation settles within the protocol timeout");
        if (failure)
        {
            throw failure;
        }
    };

    const entity = npc as unknown as Entity;
    for (const preset of Object.values(a.Builtin))
    {
        await settle(first.Set(entity, preset));
        const name = `bedform_canvas:intent_${preset.Name.replaceAll("-", "_")}`;
        const emitted = spawns.filter((spawn) => spawn.Tick === tick && spawn.Particle === name);
        assert.deepEqual(emitted.map((spawn) => spawn.Viewer).sort(), [ "north", "south" ]);
    }

    await settle(first.Set(entity, a.Builtin.Thinking));
    spawns.length = 0;
    await advance(20);
    const frames = new Set(spawns.filter((spawn) => spawn.Particle === "bedform_canvas:intent_thinking")
        .map((spawn) => Number(spawn.Values[Surface.ParticleVariable.V])));
    assert.equal(frames.size, 3, "particle refresh preserves elapsed animation phase");
    await settle(first.Set(entity, a.Glyphs("\uE100\uE101", { Advances: [ 30, 40 ],
        Height: 36 }),
    { Scale: 2,
        DurationTicks: 8 }));
    assert.equal(texts.size, 2);
    assert.ok([ ...texts ].every((text) => text.scale === 2.5));
    await settle(second.Set(entity, b.Glyphs("\uE100")));
    const disposing = first.Dispose();
    assert.equal(first.Dispose(), disposing);
    await settle(disposing);
    await advance(12);
    assert.equal(texts.size, 2, "old owner disposal and expiry preserve replacement");
    actors.delete(npc.id);
    await advance();
    assert.equal(texts.size, 0, "unloaded subjects stop emitting text");
    actors.set(npc.id, entity);
    await advance();
    assert.equal(texts.size, 2, "reload restores current intent");
    south.dimension.id = "minecraft:nether";
    await advance();
    assert.equal(texts.size, 1, "dimension boundaries retire private text");
    north.location.z = 33;
    await advance();
    assert.equal(texts.size, 0, "out of range viewers lose their private shape");
    north.location.z = 4;
    await settle(second.Clear(entity));
    await settle(second.Set(north as unknown as Entity, b.Glyphs("\uE100")));
    assert.equal(texts.size, 0, "the subject cannot see its own bubble");
    south.dimension.id = "minecraft:overworld";
    await advance();
    assert.equal(texts.size, 1);
    for (const leave of leaves)
    {
        leave({ playerId: north.id });
    }

    await advance();
    assert.equal(texts.size, 0, "disconnect clears owned subject state");
    await settle(second.Set(entity, b.Glyphs("\uE100")));
    for (const death of deaths)
    {
        death({ deadEntity: entity });
    }

    await advance();
    assert.equal(texts.size, 0, "death clears native text");
    await settle(second.Dispose());
    assert.equal(listeners.size, 1, "only Canvas retains a script event subscription");
    assert.equal(timers.size, 1, "only Canvas retains its renderer ticker");
    assert.deepEqual(errors, []);
}
