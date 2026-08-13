param(
	[Parameter(Mandatory = $true)][string[]]$ArtifactPath,
	[Parameter(Mandatory = $true)][ValidatePattern('^[0-9A-Fa-f]{40}$')][string]$CertificateThumbprint,
	[Parameter(Mandatory = $true)][ValidatePattern('^https://')][string]$TimestampUrl,
	[ValidateSet('CurrentUser','LocalMachine')][string]$CertificateStoreLocation = 'CurrentUser',
	[string]$SignToolPath
)

$ErrorActionPreference = 'Stop'
$thumbprint = $CertificateThumbprint.ToUpperInvariant()
$storePath = "Cert:\$CertificateStoreLocation\My\$thumbprint"
$certificate = Get-Item -LiteralPath $storePath -ErrorAction SilentlyContinue
if (-not $certificate) { throw "Code-signing certificate was not found: $storePath" }
if (-not $certificate.HasPrivateKey) { throw 'The selected code-signing certificate has no accessible private key.' }
if ($certificate.NotAfter -le (Get-Date)) { throw "The selected code-signing certificate expired at $($certificate.NotAfter)." }
$codeSigningOid = '1.3.6.1.5.5.7.3.3'
if (-not @($certificate.EnhancedKeyUsageList | Where-Object { $_.ObjectId.Value -eq $codeSigningOid }).Count) {
	throw 'The selected certificate is not valid for code signing.'
}

if (-not $SignToolPath) {
	$kitsRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
	$SignToolPath = Get-ChildItem -LiteralPath $kitsRoot -Filter signtool.exe -File -Recurse -ErrorAction SilentlyContinue |
		Where-Object FullName -Match '\\x64\\signtool\.exe$' |
		Sort-Object FullName -Descending |
		Select-Object -First 1 -ExpandProperty FullName
}
if (-not $SignToolPath -or -not (Test-Path -LiteralPath $SignToolPath -PathType Leaf)) {
	throw 'signtool.exe was not found. Install the Windows SDK or pass -SignToolPath.'
}

$resolvedArtifacts = foreach ($artifact in $ArtifactPath) {
	$resolved = (Resolve-Path -LiteralPath $artifact).Path
	if ([IO.Path]::GetExtension($resolved) -ne '.exe') { throw "Only Windows executable artifacts may be signed: $resolved" }
	$resolved
}
if (-not $resolvedArtifacts.Count) { throw 'At least one artifact is required.' }

foreach ($artifact in $resolvedArtifacts) {
	$arguments = @('sign','/sha1',$thumbprint,'/s','My','/fd','SHA256','/tr',$TimestampUrl,'/td','SHA256','/v')
	if ($CertificateStoreLocation -eq 'LocalMachine') { $arguments += '/sm' }
	$arguments += $artifact
	& $SignToolPath @arguments
	if ($LASTEXITCODE -ne 0) { throw "signtool failed for $artifact with exit code $LASTEXITCODE." }
	$signature = Get-AuthenticodeSignature -LiteralPath $artifact
	if ($signature.Status -ne 'Valid') { throw "Authenticode verification failed for $artifact ($($signature.Status))." }
	if ($signature.SignerCertificate.Thumbprint -ne $thumbprint) { throw "Unexpected signer certificate on $artifact." }
	if (-not $signature.TimeStamperCertificate) { throw "The signature on $artifact has no trusted timestamp." }
	[pscustomobject]@{
		Artifact = $artifact
		Sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifact).Hash
		SignerThumbprint = $signature.SignerCertificate.Thumbprint
		SignerSubject = $signature.SignerCertificate.Subject
		TimestampSubject = $signature.TimeStamperCertificate.Subject
		Status = $signature.Status.ToString()
	}
}
