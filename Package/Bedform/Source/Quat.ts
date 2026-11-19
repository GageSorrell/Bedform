/**
 * Immutable quaternion algebra, conversions, and canonical protocols.
 *
 * @module bedform/Quat
 *
 * @file      Quat.ts
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
import * as Inspectable from "@bedform/effect/Inspectable";
import * as N from "@bedform/effect/Number";
import * as Option from "@bedform/effect/Option";
import * as Order from "@bedform/effect/Order";
import * as Pipeable from "@bedform/effect/Pipeable";
import type * as R from "./Rotator.js";
import * as V3 from "./Vector3.js";
import { anglesToQuat,
    compareNumbers,
    compareNumericKeys,
    quaternionToAngles,
    rotationKey,
    rotationSign
} from "./Internal/Rotation.js";
import { formatComponents, normalizeComponents, parseComponents } from "./Internal/Vector.js";
import { dual } from "@bedform/effect/Function";
import { makeRotator } from "./Internal/Rotator.js";

/**
 * Private enriched-Quat discriminator.
 *
 * @category Operation
 * @since 1.0.0
 */
const TypeId = "~bedform/Quat" as const;

/**
 * A half turn in radians.
 *
 * @category Operation
 * @since 1.0.0
 */
const Pi = N.acos(-1);

/**
 * Absolute orthonormal and homogeneous matrix tolerance, 1e-10.
 *
 * @category Operation
 * @since 1.0.0
 */
const MatrixTolerance = 1e-10;

/**
 * Plain readonly quaternion components; raw algebra retains magnitude and sign.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Coordinates
{
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
}

/**
 * A frozen Hamilton quaternion whose protocols compare canonical orientations.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Quat extends Coordinates, Equal.Equal, Pipeable.Pipeable, Inspectable.Inspectable
{
    readonly [TypeId]: typeof TypeId;
}

/**
 * Full-precision stored components with a Quat discriminator.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Json extends Coordinates
{
    readonly _id: "Quat";
}

/**
 * A stable normalized orientation rounded to twelve decimals with deterministic sign.
 *
 * @category Model
 * @since 1.0.0
 */
export type CanonicalKey = readonly [x: number, y: number, z: number, w: number];

/**
 * A row-major homogeneous 4x4 rotation matrix acting on column vectors.
 *
 * @category Model
 * @since 1.0.0
 */
export type Matrix4 = readonly [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
    number, number, number, number
];

/**
 * A principal axis-angle pair in radians; identity uses positive X.
 *
 * @category Model
 * @since 1.0.0
 */
export interface AxisAngle
{
    readonly axis: V3.Vector3;
    readonly angle: number;
}

/**
 * Rotated positive coordinate axes, distinct from facing-relative right and left.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Axes
{
    readonly x: V3.Vector3;
    readonly y: V3.Vector3;
    readonly z: V3.Vector3;
}

/**
 * Data-first and data-last signatures preserving receiver order.
 *
 * @category Model
 * @since 1.0.0
 */
interface Binary<Self, That, Value>
{
    (that: That): (self: Self) => Value;
    (self: Self, that: That): Value;
}

/**
 * Direct and curried finite nonnegative tolerance checks.
 *
 * @category Model
 * @since 1.0.0
 */
interface Tolerance
{
    (tolerance?: number): (self: Coordinates) => boolean;
    (self: Coordinates, tolerance?: number): boolean;
}

/**
 * Builds a two-argument dual operation without changing receiver order.
 *
 * @category Operation
 * @since 1.0.0
 */
const binary = <Self, That, Value>(body: (self: Self, that: That) => Value): Binary<Self, That, Value> =>
{
    return dual(2, body);
};

/**
 * Frozen shared equality, hashing, piping and inspection.
 *
 * @category Operation
 * @since 1.0.0
 */
