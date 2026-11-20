/**
 * Qualifies Canvas particle surfaces with native-shaped fakes: tint, nested clipping and transforms,
 * poses, private per-viewer emission, work limits, failure isolation, managed refresh and disposal.
 *
 * @module bedform/Test/Surface.test
 *
 * @file      Surface.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native fixtures retain contextual callback inference and protocol field ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as Surface from "bedform/Canvas/Surface";
import type { Vector3 } from "@minecraft/server";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import test from "node:test";

/**
 * One recorded spawn with a snapshot of the variables at call time.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Spawn
{
    readonly Viewer: string;
    readonly Particle: string;
    readonly Location: Vector3;
    readonly Values: Record<string, unknown>;
}

/**
 * Records MolangVariableMap calls; spawns snapshot the current values.
 *
 * @category Testing
 * @since 1.0.0
 */
class FakeVariables implements Surface.Variables
{
    readonly Values: Record<string, unknown> = {};
    setFloat(name: string, value: number): void
    {
        this.Values[name] = value;
    }

    setColorRGBA(name: string, color: Surface.Rgba): void
    {
        this.Values[name] = { ...color };
    }

    setVector3(name: string, vector: Vector3): void
    {
        this.Values[name] = { ...vector };
    }
}

/**
 * Builds a fake player that records private particle spawns into a shared log.
 *
 * @category Testing
 * @since 1.0.0
 */
function Viewer(log: Array<Spawn>, id: string, eye: Vector3, options: { Dimension?: string;
    Valid?: boolean;
    Fail?: () => boolean } = {}): Surface.Viewer
{
    return { id,
        isValid: options.Valid ?? true,
        dimension: { id: options.Dimension ?? "minecraft:overworld" },
        getHeadLocation: () => eye,
        spawnParticle(particle: string, location: Vector3, variables?: Surface.Variables): void
        {
            if (options.Fail?.())
            {
                throw new Error("native spawn failed");
            }

            log.push({ Viewer: id,
                Particle: particle,
                Location: { ...location },
                Values: { ...(variables as FakeVariables).Values } });
        } };
}

const Near = (actual: number, expected: number): void => assert.ok(Math.abs(actual - expected) < 1e-9,
    `${actual} is not ${expected}`);
const Wall: Surface.Pose = { Position: { x: 0,
    y: 10,
    z: 0 },
Scale: 0.1,
Orientation: { Right: { x: 1,
    y: 0,
    z: 0 },
Up: { x: 0,
    y: 1,
    z: 0 } } };

test("tint defaults to dark gray and keeps arbitrary RGB/RGBA unquantized", () =>
{
    const gray = 0x4D / 255;
    assert.deepEqual(Surface.Tint(), { alpha: 1,
        blue: gray,
        green: gray,
        red: gray });
    assert.deepEqual(Surface.Tint("#4d4d4d"), Surface.Tint());
    assert.deepEqual(Surface.Tint({ red: 0.123,
        green: 0.456,
        blue: 0.789 }),
    { red: 0.123,
        green: 0.456,
        blue: 0.789,
        alpha: 1 });
    assert.deepEqual(Surface.Tint("#FF000080"), { red: 1,
        green: 0,
        blue: 0,
        alpha: 0x80 / 255 });
    for (const invalid of [ "#12", { red: 1.5,
        green: 0,
        blue: 0 }, { red: 0,
        green: 0,
        blue: 0,
        alpha: Infinity } ])
    {
        assert.throws(() => Surface.Tint(invalid), TypeError);
    }
});

