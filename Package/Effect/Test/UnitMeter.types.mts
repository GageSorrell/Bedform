/**
 * Declaration checks for the `Unit/Meter` brand: plain numbers are rejected,
 * and `Meter<Int>` widens to `number`, `Int` and Bedrock `Vector3` components.
 *
 * @module @bedform/effect/Test/UnitMeter.types
 *
 * @file      UnitMeter.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Type fixtures exist only to be checked, one per line. */
/* eslint-disable @typescript-eslint/no-unused-vars */

import * as Int from "@bedform/effect/Int";
import * as Meter from "@bedform/effect/Unit/Meter";
import type * as Option from "@bedform/effect/Option";
import * as Schema from "@bedform/effect/Schema";
import * as Unit from "@bedform/effect/Unit";
import type { Vector3 } from "@minecraft/server";

const Whole: Meter.Meter<Int.Int> = Meter.fromInt(Int.makeUnsafe(3));
const Fractional: Meter.Meter = Meter.makeUnsafe(0.0625);
const AsNumber: number = Whole;
const AsInt: Int.Int = Whole;
const AsMeter: Meter.Meter = Whole;
const FractionalNumber: number = Fractional;
const Corner: Vector3 = {
    x: Whole,
    y: Fractional,
    z: Meter.fromInt(Int.makeUnsafe(-2))
};
const Component: Vector3["x"] = Whole;
const Namespaced: Unit.Meter.Meter<Int.Int> = Whole;
const Floored: Option.Option<Meter.Meter<Int.Int>> = Meter.makeInt(2.5);
const Maybe: Option.Option<Meter.Meter> = Meter.make(2.5);
const FromLength: Meter.Meter = Meter.fromLength(Unit.Length.feet(3n));
const ToLength: Unit.Length.Length = Meter.toLength(Fractional);
const Decoded: Meter.Meter = Schema.decodeUnknownSync(Meter.Meter)(1.5);
const Encoded: number = Schema.encodeSync(Meter.Meter)(Whole);
// @ts-expect-error A plain number is not a Meter.
const Plain: Meter.Meter = 3;
// @ts-expect-error A plain Int is not a Meter.
const PlainInt: Meter.Meter<Int.Int> = Int.makeUnsafe(3);
// @ts-expect-error A fractional Meter is not a whole Meter.
const NotWhole: Meter.Meter<Int.Int> = Fractional;
// @ts-expect-error A fractional Meter is not an Int.
const NotInt: Int.Int = Fractional;
// @ts-expect-error A Length quantity is not a Meter.
const NotQuantity: Meter.Meter = Unit.Length.meters(1);
// @ts-expect-error toLength takes a Meter, not a plain number.
const PlainToLength: Unit.Length.Length = Meter.toLength(1);
// @ts-expect-error The Bedrock Vector3 type resolved, so its components are numbers.
const NotComponent: Vector3["x"] = "1";
