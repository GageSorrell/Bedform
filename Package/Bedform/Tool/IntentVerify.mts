/**
 * Retains automated Intent and Canvas qualification logs and compares prepared artifact bytes.
 *
 * @module bedform/Tool/IntentVerify
 *
 * @file      IntentVerify.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { closeSync, openSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawn } from "node:child_process";

const Root = fileURLToPath(new URL("../../../", import.meta.url));
const Output = join(Root, "Package/Bedform/dist/intent-qualification");
const Artifact = join(Root, "Package/Bedform/Asset/bedform-canvas.mcaddon");
const Npm = process.env.npm_execpath;
if (!Npm)
{
    throw new Error("Run this qualification through npm run verify:intent --workspace bedform.");
}

await mkdir(Output, { recursive: true });
const Evidence = {
    ClientAcceptance: false,
    Finished: null as string | null,
    NativeAcceptance: false,
    Node: process.version,
    Passed: false,
    Platform: `${process.platform}/${process.arch}`,
    Started: new Date().toISOString(),
    Steps: [] as Array<{ Command: string;
        Exit: number;
        Milliseconds: number;
        Log: string;
        CanvasSHA256: string }>
};

/**
 * Records progress even when a gate fails, keeping failure logs separate from completed evidence.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Save(): Promise<void>
{
    await writeFile(join(Output, "results.json"), JSON.stringify(Evidence, null, 2) + "\n");
}

await Save();
for (const [ workspace, script ] of [ [ "bedform", "verify" ], [ "bedform-canvas", "check" ],
    [ "bedform", "build:pure" ], [ "bedform", "prepack" ] ])
{
    const command = [ "run", script, "--workspace", workspace ];
    const log = `${Evidence.Steps.length + 1}-${workspace}-${script.replaceAll(":", "-")}.log`;
    const handle = openSync(join(Output, log), "w");
    const started = Date.now();
    console.warn(`Qualifying npm ${command.join(" ")} (${log})`);
    let status: number;
    try
    {
        status = await new Promise<number>((resolve: (code: number) => void,
            reject: (error: Error) => void) =>
        {
            const child = spawn(process.execPath, [ Npm, ...command ], { cwd: Root,
                stdio: [ "ignore", handle, handle ] });
            child.once("error", reject);
            child.once("close", (code: number | null) => resolve(code ?? 1));
        });
    }
    catch (error)
    {
        Evidence.Finished = new Date().toISOString();
        await Save();
        throw error;
    }
    finally
    {
        closeSync(handle);
    }

    const hash = createHash("sha256").update(await readFile(Artifact)).digest("hex");
    Evidence.Steps.push({ CanvasSHA256: hash,
        Command: `npm ${command.join(" ")}`,
        Exit: status,
        Log: log,
        Milliseconds: Date.now() - started });
    await Save();
    if (status !== 0 || hash !== Evidence.Steps[0].CanvasSHA256)
    {
        Evidence.Finished = new Date().toISOString();
        await Save();
        throw new Error(`Qualification failed or Canvas artifact changed: ${log}`);
    }
}

Evidence.Finished = new Date().toISOString();
Evidence.Passed = true;
await Save();
console.warn(`Automated qualification passed. Evidence: ${Output}`);
