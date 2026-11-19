*Copyright &copy; 2026 Gage Sorrell.  Released under the [MIT license](./License.md).*

# `bds-intellisense`

Version-aware IntelliSense for Bedrock Dedicated Server `server.properties` files.  The
*Bedrock Dedicated Server Intellisense* and *Bedform Companion* VS Code extensions are built on it.

Apart from `bds-intellisense/VSCode`, the package has no editor dependency.  It works on plain text and returns plain data with zero-based
positions.

| Module | Contents |
|---|---|
| `bds-intellisense/Version` | Parsing, formatting and ordering of release numbers such as `1.26.63.1`. |
| `bds-intellisense/Parser` | Classification of lines into assignments, comments (including disabled `# key=` assignments), blank lines and unreadable lines. |
| `bds-intellisense/Schema` | Schema types, and a catalog that picks the schema applying to a release. |
| `bds-intellisense/Analysis` | `Validate`, `Complete`, `Hover` and `PropertyMarkdown`. |
| `bds-intellisense/Detection` | Detects the release of the installation a `server.properties` belongs to: first from the file version of `bedrock_server.exe`, then from the newest `behavior_packs`/`resource_packs` `vanilla_X.Y.Z` folder (which also covers Linux). |
| `bds-intellisense/PeVersion` | Reads `VS_FIXEDFILEINFO` from a Windows executable by walking its headers and resource tree, without reading the whole file. |
| `bds-intellisense/Resolution` | `ResolveSchema` chooses a file's schema: a version chosen by hand, then the detected release (when `detectVersion` is on), then the `fallbackVersion` setting. `CreateDetectionCache` reuses detections until the server's files change. |
| `bds-intellisense/Keys` | Setting names, command names and diagnostic codes. |
| `bds-intellisense/VSCode` | `RegisterServerPropertiesIntellisense(context, { ConfigurationSection, CommandPrefix })`: completion, hover, diagnostics, quick fixes, a status bar item, and the `selectSchemaVersion` and `redetectVersion` commands.  It needs the `vscode` module, so the core above does not import it. |

A catalog applies each schema from its own version until the next schema's version.  Releases
older than every schema use the oldest schema, and newer releases use the latest.

```ts
import { Analysis, Parser, Schema } from "bds-intellisense";

const catalog = Schema.CreateSchemaCatalog(schemas);
const schema = Schema.SchemaFor(catalog, [ 1, 26, 63, 1 ]);
const diagnostics = Analysis.Validate(Parser.ParseDocument(text), schema, catalog);
```

The bundled catalog, `Schema.BundledCatalog`, holds one schema for each run of consecutive BDS
releases, from 1.16.0 on, whose default `server.properties` files agree.  Each schema is keyed by
its first release's three-part version, such as `1.26.60`.

## Development

```sh
npm run build --workspace bds-intellisense
npm test --workspace bds-intellisense
```

### Adding a BDS release

The schemas are generated during development; nothing is downloaded where the package is used.

```sh
npm run fetch --workspace bds-intellisense -- --refresh-versions
npm run generate --workspace bds-intellisense -- --report
```

1. `Tool/fetch.mts` refreshes `Tool/versions.json` from the
   [Bedrock-OSS release list](https://github.com/Bedrock-OSS/BDS-Versions).  It then saves the default
   `server.properties` of each new release to `Data/Pristine/`, reading only that file from the
   official zip with Range requests.
2. `Tool/generate.mts` types each property from its `Allowed values` comment, or from its default
   value, applies `Tool/overrides.mts`, and writes `Source/Schema/Generated/Schemas.generated.ts`.
   It refuses to write when a comment matches no rule, or when a release's own default file would
   have diagnostics.  In either case, add a rule or an override.
3. Commit `Tool/versions.json`, the new files in `Data/Pristine/`, and the generated module.  The
   tests fail when the generated module is out of date.
