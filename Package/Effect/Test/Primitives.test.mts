/**
 * Differential acceptance for the complete Predicate and String ports.
 *
 * @module @bedform/effect/Test/Primitives.test
 *
 * @file      Primitives.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Cross-package fixtures deliberately share contextual callback types. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, @stylistic/max-len, sort-keys */

import * as P from "@bedform/effect/Predicate";
import * as S from "@bedform/effect/String";
import * as UP from "effect/Predicate";
import * as US from "effect/String";
import * as Root from "@bedform/effect";
import Assert from "node:assert/strict";
import TypeScript from "typescript";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const Names = [ "Predicate", "String" ] as const;

/**
 * Captures nominal wrappers, iterators and thrown errors for differential checks.
 *
 * @throws { unknown } Rethrows non-Error failures from a differential callback.
 *
 * @category Testing
 * @since 1.0.0
 */
function outcome(run: () => unknown): unknown
{
    try
    {
        return JSON.parse(JSON.stringify(run(), (_key, value) =>
        {
            if (value && typeof value === "object" && Symbol.iterator in value && !Array.isArray(value))
            {
                return Array.from(value);
            }

            return value;
        }) ?? "null");
    }
    catch (error)
    {
        if (error instanceof Error)
        {
            return [ error.name, error.message ];
        }

        throw error;
    }
}

test("Predicate and String expose complete root and direct runtime surfaces", async () =>
{
    for (const name of Names)
    {
        const local = await import(`@bedform/effect/${name}`);
        const upstream = await import(`effect/${name}`);
        Assert.deepEqual(Object.keys(local).sort(), Object.keys(upstream).sort(), name);
        Assert.strictEqual(Root[name], local);
    }
});

test("Predicate guards preserve built-in, inherited, nullish and callable boundaries", () =>
{
    const values: Array<unknown> = [ undefined, null, false, true, 0, -0, NaN, Infinity, 1n, "", "a", Symbol("x"), [], {}, Object.create(null), Object.create({ value: 1 }), () => 1, new Date(NaN), /x/, new Error("x"), new Uint8Array(), new Map(), new Set(), Promise.resolve(1), { then: () => 1 }, { then: 1 }, { [Symbol.iterator]: () => [][Symbol.iterator]() } ];
    for (const name of Object.keys(P).filter((name) => name.startsWith("is") && ![ "isTagged", "isTupleOf", "isTupleOfAtLeast" ].includes(name)))
    {
        const local = P[name as keyof typeof P] as (value: unknown) => boolean;
        const upstream = UP[name as keyof typeof UP] as (value: unknown) => boolean;
        for (const value of values)
        {
            Assert.deepEqual(outcome(() => local(value)), outcome(() => upstream(value)), name);
        }
    }

    for (const module of [ P, UP ])
    {
        Assert.equal(module.hasProperty(Object.create({ value: 1 }), "value"), true);
        Assert.equal(module.hasProperty("value")(null), false);
        Assert.equal(module.isTagged("Ready")({ _tag: "Ready" }), true);
        Assert.equal(module.isTagged({}, "Ready"), false);
        Assert.equal(module.isTupleOf([ 1, 2 ], 2), true);
        Assert.equal(module.isTupleOfAtLeast(2)([ 1 ]), false);
        Assert.equal(module.Tuple([ module.isString, module.isNumber ])([ "a", 1 ]), true);
        Assert.equal(module.Struct({ value: module.isString })({ value: "a" }), true);
        Assert.equal(module.compose(module.isString, (value) => value.length > 1)("ab"), true);
        Assert.equal(module.mapInput((value: number) => value > 1, (value: string) => value.length)("ab"), true);
    }
});

test("Predicate combinators retain truth tables, dual calls and short-circuit evaluation", () =>
{
    for (const name of [ "and", "or", "xor", "eqv", "implies", "nand", "nor" ] as const)
    {
        for (const left of [ false, true ])
        {
            for (const right of [ false, true ])
            {
                const run = (module: typeof P | typeof UP, curried: boolean) =>
                {
                    const calls: Array<string> = [];
                    const a = () =>
                    {
                        calls.push("a");
                        return left;
                    };

                    const b = () =>
                    {
                        calls.push("b");
                        return right;
                    };

                    const result = curried ? module[name](b)(a)(0) : module[name](a, b)(0);
                    return [ result, calls ];
                };

                Assert.deepEqual(run(P, false), run(UP, false), name);
                Assert.deepEqual(run(P, true), run(UP, true), name);
            }
        }
    }

    for (const module of [ P, UP ])
    {
        Assert.equal(module.not(module.isString)(1), true);
        Assert.equal(module.every([])(1), true);
        Assert.equal(module.some([])(1), false);
        Assert.equal(module.every([ module.isNumber, (value: number) => value > 0 ])(1), true);
        Assert.equal(module.some([ module.isString, module.isNumber ])(1), true);
    }
});

