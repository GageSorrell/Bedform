/**
 * Gizmo policy validation, immutable transform snapshots and explicit adapter discovery registry.
 *
 * @module bedform/Internal/Gizmo
 *
 * @file      Gizmo.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Policy snapshots retain public field ordering. */
/* eslint-disable sort-keys */

import type { Adapter, AxisBounds, Candidate, Channel, Configuration, Definition,
    Interval, Mode, Query, Runtime, StartOptions, Transform } from "../Diagetic/Gizmo.js";
import { Identifier, Parameter } from "./DiageticConfiguration.js";
import type { Vector3 } from "@minecraft/server";

const Modes: ReadonlyArray<Mode> = Object.freeze([ "translation", "rotation", "scale" ]);
const Reasons = Object.freeze([ "timeout", "distance", "itemChange", "death", "disconnect",
    "dimensionChange", "targetInvalid", "dispose", "predicate" ]);

const Definitions = new WeakSet<object>();

/**
 * Creates and brands an inert definition so registries can reject forged mutable capabilities.
 *
 * @throws { TypeError | RangeError } If configuration violates the public contract.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const CreateDefinition = <Target>(configuration: Configuration<Target>): Definition<Target> =>
{
    const config = Configure(configuration);
    const definition = Object.freeze({ Id: config.Id,
        Items: config.Items,
        Modes: config.Modes,
        InitialMode: config.Modes[0],
        Configuration: config });
    Definitions.add(definition);
    return definition;
};

/**
 * Requires a nonempty stable recovery key without trimming or changing its identity.
 *
 * @throws { TypeError } If the stable key is empty or is not a string.
 *
 * @category Validation
 * @since 1.0.0
 */
const Key = (value: string): string =>
{
    if (typeof value !== "string" || value.trim().length === 0)
    {
        throw new TypeError("Gizmo target key must be a nonempty stable string");
    }

    return value;
};

/**
 * Validates a required synchronous hook without invoking consumer code.
 *
 * @throws { TypeError } If the hook is absent, non-callable or an async function.
 *
 * @category Validation
 * @since 1.0.0
 */
const Hook = (value: unknown): void =>
{
    if (typeof value !== "function" || value.constructor?.name === "AsyncFunction")
    {
        throw new TypeError("Gizmo hooks must be synchronous functions");
    }
};

/**
 * Copies and freezes a finite vector, retaining negative and zero scale values.
 *
 * @throws { RangeError } If any vector component is missing or non-finite.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Vector = (value: Readonly<Vector3>): Readonly<Vector3> =>
{
    if (!value || ![ value.x, value.y, value.z ].every(Number.isFinite))
    {
        throw new RangeError("Gizmo vectors must contain finite x, y and z components");
    }

    return Object.freeze({ x: value.x,
        y: value.y,
        z: value.z });
};

/**
 * Copies a transform and requires a unit quaternion within a tolerance of 1e-6.
 *
 * @throws { RangeError } If components are non-finite or the quaternion is not unit length.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const SnapshotTransform = (value: Transform): Transform =>
{
    const rotation = value?.Rotation;
    if (!rotation || ![ rotation.x, rotation.y, rotation.z, rotation.w ].every(Number.isFinite) ||
        Math.abs(Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w) - 1) > 1e-6)
    {
        throw new RangeError("Gizmo Rotation must be a finite unit quaternion");
    }

    return Object.freeze({ Position: Vector(value.Position),
        Rotation: Object.freeze({ x: rotation.x,
            y: rotation.y,
            z: rotation.z,
            w: rotation.w }),
        Scale: Vector(value.Scale) });
};

/**
 * Copies inclusive endpoints and rejects non-finite or inverted intervals.
 *
 * @throws { RangeError } If endpoints are malformed, non-finite or inverted.
 *
 * @category Validation
 * @since 1.0.0
 */
const Limits = (value: Interval): Interval =>
{
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).some((key: string): boolean => key !== "Min" && key !== "Max") ||
        value.Min !== undefined && !Number.isFinite(value.Min) ||
        value.Max !== undefined && !Number.isFinite(value.Max) ||
        value.Min !== undefined && value.Max !== undefined && value.Min > value.Max)
    {
        throw new RangeError("Gizmo bounds require ordered finite endpoints");
    }

    return Object.freeze({ ...value });
};

/**
 * Copies parent-axis bounds, filling only omitted scale minima.
 *
 * @throws { TypeError | RangeError } If axis names or interval endpoints are invalid.
 *
 * @category Validation
 * @since 1.0.0
 */
