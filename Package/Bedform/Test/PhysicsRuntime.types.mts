/**
 * Explicit host/runtime declarations and functional body-operation inference.
 *
 * @module bedform/Test/PhysicsRuntime.types
 *
 * @file      PhysicsRuntime.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Body from "bedform/PhysicsEntity";
import type * as Physics from "bedform/PhysicsRuntime";
import type * as R from "@bedform/effect/Result";
import * as V from "bedform/Vector3";

declare const Runtime: Physics.Runtime;
declare const Native: Physics.Native;
const Updated: R.Result<void, Physics.Diagnostic> = Runtime.update("body", Body.applyImpulse(V.UnitX));
const Unregister: () => void = Runtime.registerTerrain((
    block: Physics.Block,
    neighbor: Parameters<Physics.Resolver>[1]) =>
{
    void neighbor(0, 0, 1);
    return block.identifier === "example:empty" ? [] : undefined;
});
Native.impulse(V.One);
// @ts-expect-error Host snapshots do not expose mutable native collision bounds.
Native.bounds.min.x = 1;
// @ts-expect-error Body updates must retain the typed Result boundary.
Runtime.update("body", () => undefined);
void [ Updated, Unregister ];
