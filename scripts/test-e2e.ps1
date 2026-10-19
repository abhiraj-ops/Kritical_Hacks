param([string]$Claim = "5G mobile networks cause coronavirus infections in humans")

$ErrorActionPreference = "Stop"
$bodyFile = Join-Path $env:TEMP "cc_body.json"
$outFile  = Join-Path $env:TEMP "cc_out.txt"
'{"claim":"' + $Claim + '"}' | Set-Content -Path $bodyFile -Encoding UTF8

$ok = $false
foreach ($i in 1..25) {
  try { $null = Invoke-WebRequest "http://localhost:3000/" -TimeoutSec 5 -UseBasicParsing; $ok = $true; break }
  catch { Start-Sleep -Seconds 2 }
}
if (-not $ok) { Write-Output "SERVER NOT UP"; exit 1 }

& curl.exe -s -N -X POST "http://localhost:3000/api/verify" `
  -H "Content-Type: application/json" `
  --data-binary "@$bodyFile" -o $outFile --max-time 200

# Decode UTF-8 from the file — avoids PowerShell's Byte[] string-casting trap.
$raw   = [System.IO.File]::ReadAllText($outFile, [System.Text.Encoding]::UTF8)
$lines = @($raw -split "`n" | Where-Object { $_.Trim() })

Write-Output ("CLAIM : " + $Claim)
Write-Output ("EVENTS: " + $lines.Count)
Write-Output ""

foreach ($l in $lines) {
  $o = $l | ConvertFrom-Json
  switch ($o.type) {
    "stage" { Write-Output ("  [stage] " + $o.stage.PadRight(7) + $o.status.PadRight(5) + " " + $o.detail) }
    "error" { Write-Output ("  [ERROR] " + $o.message) }
    "verdict" {
      $v = $o.verdict
      Write-Output ""
      Write-Output "========== VERDICT =========="
      Write-Output ("  label      : " + $v.label)
      Write-Output ("  confidence : " + $v.confidence)
      Write-Output ("  strength   : " + $v.strength + "%")
      Write-Output ("  cached     : " + $o.cached)
      Write-Output ("  summary    : " + $v.summary)
      Write-Output ("  stats      : searched=" + $v.stats.searched + " found=" + $v.stats.found +
                    " fetched=" + $v.stats.fetched + " failed=" + $v.stats.failed +
                    " support=" + $v.stats.support + " refute=" + $v.stats.refute +
                    " unclear=" + $v.stats.unclear + " highAuth=" + $v.stats.highAuthority)
      Write-Output ""
      Write-Output "======== EVIDENCE PANEL ========"
      foreach ($s in $v.sources) {
        Write-Output ("  [" + $s.stance + " | auth " + $s.authority + " " + $s.authorityLabel + "] " + $s.domain)
        foreach ($q in $s.quotes) {
          $snip = if ($q.Length -gt 180) { $q.Substring(0,180) + "..." } else { $q }
          Write-Output ("      > " + $snip)
        }
      }
    }
  }
}
