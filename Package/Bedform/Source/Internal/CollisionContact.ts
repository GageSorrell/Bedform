/**
 * Polyhedral contact clipping and exterior partition-face selection.
 *
 * @module bedform/Internal/CollisionContact
 *
 * @file      CollisionContact.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Contact records keep source and coordinate ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import type * as V from "../Vector3.js";
import * as G from "./CollisionGeometry.js";
import * as M from "./CollisionMath.js";
import type * as N from "./CollisionConvex.js";

/**
 * A pair of world-space surface points with a stable source feature identifier.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Contact
{
    readonly pointA: V.Vector3;
    readonly pointB: V.Vector3;
    readonly depth: number;
    readonly feature: string;
}

/**
 * Oriented contact patch prior to cross-cell merging.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Patch
{
    readonly normal: V.Vector3;
    readonly contacts: ReadonlyArray<Contact>;
}

/**
 * Tests the side half-spaces of a convex polygon.
 *
 * @category Internal
 * @since 1.0.0
 */
const inside = (face: G.Face, point: V.Coordinates, tolerance: number): boolean =>
{
    return face.points.every((p, i) => M.dot(M.cross(face.normal, M.sub(face.points[(i + 1) % face.points.length], p)), M.sub(point, p)) >=
        -tolerance * M.length(M.sub(face.points[(i + 1) % face.points.length], p)));
};

/**
 * Clips an incident polygon to every reference edge plane.
 *
 * @category Internal
 * @since 1.0.0
 */
const clip = (reference: G.Face, incident: ReadonlyArray<V.Vector3>, tolerance: number): ReadonlyArray<V.Vector3> =>
{
    let points = [ ...incident ];
    for (let edge = 0; edge < reference.points.length && points.length; edge++)
    {
        const Origin = reference.points[edge];
        const Inward = M.unit(M.cross(reference.normal, M.sub(reference.points[(edge + 1) % reference.points.length], Origin)));
        const Next: Array<V.Vector3> = [];
        points.forEach((p, i) =>
        {
            const Q = points[(i + 1) % points.length];
            const A = M.dot(Inward, M.sub(p, Origin));
            const B = M.dot(Inward, M.sub(Q, Origin));
            if (A >= -tolerance)
            {
                Next.push(p);
            }

            if ((A < -tolerance && B > tolerance) || (A > tolerance && B < -tolerance))
            {
                Next.push(M.add(p, M.scale(M.sub(Q, p), A / (A - B))));
            }
        });
        points = Next;
    }

    return points;
};

/**
 * Rejects witnesses on internal-only partition boundaries. An exterior edge shared
 * with an internal face remains a valid physical boundary.
 *
 * @category Internal
 * @since 1.0.0
 */
const internalOnly = (faces: ReadonlyArray<G.Face>, point: V.Coordinates, tolerance: number): boolean =>
{
    const On = faces.filter((f) => Math.abs(M.dot(f.normal, M.sub(point, f.points[0]))) <= tolerance * 8 && inside(f, point, tolerance * 8));
    return On.some((f) => f.internal) && !On.some((f) => !f.internal);
};

/**
 * Suppresses edge normals with a component toward an internal partition. The
 * neighboring cell supplies the genuine exterior patch instead of an artificial lip.
 *
 * @category Internal
 * @since 1.0.0
 */
const seamDirection = (faces: ReadonlyArray<G.Face>, point: V.Coordinates, normal: V.Coordinates, tolerance: number): boolean =>
{
    return faces.some((f) => f.internal && M.dot(normal, f.normal) > 1e-5 &&
        Math.abs(M.dot(f.normal, M.sub(point, f.points[0]))) <= tolerance * 8 && inside(f, point, tolerance * 8));
};

/**
 * Builds contact patches by clipping actual exterior faces, recovering exterior
 * contacts when a cell's shallow EPA axis points across an internal partition seam.
 *
 * @throws { G.Fault } An overlapping pair has no resolvable exterior contact.
 *
 * @category Internal
 * @since 1.0.0
 */
