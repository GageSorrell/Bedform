# Repository test firewall approval

From the repository root on Windows, run:

```powershell
npm run firewall:configure
```

Accept the one Windows administrator prompt. This installs persistent inbound allow rules for the fixed BedformCanvas test executable at `Addon/BedformCanvas/dist/bds-runtime/bedrock_server.exe`, and the Bedform and `@bedform/effect` runtime runners at `Package/Bedform/dist/bds-runtime/bedrock_server.exe` and `Package/Effect/dist/bds-runtime/bedrock_server.exe`, on all network profiles. Rules can be installed before those files exist. Setup disables existing inbound block rules for these exact paths because blocks override allows. It leaves other applications, global firewall notifications and UAC settings unchanged. Test runners never request elevation themselves.

All registered runners use a fixed executable path on Windows, a lock to prevent simultaneous use of their runtime, and separate test worlds. Test configuration still disables player joining. Rebuilding packs, updating the engine, or deleting generated output does not invalidate the firewall approval. Moving the repository requires running setup again. New runners should use stable executable paths and extend this setup script before launching a server.

The ignored `dist/test-firewall-setup.json` receipt records the installed rule names and any disabled block rules. Re-running setup is safe. To undo, in Administrator PowerShell at the repository root:

```powershell
$receipt = Get-Content .\dist\test-firewall-setup.json -Raw | ConvertFrom-Json
$receipt.rules | ForEach-Object { Remove-NetFirewallRule -Name $_.rule }
$receipt.disabledBlockRules | ForEach-Object { Enable-NetFirewallRule -Name $_ }
```

Microsoft documents [program-specific firewall rules](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule) and [block rule precedence](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules).

Demonstrations created by [Script/Deprecated/Demonstration](Deprecated/Demonstration/README.md) register their stable executable paths in ignored `dist/demonstration-servers.json`. The same explicit firewall setup command includes registered demonstrations whose executables exist. Creation and launch never elevate.
