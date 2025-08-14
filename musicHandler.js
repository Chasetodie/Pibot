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

            console.log('🎶 Creando stream de audio...');
            
            // Configuración especial para evitar bloqueos
            const stream = ytdl(songUrl, {
                filter: 'audioonly',
                highWaterMark: 1 << 25,
                quality: 'highestaudio',
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                }
            });

            const resource = createAudioResource(stream, {
                inputType: 'webm/opus'
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

            // Manejar errores del stream
            stream.on('error', (error) => {
                console.error('❌ Error del stream:', error);
                message.channel.send('❌ Error al obtener el audio del video.');
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
            });

            player.on('error', (error) => {
                console.error('❌ Error del reproductor:', error);
                message.channel.send('❌ Ocurrió un error durante la reproducción.');
            });

        } catch (error) {
            console.error('❌ Error en play:', error);
            
            if (error.message.includes('Sign in to confirm')) {
                message.reply('❌ YouTube requiere verificación. El servicio está temporalmente limitado.');
            } else if (error.message.includes('Video unavailable')) {
                message.reply('❌ El video no está disponible o es privado.');
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