/**
 * Two stone cubes side by side that hop 4 blocks up from 1 block above the
 * ground and fall back, forever: one launched by `applyImpulse` and pulled
 * down by the engine's gravity, the other still on the server while a client
 * animation of its model's bone draws the same flight, restarted with
 * `playAnimation` at every launch of the first.
 *
 * @module @sorrell/ddui-image-demo/HopTest
 *
 * @file      HopTest.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { system, world } from "@minecraft/server";
import { Text } from "./AttachedOrbit.js";

/**
 * The impulse-launched cube's type: a stone cube with gravity but no block
 * collision, so it falls through the floor unless steered, and no damage
 * taken.
 *
 * @category Constant
 * @since 1.1.80
 */
export const ImpulseHop = "ddui_demo:impulse_hop";

/**
 * The animated cube's type: a stone cube with no gravity or block collision
 * that stays where it is spawned. Its model's `cube` bone flies in the client
 * animation `HopAnimation`.
 *
 * @category Constant
 * @since 1.1.80
 */
export const AnimatedHop = "ddui_demo:animated_hop";

/**
 * The animated cube's flight, 21 ticks long: the closed form of the flight
 * that `HopGravity` and `HopDrag` give `HopLaunch`, held at the bottom from
 * when it lands (20.1 ticks) to the end. The animation file repeats these
 * numbers, so change them together.
 *
 * @category Constant
 * @since 1.1.80
 */
export const HopAnimation = "animation.ddui_demo.hop.launch";

/**
 * Height of each cube's bottom above the ground's top, where it is launched
 * from and lands, in blocks.
 *
 * @category Constant
 * @since 1.1.80
 */
export const HopLift = 1;

/**
 * How far each cube rises above `HopLift`, in blocks.
 *
 * @category Constant
 * @since 1.1.80
 */
export const HopRise = 4;

/**
 * The gap between the two cubes' facing sides, in blocks. The cubes are 1
 * block wide, so their centers are `HopGap + 1` apart.
 *
 * @category Constant
 * @since 1.1.80
 */
export const HopGap = 1;

/**
 * Distance along the movement tests' row, in blocks, from its center to the
 * middle of the two cubes: past the bone-animated orbit at the viewer's right.
 *
 * @category Constant
 * @since 1.1.80
 */
export const HopOffset = 11;

/**
 * Gravity assumed for the first launch and the animation, in blocks per tick
 * squared: a mob's in vanilla Minecraft. The impulse cube falls by whatever
 * the engine applies.
 *
 * @category Constant
 * @since 1.1.80
 */
export const HopGravity = 0.08;

/**
 * The fraction of its velocity an entity keeps each tick in the air, assumed
 * with `HopGravity`: a mob's in vanilla Minecraft.
 *
 * @category Constant
 * @since 1.1.80
 */
export const HopDrag = 0.98;

/**
 * The upward launch velocity, in blocks per tick, that rises `HopRise` under
 * `HopGravity` and `HopDrag`, when each tick an entity moves by its velocity
 * and then takes gravity and drag. The impulse cube starts with it and
 * corrects it after every hop by the rise it measured.
 *
 * @category Constant
 * @since 1.1.80
 */
export const HopLaunch = 0.8028561;

/** Farther than this from its column or flight, in blocks, the impulse cube is teleported back to its start. */
const SnapDistance = 1;
/** The most one correction may change the launch velocity by, as a factor. */
const MostCorrection = 1.25;
/** Hops reported in the server log one by one, before reporting only every `ReportEvery`th. */
const ReportFirst = 5;
const ReportEvery = 20;

/** The placed test: its cubes, displays and flight state, or undefined before placement. */
let Hop;

/**
 * Places the test, replacing any earlier one and every hop cube left from an
 * earlier run: on a row centered on `Center` (`x` and `z`) and running across
 * `Facing`, the impulse cube `HopOffset - 1` along it and the animated one
 * `HopOffset + 1` along it, both with their bottoms `HopLift` above
 * `GroundTop`. A label under each cube and a title above the flight have
 * `YawDegrees`. The first launch is on the next tick.
 *
 * @category Running
 * @since 1.1.80
 */
export function PlaceHopTest(Dimension, Center, Facing, YawDegrees, GroundTop)
{
    RemoveHopTest();
    for (const Type of [ ImpulseHop, AnimatedHop ])
    {
        for (const Entity of Dimension.getEntities({ type: Type })) Entity.remove();
    }

    // RowLayout's right: the viewer's right when looking along Facing.
    const Along = (Offset, Height) => ({
        x: Center.x - Math.cos(Facing) * Offset,
        y: GroundTop + Height,
        z: Center.z + Math.sin(Facing) * Offset
    });
    const Half = (HopGap + 1) / 2;
    const Start = Along(HopOffset - Half, HopLift);
    const Cube = Dimension.spawnEntity(ImpulseHop, Start);
    let Animated;
    const Displays = [];
    try
    {
        Animated = Dimension.spawnEntity(AnimatedHop, Along(HopOffset + Half, HopLift));
        const Labels = [
            [ Along(HopOffset - Half, 0.4), "applyImpulse" ],
            [ Along(HopOffset + Half, 0.4), "animation" ],
            [ Along(HopOffset, HopLift + HopRise + 1.6),
                `A ${HopRise}-block hop from ${HopLift} block up, looping` ]
        ];
        for (const [ Location, Content ] of Labels)
        {
            const Display = Text(Dimension, Location, Content, YawDegrees, 0.6);
            world.primitiveShapesManager.addText(Display, Dimension);
            Displays.push(Display);
        }
    }
    catch (Error)
    {
        for (const Display of Displays) Display.remove();
        Animated?.remove();
        Cube.remove();
        throw Error;
    }

    Hop = {
        Animated, Cube, Displays, Start,
        // Landing: the cube is at its start and launches on the next tick.
        Phase: "Landing",
        Launch: HopLaunch,
        LaunchY: Start.y,
        LaunchTick: system.currentTick,
        Apex: Start.y,
        Hops: 0,
        Snaps: 0
    };
    const At = (Value) => Value.toFixed(2);
    console.warn(`HOP_TEST placed: impulse cube at ${At(Start.x)} ${At(Start.y)} ${At(Start.z)}, ` +
        `rise ${HopRise}, launch ${HopLaunch} blocks per tick`);
}

