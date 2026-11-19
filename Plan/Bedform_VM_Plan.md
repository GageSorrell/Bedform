# Bedform virtual computers, shell and hybrid keyboard

## Purpose and delivery boundary

Add `bedform/VM`, a Bedform-managed virtual computer running inside the Bedrock script runtime. Provide durable per-machine storage/files/accounts, authenticated player sessions, permissions, bounded virtual processes/streams, a Bash-like interactive shell, basic core utilities and scoped game IO. Present the shell with Ink and feed it from a common spatial-key/DDUI/routed-chat input model.

This document is the planning deliverable of `MineCraft-w82n.4`, dated November 17, 2026. It specifies future behavior; it does not implement a runtime, create assets, select a qualified password algorithm, run native tests or establish client acceptance. Organization epic `MineCraft-w82n` embeds the agreed contract, `.1` records the audit, `.2` reconciles existing plans and `.3` supplies the [Ink/Window specification](Bedform_Terminal_Ink_Window_Plan.md). Nonclosed issue reconciliation, future implementation epics, exact dependency wiring and final parity validation remain `.5`, `.6`, `.7` and `.8` respectively. Preserve closed history and unrelated workspace changes. No deployment, commits, pushes or remote Dolt synchronization are authorized by this planning work.

This VM is an in-script virtual computer, not CPU emulation, a guest OS, Node subprocesses, native TTYs or a host filesystem. Commands operate on virtual files and registered bounded services. Scripts, loops, functions, command substitution, background jobs, compilers, code editors and arbitrary code execution are deferred. Ordinary data-file creation and text redirection remain supported. Neither shell syntax nor administrator status authorizes arbitrary Minecraft commands or access to the host.

## Service and module map

All imports are inert. Explicit construction/start operations receive qualified runtime/storage/display dependencies, host policy and error reporting. Public contracts must have typed errors and testable pure interfaces; native imports, persistence and rendering are confined to adapters. Use these public service modules under `bedform/VM`:

| Module | Responsibility | Boundary |
| --- | --- | --- |
| `Storage` | Versioned machine records, durable writes, revision checks, quotas and recovery | Stores VM data through canonical or explicit consumer storage; never host files |
| `FileSystem` | Machine-root paths, files/directories, metadata, read/write/list/copy/move/remove and stream adapters | Enforces file/account permissions on every operation |
| `Users` | Independent per-machine account IDs/usernames, password verification/change/reset and administration | No implicit global account database or Minecraft operator login |
| `Permissions` | Account roles, file grants and effective access checks | Keeps VM authority distinct from host-granted world capabilities |
| `Session` | Player-attached authentication, working directory/environment, editing/history, controller ownership and cancellation | Handles disconnect/logout/restart without merging users or trusting stale input |
| `Process` | Foreground virtual command/pipeline lifetimes, stdin/stdout/stderr, statuses, cancellation and work budgets | Executes registered handlers, not user code or host processes |
| `Shell` | Parsing, quoting/environment, command resolution, pipelines/redirection/chaining, editing/history/completion adapters | Uses Process/FileSystem/Permissions; Ink only presents the shell |
| `Coreutils` | Basic bounded commands and their option/compatibility registry | Consumes virtual files/streams and the current authority context |
| `IO` | Scoped read/write services for blocks, entities and players | Requires independently host-granted capabilities, including for VM admins |

The [canonical terminal plan](Bedform_Terminal_Canonical_Plan.md) owns display geometry, appearance, collision and restoration. The [Canvas/Intent plan](Bedform_IntentBubbles_Plan.md) assigns canonical display/VM entities and shared runtime/identity/ownership/persistence support to `bedform-canvas`; unrelated imperative DDUI/control assets remain in Common. The [React plan](Bedform_React3D_Plan.md) owns one `bedform/Spatial/React` port, hooks and JSX runtimes; remove DDUI JSX while retaining [imperative DDUI](Bedform_DDUI_TSX_Config_Init_MultiPart_Plan.md).

## Canonical machines and custom adapters

`bedform/Spatial/Terminal` exposes distinct canonical display and canonical VM constructors. Display-only creation starts no VM, Ink or React. The canonical VM construction path explicitly composes Canvas machine identity/ownership, the selected display, VM services and a session-aware shell presentation. Creation must not imply that the requesting player is already logged in or receives world capabilities. Imports create no machines or sessions.

Each canonical machine has a persistent entity-associated identity with a versioned owner and generation. The entity is the canonical machine association, not a temporary display/proxy ID. Reuse Canvas ownership/restoration instead of creating a competing machine registry. Duplicate creation must fail or resolve explicitly to the existing authorized machine; never silently create another filesystem or alias two machines onto the same storage. Replacing a transient rendering helper or changing the display does not change the machine identity. Moving/unloading a machine does not turn its account store into a different machine's data.

Bare `bedform/Spatial/Terminal/Display` remains a reusable frame/region/measurement/snapshot/input/lifecycle surface. Custom entity, display and storage adapters explicitly supply identity, storage revision/commit semantics, owner checks, loaded/unavailable state and cleanup responsibilities. Bind them without depending on canonical entity types or automatically adopting/deleting caller-owned entities. Custom machines still enforce account, file and capability boundaries; an adapter is not a bypass. Attaching another display changes presentation, not identity, account membership or authentication.

Validate all machine/display/storage inputs before committing creation. Record enough durable state to recover interrupted creation/deletion without duplicating machines. Rendering is transient and reconstructed from canonical data; applications/controllers/processes are transient. Disposing runtime handles releases owned subscriptions, streams, focus and helpers without deleting durable files. Permanent machine deletion is a separate explicitly authorized operation with durable deletion fencing; it must not be inferred from chunk unavailability, temporary entity lookup failure or ordinary display disposal. Preserve malformed/unknown data for recovery rather than overwriting it with defaults.

## Storage, persistence and restart

Machine data includes versioned filesystem contents/metadata, user verification records, file/account grants, settings and appropriate non-authenticating session metadata. Store account identity independently of mutable usernames so deletion/recreation or renaming cannot inherit stale grants accidentally. Accounts and paths are machine-scoped: the same username/path on two machines identifies independent data and credentials.

