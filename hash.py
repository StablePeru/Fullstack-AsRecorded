# script_para_generar_hash.py
import bcrypt
password = b"admin" # La contraseña que quieras
hashed = bcrypt.hashpw(password, bcrypt.gensalt())
print(hashed.decode('utf-8'))