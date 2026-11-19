/**
 * Reusable server and selected-world resolution for addon commands.
 *
 * @module bedrock-server-manager/server
 *
 * @file      server.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { Effect, FileSystem, Path } from "effect";
import { readSettings, requireDirectory } from "./config.js";
import type { RuntimeContext } from "./config.js";

/** Resolve explicit server before saved settings, never defaulting to cwd. */
const resolveServer = (context: RuntimeContext, explicit?: string) => Effect.gen(function*()
{
    const selected = explicit ?? (yield* readSettings(context)).server?.path;
    if (selected === undefined)
    {
        return yield* Effect.fail(new Error(
            "No server selected. Use --server <directory> or bds config set server.path <directory>."
        ));
    }
    return yield* requireDirectory(selected, context);
});

/** Resolve an existing world, constraining its name to one directory component. */
const resolveWorld = (context: RuntimeContext, server: string, override?: string) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    let name = override;
    if (name === undefined)
    {
        const properties = yield* fs.readFileString(path.join(server, "server.properties")).pipe(
            Effect.mapError(() => new Error("Cannot read server.properties. Supply --world <name>."))
        );
        for (const line of properties.split(/\r?\n/))
        {
            const match = /^\s*level-name\s*=(.*)$/.exec(line);
            if (match)
            {
                name = BedrockString.trim(match[1]);
            }
        }
    }
    if (!name?.trim() || name === "." || name === ".." || /[/\\:\0]/.test(name))
    {
        return yield* Effect.fail(new Error("Select a valid world name using --world or level-name."));
    }
    const directory = yield* requireDirectory(path.join(server, "worlds", name), context);
    // realPath also prevents a world symlink from escaping the server's world directory.
    const worlds = yield* fs.realPath(path.join(server, "worlds"));
    const actual = yield* fs.realPath(directory);
    const relative = path.relative(worlds, actual);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    {
        return yield* Effect.fail(new Error("Selected world resolves outside the server worlds directory."));
    }
    return { directory, name };
});

export { resolveServer, resolveWorld };
