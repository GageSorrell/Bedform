/** @file demonstration.test.mts Transaction, activation, network and startup-order acceptance. */

import { DemoFiles, createDemonstration, descriptor } from "../Source/create.mts";
import { Readiness, selectAddress } from "../Source/start.mts";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { WorldFixture, WorldSessionCounter } from "../../../WorldFixture.mts";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { prepareWorld } from "../Source/world.mts";
import test from "node:test";

test("launch command collisions update one bounded script and respect ignore-file priority", async () =>
{
    const root = await mkdtemp(path.join(os.tmpdir(), "demonstration-registration-"));
    try
    {
        const engine = path.join(root, "engine");
        const world = path.join(root, "world");
        for (const folder of [ engine, world, path.join(engine, "behavior_packs"),
            path.join(engine, "resource_packs") ])
        {
            await mkdir(folder, { recursive: true });
        }

        await writeFile(path.join(engine, "bedrock_server.exe"), "fake");
        await writeFile(path.join(world, "level.dat"), "fixture");
        for (const mode of [ "addon", "repository", "new" ])
        {
            const repository = path.join(root, mode);
            const addon = path.join(repository, "Addon/Example");
            await mkdir(path.join(repository, ".git"), { recursive: true });
            await mkdir(addon, { recursive: true });
            await writeFile(path.join(addon, "package.json"), JSON.stringify({ name: "fixture" }));
            if (mode !== "new")
            {
                await writeFile(path.join(repository, ".gitignore"), "existing\n");
            }

            if (mode === "addon")
            {
                await writeFile(path.join(addon, ".gitignore"), "local\n");
            }

            const options = { addon,
                bds: engine,
                description: "Fixture",
                name: "a-very-long-demo-name-first",
                world };
            const first = await createDemonstration(options);
            const second = await createDemonstration({ ...options,
                name: "a-very-long-demo-name-second" });
            assert.equal(first.command, second.command);
            assert.ok(second.command!.length <= 21);
            const pkg = JSON.parse(await readFile(path.join(addon, "package.json"), "utf8"));
            assert.match(pkg.scripts[second.command!], /a-very-long-demo-name-second/);
            const ignore = mode === "repository" ? path.join(repository,
                ".gitignore") : path.join(addon, ".gitignore");
            const text = await readFile(ignore, "utf8");
            const rule = mode === "repository" ? "/Addon/Example/Demonstration/" : "/Demonstration/";
            assert.equal(text.split("\n").filter((line) => line === rule).length, 1);
            if (mode === "addon")
            {
                assert.equal(await readFile(path.join(repository, ".gitignore"), "utf8"), "existing\n");
            }
        }
    }
    finally
    {
        await rm(root, { force: true,
            recursive: true });
    }
});

test("descriptors are bounded, normalized and reject empty or traversal-only names", () =>
{
    assert.equal(descriptor("My Nice Demo!"), "my-nice-demo");
    assert.ok(descriptor("hello world ".repeat(10)).length <= 40);
    assert.throws(() => descriptor("../ !!!"));
});

test("reopening a fresh fixture allocates distinct actor sessions without changing its other NBT", () =>
{
    const first = WorldFixture();
    const second = prepareWorld(first);
    const third = prepareWorld(second);
    assert.equal(WorldSessionCounter(second), WorldSessionCounter(first) - 1n);
    assert.equal(WorldSessionCounter(third), WorldSessionCounter(first) - 2n);
    assert.equal(first.length, third.length);
});

test("readiness waits for complete split lines, delayed setup and the telemetry closing separator", () =>
{
    const ready = new Readiness("SCENE_READY");
    ready.feed("Server start", 0);
    assert.equal(ready.ready(1000), false);
    ready.feed("ed.\n==========\nTelemetry is disabled\n", 100);
    ready.feed("SCENE_", 200);
    assert.equal(ready.ready(2000), false);
    ready.feed("READY\n", 300);
    assert.equal(ready.ready(2000), false);
    ready.feed("==========\n", 400);
    assert.equal(ready.ready(400), true);
    assert.equal(ready.ready(900), false);
    const noBanner = new Readiness();
    noBanner.feed("Server started.\n", 0);
    assert.equal(noBanner.ready(499), false);
    assert.equal(noBanner.ready(500), true);
    assert.equal(new Readiness("MISSING").ready(200000), false);
});

test("network selection prefers LAN/gateway adapters and excludes VPNs with private addresses", () =>
{
    const addresses = [ { address: "192.168.9.1",
        gateway: true,
        name: "WireGuard tunnel" },
    { address: "10.0.0.2",
        gateway: true,
        name: "Ethernet" },
    { address: "192.168.1.2",
        gateway: false,
        name: "Wi-Fi" },
    { address: "192.168.1.3",
        gateway: true,
        name: "Ethernet 2" } ];
    assert.equal(selectAddress(addresses), "192.168.1.3");
    assert.equal(selectAddress(addresses.slice(0, 1)), "127.0.0.1");
});

