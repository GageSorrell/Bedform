/**
 * Qualifies spatial sizing, flow, clipping, world orientation and authoritative resolved child contracts.
 *
 * @module bedform/Test/SpatialLayout.test
 *
 * @file      SpatialLayout.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Behavioral cases retain geometry/event order and infer callbacks from public component contracts. */

/* eslint-disable sort-keys, @typescript-eslint/typedef */

import * as C from "../Source/Spatial/Components.js";
import * as Layout from "../Source/Spatial/Layout.js";
import * as React from "../Source/Spatial/React/index.js";
import * as Renderer from "../Source/Spatial/Renderer.js";
import { Scene, Text } from "./SpatialRuntimeHarness.mjs";
import { Kind } from "../Source/Spatial/Internal/ComponentKind.js";
import type { Node } from "../Source/Spatial/Internal/Surface.js";
import assert from "node:assert/strict";
import { test } from "node:test";
let Next = 0;

/**
 * Creates a structural node for independently specified layout geometry tests.
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
 * Creates a layout View with explicit dimension identity.
 *
 * @category Testing
 * @since 1.0.0
 */
function V(children: Array<Node>, props: Record<string, unknown> = {}): Node
{
    return N(Kind.View, { Dimension: "test:world",
        ...props }, children);
}

/**
 * Locates one committed box by stable source identity.
 *
 * @category Testing
 * @since 1.0.0
 */
function Item(result: Layout.Result, node: Node): Layout.Item
{
    return result.Items.find((entry) => entry.Id === node.Id)!;
}

