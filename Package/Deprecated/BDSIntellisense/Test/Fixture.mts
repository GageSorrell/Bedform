/**
 * A small three-release schema catalog for tests, modelled on real BDS properties.
 *
 * In 1.16.0 the catalog has `legacy-option`, which 1.20.0 removes.  Release 1.26.0 adds
 * `transport` and the repeatable `server-udp-ports`.
 *
 * @module bds-intellisense/Test/Fixture
 *
 * @file      Fixture.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Schema } from "bds-intellisense";

/**
 * Properties that every fixture release has.
 *
 * @category Tests
 * @since 1.0.0
 */
export const CommonProperties: ReadonlyArray<Schema.PropertySchema> = [
    {
        AllowedValues: "Any string without semicolon symbol.",
        Default: "Dedicated Server",
        Description: "Used as the server name",
        Key: "server-name",
        Optional: false,
        Repeatable: false,
        Type: {
            Forbidden: ";",
            Kind: "String"
        }
    },
    {
        AllowedValues: "\"survival\", \"creative\", or \"adventure\"",
        Default: "survival",
        Description: "Sets the game mode for new players.",
        Key: "gamemode",
        Optional: false,
        Repeatable: false,
        Type: {
            Kind: "Enum",
            Values: [ "survival", "creative", "adventure" ]
        }
    },
    {
        AllowedValues: "\"true\" or \"false\"",
        Default: "false",
        Description: "If true then cheats like commands can be used.",
        Key: "allow-cheats",
        Optional: false,
        Repeatable: false,
        Type: { Kind: "Boolean" }
    },
    {
        AllowedValues: "Integers in the range [1, 65535]",
        Default: "19132",
        Description: "Which IPv4 port the server should listen to.",
        Key: "server-port",
        Optional: false,
        Repeatable: false,
        Type: {
            Integer: true,
            Kind: "Number",
            Maximum: 65_535,
            Minimum: 1
        }
    },
    {
        AllowedValues: "\"Disabled\" or any value in range [0.0, 1.0]",
        Default: "Disabled",
        Description: "If specified, the server will build chunks around the player.",
        Key: "server-build-radius-ratio",
        Optional: false,
        Repeatable: false,
        Type: {
            Integer: false,
            Keywords: [ "Disabled" ],
            Kind: "Number",
            Maximum: 1,
            Minimum: 0
        }
    }
];

/**
 * A property that only 1.16.0 has.
 *
 * @category Tests
 * @since 1.0.0
 */
export const LegacyOption: Schema.PropertySchema = {
    Default: "true",
    Description: "An option that later releases removed.",
    Key: "legacy-option",
    Optional: false,
    Repeatable: false,
    Type: { Kind: "Boolean" }
};

/**
 * Properties that 1.26.0 adds.
 *
 * @category Tests
 * @since 1.0.0
 */
export const NetherNetProperties: ReadonlyArray<Schema.PropertySchema> = [
    {
        AllowedValues: "\"raknet\" or \"nethernet\"",
        Default: "nethernet",
        Description: "Which transport protocol the server should use.",
        Key: "transport",
        Optional: false,
        Repeatable: false,
        Type: {
            Kind: "Enum",
            Values: [ "raknet", "nethernet" ]
        }
    },
    {
        Description: "Configures UDP client transport ports.\n  * `internal` or `start-end`",
        Key: "server-udp-ports",
        Optional: true,
        Repeatable: true,
        Type: { Kind: "String" }
    }
];

/**
 * The 1.16.0, 1.20.0 and 1.26.0 schemas, passed in a scrambled order to check sorting.
 *
 * @category Tests
 * @since 1.0.0
 */
export const Schemas: ReadonlyArray<Schema.ServerPropertiesSchema> = [
    {
        Properties: [ ...CommonProperties, ...NetherNetProperties ],
        Version: [ 1, 26, 0 ]
    },
    {
        Properties: [ ...CommonProperties, LegacyOption ],
        Version: [ 1, 16, 0 ]
    },
    {
        Properties: CommonProperties,
        Version: [ 1, 20, 0 ]
    }
];

/**
 * The fixture catalog.
 *
 * @category Tests
 * @since 1.0.0
 */
export const Catalog: Schema.SchemaCatalog = Schema.CreateSchemaCatalog(Schemas);
