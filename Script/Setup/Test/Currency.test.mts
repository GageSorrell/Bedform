/**
 * Already-current proof rejection, selected-stage isolation and exact single-line reporting tests.
 *
 * @module monorepo-setup/Test/Currency.test
 *
 * @file      Currency.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { AlreadyCurrentLine, ColorEnabled, IsCurrent } from "../Source/Currency.js";
import { Fixture, RequestFor } from "./Fixture.mjs";
import type { StageVerification, Verification } from "../Source/Currency.js";
import { Currency } from "../Source/Contract.js";
import { Effect } from "effect";
import type { Request } from "../Source/Contract.js";
import { RunSetup } from "../Source/Setup.js";
import { Sessions } from "../Source/Session.js";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import process from "node:process";
import test from "node:test";

const Digest = "a".repeat(64);
const ChangedDigest = "b".repeat(64);

/**
 * Supplies independently measured matching receipt data for a complete contract fixture bundle.
 *
 * @category Constructor
 * @since 1.0.0
 */
const EvidenceFor = (request: Request): Verification =>
{
    const fingerprint = { actual: Digest,
        recorded: Digest };
    const stages: Array<StageVerification> = [ { fingerprint,
        stage: "core",
        state: "current" } ];
    if (request.options.bdsDirectory !== undefined)
    {
        stages.push({ fingerprint,
            stage: "bds",
            state: "current",
            target: request.options.bdsDirectory });
    }

    if (request.options.mcpConfig !== undefined)
    {
        stages.push({ fingerprint,
            stage: "mcp",
            state: "current",
            target: request.options.mcpConfig });
    }

    return {
        complete: true,
        files: [ { ...fingerprint,
            path: "cinnabar.exe" }, { ...fingerprint,
            path: "cinnabar-mcp.exe" } ],
        inputs: fingerprint,
        installDirectory: request.paths.install,
        ownership: fingerprint,
        pins: fingerprint,
        provenance: fingerprint,
        requiredFiles: [ "cinnabar.exe", "cinnabar-mcp.exe" ],
        sourceDirectory: request.paths.source,
        stages
    };
};

test("verified current setup exits before permissions, prompts, processes and builds", async () =>
{
    const fixture = Fixture();
    const request = RequestFor();
    fixture.verification.value = EvidenceFor(request);
    assert.equal(await Effect.runPromise(RunSetup(request).pipe(
        Effect.provideService(Sessions, {
            acquire: () => Effect.fail(new Error("Must not acquire a lease"))
        }),
        Effect.provide(fixture.layer))), 0);
    assert.deepEqual(fixture.checks, [ request ]);
    assert.deepEqual(fixture.events, [ "platform", "source" ]);
    assert.deepEqual(fixture.requests, []);
    assert.deepEqual(fixture.commands, []);
    assert.deepEqual(fixture.prompts, []);
    assert.deepEqual(fixture.logs, [ "☑ Setup is already complete and current." ]);
});

test("forced local update bypasses currency and never prints already-current success", async () =>
{
    const fixture = Fixture();
    const request = RequestFor({ update: true });
    fixture.verification.value = EvidenceFor(request);
    await Effect.runPromise(RunSetup(request).pipe(Effect.provide(fixture.layer)));
    assert.deepEqual(fixture.checks, []);
    assert.deepEqual(fixture.logs, []);
    assert.ok(fixture.events.includes("buildInstall"));
});

for (const problem of [ "missing", "partial", "source", "pins", "corrupt", "missingFile", "ownership",
    "provenance", "destination", "emptyBundle", "unmeasured", "stage" ] as const)
{
    test(`${problem} evidence continues normal setup without an already-current line`, async () =>
    {
        const fixture = Fixture();
        const request = RequestFor();
        const complete = EvidenceFor(request);
        const changed = { actual: ChangedDigest,
            recorded: Digest };
        let evidence: Verification | undefined = complete;
        switch (problem)
        {
            case "missing": evidence = undefined;
                break;
            case "partial": evidence = { ...complete,
                complete: false };
                break;
            case "source": evidence = { ...complete,
                inputs: changed };
                break;
            case "pins": evidence = { ...complete,
                pins: changed };
                break;
            case "corrupt": evidence = { ...complete,
                files: [ { ...changed,
                    path: "cinnabar.exe" } ] };
                break;
            case "missingFile": evidence = { ...complete,
                files: complete.files.slice(0, 1) };
                break;
            case "ownership": evidence = { ...complete,
                ownership: changed };
                break;
            case "provenance": evidence = { ...complete,
                provenance: changed };
                break;
            case "destination": evidence = { ...complete,
                installDirectory: "different destination" };
                break;
            case "emptyBundle": evidence = { ...complete,
                files: [],
                requiredFiles: [] };
                break;
            case "unmeasured": evidence = { ...complete,
                inputs: { recorded: Digest } };
                break;
            case "stage": evidence = { ...complete,
                stages: [] };
                break;
        }

        fixture.verification.value = evidence;
        await Effect.runPromise(RunSetup(request).pipe(Effect.provide(fixture.layer)));
        assert.deepEqual(fixture.logs, []);
        assert.ok(fixture.events.includes("buildInstall"));
    });
}

