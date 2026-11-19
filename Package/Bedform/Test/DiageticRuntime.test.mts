/**
 * Toggle ownership, recovery journaling and adversarial native resource lifecycle qualification.
 *
 * @module bedform/Test/DiageticRuntime.test
 *
 * @file      DiageticRuntime.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native-shaped event tests retain contextual inference and transaction ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as D from "bedform/Diagetic";
import type { Entity, Player } from "@minecraft/server";
import { ReadJournal, RestoreJournal } from "../Source/Internal/DiageticRecovery.js";
import Assert from "node:assert/strict";
import { CaptureFrame } from "../Source/Internal/DiageticFrame.js";
import { Harness } from "./DiageticHarness.mjs";
import { test } from "node:test";

/**
 * Starts a loaded slider with two players and drains deferred startup work.
 *
 * @category Testing
 * @since 1.0.0
 */
const setup = (configuration: D.Options<"slider"> = {}) =>
{
    const h = Harness();
    const a = h.player("a");
    const b = h.player("b");
    const actor = h.actor("control");
    const definition = D.Slider(configuration);
    const runtime = D.Start({ ...h.options,
        Controls: [ definition ] });
    h.advance();
    return { h,
        a,
        b,
        actor,
        definition,
        runtime };
};

/**
 * Delivers a native-shaped before-event and then advances its deferred mutable phase.
 *
 * @category Testing
 * @since 1.0.0
 */
const use = (h: ReturnType<typeof Harness>, player: Player, target: Entity): void =>
{
    const event = { player,
        target,
        cancel: false };
    h.before.playerInteractWithEntity.emit(event);
    Assert.equal(event.cancel, true);
    h.advance();
};

/**
 * Confirms normal teardown without any hidden actors, queued work or listener/timer retention.
 *
 * @category Testing
 * @since 1.0.0
 */
const clean = (h: ReturnType<typeof Harness>, runtime: D.Runtime): void =>
{
    runtime.Dispose();
    runtime.Dispose();
    Assert.equal(h.subscriptions(), 0);
    Assert.equal(h.queue.size, 0);
    Assert.equal(h.intervals.size, 0);
};

test("entity Use toggles with claim-before-lock journaling, exact prompt and saved child permissions", () =>
{
    const { h, a, actor, definition, runtime } = setup();
    try
    {
        a.permissions.set(D.Keys.NativePermission.Camera, false);
        a.permissions.set(D.Keys.NativePermission.Jump, false);
        a.permissions.set(D.Keys.NativePermission.MoveLeft, false);
        const original = [ ...a.permissions ];
        const originalRotation = { ...a.data.rotation };
        const before = { player: a.player,
            target: actor.entity,
            cancel: false };
        h.before.playerInteractWithEntity.emit(before);
        Assert.ok(before.cancel);
        Assert.equal(a.data.active, false);
        h.advance();
        Assert.ok(runtime.IsInteracting(a.player));
        Assert.ok(a.data.active && a.data.bodyLocked);
        Assert.equal(a.data.prompt, "§o§7Press §e:_input_key.use: §o§7to let go.§r");
        Assert.equal(a.permissions.get(D.Keys.NativePermission.Movement), false);
        Assert.equal(a.permissions.get(D.Keys.NativePermission.Camera), true);
        const receipt = ReadJournal(h.world, a.player.id)!;
        Assert.ok(receipt);
        Assert.equal(receipt.Receipt.Rotation.y, 180);
        Assert.ok(h.calls.indexOf("write:" + D.Keys.DynamicPropertyPrefix.Recovery + "a") <
            h.calls.indexOf("a:lock"));
        Assert.ok(a.tags.has(receipt.Receipt.Tag) && actor.tags.has(receipt.Receipt.Tag));
        a.data.rotation = { x: 12,
            y: 190 };
        h.advance();
        Assert.ok(definition.Attach(actor.entity).Value > 0);
        a.native.location.x = 0.25;
        use(h, a.player, actor.entity);
        Assert.equal(runtime.IsInteracting(a.player), false);
        Assert.deepEqual(a.data.rotation, originalRotation);
        Assert.equal(a.native.location.x, 0.25);
        Assert.equal(a.data.active, false);
        Assert.equal(a.data.bodyLocked, false);
        Assert.deepEqual([ ...a.permissions ], original);
        Assert.equal(a.data.prompt, "");
        Assert.equal(ReadJournal(h.world, "a"), undefined);
        Assert.equal(a.tags.size + actor.tags.size, 0);
        Assert.equal(h.errors.length, 0);
        Assert.equal(h.actors.size, 1);
    }
    finally
    {
        clean(h, runtime);
    }
});