test("nested viewports clip geometry and UVs in proportion and remove invisible sprites", () =>
{
    const image = (key: string, bounds: Surface.Box): Surface.Sprite => ({ Kind: "sprite",
        Particle: "test:image",
        UV: { X: 0,
            Y: 0,
            Width: 16,
            Height: 16 },
        Bounds: bounds,
        Key: key });
    const tree: Surface.Node = { Kind: "viewport",
        Clip: { X: 0,
            Y: 0,
            Width: 100,
            Height: 100 },
        Children: [
            Surface.Fill({ X: 0,
                Y: 0,
                Width: 100,
                Height: 100 }, "#202020", { Key: "background",
                Layer: 0 }),
            { Kind: "viewport",
                Clip: { X: 10,
                    Y: 10,
                    Width: 40,
                    Height: 40 },
                Offset: { X: -20,
                    Y: 0 },
                Scale: 2,
                Children: [ image("half", { X: 5,
                    Y: 0,
                    Width: 10,
                    Height: 10 }),
                image("gone", { X: 0,
                    Y: 0,
                    Width: 5,
                    Height: 5 }),
                { Kind: "viewport",
                    Clip: { X: 0,
                        Y: 0,
                        Width: 30,
                        Height: 3 },
                    Children: [
                        image("nested", { X: 10,
                            Y: 0,
                            Width: 10,
                            Height: 10 }) ] } ] } ] };
    const placed = Surface.Flatten(tree);
    assert.deepEqual(placed.map((sprite) => sprite.Key), [ "background", "half", "nested" ]);
    const half = placed[1];
    // Child X 5 maps to 10 - 20 + 5 * 2 = 0, width 20; the clip keeps X 10 to 20, the right half.
    assert.deepEqual(half.Bounds, { X: 10,
        Y: 10,
        Width: 10,
        Height: 20 });
    assert.deepEqual(half.UV, { X: 8,
        Y: 0,
        Width: 8,
        Height: 16 });
    assert.deepEqual(half.Path, [ 1, 0 ]);
    const nested = placed[2];
    // The nested clip (X -10..50, Y 10..16) intersects its parent; the sprite keeps its top 6 of 20 pixels.
    assert.deepEqual(nested.Bounds, { X: 10,
        Y: 10,
        Width: 20,
        Height: 6 });
    Near(nested.UV.Height, 16 * 6 / 20);
    assert.deepEqual(placed[0].Tint, Surface.Tint("#202020"));
    assert.equal(placed[0].Particle, Surface.Rectangle.Particle);
    assert.deepEqual(Surface.Flatten(tree, { X: 200,
        Y: 0,
        Width: 5,
        Height: 5 }), []);

    let deep: Surface.Node = Surface.Fill({ X: 0,
        Y: 0,
        Width: 1,
        Height: 1 });
    for (let depth = 0; depth <= Surface.TreeLimits.MaxDepth; depth++)
    {
        deep = { Kind: "viewport",
            Clip: { X: 0,
                Y: 0,
                Width: 1,
                Height: 1 },
            Children: [ deep ] };
    }

    assert.throws(() => Surface.Flatten(deep), RangeError);
    assert.throws(() => Surface.Flatten(Surface.Fill({ X: 0,
        Y: 0,
        Width: -1,
        Height: 1 })), TypeError);
    assert.throws(() => Surface.Flatten({ Kind: "sprite" } as unknown as Surface.Node), TypeError);
});

test("fixed and viewer-facing poses project position, size, depth layers and roll", () =>
{
    const placed = Surface.Flatten({ Kind: "viewport",
        Clip: { X: 0,
            Y: 0,
            Width: 40,
            Height: 40 },
        Children: [
            Surface.Fill({ X: 10,
                Y: 20,
                Width: 20,
                Height: 10 }, undefined, { Layer: 2 }) ] });
    const basis = Surface.FixedBasis({ x: 2,
        y: 0,
        z: 0 }, { x: 0.5,
        y: 3,
        z: 0 });
    assert.deepEqual(basis.Normal, { x: 0,
        y: 0,
        z: 1 });
    const [ quad ] = Surface.Project(placed, { ...Wall,
        Pivot: { X: 20,
            Y: 20 },
        LayerDepth: 0.01 }, basis);
    assert.equal(quad.Particle, Surface.Rectangle.Particle + Surface.OrientedSuffix);
    Near(quad.Location.x, 0);
    Near(quad.Location.y, 10 - 0.5);
    Near(quad.Location.z, 0.02);
    assert.equal(quad.Floats[Surface.ParticleVariable.SizeX], 1);
    assert.equal(quad.Floats[Surface.ParticleVariable.SizeY], 0.5);
    assert.equal(quad.Floats[Surface.ParticleVariable.Roll], 0);
    assert.deepEqual(quad.Color, Surface.DefaultTint);

    // A wall whose up is world +X has rolled a quarter turn relative to world up.
    Near(Surface.Roll(Surface.FixedBasis({ x: 0,
        y: -1,
        z: 0 }, { x: 1,
        y: 0,
        z: 0 })), -90);
    const facing = Surface.FacingBasis({ x: 0,
        y: 0,
        z: 0 }, { x: 0,
        y: 0,
        z: 5 })!;
    assert.deepEqual(facing.Normal, { x: 0,
        y: 0,
        z: 1 });
    assert.deepEqual(facing.Right, { x: 1,
        y: 0,
        z: 0 });
    assert.equal(Surface.FacingBasis({ x: 1,
        y: 1,
        z: 1 }, { x: 1,
        y: 1,
        z: 1 }), undefined);
    assert.throws(() => Surface.FixedBasis({ x: 1,
        y: 0,
        z: 0 }, { x: 2,
        y: 0,
        z: 0 }), TypeError);
});

