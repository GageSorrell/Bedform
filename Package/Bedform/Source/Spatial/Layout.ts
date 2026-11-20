/**
 * Pure committed spatial layout, rectangular viewport transforms and arbitrary-orientation hit coordinates.
 *
 * @module bedform/Spatial/Layout
 *
 * @file      Layout.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as Types from "./ComponentTypes.js";
import { CheckProps, CheckText, ChildContext, PoseOf, TextStyleOf } from "./Internal/ComponentRules.js";
import { Depths, Defaults as SurfaceDefaults } from "../Canvas/Surface.js";
import type { Context } from "./Internal/ComponentRules.js";
import { Kind } from "./Internal/ComponentKind.js";
import type { Node } from "./Internal/Surface.js";
import { Prepare } from "./Internal/TextLines.js";
import type { PreparedLine } from "./Internal/TextLines.js";

/**
 * Local layout coordinates, in pixels, with X right and Y down.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Point {
    readonly X: number;
    readonly Y: number;
}

/**
 * A nonnegative rectangular extent; clipping uses half-open edges.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Box extends Point {
    readonly Width: number;
    readonly Height: number;
}

/**
 * Inherited policy chain. Access objects remain live controller contracts; their arrays are frozen.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Policy {
    readonly RequiredItems: ReadonlyArray<string>;
    readonly Access: ReadonlyArray<Types.AccessPolicy>;
    readonly Pointer: Readonly<Types.PointerSettings>;
}

/**
 * A visual line's intended visible placement and source range before native centering compensation.
 * Start and Length address UTF-16 code units; wrapping never splits a Unicode code point.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Line extends Point {
    readonly Value: string;
    readonly Width: number;
    readonly Start: number;
    readonly Length: number;
}

/**
 * A nested inline color run, retaining source identity without adding another layout box.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Run {
    readonly Id: number;
    readonly Start: number;
    readonly Length: number;
    readonly Color: NonNullable<Types.TextProps["Color"]>;
}

/**
 * Flattened inline content and its resolved font contract.
 *
 * @category Model
 * @since 1.0.0
 */
export interface TextLayout {
    readonly Value: string;
    readonly Runs: ReadonlyArray<Run>;
    readonly Lines: ReadonlyArray<PreparedLine>;
    readonly Font: NonNullable<Types.TextProps["Font"]>;
    readonly Fallback: Types.Fallback;
    readonly FallbackScope: "Line" | "Text";
}

/**
 * Cross-axis thickness, in layout pixels, of the rectangle where a ScrollView's scrollbar is drawn.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ScrollbarThickness = 6 as const;

/**
 * One committed visual box, shared by surface rendering and analytic targeting.
 * Clip is absent outside ScrollView; an empty clip is explicitly zero-sized. Track is present only on a
 * ScrollView whose content overflows its scroll axis and whose scrollbar is not "hidden": it is the
 * rectangle where the scrollbar would be drawn, along the content box's right edge (vertical) or bottom
 * edge (horizontal), painted above the ScrollView's descendants and clipped like the ScrollView itself.
 * A "hover" track is targetable whether or not its scrollbar is currently shown.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Item extends Policy {
    readonly Id: number;
    readonly ViewId: number;
    readonly ParentId?: number;
    readonly Type: string;
    readonly Bounds: Box;
    readonly Content: Box;
    readonly Clip?: Box;
    readonly Layer: number;
    readonly Depth: number;
    readonly Order: number;
    readonly Hidden: boolean;
    readonly Props: Readonly<Record<string, unknown>>;
    readonly Text?: TextLayout;
    readonly Scroll?: Point;
    readonly Track?: Box;
}

/**
 * A world-space view and local overflow extent, including above-panel tabs.
 *
 * @category Model
 * @since 1.0.0
 */
export interface View {
    readonly Id: number;
    readonly Dimension: string;
    readonly Transform: Types.Pose;
    readonly PixelsPerBlock: number;
    readonly LayerDepth: number;
    readonly Bounds: Box;
    readonly Extent: Box;
}

