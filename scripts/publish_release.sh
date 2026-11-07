#!/usr/bin/env bash
# Run only after CI succeeds, on main, with the workflow's GitHub token.
set -euo pipefail

version=$(python -c 'import json; from scripts.check_version import parse_version; version = json.load(open("custom_components/ha_kiosk_screen_dimmer/manifest.json"))["version"]; parse_version(version); print(version)')
tag="v$version"

# An API/authentication error must not be mistaken for a missing release.
releases=$(gh api --paginate "repos/$GH_REPO/releases?per_page=100" --jq '.[] | select(.draft == false and .prerelease == false) | .tag_name')
if grep -Fxq "$tag" <<< "$releases"; then
  echo "Release $tag already exists; leaving it unchanged."
  exit 0
fi

# An older rerun must not supersede a newer stable release.
RELEASE_TAGS="$releases" python - "$version" <<'PY_VERSION'
import os
import sys
from scripts.check_version import parse_version

candidate = parse_version(sys.argv[1])
for tag in os.environ["RELEASE_TAGS"].splitlines():
    try:
        published = parse_version(tag.removeprefix("v"))
    except ValueError:
        continue
    if candidate <= published:
        raise SystemExit(f"Refusing to publish {sys.argv[1]} after newer release {tag}.")
PY_VERSION

# Never reuse an unreviewed tag that may point at a different commit.
if git show-ref --verify --quiet "refs/tags/$tag"; then
  echo "::error::Tag $tag already exists without a published release. Inspect it before publishing."
  exit 1
fi

# GitHub generates the changelog from merged PRs using .github/release.yml.
gh release create "$tag" \
  --target "$GITHUB_SHA" \
  --title "Screen Dimmer $tag" \
  --generate-notes \
  --latest