test("overlapping sprites separate in paint order while disjoint sprites stay on their layers", () =>
{
    const bounds = { X: 0,
        Y: 0,
        Width: 16,
        Height: 16 };
    const placed = Surface.Flatten({ Kind: "viewport",
        Clip: { ...bounds,
            Width: 64 },
        Children: [
            Surface.Fill(bounds, "#FF0000", { Key: "background" }),
            Surface.Fill(bounds, "#00FF00", { Key: "nested" }),
            Surface.Fill(bounds, "#0000FF", { Layer: 0.5,
                Key: "front" }),
            Surface.Fill({ ...bounds,
                X: 32 }, undefined, { Key: "disjoint" }),
            Surface.Fill(bounds, undefined, { Layer: -2,
                Key: "behind" })
        ] });
    const basis = Surface.FixedBasis({ x: 0,
        y: 0,
        z: -1 }, { x: 0,
        y: 1,
        z: 0 });
    const quads = Surface.Project(placed, Wall, basis);
    assert.deepEqual(quads.map((quad) => quad.Location.x), [ 0, 0.01, 0.02, 0, -0.02 ]);
    assert.deepEqual(placed.map((sprite) => sprite.Key),
        [ "background", "nested", "front", "disjoint", "behind" ]);
    assert.deepEqual(quads[0]!.Floats, quads[1]!.Floats);
    assert.deepEqual(quads[0]!.Direction, basis.Normal);
    assert.equal(quads[0]!.Location.y, quads[1]!.Location.y);
    assert.equal(quads[0]!.Location.z, quads[1]!.Location.z);
    const custom = Surface.Project(placed, { ...Wall,
        LayerDepth: 0.025 }, basis);
    Near(custom[2]!.Location.x, 0.05);
    for (const spacing of [ 0, -0.01, NaN, Infinity ])
    {
        assert.throws(() => Surface.Project(placed, { ...Wall,
            LayerDepth: spacing }, basis), TypeError);
    }
});

test("layer separation follows clipped overlap and survives viewer-facing orientations", () =>
{
    const placed = Surface.Flatten({ Kind: "viewport",
        Clip: { X: 0,
            Y: 0,
            Width: 32,
            Height: 16 },
        Children: [
            Surface.Fill({ X: 0,
                Y: 0,
                Width: 16,
                Height: 16 }),
            Surface.Fill({ X: 16,
                Y: 0,
                Width: 32,
                Height: 16 }),
            Surface.Fill({ X: 0,
                Y: 0,
                Width: 32,
                Height: 16 }),
            Surface.Fill({ X: 64,
                Y: 0,
                Width: 16,
                Height: 16 })
        ] });
    assert.deepEqual(Surface.Depths(placed), [ 0, 0, 0.01 ]);
    for (const eye of [ { x: 0,
        y: 10,
        z: 4 }, { x: 5,
        y: 13,
        z: 4 }, { x: -20,
        y: 8,
        z: -10 } ])
    {
        const basis = Surface.FacingBasis(Wall.Position, eye)!;
        const quads = Surface.Project(placed, Wall, basis);
        const samePlane = Surface.Project([ placed[2]! ], Wall, basis)[0]!;
        const delta = { x: quads[2]!.Location.x - samePlane.Location.x,
            y: quads[2]!.Location.y - samePlane.Location.y,
            z: quads[2]!.Location.z - samePlane.Location.z };
        Near(delta.x, basis.Normal.x * 0.01);
        Near(delta.y, basis.Normal.y * 0.01);
        Near(delta.z, basis.Normal.z * 0.01);
    }
});

