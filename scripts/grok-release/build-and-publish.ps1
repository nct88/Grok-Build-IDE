param(
	[Parameter(Mandatory = $true)][ValidatePattern('^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$')][string]$Version,
	[string]$ProjectRoot,
	[string]$NodeExecutable = 'node',
	[string]$BaseCandidateRoot,
	[string]$DistRoot,
	[string]$MemoryRoot,
	[string]$ReleaseBaseUrl = '',
	[string]$CertificateThumbprint = '',
	[string]$TimestampUrl = '',
	[ValidateSet('CurrentUser','LocalMachine')][string]$CertificateStoreLocation = 'CurrentUser',
	[switch]$AllowUnsignedPublicRelease,
	[switch]$PublicRelease
)

$ErrorActionPreference = 'Stop'
if (-not $PSScriptRoot) { $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
if (-not $DistRoot) { $DistRoot = Join-Path $ProjectRoot 'dist' }
if (-not $MemoryRoot) { $MemoryRoot = Join-Path (Split-Path $ProjectRoot -Parent) '.grok-build' }

$versionSource = (Get-Content -LiteralPath (Join-Path $ProjectRoot 'build\grok\VERSION') -Raw).Trim()
if ($versionSource -ne $Version) { throw "Version $Version does not match build/grok/VERSION ($versionSource)." }
$extensionVersion = (Get-Content -LiteralPath (Join-Path $ProjectRoot 'extensions\grok-build-workbench\package.json') -Raw | ConvertFrom-Json).version
if ($extensionVersion -ne $Version) { throw "Extension version $extensionVersion does not match release $Version." }
if (Test-Path -LiteralPath (Join-Path $DistRoot $Version)) { throw "Release $Version already exists under $DistRoot." }

$sourceCommit = (& git -C $ProjectRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or -not $sourceCommit) { throw 'Unable to resolve the source Git commit.' }
$sourceChanges = @(& git -C $ProjectRoot status --porcelain --untracked-files=normal)
$sourceDirty = $sourceChanges.Count -gt 0
if ($PublicRelease -and $sourceDirty) {
	throw 'PublicRelease requires a clean Git worktree. Commit or remove all source changes first.'
}
if ($PublicRelease -and -not $BaseCandidateRoot) {
	throw 'PublicRelease requires an explicit -BaseCandidateRoot; automatic latest-candidate reuse is not allowed.'
}
if ($AllowUnsignedPublicRelease -and -not $PublicRelease) {
	throw 'AllowUnsignedPublicRelease is valid only together with -PublicRelease.'
}
if ($PublicRelease -and -not $AllowUnsignedPublicRelease -and (-not $CertificateThumbprint -or -not $TimestampUrl)) {
	throw 'PublicRelease requires -CertificateThumbprint and an HTTPS -TimestampUrl so newly built Windows artifacts can be signed.'
}
if ($PublicRelease -and $AllowUnsignedPublicRelease -and ($CertificateThumbprint -or $TimestampUrl)) {
	throw 'Choose either signed public release parameters or -AllowUnsignedPublicRelease, not both.'
}

& (Join-Path $ProjectRoot 'scripts\check-grok-brand-assets.ps1') -ProjectRoot $ProjectRoot

$logDir = Join-Path $MemoryRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("build-{0}-{1:yyyyMMdd-HHmmss}.log" -f $Version, (Get-Date))
function Log([string]$Message) {
	$line = "[{0}] {1}" -f (Get-Date -Format 'o'), $Message
	Write-Host $line
	Add-Content -LiteralPath $logFile -Value $line
}

$nodePath = $null
if (Test-Path -LiteralPath $NodeExecutable) { $nodePath = (Resolve-Path -LiteralPath $NodeExecutable).Path }
else {
	$command = Get-Command $NodeExecutable -ErrorAction SilentlyContinue
	if ($command) { $nodePath = $command.Source }
}
if (-not $nodePath) { throw 'Node.js not found. Pass -NodeExecutable.' }

if (-not $BaseCandidateRoot) {
	$baseCandidates = @(
		Get-ChildItem -LiteralPath (Join-Path $ProjectRoot '.build\release-candidates') -Directory -ErrorAction SilentlyContinue |
			ForEach-Object { Get-ChildItem -LiteralPath (Join-Path $_.FullName 'payload') -Directory -Filter 'grok-workbench-poc-*' -ErrorAction SilentlyContinue }
	) | Where-Object {
		(Test-Path -LiteralPath (Join-Path $_.FullName 'resources\app\product.json')) -and
		((Test-Path -LiteralPath (Join-Path $_.FullName 'Grok Build IDE.exe')) -or (Test-Path -LiteralPath (Join-Path $_.FullName 'Grok Workbench.exe')))
	} | Sort-Object LastWriteTime -Descending
	$BaseCandidateRoot = $baseCandidates | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $BaseCandidateRoot) { throw 'No reusable local base candidate found. Pass -BaseCandidateRoot.' }
$BaseCandidateRoot = (Resolve-Path -LiteralPath $BaseCandidateRoot).Path
$baseVerificationArgs = @{ ProjectRoot = $ProjectRoot; BaseCandidateRoot = $BaseCandidateRoot }
if ($PublicRelease) { $baseVerificationArgs.RequireClean = $true }
$baseVerification = & (Join-Path $PSScriptRoot 'Test-CodeOssBaseProvenance.ps1') @baseVerificationArgs
$baseProductSha256 = $baseVerification.BaseProductSha256
$baseExecutableSha256 = $baseVerification.BaseExecutableSha256
$basePackageVersion = $baseVerification.BasePackageVersion
$sourcePackageVersion = (Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json).version
if ($PublicRelease -and $basePackageVersion -ne $sourcePackageVersion) {
	throw "PublicRelease base package version $basePackageVersion does not match source package version $sourcePackageVersion. Rebuild the Code - OSS base from this source revision."
}

Log "Grok Build IDE release $Version"
Log "Project=$ProjectRoot Dist=$DistRoot Base=$BaseCandidateRoot Node=$nodePath Source=$sourceCommit Dirty=$sourceDirty BasePackage=$basePackageVersion SourcePackage=$sourcePackageVersion"
& (Join-Path $ProjectRoot 'scripts\build-grok-workbench-release.ps1') -Version $Version -NodeExecutable $nodePath -BaseCandidateRoot $BaseCandidateRoot

$candidate = Join-Path $ProjectRoot ".build\release-candidates\$Version"
$portable = Join-Path $candidate "single-exe\Grok-Build-IDE-$Version-win32-x64-portable.exe"
if (-not (Test-Path -LiteralPath $portable)) { throw "Portable artifact missing after release: $portable" }
$payloadDir = Join-Path $candidate "payload\grok-workbench-poc-$Version"
$extensionArtifact = Get-ChildItem -LiteralPath (Join-Path $candidate 'extension') -Filter '*.vsix' | Select-Object -First 1 -ExpandProperty FullName

Log 'Testing atomic VSIX update, explicit rollback and tamper rejection.'
& (Join-Path $ProjectRoot 'scripts\test-update-lifecycle.ps1') -VsixPath $extensionArtifact

Log 'Testing isolated Windows install and uninstall lifecycle.'
& (Join-Path $ProjectRoot 'scripts\test-windows-installer-lifecycle.ps1') -PayloadDir $payloadDir -Version $Version

Log 'Building mandatory Inno Setup installer.'
& (Join-Path $ProjectRoot 'scripts\build-grok-workbench-inno-setup.ps1') -Version $Version
$installer = Join-Path $candidate "inno-installer\Grok-Build-IDE-Setup-$Version.exe"

if ($CertificateThumbprint) {
	Log 'Signing and timestamping Windows release artifacts.'
	& (Join-Path $PSScriptRoot 'Sign-WindowsArtifacts.ps1') `
		-ArtifactPath @($portable, $installer) `
		-CertificateThumbprint $CertificateThumbprint `
		-TimestampUrl $TimestampUrl `
		-CertificateStoreLocation $CertificateStoreLocation
}

Log 'Publishing immutable dist channels.'
$publishArgs = @{
	Version = $Version
	ProjectRoot = $ProjectRoot
	DistRoot = $DistRoot
	CandidateRoot = $candidate
	ReleaseBaseUrl = $ReleaseBaseUrl
	SourceCommit = $sourceCommit
	SourceDirty = $sourceDirty
	BaseProductSha256 = $baseProductSha256
	BaseExecutableSha256 = $baseExecutableSha256
	BasePackageVersion = $basePackageVersion
	BaseProvenancePath = $baseVerification.ProvenancePath
}
if ($PublicRelease) { $publishArgs.PublicRelease = $true }
if ($AllowUnsignedPublicRelease) { $publishArgs.AllowUnsignedPublicRelease = $true }
& (Join-Path $PSScriptRoot 'Publish-ToDist.ps1') @publishArgs
Log "DONE $Version"
