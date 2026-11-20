/**
 * Qualifies text encoding, native anchors, clipping, private ownership and static placement resends.
 *
 * @module bedform/Test/SpatialText.test
 *
 * @file      SpatialText.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Recording fixtures retain observable operation order and infer callbacks. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */

import * as C from "../Source/Spatial/Components.js";
import * as Layout from "../Source/Spatial/Layout.js";
import * as React from "../Source/Spatial/React/index.js";
import * as Renderer from "../Source/Spatial/Renderer.js";
import * as Text from "../Source/Spatial/Text.js";
import { Canvas } from "../Source/Spatial/Internal/TextMetrics.generated.js";
import { Kind } from "../Source/Spatial/Internal/ComponentKind.js";
import type { Node } from "../Source/Spatial/Internal/Surface.js";
import { Prepare } from "../Source/Spatial/Internal/TextLines.js";
import { Scene } from "./SpatialRuntimeHarness.mjs";
import { Utf8Bytes } from "../Source/Spatial/Measurement.js";
import assert from "node:assert/strict";
import test from "node:test";

let Next = 0;

/**
 * Creates committed descriptors without depending on React scheduling.
 *
 * @category Testing
 * @since 1.0.0
 */
function N(
    Type: string, Props: Record<string, unknown> = {}, Children: Array<Node> = [], value?: string
): Node
{
    return { Id: ++Next,
        Type,
        Props,
        Children,
        Hidden: false,
        Text: value };
}

/**
 * Records the exact primitive ABI, exposing privacy at registration and every native mutation.
 *
 * @category Testing
 * @since 1.0.0
 */
function Fixture(onCreate?: () => void, onAdd?: () => void, clock?: () => number)
{
    const records: Array<Text.Primitive & { Value: string;
        Location: Text.Location;
        Changes: Array<string>;
        Removed: number }> = [];
    const owned: Array<() => void> = [];
    const viewer = { id: "one",
        isValid: true };
    const factory = Text.CreateSurface({
        Dimension: (id) => id,
        CreateText: (location, value) =>
        {
            const entry = {
                Value: value,
                Location: location,
                Changes: [] as Array<string>,
                Removed: 0,
                visibleTo: [] as Array<typeof viewer>,
                useRotation: false,
                rotation: { x: 0,
                    y: 0,
                    z: 0 },
                scale: 0,
                color: { red: 0,
                    green: 0,
                    blue: 0,
                    alpha: 0 },
                backgroundColorOverride: { red: 0,
                    green: 0,
                    blue: 0,
                    alpha: 1 },
                depthTest: false,
                textBackfaceVisible: true,
                backfaceVisible: true,
                setText: (text: string) =>
                {
                    entry.Value = text;
                    entry.Changes.push(text);
                },
                setLocation: (next: Text.Location) => { entry.Location = next; },
                remove: () => { entry.Removed++; }
            };
            records.push(entry);
            onCreate?.();
            return entry;
        },
        AddText: (primitive, dimension) =>
        {
            assert.deepEqual(primitive.visibleTo, [ viewer ]);
            assert.equal(primitive.depthTest, true);
            assert.equal(primitive.useRotation, true);
            assert.equal(primitive.backgroundColorOverride.alpha, 0);
            assert.equal(primitive.textBackfaceVisible, false);
            assert.equal(primitive.backfaceVisible, false);
            assert.equal(dimension, "test:world");
            onAdd?.();
        }
    });
    const surface = factory.Create({ Viewer: viewer,
        RootId: 1,
        World: { getAllPlayers: () => [ viewer ] },
        System: { get currentTick(): number | undefined
        {
            return clock?.();
        } } as never,
        Native: { TextPrimitive: class {} },
        Own: (cleanup) =>
        {
            let active = true;
            const release = () =>
            {
                if (active)
                {
                    active = false;
                    cleanup();
                }
            };

            owned.push(release);
            return release;
        } });
    const commit = (children: Array<Node>, props: Record<string, unknown> = {}) =>
    {
        const root = N(Kind.View, { Dimension: "test:world",
            Width: 200,
            Height: 200,
            ...props }, children);
        const layout = Layout.Compute([ root ]);
        surface.Commit({ Revision: 1,
            Nodes: [ root ],
            Layout: layout });
        return layout;
    };

    return { records,
        surface,
        commit,
        owned,
        factory,
        viewer };
}

test("encoded nested runs restore outer colors and retain a single visual line", () =>
{
    const lines = Prepare("abc", [ { Id: 1,
        Start: 0,
        Length: 1,
        Color: "#4D4D4D" },
    { Id: 2,
        Start: 1,
        Length: 1,
        Color: "#FF5555" },
    { Id: 1,
        Start: 2,
        Length: 1,
        Color: "#4D4D4D" } ], { Color: "#4D4D4D" });
    assert.equal(lines.length, 1);
    assert.match(lines[0].Encoded, /a§cb§rc/u);
    assert.equal(lines[0].Encoded.codePointAt(0), Canvas.Switch);
    assert.equal(lines[0].PaddedWidth % 2, 0);
    assert.throws(() => Prepare("x", [ { Id: 1,
        Start: 0,
        Length: 1,
        Color: "#FFFFFF80" } ], {}), /alpha/u);
});

