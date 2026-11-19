/**
 * In-game side of the glyph width measurement: shows each batch of
 * Source/GlyphProbePlan.js on a row of TextPrimitives in front of a fixed
 * camera, waits for Tool/MeasureGlyphs.mjs to photograph it, and shows the
 * progress and the estimated time left on the action bar. Driven by
 * `/scriptevent ddui_demo:glyph_probe start|next|stop` from the server console.
 *
 * @module @sorrell/ddui-image-demo/Source/GlyphProbe
 *
 * @file      GlyphProbe.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { HudElement, HudVisibility, TextPrimitive, system, world } from "@minecraft/server";
import {
    BatchColumns,
    BatchCount,
    ColumnText,
    HeaderLines,
    MarkerColors,
    ProbeCharacters
} from "./GlyphProbePlan.js";
import { ScriptEvent } from "./Keys.js";

/** Where the camera stands: high above the plain east of the gallery, looking east, where nothing else is in view. */
const CameraLocation = Object.freeze({ x: 60.5, y: -20, z: 0.5 });
/** Where the player waits during the measurement, on the ground below the camera. */
const WaitingLocation = Object.freeze({ x: 60.5, y: -60, z: 0.5 });
/** Estimated width of one font pixel at scale 1, in blocks, as in Main.js. */
const PixelSize = 0.025;
/** Font pixels between lines: the 12-pixel line pitch less 2. */
const LineGap = -2;
/** Blocks between column centers, room for the widest line of 8 copies. */
const ColumnSpacing = 85 * PixelSize;
/** Part of the screen height the columns fill, and where their center is, from the top. */
const ScreenFill = 0.7;
const ScreenCenter = 0.41;
/** Ticks after new text before the batch is announced, for the client to draw it. */
const SettleTicks = 6;
/** Ticks without an acknowledgement before the batch is announced again. */
const RepeatTicks = 200;
const Black = Object.freeze({ red: 0, green: 0, blue: 0, alpha: 1 });
const White = Object.freeze({ red: 1, green: 1, blue: 1, alpha: 1 });

/** The running measurement, or undefined. */
let Session;

/**
 * Formats a duration in milliseconds for the action bar.
 *
 * @category Formatting
 * @since 1.1.37
 */
function Duration(Milliseconds)
{
    const Seconds = Math.max(0, Math.round(Milliseconds / 1000));
    return Seconds >= 60 ? `${Math.floor(Seconds / 60)} min ${Seconds % 60} s` : `${Seconds} s`;
}

/**
 * Shows the measurement's progress and estimated time left on the player's
 * action bar. The estimate is the average time per photographed batch so far.
 *
 * @category Running
 * @since 1.1.37
 */
function ShowProgress(State)
{
    if (!State.Player.isValid) return;
    const Done = State.Batch;
    const Percent = Math.floor(Done * 100 / State.Batches);
    const Left = Done > 0 ? `~${Duration((Date.now() - State.Started) / Done * (State.Batches - Done))} left` : "estimating time left";
    State.Player.onScreenDisplay.setActionBar(
        `§fGlyph widths: batch ${Math.min(Done + 1, State.Batches)} of ${State.Batches} §7(${Percent}%) §f${Left}`);
}

/**
 * Removes the session's displays and gives the player back their view, HUD
 * and place, logging `Outcome`.
 *
 * @category Running
 * @since 1.1.37
 */
function EndSession(Outcome, Restore)
{
    const State = Session;
    if (!State) return;
    Session = undefined;
    system.clearRun(State.ProgressTimer);
    for (const Display of State.Displays)
    {
        try { Display.remove(); }
        catch { /* Already gone. */ }
    }
    if (State.Player.isValid)
    {
        try
        {
            State.Player.camera.clear();
            State.Player.onScreenDisplay.setHudVisibility(HudVisibility.Reset);
            State.Player.onScreenDisplay.setActionBar(Outcome === "DONE" ? "§aGlyph widths measured" : "§eGlyph width measurement stopped");
            Restore?.(State.Player);
        }
        catch { /* The player left. */ }
    }
    console.warn(`GLYPH_PROBE_${Outcome} ${State.Batch}/${State.Batches}`);
}

/**
 * Shows the session's current batch, then announces it in the server log for
 * the photographer, again every `RepeatTicks` until it is acknowledged.
 *
 * @category Running
 * @since 1.1.37
 */
function ShowBatch(State)
{
    const Color = MarkerColors[State.Batch % 2];
    const Columns = BatchColumns(State.Characters, State.Batch, State.Options.Columns, State.Options.Lines);
    State.Displays.forEach((Display, Index) => Display.setText(ColumnText(Columns[Index], Color)));
    const Batch = State.Batch;
    // Send the text again, as the gallery does, in case the client missed the first update.
    system.runTimeout(() =>
    {
        if (Session !== State || State.Batch !== Batch) return;
        State.Displays.forEach((Display) => Display.setText(Display.text));
    }, 2);
    const Announce = () =>
    {
        if (Session !== State || State.Batch !== Batch) return;
        console.warn(`GLYPH_PROBE_SHOT ${JSON.stringify({
            Batch, Batches: State.Batches, Color: Batch % 2, Counts: Columns.map((Column) => Column.length),
            First: Columns[0][0] ?? -1
        })}`);
        system.runTimeout(Announce, RepeatTicks);
    };
    system.runTimeout(Announce, SettleTicks);
    ShowProgress(State);
}

