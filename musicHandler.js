//const playdl = require('play-dl');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const playdl = require('play-dl');
const ffmpegPath = require('ffmpeg-static');
const fetch = require('node-fetch');

class MusicHandler {
    constructor() {
        this.queue = new Map();
        this.connections = new Map();
//        this.initializePlayDl();
    }

/*    async initializePlayDl() {
        try {
            console.log('🎵 Iniciando sistema de música...');
        } catch (error) {
            console.log('⚠️ Advertencia al inicializar play-dl:', error.message);
        }
    }*/

    // Búsqueda en YouTube
/*    async searchYoutube(query) {
        try {
            const searched = await playdl.search(query, {
                limit: 1,
                source: { youtube: "video" }
            });
            
            if (searched.length > 0) {
                const video = searched[0];
                if (!video || !video.url) {
                    console.error('⚠️ Resultado de búsqueda inválido o sin URL');
                    return null;
                }

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
    }*/

    // Validar URL de YouTube
/*    isValidYouTubeUrl(url) {
        try {
            return playdl.yt_validate(url) === 'video';
        } catch {
            return false;
        }
    }*/

    // Obtener información del video
 /*   async getVideoInfo(url) {
        try {
            const info = await playdl.video_info(url);
            const video = info?.video_details;

            if (!video || !video.url) {
                console.error('⚠️ Video inválido o sin URL');
                return null;
            }

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
    }*/

    // Formatear duración
    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // MÉTODO PRINCIPAL - Compatible con tu sistema
    async execute(message, args) {
        return await this.playCommand(message, args);
    }

