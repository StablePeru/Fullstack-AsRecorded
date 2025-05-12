# -*- coding: utf-8 -*-
"""
api_app.py - Flask Backend API
"""

# --- Standard Library Imports ---
import logging
import os
from functools import wraps # Para decoradores de roles

# --- Flask and Extensions Imports ---
from flask import Flask, request, jsonify, session, make_response
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from werkzeug.utils import secure_filename

# --- Local Application Imports ---
try:
    import data_handler # Aunque no se use mucho directamente si db_handler es robusto
    import db_handler # Importante para acceso directo a funciones de BD
    DataHandler = data_handler.DataHandler # Para mantener la estructura si se usa
except ImportError as e:
    logging.critical(f"Error CRÍTICO al importar módulos locales (data_handler, db_handler): {e}")
    DataHandler = None
    db_handler = None # Marcar como None para que check_services falle
    # Mockear solo si es estrictamente necesario para que la app arranque parcialmente
    # pero es mejor que falle y se corrija el import.

# --- Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)

# --- Flask App Initialization ---
app = Flask(__name__)

# --- Configuration Settings ---
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-deberia-ser-larga-y-aleatoria')
app.config['SESSION_COOKIE_NAME'] = 'flask_session_asrecorded' # Nombre único
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = os.getenv('FLASK_ENV') == 'production'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
# Configuración para subida de archivos (opcional, pero buena práctica)
UPLOAD_FOLDER = os.path.join(app.root_path, 'temp_uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# --- Flask Extensions Initialization ---
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://127.0.0.1:5173"]) # Ajustar según sea necesario
bcrypt = Bcrypt(app)

# --- Service/Handler Initialization ---
# Ahora handler puede ser None si DataHandler no es esencial y db_handler sí.
# DataHandler podría ser una capa de lógica de negocio más compleja.
# Si db_handler hace todo, handler puede ser menos crítico.
handler_instance = DataHandler() if DataHandler and db_handler else None # Renombrar para evitar conflicto de nombre
if not db_handler: # db_handler es más crítico para operaciones directas
     logging.critical("FATAL: No se pudo inicializar/importar db_handler.")
# Si DataHandler es una capa importante y falla:
# if not handler_instance:
#    logging.critical("FATAL: No se pudo inicializar DataHandler.")


# --- Helper Functions & Decorators ---
def check_services():
    # Priorizar db_handler si es el que se usa más directamente
    if not db_handler: # o not handler_instance si DataHandler es crucial
        logging.error("Error: Módulos de base de datos (db_handler) no inicializados.")
        # Devolver un 503 Service Unavailable
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
    """Decorador para verificar si el usuario tiene uno de los roles permitidos."""
    if not isinstance(allowed_roles, list): # Asegurar que allowed_roles es una lista
        allowed_roles = [allowed_roles]
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Primero, asegurar que está logueado (repite lógica de login_required, pero es bueno tenerlo autocontenido)
            if 'user_id' not in session:
                return jsonify({"message": "Acceso no autorizado. Por favor, inicie sesión.", "error_code": "UNAUTHORIZED"}), 401

            user_role = session.get('user_rol')
            if not user_role or user_role not in allowed_roles:
                logging.warning(f"Usuario ID {session.get('user_id')} con rol '{user_role}' intentó acceder a recurso protegido para roles {allowed_roles} en {request.path}.")
                return jsonify({"message": "Permiso denegado para este recurso.", "error_code": "FORBIDDEN"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# --- API Endpoints ---

# === Status ===
@app.route('/api/status', methods=['GET'])
def get_status():
    status_msg = "API activa"
    services_ok, _, _ = check_services() # Solo necesitamos el booleano aquí
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
        # Asumiendo que handler_instance.get_all_series() existe y funciona
        series_list = handler_instance.get_all_series() if handler_instance else db_handler.get_all_series_direct() # Necesitarías una función directa en db_handler
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
        serie_details = handler_instance.get_serie_details(serie_id) if handler_instance else db_handler.get_serie_by_id(serie_id)
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
        # add_serie en handler_instance ahora devuelve el ID de la nueva serie o None
        new_serie_id = handler_instance.add_serie(num_ref, nom_ser) if handler_instance else db_handler.add_new_serie(num_ref, nom_ser)

        if new_serie_id:
            # Obtener la serie recién creada para devolverla completa
            new_serie_details = db_handler.get_serie_by_id(new_serie_id)
            if new_serie_details:
                 return jsonify(new_serie_details), 201 # Retornar el objeto completo
            else: # Esto sería inesperado si se acaba de crear
                 logging.error(f"No se pudo recuperar la serie ID {new_serie_id} recién creada.")
                 return jsonify({"message": f"Serie '{nom_ser}' añadida con ID {new_serie_id}, pero no se pudo recuperar."}), 201

        else: # Si add_serie devuelve None (o False si DataHandler no fue actualizado)
            error_message = f"No se pudo añadir serie. ¿Ref '{num_ref}' o Nombre '{nom_ser}' ya existen o son inválidos?"
            return jsonify({"error": error_message}), 409 # Conflict
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
        success = handler_instance.delete_serie(serie_id) if handler_instance else db_handler.delete_serie_by_id(serie_id)
        if success:
            return jsonify({"message": f"Serie ID {serie_id} eliminada."}), 200 # OK
        else:
            # delete_serie devuelve False si la serie no existe o hay error en DB
            return jsonify({"error": f"No se pudo eliminar serie ID {serie_id}. ¿Existe o hay datos asociados que impiden el borrado?"}), 404 # Not Found o Bad Request
    except Exception as e:
        logging.exception(f"Error inesperado en DELETE /api/series/{serie_id}")
        return jsonify({"error": "Error interno al eliminar serie."}), 500

# === Capítulos ===
@app.route('/api/series/<int:serie_id>/capitulos', methods=['GET'])
@login_required
def get_capitulos_by_serie(serie_id):
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code
    try:
        # Asumiendo que get_capitulos_for_serie existe y funciona
        capitulos_list = handler_instance.get_capitulos_for_serie(serie_id) if handler_instance else db_handler.get_capitulos_for_serie_direct(serie_id)
        return jsonify(capitulos_list), 200
    except Exception as e:
        logging.exception(f"Error en GET /api/series/{serie_id}/capitulos")
        return jsonify({"error": "Error interno al obtener capítulos."}), 500

@app.route('/api/capitulos/<int:capitulo_id>/details', methods=['GET'])
@login_required
def get_chapter_data(capitulo_id):
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code

    logging.info(f"Acceso a detalles capítulo {capitulo_id} por User ID: {session['user_id']}")
    try:
        # get_chapter_details_with_takes ahora está en handler_instance
        capitulo_details, takes_data = handler_instance.get_chapter_details_with_takes(capitulo_id) if handler_instance else (db_handler.get_capitulo_details(capitulo_id), db_handler.get_takes_and_interventions_for_chapter(capitulo_id))

        if capitulo_details is None and (takes_data is None or not takes_data): # Si capítulo no existe y no hay takes
             return jsonify({"error": f"Capítulo ID {capitulo_id} no encontrado o sin datos."}), 404
        return jsonify({"capitulo": capitulo_details, "takes": takes_data or []}), 200
    except Exception as e:
        logging.exception(f"Error en GET /api/capitulos/{capitulo_id}/details")
        return jsonify({"error": "Error interno al obtener detalles del capítulo."}), 500

# === Intervenciones ===
@app.route('/api/intervenciones/<int:intervention_id>/status', methods=['PATCH'])
@roles_required(['tecnico', 'admin'])
def update_intervention_status_endpoint(intervention_id):
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code

    data = request.get_json()
    if data is None or 'completo' not in data or not isinstance(data['completo'], bool):
        return jsonify({"error": "Falta campo 'completo' (boolean) en JSON."}), 400

    new_state = data['completo']
    user_id = session['user_id']

    logging.info(f"Petición PATCH estado intervención ID {intervention_id} a {new_state} por usuario {user_id} (Rol: {session.get('user_rol')})")
    try:
        success = handler_instance.mark_intervention_complete(intervention_id, new_state, user_id) if handler_instance else db_handler.update_intervention_status(intervention_id, new_state, user_id)
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
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code

    data = request.get_json(silent=True) or {} # silent=True para que no falle si no hay JSON
    nuevo_dialogo = data.get('dialogo')

    if nuevo_dialogo is None: # Chequea si la key 'dialogo' existe y no es None
        return jsonify({"error": "Campo 'dialogo' (string) requerido en el cuerpo JSON."}), 400

    logging.info(f"Petición PATCH diálogo intervención ID {interv_id} por usuario {session.get('user_id')} (Rol: {session.get('user_rol')})")

    success = handler_instance.update_dialogue(interv_id, nuevo_dialogo.strip()) if handler_instance else db_handler.update_intervention_dialogue(interv_id, nuevo_dialogo.strip())
    if success:
        # Podríamos devolver la intervención actualizada si fuera necesario
        return jsonify({"message": "Diálogo actualizado"}), 200
    return jsonify({"error": "Intervención no encontrada o error al actualizar"}), 404 # O 500 si fue un error de DB

# === Importación ===
@app.route('/api/import/excel', methods=['POST'])
@roles_required(['admin', 'director']) # Ajustado a admin o director
def import_excel():
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code

    logging.info(f"Intento de importación por usuario {session.get('user_id')} (Rol: {session.get('user_rol')})")

    if 'file' not in request.files: return jsonify({"error": "Falta archivo ('file')."}), 400
    file = request.files['file']
    if not file or not file.filename: return jsonify({"error": "Archivo no seleccionado o inválido."}), 400
    if not (file.filename.lower().endswith('.xlsx')): # Solo .xlsx
        return jsonify({"error": "Formato inválido (solo .xlsx)."}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    try:
        file.save(filepath)
        logging.info(f"Archivo '{filename}' guardado en '{filepath}' para importación.")

        # Asumiendo que handler_instance.import_chapter_from_excel realiza la lógica
        success, message = handler_instance.import_chapter_from_excel(filepath) if handler_instance else (False, "Servicio de importación no disponible")

        status_code_resp = 200 if success else (400 if "Falta" in message or "Inválido" in message or "Error al procesar" in message else 500)
        response_json = {"message": message} if success else {"error": message}
        return jsonify(response_json), status_code_resp
    except Exception as e:
        logging.exception(f"Error CRÍTICO procesando importación '{filename}'")
        return jsonify({"error": "Error interno grave durante la importación."}), 500
    finally:
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
                logging.info(f"Archivo temporal '{filepath}' eliminado.")
            except OSError as e_rem:
                logging.error(f"Error eliminando temporal '{filepath}': {e_rem}")

# === Autenticación ===
@app.route('/api/register', methods=['POST'])
def register_user():
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code

    data = request.get_json()
    if not data or 'nombre' not in data or 'password' not in data:
        return jsonify({"error": "Faltan 'nombre' o 'password'."}), 400

    nombre = str(data['nombre']).strip()
    password = str(data['password'])
    # Permitir registrarse solo como 'tecnico' o 'director'. Admin se crea manualmente o por otro proceso.
    rol_solicitado = str(data.get('rol', 'tecnico')).strip().lower()
    allowed_register_roles = ['tecnico', 'director']

    if rol_solicitado not in allowed_register_roles:
        # Si se intenta registrar como 'admin' o rol inválido, forzar a 'tecnico' o rechazar.
        # Por ahora, forzamos a 'tecnico' si es un rol no permitido.
        logging.warning(f"Intento de registro con rol no permitido '{rol_solicitado}'. Se usará 'tecnico'.")
        rol_solicitado = 'tecnico'

    if not nombre: return jsonify({"error": "El nombre no puede estar vacío."}), 400
    if len(password) < 6: return jsonify({"error": "Contraseña debe tener al menos 6 caracteres."}), 400

    try:
        if db_handler.get_user_by_name(nombre):
             return jsonify({"error": f"El nombre de usuario '{nombre}' ya está en uso."}), 409 # Conflict

        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        new_user_id = db_handler.add_user(nombre, password_hash, rol_solicitado)

        if new_user_id:
            # Devolver el usuario creado (sin el hash)
            user_created = {"id": new_user_id, "nombre": nombre, "rol": rol_solicitado}
            return jsonify({"message": f"Usuario '{nombre}' (Rol: {rol_solicitado}) registrado.", "user": user_created}), 201
        else:
            # add_user devuelve None si hay error (ej. UniqueViolation que no fue capturada antes, o CheckViolation)
            return jsonify({"error": f"No se pudo registrar el usuario '{nombre}'. Podría ya existir o el rol ser inválido."}), 400 # Bad Request
    except Exception as e:
        logging.exception("Error inesperado en POST /api/register")
        return jsonify({"error": "Error interno al registrar usuario."}), 500

@app.route('/api/login', methods=['POST'])
def login_user():
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code

    data = request.get_json()
    if not data or 'nombre' not in data or 'password' not in data:
        return jsonify({"error": "Faltan 'nombre' o 'password'."}), 400

    nombre = str(data['nombre']).strip()
    password = str(data['password'])

    user_data = db_handler.get_user_by_name(nombre)

    if user_data and bcrypt.check_password_hash(user_data['password_hash'], password):
        session.permanent = True # Opcional: para que la sesión dure más
        session['user_id'] = user_data['id']
        session['user_nombre'] = user_data['nombre']
        session['user_rol'] = user_data['rol']
        logging.info(f"Login OK: User '{nombre}' (ID: {user_data['id']}, Rol: {user_data['rol']}) - Session data set.")

        response_data = {
            "message": "Inicio de sesión exitoso",
            "user": {"id": user_data['id'], "nombre": user_data['nombre'], "rol": user_data['rol']}
        }
        # No es necesario make_response explícito si solo devuelves JSON y status code
        return jsonify(response_data), 200
    else:
        logging.warning(f"Login FAILED for user '{nombre}' - Invalid credentials.")
        return jsonify({"error": "Nombre de usuario o contraseña incorrectos."}), 401 # Unauthorized

@app.route('/api/logout', methods=['POST'])
def logout_user():
    user_id_before_clear = session.get('user_id') # Guardar antes de limpiar para logueo
    session.clear()
    message = "Sesión cerrada."
    if not user_id_before_clear:
        message += " (No había sesión activa)."
    logging.info(f"Logout attempt. Cleared session for former user ID: {user_id_before_clear}")
    return jsonify({"message": message}), 200

@app.route('/api/users/me', methods=['GET'])
@login_required
def get_current_user():
    # @login_required ya asegura que user_id, user_nombre, user_rol están en sesión si el login fue correcto
    user_data_from_session = {
        "id": session['user_id'],
        "nombre": session['user_nombre'],
        "rol": session['user_rol']
    }
    logging.info(f"User data from session for /api/users/me: {user_data_from_session}")
    # Devolver loggedIn: True es redundante porque si no, @login_required daría 401
    return jsonify({"user": user_data_from_session}), 200

# === Endpoints de Administración de Usuarios (Protegidos para rol 'admin') ===
@app.route('/api/users', methods=['GET'])
@roles_required(['admin'])
def get_all_users_endpoint():
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code

    # Obtener parámetros de la query string
    search_term = request.args.get('search', None)
    sort_by = request.args.get('sortBy', 'nombre') # Default sort column
    sort_order = request.args.get('sortOrder', 'ASC') # Default sort order

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

@app.route('/api/users/<int:user_id>/role', methods=['PUT']) # PUT para idempotencia
@roles_required(['admin'])
def update_user_role_endpoint(user_id):
    available, error_response, status_code = check_services()
    if not available: return error_response, status_code

    data = request.get_json()
    if not data or 'rol' not in data:
        return jsonify({"error": "Falta el campo 'rol' en el cuerpo JSON."}), 400

    new_role = str(data['rol']).strip().lower()
    valid_roles_for_update = ['director', 'tecnico', 'admin'] # Roles que un admin puede asignar
    if new_role not in valid_roles_for_update:
        return jsonify({"error": f"Rol '{new_role}' inválido. Roles permitidos: {', '.join(valid_roles_for_update)}"}), 400

    # Lógica para evitar que el último admin se quite el rol (simplificada)
    if session.get('user_id') == user_id and session.get('user_rol') == 'admin' and new_role != 'admin':
        # Aquí deberías verificar si es el ÚNICO admin.
        # Por simplicidad, solo prevenimos que se cambie a sí mismo si es admin.
        # Una lógica más robusta contaría cuántos admins hay.
        # Esta es una simplificación:
        # current_admins = db_handler.list_all_users(search_term=None, role_filter='admin') # Necesitaría un filtro de rol
        # if len(current_admins) == 1 and current_admins[0]['id'] == user_id:
        #    return jsonify({"error": "No se puede cambiar el rol del único administrador."}), 403
        pass # Permitir por ahora, pero considerar esta lógica

    logging.info(f"Admin (ID: {session.get('user_id')}) intentando cambiar rol de usuario ID {user_id} a '{new_role}'")
    try:
        success = db_handler.update_user_role(user_id, new_role)
        if success:
            # Podríamos devolver el usuario actualizado si la UI lo necesita
            return jsonify({"message": f"Rol del usuario ID {user_id} actualizado a '{new_role}'."}), 200
        else:
            # db_handler.update_user_role devuelve False si el usuario no se encuentra o el rol es inválido (CheckViolation)
            # El log en db_handler ya da más detalles.
            return jsonify({"error": f"No se pudo actualizar el rol para el usuario ID {user_id}. Verifique que el ID existe y el rol es válido."}), 400 # Bad Request si rol inválido, 404 si no existe
    except Exception as e:
        logging.exception(f"Error en PUT /api/users/{user_id}/role")
        return jsonify({"error": "Error interno al actualizar rol de usuario."}), 500

# --- Main Execution ---
if __name__ == '__main__':
    is_production = os.getenv('FLASK_ENV') == 'production'
    app.run(
        debug=not is_production,
        host=os.getenv('FLASK_RUN_HOST', '0.0.0.0'), # Usar variable de entorno o default
        port=int(os.getenv('FLASK_RUN_PORT', 5000)), # Usar variable de entorno o default
        use_reloader=not is_production # El reloader es útil en desarrollo
    )