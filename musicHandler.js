const playdl = require('play-dl');

class MusicHandler {
    constructor() {
        this.queue = new Map();
        this.connections = new Map();
        this.initializePlayDl();
    }

    async initializePlayDl() {
        try {
            console.log('🎵 Iniciando sistema de música...');
        } catch (error) {
            console.log('⚠️ Advertencia al inicializar play-dl:', error.message);
        }
    }

    // Búsqueda en YouTube
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

    // Formatear duración
    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // MÉTODO PRINCIPAL - Compatible con tu sistema
    async execute(message, args) {
        return this.playCommand(message, args);
    }

    // Comando PLAY
    async playCommand(message, args) {
        // Verificaciones básicas
        if (!message.member.voice.channel) {
            return message.reply('❌ ¡Necesitas estar en un canal de voz para reproducir música!');
        }

        const voiceChannel = message.member.voice.channel;
        const permissions = voiceChannel.permissionsFor(message.client.user);

        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return message.reply('❌ No tengo permisos para unirme o hablar en tu canal de voz!');
        }

        if (!args || args.length === 0) {
            return message.reply('❌ **Uso:** `!play <URL de YouTube o término de búsqueda>`\n**Ejemplo:** `!play Never Gonna Give You Up`');
        }

        let song = {};
        const searchMessage = await message.reply('🔍 **Buscando música...** ⏳');

