# frontend/Dockerfile

# Elige una versión base de Node.js (v22 o v20 son buenas opciones para Remix)
FROM node:20 AS base

WORKDIR /app

# Copia PRIMERO los archivos de definición de dependencias
# Usamos package-lock.json para asegurar instalaciones consistentes.
COPY package.json ./

# Instala las dependencias BASÁNDOSE en los archivos copiados
# Esto aprovecha la caché de Docker. Si package*.json no cambian, esta capa no se re-ejecuta.
RUN npm install

# AHORA copia el resto del código de la aplicación
COPY . .

# Expón el puerto que usa Remix (por defecto 3000 con `npm run dev`)
EXPOSE 3000 5173 8002

# Comando para iniciar la aplicación en modo desarrollo con Vite
# Asegúrate que tu package.json tiene un script "dev" que ejecute "remix vite:dev" o similar
# CMD ["npm", "run", "dev"]