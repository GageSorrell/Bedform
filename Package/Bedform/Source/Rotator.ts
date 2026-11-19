/**
 * Pure degree-based rotation conventions, values and helper operations.
 *
 * @module bedform/Rotator
 *
 * @file      Rotator.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Document exported variables at their export declaration. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as Equal from "@bedform/effect/Equal";
import * as Hash from "@bedform/effect/Hash";
import type * as Inspectable from "@bedform/effect/Inspectable";
import * as N from "@bedform/effect/Number";
import * as Option from "@bedform/effect/Option";
import * as Order from "@bedform/effect/Order";
import type * as Pipeable from "@bedform/effect/Pipeable";
import * as Q from "./Quat.js";
import * as V3 from "./Vector3.js";
import { RotatorTypeId,
    compareRotators,
    formatRotator,
    isRotatorValue,
    makeRotator,
    rotatorKey } from "./Internal/Rotator.js";
import { compareNumbers, normalizedDegrees } from "./Internal/Rotation.js";
import { dual } from "@bedform/effect/Function";
import { parseComponents } from "./Internal/Vector.js";

/**
 * Plain readonly pitch/yaw/roll angles in degrees.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Coordinates
{
    readonly pitch: number;
    readonly yaw: number;
    readonly roll: number;
}

/**
 * Immutable degree-based angles with canonical orientation protocols.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Rotator extends Coordinates, Equal.Equal, Pipeable.Pipeable, Inspectable.Inspectable
{
    readonly [RotatorTypeId]: typeof RotatorTypeId;
}

/**
 * An exactly empty extending interface inside Rotator, without a root namespace or package
 * subpath.
 *
 * @category Types
 * @since 1.0.0
 */
export interface EulerAngle extends Rotator {}

/**
 * Full-precision stored angle fields and a Rotator discriminator.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Json extends Coordinates
{
    readonly _id: "Rotator";
}

/**
 * Frozen complete-turn winding and signed-angle remainder values.
 *
 * @category Types
 * @since 1.0.0
 */
export interface WindingRemainder
{
    readonly winding: Rotator;
    readonly remainder: Rotator;
}

/**
 * Named component axes used by functional access and update operations.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Axis = Object.freeze({ Pitch: "pitch",
    Roll: "roll",
    Yaw: "yaw" } as const);

/**
 * Named component axes used by functional access and update operations.
 *
 * @category Types
 * @since 1.0.0
 */
export type Axis = typeof Axis[keyof typeof Axis];

/**
 * Data-first and data-last signatures preserving receiver order.
 *
 * @category Types
 * @since 1.0.0
 */
interface Binary<Self, That, Value>
{
    (that: That): (self: Self) => Value;
    (self: Self, that: That): Value;
}

/**
 * Direct, curried and piped scalar angle reduction.
 *
 * @category Types
 * @since 1.0.0
 */
interface UnaryAngle
{
    (): (self: number) => number;
    (self: number): number;
}

/**
 * Direct, curried and piped partial angle encoding or decoding.
 *
 * @category Types
 * @since 1.0.0
 */
interface UnaryPartial
{
    (): (self: number) => Option.Option<number>;
    (self: number): Option.Option<number>;
}

/**
 * Builds a two-argument dual operation preserving operand order.
 *
 * @category Operation
 * @since 1.0.0
 */
const binary = <Self, That, Value>(body: (self: Self, that: That) => Value): Binary<Self, That, Value> =>
{
    return dual(2, body);
};

/**
 * Copies and freezes raw degree components, including unsafe numeric values.
 *
 * @category Operation
 * @since 1.0.0
 */
export const RotatorUnsafe = (pitch: number, yaw: number, roll: number): Rotator =>
{
    return makeRotator(pitch, yaw, roll);
};

/**
 * Constructs finite degree angles; zero is valid and raw winding is retained.
 *
 * @category Operation
 * @since 1.0.0
 */
export const Rotator = (pitch: number, yaw: number, roll: number): Option.Option<Rotator> =>
{
    return [ pitch, yaw, roll ].every(N.Number.isFinite)
        ? Option.some(makeRotator(pitch, yaw, roll)) : Option.none();
};

/**
 * Checks the enriched Rotator discriminator without rejecting unsafe values.
 *
 * @category Operation
 * @since 1.0.0
 */
export const isRotator = (input: unknown): input is Rotator =>
{
    return isRotatorValue(input);
};