        try {
            // Determinar si es URL o búsqueda
            const query = Array.isArray(args) ? args.join(' ') : args.toString();
            
            if (this.isValidYouTubeUrl(query) || this.isValidYouTubeUrl(args[0])) {
                const videoInfo = await this.getVideoInfo(query || args[0]);
                if (!videoInfo) {
                    await searchMessage.edit('❌ No se pudo obtener información del video. Verifica que la URL sea válida.');
                    return;
                }
                song = videoInfo;
            } else {
                // Buscar en YouTube
                const searchResult = await this.searchYoutube(query);
                if (!searchResult) {
                    await searchMessage.edit('❌ No se encontraron resultados para tu búsqueda. Intenta con otros términos.');
                    return;
                }
                song = searchResult;
            }

            await searchMessage.delete().catch(() => {});

            // Reproducir usando el método básico de Discord.js
            await this.playBasic(message, song);

        } catch (error) {
            console.error('❌ Error en playCommand:', error);
            await searchMessage.edit('❌ Ocurrió un error procesando tu solicitud. Intenta de nuevo.').catch(() => {});
        }
    }

    // Método de reproducción básico (sin @discordjs/voice)
    async playBasic(message, song) {
        const voiceChannel = message.member.voice.channel;
        
        try {
            // Conectar al canal
            const connection = await voiceChannel.join();
            this.connections.set(message.guild.id, connection);

            // Obtener stream
            const stream = await playdl.stream(song.url, { quality: 2 });

            // Reproducir
            const dispatcher = connection.play(stream.stream, {
                type: 'opus',
                volume: 0.5
            });

            // Embed de reproducción
            const embed = {
                color: 0x00ff00,
                title: '🎵 Reproduciendo Ahora',
                description: `**${song.title}**`,
                fields: [
                    { name: '📺 Canal', value: song.channel, inline: true },
                    { name: '⏱️ Duración', value: this.formatDuration(song.duration), inline: true }
                ],
                thumbnail: { url: song.thumbnail },
                timestamp: new Date()
            };

            message.channel.send({ embeds: [embed] });

            // Eventos del dispatcher
            dispatcher.on('finish', () => {
                voiceChannel.leave();
                this.connections.delete(message.guild.id);
                message.channel.send('🏁 **Reproducción terminada.**');
            });

            dispatcher.on('error', (error) => {
                console.error('Error del dispatcher:', error);
                message.channel.send('❌ Error reproduciendo la música.');
                voiceChannel.leave();
                this.connections.delete(message.guild.id);
            });

        } catch (error) {
            console.error('Error en playBasic:', error);
            message.channel.send('❌ Error conectando al canal de voz o reproduciendo la música.');
            if (voiceChannel.connection) {
                voiceChannel.leave();
            }
        }
    }

    // Método STOP
    async stopCommand(message) {
        const connection = this.connections.get(message.guild.id);
        const voiceChannel = message.member.voice.channel;

        if (!connection && !voiceChannel?.connection) {
            return message.reply('❌ No estoy reproduciendo música!');
        }

        try {
            if (voiceChannel?.connection) {
                voiceChannel.leave();
            }
            this.connections.delete(message.guild.id);
            message.reply('⏹️ **Música detenida y desconectado!**');
        } catch (error) {
            console.error('Error en stop:', error);
            message.reply('❌ Error deteniendo la música.');
        }
    }

    // Método SKIP (alias para stop por simplicidad)
    async skipCommand(message) {
        return this.stopCommand(message);
    }

    // Métodos compatibles con diferentes sistemas de comandos
    async play(message, args) {
        return this.playCommand(message, args);
    }

    async stop(message) {
        return this.stopCommand(message);
    }

    async skip(message) {
        return this.skipCommand(message);
    }

    async processCommand(message) {
        if (message.author.bot) return;

        const args = message.content.trim().split(/ +/g);
        const command = args[0].toLowerCase();

        try{
            switch (command){
                case 'mon!play':
                case 'mon!p':
                    try {
                        await this.execute(message, args);
                    } catch (error) {
                        console.error('Error ejecutando comando play:', error);
                        message.reply('❌ Hubo un error ejecutando ese comando!');
                    }
                    break;

                case 'mon!stop':
                    try {
                        await this.stop(message);
                    } catch (error) {
                        console.error('Error ejecutando comando stop:', error);
                        message.reply('❌ Hubo un error ejecutando ese comando!');
                    }
                    break;

                case 'mon!skip':
                    try {
                        await this.skip(message);
                    } catch (error) {
                        console.error('Error ejecutando comando skip:', error);
                        message.reply('❌ Hubo un error ejecutando ese comando!');
                    }
                    break;

                case 'mon!queue':
                case 'mon!q':
                    try {
                        await this.showQueue(message);
                    } catch (error) {
                        console.error('Error ejecutando comando queue:', error);
                        message.reply('❌ Hubo un error ejecutando ese comando!');
                    }
                    break;

                case 'mon!pause':
                    try {
                        await this.pause(message);
                    } catch (error) {
                        console.error('Error ejecutando comando pause:', error);
                        message.reply('❌ Hubo un error ejecutando ese comando!');
                    }
                    break;

                case 'mon!resume':
                    try {
                        await this.resume(message);
                    } catch (error) {
                        console.error('Error ejecutando comando resume:', error);
                        message.reply('❌ Hubo un error ejecutando ese comando!');
                    }
                    break;

                case 'mon!np':
                case 'mon!nowplaying':
                    try {
                        await this.nowPlaying(message);
                    } catch (error) {
                        console.error('Error ejecutando comando nowplaying:', error);
                        message.reply('❌ Hubo un error ejecutando ese comando!');
                    }
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error('Error procesando comando:', error);
            message.reply('❌ Ocurrió un error al procesar tu comando. Inténtalo de nuevo.');
        }
    }

    // Información del bot de música
    async help(message) {
        const embed = {
            color: 0x0099FF,
            title: '🎵 Comandos de Música',
            description: 'Lista de comandos disponibles para el bot de música',
            fields: [
                {
                    name: '!play <URL/búsqueda>',
                    value: 'Reproduce una canción de YouTube\n`!play Never Gonna Give You Up`',
                    inline: false,
                },
                {
                    name: '!stop',
                    value: 'Para la música y desconecta el bot',
                    inline: false,
                },
                {
                    name: '!skip',
                    value: 'Salta a la siguiente canción (o para la actual)',
                    inline: false,
                }
            ],
            footer: {
                text: 'Bot de Música v1.0'
            },
            timestamp: new Date(),
        };
        
        return message.channel.send({ embeds: [embed] });
    }
}

module.exports = MusicHandler;