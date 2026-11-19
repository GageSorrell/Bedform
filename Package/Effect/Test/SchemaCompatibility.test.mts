/**
 * Checks the pinned upstream Schema subset contract before implementation.
 *
 * @module @bedform/effect/Test/SchemaCompatibility.test
 *
 * @file      SchemaCompatibility.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { SchemaModules, inventorySchema, readSchemaUpstream } from "./SchemaInventory.mjs";
import Assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/* Fixtures use the test runner and compiler visitor contextual types. */
/* eslint @typescript-eslint/typedef: "off" */

/**
 * A machine-readable compatibility decision for an upstream declaration path.
 *
 * @category Types
 * @since 1.0.0
 */
interface Entry
{
    name: string;
    kind: "export" | "member";
    status: "retained" | "adapted" | "omitted";
    reason: string;
    localName?: string;
}

/**
 * The checked contract and source fingerprints.
 *
 * @category Types
 * @since 1.0.0
 */
interface Manifest
{
    upstream: string;
    modules: Record<string, ReadonlyArray<Entry>>;
    sources: Record<string, string>;
}

const ContractPath = new URL("../SchemaCompatibility.json", import.meta.url);
const Contract = JSON.parse(readFileSync(ContractPath, "utf8")) as Manifest;

test("Schema compatibility manifest accounts for every pinned export, member and annotation hook", () =>
{
    Assert.equal(Contract.upstream, "effect@4.0.5");
    Assert.deepEqual(Object.keys(Contract.modules), SchemaModules);
    for (const module of SchemaModules)
    {
        const Source = readSchemaUpstream(module);
        Assert.equal(Contract.sources[module], createHash("sha256").update(Source).digest("hex"), module);
        const Actual = Contract.modules[module];
        Assert.deepEqual(Actual.map(({ name, kind }) => ({ kind,
            name })), inventorySchema(Source), module);
        Assert.equal(new Set(Actual.map((entry) => entry.name)).size, Actual.length, module);
        for (const entry of Actual)
        {
            Assert.ok([ "retained", "adapted", "omitted" ].includes(entry.status), entry.name);
            Assert.ok(entry.reason.length > 20, entry.name);
            if (entry.localName)
            {
                Assert.equal(entry.status, "adapted", entry.name);
            }
        }
    }
});

test("Schema contract covers the approved constructors, synchronous adapters and omissions", () =>
{
    const Schemas = new Map(Contract.modules.Schema.map((entry) => [ entry.name, entry ]));
    for (const name of [
        "String", "Number", "Boolean", "Struct", "Record", "Tuple", "Union", "suspend", "brand",
        "fromBrand", "Date", "RegExp", "ReadonlyMap", "ReadonlySet", "Uint8Array", "Option", "Result",
        "Chunk", "HashMap", "HashSet", "BigDecimal", "ByteSize", "Duration", "Redacted", "Json",
        "Class", "TaggedClass", "Error", "TaggedError", "SchemaError", "declareConstructor",
        "decodeUnknownSync", "decodeUnknownResult", "decodeUnknownOption", "encodeUnknownSync",
        "encodeUnknownResult", "encodeUnknownOption", "toFormatter", "toEquivalence", "toCodecJson",
        "toJsonSchemaDocument", "toStandardSchemaV1", "toStandardJSONSchemaV1"
    ])
    {
        Assert.notEqual(Schemas.get(name)?.status, "omitted", name);
        Assert.ok(Schemas.has(name), name);
    }

    for (const name of [ "decodeUnknownEffect", "decodeUnknownExit", "decodeUnknownPromise", "URL", "File",
        "FormData", "DateTimeUtc", "Graph", "middlewareDecoding", "catchDecodingWithContext", "toIso",
        "toEncoderXml", "toDifferJsonPatch", "toRepresentation" ])
    {
        Assert.equal(Schemas.get(name)?.status, "omitted", name);
    }

    for (const name of [ "withConstructorDefault", "withDecodingDefaultKey", "withDecodingDefaultTypeKey",
        "withDecodingDefault", "withDecodingDefaultType" ])
    {
        Assert.equal(Schemas.get(name)?.status, "adapted", name);
        Assert.match(Schemas.get(name)!.reason, /lazy/);
    }

    for (const name of [ "transformEffect", "transformOptionalEffect", "checkEffect" ])
    {
        const Getter = Contract.modules.SchemaGetter.find((entry) => entry.name === name)!;
        Assert.equal(Getter.localName, name.replace("Effect", "Result"));
        Assert.equal(Getter.status, "adapted");
    }
});
