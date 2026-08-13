param(
	[string]$ProjectRoot,
	[string]$NodeExecutable = 'node',
	[ValidateSet('x64')][string]$Arch = 'x64',
	[string]$OutputRoot,
	[switch]$AllowDirty
)

$ErrorActionPreference = 'Stop'
if (-not $PSScriptRoot) { $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$buildRoot = (Resolve-Path -LiteralPath (Join-Path $ProjectRoot '.build')).Path

$sourceCommit = (& git -C $ProjectRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $sourceCommit -notmatch '^[0-9a-fA-F]{40}$') { throw 'Unable to resolve the source Git commit.' }
$sourceDirty = @(& git -C $ProjectRoot status --porcelain --untracked-files=normal).Count -gt 0
if ($sourceDirty -and -not $AllowDirty) {
	throw 'The Code OSS public base must be built from a clean worktree. Commit the release source first, or use -AllowDirty only for a development base.'
}

$sourcePackageVersion = (Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json).version
$product = Get-Content -LiteralPath (Join-Path $ProjectRoot 'product.json') -Raw | ConvertFrom-Json
$generatedRoot = Join-Path (Split-Path $ProjectRoot -Parent) "VSCode-win32-$Arch"
if (Test-Path -LiteralPath $generatedRoot) {
	throw "Generated Code OSS target already exists; inspect or move it before building: $generatedRoot"
}

if (-not $OutputRoot) {
	$OutputRoot = Join-Path $buildRoot "base-candidates\$sourceCommit-win32-$Arch\grok-build-ide-base-$sourcePackageVersion"
}
$outputPath = [IO.Path]::GetFullPath($(if ([IO.Path]::IsPathRooted($OutputRoot)) { $OutputRoot } else { Join-Path $ProjectRoot $OutputRoot }))
if (-not $outputPath.StartsWith($buildRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
	throw "Code OSS base output must remain under $buildRoot. Target: $outputPath"
}
if (Test-Path -LiteralPath $outputPath) { throw "Immutable Code OSS base already exists: $outputPath" }

$nodePath = $null
if (Test-Path -LiteralPath $NodeExecutable) { $nodePath = (Resolve-Path -LiteralPath $NodeExecutable).Path }
else {
	$nodeCommand = Get-Command $NodeExecutable -ErrorAction SilentlyContinue
	if ($nodeCommand) { $nodePath = $nodeCommand.Source }
}
if (-not $nodePath) { throw 'Node.js was not found. Pass -NodeExecutable.' }

$gulpPath = Join-Path $ProjectRoot 'node_modules\gulp\bin\gulp.js'
if (-not (Test-Path -LiteralPath $gulpPath)) { throw "Gulp is missing: $gulpPath. Run npm ci first." }
$windowsKitsBin = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
$signTool = Get-ChildItem -LiteralPath $windowsKitsBin -Filter signtool.exe -File -Recurse -ErrorAction SilentlyContinue |
	Where-Object FullName -Match '\\x64\\signtool\.exe$' |
	Sort-Object FullName -Descending |
	Select-Object -First 1
if (-not $signTool) { throw 'The Code OSS Windows packaging task requires signtool.exe from the Windows SDK.' }
$taskName = "vscode-win32-$Arch-min"
$startedAt = (Get-Date).ToUniversalTime()
$originalProcessPath = $env:PATH
Push-Location $ProjectRoot
try {
	$env:PATH = "$($signTool.DirectoryName);$originalProcessPath"
	& $nodePath '--experimental-strip-types' '--max-old-space-size=8192' $gulpPath $taskName
	if ($LASTEXITCODE -ne 0) { throw "Code OSS task $taskName failed with exit code $LASTEXITCODE." }
} finally {
	$env:PATH = $originalProcessPath
	Pop-Location
}
if (-not (Test-Path -LiteralPath $generatedRoot -PathType Container)) { throw "Code OSS task did not create $generatedRoot." }

try {
	$executablePath = Join-Path $generatedRoot "$($product.nameShort).exe"
	$productPath = Join-Path $generatedRoot 'resources\app\product.json'
	$packagePath = Join-Path $generatedRoot 'resources\app\package.json'
	foreach ($required in @($executablePath, $productPath, $packagePath)) {
		if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Generated Code OSS base file is missing: $required" }
	}

	$basePackageVersion = (Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json).version
	$baseProduct = Get-Content -LiteralPath $productPath -Raw | ConvertFrom-Json
	if ($basePackageVersion -ne $sourcePackageVersion) { throw "Generated package version $basePackageVersion does not match source $sourcePackageVersion." }
	if ($baseProduct.commit -and $baseProduct.commit -ne $sourceCommit) { throw "Generated product commit $($baseProduct.commit) does not match $sourceCommit." }

	$dataRoot = Join-Path $generatedRoot 'data'
	$userRoot = Join-Path $dataRoot 'user-data\User'
	$extensionsRoot = Join-Path $dataRoot 'extensions'
	New-Item -ItemType Directory -Force -Path $userRoot,$extensionsRoot | Out-Null
	Copy-Item -LiteralPath (Join-Path $ProjectRoot 'build\grok\portable-profile\settings.json') -Destination (Join-Path $userRoot 'settings.json')
	[IO.File]::WriteAllText((Join-Path $extensionsRoot 'extensions.json'), "[]`n", [Text.UTF8Encoding]::new($false))

	New-Item -ItemType Directory -Force -Path (Split-Path $outputPath -Parent) | Out-Null
	Move-Item -LiteralPath $generatedRoot -Destination $outputPath

	$finalProductPath = Join-Path $outputPath 'resources\app\product.json'
	$finalExecutablePath = Join-Path $outputPath "$($product.nameShort).exe"
	$provenance = [ordered]@{
		schemaVersion = 1
		builtAt = (Get-Date).ToUniversalTime().ToString('o')
		buildDurationSeconds = [math]::Round(((Get-Date).ToUniversalTime() - $startedAt).TotalSeconds, 3)
		command = "node --experimental-strip-types --max-old-space-size=8192 node_modules/gulp/bin/gulp.js $taskName"
		platform = 'win32'
		arch = $Arch
		source = [ordered]@{ commit = $sourceCommit; dirty = $sourceDirty; packageVersion = $sourcePackageVersion }
		base = [ordered]@{
			packageVersion = $basePackageVersion
			productSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $finalProductPath).Hash
			executableSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $finalExecutablePath).Hash
		}
	}
	$provenancePath = Join-Path $outputPath '.grok-base-provenance.json'
	[IO.File]::WriteAllText($provenancePath, (($provenance | ConvertTo-Json -Depth 8) + "`n"), [Text.UTF8Encoding]::new($false))
	$cliPath = Join-Path $outputPath "bin\$($product.applicationName).cmd"
	$cliVersion = @(& $cliPath '--version')
	if ($LASTEXITCODE -ne 0 -or $cliVersion.Count -lt 3) { throw 'Built IDE CLI runtime check failed.' }
	if ($cliVersion[0].Trim() -ne $sourcePackageVersion -or $cliVersion[1].Trim() -ne $sourceCommit -or $cliVersion[2].Trim() -ne $Arch) {
		throw "Built IDE CLI identity mismatch: $($cliVersion -join ', ')."
	}

	$verificationArgs = @{ ProjectRoot = $ProjectRoot; BaseCandidateRoot = $outputPath }
	if (-not $sourceDirty) { $verificationArgs.RequireClean = $true }
	& (Join-Path $PSScriptRoot 'Test-CodeOssBaseProvenance.ps1') @verificationArgs
} catch {
	if (Test-Path -LiteralPath $generatedRoot) {
		Write-Warning "The failed generated tree was preserved for diagnosis: $generatedRoot"
	}
	throw
}