Use revisions and machine generations to fence concurrent/stale writes and late callbacks. Persist successful mutations before acknowledging durability. Acknowledgements distinguish durable changes from transient presentation/input updates; a successful screen update is not a disk commit. Bound record/chunk sizes and total bytes, validate quota limits before mutation and implement recoverable multi-record writes. Specify the adapter's atomic commit/journal boundary and exercise interruption at each stage. Cross-file commands and pipelines are not implicitly transactions; document any already-committed changes when later steps fail or are cancelled.

Unknown schemas, corrupt verification/filesystem records and partial recovery states must fail closed with actionable diagnostics while preserving source data. Provide explicit version migration/recovery with backups before persistent format/key changes; never change saved key text without migrating existing worlds after backup. Future code follows centralized frozen identifier records, generator headers and repository TSDoc/version conventions. No world migration is performed by saving this plan.

Persist preferences such as a valid working directory or environment only when explicitly part of the machine/session policy, with bounded validation and account association. Command history is account/session-scoped and bounded; persistence is an explicit policy, not a shared machine-wide feed. Never persist entered passwords, authentication tokens, active controller leases, pending forms/chat, modifier latches, queued input, executable closures or running command/pipeline state. Do not automatically replay history or commands.

On actual server restart, restore durable machine/files/users/settings through Canvas ownership/restoration, rebuild displays and start in a logged-out state. Require a new password login for every session; do not trust saved player/account metadata as authentication. All commands remain stopped. Chunk unload, disconnect, account revocation, lost runtime ownership and disposal cancel affected work and input; reappearance may restore durable data/presentation but does not automatically resume authority or execution. Restoring a standalone canonical display still creates no VM. Runtime-owned Windows remain outside automatic application restoration.

## Accounts, password entry and administration

Each machine maintains independent usernames/accounts and built-in password login, password change and authorized reset. Identify the player by stable player identity and the account by machine/account ID; a matching display name, operator flag, shared username on another machine or old session record is insufficient. Specify account-name normalization/validation, collision rules, length limits and rename/delete behavior before implementation; apply them consistently at every lookup.

The host-authorized owner bootstraps machine administration through an explicit private setup path. Do not ship shared/default passwords or grant the first nearby player administration. VM administration governs machine users/settings and authorized file operations; it is separate from Minecraft operator status and from host-granted world capabilities. Hosts decide who may bootstrap/reset administration and grant/revoke game IO; a VM admin cannot manufacture those grants. Owner recovery and authorized password reset must be auditable without logging secrets or exposing another user's verification record.

Credential handling requirements:

- Use a player-private imperative DDUI credential form for initial setup, login, password change and authorized reset. Qualify the chosen native control's confidentiality/masking and callback behavior on the target client before claiming private credential entry works. Do not substitute chat or shared terminal text if that control cannot meet the contract.
- Keep entered passwords out of terminal output, chat, logs, errors, command arguments/environment, command history, scrollback, snapshots and Transactional undo/redo history. Redact diagnostics and never echo secret characters into the world. Retain input only for the bounded verification operation, then release references; do not claim that JavaScript memory can be securely erased.
- Persist only versioned verification records backed by a vetted Bedrock-compatible implementation with pinned source/license, algorithm/parameters and qualified entropy/salt generation. Do not invent a password scheme, store plaintext/reversible credentials or silently substitute a weak implementation when host cryptographic facilities are missing. Selecting the implementation and demonstrating runtime support/test-vector correctness are explicit future feasibility gates, not completed by this specification.
- Bound password size, concurrent verifications and work per tick, with per-machine/player attempt controls and cancellable scheduling. Do not reduce verification strength silently to fit the tick budget. If a qualified implementation cannot meet both limits and the authentication contract, report the limitation and keep the auth gate open.
- Revalidate player, machine generation, account revision, setup/reset permission and pending request ownership when delayed forms or verification results return. Reject stale results after logout, disconnect, password change/reset, account deletion or machine disposal. Error paths must not leak verification data or accidentally grant a session.
- Password changes require current authentication/required credential checks; authorized resets use host/machine policy and revoke affected existing authority. Version/parameter migrations occur only through an explicit qualified path and preserve incompatible records until handled. A failed write leaves previous credentials usable and reports failure instead of pretending the password changed.

Publish a permissions matrix for account creation/listing, password self-change, authorized reset, role/grant management, logout/session inspection and machine settings. Include positive/negative tests for ordinary users, VM admins, host-authorized owners and Minecraft operators without VM grants. Command names for account management must be documented consistently; secret-bearing actions open private credential forms rather than accepting passwords as shell tokens.

## Filesystem permissions and paths

Each machine has its own virtual root. Support absolute and working-directory-relative paths, deterministic separator/name rules, `.`/`..` normalization and root containment. Reject NUL/invalid path data and any attempt to escape the machine root; no path can name a host drive, network share, other machine or arbitrary native storage key. Define Unicode/case normalization once in the filesystem contract and test aliases/collisions. File data is ordinary bounded virtual content, never implicitly executable source.

Provide files/directories with identity, ownership/grants, size and revision metadata. Enforce directory search/traversal and listing separately from file read/write; creating/removing/renaming entries requires the applicable parent-directory authority. Copy/move/overwrite operations validate both source and destination permissions; permission changes require separate grant-management authority. Specify safe defaults for newly created files/directories and explicit admin policy; do not infer world IO rights from any file role. Completion, listing, metadata reads and error details must respect access rather than revealing inaccessible names/content.

Authorize through a current machine/account/session context for API calls and coreutils, including open handles and queued stream operations. Revocation/password reset invalidates stale authority; checks cannot exist only in the shell parser. Normalize and resolve paths under the same revision/identity rules used at commit so a rename/replacement race cannot redirect an authorized operation to another object. Symlinks, mounts or other path indirection are not implied by this initial filesystem and must not become an unreviewed escape route.

