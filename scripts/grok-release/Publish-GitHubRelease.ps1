param(
	[Parameter(Mandatory = $true)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
	[Parameter(Mandatory = $true)][string]$NotesFile,
	[string]$ProjectRoot,
	[string]$DistRoot,
	[string]$Branch = 'main',
	[switch]$AllowUnsignedPublicRelease
)

$ErrorActionPreference = 'Stop'
if (-not $PSScriptRoot) { $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
if (-not $DistRoot) { $DistRoot = Join-Path $ProjectRoot 'dist' }
$NotesFile = (Resolve-Path -LiteralPath $NotesFile).Path
$versionRoot = (Resolve-Path -LiteralPath (Join-Path $DistRoot $Version)).Path
$manifestPath = Join-Path $versionRoot 'MANIFEST.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw "Release manifest missing: $manifestPath" }

$sourceVersion = (Get-Content -LiteralPath (Join-Path $ProjectRoot 'build\grok\VERSION') -Raw).Trim()
if ($sourceVersion -ne $Version) { throw "Version $Version does not match build/grok/VERSION ($sourceVersion)." }
$commit = (& git -C $ProjectRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[0-9a-fA-F]{40}$') { throw 'Unable to resolve HEAD.' }
if (@(& git -C $ProjectRoot status --porcelain --untracked-files=normal).Count -gt 0) {
	throw 'GitHub publication requires a clean worktree.'
}

& git -C $ProjectRoot fetch origin $Branch --quiet
if ($LASTEXITCODE -ne 0) { throw "Unable to fetch origin/$Branch." }
$remoteCommit = (& git -C $ProjectRoot rev-parse "origin/$Branch").Trim()
if ($remoteCommit -ne $commit) { throw "HEAD $commit is not origin/$Branch $remoteCommit." }

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.version -ne $Version -or $manifest.releaseStatus -notin @('public-signed','public-unsigned')) {
	throw 'GitHub publication requires a matching public release dist manifest.'
}
if ($manifest.releaseStatus -eq 'public-unsigned' -and -not $AllowUnsignedPublicRelease) {
	throw 'Publishing a public-unsigned manifest requires -AllowUnsignedPublicRelease.'
}
if ($manifest.releaseStatus -eq 'public-signed' -and $AllowUnsignedPublicRelease) {
	throw 'The unsigned waiver was supplied for a signed manifest.'
}
if ($manifest.source.commit -ne $commit -or $manifest.source.dirty) {
	throw 'Dist manifest source provenance does not match clean HEAD.'
}
$versionRootPrefix = $versionRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
$baseProvenancePath = (Resolve-Path -LiteralPath (Join-Path $versionRoot ([string]$manifest.base.provenanceFile))).Path
if (-not $baseProvenancePath.StartsWith($versionRootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
	throw 'Base provenance path escapes the version root.'
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $baseProvenancePath).Hash -ne [string]$manifest.base.provenanceSha256) {
	throw 'Base provenance SHA-256 does not match the dist manifest.'
}
$baseProvenance = Get-Content -LiteralPath $baseProvenancePath -Raw | ConvertFrom-Json
if ($baseProvenance.source.commit -ne $commit -or [bool]$baseProvenance.source.dirty) {
	throw 'Base provenance does not match clean HEAD.'
}
if ($baseProvenance.base.productSha256 -ne $manifest.base.productSha256 -or $baseProvenance.base.executableSha256 -ne $manifest.base.executableSha256) {
	throw 'Base hashes in the dist manifest do not match BASE-PROVENANCE.json.'
}

$artifactPaths = @()
foreach ($channel in @($manifest.channels.portable.exe, $manifest.channels.portable.zip, $manifest.channels.install.setup, $manifest.channels.update.vsix)) {
	$relative = [string]$channel.relativePath
	$artifact = (Resolve-Path -LiteralPath (Join-Path $versionRoot $relative)).Path
	if (-not $artifact.StartsWith($versionRootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
		throw "Manifest artifact escapes the version root: $relative"
	}
	$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifact).Hash
	if ($actualHash -ne [string]$channel.sha256) { throw "SHA-256 mismatch: $relative" }
	$artifactPaths += $artifact
}
if ($manifest.releaseStatus -eq 'public-signed') { foreach ($signedArtifact in @(
	[pscustomobject]@{ Name = 'portable'; Path = $artifactPaths[0] },
	[pscustomobject]@{ Name = 'setup'; Path = $artifactPaths[2] }
)) {
	$signature = Get-AuthenticodeSignature -LiteralPath $signedArtifact.Path
	$recorded = $manifest.signatures.PSObject.Properties[$signedArtifact.Name].Value
	if ($signature.Status -ne 'Valid' -or -not $signature.TimeStamperCertificate) { throw "GitHub publication requires a valid timestamped signature: $($signedArtifact.Path)" }
	if ($signature.SignerCertificate.Thumbprint -ne $recorded.signerThumbprint) { throw "Signer thumbprint differs from the dist manifest: $($signedArtifact.Path)" }
} } else {
	if (-not $manifest.signatures.waiver.warning) { throw 'Unsigned public manifest is missing its signing waiver warning.' }
	Write-Warning $manifest.signatures.waiver.warning
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI (gh) is required.' }
& gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not authenticated.' }

Write-Host 'Running the authenticated real-Grok ACP smoke test...'
& npm --prefix (Join-Path $ProjectRoot 'extensions\grok-build-workbench') run test:real-grok
if ($LASTEXITCODE -ne 0) { throw 'Real Grok ACP smoke test failed; publication is blocked.' }

Write-Host "Dispatching release validation for $commit..."
& gh workflow run release.yml --ref $Branch -f "version=$Version"
if ($LASTEXITCODE -ne 0) { throw 'Unable to dispatch release validation.' }
$run = $null
for ($attempt = 0; $attempt -lt 12 -and -not $run; $attempt++) {
	Start-Sleep -Seconds 5
	$runs = & gh run list --workflow release.yml --branch $Branch --event workflow_dispatch --limit 10 --json databaseId,headSha,status,conclusion,createdAt | ConvertFrom-Json
	$run = $runs | Where-Object { $_.headSha -eq $commit } | Sort-Object createdAt -Descending | Select-Object -First 1
}
if (-not $run) { throw 'Could not locate the dispatched release validation run.' }
& gh run watch $run.databaseId --exit-status
if ($LASTEXITCODE -ne 0) { throw "Release validation failed (run $($run.databaseId))." }

$tag = "v$Version"
$existingTag = & git -C $ProjectRoot ls-remote --tags origin "refs/tags/$tag"
if ($LASTEXITCODE -ne 0) { throw "Unable to check remote tag $tag." }
if ($existingTag) { throw "Remote tag already exists: $tag" }
& gh release view $tag --json url 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { throw "GitHub release already exists: $tag" }

$assets = @($artifactPaths + $manifestPath + $baseProvenancePath)
& gh release create $tag @assets --target $commit --title "Grok Build IDE $Version" --notes-file $NotesFile --latest
if ($LASTEXITCODE -ne 0) { throw "GitHub release publication failed: $tag" }
Write-Host "Published $tag only after release validation succeeded on $commit."
