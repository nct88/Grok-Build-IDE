# Hot-verify terminal fix + optional full release 0.3.10
# Run from a normal PowerShell/Windows Terminal (not inside a broken agent shell):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/hotpatch-and-build-0.3.10.ps1
# Optional:
#   -NodeExecutable C:\path\to\node.exe

param(
	[string]$NodeExecutable
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$extensionRoot = Join-Path $projectRoot 'extensions/grok-build-workbench'

function Resolve-NodeExecutable([string]$preferred) {
	$candidates = @()
	if ($preferred) { $candidates += $preferred }
	$fromPath = Get-Command node -ErrorAction SilentlyContinue
	if ($fromPath) { $candidates += $fromPath.Source }
	$candidates += @(
		(Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'),
		'C:\Program Files\nodejs\node.exe',
		'C:\Program Files (x86)\nodejs\node.exe'
	)
	foreach ($candidate in $candidates) {
		if ($candidate -and (Test-Path -LiteralPath $candidate)) {
			return (Resolve-Path -LiteralPath $candidate).Path
		}
	}
	throw @"
Node.js was not found on PATH and no known fallback node.exe exists.
Pass -NodeExecutable with an absolute path, for example:
  -NodeExecutable `"$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`"
"@
}

$node = Resolve-NodeExecutable $NodeExecutable
Write-Host "Using Node: $node"

Push-Location $extensionRoot
try {
	Write-Host '== typecheck =='
	& $node './node_modules/typescript/bin/tsc' --noEmit
	if ($LASTEXITCODE -ne 0) { throw "typecheck failed: $LASTEXITCODE" }

	Write-Host '== tests =='
	& $node './node_modules/vitest/vitest.mjs' run
	if ($LASTEXITCODE -ne 0) { throw "tests failed: $LASTEXITCODE" }

	Write-Host '== production bundle =='
	& $node './esbuild.mjs' --production
	if ($LASTEXITCODE -ne 0) { throw "bundle failed: $LASTEXITCODE" }

	$bundle = Get-Content -Raw -LiteralPath (Join-Path $extensionRoot 'dist/extension.cjs')
	if ($bundle -notmatch '"/d","/s","/c"') {
		throw 'Production bundle is missing the Windows ComSpec terminal wrapper.'
	}
} finally {
	Pop-Location
}

$liveCache = Join-Path $env:LOCALAPPDATA 'Grok Workbench Portable\0.3.9\0EAD37C047506F51\grok-workbench-poc-0.3.9\data\extensions\local-grok-workbench.grok-build-workbench-0.8.3\dist\extension.cjs'
if (Test-Path -LiteralPath $liveCache) {
	Copy-Item -Force -LiteralPath (Join-Path $extensionRoot 'dist/extension.cjs') -Destination $liveCache
	Write-Host "Hot-patched live portable cache: $liveCache"
	Write-Host 'Reload Grok Workbench window (Developer: Reload Window) to pick up the fix.'
} else {
	Write-Host "Live portable cache not found at: $liveCache"
}

$base = Join-Path $projectRoot '.build/release-candidates/0.3.9-final/payload/grok-workbench-poc-0.3.9'
if (-not (Test-Path -LiteralPath $base)) {
	Write-Host "Base candidate missing ($base). Skipping full 0.3.10 package."
	return
}

Write-Host '== release 0.3.10 =='
& (Join-Path $PSScriptRoot 'build-grok-workbench-release.ps1') `
	-Version 0.3.10 `
	-NodeExecutable $node `
	-BaseCandidateRoot $base `
	-WorkDirectory (Join-Path $projectRoot '.build/release-candidates/0.3.10-final')
