/**
 * Native GameTest driver for the isolated Canvas Intent fixture. The first server process runs the
 * observed lifecycle matrix through two independent consumer packs; the second reopens the same world
 * with the unmodified Canvas artifact and checks restart cleanup and fresh connections.
 *
 * @module bedform-canvas/Test/Native/Driver
 *
 * @file      Driver.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native assertions retain contextual inference and wire/geometric field ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys, @stylistic/max-len */

import { ConsumerId, DynamicProperty, FixtureEvent, Marker, RawClientId, TickingArea } from "./Keys.mjs";
import type { Dimension, Entity, Player, ScriptEventCommandMessageAfterEvent, Vector3 } from "@minecraft/server";
import { GameMode, TextPrimitive, system, world } from "@minecraft/server";
import type { Observation, TextRecord } from "./Observer.mjs";
import { ScriptEvent, Version } from "bedform/Canvas/IntentProtocol";
import type { Acknowledgement } from "bedform/Canvas/IntentProtocol";
import type { Command as ConsumerCommand } from "./Consumer.mjs";
import { QualifyText } from "./Text.mjs";
import { QualifyWidgets } from "./Widgets.mjs";
import type { SimulatedPlayer } from "@minecraft/server-gametest";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";

/**
 * Bundled by the fixed-path runner to select text qualification without the independent actor probe.
 *
 * @category Configuration
 * @since 1.0.1
 */
declare const NativeTextOnly: boolean;

/**
 * A consumer's reply to one driver command.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Result
{
    readonly Target: string;
    readonly Nonce: number;
    readonly Status: "resolved" | "rejected";
    readonly Message?: string;
    readonly Errors: ReadonlyArray<string>;
    readonly ElapsedTicks: number;
    readonly Generation: number;
}

/**
 * State carried from the observed process into the restarted process.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Saved
{
    readonly Phase: 1 | 2;
    readonly RuntimeId: string;
    readonly RawConnectionId: string;
    readonly RawRequestId: number;
    readonly ActiveAtStop: number;
    readonly KeptId: string;
}

const Glyph = "";
const PanelLift = 0.75;
const NearRadius = 1.6;
const Gray = 0x4D / 0xFF;
const Evidence: Record<string, unknown> = {};
const Steps: Array<string> = [];
const PendingResults = new Map<number, (result: Result) => void>();
const PendingObservations = new Map<number, { Chunks: Array<string>;
    Resolve: (data: string) => void }>();
const Acknowledgements: Array<Acknowledgement> = [];
let Nonce = 0;

const Wait = (ticks: number) => new Promise<void>((resolve: () => void) => system.runTimeout(resolve, ticks));

/**
 * Throws a labeled fixture failure.
 *
 * @throws { Error } If the condition is false.
 *
 * @category Testing
 * @since 1.0.0
 */
function Check(condition: unknown, message: string): asserts condition
{
    if (!condition)
    {
        throw new Error(message);
    }
}

/**
 * Records one completed matrix step.
 *
 * @category Testing
 * @since 1.0.0
 */
function Step(name: string, detail?: unknown): void
{
    Steps.push(name);
    if (detail !== undefined)
    {
        Evidence[name] = detail;
    }

    console.warn(`CANVAS_NATIVE_STEP ${name}`);
}

/**
 * Resolves after a callback-driven reply or rejects after a bounded number of ticks.
 *
 * @throws { Error } If the reply does not arrive in time.
 *
 * @category Testing
 * @since 1.0.0
 */
function Bounded<Value>(label: string, ticks: number, start: (resolve: (value: Value) => void) => () => void)
    : Promise<Value>
{
    return new Promise<Value>((resolve: (value: Value) => void, reject: (error: Error) => void) =>
    {
        let release: () => void = () => undefined;
        const timer = system.runTimeout(() =>
        {
            release();
            reject(new Error(`${label} timed out after ${ticks} ticks.`));
        }, ticks);
        release = start((value: Value) =>
        {
            system.clearRun(timer);
            release();
            resolve(value);
        });
    });
}

system.afterEvents.scriptEventReceive.subscribe((event: ScriptEventCommandMessageAfterEvent): void =>
{
    if (event.id === FixtureEvent.ConsumerResult)
    {
        const result = JSON.parse(event.message) as Result;
        PendingResults.get(result.Nonce)?.(result);
    }
    else if (event.id === FixtureEvent.Observation)
    {
        const chunk = JSON.parse(event.message) as { Nonce: number;
            Index: number;
            Count: number;
            Data: string };
        const pending = PendingObservations.get(chunk.Nonce);
        if (pending)
        {
            pending.Chunks[chunk.Index] = chunk.Data;
            if (pending.Chunks.filter((entry) => entry !== undefined).length === chunk.Count)
            {
                pending.Resolve(pending.Chunks.join(""));
            }
        }
    }
    else if (event.id === ScriptEvent.Acknowledgement)
    {
        Evidence.AcknowledgementSourceType ??= event.sourceType;
        Acknowledgements.push(JSON.parse(event.message) as Acknowledgement);
    }
});

/**
 * Sends one command to a consumer pack and waits for the outcome of its Intent operation.
 *
 * @throws { Error } If the consumer does not answer.
 *
 * @category Testing
 * @since 1.0.0
 */
