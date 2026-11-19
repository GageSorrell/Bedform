/**
 * Packed catalog role inference, native static adapters and translated dropdown entry contracts.
 *
 * @module bedform/Test/PrototypeCatalog.types
 *
 * @file      PrototypeCatalog.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Negative fixtures retain contextual inference. */
/* eslint-disable @typescript-eslint/no-unused-vars, sort-keys */

import * as C from "bedform/Prototype/Structure/Catalog";
import type { BlockPermutation, BlockTypes } from "@minecraft/server";
import { Structure, StructureCatalog } from "bedform/Prototype";

declare const NativeTypes: typeof BlockTypes;
declare const NativePermutations: typeof BlockPermutation;
const Engine = C.nativeEngine(NativeTypes, NativePermutations);
const Floor = C.catalog("MainFloor", Engine);
const Material: Structure.Solid = Floor[0].Id;
// @ts-expect-error Floor choices cannot be pane identifiers.
const Pane: Structure.Pane = Floor[0].Id;
// @ts-expect-error Only the six material roles are valid.
C.catalog("Border", Engine);
const Control = C.dropdown("MainFloor", Structure.Defaults, Floor);
const Translation: string = Control.Items[0].label.translate;
const Index: number = Control.SelectedValue;
const Updated: Structure.Options = C.withChoice(Structure.Defaults, Control, Index);
const Qualified = StructureCatalog.qualify(Updated, Engine, { FloorY: 0,
    MinY: 0,
    MaxYExclusive: 100 });
const Version: 1 = Qualified.CatalogVersion as typeof C.CatalogVersion;
// @ts-expect-error Numeric values are transient dropdown inputs, not persisted material IDs.
C.withChoice(Updated, Control, "minecraft:iron_block");
const Message: { translate?: string } = Control.Items[0].label;
void [ Material, Translation, Qualified, Version, Message ];
