[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$OutputDirectory,
    [Parameter(Mandatory)][ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9_.-]+$')][string]$PostgresContainer,
    [string]$Neo4jContainer = "synapse-neo4j",
    [string]$QdrantContainer = "synapse-qdrant",
    [ValidatePattern('^[a-zA-Z0-9_]+$')][string]$Database = "synapse",
    [ValidatePattern('^[a-zA-Z0-9_]+$')][string]$DatabaseUser = "synapse",
    [switch]$ValidateOnly
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

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if (-not [IO.Path]::IsPathRooted($OutputDirectory)) {
    throw "OutputDirectory must be an absolute dedicated directory."
}

$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\', '/')
$resolvedRepository = $repositoryRoot.TrimEnd('\', '/')
if ([string]::Equals($resolvedOutput, $resolvedRepository, [StringComparison]::OrdinalIgnoreCase)) {
    throw "OutputDirectory cannot be the repository root; use an absolute dedicated directory."
}

if ($ValidateOnly) {
    Write-Host "Backup inputs are safe."
    exit 0
}

New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$dumpName = "synapse-postgres-$timestamp.dump"
$dumpPath = Join-Path $resolvedOutput $dumpName
$containerDumpPath = "/tmp/$dumpName"
$manifestPath = "$dumpPath.backup-manifest.json"

try {
    Invoke-DockerChecked -Arguments @(
        "exec", $PostgresContainer,
        "pg_dump", "-U", $DatabaseUser, "-d", $Database, "-Fc", "-f", $containerDumpPath
    ) | Out-Null
    Invoke-DockerChecked -Arguments @("cp", "${PostgresContainer}:$containerDumpPath", $dumpPath) | Out-Null
    Invoke-DockerChecked -Arguments @("exec", $PostgresContainer, "rm", "-f", $containerDumpPath) | Out-Null

    $dumpFile = Get-Item -LiteralPath $dumpPath
    if ($dumpFile.Length -le 0) {
        throw "PostgreSQL dump is empty."
    }

    $versionOutput = Invoke-DockerChecked -Arguments @(
        "exec", $PostgresContainer,
        "psql", "-U", $DatabaseUser, "-d", $Database, "-tAc", "SHOW server_version"
    )

    $runningContainers = @(& docker ps --format "{{.Names}}")
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect Docker services."
    }

    $manifest = [ordered]@{
        createdAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        database = $Database
        postgresContainer = $PostgresContainer
        postgresVersion = ($versionOutput -join "").Trim()
        dumpFile = $dumpName
        dumpSizeBytes = $dumpFile.Length
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $dumpPath).Hash.ToLowerInvariant()
        neo4j = [ordered]@{
            container = $Neo4jContainer
            running = $runningContainers -contains $Neo4jContainer
            snapshot = "not-created"
            reason = "PostgreSQL is authoritative; Neo4j state is rebuilt from relational data."
        }
        qdrant = [ordered]@{
            container = $QdrantContainer
            running = $runningContainers -contains $QdrantContainer
            snapshot = "not-created"
            reason = "PostgreSQL is authoritative; Qdrant state is rebuilt from relational data."
        }
    }

    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    Write-Host "Backup created: $dumpPath"
    Write-Host "Manifest created: $manifestPath"
} catch {
    if (Test-Path -LiteralPath $dumpPath) {
        $safeParent = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($dumpPath))
        if ([string]::Equals($safeParent.TrimEnd('\', '/'), $resolvedOutput, [StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $dumpPath -Force
        }
    }
    throw
}