/**
 * An atomic frozen layout for exactly one committed surface revision.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Result {
    readonly Revision: number;
    readonly Views: ReadonlyArray<View>;
    readonly Items: ReadonlyArray<Item>;
}

/**
 * Associates failed content/measurement validation with its component's render-error guard.
 *
 * @category Error
 * @since 1.0.0
 */
export class LayoutError extends Error
{
    constructor(
        readonly NodeId: number,
        message: string,
        options?: ErrorOptions
    )
    {
        super(message, options);
        this.name = "LayoutError";
    }
}

/**
 * Internal measurement dimensions.
 *
 * @category Model
 * @since 1.0.0
 */
interface Size {
    readonly Width: number;
    readonly Height: number;
}

/**
 * Normalized intermediate layout tree; InputScope is expanded before flow measurement.
 *
 * @category Model
 * @since 1.0.0
 */
interface Plan {
    readonly Node: Node;
    readonly Props: Types.BoxProps & Readonly<Record<string, unknown>>;
    readonly Policy: Policy;
    readonly Children: ReadonlyArray<Plan>;
    readonly Padding: Required<Types.Insets>;
    readonly Row: boolean;
}

/**
 * Frozen local box constructor.
 *
 * @throws { RangeError } When the rectangle is nonfinite or has negative dimensions.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Rect(X: number, Y: number, Width: number, Height: number): Box
{
    if (![ X, Y, Width, Height ].every(Number.isFinite) || Width < 0 || Height < 0)
    {
        throw new RangeError("Layout produced a nonfinite or negative rectangle.");
    }

    return Object.freeze({
        Height,
        Width,
        X,
        Y
    });
}

/**
 * Intersects rectangular clips without admitting negative extents.
 *
 * @category Combining
 * @since 1.0.0
 */
export function Intersect(a: Box, b: Box): Box
{
    const x = Math.max(a.X, b.X);
    const y = Math.max(a.Y, b.Y);
    return Rect(
        x,
        y,
        Math.max(0, Math.min(a.X + a.Width, b.X + b.Width) - x),
        Math.max(0, Math.min(a.Y + a.Height, b.Y + b.Height) - y)
    );
}

/**
 * Expands nonvisual scopes for child identity and cardinality checks.
 *
 * @category Mapping
 * @since 1.0.0
 */
function VisibleChildren(nodes: ReadonlyArray<Node>): ReadonlyArray<Node>
{
    return nodes.flatMap((node: Node) =>
        node.Type === Kind.InputScope ? VisibleChildren(node.Children) : [ node ]
    );
}

/**
 * Checks resolved children and inherited fonts, including updates hidden inside composite components.
 *
 * @throws { LayoutError } If a resolved child contract is invalid.
 *
 * @category Validation
 * @since 1.0.0
 */
function Validate(
    node: Node,
    parentText?: ReturnType<typeof TextStyleOf>,
    context: Context = {
        Ancestors: [],
        Custom: false,
        InText: false,
        Spatial: false
    }
): void
{
    try
    {
        if (node.Type === "#text")
        {
            CheckText(context);
            return;
        }

        const childContext = ChildContext(context, node.Type);
        CheckProps(node.Type, node.Props);
        const children = VisibleChildren(node.Children);
        if (
            node.Type === Kind.Slot &&
            (children.length > 1 || children.some((child: Node) => child.Type !== Kind.ItemStack))
        )
        {
            throw new Error(
                "Slot accepts no child or exactly one ItemStack after component resolution."
            );
        }

        if (node.Type === Kind.Tabs && children.some((child: Node) => child.Type !== Kind.TabButton))
        {
            throw new Error("Tabs accepts only TabButton children.");
        }

        if (
            [ Kind.ItemStack, Kind.Image, Kind.Mob, Kind.Divider ].includes(
                node.Type as typeof Kind.ItemStack
            ) &&
            children.length
        )
        {
            throw new Error("This spatial leaf accepts no children.");
        }

        if (
            (node.Type === Kind.Title || node.Type === Kind.Heading) &&
            (children.length !== 1 || children[0]!.Type !== Kind.Text)
        )
        {
            throw new Error("Title and heading slots require one Text.");
        }

        const style =
            node.Type === Kind.Text
                ? TextStyleOf(node.Props as Types.TextProps, "#FFFFFF", parentText)
                : undefined;
        for (const child of node.Children)
        {
            if (style && child.Type !== "#text" && child.Type !== Kind.Text)
            {
                throw new Error("Text may only contain text and Text.");
            }

            Validate(child, style, childContext);
        }
    }
    catch (error)
    {
        if (error instanceof LayoutError)
        {
            throw error;
        }

        throw new LayoutError(node.Id, (error as Error).message, { cause: error });
    }
}

