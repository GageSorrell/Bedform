/**
 * Text display fixture: a Unicode browser and a row of TextPrimitive test
 * charts ahead of spawn, with a compass-launched DDUI character inspector.
 *
 * @module @sorrell/ddui-image-demo/Source/Main
 *
 * @file      Main.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import {
    CommandPermissionLevel,
    CustomCommandStatus,
    ItemStack,
    Player,
    TextPrimitive,
    system,
    world
} from "@minecraft/server";
import { ObservableNumber, ObservableString } from "@minecraft/server-ui";
import { CustomForm } from "../../../Package/Bedform/Source/DDUI/CustomForm.ts";
import { CharacterChart, CharacterSets, SeparatorTestText } from "./CharacterSets.js";
import { LineByteLimit, LineHeight, LongestLineBytes, MeasureText, RowLayout, UnicodeLineHeight, WrapText } from "./Layout.js";
import { OddCharacterCases } from "./OddCharacters.js";
import { GlyphOnly, GlyphOnlyLineGap, OverlayColors, OverlayTests, SplitOverlay } from "./GlyphOverlay.js";
import { PixelOffsetTests } from "./PixelOffsets.js";
import { RegionDemo, RegionText } from "./RegionLayer.js";
import { RegisterGlyphProbe } from "./GlyphProbe.js";
import { PlaceTextureTest } from "./TextureTest.js";
import { ClearOrbitEntities, PlaceOrbitTests } from "./AttachedOrbit.js";
import { PlaceHopTest } from "./HopTest.js";
// Gives each joining player a cube to carry.
import "./HeldCube.js";
import {
    FlatDimension,
    FlatGroundTop,
    MoveToFlat,
    PrepareFlatDimension,
    WhenFlatReady
} from "./FlatDimension.js";
import { Command } from "./Keys.js";
import { CustomGlyphAdvance } from "./CustomGlyph.js";
import { BrailleCanvas, BrailleFrame, TerminalTable } from "./TerminalArt.js";
import {
    Categories,
    CodePointAt,
    DescribeCharacter,
    DisplayCharacter,
    FirstPageOf,
    Hex,
    Page,
    PageColumns,
    PageCount,
    PageHeading,
    PageRowCount,
    PageText
} from "./UnicodeBrowser.js";

const Compass = "ddui_demo:form_compass";
const LineGapTool = "ddui_demo:line_gap_tool";
const PageTurner = "ddui_demo:unicode_page_turner";
const TextWriter = "ddui_demo:text_writer";
const OpenForms = new Set();
/** Opaque black, the background of every TextPrimitive. */
const Black = Object.freeze({ red: 0, green: 0, blue: 0, alpha: 1 });
const White = Object.freeze({ red: 1, green: 1, blue: 1, alpha: 1 });
/** Width of one font pixel at scale 1, in blocks. Estimated; calibrate it with the line gap clock. */
let PixelSize = 0.025;
/** Fully transparent: the reference displays have no background. */
const Clear = Object.freeze({ red: 0, green: 0, blue: 0, alpha: 0 });
/** Light purple at 60% opacity, the reference displays' text color. */
const ReferencePurple = Object.freeze({ red: 0.8, green: 0.65, blue: 1, alpha: 0.6 });
/** Gap, in blocks, between a back-row case and the reference display beside it. */
const ReferenceGap = 0.1;
/** Scale of every row display and of the browser title; the browser heading is slightly smaller. */
const RowScale = 0.7875;
const HeadingScale = 0.65;
/** Vertical gap, in blocks, between the browser page, its heading and its title. */
const StackGap = 0.25;
const BrowserTitle = "Unicode Browser";
/** Prefixes every line with a reset and a color, so each line is formatted on its own. */
const Colored = (Text, Color) => Text.split("\n").map((Line) => `§r${Color}${Line}`).join("\n");
/**
 * The row, in order from nearest spawn to farthest ahead: the selected
 * character, the Unicode browser page, the character charts, both terminal
 * tables and the separator test (the fireflies canvas has a row of its own,
 * `AnimationEntries`, since 1.1.67). Read from the
 * spawn side, that is left to right. The animated canvas takes the chosen line
 * gap.
 */
/** Charts of Symbols for Legacy Computing characters, shown as overlays of the custom glyphs. */
const OverlayCharts = new Set([ "Sextants", "Octants", "Diagonal lines" ]);
const GalleryEntries = [
    { Name: "Selected character", Selected: true },
    { Browser: true, Name: "Unicode browser" },
    ...CharacterSets.map((Set) =>
    {
        if (!OverlayCharts.has(Set.Name)) return { Name: Set.Name, Text: Colored(CharacterChart(Set), Set.TextColor ?? "§f") };
        const Text = Colored(CharacterChart(Set), OverlayColors.Ink);
        // Symbols for Legacy Computing charts show the custom glyphs through a two-layer overlay.
        const { Back, Front } = SplitOverlay(Text);
        return { Back, Name: Set.Name, Text: Front };
    }),
    { Name: "Terminal table", Text: Colored("Terminal table\n" + TerminalTable(), "§f") },
    // Its box rules are 126 bytes, so the pink (§d) comes from the display color instead of per-line codes.
    { Color: { red: 1, green: 1 / 3, blue: 1, alpha: 1 }, Name: "Fullwidth terminal table",
        Text: "Fullwidth terminal table\n" + TerminalTable(true) },
    // No formatting codes: the top line is only a's. The display color makes it white.
    { Name: "Separator test", Text: SeparatorTestText }
].map((Entry) => Object.freeze({
    ...Entry,
    Measure: Entry.Browser || Entry.Selected ? undefined : MeasureText(Entry.Text ?? Entry.Frame(0)),
    Scale: RowScale
}));
const BrowserIndex = GalleryEntries.findIndex((Entry) => Entry.Browser);
const SelectedIndex = GalleryEntries.findIndex((Entry) => Entry.Selected);
/**
 * The row behind the browser page, back to back with it, left to right as seen
 * from behind: one place per odd character case, holding the case and, 0.1
 * blocks to its right, its reference display (the same lines without the
 * studied characters). Widths are in font pixels. Each title is wrapped to the
 * pair's width at the initial pixel size (never splitting a word) and stands
 * centered above the pair; a wider title widens the pair's place in the row.
 */
const BackEntries = OddCharacterCases.map((Entry) =>
{
    const Measure = MeasureText(Entry.Text);
    const ReferenceWidth = MeasureText(Entry.Reference).Width;
    const TitleText = WrapText(Entry.Title, Measure.Width + ReferenceGap / (PixelSize * RowScale) + ReferenceWidth);
    return Object.freeze({
        ...Entry,
        DisplayWidth: Measure.Width,
        Lines: Measure.Lines,
        Name: Entry.Title,
        ReferenceWidth,
        Scale: RowScale,
        TitleText,
        TitleWidth: MeasureText(TitleText).Width
    });
});
/**
 * The pixel offset row across the aisle in front of the main row, left to
 * right as seen from the aisle. Each title is wrapped to its display's width
 * and stands above it; a wider title widens the display's place in the row.
 */
const OffsetEntries = [ ...PixelOffsetTests, ...OverlayTests, RegionDemo() ].map((Entry) =>
{
    const Measure = Entry.Measure ?? MeasureText(Entry.Text);
    // A half-scale display measures in its own pixels, half the title's.
    const Ratio = Entry.HalfScale ? 2 : 1;
    const TitleText = WrapText(Entry.Title, Measure.Width / Ratio);
    return Object.freeze({
        ...Entry,
        Measure: { Lines: Measure.Lines, Width: Math.max(Measure.Width, MeasureText(TitleText).Width * Ratio) },
        Name: Entry.Title,
        Scale: RowScale / Ratio,
        TitleText
    });
});
/** The title of the glyph-only fireflies display, which cannot hold letters itself. */
const FirefliesGlyphTitle = "Fireflies in octants, glyphs only (two layers)";

