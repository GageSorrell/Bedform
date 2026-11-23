// Deterministic contract peers for component tests. Each call crosses a JSON boundary.
import { isDeepStrictEqual } from "node:util";
import { Limits, Operations, Version } from "./Model.mjs";

class Refusal extends Error {
    constructor(code) {
        super(code);
        this.code = code;
    }
}

const refuse = code => { throw new Refusal(code); };
const clone = value => JSON.parse(JSON.stringify(value));

export class ControlPeer {
    #role;
    #capabilities;
    #credentials;
    #compatibility;
    #accepted = new Set();
    #check;
    #dispatch;

    constructor({ role, capabilities, credentials, compatibility, check, dispatch }) {
        this.#role = role;
        this.#capabilities = capabilities;
        this.#credentials = credentials;
        this.#compatibility = compatibility;
        this.#check = check;
        this.#dispatch = dispatch;
    }

    exchange(token, request, elapsedMs = 0) {
        const bytes = JSON.stringify(request);
        const message = JSON.parse(bytes);
        const response = { v: Version, kind: "response", id: message?.id,
            ...(Object.hasOwn(Operations, message?.op) && { op: message.op }) };
        try {
            const caller = this.#credentials.get(token);
            if (!caller) refuse("Unauthorized");
            if (message?.v !== Version) refuse("UnsupportedVersion");
            if (Buffer.byteLength(bytes) > Limits.ControlBytes || !this.#check("Request", message)) refuse("Malformed");
            const { id, op, args, timeoutMs = Limits.DefaultTimeoutMs } = message;
            if (elapsedMs >= timeoutMs) refuse("Timeout");
            if (!Operations[op][2].includes(this.#role)) refuse("UnsupportedCapability");
            let value;
            if (op === "Hello") {
                if (args.role !== caller || !this.#allowedCaller(caller)) refuse("Unauthorized");
                if (!isDeepStrictEqual(args.compatibility, this.#compatibility)) refuse("Incompatible");
                this.#accepted.add(token);
                value = { role: this.#role, capabilities: this.#capabilities, compatibility: this.#compatibility };
            } else {
                if (!this.#accepted.has(token)) refuse("Unauthorized");
                if (caller === "provisioner" && op !== "Capabilities") refuse("Unauthorized");
                value = op === "Capabilities" ? this.#capabilities : this.#dispatch({ token, id, op, args });
            }
            return this.#verifyResponse({ ...response, ok: true, value });
        } catch (error) {
            if (!(error instanceof Refusal)) throw error;
            return this.#verifyResponse({ ...response, ok: false, error: {
                code: error.code, message: error.message, retryable: ["LeaseBusy", "NotReady", "Timeout"].includes(error.code)
            } });
        }
    }

    #allowedCaller(caller) {
        return this.#role === "host" ? ["script", "provisioner"].includes(caller) : caller === "host";
    }

    #verifyResponse(response) {
        if (!this.#check("Response", response)) throw Error(`Invalid fixture response for ${response.op}`);
        return clone(response);
    }
}

export class NativePeer {
    #players;
    #sessions = new Map();
    #ended = new Map();
    #events = [];
    #next = 0;
    #generation = new Map();
    #shutdown = false;
    #check;

    constructor(players, check) {
        this.#players = new Map(players.map(player => [player.entityId, clone(player)]));
        this.#check = check;
    }

    get playerCount() { return this.#players.size; }

    dispatch = ({ token, op, args }) => {
        if (op === "PollEvents") {
            const records = this.#events.filter(record => record.token === token);
            const events = records.map(record => record.event).filter(event => event.sequence > args.after &&
                (!args.session || isDeepStrictEqual(event.value.session, args.session))).slice(0, args.limit ?? 128);
            return { events, next: events.at(-1)?.sequence ?? args.after };
        }
        if (op === "State") {
            const ended = this.#ended.get(args.session.sessionId);
            if (ended && isDeepStrictEqual(ended.state.session, args.session)) {
                if (ended.token !== token) refuse("Unauthorized");
                return ended.state;
            }
        }
        if (this.#shutdown) refuse("Shutdown");
        if (op === "Attach") return this.#attach(token, args);
        const entry = this.#entry(args.session);
        if (entry.token !== token) refuse("Unauthorized");
        switch (op) {
            case "State": return entry.state;
            case "AcquireLease": {
                if (!entry.state.alive) refuse("PlayerDead");
                if (entry.state.phase !== "ready") refuse("NotReady");
                if (entry.state.lease) refuse("LeaseBusy");
                entry.state.lease = { id: `lease-${++this.#next}`, owner: args.owner };
                this.#publish(entry);
                return entry.state.lease;
            }
            case "ReleaseLease": {
                if (!isDeepStrictEqual(entry.state.lease, args.lease)) refuse("LeaseLost");
                delete entry.state.lease;
                entry.inbound.length = 0;
                this.#publish(entry);
                return null;
            }
            case "Detach": return this.#end(entry, "detached");
            case "Observe": return {
                session: entry.state.session, observed: { monotonicMs: 50, tick: 1 }, sequence: this.#next++,
                facts: [{ fact: { source: "world", name: "dimension" }, value: entry.state.dimension }]
            };
            default: return refuse("UnsupportedCapability");
        }
    };

    bind(bind) {
        if (!this.#check("PacketBind", bind)) refuse("Malformed");
        const entry = this.#entry(bind.session);
        if (entry.packetToken !== bind.token) refuse("Unauthorized");
        entry.packetToken = undefined;
        entry.bound = true;
        entry.state.phase = "ready";
        this.#publish(entry);
    }

    receive(ingress, batch, mutatesPlayer) {
        if (!this.#check("PacketIngress", ingress) || batch[0] !== 2) refuse("Malformed");
        const entry = this.#entry(ingress.session);
        if (!entry.bound || entry.state.phase !== "ready" || !entry.state.alive) refuse("NotReady");
        if (mutatesPlayer && (entry.state.lease?.owner !== "virtual" || !isDeepStrictEqual(entry.state.lease, ingress.lease))) {
            refuse("LeaseLost");
        }
        entry.inbound.push(Buffer.from(batch));
        return entry.state.session.player.entityId;
    }

    drain(session) { return this.#entry(session).inbound.splice(0); }

    transition(session, phase, alive, dimension, runtimeId) {
        const entry = this.#entry(session);
        delete entry.state.lease;
        entry.inbound.length = 0;
        Object.assign(entry.state, { phase, alive, dimension, runtimeId });
        this.#publish(entry);
    }

    remove(session, reason) {
        const entry = this.#entry(session);
        this.#players.delete(session.player.entityId);
        this.#end(entry, reason);
    }

    shutdown() {
        this.#shutdown = true;
        for (const entry of this.#sessions.values()) this.#end(entry, "shutdown");
    }

    #attach(token, args) {
        const player = this.#players.get(args.entityId);
        if (!player) refuse("InvalidPlayer");
        if (this.#sessions.has(player.entityId)) refuse("AlreadyAttached");
        const generation = (this.#generation.get(player.entityId) ?? 0) + 1;
        this.#generation.set(player.entityId, generation);
        const session = { runId: args.runId, sessionId: `session-${++this.#next}`, generation, player };
        const state = { session, phase: "attaching", alive: true, dimension: "overworld",
            runtimeId: player.runtimeId, renderer: args.renderer ?? "hidden" };
        const packetToken = this.#next.toString(16).padStart(64, "0");
        const entry = { state, token, packetToken, bound: false, inbound: [] };
        this.#sessions.set(player.entityId, entry);
        this.#publish(entry);
        return { state, packets: { port: 12345, token: packetToken } };
    }

    #entry(session) {
        const entry = this.#sessions.get(session.player.entityId);
        if (!entry || !isDeepStrictEqual(entry.state.session, session)) refuse("StaleSession");
        return entry;
    }

    #end(entry, endReason) {
        delete entry.state.lease;
        entry.inbound.length = 0;
        Object.assign(entry.state, { phase: "ended", endReason });
        this.#sessions.delete(entry.state.session.player.entityId);
        this.#ended.set(entry.state.session.sessionId, entry);
        this.#publish(entry);
        return entry.state;
    }

    #publish(entry) {
        const event = { v: Version, kind: "event", event: "SessionChanged", sequence: this.#next++, value: clone(entry.state) };
        this.#events.push({ token: entry.token, event });
    }
}

export class MediaPeer {
    #frames;
    #pins = new Map();
    #next = 0;

    constructor(frames) { this.#frames = structuredClone(frames); }

    acquire(request) {
        const acquired = request.offsetsMs.map(offset => this.#frames.find(({ descriptor }) =>
            descriptor.frame.at.monotonicMs > request.receivedAtMs + offset));
        if (acquired.includes(undefined)) refuse("FrameUnavailable");
        return structuredClone(acquired);
    }

    pin(index, request) {
        if (index.status.kind === "disabled") refuse("LookBackDisabled");
        if (!isDeepStrictEqual(index.session, request.session) || index.status.epoch !== request.epoch) refuse("HistoryUnavailable");
        const first = index.frames.findIndex(({ frame }) => frame.at.monotonicMs >= request.interval.startMs &&
            frame.at.monotonicMs <= request.interval.endMs);
        if (first < 0) refuse("HistoryUnavailable");
        const decodeStart = index.frames.findLastIndex(({ keyframe }, index) => keyframe && index <= first);
        if (decodeStart < 0) refuse("HistoryUnavailable");
        const frames = index.frames.slice(decodeStart).filter(({ frame }) => frame.at.monotonicMs <= request.interval.endMs);
        const segments = index.segments.filter(({ id }) => frames.some(({ segmentId }) => segmentId === id));
        const pin = clone({ id: `pin-${++this.#next}`, request, frames, segments });
        this.#pins.set(pin.id, pin);
        return clone(pin);
    }

    read(pinId) { return clone(this.#pins.get(pinId) ?? null); }
    release(pinId) { this.#pins.delete(pinId); }
}

export class RendererPeer {
    #session;
    #state;
    #bindings = [];
    #held = new Map();
    #now;

    constructor(session, now) {
        this.#session = clone(session);
        this.#now = now;
    }

    get held() { return clone([...this.#held.values()].flat()); }

    dispatch = ({ op, args }) => {
        if (op === "PollEvents") return { events: [], next: args.after };
        if (!isDeepStrictEqual(args.session, this.#session)) refuse("StaleSession");
        if (op === "SyncSession") {
            if (args.phase !== "ready" || !isDeepStrictEqual(this.#state?.lease, args.lease)) this.#held.clear();
            this.#state = clone(args);
            return null;
        }
        if (this.#state?.phase !== "ready") refuse("NotReady");
        if (op === "SetBindings") {
            this.#bindings = clone(args.bindings);
            return null;
        }
        if (op === "GetBindings") return this.#bindings;
        if (op === "Observe") return { session: this.#session, observed: this.#now(), sequence: 1, facts: [] };
        if (op !== "DispatchInput") refuse("UnsupportedCapability");
        if (args.lease.owner !== "virtual" || !isDeepStrictEqual(this.#state.lease, args.lease)) refuse("LeaseLost");
        const { kind, input } = args.command;
        if (kind === "releaseAll") this.#held.clear();
        if (kind === "release") this.#held.delete(JSON.stringify(input));
        if (kind === "hold") {
            const resolved = input.kind === "action" ? this.#bindings.find(binding => binding.action === input.action)?.inputs : [input];
            this.#held.set(JSON.stringify(input), resolved ?? []);
        }
        return { applied: this.#now() };
    };
}