/**
 * Accumulates policy requirements without giving a nonvisual scope a geometric box.
 *
 * @category Combining
 * @since 1.0.0
 */
function PolicyOf(props: Types.BoxProps, parent: Policy): Policy
{
    return Object.freeze({
        Access: Object.freeze(props.Access ? [ ...parent.Access, props.Access ] : [ ...parent.Access ]),
        Pointer: Object.freeze({ ...parent.Pointer,
            ...props.Pointer }),
        RequiredItems: Object.freeze(
            props.RequiredItem
                ? [ ...parent.RequiredItems, props.RequiredItem ]
                : [ ...parent.RequiredItems ]
        )
    });
}

/**
 * Normalizes layout properties and transparent scopes.
 *
 * @category Mapping
 * @since 1.0.0
 */
function Plans(nodes: ReadonlyArray<Node>, parent: Policy): ReadonlyArray<Plan>
{
    return nodes.flatMap((node: Node): Array<Plan> =>
    {
        const props = node.Props as Plan["Props"];
        const policy = PolicyOf(props, parent);
        if (node.Type === Kind.InputScope)
        {
            return [ ...Plans(node.Children, policy) ];
        }

        if (node.Type === "#text")
        {
            return [];
        }

        const input = props.Padding;
        const padding =
            typeof input === "number"
                ? {
                    Bottom: input,
                    Left: input,
                    Right: input,
                    Top: input
                }
                : {
                    Bottom: input?.Bottom ?? 0,
                    Left: input?.Left ?? 0,
                    Right: input?.Right ?? 0,
                    Top: input?.Top ?? 0
                };
        return [
            {
                Children: node.Type === Kind.Text ? [] : Plans(node.Children, policy),
                Node: node,
                Padding: padding,
                Policy: policy,
                Props: props,
                Row: node.Type === Kind.Row || node.Type === Kind.Tabs || props.Direction === "row"
            }
        ];
    });
}

/**
 * Flattens only nested inline Text nodes, preserving source/color ranges.
 *
 * @category Folding
 * @since 1.0.0
 */
function Content(node: Node): Pick<TextLayout, "Value" | "Runs">
{
    let value = "";
    const runs: Array<Run> = [];
    const visit = (current: Node, id: number, color: NonNullable<Types.TextProps["Color"]>): void =>
    {
        if (current.Type === "#text")
        {
            const text = current.Text ?? "";
            runs.push(
                Object.freeze({
                    Color: color,
                    Id: id,
                    Length: text.length,
                    Start: value.length
                })
            );
            value += text;
        }
        else
        {
            for (const child of current.Children)
            {
                visit(
                    child,
                    current.Id,
                    (current.Props.Color as NonNullable<Types.TextProps["Color"]>) ?? color
                );
            }
        }
    };

    visit(node, node.Id, (node.Props.Color as NonNullable<Types.TextProps["Color"]>) ?? "#4D4D4D");
    return {
        Runs: Object.freeze(runs),
        Value: value
    };
}

/**
 * Measures and wraps Unicode code points in the requested font; caller overrides precede tables.
 * Native substitutions, byte-limit encoding and primitive calibration belong to the text renderer.
 *
 * @category Mapping
 * @since 1.0.0
 */
function Lines(plan: Plan, width?: number): ReadonlyArray<PreparedLine>
{
    const content = Content(plan.Node);
    return Prepare(content.Value, content.Runs, plan.Props as Types.TextProps, width);
}

/**
 * Measures natural or assigned content dimensions without implicit shrinking or absolute-child flow.
 *
 * @throws { LayoutError } When measurement fails or produces an invalid size.
 *
 * @category Getter
 * @since 1.0.0
 */
