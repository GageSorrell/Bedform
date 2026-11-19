/** @file cli.mts Create an isolated demonstration without starting its server. */

import { type DemonstrationOptions, createDemonstration } from "./create.mts";
import { readFile } from "node:fs/promises";

const options: Partial<DemonstrationOptions> = { behaviorPacks: [],
    resourcePacks: [] };
const fields = {
    "--addon": "addon",
    "--bds": "bds",
    "--description": "description",
    "--descriptor": "descriptor",
    "--instructions": "instructions",
    "--name": "name",
    "--output": "output",
    "--port": "port",
    "--portv6": "portV6",
    "--ready-marker": "readyMarker",
    "--world": "world"
} as const;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2)
{
    const flag = args[i];
    const value = args[i + 1];
    if (!value || value.startsWith("--"))
    {
        throw new Error(`Missing value for ${flag}`);
    }

    if (flag === "--behavior-pack" || flag === "--resource-pack")
    {
        const key = flag === "--behavior-pack" ? "behaviorPacks" : "resourcePacks";
        options[key] = [ ...options[key]!, value ];
    }
    else if (flag === "--config")
    {
        options.config = JSON.parse(await readFile(value, "utf8"));
    }
    else if (flag in fields)
    {
        const key = fields[flag as keyof typeof fields];
        Object.assign(options, { [key]: key === "port" || key === "portV6" ? Number(value) : value });
    }
    else
    {
        throw new Error(`Unknown argument ${flag}`);
    }
}

await createDemonstration(options as DemonstrationOptions);