test("same-tick duplicates coalesce, consecutive-tick presses release, and item/block actions are cancelled",
    () =>
    {
        const { h, a, actor, runtime } = setup();
        try
        {
            const first = { player: a.player,
                target: actor.entity,
                cancel: false };
            h.before.playerInteractWithEntity.emit(first);
            h.before.playerInteractWithEntity.emit({ ...first });
            const item = { source: a.player,
                cancel: false };
            h.before.itemUse.emit(item);
            Assert.ok(item.cancel);
            h.advance();
            Assert.ok(runtime.IsInteracting(a.player));
            const block = { player: a.player,
                cancel: false };
            h.before.playerInteractWithBlock.emit(block);
            Assert.ok(block.cancel);
            const unrelated = h.actor("unrelated", "minecraft:pig");
            use(h, a.player, unrelated.entity);
            Assert.equal(runtime.IsInteracting(a.player), false);
            Assert.equal(h.errors.length, 0);
        }
        finally
        {
            clean(h, runtime);
        }
    });

test("one player/control claims precede callbacks and work across runtimes and equivalent actor wrappers",
    () =>
    {
        const { h, a, b, actor, definition, runtime } = setup();
        const second = D.Slider({ EntityType: "fixture:second" });
        const other = h.actor("second", second.EntityType);
        const otherRuntime = D.Start({ ...h.options,
            World: new Proxy(h.world, {}),
            Controls: [ second ] });
        try
        {
            h.advance();
            use(h, a.player, actor.entity);
            use(h, b.player, actor.entity);
            Assert.ok(runtime.IsInteracting(a.player));
            Assert.equal(runtime.IsInteracting(b.player), false);
            Assert.equal(b.data.active, false);
            Assert.equal(otherRuntime.Interact(a.player, other.entity), false);
            const handle = definition.Attach(actor.entity);
            Assert.equal(definition.Attach({ ...actor.native } as unknown as Entity), handle);
            Assert.throws(() => D.Start({ ...h.options,
                Controls: [ definition ] }), /distinct entity types/);
            runtime.Dispose();
            Assert.equal(a.data.active, false);
            use(h, a.player, other.entity);
            Assert.ok(otherRuntime.IsInteracting(a.player));
            Assert.equal(h.errors.length, 0);
        }
        finally
        {
            runtime.Dispose();
            clean(h, otherRuntime);
        }
    });

test("eligibility and range reject before mutation, and reentrant callbacks cannot claim twice", () =>
{
    const h = Harness();
    const a = h.player("a");
    const b = h.player("b");
    const actor = h.actor("control");
    let eligible = false;
    let callback = 0;

    const definition = D.Slider({ Eligible: () => eligible,
        OnGrab: () =>
        {
            callback++;
            runtime.Interact(b.player, actor.entity);
        } });
    const runtime = D.Start({ ...h.options,
        Controls: [ definition ] });
    try
    {
        h.advance();
        use(h, a.player, actor.entity);
        Assert.equal(callback, 0);
        Assert.equal(a.data.active, false);
        Assert.equal(ReadJournal(h.world, "a"), undefined);
        eligible = true;
        a.native.location.z = 20;
        use(h, a.player, actor.entity);
        Assert.equal(a.data.active, false);
        a.native.location.z = 2;
        use(h, a.player, actor.entity);
        h.advance();
        Assert.equal(callback, 1);
        Assert.ok(runtime.IsInteracting(a.player));
        Assert.equal(runtime.IsInteracting(b.player), false);
    }
    finally
    {
        clean(h, runtime);
    }
});

