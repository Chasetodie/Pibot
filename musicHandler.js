const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

const queue = new Map();
const prefix = ">";

async function play(message, query) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply("¡Debes estar en un canal de voz!");

    let serverQueue = queue.get(message.guild.id);

    const songInfo = ytdl.validateURL(query) 
        ? await ytdl.getInfo(query)
        : await ytSearch(query).then(res => res.videos[0]);

    if (!songInfo) return message.reply("No encontré la canción 😢");

    const song = {
        title: songInfo.title,
        url: songInfo.video_url || songInfo.url,
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
            queueContruct.connection = connection;
            playSong(message.guild.id);
            message.reply(`Reproduciendo: **${song.title}**`);
        } catch (err) {
            console.error(err);
            queue.delete(message.guild.id);
            return message.reply("No pude unirme al canal de voz 😢");
        }
    } else {
        serverQueue.songs.push(song);
        return message.reply(`Agregada a la cola: **${song.title}**`);
    }
}

function playSong(guildId) {
    const serverQueue = queue.get(guildId);
    if (!serverQueue) return;

    const song = serverQueue.songs[0];
    if (!song) {
        serverQueue.connection.destroy();
        queue.delete(guildId);
        return;
    }

    const stream = ytdl(song.url, { filter: 'audioonly' });
    const resource = createAudioResource(stream);
    serverQueue.player.play(resource);
    serverQueue.connection.subscribe(serverQueue.player);

    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
        serverQueue.songs.shift();
        playSong(guildId);
    });
}

function skip(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.reply("No hay canciones para saltar 😢");
    serverQueue.player.stop();
    message.reply("Canción saltada ✅");
}

function stop(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.reply("No hay canciones para detener 😢");
    serverQueue.songs = [];
    serverQueue.player.stop();
    serverQueue.connection.destroy();
    queue.delete(message.guild.id);
    message.reply("Reproducción detenida ✅");
}

function processCommand(message) {
    if (!message.content.startsWith(prefix)) return;
    if (message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "play") {
        const query = args.join(" ");
        if (!query) return message.reply("Debes escribir el nombre o URL de la canción.");
        play(message, query);
    } else if (command === "skip") {
        skip(message);
    } else if (command === "stop") {
        stop(message);
    } else if (command === "pause") {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply("No hay canciones reproduciéndose");
        serverQueue.player.pause();
        message.reply("⏸️ Música pausada");
    } else if (command === "resume") {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply("No hay canciones reproduciéndose");
        serverQueue.player.unpause();
        message.reply("▶️ Música reanudada");
    } else if (command === "queue") {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue || serverQueue.songs.length === 0) return message.reply("La cola está vacía");
        const queueList = serverQueue.songs.map((song, i) => `${i + 1}. ${song.title}`).join("\n");
        message.reply(`🎶 Cola de canciones:\n${queueList}`);
    }
}

module.exports = {
    processCommand,
    queue, // exportamos la cola por si queremos acceder desde bot.js
};
