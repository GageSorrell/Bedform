/**
 * Checks native and value-based dropdown overloads and generic choice inference.
 *
 * @module bedform/Test/CustomForm.types
 *
 * @file      CustomForm.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as HashMap from "@bedform/effect/HashMap";
import { CustomForm, ObservableValue } from "../Source/DDUI/CustomForm.js";
import { ObservableNumber, ObservableString } from "@minecraft/server-ui";
import type { Text } from "../Source/DDUI/Utility.js";

declare const Form: CustomForm;
const Texts: ReadonlyArray<Text> = [ "First", { rawtext: [ { text: "Second" } ] } ];
Form.dropdown("Text", new ObservableValue<Text>(Texts[0]), Texts);
Form.dropdown("String", new ObservableString("First"), [ "First", "Second" ]);
Form.dropdown("Native", new ObservableNumber(0), [ { label: "First",
    value: 0 } ]);
const Values: ReadonlyMap<Text, Date> = new Map([ [ "Today", new Date() ] ]);
Form.dropdown("Map", new ObservableValue(new Date()), Values);
Form.dropdown("HashMap", new ObservableValue(new Date()), HashMap.fromIterable(Values));
// @ts-expect-error The observable must accept the map's value type.
Form.dropdown("Wrong map", new ObservableValue(1), Values);
// @ts-expect-error Text choices bind text values, not numeric indices.
Form.dropdown("Wrong text", new ObservableNumber(0), Texts);
