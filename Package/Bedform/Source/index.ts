/**
 * Functional utilities for Bedrock add-ons.
 *
 * @module bedform/index
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * General-purpose utilities for add-ons.
 *
 * @category Naming
 * @since 1.0.0
 */
export * as Utility from "./Utility/index.js";

/**
 * Pure function-component elements and automatic JSX runtime foundations.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as DDUI from "./DDUI/index.js";

/**
 * Inert entity-control definitions, explicit attachment and pure fixed-step lever, slider and wheel motion.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Diagetic from "./Diagetic.js";

/**
 * Explicitly started spatial presentation clients and inert definitions.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Spatial from "./Spatial/index.js";

/**
 * Immutable functional Vector2 values and pure coordinate operations.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Vector2 from "./Vector2.js";

/**
 * Immutable functional Vector3 values and pure coordinate operations.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Vector3 from "./Vector3.js";

/**
 * Immutable quaternion rotations, raw algebra and canonical protocols.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Quat from "./Quat.js";

/**
 * Immutable Minecraft degree orientations, component utilities and quaternion-backed operations.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Rotator from "./Rotator.js";

/**
 * Immutable rigid poses, frame conversions and interpolation without scale.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Transform from "./Transform.js";

/**
 * Immutable origin-based rigid motion and frame velocity propagation.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as RigidTransform from "./RigidTransform.js";

/**
 * Immutable unit-direction forward rays and block-distance queries.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Ray from "./Ray.js";

/**
 * Immutable oriented planes, half-spaces and exact static intersection queries.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Plane from "./Plane.js";

/**
 * Immutable axis-aligned bounds and pure static geometric queries.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as AABB from "./AABB.js";

/**
 * Whole-block lattice coordinates in meters, block faces, neighbors, boxes and segment traversal.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Voxel from "./Voxel.js";

/**
 * Sixteenth-of-a-block lattice coordinates in meters, local and global addressing, boxes and traversal.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Microvoxel from "./Microvoxel.js";

/**
 * Immutable oriented boxes, local frame queries and exact static overlap.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as OBB from "./OBB.js";

/**
 * Immutable solid convex hull topology and complete static geometric queries.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as ConvexHull from "./ConvexHull.js";

/**
 * Pure CollisionShape contracts for custom rigid bodies.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as CollisionShape from "./CollisionShape.js";

/**
 * Pure PhysicsModel contracts for custom rigid bodies.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as PhysicsModel from "./PhysicsModel.js";

/**
 * Pure PhysicsRenderer contracts for custom rigid bodies.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as PhysicsRenderer from "./PhysicsRenderer.js";

/**
 * Authoritative Collision operations for rigid bodies.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Collision from "./Collision.js";

/**
 * Authoritative CollisionBroadPhase operations for rigid bodies.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as CollisionBroadPhase from "./CollisionBroadPhase.js";

/**
 * Immutable functional PhysicsEntity values and operations.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as PhysicsEntity from "./PhysicsEntity.js";

/**
 * Immutable functional PhysicsWorld values and operations.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as PhysicsWorld from "./PhysicsWorld.js";
