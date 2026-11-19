/**
 * Fresh installation and compiled CLI acceptance in a disposable workspace.
 *
 * @file install.test.mts
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { tmpdir } from "node:os";

const RepoRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("fresh npm install and npm ci build the CLI and configure Husky", { timeout: 120_000 },
    (Context: TestContext) =>
    {
        const Root = mkdtempSync(join(tmpdir(), "pull-install-"));
        assert.equal(dirname(resolve(Root)), resolve(tmpdir()));
        Context.after(() => rmSync(Root, { force: true,
            recursive: true }));
        execFileSync("git", [ "init", "--initial-branch=Master" ], { cwd: Root,
            stdio: "pipe" });
        cpSync(join(RepoRoot, ".husky"), join(Root, ".husky"), {
            filter: (Path: string) => !Path.includes(join(".husky", "_")),
            recursive: true
        });
        const Workspace = join(Root, "Script/PullMonorepo");
        mkdirSync(Workspace, { recursive: true });
        for (const Name of [ "package.json", "tsconfig.json", "Source" ])
        {
            cpSync(join(RepoRoot, "Script/PullMonorepo", Name), join(Workspace, Name), { recursive: true });
        }

        writeFileSync(join(Root, "package.json"), JSON.stringify({
            devDependencies: { husky: "9.1.7" },
            name: "pull-install-fixture",
            private: true,
            scripts: { prepare: "husky" },
            type: "module",
            workspaces: [ "Script/*" ]
        }));
        const Npm = process.env.npm_execpath;
        assert.ok(Npm, "Run acceptance tests through npm test so npm_execpath is available.");
        for (const Action of [ "install", "ci" ])
        {
            // npm ci must regenerate a missing entrypoint, not reuse the build.
            const Distribution = resolve(Workspace, "Distribution");
            assert.equal(dirname(Distribution), resolve(Workspace));
            rmSync(Distribution, { force: true,
                recursive: true });
            const Args: Array<string> = [ Npm, Action, "--offline", "--no-audit", "--no-fund" ];
            const Install = spawnSync(process.execPath, Args, {
                cwd: Root,
                encoding: "utf8",
                env: { ...process.env,
                    HUSKY: "" },
                timeout: 55_000
            });
            assert.equal(Install.status, 0, String(Install.error ?? "") + Install.stdout + Install.stderr);
            assert.ok(existsSync(join(Distribution, "index.js")), `${Action} builds the entrypoint`);
            const Hooks = execFileSync("git", [ "config", "core.hooksPath" ], { cwd: Root,
                encoding: "utf8" });
            assert.equal(Hooks.trim(), ".husky/_");
            const Cli = spawnSync(process.execPath, [ join(Distribution, "index.js") ], {
                cwd: tmpdir(),
                encoding: "utf8",
                timeout: 10_000
            });
            assert.equal(Cli.status, 1);
            assert.match(Cli.stdout + Cli.stderr, /No Git remotes/u);
        }
    });
