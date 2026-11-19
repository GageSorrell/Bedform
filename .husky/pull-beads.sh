#!/bin/sh
# npm run pull already runs its own Beads sync.
[ "${PullMonorepoActive:-}" = "1" ] && exit 0
case "${GIT_REFLOG_ACTION:-}" in
    pull|pull\ *) ;;
    *) exit 0 ;;
esac

# Match npm run pull's optional Beads installation.
command -v bd >/dev/null 2>&1 || exit 0
PullMonorepoActive=1 bd dolt pull </dev/null
