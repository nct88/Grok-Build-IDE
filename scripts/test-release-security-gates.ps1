param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$buildRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot '.build')).Path
$testRoot = Join-Path $buildRoot ("release-security-gates-{0}" -f [guid]::NewGuid().ToString('n'))
if (-not ([IO.Path]::GetFullPath($testRoot)).StartsWith($buildRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test root.' }

function Json([string]$Path, $Value) {
	[IO.File]::WriteAllText($Path, (($Value | ConvertTo-Json -Depth 10) + "`n"), [Text.UTF8Encoding]::new($false))
}
function Assert([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Expect-Failure([scriptblock]$Action, [string[]]$Pattern, [string]$FailureMessage) {
	try {
		& $Action
		throw $FailureMessage
	} catch {
		if ($_.Exception.Message -eq $FailureMessage) { throw }
		$message = $_.Exception.Message
		$matched = @($Pattern | Where-Object { $message -like $_ }).Count -gt 0
		if (-not $matched) { throw "Unexpected gate failure: $message" }
	}
}

try {
	$baseRoot = Join-Path $testRoot 'base'
	$appRoot = Join-Path $baseRoot 'resources\app'
	New-Item -ItemType Directory -Force -Path $appRoot | Out-Null
	Copy-Item -LiteralPath (Join-Path $projectRoot 'product.json') -Destination (Join-Path $appRoot 'product.json')
	Copy-Item -LiteralPath (Join-Path $projectRoot 'package.json') -Destination (Join-Path $appRoot 'package.json')
	$executable = Join-Path $baseRoot 'Grok Build IDE.exe'
	[IO.File]::WriteAllBytes($executable, [byte[]](1,2,3,4))
	$commit = (& git -C $projectRoot rev-parse HEAD).Trim()
	$packageVersion = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
	$provenance = [ordered]@{
		schemaVersion = 1
		source = [ordered]@{ commit=$commit; dirty=$true; packageVersion=$packageVersion }
		base = [ordered]@{
			packageVersion=$packageVersion
			productSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $appRoot 'product.json')).Hash
			executableSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $executable).Hash
		}
	}
	Json (Join-Path $baseRoot '.grok-base-provenance.json') $provenance

	$result = & (Join-Path $projectRoot 'scripts\grok-release\Test-CodeOssBaseProvenance.ps1') -ProjectRoot $projectRoot -BaseCandidateRoot $baseRoot
	if ($result.Status -ne 'verified-development-base') { throw "Expected verified-development-base, received $($result.Status)." }
	Expect-Failure {
		& (Join-Path $projectRoot 'scripts\grok-release\Test-CodeOssBaseProvenance.ps1') -ProjectRoot $projectRoot -BaseCandidateRoot $baseRoot -RequireClean
	} @('*requires a clean source worktree*','*cannot have dirty-source provenance*') 'Dirty base provenance unexpectedly passed the public gate.'

	$releaseVersion = '9.9.9'
	$candidate = Join-Path $testRoot 'candidate'
	$dist = Join-Path $testRoot 'dist'
	$artifactMap = [ordered]@{
		"single-exe\Grok-Build-IDE-$releaseVersion-win32-x64-portable.exe" = [byte[]](1,2,3)
		"inno-installer\Grok-Build-IDE-Setup-$releaseVersion.exe" = [byte[]](4,5,6)
		"payload\Grok-Build-IDE-$releaseVersion-win32-x64-portable.zip" = [byte[]](7,8,9)
		'extension\grok-build-workbench-9.9.9.vsix' = [byte[]](10,11,12)
	}
	foreach ($entry in $artifactMap.GetEnumerator()) {
		$path = Join-Path $candidate $entry.Key
		New-Item -ItemType Directory -Force -Path (Split-Path $path -Parent) | Out-Null
		[IO.File]::WriteAllBytes($path, $entry.Value)
	}
	$cleanProvenance = $provenance.PSObject.Copy()
	$cleanProvenance.source = [ordered]@{ commit=$commit; dirty=$false; packageVersion=$packageVersion }
	$cleanProvenancePath = Join-Path $testRoot 'clean-base-provenance.json'
	Json $cleanProvenancePath $cleanProvenance
	Expect-Failure {
		& (Join-Path $projectRoot 'scripts\grok-release\Publish-ToDist.ps1') -Version $releaseVersion -ProjectRoot $projectRoot -DistRoot $dist -CandidateRoot $candidate -ReleaseBaseUrl "https://example.invalid/v$releaseVersion" -SourceCommit $commit -SourceDirty $false -BaseProductSha256 $provenance.base.productSha256 -BaseExecutableSha256 $provenance.base.executableSha256 -BasePackageVersion $packageVersion -BaseProvenancePath $cleanProvenancePath -PublicRelease
	} '*Public release artifact is not signed*' 'Unsigned public artifacts unexpectedly passed the publication gate.'
	$unsignedDist = Join-Path $testRoot 'unsigned-public-dist'
	& (Join-Path $projectRoot 'scripts\grok-release\Publish-ToDist.ps1') -Version $releaseVersion -ProjectRoot $projectRoot -DistRoot $unsignedDist -CandidateRoot $candidate -ReleaseBaseUrl "https://example.invalid/v$releaseVersion" -SourceCommit $commit -SourceDirty $false -BaseProductSha256 $provenance.base.productSha256 -BaseExecutableSha256 $provenance.base.executableSha256 -BasePackageVersion $packageVersion -BaseProvenancePath $cleanProvenancePath -PublicRelease -AllowUnsignedPublicRelease | Out-Null
	$unsignedManifest = Get-Content -LiteralPath (Join-Path $unsignedDist "$releaseVersion\MANIFEST.json") -Raw | ConvertFrom-Json
	Assert ($unsignedManifest.releaseStatus -eq 'public-unsigned') 'Explicit unsigned public release did not retain its truthful status.'
	Assert ([bool]$unsignedManifest.signatures.waiver.warning) 'Unsigned public release did not record its warning waiver.'
	& (Join-Path $projectRoot 'scripts\grok-release\Publish-ToDist.ps1') -Version $releaseVersion -ProjectRoot $projectRoot -DistRoot $dist -CandidateRoot $candidate -SourceCommit $commit -SourceDirty $true -BaseProductSha256 $provenance.base.productSha256 -BaseExecutableSha256 $provenance.base.executableSha256 -BasePackageVersion $packageVersion -BaseProvenancePath (Join-Path $baseRoot '.grok-base-provenance.json') | Out-Null
	Assert (Test-Path -LiteralPath (Join-Path $dist "$releaseVersion\MANIFEST.json")) 'Atomic local publication did not promote the complete version.'
	Assert (-not @(Get-ChildItem -LiteralPath $dist -Directory -Filter '.staging-*').Count) 'Atomic local publication left a staging directory after success.'
	$distManifest = Get-Content -LiteralPath (Join-Path $dist "$releaseVersion\MANIFEST.json") -Raw | ConvertFrom-Json
	Assert ($distManifest.channels.update.strategy -eq 'hash-verified-atomic-with-backup') 'Published update strategy is incorrect.'
	Assert (Test-Path -LiteralPath (Join-Path $dist "$releaseVersion\BASE-PROVENANCE.json")) 'Published base provenance is missing.'

	[IO.File]::AppendAllText($executable, 'tampered')
	Expect-Failure {
		& (Join-Path $projectRoot 'scripts\grok-release\Test-CodeOssBaseProvenance.ps1') -ProjectRoot $projectRoot -BaseCandidateRoot $baseRoot
	} '*executable SHA-256 does not match provenance*' 'Tampered base unexpectedly passed provenance verification.'

	Expect-Failure {
		& (Join-Path $projectRoot 'scripts\grok-release\Sign-WindowsArtifacts.ps1') -ArtifactPath $executable -CertificateThumbprint ('0' * 40) -TimestampUrl 'https://timestamp.invalid'
	} '*certificate was not found*' 'Missing signing certificate unexpectedly passed the signing gate.'

	Write-Host 'Release security gates passed: explicit public-unsigned waiver and atomic local promotion accepted; unwaived/tampered/missing-certificate inputs rejected.'
} finally {
	$testFull = [IO.Path]::GetFullPath($testRoot)
	if ($testFull.StartsWith($buildRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $testFull)) {
		Remove-Item -Recurse -Force -LiteralPath $testFull
	}
}
