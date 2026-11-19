# Pull monorepo

Run `npm install` (or `npm ci`) after cloning to build this workspace and install
the Husky hooks. Then run `npm run pull` from the repository root. To rebuild
manually, run `npm run build --workspace pull-monorepo`.

The command requires an attached `Master` checkout. It chooses remote `Origin`,
then `origin`, then the first remote listed by Git, and pulls remote `Master`
using Git's existing merge/rebase configuration. In parallel it runs
`bd dolt pull` against Beads' configured remote. A missing `bd` is skipped;
either attempted pull failing makes the command fail after both have finished.
Successful work is retained if the other operation fails.

The Husky `post-merge` and `post-rewrite` hooks run `bd dolt pull` after a
successful merge/fast-forward or rebase pull, on any branch. They skip ordinary
merges/rebases, skip Beads when `bd` is unavailable, and suppress duplicate sync
when invoked by `npm run pull`. Beads output and failures are surfaced by the
hook; Git's post hooks cannot undo the completed Git operation or reliably make
Git return a failure status. Normal `HUSKY=0` opt-out remains available.

Git has no dedicated post-pull hook: already-current pulls do not trigger these
hooks. Use `npm run pull` to sync Beads even when Git has no changes. Git also
has no client-side post-push hook, so the Husky `pre-push` hook runs
`bd dolt push` **before** a plain `git push` sends code. A Beads push failure
blocks the code push; a missing `bd` is skipped. A child-only environment guard
prevents recursion if Dolt invokes Git internally. Beads may already have been
pushed if the later code push fails. Git also invokes `pre-push` for
`git push --dry-run`, so that command can sync Beads; use `HUSKY=0` to opt out.

Husky must be the active hook dispatcher (`core.hooksPath` set to `.husky/_`).
If another tool has replaced that setting, `npm run prepare` reinstalls Husky;
review any hooks managed by that tool before switching dispatchers.

Installation with lifecycle scripts disabled does not build the entrypoint or
install hooks. Run `npm run prepare --workspace pull-monorepo` and
`npm run prepare` manually in that case.
