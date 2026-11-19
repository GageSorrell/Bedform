/**
 * Immutable functional rigid body values and source-solid physical updates.
 *
 * @module bedform/PhysicsEntity
 *
 * @file      PhysicsEntity.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Validated body constructors, inspection and functional updates.
 *
 * @category Exports
 * @since 1.0.0
 */
export { define, make, isPhysicsEntity, centerOfMass, motion, configure, setPose, setLinearVelocity,
    setAngularVelocity, applyForce, applyTorque, applyImpulse, clearForces, wake, pause, resume, gravityFrom
} from "./Internal/PhysicsBody.js";

/**
 * Pure immutable body and exclusive physical configuration contracts.
 *
 * @category Types
 * @since 1.0.0
 */
export type { PhysicsEntity, Definition, ModelReference, Options, Properties, Update, PointUpdate
} from "./Internal/PhysicsBody.js";

/**
 * Typed physical validation and numerical failures.
 *
 * @category Errors
 * @since 1.0.0
 */
export type { PhysicsError } from "./Internal/PhysicsMath.js";
