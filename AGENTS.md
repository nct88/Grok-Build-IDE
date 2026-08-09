# VS Code / Grok Build Agents Instructions

This repository is the **optional Code-OSS engine** for **Grok Build IDE**.

**Primary product** is the agent desktop monorepo (no VS Code):

`H:\projects\Grok-Build` → `apps/desktop` + `packages/acp-client`

This IDE repo is **standalone** (no longer linked as `Grok-Build\ide`).

## Source of truth

| Role | Path |
|---|---|
| **Grok Build (desktop)** | `H:\projects\Grok-Build` |
| **This repo (Grok Build IDE)** | `H:\projects\grok-build-ide` |
| **Backup / archive** | `H:\projects\grok-code` — do **not** dual-edit |
| **Grok-only local memory** | `H:\projects\.grok-build` |

## Build & dist

Policy: `H:\projects\.grok-build\policies\BUILD_POLICY.md`

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\grok-release\build-and-publish.ps1 -Version 0.3.13
```

- After success: artifacts under `H:\projects\grok-build-ide\dist`
- Channels: **portable**, **install**, **update** (extension-only hot update)
- Retention: keep **2** newest dist versions only
- Always append `fix-bug/FIX_LOG.md` (mirrored to `.grok-build/memory/FIX_LOG.md`)

## Architecture

Do **not** break Code-OSS layout: `src/`, `extensions/`, `build/`, `scripts/` (VS Code scripts), `resources/`, `cli/`, `test/`.

Project-only docs live under `docs/{product,grok-workbench,reports,ops}/`.

For detailed VS Code coding guidelines see [Copilot Instructions](.github/copilot-instructions.md).
