/**
 * Checks the implemented declaration and runtime surface against the approved contract.
 *
 * @module @bedform/effect/Test/SchemaSurface.test
 *
 * @file      SchemaSurface.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Compiler visitors preserve contextual inference and declaration order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len, @stylistic/max-statements-per-line */

import Assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import TypeScript from "typescript";
import { SchemaModules } from "./SchemaInventory.mjs";

test("declarations and runtime exports implement the retained/adapted manifest and omit excluded APIs", async () =>
{
    const manifest = JSON.parse(readFileSync(new URL("../SchemaCompatibility.json", import.meta.url), "utf8"));
    const files = SchemaModules.map((module) => fileURLToPath(new URL(`../Distribution/${module}.d.ts`, import.meta.url)));
    const program = TypeScript.createProgram(files, { target: TypeScript.ScriptTarget.ES2022,
        module: TypeScript.ModuleKind.NodeNext,
        moduleResolution: TypeScript.ModuleResolutionKind.NodeNext,
        strict: true,
        types: [] });
    const checker = program.getTypeChecker();
    for (const [ index, module ] of SchemaModules.entries())
    {
        const source = program.getSourceFile(files[index])!;
        const root = checker.getSymbolAtLocation(source)!;
        const exported = checker.getExportsOfModule(root);
        const runtime = await import(`../Distribution/${module}.js`);
        const allowed = new Set<string>(manifest.modules[module].filter((entry: { name: string;
            status: string }) => !entry.name.includes(".") && entry.status !== "omitted").map((entry: { name: string;
            localName?: string }) => entry.localName ?? entry.name));
        for (const name of exported.map((symbol) => symbol.name)) {Assert.ok(allowed.has(name), `${module}.${name} is an unapproved public export`);}

        for (const name of Object.keys(runtime)) {Assert.ok(allowed.has(name), `${module}.${name} is an unapproved runtime export`);}

        for (const entry of manifest.modules[module] as Array<{ name: string;
            status: string;
            localName?: string }>)
        {
            const name = entry.localName ?? entry.name;
            const parts = name.split(".");
            let symbol: TypeScript.Symbol | undefined = root;
            while (symbol && parts.length)
            {
                if (symbol.flags & TypeScript.SymbolFlags.Alias) {symbol = checker.getAliasedSymbol(symbol);}

                const resolved = symbol.flags & (TypeScript.SymbolFlags.Interface | TypeScript.SymbolFlags.Class | TypeScript.SymbolFlags.TypeAlias)
                    ? checker.getDeclaredTypeOfSymbol(symbol)
                    : checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? symbol.declarations?.[0] ?? source);
                const type = checker.getNonNullableType(resolved);
                const candidates = new Map([ ...checker.getExportsOfModule(symbol), ...type.getProperties() ].map((member) => [ member.name, member ]));
                for (const member of type.getProperties())
                {
                    for (const declaration of member.declarations ?? [])
                    {
                        if ("name" in declaration && declaration.name) {candidates.set((declaration.name as TypeScript.Node).getText().replace(/^"|"$/g, ""), member);}
                    }
                }

                let next: TypeScript.Symbol | undefined;
                for (let length = parts.length; length > 0; length--)
                {
                    next = candidates.get(parts.slice(0, length).join("."));
                    if (next) { parts.splice(0, length); break; }
                }

                symbol = next;
            }

            if (entry.status === "omitted") {Assert.equal(symbol, undefined, `${module}.${name} must be absent`);}
            else {Assert.ok(symbol, `${module}.${name} is missing`);}
        }
    }
});

