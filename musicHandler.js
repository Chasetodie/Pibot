const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const playdl = require('play-dl');

class MusicHandler {
    constructor() {
        this.queue = new Map();
        this.initializePlayDl();
    }

    async initializePlayDl() {
        try {
            // Solo configurar si es necesario
            console.log('🎵 Iniciando sistema de música...');
        } catch (error) {
            console.log('⚠️ Advertencia al inicializar play-dl:', error.message);
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
                    thumbnail: video.thumbnails[0]?.url || null,
                    channel: video.channel?.name || 'Desconocido'
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
        try {
            return playdl.yt_validate(url) === 'video';
        } catch {
            return false;
        }
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
                thumbnail: video.thumbnails[0]?.url || null,
                channel: video.channel?.name || 'Desconocido'
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
            if (queue?.connection) {
                queue.connection.destroy();
            }
            this.queue.delete(message.guild.id);
            return message.channel.send('🏁 **Cola de reproducción terminada.** ¡Gracias por usar el bot!');
        }

        try {
            // Obtener stream de audio
            const stream = await playdl.stream(song.url, { 
                quality: 2 // Calidad media para mayor estabilidad
            });
            
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type,
                inlineVolume: true
            });
            
            // Configurar volumen
            if (resource.volume) {
                resource.volume.setVolume(0.5);
            }
            
            queue.player.play(resource);
            
            if (queue.connection) {
                queue.connection.subscribe(queue.player);
            }

            // Eventos del reproductor
            queue.player.on(AudioPlayerStatus.Playing, () => {
                const embed = {
                    color: 0x00ff00,
                    title: '🎵 Reproduciendo Ahora',
                    description: `**${song.title}**`,
                    fields: [
                        { name: '📺 Canal', value: song.channel, inline: true },
                        { name: '⏱️ Duración', value: this.formatDuration(song.duration), inline: true }
                    ],
                    thumbnail: { url: song.thumbnail || '' },
                    timestamp: new Date()
                };
                message.channel.send({ embeds: [embed] });
            });

            queue.player.on(AudioPlayerStatus.Idle, () => {
                queue.songs.shift();
                setTimeout(() => {
                    this.play(message, queue.songs[0]);
                }, 1000);
            });

