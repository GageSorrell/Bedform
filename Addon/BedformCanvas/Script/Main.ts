/**
 * Canvas pack script entry: starts shared session-only Intent arbitration and private rendering.
 *
 * @module bedform-canvas/Script/Main
 *
 * @file      Main.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { MolangVariableMap, TextPrimitive, system, world } from "@minecraft/server";
import type { DimensionLocation } from "@minecraft/server";
import { Start as Render } from "./IntentRenderer.js";
import { Start } from "./IntentRuntime.js";

const Runtime = Start({ OnError: (error: Error): void => console.warn(`[BedformCanvas] ${error.message}`),
    System: system,
    World: world });

Render({ CreateText: (location: DimensionLocation, text: string): TextPrimitive =>
    new TextPrimitive(location, text),
CreateVariables: () => new MolangVariableMap(),
OnError: (error: Error): void => console.warn(`[BedformCanvas] ${error.message}`),
Snapshot: Runtime.Snapshot,
System: system,
World: world });
