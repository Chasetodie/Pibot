const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const {stream } = require('@distube/ytdl-core');
const ytSearch = require('yt-search');

const queue = new Map();
const prefix = ">";

// Función para reproducir canciones
async function play(message, query) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply("¡Debes estar en un canal de voz!");

    let serverQueue = queue.get(message.guild.id);

    // Buscar siempre una URL válida
    let songInfo;
    try {
        const searchResult = await ytSearch(query);
        if (!searchResult || !searchResult.videos.length) return message.reply("No encontré la canción 😢");
        songInfo = searchResult.videos[0];
    } catch (err) {
        return message.reply("Error al buscar la canción. Intenta otro nombre.");
    }

    const song = {
        title: songInfo.title,
        url: songInfo.url
    };

    if (!serverQueue) {
        const queueContruct = {
            voiceChannel,
            connection: null,
            songs: [],
            player: createAudioPlayer(),
        };

        queue.set(message.guild.id, queueContruct);
        queueContruct.songs.push(song);

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            connection.subscribe(serverQueue.player);
            queueContruct.connection = connection;

            // Manejo de errores del player
            queueContruct.player.on('error', error => {
                console.error(`AudioPlayer Error: ${error.message}`);
                queueContruct.songs.shift();
                playSong(message.guild.id);
            });

            playSong(message.guild.id);
            message.reply(`🎶 Reproduciendo: **${song.title}**`);
        } catch (err) {
            console.error(err);
            queue.delete(message.guild.id);
            return message.reply("No pude unirme al canal de voz 😢");
        }
    } else {
        serverQueue.songs.push(song);
        return message.reply(`✅ Agregada a la cola: **${song.title}**`);
    }
}

// Función que reproduce la primera canción de la cola
async function playSong(guildId) {
    const serverQueue = queue.get(guildId);
    if (!serverQueue) return;

    const song = serverQueue.songs[0];
    if (!song) {
        serverQueue.connection.destroy();
        queue.delete(guildId);
        return;
    }

    try {
        const ytStream = await stream(song.url, { filter: 'audioonly' });
        const resource = createAudioResource(ytStream.stream, { inputType: StreamType.Opus });
        serverQueue.player.play(resource);
        serverQueue.connection.subscribe(serverQueue.player);
    } catch (err) {
        console.error("Error al reproducir canción:", err.message);
        serverQueue.songs.shift();
        if (serverQueue.songs.length > 0) playSong(serverQueue, serverQueue.songs[0]);
    }
}

// Comandos de música
function skip(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.reply("No hay canciones para saltar 😢");
    serverQueue.player.stop();
    message.reply("⏭️ Canción saltada");
}

function stop(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.reply("No hay canciones para detener 😢");
    serverQueue.songs = [];
    serverQueue.player.stop();
    serverQueue.connection.destroy();
    queue.delete(message.guild.id);
    message.reply("⏹️ Reproducción detenida");
}

function pause(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.reply("No hay canciones reproduciéndose");
    serverQueue.player.pause();
    message.reply("⏸️ Música pausada");
}

function resume(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.reply("No hay canciones reproduciéndose");
    serverQueue.player.unpause();
    message.reply("▶️ Música reanudada");
}

function showQueue(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue || serverQueue.songs.length === 0) return message.reply("La cola está vacía");
    const queueList = serverQueue.songs.map((song, i) => `${i + 1}. ${song.title}`).join("\n");
    message.reply(`🎶 Cola de canciones:\n${queueList}`);
}

// Función central que maneja todos los comandos con prefijo
function processCommand(message) {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "play") {
        const query = args.join(" ");
        if (!query) return message.reply("Debes escribir el nombre de la canción.");
        play(message, query);
    } else if (command === "skip") {
        skip(message);
    } else if (command === "stop") {
        stop(message);
    } else if (command === "pause") {
        pause(message);
    } else if (command === "resume") {
        resume(message);
    } else if (command === "queue") {
        showQueue(message);
    }
}

module.exports = {
    processCommand,
    queue,
};
