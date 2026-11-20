/**
 * Qualifies spatial access controllers and admission: player limits, stable arrival ordering, nested
 * ancestor policies, lock/unlock/relock timing and pointer-tracker integration.
 *
 * @module bedform/Test/SpatialAccess.test
 *
 * @file      SpatialAccess.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Scenario fixtures keep players in reading order and infer callback types from public contracts. */

/* eslint-disable sort-keys, @typescript-eslint/typedef */

import * as Access from "../Source/Spatial/Access.js";
import * as Layout from "../Source/Spatial/Layout.js";
import * as Pointer from "../Source/Spatial/Pointer.js";
import { Kind } from "../Source/Spatial/Internal/ComponentKind.js";
import type { Node } from "../Source/Spatial/Internal/Surface.js";
import assert from "node:assert/strict";
import { test } from "node:test";

let Next = 0;
const World = "test:world";

/**
 * Builds admission requests for players asking through the same policy chain.
 *
 * @category Testing
 * @since 1.0.0
 */
function Ask(ids: Array<string>, ...policies: Array<Access.Policy>): Array<Access.Request>
{
    return ids.map((id) => ({ ViewerId: id,
        Policies: policies }));
}

/**
 * Returns the admitted subset of the asking players, in request order.
 *
 * @category Testing
 * @since 1.0.0
 */
function Allowed(denied: ReadonlySet<string>, requests: Array<Access.Request>): Array<string>
{
    return requests.map((request) => request.ViewerId).filter((id) => !denied.has(id));
}

/**
 * Creates a structural host node.
 *
 * @category Testing
 * @since 1.0.0
 */
function N(Type: string, Props: Record<string, unknown> = {}, Children: Array<Node> = []): Node
{
    return { Id: ++Next,
        Type,
        Props,
        Children,
        Hidden: false };
}

/**
 * Creates a Text node with one scalar child.
 *
 * @category Testing
 * @since 1.0.0
 */
function T(value: string): Node
{
    return N(Kind.Text, {}, [ { Id: ++Next,
        Type: "#text",
        Props: {},
        Children: [],
        Hidden: false,
        Text: value } ]);
}

/**
 * A ray from 4 blocks in front of an identity-oriented View at y = 10 to a local point.
 *
 * @category Testing
 * @since 1.0.0
 */
function Aim(x: number, y: number): Pointer.Ray
{
    return { Origin: { x: x / 16,
        y: 10 - y / 16,
        z: 4 },
    Direction: { x: 0,
        y: 0,
        z: -1 } };
}

/**
 * A minimal player fake whose ray can be changed between updates.
 *
 * @category Testing
 * @since 1.0.0
 */
function Player(id: string, ray: Pointer.Ray): Pointer.Player & { Ray: Pointer.Ray }
{
    const player = {
        id,
        isValid: true,
        dimension: { id: World },
        Ray: ray,
        getHeadLocation: () => player.Ray.Origin,
        getViewDirection: () => player.Ray.Direction,
        spawnParticle: () => undefined
    };
    return player;
}

test("controllers admit everyone by default and cap distinct players at MaxPlayers", () =>
{
    const admission = Access.CreateAdmission();
    const open = Access.CreateController();
    const everyone = Ask([ "c", "b", "a" ], open);
    assert.deepEqual(Allowed(admission.Admit(everyone), everyone), [ "c", "b", "a" ]);
    assert.equal(open.MaxPlayers, undefined);

    const capped = Access.CreateController({ MaxPlayers: 2 });
    const same = Ask([ "r", "q", "p", "p" ], capped);
    const denied = admission.Admit(same);
    assert.deepEqual([ ...denied ], [ "r" ], "same-tick ties are broken by player id");
    assert.deepEqual(capped.Admitted, [ "p", "q" ]);
    assert.ok(Object.isFrozen(capped) && Object.isFrozen(capped.Admitted));

    const none = Access.CreateController({ MaxPlayers: 0 });
    assert.equal(admission.Admit(Ask([ "p" ], none)).has("p"), true);
    assert.throws(() => Access.CreateController({ MaxPlayers: -1 }), RangeError);
    assert.throws(() => capped.SetMaxPlayers(1.5), RangeError);
    assert.throws(() => capped.LockTo(""), TypeError);
    assert.throws(() => Access.CreateController({ LockedTo: { id: "" } }), TypeError);
});

