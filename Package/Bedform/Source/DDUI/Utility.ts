/**
 * Layout and text types shared by the native CustomForm components. Its types
 * come from `@minecraft/server-ui`, so it is published only as a subpath.
 *
 * @module bedform/DDUI/Utility
 *
 * @file      Utility.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { CustomForm } from "@minecraft/server-ui";

/**
 * Define the position of a DDUI element, relative to some other
 * DDUI element.
 *
 * @category Layout
 * @since 1.0.0
 */
export type RelativePosition = "before" | "after";

/**
 * The `string` and `string`-like types that can be used
 * for most DDUI parameters that work with text.
 *
 * @category Utility
 * @since 1.0.0
 */
export type Text = NonNullable<Parameters<InstanceType<typeof CustomForm>["button"]>[0]>;
