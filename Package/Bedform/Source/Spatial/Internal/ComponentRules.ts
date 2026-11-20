/**
 * Pure spatial prop, text and host-ancestry validation shared by components and the reconciler.
 *
 * @module bedform/Spatial/Internal/ComponentRules
 *
 * @file      ComponentRules.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Fallback, Pose, TextProps } from "../ComponentTypes.js";
import { Defaults as SurfaceDefaults, Tint } from "../../Canvas/Surface.js";
import { Kind } from "./ComponentKind.js";

/**
 * Host context survives providers, fragments and ordinary function components.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Context {
    readonly Ancestors: ReadonlyArray<string>;
    readonly Custom: boolean;
    readonly Spatial: boolean;
    readonly InText: boolean;
}

/**
 * Resolved inline font contract, retained even when nested Text only overrides color.
 *
 * @category Model
 * @since 1.0.0
 */
export interface TextStyle {
    readonly Font: NonNullable<TextProps["Font"]>;
    readonly Fallback: Fallback;
    readonly FallbackScope: "Line" | "Text";
    readonly Color: NonNullable<TextProps["Color"]>;
}

/**
 * Rejects nonfinite or out-of-range numeric layout values before any native allocation.
 *
 * @throws { RangeError } If the number is invalid.
 *
 * @category Validation
 * @since 1.0.0
 */
export function NumberOf(value: unknown, name: string, minimum: number = 0): number
{
    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum)
    {
        throw new RangeError(`${name} must be finite and at least ${minimum}.`);
    }

    return value;
}

/**
 * Copies and normalizes a rigid pose without importing the native engine or Effect protocols.
 *
 * @throws { RangeError } If a position or quaternion component is invalid.
 *
 * @category Converting
 * @since 1.0.0
 */
export function PoseOf(value: Pose | undefined): Pose
{
    const position = value?.position ?? { x: 0,
        y: 0,
        z: 0 };
    const rotation = value?.rotation ?? {
        w: 1,
        x: 0,
        y: 0,
        z: 0
    };
    for (const component of [
        position.x,
        position.y,
        position.z,
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w
    ])
    {
        NumberOf(component, "Transform component", -Infinity);
    }

    const norm = Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w);
    if (!norm || !Number.isFinite(norm))
    {
        throw new RangeError("Transform requires a nonzero rigid quaternion.");
    }

    return Object.freeze({
        position: Object.freeze({ ...position }),
        rotation: Object.freeze({
            w: rotation.w / norm,
            x: rotation.x / norm,
            y: rotation.y / norm,
            z: rotation.z / norm
        })
    });
}

/**
 * Compares fallback values semantically for replacement records and by identity for callbacks.
 *
 * @category Predicate
 * @since 1.0.0
 */
export function SameFallback(a: Fallback, b: Fallback): boolean
{
    return a === b || (typeof a === "object" && typeof b === "object" && a.Replace === b.Replace);
}

/**
 * Resolves a Text's inline contract; explicit conflicting font settings are catchable render errors.
 *
 * @throws { Error } If a nested Text changes anything except its color or repeats different font settings.
 *
 * @category Validation
 * @since 1.0.0
 */
export function TextStyleOf(
    props: TextProps,
    color: NonNullable<TextProps["Color"]>,
    parent?: TextStyle
): TextStyle
{
    const Font = props.Font ?? parent?.Font ?? "Mojangles";
    const Fallback = props.Fallback ?? parent?.Fallback ?? "Mojangles";
    const FallbackScope = props.FallbackScope ?? parent?.FallbackScope ?? "Line";
    if (![ "Mojangles", "Legacy", "Ten" ].includes(Font) || ![ "Line", "Text" ].includes(FallbackScope))
    {
        throw new Error("Invalid Text Font or FallbackScope.");
    }

    if (!(
        typeof Fallback === "function" ||
        (typeof Fallback === "object" && Fallback !== null && typeof Fallback.Replace === "string") ||
        [ "Mojangles", "Omit", "Error" ].includes(Fallback as string)
    ))
    {
        throw new Error("Invalid Text Fallback.");
    }

    if (parent)
    {
        if (
            Font !== parent.Font ||
            !SameFallback(Fallback, parent.Fallback) ||
            FallbackScope !== parent.FallbackScope
        )
        {
            throw new Error("Nested Text must inherit Font, Fallback and FallbackScope.");
        }

        for (const key of [
            "Width",
            "Height",
            "MinWidth",
            "MinHeight",
            "Padding",
            "Gap",
            "Align",
            "Justify",
            "Grow",
            "Position",
            "X",
            "Y",
            "Layer",
            "Visible",
            "RequiredItem",
            "Access",
            "Pointer",
            "LineGap",
            "TextAlign",
            "Measure",
            "BackgroundColor",
            "OnActivate"
        ])
        {
            if (props[key as keyof TextProps] !== undefined)
            {
                throw new Error("Nested Text may only change Color.");
            }
        }
    }

    return Object.freeze({
        Color: props.Color ?? parent?.Color ?? color,
        Fallback,
        FallbackScope,
        Font
    });
}

