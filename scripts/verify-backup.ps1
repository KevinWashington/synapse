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
        "psql", "-U", $DatabaseUser, "-d", $TemporaryDatabase, "-tA", "--quiet", "--no-psqlrc", "--set", "ON_ERROR_STOP=1"
    )
    $countsJson = Invoke-DockerInputChecked -Arguments $psqlArguments -InputText @'
CREATE OR REPLACE FUNCTION pg_temp.safe_count(query_text text, table_names text[])
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    table_name text;
    result bigint;
BEGIN
    FOREACH table_name IN ARRAY table_names LOOP
        IF to_regclass('public.' || table_name) IS NULL THEN
            RETURN 0;
        END IF;
    END LOOP;
    EXECUTE query_text INTO result;
    RETURN result;
END;
$$;

SELECT json_build_object(
    'users', (SELECT count(*) FROM users),
    'projects', (SELECT count(*) FROM projects),
    'articles', (SELECT count(*) FROM articles),
    'project_members', pg_temp.safe_count('SELECT count(*) FROM project_members', ARRAY['project_members']),
    'project_invitations', pg_temp.safe_count('SELECT count(*) FROM project_invitations', ARRAY['project_invitations']),
    'review_assignments', pg_temp.safe_count('SELECT count(*) FROM review_assignments', ARRAY['review_assignments']),
    'review_decisions', pg_temp.safe_count('SELECT count(*) FROM review_decisions', ARRAY['review_decisions']),
    'review_conflicts', pg_temp.safe_count('SELECT count(*) FROM review_conflicts', ARRAY['review_conflicts']),
    'project_notifications', pg_temp.safe_count('SELECT count(*) FROM project_notifications', ARRAY['project_notifications']),
    'project_audit_events', pg_temp.safe_count('SELECT count(*) FROM project_audit_events', ARRAY['project_audit_events'])
)::text;
'@
    $orphansJson = Invoke-DockerInputChecked -Arguments $psqlArguments -InputText @'
CREATE OR REPLACE FUNCTION pg_temp.safe_count(query_text text, table_names text[])
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    table_name text;
    result bigint;
BEGIN
    FOREACH table_name IN ARRAY table_names LOOP
        IF to_regclass('public.' || table_name) IS NULL THEN
            RETURN 0;
        END IF;
    END LOOP;
    EXECUTE query_text INTO result;
    RETURN result;
