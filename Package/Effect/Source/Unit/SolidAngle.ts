/**
 * Solid angle quantities, stored in steradians, with constructors and conversions
 * for common units.
 *
 * Conversions whose factor involves π cannot be exact, so their
 * constructors accept every numeric kind but always produce floats,
 * and their converters return floats. The base unit keeps the kind it is
 * given.
 *
 * Ported from effect-units 1.0.1.
 *
 * @module @bedform/effect/Unit/SolidAngle
 *
 * @file      SolidAngle.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Angle from "./Angle.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Quantity from "./Quantity.js";

/**
 * The type of the `Steradians` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export type Steradians = "Steradians";

/**
 * The `Steradians` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export const Steradians: Steradians = "Steradians";

/**
 * A quantity measured in `Steradians`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type SolidAngle<K extends Quantity.Value = number> = Quantity.Quantity<Steradians, K>;

/**
 * The identity schema for `SolidAngle` values. Its canonical JSON representation
 * is `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson`
 * derives that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const SolidAngle = Quantity.Quantity(Steradians);

/**
 * The codec between `SolidAngle` values and their `{ unit, value }` encoding, with
 * a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const SolidAngleFromStruct = Quantity.QuantityFromStruct(Steradians);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): SolidAngle<K> => Quantity.make(Steradians, value) as SolidAngle<K>;

/**
 * A `SolidAngle` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `SolidAngle` from a number of steradians.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const steradians = <N extends Quantity.Input>(n: N): SolidAngle<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `SolidAngle` to a number of steradians.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSteradians = <K extends Quantity.Value>(s: SolidAngle<K>): K =>
    s.value;

/** One spat is 4π steradians, the solid angle of a full sphere. */
const steradiansPerSpat = 4 * Math.PI;

/**
 * Creates a `SolidAngle` from a number of spats.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const spats = <N extends Quantity.Input>(n: N): SolidAngle =>
    Predicate.isNumber(n)
        ? make(n * steradiansPerSpat)
        : make(Numeric.float(n) * steradiansPerSpat);

/**
 * Converts a `SolidAngle` to a number of spats.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSpats = <K extends Quantity.Value>(s: SolidAngle<K>): number =>
    Numeric.toFloat(s.value) / steradiansPerSpat;

/** One square degree is (π/180)² steradians. */
const steradiansPerSquareDegree = (Math.PI / 180) * (Math.PI / 180);

/**
 * Creates a `SolidAngle` from a number of square degrees.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const squareDegrees = <N extends Quantity.Input>(n: N): SolidAngle =>
    Predicate.isNumber(n)
        ? make(n * steradiansPerSquareDegree)
        : make(Numeric.float(n) * steradiansPerSquareDegree);

/**
 * Converts a `SolidAngle` to a number of square degrees.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSquareDegrees = <K extends Quantity.Value>(s: SolidAngle<K>): number =>
    Numeric.toFloat(s.value) / steradiansPerSquareDegree;

/**
 * The solid angle of a cone with the given apex angle.
 *
 * @category Operation
 * @since 1.0.0
 */
export const conical = (angle: Angle.Angle<Quantity.Value>): SolidAngle =>
    make(2 * Math.PI * (1 - Math.cos(Numeric.toFloat(angle.value) / 2)));

/**
 * The solid angle of a rectangular pyramid with the given apex angles.
 *
 * @category Operation
 * @since 1.0.0
 */
export const pyramidal = (
    a: Angle.Angle<Quantity.Value>,
    b: Angle.Angle<Quantity.Value>
): SolidAngle =>
    make(
        4 *
      Math.asin(
          Math.sin(Numeric.toFloat(a.value) / 2) *
          Math.sin(Numeric.toFloat(b.value) / 2)
      )
    );