function Consumer(target: "a" | "b", operation: ConsumerCommand["Operation"],
    fields: Omit<ConsumerCommand, "Target" | "Nonce" | "Operation"> = {}): Promise<Result>
{
    const nonce = ++Nonce;
    return Bounded<Result>(`consumer ${target} ${operation}`, 240, (resolve) =>
    {
        PendingResults.set(nonce, resolve);
        system.sendScriptEvent(FixtureEvent.Consumer, JSON.stringify({ ...fields,
            Nonce: nonce,
            Operation: operation,
            Target: target }));
        return () => PendingResults.delete(nonce);
    });
}

/**
 * Requires a consumer operation to resolve, reporting the consumer's message otherwise.
 *
 * @throws { Error } If the operation was rejected.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Accepted(target: "a" | "b", operation: ConsumerCommand["Operation"],
    fields: Omit<ConsumerCommand, "Target" | "Nonce" | "Operation"> = {}): Promise<Result>
{
    const result = await Consumer(target, operation, fields);
    Check(result.Status === "resolved", `consumer ${target} ${operation} was rejected: ${result.Message}`);
    Check(result.Errors.length === 0, `consumer ${target} reported errors: ${result.Errors.join("; ")}`);
    return result;
}

/**
 * Requires a consumer operation to reject with a message containing the expected text.
 *
 * @throws { Error } If the operation resolved or failed for another reason.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Rejected(target: "a" | "b", operation: ConsumerCommand["Operation"], expected: string,
    fields: Omit<ConsumerCommand, "Target" | "Nonce" | "Operation"> = {}): Promise<string>
{
    const result = await Consumer(target, operation, fields);
    Check(result.Status === "rejected" && result.Message?.includes(expected),
        `consumer ${target} ${operation} should reject with "${expected}", got ${result.Status}: ` +
        `${result.Message}`);
    return result.Message!;
}

/**
 * Sends one request to the observer prepended to Canvas in the observed process.
 *
 * @throws { Error } If the observer does not answer.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Observer<Value>(operation: string, fields: Record<string, unknown> = {}): Promise<Value>
{
    const nonce = ++Nonce;
    const data = await Bounded<string>(`observer ${operation}`, 40, (resolve) =>
    {
        PendingObservations.set(nonce, { Chunks: [],
            Resolve: resolve });
        system.sendScriptEvent(FixtureEvent.Observer, JSON.stringify({ ...fields,
            Nonce: nonce,
            Operation: operation }));
        return () => PendingObservations.delete(nonce);
    });
    return JSON.parse(data) as Value;
}

/**
 * Observes successful native particle and text calls over a fresh window of ticks.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Window(ticks: number = 4): Promise<Observation>
{
    await Observer("mark");
    await Wait(ticks);
    return Observer<Observation>("query");
}

/**
 * Sends a raw protocol message and collects the acknowledgement correlated to it, if any.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Raw(message: Record<string, unknown> | string, ticks: number = 10)
    : Promise<Acknowledgement | undefined>
{
    const start = Acknowledgements.length;
    system.sendScriptEvent(ScriptEvent.Command, typeof message === "string" ? message : JSON.stringify(message));
    await Wait(ticks);
    if (typeof message === "string")
    {
        return undefined;
    }

    return Acknowledgements.slice(start).find((ack: Acknowledgement) => ack.ConnectionId === message.ConnectionId &&
        ack.RequestId === message.RequestId && ack.ClientId === message.ClientId);
}

/**
 * The expected panel center for a subject at default offset, ignoring per-viewer camera roll.
 *
 * @category Testing
 * @since 1.0.0
 */
function Panel(entity: Entity): Vector3
{
    const head = entity.getHeadLocation();
    return { x: head.x,
        y: head.y + PanelLift,
        z: head.z };
}

const Distance = (left: Vector3, right: Vector3): number =>
    Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);

/**
 * Viewers whose particle clusters in the window lie at the subject's panel, optionally with an effect.
 *
 * @category Testing
 * @since 1.0.0
 */
function ParticleViewers(observation: Observation, center: Vector3, effect?: string): Array<string>
{
    return Object.entries(observation.Particles).filter(([ , record ]) =>
        (effect === undefined || record.Effects.includes(effect)) && record.Clusters.some((cluster) =>
            Distance({ x: cluster[0],
                y: cluster[1],
                z: cluster[2] }, center) <= NearRadius)).map(([ viewer ]) => viewer).sort();
}

/**
 * Live text primitives positioned at the subject's panel.
 *
 * @category Testing
 * @since 1.0.0
 */
function TextsAt(observation: Observation, center: Vector3): Array<TextRecord>
{
    return observation.Texts.filter((text: TextRecord) => Distance({ x: text.Location[0],
        y: text.Location[1],
        z: text.Location[2] }, center) <= NearRadius);
}

/**
 * Same-dimension players within range of the subject's head, excluding the subject itself.
 *
 * @category Testing
 * @since 1.0.0
 */
function Audience(subject: Entity, maxDistance: number = 32): Array<string>
{
    const head = subject.getHeadLocation();
    return world.getAllPlayers().filter((player: Player) => player.id !== subject.id &&
        player.dimension.id === subject.dimension.id &&
        Distance(player.getHeadLocation(), head) <= maxDistance).map((player: Player) => player.id).sort();
}

const Same = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
    left.length === right.length && left.every((value: string, index: number) => value === right[index]);

/**
 * Asserts the exact private particle audience of one subject panel.
 *
 * @throws { Error } If any viewer differs from the expected audience.
 *
 * @category Testing
 * @since 1.0.0
 */
