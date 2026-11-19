/**
 * Inert item capabilities and generic local-transform adapters for explicit Gizmo discovery lifetimes.
 *
 * @module bedform/Diagetic/Gizmo
 *
 * @file      Gizmo.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public contracts retain semantic field ordering. */
/* eslint-disable sort-keys */

import { CreateDefinition, CreateRuntime, SnapshotTransform } from "../Internal/Gizmo.js";
import type { Player, Vector3 } from "@minecraft/server";
import type { Coordinates as Quat } from "../Quat.js";

/**
 * Shared local handle geometry, focus selection and pure captured drag projection.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Geometry from "./Gizmo/Geometry.js";

/**
 * Local transform operation. Configuration order determines the initial mode and cycling order.
 *
 * @category Model
 * @since 1.0.0
 */
export type Mode = "translation" | "rotation" | "scale";

/**
 * Local axis, local plane, camera-plane translation or uniform-scale handle.
 *
 * @category Model
 * @since 1.0.0
 */
export type Handle = "x" | "y" | "z" | "xy" | "xz" | "yz" | "camera" | "uniform";

/**
 * Parent-relative position in blocks, Hamilton quaternion orientation and component scale.
 * Uses Bedform Quat conventions; native entity yaw/pitch is not a complete orientation adapter.
 * Scale may pass through zero when explicitly permitted by policy. No matrix decomposition is required.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Transform
{
    readonly Position: Readonly<Vector3>;
    readonly Rotation: Quat;
    readonly Scale: Readonly<Vector3>;
}

/**
 * Rigid parent-to-world frame, with translation in blocks and a unit Hamilton quaternion.
 * Adapters must account for scaled or sheared ancestors themselves; this frame never silently loses shear.
 * Actual bounds are evaluated in the declared parent frame, rather than in world coordinates.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Frame
{
    readonly Position: Readonly<Vector3>;
    readonly Rotation: Quat;
}

/**
 * Explicit player view with a unit world direction and dimension identifier.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Query
{
    readonly Player: Player;
    readonly Dimension: string;
    readonly Origin: Readonly<Vector3>;
    readonly Direction: Readonly<Vector3>;
}

/**
 * Target-body focus result, separate from future handle geometry tests. Distance is the nearest positive
 * ray hit, or nearest bounds distance for an angular near miss, in blocks. Angle is degrees from the ray
 * to the bounds, zero for a direct hit. Occlusion must be measured by the adapter and is denied by default.
 *
 * @category Model
 * @since 1.0.0
 */
export interface BodyHit
{
    readonly Distance: number;
    readonly Angle: number;
    readonly Occluded: boolean;
}

/**
 * Developer-owned target operations. All hooks are synchronous. Key is globally stable across add-ons,
 * wrappers and reloads for the same underlying object or part; never use a transient discovery index.
 * Undefined Resolve means unavailable, including unloaded targets; recovery must defer rather than spawn.
 * Read and Apply operate in the same parent frame. Apply implements the whole transform or throws;
 * Bedform assumes no native bone, block-scale, entity-roll or component-scale setters.
 * ReadDegrees supplies continuous parent-frame x/pitch, y/yaw and z/roll channels consistent with Read's
 * orientation using Bedform Rotator conventions. Apply receives the updated channels alongside the
 * quaternion so the adapter can retain complete turns across edits and reloads without decomposing it.
 * HitTest tests the target body/bounds, never the Gizmo handles. Discover should bound its search work.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Adapter<Target>
{
    readonly Discover: (query: Query) => ReadonlyArray<Target>;
    readonly Resolve: (key: string) => Target | undefined;
    readonly Key: (target: Target) => string;
    readonly IsValid: (target: Target) => boolean;
    readonly HitTest: (target: Target, query: Query) => BodyHit | undefined;
    readonly Read: (target: Target) => Transform;
    readonly ReadDegrees: (target: Target) => Readonly<Vector3>;
    readonly Parent: (target: Target) => Frame;
    readonly Apply: (target: Target, transform: Transform, rotationDegrees: Readonly<Vector3>) => void;
}

/**
 * Inclusive optional endpoints. Omitted endpoints are unbounded; supplied endpoints must be finite.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Interval
{
    readonly Min?: number;
    readonly Max?: number;
}

/**
 * Parent-axis limits, or continuous degree-channel limits for rotation. Rotation channels retain complete
 * turns and are not quaternion components or normalized Euler angles. Consumers choose their channel
 * origin at the edit's original orientation and retain it across resumed segments and mode changes.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface AxisBounds
{
    readonly x?: Interval;
    readonly y?: Interval;
    readonly z?: Interval;
}

/**
 * Actual parent-frame limits and optional changes measured from the whole edit's original transform.
 * Scale defaults to an actual minimum of 0.001 per axis; explicit axis minima may permit zero or negatives.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Bounds
{
    readonly Actual?: AxisBounds;
    readonly Change?: AxisBounds;
}

/**
 * Positive axis increments in blocks, degrees or scale units. Snapping precedes bounds enforcement.
 * Edit-relative origins refer to the whole edit, never the most recent drag segment.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Snap
{
    readonly Increment: Readonly<Vector3>;
    readonly Origin?: "absolute" | "edit";
}

/**
 * Per-mode limits and optional snapping. Omission disables snapping.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Channel
{
    readonly Bounds?: Bounds;
    readonly Snap?: Snap;
}

/**
 * Optional weighted motion. Disabled by omission. Inertia and strength are positive; damping and friction
 * are nonnegative. Release freezes by default; coast settles before review or automatic commit.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Physics
{
    readonly Inertia: number;
    readonly Strength: number;
    readonly Damping: number;
    readonly Friction: number;
    readonly Release?: "freeze" | "coast";
}

/**
 * Independent abandonment conditions. All simultaneous reasons are reported together.
 *
 * @category Model
 * @since 1.0.0
 */
