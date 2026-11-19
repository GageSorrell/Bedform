/**
 * Explicit host physics overlay compilation.
 *
 * @module bedform/CLI/BuildCommand
 *
 * @file      BuildCommand.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { compile, publish } from "../Build/Physics.js";

/**
 * Compiles registrations and publishes only compiler-owned overlays.
 *
 * @category CLI
 * @since 1.0.0
 */
export const build = async (configFile: string, output: string): Promise<void> =>
{
    await publish(await compile(configFile), output);
};
