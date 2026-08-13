param(
	[Parameter(Mandatory = $true)]
	[string]$CandidateRoot
)

$ErrorActionPreference = 'Stop'
$candidate = [System.IO.Path]::GetFullPath($CandidateRoot)
$settingsPath = Join-Path $candidate 'data\user-data\User\settings.json'
if (-not (Test-Path -LiteralPath $settingsPath -PathType Leaf)) {
	throw "Portable user settings are missing: $settingsPath"
}
$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$expected = [ordered]@{
	'security.workspace.trust.enabled' = $true
	'window.openFoldersInNewWindow' = 'off'
	'window.openWithoutArgumentsInNewWindow' = 'off'
	'window.restoreWindows' = 'preserve'
	'git.openRepositoryInParentFolders' = 'always'
}
foreach ($property in $expected.GetEnumerator()) {
	$actual = $settings.PSObject.Properties[$property.Key].Value
	if ($actual -ne $property.Value) {
		throw "Portable setting '$($property.Key)' is '$actual'; expected '$($property.Value)'."
	}
}

[pscustomobject]@{
	Candidate = $candidate
	Settings = $settingsPath
	OpenFoldersInNewWindow = $settings.'window.openFoldersInNewWindow'
	OpenWithoutArgumentsInNewWindow = $settings.'window.openWithoutArgumentsInNewWindow'
	WorkspaceTrustEnabled = $settings.'security.workspace.trust.enabled'
	Status = 'valid-secure-portable-settings'
}
