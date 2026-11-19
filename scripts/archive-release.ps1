param([Parameter(Mandatory=$true)][string]$SourceDirectory, [Parameter(Mandatory=$true)][string]$DestinationPath)
$ErrorActionPreference = 'Stop'
Compress-Archive -LiteralPath $SourceDirectory -DestinationPath $DestinationPath -CompressionLevel Optimal