test("each partial activation failure restores all resources and releases both claims", () =>
{
    for (const fault of [ "a:addTag", "control:addTag", "a:lock", "a:permission:1",
        "a:permission:2", "a:velocity", "a:teleport", "a:camera", "a:prompt" ])
    {
        const { h, a, actor, runtime } = setup();
        try
        {
            h.faults.set(fault, 1);
            use(h, a.player, actor.entity);
            Assert.equal(runtime.IsInteracting(a.player), false, fault);
            Assert.equal(a.data.active || a.data.bodyLocked, false, fault);
            Assert.equal(a.permissions.get(D.Keys.NativePermission.Movement), true, fault);
            Assert.equal(ReadJournal(h.world, "a"), undefined, fault);
            Assert.equal(a.tags.size + actor.tags.size, 0, fault);
            Assert.ok(h.errors.length > 0, fault);
        }
        finally
        {
            clean(h, runtime);
        }
    }
});

test("storage failure cannot lock a player and corrupt receipts fail closed without replacing saved state",
    () =>
    {
        const { h, a, actor, runtime } = setup();
        try
        {
            const key = D.Keys.DynamicPropertyPrefix.Recovery + "a";
            h.faults.set("write:" + key, 1);
            use(h, a.player, actor.entity);
            Assert.equal(a.data.active, false);
            Assert.equal(a.data.bodyLocked, false);
            Assert.equal(runtime.IsInteracting(a.player), false);
            Assert.equal(a.tags.size, 0);
            h.storage.set(key, "corrupt");
            use(h, a.player, actor.entity);
            Assert.equal(a.data.active, false);
            Assert.equal(h.storage.get(key), "corrupt");
            h.advance(3);
            Assert.ok(h.errors.length < 5);
        }
        finally
        {
            clean(h, runtime);
        }
    });

test("all restoration operations run independently; failed cleanup retains a journal for a later retry", () =>
{
    const { h, a, actor, runtime } = setup();
    try
    {
        use(h, a.player, actor.entity);
        const journal = ReadJournal(h.world, "a")!;
        // Fail release cleanup and the immediate same-tick recovery retry.
        h.faults.set("a:clear", 2);
        h.faults.set("a:unlock", 2);
        use(h, a.player, actor.entity);
        Assert.equal(runtime.IsInteracting(a.player), false);
        Assert.equal(a.permissions.get(D.Keys.NativePermission.Movement), true);
        Assert.ok(a.data.fovClears > 0);
        Assert.equal(ReadJournal(h.world, "a")!.Raw, journal.Raw);
        Assert.ok(a.tags.has(journal.Receipt.Tag));
        h.advance();
        Assert.equal(ReadJournal(h.world, "a"), undefined);
        Assert.equal(a.data.active || a.data.bodyLocked, false);
        Assert.equal(a.tags.size + actor.tags.size, 0);
    }
    finally
    {
        clean(h, runtime);
    }
});

test("grab/change/release/cancel callback failures cannot retain native locks or ownership", () =>
{
    for (const phase of [ "grab", "change", "release", "cancel" ])
    {
        const fail = (): never =>
        {
            throw new Error(phase);
        };

        const { h, a, actor, runtime } = setup({
            OnGrab: phase === "grab" ? fail : undefined,
            OnChange: phase === "change" ? fail : undefined,
            OnRelease: phase === "release" ? fail : undefined,
            OnCancel: phase === "cancel" ? fail : undefined
        });
        try
        {
            use(h, a.player, actor.entity);
            if (phase === "change")
            {
                a.data.rotation.y += 5;
                h.advance();
            }

            if (phase === "release")
            {
                use(h, a.player, actor.entity);
            }

            if (phase === "cancel")
            {
                h.after.entityDie.emit({ deadEntity: a.player });
            }

            Assert.equal(runtime.IsInteracting(a.player), false, phase);
            Assert.equal(a.data.active || a.data.bodyLocked, false, phase);
            Assert.equal(a.permissions.get(D.Keys.NativePermission.Movement), true, phase);
            Assert.equal(a.tags.size + actor.tags.size, 0, phase);
            Assert.equal(ReadJournal(h.world, "a"), undefined, phase);
            Assert.ok(h.errors.length > 0, phase);
        }
        finally
        {
            clean(h, runtime);
        }
    }
});