/**
 * Checks raw component finiteness.
 *
 * @category Operation
 * @since 1.0.0
 */
export const isFinite = (self: Coordinates): boolean =>
{
    return [ self.pitch, self.yaw, self.roll ].every(N.Number.isFinite);
};

/**
 * Adds raw degree components without composing orientations.
 *
 * @category Operation
 * @since 1.0.0
 */
export const add: Binary<Coordinates, Coordinates, Rotator> = binary((self: Coordinates, that: Coordinates) =>
    makeRotator(self.pitch + that.pitch, self.yaw + that.yaw, self.roll + that.roll));

/**
 * Subtracts raw angles in self-minus-that order.
 *
 * @category Operation
 * @since 1.0.0
 */
export const subtract: Binary<Coordinates,
    Coordinates,
    Rotator> = binary((self: Coordinates,
    that: Coordinates) =>
    makeRotator(self.pitch - that.pitch, self.yaw - that.yaw, self.roll - that.roll));

/**
 * Scales raw degree components without orientation normalization.
 *
 * @category Operation
 * @since 1.0.0
 */
export const scale: Binary<Coordinates, number, Rotator> = binary((self: Coordinates, that: number) =>
    makeRotator(self.pitch * that, self.yaw * that, self.roll * that));

/**
 * Negates raw components; this is distinct from orientation inverse.
 *
 * @category Operation
 * @since 1.0.0
 */
export const negate = (self: Coordinates): Rotator =>
{
    return scale(self, -1);
};

/**
 * Reads a named degree component.
 *
 * @category Operation
 * @since 1.0.0
 */
export const getAxis: Binary<Coordinates,
    Axis,
    number> = binary((self: Coordinates,
    that: Axis) => self[that]);

/**
 * Replaces one component in a fresh frozen value, preserving other raw components.
 *
 * @category Operation
 * @since 1.0.0
 */
export const setAxis: {
    (axis: Axis, value: number): (self: Coordinates) => Rotator;
    (self: Coordinates, axis: Axis, value: number): Rotator;
} = dual(3, (self: Coordinates, axis: Axis, value: number): Rotator => makeRotator(
    axis === Axis.Pitch ? value : self.pitch,
    axis === Axis.Yaw ? value : self.yaw,
    axis === Axis.Roll ? value : self.roll));

/**
 * Wraps degrees to [0,360), using Number positiveModulo semantics.
 *
 * @category Operation
 * @since 1.0.0
 */
export const wrapAxis: UnaryAngle = dual((args: IArguments) => args.length > 0,
    (self: number): number => N.positiveModulo(self, 360));

/**
 * Aliases scalar wrapping to [0,360).
 *
 * @category Operation
 * @since 1.0.0
 */
export const clampAxis = wrapAxis;

/**
 * Reduces to [-180,180), preserving tiny signed finite angles.
 *
 * @category Operation
 * @since 1.0.0
 */
export const normalizeAxis: UnaryAngle = dual((args: IArguments) => args.length > 0, normalizedDegrees);

/**
 * Wraps each component to [0,360), with raw NaN results for nonfinite components.
 *
 * @category Operation
 * @since 1.0.0
 */
export const wrap = (self: Coordinates): Rotator =>
{
    return makeRotator(wrapAxis(self.pitch), wrapAxis(self.yaw), wrapAxis(self.roll));
};

/**
 * Aliases component wrapping to [0,360).
 *
 * @category Operation
 * @since 1.0.0
 */
export const clamp = wrap;

/**
 * Reduces components independently to [-180,180), without principal Euler conversion.
 *
 * @category Operation
 * @since 1.0.0
 */
export const normalize = (self: Coordinates): Rotator =>
{
    return makeRotator(normalizeAxis(self.pitch), normalizeAxis(self.yaw), normalizeAxis(self.roll));
};

/**
 * Checks exact component zero modulo complete turns, rather than all equivalent identity
 * representations.
 *
 * @category Operation
 * @since 1.0.0
 */
export const isZero = (self: Coordinates): boolean =>
{
    const Value = normalize(self);
    return Value.pitch === 0 && Value.yaw === 0 && Value.roll === 0;
};

/**
 * Checks signed reduced components against an explicit finite nonnegative degree tolerance.
 *
 * @category Operation
 * @since 1.0.0
 */
