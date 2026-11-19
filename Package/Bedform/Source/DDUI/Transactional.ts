/**
 * Undo, redo and optional reset buttons for a CustomForm, recording edits to
 * the form's inputs in chunks so one undo reverses one meaningful edit.
 *
 * @module bedform/DDUI/Transactional
 *
 * @file      Transactional.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as CustomForm from "./CustomForm.js";
import { type ButtonData, ObservableBoolean, type UIRawMessage } from "@minecraft/server-ui";
import { ObserveInputs, type TrackedInput } from "../Internal/FormInputs.js";
import { TransactionalIcon, TransactionalText } from "../Internal/TransactionalAssets.js";
import { CommonResourcePack } from "../Internal/CommonResourcePack.js";
import { TransactionHistory } from "../Internal/TransactionHistory.js";

/**
 * Configures the transactional component. `reset` adds a Reset button with an
 * inline confirmation and defaults to false. `IsCompact` shows Undo, Redo and
 * Reset as icon-only buttons in one row, with their labels as tooltips, and
 * defaults to false. `chunkWindow` is the milliseconds of inactivity that end
 * an undo step and defaults to 1000. `historyLimit` is the most undo steps kept
 * and defaults to 100.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface TransactionalOptions
{
    readonly reset?: boolean;
    readonly IsCompact?: boolean;
    readonly chunkWindow?: number;
    readonly historyLimit?: number;
}

const Forms: WeakSet<object> = new WeakSet();

/**
 * A button showing translated text beside a Bedform Common icon. A compact
 * button shows only the icon and moves the text into its tooltip.
 *
 * @category Builder
 * @since 1.0.0
 */
const Button = (
    label: UIRawMessage,
    icon: string,
    onClick: () => void,
    disabled?: ObservableBoolean,
    compact: boolean = false
): ButtonData =>
{
    return {
        label: compact ? "" : label,
        onClick,
        options: {
            ...disabled === undefined ? {} : { disabled },
            ...compact ? { tooltip: label } : {},
            imageDetails: { imagePackId: CommonResourcePack,
                imageSrc: icon }
        }
    };
};

/**
 * Adds a row of Undo and Redo buttons, and a Reset button when `reset` is set,
 * that act on every text field, toggle, slider, dropdown and direction of the
 * form, including inputs added after this component. Reset follows the row on
 * its own; with `IsCompact`, all three share the row as icon-only buttons whose
 * tooltips carry their labels. Undo and Redo are
 * disabled when there is nothing to undo or redo, and Reset when every input
 * holds the value it had when added. Reset asks for confirmation inline, below
 * the row; a confirmed reset is one undoable step and leaves "Reset complete!"
 * shown until the next edit, undo or redo. Bedform Common supplies the icons
 * and text.
 *
 * @throws { Error } If the form already has a transactional component.
 * @throws { RangeError } If `chunkWindow` is negative or not finite, or
 * `historyLimit` is not a positive integer.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function transactional(
    this: CustomForm.CustomForm,
    options?: TransactionalOptions
): CustomForm.CustomForm
{
    if (Forms.has(this))
    {
        throw new Error("A CustomForm can have only one transactional component.");
    }

    const History = new TransactionHistory({
        ...options?.chunkWindow === undefined ? {} : { chunkWindow: options.chunkWindow },
        ...options?.historyLimit === undefined ? {} : { historyLimit: options.historyLimit }
    });
    Forms.add(this);
    const UndoDisabled = new ObservableBoolean(true);
    const RedoDisabled = new ObservableBoolean(true);
    const ResetDisabled = new ObservableBoolean(true);
    const Open = new ObservableBoolean(false);
    const Asking = new ObservableBoolean(false);
    const Done = new ObservableBoolean(false);
    const Text = (text: { readonly Key: string }): UIRawMessage => ({ translate: text.Key });
    const Update = (): void =>
    {
        UndoDisabled.setData(!History.canUndo);
        RedoDisabled.setData(!History.canRedo);
        ResetDisabled.setData(!History.canReset);
    };

    const Collapse = (): void =>
    {
        Open.setData(false);
        Asking.setData(false);
        Done.setData(false);
    };

    History.subscribe((event: TransactionHistory.Event) =>
    {
        Update();
        if (event !== "Reset")
        {
            Collapse();
        }
    });
    const Compact = options?.IsCompact === true;
    const Row = [
        Button(Text(TransactionalText.Undo), TransactionalIcon.Undo, () => History.undo(), UndoDisabled,
            Compact),
        Button(Text(TransactionalText.Redo), TransactionalIcon.Redo, () => History.redo(), RedoDisabled,
            Compact)
    ];
    const Reset = Button(Text(TransactionalText.Reset), TransactionalIcon.Reset, () =>
    {
        History.seal();
        Open.setData(true);
        Asking.setData(true);
        Done.setData(false);
    }, ResetDisabled, Compact);
    if (options?.reset === true && Compact)
    {
        Row.push(Reset);
    }

    this.multiButtonRow(Row);
    if (options?.reset === true && !Compact)
    {
        this.button(Reset.label, Reset.onClick, Reset.options);
    }

    if (options?.reset === true)
    {
        this.spacer({ visible: Open });
        this.label(Text(TransactionalText.Question), { visible: Asking });
        this.multiButtonRow([
            Button(Text(TransactionalText.Cancel), TransactionalIcon.Cancel, Collapse),
            Button(Text(TransactionalText.Confirm), TransactionalIcon.Confirm, () =>
            {
                History.reset();
                Asking.setData(false);
                Done.setData(true);
            })
        ], { visible: Asking });
        this.label({ rawtext: [ { text: "§e" }, Text(TransactionalText.Complete) ] }, { visible: Done });
        this.divider({ visible: Open });
    }

    ObserveInputs(this, (input: TrackedInput) =>
    {
        History.track(input);
        Update();
    });
    Update();
    return this;
}
