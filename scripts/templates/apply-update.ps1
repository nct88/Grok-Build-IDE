# Apply a hash-verified Grok Build Workbench VSIX update transactionally.
# The IDE must be closed. Existing extension files and registry are retained in
# data/updates/backups so Rollback-Update.ps1 can restore the previous state.
param(
  [string]$InstallRoot = "$env:LOCALAPPDATA\Programs\Grok Build IDE",
  [string]$ManifestPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'MANIFEST.json'),
  [switch]$AllowUnsignedCandidate
)

$ErrorActionPreference = 'Stop'

function Get-FullPath([string]$Path) {
  return [IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

function Assert-ChildPath([string]$Root, [string]$Path, [string]$Label) {
  $rootPrefix = (Get-FullPath $Root) + [IO.Path]::DirectorySeparatorChar
  $full = Get-FullPath $Path
  if (-not $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "$Label escapes its allowed root: $full"
  }
  return $full
}

function Write-JsonNoBom([string]$Path, $Value) {
  $json = (ConvertTo-Json -InputObject $Value -Depth 12 -Compress) + "`n"
  [IO.File]::WriteAllText($Path, $json, [Text.UTF8Encoding]::new($false))
}

function New-ExtensionRegistryEntry($Package, [string]$Destination, [string]$RelativeLocation) {
  $id = "$($Package.publisher).$($Package.name)"
  $normalized = $Destination.Replace('\', '/')
  $drive = $normalized.Substring(0, 1).ToLowerInvariant()
  return [ordered]@{
    identifier = [ordered]@{ id = $id }
    version = $Package.version
    location = [ordered]@{
      '$mid' = 1
      fsPath = "$drive$($Destination.Substring(1))"
      '_sep' = 1
      external = "file:///$drive%3A$($normalized.Substring(2))"
      path = '/' + $drive + ':' + $normalized.Substring(2)
      scheme = 'file'
    }
    relativeLocation = $RelativeLocation
    metadata = [ordered]@{
      isApplicationScoped = $false
      isMachineScoped = $false
      isBuiltin = $false
      installedTimestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      pinned = $true
      source = 'vsix'
    }
  }
}

$installPath = Get-FullPath $InstallRoot
$extensionRoot = Assert-ChildPath $installPath (Join-Path $installPath 'data\extensions') 'Extension root'
if (-not (Test-Path -LiteralPath $extensionRoot -PathType Container)) {
  throw "Not a Grok Build IDE install: $extensionRoot is missing."
}

$running = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
  try { $_.Path -and (Get-FullPath $_.Path).StartsWith($installPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) }
  catch { $false }
})
if ($running.Count -gt 0) {
  throw "Close Grok Build IDE before updating. Running process: $($running[0].ProcessName) ($($running[0].Id))."
}

$vsixFiles = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.vsix' -File)
if ($vsixFiles.Count -ne 1) { throw "Expected exactly one VSIX in $PSScriptRoot; found $($vsixFiles.Count)." }
$vsix = $vsixFiles[0]
if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) { throw "Update manifest missing: $ManifestPath" }
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if (-not $AllowUnsignedCandidate -and $manifest.releaseStatus -notin @('public-signed','public-unsigned')) {
  throw "Update manifest is not a public release ($($manifest.releaseStatus))."
}
if ($manifest.releaseStatus -eq 'public-unsigned') {
  Write-Warning 'This public release is not Authenticode-signed. SHA-256 verification passed; Windows SmartScreen may still warn.'
}
$channel = $manifest.channels.update.vsix
if (-not $channel -or [string]::IsNullOrWhiteSpace([string]$channel.sha256)) {
  throw 'Update manifest does not contain channels.update.vsix.sha256.'
}
$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $vsix.FullName).Hash
if ($actualHash -ne [string]$channel.sha256) { throw "VSIX SHA-256 mismatch. Expected $($channel.sha256); got $actualHash." }
if ([string]$channel.file -ne $vsix.Name) { throw "VSIX filename does not match manifest: $($channel.file) vs $($vsix.Name)." }

$transactionId = "{0:yyyyMMddTHHmmssfffZ}-{1}" -f [DateTime]::UtcNow, ([guid]::NewGuid().ToString('n').Substring(0, 8))
$stagingRoot = Assert-ChildPath $extensionRoot (Join-Path $extensionRoot ".grok-update-stage-$transactionId") 'Staging root'
$backupRoot = Assert-ChildPath $installPath (Join-Path $installPath "data\updates\backups\$transactionId") 'Backup root'
$oldExtensionsBackup = Join-Path $backupRoot 'old-extensions'
$registryPath = Join-Path $extensionRoot 'extensions.json'
$registryNext = Join-Path $extensionRoot ".extensions.$transactionId.next.json"
$registryBackup = Join-Path $backupRoot 'extensions.previous.json'
$transactionPath = Join-Path $backupRoot 'transaction.json'
$promotedDestination = $null
$movedOld = [System.Collections.Generic.List[object]]::new()
$registryReplaced = $false

