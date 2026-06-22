<#
.SYNOPSIS
  Register (or remove) the "SAMAGRA-OS" Scheduled Task that brings the deployment up at logon (B-5).

.DESCRIPTION
  Creates a Task Scheduler task that runs scripts/serve-durable.ps1 at the current user's logon, so the
  local stack (:8799 + :8783) and the cloudflared `samagra-os` tunnel come back after a reboot.

  Runs in the USER context with no stored password, so the public URL is up once the owner is logged in
  (NOT at the pre-login lock screen). For 24/7 pre-login uptime, run cloudflared as a Windows service
  instead (separate from the hermes default config) - documented in docs/deploy-tunnel.md sec 8.

  Idempotent: re-registering overwrites (-Force). Remove with:  scripts\install-durable-task.ps1 -Remove
  Does NOT use -ExecutionPolicy Bypass (relies on the machine policy that already runs these local scripts).

.PARAMETER Remove  Unregister the task instead of creating it.
#>
[CmdletBinding()]
param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$TaskName = 'SAMAGRA-OS'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script   = Join-Path $PSScriptRoot 'serve-durable.ps1'

if ($Remove) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[task] removed '$TaskName'" -ForegroundColor Yellow
  } else {
    Write-Host "[task] '$TaskName' not present - nothing to remove" -ForegroundColor DarkGray
  }
  return
}

if (-not (Test-Path $script)) { throw "serve-durable.ps1 not found at $script" }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument ('-NoProfile -WindowStyle Hidden -File "{0}"' -f $script) `
  -WorkingDirectory $RepoRoot
$trigger   = New-ScheduledTaskTrigger -AtLogOn -User ("{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME)
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId ("{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME) -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  -Principal $principal -Force `
  -Description 'Bring up SAMAGRA OS local stack + cloudflared samagra-os tunnel at logon (B-5 durable deploy).' | Out-Null

Write-Host ("[task] registered '{0}' - runs scripts\serve-durable.ps1 at logon of {1}\{2}" -f $TaskName, $env:USERDOMAIN, $env:USERNAME) -ForegroundColor Green
