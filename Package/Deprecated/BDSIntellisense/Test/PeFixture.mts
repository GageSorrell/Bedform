/**
 * Builds minimal Portable Executables whose resource trees mirror `bedrock_server.exe`.
 *
 * The real tree has the levels type, name and language, with the language entry pointing to the
 * data.  The fixture puts an icon resource before the version resource, so lookups must select
 * by type rather than take the first entry.
 *
 * @module bds-intellisense/Test/PeFixture
 *
 * @file      PeFixture.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * What to put in a fixture executable.
 *
 * @category Tests
 * @since 1.0.0
 */
export interface PeFixtureOptions
{
    readonly FileVersion: readonly [ number, number, number, number ];
    /** Whether to include the version resource; without it, only the icon resource remains. */
    readonly IncludeVersion: boolean;
    readonly ProductVersion: readonly [ number, number, number, number ];
    /** Whether to write a 32-bit optional header instead of a 64-bit one. */
    readonly Pe32: boolean;
}

/** Where the resource section lies in the file and in memory. */
const Resource = Object.freeze({
    FileOffset: 0x02_00,
    Size: 0x02_00,
    VirtualAddress: 0x10_00
} as const);

/**
 * Builds the bytes of a fixture executable.
 *
 * @category Tests
 * @since 1.0.0
 */
export function BuildPe(options: PeFixtureOptions): Uint8Array
{
    const bytes: Uint8Array = new Uint8Array(Resource.FileOffset + Resource.Size);
    const view: DataView = new DataView(bytes.buffer);
    const u16: (offset: number, value: number) => void = (offset: number, value: number) =>
        view.setUint16(offset, value, true);

    const u32: (offset: number, value: number) => void = (offset: number, value: number) =>
        view.setUint32(offset, value, true);

    // DOS header, then the PE signature and COFF header at 0x40.
    u16(0, 0x5A_4D);
    u32(0x3C, 0x40);
    u32(0x40, 0x00_00_45_50);
    u16(0x44, options.Pe32 ? 0x01_4C : 0x86_64);
    u16(0x46, 1);
    const optionalSize: number = options.Pe32 ? 224 : 240;
    u16(0x54, optionalSize);

    // Optional header with sixteen data directories; the third is the resource table.
    const optional: number = 0x58;
    const countOffset: number = options.Pe32 ? 92 : 108;
    u16(optional, options.Pe32 ? 0x01_0B : 0x02_0B);
    u32(optional + countOffset, 16);
    u32(optional + countOffset + 4 + 2 * 8, Resource.VirtualAddress);
    u32(optional + countOffset + 4 + 2 * 8 + 4, Resource.Size);

    // One section, `.rsrc`.
    const section: number = optional + optionalSize;
    bytes.set(new TextEncoder().encode(".rsrc"), section);
    u32(section + 8, Resource.Size);
    u32(section + 12, Resource.VirtualAddress);
    u32(section + 16, Resource.Size);
    u32(section + 20, Resource.FileOffset);

    const base: number = Resource.FileOffset;
    const directory: (offset: number, entries: ReadonlyArray<readonly [ number, number ]>) => void =
        (offset: number, entries: ReadonlyArray<readonly [ number, number ]>) =>
        {
            u16(base + offset + 14, entries.length);
            entries.forEach(([ name, target ]: readonly [ number, number ], index: number) =>
            {
                u32(base + offset + 16 + index * 8, name);
                u32(base + offset + 20 + index * 8, target);
            });
        };

    const subdirectory: number = 0x80_00_00_00;
    directory(0x00, options.IncludeVersion
        ? [ [ 3, subdirectory | 0x20 ], [ 16, subdirectory | 0x50 ] ]
        : [ [ 3, subdirectory | 0x20 ] ]);

    directory(0x20, [ [ 1, subdirectory | 0x38 ] ]);
    directory(0x38, [ [ 0x04_09, 0x80 ] ]);
    directory(0x50, [ [ 1, subdirectory | 0x68 ] ]);
    directory(0x68, [ [ 0x04_09, 0x90 ] ]);

    // Data entries for an icon of sixteen bytes and the version information.
    u32(base + 0x80, Resource.VirtualAddress + 0xA0);
    u32(base + 0x84, 16);
    u32(base + 0x90, Resource.VirtualAddress + 0xB0);
    u32(base + 0x94, 92);

    // VS_VERSIONINFO: a header, the UTF-16 key, padding to four bytes, then VS_FIXEDFILEINFO.
    const info: number = base + 0xB0;
    u16(info, 92);
    u16(info + 2, 52);
    [ ..."VS_VERSION_INFO" ].forEach((character: string, index: number) =>
        u16(info + 6 + index * 2, character.charCodeAt(0)));

    const fixed: number = info + 40;
    const [ fileMajor, fileMinor, fileBuild, fileRevision ] = options.FileVersion;
    const [ productMajor, productMinor, productBuild, productRevision ] = options.ProductVersion;
    u32(fixed, 0xFE_EF_04_BD);
    u32(fixed + 4, 0x00_01_00_00);
    u32(fixed + 8, fileMajor * 0x1_00_00 + fileMinor);
    u32(fixed + 12, fileBuild * 0x1_00_00 + fileRevision);
    u32(fixed + 16, productMajor * 0x1_00_00 + productMinor);
    u32(fixed + 20, productBuild * 0x1_00_00 + productRevision);

    return bytes;
}

/**
 * A 64-bit fixture for BDS 1.26.63.1 whose product version differs from its file version.
 *
 * @category Tests
 * @since 1.0.0
 */
export const BdsPe: Uint8Array = BuildPe({
    FileVersion: [ 1, 26, 63, 1 ],
    IncludeVersion: true,
    Pe32: false,
    ProductVersion: [ 1, 26, 0, 0 ]
});