test("death, respawn, dimension change, entity loss and disposal cancel with cleanup and correct reasons",
    () =>
    {
        for (const reason of [ "death", "respawn", "dimensionChange", "entityLost",
            "outOfRange", "disposed" ] as const)
        {
            const cancellations: Array<D.CancellationReason> = [];
            const { h, a, actor, runtime } = setup({ OnCancel: (event) => cancellations.push(event.Reason) });
            try
            {
                use(h, a.player, actor.entity);
                if (reason === "death")
                {
                    h.after.entityDie.emit({ deadEntity: a.player });
                }

                if (reason === "respawn")
                {
                    h.after.playerSpawn.emit({ player: a.player });
                }

                if (reason === "dimensionChange")
                {
                    a.native.dimension = { ...a.native.dimension,
                        id: "minecraft:nether" };
                    h.after.playerDimensionChange.emit({ player: a.player });
                }

                if (reason === "entityLost")
                {
                    actor.native.isValid = false;
                    h.after.entityRemove.emit({ removedEntityId: actor.entity.id,
                        typeId: actor.entity.typeId });
                }

                if (reason === "disposed")
                {
                    runtime.Dispose();
                }

                if (reason === "outOfRange")
                {
                    a.native.location.z = 100;
                    h.advance();
                    Assert.equal(a.native.location.z, 100);
                }

                Assert.deepEqual(cancellations, [ reason ]);
                Assert.equal(runtime.IsInteracting(a.player), false);
                Assert.equal(a.data.active || a.data.bodyLocked, false);
                Assert.equal(ReadJournal(h.world, "a"), undefined);
            }
            finally
            {
                clean(h, runtime);
            }
        }
    });

test("offline players recover on reconnect; unloaded actor markers retire without resuming a grab", () =>
{
    const { h, a, actor, runtime } = setup();
    try
    {
        use(h, a.player, actor.entity);
        a.native.isValid = false;
        actor.native.isValid = false;
        h.after.playerLeave.emit({ playerId: "a" });
        Assert.equal(runtime.IsInteracting(a.player), false);
        Assert.ok(ReadJournal(h.world, "a"));
        a.native.isValid = true;
        h.after.playerSpawn.emit({ player: a.player });
        Assert.equal(a.data.active || a.data.bodyLocked, false);
        Assert.equal(ReadJournal(h.world, "a"), undefined);
        Assert.equal(actor.tags.size, 1);
        actor.native.isValid = true;
        h.after.entityLoad.emit({ entity: actor.entity });
        Assert.equal(actor.tags.size, 0);
        Assert.equal(runtime.IsInteracting(a.player), false);
    }
    finally
    {
        clean(h, runtime);
    }
});

test("stale receipts recover on a fresh runtime, while old receipt bytes cannot clear a newer session", () =>
{
    const { h, a, actor, definition, runtime } = setup();
    use(h, a.player, actor.entity);
    const stale = ReadJournal(h.world, "a")!;
    a.native.isValid = false;
    runtime.Dispose();
    a.native.isValid = true;
    const fresh = D.Start({ ...h.options,
        Controls: [ definition ] });
    try
    {
        h.advance();
        Assert.equal(a.data.active || a.data.bodyLocked, false);
        Assert.equal(fresh.IsInteracting(a.player), false);
        use(h, a.player, actor.entity);
        const current = ReadJournal(h.world, "a")!;
        Assert.notEqual(current.Raw, stale.Raw);
        Assert.ok(RestoreJournal(h.world, a.player, stale).length > 0);
        Assert.equal(ReadJournal(h.world, "a")!.Raw, current.Raw);
        Assert.ok(a.data.active);
    }
    finally
    {
        clean(h, fresh);
    }
});

