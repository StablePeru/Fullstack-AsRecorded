# -*- coding: utf-8 -*-
"""
data_handler.py
"""

# --- Importaciones ---
import db_handler
import logging 
import pandas as pd
import math 

# --- Configuración del Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Clase DataHandler ---
class DataHandler:
    def __init__(self):
        logging.info("DataHandler inicializado.")

    # --- Métodos para Series ---
    def get_all_series(self):
        try:
            query = "SELECT id, numero_referencia, nombre_serie FROM Series ORDER BY nombre_serie;"
            series = db_handler.execute_query(query, fetch_mode="all")
            logging.info(f"Recuperadas {len(series)} series.")
            return series 
        except Exception as e:
            logging.error(f"Error en get_all_series: {e}")
            return [] 

    def add_serie(self, numero_referencia, nombre_serie):
        if not numero_referencia or not nombre_serie:
             logging.warning("Intento de añadir serie con referencia o nombre vacíos.")
             return False 
        try:
            new_id = db_handler.add_new_serie(numero_referencia, nombre_serie)
            return new_id is not None
        except Exception as e:
            logging.error(f"Excepción en DataHandler al llamar a add_new_serie: {e}")
            return False

    def delete_serie(self, serie_id):
        if not isinstance(serie_id, int) or serie_id <= 0:
            logging.warning(f"Intento de eliminar serie con ID inválido: {serie_id}")
            return False
        try:
            return db_handler.delete_serie_by_id(serie_id)
        except Exception as e:
            logging.error(f"Excepción en DataHandler al llamar a delete_serie_by_id({serie_id}): {e}")
            return False

    # --- Métodos para Capítulos ---
    def get_serie_details(self, serie_id):
        if not isinstance(serie_id, int) or serie_id <= 0:
            logging.warning(f"Intento de obtener detalles de serie con ID inválido: {serie_id}")
            return None
        try:
            return db_handler.get_serie_by_id(serie_id)
        except Exception as e:
            logging.error(f"Excepción en DataHandler al llamar a get_serie_by_id({serie_id}): {e}")
            return None

    def get_capitulos_for_serie(self, serie_id):
        try:
            query = """
                SELECT id, numero_capitulo, titulo_capitulo
                FROM Capitulos
                WHERE serie_id = %s
                ORDER BY numero_capitulo;
            """
            params = (serie_id,)
            capitulos = db_handler.execute_query(query, params, fetch_mode="all")
            logging.info(f"Recuperados {len(capitulos)} capítulos para serie ID: {serie_id}.")
            return capitulos
        except Exception as e:
            logging.error(f"Error en get_capitulos_for_serie (ID: {serie_id}): {e}")
            return []

    # --- Métodos para Takes ---
    def get_takes_for_capitulo(self, capitulo_id):
        try:
            query = """
                SELECT id, numero_take, tc_in, tc_out
                FROM Takes
                WHERE capitulo_id = %s
                ORDER BY numero_take;
            """
            params = (capitulo_id,)
            takes = db_handler.execute_query(query, params, fetch_mode="all")
            logging.info(f"Recuperados {len(takes)} takes para capítulo ID: {capitulo_id}.")
            return takes
        except Exception as e:
            logging.error(f"Error en get_takes_for_capitulo (ID: {capitulo_id}): {e}")
            return []

    def get_take_details(self, take_id):
        try:
            query = "SELECT id, numero_take, tc_in, tc_out, capitulo_id FROM Takes WHERE id = %s;"
            params = (take_id,)
            take = db_handler.execute_query(query, params, fetch_mode="one") 
            if take:
                logging.info(f"Detalles recuperados para take ID: {take_id}.")
            else:
                 logging.warning(f"No se encontró take con ID: {take_id}.")
            return take 
        except Exception as e:
            logging.error(f"Error en get_take_details (ID: {take_id}): {e}")
            return None

    def get_chapter_details_with_takes(self, capitulo_id):
        if not isinstance(capitulo_id, int) or capitulo_id <= 0:
            logging.warning(f"Intento de obtener datos de capítulo con ID inválido: {capitulo_id}")
            return None, None 

        try:
            logging.info(f"Obteniendo detalles y takes/intervenciones para capítulo ID: {capitulo_id}")
            capitulo_details = db_handler.get_capitulo_details(capitulo_id)
            takes_with_interventions = db_handler.get_takes_and_interventions_for_chapter(capitulo_id)
            return capitulo_details, takes_with_interventions
        except Exception as e:
            logging.error(f"Excepción en DataHandler.get_chapter_details_with_takes({capitulo_id}): {e}")
            return None, None

    def mark_intervention_complete(self, intervention_id: int, state: bool, user_id: int):
        """Marca o desmarca una intervención como completa, registrando el usuario."""
        if not isinstance(intervention_id, int) or intervention_id <= 0:
            logging.warning(f"Intento de marcar intervención con ID inválido: {intervention_id}")
            return False
        if not isinstance(user_id, int) or user_id <= 0: # user_id debe ser un int válido
            logging.warning(f"Intento de marcar intervención con user_id inválido: {user_id}")
            return False
            
        try:
            # Llama a la función en db_handler que maneja user_id y completado_en
            # Esta es la función db_handler.update_intervention_status que modificamos
            return db_handler.update_intervention_status(intervention_id, state, user_id)
        except Exception as e:
            logging.error(f"Excepción en DataHandler.mark_intervention_complete({intervention_id}, {state}, user_id={user_id}): {e}")
            return False

    # --- Métodos para Personajes ---
    def get_character_names(self):
        try:
            nombres = db_handler.get_all_character_names()
            logging.info(f"Recuperados {len(nombres)} nombres de personajes.")
            return nombres
        except Exception as e:
            return []

    def get_character_details_by_name(self, nombre_personaje):
        try:
            query = "SELECT id, actor_doblaje FROM Personajes WHERE nombre_personaje = %s;"
            params = (nombre_personaje,)
            details = db_handler.execute_query(query, params, fetch_mode="one")
            if details:
                 logging.info(f"Detalles recuperados para personaje: {nombre_personaje}.")
            else:
                 logging.warning(f"No se encontró personaje con nombre: {nombre_personaje}.")
            return details
        except Exception as e:
            logging.error(f"Error en get_character_details_by_name ({nombre_personaje}): {e}")
            return None

    # --- Métodos para Intervenciones ---
    def get_dialogue_for_take(self, take_id):
        try:
            dialogues = db_handler.get_interventions_for_take(take_id) # Esta función en db_handler ya fue actualizada
            logging.info(f"Recuperados {len(dialogues)} diálogos para take ID: {take_id}.")
            return dialogues
        except Exception as e:
            return []

    # La función `mark_complete` es redundante con `mark_intervention_complete` que ya tiene user_id
    # Se puede eliminar si no se usa en otro lado.
    # def mark_complete(self, intervention_id, state):
    #     """Marca o desmarca una intervención como completa."""
    #     # Esta versión NO incluye user_id y debería ser reemplazada o eliminada
    #     # si mark_intervention_complete es la principal.
    #     # Por ahora, asumimos que se usará mark_intervention_complete.
    #     logging.warning("DataHandler.mark_complete DEPRECATED. Use mark_intervention_complete.")
    #     # return db_handler.update_intervention_status(intervention_id, state) # Llamaría a la versión sin user_id
    #     return False


    def update_dialogue(self, intervention_id, new_dialogue):
        return db_handler.update_intervention_dialogue(intervention_id, new_dialogue)

    def update_intervention_timecode(self, intervention_id, tc_in=None, tc_out=None):
        updates = []
        params = []
        if tc_in is not None:
            updates.append("tc_in = %s")
            params.append(tc_in)
        if tc_out is not None:
            updates.append("tc_out = %s")
            params.append(tc_out)

        if not updates:
            logging.warning("update_intervention_timecode llamado sin TCs para actualizar.")
            return False 

        query = f"UPDATE Intervenciones SET {', '.join(updates)} WHERE id = %s;"
        params.append(intervention_id)

        try:
            db_handler.execute_query(query, tuple(params), fetch_mode="none")
            logging.info(f"Timecodes actualizados para intervención ID: {intervention_id}.")
            return True
        except Exception as e:
            logging.error(f"Error al actualizar TCs para intervención ID {intervention_id}: {e}")
            return False

    # La función update_intervention_status que estaba aquí con la query SQL directa se ha movido a db_handler.py
    # y se llama a través de mark_intervention_complete -> db_handler.update_intervention_status


    # --- Métodos de Lógica Compleja (Adaptados de la versión Pandas) ---
    def get_character_progress(self, personaje_id):
        query = """
        SELECT
            COUNT(*) AS total_intervenciones,
            SUM(CASE WHEN completo THEN 1 ELSE 0 END) AS intervenciones_completas
        FROM Intervenciones
        WHERE personaje_id = %s;
        """
        params = (personaje_id,)
        try:
            result = db_handler.execute_query(query, params, fetch_mode="one") 
            if result and result['total_intervenciones'] is not None:
                total = result['total_intervenciones']
                completas = result['intervenciones_completas'] if result['intervenciones_completas'] is not None else 0
                porcentaje = (completas / total * 100) if total > 0 else 0
                logging.info(f"Progreso calculado para personaje ID {personaje_id}: {completas}/{total} ({porcentaje:.2f}%)")
                return {
                    'total': total,
                    'completas': completas,
                    'porcentaje': porcentaje
                }
            else:
                logging.warning(f"No se encontraron intervenciones para personaje ID {personaje_id}.")
                return {'total': 0, 'completas': 0, 'porcentaje': 0} 
        except Exception as e:
            logging.error(f"Error calculando progreso para personaje ID {personaje_id}: {e}")
            return None

    def get_summary_table(self, serie_id):
        query = """
        SELECT
            p.id AS personaje_id,
            p.nombre_personaje,
            COUNT(i.id) AS total_intervenciones,
            SUM(CASE WHEN i.completo THEN 1 ELSE 0 END) AS intervenciones_completas,
            SUM(CASE WHEN NOT i.completo THEN 1 ELSE 0 END) AS intervenciones_restantes 
        FROM Personajes p
        JOIN Intervenciones i ON p.id = i.personaje_id
        JOIN Takes t ON i.take_id = t.id
        JOIN Capitulos c ON t.capitulo_id = c.id
        WHERE c.serie_id = %s
        GROUP BY p.id, p.nombre_personaje
        HAVING SUM(CASE WHEN NOT i.completo THEN 1 ELSE 0 END) > 0 
        ORDER BY intervenciones_restantes DESC, p.nombre_personaje;
        """
        params = (serie_id,)
        try:
            results = db_handler.execute_query(query, params, fetch_mode="all")
            summary = []
            for row in results:
                total = row['total_intervenciones']
                completas = row['intervenciones_completas'] if row['intervenciones_completas'] is not None else 0
                restantes = row['intervenciones_restantes'] if row['intervenciones_restantes'] is not None else 0
                porcentaje = (completas / total * 100) if total > 0 else 0
                summary.append({
                    'personaje_id': row['personaje_id'],
                    'nombre_personaje': row['nombre_personaje'],
                    'intervenciones_restantes': restantes,
                    'porcentaje_completado': porcentaje
                })
            logging.info(f"Generada tabla resumen para serie ID {serie_id} con {len(summary)} personajes incompletos.")
            return summary
        except Exception as e:
            logging.error(f"Error generando tabla resumen para serie ID {serie_id}: {e}")
            return []

    def find_next_incomplete_intervention(self, current_take_id, personaje_id=None):
        current_take_details = self.get_take_details(current_take_id)
        if not current_take_details:
            logging.error(f"No se pudieron obtener detalles para el take actual ID: {current_take_id}")
            return None
        current_capitulo_id = current_take_details['capitulo_id']
        current_numero_take = current_take_details['numero_take']

        params = [current_capitulo_id]
        personaje_filter_sql = ""
        if personaje_id is not None:
            personaje_filter_sql = "AND i.personaje_id = %s"
            params.append(personaje_id)

        query = f"""
        SELECT t.id AS next_take_id
        FROM Intervenciones i
        JOIN Takes t ON i.take_id = t.id
        WHERE t.capitulo_id = %s
          AND i.completo = FALSE
          {personaje_filter_sql}
          AND t.numero_take >= %s 
        ORDER BY
            t.numero_take ASC,
            COALESCE(i.orden_en_take, 0) ASC, 
            i.id ASC
        LIMIT 1;
        """
        params.append(current_numero_take)

        try:
            result = db_handler.execute_query(query, tuple(params), fetch_mode="one")
            if result:
                next_take_id = result['next_take_id']
                if next_take_id == current_take_id:
                    query_after = f"""
                        SELECT t.id AS next_take_id
                        FROM Intervenciones i
                        JOIN Takes t ON i.take_id = t.id
                        WHERE t.capitulo_id = %s
                          AND i.completo = FALSE
                          {personaje_filter_sql}
                          AND t.numero_take > %s 
                        ORDER BY
                            t.numero_take ASC,
                            COALESCE(i.orden_en_take, 0) ASC,
                            i.id ASC
                        LIMIT 1;
                        """
                    params_after = params[:-1] 
                    params_after.append(current_numero_take) 
                    result_after = db_handler.execute_query(query_after, tuple(params_after), fetch_mode="one")
                    if result_after:
                         next_take_id = result_after['next_take_id']
                         logging.info(f"Siguiente take incompleto encontrado (después del actual): ID {next_take_id}")
                         return next_take_id
                    else:
                         logging.info("No hay más takes incompletos después del actual en este capítulo.")
                         return None 
                else:
                     logging.info(f"Siguiente take incompleto encontrado: ID {next_take_id}")
                     return next_take_id 
            else:
                logging.info("No se encontraron takes incompletos desde el actual en adelante.")
                return None 
        except Exception as e:
            logging.error(f"Error buscando siguiente intervención incompleta desde take ID {current_take_id}: {e}")
            return None

    def import_chapter_from_excel(self, file_path):
        logging.info(f"Iniciando importación desde Excel: '{file_path}'")
        required_sheets = ["Serie", "Takes", "Intervenciones"]
        
        try:
            excel_data = pd.ExcelFile(file_path, engine='openpyxl')
            for sheet_name in required_sheets:
                if sheet_name not in excel_data.sheet_names:
                    return False, f"Falta la hoja requerida '{sheet_name}' en el archivo Excel."
            df_serie = excel_data.parse("Serie").replace({pd.NA: None, pd.NaT: None})
            df_takes = excel_data.parse("Takes").replace({pd.NA: None, pd.NaT: None})
            df_intervenciones = excel_data.parse("Intervenciones").replace({pd.NA: None, pd.NaT: None})
            logging.info("Hojas Excel leídas correctamente.")

        except FileNotFoundError:
             return False, f"Archivo Excel no encontrado en la ruta: {file_path}"
        except Exception as e:
            message = f"Error al leer el archivo Excel '{file_path}': {e}"
            logging.exception(message) 
            return False, message

        try:
            if df_serie.empty:
                return False, "La hoja 'Serie' está vacía o no contiene datos."
            serie_row = df_serie.iloc[0]

            serie_ref = serie_row.get('Referencia')
            serie_name = serie_row.get('Nombre Serie')
            numero_capitulo = serie_row.get('Nº CAPÍTULO')

            if serie_ref is None or (isinstance(serie_ref, float) and math.isnan(serie_ref)):
                 return False, "Falta la columna/valor 'Referencia' en la hoja 'Serie'."
            serie_ref = str(serie_ref).strip()

            if not serie_name or (isinstance(serie_name, float) and math.isnan(serie_name)):
                 return False, "Falta la columna/valor 'Nombre Serie' en la hoja 'Serie'."
            serie_name = str(serie_name).strip()

            if numero_capitulo is None or math.isnan(numero_capitulo):
                 return False, "Falta la columna/valor 'Nº CAPÍTULO' en la hoja 'Serie'."
            try:
                numero_capitulo = int(numero_capitulo) 
            except (ValueError, TypeError):
                return False, f"Valor inválido para 'Nº CAPÍTULO': '{numero_capitulo}'. Debe ser un número entero."

            logging.info(f"Datos extraídos: Ref='{serie_ref}', Nombre='{serie_name}', Cap#={numero_capitulo}")

        except IndexError:
             return False, "La hoja 'Serie' parece estar vacía o mal formateada."
        except Exception as e:
            message = f"Error al procesar datos de la hoja 'Serie': {e}"
            logging.exception(message)
            return False, message

        try:
             takes_data = df_takes.to_dict('records')
             intervenciones_data = df_intervenciones.to_dict('records')
        except Exception as e:
            message = f"Error al preparar datos de Takes/Intervenciones: {e}"
            logging.exception(message)
            return False, message

        try:
            success, message = db_handler.import_full_chapter(
                 serie_ref=serie_ref,
                 serie_name=serie_name,
                 numero_capitulo=numero_capitulo,
                 takes_data=takes_data,
                 intervenciones_data=intervenciones_data
            )
            return success, message
        except Exception as e:
            message = f"Error inesperado durante el proceso de importación en base de datos: {e}"
            logging.exception(message)
            return False, message


