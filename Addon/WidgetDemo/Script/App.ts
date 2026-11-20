/**
 * The demonstration's React widgets: a shared scene of controls, access and scrolling panels, and a
 * private per-player status panel that follows the pointer through useSyncExternalStore.
 *
 * @module @sorrell/widget-demo/Script/App
 *
 * @file      App.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as Access from "../../../Package/Bedform/Source/Spatial/Access.js";
import * as C from "../../../Package/Bedform/Source/Spatial/Components.js";
import type * as Pointer from "../../../Package/Bedform/Source/Spatial/Pointer.js";
import * as React from "../../../Package/Bedform/Source/Spatial/React/index.js";
import { Center, Panel, PixelsPerBlock, Top } from "./Scene.js";
import type { ReactElement } from "../../../Package/Bedform/Source/Spatial/React/index.js";

const h = React.createElement;
const Dimension = "minecraft:overworld";
const Width = 128;

/**
 * Line colors for denied hits, keyed by denial.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DeniedColors = Object.freeze({
    access: "#FF5555",
    disabled: "#AAAAAA",
    distance: "#AAAAAA",
    item: "#FF55FF"
} as const);

/**
 * Colors denied hits by reason, keeping the default otherwise.
 *
 * @category Getter
 * @since 1.0.0
 */
function ColorByDenial(context: Pointer.ColorContext): string | undefined
{
    return context.Denial ? DeniedColors[context.Denial] : undefined;
}

/**
 * A titled light panel filling one View.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Card(props: { readonly Title: string;
    readonly X: number;
    readonly children?: C.Child; }): ReactElement
{
    return h(C.View, {
        Dimension,
        PixelsPerBlock,
        Transform: Panel(props.X, Width),
        Width
    }, h(C.Panel, {
        Gap: 4,
        Padding: 6,
        Width
    }, h(C.Text, { Color: "#202020" }, props.Title), props.children));
}

/**
 * A button with a Text label.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Labeled(label: string, props: C.ButtonProps = {}): ReactElement
{
    return h(C.Button, { Align: "center",
        ...props }, h(C.Text, null, label));
}

/**
 * Counter, toggle, click-to-set slider and pointer-setting examples.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Controls(): ReactElement
{
    const [ count, setCount ] = React.useState(0);
    const [ lamp, setLamp ] = React.useState(false);
    const [ level, setLevel ] = React.useState(0.5);
    return h(Card, { Title: "Controls",
        X: Center.Controls },
    h(C.Row, { Align: "center",
        Gap: 4 },
    Labeled("-", { OnActivate: () => setCount((value: number) => value - 1),
        Width: 20 }),
    h(C.Text, { TextAlign: "center",
        Width: 64 }, `Count ${count}`),
    Labeled("+", { OnActivate: () => setCount((value: number) => value + 1),
        Width: 20 })),
    h(C.Toggle, { Checked: lamp,
        OnChange: (checked: boolean) => setLamp(checked),
        Padding: { Bottom: 4,
            Left: 38,
            Right: 4,
            Top: 6 } }, h(C.Text, null, lamp ? "Lamp on" : "Lamp off")),
    h(C.Slider, { OnChange: (value: number) => setLevel(value),
        Value: level }),
    h(C.Text, null, `Level ${Math.round(level * 100)}%`),
    h(C.Row, { Gap: 4 },
        Labeled("No line", { Grow: 1,
            Pointer: { Visible: false } }),
        Labeled("Near only", { Grow: 1,
            Pointer: { MaxDistance: 5 } })));
}

/**
 * Player limits, locks and required items, colored by denial.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Seats(props: { readonly Seat: Access.Controller;
    readonly OnLock: (viewerId: string) => void; }): ReactElement
{
    const [ turns, setTurns ] = React.useState(0);
    return h(Card, { Title: "Access: one player at a time",
        X: Center.Access },
    h(C.InputScope, { Access: props.Seat },
        Labeled("Take a turn", { OnActivate: () => setTurns((value: number) => value + 1),
            Pointer: { Color: ColorByDenial } })),
    h(C.Text, null, `Turns taken: ${turns}`),
    h(C.Row, { Gap: 4 },
        Labeled("Lock to me", { Grow: 1,
            OnActivate: (event: C.Activation) => props.OnLock(event.ViewerId) }),
        Labeled("Unlock", { Grow: 1,
            OnActivate: () => props.OnLock("") })),
    Labeled("Needs the key", { OnActivate: () => setTurns(0),
        Pointer: { Color: ColorByDenial },
        RequiredItem: "widget_demo:key" }),
    Labeled("Disabled", { Disabled: true,
        Pointer: { Color: ColorByDenial } }));
}

/**
 * A hover-scrollbar list with paging buttons.
 *
 * @category Constructor
 * @since 1.0.0
 */
