/**
 * Catalog construction, schema selection by release and setting, and property history.
 *
 * @module bds-intellisense/Test/Catalog.test
 *
 * @file      Catalog.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Catalog, Schemas } from "./Fixture.mts";
import { Schema, Version } from "bds-intellisense";
import Assert from "node:assert/strict";
import { test } from "node:test";

/**
 * Formats the version of the schema chosen for a release.
 */
function Chosen(version: Version.BdsVersion): string
{
    return Version.Format(Schema.SchemaFor(Catalog, version).Version);
}

test("CreateSchemaCatalog sorts schemas oldest first", () =>
{
    Assert.deepEqual(
        Catalog.Schemas.map((schema: Schema.ServerPropertiesSchema) => Version.Format(schema.Version)),
        [ "1.16.0", "1.20.0", "1.26.0" ]);

    Assert.equal(Version.Format(Catalog.Oldest.Version), "1.16.0");
    Assert.equal(Version.Format(Catalog.Latest.Version), "1.26.0");
});

test("CreateSchemaCatalog rejects an empty set and shared versions", () =>
{
    Assert.throws(() => Schema.CreateSchemaCatalog([]), /at least one schema/u);
    Assert.throws(
        () => Schema.CreateSchemaCatalog([ Schemas[0], {
            Properties: [],
            Version: [ 1, 26 ]
        } ]),
        /share version 1\.26/u);
});

test("SchemaFor picks the newest schema not later than the release", () =>
{
    Assert.equal(Chosen([ 1, 12, 0 ]), "1.16.0", "older than every schema");
    Assert.equal(Chosen([ 1, 16, 0 ]), "1.16.0", "exact oldest");
    Assert.equal(Chosen([ 1, 19, 83, 1 ]), "1.16.0", "between the first two");
    Assert.equal(Chosen([ 1, 20 ]), "1.20.0", "exact match with fewer parts");
    Assert.equal(Chosen([ 1, 25, 99 ]), "1.20.0", "just before the latest");
    Assert.equal(Chosen([ 1, 26, 63, 1 ]), "1.26.0", "newer than every schema");
});

test("SchemaForSetting reads latest in any case, versions, and nothing else", () =>
{
    Assert.equal(Schema.SchemaForSetting(Catalog, "latest"), Catalog.Latest);
    Assert.equal(Schema.SchemaForSetting(Catalog, " LATEST "), Catalog.Latest);
    Assert.equal(Schema.SchemaForSetting(Catalog, "1.21.0"), Catalog.Schemas[1]);
    Assert.equal(Schema.SchemaForSetting(Catalog, "newest"), undefined);
});

test("FindProperty finds keys exactly", () =>
{
    Assert.equal(Schema.FindProperty(Catalog.Latest, "transport")?.Key, "transport");
    Assert.equal(Schema.FindProperty(Catalog.Latest, "Transport"), undefined);
    Assert.equal(Schema.FindProperty(Catalog.Oldest, "transport"), undefined);
});

test("PropertyHistory lists the runs of schemas that define a key", () =>
{
    Assert.equal(Schema.FormatHistory(Schema.PropertyHistory(Catalog, "gamemode")), "1.16.0 and later");
    Assert.equal(Schema.FormatHistory(Schema.PropertyHistory(Catalog, "transport")), "1.26.0 and later");
    Assert.equal(
        Schema.FormatHistory(Schema.PropertyHistory(Catalog, "legacy-option")),
        "1.16.0 until 1.20.0");

    Assert.deepEqual(Schema.PropertyHistory(Catalog, "no-such-key"), []);
});
