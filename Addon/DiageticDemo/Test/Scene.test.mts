/**
 * Verifies the demonstration scene layout, tuned definitions and built pack dependencies.
 *
 * @module @sorrell/diagetic-demo/Test/Scene.test
 *
 * @file      Scene.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Build, Identity } from "../Tool/Build.mts";
import { Cubes, Desk, Faces, Floor, FreeControls, Lamps, Signs, Wall, WallControls }
    from "../Script/Layout.ts";
import { DemoControls, DemoEntity, GaugeLength } from "../Script/Controls.ts";
import type { Vector3 } from "@minecraft/server";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Tests whether a block position lies inside an inclusive box.
 *
 * @category Testing
 * @since 1.0.0
 */
function Inside(position: Vector3, from: Vector3, to: Vector3): boolean
{
    return [ "x", "y", "z" ].every((axis: string) =>
    {
        const key = axis as keyof Vector3;
        return position[key] >= Math.min(from[key], to[key]) && position[key] <= Math.max(from[key], to[key]);
    });
}

test("the scene has every face, wall-bound feedback and free controls standing on the desk", () =>
{
    assert.deepEqual([ ...Faces ].sort(), [ "Down", "East", "North", "South", "Up", "West" ]);
    assert.deepEqual(Cubes.map((cube: (typeof Cubes)[number]) => cube.Kind), [ "lever", "slider", "wheel" ]);
    for (const cube of Cubes)
    {
        assert.ok(cube.Position.y >= Floor + 2, "bottom face must be reachable and clear of the floor");
    }

    for (const control of WallControls)
    {
        assert.ok(Inside(control.Position, Wall.From, Wall.To));
        assert.equal(control.Face, "North");
        assert.ok(control.Position.y + 2 <= Wall.To.y, "feedback blocks stay inside the wall");
    }

    const throttle = WallControls.find((control: (typeof WallControls)[number]) =>
        control.EntityType === DemoEntity.SpringThrottle)!;
    assert.ok(Inside({ x: throttle.Position.x - GaugeLength / 2 + 1,
        y: throttle.Position.y + 2,
        z: throttle.Position.z }, Wall.From, Wall.To));
    assert.ok(Inside({ x: throttle.Position.x + GaugeLength / 2,
        y: throttle.Position.y + 2,
        z: throttle.Position.z }, Wall.From, Wall.To));
    for (const lamp of Lamps)
    {
        assert.ok(Inside(lamp, Wall.From, Wall.To));
    }

    for (const control of FreeControls)
    {
        assert.ok(Inside({ x: Math.floor(control.Location.x),
            y: control.Location.y - 1,
            z: Math.floor(control.Location.z) }, Desk.From, Desk.To));
    }

    const occupied = [ ...Cubes.map((cube: (typeof Cubes)[number]) => cube.Position),
        ...Signs.map((sign: (typeof Signs)[number]) => sign.Position) ]
        .map((position: Vector3) => `${position.x},${position.y},${position.z}`);
    assert.equal(new Set(occupied).size, occupied.length);
    assert.ok(Signs.every((sign: (typeof Signs)[number]) => !Inside(sign.Position, Wall.From, Wall.To) &&
        !Inside(sign.Position, Desk.From, Desk.To)));
    assert.deepEqual(DemoControls.map((control: (typeof DemoControls)[number]) => control.EntityType).sort(),
        Object.values(DemoEntity).sort());
});

test("built demo packs depend on the staged BedformCommon packs and declare every demo entity", async () =>
{
    const packs = await Build();
    const read = async (directory: string, file: string): Promise<any> =>
        JSON.parse(await readFile(path.join(directory, file), "utf8"));
    const commonBehavior = await read(packs.CommonBehavior, "manifest.json");
    const commonResource = await read(packs.CommonResource, "manifest.json");
    const behavior = await read(packs.Behavior, "manifest.json");
    const resource = await read(packs.Resource, "manifest.json");
    assert.equal(behavior.header.uuid, Identity.Behavior);
    assert.deepEqual(behavior.dependencies, [ { uuid: Identity.Resource,
        version: resource.header.version }, { uuid: commonBehavior.header.uuid,
        version: commonBehavior.header.version }, { module_name: "@minecraft/server",
        version: "2.10.0" } ]);
    assert.deepEqual(resource.dependencies, [ { uuid: commonResource.header.uuid,
        version: commonResource.header.version } ]);
    for (const identifier of Object.values(DemoEntity))
    {
        const name = identifier.split(":")[1];
        const server = await read(packs.Behavior, `entities/${name}.json`);
        const client = await read(packs.Resource, `entity/${name}.entity.json`);
        assert.equal(server["minecraft:entity"].description.identifier, identifier);
        assert.equal(client["minecraft:client_entity"].description.identifier, identifier);
    }

    const script = await readFile(path.join(packs.Behavior, "scripts/main.js"), "utf8");
    assert.deepEqual([ ...script.matchAll(/^import .* from "([^"]+)";$/gmu) ]
        .map((match: RegExpExecArray) => match[1]), [ "@minecraft/server" ]);
});