test("inspection errors fail closed into normal consented setup", async () =>
{
    const fixture = Fixture();
    await Effect.runPromise(RunSetup(RequestFor()).pipe(
        Effect.provideService(Currency, { inspect: () => Effect.fail(new Error("unreadable receipt")) }),
        Effect.provide(fixture.layer)
    ));
    assert.deepEqual(fixture.logs, []);
    assert.ok(fixture.events.includes("buildInstall"));
});

test("provisioning selections must match; optional declines preserve core currency", () =>
{
    const request = RequestFor({ bdsDirectory: "D:\\server",
        blender: true,
        blockbench: true,
        mcpConfig: "D:\\config.json" });
    const evidence = EvidenceFor(request);
    const stages: Array<StageVerification> = [ ...evidence.stages,
        { stage: "blender",
            state: "declined" }, { stage: "blockbench",
            state: "unavailable" } ];
    assert.equal(IsCurrent(request, { ...evidence,
        stages }), true);
    assert.equal(IsCurrent(request, evidence), false);
    assert.equal(IsCurrent(request, { ...evidence,
        stages: stages.filter((stage: StageVerification) =>
            stage.stage !== "bds") }), false);
    assert.equal(IsCurrent(RequestFor({ bdsDirectory: "D:\\another-server" }), evidence), false);
    assert.equal(IsCurrent(RequestFor({ mcpConfig: "D:\\another-config.json" }), evidence), false);
    assert.equal(IsCurrent(RequestFor(), evidence), true);
});

test("markers, invalid hashes, duplicate or escaping owned paths cannot establish currency", () =>
{
    const request = RequestFor();
    const evidence = EvidenceFor(request);
    assert.equal(IsCurrent(request, { complete: true } as Verification), false);
    assert.equal(IsCurrent(request, { ...evidence,
        inputs: null } as unknown as Verification), false);
    assert.equal(IsCurrent(request, { ...evidence,
        inputs: { actual: "marker",
            recorded: "marker" } }), false);
    for (const path of [ "../outside.exe", "/outside.exe", "C:/outside.exe", "cinnabar.exe" ])
    {
        const files = [ ...evidence.files, { actual: Digest,
            path,
            recorded: Digest } ];
        assert.equal(IsCurrent(request, { ...evidence,
            files }), false);
    }
});

for (const color of [ false, true ])
{
    test(`Node reporting emits exactly one ${color ? "colored" : "plain"} success line`, () =>
    {
        const cwd = new URL("../Distribution/", import.meta.url);
        const script = "import { Reporting } from './Contract.js'; " +
            "import { ReportingLayer } from './Node.js'; import { Effect } from 'effect'; " +
            "await Effect.runPromise(Reporting.use(r => r.alreadyCurrent)" +
            ".pipe(Effect.provide(ReportingLayer)));";
        const output = execFileSync(process.execPath, [ "--input-type=module", "-e", script ], {
            cwd,
            encoding: "utf8",
            env: { ...process.env,
                FORCE_COLOR: color ? "1" : "0",
                NODE_DISABLE_COLORS: undefined,
                NO_COLOR: undefined }
        });
        assert.equal(output, AlreadyCurrentLine(color) + "\n");
    });
}

test("success output preserves U+2611 and one space, with a reset and no color bleed", () =>
{
    assert.equal(AlreadyCurrentLine(false), "☑ Setup is already complete and current.");
    assert.equal(AlreadyCurrentLine(true), "\u001B[32m☑\u001B[0m Setup is already complete and current.");
    assert.equal(ColorEnabled({}, true), true);
    assert.equal(ColorEnabled({}, false), false);
    assert.equal(ColorEnabled({ FORCE_COLOR: "1" }, false), true);
    assert.equal(ColorEnabled({ FORCE_COLOR: "0" }, true), false);
    assert.equal(ColorEnabled({ FORCE_COLOR: "1",
        NO_COLOR: "1" }, true), false);
    assert.equal(ColorEnabled({ NODE_DISABLE_COLORS: "1" }, true), false);
    assert.equal(ColorEnabled({ TERM: "dumb" }, true), false);
});
