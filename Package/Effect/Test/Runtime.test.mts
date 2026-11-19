/**
 * Differential and parity tests for the Effect runtime modules vendored from
 * the pinned `effect@4.0.5` release.
 *
 * @module @bedform/effect/Test/Runtime.test
 *
 * @file      Runtime.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Upstream and port modules are compared through untyped namespaces with contextual callbacks. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, @stylistic/max-len */

import * as Assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import TypeScript from "typescript";
import * as Root from "@bedform/effect";

/**
 * Runtime modules added by the runtime scope extension, all public.
 *
 * @category Tests
 * @since 1.0.0
 */
const RuntimeModules: ReadonlyArray<string> = [
    "Cause", "Clock", "Console", "Context", "Cron", "Deferred", "Effect", "Effectable", "ErrorReporter",
    "ExecutionPlan", "Exit", "Fiber", "Filter", "Latch", "Layer", "LogLevel", "ManagedRuntime", "Metric",
    "MutableHashMap", "MutableRef", "Pull", "Random", "Redactable", "Ref", "References", "Request",
    "Schedule", "Scheduler", "Scope", "Tracer", "TxRef"
];

/**
 * Top-level interfaces whose nested object types were extracted into namespaces.
 *
 * @category Tests
 * @since 1.0.0
 */
const ExtractedInterfaces: ReadonlySet<string> = new Set([ "Context", "Cron", "Effect", "Variance", "Any" ]);

/**
 * Loads a module namespace from both the port and the pinned upstream release.
 *
 * @category Tests
 * @since 1.0.0
 */
async function both(module: string): Promise<[ any, any ]>
{
    return [ await import(`@bedform/effect/${module}`), await import(`effect/${module}`) ];
}

/**
 * Prints every exported declaration of a declaration file, keyed by kind and name.
 *
 * @category Tests
 * @since 1.0.0
 */
function exportedDeclarations(url: URL): Map<string, string>
{
    const Printer = TypeScript.createPrinter({ removeComments: true });
    // Newer TypeScript disambiguates repeated `infer` names with numeric suffixes in emitted declarations.
    const source: string = readFileSync(url, "utf8").replaceAll(".ts\"", ".js\"")
        .replaceAll("/Internal/", "/internal/")
        .replaceAll("/Encoding/", "/encoding/")
        .replaceAll("/Schema/", "/schema/").replace(/\b(_[A-Za-z]+)_\d+\b/g, "$1");
    const parsed = TypeScript.createSourceFile(url.pathname, source, TypeScript.ScriptTarget.Latest, true);
    // Upstream emits with stripInternal; the port keeps @internal declarations and members documented.
    const isInternal = (node: TypeScript.Node): boolean =>
        !TypeScript.isSourceFile(node) && TypeScript.getJSDocTags(node).some((tag) => tag.tagName.text === "internal");
    const stripInternal: TypeScript.TransformerFactory<TypeScript.SourceFile> = (context) => (root) =>
    {
        const visit = (node: TypeScript.Node): TypeScript.Node | undefined =>
            (isInternal(node) ? undefined : TypeScript.visitEachChild(node, visit, context));
        return TypeScript.visitNode(root, visit) as TypeScript.SourceFile;
    };

    const file: TypeScript.SourceFile = TypeScript.transform(parsed, [ stripInternal ]).transformed[0];
    const Declarations = new Map<string, string>();
    for (const statement of file.statements)
    {
        const exported: boolean = TypeScript.canHaveModifiers(statement) &&
            (TypeScript.getModifiers(statement) ?? []).some((modifier) => modifier.kind === TypeScript.SyntaxKind.ExportKeyword);
        if (!exported)
        {
            continue;
        }

        const print = (): string => Printer.printNode(TypeScript.EmitHint.Unspecified, statement, parsed);
        if (TypeScript.isVariableStatement(statement))
        {
            for (const declaration of statement.declarationList.declarations)
            {
                Declarations.set(`const ${(declaration.name as TypeScript.Identifier).text}`, print());
            }
        }
        else if (TypeScript.isInterfaceDeclaration(statement) || TypeScript.isTypeAliasDeclaration(statement) ||
            TypeScript.isFunctionDeclaration(statement) || TypeScript.isClassDeclaration(statement))
        {
            const kind: string = TypeScript.SyntaxKind[statement.kind];
            const name: string = statement.name?.text ?? "default";
            const key: string = `${kind} ${name}`;
            Declarations.set(key, `${Declarations.get(key) ?? ""}${print()}\n`);
        }
        else if (TypeScript.isModuleDeclaration(statement))
        {
            Declarations.set(`namespace ${(statement.name as TypeScript.Identifier).text}`, "namespace");
        }
    }

    return Declarations;
}

