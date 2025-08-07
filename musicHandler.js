const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const playdl = require('play-dl');

class MusicHandler {
    constructor() {
        this.queue = new Map();
        this.initializePlayDl();
    }

    async initializePlayDl() {
        // Configurar play-dl si es necesario
        try {
            await playdl.getFreeClientID().then((clientID) => playdl.setToken({
                soundcloud : {
                    client_id : clientID
                }
            }));
        } catch (error) {
            console.log('SoundCloud token no configurado, solo funcionará YouTube');
        }
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
            const searched = await playdl.search(query, {
                limit: 1,
                source: { youtube: "video" }
            });
            
            if (searched.length > 0) {
                const video = searched[0];
                return {
                    title: video.title,
                    url: video.url,
                    duration: video.durationInSec,
                    thumbnail: video.thumbnails[0]?.url || null
                };
            }
            return null;
        } catch (error) {
            console.error('Error buscando en YouTube:', error);
            return null;
        }
    }

    // Validar URL de YouTube
    isValidYouTubeUrl(url) {
        return playdl.yt_validate(url) === 'video';
    }

    // Obtener información del video
    async getVideoInfo(url) {
        try {
            const info = await playdl.video_info(url);
            const video = info.video_details;
            
            return {
                title: video.title,
                url: video.url,
                duration: video.durationInSec,
                thumbnail: video.thumbnails[0]?.url || null
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
            const stream = await playdl.stream(song.url);
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type
            });
            
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
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return message.channel.send('❌ No tengo permisos para unirme o hablar en tu canal de voz!');
        }

        if (!args.length) {
            return message.channel.send('❌ Necesitas proporcionar una URL de YouTube o término de búsqueda!');
        }

        const serverQueue = this.queue.get(message.guild.id);
        let song = {};

        // Mostrar mensaje de "buscando..."
        const searchMessage = await message.channel.send('🔍 Buscando...');

        // Determinar si es URL o búsqueda
        if (this.isValidYouTubeUrl(args[0])) {
            const videoInfo = await this.getVideoInfo(args[0]);
            if (!videoInfo) {
                await searchMessage.edit('❌ No se pudo obtener información del video.');
                return;
            }
            song = videoInfo;
        } else {
            // Buscar en YouTube
            const searchResult = await this.searchYoutube(args.join(' '));
            if (!searchResult) {
                await searchMessage.edit('❌ No se encontraron resultados para tu búsqueda.');
                return;
            }
            song = searchResult;
        }

        await searchMessage.delete();

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
        if (!serverQueue || !serverQueue.songs.length) {
            return message.channel.send('❌ No hay música en cola!');
        }

        const embed = {
            color: 0x0099FF,
            title: '🎵 Cola de Reproducción',
            fields: [],
            timestamp: new Date(),
        };

        serverQueue.songs.slice(0, 10).forEach((song, index) => {
            embed.fields.push({
                name: `${index + 1}. ${song.title}`,
                value: `Duración: ${this.formatDuration(song.duration)}`,
                inline: false
            });
        });

        if (serverQueue.songs.length > 10) {
            embed.description = `... y ${serverQueue.songs.length - 10} más`;
        }

        return message.channel.send({ embeds: [embed] });
    }

    // Formatear duración
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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

    // Obtener información actual
    nowPlaying(message) {
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue || !serverQueue.songs.length) {
            return message.channel.send('❌ No hay música reproduciéndose!');
        }

        const song = serverQueue.songs[0];
        const embed = {
            color: 0x0099FF,
            title: '🎵 Reproduciendo Ahora',
            description: `**${song.title}**`,
            thumbnail: {
                url: song.thumbnail || ''
            },
            fields: [
                {
                    name: 'Duración',
                    value: this.formatDuration(song.duration),
                    inline: true
                },
                {
                    name: 'Cola',
                    value: `${serverQueue.songs.length} canción(es)`,
                    inline: true
                }
            ],
            timestamp: new Date(),
        };

        return message.channel.send({ embeds: [embed] });
    }
}

module.exports = MusicHandler;