/**
 * Explicit host-only boundary for future prototype provisioning commands.
 * This contract module supplies no provisioning or live-world mutation implementation.
 *
 * @module bedform/Prototype/World/Host
 *
 * @file      Host.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Portable creation input for the host CLI; creation always starts from a fresh world.
 *
 * @category Types
 * @since 1.0.0
 */
export interface CreateOptions
{
    readonly Name: string;
    readonly Source: string;
    readonly OutputParent?: string;
    readonly With?: ReadonlyArray<string>;
    readonly WorldShape?: "Normal" | "Flat";
    readonly FlatFloorHeight?: number;
}

/**
 * Read-only query result independent of the native server process being active.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ServerInfo
{
    readonly Name: string;
    readonly Directory: string;
    readonly Source: string;
    readonly Running: boolean;
    readonly MetadataVersion: number;
}

/**
 * Host service surface implemented by later provisioning and transactional-management milestones.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Service
{
    readonly Create: (options: CreateOptions) => Promise<ServerInfo>;
    readonly List: (source: string) => Promise<ReadonlyArray<ServerInfo>>;
    readonly Query: (nameOrPath: string) => Promise<ServerInfo>;
    readonly Update: (nameOrPath: string) => Promise<ServerInfo>;
    readonly Remove: (nameOrPath: string) => Promise<void>;
}
