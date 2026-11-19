/**
 * Disposable Git repositories and controlled Beads subprocess acceptance tests.
 *
 * @file pull.test.mts
 */

import { Effect, Result } from "effect";
import { Preflight, PullBeads, PullGit, RunPulls, SelectRemote } from "../Source/pull.js";
import {
    copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync
} from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { ChildProcess } from "effect/process";
import { NodeServices } from "@effect/platform-node";
import type { PullOutcome } from "../Source/pull.js";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { tmpdir } from "node:os";

const RepoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const Warning = "Warning: Use `npm run pull` instead of `git pull` when pulling Master "
    + "so Beads data is pulled too.";

/**
 * Runs fixture Git commands with no interactive prompts.
 *
 * @category Tests
 * @since 1.0.0
 */
function Git(Cwd: string, ...Args: Array<string>): string
{
    return execFileSync("git", [ "-c", "core.autocrlf=false", ...Args ], {
        cwd: Cwd,
        encoding: "utf8",
        env: { ...process.env,
            GIT_TERMINAL_PROMPT: "0" },
        stdio: [ "ignore", "pipe", "pipe" ]
    }).trim();
}

/**
 * Allocates a disposable repository with no global hook configuration.
 *
 * @category Tests
 * @since 1.0.0
 */
function Fixture(Context: TestContext): string
{
    const Root = mkdtempSync(join(tmpdir(), "pull-monorepo-"));
    assert.equal(dirname(resolve(Root)), resolve(tmpdir()));
    Context.after(() => rmSync(Root, { force: true,
        recursive: true }));
    Git(Root, "init", "--initial-branch=Master");
    Git(Root, "config", "user.name", "Pull tests");
    Git(Root, "config", "user.email", "pull-tests@example.invalid");
    Git(Root, "config", "core.hooksPath", ".git/hooks");
    Git(Root, "config", "pull.rebase", "false");
    Git(Root, "config", "core.editor", "true");
    Git(Root, "commit", "--allow-empty", "-m", "initial");
    return Root;
}

/**
 * Creates a source repository and a second checkout with a named remote.
 *
 * @category Tests
 * @since 1.0.0
 */
function Pair(Context: TestContext)
{
    const Source = Fixture(Context);
    const Clone = Fixture(Context);
    Git(Clone, "remote", "add", "Origin", Source);
    Git(Clone, "fetch", "Origin");
    Git(Clone, "reset", "--hard", "Origin/Master");
    return { Clone,
        Source };
}

/**
 * Commits a fixture file update.
 *
 * @category Tests
 * @since 1.0.0
 */
function Commit(Root: string, File: string, Text: string): void
{
    writeFileSync(join(Root, File), Text);
    Git(Root, "add", File);
    Git(Root, "commit", "-m", Text);
}

/**
 * Installs the real Husky dispatcher into a disposable checkout.
 *
 * @category Tests
 * @since 1.0.0
 */
function InstallHooks(Root: string): void
{
    const Bin = join(Root, ".fixture-bin");
    mkdirSync(Bin, { recursive: true });
    writeFileSync(join(Bin, "bd"), "#!/bin/sh\n"
        + "printf '%s %s\\n' \"$*\" \"$(git rev-parse HEAD)\" >> .beads-sync\n"
        + "if [ \"${FixtureNestedPush:-}\" = 1 ]; then "
        + "FixtureNestedPush=0 git hook run pre-push || exit $?; fi\n"
        + "echo 'Fixture hook Beads pull'\nexit \"${FixtureBeadsCode:-0}\"\n", { mode: 0o755 });
    cpSync(join(RepoRoot, ".husky"), join(Root, ".husky"), {
        filter: (Path: string) => !Path.includes(join(".husky", "_")),
        recursive: true
    });
    const Install = spawnSync(process.execPath, [ join(RepoRoot, "node_modules/husky/bin.js") ], {
        cwd: Root,
        encoding: "utf8",
        env: { ...process.env,
            HUSKY: "" }
    });
    assert.equal(Install.status, 0, Install.stderr);
    assert.equal(Git(Root, "config", "core.hooksPath"), ".husky/_");
    const Dispatcher = join(Root, ".husky/_/h");
    writeFileSync(Dispatcher, "export PATH=\"$PWD/.fixture-bin:$PATH\"\n"
        + readFileSync(Dispatcher, "utf8"));
}

