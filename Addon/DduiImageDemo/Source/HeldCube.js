/**
 * A stone cube that each joining player carries in front of them, in the
 * manner of a held object in Amnesia: The Dark Descent. The cube is not fixed
 * to its place 2 blocks ahead of the player; a damped spring pulls its
 * velocity toward that place every tick, so it lags behind turns and starts,
 * swings past and settles back, and it stops at blocks it meets. Its yaw
 * follows the player's on a spring of its own.
 *
 * @module @sorrell/ddui-image-demo/HeldCube
 *
 * @file      HeldCube.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { system, world } from "@minecraft/server";
import { FlatDimension } from "./FlatDimension.js";

/**
 * The carried cube's type: a 1-block stone cube with no gravity that collides
 * with blocks, cannot be pushed and takes no damage. Its location is the
 * middle of its bottom face.
 *
 * @category Constant
 * @since 1.1.81
 */
export const HeldCube = "ddui_demo:held_cube";

/**
 * How far ahead of the player's eyes the cube's center rests, in blocks,
 * along the player's view.
 *
 * @category Constant
 * @since 1.1.81
 */
export const HeldDistance = 2;

/**
 * How far toward the bottom of the player's screen the cube's center rests,
 * in blocks: straight below the eyes when the player looks level.
 *
 * @category Constant
 * @since 1.1.81
 */
export const HeldDrop = 0.6;

/**
 * The spring's stiffness: the velocity, in blocks per tick, added each tick
 * per block between the cube and its resting place.
 *
 * @category Constant
 * @since 1.1.81
 */
export const HeldStiffness = 0.08;

/**
 * The spring's damping: the fraction of the difference between the cube's
 * velocity and its resting place's velocity removed each tick. With
 * `HeldStiffness` the spring is a little underdamped (a damping ratio of
 * about 0.6): the cube swings slightly past and settles in about a second.
 *
 * @category Constant
 * @since 1.1.81
 */
export const HeldDamping = 0.35;

/**
 * The most the cube's velocity may change in one tick, in blocks per tick.
 *
 * @category Constant
 * @since 1.1.81
 */
export const HeldMostAcceleration = 0.3;

/**
 * The cube's top speed, in blocks per tick.
 *
 * @category Constant
 * @since 1.1.81
 */
export const HeldMostSpeed = 1.5;

/** Farther than this from its resting place, in blocks, the cube is teleported there and stopped. */
const SnapDistance = 8;

/**
 * Each carrying player's cube by player id: the entity (undefined until it
 * could be spawned), where the cube was a tick ago and where its resting
 * place was a tick ago.
 */
const Held = new Map();

/** A vector's length. */
function Length({ x, y, z })
{
    return Math.hypot(x, y, z);
}

/** A vector shortened, if it is longer than `Most`, to that length. */
function Limit(Vector, Most)
{
    const Size = Length(Vector);
    if (Size <= Most) return Vector;
    const Scale = Most / Size;
    return { x: Vector.x * Scale, y: Vector.y * Scale, z: Vector.z * Scale };
}

/**
 * The most the cube's turning speed may change in one tick, in degrees per
 * tick.
 *
 * @category Constant
 * @since 1.1.82
 */
export const HeldMostSpinChange = 10;

/**
 * The cube's top turning speed, in degrees per tick.
 *
 * @category Constant
 * @since 1.1.82
 */
export const HeldMostSpin = 30;

/** An angle in degrees brought into [-180, 180). */
function Wrap(Degrees)
{
    return ((Degrees + 180) % 360 + 360) % 360 - 180;
}

/**
 * Where a player's cube rests: the entity location, the middle of the cube's
 * bottom face, that puts its center where the player's camera holds it,
 * `HeldDistance` ahead of the eyes along the view and `HeldDrop` toward the
 * bottom of the screen. Looking up or down swings it up or down around the
 * eyes; looking straight down puts it below them and a little behind.
 *
 * @category Running
 * @since 1.1.81
 */
export function HeldRest(Player)
{
    const Eyes = Player.getHeadLocation();
    const { x: PitchDegrees, y: YawDegrees } = Player.getRotation();
    const Yaw = YawDegrees * Math.PI / 180;
    // A positive pitch looks down.
    const Pitch = PitchDegrees * Math.PI / 180;
    const Ahead = { x: -Math.sin(Yaw) * Math.cos(Pitch), y: -Math.sin(Pitch), z: Math.cos(Yaw) * Math.cos(Pitch) };
    // The camera's up: square to the view, and straight up when looking level.
    const Up = { x: -Math.sin(Yaw) * Math.sin(Pitch), y: Math.cos(Pitch), z: Math.cos(Yaw) * Math.sin(Pitch) };
    return {
        x: Eyes.x + Ahead.x * HeldDistance - Up.x * HeldDrop,
        y: Eyes.y + Ahead.y * HeldDistance - Up.y * HeldDrop - 0.5,
        z: Eyes.z + Ahead.z * HeldDistance - Up.z * HeldDrop
    };
}

/** Spawns a player's cube at its resting place, facing as the player does, replacing any it has. */
function SpawnCube(Player)
{
    const Earlier = Held.get(Player.id)?.Cube;
    if (Earlier?.isValid) Earlier.remove();
    const Rest = HeldRest(Player);
    const Yaw = Player.getRotation().y;
    const State = { Cube: undefined, Was: Rest, RestWas: Rest, Yaw, Spin: 0, PlayerYawWas: Yaw };
    Held.set(Player.id, State);
    State.Cube = Player.dimension.spawnEntity(HeldCube, Rest);
    State.Cube.setRotation({ x: 0, y: Yaw });
    const At = (Value) => Value.toFixed(2);
    console.warn(`HELD_CUBE spawned in ${Player.dimension.id} at ${At(Rest.x)} ${At(Rest.y)} ${At(Rest.z)}`);
}