const Prototype = Object.freeze({
    ...Pipeable.Prototype,
    ...Inspectable.BaseProto,
    [TypeId]: TypeId,

    /**
     * Compares canonical orientations within this enriched kind.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](this: Quat, that: Equal.Equal): boolean
    {
        return isQuat(that) && equals(this, that);
    },

    /**
     * Hashes canonical valid keys or distinct invalid raw fallbacks.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: Quat): number
    {
        const Key = canonicalKey(this);
        return Hash.combine(Hash.string(TypeId))(Hash.array(Option.isSome(Key)
            ? [ 0, ...Key.value ] : [ 1, this.x, this.y, this.z, this.w ]));
    },

    /**
     * Retains raw signs and component precision for JSON.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: Quat): Json
    {
        return Object.freeze({ _id: "Quat",
            w: this.w,
            x: this.x,
            y: this.y,
            z: this.z });
    },

    /**
     * Delegates raw component formatting to the shared Effect-based formatter.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: Quat): string
    {
        return format(this);
    }
});

/**
 * Reads raw x/y/z/w components in order.
 *
 * @category Operation
 * @since 1.0.0
 */
const components = (self: Coordinates): CanonicalKey =>
{
    return [ self.x, self.y, self.z, self.w ];
};

/**
 * Chooses positive w, then the first nonzero x/y/z at a half turn.
 *
 * @category Operation
 * @since 1.0.0
 */
const sign = (key: ReadonlyArray<number>): number =>
{
    return rotationSign(key);
};

/**
 * Normalizes stably, rounds to twelve decimals, reapplies sign selection and collapses signed zero.
 * Invalid or zero rotations yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const canonicalKey = (self: Coordinates): Option.Option<CanonicalKey> =>
{
    return rotationKey(components(self));
};

/**
 * Orders negative infinity, finite values, positive infinity and NaN with signed-zero agreement.
 *
 * @category Operation
 * @since 1.0.0
 */
const numberOrder = (self: number, that: number): -1 | 0 | 1 =>
{
    return compareNumbers(self, that);
};

/**
 * Compares numeric component keys lexicographically.
 *
 * @category Operation
 * @since 1.0.0
 */
const compareKeys = (self: ReadonlyArray<number>, that: ReadonlyArray<number>): -1 | 0 | 1 =>
{
    return compareNumericKeys(self, that);
};

/**
 * Orders valid canonical rotations before invalid raw fallbacks.
 *
 * @category Operation
 * @since 1.0.0
 */
const compare = (self: Coordinates, that: Coordinates): -1 | 0 | 1 =>
{
    const A = canonicalKey(self);
    const B = canonicalKey(that);
    if (Option.isSome(A) && Option.isSome(B))
    {
        return compareKeys(A.value, B.value);
    }

    if (Option.isSome(A))
    {
        return -1;
    }

    if (Option.isSome(B))
    {
        return 1;
    }

    return compareKeys(components(self), components(that));
};

/**
 * Checks the enriched Quat discriminator, including invalid unsafe values.
 *
 * @category Operation
 * @since 1.0.0
 */
export const isQuat = (input: unknown): input is Quat =>
{
    return typeof input === "object" && input !== null && TypeId in input && input[TypeId] === TypeId;
};

/**
 * Copies and freezes raw components without validation or normalization.
 *
 * @category Operation
 * @since 1.0.0
 */
export const QuatUnsafe = (x: number, y: number, z: number, w: number): Quat =>
{
    const Value = Object.create(Prototype) as { -readonly [Key in keyof Quat]: Quat[Key] };
    Value.w = w;
    Value.x = x;
    Value.y = y;
    Value.z = z;
    return Object.freeze(Value);
};

/**
 * Constructs a finite nonzero quaternion while preserving raw components.
 *
 * @category Operation
 * @since 1.0.0
 */
export const Quat = (x: number, y: number, z: number, w: number): Option.Option<Quat> =>
{
    return [ x, y, z, w ].every(N.Number.isFinite) && (x !== 0 || y !== 0 || z !== 0 || w !== 0)
        ? Option.some(QuatUnsafe(x, y, z, w)) : Option.none();
};

/**
 * Checks component finiteness without requiring nonzero length.
 *
 * @category Operation
 * @since 1.0.0
 */
export const isFinite = (self: Coordinates): boolean =>
{
    return components(self).every(N.Number.isFinite);
};

/**
 * Normalizes huge or tiny finite components stably; zero/non-finite input yields `None`.
 *
 * @category Operation
 * @since 1.0.0
 */
export const normalize = (self: Coordinates): Option.Option<Quat> =>
{
    return Option.map(normalizeComponents(components(self)), (key: ReadonlyArray<number>) =>
        QuatUnsafe(key[0], key[1], key[2], key[3]));
};

/**
 * Computes stable raw magnitude using Number hypot helpers.
 *
 * @category Operation
 * @since 1.0.0
 */
export const magnitude = (self: Coordinates): number =>
{
    return N.hypot(N.hypot(self.x, self.y), N.hypot(self.z, self.w));
};

/**
 * Computes raw squared magnitude, including numeric overflow and underflow.
 *
 * @category Operation
 * @since 1.0.0
 */
export const magnitudeSquared = (self: Coordinates): number =>
{
    return dot(self, self);
};

/**
 * Adds raw components without normalizing.
 *
 * @category Operation
 * @since 1.0.0
 */
export const add: Binary<Coordinates,
    Coordinates,
    Quat> = binary((self: Coordinates,
    that: Coordinates) =>
    QuatUnsafe(self.x + that.x, self.y + that.y, self.z + that.z, self.w + that.w));

/**
 * Subtracts raw components in self-minus-that order.
 *
 * @category Operation
 * @since 1.0.0
 */
export const subtract: Binary<Coordinates,
    Coordinates,
    Quat> = binary((self: Coordinates,
    that: Coordinates) =>
    QuatUnsafe(self.x - that.x, self.y - that.y, self.z - that.z, self.w - that.w));

/**
 * Scales raw components, preserving magnitude and path sign.
 *
 * @category Operation
 * @since 1.0.0
 */
export const scale: Binary<Coordinates, number, Quat> = binary((self: Coordinates, that: number) =>
    QuatUnsafe(self.x * that, self.y * that, self.z * that, self.w * that));

/**
 * Divides raw components with native arithmetic, including zero and nonfinite divisors.
 *
 * @category Operation
 * @since 1.0.0
 */
export const divide: Binary<Coordinates, number, Quat> = binary((self: Coordinates, that: number) =>
    QuatUnsafe(self.x / that, self.y / that, self.z / that, self.w / that));

/**
 * Computes the raw four-component dot product.
 *
 * @category Operation
 * @since 1.0.0
 */
export const dot: Binary<Coordinates, Coordinates, number> = binary((self: Coordinates, that: Coordinates) =>
    self.x * that.x + self.y * that.y + self.z * that.z + self.w * that.w);

/**
 * Multiplies Hamilton components without normalization; multiply(a,b) applies b before a.
 *
 * @category Operation
 * @since 1.0.0
 */
export const multiply: Binary<Coordinates,
    Coordinates,
    Quat> = binary((self: Coordinates,
    that: Coordinates) =>
    QuatUnsafe(
        self.w * that.x + self.x * that.w + self.y * that.z - self.z * that.y,
        self.w * that.y - self.x * that.z + self.y * that.w + self.z * that.x,
        self.w * that.z + self.x * that.y - self.y * that.x + self.z * that.w,
        self.w * that.w - self.x * that.x - self.y * that.y - self.z * that.z));

/**
 * Negates the raw imaginary components and preserves w.
 *
 * @category Operation
 * @since 1.0.0
 */
export const conjugate = (self: Coordinates): Quat =>
{
    return QuatUnsafe(N.negate(self.x), N.negate(self.y), N.negate(self.z), self.w);
};

/**
 * Reverses the raw path sign without changing the represented orientation.
 *
 * @category Operation
 * @since 1.0.0
 */
export const negate = (self: Coordinates): Quat =>
{
    return scale(self, -1);
};

/**
 * Computes a stable algebraic inverse; invalid or unrepresentable results yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const inverse = (self: Coordinates): Option.Option<Quat> =>
{
    if (!isFinite(self))
    {
        return Option.none();
    }

    const Maximum = components(self).reduce((total: number, value: number) => N.max(total, N.abs(value)), 0);
    if (Maximum === 0)
    {
        return Option.none();
    }

    const Scaled = divide(self, Maximum);
    const Denominator = magnitudeSquared(Scaled);
    return Quat((-Scaled.x / Denominator) / Maximum, (-Scaled.y / Denominator) / Maximum,
        (-Scaled.z / Denominator) / Maximum, (Scaled.w / Denominator) / Maximum);
};

/**
 * Compares raw components exactly with Effect NaN and signed-zero semantics.
 *
 * @category Operation
 * @since 1.0.0
 */
export const equalsComponents: Binary<Coordinates,
    Coordinates,
    boolean> = binary((self: Coordinates,
    that: Coordinates) =>
    components(self).every((value: number, index: number) => Equal.equals(value, components(that)[index])));

/**
 * Hashes raw components independently of canonical orientation hashing.
 *
 * @category Operation
 * @since 1.0.0
 */
export const hashComponents = (self: Coordinates): number =>
{
    return Hash.combine(Hash.string(TypeId))(Hash.array(components(self)));
};

/**
 * Compares canonical orientations, with reflexive raw fallbacks for invalid values.
 *
 * @category Operation
 * @since 1.0.0
 */
export const equals: Binary<Coordinates,
    Coordinates,
    boolean> = binary((self: Coordinates,
    that: Coordinates) =>
    compare(self, that) === 0);

/**
 * Measures shortest angular distance between unit rotations without acos cancellation.
 *
 * @category Operation
 * @since 1.0.0
 */
const unitDistance = (self: Coordinates, that: Coordinates): number =>
{
    const B = dot(self, that) < 0 ? negate(that) : that;
    return 4 * N.atan2(magnitude(subtract(self, B)), magnitude(add(self, B)));
};

/**
 * Measures shortest angular distance in radians after stable normalization.
 *
 * @category Operation
 * @since 1.0.0
 */
export const angularDistance: Binary<Coordinates,
    Coordinates,
    Option.Option<number>> = binary((self: Coordinates,
    that: Coordinates) =>
{
    const A = normalize(self);
    const B = normalize(that);
    return Option.isSome(A) && Option.isSome(B) ? Option.some(unitDistance(A.value, B.value)) : Option.none();
});

/**
 * Measures normalized dot error, 1 minus absolute unit dot product, in [0,1].
 *
 * @category Operation
 * @since 1.0.0
 */
export const error: Binary<Coordinates,
    Coordinates,
    Option.Option<number>> = binary((self: Coordinates,
    that: Coordinates) =>
{
    const A = normalize(self);
    const B = normalize(that);
    return Option.isSome(A) && Option.isSome(B)
        ? Option.some(1 - N.clamp(N.abs(dot(A.value, B.value)), { maximum: 1,
            minimum: 0 })) : Option.none();
});

/**
 * Measures angular distance divided by pi, in [0,1].
 *
 * @category Operation
 * @since 1.0.0
 */
export const errorAngle: Binary<Coordinates,
    Coordinates,
    Option.Option<number>> = binary((self: Coordinates,
    that: Coordinates) =>
    Option.map(angularDistance(self, that), (value: number) => value / Pi));

/**
 * Compares angular distance with an explicit tolerance in radians; protocol equality is unchanged.
 *
 * @category Operation
 * @since 1.0.0
 */
export const equalsApprox: {
    (that: Coordinates, tolerance: number): (self: Coordinates) => Option.Option<boolean>;
    (self: Coordinates, that: Coordinates, tolerance: number): Option.Option<boolean>;
} = dual(3, (self: Coordinates, that: Coordinates, tolerance: number): Option.Option<boolean> =>
    !N.Number.isFinite(tolerance) || tolerance < 0 ? Option.none() :
        Option.map(angularDistance(self, that), (value: number) => value <= tolerance));

/**
 * Checks raw unit length with a finite nonnegative absolute tolerance, default 1e-12.
 *
 * @category Operation
 * @since 1.0.0
 */
export const isNormalized: Tolerance = dual(
    (args: IArguments) => typeof args[0] === "object" && args[0] !== null,
    (self: Coordinates,
        tolerance: number = 1e-12): boolean => N.Number.isFinite(tolerance) && tolerance >= 0 &&
        isFinite(self) && N.abs(magnitude(self) - 1) <= tolerance);

/**
 * Checks identity orientation with a finite nonnegative angular tolerance, default 1e-12.
 *
 * @category Operation
 * @since 1.0.0
 */
export const isIdentity: Tolerance = dual(
    (args: IArguments) => typeof args[0] === "object" && args[0] !== null,
    (self: Coordinates,
        tolerance: number = 1e-12): boolean => N.Number.isFinite(tolerance) && tolerance >= 0 &&
        Option.getOrElse(Option.map(angularDistance(self,
            Identity),
        (value: number) => value <= tolerance),
        () => false));

/**
 * Aligns self with a reference by sign selection, retaining raw magnitude and precision.
 *
 * @category Operation
 * @since 1.0.0
 */
export const alignShortestArc: Binary<Coordinates,
    Coordinates,
    Option.Option<Quat>> = binary((self: Coordinates,
    that: Coordinates) =>
{
    const A = normalize(self);
    const B = normalize(that);
    if (Option.isNone(A) || Option.isNone(B))
    {
        return Option.none();
    }

    return Option.some(dot(A.value,
        B.value) < 0 ? negate(self) : QuatUnsafe(self.x,
            self.y,
            self.z,
            self.w));
});

/**
 * Extracts a principal [0,pi] axis-angle pair; identity deterministically uses positive X.
 *
 * @category Operation
 * @since 1.0.0
 */
export const toAxisAngle = (self: Coordinates): Option.Option<AxisAngle> =>
{
    const Unit = normalize(self);
    if (Option.isNone(Unit))
    {
        return Option.none();
    }

    const Sign = sign(components(Unit.value));
    const Vector = V3.Vector3Unsafe(Unit.value.x * Sign, Unit.value.y * Sign, Unit.value.z * Sign);
    const Sine = V3.magnitude(Vector);
    const Axis = Sine === 0 ? V3.UnitX : Option.getOrElse(V3.normalize(Vector), () => V3.UnitX);
    return Option.some(Object.freeze({ angle: 2 * N.atan2(Sine, Unit.value.w * Sign),
        axis: Axis }));
};

/**
 * Constructs from a finite nonzero axis and angle in radians.
 *
 * @category Operation
 * @since 1.0.0
 */
export const fromAxisAngle: Binary<V3.Coordinates,
    number,
    Option.Option<Quat>> = binary((self: V3.Coordinates,
    that: number) =>
{
    const Axis = V3.normalize(self);
    if (Option.isNone(Axis) || !N.Number.isFinite(that))
    {
        return Option.none();
    }

    const Sine = N.sin(that / 2);
    return Quat(Axis.value.x * Sine, Axis.value.y * Sine, Axis.value.z * Sine, N.cos(that / 2));
});

/**
 * Extracts the principal axis-times-angle vector in radians; identity maps to zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const toRotationVector = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return Option.map(toAxisAngle(self), (value: AxisAngle) => V3.scale(value.axis, value.angle));
};

/**
 * Constructs from a finite rotation vector in radians; zero means identity.
 *
 * @category Operation
 * @since 1.0.0
 */
export const fromRotationVector = (self: V3.Coordinates): Option.Option<Quat> =>
{
    if (!V3.isFinite(self))
    {
        return Option.none();
    }

    const Angle = V3.magnitude(self);
    return Angle === 0 ? Option.some(Identity) : fromAxisAngle(self, Angle);
};

/**
 * Chooses a least-aligned positive-axis projection for deterministic antiparallel alignment.
 *
 * @category Operation
 * @since 1.0.0
 */
const perpendicularAxis = (self: V3.Coordinates): V3.Vector3 =>
{
    const Values = [ self.x, self.y, self.z ];
    let Index = 0;
    for (let index = 1; index < 3; index++)
    {
        if (N.abs(Values[index]) < N.abs(Values[Index]))
        {
            Index = index;
        }
    }

    const Axis = Index === 0 ? V3.UnitX : Index === 1 ? V3.UnitY : V3.UnitZ;
    return Option.getOrElse(V3.normalize(V3.subtract(Axis,
        V3.scale(self,
            V3.dot(self,
                Axis)))),
    () => V3.UnitX);
};

/**
 * Finds the shortest rotation between nonzero finite vectors with stable antiparallel handling.
 *
 * @category Operation
 * @since 1.0.0
 */
export const fromVectors: Binary<V3.Coordinates,
    V3.Coordinates,
    Option.Option<Quat>> = binary((self: V3.Coordinates,
    that: V3.Coordinates) =>
{
    const A = V3.normalize(self);
    const B = V3.normalize(that);
    if (Option.isNone(A) || Option.isNone(B))
    {
        return Option.none();
    }

    const Cross = V3.cross(A.value, B.value);
    const Sine = V3.magnitude(Cross);
    const Dot = N.clamp(V3.dot(A.value, B.value), { maximum: 1,
        minimum: -1 });
    if (Sine === 0)
    {
        const Axis = perpendicularAxis(A.value);
        return Option.some(Dot >= 0 ? Identity : QuatUnsafe(Axis.x, Axis.y, Axis.z, 0));
    }

    return fromAxisAngle(Cross, N.atan2(Sine, Dot));
});

/**
 * Finds shortest rotation only when both finite normals have unit length within 1e-12.
 *
 * @category Operation
 * @since 1.0.0
 */
export const fromUnitNormals: Binary<V3.Coordinates,
    V3.Coordinates,
    Option.Option<Quat>> = binary((self: V3.Coordinates,
    that: V3.Coordinates) =>
    V3.isFinite(self) && V3.isFinite(that) &&
    N.abs(V3.magnitude(self) - 1) <= 1e-12 && N.abs(V3.magnitude(that) - 1) <= 1e-12
        ? fromVectors(self, that) : Option.none());

/**
 * Rotates a finite vector with normalized orientation and scaled intermediate arithmetic.
 *
 * @category Operation
 * @since 1.0.0
 */
export const rotateVector: Binary<Coordinates,
    V3.Coordinates,
    Option.Option<V3.Vector3>> = binary((self: Coordinates,
    that: V3.Coordinates) =>
{
    const Unit = normalize(self);
    if (Option.isNone(Unit) || !V3.isFinite(that))
    {
        return Option.none();
    }

    const Maximum = N.max(N.max(N.abs(that.x), N.abs(that.y)), N.abs(that.z));
    if (Maximum === 0)
    {
        return Option.some(V3.Zero);
    }

    const Vector = V3.Vector3Unsafe(that.x / Maximum, that.y / Maximum, that.z / Maximum);
    const Imaginary = V3.Vector3Unsafe(Unit.value.x, Unit.value.y, Unit.value.z);
    const TwiceCross = V3.scale(V3.cross(Imaginary, Vector), 2);
    const Rotated = V3.add(Vector,
        V3.add(V3.scale(TwiceCross,
            Unit.value.w),
        V3.cross(Imaginary,
            TwiceCross)));
    return V3.Vector3(Rotated.x * Maximum, Rotated.y * Maximum, Rotated.z * Maximum);
});

/**
 * Applies the inverse normalized orientation to a finite vector.
 *
 * @category Operation
 * @since 1.0.0
 */
export const unrotateVector: Binary<Coordinates,
    V3.Coordinates,
    Option.Option<V3.Vector3>> = binary((self: Coordinates,
    that: V3.Coordinates) =>
    rotateVector(conjugate(self), that));

/**
 * Extracts the rotated positive X axis.
 *
 * @category Operation
 * @since 1.0.0
 */
export const axisX = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return rotateVector(self, V3.UnitX);
};

/**
 * Extracts the rotated positive Y axis.
 *
 * @category Operation
 * @since 1.0.0
 */
export const axisY = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return rotateVector(self, V3.UnitY);
};

