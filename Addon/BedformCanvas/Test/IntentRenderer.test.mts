/**
 * Qualifies private Intent rendering, measured placement, elapsed animation and isolated failures.
 *
 * @module bedform-canvas/Test/IntentRenderer.test
 *
 * @file      IntentRenderer.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native fixtures retain contextual callback inference and protocol field ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as Intent from "../../../Package/Bedform/Source/Spatial/Intent.js";
import * as Surface from "../../../Package/Bedform/Source/Canvas/Surface.js";
import { Catalogue, Lookup } from "../Public/Glyph.js";
import { Defaults, LayoutOf, Start } from "../Script/IntentRenderer.js";
import type { DimensionLocation, MolangVariableMap, TextPrimitive, World } from "@minecraft/server";
import type { State } from "../Script/IntentTypes.js";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Makes a current state with a loaded NPC and default presentation options.
 *
 * @category Testing
 * @since 1.0.0
 */
function StateOf(intent: Intent.Definition = Intent.Builtin.Thinking): State
{
    return { EntityId: "npc",
        ClientId: "test:addon",
        ConnectionId: "connection",
        RequestId: 1,
        Generation: 1,
        Intent: intent,
        Options: { DurationTicks: null,
            Scale: 1,
            Offset: { x: 0,
                y: 0.25,
                z: 0 },
            MaxDistance: 32 },
        StartedTick: 0,
        ElapsedTicks: 0,
        ExpiresAt: null,
        Subject: { Entity: { id: "npc" },
            Dimension: { id: "overworld" },
            Head: { x: 0,
                y: 2,
                z: 0 } } as NonNullable<State["Subject"]> };
}

/**
 * Builds native-shaped adapters that check privacy at registration time and retain spawn variables.
 *
 * @category Testing
 * @since 1.0.0
 */
function Host(maxSpawns?: number, maxTexts?: number, onError?: () => void)
{
    let states = [ StateOf() ];
    let audienceFails = false;
    let callback: (() => void) | undefined;
    const errors: Array<Error> = [];
    const spawns: Array<{ Viewer: string;
        Particle: string;
        Location: unknown;
        Values: Record<string, unknown> }> = [];
    const live = new Set<TextPrimitive>();
    const created: Array<TextPrimitive> = [];
    const registered: Array<TextPrimitive> = [];
    const failing = new Set<string>();
    const failRemove = new Set<TextPrimitive>();
    let failAdd = false;
    const viewer = (id: string, z: number, dimension = "overworld") => ({
        id,
        isValid: true,
        dimension: { id: dimension },
        location: { x: 0,
            y: 2,
            z },
        getHeadLocation() { return this.location; },
        getViewDirection()
        {
            return { x: 0,
                y: 0,
                z: this.location.z < 0 ? 1 : -1 };
        },
        spawnParticle(particle: string, location: unknown, variables: MolangVariableMap)
        {
            if (failing.has(id))
            {
                throw new Error("injected particle failure");
            }

            spawns.push({ Viewer: id,
                Particle: particle,
                Location: location,
                Values: { ...(variables as unknown as { values: Record<string, unknown> }).values } });
        }
    });
    const viewers = [ viewer("north", -5), viewer("south", 5) ];
    const world = {
        getAllPlayers: () =>
        {
            if (audienceFails)
            {
                throw new Error("audience unavailable");
            }

            return viewers;
        },
        primitiveShapesManager: { addText: (text: TextPrimitive) =>
        {
            assert.equal(text.visibleTo.length, 1, "audience is private BEFORE addText");
            assert.equal(text.depthTest, true);
            assert.equal(text.useRotation, false);
            assert.equal(text.backgroundColorOverride!.alpha, 0);
            assert.deepEqual(text.color, Surface.DefaultTint);
            assert.ok((text.location as DimensionLocation).dimension);
            assert.equal(text.textBackfaceVisible, false);
            if (failAdd)
            {
                throw new Error("injected add failure");
            }

            registered.push(text);
            live.add(text);
        } }
    } as unknown as World;
    const handle = Start({ World: world,
        System: { runInterval: (tick, interval) =>
        {
            assert.equal(interval, 1);
            callback = tick;
            return 1;
        },
        clearRun: () => { callback = undefined; } },
        Snapshot: () => states,
        MaxSpawns: maxSpawns,
        MaxTexts: maxTexts,
        CreateVariables: () =>
        {
            const values: Record<string, unknown> = {};
            return { values,
                setFloat: (name: string, value: number) => { values[name] = value; },
                setColorRGBA: (name: string, value: unknown) => { values[name] = value; }
            } as unknown as MolangVariableMap;
        },
        CreateText: (location, text) =>
        {
            let current = location;
            const shape = { text,
                get location() { return current; },
                visibleTo: [],
                setLocation(next: DimensionLocation) { current = next; },
                remove()
                {
                    if (failRemove.has(shape as unknown as TextPrimitive))
                    {
                        throw new Error("remove failed");
                    }

                    live.delete(shape as unknown as TextPrimitive);
                }
            } as unknown as TextPrimitive;
            created.push(shape);
            return shape;
        },
        OnError: (error) =>
        {
            errors.push(error);
            onError?.();
        }
    });
    return { handle,
        viewers,
        spawns,
        errors,
        live,
        created,
        registered,
        failing,
        failRemove,
        states: (next: Array<State>) => { states = next; },
        audienceFails: (value: boolean) => { audienceFails = value; },
        failAdd: (value: boolean) => { failAdd = value; },
        tick: () => callback?.(),
        running: () => callback !== undefined,
        viewer };
}