test("wrapping counts final code, switch and padding bytes and never splits supplementary characters", () =>
{
    const boundary = Prepare("a".repeat(126), [], {});
    assert.deepEqual(boundary.map((line) => line.Value.length), [ 125, 1 ]);
    assert.equal(Utf8Bytes(boundary[0].Encoded), 128);
    for (const source of [ "a".repeat(500), "😀".repeat(100), "§c" + "界".repeat(100), "a\n\nb" ])
    {
        const lines = Prepare(source, [], {});
        assert.equal(lines.map((line) => line.Value).join(""), source.replaceAll("\n", ""));
        assert.ok(lines.every((line) => Utf8Bytes(line.Encoded) <= 128));
        assert.ok(lines.every((line) => !/[\uD800-\uDBFF]$/u.test(line.Value)));
        assert.ok(lines.every((line) => line.PaddedWidth % 2 === 0));
    }

    const wrapped = Prepare("§c" + "界".repeat(100), [], {});
    assert.ok(wrapped.slice(1).every((line) => line.Encoded.includes("§c")));
    assert.throws(() => Prepare("a\u0000b", [], {}), /U\+0000/u);
    for (const code of "0123456789abcdefghijmnpqrstuvr")
    {
        assert.doesNotThrow(() => Prepare(`§${code}a`, [], {}));
    }

    for (const code of [ "k", "l", "o", "z" ])
    {
        assert.throws(() => Prepare(`§${code}x`, [], {}), /formatting/u);
    }

    assert.doesNotThrow(() => Prepare("§lx", [], { Measure: (text) => text.replace(/§./gu, "").length * 2 }));
    assert.throws(() => Prepare("x", [], { Measure: () => NaN }), /finite/u);
});

test("each outer Text visual line has one private primitive with measured rounded alignment", () =>
{
    for (const align of [ "start", "center", "end" ] as const)
    {
        const fixture = Fixture();
        const text = N(Kind.Text, { Width: 60,
            TextAlign: align }, [ N("#text", {}, [], "abc\ni") ]);
        const layout = fixture.commit([ text ]);
        assert.equal(fixture.records.length, 2);
        const item = layout.Items.find((entry) => entry.Id === text.Id)!;
        for (const [ index, record ] of fixture.records.entries())
        {
            const line = item.Text!.Lines[index];
            const actualStart = record.Location.x * 16 - Math.floor(line.PaddedWidth / 2) + line.PrefixWidth;
            assert.equal(actualStart, item.Content.X + line.X);
            assert.equal(record.Location.y, -(item.Content.Y + line.Y + 6) / 16);
            assert.equal(record.scale, 1 / (16 * Text.BlocksPerLargePixel));
            assert.equal(record.Location.dimension, "test:world");
            assert.equal(record.color.red, 0x4D / 255);
        }

        fixture.surface.Dispose();
        fixture.owned.forEach((release) => release());
        assert.ok(fixture.records.every((record) => record.Removed === 1));
    }
});

test("unchanged commits do not setText; static placement resends once after five ticks", () =>
{
    const fixture = Fixture();
    const text = N(Kind.Text, {}, [ N("#text", {}, [], "abc") ]);
    fixture.commit([ text ]);
    fixture.commit([ text ]);
    const primitive = fixture.records[0];
    for (let tick = 0; tick < 4; tick++)
    {
        fixture.surface.Update();
    }

    assert.equal(primitive.Changes.length, 0);
    fixture.surface.Update();
    assert.equal(primitive.Changes.length, 1);
    for (let tick = 0; tick < 20; tick++)
    {
        fixture.surface.Update();
    }

    assert.equal(primitive.Changes.length, 1);
    const updated = { ...text,
        Children: [ N("#text", {}, [], "xyz") ] };
    fixture.commit([ updated ]);
    assert.equal(fixture.records.length, 1);
    assert.equal(primitive.Changes.length, 2);
    fixture.commit([]);
    assert.equal(primitive.Removed, 1);
    fixture.surface.Update();
    assert.equal(primitive.Changes.length, 2);
});

test("nested text merges; ScrollView partial and hidden lines never allocate", () =>
{
    const fixture = Fixture();
    const inner = N(Kind.Text, { Color: "#FF5555" }, [ N("#text", {}, [], "b") ]);
    const text = N(Kind.Text, {}, [ N("#text", {}, [], "a"), inner, N("#text", {}, [], "c") ]);
    fixture.commit([ text ]);
    assert.equal(fixture.records.length, 1);
    assert.match(fixture.records[0].Value, /a§cb§rc/u);
    const clipped = fixture.commit([ N(Kind.ScrollView, { Width: 100,
        Height: 9 }, [ text ]) ]);
    assert.ok(!Layout.HitTest(clipped, clipped.Views[0].Id, { X: 1,
        Y: 1 })
        .some((item) => item.Id === text.Id));
    assert.equal(fixture.records.length, 1);
    assert.equal(fixture.records[0].Removed, 1);
    fixture.commit([ { ...text,
        Hidden: true } ]);
    assert.equal(fixture.records.length, 1);
});

