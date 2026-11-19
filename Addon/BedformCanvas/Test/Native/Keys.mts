/**
 * Script-owned identifiers and fixed pack identities of the isolated native Canvas Intent fixture.
 *
 * @module bedform-canvas/Test/Native/Keys
 *
 * @file      Keys.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Fixture-only script events between the driver, both consumers and the optional Canvas observer.
 *
 * @category Testing
 * @since 1.0.0
 */
export const FixtureEvent = Object.freeze({
    Consumer: "bedform_native:consumer",
    ConsumerResult: "bedform_native:consumer_result",
    Observation: "bedform_native:observation",
    Observer: "bedform_native:observer"
} as const);

/**
 * Driver-owned world dynamic properties; only the disposable fixture world stores them.
 *
 * @category Testing
 * @since 1.0.0
 */
export const DynamicProperty = Object.freeze({
    Session: "bedform_native:session"
} as const);

/**
 * Ticking areas the driver adds to its disposable world.
 *
 * @category Testing
 * @since 1.0.0
 */
export const TickingArea = Object.freeze({
    Arena: "bedform_native_arena",
    Nether: "bedform_native_nether",
    Remote: "bedform_native_remote"
} as const);

/**
 * The two independent consumer add-on Intent identities.
 *
 * @category Testing
 * @since 1.0.0
 */
export const ConsumerId = Object.freeze({
    A: "bedform_native:consumer_a",
    B: "bedform_native:consumer_b"
} as const);

/**
 * The driver's raw protocol identity, used only for wire-level version, ownership and restart probes.
 *
 * @category Testing
 * @since 1.0.0
 */
export const RawClientId = "bedform_native:raw" as const;

/**
 * Log markers parsed by the runner.
 *
 * @category Testing
 * @since 1.0.0
 */
export const Marker = Object.freeze({
    Evidence: "CANVAS_NATIVE_EVIDENCE",
    Fail: "CANVAS_NATIVE_FAIL",
    ObserverReady: "CANVAS_NATIVE_OBSERVER_READY",
    Pass: "CANVAS_NATIVE_PASS",
    Saved: "CANVAS_NATIVE_SAVED"
} as const);
