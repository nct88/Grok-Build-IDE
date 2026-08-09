param(
	[string]$ProjectRoot,
	[switch]$KeepLatestBase,
	[string]$KeepVersion = '0.3.12'
)

$ErrorActionPreference = 'Stop'
if (-not $PSScriptRoot) { $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $ProjectRoot) {
	$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
$buildRoot = Join-Path $ProjectRoot '.build'
if (-not (Test-Path $buildRoot)) {
	Write-Host 'No .build directory.'
	return
}

$removed = [System.Collections.Generic.List[string]]::new()

function Remove-PathSafe([string]$path) {
	if (Test-Path -LiteralPath $path) {
		Write-Host "REMOVE $path"
		Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
		$script:removed.Add($path)
	}
}

# Debug / verify / POC clutter
$patterns = @(
	'debug-*',
	'poc-*',
	'verify-*',
	'release-verify-*',
	'release-runtime-*',
	'release-relocated-*',
	'release-validation-*',
	'release-archive-*',
	'archived-*',
	'packaged-ui-*',
	'extension-0.*',
	'feature-audit-*',
	'chat-context-*',
	'ignored-*',
	'package-shims',
	'runtime-single-exe-cache',
	'single-exe-portable',
	'superseded-*',
	'vscodium-base',
	'Relocated Single EXE Test',
	'rcedit',
	'grok-icons',
	'portable-staging-*',
	'grok-build-workbench-pre-*'
)
foreach ($pat in $patterns) {
	Get-ChildItem -LiteralPath $buildRoot -Directory -ErrorAction SilentlyContinue |
		Where-Object { $_.Name -like $pat } |
		ForEach-Object { Remove-PathSafe $_.FullName }
}

# Old base poc trees except keep latest if requested
Get-ChildItem -LiteralPath $buildRoot -Directory -Filter 'grok-workbench-poc-*' -ErrorAction SilentlyContinue |
	ForEach-Object {
		if ($KeepLatestBase -and $_.Name -eq "grok-workbench-poc-$KeepVersion") { return }
		# Always drop very old pocs; keep only the KeepVersion base if present
		if ($KeepLatestBase -and $_.Name -match 'grok-workbench-poc-0\.3\.12') { return }
		Remove-PathSafe $_.FullName
	}

# Release candidates: keep only KeepVersion and newer if any
$rcRoot = Join-Path $buildRoot 'release-candidates'
if (Test-Path $rcRoot) {
	Get-ChildItem -LiteralPath $rcRoot -Directory | ForEach-Object {
		$name = $_.Name
		# Keep 0.3.12 and any 0.3.13+ work dirs
		if ($name -match '^0\.3\.1[2-9]' -or $name -match '^0\.[4-9]') {
			Write-Host "KEEP candidate $($_.FullName)"
			return
		}
		Remove-PathSafe $_.FullName
	}
}

# Legacy releases/ folder (artifacts now live under dist/)
$localReleases = Join-Path $ProjectRoot 'releases'
if (Test-Path $localReleases) {
	Remove-PathSafe $localReleases
}

# Temp screenshots
$temp = Join-Path $ProjectRoot 'temp'
if (Test-Path $temp) {
	Remove-PathSafe $temp
}

[pscustomobject]@{
	RemovedCount = $removed.Count
	Removed = $removed
	Status = 'cleaned'
}
