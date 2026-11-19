/**
 * Pure chunked undo/redo history over tracked form inputs, with an undoable
 * reset to every input's initial value and an injectable clock for tests.
 *
 * @module bedform/Internal/TransactionHistory
 *
 * @file      TransactionHistory.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { InputSnapshot, TrackedInput } from "./FormInputs.js";

export namespace TransactionHistory
{
    /**
     * Configures chunking and retention. `chunkWindow` is the milliseconds of
     * inactivity that end a chunk and defaults to 1000; `historyLimit` is the
     * most entries kept and defaults to 100; `now` reads the clock in
     * milliseconds and defaults to `Date.now`.
     *
     * @category Configuration
     * @since 1.0.0
     */
    export interface Options
    {
        readonly chunkWindow?: number;
        readonly historyLimit?: number;
        readonly now?: () => number;
    }

    /**
     * Why the history's state changed: an input edit was recorded (including
     * the removal of a chunk that returned to its starting values), or an
     * entry was undone, redone or created by a reset.
     *
     * @category Types
     * @since 1.0.0
     */
    export type Event = "Record" | "Undo" | "Redo" | "Reset";
}

/**
 * One input's value before and after an entry.
 *
 * @category Types
 * @since 1.0.0
 */
interface Change
{
    readonly Before: InputSnapshot;
    After: InputSnapshot;
}

/**
 * An insertion-ordered set of input changes that undo and redo as one step.
 *
 * @category Types
 * @since 1.0.0
 */
type Entry = Map<TrackedInput, Change>;

/**
 * Compares snapshots, treating NaN as equal to itself.
 *
 * @category Utility
 * @since 1.0.0
 */
const Same = (left: InputSnapshot, right: InputSnapshot): boolean =>
{
    return left === right || (Number.isNaN(left) && Number.isNaN(right));
};

/**
 * Records edits to tracked inputs as chunked entries. A change joins the open
 * chunk when it happens in the same synchronous turn as the chunk's last
 * change, or when it repeats the input that began the last turn within the
 * chunk window; otherwise it begins a new chunk. A chunk whose inputs all end
 * at their starting values is removed. Undo, redo and reset seal the open
 * chunk, and changes caused while they write, or that repeat the last known
 * value, are not recorded.
 *
 * @throws { RangeError } From the constructor, if `chunkWindow` is negative or not finite,
 * or `historyLimit` is not a positive integer.
 *
 * @category Model
 * @since 1.0.0
 */
export class TransactionHistory
{
    private readonly ChunkWindow: number;
    private readonly HistoryLimit: number;
    private readonly Now: () => number;
    private readonly Inputs: Array<TrackedInput> = [];
    private readonly Known: Map<TrackedInput, InputSnapshot> = new Map();
    private readonly Initial: Map<TrackedInput, InputSnapshot> = new Map();
    private readonly Unsubscribes: Array<() => void> = [];
    private readonly Listeners: Set<(event: TransactionHistory.Event) => void> = new Set();
    private readonly Entries: Array<Entry> = [];
    private Cursor: number = 0;
    private Open: Entry | undefined = undefined;
    private TurnInput: TrackedInput | undefined = undefined;
    private LastTime: number = 0;
    private InTurn: boolean = false;
    private Applying: number = 0;
    private Disposed: boolean = false;

    public constructor(options?: TransactionHistory.Options)
    {
        this.ChunkWindow = options?.chunkWindow ?? 1_000;
        this.HistoryLimit = options?.historyLimit ?? 100;
        this.Now = options?.now ?? Date.now;
        if (!Number.isFinite(this.ChunkWindow) || this.ChunkWindow < 0)
        {
            throw new RangeError("A transaction chunk window must be a finite, nonnegative number.");
        }

        if (!Number.isSafeInteger(this.HistoryLimit) || this.HistoryLimit < 1)
        {
            throw new RangeError("A transaction history limit must be a positive integer.");
        }
    }

    /**
     * Whether an entry can be undone.
     *
     * @category Getter
     * @since 1.0.0
     */
    public get canUndo(): boolean
    {
        return this.Cursor > 0;
    }

    /**
     * Whether an undone entry can be redone.
     *
     * @category Getter
     * @since 1.0.0
     */
    public get canRedo(): boolean
    {
        return this.Cursor < this.Entries.length;
    }

    /**
     * Whether any tracked input differs from the value it held when tracked.
     *
     * @category Getter
     * @since 1.0.0
     */
    public get canReset(): boolean
    {
        return this.Inputs.some((input: TrackedInput) =>
            !Same(this.Known.get(input), this.Initial.get(input)));
    }

    /**
     * Starts recording an input, taking its current value as both its initial
     * and last known value. Tracking an input again, or after disposal, does nothing.
     *
     * @category Registry
     * @since 1.0.0
     */
    public track(input: TrackedInput): void
    {
        if (this.Disposed || this.Known.has(input))
        {
            return;
        }

        const value = input.read();
        this.Inputs.push(input);
        this.Known.set(input, value);
        this.Initial.set(input, value);
        this.Unsubscribes.push(input.subscribe((snapshot: InputSnapshot) => this.Changed(input, snapshot)));
    }

    /**
     * Calls the listener after each recorded edit, undo, redo and reset, until
     * the returned function is called.
     *
     * @category Observable
     * @since 1.0.0
     */
    public subscribe(listener: (event: TransactionHistory.Event) => void): () => void
    {
        const callback = (event: TransactionHistory.Event): void => listener(event);
        this.Listeners.add(callback);
        return (): void =>
        {
            this.Listeners.delete(callback);
        };
    }

