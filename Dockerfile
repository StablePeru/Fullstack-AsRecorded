# Dockerfile (para la API Flask)

# Usa una imagen base de Python oficial
FROM python:3.10-slim

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia el archivo de requerimientos primero (aprovecha el caché de Docker)
COPY requirements.txt requirements.txt

# Instala las dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copia el resto del código de la aplicación al directorio de trabajo
COPY . .

# Expone el puerto en el que Flask correrá (el mismo que usas en app.run o el default 5000)
EXPOSE 5000

# Comando para ejecutar la aplicación cuando el contenedor inicie
# Usamos el comando de Flask directamente
# Asegúrate de que tu api_app.py SÍ define host='0.0.0.0' en app.run()
# para que sea accesible desde fuera del contenedor.
CMD ["flask", "run", "--host=0.0.0.0"]

# Alternativa si prefieres ejecutar el script directamente (necesita el if __name__ == '__main__':)
# CMD ["python", "api_app.py"]