test("panels emit privately every tick for NPCs and exclude the subject player, range and dimension", () =>
{
    const host = Host();
    host.viewers.push(host.viewer("npc", 1), host.viewer("far", 32.01), host.viewer("nether", 2, "nether"),
        host.viewer("boundary", 32));
    host.tick();
    const count = LayoutOf(StateOf()).Content.length;
    assert.equal(host.spawns.length, count * 3);
    assert.deepEqual([ ...new Set(host.spawns.map((spawn) => spawn.Viewer)) ],
        [ "north", "south", "boundary" ]);
    host.tick();
    assert.equal(host.spawns.length, count * 6);
    assert.equal(host.created.length, 0);
    host.handle.Dispose();
    host.tick();
    assert.equal(host.spawns.length, count * 6);
    assert.equal(host.running(), false);
});

test("PUA text configures private billboards before registration and tracks motion and camera depth", () =>
{
    const host = Host();
    const state = StateOf(Intent.Glyphs("\uE200"));
    host.states([ state ]);
    host.tick();
    assert.equal(host.live.size, 2);
    const [ north, south ] = host.registered;
    assert.deepEqual(north.visibleTo.map((player) => player.id), [ "north" ]);
    assert.deepEqual(south.visibleTo.map((player) => player.id), [ "south" ]);
    assert.equal(north.location.y, 2.25 + 16 / 32);
    assert.equal(north.location.z, -Defaults.Depth * 4);
    assert.equal(south.location.z, Defaults.Depth * 4);
    assert.equal(north.scale, 1.25);
    host.states([ { ...state,
        Subject: { ...state.Subject!,
            Head: { x: 3,
                y: 4,
                z: 2 } } } ]);
    host.tick();
    assert.equal(host.created.length, 2);
    assert.equal(north.location.x, 3);
    assert.equal(north.location.y, 4.75);
    assert.ok((north.location as DimensionLocation).dimension);
    host.viewers.splice(0);
    host.tick();
    assert.equal(host.live.size, 0);
    assert.equal(north.visibleTo.length, 1, "cleanup never makes an empty audience public");
    host.handle.Dispose();
});

