param(
	[Parameter(Mandatory=$true)][ValidatePattern('^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$')][string]$Version,
	[string]$PayloadArchive,
	[string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$buildRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot '.build')).Path
if (-not $PayloadArchive) {
	$PayloadArchive = Join-Path $buildRoot "release-candidates/$Version/payload/Grok-Workbench-IDE-$Version-win32-x64-portable.zip"
}
if (-not $OutputDirectory) {
	$OutputDirectory = Join-Path $buildRoot "release-candidates/$Version/setup-installer"
}
$payloadCandidate = if ([System.IO.Path]::IsPathRooted($PayloadArchive)) { $PayloadArchive } else { Join-Path $projectRoot $PayloadArchive }
$payloadPath = (Resolve-Path -LiteralPath $payloadCandidate).Path
$outputPath = [System.IO.Path]::GetFullPath($(if ([System.IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory } else { Join-Path $projectRoot $OutputDirectory }))
if (-not $outputPath.StartsWith($buildRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
	throw "Setup output must remain under $buildRoot. Target: $outputPath"
}
if (Test-Path -LiteralPath $outputPath) {
	Remove-Item -Recurse -Force -LiteralPath $outputPath
}
$projectPath = Join-Path $projectRoot 'build/grok/setup-installer/GrokBuildIDESetup.csproj'

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
dotnet publish $projectPath `
	--configuration Release `
	--runtime win-x64 `
	--output $outputPath `
	--nologo `
	-p:PayloadArchive=$payloadPath `
	-p:ReleaseVersion=$Version
if ($LASTEXITCODE -ne 0) {
	throw "dotnet publish for setup failed with exit code $LASTEXITCODE."
}

$artifact = Join-Path $outputPath "Grok-Build-IDE-Setup-$Version-win32-x64.exe"
if (-not (Test-Path -LiteralPath $artifact)) {
	throw "Expected setup artifact was not created: $artifact"
}

[pscustomobject]@{
	SetupArtifact = $artifact
	SetupArtifactSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifact).Hash
	SetupArtifactBytes = (Get-Item -LiteralPath $artifact).Length
	Payload = $payloadPath
}
