FROM node:18-slim

RUN apt-get update && apt-get install -y git && apt-get clean

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE $PORT

CMD ["node", "bot.js"]