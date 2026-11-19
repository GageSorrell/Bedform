/**
 * The runtime side of treating `Unitless` as the identity of the unit
 * algebra. The float and exact tracks have to agree on this exactly, so
 * they share one definition.
 *
 * Ported from effect-units 1.0.1.
 *
 * @module @bedform/effect/Unit/Internal/dimensionless
 *
 * @file      dimensionless.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Unit from "../Unit.js";

/**
 * The dimensionless leaf, and only that leaf: a `Unit.custom("Unitless")`
 * is a different unit—a custom leaf, encoded `"[Unitless]"`—and is never
 * folded away.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isUnitless = (unit: Unit.Unit): unit is "Unitless" =>
    unit === "Unitless";

const isProduct = (
    unit: Unit.Unit
): unit is Unit.Product<Unit.Unit, Unit.Unit> =>
    typeof unit !== "string" && unit._tag === "Product";

/**
 * The left factor of a product unit—the inverse of what `times` composed.
 *
 * A unit that is not a product is not a broken input. `times` folds a
 * dimensionless operand away, so a quantity whose static type is a
 * `Product` can carry the other factor's unit at runtime (reachable only
 * from code generic in its units—see `Quantity`'s note on {@link
 * isUnitless}). Dividing such a quantity by its right factor leaves the
 * factor that was folded, which was `Unitless` by construction: undoing the
 * fold rather than reaching for a `left` that isn't there. If the surviving
 * unit is itself a product, equality with the divisor identifies the fold
 * before either of that product's own factors can be selected.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const leftFactorOf = (unit: Unit.Unit, right: Unit.Unit): Unit.Unit =>
    isProduct(unit) && !Unit.equals(unit, right) ? unit.left : "Unitless";

/**
 * The right factor of a product unit—{@link leftFactorOf} mirrored.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const rightFactorOf = (unit: Unit.Unit, left: Unit.Unit): Unit.Unit =>
    isProduct(unit) && !Unit.equals(unit, left) ? unit.right : "Unitless";
