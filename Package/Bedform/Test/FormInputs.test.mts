/**
 * Verifies the per-form input registry, CustomForm input registration and the
 * direction adapter against a recording native form double.
 *
 * @module bedform/Test/FormInputs.test
 *
 * @file      FormInputs.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native test doubles intentionally retain contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as HashMap from "@bedform/effect/HashMap";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";

const Compiled = await build({
    stdin: {
        contents: [
            "export * from \"./DDUI/CustomForm.ts\";",
            "export { ObservableDirection } from \"./DDUI/Direction.ts\";",
            "export * as FormInputs from \"./Internal/FormInputs.ts\";"
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
 * Supplies native-shaped observables and a native form base class that
 * records each builder call.
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
        calls = [] as Array<Array<unknown>>;
        private record(name: string, args: Array<unknown>)
        {
            this.calls.push([ name, ...args ]);
            return this;
        }
        textField(...args: Array<unknown>)
        {
            return this.record("textField", args);
        }
        toggle(...args: Array<unknown>)
        {
            return this.record("toggle", args);
        }
        slider(...args: Array<unknown>)
        {
            return this.record("slider", args);
        }
        dropdown(...args: Array<unknown>)
        {
            if (args[0] === "Bad")
            {
                throw new Error("native rejection");
            }

            return this.record("dropdown", args);
        }
        image(...args: Array<unknown>)
        {
            return this.record("image", args);
        }
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
 * Collects every input reported for a form, in report order.
 *
 * @category Testing
 * @since 1.0.0
 */
const Observed = (h: any, form: object): Array<any> =>
{
    const inputs = [] as Array<any>;
    h.FormInputs.ObserveInputs(form, (input: unknown) => inputs.push(input));
    return inputs;
};

test("each native input builder delegates, registers its value observable and chains", () =>
{
    const h = Harness();
    const form = new h.CustomForm();
    const text = new h.Observable("abc");
    const toggled = new h.Observable(true);
    const value = new h.Observable(4);
    const index = new h.Observable(1);
    const min = new h.Observable(0);
    assert.equal(form.textField("Name", text, { tooltip: "t" }), form);
    assert.equal(form.toggle("On", toggled), form);
    assert.equal(form.slider("Level", value, min, 10, { step: 2 }), form);
    assert.equal(form.dropdown("Pick", index, [ { label: "a",
        value: 0 } ]), form);
    assert.deepEqual(form.calls.map((call: Array<unknown>) => call[0]),
        [ "textField", "toggle", "slider", "dropdown" ]);
    assert.equal(form.calls[0][2], text);
    assert.deepEqual(form.calls[2].slice(1), [ "Level", value, min, 10, { step: 2 } ]);
    const inputs = Observed(h, form);
    assert.deepEqual(inputs.map((input) => input.read()), [ "abc", true, 4, 1 ]);
    inputs[0].write("xyz");
    assert.equal(text.getData(), "xyz");
    inputs[2].write(8);
    assert.equal(value.getData(), 8);
    assert.throws(() => inputs[1].write("yes"), { name: "TypeError" });
    assert.throws(() => inputs[3].write(undefined), { name: "TypeError" });
    assert.throws(() => form.dropdown("Bad", new h.Observable(0), [ { label: "a",
        value: 0 } ]), /native rejection/);
    assert.equal(Observed(h, form).length, 4);
});

test("text dropdowns bind original labels as values and follow external changes", () =>
{
    const h = Harness();
    const form = new h.CustomForm();
    const raw = { rawtext: [ { text: "Second" } ] };
    const choices = [ "First", raw ];
    const value = new h.ObservableValue(raw);
    const options = { tooltip: "Choose" };
    assert.equal(form.dropdown("Text", value, choices, options), form);
    const [ , , index, items, passedOptions ] = form.calls[0];
    assert.equal(index.getData(), 1);
    assert.equal(items[1].label, raw);
    assert.equal(passedOptions, options);
    choices.reverse();
    index.setData(0);
    assert.equal(value.getData(), "First");
    value.setData(raw);
    assert.equal(index.getData(), 1);
    value.setData("Missing");
    assert.equal(index.getData(), -1);
    for (const invalid of [ 9, -2, 0.5, NaN ])
    {
        index.setData(invalid);
        assert.equal(value.getData(), "Missing");
        assert.equal(index.getData(), -1);
    }

    const input = Observed(h, form)[0];
    const missing = input.read();
    value.setData(raw);
    const second = input.read();
    input.write(missing);
    assert.equal(value.getData(), "Missing");
    input.write(second);
    assert.equal(value.getData(), raw);
    assert.equal(index.getData(), 1);
});

