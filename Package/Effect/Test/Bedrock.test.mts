/**
 * Runs Effect programs through `@bedform/effect/Bedrock` in a sandbox that has
 * only ECMAScript built-ins, driven by a simulated game tick loop, and audits
 * the emitted library for host globals that Bedrock does not provide.
 *
 * @module @bedform/effect/Test/Bedrock.test
 *
 * @file      Bedrock.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Embedded consumer programs, harness option objects and contextual callbacks follow the test precedent. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

/* Sandbox results cross the vm boundary untyped. */

import * as Assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { build } from "esbuild";
import TypeScript from "typescript";

const PackageRoot: string = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The outcome of a sandboxed program.
 *
 * @category Tests
 * @since 1.0.0
 */
interface Outcome
{
    readonly log: ReadonlyArray<string>;
    readonly warnings: ReadonlyArray<string>;
    readonly pending: number;
    readonly ticks: number;
    readonly leakedGlobals: ReadonlyArray<string>;
}

/**
 * A callback scheduled on the simulated tick loop.
 *
 * @category Tests
 * @since 1.0.0
 */
interface Job
{
    readonly due: number;
    readonly callback: () => void;
}

/**
 * Bundles a program that imports `@bedform/effect` and runs it in a fresh vm
 * context with a simulated `system`, until it calls `done()` or the tick limit
 * is reached. The program sees `system`, `shutdown`, `log`, `done` and a
 * console whose `warn` is recorded.
 *
 * @category Tests
 * @since 1.0.0
 */
async function runOnTicks(program: string, maxTicks: number = 400): Promise<Outcome>
{
    const bundle = await build({
        stdin: { contents: program,
            resolveDir: PackageRoot,
            loader: "ts" },
        bundle: true,
        format: "iife",
        platform: "neutral",
        mainFields: [ "module", "main" ],
        target: "es2022",
        write: false
    });
    let tick: number = 0;
    let nextId: number = 1;
    let finished: boolean = false;
    const jobs = new Map<number, Job>();
    const shutdownCallbacks: Array<() => void> = [];
    const log: Array<string> = [];
    const warnings: Array<string> = [];
    const system = {
        inRunCallback: false,
        get currentTick(): number
        {
            return tick;
        },
        run(callback: () => void): number
        {
            const id: number = nextId++;
            jobs.set(id, { due: tick + 1,
                callback });
            return id;
        },
        runTimeout(callback: () => void, tickDelay: number = 1): number
        {
            const id: number = nextId++;
            jobs.set(id, { due: tick + Math.max(1, Math.trunc(tickDelay)),
                callback });
            return id;
        },
        clearRun(id: number): void
        {
            jobs.delete(id);
        }
    };
    const context = createContext({
        system,
        shutdown: {
            subscribe: (callback: () => void): void =>
            {
                shutdownCallbacks.push(callback);
            },
            fire: (): void => shutdownCallbacks.forEach((callback) => callback())
        },
        log: (message: string): void =>
        {
            log.push(`t${tick} ${message}`);
        },
        done: (): void =>
        {
            finished = true;
        },
        console: {
            log: (): void => undefined,
            warn: (message: string): void =>
            {
                warnings.push(String(message));
            }
        }
    });
    const leakedGlobals: Array<string> = [
        "setTimeout", "setImmediate", "queueMicrotask", "performance", "process", "crypto", "AbortController",
        "TextEncoder", "TextDecoder", "structuredClone", "Buffer", "URL"
    ].filter((name) => runInContext(`typeof ${name}`, context) !== "undefined");
    runInContext(bundle.outputFiles[0].text, context, { timeout: 5000 });
    const settle = (): Promise<void> => new Promise((done) => setImmediate(done));
    await settle();
    while (!finished && tick < maxTicks)
    {
        tick++;
        for (const [ id, job ] of [ ...jobs ])
        {
            if (job.due <= tick)
            {
                jobs.delete(id);
                system.inRunCallback = true;
                try
                {
                    job.callback();
                }
                finally
                {
                    system.inRunCallback = false;
                }
            }
        }

        await settle();
    }

    Assert.ok(finished, `program did not finish within ${maxTicks} ticks:\n${log.join("\n")}`);
    return { leakedGlobals,
        log,
        pending: jobs.size,
        ticks: tick,
        warnings };
}

