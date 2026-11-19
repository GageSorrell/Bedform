/**
 * The bundled catalog against the default files it was generated from and the installed server.
 *
 * @module bds-intellisense/Test/Bundled.test
 *
 * @file      Bundled.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Path from "node:path";
import { Analysis, Detection, Parser, Schema, Version } from "bds-intellisense";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import Assert from "node:assert/strict";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

/** The folder holding this package's `package.json`. */
const PackageRoot: string = Path.resolve(import.meta.dirname, "..");

/** The downloaded default files. */
const PristineDirectory: string = Path.join(PackageRoot, "Data", "Pristine");

/** The machine's BDS installation, used when present. */
const InstalledProperties: string = "C:\\MineCraft\\Server\\server.properties";

/** The bundled catalog. */
const Catalog: Schema.SchemaCatalog = Schema.BundledCatalog;

/**
 * Formats the version of the bundled schema chosen for a release.
 */
function Chosen(version: Version.BdsVersion): string
{
    return Version.Format(Schema.SchemaFor(Catalog, version).Version);
}

/**
 * The bundled schema chosen for a release, given as text.
 */
function SchemaAt(text: string): Schema.ServerPropertiesSchema
{
    return Schema.SchemaFor(Catalog, Version.Parse(text)!);
}

test("the bundled catalog spans 1.16.0 to the newest downloaded release", () =>
{
    Assert.equal(Version.Format(Catalog.Oldest.Version), "1.16.0");
    Assert.equal(Version.Format(Schema.BundledReleaseRange.Oldest), "1.16.0.2");
    Assert.ok(Version.Compare(Schema.BundledReleaseRange.Latest, [ 1, 26, 63, 1 ]) >= 0);
    Assert.equal(Schema.KnownSchemaVersions.length, Catalog.Schemas.length);
    Assert.deepEqual(Schema.LatestSchemaVersion, Catalog.Latest.Version);
});

test("three-part pack versions pick the same schema as four-part executable versions", () =>
{
    Assert.equal(Chosen([ 1, 26, 60 ]), Chosen([ 1, 26, 60, 6 ]));
    Assert.equal(Chosen([ 1, 26, 63 ]), Chosen([ 1, 26, 63, 1 ]));
    Assert.equal(Chosen([ 1, 12, 0 ]), "1.16.0");
});

test("every downloaded default file is valid under the schema chosen for its release", () =>
{
    const files: Array<string> = readdirSync(PristineDirectory).filter((name: string) =>
        name.endsWith(".properties"));

    Assert.ok(files.length >= 170, `${files.length} default files`);
    for (const name of files)
    {
        const text: string = readFileSync(Path.join(PristineDirectory, name), "utf8");
        const schema: Schema.ServerPropertiesSchema = SchemaAt(name.replace(/\.properties$/u, ""));
        const diagnostics: Array<Analysis.Diagnostic> =
            Analysis.Validate(Parser.ParseDocument(text), schema, Catalog);

        Assert.deepEqual(diagnostics.map((diagnostic: Analysis.Diagnostic) => diagnostic.Message), [], name);
    }
});

test("property histories follow the releases that changed them", () =>
{
    const history: (key: string) => string = (key: string) =>
        Schema.FormatHistory(Schema.PropertyHistory(Catalog, key));

    Assert.match(history("white-list"), /^1\.16\.0 until \d/u);
    Assert.match(history("allow-list"), /^\d+\.\d+\.\d+ and later$/u);
    Assert.match(history("transport"), /^1\.26\.\d+ and later$/u);

    const udp: (version: string) => Schema.PropertySchema | undefined = (version: string) =>
        Schema.FindProperty(SchemaAt(version), "server-udp-ports");

    Assert.equal(udp("1.26.30.5")?.Repeatable, true);
    Assert.equal(udp("1.26.63.1")?.Repeatable, false);
    Assert.equal(udp("1.26.63.1")?.Type.Kind, "String");

    const movement: Schema.PropertySchema | undefined =
        Schema.FindProperty(SchemaAt("1.21.50.7"), "server-authoritative-movement");

    Assert.ok(movement?.Type.Kind === "Enum" && movement.Type.Values.includes("default"), "shipped default");
});

test("the installed server.properties has no errors under its detected release", {
    skip: !existsSync(InstalledProperties)
}, async () =>
{
    const detected: Detection.DetectedVersion | undefined =
        await Detection.DetectServerVersion(InstalledProperties);
    Assert.ok(detected !== undefined);

    const schema: Schema.ServerPropertiesSchema = Schema.SchemaFor(Catalog, detected.Version);
    const diagnostics: Array<Analysis.Diagnostic> = Analysis.Validate(
        Parser.ParseDocument(readFileSync(InstalledProperties, "utf8")),
        schema,
        Catalog);

    Assert.deepEqual(
        diagnostics
            .filter((diagnostic: Analysis.Diagnostic) => diagnostic.Severity === "Error")
            .map((diagnostic: Analysis.Diagnostic) => diagnostic.Message),
        []);
});

test("the generated module is up to date with the default files and overrides", () =>
{
    const result: ReturnType<typeof spawnSync> = spawnSync(
        process.execPath,
        [ "--import", "tsx", Path.join("Tool", "generate.mts"), "--check" ],
        {
            cwd: PackageRoot,
            encoding: "utf8"
        });

    Assert.equal(result.status, 0, `${String(result.stdout)}${String(result.stderr)}`);
});
