param([string]$Target = "https://nvd.nist.gov/vuln/detail/CVE-2021-44228")

$ErrorActionPreference = "Stop"
$Base = "http://localhost:3000"

Write-Host "`n=== 1. HEALTH ===" -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "$Base/api/v1/health" -TimeoutSec 30
$health | ConvertTo-Json -Depth 4

Write-Host "`n=== 2. CREATE SCAN JOB ===" -ForegroundColor Cyan
$body = @{ target_url = $Target } | ConvertTo-Json
$job = Invoke-RestMethod -Uri "$Base/api/v1/scan" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 60
Write-Host ("jobId: " + $job.jobId + "  status: " + $job.status)

Write-Host "`n=== 3. POLL ===" -ForegroundColor Cyan
$seen = 0
$deadline = (Get-Date).AddSeconds(200)
$final = $null
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    $state = Invoke-RestMethod -Uri "$Base/api/v1/scan/$($job.jobId)" -TimeoutSec 30
    $new = @($state.events)
    if ($new.Count -gt $seen) {
        for ($i = $seen; $i -lt $new.Count; $i++) {
            $e = $new[$i]
            $mark = switch ($e.level) { "success" { "+" } "warn" { "!" } "error" { "x" } "agent" { ">" } default { "-" } }
            Write-Host ("  [$mark] " + $e.step.PadRight(9) + $e.message)
        }
        $seen = $new.Count
    }
    if ($state.status -eq "done" -or $state.status -eq "error") { $final = $state; break }
}

if (-not $final) { Write-Host "`nTIMED OUT" -ForegroundColor Red; exit 1 }

Write-Host "`n=== 4. RESULT ===" -ForegroundColor Cyan
Write-Host ("status: " + $final.status + "   events: " + $final.events.Count)
if ($final.error) { Write-Host ("error: " + $final.error) -ForegroundColor Red; exit 1 }

$a = $final.assessment
Write-Host ("target      : " + $a.target)
Write-Host ("risk score  : " + $a.risk.risk_score + "/100  (" + $a.risk.severity_label + ")")
Write-Host ("confidence  : " + $a.risk.confidence)
Write-Host ("engine      : " + $a.risk.engine)
Write-Host ("reasoning   : " + $a.reasoning_engine)
Write-Host ("findings    : " + $a.vulnerability_breakdown.Count)
Write-Host ("risk vector : " + ($a.risk_vector | ConvertTo-Json -Compress))
Write-Host ""
Write-Host "--- summary ---" -ForegroundColor Cyan
Write-Host $a.executive_summary
Write-Host ""
Write-Host "--- findings ---" -ForegroundColor Cyan
foreach ($f in $a.vulnerability_breakdown) {
    Write-Host ("  [" + $f.severity + "] " + $f.title + "  (" + $f.cwe + ")")
}
Write-Host ""
Write-Host "--- patch ---" -ForegroundColor Cyan
if ($a.patch) {
    Write-Host ("  " + $a.patch.title + "  (" + $a.patch.cwe + ")")
    foreach ($d in ($a.patch.diff -split "`n")) { Write-Host ("   " + $d) }
}
Write-Host "`nPASSED`n"
