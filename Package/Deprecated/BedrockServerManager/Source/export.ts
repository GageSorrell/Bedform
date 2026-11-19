/**
 * Portable installed-bundle snapshots with exclusive archive publication.
 *
 * @module bedrock-server-manager/export
 *
 * @file      export.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { Effect, FileSystem, Path } from "effect";
import { mutationPath, rejectLinks } from "./safety.js";
import { mutationSelection, serverWorlds } from "./lifecycle.js";
import type { ExistingPack } from "./installed.js";
import type { ExpansionBudget } from "./archive.js";
import type { InventoryOptions } from "./inventory.js";
import type { RuntimeContext } from "./config.js";
import { charge } from "./archive.js";
import { ingestSource } from "./source.js";
import { readRegistry } from "./registry.js";
import { resolveServer } from "./server.js";
import { scanInstalled } from "./installed.js";
import { withTransaction } from "./transaction.js";
import { zipSync } from "fflate";

/** Export requires an explicit output file; limits include nested archive expansion. */
export interface ExportOptions extends InventoryOptions
{
    readonly output: string;
}

// Known-size local headers avoid data-descriptor scanning inside nested ZIP bytes.
const encodeArchive = (files: Map<string, Uint8Array>, budget: ExpansionBudget,
    compress: boolean): Uint8Array =>
{
    if (files.size >= 65535)
    {
        throw new Error("ZIP64 export is unsupported: too many entries.");
    }
    const entries: Array<[ string, Uint8Array ]> = [];
    for (const [ name, bytes ] of files)
    {
        // fflate flattens into a plain object; this equivalent relative path avoids its prototype setter.
        entries.push([ name === "__proto__" ? "./__proto__" : name, bytes ]);
    }
    const output = zipSync(Object.fromEntries(entries), { level: compress ? 6 : 0 });
    charge(budget, output.length);
    return output;
};

const attempted = <Value>(body: () => Value) => Effect.try({
    catch: (error: unknown) => error instanceof Error ? error : new Error(String(error)), try: body
});

/** Snapshot installed files, retaining membership and manifest bytes rather than remembered sources. */
const exportAddon = (context: RuntimeContext, selector: string, options: ExportOptions,
    maxBytes: number = 1024 ** 3) => Effect.gen(function*()
{
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1024 ** 3)
    {
        return yield* Effect.fail(new Error("Export byte limit must be between 1 and 1 GiB."));
    }
    if (!BedrockString.trim(options.output))
    {
        return yield* Effect.fail(new Error("Supply an output file path."));
    }
    const server = yield* resolveServer(context, options.server);
    return yield* withTransaction(server, () => Effect.gen(function*()
    {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* mutationPath(server, path.join(server, ".bedrock-server-manager", "registry.json"));
        const registry = yield* readRegistry(server);
        const installed = yield* scanInstalled(server);
        const worlds = yield* serverWorlds(server);
        const { addon, targets } = yield* mutationSelection(context, server, options,
            registry, installed, worlds, selector);
        if (!targets.length)
        {
            return yield* Effect.fail(new Error("Bundle has no installed member packs."));
        }
        const requested = path.resolve(context.cwd, options.output);
        yield* rejectLinks(requested, true);
        if (yield* fs.exists(requested))
        {
            return yield* Effect.fail(new Error(`Output already exists: ${requested}`));
        }
        const parent = yield* fs.realPath(path.dirname(requested));
        if ((yield* fs.stat(parent)).type !== "Directory")
        {
            return yield* Effect.fail(new Error("Output parent must be an existing directory."));
        }
        const output = path.join(parent, path.basename(requested));
        const protectedRoots = [ path.join(server, ".bedrock-server-manager"),
            ...installed.map((pack: ExistingPack) => pack.location) ];
        for (const root of protectedRoots)
        {
            const relative = path.relative(yield* fs.realPath(root), output);
            if (relative === "" || (!path.isAbsolute(relative) && relative !== ".." &&
                !relative.startsWith(`..${path.sep}`)))
            {
                return yield* Effect.fail(new Error(
                    "Output cannot be inside installed packs or CLI metadata."
                ));
            }
        }
        const budget: ExpansionBudget = { limit: maxBytes, used: 0 };
        const members = new Map<string, Uint8Array>();
        for (const target of targets)
        {
            const remaining = budget.limit - budget.used;
            if (remaining < 1)
            {
                return yield* Effect.fail(new Error("Export exceeds expanded byte limit."));
            }
            const source = yield* ingestSource(context, target.location, remaining);
            const pack = source.packs[0];
            if (source.packs.length !== 1 || JSON.stringify(pack.manifest.raw) !==
                JSON.stringify(target.manifest.raw))
            {
                return yield* Effect.fail(new Error(`Installed pack changed: ${target.location}`));
            }
            const archive = yield* attempted(() =>
            {
                for (const bytes of pack.files.values()) { charge(budget, bytes.length); }
                return encodeArchive(pack.files, budget, true);
            });
            members.set(`${pack.manifest.uuid}.mcpack`, archive);
        }
        const bytes = yield* attempted(() => encodeArchive(members, { limit: maxBytes, used: 0 }, false));
        yield* Effect.scoped(Effect.gen(function*()
        {
            const stage = yield* fs.makeTempDirectoryScoped({ directory: parent, prefix: ".bds-export-" });
            const file = path.join(stage, "bundle.mcaddon");
            yield* fs.writeFile(file, bytes, { flag: "wx" });
            // A same-filesystem hard link atomically creates output, failing if a racer created it.
            yield* rejectLinks(output, true);
            yield* fs.link(file, output).pipe(Effect.mapError((error: unknown) =>
                new Error(`Cannot exclusively publish ${output}: ${String(error)}`)));
        }));
        return { id: addon.id, name: addon.name, output, packs: targets.length };
    }));
});

export { exportAddon };
