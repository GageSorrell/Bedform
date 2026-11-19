/**
 * Compares public and production React behavior with integrity-checked, unmodified upstream Node packages.
 *
 * @module bedform/Test/ReactDifferential.test
 *
 * @file      ReactDifferential.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/* Child-process options retain their lifecycle order. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */
import { CheckManifest, Load, Pins } from "../Tool/ReactVendor.mjs";
import { after, before, test } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { Flavor } from "../Tool/ReactVendor.mjs";
import type { Observation } from "./ReactDifferentialScenario.mjs";
import { Scenarios } from "./ReactDifferentialScenario.mjs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { fork } from "node:child_process";
import path from "node:path";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";

let Directory: string;
before(async () =>
{
    Directory = await mkdtemp(path.join(realpathSync.native(tmpdir()), "react-differential-"));
    await writeFile(path.join(Directory, "package.json"), JSON.stringify({ private: true,
        type: "module" }));
    // Extract only verified regular files. No installation, adaptation, generated source or lifecycle script
    // participates in the oracle. Node resolves the original entry, CJS builds and scheduler itself.
    for (const pin of Pins)
    {
        const archive = await Load(pin);
        CheckManifest(archive);
        const root = path.join(Directory, "node_modules", pin.Name);
        await mkdir(root, { recursive: true });
        for (const [ name, bytes ] of archive.Files)
        {
            assert.ok(name.startsWith("package/"));
            const target = path.resolve(root, name.slice("package/".length));
            assert.ok(target.startsWith(root + path.sep));
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, bytes);
            assert.deepEqual(await readFile(target), bytes, `Oracle bytes differ: ${pin.Name}/${name}`);
        }
    }
});
after(async () =>
{
    if (Directory)
    {
        assert.ok(path.basename(Directory).startsWith("react-differential-"));
        assert.equal(path.dirname(Directory), realpathSync.native(tmpdir()));
        await rm(Directory, { force: true,
            recursive: true });
    }
});

/**
 * Runs one implementation in a fresh Node process with an explicit upstream build flavor.
 *
 * @throws { Error } When the process fails, times out or sends no observation.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Observe(
    implementation: "upstream" | "port", flavor: Flavor, scenario: keyof typeof Scenarios
): Promise<Observation>
{
    return await new Promise<Observation>((resolve, reject) =>
    {
        const child = fork(fileURLToPath(new URL("./ReactDifferentialScenario.mts", import.meta.url)),
            [ implementation, flavor, Directory, scenario ], {
                execPath: process.execPath,
                execArgv: [ "--import", "tsx" ],
                env: { ...process.env,
                    NODE_ENV: flavor },
                stdio: [ "ignore", "pipe", "pipe", "ipc" ]
            });
        let observed: Observation | undefined;
        let output = "";
        const timeout = setTimeout(() =>
        {
            child.kill();
            reject(new Error(`${implementation}/${flavor}/${scenario} exceeded 30 seconds.\n${output}`));
        }, 30000);
        child.stdout?.on("data", (data: Buffer) =>
        {
            output += data.toString();
        });
        child.stderr?.on("data", (data: Buffer) =>
        {
            output += data.toString();
        });
        child.on("message", (value) =>
        {
            observed = value as Observation;
        });
        child.on("error", (error) =>
        {
            clearTimeout(timeout);
            reject(error);
        });
        child.on("exit", (code, signal) =>
        {
            clearTimeout(timeout);
            if (code !== 0 || observed === undefined)
            {
                reject(new Error(
                    `${implementation}/${flavor}/${scenario} exited ${code ?? signal}.\n${output}`));
            }
            else
            {
                resolve(observed);
            }
        });
    });
}

for (const flavor of [ "development", "production" ] as const)
{
    for (const scenario of Object.keys(Scenarios) as Array<keyof typeof Scenarios>)
    {
        test(`${flavor} matches upstream: ${scenario}`, async () =>
        {
            // Keep the oracle and restricted port processes independent, including dispatcher state,
            // CommonJS caches, NODE_ENV, generated identifiers and scheduler queues.
            const upstream = await Observe("upstream", flavor, scenario);
            const port = await Observe("port", flavor, scenario);
            assert.ok(upstream.Snapshots.length >= 2, "A scenario must reach multiple semantic checkpoints.");
            assert.deepEqual(port, upstream);
        });
    }
}
