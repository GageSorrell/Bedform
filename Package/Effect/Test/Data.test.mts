/**
 * Differential coverage for Data classes, tagged enums and complete error protocols.
 *
 * @module @bedform/effect/Test/Data.test
 *
 * @file      Data.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Bedrock from "@bedform/effect/Data";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Root from "@bedform/effect";
import * as Upstream from "effect/Data";
import Assert from "node:assert/strict";
import TypeScript from "typescript";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/* Callbacks intentionally use the contextual types supplied by the public overloads. */
/* eslint @typescript-eslint/typedef: "off" */

// Separate packages declare distinct unique symbols; share local signatures for runtime comparisons.
const Modules: ReadonlyArray<typeof Bedrock> = [ Upstream as unknown as typeof Bedrock, Bedrock ];

test("Data exposes the complete upstream runtime surface through root and direct imports", () =>
{
    Assert.deepEqual(Object.keys(Bedrock).sort(), Object.keys(Upstream).sort());
    Assert.strictEqual(Root.Data, Bedrock);
});

test("Data emitted signatures match upstream after expanding extracted property interfaces", () =>
{
    const Printer = TypeScript.createPrinter({ removeComments: true });
    const normalize = (specifier: string): string =>
    {
        const url = new URL(import.meta.resolve(specifier).replace(/\.js$/, ".d.ts"));
        const source = readFileSync(url, "utf8")
            .replaceAll(".ts\"", ".js\"")
            .replaceAll("/Internal/", "/internal/")
            .replaceAll("/Encoding/", "/encoding/")
            .replaceAll("/Schema/", "/schema/")
            .replace("\"./internal/data-types.js\"", "\"./Cause.js\"");
        const file = TypeScript.createSourceFile(url.pathname, source, TypeScript.ScriptTarget.Latest, true);
        const Extracted = new Map<string, TypeScript.TypeLiteralNode>();
        const collect = (node: TypeScript.Node): void =>
        {
            if (TypeScript.isModuleDeclaration(node) &&
                [ "WithGenerics", "Constructor", "GenericMatchers" ].includes(node.name.text))
            {
                const body = node.body as TypeScript.ModuleBlock;
                for (const declaration of body.statements)
                {
                    if (TypeScript.isInterfaceDeclaration(declaration))
                    {
                        Extracted.set(`${node.name.text}.${declaration.name.text}`,
                            TypeScript.factory.createTypeLiteralNode(declaration.members));
                    }
                }
            }

            TypeScript.forEachChild(node, collect);
        };

        collect(file);
        const transformed = TypeScript.transform(file, [ (context) =>
        {
            const visit = (node: TypeScript.Node): TypeScript.VisitResult<TypeScript.Node> | undefined =>
            {
                if (TypeScript.isModuleDeclaration(node) &&
                    [ "WithGenerics", "Constructor", "GenericMatchers" ].includes(node.name.text))
                {
                    return undefined;
                }

                if (TypeScript.isTypeReferenceNode(node))
                {
                    const replacement = Extracted.get(node.typeName.getText(file));
                    if (replacement)
                    {
                        return replacement;
                    }
                }

                return TypeScript.visitEachChild(node, visit, context);
            };

            return (root) => TypeScript.visitNode(root, visit) as TypeScript.SourceFile;
        } ]);
        try
        {
            return Printer.printFile(transformed.transformed[0]);
        }
        finally
        {
            transformed.dispose();
        }
    };

    Assert.equal(normalize("@bedform/effect/Data"), normalize("effect/Data"));
});

test("Data dependency closure uses shipped ESM and has no Effect executor or platform imports", () =>
{
    const Visited = new Set<string>();
    const visit = (url: URL): void =>
    {
        if (Visited.has(url.href))
        {
            return;
        }

        Visited.add(url.href);
        const file = TypeScript.createSourceFile(url.pathname, readFileSync(url, "utf8"),
            TypeScript.ScriptTarget.Latest, true);
        for (const statement of file.statements)
        {
            if (TypeScript.isImportDeclaration(statement))
            {
                const specifier = (statement.moduleSpecifier as TypeScript.StringLiteral).text;
                Assert.ok(specifier.startsWith("."), `External import: ${specifier}`);
                Assert.doesNotMatch(specifier, /(?:Effect|Cause|Exit|Context|Scheduler|Fiber)\.js$/);
                visit(new URL(specifier, url));
            }
        }
    };

    visit(new URL(import.meta.resolve("@bedform/effect/Data")));
    Assert.ok(Visited.size > 2);
});

