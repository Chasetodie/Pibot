const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');

class MusicHandler {
    constructor(client) {
        this.client = client;
        this.queues = new Map();
        
        // SOLUCIÓN: Crear agente con cookies más completas
        this.agent = ytdl.createAgent([
            {
                "domain": ".youtube.com",
                "expirationDate": 1735689600,
                "hostOnly": false,
                "httpOnly": false,
                "name": "VISITOR_INFO1_LIVE",
                "path": "/",
                "sameSite": "no_restriction",
                "secure": true,
                "value": "95T6eO6flSs"
            },
            {
                "domain": ".youtube.com",
                "expirationDate": 1735689600,
                "hostOnly": false,
                "httpOnly": true,
                "name": "YSC",
                "path": "/",
                "sameSite": "no_restriction",
                "secure": true,
                "value": "example"
            }
        ]);
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
                    .setFooter({ text: 'Bot de música con ytdl-core' });

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
                
                // CAMBIO 3: Usar el agente en getInfo
                const info = await ytdl.getInfo(songUrl, { agent: this.agent });
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

            console.log('🎶 Creando stream de audio...');
            
            // SOLUCIÓN: Configuración sin Keep-Alive problemático
            const stream = ytdl(songUrl, {
                filter: 'audioonly',
                highWaterMark: 1 << 25,
                quality: 'highestaudio',
                agent: this.agent,
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'close' // CAMBIO: Usar 'close' en lugar de 'keep-alive'
                    }
                },
                // AÑADIR: Configuraciones adicionales para evitar bloqueos
                begin: 0,
                liveBuffer: 1 << 25,
                dlChunkSize: 0,
                bitrate: 128
            });

            // CAMBIO 5: Mejor manejo de errores del stream
            stream.on('error', (error) => {
                console.error('❌ Error del stream:', error.message);
                message.channel.send('❌ Error al obtener el audio del video. Intenta con otro video.');
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

            // Guardar información de la cola
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
                // CAMBIO 7: Limpiar recursos
                const queue = this.queues.get(message.guild.id);
                if (queue) {
                    queue.connection.destroy();
                    this.queues.delete(message.guild.id);
                }
            });

            player.on('error', (error) => {
                console.error('❌ Error del reproductor:', error.message);
                message.channel.send('❌ Ocurrió un error durante la reproducción.');
                // Limpiar recursos en caso de error
                const queue = this.queues.get(message.guild.id);
                if (queue) {
                    queue.connection.destroy();
                    this.queues.delete(message.guild.id);
                }
            });

        } catch (error) {
            console.error('❌ Error en play:', error.message);
            
            if (error.message.includes('Sign in to confirm')) {
                message.reply('❌ YouTube requiere verificación. El servicio está temporalmente limitado.');
            } else if (error.message.includes('Video unavailable')) {
                message.reply('❌ El video no está disponible o es privado.');
            } else if (error.message.includes('Could not extract functions')) {
                message.reply('❌ Error de extracción de YouTube. Intenta actualizar las dependencias o usa otro video.');
            } else {
                message.reply('❌ Ocurrió un error al reproducir la música. Intenta con otro video.');
            }
        }
    }

    stop(message) {
        const queue = this.queues.get(message.guild.id);
        if (!queue) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        queue.player.stop();
        queue.connection.destroy();
        this.queues.delete(message.guild.id);
        
        message.reply('⏹️ Música detenida y desconectado del canal de voz.');
    }

    // Formatear duración de segundos a MM:SS
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

module.exports = MusicHandler;