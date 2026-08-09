param(
	[Parameter(Mandatory = $true)][ValidatePattern('^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$')][string]$Version,
	[string]$ProjectRoot,
	[string]$NodeExecutable = 'node',
	[string]$BaseCandidateRoot,
	[string]$DistRoot,
	[string]$MemoryRoot,
	[string]$ReleaseBaseUrl = '',
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

Log "Grok Build IDE release $Version"
Log "Project=$ProjectRoot Dist=$DistRoot Base=$BaseCandidateRoot Node=$nodePath"
& (Join-Path $ProjectRoot 'scripts\build-grok-workbench-release.ps1') -Version $Version -NodeExecutable $nodePath -BaseCandidateRoot $BaseCandidateRoot

$candidate = Join-Path $ProjectRoot ".build\release-candidates\$Version"
$portable = Join-Path $candidate "single-exe\Grok-Build-IDE-$Version-win32-x64-portable.exe"
if (-not (Test-Path -LiteralPath $portable)) { throw "Portable artifact missing after release: $portable" }

Log 'Building mandatory Inno Setup installer.'
& (Join-Path $ProjectRoot 'scripts\build-grok-workbench-inno-setup.ps1') -Version $Version

Log 'Publishing immutable dist channels.'
$publishArgs = @{
	Version = $Version
	ProjectRoot = $ProjectRoot
	DistRoot = $DistRoot
	CandidateRoot = $candidate
	ReleaseBaseUrl = $ReleaseBaseUrl
}
if ($PublicRelease) { $publishArgs.PublicRelease = $true }
& (Join-Path $PSScriptRoot 'Publish-ToDist.ps1') @publishArgs
Log "DONE $Version"