/**
 * Moves a player's cube on by a tick. Its velocity is what it really moved by
 * last tick, plus the spring's pull toward its resting place, less the
 * damping of its velocity relative to that place's: the cube follows a player
 * walking steadily without trailing, and lags only when the player turns or
 * changes speed. The change and the result are limited to
 * `HeldMostAcceleration` and `HeldMostSpeed`. A cube that is missing,
 * unloaded or in another dimension is brought to its resting place, and one
 * more than `SnapDistance` away is teleported there.
 */
function StepCube(Player, State)
{
    const Rest = HeldRest(Player);
    const Cube = State.Cube;
    if (!Cube?.isValid)
    {
        SpawnCube(Player);
        return;
    }

    const Here = Cube.location;
    const Off = { x: Rest.x - Here.x, y: Rest.y - Here.y, z: Rest.z - Here.z };
    if (Cube.dimension.id !== Player.dimension.id || Length(Off) > SnapDistance)
    {
        Cube.teleport(Rest, { dimension: Player.dimension });
        Cube.clearVelocity();
        State.Was = Rest;
        State.RestWas = Rest;
        TurnCube(Player, State);
        return;
    }

    const Moved = { x: Here.x - State.Was.x, y: Here.y - State.Was.y, z: Here.z - State.Was.z };
    const RestMoved = { x: Rest.x - State.RestWas.x, y: Rest.y - State.RestWas.y, z: Rest.z - State.RestWas.z };
    const Pull = Limit({
        x: HeldStiffness * Off.x + HeldDamping * (RestMoved.x - Moved.x),
        y: HeldStiffness * Off.y + HeldDamping * (RestMoved.y - Moved.y),
        z: HeldStiffness * Off.z + HeldDamping * (RestMoved.z - Moved.z)
    }, HeldMostAcceleration);
    const Velocity = Limit({ x: Moved.x + Pull.x, y: Moved.y + Pull.y, z: Moved.z + Pull.z }, HeldMostSpeed);
    Cube.clearVelocity();
    Cube.applyImpulse(Velocity);
    State.Was = Here;
    State.RestWas = Rest;
    TurnCube(Player, State);
}

/**
 * Turns a player's cube on by a tick toward the player's yaw, with the same
 * damped spring as its movement, in degrees: it lags behind the player's
 * turns, swings slightly past and settles facing as the player does. The
 * change and the result are limited to `HeldMostSpinChange` and
 * `HeldMostSpin`.
 */
function TurnCube(Player, State)
{
    const PlayerYaw = Player.getRotation().y;
    const Off = Wrap(PlayerYaw - State.Yaw);
    const PlayerSpin = Wrap(PlayerYaw - State.PlayerYawWas);
    const Clamp = (Value, Most) => Math.max(-Most, Math.min(Most, Value));
    const Change = Clamp(HeldStiffness * Off + HeldDamping * (PlayerSpin - State.Spin), HeldMostSpinChange);
    State.Spin = Clamp(State.Spin + Change, HeldMostSpin);
    State.Yaw = Wrap(State.Yaw + State.Spin);
    State.PlayerYawWas = PlayerYaw;
    State.Cube.setRotation({ x: 0, y: State.Yaw });
}

/** Removes every loaded held cube in the demo's dimensions that no player carries. */
function RemoveStrayCubes()
{
    const Carried = new Set([ ...Held.values() ].map(({ Cube }) => Cube?.id));
    for (const Dimension of [ world.getDimension("overworld"), world.getDimension("nether"),
        world.getDimension("the_end"), FlatDimension() ])
    {
        for (const Entity of Dimension.getEntities({ type: HeldCube }))
        {
            if (!Carried.has(Entity.id)) Entity.remove();
        }
    }
}

// A joining player gets a cube. After a script reload, so does everyone already here.
world.afterEvents.playerSpawn.subscribe(({ initialSpawn, player }) =>
{
    if (!initialSpawn) return;
    try { SpawnCube(player); }
    catch (Error) { console.error(`Held cube: ${Error?.stack ?? Error}`); }
});

world.afterEvents.worldLoad.subscribe(() =>
{
    try
    {
        RemoveStrayCubes();
        for (const Player of world.getAllPlayers()) SpawnCube(Player);
    }
    catch (Error) { console.error(`Held cube: ${Error?.stack ?? Error}`); }
});

world.afterEvents.playerLeave.subscribe(({ playerId }) =>
{
    const Cube = Held.get(playerId)?.Cube;
    Held.delete(playerId);
    try { if (Cube?.isValid) Cube.remove(); }
    catch (Error) { console.error(`Held cube: ${Error?.stack ?? Error}`); }
});

// A cube saved in a chunk that unloaded under it loads again later as a stray.
world.afterEvents.entityLoad.subscribe(({ entity }) =>
{
    try
    {
        if (entity.typeId !== HeldCube) return;
        const Carried = [ ...Held.values() ].some(({ Cube }) => Cube?.id === entity.id);
        if (!Carried) entity.remove();
    }
    catch (Error) { console.error(`Held cube: ${Error?.stack ?? Error}`); }
});

system.runInterval(() =>
{
    for (const Player of world.getAllPlayers())
    {
        const State = Held.get(Player.id);
        if (!State) continue;
        try { StepCube(Player, State); }
        catch (Error) { console.error(`Held cube: ${Error?.stack ?? Error}`); }
    }
}, 1);
