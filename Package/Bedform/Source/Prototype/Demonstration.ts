/**
 * Nominal demonstration definitions with typed state, named references and execution callbacks.
 *
 * @module bedform/Prototype/Demonstration
 *
 * @file      Demonstration.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Export declarations own their documentation; material and lifecycle ordering follows the public API. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import type { CancellationToken, WorldConfiguration } from "./Interaction.js";
import type { Block as NativeBlock, Entity as NativeEntity, Player, RGB } from "@minecraft/server";

/**
 * Non-enumerable identity and invariant generic witness for constructed demonstrations.
 *
 * @category Symbols
 * @since 1.0.0
 */
export const TypeId: unique symbol = Symbol.for("~bedform/Prototype/Demonstration");

/**
 * Idle readiness supplied by an authored state getter.
 *
 * @category Symbols
 * @since 1.0.0
 */
export const Ready: unique symbol = Symbol("Ready");

/**
 * Runtime-owned active execution status.
 *
 * @category Symbols
 * @since 1.0.0
 */
export const InProgress: unique symbol = Symbol("InProgress");

/**
 * Idle unavailability supplied by an authored getter or execution failure.
 *
 * @category Symbols
 * @since 1.0.0
 */
export const NotReady: unique symbol = Symbol("NotReady");

/**
 * Runtime-owned cancellation status until execution and cleanup settle.
 *
 * @category Symbols
 * @since 1.0.0
 */
export const Stopping: unique symbol = Symbol("Stopping");

/**
 * A named block reference, including signs and containers through native components.
 *
 * @category Symbols
 * @since 1.0.0
 */
export const Block: unique symbol = Symbol("Block");

/**
 * A named entity reference; players and dropped items cannot be bound.
 *
 * @category Symbols
 * @since 1.0.0
 */
export const Entity: unique symbol = Symbol("Entity");

/**
 * Public statuses; only Ready and NotReady are authored idle statuses.
 *
 * @category Types
 * @since 1.0.0
 */
export type Status = typeof Ready | typeof InProgress | typeof NotReady | typeof Stopping;

/**
 * State data is required for every non-never argument, including undefined and unions.
 * No Data property exists for never.
 *
 * @category Types
 * @since 1.0.0
 */
export type State<Data = never> = { readonly Status: Status;
    readonly Reason?: string } &
    ([Data] extends [never] ? unknown : { readonly Data: Data });

/**
 * A synchronous getter cannot claim runtime-owned running or stopping status.
 *
 * @category Types
 * @since 1.0.0
 */
export type IdleState<Data = never> = State<Data> & { readonly Status: typeof Ready | typeof NotReady };

/**
 * Named reference declarations use only the exported kind symbols.
 *
 * @category Types
 * @since 1.0.0
 */
export type ReferenceMap = Readonly<Record<string, typeof Block | typeof Entity>>;

/**
 * A binding resolves its current native object, or undefined while unloaded or removed.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ReferenceHandle<Value>
{
    readonly Resolve: () => Value | undefined;
}

/**
 * Inferred native object for each declared reference kind.
 *
 * @category Types
 * @since 1.0.0
 */
export type ReferenceValue<Kind extends typeof Block | typeof Entity> =
    Kind extends typeof Block ? NativeBlock : NativeEntity;

/**
 * Named handles retain the exact keys and native kinds of the declaration.
 *
 * @category Types
 * @since 1.0.0
 */
export type ReferenceHandles<References extends ReferenceMap> = {
    readonly [Key in keyof References]: ReferenceHandle<ReferenceValue<References[Key]>>;
};

/**
 * Optional per-reference validation receives the declared native kind.
 *
 * @category Types
 * @since 1.0.0
 */
export type ReferenceValidators<References extends ReferenceMap> = {
    readonly [Key in keyof References]?: (value: ReferenceValue<References[Key]>) => boolean;
};

/**
 * Registry state may be absent when its getter failed; no generic data is fabricated.
 *
 * @category Types
 * @since 1.0.0
 */
export interface RegistryEntry
{
    readonly Id: string;
    readonly State?: State<unknown> | State;
    readonly RunningCount: number;
    readonly CompletionCount: number;
    readonly Error?: unknown;
}

/**
 * World-wide readiness and completion history indexed by stable ID.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Registry
{
    readonly Entries: ReadonlyMap<string, RegistryEntry>;
    readonly RunningCount: number;
}

/**
 * Common callback access without an initiating player or invented state.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Context<References extends ReferenceMap = Record<never, never>>
{
    readonly Configuration: WorldConfiguration;
    readonly References: ReferenceHandles<References>;
    readonly Registry: Registry;
}

/**
 * Execution callbacks share the initiator, current typed state and cooperative cancellation.
 *
 * @category Types
 * @since 1.0.0
 */
export interface RunContext<Data = never, References extends ReferenceMap = Record<never, never>>
    extends Context<References>
{
    readonly Player: Player;
    readonly State: State<Data>;
    readonly Cancellation: CancellationToken;
}

