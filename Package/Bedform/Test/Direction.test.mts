/**
 * Verifies native direction dropdown binding and packaged pixel-art coverage.
 *
 * @module bedform/Test/Direction.test
 *
 * @file      Direction.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native test doubles intentionally retain contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import { DirectionAxes, DirectionPreviewPath, DirectionResourcePack } from
    "../Source/Internal/DirectionPreview.js";
import { unzipSync, unzlibSync } from "fflate";
import { DirectionPreview } from "../../../Addon/BedformCommon/Tool/DirectionPreview.mjs";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const Compiled = await build({
    entryPoints: [ fileURLToPath(new URL("../Source/DDUI/Direction.ts", import.meta.url)) ],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    external: [ "@minecraft/server", "@minecraft/server-ui" ]
});
const Directions = { Up: "Up",
    Down: "Down",
    North: "North",
    South: "South",
    East: "East",
    West: "West" };

/**
 * Supplies native-shaped observables and a form that records its builder arguments.
 *
 * @category Testing
 * @since 1.0.0
 */
const Harness = () =>
{
    class Observable
    {
        data: unknown;
        listeners = new Set<(data: unknown) => void>();
        constructor(data: unknown)
        {
            this.data = data;
        }
        getData()
        {
            return this.data;
        }
        setData(data: unknown)
        {
            if (data !== this.data)
            {
                this.data = data;
                for (const callback of this.listeners)
                {
                    callback(data);
                }
            }
        }
        subscribe(callback: (data: unknown) => void)
        {
            this.listeners.add(callback);
            return callback;
        }
        unsubscribe(callback: (data: unknown) => void)
        {
            return this.listeners.delete(callback);
        }
    }
    const module = { exports: {} as any };
    runInNewContext(Compiled.outputFiles[0].text, { module,
        exports: module.exports,
        require: (name: string) => name === "@minecraft/server" ? { Direction: Directions }
            : { ObservableNumber: Observable,
                ObservableString: Observable } });
    const calls = [] as Array<any>;
    const form = { image: (...args: Array<unknown>) => calls.push([ "image", ...args ]),
        dropdown: (...args: Array<unknown>) => calls.push([ "dropdown", ...args ]) };
    const value = new module.exports.ObservableDirection({ _tag: "Some",
        value: "West" });
    return { ...module.exports,
        calls,
        form,
        value };
};

test("native selection uses item values for reordered subsets and follows external changes", () =>
{
    const h = Harness();
    assert.equal(h.direction.call(h.form, "Facing", h.value, [ { label: "West" }, { label: "Up" } ]), h.form);
    const [ , image, pack ] = h.calls[0];
    const [ , , index, items ] = h.calls[1];
    assert.equal(pack, DirectionResourcePack);
    assert.equal(index.getData(), 5);
    assert.deepEqual(Array.from(items, (item: any) => item.value), [ 5, 0 ]);
    assert.match(image.getData(), /xyz\/dim_33_6.png$/);
    index.setData(0);
    assert.equal(h.value.getDataUnsafe(), "Up");
    assert.match(image.getData(), /_1.png$/);
    h.value.setData("West");
    assert.equal(index.getData(), 5);
    h.value.clear();
    assert.equal(index.getData(), -1);
    assert.match(image.getData(), /_0.png$/);
    assert.throws(() => h.value.getDataUnsafe(), /empty/);
    h.value.setData("East");
    assert.equal(index.getData(), -1);
    index.setData(4);
    assert.equal(index.getData(), -1);
    assert.equal(h.value.getDataUnsafe(), "East");
});

test("preview options, visibility, label composition and invalid items are handled", () =>
{
    const h = Harness();
    h.direction.call(h.form, "Facing", h.value, undefined, { imagePreview: false });
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0][0], "dropdown");
    h.calls.length = 0;
    const visible = {};
    h.direction.call(h.form, "Facing", h.value, [ { label: "West",
        description: "west detail" } ], {
        visible,
        choiceLabelStyle: { main: "xyz",
            prefix: undefined,
            suffix: undefined },
        imagePreview: { imagePosition: "after",
            showAxisLabels: "localized",
            excludedValuesStyle: false,
            tooltip: "preview" }
    });
    assert.equal(h.calls[0][0], "dropdown");
    assert.equal(JSON.stringify(h.calls[0][3][0].label), "{\"rawtext\":[{\"text\":\"-X\"}]}");
    assert.equal(h.calls[0][3][0].description, "west detail");
    assert.match(h.calls[1][1].getData(), /localized\/hide_32_6.png$/);
    assert.equal(h.calls[1][3].visible, visible);
    assert.equal(h.calls[1][3].tooltip, "preview");
    for (const items of [ [], [ { label: "bad" } ], [ { label: "Up" }, { label: "Up" } ] ])
    {
        assert.throws(() => h.direction.call(h.form, "Facing", h.value, items), /distinct valid directions/);
    }

    h.calls.length = 0;
    h.direction.call(h.form, "Facing", h.value, undefined, { imagePreview: { showAxisLabels: false } });
    assert.match(h.calls[0][1].getData(), /none\/show_63_6.png$/);
    const labels = h.calls[1][3][0].label.rawtext;
    assert.equal(labels[2].translate, "bedform.direction.up");
    assert.equal(labels[4].text, "+Y");
});

test("observable subscription replacement and unsubscription leave no duplicate callback", () =>
{
    const h = Harness();
    let calls = 0;
    const callback = () => calls++;
    h.value.subscribe(callback);
    h.value.subscribe(callback);
    h.value.setData("North");
    assert.equal(calls, 1);
    assert.equal(h.value.unsubscribe(callback), true);
    assert.equal(h.value.unsubscribe(callback), false);
    h.value.clear();
    assert.equal(calls, 1);
});

test("common archive supplies every runtime path with small lossless pixel artwork", async () =>
{
    const addon = unzipSync(await readFile(new URL("../Asset/bedform-common.mcaddon", import.meta.url)));
    const resource = unzipSync(addon["bedform-common-rp.mcpack"]);
    const paths = new Set<string>();
    for (const labels of [ "xyz", "localized", undefined ] as const)
    {
        for (let mask = 1; mask < 64; mask++)
        {
            for (let selected = -1; selected < 6; selected++)
            {
                if (selected >= 0 && !(mask & (1 << selected)))
                {
                    continue;
                }

                for (const excluded of [ true, false, "dim" ] as const)
                {
                    const path = DirectionPreviewPath(selected, mask, labels, excluded);
                    assert.ok(resource[path], path);
                    paths.add(path);
                }
            }
        }
    }

    assert.equal(paths.size, 1509);
    const size = Array.from(paths).reduce((sum, path) => sum + resource[path].length, 0);
    assert.ok(size < 1500000, `Preview bytes: ${size}`);
    const png = DirectionPreview(4, 63, "xyz", true);
    assert.equal(png.readUInt32BE(16), 96);
    assert.equal(png.readUInt32BE(20), 96);
    const length = png.readUInt32BE(33);
    const pixels = unzlibSync(png.subarray(41, 41 + length));
    assert.equal(pixels.length, 96 * (96 * 4 + 1));
    const alpha = new Set<number>();
    for (let y = 0; y < 96; y++)
    {
        for (let x = 0; x < 96; x++)
        {
            alpha.add(pixels[y * 385 + 1 + x * 4 + 3]);
        }
    }

    assert.deepEqual([ ...alpha ].sort(), [ 0, 255 ]);
    assert.deepEqual(DirectionAxes, [ "+Y", "-Y", "-Z", "+Z", "+X", "-X" ]);
});
