/**
 * Game-safe structure option validation, native material qualification and translated dropdown data.
 *
 * @module bedform/Prototype/Structure/Catalog
 *
 * @file      Catalog.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Role ordering follows the authored options; callbacks retain contextual inference. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import { Defaults, GlassPalette, PanePalette, Presets, SlabPalette, SolidPalette } from "../Structure.js";
import type { MaterialPermutations, StructureOptions } from "../Persistence.js";
import type { Materials, Options, Permutation } from "../Structure.js";

/**
 * Catalog schema version recorded with qualified saved selections.
 *
 * @category Constants
 * @since 1.0.0
 */
export const CatalogVersion = 1 as const;

/**
 * Ordered per-part catalogs; the entrance floor also supplies the surrounding border.
 *
 * @category Materials
 * @since 1.0.0
 */
export const Catalogs = Object.freeze({
    MainFloor: SolidPalette,
    EntranceWall: SolidPalette,
    EntranceFloor: SolidPalette,
    MainWalls: Object.freeze([ ...SolidPalette, ...GlassPalette, ...PanePalette ] as const),
    MainCeiling: Object.freeze([ ...SolidPalette, ...GlassPalette, ...SlabPalette ] as const),
    EntranceCeiling: Object.freeze([ ...SolidPalette, ...GlassPalette, ...SlabPalette ] as const)
} as const);

/**
 * Independent material-control role.
 *
 * @category Types
 * @since 1.0.0
 */
export type Part = keyof Materials;

/**
 * A translated UIRawMessage-compatible label, resolved by each client's locale.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Translation
{
    readonly translate: string;
}

/**
 * Engine-specific block metadata. Older engines lacking localizationKey fail with a diagnostic.
 *
 * @category Types
 * @since 1.0.0
 */
export interface NativeType
{
    readonly id: string;
    readonly localizationKey?: string;
}

/**
 * Minimal block-type registry port, compatible with native BlockTypes.
 *
 * @category Types
 * @since 1.0.0
 */
export interface NativeTypes
{
    readonly get: (id: string) => NativeType | undefined;
}

/**
 * Current native permutation, inspected rather than serialized as a game object.
 *
 * @category Types
 * @since 1.0.0
 */
export interface NativePermutation
{
    readonly type: NativeType;
    readonly getAllStates: () => Record<string, string | number | boolean>;
}

/**
 * Minimal native BlockPermutation static port.
 *
 * @category Types
 * @since 1.0.0
 */
export interface NativePermutations
{
    readonly resolve: (id: string, states?: Record<string, string | number | boolean>) => NativePermutation;
}

/**
 * Selected-engine lookup and exact permutation validation, supplied explicitly to avoid runtime imports.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Engine
{
    readonly GetType: (id: string) => NativeType | undefined;
    readonly Resolve: (id: string,
        states: Readonly<Record<string, string | number | boolean>>) => Permutation;
}

/**
 * Build limits normalized by the selected-engine adapter.
 * MinY is inclusive; MaxYExclusive is exclusive.
 * No fixed Overworld or dimension height is assumed.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Site
{
    readonly FloorY: number;
    readonly MinY: number;
    readonly MaxYExclusive: number;
}

/**
 * Stable material choice and its translated name, separate from a transient dropdown value.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Choice<Role extends Part = Part>
{
    readonly Id: Materials[Role];
    readonly Permutation: Permutation;
    readonly Label: Translation;
}

/**
 * Native DropdownItemData-compatible entry; numeric values are local to the current control.
 *
 * @category Types
 * @since 1.0.0
 */
export interface DropdownItem
{
    readonly label: Translation;
    readonly value: number;
}

/**
 * Screen-local mapping retains the disabled main-ceiling choice and resolves saved IDs on every reopen.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Control<Role extends Part = Part>
{
    readonly Part: Role;
    readonly Enabled: boolean;
    readonly Choices: ReadonlyArray<Choice<Role>>;
    readonly Items: ReadonlyArray<DropdownItem>;
    readonly SelectedValue: number;
}

/**
 * Rejects non-data objects and unknown fields before normalizing saved legacy options.
 *
 * @throws { Error } When input is not a plain object with only permitted fields.
 *
 * @category Internal
 * @since 1.0.0
 */
const fields = (value: unknown, keys: ReadonlyArray<string>): Record<string, unknown> =>
{
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
        Object.keys(value).some((key) => !keys.includes(key)))
    {
        throw new Error("Invalid structure options object or unknown field");
    }

    return value as Record<string, unknown>;
};

/**
 * Normalizes omitted legacy fields only, returning a detached selection without changing blocks or storage.
 * Explicit invalid materials, falsey values and fractional heights never receive substitutes.
 *
 * @throws { Error } When options violate size/facing/height or per-part material contracts.
 *
 * @category Validation
 * @since 1.0.0
 */