Reads/writes/listing are bounded and streamable. Validate quotas, types and destination policy before destructive writes; document create/truncate/append/overwrite semantics. A failed atomic write preserves prior content; recoverable multi-record updates retain enough journal information to distinguish committed from incomplete data. Cancellation stops future work but does not promise rollback of previously committed chunks or separate commands. Recursive/bulk operations check every visited object, bound traversal and report partial completion/errors accurately.

## Host-granted game IO capabilities

`bedform/VM/IO` offers typed, scoped read/write operations on blocks, entities and players. Treat each operation family and scope as an independent host grant: allowed dimensions/regions or targets, read versus write, permitted properties/actions, budgets and expiration/revocation where applicable. Reject absent, incompatible, expired or revoked grants. Default exposure includes no unrestricted Minecraft command execution and no arbitrary server/operator bridge.

Effective authority is the intersection of current machine identity/owner policy, authenticated account/session permissions and current host-granted capabilities. VM admin, Minecraft operator status, shell environment, file contents and event payloads cannot broaden it. Capability checks occur at execution time for API calls and every queued/bulk operation, not only when parsing a command. Revalidate current dimensions, target identity, loaded state and scope before native access; target disappearance/replacement/unload yields a bounded typed failure rather than falling back to another target or force-loading the world.

Processes receive only the scoped service interfaces they need. Cancellation/revocation prevents new operations; report already-completed world effects without claiming transactionality across Minecraft changes. Log operation status/denial with appropriate scoped identifiers, without secrets or cross-user private content. If a host deliberately enables an additional command adapter, it is a separately explicit scoped integration with tests; it is not an initial escape hatch around the IO contract.

## Virtual processes, streams and work budgets

`Process` runs registered command handlers inside the script runtime with a fixed authority context, virtual working directory/environment, stdin/stdout/stderr and cancellation. It does not evaluate supplied JavaScript, spawn Node/native programs, open host files or run a guest OS. Registration is a trusted host/add-on API, not a shell command to load arbitrary files. Every handler must use the same FileSystem/Permissions/IO boundaries as coreutils.

Specify virtual stream chunk/encoding rules, ordered delivery, end-of-input, separate stdout/stderr, errors, close ownership, bounded queues and backpressure. A slow consumer must cause producers to yield or receive an explicit bounded failure, never unbounded allocation or silent success. Pipeline stages may make cooperative progress while connected, but no stage becomes a background job. Cancellation propagates to all stages and closes/releases owned streams without closing unrelated borrowed streams.

Bound per-machine/per-session process count, pipeline length, input/parse depth and size, output bytes/scrollback, traversal/sort/pattern work, buffers, storage quotas and native IO calls. Use a fair cooperative tick scheduler and cancellation checks between bounded units. Document that user-supplied synchronous handlers cannot be preempted; only vetted bounded handlers are part of the built-in contract. Apply limits to authentication/completion/keyboard work as well as command execution. Report capacity failures and exit statuses consistently, and isolate errors from unrelated machines/sessions.

On completion, expose a final exit status and close output after already-accepted bounded writes drain or report failure. Unknown commands, parse failures, permission denials, IO failures and cancellation produce distinct documented failures/statuses. Late completion/output cannot mutate a successor process/session/display after a generation change. Disposal attempts all resource cleanup even if one cleanup operation fails.

## Bash-like interactive shell

`bedform/VM/Shell` owns parsing and execution; `bedform/Spatial/Terminal/Ink/Components/Shell` presents it using reusable Input and Scrollback. Both use the single shared Spatial React/Ink port. Shell parsing is independent of rendering and testable without a native display. It operates on virtual files/streams, never host process state.

The supported language and behavior must be documented as an intentional Bash-like subset, not general Bash compatibility:

- Edit a command buffer with insertion/deletion/navigation, bounded per-session history, history recall and context-aware completion. Completion sees only authorized commands/names/paths; rejected or cancelled credential entry never becomes a history item. Keep a draft distinct from a submitted command.
- Tokenize whitespace, single/double quotes and escapes, preserving empty quoted arguments and Unicode. Single quotes suppress variable expansion; double quotes permit the documented environment expansion and escapes. Unclosed quotes/invalid syntax return a parse error without executing a partial command.
- Support environment variables with documented `$NAME`/`${NAME}` expansion and session-local assignment/management. Keep working directory, environment and last exit status session-scoped; no access to host environment/secrets. Define expansion and tokenization order explicitly, including missing variables and quoting. Do not silently introduce command substitution, globbing, expression evaluation or executable code through expansion; document any unsupported expansion rather than approximating full Bash.
- Support foreground command pipelines with `|`, ordered virtual stdin/stdout/stderr, file input `<`, output creation/truncation `>`, append `>>`, stderr file redirection `2>`/`2>>`, and corresponding explicit stdout forms. If stream descriptor duplication such as `2>&1` is provided, define/test left-to-right descriptor semantics; unsupported descriptor syntax rejects before execution. File redirects use FileSystem permissions/quotas and never become host paths.
- Support `;` sequencing, `&&` execute-on-success and `||` execute-on-failure. Pipelines bind before conditional chains; `&&`/`||` share left-associative precedence and `;` separates those chains. A pipeline's default exit status is its last stage's status; cancellation/failure must unblock all affected stages. Retain each stage's result for diagnostics without leaking another session's data.
- Parse and validate the complete input syntax before beginning execution. Resolve runtime paths/authority when each operation executes; earlier commands may legitimately change state. Define redirect setup/order/failure semantics and document effects already committed before a later failure. Do not falsely promise transactionality for a whole command line.
- Defer scripts, loops, functions, command substitution, background jobs, compilers, code editors and arbitrary code execution. Reject their recognizable unsupported syntax before it can partially run. This does not prohibit creating ordinary data files, copying text or using redirection.

Test quoted operators versus actual operators, mixed quote/escape/variable cases, empty arguments, malformed syntax, precedence, status propagation, piped input/output, redirection failure, cancellation and bounded work. Publish the supported option/expansion/compatibility matrix before claiming shell completion. Preserve agreed features rather than treating the word subset as permission to omit pipelines, redirection, completion or conditional chaining.

## Basic core utilities and account/session commands