test("emission is private per viewer and skips invalid, foreign, distant and empty audiences", () =>
{
    const log: Array<Spawn> = [];
    const content = Surface.Fill({ X: 0,
        Y: 0,
        Width: 10,
        Height: 10 }, { red: 0.2,
        green: 0.4,
        blue: 0.6,
        alpha: 0.5 });
    const viewers = [ Viewer(log, "near", { x: 0,
        y: 10,
        z: 3 }), Viewer(log, "near", { x: 0,
        y: 10,
        z: 3 }),
    Viewer(log, "invalid", { x: 0,
        y: 10,
        z: 3 }, { Valid: false }),
    Viewer(log, "nether", { x: 0,
        y: 10,
        z: 3 }, { Dimension: "minecraft:nether" }),
    Viewer(log, "far", { x: 0,
        y: 10,
        z: 500 }) ];
    let created = 0;
    const report = Surface.Emit({ Viewers: viewers,
        Dimension: "minecraft:overworld",
        Pose: Wall,
        Content: content,
        CreateVariables: () =>
        {
            created++;
            return new FakeVariables();
        } });
    assert.deepEqual(report.Viewers, [ "near" ]);
    assert.deepEqual(report.Skipped.map((entry) => [ entry.Id, entry.Reason ]),
        [ [ "invalid", "invalid" ], [ "nether", "dimension" ], [ "far", "range" ] ]);
    assert.equal(log.length, 1);
    assert.equal(created, 1);
    const [ spawn ] = log;
    assert.equal(spawn.Particle, "bedform_canvas:rectangle_oriented");
    assert.deepEqual(spawn.Values[Surface.ParticleVariable.Color], { red: 0.2,
        green: 0.4,
        blue: 0.6,
        alpha: 0.5 });
    assert.deepEqual(spawn.Values[Surface.ParticleVariable.Direction], { x: 0,
        y: 0,
        z: 1 });
    assert.equal(spawn.Values[Surface.ParticleVariable.Width], 16);
    assert.equal(spawn.Values[Surface.ParticleVariable.SizeX], 0.5);

    const empty = Surface.Emit({ Viewers: [],
        Dimension: "minecraft:overworld",
        Pose: Wall,
        Content: content,
        CreateVariables: () => new FakeVariables() });
    assert.equal(empty.Spawned, 0);
    assert.equal(log.length, 1, "an empty audience renders nothing");
});

test("viewer-facing surfaces turn toward each viewer independently", () =>
{
    const log: Array<Spawn> = [];
    const pose: Surface.Pose = { Position: { x: 0,
        y: 0,
        z: 0 },
    Scale: 0.1,
    Orientation: "FaceViewer",
    Pivot: { X: 5,
        Y: 5 } };
    Surface.Emit({ Viewers: [ Viewer(log, "east", { x: 4,
        y: 0,
        z: 0 }), Viewer(log, "south", { x: 0,
        y: 0,
        z: 2 }) ],
    Dimension: "minecraft:overworld",
    Pose: pose,
    CreateVariables: () => new FakeVariables(),
    Content: Surface.Fill({ X: 0,
        Y: 0,
        Width: 10,
        Height: 10 }) });
    assert.deepEqual(log.map((spawn) => spawn.Viewer), [ "south", "east" ], "nearest viewers first");
    assert.deepEqual(log[0].Values[Surface.ParticleVariable.Direction], { x: 0,
        y: 0,
        z: 1 });
    assert.deepEqual(log[1].Values[Surface.ParticleVariable.Direction], { x: 1,
        y: 0,
        z: 0 });
});

test("work limits drop sprites in paint order and skip whole frames for excess viewers", () =>
{
    const log: Array<Spawn> = [];
    const content: Surface.Node = { Kind: "viewport",
        Clip: { X: 0,
            Y: 0,
            Width: 100,
            Height: 100 },
        Children: Array.from({ length: 5 }, (_, index) =>
            Surface.Fill({ X: index * 10,
                Y: 0,
                Width: 10,
                Height: 10 }, undefined, { Key: `s${index}` })) };
    const report = Surface.Emit({ Dimension: "minecraft:overworld",
        Pose: Wall,
        Content: content,
        CreateVariables: () => new FakeVariables(),
        Limits: { MaxSprites: 3,
            MaxSpawns: 7 },
        Viewers: [ Viewer(log, "a", { x: 0,
            y: 10,
            z: 2 }), Viewer(log, "b", { x: 0,
            y: 10,
            z: 3 }),
        Viewer(log, "c", { x: 0,
            y: 10,
            z: 4 }) ] });
    assert.equal(report.Dropped, 2);
    assert.deepEqual(report.Rendered.map((sprite) => sprite.Key), [ "s0", "s1", "s2" ]);
    assert.deepEqual(report.Viewers, [ "a", "b" ]);
    assert.deepEqual(report.Skipped, [ { Id: "c",
        Reason: "capacity" } ]);
    assert.equal(log.filter((spawn) => spawn.Viewer === "c").length, 0, "no partial frame for c");
    assert.throws(() => Surface.Emit({ Dimension: "x",
        Pose: Wall,
        Content: content,
        Viewers: [],
        CreateVariables: () => new FakeVariables(),
        Limits: { MaxSpawns: 0 } }), TypeError);
});

