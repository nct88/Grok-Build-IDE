param(
	[Parameter(Mandatory=$true)][ValidatePattern('^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$')][string]$Version,
	[string]$PayloadDir,
	[string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$buildRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot '.build')).Path

if (-not $PayloadDir) {
	$PayloadDir = Join-Path $buildRoot "release-candidates/$Version/payload/grok-workbench-poc-$Version"
}
if (-not (Test-Path -LiteralPath $PayloadDir)) {
	throw "Payload directory does not exist: $PayloadDir"
}

if (-not $OutputDirectory) {
	$OutputDirectory = Join-Path $buildRoot "release-candidates/$Version/inno-installer"
}
$payloadPath = (Resolve-Path -LiteralPath $PayloadDir).Path
$outputPath = [System.IO.Path]::GetFullPath($(if ([System.IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory } else { Join-Path $projectRoot $OutputDirectory }))

$isccCompiler = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (-not (Test-Path -LiteralPath $isccCompiler)) {
	$isccCompiler = "C:\Program Files\Inno Setup 6\ISCC.exe"
}
if (-not (Test-Path -LiteralPath $isccCompiler)) {
	throw "Inno Setup Compiler (ISCC.exe) was not found at $isccCompiler"
}

$issScript = Join-Path $projectRoot 'build/grok/setup-installer/GrokBuildIDE.iss'

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

& $isccCompiler "/DMyAppVersion=$Version" "/DPayloadSourceDir=$payloadPath" "/O$outputPath" $issScript
if ($LASTEXITCODE -ne 0) {
	throw "Inno Setup compilation failed with exit code $LASTEXITCODE."
}

$artifact = Join-Path $outputPath "Grok-Build-IDE-Setup-$Version.exe"
if (-not (Test-Path -LiteralPath $artifact)) {
	throw "Expected Inno Setup artifact was not created: $artifact"
}

[pscustomobject]@{
	InnoSetupArtifact = $artifact
	Sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifact).Hash
	Bytes = (Get-Item -LiteralPath $artifact).Length
	PayloadDir = $payloadPath
}