function Measure(plan: Plan, assignedWidth?: number, assignedHeight?: number): Size
{
    try
    {
        const props = plan.Props;
        const padding = plan.Padding;
        const width = assignedWidth ?? (typeof props.Width === "number" ? props.Width : undefined);
        const height = assignedHeight ?? (typeof props.Height === "number" ? props.Height : undefined);
        const px = padding.Left + padding.Right;
        const py = padding.Top + padding.Bottom;
        let naturalWidth = 0;
        let naturalHeight = 0;
        if (plan.Node.Type === Kind.Text)
        {
            const lines = Lines(plan, width === undefined ? undefined : Math.max(0, width - px));
            naturalWidth = Math.max(0, ...lines.map((line: Line) => line.Width));
            naturalHeight =
                lines.length * ((props.Font === "Legacy" ? 12 : 10) + ((props.LineGap as number) ?? 0)) -
                ((props.LineGap as number) ?? 0);
        }
        else
        {
            const flow = plan.Children.filter(
                (child: Plan) => child.Props.Position !== "absolute" && child.Node.Type !== Kind.Tabs
            );
            const sizes = flow.map((child: Plan) =>
                Measure(
                    child,
                    !plan.Row &&
                        props.Align === "stretch" &&
                        width !== undefined &&
                        typeof child.Props.Width !== "number"
                        ? Math.max(0, width - px)
                        : undefined,
                    plan.Row &&
                        props.Align === "stretch" &&
                        height !== undefined &&
                        typeof child.Props.Height !== "number"
                        ? Math.max(0, height - py)
                        : undefined
                )
            );
            const main =
                sizes.reduce(
                    (total: number, size: Size) => total + (plan.Row ? size.Width : size.Height),
                    0
                ) +
                Math.max(0, flow.length - 1) * (props.Gap ?? 0);
            const cross = Math.max(
                0,
                ...sizes.map((size: Size) => (plan.Row ? size.Height : size.Width))
            );
            naturalWidth = plan.Row ? main : cross;
            naturalHeight = plan.Row ? cross : main;
            if (
                plan.Node.Type === Kind.TitledPanel &&
                height !== undefined &&
                height < naturalHeight + py
            )
            {
                throw new Error("TitledPanel is too short for its title and content insets.");
            }
        }

        return {
            Height: Math.max(props.MinHeight ?? 0, height ?? naturalHeight + py),
            Width: Math.max(props.MinWidth ?? 0, width ?? naturalWidth + px)
        };
    }
    catch (error)
    {
        if (error instanceof LayoutError)
        {
            throw error;
        }

        throw new LayoutError(plan.Node.Id, (error as Error).message, { cause: error });
    }
}

/**
 * Computes layout from a candidate committed tree; failures identify the nearest component guard.
 *
 * @throws { LayoutError } If a resolved component tree cannot form a valid layout.
 *
 * @category Converting
 * @since 1.0.0
 */
