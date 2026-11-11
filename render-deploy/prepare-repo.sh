#!/usr/bin/env bash
# Builds a clean copy of the three projects for GitHub: no secrets, no
# node_modules, no Android build folders, no APKs.
#   bash render-deploy/prepare-repo.sh [target folder]   (default: ~/18roots-platform)
set -euo pipefail
SOURCE=$(cd "$(dirname "$0")/.." && pwd)
TARGET=${1:-$HOME/18roots-platform}

if [ -e "$TARGET/.git" ]; then
  echo "$TARGET is already a Git repository; updating its files."
fi
mkdir -p "$TARGET"

COMMON_EXCLUDES=(--include '.env.example' --exclude '.env' --exclude '.env.*' --exclude '*.apk' --exclude '*.aab'
  --exclude '*.pem' --exclude '*.local.txt' --exclude '.hosted-test-secret' --exclude 'node_modules/' --exclude '.expo/'
  --exclude 'android/' --exclude 'ios/' --exclude 'dist/' --exclude 'log/*' --exclude 'tmp/*' --exclude 'storage/*'
  --exclude '.bundle/' --exclude 'vendor/bundle/')

for project in meeting-service main-backend 18roots_app; do
  rsync -a --delete "${COMMON_EXCLUDES[@]}" "$SOURCE/$project/" "$TARGET/$project/"
done
mkdir -p "$TARGET/render-deploy"
rsync -a --delete --exclude 'secrets.local.txt' --exclude '*.pem' --exclude '*.env' "$SOURCE/render-deploy/" "$TARGET/render-deploy/"
cp "$SOURCE/render-deploy/render.yaml" "$TARGET/render.yaml"
cp "$SOURCE/render-deploy/repo.gitignore" "$TARGET/.gitignore"
cp "$SOURCE/render-deploy/repo-README.md" "$TARGET/README.md"

# A last check that nothing private slipped in.
if find "$TARGET" -path "$TARGET/.git" -prune -o \( -name '.env' -o -name '*.env' -o -name '*.pem' -o -name 'secrets.local.txt' -o -name '.hosted-test-secret' -o -name '*.apk' \) -print | grep -q .; then
  echo "A private file was copied; stopping." >&2
  exit 1
fi

echo "Clean copy ready in $TARGET ($(find "$TARGET" -path "$TARGET/.git" -prune -o -type f -print | wc -l) files)."
if [ "${NO_GIT:-0}" != "1" ]; then
  cd "$TARGET"
  [ -d .git ] || git init -b main -q
  git add -A
  if git diff --cached --quiet; then
    echo "No changes to commit."
  else
    git commit -q -m "18Roots platform: meeting service, main backend and app" && echo "Committed. Next: push to your private GitHub repository."
  fi
fi
