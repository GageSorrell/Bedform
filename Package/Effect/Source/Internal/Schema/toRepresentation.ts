/**
 * Converts schema ASTs to their serializable representations, one at a time or
 * several with shared references. Adapted from Effect 4.0.5 for synchronous
 * parsing.
 *
 * @module @bedform/effect/Internal/Schema/toRepresentation
 *
 * @file      toRepresentation.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import * as Arr from "../../Array.js";
import type * as Schema from "../../Schema.js";
import * as SchemaAST from "../../SchemaAST.js";
import type * as SchemaRepresentation from "./representation.js";
import * as InternalRecord from "../record.js";
import * as InternalAnnotations from "./annotations.js";
const defaultReferencePolicy: SchemaRepresentation.ReferencePolicy = ({ identifier }) => identifier;
type CheckRepresentationAnnotation = SchemaRepresentation.CheckRepresentationAnnotation<SchemaRepresentation.Representation>;
interface ReferenceCandidate
{
    readonly ast: SchemaAST.AST;
    readonly identifier: string | undefined;
    readonly fallback: string | undefined;
    occurrences: number;
    isRecursive: boolean;
    reference: string | undefined;
}

/**
 * Supports annotations field during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function annotationsField<A>(annotations: A | undefined): {
    readonly annotations: A;
} | undefined
{
    return annotations === undefined ? undefined : { annotations };
}

/**
 * Supports to representation during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function toRepresentation(ast: SchemaAST.AST, options?: SchemaRepresentation.ToRepresentationOptions): SchemaRepresentation.Document
{
    const { references, representations } = toRepresentations([ ast ], options);
    return { representation: representations[0],
        references };
}

/**
 * Supports to representations during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function toRepresentations(asts: readonly [
    SchemaAST.AST,
    ...Array<SchemaAST.AST>
], options?: SchemaRepresentation.ToRepresentationOptions): SchemaRepresentation.MultiDocument
{
    const references: Record<string, SchemaRepresentation.Representation> = {};
    const referenceOwners = new Map<string, ReferenceCandidate>();
    const buildingReferences = new Set<string>();
    const candidates = new Map<SchemaAST.AST, Map<string | undefined, ReferenceCandidate>>();
    const visitingCandidates = new Set<ReferenceCandidate>();
    for (const ast of asts)
    {visit(ast);}

    const referencePolicy = options?.referencePolicy ?? defaultReferencePolicy;
    for (const candidatesByIdentifier of candidates.values())
    {
        for (const candidate of candidatesByIdentifier.values())
        {
            const requestedReference = referencePolicy({
                ast: candidate.ast,
                occurrences: candidate.occurrences,
                identifier: candidate.identifier
            });
            if (requestedReference !== undefined)
            {
                const separator = requestedReference === candidate.identifier ||
                    !requestedReference.endsWith("_")
                    ? "_"
                    : "";
                candidate.reference = getReference(requestedReference, candidate, separator);
            }
            else if (candidate.isRecursive)
            {
                candidate.reference = getReference(`${candidate.ast._tag}_`, candidate, "");
            }
        }
    }

    const representations = Arr.map(asts, (ast) => recur(ast));
    return { representations,
        references };

    /**
     * Supports get reference during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function getReference(prefix: string, owner: ReferenceCandidate, separator = "_"): string
    {
        let candidate = prefix;
        let suffix = 0;
        while (referenceOwners.has(candidate))
        {
            if (referenceOwners.get(candidate) === owner)
            {return candidate;}

            candidate = `${prefix}${separator}${++suffix}`;
        }

        referenceOwners.set(candidate, owner);
        return candidate;
    }

    /**
     * Supports annotate reference during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function annotateReference(ast: SchemaAST.AST, candidate: ReferenceCandidate, reference: string): SchemaAST.AST
    {
        const fallback = candidate.fallback;
        if (fallback !== undefined)
        {
            return InternalAnnotations.resolveIdentifierFallback(ast) === fallback
                ? ast
                : SchemaAST.annotate(ast, {
                    [InternalAnnotations.IdentifierFallbackKey]: fallback
                });
        }

        return reference === candidate.identifier
            ? ast
            : SchemaAST.annotate(ast, { identifier: reference });
    }

    /**
     * Supports make reference during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function makeReference(reference: string, ast: SchemaAST.AST): SchemaRepresentation.Reference
    {
        if (!Object.hasOwn(references, reference) && !buildingReferences.has(reference))
        {
            buildingReferences.add(reference);
            const representation = on(ast);
            buildingReferences.delete(reference);
            InternalRecord.assignProperty(references, reference, representation);
        }

        return { _tag: "Reference",
            $ref: reference };
    }

    /**
     * Supports get candidate during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function getCandidate(input: SchemaAST.AST): ReferenceCandidate
    {
        const ast = SchemaAST.getLastEncoding(input);
        const owner = SchemaAST.getContextOwner(ast);
        let identifier = InternalAnnotations.resolveIdentifier(ast);
        const fallback = identifier === undefined
            ? (ast !== input ? InternalAnnotations.resolveIdentifier(input) : undefined) ??
                InternalAnnotations.resolveIdentifierFallback(ast)
            : undefined;
        if (fallback !== undefined)
        {identifier = `${fallback}Encoded`;}

        let candidatesByIdentifier = candidates.get(owner);
        if (candidatesByIdentifier === undefined)
        {
            candidatesByIdentifier = new Map();
            candidates.set(owner, candidatesByIdentifier);
        }

        let candidate = candidatesByIdentifier.get(identifier);
        if (candidate === undefined)
        {
            candidate = {
                ast: owner,
                identifier,
                fallback,
                occurrences: 0,
                isRecursive: false,
                reference: undefined
            };
            candidatesByIdentifier.set(identifier, candidate);
        }

        return candidate;
    }

    /**
     * Supports visit during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function visit(input: SchemaAST.AST): void
    {
        const candidate = getCandidate(input);
        const ast = candidate.ast;
        candidate.occurrences++;
        if (visitingCandidates.has(candidate))
        {
            candidate.isRecursive = true;
            return;
        }

        if (candidate.occurrences > 1)
        {return;}

        visitingCandidates.add(candidate);
        visitChecks(ast.checks);
        switch (ast._tag)
        {
            case "Declaration":
            case "Arrays":
            case "Objects":
            case "Union":
                ast.recur((child) =>
                {
                    visit(child);
                    return child;
                });
                break;
            case "TemplateLiteral":
                ast.parts.forEach(visit);
                break;
            case "Suspend":
                visit(ast.thunk());
                break;
        }

        visitingCandidates.delete(candidate);
    }

    /**
     * Supports visit checks during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function visitChecks(checks: SchemaAST.Checks | undefined): void
    {
        checks?.forEach((check) =>
        {
            (check.annotations?.["~representation"] as SchemaRepresentation.CheckRepresentationAnnotation<SchemaAST.AST> | undefined)?.schemas?.forEach((schema) => visit(SchemaAST.toType(schema)));
            if (check._tag === "FilterGroup")
            {visitChecks(check.checks);}
        });
    }

    /**
     * Supports recur during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function recur(input: SchemaAST.AST): SchemaRepresentation.Representation
    {
        const candidate = getCandidate(input);
        const ast = candidate.ast;
        const reference = candidate.reference;
        if (reference !== undefined)
        {
            const annotated = candidate.identifier === undefined ? ast : annotateReference(ast, candidate, reference);
            return makeReference(reference, annotated);
        }

        return on(ast);
    }

    /**
     * Supports on during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function on(ast: SchemaAST.AST): SchemaRepresentation.Representation
    {
        const checks = fromChecks(ast.checks);
        switch (ast._tag)
        {
            case "Declaration":
                return {
                    _tag: "Declaration",
                    typeParameters: ast.typeParameters.map((ast) => recur(ast)),
                    checks,
                    ...fromDeclarationAnnotations(ast.annotations)
                };
            case "Null":
            case "Undefined":
            case "Void":
            case "Never":
            case "Unknown":
            case "Any":
            case "String":
            case "Boolean":
            case "Number":
            case "BigInt":
            case "Symbol":
            case "ObjectKeyword":
                return {
                    _tag: ast._tag,
                    checks,
                    ...annotationsField(ast.annotations)
                };
            case "Literal":
                return {
                    _tag: "Literal",
                    literal: ast.literal,
                    checks,
                    ...annotationsField(ast.annotations)
                };
            case "UniqueSymbol":
                return {
                    _tag: "UniqueSymbol",
                    symbol: ast.symbol,
                    checks,
                    ...annotationsField(ast.annotations)
                };
            case "Enum":
                return {
                    _tag: "Enum",
                    enums: ast.enums,
                    checks,
                    ...annotationsField(ast.annotations)
                };
            case "TemplateLiteral":
                return {
                    _tag: "TemplateLiteral",
                    parts: ast.parts.map((ast) => recur(ast)),
                    checks,
                    ...annotationsField(ast.annotations)
                };
            case "Arrays":
                return {
                    _tag: "Arrays",
                    elements: ast.elements.map((element) =>
                    {
                        const projected = SchemaAST.getLastEncoding(element);
                        const annotations = projected.context?.annotations;
                        return {
                            isOptional: SchemaAST.isOptional(projected),
                            type: recur(element),
                            ...annotationsField(annotations)
                        };
                    }),
                    rest: ast.rest.map((ast) => recur(ast)),
                    checks,
                    ...annotationsField(ast.annotations)
                };
            case "Objects":
                return {
                    _tag: "Objects",
                    propertySignatures: ast.propertySignatures.map((property) =>
                    {
                        const projected = SchemaAST.getLastEncoding(property.type);
                        const annotations = projected.context?.annotations;
                        return {
                            name: property.name,
                            type: recur(property.type),
                            isOptional: SchemaAST.isOptional(projected),
                            isMutable: SchemaAST.isMutable(projected),
                            ...annotationsField(annotations)
                        };
                    }),
                    indexSignatures: ast.indexSignatures.map((index) => ({
                        parameter: recur(index.parameter),
                        type: recur(index.type)
                    })),
                    checks,
                    ...annotationsField(ast.annotations)
                };
            case "Union":
                return {
                    _tag: "Union",
                    types: ast.types.map((ast) => recur(ast)),
                    ...(ast.options === undefined ? {} : { options: ast.options }),
                    checks,
                    ...annotationsField(ast.annotations)
                };
            case "Suspend":
                return {
                    _tag: "Suspend",
                    checks: [],
                    thunk: recur(ast.thunk()),
                    ...annotationsField(ast.annotations)
                };
        }
    }

    /**
     * Supports from checks during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function fromChecks(checks: readonly [
        SchemaAST.Check<any>,
        ...Array<SchemaAST.Check<any>>
    ] | undefined): Array<SchemaRepresentation.Check>
    {
        return checks?.map(fromCheck) ?? [];
    }

    /**
     * Supports from check during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function fromCheck(check: SchemaAST.Check<any>): SchemaRepresentation.Check
    {
        switch (check._tag)
        {
            case "Filter":
                return {
                    _tag: "Filter",
                    aborted: check.aborted,
                    ...fromCheckAnnotations(check.annotations)
                };
            case "FilterGroup":
                return {
                    _tag: "FilterGroup",
                    checks: Arr.map(check.checks, fromCheck),
                    ...fromCheckAnnotations(check.annotations)
                };
        }
    }

    /**
     * Supports from declaration annotations during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function fromDeclarationAnnotations<A extends Schema.Annotations.Annotations & {
        readonly "~representation"?: SchemaRepresentation.RepresentationAnnotation | undefined;
    }>(annotations: A | undefined): {
        readonly representation?: SchemaRepresentation.RepresentationAnnotation | undefined;
        readonly annotations?: Omit<A, "~representation"> | undefined;
    } | undefined
    {
        if (annotations === undefined)
        {return undefined;}

        const { ["~representation"]: representation, ...ordinary } = annotations;
        return {
            ...(representation === undefined ? undefined : { representation }),
            ...(Object.keys(ordinary).length === 0 ? undefined : { annotations: ordinary })
        };
    }

    /**
     * Supports from check annotations during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function fromCheckAnnotations<A extends Schema.Annotations.Annotations & {
        readonly "~representation"?: SchemaRepresentation.CheckRepresentationAnnotation<SchemaAST.AST> | undefined;
    }>(annotations: A | undefined): {
        readonly representation?: CheckRepresentationAnnotation | undefined;
        readonly annotations?: Omit<A, "~representation"> | undefined;
    } | undefined
    {
        if (annotations === undefined)
        {return undefined;}

        const { ["~representation"]: representation, ...ordinary } = annotations;
        const projected = representation === undefined
            ? undefined
            : representation.schemas === undefined
                ? representation as CheckRepresentationAnnotation
                : { ...representation,
                    schemas: representation.schemas.map((schema) => recur(SchemaAST.toType(schema))) };
        return {
            ...(projected === undefined ? undefined : { representation: projected }),
            ...(Object.keys(ordinary).length === 0 ? undefined : { annotations: ordinary })
        };
    }
}