const Axes = (value: AxisBounds | undefined, scale: boolean = false): AxisBounds | undefined =>
{
    if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).some((key: string): boolean => ![ "x", "y", "z" ].includes(key))))
    {
        throw new TypeError("Gizmo bounds require x, y and z axes");
    }

    if (!value && !scale)
    {
        return undefined;
    }

    const axis = (name: "x" | "y" | "z"): Interval | undefined =>
    {
        const interval = value?.[name];
        if (scale)
        {
            const checked = interval === undefined ? undefined : Limits(interval);
            return Limits({ ...checked,
                Min: checked?.Min ?? 0.001 });
        }

        return interval === undefined ? undefined : Limits(interval);
    };

    return Object.freeze({ x: axis("x"),
        y: axis("y"),
        z: axis("z") });
};

/**
 * Copies per-mode limits and snapping with explicit scale-default minima.
 *
 * @throws { TypeError | RangeError } If bounds or snap increments are invalid.
 *
 * @category Validation
 * @since 1.0.0
 */
const Policy = (value: Channel | undefined, scale: boolean = false): Channel =>
{
    if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value)) ||
        value?.Bounds !== undefined && (!value.Bounds || typeof value.Bounds !== "object" ||
            Array.isArray(value.Bounds)))
    {
        throw new TypeError("Gizmo channel and bounds must be policy objects");
    }

    const bounds = Object.freeze({ Actual: Axes(value?.Bounds?.Actual, scale),
        Change: Axes(value?.Bounds?.Change) });
    const snap = value?.Snap;
    if (snap !== undefined)
    {
        if (!snap || typeof snap !== "object" || Array.isArray(snap) ||
            snap.Origin !== undefined && ![ "absolute", "edit" ].includes(snap.Origin))
        {
            throw new TypeError("Gizmo snap origin must be absolute or edit");
        }

        const increment = Vector(snap.Increment);
        for (const number of Object.values(increment))
        {
            Parameter(number, "snap increment", true);
        }

        return Object.freeze({ Bounds: bounds,
            Snap: Object.freeze({ Increment: increment,
                Origin: snap.Origin ?? "absolute" }) });
    }

    return Object.freeze({ Bounds: bounds });
};

