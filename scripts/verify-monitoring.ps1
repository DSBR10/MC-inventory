# Script de verificación del módulo de monitoreo
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Verificación del Módulo de Monitoreo" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Verificar archivos críticos
$criticalFiles = @(
    "src/lib/utils.ts",
    "src/lib/aws/aws-accounts.ts",
    "src/lib/aws/cloudwatch-metrics.ts",
    "src/lib/aws/cloudwatch-logs.ts",
    "src/lib/aws/cloudtrail.ts",
    "src/app/monitoreo/components/AWSMetricsView.tsx",
    "src/app/monitoreo/components/AWSLogsView.tsx",
    "src/app/monitoreo/components/AWSDashboard.tsx",
    "src/components/ui/tabs.tsx",
    "src/app/api/monitoring/aws/accounts/route.ts",
    "src/app/api/monitoring/aws/metrics/ec2/route.ts",
    "src/app/api/monitoring/aws/metrics/rds/route.ts"
)

Write-Host "Verificando archivos críticos..." -ForegroundColor Yellow
foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file" -ForegroundColor Green
    }
    else {
        Write-Host "✗ $file - NO ENCONTRADO" -ForegroundColor Red
        $allGood = $false
    }
}

Write-Host ""
Write-Host "Verificando variables de entorno..." -ForegroundColor Yellow

if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    
    # Verificar región AWS
    if ($envContent -match "AWS_REGION=") {
        Write-Host "✓ AWS_REGION configurada" -ForegroundColor Green
    }
    else {
        Write-Host "✗ AWS_REGION no configurada" -ForegroundColor Red
        $allGood = $false
    }
    
    # Contar cuentas AWS
    $awsAccountCount = ([regex]::Matches($envContent, "AWS_ACCOUNT_\d+_NAME=")).Count
    if ($awsAccountCount -gt 0) {
        Write-Host "✓ $awsAccountCount cuentas de AWS configuradas" -ForegroundColor Green
    }
    else {
        Write-Host "✗ No hay cuentas de AWS configuradas" -ForegroundColor Red
        $allGood = $false
    }
}
else {
    Write-Host "✗ Archivo .env no encontrado" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "✓ TODAS LAS VERIFICACIONES PASARON" -ForegroundColor Green
    Write-Host ""
    Write-Host "Puedes iniciar el servidor con:" -ForegroundColor Cyan
    Write-Host "  npm run dev" -ForegroundColor White
    Write-Host ""
    Write-Host "Luego accede a:" -ForegroundColor Cyan
    Write-Host "  http://localhost:3000/monitoreo" -ForegroundColor White
}
else {
    Write-Host "✗ ALGUNAS VERIFICACIONES FALLARON" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor revisa los errores arriba" -ForegroundColor Yellow
}

Write-Host "================================================" -ForegroundColor Cyan
