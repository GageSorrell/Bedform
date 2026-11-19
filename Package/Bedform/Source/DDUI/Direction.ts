/**
 * Native direction dropdowns with contextual labels and pixelated signed-axis previews.
 *
 * @module bedform/DDUI/Direction
 *
 * @file      Direction.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as CustomForm from "./CustomForm.js";
import { DirectionAxes, DirectionPreviewPath, DirectionResourcePack } from "../Internal/DirectionPreview.js";
import {
    type DropdownItemData,
    type DropdownOptions,
    ObservableNumber,
    type ObservableOptions,
    ObservableString,
    type UIRawMessage
} from "@minecraft/server-ui";
import { type InputSnapshot, RegisterInput, type TrackedInput, Untracked } from "../Internal/FormInputs.js";
import { Option, Struct } from "@bedform/effect";
import type { RelativePosition, Text } from "./Utility.js";
import { Direction } from "@minecraft/server";

export namespace DirectionOptions
{
    /**
     * Signed XYZ labels or English direction names in the preview. True uses XYZ;
     * false hides labels. Defaults to XYZ. Preview names use the en_US artwork.
     *
     * @category Configuration
     * @since 1.0.0
     */
    export type AxisLabels = boolean | "xyz" | "localized";

    /**
     * Label style without boolean convenience values.
     *
     * @category Configuration
     * @since 1.0.0
     */
    export type ResolvedAxisLabels = Extract<AxisLabels, string>;

    /**
     * True shows all axes, false hides excluded choices, and dim darkens and
     * desaturates axes excluded by the component's items argument. Defaults to dim.
     *
     * @category Configuration
     * @since 1.0.0
     */
    export type ExcludedValuesStyle = boolean | "dim";

    /**
     * Configures the optional signed-axis image beside the direction dropdown.
     *
     * @category Configuration
     * @since 1.0.0
     */
    export interface ImagePreviewOptions
    {
        readonly tooltip?: Text;
        readonly displayImage?: boolean;
        readonly showAxisLabels?: AxisLabels;
        readonly imagePosition?: RelativePosition;
        readonly excludedValuesStyle?: ExcludedValuesStyle;
    }

    /**
     * Signed axes, localized direction names, or arrow glyphs preceding a choice.
     * North and South use diagonal arrows to suggest depth.
     *
     * @category Configuration
     * @since 1.0.0
     */
    export type PrefixLabelStyle = ResolvedAxisLabels | "arrow";

    /**
     * Main label with optional space-separated prefix and parenthesized suffix.
     * Defaults to localized names, arrow prefixes, and XYZ suffixes.
     *
     * @category Configuration
     * @since 1.0.0
     */
    export interface ChoiceLabel
    {
        readonly main?: ResolvedAxisLabels;
        readonly prefix?: PrefixLabelStyle | undefined;
        readonly suffix?: ResolvedAxisLabels | undefined;
    }

    /**
     * A main label style with arrow prefix, or individually configured label parts.
     * Explicit undefined omits a prefix or suffix in the object form.
     *
     * @category Configuration
     * @since 1.0.0
     */
    export type ChoiceLabelStyle = ResolvedAxisLabels | ChoiceLabel;
}

/**
 * Configures the native direction dropdown and its optional preview.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface DirectionOptions extends DropdownOptions
{
    readonly choiceLabelStyle?: DirectionOptions.ChoiceLabelStyle;

    /**
     * False omits the preview; true or omission uses the default preview settings.
     *
     * @category Configuration
     * @since 1.0.0
     */
    readonly imagePreview?: boolean | DirectionOptions.ImagePreviewOptions;
}

const Directions = Object.freeze([
    Direction.Up, Direction.Down, Direction.North, Direction.South, Direction.East, Direction.West
] as const);
const Arrows = Object.freeze([ "\u2191", "\u2193", "\u2197", "\u2199", "\u2192", "\u2190" ] as const);

