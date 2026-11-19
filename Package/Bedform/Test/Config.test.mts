/**
 * Configuration boundary, default, branding, and generated metadata verification.
 *
 * @module bedform/Test/Config.test
 *
 * @file      Config.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixtures retain domain order and contextual typing. */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */

import { Ajv2020 } from "ajv/dist/2020.js";
import Assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import * as Schema from "effect/Schema";
import { BedformConfig, JsonSchemaUrl, TypeId, stringifyConfig } from "../Distribution/Config.js";
import { BedformJsonConfigSchema } from "../Source/ConfigSchema.js";

const Physics: BedformConfig.Physics = {
    schemaVersion: 1,
    namespace: "example",
    behaviorPack: "behavior_packs/example",
    resourcePack: "resource_packs/example",
    models: [ { name: "cube",
        representation: "cuboid",
        geometry: "models/cube.geo.json",
        geometryIdentifier: "geometry.cube",
        materials: { default: "entity_alphatest" },
        textures: { default: "textures/cube" },
        mass: 2,
        collision: { kind: "compound",
            children: [ { kind: "box",
                halfExtents: { x: 1,
                    y: 1,
                    z: 1 },
                pose: { position: { x: 0,
                    y: 0,
                    z: 0 },
                rotation: { x: 0,
                    y: 0,
                    z: 0,
                    w: 1 } } } ] } },
    { name: "mesh",
        representation: "particle",
        meshSolid: "mesh.json",
        rendererDescriptor: "renderer.json",
        density: 3 } ]
};

test("constructor supplies isolated defaults and a registry symbol without mutating input", () =>
{
    const Input = Object.freeze({ DDUI: Object.freeze({}) });
    const Config = BedformConfig(Input);
    Assert.deepEqual(Config.DDUI, { StrictMode: false });
    Assert.deepEqual(Config.Development, { AllowDevelopmentModulesInProduction: false });
    Assert.deepEqual(Input, { DDUI: {} });
    Assert.equal(BedformConfig({}).DDUI?.StrictMode, false);
    Assert.notEqual(Config.DDUI, BedformConfig({}).DDUI);
    Assert.equal(TypeId, Symbol.for("~bedform/Config"));
    Assert.equal(Config[TypeId], TypeId);
    Assert.deepEqual(Object.getOwnPropertyDescriptor(Config, TypeId), {
        value: TypeId,
        writable: false,
        enumerable: false,
        configurable: false
    });
    Assert.deepEqual(Object.keys(Config), [ "DDUI", "Development" ]);
    Assert.deepEqual(Object.getOwnPropertySymbols({ ...Config }), []);
    Assert.equal(JSON.stringify(Config), "{\"DDUI\":{\"StrictMode\":false},\"Development\":{\"AllowDevelopmentModulesInProduction\":false}}");
});

test("all project sections preserve values and existing physics registration shapes", () =>
{
    const Input = { DDUI: { StrictMode: true },
        Development: { AllowDevelopmentModulesInProduction: true },
        Physics,
        build: {
            behaviorPacks: [ "BP" ],
            resourcePacks: [ "RP" ],
            scripts: [ { entry: "Script/main.tsx",
                output: "scripts/main.js" } ]
        } };
    Assert.deepEqual(JSON.parse(JSON.stringify(BedformConfig(Input))), Input);
    Assert.deepEqual(BedformConfig({ Physics }).Physics, Physics);
});

