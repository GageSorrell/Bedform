import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as net from "node:net";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { setTimeout } from "node:timers/promises";

function unpackVaruint(bytes, index) {
    let value = 0;
    for (let offset = 0; offset < 5 && index + offset < bytes.length; offset++) {
        const byte = bytes[index + offset];
        value += (byte & 127) * 128 ** offset;
        if ((byte & 128) === 0) return [value, index + offset + 1];
    }
    throw Error("Incomplete variable-length integer");
}

function varuint(value) {
    const bytes = [];
    while (value > 127) {
        bytes.push((value & 127) | 128);
        value >>>= 7;
    }
    return Buffer.from([...bytes, value]);
}

function length(value) {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32BE(value);
    return bytes;
}

function packetEntry(packet) {
    return Buffer.concat([varuint(packet.length), packet]);
}

export async function serveFixture(directory, publication, identity, pack = undefined) {
    await fs.mkdir(publication, { recursive: true });
    const server = net.createServer();
    const sockets = new Set();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    await fs.writeFile(path.join(publication, "session.addr"), "127.0.0.1:" + server.address().port + "\n", {flag:"wx"});
    server.on("connection", socket => {
        if (sockets.size) {
            socket.destroy();
            return;
        }
        sockets.add(socket);
        socket.setNoDelay(true);
        let inbound = Buffer.alloc(0);
        let connect = false;
        let nextIn = 0;
        let outboundOffset = 0;
        let handoff = false;
        let reading = false;
        let ended = false;
        const startup = [];
        const inputFile = path.join(directory, "out.bin");
        function send(payload) {
            socket.write(Buffer.concat([length(payload.length), payload]));
        }
        async function drainOutbound() {
            if (!connect || reading || socket.writableLength > 1024 * 1024) return;
            reading = true;
            try {
                const bytes = await fs.readFile(inputFile);
                while (!socket.destroyed && outboundOffset + 4 <= bytes.length) {
                    const size = bytes.readUInt32BE(outboundOffset);
                    if (size === 0 || size > 4 * 1024 * 1024) throw Error("Invalid native packet size");
                    const end = outboundOffset + 4 + size;
                    if (end > bytes.length) break;
                    const packet = bytes.subarray(outboundOffset + 4, end);
                    outboundOffset = end;
                    if (handoff) {
                        send(Buffer.concat([Buffer.from([2]), packetEntry(packet)]));
                    } else {
                        startup.push(packetEntry(packet));
                        if ((unpackVaruint(packet, 0)[0] & 1023) === 11) {
                            identity.uuid = await fs.readFile(path.join(directory,"uuid"),"utf8");
                            const meta = Buffer.from(JSON.stringify({
                                identity, client_cache:false, packs_required:!!pack,
                                packs: pack ? [pack.metadata] : []
                            }));
                            send(Buffer.concat([Buffer.from([3]), length(meta.length), meta, ...startup]));
                            if (pack) send(Buffer.concat([Buffer.from([4]), length(0), pack.archive]));
                            handoff = true;
                            console.log("BEDFORM_CINNABAR_RELAY_HANDOFF", identity.display_name);
                        }
                    }
                }
                if (!ended && await fs.stat(path.join(directory,"ended")).then(()=>true,error=>error.code==="ENOENT"?false:Promise.reject(error))) {
                    ended = true;
                    console.log("BEDFORM_CINNABAR_RELAY_END", identity.display_name);
                    socket.end();
                }
            } catch (error) {
                if (error.code !== "ENOENT") socket.destroy(error);
            } finally {
                reading = false;
            }
        }
        socket.on("data", bytes => {
            try {
                inbound = Buffer.concat([inbound, bytes]);
                while (inbound.length >= 4) {
                    const size = inbound.readUInt32BE(0);
                    if (size === 0 || size > 4 * 1024 * 1024) throw Error("Invalid renderer frame size");
                    if (inbound.length < size + 4) break;
                    const kind = inbound[4];
                    const payload = inbound.subarray(5, size + 4);
                    inbound = inbound.subarray(size + 4);
                    if (kind === 1 && !connect) {
                        JSON.parse(payload.toString());
                        connect = true;
                        void drainOutbound();
                        continue;
                    }
                    if (kind !== 2 || !handoff) throw Error("Invalid renderer frame order");
                    let offset = 0;
                    while (offset < payload.length) {
                        const [packetLength, next] = unpackVaruint(payload, offset);
                        const end = next + packetLength;
                        if (end > payload.length || packetLength === 0) throw Error("Invalid renderer packet size");
                        const packet = payload.subarray(next, end);
                        offset = end;
                        const packetId = unpackVaruint(packet, 0)[0] & 1023;
                        if (packetId !== 144 && packetId !== 175) continue;
                        const dest = path.join(directory, (nextIn++) + ".in");
                        fs.writeFile(dest + ".tmp", packet, {flag:"wx"})
                            .then(() => fs.rename(dest + ".tmp", dest))
                            .catch(error => socket.destroy(error));
                    }
                }
            } catch (error) {
                socket.destroy(error);
            }
        });
        const timer = setInterval(() => void drainOutbound(), 25);
        socket.on("error", error => console.error("BEDFORM_CINNABAR_RELAY_ERROR", error.message));
        socket.on("close", () => {
            clearInterval(timer);
            sockets.delete(socket);
        });
    });
    return () => { for (const socket of sockets) socket.destroy(); server.close(); };
}

export async function exerciseRenderer(directory, publication, standalone) {
    let endpoint;
    for (let attempt = 0; attempt < 100 && !endpoint; attempt++) {
        try {
            endpoint = JSON.parse(await fs.readFile(path.join(publication,"control.json"),"utf8"));
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
            await setTimeout(300);
        }
    }
    if (!endpoint) throw Error("Renderer control endpoint was not published");
    const socket = net.connect(endpoint.port,"127.0.0.1");
    const incoming = createInterface({input:socket})[Symbol.asyncIterator]();
    let id = 0;
    try {
        await once(socket,"connect");
        const request = async (cmd, payload = {}) => {
            socket.write(JSON.stringify({token:endpoint.token, id:++id, cmd, ...payload}) + "\n");
            const response = await incoming.next();
            if (response.done) throw Error("Renderer control stream ended");
            const reply = JSON.parse(response.value);
            if (reply.id !== id || reply.ok === false || reply.error) throw Error(JSON.stringify(reply));
            return reply;
        };
        console.log("BEDFORM_CINNABAR_RENDERER",await request("wait_for",{condition:"in_world",timeout_ms:25000}));
        console.log("BEDFORM_CINNABAR_RENDERER",await request("wait_for",{condition:{chunks_loaded:{radius:0}},timeout_ms:24000}));
        console.log("BEDFORM_CINNABAR_RENDERER",await request("screenshot",{path:path.join(publication,"frame.png")}));
        console.log("BEDFORM_CINNABAR_INPUT_BEFORE",await request("state"));
        await request("input",{hold:["KeyW"],look:{yaw:45,pitch:0}});
        await setTimeout(1250);
        await request("input",{release_all:true});
        console.log("BEDFORM_CINNABAR_INPUT_AFTER",await request("state"));
        if(standalone){
            await request("disconnect");
            await fs.writeFile(path.join(directory,"detach"),"",{flag:"wx"});
            await request("quit");
        }
    } finally {
        socket.destroy();
    }
}