test("remote precedence preserves exact case and Git ordering", async () =>
{
    for (const [ Remotes, Expected ] of [
        [ [ "other", "origin", "Origin" ], "Origin" ],
        [ [ "other", "origin" ], "origin" ],
        [ [ "zebra", "alpha" ], "zebra" ],
        [ [ "ORIGIN", "other" ], "ORIGIN" ]
    ] as const)
    {
        assert.equal(await Effect.runPromise(SelectRemote(Remotes)), Expected);
    }

    assert.ok(Result.isFailure(await Effect.runPromise(Effect.result(SelectRemote([])))));
});

test("preflight rejects invalid checkouts and no remotes", async (Context: TestContext) =>
{
    const Root = Fixture(Context);
    await assert.rejects(Effect.runPromise(Preflight(Root)), /No Git remotes/u);
    Git(Root, "remote", "add", "custom", Root);
    assert.equal(await Effect.runPromise(Preflight(Root)), "custom");
    Git(Root, "checkout", "-b", "feature");
    await assert.rejects(Effect.runPromise(Preflight(Root)), /Check out Master/u);
    Git(Root, "checkout", "--detach");
    await assert.rejects(Effect.runPromise(Preflight(Root)), /HEAD is attached/u);
    await assert.rejects(Effect.runPromise(Preflight(tmpdir())), /Cannot inspect/u);
});

test("real Git updates, no changes, and conflicts", async (Context: TestContext) =>
{
    const { Clone, Source } = Pair(Context);
    Commit(Source, "shared.txt", "base\n");
    const First = await Effect.runPromise(PullGit(Clone, "Origin"));
    assert.equal(First.status, "success", First.detail);
    assert.equal(Git(Clone, "rev-parse", "HEAD"), Git(Source, "rev-parse", "HEAD"));
    assert.equal((await Effect.runPromise(PullGit(Clone, "Origin"))).status, "success");
    Commit(Clone, "shared.txt", "local\n");
    Commit(Source, "shared.txt", "remote\n");
    const Outcome = await Effect.runPromise(PullGit(Clone, "Origin"));
    assert.equal(Outcome.status, "failed");
    assert.match(Outcome.detail, /CONFLICT|conflict/u);
    assert.ok(existsSync(join(Clone, ".git/MERGE_HEAD")));
});

test("Beads output, nonzero exits, missing and invalid executables", async (Context: TestContext) =>
{
    const Root = Fixture(Context);
    for (const Code of [ 0, 7 ])
    {
        const Script = `console.log('out'); console.error('err'); process.exitCode = ${Code}`;
        const Command = ChildProcess.make(process.execPath, [ "-e", Script ], { cwd: Root });
        const Outcome = await Effect.runPromise(
            PullBeads(Root, Command).pipe(Effect.provide(NodeServices.layer))
        );
        assert.equal(Outcome.status, Code === 0 ? "success" : "failed");
        assert.match(Outcome.detail, /out/u);
        assert.match(Outcome.detail, /err/u);
    }

    const Missing = ChildProcess.make(`nonexistent-pull-test-${Date.now()}`, [], { cwd: Root });
    const MissingResult = await Effect.runPromise(
        PullBeads(Root, Missing).pipe(Effect.provide(NodeServices.layer))
    );
    assert.equal(MissingResult.status, "skipped");
    const Invalid = join(Root, "invalid.exe");
    writeFileSync(Invalid, "not an executable");
    const InvalidResult = await Effect.runPromise(
        PullBeads(Root, ChildProcess.make(Invalid)).pipe(Effect.provide(NodeServices.layer))
    );
    assert.equal(InvalidResult.status, "failed");
});

