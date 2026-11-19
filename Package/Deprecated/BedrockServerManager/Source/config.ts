/**
 * User configuration and safe persistence.
 *
 * @module bedrock-server-manager/config
 *
 * @file      config.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { Effect, FileSystem, Path } from "effect";

/** Runtime inputs kept explicit for isolated testing. */
export interface RuntimeContext
{
    readonly cwd: string;
    readonly home: string;
    readonly platform: string;
    readonly env: Readonly<Record<string, string | undefined>>;
}

export namespace Settings
{
    /**
     * Server settings; unknown existing fields are retained on writes.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Server
    {
        [key: string]: unknown;
        path?: string;
    }
}

/** Nested user settings; unknown existing fields are retained on writes. */
export interface Settings
{
    [key: string]: unknown;
    server?: Settings.Server;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/** Resolve the user configuration file without touching the filesystem. */
const configPath = (context: RuntimeContext) => Effect.gen(function*()
{
    const path = yield* Path.Path;
    const override = context.env.BDS_CONFIG_PATH;
    if (override !== undefined)
    {
        if (!BedrockString.trim(override))
        {
            return yield* Effect.fail(new Error("BDS_CONFIG_PATH must not be empty."));
        }
        return path.resolve(context.cwd, override);
    }
    let base: string;
    if (context.platform === "win32")
    {
        if (!context.env.APPDATA)
        {
            return yield* Effect.fail(new Error("APPDATA is missing; set BDS_CONFIG_PATH explicitly."));
        }
        base = context.env.APPDATA;
    }
    else if (context.platform === "darwin")
    {
        base = path.join(context.home, "Library", "Application Support");
    }
    else
    {
        base = context.env.XDG_CONFIG_HOME || path.join(context.home, ".config");
    }
    return path.resolve(context.cwd, base, "bedrock-server-manager", "config.json");
});

/** Read and validate existing settings, without creating a missing file. */
const readSettings = (context: RuntimeContext) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const file = yield* configPath(context);
    if (!(yield* fs.exists(file)))
    {
        return {} as Settings;
    }
    const content = yield* fs.readFileString(file);
    return yield* Effect.try({
        catch: (error: unknown) => new Error(`Invalid configuration at ${file}: ${String(error)}`),
        try: (): Settings =>
        {
            const value: unknown = JSON.parse(content);
            if (!isObject(value) || (value.server !== undefined && !isObject(value.server)))
            {
                throw new Error("Expected a settings object with an optional server object.");
            }
            if (isObject(value.server) && value.server.path !== undefined &&
                (typeof value.server.path !== "string" || !BedrockString.trim(value.server.path)))
            {
                throw new Error("server.path must be a nonempty string.");
            }
            return value as Settings;
        }
    });
});

/** Reject unregistered keys before touching settings. */
const validateKey = (key: string) => key === "server.path"
    ? Effect.void
    : Effect.fail(new Error(`Unsupported setting "${key}". Supported keys: server.path.`));

/** Require an existing directory and return its absolute path. */
const requireDirectory = (value: string, context: RuntimeContext) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    if (!BedrockString.trim(value))
    {
        return yield* Effect.fail(new Error("Directory path must not be empty."));
    }
    const absolute = path.resolve(context.cwd, value);
    const info = yield* fs.stat(absolute).pipe(Effect.mapError(
        () => new Error(`Cannot access directory "${absolute}". Choose an existing directory.`)
    ));
    if (info.type !== "Directory")
    {
        return yield* Effect.fail(new Error(`Expected a directory: ${absolute}`));
    }
    return absolute;
});

/** Persist a setting through a same-filesystem temporary file replacement. */
const writeSetting = (context: RuntimeContext, key: string, value?: string) => Effect.gen(function*()
{
    yield* validateKey(key);
    const settings = yield* readSettings(context);
    const absolute = value === undefined ? undefined : yield* requireDirectory(value, context);
    const server = { ...settings.server };
    if (absolute === undefined)
    {
        delete server.path;
    }
    else
    {
        server.path = absolute;
    }
    if (Object.keys(server).length)
    {
        settings.server = server;
    }
    else
    {
        delete settings.server;
    }
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = yield* configPath(context);
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* Effect.scoped(Effect.gen(function*()
    {
        const temporary = yield* fs.makeTempDirectoryScoped({
            directory: path.dirname(file), prefix: ".bds-"
        });
        const staged = path.join(temporary, "config.json");
        yield* fs.writeFileString(staged, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
        yield* fs.rename(staged, file);
    }));
});

export { configPath, readSettings, requireDirectory, validateKey, writeSetting };