test("vendored yieldable-error and Effect protocol declarations keep full upstream member signatures", () =>
{
    const Printer = TypeScript.createPrinter({ removeComments: true });
    const declarations = (url: URL): Map<string, string> =>
    {
        const source = readFileSync(url, "utf8")
            .replace(/\b(?:Effect\.)?IgnoreSymbol\b/g, "{}")
            .replace(/\bEffect\.(Variance|EffectIterator|Effect)\b/g, "$1")
            .replace(/\[(?:Effect\.)?TypeId\]/g, "[\"~effect/Effect\"]")
            .replace(/readonly "~effect\/Effect"/g, "readonly [\"~effect/Effect\"]")
            .replace(/Success<T>/g, "T extends Effect<infer A, infer _, infer _> ? A : never");
        const file = TypeScript.createSourceFile(url.pathname, source, TypeScript.ScriptTarget.Latest, true);
        const Declarations = new Map<string, string>();
        for (const statement of file.statements)
        {
            if (TypeScript.isInterfaceDeclaration(statement))
            {
                Declarations.set(statement.name.text, Printer.printNode(
                    TypeScript.EmitHint.Unspecified, statement, file
                ));
            }
        }

        return Declarations;
    };

    let compared = 0;
    for (const module of [ "Cause", "Effect" ])
    {
        const Local = declarations(new URL(`../Distribution/${module}.d.ts`, import.meta.url));
        const url = new URL(import.meta.resolve(`effect/${module}`).replace(/\.js$/, ".d.ts"));
        const UpstreamDeclarations = declarations(url);
        for (const [ name, signature ] of Local)
        {
            if (UpstreamDeclarations.has(name))
            {
                Assert.equal(signature, UpstreamDeclarations.get(name));
                compared++;
            }
        }
    }

    Assert.ok(compared >= 5, `compared ${compared} declarations`);
});

test("Class copies enumerable own string and symbol keys safely and supports pipe", () =>
{
    for (const Module of Modules)
    {
        class Value extends Module.Class<Record<PropertyKey, unknown>> {}
        const Key = Symbol("field");
        const Properties = Object.assign(Object.create({ inherited: true }), { [Key]: 2,
            field: 1 });
        Object.defineProperty(Properties, "hidden", { value: 3 });
        Object.defineProperty(Properties, "__proto__", { enumerable: true,
            value: { polluted: true } });
        const value = new Value(Properties);
        Assert.equal(value.field, 1);
        Assert.equal(value[Key], 2);
        Assert.equal(value.hidden, undefined);
        Assert.equal(value.inherited, undefined);
        Assert.strictEqual(Object.getPrototypeOf(value), Value.prototype);
        Assert.deepEqual(value.__proto__, { polluted: true });
        Assert.equal(value.pipe((self) => self.field), 1);
        Assert.equal(Object.isFrozen(value), false);
        Assert.notStrictEqual(new Value(Properties), value);
        class Empty extends Module.Class {}
        Assert.deepEqual(Object.keys(new Empty()), []);
    }
});

test("TaggedClass overrides an incoming tag and keeps its discriminator enumerable", () =>
{
    for (const Module of Modules)
    {
        class Value extends Module.TaggedClass("Value")<{ count: number }> {}
        const value = new Value({ _tag: "wrong",
            count: 2 } as any);
        Assert.equal(value._tag, "Value");
        Assert.deepEqual(Object.keys(value), [ "_tag", "count" ]);
        Assert.equal(value.pipe((self) => self.count), 2);
        Assert.ok(value instanceof Value);
    }
});

test("taggedEnum constructs plain variants and supports both exhaustive matching call styles", () =>
{
    type Event = { readonly _tag: "Empty" } | { readonly _tag: "Value";
        readonly count: number };
    for (const Module of Modules)
    {
        const constructors = Module.taggedEnum<Event>();
        const value = constructors.Value({ count: 2 });
        Assert.deepEqual(constructors.Empty(), { _tag: "Empty" });
        Assert.deepEqual(value, { _tag: "Value",
            count: 2 });
        Assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
        Assert.deepEqual(constructors.Value({ _tag: "wrong",
            count: 2 } as any), value);
        Assert.equal(constructors.$is("Value")(value), true);
        Assert.equal(constructors.$is("Value")({ _tag: "Value" }), true);
        Assert.equal(constructors.$is("Value")(null), false);
        const cases = { Empty: () => 0,
            Value: (event: Extract<Event, { _tag: "Value" }>) => event.count };
        Assert.equal(constructors.$match(value, cases), 2);
        Assert.equal(constructors.$match(cases)(constructors.Empty()), 0);
        Assert.deepEqual(Object.keys(constructors), []);
    }
});