test("runtime modules expose the complete pinned runtime surface through root and direct imports", async () =>
{
    for (const module of RuntimeModules)
    {
        const [ Port, Upstream ] = await both(module);
        Assert.deepEqual(Object.keys(Port).sort(), Object.keys(Upstream).sort(), module);
        Assert.strictEqual((Root as any)[module], Port, `root namespace ${module}`);
    }

    Assert.equal(typeof (Root as any).Bedrock.layer, "function");
});

test("runtime declarations keep every upstream export and signature apart from documented extractions", () =>
{
    let compared: number = 0;
    for (const module of RuntimeModules)
    {
        const Local = exportedDeclarations(new URL(`../Distribution/${module}.d.ts`, import.meta.url));
        const Upstream = exportedDeclarations(new URL(import.meta.resolve(`effect/${module}`).replace(/\.js$/, ".d.ts")));
        const localNames: Array<string> = [ ...Local.keys() ].filter((key) => !key.startsWith("namespace ")).sort();
        const upstreamNames: Array<string> = [ ...Upstream.keys() ].filter((key) => !key.startsWith("namespace ")).sort();
        Assert.deepEqual(localNames, upstreamNames, `${module} exported declarations`);
        for (const [ key, signature ] of Local)
        {
            const name: string = key.split(" ")[1];
            if (key.startsWith("namespace ") || (key.startsWith("InterfaceDeclaration ") && ExtractedInterfaces.has(name)))
            {
                continue;
            }

            Assert.equal(signature, Upstream.get(key), `${module}: ${key}`);
            compared++;
        }
    }

    Assert.ok(compared >= 800, `compared ${compared} declarations`);
});

/**
 * The upstream namespaces a behavioral scenario receives.
 *
 * @category Tests
 * @since 1.0.0
 */
interface Library
{
    readonly Cause: any;
    readonly Context: any;
    readonly Data: any;
    readonly Deferred: any;
    readonly Effect: any;
    readonly Exit: any;
    readonly Fiber: any;
    readonly Layer: any;
    readonly ManagedRuntime: any;
    readonly Ref: any;
    readonly Schedule: any;
}

/**
 * Loads one library's namespaces for a scenario.
 *
 * @category Tests
 * @since 1.0.0
 */
async function library(prefix: string): Promise<Library>
{
    const load = async (module: string): Promise<any> => import(`${prefix}/${module}`);
    return {
        Cause: await load("Cause"),
        Context: await load("Context"),
        Data: await load("Data"),
        Deferred: await load("Deferred"),
        Effect: await load("Effect"),
        Exit: await load("Exit"),
        Fiber: await load("Fiber"),
        Layer: await load("Layer"),
        ManagedRuntime: await load("ManagedRuntime"),
        Ref: await load("Ref"),
        Schedule: await load("Schedule")
    };
}

/**
 * Behavioral scenarios, each run against the port and upstream and compared.
 *
 * @category Tests
 * @since 1.0.0
 */
