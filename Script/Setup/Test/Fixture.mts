/**
 * Reusable machine-free services for independently implementing setup components.
 *
 * @module monorepo-setup/Test/Fixture
 *
 * @file      Fixture.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { BuildInstall, Consent, CreativeTools, Currency, Permissions, Prerequisites, Probes, Processes,
    Provisioning, Reporting } from "../Source/Contract.js";
import { Effect, Layer } from "effect";
import type { Options, ProcessCommand, Request } from "../Source/Contract.js";
import { ResolvePaths } from "../Source/Setup.js";
import { Sessions } from "../Source/Session.js";
import type { Verification } from "../Source/Currency.js";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { resolve } from "node:path";

const Root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

/**
 * Default incremental core-only selection.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const Defaults: Options = {
    blender: false,
    blockbench: false,
    core: true,
    update: false
};

/**
 * Makes a request without reading account state or executing machine setup.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const RequestFor = (options: Partial<Options> = {}): Request => ({
    account: { environment: { PATH: "original tools" },
        home: "original home",
        id: "original account" },
    elevated: false,
    options: { ...Defaults,
        ...options },
    paths: ResolvePaths(new URL("../Distribution/index.js", import.meta.url).href, Root, process.execPath)
});

/**
 * Provides faithful in-memory component stages, recording request identity and refreshed environments.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Fixture = () =>
{
    const events: Array<string> = [];
    const requests: Array<Request> = [];
    const prompts: Array<string> = [];
    const commands: Array<ProcessCommand> = [];
    const answers: Array<boolean> = [];
    const exitCodes: Array<number> = [];
    const checks: Array<Request> = [];
    const logs: Array<string> = [];
    const verification: { value?: Verification } = {};
    const record = (name: string, request?: Request) => Effect.sync(() =>
    {
        events.push(name);
        if (request !== undefined)
        {
            requests.push(request);
        }
    });
    const layer = Layer.mergeAll(
        Layer.succeed(Sessions, { acquire: () => Effect.succeed({
            directory: "C:\\test\\locks",
            nonce: "test",
            pid: 1,
            resources: []
        }) }),
        Layer.succeed(Currency, {
            inspect: (request: Request) => Effect.sync(() =>
            {
                checks.push(request);
                return verification.value;
            })
        }),
        Layer.succeed(Reporting, {
            alreadyCurrent: Effect.sync(() => { logs.push("☑ Setup is already complete and current."); })
        }),
        Layer.succeed(Consent, {
            confirm: (message: string) => Effect.sync(() =>
            {
                prompts.push(message);
                return answers.shift() ?? false;
            })
        }),
        Layer.succeed(Processes, {
            run: (command: ProcessCommand) => Effect.sync(() =>
            {
                commands.push(command);
                return exitCodes.shift() ?? 0;
            })
        }),
        Layer.succeed(Probes, {
            platform: record("platform"),
            source: () => record("source")
        }),
        Layer.succeed(Permissions, {
            prepare: (request: Request) => record("permissions", request).pipe(Effect.as({
                environment: { PATH: "permission tools" },
                kind: "ready" as const
            }))
        }),
        Layer.succeed(Prerequisites, {
            prepare: (request: Request) => record("prerequisites", request).pipe(
                Effect.as({ PATH: "refreshed tools" }))
        }),
        Layer.succeed(BuildInstall, { run: (request: Request) => record("buildInstall", request) }),
        Layer.succeed(Provisioning, {
            bds: (request: Request, path: string) => record(`bds:${path}`, request),
            mcp: (request: Request, path: string) => record(`mcp:${path}`, request)
        }),
        Layer.succeed(CreativeTools, {
            blender: (request: Request) => record("blender", request),
            blockbench: (request: Request) => record("blockbench", request)
        })
    );
    return { answers,
        checks,
        commands,
        events,
        exitCodes,
        layer,
        logs,
        prompts,
        requests,
        verification };
};
