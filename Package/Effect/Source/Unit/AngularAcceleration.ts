/**
 * Angular acceleration quantities, stored in radians per second squared, with
 * constructors and conversions for common units.
 *
 * Conversions whose factor involves π cannot be exact, so their
 * constructors accept every numeric kind but always produce floats,
 * and their converters return floats. The base unit keeps the kind it is
 * given.
 *
 * Ported from effect-units 1.0.1.
 *
 * @module @bedform/effect/Unit/AngularAcceleration
 *
 * @file      AngularAcceleration.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as AngularSpeed from "./AngularSpeed.js";
import * as Duration from "./Duration.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

/**
 * The type of the radians per second squared unit, composed from other units with
 * the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type RadiansPerSecondSquared = Unit.Rate<
    AngularSpeed.RadiansPerSecond,
    Duration.Seconds
>;

/**
 * The radians per second squared unit, composed from other units with the `Unit`
 * algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const RadiansPerSecondSquared: RadiansPerSecondSquared = Unit.rate(
    AngularSpeed.RadiansPerSecond,
    Duration.Seconds
);

/**
 * A quantity measured in `RadiansPerSecondSquared`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type AngularAcceleration<K extends Quantity.Value = number> = Quantity.Quantity<
    RadiansPerSecondSquared,
    K
>;

/**
 * The identity schema for `AngularAcceleration` values. Its canonical JSON
 * representation is `{ unit, value }` with a finite numeric value, so
 * `Schema.toCodecJson` derives that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const AngularAcceleration = Quantity.Quantity(RadiansPerSecondSquared);

/**
 * The codec between `AngularAcceleration` values and their `{ unit, value }`
 * encoding, with a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const AngularAccelerationFromStruct = Quantity.QuantityFromStruct(
    RadiansPerSecondSquared
);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): AngularAcceleration<K> => Quantity.make(RadiansPerSecondSquared, value) as AngularAcceleration<K>;

/**
 * An `AngularAcceleration` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates an `AngularAcceleration` from a number of radians per second squared.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const radiansPerSecondSquared = <N extends Quantity.Input>(
    n: N
): AngularAcceleration<Quantity.Of<N>> => make(n);

/**
 * Converts an `AngularAcceleration` to a number of radians per second squared.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inRadiansPerSecondSquared = <K extends Quantity.Value>(a: AngularAcceleration<K>): K =>
    a.value;

const radiansPerDegree = Math.PI / 180;

/**
 * Creates an `AngularAcceleration` from a number of degrees per second squared.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const degreesPerSecondSquared = <N extends Quantity.Input>(n: N): AngularAcceleration =>
    Predicate.isNumber(n)
        ? make(n * radiansPerDegree)
        : make(Numeric.float(n) * radiansPerDegree);

/**
 * Converts an `AngularAcceleration` to a number of degrees per second squared.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inDegreesPerSecondSquared = <K extends Quantity.Value>(a: AngularAcceleration<K>): number =>
    Numeric.toFloat(a.value) / radiansPerDegree;

const radiansPerTurn = 2 * Math.PI;

/**
 * Creates an `AngularAcceleration` from a number of turns per second squared.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const turnsPerSecondSquared = <N extends Quantity.Input>(n: N): AngularAcceleration =>
    Predicate.isNumber(n)
        ? make(n * radiansPerTurn)
        : make(Numeric.float(n) * radiansPerTurn);

/**
 * Converts an `AngularAcceleration` to a number of turns per second squared.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inTurnsPerSecondSquared = <K extends Quantity.Value>(a: AngularAcceleration<K>): number =>
    Numeric.toFloat(a.value) / radiansPerTurn;
