#!/usr/bin/env bash

set -euo pipefail

REMOTE="${1:-origin}"
BRANCH="${2:-main}"

# Ensure we're in a Git repo
if [[ ! -d .git ]]; then
  echo "Error: .git directory not found. Run from the repository root." >&2
  exit 1
fi

# Clean up any auto-created conflicted refs that can break fetch/reset
find .git/refs -type f -name '*conflicted copy*' -delete

echo "Fetching ${REMOTE}/${BRANCH}..."
git fetch "${REMOTE}" "${BRANCH}"

echo "Checking out ${BRANCH}..."
git checkout "${BRANCH}"

echo "Resetting ${BRANCH} to ${REMOTE}/${BRANCH}..."
git reset --hard "${REMOTE}/${BRANCH}"

echo "Done. ${BRANCH} now matches ${REMOTE}/${BRANCH}."