/**
 * Formats a native choice label, preserving client-side text localization.
 *
 * @category Formatting
 * @since 1.0.0
 */
const ChoiceLabel = (index: number, style?: DirectionOptions.ChoiceLabelStyle): UIRawMessage =>
{
    const resolved = typeof style === "string"
        ? { main: style,
            prefix: "arrow" as const,
            suffix: undefined }
        : { main: "localized" as const,
            prefix: "arrow" as const,
            suffix: "xyz" as const,
            ...style };
    const part = (format: DirectionOptions.PrefixLabelStyle): UIRawMessage =>
        format === "localized"
            ? { translate: `bedform.direction.${Directions[index].toLowerCase()}` }
            : { text: format === "arrow" ? Arrows[index] : DirectionAxes[index] };
    return { rawtext: [
        ...resolved.prefix === undefined ? [] : [ part(resolved.prefix), { text: " " } ],
        part(resolved.main),
        ...resolved.suffix === undefined ? [] : [ { text: " (" }, part(resolved.suffix), { text: ")" } ]
    ] };
};

/**
 * A selectable native direction and optional descriptive text.
 *
 * @category Model
 * @since 1.0.0
 */
export interface DirectionItemData
{
    readonly description?: Text;
    readonly label: Direction;
}

/**
 * A direction observable whose empty state is represented by Option.none.
 *
 * @category Observable
 * @since 1.0.0
 */
export class ObservableDirection
{
    private readonly NoDirection: "NO_DIRECTION" = "NO_DIRECTION" as const;
    private Inner: ObservableString;
    private Callbacks: Map<(Self: Option.Option<Direction>) => void, (Self: string) => void> = new Map();

    public constructor(data: Option.Option<Direction>, options?: ObservableOptions)
    {
        this.Inner = new ObservableString(Option.getOrElse(data, () => this.NoDirection), options);
    }

    public getData(): Option.Option<Direction>
    {
        const data = this.Inner.getData();
        return data === this.NoDirection ? Option.none() : Option.some(data as Direction);
    }

    /**
     * Reads the selected direction, throwing when the observable is empty.
     *
     * @throws { Error } If no direction is selected.
     *
     * @category Getter
     * @since 1.0.0
     */
    public getDataUnsafe(): Direction
    {
        const data = this.getData();
        if (Option.isNone(data))
        {
            throw new Error("ObservableDirection.getDataUnsafe was called while its value was empty.");
        }

        return data.value;
    }

    public clear(): void
    {
        this.Inner.setData(this.NoDirection);
    }

    public setData(data: Direction): void
    {
        this.Inner.setData(data);
    }

    public subscribe(
        callback: (Self: Option.Option<Direction>) => void
    ): (Self: Option.Option<Direction>) => void
    {
        this.unsubscribe(callback);
        const inner = (_data: string): void => callback(this.getData());
        this.Callbacks.set(callback, inner);
        this.Inner.subscribe(inner);
        return callback;
    }

    public unsubscribe(callback: (Self: Option.Option<Direction>) => void): boolean
    {
        const inner = this.Callbacks.get(callback);
        if (inner === undefined)
        {
            return false;
        }

        this.Callbacks.delete(callback);
        return this.Inner.unsubscribe(inner);
    }
}

/**
 * Adapts a direction observable as a tracked form input, with undefined as
 * the empty direction, so restoring an empty value clears the observable.
 *
 * @throws { TypeError } From `write`, if the value is neither undefined nor a direction.
 *
 * @category Adapter
 * @since 1.0.0
 */
