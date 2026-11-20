/**
 * Ordinary React spatial components with typed child contracts, inherited text styles and theme defaults.
 *
 * @module bedform/Spatial/Components
 *
 * @file      Components.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as Props from "./ComponentTypes.js";
import { CheckProps, NumberOf, PoseOf, TextStyleOf } from "./Internal/ComponentRules.js";
import { InternalProp, Kind } from "./Internal/ComponentKind.js";
import { Core } from "./Internal/React/Core.js";
import type { ReactElement } from "./React/index.js";
import type { TextStyle } from "./Internal/ComponentRules.js";
import { Tint } from "../Canvas/Surface.js";

/**
 * Public prop contracts without a second JSX or React implementation.
 *
 * @category Model
 * @since 1.0.0
 */
export type * from "./ComponentTypes.js";

/**
 * Customizable palette and layout defaults, without claiming pixel-qualified native screen artwork.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Theme = Object.freeze({
    Dark: Object.freeze({
        Background: "#313131",
        Content: "#00000080",
        ContentPadding: 4,
        Control: "#555555",
        ControlPadding: 4,
        Foreground: "#4D4D4D",
        FrameMinHeight: 32,
        FrameMinWidth: 32,
        FramePadding: 8,
        TabGap: 2,
        TitleGap: 4
    }),
    Light: Object.freeze({
        Background: "#C6C6C6",
        Content: "#00000080",
        ContentPadding: 4,
        Control: "#C6C6C6",
        ControlPadding: 4,
        Foreground: "#4D4D4D",
        FrameMinHeight: 32,
        FrameMinWidth: 32,
        FramePadding: 8,
        TabGap: 2,
        TitleGap: 4
    })
} as const);
const ThemeContext = Core.createContext<Props.ThemeTokens>(Theme.Dark);
const TextContext = Core.createContext<TextStyle | undefined>(undefined);

/**
 * Rejects direct and fragment-contained bare text before React drops empty scalar children.
 *
 * @category Validation
 * @since 1.0.0
 */
function CheckChildren(children: unknown, text: boolean): void
{
    Core.Children.forEach(children as never, (child: unknown): void =>
    {
        if (
            !text &&
            (typeof child === "string" || typeof child === "number" || typeof child === "bigint")
        )
        {
            throw new Error("Display text must be wrapped in Text.");
        }

        if (
            Core.isValidElement<{
                children?: unknown;
            }>(child) &&
            child.type === Core.Fragment
        )
        {
            CheckChildren(child.props.children, text);
        }
    });
}

