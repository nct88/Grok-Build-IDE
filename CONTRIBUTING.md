# Contributing to Grok Build IDE

This repository is **Grok Build IDE** (`nct88/Grok-Build-IDE`).
Grok Build Desktop lives in [`nct88/Grok-Build-Desktop`](https://github.com/nct88/Grok-Build-Desktop).
The agent engine is the official **Grok CLI**, not a second runtime.

Thank you for helping improve Grok Build IDE. This project combines Code - OSS
with a first-party workbench extension that connects to the official Grok CLI over
ACP, so reports should clearly identify which layer is affected.

## Before opening an issue

Search the [existing issues](https://github.com/nct88/Grok-Build-IDE/issues),
then test with the latest Grok Build IDE and official Grok CLI when practical.
For usage questions, see [SUPPORT.md](SUPPORT.md). For vulnerabilities, follow
[SECURITY.md](SECURITY.md) and do not post sensitive details publicly.

A useful bug report includes:

- Grok Build IDE version and install type (Setup, Portable EXE, or ZIP)
- Grok CLI version from `grok --version`
- Windows version and architecture
- whether Workspace Trust, reverse-terminal, sandbox, or automatic approval is enabled
- reproducible steps, expected behavior, and actual behavior
- sanitized Output panel logs and screenshots when relevant

Never attach credentials, full session transcripts, customer source code, or
private filesystem paths unless they are essential and safe to share.

## Development checks

Use Node.js from `.nvmrc`, install dependencies, and run the focused Grok gate:

```powershell
npm ci
npm run check:grok
```

Changes to the webview must also pass the visual regression suite. Release work
must follow `packaging.json`, `docs/RELEASE.md`, and the scripts under
`scripts/grok-release`; published versions are immutable.

## Pull requests

Keep each pull request focused. Explain the user-visible behavior, security or
compatibility impact, tests performed, and any known limitation. Preserve the
upstream MIT license and attribution for Code - OSS files. Avoid broad rewrites
of upstream source when an isolated extension or branding change is sufficient.

Contributions are reviewed for behavior, regression coverage, accessibility,
privacy, packaging integrity, and consistency with Grok Build Desktop and Grok Build IDE.
