param([string]$PayloadDir, [string]$Version)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$buildRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot '.build')).Path
if (-not $Version) { $Version = (Get-Content -LiteralPath (Join-Path $projectRoot 'build\grok\VERSION') -Raw).Trim() }
if (-not $PayloadDir) { $PayloadDir = Join-Path $buildRoot "release-candidates\$Version\payload\grok-workbench-poc-$Version" }
$payload = (Resolve-Path -LiteralPath $PayloadDir).Path
$iscc = @('C:\Program Files (x86)\Inno Setup 6\ISCC.exe', 'C:\Program Files\Inno Setup 6\ISCC.exe') |
  Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $iscc) { throw 'Inno Setup 6 compiler is required for the installer lifecycle test.' }

$id = [guid]::NewGuid().ToString('n')
$testRoot = Join-Path $buildRoot "installer-lifecycle-$id"
$outputRoot = Join-Path $testRoot 'output'
$installRoot = Join-Path $testRoot 'install'
$appId = "GrokBuildIDE-Lifecycle-$id"
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\${appId}_is1"
$installerName = "Grok-Build-IDE-Lifecycle-$id"
$installer = Join-Path $outputRoot "$installerName.exe"
$iss = Join-Path $projectRoot 'build\grok\setup-installer\GrokBuildIDE.iss'

function Assert([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Run-Hidden([string]$FilePath, [string[]]$Arguments) {
  $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -PassThru -Wait -WindowStyle Hidden
  if ($process.ExitCode -ne 0) { throw "$FilePath exited with code $($process.ExitCode)." }
}

try {
  New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
  Assert (-not (Test-Path -LiteralPath $uninstallKey)) 'Unique lifecycle AppId unexpectedly already exists.'
  & $iscc '/Qp' "/DMyAppVersion=$Version" "/DMyAppId=$appId" "/DPayloadSourceDir=$payload" "/O$outputRoot" "/F$installerName" $iss
  if ($LASTEXITCODE -ne 0) { throw "Inno lifecycle compilation failed with exit code $LASTEXITCODE." }
  Assert (Test-Path -LiteralPath $installer -PathType Leaf) 'Lifecycle installer was not created.'

  Run-Hidden $installer @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/NOICONS',"/DIR=$installRoot",("/LOG=" + (Join-Path $testRoot 'install.log')))
  $installedExe = Join-Path $installRoot 'Grok Build IDE.exe'
  $installedProduct = Join-Path $installRoot 'resources\app\product.json'
  $installedPackage = Join-Path $installRoot 'resources\app\package.json'
  Assert (Test-Path -LiteralPath $installedExe) 'Installed executable is missing.'
  Assert (Test-Path -LiteralPath $installedProduct) 'Installed product.json is missing.'
  Assert (Test-Path -LiteralPath $installedPackage) 'Installed package.json is missing.'
  Assert (Test-Path -LiteralPath (Join-Path $installRoot 'data\extensions\extensions.json')) 'Installed portable extension registry is missing.'
  Assert (Test-Path -LiteralPath $uninstallKey) 'Isolated uninstall registration was not created.'
  Assert ((Get-FileHash -Algorithm SHA256 -LiteralPath $installedProduct).Hash -eq (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $payload 'resources\app\product.json')).Hash) 'Installed product.json differs from the payload.'

  $uninstaller = Join-Path $installRoot 'unins000.exe'
  Assert (Test-Path -LiteralPath $uninstaller) 'Uninstaller was not created.'
  Run-Hidden $uninstaller @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',("/LOG=" + (Join-Path $testRoot 'uninstall.log')))
  Assert (-not (Test-Path -LiteralPath $uninstallKey)) 'Uninstall registration remains after uninstall.'
  Assert (-not (Test-Path -LiteralPath $installedExe)) 'Installed executable remains after uninstall.'
  Write-Host "Windows installer lifecycle passed with isolated AppId $appId."
} finally {
  $uninstaller = Join-Path $installRoot 'unins000.exe'
  if (Test-Path -LiteralPath $uninstaller) {
    try { Run-Hidden $uninstaller @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART') } catch { Write-Warning $_.Exception.Message }
  }
  if (Test-Path -LiteralPath $uninstallKey) { Remove-Item -Recurse -Force -LiteralPath $uninstallKey }
  $testFull = [IO.Path]::GetFullPath($testRoot)
  if ($testFull.StartsWith($buildRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $testFull)) {
    Remove-Item -Recurse -Force -LiteralPath $testFull
  }
}
