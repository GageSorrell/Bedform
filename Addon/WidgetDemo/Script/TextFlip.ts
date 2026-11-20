/**
 * Demonstration-only TextPrimitive wrapper that can turn text to face a View's +Z side.
 *
 * Canvas particle surfaces, Layout depth and pointer targeting treat a View's local +Z side as its
 * front. Bedform's in-progress text surface (ty2k.11) currently sends a yaw that, per the recorded
 * client finding (yaw θ is readable toward (−sin θ, −cos θ)), faces the −Z side. Until that is
 * settled, this wrapper adds 180° of yaw when flipping is on, and /scriptevent widget_demo:text_flip
 * toggles it so both orientations can be compared in the client.
 *
 * @module @sorrell/widget-demo/Script/TextFlip
 *
 * @file      TextFlip.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as Text from "../../../Package/Bedform/Source/Spatial/Text.js";
import type { DimensionLocation, TextPrimitive, Vector3 } from "@minecraft/server";

/**
 * Wrapped primitives, the native primitive behind each and its unflipped rotation.
 *
 * @category Model
 * @since 1.0.0
 */
interface Wrapped {
    readonly Native: TextPrimitive;
    Rotation: Vector3;
}

const Natives: WeakMap<object, Wrapped> = new WeakMap();
const Live: Set<Wrapped> = new Set();
let Flip = true;

/**
 * Forwarded TextPrimitive properties.
 *
 * @category Constant
 * @since 1.0.0
 */
const Forwarded = [
    "visibleTo",
    "useRotation",
    "scale",
    "color",
    "backgroundColorOverride",
    "depthTest",
    "textBackfaceVisible",
    "backfaceVisible"
] as const;

/**
 * Applies the current flip setting to one primitive.
 *
 * @category Transforming
 * @since 1.0.0
 */
function Apply(entry: Wrapped): void
{
    const yaw = entry.Rotation.y + (Flip ? 180 : 0);
    const normalized = ((yaw % 360) + 540) % 360 - 180;
    entry.Native.rotation = {
        x: entry.Rotation.x,
        y: normalized === -180 ? 180 : normalized,
        z: entry.Rotation.z
    };
}

/**
 * Wraps a native TextPrimitive in the structural ABI the Bedform text surface uses.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Wrap(native: TextPrimitive): Text.Primitive
{
    const entry: Wrapped = {
        Native: native,
        Rotation: {
            x: 0,
            y: 0,
            z: 0
        }
    };
    const wrapper = {
        remove: (): void =>
        {
            Live.delete(entry);
            native.remove();
        },
        setLocation: (location: Text.Location): void =>
            native.setLocation(location as unknown as DimensionLocation),
        setText: (value: string): void => native.setText(value)
    } as unknown as Text.Primitive;
    for (const key of Forwarded)
    {
        Object.defineProperty(wrapper, key, {
            enumerable: true,
            get: (): unknown => native[key],
            set: (value: unknown): void =>
            {
                (native as unknown as Record<string, unknown>)[key] = value;
            }
        });
    }

    Object.defineProperty(wrapper, "rotation", {
        enumerable: true,
        get: (): Vector3 => entry.Rotation,
        set: (value: Vector3): void =>
        {
            entry.Rotation = { ...value };
            Apply(entry);
        }
    });
    Natives.set(wrapper, entry);
    Live.add(entry);
    return wrapper;
}

/**
 * Returns the native primitive behind a wrapper.
 *
 * @throws { TypeError } If the value was not created by Wrap.
 *
 * @category Getter
 * @since 1.0.0
 */
export function Unwrap(wrapper: Text.Primitive): TextPrimitive
{
    const entry = Natives.get(wrapper);
    if (!entry)
    {
        throw new TypeError("Not a demonstration text primitive.");
    }

    return entry.Native;
}

/**
 * Toggles the flip for every live and future primitive and returns the new setting.
 *
 * @category Running
 * @since 1.0.0
 */
export function Toggle(): boolean
{
    Flip = !Flip;
    for (const entry of Live)
    {
        try
        {
            Apply(entry);
        }
        catch
        {
            Live.delete(entry);
        }
    }

    return Flip;
}
