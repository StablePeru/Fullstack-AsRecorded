import db_handler
from flask_bcrypt import Bcrypt
from flask import Flask

# Necesitamos un contexto de aplicación para usar Bcrypt
app = Flask(__name__)
bcrypt = Bcrypt(app)

def seed_data():
    """
    Inserta datos iniciales en la base de datos si está vacía.
    """
    print("Iniciando el proceso de seeding...")

    try:
        # --- Creación de Usuarios ---
        print("Creando usuarios...")
        users_to_create = [
            ('admin', 'admin123', 'admin'),
            ('director_ana', 'director123', 'director'),
            ('tecnico_juan', 'tecnico123', 'tecnico'),
            ('supervisor_pepe', 'super123', 'supervisor')
        ]

        for nombre, password, rol in users_to_create:
            # Comprobar si el usuario ya existe
            user_exists = db_handler.execute_query('SELECT id FROM "Usuario" WHERE nombre = %s', (nombre,), fetch_mode="one")
            if not user_exists:
                password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
                db_handler.execute_query(
                    'INSERT INTO "Usuario" (nombre, password_hash, rol) VALUES (%s, %s, %s)',
                    (nombre, password_hash, rol),
                    fetch_mode="none"
                )
                print(f"- Usuario '{nombre}' (rol: {rol}) creado.")
            else:
                print(f"- Usuario '{nombre}' ya existe, omitiendo.")

        # --- Creación de Salas ---
        print("\nCreando salas...")
        salas_to_create = [
            ('Sala 1', 'S1'),
            ('Sala 2', 'S2')
        ]

        for nombre, codigo in salas_to_create:
            sala_exists = db_handler.execute_query('SELECT id FROM "Sala" WHERE codigo = %s', (codigo,), fetch_mode="one")
            if not sala_exists:
                db_handler.execute_query(
                    'INSERT INTO "Sala" (nombre, codigo) VALUES (%s, %s)',
                    (nombre, codigo),
                    fetch_mode="none"
                )
                print(f"- Sala '{nombre}' (código: {codigo}) creada.")
            else:
                 print(f"- Sala '{nombre}' ya existe, omitiendo.")

        print("\n¡Proceso de seeding completado!")

    except Exception as e:
        print(f"\nOcurrió un error durante el seeding: {e}")

if __name__ == '__main__':
    seed_data()