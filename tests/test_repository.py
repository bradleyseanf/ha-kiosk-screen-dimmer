"""Guard the HACS metadata and main-branch release workflow."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from scripts.check_version import parse_version

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components/ha_kiosk_screen_dimmer"


class TestRepository(unittest.TestCase):
    def test_manifest_and_hacs_metadata(self):
        manifest = json.loads((COMPONENT / "manifest.json").read_text())
        self.assertEqual(list(manifest)[:2], ["domain", "name"])
        self.assertEqual(list(manifest)[2:], sorted(list(manifest)[2:]))
        self.assertEqual(manifest["codeowners"], ["@bradleyseanf"])
        self.assertEqual(manifest["integration_type"], "helper")
        self.assertEqual(manifest["iot_class"], "calculated")
        self.assertTrue(manifest["single_config_entry"])
        for key in ("documentation", "issue_tracker"):
            self.assertTrue(manifest[key].startswith("https://github.com/bradleyseanf/ha-kiosk-screen-dimmer"))
        parse_version(manifest["version"])
        hacs = json.loads((ROOT / "hacs.json").read_text())
        self.assertEqual(hacs["name"], manifest["name"])
        self.assertEqual(hacs["homeassistant"], "2025.3.0")
        self.assertTrue(hacs["hide_default_branch"])

    def test_abort_has_english_translation(self):
        translations = json.loads((COMPONENT / "translations/en.json").read_text())
        text = translations["config"]["abort"]["single_instance_allowed"]
        self.assertTrue(text)
        self.assertNotIn("[%key:", text)
        self.assertTrue(translations["config"]["step"]["user"]["title"])

    def test_semantic_version_parser(self):
        self.assertLess(parse_version("0.0.9"), parse_version("0.0.10"))
        self.assertEqual(parse_version("1.2.3"), (1, 2, 3))
        for value in ("v1.2.3", "1.2", "01.2.3", "1.2.3beta1", "1.2.3\n", None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_version(value)

    def test_main_version_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            cwd = Path(directory)
            env = {**os.environ, "GIT_AUTHOR_NAME": "Test", "GIT_AUTHOR_EMAIL": "test@example.com", "GIT_COMMITTER_NAME": "Test", "GIT_COMMITTER_EMAIL": "test@example.com"}

            def git(*args):
                return subprocess.check_output(["git", *args], cwd=cwd, env=env, text=True).strip()

            git("init", "-q")
            manifest = cwd / "custom_components/ha_kiosk_screen_dimmer/manifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(json.dumps({"version": "0.0.4"}))
            git("add", ".")
            git("commit", "-qm", "base")
            base = git("rev-parse", "HEAD")
            script = ROOT / "scripts/check_version.py"
            equal = subprocess.run(["python", str(script), base, base], cwd=cwd, capture_output=True, text=True)
            self.assertNotEqual(equal.returncode, 0)
            self.assertIn("must be newer", equal.stderr)
            manifest.write_text(json.dumps({"version": "0.0.5"}))
            git("add", ".")
            git("commit", "-qm", "release")
            newer = subprocess.run(["python", str(script), base, "HEAD"], cwd=cwd, capture_output=True, text=True)
            self.assertEqual(newer.returncode, 0, newer.stderr)

    def test_release_script_is_safe_and_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            log = path / "gh.log"
            gh = path / "gh"
            gh.write_text('''#!/usr/bin/env bash
if [[ "$1" == api ]]; then
  if [[ "${API_FAIL:-}" == 1 ]]; then exit 1; fi
  printf '%s\\n' "${EXISTING_RELEASES:-}"
else
  printf '%s\\n' "$*" >> "$COMMAND_LOG"
fi
''')
            gh.chmod(0o755)
            git = path / "git"
            git.write_text('#!/usr/bin/env bash\n[[ "${EXISTING_TAG:-}" == 1 ]]\n')
            git.chmod(0o755)
            env = {**os.environ, "PATH": str(path) + os.pathsep + os.environ["PATH"], "GH_REPO": "owner/repo", "GITHUB_SHA": "tested-commit", "COMMAND_LOG": str(log)}
            script = ["bash", str(ROOT / "scripts/publish_release.sh")]
            version = json.loads((COMPONENT / "manifest.json").read_text())["version"]
            for extra in ({"EXISTING_RELEASES": f"v{version}"}, {"API_FAIL": "1"}, {"EXISTING_TAG": "1"}, {"EXISTING_RELEASES": "v99.0.0"}):
                result = subprocess.run(script, cwd=ROOT, env={**env, **extra}, capture_output=True, text=True)
                self.assertFalse(log.exists(), result.stdout + result.stderr)
                self.assertEqual(result.returncode == 0, extra.get("EXISTING_RELEASES") == f"v{version}")
            result = subprocess.run(script, cwd=ROOT, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            command = log.read_text()
            self.assertIn(f"release create v{version}", command)
            self.assertIn("--target tested-commit", command)
            self.assertIn("--generate-notes", command)


if __name__ == "__main__":
    unittest.main()
