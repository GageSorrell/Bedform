/**
 * Typed quantities and unit conversions, ported from effect-units 1.0.1.
 *
 * Each effect-units module is a namespace here: `Unit.Length.meters(3)`,
 * `Unit.Quantity.per(distance, time)`, and `Unit.Unit` for the unit algebra
 * itself. A quantity stores its value in the base unit as a float, an
 * `@bedform/effect/Rational` or an `@bedform/effect/BigRational`, and every
 * constructor and converter accepts each of these, an `Int`, a `bigint` or a
 * `BigDecimal`; the `bigint` and `BigDecimal` arguments become `BigRational`s.
 * effect-units' `Exact` modules are merged into their float counterparts, and
 * its `Rational` module is `@bedform/effect/BigRational`. The `DateTime` interop
 * and arbitrary-generation annotations of effect-units are omitted, because
 * `@bedform/effect` does not provide those modules. `Unit.Meter`, also published
 * as `@bedform/effect/Unit/Meter`, is original to `@bedform/effect`: a branded
 * `number` of meters that Bedrock APIs accept directly.
 *
 * @module @bedform/effect/Unit
 *
 * @file      Unit.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

export * as Acceleration from "./Unit/Acceleration.js";
export * as Angle from "./Unit/Angle.js";
export * as AngularAcceleration from "./Unit/AngularAcceleration.js";
export * as AngularSpeed from "./Unit/AngularSpeed.js";
export * as Area from "./Unit/Area.js";
export * as Capacitance from "./Unit/Capacitance.js";
export * as Charge from "./Unit/Charge.js";
export * as Current from "./Unit/Current.js";
export * as Density from "./Unit/Density.js";
export * as Dimensionless from "./Unit/Dimensionless.js";
export * as Duration from "./Unit/Duration.js";
export * as Energy from "./Unit/Energy.js";
export * as Force from "./Unit/Force.js";
export * as Illuminance from "./Unit/Illuminance.js";
export * as Inductance from "./Unit/Inductance.js";
export * as Length from "./Unit/Length.js";
export * as Luminance from "./Unit/Luminance.js";
export * as LuminousFlux from "./Unit/LuminousFlux.js";
export * as LuminousIntensity from "./Unit/LuminousIntensity.js";
export * as Mass from "./Unit/Mass.js";
export * as Meter from "./Unit/Meter.js";
export * as Molarity from "./Unit/Molarity.js";
export * as Pixels from "./Unit/Pixels.js";
export * as Power from "./Unit/Power.js";
export * as Prefix from "./Unit/Prefix.js";
export * as Pressure from "./Unit/Pressure.js";
export * as Quantity from "./Unit/Quantity.js";
export * as Resistance from "./Unit/Resistance.js";
export * as SolidAngle from "./Unit/SolidAngle.js";
export * as Speed from "./Unit/Speed.js";
export * as SubstanceAmount from "./Unit/SubstanceAmount.js";
export * as Temperature from "./Unit/Temperature.js";
export * as Torque from "./Unit/Torque.js";
export * as Unit from "./Unit/Unit.js";
export * as Voltage from "./Unit/Voltage.js";
export * as Volume from "./Unit/Volume.js";
