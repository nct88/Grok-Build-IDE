param(
	[Parameter(Mandatory=$true)][ValidatePattern('^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$')][string]$Version,
	[string]$BaseCandidateRoot,
	[string]$ExtensionArtifact,
	[string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$buildRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot '.build')).Path
if (-not $BaseCandidateRoot) {
	$targetVersion = [version]$Version
	$baseCandidate = Get-ChildItem -LiteralPath $buildRoot -Directory -Filter 'grok-workbench-poc-*' |
		ForEach-Object {
			if ($_.Name -match '^grok-workbench-poc-(?<version>\d+\.\d+\.\d+)$') {
				[pscustomobject]@{ Path = $_.FullName; Version = [version]$Matches.version }
			}
		} |
		Where-Object Version -LT $targetVersion |
		Sort-Object Version -Descending |
		Select-Object -First 1
	if (-not $baseCandidate) {
		throw "No earlier Grok Workbench candidate is available under $buildRoot. Pass -BaseCandidateRoot explicitly."
	}
	$BaseCandidateRoot = $baseCandidate.Path
}
if (-not $ExtensionArtifact) {
	$extensionManifest = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'extensions/grok-build-workbench/package.json') | ConvertFrom-Json
	$ExtensionArtifact = Join-Path $projectRoot "extensions/grok-build-workbench/grok-build-workbench-$($extensionManifest.version).vsix"
}
if (-not $OutputDirectory) {
	$OutputDirectory = Join-Path $buildRoot "release-candidates/$Version/payload"
}
function Resolve-ProjectPath([string]$path) {
	$candidate = if ([System.IO.Path]::IsPathRooted($path)) { $path } else { Join-Path $projectRoot $path }
	return (Resolve-Path -LiteralPath $candidate).Path
}
$baseRoot = Resolve-ProjectPath $BaseCandidateRoot
$extensionPath = Resolve-ProjectPath $ExtensionArtifact
$settingsTemplate = (Resolve-Path -LiteralPath (Join-Path $projectRoot 'build/grok/portable-profile/settings.json')).Path
$outputRoot = [System.IO.Path]::GetFullPath($(if ([System.IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory } else { Join-Path $projectRoot $OutputDirectory }))
$candidateRoot = Join-Path $outputRoot "grok-workbench-poc-$Version"
$archivePath = Join-Path $outputRoot "Grok-Build-IDE-$Version-win32-x64-portable.zip"
$extractRoot = Join-Path $buildRoot "grok-build-workbench-vsix-$Version-$PID"
foreach ($target in @($candidateRoot, $archivePath, $extractRoot)) {
	if (-not $target.StartsWith($buildRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
		throw "Build target must remain under $buildRoot. Target: $target"
	}
	if (Test-Path -LiteralPath $target) {
		throw "Build target already exists: $target"
	}
}

function Copy-TreeRobust([string]$Source, [string]$Destination, [string[]]$ExtraArguments = @()) {
	New-Item -ItemType Directory -Force -Path $Destination | Out-Null
	& robocopy $Source $Destination '/E' '/COPY:DAT' '/DCOPY:DAT' '/R:2' '/W:1' '/NFL' '/NDL' '/NJH' '/NJS' '/NP' @ExtraArguments
	$robocopyExitCode = $LASTEXITCODE
	if ($robocopyExitCode -ge 8) {
		throw "robocopy failed with exit code $robocopyExitCode while copying $Source to $Destination."
	}
}

try {
	New-Item -ItemType Directory -Path $candidateRoot | Out-Null
	Copy-TreeRobust $baseRoot $candidateRoot @('/XD', (Join-Path $baseRoot 'data'))
	$legacyExecutable = Join-Path $candidateRoot 'Grok Workbench.exe'
	$brandedExecutable = Join-Path $candidateRoot 'Grok Build IDE.exe'
	if ((Test-Path -LiteralPath $legacyExecutable) -and -not (Test-Path -LiteralPath $brandedExecutable)) {
		Move-Item -LiteralPath $legacyExecutable -Destination $brandedExecutable
	}
	if (-not (Test-Path -LiteralPath $brandedExecutable)) {
		throw 'Base candidate does not contain the Grok Build IDE executable.'
	}

	# Reused Electron payloads retain their original executable resources. Stamp the
	# canonical brand icon and replace packaged platform resources on every release.
	$brandIcon = Join-Path $projectRoot 'resources\win32\code.ico'
	$rcedit = Join-Path $projectRoot 'node_modules\rcedit\bin\rcedit.exe'
	if (-not (Test-Path -LiteralPath $rcedit)) { throw "Missing rcedit: $rcedit" }
	& $rcedit $brandedExecutable '--set-icon' $brandIcon
	if ($LASTEXITCODE -ne 0) { throw "Failed to stamp brand icon into $brandedExecutable." }

	$payloadResourceRoot = Join-Path $candidateRoot 'resources\app\resources'
	foreach ($relativeBrandPath in @(
		'win32\code.ico', 'win32\code_70x70.png', 'win32\code_150x150.png',
		'darwin\code.icns', 'linux\code.png', 'server\favicon.ico', 'grok-workbench-logo.svg'
	)) {
		$sourceBrandPath = Join-Path (Join-Path $projectRoot 'resources') $relativeBrandPath
		$targetBrandPath = Join-Path $payloadResourceRoot $relativeBrandPath
		New-Item -ItemType Directory -Force -Path (Split-Path $targetBrandPath -Parent) | Out-Null
		Copy-Item -Force -LiteralPath $sourceBrandPath -Destination $targetBrandPath
	}

	Add-Type -AssemblyName System.Drawing
	$extractedIcon = [System.Drawing.Icon]::ExtractAssociatedIcon($brandedExecutable)
	if (-not $extractedIcon) { throw 'Could not extract the stamped Electron executable icon.' }
	$expectedIcon = New-Object System.Drawing.Icon -ArgumentList @($brandIcon, 32, 32)
	$extractedBitmap = $extractedIcon.ToBitmap()
	$expectedBitmap = $expectedIcon.ToBitmap()
	try {
		$iconMismatch = $false
		for ($y = 0; $y -lt 32 -and -not $iconMismatch; $y++) {
			for ($x = 0; $x -lt 32; $x++) {
				if ($extractedBitmap.GetPixel($x, $y).ToArgb() -ne $expectedBitmap.GetPixel($x, $y).ToArgb()) {
					$iconMismatch = $true
					break
				}
			}
		}
		if ($iconMismatch) { throw 'Stamped Electron executable icon does not match resources/win32/code.ico at 32px.' }
	} finally {
		$extractedBitmap.Dispose()
		$expectedBitmap.Dispose()
		$extractedIcon.Dispose()
		$expectedIcon.Dispose()
	}
	Write-Host 'Stamped Electron executable and synchronized packaged platform branding.'
	$dataSource = Join-Path $baseRoot 'data'
	$dataTarget = Join-Path $candidateRoot 'data'
	Copy-TreeRobust $dataSource $dataTarget @('/XD', (Join-Path $dataSource 'extensions'))
	New-Item -ItemType Directory -Force -Path (Join-Path $dataTarget 'user-data\User') | Out-Null
	Copy-Item -Force -LiteralPath $settingsTemplate -Destination (Join-Path $dataTarget 'user-data\User\settings.json')

	$extensionsSource = Join-Path $dataSource 'extensions'
	$extensionsTarget = Join-Path $dataTarget 'extensions'
	$oldGrokDirectories = @(Get-ChildItem -LiteralPath $extensionsSource -Directory -ErrorAction SilentlyContinue |
		Where-Object Name -like 'local-grok-workbench.grok-build-workbench-*' |
		Select-Object -ExpandProperty FullName)
	$extensionCopyArguments = @('/XF', 'extensions.json')
	if ($oldGrokDirectories.Count) { $extensionCopyArguments += @('/XD') + $oldGrokDirectories }
	Copy-TreeRobust $extensionsSource $extensionsTarget $extensionCopyArguments

	Add-Type -AssemblyName System.IO.Compression.FileSystem
	[System.IO.Compression.ZipFile]::ExtractToDirectory($extensionPath, $extractRoot)
	$manifest = Get-Content -LiteralPath (Join-Path $extractRoot 'extension\package.json') -Raw | ConvertFrom-Json
	$extensionId = "$($manifest.publisher).$($manifest.name)"
	$relativeLocation = "$extensionId-$($manifest.version)"
	$newExtensionRoot = Join-Path $extensionsTarget $relativeLocation
	Copy-Item -Recurse -LiteralPath (Join-Path $extractRoot 'extension') -Destination $newExtensionRoot

	$normalizedPath = $newExtensionRoot.Replace('\', '/')
	$drive = $normalizedPath.Substring(0, 1).ToLowerInvariant()
	$fsPath = "$drive$($newExtensionRoot.Substring(1))"
	$uriPath = '/' + $drive + ':' + $normalizedPath.Substring(2)
	$external = "file:///$drive%3A$($normalizedPath.Substring(2))"
	$entry = [ordered]@{
		identifier = [ordered]@{ id = $extensionId }
		version = $manifest.version
		location = [ordered]@{
			'$mid' = 1
			fsPath = $fsPath
			'_sep' = 1
			external = $external
			path = $uriPath
			scheme = 'file'
		}
		relativeLocation = $relativeLocation
		metadata = [ordered]@{
			isApplicationScoped = $false
			isMachineScoped = $false
			isBuiltin = $false
			installedTimestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
			pinned = $true
			source = 'vsix'
		}
	}
	$registryContent = "[$($entry | ConvertTo-Json -Depth 8 -Compress)]"
	[System.IO.File]::WriteAllText(
		(Join-Path $extensionsTarget 'extensions.json'),
		$registryContent,
		[System.Text.UTF8Encoding]::new($false)
	)

	# Apply product identity from source product.json so rebrand is not left behind
	# when reusing an older Electron base candidate (which still ships Grok Workbench.exe).
	# IMPORTANT: use in-place string replacement only — PowerShell ConvertTo-Json corrupts
	# product.json (BOM, reformatting, broken nested objects) and can black-screen the UI.
	$sourceProductPath = Join-Path $projectRoot 'product.json'
	$payloadProductPath = Join-Path $candidateRoot 'resources\app\product.json'
	if ((Test-Path -LiteralPath $sourceProductPath) -and (Test-Path -LiteralPath $payloadProductPath)) {
		$sourceProduct = Get-Content -Raw -LiteralPath $sourceProductPath | ConvertFrom-Json
		$payloadText = [System.IO.File]::ReadAllText($payloadProductPath)
		$identityFields = @(
			'nameShort', 'nameLong', 'applicationName', 'dataFolderName', 'sharedDataFolderName',
			'win32MutexName', 'win32DirName', 'win32NameVersion', 'win32RegValueName',
			'win32AppUserModelId', 'win32ShellNameShort', 'win32TunnelServiceMutex', 'win32TunnelMutex',
			'serverApplicationName', 'serverDataFolderName', 'tunnelApplicationName',
			'darwinBundleIdentifier', 'linuxIconName', 'urlProtocol', 'agentsTelemetryAppName'
		)
		foreach ($field in $identityFields) {
			$value = [string]$sourceProduct.$field
			if ([string]::IsNullOrEmpty($value)) { continue }
			$escaped = [regex]::Escape($value)
			# Replace "field": "..." value only (preserve JSON structure/formatting).
			$pattern = "(?m)(`"$([regex]::Escape($field))`"\s*:\s*)`"[^`"]*`""
			$replacement = "`${1}" + ('"' + ($value -replace '\\', '\\' -replace '"', '\"') + '"')
			$payloadText = [regex]::Replace($payloadText, $pattern, $replacement, 1)
		}
		$utf8NoBom = New-Object System.Text.UTF8Encoding $false
		[System.IO.File]::WriteAllText($payloadProductPath, $payloadText, $utf8NoBom)
		Write-Host "Patched payload product identity from source product.json (nameShort=$($sourceProduct.nameShort)) without ConvertTo-Json."
	}

	# Guard against incomplete Electron workbench assets.
	# Missing preload.js → pure black window (renderer never bootstraps).
	# Incomplete undici (missing websocketstream) → extension host crash loop.
	$goodApp = $null
	foreach ($candidate in @(
		(Join-Path $projectRoot 'releases\0.3.1\Grok-Workbench-IDE-0.3.1-win32-x64-portable\grok-workbench-poc-0.3.1\resources\app')
	)) {
		if (Test-Path -LiteralPath $candidate) { $goodApp = $candidate; break }
	}

	$preloadPath = Join-Path $candidateRoot 'resources\app\out\vs\base\parts\sandbox\electron-browser\preload.js'
	if (-not (Test-Path -LiteralPath $preloadPath)) {
		if (-not $goodApp) {
			throw "Payload is missing workbench preload.js and no known-good app tree was found to restore it."
		}
		$goodOut = Join-Path $goodApp 'out'
		$dstOut = Join-Path $candidateRoot 'resources\app\out'
		Get-ChildItem -LiteralPath $goodOut -Recurse -File | ForEach-Object {
			$rel = $_.FullName.Substring($goodOut.Length).TrimStart('\', '/')
			$dst = Join-Path $dstOut $rel
			if (-not (Test-Path -LiteralPath $dst)) {
				New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
				Copy-Item -Force -LiteralPath $_.FullName -Destination $dst
			}
		}
		if (-not (Test-Path -LiteralPath $preloadPath)) {
			throw "Failed to restore missing preload.js into payload out/ tree."
		}
		Write-Host "Restored missing workbench out/ assets (including preload.js) from known-good release tree."
	}

	$undiciWs = Join-Path $candidateRoot 'resources\app\node_modules\undici\lib\web\websocket\stream\websocketstream.js'
	if (-not (Test-Path -LiteralPath $undiciWs)) {
		if (-not $goodApp) {
			throw "Payload undici is incomplete (missing websocketstream) and no known-good app tree was found."
		}
		$goodUndici = Join-Path $goodApp 'node_modules\undici'
		$dstUndici = Join-Path $candidateRoot 'resources\app\node_modules\undici'
		if (Test-Path -LiteralPath $dstUndici) {
			Remove-Item -Recurse -Force -LiteralPath $dstUndici
		}
		Copy-Item -Recurse -Force -LiteralPath $goodUndici -Destination $dstUndici
		if (-not (Test-Path -LiteralPath $undiciWs)) {
			throw "Failed to restore complete undici package (websocketstream still missing)."
		}
		Write-Host "Restored complete undici package (fixes extension-host MODULE_NOT_FOUND crash)."
	}

	& (Join-Path $projectRoot 'scripts/verify-portable-extension-registry.ps1') -CandidateRoot $candidateRoot
	& (Join-Path $projectRoot 'scripts/verify-grok-workbench-portable-settings.ps1') -CandidateRoot $candidateRoot
	Compress-Archive -LiteralPath $candidateRoot -DestinationPath $archivePath -CompressionLevel Optimal

	[pscustomobject]@{
		Candidate = $candidateRoot
		Archive = $archivePath
		ArchiveBytes = (Get-Item -LiteralPath $archivePath).Length
		ArchiveSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash
		Extension = $extensionId
		ExtensionVersion = $manifest.version
	}
} finally {
	if ([System.IO.Directory]::Exists($extractRoot)) {
		[System.IO.Directory]::Delete($extractRoot, $true)
	}
}
