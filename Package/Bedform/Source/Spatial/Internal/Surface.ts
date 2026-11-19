/**
 * Backend-independent committed trees and per-viewer surface leases for spatial React roots.
 *
 * @module bedform/Spatial/Internal/Surface
 *
 * @file      Surface.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { NativeConstructors, System, Viewer, World } from "../Renderer.js";
import type { Result } from "../Layout.js";

/**
 * Committed host descriptor. Identity survives keyed moves. Props retain opaque consumer values;
 * descriptors, prop records and child arrays are frozen. Hidden propagates through descendants.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Node {
    readonly Id: number;
    readonly Type: string;
    readonly Props: Readonly<Record<string, unknown>>;
    readonly Children: ReadonlyArray<Node>;
    readonly Hidden: boolean;
    readonly Text?: string;
}

/**
 * One coherent committed revision, reused by identity until React commits again.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Frame {
    readonly Revision: number;
    readonly Nodes: ReadonlyArray<Node>;
    readonly Layout?: Result;
}

/**
 * A single eligible player session and explicitly injected native services. Own registers cleanup
 * before allocation continues; registrations are released on factory failure, audience removal or
 * unmount even if the surface's own Dispose throws. The returned release function is idempotent.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export interface Context {
    readonly RootId: number;
    readonly Viewer: Viewer;
    readonly World: World;
    readonly System: System;
    readonly Native: NativeConstructors;
    readonly Own: (cleanup: () => void) => () => void;
}

/**
 * A private presentation lease for exactly Context.Viewer. Commit replaces the whole frame; Update
 * refreshes it on each runtime tick. Hidden nodes must not draw or accept input. Dispose stops all
 * refresh/input and releases owned native resources. No empty audience may become public visibility.
 * Particle and future cuboid backends implement this same contract; no backend is selected implicitly.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Surface {
    readonly Commit: (frame: Frame) => void;
    readonly Update: () => void;
    readonly Dispose: () => void;
}

/**
 * Creates isolated per-viewer surfaces. Optional render validators are pure, may be retried or
 * abandoned, and throw into React error boundaries before any native allocation. Layout, text
 * ancestry rules and concrete drawing belong to the selected backend and component layer.
 *
 * @category Factory
 * @since 1.0.0
 */
export interface Factory {
    readonly CustomHost?: boolean;
    readonly Create: (context: Context) => Surface;
    readonly Validate?: (type: string, props: Readonly<Record<string, unknown>>,
        ancestors: ReadonlyArray<string>) => void;
    readonly ValidateText?: (text: string, ancestors: ReadonlyArray<string>) => void;
}
