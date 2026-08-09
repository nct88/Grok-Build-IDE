#Requires -Version 5.1
[CmdletBinding()]
param(
	[string]$SourceMaster
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $SourceMaster) {
	$SourceMaster = Join-Path $repoRoot 'logo\fluffy-grok-master.png'
}
if (-not (Test-Path -LiteralPath $SourceMaster)) {
	throw "Missing Grok Build IDE Fluffy master: $SourceMaster"
}
$SourceMaster = (Resolve-Path -LiteralPath $SourceMaster).Path

Add-Type -AssemblyName System.Drawing

function New-SizedBitmap {
	param(
		[System.Drawing.Bitmap]$Source,
		[int]$Size
	)
	$target = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$graphics = [System.Drawing.Graphics]::FromImage($target)
	try {
		$graphics.Clear([System.Drawing.Color]::Transparent)
		$graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
		$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
		$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
		$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
		$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
		$graphics.DrawImage($Source, 0, 0, $Size, $Size)
	} finally {
		$graphics.Dispose()
	}
	return $target
}

function Get-BmpIconPayload {
	param([System.Drawing.Bitmap]$Source)
	$width = $Source.Width
	$height = $Source.Height
	$rect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
	$data = $Source.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	try {
		$buffer = New-Object byte[] ([Math]::Abs($data.Stride) * $height)
		[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buffer, 0, $buffer.Length)
		$xor = New-Object byte[] ($width * $height * 4)
		$cursor = 0
		for ($y = $height - 1; $y -ge 0; $y--) {
			$row = $y * $data.Stride
			for ($x = 0; $x -lt $width; $x++) {
				$offset = $row + ($x * 4)
				$xor[$cursor++] = $buffer[$offset]
				$xor[$cursor++] = $buffer[$offset + 1]
				$xor[$cursor++] = $buffer[$offset + 2]
				$xor[$cursor++] = $buffer[$offset + 3]
			}
		}
	} finally {
		$Source.UnlockBits($data)
	}

	$maskRowBytes = [int][Math]::Ceiling($width / 32.0) * 4
	$andMask = New-Object byte[] ($maskRowBytes * $height)
	$memory = New-Object System.IO.MemoryStream
	$writer = New-Object System.IO.BinaryWriter $memory
	try {
		$writer.Write([int]40)
		$writer.Write([int]$width)
		$writer.Write([int]($height * 2))
		$writer.Write([int16]1)
		$writer.Write([int16]32)
		$writer.Write([int]0)
		$writer.Write([int]$xor.Length)
		$writer.Write([int]0)
		$writer.Write([int]0)
		$writer.Write([int]0)
		$writer.Write([int]0)
		$writer.Write($xor)
		$writer.Write($andMask)
		$writer.Flush()
		return , $memory.ToArray()
	} finally {
		$writer.Dispose()
		$memory.Dispose()
	}
}

function Write-ClassicIcon {
	param(
		[string]$Path,
		[System.Drawing.Bitmap[]]$Images
	)
	$payloads = @($Images | ForEach-Object { Get-BmpIconPayload $_ })
	$offset = 6 + (16 * $payloads.Count)
	$stream = [System.IO.File]::Create($Path)
	$writer = New-Object System.IO.BinaryWriter $stream
	try {
		$writer.Write([uint16]0)
		$writer.Write([uint16]1)
		$writer.Write([uint16]$payloads.Count)
		for ($index = 0; $index -lt $payloads.Count; $index++) {
			$size = $Images[$index].Width
			$dimension = if ($size -ge 256) { [byte]0 } else { [byte]$size }
			$writer.Write($dimension)
			$writer.Write($dimension)
			$writer.Write([byte]0)
			$writer.Write([byte]0)
			$writer.Write([uint16]1)
			$writer.Write([uint16]32)
			$writer.Write([uint32]$payloads[$index].Length)
			$writer.Write([uint32]$offset)
			$offset += $payloads[$index].Length
		}
		foreach ($payload in $payloads) {
			$writer.Write($payload)
		}
		$writer.Flush()
	} finally {
		$writer.Dispose()
		$stream.Dispose()
	}
}

function Write-BigEndianUInt32 {
	param(
		[System.IO.Stream]$Stream,
		[uint32]$Value
	)
	$bytes = [BitConverter]::GetBytes($Value)
	[Array]::Reverse($bytes)
	$Stream.Write($bytes, 0, 4)
}

function Get-PngBytes {
	param([System.Drawing.Bitmap]$Bitmap)
	$memory = New-Object System.IO.MemoryStream
	try {
		$Bitmap.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
		return , $memory.ToArray()
	} finally {
		$memory.Dispose()
	}
}

function Write-Icns {
	param(
		[string]$Path,
		[hashtable]$Images
	)
	$chunks = @(
		@{ Type = 'icp4'; Data = Get-PngBytes $Images[16] },
		@{ Type = 'icp5'; Data = Get-PngBytes $Images[32] },
		@{ Type = 'icp6'; Data = Get-PngBytes $Images[64] },
		@{ Type = 'ic07'; Data = Get-PngBytes $Images[128] },
		@{ Type = 'ic08'; Data = Get-PngBytes $Images[256] },
		@{ Type = 'ic09'; Data = Get-PngBytes $Images[512] },
		@{ Type = 'ic10'; Data = Get-PngBytes $Images[1024] }
	)
	$totalLength = 8
	foreach ($chunk in $chunks) { $totalLength += 8 + $chunk.Data.Length }
	$stream = [System.IO.File]::Create($Path)
	try {
		$magic = [Text.Encoding]::ASCII.GetBytes('icns')
		$stream.Write($magic, 0, $magic.Length)
		Write-BigEndianUInt32 $stream ([uint32]$totalLength)
		foreach ($chunk in $chunks) {
			$type = [Text.Encoding]::ASCII.GetBytes($chunk.Type)
			$stream.Write($type, 0, $type.Length)
			Write-BigEndianUInt32 $stream ([uint32](8 + $chunk.Data.Length))
			$stream.Write($chunk.Data, 0, $chunk.Data.Length)
		}
	} finally {
		$stream.Dispose()
	}
}

