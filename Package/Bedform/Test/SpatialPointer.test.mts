/**
 * Qualifies pointer targeting at arbitrary orientations, hit ordering, occlusion, distance limits,
 * hidden lines, dynamic colors, ScrollView clipping and hover tracks, admission hooks and line drawing.
 *
 * @module bedform/Test/SpatialPointer.test
 *
 * @file      SpatialPointer.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Geometry fixtures keep coordinates in reading order and infer callback types from public contracts. */

/* eslint-disable sort-keys, @typescript-eslint/typedef */

import * as C from "../Source/Spatial/Components.js";
import * as Layout from "../Source/Spatial/Layout.js";
import * as Pointer from "../Source/Spatial/Pointer.js";
import * as React from "../Source/Spatial/React/index.js";
import * as Renderer from "../Source/Spatial/Renderer.js";
import { Kind } from "../Source/Spatial/Internal/ComponentKind.js";
import type { Node } from "../Source/Spatial/Internal/Surface.js";
import { Scene } from "./SpatialRuntimeHarness.mjs";
import { Tint } from "../Source/Canvas/Surface.js";
import assert from "node:assert/strict";
import { test } from "node:test";

let Next = 0;
const World = "test:world";

/**
 * Creates a structural host node.
 *
 * @category Testing
 * @since 1.0.0
 */
function N(Type: string, Props: Record<string, unknown> = {}, Children: Array<Node> = []): Node
{
    return { Id: ++Next,
        Type,
        Props,
        Children,
        Hidden: false };
}

/**
 * Creates a Text node with one scalar child.
 *
 * @category Testing
 * @since 1.0.0
 */
function T(value: string, props: Record<string, unknown> = {}): Node
{
    return N(Kind.Text, props, [ { Id: ++Next,
        Type: "#text",
        Props: {},
        Children: [],
        Hidden: false,
        Text: value } ]);
}

/**
 * Creates a View at a position and rotation in the test dimension.
 *
 * @category Testing
 * @since 1.0.0
 */
function V(
    children: Array<Node>,
    props: Record<string, unknown> = {},
    position = { x: 0,
        y: 10,
        z: 0 },
    rotation = { x: 0,
        y: 0,
        z: 0,
        w: 1 }
): Node
{
    return N(Kind.View, { Dimension: World,
        Transform: { position,
            rotation },
        ...props }, children);
}

/**
 * Wraps a layout as a source presented to the given players.
 *
 * @category Testing
 * @since 1.0.0
 */
function S(layout: Layout.Result, audience: Array<string> = [ "p" ]): Pointer.Source
{
    return { Layout: layout,
        Audience: audience };
}

/**
 * Builds a ray that reaches a View's local point from its visible side.
 *
 * @category Testing
 * @since 1.0.0
 */
function Aim(
    view: Layout.View,
    point: Layout.Point,
    distance = 4,
    lateral = { x: 0,
        y: 0,
        z: 0 }
): Pointer.Ray
{
    const target = Layout.Project(view, point);
    const base = Layout.Project(view, { X: 0,
        Y: 0 });
    const tip = Layout.Project(view, { X: 0,
        Y: 0 }, 1);
    const origin = {
        x: target.x + (tip.x - base.x) * distance + lateral.x,
        y: target.y + (tip.y - base.y) * distance + lateral.y,
        z: target.z + (tip.z - base.z) * distance + lateral.z
    };
    return { Origin: origin,
        Direction: { x: target.x - origin.x,
            y: target.y - origin.y,
            z: target.z - origin.z } };
}

/**
 * Normalized quaternion for a rotation about an axis.
 *
 * @category Testing
 * @since 1.0.0
 */
function Q(axis: { x: number;
    y: number;
    z: number; }, degrees: number)
{
    const length = Math.hypot(axis.x, axis.y, axis.z);
    const half = (degrees * Math.PI) / 360;
    const s = Math.sin(half) / length;
    return { x: axis.x * s,
        y: axis.y * s,
        z: axis.z * s,
        w: Math.cos(half) };
}

/**
 * A recording player fake with a fixed view ray.
 *
 * @category Testing
 * @since 1.0.0
 */
class Player implements Pointer.Player
{
    isValid = true;
    dimension: Pointer.Dimension = { id: World };
    readonly Spawns: Array<{ Name: string;
        Location: { x: number;
            y: number;
            z: number; };
        Values: Record<string, unknown>; }> = [];
    constructor(readonly id: string, public Ray: Pointer.Ray)
    {
    }

    getHeadLocation()
    {
        return this.Ray.Origin;
    }

    getViewDirection()
    {
        return this.Ray.Direction;
    }

    spawnParticle(name: string, location: { x: number;
        y: number;
        z: number; }, variables?: unknown)
    {
        this.Spawns.push({ Name: name,
            Location: location,
            Values: { ...(variables as { Values: Record<string, unknown> }).Values } });
    }
}

