// Automation-host-side v1 transport fixture for the compiled native component.
import { createConnection } from "node:net";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { Limits, Version } from "../../Contract/Model.mjs";

const require = createRequire(import.meta.resolve("eslint/package.json"));
const Ajv = require("ajv");
const schema = JSON.parse(readFileSync(new URL("../../Contract/automation-v1.schema.json", import.meta.url)));
const validator = new Ajv().addSchema(schema, "v1");
const check = (definition, data) => assert.ok(validator.validate(`v1#/definitions/${definition}`, data), validator.errorsText());

export async function eventually(observe, accept, label, timeoutMs = 12000) {
    const end = performance.now() + timeoutMs;
    let value;
    while (performance.now() < end) {
        value = await observe();
        if (accept(value)) return value;
        await delay(50);
    }
    throw Error(`Timed out waiting for ${label}. Last result ${JSON.stringify(value)}`);
}

const word = n => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(n); return bytes; };
const floats = (...values) => { const bytes = Buffer.alloc(4 * values.length); values.forEach((v, i) => bytes.writeFloatLE(v, 4 * i)); return bytes; };
const object = v => Buffer.from(JSON.stringify(v));
const frame = v => Buffer.concat([word(v.length), v]);

function varuint(n) {
    const bytes = [];
    while (n > 127) { bytes.push((n & 127) | 128); n >>>= 7; }
    return Buffer.from([...bytes, n]);
}

function reader(data) {
    let offset = 0;
    return {
        varint() {
            let value = 0n;
            for (let shift = 0n; shift < 70n && offset < data.length; shift += 7n) {
                const next = BigInt(data[offset++]);
                value |= (next & 127n) << shift;
                if (next < 128n) return value;
            }
            throw Error("Malformed native packet varint");
        },
        take(size) {
            assert.ok(size > 0 && offset + size <= data.length);
            const out = data.subarray(offset, offset + size);
            offset += size;
            return out;
        },
        get done() { return offset === data.length; }
    };
}

export class HostPeer {
    #port;
    #token;
    #next = 0;
    requests = [];

    constructor(port, token) { this.#port = port; this.#token = token; }

    async request(op, args, options = {}) {
        const request = { v: options.version ?? Version, kind: "request", op, id: `req-${++this.#next}`, args };
        if (options.timeoutMs) request.timeoutMs = options.timeoutMs;
        if (request.v === Version) check("Request", request);
        const result = await fetch(`http://127.0.0.1:${this.#port}${Limits.ControlPath}`, { method: "POST",
            headers: { authorization: `Bearer ${options.token ?? this.#token}`, "content-type": "application/json" },
            body: JSON.stringify(request), signal: AbortSignal.timeout(3000) });
        assert.equal(result.status, 200);
        const response = await result.json();
        check("Response", response);
        assert.equal(response.id, request.id);
        this.requests.push({ op, ok: response.ok, ...(response.error && { code: response.error.code }) });
        return response;
    }

    async call(op, args) {
        const result = await this.request(op, args);
        assert.ok(result.ok, `${op}: ${JSON.stringify(result.error)}`);
        return result.value;
    }

    async error(op, args, code, options) {
        assert.equal((await this.request(op, args, options)).error?.code, code);
    }
}

export class PacketPeer {
    #socket;
    #inbound = Buffer.alloc(0);
    #tick = 0;
    session;
    packets = [];
    packBytes = [];
    handoff;
    disconnect;
    error;
    ended = false;

    static async bind({ state, packets }, token = packets.token) {
        const peer = new PacketPeer();
        peer.session = state.session;
        const socket = peer.#socket = createConnection(packets.port, "127.0.0.1");
        socket.on("error", error => { peer.error = error.message; });
        socket.on("close", () => { peer.ended = true; });
        socket.on("data", bytes => {
            try { peer.receive(bytes); }
            catch (error) { peer.error = error.message; socket.destroy(); }
        });
        await once(socket, "connect");
        const message = { v: Version, session: peer.session, token };
        check("PacketBind", message);
        socket.write(frame(object(message)));
        return peer;
    }

    receive(bytes) {
        this.#inbound = Buffer.concat([this.#inbound, bytes]);
        while (this.#inbound.length >= 4) {
            const len = this.#inbound.readUInt32BE();
            assert.ok(len > 0 && len <= 64 * 1024 * 1024);
            if (this.#inbound.length < len + 4) return;
            const payload = this.#inbound.subarray(4, len + 4);
            this.#inbound = this.#inbound.subarray(len + 4);
            const kind = payload[0];
            if (kind === 3) {
                assert.equal(this.handoff, undefined);
                const size = payload.readUInt32BE(1);
                this.handoff = JSON.parse(payload.subarray(5, 5 + size));
                this.#packets(payload.subarray(5 + size));
                assert.equal(this.packets.at(-1)?.id, 11);
            } else if (kind === 4) {
                assert.ok(this.handoff);
                this.packBytes.push({ index: payload.readUInt32BE(1), bytes: payload.subarray(5) });
            } else if (kind === 2) {
                assert.ok(this.handoff);
                this.#packets(payload.subarray(1));
            } else if (kind === 6) {
                this.disconnect = JSON.parse(payload.subarray(1)).message;
            } else throw Error(`Unknown native frame ${kind}`);
        }
    }

    #packets(bytes) {
        const batch = reader(bytes);
        while (!batch.done) {
            const data = batch.take(Number(batch.varint()));
            if (this.packets.length < 8192) this.packets.push({ id: Number(reader(data).varint() & 1023n), data });
        }
    }

    startGameIdentity() {
        const start = reader(this.packets.find(packet => packet.id === 11).data);
        start.varint();
        const zigzag = start.varint();
        return { entityId: String((zigzag >> 1n) ^ -(zigzag & 1n)), runtimeId: String(start.varint()) };
    }

    input(lease, position, yaw, motion = 0) {
        const tick = ++this.#tick;
        const data = Buffer.concat([varuint(144), floats(0, yaw, position.x, position.y, position.z, 0, motion, yaw),
            Buffer.from([0, 1, 2, 0]), floats(0, yaw), varuint(tick), floats(0, 0, 0), Buffer.alloc(5),
            floats(0, motion, 0, 0, 1, 0, motion)]);
        const metadata = object({ v: Version, session: this.session, ...(lease && { lease }) });
        this.#socket.write(frame(Buffer.concat([word(metadata.length), metadata, Buffer.from([2]), varuint(data.length), data])));
    }

    close() { this.#socket.destroy(); }
}
