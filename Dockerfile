# Usamos Node 20
FROM node:20

# Instalamos Python
RUN apt-get update && apt-get install -y python3 python3-pip

# Directorio de la app
WORKDIR /app

# Copiamos package.json y package-lock.json
COPY package*.json ./

# Instalamos dependencias
RUN npm install

# Copiamos el resto del proyecto
COPY . .

# Comando para iniciar el bot
CMD ["node", "bot.js"]