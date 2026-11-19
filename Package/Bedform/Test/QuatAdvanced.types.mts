/**
 * Advanced Quat overload and partial-domain declaration fixtures.
 *
 * @module bedform/Test/QuatAdvanced.types
 *
 * @file      QuatAdvanced.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public type fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/no-unused-vars, sort-imports */

import { Quat as Q, Vector3 as V } from "bedform";
import type * as Direct from "bedform/Quat";
import * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";
const A = Q.Identity;
const FastlerpDirect: O.Option<Direct.Quat> = Q.fastLerp(A, A, 0.5);
const FastlerpPiped: O.Option<Q.Quat> = pipe(A, Q.fastLerp(A, 0.5));
const SlerpDirect: O.Option<Direct.Quat> = Q.slerp(A, A, 0.5);
const SlerpPiped: O.Option<Q.Quat> = pipe(A, Q.slerp(A, 0.5));
const SlerpunnormalizedDirect: O.Option<Direct.Quat> = Q.slerpUnnormalized(A, A, 0.5);
const SlerpunnormalizedPiped: O.Option<Q.Quat> = pipe(A, Q.slerpUnnormalized(A, 0.5));
const SlerpfullpathDirect: O.Option<Direct.Quat> = Q.slerpFullPath(A, A, 0.5);
const SlerpfullpathPiped: O.Option<Q.Quat> = pipe(A, Q.slerpFullPath(A, 0.5));
const SlerpfullpathunnormalizedDirect: O.Option<Direct.Quat> = Q.slerpFullPathUnnormalized(A, A, 0.5);
const SlerpfullpathunnormalizedPiped: O.Option<Q.Quat> = pipe(A, Q.slerpFullPathUnnormalized(A, 0.5));
const Bilinear: O.Option<Q.Quat> = Q.fastBilerp(A, A, A, A, 0.5, 0.5);
const BilinearCurried: O.Option<Q.Quat> = pipe(A, Q.fastBilerp(A, A, A, 0.5, 0.5));
const Squad: O.Option<Q.Quat> = Q.squad(A, A, A, A, 0.5);
const SquadCurried: O.Option<Q.Quat> = pipe(A, Q.squad(A, A, A, 0.5));
const FullSquad: O.Option<Q.Quat> = Q.squadFullPath(A, A, A, A, 0.5);
const FullSquadCurried: O.Option<Q.Quat> = pipe(A, Q.squadFullPath(A, A, A, 0.5));
const Tangent: O.Option<Q.Quat> = Q.calculateTangent(A, A, A);
const Tension: O.Option<Q.Quat> = Q.calculateTangent(A, A, A, 0.5);
const CurriedTangent: O.Option<Q.Quat> = pipe(A, Q.calculateTangent(A, A));
const CurriedTension: O.Option<Q.Quat> = pipe(A, Q.calculateTangent(A, A, 0.5));
const Log: O.Option<Q.Quat> = pipe(A, Q.log);
const Exp: O.Option<Q.Quat> = pipe(Log, O.flatMap(Q.exp));
const Parts: O.Option<Q.SwingTwist> = Q.toSwingTwist(A, V.UnitY);
const CurriedParts: O.Option<Q.SwingTwist> = pipe(A, Q.toSwingTwist(V.UnitY));
const Angle: O.Option<number> = Q.twistAngle(A, V.UnitY);
const CurriedAngle: O.Option<number> = pipe(A, Q.twistAngle(V.UnitY));
const AutoError: O.Option<number> = pipe(A, Q.errorAutoNormalize(A));
// @ts-expect-error Interpolation parameters are numeric.
Q.slerp(A, A, "0.5");
// @ts-expect-error Spherical interpolation is partial.
const Wrong: Q.Quat = Q.slerp(A, A, 0.5);
// @ts-expect-error Bilinear interpolation requires all grid corners and parameters.
Q.fastBilerp(A, A, A);
// @ts-expect-error Tangent tension is numeric.
Q.calculateTangent(A, A, A, "1");
// @ts-expect-error Curried squad still requires a Quat receiver.
Q.squad(A, A, A, 0.5)(V.Zero);
const Checked = O.getOrThrow(Parts);
// @ts-expect-error Decomposition records are readonly.
Checked.twist = A;
// @ts-expect-error Decomposition outputs retain readonly components.
Checked.swing.w = 2;
