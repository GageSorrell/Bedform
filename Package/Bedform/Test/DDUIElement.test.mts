/**
 * Published JSX descriptors share identity, key semantics, and pure build-mode behavior.
 *
 * @module bedform/Test/DDUIElement.test
 *
 * @file      DDUIElement.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Fragment, StrictMode, isValidElement } from "../Distribution/DDUI/index.js";
import Assert from "node:assert/strict";
import { jsx } from "../Distribution/DDUI/jsx-runtime.js";
import { jsxDEV } from "../Distribution/DDUI/jsx-dev-runtime.js";
import { test } from "node:test";

test("automatic runtimes share pure immutable descriptors and keep keys separate from props", () =>
{
    const Props = { children: "text",
        key: 1 };
    const Element = jsx(Fragment, Props);
    Assert.equal(StrictMode, false);
    Assert.equal(Element.type, Fragment);
    Assert.equal(Element.key, "1");
    Assert.equal(Object.hasOwn(Element.props, "key"), false);
    Assert.equal(Props.key, 1);
    Assert.ok(Object.isFrozen(Element));
    Assert.ok(Object.isFrozen(Element.props));
    Assert.equal(jsx(Fragment, Props, 2).key, "2");
    Assert.equal(Fragment({ children: "text" }), "text");
    Assert.ok(isValidElement(Element));
    Assert.ok(!isValidElement({}));
    Assert.ok(!isValidElement(null));
    const Development = jsxDEV(Fragment, Props, 3, true,
        { columnNumber: 1,
            fileName: "example.tsx",
            lineNumber: 2 }, undefined);
    Assert.ok(isValidElement(Development));
    Assert.equal(Development.source, undefined);
});

test("runtime entrypoints reject DOM, class, and asynchronous component constructors", () =>
{
    Assert.throws(() => jsx("div" as never, null), /synchronous function/u);
    Assert.throws(() => jsx(class {} as never, null), /synchronous function/u);
    Assert.throws(() => jsx((async () => "async") as never, null), /synchronous function/u);
});
