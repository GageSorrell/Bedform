/**
 * Verifies chunking, undo, redo, reset, retention and notification filtering
 * of the pure transaction history with fake inputs and an injected clock.
 *
 * @module bedform/Test/TransactionHistory.test
 *
 * @file      TransactionHistory.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { InputSnapshot, TrackedInput } from "../Source/Internal/FormInputs.js";
import { TransactionHistory } from "../Source/Internal/TransactionHistory.js";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * A tracked input double that notifies synchronously when its value changes,
 * records every write, and can emit arbitrary notifications.
 *
 * @category Testing
 * @since 1.0.0
 */
class FakeInput implements TrackedInput
{
    public Value: InputSnapshot;
    public readonly Writes: Array<InputSnapshot> = [];
    private readonly Listeners: Set<(value: InputSnapshot) => void> = new Set();

    public constructor(value: InputSnapshot)
    {
        this.Value = value;
    }

    public read(): InputSnapshot
    {
        return this.Value;
    }

    public write(value: InputSnapshot): void
    {
        this.Writes.push(value);
        this.set(value);
    }

    public set(value: InputSnapshot): void
    {
        if (value !== this.Value)
        {
            this.Value = value;
            this.emit(value);
        }
    }

    public emit(value: InputSnapshot): void
    {
        for (const listener of [ ...this.Listeners ])
        {
            listener(value);
        }
    }

    public subscribe(listener: (value: InputSnapshot) => void): () => void
    {
        const callback = (value: InputSnapshot): void => listener(value);
        this.Listeners.add(callback);
        return (): void =>
        {
            this.Listeners.delete(callback);
        };
    }

    public get listenerCount(): number
    {
        return this.Listeners.size;
    }
}

namespace Fixture
{
    /**
     * A mutable clock reading, in milliseconds.
     *
     * @category Testing
     * @since 1.0.0
     */
    export interface Clock
    {
        time: number;
    }
}

/**
 * A history under test, its clock and its tracked inputs.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Fixture
{
    readonly clock: Fixture.Clock;
    readonly history: TransactionHistory;
    readonly inputs: Array<FakeInput>;
}

/**
 * Builds a history with a controllable clock and tracked inputs.
 *
 * @category Testing
 * @since 1.0.0
 */
const Harness = (
    values: ReadonlyArray<InputSnapshot>,
    options?: TransactionHistory.Options
): Fixture =>
{
    const clock: Fixture.Clock = { time: 0 };
    const history = new TransactionHistory({ now: (): number => clock.time,
        ...options });
    const inputs = values.map((value: InputSnapshot) => new FakeInput(value));
    for (const input of inputs)
    {
        history.track(input);
    }

    return { clock,
        history,
        inputs };
};

/**
 * Ends the current synchronous turn.
 *
 * @category Testing
 * @since 1.0.0
 */
const Turn = async (): Promise<void> =>
{
    await Promise.resolve();
};

test("edits to one input merge within the idle window and split after it", async () =>
{
    const { clock, history, inputs: [ text ] } = Harness([ "" ]);
    for (const [ time, value ] of [ [ 0, "a" ], [ 500, "ab" ], [ 1400, "abc" ], [ 2400, "abcd" ] ] as const)
    {
        clock.time = time;
        text.set(value);
        await Turn();
    }

    assert.equal(history.undo(), true);
    assert.equal(text.Value, "abc");
    assert.equal(history.undo(), true);
    assert.equal(text.Value, "");
    assert.equal(history.undo(), false);
    assert.equal(history.redo(), true);
    assert.equal(text.Value, "abc");
    assert.equal(history.redo(), true);
    assert.equal(text.Value, "abcd");
    assert.equal(history.canRedo, false);
});

test("a different input in a later turn begins a new chunk and seals the earlier one", async () =>
{
    const { history, inputs: [ first, second ] } = Harness([ 0, false ]);
    first.set(1);
    await Turn();
    second.set(true);
    await Turn();
    first.set(2);
    await Turn();
    history.undo();
    assert.deepEqual([ first.Value, second.Value ], [ 1, true ]);
    history.undo();
    assert.deepEqual([ first.Value, second.Value ], [ 1, false ]);
    history.undo();
    assert.deepEqual([ first.Value, second.Value ], [ 0, false ]);
    assert.equal(history.canUndo, false);
});

test("changes in one synchronous turn, including cascades, form one step", async () =>
{
    const { clock, history, inputs: [ source, derived, other ] } = Harness([ 1, 2, "x" ]);
    source.subscribe((value: InputSnapshot) => derived.set(Number(value) * 2));
    source.set(5);
    other.set("y");
    assert.deepEqual([ source.Value, derived.Value, other.Value ], [ 5, 10, "y" ]);
    await Turn();
    clock.time = 2000;
    source.set(6);
    await Turn();
    assert.equal(history.undo(), true);
    assert.deepEqual([ source.Value, derived.Value, other.Value ], [ 5, 10, "y" ]);
    assert.equal(history.undo(), true);
    assert.deepEqual([ source.Value, derived.Value, other.Value ], [ 1, 2, "x" ]);
    assert.deepEqual(derived.Writes, [ 10, 2 ]);
    assert.equal(history.canUndo, false);
    assert.equal(history.redo(), true);
    assert.deepEqual([ source.Value, derived.Value, other.Value ], [ 5, 10, "y" ]);
});

