// An owned renderer-process fixture using the real session and developer-control framing.
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { once } from "node:events";
import { join } from "node:path";
import { createInterface } from "node:readline";

const [mode, , root] = process.argv.slice(2);
if (mode === "fail") process.exit(17);
if (mode === "stall") {
    setInterval(() => {}, 1000);
} else {
    const token = randomBytes(32).toString("hex");
    const packet = Buffer.from("0203900100", "hex");
    const word = number => { const out = Buffer.alloc(4); out.writeUInt32BE(number); return out; };
    const frame = bytes => Buffer.concat([word(bytes.length), bytes]);
    const [, port] = readFileSync(join(root, "session.addr"), "utf8").trim().split(":");
    const uninvited = createConnection(Number(port), "127.0.0.1");
    await once(uninvited, "connect");
    const refused = once(uninvited, "close");
    uninvited.end(frame(Buffer.from(token)));
    await refused;
    const socket = createConnection(Number(port), "127.0.0.1");
    await once(socket, "connect");
    socket.write(Buffer.concat([
        frame(Buffer.from(process.env.BEDFORM_CINNABAR_RELAY_TOKEN)),
        frame(Buffer.concat([Buffer.from([1]), Buffer.from(JSON.stringify({
            protocol: 2225, client_cache: false, client_data: {}
        }))]))
    ]));
    let buffer = Buffer.alloc(0);
    let handoff = false;
    let signal;
    const ready = new Promise(resolve => { signal = resolve; });
    socket.on("error", () => socket.destroy());
    socket.on("data", chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 4 && buffer.length >= buffer.readUInt32BE() + 4) {
            const size = buffer.readUInt32BE();
            const message = buffer.subarray(4, 4 + size);
            buffer = buffer.subarray(4 + size);
            if (message[0] === 3) {
                handoff = true;
                signal();
                socket.write(frame(packet));
            }
        }
    });
    const endpoint = process.env.CINNABAR_DEVELOPER_CONTROL;
    const transcript = join(root, "..", "transcript.jsonl");
    const write = event => appendFileSync(transcript, JSON.stringify(event) + "\n");
    write({ pid: process.pid, hidden: process.env.CINNABAR_HIDDEN_WINDOW, user: process.env.CINNABAR_USER_ROOT,
        credentialDistinct: token !== process.env.BEDFORM_CINNABAR_RELAY_TOKEN });
    const held = new Set();
    const control = createServer(client => {
        client.on("error", () => client.destroy());
        const lines = createInterface({ input: client });
        lines.on("line", async line => {
            const { id, cmd, token: offered, ...fields } = JSON.parse(line);
            if (offered !== token) { client.end(JSON.stringify({ id, error: "Unauthorized" }) + "\n"); return; }
            if (cmd === "wait_for") await ready;
            if (cmd === "input") {
                if (fields.release_all) held.clear();
                for (const key of fields.release ?? []) held.delete(key);
                for (const key of fields.hold ?? []) held.add(key);
                if (held.size || fields.look || fields.text) socket.write(frame(packet));
            }
            write({ cmd, fields, held: [...held] });
            client.write(JSON.stringify({ id, ok: true, result: { handoff } }) + "\n", () => {
                if (cmd === "quit") process.exit(0);
            });
        });
    }).listen(0, "127.0.0.1");
    await once(control, "listening");
    writeFileSync(endpoint, JSON.stringify({ port: control.address().port, pid: process.pid, token }));
    console.log("renderer stdout stays in its session log");
    console.error("renderer stderr stays in its session log");
}
