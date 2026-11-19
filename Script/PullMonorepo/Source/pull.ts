/**
 * Git and Beads pull operations with independent, concurrent outcomes.
 *
 * @file pull.ts
 */

import { Effect, Result, Stream } from "effect";
import { ChildProcess } from "effect/process";
import type { ChildProcessSpawner } from "effect/process";
import type { PlatformError } from "effect";
import { simpleGit } from "simple-git";

/**
 * The outcome of one independently executed pull.
 *
 * @category Types
 * @since 1.0.0
 */
export interface PullOutcome
{
    detail: string;
    name: "Git" | "Beads";
    status: "success" | "skipped" | "failed";
}

/**
 * Selects Origin, then origin, then the first listed remote.
 * An empty remote list fails through the Effect error channel.
 *
 * @category Git
 * @since 1.0.0
 */
export function SelectRemote(Remotes: ReadonlyArray<string>): Effect.Effect<string, Error>
{
    const Remote = Remotes.includes("Origin") ? "Origin"
        : Remotes.includes("origin") ? "origin" : Remotes[0];
    return Remote ? Effect.succeed(Remote) : Effect.fail(new Error("No Git remotes are configured."));
}

/**
 * Verifies the checkout and chooses its remote before either pull starts.
 *
 * @category Git
 * @since 1.0.0
 */
export function Preflight(Root: string): Effect.Effect<string, Error>
{
    return Effect.gen(function*()
    {
        const Git = simpleGit(Root);
        const Branch = yield* Effect.tryPromise({
            catch: (Cause: unknown) => new Error(
                "Cannot inspect the Git checkout; ensure Git is available and HEAD is attached. "
                + String(Cause)
            ),
            try: () => Git.raw([ "symbolic-ref", "--quiet", "--short", "HEAD" ])
        });
        if (!Branch.trim())
        {
            return yield* Effect.fail(new Error(
                "Ensure HEAD is attached before pulling; detached HEAD detected."
            ));
        }

        if (Branch.trim() !== "Master")
        {
            return yield* Effect.fail(new Error(
                `Check out Master before pulling (current branch: ${Branch.trim()}).`
            ));
        }

        const Remotes = yield* Effect.tryPromise({
            catch: (Cause: unknown) => new Error(`Cannot list Git remotes: ${String(Cause)}`),
            try: () => Git.raw([ "remote" ])
        });
        return yield* SelectRemote(Remotes.trim().split(/\r?\n/u).filter(Boolean));
    });
}

/**
 * Pulls remote Master using Git's configured integration behavior.
 * The child-only marker prevents a duplicate Beads pull from the Git hooks.
 *
 * @category Git
 * @since 1.0.0
 */
export function PullGit(Root: string, Remote: string): Effect.Effect<PullOutcome>
{
    // Match simple-git's ambient environment filtering before making the
    // child environment explicit. Forwarding guarded keys rejects the task.
    const Guarded = new Set([ "editor", "pager", "prefix", "ssh_askpass", "visual" ]);
    const Environment = Object.fromEntries(Object.entries(process.env).filter(([ Key ]: [string, string?]) =>
        !Key.toLowerCase().startsWith("git_") && !Guarded.has(Key.toLowerCase())));
    return Effect.tryPromise({
        catch: (Cause: unknown) => new Error(String(Cause)),
        try: () => simpleGit(Root).env({
            ...Environment,
            PullMonorepoActive: "1"
        }).raw([ "pull", Remote, "Master" ])
    }).pipe(Effect.match({
        onFailure: (Error: Error): PullOutcome => ({ detail: Error.message,
            name: "Git",
            status: "failed" }),
        onSuccess: (Output: string): PullOutcome => ({ detail: Output.trim() || "Master is up to date.",
            name: "Git",
            status: "success" })
    }));
}

/**
 * Runs the Beads pull through the Node process service, draining both output
 * streams while waiting. Only a missing executable is skipped. Command
 * injection permits isolated process fixtures without touching real Beads data.
 *
 * @category Beads
 * @since 1.0.0
 */
export function PullBeads(
    Root: string,
    Command: ChildProcess.Command = ChildProcess.make("bd", [ "dolt", "pull" ], { cwd: Root,
        stdin: "ignore" })
): Effect.Effect<PullOutcome, never, ChildProcessSpawner.ChildProcessSpawner>
{
    return Effect.scoped(Effect.gen(function*()
    {
        const Started = yield* Effect.result(Command);
        if (Result.isFailure(Started))
        {
            return {
                detail: Started.failure.reason._tag === "NotFound"
                    ? "bd is not installed or is not on PATH; skipped."
                    : Started.failure.message,
                name: "Beads",
                status: Started.failure.reason._tag === "NotFound" ? "skipped" : "failed"
            } satisfies PullOutcome;
        }

        const Handle = Started.success;
        const [ Output, Code ] = yield* Effect.all([
            Handle.all.pipe(
                Stream.decodeText(),
                Stream.runFold(() => "", (Text: string, Part: string) => Text + Part)
            ),
            Handle.exitCode
        ], { concurrency: "unbounded" });
        return {
            detail: Output.trim() || (Code === 0
                ? "Beads data is up to date."
                : `bd dolt pull exited with code ${Code}.`),
            name: "Beads",
            status: Code === 0 ? "success" : "failed"
        } satisfies PullOutcome;
    })).pipe(
        Effect.catch((Error: PlatformError.PlatformError) => Effect.succeed<PullOutcome>({
            detail: Error.message,
            name: "Beads",
            status: "failed"
        })),
        // Node may throw synchronously for an invalid executable on Windows.
        Effect.catchDefect((Cause: unknown) => Effect.succeed<PullOutcome>({
            detail: String(Cause),
            name: "Beads",
            status: "failed"
        }))
    );
}

/**
 * Runs independent pulls concurrently and reports completion without cancelling
 * the sibling operation when an attempted pull fails.
 *
 * @category Runtime
 * @since 1.0.0
 */
export function RunPulls<Requirements>(
    Git: Effect.Effect<PullOutcome, never, Requirements>,
    Beads: Effect.Effect<PullOutcome, never, Requirements>,
    OnComplete: (Outcome: PullOutcome) => void
): Effect.Effect<Array<PullOutcome>, never, Requirements>
{
    return Effect.all([ Git, Beads ].map((Operation: Effect.Effect<PullOutcome, never, Requirements>) =>
        Operation.pipe(Effect.tap((Outcome: PullOutcome) => Effect.sync(() => OnComplete(Outcome))))),
    { concurrency: "unbounded" });
}