/**
 * Creates a host descriptor and a render-time failure receiver for post-reconciliation child checks.
 *
 * @throws { Error } When component props or child contracts are invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
function useElement(type: string, input: Readonly<Record<string, unknown>>): ReactElement
{
    const theme = Core.useContext(ThemeContext);
    const parent = Core.useContext(TextContext);
    const [ failure, setFailure ] = Core.useState<Error | undefined>(undefined);
    const fail = Core.useCallback((error: Error): void => setFailure(error), []);
    if (failure)
    {
        throw failure;
    }

    if (parent && type !== Kind.Text)
    {
        throw new Error("Text may contain only text and nested Text.");
    }

    CheckChildren(input.children, type === Kind.Text);
    const props: Record<string, unknown> = { ...input,
        [InternalProp.Failure]: fail };
    if (type === Kind.View)
    {
        props.Transform = PoseOf(input.Transform as Props.Pose | undefined);
    }

    if (type === Kind.Text)
    {
        const style = TextStyleOf(input as Props.TextProps, theme.Foreground, parent);
        Object.assign(props, style);
        CheckProps(type, props);
        return Core.createElement(
            TextContext.Provider,
            { value: style },
            Core.createElement(type, props, input.children as never)
        );
    }

    if (
        [ Kind.Panel, Kind.FramedPanel, Kind.TitledPanel, Kind.Callout ].includes(
            type as typeof Kind.Panel
        )
    )
    {
        props.BackgroundColor ??= theme.Background;
    }

    if ([ Kind.Button, Kind.Toggle, Kind.Slider, Kind.TabButton ].includes(type as typeof Kind.Button))
    {
        props.BackgroundColor ??= theme.Control;
        props.Padding ??= theme.ControlPadding;
        props.Height ??= 20;
    }

    if (type === Kind.Slot)
    {
        Object.assign(props, {
            Align: input.Align ?? "center",
            Height: input.Height ?? 18,
            Justify: input.Justify ?? "center",
            Padding: input.Padding ?? 1,
            Width: input.Width ?? 18
        });
    }

    if (type === Kind.ItemStack || type === Kind.Mob)
    {
        Object.assign(props, {
            Height: input.Height ?? 16,
            Width: input.Width ?? 16
        });
    }

    if (type === Kind.Image)
    {
        const source = input.Source as {
            Width?: number;
            Height?: number;
        };
        if (!source || !Number.isFinite(source.Width) || !Number.isFinite(source.Height))
        {
            throw new Error("Image requires a generated image descriptor.");
        }

        props.Width ??= source.Width;
        props.Height ??= source.Height;
    }

    if (type === Kind.Divider)
    {
        Object.assign(
            props,
            input.Orientation === "vertical"
                ? {
                    Height: input.Height ?? 16,
                    Width: input.Width ?? input.Thickness ?? 1
                }
                : {
                    Height: input.Height ?? input.Thickness ?? 1,
                    Width: input.Width ?? 16
                }
        );
    }

    if (type === Kind.Bar)
    {
        Object.assign(props, {
            Height: input.Height ?? 10,
            Width: input.Width ?? 80
        });
    }

    if (type === Kind.Slider)
    {
        props.Width ??= 100;
    }

    if (type === Kind.TabButton)
    {
        props.Width ??= 24;
        props.appearance ??= "recipe";
    }

    if (type === Kind.Button)
    {
        props.appearance ??= "pause";
    }

    if (type === Kind.Tabs)
    {
        props.Gap ??= theme.TabGap;
    }

    if (type === Kind.FramedPanel || type === Kind.TitledPanel)
    {
        props.Padding ??= theme.FramePadding;
        props.MinWidth ??= theme.FrameMinWidth;
        props.MinHeight ??= theme.FrameMinHeight;
    }

    CheckProps(type, props);
    if (
        [ Kind.ItemStack, Kind.Mob, Kind.Divider, Kind.Image ].includes(type as typeof Kind.ItemStack) &&
        Core.Children.count(input.children as never) !== 0
    )
    {
        throw new Error("This spatial leaf accepts no children.");
    }

    let children = input.children;
    if (type === Kind.TitledPanel)
    {
        if (!Core.isValidElement(input.Title))
        {
            throw new Error("TitledPanel requires an explicit Text title slot.");
        }

        props.Gap ??= input.TitleGap ?? theme.TitleGap;
        children = [
            Core.createElement(
                Kind.Title,
                {
                    Align: "center",
                    key: "title"
                },
                input.Title
            ),
            Core.createElement(
                Kind.Content,
                {
                    Align: "stretch",
                    BackgroundColor: theme.Content,
                    Grow: 1,
                    Padding: theme.ContentPadding,
                    key: "content"
                },
                input.children as never
            )
        ];
        props.Align ??= "stretch";
    }

    if (type === Kind.Callout)
    {
        if (input.Heading !== undefined && !Core.isValidElement(input.Heading))
        {
            throw new Error("Callout Heading must be an explicit Text element.");
        }

        const heading = input.Heading ?? Core.createElement(Text, null, input.Kind as string);
        children = [
            Core.createElement(Kind.Heading, { key: "heading" }, heading as never),
            input.children
        ];
    }

    delete props.Title;
    delete props.Heading;
    return Core.createElement(type, props, children as never);
}

/**
 * Creates the world-space widget root with reactive rigid pose and dimensions.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function View(props: Props.ViewProps): ReactElement
{
    return useElement(Kind.View, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates a general layout panel.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Panel(props: Props.PanelProps): ReactElement
{
    return useElement(Kind.Panel, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Places children horizontally.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Row(props: Props.ContainerProps): ReactElement
{
    return useElement(Kind.Row, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Places children vertically.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Column(props: Props.ContainerProps): ReactElement
{
    return useElement(Kind.Column, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates a text block or an inherited inline color run.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Text(props: Props.TextProps): ReactElement
{
    return useElement(Kind.Text, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates a leaf image descriptor.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Image(props: Props.ImageProps): ReactElement
{
    return useElement(Kind.Image, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates a slot that admits no child or one resolved ItemStack.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Slot(props: Props.SlotProps): ReactElement
{
    return useElement(Kind.Slot, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates a leaf inventory presentation descriptor.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function ItemStack(props: Props.ItemStackProps): ReactElement
{
    return useElement(Kind.ItemStack, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates a rectangular viewport with clamped content offsets.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function ScrollView(props: Props.ScrollViewProps): ReactElement
{
    return useElement(Kind.ScrollView, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates typed Text content and button appearance metadata.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Button(props: Props.ButtonProps): ReactElement
{
    return useElement(Kind.Button, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates controlled toggle metadata and content.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Toggle(props: Props.ToggleProps): ReactElement
{
    return useElement(Kind.Toggle, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates controlled slider range metadata and content.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Slider(props: Props.SliderProps): ReactElement
{
    return useElement(Kind.Slider, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates a leaf presentation actor descriptor.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Mob(props: Props.MobProps): ReactElement
{
    return useElement(Kind.Mob, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates alert content with an internally composed Text heading.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Callout(props: Props.CalloutProps): ReactElement
{
    return useElement(Kind.Callout, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates a noninteractive separator.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Divider(props: Props.DividerProps): ReactElement
{
    return useElement(Kind.Divider, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates controlled HUD-style bar metadata and optional Text content.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Bar(props: Props.BarProps): ReactElement
{
    return useElement(Kind.Bar, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Inherits policy metadata without adding a layout or clipping box.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function InputScope(props: Props.InputScopeProps): ReactElement
{
    return useElement(Kind.InputScope, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Attaches a row of TabButtons above its framed panel.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Tabs(props: Props.TabsProps): ReactElement
{
    return useElement(Kind.Tabs, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates independent action or controlled selection metadata.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function TabButton(props: Props.TabButtonProps): ReactElement
{
    return useElement(Kind.TabButton, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates top-level-only framed content with shared layout insets.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function FramedPanel(props: Props.FramedPanelProps): ReactElement
{
    return useElement(Kind.FramedPanel, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Creates framed content and an explicit centered Text title slot.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function TitledPanel(props: Props.TitledPanelProps): ReactElement
{
    return useElement(Kind.TitledPanel, props as unknown as Readonly<Record<string, unknown>>);
}

/**
 * Supplies reactive palette/layout defaults without a host node or a second React implementation.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function ThemeProvider(props: Props.ThemeProviderProps): ReactElement
{
    const parent = Core.useContext(ThemeContext);
    CheckChildren(props.children, false);
    const value = Core.useMemo((): Props.ThemeTokens =>
    {
        if (props.theme !== undefined && props.theme !== "light" && props.theme !== "dark")
        {
            throw new Error("ThemeProvider theme must be light or dark.");
        }

        const base =
            props.theme === "light" ? Theme.Light : props.theme === "dark" ? Theme.Dark : parent;
        const resolved = { ...base,
            ...props.Tokens };
        for (const key of [ "Foreground", "Background", "Control", "Content" ] as const)
        {
            Tint(resolved[key]);
        }

        for (const key of [
            "FramePadding",
            "ContentPadding",
            "ControlPadding",
            "FrameMinWidth",
            "FrameMinHeight",
            "TabGap",
            "TitleGap"
        ] as const)
        {
            NumberOf(resolved[key], key);
        }

        return Object.freeze(resolved);
    }, [ parent, props.theme, props.Tokens ]);
    return Core.createElement(ThemeContext.Provider, { value }, props.children);
}