/**
 * Extracts the rotated positive Z axis.
 *
 * @category Operation
 * @since 1.0.0
 */
export const axisZ = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return rotateVector(self, V3.UnitZ);
};

/**
 * Extracts facing-forward from neutral +Z.
 *
 * @category Operation
 * @since 1.0.0
 */
export const forward = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return rotateVector(self, V3.Forward);
};

/**
 * Extracts facing-up from neutral +Y.
 *
 * @category Operation
 * @since 1.0.0
 */
export const up = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return rotateVector(self, V3.Up);
};

/**
 * Extracts facing-right from neutral -X.
 *
 * @category Operation
 * @since 1.0.0
 */
export const right = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return rotateVector(self, V3.Right);
};

/**
 * Extracts all positive coordinate axes in an immutable record.
 *
 * @category Operation
 * @since 1.0.0
 */
export const axes = (self: Coordinates): Option.Option<Axes> =>
{
    const X = axisX(self);
    const Y = axisY(self);
    const Z = axisZ(self);
    return Option.isSome(X) && Option.isSome(Y) && Option.isSome(Z)
        ? Option.some(Object.freeze({ x: X.value,
            y: Y.value,
            z: Z.value })) : Option.none();
};

/**
 * Emits a frozen homogeneous row-major rotation matrix for column vectors.
 *
 * @category Operation
 * @since 1.0.0
 */
