/**
 * Exact rational sources of truth for the conversion factors shared by
 * multiple unit modules' exact paths, in SI units. All are exact defined values
 * (the 1959 international yard and pound agreement, standard gravity),
 * authored directly from their defining decimals.
 *
 * The float constants in ./constants.ts are deliberately NOT derived from
 * these, so the float path stays bit-identical with effect-units; instead,
 * Test/Unit.test.mts asserts bit-identity between the two families.
 *
 * Ported from effect-units 1.0.1.
 *
 * @module @bedform/effect/Unit/Internal/constantsExact
 *
 * @file      constantsExact.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as BigRational from "../../BigRational.js";

/**
 * Meters per international inch (25.4 mm exactly).
 *
 * @category Constants
 * @since 1.0.0
 */
export const metersPerInch = BigRational.makeUnsafe(127n, 5_000n);

/**
 * Meters per international foot (12 inches).
 *
 * @category Constants
 * @since 1.0.0
 */
export const metersPerFoot = BigRational.makeUnsafe(381n, 1_250n);

/**
 * Meters per international yard (3 feet).
 *
 * @category Constants
 * @since 1.0.0
 */
export const metersPerYard = BigRational.makeUnsafe(1_143n, 1_250n);

/**
 * Meters per international mile (1760 yards).
 *
 * @category Constants
 * @since 1.0.0
 */
export const metersPerMile = BigRational.makeUnsafe(201_168n, 125n);

/**
 * Kilograms per avoirdupois pound.
 *
 * @category Constants
 * @since 1.0.0
 */
export const kilogramsPerPound = BigRational.makeUnsafe(45_359_237n, 100_000_000n);

/**
 * Standard gravity, in meters per second squared.
 *
 * @category Constants
 * @since 1.0.0
 */
export const gee = BigRational.makeUnsafe(196_133n, 20_000n);

/**
 * Newtons per pound of force (one pound under standard gravity).
 *
 * @category Constants
 * @since 1.0.0
 */
export const newtonsPerPoundForce = BigRational.multiply(kilogramsPerPound, gee);

/**
 * The number of seconds in one minute, as an exact rational.
 *
 * @category Constants
 * @since 1.0.0
 */
export const secondsPerMinute = BigRational.makeUnsafe(60n);

/**
 * The number of seconds in one hour, as an exact rational.
 *
 * @category Constants
 * @since 1.0.0
 */
export const secondsPerHour = BigRational.makeUnsafe(3_600n);
