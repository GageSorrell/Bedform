/**
 * Private DateTime type contracts extracted from Effect 4.0.5 DateTime.
 * The public DateTime module is not ported.
 *
 * @module @bedform/effect/Internal/dateTime-types
 *
 * @file      dateTime-types.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream generics, contextual inference, property order and argument forwarding. */

/* eslint-disable sort-imports */

/* Preserve upstream statement layout, type-level inference names and signatures. */
/* eslint-disable @stylistic/max-len */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import type { Inspectable } from "../Inspectable.js";
import type * as Internal from "./dateTime.js";
import type { Pipeable } from "../Pipeable.js";

declare const TypeId: typeof Internal.TypeId;

declare const TimeZoneTypeId: typeof Internal.TimeZoneTypeId;

/**
 * A `DateTime` represents a point in time. It can optionally have a time zone
 * associated with it.
 *
 * @category models
 * @since 1.0.0
 */
export type DateTime = Utc | Zoned;

/**
 * Represents a `DateTime` stored as an absolute UTC instant with no associated
 * time zone.
 *
 * **Details**
 *
 * Use `DateTime.isUtc` to narrow a `DateTime` to this variant.
 *
 * @category models
 * @since 1.0.0
 */
export interface Utc extends DateTime.Proto {
    readonly _tag: "Utc"
    readonly epochMilliseconds: number
    partsUtc: DateTime.PartsWithWeekday | undefined
}

/**
 * Represents a `DateTime` with an associated `TimeZone`.
 *
 * **Details**
 *
 * A zoned value still represents an absolute instant through
 * `epochMilliseconds`, while the time zone is used for wall-clock parts,
 * formatting, and zone-aware transformations.
 *
 * @category models
 * @since 1.0.0
 */
export interface Zoned extends DateTime.Proto {
    readonly _tag: "Zoned"
    readonly epochMilliseconds: number
    readonly zone: TimeZone
    adjustedEpochMilliseconds: number | undefined
    partsAdjusted: DateTime.PartsWithWeekday | undefined
    partsUtc: DateTime.PartsWithWeekday | undefined
}

/**
 * Companion namespace containing the public helper types used by `DateTime`
 * constructors, parts APIs, formatting, and date/time arithmetic.
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace DateTime
{
    /**
     * Input accepted by `DateTime.make`, `DateTime.makeUnsafe`, and the zoned
     * constructors.
     *
     * **Details**
     *
     * Includes existing `DateTime` values, partial date parts, epoch-millisecond
     * objects, epoch milliseconds, JavaScript `Date` instances, and parseable date
     * strings.
     *
     * @category models
     * @since 1.0.0
     */
    export type Input = DateTime | Partial<Parts> | Instant | InstantWithZone | Date | number | string;

    /**
     * Type-level helper used by constructors to preserve a zoned input.
     *
     * **Details**
     *
     * When the input type is `DateTime.Zoned`, the result type is
     * `DateTime.Zoned`; otherwise the result type is `DateTime.Utc`.
     *
     * @category models
     * @since 1.0.0
     */
    export type PreserveZone<A extends DateTime.Input> = A extends Zoned ? Zoned : Utc;

    /**
     * Date and time unit name accepted by `DateTime` rounding and arithmetic
     * APIs.
     *
     * **Details**
     *
     * Includes both singular units, such as `"day"`, and plural units, such as
     * `"days"`.
     *
     * @category models
     * @since 1.0.0
     */
    export type Unit = UnitSingular | UnitPlural;

    /**
     * Singular date and time unit names used by rounding APIs such as
     * `DateTime.startOf`, `DateTime.endOf`, and `DateTime.nearest`.
     *
     * @category models
     * @since 1.0.0
     */
    export type UnitSingular =
    | "millisecond"
    | "second"
    | "minute"
    | "hour"
    | "day"
    | "week"
    | "month"
    | "year";

    /**
     * Plural date and time unit names used by `DateTime.PartsForMath` for
     * amount-based arithmetic.
     *
     * @category models
     * @since 1.0.0
     */
    export type UnitPlural =
    | "milliseconds"
    | "seconds"
    | "minutes"
    | "hours"
    | "days"
    | "weeks"
    | "months"
    | "years";

    /**
     * Calendar and time components of a `DateTime`, including the weekday.
     *
     * **Details**
     *
     * `month` is one-based (`1` for January through `12` for December), and
     * `weekDay` follows JavaScript `Date#getUTCDay` numbering (`0` for Sunday
     * through `6` for Saturday).
     *
     * @category models
     * @since 1.0.0
     */
    export interface PartsWithWeekday {
        readonly millisecond: number
        readonly second: number
        readonly minute: number
        readonly hour: number
        readonly day: number
        readonly weekDay: number
        readonly month: number
        readonly year: number
    }

    /**
     * Calendar and time components of a `DateTime`, without weekday information.
     *
     * **Details**
     *
     * `month` is one-based (`1` for January through `12` for December).
     *
     * @category models
     * @since 1.0.0
     */
    export interface Parts {
        readonly millisecond: number
        readonly second: number
        readonly minute: number
        readonly hour: number
        readonly day: number
        readonly month: number
        readonly year: number
    }

    /**
     * Plural amount fields accepted by `DateTime.add` and `DateTime.subtract`.
     *
     * **Details**
     *
     * Each field represents the number of units to add or subtract for that part.
     *
     * @category models
     * @since 1.0.0
     */
    export interface PartsForMath {
        readonly milliseconds: number
        readonly seconds: number
        readonly minutes: number
        readonly hours: number
        readonly days: number
        readonly weeks: number
        readonly months: number
        readonly years: number
    }

    /**
     * Object input representing an absolute instant as milliseconds since the Unix
     * epoch.
     *
     * @category models
     * @since 1.0.0
     */
    export interface Instant {
        readonly epochMilliseconds: number
    }

    /**
     * Object input representing an absolute instant plus a time zone identifier.
     *
     * **Details**
     *
     * `DateTime.makeZoned` and `DateTime.makeZonedUnsafe` use `timeZoneId` when
     * no explicit `timeZone` option is supplied.
     *
     * @category models
     * @since 1.0.0
     */
    export interface InstantWithZone {
        readonly timeZoneId: string
        readonly epochMilliseconds: number
    }

    /**
     * Shared protocol implemented by all `DateTime` values.
     *
     * **Details**
     *
     * Provides the `DateTime` type identifier along with pipe and inspection
     * support.
     *
     * @category models
     * @since 1.0.0
     */
    export interface Proto extends Pipeable, Inspectable {
        readonly [TypeId]: typeof TypeId
    }
}

