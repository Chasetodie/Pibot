# Usamos Node 20
FROM node:20

# Instalar yt-dlp y dependencias
RUN apk add --no-cache python3 py3-pip ffmpeg
RUN pip3 install yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "start"]