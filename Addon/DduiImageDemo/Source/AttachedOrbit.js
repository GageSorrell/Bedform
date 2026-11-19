/**
 * Three ways to move a TextPrimitive around the same vertical circle, side by
 * side in one row: `setLocation` on the display every tick; `attachedTo` an
 * invisible carrier entity that the server steers by velocity, to see whether
 * attached text glides; and `attachedTo` a still entity whose model's root
 * bone loops in a client animation, which does not move attached text
 * (verified in 1.1.71).
 *
 * @module @sorrell/ddui-image-demo/AttachedOrbit
 *
 * @file      AttachedOrbit.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { TextPrimitive, system, world } from "@minecraft/server";

/**
 * The carrier entity's type: no geometry or render controllers, so the client
 * draws nothing for it; no gravity or block collision, and no damage taken.
 *
 * @category Constant
 * @since 1.1.70
 */
export const OrbitCarrier = "ddui_demo:orbit_carrier";

/**
 * The circle's radius, in blocks.
 *
 * @category Constant
 * @since 1.1.70
 */
export const OrbitRadius = 2;

/**
 * Height of the circle's lowest point above the ground's top, in blocks.
 *
 * @category Constant
 * @since 1.1.70
 */
export const OrbitClearance = 0.1;

/**
 * Seconds per loop: about 1.6 blocks per second along the circle.
 *
 * @category Constant
 * @since 1.1.70
 */
export const OrbitPeriod = 8;

/**
 * The attached text's scale. One 12-pixel line at 0.025 blocks per pixel is
 * 0.18 blocks tall, so at the circle's lowest point the text's bottom edge
 * stays 0.01 blocks above the ground.
 *
 * @category Constant
 * @since 1.1.70
 */
export const OrbitScale = 0.6;

/**
 * The bone-animated entity's type: it stays where it is spawned, and its
 * model's root bone, holding a small red cube, loops around a circle of
 * `OrbitRadius` (lowest point `OrbitClearance` up) every `OrbitPeriod` seconds
 * in the client animation `animation.ddui_demo.bone_orbit.loop`, in the plane
 * of the model's x and y axes.
 *
 * @category Constant
 * @since 1.1.71
 */
export const BoneOrbitEntity = "ddui_demo:bone_orbit";

/**
 * Distance along the row, in blocks, from the steered orbit's center to the
 * bone-animated one's: their circles and texts stay clear of each other.
 *
 * @category Constant
 * @since 1.1.71
 */
export const BoneOrbitSpacing = 5;

/** Farther than this from its target, in blocks, the carrier is teleported back rather than steered. */
const SnapDistance = 1;
/** Ticks between position error reports in the server log: one loop. */
const ReportTicks = OrbitPeriod * 20;
const Black = Object.freeze({ red: 0, green: 0, blue: 0, alpha: 1 });
const White = Object.freeze({ red: 1, green: 1, blue: 1, alpha: 1 });

/** The placed orbit: its carrier, displays and circle, or undefined before placement. */
let Orbit;
/** The placed bone-animated test: its entity and displays, or undefined before placement. */
let BoneOrbit;
/** The placed setLocation test: its displays and circle, or undefined before placement. */
let MovedOrbit;
/** The largest distance between the carrier and its target since the last report, in blocks. */
let WorstError = 0;
let Snaps = 0;

/**
 * The point on a circle at a time: the circle stands in the vertical plane
 * through `Center` along `Right`, and the point starts at the bottom and runs
 * toward `Right` first, one loop every `OrbitPeriod` seconds.
 *
 * @category Layout
 * @since 1.1.70
 */
export function OrbitPoint({ Center, Right }, Seconds)
{
    const Angle = 2 * Math.PI * Seconds / OrbitPeriod;
    const Across = OrbitRadius * Math.sin(Angle);
    return {
        x: Center.x + Right.x * Across,
        y: Center.y - OrbitRadius * Math.cos(Angle),
        z: Center.z + Right.z * Across
    };
}