export const toMatrix = (self: Coordinates): Option.Option<Matrix4> =>
{
    const Unit = normalize(self);
    if (Option.isNone(Unit))
    {
        return Option.none();
    }

    const { x: X, y: Y, z: Z, w: W } = Unit.value;
    return Option.some(Object.freeze([
        1 - 2 * (Y * Y + Z * Z), 2 * (X * Y - Z * W), 2 * (X * Z + Y * W), 0,
        2 * (X * Y + Z * W), 1 - 2 * (X * X + Z * Z), 2 * (Y * Z - X * W), 0,
        2 * (X * Z - Y * W), 2 * (Y * Z + X * W), 1 - 2 * (X * X + Y * Y), 0,
        0, 0, 0, 1
    ] as const));
};

/**
 * Accepts a proper homogeneous rotation matrix; rejects scale, reflection and shear within 1e-10 tolerance.
 *
 * @category Operation
 * @since 1.0.0
 */
export const fromMatrix = (self: Matrix4): Option.Option<Quat> =>
{
    if (self.length !== 16 || !self.every(N.Number.isFinite) ||
        [ 3, 7, 11, 12, 13, 14 ].some((index: number) => N.abs(self[index]) > MatrixTolerance) ||
        N.abs(self[15] - 1) > MatrixTolerance)
    {
        return Option.none();
    }

    const X = V3.Vector3Unsafe(self[0], self[4], self[8]);
    const Y = V3.Vector3Unsafe(self[1], self[5], self[9]);
    const Z = V3.Vector3Unsafe(self[2], self[6], self[10]);
    if ([ X, Y, Z ].some((axis: V3.Coordinates) => N.abs(V3.magnitude(axis) - 1) > MatrixTolerance) ||
        N.abs(V3.dot(X, Y)) > MatrixTolerance || N.abs(V3.dot(X, Z)) > MatrixTolerance ||
        N.abs(V3.dot(Y, Z)) > MatrixTolerance || N.abs(V3.dot(V3.cross(X, Y), Z) - 1) > MatrixTolerance)
    {
        return Option.none();
    }

    const Trace = self[0] + self[5] + self[10];
    let Q: Quat;
    if (Trace > 0)
    {
        const S = 2 * N.sqrt(Trace + 1);
        Q = QuatUnsafe((self[9] - self[6]) / S,
            (self[2] - self[8]) / S,
            (self[4] - self[1]) / S,
            S / 4);
    }
    else if (self[0] > self[5] && self[0] > self[10])
    {
        const S = 2 * N.sqrt(1 + self[0] - self[5] - self[10]);
        Q = QuatUnsafe(S / 4,
            (self[1] + self[4]) / S,
            (self[2] + self[8]) / S,
            (self[9] - self[6]) / S);
    }
    else if (self[5] > self[10])
    {
        const S = 2 * N.sqrt(1 + self[5] - self[0] - self[10]);
        Q = QuatUnsafe((self[1] + self[4]) / S,
            S / 4,
            (self[6] + self[9]) / S,
            (self[2] - self[8]) / S);
    }
    else
    {
        const S = 2 * N.sqrt(1 + self[10] - self[0] - self[5]);
        Q = QuatUnsafe((self[2] + self[8]) / S,
            (self[6] + self[9]) / S,
            S / 4,
            (self[4] - self[1]) / S);
    }

    return normalize(Q);
};

