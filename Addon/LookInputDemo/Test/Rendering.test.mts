/**
 * Local-avatar hiding is explicitly wired and independent of other viewers and previews.
 *
 * @module @sorrell/look-input-demo/Test/Rendering.test
 *
 * @file      Rendering.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Build } from "../Tool/Build.mts";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

test("active local view keeps the vanilla first-person hand controller and animations", async () =>
{
    const packs = await Build();
    const vanilla = JSON.parse(await readFile(new URL("../Assets/player.client.vanilla.json",
        import.meta.url), "utf8"))["minecraft:client_entity"].description;
    const client = JSON.parse(await readFile(path.join(packs.resource,
        "entity/player.entity.json"), "utf8"));
    const entries = client["minecraft:client_entity"].description.render_controllers as
        Array<Record<string, string>>;
    assert.deepEqual(entries.map((entry: Record<string, string>) => Object.keys(entry)),
        vanilla.render_controllers.map((entry: Record<string, string>) => Object.keys(entry)));
    const scripts = client["minecraft:client_entity"].description.scripts;
    assert.deepEqual(scripts.pre_animation.slice(1), vanilla.scripts.pre_animation);
    assert.deepEqual(scripts.animate, vanilla.scripts.animate);
    for (const local of [ false, true ])
    {
        for (const active of [ false, true ])
        {
            for (const preview of [ false, true ])
            {
                for (const firstPerson of [ false, true ])
                {
                    const context = { query: { distance_from_camera: 4,
                        is_local_player: local,
                        is_spectator: false,
                        property: () => active },
                    variable: { is_first_person: firstPerson,
                        is_paperdoll: preview,
                        map_face_icon: false } };
                    runInNewContext(scripts.pre_animation[0], context);
                    const selected = entries.flatMap((entry: Record<string, string>) =>
                        Object.entries(entry).filter(([ , expression ]: [string, string]) =>
                            runInNewContext(expression, context)).map(([ name ]: [string, string]) => name));
                    if (local && active && !preview)
                    {
                        assert.deepEqual(selected, [ "controller.render.player.first_person" ]);
                    }
                    else
                    {
                        assert.equal(selected.length, 1);
                        assert.equal(selected[0], firstPerson ? "controller.render.player.first_person" :
                            "controller.render.player.third_person");
                    }
                }
            }
        }
    }
});

test("camera/property delivery races never select the face before pre-animation runs", async () =>
{
    const packs = await Build();
    const client = JSON.parse(await readFile(path.join(packs.resource,
        "entity/player.entity.json"), "utf8"))["minecraft:client_entity"].description;
    const entries = client.render_controllers as Array<Record<string, string>>;
    for (const animateFirst of [ false, true ])
    {
        for (const active of [ false, true ])
        {
            for (const distance of [ 0, 0.4, 1.12, 1.52, 1.62, 1.999 ])
            {
                const context = { query: { distance_from_camera: distance,
                    is_local_player: true,
                    is_spectator: false,
                    property: () => active },
                variable: { is_first_person: false,
                    is_paperdoll: false,
                    map_face_icon: false } };
                if (animateFirst)
                {
                    runInNewContext(client.scripts.pre_animation[0], context);
                }

                const selected = entries.flatMap((entry: Record<string, string>) =>
                    Object.entries(entry).filter(([ , expression ]: [string, string]) =>
                        runInNewContext(expression, context)).map(([ name ]: [string, string]) => name));
                assert.deepEqual(selected, [ "controller.render.player.first_person" ],
                    JSON.stringify({ active,
                        animateFirst,
                        distance }));
            }
        }
    }
});

test("proximity guard preserves remote, paperdoll, map and distant local controller selection", async () =>
{
    const packs = await Build();
    const native = JSON.parse(await readFile(new URL("../Assets/player.client.vanilla.json",
        import.meta.url), "utf8"))["minecraft:client_entity"].description;
    const client = JSON.parse(await readFile(path.join(packs.resource,
        "entity/player.entity.json"), "utf8"))["minecraft:client_entity"].description;
    for (const local of [ false, true ])
    {
        for (const paperdoll of [ false, true ])
        {
            for (const map of [ false, true ])
            {
                for (const distance of [ 0.4, 1.52, 2, 4, 16 ])
                {
                    if (local && !paperdoll && !map && distance < 2)
                    {
                        continue;
                    }

                    for (const spectator of [ false, true ])
                    {
                        const context = { query: { distance_from_camera: distance,
                            is_local_player: local,
                            is_spectator: spectator,
                            property: () => false },
                        variable: { is_first_person: false,
                            is_paperdoll: paperdoll,
                            map_face_icon: map } };
                        const evaluate = (controllers: Array<Record<string, string>>) =>
                            controllers.flatMap((entry: Record<string, string>) =>
                                Object.entries(entry).filter(([ , expression ]: [string, string]) =>
                                    runInNewContext(expression, context))
                                    .map(([ name ]: [string, string]) => name));
                        assert.deepEqual(evaluate(client.render_controllers),
                            evaluate(native.render_controllers));
                    }
                }
            }
        }
    }
});

test("snapshot camera retains player effects without a preset FOV or position offset", async () =>
{
    await Build();
    const preset = JSON.parse(await readFile(new URL(
        "../dist/behavior/cameras/presets/first_person_snapshot.json", import.meta.url), "utf8"));
    assert.deepEqual(preset["minecraft:camera_preset"], {
        identifier: "look_demo:first_person_snapshot",
        inherit_from: "minecraft:free",
        listener: "player",
        player_effects: true
    });
});