export const isNearlyZero: Binary<Coordinates, number, boolean> = binary((self: Coordinates, that: number) =>
{
    const Value = normalize(self);
    return N.Number.isFinite(that) && that >= 0 &&
        N.abs(Value.pitch) <= that && N.abs(Value.yaw) <= that && N.abs(Value.roll) <= that;
});

/**
 * Checks that all raw components are finite and already in [-180,180).
 *
 * @category Operation
 * @since 1.0.0
 */
export const isNormalized = (self: Coordinates): boolean =>
{
    return isFinite(self) && self.pitch >= -180 && self.pitch < 180 && self.yaw >= -180 &&
        self.yaw < 180 && self.roll >= -180 && self.roll < 180;
};

/**
 * Converts using qY(-yaw)*qX(pitch)*qZ(roll), reducing winding before trigonometry.
 *
 * @category Operation
 * @since 1.0.0
 */
export const toQuat = (self: Coordinates): Option.Option<Q.Quat> =>
{
    return Q.fromRotator(self);
};

/**
 * Extracts principal Euler angles; pitch poles set roll zero and absorb residual rotation into
 * yaw.
 *
 * @category Operation
 * @since 1.0.0
 */
export const fromQuat = (self: Q.Coordinates): Option.Option<Rotator> =>
{
    return Q.toRotator(self);
};

/**
 * Copies raw angles to a frozen Vector3 with x=pitch, y=yaw and z=roll, in degrees.
 *
 * @category Operation
 * @since 1.0.0
 */
export const toEuler = (self: Coordinates): V3.Vector3 =>
{
    return V3.Vector3Unsafe(self.pitch, self.yaw, self.roll);
};

/**
 * Validates the degree vector mapping x=pitch, y=yaw, z=roll.
 *
 * @category Operation
 * @since 1.0.0
 */
export const fromEuler = (self: V3.Coordinates): Option.Option<Rotator> =>
{
    return Rotator(self.x, self.y, self.z);
};

/**
 * Produces the deterministic orientation-equivalent principal Euler representation.
 *
 * @category Operation
 * @since 1.0.0
 */
export const principal = (self: Coordinates): Option.Option<Rotator> =>
{
    return Option.flatMap(toQuat(self), fromQuat);
};

/**
 * Separates complete turns from the signed component remainder; nonfinite input yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const windingAndRemainder = (self: Coordinates): Option.Option<WindingRemainder> =>
{
    if (!isFinite(self))
    {
        return Option.none();
    }

    const Remainder = normalize(self);
    const Winding = subtract(self, Remainder);
    return isZero(Winding) && equalsComponents(add(Winding, Remainder), self)
        ? Option.some(Object.freeze({ remainder: Remainder,
            winding: Winding })) : Option.none();
};

/**
 * Returns the alternate normalized Euler representation (180-pitch,yaw+180,roll+180).
 *
 * @category Operation
 * @since 1.0.0
 */
export const equivalent = (self: Coordinates): Option.Option<Rotator> =>
{
    if (!isFinite(self))
    {
        return Option.none();
    }

    const Reduced = normalize(self);
    return Option.some(normalize(makeRotator(180 - Reduced.pitch, Reduced.yaw + 180, Reduced.roll + 180)));
};

/**
 * Sums absolute raw component differences in degrees.
 *
 * @category Operation
 * @since 1.0.0
 */
export const manhattanDistance: Binary<Coordinates,
    Coordinates,
    number> = binary((self: Coordinates,
    that: Coordinates) =>
    N.abs(self.pitch - that.pitch) + N.abs(self.yaw - that.yaw) + N.abs(self.roll - that.roll));

/**
 * Selects per-component winding nearest a finite reference.
 *
 * @category Operation
 * @since 1.0.0
 */
const nearReference = (self: Coordinates, reference: Coordinates): Rotator =>
{
    return makeRotator(
        reference.pitch + normalizeAxis(self.pitch - normalizeAxis(reference.pitch)),
        reference.yaw + normalizeAxis(self.yaw - normalizeAxis(reference.yaw)),
        reference.roll + normalizeAxis(self.roll - normalizeAxis(reference.roll)));
};

