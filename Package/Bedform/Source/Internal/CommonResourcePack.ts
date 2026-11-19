/**
 * Identity of the Bedform Common resource pack, which supplies native DDUI artwork.
 *
 * @module bedform/Internal/CommonResourcePack
 *
 * @file      CommonResourcePack.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Header UUID of the Bedform Common resource pack. DDUI images resolve their
 * textures from it, because vanilla textures do not resolve by pack UUID.
 *
 * @category Constant
 * @since 1.0.0
 */
export const CommonResourcePack = "c15f802e-ae6c-4b64-9037-db7fb035f1e8" as const;
