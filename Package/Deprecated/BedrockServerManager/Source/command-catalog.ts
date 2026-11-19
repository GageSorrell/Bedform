/**
 * Offline command hints; availability and complete overloads remain the server's responsibility.
 *
 * @module bedrock-server-manager/command-catalog
 *
 * @file      command-catalog.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

const reference = "https://learn.microsoft.com/en-us/minecraft/creator/commands/commands";
/** Sources checked without launching BDS; usage hints intentionally abbreviate complex overloads. */
const catalogProvenance = Object.freeze({
    checkedOn: "2026-10-26",
    reference: `${reference}?view=minecraft-bedrock-stable`,
    selectors: "https://learn.microsoft.com/en-us/minecraft/creator/documents/targetselectors" +
        "?view=minecraft-bedrock-stable",
    shipped: { file: "bedrock_server_how_to.html", serverVersion: "1.26.52.3",
        sha256: "a3559a8ce6ebe10089a3b6715c9537b00d327d083770f45a306eab52e248dac6" }
});

/** Compact hints are advisory, not a grammar or an assertion of runtime permissions/features. */
interface CommandEntry
{
    name: string;
    aliases: ReadonlyArray<string>;
    description: string;
    usage: string;
    source: string;
}

/** Canonical name, original hint description, abbreviated arguments, then verified aliases. */
type CatalogRow = [string, string, string, ...Array<string>];
const rows: ReadonlyArray<CatalogRow> = Object.freeze([
    [ "aimassist", "Aim assistance", "<arguments…>" ],
    [ "allowlist", "Manage admission rules", "<add|remove|list|on|off|reload> [name]", "whitelist" ],
    [ "camera", "Camera perspective", "<players> <arguments…>" ],
    [ "camerashake", "Camera vibration", "<add|stop> <players> [arguments…]" ],
    [ "changesetting", "Change a live server setting", "<allow-cheats|difficulty> <value>" ],
    [ "clear", "Inventory clearing", "[player] [item] [data] [maxCount]" ],
    [ "clearspawnpoint", "Spawn reset", "[player]" ],
    [ "clone", "Region copying", "<begin> <end> <destination> [arguments…]" ],
    [ "controlscheme", "Input scheme", "<arguments…>" ],
    [ "damage", "Entity injury", "<target> <amount> [cause] [arguments…]" ],
    [ "daylock", "Daylight locking", "[true|false]", "alwaysday" ],
    [ "deop", "Remove operator access", "<player>" ],
    [ "dialogue", "NPC conversation", "<open|change> <npc> <player> [scene]" ],
    [ "difficulty", "World challenge", "[peaceful|easy|normal|hard|0|1|2|3]" ],
    [ "effect", "Status changes", "<target> <effect|clear> [arguments…]" ],
    [ "enchant", "Item enchantment", "<player> <enchantment> [level]" ],
    [ "event", "Entity triggers", "entity <target> <event>" ],
    [ "execute", "Execution context", "<subcommand> <arguments…>" ],
    [ "fill", "Block filling", "<from> <to> <block> [arguments…]" ],
    [ "fog", "Fog configuration", "<player> <push|pop|remove> <arguments…>" ],
    [ "function", "Function execution", "<name>" ],
    [ "gamemode", "Player mode", "<mode> [player]" ],
    [ "gamerule", "World rules", "[rule] [value]" ],
    [ "gametest", "Test framework", "<arguments…>" ],
    [ "give", "Item delivery", "<player> <item> [amount] [arguments…]" ],
    [ "help", "Command guidance", "[command|page]", "?" ],
    [ "hud", "Display visibility", "<player> <hide|reset> [element]" ],
    [ "inputpermission", "Input permissions", "<query|set> <player> <permission> [state]" ],
    [ "kick", "Disconnect a player", "<player name or xuid> <reason>" ],
    [ "kill", "Entity removal", "[target]" ],
    [ "list", "Connected players", "" ],
    [ "locate", "Location search", "<biome|structure> <name> [arguments…]" ],
    [ "loot", "Loot distribution", "<arguments…>" ],
    [ "me", "Personal announcement", "<message>" ],
    [ "mobevent", "Mob events", "<event> [true|false]" ],
    [ "music", "Music playback", "<arguments…>" ],
    [ "op", "Grant operator access", "<player>" ],
    [ "packstack", "Pack ordering", "<arguments…>" ],
    [ "particle", "Particle effects", "<effect> [position]" ],
    [ "permission", "Manage operator permissions", "<list|reload>", "ops" ],
    [ "place", "World placement", "<arguments…>" ],
    [ "playanimation", "Animation playback", "<target> <animation> [arguments…]" ],
    [ "playsound", "Audio playback", "<sound> [player] [arguments…]" ],
    [ "project", "Editor projects", "<arguments…>" ],
    [ "recipe", "Crafting unlocks", "<give|take> <player> <recipe>" ],
    [ "reload", "Pack refreshing", "" ],
    [ "reloadconfig", "Configuration refreshing", "" ],
    [ "reloadpacketlimitconfig", "Packet limits", "" ],
    [ "replaceitem", "Inventory replacement", "<arguments…>" ],
    [ "ride", "Entity mounting", "<target> <arguments…>" ],
    [ "save", "Coordinate world backups", "<hold|resume|query>" ],
    [ "say", "Public announcement", "<message>" ],
    [ "schedule", "Deferred execution", "<arguments…>" ],
    [ "scoreboard", "Score management", "<objectives|players> <arguments…>" ],
    [ "script", "Script debugging", "<arguments…>" ],
    [ "scriptevent", "Script messaging", "<id> <message>" ],
    [ "sendshowstoreoffer", "Marketplace navigation", "<arguments…>" ],
    [ "serveridentity", "Manage the server identity key", "<save|delete|status>" ],
    [ "setblock", "Block replacement", "<position> <block> [arguments…]" ],
    [ "setmaxplayers", "Player capacity", "<maximum>" ],
    [ "setworldspawn", "World spawning", "[position]" ],
    [ "spawnpoint", "Player spawning", "[player] [position]" ],
    [ "spreadplayers", "Random relocation", "<x> <z> <distance> <range> <target>" ],
    [ "stop", "Save and stop the server", "" ],
    [ "stopsound", "Audio silencing", "<player> [sound]" ],
    [ "structure", "Structure storage", "<save|load|delete> <arguments…>" ],
    [ "summon", "Entity creation", "<entity> [arguments…]" ],
    [ "tag", "Entity labels", "<target> <add|remove|list> [name]" ],
    [ "teleport", "Entity relocation", "<target|destination> [arguments…]", "tp" ],
    [ "tell", "Private messaging", "<player> <message>", "w", "msg" ],
    [ "tellraw", "JSON messaging", "<player> <json>" ],
    [ "testfor", "Entity counting", "<target>" ],
    [ "testforblock", "Block inspection", "<position> <block> [arguments…]" ],
    [ "testforblocks", "Region comparison", "<begin> <end> <destination> [mode]" ],
    [ "tickingarea", "Loaded regions", "<arguments…>" ],
    [ "time", "World clock", "<add|set|query> <value>" ],
    [ "title", "Screen text", "<player> <arguments…>" ],
    [ "titleraw", "JSON titles", "<player> <arguments…>" ],
    [ "toggledownfall", "Weather toggle", "" ],
    [ "transfer", "Server transfer", "<arguments…>" ],
    [ "weather", "Weather control", "<clear|rain|thunder|query> [duration]" ],
    [ "wsserver", "WebSocket connection", "<URI>", "connect" ],
    [ "xp", "Player experience", "<amount> [player]" ]
]);

