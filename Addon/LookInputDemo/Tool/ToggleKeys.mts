/**
 * Probe-only identifiers for the Diagetic input qualification world.
 *
 * @module @sorrell/look-input-demo/Tool/ToggleKeys
 *
 * @file      ToggleKeys.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Ownership receipts used only by the disposable native probe.
 *
 * @category Constant
 * @since 1.0.12
 */
export const DynamicProperty = Object.freeze({ Owner: "look_probe:owner",
    Persistence: "look_probe:persistence" } as const);

/**
 * Loaded scene reservation for the disposable native probe.
 *
 * @category Constant
 * @since 1.0.12
 */
export const TickingArea = Object.freeze({ Scene: "look_probe_scene" } as const);

/**
 * Invisible interactable actor authored only into the qualification pack.
 *
 * @category Constant
 * @since 1.0.12
 */
export const ProbeEntity = "look_probe:target" as const;

/**
 * Console controls for physical input observation, never installed in the normal demo.
 *
 * @category Constant
 * @since 1.0.12
 */
export const ScriptEvent = Object.freeze({ Helper: "look_probe:helper",
    Reset: "look_probe:reset" } as const);
