/**
 * Locked foreground host for a prepared disposable two-client qualification world.
 *
 * @module bedform/Tool/physics-client
 *
 * @file      physics-client.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Host lifecycle uses explicit task paths and contextual process types. */
/* eslint-disable @typescript-eslint/typedef, sort-keys, @stylistic/max-len */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const Root = Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), "..");
const Runtime = Path.join(Root, "dist/bds-runtime");
const SessionFile = process.argv.slice(2).find((argument) => !argument.startsWith("--")) ?? Path.join(Root, "dist/physics-client-session.json");

const Session = JSON.parse(await Fs.readFile(Path.resolve(SessionFile), "utf8")) as Record<string, unknown>;
const Executable = Path.join(Runtime, "bedrock_server.exe");
if (Session.runtime !== Runtime || Session.executable !== Executable || typeof Session.world !== "string" || !/^physics-bds-[a-zA-Z0-9]+$/u.test(Session.world))
{
    throw new Error("Session must name this workspace's fixed physics runtime and disposable world");
}

const LockPath = Path.join(Root, "dist/physics-bds.lock");
const Evidence = Path.join(Root, "dist", Session.world as string);
const Lock = await Fs.open(LockPath, "wx");
try
{
    const Properties = await Fs.readFile(Path.join(Runtime, "server.properties"), "utf8");
    if (!Properties.split(/\r?\n/u).includes(`level-name=${Session.world}`))
    {
        throw new Error("Runtime configuration changed after preparation; prepare the client session again");
    }

    const Smoke = process.argv.includes("--smoke");
    const Child = spawn(Executable, [], { cwd: Runtime,
        windowsHide: true,
        stdio: [ "pipe", "pipe", "pipe" ] });
    let log = "";
    let stopping = false;
    let kill: ReturnType<typeof setTimeout> | undefined;
    const Stop = (): void =>
    {
        if (!stopping)
        {
            stopping = true;
            Child.stdin.write("stop\n");
            kill = setTimeout(() => Child.kill(), 15000);
        }
    };

    const Input = (data: Buffer): void =>
    {
        Child.stdin.write(data);
    };

    process.stdin.on("data", Input);
    process.on("SIGINT", Stop);
    process.on("SIGTERM", Stop);
    Child.stdin.on("error", () =>
    {
    });
    Child.stdout.on("data", (data: Buffer) =>
    {
        const Text = data.toString();
        log += Text;
        process.stdout.write(Text);
        if (Smoke && /BF_CLIENT_READY|BF_FAIL/u.test(log))
        {
            Stop();
        }
    });
    Child.stderr.on("data", (data: Buffer) =>
    {
        log += data.toString();
        process.stderr.write(data);
    });
    const Timer = Smoke ? setTimeout(Stop, 60000) : undefined;
    try
    {
        const Exit = await new Promise<number | null>((resolve, reject) =>
        {
            Child.on("error", reject);
            Child.on("close", resolve);
        });
        if (Exit !== 0 || Smoke && (!log.includes("BF_CLIENT_READY") || /BF_FAIL|BF_CLIENT_CONTROL_ERROR|Players will not be able to connect/u.test(log)))
        {
            throw new Error("Client fixture server smoke failed; see client.log");
        }

        if (Smoke)
        {
            await Fs.writeFile(Path.join(Evidence, "client-smoke.json"), JSON.stringify({ serverSmokePassed: true,
                clientCapturesRecorded: false,
                participants: 0 }, null, 2));
        }
    }
    finally
    {
        clearTimeout(Timer);
        clearTimeout(kill);
        process.stdin.off("data", Input);
        process.stdin.pause();
        process.off("SIGINT", Stop);
        process.off("SIGTERM", Stop);
        await Fs.appendFile(Path.join(Evidence, "client.log"), log);
    }
}
finally
{
    await Lock.close();
    await Fs.unlink(LockPath);
}
