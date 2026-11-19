# BedrockServerManager

A CLI application for Bedrock Dedicated Server (BDS) administration. Configuration, addon
inventory, installation, activation, updates, removal and portable export are
available. Both executable names expose the same commands.

Requires Node.js 22 or newer. From this repository:

```sh
npm install
npm run build --workspace bedrock-server-manager
npm exec --workspace bedrock-server-manager -- bds --help
npm exec --workspace bedrock-server-manager -- bedrock-server-manager --version
```

To install a local package globally (no registry publication is required):

```sh
npm pack --workspace bedrock-server-manager
npm install --global ./bedrock-server-manager-0.1.0.tgz
```

Both executable names run the same CLI. Nested help is available at every level:

```sh
bds config --help
bds config set --help
bds config set server.path "/path/to/bedrock-server"
bds config get
bds config get server.path
bds config set server.path --unset
```

`server.path` must identify an existing directory. Relative values resolve against
the current working directory and are saved as absolute paths. Unsupported keys
and invalid arguments fail with a nonzero exit code. An unset key prints `null`;
`config get` without a key prints the nested settings object as JSON.

Configuration is stored outside the npm installation:

| Platform | File |
| --- | --- |
| Windows | `%APPDATA%\bedrock-server-manager\config.json` |
| macOS | `~/Library/Application Support/bedrock-server-manager/config.json` |
| Linux | `$XDG_CONFIG_HOME/bedrock-server-manager/config.json`, or `~/.config/bedrock-server-manager/config.json` |

Set `BDS_CONFIG_PATH` to override the file (relative paths resolve against the
working directory). Reading missing settings creates nothing. Writes use a
temporary file and atomic replacement; invalid existing JSON or setting shapes
produce an error and are preserved. Unrelated existing fields survive writes.

Addon commands select an explicit `--server` before
saved `server.path`; absent both, it returns an actionable error. It never uses
the working directory as an implicit server. World selection uses `--world` or
`level-name` in `server.properties` and requires an existing world inside `worlds`.
Configuration and help work without a server.

Inspect installed addons with an existing selected world:

```sh
bds addon list --server "/path/to/bedrock-server"
bds addon ls -s "/path/to/bedrock-server" -w "My World" --json
bds addon show "Exact Pack Name" --server "/path/to/bedrock-server" --json
bds addon validate --server "/path/to/bedrock-server" --json
bds addon validate "bundle-id-from-list" --server "/path/to/bedrock-server"
```

Discovery includes top-level `behavior_packs` and `resource_packs`, plus those
directories in the selected world. Every immediate child directory is inspected
as a pack. Bad or missing manifests remain in the inventory with diagnostics.
Supported manifests use format 2 and `data`, `script` or `resources` modules;
unrecognized fields are preserved. Script entrypoints must be files inside their
pack. UUID dependencies are checked for presence and exact versions; scripting
API dependencies are reported as runtime requirements, without installing them.

Selectors accept the printed bundle ID, a member pack UUID, or an exact bundle
or member pack name. Ambiguity errors list matching bundle IDs. `--scope shared`
or `--scope world` restricts which bundles can be selected; a selected bundle
retains all its visible members. Dependency checks still use the full inventory.
World-local packs in other worlds are excluded.

`list` and `show` report inventory problems without failing the inspection.
`validate` exits 1 for validation errors and 0 when valid. With `--json`, validation
writes one report with `valid`, `addonIds` and `diagnostics`. Pack activation is
`enabled`, `disabled`, `invalid` (conflicting references), or `unknown` (an unreadable
activation file). These commands never modify packs, activation files or registry
data, and never create a missing registry. A missing selected world is an error.

Install and activate addons while the server is stopped:

```sh
bds addon install "/path/to/addon.mcaddon" --server "/path/to/bedrock-server"
bds addon install "/path/to/folder" -s "/path/to/bedrock-server" --no-enable
bds addon install "/path/to/pack.mcpack" -s "/path/to/bedrock-server" --scope world -w "My World"
bds addon enable "Exact Pack Name" --server "/path/to/bedrock-server"
bds addon disable "bundle-id-from-list" --server "/path/to/bedrock-server"
bds addon update "bundle-id-from-list" --server "/path/to/bedrock-server"
bds addon update "Exact Pack Name" --source "/path/to/replacement.mcaddon" -s "/path/to/bedrock-server"
bds addon remove "bundle-id-from-list" --server "/path/to/bedrock-server"
bds addon rm "Exact Pack Name" --server "/path/to/bedrock-server"
bds addon export "Exact Pack Name" -s "/path/to/bedrock-server" --output "./backup.mcaddon"
```