export type AbandonmentReason = "timeout" | "distance" | "itemChange" | "death" | "disconnect" |
    "dimensionChange" | "targetInvalid" | "dispose" | "predicate";

/**
 * Transaction outcome; a conflict between simultaneous reason overrides resolves to cancel.
 *
 * @category Model
 * @since 1.0.0
 */
export type Outcome = "commit" | "cancel";

/**
 * Cancellation by default, with no timeout. Distance is in blocks; timeout is seconds. Invalid targets
 * cannot be recreated to honor a commit. Unavailable restoration receipts must remain recoverable.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Abandonment<Target>
{
    readonly Outcome?: Outcome;
    readonly Overrides?: Readonly<Partial<Record<AbandonmentReason, Outcome>>>;
    readonly TimeoutSeconds?: number;
    readonly Distance?: number;
    readonly Predicate?: (event: Event<Target>) => boolean;
}

/**
 * Synchronous lifecycle snapshot. Original survives mode changes and resumed drags; Current is the
 * provisional transform. RotationDegrees are continuous parent-frame channels; OriginalRotationDegrees
 * retains the whole edit's initial channels for relative-change constraints.
 * Player can be unavailable during recovery or disconnect. Reason and Reasons describe the transition;
 * all abandonment reasons are retained. Session is an opaque token for fencing stale callbacks.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Event<Target>
{
    readonly Original: Transform;
    readonly Current: Transform;
    readonly RotationDegrees: Readonly<Vector3>;
    readonly OriginalRotationDegrees: Readonly<Vector3>;
    readonly Player?: Player;
    readonly Target: Target;
    readonly Key: string;
    readonly Session: string;
    readonly Mode: Mode;
    readonly Handle?: Handle;
    readonly Reason: "input" | "release" | "confirm" | "cancel" | "recovery" | "abandonment";
    readonly Reasons: ReadonlyArray<AbandonmentReason>;
}

/**
 * Complete player-specific preview lifecycle. The actual target changes only on commit. Create and
 * Update must not mutate it; Dispose must release every private resource even after callback failures.
 * Shared preview instead applies provisional transforms through Adapter.Apply.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface PrivatePreview<Target>
{
    readonly Visibility: "private";
    readonly Create: (event: Event<Target>) => unknown;
    readonly Update: (preview: unknown, event: Event<Target>) => void;
    readonly Dispose: (preview: unknown) => void;
}

/**
 * Shared provisional changes visible through the real target adapter.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface SharedPreview
{
    readonly Visibility: "shared";
}

/**
 * Editor-only text request. The injected bridge creates one billboard TextPrimitive with depthTest false
 * and an explicit player visibility list; native experimental constructor/manager imports live in the
 * consumer bridge. No beta dependency is imposed on scalar controls or Bedform Common by this contract.
 *
 * @category Model
 * @since 1.0.0
 */
export interface TextRequest
{
    readonly Player: Player;
    readonly Position: Readonly<Vector3>;
    readonly Text: string;
    readonly DepthTest: false;
    readonly Billboard: true;
    readonly VisibleTo: ReadonlyArray<Player>;
}

