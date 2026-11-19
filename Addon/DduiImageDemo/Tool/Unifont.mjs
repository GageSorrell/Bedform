/**
 * GNU Unifont's plane 1 glyphs, the base of the Symbols for Legacy Computing
 * Supplement glyphs. Downloads unifont_upper-<version>.hex.gz and the
 * release's OFL-1.1.txt from unifoundry.com into dist/unifont when missing.
 * Unifont is dual-licensed under the SIL Open Font License 1.1 and the GNU
 * GPL 2+ with the font embedding exception; the demo uses it under the OFL,
 * so glyph pages derived from it carry `UnifontNotice` and the OFL text.
 *
 * @module @sorrell/ddui-image-demo/Tool/Unifont
 *
 * @file      Unifont.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const Root = fileURLToPath(new URL("../", import.meta.url));
const Cache = path.join(Root, "dist/unifont");

/**
 * The Unifont release used.
 *
 * @category Constant
 * @since 1.1.49
 */
export const UnifontVersion = "18.0.01";

/**
 * Unifont's copyright notice, from the release's font/Makefile.
 *
 * @category Constant
 * @since 1.1.49
 */
export const UnifontNotice = "Copyright (C) 1998-2026 Roman Czyborra, Paul Hardy, Qianqian Fang, Andrew Miller, " +
    "Johnnie Weaver, David Corbett, Ælla Chiana Moskopp, Rebecca Bettencourt, Minseo Lee, Ho-Seok Ee, et al.";

/** Downloads a URL to a file with curl, unless the file exists. */
function Download(Url, File)
{
    if (existsSync(File)) return;
    mkdirSync(path.dirname(File), { recursive: true });
    execFileSync("curl", [ "-sSLf", "--max-time", "600", "-o", File, Url ]);
}

/**
 * Returns plane 1 of Unifont as a map from code point to glyph rows, each 16
 * rows of 8 or 16 booleans, true for ink.
 *
 * @category Tool
 * @since 1.1.49
 */
export function UnifontPlane1()
{
    const Archive = path.join(Cache, `unifont_upper-${UnifontVersion}.hex.gz`);
    Download(`https://unifoundry.com/pub/unifont/unifont-${UnifontVersion}/font-builds/unifont_upper-${UnifontVersion}.hex.gz`,
        Archive);
    const Glyphs = new Map();
    for (const Line of gunzipSync(readFileSync(Archive)).toString("ascii").split(/\r?\n/u))
    {
        if (!Line) continue;
        const [ Code, Bits ] = Line.split(":");
        const Width = Bits.length / 4;
        Glyphs.set(parseInt(Code, 16), Array.from({ length: 16 }, (_, Row) =>
        {
            const Value = parseInt(Bits.slice(Row * Width / 4, (Row + 1) * Width / 4), 16);
            return [ ...Array(Width).keys() ].map((X) => (Value >> (Width - 1 - X) & 1) === 1);
        }));
    }

    return Glyphs;
}

/**
 * The text of the SIL Open Font License 1.1 as Unifont ships it.
 *
 * @category Tool
 * @since 1.1.49
 */
export function UnifontLicenseText()
{
    const File = path.join(Cache, `OFL-1.1-${UnifontVersion}.txt`);
    if (!existsSync(File))
    {
        // The OFL text lives in the source release; take it from the archive without unpacking the rest.
        const Tarball = path.join(Cache, "download", `unifont-${UnifontVersion}.tar.gz`);
        Download(`https://unifoundry.com/pub/unifont/unifont-${UnifontVersion}/unifont-${UnifontVersion}.tar.gz`, Tarball);
        // A relative name, because GNU tar reads "e:" in a Windows path as a remote host.
        writeFileSync(File, execFileSync("tar", [ "-xzOf", path.basename(Tarball), `unifont-${UnifontVersion}/OFL-1.1.txt` ],
            { cwd: path.dirname(Tarball) }));
    }

    return readFileSync(File, "utf8");
}
