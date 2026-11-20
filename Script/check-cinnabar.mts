/**
 * Checks the vendored Cinnabar source contract and rejects unqualified native targets.
 *
 * @module bedform-monorepo/Script/check-cinnabar
 *
 * @file      check-cinnabar.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   SEE LICENSE IN License.md
 */
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * The compatibility fields checked against their owning source files.
 *
 * @category Model
 * @since 1.0.0
 */
interface Compatibility
{
    readonly schemaVersion: number;
    readonly status: string;
    readonly bedformBdsVersion: string;
    readonly apiPins: Readonly<Record<string, string>>;
    readonly upstreamCommit: string;
    readonly importedServerVersion: string;
    readonly importedGameVersion: string;
    readonly wireProtocol: number;
    readonly codecCrate: string;
    readonly codecManifestSha256: string;
    readonly protocolgenCommit: string;
    readonly goVersion: string;
    readonly goTunnelReplacement: string;
    readonly vanillaSourceManifest: string;
    readonly vanillaSourceCommit: string;
    readonly sdkVersion: string;
    readonly sdkBdsVersion: string;
    readonly loaderVersion: string;
    readonly loaderBdsDependency: string;
    readonly preLoaderVersion: string;
    readonly blockers: ReadonlyArray<string>;
}

/**
 * An upstream file identified by its Git blob hash.
 *
 * @category Model
 * @since 1.0.0
 */
interface ImportEntry
{
    readonly path: string;
    readonly sha: string;
}

/**
 * The complete imported and intentionally excluded upstream file inventory.
 *
 * @category Model
 * @since 1.0.0
 */
interface Inventory
{
    readonly commit: string;
    readonly imported: ReadonlyArray<ImportEntry>;
    readonly excluded: ReadonlyArray<ImportEntry>;
}

/**
 * Reads a repository-owned JSON contract.
 *
 * @category Decoding
 * @since 1.0.0
 */
function readJson<Value>(file: string): Value
{
    return JSON.parse(readFileSync(file, "utf8")) as Value;
}

/**
 * Verifies source pins and license preservation, returning unmet qualification gates.
 * Source consistency alone does not establish BDS, native-loader or renderer compatibility.
 *
 * @throws { Error } When recorded metadata disagrees with its source.
 *
 * @category Testing
 * @since 1.0.0
 */
