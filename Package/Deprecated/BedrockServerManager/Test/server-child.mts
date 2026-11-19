/**
 * Controllable native-process substitute: echoes commands and flushes shutdown tails.
 *
 * @module bedrock-server-manager/Test/server-child
 *
 * @file      server-child.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as NodeReadlineTypes from "node:readline";
import { TextEncoder } from "node:util";
import { createInterface } from "node:readline";
import { setImmediate as settle } from "node:timers/promises";

const bytes: Uint8Array = new TextEncoder().encode("ready 🧱\n");
process.stdout.write(bytes.subarray(0, 8));
await settle();
process.stdout.write(bytes.subarray(8));
if (process.env.BDS_FIXTURE_MODE === "failure")
{
    process.stderr.write("controlled failure tail");
    process.exitCode = 7;
}
else
{
    const input: NodeReadlineTypes.Interface = createInterface({ input: process.stdin });
    input.on("line", (command: string) =>
    {
        if (command === "stop")
        {
            process.stdout.write("saving\nfinal stdout 🧱");
            process.stderr.write("final stderr tail");
            input.close();
            process.stdin.destroy();
        }
        else
        {
            process.stdout.write(`${JSON.stringify(command)}\n`);
        }
    });
}
