/**
 * Walk-up station layout shared by the engine gallery and host integrity checks.
 *
 * @module bedform/Test/Engine/gallery
 *
 * @file      gallery.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable sort-keys, @stylistic/max-len */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration:has(VariableDeclaration)"] }] */

/**
 * One bounded demonstration, its owner, and the concise four-line sign text.
 *
 * @category Fixtures
 * @since 1.0.0
 */
export const Stations = Object.freeze({
    Rotate: Object.freeze({ id: "demo-rotate",
        x: 0,
        model: "box",
        text: "1. FULL ROTATION\nWatch all 3 axes\nSlow translation\nButton: reset" }),
    Rebase: Object.freeze({ id: "demo-rebase",
        x: 16,
        model: "box",
        text: "2. SMOOTH TRAVEL\nWatch it shuttle\nNo position snaps\nButton: reset" }),
    Hold: Object.freeze({ id: "demo-hold",
        x: 32,
        model: "box",
        text: "3. STOP AND HOLD\nMoves, then stops\nWatch for drifting\nButton: reset" }),
    Teleport: Object.freeze({ id: "demo-teleport",
        x: 48,
        model: "box",
        text: "4. TELEPORT RESET\nJumps side to side\nNo trailing motion\nButton: reset" }),
    Drop: Object.freeze({ id: "demo-drop",
        x: 64,
        model: "box",
        text: "5. GRAVITY DROP\nFalls and settles\nRepeats every 9s\nButton: reset" }),
    Support: Object.freeze({ id: "demo-support",
        x: 80,
        model: "platform",
        text: "6. MOVING FLOOR\nStand, walk, jump\nMoves and turns\nButton: reset" })
} as const);
