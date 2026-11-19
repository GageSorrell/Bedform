# Bedform

The definitive toolset for *MineCraft: Bedrock Edition*: build feature-packed add-ons, manage servers and worlds, and extend MineCraft with cross-platform support.

## Packages

| Package | Directory | Description |
|---|---|---|
| [`bedform`](Package/Bedform/ReadMe.md) | `Package/Bedform` | The framework and CLI. |
| [`@bedform/effect`](Package/Effect/README.md) | `Package/Effect` | A self-contained port of Effect for Bedrock Dedicated Server. |
| `@bedform/<name>` | `Package/<Name>` | One mirror of each `@minecraft/<name>` package, re-exporting it with Bedform's extensions, such as [`@bedform/server`](Package/Server/ReadMe.md). |

`Addon/` holds the packs that `bedform` ships and add-ons that demonstrate its features. `Package/Deprecated/` and `Script/Deprecated/` hold retired tools.

## Versions

Each `@bedform/<name>` mirror's version is the version of `@minecraft/<name>` that it tracks, with a channel suffix: `-dev.N` on `Master` (npm tag `dev`) and `-beta.N` on `Beta` (npm tag `beta`).

## Development

Use Node 24.19.0, then run `npm install` at the repository root. See [`CLAUDE.md`](CLAUDE.md) for the conventions, build and test commands, and the release process.

## License

See [`License.md`](License.md). Packages are MIT-licensed unless their own license file says otherwise.
