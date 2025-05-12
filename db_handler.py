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

# --- Configuración del Logging ---
# Configura un logger básico para registrar errores o información
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

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
        logging.info(f"Conexión exitosa a la base de datos '{DB_NAME}' en {DB_HOST}:{DB_PORT}")
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


# --- Funciones Específicas (Ejemplos - Añade aquí las tuyas) ---
# ... (resto de funciones como get_all_character_names, add_new_serie, etc. sin cambios) ...
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
        return None # Importante retornar None para que el handler lo maneje
    except Exception as e:
        logging.error(f"Error inesperado al añadir serie (Ref: {numero_referencia}): {e}")
        return None

def delete_serie_by_id(serie_id):
    """Elimina una serie y sus datos asociados."""
    # Asegúrate que la BD tiene ON DELETE CASCADE configurado en las FKs de Capitulos, Takes, Intervenciones
    # si quieres que esto borre todo lo asociado.
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
    """Obtiene todas las intervenciones para un take_id dado, uniendo info del personaje."""
    query = """
        SELECT i.id, i.dialogo, i.completo, i.tc_in, i.tc_out, i.orden_en_take,
               p.nombre_personaje, i.completado_por_user_id, i.completado_en,
               u.nombre as completado_por_nombre_usuario
        FROM Intervenciones i
        JOIN Personajes p ON i.personaje_id = p.id
        LEFT JOIN Usuarios u ON i.completado_por_user_id = u.id -- LEFT JOIN por si no está completado
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
    """Actualiza el diálogo de una intervención específica."""
    # Aquí podrías añadir lógica para registrar quién editó el diálogo y cuándo,
    # si decides añadir 'editado_por_user_id' y 'editado_en' a la tabla Intervenciones.
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

# --- Consolidada y Mejorada ---
def update_intervention_status(intervention_id: int, status: bool, user_id: int):
    """
    Actualiza el estado 'completo' de una intervención,
    y registra el usuario y la fecha/hora si se marca como completa.
    Si se desmarca, limpia los campos de completado.
    """
    query = """
        UPDATE Intervenciones
        SET completo = %s,
            completado_por_user_id = CASE WHEN %s THEN %s ELSE NULL END,
            completado_en = CASE WHEN %s THEN NOW() ELSE NULL END
        WHERE id = %s
        RETURNING id;
    """
    # El parámetro 'status' (booleano) se usa tres veces en la query
    params = (status, status, user_id, status, intervention_id)
    try:
        result = execute_query(query, params, fetch_mode="one")
        if result: # Si RETURNING id devuelve algo, es que se actualizó.
            logging.info(f"Estado 'completo' actualizado a {status} para intervención ID: {intervention_id} por usuario ID: {user_id if status else 'N/A'}")
            return True
        else:
            # Esto no debería ocurrir si la query es correcta y el ID existe,
            # a menos que el ID no exista.
            logging.warning(f"No se encontró intervención ID {intervention_id} para actualizar estado.")
            return False
    except Exception as e:
        logging.error(f"Error al actualizar estado para ID {intervention_id} (usuario {user_id}): {e}")
        return False

# --- Funciones Auxiliares para Importación (Uso Interno) ---
def _find_or_create_serie(cursor, numero_referencia, nombre_serie):
    """Busca una serie por referencia o nombre. Si no existe, la crea."""
    logging.debug(f"Buscando/Creando serie Ref: {numero_referencia}, Nombre: {nombre_serie}")
    query_select = "SELECT id FROM Series WHERE numero_referencia = %s;"
    cursor.execute(query_select, (numero_referencia,))
    result = cursor.fetchone()

    if result:
        serie_id = result['id']
        logging.info(f"Serie encontrada por referencia {numero_referencia} -> ID: {serie_id}")
        return serie_id
    else:
        # Si no se encuentra por referencia, buscar por nombre como fallback podría ser útil
        # pero OJO: si la referencia es el identificador único esperado, crear una nueva
        # si solo el nombre coincide podría no ser lo deseado.
        # Para este caso, si la referencia no existe, creamos una nueva.
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
                # Esto sería un error inesperado si la inserción no devuelve ID
                raise Exception("No se pudo obtener el ID de la serie recién insertada.")
        except psycopg2.Error as e: # Captura errores específicos de psycopg2
            logging.error(f"Error de base de datos al insertar nueva serie: {e}")
            raise e # Re-lanzar para que la transacción principal haga rollback

def _find_or_create_chapter(cursor, serie_id, numero_capitulo):
    """Busca un capítulo por serie_id y numero_capitulo. Si no existe, lo crea.
       Si EXISTE, BORRA sus Takes e Intervenciones antiguas antes de proceder."""
    logging.debug(f"Buscando/Creando capítulo {numero_capitulo} para serie ID {serie_id}")
    query_select = "SELECT id FROM Capitulos WHERE serie_id = %s AND numero_capitulo = %s;"
    cursor.execute(query_select, (serie_id, numero_capitulo))
    result = cursor.fetchone()

    if result:
        capitulo_id = result['id']
        logging.warning(f"Capítulo {numero_capitulo} (ID: {capitulo_id}) ya existe para Serie ID {serie_id}. Borrando Takes e Intervenciones asociados para re-importar...")
        # Borrar en orden: Intervenciones -> Takes
        try:
            # Asegúrate que el usuario de BD tiene permisos para DELETE
            cursor.execute("DELETE FROM Intervenciones WHERE take_id IN (SELECT id FROM Takes WHERE capitulo_id = %s);", (capitulo_id,))
            logging.info(f"Intervenciones antiguas borradas para capítulo {capitulo_id}. Afectadas: {cursor.rowcount}")
            cursor.execute("DELETE FROM Takes WHERE capitulo_id = %s;", (capitulo_id,))
            logging.info(f"Takes antiguos borrados para capítulo {capitulo_id}. Afectadas: {cursor.rowcount}")
            return capitulo_id
        except psycopg2.Error as e:
            logging.error(f"Error al borrar datos antiguos del capítulo {capitulo_id}: {e}")
            raise e # Re-lanzar para rollback
    else:
        logging.info(f"Creando nuevo capítulo {numero_capitulo} para Serie ID {serie_id}")
        query_insert = """
            INSERT INTO Capitulos (serie_id, numero_capitulo, titulo_capitulo)
            VALUES (%s, %s, %s) RETURNING id;
        """
        # Usar un placeholder para el título si no viene del Excel o se decide no usarlo
        titulo_placeholder = f"Capítulo {numero_capitulo}" # Podrías tomarlo del Excel si existe
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
    """
    Obtiene todos los takes y sus intervenciones asociadas para un capítulo.
    """
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
    intervenciones_map = {} # Para mapear take_id a lista de sus intervenciones

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        logging.debug(f"Ejecutando query de takes para capítulo {capitulo_id}")
        cursor.execute(takes_query, takes_params)
        takes_result = cursor.fetchall()
        logging.info(f"Recuperados {len(takes_result)} takes para capítulo {capitulo_id}")

        if not takes_result: # Si no hay takes, no necesitamos buscar intervenciones
            return []

        logging.debug(f"Ejecutando query de intervenciones para capítulo {capitulo_id}")
        cursor.execute(interv_query, interv_params)
        interv_result = cursor.fetchall()
        logging.info(f"Recuperadas {len(interv_result)} intervenciones para capítulo {capitulo_id}")

        # Organizar intervenciones por take_id para fácil asignación
        for interv in interv_result:
            take_id = interv['take_id']
            if take_id not in intervenciones_map:
                intervenciones_map[take_id] = []
            # Renombrar 'nombre_personaje' a 'personaje' para consistencia con lo esperado por el frontend
            interv['personaje'] = interv.pop('nombre_personaje')
            intervenciones_map[take_id].append(interv)

        # Ensamblar takes con sus intervenciones
        for take_dict in takes_result: # Renombrar take a take_dict para evitar conflicto con take_id
            take_id_current = take_dict['id']
            take_dict['intervenciones'] = intervenciones_map.get(take_id_current, [])
            takes.append(take_dict)

        return takes

    except (Exception, psycopg2.DatabaseError) as error:
        logging.error(f"Error obteniendo takes e intervenciones para capítulo {capitulo_id}: {error}")
        # Re-lanzar para que el llamador maneje el error (e.g., API devuelva 500)
        raise Exception(f"Error DB obteniendo datos de capítulo: {error}") from error
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

def get_capitulo_details(capitulo_id):
    """Obtiene detalles básicos de un capítulo."""
    query = "SELECT id, numero_capitulo, titulo_capitulo, serie_id FROM Capitulos WHERE id = %s;"
    try:
        return execute_query(query, (capitulo_id,), fetch_mode="one")
    except Exception as e:
        logging.error(f"Error obteniendo detalles capítulo {capitulo_id}: {e}")
        return None

def _find_or_create_personajes(cursor, personaje_names_set):
    """Busca personajes por nombre. Crea los que no existan. Retorna mapa Nombre -> ID."""
    if not personaje_names_set: # Si el set está vacío
        return {}

    logging.debug(f"Buscando/Creando {len(personaje_names_set)} personajes...")
    personajes_map = {}
    # Convertir set a lista para la query con = ANY(%s)
    names_list_for_query = list(personaje_names_set)
    # Query para seleccionar todos los personajes existentes de la lista
    query_select = "SELECT id, nombre_personaje FROM Personajes WHERE nombre_personaje = ANY(%s);"
    cursor.execute(query_select, (names_list_for_query,)) # Pasar la lista como una tupla de un solo elemento

    existing_personajes = cursor.fetchall()
    for p_dict in existing_personajes: # Renombrar p a p_dict
        personajes_map[p_dict['nombre_personaje']] = p_dict['id']

    # Identificar los nombres que no existen para crearlos
    existing_names = set(personajes_map.keys())
    new_names = list(personaje_names_set - existing_names) # Nombres en el set original que no están en existing_names

    if new_names:
        logging.info(f"Creando {len(new_names)} personajes nuevos: {new_names}")
        # Preparar datos para inserción múltiple (si psycopg2 lo soporta bien con RETURNING individual)
        # o insertar uno por uno. Uno por uno es más simple con RETURNING.
        insert_data = [(name,) for name in new_names]
        query_insert = "INSERT INTO Personajes (nombre_personaje) VALUES (%s) RETURNING id, nombre_personaje;"
        for name_tuple in insert_data:
            cursor.execute(query_insert, name_tuple)
            new_p_dict = cursor.fetchone() # Renombrar new_p a new_p_dict
            if new_p_dict:
                personajes_map[new_p_dict['nombre_personaje']] = new_p_dict['id']
            else:
                 # Esto sería un error inesperado si la inserción no devuelve el personaje
                 raise Exception(f"No se pudo obtener el ID del personaje recién insertado: {name_tuple[0]}")

    logging.info(f"Mapa de personajes listo ({len(personajes_map)} total).")
    return personajes_map

def _insert_takes(cursor, capitulo_id, takes_data):
    """Inserta takes para un capítulo y retorna mapa 'Numero Take' Excel -> take_id BD."""
    logging.debug(f"Insertando {len(takes_data)} takes para capítulo ID {capitulo_id}...")
    takes_map = {} # Mapea el 'Numero Take' del Excel al ID de la BD
    query_insert = """
        INSERT INTO Takes (capitulo_id, numero_take, tc_in, tc_out)
        VALUES (%s, %s, %s, %s) RETURNING id, numero_take;
    """
    for take_dict in takes_data:
        # Obtener valores del diccionario, proveyendo None como default si la key no existe
        numero_take_excel = take_dict.get('Numero Take')
        if numero_take_excel is None: # Validar que 'Numero Take' no sea None
            logging.warning("Se encontró un take sin 'Numero Take' en los datos, saltando.")
            continue
        try:
            # Convertir a entero. Si falla, es un valor no numérico.
            numero_take_excel = int(numero_take_excel)
        except (ValueError, TypeError):
             logging.warning(f"Valor inválido para 'Numero Take': {take_dict.get('Numero Take')}, saltando.")
             continue

        params = (
            capitulo_id,
            numero_take_excel,
            take_dict.get('TAKE IN'), # Puede ser None si no está en Excel
            take_dict.get('TAKE OUT') # Puede ser None
        )
        cursor.execute(query_insert, params)
        new_take_dict = cursor.fetchone() # Renombrar new_take a new_take_dict
        if new_take_dict:
            # Usar el numero_take_excel (original del Excel, convertido a int) como clave del mapa
            takes_map[numero_take_excel] = new_take_dict['id']
        else:
            # Error inesperado
            raise Exception(f"No se pudo obtener el ID del take recién insertado: Num={numero_take_excel}")

    logging.info(f"Mapa de takes listo ({len(takes_map)} insertados/mapeados).")
    return takes_map

def _insert_intervenciones(cursor, takes_map, personajes_map, intervenciones_data):
    """
    Inserta las intervenciones usando los mapas de takes y personajes.
    """
    logging.debug(f"Preparando {len(intervenciones_data)} intervenciones para inserción...")
    insert_data_list = [] # Renombrar insert_data a insert_data_list
    skipped_count = 0
    orden_counter = {} # Para generar orden_en_take secuencial por take_id

    for index, interv_dict in enumerate(intervenciones_data):
        numero_take_excel = interv_dict.get('Numero Take')
        personaje_nombre = interv_dict.get('Personaje')
        dialogo = interv_dict.get('Dialogo') # Puede ser None, se manejará
        # Usar 'ID' del Excel como fallback para logging si es útil, no para la BD
        excel_id_orden = interv_dict.get('ID', index + 1) # index + 1 para un "ID" base 1

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

        if not personaje_nombre or not str(personaje_nombre).strip(): # Chequear si es None o vacío
             logging.warning(f"Intervención (Excel ID/Orden: {excel_id_orden}, Take BD ID: {take_id}) sin 'Personaje' o vacío, saltando.")
             skipped_count += 1
             continue
        personaje_nombre_str = str(personaje_nombre).strip() # Convertir a str y strip
        personaje_id = personajes_map.get(personaje_nombre_str)
        if personaje_id is None:
             # Esto es un error grave si el personaje debería haber sido creado
             logging.error(f"PERSONAJE '{personaje_nombre_str}' NO MAPEADO (Intervención Excel ID/Orden: {excel_id_orden}, Take BD ID: {take_id}) - ¡ERROR INESPERADO! Saltando.")
             skipped_count += 1
             continue

        # Manejar diálogo None o convertir a string
        dialogo_str = str(dialogo).strip() if dialogo is not None else ""

        # Generar orden_en_take
        current_order = orden_counter.get(take_id, 0) # Obtener el contador actual para este take_id
        orden_en_take = current_order
        orden_counter[take_id] = current_order + 1 # Incrementar para la próxima intervención en este take

        # Default values
        completo = False # Las intervenciones importadas inician como no completas
        tc_in = interv_dict.get('TC IN') # Asumir que pueden venir del Excel, o None
        tc_out = interv_dict.get('TC OUT') # Asumir que pueden venir del Excel, o None


        insert_data_list.append((
            take_id,
            personaje_id,
            dialogo_str,
            completo,
            tc_in, # Podría ser None
            tc_out, # Podría ser None
            orden_en_take # Asegurar que este campo existe en la tabla Intervenciones
        ))

    if skipped_count > 0:
         logging.warning(f"Se saltaron {skipped_count} intervenciones durante la preparación debido a datos faltantes o inválidos.")

    if not insert_data_list: # Si no hay nada para insertar
         logging.warning("No hay datos de intervenciones válidos para insertar.")
         return 0 # Retornar 0 intervenciones insertadas

    query_insert = """
        INSERT INTO Intervenciones (take_id, personaje_id, dialogo, completo, tc_in, tc_out, orden_en_take)
        VALUES (%s, %s, %s, %s, %s, %s, %s);
    """
    try:
        logging.info(f"Intentando insertar {len(insert_data_list)} intervenciones...")
        # Usar executemany para inserción en batch
        cursor.executemany(query_insert, insert_data_list)
        inserted_count = cursor.rowcount # rowcount para executemany puede no ser preciso en todos los drivers/DBs
                                         # pero para psycopg2 con INSERTs debería ser el número de filas insertadas.
        logging.info(f"Ejecución de inserción completada. Filas afectadas según cursor.rowcount: {inserted_count}")
        # Validar si el conteo es el esperado
        if inserted_count != len(insert_data_list):
             logging.warning(f"El número de filas insertadas ({inserted_count}) no coincide con los datos preparados ({len(insert_data_list)}). Revisar posibles problemas o configuración del driver.")
        return inserted_count
    except psycopg2.Error as e:
        logging.exception(f"Error durante executemany para insertar intervenciones: {e}")
        raise e # Re-lanzar para rollback

def import_full_chapter(serie_ref, serie_name, numero_capitulo, takes_data, intervenciones_data):
    """
    Importa un capítulo completo (serie, capítulo, personajes, takes, intervenciones)
    en una sola transacción.
    """
    conn = None
    cursor = None
    # Definir columnas requeridas aquí ayuda a validar antes de la transacción
    required_tx_cols = ['Numero Take'] # 'TAKE IN', 'TAKE OUT' son opcionales
    required_int_cols = ['Numero Take', 'Personaje', 'Dialogo'] # 'ID' (del Excel) es opcional, 'TC IN/OUT' opcional

    # Validación básica de datos de entrada
    if not takes_data:
        return False, "No se encontraron datos en la hoja 'Takes' o la lista de takes está vacía."
    if not isinstance(takes_data, list) or not all(isinstance(item, dict) for item in takes_data):
        return False, "El formato de 'takes_data' es incorrecto. Debe ser una lista de diccionarios."
    if not all(col in takes_data[0] for col in required_tx_cols): # Chequea solo el primer item por simplicidad
        missing = [col for col in required_tx_cols if col not in takes_data[0]]
        return False, f"Faltan columnas requeridas en 'Takes': {', '.join(missing)}"

    if not intervenciones_data:
         return False, "No se encontraron datos en la hoja 'Intervenciones' o la lista de intervenciones está vacía."
    if not isinstance(intervenciones_data, list) or not all(isinstance(item, dict) for item in intervenciones_data):
        return False, "El formato de 'intervenciones_data' es incorrecto. Debe ser una lista de diccionarios."
    if not all(col in intervenciones_data[0] for col in required_int_cols): # Chequea solo el primer item
        missing = [col for col in required_int_cols if col not in intervenciones_data[0]]
        return False, f"Faltan columnas requeridas en 'Intervenciones': {', '.join(missing)}"


    logging.info(f"Iniciando transacción para importar capítulo {numero_capitulo} (Serie Ref: {serie_ref})...")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) # Usar RealDictCursor

        # 1. Encontrar o crear Serie
        serie_id = _find_or_create_serie(cursor, serie_ref, serie_name)
        if serie_id is None: # Si la función devuelve None, hubo un error
             # El error específico ya fue logueado en _find_or_create_serie
             raise Exception(f"No se pudo encontrar o crear la serie (Ref: {serie_ref}).")

        # 2. Encontrar o crear Capítulo (y borrar datos viejos si existe)
        capitulo_id = _find_or_create_chapter(cursor, serie_id, numero_capitulo)
        if capitulo_id is None:
            raise Exception(f"No se pudo encontrar o crear el capítulo {numero_capitulo}.")

        # 3. Encontrar o crear Personajes
        # Obtener todos los nombres de personaje únicos de los datos de intervenciones
        personaje_names = set(str(i['Personaje']).strip() for i in intervenciones_data if i.get('Personaje') and str(i['Personaje']).strip())
        if not personaje_names:
             logging.warning("No se encontraron nombres de personaje válidos en 'Intervenciones'. No se crearán/mapearán personajes.")
             personajes_map = {}
        else:
            personajes_map = _find_or_create_personajes(cursor, personaje_names)
            if personajes_map is None: # Si _find_or_create_personajes indica un error (e.g., al retornar None)
                 raise Exception("Error al procesar personajes.")

        # 4. Insertar Takes
        takes_map = _insert_takes(cursor, capitulo_id, takes_data)
        if takes_map is None: # Si _insert_takes indica un error
             raise Exception("Error al insertar takes.")
        if not takes_map and takes_data: # Si había datos de takes pero no se mapeó ninguno
             logging.warning("No se insertaron takes, aunque había datos. Verifique los datos de la hoja 'Takes'.")
        elif not takes_map and not takes_data:
             logging.info("No había datos de takes para insertar.")


        # 5. Insertar Intervenciones
        inserted_interv_count = 0
        if intervenciones_data and takes_map and personajes_map is not None: # Solo si hay datos y mapas necesarios
            inserted_interv_count = _insert_intervenciones(cursor, takes_map, personajes_map, intervenciones_data)
            logging.info(f"Proceso de inserción de intervenciones finalizado. Insertadas: {inserted_interv_count} / Preparadas: {len(intervenciones_data)}")
        elif not intervenciones_data:
            logging.info("No había datos de intervenciones para insertar.")
        else:
            logging.warning("No se insertaron intervenciones debido a falta de takes mapeados o error en personajes.")


        # Si todo fue bien, hacer commit
        conn.commit()
        message = (f"Importación completada. Serie ID: {serie_id}, Capítulo ID: {capitulo_id}. "
                   f"{len(takes_map) if takes_map else 0} Takes insertados/mapeados, {inserted_interv_count} Intervenciones insertadas.")
        logging.info(message)
        return True, message

    except (Exception, psycopg2.DatabaseError) as error:
        # Loguear la excepción completa con traceback
        logging.exception(f"Error CRÍTICO durante la transacción de importación (Capítulo {numero_capitulo}, Serie Ref {serie_ref}):")
        if conn:
            conn.rollback() # Asegurar rollback en caso de error
            logging.warning("ROLLBACK ejecutado debido a error en importación.")
        # Formatear mensaje de error para el frontend
        error_msg = f"Error durante la importación: {str(error)}"
        # Se podría ser más específico si se capturan tipos de psycopg2.Error
        if isinstance(error, psycopg2.IntegrityError):
            error_msg = f"Error de integridad de datos durante la importación (ej. duplicado, FK no válida): {str(error)}"
        # Devolver False y el mensaje de error
        return False, error_msg

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logging.info(f"Conexión de importación cerrada para capítulo {numero_capitulo} (Serie Ref {serie_ref}).")

def get_serie_by_id(serie_id):
    """Obtiene los detalles de una serie específica por su ID."""
    query = "SELECT id, numero_referencia, nombre_serie FROM Series WHERE id = %s;"
    params = (serie_id,)
    try:
        serie = execute_query(query, params, fetch_mode="one")
        if serie:
            logging.info(f"Detalles recuperados para serie ID: {serie_id}")
        else:
            # Es normal que una serie no se encuentre, no necesariamente un error.
            logging.warning(f"No se encontró serie con ID: {serie_id} en get_serie_by_id.")
        return serie # Puede ser None si no se encuentra
    except Exception as e:
        # Esto sí sería un error de ejecución
        logging.error(f"Error en get_serie_by_id({serie_id}): {e}")
        return None

# --- Funciones de Usuario Modificadas ---
def add_user(nombre, password_hash, rol='tecnico'): # rol por defecto
    """
    Añade un nuevo usuario a la base de datos con un rol.
    Devuelve el ID del nuevo usuario si se añadió, None en caso de error.
    """
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
            # Esto no debería ocurrir si la query es correcta y no hay error
            logging.error(f"No se pudo obtener el ID para el nuevo usuario: {nombre}")
            return None
    except psycopg2.errors.UniqueViolation: # Capturar error de unicidad específico
        logging.warning(f"Error al añadir usuario: El nombre '{nombre}' ya existe.")
        return None
    except psycopg2.errors.CheckViolation: # Para la restricción de 'rol'
        logging.warning(f"Error al añadir usuario '{nombre}': Rol '{rol}' inválido.")
        return None
    except Exception as e:
        logging.error(f"Error inesperado al añadir usuario '{nombre}': {e}")
        return None


def get_user_by_name(nombre):
    """
    Busca un usuario por su nombre.
    Devuelve un diccionario con los datos del usuario (id, nombre, password_hash, rol)
    o None si no se encuentra.
    """
    query = "SELECT id, nombre, password_hash, rol FROM Usuarios WHERE nombre = %s;"
    params = (nombre,)
    try:
        user_data = execute_query(query, params, fetch_mode="one")
        if user_data:
            logging.info(f"Usuario encontrado: {user_data['nombre']} (ID: {user_data['id']}, Rol: {user_data['rol']})")
        else:
            logging.info(f"Usuario '{nombre}' no encontrado.")
        return user_data # Retorna dict o None
    except Exception as e:
        logging.error(f"Error al buscar usuario '{nombre}': {e}")
        return None

# --- NUEVAS FUNCIONES PARA GESTIÓN DE USUARIOS (ADMIN) ---
def list_all_users(search_term=None, sort_by='nombre', sort_order='ASC'):
    """
    Obtiene una lista de todos los usuarios (sin el hash de contraseña por seguridad),
    con opción de búsqueda por nombre y ordenación.
    """
    # Columnas permitidas para ordenar para evitar inyección SQL
    allowed_sort_columns = ['id', 'nombre', 'rol', 'fecha_creacion', 'fecha_actualizacion']
    if sort_by not in allowed_sort_columns:
        logging.warning(f"Intento de ordenar por columna no permitida: {sort_by}. Usando 'nombre' por defecto.")
        sort_by = 'nombre'

    # Validar dirección de ordenación
    if sort_order.upper() not in ['ASC', 'DESC']:
        logging.warning(f"Orden de clasificación no válido: {sort_order}. Usando 'ASC' por defecto.")
        sort_order = 'ASC'

    base_query = "SELECT id, nombre, rol, fecha_creacion, fecha_actualizacion FROM Usuarios"
    params = []
    where_clauses = []

    if search_term:
        # Usar ILIKE para búsqueda case-insensitive. Añadir comodines.
        where_clauses.append("nombre ILIKE %s")
        params.append(f"%{search_term}%")
        # Podrías añadir búsqueda por rol también si quisieras:
        # where_clauses.append("(nombre ILIKE %s OR rol ILIKE %s)")
        # params.extend([f"%{search_term}%", f"%{search_term}%"])


    if where_clauses:
        base_query += " WHERE " + " AND ".join(where_clauses)

    # Concatenar de forma segura la parte de ordenación
    # No se usan parámetros de query para sort_by y sort_order directamente por seguridad
    query = f"{base_query} ORDER BY {sort_by} {sort_order.upper()};"

    try:
        users = execute_query(query, tuple(params) if params else None, fetch_mode="all")
        logging.info(f"Recuperados {len(users)} usuarios (search: '{search_term}', sort: {sort_by} {sort_order}).")
        return users
    except Exception as e:
        logging.error(f"Error al listar usuarios (search: '{search_term}', sort: {sort_by} {sort_order}): {e}")
        return []


def update_user_role(user_id, new_role):
    """
    Actualiza el rol de un usuario específico.
    """
    # La restricción CHECK en la BD para 'rol' ya valida los valores.
    query = "UPDATE Usuarios SET rol = %s, fecha_actualizacion = NOW() WHERE id = %s RETURNING id, rol;"
    params = (new_role, user_id)
    try:
        result = execute_query(query, params, fetch_mode="one")
        if result:
            logging.info(f"Rol actualizado para usuario ID {user_id} a '{new_role}'.")
            return True
        else:
            # Si no devuelve resultado, el usuario ID no existe
            logging.warning(f"No se encontró usuario ID {user_id} para actualizar rol.")
            return False
    except psycopg2.errors.CheckViolation: # Captura específica para error de CHECK constraint
        logging.warning(f"Error al actualizar rol para usuario ID {user_id}: Rol '{new_role}' inválido según la BD.")
        return False
    except Exception as e:
        logging.error(f"Error al actualizar rol para usuario ID {user_id}: {e}")
        return False


# --- Bloque de Prueba (Opcional) ---
if __name__ == '__main__':
    print("Probando la conexión a la base de datos...")
    # ... (resto de pruebas pueden permanecer, ajustar si es necesario) ...
    # (Añadir pruebas para list_all_users con búsqueda y ordenación si se desea)
    print("\nProbando list_all_users (sin filtros):")
    all_users = list_all_users()
    for u in all_users[:5]: print(f"  {u}")

    print("\nProbando list_all_users (buscando 'admin', ordenado por id DESC):")
    admin_users = list_all_users(search_term="admin", sort_by="id", sort_order="DESC")
    for u in admin_users: print(f"  {u}")

    print("\nProbando list_all_users (buscando 'test', ordenado por rol ASC):")
    test_users = list_all_users(search_term="test", sort_by="rol", sort_order="ASC")
    for u in test_users: print(f"  {u}")