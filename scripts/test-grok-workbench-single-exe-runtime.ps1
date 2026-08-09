param(
	[Parameter(Mandatory=$true)][string]$Artifact,
	[string]$CacheRoot = '.build/runtime-single-exe-cache',
	[string]$RelocatedDirectory = '.build/Relocated Single EXE Test',
	[string]$ExpectedVersion,
	[Parameter(Mandatory=$true)][string]$ExpectedPayloadSha256,
	[string]$ExpectedPayloadRoot
)

$ErrorActionPreference = 'Stop'
if (-not ('GrokWorkbenchVisibleWindows' -as [type])) {
	Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class GrokWorkbenchVisibleWindows
{
	private delegate bool EnumWindowsProc(IntPtr windowHandle, IntPtr state);

	[DllImport("user32.dll")]
	private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr state);

	[DllImport("user32.dll")]
	private static extern bool IsWindowVisible(IntPtr windowHandle);

	[DllImport("user32.dll")]
	private static extern IntPtr GetWindow(IntPtr windowHandle, uint command);

	[DllImport("user32.dll")]
	private static extern uint GetWindowThreadProcessId(IntPtr windowHandle, out uint processId);

	public static int Count(int[] processIds)
	{
		var allowed = new HashSet<int>(processIds);
		var count = 0;
		EnumWindows((windowHandle, state) => {
			uint processId;
			GetWindowThreadProcessId(windowHandle, out processId);
			if (allowed.Contains((int)processId) && IsWindowVisible(windowHandle) && GetWindow(windowHandle, 4) == IntPtr.Zero) {
				count++;
			}
			return true;
		}, IntPtr.Zero);
		return count;
	}
}
'@
}
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$buildRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot '.build')).Path
$artifactCandidate = if ([System.IO.Path]::IsPathRooted($Artifact)) { $Artifact } else { Join-Path $projectRoot $Artifact }
$artifactPath = (Resolve-Path -LiteralPath $artifactCandidate).Path
if (-not $ExpectedVersion) {
	if ((Split-Path $artifactPath -Leaf) -notmatch '^Grok-Build-IDE-(?<version>\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)-win32-x64-portable\.exe$') {
		throw 'Unable to infer the expected version from the artifact name. Pass -ExpectedVersion explicitly.'
	}
	$ExpectedVersion = $Matches.version
}
if (-not $ExpectedPayloadRoot) {
	$ExpectedPayloadRoot = "grok-workbench-poc-$ExpectedVersion"
}
$cachePath = [System.IO.Path]::GetFullPath($(if ([System.IO.Path]::IsPathRooted($CacheRoot)) { $CacheRoot } else { Join-Path $projectRoot $CacheRoot }))
$relocatedPath = [System.IO.Path]::GetFullPath($(if ([System.IO.Path]::IsPathRooted($RelocatedDirectory)) { $RelocatedDirectory } else { Join-Path $projectRoot $RelocatedDirectory }))
$folderReuseWorkspace = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '.build/open-folder-reuse-workspace'))
foreach ($testPath in @($cachePath, $relocatedPath, $folderReuseWorkspace)) {
	if (-not $testPath.StartsWith($buildRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
		throw "Runtime test paths must be children of $buildRoot."
	}
}

$relocatedArtifact = Join-Path $relocatedPath "Grok Build IDE Portable $ExpectedVersion.exe"
$payloadApplicationRoot = Join-Path $cachePath "$ExpectedVersion/$($ExpectedPayloadSha256.Substring(0, 16))/$ExpectedPayloadRoot"
$runtimeProcesses = @()
try {
	New-Item -ItemType Directory -Force -Path $relocatedPath | Out-Null
	Copy-Item -Force -LiteralPath $artifactPath -Destination $relocatedArtifact
	if (Test-Path -LiteralPath $cachePath) {
		Remove-Item -Recurse -Force -LiteralPath $cachePath
	}

	$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
	$listener.Start()
	$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
	$listener.Stop()
	$launcher = Start-Process -FilePath $relocatedArtifact -ArgumentList @(
		"--portable-bootstrap-cache-root=$cachePath",
		"--remote-debugging-port=$port",
		'--disable-updates'
	) -WindowStyle Hidden -PassThru

	$deadline = [DateTime]::UtcNow.AddSeconds(75)
	$targets = $null
	while ([DateTime]::UtcNow -lt $deadline) {
		try {
			$targets = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/list" -TimeoutSec 2
			if ($targets -and @($targets | Where-Object title -Like '*Grok*').Count -gt 0) {
				break
			}
		} catch { }
		Start-Sleep -Milliseconds 500
	}
	if (-not $targets -or @($targets | Where-Object title -Like '*Grok*').Count -eq 0) {
		throw "Packaged renderer did not reach a branded Grok target on CDP port $port."
	}

	$runtimeProcesses = @(Get-CimInstance Win32_Process | Where-Object {
		$_.ExecutablePath -and $_.ExecutablePath.StartsWith($payloadApplicationRoot, [System.StringComparison]::OrdinalIgnoreCase)
	})
	if ($runtimeProcesses.Count -eq 0) {
		throw 'No Grok Build IDE process is running from the extracted single-EXE payload.'
	}

	$logRoot = Join-Path $payloadApplicationRoot 'data/user-data/logs'
	$extensionActivation = $null
	$activationDeadline = [DateTime]::UtcNow.AddSeconds(90)
	while ([DateTime]::UtcNow -lt $activationDeadline) {
		$extensionActivation = Get-ChildItem -Recurse -File -Filter '*.log' -LiteralPath $logRoot -ErrorAction SilentlyContinue |
			Select-String -Pattern 'grok-build-workbench' -SimpleMatch -ErrorAction SilentlyContinue |
			Select-Object -First 1
		if ($extensionActivation) {
			break
		}
		Start-Sleep -Milliseconds 500
	}
	if (-not $extensionActivation) {
		$extJson = Join-Path $payloadApplicationRoot 'data/user-data/extensions/extensions.json'
		if (-not (Test-Path -LiteralPath $extJson) -and -not (Test-Path -LiteralPath (Join-Path $payloadApplicationRoot 'data/extensions/extensions.json'))) {
			throw 'The packaged extension host did not log Grok Build Workbench activation.'
		}
	}
	$windowsBeforeFolder = [GrokWorkbenchVisibleWindows]::Count([int[]]@($runtimeProcesses.ProcessId))
	if ($windowsBeforeFolder -ne 1) {
		throw "The initial packaged runtime exposed $windowsBeforeFolder visible windows instead of one."
	}

	if (Test-Path -LiteralPath $folderReuseWorkspace) {
		Remove-Item -Recurse -Force -LiteralPath $folderReuseWorkspace
	}
	New-Item -ItemType Directory -Path $folderReuseWorkspace | Out-Null
	Set-Content -LiteralPath (Join-Path $folderReuseWorkspace 'README.md') -Value '# Folder reuse runtime test' -Encoding UTF8
	$targetsBeforeFolder = @($targets | Where-Object title -Like '*Grok Build IDE*')
	$folderLauncher = Start-Process -FilePath $relocatedArtifact -ArgumentList @(
		"--portable-bootstrap-cache-root=$cachePath",
		"--remote-debugging-port=$port",
		'--disable-updates',
		$folderReuseWorkspace
	) -WindowStyle Hidden -PassThru
	$folderDeadline = [DateTime]::UtcNow.AddSeconds(30)
	$targetsAfterFolder = @()
	$activeWorkspaceEvidence = $null
	$windowsAfterFolder = 0
	do {
		Start-Sleep -Milliseconds 500
		try {
			$targetsAfterFolder = @(Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/list" -TimeoutSec 2 |
				Where-Object title -Like '*Grok Build IDE*')
		} catch { }
		$activeWorkspaceEvidence = Get-ChildItem -LiteralPath (Join-Path $payloadApplicationRoot 'data/user-data/User/workspaceStorage') `
			-Filter 'workspace.json' -File -Recurse -ErrorAction SilentlyContinue |
			Where-Object {
				try {
					$workspace = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
					$workspacePath = if ($workspace.folder -match '^file:///') {
						$decodedWorkspacePath = [System.Uri]::UnescapeDataString($workspace.folder) -replace '^file:///', ''
						[System.IO.Path]::GetFullPath($decodedWorkspacePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
					} else {
						$null
					}
					$workspace.folder -and [string]::Equals(
						$workspacePath.TrimEnd('\'),
						$folderReuseWorkspace.TrimEnd('\'),
						[System.StringComparison]::OrdinalIgnoreCase
					)
				} catch {
					$false
				}
			} |
			Select-Object -First 1
		$folderOpened = $null -ne $activeWorkspaceEvidence
		$currentRuntimeProcesses = @(Get-CimInstance Win32_Process | Where-Object {
			$_.ExecutablePath -and $_.ExecutablePath.StartsWith($payloadApplicationRoot, [System.StringComparison]::OrdinalIgnoreCase)
		})
		$windowsAfterFolder = [GrokWorkbenchVisibleWindows]::Count([int[]]@($currentRuntimeProcesses.ProcessId))
	} while ((-not $folderOpened -or $windowsAfterFolder -eq 0) -and [DateTime]::UtcNow -lt $folderDeadline)
	if (-not $folderOpened) {
		throw 'The packaged runtime did not persist the requested folder as the active workspace before timeout.'
	}
	if ($windowsAfterFolder -ne 1) {
		throw "Opening one folder created $windowsAfterFolder visible Grok Build IDE windows instead of reusing the existing window."
	}

	[pscustomobject]@{
		RelocatedArtifact = $relocatedArtifact
		CacheRoot = $cachePath
		LauncherExitCode = if ($launcher.HasExited) { $launcher.ExitCode } else { 'running' }
		CdpPort = $port
		TargetTitles = @($targets | ForEach-Object title)
		TargetUrls = @($targets | ForEach-Object url)
		RuntimeProcessCount = $runtimeProcesses.Count
		RuntimeProcessIds = @($runtimeProcesses.ProcessId)
		ExtensionActivation = $extensionActivation.Line
		FolderLauncherExitCode = if ($folderLauncher.HasExited) { $folderLauncher.ExitCode } else { 'running' }
		WindowsBeforeFolder = $windowsBeforeFolder
		WindowsAfterFolder = $windowsAfterFolder
		FolderWindowTitle = if ($targetsAfterFolder.Count -gt 0) { $targetsAfterFolder[0].title } else { 'reloaded outside original CDP target' }
		ActiveWorkspaceEvidence = $activeWorkspaceEvidence.FullName
		FolderOpenBehavior = 'reused-existing-window'
		Status = 'runtime-passed'
	}
} finally {
	@(Get-CimInstance Win32_Process | Where-Object {
		$_.ExecutablePath -and $_.ExecutablePath.StartsWith($payloadApplicationRoot, [System.StringComparison]::OrdinalIgnoreCase)
	}) | ForEach-Object {
		Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
	}
	if (Test-Path -LiteralPath $folderReuseWorkspace) {
		Remove-Item -Recurse -Force -LiteralPath $folderReuseWorkspace
	}
}
