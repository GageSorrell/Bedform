/**
 * Safe Node adapters for probes, default-deny prompts and shell-free external processes.
 *
 * @module monorepo-setup/Node
 *
 * @file      Node.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { AlreadyCurrentLine, ColorEnabled } from "./Currency.js";
import { BuildInstall, Consent, CreativeTools, Currency, Probes, Processes,
    Provisioning, Reporting } from "./Contract.js";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { Console, Effect, FileSystem, Layer } from "effect";
import type { Paths, ProcessCommand } from "./Contract.js";
import { release, version } from "node:os";
import { IsSupportedPlatform } from "./Windows.js";
import { LoadPrerequisitePlan } from "./PrerequisitePlan.js";
import { PrerequisiteHost } from "./Prerequisite.js";
import { Prompt } from "effect/cli";
import { join } from "node:path";
import process from "node:process";

/**
 * Identifies component work that remains outside this CLI foundation.
 *
 * @category ErrorHandling
 * @since 1.0.0
 */
const Unavailable = (component: string) => Effect.fail(
    new Error(`${component} is not implemented yet. Complete the linked component before running this stage.`)
);

/**
 * Emits no output until the orchestrator establishes currency; resets color immediately after the symbol.
 *
 * @category Layer
 * @since 1.0.0
 */
export const ReportingLayer = Layer.succeed(Reporting, {
    alreadyCurrent: Effect.suspend(() => Console.log(
        AlreadyCurrentLine(ColorEnabled(process.env, Boolean(process.stdout.isTTY)))
    ))
});

/**
 * Provides read-only Windows and fork probes, without native builds or source acquisition.
 * Validates local prerequisite manifests before permission prompts or machine changes.
 *
 * @category Layer
 * @since 1.0.0
 */
export const ProbeLayer = Layer.effect(Probes, Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const host = yield* PrerequisiteHost;
    return {
        platform: Effect.suspend(() => IsSupportedPlatform(
            process.platform, process.arch, release(), version())
            ? Effect.void
            : Effect.fail(new Error("Setup requires Windows 11 x64; help/version work on any platform."))),
        source: (paths: Paths) => Effect.gen(function*()
        {
            for (const file of [ "Cargo.toml", "Cargo.lock", "rust-toolchain.toml",
                "app/Cargo.toml", "app/src/main.rs", "core/go.mod", "go.work",
                "tools/cinnabar-mcp/Cargo.toml", "tools/cinnabar-mcp/src/main.rs",
                "Bedform/compatibility.json" ])
            {
                const info = yield* fs.stat(join(paths.source, file)).pipe(
                    Effect.mapError(() => new Error(
                        `Missing local fork configuration: ${join(paths.source, file)}. ` +
                        "Obtain the complete checkout; setup never downloads a replacement fork."
                    ))
                );
                if (info.type !== "File")
                {
                    return yield* Effect.fail(new Error(`Expected a local fork file: ${file}`));
                }

                const content = yield* fs.readFileString(join(paths.source, file));
                if (content.trim() === "")
                {
                    return yield* Effect.fail(new Error(`Incomplete local fork configuration: ${file}`));
                }
            }

            yield* LoadPrerequisitePlan(paths).pipe(Effect.provideService(PrerequisiteHost, host));
        })
    };
}));

/**
 * Supplies explicit consent, defaulting to No and refusing to prompt without an interactive terminal.
 *
 * @category Layer
 * @since 1.0.0
 */
export const ConsentLayer = Layer.effect(Consent, Effect.gen(function*()
{
    const context = yield* Effect.context<Prompt.Environment>();
    return { confirm: (message: string) => Effect.suspend(() =>
    {
        if (!process.stdin.isTTY || !process.stdout.isTTY)
        {
            return Effect.fail(new Error(`Interactive consent required: ${message}. Rerun in a terminal.`));
        }

        return Prompt.run(Prompt.Confirm({ initial: false,
            message })).pipe(
            Effect.provide(context),
            Effect.mapError(() => new Error(`Consent canceled: ${message}`))
        );
    }) };
}));

/**
 * Executes argument arrays through Effect's spawner, with inherited live terminal streams and no shell.
 *
 * @category Layer
 * @since 1.0.0
 */
export const ProcessLayer = Layer.effect(Processes, Effect.gen(function*()
{
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    return {
        run: (command: ProcessCommand) => spawner.exitCode(ChildProcess.make(
            command.executable, command.args, {
                cwd: command.cwd,
                env: { ...command.environment },
                shell: false,
                stderr: "inherit",
                stdin: "inherit",
                stdout: "inherit"
            })).pipe(Effect.mapError((error: unknown) => new Error(String(error))))
    };
}));

/**
 * Keeps unfinished machine-changing components explicit rather than reporting fabricated setup success.
 * Follow-on lanes replace these layers while preserving the shared contracts.
 *
 * @category Layer
 * @since 1.0.0
 */
export const ComponentLayer = Layer.mergeAll(
    Layer.succeed(Currency, { inspect: () => Effect.succeed(undefined) }),
    Layer.succeed(BuildInstall, { run: () => Unavailable("Local build/install (xa5.4)") }),
    Layer.succeed(Provisioning, {
        bds: () => Unavailable("Stopped-BDS provisioning (xa5.7)"),
        mcp: () => Unavailable("MCP registration (xa5.7)")
    }),
    Layer.succeed(CreativeTools, {
        blender: () => Unavailable("Blender/Mcblend (xa5.8)"),
        blockbench: () => Unavailable("Blockbench (xa5.9)")
    })
);
