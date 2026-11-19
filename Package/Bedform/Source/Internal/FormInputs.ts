/**
 * Per-form registry of value-bearing inputs, so form components can observe
 * and rewrite every input a form holds, including inputs added after them.
 *
 * @module bedform/Internal/FormInputs
 *
 * @file      FormInputs.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * A comparable value of a tracked input. Undefined represents an empty input,
 * such as a direction dropdown with no selection.
 *
 * @category Types
 * @since 1.0.0
 */
export type InputSnapshot = string | number | boolean | undefined;

/**
 * A form input whose value can be read, rewritten and observed. Subscribing
 * returns a function that removes only that subscription.
 *
 * @category Types
 * @since 1.0.0
 */
export interface TrackedInput
{
    read(): InputSnapshot;
    write(value: InputSnapshot): void;
    subscribe(listener: (value: InputSnapshot) => void): () => void;
}

/**
 * The value-bearing subset of a native DDUI observable, such as
 * `ObservableString`, `ObservableNumber` or `ObservableBoolean`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface NativeObservable<Data extends string | number | boolean>
{
    getData(): Data;
    setData(data: Data): void;
    subscribe(callback: (data: Data) => void): (data: Data) => void;
    unsubscribe(callback: (data: Data) => void): boolean;
}

/**
 * The inputs registered on one form, the callbacks observing them, and the
 * depth of `Untracked` bodies currently running for it.
 *
 * @category Types
 * @since 1.0.0
 */
interface Registry
{
    readonly Inputs: Array<TrackedInput>;
    readonly Observers: Set<(input: TrackedInput) => void>;
    Suppressed: number;
}

const Registries: WeakMap<object, Registry> = new WeakMap();

/**
 * Returns the form's registry, creating an empty one on first use.
 *
 * @category Getter
 * @since 1.0.0
 */
const RegistryOf = (form: object): Registry =>
{
    let registry = Registries.get(form);
    if (registry === undefined)
    {
        registry = { Inputs: [],
            Observers: new Set(),
            Suppressed: 0 };
        Registries.set(form, registry);
    }

    return registry;
};

/**
 * Adds an input to the form's registry and reports it to the form's observers.
 * Inside an `Untracked` body for the same form, the input is ignored, as is an
 * input that is already registered.
 *
 * @category Registry
 * @since 1.0.0
 */
export const RegisterInput = (form: object, input: TrackedInput): void =>
{
    const registry = RegistryOf(form);
    if (registry.Suppressed > 0 || registry.Inputs.includes(input))
    {
        return;
    }

    registry.Inputs.push(input);
    for (const observer of [ ...registry.Observers ])
    {
        observer(input);
    }
};

/**
 * Reports each input already registered on the form, in registration order,
 * and then each input registered later, until the returned function is called.
 *
 * @category Registry
 * @since 1.0.0
 */
export const ObserveInputs = (form: object, callback: (input: TrackedInput) => void): () => void =>
{
    const registry = RegistryOf(form);
    const observer = (input: TrackedInput): void => callback(input);
    registry.Observers.add(observer);
    for (const input of [ ...registry.Inputs ])
    {
        if (registry.Observers.has(observer))
        {
            callback(input);
        }
    }

    return (): void =>
    {
        registry.Observers.delete(observer);
    };
};

/**
 * Runs the body and returns its result without registering any input on the
 * form, for components that bind internal observables and register their own
 * adapter instead.
 *
 * @category Registry
 * @since 1.0.0
 */
export const Untracked = <Result>(form: object, body: () => Result): Result =>
{
    const registry = RegistryOf(form);
    registry.Suppressed++;
    try
    {
        return body();
    }
    finally
    {
        registry.Suppressed--;
    }
};

/**
 * Adapts a native observable as a tracked input. Each subscription installs
 * its own native callback, so unsubscribing leaves other callbacks in place.
 *
 * @throws { TypeError } From `write`, if the value's type differs from the observable's.
 *
 * @category Adapter
 * @since 1.0.0
 */
export const ObservableInput = <Data extends string | number | boolean>(
    observable: NativeObservable<Data>
): TrackedInput =>
{
    return {
        read: (): InputSnapshot => observable.getData(),
        subscribe: (listener: (value: InputSnapshot) => void): (() => void) =>
        {
            const callback = (data: Data): void => listener(data);
            observable.subscribe(callback);
            return (): void =>
            {
                observable.unsubscribe(callback);
            };
        },
        write: (value: InputSnapshot): void =>
        {
            const current = observable.getData();
            if (typeof value !== typeof current)
            {
                throw new TypeError(`Cannot write a ${typeof value} to a ${typeof current} observable.`);
            }

            observable.setData(value as Data);
        }
    };
};
