param([string]$Engine = 'C:\MineCraft\Server')
$ErrorActionPreference = 'Stop'
$AddonRoot = Split-Path -Parent $PSScriptRoot
$ServerRoot = Join-Path $AddonRoot 'dist/bds-runtime'
if (Test-Path -LiteralPath $ServerRoot) { throw 'Server already exists; refusing to overwrite its world.' }
node (Join-Path $PSScriptRoot 'Build.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Demo build failed.' }
New-Item -ItemType Directory -Path $ServerRoot -Force | Out-Null
Get-ChildItem -LiteralPath $Engine -File | Where-Object {
    $_.Name -match '^(bedrock_server\.exe|.*\.dll|.*\.so|profanity_filter\.wlist|packetlimitconfig\.json)$'
} | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $ServerRoot -Force }
foreach ($Directory in @('data', 'definitions')) {
    Copy-Item -LiteralPath (Join-Path $Engine $Directory) -Destination $ServerRoot -Recurse -Force
}
foreach ($Kind in @('behavior_packs', 'resource_packs')) {
    $Destination = Join-Path $ServerRoot $Kind
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $Engine $Kind) -Directory | Where-Object {
        $_.Name -match '^(vanilla(?:_|$)|chemistry(?:_|$)|experimental_|server_)'
    } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force }
    Copy-Item -LiteralPath (Join-Path $AddonRoot "$Kind/ddui_image_demo") -Destination $Destination -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $AddonRoot "../../Addon/BedformCommon/$Kind/bedform_common") -Destination $Destination -Recurse -Force
}
$World = Join-Path $ServerRoot 'worlds/transactional-demo'
New-Item -ItemType Directory -Path $World -Force | Out-Null
node --import tsx (Join-Path $PSScriptRoot 'EnableBeta.mjs') (Join-Path $World 'level.dat')
if ($LASTEXITCODE -ne 0) { throw 'Could not enable beta APIs for TextPrimitive.' }
foreach ($Kind in @('behavior', 'resource')) {
    $Demo = Get-Content -Raw -LiteralPath (Join-Path $AddonRoot "${Kind}_packs/ddui_image_demo/manifest.json") | ConvertFrom-Json
    $Common = Get-Content -Raw -LiteralPath (Join-Path $AddonRoot "../BedformCommon/${Kind}_packs/bedform_common/manifest.json") | ConvertFrom-Json
    $References = @(@{pack_id=$Demo.header.uuid;version=$Demo.header.version}, @{pack_id=$Common.header.uuid;version=$Common.header.version})
    ConvertTo-Json -InputObject $References -Depth 5 | Set-Content -LiteralPath (Join-Path $World "world_${Kind}_packs.json") -Encoding utf8
}
$Configuration = Join-Path $ServerRoot 'config/516d6caa-6596-43a5-b9a0-9428918d9c09'
New-Item -ItemType Directory -Path $Configuration -Force | Out-Null
Set-Content -LiteralPath (Join-Path $Configuration 'permissions.json') -Encoding utf8 -Value '{"allowed_modules":["@minecraft/server","@minecraft/server-ui"]}'
$CommonConfiguration = Join-Path $ServerRoot 'config/82d1ef5f-59f2-480f-9f04-2e21987e9105'
New-Item -ItemType Directory -Path $CommonConfiguration -Force | Out-Null
Set-Content -LiteralPath (Join-Path $CommonConfiguration 'permissions.json') -Encoding utf8 -Value '{"allowed_modules":["@minecraft/server"]}'
Set-Content -LiteralPath (Join-Path $ServerRoot 'allowlist.json') -Value '[]'
Set-Content -LiteralPath (Join-Path $ServerRoot 'permissions.json') -Value '[]'
@'
server-name=Transactional DDUI Demo
gamemode=creative
force-gamemode=true
difficulty=peaceful
allow-cheats=true
max-players=4
online-mode=true
allow-list=false
server-port=19133
server-portv6=19134
transport=nethernet
server-udp-ports=19133:19133
enable-lan-visibility=true
view-distance=6
tick-distance=4
player-idle-timeout=0
max-threads=2
level-name=transactional-demo
level-seed=1
level-type=FLAT
default-player-permission-level=member
texturepack-required=true
content-log-file-enabled=true
content-log-console-output-enabled=true
'@ | Set-Content -LiteralPath (Join-Path $ServerRoot 'server.properties') -Encoding ascii
Write-Output "Prepared $ServerRoot"
