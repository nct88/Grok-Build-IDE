param([string]$VsixPath)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$buildRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot '.build')).Path
if (-not $VsixPath) {
  $currentVersion = (Get-Content -LiteralPath (Join-Path $projectRoot 'extensions\grok-build-workbench\package.json') -Raw | ConvertFrom-Json).version
  $VsixPath = Join-Path $projectRoot "extensions\grok-build-workbench\grok-build-workbench-$currentVersion.vsix"
}
$vsix = (Resolve-Path -LiteralPath $VsixPath).Path
$testRoot = Join-Path $buildRoot ("update-lifecycle-{0}" -f [guid]::NewGuid().ToString('n'))
if (-not ([IO.Path]::GetFullPath($testRoot)).StartsWith($buildRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test root.' }

function Json([string]$Path, $Value) {
  [IO.File]::WriteAllText($Path, ((ConvertTo-Json -InputObject $Value -Depth 12 -Compress) + "`n"), [Text.UTF8Encoding]::new($false))
}
function New-Fixture([string]$Name) {
  $root = Join-Path $testRoot $Name
  $extensions = Join-Path $root 'install\data\extensions'
  $update = Join-Path $root 'release\update'
  New-Item -ItemType Directory -Force -Path $extensions,$update | Out-Null
  $oldRel = 'local-grok-workbench.grok-build-workbench-1.0.7'
  $otherRel = 'sample.other-extension-2.0.0'
  New-Item -ItemType Directory -Path (Join-Path $extensions $oldRel),(Join-Path $extensions $otherRel) | Out-Null
  Json (Join-Path $extensions "$oldRel\package.json") @{ publisher='local-grok-workbench'; name='grok-build-workbench'; version='1.0.7' }
  Json (Join-Path $extensions "$otherRel\package.json") @{ publisher='sample'; name='other-extension'; version='2.0.0' }
  $registry = @(
    @{ identifier=@{id='local-grok-workbench.grok-build-workbench'}; version='1.0.7'; relativeLocation=$oldRel },
    @{ identifier=@{id='sample.other-extension'}; version='2.0.0'; relativeLocation=$otherRel }
  )
  Json -Path (Join-Path $extensions 'extensions.json') -Value $registry
  Copy-Item -LiteralPath $vsix -Destination (Join-Path $update (Split-Path $vsix -Leaf))
  Copy-Item -LiteralPath (Join-Path $projectRoot 'scripts\templates\apply-update.ps1') -Destination (Join-Path $update 'apply-update.ps1')
  Copy-Item -LiteralPath (Join-Path $projectRoot 'scripts\templates\rollback-update.ps1') -Destination (Join-Path $update 'rollback-update.ps1')
  $packageVersion = (Get-Content -LiteralPath (Join-Path $projectRoot 'extensions\grok-build-workbench\package.json') -Raw | ConvertFrom-Json).version
  $vsixFile = Get-Item -LiteralPath (Join-Path $update (Split-Path $vsix -Leaf))
  Json (Join-Path $root 'release\MANIFEST.json') @{
    version=$packageVersion; releaseStatus='public-unsigned'; channels=@{ update=@{ vsix=@{ file=$vsixFile.Name; sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $vsixFile.FullName).Hash } } }
  }
  [pscustomobject]@{ Root=$root; Install=(Join-Path $root 'install'); Extensions=$extensions; Update=$update; OldRel=$oldRel; OtherRel=$otherRel; Version=$packageVersion }
}
function Assert([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }

try {
  New-Item -ItemType Directory -Path $testRoot | Out-Null

  $success = New-Fixture 'success'
  & (Join-Path $success.Update 'apply-update.ps1') -InstallRoot $success.Install
  Assert (Test-Path -LiteralPath (Join-Path $success.Extensions "local-grok-workbench.grok-build-workbench-$($success.Version)\package.json")) 'New extension was not installed.'
  Assert (Test-Path -LiteralPath (Join-Path $success.Extensions "$($success.OtherRel)\package.json")) 'Unrelated extension was removed.'
  $registry = Get-Content -LiteralPath (Join-Path $success.Extensions 'extensions.json') -Raw | ConvertFrom-Json
  Assert ($registry.Count -eq 2) "Registry did not preserve exactly two extensions (count=$($registry.Count); raw=$(Get-Content -LiteralPath (Join-Path $success.Extensions 'extensions.json') -Raw))."
  & (Join-Path $success.Update 'rollback-update.ps1') -InstallRoot $success.Install
  Assert (Test-Path -LiteralPath (Join-Path $success.Extensions "$($success.OldRel)\package.json")) 'Explicit rollback did not restore the previous extension.'
  Assert (-not (Test-Path -LiteralPath (Join-Path $success.Extensions "local-grok-workbench.grok-build-workbench-$($success.Version)"))) 'Explicit rollback left the updated extension behind.'

  $failure = New-Fixture 'injected-failure'
  $env:GROK_UPDATE_TEST_FAIL_AFTER_REGISTRY_SWAP = '1'
  try {
    & (Join-Path $failure.Update 'apply-update.ps1') -InstallRoot $failure.Install
    throw 'Injected update failure unexpectedly succeeded.'
  } catch {
    if ($_.Exception.Message -eq 'Injected update failure unexpectedly succeeded.') { throw }
  } finally {
    Remove-Item Env:GROK_UPDATE_TEST_FAIL_AFTER_REGISTRY_SWAP -ErrorAction SilentlyContinue
  }
  Assert (Test-Path -LiteralPath (Join-Path $failure.Extensions "$($failure.OldRel)\package.json")) 'Automatic rollback did not restore the previous extension.'
  $failedRegistry = Get-Content -LiteralPath (Join-Path $failure.Extensions 'extensions.json') -Raw | ConvertFrom-Json
  Assert ($failedRegistry[0].version -eq '1.0.7') 'Automatic rollback did not restore the previous registry.'

  $tamper = New-Fixture 'tampered'
  Add-Content -LiteralPath (Join-Path $tamper.Update (Split-Path $vsix -Leaf)) -Value 'tampered'
  try {
    & (Join-Path $tamper.Update 'apply-update.ps1') -InstallRoot $tamper.Install
    throw 'Tampered VSIX unexpectedly succeeded.'
  } catch {
    if ($_.Exception.Message -eq 'Tampered VSIX unexpectedly succeeded.') { throw }
    Assert ($_.Exception.Message -like 'VSIX SHA-256 mismatch*') 'Tampered VSIX failed for an unexpected reason.'
  }
  Assert (Test-Path -LiteralPath (Join-Path $tamper.Extensions "$($tamper.OldRel)\package.json")) 'Hash rejection changed the installed extension.'

  Write-Host 'Update lifecycle passed: verified apply, unrelated preservation, injected-failure rollback, explicit rollback, tamper rejection.'
} finally {
  if (Test-Path -LiteralPath $testRoot) {
    Remove-Item -Recurse -Force -LiteralPath $testRoot
  }
}