/**
 * The animation row: the Braille fireflies canvas, and right beside it the
 * same animation as a seamless glyph-only display, each Braille cell an
 * octant (`GlyphOnly`), in two half-scale layers with `GlyphOnlyLineGap`,
 * its title a display of its own above it. Both are set from the same moment
 * in the same tick, so they show the same frame.
 */
const AnimationEntries = (() =>
{
    const Glyphs = GlyphOnly(BrailleCanvas(0));
    return Object.freeze([
        Object.freeze({ Frame: BrailleFrame, Measure: MeasureText(BrailleFrame(0)), Name: "Fireflies", Scale: RowScale }),
        Object.freeze({
            LineGap: GlyphOnlyLineGap,
            Measure: { Lines: Glyphs.A.split("\n").length, Width: Glyphs.Cells * CustomGlyphAdvance },
            Name: FirefliesGlyphTitle,
            Pitch: UnicodeLineHeight,
            Scale: RowScale / 2,
            Title: FirefliesGlyphTitle
        })
    ]);
})();

const Checked = [
    { Name: "Fireflies", Text: BrailleFrame(0) },
    { Name: "Fireflies glyphs, first layer", Text: GlyphOnly(BrailleCanvas(0)).A },
    { Name: "Fireflies glyphs, second layer", Text: GlyphOnly(BrailleCanvas(0)).B },
    ...GalleryEntries,
    ...BackEntries,
    ...OffsetEntries,
    ...OffsetEntries.flatMap((Entry) => (Entry.Regions ?? []).map((Spec) => ({
        Name: `${Entry.Name} region k=${Spec.K}`,
        Text: RegionText({ Cells: 12, Lines: 5, Scale: Entry.Scale }, Spec.Box, Spec.K, Spec.Family, Spec.Inside).Text
    }))),
    ...[ ...GalleryEntries, ...OffsetEntries ].filter(({ Back }) => Back !== undefined).map(({ Back, Name }) => ({
        Name: `${Name} back`,
        Text: Back
    })),
    ...OffsetEntries.filter(({ Middle }) => Middle !== undefined).map(({ Middle, Name }) => ({
        Name: `${Name} middle`,
        Text: Middle
    })),
    ...BackEntries.map(({ Name, Reference }) => ({ Name: `${Name} reference`, Text: Reference })),
    ...BackEntries.map(({ TitleText }) => ({ Name: TitleText, Text: TitleText }))
];
for (const Entry of Checked)
{
    if (Entry.Browser || Entry.Selected) continue;
    const Bytes = LongestLineBytes(Entry.Text ?? Entry.Frame(0));
    if (Bytes > LineByteLimit)
    {
        console.error(`${Entry.Name}: a ${Bytes}-byte line exceeds the ${LineByteLimit}-byte TextPrimitive limit.`);
    }
}

let GalleryDisplays = [];
/** The browser's title and heading displays, stacked above its page. */
let BrowserHeader;
/** The displays behind the browser page, each with its title display. */
let BackDisplays = [];
/** The pixel offset displays across the aisle, each with its title display. */
let OffsetDisplays = [];
/** The animation row's displays: the Braille fireflies canvas and the glyph-only copy's layers and title. */
let AnimationDisplays;
/** The pixel size the back row was last laid out for. */
let BackPixelSize;
let GalleryPlacement;
let BrowserPage = 0;

/**
 * Text of the selected-character display: the character between "ab" and
 * "rl", with a space until a form slider selects a character.
 */
const InitialSelectedText = "ab rl";
let SelectedText = InitialSelectedText;
let AdjustableLineGapHeight = -4;
/** Fixed `lineGapHeight` of the pixel offset displays, so their lines sit close together. */
const OffsetLineGap = -4;
/**
 * Large-font pixels, at the front's scale, an overlay's back sits below its
 * front, and the back's `lineGapHeight`. A back line holding a custom glyph
 * is spaced 1 front pixel wider than its gap suggests: with the back's gap at
 * 12 + 2 x -4 = 4, the second line's glyphs sat 1 front pixel (2
 * Unicode-font pixels) low (1.1.43), so the gap is 2 less. With that gap, a
 * drop of 1.5 left every line's glyphs 1 Unicode-font pixel high (1.1.44),
 * so the drop was 2; since 1.1.50 it is doubled to 4, at the user's request.
 */
const OverlayDrop = 4;
/**
 * The overlays' line gaps. Every overlay line is in the Unicode font, 10
 * pixels tall, so a front gap of -2 spaces lines 8 large-font pixels apart:
 * 16 Unicode-font pixels, one custom glyph's height, so glyph rows stack with
 * no gap or overlap. The back, at half scale, needs twice that pitch in its
 * own pixels: 10 + 6 = 16.
 */
const OverlayFrontGap = -2;
const OverlayBackGap = 2 * (UnicodeLineHeight + OverlayFrontGap) - UnicodeLineHeight;

/**
 * Blocks an overlay's back sits behind its front, away from the viewer. Both
 * layers have depth testing, so the front's text stays in front of the
 * back's background whatever order the client draws them in: it seems to
 * draw nearer displays last, and the dropped back, nearer to a viewer below
 * the display's center, hid the front's text (1.1.51).
 */
const OverlayDepth = 0.005;

/**
 * Where an overlay's back goes for its front's location, with the front
 * facing `Facing`: `OverlayDrop` font pixels lower, by the current estimate
 * of a font pixel's size, and `Depth` (by default `OverlayDepth`) behind it.
 * A seamless overlay's middle layer goes half as far behind.
 *
 * @category Running
 * @since 1.1.43
 */
function OverlayBack(Location, Facing, Depth = OverlayDepth)
{
    // A display facing `Facing` shows its text toward (-sin, -cos), so behind it is (sin, cos).
    return {
        x: Location.x + Math.sin(Facing) * Depth,
        y: Location.y - OverlayDrop * PixelSize * RowScale,
        z: Location.z + Math.cos(Facing) * Depth
    };
}

/**
 * Where a middle layer goes for its entry's display at `Location`: a seamless
 * overlay's between its back and its front, `OverlayDepth / 2` behind the
 * front and dropped with the back; a glyph-only display's that far in front
 * of its first layer, at the same height.
 *
 * @category Running
 * @since 1.1.66
 */
function MiddleLocation(Entry, Location, Facing)
{
    if (!Entry.GlyphOnly)
    {
        return OverlayBack(Location, Facing, OverlayDepth / 2);
    }

    return {
        x: Location.x - Math.sin(Facing) * OverlayDepth / 2,
        y: Location.y,
        z: Location.z - Math.cos(Facing) * OverlayDepth / 2
    };
}

/**
 * Adds an entry's middle layer, the second of a seamless pair of half-scale
 * layers: transparent, at the entry's half scale and line gap (the back's for
 * an overlay, `GlyphOnlyLineGap` for a glyph-only display), with depth
 * testing, at `MiddleLocation`.
 *
 * @category Running
 * @since 1.1.66
 */
function AddMiddle(Dimension, Entry, Location, Facing)
{
    const Middle = AddText(Dimension, MiddleLocation(Entry, Location, Facing), Entry.Middle, Facing, {
        Background: Clear,
        Scale: Entry.GlyphOnly ? Entry.Scale : RowScale / 2
    });
    Middle.lineGapHeight = Entry.GlyphOnly ? Entry.LineGap : OverlayBackGap;
    Middle.depthTest = true;
    return Middle;
}

/**
 * Places a region relative to glyph layer A, one quarter OverlayDepth in
 * front of B. Horizontal offsets use local screen-right; PixelSize is uncalibrated.
 *
 * @category Running
 * @since 1.1.68
 */