test("generated JSON includes the published schema hint and validates independently", async () =>
{
    const Json = JSON.parse(await readFile(new URL("../bedform.config.schema.json", import.meta.url), "utf8"));
    const Validate = new Ajv2020().compile(Json);
    const Text = stringifyConfig({ Physics });
    const Config = JSON.parse(Text);
    Assert.ok(Text.endsWith("\n"));
    Assert.equal(Config.$schema, JsonSchemaUrl);
    Assert.match(JsonSchemaUrl, /^https:\/\/gist\.githubusercontent\.com\/[^/]+\/[^/]+\/raw\/[a-f0-9]{40}\//u);
    Assert.equal(Config.DDUI.StrictMode, false);
    Assert.equal(Config.Development.AllowDevelopmentModulesInProduction, false);
    Assert.equal(Validate(Config), true, JSON.stringify(Validate.errors));
    Assert.throws(() => stringifyConfig({ DDUI: { StrictMode: "false" } } as unknown as BedformConfig.Input));
});

test("Canvas image metadata agrees between editor schema and runtime configuration", async () =>
{
    const Json = JSON.parse(await readFile(new URL("../bedform.config.schema.json", import.meta.url), "utf8"));
    const Validate = new Ajv2020().compile(Json);
    const Canvas = { Namespace: "example",
        ResourcePack: "resource_packs/main",
        Images: [ { Name: "Spinner",
            Source: "Asset/strip.png",
            FrameCount: 3,
            FrameTicks: 4 } ] };
    Assert.equal(Validate({ Canvas }), true, JSON.stringify(Validate.errors));
    Assert.deepEqual(BedformConfig({ Canvas }).Canvas, Canvas);
    for (const Image of [ { ...Canvas.Images[0],
        FrameCount: 0 }, { ...Canvas.Images[0],
        FrameCount: 1.5 },
    { ...Canvas.Images[0],
        FrameTicks: "4" }, { ...Canvas.Images[0],
        Name: "../bad" } ])
    {
        const Value = { Canvas: { ...Canvas,
            Images: [ Image ] } };
        Assert.equal(Validate(Value), false);
        Assert.throws(() => BedformConfig(Value as never));
    }
});

test("invalid settings fail at the boundary without coercion or unknown-key stripping", () =>
{
    for (const Input of [ null, [], "config", { unknown: true }, { $schema: "editor-only" },
        { DDUI: { StrictMode: "false" } }, { DDUI: { StrictMode: undefined } }, { DDUI: { strictMode: true } },
        { Development: { AllowDevelopmentModulesInProduction: "false" } },
        { Development: { AllowDevelopmentModulesInProduction: undefined } },
        { Development: { allowDevelopmentModulesInProduction: true } },
        { build: { scripts: [ { entry: "",
            output: "scripts/main.js" } ] } },
        { Physics: { ...Physics,
            schemaVersion: 2 } }, { Physics: { ...Physics,
            namespace: "minecraft" } },
        { Physics: { ...Physics,
            models: [] } },
        { Physics: { ...Physics,
            models: [ { ...Physics.models[0],
                density: 1,
                mass: 2 } ] } },
        { Physics: { ...Physics,
            models: [ { ...Physics.models[0],
                mass: NaN } ] } },
        { Physics: { ...Physics,
            models: [ { ...Physics.models[0],
                collision: { kind: "compound",
                    children: [] } } ] } } ])
    {
        Assert.throws(() => BedformConfig(Input as BedformConfig.Input), Error);
    }
});

test("editor schema is generated from the same boundary and retains descriptions and references", async () =>
{
    const Actual = JSON.parse(await readFile(new URL("../bedform.config.schema.json", import.meta.url), "utf8"));
    const Document = Schema.toJsonSchemaDocument(BedformJsonConfigSchema, { onExcessProperty: "error" });
    Assert.equal(Actual.$defs.DDUI.properties.StrictMode.default, false);
    Assert.equal(Actual.$defs.Development.properties.AllowDevelopmentModulesInProduction.default, false);
    Assert.match(Actual.$defs.DDUI.properties.StrictMode.description, /diagnostics/u);
    Assert.equal(Actual.additionalProperties, false);
    Assert.deepEqual(Actual, { $schema: "https://json-schema.org/draft/2020-12/schema",
        ...Document.schema,
        $defs: Document.definitions });
    const Decode = Schema.decodeUnknownSync(BedformJsonConfigSchema, { onExcessProperty: "error" });
    Assert.deepEqual(Decode({ $schema: "https://example.com/schema.json",
        Physics }), { $schema: "https://example.com/schema.json",
        Physics });
});

test("Draft 2020-12 editor validation agrees with Effect for accepted and rejected JSON", async () =>
{
    const Json = JSON.parse(await readFile(new URL("../bedform.config.schema.json", import.meta.url), "utf8"));
    const Validate = new Ajv2020({ allErrors: true,
        strict: true }).compile(Json);
    const Decode = Schema.decodeUnknownSync(BedformJsonConfigSchema, { onExcessProperty: "error" });
    for (const Input of [ {}, { $schema: "https://example.com/schema.json" }, { DDUI: {} },
        { Development: {} }, { Development: { AllowDevelopmentModulesInProduction: true } },
        { Development: { AllowDevelopmentModulesInProduction: false } },
        { Development: { AllowDevelopmentModulesInProduction: "false" } },
        { DDUI: { StrictMode: false },
            Physics }, { build: { scripts: [ { entry: "main.tsx",
            output: "main.js" } ] } },
        null, [], { DDUI: { StrictMode: "false" } }, { build: { scripts: [ { entry: "main.ts" } ] } },
        { Physics: { ...Physics,
            models: [ { ...Physics.models[0],
                mass: 0 } ] } },
        { Physics: { ...Physics,
            models: [ { ...Physics.models[1],
                mass: 1 } ] } },
        { Physics: { ...Physics,
            models: [ { ...Physics.models[0],
                collision: { kind: "compound",
                    children: [] } } ] } },
        { Physics: { ...Physics,
            namespace: "minecraft" } }, { Physics: { ...Physics,
            unknown: true } } ])
    {
        let Accepted = true;
        try
        {
            Decode(Input);
        }
        catch
        {
            Accepted = false;
        }

        Assert.equal(Validate(Input), Accepted, JSON.stringify({ Input,
            errors: Validate.errors }));
    }
});
