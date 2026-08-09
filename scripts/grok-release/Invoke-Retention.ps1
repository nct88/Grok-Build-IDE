param(
	[string]$DistRoot,
	[string]$ProjectRoot,
	[int]$Keep = 2
)

$ErrorActionPreference = 'Stop'
if (-not $PSScriptRoot) { $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $ProjectRoot) {
	$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
if (-not $DistRoot) {
	$DistRoot = Join-Path $ProjectRoot 'dist'
}
if (-not (Test-Path -LiteralPath $DistRoot)) {
	Write-Host "Dist root missing (nothing to prune): $DistRoot"
	return
}

$versionDirs = Get-ChildItem -LiteralPath $DistRoot -Directory |
	Where-Object { $_.Name -match '^\d+\.\d+\.\d+' } |
	Sort-Object {
		# semver-ish: major*1e6 + minor*1e3 + patch
		if ($_.Name -match '^(?<a>\d+)\.(?<b>\d+)\.(?<c>\d+)') {
			[int]$Matches.a * 1000000 + [int]$Matches.b * 1000 + [int]$Matches.c
		} else { 0 }
	} -Descending

if ($versionDirs.Count -le $Keep) {
	Write-Host "Retention: $($versionDirs.Count) version(s) <= keep $Keep — no prune."
	return
}

$toRemove = $versionDirs | Select-Object -Skip $Keep
foreach ($dir in $toRemove) {
	Write-Host "Retention: removing old dist $($dir.FullName)"
	Remove-Item -LiteralPath $dir.FullName -Recurse -Force
}

Write-Host "Retention: kept $Keep newest version(s)."
