/**
 * Typed spatial component props, layout values and Minecraft-style theme tokens.
 *
 * @module bedform/Spatial/ComponentTypes
 *
 * @file      ComponentTypes.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ImageDescriptor } from "../Canvas/Image.js";
import type { ReactElement } from "./React/index.js";
import type { TintInput } from "../Canvas/Color.js";

/**
 * Element children and conditional arrays; scalar text is admitted only by Text.
 *
 * @category Model
 * @since 1.0.0
 */
export type Child = ReactElement | boolean | null | undefined | ReadonlyArray<Child>;

/**
 * Inline text and nested Text elements. JSX erases element identity; runtime validation is authoritative.
 *
 * @category Model
 * @since 1.0.0
 */
export type TextChild =
    | string
    | number
    | bigint
    | boolean
    | null
    | undefined
    | ReactElement<TextProps>
    | ReadonlyArray<TextChild>;

/**
 * A point or direction in world coordinates.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Vector {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/**
 * An arbitrary rigid orientation; finite nonzero quaternions are normalized.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Quaternion {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
}

/**
 * A rigid pose with no scale or Euler/yaw restriction.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Pose {
    readonly position: Vector;
    readonly rotation: Quaternion;
}

/**
 * A native dimension identity; a plain identifier string is also accepted by View.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Dimension {
    readonly id: string;
}

/**
 * Nonnegative padding in layout pixels.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Insets {
    readonly Top?: number;
    readonly Right?: number;
    readonly Bottom?: number;
    readonly Left?: number;
}

/**
 * Live access-policy metadata retained for the pointer/admission layer.
 *
 * @category Model
 * @since 1.0.0
 */
export interface AccessPolicy {
    readonly MaxPlayers?: number;
    readonly LockedTo?: string;
    readonly Allows?: (viewerId: string) => boolean;
}

/**
 * Why an aimed surface is not an eligible interactive target: its control or pointer is disabled, it
 * lies beyond the pointer's maximum distance, the held item fails a required item, or an access policy
 * denies the player.
 *
 * @category Model
 * @since 1.0.0
 */
export type PointerDenial = "disabled" | "distance" | "item" | "access";

/**
 * A player's input as sampled by the pointer: the held item's type identifier, if any, and whether a
 * Use press was observed within the brief press-feedback window.
 *
 * @category Model
 * @since 1.0.0
 */
export interface PointerInput {
    readonly HeldItem?: string;
    readonly Use: boolean;
}

/**
 * The aimed surface passed to a pointer color callback. Id and Type identify the committed layout item
 * that is the interactive target, or the topmost hit surface when nothing interactive was hit. Part is
 * "track" when a ScrollView's scrollbar track was hit, including a hover track that is not drawn.
 *
 * @category Model
 * @since 1.0.0
 */
export interface PointerTarget {
    readonly Id: number;
    readonly Type: string;
    readonly Part: "content" | "track";
    readonly Interactive: boolean;
    readonly Distance: number;
}

/**
 * Inputs to a reactive pointer color callback. Eligible is true exactly when the target is interactive
 * and has no Denial. Default is the color the pointer would use without the callback.
 *
 * @category Model
 * @since 1.0.0
 */
export interface PointerColorContext {
    readonly ViewerId: string;
    readonly Target: PointerTarget;
    readonly Input: PointerInput;
    readonly Denial?: PointerDenial;
    readonly Eligible: boolean;
    readonly Default: TintInput;
}

/**
 * Pointer admission and line-visibility metadata; hiding the line does not hide targets or remove the
 * player from access counting. MaxDistance, in blocks from the eye, hides the line and rejects
 * interaction beyond it. Color chooses the line color from the current target, input and denial;
 * returning undefined keeps the default.
 *
 * @category Model
 * @since 1.0.0
 */
export interface PointerSettings {
    readonly Enabled?: boolean;
    readonly Visible?: boolean;
    readonly MaxDistance?: number;
    readonly Color?: (context: PointerColorContext) => TintInput | undefined;
}

/**
 * A routed control event; actual native activation and gesture routing have separate owners.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Activation {
    readonly ViewerId: string;
    readonly TargetId: number;
    readonly Kind: "activate" | "useStart" | "useRelease" | "cancel";
}

/**
 * Reactive box layout and ancestor policy inputs. Auto sizes use content; flex growth never shrinks.
 * Higher Layer values paint in front; overlapping equal-layer boxes paint in tree order.
 *
 * @category Model
 * @since 1.0.0
 */
