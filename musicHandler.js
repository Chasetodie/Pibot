const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

class MusicHandler {
    constructor(client) {
        this.client = client;
        this.queues = new Map();
    }

    // Procesar comandos
    async processCommand(message) {
        console.log('🔄 processCommand llamado con:', message.content);
        
        const args = message.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        console.log('🎯 Comando procesado:', command, 'Args:', args);
        
        switch (command) {
            case 'play':
            case 'p':
                const query = args.join(' ');
                await this.play(message, query);
                break;
            
            case 'stop':
                this.stop(message);
                break;
            
            case 'help':
            case 'commands':
                const embed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('🎵 Comandos de Música')
                    .addFields(
                        { name: '`>play <url/búsqueda>`', value: 'Reproduce música', inline: true },
                        { name: '`>stop`', value: 'Para música', inline: true },
                        { name: '`>help`', value: 'Muestra esta ayuda', inline: true }
                    )
                    .setFooter({ text: 'Bot de música mejorado' });

                message.reply({ embeds: [embed] });
                break;
        }
    }

    async play(message, query) {
        console.log('🎵 Método play llamado con query:', query);
        
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ ¡Necesitas estar en un canal de voz!');
        }

        if (!query) {
            return message.reply('❌ ¡Necesitas proporcionar una URL o término de búsqueda!');
        }

        try {
            let songUrl;
            let songTitle = query;
            let songDuration;
            let songThumbnail;

            // Verificar si es una URL de YouTube
            if (ytdl.validateURL(query)) {
                songUrl = query;
                console.log('🔗 URL directa de YouTube detectada');
                
                // Obtener información del video
                const info = await ytdl.getInfo(songUrl);
                songTitle = info.videoDetails.title;
                songDuration = this.formatDuration(info.videoDetails.lengthSeconds);
                songThumbnail = info.videoDetails.thumbnails[0]?.url;
            } else {
                // Buscar en YouTube
                console.log('🔍 Buscando en YouTube...');
                const searchResults = await ytSearch(query);
                
                if (!searchResults || !searchResults.videos || searchResults.videos.length === 0) {
                    return message.reply(`❌ No se encontraron resultados para: **${query}**`);
                }

                const video = searchResults.videos[0];
                songUrl = video.url;
                songTitle = video.title;
                songDuration = video.duration.timestamp;
                songThumbnail = video.thumbnail;
                
                console.log('🎵 Canción encontrada:', songTitle);
            }

            // Verificar que la URL es válida
            if (!ytdl.validateURL(songUrl)) {
                return message.reply('❌ URL de YouTube inválida.');
            }

            console.log('🎶 Creando stream con configuración anti-bloqueo...');
            
            // Configuración especial anti-bloqueos
            const stream = ytdl(songUrl, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25,
                requestOptions: {
                    headers: {
                        'Cookie': '__Secure-3PAPISID=RWLIGcZZ5tpL7bWE/A4j8Q0Rh2udUsuZep; PREF=tz=America.Guayaquil&f6=40000000&f7=100; LOGIN_INFO=AFmmF2swRgIhAI9t8clx8DNEeviJIqHdzcCDx9Fo0e7hM8IKP6ql3Q9fAiEAmTY3BIogG6WXhzbEHARabh0_60u-jzkIss6168Pg_mI:QUQ3MjNmeUlubVFvbDZpOXVjVThTOE1WZHdQYXE2Uk1NR2pXbGlHb2xsVFVDS1Y5NnBoUm4xTldSd251bXhfdER5QWFwMHYxenp1MUVCTjBXa3MyeE5sc2RBRjE2dFl1bjRHSnBPY0pNOVl1N2pRQk13cmN4Q09IZlZPbmJfazd5SDVDem9GVVFZMWFhWUN5MGZrVnp0MTBTNldsZWF5aUt3; wide=0; __Secure-3PSID=g.a000ywgkzUE7uTg3666SGP63baLeqogC16fCTFpY6ABwgWAHLQeBHzkKOKsPo7LrsVee5Z7tWAACgYKAewSAQ4SFQHGX2Mi-oDcsr5EBVxAlzp4IJPOLhoVAUF8yKpNVTEqs7eJJzNoriGZWd_d0076; __Secure-1PSIDTS=sidts-CjIB5H03P166r0E3Fa_f2y8VenGIz0Eco7L5UPuYzv6sCoPXDoq_ab2p71xeph-_Vhh7XxAA; __Secure-3PSIDTS=sidts-CjIB5H03P166r0E3Fa_f2y8VenGIz0Eco7L5UPuYzv6sCoPXDoq_ab2p71xeph-_Vhh7XxAA; __Secure-3PSIDCC=AKEyXzX89_4etssO76ZoUHU95A2GgZUT29-RvpmdyHOYI2J7TV0pULlwgECVpDCOrE4wd1M9dQ; YSC=7OdY2TPFPLU; VISITOR_INFO1_LIVE=8LApLk6E2hw; VISITOR_PRIVACY_METADATA=CgJFQxIEGgAgXQ%3D%3D; __Secure-ROLLOUT_TOKEN=COGMxJS0_vLHcxCrwrC5_cuNAxi6k5qViomPAw%3D%3D',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'DNT': '1',
                        'Connection': 'close',
                        'Upgrade-Insecure-Requests': '1',
                        'X-YouTube-Client-Name': '1',
                        'X-YouTube-Client-Version': '2.20231201.00.00'
                    }
                },
                // Opciones adicionales
                begin: 0,
                liveBuffer: 1 << 25,
                dlChunkSize: 0,
                bitrate: 128
            });