test("queued observations cannot cross lifecycle boundaries; startup failure retires partial subscriptions",
    () =>
    {
        const { h, a, actor, runtime } = setup();
        runtime.Interact(a.player, actor.entity);
        h.after.entityDie.emit({ deadEntity: a.player });
        h.advance();
        Assert.equal(a.data.active, false);
        runtime.Interact(a.player, actor.entity);
        runtime.Dispose();
        h.advance();
        Assert.equal(a.data.active, false);
        Assert.equal(h.subscriptions() + h.queue.size + h.intervals.size, 0);
        const next = Harness();
        next.faults.set("subscribe:leave", 1);
        Assert.throws(() => D.Start({ ...next.options,
            Controls: [ D.Slider() ] }), /subscribe:leave/);
        Assert.equal(next.subscriptions() + next.queue.size + next.intervals.size, 0);
    });

test("stale native callbacks stay inert even if unsubscribe fails and an error observer throws", () =>
{
    const { h, a, actor, runtime } = setup();
    use(h, a.player, actor.entity);
    h.faults.set("unsubscribe:use", 1);
    Assert.throws(() => runtime.Dispose(), AggregateError);
    const after = h.calls.length;
    h.before.playerInteractWithEntity.emit({ player: a.player,
        target: actor.entity,
        cancel: false });
    h.advance();
    Assert.equal(h.calls.length, after);
    Assert.equal(a.data.active, false);
    Assert.equal(runtime.IsInteracting(a.player), false);
    const other = Harness();
    const p = other.player("p");
    const entity = other.actor("actor");
    const live = D.Start({ ...other.options,
        Controls: [ D.Slider({ OnGrab: () =>
        {
            throw new Error("grab");
        } }) ],
        OnError: () =>
        {
            throw new Error("sink");
        } });
    try
    {
        other.advance();
        use(other, p.player, entity.entity);
        Assert.equal(p.data.active, false);
        Assert.equal(live.IsInteracting(p.player), false);
    }
    finally
    {
        clean(other, live);
    }
});

test("ticks preserve the prompt, recenter hidden aim and keep stepping after release", () =>
{
    const { h, a, actor, definition, runtime } = setup({ OnChange: () =>
    {
        a.data.prompt = "observer";
    } });
    try
    {
        use(h, a.player, actor.entity);
        a.data.rotation = { x: 86,
            y: 230 };
        h.advance();
        Assert.deepEqual(a.data.rotation, { x: 0,
            y: 180 });
        Assert.equal(a.data.prompt, D.Keys.ReleasePrompt);
        const handle = definition.Attach(actor.entity);
        Assert.ok(handle.Motion.State.Estimated);
        use(h, a.player, actor.entity);
        const released = handle.Value;
        h.advance(100);
        Assert.ok(handle.Value >= released);
        Assert.equal(handle.Motion.State.Settled, true);
        handle.SetValue(0.5);
        h.advance();
        Assert.equal(handle.Value, 0.5);
    }
    finally
    {
        clean(h, runtime);
    }
});

test("foreign cooperative ownership is respected and orphaned actor tags are retired", () =>
{
    const { h, a, b, actor, runtime } = setup();
    try
    {
        const foreign = D.Keys.TagPrefix.Session + "foreign";
        b.tags.add(foreign);
        actor.tags.add(foreign);
        Assert.equal(runtime.Interact(b.player, actor.entity), false);
        Assert.equal(h.queue.size, 0);
        use(h, a.player, actor.entity);
        Assert.equal(runtime.IsInteracting(a.player), false);
        Assert.ok(actor.tags.has(foreign));
        b.tags.clear();
        use(h, a.player, actor.entity);
        Assert.ok(runtime.IsInteracting(a.player));
        Assert.equal(actor.tags.has(foreign), false);
    }
    finally
    {
        clean(h, runtime);
    }
});

test("missing assets cannot lock players and interval startup failure rolls back", () =>
{
    const { h, a, actor, runtime } = setup();
    try
    {
        a.native.getProperty = () => undefined;
        use(h, a.player, actor.entity);
        Assert.equal(runtime.IsInteracting(a.player), false);
        Assert.equal(a.data.active || a.data.bodyLocked, false);
        Assert.equal(ReadJournal(h.world, "a"), undefined);
        Assert.ok(h.errors.some((error) => String(error).includes("presentation assets")));
    }
    finally
    {
        clean(h, runtime);
    }

    const other = Harness();
    other.faults.set("interval", 1);
    Assert.throws(() => D.Start({ ...other.options,
        Controls: [ D.Slider() ] }), /interval/);
    Assert.equal(other.subscriptions() + other.queue.size + other.intervals.size, 0);
});

