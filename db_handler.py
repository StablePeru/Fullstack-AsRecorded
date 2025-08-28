# -*- coding: utf-8 -*-
"""
db_handler.py

Módulo para manejar la interacción con la base de datos PostgreSQL
usando la librería psycopg2.
"""
import psycopg2
import psycopg2.extras
import os
import logging
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s')

DB_NAME = os.getenv("DB_NAME", "AsRecorded_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

def get_db_connection():
    """Establece y retorna una nueva conexión a la base de datos PostgreSQL."""
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        return conn
    except psycopg2.OperationalError as e:
        logging.error(f"Error al conectar a la base de datos: {e}")
        raise

def initialize_database():
    """
    Ejecuta el script schema.sql para (re)crear la estructura de la base de datos.
    """
    conn = None
    try:
        # Conectamos a la BD por defecto 'postgres' para poder dropear nuestra BD de la app si es necesario.
        # En Docker, la BD se crea al inicio, así que solo necesitamos aplicar el schema.
        conn = get_db_connection()
        cursor = conn.cursor()
        
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
        
        if not os.path.exists(schema_path):
            logging.error(f"El archivo schema.sql no se encontró en la ruta: {schema_path}")
            return
            
        logging.info("Aplicando el esquema de la base de datos desde schema.sql...")
        with open(schema_path, 'r', encoding='utf-8') as f:
            sql_script = f.read()
            cursor.execute(sql_script)
        
        conn.commit()
        logging.info("¡Esquema de la base de datos aplicado correctamente!")
        
    except (Exception, psycopg2.DatabaseError) as error:
        logging.error(f"Error al inicializar la base de datos: {error}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()


def execute_query(query, params=None, fetch_mode="all"):
    """
    Ejecuta una consulta SQL, manejando la conexión, cursor y transacciones.
    """
    conn = None
    try:
        conn = get_db_connection()
        # Usar RealDictCursor para obtener resultados como diccionarios
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute(query, params)
        
        results = None
        if fetch_mode == "all":
            results = cursor.fetchall()
        elif fetch_mode == "one":
            results = cursor.fetchone()
        elif fetch_mode == "none":
            results = cursor.rowcount # Devuelve filas afectadas para INSERT/UPDATE/DELETE
        else:
            raise ValueError(f"Modo de fetch no válido: {fetch_mode}")
            
        conn.commit()
        return results

    except (Exception, psycopg2.DatabaseError) as error:
        logging.error(f"Error ejecutando la consulta: {error}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

# --- Funciones de Auditoría ---
def audit_log(entidad, entidad_id, usuario_id, accion, payload=None):
    """Inserta un registro en la tabla de auditoría."""
    query = """
        INSERT INTO "Auditoria" (entidad, entidad_id, usuario_id, accion, payload)
        VALUES (%s, %s, %s, %s, %s);
    """
    # Convertir payload a JSON si es un dict
    payload_json = json.dumps(payload) if payload else None
    params = (entidad, entidad_id, usuario_id, accion, payload_json)
    
    try:
        execute_query(query, params, fetch_mode="none")
        logging.info(f"AUDIT: User {usuario_id} | Action '{accion}' on {entidad} ID {entidad_id}")
    except Exception as e:
        logging.error(f"Fallo al escribir en log de auditoría: {e}")


if __name__ == '__main__':
    print("Ejecutando inicializador de base de datos...")
    initialize_database()
    print("Proceso finalizado.")