/**
 * Structural presentation boundary wrapping the experimental text constructor and manager. Create
 * returns a resource token; Update and Dispose use that token. Implementations must be synchronous.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Presentation
{
    readonly Create: (request: TextRequest) => unknown;
    readonly Update: (text: unknown, request: TextRequest) => void;
    readonly Dispose: (text: unknown) => void;
}

/**
 * Item capability and local editing policies. Make copies/freezes policy data without invoking hooks.
 * Walking is locked by default. AllowWalking is recommended only for edits large relative to the player
 * and can feel slightly janky compared with holding position. Measurements default on; guides, cycling,
 * physics, snapping and confirmation review default off. Hooks and FormatText are synchronous.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Configuration<Target>
{
    readonly Id: string;
    readonly Items: ReadonlyArray<string>;
    readonly Modes: ReadonlyArray<Mode>;
    readonly Adapter: Adapter<Target>;
    readonly Eligible?: (player: Player, target: Target) => boolean;
    readonly InteractionRange?: number;
    readonly TargetingAngle?: number;
    readonly AllowOccluded?: boolean;
    readonly AllowWalking?: boolean;
    readonly Cycle?: boolean;
    readonly Translation?: Channel;
    readonly Rotation?: Channel;
    readonly Scale?: Channel;
    readonly Physics?: Physics;
    readonly Preview?: SharedPreview | PrivatePreview<Target>;
    readonly Review?: boolean;
    readonly Abandonment?: Abandonment<Target>;
    readonly Measurements?: boolean;
    readonly TranslationDecimals?: 0 | 1;
    readonly ScaleDecimals?: 0 | 1 | 2 | 3;
    readonly Size?: number;
    readonly HandleTolerance?: number;
    readonly Guides?: boolean;
    readonly FormatText?: (event: Event<Target>) => string;
    readonly OnPreview?: (event: Event<Target>) => void;
    readonly OnCommit?: (event: Event<Target>) => void;
    readonly OnCancel?: (event: Event<Target>) => void;
    readonly OnAbandonment?: (event: Event<Target>) => void;
}

/**
 * Reusable inert capability. InitialMode is the first configured mode; Modes retains authored order.
 * It is separate from scalar Diagetic.Kind and never reads or writes scalar control persistence.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Definition<Target>
{
    readonly Id: string;
    readonly Items: ReadonlyArray<string>;
    readonly Modes: ReadonlyArray<Mode>;
    readonly InitialMode: Mode;
    readonly Configuration: Readonly<Configuration<Target>>;
}

/**
 * Discovered target and validated body hit. Key identifies the underlying target, not a wrapper.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Candidate<Target>
{
    readonly Definition: Definition<Target>;
    readonly Target: Target;
    readonly Key: string;
    readonly Hit: BodyHit;
}

/**
 * Explicit registry dependencies. Heterogeneous definitions retain their own typed adapter callbacks.
 * Presentation is optional until a text-capable interaction driver is installed.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface StartOptions
{
    readonly Definitions: ReadonlyArray<Definition<any>>;
    readonly Presentation?: Presentation;
}

/**
 * Explicit discovery/recovery lifetime. No input subscriptions, player locks or transform writes are
 * installed by this foundation runtime. Later interaction drivers consume these capabilities.
 * Dispose is idempotent; Discover and Resolve throw after disposal. Resolve verifies the returned key
 * and validity and never invents a replacement target. Adapter exceptions propagate synchronously.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export interface Runtime
{
    readonly Definitions: StartOptions["Definitions"];
    readonly Presentation?: Presentation;
    readonly Disposed: boolean;
    readonly Dispose: () => void;
    readonly Discover: (item: string, query: Query) => ReadonlyArray<Candidate<unknown>>;
    readonly Resolve: (definition: string, key: string) => unknown | undefined;
}

/**
 * Creates a copied, frozen definition with validated defaults. Never invokes adapters or native APIs.
 *
 * @throws { TypeError } If identifiers, hooks, modes or private-preview lifecycle are incomplete.
 * @throws { RangeError } If numeric policies or bounds are invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Make = <Target>(configuration: Configuration<Target>): Definition<Target> =>
{
    return CreateDefinition(configuration);
};

/**
 * Registers definitions for explicit discovery and stable-key recovery without obtaining a native host.
 *
 * @throws { TypeError } If definitions, duplicate item capabilities or presentation hooks are invalid.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const Start = (options: StartOptions): Runtime =>
{
    return CreateRuntime(options);
};

/**
 * Copies a local transform into a deeply frozen snapshot, preserving quaternion sign and scale zeros.
 *
 * @throws { RangeError } If components are non-finite or orientation is not a unit quaternion.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Snapshot = (transform: Transform): Transform =>
{
    return SnapshotTransform(transform);
};

export namespace ItemComponents
{
    /**
     * Long held-use duration in seconds, allowing walking policy to be managed by the runtime.
     *
     * @category Configuration
     * @since 1.0.0
     */
    export interface MinecraftUseModifiers
    {
        readonly use_duration: number;
        readonly movement_modifier: 1;
        readonly start_using: "always";
    }
}

/**
 * Authored item component fragment; merge with the item's icon and other content components.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ItemComponents
{
    readonly "minecraft:use_modifiers": ItemComponents.MinecraftUseModifiers;
}

/**
 * Builds held-use item components, defaulting to one hour. This is content generation only; native
 * itemStartUse/itemStopUse subscription, repeat suppression and stale-release fencing belong to the
 * interaction driver. No custom item component registration is required by this fragment.
 *
 * @throws { RangeError } If duration is not finite and positive.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const UseComponents = (durationSeconds: number = 3_600): ItemComponents =>
{
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
    {
        throw new RangeError("Gizmo use duration must be finite and positive");
    }

    return Object.freeze({ "minecraft:use_modifiers": Object.freeze({ use_duration: durationSeconds,
        movement_modifier: 1 as const,
        start_using: "always" as const }) });
};