test("native/model rotations compose into right-handed mount and eye-camera frames", () =>
{
    const { h, a, actor, definition, runtime } = setup();
    try
    {
        const handle = definition.Attach(actor.entity);
        const value = CaptureFrame(a.player, handle, { x: 0,
            y: 180 });
        Assert.ok(Math.abs(value.Camera.Forward.z + 1) < 1e-10);
        Assert.ok(Math.abs(value.Camera.Right.x - 1) < 1e-10);
        Assert.equal(value.Mount.Position.y, 1.5);
        Assert.deepEqual(value.Mount.Normal, { x: 0,
            y: 0,
            z: 1 });
    }
    finally
    {
        clean(h, runtime);
    }
});

test("idle gaze highlights clear on look-away, control acquisition, range loss and disposal", () =>
{
    const { h, a, b, actor, runtime } = setup();
    const key = D.Keys.EntityProperty.Highlighted;
    actor.synchronized.set(key, false);
    let hits = [ { entity: actor.entity,
        distance: 2 } ];
    a.native.getEntitiesFromViewDirection = () => hits;
    try
    {
        h.advance();
        Assert.equal(actor.synchronized.get(key), true);
        hits = [];
        h.advance();
        Assert.equal(actor.synchronized.get(key), false);
        hits = [ { entity: actor.entity,
            distance: 4 } ];
        h.advance();
        Assert.equal(actor.synchronized.get(key), false);
        hits = [ { entity: actor.entity,
            distance: 2 } ];
        h.advance();
        Assert.equal(actor.synchronized.get(key), true);
        use(h, a.player, actor.entity);
        b.native.getEntitiesFromViewDirection = () => hits;
        h.advance();
        Assert.equal(actor.synchronized.get(key), false, "another viewer cannot highlight a held control");
        use(h, a.player, actor.entity);
        h.advance();
        Assert.equal(actor.synchronized.get(key), true);
        runtime.Dispose();
        Assert.equal(actor.synchronized.get(key), false);
        Assert.equal(h.errors.length, 0);
    }
    finally
    {
        clean(h, runtime);
    }
});

test("air Use receiver follows native aim, rejects foreign ownership and cleans up on release", () =>
{
    const { h, a, b, actor, runtime } = setup();
    try
    {
        use(h, a.player, actor.entity);
        const target = [ ...h.actors.values() ].find((entity) => entity.typeId === D.Keys.ReleaseTarget)!;
        Assert.ok(target);
        a.data.rotation = { x: -30,
            y: 45 };
        h.advance();
        const head = a.player.getHeadLocation();
        const aim = a.player.getViewDirection();
        Assert.deepEqual(target.location, { x: head.x + aim.x * 1.5,
            y: head.y + aim.y * 1.5 - 0.3,
            z: head.z + aim.z * 1.5 });
        Assert.equal(runtime.Interact(b.player, target), false);
        Assert.equal(runtime.IsInteracting(a.player), true);
        use(h, a.player, target);
        Assert.equal(runtime.IsInteracting(a.player), false);
        Assert.equal(target.isValid, false);
        Assert.equal(h.errors.length, 0);
    }
    finally
    {
        clean(h, runtime);
    }
});

test("receiver spawn failure rolls back and disposal removes a live receiver", () =>
{
    const { h, a, actor, runtime } = setup();
    try
    {
        h.faults.set("spawnTarget", 1);
        use(h, a.player, actor.entity);
        Assert.equal(runtime.IsInteracting(a.player), false);
        Assert.equal(a.data.bodyLocked, false);
        Assert.equal(ReadJournal(h.world, a.player.id), undefined);
        use(h, a.player, actor.entity);
        const target = [ ...h.actors.values() ].find((entity) => entity.typeId === D.Keys.ReleaseTarget)!;
        Assert.ok(target);
        runtime.Dispose();
        Assert.equal(target.isValid, false);
    }
    finally
    {
        clean(h, runtime);
    }
});