try {
  New-Item -ItemType Directory -Path $stagingRoot | Out-Null
  New-Item -ItemType Directory -Path $oldExtensionsBackup -Force | Out-Null

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($vsix.FullName)
  try {
    foreach ($entry in $archive.Entries) {
      if (-not $entry.FullName) { continue }
      $entryTarget = Assert-ChildPath $stagingRoot (Join-Path $stagingRoot $entry.FullName) 'VSIX entry'
      if ($entry.FullName.EndsWith('/')) {
        New-Item -ItemType Directory -Force -Path $entryTarget | Out-Null
        continue
      }
      New-Item -ItemType Directory -Force -Path (Split-Path $entryTarget -Parent) | Out-Null
      $source = $entry.Open()
      $destination = [IO.File]::Create($entryTarget)
      try { $source.CopyTo($destination) } finally { $destination.Dispose(); $source.Dispose() }
    }
  } finally {
    $archive.Dispose()
  }

  $packagePath = Join-Path $stagingRoot 'extension\package.json'
  if (-not (Test-Path -LiteralPath $packagePath)) { throw 'VSIX is missing extension/package.json.' }
  $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
  if (-not $package.publisher -or -not $package.name -or -not $package.version) { throw 'VSIX package identity is incomplete.' }
  if ([string]$package.version -ne [string]$manifest.version) {
    throw "VSIX version $($package.version) does not match manifest version $($manifest.version)."
  }
  $extensionId = "$($package.publisher).$($package.name)"
  $relativeLocation = "$extensionId-$($package.version)"
  $destinationPath = Assert-ChildPath $extensionRoot (Join-Path $extensionRoot $relativeLocation) 'Extension destination'

  $existingRegistry = @()
  $registryExisted = Test-Path -LiteralPath $registryPath
  if ($registryExisted) {
    Copy-Item -LiteralPath $registryPath -Destination $registryBackup
    $parsed = Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json
    if ($null -ne $parsed) { $existingRegistry = @($parsed) }
  }
  $newRegistry = [System.Collections.Generic.List[object]]::new()
  foreach ($item in $existingRegistry) {
    if (-not $item.identifier.id -or $item.identifier.id.ToLowerInvariant() -ne $extensionId.ToLowerInvariant()) {
      $newRegistry.Add($item) | Out-Null
    }
  }
  $newRegistry.Add((New-ExtensionRegistryEntry $package $destinationPath $relativeLocation)) | Out-Null
  $registryArray = @($newRegistry.ToArray())
  Write-JsonNoBom -Path $registryNext -Value $registryArray

  $oldDirectories = @(Get-ChildItem -LiteralPath $extensionRoot -Directory | Where-Object {
    $_.Name -like "$extensionId-*" -and $_.FullName -ne $stagingRoot
  })
  $transaction = [ordered]@{
    id = $transactionId
    status = 'prepared'
    extensionId = $extensionId
    fromVersions = @($oldDirectories | ForEach-Object Name)
    toVersion = [string]$package.version
    newRelativeLocation = $relativeLocation
    registryExisted = $registryExisted
    vsixSha256 = $actualHash
    manifestVersion = [string]$manifest.version
    startedAt = [DateTimeOffset]::UtcNow.ToString('o')
  }
  Write-JsonNoBom $transactionPath $transaction

  foreach ($oldDirectory in $oldDirectories) {
    $oldTarget = Assert-ChildPath $oldExtensionsBackup (Join-Path $oldExtensionsBackup $oldDirectory.Name) 'Extension backup'
    Move-Item -LiteralPath $oldDirectory.FullName -Destination $oldTarget
    $movedOld.Add([pscustomobject]@{ Original = $oldDirectory.FullName; Backup = $oldTarget }) | Out-Null
  }

  Move-Item -LiteralPath (Join-Path $stagingRoot 'extension') -Destination $destinationPath
  $promotedDestination = $destinationPath
  Move-Item -Force -LiteralPath $registryNext -Destination $registryPath
  $registryReplaced = $true

  if ($env:GROK_UPDATE_TEST_FAIL_AFTER_REGISTRY_SWAP -eq '1') {
    throw 'Injected update failure after registry swap.'
  }

  $transaction.status = 'complete'
  $transaction.completedAt = [DateTimeOffset]::UtcNow.ToString('o')
  Write-JsonNoBom $transactionPath $transaction
  Write-Host "Updated $extensionId to $($package.version). Backup: $backupRoot"
  Write-Host 'Restart Grok Build IDE to load the new extension.'
} catch {
  $failure = $_
  if ($registryReplaced) {
    if (Test-Path -LiteralPath $registryBackup) { Copy-Item -Force -LiteralPath $registryBackup -Destination $registryPath }
    elseif (Test-Path -LiteralPath $registryPath) { Remove-Item -Force -LiteralPath $registryPath }
  }
  if ($promotedDestination -and (Test-Path -LiteralPath $promotedDestination)) {
    Remove-Item -Recurse -Force -LiteralPath (Assert-ChildPath $extensionRoot $promotedDestination 'Failed update destination')
  }
  foreach ($moved in $movedOld) {
    if (Test-Path -LiteralPath $moved.Backup) { Move-Item -LiteralPath $moved.Backup -Destination $moved.Original }
  }
  if (Test-Path -LiteralPath $transactionPath) {
    $failedTransaction = Get-Content -LiteralPath $transactionPath -Raw | ConvertFrom-Json
    $failedTransaction.status = 'rolled-back-after-failure'
    $failedTransaction | Add-Member -NotePropertyName failure -NotePropertyValue $failure.Exception.Message -Force
    Write-JsonNoBom $transactionPath $failedTransaction
  }
  throw
} finally {
  if (Test-Path -LiteralPath $registryNext) { Remove-Item -Force -LiteralPath $registryNext }
  if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -Recurse -Force -LiteralPath (Assert-ChildPath $extensionRoot $stagingRoot 'Staging cleanup')
  }
}
