/**
 * Compiled setup executable with an import-safe Node runtime boundary.
 *
 * @module monorepo-setup/index
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { ComponentLayer, ConsentLayer, ProbeLayer, ProcessLayer, ReportingLayer } from "./Node.js";
import { Console, Effect, Layer } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { RunCli } from "./Cli.js";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { resolve } from "node:path";

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
    const services = Layer.mergeAll(
        ComponentLayer, ConsentLayer, ProbeLayer, ProcessLayer, ReportingLayer
    ).pipe(
        Layer.provideMerge(NodeServices.layer)
    );
    NodeRuntime.runMain(RunCli(process.argv.slice(2)).pipe(
        Effect.provide(services),
        Effect.catch((error: unknown) => Console.error(String(error)).pipe(
            Effect.andThen(Effect.sync(() => { process.exitCode = 1; }))
        ))
    ));
}
