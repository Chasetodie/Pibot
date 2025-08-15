const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const ytdl = require('ytdl-core');

class MusicQueue {
    constructor(message) {
        this.textChannel = message.channel;
        this.voiceChannel = message.member.voice.channel;
        this.connection = null;
        this.player = createAudioPlayer();
        this.songs = [];
        this.volume = 100;
        this.loop = false;

        this.player.on(AudioPlayerStatus.Idle, () => {
            if (this.loop && this.songs.length > 0) {
                this.songs.push(this.songs[0]);
            }
            this.songs.shift();
            if (this.songs.length > 0) {
                this.processQueue();
            }
        });

        this.player.on("error", (error) => {
            console.error(error);
            this.songs.shift();
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.songs.length === 0) return;

        try {
            const song = this.songs[0];
            const stream = ytdl(song.url, { 
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25
            });
            
            const resource = createAudioResource(stream);
            this.player.play(resource);
            this.connection.subscribe(this.player);
        } catch (error) {
            console.error(error);
            this.songs.shift();
            this.processQueue();
        }
    }

    enqueue(...songs) {
        this.songs = this.songs.concat(songs);
        this.processQueue();
    }

    stop() {
        this.songs = [];
        this.player.stop();
    }

    skip() {
        this.player.stop();
    }
}

class MusicHandler {
    constructor() {
        this.queues = new Map();
    }

    async play(message, search) {
        const { channel } = message.member.voice;
        
        if (!channel) {
            return message.reply("❌ Necesitas estar en un canal de voz!");
        }

        let queue = this.queues.get(message.guild.id);
        let song = null;

        try {
            let songInfo;
            if (ytdl.validateURL(search)) {
                songInfo = await ytdl.getBasicInfo(search);
            } else {
                return message.reply("❌ Por ahora solo URLs de YouTube válidas");
            }

            song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url,
                duration: parseInt(songInfo.videoDetails.lengthSeconds),
                thumbnail: songInfo.videoDetails.thumbnails[0]?.url,
                requester: message.author
            };
        } catch (error) {
            console.error(error);
            return message.reply("❌ No se pudo obtener información de la canción");
        }

        if (!queue) {
            queue = new MusicQueue(message);
            this.queues.set(message.guild.id, queue);

            try {
                queue.connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });
            } catch (error) {
                this.queues.delete(message.guild.id);
                console.error(error);
                return message.reply("❌ No se pudo conectar al canal de voz!");
            }
        }

        queue.enqueue(song);

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(queue.songs.length > 1 ? "🎵 Agregado a la cola" : "🎵 Reproduciendo ahora")
            .setDescription(`**${song.title}**`)
            .addFields(
                { name: 'Duración', value: this.formatTime(song.duration), inline: true },
                { name: 'Solicitado por', value: song.requester.toString(), inline: true },
                { name: 'Posición en cola', value: queue.songs.length.toString(), inline: true }
            )
            .setThumbnail(song.thumbnail);

        return message.reply({ embeds: [embed] });
    }

    skip(message) {
        const queue = this.queues.get(message.guild.id);
        if (!queue) return message.reply("❌ No hay música reproduciéndose!");

        queue.skip();
        message.reply("⏭️ Canción saltada!");
    }

    stop(message) {
        const queue = this.queues.get(message.guild.id);
        if (!queue) return message.reply("❌ No hay música reproduciéndose!");

        queue.stop();
        this.queues.delete(message.guild.id);
        message.reply("⏹️ Música detenida!");
    }

    showQueue(message) {
        const queue = this.queues.get(message.guild.id);
        if (!queue || !queue.songs.length) {
            return message.reply("❌ No hay canciones en la cola!");
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`📝 Cola del servidor - ${queue.songs.length} canción(es)`)
            .setDescription(
                queue.songs.slice(0, 10).map((song, i) => 
                    `${i === 0 ? '🎵' : `${i + 1}.`} **${song.title}** [${this.formatTime(song.duration)}] - ${song.requester}`
                ).join('\n')
            );

        if (queue.songs.length > 10) {
            embed.setFooter({ text: `Y ${queue.songs.length - 10} más...` });
        }

        message.reply({ embeds: [embed] });
    }

    disconnect(message) {
        const queue = this.queues.get(message.guild.id);
        if (!queue) return message.reply("❌ No estoy conectado!");
        
        queue.connection.destroy();
        this.queues.delete(message.guild.id);
        message.reply("👋 Desconectado!");
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

module.exports = MusicHandler;