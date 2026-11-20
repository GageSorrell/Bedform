/**
 * Declares bundled assets for the Cinnabar Figma plugin.
 *
 * @module figma-to-jsonui/assets
 *
 * @file      assets.d.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   PolyForm-Noncommercial-1.0.0
 */

// Upstream implementation: cinnabar-mc/cinnabar; see ../../../Bedform/import.json.

// Modules `build.mjs` provides at bundle time.

declare module 'virtual:wasm' {
  const bytes: Uint8Array;
  export default bytes;
}

// The compiled Cinnangles Sans carrier, when the build was given the font.
declare module 'virtual:font' {
  const bytes: Uint8Array | null;
  export default bytes;
}