test("layers, services, scoped resources, schedules and interruption run on game ticks", async () =>
{
    const outcome = await runOnTicks(`
        import { Bedrock, Context, Deferred, Effect, Fiber, Layer, Schedule } from "@bedform/effect";
        declare const system: Bedrock.TickSystem, log: (m: string) => void, done: () => void;
        class Database extends Context.Service<Database, { readonly query: (sql: string) => Effect.Effect<string> }>()("Database") {}
        class Machines extends Context.Service<Machines, { readonly count: Effect.Effect<number> }>()("Machines") {}
        const DatabaseLive = Layer.effect(Database, Effect.gen(function* () {
            yield* Effect.acquireRelease(Effect.sync(() => log("db open")), () => Effect.sync(() => log("db close")));
            return { query: (sql: string) => Effect.succeed("rows(" + sql + ")") };
        }));
        const MachinesLive = Layer.effect(Machines, Effect.gen(function* () {
            const database = yield* Database;
            let beats = 0;
            yield* Effect.addFinalizer(() => Effect.sync(() => log("machines close")));
            yield* Effect.forkScoped(Effect.repeat(Effect.sync(() => log("beat " + ++beats)), Schedule.spaced("100 millis")));
            return { count: Effect.map(database.query("machines"), () => beats) };
        })).pipe(Layer.provide(DatabaseLive));
        const program = Effect.gen(function* () {
            const machines = yield* Machines;
            yield* Effect.sleep("250 millis");
            log("count " + (yield* machines.count));
            yield* Effect.scoped(Effect.gen(function* () {
                yield* Effect.acquireRelease(Effect.sync(() => log("lock")), () => Effect.sync(() => log("unlock")));
                yield* Effect.sleep(Bedrock.ticks(1));
            }));
            const gate = yield* Deferred.make<string>();
            const waiter = yield* Effect.forkChild(Effect.flatMap(Deferred.await(gate), (value) => Effect.sync(() => log("gate " + value))));
            const sleeper = yield* Effect.forkChild(Effect.onInterrupt(Effect.sleep("1 hour"), () => Effect.sync(() => log("sleeper interrupted"))));
            yield* Effect.sleep(Bedrock.ticks(1));
            yield* Deferred.succeed(gate, "open");
            yield* Fiber.join(waiter);
            yield* Fiber.interrupt(sleeper);
        });
        Effect.runFork(program.pipe(Effect.provide(MachinesLive), Effect.provide(Bedrock.layer(system)), Effect.ensuring(Effect.sync(done))));
    `);
    Assert.deepEqual(outcome.leakedGlobals, []);
    Assert.equal(outcome.log[0], "t0 db open");
    Assert.deepEqual(outcome.log.filter((entry) => entry.includes("beat")).slice(0, 4), [ "t0 beat 1", "t2 beat 2", "t4 beat 3", "t6 beat 4" ]);
    Assert.ok(outcome.log.includes("t5 count 3"), outcome.log.join("\n"));
    Assert.ok(outcome.log.includes("t5 lock") && outcome.log.includes("t6 unlock"), outcome.log.join("\n"));
    Assert.ok(outcome.log.includes("t7 gate open") && outcome.log.includes("t7 sleeper interrupted"), outcome.log.join("\n"));
    Assert.deepEqual(outcome.log.slice(-2), [ "t7 machines close", "t7 db close" ]);
    Assert.equal(outcome.pending, 0, "interrupted sleeps and schedules clear their tick callbacks");
});

test("sleeps round up to whole ticks and ticks() converts tick counts", async () =>
{
    const outcome = await runOnTicks(`
        import { Bedrock, Effect } from "@bedform/effect";
        declare const system: Bedrock.TickSystem, log: (m: string) => void, done: () => void;
        const measure = (label: string, effect: Effect.Effect<void>) => Effect.gen(function* () {
            const start = system.currentTick;
            yield* effect;
            log(label + " " + (system.currentTick - start));
        });
        Effect.runFork(Effect.gen(function* () {
            yield* measure("120ms", Effect.sleep("120 millis"));
            yield* measure("1ms", Effect.sleep("1 millis"));
            yield* measure("4 ticks", Effect.sleep(Bedrock.ticks(4)));
            yield* measure("0ms", Effect.sleep(0));
        }).pipe(Effect.provide(Bedrock.layer(system)), Effect.ensuring(Effect.sync(done))));
    `);
    Assert.deepEqual(outcome.log.map((entry) => entry.replace(/^t\d+ /, "")), [ "120ms 3", "1ms 1", "4 ticks 4", "0ms 0" ]);
});