/**
 * Creates a fixed-yaw, single-sided text display with a black background in
 * a dimension, not yet added. Without a dimension, a shape is drawn in every
 * dimension.
 *
 * @category Layout
 * @since 1.1.80
 */
export function Text(Dimension, Location, Content, YawDegrees, Scale)
{
    const Display = new TextPrimitive({ ...Location, dimension: Dimension }, Content);
    Display.useRotation = true;
    Display.rotation = { x: 0, y: YawDegrees, z: 0 };
    Display.depthTest = false;
    Display.scale = Scale;
    Display.color = White;
    Display.textBackfaceVisible = false;
    Display.backfaceVisible = false;
    Display.backgroundColorOverride = Black;
    return Display;
}

/**
 * Places the orbit, replacing any earlier one and every carrier left from an
 * earlier run: a circle of `OrbitRadius` in the vertical plane of a row
 * centered on `Center` (`x` and `z`) and running across `Facing`, its lowest
 * point `OrbitClearance` above `GroundTop`. A carrier entity starts on the
 * circle, a text display is attached to it with no offset, and a title
 * stands still above the circle. Both displays have `YawDegrees`.
 *
 * @category Running
 * @since 1.1.70
 */
export function PlaceAttachedOrbit(Dimension, Center, Facing, YawDegrees, GroundTop)
{
    RemoveAttachedOrbit();
    for (const Entity of Dimension.getEntities({ type: OrbitCarrier })) Entity.remove();
    const Circle = {
        Center: { x: Center.x, y: GroundTop + OrbitClearance + OrbitRadius, z: Center.z },
        // The row's right, matching RowLayout's.
        Right: { x: -Math.cos(Facing), z: Math.sin(Facing) }
    };
    const Carrier = Dimension.spawnEntity(OrbitCarrier, OrbitPoint(Circle, system.currentTick / 20));
    try
    {
        // Attached, the display's location is an offset from the carrier's root location.
        const Display = Text(Dimension, { x: 0, y: 0, z: 0 }, "attachedTo", YawDegrees, OrbitScale);
        Display.attachedTo = Carrier;
        world.primitiveShapesManager.addText(Display, Dimension);
        const Title = Text(Dimension, { ...Circle.Center, y: Circle.Center.y + OrbitRadius + 0.6 },
            "TextPrimitive.attachedTo an invisible entity\n" +
            `steered by velocity, a ${OrbitRadius}-block circle every ${OrbitPeriod} s`,
            YawDegrees, 0.7875);
        world.primitiveShapesManager.addText(Title, Dimension);
        Orbit = { ...Circle, Carrier, Display, Title };
    }
    catch (Error)
    {
        Carrier.remove();
        throw Error;
    }

    WorstError = 0;
    Snaps = 0;
    const At = (Value) => Value.toFixed(2);
    console.warn("ATTACHED_ORBIT placed: " +
        `center ${At(Circle.Center.x)} ${At(Circle.Center.y)} ${At(Circle.Center.z)}, ` +
        `radius ${OrbitRadius}, lowest point ${At(GroundTop + OrbitClearance)}, period ${OrbitPeriod} s`);
}

/**
 * Removes the orbit's displays and carrier, if it has been placed.
 *
 * @category Running
 * @since 1.1.70
 */
export function RemoveAttachedOrbit()
{
    if (!Orbit) return;
    try { Orbit.Display.remove(); } catch { /* Already removed. */ }
    try { Orbit.Title.remove(); } catch { /* Already removed. */ }
    try { if (Orbit.Carrier.isValid) Orbit.Carrier.remove(); } catch { /* Already removed. */ }
    Orbit = undefined;
}

/**
 * Places the bone-animated test, replacing any earlier one and every such
 * entity left from an earlier run. The entity stands on the ground
 * (`GroundTop`) at `Center` (`x` and `z`), turned to face along `Facing`, so
 * its model's x axis, and with it the animated circle, runs along the row. A
 * text display is attached to it 0.1 blocks up: at the bottom of the circle,
 * just under the red cube when the loop starts. If attached text follows the
 * model's root bone, it rides around under the cube; if it follows only the
 * entity's location, it stays at the bottom while the cube loops alone. A
 * title stands still above the circle. Both displays have `YawDegrees`.
 *
 * @category Running
 * @since 1.1.71
 */