test("Error and TaggedError preserve native Error fields, JSON, inspection and cause semantics", () =>
{
    for (const Module of Modules)
    {
        const CauseValue = new globalThis.Error("cause");
        class DomainError extends Module.Error<{ message: string;
            cause: unknown;
            code: number }> {}
        const input = { cause: CauseValue,
            code: 7,
            message: "failed" };
        const error = new DomainError(input);
        Assert.ok(error instanceof globalThis.Error);
        Assert.ok(error instanceof DomainError);
        Assert.equal(error.message, "failed");
        Assert.strictEqual(error.cause, CauseValue);
        Assert.equal(error.toString(), "Error: failed");
        Assert.deepEqual(error.toJSON(), input);
        Assert.deepEqual((error as any)[Symbol.for("nodejs.util.inspect.custom")](), input);
        Assert.equal(Object.getOwnPropertyDescriptor(error, "message")?.enumerable, false);
        Assert.equal(Object.getOwnPropertyDescriptor(error, "cause")?.enumerable, false);
        Assert.equal(error.pipe((self) => self.code), 7);
        input.message = "changed";
        Assert.equal((error.toJSON() as any).message, "changed");

        class Tagged extends Module.TaggedError("Tagged")<{ message: string }> {}
        const tagged = new Tagged({ message: "tagged" });
        Assert.equal(tagged.name, "Tagged");
        Assert.equal(tagged.toString(), "Tagged: tagged");
        Assert.deepEqual(tagged.toJSON(), { _tag: "Tagged",
            message: "tagged" });
        Assert.equal(Object.hasOwn(tagged, "name"), false);
        class Empty extends Module.Error {}
        Assert.deepEqual(new Empty().toJSON(), {});
        for (const cause of [ undefined, null, false, 0, "" ])
        {
            Assert.strictEqual(new Module.Error({ cause }).cause, cause);
        }
    }
});

test("error iterators yield their own instance once and preserve the resumed value", () =>
{
    for (const Module of Modules)
    {
        const error = new Module.Error({ message: "failure" });
        const iterator = error[Symbol.iterator]();
        Assert.deepEqual(iterator.next(), { done: false,
            value: error });
        const resumed = iterator.next("resumed");
        Assert.equal(resumed.done, true);
        Assert.equal(resumed.value, "resumed");
        Assert.deepEqual(error[Symbol.iterator]().next(), { done: false,
            value: error });
        Assert.ok(Effect.isEffect(error));
    }
});

test("errors interoperate with upstream execution, gen and catchTag", async () =>
{
    for (const Module of Modules)
    {
        class Failure extends Module.TaggedError("Failure")<{ message: string;
            code: number }> {}
        const error = new Failure({ code: 7,
            message: "failed" });
        // The host runtime has its own nominal inspection symbol declaration.
        const yieldable = error as unknown as Failure & Cause.YieldableError;
        const program = Effect.gen(function*()
        {
            yield* Effect.succeed(undefined);
            return yield* yieldable;
        });
        const executions = [ Effect.runSyncExit(yieldable), Effect.runSyncExit(program),
            await Effect.runPromiseExit(program) ];
        for (const exit of executions)
        {
            Assert.ok(Exit.isFailure(exit));
            Assert.ok(Cause.isCause(exit.cause));
            Assert.strictEqual((exit.cause.reasons[0] as Cause.Fail<Failure>).error, error);
        }

        const recovered = Effect.catchTag(program, "Failure", (failure) => Effect.succeed(failure.code));
        Assert.equal(Effect.runSync(recovered), 7);
    }
});

test("failure primitives preserve cause annotations and continuation dispatch", () =>
{
    const Evaluate = "~effect/Effect/evaluate";
    const FailureCont = "~effect/Effect/failureCont";
    for (const Module of Modules)
    {
        const error = new Module.Error({ message: "failed" });
        const exit = (error as any)[Evaluate]();
        const Frame = { name: "test frame" };
        const fiber = {
            _interruptedCause: undefined,
            cache: { stackFrame: Frame },
            getCont: () => undefined,
            interruptible: true,
            yieldWith: (value: any) => value
        };
        const annotated = exit[Evaluate](fiber);
        const reason = annotated.cause.reasons[0];
        Assert.strictEqual(reason.error, error);
        Assert.strictEqual(reason.annotations.get("effect/Cause/StackTrace"), Frame);
        Assert.deepEqual(reason.toJSON(), { _tag: "Fail",
            error });
        Assert.strictEqual(reason.annotate({ mapUnsafe: new Map() }), reason);
        const changed = reason.annotate({ mapUnsafe: new Map([ [ "custom", 1 ] ]) });
        Assert.notStrictEqual(changed, reason);
        Assert.equal(changed.annotations.get("custom"), 1);
        const retained = changed.annotate({ mapUnsafe: new Map([ [ "custom", 2 ] ]) });
        Assert.equal(retained.annotations.get("custom"), 1);
        Assert.equal(changed.annotate({ mapUnsafe: new Map([ [ "custom", 2 ] ]) }, { overwrite: true })
            .annotations.get("custom"), 2);
        const result = exit[Evaluate]({
            ...fiber,
            cache: {},
            getCont: () => ({ [FailureCont]: (cause: any, receiver: any, previous: any) =>
            {
                Assert.strictEqual(cause.reasons[0].error, error);
                Assert.strictEqual(receiver.cache.stackFrame, undefined);
                Assert.strictEqual(previous, exit);
                return "recovered";
            } })
        });
        Assert.equal(result, "recovered");
    }
});