/**
 * Removes the test's displays and cubes, if it has been placed.
 *
 * @category Running
 * @since 1.1.80
 */
export function RemoveHopTest()
{
    if (!Hop) return;
    for (const Display of Hop.Displays)
    {
        try { Display.remove(); } catch { /* Already removed. */ }
    }

    for (const Entity of [ Hop.Cube, Hop.Animated ])
    {
        try { if (Entity.isValid) Entity.remove(); } catch { /* Already removed. */ }
    }

    Hop = undefined;
}

/**
 * Launches the impulse cube from where it is and restarts the animated cube's
 * flight. After the first hop the launch velocity is first corrected by the
 * rise just measured, so the next apex is `HopRise` above the start: for a
 * flight without drag the rise grows with the square of the launch velocity.
 */
function Launch()
{
    const Here = Hop.Cube.location;
    const Target = Hop.Start.y + HopRise - Here.y;
    if (Hop.Hops > 0 && Number.isFinite(Hop.Apex))
    {
        const Rise = Hop.Apex - Hop.LaunchY;
        const Ticks = system.currentTick - Hop.LaunchTick;
        if (Hop.Hops <= ReportFirst || Hop.Hops % ReportEvery === 0)
        {
            console.warn(`HOP_TEST hop ${Hop.Hops}: rose ${Rise.toFixed(3)} blocks at ` +
                `${Hop.Launch.toFixed(4)} blocks per tick, ${Ticks} ticks, landed ` +
                `${(Here.y - Hop.Start.y).toFixed(3)} blocks from the start, ${Hop.Snaps} teleports so far`);
        }

        if (Rise > 0)
        {
            const Factor = Math.sqrt(Target / Rise);
            Hop.Launch *= Math.min(MostCorrection, Math.max(1 / MostCorrection, Factor));
        }
    }

    Hop.Cube.clearVelocity();
    Hop.Cube.applyImpulse({ x: 0, y: Hop.Launch, z: 0 });
    Hop.Animated.playAnimation(HopAnimation, { blendOutTime: 0, stopExpression: "query.any_animation_finished" });
    Hop.Phase = "Flying";
    Hop.LaunchY = Here.y;
    Hop.Apex = Here.y;
    Hop.LaunchTick = system.currentTick;
    Hop.Hops++;
}

/**
 * Advances the impulse cube by a tick. In flight, the engine's gravity alone
 * moves it, and its highest point is recorded. When falling would carry it
 * below its start within the next tick, its velocity is replaced by the
 * remaining distance, so it lands on its start, and the next tick launches it
 * again. A cube that is off its column or far outside its flight, after its
 * chunk unloaded for example, is teleported back to its start and launched on
 * the next tick.
 */
function StepHop()
{
    if (!Hop || !Hop.Cube.isValid || !Hop.Animated.isValid) return;
    if (Hop.Phase === "Landing")
    {
        Launch();
        return;
    }

    const Here = Hop.Cube.location;
    const Floor = Hop.Start.y;
    const Aside = Math.hypot(Here.x - Hop.Start.x, Here.z - Hop.Start.z);
    if (Aside > SnapDistance || Here.y < Floor - SnapDistance || Here.y > Floor + HopRise + SnapDistance)
    {
        Hop.Cube.teleport(Hop.Start);
        Hop.Cube.clearVelocity();
        Hop.Phase = "Landing";
        // The interrupted hop's rise is meaningless, so the next launch keeps its velocity.
        Hop.Apex = Number.NaN;
        Hop.Snaps++;
        return;
    }

    Hop.Apex = Math.max(Hop.Apex, Here.y);
    const Fall = Hop.Cube.getVelocity().y;
    if (Fall >= 0) return;
    // Already at or below the start: the engine moved it farther than its velocity said.
    if (Here.y <= Floor)
    {
        Launch();
    }
    else if (Here.y + Fall < Floor)
    {
        Hop.Cube.clearVelocity();
        Hop.Cube.applyImpulse({ x: 0, y: Floor - Here.y, z: 0 });
        Hop.Phase = "Landing";
    }
}

system.runInterval(() =>
{
    try { StepHop(); }
    catch (Error) { console.error(`Hop test: ${Error?.stack ?? Error}`); }
}, 1);