test("the scheduler budget spreads long work across ticks and zero budget defers every yield", async () =>
{
    const run = (budget: string): Promise<Outcome> => runOnTicks(`
        import { Bedrock, Effect } from "@bedform/effect";
        declare const system: Bedrock.TickSystem, log: (m: string) => void, done: () => void;
        const start = system.currentTick;
        let sum = 0;
        Effect.runFork(Effect.forEach(Array.from({ length: 5000 }, (_, i) => i), (i) => Effect.sync(() => { sum += i; }), { discard: true }).pipe(
            Effect.andThen(Effect.sync(() => log("sum " + sum + " ticks " + (system.currentTick - start)))),
            Effect.provide(Bedrock.layer(system, ${budget})),
            Effect.ensuring(Effect.sync(done))));
    `);
    const unbudgeted = await run("{ budgetMillis: 0 }");
    const spread = Number(/ticks (\d+)/.exec(unbudgeted.log[0])![1]);
    Assert.match(unbudgeted.log[0], /sum 12497500 /);
    Assert.ok(spread >= 2, `zero budget should yield to later ticks, spanned ${spread}`);
    const budgeted = await run("{ budgetMillis: 2 }");
    Assert.match(budgeted.log[0], /sum 12497500 ticks 0$/);
});

test("per-tick work stays within the scheduler budget on a simulated clock", async () =>
{
    // Each step advances a simulated clock by 0.1 microseconds, so the budget check is independent of host load.
    const outcome = await runOnTicks(`
        import { Bedrock, Effect } from "@bedform/effect";
        declare const system: Bedrock.TickSystem, log: (m: string) => void, done: () => void;
        let now = 0;
        Date.now = () => now;
        const spans = new Map<number, [number, number]>();
        Effect.runFork(Effect.forEach(Array.from({ length: 200_000 }, (_, i) => i), () => Effect.sync(() =>
        {
            now += 0.0001;
            const span = spans.get(system.currentTick);
            if (span === undefined) spans.set(system.currentTick, [ now, now ]);
            else span[1] = now;
        }), { discard: true }).pipe(
            Effect.andThen(Effect.sync(() => log(JSON.stringify([ ...spans.values() ].map(([ first, last ]) => last - first))))),
            Effect.provide(Bedrock.layer(system, { budgetMillis: 2 })),
            Effect.ensuring(Effect.sync(done))));
    `);
    const spans: Array<number> = JSON.parse(outcome.log[0].replace(/^t\d+ /u, "")) as Array<number>;
    Assert.ok(spans.length >= 8, `20 ms of simulated work should span at least 8 ticks, spanned ${spans.length}`);
    Assert.ok(spans.every((span) => span < 2.5), `a tick exceeded the 2 ms budget by more than one slice: ${spans.join(", ")}`);
    Assert.ok(spans.slice(0, -1).every((span) => span >= 1.5), `a tick handed off well before its budget: ${spans.join(", ")}`);
});

test("nextTick resumes from a system.run callback on the following tick", async () =>
{
    const outcome = await runOnTicks(`
        import { Bedrock, Effect } from "@bedform/effect";
        declare const system: Bedrock.TickSystem & { readonly inRunCallback: boolean }, log: (m: string) => void, done: () => void;
        Effect.runFork(Effect.gen(function* () {
            const start = system.currentTick;
            yield* Bedrock.nextTick;
            log("after " + (system.currentTick - start) + " in run " + system.inRunCallback);
        }).pipe(Effect.provide(Bedrock.layer(system)), Effect.ensuring(Effect.sync(done))));
    `);
    Assert.deepEqual(outcome.log, [ "t1 after 1 in run true" ]);
});

test("disposeOnShutdown runs synchronous finalizers and warns when a finalizer waits", async () =>
{
    const outcome = await runOnTicks(`
        import { Bedrock, Context, Effect, Layer, ManagedRuntime } from "@bedform/effect";
        declare const system: Bedrock.TickSystem, log: (m: string) => void, done: () => void;
        declare const shutdown: Bedrock.ShutdownSignal & { fire(): void };
        class Store extends Context.Service<Store, { readonly name: string }>()("Store") {}
        const make = (name: string, wait: boolean) => Layer.effect(Store, Effect.gen(function* () {
            yield* Effect.addFinalizer(() => wait
                ? Effect.andThen(Effect.sleep(Bedrock.ticks(1)), Effect.sync(() => log(name + " late close")))
                : Effect.sync(() => log(name + " close")));
            return { name };
        }));
        const quick = ManagedRuntime.make(Layer.mergeAll(Bedrock.layer(system), make("quick", false)));
        const slow = ManagedRuntime.make(Layer.mergeAll(Bedrock.layer(system), make("slow", true)));
        Bedrock.disposeOnShutdown(quick, shutdown);
        Bedrock.disposeOnShutdown(slow, shutdown);
        Promise.all([ quick.runPromise(Store.use((s) => Effect.succeed(s.name))), slow.runPromise(Store.use((s) => Effect.succeed(s.name))) ])
            .then((names) => { log("built " + names.join(",")); shutdown.fire(); log("fired"); done(); });
    `);
    Assert.deepEqual(outcome.log.map((entry) => entry.replace(/^t\d+ /, "")), [ "built quick,slow", "quick close", "fired" ]);
    Assert.equal(outcome.warnings.length, 1);
    Assert.match(outcome.warnings[0], /runtime disposal at shutdown did not complete/);
});