export function Compute(nodes: ReadonlyArray<Node>, revision: number = 0): Result
{
    const views: Array<View> = [];
    const items: Array<Item> = [];
    const policy: Policy = Object.freeze({
        Access: Object.freeze([]),
        Pointer: Object.freeze({ Enabled: true,
            Visible: true }),
        RequiredItems: Object.freeze([])
    });
    const place = (
        plan: Plan,
        viewId: number,
        x: number,
        y: number,
        parentId?: number,
        assignedWidth?: number,
        assignedHeight?: number,
        clip?: Box,
        hidden: boolean = false,
        layer: number = 0,
        frame?: Box
    ): void =>
    {
        const props = plan.Props;
        const padding = plan.Padding;
        const size = Measure(plan, assignedWidth, assignedHeight);
        const bounds = Rect(x + (props.X ?? 0), y + (props.Y ?? 0), size.Width, size.Height);
        const content = Rect(
            bounds.X + padding.Left,
            bounds.Y + padding.Top,
            Math.max(0, bounds.Width - padding.Left - padding.Right),
            Math.max(0, bounds.Height - padding.Top - padding.Bottom)
        );
        const nodeLayer = layer + (props.Layer ?? 0);
        const nodeHidden = hidden || plan.Node.Hidden || props.Visible === false;
        const isFrame = plan.Node.Type === Kind.FramedPanel || plan.Node.Type === Kind.TitledPanel;
        const currentFrame = isFrame ? bounds : frame;
        const flow = plan.Children.filter(
            (child: Plan) => child.Props.Position !== "absolute" && child.Node.Type !== Kind.Tabs
        );
        const sizes = flow.map((child: Plan) =>
            Measure(
                child,
                !plan.Row && props.Align === "stretch" && typeof child.Props.Width !== "number"
                    ? content.Width
                    : undefined,
                plan.Row && props.Align === "stretch" && typeof child.Props.Height !== "number"
                    ? content.Height
                    : undefined
            )
        );
        const base =
            sizes.reduce(
                (total: number, value: Size) => total + (plan.Row ? value.Width : value.Height),
                0
            ) +
            Math.max(0, flow.length - 1) * (props.Gap ?? 0);
        const mainSpace = plan.Row ? content.Width : content.Height;
        const growth = flow.reduce((total: number, child: Plan) => total + (child.Props.Grow ?? 0), 0);
        const free = Math.max(0, mainSpace - base);
        const extentWidth = plan.Row
            ? Math.max(content.Width, base)
            : Math.max(content.Width, ...sizes.map((size: Size) => size.Width));
        const extentHeight = plan.Row
            ? Math.max(content.Height, ...sizes.map((size: Size) => size.Height))
            : Math.max(content.Height, base);
        const viewport = plan.Node.Type === Kind.ScrollView;
        const scroll = viewport
            ? Object.freeze({
                X: Math.min((props.ScrollX as number) ?? 0, extentWidth - content.Width),
                Y: Math.min((props.ScrollY as number) ?? 0, extentHeight - content.Height)
            })
            : undefined;
        const vertical = props.Orientation !== "horizontal";
        const track =
            viewport &&
            props.scrollbarVisibility !== "hidden" &&
            (vertical ? extentHeight > content.Height : extentWidth > content.Width)
                ? vertical
                    ? Rect(
                        content.X + Math.max(0, content.Width - ScrollbarThickness),
                        content.Y,
                        Math.min(ScrollbarThickness, content.Width),
                        content.Height
                    )
                    : Rect(
                        content.X,
                        content.Y + Math.max(0, content.Height - ScrollbarThickness),
                        content.Width,
                        Math.min(ScrollbarThickness, content.Height)
                    )
                : undefined;
        const item: Item = Object.freeze({
            Bounds: bounds,
            Clip: clip,
            Content: content,
            Depth: 0,
            Hidden: nodeHidden,
            Id: plan.Node.Id,
            Layer: nodeLayer,
            Order: items.length,
            ParentId: parentId,
            Props: props,
            Type: plan.Node.Type,
            ViewId: viewId,
            ...plan.Policy,
            Scroll: scroll,
            ...(track ? { Track: track } : {}),
            Text:
                plan.Node.Type === Kind.Text
                    ? Object.freeze({
                        ...Content(plan.Node),
                        Fallback: (props.Fallback as Types.Fallback) ?? "Mojangles",
                        FallbackScope: (props.FallbackScope as "Line" | "Text") ?? "Line",
                        Font: (props.Font ?? "Mojangles") as TextLayout["Font"],
                        Lines: Lines(plan, content.Width)
                    })
                    : undefined
        });
        items.push(item);
        const childClip = viewport ? (clip ? Intersect(clip, content) : content) : clip;
        const justifyFree = growth ? 0 : free;
        let cursor =
            props.Justify === "center" ? justifyFree / 2 : props.Justify === "end" ? justifyFree : 0;
        const gap =
            (props.Gap ?? 0) +
            (props.Justify === "space-between" && flow.length > 1 ? justifyFree / (flow.length - 1) : 0);
        flow.forEach((child: Plan, index: number) =>
        {
            const original = sizes[index]!;
            const addition = growth ? (free * (child.Props.Grow ?? 0)) / growth : 0;
            const w = original.Width + (plan.Row ? addition : 0);
            const h = original.Height + (plan.Row ? 0 : addition);
            const crossFree = Math.max(0, plan.Row ? content.Height - h : content.Width - w);
            const cross =
                props.Align === "center" ? crossFree / 2 : props.Align === "end" ? crossFree : 0;
            place(
                child,
                viewId,
                content.X + (plan.Row ? cursor : cross) - (scroll?.X ?? 0),
                content.Y + (plan.Row ? cross : cursor) - (scroll?.Y ?? 0),
                plan.Node.Id,
                w,
                h,
                childClip,
                nodeHidden,
                nodeLayer,
                currentFrame
            );
            cursor += (plan.Row ? w : h) + gap;
        });
        for (const child of plan.Children.filter(
            (entry: Plan) => entry.Props.Position === "absolute" || entry.Node.Type === Kind.Tabs
        ))
        {
            if (child.Node.Type === Kind.Tabs)
            {
                if (!currentFrame)
                {
                    throw new LayoutError(child.Node.Id, "Tabs has no frame attachment.");
                }

                const tabSize = Measure(child);
                const inset = (child.Props.Inset as number) ?? 0;
                place(
                    child,
                    viewId,
                    currentFrame.X + currentFrame.Width - inset - tabSize.Width,
                    currentFrame.Y - tabSize.Height + ((child.Props.Overlap as number) ?? 0),
                    plan.Node.Id,
                    tabSize.Width,
                    tabSize.Height,
                    clip,
                    nodeHidden || tabSize.Width > Math.max(0, currentFrame.Width - inset),
                    nodeLayer + 1,
                    currentFrame
                );
            }
            else
            {
                place(
                    child,
                    viewId,
                    content.X - (scroll?.X ?? 0),
                    content.Y - (scroll?.Y ?? 0),
                    plan.Node.Id,
                    undefined,
                    undefined,
                    childClip,
                    nodeHidden,
                    nodeLayer,
                    currentFrame
                );
            }
        }
    };

    const collect = (entries: ReadonlyArray<Node>, inherited: Policy): void =>
    {
        for (const node of entries)
        {
            if (node.Type === Kind.InputScope)
            {
                collect(node.Children, PolicyOf(node.Props, inherited));
            }
            else if (node.Type === Kind.View)
            {
                Validate(node);
                const plan = Plans([ node ], inherited)[0]!;
                const before = items.length;
                place(plan, node.Id, 0, 0);
                const bounds = items[before]!.Bounds;
                const visible = items
                    .slice(before)
                    .filter((item: Item) => !item.Hidden)
                    .map((item: Item) => (item.Clip ? Intersect(item.Bounds, item.Clip) : item.Bounds))
                    .filter((box: Box) => box.Width > 0 && box.Height > 0);
                const minX = Math.min(bounds.X, ...visible.map((box: Box) => box.X));
                const minY = Math.min(bounds.Y, ...visible.map((box: Box) => box.Y));
                const maxX = Math.max(
                    bounds.X + bounds.Width,
                    ...visible.map((box: Box) => box.X + box.Width)
                );
                const maxY = Math.max(
                    bounds.Y + bounds.Height,
                    ...visible.map((box: Box) => box.Y + box.Height)
                );
                const dimension = node.Props.Dimension as string | Types.Dimension;
                const layerDepth = (node.Props.LayerDepth as number) ?? SurfaceDefaults.LayerDepth;
                const painted = items.slice(before).filter((item: Item) => !item.Hidden);
                const depths = Depths(painted.map((item: Item) => ({
                    Bounds: item.Clip ? Intersect(item.Bounds, item.Clip) : item.Bounds,
                    Layer: item.Layer
                })), layerDepth);
                painted.forEach((item: Item, index: number): void =>
                {
                    items[item.Order] = Object.freeze({ ...item,
                        Depth: depths[index]! });
                });
                views.push(
                    Object.freeze({
                        Bounds: bounds,
                        Dimension: typeof dimension === "string" ? dimension : dimension.id,
                        Extent: Rect(minX, minY, maxX - minX, maxY - minY),
                        Id: node.Id,
                        LayerDepth: layerDepth,
                        PixelsPerBlock: (node.Props.PixelsPerBlock as number) ?? 16,
                        Transform: PoseOf(node.Props.Transform as Types.Pose | undefined)
                    })
                );
            }
        }
    };

    collect(nodes, policy);
    return Object.freeze({
        Items: Object.freeze(items),
        Revision: revision,
        Views: Object.freeze(views)
    });
}

