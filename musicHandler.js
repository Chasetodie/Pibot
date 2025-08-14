const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const { PassThrough } = require('stream');
const ytdlp = require('youtube-dl-exec');
const ytSearch = require('yt-search');

const queue = new Map();
const prefix = ">";

// Función para crear AudioResource desde youtube-dl
async function createResourceFromYtdlp(url) {
    return new Promise((resolve, reject) => {
        try {
            const stream = new PassThrough();
            const child = ytdlp.raw(
                [url, '-f', 'bestaudio'],
                { stdio: ['ignore', 'pipe', 'ignore'] }
            );
            child.stdout.pipe(stream);

            child.on('error', err => reject(new Error(`yt-dlp error: ${err.message}`)));
            child.on('close', code => {
                if (code !== 0) console.warn(`yt-dlp exited with code ${code}`);
            });

            const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
            resolve(resource);
        } catch (err) {
            reject(err);
        }
    });
}

// Función para buscar canción con yt-search
async function buscarCancion(query) {
    if (!query) throw new Error("Query vacío");

    // Permite URL directa
    if (query.startsWith("https://www.youtube.com/watch") || query.startsWith("https://youtu.be/")) {
        return { title: "Link directo", url: query };
    }

    try {
        const resultados = await ytSearch(query);
        if (!resultados || !resultados.videos.length) throw new Error("No se encontró ninguna canción");
        return resultados.videos[0];
    } catch (err) {
        console.error("Error al buscar canción:", err.message);
        throw new Error("No se pudo buscar la canción");
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
    } else if (command === "skip") skip(message);
    else if (command === "stop") stop(message);
    else if (command === "pause") pause(message);
    else if (command === "resume") resume(message);
    else if (command === "queue") showQueue(message);
}

// Función para reproducir o agregar canciones
async function play(message, query) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply("¡Debes estar en un canal de voz!");

    let serverQueue = queue.get(message.guild.id);

    let song;
    try {
        song = await buscarCancion(query);
    } catch (err) {
        return message.reply(err.message);
    }

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
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });
            serverQueue.connection = connection;
            serverQueue.connection.subscribe(serverQueue.player);

            serverQueue.player.on('error', error => {
                console.error(`AudioPlayer Error: ${error.message}`);
                serverQueue.songs.shift();
                if (serverQueue.songs.length > 0) playSong(message.guild.id);
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
    if (!serverQueue || !serverQueue.player) return;

    const song = serverQueue.songs[0];
    if (!song) {
        serverQueue.connection.destroy();
        queue.delete(guildId);
        return;
    }

    try {
        const resource = await createResourceFromYtdlp(song.url);
        serverQueue.player.play(resource);

        serverQueue.player.once(AudioPlayerStatus.Idle, () => {
            serverQueue.songs.shift();
            playSong(guildId);
        });
    } catch (err) {
        console.error("Error al reproducir canción:", err.message);
        serverQueue.songs.shift();
        playSong(guildId);
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
