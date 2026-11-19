/**
 * Inert asset-dependency annotation for shared Canvas display and presentation backends.
 *
 * @module bedform/Canvas/Dependency
 *
 * @file      Dependency.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Returns a value unchanged and marks its surviving runtime use as requiring the shared Canvas packs.
 * Future display, Ink, Window or VM presentation backends can annotate asset-backed definitions
 * without importing Intent or starting a native service. Mark unused constant initializers with
 * the standard pure-call annotation so bundlers can eliminate them with their dependency.
 *
 * @category Annotation
 * @since 1.0.0
 */
export function WithAssets<Value>(value: Value): Value
{
    return value;
}
