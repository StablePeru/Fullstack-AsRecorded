# -*- coding: utf-8 -*-
"""
api_app.py - Flask Backend API para AsRecorded v1.1
"""
import logging
import os
from functools import wraps
from flask import Flask, request, jsonify, session, make_response
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from werkzeug.utils import secure_filename
import db_handler
from data_handler import DataHandler

# --- Configuración ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s')

# --- Inicialización de la App Flask ---
app = Flask(__name__)

# --- Configuraciones ---
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'un-secreto-muy-seguro-para-desarrollo')
# ... (otras configuraciones de cookies como las tenías)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = os.getenv('FLASK_ENV') == 'production'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# --- Inicialización de Extensiones ---
CORS(app, supports_credentials=True, origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"])
bcrypt = Bcrypt(app)

# --- Instancia del Handler ---
handler_instance = DataHandler()

# --- Decoradores de Autenticación y Autorización ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Acceso no autorizado. Se requiere inicio de sesión."}), 401
        return f(*args, **kwargs)
    return decorated_function

def roles_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_role = session.get('user_rol')
            if not user_role or user_role not in allowed_roles:
                logging.warning(f"Acceso denegado para rol '{user_role}' a {request.path}.")
                return jsonify({"error": "Permiso denegado para este recurso."}), 403
            return f(*args, **kwargs)
        return login_required(decorated_function) # Asegura que también esté logueado
    return decorator

# --- API Endpoints ---

# === Autenticación y Usuarios ===
@app.route('/api/users/me', methods=['GET'])
@login_required
def get_current_user():
    return jsonify({
        "id": session.get('user_id'),
        "nombre": session.get('user_nombre'),
        "rol": session.get('user_rol')
    }), 200

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('nombre') or not data.get('password'):
        return jsonify({"error": "Faltan nombre o contraseña."}), 400

    user = db_handler.execute_query('SELECT * FROM "Usuario" WHERE nombre = %s', (data['nombre'],), fetch_mode="one")

    if user and bcrypt.check_password_hash(user['password_hash'], data['password']):
        session['user_id'] = user['id']
        session['user_nombre'] = user['nombre']
        session['user_rol'] = user['rol']
        logging.info(f"Login exitoso para usuario '{data['nombre']}'")
        return jsonify({"message": "Login exitoso", "user": {"id": user['id'], "nombre": user['nombre'], "rol": user['rol']}}), 200

    return jsonify({"error": "Credenciales inválidas."}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Sesión cerrada."}), 200

# === Convocatorias ===
@app.route('/api/salas/<int:sala_id>/convocatoria', methods=['GET'])
@roles_required(['admin', 'director', 'tecnico', 'supervisor'])
def get_convocatoria_endpoint(sala_id):
    fecha = request.args.get('fecha') # Formato YYYY-MM-DD
    if not fecha:
        return jsonify({"error": "El parámetro 'fecha' es requerido."}), 400
    
    convocatoria_data = handler_instance.get_convocatoria_hoy(sala_id, fecha)
    if convocatoria_data is None:
        return jsonify({"error": "Error al obtener la convocatoria."}), 500
    
    return jsonify(convocatoria_data), 200

# === Intervenciones (Ejemplos de PATCH) ===

@app.route('/api/intervenciones/<int:intervencion_id>/estado', methods=['PATCH'])
@roles_required(['admin', 'director', 'tecnico'])
def patch_intervencion_estado(intervencion_id):
    data = request.get_json()
    estado = data.get('estado')
    estado_nota = data.get('estado_nota')
    user_id = session.get('user_id')

    if not estado or estado not in ['pendiente', 'realizado', 'omitido']:
        return jsonify({"error": "El campo 'estado' es inválido."}), 400
    if estado == 'omitido' and not estado_nota:
        return jsonify({"error": "El campo 'estado_nota' es obligatorio si el estado es 'omitido'."}), 400

    success = handler_instance.update_intervention_status(intervencion_id, estado, estado_nota, user_id)
    if success:
        return jsonify({"message": "Estado actualizado correctamente."}), 200
    else:
        return jsonify({"error": "No se pudo actualizar la intervención."}), 500


@app.route('/api/intervenciones/<int:intervencion_id>/fx', methods=['PATCH'])
@roles_required(['admin', 'director', 'tecnico'])
def patch_intervencion_fx(intervencion_id):
    data = request.get_json()
    needs_fx = data.get('needs_fx')
    fx_note = data.get('fx_note')
    fx_source = data.get('fx_source', 'manual')
    user_id = session.get('user_id')

    if needs_fx is None or not isinstance(needs_fx, bool):
        return jsonify({"error": "El campo 'needs_fx' (booleano) es requerido."}), 400
    if needs_fx and (not fx_note or len(fx_note) < 3 or len(fx_note) > 120):
        return jsonify({"error": "Si 'needs_fx' es true, 'fx_note' es obligatorio (3-120 caracteres)."}), 400
    
    success = handler_instance.update_intervention_fx(intervencion_id, needs_fx, fx_note, fx_source, user_id)
    if success:
        return jsonify({"message": "FX actualizado correctamente."}), 200
    else:
        return jsonify({"error": "No se pudo actualizar el FX de la intervención."}), 500

# === Repartos ===
@app.route('/api/series/<int:serie_id>/reparto', methods=['GET'])
@roles_required(['admin', 'director', 'supervisor'])
def get_reparto_endpoint(serie_id):
    reparto = handler_instance.get_reparto(serie_id)
    return jsonify(reparto), 200


# --- Inicialización de la aplicación ---
if __name__ == '__main__':
    with app.app_context():
        # Comprobar si la tabla "Usuario" existe. Si no, inicializar la BD.
        try:
            db_handler.execute_query('SELECT 1 FROM "Usuario" LIMIT 1;', fetch_mode="one")
            logging.info("La base de datos ya parece estar inicializada.")
        except Exception:
            logging.warning("No se pudo acceder a las tablas. Se intentará inicializar la base de datos.")
            try:
                db_handler.initialize_database()
            except Exception as e:
                logging.critical(f"FALLO CRÍTICO: No se pudo inicializar la base de datos. La aplicación no puede continuar. Error: {e}")
                # En un entorno real, esto debería detener la aplicación.
                # Para desarrollo, podemos dejar que Flask continúe e informe del error.
                
    app.run(
        host=os.getenv('FLASK_RUN_HOST', '0.0.0.0'),
        port=int(os.getenv('FLASK_RUN_PORT', 5000)),
        debug=os.getenv('FLASK_ENV') != 'production'
    )