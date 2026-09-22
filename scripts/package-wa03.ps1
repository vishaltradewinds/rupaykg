Set-Location 'C:\Users\Vishal\Documents\GitHub\rupaykg'
$zip='guardian-policies\RupayKg-WA03.001-v1.policy.zip'
$policy='guardian-policies\RupayKg-WA03.001-v1.policy'
Remove-Item $zip,$policy -Force -ErrorAction SilentlyContinue
Compress-Archive -Path 'guardian-policies\WA03.001\*' -DestinationPath $zip -Force
Move-Item $zip $policy -Force
Get-Item $policy | Select-Object FullName,Length