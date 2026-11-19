/**
 * Differential tests for the pure dependencies of the synchronous Schema port.
 *
 * @module @bedform/effect/Test/SchemaDependencies.test
 *
 * @file      SchemaDependencies.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Base64 from "../Distribution/Encoding/Base64.js";
import * as Base64Url from "../Distribution/Encoding/Base64Url.js";
import * as BigDecimal from "../Distribution/BigDecimal.js";
import * as Chunk from "../Distribution/Chunk.js";
import * as Data from "../Distribution/Data.js";
import * as HashMap from "../Distribution/HashMap.js";
import * as HashSet from "../Distribution/HashSet.js";
import * as Hex from "../Distribution/Encoding/Hex.js";
import * as Redacted from "../Distribution/Redacted.js";
import * as Result from "../Distribution/Result.js";
import * as Root from "@bedform/effect";
import * as UpstreamBase64 from "effect/encoding/Base64";
import * as UpstreamBase64Url from "effect/encoding/Base64Url";
import * as UpstreamBigDecimal from "effect/BigDecimal";
import * as UpstreamChunk from "effect/Chunk";
import * as UpstreamHashMap from "effect/HashMap";
import * as UpstreamHashSet from "effect/HashSet";
import * as UpstreamHex from "effect/encoding/Hex";
import * as UpstreamRedacted from "effect/Redacted";
import { decodeUtf8, encodeUtf8 } from "../Distribution/Internal/utf8.js";
import Assert from "node:assert/strict";
import { EncodingError } from "../Distribution/Encoding/EncodingError.js";
import TypeScript from "typescript";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

/* Callbacks retain contextual types from the differential fixtures. */
/* eslint @typescript-eslint/typedef: "off" */

test("UTF-8 encoding matches unpaired surrogate replacement and Unicode boundaries", () =>
{
    const encoder = new TextEncoder();
    const inputs = [ "", "ASCII", "é", "中文", "😀", "\uFEFFx", "\uD800", "\uDC00", "\uD800x\uDC00" ];
    for (let point = 0; point <= 0x10FFFF; point += 997)
    {
        inputs.push(String.fromCodePoint(point));
    }

    for (let point = 0xD7F0; point < 0xE010; point++)
    {
        inputs.push(String.fromCharCode(point));
    }

    for (const input of inputs)
    {
        Assert.deepEqual(encodeUtf8(input), encoder.encode(input));
    }
});

test("UTF-8 decoding matches every one/two byte input and adversarial longer sequences", () =>
{
    const decoder = new TextDecoder();
    for (let first = 0; first < 256; first++)
    {
        Assert.equal(decodeUtf8(Uint8Array.of(first)), decoder.decode(Uint8Array.of(first)));
        for (let second = 0; second < 256; second++)
        {
            const bytes = Uint8Array.of(first, second);
            Assert.equal(decodeUtf8(bytes), decoder.decode(bytes));
        }
    }

    const sequences = [
        [], [ 0xEF, 0xBB, 0xBF ], [ 0xEF, 0xBB, 0xBF, 0xEF, 0xBB, 0xBF ],
        [ 0xE0, 0x80, 0x80 ], [ 0xED, 0xA0, 0x80 ], [ 0xF4, 0x90, 0x80, 0x80 ],
        [ 0xF0, 0x90, 0x80 ], [ 0xF0, 0x90, 0x41, 0x80 ], [ 0xE2, 0x82, 0x41 ]
    ];
    let seed = 42;
    for (let index = 0; index < 20000; index++)
    {
        const bytes: Array<number> = [];
        for (let offset = 0; offset < 8; offset++)
        {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            bytes.push(seed >>> 24);
        }

        sequences.push(bytes);
    }

    for (const sequence of sequences)
    {
        const bytes = Uint8Array.from(sequence);
        Assert.equal(decodeUtf8(bytes), decoder.decode(bytes), sequence.join(","));
    }
});

