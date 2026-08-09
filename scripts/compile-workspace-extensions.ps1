#Requires -Version 5.1
<#
.SYNOPSIS
  Ensure .vscode/extensions/*/out/extension.js exists so VS Code does not
  fail activation with "Cannot activate because ./out/extension.js not found".

.DESCRIPTION
  These folders are VS Code *core selfhost* helpers (extras, PR pinger,
  import aid, test provider). They are not needed for Grok Build product use.
  This script writes a no-op activate stub when a real compiled out/ is missing.

  For full TypeScript compile of selfhost extensions, use the Code - OSS gulp
  tasks after root npm install:
    npm run compile-extensions
  or per-extension:
    gulp compile-extension:vscode-extras
#>
param(
  [string]$RepoRoot = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = "Stop"
$extensionsRoot = Join-Path $RepoRoot ".vscode\extensions"

if (-not (Test-Path -LiteralPath $extensionsRoot)) {
  Write-Host "No .vscode/extensions directory; nothing to fix."
  exit 0
}

$stub = @'
"use strict";
/**
 * No-op stub for Grok Build IDE product workspace.
 * Real VS Code selfhost tooling is compiled via gulp when developing Code - OSS itself.
 */
function activate() {
  // intentionally empty
}
function deactivate() {
  // intentionally empty
}
exports.activate = activate;
exports.deactivate = deactivate;
'@

$fixed = 0
Get-ChildItem -LiteralPath $extensionsRoot -Directory | ForEach-Object {
  $pkg = Join-Path $_.FullName "package.json"
  if (-not (Test-Path -LiteralPath $pkg)) { return }
  $main = (Get-Content -LiteralPath $pkg -Raw | ConvertFrom-Json).main
  if (-not $main) { return }
  $mainPath = Join-Path $_.FullName ($main -replace '^\./', '')
  if (-not $mainPath.EndsWith(".js")) {
    $mainPath = "$mainPath.js"
  }
  $outDir = Split-Path $mainPath -Parent
  if (-not (Test-Path -LiteralPath $mainPath)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    Set-Content -LiteralPath $mainPath -Value $stub -Encoding UTF8
    Write-Host "Stubbed: $mainPath"
    $fixed++
  } else {
    Write-Host "OK exists: $mainPath"
  }
}

Write-Host "Done. Stubs written: $fixed"
