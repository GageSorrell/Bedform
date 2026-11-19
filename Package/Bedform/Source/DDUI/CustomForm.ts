/**
 * This module provides a subclass of `@minecraft/server-ui`'s `CustomForm`,
 * with builder methods for the DDUI components provided by `bedform/DDUI`.
 *
 * @module bedform/DDUI/CustomForm
 *
 * @file      CustomForm.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Direction from "./Direction.js";
import * as Transactional from "./Transactional.js";
import {
    type DropdownItemData,
    type DropdownOptions,
    CustomForm as NativeCustomForm,
    type ObservableBoolean,
    ObservableNumber,
    type ObservableString,
    type SliderOptions,
    type TextFieldOptions,
    type ToggleOptions
} from "@minecraft/server-ui";
import { ObservableInput, RegisterInput } from "../Internal/FormInputs.js";
import type { HashMap } from "@bedform/effect/HashMap";
import type { InputSnapshot } from "../Internal/FormInputs.js";
import type { Text } from "./Utility.js";

/**
 * A writable observable accepted by value-based dropdowns, including native
 * observables when their data type matches the choices.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface DropdownObservable<A>
{
    getData(): A;
    setData(data: A): void;
    subscribe(callback: (data: A) => void): (data: A) => void;
    unsubscribe(callback: (data: A) => void): boolean;
}

/**
 * Holds an arbitrary dropdown value. Changes use Object.is equality; object
 * values and text objects retain their original identities.
 *
 * @category Model
 * @since 1.0.0
 */
export class ObservableValue<A> implements DropdownObservable<A>
{
    private Data: A;
    private readonly Listeners: Set<(data: A) => void> = new Set();

    public constructor(data: A)
    {
        this.Data = data;
    }

    public getData(): A
    {
        return this.Data;
    }

    public setData(data: A): void
    {
        if (!Object.is(this.Data, data))
        {
            this.Data = data;
            for (const listener of [ ...this.Listeners ])
            {
                listener(data);
            }
        }
    }

    public subscribe(callback: (data: A) => void): (data: A) => void
    {
        this.Listeners.add(callback);
        return callback;
    }

    public unsubscribe(callback: (data: A) => void): boolean
    {
        return this.Listeners.delete(callback);
    }
}

/**
 * A subclass of `CustomForm`, equipped with builder methods for the
 * DDUI components provided by `bedform/DDUI`. Its text fields, toggles,
 * sliders and dropdowns register their bound observables, so components
 * such as undo and redo can observe and restore them.
 *
 * @category Constructor
 * @since 1.0.0
 */
export class CustomForm extends NativeCustomForm
{
    /* eslint-disable @typescript-eslint/typedef */

    /** {@inheritDoc Direction!direction} */
    public direction = Direction.direction;

    /** {@inheritDoc Transactional!transactional} */
    public transactional = Transactional.transactional;

    /* eslint-enable @typescript-eslint/typedef */

    /**
     * Adds a native text field and registers its bound text observable.
     *
     * @category Builder
     * @since 1.0.0
     */
    public override textField(label: Text, text: ObservableString, options?: TextFieldOptions): this
    {
        super.textField(label, text, options);
        RegisterInput(this, ObservableInput(text));
        return this;
    }

    /**
     * Adds a native toggle and registers its bound boolean observable.
     *
     * @category Builder
     * @since 1.0.0
     */
    public override toggle(label: Text, toggled: ObservableBoolean, options?: ToggleOptions): this
    {
        super.toggle(label, toggled, options);
        RegisterInput(this, ObservableInput(toggled));
        return this;
    }

    /**
     * Adds a native slider and registers its bound value observable. Observable
     * bounds are not tracked.
     *
     * @category Builder
     * @since 1.0.0
     */
    public override slider(
        label: Text,
        value: ObservableNumber,
        min: number | ObservableNumber,
        max: number | ObservableNumber,
        options?: SliderOptions
    ): this
    {
        super.slider(label, value, min, max, options);
        RegisterInput(this, ObservableInput(value));
        return this;
    }

