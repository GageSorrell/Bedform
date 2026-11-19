/**
 * Verifies the transactional component's layout, button states, reset
 * confirmation flow and input tracking against a recording native form
 * double, and the packaged icon artwork.
 *
 * @module bedform/Test/Transactional.test
 *
 * @file      Transactional.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native test doubles intentionally retain contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import { TransactionalIcon, TransactionalText } from "../Source/Internal/TransactionalAssets.js";
import { unzipSync, unzlibSync } from "fflate";
import { CommonResourcePack } from "../Source/Internal/CommonResourcePack.js";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const Compiled = await build({
    stdin: {
        contents: [
            "export * from \"./DDUI/CustomForm.ts\";",
            "export { ObservableDirection } from \"./DDUI/Direction.ts\";"
        ].join("\n"),
        loader: "ts",
        resolveDir: fileURLToPath(new URL("../Source/", import.meta.url))
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    external: [ "@minecraft/server", "@minecraft/server-ui" ]
});

/**
 * Supplies native-shaped observables, a native form base class that records
 * each builder call, and accessors for the component's controls.
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
                for (const callback of [ ...this.listeners ])
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
    class NativeCustomForm
    {
        calls = [] as Array<Array<any>>;
    }
    for (const name of [ "textField", "toggle", "slider", "dropdown", "image", "multiButtonRow", "button",
        "spacer", "label", "divider" ])
    {
        (NativeCustomForm.prototype as any)[name] = function(this: NativeCustomForm, ...args: Array<unknown>)
        {
            this.calls.push([ name, ...args ]);
            return this;
        };
    }

    const module = { exports: {} as any };
    runInNewContext(Compiled.outputFiles[0].text, { module,
        exports: module.exports,
        require: (name: string) => name === "@minecraft/server"
            ? { Direction: { Up: "Up",
                Down: "Down",
                North: "North",
                South: "South",
                East: "East",
                West: "West" } }
            : { CustomForm: NativeCustomForm,
                ObservableBoolean: Observable,
                ObservableNumber: Observable,
                ObservableString: Observable } });
    return { ...module.exports,
        Observable };
};

/**
 * Locates the component's controls in a form's recorded calls and reads
 * their enabled and visible states. A standalone Reset button is read into
 * the same shape as a row button.
 *
 * @category Testing
 * @since 1.0.0
 */
const Controls = (form: any) =>
{
    const of = (kind: string) => form.calls.filter((call: Array<any>) => call[0] === kind);
    const [ main, confirmation ] = of("multiButtonRow");
    const standalone = of("button")[0];
    const [ undo, redo, rowReset ] = main[1];
    const reset = rowReset ?? (standalone === undefined
        ? undefined
        : { label: standalone[1],
            onClick: standalone[2],
            options: standalone[3] });
    const [ cancel, confirm ] = confirmation?.[1] ?? [];
    const [ question, complete ] = of("label");
    const visible = {
        spacer: of("spacer")[0]?.[1].visible,
        question: question?.[2].visible,
        confirmation: confirmation?.[2].visible,
        complete: complete?.[2].visible,
        divider: of("divider")[0]?.[1].visible
    };
    return {
        undo,
        redo,
        reset,
        cancel,
        confirm,
        question,
        complete,
        main,
        confirmation,
        enabled: () => [ undo, redo, reset ].filter(Boolean)
            .map((button: any) => !button.options.disabled.getData()),
        shown: () => Object.fromEntries(Object.entries(visible)
            .map(([ key, value ]) => [ key, (value as any)?.getData() ]))
    };
};

/**
 * Copies a sandbox-realm value into this realm for structural comparison.
 *
 * @category Testing
 * @since 1.0.0
 */
const Plain = (value: unknown): unknown =>
{
    return JSON.parse(JSON.stringify(value));
};

/**
 * Ends the current synchronous turn, so the next edit begins a new step.
 *
 * @category Testing
 * @since 1.0.0
 */
const Turn = async (): Promise<void> =>
{
    await Promise.resolve();
};

const Hidden = { spacer: false,
    question: false,
    confirmation: false,
    complete: false,
    divider: false };

