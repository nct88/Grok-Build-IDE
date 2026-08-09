# Grok Workbench IDE 0.3.6 claim/evidence record

Date: 2026-08-03

> Erratum (2026-08-03): the original composer claim below was invalidated by the user's full-window screenshot and direct inspection of the packaged webview. The test measured `.composer-shell`, not the visible `.composer-card`; the shell reached the viewport bottom while the card remained about 268 px above it. Release 0.3.6 must not be used as evidence that the visible composer is bottom-docked.

| Claim | Evidence | Result | Limitation |
|---|---|---|---|
| Composer remains at the bottom of the Grok view | Original Playwright geometry measured the shell; the exact archived runtime screenshot contradicted the claim | **Failed / invalidated** | Visible card geometry was not measured; corrected by the 0.3.7 regression gate |
| Permission menu is readable in dark and light themes | Custom listbox screenshots, viewport-bound checks, selected-row WCAG contrast ≥ 4.5 | Verified | Theme extensions can override VS Code color tokens |
| Normal Markdown no longer exposes `##` and `**` markers | Renderer unit tests and dark/light visual fixtures covering headings, emphasis, lists, quotes, code, tables, and links | Verified | This is a safe supported subset, not full CommonMark parity |
| Visible Grok controls are wired | 18/18 contributed command registrations; browser message assertions for composer/navigation/config/link controls | Verified | Event-dependent diff/file controls require matching ACP events |
| Dedicated ACP launch settings match Grok CLI 0.2.118 | Local CLI help comparison plus launch argument regression tests | Verified | Administrative CLI commands are intentionally not all mirrored in the GUI |
| Portable IDE 0.3.6 embeds extension 0.8.0 and launches | Registry/settings checks, exact archived EXE extraction/cache/repair, seven runtime processes, extension activation log | Verified | Uses the documented VSCodium runtime overlay rather than a full native Code OSS rebuild |
| Open Folder reuses the current portable window | Exact archived runtime test: one visible window before and after | Verified | Tested on this Windows x64 environment |
| Release artifacts are reproducible and identifiable | Archived hashes: IDE `54C7CC...0FB2`, VSIX `D1D5A9...37AD` | Verified | Artifacts are not code-signed |

## Release artifacts

- `releases/0.3.6/Grok-Workbench-IDE-0.3.6-win32-x64-portable.exe`
- `extensions/grok-build-workbench/releases/0.8.0/grok-build-workbench-0.8.0.vsix`

## Acceptance still required

- User acceptance with the target authenticated Grok account and a real workload.
- Live Web Speech permission/transcription on the target Windows installation.
- Optional production code signing.