/**
 * Formats raw full-precision components as Quat(x, y, z, w).
 *
 * @category Operation
 * @since 1.0.0
 */
export const format = (self: Coordinates): string =>
{
    return `Quat(${formatComponents(components(self))})`;
};

/**
 * Aliases full-precision default formatting.
 *
 * @category Operation
 * @since 1.0.0
 */
export const toString = format;

/**
 * Parses default finite nonzero Quat text; invalid representations yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const fromString = (self: string): Option.Option<Quat> =>
{
    const Match = /^Quat\((.*)\)$/.exec(self.trim());
    return Match === null ? Option.none() : Option.flatMap(parseComponents(Match[1], 4),
        (values: ReadonlyArray<number>) => Quat(values[0], values[1], values[2], values[3]));
};

/**
 * Aliases strict Quat text parsing.
 *
 * @category Operation
 * @since 1.0.0
 */
export const parse = fromString;

/**
 * Orders canonical distance from a reference with lexicographic ties and invalid values last.
 *
 * @category Operation
 * @since 1.0.0
 */
const angleOrder = (reference: CanonicalKey): Order.Order<Coordinates> =>
{
    const Reference = Option.getOrElse(normalize(QuatUnsafe(...reference)),
        () => QuatUnsafe(0,
            0,
            0,
            1));
    return Order.make((self: Coordinates, that: Coordinates): -1 | 0 | 1 =>
    {
        const A = canonicalKey(self);
        const B = canonicalKey(that);
        if (Option.isNone(A) || Option.isNone(B))
        {
            return compare(self, that);
        }

        const UnitA = Option.getOrElse(normalize(QuatUnsafe(...A.value)), () => Reference);
        const UnitB = Option.getOrElse(normalize(QuatUnsafe(...B.value)), () => Reference);
        const Distance = numberOrder(unitDistance(Reference, UnitA), unitDistance(Reference, UnitB));
        return Distance === 0 ? compareKeys(A.value, B.value) : Distance;
    });
};

/**
 * Creates a canonical angular-distance order; invalid references yield None.
 *
 * @category Ordering
 * @since 1.0.0
 */
export const orderByAngleDistance = (reference: Coordinates): Option.Option<Order.Order<Coordinates>> =>
{
    return Option.map(canonicalKey(reference), (key: CanonicalKey) => angleOrder(key));
};

/**
 * The immutable neutral orientation.
 *
 * @category Operation
 * @since 1.0.0
 */
export const Identity: Quat = QuatUnsafe(0, 0, 0, 1);

/**
 * Orders canonical x/y/z/w, followed by invalid raw numeric fallbacks.
 *
 * @category Ordering
 * @since 1.0.0
 */
export const OrderLexicographic: Order.Order<Coordinates> = Order.make(compare);

/**
 * Orders distance from identity using canonical keys and lexicographic ties.
 *
 * @category Ordering
 * @since 1.0.0
 */
export const OrderAngleDistance: Order.Order<Coordinates> = angleOrder([ 0, 0, 0, 1 ]);

/**
 * Data-first or curried quaternion sampling with an unclamped finite parameter.
 *
 * @category Model
 * @since 1.0.0
 */
interface Interpolation
{
    (that: Coordinates, t: number): (self: Coordinates) => Option.Option<Quat>;
    (self: Coordinates, that: Coordinates, t: number): Option.Option<Quat>;
}

/**
 * Row-major q00/q10/q01/q11 bilinear sampling with u horizontal and v vertical.
 *
 * @category Model
 * @since 1.0.0
 */
interface Bilerp
{
    (q10: Coordinates, q01: Coordinates, q11: Coordinates, u: number, v: number):
    (self: Coordinates) => Option.Option<Quat>;
    (self: Coordinates, q10: Coordinates, q01: Coordinates, q11: Coordinates, u: number, v: number):
    Option.Option<Quat>;
}

/**
 * Squad sampling ordered as start, start tangent, end, end tangent, t.
 *
 * @category Model
 * @since 1.0.0
 */
interface Squad
{
    (startTangent: Coordinates, that: Coordinates, endTangent: Coordinates, t: number):
    (self: Coordinates) => Option.Option<Quat>;
    (self: Coordinates, startTangent: Coordinates, that: Coordinates, endTangent: Coordinates, t: number):
    Option.Option<Quat>;
}

