# Usar una imagen base de Node.js 22
FROM node:22

# Establecer el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copiar el archivo package.json y package-lock.json
COPY package*.json ./

# Instalar las dependencias del proyecto
RUN npm install

# Copiar el resto del código de la aplicación
COPY . .

# Instalar dependencias necesarias y crear un entorno virtual de Python
RUN apt-get update && apt-get install -y python3-venv python3-pip && \
    python3 -m venv /usr/src/app/venv && \
    /usr/src/app/venv/bin/pip install --upgrade pip && \
    /usr/src/app/venv/bin/pip install yt-dlp

# Establecer variables de entorno para usar el entorno virtual de Python
ENV PATH="/usr/src/app/venv/bin:$PATH"

# Exponer el puerto en el que la aplicación se ejecutará
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["node", "src/app.js"]