test("admitted players keep their places while aiming and vacancies fill in arrival order", () =>
{
    const admission = Access.CreateAdmission();
    const policy = Access.CreateController({ MaxPlayers: 1 });
    assert.deepEqual(Allowed(admission.Admit(Ask([ "z" ], policy)), Ask([ "z" ], policy)), [ "z" ]);
    const second = Ask([ "z", "m" ], policy);
    assert.deepEqual(Allowed(admission.Admit(second), second), [ "z" ], "m arrives and waits");
    const third = Ask([ "z", "m", "a" ], policy);
    assert.deepEqual(Allowed(admission.Admit(third), third), [ "z" ], "a smaller id never displaces z");
    const vacated = Ask([ "m", "a" ], policy);
    assert.deepEqual(
        Allowed(admission.Admit(vacated), vacated),
        [ "m" ],
        "earliest arrival fills the vacancy"
    );

    const left = Ask([ "a" ], policy);
    assert.deepEqual(Allowed(admission.Admit(left), left), [ "a" ]);
    admission.Admit(Ask([ "a", "m" ], policy));
    admission.Admit(Ask([ "b" ], policy));
    const rejoined = Ask([ "m", "b" ], policy);
    assert.deepEqual(
        Allowed(admission.Admit(rejoined), rejoined),
        [ "b" ],
        "a player who stops aiming loses both an admitted place and an arrival position"
    );
    admission.Admit([]);
    assert.deepEqual(policy.Admitted, [], "nobody asking leaves nobody admitted");
});

test("limit changes keep the earliest admitted players and take effect on the next update", () =>
{
    const admission = Access.CreateAdmission();
    const policy = Access.CreateController({ MaxPlayers: 3 });
    const players = Ask([ "a", "b", "c", "d" ], policy);
    admission.Admit(Ask([ "c" ], policy));
    admission.Admit(Ask([ "c", "a" ], policy));
    admission.Admit(players);
    assert.deepEqual(policy.Admitted, [ "c", "a", "b" ]);
    policy.SetMaxPlayers(1);
    assert.equal(policy.MaxPlayers, 3, "staged until the next input update");
    assert.deepEqual(policy.Admitted, [ "c", "a", "b" ]);
    assert.deepEqual(Allowed(admission.Admit(players), players), [ "c" ]);
    assert.equal(policy.MaxPlayers, 1);
    policy.SetMaxPlayers(undefined);
    assert.deepEqual(Allowed(admission.Admit(players), players), [ "a", "b", "c", "d" ]);
    assert.deepEqual(policy.Admitted, [ "c", "a", "b", "d" ]);
});

test("lock, unlock and relock apply on the next update and keep admission order", () =>
{
    const admission = Access.CreateAdmission();
    const policy = Access.CreateController({ MaxPlayers: 2 });
    const players = Ask([ "a", "b", "c" ], policy);
    admission.Admit(players);
    assert.deepEqual(policy.Admitted, [ "a", "b" ]);
    policy.LockTo({ id: "c" });
    assert.equal(policy.LockedTo, undefined);
    assert.deepEqual(Allowed(admission.Admit(players), players), [ "c" ]);
    assert.equal(policy.LockedTo, "c");
    const away = Ask([ "a", "b" ], policy);
    assert.deepEqual(Allowed(admission.Admit(away), away), [], "the lock admits nobody else");
    policy.Unlock();
    assert.deepEqual(Allowed(admission.Admit(players), players), [ "a", "b" ]);
    policy.LockTo("b");
    policy.LockTo("a");
    assert.deepEqual(Allowed(admission.Admit(players), players), [ "a" ], "the last staged lock wins");
    policy.LockTo("b");
    policy.Unlock();
    assert.deepEqual(Allowed(admission.Admit(players), players), [ "a", "b" ]);
    const unused = Access.CreateController();
    unused.LockTo("q");
    admission.Admit([]);
    assert.equal(unused.LockedTo, "q", "staged changes apply even while nobody aims at the controller");
});

test("nested policies apply ancestors first and count only players they admit", () =>
{
    const admission = Access.CreateAdmission();
    const outer = Access.CreateController({ MaxPlayers: 2 });
    const inner = Access.CreateController({ MaxPlayers: 1 });
    const requests = [
        ...Ask([ "a" ], outer),
        ...Ask([ "b", "c" ], outer, inner)
    ];
    const denied = admission.Admit(requests);
    assert.deepEqual(outer.Admitted, [ "a", "b" ]);
    assert.deepEqual(inner.Admitted, [ "b" ], "c was denied by the outer policy and is not counted");
    assert.deepEqual([ ...denied ].sort(), [ "c" ]);

    const shared = Access.CreateController({ MaxPlayers: 1 });
    const reused = [
        ...Ask([ "x" ], inner, shared),
        ...Ask([ "w" ], shared)
    ];
    const result = admission.Admit(reused);
    assert.deepEqual(shared.Admitted, [ "w" ], "a reused policy is evaluated once, at its shallowest depth");
    assert.ok(result.has("x"));
});

