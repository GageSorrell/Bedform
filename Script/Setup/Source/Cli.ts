/**
 * Effect CLI flags and lazy request construction for the monorepo setup command.
 *
 * @module monorepo-setup/Cli
 *
 * @file      Cli.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Command, Flag } from "effect/cli";
import { Effect, Option } from "effect";
import type { Options, Request } from "./Contract.js";
import { ResolveOptions, ResolvePaths, RunSetup } from "./Setup.js";
import { homedir, userInfo } from "node:os";
import process from "node:process";

/**
 * Effect CLI optional values before conversion into the shared stage options.
 *
 * @category Configuration
 * @since 1.0.0
 */
interface ParsedOptions extends Omit<Options, "bdsDirectory" | "directory" | "mcpConfig">
{
    readonly bdsDirectory: Option.Option<string>;
    readonly directory: Option.Option<string>;
    readonly mcpConfig: Option.Option<string>;
}

/**
 * Builds a command whose handler alone reads invocation state or invokes setup services.
 * Supplying a handler allows parser tests without access to machine-changing components.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const MakeCommand = <E, R>(handler: (options: Options) => Effect.Effect<void, E, R>) => Command.make(
    "setup",
    {
        bdsDirectory: Flag.String("bds-directory").pipe(
            Flag.withDescription("Explicit stopped BDS directory to provision."), Flag.optional),
        blender: Flag.Boolean("blender").pipe(Flag.withDefault(false),
            Flag.withDescription("Offer optional Blender/Mcblend setup.")),
        blockbench: Flag.Boolean("blockbench").pipe(Flag.withDefault(false),
            Flag.withDescription("Offer optional Blockbench setup.")),
        core: Flag.Boolean("core").pipe(Flag.withDefault(true),
            Flag.withDescription("Build/install required core (use --no-core for provisioning only).")),
        directory: Flag.String("directory").pipe(
            Flag.withDescription("Executable installation directory; never changes source location."),
            Flag.optional),
        mcpConfig: Flag.String("mcp-config").pipe(
            Flag.withDescription("Explicit MCP configuration file to register the installed executable."),
            Flag.optional),
        update: Flag.Boolean("update").pipe(Flag.withDefault(false),
            Flag.withDescription("Force rebuild/reinstall of LOCAL source; never fetches source updates."))
    },
    (flags: ParsedOptions) => handler({
        ...flags,
        bdsDirectory: Option.getOrUndefined(flags.bdsDirectory),
        directory: Option.getOrUndefined(flags.directory),
        mcpConfig: Option.getOrUndefined(flags.mcpConfig)
    })
).pipe(Command.withDescription("Set up the current monorepo-owned Cinnabar fork."));

/**
 * Captures the invoking account, environment and cwd only when setup is actually requested.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const MakeRequest = (options: Options): Request =>
{
    const originalCwd = process.env.npm_lifecycle_event === "setup"
        ? process.env.INIT_CWD ?? process.cwd()
        : process.cwd();
    return {
        account: {
            environment: Object.freeze({ ...process.env }),
            home: homedir(),
            id: userInfo().username
        },
        elevated: false,
        options: ResolveOptions(options, originalCwd),
        paths: ResolvePaths(import.meta.url, originalCwd, process.execPath, options.directory)
    };
};

/**
 * Parses supplied arguments, retaining help/version as pure CLI operations.
 *
 * @category Running
 * @since 1.0.0
 */
export const RunCli = (args: ReadonlyArray<string>) => Command.runWith(
    MakeCommand((options: Options) => Effect.gen(function*()
    {
        const code = yield* RunSetup(MakeRequest(options));
        yield* Effect.sync(() =>
        {
            process.exitCode = code;
        });
    })),
    { version: "1.0.0" }
)(args);
