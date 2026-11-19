/**
 * Pure collision query, continuous trajectory and broad-phase declaration checks.
 *
 * @module bedform/Test/Collision.types
 *
 * @file      Collision.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixture input order follows the public overloads. */

import type * as B from "bedform/AABB";
import * as C from "bedform/Collision";
import type * as O from "@bedform/effect/Option";
import * as P from "bedform/CollisionBroadPhase";
import type * as R from "@bedform/effect/Result";

declare const Instance: C.Instance;
declare const Motion: C.Motion;
declare const Tree: P.Tree;
declare const Entry: P.Entry;
const Direct: R.Result<C.Distance, C.Diagnostic> = C.distance(Instance, Instance);
const Curried: R.Result<ReadonlyArray<C.Manifold>, C.Diagnostic> = C.collide(Instance, {})(Instance);
const Hit: R.Result<O.Option<C.Hit>, C.Diagnostic> = C.sweep(Motion, 1)(Motion);
const Swept: R.Result<B.AABB, C.Diagnostic> = C.sweptBounds(1)(Motion);
const Pairs: R.Result<ReadonlyArray<P.Pair>, C.Diagnostic> = P.pairs(100, 1_000)(Tree);
P.set(Entry)(Tree);
P.remove("body")(Tree);
P.query(Entry.bounds)(Tree);
// @ts-expect-error Authoritative snapshots are immutable.
Instance.shape.radius = 1;
// @ts-expect-error CCD requires motion, not a presentation interval or a pose alone.
C.sweep(Instance, Instance, 1);
void [ Direct, Curried, Hit, Swept, Pairs ];