Provide the following utilities using virtual files, streams and the current authority context. Publish accepted flags, operand/error handling, deterministic ordering/encoding/newline rules and exit statuses; unsupported options fail explicitly instead of being ignored. Ordinary text creation through `touch`, `echo`, `printf` and redirects is included.

| Utility | Basic behavior and boundaries |
| --- | --- |
| `pwd`, `cd` | Read/change this session's virtual working directory; validate traversal permissions and directory existence |
| `ls` | List authorized virtual directory entries with bounded traversal and stable output order |
| `mkdir`, `rmdir` | Create directories and remove empty directories under current parent-directory permissions |
| `touch` | Create an empty file when permitted or update its documented metadata without truncating existing data |
| `cat` | Stream virtual file operands or stdin to stdout with ordered bounded reads |
| `cp`, `mv`, `rm` | Copy, move/rename and remove virtual entries with explicit overwrite/recursive policy, per-entry authorization and partial-work reporting |
| `echo`, `printf` | Emit literal/formatted text to stdout using a documented bounded format/escape subset, without evaluating input as code |
| `head`, `tail` | Emit a bounded selected prefix/suffix of lines or documented byte mode from virtual files/stdin |
| `wc` | Count documented lines/words/bytes/characters with streaming bounds and clear Unicode/encoding semantics |
| `sort` | Order text deterministically within configured memory/work limits; fail explicitly if limits prevent the requested operation |
| `uniq` | Filter/count adjacent matching lines using documented options, without claiming an implicit sort |
| `grep` | Filter virtual text input with a documented literal/pattern subset, bounded matching and explicit invalid/unsupported-pattern errors |

Account/session/permission commands must expose login/logout, current account/session inspection, password change and authorized reset, user administration and file/account grant inspection/changes. Choose consistent public command names during the service API deliverable, embed the resulting command/permission matrix in implementation tracking and test every required operation. Password actions use private DDUI, not shell password arguments. Include environment management through the documented shell interface. Ordinary users can inspect/manage only the authority they are granted; VM administration never bypasses host capability limits.

Pattern matching and sorting must have demonstrated execution bounds, including adversarial input. Do not assume an arbitrary regular expression, recursive traversal or in-memory sort is safe merely because output length is limited. Helpers and commands share quotas, cancellation, error/status and permission behavior; no utility can bypass them by directly reading a persistence key or native world object.

## Authenticated sessions and shared display control

Create separate player-attached authenticated sessions bound to machine, stable player/account IDs, machine/account revisions and a transient session generation. Each has its own working directory/environment, draft, history policy, completion state and command context. One active input controller owns a displayed terminal at a time. Acquiring/transferring that controller revalidates authorization and updates routing atomically; it does not merge accounts, drafts, history or process authority. A viewer is not automatically a controller or logged-in user.

Shared display output is visible to the display's audience. Distinct authenticated sessions do not make that output private. Route personal prompts/credentials through private imperative forms; do not render a secret on a shared display and rely on account separation to hide it. Define how the active session's output and previously rendered scrollback are presented on controller transfer; do not expose another session's private buffers by default. Already-visible shared output cannot be made unseen by transferring control.

Revalidate authority on every command/input action and delayed completion. Logout, disconnect, account revocation, machine unload/disposal or loss of controller/focus cancels affected pending input, resets latches and releases routing. Foreground work is cancelled when its session/controller authority is lost; no hidden background continuation is implied. Do not let an old form response, queued chat message or pipeline callback execute as the next controller. Retry/reconnect must reacquire the appropriate authority; a restart always requires fresh login.

## Common input model and hybrid keyboard

One normalized input model feeds Ink input/focus and VM shell editing from all sources. Events carry source, player/session/controller and target lifetime identity, a semantic action/key, text when applicable and modifier state. Keep text insertion, key activation, command submission and cancellation distinct. Validate supported Unicode, control characters, payload size and target ownership before accepting an event. Source adapters do not implement independent competing shell editors.

### DDUI text and explicitly routed chat

Both paths are required:

- A simple player-private imperative DDUI text entry form supports explicit insertion into the current draft versus submission through the common model. Cancellation leaves the draft/command state unchanged. Associate each pending form with the requesting machine/session/controller generation, and reject stale callbacks after focus/controller/session loss. Ordinary text entry does not double as a password route.
- Explicitly routed chat uses a deliberate active route or command/prefix tied to the current machine/session/controller; define the selected routing mechanism in implementation and expose it clearly to the player. Ordinary chat is not globally captured. Separate insert and submit intent so receiving a string is not automatically an execution request. Validate routing and ownership again when delayed chat events are delivered; deactivate the route on logout/disconnect/focus loss/disposal. Passwords are never accepted via chat.

Input from any source observes the same editing/history/completion policy and capacity limits. An explicitly submitted command runs once; duplicate/stale callbacks must not execute it twice. Host/native routing limitations are qualification gates to report, not grounds to silently drop either path.

### Spatial keys, modifiers and latch lifecycle

The spatial keyboard includes ordinary text/punctuation and Ctrl, Shift, Alt, Super, arrows, Home, End, Page Up, Page Down, Insert, Delete, Backspace, Enter, Tab, Escape, function keys and related controls. Define stable semantic identifiers and a visible key layout rather than mapping everything to plain text. Enter submits or inserts a newline only where the active input contract allows; Tab performs completion/traversal according to focus, Escape cancels the active transient action, arrows/Home/End edit/navigate and Page keys operate the active viewport/history as documented. Insert/Delete/Backspace and modifier combinations retain explicit editing semantics. Specify supported function-key bindings and show unbound/unsupported actions without inventing host OS effects.

Tapping Ctrl, Shift, Alt or Super latches that modifier for the next non-modifier key. Multiple modifiers can combine; tapping a latched modifier again clears it. Show each latch's state and consume the active combination on the next accepted key action, with documented text-case/punctuation behavior. Rejected/unauthorized events cannot transfer a latch to another player/session. Reset all latches on focus/session/controller loss, logout, disconnect, machine/root disposal or keyboard replacement.

