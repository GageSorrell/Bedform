/**
 * Rebuilds the pinned upstream inventory for the approved Schema subset contract.
 *
 * @module @bedform/effect/Tool/SchemaManifest
 *
 * @file      SchemaManifest.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { SchemaModules, inventorySchema, readSchemaUpstream } from "../Test/SchemaInventory.mjs";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

/* Inventory callbacks preserve contextual types; records follow declaration order. */
/* eslint-disable @typescript-eslint/typedef, sort-keys, @stylistic/max-len */

const Omitted = /Effect|Promise|Exit|^Middleware$|^middleware|^catch(?:Decoding|Encoding)|^Optic$|^to(?:Representation|CodecIso|Iso|Differ|EncoderXml|CodecStringTree)|^overrideToCodecIso$|^StringTree$|^Cause(?:Reason|Iso)?$|^CauseReasonIso$|^EncodedGraph$|^Graph|^DateTime|^TimeZone|^dateTime|^timeZone|URL|FormData|^File$|^fromFormData$|^fromURLSearchParams$|^urlFromString$|^decodeFormData$|^encodeFormData$|^decodeURLSearchParams$|^encodeURLSearchParams$|^collectBracketPathEntries$|^splitKeyValue$|^joinKeyValue$|^makeTreeRecord$|^unknownToStringTree$|^isStringTree$/;
const Network = /^(?:Mac|Ip|Ipv|Inet|UnixPath|SocketAddress|DomainName|ScopedIpv6|Host|Port$|Dns|Cookie|Cookies|RecordFromCookies|Headers|UrlParams|JsonFromUrlParamsField|RecordFromUrlParams)/;
const OmittedHooks = new Set([
    "representation", "arbitrary", "arbitraryConstraint", "toArbitrary", "toCode", "toCodecArbitrary",
    "toCodecStringTree", "toCodecIso", "toIso", "toDiffer", "toEncoderXml", "concurrency",
    "middlewareDecoding", "middlewareEncoding", "makeEffect", "ToArbitrary"
]);
const ResultConstructors = new Set([
    "transformEffect", "transformOptionalEffect", "checkEffect", "TransformEffect", "TransformOptionalEffect"
]);
const Adaptations: Readonly<Record<string, string>> = Object.freeze({
    declareConstructor: "The decoder factory returns Result<T, SchemaIssue.Issue> synchronously; resolved parameter codecs require no services.",
    withConstructorDefault: "Accept lazy () => Result<T, SchemaIssue.Issue>; invoke only during construction when missing or undefined.",
    withDecodingDefaultKey: "Accept lazy () => Result<S[Encoded], SchemaError>; preserve optional-key behavior and omission strategy; services are never.",
    withDecodingDefaultTypeKey: "Accept lazy () => Result<S[Type], SchemaError>; preserve optional-key behavior and omission strategy; services are never.",
    withDecodingDefault: "Accept lazy () => Result<S[Encoded], SchemaError>; preserve missing/undefined behavior; services are never.",
    withDecodingDefaultType: "Accept lazy () => Result<S[Type], SchemaError>; preserve missing/undefined behavior; services are never.",
    withDefault: "Accept a lazy Result callback and invoke only when the getter default is needed.",
    transformEffect: "Rename to transformResult; callbacks return Result<Value, SchemaIssue.Issue> synchronously; unexpected exceptions propagate.",
    transformOptionalEffect: "Rename to transformOptionalResult; callbacks receive/return Option inside Result; unexpected exceptions propagate.",
    checkEffect: "Rename to checkResult; preserve callback failure type never and normalize successful FilterOutput into validation issues.",
    TransformEffect: "Rename to TransformResult; synchronous Result transform with service requirements constrained to never.",
    TransformOptionalEffect: "Rename to TransformOptionalResult; synchronous optional Result transform with services constrained to never.",
    toStandardSchemaV1: "Validate synchronously; schema mismatches become standard issue paths; exceptions become standard failure messages.",
    toStandardJSONSchemaV1: "Provide local-reference input/output generation for draft-2020-12 and draft-07, coexisting with validation.",
    toJsonSchemaDocument: "Retain recursive local-reference Draft 2020-12 generation; reject external/resource references needing URI resolution.",
    toDocumentDraft07: "Retain Draft-07 conversion for local-reference documents; reject external references/resource identifiers needing URI resolution.",
    SchemaError: "Reuse ported Data.TaggedError; retain SchemaIssue.Issue in the issue field.",
    Class: "Retain Data-backed construction, extension and protocols; remove makeEffect.",
    TaggedClass: "Retain Data-backed tagged construction, extension and protocols; remove makeEffect.",
    Error: "Reuse ported Data error machinery and inherited failure/annotation protocols; remove makeEffect.",
    TaggedError: "Reuse ported Data tagged error machinery and inherited protocols; remove makeEffect.",
    run: "Return Result directly, preserving SchemaIssue.Issue failures, missing/unchanged markers and unexpected exceptions.",
    Context: "Store constructorDefault as a lazy Result callback, never an Effect value.",
    ParseOptions: "Remove concurrency; preserve errors, excess properties, disabled checks and input reporting.",
    Getter: "Retain pure tagged getters; replace Effect variants with Result variants; constrain services to never.",
    Transformation: "Retain pure bidirectional getters; fallible callbacks use Result and service channels are never.",
    Parser: "Return Result<unknown, SchemaIssue.Issue> synchronously; no executor or compiler registry.",
    Compiler: "Compile retained AST nodes to synchronous Result parsers with lazy recursion caching."
    , Declaration: "Decoder factories return synchronous Result values; preserve type-parameter codecs and construction semantics."
    , Link: "Retain pure bidirectional Transformation only; remove the runtime Middleware union member."
    , Encoding: "Retain sequential pure transformation links; remove runtime Middleware types."
});

