<#
.SYNOPSIS
  SAMAGRA OS local bring-up (ralph ship-loop B-1) - the stack the Cloudflare tunnel points at.

.DESCRIPTION
  Brings up the local stack on this machine:
    * builds the frontend (Vite -> frontend/dist) unless -SkipBuild,
    * starts the same-origin FastAPI server on :8799 (serves dist + /api), and
    * starts the QX question sidecar on :8783 (the Questions app depends on it).
  Idempotent: a server already answering its health check is REUSED, not restarted.
  -Restart forces a clean relaunch, clearing any stale listener first (the orphaned-
  uvicorn gotcha). Health checks tolerate cold-start latency (catalog / BGE index load).

  NO SECRETS: live capture creds come from .env / mcd-cloud.json (both gitignored).
  This script never reads or prints them - it only reports whether they EXIST so the
  operator knows the capture apps will show live data vs graceful empty states.

  Only :8799 is meant to be tunnelled; keep :8783 (QX) internal - SAMAGRA reaches it
  via the same-origin /api/questions proxy.

  NOTE: ASCII-only on purpose - Windows PowerShell 5.1 reads BOM-less .ps1 as ANSI.

.PARAMETER SkipBuild  Reuse the existing frontend/dist instead of rebuilding.
.PARAMETER Restart    Kill existing :8799 / :8783 listeners and relaunch fresh.
.PARAMETER ApiPort    FastAPI port (default 8799; override only for isolated testing).
.PARAMETER QxPort     QX sidecar port (default 8783).
.PARAMETER QxRoot     QX sidecar repo root (default C:\SandBox\gpt_box\gpt-extract-ques).
.PARAMETER NoQx       Skip the QX sidecar (Questions degrades gracefully without it).

.EXAMPLE  powershell -File scripts/serve-local.ps1
.EXAMPLE  powershell -File scripts/serve-local.ps1 -Restart
.EXAMPLE  powershell -File scripts/serve-local.ps1 -SkipBuild
#>
[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [switch]$Restart,
  [int]$ApiPort = 8799,
  [int]$QxPort  = 8783,
  [string]$QxRoot = 'C:\SandBox\gpt_box\gpt-extract-ques',
  [switch]$NoQx
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$LogDir   = Join-Path $RepoRoot '.serve-logs'   # gitignored, transient
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Get-PortPid([int]$Port) {
  try { (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -First 1).OwningProcess }
  catch { $null }
}
function Test-Url([string]$Url) {
  try { (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 4).StatusCode -eq 200 }
  catch { $false }
}
function Wait-Url([string]$Url, [int]$TimeoutSec = 45) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-Url $Url) { return $true }
    Start-Sleep -Milliseconds 700
  }
  return $false
}
function Stop-Port([int]$Port) {
  $procId = Get-PortPid $Port
  if ($procId) {
    Write-Host ("  clearing :{0} (pid {1})" -f $Port, $procId) -ForegroundColor Yellow
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 600
  }
}

$py = Join-Path $RepoRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $py)) { throw "venv python not found at $py - create the .venv first (python -m venv .venv; pip install -e .)." }

Write-Host "SAMAGRA OS local bring-up" -ForegroundColor Cyan
Write-Host ("  repo : {0}" -f $RepoRoot)
Write-Host ("  ports: api :{0}  qx :{1}" -f $ApiPort, $QxPort)

# --- 1. frontend build -------------------------------------------------------
$dist = Join-Path $RepoRoot 'frontend\dist\index.html'
if ($SkipBuild) {
  if (-not (Test-Path $dist)) { throw "-SkipBuild but frontend/dist is missing - run once without -SkipBuild." }
  Write-Host "[build] skipped (reusing frontend/dist)" -ForegroundColor DarkGray
} else {
  Write-Host "[build] npm run build ..." -ForegroundColor Cyan
  Push-Location (Join-Path $RepoRoot 'frontend')
  try {
    if (-not (Test-Path 'node_modules')) { & npm install; if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)" } }
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "frontend build failed (exit $LASTEXITCODE)" }
  } finally { Pop-Location }
  if (-not (Test-Path $dist)) { throw "build finished but $dist is missing" }
  Write-Host "[build] dist ready" -ForegroundColor Green
}

