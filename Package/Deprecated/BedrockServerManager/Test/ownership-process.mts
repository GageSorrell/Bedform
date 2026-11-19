/**
 * Cooperating CLI ownership fixture; never launches a native BDS executable.
 *
 * @module bedrock-server-manager/Test/ownership-process
 *
 * @file      ownership-process.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import { withServerOwnership } from "../Distribution/start-ownership.js";

const context: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    home: string;
    platform: NodeJS.Platform;
} = {
    cwd: process.cwd(),
    env: process.env,
    home: process.cwd(),
    platform: process.platform
};
Effect.runPromise(
    withServerOwnership(
        context,
        {
            server: process.argv[2],
            stdin: { isTTY: true },
            stdout: { isTTY: true }
        },
        (ownership) =>
            Effect.gen(function* ()
            {
                // This fixture models a child lifetime using its own PID, without starting BDS.
                yield* ownership.recordChild(process.pid);
                yield* Effect.promise(
                    () =>
                        new Promise<void>(
                            (resolve: (value: void | PromiseLike<void>) => void) =>
                            {
                                process.stdin.once("data", () =>
                                {
                                    process.stdin.pause();
                                    resolve();
                                });
                                process.stdout.write("READY\n");
                            }
                        )
                );
                yield* ownership.childClosed();
            }),
        { inspect: () => Effect.succeed([]) }
    ).pipe(Effect.provide(NodeServices.layer))
).then(
    () => process.stdout.write("RELEASED\n"),
    (error) =>
    {
        process.stderr.write(String(error));
        process.exitCode = 1;
    }
);
