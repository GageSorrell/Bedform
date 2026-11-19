/**
 * Runs the demo's Bedrock Dedicated Server in the background: appends its
 * output to console.log, stops it when stop.request appears, and writes the
 * contents of command.request to its console, one command per line, so tools
 * such as Tool/MeasureGlyphs.mjs can run commands.
 *
 * @module @sorrell/ddui-image-demo/Tool/Host
 *
 * @file      Host.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const Server = fileURLToPath(new URL("../dist/bds-runtime/", import.meta.url));
const Pid = path.join(Server, "host.pid");
const Stop = path.join(Server, "stop.request");
const Command = path.join(Server, "command.request");
const Log = path.join(Server, "console.log");
if (existsSync(Pid))
{
    try { process.kill(Number(readFileSync(Pid, "utf8")), 0); throw new Error("Server host already running"); }
    catch (error) { if (error.code !== "ESRCH") throw error; }
}
for (const Request of [ Stop, Command ]) if (existsSync(Request)) unlinkSync(Request);
const Child = spawn(path.join(Server, "bedrock_server.exe"), [], {
    cwd: Server, windowsHide: true, stdio: [ "pipe", "pipe", "pipe" ]
});
writeFileSync(Pid, String(process.pid));
Child.stdout.on("data", (data) => appendFileSync(Log, data));
Child.stderr.on("data", (data) => appendFileSync(Log, data));
const Timer = setInterval(() =>
{
    if (existsSync(Command))
    {
        // Writers create the request under another name and rename it, so it is complete here.
        const Text = readFileSync(Command, "utf8");
        unlinkSync(Command);
        for (const Line of Text.split(/\r?\n/u)) if (Line.trim()) Child.stdin.write(Line.trim() + "\n");
    }
    if (existsSync(Stop))
    {
        unlinkSync(Stop);
        clearInterval(Timer);
        Child.stdin.write("stop\n");
    }
}, 50);
Child.on("error", (error) => appendFileSync(Log, String(error) + "\n"));
Child.on("close", (code) =>
{
    clearInterval(Timer);
    unlinkSync(Pid);
    process.exitCode = code ?? 1;
});
