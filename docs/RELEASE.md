# Release process

Published versions are immutable. A public release is valid only when source and
base provenance are recorded, all local gates pass, and GitHub release validation
finishes successfully on the exact source commit. Authenticode signing remains
the default. An intentional unsigned release requires the explicit waiver below
and is recorded as `public-unsigned`, never as signed.

## 1. Prepare and commit source

Update `build/grok/VERSION`, the extension version, changelog, and bilingual
README links. Commit the release changes and ensure `git status --short` is empty.

The base contains compiled source, so the release commit must exist before the
final base is built. This ordering prevents a package whose manifest names one
commit while its executable contains another.

## 2. Build and verify the Code OSS base

From the clean release commit, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\grok-release\Build-CodeOssBase.ps1
```

The task builds `vscode-win32-x64-min`, creates the portable data skeleton, and
moves the immutable result under `.build/base-candidates/<commit>-win32-x64/`.
It writes `.grok-base-provenance.json` with the exact commit, source/base package
versions, dirty flag, build command, duration, and SHA-256 values for both
`product.json` and the IDE executable. `-AllowDirty` is development-only and the
result is rejected by the public gate.

## 3. Build, test, sign and stage the candidate

Run the release pipeline with an explicit base, HTTPS download root, and the
public gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\grok-release\build-and-publish.ps1 `
  -Version 1.2.3 `
  -BaseCandidateRoot E:\projects\grok-build-ide\.build\base-candidates\<commit>-win32-x64\grok-build-ide-base-1.124.2 `
  -ReleaseBaseUrl https://github.com/nct88/Grok-Build-IDE/releases/download/v1.2.3 `
  -CertificateThumbprint <SHA1-certificate-thumbprint> `
  -TimestampUrl <HTTPS-RFC3161-timestamp-url> `
  -PublicRelease
```

The command fails if source is dirty, the base is implicit, the base Code - OSS
package version/commit/hashes differ from provenance, artifacts are missing,
HTTPS is absent, lifecycle tests fail, or Authenticode validation is not
`Valid`. Before staging `dist`, it exercises VSIX apply/rollback/tamper paths and
an isolated installer install/uninstall with a unique test AppId. The emitted
manifest and `BASE-PROVENANCE.json` record source/base identity and artifact
SHA-256 values. The publisher writes the complete version into a private staging
directory and only then promotes it to immutable `dist/<version>`, so a failed
copy cannot leave a partial release occupying the final version path.

Code-signing credentials are external release infrastructure. Never store a PFX,
password, signing token, or private key in this repository. The signing hook
uses an external Windows certificate store and requires an RFC 3161 HTTPS
timestamp. Both portable and Setup executables are re-verified after signing.

When a signing certificate is temporarily unavailable and the publisher accepts
SmartScreen warnings, replace the certificate/timestamp parameters with:

```powershell
  -AllowUnsignedPublicRelease `
  -PublicRelease
```

This waiver does not disable clean-source, base provenance, SHA-256, updater,
installer, runtime or CI gates. The manifest becomes `public-unsigned`, includes
the waiver warning, and the GitHub publisher must receive the same explicit flag.

## 4. Push and publish only after CI

Create a release-notes file and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\grok-release\Publish-GitHubRelease.ps1 `
  -Version 1.2.3 `
  -NotesFile .\release-notes-1.2.3.md `
  -AllowUnsignedPublicRelease
```

Push the release commit to `origin/main` first. The publisher verifies clean
`HEAD == origin/main`, both manifest and base provenance,
artifact hashes, GitHub CLI authentication, and an authenticated read-only ACP
smoke turn against the pinned Grok CLI version. It then dispatches and waits for
the release validation workflow on that exact commit. Only after it succeeds
does the script create the tag and GitHub release with all required artifacts.

## Development candidates

Omit `-PublicRelease` for local unsigned candidates. They remain clearly marked
`local-unsigned-candidate` and must not be presented as trusted public releases.
They still require a provenance-bearing base. Use `Build-CodeOssBase.ps1
-AllowDirty` when a development-only base is needed.
