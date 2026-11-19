/**
 * Non-loading support checks for persisted block-face control bindings.
 *
 * @module bedform/Internal/DiageticSupport
 *
 * @file      DiageticSupport.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { DynamicProperty } from "../Diagetic/Keys.js";
import type { Handle } from "../Diagetic.js";
import type { World } from "@minecraft/server";

/**
 * Checks only available native blocks, retaining bindings when a dimension/chunk cannot be read.
 * Same-type permutation changes retain support. Controls moved to another dimension lose support.
 *
 * @category Predicate
 * @since 1.0.0
 */
export const Support = (world: World, control: Pick<Handle, "Entity" | "Binding">):
    "valid" | "missing" | "unavailable" =>
{
    try
    {
        const retired = control.Entity.getDynamicProperty(DynamicProperty.Retired);
        if (retired !== undefined)
        {
            return retired === true ? "missing" : "unavailable";
        }

        const binding = control.Binding;
        if (!binding)
        {
            return "valid";
        }

        const dimension = world.getDimension(binding.Dimension);
        if (dimension.id !== control.Entity.dimension.id)
        {
            return "missing";
        }

        const block = dimension.getBlock(binding.Position);
        if (!block)
        {
            return "unavailable";
        }

        return block.isAir || block.typeId !== binding.ExpectedBlockType ? "missing" : "valid";
    }
    catch
    {
        return "unavailable";
    }
};
