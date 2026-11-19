/**
 * Declaration inference for numeric primitives through public package exports.
 *
 * @module @bedform/effect/Test/Number.types
 *
 * @file      Number.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Numeric fixtures retain inference and explicit boundary ordering. */
/* eslint-disable @typescript-eslint/no-unused-vars */

import * as N from "@bedform/effect/Number";
import { Number as RootNumber } from "@bedform/effect";
import { pipe } from "@bedform/effect/Function";

const AbsDirect: number = N.abs(2);
const AbsCurried: number = N.abs()(2);
const AbsPiped: number = pipe(2, N.abs);
const AbsRoot: number = RootNumber.abs(2);
const AbsCurriedPipe: number = pipe(2, N.abs());
// @ts-expect-error Numeric operations reject string operands.
N.abs("2");

const NegateDirect: number = N.negate(2);
const NegateCurried: number = N.negate()(2);
const NegatePiped: number = pipe(2, N.negate);
const NegateRoot: number = RootNumber.negate(2);
const NegateCurriedPipe: number = pipe(2, N.negate());
// @ts-expect-error Numeric operations reject string operands.
N.negate("2");

const SqrtDirect: number = N.sqrt(2);
const SqrtCurried: number = N.sqrt()(2);
const SqrtPiped: number = pipe(2, N.sqrt);
const SqrtRoot: number = RootNumber.sqrt(2);
const SqrtCurriedPipe: number = pipe(2, N.sqrt());
// @ts-expect-error Numeric operations reject string operands.
N.sqrt("2");

const SinDirect: number = N.sin(2);
const SinCurried: number = N.sin()(2);
const SinPiped: number = pipe(2, N.sin);
const SinRoot: number = RootNumber.sin(2);
const SinCurriedPipe: number = pipe(2, N.sin());
// @ts-expect-error Numeric operations reject string operands.
N.sin("2");

const CosDirect: number = N.cos(2);
const CosCurried: number = N.cos()(2);
const CosPiped: number = pipe(2, N.cos);
const CosRoot: number = RootNumber.cos(2);
const CosCurriedPipe: number = pipe(2, N.cos());
// @ts-expect-error Numeric operations reject string operands.
N.cos("2");

const AsinDirect: number = N.asin(2);
const AsinCurried: number = N.asin()(2);
const AsinPiped: number = pipe(2, N.asin);
const AsinRoot: number = RootNumber.asin(2);
const AsinCurriedPipe: number = pipe(2, N.asin());
// @ts-expect-error Numeric operations reject string operands.
N.asin("2");

const AcosDirect: number = N.acos(2);
const AcosCurried: number = N.acos()(2);
const AcosPiped: number = pipe(2, N.acos);
const AcosRoot: number = RootNumber.acos(2);
const AcosCurriedPipe: number = pipe(2, N.acos());
// @ts-expect-error Numeric operations reject string operands.
N.acos("2");

const FloorDirect: number = N.floor(2);
const FloorCurried: number = N.floor()(2);
const FloorPiped: number = pipe(2, N.floor);
const FloorRoot: number = RootNumber.floor(2);
const FloorCurriedPipe: number = pipe(2, N.floor());
// @ts-expect-error Numeric operations reject string operands.
N.floor("2");

const CeilDirect: number = N.ceil(2);
const CeilCurried: number = N.ceil()(2);
const CeilPiped: number = pipe(2, N.ceil);
const CeilRoot: number = RootNumber.ceil(2);
const CeilCurriedPipe: number = pipe(2, N.ceil());
// @ts-expect-error Numeric operations reject string operands.
N.ceil("2");

const TruncDirect: number = N.trunc(2);
const TruncCurried: number = N.trunc()(2);
const TruncPiped: number = pipe(2, N.trunc);
const TruncRoot: number = RootNumber.trunc(2);
const TruncCurriedPipe: number = pipe(2, N.trunc());
// @ts-expect-error Numeric operations reject string operands.
N.trunc("2");

const ToradiansDirect: number = N.toRadians(2);
const ToradiansCurried: number = N.toRadians()(2);
const ToradiansPiped: number = pipe(2, N.toRadians);
const ToradiansRoot: number = RootNumber.toRadians(2);
const ToradiansCurriedPipe: number = pipe(2, N.toRadians());
// @ts-expect-error Numeric operations reject string operands.
N.toRadians("2");

const TodegreesDirect: number = N.toDegrees(2);
const TodegreesCurried: number = N.toDegrees()(2);
const TodegreesPiped: number = pipe(2, N.toDegrees);
const TodegreesRoot: number = RootNumber.toDegrees(2);
const TodegreesCurriedPipe: number = pipe(2, N.toDegrees());
// @ts-expect-error Numeric operations reject string operands.
N.toDegrees("2");

const Atan2Direct: number = N.atan2(2, 3);
const Atan2Curried: number = N.atan2(3)(2);
const Atan2Piped: number = pipe(2, N.atan2(3));
const Atan2Root: number = RootNumber.atan2(2, 3);
// @ts-expect-error Numeric operations reject string operands.
N.atan2("2");

const HypotDirect: number = N.hypot(2, 3);
const HypotCurried: number = N.hypot(3)(2);
const HypotPiped: number = pipe(2, N.hypot(3));
const HypotRoot: number = RootNumber.hypot(2, 3);
// @ts-expect-error Numeric operations reject string operands.
N.hypot("2");

const PowDirect: number = N.pow(2, 3);
const PowCurried: number = N.pow(3)(2);
const PowPiped: number = pipe(2, N.pow(3));
const PowRoot: number = RootNumber.pow(2, 3);
// @ts-expect-error Numeric operations reject string operands.
N.pow("2");

const PositivemoduloDirect: number = N.positiveModulo(2, 3);
const PositivemoduloCurried: number = N.positiveModulo(3)(2);
const PositivemoduloPiped: number = pipe(2, N.positiveModulo(3));
const PositivemoduloRoot: number = RootNumber.positiveModulo(2, 3);
// @ts-expect-error Numeric operations reject string operands.
N.positiveModulo("2");

const LerpDirect: number = N.lerp(2, 3, 0.5);
const LerpCurried: number = N.lerp(3, 0.5)(2);
const LerpPiped: number = pipe(2, N.lerp(3, 0.5));
const LerpRoot: number = RootNumber.lerp(2, 3, 0.5);
// @ts-expect-error Numeric operations reject string operands.
N.lerp("2");

// @ts-expect-error Interpolation requires its parameter.
N.lerp(1);
// @ts-expect-error Curried operations still require numeric data.
N.sin()("2");