test("String transforms preserve Unicode, empty strings, separators and all dual forms", () =>
{
    const unary = [ "camelCase", "camelToSnake", "capitalize", "configCase", "constantCase", "isEmpty", "isNonEmpty", "isString", "kebabCase", "kebabToSnake", "length", "linesIterator", "linesWithSeparators", "pascalCase", "pascalToSnake", "snakeCase", "snakeToCamel", "snakeToKebab", "snakeToPascal", "stripMargin", "toLowerCase", "toUpperCase", "trim", "trimStart", "trimEnd", "uncapitalize" ] as const;
    const inputs = [ "", "HTTPServer42", " hello_world-X ", "A\r\nB\rC\n", "\n |one\n |two", "é😀İß", "foo.bar99", "a\u0301" ];
    for (const name of unary)
    {
        for (const input of inputs)
        {
            Assert.deepEqual(outcome(() => S[name](input)), outcome(() => US[name](input)), `${name}: ${input}`);
        }
    }

    const cases: Array<readonly [string, Array<unknown>]> = [ [ "concat", [ "!" ] ], [ "at", [ -1 ] ], [ "at", [ 999 ] ], [ "charAt", [ 1 ] ], [ "charCodeAt", [ 1 ] ], [ "codePointAt", [ 1 ] ], [ "endsWith", [ "X" ] ], [ "includes", [ "a", 1 ] ], [ "startsWith", [ "a" ] ], [ "normalize", [ "NFC" ] ], [ "padStart", [ 10, "ab" ] ], [ "padEnd", [ 10, "ab" ] ], [ "repeat", [ 2 ] ], [ "repeat", [ -1 ] ], [ "replace", [ /a/g, "x" ] ], [ "replaceAll", [ "a", "x" ] ], [ "slice", [ -3, -1 ] ], [ "substring", [ 3, 1 ] ], [ "split", [ "" ] ], [ "takeLeft", [ 2 ] ], [ "takeRight", [ 2 ] ], [ "stripMarginWith", [ "|" ] ], [ "search", [ /a/ ] ], [ "noCase", [ { delimiter: "/" } ] ] ];
    for (const [ name, args ] of cases)
    {
        const local = S[name as keyof typeof S] as (...args: Array<any>) => any;
        const upstream = US[name as keyof typeof US] as (...args: Array<any>) => any;
        for (const input of inputs)
        {
            Assert.deepEqual(outcome(() => local(input, ...args)), outcome(() => upstream(input, ...args)), name);
            Assert.deepEqual(outcome(() => local(...args)(input)), outcome(() => upstream(...args)(input)), `${name} curried`);
        }
    }
});

test("String searches, locales, orders and reducers preserve native results", () =>
{
    for (const input of [ "", "ababa", "😀a", "İSTANBUL", "\n" ])
    {
        for (const name of [ "indexOf", "lastIndexOf" ] as const)
        {
            Assert.deepEqual(outcome(() => S[name]("a")(input)), outcome(() => US[name]("a")(input)));
        }

        Assert.deepEqual(outcome(() => S.match(/a/)(input)), outcome(() => US.match(/a/)(input)));
        Assert.deepEqual(outcome(() => S.matchAll(/a/g)(input)), outcome(() => US.matchAll(/a/g)(input)));
        Assert.deepEqual(outcome(() => S.matchAll(/a/)(input)), outcome(() => US.matchAll(/a/)(input)));
        Assert.equal(S.toLocaleLowerCase("tr")(input), US.toLocaleLowerCase("tr")(input));
        Assert.equal(S.toLocaleUpperCase("tr")(input), US.toLocaleUpperCase("tr")(input));
        Assert.equal(S.localeCompare("a")(input), US.localeCompare("a")(input));
        Assert.equal(S.Order(input, "a"), US.Order(input, "a"));
        Assert.equal(S.Equivalence(input, "a"), US.Equivalence(input, "a"));
        Assert.equal(S.ReducerConcat.combine(input, "a"), US.ReducerConcat.combine(input, "a"));
    }

    Assert.equal(S.String(42), US.String(42));
    Assert.equal(S.empty, US.empty);
});

test("Predicate and String runtime dependency closure ships only local relative modules", () =>
{
    const visited = new Set<string>();
    const visit = (url: URL): void =>
    {
        if (visited.has(url.href))
        {
            return;
        }

        visited.add(url.href);
        const source = TypeScript.createSourceFile(url.pathname, readFileSync(url, "utf8"), TypeScript.ScriptTarget.Latest, true);
        for (const statement of source.statements)
        {
            if ((TypeScript.isImportDeclaration(statement) || TypeScript.isExportDeclaration(statement)) && statement.moduleSpecifier)
            {
                const specifier = (statement.moduleSpecifier as TypeScript.StringLiteral).text;
                Assert.ok(specifier.startsWith("./") || specifier.startsWith("../"), specifier);
                Assert.ok(specifier.endsWith(".js"), specifier);
                visit(new URL(specifier, url));
            }
        }
    };

    for (const name of Names)
    {
        visit(new URL(import.meta.resolve(`@bedform/effect/${name}`)));
    }
});

