import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const Root = fileURLToPath(new URL("../", import.meta.url));
await build({
    absWorkingDir: Root,
    entryPoints: ["Source/Main.js"],
    outfile: "behavior_packs/ddui_image_demo/scripts/Main.js",
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    external: ["@minecraft/server", "@minecraft/server-ui"],
    nodePaths: [path.resolve(Root, "../../Package/Bedform/node_modules")]
});