END;
$$;

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
    ),
    'projectMembersWithoutProject', pg_temp.safe_count($query$
        SELECT count(*) FROM project_members pm
        LEFT JOIN projects p ON p.id = pm."projectId"
        WHERE p.id IS NULL
    $query$, ARRAY['project_members', 'projects']),
    'projectMembersWithoutUser', pg_temp.safe_count($query$
        SELECT count(*) FROM project_members pm
        LEFT JOIN users u ON u.id = pm."userId"
        WHERE u.id IS NULL
    $query$, ARRAY['project_members', 'users']),
    'projectMembersWithoutInviter', pg_temp.safe_count($query$
        SELECT count(*) FROM project_members pm
        LEFT JOIN users u ON u.id = pm."invitedByUserId"
        WHERE pm."invitedByUserId" IS NOT NULL AND u.id IS NULL
    $query$, ARRAY['project_members', 'users']),
    'projectInvitationsWithoutProject', pg_temp.safe_count($query$
        SELECT count(*) FROM project_invitations pi
        LEFT JOIN projects p ON p.id = pi."projectId"
        WHERE p.id IS NULL
    $query$, ARRAY['project_invitations', 'projects']),
    'projectInvitationsWithoutInviter', pg_temp.safe_count($query$
        SELECT count(*) FROM project_invitations pi
        LEFT JOIN users u ON u.id = pi."invitedByUserId"
        WHERE pi."invitedByUserId" IS NOT NULL AND u.id IS NULL
    $query$, ARRAY['project_invitations', 'users']),
    'reviewAssignmentsWithoutProject', pg_temp.safe_count($query$
        SELECT count(*) FROM review_assignments ra
        LEFT JOIN projects p ON p.id = ra."projectId"
        WHERE p.id IS NULL
    $query$, ARRAY['review_assignments', 'projects']),
    'reviewAssignmentsWithoutArticle', pg_temp.safe_count($query$
        SELECT count(*) FROM review_assignments ra
        LEFT JOIN articles a ON a.id = ra."articleId"
        WHERE a.id IS NULL
    $query$, ARRAY['review_assignments', 'articles']),
    'reviewAssignmentsWithoutReviewer', pg_temp.safe_count($query$
        SELECT count(*) FROM review_assignments ra
        LEFT JOIN users u ON u.id = ra."reviewerUserId"
        WHERE u.id IS NULL
    $query$, ARRAY['review_assignments', 'users']),
    'reviewAssignmentsWithoutAssigner', pg_temp.safe_count($query$
        SELECT count(*) FROM review_assignments ra
        LEFT JOIN users u ON u.id = ra."assignedByUserId"
        WHERE ra."assignedByUserId" IS NOT NULL AND u.id IS NULL
    $query$, ARRAY['review_assignments', 'users']),
    'reviewAssignmentsWithoutInheritedAssignment', pg_temp.safe_count($query$
        SELECT count(*) FROM review_assignments ra
        LEFT JOIN review_assignments inherited ON inherited.id = ra."inheritedFromAssignmentId"
        WHERE ra."inheritedFromAssignmentId" IS NOT NULL AND inherited.id IS NULL
    $query$, ARRAY['review_assignments']),
    'reviewDecisionsWithoutAssignment', pg_temp.safe_count($query$
        SELECT count(*) FROM review_decisions rd
        LEFT JOIN review_assignments ra ON ra.id = rd."assignmentId"
        WHERE ra.id IS NULL
    $query$, ARRAY['review_decisions', 'review_assignments']),
    'reviewDecisionsWithoutProject', pg_temp.safe_count($query$
        SELECT count(*) FROM review_decisions rd
        LEFT JOIN projects p ON p.id = rd."projectId"
        WHERE p.id IS NULL
    $query$, ARRAY['review_decisions', 'projects']),
    'reviewDecisionsWithoutArticle', pg_temp.safe_count($query$
        SELECT count(*) FROM review_decisions rd
        LEFT JOIN articles a ON a.id = rd."articleId"
        WHERE a.id IS NULL
    $query$, ARRAY['review_decisions', 'articles']),
    'reviewDecisionsWithoutReviewer', pg_temp.safe_count($query$
        SELECT count(*) FROM review_decisions rd
        LEFT JOIN users u ON u.id = rd."reviewerUserId"
        WHERE u.id IS NULL
    $query$, ARRAY['review_decisions', 'users']),
    'reviewConflictsWithoutProject', pg_temp.safe_count($query$
        SELECT count(*) FROM review_conflicts rc
        LEFT JOIN projects p ON p.id = rc."projectId"
        WHERE p.id IS NULL
    $query$, ARRAY['review_conflicts', 'projects']),
    'reviewConflictsWithoutArticle', pg_temp.safe_count($query$
        SELECT count(*) FROM review_conflicts rc
        LEFT JOIN articles a ON a.id = rc."articleId"
        WHERE a.id IS NULL
    $query$, ARRAY['review_conflicts', 'articles']),
    'reviewConflictsWithoutResolver', pg_temp.safe_count($query$
        SELECT count(*) FROM review_conflicts rc
        LEFT JOIN users u ON u.id = rc."resolvedByUserId"
        WHERE rc."resolvedByUserId" IS NOT NULL AND u.id IS NULL
    $query$, ARRAY['review_conflicts', 'users']),
    'reviewConflictsWithInvalidDecisionIds', pg_temp.safe_count($query$
        SELECT count(*) FROM review_conflicts rc
        WHERE EXISTS (
            SELECT 1
            FROM unnest(rc."decisionIds") AS conflict_decision("decisionId")
            LEFT JOIN review_decisions rd ON rd.id = conflict_decision."decisionId"
            WHERE rd.id IS NULL
               OR rd."projectId" <> rc."projectId"
               OR rd."articleId" <> rc."articleId"
               OR rd.phase <> rc.phase
        )
    $query$, ARRAY['review_conflicts', 'review_decisions']),
    'projectNotificationsWithoutProject', pg_temp.safe_count($query$
        SELECT count(*) FROM project_notifications pn
        LEFT JOIN projects p ON p.id = pn."projectId"
        WHERE p.id IS NULL
    $query$, ARRAY['project_notifications', 'projects']),
    'projectNotificationsWithoutRecipient', pg_temp.safe_count($query$
        SELECT count(*) FROM project_notifications pn
        LEFT JOIN users u ON u.id = pn."recipientUserId"
        WHERE u.id IS NULL
    $query$, ARRAY['project_notifications', 'users']),
    'projectAuditEventsWithoutProject', pg_temp.safe_count($query$
        SELECT count(*) FROM project_audit_events pae
        LEFT JOIN projects p ON p.id = pae."projectId"
        WHERE p.id IS NULL
    $query$, ARRAY['project_audit_events', 'projects']),
    'projectAuditEventsWithoutActor', pg_temp.safe_count($query$
        SELECT count(*) FROM project_audit_events pae
        LEFT JOIN users u ON u.id = pae."actorUserId"
        WHERE pae."actorUserId" IS NOT NULL AND u.id IS NULL
    $query$, ARRAY['project_audit_events', 'users'])
)::text;
'@

    $orphans = (($orphansJson -join "").Trim() | ConvertFrom-Json)
    $nonZeroOrphans = @($orphans.PSObject.Properties | Where-Object { [long]$_.Value -ne 0 })

    $reportPath = "$resolvedBackup.$TemporaryDatabase.restore-report.json"
    $report = [ordered]@{
        verifiedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        backupFile = [IO.Path]::GetFileName($resolvedBackup)
        sha256 = $actualHash
        temporaryDatabase = $TemporaryDatabase
        rowCounts = (($countsJson -join "").Trim() | ConvertFrom-Json)
        orphanCounts = $orphans
        integrityPassed = ($nonZeroOrphans.Count -eq 0)
        cleanedUp = [bool]$Cleanup
    }
    $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8

    if ($nonZeroOrphans.Count -ne 0) {
        $failedChecks = ($nonZeroOrphans.Name -join ", ")
        throw "Restore integrity check found orphaned references ($failedChecks). Report: $reportPath"
    }
} finally {
    if ($containerDumpCopied) {
        & docker exec $PostgresContainer rm -f $containerDumpPath 2>&1 | Out-Null
    }
    if ($Cleanup -and $databaseCreated) {
        & docker exec $PostgresContainer dropdb -U $DatabaseUser --if-exists $TemporaryDatabase 2>&1 | Out-Null
    }
}

Write-Host "Backup restore verified: $reportPath"
