/**
 * Injectable setup component contracts shared by the Windows implementation lanes.
 *
 * @module monorepo-setup/Contract
 *
 * @file      Contract.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Context, Effect } from "effect";
import type { Verification } from "./Currency.js";

/**
 * Selected stages and installation overrides, without source-management operations.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Options
{
    readonly directory?: string;
    readonly update: boolean;
    readonly core: boolean;
    readonly bdsDirectory?: string;
    readonly mcpConfig?: string;
    readonly blender: boolean;
    readonly blockbench: boolean;
}

/**
 * Absolute locations retained across elevation; source always belongs to this CLI's checkout.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Paths
{
    readonly monorepo: string;
    readonly source: string;
    readonly install: string;
    readonly originalCwd: string;
    readonly cli: string;
    readonly node: string;
}

/**
 * Original account and tool locations that an elevation implementation must preserve and verify.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Account
{
    readonly id: string;
    readonly home: string;
    readonly environment: Readonly<Record<string, string | undefined>>;
}

/**
 * Immutable relaunch payload, including selected stages and the forced-local rebuild flag.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Request
{
    readonly options: Options;
    readonly paths: Paths;
    readonly account: Account;
    readonly elevated: boolean;
}

/**
 * Structured process invocation; arguments are never interpolated into shell source.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ProcessCommand
{
    readonly executable: string;
    readonly args: ReadonlyArray<string>;
    readonly cwd: string;
    readonly environment: Readonly<Record<string, string | undefined>>;
}

/**
 * A completed relaunch short-circuits the original orchestration and preserves its exit code.
 * Ready permissions may refresh the child environment without changing the original account.
 *
 * @category Model
 * @since 1.0.0
 */
export type PermissionResult =
    | { readonly kind: "ready";
        readonly environment: Readonly<Record<string, string | undefined>> }
    | { readonly kind: "relaunched";
        readonly exitCode: number };

/**
 * Platform discovery and read-only local source preflight, run before machine changes.
 *
 * @category Service
 * @since 1.0.0
 */
export const Probes = Context.Service<{
    readonly platform: Effect.Effect<void, Error>;
    readonly source: (paths: Paths) => Effect.Effect<void, Error>;
}>("monorepo-setup/Probes");

/**
 * Read-only inspection of local inputs, complete owned bundle and selected provisioning receipts.
 * Build/install and provisioning adapters supply measured evidence, never a trusted completion marker.
 * An absent receipt or inspection failure cannot establish currency.
 *
 * @category Service
 * @since 1.0.0
 */
export const Currency = Context.Service<{
    readonly inspect: (request: Request) => Effect.Effect<Verification | undefined, Error>;
}>("monorepo-setup/Currency");

/**
 * Exactly one already-current success line, with no other output on the shortcut path.
 *
 * @category Service
 * @since 1.0.0
 */
export const Reporting = Context.Service<{
    readonly alreadyCurrent: Effect.Effect<void>;
}>("monorepo-setup/Reporting");

/**
 * Destination permissions and single UAC handoff, owned by xa5.2.
 * The implementation must verify original-account identity before returning ready.
 *
 * @category Service
 * @since 1.0.0
 */
export const Permissions = Context.Service<{
    readonly prepare: (request: Request) => Effect.Effect<PermissionResult, Error>;
}>("monorepo-setup/Permissions");

/**
 * Required tool discovery, consented installation and environment refresh, owned by xa5.3.
 *
 * @category Service
 * @since 1.0.0
 */
export const Prerequisites = Context.Service<{
    readonly prepare: (request: Request) => Effect.Effect<
        Readonly<Record<string, string | undefined>>, Error>;
}>("monorepo-setup/Prerequisites");

/**
 * Consent defaults to No and rejects noninteractive requests requiring a decision.
 *
 * @category Service
 * @since 1.0.0
 */
export const Consent = Context.Service<{
    readonly confirm: (message: string) => Effect.Effect<boolean, Error>;
}>("monorepo-setup/Consent");

/**
 * External command execution with live standard streams and an explicit child environment.
 *
 * @category Service
 * @since 1.0.0
 */
export const Processes = Context.Service<{
    readonly run: (command: ProcessCommand) => Effect.Effect<number, Error>;
}>("monorepo-setup/Processes");

/**
 * Local build and transactional bundle installation, owned by xa5.4.
 * Ordinary execution is incremental; request.options.update forces rebuilding and reinstalling.
 *
 * @category Service
 * @since 1.0.0
 */
export const BuildInstall = Context.Service<{
    readonly run: (request: Request) => Effect.Effect<void, Error>;
}>("monorepo-setup/BuildInstall");

/**
 * Explicit stopped-server provisioning and MCP registration, owned by xa5.7.
 * Each operation receives an absolute user-selected destination and preserves unrelated contents.
 *
 * @category Service
 * @since 1.0.0
 */
export const Provisioning = Context.Service<{
    readonly bds: (request: Request, directory: string) => Effect.Effect<void, Error>;
    readonly mcp: (request: Request, config: string) => Effect.Effect<void, Error>;
}>("monorepo-setup/Provisioning");

/**
 * Independently optional creative tools; declines and failures produce diagnostics without failing core.
 *
 * @category Service
 * @since 1.0.0
 */
export const CreativeTools = Context.Service<{
    readonly blender: (request: Request) => Effect.Effect<void, Error>;
    readonly blockbench: (request: Request) => Effect.Effect<void, Error>;
}>("monorepo-setup/CreativeTools");