function RegionLocation(Entry, Location, Facing, Spec)
{
    const Anchor = Entry.GlyphOnly ? Location : OverlayBack(Location, Facing);
    const B = MiddleLocation({ GlyphOnly: true }, Anchor, Facing);
    return {
        x: B.x - Math.sin(Facing) * OverlayDepth / 4 - Math.cos(Facing) * Spec.LocationOffset.x,
        y: Anchor.y + Spec.LocationOffset.y,
        z: B.z - Math.cos(Facing) * OverlayDepth / 4 + Math.sin(Facing) * Spec.LocationOffset.x
    };
}

/**
 * Creates all regions of an entry and rolls them back if creation fails.
 *
 * @category Running
 * @since 1.1.68
 */
function AddRegions(Dimension, Entry, Location, Facing)
{
    const Regions = [];
    try
    {
        for (const Definition of Entry.Regions ?? [])
        {
            const Spec = RegionText({
                Cells: Entry.Cells ?? Entry.Measure.Width / 8,
                Lines: Entry.Measure.Lines,
                Scale: Entry.GlyphOnly ? Entry.Scale : RowScale / 2
            }, Definition.Box, Definition.K, Definition.Family, Definition.Inside,
            { ...Definition.Options, PixelSize });
            const Display = AddText(Dimension, RegionLocation(Entry, Location, Facing, Spec), Spec.Text, Facing,
                { Background: Clear, Scale: Spec.Scale });
            Regions.push({ Display, Spec, PixelSizeAtCreation: PixelSize });
            Display.lineGapHeight = GlyphOnlyLineGap;
            Display.depthTest = true;
        }
        return Regions;
    }
    catch (Error)
    {
        for (const { Display } of Regions) Display.remove();
        throw Error;
    }
}

/**
 * Flattens an animation record, including its attached region primitives.
 *
 * @category Getter
 * @since 1.1.68
 */
function AnimationPrimitives(Record)
{
    if (!Record) return [];
    const { Regions = [], ...Displays } = Record;
    return [ ...Object.values(Displays), ...Regions.map(({ Display }) => Display) ];
}

/**
 * Moves attached regions, rescaling world offsets when the pixel calibration changes.
 *
 * @category Running
 * @since 1.1.68
 */
function MoveRegions(Regions, Entry, Location, Facing)
{
    for (const { Display, Spec, PixelSizeAtCreation } of Regions)
        Display.setLocation(InOverworld(RegionLocation(Entry, Location, Facing, {
            ...Spec, LocationOffset: { ...Spec.LocationOffset, x: Spec.LocationOffset.x * PixelSize / PixelSizeAtCreation }
        })));
}

/**
 * Adds an overlay's back for a front at `Location`: at half the row's scale,
 * `OverlayBack`'s place, with the black background and `OverlayBackGap`
 * between lines, and depth testing. Its front needs a transparent background,
 * `OverlayFrontGap` and depth testing too.
 *
 * @category Running
 * @since 1.1.48
 */
function AddOverlayBack(Dimension, Location, Text, Facing)
{
    const Back = AddText(Dimension, OverlayBack(Location, Facing), Text, Facing, {
        Background: OverlayColors.Background,
        Scale: RowScale / 2
    });
    // Half the scale halves the line pitch, so its gap makes up the difference.
    Back.lineGapHeight = OverlayBackGap;
    Back.depthTest = true;
    return Back;
}
/** Distance from spawn, in blocks, to the row; the first display is centered straight ahead. */
const GalleryDistance = 6;
/** Blocks every display sits below the height the row layout would otherwise choose. */
const GalleryLowering = 0.2;
/**
 * Turn, in radians, of the whole arrangement about the selected-character
 * display: a quarter turn counterclockwise seen from above, so the row runs
 * straight away from spawn with its text facing the spawn side.
 */
const GalleryTurn = Math.PI / 2;
/** Distance, in blocks, from the browser page's plane to the row behind it. */
const BackDistance = 3;
/** Distance, in blocks, from the pixel offset row to the animation row beyond it. */
const AnimationDistance = 3;
/**
 * Distance, in blocks, from the browser page's plane to the pixel offset row
 * on the spawn side. That row faces the main row across this aisle, where
 * joining players stand.
 */
const AisleDistance = 10;
let SpawnSerial = 0;
/** Tick of each player's last page turn, so one press that fires both use events turns one page. */
const LastTurn = new Map();

system.runInterval(() =>
{
    if (!AnimationDisplays || world.getAllPlayers().length === 0) return;
    const Seconds = system.currentTick / 20;
    try
    {
        // One moment for both, set in one tick, so the Braille canvas and its glyph-only copy show the same frame.
        const { A, B } = GlyphOnly(BrailleCanvas(Seconds));
        AnimationDisplays.Fireflies.setText(BrailleFrame(Seconds));
        AnimationDisplays.A.setText(A);
        AnimationDisplays.B.setText(B);
    }
    catch (Error)
    {
        AnimationDisplays = undefined;
        console.error(`Braille animation: ${Error}`);
    }
}, 1);

/**
 * Returns an entry's current text: the browser page, an animation frame or
 * fixed text.
 *
 * @category Running
 * @since 1.1.19
 */
function EntryText(Entry)
{
    if (Entry.Browser) return PageText(BrowserPage);
    if (Entry.Selected) return SelectedText;
    return Entry.Text ?? Entry.Frame(system.currentTick / 20);
}

/**
 * Returns the row entries with their measured text: the current browser page
 * and selected character, or, for a reference layout, the first page and the
 * initial selected text.
 *
 * @category Running
 * @since 1.1.24
 */
function RowEntries(Reference)
{
    return GalleryEntries.map((Entry) =>
    {
        let Text = EntryText(Entry);
        if (Reference && Entry.Browser) Text = PageText(0);
        if (Reference && Entry.Selected) Text = InitialSelectedText;
        const LineGap = Entry.Frame ? AdjustableLineGapHeight : Entry.Back === undefined ? 0 : OverlayFrontGap;
        const Pitch = Entry.Back === undefined ? LineHeight : UnicodeLineHeight;
        return { ...Entry, LineGap, Measure: Entry.Measure ?? MeasureText(Text), Pitch };
    });
}

/**
 * Computes the fixed points of a placement from the reference layout: where
 * the selected-character display sits before the turn, the pivot it keeps
 * through the turn and every later change of width, and where the browser
 * page sits after the turn, which the row behind it is centered on.
 *
 * @category Running
 * @since 1.1.24
 */
function GalleryAnchors(Origin, Facing, GroundTop)
{
    const Common = { GroundTop: GroundTop - GalleryLowering, PixelSize };
    const Before = RowLayout(RowEntries(true), {
        ...Common, Anchor: BrowserIndex, Distance: GalleryDistance, Facing, Origin
    });
    const Pivot = Before[SelectedIndex].Location;
    const After = RowLayout(RowEntries(true), {
        ...Common, Anchor: SelectedIndex, Center: Pivot, Facing: Facing + GalleryTurn
    });
    return { BackCenter: After[BrowserIndex].Location, Pivot };
}

/**
 * Computes every location for a placement with the current pixel size, line
 * gap, browser page and selected character. The row is turned about the
 * selected-character display, which stays at the placement's pivot. The
 * browser's heading and title stack above its page. The row behind the
 * browser faces the other way, `BackDistance` blocks behind the page's plane:
 * each case with its reference display to its right and its title centered
 * above the pair.
 *
 * @category Running
 * @since 1.1.19
 */
