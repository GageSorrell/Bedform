# `eslint-plugin-bedform` and `oxlint-plugin-bedform`

Please write plugins for ES Lint and `oxlint`.
These should be separate packages, so that the `oxlint` plugin can make use of the high-performance `oxlint` API, which is not possible for ES Lint plugins loaded through `oxlint`.

The rules and options should be one-to-one, barring differences in what can be done in ES Lint *versus* `oxlint`.

They should both have `recommended` and `strict` example configurations exported from the respective packages.
The respective configs should be the same across both plugins, again barring differences inherent to ES Lint and `oxlint`.

For now, please just put a single rule in these, enabled (as "error" in ES Lint; whatever the equivalent thing is in `oxlint`) named `"prefer-bedform-world"`, which takes no additional options.
This rule should flag any import statement that imports `world` from `@minecraft/server`.
The suggested fix (which should be doable from the ES Lint extension for VS Code) should be to remove the `world` import from the import statement (or, if `world` is the only thing imported by that statement, then the entire import statement should be removed).
In place of this removed import statement (or immediately after the import statement if it is kept due to having other imports) an import statement should be added `import * as World from "bedform/World";`.
If `world` was only *type*-imported by the removed/modified statement, then the new import statement should be `import type * as World from "bedform/World";` instead.