/**
 * Current-key tangent with previous/next controls and optional finite tension.
 *
 * @category Model
 * @since 1.0.0
 */
interface Tangent
{
    (previous: Coordinates,
        next: Coordinates,
        tension?: number): (self: Coordinates) => Option.Option<Quat>;
    (self: Coordinates,
        previous: Coordinates,
        next: Coordinates,
        tension?: number): Option.Option<Quat>;
}

/**
 * Normalized signed endpoints and their stable four-dimensional great-circle frame.
 *
 * @category Model
 * @since 1.0.0
 */
interface SphericalFrame
{
    readonly start: Quat;
    readonly end: Quat;
    readonly tangent: Quat;
    readonly angle: number;
    readonly sine: number;
    readonly endSign: number;
}

/**
 * A raw-magnitude swing and unit twist whose Hamilton product reconstructs the input.
 *
 * @category Model
 * @since 1.0.0
 */
export interface SwingTwist
{
    readonly swing: Quat;
    readonly twist: Quat;
}

/**
 * Copies finite raw components, permitting a zero unnormalized interpolation result.
 *
 * @category Internal
 * @since 1.0.0
 */
const finiteComponents = (values: ReadonlyArray<number>): Option.Option<Quat> =>
{
    return values.every(N.Number.isFinite)
        ? Option.some(QuatUnsafe(values[0], values[1], values[2], values[3])) : Option.none();
};

/**
 * Copies raw components into a fresh frozen quaternion.
 *
 * @category Internal
 * @since 1.0.0
 */
const copy = (self: Coordinates): Quat =>
{
    return QuatUnsafe(self.x, self.y, self.z, self.w);
};

/**
 * Interpolates components with Number lerp and stable overflow/cancellation fallbacks.
 *
 * @category Internal
 * @since 1.0.0
 */
const linearRaw = (self: Coordinates, that: Coordinates, t: number): Option.Option<Quat> =>
{
    if (t === 0)
    {
        return Option.some(copy(self));
    }

    if (t === 1)
    {
        return Option.some(copy(that));
    }

    const A = components(self);
    const B = components(that);
    return finiteComponents(A.map((value: number, index: number): number =>
    {
        const Direct = N.lerp(value, B[index], t);
        if (N.Number.isFinite(Direct))
        {
            return Direct;
        }

        const Weighted = value * (1 - t) + B[index] * t;
        if (N.Number.isFinite(Weighted))
        {
            return Weighted;
        }

        const Maximum = N.max(N.abs(value), N.abs(B[index]));
        return Maximum === 0 ? 0 : N.lerp(value / Maximum, B[index] / Maximum, t) * Maximum;
    }));
};

/**
 * Chooses the least-aligned positive four-dimensional axis, with X/Y/Z/W tie order.
 *
 * @category Internal
 * @since 1.0.0
 */
const orthogonal = (self: CanonicalKey): Quat =>
{
    let Index = 0;
    for (let index = 1; index < 4; index++)
    {
        if (N.abs(self[index]) < N.abs(self[Index]))
        {
            Index = index;
        }
    }

    const Projected = self.map((value: number,
        index: number) => (index === Index ? 1 : 0) - value * self[Index]);
    const Unit = Option.getOrElse(normalizeComponents(Projected), () => [ 1, 0, 0, 0 ]);
    return QuatUnsafe(Unit[0], Unit[1], Unit[2], Unit[3]);
};

/**
 * Builds a great-circle frame without canonical keys; antipodes use a deterministic perpendicular.
 *
 * @category Internal
 * @since 1.0.0
 */
const sphericalFrame = (self: Coordinates,
    that: Coordinates,
    fullPath: boolean): Option.Option<SphericalFrame> =>
{
    const Start = normalize(self);
    const End = normalize(that);
    if (Option.isNone(Start) || Option.isNone(End))
    {
        return Option.none();
    }

    const EndSign = !fullPath && dot(Start.value, End.value) < 0 ? -1 : 1;
    const Aligned = scale(End.value, EndSign);
    const A = components(Start.value);
    const B = components(Aligned);
    const Dot = N.clamp(dot(Start.value, Aligned), { maximum: 1,
        minimum: -1 });
    let Sine = 0;
    for (let i = 0; i < 4; i++)
    {
        for (let j = i + 1; j < 4; j++)
        {
            Sine = N.hypot(Sine, A[i] * B[j] - A[j] * B[i]);
        }
    }

    let Tangent: Quat;
    if (Sine === 0)
    {
        Tangent = orthogonal(A);
    }
    else
    {
        const Perpendicular = A.map((value: number, i: number) =>
            A.reduce((sum: number, other: number, j: number) =>
                sum + other * (other * B[i] - value * B[j]), 0));
        const Unit = normalizeComponents(Perpendicular);
        if (Option.isNone(Unit))
        {
            return Option.none();
        }

        Tangent = QuatUnsafe(Unit.value[0], Unit.value[1], Unit.value[2], Unit.value[3]);
    }

    return Option.some(Object.freeze({ angle: N.atan2(Sine, Dot),
        end: Aligned,
        endSign: EndSign,
        sine: Sine,
        start: Start.value,
        tangent: Tangent }));
};

/**
 * Samples unit rotations or raw-magnitude spherical weights without erasing path signs.
 *
 * @category Internal
 * @since 1.0.0
 */