test("row padding, gap, proportional growth and cross-axis centering share exact committed rectangles", () =>
{
    const a = N(Kind.Panel, { Width: 10,
        Height: 4,
        Grow: 1 });
    const b = N(Kind.Panel, { Width: 20,
        Height: 8,
        Grow: 2 });
    const row = N(Kind.Row, { Height: 20,
        Padding: 2,
        Gap: 2,
        Align: "center" }, [ a, b ]);
    const root = V([ row ], { Width: 100,
        Height: 50,
        Padding: 5,
        Align: "stretch" });
    const result = Layout.Compute([ root ], 7);
    assert.deepEqual(Item(result, row).Bounds, { X: 5,
        Y: 5,
        Width: 90,
        Height: 20 });
    assert.deepEqual(Item(result, a).Bounds, { X: 7,
        Y: 13,
        Width: 28,
        Height: 4 });
    assert.deepEqual(Item(result, b).Bounds, { X: 37,
        Y: 11,
        Width: 56,
        Height: 8 });
    assert.equal(result.Revision, 7);
    assert.ok(
        Object.isFrozen(result) &&
            Object.isFrozen(result.Items) &&
            Object.isFrozen(Item(result, a).Bounds)
    );
});
test("content sizing excludes absolute children while retaining visible overflow extent", () =>
{
    const a = N(Kind.Panel, { Width: 10,
        Height: 8 });
    const b = N(Kind.Panel, { Width: 6,
        Height: 12 });
    const row = N(Kind.Row, { Padding: 1,
        Gap: 3 }, [ a, b ]);
    const absolute = N(Kind.Panel, { Width: 100,
        Height: 100,
        Position: "absolute",
        X: -10,
        Y: -10 });
    const root = V([ row, absolute ]);
    const result = Layout.Compute([ root ]);
    assert.deepEqual(result.Views[0]!.Bounds, { X: 0,
        Y: 0,
        Width: 21,
        Height: 14 });
    assert.deepEqual(result.Views[0]!.Extent, { X: -10,
        Y: -10,
        Width: 100,
        Height: 100 });
    assert.equal(Item(result, absolute).Bounds.X, -10);
});
test("column alignment, every justification mode, minima and explicit auto stretch are deterministic", () =>
{
    for (const [ justify, expected ] of [
        [ "start", [ 0, 12 ] ],
        [ "center", [ 14, 26 ] ],
        [ "end", [ 28, 40 ] ],
        [ "space-between", [ 0, 40 ] ]
    ] as const)
    {
        const a = N(Kind.Panel, { Width: 4,
            Height: 10 });
        const b = N(Kind.Panel, { Width: 4,
            Height: 10 });
        const root = V([ a, b ], { Width: 20,
            Height: 50,
            Gap: 2,
            Align: "end",
            Justify: justify });
        const result = Layout.Compute([ root ]);
        assert.deepEqual([ Item(result, a).Bounds.Y, Item(result, b).Bounds.Y ], expected);
        assert.equal(Item(result, a).Bounds.X, 16);
    }

    for (const [ align, expected ] of [
        [ "start", 0 ],
        [ "center", 8 ],
        [ "end", 16 ]
    ] as const)
    {
        const child = N(Kind.Panel, { Width: 4,
            Height: 1 });
        const result = Layout.Compute([ V([ child ], { Width: 20,
            Align: align }) ]);
        assert.equal(Item(result, child).Bounds.X, expected);
    }

    const child = N(Kind.Panel, { Width: "auto",
        Height: 1 });
    const result = Layout.Compute([ V([ child ], { Width: 20,
        Align: "stretch",
        MinHeight: 12 }) ]);
    assert.equal(Item(result, child).Bounds.Width, 20);
    assert.equal(result.Views[0]!.Bounds.Height, 12);
});
test("relative offsets preserve flow space and absolute positions use the padded content origin", () =>
{
    const a = N(Kind.Panel, { Width: 10,
        Height: 10,
        X: 3,
        Y: 4 });
    const b = N(Kind.Panel, { Width: 10,
        Height: 10 });
    const c = N(Kind.Panel, { Position: "absolute",
        Width: 8,
        Height: 9,
        X: -5,
        Y: 2 });
    const result = Layout.Compute([ V([ a, b, c ], { Width: 100,
        Height: 100,
        Padding: 10 }) ]);
    assert.deepEqual(Item(result, a).Bounds, { X: 13,
        Y: 14,
        Width: 10,
        Height: 10 });
    assert.equal(Item(result, b).Bounds.Y, 20);
    assert.deepEqual(Item(result, c).Bounds, { X: 5,
        Y: 12,
        Width: 8,
        Height: 9 });
});
test("viewport offsets clamp and rendering/hit-testing use identical rectangular clips", () =>
{
    const leaf = N(Kind.Panel, { Width: 40,
        Height: 30 });
    const row = N(Kind.Row, { Width: 40,
        Height: 30 }, [ leaf ]);
    const scroll = N(
        Kind.ScrollView,
        { Width: 20,
            Height: 10,
            Padding: 1,
            ScrollX: 100,
            ScrollY: 100 },
        [ row ]
    );
    const root = V([ scroll ], { Width: 50,
        Height: 40,
        Pointer: { Visible: false } });
    const result = Layout.Compute([ root ]);
    assert.deepEqual(Item(result, scroll).Scroll, { X: 22,
        Y: 22 });
    assert.deepEqual(Item(result, leaf).Bounds, { X: -21,
        Y: -21,
        Width: 40,
        Height: 30 });
    assert.deepEqual(Item(result, leaf).Clip, { X: 1,
        Y: 1,
        Width: 18,
        Height: 8 });
    assert.ok(Layout.HitTest(result, root.Id, { X: 2,
        Y: 2 }).some((item) => item.Id === leaf.Id));
    assert.ok(!Layout.HitTest(result, root.Id, { X: 0,
        Y: 0 }).some((item) => item.Id === leaf.Id));
    assert.equal(
        Item(result, leaf).Pointer.Visible,
        false,
        "Hidden pointer lines do not remove hit targets."
    );
});
test("nonvisual scopes inherit item and access requirements without flow boxes or arbitrary clipping", () =>
{
    const access = { MaxPlayers: 2 };
    const inner = { LockedTo: "player" };
    const leaf = N(Kind.Panel, { Width: 10,
        Height: 10,
        RequiredItem: "test:inner" });
    const scope = N(Kind.InputScope, { Access: inner }, [ leaf ]);
    const root = V([ scope ], { RequiredItem: "test:outer",
        Access: access });
    const result = Layout.Compute([ root ]);
    assert.equal(result.Items.length, 2);
    assert.deepEqual(Item(result, leaf).RequiredItems, [ "test:outer", "test:inner" ]);
    assert.deepEqual(Item(result, leaf).Access, [ access, inner ]);
    assert.equal(Item(result, leaf).Clip, undefined);
});
test("arbitrary rigid orientations round-trip local/world coordinates and preserve pixels per block", () =>
{
    for (const rotation of [
        { x: 0,
            y: 0,
            z: 0,
            w: 1 },
        { x: 0,
            y: 1,
            z: 0,
            w: 1 },
        { x: 1,
            y: 0,
            z: 0,
            w: 1 },
        { x: 0,
            y: 0,
            z: 1,
            w: 1 },
        { x: 1,
            y: 2,
            z: 3,
            w: 4 }
    ])
    {
        const result = Layout.Compute([
            V([], {
                Width: 100,
                Height: 100,
                PixelsPerBlock: 32,
                Dimension: { id: "test:dimension" },
                Transform: { position: { x: 10,
                    y: -3,
                    z: 15 },
                rotation }
            })
        ]);
        const view = result.Views[0]!;
        const world = Layout.Project(view, { X: 7.5,
            Y: -4.25 }, 0.5);
        const point = Layout.Unproject(view, world);
        assert.ok(Math.abs(point.X - 7.5) < 1e-10 && Math.abs(point.Y + 4.25) < 1e-10);
        const a = Layout.Project(view, { X: 0,
            Y: 0 });
        const b = Layout.Project(view, { X: 32,
            Y: 0 });
        assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) - 1) < 1e-10);
        assert.equal(view.Dimension, "test:dimension");
    }

    const view = Layout.Compute([ V([]) ]).Views[0]!;
    assert.deepEqual(Layout.Project(view, { X: 16,
        Y: 16 }), { x: 1,
        y: -1,
        z: 0 });
});
test("inline Text measures content, retains color runs, and wraps without splitting code points", () =>
{
    const raw = (Text: string): Node => ({ ...N("#text"),
        Text });
    const nested = N(Kind.Text, { Color: "#FF0000" }, [ raw("CD") ]);
    const text = N(
        Kind.Text,
        { Width: 4,
            LineGap: 2,
            Measure: (line: string) => [ ...line ].length * 2 },
        [ raw("ab"), nested, raw("😀") ]
    );
    const result = Layout.Compute([ V([ text ]) ]);
    const item = Item(result, text);
    assert.equal(item.Text!.Value, "abCD😀");
    assert.deepEqual(
        item.Text!.Lines.map((line) => line.Value),
        [ "ab", "CD", "😀" ]
    );
    assert.equal(item.Bounds.Height, 34);
    assert.equal(item.Text!.Runs[1]!.Color, "#FF0000");
    assert.equal(item.Text!.Runs[2]!.Length, 2);
});
test("tabs anchor above the upper-right frame edge and narrow panels hide their hit targets", () =>
{
    const a = N(Kind.TabButton, { Width: 24,
        Height: 16 });
    const b = N(Kind.TabButton, { Width: 24,
        Height: 16 });
    const tabs = N(Kind.Tabs, { Gap: 2,
        Inset: 5,
        Overlap: 3 }, [ a, b ]);
    const frame = N(
        Kind.FramedPanel,
        { Width: 100,
            Height: 60,
            Position: "absolute",
            X: 10,
            Y: 20,
            Padding: 4 },
        [ tabs ]
    );
    const root = V([ frame ], { Width: 200,
        Height: 100 });
    const result = Layout.Compute([ root ]);
    assert.deepEqual(Item(result, tabs).Bounds, { X: 55,
        Y: 7,
        Width: 50,
        Height: 16 });
    assert.equal(Item(result, b).Bounds.X, 81);
    assert.equal(Item(result, a).Layer, 1);
    assert.ok(Layout.HitTest(result, root.Id, { X: 56,
        Y: 8 }).some((item) => item.Id === a.Id));
    const narrow = { ...frame,
        Props: { ...frame.Props,
            Width: 30 } };
    const hidden = Layout.Compute([ { ...root,
        Children: [ narrow ] } ]);
    assert.equal(Item(hidden, tabs).Hidden, true);
    assert.ok(!Layout.HitTest(hidden, root.Id, { X: 0,
        Y: 8 }).some((item) => item.Id === a.Id));
});

