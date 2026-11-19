/**
 * Stable identifiers owned by Prototype persistence and native recovery snapshots.
 *
 * @module bedform/Prototype/keys
 *
 * @file      keys.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Export declarations own their documentation. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

/**
 * Atomic publication pointer for the versioned world document.
 *
 * @category Keys
 * @since 1.0.0
 */
export const DynamicProperty = Object.freeze({ Manifest: "bedform:prototype_state" } as const);

/**
 * Two alternating banks of size-bounded serialized document chunks.
 *
 * @category Keys
 * @since 1.0.0
 */
export const DynamicPropertyPrefix = Object.freeze({ Chunk: "bedform:prototype_chunk_" } as const);

/**
 * Partitioned native snapshots store blocks and block-entity contents outside dynamic properties.
 *
 * @category Keys
 * @since 1.0.0
 */
export const StructurePrefix = Object.freeze({ Snapshot: "bedform:prototype_snapshot_" } as const);
