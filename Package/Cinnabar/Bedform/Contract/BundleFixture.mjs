// A complete, machine-free bundle and the bytes a setup test can stage and measure.
import { createHash } from "node:crypto";
import { Version } from "./Model.mjs";

export const digest = bytes => createHash("sha256").update(bytes).digest("hex");

export function bundleFixture(compatibility, upstreamCommit) {
    const contents = new Map();
    const files = Object.entries({
        "cinnabar.exe": "client", "cinnabar-mcp.exe": "mcp", "bedrock-core.exe": "core",
        "bin/ffmpeg.exe": "helper", "assets/vanilla.mcbe": "asset", "bridge/BedformNativeBridge.dll": "bridge",
        "bridge/LeviLamina.dll": "loader", "licenses/Cinnabar.txt": "license"
    }).map(([path, role]) => {
        const bytes = Buffer.from(`fixture contents for ${path}\n`);
        contents.set(path, bytes);
        return { path, role, bytes: bytes.length, sha256: digest(bytes) };
    });
    const manifest = { v: Version, owner: "Bedform.Cinnabar", bundleId: "fixture-bundle", compatibility,
        provenance: { sourceSha256: digest("fixture source\n"), pinsSha256: digest("fixture pins\n"), upstreamCommit,
            tools: [{ name: "fixture tool", version: "1" }] }, files };
    return { contents, manifest, provisioned: files.filter(({ role }) => role === "bridge" || role === "loader") };
}
