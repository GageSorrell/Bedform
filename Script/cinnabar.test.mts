/**
 * Verifies native qualification failures and preserves fork and GameTest files during mirror sync.
 *
 * @module bedform-monorepo/Script/cinnabar.test
 *
 * @file      cinnabar.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   SEE LICENSE IN License.md
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { checkCinnabar } from "./check-cinnabar.mts";
import { createHash } from "node:crypto";
import { discoverMirrors } from "./workspace-mirrors.mts";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { tmpdir } from "node:os";

const Repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("acquired source data must match its pin and stay ignored and untracked", () =>
{
    const root = fixture();
    try
    {
        const relative = "Package/Cinnabar/assets/prerequisite-fixture.bin";
        const file = path.join(root, relative);
        const bytes = Buffer.from("verified input");
        const sha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
        const inventoryFile = path.join(root, "Package/Cinnabar/Bedform/import.json");
        const inventory = JSON.parse(readFileSync(inventoryFile, "utf8")) as Inventory;
        inventory.excluded = [ { path: "assets/prerequisite-fixture.bin",
            sha } ];
        writeFileSync(inventoryFile, JSON.stringify(inventory));
        writeFileSync(file, bytes);
        writeFileSync(path.join(root, ".gitignore"), `${relative}\n`);
        assert.equal(spawnSync("git", [ "init", "--quiet" ], { cwd: root }).status, 0);
        assert.deepEqual(checkCinnabar(root), []);
        writeFileSync(file, "edited");
        assert.throws(() => checkCinnabar(root), /differs from its import pin/);
        writeFileSync(file, bytes);
        assert.equal(spawnSync("git", [ "add", "--force", "--", relative ], { cwd: root }).status, 0);
        assert.throws(() => checkCinnabar(root), /must remain untracked/);
    }
    finally
    {
        rmSync(root, { force: true,
            recursive: true });
    }
});

test("native ABI configuration requires explicit SDK inputs before linking", (context: TestContext) =>
{
    const build = mkdtempSync(path.join(tmpdir(), "bedform-native-abi-"));
    try
    {
        const result = spawnSync(process.env.CMAKE ?? "cmake", [ "-S",
            path.join(Repository, "Package/Cinnabar/Bedform/Native"), "-B", build ],
        { encoding: "utf8" });
        if (result.error !== undefined && (result.error as NodeJS.ErrnoException).code === "ENOENT")
        {
            context.skip("CMake unavailable; native ABI configuration check unrun");
            return;
        }

        assert.equal(result.error, undefined);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Native feasibility unrun/u);
        assert.match(result.stderr, /missing explicit LEVILAMINA_INCLUDE_DIRECTORY/u);
        const source = path.join(build, "source/Native");
        mkdirSync(source, { recursive: true });
        cpSync(path.join(Repository, "Package/Cinnabar/Bedform/Native/CMakeLists.txt"),
            path.join(source, "CMakeLists.txt"));
        const compatibility = readFileSync(path.join(Repository,
            "Package/Cinnabar/Bedform/compatibility.json"), "utf8");
        writeFileSync(path.join(source, "../compatibility.json"),
            compatibility.replace("\"sdkBdsVersion\": \"1.26.60.6\"", "\"sdkBdsVersion\": \"1.26.66.1\""));
        const mismatch = spawnSync(process.env.CMAKE ?? "cmake", [ "-S", source,
            "-B", path.join(build, "mismatch") ], { encoding: "utf8" });
        assert.notEqual(mismatch.status, 0);
        assert.match(mismatch.stderr, /No older BDS fallback/u);
    }
    finally
    {
        rmSync(build, { force: true,
            recursive: true });
    }
});

/**
 * A source file recorded by the import inventory.
 *
 * @category Model
 * @since 1.0.0
 */
interface ImportEntry
{
    path: string;
    sha: string;
}

/**
 * The portion of the inventory narrowed by a disposable fixture.
 *
 * @category Model
 * @since 1.0.0
 */
interface Inventory
{
    imported: Array<ImportEntry>;
    excluded: Array<ImportEntry>;
}

/**
 * Copies the compatibility contract and its source inputs into a disposable repository.
 *
 * @throws { Error } When a fixture input cannot be copied.
 *
 * @category Testing
 * @since 1.0.0
 */
function fixture(): string
{
    const root = mkdtempSync(path.join(tmpdir(), "bedform-cinnabar-"));
    mkdirSync(path.join(root, "Script"), { recursive: true });
    cpSync(path.join(Repository, "Script/bedrock-target.json"),
        path.join(root, "Script/bedrock-target.json"));
    const files = [ "Bedform/compatibility.json", "Bedform/availability.json",
        "Bedform/alignment-validation.json",
        "Bedform/LeviLamina.lip.toml",
        "Bedform/LeviLamina.xmake.lua", "assets/bedrock-target.json", "assets/vanilla-source.json",
        "assets/registry-foundation-v2225.json", "core/go.mod", "crates/protocol/Cargo.toml", "LICENSE",
        "Cargo.toml", "rust-toolchain.toml" ];
    for (const file of files)
    {
        const destination = path.join(root, "Package/Cinnabar", file);
        mkdirSync(path.dirname(destination), { recursive: true });
        cpSync(path.join(Repository, "Package/Cinnabar", file), destination);
    }

    const inventory = JSON.parse(readFileSync(path.join(Repository,
        "Package/Cinnabar/Bedform/import.json"), "utf8")) as Inventory;
    inventory.imported = inventory.imported.filter((entry: ImportEntry) => entry.path === "LICENSE");
    writeFileSync(path.join(root, "Package/Cinnabar/Bedform/import.json"), JSON.stringify(inventory));
    for (const directory of readdirSync(path.join(Repository, "Package")))
    {
        try
        {
            const source = path.join(Repository, "Package", directory, "package.json");
            const destination = path.join(root, "Package", directory, "package.json");
            mkdirSync(path.dirname(destination), { recursive: true });
            cpSync(source, destination);
        }
        catch (error)
        {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT")
            {
                throw error;
            }
        }
    }

    return root;
}