Activation-only native interactions produce logical activations, not fabricated physical key-down/key-up/release events or claims that a key is physically held. A genuinely release-capable source may report its own lifecycle through the qualified adapter, scoped to the same model; it cannot fabricate releases for other sources. Do not assume native mouse/controller/touch input reports physical keyboard modifiers. Test visible feedback, combinations, one-key consumption, explicit clearing and reset separately for each qualified source.

Key bindings such as Ctrl+C cancellation and navigation/editing combinations must be documented and tested against active focus/session ownership. Cancellation terminates the scoped process/input action, never the server or unrelated sessions. Focus changes invalidate pending key/form/chat work and reset state before another target accepts input.

## Existing prerequisites and future issue responsibilities

This table identifies reusable deliverables and boundaries, not completion. `MineCraft-w82n.5` reconciled existing owners, `.6` created the open VM runtime epic/children and `.7` wires their acyclic child-level dependencies. The actual-ID edge tables below match Beads.

| Existing work | Reuse | Dependency boundary |
| --- | --- | --- |
| `MineCraft-zcmm.1`, `MineCraft-9rdk.10/.11` | Canvas artifact, canonical ownership/identity/restoration and explicit display integration | Extend shared ownership for canonical machines; Intent session arbitration is not VM persistence |
| `MineCraft-9rdk.1-.9` | Values, collision probe, glyphs, measurements, bare Display, themes and React-independent frame | Preserve canonical defaults; display-only delivery never depends on VM or shell |
| `MineCraft-ty2k.1-.4/.16` | Single shared React port/root/compatibility/publication foundations | Use the bounded API/root children already reconciled in w82n.5; do not wait for the entire widget catalogue |
| `MineCraft-ty2k.9/.10/.30`, `MineCraft-9rdk.5/.6` | Glyph inventory, metrics, white particle textures and frame/region helpers | Reuse one source; VM owns no duplicate font/frame implementation |
| `MineCraft-ty2k.13-.15` | Applicable targeting/access/activation primitives | Add explicit session/controller routing; generic pointer admission is not authentication |
| `MineCraft-9rdk.12`, `MineCraft-fwox`, `MineCraft-53dn` | Preserved imperative forms/navigation/lifecycle and DDUI JSX removal | Password forms bypass Transactional history; native credential privacy still needs qualification |
| `MineCraft-zcmm.6/.7`, `MineCraft-ty2k.7`, `MineCraft-9rdk.14` | Shared image/compiler/Canvas bundling and packed-consumer patterns | Use general bundling in zcmm.7, already independent of Intent completion |
| `MineCraft-9rdk.15/.16`, `MineCraft-ty2k.17/.18` | Fixed-path BDS and separate real-client fixture patterns | New VM security/session/restart/input behavior needs its own evidence |
| Closed `MineCraft-5jg` including `.3.1`, `MineCraft-4osy` | Shared config/script-only build and archive/dependency/consumer foundations | Reuse without reopening or rewriting closed history |
| `MineCraft-w82n.3` specification and future Ink implementation | Qualified virtual streams, portable layout, Input/Scrollback and Shell presentation | VM services can develop independently; end-to-end shell delivery requires services plus Ink |

The superseded `MineCraft-2k9d` renderer and DDUI JSX are not prerequisites. Window is an independent runtime application facility; neither the VM service layer nor canonical display creation requires its completion. Adaptive anchors, Nerd Fonts, the full spatial widget catalogue and complete Intent artwork are separate features. The sidecar Workflow architecture is not an assumed host-backed VM storage/process implementation.

Future tracking must separate the following work and acceptance gates rather than close an entire VM epic when its plan is saved:

| Future deliverable | Implementation and explicit acceptance |
| --- | --- |
| Service contracts and canonical/custom integration | Module exports, authority/error contexts, distinct display/VM construction, adapters, identity/ownership and resource lifecycle with host/type tests |
| Storage/filesystem | Durable schemas, recoverable commit boundaries, quotas, path normalization, permission enforcement and failure/revision/migration fixtures |
| Users/password feasibility and management | Vetted pinned implementation/entropy/runtime qualification, private native credential entry, bootstrap/change/reset/revocation and redaction tests; unqualified crypto/privacy stays open |
| Permissions and game IO | Account/file matrix, host grant scopes, execution-time checks, revocation/target races and bounded native side-effect tests |
| Sessions/processes/streams | Separate player/session state, controller leases, statuses, cancellation/backpressure/fair scheduling and no restart execution/auth restoration |
| Shell/coreutils | Complete supported grammar/option matrix, required utilities/account commands, parser/pipeline/redirection/permission/adversarial-limit host tests |
| Hybrid keyboard/text routing | Spatial key/modifier layout, common model, both DDUI and explicit chat insertion/submission, delayed ownership checks and focus cleanup |
| Ink shell integration | Bind services to qualified Ink Input/Scrollback/Shell, preserving display appearance and public/shared versus private output boundaries |
| Packaging and independent consumers | Inert exports, declarations, pure/native boundaries, Canvas inclusion/dedup/conflicts, deterministic artifacts and offline installed tests |
| Native BDS qualification | Actual storage/credential/native IO/input lifecycle and two-process restart fixtures, logs, artifact/engine identity and clean shutdown |
| Real-client acceptance | Private credential entry, spatial keys/latches, DDUI/chat, Ink rendering/frames, shared output, multiplayer isolation and logout/restart/disposal observations |

Order Canvas/value/display and shared build foundations first. Develop bounded VM storage/services and their pure tests independently of presentation; add qualified authentication/permissions/session/process/IO deliverables on their actual prerequisites. Shared React and portable Ink precede the integrated shell presentation, which requires both Ink and VM services. Keep all edges at the deliverable level and avoid reciprocal epic-wide blockers. Existing native/client evidence establishes neither new VM implementation nor password/input security.

## Validation and acceptance

### Host, types and packed consumers