# --- Bloque de Prueba (Opcional) ---
if __name__ == '__main__':
    print("Probando DataHandler...")
    handler = DataHandler()

    print("\nProbando get_all_series...")
    series = handler.get_all_series()
    if series:
        print(f"Series encontradas ({len(series)}):")
        # Suponiendo que existe una serie con ID 1 para la siguiente prueba
        test_serie_id = series[0]['id'] if series else 1
        for s in series[:5]:
            print(f"- ID: {s['id']}, Ref: {s['numero_referencia']}, Nombre: {s['nombre_serie']}")

        print(f"\nProbando get_capitulos_for_serie (ID: {test_serie_id})...")
        capitulos = handler.get_capitulos_for_serie(test_serie_id)
        if capitulos:
            print(f"Capítulos encontrados ({len(capitulos)}):")
            # Suponiendo que existe un capítulo con ID 1 para la siguiente prueba
            test_capitulo_id = capitulos[0]['id'] if capitulos else 1
            for c in capitulos[:5]:
                 print(f"- ID: {c['id']}, Num: {c['numero_capitulo']}, Título: {c['titulo_capitulo']}")

            print(f"\nProbando get_takes_for_capitulo (ID: {test_capitulo_id})...")
            takes = handler.get_takes_for_capitulo(test_capitulo_id)
            if takes:
                print(f"Takes encontrados ({len(takes)}):")
                test_take_id = takes[0]['id'] if takes else 1
                for t in takes[:5]:
                    print(f"- ID: {t['id']}, Num: {t['numero_take']}")

                print(f"\nProbando get_dialogue_for_take (ID: {test_take_id})...")
                dialogos = handler.get_dialogue_for_take(test_take_id)
                if dialogos:
                    print(f"Diálogos encontrados ({len(dialogos)}):")
                    test_intervention_id = dialogos[0]['id'] if dialogos else None
                    for d in dialogos[:3]:
                        print(f"  - ID: {d['id']}, Personaje: {d['personaje']}, Completo: {d['completo']}, Diálogo: {d['dialogo'][:30]}...")

                    # --- Pruebas de actualización (¡Modifican datos!) ---
                    # Descomentar con cuidado si quieres probarlas
                    # if test_intervention_id:
                    #     print(f"\nProbando mark_complete (ID: {test_intervention_id}) a True...")
                    #     success = handler.mark_complete(test_intervention_id, True)
                    #     print(f"Resultado: {success}")
                    #
                    #     print(f"\nProbando update_dialogue (ID: {test_intervention_id})...")
                    #     success = handler.update_dialogue(test_intervention_id, "Este diálogo ha sido actualizado para prueba.")
                    #     print(f"Resultado: {success}")
                    #
                    #     # Revertir el estado completo para no dejarlo cambiado
                    #     print(f"\nRevirtiendo mark_complete (ID: {test_intervention_id}) a False...")
                    #     success = handler.mark_complete(test_intervention_id, False)
                    #     print(f"Resultado: {success}")

                else:
                    print("No se encontraron diálogos para este take.")
            else:
                print("No se encontraron takes para este capítulo.")
        else:
            print("No se encontraron capítulos para esta serie.")
    else:
        print("No se encontraron series.")

    print("\nProbando get_character_names...")
    nombres = handler.get_character_names()
    print(f"Nombres encontrados ({len(nombres)}): {nombres[:10]}")

    # Añade más pruebas si lo necesitas...
    print("\nPruebas de DataHandler completadas.")