/**
 * Consumer inference and nominal boundaries for the Schema data dependencies.
 *
 * @module @bedform/effect/Test/SchemaDependencies.types
 *
 * @file      SchemaDependencies.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BigDecimal from "@bedform/effect/BigDecimal";
import * as ByteSize from "@bedform/effect/ByteSize";
import * as Chunk from "@bedform/effect/Chunk";
import * as Duration from "@bedform/effect/Duration";
import * as HashMap from "@bedform/effect/HashMap";
import * as HashSet from "@bedform/effect/HashSet";
import type * as NonEmptyIterable from "@bedform/effect/NonEmptyIterable";
import * as Redacted from "@bedform/effect/Redacted";
import * as Result from "@bedform/effect/Result";

const NonEmpty: Chunk.NonEmptyChunk<number> = Chunk.make(1, 2);
const Iterable: NonEmptyIterable.NonEmptyIterable<number> = NonEmpty;
const Values: Array<number> = Chunk.toArray(Chunk.map(NonEmpty, (value: number): number => value * 2));
const Mapping = HashMap.make([ "key", 42 ]);
const Key: HashMap.HashMap.Key<typeof Mapping> = "key";
const Value: HashMap.HashMap.Value<typeof Mapping> = 42;
const Set: HashSet.HashSet<number> = HashSet.make(1, 2);
const Secret: Redacted.Redacted<number> = Redacted.make(42);
const Decimal: BigDecimal.BigDecimal = BigDecimal.fromBigInt(123n);
const Time: Duration.Duration = Duration.seconds(1);
const Size: ByteSize.ByteSize = ByteSize.bytes(1n);
const Success: Result.Result<number, string> = Result.succeed(Redacted.value(Secret));

// @ts-expect-error An ordinary iterable lacks the nonempty brand.
const Empty: NonEmptyIterable.NonEmptyIterable<number> = [];
// @ts-expect-error ByteSize retains its nominal brand.
const Unbranded: ByteSize.ByteSize = 1n;
// @ts-expect-error HashMap preserves the key type.
HashMap.get(Mapping, 1);
// @ts-expect-error Redacted retains the wrapped value type.
const Wrong: string = Redacted.value(Secret);

void [ Iterable, Values, Key, Value, Set, Secret, Decimal, Time, Size, Success, Empty, Unbranded, Wrong ];
