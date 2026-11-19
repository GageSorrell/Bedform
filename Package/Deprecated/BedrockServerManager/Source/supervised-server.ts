/**
 * Scoped ownership integration and external/terminal lifecycle supervision.
 *
 * @module bedrock-server-manager/supervised-server
 *
 * @file      supervised-server.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Effect } from "effect";
import type { EventEmitter } from "node:events";
import type { ServerOutput } from "./server-output.js";
import type { ServerOwnership } from "./start-ownership.js";
import type { ServerSession } from "./server-session.js";
import type { SpawnServer } from "./start-process.js";
import { createServerSession } from "./server-session.js";
import { Option } from "effect";

/** The UI owns raw-mode input and blocked SIGINT; this layer handles abnormal loss/termination. */
interface SessionLifecycle
{
    input?: EventEmitter;
    output?: EventEmitter;
    signals?: EventEmitter;
}

/** Preserve environment/error types when restoring caller interruptibility. */
type RestoreInterruptibility = <Value, Err, Env>(effect: Effect.Effect<Value, Err, Env>) =>
Effect.Effect<Value, Err, Env>;

/** Observe terminal loss and external termination until confirmed child closure. */
const watchServerSession = (session: ServerSession, boundary: SessionLifecycle = {}) =>
{
    const signals = boundary.signals ?? process;
    const terminate = () => { void session.shutdown("SIGTERM"); };
    const hangup = () => { void session.shutdown("SIGHUP"); };
    const terminalLost = () => { void session.shutdown("terminal-loss"); };
    signals.on("SIGTERM", terminate);
    signals.on("SIGHUP", hangup);
    for (const terminal of [ boundary.input, boundary.output ])
    {
        terminal?.on("end", terminalLost);
        terminal?.on("close", terminalLost);
        terminal?.on("error", terminalLost);
    }
    const dispose = () =>
    {
        signals.off("SIGTERM", terminate);
        signals.off("SIGHUP", hangup);
        for (const terminal of [ boundary.input, boundary.output ])
        {
            terminal?.off("end", terminalLost);
            terminal?.off("close", terminalLost);
            terminal?.off("error", terminalLost);
        }
    };
    void session.completion.then(dispose);
    return dispose;
};

/** Spawn under retained ownership and never release the locks before a confirmed child close. */
const superviseServer = (ownership: ServerOwnership, options: {
    spawn?: SpawnServer;
    onOutput?: (line: ServerOutput) => void;
    onSession?: (session: ServerSession) => void;
    lifecycle?: SessionLifecycle;
} = {}) => Effect.scoped(Effect.uninterruptibleMask((restore: RestoreInterruptibility) =>
    Effect.gen(function*()
    {
        yield* ownership.retainRecovery();
        const created = yield* Effect.result(
            Effect.try(() => createServerSession(ownership.launch, options)));
        if (created._tag === "Failure")
        {
            yield* ownership.childClosed();
            return yield* Effect.fail(created.failure);
        }
        const session = created.success;
        yield* Effect.addFinalizer(() => Effect.gen(function*()
        {
            yield* Effect.promise(() => session.shutdown("scope-exit"));
            yield* ownership.childClosed();
        }));
        watchServerSession(session, options.lifecycle);
        const pid = yield* restore(Effect.promise(() => session.started));
        if (Option.isSome(pid))
        {
            yield* ownership.recordChild(pid.value);
        }
        yield* Effect.try(() => options.onSession?.(session));
        return yield* restore(Effect.promise(() => session.completion));
    })));

export { superviseServer, watchServerSession };
export type { SessionLifecycle };
