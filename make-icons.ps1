Add-Type -AssemblyName System.Drawing

function Make-Icon {
    param($size, $path)
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # Dark indigo background circle
    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,30,27,75))
    $g.FillEllipse($bg, 0, 0, $size-1, $size-1)

    # Outer ring (accent purple)
    $lineW = [int][Math]::Max(2, $size/14)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200,99,102,241), $lineW)
    $pad = [int]($size * 0.1)
    $g.DrawEllipse($pen, $pad, $pad, $size-$pad*2-1, $size-$pad*2-1)

    # Inner filled circle
    $dot = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,99,102,241))
    $dotSize = [int]($size * 0.28)
    $dotPad = [int](($size - $dotSize) / 2)
    $g.FillEllipse($dot, $dotPad, $dotPad, $dotSize, $dotSize)

    # Center bright dot
    $center = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,220,220,255))
    $cSize = [int]($size * 0.12)
    $cPad = [int](($size - $cSize) / 2)
    $g.FillEllipse($center, $cPad, $cPad, $cSize, $cSize)

    # Crosshair lines (light purple)
    $lw2 = [int][Math]::Max(1, $size/28)
    $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180,165,180,252), $lw2)
    $c = [int]($size/2)
    $r1 = [int]($size*0.06)
    $r2 = [int]($size*0.38)
    # top
    $g.DrawLine($linePen, $c, $r1, $c, [int]($size*0.36))
    # bottom
    $g.DrawLine($linePen, $c, [int]($size*0.64), $c, $size-$r1-1)
    # left
    $g.DrawLine($linePen, $r1, $c, [int]($size*0.36), $c)
    # right
    $g.DrawLine($linePen, [int]($size*0.64), $c, $size-$r1-1, $c)

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created $path ($size x $size)"
}

Make-Icon 16  "d:\Dev Project\EXTENTION\NEW\icons\icon16.png"
Make-Icon 32  "d:\Dev Project\EXTENTION\NEW\icons\icon32.png"
Make-Icon 48  "d:\Dev Project\EXTENTION\NEW\icons\icon48.png"
Make-Icon 128 "d:\Dev Project\EXTENTION\NEW\icons\icon128.png"

Write-Host "All icons generated!"
