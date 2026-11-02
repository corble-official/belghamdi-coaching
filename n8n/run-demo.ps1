# ============================================================
# Belghamdi Coaching — One-Click Demo Runner
# Fires the automation series against the 4 Telegram groups.
# Usage:
#   .\run-demo.ps1
#   .\run-demo.ps1 -InvokeAll           # also run scheduled sweeps via n8n API
#   .\run-demo.ps1 -N8nApiKey "ey..."   # do everything without prompting
# ============================================================
param(
    [switch]$InvokeAll,
    [string]$N8nApiKey = ""
)

$ErrorActionPreference = "Stop"

# ---------- Configuration (adjust here if anything changes) ----------
$BotBase    = "https://api.telegram.org/bot"
$BotToken   = "8795413972:AAHXxQu2NnHVTau6DY9GrTXfYhMd5Nfkgts"   # BC101 bot
$N8nBase    = "https://n8n.corble.net/webhook"
$N8nApiBase = "https://n8n.corble.net/api/v1"

# Telegram groups
$G_Sales    = -1003694741353   # Belghamdi - Sales & lead
$G_Ops      = -1003977860508   # Belghamdi - Coach Ops
$G_Report   = -1004466218595   # Belghamdi - Daily Report
$G_Errors   = -1004385158265   # Belghamdi - Alert & Errors

# Workflow IDs in n8n
$Wf = @{
    BC01 = "7yHrk6Z2lLlBH0KT"   # AI Sales Assistant v2 (Telegram webhook only)
    BC03 = "aPt7y8swl0aq3Mka"   # Client onboarding
    BC04 = "V5t4kDZWqG73AUAl"   # Weekly check-in
    BC05 = "vYiINZgPNoDA0ZWp"   # Missed check-in follow-up
    BC06 = "4w7DX62b6wCOpPiI"   # Coach tasks
    BC07 = "hE3RuIkr82XHZqmA"   # Renewals
    BC08 = "1yKFeGI4C47ONxLd"   # Daily report
    BC99 = "dkzI3KyB8ygSWGus"   # Global error handler (fires automatically)
}

$Stamp = Get-Date -Format "yyMMdd-HHmmss"
$Results = @()

# ---------- Helpers ----------
function Post($url, $body) {
    try {
        $r = Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 8)
        return $r
    } catch {
        Write-Host "  ✗ FAILED: $url" -ForegroundColor Red
        Write-Host ($_ | Out-String) -ForegroundColor DarkRed
        return $null
    }
}

function PostTG($chatId, $text) {
    try {
        Invoke-RestMethod -Method Post -Uri "$BotBase$BotToken/sendMessage" -Body @{ chat_id = $chatId; text = $text } | Out-Null
        return $true
    } catch { return $false }
}

# ---------- Optional: n8n API key for sweep execution ----------
if ($InvokeAll -and -not $N8nApiKey) {
    $N8nApiKey = Read-Host "Paste n8n API JWT (or press Enter to skip sweeps)"
}

