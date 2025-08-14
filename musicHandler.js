const { DisTube } = require('distube');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

class MusicHandler {
    constructor(client) {
        this.client = client;
        this.distube = new DisTube(client, {
            searchSongs: 10,
            plugins: [],
            ffmpeg: {
                path: require('ffmpeg-static')
            }
        });

        this.setupEvents();
    }

    setupEvents() {
        // Evento cuando comienza a reproducir una canción
        this.distube.on('playSong', (queue, song) => {
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎵 Reproduciendo ahora')
                .setDescription(`[${song.name}](${song.url})`)
                .addFields(
                    { name: '⏱️ Duración', value: song.formattedDuration, inline: true },
                    { name: '👤 Solicitado por', value: song.user.toString(), inline: true },
                    { name: '📺 Fuente', value: song.source, inline: true }
                )
                .setThumbnail(song.thumbnail)
                .setFooter({ text: `Cola: ${queue.songs.length} canciones` });

            queue.textChannel.send({ embeds: [embed] });
        });

        // Evento cuando se añade una canción a la cola
        this.distube.on('addSong', (queue, song) => {
            const embed = new EmbedBuilder()
                .setColor('#FFD93D')
                .setTitle('➕ Canción añadida a la cola')
                .setDescription(`[${song.name}](${song.url})`)
                .addFields(
                    { name: '⏱️ Duración', value: song.formattedDuration, inline: true },
                    { name: '👤 Solicitado por', value: song.user.toString(), inline: true },
                    { name: '#️⃣ Posición en cola', value: `${queue.songs.length}`, inline: true }
                )
                .setThumbnail(song.thumbnail);

            queue.textChannel.send({ embeds: [embed] });
        });

        // Evento para manejar múltiples resultados de búsqueda
        this.distube.on('searchResult', (message, results) => {
            this.handleSearchResults(message, results);
        });

        // Evento cuando no se encuentran resultados
        this.distube.on('searchNoResult', (message, query) => {
            message.reply(`❌ No se encontraron resultados para: **${query}**`);
        });

        // Evento de error
        this.distube.on('error', (textChannel, error) => {
            console.error('DisTube Error:', error);
            textChannel.send(`❌ Ocurrió un error: ${error.message}`);
        });

        // Evento cuando la cola termina
        this.distube.on('finish', (queue) => {
            queue.textChannel.send('✅ Cola terminada. ¡Gracias por escuchar!');
        });

        // Evento cuando alguien se desconecta
        this.distube.on('disconnect', (queue) => {
            queue.textChannel.send('👋 Me desconecté del canal de voz.');
        });
    }

    // Manejar resultados de búsqueda múltiple
    handleSearchResults(message, results) {
        const embed = new EmbedBuilder()
            .setColor('#6C5CE7')
            .setTitle('🔍 Resultados de búsqueda')
            .setDescription('Selecciona una canción de la lista:')
            .setFooter({ text: 'Tienes 30 segundos para elegir' });

        const options = results.slice(0, 5).map((song, index) => ({
            label: `${index + 1}. ${song.name.substring(0, 50)}`,
            description: `${song.formattedDuration} - ${song.uploader?.name || 'Desconocido'}`.substring(0, 100),
            value: index.toString(),
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('song-select')
            .setPlaceholder('Elige una canción...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        message.reply({ 
            embeds: [embed], 
            components: [row] 
        }).then(msg => {
            // Guardar el mensaje y resultados para la selección
            this.pendingSearches = this.pendingSearches || new Map();
            this.pendingSearches.set(msg.id, {
                results: results,
                originalMessage: message
            });

            // Limpiar después de 30 segundos
            setTimeout(() => {
                if (this.pendingSearches.has(msg.id)) {
                    this.pendingSearches.delete(msg.id);
                    msg.edit({ 
                        content: '⏰ Tiempo agotado para seleccionar canción.',
                        embeds: [], 
                        components: [] 
                    });
                }
            }, 30000);
        });
    }

    // Manejar selección de canción del menú
    async handleSongSelection(interaction) {
        if (!this.pendingSearches || !this.pendingSearches.has(interaction.message.id)) {
            return interaction.reply({ content: '❌ Esta búsqueda ha expirado.', ephemeral: true });
        }

        const selectedIndex = parseInt(interaction.values[0]);
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ ¡Necesitas estar en un canal de voz!', ephemeral: true });
        }

        const searchData = this.pendingSearches.get(interaction.message.id);
        const selectedSong = searchData.results[selectedIndex];

        try {
            await this.distube.play(voiceChannel, selectedSong.url, {
                member: interaction.member,
                textChannel: interaction.channel,
            });

            await interaction.update({ 
                content: `✅ Reproduciendo: **${selectedSong.name}**`, 
                embeds: [], 
                components: [] 
            });

            // Limpiar búsqueda pendiente
            this.pendingSearches.delete(interaction.message.id);
        } catch (error) {
            console.error('Error al seleccionar canción:', error);
            interaction.reply({ content: '❌ Error al reproducir la canción seleccionada.', ephemeral: true });
        }
    }

    async play(message, query) {
        console.log('🎵 Método play llamado con query:', query); // DEBUG
        
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            console.log('❌ Usuario no está en canal de voz'); // DEBUG
            return message.reply('❌ ¡Necesitas estar en un canal de voz para usar este comando!');
        }

        if (!query) {
            console.log('❌ No se proporcionó query'); // DEBUG
            return message.reply('❌ ¡Necesitas proporcionar una URL o término de búsqueda!');
        }

        console.log('✅ Intentando reproducir...'); // DEBUG
        
        try {
            await this.distube.play(voiceChannel, query, {
                member: message.member,
                textChannel: message.channel,
                message
            });
            console.log('✅ Comando distube.play ejecutado'); // DEBUG
        } catch (error) {
            console.error('❌ Error en distube.play:', error); // DEBUG
            message.reply('❌ Ocurrió un error al intentar reproducir la música.');
        }
    }

