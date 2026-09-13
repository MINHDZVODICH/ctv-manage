param(
    [string]$ProjectName = 'ctv-release',
    [ValidateRange(1,65535)][int]$Port = 8080,
    [switch]$NoBrowser,
    [switch]$Update
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:CTV_HTTP_PORT = "$Port"
$composeArgs = @('compose', '--project-name', $ProjectName, '--env-file', '.env.docker', '-f', 'compose.yaml')

function Invoke-Docker {
    param([string[]]$DockerArgs)
    & $script:dockerExe @DockerArgs
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed (exit $LASTEXITCODE)." }
}
function Invoke-Compose {
    param([string[]]$ComposeArgs)
    Invoke-Docker -DockerArgs ($script:composeArgs + $ComposeArgs)
}
function Test-DockerCommand {
    param([string[]]$DockerArgs)
    # A missing image or a stopped daemon is expected during first startup.
    # Windows PowerShell may otherwise turn native stderr into a terminating error.
    $ErrorActionPreference = 'Continue'
    & $script:dockerExe @DockerArgs *> $null
    return ($LASTEXITCODE -eq 0)
}

# Prevent two double-clicks from restoring the same database concurrently.
$lock = $null
try {
    try {
        $lock = [IO.File]::Open((Join-Path $PSScriptRoot '.run.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    } catch { throw 'Another launcher is running. Wait for it to finish.' }

    foreach ($file in @('compose.yaml', '.env.docker', 'backup/ctv_manage.dump', 'backup/uploads.tar.gz')) {
        if (-not (Test-Path -LiteralPath $file)) { throw "Missing file: $file. Copy the entire release folder." }
    }
    $command = Get-Command docker.exe -ErrorAction SilentlyContinue
    $script:dockerExe = if ($command) { $command.Source } else { $null }
    if (-not $script:dockerExe) {
        foreach ($candidate in @(
            "$env:LOCALAPPDATA/Programs/DockerDesktop/resources/bin/docker.exe",
            "$env:ProgramFiles/Docker/Docker/resources/bin/docker.exe"
        )) {
            if (Test-Path -LiteralPath $candidate) { $script:dockerExe = $candidate; break }
        }
    }
    if (-not $script:dockerExe) { throw 'Install Docker Desktop (Linux containers), then run this file again.' }

    Write-Host '[1/5] Checking Docker Desktop...'
    if (-not (Test-DockerCommand -DockerArgs @('info', '--format', '{{.OSType}}'))) {
        foreach ($desktop in @(
            "$env:LOCALAPPDATA/Programs/DockerDesktop/Docker Desktop.exe",
            "$env:ProgramFiles/Docker/Docker/Docker Desktop.exe"
        )) {
            if (Test-Path -LiteralPath $desktop) {
                Start-Process -FilePath $desktop -WindowStyle Hidden
                break
            }
        }
        $deadline = (Get-Date).AddMinutes(3)
        $dockerReady = $false
        do {
            Start-Sleep -Seconds 3
            $dockerReady = Test-DockerCommand -DockerArgs @('info', '--format', '{{.OSType}}')
            if ($dockerReady) { break }
        } while ((Get-Date) -lt $deadline)
        if (-not $dockerReady) { throw 'Docker is not ready. Open Docker Desktop and retry.' }
    }
    $osType = Invoke-Docker -DockerArgs @('info', '--format', '{{.OSType}}')
    if ($osType.Trim() -ne 'linux') { throw 'Switch Docker Desktop to Linux containers.' }
    Invoke-Compose -ComposeArgs @('config', '--quiet')

    Write-Host '[2/5] Checking application images...'
    $images = Invoke-Compose -ComposeArgs @('config', '--images')
    foreach ($image in $images) {
        $hasImage = Test-DockerCommand -DockerArgs @('image', 'inspect', $image)
        if ($Update -or (-not $hasImage)) {
            Write-Host "Downloading $image..."
            try { Invoke-Docker -DockerArgs @('pull', $image) }
            catch { throw "Cannot download $image. Check your Internet connection and Docker Hub access, then run again." }
        }
    }

    Write-Host '[3/5] Starting database...'
    Invoke-Compose -ComposeArgs @('up', '-d', '--wait', '--wait-timeout', '120', '--pull', 'never', 'postgres')
    $sql = "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema');"
    $count = Invoke-Compose -ComposeArgs @('exec', '-T', 'postgres', 'psql', '-U', 'ctv_manage', '-d', 'ctv_manage', '-At', '-c', $sql)
    if ([int]($count -join '').Trim() -eq 0) {
        Write-Host 'Restoring database for the first run...'
        Invoke-Compose -ComposeArgs @('cp', 'backup/ctv_manage.dump', 'postgres:/tmp/ctv_manage.dump')
        Invoke-Compose -ComposeArgs @('exec', '-T', 'postgres', 'pg_restore', '-U', 'ctv_manage', '-d', 'ctv_manage', '--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction', '/tmp/ctv_manage.dump')
    } else { Write-Host 'Existing database found. Keeping current data.' }

    # Synchronize PostgreSQL user password with .env.docker POSTGRES_PASSWORD
    $pgUser = 'ctv_manage'
    $pgDb = 'ctv_manage'
    $pgPassword = 'ctv_manage'
    if (Test-Path -LiteralPath '.env.docker') {
        $pwMatch = Select-String -Path '.env.docker' -Pattern '^\s*POSTGRES_PASSWORD\s*=\s*(.+?)\s*$'
        if ($pwMatch) { $pgPassword = $pwMatch.Matches[0].Groups[1].Value.Trim('"', "'") }
        $userMatch = Select-String -Path '.env.docker' -Pattern '^\s*POSTGRES_USER\s*=\s*(.+?)\s*$'
        if ($userMatch) { $pgUser = $userMatch.Matches[0].Groups[1].Value.Trim('"', "'") }
        $dbMatch = Select-String -Path '.env.docker' -Pattern '^\s*POSTGRES_DB\s*=\s*(.+?)\s*$'
        if ($dbMatch) { $pgDb = $dbMatch.Matches[0].Groups[1].Value.Trim('"', "'") }
    }
    $escapedPw = $pgPassword.Replace("'", "''")
    $syncSql = "ALTER USER $pgUser WITH PASSWORD '$escapedPw';"
    Invoke-Compose -ComposeArgs @('exec', '-T', 'postgres', 'psql', '-U', $pgUser, '-d', $pgDb, '-c', $syncSql) | Out-Null

    Write-Host '[4/5] Preparing uploaded files...'
    $backupPath = Join-Path $PSScriptRoot 'backup'
    # Marker lives in the volume, so moving the release folder does not reset it.
    # skip-old-files also makes retry after an interrupted extraction safe.
    $restore = 'set -eu; if [ ! -f /data/uploads/.ctv-release-restored ]; then tar --skip-old-files -xzf /backup/uploads.tar.gz -C /data/uploads; touch /data/uploads/.ctv-release-restored; fi'
    Invoke-Compose -ComposeArgs @('run', '--rm', '--no-deps', '-v', "${backupPath}:/backup:ro", 'backend', 'sh', '-c', $restore)

    Write-Host '[5/5] Starting application...'
    Invoke-Compose -ComposeArgs @('up', '-d', '--no-build', '--pull', 'never')
    $url = "http://localhost:$Port"
    $ready = $false
    $deadline = (Get-Date).AddMinutes(2)
    do {
        try {
            $health = Invoke-RestMethod -Uri "$url/api/v1/health/ready" -TimeoutSec 5
            $page = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 5
            if ($health.status -eq 'ready' -and $page.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    if (-not $ready) {
        Invoke-Compose -ComposeArgs @('logs', '--tail=40', 'backend', 'frontend')
        throw 'Application did not become ready. Check the logs above.'
    }
    Write-Host "Ready: $url" -ForegroundColor Green
    if (-not $NoBrowser) { Start-Process $url }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($lock) { $lock.Dispose() }
}