/**
 * Copies supported definition policies, validating every callback without invoking any hook.
 *
 * @throws { TypeError | RangeError } If capabilities, hooks or editing policies are invalid.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const Configure = <Target>(value: Configuration<Target>): Readonly<Configuration<Target>> =>
{
    if (!value || typeof value !== "object" || !Array.isArray(value.Items) || !value.Items.length ||
        !Array.isArray(value.Modes) || !value.Modes.length ||
        value.Modes.some((mode: Mode): boolean => !Modes.includes(mode)) ||
        new Set(value.Modes).size !== value.Modes.length || new Set(value.Items).size !== value.Items.length)
    {
        throw new TypeError("Gizmo requires nonempty unique Items and ordered supported Modes");
    }

    Identifier(value.Id);
    value.Items.forEach(Identifier);
    const adapter = value.Adapter;
    if (!adapter)
    {
        throw new TypeError("Gizmo requires a complete target adapter");
    }

    for (const name of [ "Discover", "Resolve", "Key", "IsValid", "HitTest", "Read", "ReadDegrees",
        "Parent", "Apply" ] as const)
    {
        Hook(adapter[name]);
    }

    for (const name of [ "Eligible", "FormatText", "OnPreview", "OnCommit", "OnCancel",
        "OnAbandonment" ] as const)
    {
        if (value[name] !== undefined)
        {
            Hook(value[name]);
        }
    }

    for (const name of [ "AllowOccluded", "AllowWalking", "Cycle", "Review", "Measurements",
        "Guides" ] as const)
    {
        if (value[name] !== undefined && typeof value[name] !== "boolean")
        {
            throw new TypeError(`Gizmo ${name} must be boolean`);
        }
    }

    for (const name of [ "InteractionRange", "TargetingAngle", "TranslationDecimals", "ScaleDecimals",
        "Size", "HandleTolerance" ] as const)
    {
        if (value[name] !== undefined && typeof value[name] !== "number")
        {
            throw new RangeError(`Gizmo ${name} must be numeric`);
        }
    }

    const range = Parameter(value.InteractionRange ?? 3, "interaction range", true);
    const angle = Parameter(value.TargetingAngle ?? 15, "targeting angle");
    if (angle > 180 || ![ 0, 1 ].includes(value.TranslationDecimals ?? 0) ||
        ![ 0, 1, 2, 3 ].includes(value.ScaleDecimals ?? 2))
    {
        throw new RangeError("Gizmo targeting angle or measurement precision is invalid");
    }

    const preview = value.Preview === undefined ? { Visibility: "shared" as const } : value.Preview;
    if (!preview || ![ "shared", "private" ].includes(preview.Visibility))
    {
        throw new TypeError("Gizmo Preview requires shared or private Visibility");
    }

    if (preview.Visibility === "private")
    {
        [ preview.Create, preview.Update, preview.Dispose ].forEach(Hook);
    }

    const physics = value.Physics;
    if (physics !== undefined)
    {
        if (!physics || typeof physics !== "object" || Array.isArray(physics) ||
            physics.Release !== undefined && ![ "freeze", "coast" ].includes(physics.Release))
        {
            throw new TypeError("Gizmo physics release must be freeze or coast");
        }

        Parameter(physics.Inertia, "inertia", true);
        Parameter(physics.Strength, "strength", true);
        Parameter(physics.Damping, "damping");
        Parameter(physics.Friction, "friction");
    }

    const abandon = value.Abandonment;
    if (abandon !== undefined)
    {
        if (!abandon || typeof abandon !== "object" || Array.isArray(abandon) ||
            abandon.Outcome !== undefined && ![ "commit", "cancel" ].includes(abandon.Outcome))
        {
            throw new TypeError("Gizmo abandonment outcome must be commit or cancel");
        }

        if (abandon.Overrides !== undefined && (!abandon.Overrides ||
            typeof abandon.Overrides !== "object" || Array.isArray(abandon.Overrides) ||
            Object.entries(abandon.Overrides).some(([ reason, outcome ]: [string, string]): boolean =>
                !Reasons.includes(reason) || ![ "commit", "cancel" ].includes(outcome))))
        {
            throw new TypeError("Gizmo abandonment overrides require supported reasons and outcomes");
        }

        if (abandon.TimeoutSeconds !== undefined)
        {
            Parameter(abandon.TimeoutSeconds, "abandonment timeout", true);
        }

        if (abandon.Distance !== undefined)
        {
            Parameter(abandon.Distance, "abandonment distance", true);
        }

        if (abandon.Predicate !== undefined)
        {
            Hook(abandon.Predicate);
        }
    }

    return Object.freeze({ ...value,
        Items: Object.freeze([ ...value.Items ]),
        Modes: Object.freeze([ ...value.Modes ]),
        Adapter: Object.freeze({ Discover: adapter.Discover,
            Resolve: adapter.Resolve,
            Key: adapter.Key,
            IsValid: adapter.IsValid,
            HitTest: adapter.HitTest,
            Read: adapter.Read,
            ReadDegrees: adapter.ReadDegrees,
            Parent: adapter.Parent,
            Apply: adapter.Apply }),
        InteractionRange: range,
        TargetingAngle: angle,
        AllowOccluded: value.AllowOccluded ?? false,
        AllowWalking: value.AllowWalking ?? false,
        Cycle: value.Cycle ?? false,
        Translation: Policy(value.Translation),
        Rotation: Policy(value.Rotation),
        Scale: Policy(value.Scale, true),
        Physics: physics === undefined ? undefined : Object.freeze({ ...physics,
            Release: physics.Release ?? "freeze" }),
        Preview: Object.freeze({ ...preview }),
        Review: value.Review ?? false,
        Abandonment: Object.freeze({ ...abandon,
            Outcome: abandon?.Outcome ?? "cancel",
            Overrides: Object.freeze({ ...abandon?.Overrides }) }),
        Measurements: value.Measurements ?? true,
        TranslationDecimals: value.TranslationDecimals ?? 0,
        ScaleDecimals: value.ScaleDecimals ?? 2,
        Size: Parameter(value.Size ?? 1, "size", true),
        HandleTolerance: Parameter(value.HandleTolerance ?? 0.08, "handle tolerance", true),
        Guides: value.Guides ?? false });
};

/**
 * Validates a query's view geometry and snapshots vectors before invoking discovery hooks.
 *
 * @throws { TypeError | RangeError } If the player, dimension or view geometry is invalid.
 *
 * @category Validation
 * @since 1.0.0
 */
const View = (value: Query): Query =>
{
    if (!value?.Player || typeof value.Dimension !== "string" || !value.Dimension)
    {
        throw new TypeError("Gizmo discovery requires an explicit player and dimension");
    }

    const direction = Vector(value.Direction);
    if (Math.abs(Math.hypot(direction.x, direction.y, direction.z) - 1) > 1e-6)
    {
        throw new RangeError("Gizmo view direction must be a unit vector");
    }

    return Object.freeze({ ...value,
        Origin: Vector(value.Origin),
        Direction: direction });
};