/**
 * Starts a measurement for the first player online, replacing a running one.
 * `Options` gives `Columns` and `Lines` (measured characters per column),
 * the camera's assumed vertical field of view `Fov` in degrees, and the code
 * points `First` to `Last`. Waits while `IsBusy` reports the gallery
 * placement in progress, or while nobody is online.
 *
 * @category Running
 * @since 1.1.37
 */
function StartSession(Options, IsBusy, Restore)
{
    if (Session?.Waiting)
    {
        system.clearRun(Session.Pending);
        Session = undefined;
    }
    else if (Session) EndSession("REPLACED");
    const Player = world.getAllPlayers()[0];
    if (!Player || IsBusy())
    {
        console.warn(`GLYPH_PROBE_WAITING ${Player ? "busy" : "no player"}`);
        Session = { Pending: system.runTimeout(() => { Session = undefined; StartSession(Options, IsBusy, Restore); }, 40), Waiting: true };
        return;
    }
    const Characters = ProbeCharacters(Options.First, Options.Last);
    const Batches = BatchCount(Characters.length, Options.Columns, Options.Lines);
    // Fit the columns' height to ScreenFill of the view at the assumed field of view.
    const Height = (Options.Lines + HeaderLines) * (12 + LineGap) * PixelSize;
    const Tangent = Math.tan(Options.Fov * Math.PI / 360);
    const Distance = Height / (ScreenFill * 2 * Tangent);
    const Lift = (0.5 - ScreenCenter) * 2 * Distance * Tangent;
    const Overworld = world.getDimension("overworld");
    Player.teleport(WaitingLocation, { dimension: Overworld });
    Player.camera.setCamera("minecraft:free", { location: CameraLocation, rotation: { x: 0, y: -90 } });
    Player.onScreenDisplay.setHudVisibility(HudVisibility.Hide,
        Object.values(HudElement).filter((Value) => typeof Value === "number"));
    // Looking east, screen left is north (-z).
    const Displays = Array.from({ length: Options.Columns }, (_, Column) =>
    {
        // Without a dimension, a shape is drawn in every dimension.
        const Display = new TextPrimitive({
            dimension: Overworld,
            x: CameraLocation.x + Distance,
            y: CameraLocation.y + Lift,
            z: CameraLocation.z + (Column - (Options.Columns - 1) / 2) * ColumnSpacing
        }, " ");
        Display.useRotation = true;
        // A TextPrimitive's yaw turns its text opposite to an entity's: 90 faces west, toward the camera.
        Display.rotation = { x: 0, y: 90, z: 0 };
        Display.depthTest = false;
        Display.scale = 1;
        Display.color = White;
        Display.textBackfaceVisible = false;
        Display.backfaceVisible = false;
        Display.lineGapHeight = LineGap;
        Display.backgroundColorOverride = Black;
        world.primitiveShapesManager.addText(Display, Overworld);
        return Display;
    });
    const State = { Batch: 0, Batches, Characters, Displays, Options, Player, Started: Date.now() };
    State.ProgressTimer = system.runInterval(() =>
    {
        if (!State.Player.isValid) EndSession("STOPPED");
        else ShowProgress(State);
    }, 20);
    Session = State;
    console.warn(`GLYPH_PROBE_STARTED ${JSON.stringify({ ...Options, Batches, Characters: Characters.length, Distance })}`);
    ShowBatch(State);
}

/**
 * Handles the measurement's script events: `start` with JSON options, `next`
 * with the number of the batch just photographed, and `stop`. `IsBusy`
 * reports work the measurement must wait for; `Restore` returns the player
 * to the gallery afterwards.
 *
 * @category Running
 * @since 1.1.37
 */
export function RegisterGlyphProbe(IsBusy, Restore)
{
    system.afterEvents.scriptEventReceive.subscribe(({ id, message }) =>
    {
        if (id !== ScriptEvent.GlyphProbe) return;
        const [ Command, ...Rest ] = message.trim().split(" ");
        const Argument = Rest.join(" ");
        if (Command === "start")
        {
            const Given = Argument ? JSON.parse(Argument) : {};
            StartSession({ Columns: 6, Fov: 40, First: 0, Last: 0xffff, Lines: 23, ...Given }, IsBusy, Restore);
        }
        else if (Command === "next")
        {
            const State = Session;
            if (!State || State.Waiting || Number(Argument) !== State.Batch) return;
            State.Batch++;
            if (State.Batch >= State.Batches) EndSession("DONE", Restore);
            else ShowBatch(State);
        }
        else if (Command === "stop")
        {
            if (Session?.Waiting)
            {
                system.clearRun(Session.Pending);
                Session = undefined;
                console.warn("GLYPH_PROBE_STOPPED waiting");
            }
            else EndSession("STOPPED", Restore);
        }
    });
}
