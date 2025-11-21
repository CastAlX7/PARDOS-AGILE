"""
CONFIGURACIÓN DE LA APLICACIÓN FLASK
Contiene todas las variables de configuración necesarias

Configuraciones incluidas:
- Conexión a base de datos MySQL
- Configuración de sesiones
- Claves secretas
- Configuraciones de seguridad
"""

import os

class Config:
    """Clase de configuración principal"""
    
    # ==================== BASE DE DATOS ====================
    
    # URL de conexión a MySQL usando pymysql
    # Formato: mysql+pymysql://usuario:contraseña@host:puerto/nombre_bd
    SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root:CTHuDAaBOQOaGNcRtitnmLejUuFisYTL@caboose.proxy.rlwy.net:23054/railway'
    
    # Desactivar el sistema de seguimiento de modificaciones de SQLAlchemy
    # (consume memoria innecesaria en producción)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Mostrar consultas SQL en consola (útil para debugging)
    # Cambiar a False en producción
    SQLALCHEMY_ECHO = False
    
    # ==================== SESIONES ====================
    
    # Clave secreta para firmar las cookies de sesión
    # IMPORTANTE: Cambiar en producción por una clave aleatoria segura
    SECRET_KEY = 'pardos-chicken-secret-key-2024-change-in-production'
    
    # Configuración de cookies de sesión
    SESSION_COOKIE_SECURE = False  # Cambiar a True en producción con HTTPS
    SESSION_COOKIE_HTTPONLY = True  # Previene acceso desde JavaScript
    SESSION_COOKIE_SAMESITE = 'Lax'  # Protección CSRF
    
    # Duración de la sesión en segundos (1 hora = 3600 segundos)
    PERMANENT_SESSION_LIFETIME = 3600
    
    # ==================== CORS (Cross-Origin Resource Sharing) ====================
    
    # Headers permitidos para peticiones CORS
    CORS_HEADERS = 'Content-Type'
    
    # ==================== ZONA HORARIA ====================
    
    # Zona horaria del restaurante (Perú)
    TIMEZONE = 'America/Lima'
    
    # ==================== PAGINACIÓN ====================
    
    # Número de items por página (para futuras implementaciones)
    ITEMS_PER_PAGE = 20
    
    # ==================== ARCHIVOS ====================
    
    # Tamaño máximo de archivos subidos (16 MB)
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    
    # Carpeta para guardar archivos subidos
    UPLOAD_FOLDER = 'uploads'
    
    # Extensiones de archivo permitidas
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif'}
    
    # ==================== LOGGING ====================
    
    # Registrar logs en stdout (útil para contenedores Docker)
    LOG_TO_STDOUT = os.environ.get('LOG_TO_STDOUT', False)
    
    # ==================== MODO DE DESARROLLO ====================
    
    # Activar modo debug (desactivar en producción)
    DEBUG = True
    
    # Modo de testing
    TESTING = False
    
    # ==================== CONFIGURACIONES ADICIONALES ====================
    
    # Formato de fecha por defecto
    DATE_FORMAT = '%Y-%m-%d'
    
    # Formato de hora por defecto
    TIME_FORMAT = '%H:%M'
    
    # Moneda
    CURRENCY = 'S/'  # Soles peruanos