/**
 * Viewer callbacks receive current state and the player whose HUD or visibility is evaluated.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ViewContext<Data = never, References extends ReferenceMap = Record<never, never>>
    extends Context<References>
{
    readonly Player: Player;
    readonly State: State<Data>;
}

/**
 * Shared authored fields. Stable IDs survive renaming and reordering; getters are synchronous.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Definition<Data = never, References extends ReferenceMap = Record<never, never>>
{
    readonly Id: string;
    readonly Name: string;
    readonly Description: string;
    readonly Color?: RGB;
    readonly References?: References;
    readonly Validators?: ReferenceValidators<References>;
    readonly GetState: (context: Context<References>) => IdleState<Data>;
    readonly CanStart?: (context: RunContext<Data, References>) => boolean;
    readonly GetActionBar?: (context: ViewContext<Data, References>) => string | ReadonlyArray<string>;
    readonly IsViewing?: (context: ViewContext<Data, References>) => boolean;
}

/**
 * Static scenes have no lifecycle callbacks or trigger requirement.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Static
{
    readonly Run?: never;
    readonly OnStart?: never;
    readonly OnCancel?: never;
    readonly OnCleanup?: never;
}

/**
 * Managed execution hooks; cleanup and cancellation are runtime-owned once-only operations.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Runnable<Data = never, References extends ReferenceMap = Record<never, never>>
{
    readonly Run: (context: RunContext<Data, References>) => Promise<void>;
    readonly OnStart?: (context: RunContext<Data, References>) => void | Promise<void>;
    readonly OnCancel?: (context: RunContext<Data, References>) => void | Promise<void>;
    readonly OnCleanup?: (context: RunContext<Data, References>) => void | Promise<void>;
}

/**
 * Input definition distinguishes static scenes from runnable demonstrations.
 *
 * @category Types
 * @since 1.0.0
 */
export type Input<Data = never, References extends ReferenceMap = Record<never, never>> =
    Definition<Data, References> & (Static | Runnable<Data, References>);

/**
 * Nominal immutable definition, invariant in data and reference types.
 *
 * @category Types
 * @since 1.0.0
 */
export type Demonstration<Data = never, References extends ReferenceMap = Record<never, never>> =
    Input<Data, References> & {
        readonly [TypeId]: (data: Data, references: References) => readonly [Data, References];
    };

/**
 * Existential registration view permits heterogeneous ordered worlds without erasing authored types.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Registered
{
    readonly Id: string;
    readonly Name: string;
    readonly Description: string;
    readonly [TypeId]: (...arguments_: Array<never>) => unknown;
}

/**
 * Tests entity-binding eligibility before saving an entity ID. Players and item drops are excluded.
 * Native handle availability and custom predicates remain the resolver's responsibility.
 *
 * @category References
 * @since 1.0.0
 */
export const isBindableEntity = (entity: Pick<NativeEntity, "typeId">): boolean =>
{
    return entity.typeId !== "minecraft:player" && entity.typeId !== "minecraft:item";
};

/**
 * Constructs a validated immutable definition without invoking authored callbacks.
 * The non-enumerable brand is a dummy generic witness, not an executable lifecycle hook.
 *
 * @throws { TypeError } When identity, reference declarations or callback shapes are invalid.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const Demonstration = <Data = never, const References extends ReferenceMap = Record<never, never>>(
    definition: Input<Data, References>): Demonstration<Data, References> =>
{
    for (const field of [ "Id", "Name", "Description" ] as const)
    {
        if (typeof definition?.[field] !== "string" ||
            (field !== "Description" && definition[field].trim().length === 0))
        {
            throw new TypeError(`Demonstration ${field} must be a valid string`);
        }
    }

    if (definition.Id !== definition.Id.trim())
    {
        throw new TypeError("Demonstration Id cannot have surrounding whitespace");
    }

    if (typeof definition.GetState !== "function")
    {
        throw new TypeError("Demonstration GetState must be synchronous callback");
    }

    if (Object.prototype.toString.call(definition.GetState) === "[object AsyncFunction]")
    {
        throw new TypeError("Demonstration GetState cannot be async");
    }

    for (const field of [ "References", "Validators" ] as const)
    {
        const value = definition[field];
        if (value !== undefined && (value === null || typeof value !== "object" || Array.isArray(value)))
        {
            throw new TypeError(`Demonstration ${field} must be a named record`);
        }
    }

    if (definition.Color !== undefined && (!definition.Color ||
        ![ definition.Color.red, definition.Color.green, definition.Color.blue ]
            .every((channel: number) => Number.isFinite(channel) && channel >= 0 && channel <= 1)))
    {
        throw new TypeError("Demonstration Color must contain RGB channels between zero and one");
    }

    for (const field of [ "CanStart", "GetActionBar", "IsViewing", "Run",
        "OnStart", "OnCancel", "OnCleanup" ] as const)
    {
        if (definition[field] !== undefined && typeof definition[field] !== "function")
        {
            throw new TypeError(`Demonstration ${field} must be a callback`);
        }
    }

    if (!definition.Run && (definition.OnStart || definition.OnCancel || definition.OnCleanup))
    {
        throw new TypeError("Static demonstrations cannot have run lifecycle callbacks");
    }

    for (const [ name, kind ] of Object.entries(definition.References ?? {}))
    {
        if (!name.trim() || (kind !== Block && kind !== Entity))
        {
            throw new TypeError(`Invalid demonstration reference: ${name}`);
        }
    }

    for (const [ name, validator ] of Object.entries(definition.Validators ?? {}))
    {
        if (!Object.hasOwn(definition.References ?? {}, name) || typeof validator !== "function")
        {
            throw new TypeError(`Invalid demonstration reference validator: ${name}`);
        }
    }

    const result = { ...definition,
        ...(definition.Color ? { Color: Object.freeze({ ...definition.Color }) } : {}),
        ...(definition.References ? { References: Object.freeze({ ...definition.References }) } : {}),
        ...(definition.Validators ? { Validators: Object.freeze({ ...definition.Validators }) } : {}) };
    Object.defineProperty(result, TypeId, {
        value: (data: Data, references: References) => [ data, references ]
    });
    return Object.freeze(result) as Demonstration<Data, References>;
};
