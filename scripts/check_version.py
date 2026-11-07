"""Require a new stable semantic version on every pull request to main."""

import json
import re
import subprocess
import sys

MANIFEST = "custom_components/ha_kiosk_screen_dimmer/manifest.json"


def parse_version(value):
    """Return a comparable stable version or fail clearly."""
    if not isinstance(value, str) or not re.fullmatch(
        r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", value
    ):
        raise ValueError("Use a stable version in MAJOR.MINOR.PATCH format.")
    return tuple(map(int, value.split(".")))


def version_at(ref):
    """Read a manifest from an immutable PR commit."""
    content = subprocess.check_output(["git", "show", f"{ref}:{MANIFEST}"], text=True)
    return json.loads(content)["version"]


def main():
    base, head = (version_at(ref) for ref in sys.argv[1:3])
    if parse_version(head) <= parse_version(base):
        raise SystemExit(
            f"PR version {head} must be newer than main ({base}). "
            "Bump the manifest version before merging to generate a new release."
        )
    print(f"Release version: {base} -> {head}")


if __name__ == "__main__":
    main()
