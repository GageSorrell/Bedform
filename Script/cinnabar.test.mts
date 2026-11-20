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
import { discoverMirrors } from "./workspace-mirrors.mts";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { tmpdir } from "node:os";

const Repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("native ABI configuration rejects an unqualified tuple before linking", (context: TestContext) =>
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
        assert.match(result.stderr, /No older BDS fallback/u);
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
    const files = [ "Bedform/compatibility.json", "Bedform/LeviLamina.lip.toml",
        "Bedform/LeviLamina.xmake.lua", "assets/bedrock-target.json", "assets/vanilla-source.json",
        "assets/registry-foundation-v2225.json", "core/go.mod", "crates/protocol/Cargo.toml", "LICENSE" ];
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

test("source metadata passes while exact-target qualification stays blocked", () =>
{
    const blockers = checkCinnabar(Repository);
    assert.ok(blockers.some((message: string) => message.startsWith("Codec/assets:")));
    assert.ok(blockers.some((message: string) => message.startsWith("Native SDK:")));
    const result = spawnSync(process.execPath,
        [ "--import", "tsx", "Script/check-cinnabar.mts" ], { cwd: Repository,
            encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Native target qualification remains blocked/u);
});

test("pin drift and changed upstream license fail the source gate", () =>
{
    const root = fixture();
    try
    {
        assert.ok(checkCinnabar(root).length > 0);
        const pin = path.join(root, "Package/ServerGameTest/package.json");
        const original = readFileSync(pin, "utf8");
        writeFileSync(pin, original.replaceAll("1.26.66-stable", "1.26.60-stable"));
        assert.throws(() => checkCinnabar(root), /API pin drift/u);
        writeFileSync(pin, original);
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