const spherical = (self: Coordinates, that: Coordinates, t: number, fullPath: boolean,
    normalized: boolean): Option.Option<Quat> =>
{
    if (!N.Number.isFinite(t))
    {
        return Option.none();
    }

    const Frame = sphericalFrame(self, that, fullPath);
    if (Option.isNone(Frame))
    {
        return Option.none();
    }

    const F = Frame.value;
    const RawEnd = scale(that, F.endSign);
    if (t === 0)
    {
        return Option.some(normalized ? F.start : copy(self));
    }

    if (t === 1)
    {
        return Option.some(normalized ? F.end : RawEnd);
    }

    const Angle = F.angle * t;
    const Cosine = N.cos(Angle);
    const Sine = N.sin(Angle);
    if (normalized)
    {
        return normalize(add(scale(F.start, Cosine), scale(F.tangent, Sine)));
    }

    if (F.angle === 0)
    {
        return linearRaw(self, RawEnd, t);
    }

    const Maximum = N.max(N.max(N.abs(self.x), N.abs(self.y)), N.max(N.abs(self.z), N.abs(self.w)));
    const OtherMaximum = N.max(N.max(N.abs(that.x), N.abs(that.y)), N.max(N.abs(that.z), N.abs(that.w)));
    const CommonScale = N.max(Maximum, OtherMaximum);
    const FirstLength = magnitude(divide(self, CommonScale));
    const SecondLength = magnitude(divide(that, CommonScale));
    let Along: number;
    let Across: number;
    if (F.sine === 0)
    {
        const Length = N.lerp(FirstLength, SecondLength, t);
        Along = Length * Cosine;
        Across = Length * Sine;
    }
    else
    {
        const Difference = SecondLength - FirstLength;
        Along = FirstLength * Cosine + (Difference === 0 ? 0 :
            (Difference * dot(F.start, F.end) * Sine) / F.sine);
        Across = SecondLength * Sine;
    }

    const A = components(F.start);
    const T = components(F.tangent);
    return finiteComponents(A.map((value: number, index: number): number =>
    {
        const Direct = (value * Along + T[index] * Across) * CommonScale;
        if (N.Number.isFinite(Direct) || F.sine === 0)
        {
            return Direct;
        }

        const Base = (value * FirstLength * Cosine + T[index] * SecondLength * Sine) * CommonScale;
        const Correction = value * (SecondLength - FirstLength) * dot(F.start, F.end) * Sine * CommonScale;
        return Base + Correction / F.sine;
    }));
};

/**
 * Shortest-path raw component lerp with aligned endpoints and unnormalized output. Invalid endpoints
 * or parameters yield None.
 *
 * @category Interpolation
 * @since 1.0.0
 */
export const fastLerp: Interpolation = dual(3,
    (self: Coordinates, that: Coordinates, t: number): Option.Option<Quat> =>
    {
        const A = normalize(self);
        const B = normalize(that);
        return !N.Number.isFinite(t) || Option.isNone(A) || Option.isNone(B) ? Option.none() :
            linearRaw(self, dot(A.value, B.value) < 0 ? negate(that) : that, t);
    });

/**
 * Applies fastLerp across both rows and then between them, preserving unnormalized output. Degenerate
 * intermediate rotations yield None.
 *
 * @category Interpolation
 * @since 1.0.0
 */
export const fastBilerp: Bilerp = dual(6,
    (self: Coordinates, q10: Coordinates, q01: Coordinates, q11: Coordinates, u: number,
        v: number): Option.Option<Quat> =>
    {
        const First = fastLerp(self, q10, u);
        const Second = fastLerp(q01, q11, u);
        return Option.isSome(First) && Option.isSome(Second) ? fastLerp(First.value,
            Second.value,
            v) : Option.none();
    });

/**
 * Samples the shortest unit quaternion arc after normalizing inputs; t may extrapolate.
 *
 * @category Interpolation
 * @since 1.0.0
 */
export const slerp: Interpolation = dual(3,
    (self: Coordinates,
        that: Coordinates,
        t: number): Option.Option<Quat> => spherical(self,
        that,
        t,
        false,
        true));

/**
 * Applies shortest-arc spherical weights to raw endpoint magnitudes without output normalization.
 *
 * @category Interpolation
 * @since 1.0.0
 */
export const slerpUnnormalized: Interpolation = dual(3,
    (self: Coordinates,
        that: Coordinates,
        t: number): Option.Option<Quat> => spherical(self,
        that,
        t,
        false,
        false));

/**
 * Samples a normalized arc honoring endpoint signs, including deterministic antipodal paths.
 *
 * @category Interpolation
 * @since 1.0.0
 */
export const slerpFullPath: Interpolation = dual(3,
    (self: Coordinates,
        that: Coordinates,
        t: number): Option.Option<Quat> => spherical(self,
        that,
        t,
        true,
        true));

/**
 * Samples a signed full arc with raw spherical weights; exact antipodes linearly interpolate
 * magnitude.
 *
 * @category Interpolation
 * @since 1.0.0
 */
export const slerpFullPathUnnormalized: Interpolation = dual(3,
    (self: Coordinates,
        that: Coordinates,
        t: number): Option.Option<Quat> => spherical(self,
        that,
        t,
        true,
        false));

/**
 * Combines endpoint and tangent arcs using the standard 2*t*(1-t) squad blend.
 *
 * @category Internal
 * @since 1.0.0
 */
const squadSample = (self: Coordinates, startTangent: Coordinates, that: Coordinates, endTangent: Coordinates,
    t: number, fullPath: boolean): Option.Option<Quat> =>
{
    const A = spherical(self, that, t, fullPath, true);
    const B = spherical(startTangent, endTangent, t, fullPath, true);
    return Option.isSome(A) && Option.isSome(B)
        ? spherical(A.value, B.value, 2 * t * (1 - t), fullPath, true) : Option.none();
};

/**
 * Samples normalized shortest-path squad; operand order is start, start tangent, end, end tangent, t.
 *
 * @category Interpolation
 * @since 1.0.0
 */
export const squad: Squad = dual(5,
    (self: Coordinates, startTangent: Coordinates, that: Coordinates, endTangent: Coordinates,
        t: number): Option.Option<Quat> => squadSample(self, startTangent, that, endTangent, t, false));

/**
 * Samples normalized squad with full-path signs at every spherical interpolation.
 *
 * @category Interpolation
 * @since 1.0.0
 */
export const squadFullPath: Squad = dual(5,
    (self: Coordinates, startTangent: Coordinates, that: Coordinates, endTangent: Coordinates,
        t: number): Option.Option<Quat> => squadSample(self, startTangent, that, endTangent, t, true));

/**
 * Returns the pure-imaginary rotation logarithm, retaining unit quaternion sign. Identity maps to
 * zero; negative identity maps to positive X times pi.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const log = (self: Coordinates): Option.Option<Quat> =>
{
    const Unit = normalize(self);
    if (Option.isNone(Unit))
    {
        return Option.none();
    }

    const Imaginary = V3.Vector3Unsafe(Unit.value.x, Unit.value.y, Unit.value.z);
    const Length = V3.magnitude(Imaginary);
    if (Length === 0)
    {
        return Option.some(Unit.value.w < 0 ? QuatUnsafe(Pi, 0, 0, 0) : QuatUnsafe(0, 0, 0, 0));
    }

    const Axis = V3.normalize(Imaginary);
    return Option.isNone(Axis) ? Option.none() : Option.some(
        QuatUnsafe(Axis.value.x * N.atan2(Length, Unit.value.w),
            Axis.value.y * N.atan2(Length, Unit.value.w), Axis.value.z * N.atan2(Length, Unit.value.w), 0));
};

/**
 * Exponentiates a finite pure-imaginary quaternion into a unit rotation; zero maps to identity.
 * Nonzero w is outside this rotation-exp domain.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const exp = (self: Coordinates): Option.Option<Quat> =>
{
    if (!isFinite(self) || self.w !== 0)
    {
        return Option.none();
    }

    const Imaginary = V3.Vector3Unsafe(self.x, self.y, self.z);
    const Length = V3.magnitude(Imaginary);
    if (!N.Number.isFinite(Length))
    {
        return Option.none();
    }

    if (Length === 0)
    {
        return Option.some(Identity);
    }

    const Axis = V3.normalize(Imaginary);
    if (Option.isNone(Axis))
    {
        return Option.none();
    }

    const Sine = N.sin(Length);
    return Quat(Axis.value.x * Sine, Axis.value.y * Sine, Axis.value.z * Sine, N.cos(Length));
};

/**
 * Calculates a shortest-path unit squad control. Finite tension is unclamped; zero gives the standard
 * tangent and one returns the current unit key.
 *
 * @category Interpolation
 * @since 1.0.0
 */
