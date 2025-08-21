# Usar Node.js como imagen base
FROM node:18-slim

# Instalar Git (necesario para tus comandos de sync)
RUN apt-get update && apt-get install -y git && apt-get clean

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto de los archivos
COPY . .

# Configurar Git (necesario para commits)
RUN git config --global user.name "Bot" && \
    git config --global user.email "bot@railway.app"

# Exponer puerto (si es necesario)
EXPOSE 3000

# Exponer puerto para el panel web
EXPOSE 3000

# Comando para iniciar el bot
CMD ["node", "script.js"]