[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$receiptPath = Join-Path $repoRoot 'dist/test-firewall-setup.json'
New-Item -ItemType Directory -Path (Split-Path -Parent $receiptPath) -Force | Out-Null
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    # This explicit setup command needs one Windows approval. Test commands never elevate.
    try {
        $process = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
            -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"") `
            -Verb RunAs -WindowStyle Hidden -Wait -PassThru
        if ($process.ExitCode -ne 0) { throw "Firewall setup failed (exit $($process.ExitCode)); see $receiptPath" }
        Get-Content -LiteralPath $receiptPath
        exit 0
    } catch {
        Write-Error "Windows administrator approval is required to install the firewall rules. $($_.Exception.Message)"
        exit 1
    }
}

$configured = @()
$disabledBlocks = @()
if (Test-Path -LiteralPath $receiptPath) {
    $previousReceipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
    $disabledBlocks = @($previousReceipt.disabledBlockRules | Where-Object { $_ })
}
try {
    $targets = @()
    foreach ($addon in @('BedformCanvas', 'Bedform', 'Effect')) {
        # Rules may be installed before the first test prepares its engine copy.
        $relativeRoot = if ($addon -in @('Bedform', 'Effect')) { 'Package' } else { 'Addon' }
        $executable = Join-Path $repoRoot "$relativeRoot\$addon\dist\bds-runtime\bedrock_server.exe"
        $targets += @{ name = $addon; executable = $executable }
    }
    $demoRegistry = Join-Path $repoRoot 'dist/demonstration-servers.json'
    if (Test-Path -LiteralPath $demoRegistry) {
        foreach ($executable in (Get-Content -LiteralPath $demoRegistry -Raw | ConvertFrom-Json)) {
            if (Test-Path -LiteralPath $executable -PathType Leaf) {
                $targets += @{ name = 'Demonstration'; executable = [IO.Path]::GetFullPath($executable) }
            }
        }
    }
    foreach ($target in $targets) {
        $addon = $target.name
        $executable = $target.executable
        $hash = [Security.Cryptography.SHA256]::Create()
        try {
            $digest = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($executable.ToLowerInvariant()))).Replace('-', '').Substring(0, 12)
        } finally { $hash.Dispose() }
        $ruleName = "Bedform-Tests-Allow-$digest"
        $existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
        if ($existing) {
            $application = $existing | Get-NetFirewallApplicationFilter
            if ($application.Program -ine $executable) { throw "Rule $ruleName belongs to another executable." }
            $existing | Set-NetFirewallRule -Direction Inbound -Action Allow -Enabled True -Profile Any -Protocol Any | Out-Null
        } else {
            New-NetFirewallRule -Name $ruleName -DisplayName "Bedform repository tests - $addon" `
                -Group 'Bedform repository tests' -Description 'Persistent approval for the fixed test server executable.' `
                -Direction Inbound -Action Allow -Enabled True -Profile Any -Protocol Any -Program $executable | Out-Null
        }
        # A previous Cancel/Deny or the legacy IC2 setup can leave block rules,
        # which take precedence over allow rules. Preserve them, but disable them.
        $blocks = @(Get-NetFirewallApplicationFilter -Program $executable -ErrorAction SilentlyContinue |
            Get-NetFirewallRule | Where-Object { $_.Direction -eq 'Inbound' -and $_.Action -eq 'Block' -and $_.Enabled -eq 'True' })
        foreach ($block in $blocks) {
            if ($block.Name -notin $disabledBlocks) { $disabledBlocks += $block.Name }
            $block | Disable-NetFirewallRule | Out-Null
        }
        $rule = Get-NetFirewallRule -Name $ruleName
        if ($rule.Enabled -ne 'True' -or $rule.Action -ne 'Allow' -or $rule.Profile -ne 'Any') {
            throw "Rule verification failed: $ruleName"
        }
        $configured += @{ addon = $addon; executable = $executable; rule = $ruleName }
    }
    @{ success = $true; configuredAt = (Get-Date).ToString('o'); rules = $configured; disabledBlockRules = $disabledBlocks } |
        ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $receiptPath -Encoding UTF8
} catch {
    @{ success = $false; error = $_.Exception.Message; rules = $configured; disabledBlockRules = $disabledBlocks } |
        ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $receiptPath -Encoding UTF8
    Write-Error $_.Exception.Message
    exit 1
}
Write-Output "Configured persistent firewall approval for $($configured.Count) repository test servers. Receipt: $receiptPath"
