# Development and releases

Use `dev` for development and open release pull requests from `dev` to `main`.
Every pull request to `main` must increase the version in
`custom_components/ha_kiosk_screen_dimmer/manifest.json`. Update the resource version
in the README when changing the frontend so browsers load the new JavaScript.

CI runs JavaScript behavior tests, focused Python tests, metadata checks, Hassfest,
and HACS validation for pushes and pull requests to `dev` and `main`. It also runs
weekly to catch upstream validation changes. The Python tests use lightweight
Home Assistant stubs; they do not replace testing in a running Home Assistant instance.

After a push or merged pull request to `main`, the release workflow runs the same
checks and publishes `v<manifest version>` only if they all pass. The GitHub release
changelog is generated from merged pull requests, grouped by labels using
`.github/release.yml`. Existing releases are never overwritten.

[Read the changelog and releases](https://github.com/bradleyseanf/ha-kiosk-screen-dimmer/releases).
HACS installs published releases; the development branch is hidden from its download choices.

Dependabot checks pinned GitHub Actions weekly and opens grouped update pull
requests against `dev`. There are no third-party Python or npm package dependencies
to update. Dependency alerts/security settings are separate GitHub repository settings.

Run the local checks with:

```sh
node --check custom_components/ha_kiosk_screen_dimmer/brightness-dimmer.js
node --test tests/brightness-dimmer.test.js
python -m unittest discover -s tests -p 'test_*.py'
python -m compileall -q custom_components scripts
```

## HACS default catalog

Custom-repository installation is covered in the [quick start](../README.md). Default catalog
inclusion is a separate review by the HACS maintainers and is not guaranteed by
publishing a release. Before submission, the repository must have an OSI-approved
license, description and topics, and passing HACS and Hassfest checks without
ignored validations. Publish a new release after those checks pass, then submit
the repository to the `integration` list in
[hacs/default](https://github.com/hacs/default).

See the [HACS submission requirements](https://hacs.xyz/docs/publish/include/).

## README illustration

`docs/images/slider-example.svg` is an editable illustration of the slider and tint effect, not a Home Assistant screenshot. It shows sample data at 100% (clear) and 40% perceived brightness, with the corresponding 60% black overlay. The README labels it explicitly.
