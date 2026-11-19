/**
 * Session-only Canvas Intent runtime configuration and immutable renderer-facing snapshots.
 *
 * @module bedform-canvas/Script/IntentTypes
 *
 * @file      IntentTypes.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Definition, ResolvedOptions } from "../../../Package/Bedform/Source/Spatial/Intent.js";
import type { Dimension, Entity, System, Vector3, World } from "@minecraft/server";

/**
 * Explicit native adapters. Death and player disconnect clear immediately. Native entityRemove
 * notifications also fire for chunk unloads and carry no reason, so they never clear: the subject is
 * suspended and resumes when it reloads. A permanently removed subject's dormant record ends on
 * expiry, Clear, owner disposal, Retire or restart. Diagnostic callback failures are isolated.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Configuration
{
    readonly World: World;
    readonly System: System;
    readonly OnError?: (error: Error) => void;
}

/**
 * Current native subject view, available only while reads succeed in its current dimension.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Subject
{
    readonly Entity: Entity;
    readonly Dimension: Dimension;
    readonly Head: Readonly<Vector3>;
}

/**
 * One current accepted Intent. Generation fences renderer cleanup; StartedTick and ElapsedTicks
 * preserve animation time across reloads and dimension transfers. Subject is absent when unloaded
 * or temporarily unreadable; elapsed duration continues while presentation is suspended.
 *
 * @category Model
 * @since 1.0.0
 */
export interface State
{
    readonly EntityId: string;
    readonly ClientId: string;
    readonly ConnectionId: string;
    readonly RequestId: number;
    readonly Generation: number;
    readonly Intent: Definition;
    readonly Options: ResolvedOptions;
    readonly StartedTick: number;
    readonly ElapsedTicks: number;
    readonly ExpiresAt: number | null;
    readonly Subject?: Subject;
}

/**
 * Shared service lifetime and observation boundary, independent of any renderer or persistent VM.
 * Retire is for confirmed permanent removal, never for an ambiguous native unload notification.
 * Dispose stops the service, clears all session memory and releases its subscriptions and ticker.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export interface Handle
{
    readonly Snapshot: () => ReadonlyArray<State>;
    readonly Retire: (entityId: string) => void;
    readonly Dispose: () => void;
}