test("map dropdowns preserve generic values, undefined and history subscriptions", () =>
{
    const h = Harness();
    const form = new h.CustomForm();
    const object = { id: 1 };
    const choices = new Map<unknown, unknown>([ [ "Object", object ], [ "Empty", undefined ] ]);
    const value = new h.ObservableValue(object);
    form.dropdown("Map", value, choices);
    const index = form.calls[0][2];
    const input = Observed(h, form)[0];
    const original = input.read();
    const seen = [] as Array<unknown>;
    const stop = input.subscribe((data: unknown) => seen.push(data));
    index.setData(1);
    assert.equal(value.getData(), undefined);
    assert.equal(index.getData(), 1);
    input.write(original);
    assert.equal(value.getData(), object);
    assert.equal(index.getData(), 0);
    assert.equal(seen.length, 2);
    stop();
    index.setData(1);
    assert.equal(seen.length, 2);
    assert.throws(() => input.write(999), { name: "TypeError" });
    const empty = new h.CustomForm();
    empty.dropdown("Empty", new h.ObservableValue(object), new Map());
    assert.equal(empty.calls[0][2].getData(), -1);
});

test("HashMap choices use entry labels and values in iteration order", () =>
{
    const h = Harness();
    const form = new h.CustomForm();
    const choices = HashMap.make([ "One", 10 ], [ "Two", 20 ]);
    const entries = Array.from(choices);
    const value = new h.ObservableValue(entries[0][1]);
    form.dropdown("HashMap", value, choices);
    const [ , , index, items ] = form.calls[0];
    assert.deepEqual(Array.from(items, (item: any) => item.label), entries.map(([ label ]) => label));
    index.setData(1);
    assert.equal(value.getData(), entries[1][1]);
});

test("observers see existing inputs, then later ones, until they unsubscribe", () =>
{
    const h = Harness();
    const form = new h.CustomForm();
    const other = new h.CustomForm();
    form.toggle("First", new h.Observable(false));
    const seen = [] as Array<unknown>;
    const stop = h.FormInputs.ObserveInputs(form, (input: any) => seen.push(input.read()));
    assert.deepEqual(seen, [ false ]);
    form.textField("Second", new h.Observable("b"));
    other.textField("Elsewhere", new h.Observable("c"));
    assert.deepEqual(seen, [ false, "b" ]);
    stop();
    form.slider("Third", new h.Observable(3), 0, 5);
    assert.deepEqual(seen, [ false, "b" ]);
    assert.equal(Observed(h, form).length, 3);
    const input = Observed(h, form)[0];
    h.FormInputs.RegisterInput(form, input);
    assert.equal(Observed(h, form).length, 3);
});

test("untracked bodies register nothing, return their result and survive throws", () =>
{
    const h = Harness();
    const form = new h.CustomForm();
    assert.equal(h.FormInputs.Untracked(form, () =>
    {
        form.toggle("Hidden", new h.Observable(true));
        return 7;
    }), 7);
    assert.throws(() => h.FormInputs.Untracked(form, () =>
    {
        throw new Error("body");
    }), /body/);
    form.toggle("Shown", new h.Observable(false));
    assert.deepEqual(Observed(h, form).map((input) => input.read()), [ false ]);
});

test("native subscriptions forward values and unsubscribe only their own callback", () =>
{
    const h = Harness();
    const observable = new h.Observable("a");
    const input = h.FormInputs.ObservableInput(observable);
    const first = [] as Array<unknown>;
    const second = [] as Array<unknown>;
    const stopFirst = input.subscribe((value: unknown) => first.push(value));
    input.subscribe((value: unknown) => second.push(value));
    observable.setData("b");
    stopFirst();
    observable.setData("c");
    assert.deepEqual(first, [ "b" ]);
    assert.deepEqual(second, [ "b", "c" ]);
});

test("direction registers its direction observable rather than its internal index", () =>
{
    const h = Harness();
    const form = new h.CustomForm();
    const value = new h.ObservableDirection({ _tag: "None" });
    assert.equal(form.direction("Facing", value), form);
    assert.deepEqual(form.calls.map((call: Array<unknown>) => call[0]), [ "image", "dropdown" ]);
    const inputs = Observed(h, form);
    assert.equal(inputs.length, 1);
    const [ input ] = inputs;
    assert.equal(input.read(), undefined);
    const seen = [] as Array<unknown>;
    const stop = input.subscribe((snapshot: unknown) => seen.push(snapshot));
    const index = form.calls[1][2];
    index.setData(4);
    assert.equal(input.read(), "East");
    input.write(undefined);
    assert.equal(index.getData(), -1);
    input.write("North");
    assert.equal(index.getData(), 2);
    assert.throws(() => input.write("Sideways"), { name: "TypeError" });
    assert.throws(() => input.write(3), { name: "TypeError" });
    stop();
    value.clear();
    assert.deepEqual(seen, [ "East", undefined, "North" ]);
    assert.equal(value.getData()._tag, "None");
});
