const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

class MusicHandler {
    constructor() {
        this.queue = new Map();
    }

    // Estructura de datos para cada servidor
    createQueueConstruct(textChannel, voiceChannel) {
        return {
            textChannel: textChannel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true,
            player: createAudioPlayer()
        };
    }

    // Buscar videos en YouTube
    async searchYoutube(query) {
        try {
            const videoResult = await ytSearch(query);
            if (videoResult && videoResult.videos.length > 0) {
                return videoResult.videos[0];
            }
            return null;
        } catch (error) {
            console.error('Error buscando en YouTube:', error);
            return null;
        }
    }

    // Validar URL de YouTube
    isValidYouTubeUrl(url) {
        return ytdl.validateURL(url);
    }

    // Obtener información del video
    async getVideoInfo(url) {
        try {
            const info = await ytdl.getInfo(url);
            return {
                title: info.videoDetails.title,
                url: info.videoDetails.video_url,
                duration: info.videoDetails.lengthSeconds,
                thumbnail: info.videoDetails.thumbnails[0]?.url
            };
        } catch (error) {
            console.error('Error obteniendo info del video:', error);
            return null;
        }
    }

    // Reproducir música
    async play(message, song) {
        const queue = this.queue.get(message.guild.id);
        
        if (!song) {
            queue.connection.destroy();
            this.queue.delete(message.guild.id);
            return message.channel.send('❌ Cola de reproducción terminada.');
        }

        try {
            const stream = ytdl(song.url, {
                filter: 'audioonly',
                highWaterMark: 1 << 25,
                quality: 'highestaudio'
            });

            const resource = createAudioResource(stream);
            
            queue.player.play(resource);
            queue.connection.subscribe(queue.player);

            // Eventos del reproductor
            queue.player.on(AudioPlayerStatus.Playing, () => {
                message.channel.send(`🎵 Reproduciendo: **${song.title}**`);
            });

            queue.player.on(AudioPlayerStatus.Idle, () => {
                queue.songs.shift();
                this.play(message, queue.songs[0]);
            });

            queue.player.on('error', error => {
                console.error('Error del reproductor:', error);
                queue.songs.shift();
                this.play(message, queue.songs[0]);
            });

        } catch (error) {
            console.error('Error reproduciendo:', error);
            queue.songs.shift();
            this.play(message, queue.songs[0]);
            return message.channel.send('❌ Error reproduciendo la canción.');
        }
    }

    // Comando principal de reproducir
    async execute(message, args) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.channel.send('❌ ¡Necesitas estar en un canal de voz para reproducir música!');
        }

        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
            return message.channel.send('❌ No tengo permisos para unirme o hablar en tu canal de voz!');
        }

        if (!args.length) {
            return message.channel.send('❌ Necesitas proporcionar una URL de YouTube o término de búsqueda!');
        }

        const serverQueue = this.queue.get(message.guild.id);
        let song = {};

        // Determinar si es URL o búsqueda
        if (this.isValidYouTubeUrl(args[0])) {
            const videoInfo = await this.getVideoInfo(args[0]);
            if (!videoInfo) {
                return message.channel.send('❌ No se pudo obtener información del video.');
            }
            song = videoInfo;
        } else {
            // Buscar en YouTube
            const video = await this.searchYoutube(args.join(' '));
            if (!video) {
                return message.channel.send('❌ No se encontraron resultados para tu búsqueda.');
            }
            
            song = {
                title: video.title,
                url: video.url,
                duration: video.duration.seconds,
                thumbnail: video.thumbnail
            };
        }

        // Si no hay cola, crear una nueva
        if (!serverQueue) {
            const queueConstruct = this.createQueueConstruct(message.channel, voiceChannel);
            this.queue.set(message.guild.id, queueConstruct);

            queueConstruct.songs.push(song);

            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                queueConstruct.connection = connection;

                connection.on(VoiceConnectionStatus.Ready, () => {
                    console.log('Conexión establecida y lista!');
                });

                connection.on('error', error => {
                    console.error('Error de conexión:', error);
                });

                this.play(message, queueConstruct.songs[0]);
            } catch (error) {
                console.error('Error conectando al canal:', error);
                this.queue.delete(message.guild.id);
                return message.channel.send('❌ Error conectando al canal de voz.');
            }
        } else {
            serverQueue.songs.push(song);
            return message.channel.send(`✅ **${song.title}** ha sido añadida a la cola!`);
        }
    }

    // Comando para parar la música
    stop(message) {
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue) {
            return message.channel.send('❌ No hay música reproduciéndose!');
        }

        serverQueue.songs = [];
        serverQueue.player.stop();
        serverQueue.connection.destroy();
        this.queue.delete(message.guild.id);
        
        return message.channel.send('⏹️ Música detenida y bot desconectado!');
    }

    // Comando para saltar canción
    skip(message) {
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue) {
            return message.channel.send('❌ No hay música que saltar!');
        }

        serverQueue.player.stop();
        return message.channel.send('⏭️ Canción saltada!');
    }

    // Mostrar cola de reproducción
    showQueue(message) {
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue) {
            return message.channel.send('❌ No hay música en cola!');
        }

        let queueString = '**Cola de Reproducción:**\n';
        serverQueue.songs.forEach((song, index) => {
            queueString += `${index + 1}. ${song.title}\n`;
        });

        return message.channel.send(queueString);
    }

    // Pausar música
    pause(message) {
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue) {
            return message.channel.send('❌ No hay música reproduciéndose!');
        }

        if (serverQueue.player.state.status === AudioPlayerStatus.Playing) {
            serverQueue.player.pause();
            return message.channel.send('⏸️ Música pausada!');
        } else {
            return message.channel.send('❌ La música ya está pausada!');
        }
    }

    // Reanudar música
    resume(message) {
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue) {
            return message.channel.send('❌ No hay música que reanudar!');
        }

        if (serverQueue.player.state.status === AudioPlayerStatus.Paused) {
            serverQueue.player.unpause();
            return message.channel.send('▶️ Música reanudada!');
        } else {
            return message.channel.send('❌ La música no está pausada!');
        }
    }
}

module.exports = MusicHandler;