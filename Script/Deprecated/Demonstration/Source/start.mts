/**
 * Foreground demonstration launcher with ordered readiness, console input and graceful shutdown.
 *
 * @file start.mts
 */

import { DemoFiles, type DemonstrationMetadata, assertStopped } from "./create.mts";
import { execFile, spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { open, readFile, rm, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { prepareWorld } from "./world.mts";
import { promisify } from "node:util";

/** An IPv4 candidate with adapter routing metadata. */
export interface AddressCandidate
{
    address: string;
    name: string;
    gateway: boolean;
    excluded?: boolean;
}

/** Prefer ordinary LAN interfaces, then private routed addresses; never select a tunnel by name. */
export function selectAddress(candidates: ReadonlyArray<AddressCandidate>): string
{
    const rank = (value: AddressCandidate): number =>
        (/^192\.168\./.test(value.address) ? 100 :
            /^(10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(value.address) ? 50 : 0) +
        (value.gateway ? 10 : 0);
    return candidates.filter((value) => !value.excluded &&
        !/vpn|tunnel|tailscale|wireguard|loopback|vethernet|zerotier/i.test(value.name) &&
        rank(value) >= 50).sort((a, b) => rank(b) - rank(a))[0]?.address ?? "127.0.0.1";
}

/** Detect current adapter addresses at launch rather than saving a stale address in metadata. */
async function address(): Promise<string>
{
    const candidates: Array<AddressCandidate> = [];
    if (process.platform === "win32")
    {
        const { stdout } = await promisify(execFile)("powershell.exe", [ "-NoProfile",
            "-NonInteractive", "-Command",
            "@(Get-CimInstance Win32_NetworkAdapterConfiguration | " +
                "Where-Object IPEnabled | Select-Object " +
                "Description,IPAddress,DefaultIPGateway) | ConvertTo-Json " +
                "-Depth 4 -Compress" ]);
        const adapters = JSON.parse(stdout.trim() || "[]");
        for (const adapter of [ adapters ].flat())
        {
            for (const ip of adapter.IPAddress ?? [])
            {
                if (/^\d+\.\d+\.\d+\.\d+$/.test(ip))
                {
                    candidates.push({ address: ip,
                        gateway: !!adapter.DefaultIPGateway?.length,
                        name: adapter.Description });
                }
            }
        }
    }
    else
    {
        for (const [ name, interfaces ] of Object.entries(networkInterfaces()))
        {
            for (const info of interfaces ?? [])
            {
                if (info.family === "IPv4" && !info.internal)
                {
                    candidates.push({ address: info.address,
                        gateway: false,
                        name });
                }
            }
        }
    }

    return selectAddress(candidates);
}

/** Line-oriented startup state, also usable with split output in host tests. */
export class Readiness
{
    private pending = "";
    private server = false;
    private marker = false;
    private telemetry = false;
    private telemetryClosed = false;
    private lastOutput = 0;
    private announced = false;
    private readonly required: string | undefined;

    /** Configure an optional literal setup marker. */
    constructor(marker?: string)
    {
        this.required = marker;
    }

    /** Decode complete lines without treating partial markers as successful setup. */
    feed(chunk: string, now: number): void
    {
        this.pending += chunk;
        this.lastOutput = now;
        const lines = this.pending.split(/\r?\n/);
        this.pending = lines.pop()!;
        for (const line of lines)
        {
            if (line.includes("Server started."))
            {
                this.server = true;
            }

            if (this.required && line.includes(this.required))
            {
                this.marker = true;
            }

            if (/telemetry/i.test(line))
            {
                this.telemetry = true;
                this.telemetryClosed = false;
            }
            else if (this.telemetry && /={8,}|-{8,}/.test(line))
            {
                this.telemetryClosed = true;
            }
        }
    }

    /** Announce only once, after both startup prerequisites and the final startup banner. */
    ready(now: number): boolean
    {
        if (this.announced || !this.server || this.required && !this.marker ||
            (this.telemetry ? !this.telemetryClosed : now - this.lastOutput < 500))
        {
            return false;
        }

        this.announced = true;
        return true;
    }
}

/** Optional smoke mode stops cleanly after readiness, saving the prepared demonstration world. */
export interface StartOptions
{
    server: string;
    address?: string;
    stopAfterReady?: boolean;
    startupTimeout?: number;
    signal?: AbortSignal;
    onOutput?: (chunk: string) => void;
}

/**
 * Run from the fixed executable path, preserving native output and forwarding console input.
 */
export async function startDemonstration(options: StartOptions): Promise<void>
{
    const server = path.resolve(options.server);
    const metadata: DemonstrationMetadata = JSON.parse(await readFile(path.join(server,
        DemoFiles.Metadata), "utf8"));
    if (metadata.version !== 1 || !/^[a-z0-9-]{1,40}$/.test(metadata.world))
    {
        throw new Error("Unsupported demonstration metadata");
    }

    await assertStopped(server);
    const lan = options.address ?? await address();
    const properties = await readFile(path.join(server, "server.properties"), "utf8");
    const port = Number(/^server-port=(\d+)\s*$/m.exec(properties)?.[1]);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
    {
        throw new Error("Invalid configured IPv4 server port");
    }

    if (process.platform === "win32")
    {
        const receipt = fileURLToPath(new URL("../../../../dist/test-firewall-setup.json", import.meta.url));
        const configured = await readFile(receipt, "utf8").then(
            (raw) => JSON.parse(raw.replace(/^\uFEFF/u, "")), () => undefined
        );
        if (!configured?.rules?.some((rule: { executable: string }) =>
            rule.executable.toLowerCase() === path.join(server, "bedrock_server.exe").toLowerCase()))
        {
            console.log("Firewall rule is not recorded for this demonstration. Run " +
                "npm run firewall:configure from the repository root if " +
                "needed for LAN connections.");
        }
    }

    const lockPath = path.join(server, DemoFiles.Lock);
    const lock = await open(lockPath, "wx");
    await lock.writeFile(String(process.pid));
    await lock.close();
    const level = path.join(server, "worlds", metadata.world, "level.dat");
    try
    {
        await writeFile(level, prepareWorld(await readFile(level)));
    }
    catch (error)
    {
        await rm(lockPath, { force: true });
        throw error;
    }

    const child = spawn(path.join(server, "bedrock_server.exe"), [], {
        cwd: server,
        stdio: [ "pipe", "pipe", "pipe" ],
        windowsHide: true
    });
    const readiness = new Readiness(metadata.readyMarker);
    let announced = false;
    let failure: Error | undefined;
    let forced: ReturnType<typeof setTimeout> | undefined;
    const stop = (): void =>
    {
        child.stdin.write("stop\n");
        forced ??= setTimeout(() => child.kill(), 15000);
    };

    options.signal?.addEventListener("abort", stop, { once: true });
    if (options.signal?.aborted)
    {
        stop();
    }

    const deadline = setTimeout(() =>
    {
        failure = new Error("Demonstration startup exceeded its 120-second deadline or " +
            "did not emit its setup marker");
        stop();
    }, options.startupTimeout ?? 120000);
    const interval = setInterval(() =>
    {
        if (!failure && readiness.ready(Date.now()))
        {
            announced = true;
            clearTimeout(deadline);
            const description = metadata.description.replace(/\.+$/, "");
            console.log(`DEMONSTRATION READY — ${metadata.name}: ${description}. ` +
                "The demonstration is ready for you to connect.");
            console.log("In Minecraft Bedrock, choose Play → Servers → Add Server; " +
                `address ${lan}, port ${port}. ` +
                "Accept the supplied resource packs." +
                (lan === "127.0.0.1" ? " Loopback works only on this server machine." : ""));
            if (metadata.instructions)
            {
                console.log(`Instructions: ${metadata.instructions}`);
            }

            if (options.stopAfterReady)
            {
                stop();
            }
        }
    }, 100);
    const input = (chunk: Buffer): void =>
    {
        child.stdin.write(chunk);
    };

    process.stdin.on("data", input);
    process.on("SIGINT", stop);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdin.on("error", () => undefined);
    child.stdout.on("data", (chunk: string) =>
    {
        process.stdout.write(chunk);
        options.onOutput?.(chunk);
        readiness.feed(chunk,
            Date.now());
    });
    child.stderr.on("data", (chunk: string) =>
    {
        process.stderr.write(chunk);
        options.onOutput?.(chunk);
        readiness.feed(chunk,
            Date.now());
    });
    try
    {
        const code = await new Promise<number | null>((resolve, reject) =>
        {
            child.once("error", reject);
            child.once("exit", resolve);
        });
        if (failure || code !== 0 || !announced && !options.signal?.aborted)
        {
            const stage = announced ? "after" : "before";
            throw failure ?? new Error(`Demonstration exited ${code} ${stage} readiness`);
        }
    }
    finally
    {
        clearTimeout(deadline);
        clearTimeout(forced);
        clearInterval(interval);
        process.stdin.off("data", input);
        process.stdin.pause();
        process.off("SIGINT", stop);
        options.signal?.removeEventListener("abort", stop);
        await rm(lockPath, { force: true });
    }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    const index = process.argv.indexOf("--server");
    if (index < 0 || !process.argv[index + 1])
    {
        throw new Error("Supply --server <directory>");
    }

    const override = process.argv.indexOf("--address");
    await startDemonstration({ address: override < 0 ? undefined : process.argv[override + 1],
        server: process.argv[index + 1],
        stopAfterReady: process.argv.includes("--stop-after-ready") });
}