test("concurrent pulls start together and settle independently after failures", async () =>
{
    for (const GitStatus of [ "success", "failed" ] as const)
    {
        for (const BeadsStatus of [ "success", "failed", "skipped" ] as const)
        {
            let GitStarted = false;
            let BeadsStarted = false;
            const Completed: Array<string> = [];
            const GitOperation = Effect.gen(function*()
            {
                GitStarted = true;
                yield* Effect.yieldNow;
                assert.ok(BeadsStarted, "Beads starts before Git finishes");
                return { detail: "git",
                    name: "Git",
                    status: GitStatus } satisfies PullOutcome;
            });
            const BeadsOperation = Effect.gen(function*()
            {
                BeadsStarted = true;
                yield* Effect.sleep("20 millis");
                assert.ok(GitStarted);
                return { detail: "beads",
                    name: "Beads",
                    status: BeadsStatus } satisfies PullOutcome;
            });
            const Outcomes = await Effect.runPromise(RunPulls(
                GitOperation, BeadsOperation, (Outcome: PullOutcome) => Completed.push(Outcome.name)
            ));
            assert.deepEqual(Completed, [ "Git", "Beads" ]);
            assert.deepEqual(
                Outcomes.map((Outcome: PullOutcome) => Outcome.status), [ GitStatus, BeadsStatus ]
            );
        }
    }
});

for (const Mode of [ "fast-forward", "merge", "rebase", "other-local-branch" ])
{
    test(`Husky syncs Beads after a successful pull using ${Mode}`, (Context: TestContext) =>
    {
        const { Clone, Source } = Pair(Context);
        InstallHooks(Clone);
        if (Mode === "other-local-branch")
        {
            Git(Clone, "checkout", "-b", "feature");
        }

        if (Mode === "merge" || Mode === "rebase")
        {
            Commit(Clone, "local.txt", "local");
        }

        Commit(Source, "remote.txt", "remote");
        const Args = [ "pull", Mode === "rebase" ? "--rebase" : "--no-rebase", "Origin", "Master" ];
        const Pull = spawnSync("git", Args, {
            cwd: Clone,
            encoding: "utf8",
            env: { ...process.env,
                GIT_EDITOR: "true",
                GIT_TERMINAL_PROMPT: "0",
                HUSKY: "" }
        });
        assert.equal(Pull.status, 0, Pull.stderr);
        assert.ok(!(Pull.stdout + Pull.stderr).includes(Warning));
        assert.equal(readFileSync(join(Clone, ".beads-sync"), "utf8"),
            `dolt pull ${Git(Clone, "rev-parse", "HEAD")}\n`);
    });
}

test("hooks sync other branches but skip merges and npm-driven pulls", async (Context: TestContext) =>
{
    const { Clone, Source } = Pair(Context);
    InstallHooks(Clone);
    Git(Source, "checkout", "-b", "feature");
    Commit(Source, "feature.txt", "feature");
    const Pull = spawnSync("git", [ "pull", "Origin", "feature" ], { cwd: Clone,
        encoding: "utf8" });
    assert.equal(Pull.status, 0, Pull.stderr);
    assert.ok(!Pull.stderr.includes(Warning));
    const Sync = join(Clone, ".beads-sync");
    assert.equal(readFileSync(Sync, "utf8"), `dolt pull ${Git(Clone, "rev-parse", "HEAD")}\n`);
    rmSync(Sync);
    Git(Source, "checkout", "Master");
    Commit(Source, "master.txt", "master");
    Git(Clone, "fetch", "Origin", "Master");
    const Merge = spawnSync("git", [ "merge", "--no-edit", "FETCH_HEAD" ], { cwd: Clone,
        encoding: "utf8" });
    assert.equal(Merge.status, 0, Merge.stderr);
    assert.ok(!Merge.stderr.includes(Warning));
    assert.ok(!existsSync(Sync));
    Commit(Source, "later.txt", "later");
    const Helper = join(Clone, ".husky/pull-beads.sh");
    writeFileSync(Helper, "printf '%s' \"${PullMonorepoActive:-missing}\" > .hook-marker\n"
        + readFileSync(Helper, "utf8"));
    const Outcome = await Effect.runPromise(PullGit(Clone, "Origin"));
    assert.equal(Outcome.status, "success", Outcome.detail);
    assert.ok(!Outcome.detail.includes(Warning));
    assert.equal(readFileSync(join(Clone, ".hook-marker"), "utf8"), "1");
    assert.ok(!existsSync(Sync));
    assert.equal(process.env.PullMonorepoActive, undefined);
});

