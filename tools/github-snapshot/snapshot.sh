#!/bin/sh
# Push a snapshot of the project folder to github.com/apolitakis/cytostorm (main).
# The project folder is the source of truth; the repo is a mirror plus a nightly restore point
# (Alex, 2026-10-08, "like Sonterra Tactics"). Never put a .git folder inside /mnt/project-files.
#
# Usage: sh snapshot.sh [clone-dir]   (default /home/user/cytostorm)
# Exit codes: 0 pushed or nothing changed; 2 main has commits not made by a snapshot
# (someone merged on GitHub: bring those in first, don't overwrite); 3 a key or token
# was found; anything else is an error.
set -eu
SRC=/mnt/project-files
REPO=${1:-/home/user/cytostorm}
URL=https://github.com/apolitakis/cytostorm
HERE=$(cd "$(dirname "$0")" && pwd)

[ -d "$REPO/.git" ] || git clone --depth 1 "$URL" "$REPO"
cd "$REPO"
if git ls-remote --exit-code origin refs/heads/main >/dev/null 2>&1; then
  git fetch --depth 1 origin main
  git checkout -q -B main FETCH_HEAD
  # Only Claude's commits may be replaced by a snapshot. Anything else on main came from
  # GitHub and must be merged into the folder first.
  if [ "$(git log -1 --format=%ae)" != "noreply@anthropic.com" ]; then
    echo "main's latest commit is by $(git log -1 --format='%an <%ae>'): not overwriting"; exit 2
  fi
else
  git checkout -q -B main   # empty repo: first snapshot
fi

# Mirror the folder. README.md and .gitignore are repo-only and come from this script's folder.
# Left out: chat uploads, zip bundles, rendered audio (audio/render.js remakes it), caches.
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
(cd "$SRC" && tar -cf - --exclude='__pycache__' --exclude='*.pyc' --exclude='*.zip' \
  --exclude='./uploads' --exclude='./audio/renders' --exclude='node_modules' --exclude='.DS_Store' \
  --exclude='.env' --exclude='.env.*' --exclude='.git' .) | tar -xf -
cp "$HERE/repo-README.md" README.md
cp "$HERE/repo-gitignore" .gitignore
chown -R "$(id -u):$(id -g)" .

# Secrets: known key shapes, plus the literal values of any key/token env vars.
if grep -rIlE 'nfp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_|sk-ant-|xox[bpa]-|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY' --exclude-dir=.git --exclude=snapshot.sh . ; then
  echo "possible key found in the files above: not pushing"; exit 3
fi
for v in $(env | cut -d= -f1 | grep -iE 'key|token|secret|pass'); do
  val=$(printenv "$v" || true)
  if [ ${#val} -ge 12 ] && grep -rIqF --exclude-dir=.git -- "$val" . ; then
    echo "the value of \$$v appears in a file: not pushing"; exit 3
  fi
done

git add -A
if git diff --cached --quiet; then echo "no changes since the last snapshot"; exit 0; fi
# Top-level folders that changed, for the message.
DIRS=$(git diff --cached --name-only | awk -F/ 'NF>1{print $1"/"} NF==1{print "(top level)"}' | sort -u | tr '\n' ' ')
git -c user.name=Claude -c user.email=noreply@anthropic.com commit -q -m "Nightly snapshot $(TZ=America/New_York date +%Y-%m-%d): ${DIRS% }

$(git diff --cached --shortstat)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011tyXw1uPuY4aMdegrTERoz"
git push -u origin main
[ "$(git ls-remote origin refs/heads/main | cut -f1)" = "$(git rev-parse HEAD)" ] && echo "pushed $(git rev-parse --short HEAD)"
