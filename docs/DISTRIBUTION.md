# Distribution

The release version is sourced from `build/grok/VERSION` and must match the
Grok Build Workbench extension version.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\grok-release\build-and-publish.ps1 `
  -Version <semver> `
  -BaseCandidateRoot <verified-base-payload>
```

Release output is generated under the ignored `dist/<version>/` tree. Public
artifacts must be immutable, carry a SHA-256 manifest and pass the repository
release contract before a tag or GitHub Release is created.

Public publication additionally requires clean source, a Code OSS base built
from that exact commit with `.grok-base-provenance.json`, HTTPS download
metadata, updater and installer lifecycle tests, and a successful
release-validation workflow on the exact commit. Timestamped Authenticode is the
default; an explicitly waived unsigned release is labeled `public-unsigned` and
retains its SmartScreen/SHA-256 warning. Follow
[`RELEASE.md`](RELEASE.md).

The update channel contains a VSIX, `apply-update.ps1`, and
`rollback-update.ps1`. Apply verifies the manifest filename/version/SHA-256,
stages extraction safely, swaps the extension registry transactionally, keeps
unrelated extensions, and restores the backup on any failure. Rollback restores
the most recent completed transaction after the IDE is closed.

`CHANGELOG.md` contains public version changes. Machine-specific paths,
session data, generated verification images and local build candidates are not
publication inputs.
