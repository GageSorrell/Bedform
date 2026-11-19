/**
 * Native-independent Canvas color channel and tint input contracts.
 *
 * @module bedform/Canvas/Color
 *
 * @file      Color.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Normalized RGBA, as MolangVariableMap.setColorRGBA expects.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Rgba
{
    readonly red: number;
    readonly green: number;
    readonly blue: number;
    readonly alpha: number;
}

/**
 * Normalized channels with optional alpha.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Channels
{
    readonly red: number;
    readonly green: number;
    readonly blue: number;
    readonly alpha?: number;
}

/**
 * Tint input: normalized channels, or #RRGGBB / #RRGGBBAA.
 *
 * @category Model
 * @since 1.0.0
 */
export type TintInput = string | Channels;