function Invoke-Sweep($wfId, $name) {
    try {
        $r = Invoke-RestMethod -Method Post -Uri "$N8nApiBase/executions" -Headers @{ "X-N8N-API-KEY" = $N8nApiKey } -ContentType "application/json" -Body (@{ workflowId = $wfId } | ConvertTo-Json)
        Write-Host "  ✓ $name sweep executed (n8n exec: $($r.id))" -ForegroundColor Green
        return $r.id
    } catch {
        Write-Host "  ✗ $name sweep failed (n8n API — check key/version): $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# ============================================================
Write-Host "=== Belghamdi Automation — Demo Run $Stamp ===" -ForegroundColor Cyan

# --- 0. Bot connectivity + group posting rights ---
Write-Host "`n[0] Telegram bot check" -ForegroundColor Yellow
try {
    $me = Invoke-RestMethod -Uri "$BotBase$BotToken/getMe"
    Write-Host "  ✓ Bot: @$($me.result.username) ($($me.result.first_name))" -ForegroundColor Green
} catch { Write-Host "  ✗ Bot unreachable — Telegram/credential issue" -ForegroundColor Red }

# --- 1. BC-03: simulated order -> client created -> onboarding invite ---
Write-Host "`n[1] BC-03 Onboarding — simulated order event" -ForegroundColor Yellow
$orderRef = "DEMO-ORDER-$Stamp"
$order = Post "$N8nBase/bc03-order-event" @{
    event_type      = "order_verified"
    provider        = "internal"
    order_ref       = $orderRef
    package_id      = "gold"
    duration_days   = 30
    customer_name   = "DEMO — زبون اوتوماتيك $Stamp"
    telegram_user_id = 731956856
    telegram_chat_id = $G_Ops          # demo client "DMs" land in Coach Ops group
}
if ($order) { Write-Host "  ✓ Order processed: $($order | ConvertTo-Json -Compress)" -ForegroundColor Green }

# --- 2. BC-06: create a coach task, then complete it ---
Write-Host "`n[2] BC-06 Coach Tasks — upsert + complete" -ForegroundColor Yellow
$task = Post "$N8nBase/bc06-task-event" @{
    action      = "upsert"
    source_type = "automation"
    source_id   = "demo-task-$Stamp"
    client_code = "cl-demo-001"
    category    = "checkin_review"
    priority    = "high"
    reason      = "DEMO demo run — بطاقة بانتظار المراجعة"
}
if ($task) { Write-Host "  ✓ Task created: $($task | ConvertTo-Json -Compress)" -ForegroundColor Green }

$done = Post "$N8nBase/bc06-task-event" @{
    action       = "complete"
    source_id    = "demo-task-$Stamp"
    notes        = "DEMO demo run — finished by the demo script"
    reviewed_by  = "demo-runner"
}
if ($done) { Write-Host "  ✓ Task completed: $($done | ConvertTo-Json -Compress)" -ForegroundColor Green }

# --- 3. BC-07: renewal event -> extends a demo subscription ---
Write-Host "`n[3] BC-07 Renewals — simulated renewal (extend sub-demo-001)" -ForegroundColor Yellow
$renew = Post "$N8nBase/bc07-renewal-event" @{
    event_type       = "order_verified"
    provider         = "internal"
    order_ref        = "DEMO-RENEWAL-$Stamp"
    payload          = @{
        subscription_code = "sub-demo-001"
        new_end_date      = (Get-Date "2026-12-31").ToString("yyyy-MM-dd")
    }
}
if ($renew) { Write-Host "  ✓ Renewal processed: $($renew | ConvertTo-Json -Compress)" -ForegroundColor Green }

# --- 4. BC-01 / BC-99 probes (informational) ---
Write-Host "`n[4] BC-01 / BC-99 — manual behavior" -ForegroundColor Yellow
$ok = PostTG $G_Report "🧪 Demo script note — BC-01 triggers only when someone messages @BelghamdiFull0x0101_bot (send it a message to test). BC-99 fires automatically on failures only."
Write-Host ($ok ? "  ✓ Info note posted to Daily Report group" : "  ✗ Telegram post failed") -ForegroundColor ($ok ? "Green" : "Red")

# --- 5. Optional: run the scheduled sweeps now via n8n API ---
if ($InvokeAll -and $N8nApiKey) {
    Write-Host "`n[5] Scheduled sweeps (n8n API)" -ForegroundColor Yellow
    Invoke-Sweep $Wf.BC08 "BC-08 Daily Report"
    Invoke-Sweep $Wf.BC04 "BC-04 Check-in sweep"
    Invoke-Sweep $Wf.BC05 "BC-05 Missed follow-up"
    Invoke-Sweep $Wf.BC07 "BC-07 Renewal sweep"
    Invoke-Sweep $Wf.BC03 "BC-03 Onboarding sweep"
} else {
    Write-Host "`n[5] Sweeps skipped (run with -InvokeAll -N8nApiKey 'ey..' to force them now)" -ForegroundColor DarkGray
}

Write-Host "`n=== Done. Check your 4 Telegram groups for morning-style activity. ===" -ForegroundColor Cyan
