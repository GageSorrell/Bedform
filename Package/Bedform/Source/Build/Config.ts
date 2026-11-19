/**
 * Typed host build registrations; importing these types starts no runtime.
 *
 * @module bedform/Build/Config
 *
 * @file      Config.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as C from "../CollisionShape.js";
import type * as T from "../Transform.js";
import type * as V from "../Vector3.js";

export namespace Collision
{
    /**
     * Deterministic enclosing primitive fit or exact source-solid collision.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Fit
    {
        readonly kind: C.CollisionShape.Primitive["kind"];
        readonly fit: true;
    }

    /**
     * Explicit model-local primitive dimensions and optional local pose.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Primitive
    {
        readonly kind: C.CollisionShape.Primitive["kind"];
        readonly halfExtents: V.Coordinates;
        readonly pose?: T.Coordinates;
    }

    /**
     * Faithful partition collision, preserving source concavities and cavities.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Complex
    {
        readonly kind: "complex";
    }

    /**
     * Explicit compound collider union, independent of mass integration.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Compound
    {
        readonly kind: "compound";
        readonly children: ReadonlyArray<Collision>;
    }
}

/**
 * Supported collision choices. Omission selects a fitted model-local box.
 *
 * @category Types
 * @since 1.0.0
 */
export type Collision = Collision.Fit | Collision.Primitive | Collision.Complex | Collision.Compound;

export namespace PhysicalDefaults
{
    /**
     * Explicit positive mass in kilograms, defaulting to one when omitted.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Mass
    {
        readonly mass?: number;
        readonly density?: never;
    }

    /**
     * Positive uniform density in kilograms per cubic block.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Density
    {
        readonly mass?: never;
        readonly density: number;
    }
}

/**
 * Mutually exclusive mass/density inputs, also checked at the JSON boundary.
 *
 * @category Types
 * @since 1.0.0
 */
export type PhysicalDefaults = PhysicalDefaults.Mass | PhysicalDefaults.Density;

export namespace Registration
{
    /**
     * Shared physical defaults with COM expressed in model-local blocks.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Common
    {
        readonly name: string;
        readonly collision?: Collision;
        readonly centerOfMass?: V.Coordinates;
        readonly restitution?: number;
        readonly gravity?: V.Coordinates;
        readonly linearVelocity?: V.Coordinates;
        readonly angularVelocity?: V.Coordinates;
    }

    /**
     * Modern rigid Bedrock geometry and texture paths relative to resourcePack.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Cuboid extends Common
    {
        readonly representation: "cuboid";
        readonly geometry: string;
        readonly geometryIdentifier: string;
        readonly materials: Readonly<Record<string, string>>;
        readonly textures: Readonly<Record<string, string>>;
    }

    /**
     * Evaluated physical mesh and renderer metadata relative to the config file.
     * Renderer assets and anchor geometry are relative to the descriptor file.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Particle extends Common
    {
        readonly representation: "particle";
        readonly meshSolid: string;
        readonly rendererDescriptor: string;
    }
}

/**
 * One rigid-body model registration with rendering-independent physical properties.
 *
 * @category Types
 * @since 1.0.0
 */
export type Registration = (Registration.Cuboid | Registration.Particle) & PhysicalDefaults;

/**
 * Versioned build input. Pack roots and registration paths resolve from the config.
 * Generated output is an overlay, with no script bundling, manifests or installation.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Config
{
    readonly schemaVersion: 1;
    readonly namespace: string;
    readonly behaviorPack: string;
    readonly resourcePack: string;
    readonly models: ReadonlyArray<Registration>;
}