const Sources: Record<string, string> = {};
const Modules: Record<string, ReadonlyArray<CompatibilityEntry>> = {};

/**
 * The classification attached to one inventoried upstream path.
 *
 * @category Types
 * @since 1.0.0
 */
interface CompatibilityEntry
{
    readonly name: string;
    readonly kind: "export" | "member";
    readonly status: "retained" | "adapted" | "omitted";
    readonly reason: string;
    readonly localName?: string;
}

for (const module of SchemaModules)
{
    const Source = readSchemaUpstream(module);
    Sources[module] = createHash("sha256").update(Source).digest("hex");
    Modules[module] = inventorySchema(Source).map((entry): CompatibilityEntry =>
    {
        const Parts = entry.name.split(".");
        const Top = Parts[0];
        const Leaf = Parts.at(-1)!;
        const Forbidden = Omitted.test(Top) || Network.test(Top) || Parts.some((part) => OmittedHooks.has(part));
        let status: CompatibilityEntry["status"] = "retained";
        let reason = "Preserve the pinned upstream pure API, representation and behavior.";
        let localName: string | undefined;
        if (Forbidden)
        {
            status = "omitted";
            reason = Network.test(Top) ? "Platform/network schemas are excluded." :
                "Requires excluded runtime, host/platform, representation, optics, differs or compiler capabilities; see SCHEMA.md.";
        }

        if (module === "JsonSchema" &&
            ![ "JsonSchema", "Dialect", "Type", "Definitions", "Document", "toDocumentDraft07" ].includes(Top))
        {
            status = "omitted";
            reason = "Schema importing, external resource resolution, other dialects and general reference tooling are excluded.";
        }

        if (Object.hasOwn(Adaptations, Top) && (!Forbidden || ResultConstructors.has(Top)))
        {
            status = "adapted";
            reason = Adaptations[Top];
        }

        if (Parts.length > 1 && OmittedHooks.has(Leaf))
        {
            status = "omitted";
            reason = "Unsupported methods and annotation hooks must be absent from runtime and declarations.";
        }

        if (status !== "omitted" && [ "DecodingServices", "EncodingServices" ].includes(Leaf))
        {
            status = "adapted";
            reason = "Constrain service channels to never; reject service-bearing schemas.";
        }

        if (module === "Schema" && status !== "omitted" &&
            /^(?:Bottom|Top$|Constraint|Schema$|Codec$|Decoder$|Encoder$|revealCodec$|revealBottom$)/.test(Top))
        {
            status = "adapted";
            reason = "Preserve inference and schema views; remove makeEffect and constrain service channels to never.";
        }

        if (ResultConstructors.has(Top))
        {
            localName = entry.name.replace(Top, Top.replace("Effect", "Result"));
        }

        if (module === "SchemaAST" && [ "FINITE_PATTERN", "STRING_PATTERN" ].includes(Top))
        {
            status = "adapted";
            reason = "Use PascalCase for exported constants per repository convention; preserve the pattern text.";
            localName = entry.name.replace(Top, Top === "FINITE_PATTERN" ? "FinitePattern" : "StringPattern");
        }

        return { ...entry,
            status,
            reason,
            ...(localName ? { localName } : {}) };
    });
}

writeFileSync(new URL("../SchemaCompatibility.json", import.meta.url), JSON.stringify({
    upstream: "effect@4.0.5",
    package: "@bedform/effect@1.0.0-alpha.1",
    epic: "MineCraft-isg.15",
    purpose: "Approved surface contract; implementation status and acceptance evidence live in Beads.",
    additions: {
        SchemaGetter: [ "transformResult", "transformOptionalResult", "checkResult" ],
        SchemaTransformation: [ "transformResult", "transformOptionalResult" ]
    },
    sources: Sources,
    modules: Modules
}, undefined, 2) + "\n");
