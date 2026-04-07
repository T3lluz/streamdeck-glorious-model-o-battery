# Download Outfit variable font + OFL license into the .sdPlugin bundle (for fresh clones).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$fontDir = Join-Path $root "com.t3lluz.modelobattery.sdPlugin\fonts"
New-Item -ItemType Directory -Force -Path $fontDir | Out-Null
$base = "https://raw.githubusercontent.com/google/fonts/main/ofl/outfit"
Invoke-WebRequest -Uri "$base/Outfit%5Bwght%5D.ttf" -OutFile (Join-Path $fontDir "Outfit-Variable.ttf") -UseBasicParsing
Invoke-WebRequest -Uri "$base/OFL.txt" -OutFile (Join-Path $fontDir "OFL-Outfit.txt") -UseBasicParsing
Write-Host "Fonts installed to $fontDir"
