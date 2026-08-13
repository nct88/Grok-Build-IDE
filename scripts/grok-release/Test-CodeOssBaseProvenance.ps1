param(
	[Parameter(Mandatory = $true)][string]$BaseCandidateRoot,
	[string]$ProjectRoot,
	[switch]$RequireClean
)

$ErrorActionPreference = 'Stop'
if (-not $PSScriptRoot) { $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$baseRoot = (Resolve-Path -LiteralPath $BaseCandidateRoot).Path
$provenancePath = Join-Path $baseRoot '.grok-base-provenance.json'
if (-not (Test-Path -LiteralPath $provenancePath -PathType Leaf)) {
	throw "Code OSS base provenance is missing: $provenancePath"
}

$provenance = Get-Content -LiteralPath $provenancePath -Raw | ConvertFrom-Json
if ($provenance.schemaVersion -ne 1) { throw "Unsupported base provenance schema: $($provenance.schemaVersion)" }

$sourceCommit = (& git -C $ProjectRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $sourceCommit -notmatch '^[0-9a-fA-F]{40}$') { throw 'Unable to resolve the source Git commit.' }
$sourceDirty = @(& git -C $ProjectRoot status --porcelain --untracked-files=normal).Count -gt 0
$sourcePackageVersion = (Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json).version
$product = Get-Content -LiteralPath (Join-Path $ProjectRoot 'product.json') -Raw | ConvertFrom-Json

$productPath = Join-Path $baseRoot 'resources\app\product.json'
$packagePath = Join-Path $baseRoot 'resources\app\package.json'
$executablePath = Join-Path $baseRoot "$($product.nameShort).exe"
foreach ($required in @($productPath, $packagePath, $executablePath)) {
	if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Code OSS base file is missing: $required" }
}

$baseProduct = Get-Content -LiteralPath $productPath -Raw | ConvertFrom-Json
$basePackageVersion = (Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json).version
$actualProductSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $productPath).Hash
$actualExecutableSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $executablePath).Hash

if ($provenance.source.commit -ne $sourceCommit) { throw "Base commit $($provenance.source.commit) does not match source commit $sourceCommit." }
if ($provenance.source.packageVersion -ne $sourcePackageVersion) { throw "Base provenance package $($provenance.source.packageVersion) does not match source package $sourcePackageVersion." }
if ($basePackageVersion -ne $sourcePackageVersion) { throw "Base package version $basePackageVersion does not match source package version $sourcePackageVersion." }
if ($baseProduct.commit -and $baseProduct.commit -ne $sourceCommit) { throw "Packaged product commit $($baseProduct.commit) does not match source commit $sourceCommit." }
if ($provenance.base.productSha256 -ne $actualProductSha256) { throw 'Base product.json SHA-256 does not match provenance.' }
if ($provenance.base.executableSha256 -ne $actualExecutableSha256) { throw 'Base executable SHA-256 does not match provenance.' }
if ($provenance.base.packageVersion -ne $basePackageVersion) { throw 'Base package version does not match provenance.' }

if ($RequireClean) {
	if ($sourceDirty) { throw 'A public base requires a clean source worktree.' }
	if ([bool]$provenance.source.dirty) { throw 'A public base cannot have dirty-source provenance.' }
}

[pscustomobject]@{
	BaseCandidateRoot = $baseRoot
	ProvenancePath = $provenancePath
	SourceCommit = $sourceCommit
	SourceDirty = $sourceDirty
	SourcePackageVersion = $sourcePackageVersion
	BasePackageVersion = $basePackageVersion
	BaseProductSha256 = $actualProductSha256
	BaseExecutableSha256 = $actualExecutableSha256
	Status = if ($sourceDirty -or [bool]$provenance.source.dirty) { 'verified-development-base' } else { 'verified-clean-base' }
}
