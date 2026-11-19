/**
 * Public name configuration, readonly vocabulary and string return declarations.
 *
 * @module bedform/Test/Name.types
 *
 * @file      Name.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Direct from "bedform/Utility/Name";
import { Name } from "bedform/Utility";
import { Utility } from "bedform";

const Config: Direct.Config = { Dictionary: [ "stone", "creeper" ] as const,
    NumWords: 2,
    Separator: "_" };
const Generated: string = Name.Make(Config);
const Default: string = Direct.Make();
const Root: string = Utility.Name.Make({});
const Dictionary: ReadonlyArray<string> = Name.Dictionary;
const Fast: string = Direct.MakeFast(Config);
const FastDefault: string = Utility.Name.MakeFast();
const DictionaryFast: ReadonlyArray<string> = Name.DictionaryFast;

// @ts-expect-error The constructor has been renamed to Make.
Name.make();
// @ts-expect-error The fast dictionary cannot be mutated.
Name.DictionaryFast.push("custom");
// @ts-expect-error Both constructors use the same typed configuration.
Name.MakeFast({ NumWords: "3" });

// @ts-expect-error The exported dictionary cannot be mutated.
Name.Dictionary.push("custom");
// @ts-expect-error Words are strings.
Name.Make({ Dictionary: [ 1 ] });
// @ts-expect-error Word counts are numeric.
Name.Make({ NumWords: "3" });
// @ts-expect-error Separators are strings.
Name.Make({ Separator: 1 });

void [ Generated, Default, Root, Dictionary, Fast, FastDefault, DictionaryFast ];