    async searchYoutubeAPI(query) {
        const YOUTUBE_API_KEY = 'AIzaSyDmZKzH1g1A3ppZ_ViNy0Hlm8AfqgcAv3Q';
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`;
        try {
            const response = await fetch(url);
            const data = await response.json();

            console.log('Respuesta YouTube API:', JSON.stringify(data, null, 2));

            if (!data.items || data.items.length === 0) return null;

            const video = data.items[0];
            return {
                title: video.snippet.title,
                url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
                channel: video.snippet.channelTitle,
                thumbnail: video.snippet.thumbnails.default.url,
                duration: null
            };
        } catch (error) {
            console.error('Error llamando a YouTube API:', error);
            return null;
        }
    }

    // Método alternativo si hay problemas con execute
    async processCommand(message, args) {
        return await this.playCommand(message, args);
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
            
            if (ytdl.validateURL(query) || ytdl.validateURL(args[0])) {
                const videoInfo = await this.getVideoInfo(query || args[0]);
                if (!videoInfo) {
                    await searchMessage.edit('❌ No se pudo obtener información del video. Verifica que la URL sea válida.');
                    return;
                }
                song = videoInfo;
            } else {
                // Buscar en YouTube
                const searchResult = await this.searchYoutubeAPI(query);
                if (!searchResult) {
                    await searchMessage.edit('❌ No se encontraron resultados para tu búsqueda. Intenta con otros términos.');
                    return;
                }
                song = searchResult;
            }

            await searchMessage.delete().catch(() => {});

            if (!song || !song.url) {
                return message.reply('❌ No se pudo obtener una URL válida para la canción. Intenta con otra búsqueda o revisa la URL.');
            }

            console.log('✅ Canción obtenida:', song); // Ayuda para depurar

            await this.playBasic(message, song);

        } catch (error) {
            console.error('❌ Error en playCommand:', error);
            await searchMessage.edit('❌ Ocurrió un error procesando tu solicitud. Intenta de nuevo.').catch(() => {});
        }
    }

    async playMusic(message, query) {
    if (!message.member.voice.channel) {
        return message.reply("❌ Necesitas estar en un canal de voz.");
    }
    const voiceChannel = message.member.voice.channel;
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("Connect") || !permissions.has("Speak")) {
        return message.reply("❌ No tengo permisos para unirme o hablar en tu canal.");
    }

    if (typeof query !== 'string') {
        return message.reply('❌ El término de búsqueda o URL debe ser un texto válido.');
    }

    // Buscar video o usar URL
    let video;
    if (playdl.yt_validate(query) === 'video') {
        // Es URL directa
        video = { url: query };
    } else {
        // Buscar con play-dl
        const results = await playdl.search(query, { limit: 1 });
        if (!results.length) return message.reply("❌ No se encontraron resultados.");
        video = results[0];
    }

    // Unirse al canal
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
    });

    // Crear reproductor
    const player = createAudioPlayer();

    const url = (video.url ?? video.link)?.replace(/;/g, '');
    console.log('🔍 Stream URL:', url, '| typeof:', typeof url);

    if (!url || typeof url !== 'string') {
        return message.reply('❌ URL inválida para el stream.');
    }

    const info = await playdl.video_info(url);
    const stream = await playdl.stream_from_info(info);

    //const stream = await playdl.stream(url);

    // Crear recurso de audio
    const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true
    });
    if (resource.volume) resource.volume.setVolume(0.5);

    // Reproducir
    player.play(resource);
    connection.subscribe(player);

    // Eventos
    player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
        message.channel.send("🏁 **Reproducción terminada.**");
    });

    player.on('error', error => {
        console.error('Error en reproductor:', error);
        message.channel.send('❌ Error reproduciendo la música.');
        connection.destroy();
    });

    // Mensaje informativo
    message.channel.send(`▶️ Reproduciendo: **${video.title || video.url}**`);
    }    

    // Método de reproducción usando @discordjs/voice
    async playBasic(message, song) {
        const voiceChannel = message.member.voice.channel;

        try {
            const {
                joinVoiceChannel,
                createAudioPlayer,
                createAudioResource,
                AudioPlayerStatus
            } = require('@discordjs/voice');

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            this.connections.set(message.guild.id, connection);

            // ✅ Usar ytdl-core para el stream de audio
            const stream = ytdl(song.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25 // más buffer para evitar cortes
            });

            const resource = createAudioResource(stream, {
                inputType: stream.type || undefined,
                inlineVolume: true
            });

            if (resource.volume) {
                resource.volume.setVolume(0.5);
            }

            const player = createAudioPlayer();
            player.play(resource);
            connection.subscribe(player);

            // Enviar embed de reproducción
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

            // Eventos del reproductor
            player.on(AudioPlayerStatus.Playing, () => {
                console.log('🎵 Reproduciendo con ytdl-core:', song.title);
            });

            player.on(AudioPlayerStatus.Idle, () => {
                try{
                    if (connection && !connection.destroyed) {
                        console.log('fuck1');
                        connection.destroy();
                    }
                    this.connections.delete(message.guild.id);
                    message.channel.send('🏁 **Reproducción terminada.**');
                } catch (error) {
                    console.error('Intento de destruir la conexion ya destruida');
                }
            });

            player.on('error', (error) => {
                console.error('Error del reproductor:', error);
                message.channel.send('❌ Error reproduciendo la música.');
                connection.destroy();
                this.connections.delete(message.guild.id);
            });

        } catch (error) {
            console.error('Error en playBasic (ytdl):', error);
            message.channel.send('❌ Error conectando al canal de voz o reproduciendo la música.');
        }
    }

    // Método alternativo si @discordjs/voice no está disponible
    async playAlternative(message, song) {
        // Crear un embed informativo ya que no podemos reproducir sin @discordjs/voice
        const embed = {
            color: 0xff9900,
            title: '🎵 Canción Encontrada',
            description: `**${song.title}**`,
            fields: [
                { name: '📺 Canal', value: song.channel, inline: true },
                { name: '⏱️ Duración', value: this.formatDuration(song.duration), inline: true },
                { name: '🔗 Enlace', value: `[Ver en YouTube](${song.url})`, inline: false }
            ],
            thumbnail: { url: song.thumbnail },
            footer: { text: 'Para reproducir música, instala las dependencias necesarias.' },
            timestamp: new Date()
        };

        return message.channel.send({ 
            content: '⚠️ **Sistema de reproducción no disponible.** Aquí está la información de la canción:',
            embeds: [embed] 
        });
    }

    // Método STOP actualizado
    async stopCommand(message) {
        const connection = this.connections.get(message.guild.id);

        if (!connection) {
            return message.reply('❌ No estoy reproduciendo música!');
        }

        try {
            // Destruir la conexión usando @discordjs/voice
            connection.destroy();
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
                        const args = message.content.split(' ');
                        const query = args.slice(1).join(' '); // Unir todo después del comando
                        
                        await this.playMusic(message, query);
                    } catch (error) {
                        console.error(error);
                        message.reply('❌ Ocurrio un error al reproducir la musica');
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