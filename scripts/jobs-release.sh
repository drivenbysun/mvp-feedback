#!/bin/bash
# Stellt die launchd-Jobs (board-einsortierer, board-status-job) auf einen festen,
# getesteten Stand um. Die Jobs laufen aus ~/.fabrik/release/mvp-feedback, NICHT
# aus dem Arbeitsordner: halbfertige Aenderungen dort gehen so nie live.
#
#   scripts/jobs-release.sh            origin/main ausrollen
#   scripts/jobs-release.sh <ref>      bestimmten Commit/Tag ausrollen
#   scripts/jobs-release.sh --zurueck  auf den vorigen Stand zurueck
#   scripts/jobs-release.sh --status   aktuellen Stand zeigen
#
# Vor dem Umstellen laufen die Skript-Tests im Release-Ordner; schlagen sie fehl,
# bleibt der alte Stand. Die Jobs brauchen nur Node-Bordmittel, kein node_modules.
set -euo pipefail

REPO="$HOME/CODE/mvp-feedback"
REL="$HOME/.fabrik/release/mvp-feedback"
VORHER="$HOME/.fabrik/release/mvp-feedback.vorher"
export PATH="/opt/homebrew/bin:$PATH"

stand() { git -C "$REL" rev-parse HEAD 2>/dev/null || echo "(nicht angelegt)"; }

if [ "${1:-}" = "--status" ]; then
  echo "Release: $(stand)"; echo "Vorher:  $(cat "$VORHER" 2>/dev/null || echo -)"; exit 0
fi

if [ "${1:-}" = "--zurueck" ]; then
  [ -f "$VORHER" ] || { echo "Kein vorheriger Stand gespeichert." >&2; exit 1; }
  ZIEL="$(cat "$VORHER")"; NEU_VORHER="$(stand)"; TESTEN=0
else
  git -C "$REPO" fetch -q origin main
  ZIEL="$(git -C "$REPO" rev-parse "${1:-origin/main}^{commit}")"; NEU_VORHER="$(stand)"; TESTEN=1
fi

mkdir -p "$(dirname "$REL")"
if [ ! -d "$REL/.git" ] && [ ! -f "$REL/.git" ]; then
  git -C "$REPO" worktree add --detach "$REL" "$ZIEL" >/dev/null
  NEU_VORHER=""
else
  git -C "$REL" checkout -q --detach "$ZIEL"
fi

if [ "$TESTEN" = 1 ]; then
  [ -e "$REL/node_modules" ] || ln -s "$REPO/node_modules" "$REL/node_modules"
  if ! (cd "$REL" && ./node_modules/.bin/vitest run scripts --poolOptions.forks.maxForks=2 --poolOptions.forks.minForks=1 >/dev/null 2>&1); then
    echo "Tests im Release-Stand $ZIEL schlagen fehl -- Stand bleibt unveraendert." >&2
    [ -n "$NEU_VORHER" ] && git -C "$REL" checkout -q --detach "$NEU_VORHER"
    exit 1
  fi
fi

[ -n "$NEU_VORHER" ] && echo "$NEU_VORHER" > "$VORHER"
echo "Release steht auf $ZIEL (vorher: ${NEU_VORHER:-keiner})"
