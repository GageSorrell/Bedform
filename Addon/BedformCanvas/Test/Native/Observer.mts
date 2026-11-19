/**
 * Fixture-only observer prepended to the built Canvas script for the observed native session. It
 * records successful native particle and text calls made in Canvas's own script context, reports them
 * to the driver on request and can inject a particle fault for one viewer. Canvas code is unchanged.
 *
 * @module bedform-canvas/Test/Native/Observer
 *
 * @file      Observer.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as Server from "@minecraft/server";
import { FixtureEvent, Marker } from "./Keys.mjs";

/**
 * One registered native text primitive as observed after a successful addText.
 *
 * @category Testing
 * @since 1.0.0
 */
export interface TextRecord
{
    readonly Id: number;
    readonly Text: string;
    readonly Viewers: ReadonlyArray<string>;
    readonly Dimension: string;
    Location: [ number, number, number ];
    readonly DepthTest: boolean;
    readonly BackgroundAlpha: number | null;
    readonly Color: [ number, number, number, number ] | null;
    readonly Scale: number;
    readonly UseRotation: boolean;
    readonly BackfaceVisible: boolean;
    readonly TextBackfaceVisible: boolean;
}

/**
 * Successful particle emission to one viewer during the current observation window. Clusters are
 * running means of nearby spawn locations with their particle counts.
 *
 * @category Testing
 * @since 1.0.0
 */
export interface ParticleRecord
{
    Count: number;
    readonly Effects: Array<string>;
    readonly Clusters: Array<[ number, number, number, number ]>;
}

/**
 * The observation reported to the driver.
 *
 * @category Testing
 * @since 1.0.0
 */
export interface Observation
{
    readonly Tick: number;
    readonly Window: number;
    readonly Particles: Record<string, ParticleRecord>;
    readonly Texts: ReadonlyArray<TextRecord>;
    readonly Added: number;
    readonly Removed: number;
    readonly Moved: number;
    readonly Injected: number;
}

const ClusterRadius = 2.5;
const ChunkLength = 1_500;

/**
 * Rounds a coordinate for compact reporting.
 *
 * @category Testing
 * @since 1.0.0
 */
function Round(value: number): number
{
    return Math.round(value * 1_000) / 1_000;
}

/**
 * Wraps the native Canvas-realm prototypes. Each wrapper records only after the native call succeeds.
 *
 * @throws { Error } If a native prototype cannot be replaced.
 *
 * @category Testing
 * @since 1.0.0
 */
