const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const ytSearch = require('yt-search');
const axios = require('axios');

class MusicHandler {
    constructor(client) {
        this.client = client;
        this.queues = new Map();
    }

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
                this.showHelp(message);
                break;
        }
    }

    async play(message, query) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ ¡Necesitas estar en un canal de voz!');
        }

        if (!query) {
            return message.reply('❌ ¡Necesitas proporcionar una búsqueda!');
        }

        try {
            // Buscar el video
            console.log('🔍 Buscando:', query);
            const searchResults = await ytSearch(query);
            
            if (!searchResults?.videos?.length) {
                return message.reply(`❌ No se encontraron resultados para: **${query}**`);
            }

            const video = searchResults.videos[0];
            console.log('🎵 Video encontrado:', video.title);

            // Obtener múltiples URLs de audio usando diferentes métodos
            const audioUrl = await this.getWorkingAudioUrl(video.videoId);
            
            if (!audioUrl) {
                return message.reply('❌ No se pudo obtener el audio. Intenta con otra canción.');
            }

            console.log('🎶 Creando stream...');

            // Crear stream desde la URL
            const response = await axios({
                method: 'get',
                url: audioUrl,
                responseType: 'stream',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Range': 'bytes=0-'
                }
            });

            const resource = createAudioResource(response.data, {
                inputType: 'arbitrary'
            });

            // Conectar al canal de voz
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            connection.subscribe(player);

            // Guardar información
            this.queues.set(message.guild.id, {
                connection,
                player,
                textChannel: message.channel
            });

            // Reproducir
            player.play(resource);
            console.log('▶️ Reproduciendo...');

            // Enviar embed
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎵 Reproduciendo ahora')
                .setDescription(`[${video.title}](${video.url})`)
                .addFields(
                    { name: '⏱️ Duración', value: video.duration.timestamp, inline: true },
                    { name: '👤 Solicitado por', value: message.author.toString(), inline: true }
                )
                .setThumbnail(video.thumbnail);

            message.reply({ embeds: [embed] });

            // Eventos
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
            message.reply('❌ Error al reproducir. Intenta con otra canción.');
        }
    }

    async getWorkingAudioUrl(videoId) {
        const methods = [
            () => this.tryInvidiousMethod(videoId),
            () => this.tryPipedMethod(videoId),
            () => this.tryDirectMethod(videoId)
        ];

        for (let i = 0; i < methods.length; i++) {
            try {
                console.log(`🔄 Probando método ${i + 1}...`);
                const url = await methods[i]();
                if (url) {
                    console.log(`✅ Método ${i + 1} exitoso`);
                    return url;
                }
            } catch (error) {
                console.log(`❌ Método ${i + 1} falló:`, error.message);
                continue;
            }
        }

        return null;
    }

    async tryInvidiousMethod(videoId) {
        const instances = [
            'https://invidious.protokolla.fi',
            'https://invidious.private.coffee',
            'https://yt.artemislena.eu'
        ];

        for (const instance of instances) {
            try {
                const response = await axios.get(`${instance}/api/v1/videos/${videoId}`, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                if (response.data?.adaptiveFormats) {
                    const audioFormat = response.data.adaptiveFormats.find(format => 
                        format.type?.includes('audio') && format.url
                    );
                    if (audioFormat) return audioFormat.url;
                }
            } catch (error) {
                continue;
            }
        }
        return null;
    }

    async tryPipedMethod(videoId) {
        const instances = [
            'https://pipedapi.kavin.rocks',
            'https://api-piped.mha.fi'
        ];

        for (const instance of instances) {
            try {
                const response = await axios.get(`${instance}/streams/${videoId}`, {
                    timeout: 10000
                });

                if (response.data?.audioStreams?.length > 0) {
                    return response.data.audioStreams[0].url;
                }
            } catch (error) {
                continue;
            }
        }
        return null;
    }

    async tryDirectMethod(videoId) {
        // Este método usa cobalt.tools API (más confiable)
        try {
            const response = await axios.post('https://co.wuk.sh/api/json', {
                url: `https://www.youtube.com/watch?v=${videoId}`,
                vCodec: 'h264',
                vQuality: '720',
                aFormat: 'mp3',
                filenamePattern: 'classic',
                isAudioOnly: true
            }, {
                timeout: 15000,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (response.data?.status === 'success' && response.data?.url) {
                return response.data.url;
            }
        } catch (error) {
            console.log('❌ Método directo falló:', error.message);
        }
        return null;
    }

    stop(message) {
        const queue = this.queues.get(message.guild.id);
        if (!queue) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        this.cleanup(message.guild.id);
        message.reply('⏹️ Música detenida.');
    }

    cleanup(guildId) {
        const queue = this.queues.get(guildId);
        if (queue) {
            if (queue.player) queue.player.stop();
            if (queue.connection) queue.connection.destroy();
            this.queues.delete(guildId);
        }
    }

    showHelp(message) {
        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('🎵 Comandos de Música')
            .addFields(
                { name: '`>play <búsqueda>`', value: 'Reproduce música', inline: true },
                { name: '`>stop`', value: 'Para la música', inline: true },
                { name: '`>help`', value: 'Muestra esta ayuda', inline: true }
            )
            .setFooter({ text: 'Bot con múltiples métodos de extracción' });

        message.reply({ embeds: [embed] });
    }
}

module.exports = MusicHandler;