export const normalize = (value: unknown): Options =>
{
    const source = fields(value, [ "Size", "Facing", "InteriorHeight", "IncludeMainCeiling", "Materials" ]);
    const raw = fields(source.Materials === undefined ? {} : source.Materials, Object.keys(Catalogs));
    const size = source.Size === undefined ? Defaults.Size : source.Size;
    const facing = source.Facing === undefined ? Defaults.Facing : source.Facing;
    const height = source.InteriorHeight === undefined ? Defaults.InteriorHeight : source.InteriorHeight;
    const ceiling = source.IncludeMainCeiling === undefined ? false : source.IncludeMainCeiling;
    if (typeof size !== "string" || !Object.hasOwn(Presets, size) ||
        typeof facing !== "string" ||
        ![ "North", "East", "South", "West" ].includes(facing) ||
        typeof height !== "number" || !Number.isSafeInteger(height) || height < 3 ||
        typeof ceiling !== "boolean")
    {
        throw new Error("Invalid structure options: height must be an integer of at least three; " +
            "check size, facing and ceiling toggle");
    }

    const materials = Object.fromEntries((Object.keys(Catalogs) as Array<Part>).map((role) =>
    {
        const id = raw[role] === undefined ? Defaults.Materials[role] : raw[role];
        if (typeof id !== "string" || !(Catalogs[role] as ReadonlyArray<string>).includes(id))
        {
            throw new Error(`Unsupported saved material ${role}: ${String(id)}`);
        }

        return [ role, id ];
    })) as unknown as Materials;
    return { Size: size as Options["Size"],
        Facing: facing as Options["Facing"],
        InteriorHeight: height,
        IncludeMainCeiling: ceiling,
        Materials: materials };
};

/**
 * Checks actual written wall/roof levels, including the always-present entrance canopy at FloorY+4.
 * Returns the largest legal interior height; requested values are never clamped.
 *
 * @throws { Error } When floor, height range, main walls or either roof exceeds the selected site.
 *
 * @category Validation
 * @since 1.0.0
 */
export const validateSite = (value: Options, site: Site): number =>
{
    const options = normalize(value);
    if (![ site.FloorY, site.MinY, site.MaxYExclusive ].every(Number.isSafeInteger) ||
        site.MinY >= site.MaxYExclusive || site.FloorY < site.MinY || site.FloorY >= site.MaxYExclusive)
    {
        throw new Error("Invalid structure floor/build-height range");
    }

    const maximum = site.MaxYExclusive - site.FloorY - (options.IncludeMainCeiling ? 2 : 1);
    if (site.FloorY + 4 >= site.MaxYExclusive || options.InteriorHeight > maximum)
    {
        throw new Error(`Structure exceeds site build height: interior height ${options.InteriorHeight}, ` +
            `maximum ${maximum}; entrance roof also requires FloorY+4`);
    }

    return maximum;
};

/**
 * Wraps native static registries; unsupported permutations fail before any world modification.
 *
 * @category Adapters
 * @since 1.0.0
 */
export const nativeEngine = (types: NativeTypes, permutations: NativePermutations): Engine =>
{
    return { GetType: (id) => types.get(id),
        Resolve: (id, states) =>
        {
            const resolved = permutations.resolve(id, { ...states });
            return { Id: resolved.type.id as Permutation["Id"],
                States: resolved.getAllStates() };
        } };
};

/**
 * Qualifies a single saved material and all requested states against the current engine.
 *
 * @throws { Error } When IDs, localization metadata or required permutations are unavailable.
 *
 * @category Internal
 * @since 1.0.0
 */
const choice = <Role extends Part>(role: Role, id: Materials[Role], engine: Engine,
    saved?: Permutation): Choice<Role> =>
{
    try
    {
        if (!(Catalogs[role] as ReadonlyArray<string>).includes(id) ||
            (saved && saved.Id !== id))
        {
            throw new Error("ID does not match its material role");
        }

        const type = engine.GetType(id);
        if (!type || type.id !== id || typeof type.localizationKey !== "string" ||
            !type.localizationKey.trim())
        {
            throw new Error("block type or BlockType.localizationKey unavailable; " +
                "check selected engine support");
        }

        const states = saved ? { ...fields(saved.States, Object.keys(saved.States)) } : {};
        if (Object.values(states).some((state) =>
            ![ "string", "boolean", "number" ].includes(typeof state) ||
            (typeof state === "number" && !Number.isFinite(state))))
        {
            throw new Error("saved permutation contains invalid state values");
        }

        if ((SlabPalette as ReadonlyArray<string>).includes(id))
        {
            if ((saved || states["minecraft:vertical_half"] !== undefined) &&
                states["minecraft:vertical_half"] !== "bottom")
            {
                throw new Error("ceiling slabs must use the bottom half");
            }

            states["minecraft:vertical_half"] = "bottom";
        }

        const resolved = engine.Resolve(id, states as Record<string, string | number | boolean>);
        if (resolved.Id !== id ||
            Object.entries(states).some(([ key, state ]) => resolved.States[key] !== state))
        {
            throw new Error("engine did not preserve the required permutation states");
        }

        if (Object.values(resolved.States).some((state) =>
            ![ "string", "boolean", "number" ].includes(typeof state) ||
            (typeof state === "number" && !Number.isFinite(state))))
        {
            throw new Error("engine returned invalid state values");
        }

        return Object.freeze({ Id: id,
            Label: Object.freeze({ translate: type.localizationKey }),
            Permutation: Object.freeze({ Id: id,
                States: Object.freeze({ ...resolved.States }) }) });
    }
    catch (cause)
    {
        throw new Error(`Unsupported structure material ${role} (${id}): ${String(cause)}`, { cause });
    }
};

