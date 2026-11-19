/**
 * Published Gizmo import forms and developer-owned entity-part and block-object adapters.
 *
 * @module bedform/Test/Gizmo.types
 *
 * @file      Gizmo.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Contract fixtures preserve contextual inference and semantic ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as Direct from "bedform/Diagetic";
import * as G from "bedform/Diagetic/Gizmo";
import type { Entity, Vector3 } from "@minecraft/server";
import { Diagetic } from "bedform";

/**
 * Developer-owned part state, published through the add-on's authored entity properties or animations.
 *
 * @category Model
 * @since 1.0.0
 */
interface EntityPart
{
    readonly Entity: Entity;
    readonly Part: string;
    Local: G.Transform;
    Degrees: Readonly<Vector3>;
    readonly ParentFrame: G.Frame;
}

/**
 * Developer-owned object backed by a block, not a native scalable block transform.
 *
 * @category Model
 * @since 1.0.0
 */
interface BlockObject
{
    readonly Key: string;
    readonly Dimension: string;
    readonly Block: Readonly<Vector3>;
    Local: G.Transform;
    Degrees: Readonly<Vector3>;
}

declare const Parts: ReadonlyArray<EntityPart>;
declare const Objects: ReadonlyArray<BlockObject>;
declare const Identity: G.Frame;
declare const PartBodyHit: (part: EntityPart, query: G.Query) => G.BodyHit | undefined;
declare const ObjectBodyHit: (object: BlockObject, query: G.Query) => G.BodyHit | undefined;
declare const PublishPart: (part: EntityPart) => void;
declare const PublishObject: (object: BlockObject) => void;
declare const BlockStillPresent: (object: BlockObject) => boolean;

const PartAdapter: G.Adapter<EntityPart> = {
    Discover: () => Parts,
    Resolve: (key) => Parts.find((part) => `${part.Entity.id}/${part.Part}` === key),
    Key: (part) => `${part.Entity.id}/${part.Part}`,
    IsValid: (part) => part.Entity.isValid,
    HitTest: PartBodyHit,
    Read: (part) => part.Local,
    ReadDegrees: (part) => part.Degrees,
    Parent: (part) => part.ParentFrame,
    Apply: (part, transform, degrees) =>
    {
        part.Local = G.Snapshot(transform);
        part.Degrees = degrees;
        PublishPart(part);
    } };
const ObjectAdapter: G.Adapter<BlockObject> = {
    Discover: (query) => Objects.filter((object) => object.Dimension === query.Dimension),
    Resolve: (key) => Objects.find((object) => object.Key === key),
    Key: (object) => object.Key,
    IsValid: BlockStillPresent,
    HitTest: ObjectBodyHit,
    Read: (object) => object.Local,
    ReadDegrees: (object) => object.Degrees,
    Parent: () => Identity,
    Apply: (object, transform, degrees) =>
    {
        object.Local = G.Snapshot(transform);
        object.Degrees = degrees;
        PublishObject(object);
    } };

const PartDefinition = Diagetic.Gizmo.Make({ Id: "example:parts",
    Items: [ "example:part_wand" ],
    Modes: [ "rotation", "translation" ],
    Adapter: PartAdapter,
    OnPreview: (event) =>
    {
        const part: EntityPart = event.Target;
        void part;
    } });
const ObjectDefinition = Direct.Gizmo.Make({ Id: "example:objects",
    Items: [ "example:object_wand" ],
    Modes: [ "scale" ],
    Adapter: ObjectAdapter,
    Scale: { Bounds: { Actual: { x: { Min: 0 } } } },
    Preview: { Visibility: "private",
        Create: (event) => event.Key,
        Update: (_preview, event) =>
        {
            const object: BlockObject = event.Target;
            void object;
        },
        Dispose: (_preview) => {} } });
const Runtime: G.Runtime = G.Start({ Definitions: [ PartDefinition, ObjectDefinition ] });
const Components: G.ItemComponents = G.UseComponents();
const Recovered: unknown = Runtime.Resolve(PartDefinition.Id, "saved-entity-id/part");
declare const View: G.Geometry.Ray;
const Handles = G.Geometry.Build({ Transform: Objects[0].Local,
    Parent: Identity,
    View,
    Mode: "translation" });
const Hover: G.Geometry.Pick | undefined = G.Geometry.Pick(Handles, View);
const Drag: G.Geometry.Drag = G.Geometry.Begin(Handles, "x", View, Objects[0].Degrees);
const Projected: G.Transform = Drag.Sample(View).Transform;
// @ts-expect-error Gizmo is deliberately separate from scalar kinds.
const ScalarKind: Direct.Kind = "gizmo";
// @ts-expect-error Private previews require all three lifecycle hooks.
const IncompletePreview: G.PrivatePreview<EntityPart> = { Visibility: "private",
    Create: () => "token" };
// @ts-expect-error Unsupported modes cannot be enabled.
const UnsupportedMode: G.Mode = "worldRotation";
void [ Components, Recovered, Hover, Projected, ScalarKind, IncompletePreview, UnsupportedMode ];