test("runSync serves before-event handlers with synchronous layers", async () =>
{
    const outcome = await runOnTicks(`
        import { Context, Effect, Layer } from "@bedform/effect";
        declare const log: (m: string) => void, done: () => void;
        class Rules extends Context.Service<Rules, { readonly canBreak: (block: string) => boolean }>()("Rules") {}
        const RulesLive = Layer.succeed(Rules, { canBreak: (block: string) => block !== "bedrock" });
        const cancel = (block: string): boolean => Effect.runSync(Effect.provide(Rules.use((rules) => Effect.succeed(!rules.canBreak(block))), RulesLive));
        log("stone " + cancel("stone") + ", bedrock " + cancel("bedrock"));
        done();
    `);
    Assert.deepEqual(outcome.log, [ "t0 stone false, bedrock true" ]);
});

test("without the Bedrock layer, sleeping fails with guidance instead of a ReferenceError", async () =>
{
    const outcome = await runOnTicks(`
        import { Cause, Effect, Exit } from "@bedform/effect";
        declare const log: (m: string) => void, done: () => void;
        Effect.runPromiseExit(Effect.sleep("10 millis")).then((exit) => {
            log(Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "succeeded");
            done();
        });
    `);
    Assert.match(outcome.log[0], /provide Bedrock\.layer\(system\)/);
    Assert.doesNotMatch(outcome.log[0], /ReferenceError/);
});

test("Random, abort signals and the default console work without crypto, AbortController or TextEncoder", async () =>
{
    const outcome = await runOnTicks(`
        import { Bedrock, Effect, Fiber, Random } from "@bedform/effect";
        declare const system: Bedrock.TickSystem, log: (m: string) => void, done: () => void;
        let captured: any;
        Effect.runFork(Effect.gen(function* () {
            const value = yield* Random.next;
            const seeded = yield* Random.withSeed(Random.nextInt, "seed");
            log("random " + (value >= 0 && value < 1) + " seeded " + Number.isInteger(seeded));
            const fiber = yield* Effect.forkChild(Effect.tryPromise({ try: (signal) => { captured = signal; return new Promise(() => {}); }, catch: String }));
            yield* Effect.sleep(Bedrock.ticks(1));
            yield* Fiber.interrupt(fiber);
            log("aborted " + captured.aborted + " " + captured.reason.name);
            yield* Effect.log("logged through the host console");
        }).pipe(Effect.provide(Bedrock.layer(system)), Effect.ensuring(Effect.sync(done))));
    `);
    Assert.deepEqual(outcome.log.map((entry) => entry.replace(/^t\d+ /, "")), [ "random true seeded true", "aborted true AbortError" ]);
});

test("emitted library code uses no unguarded host globals and imports nothing outside the package", () =>
{
    const Forbidden: ReadonlySet<string> = new Set([
        "setTimeout", "clearTimeout", "setImmediate", "clearImmediate", "setInterval", "queueMicrotask", "performance",
        "crypto", "AbortController", "AbortSignal", "TextEncoder", "TextDecoder", "process", "require", "Buffer",
        "URL", "URLSearchParams", "fetch", "structuredClone", "window", "self"
    ]);
    const findings: Array<string> = [];
    const visitDirectory = (directory: string): void =>
    {
        for (const entry of readdirSync(directory, { withFileTypes: true }))
        {
            const path: string = join(directory, entry.name);
            if (entry.isDirectory())
            {
                visitDirectory(path);
            }
            else if (entry.name.endsWith(".js"))
            {
                const file = TypeScript.createSourceFile(path, readFileSync(path, "utf8"), TypeScript.ScriptTarget.Latest, true);
                const declared = new Set<string>();
                const collect = (node: TypeScript.Node): void =>
                {
                    if ((TypeScript.isVariableDeclaration(node) || TypeScript.isFunctionDeclaration(node) ||
                        TypeScript.isParameter(node) || TypeScript.isClassDeclaration(node)) && node.name && TypeScript.isIdentifier(node.name))
                    {
                        declared.add(node.name.text);
                    }

                    TypeScript.forEachChild(node, collect);
                };

                collect(file);
                const visit = (node: TypeScript.Node): void =>
                {
                    if (TypeScript.isImportDeclaration(node) || TypeScript.isExportDeclaration(node))
                    {
                        const specifier = node.moduleSpecifier as TypeScript.StringLiteral | undefined;
                        if (specifier && !specifier.text.startsWith("."))
                        {
                            findings.push(`${path}: imports ${specifier.text}`);
                        }
                    }

                    if (TypeScript.isIdentifier(node) && Forbidden.has(node.text) && !declared.has(node.text))
                    {
                        const parent = node.parent;
                        const isMemberName: boolean = (TypeScript.isPropertyAccessExpression(parent) && parent.name === node) ||
                            (TypeScript.isPropertyAssignment(parent) && parent.name === node) ||
                            TypeScript.isMethodDeclaration(parent) || TypeScript.isPropertyDeclaration(parent);
                        if (!isMemberName)
                        {
                            findings.push(`${path}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${node.text}`);
                        }
                    }

                    TypeScript.forEachChild(node, visit);
                };

                visit(file);
            }
        }
    };

    visitDirectory(join(PackageRoot, "Distribution"));
    Assert.deepEqual(findings, []);
});

