/**
 * Independently packages one feasibility contribution, or the shared experimental shell.
 *
 * @module @sorrell/documentation-probe/Tool/Build
 *
 * @file      Build.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { Common, CommonIdentity, Contribution, Label, Namespace, View } from "./Controls.mjs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { strToU8, zipSync } from "fflate";
import { createHash } from "node:crypto";
import path from "node:path";

/**
 * Absolute root of the isolated feasibility add-on.
 *
 * @category Constant
 * @since 1.0.12
 */
export const Root = fileURLToPath(new URL("../", import.meta.url));

/**
 * Manifest version shared by all artifacts in the current client-test iteration.
 *
 * @category Constant
 * @since 1.0.12
 */
export const Version = JSON.parse(await readFile(path.join(Root, "package.json"), "utf8"))
    .version.split(".").map(Number);

/**
 * Fixed archive timestamp for reproducible fixture packages.
 *
 * @category Constant
 * @since 1.0.12
 */
export const Stamp = new Date("2026-01-01T00:00:00Z");

/**
 * Serializes fixture JSON with a trailing newline.
 *
 * @category Serialization
 * @since 1.0.12
 */
export const Json = (value) => JSON.stringify(value, null, 2) + "\n";

/**
 * Builds one independently packaged probe without reading other contributions.
 *
 * @category Serialization
 * @since 1.0.12
 */
export async function Build(id, directory = path.join(Root, "dist"))
{
    if (![ "common", "alpha", "beta" ].includes(id))
    {
        throw new Error("Pass common, alpha or beta.");
    }

    const files = {

    };
    let identity;
    let name;
    let steps = 0;
    if (id === "common")
    {
        identity = CommonIdentity;
        name = "Documentation probe — shared shell";
        files["ui/docs_probe_common.json"] = Json(Common());
        files["ui/inventory_screen.json"] = Json({
            namespace: "crafting",
            recipe_inventory_screen_content: {
                modifications: [ {
                    array_name: "controls",
                    operation: "insert_back",
                    value: [ {
                        [`docs_probe@${Namespace}.root`]: {

                        }
                    } ]
                } ]
            },
            "recipe_inventory_screen_content/content_stack_panel": {
                bindings: [ View("docs_open", "(not #toggle_state)") ]
            }
        });
        files["ui/hud_screen.json"] = Json({
            hud_content: { modifications: [ {
                array_name: "controls",
                operation: "insert_back",
                value: [ { docs_probe_loaded: {
                    ...Label(`DOCS PROBE ${Version.join(".")}`, 16),
                    anchor_from: "bottom_left",
                    anchor_to: "bottom_left",
                    layer: 100,
                    size: [ 150, 16 ]
                } } ]
            } ] },
            namespace: "hud"
        });
    }
    else
    {
        // Deliberately reads ONLY this contribution's source file.
        const fixture = JSON.parse(await readFile(path.join(Root, "Fixture", `${id}.json`), "utf8"));
        identity = fixture;
        name = `Documentation probe — ${fixture.name}`;
        const contribution = Contribution(fixture);
        files["ui/docs_probe_common.json"] = Json(contribution.sharedRegistration);
        files[`ui/docs_probe_${id}.json`] = Json(contribution.definitions);
        files["probe-index.json"] = Json({
            body: fixture.page.body,
            heading: fixture.page.heading,
            index: contribution.index,
            probeIndex: contribution.probeIndex,
            route: fixture.route,
            title: fixture.page.title
        });
        steps = contribution.searchSteps;
    }

    files["probe-mode.json"] = Json({
        clientPageRenderer: false,
        clientSearchGraph: "full-index-footer-only",
        mode: "binding-index-probe",
        reason: "Direct native query-scope and string-operator probes; page graph stays disabled.",
        stateRepresentation: "native-label-text"
    });

    files["manifest.json"] = Json({
        format_version: 2,
        header: {
            description: "Experimental 9a8v.1 client mechanisms; not production BedformCommon.",
            min_engine_version: [ 1, 26, 0 ],
            name,
            uuid: identity.uuid,
            version: Version
        },
        modules: [ {
            type: "resources",
            uuid: identity.moduleUuid,
            version: Version
        } ]
    });
    files["ui/_ui_defs.json"] = Json({
        ui_defs: Object.keys(files).filter((key) => key.startsWith("ui/") &&
            key !== "ui/inventory_screen.json" && key !== "ui/hud_screen.json" &&
            (id === "common" || key !== "ui/docs_probe_common.json"))
    });
    const sorted = Object.entries(files).sort(([ left ], [ right ]) => left.localeCompare(right));
    const entries = Object.fromEntries(sorted
        .map(([ key, value ]) => [ key, [ strToU8(value), {
            mtime: Stamp
        } ] ]));
    const bytes = zipSync(entries);
    await mkdir(directory, {
        recursive: true
    });
    await writeFile(path.join(directory, `docs-probe-${id}.mcpack`), bytes);
    await writeFile(path.join(directory, `docs-probe-${id}.metrics.json`), Json({
        bytes: bytes.length,
        files: Object.keys(files).length,
        id,
        searchSteps: steps,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        uncompressedBytes: Object.values(files).reduce((sum, text) => sum + Buffer.byteLength(text), 0)
    }));
    return {
        bytes,
        files,
        identity
    };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    const id = process.argv[2];
    await Build(id);
    console.log(`Built independent ${id} pack.`);
}
