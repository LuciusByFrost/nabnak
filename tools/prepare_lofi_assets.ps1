param(
  [Parameter(Mandatory=$true)][string]$CafeSource,
  [Parameter(Mandatory=$true)][string]$MidnightSource
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets/themes'
New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
foreach ($scene in @(@{Name='lofi-cafe';Source=$CafeSource}, @{Name='lofi-midnight';Source=$MidnightSource})) {
  $originalImage = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $scene.Source).Path)
  try {
    foreach ($variant in @(@{Suffix='';Width=1200;Height=800;Quality=90L}, @{Suffix='-sidebar';Width=480;Height=320;Quality=86L})) {
      $destination = Join-Path $assetDirectory ($scene.Name + $variant.Suffix + '.jpg')
      if (Test-Path -LiteralPath $destination) { throw "Asset already exists; refusing to overwrite: $destination" }
      $bitmap = [System.Drawing.Bitmap]::new($variant.Width, $variant.Height)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $encoderParameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
      try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($originalImage, 0, 0, $variant.Width, $variant.Height)
        $encoderParameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]$variant.Quality)
        $bitmap.Save($destination, $jpegCodec, $encoderParameters)
      } finally { $encoderParameters.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
    }
  } finally { $originalImage.Dispose() }
}
Get-ChildItem -LiteralPath $assetDirectory -File | Select-Object Name,Length
