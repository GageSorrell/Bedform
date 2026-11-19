/**
 * Foreground child supervision and ordered, backpressure-aware command submission.
 *
 * @module bedrock-server-manager/server-session
 *
 * @file      server-session.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import type { ServerLaunch, SpawnServer } from "./start-process.js";
import type { ServerOutput } from "./server-output.js";
import { createOutputDecoder } from "./server-output.js";
import { spawnServer } from "./start-process.js";
import { Option } from "effect";

/** Abnormal termination is distinct from an interactive stop command. */
type ShutdownReason = "stop" | "terminal-loss" | "SIGTERM" | "SIGHUP" | "scope-exit" | "io-error";

/** Final status is available only after child close and all trailing output has been decoded. */
interface ServerExit
{
    code: number | null;
    signal: NodeJS.Signals | null;
    exitCode: number;
    reason: ShutdownReason | "exit" | "spawn-error";
    errors: Array<string>;
    summary: string;
}

/** No kill/detach/restart operation is exposed to interactive callers. */
interface ServerSession
{
    started: Promise<Option.Option<number>>;
    completion: Promise<ServerExit>;
    submit: (input: string) => Promise<boolean>;
    shutdown: (reason: ShutdownReason) => Promise<ServerExit>;
}

/**
 * Normalize exactly one console command while preserving internal argument bytes.
 * @throws {Error} When embedded line breaks or NUL would inject a second console command.
 */