const shippedNames = new Set([ "changesetting", "serveridentity", "save", "stop", "op", "deop", "kick" ]);
const commandCatalog: ReadonlyArray<CommandEntry> = rows.map((row: CatalogRow) =>
{
    const [ name, description, argumentsHint, ...aliases ] = row;
    return { aliases, description, name,
        source: shippedNames.has(name) ? "bedrock_server_how_to.html#commands"
            : `${reference}/${name}?view=minecraft-bedrock-stable`,
        usage: `${name}${argumentsHint ? ` ${argumentsHint}` : ""}` };
});

/** Rules/enums from the linked gamerule reference, not Java-only gamerules. */
const booleanRules = ("commandblockoutput commandblocksenabled dodaylightcycle doentitydrops dofiretick " +
    "doimmediaterespawn doinsomnia dolimitedcrafting domobloot domobspawning dotiledrops doweathercycle " +
    "drowningdamage falldamage firedamage freezedamage keepinventory mobgriefing naturalregeneration pvp " +
    "recipesunlock respawnblocksexplode sendcommandfeedback showbordereffect showcoordinates " +
    "showdaysplayed showdeathmessages showrecipemessages showtags tntexplodes tntexplosiondropdecay " +
    "projectilescanbreakblocks")
    .split(" ");
const integerRules = ("maxcommandchainlength randomtickspeed functioncommandlimit spawnradius " +
    "playerssleepingpercentage").split(" ");

