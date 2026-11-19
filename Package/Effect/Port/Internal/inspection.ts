/**
 * Pure inspection prototype extracted from Effect 4.0.5's internal core.
 *
 * @module @bedform/effect/Port/Internal/inspection
 *
 * @file      inspection.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { format } from "../Formatter.ts"
import { NodeInspectSymbol } from "../Inspectable.ts"
import { pipeArguments } from "../Pipeable.ts"

/**
 * Supplies piping, JSON, string and inspection methods to data prototypes.
 *
 * @category internals
 * @since 1.0.0
 */
export const PipeInspectableProto = {
  pipe() {
    return pipeArguments(this, arguments)
  },
  toJSON(this: any) {
    return { ...this }
  },
  toString() {
    return format(this.toJSON(), { ignoreToString: true, space: 2 })
  },
  [NodeInspectSymbol]() {
    return this.toJSON()
  }
}
