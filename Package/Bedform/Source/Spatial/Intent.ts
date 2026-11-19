/**
 * Inert Intent definitions, glyph validation and explicitly started Canvas connections.
 *
 * @module bedform/Spatial/Intent
 *
 * @file      Intent.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Entity, System, Vector3, World } from "@minecraft/server";
import { CheckDefinition } from "./Internal/IntentValue.js";
import { Client } from "./Internal/IntentClient.js";
import type { ImageDescriptor } from "../Canvas/Image.js";

/**
 * Shared compiler-produced images, also consumed by other Canvas features.
 *
 * @category Model
 * @since 1.0.0
 */
export type { ImageDescriptor } from "../Canvas/Image.js";

/**
 * Complete named built-in artwork family; definitions do not start rendering or allocate glyphs.
 *
 * @category Model
 * @since 1.0.0
 */
export type BuiltinName = "interrogative" | "exclamatory" | "exclamatory-interrogative" |
    "thinking" | "sos" | "sleep" | "affirmative" | "negative" | "knowledgeable" | "affectionate" |
    "hunger" | "arrow-up" | "arrow-up-right" | "arrow-right" | "arrow-down-right" | "arrow-down" |
    "arrow-down-left" | "arrow-left" | "arrow-up-left";

/**
 * An immutable reference to one shared built-in icon or animation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface BuiltinDefinition
{
    readonly Kind: "builtin";
    readonly Name: BuiltinName;
}

/**
 * Optional logical-pixel overrides for one-to-three PUA glyphs. Advances contains one positive
 * value per character. Omitted fields use Canvas's registered metrics or the runtime font fallback;
 * this client does not guess the measured widths of third-party glyphs.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface GlyphMetrics
{
    readonly Advances?: ReadonlyArray<number>;
    readonly Height?: number;
}

/**
 * One-to-three BMP private-use glyphs. Canvas font ink is baked dark gray; third-party fonts retain
 * their authored colors. Glyph intent does not recolor a custom font page.
 *
 * @category Model
 * @since 1.0.0
 */
export interface GlyphDefinition
{
    readonly Kind: "glyphs";
    readonly Text: string;
    readonly Metrics?: GlyphMetrics;
}

/**
 * Built-in artwork, PUA text or a shared generated image descriptor.
 *
 * @category Model
 * @since 1.0.0
 */
export type Definition = BuiltinDefinition | GlyphDefinition | ImageDescriptor;

/**
 * Presentation overrides. DurationTicks is a positive integer; omission lasts until replacement,
 * clear or subject lifecycle cleanup. Offset is the pointer tip's displacement from the current
 * head position, in world-axis blocks. Scale and MaxDistance must be positive finite values.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Options
{
    readonly DurationTicks?: number;
    readonly Scale?: number;
    readonly Offset?: Readonly<Vector3>;
    readonly MaxDistance?: number;
}

/**
 * Complete transport options; null duration means indefinite. Default pointer offset is 0.25 blocks
 * above the head, scale is 1 and viewing range is 32 blocks.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ResolvedOptions
{
    readonly DurationTicks: number | null;
    readonly Scale: number;
    readonly Offset: Readonly<Vector3>;
    readonly MaxDistance: number;
}

/**
 * Native adapters are supplied explicitly. Id is a unique namespaced add-on ID, at most 64 ASCII
 * characters. OnError observes transport/runtime failures; callback exceptions are isolated.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Configuration
{
    readonly Id: string;
    readonly World: World;
    readonly System: System;
    readonly OnError?: (error: Error) => void;
}

/**
 * A session-only request connection. Set/Clear resolve when Canvas accepts the request, not when
 * clients render it. Dispose immediately forbids new work, rejects outstanding operations and
 * releases local resources after confirmed cleanup or a bounded failure; repeated calls share its
 * promise. A lost mutation acknowledgement means acceptance is unknown, so mutations are not retried.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Connection
{
    readonly Set: (entity: Entity, intent: Definition, options?: Options) => Promise<void>;
    readonly Clear: (entity: Entity) => Promise<void>;
    readonly Dispose: () => Promise<void>;
}

/**
 * Creates an immutable built-in reference without contacting Canvas.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Preset(name: BuiltinName): BuiltinDefinition
{
    return Object.freeze({ Kind: "builtin",
        Name: name });
}

/**
 * Every shared Intent preset, including eight screen-relative arrow directions.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Builtin = Object.freeze({
    Affectionate: Preset("affectionate"),
    Affirmative: Preset("affirmative"),
    ArrowDown: Preset("arrow-down"),
    ArrowDownLeft: Preset("arrow-down-left"),
    ArrowDownRight: Preset("arrow-down-right"),
    ArrowLeft: Preset("arrow-left"),
    ArrowRight: Preset("arrow-right"),
    ArrowUp: Preset("arrow-up"),
    ArrowUpLeft: Preset("arrow-up-left"),
    ArrowUpRight: Preset("arrow-up-right"),
    Exclamatory: Preset("exclamatory"),
    ExclamatoryInterrogative: Preset("exclamatory-interrogative"),
    Hunger: Preset("hunger"),
    Interrogative: Preset("interrogative"),
    Knowledgeable: Preset("knowledgeable"),
    Negative: Preset("negative"),
    SOS: Preset("sos"),
    Sleep: Preset("sleep"),
    Thinking: Preset("thinking")
});

/**
 * Validates and snapshots one-to-three BMP PUA glyphs and optional logical-pixel metrics.
 *
 * @throws { TypeError } If text, advances or height are invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Glyphs(text: string, metrics?: GlyphMetrics): GlyphDefinition
{
    return CheckDefinition({ Kind: "glyphs",
        Metrics: metrics,
        Text: text }) as GlyphDefinition;
}

/**
 * Starts one explicitly owned transport connection, deferring the first handshake to a native tick.
 * Missing or incompatible Canvas Intent runtimes reject operations with actionable errors.
 *
 * @throws { TypeError } If configuration is invalid or native transport adapters are missing.
 * @throws { Error } If subscription or initial scheduling fails, or Id is already active locally.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export function Start(configuration: Configuration): Connection
{
    return new Client(configuration);
}
