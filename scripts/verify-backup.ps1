[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$BackupFile,
    [Parameter(Mandatory)][ValidatePattern('^[a-zA-Z][a-zA-Z0-9_]+$')][string]$TemporaryDatabase,
    [string]$PostgresContainer = "synapse-postgres",
    [ValidatePattern('^[a-zA-Z0-9_]+$')][string]$DatabaseUser = "synapse",
    [ValidatePattern('^[a-zA-Z0-9_]+$')][string]$ProductionDatabase = "synapse",
    [switch]$Cleanup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-DockerChecked {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $output = & docker @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed: $($output -join [Environment]::NewLine)"
    }
    return $output
}

function Invoke-DockerInputChecked {
    param(
        [Parameter(Mandatory)][string[]]$Arguments,
        [Parameter(Mandatory)][string]$InputText
    )

    $output = $InputText | & docker @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed: $($output -join [Environment]::NewLine)"
    }
    return $output
}

if ([string]::Equals($TemporaryDatabase, $ProductionDatabase, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to restore into the production database name."
}
if ($TemporaryDatabase -notmatch '^synapse_restore_check_[a-zA-Z0-9_]+$') {
    throw "TemporaryDatabase must start with synapse_restore_check_."
}
if (-not [IO.Path]::IsPathRooted($BackupFile)) {
    throw "BackupFile must be an absolute path."
}

$resolvedBackup = [IO.Path]::GetFullPath($BackupFile)
if (-not (Test-Path -LiteralPath $resolvedBackup -PathType Leaf)) {
    throw "Backup file does not exist: $resolvedBackup"
}
if ([IO.Path]::GetExtension($resolvedBackup) -ne ".dump") {
    throw "Backup file must use the .dump extension."
}

$manifestPath = "$resolvedBackup.backup-manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Backup manifest does not exist: $manifestPath"
}

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedBackup).Hash.ToLowerInvariant()
if ($actualHash -ne [string]$manifest.sha256) {
    throw "Backup checksum does not match its manifest."
}

$exists = Invoke-DockerInputChecked -Arguments @(
    "exec", "-i", $PostgresContainer,
    "psql", "-U", $DatabaseUser, "-d", "postgres", "-tA", "--no-psqlrc", "--set", "ON_ERROR_STOP=1"
) -InputText (
    "SELECT 1 FROM pg_database WHERE datname = '$TemporaryDatabase';"
)
if (($exists -join "").Trim() -eq "1") {
    throw "Temporary restore database already exists; choose a new explicit name."
}

$containerDumpPath = "/tmp/$([IO.Path]::GetFileName($resolvedBackup))"
$databaseCreated = $false
$containerDumpCopied = $false
try {
    Invoke-DockerChecked -Arguments @("exec", $PostgresContainer, "createdb", "-U", $DatabaseUser, $TemporaryDatabase) | Out-Null
    $databaseCreated = $true
    Invoke-DockerChecked -Arguments @("cp", $resolvedBackup, "${PostgresContainer}:$containerDumpPath") | Out-Null
    $containerDumpCopied = $true
    Invoke-DockerChecked -Arguments @(
        "exec", $PostgresContainer,
        "pg_restore", "-U", $DatabaseUser, "-d", $TemporaryDatabase, "--no-owner", $containerDumpPath
    ) | Out-Null

    $psqlArguments = @(
        "exec", "-i", $PostgresContainer,
        "psql", "-U", $DatabaseUser, "-d", $TemporaryDatabase, "-tA", "--no-psqlrc", "--set", "ON_ERROR_STOP=1"
    )
    $countsJson = Invoke-DockerInputChecked -Arguments $psqlArguments -InputText @'
SELECT json_build_object(
    'users', (SELECT count(*) FROM users),
    'projects', (SELECT count(*) FROM projects),
    'articles', (SELECT count(*) FROM articles)
)::text;
'@
    $orphansJson = Invoke-DockerInputChecked -Arguments $psqlArguments -InputText @'
SELECT json_build_object(
    'projectsWithoutOwner', (
        SELECT count(*) FROM projects p
        LEFT JOIN users u ON u.id = p."ownerId"
        WHERE u.id IS NULL
    ),
    'articlesWithoutOwner', (
        SELECT count(*) FROM articles a
        LEFT JOIN users u ON u.id = a."ownerId"
        WHERE u.id IS NULL
    ),
    'articlesWithoutProject', (
        SELECT count(*) FROM articles a
        LEFT JOIN projects p ON p.id = a."projectId"
        WHERE p.id IS NULL
    )
)::text;
'@

    $orphans = (($orphansJson -join "").Trim() | ConvertFrom-Json)
    if ($orphans.projectsWithoutOwner -ne 0 -or $orphans.articlesWithoutOwner -ne 0 -or $orphans.articlesWithoutProject -ne 0) {
        throw "Restore integrity check found orphaned ownership references."
    }

    $reportPath = "$resolvedBackup.$TemporaryDatabase.restore-report.json"
    $report = [ordered]@{
        verifiedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        backupFile = [IO.Path]::GetFileName($resolvedBackup)
        sha256 = $actualHash
        temporaryDatabase = $TemporaryDatabase
        rowCounts = (($countsJson -join "").Trim() | ConvertFrom-Json)
        orphanCounts = $orphans
        cleanedUp = [bool]$Cleanup
    }
    $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8
} finally {
    if ($containerDumpCopied) {
        & docker exec $PostgresContainer rm -f $containerDumpPath 2>&1 | Out-Null
    }
    if ($Cleanup -and $databaseCreated) {
        & docker exec $PostgresContainer dropdb -U $DatabaseUser --if-exists $TemporaryDatabase 2>&1 | Out-Null
    }
}

Write-Host "Backup restore verified: $reportPath"