test("the button row and confirmation area use Common icons, translations and hidden visibility", () =>
{
    const h = Harness();
    const form = new h.CustomForm();
    assert.equal(form.transactional({ reset: true }), form);
    assert.deepEqual(form.calls.map((call: Array<any>) => call[0]),
        [ "multiButtonRow", "button", "spacer", "label", "multiButtonRow", "label", "divider" ]);
    const c = Controls(form);
    assert.equal(c.main[1].length, 2);
    const icons = [ [ c.undo, "Undo" ], [ c.redo, "Redo" ], [ c.reset, "Reset" ],
        [ c.cancel, "Cancel" ], [ c.confirm, "Confirm" ] ] as const;
    for (const [ button, name ] of icons)
    {
        assert.deepEqual(Plain(button.options.imageDetails), { imagePackId: CommonResourcePack,
            imageSrc: TransactionalIcon[name] });
        assert.deepEqual(Plain(button.label), { translate: TransactionalText[name].Key });
        assert.equal(button.options.tooltip, undefined);
    }

    assert.equal(c.cancel.options.disabled, undefined);
    assert.deepEqual(Plain(c.question[1]), { translate: TransactionalText.Question.Key });
    assert.deepEqual(Plain(c.complete[1]), { rawtext: [ { text: "§e" },
        { translate: TransactionalText.Complete.Key } ] });
    assert.deepEqual(c.shown(), Hidden);
    assert.deepEqual(c.enabled(), [ false, false, false ]);
    const plain = new h.CustomForm().transactional();
    assert.equal(plain.calls.length, 1);
    assert.equal(plain.calls[0][1].length, 2);
});

test("a compact component puts icon-only Undo, Redo and Reset in one row with their labels as tooltips", () =>
{
    const h = Harness();
    const form = new h.CustomForm().transactional({ reset: true,
        IsCompact: true });
    assert.deepEqual(form.calls.map((call: Array<any>) => call[0]),
        [ "multiButtonRow", "spacer", "label", "multiButtonRow", "label", "divider" ]);
    const c = Controls(form);
    assert.equal(c.main[1].length, 3);
    for (const [ button, name ] of [ [ c.undo, "Undo" ], [ c.redo, "Redo" ], [ c.reset, "Reset" ] ] as const)
    {
        assert.equal(button.label, "");
        assert.deepEqual(Plain(button.options.tooltip), { translate: TransactionalText[name].Key });
        assert.deepEqual(Plain(button.options.imageDetails), { imagePackId: CommonResourcePack,
            imageSrc: TransactionalIcon[name] });
    }

    assert.deepEqual(Plain(c.cancel.label), { translate: TransactionalText.Cancel.Key });
    assert.equal(c.cancel.options.tooltip, undefined);
    assert.deepEqual(c.enabled(), [ false, false, false ]);
    const plain = new h.CustomForm().transactional({ IsCompact: true });
    assert.equal(plain.calls.length, 1);
    assert.equal(plain.calls[0][1].length, 2);
    assert.equal(plain.calls[0][1][0].label, "");
});

test("undo, redo and reset are enabled only when they would change something", async () =>
{
    const h = Harness();
    const form = new h.CustomForm();
    const name = new h.Observable("Steve");
    const level = new h.Observable(3);
    form.textField("Name", name).slider("Level", level, 0, 10).transactional({ reset: true });
    const c = Controls(form);
    name.setData("Alex");
    await Turn();
    assert.deepEqual(c.enabled(), [ true, false, true ]);
    level.setData(5);
    await Turn();
    c.undo.onClick();
    assert.deepEqual([ name.getData(), level.getData() ], [ "Alex", 3 ]);
    assert.deepEqual(c.enabled(), [ true, true, true ]);
    c.undo.onClick();
    assert.equal(name.getData(), "Steve");
    assert.deepEqual(c.enabled(), [ false, true, false ]);
    c.redo.onClick();
    c.redo.onClick();
    assert.deepEqual([ name.getData(), level.getData() ], [ "Alex", 5 ]);
    assert.deepEqual(c.enabled(), [ true, false, true ]);
    c.undo.onClick();
    level.setData(7);
    await Turn();
    assert.deepEqual(c.enabled(), [ true, false, true ]);
});