# --- 2. FastAPI :ApiPort (serves dist + /api, same-origin) -------------------
$apiHealth = "http://127.0.0.1:$ApiPort/api/overview"
if ($Restart) { Stop-Port $ApiPort }
if ((-not $Restart) -and (Test-Url $apiHealth)) {
  Write-Host ("[api ] already healthy on :{0} - reusing" -f $ApiPort) -ForegroundColor Green
} else {
  if (Get-PortPid $ApiPort) { Write-Host ("[api ] :{0} in use but unhealthy - clearing" -f $ApiPort) -ForegroundColor Yellow; Stop-Port $ApiPort }
  Write-Host ("[api ] starting uvicorn on :{0} ..." -f $ApiPort) -ForegroundColor Cyan
  $env:PYTHONPATH = $RepoRoot
  $apiArgs = @('-m','uvicorn','samagra.api.app:app','--host','127.0.0.1','--port',"$ApiPort")
  Start-Process -FilePath $py -ArgumentList $apiArgs -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput (Join-Path $LogDir 'api.out.log') `
    -RedirectStandardError  (Join-Path $LogDir 'api.err.log') -WindowStyle Hidden | Out-Null
  if (Wait-Url $apiHealth 45) { Write-Host ("[api ] healthy on :{0}" -f $ApiPort) -ForegroundColor Green }
  else { throw ("[api ] did NOT become healthy on :{0} within 45s - see {1}" -f $ApiPort, (Join-Path $LogDir 'api.err.log')) }
}

# --- 3. QX sidecar :QxPort (internal; Questions proxies it) ------------------
$qxHealth = "http://127.0.0.1:$QxPort/api/qsearch?q=ping&mode=exact"
if ($NoQx) {
  Write-Host "[qx  ] skipped (-NoQx) - Questions degrades gracefully" -ForegroundColor DarkGray
} else {
  if ($Restart) { Stop-Port $QxPort }
  if ((-not $Restart) -and (Get-PortPid $QxPort)) {
    Write-Host ("[qx  ] already listening on :{0} - reusing" -f $QxPort) -ForegroundColor Green
  } elseif (-not (Test-Path (Join-Path $QxRoot 'gui\qx_browser.py'))) {
    Write-Host ("[qx  ] QX repo not found at {0} - Questions will degrade gracefully" -f $QxRoot) -ForegroundColor Yellow
  } else {
    Write-Host ("[qx  ] starting QX sidecar on :{0} ..." -f $QxPort) -ForegroundColor Cyan
    Start-Process -FilePath 'python' -ArgumentList @('-X','utf8','gui/qx_browser.py') -WorkingDirectory $QxRoot `
      -RedirectStandardOutput (Join-Path $LogDir 'qx.out.log') `
      -RedirectStandardError  (Join-Path $LogDir 'qx.err.log') -WindowStyle Hidden | Out-Null
    if (Wait-Url $qxHealth 60) { Write-Host ("[qx  ] healthy on :{0}" -f $QxPort) -ForegroundColor Green }
    else { Write-Host ("[qx  ] not answering /api/qsearch on :{0} yet (BGE index may still be loading; Questions degrades gracefully)" -f $QxPort) -ForegroundColor Yellow }
  }
}

# --- 4. summary --------------------------------------------------------------
$apiState = if (Test-Url $apiHealth) { 'HEALTHY' } else { 'DOWN' }
$qxState  = if (Test-Url $qxHealth) { 'HEALTHY' } elseif (Get-PortPid $QxPort) { 'LISTENING' } else { 'DOWN' }
$envState = if (Test-Path (Join-Path $RepoRoot '.env')) { 'present' } else { 'absent' }
$mcdState = if (Test-Path (Join-Path $RepoRoot 'mcd-cloud.json')) { 'present' } else { 'absent' }
Write-Host ""
Write-Host "-- bring-up summary -----------------------------" -ForegroundColor Cyan
Write-Host ("  FastAPI  :{0,-5} {1}" -f $ApiPort, $apiState)
Write-Host ("  QX       :{0,-5} {1}" -f $QxPort,  $qxState)
Write-Host ("  creds    .env={0}  mcd-cloud.json={1}  (presence only; capture apps show graceful empties if absent)" -f $envState, $mcdState)
Write-Host ("  open     http://127.0.0.1:{0}/" -f $ApiPort)
Write-Host "-------------------------------------------------" -ForegroundColor Cyan

if (-not (Test-Url $apiHealth)) { exit 1 }
exit 0