test("Base64, Base64Url and Hex preserve pinned codec behavior and Data errors", () =>
{
    const codecs = [
        [ Base64, UpstreamBase64 ], [ Base64Url, UpstreamBase64Url ], [ Hex, UpstreamHex ]
    ] as const;
    const inputs = [
        "", "hello", "é😀\uD800", "\uFEFFbom", Uint8Array.from({ length: 256 }, (_, index) => index)
    ];
    const invalid = [
        "=", "==", "===", "!", "a", "ab", "abc", "ab=c", "00zz", "SGV sbG8=", "-_8=", "AA==\n"
    ];
    for (const [ local, upstream ] of codecs)
    {
        for (const input of inputs)
        {
            const encoded = local.encode(input);
            Assert.equal(encoded, upstream.encode(input));
            for (const candidate of [ encoded, ...invalid ])
            {
                const actual = local.decode(candidate);
                const expected = upstream.decode(candidate);
                Assert.equal(actual._tag, expected._tag);
                if (Result.isSuccess(actual) && expected._tag === "Success")
                {
                    Assert.deepEqual(actual.success, expected.success);
                }
                else if (Result.isFailure(actual) && expected._tag === "Failure")
                {
                    Assert.ok(actual.failure instanceof EncodingError);
                    Assert.ok(actual.failure instanceof Data.Error);
                    Assert.deepEqual(
                        JSON.parse(JSON.stringify(actual.failure)),
                        JSON.parse(JSON.stringify(expected.failure))
                    );
                }

                const decoded = local.decodeString(candidate);
                const expectedString = upstream.decodeString(candidate);
                if (Result.isSuccess(decoded) && expectedString._tag === "Success")
                {
                    Assert.equal(decoded.success, expectedString.success);
                }
                else
                {
                    Assert.equal(decoded._tag, expectedString._tag);
                }
            }
        }
    }
});

test("pure dependencies preserve complete runtime export sets", async () =>
{
    const names = [
        "BigDecimal", "BigInt", "ByteSize", "Chunk", "Duration", "HashMap", "HashSet",
        "NonEmptyIterable", "Redacted", "RegExp"
    ];
    for (const name of names)
    {
        const local = await import(`../Distribution/${name}.js`);
        const upstream = await import(`effect/${name}`);
        Assert.deepEqual(Object.keys(local).sort(), Object.keys(upstream).sort(), name);
        Assert.strictEqual((Root as unknown as Record<string, unknown>)[name], local);
        Assert.strictEqual(await import(`@bedform/effect/${name}`), local);
    }
});

test("complete pure dependency declarations preserve upstream signatures", () =>
{
    const Printer = TypeScript.createPrinter({ removeComments: true });
    const normalize = (url: URL): string =>
    {
        const Source = readFileSync(url, "utf8")
            .replaceAll(".ts\"", ".js\"")
            .replaceAll("/Internal/", "/internal/")
            .replaceAll("/Encoding/", "/encoding/")
            .replaceAll("/Schema/", "/schema/")
            .replaceAll("./internal/brand.js", "./Brand.js")
            .replaceAll("./internal/filter.js", "./Filter.js")
            .replaceAll("infer _V", "infer _").replaceAll("infer _K", "infer _")
            .replace(/\? _K\b/g, "? _").replace(/\? _V\b/g, "? _");
        const File = TypeScript.createSourceFile(url.pathname, Source, TypeScript.ScriptTarget.Latest, true);
        const Transformed = TypeScript.transform(File, [ (context) =>
        {
            const visit = (node: TypeScript.Node): TypeScript.VisitResult<TypeScript.Node> | undefined =>
            {
                // Upstream publishes declarations with stripInternal; runtime parity is checked separately.
                if (TypeScript.getJSDocTags(node).some((tag) => tag.tagName.text === "internal"))
                {
                    return undefined;
                }

                if (TypeScript.isModuleDeclaration(node) && node.name.text === "Chunk" &&
                    node.body && TypeScript.isModuleBlock(node.body) &&
                    node.body.statements.some((statement) =>
                        TypeScript.isInterfaceDeclaration(statement) && statement.name.text === "TypeId"))
                {
                    return undefined;
                }

                if (TypeScript.isTypeReferenceNode(node) && node.typeName.getText(File) === "Chunk.TypeId")
                {
                    return TypeScript.factory.createTypeLiteralNode([
                        TypeScript.factory.createPropertySignature(
                            [ TypeScript.factory.createModifier(TypeScript.SyntaxKind.ReadonlyKeyword) ],
                            "_A", undefined,
                            TypeScript.factory.createTypeReferenceNode("Covariant", node.typeArguments)
                        )
                    ]);
                }

                return TypeScript.visitEachChild(node, visit, context);
            };

            return (root) => TypeScript.visitNode(root, visit) as TypeScript.SourceFile;
        } ]);
        try
        {
            return Printer.printFile(Transformed.transformed[0]);
        }
        finally
        {
            Transformed.dispose();
        }
    };

    for (const name of [ "BigDecimal", "BigInt", "ByteSize", "Chunk", "Duration", "HashMap", "HashSet",
        "NonEmptyIterable", "Redacted", "RegExp" ])
    {
        const Local = new URL(`../Distribution/${name}.d.ts`, import.meta.url);
        const Upstream = new URL(import.meta.resolve(`effect/${name}`).replace(/\.js$/, ".d.ts"));
        Assert.equal(normalize(Local), normalize(Upstream), name);
    }
});

