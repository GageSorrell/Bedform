/**
 * Encodes inline colors and byte-safe visual lines shared by spatial layout and native presentation.
 *
 * @module bedform/Spatial/Internal/TextLines
 *
 * @file      TextLines.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Measurement from "../Measurement.js";
import type { Line, Run } from "../Layout.js";
import { Canvas } from "./TextMetrics.generated.js";
import type { TextProps } from "../ComponentTypes.js";
import { Tint } from "../../Canvas/Surface.js";

/**
 * Bedrock formatting colors, including its material colors and current blue.
 *
 * @category Constant
 * @since 1.0.0
 */
const Palette = Object.freeze({
    0: "#000000",
    1: "#0000AA",
    2: "#00AA00",
    3: "#00AAAA",
    4: "#AA0000",
    5: "#AA00AA",
    6: "#FFAA00",
    7: "#C5C5C5",
    8: "#545454",
    9: "#447FFF",
    a: "#55FF55",
    b: "#54FFFF",
    c: "#FF5555",
    d: "#FF55FF",
    e: "#FFFF55",
    f: "#FFFFFF",
    g: "#DDD605",
    h: "#E3D4D1",
    i: "#CECACA",
    j: "#443A3B",
    m: "#971607",
    n: "#B4684D",
    p: "#DEB12D",
    q: "#47A036",
    s: "#2CBAA8",
    t: "#21497B",
    u: "#9A5CC6",
    v: "#EB7114"
});

/**
 * A transmitted visual line, retaining source offsets and the client's padded centering extent.
 *
 * @category Model
 * @since 1.0.0
 */
export interface PreparedLine extends Line {
    readonly Encoded: string;
    readonly PaddedWidth: number;
    readonly PrefixWidth: number;
}

/**
 * Resolves nested colors to the nearest Bedrock color; reset restores the exact outer native color.
 * Alpha cannot vary within a TextPrimitive and must match the outer color.
 *
 * @throws { Error } If inline alpha differs from the outer color.
 *
 * @category Encoding
 * @since 1.0.0
 */
function ColorCode(color: TextProps["Color"], base: TextProps["Color"]): string
{
    const value = Tint(color);
    const outer = Tint(base);
    if (value.alpha !== outer.alpha)
    {
        throw new Error("Nested Text alpha must match its outer Text.");
    }

    if (value.red === outer.red && value.green === outer.green && value.blue === outer.blue)
    {
        return "§r";
    }

    let best = "f";
    let distance = Infinity;
    for (const [ code, hex ] of Object.entries(Palette))
    {
        const candidate = Tint(hex);
        const next = (candidate.red - value.red) ** 2 + (candidate.green - value.green) ** 2 +
            (candidate.blue - value.blue) ** 2;
        if (next < distance)
        {
            best = code;
            distance = next;
        }
    }

    return `§${best}`;
}

/**
 * Encodes nested runs before wrapping. Colors are indivisible tokens, Unicode code points are never
 * split, and every final line includes its reset, font switch and EvenPad in the native byte budget.
 * Width-changing codes require an explicit Measure override. Font substitution is a separate stage.
 *
 * @throws { Error } If NUL, unsupported formatting or an unrepresentable token is encountered.
 *
 * @category Encoding
 * @since 1.0.0
 */
export function Prepare(value: string, runs: ReadonlyArray<Run>, props: TextProps,
    width?: number): ReadonlyArray<PreparedLine>
{
    if (value.includes("\u0000"))
    {
        throw new Error("Text cannot contain U+0000.");
    }

    const font = props.Font ?? "Mojangles";
    const measure = (text: string): number =>
    {
        const plain = text.replace(/§[0-9a-jm-np-v]/giu, "");
        const switchCharacter = String.fromCodePoint(Canvas.Switch);
        const switches = plain.split(switchCharacter).length - 1;
        const override = props.Measure?.(plain.replaceAll(switchCharacter, ""), font);
        if (override !== undefined)
        {
            if (!Number.isFinite(override) || override < 0)
            {
                throw new RangeError("Text Measure must return a finite nonnegative width.");
            }

            return override + switches * (Canvas.Advances.charCodeAt(Canvas.Switch - Canvas.First) - 48);
        }

        const visible = text.replace(/§./gu, "");
        const selected = font === "Mojangles" ? "Mojangles" : font === "Ten" ? "Ten" :
            Measurement.UsesLargeFont(text) ? "Legacy" : "Mojangles";
        return [ ...visible ].reduce((sum: number, character: string) =>
        {
            const code = character.codePointAt(0)!;
            const advance = Canvas.Advances.charCodeAt(code - Canvas.First) - 48;
            return sum + (Number.isNaN(advance) ? Measurement.GlyphWidth(code, selected) : advance);
        }, 0);
    };

    const options: Measurement.Options = { Override: measure };
    const prefix = font === "Mojangles" ? String.fromCodePoint(Canvas.Switch) : "";
    const prefixWidth = measure(prefix);
    const encode = (text: string): string =>
    {
        const body = prefix + text;
        return body + Measurement.EvenPad(body, options);
    };

    const lines: Array<PreparedLine> = [];
    let body = "";
    let source = "";
    let start = 0;
    let active = "§r";
    let runCode = "§r";
    const push = (): void =>
    {
        const encoded = encode(body);
        const lineWidth = measure(body);
        const remaining = Math.max(0, (width ?? lineWidth) - lineWidth);
        lines.push(Object.freeze({ Encoded: encoded,
            Length: source.length,
            PaddedWidth: measure(encoded),
            PrefixWidth: prefixWidth,
            Start: start,
            Value: source,
            Width: lineWidth,
            X: props.TextAlign === "center" ? remaining / 2 : props.TextAlign === "end" ? remaining : 0,
            Y: lines.length * ((font === "Legacy" ? 12 : 10) + (props.LineGap ?? 0)) }));
        start += source.length;
        source = "";
        body = active === "§r" ? "" : active;
    };

    let offset = 0;
    const tokens = value.match(/§.|[^]/gu) ?? [];
    for (const token of tokens)
    {
        const run = runs.find((entry: Run) => offset >= entry.Start && offset < entry.Start + entry.Length);
        const nextRun = ColorCode(run?.Color ?? props.Color, props.Color);
        const transition = nextRun !== runCode ? nextRun : "";
        runCode = nextRun;
        let nextActive = transition || active;

        if (token === "\n")
        {
            active = nextActive;
            push();
            start++;
            offset++;
            continue;
        }

        if (token.startsWith("§"))
        {
            const code = token.slice(1).toLowerCase();
            if (!(code in Palette) && code !== "r" && !(/[klo]/u.test(code) && props.Measure))
            {
                throw new Error(`Unsupported Text formatting ${token}.`);
            }

            nextActive = code in Palette || code === "r" ? token : nextActive + token;
        }

        let candidate = body + transition + token;
        const fits = (text: string): boolean =>
            Measurement.Utf8Bytes(encode(text)) <= Measurement.Limits.LineBytes;
        if (source && ((width !== undefined && measure(candidate) > width) || !fits(candidate)))
        {
            push();
            candidate = (transition || (active === "§r" ? "" : active)) + token;
        }

        if (!fits(candidate))
        {
            throw new Error("A Text token exceeds the native line byte budget.");
        }

        body = candidate;
        active = nextActive;
        source += token;
        offset += token.length;
    }

    push();
    return Object.freeze(lines);
}
