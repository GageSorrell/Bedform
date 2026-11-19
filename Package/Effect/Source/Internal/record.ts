/**
 * Internal record construction, traversal and transformation operations.
 *
 * @module @bedform/effect/Internal/record
 *
 * @file      record.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/**
 * Assigns a property safely, including a property named __proto__.
 *
 * @category Model
 * @since 1.0.0
 */
export function assignProperty(self: object, key: PropertyKey, value: unknown): void
{
    if (key === "__proto__")
    {
        Object.defineProperty(self, key, {
            value,
            writable: true,
            enumerable: true,
            configurable: true
        });
    }
    else
    {
        ;(self as any)[key] = value;
    }
}

/**
 * Copies the enumerable own properties of a source object.
 *
 * @category Model
 * @since 1.0.0
 */
export function assignProperties(self: object, source: object): void
{
    for (const key of Reflect.ownKeys(source))
    {
        if (Object.prototype.propertyIsEnumerable.call(source, key))
        {
            assignProperty(self, key, (source as any)[key]);
        }
    }
}
/* Upstream object member order is part of inspection and serialization behavior. */
/* eslint sort-keys: "off" */