test("a chunk that returns to its starting values is removed", async () =>
{
    const { clock, history, inputs: [ text ] } = Harness([ "" ]);
    text.set("a");
    await Turn();
    clock.time = 3000;
    text.set("ab");
    await Turn();
    clock.time = 3100;
    text.set("a");
    await Turn();
    assert.equal(history.undo(), true);
    assert.equal(text.Value, "");
    assert.equal(history.canUndo, false);
    assert.equal(history.canRedo, true);
    assert.equal(history.canReset, false);
});

test("a new edit discards undone entries", async () =>
{
    const { clock, history, inputs: [ text ] } = Harness([ "" ]);
    text.set("a");
    await Turn();
    clock.time = 5000;
    text.set("b");
    await Turn();
    history.undo();
    assert.equal(history.canRedo, true);
    clock.time = 5100;
    text.set("c");
    await Turn();
    assert.equal(history.canRedo, false);
    history.undo();
    assert.equal(text.Value, "a");
    history.undo();
    assert.equal(text.Value, "");
    assert.equal(history.canUndo, false);
});

test("the oldest entries are dropped beyond the history limit", async () =>
{
    const { clock, history, inputs: [ level ] } = Harness([ 0 ], { historyLimit: 2 });
    for (const value of [ 1, 2, 3 ])
    {
        clock.time = value * 2000;
        level.set(value);
        await Turn();
    }

    assert.equal(history.undo(), true);
    assert.equal(history.undo(), true);
    assert.equal(history.undo(), false);
    assert.equal(level.Value, 1);
    assert.equal(history.canReset, true);
});

test("reset is one undoable and redoable entry over every changed input", async () =>
{
    const { history, inputs: [ first, second, third ] } = Harness([ "a", 1, undefined ]);
    assert.equal(history.canReset, false);
    assert.equal(history.reset(), false);
    assert.equal(history.canUndo, false);
    first.set("b");
    await Turn();
    third.set("North");
    await Turn();
    assert.equal(history.canReset, true);
    assert.equal(history.reset(), true);
    assert.deepEqual([ first.Value, second.Value, third.Value ], [ "a", 1, undefined ]);
    assert.deepEqual(second.Writes, []);
    assert.equal(history.canReset, false);
    assert.equal(history.undo(), true);
    assert.deepEqual([ first.Value, third.Value ], [ "b", "North" ]);
    assert.equal(history.canReset, true);
    assert.equal(history.redo(), true);
    assert.deepEqual([ first.Value, third.Value ], [ "a", undefined ]);
    history.undo();
    history.undo();
    assert.deepEqual([ first.Value, third.Value ], [ "b", undefined ]);
});

test("echoes, late duplicates and cascades from history writes are not recorded", async () =>
{
    const { clock, history, inputs: [ source, derived ] } = Harness([ 0, 0 ]);
    source.set(1);
    await Turn();
    clock.time = 2000;
    source.set(2);
    await Turn();
    source.emit(2);
    source.subscribe((value: InputSnapshot) => derived.set(Number(value) + 100));
    history.undo();
    assert.deepEqual([ source.Value, derived.Value ], [ 1, 101 ]);
    source.emit(1);
    await Turn();
    source.emit(1);
    assert.equal(history.canRedo, true);
    assert.equal(history.canUndo, true);
    history.undo();
    assert.equal(source.Value, 0);
    assert.equal(history.canUndo, false);
    assert.equal(history.canReset, true);
});

test("listeners hear each state change until unsubscribed, and disposal stops tracking", async () =>
{
    const { history, inputs: [ input ] } = Harness([ 0 ]);
    const events: Array<TransactionHistory.Event> = [];
    const stop = history.subscribe((event: TransactionHistory.Event) => events.push(event));
    input.set(1);
    await Turn();
    history.undo();
    history.redo();
    history.reset();
    history.track(input);
    assert.equal(input.listenerCount, 1);
    assert.deepEqual(events, [ "Record", "Undo", "Redo", "Reset" ]);
    stop();
    history.undo();
    assert.equal(events.length, 4);
    history.dispose();
    assert.equal(input.listenerCount, 0);
    assert.equal(history.undo(), false);
    assert.equal(history.reset(), false);
    const late = new FakeInput(0);
    history.track(late);
    assert.equal(late.listenerCount, 0);
});

test("invalid options are rejected", () =>
{
    for (const options of [ { chunkWindow: -1 }, { chunkWindow: Number.NaN }, { historyLimit: 0 },
        { historyLimit: 1.5 } ])
    {
        assert.throws(() => new TransactionHistory(options), RangeError);
    }

    assert.doesNotThrow(() => new TransactionHistory({ chunkWindow: 0,
        historyLimit: 1 }));
});