export const calculateTangent: Tangent = dual(
    (args: IArguments) => args.length >= 3 && typeof args[2] === "object" && args[2] !== null,
    (self: Coordinates,
        previous: Coordinates,
        next: Coordinates,
        tension: number = 0): Option.Option<Quat> =>
    {
        if (!N.Number.isFinite(tension))
        {
            return Option.none();
        }

        const Center = normalize(self);
        const Before = alignShortestArc(previous, self);
        const After = alignShortestArc(next, self);
        if (Option.isNone(Center) || Option.isNone(Before) || Option.isNone(After))
        {
            return Option.none();
        }

        const A = log(multiply(conjugate(Center.value),
            Option.getOrElse(normalize(Before.value),
                () => Identity)));
        const B = log(multiply(conjugate(Center.value),
            Option.getOrElse(normalize(After.value),
                () => Identity)));
        if (Option.isNone(A) || Option.isNone(B))
        {
            return Option.none();
        }

        const Offset = exp(scale(add(A.value, B.value), -0.25 * (1 - tension)));
        return Option.isNone(Offset) ? Option.none() : normalize(multiply(Center.value, Offset.value));
    });

/**
 * Projects a unit rotation onto a unit twist axis stably; the perpendicular half-turn singularity
 * chooses identity twist.
 *
 * @category Internal
 * @since 1.0.0
 */
const unitTwist = (self: Quat, axis: V3.Vector3): Quat =>
{
    const Projection = V3.dot(V3.Vector3Unsafe(self.x, self.y, self.z), axis);
    const Maximum = N.max(N.abs(Projection), N.abs(self.w));
    if (Maximum === 0)
    {
        return Identity;
    }

    const Amount = Projection / Maximum;
    return Option.getOrElse(normalize(QuatUnsafe(axis.x * Amount, axis.y * Amount, axis.z * Amount,
        self.w / Maximum)), () => Identity);
};

/**
 * Decomposes self as swing*twist with a unit axis twist and raw-magnitude swing. Invalid or
 * unrepresentable factors yield None.
 *
 * @category Decomposition
 * @since 1.0.0
 */
export const toSwingTwist: Binary<Coordinates, V3.Coordinates, Option.Option<SwingTwist>> = binary(
    (self: Coordinates, that: V3.Coordinates): Option.Option<SwingTwist> =>
    {
        const Unit = normalize(self);
        const Axis = V3.normalize(that);
        if (Option.isNone(Unit) || Option.isNone(Axis))
        {
            return Option.none();
        }

        const Twist = unitTwist(Unit.value, Axis.value);
        const Maximum = components(self).reduce((total: number,
            value: number) => N.max(total,
            N.abs(value)),
        0);
        const Swing = scale(multiply(divide(self, Maximum), conjugate(Twist)), Maximum);
        const Checked = Quat(Swing.x, Swing.y, Swing.z, Swing.w);
        return Option.isNone(Checked) ? Option.none() : Option.some(Object.freeze({ swing: Checked.value,
            twist: Twist }));
    });

/**
 * Extracts principal signed axis twist in [-pi,pi), preserving tiny angles. Singular perpendicular
 * half-turns return zero.
 *
 * @category Decomposition
 * @since 1.0.0
 */
export const twistAngle: Binary<Coordinates, V3.Coordinates, Option.Option<number>> = binary(
    (self: Coordinates, that: V3.Coordinates): Option.Option<number> =>
    {
        const Unit = normalize(self);
        const Axis = V3.normalize(that);
        if (Option.isNone(Unit) || Option.isNone(Axis))
        {
            return Option.none();
        }

        const Twist = unitTwist(Unit.value, Axis.value);
        const Sign = Twist.w < 0 ? -1 : 1;
        const Projection = V3.dot(V3.Vector3Unsafe(Twist.x, Twist.y, Twist.z), Axis.value) * Sign;
        const Angle = 2 * N.atan2(Projection, Twist.w * Sign);
        const Principal = Angle >= Pi ? Angle - 2 * Pi : Angle;
        return Option.some(Principal === 0 ? 0 : Principal);
    });

/**
 * Aliases the core normalized dot-error operation, which already normalizes both operands.
 *
 * @category Comparisons
 * @since 1.0.0
 */
export const errorAutoNormalize = error;

/**
 * Converts using qY(-yaw)*qX(pitch)*qZ(roll), reducing winding before trigonometry.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromRotator = (self: R.Coordinates): Option.Option<Quat> =>
{
    return Option.map(anglesToQuat(self.pitch, self.yaw, self.roll),
        (key: CanonicalKey) => QuatUnsafe(...key));
};

/**
 * Extracts principal Euler angles; pitch poles set roll zero and absorb residual rotation into
 * yaw.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toRotator = (self: Coordinates): Option.Option<R.Rotator> =>
{
    return Option.map(quaternionToAngles(components(self)),
        (angles: readonly [number,
            number,
            number]) => makeRotator(...angles));
};

/**
 * Constructs from Euler-vector degrees with x=pitch, y=yaw, z=roll.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromEuler = (self: V3.Coordinates): Option.Option<Quat> =>
{
    return Option.map(anglesToQuat(self.x, self.y, self.z),
        (key: CanonicalKey) => QuatUnsafe(...key));
};

/**
 * Extracts principal Euler-vector degrees with x=pitch, y=yaw, z=roll.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toEuler = (self: Coordinates): Option.Option<V3.Vector3> =>
{
    return Option.map(quaternionToAngles(components(self)),
        (angles: readonly [number,
            number,
            number]) => V3.Vector3Unsafe(...angles));
};
