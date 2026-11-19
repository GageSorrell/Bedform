/**
 * Private filter signature used by the Option combinators.
 *
 * @module @bedform/effect/Port/Internal/filter
 *
 * @file      filter.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Result } from "../Result.ts"

/**
 * Transforms a passing input into a success and a failing input into a failure.
 *
 * @category models
 * @since 1.0.0
 */
export interface Filter<in Input, out Pass = Input, out Fail = Input>
{
  (input: Input): Result<Pass, Fail>
}