function GalleryLayout(Placement)
{
    const Facing = Placement.Facing + GalleryTurn;
    // Lowering the ground reference lowers every center, and the titles stack on their displays.
    const Common = { GroundTop: Placement.GroundTop - GalleryLowering, PixelSize };
    const Row = RowLayout(RowEntries(false), { ...Common, Anchor: SelectedIndex, Center: Placement.Pivot, Facing });
    const Browser = Row[BrowserIndex];
    const Height = (Text, Scale) => MeasureText(Text).Lines * LineHeight * PixelSize * Scale;
    // From the top of the display's text, which may reach above half its height (see RowLayout's Reach).
    const Above = (Display, Text, Scale) =>
        Display.Location.y + Math.max(Display.Height / 2, Display.Reach ?? 0) + StackGap + Height(Text, Scale) / 2;
    const Heading = PageHeading(BrowserPage);
    const HeadingY = Above(Browser, Heading, HeadingScale);
    const TitleY = HeadingY + Height(Heading, HeadingScale) / 2 + StackGap + Height(BrowserTitle, RowScale) / 2;
    const BackCenter = {
        x: Placement.BackCenter.x + Math.sin(Facing) * BackDistance,
        z: Placement.BackCenter.z + Math.cos(Facing) * BackDistance
    };
    const BackFacing = Facing + Math.PI;
    const Gap = ReferenceGap / (PixelSize * RowScale);
    const PairWidth = (Entry) => Entry.DisplayWidth + Gap + Entry.ReferenceWidth;
    const Slots = RowLayout(BackEntries.map((Entry) => ({
        ...Entry,
        Measure: { Lines: Entry.Lines, Width: Math.max(PairWidth(Entry), Entry.TitleWidth) }
    })), { ...Common, Center: BackCenter, Facing: BackFacing });
    // The back row's right, as seen from behind, matching RowLayout's.
    const Right = { x: -Math.cos(BackFacing), z: Math.sin(BackFacing) };
    const Block = PixelSize * RowScale;
    const Along = (Location, Offset) => ({ ...Location, x: Location.x + Right.x * Offset, z: Location.z + Right.z * Offset });
    // The pixel offset row faces the main row from the spawn side of the aisle.
    const OffsetFacing = Facing + Math.PI;
    const OffsetCenter = {
        x: Placement.BackCenter.x - Math.sin(Facing) * AisleDistance,
        z: Placement.BackCenter.z - Math.cos(Facing) * AisleDistance
    };
    // Every offset display has OffsetLineGap, which the row's heights must count, or tall displays raise the row.
    const OffsetSlots = OffsetEntries.map((Entry) => Entry.Back === undefined ? { ...Entry, LineGap: Entry.LineGap ?? OffsetLineGap }
        : { ...Entry, LineGap: OverlayFrontGap, Pitch: UnicodeLineHeight });
    const OffsetCases = RowLayout(OffsetSlots, { ...Common, Center: OffsetCenter, Facing: OffsetFacing })
        .map((Slot, Index) => ({
            Display: Slot.Location,
            Title: { ...Slot.Location, y: Above(Slot, OffsetEntries[Index].TitleText, RowScale) }
        }));
    const BackCases = Slots.map((Slot, Index) =>
    {
        const Entry = BackEntries[Index];
        const Pair = PairWidth(Entry) * Block;
        return {
            Display: Along(Slot.Location, (Entry.DisplayWidth * Block - Pair) / 2),
            Reference: Along(Slot.Location, (Pair - Entry.ReferenceWidth * Block) / 2),
            Title: { ...Slot.Location, y: Above(Slot, Entry.TitleText, RowScale) }
        };
    });
    // The animation row stands beyond the pixel offset row, facing the way the main row does.
    const AnimationCenter = {
        x: Placement.BackCenter.x - Math.sin(Facing) * (AisleDistance + AnimationDistance),
        z: Placement.BackCenter.z - Math.cos(Facing) * (AisleDistance + AnimationDistance)
    };
    const AnimationSlots = RowLayout(AnimationEntries.map((Entry) =>
        Entry.Frame ? { ...Entry, LineGap: AdjustableLineGapHeight } : Entry), { ...Common, Center: AnimationCenter, Facing });
    const AnimationCases = AnimationSlots.map((Slot, Index) => ({
        Display: Slot.Location,
        Title: AnimationEntries[Index].Title === undefined ? undefined
            : { ...Slot.Location, y: Above(Slot, AnimationEntries[Index].Title, RowScale) }
    }));
    return {
        AnimationCases,
        BackCases,
        BackFacing,
        OffsetCases,
        OffsetFacing,
        Facing,
        Heading: { ...Browser.Location, y: HeadingY },
        Row,
        Title: { ...Browser.Location, y: TitleY }
    };
}

/**
 * Applies the current line gap to the animated canvases and moves every
 * display to its place, after a calibration change or a browser page change.
 *
 * @category Running
 * @since 1.1.19
 */
function RefreshGallery()
{
    if (!GalleryPlacement) return;
    const Layout = GalleryLayout(GalleryPlacement);
    GalleryDisplays.forEach(({ Back, Display, Entry }, Index) =>
    {
        if (Entry.Frame) Display.lineGapHeight = AdjustableLineGapHeight;
        Back?.setLocation(InOverworld(OverlayBack(Layout.Row[Index].Location, Layout.Facing)));
        Display.setLocation(InOverworld(Layout.Row[Index].Location));
    });
    BrowserHeader?.Heading.setLocation(InOverworld(Layout.Heading));
    BrowserHeader?.Title.setLocation(InOverworld(Layout.Title));
    if (AnimationDisplays)
    {
        const [ Canvas, Copy ] = Layout.AnimationCases;
        AnimationDisplays.Fireflies.lineGapHeight = AdjustableLineGapHeight;
        AnimationDisplays.Fireflies.setLocation(InOverworld(Canvas.Display));
        AnimationDisplays.A.setLocation(InOverworld(Copy.Display));
        AnimationDisplays.B.setLocation(InOverworld(MiddleLocation({ GlyphOnly: true }, Copy.Display, Layout.Facing)));
        AnimationDisplays.Title.setLocation(InOverworld(Copy.Title));
        MoveRegions(AnimationDisplays.Regions, { GlyphOnly: true }, Copy.Display, Layout.Facing);
    }

    // The back row depends only on the pixel size, so page turns and selections leave its 336 displays alone.
    if (PixelSize === BackPixelSize) return;
    BackPixelSize = PixelSize;
    BackDisplays.forEach(({ Display, Reference, Title }, Index) =>
    {
        Display.setLocation(InOverworld(Layout.BackCases[Index].Display));
        Reference.setLocation(InOverworld(Layout.BackCases[Index].Reference));
        Title.setLocation(InOverworld(Layout.BackCases[Index].Title));
    });
    OffsetDisplays.forEach(({ Back, Display, Entry, Middle, Regions, Title }, Index) =>
    {
        Back?.setLocation(InOverworld(OverlayBack(Layout.OffsetCases[Index].Display, Layout.OffsetFacing)));
        Middle?.setLocation(InOverworld(MiddleLocation(Entry, Layout.OffsetCases[Index].Display, Layout.OffsetFacing)));
        Display.setLocation(InOverworld(Layout.OffsetCases[Index].Display));
        Title.setLocation(InOverworld(Layout.OffsetCases[Index].Title));
        MoveRegions(Regions, Entry, Layout.OffsetCases[Index].Display, Layout.OffsetFacing);
    });
}

/**
 * Shows the character the form's sliders selected between "ab" and "rl", or a
 * space between them when there is no character at that position, and
 * re-lays the row for its width. The character is shown raw, except U+0000,
 * which the server would truncate along with the rest of the text.
 *
 * @category Running
 * @since 1.1.23
 */
function ShowSelectedCharacter(CodePoint)
{
    let Character = " ";
    if (CodePoint === 0) Character = DisplayCharacter(0);
    else if (CodePoint !== undefined) Character = String.fromCodePoint(CodePoint);
    SelectedText = `ab${Character}rl`;
    try
    {
        for (const { Display, Entry } of GalleryDisplays) if (Entry.Selected) Display.setText(SelectedText);
        RefreshGallery();
    }
    catch (Error)
    {
        console.error(`Selected character: ${Error?.stack ?? Error}`);
    }
}

/**
 * Shows another browser page, wrapping past either end, and re-lays the row
 * for its width.
 *
 * @category Running
 * @since 1.1.19
 */
