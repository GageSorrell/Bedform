/**
 * Random string names drawn from Minecraft vocabulary.
 *
 * @module bedform/Utility/Name
 *
 * @file      Name.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Options for selecting and joining the words in a name.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Config
{
    /**
     * Vocabulary to sample with replacement; defaults to Dictionary for Make,
     * or DictionaryFast for MakeFast.
     *
     * @category Configuration
     * @since 1.0.0
     */
    readonly Dictionary?: ReadonlyArray<string>;

    /**
     * Nonnegative safe integer word count; defaults to three. Zero produces an empty name.
     *
     * @category Configuration
     * @since 1.0.0
     */
    readonly NumWords?: number;

    /**
     * Delimiter inserted between words; defaults to a hyphen.
     *
     * @category Configuration
     * @since 1.0.0
     */
    readonly Separator?: string;
}

/**
 * Frozen, sorted vocabulary collected from vanilla BDS 1.26.63.1 on November 12, 2026.
 * Sources were 1,480 blocks, 1,623 items, 129 entities, 39 effects, 42 enchantments,
 * and three dimensions, queried through their Script API registries.
 * Namespace prefixes and numeric suffixes were removed; identifier components were
 * lowercased, deduplicated, and stripped of connective words and internal markers.
 * The disposable collection add-on and server are not included in Bedform.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Dictionary: ReadonlyArray<string> = /* #__PURE__ */ Object.freeze([
    "absorption", "acacia", "activator", "affinity", "agent", "air",
    "allay", "allium", "allow", "amethyst", "anchor", "ancient",
    "andesite", "angler", "anvil", "apple", "aqua", "archer",
    "area", "arm", "armadillo", "armor", "arms", "arrow",
    "arthropods", "aspect", "axe", "axolotl", "azalea", "azure",
    "bad", "baked", "ball", "bamboo", "bane", "banner",
    "barrel", "barrier", "bars", "basalt", "bat", "beacon",
    "beans", "bear", "bed", "bedrock", "bee", "beef",
    "beehive", "beetroot", "bell", "berries", "berry", "big",
    "binding", "birch", "black", "blackstone", "blade", "blast",
    "blaze", "blindness", "block", "blocks", "blossom", "blue",
    "bluet", "boat", "body", "bogged", "bolt", "bone",
    "book", "bookshelf", "boost", "boots", "border", "bordure",
    "bottle", "bounce", "bow", "bowl", "box", "brain",
    "breach", "bread", "breath", "breathing", "breeze", "brewer",
    "brewing", "brick", "bricks", "brown", "brush", "brute",
    "bubble", "bucket", "bud", "budding", "bulb", "bullet",
    "bundle", "burn", "burst", "bush", "button", "cactus",
    "cake", "calcite", "calibrated", "camel", "camera", "campfire",
    "candle", "cane", "carpet", "carrot", "carrots", "cartography",
    "carved", "cat", "catalyst", "cauldron", "cave", "chain",
    "chainmail", "chalkboard", "channeling", "charcoal", "charge", "charged",
    "chemical", "cherry", "chest", "chestplate", "chicken", "chipped",
    "chirp", "chiseled", "chorus", "cinnabar", "clay", "clock",
    "closed", "cloud", "clump", "cluster", "coal", "coarse",
    "coast", "cobbled", "cobblestone", "cocoa", "cod", "collision",
    "colored", "column", "command", "comparator", "compass", "composter",
    "compound", "concrete", "conduit", "constructor", "cooked", "cookie",
    "copper", "coral", "core", "cornflower", "cow", "cracked",
    "crafter", "crafting", "creaking", "cream", "creator", "creeper",
    "crimson", "crop", "crossbow", "crying", "crystal", "crystals",
    "cube", "cushion", "cut", "cyan", "daisy", "damage",
    "damaged", "dandelion", "danger", "dangerous", "dark", "darkness",
    "darkoak", "daylight", "dead", "deadbush", "debris", "decorated",
    "deepslate", "density", "deny", "depth", "detector", "diamond",
    "diorite", "dirt", "disc", "dispenser", "dolphin", "donkey",
    "door", "double", "dragon", "dried", "dripleaf", "dripstone",
    "dropper", "drowned", "dry", "dune", "dust", "dye",
    "echo", "effect", "efficiency", "egg", "elder", "element",
    "elytra", "emerald", "empty", "enchanted", "enchanting", "end",
    "ender", "enderman", "endermite", "evocation", "evoker", "experience",
    "explorer", "exposed", "eye", "eyeblossom", "falling", "fan",
    "far", "farmland", "fatal", "fatigue", "feather", "fence",
    "fermented", "fern", "field", "filled", "fire", "fireball",
    "firefly", "firework", "fireworks", "fish", "fishing", "flame",
    "flesh", "fletching", "flint", "flow", "flower", "flowered",
    "flowering", "flowing", "foot", "fortune", "fox", "fragment",
    "frame", "freezing", "friend", "frog", "froglight", "frost",
    "frosted", "fruit", "fungus", "furnace", "gate", "gateway",
    "ghast", "gilded", "glass", "glazed", "glistering", "globe",
    "glow", "glowingobsidian", "glowstone", "goat", "gold", "golden",
    "golem", "granite", "grass", "grate", "gravel", "gray",
    "green", "grindstone", "guardian", "gunpowder", "guster", "hanging",
    "happy", "hard", "hardened", "harness", "haste", "hay",
    "head", "health", "heart", "heartbreak", "heat", "heavy",
    "helmet", "hero", "hide", "hoe", "hoglin", "honey",
    "honeycomb", "hook", "hopper", "horn", "horse", "host",
    "howl", "hunger", "husk", "hyphae", "ice", "icicle",
    "illager", "impaling", "indented", "infested", "infinity", "ingot",
    "ink", "instant", "inverted", "invisibility", "invisible", "iron",
    "item", "jigsaw", "jukebox", "jump", "jungle", "kelp",
    "key", "knockback", "lab", "ladder", "lamp", "lantern",
    "lapis", "large", "lava", "layer", "lazuli", "lead",
    "leaf", "leather", "leaves", "lectern", "leggings", "lever",
    "levitation", "lichen", "light", "lightning", "lilac", "lily",
    "lime", "lingering", "lit", "litter", "llama", "lodestone",
    "log", "loom", "looting", "loyalty", "luck", "lunge",
    "lure", "mace", "magenta", "magma", "mall", "mangrove",
    "map", "masoned", "material", "meal", "medium", "mellohi",
    "melon", "membrane", "mending", "milk", "minecart", "miner",
    "mining", "mob", "mojang", "mooshroom", "mosaic", "moss",
    "mossy", "mourner", "moving", "mud", "muddy", "mule",
    "multishot", "mushroom", "music", "mutton", "mycelium", "name",
    "nausea", "nautilus", "nest", "nether", "netherbrick", "netherite",
    "netherrack", "netherreactor", "night", "normal", "noteblock", "npc",
    "nugget", "nylium", "oak", "observer", "obsidian", "ocelot",
    "ochre", "omen", "ominous", "oozing", "open", "orange",
    "orb", "orchid", "ore", "otherside", "overworld", "oxeye",
    "oxidized", "packed", "painting", "pale", "panda", "pane",
    "paper", "parched", "parrot", "path", "pattern", "pearl",
    "pearlescent", "peony", "petals", "petrified", "phantom", "pickaxe",
    "pickle", "pie", "piercing", "pig", "piglin", "pigman",
    "pigstep", "pillager", "pillar", "pink", "piston", "pitcher",
    "planks", "plant", "plate", "player", "plenty", "pod",
    "podzol", "pointed", "poison", "poisonous", "polar", "polished",
    "poplar", "popped", "poppy", "porkchop", "portal", "pot",
    "potato", "potatoes", "potent", "potion", "pottery", "powder",
    "power", "powered", "precipice", "press", "pressure", "prismarine",
    "prize", "projectile", "propagule", "protection", "pufferfish", "pumpkin",
    "punch", "purple", "purpur", "quartz", "quick", "rabbit",
    "raft", "raid", "rail", "raiser", "ravager", "raw",
    "recovery", "red", "redstone", "reducer", "reeds", "regeneration",
    "reinforced", "relic", "repeater", "repeating", "resin", "resistance",
    "respawn", "respiration", "rib", "riptide", "rocket", "rod",
    "roots", "rose", "rotten", "sac", "saddle", "salmon",
    "sand", "sandstone", "sapling", "saturation", "scaffolding", "scrap",
    "scrape", "sculk", "scute", "sea", "seagrass", "seeds",
    "sensor", "sentry", "shaper", "shard", "sharpness", "sheaf",
    "shears", "sheep", "shelf", "shell", "shelter", "sherd",
    "shield", "short", "shovel", "shrieker", "shroomlight", "shrub",
    "shulker", "sign", "signal", "silence", "silk", "silver",
    "silverfish", "skeleton", "skull", "slab", "slice", "slime",
    "slow", "slowness", "small", "smite", "smithing", "smoker",
    "smooth", "sneak", "sniffer", "snort", "snout", "snow",
    "snowball", "soil", "soul", "soup", "spawn", "spawner",
    "spear", "speed", "spider", "spike", "spire", "spit",
    "splash", "sponge", "spore", "sprouts", "spruce", "spyglass",
    "squid", "stained", "stairs", "stal", "stand", "standing",
    "star", "statue", "steel", "stem", "stew", "stick",
    "sticky", "stone", "stonecutter", "strad", "straw", "stray",
    "strength", "strider", "string", "stripped", "structure", "sugar",
    "sulfur", "sunflower", "suspicious", "sweet", "swift", "sword",
    "table", "tadpole", "tag", "tall", "target", "tear",
    "tears", "template", "terracotta", "thorns", "thrown", "tide",
    "tile", "tiles", "tinted", "tnt", "torch", "torchflower",
    "totem", "touch", "trader", "trapdoor", "trapped", "trial",
    "trident", "trim", "trip", "tripod", "tripwire", "tropical",
    "tropicalfish", "tube", "tuff", "tulip", "turtle", "twisting",
    "unbreaking", "underwater", "undyed", "undying", "unlit", "unpowered",
    "update", "upgrade", "valley", "vanishing", "vault", "vein",
    "verdant", "vex", "village", "villager", "vindicator", "vine",
    "vines", "vision", "void", "wait", "walker", "wall",
    "wandering", "ward", "warden", "warped", "wart", "water",
    "waterlily", "waxed", "wayfinder", "weakness", "weathered", "weaving",
    "web", "weeping", "weighted", "wet", "wheat", "white",
    "wild", "wildflowers", "wind", "wire", "witch", "wither",
    "wolf", "wood", "wooden", "wool", "writable", "xp",
    "yellow", "zoglin", "zombie"
]);

