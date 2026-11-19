/**
 * Supplies the DOM-named strategy type required by upstream Effect's host-only declaration graph.
 *
 * @module @bedform/effect/Test/UpstreamWeb
 *
 * @file      UpstreamWeb.d.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { QueuingStrategy as NodeQueuingStrategy } from "node:stream/web";

declare global
{
    /**
     * Reuses Node's stream strategy definition in the host-only test compiler.
     *
     * @category Types
     * @since 1.0.0
     */
    interface QueuingStrategy<Value = any> extends NodeQueuingStrategy<Value> {}
}
