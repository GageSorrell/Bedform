/**
 * Host checks for the World input demonstration's chat filtering and display formatting.
 *
 * @module @sorrell/world-input-demo/Test/Format.test
 *
 * @file      Format.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { axis, chats, describe, held, parseChatMode } from "../Script/Format.js";
import Assert from "node:assert/strict";
import { test } from "node:test";

test("chat modes parse case-insensitively and filter movement gestures in buttons mode", () =>
{
    Assert.equal(parseChatMode(" Buttons "), "buttons");
    Assert.equal(parseChatMode("loud"), undefined);
    Assert.ok(chats("all", "ForwardRight"));
    Assert.ok(chats("buttons", "Sneak"));
    Assert.ok(!chats("buttons", "Forward"));
    Assert.ok(!chats("off", "Jump"));
});

test("events, axes and held buttons format deterministically", () =>
{
    Assert.equal(describe("Hold", { button: "Jump",
        duration: 8,
        phase: "End",
        playerId: "a",
        reason: "Death",
        tapCount: 0,
        tick: 120 }), "Hold End (Death) Jump tick=120 taps=0 duration=8");
    Assert.equal(describe("DoubleTap", { button: "Sneak",
        duration: 1,
        playerId: "a",
        tapCount: 2,
        tick: 9 }), "DoubleTap Sneak tick=9 taps=2 duration=1");
    Assert.deepEqual([ axis(0.2), axis(-0.204), axis(-0.001), axis(Number.NaN) ],
        [ "+0.20", "-0.20", "+0.00", "?" ]);
    Assert.equal(held(new Set([ "ForwardRight", "Right", "Forward" ])), "Forward Right ForwardRight");
    Assert.equal(held(new Set()), "-");
});