function ShowBrowserPage(Index)
{
    BrowserPage = ((Index % PageCount) + PageCount) % PageCount;
    try
    {
        for (const { Display, Entry } of GalleryDisplays) if (Entry.Browser) Display.setText(PageText(BrowserPage));
        BrowserHeader?.Heading.setText(PageHeading(BrowserPage));
        RefreshGallery();
    }
    catch (Error)
    {
        console.error(`Unicode browser: ${Error?.stack ?? Error}`);
    }
}

/**
 * Normalizes an angle in degrees to (−180, 180].
 *
 * @category Running
 * @since 1.1.29
 */
function Normalized(Degrees)
{
    const Turned = (Degrees % 360 + 360) % 360;
    return Turned > 180 ? Turned - 360 : Turned;
}

/**
 * Returns the TextPrimitive yaw, in degrees, whose text faces a viewer looking
 * along a facing angle (radians from +z toward +x), normalized to (−180, 180].
 * The client turns TextPrimitives the opposite way to entities: yaw θ shows
 * the text toward (−sin θ, −cos θ). Until 1.1.29 the entity sign was used,
 * which only works facing south or north: other facings mirrored each display
 * about its row (rows facing each other, or displays at an angle to their row).
 * Yaws outside (−180, 180] are also drawn at wrong angles.
 *
 * @category Running
 * @since 1.1.25
 */
function Yaw(Facing)
{
    return Normalized(Facing * 180 / Math.PI);
}

/**
 * Returns the player yaw, in degrees, that looks along a facing angle.
 *
 * @category Running
 * @since 1.1.29
 */
function PlayerYaw(Facing)
{
    return Normalized(-Facing * 180 / Math.PI);
}

/**
 * A location in the overworld, where every gallery display is. A shape given
 * a location without a dimension is drawn in every dimension, so each move of
 * a gallery display names the overworld.
 *
 * @category Running
 * @since 1.1.73
 */
function InOverworld(Location)
{
    return { ...Location, dimension: world.getDimension("overworld") };
}

/**
 * Logs how many text primitives each dimension holds, counting those drawn in
 * every dimension (no dimension) apart.
 *
 * @category Running
 * @since 1.1.73
 */
function LogShapeDimensions(When)
{
    const Counts = {};
    for (const Shape of world.primitiveShapesManager.getShapes())
    {
        let Id = "every dimension";
        try { Id = Shape.dimension?.id ?? Id; }
        catch { /* A shape with no dimension may throw rather than return undefined. */ }
        Counts[Id] = (Counts[Id] ?? 0) + 1;
    }

    const Summary = Object.entries(Counts).map(([ Id, Count ]) => `${Id} ${Count}`).join(", ");
    console.warn(`PRIMITIVE_DIMENSIONS ${When}: ${Summary}`);
}

/**
 * Creates a fixed-yaw TextPrimitive with an opaque black background, unless
 * `Background` gives another, and adds it to the dimension. The text is
 * single-sided: with double-sided text (`textBackfaceVisible`) and no depth
 * test, the client draws the background over the text, leaving a black box.
 * Since 1.1.29 the background is single-sided too, so a row seen from behind
 * is invisible instead of covering the row beyond it. Static text is sent
 * again a few ticks after placement, as the animated text is every tick.
 *
 * @category Running
 * @since 1.1.21
 */
function AddText(Dimension, Location, Text, Facing, {
    Animated = false,
    Background = Black,
    Color = White,
    Scale = RowScale
} = {})
{
    // Without a dimension, a shape is drawn in every dimension.
    const Display = new TextPrimitive({ ...Location, dimension: Dimension }, Text);
    Display.useRotation = true;
    Display.rotation = { x: 0, y: Yaw(Facing), z: 0 };
    Display.depthTest = false;
    Display.scale = Scale;
    Display.color = Color;
    Display.textBackfaceVisible = false;
    // No back: a row's black backs would otherwise be drawn over the text of the row behind them.
    Display.backfaceVisible = false;
    Display.lineGapHeight = Animated ? AdjustableLineGapHeight : 0;
    Display.backgroundColorOverride = Background;
    world.primitiveShapesManager.addText(Display, Dimension);
    if (!Animated)
    {
        system.runTimeout(() =>
        {
            try { Display.setText(Display.text); }
            catch { /* The display was replaced or removed before the refresh. */ }
        }, 5);
    }
    return Display;
}

/**
 * Places every gallery display in one straight row, with neighbors 0.5 blocks
 * apart edge to edge by their estimated widths. The spawn view is snapped to
 * the nearest cardinal direction, so the rows lie along world axes. The row is
 * first laid out with the browser page centered a few blocks ahead, then turned
 * a quarter turn about the selected-character display, which keeps its place.
 * The browser's heading and title stack above its page, and a second titled
 * row stands behind the page, facing the other way. Retries unloaded terrain
 * and replaces the previous gallery atomically, then calls `Then`.
 *
 * @category Running
 * @since 1.1.19
 */
