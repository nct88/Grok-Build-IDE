# Distribution

The release version is sourced from `build/grok/VERSION` and must match the
Grok Build Workbench extension version.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\grok-release\build-and-publish.ps1 `
  -Version <semver>
```

Release output is generated under the ignored `dist/<version>/` tree. Public
artifacts must be immutable, carry a SHA-256 manifest and pass the repository
release contract before a tag or GitHub Release is created.

`CHANGELOG.md` contains public version changes. Machine-specific paths,
session data, generated verification images and local build candidates are not
publication inputs.
