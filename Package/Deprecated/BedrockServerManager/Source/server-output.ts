/**
 * Incremental decoding for independent native stdout and stderr streams.
 *
 * @module bedrock-server-manager/server-output
 *
 * @file      server-output.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { StringDecoder } from "node:string_decoder";

/** One decoded line, including whether the server supplied a final newline. */
interface ServerOutput
{
    stream: "stdout" | "stderr";
    text: string;
    terminated: boolean;
}

/** Preserve split UTF-8 characters, split CRLF and final unterminated output. */
const createOutputDecoder = (stream: ServerOutput["stream"], emit: (line: ServerOutput) => void) =>
{
    const decoder = new StringDecoder("utf8");
    let pending = "";
    let ended = false;
    const append = (text: string) =>
    {
        pending += text;
        let index: number;
        while ((index = pending.indexOf("\n")) !== -1)
        {
            const text = BedrockString.replace(/\r$/, "")(pending.slice(0, index));
            pending = pending.slice(index + 1);
            emit({ stream, terminated: true, text });
        }
    };
    return {
        end: () =>
        {
            if (ended)
            {
                return;
            }
            ended = true;
            append(decoder.end());
            if (pending)
            {
                emit({ stream, terminated: false, text: pending });
            }
            pending = "";
        },
        write: (bytes: Buffer) =>
        {
            if (!ended)
            {
                append(decoder.write(bytes));
            }
        }
    };
};

export { createOutputDecoder };
export type { ServerOutput };
