<#
.SYNOPSIS
  Mo Cloudflare quick tunnel cho Coffee Shop va tu cap nhat moi thu theo duong dan moi.

.DESCRIPTION
  1. Tat tunnel cu (neu con) va mo tunnel moi (chay an, van chay sau khi script ket thuc).
  2. Lay duong dan https://xxxx.trycloudflare.com va doi den khi truy cap duoc.
  3. Cap nhat APP_BASE_URL va ALLOWED_ORIGINS trong .env, chay lai cac service bi anh huong.
  4. Tao lai ma QR cho tat ca cac ban.
  5. In URL webhook can dan vao SePay (va copy san vao clipboard).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\start-tunnel.ps1
  powershell -ExecutionPolicy Bypass -File scripts\start-tunnel.ps1 -Stop
#>
param(
  [int]$Port = 8088,
  [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
$toolsDir = Join-Path $root '.tools'
$logFile = Join-Path $toolsDir 'cloudflared.log'
$urlFile = Join-Path $toolsDir 'tunnel-url.txt'
$cloudflaredVersion = '2026.10.7'
$localBase = "http://localhost:$Port"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    [!]  $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "`n[LOI] $msg" -ForegroundColor Red; exit 1 }

function Stop-Tunnel {
  $procs = @(Get-Process cloudflared -ErrorAction SilentlyContinue)
  if ($procs.Count -gt 0) {
    $procs | Stop-Process -Force
    Ok "Da tat $($procs.Count) tien trinh cloudflared cu"
  } else {
    Ok 'Khong co tunnel cu nao dang chay'
  }
}

function Read-SharedText($path) {
  # cloudflared is still writing the log, so open it with shared read/write access.
  if (-not (Test-Path $path)) { return '' }
  $stream = [IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
  try {
    $reader = New-Object IO.StreamReader($stream)
    return $reader.ReadToEnd()
  } finally {
    $stream.Dispose()
  }
}

function Test-Url($url, [int]$timeoutSec = 10) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec $timeoutSec
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300)
  } catch {
    return $false
  }
}

if ($Stop) {
  Step 'Tat tunnel'
  Stop-Tunnel
  return
}

# --- 0. App phai dang chay -------------------------------------------------
Step "Kiem tra app dang chay o $localBase"
if (-not (Test-Url "$localBase/api/v1/payments/webhook")) {
  Fail "App chua chay o $localBase. Hay chay 'docker compose up -d' trong $root truoc."
}
Ok 'App dang chay'

# --- 1. Tim hoac tai cloudflared --------------------------------------------
Step 'Tim cloudflared'
New-Item -ItemType Directory -Force $toolsDir | Out-Null
$exe = $null
$cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cmd) {
  $exe = $cmd.Source
} else {
  $exe = Join-Path $toolsDir 'cloudflared.exe'
  if (-not (Test-Path $exe)) {
    Write-Host "    Dang tai cloudflared $cloudflaredVersion ..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $downloadUrl = "https://github.com/cloudflare/cloudflared/releases/download/$cloudflaredVersion/cloudflared-windows-amd64.exe"
    Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $exe
  }
}
Ok $exe

# --- 2. Mo tunnel moi --------------------------------------------------------
Step 'Mo tunnel moi'
Stop-Tunnel
if (Test-Path $logFile) { Remove-Item $logFile -Force }
$proc = Start-Process -FilePath $exe `
  -ArgumentList @('tunnel', '--no-autoupdate', '--url', $localBase) `
  -RedirectStandardError $logFile `
  -RedirectStandardOutput (Join-Path $toolsDir 'cloudflared.out.log') `
  -WindowStyle Hidden -PassThru

$tunnelUrl = $null
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline -and -not $tunnelUrl) {
  Start-Sleep -Seconds 1
  if ($proc.HasExited) {
    Write-Host (Read-SharedText $logFile)
    Fail 'cloudflared da dung bat ngo (xem log o tren).'
  }
  $m = [regex]::Matches((Read-SharedText $logFile), 'https://[a-z0-9-]+\.trycloudflare\.com') |
    Where-Object { $_.Value -ne 'https://api.trycloudflare.com' } |
    Select-Object -First 1
  if ($m) { $tunnelUrl = $m.Value }
}
if (-not $tunnelUrl) { Fail "Khong lay duoc duong dan tunnel sau 60 giay. Xem log: $logFile" }
Ok "Duong dan moi: $tunnelUrl"

Write-Host '    Dang doi duong dan truy cap duoc (thuong mat 5-30 giay)...'
$reachable = $false
$deadline = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $deadline) {
  if (Test-Url "$tunnelUrl/api/v1/payments/webhook" 10) { $reachable = $true; break }
  Start-Sleep -Seconds 3
}
if ($reachable) { Ok 'Duong dan da truy cap duoc tu internet' }
else { Warn 'Chua truy cap duoc sau 2 phut, van tiep tuc cap nhat. Thu mo lai sau it phut.' }
Set-Content -Path $urlFile -Value $tunnelUrl -Encoding ascii