export interface BoxProps {
    readonly Width?: number | "auto";
    readonly Height?: number | "auto";
    readonly MinWidth?: number;
    readonly MinHeight?: number;
    readonly Padding?: number | Insets;
    readonly Gap?: number;
    readonly Align?: "start" | "center" | "end" | "stretch";
    readonly Justify?: "start" | "center" | "end" | "space-between";
    readonly Grow?: number;
    readonly Position?: "relative" | "absolute";
    readonly X?: number;
    readonly Y?: number;
    readonly Layer?: number;
    readonly Visible?: boolean;
    readonly Color?: TintInput;
    readonly BackgroundColor?: TintInput;
    readonly RequiredItem?: string;
    readonly Access?: AccessPolicy;
    readonly Pointer?: PointerSettings;
    readonly OnActivate?: (event: Activation) => void;
}

/**
 * Ordinary React element children with no bare scalar display text.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ContainerProps extends BoxProps {
    readonly children?: Child;
}

/**
 * One world-space widget: dimension, rigid pose and local X-right/Y-down pixels.
 * LayerDepth is a positive minimum separation in blocks for overlapping paint entries, default 0.01.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ViewProps extends ContainerProps {
    readonly Dimension: string | Dimension;
    readonly Transform?: Pose;
    readonly PixelsPerBlock?: number;
    readonly LayerDepth?: number;
}

/**
 * A Legacy-font replacement value; font mapping is owned by the text renderer.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Replacement {
    readonly Replace: string;
}

/**
 * Requested unsupported-character policy, retained for the shared text-rendering pipeline.
 *
 * @category Model
 * @since 1.0.0
 */
export type Fallback =
    | "Mojangles"
    | "Omit"
    | "Error"
    | Replacement
    | ((character: string, index: number, line: string) => string);

/**
 * Text layout and inline color runs; nested Text may only change Color and repeat equal font settings.
 *
 * @category Model
 * @since 1.0.0
 */
export interface TextProps extends BoxProps {
    readonly children?: TextChild;
    readonly Font?: "Mojangles" | "Legacy" | "Ten";
    readonly Fallback?: Fallback;
    readonly FallbackScope?: "Line" | "Text";
    readonly LineGap?: number;
    readonly TextAlign?: "start" | "center" | "end";
    readonly Measure?: (line: string, font: "Mojangles" | "Legacy" | "Ten") => number | undefined;
}

/**
 * A general-purpose column container.
 *
 * @category Model
 * @since 1.0.0
 */
export interface PanelProps extends ContainerProps {
    readonly Direction?: "row" | "column";
}

/**
 * A generated Canvas image descriptor; Image is a leaf.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ImageProps extends BoxProps {
    readonly Source: ImageDescriptor;
    readonly children?: never;
}

/**
 * Inventory presentation descriptor; native pose and count rendering remain a later delivery.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ItemStackProps extends BoxProps {
    readonly Item: string;
    readonly Quantity?: number;
    readonly children?: never;
}

/**
 * No child or one ItemStack after fragment/conditional/composite resolution.
 *
 * @category Model
 * @since 1.0.0
 */
export interface SlotProps extends BoxProps {
    readonly children?: ReactElement<ItemStackProps> | boolean | null;
}

/**
 * Viewport offset and clipping foundations; scrollbar visuals and gestures remain a separate delivery.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ScrollViewProps extends ContainerProps {
    readonly ScrollX?: number;
    readonly ScrollY?: number;
    readonly Orientation?: "vertical" | "horizontal";
    readonly scrollbarVisibility?: "always" | "hidden" | "hover";
    readonly Arrows?: boolean;
}

/**
 * Typed button content and appearance; display labels are Text children.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ButtonProps extends ContainerProps {
    readonly appearance?: "pause" | "disconnect";
    readonly Disabled?: boolean;
}

/**
 * Controlled toggle state; changing appearance or value does not change component identity.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ToggleProps extends ContainerProps {
    readonly Checked: boolean;
    readonly Disabled?: boolean;
    readonly OnChange?: (checked: boolean, event: Activation) => void;
}

/**
 * Controlled finite slider range and value, with optional Text content.
 *
 * @category Model
 * @since 1.0.0
 */
