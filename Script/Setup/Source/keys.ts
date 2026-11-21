/**
 * Script-owned environment identifiers for the setup elevation transport.
 *
 * @module monorepo-setup/keys
 *
 * @file      keys.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Data-only environment payload consumed by the fixed PowerShell UAC helper.
 *
 * @category Constant
 * @since 1.0.0
 */
export const EnvironmentVariable = Object.freeze({ Relaunch: "BEDFORM_SETUP_RELAUNCH" } as const);
