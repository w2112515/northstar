# NorthStar Cloud Run deployment (G7). Prereqs:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - a GCP project with Cloud Run + Cloud Build + Artifact Registry enabled,
#     a Firestore (Native) database, and an Artifact Registry docker repo
#     named cloud-run-source-deploy in $Region
# Usage: .\scripts\deploy.ps1 -ProjectId my-project [-Region us-central1]
#
# Architecture: ONE Cloud Run service, TWO containers.
#   web (ingress, :8080)  -> Next.js; proxies /api/* and /a2a/* to localhost
#   api (sidecar, :8000)  -> FastAPI + ADK agent + in-process scheduler
# Why not two services: Google Frontend has a known intermittent bug (Jul-Aug
# 2026 forum threads) where a fresh service's run.app hostname never registers
# at the edge - Ready=True, RoutesReady=True, yet every request 404s before
# reaching the container. We lost a service to it; riding one known-good
# hostname sidesteps the lottery entirely, and localhost beats cross-service
# hops anyway.
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
# require this token; the web container injects it server-side. GETs stay public
# so judges can view the cockpit, but nobody can drive the account.
$adminToken = $envVars.NORTHSTAR_ADMIN_TOKEN
if (-not $adminToken) {
    $adminToken = -join ((1..40) | ForEach-Object { "abcdefghijklmnopqrstuvwxyz0123456789"[(Get-Random -Maximum 36)] })
    Write-Host ">> Generated NORTHSTAR_ADMIN_TOKEN (add it to .env to keep it stable across deploys)" -ForegroundColor Yellow
}

