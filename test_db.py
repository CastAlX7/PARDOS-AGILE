import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

# Cargar las variables de entorno desde el archivo .env
load_dotenv() 

# Obtener el URL de la BD
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ ERROR: La variable DATABASE_URL no está configurada en el archivo .env")
else:
    print("✅ URL de la Base de Datos cargada. Intentando conectar...")
    try:
        # 1. Crear el "motor" de conexión
        engine = create_engine(DATABASE_URL)
        
        # 2. Intentar conectarse y ejecutar una consulta simple
        with engine.connect() as connection:
            # Ejecutar una consulta simple para confirmar que la BD responde
            result = connection.execute(text("SELECT 1 AS connection_test"))
            
            # Verificar el resultado
            if result.scalar() == 1:
                print("\n🎉 CONEXIÓN A RAILWAY EXITOSA. La Base de Datos está activa y accesible.")
            else:
                print("\n⚠️ ADVERTENCIA: Conexión establecida, pero la consulta de prueba falló.")

    except OperationalError as e:
        print("\n❌ ERROR DE CONEXIÓN. No se pudo acceder a la Base de Datos de Railway.")
        print(f"Detalles del error (Operacional): {e}")
    except Exception as e:
        print(f"\n❌ ERROR INESPERADO: {e}")