test("Beads hook failures are visible after Git completes", (Context: TestContext) =>
{
    const { Clone, Source } = Pair(Context);
    InstallHooks(Clone);
    Commit(Source, "change.txt", "change");
    const Pull = spawnSync("git", [ "pull", "Origin", "Master" ], { cwd: Clone,
        encoding: "utf8",
        env: { ...process.env,
            FixtureBeadsCode: "42",
            HUSKY: "" } });
    assert.match(Pull.stdout + Pull.stderr, /post-merge script failed \(code 42\)/u);
    assert.equal(Git(Clone, "rev-parse", "HEAD"), Git(Source, "rev-parse", "HEAD"));
});

for (const Mode of [ "merge", "rebase" ])
{
    test(`conflicting ${Mode} pulls do not sync Beads early`, (Context: TestContext) =>
    {
        const { Clone, Source } = Pair(Context);
        Commit(Source, "shared.txt", "base\n");
        Git(Clone, "pull", "Origin", "Master");
        InstallHooks(Clone);
        Commit(Clone, "shared.txt", "local\n");
        Commit(Source, "shared.txt", "remote\n");
        const Pull = spawnSync("git", [ "pull", Mode === "rebase" ? "--rebase" : "--no-rebase",
            "Origin", "Master" ], { cwd: Clone,
            encoding: "utf8" });
        assert.notEqual(Pull.status, 0);
        assert.ok(!existsSync(join(Clone, ".beads-sync")));
    });
}

test("already-current pulls and HUSKY=0 do not sync Beads", (Context: TestContext) =>
{
    const { Clone, Source } = Pair(Context);
    InstallHooks(Clone);
    Git(Clone, "pull", "Origin", "Master");
    assert.ok(!existsSync(join(Clone, ".beads-sync")));
    Commit(Source, "change.txt", "change");
    const Pull = spawnSync("git", [ "pull", "Origin", "Master" ], { cwd: Clone,
        encoding: "utf8",
        env: { ...process.env,
            HUSKY: "0" } });
    assert.equal(Pull.status, 0, Pull.stderr);
    assert.ok(!existsSync(join(Clone, ".beads-sync")));
});

for (const Code of [ 0, 42 ])
{
    test(`pre-push syncs once and ${Code ? "blocks code on failure" : "allows code on success"}`,
        (Context: TestContext) =>
        {
            const { Clone, Source } = Pair(Context);
            Git(Source, "config", "receive.denyCurrentBranch", "ignore");
            const Before = Git(Source, "rev-parse", "HEAD");
            InstallHooks(Clone);
            Commit(Clone, "change.txt", "change");
            const Head = Git(Clone, "rev-parse", "HEAD");
            const Push = spawnSync("git", [ "push", "Origin", "Master" ], { cwd: Clone,
                encoding: "utf8",
                env: { ...process.env,
                    FixtureBeadsCode: String(Code),
                    FixtureNestedPush: "1",
                    HUSKY: "" },
                timeout: 15_000 });
            assert.equal(Push.status, Code ? 1 : 0, Push.stdout + Push.stderr);
            assert.equal(readFileSync(join(Clone, ".beads-sync"), "utf8"), `dolt push ${Head}\n`);
            assert.equal(Git(Source, "rev-parse", "HEAD"), Code ? Before : Head);
        });
}

