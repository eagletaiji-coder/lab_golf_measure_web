# Auto commit + push when project files change (Cursor hook).
# Runs from the project root. Fails open (exit 0) so agent work is never blocked.

$ErrorActionPreference = "SilentlyContinue"
[Console]::In.ReadToEnd() | Out-Null

$root = Get-Location
if (-not (Test-Path (Join-Path $root ".git"))) { exit 0 }

$debounceSec = 8
$stampPath = Join-Path $root ".cursor/hooks/.git-sync-last"
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
if (Test-Path $stampPath) {
  $last = [int64](Get-Content $stampPath -Raw)
  if (($now - $last) -lt $debounceSec) { exit 0 }
}

$porcelain = git status --porcelain 2>$null
if (-not $porcelain) { exit 0 }

git add -A 2>$null
if ($LASTEXITCODE -ne 0) { exit 0 }

$branch = git rev-parse --abbrev-ref HEAD 2>$null
if (-not $branch) { exit 0 }

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$message = "Auto sync: $timestamp"

git commit -m $message 2>$null
if ($LASTEXITCODE -ne 0) { exit 0 }

git push origin $branch 2>$null | Out-Null

Set-Content -Path $stampPath -Value $now -NoNewline
exit 0
