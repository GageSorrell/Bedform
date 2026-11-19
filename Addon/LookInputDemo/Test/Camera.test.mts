/**
 * Native eye-anchor command construction, failure handling and FOV override removal.
 *
 * @module @sorrell/look-input-demo/Test/Camera.test
 *
 * @file      Camera.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { CameraPreset, FreezeCamera, RestoreCamera } from "../Script/Camera.js";
import assert from "node:assert/strict";
import { test } from "node:test";

test("activation delegates the full pose to the native eye anchor without numeric FOV or offsets", () =>
{
    const calls: Array<string> = [];
    FreezeCamera({ runCommand: (command: string) =>
    {
        calls.push(command);
        return { successCount: 1 };
    } });
    assert.deepEqual(calls, [ "execute as @s at @s anchored eyes run camera @s set " +
        `${CameraPreset} pos ^ ^ ^ rot ~ ~` ]);
});

test("a rejected native camera command propagates for activation rollback", () =>
{
    assert.throws(() => FreezeCamera({ runCommand: () => ({ successCount: 0 }) }),
        /native eye-anchored camera command did not apply/);
    assert.throws(() => FreezeCamera({ runCommand: () =>
    {
        throw new Error("Engine rejected camera");
    } }), /Engine rejected camera/);
});

test("OFF removes any older FOV override without setting a replacement value", () =>
{
    const calls: Array<unknown> = [];
    RestoreCamera({ clear: () => calls.push("clear"),
        setFov: (options?: unknown) => calls.push([ "fov", options ]) });
    assert.deepEqual(calls, [ "clear", [ "fov", undefined ] ]);
});
