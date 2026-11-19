/**
 * Verifies the standalone common archive and its persistent pack identities.
 *
 * @module bedform-common/Test/Build.test
 *
 * @file      Build.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { CameraPreset, EntityEvent, EntityProperty } from
    "../../../Package/Bedform/Source/Diagetic/Keys.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Build } from "../Tool/Build.mts";
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { unzipSync } from "fflate";

test("standalone builds preserve linked manifests, fixed identities and archive bytes", async () =>
{
    const directory = await mkdtemp(path.join(tmpdir(), "bedform-common-"));
    try
    {
        const first = await readFile(await Build(directory));
        assert.deepEqual(await readFile(await Build(directory)), first);
        const addon = unzipSync(first);
        assert.deepEqual(Object.keys(addon).sort(),
            [ "bedform-common-bp.mcpack", "bedform-common-rp.mcpack" ]);
        const version = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
            .version.split(".").map(Number);
        const manifests = [];
        for (const [ archive, pack, type, header, module ] of [
            [ "bedform-common-bp.mcpack", "behavior_packs", "data",
                "f0ae8683-f8dc-4d1f-9a6e-4059f4035e10", "922982ea-e393-41e5-b397-aaae537a3aee" ],
            [ "bedform-common-rp.mcpack", "resource_packs", "resources",
                "c15f802e-ae6c-4b64-9037-db7fb035f1e8", "a91ce449-9145-42d5-a221-5652b080338a" ]
        ])
        {
            const files = unzipSync(addon[archive]);
            assert.deepEqual(Object.keys(files).filter((name: string) =>
                !name.startsWith("textures/bedform/")), type === "data"
                ? [ "License.Mojang.txt", "cameras/presets/diagetic_snapshot.json",
                    "entities/diagetic_lever.json", "entities/diagetic_release_target.json",
                    "entities/diagetic_slider.json",
                    "entities/diagetic_wheel.json", "entities/player.json", "manifest.json",
                    "scripts/main.js" ]
                : [ "License.Mojang.txt", "animations/bedform_diagetic.animation.json",
                    "entity/diagetic_lever.entity.json", "entity/diagetic_release_target.entity.json",
                    "entity/diagetic_slider.entity.json",
                    "entity/diagetic_wheel.entity.json", "entity/player.entity.json", "manifest.json",
                    "models/entity/diagetic_lever.geo.json", "models/entity/diagetic_slider.geo.json",
                    "models/entity/diagetic_wheel.geo.json",
                    "render_controllers/bedform_diagetic.render_controllers.json", "texts/en_US.lang",
                    "texts/languages.json" ]);
            const source = await readFile(new URL(
                `../${pack}/bedform_common/manifest.json`, import.meta.url
            ));
            assert.deepEqual(Buffer.from(files["manifest.json"]), source);
            const manifest = JSON.parse(source.toString());
            assert.equal(manifest.format_version, 2);
            assert.equal(manifest.header.uuid, header);
            assert.deepEqual(manifest.header.version, version);
            assert.deepEqual(manifest.header.min_engine_version, [ 1, 26, 60 ]);
            assert.deepEqual(manifest.modules, [ { type,
                uuid: module,
                version: version }, ...type === "data" ? [ { entry: "scripts/main.js",
                language: "javascript",
                type: "script",
                uuid: "82d1ef5f-59f2-480f-9f04-2e21987e9105",
                version: version } ] : [] ]);
            manifests.push(manifest);
        }

        const [ behavior, resource ] = manifests;
        assert.deepEqual(behavior.dependencies, [ { uuid: resource.header.uuid,
            version: resource.header.version }, { module_name: "@minecraft/server",
            version: "2.10.0" } ]);
        assert.equal(resource.dependencies, undefined);
        const bp = unzipSync(addon["bedform-common-bp.mcpack"]);
        const rp = unzipSync(addon["bedform-common-rp.mcpack"]);
        const player = JSON.parse(Buffer.from(bp["entities/player.json"]).toString())["minecraft:entity"];
        assert.equal(player.description.properties[EntityProperty.CameraActive].client_sync, true);
        assert.deepEqual(player.events[EntityEvent.Lock].set_property,
            { [EntityProperty.CameraActive]: true });
        assert.deepEqual(player.events[EntityEvent.Unlock].set_property,
            { [EntityProperty.CameraActive]: false });
        const preset = JSON.parse(
            Buffer.from(bp["cameras/presets/diagetic_snapshot.json"]).toString()
        )["minecraft:camera_preset"];
        assert.equal(preset.identifier, CameraPreset);
        assert.equal(preset.player_effects, true);
        assert.equal(preset.fov, undefined);
        const client = JSON.parse(
            Buffer.from(rp["entity/player.entity.json"]).toString()
        )["minecraft:client_entity"].description;
        assert.ok(client.scripts.pre_animation[0].includes(EntityProperty.CameraActive));
        const text = (files: Record<string, Uint8Array>, name: string): string =>
            Buffer.from(files[name]).toString();
        const script = text(bp, "scripts/main.js");
        assert.deepEqual([ ...script.matchAll(/^import .* from "([^"]+)";$/gmu) ]
            .map((match: RegExpExecArray) => match[1]), [ "@minecraft/server" ]);
        assert.doesNotMatch(script, /node:|require\(/u);
        const resources = text(rp, "animations/bedform_diagetic.animation.json") +
            text(rp, "render_controllers/bedform_diagetic.render_controllers.json") +
            [ "lever", "slider", "wheel" ].map((kind: string) =>
                text(rp, `models/entity/diagetic_${kind}.geo.json`)).join("");
        const lang = text(rp, "texts/en_US.lang");
        for (const kind of [ "lever", "slider", "wheel" ])
        {
            const identifier = `bedform:diagetic_${kind}`;
            const server = JSON.parse(text(bp, `entities/diagetic_${kind}.json`))["minecraft:entity"];
            assert.equal(server.description.identifier, identifier);
            assert.equal(Object.keys(server.description.properties).length, 8);
            assert.deepEqual(server.description.properties[EntityProperty.Highlighted],
                { client_sync: true,
                    default: false,
                    type: "bool" });
            assert.equal(server.components["minecraft:pushable"], undefined);
            const client = JSON.parse(text(rp, `entity/diagetic_${kind}.entity.json`));
            const entity = client["minecraft:client_entity"].description;
            assert.equal(entity.identifier, identifier);
            for (const reference of [ ...Object.values(entity.geometry), ...Object.values(entity.animations),
                ...entity.render_controllers ] as Array<string>)
            {
                assert.ok(resources.includes(`"${reference}"`), reference);
            }

            assert.ok(lang.includes(`entity.${identifier}.name=`));
            assert.match(lang, /^action\.interact\.bedform\.diagetic=Grab$/mu);
        }

        assert.ok(!Object.keys({ ...bp,
            ...rp }).some((name: string) => /button/u.test(name)));
        const metadata = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
        assert.equal(metadata.name, "bedform-common");
        assert.equal(metadata.private, true);
        assert.equal(metadata.version, behavior.header.version.join("."));
    }
    finally
    {
        await rm(directory, { force: true,
            recursive: true });
    }
});
