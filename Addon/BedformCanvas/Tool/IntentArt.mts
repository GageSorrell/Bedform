/**
 * Captures Mojang icon sources explicitly and reproducibly generates Intent artwork offline.
 *
 * @module bedform-canvas/Tool/IntentArt
 *
 * @file      IntentArt.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { FindClient, ReadArchive, ReadClient } from "../../../Package/Bedform/Tool/TextMetrics.mjs";
import { ParticleDefinition, ParticleVariants } from "./Particle.mts";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import path from "node:path";

const Root = fileURLToPath(new URL("../", import.meta.url));
const Input = "Assets/Intent/Input.json";
const Names = Object.freeze({ "arrow-down": 0x2193,
    "arrow-down-left": 0x2199,
    "arrow-down-right": 0x2198,
    "arrow-left": 0x2190,
    "arrow-right": 0x2192,
    "arrow-up": 0x2191,
    "arrow-up-left": 0x2196,
    "arrow-up-right": 0x2197,
    exclamatory: 0x21,
    interrogative: 0x3F } as const);

/**
 * Checked-in source images with reproducible client and file identities. RGBA is hexadecimal bytes.
 *
 * @category Model
 * @since 1.0.0
 */
interface Capture
{
    readonly Client: string;
    readonly Sources: Readonly<Record<string, string>>;
    readonly Images: Readonly<Record<string, Image>>;
}

/**
 * A raw image captured or drawn in source pixels.
 *
 * @category Model
 * @since 1.0.0
 */
interface Image
{
    readonly Width: number;
    readonly Height: number;
    readonly Rgba: string;
}

/**
 * Crops alpha-bearing pixels without resampling; transparent images retain one transparent pixel.
 *
 * @category Transforming
 * @since 1.0.0
 */
function Crop(image: PNG): PNG
{
    let x0 = image.width;
    let y0 = image.height;
    let x1 = 0;
    let y1 = 0;
    for (let y = 0; y < image.height; y++)
    {
        for (let x = 0; x < image.width; x++)
        {
            if (image.data[(y * image.width + x) * 4 + 3])
            {
                x0 = Math.min(x0, x);
                y0 = Math.min(y0, y);
                x1 = Math.max(x1, x + 1);
                y1 = Math.max(y1, y + 1);
            }
        }
    }

    const result = new PNG({ height: Math.max(1, y1 - y0),
        width: Math.max(1, x1 - x0) });
    if (x1 > x0)
    {
        PNG.bitblt(image, result, x0, y0, x1 - x0, y1 - y0, 0, 0);
    }

    return result;
}

/**
 * Captures fine Mojangles glyphs and vanilla HUD textures; ordinary generation never invokes this.
 *
 * @throws { Error } If the installed client or a source is absent.
 *
 * @category Tool
 * @since 1.0.0
 */
function CaptureInput(): void
{
    const client = FindClient();
    const fonts = ReadClient();
    if (!client || !fonts)
    {
        throw new Error("Install Minecraft for Windows before capturing Intent sources.");
    }

    const images: Record<string, Image> = {};
    const sources: Record<string, string> = {};
    const add = (name: string, png: PNG, source: string): void =>
    {
        const image = Crop(png);
        images[name] = { Height: image.height,
            Rgba: image.data.toString("hex"),
            Width: image.width };
        sources[name] = source;
    };

    for (const [ name, code ] of Object.entries(Names))
    {
        const page = `glyph_${(code >> 8).toString(16).toUpperCase().padStart(2, "0")}.png`;
        const sheet = PNG.sync.read(fonts.Archive.get(page)!);
        const size = sheet.width / 16;
        const cell = new PNG({ height: size,
            width: size });
        PNG.bitblt(sheet, cell, (code & 15) * size, ((code & 255) >> 4) * size, size, size, 0, 0);
        add(name, cell, `font.brarchive/${page} U+${code.toString(16).toUpperCase()}`);
    }

    const textures = ReadArchive(readFileSync(path.join(client.Location,
        "data/resource_packs/vanilla/__brarchive/textures/ui.brarchive")));
    for (const [ name, file ] of [ [ "affectionate", "heart.png" ], [ "hunger", "hunger_full.png" ] ])
    {
        add(name, PNG.sync.read(textures.get(file)!), `textures/ui.brarchive/${file}`);
    }

    mkdirSync(path.join(Root, "Assets/Intent"), { recursive: true });
    writeFileSync(path.join(Root, Input), JSON.stringify({ Client: fonts.Version,
        Images: images,
        Sources: sources }, null, 2) + "\n");
}

