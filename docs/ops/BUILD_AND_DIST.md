# Build & Dist (ops)

Canonical policy: `H:\projects\.grok-build\policies\BUILD_POLICY.md`

## One-shot release

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File H:\projects\grok-build-ide\scripts\grok-release\build-and-publish.ps1 `
  -Version 0.3.14 `
  -ProjectRoot H:\projects\grok-build-ide
```

## Dist layout (inside project)

```
H:\projects\grok-build-ide\dist\
  0.3.13\
    portable\   # single-exe + optional zip
    install\    # Inno Setup
    update\     # VSIX + apply-update.ps1 (no full reinstall)
    MANIFEST.json
  latest.json
```

## Retention

Keep **2** newest versions only (`Invoke-Retention.ps1`).

## Apply update (extension only)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File H:\projects\grok-build-ide\dist\0.3.13\update\apply-update.ps1 `
  -InstallRoot "$env:LOCALAPPDATA\Programs\Grok Build IDE"
```

Then restart the IDE.