export interface SliderProps extends ContainerProps {
    readonly Value: number;
    readonly Min?: number;
    readonly Max?: number;
    readonly Disabled?: boolean;
    readonly OnChange?: (value: number, event: Activation) => void;
}

/**
 * Presentation actor descriptor with no arbitrary children; native actors and cosmetic refs remain separate.
 *
 * @category Model
 * @since 1.0.0
 */
export interface MobProps extends BoxProps {
    readonly Type: string;
    readonly children?: never;
}

/**
 * Typed alert content; a custom heading is an explicit Text element slot.
 *
 * @category Model
 * @since 1.0.0
 */
export interface CalloutProps extends ContainerProps {
    readonly Kind: "Note" | "Tip" | "Important" | "Warning" | "Caution";
    readonly Heading?: ReactElement<TextProps>;
}

/**
 * Noninteractive separator geometry with no text or arbitrary children.
 *
 * @category Model
 * @since 1.0.0
 */
export interface DividerProps extends BoxProps {
    readonly Orientation?: "horizontal" | "vertical";
    readonly Thickness?: number;
    readonly children?: never;
}

/**
 * Controlled HUD-style descriptor; any optional user label is a Text child.
 *
 * @category Model
 * @since 1.0.0
 */
export interface BarProps extends ContainerProps {
    readonly Value: number;
    readonly Maximum: number;
    readonly Kind?: "health" | "hunger" | "experience" | "armor" | "air" | "boss";
}

/**
 * Leaf prop contract reused by the later generated glyph catalogue; no placeholder Glyph component is
 * exported.
 *
 * @category Model
 * @since 1.0.0
 */
export interface GlyphProps extends BoxProps {
    readonly children?: never;
}

/**
 * Above-panel attachment; a strip too wide for its panel is hidden, including its hit targets.
 *
 * @category Model
 * @since 1.0.0
 */
export interface TabsProps extends BoxProps {
    readonly Overlap?: number;
    readonly Inset?: number;
    readonly children?:
        | ReactElement<TabButtonProps>
        | boolean
        | null
        | ReadonlyArray<ReactElement<TabButtonProps> | boolean | null>;
}

/**
 * Caller-controlled recipe toggle or independent action; subtle appearance never implies selection.
 *
 * @category Model
 * @since 1.0.0
 */
export interface TabButtonProps extends ContainerProps {
    readonly appearance?: "recipe" | "subtle";
    readonly Selected?: boolean;
    readonly Disabled?: boolean;
}

/**
 * Top-level-only frame content and insets; rounded native artwork is owned by the frame delivery.
 *
 * @category Model
 * @since 1.0.0
 */
export interface FramedPanelProps extends ContainerProps {
    readonly Variant?: "crafting" | "furnace" | "loading";
}

/**
 * Centered Text title slot and dark translucent content with the same top-level-only ancestry.
 *
 * @category Model
 * @since 1.0.0
 */
export interface TitledPanelProps extends FramedPanelProps {
    readonly Title: ReactElement<TextProps>;
    readonly TitleGap?: number;
}

/**
 * Nonvisual inherited item/access policies without a layout or clipping box.
 *
 * @category Model
 * @since 1.0.0
 */
export interface InputScopeProps {
    readonly children?: Child;
    readonly RequiredItem?: string;
    readonly Access?: AccessPolicy;
}

/**
 * Customizable Minecraft-style palette and logical layout defaults; asset silhouettes require later
 * client qualification.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ThemeTokens {
    readonly Foreground: TintInput;
    readonly Background: TintInput;
    readonly Control: TintInput;
    readonly Content: TintInput;
    readonly FramePadding: number;
    readonly ContentPadding: number;
    readonly ControlPadding: number;
    readonly FrameMinWidth: number;
    readonly FrameMinHeight: number;
    readonly TabGap: number;
    readonly TitleGap: number;
}

/**
 * Reactive nonvisual theme provider; omission inherits the enclosing theme, defaulting to dark.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ThemeProviderProps {
    readonly theme?: "light" | "dark";
    readonly Tokens?: Partial<ThemeTokens>;
    readonly children?: Child;
}
