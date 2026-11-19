/**
 * Immutable origin-based rigid motion in a containing coordinate frame.
 *
 * @module bedform/RigidTransform
 *
 * @file      RigidTransform.ts
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
import * as Number from "@bedform/effect/Number";
import * as Option from "@bedform/effect/Option";
import * as Quat from "./Quat.js";
import * as Transform from "./Transform.js";
import * as Vector3 from "./Vector3.js";
import { formatComponents, parseComponents } from "./Internal/Vector.js";
import { dual } from "@bedform/effect/Function";
import { interpolateComponent } from "./Internal/Transform.js";

/**
 * Discriminates moving poses from pose-only and other spatial values.
 *
 * @category Symbols
 * @since 1.0.0
 */
const TypeId = "~bedform/RigidTransform" as const;

/**
 * Structural pose and origin velocity inputs. Velocities use the containing frame, in
 * blocks/second and radians/second respectively; the second composed operand uses the first's frame.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Coordinates extends Transform.Coordinates
{
    readonly linearVelocity: Vector3.Coordinates;
    readonly angularVelocity: Vector3.Coordinates;
}

/**
 * Deeply frozen pose plus motion at its origin, with no scale or center-of-mass field.
 *
 * @category Types
 * @since 1.0.0
 */
export interface RigidTransform extends Transform.Transform
{
    readonly [TypeId]: typeof TypeId;
    readonly linearVelocity: Vector3.Vector3;
    readonly angularVelocity: Vector3.Vector3;
}

/**
 * Full-precision copied pose and velocities with spatial type discriminators.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Json
{
    readonly _id: "RigidTransform";
    readonly position: Vector3.Json;
    readonly rotation: Quat.Json;
    readonly linearVelocity: Vector3.Json;
    readonly angularVelocity: Vector3.Json;
}

/**
 * Data-first and data-last operations preserving receiver order.
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
 * Direct and data-last construction from a structural pose and containing-frame velocities.
 *
 * @category Types
 * @since 1.0.0
 */
interface FromTransform
{
    (linearVelocity: Vector3.Coordinates, angularVelocity: Vector3.Coordinates):
    (self: Transform.Coordinates) => Option.Option<RigidTransform>;
    (self: Transform.Coordinates, linearVelocity: Vector3.Coordinates, angularVelocity: Vector3.Coordinates):
    Option.Option<RigidTransform>;
}

/**
 * Direct and data-last mathematical interpolation of pose and both velocities.
 *
 * @category Types
 * @since 1.0.0
 */
interface Interpolation
{
    (that: Coordinates, t: number): (self: Coordinates) => Option.Option<RigidTransform>;
    (self: Coordinates, that: Coordinates, t: number): Option.Option<RigidTransform>;
}

/**
 * Builds a two-argument dual operation preserving operand order.
 *
 * @category Internal
 * @since 1.0.0
 */
const binary = <Self, That, Value>(body: (self: Self, that: That) => Value): Binary<Self, That, Value> =>
{
    return dual(2, body);
};

/**
 * Inherits pose piping and inspection while giving moving values distinct equality, hashing and text.
 * The inherited Transform discriminator also makes this a runtime Transform.
 *
 * @category Internal
 * @since 1.0.0
 */