/**
 * Creates original pixel art from row strings; any non-dot is opaque in the supplied color.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Draw(rows: ReadonlyArray<string>, color: string = "4d4d4d"): PNG
{
    const image = new PNG({ height: rows.length,
        width: Math.max(...rows.map((row: string) => row.length)) });
    rows.forEach((row: string, y: number) => [ ...row ].forEach((pixel: string, x: number) =>
    {
        if (pixel !== ".")
        {
            image.data.set(Buffer.from(color + "ff", "hex"), (y * image.width + x) * 4);
        }
    }));
    return image;
}

/**
 * Composes pixel images side by side with a one-pixel gap.
 *
 * @category Combining
 * @since 1.0.0
 */
function Join(images: ReadonlyArray<PNG>): PNG
{
    const image = new PNG({ height: Math.max(...images.map((part: PNG) => part.height)),
        width: images.reduce((sum: number, part: PNG) => sum + part.width + 1, -1) });
    let x = 0;
    for (const part of images)
    {
        PNG.bitblt(part, image, 0, 0, part.width, part.height, x, image.height - part.height);
        x += part.width + 1;
    }

    return image;
}

/**
 * Generates textures, particles, typed descriptors and a preview entirely from checked-in inputs.
 *
 * @throws { Error } When a generated output is stale in check mode.
 *
 * @category Tool
 * @since 1.0.0
 */