/**
 * Chooses the nearest principal/alternate Euler representation by raw Manhattan distance.
 * Unrepresentable equivalent output yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const closest: Binary<Coordinates, Coordinates, Option.Option<Rotator>> = binary(
    (self: Coordinates, that: Coordinates): Option.Option<Rotator> =>
    {
        if (!isFinite(that))
        {
            return Option.none();
        }

        const P = principal(self);
        if (Option.isNone(P))
        {
            return Option.none();
        }

        const E = equivalent(P.value);
        if (Option.isNone(E))
        {
            return Option.none();
        }

        const Original = toQuat(self);
        if (Option.isNone(Original))
        {
            return Option.none();
        }

        let Best = Option.none<Rotator>();
        for (const Candidate of [ nearReference(P.value, that), nearReference(E.value, that) ])
        {
            const Reconstructed = toQuat(Candidate);
            if (Option.isNone(Reconstructed) ||
                !Option.getOrElse(Q.equalsApprox(Original.value, Reconstructed.value, 1e-9), () => false))
            {
                continue;
            }

            if (Option.isNone(Best) || manhattanDistance(Candidate,
                that) < manhattanDistance(Best.value,
                that))
            {
                Best = Option.some(Candidate);
            }
        }

        return Best;
    });

/**
 * Snaps one component to a grid; zero spacing disables that component.
 *
 * @category Operation
 * @since 1.0.0
 */
const snap = (value: number, grid: number): number =>
{
    if (grid === 0)
    {
        return value;
    }

    const Quotient = value / grid;
    return N.Number.isFinite(Quotient) ? N.round(Quotient, 0) * grid : value;
};

/**
 * Snaps to a uniform or per-axis finite nonnegative grid in degrees. Invalid or unrepresentable
 * output yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const gridSnap: Binary<Coordinates, number | Coordinates, Option.Option<Rotator>> = binary(
    (self: Coordinates, that: number | Coordinates): Option.Option<Rotator> =>
    {
        const Grid = typeof that === "number" ? makeRotator(that, that, that) : that;
        if (!isFinite(self) || !isFinite(Grid) || Grid.pitch < 0 || Grid.yaw < 0 || Grid.roll < 0)
        {
            return Option.none();
        }

        return Rotator(snap(self.pitch, Grid.pitch), snap(self.yaw, Grid.yaw), snap(self.roll, Grid.roll));
    });

/**
 * Wraps and rounds an angle into a bounded unsigned integer code.
 *
 * @category Operation
 * @since 1.0.0
 */
const compress = (self: number, steps: number): Option.Option<number> =>
{
    return N.Number.isFinite(self)
        ? Option.some(N.positiveModulo(N.round(wrapAxis(self) * (steps / 360), 0), steps)) : Option.none();
};

/**
 * Validates an integer code and converts it into degrees in [0,360).
 *
 * @category Operation
 * @since 1.0.0
 */
const decompress = (self: number, steps: number): Option.Option<number> =>
{
    return N.Number.isInteger(self) && self >= 0 && self < steps
        ? Option.some(self * (360 / steps)) : Option.none();
};

/**
 * Encodes finite degrees into 0..255 using nearest-code wrapping.
 *
 * @category Operation
 * @since 1.0.0
 */
export const compressAxisToByte: UnaryPartial = dual((args: IArguments) => args.length > 0,
    (self: number): Option.Option<number> => compress(self, 256));

/**
 * Decodes integer 0..255 into degrees; out-of-range or fractional input yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const decompressAxisFromByte: UnaryPartial = dual((args: IArguments) => args.length > 0,
    (self: number): Option.Option<number> => decompress(self, 256));

/**
 * Encodes finite degrees into 0..65535 using nearest-code wrapping.
 *
 * @category Operation
 * @since 1.0.0
 */
export const compressAxisToShort: UnaryPartial = dual((args: IArguments) => args.length > 0,
    (self: number): Option.Option<number> => compress(self, 65_536));

/**
 * Decodes integer 0..65535 into degrees; invalid input yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const decompressAxisFromShort: UnaryPartial = dual((args: IArguments) => args.length > 0,
    (self: number): Option.Option<number> => decompress(self, 65_536));

/**
 * Computes orientation inverse through Quat, returning principal degree angles.
 *
 * @category Operation
 * @since 1.0.0
 */
export const inverse = (self: Coordinates): Option.Option<Rotator> =>
{
    return Option.flatMap(Option.flatMap(toQuat(self), Q.inverse), fromQuat);
};

/**
 * Composes rotations through Hamilton multiplication; compose(a,b) applies b before a.
 *
 * @category Operation
 * @since 1.0.0
 */