function ExpectParticles(label: string, observation: Observation, subject: Entity, expected: Array<string>,
    effect?: string): Array<string>
{
    const actual = ParticleViewers(observation, Panel(subject), effect);
    Check(Same(actual, [ ...expected ].sort()), `${label}: particle audience ${JSON.stringify(actual)} != ` +
        `${JSON.stringify([ ...expected ].sort())}`);
    return actual;
}

/**
 * Asserts one private, depth-tested, transparent, default-gray text per expected viewer.
 *
 * @throws { Error } If text audiences or presentation differ.
 *
 * @category Testing
 * @since 1.0.0
 */
function ExpectTexts(label: string, observation: Observation, subject: Entity, expected: Array<string>)
    : Array<TextRecord>
{
    const texts = TextsAt(observation, Panel(subject));
    const viewers = texts.map((text: TextRecord) => text.Viewers.join(",")).sort();
    Check(Same(viewers, [ ...expected ].sort()), `${label}: text audience ${JSON.stringify(viewers)} != ` +
        `${JSON.stringify([ ...expected ].sort())}`);
    for (const text of texts)
    {
        Check(text.Viewers.length === 1 && text.Text === Glyph && text.DepthTest && text.BackgroundAlpha === 0 &&
            !text.UseRotation && !text.BackfaceVisible && !text.TextBackfaceVisible &&
            text.Dimension === subject.dimension.id && text.Color !== null &&
            text.Color.slice(0, 3).every((channel: number) => Math.abs(channel - Gray) < 0.002) &&
            text.Color[3] === 1, `${label}: text presentation ${JSON.stringify(text)}`);
    }

    return texts;
}

/**
 * Spawns a creative simulated player and waits for it to settle.
 *
 * @category Testing
 * @since 1.0.0
 */
function Spawn(name: string, dimension: Dimension, location: Vector3): SimulatedPlayer
{
    return spawnSimulatedPlayer({ dimension,
        ...location }, name, GameMode.Creative);
}

/**
 * Spawns an immobile, otherwise unmodified villager subject.
 *
 * @category Testing
 * @since 1.0.0
 */
function Villager(dimension: Dimension, location: Vector3): Entity
{
    const entity = dimension.spawnEntity("minecraft:villager_v2", location);
    entity.addEffect("slowness", 20 * 600, { amplifier: 255,
        showParticles: false });
    entity.addEffect("resistance", 20 * 600, { amplifier: 255,
        showParticles: false });
    entity.addEffect("fire_resistance", 20 * 600, { amplifier: 1,
        showParticles: false });
    return entity;
}

