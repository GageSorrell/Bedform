/**
 * Published storage, native adapters and typed reference handles remain game-safe and correctly inferred.
 *
 * @module bedform/Test/PrototypePersistence.types
 *
 * @file      PrototypePersistence.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Intentional negative assignments test public declarations. */
/* eslint-disable @typescript-eslint/typedef, @typescript-eslint/no-unused-vars, sort-keys */

import { Block, Entity, Persistence, References } from "bedform/Prototype";
import type { Block as NativeBlock, Entity as NativeEntity, World } from "@minecraft/server";
import type { Configuration } from "bedform/Prototype/Interaction";
import { DynamicProperty } from "bedform/Prototype/keys";
import type { Properties } from "bedform/Prototype/Persistence";
import type { Resolver } from "bedform/Prototype/References";

declare const NativeWorld: World;
declare const Configuration: Configuration;
const Port: Properties = NativeWorld;
const Resolver: Resolver = References.nativeResolver(NativeWorld);
const Handles = References.handles({ Input: Block,
    Display: Entity }, () => Configuration, Resolver,
{ Input: (block) => block.typeId === "minecraft:chest" });
const ResolvedBlock: NativeBlock | undefined = Handles.Input.Resolve();
const ResolvedEntity: NativeEntity | undefined = Handles.Display.Resolve();
// @ts-expect-error A block reference cannot be used as an entity reference.
const WrongKind: NativeEntity | undefined = Handles.Input.Resolve();
// @ts-expect-error Unknown reference names do not acquire handles.
void Handles.Other;
const Document = Persistence.load(Port);
const Captured: Persistence.Preview = Persistence.preview(Document, "demo");
const Job: Persistence.PlacementRecovery | undefined = Document.Placement;
const Count: number = Persistence.record(Document, "demo").SuccessfulCompletions;
Persistence.saveConfiguration(Port, { Id: "demo",
    Revision: 0,
    // @ts-expect-error Native objects are never stored as named binding descriptors.
    References: { Input: ResolvedBlock } });
// @ts-expect-error Generic demonstration data is not part of the stored envelope.
void Document.Data;
// @ts-expect-error Only successful/cancelled/failed settled outcomes can be recorded.
Persistence.recordOutcome(Port, "demo", 0, "Running");
const Key: typeof DynamicProperty.Manifest = DynamicProperty.Manifest;
