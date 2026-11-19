/**
 * Inventories the pinned upstream Schema declarations for compatibility checks.
 *
 * @module @bedform/effect/Test/SchemaInventory
 *
 * @file      SchemaInventory.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import TypeScript from "typescript";
import { readFileSync } from "node:fs";

/* Compiler visitors use their contextual types and preserve declaration order. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */
/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

/**
 * Modules covered by the approved synchronous subset contract.
 *
 * @category Tests
 * @since 1.0.0
 */
export const SchemaModules = Object.freeze([
    "Schema", "SchemaAST", "SchemaIssue", "SchemaParser", "SchemaGetter",
    "SchemaTransformation", "StandardSchema", "JsonSchema"
] as const);

/**
 * One unique declaration or member path; overloads share a path.
 *
 * @category Types
 * @since 1.0.0
 */
export interface SchemaInventoryEntry
{
    readonly name: string;
    readonly kind: "export" | "member";
}

/**
 * Reads an installed pinned upstream source using its public module location.
 *
 * @category Tests
 * @since 1.0.0
 */
export function readSchemaUpstream(module: string): string
{
    const Source = new URL(`../src/${module}.ts`, import.meta.resolve(`effect/${module}`));
    return readFileSync(Source, "utf8");
}

/**
 * Collects exported names, namespace declarations and nested object members.
 * Ambient namespaces implicitly export their members. Private top-level helpers
 * are excluded. This inventory is independent of the compatibility decisions.
 *
 * @category Tests
 * @since 1.0.0
 */
export function inventorySchema(source: string): ReadonlyArray<SchemaInventoryEntry>
{
    const File = TypeScript.createSourceFile("schema.ts", source, TypeScript.ScriptTarget.Latest, true);
    const Entries = new Map<string, SchemaInventoryEntry>();

    const add = (name: string, kind: SchemaInventoryEntry["kind"]): void =>
    {
        if (!Entries.has(name))
        {
            Entries.set(name, { name,
                kind });
        }
    };

    const members = (nodes: ReadonlyArray<TypeScript.TypeElement>, prefix: string): void =>
    {
        for (const node of nodes)
        {
            if (!node.name)
            {
                continue;
            }

            const Path = `${prefix}.${node.name.getText(File).replace(/^"|"$/g, "")}`;
            add(Path, "member");
            if (TypeScript.isPropertySignature(node) && node.type && TypeScript.isTypeLiteralNode(node.type))
            {
                members(node.type.members, Path);
            }
        }
    };

    const declarations = (
        statements: ReadonlyArray<TypeScript.Statement>,
        prefix = "",
        ambient = false
    ): void =>
    {
        for (const node of statements)
        {
            const Modifiers = TypeScript.canHaveModifiers(node) ? TypeScript.getModifiers(node) : undefined;
            if (!ambient && !TypeScript.isExportDeclaration(node) &&
                !Modifiers?.some((modifier) => modifier.kind === TypeScript.SyntaxKind.ExportKeyword))
            {
                continue;
            }

            if (TypeScript.isExportDeclaration(node) && node.exportClause &&
                TypeScript.isNamedExports(node.exportClause))
            {
                for (const element of node.exportClause.elements)
                {
                    add(prefix + element.name.text, "export");
                }
            }
            else if (TypeScript.isVariableStatement(node))
            {
                for (const declaration of node.declarationList.declarations)
                {
                    add(prefix + declaration.name.getText(File), "export");
                    if (declaration.type && TypeScript.isTypeLiteralNode(declaration.type))
                    {
                        members(declaration.type.members, prefix + declaration.name.getText(File));
                    }
                }
            }
            else if (TypeScript.isInterfaceDeclaration(node) || TypeScript.isTypeAliasDeclaration(node))
            {
                const Path = prefix + node.name.text;
                add(Path, "export");
                if (TypeScript.isInterfaceDeclaration(node))
                {
                    members(node.members, Path);
                }
                else if (TypeScript.isTypeLiteralNode(node.type))
                {
                    members(node.type.members, Path);
                }
            }
            else if (TypeScript.isFunctionDeclaration(node) || TypeScript.isClassDeclaration(node))
            {
                if (node.name)
                {
                    add(prefix + node.name.text, "export");
                }

                if (TypeScript.isClassDeclaration(node) && node.name)
                {
                    for (const member of node.members)
                    {
                        if (member.name)
                        {
                            add(`${prefix}${node.name.text}.${member.name.getText(File)}`, "member");
                        }
                    }
                }
            }
            else if (TypeScript.isModuleDeclaration(node))
            {
                add(prefix + node.name.text, "export");
                if (node.body && TypeScript.isModuleBlock(node.body))
                {
                    const IsAmbient = ambient || !!Modifiers?.some(
                        (modifier) => modifier.kind === TypeScript.SyntaxKind.DeclareKeyword
                    );
                    declarations(node.body.statements, `${prefix}${node.name.text}.`, IsAmbient);
                }
            }
        }
    };

    declarations(File.statements);
    return [ ...Entries.values() ].sort((left, right) => left.name.localeCompare(right.name));
}
