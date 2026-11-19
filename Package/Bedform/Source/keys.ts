/**
 * Stable public entity-property keys shared by generated assets and runtime adapters.
 *
 * @module bedform/keys
 *
 * @file      keys.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Discriminants and vector channels precede related fields. */
/* eslint-disable sort-keys */
/* Document exported constants at their declarations; generated expressions retain layout. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

/**
 * Tagged interval channels; payload keys contain a 16-bit word and 7-bit sequence tag.
 *
 * @category Constants
 * @since 1.0.0
 */
export const EntityProperty = Object.freeze({
    Sx: "bedform:physics_sx",
    Sy: "bedform:physics_sy",
    Sz: "bedform:physics_sz",
    Ex: "bedform:physics_ex",
    Ey: "bedform:physics_ey",
    Ez: "bedform:physics_ez",
    Sqx: "bedform:physics_sqx",
    Sqy: "bedform:physics_sqy",
    Sqz: "bedform:physics_sqz",
    Sqw: "bedform:physics_sqw",
    Eqx: "bedform:physics_eqx",
    Eqy: "bedform:physics_eqy",
    Eqz: "bedform:physics_eqz",
    Eqw: "bedform:physics_eqw",
    BxLow: "bedform:physics_bxlow",
    BxHigh: "bedform:physics_bxhigh",
    BxFraction: "bedform:physics_bxfraction",
    ByLow: "bedform:physics_bylow",
    ByHigh: "bedform:physics_byhigh",
    ByFraction: "bedform:physics_byfraction",
    BzLow: "bedform:physics_bzlow",
    BzHigh: "bedform:physics_bzhigh",
    BzFraction: "bedform:physics_bzfraction",
    Sequence: "bedform:physics_sequence",
    Reset: "bedform:physics_reset"
} as const);

/**
 * Persistent owner state and transient runtime entity provenance.
 *
 * @category Constants
 * @since 1.0.0
 */
export const DynamicProperty = Object.freeze({
    PhysicsState: "bedform:physics_state",
    PhysicsTransient: "bedform:physics_transient"
} as const);

