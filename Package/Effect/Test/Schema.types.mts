/**
 * Consumer inference and negative boundaries for the synchronous Schema subset.
 *
 * @module @bedform/effect/Test/Schema.types
 *
 * @file      Schema.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Fixtures preserve contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/no-unused-vars, sort-imports, sort-keys */

import * as S from "../Source/Schema.js";
import * as G from "../Source/SchemaGetter.js";
import * as R from "../Source/Result.js";

const Settings = S.Struct({
    name: S.String,
    age: S.optionalKey(S.NumberFromString),
    id: S.String.pipe(S.brand("PlayerId"))
});
const Decoded: { readonly name: string;
    readonly age?: number;
    readonly id: string } =
    S.decodeSync(Settings)({ name: "A",
        age: "2",
        id: "id" });
const Encoded: { readonly name: string;
    readonly age?: string;
    readonly id: string } =
    S.encodeSync(Settings)(Settings.make({ name: "A",
        id: "id" as typeof Settings.Type.id }));
// @ts-expect-error Optional transformed fields retain their decoded type.
const WrongAge: NonNullable<typeof Settings.Type.age> = "2";
// @ts-expect-error Branding rejects unbranded values.
const WrongId: typeof Settings.Type.id = "id";
// @ts-expect-error Struct outputs remain readonly.
Decoded.name = "B";

class Player extends S.Class<Player>("Player")({ name: S.String }) {}
const Value: Player = S.decodeUnknownSync(Player)({ name: "A" });
// @ts-expect-error Class constructor fields are checked.
new Player({ name: 1 });
// @ts-expect-error Effect adapters are omitted.
S.decodeEffect(S.String);
// @ts-expect-error Runtime makers are omitted.
Player.makeEffect({ name: "A" });
// @ts-expect-error Service-bearing schemas cannot be expressed by the subset.
type ServiceCodec = S.Codec<string, string, "service">;
// @ts-expect-error Getters cannot require services.
type ServiceGetter = G.Getter<number, string, "service">;
// @ts-expect-error Defaults must be lazy callbacks.
S.withDecodingDefault(R.succeed("A"));
// @ts-expect-error Constructor defaults report SchemaIssue rather than arbitrary errors.
S.withConstructorDefault(() => R.fail("invalid"));
const Getter: G.Getter<number, string> = G.transformResult((value: string) => R.succeed(Number(value)));

/**
 * Recursive outputs retain their own schema type.
 *
 * @category Types
 * @since 1.0.0
 */
interface Node { readonly name: string;
    readonly children: ReadonlyArray<Node>; }
const Recursive: S.Codec<Node> = S.suspend(() => S.Struct({ name: S.String,
    children: S.Array(Recursive) }));
