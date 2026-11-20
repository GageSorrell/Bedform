/**
 * Reusable spatial access controllers and per-tracker admission: player limits, locks and nested
 * ancestor policies, with stable first-come admission and arrival-ordered vacancies.
 *
 * @module bedform/Spatial/Access
 *
 * @file      Access.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { AccessPolicy } from "./ComponentTypes.js";

/**
 * The access policy contract accepted by the Access prop of widgets, controls and InputScope.
 *
 * @category Model
 * @since 1.0.0
 */
export type { AccessPolicy as Policy } from "./ComponentTypes.js";

/**
 * A player, or anything carrying a player id, that a controller can be locked to.
 *
 * @category Model
 * @since 1.0.0
 */
export type PlayerReference = string | { readonly id: string };

/**
 * Initial controller settings; both take effect on the first input update that sees the controller.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface ControllerOptions {
    readonly MaxPlayers?: number;
    readonly LockedTo?: PlayerReference;
}

/**
 * A stable, reusable access policy. Pass the same controller object as the Access prop of a widget,
 * control or InputScope; reuse across renders keeps its admitted players. SetMaxPlayers, LockTo and
 * Unlock are staged and take effect on the next input update, never in the middle of one. MaxPlayers
 * and LockedTo report the settings currently in effect; Admitted lists the players admitted by the
 * last update, in admission order.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Controller extends AccessPolicy {
    readonly MaxPlayers: number | undefined;
    readonly LockedTo: string | undefined;
    readonly Admitted: ReadonlyArray<string>;
    readonly SetMaxPlayers: (maximum: number | undefined) => void;
    readonly LockTo: (player: PlayerReference) => void;
    readonly Unlock: () => void;
}

/**
 * One player asking for admission this update: the policies governing its target, ancestors first.
 * Only players already eligible (not disabled, within distance and holding any required item) ask.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Request {
    readonly ViewerId: string;
    readonly Policies: ReadonlyArray<AccessPolicy>;
}

/**
 * Per-tracker admission state. Admit returns the ids denied access this update. Admitted reports the
 * players a policy admitted at the last update. Reset forgets every policy's admission history.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Admission {
    readonly Admit: (requests: Iterable<Request>) => ReadonlySet<string>;
    readonly Admitted: (policy: AccessPolicy) => ReadonlyArray<string>;
    readonly Reset: () => void;
}

/**
 * Admission engine options; OnError receives failures of Allows predicates, which deny the player.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface AdmissionOptions {
    readonly OnError?: (error: Error) => void;
}

/**
 * The settings of one controller: in effect, and staged for the next update.
 *
 * @category Model
 * @since 1.0.0
 */
interface Settings {
    MaxPlayers: number | undefined;
    LockedTo: string | undefined;
}

/**
 * Internal controller state behind the frozen public object.
 *
 * @category Model
 * @since 1.0.0
 */
interface ControllerState {
    readonly Current: Settings;
    Staged: Settings | undefined;
    Admitted: ReadonlyArray<string>;
}

/**
 * One policy's admission history within one engine.
 *
 * @category Model
 * @since 1.0.0
 */
interface Slot {
    Admitted: Array<string>;
    readonly Arrivals: Map<string, number>;
}

const Controllers: WeakMap<object, ControllerState> = new WeakMap();

/**
 * Controllers with staged changes, applied by the next input update of any admission engine.
 *
 * @category Model
 * @since 1.0.0
 */
const Staged: Set<ControllerState> = new Set();

/**
 * Validates an optional player limit.
 *
 * @throws { RangeError } If the limit is not a nonnegative safe integer.
 *
 * @category Validation
 * @since 1.0.0
 */
function Maximum(value: number | undefined): number | undefined
{
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
    {
        throw new RangeError("MaxPlayers must be a nonnegative safe integer or undefined.");
    }

    return value;
}

/**
 * Resolves a player reference to its id.
 *
 * @throws { TypeError } If the reference has no nonempty string id.
 *
 * @category Converting
 * @since 1.0.0
 */
function IdOf(player: PlayerReference): string
{
    const id = typeof player === "string" ? player : player?.id;
    if (typeof id !== "string" || !id)
    {
        throw new TypeError("An access lock needs a player or a nonempty player id.");
    }

    return id;
}

/**
 * Creates a reusable access controller. Without settings it admits every player.
 *
 * @throws { RangeError } If MaxPlayers is invalid.
 * @throws { TypeError } If LockedTo is invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function CreateController(options: ControllerOptions = {}): Controller
{
    const initial: Settings = {
        LockedTo: options.LockedTo === undefined ? undefined : IdOf(options.LockedTo),
        MaxPlayers: Maximum(options.MaxPlayers)
    };
    const state: ControllerState = {
        Admitted: Object.freeze([]),
        Current: { ...initial },
        Staged: undefined
    };
    const stage = (change: Partial<Settings>): void =>
    {
        state.Staged = { ...(state.Staged ?? state.Current),
            ...change };
        Staged.add(state);
    };

    const controller: Controller = Object.freeze({
        get Admitted(): ReadonlyArray<string>
        {
            return state.Admitted;
        },
        LockTo: (player: PlayerReference): void => stage({ LockedTo: IdOf(player) }),
        get LockedTo(): string | undefined
        {
            return state.Current.LockedTo;
        },
        get MaxPlayers(): number | undefined
        {
            return state.Current.MaxPlayers;
        },
        SetMaxPlayers: (maximum: number | undefined): void => stage({ MaxPlayers: Maximum(maximum) }),
        Unlock: (): void => stage({ LockedTo: undefined })
    });
    Controllers.set(controller, state);
    return controller;
}

/**
 * Checks whether a policy is a controller created by CreateController.
 *
 * @category Predicate
 * @since 1.0.0
 */
