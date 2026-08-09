# Rebuild portable extensions.json from extension folders under data/extensions.
# - Registers only folders that still have package.json (ghost registry rows are dropped).
# - Use after a wiped registry, or when VS Code reports "Unable to read …/package.json".
param(
	[string]$InstallRoot = "$env:LOCALAPPDATA\Programs\Grok Build IDE"
)

$ErrorActionPreference = 'Stop'
$extRoot = Join-Path $InstallRoot 'data\extensions'
if (-not (Test-Path -LiteralPath $extRoot)) {
	throw "Not a portable/install layout: $extRoot missing"
}

function New-ExtensionRegistryEntry {
	param(
		[Parameter(Mandatory = $true)][string]$ExtensionDir,
		[Parameter(Mandatory = $true)][string]$RelativeLocation,
		[hashtable]$MetadataExtra = @{}
	)
	$pkgPath = Join-Path $ExtensionDir 'package.json'
	if (-not (Test-Path -LiteralPath $pkgPath)) {
		return $null
	}
	$pkg = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
	if (-not $pkg.name -or -not $pkg.publisher) {
		return $null
	}
	$id = "$($pkg.publisher).$($pkg.name)"
	$normalized = $ExtensionDir.Replace('\', '/')
	$drive = $normalized.Substring(0, 1).ToLowerInvariant()
	$fsPath = "$drive$($ExtensionDir.Substring(1))"
	$uriPath = '/' + $drive + ':' + $normalized.Substring(2)
	$external = "file:///$drive%3A$($normalized.Substring(2))"
	$meta = [ordered]@{
		isApplicationScoped = $false
		isMachineScoped     = $false
		isBuiltin           = $false
		installedTimestamp  = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
		pinned              = $true
		source              = 'vsix'
	}
	foreach ($key in $MetadataExtra.Keys) {
		$meta[$key] = $MetadataExtra[$key]
	}
	return [ordered]@{
		identifier         = [ordered]@{ id = $id }
		version            = $pkg.version
		location           = [ordered]@{
			'$mid'    = 1
			fsPath    = $fsPath
			'_sep'    = 1
			external  = $external
			path      = $uriPath
			scheme    = 'file'
		}
		relativeLocation   = $RelativeLocation
		metadata           = $meta
	}
}

$entries = [System.Collections.Generic.List[object]]::new()
$seenIds = @{}
Get-ChildItem -LiteralPath $extRoot -Directory | Where-Object {
	$_.Name -ne '.obsolete' -and $_.Name -notlike '.*'
} | ForEach-Object {
	$entry = New-ExtensionRegistryEntry -ExtensionDir $_.FullName -RelativeLocation $_.Name
	if (-not $entry) {
		Write-Warning "Skip (no package.json): $($_.Name)"
		return
	}
	$idKey = $entry.identifier.id.ToLowerInvariant()
	if ($seenIds.ContainsKey($idKey)) {
		# Prefer the folder that matches id-version naming; keep first otherwise.
		Write-Warning "Duplicate id $($entry.identifier.id); keeping first registered folder."
		return
	}
	$seenIds[$idKey] = $true
	$entries.Add($entry) | Out-Null
	Write-Host "Registered $($entry.identifier.id)@$($entry.version) <- $($_.Name)"
}

if ($entries.Count -eq 0) {
	throw "No extension folders found under $extRoot"
}

# Stable sort by id for readable diffs
$sorted = @($entries | Sort-Object { $_.identifier.id.ToLowerInvariant() })
$json = ($sorted | ConvertTo-Json -Depth 10 -Compress)
# ConvertTo-Json on array of 1 item loses array wrapper in older PS — force array
if ($sorted.Count -eq 1 -and -not $json.TrimStart().StartsWith('[')) {
	$json = "[$json]"
}
# PowerShell ConvertTo-Json may not produce a top-level array for List — ensure
if ($sorted.Count -gt 1) {
	# ConvertTo-Json on object[] already produces array
} elseif ($sorted.Count -eq 1) {
	$json = ConvertTo-Json -InputObject @($sorted[0]) -Depth 10 -Compress
}

$registryPath = Join-Path $extRoot 'extensions.json'
[System.IO.File]::WriteAllText($registryPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $($sorted.Count) entries -> $registryPath"
Write-Host "Restart Grok Build IDE so Extensions view reloads the registry."
