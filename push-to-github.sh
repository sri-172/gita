#!/usr/bin/env bash
# Push this repository to GitHub from your own machine.
# Usage: ./push-to-github.sh https://github.com/USER/REPO.git
set -euo pipefail
REPO_URL="${1:-}"
if [[ -z "$REPO_URL" ]]; then
  echo "Usage: ./push-to-github.sh https://github.com/USER/REPO.git" >&2
  exit 1
fi
cd "$(dirname "$0")"
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "No .git here. If you downloaded a bundle, run: git clone gita-website.bundle gita" >&2
  exit 1
fi
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"
git push -u origin main
echo "Pushed. To publish: Settings → Pages → Deploy from a branch → main / (root)."
