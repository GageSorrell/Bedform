#!/usr/bin/env node
/**
 * Public exports for bedrock-server-manager.
 *
 * @module bedrock-server-manager/index
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Argument, Command, Flag } from "effect/cli";
import { Console, Effect, Option } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { readSettings, validateKey, writeSetting } from "./config.js";
import { addonCommand } from "./addon-cli.js";
import { homedir } from "node:os";

const context = { cwd: process.cwd(), env: process.env, home: homedir(), platform: process.platform };
const get = Command.make("get", { key: Argument.String("key").pipe(Argument.optional) },
    ({ key }: { key: Option.Option<string> }) =>
        Effect.gen(function*()
        {
            const selected = Option.getOrUndefined(key);
            if (selected !== undefined)
            {
                yield* validateKey(selected);
            }
            const settings = yield* readSettings(context);
            yield* Console.log(selected === undefined
                ? JSON.stringify(settings, null, 2)
                : (settings.server?.path ?? "null"));
        })).pipe(Command.withDescription("Read server.path, or all settings as JSON."));

const set = Command.make("set", {
    key: Argument.String("key"),
    unset: Flag.Boolean("unset").pipe(Flag.withDefault(false)),
    value: Argument.String("value").pipe(Argument.optional)
}, ({ key, unset, value }: { key: string; unset: boolean; value: Option.Option<string> }) =>
    Effect.gen(function*()
    {
        const supplied = Option.getOrUndefined(value);
        if ((unset && supplied !== undefined) || (!unset && supplied === undefined))
        {
            return yield* Effect.fail(new Error("Supply either <value> or --unset, exclusively."));
        }
        yield* writeSetting(context, key, supplied);
    })).pipe(Command.withDescription("Persist server.path, or remove it with --unset."));

const config = Command.make("config").pipe(
    Command.withDescription("Read and write user configuration; no server is required."),
    Command.withSubcommands([ get, set ])
);
const command = Command.make("bds").pipe(
    Command.withDescription("BedrockServerManager: configure and inspect Bedrock Dedicated Server addons."),
    Command.withSubcommands([ config, addonCommand(context) ])
);

Command.run(command, { version: "0.1.0" }).pipe(
    Effect.provide(NodeServices.layer),
    NodeRuntime.runMain
);