test("dependency bundle executes without Web text or URL globals and has only local inputs", async () =>
{
    const Bundle = await build({
        bundle: true,
        format: "iife",
        globalName: "Foundation",
        metafile: true,
        platform: "neutral",
        stdin: {
            contents: `
                import * as Base64 from './Distribution/Encoding/Base64.js';
                import * as Hex from './Distribution/Encoding/Hex.js';
                import * as Chunk from './Distribution/Chunk.js';
                import * as HashMap from './Distribution/HashMap.js';
                import * as Redacted from './Distribution/Redacted.js';
                export function run() {
                    const encoded = Base64.encode('é😀\\uD800');
                    const decoded = Base64.decodeString(encoded);
                    if (decoded._tag !== 'Success') throw decoded.failure;
                    const redacted = Redacted.make('secret');
                    const values = Chunk.toArray(Chunk.make(1, 2, 3));
                    const size = HashMap.size(HashMap.make(['x', 1]));
                    return JSON.stringify([
                        decoded.success, Hex.encode('ok'), values, size, String(redacted)
                    ]);
                }`,
            resolveDir: fileURLToPath(new URL("../", import.meta.url))
        },
        target: "es2022",
        write: false
    });
    for (const path of Object.keys(Bundle.metafile!.inputs))
    {
        Assert.doesNotMatch(path, /node_modules|Effect\.js|Context\.js|Scheduler\.js|Fiber\.js/);
    }

    const Sandbox: Record<string, unknown> = {
        Buffer: undefined,
        TextDecoder: undefined,
        TextEncoder: undefined,
        URL: undefined,
        URLSearchParams: undefined,
        fetch: undefined,
        process: undefined
    };
    runInNewContext(Bundle.outputFiles[0].text, Sandbox, { timeout: 1000 });
    const Foundation = Sandbox.Foundation as { run(): string };
    Assert.equal(Foundation.run(), JSON.stringify([ "é😀�", "6f6b", [ 1, 2, 3 ], 1, "<redacted>" ]));
});

test("decimal arithmetic and persistent collection protocols match upstream", () =>
{
    for (const [ local, upstream ] of [ [ BigDecimal, UpstreamBigDecimal ] ] as const)
    {
        for (const input of [ "0", "1.2345", "-123456789.00001", "1e20" ])
        {
            const actual = local.fromStringUnsafe(input);
            const expected = upstream.fromStringUnsafe(input);
            Assert.equal(
                local.format(local.multiply(actual, actual)),
                upstream.format(upstream.multiply(expected, expected))
            );
        }
    }

    for (const module of [ Chunk, UpstreamChunk as unknown as typeof Chunk ])
    {
        const original = module.fromIterable([ 1, 2, 3 ]);
        Assert.deepEqual(module.toArray(module.append(original, 4)), [ 1, 2, 3, 4 ]);
        Assert.deepEqual(module.toArray(original), [ 1, 2, 3 ]);
    }

    for (const module of [ HashMap, UpstreamHashMap as unknown as typeof HashMap ])
    {
        const original = module.make([ "x", 1 ]);
        Assert.equal(module.size(module.set(original, "y", 2)), 2);
        Assert.equal(module.size(original), 1);
    }

    for (const module of [ HashSet, UpstreamHashSet as unknown as typeof HashSet ])
    {
        const original = module.make(1, 2, 2);
        Assert.equal(module.size(module.add(original, 3)), 3);
        Assert.equal(module.size(original), 2);
    }

    for (const module of [ Redacted, UpstreamRedacted as unknown as typeof Redacted ])
    {
        const secret = module.make("secret");
        Assert.equal(module.value(secret), "secret");
        Assert.equal(String(secret), "<redacted>");
        module.wipeUnsafe(secret);
        Assert.throws(() => module.value(secret));
    }
});
