/**
 * Pure and host contract inference and exclusive physical-default checks.
 *
 * @module bedform/Test/Physics.types
 *
 * @file      Physics.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixture ordering groups mutually exclusive options. */
/* eslint-disable sort-keys */

import type { Config, Registration } from "bedform/Build";
import type { Interval, Renderer } from "bedform/PhysicsRenderer";
import type { MeshSolid, Model } from "bedform/PhysicsModel";
import type { CollisionShape } from "bedform/CollisionShape";
import type { Transform } from "bedform/Transform";

/**
 * Simultaneous mass and density are rejected by registration types.
 *
 * @category Tests
 * @since 1.0.0
 */
// @ts-expect-error Mass and density are mutually exclusive.
const Invalid: Registration = { name: "mesh",
    representation: "particle",
    meshSolid: "solid.json",
    rendererDescriptor: "renderer.json",
    mass: 1,
    density: 1 };
declare const Catalog: Model;
declare const Pose: Transform;
declare const Adapter: Renderer;
declare const Solid: MeshSolid;
declare const Configured: Config;
const Shape: CollisionShape = Catalog.collision;
const Interval: Interval = { start: Pose,
    end: Pose,
    duration: 0.05,
    sequence: 0,
    reset: 0,
    renderBase: Pose.position };
Adapter.attach(Catalog, "body", "overworld", Interval).dispose();

void [ Invalid, Solid, Configured, Shape ];