Installation defaults to shared pack folders and enables the bundle in the
selected world. `--no-enable` leaves activation untouched and permits shared
installation before a world exists. World-scoped installs always require an
existing world. Pack directories are named by manifest UUID; sources can be
standalone folders, paired addon folders, wrapper folders, `.zip`, `.mcpack`, or
`.mcaddon` files containing nested archives. Every source becomes one registered
bundle, and pack file bytes and unknown manifest fields are preserved.

Enabling also enables installed UUID dependencies recursively, including cycles.
Missing or mismatched versions prevent the entire operation. Scripting API
requirements are printed; the CLI does not install APIs. Disable preserves
dependencies and unrelated entries, and fails if another enabled pack requires
any member being disabled. Repeated enable/disable operations are idempotent.
Activation JSON entries retain unrelated fields and order. Malformed files and
stale, duplicate or mismatched activation references fail without being repaired
or overwritten implicitly.

Update uses the remembered source unless `--source <path>` is supplied; a missing
or inaccessible source requires an explicit replacement. Updates retain the
bundle ID and installation scope, may add/remove packs, and refresh versions in
every affected world's activation files. Shared bundles are checked across all
existing worlds; world-local bundles affect their owning world. Worlds where the
bundle is disabled stay disabled. Retained members keep individual activation
states where possible, and new members inherit the bundle's enabled state. If
every previously enabled member is removed, the updated bundle stays enabled.
New dependencies of enabled members are enabled recursively. Updates fail if
they would break another enabled pack's dependency or version requirement.

An existing unregistered pack can be adopted with `addon update <selector>
--source <path>`; its printed ID is retained and its source is remembered for later
updates. `--scope` narrows selection and does not relocate an existing bundle.
Bundles installed by this CLI have one scope/owner world; updates reject a
hand-edited registry bundle spanning multiple scopes/worlds rather than guessing
where to place new members.

Remove disables the entire bundle across affected worlds and deletes only its
owned pack directories and registry entry. Installed dependencies remain. An
enabled external dependent blocks removal. Malformed activation in any affected
world blocks the entire operation; local operations leave other worlds' activation
files untouched. Shared bundles can be updated or removed before any world exists.
All pack replacements/removals, registry writes and world reference changes share
one transaction: earlier worlds and old pack directories are restored if a later
write fails.

Export snapshots the installed member packs into a portable `.mcaddon` containing
one UUID-named `.mcpack` per member, each with its manifest at the archive root.
Manifest and asset bytes, including unknown manifest fields, are preserved. The
remembered source need not exist. Registered bundles retain all member packs;
unregistered packs export as standalone bundles. Selectors and `--scope`/`--world`
work as for update. Shared export also works before a world exists.

The output path is required and resolves against the working directory. Its
parent directory must exist. Export refuses existing files/directories, links,
and outputs inside installed packs or CLI metadata. The complete archive is
staged beside the output and published through an exclusive hard link, so a file
created during export is also preserved. The output filesystem must support hard
links; publication fails safely if it does not. Export uses the server mutation
lock and leaves pack files, registry and world activation unchanged. Temporary
files are cleaned up after handled failures. The archive obeys the same 1 GiB
compressed/expanded limits as import, including nested `.mcpack` bytes.

An exported bundle can be installed with `addon install <file>`. It includes
member content and membership, without server paths, bundle IDs, activation
history or external dependency packs. Reinstallation creates a new registration;
the normal install dependency and activation rules apply.

Folder sources reject symlinks/junctions and special files. Archives reject
traversal, absolute paths, nonportable names, symlinks, normalized/case-colliding
entries, and file/directory collisions. CRCs and local/central metadata must
match, including signed/unsigned streaming data descriptors. Nested archives are
decoded using indexed entry sizes so embedded ZIP headers remain ordinary content.
ZIP64, multi-disk, encrypted archives, unsupported ZIP flags and unindexed or
overlapping local records are explicitly unsupported.
At most four archive layers are accepted, including the outer archive; expanded
content across all layers is limited to 1 GiB. Compressed source input is also
capped at 1 GiB. Identity preflight inspects shared packs and packs in every world;
conflicting ownership or an unreadable/malformed existing pack blocks mutation.