- Test machine-scoped identity/files/users with identical usernames/paths across machines, duplicate creation, custom adapters, borrowed-resource cleanup, stale generations, malformed records and unknown versions. Interrupt creation/write/rename/delete/migration at each durable boundary; verify acknowledgement semantics and preservation/recovery of prior data.
- Exercise absolute/relative/path normalization, root escapes, alias/case/Unicode rules, directory traversal/listing and file read/write/grant checks through direct APIs and every relevant utility. Cover creation/overwrite/truncate/append, quota exhaustion, recursive limits, revocation races, copy/move source/destination checks and cancellation with partial-work reporting.
- Use known-answer test vectors and pinned-source reproducibility for the selected password implementation, plus qualified entropy/parameter migration and tick-budget tests. Cover private credential request ownership, failed writes, concurrent login/change/reset, invalidation on revocation/logout/disconnect, owner bootstrap and operators without VM authority. Assert no secrets in logs/output/history/snapshots/Transactionals; do not mistake type tests for native credential confidentiality.
- Check capability-denial/default behavior, dimension/region/target/read/write restrictions, revocation after parsing, unloaded/replaced targets and direct-API bypass attempts. VM administrator/operator labels must not bypass the effective-authority intersection. Track completed world effects separately from cancelled future work.
- Verify parser tokenization, quoting/escapes/empty arguments, environment management, precedence/statuses, conditional short-circuiting, pipelines/redirections and unknown/deferred syntax with no partial parse execution. Test every required utility and account/session/permission operation, malformed/unsupported options, bounded patterns/sorts/traversal and foreground cancellation/backpressure/fairness.
- Test session separation, drafts/history/environment, one controller per display, transfer without merged authority, shared-output visibility semantics and no private-buffer leakage. Normalize spatial/DDUI/chat inputs through one model; exercise insert versus submit, cancellation, duplicates, delayed callbacks, all modifier/navigation/edit/function keys, latch/reset and lack of fabricated release events.
- Independently install packed packages offline with lifecycle scripts disabled. Verify required VM subpaths/types, inert imports, no Node/native TTY/host filesystem dependencies, correct Canvas feature inclusion/dedup/conflicts and source/generated/artifact freshness. Bare Display consumers start no VM/React/Ink. Run Bedform full verification and affected Canvas/add-on lint/type/asset/reproducible-build checks in the future implementation task.

### Fixed-path BDS and real restart

Use isolated add-on runners at fixed `dist/bds-runtime/bedrock_server.exe` paths. Preserve production worlds and unrelated servers; ordinary tests do not elevate or silently change firewall rules. Record engine/build/API versions, exact commands, artifact hashes, fixture configuration, logs and clean shutdown.

Exercise actual machine persistence, native credential form/control behavior and qualified password runtime, block/entity/player IO grant enforcement, routed input lifecycle, controller changes, disconnect/logout/unload/disposal, cancellation and resource cleanup. Prove no unintended command execution, world access or orphan helpers. Make native feasibility failures explicit rather than bypassing restrictions to obtain a passing test.

A genuine two-process saved-world fixture must retain machine identity, files, users, verification records, permissions and settings; retain only permitted non-authenticating metadata; require login again; keep old commands/pipelines stopped; reject stale form/chat/process work; and rebuild canonical presentation without duplicating machine records. A standalone display restores without starting a VM; Windows/Ink applications are not automatically restored. In-process mocks are not restart evidence.

### Separate real-client acceptance

Record client versions, final artifact identity, observations and available captures. Observe private credential entry/setup/change/reset without secret echo, error/log/history leakage or another viewer gaining access. Verify spatial keys and visible modifier latches/combinations/reset with mouse/controller/touch as supported, navigation/edit/function keys, DDUI insertion versus submission/cancellation, explicit chat routing and ordinary chat remaining unaffected. Test stale submission after controller/session loss and actual disconnect/logout/disposal.

Use two players on the same and different machines, including identical local usernames, to verify independent accounts/drafts/history, one input controller, shared output visibility, private prompt isolation and no automatic login after restart. Observe Ink prompt/scrollback/resize, canonical light/dark glyph/particle alignment and tint, brightness, framing/rear/extrusion/collision behavior and restart restoration against the existing display specification. Shared screen visibility is not proof that credentials are private, and native audience assertions alone do not establish client appearance or confidentiality.

Keep unobserved cases open in the future implementation tracking and file defects in Beads. Saving specifications, creating issues, mock tests or historical demo observations do not complete runtime, native or client acceptance.

## Existing issue reconciliation recorded by MineCraft-w82n.5

Existing nonclosed prerequisites now have explicit single owners: custom glyph catalogue/generation `ty2k.9`, native metrics `ty2k.10`, ordinary-font particle coverage `9rdk.5`, pure frames/Display `9rdk.6/.7`, shared frame `9rdk.9`, canonical identity/persistence `9rdk.10`, imperative particle helpers `ty2k.8`, Canvas.Images `zcmm.6`, general Canvas bundling `zcmm.7`, shared React/API/JSX publication `ty2k.2` and Spatial React build integration `ty2k.7`. DDUI removal/migration remains open in `9rdk.12`; imperative forms/MessageBox/Checklist are `l89.3/.4/.6`. `ty2k.27` no longer depends on the superseded emulator. Earlier audit references describe the pre-reconciliation graph. Runtime epic/child creation is recorded by `w82n.6`; `w82n.7` now records their required child dependencies. No runtime or acceptance work is completed by reconciliation.

## Open runtime implementation tracking (MineCraft-w82n.6)

Created November 18, 2026 by `MineCraft-w82n.6`: three separate top-level future runtime epics, 42 implementation/packaging/native/client children, all open. These are separate from the planning-only w82n parent. Hierarchy and the listed child-level blocking prerequisites are recorded. `MineCraft-w82n.7` wires these edges and publishes coordinated ordering; `.8` owns final coverage/parity validation. Creation is not implementation, native feasibility or real-client acceptance.