const DirectionInput = (value: ObservableDirection): TrackedInput =>
{
    return {
        read: (): InputSnapshot => Option.getOrUndefined(value.getData()),
        subscribe: (listener: (snapshot: InputSnapshot) => void): (() => void) =>
        {
            const callback = (data: Option.Option<Direction>): void => listener(Option.getOrUndefined(data));
            value.subscribe(callback);
            return (): void =>
            {
                value.unsubscribe(callback);
            };
        },
        write: (snapshot: InputSnapshot): void =>
        {
            if (snapshot === undefined)
            {
                value.clear();
            }
            else if (Directions.includes(snapshot as Direction))
            {
                value.setData(snapshot as Direction);
            }
            else
            {
                throw new TypeError(`Cannot write ${String(snapshot)} to a direction observable.`);
            }
        }
    };
};

/**
 * Adds a native direction dropdown and optional low-resolution signed-axis preview.
 * Empty values or values excluded from items have no selection or highlighted axis.
 * The supplied observable updates the control live. Bedform Common supplies textures.
 *
 * @throws { Error } If items are empty, duplicated, or contain an invalid direction.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function direction(
    this: CustomForm.CustomForm,
    label: Text,
    value: ObservableDirection,
    items?: ReadonlyArray<DirectionItemData>,
    options?: DirectionOptions
): CustomForm.CustomForm
{
    const Choices = items ?? Directions.map((label: Direction) => ({ label }));
    const Indices = Choices.map((item: DirectionItemData): number => Directions.indexOf(item.label));
    if (Indices.length === 0 || Indices.some((index: number) => index < 0) ||
        new Set(Indices).size !== Indices.length)
    {
        throw new Error("A direction dropdown requires a nonempty list of distinct valid directions.");
    }

    const Preview = typeof options?.imagePreview === "object" ? options.imagePreview : {};
    const ShowImage = options?.imagePreview !== false && (Preview.displayImage ?? true);
    const Labels = Preview.showAxisLabels === false ? undefined
        : Preview.showAxisLabels === undefined || Preview.showAxisLabels === true
            ? "xyz" : Preview.showAxisLabels;
    const Mask = Indices.reduce((mask: number, index: number) => mask | (1 << index), 0);
    const Selected = (data: Option.Option<Direction>): number =>
        Option.isSome(data) && Choices.some((item: DirectionItemData) => item.label === data.value)
            ? Directions.indexOf(data.value) : -1;
    const ImagePath = (selected: number): string => DirectionPreviewPath(
        selected, Mask, Labels, Preview.excludedValuesStyle ?? "dim"
    );
    const Initial = Selected(value.getData());
    const Index = new ObservableNumber(Initial, { clientWritable: true });
    const Image = ShowImage ? new ObservableString(ImagePath(Initial)) : undefined;
    const Items = Choices.map((item: DirectionItemData, index: number): DropdownItemData => ({
        ...Struct.pick(item, [ "description" ]),
        label: ChoiceLabel(Indices[index], options?.choiceLabelStyle),
        value: Indices[index]
    }));
    let Updating = false;
    Index.subscribe((selected: number) =>
    {
        if (Updating)
        {
            return;
        }

        if (Indices.includes(selected))
        {
            value.setData(Directions[selected]);
        }
        else
        {
            Index.setData(Selected(value.getData()));
        }
    });
    value.subscribe((data: Option.Option<Direction>) =>
    {
        Updating = true;
        try
        {
            const selected = Selected(data);
            Index.setData(selected);
            Image?.setData(ImagePath(selected));
        }
        finally
        {
            Updating = false;
        }
    });
    const AddImage = (): void =>
    {
        if (Image !== undefined)
        {
            this.image(Image, DirectionResourcePack, {
                tooltip: Preview.tooltip,
                visible: options?.visible ?? true,
                width: 0.5
            });
        }
    };

    if ((Preview.imagePosition ?? "before") === "before")
    {
        AddImage();
    }

    // The internal index bounces -1 back, so the direction itself is tracked instead.
    Untracked(this, () => this.dropdown(label, Index, Items,
        Struct.pick(options ?? {}, [ "description", "disabled", "tooltip", "visible" ])));
    RegisterInput(this, DirectionInput(value));
    if (Preview.imagePosition === "after")
    {
        AddImage();
    }

    return this;
}