function PlaceGallery(Dimension, Origin, Forward, Serial, Then, Attempt = 0)
{
    if (Serial !== SpawnSerial) return;
    const Created = [];
    const Header = [];
    const Behind = [];
    const Across = [];
    let Animation;
    try
    {
        const Length = Math.hypot(Forward.x, Forward.z);
        const Looking = Math.atan2(Length > 0.001 ? Forward.x : 0, Length > 0.001 ? Forward.z : 1);
        // Snap to the nearest cardinal direction, so every row and display lies along a world axis.
        const Facing = Math.round(Looking / (Math.PI / 2)) * (Math.PI / 2);
        const X = Math.floor(Origin.x + Math.sin(Facing) * GalleryDistance);
        const Z = Math.floor(Origin.z + Math.cos(Facing) * GalleryDistance);
        let Ground;
        // Read actual blocks: an unloaded column can report an air "topmost" block.
        for (let Y = Dimension.heightRange.max - 1; Y >= Dimension.heightRange.min; Y--)
        {
            const Block = Dimension.getBlock({ x: X, y: Y, z: Z });
            if (!Block) throw new Error("Spawn terrain is not loaded yet.");
            if (!Block.isAir) { Ground = Block; break; }
        }
        if (!Ground) throw new Error("Spawn terrain is not loaded yet.");
        const GroundTop = Ground.location.y + 1;
        const Flat = { x: Origin.x, z: Origin.z };
        const Placement = { Facing, GroundTop, Origin: Flat, ...GalleryAnchors(Flat, Facing, GroundTop) };
        const Layout = GalleryLayout(Placement);
        GalleryEntries.forEach((Entry, Index) =>
        {
            const Location = Layout.Row[Index].Location;
            const Back = Entry.Back === undefined ? undefined : AddOverlayBack(Dimension, Location, Entry.Back, Layout.Facing);
            const Display = AddText(Dimension, Location, EntryText(Entry), Layout.Facing, {
                Animated: Boolean(Entry.Frame),
                Background: Back ? Clear : Black,
                Color: Back ? OverlayColors.InkColor : Entry.Color ?? White,
                Scale: Entry.Scale
            });
            if (Back)
            {
                Display.lineGapHeight = OverlayFrontGap;
                Display.depthTest = true;
            }

            Created.push({ Back, Display, Entry });
        });
        Header.push(AddText(Dimension, Layout.Heading, PageHeading(BrowserPage), Layout.Facing, { Scale: HeadingScale }));
        Header.push(AddText(Dimension, Layout.Title, BrowserTitle, Layout.Facing));
        // Added last, so the back row is drawn after the black backs of the displays in front of it.
        BackEntries.forEach((Entry, Index) =>
        {
            const Place = Layout.BackCases[Index];
            const Display = AddText(Dimension, Place.Display, Entry.Text, Layout.BackFacing);
            const Reference = AddText(Dimension, Place.Reference, Entry.Reference, Layout.BackFacing,
                { Background: Clear, Color: ReferencePurple });
            const Title = AddText(Dimension, Place.Title, Entry.TitleText, Layout.BackFacing);
            Behind.push({ Display, Entry, Reference, Title });
        });
        OffsetEntries.forEach((Entry, Index) =>
        {
            const Place = Layout.OffsetCases[Index];
            // An overlay's back, at half scale with the black background, goes first so it is drawn first, then a
            // seamless overlay's middle layer.
            const Back = Entry.Back === undefined ? undefined
                : AddOverlayBack(Dimension, Place.Display, Entry.Back, Layout.OffsetFacing);
            const Turned = Layout.OffsetFacing;
            const Layered = Entry.Middle !== undefined;
            let Middle = Back && Layered ? AddMiddle(Dimension, Entry, Place.Display, Turned) : undefined;
            const Tinted = Entry.Overlaid || Entry.GlyphOnly;
            const Tint = Entry.Background ?? OverlayColors.Background;
            const Background = Back ? Clear : Tinted ? Tint : undefined;
            const Display = AddText(Dimension, Place.Display, Entry.Text, Turned, {
                ...Background ? { Background } : {},
                ...Back || Tinted ? { Color: OverlayColors.InkColor } : {},
                Scale: Entry.Scale
            });
            Display.lineGapHeight = Back ? OverlayFrontGap : Entry.LineGap ?? OffsetLineGap;
            // A glyph-only display's second layer goes just in front of its first.
            if (Entry.GlyphOnly && Layered)
            {
                Middle = AddMiddle(Dimension, Entry, Place.Display, Turned);
            }

            // With depth testing on every layer, the back, slightly behind, stays behind.
            if (Back || Middle)
            {
                Display.depthTest = true;
            }

            const Title = AddText(Dimension, Place.Title, Entry.TitleText, Layout.OffsetFacing);
            const Record = { Back, Display, Entry, Middle, Regions: [], Title };
            Across.push(Record);
            Record.Regions = AddRegions(Dimension, Entry, Place.Display, Turned);
        });
        {
            // The animation row: the Braille canvas, then its glyph-only copy's two layers, the second just in front.
            const [ Canvas, Copy ] = Layout.AnimationCases;
            const Seconds = system.currentTick / 20;
            const Glyphs = GlyphOnly(BrailleCanvas(Seconds));
            const Fireflies = AddText(Dimension, Canvas.Display, BrailleFrame(Seconds), Layout.Facing, { Animated: true });
            const A = AddText(Dimension, Copy.Display, Glyphs.A, Layout.Facing, { Animated: true, Scale: RowScale / 2 });
            A.lineGapHeight = GlyphOnlyLineGap;
            A.depthTest = true;
            const B = AddText(Dimension, MiddleLocation({ GlyphOnly: true }, Copy.Display, Layout.Facing), Glyphs.B,
                Layout.Facing, { Animated: true, Background: Clear, Scale: RowScale / 2 });
            B.lineGapHeight = GlyphOnlyLineGap;
            B.depthTest = true;
            Animation = { A, B, Fireflies, Regions: [], Title: AddText(Dimension, Copy.Title, FirefliesGlyphTitle, Layout.Facing) };
            Animation.Regions = AddRegions(Dimension, { ...AnimationEntries[1], GlyphOnly: true }, Copy.Display, Layout.Facing);
        }
        for (const { Back, Display } of GalleryDisplays)
        {
            Back?.remove();
            Display.remove();
        }
        BrowserHeader?.Heading.remove();
        BrowserHeader?.Title.remove();
        for (const Display of AnimationPrimitives(AnimationDisplays)) Display.remove();
        for (const { Display, Reference, Title } of BackDisplays)
        {
            Display.remove();
            Reference.remove();
            Title.remove();
        }
        for (const { Back, Display, Middle, Regions, Title } of OffsetDisplays)
        {
            Back?.remove();
            Middle?.remove();
            Display.remove();
            Title.remove();
            for (const { Display: Region } of Regions) Region.remove();
        }
        GalleryDisplays = Created;
        BrowserHeader = { Heading: Header[0], Title: Header[1] };
        BackDisplays = Behind;
        OffsetDisplays = Across;
        AnimationDisplays = Animation;
        BackPixelSize = PixelSize;
        GalleryPlacement = Placement;
        const Span = Layout.Row.reduce((Sum, { Width }) => Sum + Width, 0) + 0.5 * (Layout.Row.length - 1);
        const Count = Created.length + Created.filter(({ Back }) => Back).length + Header.length + Behind.length * 3 +
            Across.length * 2 + Across.filter(({ Back }) => Back).length +
            Across.filter(({ Middle }) => Middle).length + Across.reduce((Sum, { Regions }) => Sum + Regions.length, 0) +
            AnimationPrimitives(Animation).length;
        const Degrees = (Facing * 180 / Math.PI).toFixed(1);
        console.warn(`CHARACTER_GALLERY_READY ${Count} TextPrimitives, row ${Span.toFixed(1)} blocks, facing ${Degrees}°`);
        LogShapeDimensions("after the gallery");
        try
        {
            PlaceTextureTest(Dimension, Layout.Row[BrowserIndex].Location, GroundTop);
        }
        catch (Error)
        {
            console.error(`UI texture test: ${Error?.stack ?? Error}`);
        }

        try
        {
            // The movement tests moved to the flat dimension; remove entities 1.1.70 and 1.1.71 left here.
            ClearOrbitEntities(Dimension);
        }
        catch (Error)
        {
            console.error(`Orbit entity cleanup: ${Error?.stack ?? Error}`);
        }

        Then?.();
    }
    catch (Error)
    {
        for (const { Back, Display } of Created)
        {
            Back?.remove();
            Display.remove();
        }
        for (const Display of Header) Display.remove();
        for (const { Display, Reference, Title } of Behind)
        {
            Display.remove();
            Reference.remove();
            Title.remove();
        }
        for (const { Back, Display, Middle, Regions, Title } of Across)
        {
            Back?.remove();
            Middle?.remove();
            Display.remove();
            Title.remove();
            for (const { Display: Region } of Regions) Region.remove();
        }
        for (const Display of AnimationPrimitives(Animation)) Display.remove();
        if (Attempt < 30) system.runTimeout(() => PlaceGallery(Dimension, Origin, Forward, Serial, Then, Attempt + 1), 10);
        else console.error(`Character gallery: ${Error?.stack ?? Error}`);
    }
}

/**
 * Opens the Unicode browser form. A category dropdown starts at the current
 * page's category; choosing another closes the form and shows that category's
 * first page. Two sliders pick a character on the current page by column and
 * row, counted from the upper left, and the details below describe it.
 *
 * @category Running
 * @since 1.1.19
 */
async function OpenUnicodeForm(player)
{
    if (OpenForms.has(player.id)) return;
    OpenForms.add(player.id);
    const Cleanup = [];
    try
    {
        const Shown = BrowserPage;
        const { Category } = Page(Shown);
        const form = new CustomForm(player, BrowserTitle);
        const Choice = new ObservableNumber(Category, { clientWritable: true });
        const Column = new ObservableNumber(0, { clientWritable: true });
        const Row = new ObservableNumber(0, { clientWritable: true });
        const Details = new ObservableString("");
        const Update = (FromSlider) =>
        {
            const X = Math.round(Column.getData());
            const Y = Math.round(Row.getData());
            const CodePoint = CodePointAt(BrowserPage, X, Y);
            Details.setData(CodePoint === undefined
                ? `No character at (${X}, ${Y}): this page has ${PageRowCount(BrowserPage)} row(s).`
                : `(${X}, ${Y})\n${DescribeCharacter(CodePoint)}`);
            if (FromSlider) ShowSelectedCharacter(CodePoint);
        };
        const OnChoice = Choice.subscribe((Value) =>
        {
            if (!Number.isInteger(Value) || Value === Category || Value < 0 || Value >= Categories.length) return;
            form.close();
            ShowBrowserPage(FirstPageOf(Value));
        });
        const OnColumn = Column.subscribe(() => Update(true));
        const OnRow = Row.subscribe(() => Update(true));
        Cleanup.push(() => Choice.unsubscribe(OnChoice), () => Column.unsubscribe(OnColumn), () => Row.unsubscribe(OnRow));
        Update(false);
        form.dropdown("Category", Choice, Categories.map((Entry, Index) => ({
            label: `${Entry.Name} (${Hex(Entry.First)}–${Hex(Entry.Last)})`,
            value: Index
        })));
        form.slider("X: column, 0 at the left", Column, 0, PageColumns - 1, { step: 1 });
        // A slider needs a range, so a one-row page still offers row 1, which reports that it is empty.
        form.slider("Y: row, 0 at the top", Row, 0, Math.max(1, PageRowCount(Shown) - 1), { step: 1 });
        form.label(Details);
        form.button("Close", () => form.close());
        await form.show();
    }
    catch (error)
    {
        if (error?.name === "PlayerLeftError") return;
        console.error(`Unicode browser form: ${String(error)}\n${error?.stack ?? ""}`);
        if (player.isValid) player.sendMessage(`Unable to open the Unicode browser form: ${error}`);
    }
    finally
    {
        for (const Dispose of Cleanup) Dispose();
        OpenForms.delete(player.id);
    }
}