test("glyph panels use Canvas metrics, explicit overrides and native fallback separately", () =>
{
    const glyph = Catalogue.First;
    const text = String.fromCodePoint(glyph).repeat(3);
    assert.equal(LayoutOf(StateOf(Intent.Glyphs(text))).Width,
        Math.max(32, Lookup(glyph)!.Advance * 3 + 8));
    const layout = LayoutOf(StateOf(Intent.Glyphs("\uE200\uE201", { Advances: [ 30, 40 ],
        Height: 35 })));
    assert.equal(layout.Width, 78);
    assert.equal(layout.Height, 43);
    assert.equal(LayoutOf(StateOf(Intent.Glyphs("\uF800".repeat(3)))).Width, 35);
    const host = Host();
    const state = StateOf(Intent.Glyphs("\uE200"));
    host.states([ { ...state,
        Options: { ...state.Options,
            Scale: 2,
            Offset: { x: 3,
                y: 1,
                z: 4 } } } ]);
    host.tick();
    assert.equal(host.registered[0].location.x, 3);
    assert.equal(host.registered[0].location.y, 4);
    assert.equal(host.registered[0].scale, 2.5);
    host.handle.Dispose();
});

test("replacement, expiry, unload/reload, dimension changes and audience failures retire owned text", () =>
{
    const host = Host();
    const state = StateOf(Intent.Glyphs("\uE200"));
    host.states([ state ]);
    host.tick();
    const original = [ ...host.live ];
    host.states([ { ...state,
        Generation: 2,
        Intent: Intent.Glyphs("\uE201") } ]);
    host.tick();
    assert.equal(host.live.size, 2);
    assert.ok(original.every((text) => !host.live.has(text)));
    host.states([ { ...state,
        Subject: undefined } ]);
    host.tick();
    assert.equal(host.live.size, 0);
    host.states([ state ]);
    host.tick();
    assert.equal(host.live.size, 2);
    host.states([ { ...state,
        Subject: { ...state.Subject!,
            Dimension: { id: "nether" } as NonNullable<State["Subject"]>["Dimension"] } } ]);
    host.tick();
    assert.equal(host.live.size, 0);
    host.viewers[0].dimension.id = "nether";
    host.tick();
    assert.equal(host.live.size, 1);
    host.audienceFails(true);
    host.tick();
    assert.equal(host.live.size, 0);
    host.audienceFails(false);
    host.states([ state ]);
    host.viewers[0].dimension.id = "overworld";
    host.tick();
    host.states([]);
    host.tick();
    assert.equal(host.live.size, 0);
    host.handle.Dispose();
    host.handle.Dispose();
});

test("custom images fit the panel, preserve aspect and derive frame UVs from elapsed ticks", () =>
{
    const image: Intent.ImageDescriptor = { Kind: "image",
        Version: 1,
        Id: "test:strip",
        Particle: "test:strip",
        Width: 24,
        Height: 8,
        FrameCount: 3,
        FrameTicks: 4 };
    const state = StateOf(image);
    for (const [ elapsed, expected ] of [ [ 0, 0 ], [ 3, 0 ], [ 4, 8 ], [ 11, 16 ], [ 12, 0 ] ])
    {
        const sprite = LayoutOf({ ...state,
            ElapsedTicks: elapsed }).Content.at(-1)!;
        assert.equal(sprite.UV.Y, expected);
        assert.equal(sprite.Bounds.Width / sprite.Bounds.Height, 3);
        assert.equal(sprite.Bounds.X, -12);
    }

    const thinking = StateOf(Intent.Builtin.Thinking);
    assert.equal(LayoutOf({ ...thinking,
        ElapsedTicks: 6 }).Content.at(-1)!.UV.Y, 2);
    const sleep = StateOf(Intent.Builtin.Sleep);
    assert.equal(LayoutOf({ ...sleep,
        ElapsedTicks: 20 }).Content.at(-1)!.UV.Y, 80);
});