export const compose: Binary<Coordinates, Coordinates, Option.Option<Rotator>> = binary(
    (self: Coordinates, that: Coordinates): Option.Option<Rotator> =>
    {
        const A = toQuat(self);
        const B = toQuat(that);
        return Option.isSome(A) && Option.isSome(B) ? fromQuat(Q.multiply(A.value,
            B.value)) : Option.none();
    });

/**
 * Aliases orientation composition, distinct from component addition.
 *
 * @category Operation
 * @since 1.0.0
 */
export const multiply = compose;

/**
 * Samples the shortest quaternion arc with unclamped t and returns principal degree angles.
 *
 * @category Operation
 * @since 1.0.0
 */
export const slerp: {
    (that: Coordinates, t: number): (self: Coordinates) => Option.Option<Rotator>;
    (self: Coordinates, that: Coordinates, t: number): Option.Option<Rotator>;
} = dual(3, (self: Coordinates, that: Coordinates, t: number): Option.Option<Rotator> =>
{
    const A = toQuat(self);
    const B = toQuat(that);
    return Option.isSome(A) && Option.isSome(B)
        ? Option.flatMap(Q.slerp(A.value, B.value, t), fromQuat) : Option.none();
});

/**
 * Rotates a finite vector through Quat using Minecraft coordinate conventions.
 *
 * @category Operation
 * @since 1.0.0
 */
export const rotateVector: Binary<Coordinates, V3.Coordinates, Option.Option<V3.Vector3>> = binary(
    (self: Coordinates, that: V3.Coordinates) => Option.flatMap(toQuat(self), Q.rotateVector(that)));

/**
 * Applies the inverse orientation to a finite vector.
 *
 * @category Operation
 * @since 1.0.0
 */
export const unrotateVector: Binary<Coordinates, V3.Coordinates, Option.Option<V3.Vector3>> = binary(
    (self: Coordinates, that: V3.Coordinates) => Option.flatMap(toQuat(self), Q.unrotateVector(that)));

/**
 * Extracts the rotated positive X coordinate axis.
 *
 * @category Operation
 * @since 1.0.0
 */
export const axisX = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return Option.flatMap(toQuat(self), Q.axisX);
};

/**
 * Extracts the rotated positive Y coordinate axis.
 *
 * @category Operation
 * @since 1.0.0
 */
export const axisY = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return Option.flatMap(toQuat(self), Q.axisY);
};

/**
 * Extracts the rotated positive Z coordinate axis.
 *
 * @category Operation
 * @since 1.0.0
 */
export const axisZ = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return Option.flatMap(toQuat(self), Q.axisZ);
};

/**
 * Extracts facing-forward from neutral +Z.
 *
 * @category Operation
 * @since 1.0.0
 */
export const forward = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return Option.flatMap(toQuat(self), Q.forward);
};

/**
 * Extracts facing-up from neutral +Y.
 *
 * @category Operation
 * @since 1.0.0
 */
export const up = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return Option.flatMap(toQuat(self), Q.up);
};

/**
 * Extracts facing-right from neutral -X.
 *
 * @category Operation
 * @since 1.0.0
 */
export const right = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return Option.flatMap(toQuat(self), Q.right);
};

/**
 * Extracts all three positive coordinate axes in a frozen record.
 *
 * @category Operation
 * @since 1.0.0
 */
export const axes = (self: Coordinates): Option.Option<Q.Axes> =>
{
    return Option.flatMap(toQuat(self), Q.axes);
};

/**
 * Measures shortest orientation distance in degrees through Quat.
 *
 * @category Operation
 * @since 1.0.0
 */
export const angularDistance: Binary<Coordinates, Coordinates, Option.Option<number>> = binary(
    (self: Coordinates, that: Coordinates): Option.Option<number> =>
    {
        const A = toQuat(self);
        const B = toQuat(that);
        return Option.isSome(A) && Option.isSome(B)
            ? Option.map(Q.angularDistance(A.value, B.value), N.toDegrees) : Option.none();
    });

/**
 * Compares angular distance against an explicit finite nonnegative degree tolerance.
 *
 * @category Operation
 * @since 1.0.0
 */
export const equalsApprox: {
    (that: Coordinates, tolerance: number): (self: Coordinates) => Option.Option<boolean>;
    (self: Coordinates, that: Coordinates, tolerance: number): Option.Option<boolean>;
} = dual(3, (self: Coordinates, that: Coordinates, tolerance: number): Option.Option<boolean> =>
    !N.Number.isFinite(tolerance) || tolerance < 0 ? Option.none() :
        Option.map(angularDistance(self, that), (angle: number) => angle <= tolerance));