/**
 * Waits until a predicate holds, polling every tick.
 *
 * @throws { Error } If the predicate does not hold in time.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Until(label: string, ticks: number, predicate: () => boolean): Promise<number>
{
    for (let elapsed = 0; elapsed <= ticks; elapsed++)
    {
        try
        {
            if (predicate())
            {
                return elapsed;
            }
        }
        catch
        {
            // Native reads may fail while chunks load.
        }

        await Wait(1);
    }

    throw new Error(`${label} did not happen within ${ticks} ticks.`);
}

/**
 * The observed process: complete protocol and lifecycle matrix.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Observed(): Promise<void>
{
    const overworld = world.getDimension("overworld");
    const nether = world.getDimension("nether");
    overworld.runCommand(`tickingarea add circle 0 -60 0 4 ${TickingArea.Arena}`);
    overworld.runCommand("gamerule dodaylightcycle false");
    overworld.runCommand("gamerule domobspawning false");
    overworld.runCommand("time set noon");
    await Until("arena load", 200, () => overworld.getBlock({ x: 0,
        y: -61,
        z: 0 })?.typeId === "minecraft:grass_block");
    const subject = Spawn("Subject", overworld, { x: 0.5,
        y: -60,
        z: 0.5 });
    const north = Spawn("North", overworld, { x: 0.5,
        y: -60,
        z: -5.5 });
    const south = Spawn("South", overworld, { x: 0.5,
        y: -60,
        z: 6.5 });
    const far = Spawn("Far", overworld, { x: 40.5,
        y: -60,
        z: 0.5 });
    const traveller = Spawn("Nether", overworld, { x: 10.5,
        y: -60,
        z: 10.5 });
    const npc = Villager(overworld, { x: 7.5,
        y: -60,
        z: 0.5 });
    await Wait(20);
    traveller.teleport({ x: 0.5,
        y: 100,
        z: 0.5 }, { dimension: nether });
    // Simulated players do not keep nether chunks ticking; native spawnParticle requires a ticking chunk.
    nether.runCommand(`tickingarea add circle 0 100 0 2 ${TickingArea.Nether}`);
    await Until("nether arrival", 200, () => traveller.dimension.id === nether.id);
    await Wait(40);
    const ready = await Observer<{ Tick: number }>("mark");
    Step("Setup", { ObserverTick: ready.Tick,
        Players: Object.fromEntries([ subject, north, south, far, traveller ].map((player) =>
            [ player.name, { Id: player.id,
                Dimension: player.dimension.id,
                Head: player.getHeadLocation() } ])),
        Npc: npc.id });
    if (!NativeTextOnly)
    {
        Step("WidgetAssets", await QualifyWidgets(overworld, subject));
    }

    Step("SpatialText", await QualifyText(overworld, subject));

    // Raw wire: delivery, actionable version mismatch, ownership, malformed and stale traffic.
    const rawConnection = `raw-${system.currentTick}`;
    const hello = await Raw({ Version,
        ClientId: RawClientId,
        ConnectionId: rawConnection,
        RequestId: 1,
        Operation: "hello" });
    Check(hello?.Status === "ready" && typeof hello.RuntimeId === "string", "raw hello was not acknowledged ready");
    const runtime = hello.RuntimeId;
    const version = await Raw({ Version: Version + 1,
        ClientId: RawClientId,
        ConnectionId: `${rawConnection}-v`,
        RequestId: 1,
        Operation: "hello" });
    Check(version?.Status === "rejected" && version.Message?.includes("unsupported"),
        `incompatible protocol version was not rejected: ${JSON.stringify(version)}`);
    const silent = Acknowledgements.length;
    await Raw("{ malformed");
    await Raw(JSON.stringify({ Version,
        ClientId: RawClientId,
        Operation: "hello" }));
    Check(Acknowledgements.length === silent, "uncorrelated malformed traffic was acknowledged");
    const invalid = await Raw({ Version,
        ClientId: RawClientId,
        ConnectionId: rawConnection,
        RequestId: 2,
        Operation: "set",
        RuntimeId: runtime,
        EntityId: "",
        Intent: { Kind: "builtin",
            Name: "thinking" },
        Options: { DurationTicks: null,
            MaxDistance: 32,
            Offset: { x: 0,
                y: 0.25,
                z: 0 },
            Scale: 1 } });
    Check(invalid?.Status === "rejected", "correlated invalid body was not rejected");
    const missing = await Raw({ Version,
        ClientId: RawClientId,
        ConnectionId: rawConnection,
        RequestId: 3,
        Operation: "set",
        RuntimeId: runtime,
        EntityId: "-4242",
        Intent: { Kind: "builtin",
            Name: "thinking" },
        Options: { DurationTicks: null,
            MaxDistance: 32,
            Offset: { x: 0,
                y: 0.25,
                z: 0 },
            Scale: 1 } });
    Check(missing?.Status === "rejected" && missing.Message?.includes("unavailable"),
        `missing subject was not rejected: ${JSON.stringify(missing)}`);
    const stale = await Raw({ Version,
        ClientId: RawClientId,
        ConnectionId: rawConnection,
        RequestId: 3,
        Operation: "clear",
        RuntimeId: runtime,
        EntityId: npc.id });
    Check(stale?.Status === "rejected" && stale.Message?.includes("stale"), "duplicated request was not fenced");
    Step("RawProtocol", { RuntimeId: runtime,
        AcknowledgementSourceType: Evidence.AcknowledgementSourceType,
        VersionMismatch: version.Message,
        InvalidBody: invalid.Message,
        MissingSubject: missing.Message,
        Stale: stale.Message,
        MalformedAcknowledged: false });

    // Player subject with PUA glyphs: private per-viewer text and particles, self and range exclusion.
    const first = await Accepted("a", "set", { EntityId: subject.id,
        Glyphs: Glyph });
    await Wait(3);
    let observation = await Window();
    const expected = Audience(subject);
    Check(Same(expected, [ north.id, south.id ].sort()), `unexpected arena audience ${JSON.stringify(expected)}`);
    ExpectParticles("player glyph", observation, subject, expected);
    const texts = ExpectTexts("player glyph", observation, subject, expected);
    Check(observation.Particles[subject.id] === undefined, "subject player received its own bubble particles");
    Check(!observation.Texts.some((text) => text.Viewers.includes(subject.id)), "subject player saw its own text");
    Check(observation.Particles[far.id] === undefined && observation.Particles[traveller.id] === undefined,
        "out-of-range or other-dimension viewer received particles");
    Step("PlayerSubjectPrivacy", { AcceptTicks: first.ElapsedTicks,
        Viewers: expected,
        TextScale: texts[0].Scale,
        ParticlesPerViewer: Object.fromEntries(expected.map((id) => [ id, observation.Particles[id].Count ])),
        WindowTicks: observation.Window });

    // Inclusive range boundary measured head to head.
    const boundary = Distance(subject.getHeadLocation(), far.getHeadLocation());
    await Accepted("a", "set", { EntityId: subject.id,
        Glyphs: Glyph,
        Options: { MaxDistance: boundary + 0.01 } });
    await Wait(3);
    observation = await Window();
    ExpectTexts("range inside", observation, subject, [ ...expected, far.id ]);
    ExpectParticles("range inside", observation, subject, [ ...expected, far.id ]);
    const removedBefore = observation.Removed;
    await Accepted("a", "set", { EntityId: subject.id,
        Glyphs: Glyph,
        Options: { MaxDistance: boundary - 0.01 } });
    await Wait(3);
    observation = await Window();
    ExpectTexts("range outside", observation, subject, expected);
    ExpectParticles("range outside", observation, subject, expected);
    Check(observation.Removed >= removedBefore + 3, "replaced generation texts were not removed");
    Step("RangeBoundary", { Distance: boundary,
        Inside: boundary + 0.01,
        Outside: boundary - 0.01 });

    // Movement: text and particles follow the current head.
    const viewer = north.id;
    const headBefore = subject.getHeadLocation();
    const before = TextsAt(observation, Panel(subject)).find((text) => text.Viewers[0] === viewer)!.Location;
    subject.teleport({ x: 2.5,
        y: -60,
        z: 1.5 });
    await Wait(5);
    observation = await Window();
    // The outside-boundary range is still active, so the audience is recomputed at the new head.
    const moving = Audience(subject, boundary - 0.01);
    ExpectTexts("movement", observation, subject, moving);
    ExpectParticles("movement", observation, subject, moving);
    const headAfter = subject.getHeadLocation();
    const after = TextsAt(observation, Panel(subject)).find((text) => text.Viewers[0] === viewer)!.Location;
    Check(Math.abs(headAfter.x - headBefore.x) > 1 &&
        Math.abs(after[0] - before[0] - (headAfter.x - headBefore.x)) < 0.05 &&
        Math.abs(after[1] - before[1] - (headAfter.y - headBefore.y)) < 0.05 &&
        Math.abs(after[2] - before[2] - (headAfter.z - headBefore.z)) < 0.05,
    `text did not follow head movement: ${JSON.stringify([ headBefore, headAfter, before, after ])}`);
    Check(observation.Moved > 0, "existing text was not relocated");
    Step("Movement", { HeadBefore: headBefore,
        HeadAfter: headAfter,
        Before: before,
        After: after,
        Audience: moving });

    // Cross-connection replacement and ownership-fenced disposal.
    await Accepted("b", "set", { EntityId: subject.id,
        Builtin: "Exclamatory" });
    await Wait(3);
    observation = await Window();
    ExpectTexts("replacement", observation, subject, []);
    ExpectParticles("replacement", observation, subject, expected, "bedform_canvas:intent_exclamatory");
    const owner = await Raw({ Version,
        ClientId: ConsumerId.A,
        ConnectionId: `${rawConnection}-owner`,
        RequestId: 1,
        Operation: "hello" });
    Check(owner?.Status === "rejected" && owner.Message?.includes("already has an active connection"),
        `cross-pack Id ownership was not enforced: ${JSON.stringify(owner)}`);
    const disposed = await Accepted("a", "dispose");
    await Wait(3);
    observation = await Window();
    ExpectParticles("survives other disposal", observation, subject, expected, "bedform_canvas:intent_exclamatory");
    const late = await Rejected("a", "set", "", { EntityId: npc.id,
        Builtin: "Thinking" });
    await Accepted("a", "start");
    Step("ReplacementAndDisposal", { DisposeTicks: disposed.ElapsedTicks,
        OwnershipConflict: owner.Message,
        LateOperation: late });

    // NPC subject, stale expiry fencing and Clear by another connection.
    const expiry = await Accepted("b", "set", { EntityId: npc.id,
        Builtin: "Thinking",
        Options: { DurationTicks: 30 } });
    const expiryStart = system.currentTick - expiry.ElapsedTicks;
    await Wait(10);
    const replacement = await Accepted("a", "set", { EntityId: npc.id,
        Builtin: "Sleep",
        Options: { DurationTicks: 60 } });
    const replacementStart = system.currentTick - replacement.ElapsedTicks;
    await Wait(Math.max(0, expiryStart + 36 - system.currentTick));
    observation = await Window(3);
    const npcAudience = Audience(npc);
    Check(npcAudience.includes(subject.id), "subject player should view the NPC bubble");
    ExpectParticles("stale expiry fenced", observation, npc, npcAudience, "bedform_canvas:intent_sleep");
    Check(!ParticleViewers(observation, Panel(npc), "bedform_canvas:intent_thinking").length,
        "replaced thinking presentation survived");
    await Wait(Math.max(0, replacementStart + 63 - system.currentTick));
    observation = await Window(3);
    ExpectParticles("replacement expiry", observation, npc, []);
    await Accepted("a", "set", { EntityId: npc.id,
        Builtin: "Interrogative" });
    await Wait(3);
    observation = await Window(3);
    ExpectParticles("npc indefinite", observation, npc, npcAudience, "bedform_canvas:intent_interrogative");
    await Accepted("b", "clear", { EntityId: npc.id });
    await Wait(3);
    observation = await Window(3);
    ExpectParticles("cross-connection clear", observation, npc, []);
    Step("NpcExpiryAndClear", { NpcAudience: npcAudience,
        StaleExpiryTick: expiryStart + 30,
        ReplacementExpiryTick: replacementStart + 60 });

    // Renderer error isolation: one viewer's native particle failure leaves the other viewer intact.
    await Accepted("a", "set", { EntityId: npc.id,
        Glyphs: Glyph });
    await Wait(3);
    await Observer("fault", { Enabled: true,
        ViewerId: north.id });
    await Wait(3);
    observation = await Window(6);
    const healthy = npcAudience.filter((id) => id !== north.id);
    ExpectParticles("fault isolation npc", observation, npc, healthy);
    ExpectTexts("fault isolation npc", observation, npc, healthy);
    ExpectParticles("fault isolation player", observation, subject, [ south.id ]);
    Check(observation.Injected > 0 && observation.Particles[north.id] === undefined, "fault was not injected");
    const injected = observation.Injected;
    await Observer("fault", { Enabled: false,
        ViewerId: north.id });
    await Wait(3);
    observation = await Window();
    ExpectParticles("fault recovery npc", observation, npc, npcAudience);
    ExpectTexts("fault recovery npc", observation, npc, npcAudience);
    ExpectParticles("fault recovery player", observation, subject, expected);
    Step("ErrorIsolation", { FaultedViewer: north.id,
        InjectedFailures: injected });

    // Dimension change: a player subject's bubble moves to the nether audience only.
    const walker = Spawn("Walker", overworld, { x: -4.5,
        y: -60,
        z: -2.5 });
    await Wait(10);
    await Accepted("a", "set", { EntityId: walker.id,
        Glyphs: Glyph });
    await Wait(3);
    observation = await Window();
    const walkerAudience = Audience(walker);
    const walkerPanel = Panel(walker);
    ExpectTexts("overworld walker", observation, walker, walkerAudience);
    walker.teleport({ x: traveller.location.x + 1,
        y: traveller.location.y,
        z: traveller.location.z }, { dimension: nether });
    const transferTicks = await Until("player dimension transfer", 100, () => walker.dimension.id === nether.id);
    await Wait(5);
    observation = await Window();
    ExpectTexts("nether walker", observation, walker, [ traveller.id ]);
    ExpectParticles("nether walker", observation, walker, [ traveller.id ]);
    Check(!TextsAt(observation, walkerPanel).some((text) => text.Dimension === overworld.id) &&
        !ParticleViewers(observation, walkerPanel).length, "overworld presentation survived the dimension change");
    await Accepted("a", "clear", { EntityId: walker.id });
    walker.disconnect();

    // The NPC subject keeps A's glyph request from the fault step; its bubble also follows it.
    const npcId = npc.id;
    const npcPanel = Panel(npc);
    npc.teleport(traveller.location, { dimension: nether });
    const npcTransferTicks = await Until("npc dimension transfer", 100, () =>
        world.getEntity(npcId)?.dimension.id === nether.id);
    await Wait(5);
    const transferred = world.getEntity(npcId)!;
    observation = await Window();
    ExpectTexts("nether npc", observation, transferred, [ traveller.id ]);
    ExpectParticles("nether npc", observation, transferred, [ traveller.id ]);
    Check(!TextsAt(observation, npcPanel).some((text) => text.Dimension === overworld.id) &&
        !ParticleViewers(observation, npcPanel).length, "overworld NPC presentation survived the dimension change");
    await Accepted("a", "clear", { EntityId: npcId });
    Step("DimensionChange", { PlayerTransferTicks: transferTicks,
        PlayerOverworldAudience: walkerAudience,
        NpcTransferTicks: npcTransferTicks,
        NpcSameEntityId: transferred.id === npcId,
        NetherAudience: [ traveller.id ] });

    // Unload/reload: suspension keeps elapsed duration; expired dormant requests do not resume.
    // Simulated players load no chunks here, so a ticking area loads and unloads the remote region.
    const remoteArea = `tickingarea add circle 302 -60 2 1 ${TickingArea.Remote}`;
    const park = { x: 0.5,
        y: -60,
        z: 60.5 };
    overworld.runCommand(remoteArea);
    await Until("remote chunk", 200, () => overworld.getBlock({ x: 302,
        y: -61,
        z: 0 })?.typeId === "minecraft:grass_block");
    const roamer = Spawn("Roamer", overworld, park);
    await Wait(5);
    roamer.teleport({ x: 300.5,
        y: -60,
        z: 0.5 });
    const kept = Villager(overworld, { x: 302.5,
        y: -60,
        z: 0.5 });
    const lapsed = Villager(overworld, { x: 302.5,
        y: -60,
        z: 4.5 });
    await Wait(5);
    await Accepted("a", "set", { EntityId: kept.id,
        Glyphs: Glyph });
    const lapse = await Accepted("b", "set", { EntityId: lapsed.id,
        Glyphs: Glyph,
        Options: { DurationTicks: 300 } });
    const lapseStart = system.currentTick - lapse.ElapsedTicks;
    await Wait(3);
    observation = await Window();
    ExpectTexts("remote kept", observation, kept, [ roamer.id ]);
    ExpectTexts("remote lapsed", observation, lapsed, [ roamer.id ]);
    const keptId = kept.id;
    const lapsedId = lapsed.id;
    roamer.teleport(park);
    overworld.runCommand(`tickingarea remove ${TickingArea.Remote}`);
    const unloadTicks = await Until("remote unload", 400, () => !world.getEntity(keptId)?.isValid &&
        !world.getEntity(lapsedId)?.isValid);
    const unloadedTick = system.currentTick;
    await Wait(3);
    observation = await Window();
    Check(observation.Particles[roamer.id] === undefined && !observation.Texts.some((text) =>
        text.Viewers.includes(roamer.id)), "unloaded subjects continued rendering");
    await Wait(Math.max(0, lapseStart + 305 - system.currentTick));
    overworld.runCommand(remoteArea);
    const reloadTicks = await Until("remote reload", 400, () => world.getEntity(keptId)?.isValid === true);
    roamer.teleport({ x: 300.5,
        y: -60,
        z: 0.5 });
    await Wait(5);
    const reloaded = world.getEntity(keptId)!;
    observation = await Window();
    ExpectTexts("reload resumed", observation, reloaded, [ roamer.id ]);
    const reloadedLapsed = world.getEntity(lapsedId);
    Check(reloadedLapsed?.isValid, "expired subject did not reload");
    ExpectTexts("reload expired", observation, reloadedLapsed!, []);
    ExpectParticles("reload expired", observation, reloadedLapsed!, []);
    Step("UnloadReload", { UnloadTicks: unloadTicks,
        ReloadTicks: reloadTicks,
        LapsedDuration: 300,
        ExpiredWhileUnloaded: unloadedTick < lapseStart + 300 });

    // Death clears immediately and later requests for the dead subject are rejected.
    const doomed = Villager(overworld, { x: -8.5,
        y: -60,
        z: 0.5 });
    await Wait(3);
    await Accepted("b", "set", { EntityId: doomed.id,
        Builtin: "Hunger" });
    await Wait(3);
    observation = await Window();
    const doomedAudience = Audience(doomed);
    const doomedPanel = Panel(doomed);
    ExpectParticles("before death", observation, doomed, doomedAudience, "bedform_canvas:intent_hunger");
    const doomedId = doomed.id;
    Check(doomed.kill(), "villager could not be killed");
    await Wait(3);
    observation = await Window();
    Check(!ParticleViewers(observation, doomedPanel).length, "dead subject continued rendering");
    // The dying villager remains valid during its death animation; Canvas must still refuse it.
    const dying = world.getEntity(doomedId)?.isValid === true;
    const dead = await Rejected("b", "set", dying ? "has died" : "", { EntityId: doomedId,
        Builtin: "Hunger" });
    await Wait(3);
    observation = await Window();
    Check(!ParticleViewers(observation, doomedPanel).length, "a request after death rendered on the corpse");
    Step("Death", { Audience: doomedAudience,
        ValidWhileDying: dying,
        LaterRequest: dead });

    // Disconnect clears the departing subject and removes it from every audience.
    await Accepted("a", "set", { EntityId: south.id,
        Glyphs: Glyph });
    await Wait(3);
    observation = await Window();
    const southAudience = Audience(south);
    ExpectTexts("before disconnect", observation, south, southAudience);
    const southPanel = Panel(south);
    const southId = south.id;
    south.disconnect();
    await Wait(5);
    observation = await Window();
    Check(!TextsAt(observation, southPanel).length && !ParticleViewers(observation, southPanel).length,
        "disconnected subject continued rendering");
    Check(observation.Particles[southId] === undefined && !observation.Texts.some((text) =>
        text.Viewers.includes(southId)), "disconnected viewer kept an audience");
    ExpectParticles("after disconnect", observation, subject, Audience(subject), "bedform_canvas:intent_exclamatory");
    Step("Disconnect", { Audience: southAudience });

    // Disposal of B removes only B's current requests; A's dormant-turned-live remote request survives.
    await Accepted("b", "dispose");
    await Wait(3);
    observation = await Window();
    ExpectParticles("after b disposal", observation, subject, []);
    ExpectTexts("a survives b disposal", observation, world.getEntity(keptId)!, [ roamer.id ]);
    const afterDispose = await Rejected("b", "set", "", { EntityId: subject.id,
        Builtin: "Thinking" });
    await Accepted("b", "start");
    Step("ScopedDisposal", { LateOperation: afterDispose });

    // Leave active requests and text at shutdown so the restart can prove session-only cleanup.
    await Accepted("a", "set", { EntityId: north.id,
        Glyphs: Glyph });
    await Accepted("b", "set", { EntityId: subject.id,
        Builtin: "Thinking" });
    await Wait(3);
    observation = await Window();
    ExpectTexts("before restart", observation, north, Audience(north));
    const saved: Saved = { ActiveAtStop: observation.Texts.length,
        KeptId: keptId,
        Phase: 1,
        RawConnectionId: rawConnection,
        RawRequestId: 4,
        RuntimeId: runtime };
    world.setDynamicProperty(DynamicProperty.Session, JSON.stringify(saved));
    Step("ActiveAtStop", saved);
    console.warn(`${Marker.Evidence} ${JSON.stringify({ Session: "observed",
        Steps,
        Evidence })}`);
    console.warn(Marker.Saved);
}

/**
 * Rejects a connection from the previous process and returns a fresh RuntimeId.
 *
 * @throws { Error } If the stale connection is accepted or the runtime identity is reused.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Fence(saved: Saved): Promise<{ RuntimeId: string;
    ConnectionId: string;
    Stale: string }>
{
    const stale = await Raw({ Version,
        ClientId: RawClientId,
        ConnectionId: saved.RawConnectionId,
        RequestId: saved.RawRequestId,
        Operation: "clear",
        RuntimeId: saved.RuntimeId,
        EntityId: "-1" });
    Check(stale?.Status === "rejected" && stale.Message?.includes("restarted"),
        `pre-restart connection was not rejected: ${JSON.stringify(stale)}`);
    const connection = `raw-restart-${saved.Phase}-${system.currentTick}`;
    const hello = await Raw({ Version,
        ClientId: RawClientId,
        ConnectionId: connection,
        RequestId: 1,
        Operation: "hello" });
    Check(hello?.Status === "ready" && hello.RuntimeId !== saved.RuntimeId, "restart did not issue a new RuntimeId");
    return { ConnectionId: connection,
        RuntimeId: hello.RuntimeId,
        Stale: stale.Message! };
}

/**
 * Waits for the persisted arena chunks after a restart.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Arena(): Promise<Dimension>
{
    const overworld = world.getDimension("overworld");
    await Until("arena reload", 200, () => overworld.getBlock({ x: 0,
        y: -61,
        z: 0 })?.typeId === "minecraft:grass_block");
    return overworld;
}

/**
 * The observed restart: previous-session requests are not redrawn, old connections are fenced and
 * fresh connections render privately again.
 *
 * @category Testing
 * @since 1.0.0
 */
