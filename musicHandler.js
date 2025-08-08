const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const scdl = require('soundcloud-downloader').default;
const axios = require('axios');

class MusicHandler {
    constructor() {
        this.connections = new Map(); // Almacena conexiones por guild
        this.players = new Map(); // Almacena players por guild
        this.queues = new Map(); // Almacena colas por guild
        this.nowPlaying = new Map(); // Almacena canción actual por guild
        
        // Configuración de APIs
        this.deezerApiUrl = 'https://api.deezer.com';
        // soundcloud-downloader maneja internamente los client_ids
    }

    // Buscar canción en Deezer
    async searchDeezer(query, limit = 5) {
        try {
            const response = await axios.get(`${this.deezerApiUrl}/search`, {
                params: {
                    q: query,
                    limit: limit
                }
            });
            
            return response.data.data.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.artist.name,
                album: track.album.title,
                duration: track.duration,
                preview: track.preview,
                cover: track.album.cover_medium
            }));
        } catch (error) {
            console.error('Error buscando en Deezer:', error);
            return [];
        }
    }

    // Buscar en SoundCloud usando los datos de Deezer
    async findOnSoundCloud(deezerTrack) {
        try {
            const searchQuery = `${deezerTrack.artist} ${deezerTrack.title}`;
            
            // soundcloud-downloader maneja automáticamente el client_id
            const tracks = await scdl.search({
                query: searchQuery,
                limit: 5,
                offset: 0
            });

            if (tracks && tracks.collection && tracks.collection.length > 0) {
                // Buscar la mejor coincidencia
                const bestMatch = this.findBestMatch(deezerTrack, tracks.collection);
                return bestMatch;
            }
            return null;
        } catch (error) {
            console.error('Error buscando en SoundCloud:', error);
            // Fallback: intentar búsqueda más simple
            try {
                const simpleSearch = await scdl.search(searchQuery);
                return simpleSearch && simpleSearch.length > 0 ? simpleSearch[0] : null;
            } catch (fallbackError) {
                console.error('Error en búsqueda fallback:', fallbackError);
                return null;
            }
        }
    }

    // Encontrar la mejor coincidencia entre Deezer y SoundCloud
    findBestMatch(deezerTrack, soundcloudTracks) {
        const deezerTitle = deezerTrack.title.toLowerCase();
        const deezerArtist = deezerTrack.artist.toLowerCase();
        
        let bestScore = 0;
        let bestTrack = soundcloudTracks[0];

        soundcloudTracks.forEach(track => {
            const scTitle = track.title.toLowerCase();
            let score = 0;

            // Puntuación por coincidencia en título
            if (scTitle.includes(deezerTitle) || deezerTitle.includes(scTitle.split(' ')[0])) {
                score += 3;
            }

            // Puntuación por coincidencia en artista
            if (scTitle.includes(deezerArtist)) {
                score += 2;
            }

            // Puntuación por duración similar (±30 segundos)
            const durationDiff = Math.abs(track.duration - (deezerTrack.duration * 1000));
            if (durationDiff < 30000) {
                score += 1;
            }

            if (score > bestScore) {
                bestScore = score;
                bestTrack = track;
            }
        });

        return bestTrack;
    }

    // Unirse al canal de voz
    async joinVoice(message) {
        const member = message.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return { success: false, message: '¡Necesitas estar en un canal de voz!' };
        }

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            this.connections.set(message.guild.id, connection);
            
            // Crear player si no existe
            if (!this.players.has(message.guild.id)) {
                const player = createAudioPlayer();
                this.players.set(message.guild.id, player);
                connection.subscribe(player);

                // Manejar eventos del player
                player.on(AudioPlayerStatus.Idle, () => {
                    this.playNext(message.guild.id);
                });

                player.on('error', (error) => {
                    console.error('Error en el reproductor:', error);
                    this.playNext(message.guild.id);
                });
            }

            return { success: true, message: `Conectado a ${voiceChannel.name}!` };
        } catch (error) {
            console.error('Error conectando al canal de voz:', error);
            return { success: false, message: 'Error al conectar al canal de voz.' };
        }
    }

    // Añadir canción a la cola
    async addToQueue(message, query) {
        // Buscar en Deezer
        const deezerResults = await this.searchDeezer(query, 1);
        
        if (deezerResults.length === 0) {
            return { success: false, message: 'No se encontraron resultados en Deezer.' };
        }

        const deezerTrack = deezerResults[0];
        
        // Buscar en SoundCloud
        const soundcloudTrack = await this.findOnSoundCloud(deezerTrack);
        
        if (!soundcloudTrack) {
            return { success: false, message: 'No se encontró la canción en SoundCloud.' };
        }

        // Crear objeto de canción combinado
        const song = {
            deezer: deezerTrack,
            soundcloud: soundcloudTrack,
            requestedBy: message.author,
            url: soundcloudTrack.permalink_url
        };

        // Añadir a la cola
        const guildId = message.guild.id;
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, []);
        }

        this.queues.get(guildId).push(song);

        return { 
            success: true, 
            message: `Añadido a la cola: **${deezerTrack.title}** - ${deezerTrack.artist}`,
            song: song
        };
    }

    // Reproducir canción
    async play(guildId) {
        const queue = this.queues.get(guildId);
        const player = this.players.get(guildId);

        if (!queue || queue.length === 0) {
            return { success: false, message: 'La cola está vacía.' };
        }

        const song = queue[0];
        
        try {
            // Crear stream de audio desde SoundCloud
            const stream = await scdl.download(song.soundcloud.permalink_url);
            const resource = createAudioResource(stream, {
                metadata: {
                    title: song.deezer.title,
                    artist: song.deezer.artist
                }
            });

            player.play(resource);
            this.nowPlaying.set(guildId, song);

            return { success: true, song: song };
        } catch (error) {
            console.error('Error reproduciendo canción:', error);
            // Remover canción problemática y continuar
            queue.shift();
            return this.playNext(guildId);
        }
    }

    // Reproducir siguiente canción
    async playNext(guildId) {
        const queue = this.queues.get(guildId);
        
        if (queue && queue.length > 0) {
            queue.shift(); // Remover canción actual
            if (queue.length > 0) {
                return await this.play(guildId);
            }
        }

        this.nowPlaying.delete(guildId);
        return { success: false, message: 'Cola terminada.' };
    }

    // Saltar canción
    skip(guildId) {
        const player = this.players.get(guildId);
        if (player) {
            player.stop();
            return { success: true, message: 'Canción saltada.' };
        }
        return { success: false, message: 'No hay música reproduciéndose.' };
    }

    // Pausar música
    pause(guildId) {
        const player = this.players.get(guildId);
        if (player) {
            player.pause();
            return { success: true, message: 'Música pausada.' };
        }
        return { success: false, message: 'No hay música reproduciéndose.' };
    }

    // Reanudar música
    resume(guildId) {
        const player = this.players.get(guildId);
        if (player) {
            player.unpause();
            return { success: true, message: 'Música reanudada.' };
        }
        return { success: false, message: 'No hay música pausada.' };
    }

    // Mostrar cola
    showQueue(guildId) {
        const queue = this.queues.get(guildId);
        const nowPlaying = this.nowPlaying.get(guildId);

        if (!queue || queue.length === 0) {
            return { success: false, message: 'La cola está vacía.' };
        }

        return {
            success: true,
            nowPlaying: nowPlaying,
            queue: queue.slice(0, 10) // Mostrar solo primeras 10
        };
    }

    // Limpiar cola
    clearQueue(guildId) {
        this.queues.set(guildId, []);
        return { success: true, message: 'Cola limpiada.' };
    }

    // Desconectar
    disconnect(guildId) {
        const connection = this.connections.get(guildId);
        const player = this.players.get(guildId);

        if (connection) {
            connection.destroy();
            this.connections.delete(guildId);
        }

        if (player) {
            player.stop();
            this.players.delete(guildId);
        }

        this.queues.delete(guildId);
        this.nowPlaying.delete(guildId);

        return { success: true, message: 'Desconectado del canal de voz.' };
    }

    // Crear embed para mostrar información de canción
    createSongEmbed(song, type = 'nowPlaying') {
        const embed = new EmbedBuilder()
            .setColor(type === 'nowPlaying' ? '#1DB954' : '#FF6B35')
            .setThumbnail(song.deezer.cover)
            .addFields(
                { name: '🎵 Título', value: song.deezer.title, inline: true },
                { name: '👨‍🎤 Artista', value: song.deezer.artist, inline: true },
                { name: '💿 Álbum', value: song.deezer.album, inline: true },
                { name: '⏱️ Duración', value: this.formatDuration(song.deezer.duration), inline: true },
                { name: '📱 Solicitado por', value: song.requestedBy.displayName, inline: true },
                { name: '🔗 Fuente', value: 'Deezer + SoundCloud', inline: true }
            );

        if (type === 'nowPlaying') {
            embed.setTitle('🎶 Reproduciendo ahora');
        } else if (type === 'added') {
            embed.setTitle('➕ Añadido a la cola');
        }

        return embed;
    }

    // Formatear duración
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Funciones para manejar comandos
    
    async handlePlay(message, args) {  
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF6B35')
                .setTitle('❌ Error')
                .setDescription(`Uso: \`${PREFIX}play <nombre de la canción>\``)
                .addFields(
                    { name: 'Ejemplos:', value: `\`${PREFIX}play despacito\`\n\`${PREFIX}p bad bunny safaera\`` }
                );
            return message.reply({ embeds: [embed] });
        }
    
        const loadingEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🔍 Buscando...')
            .setDescription(`Buscando: **${args.join(' ')}**`);
        
        const loadingMsg = await message.reply({ embeds: [loadingEmbed] });
    
        const query = args.join(' ');
        
        try {
            // Unirse al canal de voz
            console.log('🔗 Intentando unirse al canal de voz...');
            const joinResult = await this.joinVoice(message);
            if (!joinResult.success) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Error')
                    .setDescription(joinResult.message);
                return loadingMsg.edit({ embeds: [errorEmbed] });
            }
            
            console.log('🎵 Añadiendo a la cola...');
            // Añadir a la cola
            const queueResult = await this.addToQueue(message, query);
            if (!queueResult.success) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Error')
                    .setDescription(queueResult.message);
                return loadingMsg.edit({ embeds: [errorEmbed] });
            }
            
            // Si es la primera canción, reproducir inmediatamente
            const queue = this.queues.get(message.guild.id);
            const isFirst = queue.length === 1;
            
            if (isFirst) {
                console.log('▶️ Reproduciendo primera canción...');
                const playResult = await this.play(message.guild.id);
                if (playResult.success) {
                    const embed = this.createSongEmbed(playResult.song, 'nowPlaying');
                    await loadingMsg.edit({ embeds: [embed] });
                } else {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('❌ Error')
                        .setDescription('Error al reproducir la canción.');
                    await loadingMsg.edit({ embeds: [errorEmbed] });
                }
            } else {
                const embed = this.createSongEmbed(queueResult.song, 'added');
                embed.addFields({
                    name: '📋 Posición en cola',
                    value: `${queue.length}`,
                    inline: true
                });
                await loadingMsg.edit({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error en handlePlay:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error')
                .setDescription(`Error procesando la canción: ${error.message}`);
            await loadingMsg.edit({ embeds: [errorEmbed] });
        }
    }
    
    async handleSkip(message) {
        const result = this.skip(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor(result.success ? '#FFA500' : '#FF0000')
            .setTitle(result.success ? '⏭️ Canción saltada' : '❌ Error')
            .setDescription(result.message)
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    }
    
    async handlePause(message) {
        const result = this.pause(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor(result.success ? '#FFA500' : '#FF0000')
            .setTitle(result.success ? '⏸️ Música pausada' : '❌ Error')
            .setDescription(result.message)
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    }
    
    async handleResume(message) {
        const result = this.resume(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor(result.success ? '#00FF00' : '#FF0000')
            .setTitle(result.success ? '▶️ Música reanudada' : '❌ Error')
            .setDescription(result.message)
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    }
    
    async handleQueue(message) {
        const result = this.showQueue(message.guild.id);
        
        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('📋 Cola de reproducción')
                .setDescription(result.message)
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle('📋 Cola de reproducción')
            .setTimestamp();
        
        if (result.nowPlaying) {
            embed.addFields({
                name: '🎶 Reproduciendo ahora',
                value: `**${result.nowPlaying.deezer.title}** - ${result.nowPlaying.deezer.artist}`,
                inline: false
            });
        }
        
        if (result.queue.length > 0) {
            const queueList = result.queue.map((song, index) => 
                `${index + 1}. **${song.deezer.title}** - ${song.deezer.artist}`
            ).join('\n');
            
            embed.addFields({
                name: '⏳ Siguiente(s)',
                value: queueList.length > 1024 ? queueList.substring(0, 1021) + '...' : queueList,
                inline: false
            });
            
            embed.setFooter({
                text: `Total: ${result.queue.length} canción(es) en cola`
            });
        }
        
        message.reply({ embeds: [embed] });
    }
    
    async handleNowPlaying(message) {
        const nowPlaying = this.nowPlaying.get(message.guild.id);
        
        if (!nowPlaying) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error')
                .setDescription('No hay música reproduciéndose.')
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        const embed = this.createSongEmbed(nowPlaying, 'nowPlaying');
        message.reply({ embeds: [embed] });
    }
    
    async handleClear(message) {
        const result = this.clearQueue(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🗑️ Cola limpiada')
            .setDescription(result.message)
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    }
    
    async handleStop(message) {
        const result = this.disconnect(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⏹️ Música detenida')
            .setDescription(result.message)
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    }
    
    async handleSearch(message, args) {
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF6B35')
                .setTitle('❌ Error')
                .setDescription(`Uso: mon!search <término de búsqueda>`)
                .addFields(
                    { name: 'Ejemplo:', value: `mon!search bad bunny` }
                );
            return message.reply({ embeds: [embed] });
        }
    
        const loadingEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🔍 Buscando en Deezer...')
            .setDescription(`Término: **${args.join(' ')}**`);
        
        const loadingMsg = await message.reply({ embeds: [loadingEmbed] });
    
        const query = args.join(' ');
        const results = await this.searchDeezer(query, 5);
        
        if (results.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Sin resultados')
                .setDescription('No se encontraron resultados en Deezer.')
                .setTimestamp();
            return loadingMsg.edit({ embeds: [errorEmbed] });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF6B35')
            .setTitle('🔍 Resultados de búsqueda en Deezer')
            .setDescription(`Resultados para: **${query}**`)
            .setTimestamp();
        
        results.forEach((track, index) => {
            embed.addFields({
                name: `${index + 1}. ${track.title}`,
                value: `👨‍🎤 **Artista:** ${track.artist}\n💿 **Álbum:** ${track.album}\n⏱️ **Duración:** ${this.formatDuration(track.duration)}`,
                inline: true
            });
        });
        
        embed.setFooter({
            text: `Usa mon!play <nombre de canción> para reproducir`
        });
        
        loadingMsg.edit({ embeds: [embed] });
    }

    async processCommand(message) {
        if (message.author.bot) return;

        const args = message.content.trim().split(/ +/g);
        const command = args[0].toLowerCase();

        try {
            switch (command) {
                case 'mon!play':
                case 'mon!p':
                    await this.handlePlay(message, args);
                    break;
                
                case 'mon!skip':
                case 'mon!s':
                    await this.handleSkip(message);
                    break;
                
                case 'mon!pause':
                    await this.handlePause(message);
                    break;
                
                case 'mon!resume':
                case 'mon!r':
                    await this.handleResume(message);
                    break;
                
                case 'mon!queue':
                case 'mon!q':
                    await this.handleQueue(message);
                    break;
                
                case 'mon!nowplaying':
                case 'mon!np':
                    await this.handleNowPlaying(message);
                    break;
                
                case 'mon!clearmusic':
                case 'mon!cm':
                    await this.handleClear(message);
                    break;
                
                case 'mon!stop':
                case 'mon!disconnect':
                case 'mon!dc':
                    await this.handleStop(message);
                    break;
    
                case 'mon!search':
                    await this.handleSearch(message, args);
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error('❌ Error procesando comando:', error);
            await message.reply('❌ Ocurrió un error al procesar el comando. Intenta de nuevo.');
        }
    }    
}

module.exports = MusicHandler;
