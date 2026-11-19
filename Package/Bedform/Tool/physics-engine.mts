/**
 * Local engine discovery and isolated, engine-authored world templates.
 *
 * @module bedform/Tool/physics-engine
 *
 * @file      physics-engine.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { spawn } from "node:child_process";

/**
 * Selects an explicit installation, the checkout's Server directory, or the
 * cached fixed-path Bedform runtime. An invalid override is always an error.
 * Source worlds and configuration are never used or modified.
 *
 * @category Fixtures
 * @since 1.0.0
 */
export const physicsEngine = async (root: string, override?: string): Promise<string> =>
{
    const Candidates = override === undefined
        ? [ Path.resolve(root, "../../Server"), Path.join(root, "dist/bds-runtime") ]
        : [ Path.resolve(override) ];
    const Problems: Array<string> = [];
    for (const Candidate of Candidates)
    {
        try
        {
            if (!(await Fs.stat(Path.join(Candidate, "bedrock_server.exe"))).isFile())
            {throw new Error("bedrock_server.exe is not a file");}

            for (const Kind of [ "behavior_packs", "resource_packs" ])
            {
                if (!(await Fs.stat(Path.join(Candidate, Kind))).isDirectory())
                {throw new Error(`${Kind} is not a directory`);}
            }

            return Candidate;
        }
        catch (error)
        {Problems.push(`${Candidate}: ${String(error)}`);}
    }

    throw new Error(`${override === undefined ? "No local BDS installation found" : "Invalid BDS_PATH"}. ` +
        "Set $env:BDS_PATH to the extracted BDS directory containing bedrock_server.exe, " +
        "behavior_packs and resource_packs, then rerun preparation. " +
        `WorldRealism files are not required. Checked: ${Problems.join("; ")}`);
};

/**
 * Boots a new disposable vanilla world on the fixed executable path and stops
 * it cleanly after startup. Returns its engine-saved level.dat, independent of
 * other add-ons and installed worlds. Restores the previous server properties
 * even on failure and retains bootstrap logs and world files for inspection.
 *
 * @category Fixtures
 * @since 1.0.0
 */
export const physicsTemplate = async (runtime: string, run: string): Promise<string> =>
{
    const Properties = Path.join(runtime, "server.properties");
    const Previous = await Fs.readFile(Properties).catch((error: NodeJS.ErrnoException) =>
    {
        if (error.code !== "ENOENT")
        {throw error;}

        return undefined;
    });
    const Name = `${Path.basename(run)}-bootstrap`;
    let log = "";
    try
    {
        await Fs.writeFile(Properties, `server-name=Bedform template bootstrap\nlevel-name=${Name}\n` +
            "level-type=FLAT\ngamemode=creative\ndifficulty=peaceful\nallow-cheats=true\n" +
            "online-mode=false\nallow-player-joining=false\nserver-port=0\nserver-portv6=0\n" +
            "transport=nethernet\nenable-lan-visibility=false\n");
        const Child = spawn(Path.join(runtime, "bedrock_server.exe"), [], {
            cwd: runtime,
            windowsHide: true,
            stdio: [ "pipe", "pipe", "pipe" ]
        });
        let stopping = false;
        const Stop = (): void =>
        {
            if (!stopping)
            {
                stopping = true;
                Child.stdin.write("stop\n");
            }
        };

        const Timer = setTimeout(Stop, 120000);
        const Kill = setTimeout(() => Child.kill(), 135000);
        Child.stdin.on("error", () =>
        { /* The child may have exited before a pending stop write. */ });
        Child.stdout.on("data", (data: Buffer) =>
        {
            log += data.toString();
            if (log.includes("Server started."))
            {Stop();}
        });
        Child.stderr.on("data", (data: Buffer) =>
        {
            log += data.toString();
        });
        try
        {
            const Exit = await new Promise<number | null>((resolve, reject) =>
            {
                Child.on("error", reject);
                Child.on("close", resolve);
            });
            if (Exit !== 0 || !log.includes("Server started."))
            {
                throw new Error(`BDS world bootstrap failed (exit ${Exit}); ` +
                    `see ${Path.join(run, "bootstrap.log")}`);
            }

            const Level = Path.join(runtime, "worlds", Name, "level.dat");
            await Fs.access(Level);
            return Level;
        }
        finally
        {
            clearTimeout(Timer);
            clearTimeout(Kill);
        }
    }
    finally
    {
        await Fs.writeFile(Path.join(run, "bootstrap.log"), log);
        if (Previous === undefined)
        {await Fs.rm(Properties, { force: true });}
        else
        {await Fs.writeFile(Properties, Previous);}
    }
};