test("packed consumers type Bedrock against @minecraft/server and tree-shake the runtime away from pure imports", async () =>
{
    const npm = process.env.npm_execpath;
    Assert.ok(npm, "Run through npm run test:runtime");
    const temporary: string = mkdtempSync(join(tmpdir(), "bedform-effect-runtime-"));
    try
    {
        const packing = JSON.parse(execFileSync(process.execPath, [ npm, "pack", "--json", "--ignore-scripts", "--pack-destination", temporary ],
            { cwd: PackageRoot,
                encoding: "utf8" }));
        const packed = (Array.isArray(packing) ? packing : Object.values(packing))[0] as { filename: string };
        writeFileSync(join(temporary, "package.json"), JSON.stringify({ name: "runtime-consumer",
            private: true,
            type: "module" }));
        execFileSync(process.execPath, [ npm, "install", "--ignore-scripts", "--no-audit", "--no-fund", join(temporary, packed.filename) ],
            { cwd: temporary,
                encoding: "utf8" });
        const serverTypes: string = fileURLToPath(new URL("../../../node_modules/@minecraft/server/index.d.ts", import.meta.url));
        writeFileSync(join(temporary, "consumer.ts"), `
            import type { ShutdownBeforeEventSignal, System } from ${JSON.stringify(serverTypes.replace(/\.d\.ts$/, ".js"))};
            import { Bedrock, Context, Effect, Layer, ManagedRuntime } from "@bedform/effect";
            import * as Direct from "@bedform/effect/Bedrock";
            declare const system: System;
            declare const shutdown: ShutdownBeforeEventSignal;
            class Greeter extends Context.Service<Greeter, { readonly greet: (name: string) => Effect.Effect<string> }>()("Greeter") {}
            const GreeterLive = Layer.succeed(Greeter, { greet: (name: string) => Effect.succeed("hi " + name) });
            const runtime = ManagedRuntime.make(Layer.mergeAll(Direct.layer(system), GreeterLive));
            Bedrock.disposeOnShutdown(runtime, shutdown);
            const greeting: Promise<string> = runtime.runPromise(Greeter.use((greeter) => greeter.greet("Steve")));
            // @ts-expect-error Private implementation paths are blocked.
            import * as Private from "@bedform/effect/Distribution/Internal/effect.js";
        `);
        writeFileSync(join(temporary, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true,
            noEmit: true,
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            skipLibCheck: true,
            types: [] },
        files: [ "consumer.ts" ] }));
        execFileSync(process.execPath, [ fileURLToPath(import.meta.resolve("typescript/lib/tsc.js")), "-p", join(temporary, "tsconfig.json") ],
            { cwd: temporary,
                encoding: "utf8" });
        const shaken = await build({ stdin: { contents: "import { Option } from \"@bedform/effect\"; globalThis.value = Option.some(1);",
            resolveDir: temporary },
        bundle: true,
        platform: "neutral",
        write: false,
        treeShaking: true,
        format: "esm" });
        const text: string = shaken.outputFiles[0].text;
        // Redactable's current-fiber key is shared by pure modules, as upstream; the executor is not.
        for (const marker of [ "effect/Scheduler", "MixedScheduler", "~effect/Layer", "effect/Bedrock/TickSystem" ])
        {
            Assert.ok(!text.includes(marker), `pure imports must not bundle the runtime (${marker})`);
        }
    }
    finally
    {
        Assert.equal(dirname(temporary), resolve(tmpdir()));
        rmSync(temporary, { recursive: true,
            force: true });
    }
});
