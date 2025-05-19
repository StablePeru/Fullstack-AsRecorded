# -*- coding: utf-8 -*- # Especifica la codificación UTF-8, bueno para caracteres especiales

"""
db_handler.py

Módulo para manejar la interacción con la base de datos PostgreSQL
usando la librería psycopg2.
"""

# --- Importaciones ---
import psycopg2
import psycopg2.extras # Para obtener resultados como diccionarios (opcional pero útil)
import os # Para leer credenciales de forma segura desde variables de entorno
import logging # Para un mejor registro de errores
import json # Para trabajar con JSONB

# --- Configuración del Logging ---
# Configura un logger básico para registrar errores o información
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s')

# --- Configuración de la Conexión a la Base de Datos ---
DB_NAME = os.getenv("DB_NAME", "AsRecorded_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

# --- Funciones Principales ---

def get_db_connection():
    """
    Establece y retorna una nueva conexión a la base de datos PostgreSQL.
    """
    conn = None
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        # logging.info(f"Conexión exitosa a la base de datos '{DB_NAME}' en {DB_HOST}:{DB_PORT}") # Reducir verbosidad
        return conn
    except psycopg2.OperationalError as e:
        logging.error(f"Error al conectar a la base de datos: {e}")
        raise Exception(f"No se pudo conectar a la base de datos: {e}") from e
    except Exception as e:
        logging.error(f"Error inesperado durante la conexión a la BD: {e}")
        raise Exception(f"Error inesperado de conexión: {e}") from e


def execute_query(query, params=None, fetch_mode="all"):
    """
    Ejecuta una consulta SQL en la base de datos. Maneja la conexión,
    el cursor, la ejecución, el commit/rollback y el cierre.
    """
    conn = None
    cursor = None
    results = None
    rowcount = -1

    try:
        conn = get_db_connection()
        # Usar RealDictCursor para obtener resultados como diccionarios
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Loguear la query con parámetros (con cuidado en producción por datos sensibles)
        logging.debug(f"Ejecutando Query: {cursor.mogrify(query, params).decode('utf-8', errors='ignore')}")
        cursor.execute(query, params)
        rowcount = cursor.rowcount # Filas afectadas, útil para UPDATE/DELETE/INSERT

        if fetch_mode == "all":
            results = cursor.fetchall()
            logging.debug(f"Resultados obtenidos (fetchall): {len(results)} filas")
        elif fetch_mode == "one":
            results = cursor.fetchone()
            logging.debug(f"Resultado obtenido (fetchone): {'Encontrado' if results else 'Ninguno'}")
        elif fetch_mode == "none": # Para INSERT/UPDATE/DELETE que no devuelven filas
            results = rowcount # Devuelve el número de filas afectadas
            logging.debug(f"Query sin fetch. Filas afectadas: {rowcount}")
        else:
            raise ValueError(f"Modo de fetch no válido: {fetch_mode}")

        conn.commit()
        logging.debug("Commit ejecutado exitosamente.")

        return results

    except (Exception, psycopg2.DatabaseError) as error:
        logging.error(f"Error ejecutando la consulta: {error}")
        # Es útil loguear la query y parámetros cuando hay un error
        logging.error(f"Query original: {query}")
        logging.error(f"Parámetros: {params}")
        if conn:
            conn.rollback()
            logging.warning("Rollback ejecutado debido a error.")
        # Re-lanzar la excepción para que sea manejada por la capa superior
        raise Exception(f"Error en la base de datos: {error}") from error

    finally:
        if cursor:
            cursor.close()
            logging.debug("Cursor cerrado.")
        if conn:
            conn.close()
            logging.debug("Conexión cerrada.")


# --- Funciones de Inicialización de Esquema ---
def initialize_db_schema():
    """
    Crea tablas necesarias si no existen.
    Específicamente, la tabla IOConfiguration.
    """
    create_io_config_table_query = """
    CREATE TABLE IF NOT EXISTS IOConfiguration (
        id INTEGER PRIMARY KEY DEFAULT 1, -- Usar un ID fijo para una única fila de config
        config_data JSONB NOT NULL,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    insert_default_io_config_query = """
    INSERT INTO IOConfiguration (id, config_data)
    VALUES (1, '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
    """
    try:
        logging.info("Inicializando esquema para IOConfiguration...")
        execute_query(create_io_config_table_query, fetch_mode="none")
        execute_query(insert_default_io_config_query, fetch_mode="none")
        logging.info("Tabla IOConfiguration verificada/creada y con default si necesario.")
    except Exception as e:
        logging.error(f"Error al inicializar la tabla IOConfiguration: {e}")
        # No relanzar para permitir que la app continúe si otras tablas están bien,
        # pero la funcionalidad de I/O podría fallar.


# --- Funciones para Configuración de I/O ---
def get_io_configuration_from_db():
    """Obtiene la configuración de I/O de la base de datos."""
    query = "SELECT config_data FROM IOConfiguration WHERE id = 1;"
    try:
        result = execute_query(query, fetch_mode="one")
        if result and result.get('config_data'):
            logging.info(f"Configuración I/O leída de BD: {result['config_data']}")
            return result['config_data']
        logging.warning("No se encontró configuración I/O en BD o está vacía, usando defaults.")
        return {}
    except Exception as e:
        logging.error(f"Error al obtener configuración de I/O de la BD: {e}")
        return {}

def save_io_configuration_to_db(config_dict):
    """Guarda o actualiza la configuración de I/O en la base de datos."""
    query = """
        INSERT INTO IOConfiguration (id, config_data, last_updated)
        VALUES (1, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
            config_data = EXCLUDED.config_data,
            last_updated = CURRENT_TIMESTAMP
        RETURNING id;
    """
    try:
        # Asegúrate de que config_dict es serializable a JSON
        params = (json.dumps(config_dict),)
        result = execute_query(query, params, fetch_mode="one")
        if result:
            logging.info("Configuración de I/O guardada en la BD.")
            return True
        return False
    except Exception as e:
        logging.error(f"Error al guardar configuración de I/O en la BD: {e}")
        return False

# --- Funciones Específicas (Existentes) ---
# ... (resto de tus funciones: get_all_character_names, add_new_serie, etc. se mantienen igual) ...
# ... (asegúrate de que las funciones existentes están aquí) ...
def get_all_character_names():
    """Obtiene una lista de todos los nombres de personajes únicos."""
    query = "SELECT DISTINCT nombre_personaje FROM Personajes ORDER BY nombre_personaje;"
    try:
        results = execute_query(query, fetch_mode="all")
        return [row['nombre_personaje'] for row in results]
    except Exception as e:
        logging.error(f"Error al obtener nombres de personajes: {e}")
        return []

def add_new_serie(numero_referencia, nombre_serie):
    """Inserta una nueva serie en la base de datos."""
    query = """
        INSERT INTO Series (numero_referencia, nombre_serie)
        VALUES (%s, %s)
        RETURNING id;
    """
    params = (numero_referencia, nombre_serie)
    try:
        result = execute_query(query, params, fetch_mode="one")
        if result and 'id' in result:
            new_id = result['id']
            logging.info(f"Nueva serie añadida con ID: {new_id}, Ref: {numero_referencia}")
            return new_id
        else:
            logging.error(f"No se pudo obtener el ID para la nueva serie: Ref {numero_referencia}")
            return None
    except psycopg2.errors.UniqueViolation:
        logging.warning(f"Error al añadir serie: El número de referencia '{numero_referencia}' o el nombre '{nombre_serie}' ya existen.")
        return None 
    except Exception as e:
        logging.error(f"Error inesperado al añadir serie (Ref: {numero_referencia}): {e}")
        return None

def delete_serie_by_id(serie_id):
    query = "DELETE FROM Series WHERE id = %s;"
    params = (serie_id,)
    try:
        affected_rows = execute_query(query, params, fetch_mode="none")
        if affected_rows > 0:
            logging.info(f"Serie ID {serie_id} eliminada exitosamente (y datos asociados en cascada).")
            return True
        else:
            logging.warning(f"No se encontró la serie ID {serie_id} para eliminar.")
            return False
    except Exception as e:
        logging.error(f"Error al eliminar la serie ID {serie_id}: {e}")
        return False

def get_interventions_for_take(take_id):
    query = """
        SELECT i.id, i.dialogo, i.completo, i.tc_in, i.tc_out, i.orden_en_take,
               p.nombre_personaje, i.completado_por_user_id, i.completado_en,
               u.nombre as completado_por_nombre_usuario
        FROM Intervenciones i
        JOIN Personajes p ON i.personaje_id = p.id
        LEFT JOIN Usuarios u ON i.completado_por_user_id = u.id 
        WHERE i.take_id = %s
        ORDER BY i.orden_en_take, i.id;
    """
    params = (take_id,)
    try:
        return execute_query(query, params, fetch_mode="all")
    except Exception as e:
        logging.error(f"Error al obtener intervenciones para take {take_id}: {e}")
        return []

def update_intervention_dialogue(intervention_id, new_dialogue):
    query = "UPDATE Intervenciones SET dialogo = %s WHERE id = %s;"
    params = (new_dialogue, intervention_id)
    try:
        affected_rows = execute_query(query, params, fetch_mode="none")
        if affected_rows > 0:
            logging.info(f"Diálogo actualizado para intervención ID: {intervention_id}")
            return True
        logging.warning(f"No se actualizó el diálogo para intervención ID {intervention_id}, ¿existe?")
        return False
    except Exception as e:
        logging.error(f"Error al actualizar diálogo para ID {intervention_id}: {e}")
        return False

def update_intervention_status(intervention_id: int, status: bool, user_id: int):
    query = """
        UPDATE Intervenciones
        SET completo = %s,
            completado_por_user_id = CASE WHEN %s THEN %s ELSE NULL END,
            completado_en = CASE WHEN %s THEN NOW() ELSE NULL END
        WHERE id = %s
        RETURNING id;
    """
    params = (status, status, user_id, status, intervention_id)
    try:
        result = execute_query(query, params, fetch_mode="one")
        if result: 
            logging.info(f"Estado 'completo' actualizado a {status} para intervención ID: {intervention_id} por usuario ID: {user_id if status else 'N/A'}")
            return True
        else:
            logging.warning(f"No se encontró intervención ID {intervention_id} para actualizar estado.")
            return False
    except Exception as e:
        logging.error(f"Error al actualizar estado para ID {intervention_id} (usuario {user_id}): {e}")
        return False

def _find_or_create_serie(cursor, numero_referencia, nombre_serie):
    logging.debug(f"Buscando/Creando serie Ref: {numero_referencia}, Nombre: {nombre_serie}")
    query_select = "SELECT id FROM Series WHERE numero_referencia = %s;"
    cursor.execute(query_select, (numero_referencia,))
    result = cursor.fetchone()

    if result:
        serie_id = result['id']
        logging.info(f"Serie encontrada por referencia {numero_referencia} -> ID: {serie_id}")
        return serie_id
    else:
        logging.info(f"Serie no encontrada por referencia. Creando nueva serie: Ref={numero_referencia}, Nombre='{nombre_serie}'")
        query_insert = """
            INSERT INTO Series (numero_referencia, nombre_serie)
            VALUES (%s, %s) RETURNING id;
        """
        try:
            cursor.execute(query_insert, (numero_referencia, nombre_serie))
            new_result = cursor.fetchone()
            if new_result:
                serie_id = new_result['id']
                logging.info(f"Nueva serie creada con ID: {serie_id}")
                return serie_id
            else:
                raise Exception("No se pudo obtener el ID de la serie recién insertada.")
        except psycopg2.Error as e: 
            logging.error(f"Error de base de datos al insertar nueva serie: {e}")
            raise e 

def _find_or_create_chapter(cursor, serie_id, numero_capitulo):
    logging.debug(f"Buscando/Creando capítulo {numero_capitulo} para serie ID {serie_id}")
    query_select = "SELECT id FROM Capitulos WHERE serie_id = %s AND numero_capitulo = %s;"
    cursor.execute(query_select, (serie_id, numero_capitulo))
    result = cursor.fetchone()

    if result:
        capitulo_id = result['id']
        logging.warning(f"Capítulo {numero_capitulo} (ID: {capitulo_id}) ya existe para Serie ID {serie_id}. Borrando Takes e Intervenciones asociados para re-importar...")
        try:
            cursor.execute("DELETE FROM Intervenciones WHERE take_id IN (SELECT id FROM Takes WHERE capitulo_id = %s);", (capitulo_id,))
            logging.info(f"Intervenciones antiguas borradas para capítulo {capitulo_id}. Afectadas: {cursor.rowcount}")
            cursor.execute("DELETE FROM Takes WHERE capitulo_id = %s;", (capitulo_id,))
            logging.info(f"Takes antiguos borrados para capítulo {capitulo_id}. Afectadas: {cursor.rowcount}")
            return capitulo_id
        except psycopg2.Error as e:
            logging.error(f"Error al borrar datos antiguos del capítulo {capitulo_id}: {e}")
            raise e 
    else:
        logging.info(f"Creando nuevo capítulo {numero_capitulo} para Serie ID {serie_id}")
        query_insert = """
            INSERT INTO Capitulos (serie_id, numero_capitulo, titulo_capitulo)
            VALUES (%s, %s, %s) RETURNING id;
        """
        titulo_placeholder = f"Capítulo {numero_capitulo}" 
        try:
            cursor.execute(query_insert, (serie_id, numero_capitulo, titulo_placeholder))
            new_result = cursor.fetchone()
            if new_result:
                capitulo_id = new_result['id']
                logging.info(f"Capítulo {numero_capitulo} creado con ID: {capitulo_id}")
                return capitulo_id
            else:
                raise Exception("No se pudo obtener el ID del capítulo recién insertado.")
        except psycopg2.Error as e:
            logging.error(f"Error de base de datos al insertar nuevo capítulo: {e}")
            raise e

def get_takes_and_interventions_for_chapter(capitulo_id):
    takes_query = """
        SELECT id, numero_take, tc_in, tc_out
        FROM Takes
        WHERE capitulo_id = %s
        ORDER BY numero_take, id;
    """
    takes_params = (capitulo_id,)

    interv_query = """
        SELECT i.id, i.take_id, i.dialogo, i.completo, i.tc_in, i.tc_out,
               i.orden_en_take, p.nombre_personaje,
               i.completado_por_user_id, i.completado_en, u.nombre as completado_por_nombre_usuario
        FROM Intervenciones i
        JOIN Personajes p ON i.personaje_id = p.id
        LEFT JOIN Usuarios u ON i.completado_por_user_id = u.id
        WHERE i.take_id IN (SELECT id FROM Takes WHERE capitulo_id = %s)
        ORDER BY i.take_id, i.orden_en_take, i.id;
    """
    interv_params = (capitulo_id,)

    takes = []
    intervenciones_map = {} 

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        logging.debug(f"Ejecutando query de takes para capítulo {capitulo_id}")
        cursor.execute(takes_query, takes_params)
        takes_result = cursor.fetchall()
        logging.info(f"Recuperados {len(takes_result)} takes para capítulo {capitulo_id}")

        if not takes_result: 
            return []

        logging.debug(f"Ejecutando query de intervenciones para capítulo {capitulo_id}")
        cursor.execute(interv_query, interv_params)
        interv_result = cursor.fetchall()
        logging.info(f"Recuperadas {len(interv_result)} intervenciones para capítulo {capitulo_id}")

        for interv in interv_result:
            take_id = interv['take_id']
            if take_id not in intervenciones_map:
                intervenciones_map[take_id] = []
            interv['personaje'] = interv.pop('nombre_personaje')
            intervenciones_map[take_id].append(interv)

        for take_dict in takes_result: 
            take_id_current = take_dict['id']
            take_dict['intervenciones'] = intervenciones_map.get(take_id_current, [])
            takes.append(take_dict)

        return takes

    except (Exception, psycopg2.DatabaseError) as error:
        logging.error(f"Error obteniendo takes e intervenciones para capítulo {capitulo_id}: {error}")
        raise Exception(f"Error DB obteniendo datos de capítulo: {error}") from error
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

def get_capitulo_details(capitulo_id):
    query = "SELECT id, numero_capitulo, titulo_capitulo, serie_id FROM Capitulos WHERE id = %s;"
    try:
        return execute_query(query, (capitulo_id,), fetch_mode="one")
    except Exception as e:
        logging.error(f"Error obteniendo detalles capítulo {capitulo_id}: {e}")
        return None

def _find_or_create_personajes(cursor, personaje_names_set):
    if not personaje_names_set: 
        return {}

    logging.debug(f"Buscando/Creando {len(personaje_names_set)} personajes...")
    personajes_map = {}
    names_list_for_query = list(personaje_names_set)
    query_select = "SELECT id, nombre_personaje FROM Personajes WHERE nombre_personaje = ANY(%s);"
    cursor.execute(query_select, (names_list_for_query,)) 

    existing_personajes = cursor.fetchall()
    for p_dict in existing_personajes: 
        personajes_map[p_dict['nombre_personaje']] = p_dict['id']

    existing_names = set(personajes_map.keys())
    new_names = list(personaje_names_set - existing_names) 

    if new_names:
        logging.info(f"Creando {len(new_names)} personajes nuevos: {new_names}")
        insert_data = [(name,) for name in new_names]
        query_insert = "INSERT INTO Personajes (nombre_personaje) VALUES (%s) RETURNING id, nombre_personaje;"
        for name_tuple in insert_data:
            cursor.execute(query_insert, name_tuple)
            new_p_dict = cursor.fetchone() 
            if new_p_dict:
                personajes_map[new_p_dict['nombre_personaje']] = new_p_dict['id']
            else:
                 raise Exception(f"No se pudo obtener el ID del personaje recién insertado: {name_tuple[0]}")

    logging.info(f"Mapa de personajes listo ({len(personajes_map)} total).")
    return personajes_map

def _insert_takes(cursor, capitulo_id, takes_data):
    logging.debug(f"Insertando {len(takes_data)} takes para capítulo ID {capitulo_id}...")
    takes_map = {} 
    query_insert = """
        INSERT INTO Takes (capitulo_id, numero_take, tc_in, tc_out)
        VALUES (%s, %s, %s, %s) RETURNING id, numero_take;
    """
    for take_dict in takes_data:
        numero_take_excel = take_dict.get('Numero Take')
        if numero_take_excel is None: 
            logging.warning("Se encontró un take sin 'Numero Take' en los datos, saltando.")
            continue
        try:
            numero_take_excel = int(numero_take_excel)
        except (ValueError, TypeError):
             logging.warning(f"Valor inválido para 'Numero Take': {take_dict.get('Numero Take')}, saltando.")
             continue

        params = (
            capitulo_id,
            numero_take_excel,
            take_dict.get('TAKE IN'), 
            take_dict.get('TAKE OUT') 
        )
        cursor.execute(query_insert, params)
        new_take_dict = cursor.fetchone() 
        if new_take_dict:
            takes_map[numero_take_excel] = new_take_dict['id']
        else:
            raise Exception(f"No se pudo obtener el ID del take recién insertado: Num={numero_take_excel}")

    logging.info(f"Mapa de takes listo ({len(takes_map)} insertados/mapeados).")
    return takes_map

def _insert_intervenciones(cursor, takes_map, personajes_map, intervenciones_data):
    logging.debug(f"Preparando {len(intervenciones_data)} intervenciones para inserción...")
    insert_data_list = [] 
    skipped_count = 0
    orden_counter = {} 

    for index, interv_dict in enumerate(intervenciones_data):
        numero_take_excel = interv_dict.get('Numero Take')
        personaje_nombre = interv_dict.get('Personaje')
        dialogo = interv_dict.get('Dialogo') 
        excel_id_orden = interv_dict.get('ID', index + 1) 

        if numero_take_excel is None:
            logging.warning(f"Intervención (Excel ID/Orden: {excel_id_orden}) sin 'Numero Take', saltando.")
            skipped_count += 1
            continue
        try: numero_take_excel = int(numero_take_excel)
        except (ValueError, TypeError):
             logging.warning(f"Intervención (Excel ID/Orden: {excel_id_orden}) con 'Numero Take' inválido '{interv_dict.get('Numero Take')}', saltando.")
             skipped_count += 1
             continue

        take_id = takes_map.get(numero_take_excel)
        if take_id is None:
            logging.warning(f"No se encontró take_id mapeado para 'Numero Take' {numero_take_excel} (Intervención Excel ID/Orden: {excel_id_orden}), saltando.")
            skipped_count += 1
            continue

        if not personaje_nombre or not str(personaje_nombre).strip(): 
             logging.warning(f"Intervención (Excel ID/Orden: {excel_id_orden}, Take BD ID: {take_id}) sin 'Personaje' o vacío, saltando.")
             skipped_count += 1
             continue
        personaje_nombre_str = str(personaje_nombre).strip() 
        personaje_id = personajes_map.get(personaje_nombre_str)
        if personaje_id is None:
             logging.error(f"PERSONAJE '{personaje_nombre_str}' NO MAPEADO (Intervención Excel ID/Orden: {excel_id_orden}, Take BD ID: {take_id}) - ¡ERROR INESPERADO! Saltando.")
             skipped_count += 1
             continue
        
        dialogo_str = str(dialogo).strip() if dialogo is not None else ""
        current_order = orden_counter.get(take_id, 0) 
        orden_en_take = current_order
        orden_counter[take_id] = current_order + 1 
        completo = False 
        tc_in = interv_dict.get('TC IN') 
        tc_out = interv_dict.get('TC OUT') 

        insert_data_list.append((
            take_id,
            personaje_id,
            dialogo_str,
            completo,
            tc_in, 
            tc_out, 
            orden_en_take 
        ))

    if skipped_count > 0:
         logging.warning(f"Se saltaron {skipped_count} intervenciones durante la preparación debido a datos faltantes o inválidos.")

    if not insert_data_list: 
         logging.warning("No hay datos de intervenciones válidos para insertar.")
         return 0 

    query_insert = """
        INSERT INTO Intervenciones (take_id, personaje_id, dialogo, completo, tc_in, tc_out, orden_en_take)
        VALUES (%s, %s, %s, %s, %s, %s, %s);
    """
    try:
        logging.info(f"Intentando insertar {len(insert_data_list)} intervenciones...")
        cursor.executemany(query_insert, insert_data_list)
        inserted_count = cursor.rowcount 
        logging.info(f"Ejecución de inserción completada. Filas afectadas según cursor.rowcount: {inserted_count}")
        if inserted_count != len(insert_data_list):
             logging.warning(f"El número de filas insertadas ({inserted_count}) no coincide con los datos preparados ({len(insert_data_list)}). Revisar posibles problemas o configuración del driver.")
        return inserted_count
    except psycopg2.Error as e:
        logging.exception(f"Error durante executemany para insertar intervenciones: {e}")
        raise e 

def import_full_chapter(serie_ref, serie_name, numero_capitulo, takes_data, intervenciones_data):
    conn = None
    cursor = None
    required_tx_cols = ['Numero Take'] 
    required_int_cols = ['Numero Take', 'Personaje', 'Dialogo'] 

    if not takes_data:
        return False, "No se encontraron datos en la hoja 'Takes' o la lista de takes está vacía."
    if not isinstance(takes_data, list) or not all(isinstance(item, dict) for item in takes_data):
        return False, "El formato de 'takes_data' es incorrecto. Debe ser una lista de diccionarios."
    if not all(col in takes_data[0] for col in required_tx_cols): 
        missing = [col for col in required_tx_cols if col not in takes_data[0]]
        return False, f"Faltan columnas requeridas en 'Takes': {', '.join(missing)}"

    if not intervenciones_data:
         return False, "No se encontraron datos en la hoja 'Intervenciones' o la lista de intervenciones está vacía."
    if not isinstance(intervenciones_data, list) or not all(isinstance(item, dict) for item in intervenciones_data):
        return False, "El formato de 'intervenciones_data' es incorrecto. Debe ser una lista de diccionarios."
    if not all(col in intervenciones_data[0] for col in required_int_cols): 
        missing = [col for col in required_int_cols if col not in intervenciones_data[0]]
        return False, f"Faltan columnas requeridas en 'Intervenciones': {', '.join(missing)}"

    logging.info(f"Iniciando transacción para importar capítulo {numero_capitulo} (Serie Ref: {serie_ref})...")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) 

        serie_id = _find_or_create_serie(cursor, serie_ref, serie_name)
        if serie_id is None: 
             raise Exception(f"No se pudo encontrar o crear la serie (Ref: {serie_ref}).")

        capitulo_id = _find_or_create_chapter(cursor, serie_id, numero_capitulo)
        if capitulo_id is None:
            raise Exception(f"No se pudo encontrar o crear el capítulo {numero_capitulo}.")

        personaje_names = set(str(i['Personaje']).strip() for i in intervenciones_data if i.get('Personaje') and str(i['Personaje']).strip())
        if not personaje_names:
             logging.warning("No se encontraron nombres de personaje válidos en 'Intervenciones'. No se crearán/mapearán personajes.")
             personajes_map = {}
        else:
            personajes_map = _find_or_create_personajes(cursor, personaje_names)
            if personajes_map is None: 
                 raise Exception("Error al procesar personajes.")

        takes_map = _insert_takes(cursor, capitulo_id, takes_data)
        if takes_map is None: 
             raise Exception("Error al insertar takes.")
        if not takes_map and takes_data: 
             logging.warning("No se insertaron takes, aunque había datos. Verifique los datos de la hoja 'Takes'.")
        elif not takes_map and not takes_data:
             logging.info("No había datos de takes para insertar.")

        inserted_interv_count = 0
        if intervenciones_data and takes_map and personajes_map is not None: 
            inserted_interv_count = _insert_intervenciones(cursor, takes_map, personajes_map, intervenciones_data)
            logging.info(f"Proceso de inserción de intervenciones finalizado. Insertadas: {inserted_interv_count} / Preparadas: {len(intervenciones_data)}")
        elif not intervenciones_data:
            logging.info("No había datos de intervenciones para insertar.")
        else:
            logging.warning("No se insertaron intervenciones debido a falta de takes mapeados o error en personajes.")

        conn.commit()
        message = (f"Importación completada. Serie ID: {serie_id}, Capítulo ID: {capitulo_id}. "
                   f"{len(takes_map) if takes_map else 0} Takes insertados/mapeados, {inserted_interv_count} Intervenciones insertadas.")
        logging.info(message)
        return True, message

    except (Exception, psycopg2.DatabaseError) as error:
        logging.exception(f"Error CRÍTICO durante la transacción de importación (Capítulo {numero_capitulo}, Serie Ref {serie_ref}):")
        if conn:
            conn.rollback() 
            logging.warning("ROLLBACK ejecutado debido a error en importación.")
        error_msg = f"Error durante la importación: {str(error)}"
        if isinstance(error, psycopg2.IntegrityError):
            error_msg = f"Error de integridad de datos durante la importación (ej. duplicado, FK no válida): {str(error)}"
        return False, error_msg

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logging.info(f"Conexión de importación cerrada para capítulo {numero_capitulo} (Serie Ref {serie_ref}).")

def get_serie_by_id(serie_id):
    query = "SELECT id, numero_referencia, nombre_serie FROM Series WHERE id = %s;"
    params = (serie_id,)
    try:
        serie = execute_query(query, params, fetch_mode="one")
        if serie:
            logging.info(f"Detalles recuperados para serie ID: {serie_id}")
        else:
            logging.warning(f"No se encontró serie con ID: {serie_id} en get_serie_by_id.")
        return serie 
    except Exception as e:
        logging.error(f"Error en get_serie_by_id({serie_id}): {e}")
        return None

def add_user(nombre, password_hash, rol='tecnico'): 
    query = """
        INSERT INTO Usuarios (nombre, password_hash, rol)
        VALUES (%s, %s, %s)
        RETURNING id;
    """
    params = (nombre, password_hash, rol)
    try:
        result = execute_query(query, params, fetch_mode="one")
        if result and 'id' in result:
            new_user_id = result['id']
            logging.info(f"Usuario '{nombre}' (Rol: {rol}) añadido con ID: {new_user_id}")
            return new_user_id
        else:
            logging.error(f"No se pudo obtener el ID para el nuevo usuario: {nombre}")
            return None
    except psycopg2.errors.UniqueViolation: 
        logging.warning(f"Error al añadir usuario: El nombre '{nombre}' ya existe.")
        return None
    except psycopg2.errors.CheckViolation: 
        logging.warning(f"Error al añadir usuario '{nombre}': Rol '{rol}' inválido.")
        return None
    except Exception as e:
        logging.error(f"Error inesperado al añadir usuario '{nombre}': {e}")
        return None

def get_user_by_name(nombre):
    query = "SELECT id, nombre, password_hash, rol FROM Usuarios WHERE nombre = %s;"
    params = (nombre,)
    try:
        user_data = execute_query(query, params, fetch_mode="one")
        if user_data:
            logging.info(f"Usuario encontrado: {user_data['nombre']} (ID: {user_data['id']}, Rol: {user_data['rol']})")
        else:
            logging.info(f"Usuario '{nombre}' no encontrado.")
        return user_data 
    except Exception as e:
        logging.error(f"Error al buscar usuario '{nombre}': {e}")
        return None

def list_all_users(search_term=None, sort_by='nombre', sort_order='ASC'):
    allowed_sort_columns = ['id', 'nombre', 'rol', 'fecha_creacion', 'fecha_actualizacion']
    if sort_by not in allowed_sort_columns:
        logging.warning(f"Intento de ordenar por columna no permitida: {sort_by}. Usando 'nombre' por defecto.")
        sort_by = 'nombre'

    if sort_order.upper() not in ['ASC', 'DESC']:
        logging.warning(f"Orden de clasificación no válido: {sort_order}. Usando 'ASC' por defecto.")
        sort_order = 'ASC'

    base_query = "SELECT id, nombre, rol, fecha_creacion, fecha_actualizacion FROM Usuarios"
    params = []
    where_clauses = []

    if search_term:
        where_clauses.append("nombre ILIKE %s")
        params.append(f"%{search_term}%")

    if where_clauses:
        base_query += " WHERE " + " AND ".join(where_clauses)
    
    query = f"{base_query} ORDER BY {sort_by} {sort_order.upper()};"

    try:
        users = execute_query(query, tuple(params) if params else None, fetch_mode="all")
        logging.info(f"Recuperados {len(users)} usuarios (search: '{search_term}', sort: {sort_by} {sort_order}).")
        return users
    except Exception as e:
        logging.error(f"Error al listar usuarios (search: '{search_term}', sort: {sort_by} {sort_order}): {e}")
        return []

def update_user_role(user_id, new_role):
    query = "UPDATE Usuarios SET rol = %s, fecha_actualizacion = NOW() WHERE id = %s RETURNING id, rol;"
    params = (new_role, user_id)
    try:
        result = execute_query(query, params, fetch_mode="one")
        if result:
            logging.info(f"Rol actualizado para usuario ID {user_id} a '{new_role}'.")
            return True
        else:
            logging.warning(f"No se encontró usuario ID {user_id} para actualizar rol.")
            return False
    except psycopg2.errors.CheckViolation: 
        logging.warning(f"Error al actualizar rol para usuario ID {user_id}: Rol '{new_role}' inválido según la BD.")
        return False
    except Exception as e:
        logging.error(f"Error al actualizar rol para usuario ID {user_id}: {e}")
        return False

def get_single_chapter_data_for_export(capitulo_id: int):
    """
    Obtiene todos los datos necesarios para exportar un solo capítulo,
    incluyendo información de la serie, capítulo, takes e intervenciones.
    Devuelve un diccionario estructurado similar a como lo hace get_series_data_for_export
    pero solo para el capítulo especificado.
    """
    conn = None
    cursor = None
    # La estructura de export_data será: { serie_id: { serie_info: {}, capitulos_data: { capitulo_id: { ... } } } }
    # Aunque solo habrá un capítulo, mantenemos una estructura similar para reutilizar lógica.
    export_data = {}

    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Obtener detalles del capítulo y su serie
        query_cap_serie = """
            SELECT
                c.id AS capitulo_id, c.numero_capitulo, c.titulo_capitulo,
                s.id AS serie_id, s.numero_referencia, s.nombre_serie
            FROM Capitulos c
            JOIN Series s ON c.serie_id = s.id
            WHERE c.id = %s;
        """
        cursor.execute(query_cap_serie, (capitulo_id,))
        cap_serie_info = cursor.fetchone()

        if not cap_serie_info:
            logging.warning(f"No se encontró el capítulo ID {capitulo_id} para exportar.")
            return None # Indicar que el capítulo no fue encontrado

        serie_id = cap_serie_info['serie_id']
        # Construir la estructura base para este capítulo
        export_data[serie_id] = {
            "serie_info": {
                "id": serie_id,
                "numero_referencia": cap_serie_info['numero_referencia'],
                "nombre_serie": cap_serie_info['nombre_serie']
            },
            "capitulos_data": {
                capitulo_id: { # Usamos el capitulo_id como clave dentro de capitulos_data
                    "capitulo_info": {
                        "id": capitulo_id,
                        "serie_id": serie_id,
                        "numero_capitulo": cap_serie_info['numero_capitulo'],
                        "titulo_capitulo": cap_serie_info['titulo_capitulo']
                    },
                    "takes_data": {} # Inicializar takes_data para este capítulo
                }
            }
        }

        # 2. Obtener Takes para este capítulo
        query_takes = """
            SELECT id, capitulo_id, numero_take, tc_in, tc_out
            FROM Takes
            WHERE capitulo_id = %s ORDER BY numero_take;
        """
        cursor.execute(query_takes, (capitulo_id,))
        takes_results = cursor.fetchall()

        take_ids_map = {} # Mapea take_id original a la estructura de exportación
        for t_row in takes_results:
            # El serie_id y capitulo_id para la estructura ya los tenemos de cap_serie_info
            export_data[serie_id]['capitulos_data'][capitulo_id]['takes_data'][t_row['id']] = {
                "take_info": dict(t_row),
                "intervenciones_data": []
            }
            take_ids_map[t_row['id']] = (serie_id, capitulo_id, t_row['id'])

        if not take_ids_map:
            logging.info(f"Capítulo ID {capitulo_id} no tiene takes. Se exportará información de serie/capítulo únicamente.")
            # No es necesario retornar aquí, la estructura ya está parcialmente llena.
            # La exportación de intervenciones simplemente no añadirá nada.
        else:
            # 3. Obtener Intervenciones para los takes de este capítulo
            take_placeholders = ', '.join(['%s'] * len(take_ids_map.keys()))
            query_intervenciones = f"""
                SELECT i.id, i.take_id, p.nombre_personaje AS personaje, i.dialogo,
                       i.tc_in, i.tc_out, i.orden_en_take, i.completo,
                       usr.nombre as completado_por_nombre_usuario, i.completado_en
                FROM Intervenciones i
                JOIN Personajes p ON i.personaje_id = p.id
                LEFT JOIN Usuarios usr ON i.completado_por_user_id = usr.id
                WHERE i.take_id IN ({take_placeholders})
                ORDER BY i.take_id, i.orden_en_take, i.id;
            """
            cursor.execute(query_intervenciones, tuple(take_ids_map.keys()))
            intervenciones_results = cursor.fetchall()

            for i_row in intervenciones_results:
                take_id_original = i_row['take_id']
                if take_id_original in take_ids_map:
                    # s_id_struct, c_id_struct, t_id_struct son los IDs para indexar export_data
                    s_id_struct, c_id_struct, t_id_struct = take_ids_map[take_id_original]

                    # Recuperar el numero_take del take_info asociado para la columna 'Numero Take'
                    num_take_for_interv = export_data[s_id_struct]['capitulos_data'][c_id_struct]['takes_data'][t_id_struct]['take_info']['numero_take']

                    formatted_interv = {
                        'ID': (i_row['orden_en_take'] + 1) if i_row['orden_en_take'] is not None else None, # Ajuste de índice base 1
                        'Personaje': i_row['personaje'],
                        'Dialogo': i_row['dialogo'],
                        'TC IN': i_row['tc_in'],
                        'TC OUT': i_row['tc_out'],
                        'Completo': i_row['completo'],
                        'Completado Por': i_row['completado_por_nombre_usuario'],
                        'Completado En': i_row['completado_en'].isoformat() if i_row['completado_en'] else None,
                        'Numero Take': num_take_for_interv # Añadido para que la hoja de Intervenciones tenga el contexto del take
                    }
                    export_data[s_id_struct]['capitulos_data'][c_id_struct]['takes_data'][t_id_struct]['intervenciones_data'].append(formatted_interv)

        logging.info(f"Datos para exportación de capítulo ID {capitulo_id} recuperados.")
        return export_data

    except (Exception, psycopg2.DatabaseError) as error:
        logging.error(f"Error obteniendo datos de capítulo {capitulo_id} para exportación: {error}")
        return None # Indicar fallo devolviendo None
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

def get_series_data_for_export(series_ids: list[int]):
    if not series_ids:
        return {}

    placeholders = ', '.join(['%s'] * len(series_ids))
    
    conn = None
    cursor = None
    export_data = {}

    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        query_series = f"SELECT id, numero_referencia, nombre_serie FROM Series WHERE id IN ({placeholders});"
        cursor.execute(query_series, tuple(series_ids))
        series_results = cursor.fetchall()
        for s_row in series_results:
            export_data[s_row['id']] = {
                "serie_info": dict(s_row), 
                "capitulos_data": {} 
            }

        query_capitulos = f"""
            SELECT id, serie_id, numero_capitulo, titulo_capitulo 
            FROM Capitulos 
            WHERE serie_id IN ({placeholders}) ORDER BY serie_id, numero_capitulo;
        """
        cursor.execute(query_capitulos, tuple(series_ids))
        capitulos_results = cursor.fetchall()
        
        capitulo_ids_map = {} 
        for c_row in capitulos_results:
            serie_id = c_row['serie_id']
            if serie_id in export_data: 
                export_data[serie_id]['capitulos_data'][c_row['id']] = {
                    "capitulo_info": dict(c_row),
                    "takes_data": {} 
                }
                capitulo_ids_map[c_row['id']] = (serie_id, c_row['id'])

        if not capitulo_ids_map: 
            return export_data 

        cap_placeholders = ', '.join(['%s'] * len(capitulo_ids_map.keys()))
        query_takes = f"""
            SELECT id, capitulo_id, numero_take, tc_in, tc_out 
            FROM Takes 
            WHERE capitulo_id IN ({cap_placeholders}) ORDER BY capitulo_id, numero_take;
        """
        cursor.execute(query_takes, tuple(capitulo_ids_map.keys()))
        takes_results = cursor.fetchall()

        take_ids_map = {} 
        for t_row in takes_results:
            capitulo_id_original = t_row['capitulo_id']
            if capitulo_id_original in capitulo_ids_map:
                serie_id, cap_id_in_export = capitulo_ids_map[capitulo_id_original]
                export_data[serie_id]['capitulos_data'][cap_id_in_export]['takes_data'][t_row['id']] = {
                    "take_info": dict(t_row),
                    "intervenciones_data": [] 
                }
                take_ids_map[t_row['id']] = (serie_id, cap_id_in_export, t_row['id'])
        
        if not take_ids_map:
            return export_data

        take_placeholders = ', '.join(['%s'] * len(take_ids_map.keys()))
        query_intervenciones = f"""
            SELECT i.id, i.take_id, p.nombre_personaje AS personaje, i.dialogo, 
                   i.tc_in, i.tc_out, i.orden_en_take, i.completo,
                   usr.nombre as completado_por_nombre_usuario, i.completado_en
            FROM Intervenciones i
            JOIN Personajes p ON i.personaje_id = p.id
            LEFT JOIN Usuarios usr ON i.completado_por_user_id = usr.id
            WHERE i.take_id IN ({take_placeholders}) 
            ORDER BY i.take_id, i.orden_en_take, i.id;
        """
        cursor.execute(query_intervenciones, tuple(take_ids_map.keys()))
        intervenciones_results = cursor.fetchall()

        for i_row in intervenciones_results:
            take_id_original = i_row['take_id']
            if take_id_original in take_ids_map:
                serie_id, cap_id_in_export, take_id_in_export = take_ids_map[take_id_original]
                formatted_interv = {
                    'ID': i_row['orden_en_take'] + 1, 
                    'Personaje': i_row['personaje'],
                    'Dialogo': i_row['dialogo'],
                    'TC IN': i_row['tc_in'],
                    'TC OUT': i_row['tc_out'],
                    'Completo': i_row['completo'],
                    'Completado Por': i_row['completado_por_nombre_usuario'],
                    'Completado En': i_row['completado_en'].isoformat() if i_row['completado_en'] else None,
                    'Numero Take': export_data[serie_id]['capitulos_data'][cap_id_in_export]['takes_data'][take_id_in_export]['take_info']['numero_take']
                }
                export_data[serie_id]['capitulos_data'][cap_id_in_export]['takes_data'][take_id_in_export]['intervenciones_data'].append(formatted_interv)
        
        logging.info(f"Datos para exportación recuperados para {len(export_data)} series.")
        return export_data

    except (Exception, psycopg2.DatabaseError) as error:
        logging.error(f"Error obteniendo datos de series para exportación: {error}")
        raise Exception(f"Error DB obteniendo datos para exportación: {error}") from error
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# --- Bloque de Prueba (Opcional) ---
if __name__ == '__main__':
    print("Probando la conexión a la base de datos y funciones...")
    # Llamada a la inicialización del esquema para asegurar que la tabla existe
    initialize_db_schema()
    
    print("\nProbando get_io_configuration_from_db...")
    config = get_io_configuration_from_db()
    print(f"Configuración I/O actual: {config}")

    print("\nProbando save_io_configuration_to_db...")
    test_config = {
        "import_path": "/test/imports",
        "export_path": "/test/exports",
        "import_schedule": "daily@01:00",
        "export_schedule": "manual",
        "export_series_ids": [1, 2]
    }
    save_success = save_io_configuration_to_db(test_config)
    print(f"Guardado de configuración de prueba: {'Éxito' if save_success else 'Fallo'}")
    
    config_after_save = get_io_configuration_from_db()
    print(f"Configuración I/O después de guardar: {config_after_save}")

    print("\nProbando list_all_users (sin filtros):")
    all_users = list_all_users()
    for u in all_users[:2]: print(f"  {u}")

    # ... (otras pruebas que tenías) ...
    print("\nPruebas de db_handler completadas.")