function List(): ReactElement
{
    const rows = 12;
    const rowHeight = 18;
    const viewport = 54;
    const limit = rows * rowHeight - viewport;
    const [ offset, setOffset ] = React.useState(0);
    const [ picked, setPicked ] = React.useState("none");
    const page = (delta: number): void =>
        setOffset((value: number) => Math.max(0, Math.min(limit, value + delta)));
    return h(Card, { Title: "Scrolling",
        X: Center.Scroll },
    h(C.ScrollView, { Height: viewport,
        OnActivate: () => setOffset((value: number) =>
            (value >= limit ? 0 : Math.min(limit, value + viewport))),
        ScrollY: offset,
        Width: 116,
        scrollbarVisibility: "hover" },
    ...Array.from({ length: rows }, (_: unknown, index: number) =>
        Labeled(`Item ${index + 1}`, { Height: rowHeight,
            OnActivate: () => setPicked(`Item ${index + 1}`),
            Width: 108,
            key: index } as C.ButtonProps))),
    h(C.Row, { Gap: 4 },
        Labeled("Up", { Grow: 1,
            OnActivate: () => page(-rowHeight) }),
        Labeled("Down", { Grow: 1,
            OnActivate: () => page(rowHeight) })),
    h(C.Text, null, `Picked: ${picked}`));
}

/**
 * The shared scene rendered once for every player.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Scene(props: { readonly Seat: Access.Controller;
    readonly OnLock: (viewerId: string) => void; }): ReactElement
{
    return h(C.ThemeProvider, { theme: "light" },
        h(Controls),
        h(Seats, props),
        h(List),
        h(C.View, {
            Dimension,
            PixelsPerBlock,
            Transform: Panel(Center.Gallery, Width, Top),
            Width
        }, h(C.Panel, { Padding: 3,
            Width }, h(C.Text, { Color: "#202020" }, "Canvas art and glyphs below"))));
}

/**
 * Describes a pointer state in a few words.
 *
 * @category Converting
 * @since 1.0.0
 */
export function Describe(state: Pointer.State | undefined): string
{
    if (!state)
    {
        return "nothing";
    }

    const type = state.Target.Type.replace(/^bedform:/u, "");
    const part = state.Target.Part === "track" ? " track" : "";
    const status = state.Eligible ? "ready" : state.Denial ?? "not interactive";
    return `${type}${part}, ${state.Target.Distance.toFixed(1)} blocks, ${status}`;
}

/**
 * A private panel, shown only to its own player, that tracks that player's pointer.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Status(props: { readonly Name: string;
    readonly PlayerId: string;
    readonly Tracker: () => Pointer.Tracker | undefined; }): ReactElement
{
    const subscribe = React.useCallback((notify: () => void): (() => void) =>
        props.Tracker()?.Subscribe(() => notify()) ?? ((): void => undefined), [ props ]);
    const aim = React.useSyncExternalStore(subscribe,
        (): string => Describe(props.Tracker()?.Get(props.PlayerId)));
    return h(C.ThemeProvider, { theme: "light" },
        h(Card, { Title: `Only ${props.Name} sees this`,
            X: Center.Status },
        h(C.Text, null, "You are aiming at:"),
        h(C.Text, { Color: "#1F5FBF" }, aim),
        h(C.Text, { Color: "#555555" }, "Hold the wand or key and"),
        h(C.Text, { Color: "#555555" }, "press Use to activate.")));
}