/**
 * Returns all painted boxes at a point, front-to-back; policy denial is retained for later
 * occlusion/admission.
 * Pointer-line visibility is deliberately independent of targeting.
 *
 * @category Filtering
 * @since 1.0.0
 */
export function HitTest(layout: Result, viewId: number, point: Point): ReadonlyArray<Item>
{
    const contains = (box: Box): boolean =>
        box.Width > 0 &&
        box.Height > 0 &&
        point.X >= box.X &&
        point.Y >= box.Y &&
        point.X < box.X + box.Width &&
        point.Y < box.Y + box.Height;
    return Object.freeze(
        layout.Items.filter(
            (item: Item) =>
                item.ViewId === viewId &&
                !item.Hidden &&
                contains(item.Bounds) &&
                (!item.Clip || contains(item.Clip)) &&
                (!item.Text || item.Text.Lines.some((line: PreparedLine) =>
                    TextLineVisible(item, line) && contains({
                        Height: item.Text!.Font === "Legacy" ? 12 : 10,
                        Width: line.Width,
                        X: item.Content.X + line.X,
                        Y: item.Content.Y + line.Y
                    })))
        ).sort((a: Item, b: Item) => b.Layer - a.Layer || b.Order - a.Order)
    );
}

/**
 * Tests whether a complete text line, including its padding ink, fits the inherited ScrollView clip.
 * Native text has no scissor; omitted lines are also excluded from analytic targeting.
 *
 * @category Predicate
 * @since 1.0.0
 */