/**
 * Creates a name by independently sampling words with Math.random and joining them.
 * Defaults to three words from Dictionary separated by hyphens. Repeated words and
 * duplicate names are possible; this constructor does not guarantee uniqueness.
 * A custom dictionary is read without modification, including its spelling and order.
 *
 * @throws { RangeError } If NumWords is not a nonnegative safe integer, or a
 * nonempty name is requested from an empty dictionary.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Make = (config?: Config): string =>
{
    return Generate(config, Dictionary);
};

/**
 * Frozen subset of 256 recognizable Minecraft words, favoring iconic blocks, mobs,
 * equipment and resources over generic descriptors, obscure variants and internal terms.
 * Its default three-word names have 16,777,216 possible combinations.
 * Kept independent of Dictionary so fast-only bundles can omit the full vocabulary.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DictionaryFast: ReadonlyArray<string> = /* #__PURE__ */ Object.freeze([
    "acacia", "allay", "amethyst", "anvil", "apple", "armadillo",
    "armor", "arrow", "axe", "axolotl", "bamboo", "banner",
    "barrel", "basalt", "bat", "beacon", "bed", "bedrock",
    "bee", "beehive", "bell", "birch", "blackstone", "blaze",
    "boat", "bone", "book", "bookshelf", "boots", "bow",
    "bread", "breeze", "brewing", "bucket", "bundle", "cactus",
    "cake", "campfire", "candle", "carrot", "cauldron", "cave",
    "charcoal", "cherry", "chest", "chestplate", "chicken", "clay",
    "clock", "coal", "cobblestone", "command", "compass", "conduit",
    "copper", "cow", "crafter", "crafting", "creaking", "creeper",
    "crimson", "crossbow", "crystal", "deepslate", "diamond", "dirt",
    "dispenser", "dolphin", "door", "dragon", "dropper", "drowned",
    "elytra", "emerald", "enchanted", "enchanting", "end", "ender",
    "enderman", "evoker", "farmland", "feather", "fence", "fire",
    "fishing", "fletching", "flint", "fortune", "fox", "frog",
    "froglight", "furnace", "ghast", "glass", "glowstone", "goat",
    "gold", "golem", "grindstone", "guardian", "gunpowder", "helmet",
    "hoe", "hoglin", "honey", "honeycomb", "hopper", "horse",
    "ice", "ingot", "iron", "jukebox", "jungle", "kelp",
    "knockback", "ladder", "lantern", "lapis", "lava", "lectern",
    "leggings", "lever", "lightning", "llama", "lodestone", "loom",
    "looting", "mace", "magma", "mangrove", "map", "mending",
    "milk", "minecart", "mooshroom", "moss", "mud", "mushroom",
    "mycelium", "nether", "netherite", "netherrack", "noteblock", "nugget",
    "nylium", "oak", "observer", "obsidian", "ocelot", "ore",
    "overworld", "panda", "parrot", "pearl", "phantom", "pickaxe",
    "pig", "piglin", "pillager", "piston", "planks", "podzol",
    "porkchop", "portal", "potion", "prismarine", "pufferfish", "pumpkin",
    "quartz", "rabbit", "rail", "ravager", "redstone", "repeater",
    "resin", "respawn", "riptide", "rocket", "saddle", "salmon",
    "sand", "sandstone", "sapling", "scaffolding", "sculk", "sharpness",
    "shears", "sheep", "sherd", "shield", "shovel", "shrieker",
    "shroomlight", "shulker", "sign", "silverfish", "skeleton", "skull",
    "slab", "slime", "smite", "smithing", "smoker", "sniffer",
    "snow", "snowball", "soul", "spawner", "spider", "sponge",
    "spruce", "spyglass", "squid", "stairs", "stick", "sticky",
    "stone", "stonecutter", "stray", "strider", "string", "sugar",
    "sunflower", "sword", "tadpole", "terracotta", "thorns", "tnt",
    "torch", "torchflower", "totem", "trapdoor", "trial", "trident",
    "tripwire", "tuff", "turtle", "unbreaking", "vault", "vex",
    "villager", "vindicator", "vine", "void", "warden", "warped",
    "wart", "water", "wheat", "witch", "wither", "wolf",
    "wood", "wool", "zoglin", "zombie"
]);