Mutations stage pack files and JSON before committing under the server's
`.bedrock-server-manager/mutation.lock` directory. JSON files are replaced by
same-filesystem renames. Handled commit failures restore original JSON and remove
new packs; staging directories and locks are then cleaned up. If rollback itself
fails, backups and the lock are retained, and the error identifies the recovery
directory, including a journal mapping destinations to backups. Inspect that
state before manual recovery. A process crash can also
leave a lock/staging directory; locks are never reclaimed automatically. This is
a transaction protocol for cooperating CLI processes, not a sandbox against
another process changing the server files concurrently.

Registered bundles are persisted in `.bedrock-server-manager/registry.json` in the
server directory. The version-1 contract is:

```json
{
  "version": 1,
  "bundles": [
    {
      "id": "example-bundle",
      "name": "Example Bundle",
      "source": "/absolute/path/to/source.mcaddon",
      "packs": [
        {
          "uuid": "12345678-1234-1234-1234-123456789abc",
          "location": "behavior_packs/example"
        }
      ]
    }
  ]
}
```

Source paths must be absolute for the host OS; `null` represents an adopted pack
without a remembered source. Member locations use forward slashes relative to the
server, such as `worlds/My World/resource_packs/example`. IDs, locations and UUID
ownership are validated; malformed registries fail without being overwritten.
Packs without registration appear as standalone addons with deterministic IDs
beginning with `unregistered:`. Adopted bundles retain that printed ID even after
registration. Install refuses existing or registered UUID ownership; use update
to replace an addon.

Stop the server before changing packs. Pack changes take effect on the next
server start. This CLI does not manage server processes.

Development checks:

```sh
npm run build --workspace bedrock-server-manager
npm run typecheck --workspace bedrock-server-manager
npm run lint --workspace bedrock-server-manager
npm test --workspace bedrock-server-manager
npm run test:pack --workspace bedrock-server-manager
npm pack --workspace bedrock-server-manager --dry-run
npm run verify --workspace bedrock-server-manager
```

Tests use disposable directories and an explicit configuration override. They do
not read or mutate a real server. The package ships compiled `Distribution` files
and this README. It does not offer a public library API.

`verify` runs type checking, scoped lint, fixture tests (including a build), a
package dry run and the isolated packed-installation smoke test. It does not
publish, install globally, commit or push. The packed test builds its tarball in
a temporary directory, installs it with `--prefix` there, checks the exact shipped
file set and private package exports, and exercises both installed executable shims.

| Verification area | Fixtures |
| --- | --- |
| Commands and errors | Nested help for every addon command/alias and config get/set, version, missing arguments, unknown flags, invalid scope, missing server/world/selector, existing output. |
| Configuration | Windows/macOS/Linux locations, portable override, persistence/unset, unrelated settings, malformed-file preservation, explicit/saved/missing server precedence. |
| Inventory and JSON | Registered and standalone membership, scoped world selection, IDs/names/UUIDs and ambiguity, manifests, activation, diagnostics; list/show/validate parse as JSON, including validation exit 1. |
| Addon lifecycle | Paired and standalone folder/archive sources, default and deferred activation, recursive/cyclic dependencies, adoption, remembered/replacement updates, changes across worlds, removal, export/reinstall with exact asset bytes. |
| Safety | Traversal, links, duplicate identities/paths, nested depth, lowered deterministic byte ceilings, real expansion and CRC checks, descriptor/offset/header tampering, write failure rollback, retained recovery backups, held locks and exclusive export races. |
| Packed installation | Exact compiled files plus README/package metadata, both real bin shims, private library exports, config, JSON, cross-world updates, world-local installation, export/reinstall and failure codes. |

The host suite does not start Minecraft or prove behavior in a running Bedrock
server/client. Windows packed-shim verification and simulated platform path tests
do not replace execution on macOS/Linux. Byte-limit tests use reduced ceilings
rather than allocating 1 GiB fixtures. Crash recovery requires manual inspection
as described above; rollback tests cover handled failures.

For local release review, run `verify`, inspect the package dry-run file list,
then create a tarball with `npm pack --workspace bedrock-server-manager` and use
the local global-install command above if desired. Publication is a separate
manual action. Keep the server stopped for pack changes and restart it afterward
to load the installed content; the CLI does not start, stop or monitor the server.
