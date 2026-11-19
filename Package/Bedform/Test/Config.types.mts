/**
 * Compile-time agreement between generated declarations and the upstream schema.
 *
 * @module bedform/Test/Config.types
 *
 * @file      Config.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as Schema from "effect/Schema";
import { BedformConfig, TypeId } from "../Source/Config.js";
import type { BedformConfigSchema } from "../Source/ConfigSchema.js";
import type { Config as PhysicsConfig } from "../Source/Build/Config.js";

type Assert<Value extends true> = Value;
type Inferred = Schema.Schema.Type<typeof BedformConfigSchema>;
type GeneratedToSchema = Assert<BedformConfig.Input extends Inferred ? true : false>;
type SchemaToGenerated = Assert<Inferred extends BedformConfig.Input ? true : false>;
type ExistingPhysicsToGenerated = Assert<PhysicsConfig extends BedformConfig.Physics ? true : false>;
type GeneratedPhysicsToExisting = Assert<BedformConfig.Physics extends PhysicsConfig ? true : false>;

const Config = BedformConfig({ DDUI: { StrictMode: true },
    build: { scripts: [ { entry: "Script/main.tsx",
        output: "scripts/main.js" } ] } });
const Brand: typeof TypeId = Config[TypeId];
// @ts-expect-error JSON editor hints are excluded from TypeScript inputs.
BedformConfig({ $schema: "https://example.com/schema.json" });
// @ts-expect-error Brands are constructor output only.
BedformConfig({ [TypeId]: TypeId });
// @ts-expect-error StrictMode is boolean.
BedformConfig({ DDUI: { StrictMode: "false" } });
BedformConfig({ Development: { AllowDevelopmentModulesInProduction: true } });
BedformConfig({ Canvas: { Images: [ { FrameCount: 2,
    FrameTicks: 4,
    Name: "Icon",
    Source: "Asset/icon.png" } ],
Namespace: "example",
ResourcePack: "RP" } });
BedformConfig({ Canvas: { Images: [ {
    // @ts-expect-error Canvas frame counts are numeric configuration fields.
    FrameCount: "2",
    Name: "Icon",
    Source: "icon.png" } ],
Namespace: "example" } });
// @ts-expect-error Production permission is an explicit boolean.
BedformConfig({ Development: { AllowDevelopmentModulesInProduction: "true" } });
void (null as unknown as GeneratedToSchema);
void (null as unknown as SchemaToGenerated);
void (null as unknown as ExistingPhysicsToGenerated);
void (null as unknown as GeneratedPhysicsToExisting);
void Brand;
