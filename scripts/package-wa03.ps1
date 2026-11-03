$ErrorActionPreference = 'Stop'

# Resolve the repository from this script location; do not depend on one
# developer's absolute Windows path.
$repoRoot = Split-Path -Parent $PSScriptRoot
$policyDirectory = Join-Path $repoRoot 'guardian-policies\WA03.001'
$policy = Join-Path $repoRoot 'guardian-policies\RupayKg-WA03.001-v1.policy'
$zip = "$policy.zip"

if (-not (Test-Path -LiteralPath (Join-Path $policyDirectory 'policy.json'))) {
    throw "Guardian policy source not found: $policyDirectory"
}

Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $policy -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $policyDirectory '*') -DestinationPath $zip -Force
Move-Item -LiteralPath $zip -Destination $policy -Force
Get-Item -LiteralPath $policy | Select-Object FullName, Length