test("Predicate and String declarations and emitted algorithms match pinned upstream", () =>
{
    const printer = TypeScript.createPrinter({ removeComments: true });
    const canonical = (text: string): string =>
    {
        text = text.replaceAll("CarriageReturn", "CR").replaceAll("LineFeed", "LF").replaceAll("CONFIG_SPLIT_REGEXP", "ConfigSplitRegExp").replaceAll("SPLIT_REGEXP", "SplitRegExp").replaceAll("STRIP_REGEXP", "StripRegExp");
        const file = TypeScript.createSourceFile("module.ts", text.replaceAll(".ts\"", ".js\"")
            .replaceAll("/Internal/", "/internal/")
            .replaceAll("/Encoding/", "/encoding/")
            .replaceAll("/Schema/", "/schema/"), TypeScript.ScriptTarget.Latest, true);
        const statements = file.statements;
        const imports = statements.filter(TypeScript.isImportDeclaration).map((node) => printer.printNode(TypeScript.EmitHint.Unspecified, node, file)).sort();
        const rest = statements.filter((node) => !TypeScript.isImportDeclaration(node)).map((node) => printer.printNode(TypeScript.EmitHint.Unspecified, node, file));
        const syntax = TypeScript.createSourceFile("canonical.ts", [ ...imports, ...rest ].join("\n"), TypeScript.ScriptTarget.Latest, true);
        // Repository formatting adds braces to upstream's single-statement if branches.
        const blocks = TypeScript.transform(syntax, [ (context) =>
        {
            const visit = (node: TypeScript.Node): TypeScript.VisitResult<TypeScript.Node> =>
            {
                if (TypeScript.isParenthesizedExpression(node))
                {
                    return TypeScript.visitNode(node.expression, visit);
                }

                if (TypeScript.isIfStatement(node))
                {
                    const branch = TypeScript.visitNode(node.thenStatement, visit) as TypeScript.Statement;
                    return context.factory.updateIfStatement(node, node.expression, TypeScript.isBlock(branch) ? branch : context.factory.createBlock([ branch ]), TypeScript.visitNode(node.elseStatement, visit) as TypeScript.Statement | undefined);
                }

                return TypeScript.visitEachChild(node, visit, context);
            };

            return (root) => TypeScript.visitNode(root, visit) as TypeScript.SourceFile;
        } ]);
        const normalized = TypeScript.createSourceFile("canonical.ts", printer.printFile(blocks.transformed[0]), TypeScript.ScriptTarget.Latest, true);
        blocks.dispose();
        const tokens: Array<string> = [];
        const collect = (node: TypeScript.Node): void =>
        {
            const children = node.getChildren(normalized);
            if (children.length)
            {
                children.forEach(collect);
            }
            else
            {
                tokens.push(`${node.kind}:${node.getText(normalized)}`);
            }
        };

        collect(normalized);
        return JSON.stringify(tokens);
    };

    for (const name of Names)
    {
        const local = new URL(import.meta.resolve(`@bedform/effect/${name}`));
        const upstream = new URL(import.meta.resolve(`effect/${name}`));
        const declarations = (url: URL): string =>
        {
            const source = TypeScript.createSourceFile("module.d.ts", readFileSync(new URL(url.href.replace(/\.js$/, ".d.ts")), "utf8"), TypeScript.ScriptTarget.Latest, true);
            const stripped = TypeScript.transform(source, [ (context) =>
            {
                const visit = (node: TypeScript.Node): TypeScript.VisitResult<TypeScript.Node> | undefined =>
                {
                    if (TypeScript.getJSDocTags(node).some((tag) => tag.tagName.text === "internal"))
                    {
                        return undefined;
                    }

                    return TypeScript.visitEachChild(node, visit, context);
                };

                return (node) => TypeScript.visitNode(node, visit) as TypeScript.SourceFile;
            } ]);
            try
            {
                return canonical(printer.printFile(stripped.transformed[0]));

            }
            finally
            {
                stripped.dispose();

            }
        };

        Assert.equal(declarations(local), declarations(upstream), `${name} declarations`);
        const source = (url: URL): string =>
        {
            const text = readFileSync(url, "utf8").replaceAll(".ts\"", ".js\"")
                .replaceAll("/Internal/", "/internal/")
                .replaceAll("/Encoding/", "/encoding/")
                .replaceAll("/Schema/", "/schema/");
            return canonical(TypeScript.transpileModule(text, { compilerOptions: { target: TypeScript.ScriptTarget.ES2022,
                module: TypeScript.ModuleKind.ESNext,
                removeComments: true } }).outputText);
        };

        const actual = JSON.parse(source(new URL(`../Source/${name}.ts`, import.meta.url))) as Array<string>;
        const expected = JSON.parse(source(new URL(`../src/${name}.ts`, upstream))) as Array<string>;
        const mismatch = actual.findIndex((token, index) => token !== expected[index]);
        Assert.deepEqual(actual.slice(Math.max(0, mismatch - 5), mismatch + 10), expected.slice(Math.max(0, mismatch - 5), mismatch + 10), `${name} algorithm tokens at ${mismatch}`);
        Assert.equal(actual.length, expected.length, `${name} algorithm token count`);
    }
});
