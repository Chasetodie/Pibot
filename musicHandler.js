const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const youtubedl = require('youtube-dl-exec');
const ytSearch = require('yt-search');
const { spawn } = require('child_process');

class MusicHandler {
    constructor(client) {
        this.client = client;
        this.queues = new Map();
    }

    // Procesar comandos
    async processCommand(message) {
        const args = message.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
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
                    .setFooter({ text: 'Bot de música con yt-dlp' });

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
            let songInfo;

            // Si no es una URL, buscar en YouTube
            if (!query.includes('youtube.com') && !query.includes('youtu.be')) {
                console.log('🔍 Buscando en YouTube...');
                const searchResults = await ytSearch(query);
                
                if (!searchResults || !searchResults.videos || searchResults.videos.length === 0) {
                    return message.reply(`❌ No se encontraron resultados para: **${query}**`);
                }

                const video = searchResults.videos[0];
                songUrl = video.url;
                songInfo = {
                    title: video.title,
                    duration: video.duration.timestamp,
                    thumbnail: video.thumbnail,
                    channel: video.author.name
                };
                
                console.log('🎵 Canción encontrada:', songInfo.title);
            } else {
                songUrl = query;
                console.log('🔗 URL directa detectada');
                
                // Obtener información del video con yt-dlp
                try {
                    const info = await youtubedl(songUrl, {
                        dumpSingleJson: true,
                        noCheckCertificates: true,
                        noWarnings: true,
                        preferFreeFormats: true,
                        addHeader: [
                            'referer:youtube.com',
                            'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        ]
                    });
                    
                    songInfo = {
                        title: info.title,
                        duration: this.formatDuration(info.duration),
                        thumbnail: info.thumbnail,
                        channel: info.uploader
                    };
                } catch (error) {
                    console.log('⚠️ No se pudo obtener info del video, usando URL directamente');
                    songInfo = {
                        title: 'Video de YouTube',
                        duration: 'Desconocida',
                        thumbnail: null,
                        channel: 'Desconocido'
                    };
                }
            }

            console.log('🎶 Creando stream con yt-dlp...');
            
            // Crear stream usando spawn con yt-dlp
            const stream = spawn('yt-dlp', [
                songUrl,
                '-o', '-',
                '--audio-format', 'opus',
                '--audio-quality', '96K',
                '--format', 'bestaudio[ext=webm]/bestaudio/best',
                '--no-check-certificates',
                '--prefer-free-formats',
                '--add-header', 'referer:youtube.com',
                '--add-header', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                '--extract-flat', 'false',
                '--embed-subs', 'false'
            ], {
                stdio: ['ignore', 'pipe', 'ignore']
            });

            if (!stream || !stream.stdout) {
                throw new Error('No se pudo crear el stream');
            }

            const resource = createAudioResource(stream.stdout, {
                inputType: 'arbitrary'
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
                textChannel: message.channel,
                process: stream
            });

            // Manejar errores del proceso
            stream.on('error', (error) => {
                console.error('❌ Error del proceso yt-dlp:', error.message);
                message.channel.send('❌ Error al procesar el video.');
            });

            stream.on('close', (code) => {
                if (code !== 0) {
                    console.error(`❌ yt-dlp proceso terminó con código: ${code}`);
                }
            });

            // Reproducir la canción
            player.play(resource);
            console.log('▶️ Reproducción iniciada');

            // Embed de reproducción
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎵 Reproduciendo ahora')
                .setDescription(`[${songInfo.title}](${songUrl})`)
                .addFields(
                    { name: '⏱️ Duración', value: songInfo.duration || 'Desconocida', inline: true },
                    { name: '👤 Solicitado por', value: message.author.toString(), inline: true },
                    { name: '📺 Canal', value: songInfo.channel || 'Desconocido', inline: true }
                );

            if (songInfo.thumbnail) {
                embed.setThumbnail(songInfo.thumbnail);
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
                message.channel.send('❌ Ocurrió un error durante la reproducción.');
                this.cleanup(message.guild.id);
            });

        } catch (error) {
            console.error('❌ Error en play:', error.message);
            
            if (error.message.includes('not found')) {
                message.reply('❌ yt-dlp no está instalado. Por favor instálalo primero.');
            } else if (error.message.includes('unavailable')) {
                message.reply('❌ El video no está disponible.');
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

        this.cleanup(message.guild.id);
        message.reply('⏹️ Música detenida y desconectado del canal de voz.');
    }

    // Limpiar recursos
    cleanup(guildId) {
        const queue = this.queues.get(guildId);
        if (queue) {
            if (queue.player) queue.player.stop();
            if (queue.connection) queue.connection.destroy();
            if (queue.process) queue.process.kill();
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