/** Documented static enum/selector hint, before a replacement range is assigned. */
interface ArgumentHint { value: string; description: string }
const hints = (values: string, description: string): Array<ArgumentHint> => values.split(" ")
    .map((value: string) => ({ description: `${description}: ${value}`, value }));
const selectors: ReadonlyArray<ArgumentHint> = Object.freeze([
    { description: "All players", value: "@a" }, { description: "All entities", value: "@e" },
    { description: "NPC interaction player (NPC context)", value: "@initiator" },
    { description: "Nearest player (position context)", value: "@p" },
    { description: "Random player", value: "@r" },
    { description: "Executing entity (entity context)", value: "@s" }
]);
const difficulties = hints("peaceful easy normal hard p e n h 0 1 2 3", "Difficulty");
const booleans = hints("true false", "Boolean");
const firstTarget = new Set([ "camera", "clear", "clearspawnpoint", "damage", "effect", "enchant",
    "fog", "give", "hud", "kill", "playanimation", "ride", "spawnpoint", "stopsound", "tag",
    "teleport", "tell", "tellraw", "testfor", "title", "titleraw" ]);

/** Only recognized positions are completed; arbitrary remaining arguments are untouched. */
const argumentHints = (name: string, args: ReadonlyArray<string>, index: number): ReadonlyArray<ArgumentHint> =>
{
    const first = args[0]?.toLowerCase();
    if (index === 0)
    {
        switch (name)
        {
            case "allowlist": return hints("add remove list on off reload", "Admission action");
            case "permission": return hints("list reload", "Permission action");
            case "save": return [
                { description: "Prepare world files for backup", value: "hold" },
                { description: "Resume normal world saving", value: "resume" },
                { description: "Check backup readiness", value: "query" }
            ];
            case "serveridentity": return hints("save delete status", "Identity action");
            case "changesetting": return hints("allow-cheats difficulty", "Live setting");
            case "difficulty": return difficulties;
            case "gamemode": return hints("survival creative adventure spectator default s c a d", "Mode");
            case "time": return hints("add set query", "Clock action");
            case "weather": return [
                { description: "Clear precipitation", value: "clear" },
                { description: "Rain or snow", value: "rain" },
                { description: "Thunderstorm", value: "thunder" },
                { description: "Report current weather", value: "query" }
            ];
            case "daylock": return booleans;
            case "gamerule": return [ ...hints(booleanRules.join(" "), "Boolean rule"),
                ...hints(integerRules.join(" "), "Integer rule"),
                { description: "Waypoint visibility rule", value: "playerwaypoints" } ];
            case "help": return commandCatalog.flatMap((entry: CommandEntry) =>
                [ entry.name, ...entry.aliases ].map((value: string) =>
                    ({ description: entry.description, value })));
        }
    }
    if (index === 1)
    {
        if (name === "changesetting" && first === "difficulty")
        {
            return difficulties;
        }
        if (name === "changesetting" && first === "allow-cheats")
        {
            return booleans;
        }
        if (name === "time" && first === "set")
        {
            return hints("day sunrise noon sunset night midnight", "Time");
        }
        if (name === "time" && first === "query")
        {
            return hints("daytime gametime day", "Clock query");
        }
        if (name === "gamerule" && booleanRules.includes(first))
        {
            return booleans;
        }
        if (name === "gamerule" && first === "playerwaypoints")
        {
            return hints("everyone off", "Visibility");
        }
        if (name === "teleport" && first && !/^[\d+~^-]/.test(first))
        {
            return selectors;
        }
    }
    if ((index === 0 && firstTarget.has(name)) ||
        (index === 1 && [ "gamemode", "playsound", "xp" ].includes(name)))
    {
        return selectors;
    }
    return [];
};

export { argumentHints, catalogProvenance, commandCatalog };
export type { ArgumentHint, CommandEntry };
