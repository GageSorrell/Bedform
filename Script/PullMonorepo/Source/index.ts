/**
 * Pull command entrypoint and terminal progress display.
 *
 * @file index.ts
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Preflight, PullBeads, PullGit, RunPulls } from "./pull.js";
import { intro, log, outro, spinner } from "@clack/prompts";
import { Effect } from "effect";
import type { PullOutcome } from "./pull.js";
import { fileURLToPath } from "node:url";

const Root = fileURLToPath(new URL("../../../", import.meta.url));
const Progress = spinner();
const Pending = new Set([ "Git", "Beads" ]);

const Program = Effect.gen(function*()
{
    intro("Pull monorepo");
    log.step("Checking Git, branch, and remotes…");
    const Remote = yield* Preflight(Root);
    log.info(`Pulling ${Remote}/Master and optional Beads data.`);
    Progress.start("Running Git and Beads pulls…");
    const Outcomes = yield* RunPulls(PullGit(Root, Remote), PullBeads(Root), (Outcome: PullOutcome) =>
    {
        Pending.delete(Outcome.name);
        Progress.message(Pending.size > 0 ? `Waiting for ${[ ...Pending ].join(" and ")}…` : "Finishing…");
    });
    Progress.stop("Pull operations finished.");
    for (const Outcome of Outcomes)
    {
        const Message = `${Outcome.name}: ${Outcome.detail}`;
        if (Outcome.status === "failed")
        {
            log.error(Message);
        }
        else if (Outcome.status === "skipped")
        {
            log.warn(Message);
        }
        else
        {
            log.success(Message);
        }
    }

    const Failed = Outcomes.some((Outcome: PullOutcome) => Outcome.status === "failed");
    process.exitCode = Failed ? 1 : 0;
    outro(Failed ? "Pull finished with errors; review the results above." : "Monorepo pull complete.");
}).pipe(
    Effect.catch((Error: Error) => Effect.sync(() =>
    {
        log.error(Error.message);
        outro("Pull could not start.");
        process.exitCode = 1;
    })),
    Effect.ensuring(Effect.sync(() => Progress.stop())),
    Effect.provide(NodeServices.layer)
);

NodeRuntime.runMain(Program, { disableErrorReporting: true });
