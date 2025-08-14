const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const ytdlp = require('youtube-dl-exec');
const ytSearch = require('yt-search');

const queue = new Map();
const prefix = ">";

// Función para obtener la URL directa de audio
async function getAudioUrl(url) {
    try {
        const info = await ytdlp(url, {
            dumpSingleJson: true,
            noWarnings: true,
            quiet: true,
            extractAudio: true,
            audioFormat: 'bestaudio',
            addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        });
        return info.url;
    } catch (error) {
        console.error('Error al obtener la URL de audio:', error);
        throw new Error('No se pudo obtener la URL de audio');
    }
}

// Función central para manejar comandos
async function processCommand(message) {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "play") {
        const query = args.join(" ");
        if (!query) return message.reply("Debes escribir el nombre de la canción.");
        await play(message, query);
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

// Función para reproducir o agregar canciones
async function play(message, query) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply("¡Debes estar en un canal de voz!");

    let serverQueue = queue.get(message.guild.id);

    // Buscar canción en YouTube
    let songInfo;
    try {
        const searchResult = await ytSearch(query);
        if (!searchResult || !searchResult.videos.length) return message.reply("No encontré la canción 😢");
        songInfo = searchResult.videos[0];
    } catch (err) {
        return message.reply("Error al buscar la canción.");
    }

    const song = {
        title: songInfo.title,
        url: songInfo.url
    };

    if (!serverQueue) {
        // Crear cola por primera vez
        serverQueue = {
            voiceChannel,
            connection: null,
            songs: [],
            player: createAudioPlayer(),
        };
        queue.set(message.guild.id, serverQueue);
        serverQueue.songs.push(song);

        try {
            // Unirse al canal de voz
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });
            serverQueue.connection = connection;

            // Suscribirse al player
            serverQueue.connection.subscribe(serverQueue.player);

            // Manejo de errores del player
            serverQueue.player.on('error', error => {
                console.error(`AudioPlayer Error: ${error.message}`);
                serverQueue.songs.shift();
                if (serverQueue.songs.length > 0) playSong(message.guild.id);
            });

            // Reproducir primera canción
            playSong(message.guild.id);
            message.reply(`🎶 Reproduciendo: **${song.title}**`);
        } catch (err) {
            console.error(err);
            queue.delete(message.guild.id);
            return message.reply("No pude unirme al canal de voz 😢");
        }
    } else {
        // Agregar canción a la cola
        serverQueue.songs.push(song);
        return message.reply(`✅ Agregada a la cola: **${song.title}**`);
    }
}

// Función que reproduce la primera canción de la cola usando youtube-dl-exec
async function playSong(guildId) {
    const serverQueue = queue.get(guildId);
    if (!serverQueue || !serverQueue.player) return;

    const song = serverQueue.songs[0];
    if (!song) {
        serverQueue.connection.destroy();
        queue.delete(guildId);
        return;
    }

    try {
        const streamUrl = await getAudioUrl(song.url);
        const resource = createAudioResource(streamUrl, { inputType: StreamType.Arbitrary });

        serverQueue.player.play(resource);

        serverQueue.player.once(AudioPlayerStatus.Idle, () => {
            serverQueue.songs.shift();
            playSong(guildId);
        });
    } catch (err) {
        console.error("Error al reproducir canción:", err.message);
        serverQueue.songs.shift(); // Quita canción inválida
        playSong(guildId); // Reproduce siguiente
    }
}

// Comandos de música
function skip(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue || !serverQueue.songs.length) return message.reply("No hay canciones para saltar 😢");
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
    if (!serverQueue || !serverQueue.songs.length) return message.reply("La cola está vacía");
    const queueList = serverQueue.songs.map((song, i) => `${i + 1}. ${song.title}`).join("\n");
    message.reply(`🎶 Cola de canciones:\n${queueList}`);
}

module.exports = {
    processCommand,
    queue,
};