export function TextLineVisible(item: Item, line: PreparedLine): boolean
{
    const clip = item.Clip;
    const x = item.Content.X + line.X;
    const y = item.Content.Y + line.Y;
    const height = item.Text!.Font === "Legacy" ? 12 : 10;
    return !item.Hidden && line.Width > 0 && (!clip ||
        (x >= clip.X && y >= clip.Y &&
            x + Math.max(line.Width, line.PaddedWidth - line.PrefixWidth) <= clip.X + clip.Width &&
            y + height <= clip.Y + clip.Height));
}

/**
 * Rotates a vector by a normalized rigid quaternion.
 *
 * @category Transforming
 * @since 1.0.0
 */
function Rotate(q: Types.Quaternion, v: Types.Vector): Types.Vector
{
    const x = 2 * (q.y * v.z - q.z * v.y);
    const y = 2 * (q.z * v.x - q.x * v.z);
    const z = 2 * (q.x * v.y - q.y * v.x);
    return {
        x: v.x + q.w * x + q.y * z - q.z * y,
        y: v.y + q.w * y + q.z * x - q.x * z,
        z: v.z + q.w * z + q.x * y - q.y * x
    };
}

/**
 * Projects local pixels and optional world-depth offset through an arbitrary View orientation.
 *
 * @category Converting
 * @since 1.0.0
 */
export function Project(view: View, point: Point, depth: number = 0): Types.Vector
{
    const offset = Rotate(view.Transform.rotation, {
        x: point.X / view.PixelsPerBlock,
        y: -point.Y / view.PixelsPerBlock,
        z: depth
    });
    return Object.freeze({
        x: view.Transform.position.x + offset.x,
        y: view.Transform.position.y + offset.y,
        z: view.Transform.position.z + offset.z
    });
}

/**
 * Converts a world-space point back to the same committed local coordinate system used by hit-testing.
 *
 * @category Converting
 * @since 1.0.0
 */
export function Unproject(view: View, point: Types.Vector): Point
{
    const q = view.Transform.rotation;
    const p = view.Transform.position;
    const local = Rotate(
        {
            w: q.w,
            x: -q.x,
            y: -q.y,
            z: -q.z
        },
        { x: point.x - p.x,
            y: point.y - p.y,
            z: point.z - p.z }
    );
    return Object.freeze({ X: local.x * view.PixelsPerBlock,
        Y: -local.y * view.PixelsPerBlock });
}
