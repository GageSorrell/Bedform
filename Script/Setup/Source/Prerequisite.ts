/**
 * Injectable prerequisite IO and immutable local-source installation plans.
 *
 * @module monorepo-setup/Prerequisite
 *
 * @file      Prerequisite.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Context, Effect } from "effect";
import type { ProcessCommand } from "./Contract.js";

/**
 * Explicit child environment, preserving the invoking account's tool locations.
 *
 * @category Model
 * @since 1.0.0
 */
export type ToolEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Captured probe output; nonzero status is an unusable tool, not an installation success.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ToolOutput {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

/**
 * Locally pinned download; archive prefixes are removed only after path validation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ToolArtifact {
    readonly url: string;
    readonly sha256?: string;
    readonly gitBlob?: string;
    readonly prefix?: string;
    readonly marker?: string;
}

/**
 * Declared Rust channel, components and targets from the local toolchain file.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface RustRequirement {
    readonly channel: string;
    readonly minimum: string;
    readonly profile: string;
    readonly components: ReadonlyArray<string>;
    readonly targets: ReadonlyArray<string>;
}

/**
 * A missing imported data file, never a replacement source checkout.
 *
 * @category Model
 * @since 1.0.0
 */
export interface SourceAsset {
    readonly path: string;
    readonly artifact: ToolArtifact;
}

/**
 * Installer policy maintained with the fork; runtime pins remain in their owning manifests.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface PrerequisitePolicy {
    readonly schemaVersion: number;
    readonly rustup: ToolArtifact;
    readonly nativeSource: ToolArtifact;
    readonly runtimeData: ToolArtifact;
    readonly winget: Readonly<Record<string, string>>;
    readonly visualStudioComponents: ReadonlyArray<string>;
    readonly encoder: string;
    readonly container: string;
}

/**
 * Fully validated local requirements, loaded before any installation or download.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface PrerequisitePlan {
    readonly rust: RustRequirement;
    readonly go: string;
    readonly cmake: string;
    readonly xmake: string;
    readonly loaderCommit: string;
    readonly sdkVersion: string;
    readonly policy: PrerequisitePolicy;
    readonly assets: ReadonlyArray<SourceAsset>;
    readonly vanilla: ToolArtifact;
    readonly vanillaDirectory: string;
}

/**
 * Filesystem, process probes and verified acquisition; normal tests replace every method.
 * Archive readiness measures actual cached bytes, never a trusted completion marker.
 *
 * @category Service
 * @since 1.0.0
 */
export const PrerequisiteHost = Context.Service<{
    readonly read: (path: string) => Effect.Effect<string, Error>;
    readonly exists: (path: string) => Effect.Effect<boolean, Error>;
    readonly hash: (path: string, kind: "sha256" | "gitBlob") => Effect.Effect<string, Error>;
    readonly write: (path: string, text: string) => Effect.Effect<void, Error>;
    readonly temporary: Effect.Effect<string, Error>;
    readonly cleanup: (path: string) => Effect.Effect<void, Error>;
    readonly capture: (command: ProcessCommand) => Effect.Effect<ToolOutput, Error>;
    readonly file: (artifact: ToolArtifact, path: string) => Effect.Effect<void, Error>;
    readonly archiveReady: (artifact: ToolArtifact, path: string) => Effect.Effect<boolean, Error>;
    readonly archive: (artifact: ToolArtifact, path: string) => Effect.Effect<void, Error>;
}>("monorepo-setup/PrerequisiteHost");