# --- Secret Manager sync -------------------------------------------------------
# Key material lives in Secret Manager; the service YAML only carries
# secretKeyRef pointers, so deploy artifacts and `gcloud run services describe`
# output never contain a real value.
$secrets = @{
    "northstar-alpaca-key"    = $envVars.ALPACA_API_KEY
    "northstar-alpaca-secret" = $envVars.ALPACA_SECRET_KEY
    "northstar-google-key"    = $envVars.GOOGLE_API_KEY
    "northstar-admin-token"   = $adminToken
}
$projectNumber = gcloud projects describe $ProjectId --format "value(projectNumber)"
$runtimeSa = "$projectNumber-compute@developer.gserviceaccount.com"
Write-Host ">> Syncing secrets to Secret Manager..." -ForegroundColor Cyan
foreach ($name in $secrets.Keys) {
    $value = $secrets[$name]
    if (-not $value) { Write-Host "   $name skipped (empty in .env)" -ForegroundColor Yellow; continue }
    $tmp = Join-Path $env:TEMP "ns-secret.tmp"
    [System.IO.File]::WriteAllText($tmp, $value)   # no trailing newline
    $exists = gcloud secrets describe $name --project $ProjectId --format "value(name)" 2>$null
    if (-not $exists) {
        gcloud secrets create $name --project $ProjectId --replication-policy automatic --data-file $tmp | Out-Null
    } else {
        # add a version only when the value actually changed (latest accessor)
        $current = gcloud secrets versions access latest --secret $name --project $ProjectId 2>$null
        if ($current -cne $value) {
            gcloud secrets versions add $name --project $ProjectId --data-file $tmp | Out-Null
        }
    }
    Remove-Item $tmp -ErrorAction SilentlyContinue
    gcloud secrets add-iam-policy-binding $name --project $ProjectId `
        --member "serviceAccount:$runtimeSa" --role roles/secretmanager.secretAccessor 2>$null | Out-Null
    Write-Host "   $name ok"
}

$repo = "$Region-docker.pkg.dev/$ProjectId/cloud-run-source-deploy"

Write-Host ">> Building API image..." -ForegroundColor Cyan
gcloud builds submit --project $ProjectId --tag "$repo/northstar-api:latest" "$root\apps\api"
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ">> Building Web image..." -ForegroundColor Cyan
gcloud builds submit --project $ProjectId --tag "$repo/northstar-web:latest" "$root\apps\web"
if ($LASTEXITCODE -ne 0) { exit 1 }

# minScale/maxScale 1: the scheduler + pass lock are single-process by design;
# a second instance would double-run the autopilot, zero would freeze it.
# cpu-throttling false: the scheduler is an in-process background task; default
# request-based billing throttles CPU between requests and would stall it.
# The api sidecar binds 0.0.0.0:8000 because Cloud Run's TCP startup probe
# cannot reach a loopback-only bind; the port is still private - only the
# ingress container's 8080 is routed from the edge.
$yaml = @"
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: northstar-web
  labels:
    cloud.googleapis.com/location: $Region
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "1"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/container-dependencies: '{"web":["api"]}'
    spec:
      timeoutSeconds: 900
      containers:
      - name: web
        image: $repo/northstar-web:latest
        ports:
        - containerPort: 8080
        env:
        - name: API_BASE
          value: "http://127.0.0.1:8000"
        - name: NORTHSTAR_ADMIN_TOKEN
          valueFrom:
            secretKeyRef:
              name: northstar-admin-token
              key: latest
        resources:
          limits:
            cpu: "1"
            memory: 512Mi
      - name: api
        image: $repo/northstar-api:latest
        command: ["sh"]
        args: ["-c", "uv run uvicorn northstar.api.app:app --host 0.0.0.0 --port 8000"]
        env:
        - name: ALPACA_API_KEY
          valueFrom:
            secretKeyRef:
              name: northstar-alpaca-key
              key: latest
        - name: ALPACA_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: northstar-alpaca-secret
              key: latest
        - name: ALPACA_PAPER
          value: "true"
        - name: ACCOUNT_ROLE
          value: "$($envVars.ACCOUNT_ROLE)"
        - name: GOOGLE_API_KEY
          valueFrom:
            secretKeyRef:
              name: northstar-google-key
              key: latest
        - name: JOURNAL_STORE
          value: "firestore"
        - name: GOOGLE_CLOUD_PROJECT
          value: "$ProjectId"
        - name: NORTHSTAR_ADMIN_TOKEN
          valueFrom:
            secretKeyRef:
              name: northstar-admin-token
              key: latest
        resources:
          limits:
            cpu: "1"
            memory: 1Gi
        startupProbe:
          tcpSocket:
            port: 8000
          periodSeconds: 5
          failureThreshold: 30
"@
$yamlPath = Join-Path $env:TEMP "northstar-web.yaml"
Set-Content -Path $yamlPath -Value $yaml -Encoding utf8

Write-Host ">> Applying service (web + api sidecar)..." -ForegroundColor Cyan
gcloud run services replace $yamlPath --project $ProjectId --region $Region
if ($LASTEXITCODE -ne 0) { exit 1 }

$webUrl = gcloud run services describe northstar-web --project $ProjectId --region $Region --format "value(status.url)"

Write-Host ">> Smoke tests..." -ForegroundColor Cyan
try {
    $null = Invoke-RestMethod "$webUrl/api/journal?limit=1" -TimeoutSec 60
    Write-Host "   /api proxy -> api sidecar: OK" -ForegroundColor Green
} catch { Write-Host "   /api proxy FAILED: $($_.Exception.Message)" -ForegroundColor Red }
try {
    $card = Invoke-RestMethod "$webUrl/a2a/weather/.well-known/agent-card.json" -TimeoutSec 30
    Write-Host "   /a2a agent card ($($card.name)): OK" -ForegroundColor Green
} catch { Write-Host "   /a2a card FAILED: $($_.Exception.Message)" -ForegroundColor Red }

Write-Host ""
Write-Host "NorthStar is live:" -ForegroundColor Green
Write-Host "  Web -> $webUrl"
Write-Host "  A2A -> $webUrl/a2a/weather/.well-known/agent-card.json"
Write-Host "Note: minScale 1 + cpu-throttling off keeps the autopilot scheduler alive."
