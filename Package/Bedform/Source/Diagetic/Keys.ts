/**
 * Shared recovery, cooperative ownership and presentation identifiers for Diagetic controls.
 *
 * @module bedform/Diagetic/Keys
 *
 * @file      Keys.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Permission hierarchy is restored before individual child categories. */
/* eslint-disable sort-keys */

/**
 * Pack-scoped journal sequence and entity-owned control and retirement records.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DynamicProperty = Object.freeze({ Sequence: "bedform:diagetic_sequence",
    Control: "bedform:diagetic_control",
    Retired: "bedform:diagetic_retired" } as const);

/**
 * Player-ID-suffixed, pack-scoped recovery receipts. Never change an existing world's key without migration.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DynamicPropertyPrefix = Object.freeze({ Recovery: "bedform:diagetic_recovery:" } as const);

/**
 * Cooperative cross-pack player/control ownership; only the recorded token is removed by its owner.
 *
 * @category Constant
 * @since 1.0.0
 */
export const TagPrefix = Object.freeze({ Session: "bedform:diagetic_session:" } as const);

/**
 * Shared player presentation events supplied by BedformCommon.
 *
 * @category Constant
 * @since 1.0.0
 */
export const EntityEvent = Object.freeze({ Lock: "bedform:diagetic_lock",
    Unlock: "bedform:diagetic_unlock",
    RefreshTarget: "bedform:diagetic_refresh_target",
    ExpireTarget: "bedform:diagetic_expire_target" } as const);

/**
 * Shared player component group for the native body-rotation lock.
 *
 * @category Constant
 * @since 1.0.0
 */
export const EntityGroup = Object.freeze({ Locked: "bedform:diagetic_locked" } as const);

/**
 * Synchronized local-avatar presentation and idle control highlight switches.
 *
 * @category Constant
 * @since 1.0.0
 */
export const EntityProperty = Object.freeze({ CameraActive: "bedform:diagetic_camera_active",
    Highlighted: "bedform:diagetic_highlighted" } as const);

/**
 * Synchronized control-entity pose properties read directly by the shared client animations.
 * Offsets are model-space bone translations in pixels; mount angles and Motion are bone rotations in
 * degrees, except slider Motion, which is a model-space translation in pixels. Bedform computes the
 * Bedrock axis and handedness conventions, so the animations only pass these values through.
 *
 * @category Constant
 * @since 1.0.0
 */
export const PoseProperty = Object.freeze({ OffsetX: "bedform:diagetic_offset_x",
    OffsetY: "bedform:diagetic_offset_y",
    OffsetZ: "bedform:diagetic_offset_z",
    Yaw: "bedform:diagetic_yaw",
    Pitch: "bedform:diagetic_pitch",
    Roll: "bedform:diagetic_roll",
    Motion: "bedform:diagetic_motion" } as const);

/**
 * Inclusive synchronized property ranges. Published values are clamped into these ranges. BDS rejects
 * float properties whose bounds or default are integral JSON tokens, so every bound is fractional.
 *
 * @category Constant
 * @since 1.0.0
 */
export const PoseRange = Object.freeze({ Offset: Object.freeze([ -256.5, 256.5 ] as const),
    Angle: Object.freeze([ -180.5, 180.5 ] as const),
    Motion: Object.freeze([ -360.5, 360.5 ] as const) } as const);

/**
 * Script events understood by BedformCommon's runtime. Place accepts "lever", "slider" or "wheel" from a
 * player, placing that control on the block face the player is looking at, or a JSON placement request.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ScriptEvent = Object.freeze({ Place: "bedform:diagetic_place" } as const);

/**
 * Native free-camera preset retaining player effects and audio perspective without a FOV override.
 *
 * @category Constant
 * @since 1.0.0
 */
export const CameraPreset = "bedform:diagetic_snapshot" as const;

/**
 * Exact localized Use instruction maintained during every acquired tick.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ReleasePrompt = "§o§7Press §e:_input_key.use: §o§7to let go.§r" as const;

/**
 * Stable native permission ABI, used without importing the native runtime enumeration.
 * Aggregate categories are restored before their children, preserving individual disabled permissions.
 *
 * @category Constant
 * @since 1.0.0
 */
export const NativePermission = Object.freeze({ Movement: 2,
    LateralMovement: 4,
    Sneak: 5,
    Jump: 6,
    Mount: 7,
    Dismount: 8,
    MoveForward: 9,
    MoveBackward: 10,
    MoveLeft: 11,
    MoveRight: 12,
    Camera: 1 } as const);

/**
 * Invisible native Use receiver leased to one active session.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ReleaseTarget = "bedform:diagetic_release_target" as const;
