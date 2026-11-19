# TypeScript tooling and source layout

Handwritten Node utilities, tests, fixtures and ESLint configurations use TypeScript.
Existing ESM utilities use `.mts`; other migrated modules use `.ts`. Generated JavaScript
in addon packs, `dist`, `Distribution` and Bridge's `lib` remains JavaScript.

Run a utility with `node --import tsx`, and host tests with
`node --import tsx --test`. Existing npm command names are unchanged. Run all tooling
compiler checks from the repository root with:

```powershell
npm run typecheck:tools
```

The shared tooling compiler settings are in `tsconfig.tools.base.json`. Each affected
workspace has its own `tsconfig.tools.json`; these checks keep Node globals separate
from Bedrock runtime compiler settings. ESLint loads TypeScript configs through `jiti`.

## Directory names

Source and support directories use singular PascalCase names: `Script`, `Tool`, `Test`,
`GameTest`, `Catalog`, `Documentation`, `Example`, `Public`, `Preview` and `Fixture`.
Nested source directories follow the same convention, including `Runtime`, `Domain`,
`Bedrock` and `Data`. Packages that already use `Source` retain that name.

Bedrock's directory contracts retain their required spelling: `behavior_packs`,
`resource_packs`, pack contents such as `items` and `textures`, and the generated
`scripts/main.js` entry point. Reference snapshots, dependency directories, generated
outputs and application metadata directories also retain their existing layout.

Node subprocesses that execute source TypeScript outside a workspace use an absolute
`tsx` preload URL resolved with `import.meta.resolve("tsx")`. Python snapshot wrappers
pass the equivalent absolute loader URI. Published server-manager executables continue
to run compiled JavaScript without `tsx`; their internal declaration files are excluded
from the published package.

## External server launcher

An existing `Start Server.cmd` outside this repository may still reference the retired
`Script/start-server.mjs`. Its command can be updated to:

```batch
call npm --prefix "C:\MineCraft\Clone" run server:start
```

The launcher still reads `BDS_ROOT`. No external launcher or live server installation
is modified by this migration. BDS tests continue using each addon's fixed
`dist/bds-runtime/bedrock_server.exe` path; see [TestFirewall.md](TestFirewall.md).
