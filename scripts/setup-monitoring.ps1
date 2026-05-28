# Script de configuración para el módulo de monitoreo de AWS
# PowerShell Script para Windows

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Setup del Módulo de Monitoreo AWS" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que Node.js está instalado
Write-Host "Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js instalado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js no está instalado. Por favor instálalo primero." -ForegroundColor Red
    exit 1
}

# Verificar que pnpm está instalado
Write-Host "Verificando pnpm..." -ForegroundColor Yellow
try {
    $pnpmVersion = pnpm --version
    Write-Host "✓ pnpm instalado: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ pnpm no está instalado. Instalando..." -ForegroundColor Yellow
    npm install -g pnpm
}

Write-Host ""
Write-Host "Instalando dependencias..." -ForegroundColor Yellow
pnpm install

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Configuración Completada" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Green
Write-Host "1. Configura tus cuentas de AWS en el archivo .env"
Write-Host "2. Asegúrate de que las credenciales tengan los permisos necesarios"
Write-Host "3. Ejecuta 'pnpm dev' para iniciar el servidor"
Write-Host "4. Navega a http://localhost:3000/monitoring"
Write-Host ""
Write-Host "Para más información, consulta: docs/MONITORING.md" -ForegroundColor Cyan
