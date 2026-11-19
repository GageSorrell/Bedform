/**
 * Inventory commands and their human-readable and JSON representations.
 *
 * @module bedrock-server-manager/addon-cli
 *
 * @file      addon-cli.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import type { Addon, Diagnostic, InstalledPack, Scope } from "./inventory.js";
import { Argument, Command, Flag } from "effect/cli";
import { Console, Effect, Option } from "effect";
import { discoverInventory, scopedAddons, selectAddon } from "./inventory.js";
import { removeAddon, updateAddon } from "./lifecycle.js";
import type { InstallOptions } from "./install.js";
import type { RuntimeContext } from "./config.js";
import { changeActivation } from "./activation.js";
import { exportAddon } from "./export.js";
import { installAddon } from "./install.js";
import { versionText } from "./manifest.js";

interface ReadFlags
{
    readonly server: Option.Option<string>;
    readonly world: Option.Option<string>;
    readonly scope: Option.Option<Scope>;
    readonly json: boolean;
}
const flags = Object.freeze({
    json: Flag.Boolean("json").pipe(Flag.withDefault(false)),
    scope: Flag.Literals("scope", [ "shared", "world" ]).pipe(Flag.optional),
    server: Flag.String("server").pipe(Flag.withAlias("s"), Flag.optional),
    world: Flag.String("world").pipe(Flag.withAlias("w"), Flag.optional)
});
const options = (input: ReadFlags) => ({
    scope: Option.getOrUndefined(input.scope), server: Option.getOrUndefined(input.server),
    world: Option.getOrUndefined(input.world)
});

const packText = (pack: InstalledPack): string =>
    `  ${pack.identity?.uuid ?? "invalid identity"} @ ` +
    `${pack.identity ? versionText(pack.identity.version) : "unknown version"} ` +
    `[${pack.scope}/${pack.kind}; ${pack.activation}]\n    ${pack.location}`;
const addonText = (addon: Addon): string =>
    `${addon.id}  ${addon.name}${addon.registered ? "" : " (unregistered)"}\n` +
    (addon.members.map(packText).join("\n") || "  No registered members are present.");
const diagnosticText = (diagnostic: Diagnostic): string =>
    `${BedrockString.toUpperCase(diagnostic.severity)} ${diagnostic.code}: ${diagnostic.message}\n` +
    `  ${diagnostic.location}`;

/** Build commands around explicit runtime inputs; help never resolves a server. */
const addonCommand = (context: RuntimeContext) =>
{
    const mutationFlags = { addon: Argument.String("addon"),
        scope: flags.scope, server: flags.server, world: flags.world };
    const portable = Command.make("export", { ...mutationFlags, output: Flag.String("output") },
        (input: Omit<ReadFlags, "json"> & { addon: string; output: string }) => Effect.gen(function*()
        {
            const result = yield* exportAddon(context, input.addon, {
                ...options({ ...input, json: false }), output: input.output
            });
            yield* Console.log(`Exported ${result.name} (${result.id}) to ${result.output}.`);
        })).pipe(Command.withDescription("Export installed member packs to a new portable .mcaddon file."));
    const update = Command.make("update", {
        ...mutationFlags, source: Flag.String("source").pipe(Flag.optional)
    }, (input: Omit<ReadFlags, "json"> & { addon: string; source: Option.Option<string> }) =>
        Effect.gen(function*()
        {
            const result = yield* updateAddon(context, input.addon, {
                ...options({ ...input, json: false }), source: Option.getOrUndefined(input.source)
            });
            yield* Console.log(`Updated ${result.name} (${result.id}).`);
            for (const requirement of result.requirements)
            {
                yield* Console.log(`Scripting API requirement: ${requirement}`);
            }
        })).pipe(Command.withDescription("Update from the remembered source or --source <path>."));
    const remove = Command.make("remove", mutationFlags,
        (input: Omit<ReadFlags, "json"> & { addon: string }) => Effect.gen(function*()
        {
            const result = yield* removeAddon(context, input.addon, options({ ...input, json: false }));
            yield* Console.log(`Removed ${result.name} (${result.id}).`);
        })).pipe(Command.withAlias("rm"), Command.withDescription("Remove a bundle across affected worlds."));
    const install = Command.make("install", {
        enable: Flag.Boolean("enable").pipe(Flag.withDefault(true)),
        scope: flags.scope, server: flags.server, source: Argument.String("source"), world: flags.world
    }, (input: Omit<ReadFlags, "json"> & { enable: boolean; source: string }) => Effect.gen(function*()
    {
        const selection: InstallOptions = { ...options({ ...input, json: false }), enable: input.enable };
        const installed = yield* installAddon(context, input.source, selection);
        yield* Console.log(`Installed ${installed.name} (${installed.id}); ` +
            `${installed.packs.length} pack(s).`);
        for (const requirement of installed.requirements)
        {
            yield* Console.log(`Scripting API requirement: ${requirement}`);
        }
    })).pipe(Command.withDescription("Install a folder/archive; enable by default or use --no-enable."));
    const activation = (name: "enable" | "disable") => Command.make(name, {
        addon: Argument.String("addon"), scope: flags.scope, server: flags.server, world: flags.world
    }, (input: Omit<ReadFlags, "json"> & { addon: string }) => Effect.gen(function*()
    {
        const result = yield* changeActivation(context, input.addon,
            options({ ...input, json: false }), name === "enable");
        yield* Console.log(`${name === "enable" ? "Enabled" : "Disabled"} ${result.name} (${result.id}).`);
        for (const requirement of result.requirements)
        {
            yield* Console.log(`Scripting API requirement: ${requirement}`);
        }
    }));
    const list = Command.make("list", flags, (input: ReadFlags) => Effect.gen(function*()
    {
        const selected = options(input);
        const inventory = yield* discoverInventory(context, selected);
        const addons = scopedAddons(inventory, selected.scope);
        yield* Console.log(input.json ? JSON.stringify({ ...inventory, addons }, null, 2)
            : [ `World: ${inventory.world.name}`, addons.length ? addons.map(addonText).join("\n")
                : "No installed addons.", ...inventory.diagnostics.map(diagnosticText) ].join("\n"));
    })).pipe(Command.withAlias("ls"),
        Command.withDescription("List bundles, versions, locations and activation."));

    const show = Command.make("show", { ...flags, addon: Argument.String("addon") },
        (input: ReadFlags & { addon: string }) => Effect.gen(function*()
        {
            const selected = options(input);
            const inventory = yield* discoverInventory(context, selected);
            const addon = yield* selectAddon(inventory, input.addon, selected.scope);
            const locations = new Set(addon.members.map((pack: InstalledPack) => pack.location));
            const diagnostics = inventory.diagnostics.filter((item: Diagnostic) =>
                locations.has(item.location) || (item.code === "missing-registered-pack" &&
                    item.message.startsWith(`Bundle ${addon.id} `)));
            yield* Console.log(input.json ? JSON.stringify({ ...addon, diagnostics }, null, 2)
                : [ addonText(addon), `Source: ${addon.source ?? "not recorded"}`,
                    ...addon.members.map((pack: InstalledPack) =>
                        `Manifest (${pack.location}):\n${JSON.stringify(pack.manifest, null, 2)}`),
                    ...diagnostics.map(diagnosticText) ].join("\n"));
        })).pipe(Command.withDescription("Show membership, manifests, dependencies and remembered source."));

    const validate = Command.make("validate", {
        ...flags, addon: Argument.String("addon").pipe(Argument.optional)
    }, (input: ReadFlags & { addon: Option.Option<string> }) => Effect.gen(function*()
    {
        const selected = options(input);
        const inventory = yield* discoverInventory(context, selected);
        const selector = Option.getOrUndefined(input.addon);
        const addons = selector === undefined ? scopedAddons(inventory, selected.scope)
            : [ yield* selectAddon(inventory, selector, selected.scope) ];
        const locations = new Set(addons.flatMap((addon: Addon) => [
            ...addon.members.map((pack: InstalledPack) => pack.location)
        ]));
        const diagnostics = selector === undefined && selected.scope === undefined
            ? inventory.diagnostics : inventory.diagnostics.filter((item: Diagnostic) =>
                locations.has(item.location) || item.location === inventory.world.directory ||
                item.code === "invalid-activation-file" || item.code === "unreadable-pack-root" ||
                (item.code === "missing-registered-pack" && addons.some((addon: Addon) =>
                    item.message.startsWith(`Bundle ${addon.id} `))));
        const valid = !diagnostics.some((item: Diagnostic) => item.severity === "error");
        const report = { addonIds: addons.map((addon: Addon) => addon.id), diagnostics,
            server: inventory.server, valid, world: inventory.world };
        yield* Console.log(input.json ? JSON.stringify(report, null, 2)
            : [ `Validation ${valid ? "passed" : "failed"} for ${addons.length} addon(s).`,
                ...diagnostics.map(diagnosticText) ].join("\n"));
        // Keep stdout as exactly one JSON document on validation failures.
        if (!valid)
        {
            yield* Effect.sync(() => { process.exitCode = 1; });
        }
    })).pipe(Command.withDescription("Validate manifests, dependencies, scripts and world state."));

    return Command.make("addon").pipe(
        Command.withDescription("Inspect installed shared and selected-world addons."),
        Command.withSubcommands([
            install, list, show, validate, activation("enable"), activation("disable"),
            update, remove, portable
        ])
    );
};

export { addonCommand };