| Runtime epic | Responsibility | Children |
| --- | --- | --- |
| `MineCraft-3w2z` | Own optional upstream Ink adaptation, qualified portable layout, Display host, renderer-facing virtual IO/input/focus, supported components/hooks and Input/Scrollback/view-only Shell. Reuse shared React and existing Canvas/display assets. VM owns actual accounts/process/parser/services and real Shell binding. Standalone Ink does not wait for VM or Window. | 12 open |
| `MineCraft-glcb` | Own independent roots/handles, shared-frame binding, external stores/useSyncExternalStore, typed directional events, audience/focus/error isolation and disposal/explicit consumer reconstruction. Reuse shared React/Canvas geometry; no Ink/VM or automatic persistence requirement. | 10 open |
| `MineCraft-q4r0` | Own VM service contracts, per-machine durable data/accounts/permissions, qualified credential handling, scoped world IO, processes/streams/parser/coreutils, authenticated input/session binding, actual hybrid keyboard/text adapters, Ink shell integration and canonical VM constructor/restoration. Shared display/React/Ink components and Canvas identity/frames remain with their existing owners. | 20 open |

### VM descendants — `MineCraft-q4r0`

| Issue | Deliverable | Blocking prerequisites (current Beads edges) |
| --- | --- | --- |
| `MineCraft-q4r0.1` | Define VM service contexts, machine bindings and custom adapter contracts | None |
| `MineCraft-q4r0.2` | Implement durable versioned machine Storage and recovery | `MineCraft-q4r0.1` |
| `MineCraft-q4r0.3` | Implement virtual FileSystem paths, metadata and bounded file operations | `MineCraft-q4r0.2`; `MineCraft-q4r0.4` |
| `MineCraft-q4r0.4` | Implement VM account and filesystem Permissions | `MineCraft-q4r0.1` |
| `MineCraft-q4r0.5` | Qualify vetted password verification, entropy and private credential feasibility | `MineCraft-q4r0.1`; `MineCraft-l89.3` |
| `MineCraft-q4r0.6` | Implement per-machine Users, password lifecycle and authorized administration | `MineCraft-q4r0.2`; `MineCraft-q4r0.4`; `MineCraft-q4r0.5` |
| `MineCraft-q4r0.7` | Implement authenticated player Sessions and display controller leases | `MineCraft-q4r0.2`; `MineCraft-q4r0.4`; `MineCraft-q4r0.6` |
| `MineCraft-q4r0.8` | Implement virtual Process execution, pipeline streams and fair work budgets | `MineCraft-q4r0.1`; `MineCraft-q4r0.4` |
| `MineCraft-q4r0.9` | Implement scoped host-granted block, entity and player IO | `MineCraft-q4r0.1`; `MineCraft-q4r0.4`; `MineCraft-q4r0.7`; `MineCraft-q4r0.8` |
| `MineCraft-q4r0.10` | Implement Bash-like Shell parser, environment and foreground execution | `MineCraft-q4r0.3`; `MineCraft-q4r0.7`; `MineCraft-q4r0.8` |
| `MineCraft-q4r0.11` | Implement all required bounded virtual core utilities | `MineCraft-q4r0.3`; `MineCraft-q4r0.8`; `MineCraft-q4r0.10` |
| `MineCraft-q4r0.12` | Implement account, session and permission shell commands | `MineCraft-q4r0.4`; `MineCraft-q4r0.6`; `MineCraft-q4r0.7`; `MineCraft-q4r0.10` |
| `MineCraft-q4r0.13` | Bind normalized Ink input to authenticated VM controller authority | `MineCraft-q4r0.7`; `MineCraft-3w2z.5`; `MineCraft-9rdk.7` |
| `MineCraft-q4r0.14` | Implement spatial keyboard keys, modifier latches and visible feedback | `MineCraft-q4r0.13`; `MineCraft-ty2k.8`; `MineCraft-ty2k.13`; `MineCraft-ty2k.15` |
| `MineCraft-q4r0.15` | Implement BOTH private DDUI text entry and explicit chat routing | `MineCraft-q4r0.13`; `MineCraft-l89.3`; `MineCraft-fwox.3` |
| `MineCraft-q4r0.16` | Integrate actual VM shell services with Ink Shell presentation | `MineCraft-q4r0.11`; `MineCraft-q4r0.12`; `MineCraft-q4r0.13`; `MineCraft-q4r0.14`; `MineCraft-q4r0.15`; `MineCraft-3w2z.12`; `MineCraft-3w2z.9` |
| `MineCraft-q4r0.17` | Implement canonical VM construction, custom binding and logged-out restoration | `MineCraft-q4r0.2`; `MineCraft-q4r0.3`; `MineCraft-q4r0.6`; `MineCraft-q4r0.7`; `MineCraft-q4r0.9`; `MineCraft-q4r0.16`; `MineCraft-9rdk.10`; `MineCraft-9rdk.11` |
| `MineCraft-q4r0.18` | Qualify VM host/security contracts and offline packed consumers | `MineCraft-q4r0.17`; `MineCraft-zcmm.7`; `MineCraft-9rdk.14` |
| `MineCraft-q4r0.19` | Qualify VM native security, hybrid input and real two-process restart | `MineCraft-q4r0.18`; `MineCraft-3w2z.10`; `MineCraft-q4r0.5` |
| `MineCraft-q4r0.20` | Accept VM credentials, hybrid keyboard and multiplayer restoration on real clients | `MineCraft-q4r0.19`; `MineCraft-3w2z.11` |

Shared Ink rendering/component ownership and Window tasks are recorded in the [Ink/Window mapping](Bedform_Terminal_Ink_Window_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6). Renderer-facing virtual stream adapters are `MineCraft-3w2z.4`; core VM process/pipeline stream execution is `MineCraft-q4r0.8`. Shared input/focus semantics are `MineCraft-3w2z.5`; the VM tasks bind authority/native adapters without another decoder/editor. Shell view-only composition is `MineCraft-3w2z.12`; actual service binding is `MineCraft-q4r0.16`. Canonical identity support remains `MineCraft-9rdk.10`; this VM epic composes it rather than creating a second registry.

## Coordinated implementation order (MineCraft-w82n.7)

The child-level blocking edges and tables below are wired in Beads as of November 18, 2026. Parent epics are cross-referenced with nonblocking `relates_to` links; they are not prerequisites. Hierarchy, a see-also link and a blocking dependency have distinct meanings. All runtime/native/client work remains open; this is a graph/document planning delivery.