test("a failing viewer cannot interrupt other viewers", () =>
{
    const log: Array<Spawn> = [];
    const report = Surface.Emit({ Dimension: "minecraft:overworld",
        Pose: Wall,
        Content: Surface.Fill({ X: 0,
            Y: 0,
            Width: 1,
            Height: 1 }),
        CreateVariables: () => new FakeVariables(),
        Viewers: [ Viewer(log, "bad", { x: 0,
            y: 10,
            z: 1 }, { Fail: () => true }),
        Viewer(log, "good", { x: 0,
            y: 10,
            z: 2 }) ] });
    assert.deepEqual(report.Viewers, [ "good" ]);
    assert.deepEqual(report.Skipped, [ { Id: "bad",
        Reason: "failure" } ]);
    assert.match(report.Errors[0].message, /viewer bad/u);
});

test("managed surfaces refresh every tick, resize, report once, fail closed and dispose", () =>
{
    const log: Array<Spawn> = [];
    const intervals = new Map<number, () => void>();
    let serial = 0;
    const system: Surface.Scheduler = {
        runInterval(callback: () => void, interval?: number): number
        {
            assert.equal(interval, 1);
            intervals.set(++serial, callback);
            return serial;
        },
        clearRun(id: number): void
        {
            intervals.delete(id);
        }
    };
    const tick = (): void =>
    {
        for (const callback of [ ...intervals.values() ])
        {
            callback();
        }
    };

    const errors: Array<Error> = [];
    let failing = false;
    let audience: Array<Surface.Viewer> = [ Viewer(log, "a", { x: 0,
        y: 10,
        z: 2 }),
    Viewer(log, "b", { x: 0,
        y: 10,
        z: 3 }, { Fail: () => failing }) ];
    const surface = Surface.Create({ System: system,
        Audience: () => audience,
        Dimension: "minecraft:overworld",
        Pose: Wall,
        CreateVariables: () => new FakeVariables(),
        OnError: (error) => errors.push(error),
        Content: Surface.Fill({ X: 0,
            Y: 0,
            Width: 10,
            Height: 10 }, undefined, { Key: "panel" }) });
    assert.equal(log.length, 0, "creation performs no native emission");
    assert.deepEqual(surface.Rendered(), []);
    tick();
    tick();
    assert.equal(log.length, 4, "one spawn per viewer per tick");
    assert.deepEqual(surface.Rendered().map((sprite) => sprite.Key), [ "panel" ]);
    assert.ok(surface.VisibleTo("a") && surface.VisibleTo("b"));

    // Resize and reposition take effect on the next refresh; invalid updates keep the current frame.
    assert.throws(() => surface.Update({ Pose: { ...Wall,
        LayerDepth: 0 } }), TypeError);
    surface.Update({ Content: Surface.Fill({ X: 0,
        Y: 0,
        Width: 30,
        Height: 20 }, undefined, { Key: "wide" }) });
    assert.throws(() => surface.Update({ Content: Surface.Fill({ X: 0,
        Y: 0,
        Width: Number.NaN,
        Height: 1 }) }),
    TypeError);
    log.length = 0;
    tick();
    assert.deepEqual(log.map((spawn) => spawn.Values[Surface.ParticleVariable.SizeX]), [ 1.5, 1.5 ]);

    failing = true;
    tick();
    tick();
    assert.equal(errors.length, 1, "a persistent failure is reported once");
    assert.ok(surface.VisibleTo("a") && !surface.VisibleTo("b"));
    failing = false;
    tick();
    failing = true;
    tick();
    assert.equal(errors.length, 2, "a recurrence after recovery is reported again");
    failing = false;

    audience = new Proxy([], { get: () =>
    {
        throw new Error("audience failed");
    } });
    log.length = 0;
    tick();
    assert.equal(log.length, 0, "an unreadable audience renders nothing");
    assert.match(errors.at(-1)!.message, /audience/u);
    assert.ok(!surface.VisibleTo("a"));

    surface.Dispose();
    surface.Dispose();
    assert.equal(intervals.size, 0);
    tick();
    assert.equal(log.length, 0);
    assert.deepEqual(surface.Rendered(), []);
    assert.throws(() => surface.Update({}), /disposed/u);
});

test("importing surfaces is inert in a restricted host", async () =>
{
    const bundled = await build({ stdin: { contents: "import * as Surface from \"bedform/Canvas/Surface\"; " +
        "globalThis.api = Surface;",
    resolveDir: process.cwd() },
    bundle: true,
    format: "iife",
    platform: "neutral",
    write: false,
    external: [ "@minecraft/server" ] });
    const context: Record<string, unknown> = {};
    runInNewContext(bundled.outputFiles[0].text, context);
    const api = context.api as typeof Surface;
    assert.equal(api.Flatten(api.Fill({ X: 0,
        Y: 0,
        Width: 1,
        Height: 1 })).length, 1);
});
