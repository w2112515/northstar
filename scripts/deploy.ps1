# NorthStar Cloud Run deployment (G7). Prereqs:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - a GCP project with Cloud Run + Cloud Build + Firestore (Native mode) enabled
# Usage: .\scripts\deploy.ps1 -ProjectId my-project [-Region us-central1]
param(
    [Parameter(Mandatory = $true)][string]$ProjectId,
    [string]$Region = "us-central1"
)

$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) { Write-Error ".env not found"; exit 1 }
$envVars = @{}
Get-Content $envFile | Where-Object { $_ -match "^\s*[^#].*=" } | ForEach-Object {
    $k, $v = $_ -split "=", 2; $envVars[$k.Trim()] = $v.Trim()
}

# Write guard: mutating endpoints (kill switch, approvals, close, tick...)
# require this token; the web service injects it server-side. GETs stay public
# so judges can view the cockpit, but nobody can drive the account.
$adminToken = $envVars.NORTHSTAR_ADMIN_TOKEN
if (-not $adminToken) {
    $adminToken = -join ((1..40) | ForEach-Object { "abcdefghijklmnopqrstuvwxyz0123456789"[(Get-Random -Maximum 36)] })
    Write-Host ">> Generated NORTHSTAR_ADMIN_TOKEN (add it to .env to keep it stable across deploys)" -ForegroundColor Yellow
}

Write-Host ">> Deploying API to Cloud Run..." -ForegroundColor Cyan
# max-instances 1: the scheduler + pass lock are single-process by design;
# a second instance would double-run the autopilot.
gcloud run deploy northstar-api `
    --project $ProjectId --region $Region --source "$root\apps\api" `
    --allow-unauthenticated --memory 1Gi --cpu 1 --min-instances 1 --max-instances 1 `
    --set-env-vars "ALPACA_API_KEY=$($envVars.ALPACA_API_KEY),ALPACA_SECRET_KEY=$($envVars.ALPACA_SECRET_KEY),ALPACA_PAPER=true,ACCOUNT_ROLE=$($envVars.ACCOUNT_ROLE),GOOGLE_API_KEY=$($envVars.GOOGLE_API_KEY),JOURNAL_STORE=firestore,GOOGLE_CLOUD_PROJECT=$ProjectId,NORTHSTAR_ADMIN_TOKEN=$adminToken"
if ($LASTEXITCODE -ne 0) { exit 1 }

$apiUrl = gcloud run services describe northstar-api --project $ProjectId --region $Region --format "value(status.url)"
Write-Host ">> API at $apiUrl" -ForegroundColor Green

Write-Host ">> Deploying Web to Cloud Run..." -ForegroundColor Cyan
gcloud run deploy northstar-web `
    --project $ProjectId --region $Region --source "$root\apps\web" `
    --allow-unauthenticated --memory 512Mi --min-instances 0 --max-instances 2 `
    --set-env-vars "API_BASE=$apiUrl,NORTHSTAR_ADMIN_TOKEN=$adminToken"
if ($LASTEXITCODE -ne 0) { exit 1 }

$webUrl = gcloud run services describe northstar-web --project $ProjectId --region $Region --format "value(status.url)"
Write-Host ""
Write-Host "NorthStar is live:" -ForegroundColor Green
Write-Host "  Web -> $webUrl"
Write-Host "  API -> $apiUrl/healthz"
Write-Host "Note: min-instances 1 keeps the autopilot scheduler alive on the API service."