/**
 * Turns the browser to the next page, or to the previous page while sneaking.
 * Uses within four ticks of the last turn are ignored, so a single press that
 * raises both use events turns one page.
 *
 * @category Running
 * @since 1.1.19
 */
function TurnPage(player)
{
    const Last = LastTurn.get(player.id);
    if (Last !== undefined && system.currentTick - Last < 4) return;
    LastTurn.set(player.id, system.currentTick);
    ShowBrowserPage(BrowserPage + (player.isSneaking ? -1 : 1));
    player.onScreenDisplay.setActionBar(PageHeading(BrowserPage));
}

/**
 * Opens the display settings form, starting at the current values: the line
 * gap of the animated canvases and the pixel size that converts estimated text
 * widths to blocks. Confirm applies both and re-lays the row; dismissing the
 * form changes nothing.
 *
 * @category Running
 * @since 1.1.14
 */
async function OpenLineGapForm(player)
{
    if (OpenForms.has(player.id)) return;
    OpenForms.add(player.id);
    try
    {
        const form = new CustomForm(player, "Display settings");
        const Gap = new ObservableNumber(AdjustableLineGapHeight, { clientWritable: true });
        const Size = new ObservableNumber(PixelSize * 1000, { clientWritable: true });
        form.label("lineGapHeight applies to the two animated canvases.");
        form.slider("lineGapHeight", Gap, -20, 20, { step: 0.5 });
        form.label("Font pixel size calibrates the row: raise it if neighbors overlap, lower it if the gaps exceed half a block.");
        form.slider("Font pixel size (mm at scale 1)", Size, 5, 60, { step: 0.5 });
        form.button("Confirm", () =>
        {
            AdjustableLineGapHeight = Gap.getData();
            PixelSize = Size.getData() / 1000;
            RefreshGallery();
            console.warn(`DISPLAY_SETTINGS lineGapHeight ${AdjustableLineGapHeight} pixelSize ${PixelSize}`);
            if (player.isValid) player.sendMessage(`lineGapHeight ${AdjustableLineGapHeight}; font pixel size ${Size.getData()} mm.`);
            form.close();
        });
        await form.show();
    }
    catch (error)
    {
        if (error?.name === "PlayerLeftError") return;
        console.error(`Display settings form: ${String(error)}\n${error?.stack ?? ""}`);
        if (player.isValid) player.sendMessage(`Unable to open display settings: ${error}`);
    }
    finally
    {
        OpenForms.delete(player.id);
    }
}

/** Each player's TextPrimitive placed with the text writer, by player id. */
const WrittenTexts = new Map();
/** Tick of each player's last text writer use, so one press that fires both use events acts once. */
const LastWrite = new Map();
/** Text fields in the text writer form, one per line of the written text. */
const WriterLines = 6;
/** Blocks ahead of a player's eyes at which written text appears. */
const WritingDistance = 3;

/**
 * Places a player's written text `WritingDistance` blocks ahead of their eyes,
 * facing them, styled like the gallery displays. Empty text and text with a
 * line over the TextPrimitive byte limit are refused with a message.
 *
 * @category Running
 * @since 1.1.30
 */
function PlaceWrittenText(player, Text)
{
    if (Text.length === 0)
    {
        player.sendMessage("Nothing to show: the text was empty.");
        return;
    }
    const Bytes = LongestLineBytes(Text);
    if (Bytes > LineByteLimit)
    {
        player.sendMessage(`That line is ${Bytes} UTF-8 bytes; a TextPrimitive line holds at most ${LineByteLimit}.`);
        return;
    }
    const View = player.getViewDirection();
    const Length = Math.hypot(View.x, View.z);
    const Facing = Math.atan2(Length > 0.001 ? View.x : 0, Length > 0.001 ? View.z : 1);
    const Eyes = player.getHeadLocation();
    const Location = {
        x: Eyes.x + Math.sin(Facing) * WritingDistance,
        y: Eyes.y,
        z: Eyes.z + Math.cos(Facing) * WritingDistance
    };
    WrittenTexts.set(player.id, AddText(player.dimension, Location, Text, Facing));
    console.warn(`WRITTEN_TEXT ${JSON.stringify(Text)}`);
}

/**
 * Uses the text writer. When the player's written text is showing, it is
 * removed. Otherwise a custom form asks for up to six lines, one text field
 * each, with Confirm and Cancel buttons. Confirm places the lines in front of
 * the player, without trailing empty lines.
 *
 * @category Running
 * @since 1.1.30
 */
async function UseTextWriter(player)
{
    const Last = LastWrite.get(player.id);
    if (Last !== undefined && system.currentTick - Last < 4) return;
    LastWrite.set(player.id, system.currentTick);
    const Existing = WrittenTexts.get(player.id);
    if (Existing)
    {
        WrittenTexts.delete(player.id);
        try { Existing.remove(); }
        catch { /* Already removed. */ }
        return;
    }
    if (OpenForms.has(player.id)) return;
    OpenForms.add(player.id);
    try
    {
        const form = new CustomForm(player, "Text Writer");
        const Lines = Array.from({ length: WriterLines }, () => new ObservableString("", { clientWritable: true }));
        let Confirmed = false;
        Lines.forEach((Line, Index) => form.textField(`Line ${Index + 1}`, Line));
        form.button("Confirm", () =>
        {
            Confirmed = true;
            form.close();
        });
        form.button("Cancel", () => form.close());
        await form.show();
        if (!Confirmed || !player.isValid) return;
        const Text = Lines.map((Line) => Line.getData());
        // Trailing empty lines are dropped; empty lines between others are kept.
        while (Text.length > 0 && Text[Text.length - 1] === "") Text.pop();
        PlaceWrittenText(player, Text.join("\n"));
    }
    catch (error)
    {
        if (error?.name === "PlayerLeftError") return;
        console.error(`Text writer form: ${String(error)}\n${error?.stack ?? ""}`);
        if (player.isValid) player.sendMessage(`Unable to open the text writer: ${error}`);
    }
    finally
    {
        OpenForms.delete(player.id);
    }
}

/**
 * Ensures the item is in the hotbar. A missing item is created in the preferred
 * slot, moving that slot's previous item to the first empty slot or dropping it.
 * An item found outside the hotbar is swapped into the preferred slot.
 *
 * @category Running
 * @since 1.1.10
 */
