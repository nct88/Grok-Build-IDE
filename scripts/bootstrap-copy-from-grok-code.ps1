#Requires -Version 5.1
<#
.SYNOPSIS
  Copy source from H:\projects\grok-code into this grok-build-ide tree.

.DESCRIPTION
  Excludes heavy/generated dirs (node_modules, releases, build caches, *.vsix).
  Run once after cloning or when re-syncing from grok-code.
#>
param(
  [string]$Source = "H:\projects\grok-code",
  [string]$Destination = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) + "\grok-build-ide",
  [switch]$IncludeGit
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Source)) {
  throw "Source not found: $Source"
}

# Prefer script-adjacent destination (repo root of grok-build-ide)
$repoRoot = Split-Path $PSScriptRoot -Parent
if (Test-Path -LiteralPath (Join-Path $repoRoot "scripts\bootstrap-copy-from-grok-code.ps1")) {
  $Destination = $repoRoot
}

Write-Host "Copying source:"
Write-Host "  from: $Source"
Write-Host "  to:   $Destination"

$excludeDirs = @(
  "node_modules",
  "out",
  ".build",
  "releases",
  "dist",
  ".cache",
  ".turbo",
  ".project-memory",
  "build\node_modules",
  "build\rspack",
  "build\grok"
)
if (-not $IncludeGit) {
  $excludeDirs += ".git"
}

$xd = ($excludeDirs | ForEach-Object { $_ }) -join " "

# robocopy: /E copy subdirs including empty; exit 0-7 = success
$args = @(
  $Source,
  $Destination,
  "/E",
  "/XD"
) + $excludeDirs + @(
  "/XF", "*.vsix",
  "/R:1", "/W:1",
  "/MT:8",
  "/NFL", "/NDL", "/NP", "/NJH"
)

& robocopy @args
$code = $LASTEXITCODE
if ($code -ge 8) {
  throw "robocopy failed with exit code $code"
}

Write-Host "Copy complete (robocopy exit $code)."
Write-Host "Next steps:"
Write-Host "  1. cd $Destination"
Write-Host "  2. npm install   (root) and build/npm if needed"
Write-Host "  3. pnpm install / npm run build in extensions\grok-build-workbench"
Write-Host "  4. .\scripts\compile-workspace-extensions.ps1  (fixes out\extension.js warnings)"
