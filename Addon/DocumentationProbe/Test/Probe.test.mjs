/**
 * Host regressions for independent packaging and the candidate search expression semantics.
 *
 * @module @sorrell/documentation-probe/Test/Probe.test
 *
 * @file      Probe.test.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { Build, Version } from "../Tool/Build.mjs";
import { Common, Edit, PendingQuery, Search, Sentinel } from "../Tool/Controls.mjs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Worlds } from "../Tool/Worlds.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { topLevelTags } from "../../../Script/level-dat.mts";
import { unzipSync } from "fflate";

/**
 * Evaluates only the generated grammar under the hypothesized first-substring-removal rule.
 *
 * @category Running
 * @since 1.0.12
 */
function Evaluate(expression, value)
{
    let at = 0;

    /**
     * Parses one expression from the restricted emitted search grammar.
     *
     * @category Decoding
     * @since 1.0.12
     */
    function Parse()
    {
        while (expression[at] === " ")
        {
            at++;
        }

        if (expression[at] === "'")
        {
            const end = expression.indexOf("'", ++at);
            const text = expression.slice(at, end);
            at = end + 1;
            return text;
        }

        if (expression[at] === "#")
        {
            while (/[#a-z]/.test(expression[at] ?? ""))
            {
                at++;
            }

            return value;
        }

        assert.equal(expression[at++], "(");
        const left = Parse();
        while (expression[at] === " ")
        {
            at++;
        }

        const operator = expression[at++];
        const right = Parse();
        while (expression[at] === " ")
        {
            at++;
        }

        assert.equal(expression[at++], ")");
        return operator === "+" ? left + right : left.replace(right, "");
    }

    const result = Parse();
    assert.equal(at, expression.length);
    return result;
}

test("emitted expressions match an independent ASCII subsequence oracle", () =>
{
    for (const text of [ "Stirling Engine Fuel Operation Burns coal", "Copper Wrench Repair Tools" ])
    {
        const search = Search(text, "test");
        let pending = PendingQuery;
        for (const control of search.controls)
        {
            pending = Evaluate(Object.values(control)[0].bindings[0].source_property_name, pending);
        }

        assert.equal(pending, PendingQuery);
        for (const query of [ "", "Se", "sE", "CW", "cw", "fOp", "rTl", "zzz", "nig", "  ", "GG", "OpB",
            "stirling", "STIRLING", "copperw", "COPPERW", "repairtools" ])
        {
            let remainder = query;
            for (const control of search.controls)
            {
                remainder = Evaluate(Object.values(control)[0].bindings[0].source_property_name, remainder);
            }

            let position = 0;
            for (const character of text.toLowerCase())
            {
                if (character === query.toLowerCase()[position])
                {
                    position++;
                }
            }

            assert.equal(remainder === "", position === query.length, `${text}: ${query}`);
        }
    }

    assert.throws(() => Search("Apostrophe's", "bad"));
    assert.throws(() => Search("café", "bad"));
    assert.equal(Sentinel, "\uE100");
});

test("independent packs retain disjoint definitions and unchanged shared shell in both orders", async () =>
{
    const directory = await mkdtemp(path.join(tmpdir(), "bedform-docs-probe-"));
    try
    {
        const common = await Build("common", directory);
        const alpha = await Build("alpha", directory);
        const beta = await Build("beta", directory);
        assert.ok(common.files["ui/inventory_screen.json"]);
        assert.ok(common.files["ui/hud_screen.json"].includes(`DOCS PROBE ${Version.join(".")}`));
        const shell = JSON.parse(common.files["ui/docs_probe_common.json"]);
        const registryKey = "registry@bedform_docs_probe.registry";
        assert.ok(shell.content.controls.some((control) => control[registryKey]));
        assert.ok(shell.registry.controls[0].recovery_status.text.includes("Full fixture indexes"));
        const diagnosticKey = "diagnostics@bedform_docs_probe.diagnostics";
        const diagnostics = shell.content.controls.find((control) => control[diagnosticKey])[diagnosticKey];
        assert.equal(Object.hasOwn(diagnostics, "bindings"), false);
        assert.equal(diagnostics.anchor_to, "bottom_left");
        for (const [ id, pack ] of [ [ "alpha", alpha ], [ "beta", beta ] ])
        {
            const definitions = JSON.parse(pack.files[`ui/docs_probe_${id}.json`]);
            assert.deepEqual(Object.keys(definitions).sort(), [ "diagnostic", "namespace", "result" ]);
            const definition = definitions.diagnostic;
            const index = JSON.parse(pack.files["probe-index.json"]);
            const steps = index.probeIndex.length;
            assert.equal(index.probeIndex, index.index);
            const stateNames = new Set([ "docs_query_text" ]);
            for (const control of definition.controls.slice(0, steps))
            {
                const [ stateName, state ] = Object.entries(control)[0];
                assert.ok(stateNames.has(state.bindings[0].source_control_name));
                assert.equal(state.bindings[0].target_property_name, "#text");
                assert.equal(state.bindings[0].binding_condition, "always");
                assert.equal(state.type, "label");
                assert.deepEqual(state.size, [ 1, 1 ]);
                assert.equal(state.property_bag["#text"], PendingQuery);
                stateNames.add(stateName);
            }

            assert.equal(definition.controls.length, steps + 3);
            assert.equal(definition.orientation, "horizontal");
            assert.equal(definition.controls[steps].caption.text, `${id} tail =`);
            assert.equal(definition.controls[steps + 1].value.property_bag["#tail_display"], "[not bound]");
            assert.equal(definition.controls[steps + 2].pending.text, "[pending]");
            const result = definitions.result;
            assert.ok(result.text.startsWith("Search: "));
            assert.equal(Object.hasOwn(result, "focus_identifier"), false);
            assert.equal(result.bindings.at(-1).source_property_name, "(#matched and #has_query)");
            const registration = JSON.parse(pack.files["ui/docs_probe_common.json"]);
            assert.equal(registration.diagnostics.modifications[0].value.length, 2);
            assert.equal(Object.hasOwn(pack.files, `ui/docs_probe_${id}_registration.json`), false);
            assert.deepEqual(Object.keys(registration).sort(), [ "diagnostics", "namespace" ]);
            const mode = JSON.parse(pack.files["probe-mode.json"]);
            assert.equal(mode.mode, "binding-index-probe");
            assert.equal(mode.clientPageRenderer, false);
            assert.equal(mode.clientSearchGraph, "full-index-footer-only");
            assert.equal(JSON.parse(pack.files["ui/_ui_defs.json"]).ui_defs.includes(
                "ui/docs_probe_common.json"), false);
        }

        const sidebar = shell.content.controls.find((control) => control.sidebar).sidebar;
        const query = sidebar.controls.find((control) => control.docs_query).docs_query;
        const text = query.controls.find((control) => control.docs_query_text).docs_query_text;
        assert.equal(query.text_control, "docs_query_text");
        assert.equal(text.property_bag["#property_field"], "#text");
        assert.equal(Object.hasOwn(text, "bindings"), false);
        const firstStep = Search("Stirling Engine", "test").controls[0].test_step_0;
        assert.equal(firstStep.bindings[0].source_control_name, query.text_control);
        const overlay = shell.root.controls.find((control) => control.overlay).overlay;
        assert.equal(overlay.type, "panel");
        assert.equal(Object.hasOwn(overlay, "button_mappings"), false);
        assert.equal(Object.hasOwn(overlay, "consume_hover_events"), false);
        assert.equal(Object.hasOwn(common.files, "ui/docs_probe_launcher.json"), false);
        assert.deepEqual((await Build("alpha", directory)).bytes, alpha.bytes);
        assert.deepEqual((await Build("beta", directory)).bytes, beta.bytes);
        assert.deepEqual((await Build("common", directory)).bytes, common.bytes);
        assert.equal(Object.hasOwn(alpha.files, "ui/docs_probe_beta.json"), false);
        assert.equal(Object.hasOwn(beta.files, "ui/docs_probe_alpha.json"), false);
        for (const pack of [ common, alpha, beta ])
        {
            const defs = JSON.parse(pack.files["ui/_ui_defs.json"]).ui_defs;
            assert.ok(defs.length > 0);
            for (const definition of defs)
            {
                assert.ok(pack.files[definition]);
            }
        }

        await Worlds(directory);
        for (const order of [ [ "alpha", "beta" ], [ "beta", "alpha" ], [ "alpha" ], [ "beta" ] ])
        {
            const worldFile = path.join(directory, `docs-probe-${order.join("-")}.mcworld`);
            const world = unzipSync(await readFile(worldFile));
            const refs = JSON.parse(Buffer.from(world["world_resource_packs.json"]).toString());
            assert.deepEqual(refs.map((ref) => ref.pack_id),
                [ ...order.map((id) => id === "alpha" ? alpha.identity.uuid : beta.identity.uuid),
                    common.identity.uuid ]);
            for (const id of order)
            {
                const file = `resource_packs/docs_probe_${id}/ui/docs_probe_${id}.json`;
                const definition = JSON.parse(Buffer.from(world[file]).toString());
                assert.equal(Object.hasOwn(definition, "entry"), false);
                assert.equal(Object.hasOwn(definition, "body"), false);
            }

            assert.deepEqual(Buffer.from(world["resource_packs/docs_probe_common/ui/docs_probe_common.json"]),
                Buffer.from(common.files["ui/docs_probe_common.json"]));
            assert.equal(Buffer.from(world["level.dat"]).readUInt32LE(4),
                world["level.dat"].length - 8);
            const level = Buffer.from(world["level.dat"]);
            const tags = new Map(topLevelTags(level).map((tag) => [ tag.name, tag ]));
            assert.equal(level.readInt32LE(tags.get("Generator").end - 4), 2);
            assert.equal(level.readInt32LE(tags.get("SpawnY").end - 4), -60);
            const layers = JSON.parse(tags.get("FlatWorldLayers").value);
            assert.equal(layers.biome_id, 1);
            assert.equal(layers.encoding_version, 6);
            assert.equal(layers.world_version, "version.post_1_18");
            assert.deepEqual(layers.block_layers, [
                { block_name: "minecraft:bedrock",
                    count: 1 },
                { block_name: "minecraft:dirt",
                    count: 2 },
                { block_name: "minecraft:grass_block",
                    count: 1 }
            ]);
        }
    }
    finally
    {
        await rm(directory, {
            force: true,
            recursive: true
        });
    }
});

test("both close controls select the launcher's closed state without consuming native cancellation", () =>
{
    const shell = Common();
    const open = shell.root.controls.find((control) => control.docs_open).docs_open;
    const close = shell.root.controls.find((control) => control.docs_close).docs_close;
    const overlay = shell.root.controls.find((control) => control.overlay).overlay;
    const inside = overlay.controls.find((control) => control.docs_close_inside).docs_close_inside;
    const visibility = overlay.bindings.find((binding) => binding.target_property_name === "#visible");
    assert.equal(visibility.source_control_name, "docs_open");
    assert.equal(visibility.source_property_name, "#toggle_state");
    assert.equal(overlay.type, "panel");
    assert.equal(Object.hasOwn(overlay, "button_mappings"), false);
    assert.equal(Object.hasOwn(overlay, "modal"), false);
    assert.notEqual(inside.focus_identifier, close.focus_identifier);

    for (const closer of [ close, inside ])
    {
        assert.equal(closer.radio_toggle_group, true);
        assert.equal(closer.toggle_name, open.toggle_name);
        assert.notEqual(closer.toggle_group_forced_index, open.toggle_group_forced_index);
        assert.equal(closer.toggle_group_forced_index, open.toggle_group_default_selected);
        for (const input of [ "button.menu_select", "button.menu_ok" ])
        {
            assert.ok(closer.button_mappings.some((mapping) => mapping.from_button_id === input));
        }

    }

    const cancel = Edit("cancel_probe").button_mappings.find((mapping) =>
        mapping.from_button_id === "button.menu_cancel");
    assert.equal(cancel.consume_event, false);
});