const Scenarios: Record<string, (lib: Library) => Promise<unknown>> = {
    "deferred, fork, join and interrupt": async ({ Deferred, Effect, Fiber }) =>
    {
        const log: Array<string> = [];
        await Effect.runPromise(Effect.gen(function* ()
        {
            const gate = yield* Deferred.make();
            const started = yield* Deferred.make();
            const waiter = yield* Effect.forkChild(Effect.map(Deferred.await(gate), (value: string) => log.push(`got ${value}`)));
            // The sleeper reports from inside its interrupt handler's scope; a host-time sleep loses to a stalled event loop.
            const sleeper = yield* Effect.forkChild(Effect.onInterrupt(
                Effect.andThen(Deferred.succeed(started, undefined), Effect.sleep("1 hour")),
                () => Effect.sync(() => log.push("interrupted"))
            ));
            yield* Deferred.await(started);
            yield* Deferred.succeed(gate, "go");
            yield* Fiber.join(waiter);
            yield* Fiber.interrupt(sleeper);
        }));
        return log;
    },
    "exits and causes": async ({ Cause, Effect, Exit }) =>
    {
        const failed = Effect.runSyncExit(Effect.fail("expected"));
        const died = Effect.runSyncExit(Effect.die("defect"));
        const interrupted = await Effect.runPromiseExit(Effect.interrupt);
        return [ Exit.isFailure(failed), Cause.squash(failed.cause), Exit.isFailure(died), Cause.squash(died.cause),
            Cause.hasInterrupts(interrupted.cause), Exit.isSuccess(Effect.runSyncExit(Effect.succeed(1))) ];
    },
    "generators, typed errors and catchTag": async ({ Data, Effect }) =>
    {
        class Boom extends Data.TaggedError("Boom")<{ readonly value: number }>
        {}

        const program = Effect.gen(function* ()
        {
            const first: number = yield* Effect.succeed(1);
            const second: number = yield* Effect.map(Effect.succeed(2), (value: number) => value * 10);
            return yield* (new (Boom as any)({ value: first + second }) as any);
        });
        return Effect.runPromise(Effect.catchTag(program, "Boom", (error: { value: number }) => Effect.succeed(`caught ${error.value}`)));
    },
    "layers memoize, wire dependencies and release in reverse order": async ({ Context, Effect, Layer }) =>
    {
        const log: Array<string> = [];
        class Database extends Context.Service()("Database")
        {}

        class Users extends Context.Service()("Users")
        {}

        class Items extends Context.Service()("Items")
        {}

        const DatabaseLive = Layer.effect(Database, Effect.gen(function* ()
        {
            log.push("db open");
            yield* Effect.addFinalizer(() => Effect.sync(() => log.push("db close")));
            return { query: (sql: string) => Effect.succeed(`rows(${sql})`) };
        }));
        const UsersLive = Layer.effect(Users, Effect.gen(function* ()
        {
            const database: any = yield* (Database as any);
            yield* Effect.addFinalizer(() => Effect.sync(() => log.push("users close")));
            return { all: database.query("users") };
        }));
        const ItemsLive = Layer.effect(Items, Effect.gen(function* ()
        {
            const database: any = yield* (Database as any);
            return { all: database.query("items") };
        }));
        const AppLive = Layer.mergeAll(UsersLive, ItemsLive).pipe(Layer.provide(DatabaseLive));
        const result = await Effect.runPromise(Effect.provide(Effect.gen(function* ()
        {
            const users: any = yield* (Users as any);
            const items: any = yield* (Items as any);
            return [ yield* users.all, yield* items.all ];
        }), AppLive));
        return [ result, log ];
    },
    "managed runtimes build once and dispose": async ({ Context, Effect, Layer, ManagedRuntime }) =>
    {
        const log: Array<string> = [];
        class Counter extends Context.Service()("Counter")
        {}

        const CounterLive = Layer.effect(Counter, Effect.gen(function* ()
        {
            log.push("build");
            yield* Effect.addFinalizer(() => Effect.sync(() => log.push("release")));
            let count: number = 0;
            return { next: Effect.sync(() => ++count) };
        }));
        const runtime = ManagedRuntime.make(CounterLive);
        const next = Counter.use((counter: any) => counter.next);
        log.push(`first ${await runtime.runPromise(next)}`);
        log.push(`second ${await runtime.runPromise(next)}`);
        await runtime.dispose();
        return log;
    },
    "refs and schedules": async ({ Effect, Ref, Schedule }) =>
    {
        const ref = Effect.runSync(Ref.make(0));
        let attempts: number = 0;
        await Effect.runPromise(Effect.repeat(Ref.update(ref, (value: number) => value + 1), Schedule.recurs(3)));
        const retried = await Effect.runPromiseExit(Effect.retry(Effect.suspend(() =>
        {
            attempts++;
            return Effect.fail("again");
        }), Schedule.recurs(2)));
        const modified = Effect.runSync(Ref.modify(ref, (value: number) => [ `was ${value}`, value * 10 ]));
        return [ Effect.runSync(Ref.get(ref)), modified, attempts, retried._tag ];
    },
    "scopes release on success, failure and interruption": async ({ Effect }) =>
    {
        const log: Array<string> = [];
        const resource = (name: string): any => Effect.acquireRelease(
            Effect.sync(() => log.push(`acquire ${name}`)),
            (_: unknown, exit: any) => Effect.sync(() => log.push(`release ${name} ${exit._tag}`))
        );
        await Effect.runPromise(Effect.scoped(Effect.andThen(resource("a"), resource("b"))));
        await Effect.runPromiseExit(Effect.scoped(Effect.andThen(resource("c"), Effect.fail("boom"))));
        await Effect.runPromiseExit(Effect.scoped(Effect.andThen(resource("d"), Effect.interrupt)));
        return log;
    },
    "sleeping fibers complete in time order": async ({ Effect }) =>
    {
        const log: Array<string> = [];
        await Effect.runPromise(Effect.all([
            Effect.andThen(Effect.sleep("30 millis"), Effect.sync(() => log.push("slow"))),
            Effect.andThen(Effect.sleep("5 millis"), Effect.sync(() => log.push("fast")))
        ], { concurrency: "unbounded" }));
        return log;
    }
};

