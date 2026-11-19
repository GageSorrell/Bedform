/**
 * Real-time BDS benchmark with observed runtime timing and explicit failed gates.
 *
 * @module bedform/Test/Engine/benchmark
 *
 * @file      benchmark.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Scene records preserve geometric ordering and contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import { world, system, type Entity } from "@minecraft/server";
import * as Runtime from "../../Source/PhysicsRuntime.js";
import { makeHost } from "../../Source/Internal/PhysicsBedrock.js";
import * as E from "../../Source/PhysicsEntity.js";
import * as V from "../../Source/Vector3.js";
import * as Q from "../../Source/Quat.js";
import * as R from "@bedform/effect/Result";
import * as O from "@bedform/effect/Option";
import { Models } from "./catalog.mjs";
import { TickingArea } from "./keys.mjs";
declare const BenchmarkSeconds: number;
declare const BenchmarkScene: string;
declare const BenchmarkProfile: boolean;

/**
 * Nearest-rank sample statistics; durations are observations rather than simulated time.
 *
 * @category Measurement
 * @since 1.0.0
 */
const statistics = (values: ReadonlyArray<number>) =>
{
    const Sorted = [ ...values ].sort((a, b) => a - b);
    const At = (fraction: number): number | null => Sorted.length ? Sorted[Math.max(0, Math.ceil(Sorted.length * fraction) - 1)] : null;
    return { samples: Sorted.length,
        min: At(0),
        median: At(0.5),
        p95: At(0.95),
        p99: At(0.99),
        max: At(1),
        mean: Sorted.length ? Sorted.reduce((sum, value) => sum + value, 0) / Sorted.length : null };
};

/**
 * Runs full runtime work, including loaded terrain, native contacts, owner property
 * publication and persistence. Sleep is disabled and airborne bodies rotate under
 * zero gravity. Grounded/native contacts remain part of the same measured tick.
 *
 * @category Benchmark
 * @since 1.0.0
 */