/**
 * Creates the explicit registry lifetime. Caller-owned native objects are never frozen or mutated.
 *
 * @throws { TypeError } If definitions or presentation hooks are invalid or capabilities overlap.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const CreateRuntime = (options: StartOptions): Runtime =>
{
    if (!options || !Array.isArray(options.Definitions))
    {
        throw new TypeError("Gizmo Start requires Definitions");
    }

    const definitions: ReadonlyArray<Definition<any>> = Object.freeze([ ...options.Definitions ]);
    const ids = new Set<string>();
    const items = new Map<string, Definition<any>>();
    for (const definition of definitions)
    {
        if (!definition || !Definitions.has(definition) || ids.has(definition.Id))
        {
            throw new TypeError("Gizmo Start requires distinct immutable Make definitions");
        }

        ids.add(definition.Id);
        for (const item of definition.Items)
        {
            if (items.has(item))
            {
                throw new TypeError("Gizmo item capabilities must be unique within a runtime");
            }

            items.set(item, definition);
        }
    }

    const presentation = options.Presentation;
    if (presentation !== undefined)
    {
        if (!presentation)
        {
            throw new TypeError("Gizmo Presentation requires Create, Update and Dispose");
        }

        [ presentation.Create, presentation.Update, presentation.Dispose ].forEach(Hook);
    }

    let disposed = false;
    const active = (): void =>
    {
        if (disposed)
        {
            throw new Error("Gizmo runtime is disposed");
        }
    };

    return Object.freeze({ Definitions: definitions,
        Presentation: presentation === undefined ? undefined : Object.freeze({ Create: presentation.Create,
            Update: presentation.Update,
            Dispose: presentation.Dispose }),
        get Disposed(): boolean
        {
            return disposed;
        },
        Dispose(): void
        {
            disposed = true;
            items.clear();
        },
        Discover(item: string, query: Query): ReadonlyArray<Candidate<unknown>>
        {
            active();
            const definition = items.get(item);
            if (!definition)
            {
                return Object.freeze([]);
            }

            const view = View(query);
            const config = definition.Configuration;
            const adapter: Adapter<unknown> = config.Adapter;
            const targets = adapter.Discover(view);
            if (!Array.isArray(targets))
            {
                throw new TypeError("Gizmo Discover must return a synchronous array");
            }

            const seen = new Set<string>();
            const candidates: Array<Candidate<unknown>> = [];
            for (const target of targets)
            {
                if (!adapter.IsValid(target) || config.Eligible && !config.Eligible(view.Player, target))
                {
                    continue;
                }

                const key = Key(adapter.Key(target));
                const hit = adapter.HitTest(target, view);
                if (!hit)
                {
                    continue;
                }

                if (!Number.isFinite(hit.Distance) || hit.Distance <= 0 || !Number.isFinite(hit.Angle) ||
                    hit.Angle < 0 || hit.Angle > 180 || typeof hit.Occluded !== "boolean")
                {
                    throw new RangeError("Gizmo body hit requires positive distance and valid angle");
                }

                if (seen.has(key) || hit.Distance > config.InteractionRange! ||
                    hit.Angle > config.TargetingAngle! ||
                    hit.Occluded && !config.AllowOccluded)
                {
                    continue;
                }

                seen.add(key);
                candidates.push(Object.freeze({ Definition: definition,
                    Target: target,
                    Key: key,
                    Hit: Object.freeze({ ...hit }) }));
            }

            candidates.sort((left: Candidate<unknown>, right: Candidate<unknown>): number =>
                Number(left.Hit.Angle !== 0) - Number(right.Hit.Angle !== 0) ||
                (left.Hit.Angle === 0 ? left.Hit.Distance - right.Hit.Distance :
                    left.Hit.Angle - right.Hit.Angle) ||
                left.Hit.Distance - right.Hit.Distance || (left.Key < right.Key ? -1 : 1));
            return Object.freeze(candidates);
        },
        Resolve(id: string, key: string): unknown | undefined
        {
            active();
            Key(key);
            const definition = definitions.find((entry: Definition<any>): boolean => entry.Id === id);
            if (!definition)
            {
                return undefined;
            }

            const adapter = definition.Configuration.Adapter;
            const target: unknown = adapter.Resolve(key);
            if (target === undefined || !adapter.IsValid(target))
            {
                return undefined;
            }

            if (Key(adapter.Key(target)) !== key)
            {
                throw new Error("Gizmo recovery adapter resolved a different stable target key");
            }

            return target;
        } });
};
