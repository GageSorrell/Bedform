/**
 * Verifies the widget demonstration's scene layout, particle painting, pointer integration, gallery
 * clipping and built packs without a server.
 *
 * @module @sorrell/widget-demo/Test/Scene.test
 *
 * @file      Scene.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixtures infer callback types from the public Bedform contracts. */
/* eslint-disable @typescript-eslint/typedef */

import * as Access from "../../../Package/Bedform/Source/Spatial/Access.js";
import * as App from "../Script/App.ts";
import * as Layout from "../../../Package/Bedform/Source/Spatial/Layout.js";
import * as Pointer from "../../../Package/Bedform/Source/Spatial/Pointer.js";
import * as React from "../../../Package/Bedform/Source/Spatial/React/index.js";
import * as Renderer from "../../../Package/Bedform/Source/Spatial/Renderer.js";
import { Build, Identity } from "../Tool/Build.mts";
import { Center, PixelsPerBlock, RowZ, Top } from "../Script/Scene.ts";
import { Content, GalleryPose } from "../Script/Gallery.ts";
import { DepthSuffix, Flatten, OrientedSuffix, Project }
    from "../../../Package/Bedform/Source/Canvas/Surface.js";
import { Paint, PoseOf } from "../Script/Backend.ts";
import { Kind } from "../../../Package/Bedform/Source/Spatial/Internal/ComponentKind.js";
import { Scene } from "../../../Package/Bedform/Test/SpatialRuntimeHarness.mts";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Renders the shared scene through the real runtime and returns its committed layout.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Commit(): Promise<{ Layout: Layout.Result;
    Root: Renderer.Root;
    Stop: () => Promise<void>; }>
{
    const scene = new Scene();
    const viewer = { id: "p",
        isValid: true };
    scene.Players = [ viewer ];
    const runtime = scene.Start(Renderer, { Surface: { ...scene.Factory,
        CustomHost: false } });
    const root = Renderer.CreateRoot(runtime, { Audience: () => [ viewer ],
        Shared: true });
    root.Render(React.createElement(App.Scene, { OnLock: () => undefined,
        Seat: Access.CreateController({ MaxPlayers: 1 }) }));
    await scene.System.Until(() => !!root.Layout || root.Disposed);
    assert.deepEqual(scene.Errors, []);
    return { Layout: root.Layout!,
        Root: root,
        Stop: () => runtime.Dispose() };
}

test("the shared scene commits four north-facing views whose controls are reachable from spawn", async () =>
{
    const fixture = await Commit();
    try
    {
        const layout = fixture.Layout;
        assert.equal(layout.Views.length, 4);
        for (const view of layout.Views)
        {
            const origin = Layout.Project(view, { X: 0,
                Y: 0 });
            const front = Layout.Project(view, { X: 0,
                Y: 0 }, 1);
            assert.ok(Math.abs(front.z - origin.z + 1) < 1e-9, "every panel faces north");
            assert.equal(origin.z, RowZ);
            assert.equal(origin.y, Top);
            assert.equal(view.PixelsPerBlock, PixelsPerBlock);
        }

        const buttons = layout.Items.filter((item) => item.Type === Kind.Button);
        assert.ok(buttons.length >= 20);
        const take = layout.Items.find((item) => item.Type === Kind.Button && item.Access.length === 1)!;
        const view = layout.Views.find((entry) => entry.Id === take.ViewId)!;
        const target = Layout.Project(view, { X: take.Bounds.X + 4,
            Y: take.Bounds.Y + 4 });
        const eye = { x: target.x,
            y: -58.38,
            z: 0 };
        const hit = Pointer.Cast([ fixture.Root ], { Direction: { x: target.x - eye.x,
            y: target.y - eye.y,
            z: target.z - eye.z },
        Origin: eye }, { Dimension: "minecraft:overworld" })!;
        assert.equal(hit.Control?.Id, take.Id, "a player at spawn height can aim at the seat button");
        assert.ok(Math.abs(view.Transform.position.x - (Center.Access + 128 / PixelsPerBlock / 2)) < 1e-9);
    }
    finally
    {
        await fixture.Stop();
    }
});

