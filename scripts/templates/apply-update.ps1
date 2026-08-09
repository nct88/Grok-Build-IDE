# Apply Grok Build Workbench update (extension only) to an existing install.
# Merges into data/extensions/extensions.json — does NOT wipe other extensions (GitHub, Python, …).
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\apply-update.ps1 -InstallRoot "C:\Users\<you>\AppData\Local\Programs\Grok Build IDE"
param(
  [string]$InstallRoot = "$env:LOCALAPPDATA\Programs\Grok Build IDE"
)
$ErrorActionPreference = 'Stop'
$vsix = Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.vsix' | Select-Object -First 1
if (-not $vsix) { throw 'No VSIX in update folder.' }
$extRoot = Join-Path $InstallRoot 'data\extensions'
if (-not (Test-Path $extRoot)) { throw "Not a portable/install layout: $extRoot missing" }
$work = Join-Path $env:TEMP ("grok-update-" + [guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($vsix.FullName, $work)
  $pkg = Get-Content (Join-Path $work 'extension\package.json') -Raw | ConvertFrom-Json
  $id = "$($pkg.publisher).$($pkg.name)"
  $rel = "$id-$($pkg.version)"
  $dest = Join-Path $extRoot $rel
  if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
  Copy-Item -Recurse (Join-Path $work 'extension') $dest
  $normalized = $dest.Replace('\','/')
  $drive = $normalized.Substring(0,1).ToLowerInvariant()
  $fsPath = "$drive$($dest.Substring(1))"
  $uriPath = '/' + $drive + ':' + $normalized.Substring(2)
  $external = "file:///$drive%3A$($normalized.Substring(2))"
  $entry = [ordered]@{
    identifier = [ordered]@{ id = $id }
    version = $pkg.version
    location = [ordered]@{ '$mid'=1; fsPath=$fsPath; '_sep'=1; external=$external; path=$uriPath; scheme='file' }
    relativeLocation = $rel
    metadata = [ordered]@{ isApplicationScoped=$false; isMachineScoped=$false; isBuiltin=$false; installedTimestamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); pinned=$true; source='vsix' }
  }

  $registryPath = Join-Path $extRoot 'extensions.json'
  $list = [System.Collections.Generic.List[object]]::new()
  if (Test-Path -LiteralPath $registryPath) {
    try {
      $existing = Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json
      if ($null -eq $existing) { $existing = @() }
      if ($existing -isnot [System.Array]) { $existing = @($existing) }
      foreach ($item in $existing) {
        $itemId = $item.identifier.id
        if (-not $itemId -or ($itemId.ToLowerInvariant() -eq $id.ToLowerInvariant())) {
          continue
        }
        # Drop ghost entries whose folders were deleted (prevents "Unable to read package.json")
        $relFolder = $item.relativeLocation
        if (-not $relFolder) { continue }
        $folderPath = Join-Path $extRoot $relFolder
        $pkgOnDisk = Join-Path $folderPath 'package.json'
        if (-not (Test-Path -LiteralPath $pkgOnDisk)) {
          Write-Warning "Pruning missing extension from registry: $itemId ($relFolder)"
          continue
        }
        $list.Add($item) | Out-Null
      }
    } catch {
      Write-Warning "Could not parse existing extensions.json; recovering from folders."
    }
  }
  $list.Add((ConvertTo-Json $entry -Depth 10 | ConvertFrom-Json)) | Out-Null

  $knownRels = @{}
  foreach ($item in $list) {
    if ($item.relativeLocation) { $knownRels[$item.relativeLocation] = $true }
  }
  Get-ChildItem -LiteralPath $extRoot -Directory | Where-Object {
    $_.Name -ne '.obsolete' -and -not $knownRels.ContainsKey($_.Name)
  } | ForEach-Object {
    $pkgPath = Join-Path $_.FullName 'package.json'
    if (-not (Test-Path $pkgPath)) { return }
    $p = Get-Content $pkgPath -Raw | ConvertFrom-Json
    if (-not $p.name -or -not $p.publisher) { return }
    $otherId = "$($p.publisher).$($p.name)"
    if ($otherId.ToLowerInvariant() -eq $id.ToLowerInvariant()) { return }
    foreach ($item in $list) {
      if ($item.identifier.id -and $item.identifier.id.ToLowerInvariant() -eq $otherId.ToLowerInvariant()) { return }
    }
    $n = $_.FullName.Replace('\','/')
    $d = $n.Substring(0,1).ToLowerInvariant()
    $other = [ordered]@{
      identifier = [ordered]@{ id = $otherId }
      version = $p.version
      location = [ordered]@{
        '$mid'=1
        fsPath = "$d$($_.FullName.Substring(1))"
        '_sep'=1
        external = "file:///$d%3A$($n.Substring(2))"
        path = '/' + $d + ':' + $n.Substring(2)
        scheme = 'file'
      }
      relativeLocation = $_.Name
      metadata = [ordered]@{ isApplicationScoped=$false; isMachineScoped=$false; isBuiltin=$false; installedTimestamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); pinned=$true; source='vsix' }
    }
    $list.Add((ConvertTo-Json $other -Depth 10 | ConvertFrom-Json)) | Out-Null
    Write-Host "Recovered registry entry for $otherId"
  }

  $arr = @($list.ToArray())
  $json = ConvertTo-Json -InputObject $arr -Depth 10 -Compress
  [System.IO.File]::WriteAllText($registryPath, $json, [System.Text.UTF8Encoding]::new($false))
  Get-ChildItem $extRoot -Directory | Where-Object { $_.Name -like "$id-*" -and $_.Name -ne $rel } | Remove-Item -Recurse -Force
  Write-Host "Updated $id to $($pkg.version) under $dest (registry now has $($arr.Count) extension(s))"
  Write-Host "Restart Grok Build IDE to load the new extension."
} finally {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
