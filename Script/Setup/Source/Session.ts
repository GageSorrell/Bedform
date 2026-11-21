/**
 * Scoped cross-process setup leases, including authenticated parent-to-elevated-child handoff.
 *
 * @module monorepo-setup/Session
 *
 * @file      Session.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Context, Effect, Layer } from "effect";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { Access } from "./Permissions.js";
import type { Request } from "./Contract.js";
import type { Scope } from "effect";
import process from "node:process";
import { win32 } from "node:path";

/**
 * Live parent ownership of canonical setup resources. A resumed child borrows but never releases it.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Session
{
    readonly pid: number;
    readonly nonce: string;
    readonly directory: string;
    readonly resources: ReadonlyArray<string>;
}

/**
 * Invocation-local lease propagation, defaulting to no authority outside a scoped setup run.
 *
 * @category Service
 * @since 1.0.0
 */
export const ActiveSession = Context.Reference<Session | undefined>("monorepo-setup/ActiveSession", {
    defaultValue: () => undefined
});

/**
 * Injectable acquisition and parent-handoff verification; finalizers release only this process's own leases.
 *
 * @category Service
 * @since 1.0.0
 */
export const Sessions = Context.Service<{
    readonly acquire: (request: Request, inherited?: Session) => Effect.Effect<Session, Error, Scope.Scope>;
}>("monorepo-setup/Sessions");

/**
 * Lists source/build, installation and explicit provisioning resources requiring exclusive setup access.
 *
 * @category Getter
 * @since 1.0.0
 */
const Resources = (request: Request): Array<string> => [
    request.paths.source, request.paths.install,
    ...(request.options.bdsDirectory === undefined ? [] : [ request.options.bdsDirectory ]),
    ...(request.options.mcpConfig === undefined ? [] : [ request.options.mcpConfig ])
];

/**
 * Converts a canonical resource into a collision-resistant, filesystem-safe lease filename.
 *
 * @category Converting
 * @since 1.0.0
 */
const LockFile = (directory: string, resource: string): string => win32.join(directory,
    createHash("sha256").update(resource).digest("hex") + ".lock");

/**
 * Provides user-profile leases without touching checkout files, ACLs or installed bundle contents.
 * Stale leases require inspection rather than silent deletion or process termination.
 *
 * @category Layer
 * @since 1.0.0
 */
export const SessionLayer = Layer.effect(Sessions, Effect.gen(function*()
{
    const access = yield* Access;
    return { acquire: (request: Request, inherited?: Session) => Effect.gen(function*()
    {
        const resources: Array<string> = [];
        for (const path of Resources(request))
        {
            resources.push((yield* access.canonical(path)).toLowerCase());
        }

        const unique = [ ...new Set(resources) ].sort();
        const local = request.account.environment.LOCALAPPDATA;
        if (local === undefined || !win32.isAbsolute(local))
        {
            return yield* Effect.fail(new Error(
                "Original account LOCALAPPDATA is required for setup leases."
            ));
        }

        const directory = win32.join(local, "Bedform", "Setup", "locks");
        if (inherited !== undefined)
        {
            yield* Effect.tryPromise({
                catch: (error: unknown) => new Error(
                    `Invalid or expired setup handoff lease: ${String(error)}`),
                try: async () =>
                {
                    if (!request.elevated || inherited.directory !== directory ||
                        JSON.stringify(inherited.resources) !== JSON.stringify(unique))
                    {
                        throw new Error("Parent resources do not match the resumed setup request.");
                    }

                    process.kill(inherited.pid, 0);
                    for (const resource of unique)
                    {
                        const owner = JSON.parse(await readFile(LockFile(directory, resource), "utf8"));
                        if (owner.pid !== inherited.pid || owner.nonce !== inherited.nonce)
                        {
                            throw new Error("Parent lease is no longer held.");
                        }
                    }
                }
            });
            return inherited;
        }

        const session: Session = { directory,
            nonce: randomUUID(),
            pid: process.pid,
            resources: unique };
        const owned: Array<string> = [];
        yield* Effect.acquireRelease(
            Effect.tryPromise({
                catch: (error: unknown) => new Error(`Cannot acquire setup lease: ${String(error)}`),
                try: async () =>
                {
                    await mkdir(directory, { recursive: true });
                }
            }),
            () => Effect.promise(async () =>
            {
                for (const file of owned.reverse())
                {
                    // Only files created by this acquisition are removed; no recursive cleanup.
                    await unlink(file);
                }
            })
        );
        for (const resource of unique)
        {
            yield* Effect.tryPromise({
                catch: (error: unknown) => new Error(
                    `Another setup may own ${resource}. Inspect ${LockFile(directory, resource)} ` +
                    `before removing a stale lease. ${String(error)}`
                ),
                try: async () =>
                {
                    const file = LockFile(directory, resource);
                    const handle = await open(file, "wx");
                    owned.push(file);
                    try
                    {
                        await handle.writeFile(JSON.stringify(session));
                    }
                    finally
                    {
                        await handle.close();
                    }
                }
            });
        }

        return session;
    }) };
}));