export function IsController(policy: unknown): policy is Controller
{
    return typeof policy === "object" && policy !== null && Controllers.has(policy);
}

/**
 * Creates an admission engine. Each Admit call is one input update:
 *
 * - Every staged controller change is applied first, so lock and limit changes take effect on this
 *   update, whether or not anyone is aiming at the controller.
 * - Policies are evaluated ancestors first. A player denied by an ancestor is not counted by, and
 *   cannot be admitted to, any descendant policy. A policy reused at several depths is evaluated once,
 *   at its shallowest depth, counting every player whose policies include it.
 * - A policy counts the distinct players asking through it. Players rejected by its Allows predicate
 *   (or whose predicate throws) are denied and not counted.
 * - Admitted players keep their places while they keep asking. A lock keeps only the locked player.
 *   A lowered limit keeps the earliest admitted players. Vacancies are filled in arrival order (the
 *   update a player started asking continuously), breaking ties by player id.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function CreateAdmission(options: AdmissionOptions = {}): Admission
{
    let update = 0;
    const slots = new Map<AccessPolicy, Slot>();
    const report = (error: unknown): void =>
    {
        try
        {
            options.OnError?.(error instanceof Error ? error : new Error(String(error)));
        }
        catch
        {
            /* Diagnostics cannot interrupt admission. */
        }
    };

    const publish = (policy: AccessPolicy, admitted: ReadonlyArray<string>): void =>
    {
        const state = Controllers.get(policy);
        if (state)
        {
            state.Admitted = Object.freeze([ ...admitted ]);
        }
    };

    const admit = (input: Iterable<Request>): ReadonlySet<string> =>
    {
        update++;
        const requests = new Map<string, Request>();
        for (const request of input)
        {
            if (request && typeof request.ViewerId === "string" && !requests.has(request.ViewerId))
            {
                requests.set(request.ViewerId, request);
            }
        }

        const depth = new Map<AccessPolicy, number>();
        for (const request of requests.values())
        {
            request.Policies.forEach((policy: AccessPolicy, index: number) =>
            {
                if (policy && typeof policy === "object" && (depth.get(policy) ?? Infinity) > index)
                {
                    depth.set(policy, index);
                }
            });
        }

        const ordered = [ ...depth.keys() ].sort(
            (a: AccessPolicy, b: AccessPolicy) => depth.get(a)! - depth.get(b)!
        );
        for (const state of Staged)
        {
            Object.assign(state.Current, state.Staged);
            state.Staged = undefined;
        }

        Staged.clear();

        const denied = new Set<string>();
        for (const policy of ordered)
        {
            const state = Controllers.get(policy);
            const maximum = state ? state.Current.MaxPlayers : policy.MaxPlayers;
            const lock = state ? state.Current.LockedTo : policy.LockedTo;
            const asking: Array<string> = [];
            for (const request of requests.values())
            {
                if (denied.has(request.ViewerId) || !request.Policies.includes(policy))
                {
                    continue;
                }

                let allowed = true;
                if (typeof policy.Allows === "function")
                {
                    try
                    {
                        allowed = policy.Allows(request.ViewerId) === true;
                    }
                    catch (error)
                    {
                        report(new Error(`Access predicate failed for ${request.ViewerId}.`,
                            { cause: error }));
                        allowed = false;
                    }
                }

                if (allowed)
                {
                    asking.push(request.ViewerId);
                }
                else
                {
                    denied.add(request.ViewerId);
                }
            }

            const slot = slots.get(policy) ?? {
                Admitted: [],
                Arrivals: new Map<string, number>()
            };
            slots.set(policy, slot);
            const present = new Set(asking);
            for (const id of [ ...slot.Arrivals.keys() ])
            {
                if (!present.has(id))
                {
                    slot.Arrivals.delete(id);
                }
            }

            for (const id of asking)
            {
                if (!slot.Arrivals.has(id))
                {
                    slot.Arrivals.set(id, update);
                }
            }

            const permitted = (id: string): boolean => present.has(id) && (lock === undefined || id === lock);
            const limit =
                maximum === undefined || !Number.isFinite(maximum) ? Infinity : Math.max(0, maximum);
            const admitted = slot.Admitted.filter(permitted).slice(0, limit);
            const waiting = asking
                .filter((id: string) => permitted(id) && !admitted.includes(id))
                .sort(
                    (a: string, b: string) =>
                        slot.Arrivals.get(a)! - slot.Arrivals.get(b)! || (a < b ? -1 : a > b ? 1 : 0)
                );
            for (const id of waiting)
            {
                if (admitted.length >= limit)
                {
                    break;
                }

                admitted.push(id);
            }

            slot.Admitted = admitted;
            publish(policy, admitted);
            for (const id of asking)
            {
                if (!admitted.includes(id))
                {
                    denied.add(id);
                }
            }
        }

        for (const policy of [ ...slots.keys() ])
        {
            if (!depth.has(policy))
            {
                slots.delete(policy);
                publish(policy, []);
            }
        }

        return denied;
    };

    return Object.freeze({
        Admit: admit,
        Admitted: (policy: AccessPolicy): ReadonlyArray<string> =>
            Object.freeze([ ...(slots.get(policy)?.Admitted ?? []) ]),
        Reset: (): void =>
        {
            for (const policy of slots.keys())
            {
                publish(policy, []);
            }

            slots.clear();
        }
    });
}
