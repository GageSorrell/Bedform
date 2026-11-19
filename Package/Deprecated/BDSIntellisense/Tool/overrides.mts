/**
 * Hand-written corrections that the schema generator applies after reading the default files.
 *
 * The generator types each property from its `Allowed values` comment, or from its default value
 * when there is none.  Overrides supply what the comments only say in prose, such as the choices
 * of `script-debugger-auto-attach`, or bounds stated as `(default = 100, max = 2000)`.  An
 * override applies to every release from `From` up to but excluding `Until`.
 *
 * @module bds-intellisense/Tool/overrides
 *
 * @file      overrides.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { BdsVersion } from "../Source/Version.ts";
import type { PropertyType } from "../Source/Schema/Types.ts";

/**
 * Replacement fields for one property in a range of releases.
 *
 * @category Tools
 * @since 1.0.0
 */
export interface PropertyOverride
{
    readonly AllowedValues?: string;
    readonly From?: BdsVersion;
    readonly Key: string;
    readonly Repeatable?: boolean;
    readonly Type?: PropertyType;
    readonly Until?: BdsVersion;
}

/** Integer ports. */
const Port: PropertyType = {
    Integer: true,
    Kind: "Number",
    Maximum: 65_535,
    Minimum: 1
};

/** Watchdog memory thresholds in megabytes; zero disables them. */
const WatchdogMemory: PropertyType = {
    Integer: true,
    Kind: "Number",
    Maximum: 2000,
    Minimum: 0
};

/** Non-negative decimal tolerances and thresholds. */
const NonNegativeNumber: PropertyType = {
    Integer: false,
    Kind: "Number",
    Minimum: 0
};

/**
 * Every override, applied in order.
 *
 * @category Tools
 * @since 1.0.0
 */
export const Overrides: ReadonlyArray<PropertyOverride> = [
    {
        // Ports, port ranges and public:local mappings, optionally with an address; never one number.
        Key: "server-udp-ports",
        Type: { Kind: "String" }
    },
    {
        AllowedValues: "\"disabled\", \"connect\" or \"listen\"",
        Key: "script-debugger-auto-attach",
        Type: {
            Kind: "Enum",
            Values: [ "disabled", "connect", "listen" ]
        }
    },
    {
        AllowedValues: "Integers in the range [1, 65535]",
        Key: "force-inbound-debug-port",
        Type: Port
    },
    {
        AllowedValues: "Integers in the range [0, 2000]",
        Key: "script-watchdog-memory-warning",
        Type: WatchdogMemory
    },
    {
        AllowedValues: "Integers in the range [0, 2000]",
        Key: "script-watchdog-memory-limit",
        Type: WatchdogMemory
    },
    {
        AllowedValues: "Any finite non-negative number",
        Key: "server-authoritative-entity-attack-range-tolerance",
        Type: NonNegativeNumber
    },
    {
        Key: "player-position-acceptance-threshold",
        Type: NonNegativeNumber
    },
    {
        Key: "player-movement-distance-threshold",
        Type: NonNegativeNumber
    },
    {
        Key: "server-authoritative-block-breaking-pick-range-scalar",
        Type: NonNegativeNumber
    }
];