            queue.player.on('error', error => {
                console.error('❌ Error del reproductor:', error);
                message.channel.send('❌ Error reproduciendo la canción. Saltando...');
                queue.songs.shift();
                setTimeout(() => {
                    this.play(message, queue.songs[0]);
                }, 2000);
            });

        } catch (error) {
            console.error('❌ Error reproduciendo:', error);
            message.channel.send(`❌ No se pudo reproducir: **${song.title}**`);
            queue.songs.shift();
            setTimeout(() => {
                this.play(message, queue.songs[0]);
            }, 2000);
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
            return message.channel.send('❌ **Uso:** `!play <URL de YouTube o término de búsqueda>`\n**Ejemplo:** `!play Never Gonna Give You Up`');
        }

        const serverQueue = this.queue.get(message.guild.id);
        let song = {};

        // Mostrar mensaje de "buscando..."
        const searchMessage = await message.channel.send('🔍 **Buscando música...** ⏳');

        try {
            // Determinar si es URL o búsqueda
            if (this.isValidYouTubeUrl(args[0])) {
                const videoInfo = await this.getVideoInfo(args[0]);
                if (!videoInfo) {
                    await searchMessage.edit('❌ No se pudo obtener información del video. Verifica que la URL sea válida.');
                    return;
                }
                song = videoInfo;
            } else {
                // Buscar en YouTube
                const searchResult = await this.searchYoutube(args.join(' '));
                if (!searchResult) {
                    await searchMessage.edit('❌ No se encontraron resultados para tu búsqueda. Intenta con otros términos.');
                    return;
                }
                song = searchResult;
            }

            await searchMessage.delete().catch(() => {});

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
                        console.log('✅ Conexión establecida y lista!');
                    });

                    connection.on(VoiceConnectionStatus.Disconnected, () => {
                        console.log('🔌 Bot desconectado del canal de voz');
                    });

                    connection.on('error', error => {
                        console.error('❌ Error de conexión:', error);
                    });

                    this.play(message, queueConstruct.songs[0]);
                } catch (error) {
                    console.error('❌ Error conectando al canal:', error);
                    this.queue.delete(message.guild.id);
                    return message.channel.send('❌ Error conectando al canal de voz. Intenta de nuevo.');
                }
            } else {
                serverQueue.songs.push(song);
                const embed = {
                    color: 0x0099ff,
                    title: '✅ Añadida a la Cola',
                    description: `**${song.title}**`,
                    fields: [
                        { name: '📍 Posición en cola', value: `${serverQueue.songs.length}`, inline: true },
                        { name: '⏱️ Duración', value: this.formatDuration(song.duration), inline: true }
                    ],
                    thumbnail: { url: song.thumbnail || '' },
                    timestamp: new Date()
                };
                return message.channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('❌ Error en execute:', error);
            await searchMessage.edit('❌ Ocurrió un error procesando tu solicitud. Intenta de nuevo.').catch(() => {});
        }
    }

    // Resto de métodos (stop, skip, queue, etc.) permanecen igual...
    stop(message) {
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue) {
            return message.channel.send('❌ No hay música reproduciéndose!');
        }

        serverQueue.songs = [];
        serverQueue.player.stop();
        if (serverQueue.connection) {
            serverQueue.connection.destroy();
        }
        this.queue.delete(message.guild.id);
        
        return message.channel.send('⏹️ **Música detenida** y bot desconectado! 👋');
    }

    skip(message) {
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue) {
            return message.channel.send('❌ No hay música que saltar!');
        }

        serverQueue.player.stop();
        return message.channel.send('⏭️ **Canción saltada!**');
    }

    showQueue(message) {
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue || !serverQueue.songs.length) {
            return message.channel.send('❌ No hay música en cola!');
        }

        const embed = {
            color: 0x0099FF,
            title: '🎵 Cola de Reproducción',
            fields: [],
            footer: { text: `Total: ${serverQueue.songs.length} canción(es)` },
            timestamp: new Date(),
        };

        serverQueue.songs.slice(0, 10).forEach((song, index) => {
            const status = index === 0 ? '🔊 **Reproduciendo**' : `${index}. En cola`;
            embed.fields.push({
                name: status,
                value: `**${song.title}**\n⏱️ ${this.formatDuration(song.duration)} • 📺 ${song.channel}`,
                inline: false
            });
        });

        if (serverQueue.songs.length > 10) {
            embed.description = `... y ${serverQueue.songs.length - 10} canción(es) más`;
        }

        return message.channel.send({ embeds: [embed] });
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    pause(message) {
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue) {
            return message.channel.send('❌ No hay música reproduciéndose!');
        }

        if (serverQueue.player.state.status === AudioPlayerStatus.Playing) {
            serverQueue.player.pause();
            return message.channel.send('⏸️ **Música pausada!**');
        } else {
            return message.channel.send('❌ La música ya está pausada!');
        }
    }

    resume(message) {
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue) {
            return message.channel.send('❌ No hay música que reanudar!');
        }

        if (serverQueue.player.state.status === AudioPlayerStatus.Paused) {
            serverQueue.player.unpause();
            return message.channel.send('▶️ **Música reanudada!**');
        } else {
            return message.channel.send('❌ La música no está pausada!');
        }
    }

    nowPlaying(message) {
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue || !serverQueue.songs.length) {
            return message.channel.send('❌ No hay música reproduciéndose!');
        }

        const song = serverQueue.songs[0];
        const embed = {
            color: 0x00ff00,
            title: '🎵 Reproduciendo Ahora',
            description: `**${song.title}**`,
            thumbnail: { url: song.thumbnail || '' },
            fields: [
                { name: '📺 Canal', value: song.channel, inline: true },
                { name: '⏱️ Duración', value: this.formatDuration(song.duration), inline: true },
                { name: '📋 En Cola', value: `${serverQueue.songs.length - 1} canción(es)`, inline: true }
            ],
            timestamp: new Date(),
        };

        return message.channel.send({ embeds: [embed] });
    }
}

module.exports = MusicHandler;