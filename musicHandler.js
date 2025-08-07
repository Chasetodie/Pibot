const playdl = require('play-dl');
const prism = require('prism-media');

class MusicHandler {
    constructor() {
        this.connections = new Map();
        this.queues = new Map();
    }

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
                    thumbnail: video.thumbnails[0]?.url,
                    channel: video.channel?.name
                };
            }
            return null;
        } catch (error) {
            console.error('Error buscando:', error);
            return null;
        }
    }

    isValidYouTubeUrl(url) {
        try {
            return playdl.yt_validate(url) === 'video';
        } catch {
            return false;
        }
    }

    async getVideoInfo(url) {
        try {
            const info = await playdl.video_info(url);
            const video = info.video_details;
            return {
                title: video.title,
                url: video.url,
                duration: video.durationInSec,
                thumbnail: video.thumbnails[0]?.url,
                channel: video.channel?.name
            };
        } catch (error) {
            console.error('Error obteniendo info:', error);
            return null;
        }
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    async execute(message, args) {
        // Verificar si el usuario está en un canal de voz
        if (!message.member.voice.channel) {
            return message.reply('❌ ¡Necesitas estar en un canal de voz!');
        }

        if (!args.length) {
            return message.reply('❌ **Uso:** `!play <URL de YouTube o búsqueda>`');
        }

        const voiceChannel = message.member.voice.channel;
        const permissions = voiceChannel.permissionsFor(message.client.user);

        if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
            return message.reply('❌ No tengo permisos para conectarme o hablar en ese canal!');
        }

        let song;
        const searchMsg = await message.reply('🔍 **Buscando música...**');

        try {
            // Determinar si es URL o búsqueda
            if (this.isValidYouTubeUrl(args[0])) {
                song = await this.getVideoInfo(args[0]);
            } else {
                song = await this.searchYoutube(args.join(' '));
            }

            if (!song) {
                return searchMsg.edit('❌ No se encontraron resultados.');
            }

            // Conectar al canal de voz usando la API básica de Discord.js
            const connection = await voiceChannel.join();
            this.connections.set(message.guild.id, connection);

            // Obtener el stream
            const stream = await playdl.stream(song.url);
            
            // Crear el dispatcher usando prism-media
            const transcoder = new prism.FFmpeg({
                args: [
                    '-analyzeduration', '0',
                    '-loglevel', '0',
                    '-f', 's16le',
                    '-ar', '48000',
                    '-ac', '2'
                ]
            });

            const dispatcher = connection.play(stream.stream.pipe(transcoder), {
                type: 'converted'
            });

            await searchMsg.delete();

            const embed = {
                color: 0x00ff00,
                title: '🎵 Reproduciendo',
                description: `**${song.title}**`,
                fields: [
                    { name: '📺 Canal', value: song.channel || 'Desconocido', inline: true },
                    { name: '⏱️ Duración', value: this.formatDuration(song.duration), inline: true }
                ],
                thumbnail: { url: song.thumbnail },
                timestamp: new Date()
            };

            message.channel.send({ embeds: [embed] });

            dispatcher.on('finish', () => {
                voiceChannel.leave();
                this.connections.delete(message.guild.id);
            });

            dispatcher.on('error', (error) => {
                console.error('Error del dispatcher:', error);
                message.channel.send('❌ Error reproduciendo la música.');
                voiceChannel.leave();
                this.connections.delete(message.guild.id);
            });

        } catch (error) {
            console.error('Error general:', error);
            searchMsg.edit('❌ Error procesando la solicitud.');
            if (voiceChannel.connection) {
                voiceChannel.leave();
            }
        }
    }

    stop(message) {
        const connection = this.connections.get(message.guild.id);
        if (!connection) {
            return message.reply('❌ No estoy reproduciendo música!');
        }

        const voiceChannel = message.member.voice.channel;
        if (voiceChannel) {
            voiceChannel.leave();
        }
        this.connections.delete(message.guild.id);
        
        message.reply('⏹️ **Música detenida y desconectado!**');
    }
}

module.exports = SimpleMusicHandler;