/**
 * Validates public layout values and component-specific descriptor props on every render.
 *
 * @throws { Error } If a prop cannot form a coherent layout or violates the Text-label contract.
 *
 * @category Validation
 * @since 1.0.0
 */
export function CheckProps(type: string, props: Readonly<Record<string, unknown>>): void
{
    for (const key of [
        "Width",
        "Height",
        "MinWidth",
        "MinHeight",
        "Gap",
        "Grow",
        "ScrollX",
        "ScrollY",
        "Overlap",
        "Inset",
        "TitleGap",
        "LineGap",
        "Thickness"
    ])
    {
        if (
            props[key] !== undefined &&
            !((key === "Width" || key === "Height") && props[key] === "auto")
        )
        {
            NumberOf(props[key], key);
        }
    }

    for (const key of [ "X", "Y", "Layer" ])
    {
        if (props[key] !== undefined)
        {
            NumberOf(props[key], key, -Infinity);
        }
    }

    if (props.Padding !== undefined)
    {
        if (typeof props.Padding === "number")
        {
            NumberOf(props.Padding, "Padding");
        }
        else
        {
            if (!props.Padding || typeof props.Padding !== "object")
            {
                throw new Error("Padding must be pixels or Insets.");
            }

            for (const [ key, value ] of Object.entries(props.Padding))
            {
                if (![ "Top", "Right", "Bottom", "Left" ].includes(key))
                {
                    throw new Error("Unknown padding edge.");
                }

                if (value !== undefined)
                {
                    NumberOf(value, `Padding.${key}`);
                }
            }
        }
    }

    for (const key of [ "Color", "BackgroundColor" ])
    {
        if (props[key] !== undefined)
        {
            Tint(props[key] as Parameters<typeof Tint>[0]);
        }
    }

    if (
        props.Align !== undefined &&
        ![ "start", "center", "end", "stretch" ].includes(props.Align as string)
    )
    {
        throw new Error("Invalid Align.");
    }

    if (
        props.Justify !== undefined &&
        ![ "start", "center", "end", "space-between" ].includes(props.Justify as string)
    )
    {
        throw new Error("Invalid Justify.");
    }

    if (props.Position !== undefined && props.Position !== "relative" && props.Position !== "absolute")
    {
        throw new Error("Invalid Position.");
    }

    for (const key of [ "Visible", "Disabled", "Selected", "Arrows" ])
    {
        if (props[key] !== undefined && typeof props[key] !== "boolean")
        {
            throw new Error(`Invalid ${key}.`);
        }
    }

    for (const key of [ "OnActivate", "OnChange", "Measure" ])
    {
        if (props[key] !== undefined && typeof props[key] !== "function")
        {
            throw new Error(`Invalid ${key} callback.`);
        }
    }

    if (props.Direction !== undefined && ![ "row", "column" ].includes(props.Direction as string))
    {
        throw new Error("Invalid Direction.");
    }

    if (
        props.Orientation !== undefined &&
        ![ "horizontal", "vertical" ].includes(props.Orientation as string)
    )
    {
        throw new Error("Invalid Orientation.");
    }

    if (
        props.scrollbarVisibility !== undefined &&
        ![ "always", "hidden", "hover" ].includes(props.scrollbarVisibility as string)
    )
    {
        throw new Error("Invalid scrollbarVisibility.");
    }

    if (
        props.TextAlign !== undefined &&
        ![ "start", "center", "end" ].includes(props.TextAlign as string)
    )
    {
        throw new Error("Invalid TextAlign.");
    }

    if (
        props.Variant !== undefined &&
        ![ "crafting", "furnace", "loading" ].includes(props.Variant as string)
    )
    {
        throw new Error("Invalid frame Variant.");
    }

    if (
        props.RequiredItem !== undefined &&
        (typeof props.RequiredItem !== "string" || !props.RequiredItem)
    )
    {
        throw new Error("RequiredItem must be a nonempty identifier.");
    }

    if (props.Pointer !== undefined)
    {
        const pointer = props.Pointer as Record<string, unknown>;
        if (!pointer || typeof pointer !== "object")
        {
            throw new Error("Invalid Pointer settings.");
        }

        if (
            pointer.MaxDistance !== undefined &&
            NumberOf(pointer.MaxDistance, "Pointer.MaxDistance") === 0
        )
        {
            throw new Error("Pointer.MaxDistance must be positive.");
        }

        for (const key of [ "Enabled", "Visible" ])
        {
            if (pointer[key] !== undefined && typeof pointer[key] !== "boolean")
            {
                throw new Error("Invalid Pointer flag.");
            }
        }

        if (pointer.Color !== undefined && typeof pointer.Color !== "function")
        {
            throw new Error("Pointer.Color must be a callback.");
        }
    }

    if (props.Access !== undefined)
    {
        const access = props.Access as Record<string, unknown>;
        if (!access || typeof access !== "object")
        {
            throw new Error("Invalid Access policy.");
        }

        if (
            access.MaxPlayers !== undefined &&
            !Number.isInteger(NumberOf(access.MaxPlayers, "Access.MaxPlayers"))
        )
        {
            throw new Error("Access.MaxPlayers must be an integer.");
        }

        if (access.Allows !== undefined && typeof access.Allows !== "function")
        {
            throw new Error("Invalid Access predicate.");
        }

        if (access.LockedTo !== undefined && (typeof access.LockedTo !== "string" || !access.LockedTo))
        {
            throw new Error("Access.LockedTo must be a nonempty player id.");
        }
    }

    if ([ Kind.Button, Kind.Toggle, Kind.Slider, Kind.Callout ].includes(type as typeof Kind.Button))
    {
        for (const key of [ "label", "Label", "title" ])
        {
            if (props[key] !== undefined)
            {
                throw new Error("Display labels must be explicit Text children or slots.");
            }
        }
    }

    if (type === Kind.View)
    {
        const dimension =
            typeof props.Dimension === "string"
                ? props.Dimension
                : (
                    props.Dimension as {
                        id?: unknown;
                    }
                )?.id;
        if (typeof dimension !== "string" || !dimension)
        {
            throw new Error("View requires a dimension identity.");
        }

        if (NumberOf(props.PixelsPerBlock ?? 16, "PixelsPerBlock") === 0)
        {
            throw new Error("PixelsPerBlock must be positive.");
        }

        if (NumberOf(props.LayerDepth ?? SurfaceDefaults.LayerDepth, "LayerDepth") === 0)
        {
            throw new Error("LayerDepth must be positive.");
        }

        PoseOf(props.Transform as Pose | undefined);
    }

    if (type === Kind.ItemStack)
    {
        if (typeof props.Item !== "string" || !props.Item)
        {
            throw new Error("ItemStack requires Item.");
        }

        if (!Number.isInteger(NumberOf(props.Quantity ?? 1, "Quantity", 1)))
        {
            throw new Error("Quantity must be an integer.");
        }
    }

    if (type === Kind.Mob && (typeof props.Type !== "string" || !props.Type))
    {
        throw new Error("Mob requires Type.");
    }

    if (type === Kind.Slider)
    {
        const minimum = NumberOf(props.Min ?? 0, "Min", -Infinity);
        const maximum = NumberOf(props.Max ?? 1, "Max", -Infinity);
        NumberOf(props.Value, "Value", -Infinity);
        if (minimum >= maximum)
        {
            throw new Error("Slider requires Min < Max.");
        }
    }

    if (type === Kind.Toggle && typeof props.Checked !== "boolean")
    {
        throw new Error("Toggle requires Checked.");
    }

    if (type === Kind.Bar)
    {
        NumberOf(props.Value, "Value", -Infinity);
        NumberOf(props.Maximum, "Maximum");
    }

    if (
        type === Kind.Button &&
        ![ "pause", "disconnect" ].includes((props.appearance ?? "pause") as string)
    )
    {
        throw new Error("Invalid Button appearance.");
    }

    if (
        type === Kind.TabButton &&
        ![ "recipe", "subtle" ].includes((props.appearance ?? "recipe") as string)
    )
    {
        throw new Error("Invalid TabButton appearance.");
    }

    if (
        type === Kind.Callout &&
        ![ "Note", "Tip", "Important", "Warning", "Caution" ].includes(props.Kind as string)
    )
    {
        throw new Error("Invalid Callout Kind.");
    }
}