/**
 * Compares canonical orientations, with deterministic invalid raw fallbacks.
 *
 * @category Operation
 * @since 1.0.0
 */
export const equals: Binary<Coordinates, Coordinates, boolean> = binary(
    (self: Coordinates, that: Coordinates) => compareRotators(self, that) === 0);

/**
 * Compares stored degree components exactly using Effect numeric semantics.
 *
 * @category Operation
 * @since 1.0.0
 */
export const equalsComponents: Binary<Coordinates, Coordinates, boolean> = binary(
    (self: Coordinates, that: Coordinates) => Equal.equals(self.pitch, that.pitch) &&
        Equal.equals(self.yaw, that.yaw) && Equal.equals(self.roll, that.roll));

/**
 * Hashes raw degree components independently of canonical orientation.
 *
 * @category Operation
 * @since 1.0.0
 */
export const hashComponents = (self: Coordinates): number =>
{
    return Hash.combine(Hash.string(RotatorTypeId))(Hash.array([ self.pitch, self.yaw, self.roll ]));
};

/**
 * Checks canonical orientation equality with identity, including nontrivial equivalent Euler
 * representations.
 *
 * @category Operation
 * @since 1.0.0
 */
export const isIdentity = (self: Coordinates): boolean =>
{
    return equals(self, Zero);
};

/**
 * Exposes the shared Quat-derived twelve-decimal orientation key.
 *
 * @category Operation
 * @since 1.0.0
 */
export const canonicalKey = rotatorKey;

/**
 * Formats raw full-precision angles as Rotator(pitch, yaw, roll).
 *
 * @category Operation
 * @since 1.0.0
 */
export const format = formatRotator;

/**
 * Aliases default raw angle formatting.
 *
 * @category Operation
 * @since 1.0.0
 */
export const toString = formatRotator;

/**
 * Parses complete finite default Rotator text; malformed fields yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const fromString = (self: string): Option.Option<Rotator> =>
{
    const Match = /^Rotator\((.*)\)$/.exec(self.trim());
    return Match === null ? Option.none() : Option.flatMap(parseComponents(Match[1], 3),
        (angles: ReadonlyArray<number>) => Rotator(angles[0], angles[1], angles[2]));
};

/**
 * Aliases strict full-precision Rotator parsing.
 *
 * @category Operation
 * @since 1.0.0
 */
export const parse = fromString;

/**
 * Orders canonical distance from a snapshotted reference, with Rotator lexicographic ties.
 *
 * @category Operation
 * @since 1.0.0
 */
const angleOrder = (reference: Q.CanonicalKey): Order.Order<Coordinates> =>
{
    const Reference = Q.QuatUnsafe(...reference);
    return Order.make((self: Coordinates, that: Coordinates): -1 | 0 | 1 =>
    {
        const A = rotatorKey(self);
        const B = rotatorKey(that);
        if (Option.isNone(A) || Option.isNone(B))
        {
            return compareRotators(self, that);
        }

        const First = Option.getOrElse(Q.angularDistance(Reference, Q.QuatUnsafe(...A.value)), () => 0);
        const Second = Option.getOrElse(Q.angularDistance(Reference,
            Q.QuatUnsafe(...B.value)),
        () => 0);
        const Compared = compareNumbers(First, Second);
        return Compared === 0 ? compareRotators(self, that) : Compared;
    });
};

/**
 * Creates a canonical angle-distance order; invalid references yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const orderByAngleDistance = (reference: Coordinates): Option.Option<Order.Order<Coordinates>> =>
{
    return Option.map(rotatorKey(reference), angleOrder);
};

/**
 * The neutral zero-angle value.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Zero: Rotator = makeRotator(0, 0, 0);

/**
 * Aliases the immutable neutral value.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Identity = Zero;

/**
 * Orders principal Euler angles from canonical Quat keys, with key tie-breaking and invalid
 * values last.
 *
 * @category Operation
 * @since 1.0.0
 */
export const OrderLexicographic: Order.Order<Coordinates> = Order.make(compareRotators);

/**
 * Orders canonical angle distance from identity, with lexicographic ties.
 *
 * @category Operation
 * @since 1.0.0
 */
export const OrderAngleDistance: Order.Order<Coordinates> = angleOrder([ 0, 0, 0, 1 ]);