    /**
     * Ends the open chunk, so the next edit begins a new entry.
     *
     * @category Mutation
     * @since 1.0.0
     */
    public seal(): void
    {
        this.Open = undefined;
        this.TurnInput = undefined;
    }

    /**
     * Restores the latest entry's earlier values, last change first. Returns
     * false when there is nothing to undo.
     *
     * @category Mutation
     * @since 1.0.0
     */
    public undo(): boolean
    {
        if (this.Disposed || !this.canUndo)
        {
            return false;
        }

        this.seal();
        this.Cursor--;
        const changes = [ ...this.Entries[this.Cursor] ].reverse();
        this.Apply(changes.map(([ input, change ]: [ TrackedInput, Change ]) => [ input, change.Before ]));
        this.Notify("Undo");
        return true;
    }

    /**
     * Reapplies the earliest undone entry's later values, in their original
     * order. Returns false when there is nothing to redo.
     *
     * @category Mutation
     * @since 1.0.0
     */
    public redo(): boolean
    {
        if (this.Disposed || !this.canRedo)
        {
            return false;
        }

        this.seal();
        const changes = [ ...this.Entries[this.Cursor] ];
        this.Cursor++;
        this.Apply(changes.map(([ input, change ]: [ TrackedInput, Change ]) => [ input, change.After ]));
        this.Notify("Redo");
        return true;
    }

    /**
     * Records one entry returning every changed input to its initial value,
     * then applies it, discarding any undone entries. Returns false, recording
     * nothing, when every input already holds its initial value.
     *
     * @category Mutation
     * @since 1.0.0
     */
    public reset(): boolean
    {
        if (this.Disposed)
        {
            return false;
        }

        this.seal();
        const entry: Entry = new Map();
        for (const input of this.Inputs)
        {
            const before = this.Known.get(input);
            const after = this.Initial.get(input);
            if (!Same(before, after))
            {
                entry.set(input, { After: after,
                    Before: before });
            }
        }

        if (entry.size === 0)
        {
            return false;
        }

        this.Push(entry);
        this.Apply([ ...entry ].map(([ input, change ]: [ TrackedInput, Change ]) =>
            [ input, change.After ]));
        this.Notify("Reset");
        return true;
    }

    /**
     * Stops observing every tracked input and listener; later calls do nothing.
     *
     * @category Lifecycle
     * @since 1.0.0
     */
    public dispose(): void
    {
        this.Disposed = true;
        for (const unsubscribe of this.Unsubscribes.splice(0))
        {
            unsubscribe();
        }

        this.Listeners.clear();
    }

    /**
     * Records a reported input value according to the chunking rules.
     *
     * @category Mutation
     * @since 1.0.0
     */
    private Changed(input: TrackedInput, value: InputSnapshot): void
    {
        const before = this.Known.get(input);
        if (this.Disposed || Same(value, before))
        {
            return;
        }

        this.Known.set(input, value);
        if (this.Applying > 0)
        {
            return;
        }

        const now = this.Now();
        const merge = this.Open !== undefined && (this.InTurn ||
            (input === this.TurnInput && now - this.LastTime < this.ChunkWindow));
        if (!this.InTurn)
        {
            this.InTurn = true;
            this.TurnInput = input;
            void Promise.resolve().then(() =>
            {
                this.InTurn = false;
            });
        }

        this.LastTime = now;
        if (merge && this.Open !== undefined)
        {
            const change = this.Open.get(input);
            if (change === undefined)
            {
                this.Open.set(input, { After: value,
                    Before: before });
            }
            else
            {
                change.After = value;
            }

            if ([ ...this.Open.values() ].every((item: Change) => Same(item.Before, item.After)))
            {
                this.Entries.splice(this.Entries.indexOf(this.Open), 1);
                this.Cursor = this.Entries.length;
                this.Open = undefined;
            }
        }
        else
        {
            this.Open = new Map([ [ input, { After: value,
                Before: before } ] ]);
            this.Push(this.Open);
        }

        this.Notify("Record");
    }

    /**
     * Discards undone entries, appends an entry and drops the oldest entries
     * beyond the history limit.
     *
     * @category Mutation
     * @since 1.0.0
     */
    private Push(entry: Entry): void
    {
        this.Entries.length = this.Cursor;
        this.Entries.push(entry);
        if (this.Entries.length > this.HistoryLimit)
        {
            this.Entries.splice(0, this.Entries.length - this.HistoryLimit);
        }

        this.Cursor = this.Entries.length;
    }

    /**
     * Writes values in order, updating each known value first, without
     * recording the writes or anything they cause.
     *
     * @category Mutation
     * @since 1.0.0
     */
    private Apply(values: ReadonlyArray<readonly [ TrackedInput, InputSnapshot ]>): void
    {
        this.Applying++;
        try
        {
            for (const [ input, value ] of values)
            {
                this.Known.set(input, value);
                input.write(value);
            }
        }
        finally
        {
            this.Applying--;
        }
    }

    /**
     * Reports a state change to every listener.
     *
     * @category Observable
     * @since 1.0.0
     */
    private Notify(event: TransactionHistory.Event): void
    {
        for (const listener of [ ...this.Listeners ])
        {
            listener(event);
        }
    }
}
