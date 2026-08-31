# Deploy NorthStar to the HostDzire VPS (competition instance).
#
#   .\scripts\deploy-vps.ps1                 # api + web + monitor units
#   .\scripts\deploy-vps.ps1 -Target api     # api only
#   .\scripts\deploy-vps.ps1 -Target web     # web (read-only cockpit) only
#   .\scripts\deploy-vps.ps1 -SkipTests      # skip the pytest gate (emergencies)
#   .\scripts\deploy-vps.ps1 -Force          # deploy api during US market hours
#
# Safety posture:
# - API deploys are gated on the full pytest suite passing locally.
# - API deploys during US market hours (21:30-04:00 Beijing) are refused
#   without -Force: the VPS is the competition account's only driver.
# - Never ships secrets or state: repo .env, apps/web/.env.local and data/
#   are excluded; the VPS keeps its own /opt/northstar/.env and journal.
param(
    [ValidateSet("all", "api", "web")] [string]$Target = "all",
    [switch]$SkipTests,
    [switch]$Force
)
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$VpsHost = "nl-hostdzire-hath"

$DeployApi = $Target -in @("all", "api")
$DeployWeb = $Target -in @("all", "web")

# --- market-hours guard (API restarts kill in-flight passes) -----------------
if ($DeployApi -and -not $Force) {
    $now = Get-Date
    $inMarket = ($now.Hour -ge 21 -and ($now.Hour -gt 21 -or $now.Minute -ge 30)) -or ($now.Hour -lt 4)
    if ($inMarket) {
        throw "US market hours (21:30-04:00 Beijing): API deploy refused. Rerun with -Force if this is an emergency fix."
    }
}

# --- test gate ----------------------------------------------------------------
if ($DeployApi -and -not $SkipTests) {
    Write-Host "== pytest gate ==" -ForegroundColor Cyan
    Push-Location "$RepoRoot\apps\api"
    try {
        uv run pytest -q
        if ($LASTEXITCODE -ne 0) { throw "tests failed - not deploying" }
    } finally { Pop-Location }
}

$sha = (git -C $RepoRoot rev-parse --short HEAD 2>$null); if (-not $sha) { $sha = "nogit" }
$stamp = "$sha $(Get-Date -Format s)"
$tgz = Join-Path $env:TEMP "northstar-deploy.tgz"

# --- package ------------------------------------------------------------------
Write-Host "== packaging ($Target) ==" -ForegroundColor Cyan
$parts = @("scripts/vps")
if ($DeployApi) { $parts += "apps/api" }
if ($DeployWeb) { $parts += "apps/web" }
Push-Location $RepoRoot
try {
    tar -czf $tgz `
        --exclude "apps/api/.venv" --exclude "apps/api/.pytest_cache" `
        --exclude "__pycache__" --exclude "*.pyc" `
        --exclude "apps/web/node_modules" --exclude "apps/web/.next" `
        --exclude "apps/web/.env.local" `
        @parts
    if ($LASTEXITCODE -ne 0) { throw "tar failed" }
} finally { Pop-Location }
Write-Host ("tarball: {0:N1} MB" -f ((Get-Item $tgz).Length / 1MB))

# --- ship + build + restart ----------------------------------------------------
scp $tgz "${VpsHost}:/tmp/northstar-deploy.tgz"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }

# Note: tar-over-tree merges (stale deleted files may linger); acceptable for
# the sprint, uv sync --frozen keeps the venv exact.
$remote = @(
    "set -e",
    "tar -xzf /tmp/northstar-deploy.tgz -C /opt/northstar && rm /tmp/northstar-deploy.tgz",
    "sed -i 's/\r$//' /opt/northstar/scripts/vps/*.sh /opt/northstar/scripts/vps/*.service /opt/northstar/scripts/vps/*.timer",
    "chmod +x /opt/northstar/scripts/vps/monitor.sh /opt/northstar/scripts/vps/install-creds.sh",
    "/opt/northstar/scripts/vps/install-creds.sh",
    "cp /opt/northstar/scripts/vps/northstar*.service /opt/northstar/scripts/vps/northstar-monitor.timer /etc/systemd/system/",
    "systemctl daemon-reload",
    "command -v jq >/dev/null || apt-get install -y -q jq",
    "systemctl enable --now northstar-monitor.timer"
)
if ($DeployApi) {
    $remote += "cd /opt/northstar/apps/api && /root/.local/bin/uv sync --frozen --no-dev >/dev/null"
    $remote += "systemctl restart northstar"
}
if ($DeployWeb) {
    $remote += "cd /opt/northstar/apps/web && npm ci --silent && npm run build >/dev/null"
    $remote += "systemctl restart northstar-web"
}
$remote += "echo '$stamp' > /opt/northstar/DEPLOYED"
Write-Host "== remote build + restart ==" -ForegroundColor Cyan
ssh $VpsHost ($remote -join " && ")
if ($LASTEXITCODE -ne 0) { throw "remote deploy failed" }

# --- smoke ----------------------------------------------------------------------
Write-Host "== smoke ==" -ForegroundColor Cyan
Start-Sleep -Seconds 8
if ($DeployApi) {
    $h = Invoke-RestMethod "http://160.202.133.144:8800/healthz" -TimeoutSec 30
    if (-not $h.ok -or $h.account_role -ne "competition") { throw "healthz failed: $($h | ConvertTo-Json -Compress)" }
    Write-Host ("api ok: role={0} rev={1} last_pass_age={2}s" -f $h.account_role, $h.rev, $h.last_pass_age_seconds)
    $null = Invoke-RestMethod "http://160.202.133.144:8800/api/journal?limit=1" -TimeoutSec 30
    Write-Host "journal ok"
}
if ($DeployWeb) {
    $code = (Invoke-WebRequest "http://160.202.133.144:3000/" -UseBasicParsing -TimeoutSec 60).StatusCode
    if ($code -ne 200) { throw "web returned $code" }
    Write-Host "web ok: 200"
}
Write-Host "== deployed $stamp ==" -ForegroundColor Green