test("reset asks inline, cancels, confirms as one undoable step and collapses on the next action", async () =>
{
    const h = Harness();
    const form = new h.CustomForm();
    const name = new h.Observable("Steve");
    const on = new h.Observable(false);
    form.textField("Name", name).toggle("On", on).transactional({ reset: true });
    const c = Controls(form);
    name.setData("Alex");
    await Turn();
    on.setData(true);
    await Turn();
    const asking = { spacer: true,
        question: true,
        confirmation: true,
        complete: false,
        divider: true };
    c.reset.onClick();
    assert.deepEqual(c.shown(), asking);
    c.cancel.onClick();
    assert.deepEqual(c.shown(), Hidden);
    assert.deepEqual([ name.getData(), on.getData() ], [ "Alex", true ]);
    c.reset.onClick();
    c.confirm.onClick();
    assert.deepEqual([ name.getData(), on.getData() ], [ "Steve", false ]);
    assert.deepEqual(c.shown(), { ...asking,
        question: false,
        confirmation: false,
        complete: true });
    assert.deepEqual(c.enabled(), [ true, false, false ]);
    c.undo.onClick();
    assert.deepEqual([ name.getData(), on.getData() ], [ "Alex", true ]);
    assert.deepEqual(c.shown(), Hidden);
    c.reset.onClick();
    c.confirm.onClick();
    c.undo.onClick();
    c.redo.onClick();
    assert.deepEqual([ name.getData(), on.getData() ], [ "Steve", false ]);
    assert.deepEqual(c.shown(), Hidden);
    c.reset.onClick();
    name.setData("Zed");
    assert.deepEqual(c.shown(), Hidden);
});

test("inputs added after the component are tracked, and a direction undoes back to empty", async () =>
{
    const h = Harness();
    const form = new h.CustomForm().transactional();
    const facing = new h.ObservableDirection({ _tag: "None" });
    const index = new h.Observable(0);
    form.direction("Facing", facing).dropdown("Pick", index, [ { label: "a",
        value: 0 },
    { label: "b",
        value: 1 } ]);
    const c = Controls(form);
    facing.setData("East");
    await Turn();
    index.setData(1);
    await Turn();
    c.undo.onClick();
    assert.equal(index.getData(), 0);
    c.undo.onClick();
    assert.equal(facing.getData()._tag, "None");
    const directionIndex = form.calls.find((call: Array<any>) => call[0] === "dropdown")[2];
    assert.equal(directionIndex.getData(), -1);
    assert.deepEqual(c.enabled(), [ false, true ]);
    c.redo.onClick();
    assert.equal(facing.getData().value, "East");
    assert.equal(directionIndex.getData(), 4);
});

test("a second component or invalid options are rejected", () =>
{
    const h = Harness();
    const form = new h.CustomForm().transactional();
    assert.throws(() => form.transactional({ reset: true }), /only one transactional component/);
    for (const options of [ { chunkWindow: -1 }, { chunkWindow: Number.POSITIVE_INFINITY },
        { historyLimit: 0 }, { historyLimit: 2.5 } ])
    {
        assert.throws(() => new h.CustomForm().transactional(options), { name: "RangeError" });
    }
});

test("packaged Common icons are hard-edged and use the specified glyph and shadow colours", async () =>
{
    const addon = unzipSync(await readFile(new URL("../Asset/bedform-common.mcaddon", import.meta.url)));
    const resource = unzipSync(addon["bedform-common-rp.mcpack"]);
    const hex = (red: number, green: number, blue: number) =>
        [ red, green, blue ].map((value: number) => value.toString(16).padStart(2, "0")).join("");
    for (const name of Object.keys(TransactionalIcon) as Array<keyof typeof TransactionalIcon>)
    {
        const png = Buffer.from(resource[TransactionalIcon[name]] ?? []);
        assert.ok(png.length > 0, name);
        assert.equal(png.readUInt32BE(16), 64);
        assert.equal(png.readUInt32BE(20), 64);
        assert.deepEqual([ png[24], png[25] ], [ 8, 6 ]);
        const pixels = unzlibSync(png.subarray(41, 41 + png.readUInt32BE(33)));
        assert.equal(pixels.length, 64 * (64 * 4 + 1));
        const alpha = new Set<number>();
        const colors = new Set<string>();
        for (let y = 0; y < 64; y++)
        {
            for (let x = 0; x < 64; x++)
            {
                const index = y * 257 + 1 + x * 4;
                alpha.add(pixels[index + 3]);
                if (pixels[index + 3] === 255)
                {
                    colors.add(hex(pixels[index], pixels[index + 1], pixels[index + 2]));
                }
            }
        }

        assert.deepEqual([ ...alpha ].sort((left: number, right: number) => left - right), [ 0, 255 ], name);
        assert.deepEqual([ ...colors ].sort(), name === "Confirm"
            ? [ "153f15", "55ff55" ] : [ "3f3f3f", "ffffff" ], name);
    }
});
