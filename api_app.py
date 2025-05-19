# -*- coding: utf-8 -*-
"""
api_app.py - Flask Backend API
"""

# --- Standard Library Imports ---
import logging
import os
from functools import wraps # Para decoradores de roles

# --- Flask and Extensions Imports ---
from flask import Flask, request, jsonify, session, make_response, send_file
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_apscheduler import APScheduler
from werkzeug.utils import secure_filename

# --- Local Application Imports ---
try:
    import data_handler
    import db_handler # Asegúrate que esto importa el db_handler.py modificado
    DataHandler = data_handler.DataHandler
except ImportError as e:
    logging.critical(f"Error CRÍTICO al importar módulos locales (data_handler, db_handler): {e}")
    DataHandler = None
    db_handler = None


# --- Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)

# --- Flask App Initialization ---
app = Flask(__name__)

# --- Configuration Settings ---
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-deberia-ser-larga-y-aleatoria')
app.config['SESSION_COOKIE_NAME'] = 'flask_session_asrecorded'
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = os.getenv('FLASK_ENV') == 'production'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
UPLOAD_FOLDER = os.path.join(app.root_path, 'temp_uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

class SchedulerConfig:
    SCHEDULER_API_ENABLED = True
    # Puedes añadir más configuraciones de APScheduler aquí si es necesario

app.config.from_object(SchedulerConfig())


# --- Flask Extensions Initialization ---
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"])
bcrypt = Bcrypt(app)
scheduler = APScheduler()
# No iniciar aquí si se usa el reloader de Flask y no se quiere que el scheduler se inicie en el proceso hijo.
# Se iniciará explícitamente en el bloque if __name__ == '__main__' si es necesario.
# scheduler.init_app(app)
# scheduler.start()

# --- Service/Handler Initialization ---
handler_instance = DataHandler() if DataHandler and db_handler else None
if not db_handler:
     logging.critical("FATAL: No se pudo inicializar/importar db_handler.")
else:
    # Inicializar el esquema de la BD aquí, después de que db_handler esté disponible
    # Esto se ejecutará una vez cuando la aplicación Flask se inicie.
    # Usar un contexto de aplicación para db_handler si este lo requiere (aunque get_db_connection no lo hace)
    with app.app_context():
        db_handler.initialize_db_schema()


# --- Helper Functions & Decorators ---
def check_services():
    if not db_handler or not handler_instance:
        logging.error("Error: Módulos de base de datos (db_handler o handler_instance) no inicializados.")
        return False, jsonify({"error": "Servicio no disponible temporalmente debido a un problema interno."}), 503
    return True, None, None

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            logging.warning(f"Acceso no autorizado a {request.path} - No hay sesión de usuario.")
            return jsonify({"message": "Acceso no autorizado. Por favor, inicie sesión.", "error_code": "UNAUTHORIZED"}), 401
        return f(*args, **kwargs)
    return decorated_function

def roles_required(allowed_roles):
    if not isinstance(allowed_roles, list):
        allowed_roles = [allowed_roles]
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({"message": "Acceso no autorizado. Por favor, inicie sesión.", "error_code": "UNAUTHORIZED"}), 401
            user_role = session.get('user_rol')
            if not user_role or user_role not in allowed_roles:
                logging.warning(f"Usuario ID {session.get('user_id')} con rol '{user_role}' intentó acceder a recurso protegido para roles {allowed_roles} en {request.path}.")
                return jsonify({"message": "Permiso denegado para este recurso.", "error_code": "FORBIDDEN"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# --- Tareas Programadas (Funciones que serán llamadas por APScheduler) ---
# Estas funciones ya usan handler_instance.get_io_configurations(), que ahora leerá de la BD.
def scheduled_import_task_job():
    """Función de trabajo real para la importación programada."""
    with app.app_context():
        logging.info("Ejecutando tarea de importación programada...")
        if not handler_instance:
            logging.error("Importación programada: DataHandler no disponible.")
            return

        config = handler_instance.get_io_configurations() # Leerá de la BD
        import_path = config.get("import_path")

        if not import_path :
            logging.error(f"Ruta de importación programada no configurada o vacía.")
            return

        if not os.path.isabs(import_path):
            logging.warning(f"La ruta de importación '{import_path}' no es absoluta. Se resolverá relativa a: {os.getcwd()}")

        if not os.path.exists(import_path):
             logging.error(f"La ruta de importación configurada '{import_path}' NO EXISTE en el contenedor.")
             return

        if not os.path.isdir(import_path):
             logging.error(f"La ruta de importación configurada '{import_path}' EXISTE PERO NO ES UN DIRECTORIO.")
             return

        logging.info(f"Importación programada: Escaneando directorio '{import_path}'...")
        file_count = 0
        processed_count = 0
        try:
            for filename in os.listdir(import_path):
                file_count +=1
                if filename.lower().endswith('.xlsx'):
                    filepath = os.path.join(import_path, filename)
                    try:
                        logging.info(f"Procesando archivo para importación programada: {filepath}")
                        success, message = handler_instance.import_chapter_from_excel(filepath)
                        if success:
                            logging.info(f"Importación programada de '{filename}' exitosa: {message}")
                            processed_count +=1
                            # Opcional: Mover archivo procesado a una subcarpeta 'IMPORTADOS'
                            # processed_dir = os.path.join(import_path, "IMPORTADOS")
                            # os.makedirs(processed_dir, exist_ok=True)
                            # try:
                            #     os.rename(filepath, os.path.join(processed_dir, filename))
                            #     logging.info(f"Archivo '{filename}' movido a '{processed_dir}'.")
                            # except OSError as e_move:
                            #     logging.error(f"No se pudo mover el archivo '{filename}' a procesados: {e_move}")
                        else:
                            logging.error(f"Importación programada de '{filename}' fallida: {message}")
                    except Exception as e_file: # Error procesando un archivo individual
                        logging.exception(f"Error crítico en importación programada de '{filename}': {e_file}")
        except FileNotFoundError:
            logging.error(f"Error al listar directorio '{import_path}': No encontrado. ¿Se desmontó el volumen?")
        except PermissionError:
            logging.error(f"Error al listar directorio '{import_path}': Permiso denegado.")
        except Exception as e_dir: # Error general listando el directorio
            logging.exception(f"Error inesperado al escanear directorio '{import_path}': {e_dir}")

        logging.info(f"Tarea de importación programada finalizada. Archivos encontrados: {file_count}. Archivos .xlsx procesados con éxito: {processed_count}.")

@app.route('/api/capitulos/<int:capitulo_id>/export/excel', methods=['GET'])
@login_required # O @roles_required si es necesario
def export_capitulo_to_excel(capitulo_id):
    available, error_response, status_code = check_services()
    if not available:
        return error_response, status_code

    logging.info(f"Solicitud de exportación Excel para capítulo ID: {capitulo_id} por usuario {session.get('user_id')}")

    try:
        excel_bytes_io, error_msg, filename_suggestion = handler_instance.export_single_chapter_to_excel_bytes(capitulo_id)

        if error_msg:
            # Si hay un mensaje de error, es probable que los datos no se hayan podido generar.
            status = 404 if "No se encontraron datos" in error_msg or "no existe" in error_msg else 500
            return jsonify({"error": error_msg}), status

        if not excel_bytes_io:
            logging.error(f"export_single_chapter_to_excel_bytes devolvió None para BytesIO sin error para capítulo ID {capitulo_id}")
            return jsonify({"error": "Error interno generando el archivo Excel."}), 500

        return send_file(
            excel_bytes_io,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename_suggestion or f"capitulo_{capitulo_id}_export.xlsx"
        )

    except Exception as e:
        logging.exception(f"Error crítico en GET /api/capitulos/{capitulo_id}/export/excel")
        return jsonify({"error": "Error interno del servidor al exportar el capítulo."}), 500


def scheduled_export_task_job():
    """Función de trabajo real para la exportación programada."""
    with app.app_context():
        logging.info("Ejecutando tarea de exportación programada...")
        if not handler_instance or not db_handler:
            logging.error("Exportación programada: DataHandler o DBHandler no disponible.")
            return

        config = handler_instance.get_io_configurations() # Leerá de la BD
        export_path = config.get("export_path")
        series_ids_config = config.get("export_series_ids", "all")

        if not export_path:
            logging.error("Ruta de exportación programada no configurada.")
            return

        if not os.path.isabs(export_path):
            logging.warning(f"La ruta de exportación '{export_path}' no es absoluta. Se resolverá relativa a: {os.getcwd()}")

        if not os.path.exists(export_path):
            logging.warning(f"La ruta de exportación '{export_path}' no existe. Intentando crearla...")
            try:
                os.makedirs(export_path, exist_ok=True)
                logging.info(f"Directorio de exportación '{export_path}' creado.")
            except OSError as e:
                logging.error(f"No se pudo crear el directorio de exportación '{export_path}': {e}")
                return
        elif not os.path.isdir(export_path):
            logging.error(f"La ruta de exportación configurada '{export_path}' EXISTE PERO NO ES UN DIRECTORIO.")
            return

        series_to_export = []
        if series_ids_config == "all":
            all_series_db = db_handler.execute_query("SELECT id FROM Series;", fetch_mode="all")
            series_to_export = [s['id'] for s in all_series_db] if all_series_db else []
        elif isinstance(series_ids_config, list) and all(isinstance(sid, int) for sid in series_ids_config) :
            series_to_export = series_ids_config

        if not series_to_export:
            logging.warning("Exportación programada: No hay series configuradas para exportar.")
            return

        try:
            success, message = handler_instance.export_series_to_excel(series_to_export, export_path)
            if success:
                logging.info(f"Exportación programada exitosa: {message}")
            else:
                logging.error(f"Exportación programada fallida: {message}")
        except Exception as e:
            logging.exception("Error crítico en tarea de exportación programada.")


# --- API Endpoints ---
# === Status ===
@app.route('/api/status', methods=['GET'])
def get_status():
    status_msg = "API activa"
    services_ok, _, _ = check_services()
    if not services_ok:
        status_msg += ", pero los servicios internos (base de datos) tienen problemas."
    else:
        status_msg += " y servicios internos OK."
    return jsonify({"status": status_msg}), 200

# === Series ===
@app.route('/api/series', methods=['GET'])
@login_required
def get_series():
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    try:
        series_list = handler_instance.get_all_series()
        return jsonify(series_list), 200
    except Exception as e:
        logging.exception("Error en GET /api/series")
        return jsonify({"error": "Error interno al obtener series."}), 500

@app.route('/api/series/<int:serie_id>', methods=['GET'])
@login_required
def get_serie_detail_endpoint(serie_id):
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    try:
        serie_details = handler_instance.get_serie_details(serie_id)
        if serie_details:
            return jsonify(serie_details), 200
        else:
            return jsonify({"error": f"Serie ID {serie_id} no encontrada."}), 404
    except Exception as e:
        logging.exception(f"Error en GET /api/series/{serie_id}")
        return jsonify({"error": "Error interno al obtener detalles de serie."}), 500

@app.route('/api/series', methods=['POST'])
@roles_required(['admin', 'director'])
def add_serie():
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    data = request.get_json()
    if not data or 'numero_referencia' not in data or 'nombre_serie' not in data:
        return jsonify({"error": "Faltan datos: numero_referencia, nombre_serie"}), 400
    num_ref = str(data['numero_referencia']).strip()
    nom_ser = str(data['nombre_serie']).strip()
    if not num_ref or not nom_ser:
        return jsonify({"error": "Numero de referencia y nombre de serie no pueden estar vacíos."}), 400
    try:
        new_serie_id = handler_instance.add_serie(num_ref, nom_ser)
        if new_serie_id:
            new_serie_details = db_handler.get_serie_by_id(new_serie_id)
            if new_serie_details:
                 return jsonify(new_serie_details), 201
            else:
                 logging.error(f"No se pudo recuperar la serie ID {new_serie_id} recién creada.")
                 return jsonify({"message": f"Serie '{nom_ser}' añadida con ID {new_serie_id}, pero no se pudo recuperar completa.", "id": new_serie_id}), 201
        else:
            error_message = f"No se pudo añadir serie. ¿Ref '{num_ref}' o Nombre '{nom_ser}' ya existen o son inválidos?"
            return jsonify({"error": error_message}), 409
    except Exception as e:
        logging.exception("Error inesperado en POST /api/series")
        return jsonify({"error": "Error interno al añadir serie."}), 500

@app.route('/api/series/<int:serie_id>', methods=['DELETE'])
@roles_required(['admin'])
def delete_serie_endpoint(serie_id):
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    logging.info(f"Petición DELETE para serie ID: {serie_id} por usuario {session.get('user_nombre')} (Rol: {session.get('user_rol')})")
    try:
        success = handler_instance.delete_serie(serie_id)
        if success:
            return jsonify({"message": f"Serie ID {serie_id} eliminada."}), 200
        else:
            return jsonify({"error": f"No se pudo eliminar serie ID {serie_id}. ¿Existe?"}), 404
    except Exception as e:
        logging.exception(f"Error inesperado en DELETE /api/series/{serie_id}")
        return jsonify({"error": "Error interno al eliminar serie."}), 500

# === Capítulos ===
@app.route('/api/series/<int:serie_id>/capitulos', methods=['GET'])
@login_required
def get_capitulos_by_serie(serie_id):
    # ... (código existente sin cambios)
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    try:
        capitulos_list = handler_instance.get_capitulos_for_serie(serie_id)
        return jsonify(capitulos_list), 200
    except Exception as e:
        logging.exception(f"Error en GET /api/series/{serie_id}/capitulos")
        return jsonify({"error": "Error interno al obtener capítulos."}), 500

@app.route('/api/capitulos/<int:capitulo_id>/details', methods=['GET'])
@login_required
def get_chapter_data(capitulo_id):
    # ... (código existente sin cambios)
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    logging.info(f"Acceso a detalles capítulo {capitulo_id} por User ID: {session.get('user_id')}")
    try:
        capitulo_details, takes_data = handler_instance.get_chapter_details_with_takes(capitulo_id)
        if capitulo_details is None and (takes_data is None or not takes_data):
             return jsonify({"error": f"Capítulo ID {capitulo_id} no encontrado o sin datos."}), 404
        return jsonify({"capitulo": capitulo_details, "takes": takes_data or []}), 200
    except Exception as e:
        logging.exception(f"Error en GET /api/capitulos/{capitulo_id}/details")
        return jsonify({"error": "Error interno al obtener detalles del capítulo."}), 500

# === Intervenciones ===
@app.route('/api/intervenciones/<int:intervention_id>/status', methods=['PATCH'])
@roles_required(['tecnico', 'admin', 'director'])
def update_intervention_status_endpoint(intervention_id):
    # ... (código existente sin cambios)
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    data = request.get_json()
    if data is None or 'completo' not in data or not isinstance(data['completo'], bool):
        return jsonify({"error": "Falta campo 'completo' (boolean) en JSON."}), 400
    new_state = data['completo']
    user_id = session['user_id']
    logging.info(f"Petición PATCH estado intervención ID {intervention_id} a {new_state} por usuario {user_id} (Rol: {session.get('user_rol')})")
    try:
        success = handler_instance.mark_intervention_complete(intervention_id, new_state, user_id)
        if success:
            return jsonify({"message": "Estado actualizado."}), 200
        else:
            return jsonify({"error": f"No se pudo actualizar intervención ID {intervention_id}. ¿Existe?"}), 404
    except Exception as e:
        logging.exception(f"Error inesperado en PATCH /api/intervenciones/{intervention_id}/status")
        return jsonify({"error": "Error interno al actualizar estado."}), 500

@app.route('/api/intervenciones/<int:interv_id>/dialogo', methods=['PATCH'])
@roles_required(['director', 'admin'])
def update_dialogue(interv_id):
    # ... (código existente sin cambios)
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    data = request.get_json(silent=True) or {}
    nuevo_dialogo = data.get('dialogo')
    if nuevo_dialogo is None:
        return jsonify({"error": "Campo 'dialogo' (string) requerido en el cuerpo JSON."}), 400

    logging.info(f"Petición PATCH diálogo intervención ID {interv_id} por usuario {session.get('user_id')} (Rol: {session.get('user_rol')})")
    success = handler_instance.update_dialogue(interv_id, str(nuevo_dialogo).strip())
    if success:
        return jsonify({"message": "Diálogo actualizado"}), 200
    return jsonify({"error": "Intervención no encontrada o error al actualizar"}), 404

@app.route('/api/intervenciones/<int:interv_id>/timecode', methods=['PATCH'])
@roles_required(['tecnico', 'director', 'admin'])
def update_timecode_endpoint(interv_id):
    # ... (código existente sin cambios)
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    data = request.get_json(silent=True) or {}
    tc_in  = data.get('tc_in')
    tc_out = data.get('tc_out')
    if tc_in is None and tc_out is None:
        return jsonify({"error": "Se requiere al menos 'tc_in' o 'tc_out' para actualizar."}), 400

    ok = handler_instance.update_intervention_timecode(interv_id, tc_in=tc_in, tc_out=tc_out)
    if ok:
        return jsonify({"message": "Timecode actualizado", "updated_tc_in": tc_in, "updated_tc_out": tc_out}), 200
    return jsonify({"error": f"Intervención {interv_id} no encontrada o error al actualizar timecode"}), 404


# === Importación ===
@app.route('/api/import/excel', methods=['POST'])
@roles_required(['admin', 'director'])
def import_excel():
    # ... (código existente sin cambios)
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    logging.info(f"Intento de importación por usuario {session.get('user_id')} (Rol: {session.get('user_rol')})")
    if 'file' not in request.files: return jsonify({"error": "Falta archivo ('file')."}), 400
    file = request.files['file']
    if not file or not file.filename: return jsonify({"error": "Archivo no seleccionado o inválido."}), 400
    if not (file.filename.lower().endswith('.xlsx')):
        return jsonify({"error": "Formato inválido (solo .xlsx)."}), 400

    filename = secure_filename(file.filename)
    # Definir filepath aquí para que esté disponible en el finally
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    try:
        file.save(filepath)
        logging.info(f"Archivo '{filename}' guardado en '{filepath}' para importación.")
        success, message = handler_instance.import_chapter_from_excel(filepath)
        status_code_resp = 200 if success else (400 if "Falta" in message or "Inválido" in message or "Error al procesar" in message else 500)
        response_json = {"message": message} if success else {"error": message}
        return jsonify(response_json), status_code_resp
    except Exception as e:
        logging.exception(f"Error CRÍTICO procesando importación '{filename}'")
        return jsonify({"error": "Error interno grave durante la importación."}), 500
    finally:
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                logging.info(f"Archivo temporal '{filepath}' eliminado.")
            except OSError as e_rem:
                logging.error(f"Error eliminando temporal '{filepath}': {e_rem}")

# === Autenticación ===
@app.route('/api/register', methods=['POST'])
def register_user():
    # ... (código existente sin cambios)
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    data = request.get_json()
    if not data or 'nombre' not in data or 'password' not in data:
        return jsonify({"error": "Faltan 'nombre' o 'password'."}), 400
    nombre = str(data['nombre']).strip()
    password = str(data['password'])
    rol_solicitado = str(data.get('rol', 'tecnico')).strip().lower()
    allowed_register_roles = ['tecnico', 'director']
    if rol_solicitado not in allowed_register_roles:
        logging.warning(f"Intento de registro con rol no permitido '{rol_solicitado}'. Se usará 'tecnico'.")
        rol_solicitado = 'tecnico'
    if not nombre: return jsonify({"error": "El nombre no puede estar vacío."}), 400
    if len(password) < 6: return jsonify({"error": "Contraseña debe tener al menos 6 caracteres."}), 400
    try:
        if db_handler.get_user_by_name(nombre):
             return jsonify({"error": f"El nombre de usuario '{nombre}' ya está en uso."}), 409
        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        new_user_id = db_handler.add_user(nombre, password_hash, rol_solicitado)
        if new_user_id:
            user_created = {"id": new_user_id, "nombre": nombre, "rol": rol_solicitado}
            return jsonify({"message": f"Usuario '{nombre}' (Rol: {rol_solicitado}) registrado.", "user": user_created}), 201
        else:
            return jsonify({"error": f"No se pudo registrar el usuario '{nombre}'. Podría ya existir o el rol ser inválido."}), 400
    except Exception as e:
        logging.exception("Error inesperado en POST /api/register")
        return jsonify({"error": "Error interno al registrar usuario."}), 500

@app.route('/api/login', methods=['POST'])
def login_user():
    # ... (código existente sin cambios)
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    data = request.get_json()
    if not data or 'nombre' not in data or 'password' not in data:
        return jsonify({"error": "Faltan 'nombre' o 'password'."}), 400
    nombre = str(data['nombre']).strip()
    password = str(data['password'])
    user_data = db_handler.get_user_by_name(nombre)
    if user_data and bcrypt.check_password_hash(user_data['password_hash'], password):
        session.permanent = True
        session['user_id'] = user_data['id']
        session['user_nombre'] = user_data['nombre']
        session['user_rol'] = user_data['rol']
        logging.info(f"Login OK: User '{nombre}' (ID: {user_data['id']}, Rol: {user_data['rol']}) - Session data set.")
        response_data = {
            "message": "Inicio de sesión exitoso",
            "user": {"id": user_data['id'], "nombre": user_data['nombre'], "rol": user_data['rol']}
        }
        return jsonify(response_data), 200
    else:
        logging.warning(f"Login FAILED for user '{nombre}' - Invalid credentials.")
        return jsonify({"error": "Nombre de usuario o contraseña incorrectos."}), 401

@app.route('/api/logout', methods=['POST'])
def logout_user():
    # ... (código existente sin cambios)
    user_id_before_clear = session.get('user_id')
    session.clear()
    message = "Sesión cerrada."
    if not user_id_before_clear:
        message += " (No había sesión activa)."
    logging.info(f"Logout attempt. Cleared session for former user ID: {user_id_before_clear}")
    resp = make_response(jsonify({"message": message}), 200)
    return resp

@app.route('/api/users/me', methods=['GET'])
@login_required
def get_current_user():
    # ... (código existente sin cambios)
    user_data_from_session = {
        "id": session['user_id'],
        "nombre": session['user_nombre'],
        "rol": session['user_rol']
    }
    logging.info(f"User data from session for /api/users/me: {user_data_from_session}")
    return jsonify({"user": user_data_from_session}), 200

# === Endpoints de Administración de Usuarios ===
@app.route('/api/users', methods=['GET'])
@roles_required(['admin'])
def get_all_users_endpoint():
    # ... (código existente sin cambios)
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    search_term = request.args.get('search', None)
    sort_by = request.args.get('sortBy', 'nombre')
    sort_order = request.args.get('sortOrder', 'ASC')
    try:
        users_list = db_handler.list_all_users(
            search_term=search_term,
            sort_by=sort_by,
            sort_order=sort_order
        )
        return jsonify(users_list), 200
    except Exception as e:
        logging.exception(f"Error en GET /api/users (search: {search_term}, sort: {sort_by} {sort_order})")
        return jsonify({"error": "Error interno al listar usuarios."}), 500

@app.route('/api/users/<int:user_id>/role', methods=['PUT'])
@roles_required(['admin'])
def update_user_role_endpoint(user_id):
    # ... (código existente sin cambios)
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    data = request.get_json()
    if not data or 'rol' not in data:
        return jsonify({"error": "Falta el campo 'rol' en el cuerpo JSON."}), 400
    new_role = str(data['rol']).strip().lower()

    logging.info(f"Admin (ID: {session.get('user_id')}) intentando cambiar rol de usuario ID {user_id} a '{new_role}'")
    try:
        success = db_handler.update_user_role(user_id, new_role)
        if success:
            return jsonify({"message": f"Rol del usuario ID {user_id} actualizado a '{new_role}'."}), 200
        else:
            return jsonify({"error": f"No se pudo actualizar el rol para el usuario ID {user_id}. Verifique que el ID existe y el rol es válido."}), 400
    except Exception as e:
        logging.exception(f"Error en PUT /api/users/{user_id}/role")
        return jsonify({"error": "Error interno al actualizar rol de usuario."}), 500


# === Endpoints para Gestión de Import/Export (Usan handler actualizado) ===
@app.route('/api/admin/io/config', methods=['GET'])
@roles_required(['admin'])
def get_io_config_endpoint():
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    try:
        config = handler_instance.get_io_configurations() # Esto ahora lee de BD con defaults
        return jsonify(config), 200
    except Exception as e:
        logging.exception("Error en GET /api/admin/io/config")
        return jsonify({"error": "Error interno al obtener configuración de I/O."}), 500

@app.route('/api/admin/io/config', methods=['POST'])
@roles_required(['admin'])
def save_io_config_endpoint():
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code

    data = request.get_json()
    if not data:
        return jsonify({"error": "Faltan datos de configuración."}), 400

    try:
        # Guardar en BD primero
        success_save_db, message_save_db = handler_instance.save_io_configurations(data)
        if not success_save_db:
            return jsonify({"error": message_save_db}), 500 # O 400 si es error de validación

        # (Re)Programar tareas en APScheduler
        import_schedule_str = data.get("import_schedule")
        export_schedule_str = data.get("export_schedule")

        # Import Job
        if scheduler.get_job(id='scheduled_import_task'):
            scheduler.remove_job(id='scheduled_import_task')
            logging.info("Tarea de importación programada existente eliminada.")
        if import_schedule_str and import_schedule_str != "manual":
            if "daily@" in import_schedule_str:
                try:
                    time_str = import_schedule_str.split('@')[1]
                    hour, minute = time_str.split(':')
                    scheduler.add_job(id='scheduled_import_task', func=scheduled_import_task_job, trigger='cron', hour=hour, minute=minute, replace_existing=True)
                    logging.info(f"Tarea de importación programada/actualizada para {hour}:{minute} diariamente.")
                except Exception as e_sched:
                    logging.error(f"Error al programar tarea de importación con '{import_schedule_str}': {e_sched}")
            elif "hourly" == import_schedule_str:
                 scheduler.add_job(id='scheduled_import_task', func=scheduled_import_task_job, trigger='interval', hours=1, replace_existing=True)
                 logging.info(f"Tarea de importación programada/actualizada para ejecutarse cada hora.")
            # Añadir más lógicas de parseo de schedule aquí (ej. weekly)

        # Export Job
        if scheduler.get_job(id='scheduled_export_task'):
            scheduler.remove_job(id='scheduled_export_task')
            logging.info("Tarea de exportación programada existente eliminada.")
        if export_schedule_str and export_schedule_str != "manual":
            if "daily@" in export_schedule_str:
                try:
                    time_str = export_schedule_str.split('@')[1]
                    hour, minute = time_str.split(':')
                    scheduler.add_job(id='scheduled_export_task', func=scheduled_export_task_job, trigger='cron', hour=hour, minute=minute, replace_existing=True)
                    logging.info(f"Tarea de exportación programada/actualizada para {hour}:{minute} diariamente.")
                except Exception as e_sched:
                    logging.error(f"Error al programar tarea de exportación con '{export_schedule_str}': {e_sched}")
            elif "weekly@" in export_schedule_str: # Ejemplo: weekly@sunday@04:00
                try:
                    parts = export_schedule_str.split('@') # ['weekly', 'sunday', '04:00']
                    day_of_week_str = parts[1]
                    time_str = parts[2]
                    hour, minute = time_str.split(':')
                    scheduler.add_job(id='scheduled_export_task', func=scheduled_export_task_job, trigger='cron', day_of_week=day_of_week_str[:3].lower(), hour=hour, minute=minute, replace_existing=True)
                    logging.info(f"Tarea de exportación programada/actualizada para {day_of_week_str.capitalize()}s a las {hour}:{minute}.")
                except Exception as e_sched:
                    logging.error(f"Error al programar tarea de exportación semanal con '{export_schedule_str}': {e_sched}")
            # Añadir más lógicas de parseo de schedule aquí

        return jsonify({"message": message_save_db + " Programación de tareas actualizada (si aplica)."}), 200

    except Exception as e:
        logging.exception("Error en POST /api/admin/io/config")
        return jsonify({"error": "Error interno al guardar configuración de I/O."}), 500

# === Endpoint para Importar Ahora (NUEVO) ===
@app.route('/api/admin/import/now', methods=['POST'])
@roles_required(['admin'])
def import_now_endpoint():
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code

    data = request.get_json() or {} # Permitir cuerpo vacío, ya que el path se toma de la config
    import_path_override = data.get('import_path_override') # Opcional, por si quieres permitir un override

    # Usar path configurado si no hay override
    current_config = handler_instance.get_io_configurations() # Lee de BD con defaults
    final_import_path = import_path_override if import_path_override else current_config.get("import_path")

    if not final_import_path:
        return jsonify({"error": "No se ha definido una ruta de importación (ni override ni en configuración)."}), 400

    if not os.path.isabs(final_import_path):
        logging.warning(f"La ruta de importación para 'Importar Ahora' '{final_import_path}' no es absoluta. Se resolverá relativa a: {os.getcwd()}")

    if not os.path.exists(final_import_path):
        logging.error(f"La ruta de importación para 'Importar Ahora' '{final_import_path}' NO EXISTE en el contenedor.")
        return jsonify({"error": f"La ruta de importación '{final_import_path}' no existe en el servidor."}), 404 # 404 o 400

    if not os.path.isdir(final_import_path):
        logging.error(f"La ruta de importación para 'Importar Ahora' '{final_import_path}' EXISTE PERO NO ES UN DIRECTORIO.")
        return jsonify({"error": f"La ruta de importación '{final_import_path}' no es un directorio."}), 400

    logging.info(f"Importar Ahora: Escaneando directorio '{final_import_path}'...")
    
    processed_files_summary = []
    error_files_summary = []
    files_found = 0
    
    try:
        for filename in os.listdir(final_import_path):
            files_found += 1
            if filename.lower().endswith('.xlsx'):
                filepath = os.path.join(final_import_path, filename)
                try:
                    logging.info(f"Procesando archivo para Importar Ahora: {filepath}")
                    success, message = handler_instance.import_chapter_from_excel(filepath)
                    if success:
                        logging.info(f"Importación de '{filename}' exitosa: {message}")
                        processed_files_summary.append({"filename": filename, "message": message, "status": "success"})
                        # Opcional: Mover archivo procesado
                        # processed_dir = os.path.join(final_import_path, "IMPORTADOS")
                        # os.makedirs(processed_dir, exist_ok=True)
                        # try:
                        #     os.rename(filepath, os.path.join(processed_dir, filename))
                        # except OSError as e_move:
                        #     logging.error(f"No se pudo mover '{filename}' a IMPORTADOS: {e_move}")
                    else:
                        logging.error(f"Importación de '{filename}' fallida: {message}")
                        error_files_summary.append({"filename": filename, "error": message, "status": "error"})
                except Exception as e_file:
                    logging.exception(f"Error crítico en importación de '{filename}': {e_file}")
                    error_files_summary.append({"filename": filename, "error": str(e_file), "status": "critical_error"})
        
        total_processed = len(processed_files_summary)
        total_errors = len(error_files_summary)
        
        if total_processed == 0 and total_errors == 0 and files_found > 0:
            return jsonify({
                "message": f"No se encontraron archivos .xlsx en '{final_import_path}'. Total de archivos escaneados: {files_found}.",
                "processed_count": 0,
                "error_count": 0,
                "details": []
            }), 200 # O 404 si se considera que no encontrar .xlsx es un "no encontrado"
        
        final_message = f"Proceso de Importar Ahora completado. {total_processed} archivo(s) importado(s) con éxito, {total_errors} con errores."
        if total_errors > 0 :
             return jsonify({
                "message": final_message,
                "processed_count": total_processed,
                "error_count": total_errors,
                "details": processed_files_summary + error_files_summary
            }), 400 # Si hubo errores, devolver un status que lo refleje, ej 400 o 207 (Multi-Status)
        
        return jsonify({
            "message": final_message,
            "processed_count": total_processed,
            "error_count": total_errors,
            "details": processed_files_summary
        }), 200

    except FileNotFoundError:
        logging.error(f"Error al listar directorio '{final_import_path}' para Importar Ahora: No encontrado.")
        return jsonify({"error": f"El directorio de importación '{final_import_path}' no fue encontrado."}), 404
    except PermissionError:
        logging.error(f"Error al listar directorio '{final_import_path}' para Importar Ahora: Permiso denegado.")
        return jsonify({"error": f"Permiso denegado para acceder al directorio '{final_import_path}'."}), 403
    except Exception as e:
        logging.exception(f"Error inesperado durante Importar Ahora desde '{final_import_path}'")
        return jsonify({"error": f"Error interno durante la importación: {str(e)}"}), 500


@app.route('/api/admin/export/now', methods=['POST'])
@roles_required(['admin'])
def export_now_endpoint():
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code

    data = request.get_json()
    if not data:
        return jsonify({"error": "Faltan datos para exportación."}), 400

    export_path_override = data.get('export_path_override')
    series_ids_input = data.get('series_ids_to_export')

    # Usar path configurado si no hay override
    current_config = handler_instance.get_io_configurations() # Lee de BD con defaults
    final_export_path = export_path_override if export_path_override else current_config.get("export_path")

    if not final_export_path: # Si después de todo no hay path
        return jsonify({"error": "No se ha definido una ruta de exportación (ni override ni en configuración)."}), 400

    if not os.path.isabs(final_export_path):
        logging.warning(f"La ruta de exportación para 'Exportar Ahora' '{final_export_path}' no es absoluta. Se resolverá relativa a: {os.getcwd()}")

    if not os.path.exists(final_export_path):
        logging.warning(f"La ruta de exportación para 'Exportar Ahora' '{final_export_path}' no existe. Intentando crearla...")
        try:
            os.makedirs(final_export_path, exist_ok=True)
            logging.info(f"Directorio de exportación '{final_export_path}' creado.")
        except OSError as e:
            logging.error(f"No se pudo crear el directorio de exportación '{final_export_path}': {e}")
            return jsonify({"error": f"No se pudo crear el directorio de exportación: {e}"}), 500
    elif not os.path.isdir(final_export_path):
        logging.error(f"La ruta de exportación para 'Exportar Ahora' '{final_export_path}' EXISTE PERO NO ES UN DIRECTORIO.")
        return jsonify({"error": f"La ruta de exportación '{final_export_path}' no es un directorio."}), 400


    series_to_export = []
    if series_ids_input == "all":
        all_series_db = db_handler.execute_query("SELECT id FROM Series;", fetch_mode="all")
        series_to_export = [s['id'] for s in all_series_db] if all_series_db else []
    elif isinstance(series_ids_input, list) and all(isinstance(sid, int) for sid in series_ids_input):
        series_to_export = series_ids_input
    else:
        return jsonify({"error": "Formato de 'series_ids_to_export' inválido. Debe ser 'all' o una lista de IDs enteros."}), 400

    if not series_to_export:
        return jsonify({"message": "No hay series seleccionadas para exportar."}), 200

    try:
        success, message = handler_instance.export_series_to_excel(series_to_export, final_export_path)
        if success:
            return jsonify({"message": message, "exported_to_path": final_export_path}), 200
        else:
            return jsonify({"error": message}), 500

    except Exception as e:
        logging.exception("Error en POST /api/admin/export/now")
        return jsonify({"error": "Error interno durante la exportación."}), 500


# --- Main Execution ---
if __name__ == '__main__':
    is_production = os.getenv('FLASK_ENV') == 'production'
    use_reloader_status = not is_production and os.environ.get("WERKZEUG_RUN_MAIN") == "true"

    # Inicializar y arrancar APScheduler solo en el proceso principal de Werkzeug cuando el reloader está activo,
    # o siempre si el reloader no está activo (o en producción).
    if not scheduler.running:
        if use_reloader_status or is_production or os.environ.get("WERKZEUG_RUN_MAIN") is None:
            scheduler.init_app(app)
            scheduler.start(paused=False) # Iniciar y asegurar que no esté pausado
            logging.info("APScheduler inicializado y arrancado.")
        else:
            logging.info("APScheduler NO se iniciará en este proceso hijo de Werkzeug (reloader).")


    app.run(
        debug=not is_production,
        host=os.getenv('FLASK_RUN_HOST', '0.0.0.0'),
        port=int(os.getenv('FLASK_RUN_PORT', 5000)),
        use_reloader=not is_production
    )