/**
 * Resolves exactly the ordered role catalog with translated client-side names and stable IDs/states.
 *
 * @throws { Error } When the current engine cannot qualify a listed choice.
 *
 * @category Materials
 * @since 1.0.0
 */
export const catalog = <Role extends Part>(role: Role, engine: Engine): ReadonlyArray<Choice<Role>> =>
{
    return Object.freeze(Catalogs[role].map((id) => choice(role, id as Materials[Role], engine)));
};

/**
 * Qualifies all six choices, including the retained main-ceiling material while its toggle is off.
 * Optional saved permutations are revalidated; no block or dynamic-property writes occur.
 *
 * @throws { Error } When schema, site or current-engine material validation fails.
 *
 * @category Validation
 * @since 1.0.0
 */
export const qualify = (value: unknown, engine: Engine, site?: Site,
    saved?: MaterialPermutations): Omit<StructureOptions, "Revision"> =>
{
    const options = normalize(value);
    if (saved !== undefined)
    {
        const roles = Object.keys(Catalogs);
        const source = fields(saved, roles);
        if (roles.some((role) => !Object.hasOwn(source, role) || !source[role]))
        {
            throw new Error("Saved material permutations must include all six structure parts; " +
                "reselect materials");
        }
    }

    if (site)
    {
        validateSite(options, site);
    }

    const permutations = Object.fromEntries((Object.keys(Catalogs) as Array<Part>).map((role) =>
        [ role, choice(role, options.Materials[role], engine, saved?.[role]).Permutation ])) as
        unknown as MaterialPermutations;
    return { CatalogVersion,
        Options: options,
        Permutations: permutations };
};

/**
 * Reconstructs numeric dropdown values from saved IDs in the supplied current catalog order.
 * Main-ceiling entries stay mounted but disabled while the main roof is off.
 *
 * @throws { Error } When a catalog is ambiguous or the saved ID disappeared.
 *
 * @category Controls
 * @since 1.0.0
 */
export const dropdown = <Role extends Part>(role: Role, value: Options,
    choices: ReadonlyArray<Choice<Role>>): Control<Role> =>
{
    const options = normalize(value);
    const ids = choices.map((entry) => entry.Id);
    const selected = ids.indexOf(options.Materials[role]);
    if (new Set(ids).size !== ids.length || selected < 0 ||
        ids.some((id) => !(Catalogs[role] as ReadonlyArray<string>).includes(id)))
    {
        throw new Error(`Missing or ambiguous current ${role} catalog ` +
            `for saved material ${options.Materials[role]}`);
    }

    const snapshot = Object.freeze(choices.map((entry) => Object.freeze({ ...entry,
        Label: Object.freeze({ ...entry.Label }),
        Permutation: Object.freeze({ ...entry.Permutation,
            States: Object.freeze({ ...entry.Permutation.States }) }) })));
    return Object.freeze({ Part: role,
        Enabled: role !== "MainCeiling" || options.IncludeMainCeiling,
        Choices: snapshot,
        Items: Object.freeze(snapshot.map((entry, index) =>
            Object.freeze({ label: entry.Label,
                value: index }))),
        SelectedValue: selected });
};

/**
 * Applies a transient numeric choice to a detached options draft; only the stable material ID is retained.
 *
 * @throws { Error } When a disabled control or invalid numeric dropdown value is submitted.
 *
 * @category Controls
 * @since 1.0.0
 */
export const withChoice = (value: Options, control: Control, selected: number): Options =>
{
    const options = normalize(value);
    if (!control.Enabled || (control.Part === "MainCeiling" && !options.IncludeMainCeiling) ||
        !Number.isInteger(selected) || selected < 0 || selected >= control.Choices.length)
    {
        throw new Error("Invalid or disabled structure material dropdown selection");
    }

    return normalize({ ...options,
        Materials: { ...options.Materials,
            [control.Part]: control.Choices[selected].Id } });
};
