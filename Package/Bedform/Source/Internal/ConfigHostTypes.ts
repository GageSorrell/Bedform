/**
 * Node-only bridge for upstream Effect's unqualified web-stream strategy type.
 * Node exports this interface from stream/web but does not install it globally.
 *
 * @module bedform/Internal/ConfigHostTypes
 *
 * @file      ConfigHostTypes.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { QueuingStrategy as NodeQueuingStrategy } from "node:stream/web";

declare global
{
    /**
     * Web-stream strategy supplied by Node for host configuration dependencies.
     *
     * @category Configuration
     * @since 1.0.0
     */
    interface QueuingStrategy<Value> extends NodeQueuingStrategy<Value> {}
}
