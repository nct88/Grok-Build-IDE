param(
	[Parameter(Mandatory = $true)][ValidatePattern('^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$')][string]$Version,
	[string]$ProjectRoot,
	[string]$DistRoot,
	[string]$CandidateRoot,
	[string]$ReleaseBaseUrl = '',
	[switch]$PublicRelease
)

$ErrorActionPreference = 'Stop'
if (-not $PSScriptRoot) { $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
if (-not $DistRoot) { $DistRoot = Join-Path $ProjectRoot 'dist' }
if (-not $CandidateRoot) { $CandidateRoot = Join-Path $ProjectRoot ".build\release-candidates\$Version" }
$candidate = (Resolve-Path -LiteralPath $CandidateRoot).Path

$portableSrc = Join-Path $candidate "single-exe\Grok-Build-IDE-$Version-win32-x64-portable.exe"
$installSrc = Join-Path $candidate "inno-installer\Grok-Build-IDE-Setup-$Version.exe"
$payloadZip = Join-Path $candidate "payload\Grok-Build-IDE-$Version-win32-x64-portable.zip"
$vsixSrc = Get-ChildItem (Join-Path $candidate 'extension') -Filter '*.vsix' -ErrorAction SilentlyContinue | Select-Object -First 1
foreach ($required in @($portableSrc, $installSrc, $payloadZip)) {
	if (-not (Test-Path -LiteralPath $required)) { throw "Required release artifact is missing: $required" }
}
if (-not $vsixSrc) { throw "Required VSIX update artifact is missing under $candidate\extension" }

if ($ReleaseBaseUrl -and $ReleaseBaseUrl -notmatch '^https?://') {
	throw 'ReleaseBaseUrl must be an HTTP(S) URL.'
}
if ($PublicRelease) {
	if ($ReleaseBaseUrl -notmatch '^https://') { throw 'PublicRelease requires an HTTPS ReleaseBaseUrl.' }
	foreach ($signedArtifact in @($portableSrc, $installSrc)) {
		$signature = Get-AuthenticodeSignature -LiteralPath $signedArtifact
		if ($signature.Status -ne 'Valid') { throw "Public release artifact is not signed: $signedArtifact ($($signature.Status))" }
	}
}

$versionRoot = Join-Path $DistRoot $Version
if (Test-Path -LiteralPath $versionRoot) {
	throw "Release $Version already exists at $versionRoot. Published versions are immutable."
}
$portableDir = Join-Path $versionRoot 'portable'
$installDir = Join-Path $versionRoot 'install'
$updateDir = Join-Path $versionRoot 'update'
foreach ($directory in @($portableDir, $installDir, $updateDir)) {
	New-Item -ItemType Directory -Path $directory | Out-Null
}

function Write-JsonNoBom([string]$Path, $Value, [int]$Depth = 10) {
	$json = ($Value | ConvertTo-Json -Depth $Depth) + "`n"
	[System.IO.File]::WriteAllText($Path, $json, [System.Text.UTF8Encoding]::new($false))
}

function Copy-ChannelFile([string]$Source, [string]$DestinationDirectory, [string]$RelativeDirectory) {
	$destination = Join-Path $DestinationDirectory (Split-Path $Source -Leaf)
	Copy-Item -LiteralPath $Source -Destination $destination
	$item = Get-Item -LiteralPath $destination
	return [ordered]@{
		file = $item.Name
		relativePath = "$RelativeDirectory/$($item.Name)"
		sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash
		bytes = $item.Length
	}
}

$portable = Copy-ChannelFile $portableSrc $portableDir 'portable'
$portableArchive = Copy-ChannelFile $payloadZip $portableDir 'portable'
$installer = Copy-ChannelFile $installSrc $installDir 'install'
$vsix = Copy-ChannelFile $vsixSrc.FullName $updateDir 'update'
$applyTemplate = Join-Path $ProjectRoot 'scripts\templates\apply-update.ps1'
if (-not (Test-Path -LiteralPath $applyTemplate)) { throw "Missing apply-update template: $applyTemplate" }
Copy-Item -LiteralPath $applyTemplate -Destination (Join-Path $updateDir 'apply-update.ps1')
$changeLog = Join-Path $ProjectRoot 'CHANGELOG.md'
if (Test-Path -LiteralPath $changeLog) { Copy-Item -LiteralPath $changeLog -Destination (Join-Path $updateDir 'CHANGELOG.md') }

$publishedAt = (Get-Date).ToString('o')
$manifest = [ordered]@{
	version = $Version
	product = 'Grok Build IDE'
	publishedAt = $publishedAt
	releaseStatus = if ($PublicRelease) { 'public-signed' } else { 'local-unsigned-candidate' }
	channels = [ordered]@{
		portable = [ordered]@{ exe = $portable; zip = $portableArchive }
		install = [ordered]@{ setup = $installer }
		update = [ordered]@{ vsix = $vsix; apply = 'update/apply-update.ps1'; strategy = 'merge-extension-registry' }
	}
}
$manifestPath = Join-Path $versionRoot 'MANIFEST.json'
Write-JsonNoBom $manifestPath $manifest

$relativeDownload = "$Version/$($portable.relativePath)"
$downloadUrl = if ($ReleaseBaseUrl) { $ReleaseBaseUrl.TrimEnd('/') + '/' + $relativeDownload } else { $relativeDownload }
$latest = [ordered]@{
	version = $Version
	product = 'Grok Build IDE'
	url = $downloadUrl
	manifest = "$Version/MANIFEST.json"
	publishedAt = $publishedAt
	releaseStatus = $manifest.releaseStatus
	channels = @('portable', 'install', 'update')
}
Write-JsonNoBom (Join-Path $DistRoot 'latest.json') $latest
Write-JsonNoBom (Join-Path $versionRoot 'latest.json') $latest

[pscustomobject]@{
	Version = $Version
	DistRoot = $versionRoot
	Manifest = $manifestPath
	Status = $manifest.releaseStatus
}
