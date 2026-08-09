param(
	[Parameter(Mandatory=$true)][string]$Artifact,
	[string]$ExpectedVersion,
	[string]$ExpectedPayloadRoot,
	[string]$CacheRoot = '.build/verify-single-exe-cache'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$artifactCandidate = if ([System.IO.Path]::IsPathRooted($Artifact)) { $Artifact } else { Join-Path $projectRoot $Artifact }
$artifactPath = (Resolve-Path -LiteralPath $artifactCandidate).Path
$buildRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot '.build')).Path
if (-not $ExpectedVersion) {
	if ((Split-Path $artifactPath -Leaf) -notmatch '^Grok-Build-IDE-(?<version>\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)-win32-x64-portable\.exe$') {
		throw 'Unable to infer the expected version from the artifact name. Pass -ExpectedVersion explicitly.'
	}
	$ExpectedVersion = $Matches.version
}
if (-not $ExpectedPayloadRoot) {
	$ExpectedPayloadRoot = "grok-workbench-poc-$ExpectedVersion"
}
$cachePath = [System.IO.Path]::GetFullPath($(if ([System.IO.Path]::IsPathRooted($CacheRoot)) { $CacheRoot } else { Join-Path $projectRoot $CacheRoot }))
if (-not $cachePath.StartsWith($buildRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
	throw "Verification cache must be a child of $buildRoot."
}
if (Test-Path -LiteralPath $cachePath) {
	Remove-Item -Recurse -Force -LiteralPath $cachePath
}

$firstLaunch = Start-Process -FilePath $artifactPath -ArgumentList @(
	"--portable-bootstrap-cache-root=$cachePath",
	'--portable-bootstrap-extract-only'
) -Wait -PassThru
if ($firstLaunch.ExitCode -ne 0) {
	throw "The single-file launcher failed extraction with exit code $($firstLaunch.ExitCode)."
}
$marker = Get-ChildItem -Recurse -File -Filter '.payload-sha256' -LiteralPath $cachePath | Select-Object -First 1
if (-not $marker) {
	throw 'The extracted cache marker is missing.'
}
$applicationRoot = Join-Path $marker.Directory.FullName $ExpectedPayloadRoot
$requiredFiles = @(
	'Grok Build IDE.exe',
	'resources/app/product.json',
	'data/extensions/extensions.json'
)
foreach ($requiredFile in $requiredFiles) {
	if (-not (Test-Path -LiteralPath (Join-Path $applicationRoot $requiredFile))) {
		throw "The extracted payload is missing $requiredFile."
	}
}

$markerTimestamp = $marker.LastWriteTimeUtc
$secondLaunch = Start-Process -FilePath $artifactPath -ArgumentList @(
	"--portable-bootstrap-cache-root=$cachePath",
	'--portable-bootstrap-extract-only'
) -Wait -PassThru
if ($secondLaunch.ExitCode -ne 0) {
	throw "The cached second launch failed with exit code $($secondLaunch.ExitCode)."
}
$markerAfterSecondLaunch = Get-Item -LiteralPath $marker.FullName
if ($markerAfterSecondLaunch.LastWriteTimeUtc -ne $markerTimestamp) {
	throw 'The second launch unexpectedly extracted the payload again.'
}

$productPath = Join-Path $applicationRoot 'resources/app/product.json'
Move-Item -LiteralPath $productPath -Destination "$productPath.missing"
$repairLaunch = Start-Process -FilePath $artifactPath -ArgumentList @(
	"--portable-bootstrap-cache-root=$cachePath",
	'--portable-bootstrap-extract-only'
) -Wait -PassThru
if ($repairLaunch.ExitCode -ne 0) {
	throw "The corrupt-cache repair launch failed with exit code $($repairLaunch.ExitCode)."
}
if (-not (Test-Path -LiteralPath $productPath) -or (Test-Path -LiteralPath "$productPath.missing")) {
	throw 'The launcher did not replace the incomplete cache with a clean payload.'
}

& (Join-Path $projectRoot 'scripts/verify-portable-extension-registry.ps1') -CandidateRoot $applicationRoot
& (Join-Path $projectRoot 'scripts/verify-grok-workbench-portable-settings.ps1') -CandidateRoot $applicationRoot

[pscustomobject]@{
	Artifact = $artifactPath
	Cache = $marker.Directory.FullName
	ApplicationRoot = $applicationRoot
	Version = $ExpectedVersion
	PayloadSha256 = (Get-Content -Raw -LiteralPath $markerAfterSecondLaunch.FullName).Trim()
	FirstExtraction = 'passed'
	CachedSecondLaunch = 'passed'
	MissingCriticalFileRepair = 'passed'
	ExtensionRegistry = 'passed'
	PortableSettings = 'passed'
}