test("format-3 release versions satisfy dependencies and activate as numeric triples", async () =>
{
    const root = await mkdtemp(path.join(os.tmpdir(), "demonstration-format3-"));
    try
    {
        const engine = path.join(root, "engine");
        const world = path.join(root, "world");
        const bp = path.join(root, "bp");
        const rp = path.join(root, "rp");
        for (const folder of [ engine, world, bp, rp, path.join(engine, "behavior_packs"),
            path.join(engine, "resource_packs") ])
        {
            await mkdir(folder, { recursive: true });
        }

        await writeFile(path.join(engine, "bedrock_server.exe"), "fake engine");
        await writeFile(path.join(world, "level.dat"), "new world");
        const bpId = "10000000-0000-4000-8000-000000000011";
        const rpId = "10000000-0000-4000-8000-000000000012";
        const manifest = (version: string) => JSON.stringify({
            dependencies: [ { uuid: rpId,
                version } ],
            header: { uuid: bpId,
                version: [ 1, 0, 0 ] }
        });
        await writeFile(path.join(bp, "manifest.json"), manifest("1.14.1"));
        await writeFile(path.join(rp, "manifest.json"), JSON.stringify({ format_version: 3,
            header: { uuid: rpId,
                version: "1.14.1" } }));
        const options = { bds: engine,
            behaviorPacks: [ bp ],
            description: "Format three",
            name: "Format Three",
            output: path.join(root, "server"),
            resourcePacks: [ rp ],
            world };
        await createDemonstration(options);
        assert.deepEqual(JSON.parse(await readFile(path.join(root,
            "server/worlds/format-three/world_resource_packs.json"), "utf8")),
        [ { pack_id: rpId,
            version: [ 1, 14, 1 ] } ]);
        await writeFile(path.join(bp, "manifest.json"), manifest("1.14.2"));
        await assert.rejects(createDemonstration(options), /Missing pack dependency/);
        await writeFile(path.join(bp, "manifest.json"), manifest("1.14.1"));
        await writeFile(path.join(rp, "manifest.json"), JSON.stringify({ header: { uuid: rpId,
            version: "1.14.1-beta" } }));
        await assert.rejects(createDemonstration(options), /Invalid pack manifest/);
    }
    finally
    {
        await rm(root, { force: true,
            recursive: true });
    }
});

test("creation isolates credentials, activates packs, backs up " +
    "complete old worlds and preserves them on failure", async () =>
{
    const root = await mkdtemp(path.join(os.tmpdir(), "demonstration-"));
    try
    {
        const engine = path.join(root, "engine");
        const world = path.join(root, "world");
        const bp = path.join(root, "bp");
        const rp = path.join(root, "rp");
        const output = path.join(root, "server");
        for (const folder of [ engine, world, bp, rp, path.join(engine, "behavior_packs/vanilla"),
            path.join(engine, "resource_packs/vanilla"), path.join(engine, "worlds/private") ])
        {
            await mkdir(folder, { recursive: true });
        }

        await writeFile(path.join(engine, "bedrock_server.exe"), "fake engine");
        await writeFile(path.join(engine, "permissions.json"), "SECRET");
        await writeFile(path.join(world, "level.dat"), "new world");
        const bpId = "10000000-0000-4000-8000-000000000001";
        const rpId = "10000000-0000-4000-8000-000000000002";
        await writeFile(path.join(bp, "manifest.json"), JSON.stringify({
            dependencies: [ { uuid: rpId,
                version: [ 1, 0, 0 ] } ],
            header: { uuid: bpId,
                version: [ 1, 0, 0 ] }
        }));
        await writeFile(path.join(rp, "manifest.json"), JSON.stringify({ header: { uuid: rpId,
            version: [ 1, 0, 0 ] } }));
        const options = {
            bds: engine,
            behaviorPacks: [ bp ],
            description: "A prepared scene",
            name: "Small Demo",
            output,
            resourcePacks: [ rp ],
            world
        };
        const created = await createDemonstration(options);
        assert.equal(created.backup, undefined);
        await writeFile(path.join(output, DemoFiles.Lock), String(process.pid));
        await assert.rejects(createDemonstration(options), /running/);
        await rm(path.join(output, DemoFiles.Lock));
        assert.equal(await readFile(path.join(output, "worlds/small-demo/level.dat"), "utf8"), "new world");
        assert.deepEqual(JSON.parse(await readFile(path.join(output,
            "worlds/small-demo/world_behavior_packs.json"), "utf8")),
        [ { pack_id: bpId,
            version: [ 1, 0, 0 ] } ]);
        assert.deepEqual(JSON.parse(await readFile(path.join(output, "permissions.json"), "utf8")), []);
        await assert.rejects(readFile(path.join(output, "worlds/private/level.dat")));
        const properties = await readFile(path.join(output, "server.properties"), "utf8");
        assert.match(properties, /texturepack-required=true/);
        assert.match(properties, /server-port=19132/);
        await writeFile(path.join(output, "worlds/small-demo/visitor-progress"), "keep me");
        const replacement = await createDemonstration(options);
        assert.equal(await readFile(path.join(replacement.backup!,
            "worlds/small-demo/visitor-progress"), "utf8"), "keep me");
        await assert.rejects(createDemonstration({ ...options,
            resourcePacks: [] }), /Missing pack dependency/);
        assert.equal(await readFile(path.join(output, "worlds/small-demo/level.dat"), "utf8"), "new world");
        await assert.rejects(createDemonstration({ ...options,
            output: path.join(engine, "unsafe") }), /overlap/);
        await assert.rejects(createDemonstration({ ...options,
            name: " " }), /name/);
        await assert.rejects(createDemonstration({ ...options,
            port: 65536 }), /ports/);
        const unmarked = path.join(root, "unmarked");
        await mkdir(unmarked);
        await writeFile(path.join(unmarked, "important"), "keep");
        await assert.rejects(createDemonstration({ ...options,
            output: unmarked }));
        assert.equal(await readFile(path.join(unmarked, "important"), "utf8"), "keep");
        const broken = path.join(root, "broken-world");
        await cp(world, broken, { recursive: true });
        await rm(path.join(broken, "level.dat"));
        await assert.rejects(createDemonstration({ ...options,
            world: broken }));
        assert.equal(await readFile(path.join(output, "worlds/small-demo/level.dat"), "utf8"), "new world");
    }
    finally
    {
        await rm(root, { force: true,
            recursive: true });
    }
});
