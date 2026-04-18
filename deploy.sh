#!/bin/bash

# Script de Despliegue Automatizado - Sistema de Gestión de Restaurante
# Uso: ./deploy.sh [start|stop|restart|rebuild|logs|backup|status]

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funciones de utilidad
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que Docker esté instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker no está instalado. Por favor instálalo primero."
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose no está instalado. Por favor instálalo primero."
        exit 1
    fi
    
    log_info "Docker y Docker Compose están instalados ✓"
}

# Verificar archivo .env
check_env() {
    if [ ! -f .env ]; then
        log_warn "Archivo .env no encontrado. Creando uno de ejemplo..."
        cat > .env << EOF
PORT=3002
NODE_ENV=production
DB_HOST=db
DB_USER=restaurante_user
DB_PASS=restaurante_password
DB_NAME=gestion_restaurante
JWT_SECRET=secret_restaurante_prod
TZ=America/Lima
EOF
        log_warn "Por favor edita el archivo .env con tus credenciales antes de continuar."
        exit 1
    fi
    log_info "Archivo .env encontrado ✓"
}

# Iniciar servicios
start_services() {
    log_info "Iniciando servicios..."
    check_docker
    check_env
    
    docker compose up -d
    
    log_info "Esperando a que los servicios estén listos..."
    sleep 5
    
    docker compose ps
    log_info "Servicios iniciados correctamente ✓"
    log_info "Accede a la aplicación en: http://localhost:3002"
}

# Detener servicios
stop_services() {
    log_info "Deteniendo servicios..."
    docker compose down
    log_info "Servicios detenidos ✓"
}

# Reiniciar servicios
restart_services() {
    log_info "Reiniciando servicios..."
    docker compose restart
    log_info "Servicios reiniciados ✓"
}

# Reconstruir y reiniciar
rebuild_services() {
    log_info "Reconstruyendo servicios..."
    check_docker
    check_env
    
    log_info "Deteniendo servicios actuales..."
    docker compose down
    
    log_info "Construyendo nueva imagen..."
    docker compose build --no-cache
    
    log_info "Iniciando servicios..."
    docker compose up -d
    
    log_info "Servicios reconstruidos e iniciados ✓"
}

# Ver logs
view_logs() {
    log_info "Mostrando logs (Ctrl+C para salir)..."
    docker compose logs -f
}

# Crear backup de la base de datos
backup_database() {
    log_info "Creando backup de la base de datos..."
    
    BACKUP_DIR="./backups"
    mkdir -p $BACKUP_DIR
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
    
    # Obtener credenciales del .env
    DB_USER=$(grep DB_USER .env | cut -d '=' -f2)
    DB_PASS=$(grep DB_PASS .env | cut -d '=' -f2)
    DB_NAME=$(grep DB_NAME .env | cut -d '=' -f2)
    
    docker exec restaurante-db mysqldump -u$DB_USER -p$DB_PASS $DB_NAME > $BACKUP_FILE
    
    if [ $? -eq 0 ]; then
        gzip $BACKUP_FILE
        log_info "Backup creado: $BACKUP_FILE.gz ✓"
    else
        log_error "Error al crear el backup"
        exit 1
    fi
}

# Ver estado de los servicios
check_status() {
    log_info "Estado de los servicios:"
    docker compose ps
    
    echo ""
    log_info "Uso de recursos:"
    docker stats --no-stream
}

# Mostrar ayuda
show_help() {
    cat << EOF
Script de Despliegue - Sistema de Gestión de Restaurante

Uso: ./deploy.sh [comando]

Comandos disponibles:
  start       Iniciar los servicios
  stop        Detener los servicios
  restart     Reiniciar los servicios
  rebuild     Reconstruir las imágenes y reiniciar
  logs        Ver logs en tiempo real
  backup      Crear backup de la base de datos
  status      Ver estado de los servicios
  help        Mostrar esta ayuda

Ejemplos:
  ./deploy.sh start
  ./deploy.sh logs
  ./deploy.sh backup
EOF
}

# Main
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    rebuild)
        rebuild_services
        ;;
    logs)
        view_logs
        ;;
    backup)
        backup_database
        ;;
    status)
        check_status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Comando no reconocido: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
