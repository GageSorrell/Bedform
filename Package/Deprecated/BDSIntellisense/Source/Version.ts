/**
 * Dotted Bedrock Dedicated Server release numbers such as `1.26.63.1`, with parsing and ordering.
 *
 * @module bds-intellisense/Version
 *
 * @file      Version.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * A release number of two to four non-negative integer parts; missing trailing parts count as zero.
 *
 * @category Types
 * @since 1.0.0
 */
export type BdsVersion = ReadonlyArray<number>;

/**
 * Matches the textual form accepted by {@link Parse}.
 *
 * @category Constants
 * @since 1.0.0
 */
export const VersionPattern: RegExp = /^\d+(?:\.\d+){1,3}$/u;

/**
 * Reads text such as `1.26.63.1` into a version, or yields `undefined` when the text is not one.
 *
 * Surrounding whitespace is ignored.  Between two and four dot-separated parts are accepted.
 *
 * @category Functions
 * @since 1.0.0
 */
export function Parse(text: string): BdsVersion | undefined
{
    const trimmed: string = text.trim();
    if (!VersionPattern.test(trimmed))
    {
        return undefined;
    }

    const parts: Array<number> = trimmed.split(".").map(Number);
    return parts.every(Number.isSafeInteger) ? Object.freeze(parts) : undefined;
}

/**
 * Writes a version in dotted form, keeping every part it was created with.
 *
 * @category Functions
 * @since 1.0.0
 */
export function Format(version: BdsVersion): string
{
    return version.join(".");
}

/**
 * Orders two versions part by part, treating missing parts as zero.
 *
 * The result is negative when `left` precedes `right`, positive when it follows, and zero when the
 * two denote the same release, so `1.26` and `1.26.0.0` compare equal.
 *
 * @category Functions
 * @since 1.0.0
 */
export function Compare(left: BdsVersion, right: BdsVersion): number
{
    const length: number = Math.max(left.length, right.length);
    for (let index: number = 0; index < length; index++)
    {
        const difference: number = (left[index] ?? 0) - (right[index] ?? 0);
        if (difference !== 0)
        {
            return Math.sign(difference);
        }
    }

    return 0;
}

/**
 * Whether two versions denote the same release once missing parts are treated as zero.
 *
 * @category Functions
 * @since 1.0.0
 */
export function Equals(left: BdsVersion, right: BdsVersion): boolean
{
    return Compare(left, right) === 0;
}

/**
 * Picks the newest of the given versions, or `undefined` when none are given.
 *
 * @category Functions
 * @since 1.0.0
 */
export function Latest(versions: Iterable<BdsVersion>): BdsVersion | undefined
{
    let newest: BdsVersion | undefined = undefined;
    for (const version of versions)
    {
        if (newest === undefined || Compare(version, newest) > 0)
        {
            newest = version;
        }
    }

    return newest;
}