test("capacity and native failures isolate viewers, report once while failing and retry", () =>
{
    const host = Host();
    host.failing.add("north");
    host.tick();
    host.tick();
    assert.equal(host.errors.length, 1);
    assert.ok(host.spawns.every((spawn) => spawn.Viewer === "south"));
    host.failing.delete("north");
    host.tick();
    assert.ok(host.spawns.some((spawn) => spawn.Viewer === "north"));
    host.failing.add("north");
    host.tick();
    assert.equal(host.errors.length, 2);
    host.handle.Dispose();
    const limited = Host(LayoutOf(StateOf()).Content.length);
    limited.tick();
    assert.deepEqual([ ...new Set(limited.spawns.map((spawn) => spawn.Viewer)) ], [ "north" ]);
    assert.equal(limited.errors.length, 1);
    limited.handle.Dispose();
    const textLimit = Host(undefined, 1);
    textLimit.states([ StateOf(Intent.Glyphs("\uE200")) ]);
    textLimit.tick();
    assert.equal(textLimit.live.size, 1);
    assert.equal(textLimit.errors.length, 1);
    textLimit.handle.Dispose();
});

test("registration and cleanup failures stay private and cleanup retries after disposal", () =>
{
    const host = Host();
    host.states([ StateOf(Intent.Glyphs("\uE200")) ]);
    host.failAdd(true);
    host.tick();
    assert.equal(host.live.size, 0);
    assert.equal(host.errors.length, 2);
    host.failAdd(false);
    host.tick();
    assert.equal(host.live.size, 2);
    const shape = [ ...host.live ][0];
    host.failRemove.add(shape);
    host.handle.Dispose();
    assert.equal(host.live.size, 1);
    assert.equal(host.running(), true);
    assert.equal(shape.visibleTo.length, 1);
    const spawns = host.spawns.length;
    host.tick();
    assert.equal(host.spawns.length, spawns);
    host.failRemove.clear();
    host.tick();
    assert.equal(host.live.size, 0);
    assert.equal(host.running(), false);
});

test("panel defaults, pointer tip and ordered depth layers stay consistent", () =>
{
    const layout = LayoutOf(StateOf());
    assert.equal(layout.Width, 32);
    assert.equal(layout.Height, 24);
    assert.equal(Defaults.PixelSize, 1 / 32);
    assert.equal(Math.max(...layout.Content.map((sprite) => sprite.Bounds.Y + sprite.Bounds.Height)), 0);
    assert.equal(layout.Content.find((sprite) => sprite.Tint.red === 0xC6 / 255)!.Layer, 1);
    assert.equal(layout.Content.find((sprite) => sprite.Tint.red === 0xFF / 255)!.Layer, 2);
    assert.equal(layout.Content.at(-1)!.Layer, 3);
});

test("a subject failure and throwing diagnostics do not stop other subjects", () =>
{
    const host = Host(undefined, undefined, () =>
    {
        throw new Error("diagnostic failed");
    });
    const broken = { ...StateOf(),
        EntityId: "broken",
        Intent: { Kind: "builtin",
            Name: "missing" } };
    host.states([ broken as State, StateOf() ]);
    host.tick();
    assert.equal(host.errors.length, 1);
    assert.ok(host.spawns.length > 0);
    host.handle.Dispose();
});

test("disposing from an error callback stops the current frame without reentrant drawing", () =>
{
    const host: ReturnType<typeof Host> = Host(undefined, undefined, () => host.handle.Dispose());
    host.failing.add("north");
    host.tick();
    assert.equal(host.running(), false);
    assert.equal(host.spawns.length, 0);
    assert.equal(host.errors.length, 1);

    const glyphHost: ReturnType<typeof Host> = Host(undefined, undefined,
        () => glyphHost.handle.Dispose());
    glyphHost.states([ StateOf(Intent.Glyphs("\uE200")) ]);
    glyphHost.failing.add("south");
    glyphHost.tick();
    assert.equal(glyphHost.live.size, 0, "reentrant disposal also removes earlier successful text");
    assert.equal(glyphHost.running(), false);
});
