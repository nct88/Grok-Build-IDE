param(
	[Parameter(Mandatory = $true)][ValidatePattern('^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$')][string]$Version,
	[string]$ProjectRoot,
	[string]$DistRoot,
	[string]$CandidateRoot,
	[string]$ReleaseBaseUrl = '',
	[string]$SourceCommit = '',
	[bool]$SourceDirty = $true,
	[string]$BaseProductSha256 = '',
	[string]$BaseExecutableSha256 = '',
	[string]$BasePackageVersion = '',
	[string]$BaseProvenancePath = '',
	[switch]$AllowUnsignedPublicRelease,
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
if (-not $BaseProvenancePath -or -not (Test-Path -LiteralPath $BaseProvenancePath -PathType Leaf)) {
	throw 'A verified .grok-base-provenance.json is required for every release candidate.'
}
$BaseProvenancePath = (Resolve-Path -LiteralPath $BaseProvenancePath).Path
$baseProvenance = Get-Content -LiteralPath $BaseProvenancePath -Raw | ConvertFrom-Json
$baseProvenanceSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $BaseProvenancePath).Hash

if ($ReleaseBaseUrl -and $ReleaseBaseUrl -notmatch '^https?://') {
	throw 'ReleaseBaseUrl must be an HTTP(S) URL.'
}
$signatureManifest = [ordered]@{}
if ($PublicRelease) {
	if ($AllowUnsignedPublicRelease) {
		$signatureManifest.waiver = [ordered]@{
			reason = 'Publisher explicitly authorized an unsigned public release.'
			warning = 'Windows SmartScreen may warn. Verify SHA-256 values from MANIFEST.json before execution.'
		}
	}
	if ($ReleaseBaseUrl -notmatch '^https://') { throw 'PublicRelease requires an HTTPS ReleaseBaseUrl.' }
	if ($SourceDirty) { throw 'PublicRelease requires clean source provenance.' }
	if ($SourceCommit -notmatch '^[0-9a-fA-F]{40}$') { throw 'PublicRelease requires a full source Git commit.' }
	if ($BaseProductSha256 -notmatch '^[0-9a-fA-F]{64}$') { throw 'PublicRelease requires a base product SHA-256.' }
	if ($BaseExecutableSha256 -notmatch '^[0-9a-fA-F]{64}$') { throw 'PublicRelease requires a base executable SHA-256.' }
	if ($baseProvenance.source.commit -ne $SourceCommit -or [bool]$baseProvenance.source.dirty) { throw 'PublicRelease base provenance must match the clean source commit.' }
	if (-not $AllowUnsignedPublicRelease) { foreach ($signedArtifact in @(
		[pscustomobject]@{ Name = 'portable'; Path = $portableSrc },
		[pscustomobject]@{ Name = 'setup'; Path = $installSrc }
	)) {
		$signature = Get-AuthenticodeSignature -LiteralPath $signedArtifact.Path
		if ($signature.Status -ne 'Valid') { throw "Public release artifact is not signed: $($signedArtifact.Path) ($($signature.Status))" }
		if (-not $signature.TimeStamperCertificate) { throw "Public release artifact is not timestamped: $($signedArtifact.Path)" }
		$signatureManifest[$signedArtifact.Name] = [ordered]@{
			status = $signature.Status.ToString()
			signerThumbprint = $signature.SignerCertificate.Thumbprint
			signerSubject = $signature.SignerCertificate.Subject
			timestampSubject = $signature.TimeStamperCertificate.Subject
		}
	} }
} elseif ($AllowUnsignedPublicRelease) {
	throw 'AllowUnsignedPublicRelease is valid only together with -PublicRelease.'
}

$finalVersionRoot = Join-Path $DistRoot $Version
if (Test-Path -LiteralPath $finalVersionRoot) {
	throw "Release $Version already exists at $finalVersionRoot. Published versions are immutable."
}
$distFullPath = [IO.Path]::GetFullPath($DistRoot)
New-Item -ItemType Directory -Force -Path $distFullPath | Out-Null
$versionRoot = Join-Path $distFullPath (".staging-{0}-{1}" -f $Version, [guid]::NewGuid().ToString('n'))
$distPrefix = $distFullPath.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
if (-not $versionRoot.StartsWith($distPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe dist staging path.' }
$portableDir = Join-Path $versionRoot 'portable'
$installDir = Join-Path $versionRoot 'install'
$updateDir = Join-Path $versionRoot 'update'
foreach ($directory in @($portableDir, $installDir, $updateDir)) {
	New-Item -ItemType Directory -Path $directory | Out-Null
}
Copy-Item -LiteralPath $BaseProvenancePath -Destination (Join-Path $versionRoot 'BASE-PROVENANCE.json')

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
$rollbackTemplate = Join-Path $ProjectRoot 'scripts\templates\rollback-update.ps1'
if (-not (Test-Path -LiteralPath $rollbackTemplate)) { throw "Missing rollback-update template: $rollbackTemplate" }
Copy-Item -LiteralPath $rollbackTemplate -Destination (Join-Path $updateDir 'rollback-update.ps1')
$changeLog = Join-Path $ProjectRoot 'CHANGELOG.md'
if (Test-Path -LiteralPath $changeLog) { Copy-Item -LiteralPath $changeLog -Destination (Join-Path $updateDir 'CHANGELOG.md') }

$publishedAt = (Get-Date).ToString('o')
$manifest = [ordered]@{
	version = $Version
	product = 'Grok Build IDE'
	publishedAt = $publishedAt
	releaseStatus = if ($PublicRelease -and $AllowUnsignedPublicRelease) { 'public-unsigned' } elseif ($PublicRelease) { 'public-signed' } else { 'local-unsigned-candidate' }
	source = [ordered]@{
		commit = $SourceCommit
		dirty = $SourceDirty
	}
	base = [ordered]@{
		productSha256 = $BaseProductSha256
		executableSha256 = $BaseExecutableSha256
		packageVersion = $BasePackageVersion
		provenanceFile = 'BASE-PROVENANCE.json'
		provenanceSha256 = $baseProvenanceSha256
	}
	signatures = $signatureManifest
	channels = [ordered]@{
		portable = [ordered]@{ exe = $portable; zip = $portableArchive }
		install = [ordered]@{ setup = $installer }
		update = [ordered]@{ vsix = $vsix; apply = 'update/apply-update.ps1'; rollback = 'update/rollback-update.ps1'; strategy = 'hash-verified-atomic-with-backup' }
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
Write-JsonNoBom (Join-Path $versionRoot 'latest.json') $latest

Move-Item -LiteralPath $versionRoot -Destination $finalVersionRoot
$latestTemp = Join-Path $distFullPath (".latest-{0}.json" -f [guid]::NewGuid().ToString('n'))
Write-JsonNoBom $latestTemp $latest
Move-Item -Force -LiteralPath $latestTemp -Destination (Join-Path $distFullPath 'latest.json')

[pscustomobject]@{
	Version = $Version
	DistRoot = $finalVersionRoot
	Manifest = Join-Path $finalVersionRoot 'MANIFEST.json'
	Status = $manifest.releaseStatus
}