test("plain policies support limits, locks and predicates; predicate failures deny", () =>
{
    const errors: Array<Error> = [];
    const admission = Access.CreateAdmission({ OnError: (error) => errors.push(error) });
    const limited: Access.Policy = { MaxPlayers: 1 };
    admission.Admit(Ask([ "b" ], limited));
    const both = Ask([ "a", "b" ], limited);
    assert.deepEqual(Allowed(admission.Admit(both), both), [ "b" ]);
    assert.deepEqual(admission.Admitted(limited), [ "b" ]);
    const locked: Access.Policy = { LockedTo: "a" };
    assert.deepEqual(Allowed(admission.Admit(both.map((entry) => ({ ...entry,
        Policies: [ locked ] }))), both), [ "a" ]);
    const predicate: Access.Policy = { Allows: (id) =>
    {
        if (id === "boom")
        {
            throw new Error("predicate");
        }

        return id !== "b";
    } };
    const asking = Ask([ "a", "b", "boom" ], predicate);
    assert.deepEqual(Allowed(admission.Admit(asking), asking), [ "a" ]);
    assert.equal(errors.length, 1);
    assert.equal(Access.IsController(limited), false);
    assert.equal(Access.IsController(Access.CreateController()), true);
    admission.Reset();
    assert.deepEqual(admission.Admitted(limited), []);
});

test("the pointer tracker counts every eligible pointer on a controlled subtree, hidden lines included", () =>
{
    const controller = Access.CreateController({ MaxPlayers: 1 });
    const first = N(Kind.Button, { Width: 32,
        Height: 16 }, [ T("One") ]);
    const second = N(Kind.Button, { Width: 32,
        Height: 16 }, [ T("Two") ]);
    const plate = N(Kind.Panel, { Width: 32,
        Height: 16,
        BackgroundColor: "#202020" });
    const behind = N(Kind.Button, { Width: 32,
        Height: 16,
        Position: "absolute",
        Layer: -1 }, [ T("Behind") ]);
    const layout = Layout.Compute([ N(Kind.View, { Dimension: World,
        Transform: { position: { x: 0,
            y: 10,
            z: 0 },
        rotation: { x: 0,
            y: 0,
            z: 0,
            w: 1 } } }, [
        behind,
        N(Kind.InputScope, { Access: controller,
            Pointer: { Visible: false } }, [ first, second, plate ]),
        N(Kind.Button, { Width: 32,
            Height: 16,
            RequiredItem: "test:key",
            Access: controller }, [ T("Keyed") ])
    ]) ]);
    const p = Player("p", Aim(4, 36));
    const q = Player("q", Aim(4, 4));
    const r = Player("r", Aim(4, 52));
    const tracker = Pointer.Start({
        World: { getAllPlayers: () => [ q, p, r ] },
        System: { runInterval: () => 1,
            clearRun: () => undefined },
        Sources: () => [ { Layout: layout,
            Audience: [ "p", "q", "r" ] } ],
        Draw: () => undefined,
        Occlusion: false
    });
    tracker.Update();
    assert.equal(tracker.Get("p")!.Target.Type, Kind.Panel, "p aims at a noninteractive scoped surface");
    assert.equal(tracker.Get("p")!.Denial, undefined);
    assert.equal(tracker.Get("p")!.Line, undefined);
    assert.equal(tracker.Get("q")!.Denial, "access", "p holds the only place even with a hidden line");
    assert.equal(tracker.Get("q")!.Target.Id, first.Id, "a denied control blocks the button behind it");
    assert.notEqual(tracker.Get("q")!.Target.Id, behind.Id);
    assert.equal(tracker.Get("r")!.Denial, "item", "ineligible pointers are not counted");
    assert.deepEqual(controller.Admitted, [ "p" ]);

    p.Ray = Aim(4, 200);
    tracker.Update();
    assert.equal(tracker.Get("p"), undefined);
    assert.equal(tracker.Get("q")!.Eligible, true, "the vacancy is filled on the next update");

    controller.LockTo("p");
    assert.equal(tracker.Get("q")!.Eligible, true, "a lock waits for the next input update");
    tracker.Update();
    assert.equal(tracker.Get("q")!.Denial, "access");
    controller.Unlock();
    tracker.Update();
    assert.equal(tracker.Get("q")!.Eligible, true);
    tracker.Dispose();
    assert.deepEqual(controller.Admitted, []);
});

test("layout validation rejects malformed Access locks and limits", () =>
{
    for (const access of [ { LockedTo: "" }, { LockedTo: 3 }, { MaxPlayers: 1.5 }, { Allows: true } ])
    {
        assert.throws(() => Layout.Compute([ N(Kind.View, { Dimension: World }, [
            N(Kind.Panel, { Access: access })
        ]) ]), Layout.LayoutError);
    }

    const controller = Access.CreateController({ MaxPlayers: 2,
        LockedTo: "p" });
    const result = Layout.Compute([
        N(Kind.View, { Dimension: World }, [ N(Kind.Panel, { Access: controller }) ])
    ]);
    assert.equal(result.Items[1]!.Access[0], controller);
});