    // Pausar/Reanudar música
    togglePause(message) {
        const queue = this.distube.getQueue(message.guild.id);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');
        
        if (queue.paused) {
            this.distube.resume(message.guild.id);
            message.reply('▶️ Música reanudada.');
        } else {
            this.distube.pause(message.guild.id);
            message.reply('⏸️ Música pausada.');
        }
    }

    // Saltar canción
    async skip(message) {
        const queue = this.distube.getQueue(message.guild.id);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');
        
        try {
            const song = await this.distube.skip(message.guild.id);
            message.reply(`⏭️ Canción saltada. Ahora reproduciendo: **${song.name}**`);
        } catch (error) {
            message.reply('❌ No hay más canciones en la cola.');
        }
    }

    // Detener música
    stop(message) {
        const queue = this.distube.getQueue(message.guild.id);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');
        
        this.distube.stop(message.guild.id);
        message.reply('⏹️ Música detenida y cola limpiada.');
    }

    // Mostrar cola
    showQueue(message) {
        const queue = this.distube.getQueue(message.guild.id);
        if (!queue) return message.reply('❌ No hay música en la cola.');

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('🎵 Cola de Música')
            .setDescription(
                queue.songs.slice(0, 10).map((song, i) => 
                    `${i === 0 ? '**Reproduciendo:**' : `${i}.`} [${song.name}](${song.url}) - \`${song.formattedDuration}\``
                ).join('\n')
            )
            .setFooter({ text: `${queue.songs.length} canciones en total` });

        message.reply({ embeds: [embed] });
    }

    // Mostrar canción actual
    nowPlaying(message) {
        const queue = this.distube.getQueue(message.guild.id);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');

        const song = queue.songs[0];
        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🎵 Reproduciendo ahora')
            .setDescription(`[${song.name}](${song.url})`)
            .addFields(
                { name: '⏱️ Duración', value: song.formattedDuration, inline: true },
                { name: '👤 Solicitado por', value: song.user.toString(), inline: true },
                { name: '🔊 Volumen', value: `${queue.volume}%`, inline: true }
            )
            .setThumbnail(song.thumbnail);

        message.reply({ embeds: [embed] });
    }

    // Cambiar volumen
    setVolume(message, volume) {
        const queue = this.distube.getQueue(message.guild.id);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');

        const vol = parseInt(volume);
        if (isNaN(vol) || vol < 0 || vol > 100) {
            return message.reply('❌ El volumen debe ser un número entre 0 y 100.');
        }

        this.distube.setVolume(message.guild.id, vol);
        message.reply(`🔊 Volumen establecido a: **${vol}%**`);
    }

    // Procesar comandos
    async processCommand(message) {
        console.log('🔄 processCommand llamado con:', message.content); // DEBUG
        
        const args = message.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        console.log('🎯 Comando procesado:', command, 'Args:', args);
        console.log('🔍 Tipo de command:', typeof command); // NUEVO DEBUG
        console.log('🔍 Command length:', command.length); // NUEVO DEBUG

        // Comandos de música
        switch (command) {
            case 'play':
            case 'p':
                const query = args.join(' ');
                await this.play(message, query);
                break;

            case 'pause':
                this.togglePause(message);
                break;

            case 'skip':
            case 's':
                await this.skip(message);
                break;

            case 'stop':
                this.stop(message);
                break;

            case 'queue':
            case 'q':
                this.showQueue(message);
                break;

            case 'nowplaying':
            case 'np':
                this.nowPlaying(message);
                break;

            case 'volume':
            case 'vol':
                const volume = args[0];
                this.setVolume(message, volume);
                break;

            case 'helpmusic':
            case 'commandsmusic':
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('🎵 Comandos de Música')
                    .addFields(
                        { name: '`>play <url/búsqueda>`', value: 'Reproduce música', inline: true },
                        { name: '`>pause`', value: 'Pausa/reanuda música', inline: true },
                        { name: '`>skip` o `>s`', value: 'Salta canción actual', inline: true },
                        { name: '`>stop`', value: 'Para música y limpia cola', inline: true },
                        { name: '`>queue` o `>q`', value: 'Muestra la cola', inline: true },
                        { name: '`>nowplaying` o `>np`', value: 'Canción actual', inline: true },
                        { name: '`>volume <0-100>`', value: 'Cambia volumen', inline: true },
                        { name: '`>help`', value: 'Muestra esta ayuda', inline: true }
                    )
                    .setFooter({ text: 'Bot de música con DisTube' });

                message.reply({ embeds: [embed] });
                break;
        }
    }
}

module.exports = MusicHandler;