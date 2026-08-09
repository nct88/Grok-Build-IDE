# Grok Workbench IDE 0.3.7 claim/evidence record

Date: 2026-08-03

| Claim | Direct evidence | Result | Limitation |
|---|---|---|---|
| The visible composer remains at the bottom of the Grok view | Playwright measures `.composer-card` bottom gap and `.composer-shell` height at 240×720, 390×720, and 600×900; archived EXE CDP measured a 30 px visible-card bottom gap and 140 px shell at a 594×708 webview | Verified for tested states/viewports | Very small platform viewports outside the tested range remain user acceptance |
| Hidden plan content cannot shift the composer into the flexible row | `.app` is a column flex container; `.messages` alone has `flex: 1 1 0`; hidden-plan Markdown fixtures and packaged empty state pass | Verified | Future layout rewrites must retain the direct geometry gate |
| Controls use a coherent vector icon system instead of rough emoji/font glyphs | Local Codex ASAR audit identified `createLucideIcon`; Grok runtime has 15 SVG icons, 0 unhydrated placeholders, 0 invalid 24×24/currentColor icons, and 0 former raw glyphs | Verified for persistent empty-state controls | Event-dependent warning/tool/delete icons are covered by the Playwright long/attachment fixtures rather than the packaged empty state |
| Icons remain legible in supported responsive/theme states | Full renders at 240×720/100% dark, 390×720/125% light, and 600×900/150% dark; permission-open, connected, and running states included | Verified for rendered matrix | High-contrast theme remains a separate acceptance state |
| IDE 0.3.7 embeds extension 0.8.1 and launches | Archived EXE structural verification, cache extraction/reuse/repair, portable registry/settings, relocated runtime, extension activation, and one-window folder reuse | Verified on this Windows x64 machine | Runtime overlay remains the documented portable VSCodium base, not a complete native Code OSS rebuild |
| Archive content matches the tested final candidate | IDE and VSIX source/destination SHA-256 comparisons matched exactly | Verified | Artifacts are not code-signed |

## Release artifacts

- `releases/0.3.7/Grok-Workbench-IDE-0.3.7-win32-x64-portable.exe`
  - SHA-256: `621E0F1C86D2E03DEC1444372BD35EBB979A7DEA549B4135218B9FD20BC19010`
- `extensions/grok-build-workbench/releases/0.8.1/grok-build-workbench-0.8.1.vsix`
  - SHA-256: `3E880DB95041A1489ECB3EAFECB1DCB1486F341A7CCD256EE21B587230015CB2`

## Evidence paths

- Responsive renders: `extensions/grok-build-workbench/test/visual/evidence/0.8.1`
- Archived EXE full-window render: `.build/packaged-ui-0.3.7-release/full-workbench.png`
- Archived EXE geometry/icon record: `.build/packaged-ui-0.3.7-release/geometry.json`
- Codex/Lucide comparison: `docs/grok-workbench/ICON_AUDIT_0.3.7.md`

## Not verified by this release task

- Live authenticated Grok service responses and subscription quota behavior.
- Live Windows speech permission and transcription.
- Pixel behavior under third-party themes that override VS Code tokens.
- Production code signing.
