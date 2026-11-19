import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { topLevelTags } from "../../../Script/level-dat.mts";

// Preserve all unrelated level.dat fields; beta APIs use the gametest experiment flag.
const File = process.argv[2];
if (!File) throw new Error("Pass the stopped demo world's level.dat path.");
const Seed = Buffer.from([10, 0, 0, 0, 4, 0, 0, 0, 10, 0, 0, 0]);
const Bytes = existsSync(File) ? readFileSync(File) : Seed;
const Existing = topLevelTags(Bytes).find((Tag) => Tag.name === "experiments");
const Name = Buffer.from("experiments");
const Header = Buffer.alloc(3 + Name.length);
Header[0] = 10;
Header.writeUInt16LE(Name.length, 1);
Name.copy(Header, 3);
const Flags = ["gametest", "experiments_ever_used", "saved_with_toggled_experiments"];
const Tags = Flags.map((Flag) =>
{
    const Name = Buffer.from(Flag);
    const Tag = Buffer.alloc(4 + Name.length);
    Tag[0] = 1;
    Tag.writeUInt16LE(Name.length, 1);
    Name.copy(Tag, 3);
    Tag[Tag.length - 1] = 1;
    return Tag;
});
let Payload = Buffer.alloc(0);
if (Existing)
{
    // Retain existing experiment flags, updating the three required byte tags in place.
    Payload = Buffer.from(Bytes.subarray(Existing.start + Header.length, Existing.end - 1));
    for (let Index = Flags.length - 1; Index >= 0; Index--)
    {
        const Offset = Payload.indexOf(Tags[Index].subarray(0, -1));
        if (Offset >= 0) { Payload[Offset + Tags[Index].length - 1] = 1; Tags.splice(Index, 1); }
    }
}
const Compound = Buffer.concat([Header, Payload, ...Tags, Buffer.from([0])]);
const Start = Existing?.start ?? Bytes.length - 1;
const End = Existing?.end ?? Start;
const Result = Buffer.concat([Bytes.subarray(0, Start), Compound, Bytes.subarray(End)]);
Result.writeUInt32LE(Result.length - 8, 4);
topLevelTags(Result);
writeFileSync(File, Result);
console.log(`Enabled beta APIs in ${File}`);
