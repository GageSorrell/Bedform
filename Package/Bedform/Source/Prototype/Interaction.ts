/**
 * Game-safe configuration and cooperative execution contracts for prototype worlds.
 *
 * @module bedform/Prototype/Interaction
 *
 * @file      Interaction.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Vector2, Vector3 } from "@minecraft/server";

/**
 * Dimension-qualified bounds; Min is inclusive and Max is exclusive on all axes.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Bounds
{
    readonly Dimension: string;
    readonly Min: Vector3;
    readonly Max: Vector3;
}

/**
 * Saved teleport position and native degree rotation, independent of object lifetime.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Pose
{
    readonly Dimension: string;
    readonly Position: Vector3;
    readonly Rotation: Vector2;
}

/**
 * Persistable block binding, resolved anew when used rather than retaining native handles.
 *
 * @category Types
 * @since 1.0.0
 */
export interface BlockBinding
{
    readonly Kind: "Block";
    readonly Dimension: string;
    readonly Position: Vector3;
}

/**
 * Persistable non-player, non-item entity identity; runtime binding must enforce exclusions.
 *
 * @category Types
 * @since 1.0.0
 */
export interface EntityBinding
{
    readonly Kind: "Entity";
    readonly Dimension: string;
    readonly Id: string;
    readonly Removed?: boolean;
}

/**
 * Editor configuration keyed by the stable demonstration identifier.
 * Missing fields represent incomplete setup, not invented defaults.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Configuration
{
    readonly Id: string;
    readonly Revision: number;
    readonly Bounds?: Bounds;
    readonly Arrival?: Pose;
    readonly Trigger?: BlockBinding;
    readonly References: Readonly<Record<string, BlockBinding | EntityBinding>>;
}

/**
 * Shared world configuration visible to callbacks, including archived declarations.
 *
 * @category Types
 * @since 1.0.0
 */
export interface WorldConfiguration
{
    readonly Editing: boolean;
    readonly Home?: Pose;
    readonly Demonstrations: Readonly<Record<string, Configuration>>;
}

/**
 * Bedrock-compatible cooperative cancellation; listeners are called once and return an unsubscribe thunk.
 * ThrowIfRequested raises the runtime cancellation error after a request.
 *
 * @category Types
 * @since 1.0.0
 */
export interface CancellationToken
{
    readonly IsCancellationRequested: boolean;
    readonly Subscribe: (listener: () => void) => () => void;
    readonly ThrowIfRequested: () => void;
}
