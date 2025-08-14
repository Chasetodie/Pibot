FROM node:18-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache ffmpeg python3 py3-pip build-base

# Directorio de trabajo
WORKDIR /app

# Copiar e instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar código fuente
COPY . .

# Exponer puerto si necesitas web dashboard
EXPOSE 3000

# Comando para ejecutar
CMD ["node", "bot.js"]