test("source metadata and the selected target pass without claiming native attachment", () =>
{
    const blockers = checkCinnabar(Repository);
    assert.deepEqual(blockers, []);
    const result = spawnSync(process.execPath,
        [ "--import", "tsx", "Script/check-cinnabar.mts" ], { cwd: Repository,
            encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
});

test("pin drift and changed upstream license fail the source gate", () =>
{
    const root = fixture();
    try
    {
        assert.deepEqual(checkCinnabar(root), []);
        const pin = path.join(root, "Package/ServerGameTest/package.json");
        const original = readFileSync(pin, "utf8");
        writeFileSync(pin, original.replaceAll("1.26.60-stable", "1.26.66-stable"));
        assert.throws(() => checkCinnabar(root), /API pin drift/u);
        writeFileSync(pin, original);
        const selected = path.join(root, "Script/bedrock-target.json");
        const originalSelected = readFileSync(selected, "utf8");
        writeFileSync(selected, originalSelected.replace("1.26.60.6", "1.26.66.1"));
        assert.throws(() => checkCinnabar(root), /Selected BDS target drift/u);
        writeFileSync(selected, originalSelected);
        const toolchain = path.join(root, "Package/Cinnabar/rust-toolchain.toml");
        const originalToolchain = readFileSync(toolchain, "utf8");
        writeFileSync(toolchain, originalToolchain.replace("1.100.0", "1.99.0"));
        assert.throws(() => checkCinnabar(root), /Rust toolchain pin drift/u);
        writeFileSync(toolchain, originalToolchain);
        writeFileSync(path.join(root, "Package/Cinnabar/LICENSE"), "Changed license");
        assert.throws(() => checkCinnabar(root), /Changed upstream notice/u);
    }
    finally
    {
        rmSync(root, { force: true,
            recursive: true });
    }
});

test("sync and publishing discovery preserve the fork and handwritten GameTest entry", () =>
{
    const root = fixture();
    try
    {
        const native = path.join(root, "Package/Cinnabar/package.json");
        const sentinel = "{\"name\":\"native-fork\",\"version\":\"0.0.0\"," +
            "\"@bedform/server-gametest\":\"keep\"}";
        writeFileSync(native, sentinel);
        assert.ok(!discoverMirrors(root).includes("Package/Cinnabar"));
        const entry = path.join(root, "Package/ServerGameTest/Source/index.ts");
        mkdirSync(path.dirname(entry), { recursive: true });
        const extension = "export * from \"@minecraft/server-gametest\";\nexport const Extension = true;\n";
        writeFileSync(entry, extension);
        mkdirSync(path.join(root, "Script"), { recursive: true });
        cpSync(path.join(Repository, "Script/sync-minecraft-mirrors.mts"),
            path.join(root, "Script/sync-minecraft-mirrors.mts"));
        cpSync(path.join(Repository, "Package/Bedform/License.md"),
            path.join(root, "Package/Bedform/License.md"));
        const pin = "1.0.0-beta.1.26.66-stable";
        const preload = `process.argv = [process.execPath, 'sync', '--channel', 'dev'];
            globalThis.fetch = async (url) => ({ ok: true, json: async () =>
            url.endsWith('/package') ? { '@minecraft/server-gametest': 'read' } :
            url.endsWith('/dist-tags') ? { beta: '${pin}' } : {} });
            await import(${JSON.stringify(pathToFileURL(path.join(root,
                "Script/sync-minecraft-mirrors.mts")).href)});`;
        const result = spawnSync(process.execPath, [ "--import", import.meta.resolve("tsx"),
            "--input-type=module", "-e", preload ],
        { cwd: root,
            encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
        assert.match(readFileSync(path.join(root, "Package/ServerGameTest/package.json"), "utf8"),
            /1\.0\.0-beta\.1\.26\.60-stable-dev\.1/u);
        assert.equal(readFileSync(entry, "utf8"), extension);
        assert.equal(readFileSync(native, "utf8"), sentinel);
        const collision = spawnSync(process.execPath, [ "--import", import.meta.resolve("tsx"),
            "--input-type=module", "-e",
            preload.replace("@minecraft/server-gametest", "@minecraft/cinnabar") ],
        { cwd: root,
            encoding: "utf8" });
        assert.equal(collision.status, 1);
        assert.match(collision.stderr, /native fork, not an @minecraft mirror/u);
        assert.equal(readFileSync(native, "utf8"), sentinel);
    }
    finally
    {
        rmSync(root, { force: true,
            recursive: true });
    }
});
