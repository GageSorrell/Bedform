/**
 * Type-only fixture catalog placeholder; the engine runner replaces this module
 * with the current compiler's generated catalog before bundling the test pack.
 *
 * @module bedform/Test/Engine/catalog
 *
 * @file      catalog.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import type { Model } from "../../Source/PhysicsModel.js";

/**
 * Engine runner supplies real cuboid and particle-owner compiled registrations.
 *
 * @category Fixtures
 * @since 1.0.0
 */
export const Models: Readonly<Record<string, Model>> = Object.freeze({});
