#Requires -Version 5.1
[CmdletBinding()]
param([string]$ProjectRoot)

$ErrorActionPreference = 'Stop'
if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }

Add-Type -AssemblyName System.Drawing

function Assert-True([bool]$Condition, [string]$Message) {
	if (-not $Condition) { throw $Message }
}

function Get-Sha256([string]$Path) {
	return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

$sourceMasterPath = Join-Path $ProjectRoot 'logo\fluffy-grok-master.png'
$finalMasterPath = Join-Path $ProjectRoot 'logo\processed\app-icon-master.png'
Assert-True (Test-Path -LiteralPath $sourceMasterPath) "Missing approved Fluffy master: $sourceMasterPath"
Assert-True (Test-Path -LiteralPath $finalMasterPath) "Missing final brand master: $finalMasterPath"
Assert-True (Test-Path -LiteralPath (Join-Path $ProjectRoot 'logo\source-fluffy-character.png')) 'Missing copied user-supplied Fluffy reference.'
$expectedSourceNames = @('app-icon-master.png', 'icon-16.png', 'icon-20.png', 'icon-24.png', 'icon-32.png', 'icon-40.png', 'icon-48.png', 'icon-64.png', 'icon-128.png', 'icon-256.png', 'icon-512.png')
$copiedSourceRoot = Join-Path $ProjectRoot 'logo\source-processed'
# The public-source cleanup intentionally removes this redundant internal copy.
# Validate it when present, while keeping the canonical master and every shipped
# platform/extension asset mandatory below.
if (Test-Path -LiteralPath $copiedSourceRoot -PathType Container) {
	$copiedSourceNames = @(Get-ChildItem -LiteralPath $copiedSourceRoot -File | Select-Object -ExpandProperty Name | Sort-Object)
	Assert-True (($copiedSourceNames -join '|') -eq (($expectedSourceNames | Sort-Object) -join '|')) 'The copied Grok Build processed set is incomplete or contains unexpected files.'
}
Assert-True ((Get-Sha256 $sourceMasterPath) -eq (Get-Sha256 $finalMasterPath)) 'Processed master is not an exact copy of the approved split Fluffy master.'

$final = [System.Drawing.Bitmap]::FromFile($finalMasterPath)
try {
	Assert-True ($final.PixelFormat -eq [System.Drawing.Imaging.PixelFormat]::Format32bppArgb) 'Final master must be 32-bit ARGB.'
	$rect = New-Object System.Drawing.Rectangle 0, 0, $final.Width, $final.Height
	$finalData = $final.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$finalBytes = New-Object byte[] ([Math]::Abs($finalData.Stride) * $final.Height)
	[System.Runtime.InteropServices.Marshal]::Copy($finalData.Scan0, $finalBytes, 0, $finalBytes.Length)
	$final.UnlockBits($finalData)
	$white = 0
	$black = 0
	$leftWhite = 0
	$rightBlack = 0
	$greenSpill = 0
	for ($y = 0; $y -lt $final.Height; $y += 2) {
		for ($x = 0; $x -lt $final.Width; $x += 2) {
			$finalOffset = ($y * $finalData.Stride) + ($x * 4)
			$alpha = $finalBytes[$finalOffset + 3]
			$red = $finalBytes[$finalOffset + 2]
			$green = $finalBytes[$finalOffset + 1]
			$blue = $finalBytes[$finalOffset]
			if ($alpha -gt 200 -and $red -gt 225 -and $green -gt 225 -and $blue -gt 225) {
				$white++
				if ($x -lt ($final.Width / 2)) { $leftWhite++ }
			}
			if ($alpha -gt 200 -and $red -lt 30 -and $green -lt 30 -and $blue -lt 30) {
				$black++
				if ($x -ge ($final.Width / 2)) { $rightBlack++ }
			}
			if ($alpha -gt 40 -and $green -gt 120 -and $green -gt ($red * 1.5) -and $green -gt ($blue * 1.5)) { $greenSpill++ }
		}
	}
	Assert-True ($finalBytes[3] -eq 0 -and $finalBytes[$finalBytes.Length - 1] -eq 0) 'Final master corners are not transparent.'
	Assert-True ($white -gt 25000 -and $leftWhite -gt 20000) "White/left Fluffy coverage is too low: white=$white left=$leftWhite"
	Assert-True ($black -gt 25000 -and $rightBlack -gt 20000) "Black/right Fluffy coverage is too low: black=$black right=$rightBlack"
	Assert-True ($greenSpill -lt 300) "Chroma-key spill remains visible: $greenSpill sampled pixels"
} finally {
	$final.Dispose()
}

foreach ($size in @(16, 20, 24, 32, 40, 48, 64, 128, 256, 512)) {
	$path = Join-Path $ProjectRoot "logo\processed\icon-$size.png"
	Assert-True (Test-Path -LiteralPath $path) "Missing processed icon-$size.png"
	$image = [System.Drawing.Image]::FromFile($path)
	try { Assert-True ($image.Width -eq $size -and $image.Height -eq $size) "Invalid icon-$size.png dimensions." }
	finally { $image.Dispose() }
}

$windowsIcon = Join-Path $ProjectRoot 'resources\win32\code.ico'
$serverIcon = Join-Path $ProjectRoot 'resources\server\favicon.ico'
Assert-True ((Get-Sha256 $windowsIcon) -eq (Get-Sha256 $serverIcon)) 'Server favicon does not match the Windows app icon set.'
$icoBytes = [System.IO.File]::ReadAllBytes($windowsIcon)
Assert-True ($icoBytes.Length -gt 100000) 'Windows ICO is unexpectedly small.'
$icoCount = [BitConverter]::ToUInt16($icoBytes, 4)
Assert-True ($icoCount -eq 9) "Windows ICO must contain 9 DPI frames; found $icoCount."

$linuxIcon = Join-Path $ProjectRoot 'resources\linux\code.png'
$linux = [System.Drawing.Image]::FromFile($linuxIcon)
try { Assert-True ($linux.Width -eq 1024 -and $linux.Height -eq 1024) 'Linux app icon must be 1024x1024.' }
finally { $linux.Dispose() }

$macIcon = Join-Path $ProjectRoot 'resources\darwin\code.icns'
$icnsBytes = [System.IO.File]::ReadAllBytes($macIcon)
Assert-True ([Text.Encoding]::ASCII.GetString($icnsBytes, 0, 4) -eq 'icns') 'macOS icon has an invalid ICNS header.'
$icnsText = [Text.Encoding]::ASCII.GetString($icnsBytes)
foreach ($chunk in @('icp4', 'icp5', 'icp6', 'ic07', 'ic08', 'ic09', 'ic10')) {
	Assert-True ($icnsText.Contains($chunk)) "macOS icon is missing $chunk."
}

$extensionLogo = Join-Path $ProjectRoot 'extensions\grok-build-workbench\logo\grok-fluffy.png'
$processed128 = Join-Path $ProjectRoot 'logo\processed\icon-128.png'
Assert-True ((Get-Sha256 $extensionLogo) -eq (Get-Sha256 $processed128)) 'Extension logo is not the canonical processed 128px asset.'

$package = Get-Content -LiteralPath (Join-Path $ProjectRoot 'extensions\grok-build-workbench\package.json') -Raw | ConvertFrom-Json
Assert-True ($package.icon -eq 'logo/grok-fluffy.png') 'VSIX marketplace icon is not the Fluffy logo.'
$grokContainer = @($package.contributes.viewsContainers.secondarySidebar) | Where-Object { $_.id -eq 'grokBuild' }
Assert-True ($grokContainer.icon -eq 'logo/grok-fluffy.png') 'Grok Build view container is not using the Fluffy logo.'

$liveBrandFiles = @(
	(Join-Path $ProjectRoot 'resources\grok-workbench-logo.svg')
	(Join-Path $ProjectRoot 'extensions\grok-build-workbench\logo\grok.svg')
	(Join-Path $ProjectRoot 'extensions\grok-build-workbench\src\vscode\chatViewProvider.ts')
	(Join-Path $ProjectRoot 'extensions\grok-build-workbench\test\visual\harness.html')
)
foreach ($path in $liveBrandFiles) {
	$content = Get-Content -LiteralPath $path -Raw
	Assert-True (-not $content.Contains('M9.27 15.29l7.978-5.897')) "Legacy Grok glyph remains in $path"
}

Write-Host 'Brand assets OK: split white/black Fluffy master, inverse Grok lettering, alpha/chroma validation, 10 PNG sizes, 9-frame ICO, 7-frame ICNS, installer/server/extension references aligned.'
