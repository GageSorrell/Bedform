/**
 * Native helper feasibility probe before enabling the native bridge.
 *
 * @module bedform/Test/Engine/physics
 *
 * @file      physics.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

/* Engine fixture records retain contextual types and geometric order. */
/* eslint-disable sort-keys, @stylistic/max-len */

import { TestDynamicProperty, TickingArea } from "./keys.mjs";
import { system, world } from "@minecraft/server";
import { runRuntime } from "./runtime.mjs";
system.runTimeout(() =>
{
    try
    {
        const Dimension = world.getDimension("overworld");
        if (world.getDynamicProperty(TestDynamicProperty.Phase) === "restart")
        {
            system.runTimeout(() =>
            {
                try
                {
                    runRuntime();
                }
                catch (error)
                {
                    console.error(`BF_FAIL ${String(error)}`);
                }
            }, 20);
            return;
        }

        // Explicit isolated fixture loading, never part of PhysicsRuntime.
        Dimension.runCommand(`tickingarea add circle 0 100 0 2 ${TickingArea.Fixture} true`);
        system.runTimeout(() =>
        {
            try
            {
                Dimension.runCommand("fill -5 98 -5 5 105 5 air");
                Dimension.runCommand("fill -5 98 -5 5 98 5 stone");
                const Helper = Dimension.spawnEntity("bedform_fixture:physics_support", { x: 0,
                    y: 100,
                    z: 0 });
                const Pig = Dimension.spawnEntity("minecraft:pig", { x: 0,
                    y: 101,
                    z: 0 });
                Pig.addEffect("slowness", 300, { amplifier: 255,
                    showParticles: false });
                system.runTimeout(() =>
                {
                    try
                    {
                        const Bounds = Pig.getAABB();
                        const Before = Pig.location;
                        const HelperBefore = Helper.location;
                        if (Math.abs(HelperBefore.y - 100) > 0.01)
                        {
                            throw new Error("Helper gravity was not disabled");
                        }

                        if (Math.abs(Before.y - 100.125) > 0.01)
                        {
                            throw new Error("Native did not stand on the generated helper");
                        }

                        console.warn(`BF_HELPER ${JSON.stringify({ helper: HelperBefore,
                            native: Before,
                            bounds: Bounds })}`);
                        Helper.teleport({ x: 0.5,
                            y: 100,
                            z: 0 });
                        system.runTimeout(() =>
                        {
                            try
                            {
                                console.warn(`BF_MOVING_HELPER ${JSON.stringify({ before: Before,
                                    after: Pig.location,
                                    bounds: Pig.getAABB() })}`);
                                Helper.remove();
                                Pig.remove();
                                console.warn("BF_HELPER_PASS component feasibility; moving support requires custom transport");
                                runRuntime();
                            }
                            catch (error)
                            {
                                console.error(`BF_FAIL ${String(error)}`);
                            }
                        }, 20);
                    }
                    catch (error)
                    {
                        console.error(`BF_FAIL ${String(error)}`);
                    }
                }, 40);
            }
            catch (error)
            {
                console.error(`BF_FAIL ${String(error)}`);
            }
        }, 20);
    }
    catch (error)
    {
        console.error(`BF_FAIL ${String(error)}`);
    }
}, 20);