test("native tick deadlines exclude the placement tick from the five-tick resend delay", () =>
{
    let tick = 100;
    const fixture = Fixture(undefined, undefined, () => tick);
    fixture.commit([ N(Kind.Text, {}, [ N("#text", {}, [], "abc") ]) ]);
    fixture.surface.Update();
    tick = 104;
    fixture.surface.Update();
    assert.equal(fixture.records[0].Changes.length, 0);
    tick = 105;
    fixture.surface.Update();
    assert.equal(fixture.records[0].Changes.length, 1);
});

test("reentrant disposal during native allocation prevents registration and removes the new handle", () =>
{
    const fixture = Fixture(() => fixture.surface.Dispose());
    fixture.commit([ N(Kind.Text, {}, [ N("#text", {}, [], "abc") ]) ]);
    assert.equal(fixture.records.length, 1);
    assert.equal(fixture.records[0].Removed, 1);
    fixture.surface.Update();
    assert.equal(fixture.records[0].Changes.length, 0);
});

test("registration failure retires the root and releases the allocated primitive", async () =>
{
    const fixture = Fixture(undefined, () =>
    {
        throw new Error("injected registration failure");
    });
    const scene = new Scene();
    scene.Players = [ fixture.viewer ];
    const runtime = scene.Start(Renderer, { Surface: fixture.factory });
    const root = Renderer.CreateRoot(runtime, { Player: fixture.viewer });
    try
    {
        root.Render(React.createElement(C.View, { Dimension: "test:world" },
            React.createElement(C.Text, null, "failure")));
        await scene.System.Until(() => root.Disposed);
        await root.Unmount();
        assert.equal(fixture.records.length, 1);
        assert.equal(fixture.records[0].Removed, 1);
        assert.ok(scene.Errors.some((failure) => String(failure.Cause).includes("injected")));
    }
    finally
    {
        await runtime.Dispose();
    }
});

test("yaw follows +F including negative seam normalization and layer depth", () =>
{
    for (const degrees of [ 0, 90, 180, 270, -270 ])
    {
        const fixture = Fixture();
        const angle = degrees * Math.PI / 180;
        fixture.commit([ N(Kind.Text, { Layer: 2 }, [ N("#text", {}, [], "hi") ]) ], {
            Transform: { position: { x: 0,
                y: 0,
                z: 0 },
            rotation: { x: 0,
                y: Math.sin(angle / 2),
                z: 0,
                w: Math.cos(angle / 2) } }
        });
        const normalized = ((degrees % 360) + 540) % 360 - 180;
        assert.ok(Math.abs(fixture.records[0].rotation.y - (normalized === -180 ? 180 : normalized)) < 1e-10);
        assert.equal(fixture.records[0].depthTest, true);
    }
});

test("reactive themes, explicit colors, nested contexts and roots update the native text path", async () =>
{
    const fixture = Fixture();
    const scene = new Scene();
    scene.Players = [ fixture.viewer ];
    const runtime = scene.Start(Renderer, { Surface: fixture.factory });
    const root = Renderer.CreateRoot(runtime, { Player: fixture.viewer });
    const isolated = Renderer.CreateRoot(runtime, { Player: fixture.viewer });
    const tree = (color: string): React.ReactNode => React.createElement(C.ThemeProvider,
        { theme: "dark",
            Tokens: { Foreground: color } },
        React.createElement(C.View, { Dimension: "test:world" },
            React.createElement(C.Text, null, "theme"),
            React.createElement(C.Text, { Color: "#19A7D3" }, "explicit"),
            React.createElement(C.ThemeProvider, { Tokens: { Foreground: "#123456" } },
                React.createElement(C.Text, null, "nested"))));
    try
    {
        root.Render(tree("#ABCDEF"));
        isolated.Render(React.createElement(C.View, { Dimension: "test:world" },
            React.createElement(C.Text, null, "isolated")));
        await scene.System.Until(() => fixture.records.length === 4);
        const initial = root.Layout!.Items.find((item) => item.Text?.Value === "theme")!;
        root.Render(tree("#654321"));
        await scene.System.Until(() => fixture.records.some((entry) => entry.Removed === 0 &&
            entry.Value.includes("theme") && entry.color.red === 0x65 / 255));
        assert.equal(root.Layout!.Items.find((item) => item.Text?.Value === "theme")!.Id, initial.Id);
        const colorOf = (value: string) => fixture.records.find((entry) =>
            entry.Removed === 0 && entry.Value.includes(value))!.color;
        assert.equal(colorOf("explicit").red, 0x19 / 255);
        assert.equal(colorOf("nested").red, 0x12 / 255);
        assert.equal(colorOf("isolated").red, 0x4D / 255);
        assert.deepEqual(scene.Errors, []);
    }
    finally
    {
        await runtime.Dispose();
    }

    assert.ok(fixture.records.every((entry) => entry.Removed === 1));
    assert.equal(scene.System.Timers.size, 0);
});
