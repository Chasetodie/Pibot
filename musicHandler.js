const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const ytSearch = require('yt-search');

class MusicHandler {
    constructor(client) {
        this.client = client;
        this.queues = new Map();
        
        // Instancias públicas de Invidious
        this.invidiousInstances = [
            'https://inv.riverside.rocks',
            'https://invidious.snopyta.org',
            'https://invidious.kavin.rocks',
            'https://invidious.tube',
            'https://invidious.site'
        ];
        this.currentInstance = 0;
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
            // Buscar en YouTube
            console.log('🔍 Buscando:', query);
            const searchResults = await ytSearch(query);
            
            if (!searchResults?.videos?.length) {
                return message.reply(`❌ No se encontraron resultados para: **${query}**`);
            }

            const video = searchResults.videos[0];
            const videoId = this.extractVideoId(video.url);
            
            if (!videoId) {
                return message.reply('❌ No se pudo extraer el ID del video.');
            }

            // Obtener URL de audio usando Invidious
            const audioUrl = await this.getAudioUrl(videoId);
            
            if (!audioUrl) {
                return message.reply('❌ No se pudo obtener el audio del video.');
            }

            // Crear stream desde la URL directa
            const response = await axios({
                method: 'get',
                url: audioUrl,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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

            // Guardar información de la cola
            this.queues.set(message.guild.id, {
                connection,
                player,
                textChannel: message.channel
            });

            // Reproducir
            player.play(resource);

            // Embed de reproducción
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

            // Eventos del reproductor
            player.on(AudioPlayerStatus.Idle, () => {
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
            message.reply('❌ Error al reproducir la música. Intenta con otra canción.');
        }
    }

    async getAudioUrl(videoId) {
        // Intentar con diferentes instancias de Invidious
        for (let i = 0; i < this.invidiousInstances.length; i++) {
            try {
                const instance = this.invidiousInstances[this.currentInstance];
                console.log(`🔄 Intentando con instancia: ${instance}`);
                
                const response = await axios.get(`${instance}/api/v1/videos/${videoId}`, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                const adaptiveFormats = response.data.adaptiveFormats;
                
                // Buscar formato de audio
                const audioFormat = adaptiveFormats.find(format => 
                    format.type.includes('audio') && format.url
                );

                if (audioFormat) {
                    console.log('✅ URL de audio encontrada');
                    return audioFormat.url;
                }

                // Rotar a la siguiente instancia
                this.currentInstance = (this.currentInstance + 1) % this.invidiousInstances.length;
                
            } catch (error) {
                console.log(`❌ Error con instancia ${this.invidiousInstances[this.currentInstance]}:`, error.message);
                this.currentInstance = (this.currentInstance + 1) % this.invidiousInstances.length;
                continue;
            }
        }

        return null;
    }

    extractVideoId(url) {
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
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
            .setTitle('🎵 Comandos de Música (Invidious)')
            .addFields(
                { name: '`>play <búsqueda>`', value: 'Reproduce música', inline: true },
                { name: '`>stop`', value: 'Para la música', inline: true },
                { name: '`>help`', value: 'Muestra esta ayuda', inline: true }
            )
            .setFooter({ text: 'Bot usando Invidious API' });

        message.reply({ embeds: [embed] });
    }
}

module.exports = MusicHandler;