/**
 * Represents a time zone used by `DateTime.Zoned`.
 *
 * **Details**
 *
 * A `TimeZone` is either a fixed offset from UTC or a named IANA time zone.
 *
 * @category models
 * @since 1.0.0
 */
export type TimeZone = TimeZone.Offset | TimeZone.Named;

/**
 * Companion namespace containing the public variant and protocol types for
 * `TimeZone`.
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace TimeZone
{
    /**
     * Shared protocol implemented by all `TimeZone` values.
     *
     * **Details**
     *
     * Provides the `TimeZone` type identifier and inspection support.
     *
     * @category models
     * @since 1.0.0
     */
    export interface Proto extends Inspectable {
        readonly [TimeZoneTypeId]: typeof TimeZoneTypeId
    }

    /**
     * Fixed-offset time zone.
     *
     * **Details**
     *
     * The `offset` is measured in milliseconds from UTC. Positive offsets are
     * ahead of UTC, and negative offsets are behind UTC.
     *
     * @category models
     * @since 1.0.0
     */
    export interface Offset extends Proto {
        readonly _tag: "Offset"
        readonly offset: number
    }

    /**
     * Named IANA time zone.
     *
     * **Details**
     *
     * The `id` field contains the resolved time zone identifier, such as
     * `"Europe/London"` or `"America/New_York"`.
     *
     * @category models
     * @since 1.0.0
     */
    export interface Named extends Proto {
        readonly _tag: "Named"
        readonly id: string

        /**
         * Runtime helper from the pinned Effect implementation.
         *
         * @internal
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly format: Intl.DateTimeFormat
    }
}

/**
 * A `Disambiguation` is used to resolve ambiguities when a `DateTime` is
 * ambiguous, such as during a daylight saving time transition.
 *
 * **Details**
 *
 * For more information, see the [Temporal documentation](https://tc39.es/proposal-temporal/docs/timezone.html#ambiguity-due-to-dst-or-other-time-zone-offset-changes)
 *
 * - `"compatible"`: (default) Behavior matching Temporal API and legacy JavaScript Date and moment.js.
 *   For repeated times, chooses the earlier occurrence. For gap times, chooses the later interpretation.
 *
 * - `"earlier"`: For repeated times, always choose the earlier occurrence.
 *   For gap times, choose the time before the gap.
 *
 * - `"later"`: For repeated times, always choose the later occurrence.
 *   For gap times, choose the time after the gap.
 *
 * - `"reject"`: Throw an `RangeError` when encountering ambiguous or non-existent times.
 *
 * **Example** (Resolving ambiguous local times)
 *
 * ```ts import.meta.vitest
 * import { DateTime, Option } from "effect"
 *
 * // Fall-back example: 01:30 on Nov 2, 2025 in New York happens twice
 * const ambiguousTime = { year: 2025, month: 11, day: 2, hour: 1, minute: 30 }
 * const timeZone = DateTime.zoneMakeNamedUnsafe("America/New_York")
 *
 * const earlier = DateTime.makeZoned(ambiguousTime, {
 *   timeZone,
 *   adjustForTimeZone: true,
 *   disambiguation: "earlier"
 * })
 * // Earlier occurrence (DST time): 2025-11-02T05:30:00.000Z
 *
 * const later = DateTime.makeZoned(ambiguousTime, {
 *   timeZone,
 *   adjustForTimeZone: true,
 *   disambiguation: "later"
 * })
 * // Later occurrence (standard time): 2025-11-02T06:30:00.000Z
 *
 * // Gap example: 02:30 on Mar 9, 2025 in New York doesn't exist
 * const gapTime = { year: 2025, month: 3, day: 9, hour: 2, minute: 30 }
 *
 * const beforeGap = DateTime.makeZoned(gapTime, {
 *   timeZone,
 *   adjustForTimeZone: true,
 *   disambiguation: "earlier"
 * })
 * // Time before gap: 2025-03-09T06:30:00.000Z (01:30 EST)
 *
 * const afterGap = DateTime.makeZoned(gapTime, {
 *   timeZone,
 *   adjustForTimeZone: true,
 *   disambiguation: "later"
 * })
 * // Time after gap: 2025-03-09T07:30:00.000Z (03:30 EDT)
 *
 * earlier.pipe(Option.getOrThrow, DateTime.formatIso) // => "2025-11-02T05:30:00.000Z"
 * later.pipe(Option.getOrThrow, DateTime.formatIso) // => "2025-11-02T06:30:00.000Z"
 * beforeGap.pipe(Option.getOrThrow, DateTime.formatIso) // => "2025-03-09T06:30:00.000Z"
 * afterGap.pipe(Option.getOrThrow, DateTime.formatIso) // => "2025-03-09T07:30:00.000Z"
 * ```
 *
 * @category models
 * @since 1.0.0
 */
export type Disambiguation = "compatible" | "earlier" | "later" | "reject";
