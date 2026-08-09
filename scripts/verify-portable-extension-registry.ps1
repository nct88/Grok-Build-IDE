param(
	[Parameter(Mandatory = $true)]
	[string]$CandidateRoot
)

$ErrorActionPreference = 'Stop'
$candidate = [System.IO.Path]::GetFullPath($CandidateRoot)
$extensionsRoot = Join-Path $candidate 'data\extensions'
$registryPath = Join-Path $extensionsRoot 'extensions.json'

if (-not (Test-Path -LiteralPath $registryPath -PathType Leaf)) {
	throw "Portable extension registry is missing: $registryPath"
}

$registryContent = Get-Content -LiteralPath $registryPath -Raw
if (-not $registryContent.TrimStart().StartsWith('[', [System.StringComparison]::Ordinal)) {
	throw 'Portable extension registry root must be a JSON array.'
}
$entries = @($registryContent | ConvertFrom-Json)
$grokEntries = @($entries | Where-Object { $_.identifier.id -eq 'local-grok-workbench.grok-build-workbench' })
if ($grokEntries.Count -ne 1) {
	throw "Expected exactly one Grok Build registry entry, found $($grokEntries.Count)."
}

$entry = $grokEntries[0]
if (-not $entry.location -or -not $entry.location.scheme -or -not $entry.location.path) {
	throw 'Grok Build registry entry must include a valid location URI for Code OSS schema validation.'
}
if ($entry.location.scheme -ne 'file' -or -not $entry.location.path.StartsWith('/', [System.StringComparison]::Ordinal)) {
	throw 'Grok Build registry location must use an absolute file URI path.'
}
if (-not $entry.relativeLocation) {
	throw 'Grok Build registry entry must include relativeLocation so the portable app remains relocatable.'
}

$extensionRoot = Join-Path $extensionsRoot $entry.relativeLocation
$manifestPath = Join-Path $extensionRoot 'package.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
	throw "Registered extension manifest is missing: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$manifestId = "$($manifest.publisher).$($manifest.name)"
if ($manifestId -ne $entry.identifier.id) {
	throw "Registry ID '$($entry.identifier.id)' does not match manifest ID '$manifestId'."
}
if ($manifest.version -ne $entry.version) {
	throw "Registry version '$($entry.version)' does not match manifest version '$($manifest.version)'."
}

[pscustomobject]@{
	Candidate = $candidate
	Extension = $manifestId
	Version = $manifest.version
	RelativeLocation = $entry.relativeLocation
	Status = 'valid-relocatable-registry'
}
