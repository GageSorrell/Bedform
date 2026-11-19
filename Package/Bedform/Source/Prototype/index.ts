/**
 * Development-only prototype authoring. Import Host explicitly for host tooling contracts.
 * Production import enforcement belongs to the development build pipeline.
 *
 * @module bedform/Prototype/index
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

export { Demonstration, Ready, InProgress, NotReady, Stopping,
    Block, Entity, TypeId, isBindableEntity } from "./Demonstration.js";
export type { State, IdleState, Context, RunContext, ViewContext, Registry, RegistryEntry,
    ReferenceMap, ReferenceHandle, ReferenceHandles, ReferenceValidators } from "./Demonstration.js";
export * as World from "./World.js";
export * as Interaction from "./Interaction.js";
export * as Structure from "./Structure.js";

export * as Persistence from "./Persistence.js";
export * as References from "./References.js";

export * as StructureCatalog from "./Structure/Catalog.js";
