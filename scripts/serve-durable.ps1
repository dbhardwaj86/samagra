<#
.SYNOPSIS
  SAMAGRA OS durable bring-up (ralph ship-loop B-5) - local stack + Cloudflare tunnel, idempotent.

.DESCRIPTION
  Brings the full public deployment up and keeps it durable:
    * runs serve-local.ps1 (FastAPI :8799 + QX :8783, idempotent - reuses healthy servers), then
    * starts the cloudflared `samagra-os` tunnel DETACHED (survives this shell) if not already running.

  Designed to be run at logon by the "SAMAGRA-OS" Scheduled Task (scripts/install-durable-task.ps1), and
  safe to run by hand any time. Touches ONLY the samagra tunnel via its own --config - it NEVER touches the
  hermes default ~/.cloudflared/config.yml.

  Reuses the already-built frontend/dist (no npm needed at logon) unless -Rebuild or dist is missing.
  NO SECRETS. ASCII-only on purpose (Windows PowerShell 5.1 reads BOM-less .ps1 as ANSI).

.PARAMETER Rebuild  Force a fresh `npm run build` instead of reusing frontend/dist.

.EXAMPLE  powershell -File scripts/serve-durable.ps1
#>
[CmdletBinding()]
param([switch]$Rebuild)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$LogDir   = Join-Path $RepoRoot '.serve-logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$cfg = Join-Path $RepoRoot 'deploy\cloudflared\config.samagra.yml'

Write-Host "SAMAGRA OS durable bring-up" -ForegroundColor Cyan

# --- 1. local stack (idempotent) -------------------------------------------
# Reuse the built dist unless -Rebuild / dist missing, so the logon task needs no npm on PATH.
$dist       = Join-Path $RepoRoot 'frontend\dist\index.html'
$serveLocal = Join-Path $PSScriptRoot 'serve-local.ps1'
if ($Rebuild -or -not (Test-Path $dist)) { & $serveLocal } else { & $serveLocal -SkipBuild }

# --- 2. cloudflared tunnel (detached; only if not already running this config) ----
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) { $cf = 'C:\Program Files (x86)\cloudflared\cloudflared.exe' }

$running = Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*config.samagra.yml*' }
if ($running) {
  Write-Host ("[tunnel] already running (pid {0}) - reusing" -f $running.ProcessId) -ForegroundColor Green
} else {
  Write-Host "[tunnel] starting cloudflared samagra-os (detached) ..." -ForegroundColor Cyan
  Start-Process -FilePath $cf `
    -ArgumentList @('tunnel','--config', $cfg, 'run','samagra-os') `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput (Join-Path $LogDir 'tunnel.out.log') `
    -RedirectStandardError  (Join-Path $LogDir 'tunnel.err.log') `
    -WindowStyle Hidden | Out-Null
  Write-Host "[tunnel] launched" -ForegroundColor Green
}

Write-Host ""
Write-Host "[durable] stack + tunnel up -> https://samagra.bhautikiplusprashnavali.com (behind Cloudflare Access)" -ForegroundColor Cyan