async function ObservedRestart(saved: Saved): Promise<void>
{
    const overworld = await Arena();
    const speaker = Spawn("Speaker", overworld, { x: 0.5,
        y: -60,
        z: 0.5 });
    const witness = Spawn("Witness", overworld, { x: 0.5,
        y: -60,
        z: -5.5 });
    const watcher = Spawn("Watcher", overworld, { x: 300.5,
        y: -60,
        z: 0.5 });
    await Until("previous subject reload", 200, () => world.getEntity(saved.KeptId)?.isValid === true);
    await Wait(10);
    let observation = await Window(6);
    Check(observation.Added === 0 && observation.Texts.length === 0 &&
        Object.keys(observation.Particles).length === 0, "previous-session requests were redrawn after restart");
    const kept = world.getEntity(saved.KeptId)!;
    Check(Distance(watcher.getHeadLocation(), kept.getHeadLocation()) < 32, "watcher is not in range of the old subject");
    const fence = await Fence(saved);
    Step("RestartCleanup", { PreviousRuntimeId: saved.RuntimeId,
        RuntimeId: fence.RuntimeId,
        ActiveTextsAtStop: saved.ActiveAtStop,
        PreviousSubjectLoaded: true,
        AddedBeforeNewRequests: observation.Added,
        ParticleViewersBeforeNewRequests: Object.keys(observation.Particles).length,
        StaleConnection: fence.Stale });

    await Accepted("a", "set", { EntityId: speaker.id,
        Glyphs: Glyph });
    await Wait(3);
    observation = await Window();
    const audience = Audience(speaker);
    Check(Same(audience, [ witness.id ]), `unexpected restart audience ${JSON.stringify(audience)}`);
    ExpectTexts("restart glyph", observation, speaker, audience);
    ExpectParticles("restart glyph", observation, speaker, audience);
    Check(observation.Particles[speaker.id] === undefined && observation.Particles[watcher.id] === undefined,
        "restart subject or out-of-range watcher received particles");
    await Accepted("b", "set", { EntityId: speaker.id,
        Builtin: "Thinking" });
    await Wait(3);
    observation = await Window();
    ExpectTexts("restart replacement", observation, speaker, []);
    ExpectParticles("restart replacement", observation, speaker, audience, "bedform_canvas:intent_thinking");
    await Accepted("a", "dispose");
    await Accepted("b", "clear", { EntityId: speaker.id });
    await Accepted("b", "dispose");
    await Wait(3);
    observation = await Window();
    Check(observation.Texts.length === 0 && Object.keys(observation.Particles).length === 0,
        "presentation remained after clean disposal");
    const next: Saved = { ...saved,
        Phase: 2,
        RawConnectionId: fence.ConnectionId,
        RawRequestId: 2,
        RuntimeId: fence.RuntimeId };
    world.setDynamicProperty(DynamicProperty.Session, JSON.stringify(next));
    Step("RestartRendering", { Audience: audience,
        Removed: observation.Removed });
    console.warn(`${Marker.Evidence} ${JSON.stringify({ Session: "restart",
        Steps,
        Evidence })}`);
    console.warn(Marker.Saved);
}