test("painting uses widget art, follows hover and press, and shows the hover scrollbar only on demand",
    async () =>
    {
        const fixture = await Commit();
        try
        {
            const layout = fixture.Layout;
            const particles = (hover: Parameters<typeof Paint>[1], scrollbar = false): Array<string> =>
                Paint(layout, hover, () => scrollbar).flatMap((group) =>
                    group.Sprites.map((sprite) => sprite.Particle));
            const idle = particles({ Pressed: false });
            assert.ok(idle.includes("bedform_canvas:widget_button_light_normal"));
            assert.ok(idle.includes("bedform_canvas:widget_toggle_off"));
            assert.ok(idle.includes("bedform_canvas:widget_slider_thumb"));
            assert.ok(idle.includes("bedform_canvas:widget_button_disabled"));
            assert.ok(!idle.includes("bedform_canvas:widget_scroll_thumb"));
            const button = layout.Items.find((item) => item.Type === Kind.Button && !item.Props.Disabled)!;
            assert.ok(particles({ Control: button.Id,
                Pressed: false }).includes("bedform_canvas:widget_button_light_hover"));
            assert.ok(particles({ Control: button.Id,
                Pressed: true }).includes("bedform_canvas:widget_button_light_pressed"));
            assert.ok(particles({ Pressed: false }, true).includes("bedform_canvas:widget_scroll_thumb"));
            for (const group of Paint(layout, { Pressed: false }, () => true))
            {
                assert.ok(group.Sprites.every((sprite) => sprite.Layer < 0), "particles stay behind text");
                assert.ok(PoseOf(group.View).Scale > 0);
            }

            const scroll = layout.Items.find((item) => item.Type === Kind.ScrollView)!;
            const clipped = Paint(layout, { Pressed: false }, () => false)
                .find((group) => group.View.Id === scroll.ViewId)!.Sprites;
            const viewport = scroll.Content;
            const inside = (sprite: (typeof clipped)[number]): boolean =>
                sprite.Bounds.Y >= viewport.Y - 1e-9 &&
                sprite.Bounds.Y + sprite.Bounds.Height <= viewport.Y + viewport.Height + 1e-9;
            const rows = layout.Items.filter((item) => item.ParentId === scroll.Id);
            const rowSprites = clipped.filter((sprite) =>
                rows.some((row) => sprite.Bounds.X >= row.Bounds.X - 1e-9 &&
                    sprite.Bounds.X < row.Bounds.X + row.Bounds.Width &&
                    sprite.Bounds.Y >= viewport.Y - 1e-9 && sprite.Bounds.Y < viewport.Y + viewport.Height));
            assert.ok(rowSprites.length > 0 && rowSprites.every(inside), "rows are clipped to the viewport");
        }
        finally
        {
            await fixture.Stop();
        }
    });

test("the depth toggle selects depth-writing particle variants for every painted sprite", async () =>
{
    const fixture = await Commit();
    try
    {
        for (const group of Paint(fixture.Layout, { Pressed: false }, () => true))
        {
            for (const depth of [ false, true ])
            {
                const pose = PoseOf(group.View, depth);
                assert.equal(pose.DepthWrite, depth);
                const basis = { Normal: { x: 0,
                    y: 0,
                    z: -1 },
                Right: pose.Orientation === "FaceViewer" ? { x: -1,
                    y: 0,
                    z: 0 } : pose.Orientation.Right,
                Up: { x: 0,
                    y: 1,
                    z: 0 } };
                const suffix = OrientedSuffix + (depth ? DepthSuffix : "");
                const quads = Project(group.Sprites, pose, basis);
                assert.ok(quads.every((quad) => quad.Particle.endsWith(suffix)));
            }
        }
    }
    finally
    {
        await fixture.Stop();
    }
});

test("the gallery marquee scrolls inside its clip and the gallery faces north", () =>
{
    for (const offset of [ 0, 13, 400 ])
    {
        const placed = Flatten(Content(offset));
        assert.ok(placed.some((sprite) => sprite.Particle.startsWith("bedform_canvas:glyph_")));
        for (const sprite of placed.filter((entry) => entry.Particle.startsWith("bedform_canvas:glyph_")))
        {
            assert.ok(sprite.Bounds.X >= 6 - 1e-9 && sprite.Bounds.X + sprite.Bounds.Width <= 122 + 1e-9);
        }
    }

    const orientation = GalleryPose.Orientation as { Right: { x: number };
        Up: { y: number } };
    assert.equal(orientation.Right.x, -1);
    assert.equal(orientation.Up.y, 1);
});

test("the built packs depend on BedformCanvas and the bundle imports only the server module", async () =>
{
    const packs = await Build();
    const behavior = JSON.parse(await readFile(path.join(packs.Behavior, "manifest.json"), "utf8"));
    const canvas = JSON.parse(await readFile(path.join(packs.CanvasBehavior, "manifest.json"), "utf8"));
    assert.equal(behavior.header.uuid, Identity.Behavior);
    assert.ok(behavior.dependencies.some((entry: { uuid?: string }) => entry.uuid === canvas.header.uuid));
    const script = await readFile(path.join(packs.Behavior, "scripts/main.js"), "utf8");
    const imports = [ ...script.matchAll(/^import\s.*?from\s*"([^"]+)"/gmu) ].map((match) => match[1]);
    assert.deepEqual([ ...new Set(imports) ], [ "@minecraft/server" ]);
    for (const item of [ "wand", "key" ])
    {
        const file = path.join(packs.Behavior, `items/${item}.json`);
        const definition = JSON.parse(await readFile(file, "utf8"));
        assert.equal(definition["minecraft:item"].description.identifier, `widget_demo:${item}`);
    }
});
