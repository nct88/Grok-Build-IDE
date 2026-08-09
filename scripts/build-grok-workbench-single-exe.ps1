param(
	[Parameter(Mandatory=$true)][ValidatePattern('^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$')][string]$Version,
	[string]$PayloadArchive,
	[string]$PayloadRoot,
	[string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$buildRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot '.build')).Path
if (-not $PayloadArchive) {
	$PayloadArchive = Join-Path $buildRoot "release-candidates/$Version/payload/Grok-Build-IDE-$Version-win32-x64-portable.zip"
}
if (-not $PayloadRoot) {
	$PayloadRoot = "grok-workbench-poc-$Version"
}
if (-not $OutputDirectory) {
	$OutputDirectory = Join-Path $buildRoot "release-candidates/$Version/single-exe"
}
$payloadCandidate = if ([System.IO.Path]::IsPathRooted($PayloadArchive)) { $PayloadArchive } else { Join-Path $projectRoot $PayloadArchive }
$payloadPath = (Resolve-Path -LiteralPath $payloadCandidate).Path
$outputPath = [System.IO.Path]::GetFullPath($(if ([System.IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory } else { Join-Path $projectRoot $OutputDirectory }))
if (-not $outputPath.StartsWith($buildRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
	throw "Single-EXE output must remain under $buildRoot. Target: $outputPath"
}
if (Test-Path -LiteralPath $outputPath) {
	throw "Single-EXE output already exists: $outputPath"
}
$projectPath = Join-Path $projectRoot 'build/grok/portable-launcher/GrokWorkbenchPortable.csproj'
$payloadSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $payloadPath).Hash

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
dotnet publish $projectPath `
	--configuration Release `
	--runtime win-x64 `
	--output $outputPath `
	--nologo `
	-p:PayloadArchive=$payloadPath `
	-p:PayloadSha256=$payloadSha256 `
	-p:PayloadRoot=$PayloadRoot `
	-p:ReleaseVersion=$Version
if ($LASTEXITCODE -ne 0) {
	throw "dotnet publish failed with exit code $LASTEXITCODE."
}

$artifact = Join-Path $outputPath "Grok-Build-IDE-$Version-win32-x64-portable.exe"
if (-not (Test-Path -LiteralPath $artifact)) {
	throw "Expected single-file artifact was not created: $artifact"
}
$unexpectedFiles = @(Get-ChildItem -LiteralPath $outputPath -File | Where-Object FullName -ne $artifact)
if ($unexpectedFiles.Count -gt 0) {
	throw "The publish output is not a single-file package: $($unexpectedFiles.Name -join ', ')"
}

[pscustomobject]@{
	Artifact = $artifact
	ArtifactSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifact).Hash
	ArtifactBytes = (Get-Item -LiteralPath $artifact).Length
	Payload = $payloadPath
	PayloadSha256 = $payloadSha256
}
