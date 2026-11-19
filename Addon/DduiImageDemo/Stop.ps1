$ErrorActionPreference = 'Stop'
$ServerRoot = Join-Path $PSScriptRoot 'dist/bds-runtime'
$HostPid = Join-Path $ServerRoot 'host.pid'
if (!(Test-Path -LiteralPath $HostPid)) { throw 'The server host is not running.' }
Set-Content -LiteralPath (Join-Path $ServerRoot 'stop.request') -Value 'stop'
Write-Output 'Requested graceful server shutdown and world save.'