for (const [ name, scenario ] of Object.entries(Scenarios))
{
    test(`behavior matches upstream: ${name}`, async () =>
    {
        const port = await scenario(await library("@bedform/effect"));
        const upstream = await scenario(await library("effect"));
        Assert.deepEqual(port, upstream);
    });
}

/**
 * Blocks the event loop for a number of milliseconds, as a loaded host does.
 *
 * @category Tests
 * @since 1.0.0
 */
function stall(milliseconds: number): void
{
    const end: number = Date.now() + milliseconds;
    while (Date.now() < end)
    {
        // Busy-wait without yielding to the event loop.
    }
}

test("deferred, fork, join and interrupt is deterministic when the event loop stalls after start", async () =>
{
    for (const prefix of [ "@bedform/effect", "effect" ])
    {
        const pending: Promise<unknown> = Scenarios["deferred, fork, join and interrupt"](await library(prefix));
        stall(20);
        Assert.deepEqual(await pending, [ "got go", "interrupted" ], prefix);
    }
});

test("Data errors from the port fail into the port's fiber runtime with their tag", async () =>
{
    const { Data, Effect, Exit, Cause } = await library("@bedform/effect");
    class Missing extends Data.TaggedError("Missing")<{ readonly key: string }>
    {}

    const exit = await Effect.runPromiseExit(Effect.gen(function* ()
    {
        return yield* (new (Missing as any)({ key: "k" }) as any);
    }));
    Assert.ok(Exit.isFailure(exit));
    const error: any = Cause.squash(exit.cause);
    Assert.equal(error._tag, "Missing");
    Assert.ok(error instanceof Missing);
});