            // Manejo de errores del stream
            stream.on('error', (error) => {
                console.error('❌ Error del stream:', error.message);
                message.channel.send('❌ Error al cargar el audio. Prueba con otro video.');
            });

            const resource = createAudioResource(stream, {
                inputType: 'arbitrary',
                inlineVolume: true
            });

            // Conectar al canal de voz
            console.log('🔊 Conectando al canal de voz...');
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            // Crear y configurar el reproductor
            const player = createAudioPlayer();
            connection.subscribe(player);

            // Guardar información de la cola (SIN process)
            this.queues.set(message.guild.id, {
                connection,
                player,
                textChannel: message.channel
            });

            // Reproducir la canción
            player.play(resource);
            console.log('▶️ Reproducción iniciada');

            // Embed de reproducción
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎵 Reproduciendo ahora')
                .setDescription(`[${songTitle}](${songUrl})`)
                .addFields(
                    { name: '⏱️ Duración', value: songDuration || 'Desconocida', inline: true },
                    { name: '👤 Solicitado por', value: message.author.toString(), inline: true }
                );

            if (songThumbnail) {
                embed.setThumbnail(songThumbnail);
            }

            message.reply({ embeds: [embed] });

            // Eventos del reproductor
            player.on(AudioPlayerStatus.Idle, () => {
                console.log('🏁 Reproducción terminada');
                message.channel.send('✅ Reproducción terminada.');
                this.cleanup(message.guild.id);
            });

            player.on('error', (error) => {
                console.error('❌ Error del reproductor:', error.message);
                message.channel.send('❌ Error durante la reproducción.');
                this.cleanup(message.guild.id);
            });

        } catch (error) {
            console.error('❌ Error en play:', error.message);
            
            if (error.message.includes('Sign in to confirm')) {
                message.reply('❌ YouTube requiere verificación. Prueba con otro video.');
            } else if (error.message.includes('Video unavailable')) {
                message.reply('❌ Video no disponible o privado.');
            } else if (error.message.includes('Could not extract')) {
                message.reply('❌ Error de extracción. YouTube puede estar bloqueando. Usa otro video.');
            } else {
                message.reply('❌ Error al reproducir. Intenta con otro video.');
            }
        }
    }

    stop(message) {
        const queue = this.queues.get(message.guild.id);
        if (!queue) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        this.cleanup(message.guild.id);
        message.reply('⏹️ Música detenida y desconectado del canal de voz.');
    }

    // Limpiar recursos (SIN process.kill)
    cleanup(guildId) {
        const queue = this.queues.get(guildId);
        if (queue) {
            if (queue.player) {
                queue.player.stop();
            }
            if (queue.connection) {
                queue.connection.destroy();
            }
            this.queues.delete(guildId);
        }
    }

    // Formatear duración de segundos a MM:SS
    formatDuration(seconds) {
        if (!seconds) return 'Desconocida';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

module.exports = MusicHandler;