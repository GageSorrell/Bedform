# Functional spatial math for `bedform`

Use only `MAJOR.MINOR.PATCH` in symbol-level `@since` tags. Prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`, or any other prerelease identifier) and build metadata (`+...`) must never appear in `@since` tags; for example, package version `1.0.0-alpha.1` uses `@since 1.0.0`.

Module TSDoc headers must not contain `@category` or `@since`; these tags apply only to symbol documentation. Follow the repository's TypeScript module header format for file-level metadata.

## Summary

Add pure, immutable `Quaternion`, `Rotator`, `Vector3`, `Vector2`, `Transform`, `RigidTransform`, `Plane`, `AABB`, `OBB`, `Ray`, and `ConvexHull` modules to `bedform`, using `effect-bedrock` protocols and functional conventions. Cover portable quaternion and rotator mathematics from the requested reference APIs and the vector utilities in `@minecraft/math@2.4.1`. Extend `effect-bedrock/Number` with the general-purpose numeric operations these implementations need.

Use Minecraft coordinates throughout. Explain conventions directly without mentioning Unreal in the explanatory documentation or source comments. Euler coordinates retain representational singularities; quaternion-based composition and interpolation avoid accumulating Euler-angle errors but do not remove those singularities.

Implementation progress is tracked in Beads. All eleven spatial module implementation milestones are complete through ConvexHull (`MineCraft-ner.14`), along with the Number/protocol foundations. ConvexHull includes deterministic point-cloud construction, validated outward indexed topology, derived edges/planes, bounds/volume/centroid, solid containment/nearest/support queries, rigid mapping, ray clipping and complete hull/AABB/OBB overlap. Exact finite-double orientation/projection predicates and conditioned numerical geometry cover degeneracy and extreme ranges without bounding-box query substitutes. Its recorded acceptance command passed 175 Bedform tests, pure/tool typechecks, package lint, packed-consumer declarations and fourteen README examples. That record also reports six pre-existing upstream Effect `QueuingStrategy` errors in full-source typechecking.

### Final acceptance scope — November 1, 2026

The user replaced the final verification scope of `MineCraft-ner.7` with documentation-only completion and explicitly requested closing that entry and the parent epic. This supersedes requirements below to rerun final tests or other verification commands. The implementation specification and historical evidence remain intact. Final acceptance consolidates the module inventory, package contract, prior milestone results and known limitations in the [Bedform acceptance record](../Package/Bedform/ReadMe.md#spatial-math-acceptance-record). No tests, builds, typechecks, lint, pack/install or runtime checks were executed for this final pass. The six previously reported upstream declaration errors are documented as an accepted limitation, not repaired or freshly verified. With that documentation delivered, `.7` and `MineCraft-ner` are complete under the revised scope; downstream rendering, grabbing and physics remain separate epics.

## Packages, interfaces, and functional conventions

- Add root namespace exports and matching package subpaths for `Quaternion`, `Rotator`, `Vector3`, `Vector2`, `Transform`, `RigidTransform`, `Plane`, `AABB`, `OBB`, `Ray`, and `ConvexHull`. Do not add `Quat` or `EulerAngle` barrel exports or package subpaths.
- Export interfaces named `Quaternion` and `Rotator`, plus exactly the empty extending interfaces `Quat extends Quaternion {}` and `EulerAngle extends Rotator {}` in their respective modules.
- Define Bedform-owned `Vector2` and `Vector3` interfaces with readonly coordinates and Effect protocols. Do not re-export the official vector types. Accept plain structurally compatible Bedrock vectors as inputs, using type-only imports from `@minecraft/server` where useful.
- Provide positional validating constructors `Quaternion(x, y, z, w)`, `Rotator(pitch, yaw, roll)`, `Vector3(x, y, z)`, and `Vector2(x, y)`, returning `Option`. Reject nonfinite components and zero-length quaternions. Zero vectors and zero rotators are valid. Corresponding `QuaternionUnsafe`, `RotatorUnsafe`, `Vector3Unsafe`, and `Vector2Unsafe` constructors return values directly and preserve raw components.
- Freeze values and operation results, without modifying caller-owned inputs. Use shared prototypes for protocols and piping; expose mathematical operations as functions rather than instance methods.
- Use `dual` for binary operations and receiver-plus-argument operations, including interpolation, rotation, comparisons, and scaling. Preserve operand order: `pipe(a, multiply(b))` means `multiply(a, b)`.
- Return `Option` from parsers and mathematically partial spatial operations. Do not use `undefined` unions for empty values. Ordinary raw component arithmetic returns values directly, including raw invalid results from overflow or unsafe inputs.
- Keep `effect-bedrock@1.0.0` as a Bedform dependency. Add `@minecraft/math` to Bedform's `devDependencies` at exactly `2.4.1` and to `peerDependencies` at `^2.4.1`. The math peer must be non-optional: do not mark it optional in `peerDependenciesMeta`. Update the lockfile during implementation.
- Use the math package for API reference and differential tests; a required peer declaration does not require production math to delegate to it. Keep production spatial modules independent of upstream Effect, Node/Web globals, and Bedrock runtime imports or subscriptions.
- Preserve current versions (`bedform` 1.0.0-alpha.1, `effect-bedrock` 1.0.0) and unrelated pending changes. Apply repository TSDoc, namespace-extracted nested interfaces, and PascalCase constant conventions. All flagged symbols need prose comments without `@param`/`@returns`, followed by a blank line, `@category`, and the relevant package version in `@since`.

## General-purpose `effect-bedrock/Number` additions

- Reuse existing arithmetic, safe/unsafe division, `min`, `max`, `clamp`, and precision-aware `round`; do not replace their signatures or semantics.
- Add missing number-only exports for `abs`, `negate`, `sqrt`, `sin`, `cos`, `asin`, `acos`, `atan2`, `hypot`, `pow`, `floor`, `ceil`, `trunc`, `toRadians`, `toDegrees`, `positiveModulo`, and `lerp`. These are general-purpose functions with no Bedform types, coordinate conventions, rotation-specific precision policy, or Bedform dependency.
- Define every new callable export with `dual`. Binary `atan2(y, x)`, `hypot(a, b)`, `pow(base, exponent)`, and `positiveModulo(value, modulus)` support the usual data-first and data-last forms. `lerp(self, that, t)` supports `lerp(that, t)(self)` and permits extrapolation. `positiveModulo` requires a positive finite modulus and computes a nonnegative remainder; invalid modulus or nonfinite dividend produces NaN.
- For unary additions, numeric `dual(1, ...)` is invalid in the current implementation. Use predicate-form `dual` with a supplied-argument check and typed overloads supporting both `sin(value)` and `sin()(value)`, likewise for the other unary exports. These remain directly usable as `pipe(value, sin)`.
- Use JavaScript numeric semantics for primitive math, including NaN/Infinity and signed zero where applicable; `hypot` must preserve native overflow/underflow stability. Spatial modules validate domains and convert undefined mathematical outcomes to `Option.none` at their own boundaries.
- Consume these new exports from Bedform rather than duplicating scalar helpers or bypassing them with equivalent `Math.*` calls. Compose stable vector/quaternion lengths from the generic numeric helpers. Keep canonical orientation-key policy in Bedform.
- Test numeric results, operand order, direct/curried/piped overload inference, domains, boundaries, signed zero, NaN/Infinity, and large/small magnitudes. Add independent tests and focused validation scripts in the Effect package; its Number root/subpath exports already exist.

## Coordinates and mathematical coverage

### Coordinate and composition contract

- Use X-east, Y-up, Z-south. Zero pitch/yaw faces +Z; positive yaw turns toward -X, and positive pitch looks downward.
- Store Rotator fields as `{ pitch, yaw, roll }` in degrees. Apply intrinsic yaw, pitch, then roll; positive roll is clockwise when looking forward.
- Use Hamilton quaternion multiplication and radians for quaternion axis-angle and rotation-vector operations. Conversion follows `qY(-yaw) * qX(pitch) * qZ(roll)`.
- `multiply(a, b)` applies `b` before `a`. Include local-space and world-space composition examples. Preserve signs and magnitudes in component arithmetic; normalize when interpreting rotations. Comparison canonicalization must not alter full-path interpolation inputs.
- Expose positive coordinate-axis helpers separately from facing-relative helpers. At zero orientation, forward is +Z, up is +Y, and facing-right is -X.

### Vectors

- Cover Vector2 and Vector3 utility arithmetic from `@minecraft/math@2.4.1`: equality, partial-coordinate addition/subtraction, scaling, dot product, magnitude/distance, normalization, floor, clamp, lerp/slerp, component multiplication, parsing, and formatting. Additionally cover 3D cross product, `ceil`, component `min`/`max`, and X/Y/Z axis rotation.
- Provide PascalCase constants, including correctly mapped cardinal directions: east +X, west -X, south +Z, north -Z, up +Y, down -Y. Distinguish positive-axis labels from facing-relative right/left.
- Normalize stably for very large and very small finite inputs. Normalizing zero or nonfinite vectors returns `None`. Handle parallel spherical interpolation without division by zero; use a deterministic perpendicular path for antiparallel inputs, and return `None` for zero-length spherical inputs. Interpolation parameters remain unclamped.

### Quaternion

- Implement component addition/subtraction/scaling/division, dot product, magnitude/squared magnitude, conjugation, normalization, inverse, identity/normalized/finite tests, vector rotation/unrotation, axis/direction extraction, and shortest-arc alignment.
- Support axis-angle, Rotator/Euler, rotation-vector, and matrix conversions; shortest rotations between vectors and between unit normals; angular distance and normalized error measures; rotation log/exp; swing/twist decomposition; and twist extraction.
- Use readonly row-major 4x4 matrix tuples acting on column vectors. Quaternion-to-matrix returns a homogeneous rotation matrix. Matrix construction rejects nonfinite, reflected, scaled, or nonorthonormal bases rather than silently discarding them.
- Include fast lerp/bilerp, normalized and unnormalized spherical interpolation, shortest/full-path variants, squad variants, and tangent calculation. Preserve full-path information and handle parallel/antipodal numerical boundaries deterministically.
- Provide identity, parsing/formatting, exact-component and approximate comparisons. Portable coverage excludes native engine/archive/network/SIMD integration and uninitialized constructors.

### Rotator

- Implement component arithmetic/scaling, axis access/update, wrapping/clamping, normalization, winding/remainder decomposition, equivalent/closest representations, grid snapping, Manhattan distance, parsing/formatting, and byte/short angle compression/decompression.
- Implement distinct quaternion-based composition and spherical interpolation. Inverse, vector rotation/unrotation, axes/directions, angular distance, and orientation comparison use quaternion mathematics. Component addition retains component semantics.
- Supply bidirectional Quaternion and Euler/vector conversions. Use a deterministic principal Euler representation; at pitch singularities, set roll to zero and absorb the remaining rotation into yaw.
- Use explicit tolerances for approximate comparisons, separate from protocol equality. Undefined conversions, inverse operations, decompositions, and other partial spatial operations return `None`.

## Transforms and geometric queries

### Shared value and query contract

- Add pure modules and same-named exported interfaces for `Transform`, `RigidTransform`, `Plane`, `AABB`, `OBB`, `Ray`, and `ConvexHull`, with root namespaces and matching package subpaths. These extend the four existing spatial modules; they do not replace them or add `Quat`/`EulerAngle` entrypoints.
- Apply the existing immutable, functional, Effect-protocol and scalar-helper conventions to all seven modules. Deep-copy and freeze caller-owned nested coordinates, orientations, arrays and topology; do not freeze or mutate the caller's objects. Use shared protocol/piping prototypes and full-precision JSON with distinct type discriminators. Parsers accept each module's default emitted text.
- Provide positional validating constructors `Transform(position, rotation)`, `RigidTransform(position, rotation, linearVelocity, angularVelocity)`, `Plane(normal, offset)`, `AABB(min, max)`, `OBB(center, halfExtents, rotation)`, `Ray(origin, direction)`, and `ConvexHull(points)`, all returning `Option`. Also expose `ConvexHull.fromFaces(vertices, faces)` for indexed convex topology. Corresponding `Unsafe`-suffixed constructors return raw copied/frozen representations directly, without coercion, normalization, repairing topology, or computing invalid derived data eagerly.
- Validating constructors reject nonfinite inputs and invalid geometric domains. Transform/OBB orientations are stably normalized nonzero quaternions; zero positions and velocities are valid. Plane normals and Ray directions are normalized stably. Unsafe inputs remain raw; partial operations validate their domains and normalize rotation interpretation without modifying stored values.
- Use `Option` for undefined results and invalid unsafe inputs. Predicate queries such as containment and overlap return `Option<boolean>`: valid disjoint inputs produce `Some(false)`, while invalid input produces `None`. Hit-producing queries return `Option<Ray.Hit>`; misses or invalid input produce `None`. Do not silently turn invalid geometry into a valid negative predicate result.
- Query options expose finite nonnegative absolute and relative tolerances, defaulting to `1e-9` each. Document scale-aware use of these tolerances and validate them. Boundary contact counts as containment/overlap. Tolerances never affect protocol equality or silently inflate stored shapes.
- `Ray.Hit` contains distance, point, and `Option<Vector3>` normal; extract nested object interfaces into their owner's namespace per repository conventions. Parameters and distances are in blocks, and rays extend forward from distance zero. A ray originating within a closed solid has first-hit distance zero; use `None` for a surface normal when there is no unique boundary normal. Parallel/coplanar cases and ties have documented deterministic results.
- Shapes own their ray-query and cross-shape-query functions. `Transform` and `Ray` must not import shape modules. Keep the dependency direction from boxes/hulls to foundational rays/transforms, never the reverse.
- Geometry equality/hashing uses exact stored components/topology with Effect number semantics; orientation fields use the existing canonical Quaternion key. Type discriminators keep different kinds distinct. Hull equality is not arbitrary geometric-set equivalence across alternate tessellations; approximate geometry comparisons are explicit separate operations. Invalid unsafe values remain reflexive and deterministic. No new angle-distance orders are required for shapes.
- Pure geometry provides construction and static queries only. Contact manifolds, GJK/EPA contact solving, continuous collision detection, dynamic AABB-tree maintenance, concave decomposition and rigid-body integration remain in physics. A convex hull must never silently replace a concave solid, fill a cavity, or approximate an unsupported mesh.

### Transform

- Store `{ position: Vector3, rotation: Quaternion }` with no scale. Provide `Identity`, composition/inverse, point and direction transformation/untransformation, row-major homogeneous matrix conversions, and pose interpolation. A direction receives rotation only; a point also receives translation.
- `compose(a, b)` applies `b` before `a`: position is `a.position + rotate(a.rotation, b.position)` and rotation is the Hamilton product `a.rotation * b.rotation`. Support data-first and data-last forms preserving operand order.
- Matrix construction rejects nonfinite values, scale, reflection, shear, nonorthonormal bases and invalid homogeneous terms. Conversion uses the Quaternion matrix convention. Pose interpolation uses componentwise position lerp and shortest-path quaternion slerp, allows extrapolation, and returns `None` when undefined. This mathematical interpolation does not change the renderer's separately specified shortest-path normalized quaternion lerp.

### RigidTransform

- Export `RigidTransform extends Transform` with `linearVelocity: Vector3` and `angularVelocity: Vector3`. Both velocities are expressed in the containing coordinate frame, which is world space for a standalone physics pose. Linear velocity belongs to the transform origin, in blocks/second; angular velocity is in radians/second. There is no scale or COM field.
- Provide zero-motion identity, construction from a Transform plus both velocities, pose extraction, composition/inverse with velocity propagation, velocity at a containing-frame point, and interpolation of pose and both velocities. Velocity interpolation is componentwise lerp, distinct from dynamics; no new integrator is introduced.
- For composition, let `r = rotate(a.rotation, b.position)`: output linear velocity is `a.linearVelocity + cross(a.angularVelocity, r) + rotate(a.rotation, b.linearVelocity)`; output angular velocity is `a.angularVelocity + rotate(a.rotation, b.angularVelocity)`. The second operand is expressed in the first operand's frame. Inversion propagates both velocities consistently with these formulas; simply adding linear velocities is incorrect.
- Velocity at a point is `linearVelocity + cross(angularVelocity, point - position)`. Physics keeps COM velocity authoritative and converts explicitly: `vOrigin = vCOM + cross(angularVelocity, origin - COM)` and `vCOM = vOrigin + cross(angularVelocity, COM - origin)`. Do not label a model-origin pose plus COM velocity as a RigidTransform without this conversion.

### Plane

- Store a unit `normal` and signed `offset` with equation `dot(normal, point) + offset = 0`. Negative signed distance is the interior half-space. Validating construction divides both normal and offset by the normal's length; it never flips the normal to choose a sign.
- Provide construction from three noncollinear points or a point/normal, signed distance, point projection, side classification, flipping, rigid transformation, plane/plane intersection and forward ray intersection. Plane/plane intersection returns an optional infinite line with point/direction in a namespace-extracted result interface, never a forward Ray. Parallel or coincident planes have no unique line and return `None`; a coplanar ray hits at distance zero.

### AABB

- Store finite `min` and `max` Vector3 corners with `min <= max` componentwise; zero extents are valid and inverted bounds are rejected. Provide construction from a nonempty point set or center/half-extents, center/size/corners, containment, union, intersection, expansion, closest point/distance, support points, ray intersection and enclosing AABB after rigid transformation.
- Empty point sets or intersections return `None`. Expansion that inverts bounds is invalid. Union is the smallest enclosing AABB. A rotated AABB operation explicitly produces an enclosing AABB rather than claiming the transformed shape remains axis aligned.

### OBB

- Store finite `center`, componentwise nonnegative `halfExtents`, and quaternion `rotation`. Zero extents are valid. Provide local/world point conversion, corners, containment, closest point/distance, support points, enclosing AABB, rigid transformation, ray intersection, and static overlap with AABBs/OBBs.
- Perform tests in the appropriate local frame or through a complete separating-axis test; preserve touching and lower-dimensional box cases. Do not invent a rotation-independent bounding proxy for an exact OBB query.

### Ray

- Store finite `origin` and unit `direction`. Validating construction normalizes a finite nonzero direction stably; zero/nonfinite directions are invalid. Unsafe construction preserves the input length and components; querying an invalid nonunit unsafe Ray returns `None` rather than changing distance units.
- Provide evaluation at a finite nonnegative distance, closest forward-ray point/distance to a point, and rigid transformation. The closest-point parameter clamps at zero. Shape modules provide Plane/AABB/OBB/ConvexHull intersections without reverse imports into Ray.

### ConvexHull

- Represent bounded, full-dimensional 3D convex solids only. Store immutable vertices and indexed outward face topology with derived edges/planes; copy all supplied arrays and use deterministic vertex/face ordering, support-point ties and construction results.
- Build from finite point clouds, allowing duplicates and interior points when a solid hull exists. Reject empty, point-only, collinear, coplanar and other zero-volume inputs. `fromFaces` validates index ranges, nondegenerate planar faces, closed manifold topology, outward orientation, convexity and positive volume rather than silently repairing nonconvex or malformed input.
- Provide AABB/OBB construction/conversion into hulls, bounds, positive volume and centroid, containment, closest point/distance, support points, rigid transformation, forward ray intersection, and static overlap with AABBs, OBBs and other convex hulls. Interior point distance is zero and its closest solid point is itself. Validate degeneracy after conversions; zero-volume boxes cannot become valid solid hulls.
- Use complete geometric queries rather than bounding-box-only answers. Deterministic serialization retains stored topology; equality does not promise that alternate triangulations of the same boundary compare equal. Physics preserves source provenance and internal partition-face metadata alongside hull geometry, rather than forcing them into generic math values.

## Equality, hashing, ordering, and observability

- Publicly expose existing Effect modules `Hash`, `Equivalence`, `Order`, `Ordering`, `Pipeable`, `Inspectable`, and `Formatter` through root exports and subpaths, including declaration and legacy resolution mappings where the package uses them. Preserve the pending `Equal` export changes and complete its resolution mapping consistently.
- Implement `Equal`, `Hash`, `Pipeable`, `Inspectable`, custom inspection, `toJSON`, and `toString` for all eleven spatial values. Delegate formatting/inspection to Effect helpers without importing Node. JSON retains full-precision stored components and a type discriminator. Parsers accept the corresponding default emitted textual form; vector formatting also supports decimals/delimiter options.
- Vector equality and hashing use exact components with Effect's number semantics (NaN equals NaN, signed zeros agree). Rotation protocols share a canonical key: stable normalization, deterministic sign selection, and rounding to 12 decimal places. Prefer positive `w`; at `w = 0`, choose sign from the first nonzero `x`, `y`, then `z`. Reapply sign selection after rounding and collapse signed zero.
- Rotators derive canonical orientation keys through quaternions after reducing angle winding. Store original full-precision components. Fuzzy comparison remains a separate operation so protocol equality is transitive.
- Export `equalsComponents` and `hashComponents` for both quaternion and rotator raw representations. Keep type discriminators so protocols do not equate different spatial kinds.
- Both rotation modules export `OrderLexicographic`, identity-based `OrderAngleDistance`, and `orderByAngleDistance(reference)`. The factory returns `Option<Order>` when the reference is invalid. Orders use canonical keys; angular distance ties are broken lexicographically so equality, hashing, and ordering agree.
- Quaternion lexicographic order uses canonical `x, y, z, w`. Rotator lexicographic order uses principal `pitch, yaw, roll` derived deterministically from its canonical quaternion key, with quaternion-key tie-breaking.
- Unsafe invalid rotations use a distinct raw-component fallback for equality/hashing and sort after valid rotations. Numeric fallback order is negative infinity, finite numbers, positive infinity, NaN, with signed zero collapsed. All invalid-value handling remains reflexive and deterministic.

## Validation and delivery

- Test every operation family, validating/unsafe construction, `Option` failures, frozen results, and unchanged caller inputs. Verify all dual call styles and declaration inference, especially subtraction, cross product, `atan2`, and quaternion multiplication.
- Verify cardinal directions, roll signs, noncommuting mixed-axis composition, local/world composition, matrix and angle conversion round trips, winding, pitch singularities, and inverse round trips.
- Cover interpolation endpoints, extrapolation, parallel/antiparallel cases, shortest/full paths, splines/tangents, log/exp, swing/twist reconstruction, extreme finite magnitudes, and invalid unsafe inputs.
- Test equality/hash consistency, HashMap/HashSet behavior, and order laws for `q`, `-q`, scaled rotations, equivalent Euler representations, half turns, signed zero, quantization boundaries, and invalid values.
- Compare ordinary vector results to pinned `@minecraft/math`; test intentional differences in partial-operation behavior and corrected cardinal constants explicitly.
- Extend declaration, package, and restricted-host tests for root/subpath exports, exact alias restrictions, required math peer metadata, clean packed-consumer dependency installation, formatting/JSON, and absence of Node/Web/Bedrock runtime imports in the pure surface.
- Maintain an operation-coverage inventory in tests for all eleven spatial modules, including every transform/geometric-query family and the advanced portable quaternion/rotator features. Document all new APIs and executable usage examples in the Bedform README, including angle units, partial results, canonical precision, and component arithmetic versus composition.
- Run Effect build/typecheck, focused Number/protocol lint/tests and declaration checks, existing relevant collections tests, then Bedform build/tests/source and test typechecks/lint plus packed/restricted-host checks. Report the previously observed six optional-upstream-Effect `QueuingStrategy` type errors separately if still present; do not hide them by weakening compiler checks.
- Test Transform composition/inverse, point/direction and matrix round trips; RigidTransform rotating-frame transport, point velocity, COM/origin conversions and interpolation; Plane signs/scaling/projection/intersections; degenerate boxes, support points and exact overlaps; Ray normalization, parallel/coplanar/tangent/inside-origin behavior; and solid-hull construction/topology/winding, nearest points, volume/centroid, duplicates/interior points and all supported overlap pairs. Include extreme magnitudes, tolerance boundaries, invalid unsafe inputs, frozen nested data, unchanged caller inputs, protocol/hash-collection laws and direct/curried declaration inference.
- Track implementation in a Beads epic with dependent, self-contained child issues. The epic and children must retain the full specification so implementation does not depend on this file or chat access. Leave implementation issues open until implemented and validated. Preserve completed Number/protocol issues `MineCraft-ner.1` and `.2`; add one self-contained child per new module and make final integration `.7` depend on all seven. Geometry dependencies flow through vectors/quaternions to Transform, RigidTransform, Ray, Plane, AABB, OBB and ConvexHull without reverse shape imports. Physics remains downstream of the completed math epic.
- New module tracking: `MineCraft-ner.8` Transform; `.9` RigidTransform; `.10` Ray; `.11` Plane; `.12` AABB; `.13` OBB; `.14` ConvexHull. `Transform` depends on vectors and Quaternion core; `RigidTransform` and `Ray` depend on Transform; Plane depends on Transform/Ray; AABB depends on Transform/Plane/Ray; OBB additionally depends on AABB; ConvexHull additionally depends on OBB. Final validation `.7` depends on every new module; the physics epic continues to depend on the completed math epic.
- No live-world deployment, commits, pushes, or remote Dolt synchronization. This planning delivery writes this specification and creates tracking entries; it does not implement package changes.

### Success Criteria

All eleven pure spatial modules, the generic Number helpers and public Effect protocols are implemented, documented and covered by the operation inventory and package/declaration/restricted-host tests. Transform/RigidTransform frame and velocity semantics, exact shape queries and solid-hull validity meet the contracts above. Completed Number/protocol work stays complete; all remaining implementation issues stay open until their own acceptance evidence exists. This specification update itself does not implement the modules.
