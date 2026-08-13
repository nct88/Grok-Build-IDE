param(
  [string]$InstallRoot = "$env:LOCALAPPDATA\Programs\Grok Build IDE",
  [string]$TransactionId = ''
)

$ErrorActionPreference = 'Stop'
function Full([string]$Path) { [IO.Path]::GetFullPath($Path).TrimEnd('\', '/') }
function Child([string]$Root, [string]$Path, [string]$Label) {
  $prefix = (Full $Root) + [IO.Path]::DirectorySeparatorChar
  $full = Full $Path
  if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "$Label escapes root: $full" }
  $full
}
function WriteJson([string]$Path, $Value) {
  [IO.File]::WriteAllText($Path, ((ConvertTo-Json -InputObject $Value -Depth 12 -Compress) + "`n"), [Text.UTF8Encoding]::new($false))
}

$installPath = Full $InstallRoot
$extensionRoot = Child $installPath (Join-Path $installPath 'data\extensions') 'Extension root'
$backupsRoot = Child $installPath (Join-Path $installPath 'data\updates\backups') 'Backup root'
if (-not (Test-Path -LiteralPath $backupsRoot)) { throw 'No update backups are available.' }
$candidate = if ($TransactionId) {
  Get-Item -LiteralPath (Child $backupsRoot (Join-Path $backupsRoot $TransactionId) 'Transaction')
} else {
  Get-ChildItem -LiteralPath $backupsRoot -Directory | Sort-Object LastWriteTime -Descending | Where-Object {
    $metadata = Join-Path $_.FullName 'transaction.json'
    if (-not (Test-Path -LiteralPath $metadata)) { return $false }
    (Get-Content -LiteralPath $metadata -Raw | ConvertFrom-Json).status -eq 'complete'
  } | Select-Object -First 1
}
if (-not $candidate) { throw 'No completed update transaction is available to roll back.' }
$transactionPath = Join-Path $candidate.FullName 'transaction.json'
$transaction = Get-Content -LiteralPath $transactionPath -Raw | ConvertFrom-Json
if ($transaction.status -ne 'complete') { throw "Transaction $($transaction.id) is not rollback-ready ($($transaction.status))." }

$running = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
  try { $_.Path -and (Full $_.Path).StartsWith($installPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) }
  catch { $false }
})
if ($running.Count) { throw 'Close Grok Build IDE before rolling back an update.' }

$registryPath = Join-Path $extensionRoot 'extensions.json'
$registryBackup = Join-Path $candidate.FullName 'extensions.previous.json'
$newPath = Child $extensionRoot (Join-Path $extensionRoot $transaction.newRelativeLocation) 'Updated extension'
$oldRoot = Join-Path $candidate.FullName 'old-extensions'

if (Test-Path -LiteralPath $newPath) { Remove-Item -Recurse -Force -LiteralPath $newPath }
if (Test-Path -LiteralPath $oldRoot) {
  Get-ChildItem -LiteralPath $oldRoot -Directory | ForEach-Object {
    $restorePath = Child $extensionRoot (Join-Path $extensionRoot $_.Name) 'Restored extension'
    if (Test-Path -LiteralPath $restorePath) { throw "Rollback target already exists: $restorePath" }
    Move-Item -LiteralPath $_.FullName -Destination $restorePath
  }
}
if ($transaction.registryExisted) {
  if (-not (Test-Path -LiteralPath $registryBackup)) { throw 'Previous registry backup is missing.' }
  Copy-Item -Force -LiteralPath $registryBackup -Destination $registryPath
} elseif (Test-Path -LiteralPath $registryPath) {
  Remove-Item -Force -LiteralPath $registryPath
}
$transaction.status = 'rolled-back'
$transaction | Add-Member -NotePropertyName rolledBackAt -NotePropertyValue ([DateTimeOffset]::UtcNow.ToString('o')) -Force
WriteJson $transactionPath $transaction
Write-Host "Rolled back update transaction $($transaction.id)."