# --- 3. Cap nhat .env ---------------------------------------------------------
Step 'Cap nhat .env'
if (-not (Test-Path $envFile)) { Fail "Khong tim thay $envFile" }
Copy-Item $envFile (Join-Path $toolsDir 'env.backup') -Force
$text = [IO.File]::ReadAllText($envFile)
$newline = "`n"
if ($text -match "`r`n") { $newline = "`r`n" }

if ($text -match '(?m)^APP_BASE_URL=') {
  $text = [regex]::Replace($text, '(?m)^APP_BASE_URL=[^\r\n]*', "APP_BASE_URL=$tunnelUrl")
} else {
  $text = $text.TrimEnd() + $newline + "APP_BASE_URL=$tunnelUrl" + $newline
}

$originsMatch = [regex]::Match($text, '(?m)^ALLOWED_ORIGINS=([^\r\n]*)')
$origins = @()
if ($originsMatch.Success) {
  $origins = @($originsMatch.Groups[1].Value.Split(',') | ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and ($_ -notmatch '^https://[a-z0-9-]+\.trycloudflare\.com$') })
}
$originsLine = 'ALLOWED_ORIGINS=' + ((@($tunnelUrl) + $origins) -join ',')
if ($originsMatch.Success) {
  $text = [regex]::Replace($text, '(?m)^ALLOWED_ORIGINS=[^\r\n]*', $originsLine)
} else {
  $text = $text.TrimEnd() + $newline + $originsLine + $newline
}
[IO.File]::WriteAllText($envFile, $text, (New-Object Text.UTF8Encoding($false)))
Ok "APP_BASE_URL=$tunnelUrl"
Ok "Da them $tunnelUrl vao ALLOWED_ORIGINS (ban sao luu: .tools\env.backup)"

# --- 4. Chay lai cac service bi anh huong ----------------------------------
Step 'Chay lai cac service (docker compose up -d)'
Push-Location $root
$prevPref = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
docker compose up -d 2>&1 | ForEach-Object { "    $_" } | Where-Object { $_ -match 'Recreate|Started|Running|error' } | Out-Host
$composeExit = $LASTEXITCODE
$ErrorActionPreference = $prevPref
Pop-Location
if ($composeExit -ne 0) { Fail 'docker compose up -d bi loi.' }

Write-Host '    Dang doi table-service san sang...'
$tables = $null
$deadline = (Get-Date).AddSeconds(180)
while ((Get-Date) -lt $deadline -and $null -eq $tables) {
  Start-Sleep -Seconds 5
  try {
    $resp = Invoke-RestMethod -Uri "$localBase/api/tables" -TimeoutSec 10
    if ($resp -is [array]) { $tables = $resp }
    elseif ($resp.data) { $tables = @($resp.data) }
    else { $tables = @($resp) }
  } catch { }
}
if ($null -eq $tables) { Fail 'table-service khong san sang sau 3 phut.' }
Ok 'Cac service da san sang'

# --- 5. Tao lai QR cho tat ca ban -------------------------------------------
Step 'Tao lai ma QR cho cac ban'
$okCount = 0
$failCount = 0
foreach ($t in $tables) {
  if (-not $t.id) { continue }
  try {
    Invoke-RestMethod -Uri "$localBase/api/tables/$($t.id)/qr" -TimeoutSec 20 | Out-Null
    $okCount++
  } catch {
    $failCount++
    Warn "Ban $($t.number): $($_.Exception.Message)"
  }
}
Ok "Da tao lai QR cho $okCount ban (loi: $failCount)"

# --- 6. Tong ket --------------------------------------------------------------
$webhookUrl = "$tunnelUrl/api/v1/payments/webhook"
try { Set-Clipboard -Value $webhookUrl } catch { }
$webhookOk = Test-Url $webhookUrl 15

Write-Host ''
Write-Host '================================================================' -ForegroundColor Green
Write-Host "  Duong dan cong khai : $tunnelUrl"
Write-Host "  URL webhook SePay   : $webhookUrl"
if ($webhookOk) { Write-Host '  Webhook             : truy cap duoc' -ForegroundColor Green }
else { Write-Host '  Webhook             : CHUA truy cap duoc, thu lai sau it phut' -ForegroundColor Yellow }
Write-Host '================================================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Viec con lai (lam tay):' -ForegroundColor Cyan
Write-Host '  1. Vao my.sepay.vn > Tich hop WebHooks > Coffee Shop > Sua,'
Write-Host '     dan URL webhook o tren (da copy san vao clipboard, chi can Ctrl+V).'
Write-Host '  2. In lai ma QR cac ban o trang Ban (Tables) neu da in ra giay.'
Write-Host ''
Write-Host 'Tunnel dang chay an. Mo lai script nay moi khi doi Wi-Fi, may ngu hoac khoi dong lai.'
Write-Host "Tat tunnel: powershell -ExecutionPolicy Bypass -File scripts\start-tunnel.ps1 -Stop"