/**
 * Creates a name using DictionaryFast unless a custom dictionary is supplied.
 * Accepts the same options, defaults and validation as Make. Sampling uses Math.random
 * with replacement, so repeated words and duplicate names are possible.
 * Use a tree-shaking bundler to omit the full Dictionary when only MakeFast is needed;
 * importing an unbundled module initializes both exported dictionaries.
 *
 * @throws { RangeError } If NumWords is not a nonnegative safe integer, or a
 * nonempty name is requested from an empty dictionary.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const MakeFast = (config?: Config): string =>
{
    return Generate(config, DictionaryFast);
};

/**
 * Validates configuration and samples from the supplied default or custom vocabulary.
 *
 * @throws { RangeError } If the word count is invalid or no requested word can be sampled.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Generate = (config: Config | undefined, dictionary: ReadonlyArray<string>): string =>
{
    const Words: ReadonlyArray<string> = config?.Dictionary ?? dictionary;
    const Count: number = config?.NumWords ?? 3;
    const Separator: string = config?.Separator ?? "-";
    if (!Number.isSafeInteger(Count) || Count < 0)
    {
        throw new RangeError("NumWords must be a nonnegative safe integer");
    }

    if (Count > 0 && Words.length === 0)
    {
        throw new RangeError("Dictionary must contain a word when NumWords is positive");
    }

    const Selected: Array<string> = [];
    for (let Index: number = 0; Index < Count; Index++)
    {
        Selected.push(Words[Math.floor(Math.random() * Words.length)]);
    }

    return Selected.join(Separator);
};

