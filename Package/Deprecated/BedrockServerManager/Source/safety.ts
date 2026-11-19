/**
 * Portable names and filesystem guards shared by ingestion and mutation.
 *
 * @module bedrock-server-manager/safety
 *
 * @file      safety.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { Effect, FileSystem, Path } from "effect";
import { object } from "./manifest.js";

/**
 * Normalize archive separators while rejecting unsafe or nonportable components.
 *
 * @throws {Error} When a path could escape or alias another filesystem entry.
 */
const portableName = (input: string): string =>
{
    const normalized = BedrockString.replaceAll("\\", "/")(input);
    if (BedrockString.startsWith("/")(normalized) || /[:<>"|?*]/.test(normalized) ||
        [ ...normalized ].some((character: string) => character.charCodeAt(0) < 32))
    {
        throw new Error(`Unsafe archive/source path: ${input}`);
    }
    const parts = normalized.split("/").filter((part: string) => part !== "" && part !== ".");
    if (!parts.length || parts.some((part: string) => part === ".." || /[. ]$/.test(part) ||
        /^(con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part)))
    {
        throw new Error(`Unsafe archive/source path: ${input}`);
    }
    return parts.join("/");
};

/** Reject links in every existing component, including dangling links and Windows junctions. */
const rejectLinks = (absolute: string, allowMissing: boolean = false) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const parsed = path.parse(absolute);
    let current = parsed.root;
    for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean))
    {
        current = path.join(current, part);
        const checked = yield* Effect.result(fs.readLink(current));
        if (checked._tag === "Success")
        {
            return yield* Effect.fail(new Error(`Symlinks/junctions are not allowed: ${current}`));
        }
        const cause = checked.failure.reason.cause;
        if (object(cause) && cause.code === "EINVAL")
        {
            continue;
        }
        if (allowMissing && checked.failure.reason._tag === "NotFound")
        {
            return;
        }
        return yield* Effect.fail(checked.failure);
    }
});

/** Guard a mutation target relative to an existing, validated server directory. */
const mutationPath = (server: string, target: string) => Effect.gen(function*()
{
    const path = yield* Path.Path;
    const relative = path.relative(server, target);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    {
        return yield* Effect.fail(new Error(`Mutation target is outside the server: ${target}`));
    }
    yield* rejectLinks(target, true);
});

export { mutationPath, portableName, rejectLinks };