const begin = (): void =>
{
    const Dimension = world.getDimension("overworld");
    Dimension.runCommand(`tickingarea add circle 30 100 14 4 ${TickingArea.Benchmark} true`);
    system.runTimeout(() =>
    {
        try
        {
            Dimension.runCommand("fill -3 98 -3 64 108 32 air");
            Dimension.runCommand("fill -3 98 -3 64 98 32 stone");
            Dimension.runCommand("gamerule doMobSpawning false");
            const Definitions = new Map(Object.values(Models).map((model) => [ model.name, R.getOrThrow(E.define(model)) ]));
            const Scenes = [ { name: "mixed-128",
                count: 128,
                seconds: BenchmarkSeconds },
            { name: "all-complex-128",
                count: 128,
                seconds: Math.min(60, BenchmarkSeconds) },
            ...[ "mesh_cube", "mesh_concave", "mesh_cavity", "mesh_disconnected" ].map((name) => ({ name,
                count: 32,
                seconds: Math.min(10, BenchmarkSeconds) })) ].filter((entry) => BenchmarkScene === "all" || entry.name === BenchmarkScene);
            let scene = 0;
            const Next = (): void =>
            {
                if (scene >= Scenes.length)
                {
                    console.warn("BF_BENCH_DONE");
                    return;
                }

                const Config = Scenes[scene++];
                const Total: Array<number> = [];
                const Solver: Array<number> = [];
                const Publish: Array<number> = [];
                const Diagnostics: Array<Runtime.Diagnostic> = [];
                const Profiles: Array<Runtime.TickMetrics.Profile> = [];
                const Natives: Array<Entity> = [];
                let warmup = BenchmarkSeconds >= 600 ? 20 : 2;
                let started = 0;
                let lastProgress = Date.now();
                let activeMin = Config.count;
                let failedTicks = 0;
                let invalidClock = 0;
                let terrainTicks = 0;
                let nativeTicks = 0;
                let terrainReads = 0;
                let finishing = false;
                const Physics = R.getOrThrow(Runtime.start({ host: makeHost({ namespace: "bedform_fixture",
                    dimensions: [ Dimension.id ] }),
                models: Object.values(Models),
                profile: BenchmarkProfile,
                maxNativeHelpers: 8,
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
                diagnostic: (error) =>
                {
                    if (Diagnostics.length < 100)
                    {
                        Diagnostics.push(error);
                    }
                },
                clock: () => Date.now(),
                metrics: (sample) =>
                {
                    if (sample.profile && Profiles.length < 20)
                    {Profiles.push(sample.profile);}

                    try
                    {
                        if (finishing)
                        {
                            return;
                        }

                        if (warmup > 0)
                        {
                            warmup--;
                            if (!warmup)
                            {
                                started = Date.now();
                            }

                            return;
                        }

                        Total.push(sample.totalMs);
                        Solver.push(sample.solverMs);
                        Publish.push(sample.publishMs);
                        activeMin = Math.min(activeMin, sample.active);
                        failedTicks += Number(sample.failed);
                        invalidClock += Number(!sample.clockValid);
                        terrainTicks += Number(sample.terrainContacts > 0);
                        nativeTicks += Number(sample.nativeContacts > 0);
                        terrainReads += sample.terrainReads;
                        const Elapsed = Date.now() - started;
                        if (Date.now() - lastProgress >= 30000)
                        {
                            lastProgress = Date.now();
                            console.warn(`BF_BENCH_PROGRESS ${JSON.stringify({ scene: Config.name,
                                elapsedMs: Elapsed,
                                samples: Total.length,
                                activeMin,
                                failedTicks })}`);
                        }

                        if (Elapsed < Config.seconds * 1000)
                        {
                            return;
                        }

                        finishing = true;
                        const Stats = statistics(Total);
                        const FullWindow = Config.name === "mixed-128" && Config.seconds >= 600;
                        const Complete = Elapsed >= Config.seconds * 1000 && Total.length > 0;
                        const PerformancePassed = Stats.p95 !== null && Stats.p95 < 15;
                        const Healthy = activeMin === Config.count && failedTicks === 0 && invalidClock === 0 && Diagnostics.length === 0;
                        console.warn(`BF_BENCH_RESULT ${JSON.stringify({ scene: Config.name,
                            requestedSeconds: Config.seconds,
                            elapsedMs: Elapsed,
                            simulatedSeconds: Total.length * 0.05,
                            expectedTicksAt20Hz: Config.seconds * 20,
                            activeMin,
                            timing: Stats,
                            solver: statistics(Solver),
                            publication: statistics(Publish),
                            meanTerrainReads: terrainReads / Total.length,
                            terrainContactTicks: terrainTicks,
                            nativeContactTicks: nativeTicks,
                            failedTicks,
                            invalidClock,
                            diagnostics: Diagnostics,
                            completed: Complete,
                            performancePassed: PerformancePassed,
                            qualified: FullWindow && Complete && Healthy && PerformancePassed && terrainTicks > 0 && nativeTicks > 0 && Total.length >= 11999 })}`);
                        for (const Id of Physics.world(Dimension.id)?.bodies.filter((body) => body.id.startsWith("benchmark-")).map((body) => body.id) ?? [])
                        {
                            R.getOrThrow(Physics.remove(Id));
                        }

                        Physics.dispose();
                        for (const Native of Natives)
                        {
                            if (Native.isValid)
                            {
                                Native.remove();
                            }
                        }

                        system.runTimeout(Next, 2);
                    }
                    catch (error)
                    {
                        console.error(`BF_FAIL benchmark measurement ${String(error)}`);
                    }
                } }));
                for (let i = 0; i < Config.count; i++)
                {
                    const Kind = Config.name.startsWith("mesh_") ? Config.name : Config.name === "all-complex-128" || i >= 96 ? "complex" : i < 4 ? "box" : [ "box", "sphere", "capsule", "ellipsoid" ][i % 4];
                    const Grounded = i < 4 && !Config.name.startsWith("mesh_");
                    const Model = Models[Kind];
                    const X = (i % 16) * 4;
                    const Z = Math.floor(i / 16) * 4;
                    const Y = Grounded ? 99 - Model.bounds.min.y : 103;
                    R.getOrThrow(Physics.spawn(R.getOrThrow(E.make(Definitions.get(Kind)!, { id: `benchmark-${i}`,
                        allowSleep: false,
                        pose: { position: V.Vector3Unsafe(X, Y, Z),
                            rotation: Q.Identity },
                        gravity: Grounded ? O.none() : O.some(V.Zero),
                        angularVelocity: Grounded ? V.Zero : V.Vector3Unsafe(0, 0.25, 0) })), Dimension.id));
                    if (Grounded)
                    {
                        const Pig = Dimension.spawnEntity("minecraft:pig", { x: X,
                            y: Y + Model.bounds.max.y + 0.1,
                            z: Z });
                        Pig.addEffect("slowness", 100000, { amplifier: 255,
                            showParticles: false });
                        Natives.push(Pig);
                    }
                }

                console.warn(`BF_BENCH_SCENE ${JSON.stringify(Config)}`);
            };

            Next();
        }
        catch (error)
        {
            console.error(`BF_FAIL benchmark setup ${String(error)}`);
        }
    }, 20);
};

system.runTimeout(() =>
{
    try
    {
        begin();
    }
    catch (error)
    {
        console.error(`BF_FAIL benchmark bootstrap ${String(error)}`);
    }
}, 20);
