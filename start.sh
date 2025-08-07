#!/bin/bash
# Ejecutar Lavalink y el bot a la vez

# Iniciar Lavalink (Java)
java -jar Lavalink.jar &

# Esperar unos segundos a que Lavalink arranque
sleep 5

# Iniciar el bot
node bot.js