export function Install(server: typeof Server): void
{
    const { Player, PrimitiveShapesManager, TextPrimitive, system } = server;
    const ids = new WeakMap<object, number>();
    const texts = new Map<number, TextRecord>();
    const faults = new Set<string>();
    let particles = new Map<string, ParticleRecord>();
    let windowStart = system.currentTick;
    let next = 0;
    let added = 0;
    let removed = 0;
    let moved = 0;
    let injected = 0;
    const spawn = Player.prototype.spawnParticle;
    const add = PrimitiveShapesManager.prototype.addText;
    const remove = TextPrimitive.prototype.remove;
    const locate = TextPrimitive.prototype.setLocation;
    Player.prototype.spawnParticle = function (this: Server.Player, effect: string, location: Server.Vector3,
        variables?: Server.MolangVariableMap): void
    {
        const viewer = this.id;
        if (faults.has(viewer))
        {
            injected++;
            throw new Error("Injected native fixture particle fault.");
        }

        spawn.call(this, effect, location, variables);
        let record = particles.get(viewer);
        if (!record)
        {
            record = { Clusters: [],
                Count: 0,
                Effects: [] };
            particles.set(viewer, record);
        }

        record.Count++;
        if (!record.Effects.includes(effect))
        {
            record.Effects.push(effect);
        }

        const cluster = record.Clusters.find((entry: [ number, number, number, number ]) =>
            Math.hypot(entry[0] - location.x, entry[1] - location.y, entry[2] - location.z) <= ClusterRadius);
        if (cluster)
        {
            const count = cluster[3] + 1;
            cluster[0] += (location.x - cluster[0]) / count;
            cluster[1] += (location.y - cluster[1]) / count;
            cluster[2] += (location.z - cluster[2]) / count;
            cluster[3] = count;
        }
        else if (record.Clusters.length < 16)
        {
            record.Clusters.push([ location.x, location.y, location.z, 1 ]);
        }
    };

    PrimitiveShapesManager.prototype.addText = function (this: Server.PrimitiveShapesManager,
        text: Server.TextPrimitive, dimension?: Server.Dimension): void
    {
        add.call(this, text, dimension);
        const id = ++next;
        ids.set(text, id);
        added++;
        const background = text.backgroundColorOverride;
        const color = text.color;
        texts.set(id, { BackfaceVisible: text.backfaceVisible,
            BackgroundAlpha: background ? background.alpha : null,
            Color: color
                ? [ Round(color.red), Round(color.green), Round(color.blue), Round(color.alpha) ] : null,
            DepthTest: text.depthTest,
            Dimension: (dimension ?? text.dimension).id,
            Id: id,
            Location: [ Round(text.location.x), Round(text.location.y), Round(text.location.z) ],
            Scale: Round(text.scale),
            Text: typeof text.text === "string" ? text.text : JSON.stringify(text.text),
            TextBackfaceVisible: text.textBackfaceVisible,
            UseRotation: text.useRotation,
            Viewers: text.visibleTo.map((viewer: Server.Player) => viewer.id) });
    };

    TextPrimitive.prototype.remove = function (this: Server.TextPrimitive): void
    {
        remove.call(this);
        const id = ids.get(this);
        if (id !== undefined && texts.delete(id))
        {
            removed++;
        }
    };

    TextPrimitive.prototype.setLocation = function (this: Server.TextPrimitive,
        location: Server.DimensionLocation | Server.Vector3): void
    {
        locate.call(this, location);
        const record = texts.get(ids.get(this) ?? -1);
        if (record)
        {
            record.Location = [ Round(location.x), Round(location.y), Round(location.z) ];
            moved++;
        }
    };

    if (Player.prototype.spawnParticle === spawn || PrimitiveShapesManager.prototype.addText === add ||
        TextPrimitive.prototype.remove === remove || TextPrimitive.prototype.setLocation === locate)
    {
        throw new Error("Native fixture observer could not replace Canvas-realm prototypes.");
    }

    const reply = (nonce: number, value: unknown): void =>
    {
        const data = JSON.stringify(value);
        const count = Math.max(1, Math.ceil(data.length / ChunkLength));
        for (let index = 0; index < count; index++)
        {
            system.sendScriptEvent(FixtureEvent.Observation, JSON.stringify({ Count: count,
                Data: data.slice(index * ChunkLength, (index + 1) * ChunkLength),
                Index: index,
                Nonce: nonce }));
        }
    };

    const receive = (event: Server.ScriptEventCommandMessageAfterEvent): void =>
    {
        if (event.id !== FixtureEvent.Observer)
        {
            return;
        }

        const command = JSON.parse(event.message) as { Nonce: number;
            Operation: string;
            ViewerId?: string;
            Enabled?: boolean; };
        if (command.Operation === "mark")
        {
            particles = new Map();
            windowStart = system.currentTick;
            reply(command.Nonce, { Tick: windowStart });
        }
        else if (command.Operation === "fault")
        {
            if (command.Enabled)
            {
                faults.add(command.ViewerId!);
            }
            else
            {
                faults.delete(command.ViewerId!);
            }

            reply(command.Nonce, { Tick: system.currentTick });
        }
        else
        {
            const observation: Observation = { Added: added,
                Injected: injected,
                Moved: moved,
                Particles: Object.fromEntries([ ...particles ].map(([ viewer, record ]: [ string,
                    ParticleRecord ]) => [ viewer, { ...record,
                    Clusters: record.Clusters.map((cluster: [ number, number, number, number ]) =>
                        [ Round(cluster[0]), Round(cluster[1]), Round(cluster[2]), cluster[3] ]) } ])),
                Removed: removed,
                Texts: [ ...texts.values() ],
                Tick: system.currentTick,
                Window: system.currentTick - windowStart };
            reply(command.Nonce, observation);
        }
    };

    system.afterEvents.scriptEventReceive.subscribe(receive);
    console.warn(Marker.ObserverReady);
}