export const patch = (a: G.Placed, b: G.Placed, penetration: N.Penetration, tolerance: number): Patch =>
{
    const A = G.faces(a);
    const B = G.faces(b);
    const HasSeams = A.some((f) => f.internal) || B.some((f) => f.internal);
    const Candidates: Array<Patch> = [];
    for (const [ References, Incidents, Other, Flipped ] of [ [ A, B, b, false ], [ B, A, a, true ] ] as const)
    {
        for (const Reference of References)
        {
            if (Reference.internal)
            {
                continue;
            }

            const Normal = Flipped ? M.scale(Reference.normal, -1) : Reference.normal;
            if (!HasSeams && M.dot(Normal, penetration.normal) < 0.99)
            {
                continue;
            }

            const Incident = [ ...Incidents ].sort((x, y) => M.dot(x.normal, Reference.normal) - M.dot(y.normal, Reference.normal) || x.index - y.index)[0];
            if (Incident?.internal)
            {
                continue;
            }

            const Points = Incident ? clip(Reference, Incident.points, tolerance) : [ G.support(Other, M.scale(Reference.normal, -1)) ];
            const Contacts: Array<Contact> = [];
            for (const [ PointIndex, Point ] of Points.entries())
            {
                const Depth = M.dot(Reference.normal, M.sub(Reference.points[0], Point));
                const Projected = M.add(Point, M.scale(Reference.normal, Depth));
                if (Depth < -tolerance || !inside(Reference, Projected, tolerance))
                {
                    continue;
                }

                const PointA = Flipped ? Point : Projected;
                const PointB = Flipped ? Projected : Point;
                if (internalOnly(A, PointA, tolerance) || internalOnly(B, PointB, tolerance))
                {
                    continue;
                }

                Contacts.push({ pointA: PointA,
                    pointB: PointB,
                    depth: Math.max(0, Depth),
                    feature: `${a.leaf.path}:${b.leaf.path}:${Flipped ? "b" : "a"}${Reference.index}:${Incident?.index ?? "smooth"}:${PointIndex}` });
            }

            if (Contacts.length)
            {
                Candidates.push({ normal: Normal,
                    contacts: Contacts });
                // A valid exterior face aligned with the minimum separating
                // axis has reached the penetration lower bound. Remaining
                // exterior faces cannot yield a shallower separating patch.
                if (HasSeams && penetration.certified === true && M.dot(Normal, penetration.normal) > 1 - 1e-12 &&
                    Math.max(...Contacts.map((contact) => contact.depth)) <= penetration.depth + tolerance)
                {
                    Candidates.sort((x, y) => Math.max(...x.contacts.map((c) => c.depth)) - Math.max(...y.contacts.map((c) => c.depth)));
                    return Candidates[0];
                }
            }
        }
    }

    Candidates.sort((x, y) => Math.max(...x.contacts.map((c) => c.depth)) - Math.max(...y.contacts.map((c) => c.depth)));
    if (Candidates.length)
    {
        return Candidates[0];
    }

    if (internalOnly(A, penetration.pointA, tolerance) || internalOnly(B, penetration.pointB, tolerance) ||
        seamDirection(A, penetration.pointA, penetration.normal, tolerance) || seamDirection(B, penetration.pointB, M.scale(penetration.normal, -1), tolerance))
    {
        throw new G.Fault("manifold", "NonConvergence", "Overlapping convex cells expose only internal partition witnesses");
    }

    return { normal: penetration.normal,
        contacts: [ { pointA: penetration.pointA,
            pointB: penetration.pointB,
            depth: Math.max(0, penetration.depth),
            feature: `${a.leaf.path}:${b.leaf.path}:support` } ] };
};

/**
 * Deterministically merges coplanar patches and selects up to four spatially spread
 * contacts per normal patch. Distinct surface normals remain separate manifolds.
 *
 * @category Internal
 * @since 1.0.0
 */
export const merge = (patches: ReadonlyArray<Patch>, tolerance: number): ReadonlyArray<Patch> =>
{
    const Groups: Array<{ normal: V.Vector3;
        contacts: Array<Contact> }> = [];
    for (const Patch of patches)
    {
        let group = Groups.find((g) => M.dot(g.normal, Patch.normal) > 0.9999 &&
            Math.abs(M.dot(g.normal, M.sub(g.contacts[0].pointA, Patch.contacts[0].pointA))) <= tolerance * 8);
        if (!group)
        {
            group = { normal: Patch.normal,
                contacts: [] };
            Groups.push(group);
        }

        for (const Contact of Patch.contacts)
        {
            if (!group.contacts.some((c) => M.length(M.sub(c.pointA, Contact.pointA)) <= tolerance * 8 && M.length(M.sub(c.pointB, Contact.pointB)) <= tolerance * 8))
            {
                group.contacts.push(Contact);
            }
        }
    }

    return Groups.map((g) =>
    {
        g.contacts.sort((a, b) => b.depth - a.depth || a.pointA.x - b.pointA.x || a.pointA.y - b.pointA.y || a.pointA.z - b.pointA.z ||
            (a.feature < b.feature ? -1 : a.feature > b.feature ? 1 : 0));
        const Selected = [ g.contacts[0] ];
        while (Selected.length < Math.min(4, g.contacts.length))
        {
            const Remaining = g.contacts.filter((c) => !Selected.includes(c));
            Remaining.sort((a, b) => Math.min(...Selected.map((c) => M.length(M.sub(b.pointA, c.pointA)))) -
                Math.min(...Selected.map((c) => M.length(M.sub(a.pointA, c.pointA)))));
            Selected.push(Remaining[0]);
        }

        return Object.freeze({ normal: g.normal,
            contacts: Object.freeze(Selected.map((c) => Object.freeze(c))) });
    });
};