/**
 * Tracks authoritative host ancestry; React providers and composite wrappers cannot reset it.
 *
 * @throws { Error } If a host type violates widget, Text, Slot, tabs or top-level frame ancestry.
 *
 * @category Validation
 * @since 1.0.0
 */
export function ChildContext(parent: Context, type: string): Context
{
    const known = (Object.values(Kind) as ReadonlyArray<string>).includes(type);
    const ancestors = parent.Ancestors;
    const visual = ancestors.filter(
        (kind: string) =>
            kind !== Kind.InputScope &&
            kind !== Kind.Title &&
            kind !== Kind.Content &&
            kind !== Kind.Heading
    );
    const nearest = visual.at(-1);
    if (parent.InText && type !== Kind.Text)
    {
        throw new Error("Text may contain only text and nested Text.");
    }

    if (!known && (parent.Spatial || !parent.Custom))
    {
        throw new Error("Use spatial components inside View.");
    }

    if (known)
    {
        if (type === Kind.View && visual.length)
        {
            throw new Error("View cannot be nested in a visual host.");
        }

        if (type !== Kind.View && type !== Kind.InputScope && !ancestors.includes(Kind.View))
        {
            throw new Error("Spatial components require a root View.");
        }

        if ((type === Kind.FramedPanel || type === Kind.TitledPanel) && nearest !== Kind.View)
        {
            throw new Error(
                "Framed panels must be top-level under View; nonvisual wrappers do not erase ancestors."
            );
        }

        if (type === Kind.Tabs && nearest !== Kind.FramedPanel && nearest !== Kind.TitledPanel)
        {
            throw new Error("Tabs must attach to a framed panel.");
        }

        if (type === Kind.TabButton && nearest !== Kind.Tabs)
        {
            throw new Error("TabButton requires Tabs.");
        }

        if (nearest === Kind.Slot && type !== Kind.ItemStack && type !== Kind.InputScope)
        {
            throw new Error("Slot accepts only one ItemStack.");
        }

        if (nearest === Kind.Tabs && type !== Kind.TabButton && type !== Kind.InputScope)
        {
            throw new Error("Tabs accepts only TabButton children.");
        }

        if (
            [ Kind.ItemStack, Kind.Mob, Kind.Divider, Kind.Image ].includes(
                nearest as typeof Kind.ItemStack
            )
        )
        {
            throw new Error("This spatial leaf accepts no children.");
        }

        if (
            (ancestors.at(-1) === Kind.Title || ancestors.at(-1) === Kind.Heading) &&
            type !== Kind.Text
        )
        {
            throw new Error("Title and heading slots require Text.");
        }
    }

    return {
        Ancestors: [ ...ancestors, type ],
        Custom: parent.Custom,
        InText: parent.InText || type === Kind.Text,
        Spatial: parent.Spatial || known
    };
}

/**
 * Rejects observable scalar text outside Text while preserving explicit custom-host adapters.
 *
 * @throws { Error } If visible scalar text has no enclosing Text.
 *
 * @category Validation
 * @since 1.0.0
 */
export function CheckText(context: Context): void
{
    if (!context.InText && (context.Spatial || !context.Custom))
    {
        throw new Error("Display text must be wrapped in Text.");
    }
}
