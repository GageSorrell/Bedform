/**
 * Functional body/world overloads, exclusive mass inputs and shared motion declarations.
 *
 * @module bedform/Test/PhysicsDynamics.types
 *
 * @file      PhysicsDynamics.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as E from "bedform/PhysicsEntity";
import type * as O from "@bedform/effect/Option";
import type * as R from "@bedform/effect/Result";
import type * as RT from "bedform/RigidTransform";
import * as V from "bedform/Vector3";
import * as W from "bedform/PhysicsWorld";

declare const Body: E.PhysicsEntity;
declare const World: W.PhysicsWorld;
const Direct: R.Result<E.PhysicsEntity, E.PhysicsError> = E.applyImpulse(Body, V.UnitX, V.UnitY);
const Curried: R.Result<E.PhysicsEntity, E.PhysicsError> = E.applyForce(V.UnitX, V.UnitY)(Body);
const Updated = Body.pipe(E.configure({ mass: 2 }));
const Added: R.Result<W.PhysicsWorld, W.PhysicsError> = World.pipe(W.add(Body));
const Lookup: R.Result<O.Option<E.PhysicsEntity>, W.PhysicsError> = W.get("body")(World);
const Modified: R.Result<W.PhysicsWorld, W.PhysicsError> =
    W.modify("body", E.setLinearVelocity(V.Zero))(World);
const Motion: RT.RigidTransform = E.motion(Body);
// @ts-expect-error Mass and density are mutually exclusive.
const Invalid: E.Options = { density: 1,
    id: "invalid",
    mass: 1 };
// @ts-expect-error Friction is fixed, not publicly configurable.
E.configure(Body, { friction: 0 });
// @ts-expect-error Authoritative snapshots are immutable.
Body.linearVelocity.x = 5;

void [ Direct, Curried, Updated, Added, Lookup, Modified, Motion, Invalid ];