export function Generate(check: boolean = false): void
{
    const input = JSON.parse(readFileSync(path.join(Root, Input), "utf8")) as Capture;
    const ten = JSON.parse(readFileSync(path.join(Root, "Assets/Glyph/Input/minecraft-ten.json"), "utf8")) as
        { Cells: Record<string, Array<string>> };
    const source = (name: string): PNG =>
    {
        const data = input.Images[name];
        const png = new PNG({ height: data.Height,
            width: data.Width });
        png.data.set(Buffer.from(data.Rgba, "hex"));
        return png;
    };

    const icons = new Map<string, Array<PNG>>();
    for (const name of Object.keys(Names))
    {
        const ink = source(name);
        const image = new PNG({ height: ink.height + 1,
            width: ink.width + 1 });
        for (const [ offset, color ] of [ [ 1, "222222ff" ], [ 0, "4d4d4dff" ] ] as const)
        {
            for (let y = 0; y < ink.height; y++)
            {
                for (let x = 0; x < ink.width; x++)
                {
                    if (ink.data[(y * ink.width + x) * 4 + 3])
                    {
                        image.data.set(Buffer.from(color, "hex"),
                            ((y + offset) * image.width + x + offset) * 4);
                    }
                }
            }
        }

        icons.set(name, [ image ]);
    }

    icons.set("exclamatory-interrogative", [ Join([ icons.get("exclamatory")![0],
        icons.get("interrogative")![0] ]) ]);
    icons.set("affectionate", [ source("affectionate") ]);
    icons.set("hunger", [ source("hunger") ]);
    icons.set("affirmative", [ Draw([ "......##", ".....##.", "#...##..", "##.##...", ".###....",
        "..#....." ],
    "378b36") ]);
    icons.set("negative", [ Draw([ "##....##", ".##..##.", "..####..", "...##...", "..####..",
        ".##..##.",
        "##....##" ], "bd3737") ]);
    icons.set("knowledgeable", [ Draw([ "..####..", ".#....#.", "#......#", "#......#", ".#....#.",
        "..####..",
        "..####..", "...##..." ], "d59e16") ]);
    icons.set("sos", [ Join([ "53", "4F", "53" ]
        .map((code: string) => Crop(Draw(ten.Cells[code])))) ]);
    icons.set("thinking", Array.from({ length: 3 }, (_: unknown, frame: number) =>
        Join([ 0, 1, 2 ].map((dot: number) => Draw([ "##", "##" ], dot === frame ? "4d4d4d" : "a0a0a0")))));
    const sleep = Draw([ "#####", "...#.", "..#..", ".#...", "#####" ]);
    icons.set("sleep", Array.from({ length: 6 }, (_: unknown, frame: number) =>
    {
        const image = new PNG({ height: 16,
            width: 16 });
        PNG.bitblt(sleep, image, 0, 0, 5, 5, 2 + frame, 10 - frame);
        return image;
    }));
    const descriptors: Record<string, unknown> = {};
    const write = (file: string, bytes: Uint8Array): void =>
    {
        const full = path.join(Root, file);
        if (check)
        {
            if (!readFileSync(full).equals(Buffer.from(bytes)))
            {
                throw new Error(`Stale Intent artwork: ${file}`);
            }
        }
        else
        {
            mkdirSync(path.dirname(full), { recursive: true });
            writeFileSync(full, bytes);
        }
    };

    let previewY = 0;
    const preview = new PNG({ height: icons.size * 32,
        width: 192 });
    for (const [ name, frames ] of icons)
    {
        const width = Math.max(...frames.map((image: PNG) => image.width));
        const height = Math.max(...frames.map((image: PNG) => image.height));
        const strip = new PNG({ height: height * frames.length,
            width });
        frames.forEach((image: PNG, frame: number) =>
        {
            PNG.bitblt(image, strip, 0, 0, image.width, image.height,
                Math.floor((width - image.width) / 2), height * frame);
            PNG.bitblt(image, preview, 0, 0, image.width, image.height, frame * 32, previewY);
        });
        previewY += 32;
        const texture = `textures/bedform_canvas/intent/${name}`;
        const particle = `bedform_canvas:intent_${name.replaceAll("-", "_")}`;
        write(`resource_packs/bedform_canvas/${texture}.png`, PNG.sync.write(strip));
        for (const variant of ParticleVariants)
        {
            const definition = JSON.parse(ParticleDefinition(particle, texture, width, variant.Oriented,
                width, variant.Depth));
            definition.particle_effect.components["minecraft:particle_appearance_billboard"].uv
                .texture_height = strip.height;
            write(`resource_packs/bedform_canvas/particles/intent_${name.replaceAll("-", "_")}` +
                `${variant.Suffix}.json`,
            Buffer.from(JSON.stringify(definition, null, 2) + "\n"));
        }

        descriptors[name] = { FrameCount: frames.length,
            FrameTicks: name === "thinking" ? 6 : name === "sleep" ? 4 : 1,
            Height: height,
            Id: `bedform_canvas:${name}`,
            Kind: "image",
            Particle: particle,
            Version: 1,
            Width: width };
    }

    write("resource_packs/bedform_canvas/textures/bedform_canvas/intent/NOTICE-Mojang.txt",
        Buffer.from(`Minecraft artwork notice

Fine Mojangles glyphs, health and hunger artwork derive from Minecraft for Windows ${input.Client}.
SOS reuses the Canvas rasterization of Mojang's minecraft-ten.ttf. Source identities are recorded
in Assets/Intent/Input.json and Assets/Glyph/Input/minecraft-ten.json. Minecraft is a trademark
of Mojang Synergies AB. These source fonts and textures are Mojang's, outside the MIT license.
`));
    const header = `/**
 * Built-in Intent image descriptors from offline artwork inputs captured from client ${input.Client}.
 *
 * This module is auto-generated by Tool/IntentArt.mts.
 *
 * @module bedform-canvas/Public/IntentArt.generated
 *
 * @file      IntentArt.generated.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable */

`;
    write("Public/IntentArt.generated.ts", Buffer.from(header +
        `export const BuiltinImages = ${JSON.stringify(descriptors, null, 4)} as const;\n`));
    if (!check)
    {
        mkdirSync(path.join(Root, "dist"), { recursive: true });
        writeFileSync(path.join(Root, "dist/intent-preview.png"), PNG.sync.write(preview));
    }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    if (process.argv.includes("--capture"))
    {
        CaptureInput();
    }

    Generate(process.argv.includes("--check"));
}
