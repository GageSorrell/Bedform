/**
 * Public root and subpath protocol declarations agree and preserve inference.
 *
 * @module @bedform/effect/Test/Protocols.types
 *
 * @file      Protocols.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Public consumer fixtures retain callback inference and deliberate property order. */
/* eslint-disable @typescript-eslint/typedef, @typescript-eslint/no-unused-vars, sort-imports, @stylistic/max-len */

import * as Root from "@bedform/effect";
import * as Equal from "@bedform/effect/Equal";
import type * as Hash from "@bedform/effect/Hash";
import * as Equivalence from "@bedform/effect/Equivalence";
import * as Order from "@bedform/effect/Order";
import * as Ordering from "@bedform/effect/Ordering";
import type * as Pipeable from "@bedform/effect/Pipeable";
import type * as Inspectable from "@bedform/effect/Inspectable";
import * as Formatter from "@bedform/effect/Formatter";
import { Sample } from "./Protocols.fixture.mjs";

const Value = new Sample(3);
const EqualValue: Root.Equal.Equal = Value as Equal.Equal;
const HashValue: Root.Hash.Hash = Value as Hash.Hash;
const Piped: string = Value.pipe((self) => self.value, (value) => String(value));
const PipeValue: Root.Pipeable.Pipeable = Value as Pipeable.Pipeable;
const Inspected: Root.Inspectable.Inspectable = Value as Inspectable.Inspectable;
const Relation: Root.Equivalence.Equivalence<Sample> = Equivalence.make((a: Sample, b) => a.value === b.value);
const Compare: Root.Order.Order<Sample> = Order.mapInput(Order.Number, (value: Sample) => value.value);
const Result: Root.Ordering.Ordering = Ordering.reverse(Compare(Value, Value));
const Render: Root.Formatter.Formatter<Sample> = Formatter.format;
const Symbol: Inspectable.NodeInspectSymbol = Root.Inspectable.NodeInspectSymbol;
// @ts-expect-error Ordering results are limited to three numeric literals.
const InvalidOrder: Ordering.Ordering = 2;
// @ts-expect-error Equality implementations must also provide a hash method.
const MissingHash: Equal.Equal = { [Equal.symbol]: () => true };
// @ts-expect-error Pipe callbacks receive the actual value type.
Value.pipe((self: string) => self.length);
