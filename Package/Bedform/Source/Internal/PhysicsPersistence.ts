/**
 * Versioned owner state, validated through the public physical constructors.
 *
 * @module bedform/Internal/PhysicsPersistence
 *
 * @file      PhysicsPersistence.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

/* Persisted records retain physical ordering and contextual inference. */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */

import * as E from "./PhysicsBody.js";
import type * as M from "../PhysicsModel.js";
import * as R from "@bedform/effect/Result";
import * as O from "@bedform/effect/Option";
import * as V from "../Vector3.js";
import * as T from "../Transform.js";

/**
 * Strict version-one record; interpolation histories and elapsed wall time are absent.
 *
 * @category Persistence
 * @since 1.0.0
 */
export const save = (body: E.PhysicsEntity): string =>
{
    const Ref = body.definition.model;
    return JSON.stringify({ schemaVersion: 1,
        id: body.id,
        model: { identifier: Ref.identifier,
            fingerprint: Ref.fingerprint,
            representation: Ref.representation,
            renderer: O.isSome(Ref.renderer) ? Ref.renderer.value : null },
        mode: body.mode,
        pose: body.pose,
        linearVelocity: body.linearVelocity,
        angularVelocity: body.angularVelocity,
        mass: body.physical.mass,
        centerOfMass: body.physical.centerOfMass,
        restitution: body.restitution,
        gravity: O.isSome(body.gravity) ? body.gravity.value : null,
        allowSleep: body.allowSleep,
        force: body.force,
        torque: body.torque,
        sleeping: body.sleeping,
        sleepTime: body.sleepTime,
        paused: body.paused });
};

/**
 * Retained data cannot be restored against a missing/incompatible schema or catalog.
 *
 * @category Errors
 * @since 1.0.0
 */
export class RestoreError extends Error
{
    readonly code: "InvalidState" | "MissingModel" | "IncompatibleModel";

    /**
     * Categorizes a retained owner without changing its stored bytes.
     *
     * @category Constructors
     * @since 1.0.0
     */
    constructor(code: RestoreError["code"], message: string)
    {
        super(message);
        this.code = code;
    }
}

/**
 * Reconstructs validated immutable state with a fresh settled renderer interval.
 * Unrecognized schema/assets are retained by the caller, never silently migrated.
 *
 * @throws { RestoreError } Malformed or incompatible persisted state.
 *
 * @category Persistence
 * @since 1.0.0
 */
export const restore = (text: string, catalog: ReadonlyMap<string, M.Model>): E.PhysicsEntity =>
{
    try
    {
        const Data = JSON.parse(text) as Record<string, unknown>;
        if (!Data || typeof Data !== "object" || Data.schemaVersion !== 1)
        {
            throw new RestoreError("InvalidState", "Unsupported owner state schema");
        }

        const Ref = Data.model as Record<string, unknown>;
        if (!Ref || typeof Ref.identifier !== "string")
        {
            throw new RestoreError("InvalidState", "Missing catalog reference");
        }

        const Model = catalog.get(Ref.identifier);
        if (!Model)
        {
            throw new RestoreError("MissingModel", `Missing catalog model ${Ref.identifier}`);
        }

        const Renderer = Model.renderer;
        if (Model.schemaVersion !== 1 || Ref.fingerprint !== Model.fingerprint || Ref.representation !== Model.representation ||
            (Ref.renderer === null ? undefined : Ref.renderer) !== Renderer)
        {
            throw new RestoreError("IncompatibleModel", `Incompatible catalog model ${Ref.identifier}`);
        }

        if (!Data.pose || !T.isValid(Data.pose as T.Coordinates) || typeof Data.allowSleep !== "boolean" || typeof Data.paused !== "boolean" || typeof Data.sleeping !== "boolean" ||
            typeof Data.sleepTime !== "number" || !Number.isFinite(Data.sleepTime) || Data.sleepTime < 0 ||
            !V.isFinite(Data.force as V.Coordinates) || !V.isFinite(Data.torque as V.Coordinates) ||
            typeof Data.mass !== "number" || !Number.isFinite(Data.mass) || Data.mass <= 0 ||
            !V.isFinite(Data.centerOfMass as V.Coordinates) || !V.isFinite(Data.linearVelocity as V.Coordinates) || !V.isFinite(Data.angularVelocity as V.Coordinates) ||
            ![ "dynamic", "static", "kinematic" ].includes(String(Data.mode)) || typeof Data.restitution !== "number" ||
            (Data.gravity !== null && !V.isFinite(Data.gravity as V.Coordinates)))
        {
            throw new RestoreError("InvalidState", "Invalid physical state fields");
        }

        let body = R.getOrThrow(E.make(Model, { id: Data.id as string,
            mode: Data.mode as E.PhysicsEntity["mode"],
            pose: Data.pose as E.PhysicsEntity["pose"],
            mass: Data.mass,
            centerOfMass: Data.centerOfMass as V.Coordinates,
            restitution: Data.restitution,
            gravity: Data.gravity === null ? O.none() : O.some(Data.gravity as V.Coordinates),
            linearVelocity: Data.linearVelocity as V.Coordinates,
            angularVelocity: Data.angularVelocity as V.Coordinates,
            allowSleep: Data.allowSleep }));
        body = R.getOrThrow(E.applyForce(body, Data.force as V.Coordinates));
        body = R.getOrThrow(E.applyTorque(body, Data.torque as V.Coordinates));
        return E.copy(body, { paused: Data.paused,
            sleeping: Data.sleeping,
            sleepTime: Data.sleepTime });
    }
    catch (error)
    {
        if (error instanceof RestoreError)
        {
            throw error;
        }

        throw new RestoreError("InvalidState", String(error));
    }
};