export function PlaceBoneOrbit(Dimension, Center, Facing, YawDegrees, GroundTop)
{
    RemoveBoneOrbit();
    for (const Entity of Dimension.getEntities({ type: BoneOrbitEntity })) Entity.remove();
    const Location = { x: Center.x, y: GroundTop, z: Center.z };
    const Entity = Dimension.spawnEntity(BoneOrbitEntity, Location);
    try
    {
        // An entity's yaw is opposite a TextPrimitive's: facing along (sin F, cos F) is a yaw of -F degrees.
        Entity.setRotation({ x: 0, y: -Facing * 180 / Math.PI });
        const Offset = { x: 0, y: OrbitClearance, z: 0 };
        const Display = Text(Dimension, Offset, "attachedTo", YawDegrees, OrbitScale);
        Display.attachedTo = Entity;
        world.primitiveShapesManager.addText(Display, Dimension);
        const Title = Text(Dimension, { ...Location, y: GroundTop + OrbitClearance + 2 * OrbitRadius + 0.6 },
            "TextPrimitive.attachedTo a still entity\nwhose root bone loops in a client animation (red cube)",
            YawDegrees, 0.7875);
        world.primitiveShapesManager.addText(Title, Dimension);
        BoneOrbit = { Display, Entity, Title };
    }
    catch (Error)
    {
        Entity.remove();
        throw Error;
    }

    const At = (Value) => Value.toFixed(2);
    console.warn(`BONE_ORBIT placed: entity at ${At(Location.x)} ${At(Location.y)} ${At(Location.z)}, ` +
        `yaw ${At(Entity.getRotation().y)}`);
}

/**
 * Removes the bone-animated test's displays and entity, if it has been placed.
 *
 * @category Running
 * @since 1.1.71
 */
export function RemoveBoneOrbit()
{
    if (!BoneOrbit) return;
    try { BoneOrbit.Display.remove(); } catch { /* Already removed. */ }
    try { BoneOrbit.Title.remove(); } catch { /* Already removed. */ }
    try { if (BoneOrbit.Entity.isValid) BoneOrbit.Entity.remove(); } catch { /* Already removed. */ }
    BoneOrbit = undefined;
}

/**
 * Places the setLocation test, replacing any earlier one: a text display
 * with no entity, moved to its point on the circle with `setLocation` every
 * tick, at the same phase as the steered carrier, and a title standing still
 * above the circle. The circle is as in `PlaceAttachedOrbit`.
 *
 * @category Running
 * @since 1.1.72
 */
export function PlaceSetLocationOrbit(Dimension, Center, Facing, YawDegrees, GroundTop)
{
    RemoveSetLocationOrbit();
    const Circle = {
        Center: { x: Center.x, y: GroundTop + OrbitClearance + OrbitRadius, z: Center.z },
        Right: { x: -Math.cos(Facing), z: Math.sin(Facing) }
    };
    const Start = OrbitPoint(Circle, system.currentTick / 20);
    const Display = Text(Dimension, Start, "setLocation", YawDegrees, OrbitScale);
    world.primitiveShapesManager.addText(Display, Dimension);
    const Title = Text(Dimension, { ...Circle.Center, y: Circle.Center.y + OrbitRadius + 0.6 },
        "TextPrimitive.setLocation every tick, no entity\n" +
        `a ${OrbitRadius}-block circle every ${OrbitPeriod} s`,
        YawDegrees, 0.7875);
    world.primitiveShapesManager.addText(Title, Dimension);
    MovedOrbit = { ...Circle, Dimension, Display, Title };
    const At = (Value) => Value.toFixed(2);
    console.warn("SETLOCATION_ORBIT placed: " +
        `center ${At(Circle.Center.x)} ${At(Circle.Center.y)} ${At(Circle.Center.z)}`);
}