/**
 * Starts a manually stepped tracker that records drawn lines and errors.
 *
 * @category Testing
 * @since 1.0.0
 */
function Track(
    sources: () => Iterable<Pointer.Source>,
    players: Array<Player>,
    options: Partial<Pointer.Configuration> = {}
)
{
    const lines: Array<Pointer.Line> = [];
    const errors: Array<Error> = [];
    const cleared: Array<number> = [];
    const tracker = Pointer.Start({
        World: { getAllPlayers: () => players },
        System: { runInterval: () => 7,
            clearRun: (id) => cleared.push(id) },
        Sources: sources,
        Draw: (line) => lines.push(line),
        Occlusion: false,
        OnError: (error) => errors.push(error),
        ...options
    });
    return { Tracker: tracker,
        Lines: lines,
        Errors: errors,
        Cleared: cleared };
}

/**
 * Locates one committed item by source node.
 *
 * @category Testing
 * @since 1.0.0
 */
function Item(layout: Layout.Result, node: Node): Layout.Item
{
    return layout.Items.find((entry) => entry.Id === node.Id)!;
}

/**
 * Asserts two numbers agree within a small tolerance.
 *
 * @category Testing
 * @since 1.0.0
 */
function Near(actual: number, expected: number, epsilon = 1e-6): void
{
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not near ${expected}`);
}

test("rays hit the intended local point and surface at arbitrary View orientations", () =>
{
    for (const rotation of [
        Q({ x: 0,
            y: 1,
            z: 0 }, 0),
        Q({ x: 0,
            y: 1,
            z: 0 }, 90),
        Q({ x: 1,
            y: 0,
            z: 0 }, -60),
        Q({ x: 0,
            y: 0,
            z: 1 }, 135),
        Q({ x: 1,
            y: 2,
            z: 3 }, 217)
    ])
    {
        const left = N(Kind.Panel, { Width: 32,
            Height: 32,
            BackgroundColor: "#202020" });
        const right = N(Kind.Panel, { Width: 32,
            Height: 32,
            BackgroundColor: "#404040" });
        const layout = Layout.Compute([
            V([ N(Kind.Row, {}, [ left, right ]) ], {}, { x: 3,
                y: 70,
                z: -9 }, rotation)
        ]);
        const view = layout.Views[0]!;
        const hit = Pointer.Cast([ S(layout) ], Aim(view, { X: 10,
            Y: 12 }), { Dimension: World })!;
        assert.equal(hit.Item.Id, left.Id);
        Near(hit.Point.X, 10);
        Near(hit.Point.Y, 12);
        Near(hit.Distance, 4);
        const oblique = Pointer.Cast([ S(layout) ], Aim(view, { X: 50,
            Y: 5 }, 3, { x: 0.7,
            y: -0.4,
            z: 0.2 }), { Dimension: World })!;
        assert.equal(oblique.Item.Id, right.Id);
        Near(oblique.Point.X, 50);
        Near(oblique.Point.Y, 5);
        assert.equal(oblique.Control, undefined);
        const behind = Aim(view, { X: 10,
            Y: 12 }, -4);
        assert.equal(Pointer.Cast([ S(layout) ], behind, { Dimension: World }), undefined);
        assert.equal(Pointer.Cast([ S(layout) ], behind, { Dimension: World,
            DoubleSided: true })?.Item.Id, left.Id);
        assert.equal(Pointer.Cast([ S(layout) ], Aim(view, { X: 10,
            Y: 12 }), { Dimension: "test:other" }), undefined);
    }

    const layout = Layout.Compute([ V([ N(Kind.Panel, { Width: 16,
        Height: 16 }) ]) ]);
    assert.equal(Pointer.Intersect(layout.Views[0]!, { Origin: { x: 0,
        y: 9.5,
        z: 1 },
    Direction: { x: 1,
        y: 0,
        z: 0 } }), undefined, "parallel ray");
    assert.equal(Pointer.Intersect(layout.Views[0]!, { Origin: { x: 0,
        y: 9.5,
        z: 1 },
    Direction: { x: 0,
        y: 0,
        z: 0 } }), undefined, "degenerate ray");
});

test("the nearest painted surface wins across views, and empty containers let rays pass through", () =>
{
    const far = N(Kind.Panel, { Width: 32,
        Height: 32,
        BackgroundColor: "#111111" });
    const near = N(Kind.Panel, { Width: 32,
        Height: 32,
        BackgroundColor: "#222222" });
    const empty = N(Kind.Row, { Width: 32,
        Height: 32 });
    const farLayout = Layout.Compute([ V([ far ]) ]);
    const nearLayout = Layout.Compute([ V([ near ], {}, { x: 0,
        y: 10,
        z: 2 }) ]);
    const emptyLayout = Layout.Compute([ V([ empty ], {}, { x: 0,
        y: 10,
        z: 4 }) ]);
    const ray = { Origin: { x: 0.5,
        y: 9.5,
        z: 10 },
    Direction: { x: 0,
        y: 0,
        z: -1 } };
    for (const order of [
        [ S(farLayout), S(nearLayout), S(emptyLayout) ],
        [ S(emptyLayout), S(nearLayout), S(farLayout) ]
    ])
    {
        const hit = Pointer.Cast(order, ray, { Dimension: World })!;
        assert.equal(hit.Item.Id, near.Id);
        Near(hit.Distance, 8);
    }

    const twin = Layout.Compute([ V([ N(Kind.Panel, { Width: 32,
        Height: 32,
        BackgroundColor: "#333333" }) ]) ]);
    const first = S(farLayout);
    assert.equal(Pointer.Cast([ first, S(twin) ], ray, { Dimension: World })!.Source, first);
    assert.equal(Pointer.Cast([ S(farLayout) ], ray, { Dimension: World,
        Range: 5 }), undefined);
});

test("within a view, layers and paint order decide the hit and noninteractive overlays block controls", () =>
{
    const label = T("Go");
    const button = N(Kind.Button, { Width: 40,
        Height: 20,
        BackgroundColor: "#555555" }, [ label ]);
    const cover = N(Kind.Panel, { Position: "absolute",
        Width: 40,
        Height: 10,
        Layer: 1,
        BackgroundColor: "#000000" });
    const hidden = N(Kind.Panel, { Position: "absolute",
        Width: 40,
        Height: 20,
        Y: 0,
        Layer: 2,
        Visible: false,
        BackgroundColor: "#000000" });
    const layout = Layout.Compute([ V([ button, cover, hidden ], { Width: 40,
        Height: 20 }) ]);
    const view = layout.Views[0]!;
    const covered = Pointer.Cast([ S(layout) ], Aim(view, { X: 2,
        Y: 4 }), { Dimension: World })!;
    assert.equal(covered.Item.Id, cover.Id);
    assert.equal(covered.Control, undefined);
    const open = Pointer.Cast([ S(layout) ], Aim(view, { X: 2,
        Y: 15 }), { Dimension: World })!;
    assert.equal(open.Control?.Id, button.Id);
    assert.ok([ label.Id, button.Id ].includes(open.Item.Id));
    const regions = Pointer.Regions(layout, view.Id, { X: 2,
        Y: 4 });
    assert.deepEqual(
        regions.map((region) => region.Item.Id).slice(0, 2),
        [ cover.Id, Item(layout, label).Id ]
    );
    assert.ok(!regions.some((region) => region.Item.Id === hidden.Id));
    assert.ok(
        !regions.some((region) => region.Item.Type === Kind.View),
        "an unpainted View is not a surface"
    );
});

test("world occlusion hides surfaces behind blocks, admits flush surfaces and fails closed", () =>
{
    const panel = N(Kind.Panel, { Width: 32,
        Height: 32,
        BackgroundColor: "#111111" });
    const layout = Layout.Compute([ V([ panel ]) ]);
    const ray = Aim(layout.Views[0]!, { X: 8,
        Y: 8 }, 10);
    assert.equal(Pointer.Cast([ S(layout) ], ray, { Dimension: World,
        Obstruction: 5 }), undefined);
    assert.equal(Pointer.Cast([ S(layout) ], ray, { Dimension: World,
        Obstruction: 9.995 })?.Item.Id, panel.Id);
    assert.equal(Pointer.Cast([ S(layout) ], ray, { Dimension: World,
        Obstruction: 12 })?.Item.Id, panel.Id);

    const player = new Player("p", ray);
    let block: Pointer.BlockHit | undefined = { block: { location: { x: 0,
        y: 9,
        z: 4 } },
    faceLocation: { x: 0.5,
        y: 0.5,
        z: 1 } };
    const queries: Array<unknown> = [];
    player.dimension = { id: World,
        getBlockFromRay: (origin, direction, options) =>
        {
            queries.push(options);
            return block;
        } };
    const occluded = Track(() => [ S(layout) ], [ player ], { Occlusion: undefined });
    occluded.Tracker.Update();
    assert.equal(occluded.Tracker.Get("p"), undefined);
    assert.deepEqual(queries[0], { includeLiquidBlocks: false,
        includePassableBlocks: false,
        maxDistance: 64 });
    block = undefined;
    occluded.Tracker.Update();
    assert.equal(occluded.Tracker.Get("p")?.Hit.Item.Id, panel.Id);

    player.dimension = { id: World,
        getBlockFromRay: () =>
        {
            throw new Error("unloaded");
        } };
    occluded.Tracker.Update();
    occluded.Tracker.Update();
    assert.equal(occluded.Tracker.Get("p"), undefined);
    assert.equal(occluded.Errors.length, 1, "a persistent failure is reported once");

    const disabled = Track(() => [ S(layout) ], [ player ], { Occlusion: false });
    disabled.Tracker.Update();
    assert.equal(disabled.Tracker.Get("p")?.Hit.Item.Id, panel.Id);
    const custom = Track(() => [ S(layout) ], [ player ], { Occlusion: () => 3 });
    custom.Tracker.Update();
    assert.equal(custom.Tracker.Get("p"), undefined);
});

test("maximum distance hides the line and rejects interaction beyond it", () =>
{
    const button = N(Kind.Button, { Width: 32,
        Height: 16,
        Pointer: { MaxDistance: 5 } }, [ T("Far") ]);
    const layout = Layout.Compute([ V([ button ]) ]);
    const player = new Player("p", Aim(layout.Views[0]!, { X: 4,
        Y: 4 }, 8));
    const run = Track(() => [ S(layout) ], [ player ]);
    run.Tracker.Update();
    let state = run.Tracker.Get("p")!;
    assert.equal(state.Denial, "distance");
    assert.equal(state.Eligible, false);
    assert.equal(state.Line, undefined);
    assert.equal(run.Lines.length, 0);
    player.Ray = Aim(layout.Views[0]!, { X: 4,
        Y: 4 }, 3);
    run.Tracker.Update();
    state = run.Tracker.Get("p")!;
    assert.equal(state.Denial, undefined);
    assert.equal(state.Eligible, true);
    assert.ok(state.Line);
    assert.equal(run.Lines.length, 1);
    const limited = Track(() => [ S(layout) ], [ new Player("p", Aim(layout.Views[0]!, { X: 4,
        Y: 4 }, 30)) ], { Range: 20 });
    limited.Tracker.Update();
    assert.equal(limited.Tracker.Get("p"), undefined, "nothing is targeted beyond the tracker range");
});

test("hidden lines keep targeting, eligibility and admission counting", () =>
{
    const button = N(Kind.Button, { Width: 32,
        Height: 16 }, [ T("Quiet") ]);
    const layout = Layout.Compute([ V([ button ], { Pointer: { Visible: false } }) ]);
    const candidates: Array<ReadonlyArray<Pointer.Candidate>> = [];
    const run = Track(() => [ S(layout, [ "p", "q" ]) ], [
        new Player("p", Aim(layout.Views[0]!, { X: 4,
            Y: 4 })),
        new Player("q", Aim(layout.Views[0]!, { X: 8,
            Y: 4 }))
    ], { Admit: (entries) =>
    {
        candidates.push(entries);
        return [ "q" ];
    } });
    run.Tracker.Update();
    assert.equal(run.Lines.length, 0);
    assert.deepEqual(candidates[0]!.map((entry) => entry.ViewerId), [ "p", "q" ]);
    assert.equal(run.Tracker.Get("p")!.Eligible, true);
    assert.equal(run.Tracker.Get("p")!.Line, undefined);
    assert.equal(run.Tracker.Get("q")!.Denial, "access");
    assert.equal(run.Tracker.Get("q")!.Eligible, false);
});

test("default colors follow surface, eligibility and observed Use; reactive callbacks override them", () =>
{
    const panel = N(Kind.Panel, { Width: 16,
        Height: 16,
        BackgroundColor: "#111111" });
    const plain = N(Kind.Button, { Width: 32,
        Height: 16 }, [ T("A") ]);
    const restricted = N(Kind.Button, { Width: 32,
        Height: 16,
        RequiredItem: "test:key" }, [ T("B") ]);
    const layout = Layout.Compute([ V([ panel, plain, restricted ]) ]);
    const view = layout.Views[0]!;
    const player = new Player("p", Aim(view, { X: 4,
        Y: 4 }));
    const run = Track(() => [ S(layout) ], [ player ]);
    const color = (): Pointer.Line["Color"] => run.Tracker.Get("p")!.Line!.Color;
    run.Tracker.Update();
    assert.deepEqual(color(), Tint(Pointer.DefaultColors.Surface));
    player.Ray = Aim(view, { X: 4,
        Y: 20 });
    run.Tracker.Update();
    assert.deepEqual(color(), Tint(Pointer.DefaultColors.Interactive));
    run.Tracker.Press("p");
    for (let index = 0; index < Pointer.Defaults.PressTicks; index++)
    {
        run.Tracker.Update();
        assert.equal(run.Tracker.Get("p")!.Input.Use, true);
        assert.deepEqual(color(), Tint(Pointer.DefaultColors.Use));
    }

    run.Tracker.Update();
    assert.deepEqual(color(), Tint(Pointer.DefaultColors.Interactive));
    player.Ray = Aim(view, { X: 4,
        Y: 36 });
    run.Tracker.Press("p");
    run.Tracker.Update();
    assert.equal(run.Tracker.Get("p")!.Denial, "item");
    assert.deepEqual(color(), Tint(Pointer.DefaultColors.Surface), "a denied press stays white");
    assert.ok(Object.isFrozen(Pointer.DefaultColors));

    const contexts: Array<Pointer.ColorContext> = [];
    const themed = (tint: string): Layout.Result => Layout.Compute([
        V([ N(Kind.Button, { Width: 32,
            Height: 16,
            RequiredItem: "test:key",
            Pointer: { Color: (context: Pointer.ColorContext) =>
            {
                contexts.push(context);
                return context.Denial === "item" ? tint : undefined;
            } } }, [ T("C") ]) ])
    ]);
    let current = themed("#FF0000");
    const held: { Item?: string } = {};
    const reactive = Track(() => [ S(current) ], [ new Player("p", Aim(current.Views[0]!, { X: 4,
        Y: 4 })) ], { HeldItem: () => held.Item });
    reactive.Tracker.Update();
    assert.deepEqual(reactive.Tracker.Get("p")!.Line!.Color, Tint("#FF0000"));
    assert.equal(contexts[0]!.Denial, "item");
    assert.equal(contexts[0]!.Target.Type, Kind.Button);
    assert.equal(contexts[0]!.Target.Interactive, true);
    assert.equal(contexts[0]!.Input.HeldItem, undefined);
    assert.equal(contexts[0]!.Default, Pointer.DefaultColors.Surface);
    assert.ok(Object.isFrozen(contexts[0]));
    current = themed("#00FF00");
    reactive.Tracker.Update();
    assert.deepEqual(reactive.Tracker.Get("p")!.Line!.Color, Tint("#00FF00"));
    held.Item = "test:key";
    reactive.Tracker.Update();
    assert.equal(contexts.at(-1)!.Input.HeldItem, "test:key");
    assert.equal(contexts.at(-1)!.Eligible, true);
    assert.deepEqual(reactive.Tracker.Get("p")!.Line!.Color, Tint(Pointer.DefaultColors.Interactive));

    current = Layout.Compute([ V([ N(Kind.Button, { Width: 32,
        Height: 16,
        Pointer: { Color: () =>
        {
            throw new Error("broken");
        } } }, [ T("D") ]) ]) ]);
    reactive.Tracker.Update();
    reactive.Tracker.Update();
    assert.deepEqual(reactive.Tracker.Get("p")!.Line!.Color, Tint(Pointer.DefaultColors.Interactive));
    assert.equal(reactive.Errors.length, 1);
});

test("the line runs from the estimated hand, or an override, to the hit, and hides with no surface", () =>
{
    const panel = N(Kind.Panel, { Width: 16,
        Height: 16,
        BackgroundColor: "#111111" });
    const layout = Layout.Compute([ V([ panel ]) ]);
    const ray = Aim(layout.Views[0]!, { X: 8,
        Y: 8 });
    const run = Track(() => [ S(layout) ], [ new Player("p", ray) ]);
    run.Tracker.Update();
    const line = run.Tracker.Get("p")!.Line!;
    assert.deepEqual(line.From, Pointer.EstimateHand(ray));
    assert.deepEqual(line.To, run.Tracker.Get("p")!.Hit.Position);
    assert.equal(line.Thickness, Pointer.Defaults.Thickness);

    const hand = { x: 1,
        y: 2,
        z: 3 };
    const viewed: Array<string> = [];
    const overridden = Track(() => [ S(layout) ], [ new Player("p", { Origin: { x: 50,
        y: 50,
        z: 50 },
    Direction: { x: 1,
        y: 0,
        z: 0 } }) ], { Hand: () => hand,
        View: (player) =>
        {
            viewed.push(player.id);
            return ray;
        } });
    overridden.Tracker.Update();
    assert.deepEqual(viewed, [ "p" ]);
    assert.deepEqual(overridden.Tracker.Get("p")!.Line!.From, hand);
    const away = Track(() => [ S(layout) ], [ new Player("p", { Origin: ray.Origin,
        Direction: { x: 0,
            y: 1,
            z: 0 } }) ]);
    away.Tracker.Update();
    assert.equal(away.Tracker.Get("p"), undefined);
    assert.equal(away.Lines.length, 0);

    const north = Pointer.EstimateHand({ Origin: { x: 0,
        y: 0,
        z: 0 },
    Direction: { x: 0,
        y: 0,
        z: -2 } });
    Near(north.x, Pointer.Defaults.HandRight);
    Near(north.y, -Pointer.Defaults.HandDown);
    Near(north.z, -Pointer.Defaults.HandForward);
});

test("default drawing emits one private Canvas rectangle laid along the line and facing the eye", () =>
{
    const panel = N(Kind.Panel, { Width: 16,
        Height: 16,
        BackgroundColor: "#111111" });
    const layout = Layout.Compute([ V([ panel ]) ]);
    const viewer = new Player("p", Aim(layout.Views[0]!, { X: 8,
        Y: 8 }));
    const other = new Player("q", Aim(layout.Views[0]!, { X: 8,
        Y: 8 }));
    const lines: Array<Pointer.Line> = [];
    const tracker = Pointer.Start({
        World: { getAllPlayers: () => [ viewer, other ] },
        System: { runInterval: () => 1,
            clearRun: () => undefined },
        Sources: () => [ S(layout) ],
        Occlusion: false,
        CreateVariables: () =>
        {
            const Values: Record<string, unknown> = {};
            return { Values,
                setFloat: (name: string, value: number) =>
                {
                    Values[name] = value;
                },
                setColorRGBA: (name: string, value: unknown) =>
                {
                    Values[name] = value;
                },
                setVector3: (name: string, value: unknown) =>
                {
                    Values[name] = value;
                } };
        }
    });
    tracker.Subscribe((states) =>
    {
        for (const state of states.values())
        {
            lines.push(state.Line!);
        }
    });
    tracker.Update();
    assert.equal(viewer.Spawns.length, 1);
    assert.equal(other.Spawns.length, 0, "the other player is not in the audience");
    const spawn = viewer.Spawns[0]!;
    const line = lines[0]!;
    assert.equal(spawn.Name, "bedform_canvas:rectangle_oriented");
    const length = Math.hypot(line.To.x - line.From.x, line.To.y - line.From.y, line.To.z - line.From.z);
    Near(spawn.Values["variable.surface_size_x"] as number, length / 2);
    Near(spawn.Values["variable.surface_size_y"] as number, Pointer.Defaults.Thickness / 2);
    Near(spawn.Location.x, (line.From.x + line.To.x) / 2);
    Near(spawn.Location.y, (line.From.y + line.To.y) / 2);
    Near(spawn.Location.z, (line.From.z + line.To.z) / 2);
    assert.deepEqual(spawn.Values["variable.color"], Tint(Pointer.DefaultColors.Surface));
    const segment = Pointer.SegmentOf(line)!;
    const right = segment.Pose.Orientation as { Right: Pointer.Ray["Origin"];
        Up: Pointer.Ray["Origin"] };
    const facing = spawn.Values["variable.surface_direction"] as Pointer.Ray["Origin"];
    const toEye = { x: line.Eye.x - spawn.Location.x,
        y: line.Eye.y - spawn.Location.y,
        z: line.Eye.z - spawn.Location.z };
    assert.ok(facing.x * toEye.x + facing.y * toEye.y + facing.z * toEye.z > 0);
    Near(right.Right.x * facing.x + right.Right.y * facing.y + right.Right.z * facing.z, 0);
    assert.equal(Pointer.SegmentOf({ ...line,
        To: line.From }), undefined);
    tracker.Dispose();
    assert.throws(() => tracker.Press("p"), /disposed/u);
    assert.equal(tracker.Get("p"), undefined);
    assert.throws(() => Pointer.Start({ World: { getAllPlayers: () => [] },
        System: { runInterval: () => 1,
            clearRun: () => undefined },
        Sources: () => [] }), TypeError);
});

test("eligibility applies required items, stateless access policies, audiences and dimensions", () =>
{
    const scope = N(Kind.InputScope, { RequiredItem: "test:wand",
        Access: { LockedTo: "p" } }, [
        N(Kind.Button, { Width: 32,
            Height: 16,
            Access: { Allows: (id: string) => id !== "r" } }, [ T("Lock") ])
    ]);
    const layout = Layout.Compute([ V([ scope ]) ]);
    const ray = Aim(layout.Views[0]!, { X: 4,
        Y: 4 });
    const players = [ "p", "q", "r", "s" ].map((id) => new Player(id, ray));
    players[3]!.dimension = { id: "test:other" };
    const run = Track(() => [ S(layout, [ "p", "q", "r", "s" ]), S(layout, []) ], players, {
        HeldItem: (player) => (player.id === "q" ? undefined : "test:wand")
    });
    run.Tracker.Update();
    assert.equal(run.Tracker.Get("p")!.Eligible, true);
    assert.equal(run.Tracker.Get("q")!.Denial, "item");
    run.Tracker.Update();
    const locked = Track(() => [ S(layout, [ "r" ]) ], [ players[2]! ], { HeldItem: () => "test:wand" });
    locked.Tracker.Update();
    assert.equal(locked.Tracker.Get("r")!.Denial, "access");
    assert.equal(run.Tracker.Get("s"), undefined, "other dimensions are never targeted");
    const outsider = Track(() => [ S(layout, [ "p" ]) ], [ new Player("x", ray) ]);
    outsider.Tracker.Update();
    assert.equal(outsider.Tracker.Get("x"), undefined, "players outside the audience cannot aim");

    const disabled = Layout.Compute([ V([ N(Kind.Button, { Width: 32,
        Height: 16,
        Disabled: true }, [ T("Off") ]), N(Kind.Button, { Width: 32,
        Height: 16,
        Pointer: { Enabled: false } }, [ T("Off") ]) ]) ]);
    for (const y of [ 4, 20 ])
    {
        const off = Track(() => [ S(disabled) ], [ new Player("p", Aim(disabled.Views[0]!, { X: 4,
            Y: y })) ]);
        off.Tracker.Update();
        assert.equal(off.Tracker.Get("p")!.Denial, "disabled");
        assert.deepEqual(off.Tracker.Get("p")!.Line!.Color, Tint(Pointer.DefaultColors.Surface));
    }

    const failing = Track(() => [ S(layout) ], [ new Player("p", ray) ], {
        HeldItem: () => "test:wand",
        Admit: () =>
        {
            throw new Error("admission");
        }
    });
    failing.Tracker.Update();
    assert.equal(failing.Tracker.Get("p")!.Denial, "access", "admission failures fail closed");
    assert.equal(failing.Errors.length, 1);
});

test("ScrollView viewports exclude clipped children and follow reflowed offsets", () =>
{
    const rows = [ 0, 1, 2 ].map((index) => N(Kind.Button, { Width: 40,
        Height: 30 }, [ T(`Row ${index}`) ]));
    const layoutAt = (offset: number): Layout.Result => Layout.Compute([
        V([ N(Kind.Panel, { Width: 60,
            Height: 60,
            BackgroundColor: "#101010" }, [
            N(Kind.ScrollView, { Width: 50,
                Height: 40,
                ScrollY: offset,
                scrollbarVisibility: "hidden" }, rows)
        ]) ])
    ]);
    const first = layoutAt(0);
    const view = first.Views[0]!;
    const hit = (layout: Layout.Result, y: number) => Pointer.Cast([ S(layout) ], Aim(view, { X: 10,
        Y: y }), { Dimension: World });
    assert.equal(hit(first, 10)!.Control!.Id, rows[0]!.Id);
    assert.equal(hit(first, 35)!.Control!.Id, rows[1]!.Id);
    const clipped = hit(first, 45)!;
    assert.equal(clipped.Control, undefined, "a clipped row cannot intercept the pointer");
    assert.equal(clipped.Item.Type, Kind.Panel);
    const scrolled = layoutAt(30);
    assert.equal(hit(scrolled, 10)!.Control!.Id, rows[1]!.Id);
    assert.equal(hit(scrolled, 35)!.Control!.Id, rows[2]!.Id);
    assert.equal(Item(scrolled, rows[0]!).Bounds.Y, -30);
    assert.equal(hit(scrolled, 45)!.Control, undefined);
});

test("hover tracks are targetable before they are drawn and show per eligible pointer", () =>
{
    const make = (visibility: string, orientation = "vertical", rows = 3): Layout.Result => Layout.Compute([
        V([ N(Kind.ScrollView, { Width: 50,
            Height: 40,
            Orientation: orientation,
            scrollbarVisibility: visibility,
            Direction: orientation === "horizontal" ? "row" : "column" },
        Array.from({ length: rows }, (_, index) => N(Kind.Button, { Width: 50,
            Height: 30 }, [ T(`Item ${index}`) ]))) ])
    ]);
    const hover = make("hover");
    const scroll = hover.Items.find((item) => item.Type === Kind.ScrollView)!;
    assert.deepEqual(scroll.Track, { X: 44,
        Y: 0,
        Width: Layout.ScrollbarThickness,
        Height: 40 });
    const view = hover.Views[0]!;
    const source = S(hover, [ "p", "q" ]);
    const p = new Player("p", Aim(view, { X: 46,
        Y: 10 }));
    const q = new Player("q", Aim(view, { X: 10,
        Y: 10 }));
    const run = Track(() => [ source ], [ p, q ]);
    run.Tracker.Update();
    const state = run.Tracker.Get("p")!;
    assert.equal(state.Hit.Part, "track");
    assert.equal(state.Target.Part, "track");
    assert.equal(state.Hit.Control!.Id, scroll.Id);
    assert.equal(state.Eligible, true);
    assert.equal(run.Tracker.Get("q")!.Hit.Part, "content");
    assert.equal(run.Tracker.ScrollbarVisible("p", source, scroll), true);
    assert.equal(run.Tracker.ScrollbarVisible("q", source, scroll), false);
    const release = run.Tracker.Retain("p", source, scroll.Id);
    p.Ray = Aim(view, { X: 10,
        Y: 30 });
    run.Tracker.Update();
    assert.equal(run.Tracker.ScrollbarVisible("p", source, scroll), true, "an active gesture keeps it shown");
    release();
    release();
    assert.equal(run.Tracker.ScrollbarVisible("p", source, scroll), false);
    p.Ray = Aim(view, { X: 46,
        Y: 10 });
    run.Tracker.Update();
    assert.equal(run.Tracker.ScrollbarVisible("p", source, scroll), true);

    const always = make("always");
    const shown = always.Items.find((item) => item.Type === Kind.ScrollView)!;
    assert.equal(run.Tracker.ScrollbarVisible("q", S(always), shown), true);
    const hidden = make("hidden");
    const none = hidden.Items.find((item) => item.Type === Kind.ScrollView)!;
    assert.equal(none.Track, undefined);
    const beneath = Pointer.Cast([ S(hidden) ], Aim(hidden.Views[0]!, { X: 46,
        Y: 10 }), { Dimension: World })!;
    assert.equal(beneath.Part, "content");
    assert.equal(beneath.Control!.Type, Kind.Button, "without a track, content under it is targeted");
    assert.equal(run.Tracker.ScrollbarVisible("p", S(hidden), none), false);
    const fits = make("always", "vertical", 1).Items.find((item) => item.Type === Kind.ScrollView)!;
    assert.equal(fits.Track, undefined, "no overflow, no track");
    const across = make("hover", "horizontal").Items.find((item) => item.Type === Kind.ScrollView)!;
    assert.deepEqual(across.Track, { X: 0,
        Y: 40 - Layout.ScrollbarThickness,
        Width: 50,
        Height: Layout.ScrollbarThickness });

    const locked = Layout.Compute([ V([ N(Kind.ScrollView, { Width: 50,
        Height: 40,
        scrollbarVisibility: "hover",
        RequiredItem: "test:key" }, [ N(Kind.Panel, { Width: 40,
        Height: 90 }) ]) ]) ]);
    const lockedScroll = locked.Items.find((item) => item.Type === Kind.ScrollView)!;
    const lockedSource = S(locked);
    const denied = Track(() => [ lockedSource ], [ new Player("p", Aim(locked.Views[0]!, { X: 46,
        Y: 10 })) ]);
    denied.Tracker.Update();
    assert.equal(denied.Tracker.Get("p")!.Denial, "item");
    assert.equal(denied.Tracker.ScrollbarVisible("p", lockedSource, lockedScroll), false);
});

test("nested ScrollView tracks are clipped by their ancestors' viewports", () =>
{
    const inner = N(Kind.ScrollView, { Width: 50,
        Height: 80,
        scrollbarVisibility: "always" }, [ N(Kind.Panel, { Width: 40,
        Height: 200,
        BackgroundColor: "#202020" }) ]);
    const outer = N(Kind.ScrollView, { Width: 60,
        Height: 40,
        scrollbarVisibility: "hidden" }, [ inner ]);
    const layout = Layout.Compute([ V([ outer ]) ]);
    const view = layout.Views[0]!;
    assert.equal(Pointer.Cast([ S(layout) ], Aim(view, { X: 46,
        Y: 20 }), { Dimension: World })!.Part, "track");
    assert.equal(Pointer.Cast([ S(layout) ], Aim(view, { X: 46,
        Y: 60 }), { Dimension: World }), undefined, "outside the outer viewport");
});

test("renderer roots expose their audience and act as pointer sources", async () =>
{
    const scene = new Scene();
    const viewer = { id: "p",
        isValid: true };
    scene.Players = [ viewer ];
    const runtime = scene.Start(Renderer, { Surface: { ...scene.Factory,
        CustomHost: false } });
    try
    {
        const root = Renderer.CreateRoot(runtime, { Player: viewer });
        assert.deepEqual(root.Audience, []);
        root.Render(React.createElement(
            C.View,
            { Dimension: World,
                Transform: { position: { x: 0,
                    y: 10,
                    z: 0 },
                rotation: { x: 0,
                    y: 0,
                    z: 0,
                    w: 1 } } },
            React.createElement(C.Button, null, React.createElement(C.Text, null, "Press"))
        ));
        await scene.System.Until(() => !!root.Layout && root.Audience.length > 0);
        assert.deepEqual(root.Audience, [ "p" ]);
        assert.ok(Object.isFrozen(root.Audience));
        const layout = root.Layout!;
        const player = new Player("p", Aim(layout.Views[0]!, { X: 4,
            Y: 4 }));
        const run = Track(() => [ root ], [ player ]);
        run.Tracker.Update();
        assert.equal(run.Tracker.Get("p")!.Target.Type, Kind.Button);
        assert.equal(run.Tracker.Get("p")!.Eligible, true);
        await root.Unmount();
        assert.deepEqual(root.Audience, []);
        run.Tracker.Update();
        assert.equal(run.Tracker.Get("p"), undefined);
        run.Tracker.Dispose();
        assert.deepEqual(run.Cleared, [ 7 ]);
    }
    finally
    {
        await runtime.Dispose();
    }
});
