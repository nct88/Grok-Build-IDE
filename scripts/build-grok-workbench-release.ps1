param(
	[Parameter(Mandatory=$true)][ValidatePattern('^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$')][string]$Version,
	[string]$NodeExecutable = 'node',
	[string]$BaseCandidateRoot,
	[string]$WorkDirectory
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$buildRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot '.build')).Path
$releaseRoot = Join-Path $projectRoot "releases/$Version"
$extensionRoot = Join-Path $projectRoot 'extensions/grok-build-workbench'
$extensionManifest = Get-Content -Raw -LiteralPath (Join-Path $extensionRoot 'package.json') | ConvertFrom-Json
if (-not $WorkDirectory) {
	$WorkDirectory = Join-Path $buildRoot "release-candidates/$Version"
}
$workRoot = [System.IO.Path]::GetFullPath($(if ([System.IO.Path]::IsPathRooted($WorkDirectory)) { $WorkDirectory } else { Join-Path $projectRoot $WorkDirectory }))
if (-not $workRoot.StartsWith($buildRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
	throw "Release work directory must remain under $buildRoot. Target: $workRoot"
}
if (Test-Path -LiteralPath $workRoot) {
	throw "Release work directory already exists: $workRoot"
}
if (Test-Path -LiteralPath $releaseRoot) {
	throw "Release $Version already exists: $releaseRoot"
}
$nodePath = $null
if (Test-Path -LiteralPath $NodeExecutable) {
	$nodePath = (Resolve-Path -LiteralPath $NodeExecutable).Path
} else {
	$nodeCommand = Get-Command $NodeExecutable -ErrorAction SilentlyContinue
	if ($nodeCommand) {
		$nodePath = $nodeCommand.Source
	} elseif ($NodeExecutable -eq 'node') {
		$fallbackNodes = @(
			(Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'),
			'C:\Program Files\nodejs\node.exe',
			'C:\Program Files (x86)\nodejs\node.exe'
		)
		foreach ($candidate in $fallbackNodes) {
			if ($candidate -and (Test-Path -LiteralPath $candidate)) {
				$nodePath = (Resolve-Path -LiteralPath $candidate).Path
				break
			}
		}
	}
}
if (-not $nodePath) {
	throw "Node.js was not found: $NodeExecutable. Pass -NodeExecutable with an absolute node.exe path (this machine often uses $env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe)."
}
Write-Host "Using Node: $nodePath"
$extensionOutput = Join-Path $workRoot 'extension'
$extensionArtifact = Join-Path $extensionOutput "grok-build-workbench-$($extensionManifest.version).vsix"
$payloadOutput = Join-Path $workRoot 'payload'
$payloadArchive = Join-Path $payloadOutput "Grok-Build-IDE-$Version-win32-x64-portable.zip"
$singleExeOutput = Join-Path $workRoot 'single-exe'
$artifact = Join-Path $singleExeOutput "Grok-Build-IDE-$Version-win32-x64-portable.exe"
$verifyCache = Join-Path $workRoot 'verify-cache'
$runtimeCache = Join-Path $workRoot 'runtime-cache'
$relocatedDirectory = Join-Path $workRoot 'relocated-runtime'

New-Item -ItemType Directory -Path $extensionOutput | Out-Null
Push-Location $extensionRoot
try {
	& $nodePath './node_modules/typescript/bin/tsc' --noEmit
	if ($LASTEXITCODE -ne 0) { throw "Extension typecheck failed with exit code $LASTEXITCODE." }
	$vitestScript = Join-Path $projectRoot 'extensions/grok-build-workbench/node_modules/vitest/vitest.mjs'
	if (-not (Test-Path -LiteralPath $vitestScript)) {
		throw "Vitest is missing under the extension node_modules. Run npm install in $extensionRoot."
	}
	& $nodePath $vitestScript run
	if ($LASTEXITCODE -ne 0) { throw "Extension tests failed with exit code $LASTEXITCODE." }
	& $nodePath './esbuild.mjs' --production
	if ($LASTEXITCODE -ne 0) { throw "Extension production build failed with exit code $LASTEXITCODE." }
	$env:NODE_PATH = "$projectRoot\node_modules;$extensionRoot\node_modules"
	& $nodePath (Join-Path $projectRoot 'scripts/package-grok-workbench-extension.mjs') $extensionRoot $extensionArtifact
	if ($LASTEXITCODE -ne 0) { throw "Extension packaging failed with exit code $LASTEXITCODE." }
} finally {
	Pop-Location
}

$payloadArguments = @{
	Version = $Version
	ExtensionArtifact = $extensionArtifact
	OutputDirectory = $payloadOutput
}
if ($BaseCandidateRoot) {
	$payloadArguments.BaseCandidateRoot = $BaseCandidateRoot
}
& (Join-Path $PSScriptRoot 'build-grok-workbench-payload.ps1') @payloadArguments
& (Join-Path $PSScriptRoot 'build-grok-workbench-single-exe.ps1') `
	-Version $Version `
	-PayloadArchive $payloadArchive `
	-OutputDirectory $singleExeOutput

$payloadSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $payloadArchive).Hash
& (Join-Path $PSScriptRoot 'verify-grok-workbench-single-exe.ps1') `
	-Artifact $artifact `
	-ExpectedVersion $Version `
	-CacheRoot $verifyCache
& (Join-Path $PSScriptRoot 'test-grok-workbench-single-exe-runtime.ps1') `
	-Artifact $artifact `
	-ExpectedVersion $Version `
	-ExpectedPayloadSha256 $payloadSha256 `
	-CacheRoot $runtimeCache `
	-RelocatedDirectory $relocatedDirectory

[pscustomobject]@{
	Version = $Version
	ExtensionVersion = $extensionManifest.version
	ExtensionArtifact = $extensionArtifact
	PayloadArchive = $payloadArchive
	PayloadSha256 = $payloadSha256
	Artifact = $artifact
	ArtifactSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifact).Hash
	ArtifactBytes = (Get-Item -LiteralPath $artifact).Length
	Status = 'verified-candidate'
}
