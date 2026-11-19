/**
 * Shared machinery for the library's numeric value objects (`Quantity`,
 * `Temperature`, `Rational` and `BigRational`), so equality, normalization,
 * and inspection semantics are defined in exactly one place. The float
 * helpers below apply only to float values.
 *
 * Ported from effect-units 1.0.1.
 *
 * @module @bedform/effect/Internal/valueObject
 *
 * @file      valueObject.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Inspectable from "../Inspectable.js";
import * as Pipeable from "../Pipeable.js";

/**
 * Float equality with NaN equal to itself, so `Equal.equals` stays
 * reflexive.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const valueEquals = (a: number, b: number): boolean =>
    a === b || (Number.isNaN(a) && Number.isNaN(b));

/**
 * Normalizes -0 to 0 so the two float zeros are one value for equality and
 * hashing.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const normalizeZero = (value: number): number =>
    value === 0 ? 0 : value;

/**
 * Prototype fragment providing `Inspectable`'s derived members (in terms of
 * the host's `toJSON`) and `Pipeable`.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const ValueObjectProto: Inspectable.Inspectable & Pipeable.Pipeable = {
    ...Inspectable.BaseProto,
    ...Pipeable.Prototype
};