test("compiled entrypoint uses its own checkout and sets failure exit code", (Context: TestContext) =>
{
    const Root = Fixture(Context);
    const Distribution = join(Root, "Script/PullMonorepo/Distribution");
    mkdirSync(Distribution, { recursive: true });
    for (const Name of [ "index.js", "pull.js" ])
    {
        copyFileSync(join(RepoRoot, "Script/PullMonorepo/Distribution", Name), join(Distribution, Name));
    }

    writeFileSync(join(Root, "package.json"), "{\"type\":\"module\"}");
    // Preserve package resolution without exposing the real working tree to Git.
    const NodeModules = join(RepoRoot, "node_modules");
    const LinkScript = "require('node:fs').symlinkSync(process.argv[1], process.argv[2], 'junction')";
    execFileSync(process.execPath, [ "-e", LinkScript, NodeModules, join(Root, "node_modules") ]);
    const Result = spawnSync(process.execPath, [ join(Distribution, "index.js") ], { cwd: tmpdir(),
        encoding: "utf8" });
    assert.equal(Result.status, 1, Result.stdout + Result.stderr);
    assert.match(Result.stdout + Result.stderr, /No Git remotes/u);
    assert.ok(!existsSync(join(Root, ".beads")));
    assert.ok(readFileSync(join(Distribution, "index.js"), "utf8").includes("Pull monorepo"));
});

test("CLI reports both pull results and preserves failure exit codes", (Context: TestContext) =>
{
    const { Clone, Source } = Pair(Context);
    InstallHooks(Clone);
    const Distribution = join(Clone, "Script/PullMonorepo/Distribution");
    mkdirSync(Distribution, { recursive: true });
    for (const Name of [ "index.js", "pull.js" ])
    {
        copyFileSync(join(RepoRoot, "Script/PullMonorepo/Distribution", Name), join(Distribution, Name));
    }

    writeFileSync(join(Clone, "package.json"), "{\"type\":\"module\"}");
    const LinkScript = "require('node:fs').symlinkSync(process.argv[1], process.argv[2], 'junction')";
    execFileSync(process.execPath, [
        "-e", LinkScript, join(RepoRoot, "node_modules"), join(Clone, "node_modules")
    ]);
    const Bin = join(Clone, "fixture-bin");
    mkdirSync(Bin);
    // A renamed Node binary runs the fixture file 'dolt' for 'bd dolt pull'.
    copyFileSync(process.execPath, join(Bin, process.platform === "win32" ? "bd.exe" : "bd"));
    writeFileSync(join(Clone, "dolt"), [
        "import fs from 'node:fs';",
        "if (process.argv[2] !== 'pull') process.exit(99);",
        "setTimeout(() => {",
        "  fs.writeFileSync('beads-finished', 'done');",
        "  console.log('Fixture Beads pull finished');",
        "  process.exitCode = Number(process.env.FixtureBeadsCode);",
        "}, 80);"
    ].join("\n"));
    const Environment = Object.fromEntries(Object.entries(process.env).filter(([ Key ]: [string, string?]) =>
        Key.toLowerCase() !== "path"));
    for (const [ GitFails, BeadsCode ] of [ [ false, 0 ], [ false, 7 ], [ true, 0 ], [ true, 7 ] ] as const)
    {
        Git(Clone, "remote", "set-url", "Origin", GitFails ? join(Clone, "missing-remote") : Source);
        if (!GitFails)
        {
            Commit(Source, `update-${BeadsCode}.txt`, `update ${BeadsCode}`);
        }

        const Finished = resolve(Clone, "beads-finished");
        assert.equal(dirname(Finished), resolve(Clone));
        rmSync(Finished, { force: true });
        const Cli = spawnSync(process.execPath, [ join(Distribution, "index.js") ], {
            cwd: tmpdir(),
            encoding: "utf8",
            env: {
                ...Environment,
                FixtureBeadsCode: String(BeadsCode),
                PATH: Bin + delimiter + process.env.PATH
            },
            timeout: 15_000
        });
        const Output = Cli.stdout + Cli.stderr;
        assert.equal(Cli.status, GitFails || BeadsCode !== 0 ? 1 : 0, Output);
        assert.ok(existsSync(Finished), Output);
        assert.match(Output, /Git:/u);
        assert.match(Output, /Beads: Fixture Beads pull finished/u);
        assert.ok(!Output.includes(Warning));
        if (!GitFails)
        {
            assert.equal(Git(Clone, "rev-parse", "HEAD"), Git(Source, "rev-parse", "HEAD"));
        }
    }
});
