# Minimal Stream Deck key placeholder (dynamic artwork is SVG from the plugin).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outDir = Join-Path $root "com.t3lluz.modelobattery.sdPlugin\imgs\actions\battery"
$pluginDir = Join-Path $root "com.t3lluz.modelobattery.sdPlugin\imgs\plugin"
New-Item -ItemType Directory -Force -Path $outDir, $pluginDir | Out-Null
Get-ChildItem $outDir -Filter "key-idle*" -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem $outDir -Filter "key-charging*" -ErrorAction SilentlyContinue | Remove-Item -Force

function Draw-PlaceholderKey {
    param([int]$Size, [string]$Path)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $full = [System.Drawing.Rectangle]::new(0, 0, $Size, $Size)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        $full,
        [System.Drawing.Color]::FromArgb(255, 20, 22, 30),
        [System.Drawing.Color]::FromArgb(255, 10, 11, 16),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $g.FillRectangle($brush, 0, 0, $Size, $Size)
    $brush.Dispose()
    $g.Dispose()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function Draw-SquareIcon {
    param([int]$Size, [string]$Path, [bool]$Bolt)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $full = [System.Drawing.Rectangle]::new(0, 0, $Size, $Size)
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        $full,
        [System.Drawing.Color]::FromArgb(255, 22, 26, 36),
        [System.Drawing.Color]::FromArgb(255, 12, 14, 20),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $g.FillRectangle($bg, 0, 0, $Size, $Size)
    $bg.Dispose()
    if ($Bolt) {
        $gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 200, 80))
        $pts = @(
            [System.Drawing.PointF]::new($Size * 0.55, $Size * 0.22),
            [System.Drawing.PointF]::new($Size * 0.38, $Size * 0.48),
            [System.Drawing.PointF]::new($Size * 0.52, $Size * 0.48),
            [System.Drawing.PointF]::new($Size * 0.32, $Size * 0.78),
            [System.Drawing.PointF]::new($Size * 0.72, $Size * 0.42),
            [System.Drawing.PointF]::new($Size * 0.50, $Size * 0.42),
            [System.Drawing.PointF]::new($Size * 0.68, $Size * 0.22)
        )
        $g.FillPolygon($gold, $pts)
        $gold.Dispose()
    }
    else {
        $dot = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 214, 170))
        $p = [int]($Size * 0.22)
        $g.FillEllipse($dot, $p, $p, ($Size - 2 * $p), ($Size - 2 * $p))
        $dot.Dispose()
    }
    $g.Dispose()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

Draw-PlaceholderKey -Size 72 -Path (Join-Path $outDir "key-default.png")
Draw-PlaceholderKey -Size 144 -Path (Join-Path $outDir "key-default@2x.png")

Draw-SquareIcon -Size 40 -Path (Join-Path $outDir "icon.png") -Bolt $false
Draw-SquareIcon -Size 80 -Path (Join-Path $outDir "icon@2x.png") -Bolt $false
Draw-SquareIcon -Size 28 -Path (Join-Path $pluginDir "category.png") -Bolt $true
Draw-SquareIcon -Size 56 -Path (Join-Path $pluginDir "category@2x.png") -Bolt $true
Draw-SquareIcon -Size 288 -Path (Join-Path $pluginDir "marketplace.png") -Bolt $true
Draw-SquareIcon -Size 576 -Path (Join-Path $pluginDir "marketplace@2x.png") -Bolt $true

Write-Host "Icons written to $outDir and $pluginDir"
