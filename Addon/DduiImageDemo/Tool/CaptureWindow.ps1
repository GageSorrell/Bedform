# Captures the Minecraft for Windows client area on request, for Tool/MeasureGlyphs.mjs.
# Reads one output path per line from standard input, saves a 24-bit BMP of the
# window's client area, as it appears on screen, to that path, and answers
# "OK <width> <height>" or "ERR <message>" on one line.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CaptureWin32
{
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; }
    [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr Value);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr Window, out Rect Area);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr Window, ref Point Corner);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr Window);
}
'@
# Per-monitor DPI awareness (v2), so window coordinates are physical pixels.
[CaptureWin32]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
Add-Type -AssemblyName System.Drawing

function Get-GameWindow
{
    $Process = Get-Process -Name 'Minecraft.Windows' -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
    if (!$Process) { throw 'Minecraft is not running.' }
    return $Process.MainWindowHandle
}

while ($null -ne ($Line = [Console]::In.ReadLine()))
{
    $Path = $Line.Trim()
    if (!$Path) { continue }
    try
    {
        $Window = Get-GameWindow
        if ([CaptureWin32]::IsIconic($Window)) { throw 'The Minecraft window is minimized.' }
        $Area = New-Object CaptureWin32+Rect
        [CaptureWin32]::GetClientRect($Window, [ref]$Area) | Out-Null
        $Corner = New-Object CaptureWin32+Point
        [CaptureWin32]::ClientToScreen($Window, [ref]$Corner) | Out-Null
        $Width = $Area.Right - $Area.Left
        $Height = $Area.Bottom - $Area.Top
        if ($Width -le 0 -or $Height -le 0) { throw 'The Minecraft window has no client area.' }
        $Image = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        $Graphics = [System.Drawing.Graphics]::FromImage($Image)
        try
        {
            $Graphics.CopyFromScreen($Corner.X, $Corner.Y, 0, 0, (New-Object System.Drawing.Size $Width, $Height))
            $Image.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
        }
        finally
        {
            $Graphics.Dispose()
            $Image.Dispose()
        }
        [Console]::Out.WriteLine("OK $Width $Height")
    }
    catch
    {
        [Console]::Out.WriteLine("ERR $($_.Exception.Message -replace '\s+', ' ')")
    }
    [Console]::Out.Flush()
}