export function checkCinnabar(repository: string): ReadonlyArray<string>
{
    const fork = path.join(repository, "Package/Cinnabar");
    const compatibility = readJson<Compatibility>(path.join(fork, "Bedform/compatibility.json"));
    const inventory = readJson<Inventory>(path.join(fork, "Bedform/import.json"));
    const target = readJson<Record<string, unknown>>(path.join(fork, "assets/bedrock-target.json"));
    assert.equal(compatibility.schemaVersion, 1);
    assert.equal(compatibility.upstreamCommit, inventory.commit);
    assert.match(inventory.commit, /^[a-f0-9]{40}$/u);
    assert.equal(existsSync(path.join(fork, ".git")), false, "Cinnabar must be ordinary monorepo content");
    // A native fork has no root npm manifest and is not an npm workspace.
    assert.equal(existsSync(path.join(fork, "package.json")), false);
    for (const entry of inventory.imported)
    {
        assert.ok(existsSync(path.join(fork, entry.path)), `Missing imported file: ${entry.path}`);
        if (/(?:LICENSE[^/]*|NOTICE[^/]*|THIRD_PARTY_NOTICES\.md)$/u.test(entry.path))
        {
            const bytes = readFileSync(path.join(fork, entry.path));
            const sha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
            assert.equal(sha, entry.sha, `Changed upstream notice: ${entry.path}`);
        }
    }

    for (const entry of inventory.excluded)
    {
        assert.equal(existsSync(path.join(fork, entry.path)), false, `Excluded payload: ${entry.path}`);
    }

    assert.equal(target.server_version, compatibility.importedServerVersion);
    assert.equal(target.game_version, compatibility.importedGameVersion);
    assert.equal(target.wire_protocol, compatibility.wireProtocol);
    assert.equal(target.codec_crate, compatibility.codecCrate);
    assert.equal(target.codec_manifest_sha256, compatibility.codecManifestSha256);
    assert.equal(target.protocolgen_commit, compatibility.protocolgenCommit);
    const codec = readFileSync(path.join(fork, "crates/protocol/Cargo.toml"), "utf8");
    assert.ok(codec.includes(`path = "vendor/${compatibility.codecCrate}"`));
    const core = readFileSync(path.join(fork, "core/go.mod"), "utf8");
    assert.ok(core.includes(`go ${compatibility.goVersion}\n`));
    assert.ok(core.includes(`github.com/sandertv/gophertunnel => ${compatibility.goTunnelReplacement}`));
    const vanilla = readJson<Record<string, unknown>>(path.join(fork, compatibility.vanillaSourceManifest));
    assert.equal(vanilla.commit, compatibility.vanillaSourceCommit);
    const foundation = readJson<Record<string, unknown>>(
        path.join(fork, `assets/registry-foundation-v${compatibility.wireProtocol}.json`));
    assert.equal(foundation.game_version, compatibility.importedGameVersion);
    assert.equal(foundation.protocol, compatibility.wireProtocol);

    for (const [ name, version ] of Object.entries(compatibility.apiPins))
    {
        const directory = name.slice("@minecraft/".length).split("-")
            .map((part: string) => part === "gametest" ? "GameTest" : part === "ui" ? "UI" :
                part.charAt(0).toUpperCase() + part.slice(1)).join("");
        const manifest = readJson<{ peerDependencies: Readonly<Record<string, string>> }>(
            path.join(repository, "Package", directory, "package.json"));
        assert.equal(manifest.peerDependencies[name], version, `API pin drift: ${name}`);
        const release = /beta\.(\d+\.\d+\.\d+)-stable$/u.exec(version)?.[1];
        if (release !== undefined)
        {
            assert.equal(compatibility.bedformBdsVersion.split(".").slice(0, 3).join("."), release);
        }
    }

    const loader = readFileSync(path.join(fork, "Bedform/LeviLamina.lip.toml"), "utf8");
    const sdk = readFileSync(path.join(fork, "Bedform/LeviLamina.xmake.lua"), "utf8");
    assert.ok(loader.includes(`version = "${compatibility.loaderVersion}"`));
    assert.ok(loader.includes(`"github.com/LiteLDev/bds" = "${compatibility.loaderBdsDependency}"`));
    assert.ok(loader.includes(`"github.com/LiteLDev/PreLoader" = "${compatibility.preLoaderVersion}"`));
    assert.ok(loader.includes(`"${compatibility.sdkVersion}"`));
    assert.ok(sdk.includes(`bedrockdata v${compatibility.sdkVersion}`));
    assert.equal(`1.${compatibility.sdkVersion.split("-")[0]}`, compatibility.sdkBdsVersion);
    const blockers = [ ...compatibility.blockers ];
    if (compatibility.importedServerVersion !== compatibility.bedformBdsVersion)
    {
        blockers.push(`Codec/assets: ${compatibility.importedServerVersion} != ` +
            compatibility.bedformBdsVersion);
    }

    if (compatibility.sdkBdsVersion !== compatibility.bedformBdsVersion)
    {
        blockers.push(`Native SDK: ${compatibility.sdkBdsVersion} != ${compatibility.bedformBdsVersion}`);
    }

    assert.equal(compatibility.status, blockers.length === 0 ? "qualified" : "blocked");
    return blockers;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
    const argv = process.argv.slice(2);
    assert.ok(argv.every((argument: string) => argument === "--source-only"),
        "Usage: check-cinnabar.mts [--source-only]");
    const blockers = checkCinnabar(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
    console.log("Cinnabar source/provenance checks passed.");
    if (blockers.length > 0)
    {
        console.error(`Native target qualification remains blocked:\n- ${blockers.join("\n- ")}`);
        if (!argv.includes("--source-only"))
        {
            process.exitCode = 1;
        }
    }
}
