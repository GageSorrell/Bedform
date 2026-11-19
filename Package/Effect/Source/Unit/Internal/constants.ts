/**
 * Conversion factors shared by multiple unit modules, in SI units. All are
 * exact defined values (the 1959 international yard and pound agreement,
 * standard gravity), written as literals so each is the correctly rounded
 * float of its defined decimal value.
 *
 * Ported from effect-units 1.0.1.
 *
 * @module @bedform/effect/Unit/Internal/constants
 *
 * @file      constants.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

/**
 * Meters per international inch.
 *
 * @category Constants
 * @since 1.0.0
 */
export const metersPerInch = 0.0254;

/**
 * Meters per international foot (12 inches).
 *
 * @category Constants
 * @since 1.0.0
 */
export const metersPerFoot = 0.3048;

/**
 * Meters per international yard (3 feet).
 *
 * @category Constants
 * @since 1.0.0
 */
export const metersPerYard = 0.9144;

/**
 * Meters per international mile (1760 yards).
 *
 * @category Constants
 * @since 1.0.0
 */
export const metersPerMile = 1_609.344;

/**
 * Kilograms per avoirdupois pound.
 *
 * @category Constants
 * @since 1.0.0
 */
export const kilogramsPerPound = 0.45359237;

/**
 * Standard gravity, in meters per second squared.
 *
 * @category Constants
 * @since 1.0.0
 */
export const gee = 9.80665;

/**
 * Newtons per pound of force (one pound under standard gravity).
 *
 * @category Constants
 * @since 1.0.0
 */
export const newtonsPerPoundForce = kilogramsPerPound * gee;

/**
 * The number of seconds in one minute.
 *
 * @category Constants
 * @since 1.0.0
 */
export const secondsPerMinute = 60;

/**
 * The number of seconds in one hour.
 *
 * @category Constants
 * @since 1.0.0
 */
export const secondsPerHour = 3_600;