/**
 * The final process with the byte-identical built Canvas artifact: wire, replacement, expiry, clear and
 * disposal smoke checks. Native shape queries are pack-scoped, so text audiences are not observable here.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Unmodified(saved: Saved): Promise<void>
{
    const overworld = await Arena();
    const fence = await Fence(saved);
    const speaker = Spawn("Speaker", overworld, { x: 0.5,
        y: -60,
        z: 0.5 });
    Spawn("Witness", overworld, { x: 0.5,
        y: -60,
        z: -5.5 });
    await Wait(20);
    const accepted = await Accepted("a", "set", { EntityId: speaker.id,
        Glyphs: Glyph });
    await Wait(5);
    const visible = world.primitiveShapesManager.getShapes().filter((shape) => shape instanceof TextPrimitive).length;
    await Accepted("b", "set", { EntityId: speaker.id,
        Builtin: "Thinking",
        Options: { DurationTicks: 10 } });
    await Wait(15);
    await Accepted("a", "set", { EntityId: speaker.id,
        Builtin: "Affirmative" });
    await Accepted("b", "clear", { EntityId: speaker.id });
    await Accepted("a", "dispose");
    await Accepted("b", "dispose");
    overworld.runCommand(`tickingarea remove ${TickingArea.Arena}`);
    overworld.runCommand(`tickingarea remove ${TickingArea.Remote}`);
    world.getDimension("nether").runCommand(`tickingarea remove ${TickingArea.Nether}`);
    world.setDynamicProperty(DynamicProperty.Session, undefined);
    Step("UnmodifiedArtifact", { PreviousRuntimeId: saved.RuntimeId,
        RuntimeId: fence.RuntimeId,
        StaleConnection: fence.Stale,
        AcceptTicks: accepted.ElapsedTicks,
        CrossPackShapeQuery: visible > 0 });
    console.warn(`${Marker.Evidence} ${JSON.stringify({ Session: "unmodified",
        Steps,
        Evidence })}`);
    console.warn(Marker.Pass);
}

system.run(() =>
{
    const stored = world.getDynamicProperty(DynamicProperty.Session);
    const saved = stored === undefined ? undefined : JSON.parse(String(stored)) as Saved;
    void (saved === undefined ? Observed() : saved.Phase === 1 ? ObservedRestart(saved) : Unmodified(saved))
        .catch((error: unknown) =>
            console.warn(`${Marker.Fail} [${Steps.at(-1) ?? "start"}] ${error instanceof Error ? error.message : String(error)}`));
});
