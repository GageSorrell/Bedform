/**
 * Path resolution and ordered setup orchestration over injected component services.
 *
 * @module monorepo-setup/Setup
 *
 * @file      Setup.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { BuildInstall, CreativeTools, Currency, Permissions, Prerequisites, Probes, Provisioning,
    Reporting } from "./Contract.js";
import { Console, Effect } from "effect";
import type { Options, Paths, Request } from "./Contract.js";
import { dirname, resolve, win32 } from "node:path";
import { IsCurrent } from "./Currency.js";
import { fileURLToPath } from "node:url";
import process from "node:process";

/**
 * Resolves this CLI's owning checkout separately from the caller's installation override.
 *
 * @category Converting
 * @since 1.0.0
 */
export const ResolvePaths = (cliUrl: string, originalCwd: string, node: string, directory?: string): Paths =>
{
    const cli = fileURLToPath(cliUrl);
    const monorepo = resolve(dirname(cli), "../../..");
    const path = process.platform === "win32" ? win32 : { resolve };
    return Object.freeze({
        cli,
        install: directory === undefined
            ? "C:\\Program Files\\Bedform\\Cinnabar"
            : path.resolve(originalCwd, directory),
        monorepo,
        node,
        originalCwd,
        source: resolve(monorepo, "Package/Cinnabar")
    });
};

/**
 * Resolves explicit provisioning destinations before elevation; omitted destinations stay unselected.
 *
 * @category Converting
 * @since 1.0.0
 */
export const ResolveOptions = (options: Options, cwd: string): Options => Object.freeze({
    ...options,
    bdsDirectory: options.bdsDirectory === undefined ? undefined : resolve(cwd, options.bdsDirectory),
    mcpConfig: options.mcpConfig === undefined ? undefined : resolve(cwd, options.mcpConfig)
});

/**
 * Runs selected stages, short-circuiting after UAC and isolating optional-stage failures.
 * No stage fetches or changes the monorepo source. Missing components fail explicitly.
 *
 * @category Running
 * @since 1.0.0
 */
export const RunSetup = (request: Request) => Effect.gen(function*()
{
    const probes = yield* Probes;
    yield* probes.platform;
    yield* probes.source(request.paths);
    if (!request.options.update)
    {
        const currency = yield* Currency;
        const evidence = yield* currency.inspect(request).pipe(Effect.catch(() => Effect.succeed(undefined)));
        if (IsCurrent(request, evidence))
        {
            const reporting = yield* Reporting;
            yield* reporting.alreadyCurrent;
            return 0;
        }
    }

    const permissions = yield* Permissions;
    const permission = yield* permissions.prepare(request);
    if (permission.kind === "relaunched")
    {
        return permission.exitCode;
    }

    let current: Request = {
        ...request,
        account: { ...request.account,
            environment: permission.environment }
    };
    const prerequisites = yield* Prerequisites;
    const environment = yield* prerequisites.prepare(current);
    current = { ...current,
        account: { ...current.account,
            environment } };
    if (current.options.core)
    {
        const build = yield* BuildInstall;
        yield* build.run(current);
    }

    if (current.options.bdsDirectory !== undefined || current.options.mcpConfig !== undefined)
    {
        const provisioning = yield* Provisioning;
        if (current.options.bdsDirectory !== undefined)
        {
            yield* provisioning.bds(current, current.options.bdsDirectory);
        }

        if (current.options.mcpConfig !== undefined)
        {
            yield* provisioning.mcp(current, current.options.mcpConfig);
        }
    }

    if (current.options.blender || current.options.blockbench)
    {
        const creative = yield* CreativeTools;
        for (const name of [ "blender", "blockbench" ] as const)
        {
            if (current.options[name])
            {
                yield* creative[name](current).pipe(
                    Effect.catch((error: Error) => Console.warn(`Optional ${name}: ${error.message}`))
                );
            }
        }
    }

    return 0;
});