const Prototype = Object.freeze({
    ...Object.getPrototypeOf(Transform.Identity) as object,
    [TypeId]: TypeId,

    /**
     * Compares motion only with another moving pose of the same kind.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](this: RigidTransform, that: Equal.Equal): boolean
    {
        return isRigidTransform(that) && equals(this, that);
    },

    /**
     * Combines exact position/velocity and canonical orientation hashes with the motion discriminator.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: RigidTransform): number
    {
        return Hash.combine(Hash.string(TypeId))(
            Hash.array([ this.position, this.rotation, this.linearVelocity, this.angularVelocity ]));
    },

    /**
     * Retains all stored component precision, including unsafe motion representations.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: RigidTransform): Json
    {
        return Object.freeze({ _id: "RigidTransform",
            angularVelocity: this.angularVelocity.toJSON() as Vector3.Json,
            linearVelocity: this.linearVelocity.toJSON() as Vector3.Json,
            position: this.position.toJSON() as Vector3.Json,
            rotation: this.rotation.toJSON() as Quat.Json });
    },

    /**
     * Emits full-precision pose, linear velocity and angular velocity text.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: RigidTransform): string
    {
        return format(this);
    }
});

/**
 * Recognizes enriched moving poses, including unsafe values.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isRigidTransform = (input: unknown): input is RigidTransform =>
{
    return typeof input === "object" && input !== null && TypeId in input && input[TypeId] === TypeId;
};

/**
 * Deep-copies and freezes raw pose and motion without normalization, validation or derived calculations.
 * Caller-owned inputs are neither mutated nor frozen.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const RigidTransformUnsafe = (position: Vector3.Coordinates, rotation: Quat.Coordinates,
    linearVelocity: Vector3.Coordinates, angularVelocity: Vector3.Coordinates): RigidTransform =>
{
    return Object.freeze(Object.assign(Object.create(Prototype) as RigidTransform,
        Transform.TransformUnsafe(position, rotation), {
            angularVelocity: Vector3.Vector3Unsafe(angularVelocity.x, angularVelocity.y, angularVelocity.z),
            linearVelocity: Vector3.Vector3Unsafe(linearVelocity.x, linearVelocity.y, linearVelocity.z)
        }));
};

/**
 * Validates finite position/velocities and stably normalizes a finite nonzero orientation.
 * Linear velocity belongs to the origin in blocks/second; angular velocity is in radians/second.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const RigidTransform = (
    position: Vector3.Coordinates,
    rotation: Quat.Coordinates,
    linearVelocity: Vector3.Coordinates,
    angularVelocity: Vector3.Coordinates
): Option.Option<RigidTransform> =>
{
    return Vector3.isFinite(linearVelocity) && Vector3.isFinite(angularVelocity)
        ? Option.map(Transform.Transform(position, rotation), (pose: Transform.Transform) =>
            RigidTransformUnsafe(pose.position, pose.rotation,
                linearVelocity, angularVelocity)) : Option.none();
};

/**
 * Adds explicitly origin-based velocities to a pose, returning a validated copied moving value.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromTransform: FromTransform = dual(3, (
    self: Transform.Coordinates,
    linearVelocity: Vector3.Coordinates,
    angularVelocity: Vector3.Coordinates
) => RigidTransform(self.position, self.rotation, linearVelocity, angularVelocity));

/**
 * Checks the full mathematical domain, allowing non-unit finite nonzero unsafe orientations.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isValid = (self: Coordinates): boolean =>
{
    return (
        Transform.isValid(self) &&
        Vector3.isFinite(self.linearVelocity) &&
        Vector3.isFinite(self.angularVelocity)
    );
};

/**
 * Extracts a validated copied pose, normalizing orientation; invalid motion yields None.
 * This does not integrate or extrapolate the pose using its velocities.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toTransform = (self: Coordinates): Option.Option<Transform.Transform> =>
{
    return isValid(self) ? Transform.Transform(self.position, self.rotation) : Option.none();
};

/**
 * Compares exact stored position/velocities and canonical orientation, including invalid fallbacks.
 *
 * @category Equivalence
 * @since 1.0.0
 */
export const equals: Binary<Coordinates, Coordinates, boolean> = binary(
    (self: Coordinates, that: Coordinates) => Transform.equals(self, that) &&
        Vector3.equals(self.linearVelocity, that.linearVelocity) &&
        Vector3.equals(self.angularVelocity, that.angularVelocity));

/**
 * Computes containing-frame velocity at a containing-frame point:
 * linearVelocity + cross(angularVelocity, point-position). Evaluating at COM yields COM velocity;
 * constructing from COM requires vOrigin=vCOM+cross(angularVelocity,origin-COM) explicitly.
 * Invalid input or unrepresentable intermediate/output coordinates yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const velocityAtPoint: Binary<
    Coordinates,
    Vector3.Coordinates,
    Option.Option<Vector3.Vector3>
> = binary(
    (self: Coordinates, that: Vector3.Coordinates): Option.Option<Vector3.Vector3> =>
    {
        if (!isValid(self) || !Vector3.isFinite(that))
        {
            return Option.none();
        }

        const Offset = Vector3.subtract(that, self.position);
        const Result = Vector3.add(self.linearVelocity, Vector3.cross(self.angularVelocity, Offset));
        return Vector3.Vector3(Result.x, Result.y, Result.z);
    }
);

/**
 * Applies that before self, including rotating-frame transport. With r=rotate(self.rotation,
 * that.position), linear velocity is self.v+cross(self.omega,r)+rotate(self.rotation,that.v),
 * and angular velocity is self.omega+rotate(self.rotation,that.omega).
 * Invalid input or unrepresentable intermediate/output coordinates yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const compose: Binary<Coordinates, Coordinates, Option.Option<RigidTransform>> = binary(
    (self: Coordinates, that: Coordinates): Option.Option<RigidTransform> =>
    {
        if (!isValid(self) || !isValid(that))
        {
            return Option.none();
        }

        const Pose = Transform.compose(self, that);
        const R = Quat.rotateVector(self.rotation, that.position);
        const Linear = Quat.rotateVector(self.rotation, that.linearVelocity);
        const Angular = Quat.rotateVector(self.rotation, that.angularVelocity);
        if (Option.isNone(Pose) || Option.isNone(R) || Option.isNone(Linear) || Option.isNone(Angular))
        {
            return Option.none();
        }

        const Velocity = Vector3.add(Vector3.add(self.linearVelocity,
            Vector3.cross(self.angularVelocity, R.value)), Linear.value);
        return RigidTransform(Pose.value.position, Pose.value.rotation, Velocity,
            Vector3.add(self.angularVelocity, Angular.value));
    });

/**
 * Inverts pose and motion consistently: omega'=-rotate(R^-1,omega) and
 * v'=rotate(R^-1,cross(omega,position)-v). Invalid/unrepresentable values yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const inverse = (self: Coordinates): Option.Option<RigidTransform> =>
{
    if (!isValid(self))
    {
        return Option.none();
    }

    const Pose = Transform.inverse(self);
    if (Option.isNone(Pose))
    {
        return Option.none();
    }

    const Linear = Quat.rotateVector(Pose.value.rotation,
        Vector3.subtract(Vector3.cross(self.angularVelocity, self.position), self.linearVelocity));
    const Angular = Quat.rotateVector(Pose.value.rotation, Vector3.scale(self.angularVelocity, -1));
    return Option.isSome(Linear) && Option.isSome(Angular)
        ? RigidTransform(Pose.value.position, Pose.value.rotation,
            Linear.value, Angular.value) : Option.none();
};

/**
 * Interpolates one containing-frame velocity component-wise with stable scalar lerp.
 *
 * @category Internal
 * @since 1.0.0
 */
const linear = (self: Vector3.Coordinates, that: Vector3.Coordinates, t: number): Vector3.Vector3 =>
{
    return Vector3.Vector3Unsafe(interpolateComponent(self.x, that.x, t),
        interpolateComponent(self.y, that.y, t), interpolateComponent(self.z, that.z, t));
};

/**
 * Uses Transform pose interpolation and component-wise lerp for both containing-frame velocities.
 * Finite t permits extrapolation; this is mathematical interpolation, not a dynamics integrator.
 * Invalid endpoints/parameters or unrepresentable output yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const interpolate: Interpolation = dual(3,
    (self: Coordinates, that: Coordinates, t: number): Option.Option<RigidTransform> =>
    {
        if (!isValid(self) || !isValid(that) || !Number.Number.isFinite(t))
        {
            return Option.none();
        }

        return Option.flatMap(Transform.interpolate(self, that, t), (pose: Transform.Transform) =>
            RigidTransform(pose.position, pose.rotation, linear(self.linearVelocity, that.linearVelocity, t),
                linear(self.angularVelocity, that.angularVelocity, t)));
    });

/**
 * Aliases mathematical pose and motion interpolation.
 *
 * @category Operation
 * @since 1.0.0
 */
export const lerp = interpolate;

/**
 * Formats stored position xyz, rotation xyzw, linear velocity xyz and angular velocity xyz.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const format = (self: Coordinates): string =>
{
    return `RigidTransform(${formatComponents([ self.position.x, self.position.y, self.position.z,
        self.rotation.x, self.rotation.y, self.rotation.z, self.rotation.w,
        self.linearVelocity.x, self.linearVelocity.y, self.linearVelocity.z,
        self.angularVelocity.x, self.angularVelocity.y, self.angularVelocity.z ])})`;
};

/**
 * Aliases full-precision default formatting.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const toString = format;

/**
 * Parses default finite text, preserving raw orientation magnitude. Invalid motion or zero
 * orientation yields None; the validating constructor separately normalizes orientation.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const fromString = (self: string): Option.Option<RigidTransform> =>
{
    const Match = /^RigidTransform\((.*)\)$/.exec(self.trim());
    return Match === null ? Option.none() : Option.flatMap(parseComponents(Match[1], 13),
        (values: ReadonlyArray<number>): Option.Option<RigidTransform> =>
        {
            const Value = RigidTransformUnsafe(Vector3.Vector3Unsafe(values[0], values[1], values[2]),
                Quat.QuatUnsafe(values[3], values[4], values[5], values[6]),
                Vector3.Vector3Unsafe(values[7], values[8], values[9]),
                Vector3.Vector3Unsafe(values[10], values[11], values[12]));
            return isValid(Value) ? Option.some(Value) : Option.none();
        });
};

/**
 * Aliases strict default motion text parsing.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const parse = fromString;

/**
 * Zero position, identity orientation and zero linear/angular velocities.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Identity: RigidTransform = RigidTransformUnsafe(
    Vector3.Zero,
    Quat.Identity,
    Vector3.Zero,
    Vector3.Zero
);
