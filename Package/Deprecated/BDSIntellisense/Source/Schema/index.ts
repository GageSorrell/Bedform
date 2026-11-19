/**
 * Schema types, catalog lookup, and the catalog of schemas bundled with this package.
 *
 * @module bds-intellisense/Schema/index
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { BundledReleases, GeneratedSchemas } from "./Generated/Schemas.generated.js";
import { CreateSchemaCatalog, type SchemaCatalog } from "./Catalog.js";
import type { BdsVersion } from "../Version.js";
import type { ServerPropertiesSchema } from "./Types.js";

export * from "./Catalog.js";
export type * from "./Types.js";

/**
 * The schemas read from every BDS release's default `server.properties`, from 1.16.0 onwards.
 *
 * @category Constants
 * @since 1.0.0
 */
export const BundledCatalog: SchemaCatalog = CreateSchemaCatalog(GeneratedSchemas);

/**
 * The version each bundled schema is keyed by, oldest first.
 *
 * @category Constants
 * @since 1.0.0
 */
export const KnownSchemaVersions: ReadonlyArray<BdsVersion> = Object.freeze(
    BundledCatalog.Schemas.map((schema: ServerPropertiesSchema) => schema.Version));

/**
 * The version of the newest bundled schema.
 *
 * @category Constants
 * @since 1.0.0
 */
export const LatestSchemaVersion: BdsVersion = BundledCatalog.Latest.Version;

/**
 * The oldest and newest releases whose default files the bundled schemas were read from.
 *
 * @category Constants
 * @since 1.0.0
 */
export const BundledReleaseRange: Readonly<Record<"Latest" | "Oldest", BdsVersion>> = BundledReleases;
