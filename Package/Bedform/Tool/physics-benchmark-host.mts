/**
 * Timed host runtime campaign. Engine acceptance is reported separately by BDS.
 *
 * @module bedform/Tool/physics-benchmark-host
 *
 * @file      physics-benchmark-host.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Reproducible fixture records preserve contextual types and geometric order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { cpus, totalmem, release } from "node:os";
import { setTimeout as wait } from "node:timers/promises";
import { createFixtures } from "./physics-fixtures.mjs";
import * as Runtime from "../Source/PhysicsRuntime.js";
import * as E from "../Source/PhysicsEntity.js";
import * as V from "../Source/Vector3.js";
import * as B from "../Source/AABB.js";
import * as Q from "../Source/Quat.js";
import * as O from "@bedform/effect/Option";
import * as R from "@bedform/effect/Result";
const SecondsIndex = process.argv.indexOf("--seconds");
const Seconds = SecondsIndex < 0 ? 600 : Number(process.argv[SecondsIndex + 1]);
if (!Number.isFinite(Seconds) || Seconds < 1 || Seconds > 3600)
{throw new Error("Seconds must be in [1,3600]");}

const SceneIndex = process.argv.indexOf("--scene");
const SelectedScene = SceneIndex < 0 ? undefined : process.argv[SceneIndex + 1];
if (SceneIndex >= 0 && ![ "mixed-128", "all-complex-128", "mesh_cube", "mesh_concave", "mesh_cavity", "mesh_disconnected" ].includes(SelectedScene ?? ""))
{throw new Error("Unknown or missing host benchmark scene");}

const Root = Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), "..");
await Fs.mkdir(Path.join(Root, "dist"), { recursive: true });
const Run = await Fs.mkdtemp(Path.join(Root, "dist/physics-host-benchmark-"));
const Fixtures = await createFixtures(Run, Path.join(Run, "bp"), Path.join(Run, "rp"));
const Models = new Map(Fixtures.compilation.models.map((model) => [ model.name, model ]));
const Definitions = new Map(Fixtures.compilation.models.map((model) => [ model.name, R.getOrThrow(E.define(model)) ]));
const Results: Array<unknown> = [];
const Report = { scope: "host ports; not BDS or real client evidence",
    requestedSeconds: Seconds,
    hardware: { processors: cpus().map((cpu) => cpu.model),
        logicalProcessors: cpus().length,
        memoryBytes: totalmem(),
        os: release(),
        node: process.version },
    meshes: Fixtures.meshes,
    complexAuthoredCubes: Fixtures.complexAuthoredCubes,
    completed: false,
    results: Results };
const Save = (): Promise<void> => Fs.writeFile(Path.join(Run, "report.json"), JSON.stringify(Report, null, 2));
await Save();
console.warn(`Host benchmark evidence: ${Run}`);
for (const Scene of [ { name: "mixed-128",
    count: 128,
    seconds: Seconds }, { name: "all-complex-128",
    count: 128,
    seconds: Math.min(60, Seconds) },
...[ "mesh_cube", "mesh_concave", "mesh_cavity", "mesh_disconnected" ].map((name) => ({ name,
    count: 32,
    seconds: Math.min(10, Seconds) })) ].filter((scene) => SelectedScene === undefined || scene.name === SelectedScene))
{
    const Owners: Array<Runtime.Owner> = [];
    const Actors: Array<{
        position: V.Vector3;
        velocity: V.Vector3;
    }> = [];
    const Helpers = new Set<V.Vector3>();
    const Durations: Array<number> = [];
    const Solver: Array<number> = [];
    const Publish: Array<number> = [];
    const Diagnostics: Array<Runtime.Diagnostic> = [];
    const Profiles: Array<Runtime.TickMetrics.Profile> = [];
    let tick: (() => void) | undefined;
    let activeMin = Scene.count;
    let failedTicks = 0;
    let nativeTicks = 0;
    let terrainTicks = 0;
    const Host: Runtime.Host = {
        discover: () => Owners,
        spawn: (model, dimension, input) =>
        {
            let position = input;
            let valid = true;
            const Data = new Map<string, unknown>();
            const Properties = new Map<string, number>();
            const Owner: Runtime.Owner = { id: String(Owners.length),
                identifier: model.identifier,
                dimension: () => dimension,
                loaded: () => valid,
                position: () => position,
                move: (_dimension, next) =>
                {
                    position = next;
                },
                read: (key) => Data.get(key),
                write: (key, value) =>
                {
                    Data.set(key, value);
                },
                property: (key, value) =>
                {
                    Properties.set(key, value);
                },
                readProperty: (key) => Properties.get(key),
                remove: () =>
                {
                    valid = false;
                } };
            Owners.push(Owner);
            return Owner;
        },
        block: (_dimension, position) => ({ identifier: position.y <= 98 ? "minecraft:stone" : "minecraft:air",
            states: {},
            solid: position.y <= 98 }),
        cleanupTransients: () =>
        {
        },
        onLoad: () => () =>
        {
        },
        onRemove: () => () =>
        {
        },
        onTick: (callback) =>
        {
            tick = callback;
            return () =>
            {
                tick = undefined;
            };
        },
        native: { query: () => Actors.map((actor, index) => ({ id: String(index),
            position: actor.position,
            velocity: actor.velocity,
            bounds: B.AABBUnsafe(V.add(actor.position, V.Vector3Unsafe(-0.45, 0, -0.45)), V.add(actor.position, V.Vector3Unsafe(0.45, 0.9, 0.45))),
            jumping: actor.velocity.y > 0.8,
            impulse: (delta) =>
            {
                actor.velocity = V.add(actor.velocity, delta);
            },
            move: (delta) =>
            {
                const Next = V.add(actor.position, delta);
                if (Next.y < 99)
                {return false;}

                actor.position = Next;
                return true;
            } })),
        helper: (_dimension, initial) =>
        {
            let position = initial;
            Helpers.add(position);
            return { move: (next) =>
            {
                Helpers.delete(position);
                position = next;
                Helpers.add(position);
            },
            dispose: () =>
            {
                Helpers.delete(position);
            } };
        } }
    };
    const Physics = R.getOrThrow(Runtime.start({ host: Host,
        profile: process.argv.includes("--profile"),
        models: Fixtures.compilation.models,
        clock: () => performance.now(),
        diagnostic: (error) =>
        {
            if (Diagnostics.length < 100)
            {Diagnostics.push(error);}
        },
        renderer: { attach: () => ({ commit: () =>
        {
        },
        rebase: () =>
        {
        },
        pause: () =>
        {
        },
        dispose: () =>
        {
        } }) },
        metrics: (sample) =>
        {
            if (sample.profile && Profiles.length < 20)
            {Profiles.push(sample.profile);}

            Durations.push(sample.totalMs);
            Solver.push(sample.solverMs);
            Publish.push(sample.publishMs);
            activeMin = Math.min(activeMin, sample.active);
            failedTicks += Number(sample.failed || !sample.clockValid);
            nativeTicks += Number(sample.nativeContacts > 0);
            terrainTicks += Number(sample.terrainContacts > 0);
        } }));
    for (let i = 0; i < Scene.count; i++)
    {
        const Kind = Scene.name.startsWith("mesh_") ? Scene.name : Scene.name === "all-complex-128" || i >= 96 ? "complex" : i < 4 ? "box" : [ "box", "sphere", "capsule", "ellipsoid" ][i % 4];
        const Grounded = i < 4 && !Scene.name.startsWith("mesh_");
        const Model = Models.get(Kind)!;
        const X = i % 16 * 4;
        const Z = Math.floor(i / 16) * 4;
        const Y = Grounded ? 99 - Model.bounds.min.y : 103;
        R.getOrThrow(Physics.spawn(R.getOrThrow(E.make(Definitions.get(Kind)!, { id: `benchmark-${i}`,
            allowSleep: false,
            pose: { position: V.Vector3Unsafe(X, Y, Z),
                rotation: Q.Identity },
            gravity: Grounded ? O.none() : O.some(V.Zero),
            angularVelocity: Grounded ? V.Zero : V.Vector3Unsafe(0, 0.25, 0) })), "overworld"));
        if (Grounded)
        {
            Actors.push({ position: V.Vector3Unsafe(X, Y + Model.bounds.max.y, Z),
                velocity: V.Zero });
        }
    }

    const Start = performance.now();
    let nextLog = Start + 30000;
    do
    {
        for (const Actor of Actors)
        {
            let floor = 99;
            for (const Helper of Helpers)
            {
                if (Math.abs(Actor.position.x - Helper.x) < 0.5125 && Math.abs(Actor.position.z - Helper.z) < 0.5125 && Actor.position.y >= Helper.y + 0.125 - 0.01)
                {floor = Math.max(floor, Helper.y + 0.125);}
            }

            Actor.velocity = V.add(Actor.velocity, V.Vector3Unsafe(0, -9.81 * 0.05, 0));
            Actor.position = V.add(Actor.position, V.scale(Actor.velocity, 0.05));
            if (Actor.position.y < floor)
            {
                Actor.position = V.Vector3Unsafe(Actor.position.x, floor, Actor.position.z);
                Actor.velocity = V.Vector3Unsafe(Actor.velocity.x, 0, Actor.velocity.z);
            }
        }

        tick!();
        if (performance.now() >= nextLog)
        {
            console.warn(JSON.stringify({ scene: Scene.name,
                elapsedSeconds: (performance.now() - Start) / 1000,
                ticks: Durations.length,
                activeMin,
                failedTicks }));
            nextLog = performance.now() + 30000;
        }

        await wait(Math.max(0, Start + Durations.length * 50 - performance.now()));
    } while (performance.now() - Start < Scene.seconds * 1000);

    const Stats = (values: ReadonlyArray<number>) =>
    {
        const Sorted = [ ...values ].sort((a, b) => a - b);
        return { samples: Sorted.length,
            median: Sorted[Math.ceil(Sorted.length * 0.5) - 1],
            p95: Sorted[Math.ceil(Sorted.length * 0.95) - 1],
            p99: Sorted[Math.ceil(Sorted.length * 0.99) - 1],
            max: Sorted.at(-1),
            mean: Sorted.reduce((sum, value) => sum + value, 0) / Sorted.length };
    };

    const Timing = Stats(Durations);
    const Result = { profiles: Profiles,
        scene: Scene.name,
        elapsedMs: performance.now() - Start,
        simulatedSeconds: Durations.length * 0.05,
        activeMin,
        failedTicks,
        nativeContactTicks: nativeTicks,
        terrainContactTicks: terrainTicks,
        timing: Timing,
        solver: Stats(Solver),
        publication: Stats(Publish),
        diagnostics: Diagnostics,
        hostPerformancePassed: Timing.p95 < 15 && failedTicks === 0 && activeMin === Scene.count && Diagnostics.length === 0,
        engineQualified: false };
    Results.push(Result);
    console.warn(JSON.stringify(Result));
    Physics.dispose();
    await Save();
}

Report.completed = true;
await Save();
console.warn(`Completed host campaign: ${Path.join(Run, "report.json")}`);
if (Results.some((result) => Number((result as {
    failedTicks: number;
}).failedTicks) > 0) ||
    Seconds >= 600 && !(Results[0] as {
        hostPerformancePassed: boolean;
    }).hostPerformancePassed)
{throw new Error(`Host benchmark acceptance failed; report retained: ${Path.join(Run, "report.json")}`);}
