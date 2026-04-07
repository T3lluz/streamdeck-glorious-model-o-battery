# Generates 72px and 144px PNG key art for the Stream Deck plugin (System.Drawing).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outDir = Join-Path $root "com.t3lluz.modelobattery.sdPlugin\imgs\actions\battery"
$pluginDir = Join-Path $root "com.t3lluz.modelobattery.sdPlugin\imgs\plugin"
New-Item -ItemType Directory -Force -Path $outDir, $pluginDir | Out-Null

function Draw-Key {
    param(
        [int]$Size,
        [string]$Path,
        [bool]$Charging
    )
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(255, 24, 26, 32))

    $mint = [System.Drawing.Color]::FromArgb(255, 0, 214, 170)
    $dim = [System.Drawing.Color]::FromArgb(255, 55, 58, 68)
    $gold = [System.Drawing.Color]::FromArgb(255, 255, 204, 102)

    # Soft vignette
    $vBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Rectangle 0, 0, $Size, $Size),
        [System.Drawing.Color]::FromArgb(60, 0, 214, 170),
        [System.Drawing.Color]::FromArgb(0, 24, 26, 32),
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )
    $g.FillRectangle($vBrush, 0, 0, $Size, $Size)
    $vBrush.Dispose()

    $scale = $Size / 144.0
    $bx = [int](28 * $scale)
    $by = [int](38 * $scale)
    $bw = [int](72 * $scale)
    $bh = [int](68 * $scale)
    $tipW = [int](8 * $scale)
    $penBody = New-Object System.Drawing.Pen $dim, ([Math]::Max(1, [int](3 * $scale)))
    $g.DrawRectangle($penBody, $bx, $by, $bw, $bh)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush $dim), ($bx + $bw), ($by + [int](22 * $scale)), $tipW, [int](24 * $scale))

    $fillW = [Math]::Max([int](8 * $scale), [int](($bw - 8 * $scale) * 0.62))
    $fillBrush = New-Object System.Drawing.SolidBrush $mint
    $g.FillRectangle($fillBrush, ($bx + [int](4 * $scale)), ($by + [int](4 * $scale)), $fillW, ($bh - [int](8 * $scale)))
    $fillBrush.Dispose()
    $penBody.Dispose()

    if ($Charging) {
        $boltPen = New-Object System.Drawing.Pen $gold, ([Math]::Max(2, [int](4 * $scale)))
        $boltPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $boltPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $cx = [int]($Size * 0.72)
        $cy = [int]($Size * 0.28)
        $g.DrawLine($boltPen, $cx, ($cy - [int](14 * $scale)), ($cx - [int](6 * $scale)), $cy)
        $g.DrawLine($boltPen, ($cx - [int](6 * $scale)), $cy, ($cx + [int](8 * $scale)), $cy)
        $g.DrawLine($boltPen, ($cx + [int](8 * $scale)), $cy, ($cx - [int](2 * $scale)), ($cy + [int](18 * $scale)))
        $boltPen.Dispose()

        $glow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 255, 204, 102)), ([int](10 * $scale))
        $g.DrawEllipse($glow, ($cx - [int](18 * $scale)), ($cy - [int](22 * $scale)), [int](36 * $scale), [int](36 * $scale))
        $glow.Dispose()
    }

    $g.Dispose()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function Draw-SquareIcon {
    param([int]$Size, [string]$Path)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(255, 24, 26, 32))
    $mint = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 214, 170))
    $pad = [int]($Size * 0.18)
    $g.FillEllipse($mint, $pad, $pad, ($Size - 2 * $pad), ($Size - 2 * $pad))
    $mint.Dispose()
    $g.Dispose()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

foreach ($charging in @($false, $true)) {
    $suffix = if ($charging) { "charging" } else { "idle" }
    Draw-Key -Size 72 -Path (Join-Path $outDir "key-$suffix.png") -Charging $charging
    Draw-Key -Size 144 -Path (Join-Path $outDir "key-$suffix@2x.png") -Charging $charging
}

Draw-SquareIcon -Size 40 -Path (Join-Path $outDir "icon.png")
Draw-SquareIcon -Size 80 -Path (Join-Path $outDir "icon@2x.png")
Draw-SquareIcon -Size 28 -Path (Join-Path $pluginDir "category.png")
Draw-SquareIcon -Size 56 -Path (Join-Path $pluginDir "category@2x.png")
Draw-SquareIcon -Size 288 -Path (Join-Path $pluginDir "marketplace.png")
Draw-SquareIcon -Size 576 -Path (Join-Path $pluginDir "marketplace@2x.png")

Write-Host "Icons written to $outDir and $pluginDir"