/**
 * Removes the setLocation test's displays, if it has been placed.
 *
 * @category Running
 * @since 1.1.72
 */
export function RemoveSetLocationOrbit()
{
    if (!MovedOrbit) return;
    try { MovedOrbit.Display.remove(); } catch { /* Already removed. */ }
    try { MovedOrbit.Title.remove(); } catch { /* Already removed. */ }
    MovedOrbit = undefined;
}

/**
 * Places all three tests in one row centered on `Center` (`x` and `z`) and
 * running across `Facing`, `BoneOrbitSpacing` apart: the steered orbit in the
 * middle, the setLocation one on the viewer's left and the bone-animated one
 * on the right, as seen by a viewer looking along `Facing`.
 *
 * @category Running
 * @since 1.1.72
 */
export function PlaceOrbitTests(Dimension, Center, Facing, YawDegrees, GroundTop)
{
    // RowLayout's right: the viewer's right when looking along Facing.
    const Along = (Offset) => ({
        x: Center.x - Math.cos(Facing) * Offset,
        z: Center.z + Math.sin(Facing) * Offset
    });
    PlaceSetLocationOrbit(Dimension, Along(-BoneOrbitSpacing), Facing, YawDegrees, GroundTop);
    PlaceAttachedOrbit(Dimension, Center, Facing, YawDegrees, GroundTop);
    PlaceBoneOrbit(Dimension, Along(BoneOrbitSpacing), Facing, YawDegrees, GroundTop);
}

/**
 * Removes every loaded carrier and bone-animated entity in a dimension: those
 * left in the overworld by 1.1.70 and 1.1.71, before the tests moved to the
 * flat dimension.
 *
 * @category Running
 * @since 1.1.72
 */
export function ClearOrbitEntities(Dimension)
{
    for (const Type of [ OrbitCarrier, BoneOrbitEntity ])
    {
        for (const Entity of Dimension.getEntities({ type: Type })) Entity.remove();
    }
}

/**
 * Steers the carrier toward where it should be one tick from now: its
 * velocity is cleared and replaced by the remaining step, so the server moves
 * it like any moving entity rather than teleporting it, and any shortfall
 * (from drag, say) is made up on the next tick. A carrier more than
 * `SnapDistance` off course, after its chunk unloaded for example, is
 * teleported back instead. Once a loop, the server log reports the largest
 * distance between carrier and target.
 */
function SteerOrbit()
{
    if (!Orbit || !Orbit.Carrier.isValid) return;
    const Tick = system.currentTick;
    const Here = Orbit.Carrier.location;
    const Now = OrbitPoint(Orbit, Tick / 20);
    WorstError = Math.max(WorstError, Math.hypot(Here.x - Now.x, Here.y - Now.y, Here.z - Now.z));
    const Next = OrbitPoint(Orbit, (Tick + 1) / 20);
    const Step = { x: Next.x - Here.x, y: Next.y - Here.y, z: Next.z - Here.z };
    if (Math.hypot(Step.x, Step.y, Step.z) > SnapDistance)
    {
        Orbit.Carrier.teleport(Next);
        Snaps++;
    }
    else
    {
        Orbit.Carrier.clearVelocity();
        Orbit.Carrier.applyImpulse(Step);
    }

    if (Tick % ReportTicks === 0)
    {
        console.warn(`ATTACHED_ORBIT largest error ${WorstError.toFixed(3)} blocks, ` +
            `${Snaps} teleports in the last loop`);
        WorstError = 0;
        Snaps = 0;
    }
}

system.runInterval(() =>
{
    try { SteerOrbit(); }
    catch (Error) { console.error(`Attached orbit: ${Error?.stack ?? Error}`); }
    try
    {
        if (MovedOrbit)
        {
            const Point = OrbitPoint(MovedOrbit, system.currentTick / 20);
            MovedOrbit.Display.setLocation({ ...Point, dimension: MovedOrbit.Dimension });
        }
    }
    catch (Error) { console.error(`setLocation orbit: ${Error?.stack ?? Error}`); }
}, 1);
