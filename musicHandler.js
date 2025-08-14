const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const play = require('play-dl');

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
                    .setFooter({ text: 'Bot de música básico' });

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
            // Verificar si es una URL directa de YouTube
            let songUrl;
            let songTitle = query;

            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                songUrl = query;
                console.log('🔗 URL directa detectada:', songUrl);
            } else {
                // Buscar la canción
                console.log('🔍 Buscando canción...');
                const searched = await play.search(query, { limit: 1, source: { youtube: 'video' } });
                
                if (!searched || searched.length === 0) {
                    return message.reply(`❌ No se encontraron resultados para: **${query}**`);
                }

                const song = searched[0];
                songUrl = song.url;
                songTitle = song.title;
                console.log('🎵 Canción encontrada:', songTitle, 'URL:', songUrl);
            }

            // Validar que la URL existe
            if (!songUrl || songUrl === 'undefined') {
                return message.reply('❌ No se pudo obtener la URL de la canción.');
            }

            // Obtener el stream de audio
            console.log('🎶 Obteniendo stream de audio...');
            const stream = await play.stream(songUrl, { quality: 2 });
            
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type
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

            // Reproducir la canción
            player.play(resource);
            console.log('▶️ Reproducción iniciada');

            // Guardar información de la cola
            this.queues.set(message.guild.id, {
                connection,
                player,
                textChannel: message.channel
            });

            // Embed de reproducción
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎵 Reproduciendo ahora')
                .setDescription(`**${songTitle}**`)
                .addFields(
                    { name: '👤 Solicitado por', value: message.author.toString(), inline: true },
                    { name: '🔗 URL', value: songUrl.substring(0, 50) + '...', inline: true }
                );

            message.reply({ embeds: [embed] });

            // Eventos del reproductor
            player.on(AudioPlayerStatus.Idle, () => {
                console.log('🏁 Reproducción terminada');
            });

            player.on('error', (error) => {
                console.error('❌ Error del reproductor:', error);
                message.channel.send('❌ Ocurrió un error durante la reproducción.');
            });

        } catch (error) {
            console.error('❌ Error en play:', error);
            
            if (error.message.includes('Sign in to confirm')) {
                message.reply('❌ YouTube está bloqueando el acceso. Intenta con una URL directa de YouTube.');
            } else if (error.code === 'ERR_INVALID_URL') {
                message.reply('❌ URL inválida. Intenta con una URL directa de YouTube.');
            } else {
                message.reply('❌ Ocurrió un error al buscar o reproducir la música.');
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
}

module.exports = MusicHandler;