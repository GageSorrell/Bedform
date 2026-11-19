/**
 * Public prototype inference, nominal variance, reference kinds and structure role contracts.
 *
 * @module bedform/Test/Prototype.types
 *
 * @file      Prototype.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Contextual inference and negative assignments are intentional type fixtures. */
/* eslint-disable @typescript-eslint/typedef, @typescript-eslint/no-unused-vars, sort-imports, sort-keys, @stylistic/max-len */

import { Demonstration, Ready, NotReady, InProgress, Block, Entity, World, Structure } from "bedform/Prototype";
import type * as D from "bedform/Prototype/Demonstration";
import type * as Interaction from "bedform/Prototype/Interaction";
import type * as Host from "bedform/Prototype/World/Host";
import type * as DirectStructure from "bedform/Prototype/Structure";

const Static = Demonstration({ Id: "static",
    Name: "Static",
    Description: "",
    GetState: () => ({ Status: Ready }) });
const NoData: D.State = { Status: Ready };
// @ts-expect-error State<never> has no Data property.
void NoData.Data;
// @ts-expect-error Non-never data is required.
const MissingData: D.State<number> = { Status: Ready };
const UndefinedData: D.State<undefined> = { Status: Ready,
    Data: undefined };
// @ts-expect-error Even undefined must be supplied explicitly.
const MissingUndefined: D.State<undefined> = { Status: Ready };
const UnionData: D.State<number | string> = { Status: NotReady,
    Data: "missing" };
const WithData = Demonstration({
    Id: "machine",
    Name: "Machine",
    Description: "Processes a charge",
    References: { Input: Block,
        Display: Entity },
    Validators: {
        Input: (block) => block.typeId === "minecraft:chest",
        Display: (entity) => entity.typeId !== "minecraft:player"
    },
    GetState: (context) => ({ Status: Ready,
        Data: context.References.Input.Resolve()?.typeId ?? "" }),
    CanStart: (context) => context.State.Data.length > 0 && context.Registry.RunningCount === 0,
    Run: async (context) =>
    {
        const Data: string = context.State.Data;
        context.Cancellation.ThrowIfRequested();
        context.References.Input.Resolve()?.getComponent("minecraft:inventory");
        const unsubscribe = context.Cancellation.Subscribe(() => {});
        unsubscribe();
        void Data;
    },
    OnStart: (context) => { void context.Configuration.Editing; },
    OnCancel: async (context) => { void context.Player.id; },
    OnCleanup: (context) => { void context.Registry.Entries.get("static")?.CompletionCount; },
    GetActionBar: (context) => [ context.State.Data, context.Player.name ],
    IsViewing: (context) => context.Player.dimension.id === "minecraft:overworld"
});
const Inferred: D.Demonstration<string, { readonly Input: typeof Block;
    readonly Display: typeof Entity }> = WithData;
// @ts-expect-error Generic data is invariant, rather than widening through the brand.
const Widened: D.Demonstration<unknown, { readonly Input: typeof Block;
    readonly Display: typeof Entity }> = WithData;
Demonstration({ Id: "bad",
    Name: "Bad",
    Description: "",
    // @ts-expect-error Runtime-owned statuses cannot be returned from authored getters.
    GetState: () => ({ Status: InProgress }) });
// @ts-expect-error A definition must pass through the nominal constructor.
const Unbranded: D.Demonstration = { Id: "bad",
    Name: "Bad",
    Description: "",
    GetState: () => ({ Status: Ready }) };
// @ts-expect-error Static scenes cannot declare cleanup without a run.
Demonstration({ Id: "bad",
    Name: "Bad",
    Description: "",
    GetState: () => ({ Status: Ready }),
    OnCleanup: () => {} });
Demonstration({ Id: "bad",
    Name: "Bad",
    Description: "",
    GetState: () => ({ Status: Ready }),
    // @ts-expect-error Run must be asynchronous.
    Run: () => {} });
Demonstration({ Id: "bad",
    Name: "Bad",
    Description: "",
    // @ts-expect-error State getters are synchronous.
    GetState: async () => ({ Status: Ready }) });
Demonstration({ Id: "bad",
    Name: "Bad",
    Description: "",
    GetState: () => ({ Status: Ready }),
    // @ts-expect-error Reference maps accept only the exported symbols.
    References: { Chest: "Block" } });
const ReferenceValidators: D.ReferenceValidators<{ Chest: typeof Block }> = {
    Chest: (block) =>
    {
        // @ts-expect-error Block validators cannot treat their argument as an entity.
        block.teleport({ x: 0,
            y: 0,
            z: 0 });
        return true;
    },
    // @ts-expect-error Undeclared references cannot have validators.
    Other: () => true
};
const DemoWorld = World.World({ Demonstrations: [ Static, WithData ] });
const Updated = World.withMainInventory(World.withHotbarInventory(DemoWorld, []), []);
const Full = World.withInventory(Updated, []);
const Ordered: typeof WithData = Full.Demonstrations[1];
const Settings: DirectStructure.Options = Structure.Defaults;
const DefaultSize: "Medium" = Structure.Defaults.Size;
const SmallInterior: 7 = Structure.Presets.Small.InteriorSize;
const LargeBorder: 27 = Structure.Presets.Large.BorderedSize;
const Options: Structure.Options = { ...Settings,
    IncludeMainCeiling: true,
    InteriorHeight: 8,
    Materials: { ...Settings.Materials,
        MainWalls: "minecraft:glass_pane",
        MainCeiling: "minecraft:quartz_slab" } };
const BadFloor: Structure.Materials = { ...Settings.Materials,
    // @ts-expect-error Pane flooring is not in the floor catalog.
    MainFloor: "minecraft:glass_pane" };
const BadWall: Structure.Materials = { ...Settings.Materials,
    // @ts-expect-error Slab walls are unsupported.
    MainWalls: "minecraft:quartz_slab" };
const BadCeiling: Structure.Materials = { ...Settings.Materials,
    // @ts-expect-error Panes are not ceiling materials.
    EntranceCeiling: "minecraft:glass_pane" };
const Unknown: Structure.Materials = { ...Settings.Materials,
    // @ts-expect-error Custom identifiers are not in the initial catalogs.
    EntranceWall: "addon:wall" };
const Gold: Structure.Materials = { ...Settings.Materials,
    // @ts-expect-error Forbidden stable blocks are also excluded.
    MainFloor: "minecraft:gold_block" };
const Saved: Structure.SavedOptions = { DemonstrationId: "machine",
    Revision: 1,
    Options };
// @ts-expect-error Saved authoring options are not a successful placed recipe.
const NotPlaced: Structure.PlacedRecipe = Saved;
declare const Placement: Structure.Placement;
const ClearColumns: ReadonlyArray<Structure.Cell> = Placement.Layout.ClearanceColumns;
declare const Configuration: Interaction.Configuration;
declare const HostService: Host.Service;
