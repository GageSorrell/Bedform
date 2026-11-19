$ErrorActionPreference = 'Stop'
$ServerRoot = Join-Path $PSScriptRoot 'dist/bds-runtime'
if (!(Test-Path -LiteralPath (Join-Path $ServerRoot 'bedrock_server.exe'))) { throw 'Run prepare:server first.' }
$HostPid = Join-Path $ServerRoot 'host.pid'
if (Test-Path -LiteralPath $HostPid) {
    $Existing = Get-Process -Id ([int](Get-Content -LiteralPath $HostPid)) -ErrorAction SilentlyContinue
    if ($Existing) { throw 'The server host is already running.' }
}
$Node = (Get-Command node).Source
$HostScript = Join-Path $PSScriptRoot 'Tool/Host.mjs'
Start-Process -FilePath $Node -ArgumentList @('"' + $HostScript + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
$Port = (Get-Content -LiteralPath (Join-Path $ServerRoot 'server.properties') | Where-Object { $_ -match '^server-port=' }) -replace '^server-port=', ''
Write-Output "Starting Transactional DDUI Demo on port $Port. Console: $ServerRoot/console.log"
