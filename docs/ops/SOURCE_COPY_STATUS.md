# Source copy status

Date: 2026-08-04  
Source: `H:\projects\grok-code`  
Dest: `H:\projects\grok-build-ide`

## Summary

| Area | Status |
|---|---|
| Extension TypeScript (`src/**`) | Copied |
| Webview media (`main.js`, `markdown.js`, `styles.css`, `timeline.js`) | Present + **UI/clipboard redesign applied** |
| Product identity (`product.json`, root package, etc.) | Copied |
| Workspace selfhost stubs (`out/extension.js`) | Fixed |
| Full Code - OSS `src/` / other extensions | **Completed** via `bootstrap-copy-from-grok-code.ps1` (15,985 files copied) |
| `node_modules` / releases | Intentionally excluded |

## Work completed in grok-build-ide

1. **CLI ↔ IDE audit** — `docs/FEATURE_AND_UI_PLAN.md`
2. **Session UI redesign** — structured blocks, avatars, tool status colors, code cards
3. **Clipboard paste + improved drop** — images as base64 ACP attachments without saving to disk
4. **`out/extension.js` activation errors** — no-op stubs for VS Code selfhost workspace extensions
5. **Peer AI IDE structure** — `docs/AI_IDE_STRUCTURE_COMPARISON.md`
6. **Full Code-OSS source sync** — Executed `bootstrap-copy-from-grok-code.ps1` and `compile-workspace-extensions.ps1`
7. **Windows Terminal Spawn Fix** — Restored `resolveTerminalSpawn` and child process `error` handler in `terminalHost.ts`
8. **Webview RAF Batching** — Optimized `main.js` with `requestAnimationFrame` batch rendering and attachment size limits

## Full tree sync (when shell works)

```powershell
cd H:\projects\grok-build-ide
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bootstrap-copy-from-grok-code.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\compile-workspace-extensions.ps1
```

Then restore dependencies and build the workbench extension:

```powershell
cd H:\projects\grok-build-ide\extensions\grok-build-workbench
# npm/pnpm install as used in your environment
npm run build
```

## Note on shell

The agent session could not run bulk `robocopy` (shell exited -1). File transfer used `read_file` + `write`. Re-run bootstrap to merge any missing Code - OSS shell files without overwriting the intentional 0.9 UI changes under `extensions/grok-build-workbench/media` and `chatViewProvider.ts` if you customize further.