function GiveHotbarItem(player, Inventory, TypeId, Preferred)
{
    let Slot = -1;
    for (let Index = 0; Index < Inventory.size; Index++)
    {
        if (Inventory.getItem(Index)?.typeId === TypeId) { Slot = Index; break; }
    }
    if (Slot < 0)
    {
        const Item = new ItemStack(TypeId);
        Item.keepOnDeath = true;
        const Previous = Inventory.getItem(Preferred);
        if (Previous)
        {
            let Empty = -1;
            for (let Index = 0; Index < Inventory.size; Index++)
            {
                if (Index !== Preferred && !Inventory.getItem(Index)) { Empty = Index; break; }
            }
            if (Empty < 0) player.dimension.spawnItem(Previous, player.location);
            else Inventory.setItem(Empty, Previous);
        }
        Inventory.setItem(Preferred, Item);
        return Preferred;
    }
    if (Slot > 8)
    {
        const Previous = Inventory.getItem(Preferred);
        Inventory.setItem(Preferred, Inventory.getItem(Slot));
        Inventory.setItem(Slot, Previous);
        return Preferred;
    }
    return Slot;
}

/**
 * Removes every stack of an item from the hotbar and main inventory.
 *
 * @category Running
 * @since 1.1.19
 */
function RemoveItem(Inventory, TypeId)
{
    for (let Index = 0; Index < Inventory.size; Index++)
    {
        if (Inventory.getItem(Index)?.typeId === TypeId) Inventory.setItem(Index, undefined);
    }
}

/**
 * Registers an item custom component that runs an action for the using player,
 * whether used in the air or on a block.
 *
 * @category Running
 * @since 1.1.19
 */
function RegisterUse(Registry, Name, Action)
{
    const Handler = ({ source }) =>
    {
        if (source instanceof Player) system.run(() => void Action(source));
    };
    Registry.registerCustomComponent(Name, { onUse: Handler, onUseOn: Handler });
}

/**
 * Registers a command any player can run, without cheats, that sends them
 * somewhere. Commands run in restricted mode, so the move waits for the next
 * tick.
 *
 * @category Running
 * @since 1.1.72
 */
function RegisterTravel(Registry, Name, Description, Travel)
{
    Registry.registerCommand({
        cheatsRequired: false,
        description: Description,
        name: Name,
        permissionLevel: CommandPermissionLevel.Any
    }, ({ sourceEntity }) =>
    {
        if (!(sourceEntity instanceof Player))
        {
            return { message: "Only a player can travel.", status: CustomCommandStatus.Failure };
        }

        system.run(() => Travel(sourceEntity));
        return { status: CustomCommandStatus.Success };
    });
}

system.beforeEvents.startup.subscribe(({ customCommandRegistry, itemComponentRegistry }) =>
{
    RegisterUse(itemComponentRegistry, "ddui_demo:open_line_gap_form", OpenLineGapForm);
    RegisterUse(itemComponentRegistry, "ddui_demo:open_form", OpenUnicodeForm);
    RegisterUse(itemComponentRegistry, "ddui_demo:turn_unicode_page", TurnPage);
    RegisterUse(itemComponentRegistry, "ddui_demo:write_text", UseTextWriter);
    RegisterTravel(customCommandRegistry, Command.Flat,
        "Go to the flat dimension's TextPrimitive movement tests.", MoveToFlat);
    // The gallery is placed once a player spawns; before then there is nowhere to send them.
    RegisterTravel(customCommandRegistry, Command.Gallery,
        "Go back to the character gallery.", TeleportToBrowser);
});

/** Where the gallery is laid out from, once per server start: world spawn, looking south. */
const GalleryOrigin = Object.freeze({ x: 0, z: 0 });
const GallerySouth = Object.freeze({ x: 0, y: 0, z: 1 });
/** Blocks between a joining player and the Unicode browser page they are placed in front of. */
const ViewingDistance = 4;
/** Players who spawned while the gallery was still being placed, each with where to send them once it is. */
const AwaitingGallery = new Map();
let GalleryRequested = false;

/**
 * Teleports a player to stand `ViewingDistance` blocks in front of the Unicode
 * browser page, on the ground, looking straight at its center.
 *
 * @category Running
 * @since 1.1.27
 */
function TeleportToBrowser(player)
{
    if (!GalleryPlacement || !player.isValid) return;
    const Layout = GalleryLayout(GalleryPlacement);
    const Page = Layout.Row[BrowserIndex].Location;
    const Feet = {
        x: Page.x - Math.sin(Layout.Facing) * ViewingDistance,
        y: GalleryPlacement.GroundTop,
        z: Page.z - Math.cos(Layout.Facing) * ViewingDistance
    };
    const Pitch = -Math.atan2(Page.y - (Feet.y + 1.62), ViewingDistance) * 180 / Math.PI;
    player.teleport(Feet, { dimension: world.getDimension("overworld"), rotation: { x: Pitch, y: PlayerYaw(Layout.Facing) } });
}

world.afterEvents.playerSpawn.subscribe(({ initialSpawn, player }) =>
{
    system.run(() =>
    {
        if (!player.isValid) return;
        // A joining player goes on to the flat dimension's movement tests; a respawn returns to the gallery.
        const Arrive = initialSpawn ? MoveToFlat : TeleportToBrowser;
        if (GalleryPlacement) Arrive(player);
        else
        {
            AwaitingGallery.set(player, Arrive);
            if (!GalleryRequested)
            {
                GalleryRequested = true;
                const Overworld = world.getDimension("overworld");
                // Bring the player to spawn first, so the gallery's terrain loads around them.
                player.teleport({ x: GalleryOrigin.x + 0.5, y: -60, z: GalleryOrigin.z + 0.5 }, { dimension: Overworld });
                PlaceGallery(Overworld, GalleryOrigin, GallerySouth, ++SpawnSerial, () =>
                {
                    for (const [ Waiting, Then ] of AwaitingGallery) Then(Waiting);
                    AwaitingGallery.clear();
                });
            }
        }
        const Inventory = player.getComponent("minecraft:inventory")?.container;
        if (!Inventory) return;
        RemoveItem(Inventory, LineGapTool);
        GiveHotbarItem(player, Inventory, Compass, 0);
        GiveHotbarItem(player, Inventory, PageTurner, 1);
        GiveHotbarItem(player, Inventory, TextWriter, 2);
        // Placing the turner can displace the compass, so locate it again before selecting it.
        player.selectedSlotIndex = GiveHotbarItem(player, Inventory, Compass, 0);
        player.sendMessage("Compass: inspect a character on the Unicode browser page. Page turner: next page; sneak to go back. Text writer: show text in front of you; use again to remove it.");
        player.sendMessage(
            `/${Command.Flat}: the flat dimension's movement tests. /${Command.Gallery}: back to the gallery.`);
    });
});

/** Where the movement tests' row is centered in the flat dimension: 10 blocks south of its spawn. */
const FlatTestCenter = Object.freeze({ x: 0.5, z: 10.5 });

world.afterEvents.worldLoad.subscribe(() =>
{
    PrepareFlatDimension().catch((Error) => console.error(`Flat dimension: ${Error?.stack ?? Error}`));
    // Facing south, toward a viewer at the flat dimension's spawn looking south.
    WhenFlatReady(() =>
    {
        try { PlaceOrbitTests(FlatDimension(), FlatTestCenter, 0, Yaw(0), FlatGroundTop()); }
        catch (Error) { console.error(`Movement tests: ${Error?.stack ?? Error}`); }
        try { PlaceHopTest(FlatDimension(), FlatTestCenter, 0, Yaw(0), FlatGroundTop()); }
        catch (Error) { console.error(`Hop test: ${Error?.stack ?? Error}`); }
        LogShapeDimensions("after the movement tests");
    });
});

// The glyph width measurement waits for the gallery, then returns the player.
RegisterGlyphProbe(() => !GalleryPlacement, TeleportToBrowser);

world.afterEvents.worldLoad.subscribe(() =>
{
    world.setDefaultSpawnLocation({ x: 0, y: -60, z: 0 });
    world.setTimeOfDay(6000);
    world.gameRules.doDayLightCycle = false;
    world.gameRules.doWeatherCycle = false;
    world.gameRules.doMobSpawning = false;
    console.warn("TRANSACTIONAL_DEMO_READY 1.1.82");
});