    /**
     * Adds a native dropdown and registers its bound index observable.
     *
     * @category Builder
     * @since 1.0.0
     */
    public override dropdown(
        label: Text,
        value: ObservableNumber,
        items: Array<DropdownItemData>,
        options?: DropdownOptions
    ): this;

    /**
     * Uses each text choice as both its label and its observable value.
     * Text objects are compared by identity. Values absent from the choices
     * have no selection; choices are copied when the control is added.
     *
     * @category Builder
     * @since 1.0.0
     */
    public override dropdown<A extends Text>(
        label: Text,
        value: DropdownObservable<A>,
        items: ReadonlyArray<A>,
        options?: DropdownOptions
    ): this;

    /**
     * Uses map keys as labels and their associated values as observable data.
     * Entries are copied in iteration order. Values use Object.is equality;
     * duplicate values select their first entry on external updates.
     * Values absent from the choices have no selection.
     *
     * @category Builder
     * @since 1.0.0
     */
    public override dropdown<A>(
        label: Text,
        value: DropdownObservable<A>,
        items: ReadonlyMap<Text, A> | HashMap<Text, A>,
        options?: DropdownOptions
    ): this;

    public override dropdown(
        label: Text,
        value: ObservableNumber | DropdownObservable<never>,
        items: ReadonlyArray<DropdownItemData | Text> | ReadonlyMap<Text, unknown> | HashMap<Text, unknown>,
        options?: DropdownOptions
    ): this
    {
        if (Array.isArray(items) && value instanceof ObservableNumber && items.every(
            (item: DropdownItemData | Text): boolean => typeof item === "object" &&
                "label" in item && "value" in item && typeof item.value === "number"
        ))
        {
            super.dropdown(label, value, items as Array<DropdownItemData>, options);
            RegisterInput(this, ObservableInput(value));
            return this;
        }

        const observable = value as DropdownObservable<unknown>;
        const entries: Array<readonly [Text, unknown]> = Array.isArray(items)
            ? (items as ReadonlyArray<Text>).map((text: Text): readonly [Text, Text] => [ text, text ])
            : Array.from(items as Iterable<readonly [Text, unknown]>);
        const selected = (): number => entries.findIndex(
            (entry: readonly [Text, unknown]): boolean => Object.is(entry[1], observable.getData())
        );
        const index = new ObservableNumber(selected(), { clientWritable: true });
        super.dropdown(label, index, entries.map(
            (entry: readonly [Text, unknown], position: number): DropdownItemData => ({
                label: entry[0],
                value: position
            })
        ), options);
        let updating = false;
        index.subscribe((position: number): void =>
        {
            if (updating)
            {
                return;
            }

            if (Number.isInteger(position) && position >= 0 && position < entries.length)
            {
                observable.setData(entries[position][1]);
            }
            else
            {
                index.setData(selected());
            }
        });
        observable.subscribe((): void =>
        {
            updating = true;
            try
            {
                index.setData(selected());
            }
            finally
            {
                updating = false;
            }
        });
        // History stores stable numeric tokens, including values outside the choices.
        const snapshots: Array<unknown> = [];
        const snapshot = (data: unknown): number =>
        {
            const existing = snapshots.findIndex((item: unknown): boolean => Object.is(item, data));
            return existing < 0 ? snapshots.push(data) - 1 : existing;
        };

        RegisterInput(this, {
            read: (): InputSnapshot => snapshot(observable.getData()),
            subscribe: (listener: (data: InputSnapshot) => void): (() => void) =>
            {
                const callback = observable.subscribe((data: unknown): void => listener(snapshot(data)));
                return (): void =>
                {
                    observable.unsubscribe(callback);
                };
            },
            write: (data: InputSnapshot): void =>
            {
                if (typeof data !== "number" || !Number.isInteger(data) ||
                    data < 0 || data >= snapshots.length)
                {
                    throw new TypeError("Invalid dropdown history snapshot.");
                }

                observable.setData(snapshots[data]);
            }
        });
        return this;
    }
}