function Write-InstallerBitmap {
	param(
		[string]$Path,
		[int]$Width,
		[int]$Height,
		[System.Drawing.Bitmap]$Master
	)
	$canvas = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
	$graphics = [System.Drawing.Graphics]::FromImage($canvas)
	try {
		$graphics.Clear([System.Drawing.Color]::FromArgb(104, 104, 104))
		$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
		$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
		$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
		$size = [Math]::Min([int]($Width * 0.82), [int]($Height * 0.46))
		$x = [int](($Width - $size) / 2)
		$y = if ($Height -gt ($Width * 1.5)) { [int]($Height * 0.16) } else { [int](($Height - $size) / 2) }
		$graphics.DrawImage($Master, $x, $y, $size, $size)
	} finally {
		$graphics.Dispose()
	}
	$canvas.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
	$canvas.Dispose()
}

$processed = Join-Path $repoRoot 'logo\processed'
New-Item -ItemType Directory -Force -Path $processed | Out-Null

$master = [System.Drawing.Bitmap]::FromFile($SourceMaster)
if ($master.PixelFormat -ne [System.Drawing.Imaging.PixelFormat]::Format32bppArgb) {
	throw "Source master must be 32-bit ARGB; found $($master.PixelFormat)."
}

$masterPath = Join-Path $processed 'app-icon-master.png'
Copy-Item -LiteralPath $SourceMaster -Destination $masterPath -Force

$sizes = @(16, 20, 24, 32, 40, 48, 64, 70, 128, 150, 256, 512, 1024)
$images = @{}
foreach ($size in $sizes) {
	$image = New-SizedBitmap $master $size
	$images[$size] = $image
	if ($size -in @(16, 20, 24, 32, 40, 48, 64, 128, 256, 512)) {
		$image.Save((Join-Path $processed "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
	}
}

$icoImages = @(16, 20, 24, 32, 40, 48, 64, 128, 256) | ForEach-Object { $images[$_] }
$windowsIcon = Join-Path $repoRoot 'resources\win32\code.ico'
Write-ClassicIcon $windowsIcon $icoImages
Copy-Item -LiteralPath $windowsIcon -Destination (Join-Path $repoRoot 'resources\server\favicon.ico') -Force
$images[70].Save((Join-Path $repoRoot 'resources\win32\code_70x70.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$images[150].Save((Join-Path $repoRoot 'resources\win32\code_150x150.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$images[1024].Save((Join-Path $repoRoot 'resources\linux\code.png'), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Icns (Join-Path $repoRoot 'resources\darwin\code.icns') $images

$extensionLogoDirectory = Join-Path $repoRoot 'extensions\grok-build-workbench\logo'
New-Item -ItemType Directory -Force -Path $extensionLogoDirectory | Out-Null
$images[128].Save((Join-Path $extensionLogoDirectory 'grok-fluffy.png'), [System.Drawing.Imaging.ImageFormat]::Png)

$svgPng = [Convert]::ToBase64String((Get-PngBytes $images[256]))
$svg = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="title">
  <title id="title">Grok Build IDE</title>
  <image width="256" height="256" href="data:image/png;base64,$svgPng" />
</svg>
"@
[System.IO.File]::WriteAllText((Join-Path $repoRoot 'resources\grok-workbench-logo.svg'), $svg, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $extensionLogoDirectory 'grok.svg'), $svg, (New-Object System.Text.UTF8Encoding($false)))

Get-ChildItem (Join-Path $repoRoot 'resources\win32') -Filter 'inno-*.bmp' | ForEach-Object {
	$existing = [System.Drawing.Image]::FromFile($_.FullName)
	$width = $existing.Width
	$height = $existing.Height
	$existing.Dispose()
	Write-InstallerBitmap $_.FullName $width $height $master
}

$opaqueSamples = 0
$whiteSamples = 0
$blackSamples = 0
for ($y = 0; $y -lt $master.Height; $y += 4) {
	for ($x = 0; $x -lt $master.Width; $x += 4) {
		$pixel = $master.GetPixel($x, $y)
		if ($pixel.A -gt 200) {
			$opaqueSamples++
			if ($pixel.R -gt 225 -and $pixel.G -gt 225 -and $pixel.B -gt 225) { $whiteSamples++ }
			if ($pixel.R -lt 30 -and $pixel.G -lt 30 -and $pixel.B -lt 30) { $blackSamples++ }
		}
	}
}
if ($opaqueSamples -eq 0 -or $whiteSamples -lt 100 -or $blackSamples -lt 100) {
	throw "Brand color validation failed: opaque=$opaqueSamples white=$whiteSamples black=$blackSamples"
}
if ($master.GetPixel(0, 0).A -ne 0 -or $master.GetPixel($master.Width - 1, $master.Height - 1).A -ne 0) {
	throw 'Brand alpha validation failed: master corners must remain transparent.'
}

foreach ($image in $images.Values) { $image.Dispose() }
$master.Dispose()

Write-Host "Generated split white/black Fluffy assets with inverse Grok lettering from $SourceMaster"
Write-Host "Updated Windows ICO/tile art, macOS ICNS, Linux PNG, server favicon, installer art, extension logo, and root SVG."