/**
 * Ordinary user boundary used by actual reconciler tests, including post-resolution child changes.
 *
 * @category Testing
 * @since 1.0.0
 */
class Boundary extends React.Component<
    React.PropsWithChildren,
    {
        Failed: boolean;
    }
>
{
    state = { Failed: false };

    /**
     * Selects the spatial fallback after a component/host contract fails.
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
     * Renders a valid spatial fallback rather than bypassing the Text rule.
     *
     * @category Testing
     * @since 1.0.0
     */
    render(): React.ReactNode
    {
        return this.state.Failed
            ? React.createElement(
                C.View,
                { Dimension: "test:world" },
                React.createElement(C.Text, null, "caught")
            )
            : this.props.children;
    }
}

/**
 * Runs a widget against the actual shared renderer and strict spatial schema.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Fixture(element: React.ReactNode): Promise<{
    Scene: Scene;
    Root: Renderer.Root;
    Runtime: Renderer.Runtime;
}>
{
    const scene = new Scene();
    const viewer = { id: "layout",
        isValid: true };
    scene.Players = [ viewer ];
    const runtime = scene.Start(Renderer, { Surface: { ...scene.Factory,
        CustomHost: false } });
    const root = Renderer.CreateRoot(runtime, { Player: viewer });
    root.Render(element);
    await scene.System.Until(() => !!root.Layout || root.Disposed);
    return { Scene: scene,
        Root: root,
        Runtime: runtime };
}

test("committed layout and reactive pose/size are shared by Root and surface presentation", async () =>
{
    const view = (width: number): React.ReactNode =>
        React.createElement(
            C.View,
            {
                Dimension: width === 100 ? "test:first" : "test:second",
                Width: width,
                RequiredItem: width === 100 ? "test:a" : "test:b",
                Pointer: { Visible: width === 100 },
                Transform: { position: { x: width,
                    y: 0,
                    z: 0 },
                rotation: { x: 1,
                    y: 1,
                    z: 1,
                    w: 1 } }
            },
            React.createElement(
                C.Row,
                { Width: width,
                    Gap: 2 },
                React.createElement(C.Text, null, "text")
            )
        );
    const fixture = await Fixture(view(100));
    try
    {
        await fixture.Scene.System.Until(() => fixture.Scene.Sessions.length > 0);
        assert.equal(fixture.Scene.Sessions[0]!.Frames.at(-1)!.Layout, fixture.Root.Layout);
        const old = fixture.Root.Layout!;
        fixture.Root.Render(view(200));
        assert.equal(fixture.Root.Layout, old);
        await fixture.Scene.System.Until(() => fixture.Root.Layout!.Revision > old.Revision);
        assert.equal(fixture.Root.Layout!.Views[0]!.Bounds.Width, 200);
        assert.equal(fixture.Root.Layout!.Views[0]!.Dimension, "test:second");
        assert.deepEqual(fixture.Root.Layout!.Items[0]!.RequiredItems, [ "test:b" ]);
        assert.equal(fixture.Root.Layout!.Items[0]!.Pointer.Visible, false);
        assert.equal(fixture.Root.Layout!.Views[0]!.Transform.position.x, 200);
        await fixture.Scene.System.Until(
            () => fixture.Scene.Sessions[0]!.Frames.at(-1)!.Layout === fixture.Root.Layout
        );
    }
    finally
    {
        await fixture.Runtime.Dispose();
    }
});
test("bare scalars and non-Text hosts inside Text reach a boundary", async () =>
{
    const Composite = (): React.ReactNode => "composite text";
    const cases: Array<React.ReactNode> = [
        "root text",
        0,
        React.createElement(C.View, { Dimension: "test:world" }, "bare" as never),
        React.createElement(C.View, { Dimension: "test:world" }, 0 as never),
        React.createElement(C.View, { Dimension: "test:world" }, React.createElement(Composite)),
        React.createElement(
            C.View,
            { Dimension: "test:world" },
            React.createElement(C.Text, null, React.createElement(C.Panel) as never)
        ),
        React.createElement(
            C.View,
            { Dimension: "test:world" },
            React.createElement(C.Divider, null, "bad" as never)
        ),
        React.createElement(
            C.View,
            { Dimension: "test:world" },
            React.createElement(C.Mob, { Type: "test:mob" }, 2 as never)
        )
    ];
    for (const element of cases)
    {
        const fixture = await Fixture(React.createElement(Boundary, null, element));
        try
        {
            await fixture.Scene.System.Until(() =>
                fixture.Scene.Sessions.some((session) => Text(session.Frames.at(-1)) === "caught")
            );
            assert.equal(fixture.Root.Disposed, false);
            assert.equal(fixture.Scene.Errors[0]!.Phase, "caught");
            assert.ok(
                fixture.Scene.Sessions.every((session) =>
                    session.Frames.every((frame) =>
                        frame.Layout?.Items.filter((item) => item.Type === Kind.Text).every(
                            (item) => item.Text?.Value === "caught"
                        )
                    )
                )
            );
        }
        finally
        {
            await fixture.Runtime.Dispose();
        }
    }
});
test("nested Text inherits fonts, allows Color and rejects conflicting props on reactive updates", async () =>
{
    const fallback = { Replace: "?" };
    let update!: React.Dispatch<React.SetStateAction<boolean>>;
    const Component = (): React.ReactNode =>
    {
        const [ conflict, set ] = React.useState(false);
        update = set;
        return React.createElement(
            C.View,
            { Dimension: "test:world" },
            React.createElement(
                C.Text,
                { Font: "Legacy",
                    Fallback: fallback },
                "a",
                React.createElement(
                    C.Text,
                    { Color: "#FF0000",
                        Font: conflict ? "Ten" : "Legacy",
                        Fallback: { Replace: "?" } },
                    "b"
                )
            )
        );
    };

    const fixture = await Fixture(React.createElement(Boundary, null, React.createElement(Component)));
    try
    {
        const item = fixture.Root.Layout!.Items.find((entry) => entry.Type === Kind.Text)!;
        assert.equal(item.Text!.Value, "ab");
        assert.equal(item.Text!.Font, "Legacy");
        update(true);
        await fixture.Scene.System.Until(() =>
            fixture.Root.Layout!.Items.some((entry) => entry.Text?.Value === "caught")
        );
        assert.equal(fixture.Scene.Errors.at(-1)!.Phase, "caught");
    }
    finally
    {
        await fixture.Runtime.Dispose();
    }
});
test("Slot cardinality checks resolved composite output, including descendant-only updates", async () =>
{
    let update!: React.Dispatch<React.SetStateAction<boolean>>;
    const Items = (): React.ReactNode =>
    {
        const [ multiple, set ] = React.useState(false);
        update = set;
        return React.createElement(
            React.Fragment,
            null,
            React.createElement(C.ItemStack, { Item: "test:first",
                key: "first" }),
            multiple ? React.createElement(C.ItemStack, { Item: "test:second",
                key: "second" }) : null
        );
    };

    const fixture = await Fixture(
        React.createElement(
            Boundary,
            null,
            React.createElement(
                C.View,
                { Dimension: "test:world" },
                React.createElement(C.Slot, null, React.createElement(Items) as never)
            )
        )
    );
    try
    {
        assert.equal(
            fixture.Root.Layout!.Items.filter((entry) => entry.Type === Kind.ItemStack).length,
            1
        );
        update(true);
        await fixture.Scene.System.Until(() =>
            fixture.Root.Layout!.Items.some((entry) => entry.Text?.Value === "caught")
        );
        assert.ok(
            fixture.Scene.Errors.some((error) => String(error.Cause).includes("exactly one ItemStack"))
        );
        assert.ok(
            fixture.Scene.Sessions.every((session) =>
                session.Frames.every(
                    (frame) =>
                        (frame.Layout?.Items.filter((entry) => entry.Type === Kind.ItemStack).length ??
                            0) <= 1
                )
            )
        );
    }
    finally
    {
        await fixture.Runtime.Dispose();
    }
});
test("frames allow transparent wrappers and reject hidden visual ancestry", async () =>
{
    const Context = React.createContext(1);
    const Wrapper = ({ children }: React.PropsWithChildren): React.ReactNode =>
        React.createElement(Context, { value: 2 }, children);
    const Frame = (): React.ReactNode =>
        React.createElement(
            C.FramedPanel,
            { Width: 100,
                Height: 80 },
            React.createElement(
                C.Tabs,
                null,
                React.createElement(
                    C.TabButton,
                    { appearance: "subtle",
                        OnActivate: () => undefined },
                    React.createElement(C.Text, null, "close")
                )
            )
        );
    const valid = await Fixture(
        React.createElement(
            C.View,
            { Dimension: "test:world" },
            React.createElement(
                Wrapper,
                null,
                React.createElement(React.Fragment, null, React.createElement(Frame))
            )
        )
    );
    await valid.Runtime.Dispose();
    for (const parent of [ C.Panel, C.Row, C.Column, C.FramedPanel ])
    {
        const fixture = await Fixture(
            React.createElement(
                Boundary,
                null,
                React.createElement(
                    C.View,
                    { Dimension: "test:world" },
                    React.createElement(
                        parent,
                        null,
                        React.createElement(Wrapper, null, React.createElement(Frame))
                    )
                )
            )
        );
        try
        {
            await fixture.Scene.System.Until(() =>
                fixture.Root.Layout!.Items.some((entry) => entry.Text?.Value === "caught")
            );
            assert.ok(fixture.Scene.Errors.some((error) => String(error.Cause).includes("top-level")));
        }
        finally
        {
            await fixture.Runtime.Dispose();
        }
    }
});
test("theme changes, titled content insets and controlled tab metadata remain reactive", async () =>
{
    const action = (): void => undefined;
    const tree = (theme: "light" | "dark", selected: boolean): React.ReactNode =>
        React.createElement(
            C.ThemeProvider,
            { theme,
                Tokens: { FramePadding: 5 } },
            React.createElement(
                C.View,
                { Dimension: "test:world",
                    Width: 200 },
                React.createElement(
                    C.TitledPanel,
                    { Width: 100,
                        Title: React.createElement(C.Text, null, "title") },
                    React.createElement(C.Text, null, "body"),
                    React.createElement(
                        C.Tabs,
                        null,
                        React.createElement(
                            C.TabButton,
                            { appearance: "subtle",
                                Selected: selected,
                                OnActivate: action },
                            React.createElement(C.Text, null, "close")
                        )
                    )
                )
            )
        );
    const fixture = await Fixture(tree("dark", false));
    try
    {
        const initial = fixture.Root.Layout!;
        const title = initial.Items.find((entry) => entry.Text?.Value === "title")!;
        const content = initial.Items.find((entry) => entry.Type === Kind.Content)!;
        assert.equal(content.Props.BackgroundColor, "#00000080");
        assert.equal(title.Bounds.X + title.Bounds.Width / 2, 50);
        assert.equal(
            initial.Items.find((entry) => entry.Type === Kind.FramedPanel),
            undefined
        );
        const tab = initial.Items.find((entry) => entry.Type === Kind.TabButton)!;
        assert.equal(tab.Props.OnActivate, action);
        fixture.Root.Render(tree("light", true));
        await fixture.Scene.System.Until(() => fixture.Root.Layout!.Revision > initial.Revision);
        const updated = fixture.Root.Layout!.Items.find((entry) => entry.Type === Kind.TabButton)!;
        assert.equal(updated.Id, tab.Id);
        assert.equal(updated.Props.Selected, true);
        assert.equal(updated.Props.appearance, "subtle");
        const text = fixture.Root.Layout!.Items.find((entry) => entry.Text?.Value === "body")!;
        assert.equal(text.Text!.Runs[0]!.Color, "#4D4D4D");
    }
    finally
    {
        await fixture.Runtime.Dispose();
    }
});
test("asymmetric insets, zero sizes and invalid numeric/enum values have explicit contracts", () =>
{
    const leaf = N(Kind.Panel, { Width: 2,
        Height: 2 });
    const result = Layout.Compute([ V([ leaf ], { Padding: { Top: 1,
        Right: 2,
        Bottom: 3,
        Left: 4 } }) ]);
    assert.deepEqual(result.Views[0]!.Bounds, { X: 0,
        Y: 0,
        Width: 8,
        Height: 6 });
    assert.deepEqual(Item(result, leaf).Bounds, { X: 4,
        Y: 1,
        Width: 2,
        Height: 2 });
    const empty = V([], { Width: 0,
        Height: 0 });
    assert.deepEqual(Layout.HitTest(Layout.Compute([ empty ]), empty.Id, { X: 0,
        Y: 0 }), []);
    for (const props of [
        { Width: -1 },
        { Height: NaN },
        { Grow: Infinity },
        { Gap: "auto" },
        { Padding: { Top: -1 } },
        { PixelsPerBlock: 0 },
        { Align: "invalid" },
        { Transform: { position: { x: 0,
            y: 0,
            z: 0 },
        rotation: { x: 0,
            y: 0,
            z: 0,
            w: 0 } } }
    ])
    {
        assert.throws(() => Layout.Compute([ V([], props) ]), Layout.LayoutError);
    }
});
test("font-setting conflicts and non-Text Slot children fail before presentation", async () =>
{
    for (const props of [
        { Font: "Legacy" },
        { Fallback: "Omit" },
        { FallbackScope: "Text" },
        { Width: 20 },
        { Align: "center" },
        { Justify: "end" },
        { Visible: false },
        { RequiredItem: "test:item" },
        { Access: { LockedTo: "viewer" } },
        { Pointer: { Enabled: false } }
    ])
    {
        const fixture = await Fixture(
            React.createElement(
                Boundary,
                null,
                React.createElement(
                    C.View,
                    { Dimension: "test:world" },
                    React.createElement(
                        C.Text,
                        null,
                        React.createElement(C.Text, props as C.TextProps, "nested")
                    )
                )
            )
        );
        try
        {
            await fixture.Scene.System.Until(() =>
                fixture.Root.Layout!.Items.some((entry) => entry.Text?.Value === "caught")
            );
            assert.equal(fixture.Scene.Errors.at(-1)!.Phase, "caught");
        }
        finally
        {
            await fixture.Runtime.Dispose();
        }
    }

    const fixture = await Fixture(
        React.createElement(
            Boundary,
            null,
            React.createElement(
                C.View,
                { Dimension: "test:world" },
                React.createElement(C.Slot, null, React.createElement(C.Panel) as never)
            )
        )
    );
    try
    {
        await fixture.Scene.System.Until(() =>
            fixture.Root.Layout!.Items.some((entry) => entry.Text?.Value === "caught")
        );
    }
    finally
    {
        await fixture.Runtime.Dispose();
    }
});
test("reactive ancestry cannot place a titled frame behind a provider inside a layout container", async () =>
{
    let move!: React.Dispatch<React.SetStateAction<boolean>>;
    const Context = React.createContext(0);
    const Component = (): React.ReactNode =>
    {
        const [ nested, set ] = React.useState(false);
        move = set;
        const frame = React.createElement(
            Context,
            { value: 1 },
            React.createElement(
                C.TitledPanel,
                { Title: React.createElement(C.Text, null, "title") },
                React.createElement(C.Text, null, "body")
            )
        );
        return React.createElement(
            C.View,
            { Dimension: "test:world" },
            nested ? React.createElement(C.Column, null, frame) : frame
        );
    };

    const fixture = await Fixture(React.createElement(Boundary, null, React.createElement(Component)));
    try
    {
        assert.ok(fixture.Root.Layout!.Items.some((entry) => entry.Type === Kind.TitledPanel));
        move(true);
        await fixture.Scene.System.Until(() =>
            fixture.Root.Layout!.Items.some((entry) => entry.Text?.Value === "caught")
        );
        assert.ok(fixture.Scene.Errors.some((error) => String(error.Cause).includes("top-level")));
    }
    finally
    {
        await fixture.Runtime.Dispose();
    }
});
