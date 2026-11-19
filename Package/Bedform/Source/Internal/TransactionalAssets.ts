/**
 * Texture paths and translation keys of the transactional undo/redo/reset
 * component, shared by its runtime and by the Bedform Common pack builder.
 *
 * @module bedform/Internal/TransactionalAssets
 *
 * @file      TransactionalAssets.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Icon texture paths within the Bedform Common resource pack. Reset is a trash can.
 *
 * @category Constant
 * @since 1.0.0
 */
export const TransactionalIcon = Object.freeze({
    Cancel: "textures/bedform/transactional/cancel.png",
    Confirm: "textures/bedform/transactional/confirm.png",
    Redo: "textures/bedform/transactional/redo.png",
    Reset: "textures/bedform/transactional/reset.png",
    Undo: "textures/bedform/transactional/undo.png"
} as const);

/**
 * Translation keys of the component's text, each with its en_US text, which
 * the Bedform Common pack writes to `en_US.lang`.
 *
 * @category Constant
 * @since 1.0.0
 */
export const TransactionalText = Object.freeze({
    Cancel: Object.freeze({ English: "Cancel",
        Key: "bedform.transactional.cancel" } as const),
    Complete: Object.freeze({ English: "Reset complete!",
        Key: "bedform.transactional.complete" } as const),
    Confirm: Object.freeze({ English: "Reset",
        Key: "bedform.transactional.confirm" } as const),
    Question: Object.freeze({ English: "Are you sure?",
        Key: "bedform.transactional.question" } as const),
    Redo: Object.freeze({ English: "Redo",
        Key: "bedform.transactional.redo" } as const),
    Reset: Object.freeze({ English: "Reset",
        Key: "bedform.transactional.reset" } as const),
    Undo: Object.freeze({ English: "Undo",
        Key: "bedform.transactional.undo" } as const)
} as const);