const normalizeCommand = (input: string): string =>
{
    const command = BedrockString.replace(/^\//, "")(BedrockString.trim(input));
    if (/[\r\n\0]/.test(command))
    {
        throw new Error("Submit one console command at a time.");
    }
    return command;
};

/** Spawn once, drain both streams, and settle every pending command when the child closes. */
const createServerSession = (launch: ServerLaunch, options: {
    spawn?: SpawnServer;
    onOutput?: (line: ServerOutput) => void;
} = {}): ServerSession =>
{
    const child = spawnServer(launch, options.spawn);
    const errors: Array<string> = [];
    const cleanups: Array<() => void> = [];
    let closed = false;
    let exited = false;
    let spawned = false;
    let unacknowledgedWrite = false;
    let stopping = false;
    let stopWritten = false;
    let terminated = false;
    let reason: ServerExit["reason"] = "exit";
    let writeError: Option.Option<Error> = Option.none();
    let output = options.onOutput;
    let queue = Promise.resolve();
    let resolveStarted!: (pid: Option.Option<number>) => void;
    let resolveCompletion!: (result: ServerExit) => void;
    const started = new Promise<Option.Option<number>>((resolve: (pid: Option.Option<number>) => void) =>
    { resolveStarted = resolve; });
    const completion = new Promise<ServerExit>((resolve: (result: ServerExit) => void) =>
    { resolveCompletion = resolve; });
    const recordError = (error: unknown) =>
    {
        const text = String(error);
        if (errors.length < 32 && !errors.includes(text))
        {
            errors.push(text);
        }
    };
    const terminateBrokenPipe = () =>
    {
        if (closed || exited || terminated || !spawned)
        {
            return;
        }
        terminated = true;
        try
        {
            if (!child.kill("SIGTERM"))
            {
                recordError("Could not signal the child; waiting for confirmed close.");
            }
        }
        catch (error) { recordError(error); }
    };
    const writeCommand = async (command: string) =>
    {
        const pid = await started;
        if (closed || exited || Option.isNone(pid))
        {
            throw new Error("The server command channel is closed.");
        }
        if (Option.isSome(writeError))
        {
            throw writeError.value;
        }
        await new Promise<void>((resolve: () => void, reject: (error: Error) => void) =>
        {
            unacknowledgedWrite = true;
            let returned = false;
            let accepted = false;
            let callbackDone = false;
            let drained = false;
            let settled = false;
            const cleanup = () =>
            {
                child.stdin.off("drain", drain);
                child.stdin.off("error", fail);
                child.stdin.off("close", channelClosed);
                child.off("close", channelClosed);
            };
            const fail = (error: Error) =>
            {
                if (settled)
                {
                    return;
                }
                settled = true;
                unacknowledgedWrite = false;
                cleanup();
                reject(error);
            };
            const finish = () =>
            {
                if (!settled && returned && callbackDone && (accepted || drained))
                {
                    settled = true;
                    cleanup();
                    resolve();
                }
            };
            const drain = () => { drained = true; finish(); };
            const channelClosed = () =>
            {
                if (callbackDone)
                {
                    accepted = true;
                    finish();
                }
                else
                {
                    fail(new Error("The server command channel closed during a write."));
                }
            };
            child.stdin.on("drain", drain);
            child.stdin.on("error", fail);
            child.stdin.on("close", channelClosed);
            child.on("close", channelClosed);
            try
            {
                accepted = child.stdin.write(`${command}\n`, "utf8", (error?: Error | null) =>
                {
                    if (error)
                    {
                        fail(error);
                    }
                    else
                    {
                        unacknowledgedWrite = false;
                        if (BedrockString.toLowerCase(BedrockString.trim(command)) === "stop")
                        {
                            stopWritten = true;
                        }
                        callbackDone = true;
                        finish();
                    }
                });
                returned = true;
                finish();
            }
            catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
        });
    };
    const enqueue = (command: string) =>
    {
        const pending = queue.then(() => writeCommand(command)).catch((error: unknown) =>
        {
            if (!closed && !exited)
            {
                const failure = error instanceof Error ? error : new Error(String(error));
                writeError = Option.some(failure);
                recordError(failure);
                reason = spawned ? "io-error" : "spawn-error";
                stopping = true;
                terminateBrokenPipe();
            }
            throw error;
        });
        // Retain a fulfilled serialization tail while each caller still receives its own rejection.
        queue = pending.then(() => undefined, () => undefined);
        return pending;
    };
    const shutdown = (requested: ShutdownReason): Promise<ServerExit> =>
    {
        if (closed || exited)
        {
            return completion;
        }
        if (requested !== "stop" && (reason === "exit" || reason === "stop"))
        {
            reason = requested;
        }
        if (!stopping)
        {
            stopping = true;
            if (reason === "exit")
            {
                reason = requested;
            }
            void enqueue("stop").then(() => { stopWritten = true; }, () => terminateBrokenPipe());
        }
        return completion;
    };
    const ioFailure = (error: unknown) =>
    {
        if (closed)
        {
            return;
        }
        recordError(error);
        void shutdown("io-error");
    };
    const emit = (line: ServerOutput) =>
    {
        try { output?.(line); }
        catch (error)
        {
            output = undefined;
            recordError(error);
            if (!closed)
            {
                void shutdown("io-error");
            }
        }
    };
    const stdout = createOutputDecoder("stdout", emit);
    const stderr = createOutputDecoder("stderr", emit);
    const stdoutData = (chunk: Buffer) => stdout.write(chunk);
    const stderrData = (chunk: Buffer) => stderr.write(chunk);
    const stdinError = (error: Error) =>
    {
        if (exited && !unacknowledgedWrite)
        {
            return;
        }
        writeError = Option.some(error);
        ioFailure(error);
        terminateBrokenPipe();
    };
    const stdinClosed = () =>
    {
        if (!closed && !exited && !(stopping && stopWritten))
        {
            stdinError(new Error("The server stdin pipe closed."));
        }
    };
    const onSpawn = () =>
    {
        spawned = true;
        resolveStarted(Option.fromUndefinedOr(child.pid));
        if (Option.isSome(writeError))
        {
            terminateBrokenPipe();
        }
    };
    const childError = (error: Error) =>
    {
        recordError(error);
        if (!spawned)
        {
            reason = "spawn-error";
            resolveStarted(Option.none());
        }
        else
        {
            void shutdown("io-error");
        }
    };
    const onExit = () => { exited = true; };
    const onClose = (code: number | null, signal: NodeJS.Signals | null) =>
    {
        closed = true;
        if (unacknowledgedWrite)
        {
            recordError("The server closed before acknowledging a command write.");
            reason = "io-error";
        }
        resolveStarted(Option.none());
        stdout.end();
        stderr.end();
        for (const cleanup of cleanups) { cleanup(); }
        const abnormal = reason !== "exit" && reason !== "stop";
        const exitCode = code && code > 0 ? code : signal || abnormal || errors.length ? 1 : 0;
        const result: ServerExit = { code, errors: [ ...errors ], exitCode, reason, signal,
            summary: `BDS closed (${signal ? `signal ${signal}` : `code ${code ?? "unavailable"}`}; ` +
                `${reason})${errors.length ? `: ${errors.join("; ")}` : "."}` };
        resolveCompletion(result);
    };
    child.on("spawn", onSpawn);
    child.on("error", childError);
    child.on("exit", onExit);
    child.on("close", onClose);
    child.stdin.on("error", stdinError);
    child.stdin.on("close", stdinClosed);
    child.stdout.on("data", stdoutData);
    child.stderr.on("data", stderrData);
    for (const [ stream, decoder ] of [ [ child.stdout, stdout ], [ child.stderr, stderr ] ] as const)
    {
        stream.on("end", decoder.end);
        stream.on("close", decoder.end);
        stream.on("error", ioFailure);
        cleanups.push(() =>
        {
            stream.off("end", decoder.end);
            stream.off("close", decoder.end);
            stream.off("error", ioFailure);
        });
    }
    cleanups.push(() =>
    {
        child.off("spawn", onSpawn);
        child.off("error", childError);
        child.off("exit", onExit);
        child.off("close", onClose);
        child.stdin.off("error", stdinError);
        child.stdin.off("close", stdinClosed);
        child.stdout.off("data", stdoutData);
        child.stderr.off("data", stderrData);
    });
    return {
        completion, shutdown, started,
        submit: async (input: string) =>
        {
            const command = normalizeCommand(input);
            if (!command)
            {
                return false;
            }
            if (closed || stopping)
            {
                throw new Error("The server is stopping or closed.");
            }
            const stop = BedrockString.toLowerCase(BedrockString.trim(command)) === "stop";
            if (stop)
            {
                stopping = true;
                reason = "stop";
            }
            await enqueue(command);
            if (stop)
            {
                stopWritten = true;
            }
            return true;
        }
    };
};

export { createServerSession, normalizeCommand };
export type { ServerExit, ServerSession, ShutdownReason };