| Delivery branch | Order and independent work |
| --- | --- |
| Existing foundations | Canvas scaffold `zcmm.1`, values `9rdk.1/.2/.3`, custom glyph inventory/metrics `ty2k.9/.10`, pure frames/Display `9rdk.6/.7`, ordinary particle expansion `9rdk.5`, particle-only dark mode `9rdk.8`, shared frame `9rdk.9`, canonical ownership/display `9rdk.10/.11` and independent Canvas bundling `zcmm.7` retain their sole owners. Display delivery does not wait for new VM, Ink, Window or the full spatial widget catalogue. |
| Early parallel investigations/contracts | Ink source pinning `3w2z.1`, pure Window store `glcb.3` and pure VM contracts `q4r0.1` have no blockers. Portable layout feasibility `3w2z.2` waits only for source pinning. These do not claim implemented React/native identity behavior; runtime integration has the required downstream gates. |
| Shared React and host integration | Existing `ty2k.1/.2/.3/.4` supply the single port/API/compatibility/root contract; `ty2k.7` supplies TSX build integration. Bare particle helpers `ty2k.8` remain independent of full widget artwork. Ink host `3w2z.3` waits for source/layout, Display/metrics and shared roots; Window root `glcb.1` waits for shared React and its pure store. |
| Independent Ink and Window deliveries | Ink stream/focus adapters, Input/Scrollback/upstream compatibility/view-only Shell precede its packaging, native and separate real-client gates. Window frame/store bridge/events/audience/lifetime work precedes its packaging/native/two-client gates. Neither new branch waits for the other or for VM services. |
| Independent VM services | From pure contracts, implement durable storage, permissions, filesystem, qualified password feasibility/Users, sessions and bounded process/pipeline streams, then scoped game IO, shell/parser/coreutils and account commands on their actual child prerequisites. Shared Canvas native identity is required for final canonical integration, not for initial service contracts. |
| Integrated VM shell and hybrid input | Authenticated input binding `q4r0.13` consumes common input `3w2z.5`; spatial keys `q4r0.14` and BOTH DDUI/chat sources `q4r0.15` follow. Actual service-to-Ink shell binding `q4r0.16` requires parser/utilities/accounts/input and qualified Ink package/view-only Shell, not a whole Ink epic. Canonical VM integration `q4r0.17` additionally requires existing canonical ownership/display and scoped IO. |
| Per-feature qualification | Each family retains host/type/offline package gates before actual fixed-path native and distinct real-client acceptance. VM native/restart `q4r0.19` consumes its package gate plus qualified Ink native; VM client `q4r0.20` consumes actual VM native and Ink client behavior. No prior demo or planning result closes these gates. |

Branches can progress in parallel once their concrete prerequisites are complete. The following waves are a valid topology of all open transitive prerequisites of the 42 new runtime children, not a requirement to serialize independent siblings or unrelated repository work. Closed prerequisites retain their existing evidence/history.

| Wave | Open deliverables permitted after earlier waves |
| --- | --- |
| 1 | `MineCraft-3w2z.1`, `MineCraft-9rdk.1`, `MineCraft-9rdk.2`, `MineCraft-9rdk.4`, `MineCraft-fwox.1`, `MineCraft-glcb.3`, `MineCraft-q4r0.1`, `MineCraft-ty2k.1`, `MineCraft-ty2k.10`, `MineCraft-zcmm.1` |
| 2 | `MineCraft-3w2z.2`, `MineCraft-3w2z.4`, `MineCraft-9rdk.3`, `MineCraft-fwox.2`, `MineCraft-l89.3`, `MineCraft-q4r0.2`, `MineCraft-q4r0.4`, `MineCraft-ty2k.2`, `MineCraft-ty2k.6`, `MineCraft-ty2k.8`, `MineCraft-ty2k.9`, `MineCraft-zcmm.6`, `MineCraft-zcmm.7` |
| 3 | `MineCraft-9rdk.5`, `MineCraft-9rdk.6`, `MineCraft-fwox.3`, `MineCraft-q4r0.3`, `MineCraft-q4r0.5`, `MineCraft-q4r0.8`, `MineCraft-ty2k.3`, `MineCraft-ty2k.4`, `MineCraft-ty2k.7` |
| 4 | `MineCraft-9rdk.10`, `MineCraft-9rdk.7`, `MineCraft-glcb.1`, `MineCraft-glcb.4`, `MineCraft-q4r0.6`, `MineCraft-ty2k.5` |
| 5 | `MineCraft-3w2z.3`, `MineCraft-3w2z.5`, `MineCraft-9rdk.8`, `MineCraft-9rdk.9`, `MineCraft-glcb.5`, `MineCraft-q4r0.7`, `MineCraft-ty2k.13` |
| 6 | `MineCraft-3w2z.6`, `MineCraft-3w2z.7`, `MineCraft-3w2z.8`, `MineCraft-9rdk.11`, `MineCraft-glcb.2`, `MineCraft-q4r0.10`, `MineCraft-q4r0.13`, `MineCraft-q4r0.9`, `MineCraft-ty2k.14` |
| 7 | `MineCraft-3w2z.12`, `MineCraft-9rdk.14`, `MineCraft-q4r0.11`, `MineCraft-q4r0.12`, `MineCraft-q4r0.15`, `MineCraft-ty2k.15` |
| 8 | `MineCraft-3w2z.9`, `MineCraft-glcb.6`, `MineCraft-q4r0.14` |
| 9 | `MineCraft-3w2z.10`, `MineCraft-glcb.7`, `MineCraft-q4r0.16` |
| 10 | `MineCraft-3w2z.11`, `MineCraft-glcb.8`, `MineCraft-q4r0.17` |
| 11 | `MineCraft-glcb.9`, `MineCraft-q4r0.18` |
| 12 | `MineCraft-glcb.10`, `MineCraft-q4r0.19` |
| 13 | `MineCraft-q4r0.20` |

No reciprocal feature-epic blockers, retired-emulator/DDUI JSX prerequisites or full-catalogue `ty2k.16-.18` gates are introduced. Exact child prerequisite tables remain the authoritative edge list; topological waves are a useful implementation schedule. `MineCraft-w82n.8` owns final parent requirement/issue/document parity review.
