/**
 * Exercises spatial line encoding and private TextPrimitive presentation against the native BDS API.
 *
 * @module bedform-canvas/Test/Native/Text
 *
 * @file      Text.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native evidence keeps operation order and contextual callbacks. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */

import * as Layout from "bedform/Spatial/Layout";
import * as Text from "bedform/Spatial/Text";
import type { Dimension, DimensionLocation, Player } from "@minecraft/server";
import { TextPrimitive, system, world } from "@minecraft/server";
import type { SurfaceNode } from "bedform/Spatial/Renderer";

/**
 * Checks actual native constructor, registration, flags, arbitrary RGB, private audience, line byte
 * limits, changed setText, static resend, clipping omission and owned removal. No client appearance
 * or native glyph-scissor capability is inferred from these server-side observations.
 *
 * @throws { Error } If native text presentation differs from the committed line contract.
 *
 * @category Testing
 * @since 1.0.1
 */
export async function QualifyText(dimension: Dimension, player: Player): Promise<unknown>
{
    const check = (condition: unknown, message: string): void =>
    {
        if (!condition)
        {
            throw new Error(`Spatial text native: ${message}`);
        }
    };

    const records: Array<TextPrimitive> = [];
    const changes: Array<string> = [];
    const releases: Array<() => void> = [];
    let removed = 0;
    const factory = Text.CreateSurface({ Dimension: () => dimension,
        CreateText: (location, value) =>
        {
            const primitive = new TextPrimitive(location as DimensionLocation, value);
            check(primitive.text === value, "native constructor truncated or rejected an encoded line");
            const set = primitive.setText.bind(primitive);
            primitive.setText = (text): void =>
            {
                set(text);
                check(primitive.text === text, "native setText did not retain the transmitted line");
                changes.push(text as string);
            };

            records.push(primitive);
            return primitive as unknown as Text.Primitive;
        },
        AddText: (primitive) => world.primitiveShapesManager.addText(
            primitive as unknown as TextPrimitive, dimension) });
    const surface = factory.Create({ RootId: 1,
        Viewer: player,
        World: world,
        System: system,
        Native: { TextPrimitive },
        Own: (cleanup) =>
        {
            let active = true;
            const release = (): void =>
            {
                if (active)
                {
                    active = false;
                    cleanup();
                    removed++;
                }
            };

            releases.push(release);
            return release;
        } });
    const raw = (value: string): SurfaceNode => ({ Id: 3,
        Type: "#text",
        Props: {},
        Children: [],
        Hidden: false,
        Text: value });
    const commit = (
        value: string, clipped: boolean = false, color: string | null = "#19A7D3"
    ): Layout.Result =>
    {
        const text: SurfaceNode = { Id: 2,
            Type: "bedform:Text",
            Props: { Width: 100,
                Color: color ?? undefined,
                Layer: 2 },
            Children: [ raw(value) ],
            Hidden: false };
        const view: SurfaceNode = { Id: 1,
            Type: "bedform:View",
            Hidden: false,
            Props: { Dimension: dimension.id,
                Width: 200,
                Height: 100,
                Transform: { position: { x: player.location.x,
                    y: player.location.y + 2,
                    z: player.location.z + 4 },
                rotation: { x: 0,
                    y: 0,
                    z: 0,
                    w: 1 } } },
            Children: clipped ? [ { Id: 4,
                Type: "bedform:ScrollView",
                Hidden: false,
                Props: { Width: 100,
                    Height: 9 },
                Children: [ text ] } ] : [ text ] };
        const layout = Layout.Compute([ view ]);
        surface.Commit({ Revision: 1,
            Nodes: [ view ],
            Layout: layout });
        return layout;
    };

    try
    {
        const layout = commit("abc\ni");
        check(records.length === 2, "not exactly one primitive per line");
        check(records.every((text) => text.depthTest && text.useRotation && !text.backfaceVisible &&
            !text.textBackfaceVisible && text.backgroundColorOverride?.alpha === 0), "native flags");
        check(records.every((text) => text.visibleTo.length === 1 && text.visibleTo[0].id === player.id),
            "native audience");
        check(records.every((text) => text.dimension.id === dimension.id), "native dimension");
        check(Math.abs(records[0].color!.red - 0x19 / 255) < 0.0001, "native arbitrary RGB");
        for (let tick = 0; tick < 5; tick++)
        {
            await new Promise<void>((resolve) => system.runTimeout(resolve, 1));
            surface.Update();
        }

        check(changes.length === 2, "placement resend");
        commit("abc\ni");
        check(changes.length === 2, "unchanged text was sent");
        commit("xyz\ni");
        check(changes.length === 3, "changed text was not sent");
        const bytes = commit("界".repeat(100));
        check(bytes.Items.find((item) => item.Text)!.Text!.Lines.every((line) =>
            line.Encoded.length > 0), "byte-wrapped lines missing");
        commit("ordinary", false, null);
        check(Math.abs(records.at(-1)!.color!.red - 0x4D / 255) < 0.0001, "native default dark gray");
        commit("§rreset", false, "#19A7D380");
        check(Math.abs(records.at(-1)!.color!.alpha - 0x80 / 255) < 0.0001, "native explicit alpha");
        const clipped = commit("abc", true);
        check(clipped.Items.filter((item) => item.Text).every((item) =>
            item.Text!.Lines.every((line) => !Layout.TextLineVisible(item, line))), "clipping admission");
        check(removed === records.length, "clipped text remained registered");
        return { Lines: layout.Items.find((item) => item.Text)!.Text!.Lines.length,
            NativeAllocations: records.length,
            Removed: removed,
            NativeSetText: changes.length,
            ArbitraryRGB: true,
            DefaultDarkGray: true,
            ExplicitAlpha: true,
            PrivateAudience: true,
            ByteWrapped: true,
            StaticResendTicks: 5,
            Clipping: "Partially clipped lines omitted; no native scissor",
            ClientAppearance: false };
    }
    finally
    {
        surface.Dispose();
        releases.forEach((release) => release());
    }
}
