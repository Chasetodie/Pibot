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
            // Buscar la canción
            const searched = await play.search(query, { limit: 1 });
            
            if (!searched || searched.length === 0) {
                return message.reply(`❌ No se encontraron resultados para: **${query}**`);
            }

            const song = searched[0];
            console.log('🎵 Canción encontrada:', song.title);

            // Obtener el stream de audio
            const stream = await play.stream(song.url);
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type
            });

            // Conectar al canal de voz
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
                .setDescription(`[${song.title}](${song.url})`)
                .addFields(
                    { name: '⏱️ Duración', value: song.durationRaw || 'Desconocida', inline: true },
                    { name: '👤 Solicitado por', value: message.author.toString(), inline: true }
                )
                .setThumbnail(song.thumbnails?.[0]?.url || null);

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
            message.reply('❌ Ocurrió un error al buscar o reproducir la música.');
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