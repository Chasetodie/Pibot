const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const play = require('play-dl');
const SpotifyWebApi = require('spotify-web-api-node');

// Cargar cookie de YouTube si existe en .env
if (process.env.YT_COOKIE) {
    play.setToken({
        youtube: {
            cookie: process.env.YT_COOKIE
        }
    });
    console.log("✅ Cookie de YouTube cargada.");
} else {
    console.warn("⚠ No se encontró YT_COOKIE en las variables de entorno.");
}

class ModernMusicHandler {
    constructor() {
        this.connections = new Map();
        this.players = new Map(); 
        this.queues = new Map();
        this.nowPlaying = new Map();
        this.paused = new Map();
        
        // Spotify API (opcional)
        this.spotify = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET
        });
        
        // Renovar token de Spotify cada hora
        this.refreshSpotifyToken();
        setInterval(() => this.refreshSpotifyToken(), 3600000);
    }

    async refreshSpotifyToken() {
        try {
            if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
                const data = await this.spotify.clientCredentialsGrant();
                this.spotify.setAccessToken(data.body.access_token);
                console.log('✅ Token de Spotify renovado');
            }
        } catch (error) {
            console.log('⚠️ No se pudo renovar token de Spotify:', error.message);
        }
    }

    // Buscar usando YouTube con fetch directo (sin yt-search)
    async searchYouTube(query, limit = 5) {
        try {
            console.log(`🔍 Buscando en YouTube: "${query}"`);
            const results = await play.search(query, {
                limit: limit,
                source: { youtube: 'video' }
            });

            return results
                .filter(video => !!video.url) // solo videos con URL válida
                .map(video => ({
                    id: video.id,
                    title: video.title || "Sin título",
                    artist: video.channel?.name || "Desconocido",
                    duration: video.durationInSec || 0,
                    url: video.url,
                    thumbnail: video.thumbnails?.[0]?.url || null,
                    views: video.views || 0
                }));
        } catch (error) {
            console.error('❌ Error buscando en YouTube:', error);
            return [];
        }
    }

    // Helper para parsear duración
    parseDuration(durationText) {
        if (!durationText) return null;
        const parts = durationText.split(':').reverse();
        let seconds = 0;
        
        for (let i = 0; i < parts.length; i++) {
            seconds += parseInt(parts[i]) * Math.pow(60, i);
        }
        
        return seconds;
    }

    // Helper para parsear vistas
    parseViews(viewText) {
        if (!viewText) return 0;
        const match = viewText.match(/[\d,]+/);
        if (match) {
            return parseInt(match[0].replace(/,/g, ''));
        }
        return 0;
    }

    // Obtener info de Spotify y buscar en YouTube
    async searchFromSpotify(spotifyUrl) {
        try {
            const trackId = this.extractSpotifyId(spotifyUrl);
            if (!trackId) return null;

            const data = await this.spotify.getTrack(trackId);
            const track = data.body;

            const searchQuery = `${track.artists[0].name} ${track.name}`;
            const youtubeResults = await this.searchYouTube(searchQuery, 1);

            if (youtubeResults.length === 0 || !youtubeResults[0].url) {
                console.warn(`⚠️ No se encontró URL válida en YouTube para: ${searchQuery}`);
                return null;
            }

            const result = youtubeResults[0];
            result.spotifyInfo = {
                title: track.name,
                artist: track.artists[0].name,
                album: track.album.name,
                cover: track.album.images[0]?.url
            };
            return result;
        } catch (error) {
            console.error('❌ Error obteniendo de Spotify:', error);
            return null;
        }
    }

    extractSpotifyId(url) {
        const match = url.match(/track\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    }

    isSpotifyUrl(url) {
        return url.includes('spotify.com/track/');
    }

    isYouTubeUrl(url) {
        return play.yt_validate(url) === 'video';
    }

    // Unirse al canal de voz (mejorado)
    async joinVoice(message) {
        const member = message.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return { success: false, message: '¡Necesitas estar en un canal de voz!' };
        }

        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return { success: false, message: 'No tengo permisos para unirme o hablar en ese canal.' };
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

                // Eventos del player
                player.on(AudioPlayerStatus.Idle, () => {
                    setTimeout(() => this.playNext(message.guild.id), 1000);
                });

                player.on('error', (error) => {
                    console.error('❌ Error en el reproductor:', error);
                    this.playNext(message.guild.id);
                });

                // Manejar desconexiones
                connection.on(VoiceConnectionStatus.Disconnected, () => {
                    setTimeout(() => {
                        if (connection.state.status === VoiceConnectionStatus.Disconnected) {
                            this.disconnect(message.guild.id);
                        }
                    }, 5000);
                });
            }

            return { success: true, message: `Conectado a ${voiceChannel.name}!` };
        } catch (error) {
            console.error('❌ Error conectando al canal de voz:', error);
            return { success: false, message: 'Error al conectar al canal de voz.' };
        }
    }

    // Añadir canción a la cola (mejorado)
    async addToQueue(message, query) {
        let song = null;

        try {
            if (this.isSpotifyUrl(query)) {
                // Buscar desde Spotify
                song = await this.searchFromSpotify(query);
                if (!song || !song.url) {
                    return { success: false, message: 'No se pudo obtener la canción de Spotify.' };
                }
            } else if (this.isYouTubeUrl(query)) {
                // URL directa de YouTube
                try {
                    const info = await play.video_info(query);
                    song = {
                        id: info.video_details.id,
                        title: info.video_details.title,
                        artist: info.video_details.channel.name,
                        duration: info.video_details.durationInSec,
                        url: info.video_details.url,
                        thumbnail: info.video_details.thumbnails[0]?.url
                    };
                } catch (error) {
                    return { success: false, message: 'No se pudo obtener información de ese video de YouTube.' };
                }
            } else {
                // Buscar por texto en YouTube
                const results = await this.searchYouTube(query, 1);
                if (results.length === 0) {
                    return { success: false, message: 'No se encontraron resultados.' };
                }
                song = results[0];
            }

            if (!song || !song.url) {
                console.error('❌ La canción no tiene URL:', song);
                return { success: false, message: 'No se pudo obtener la URL de la canción.' };
            }

            // Verificar que la canción se pueda reproducir
            if (!await this.isPlayable(song.url)) {
                return { success: false, message: 'Esta canción no se puede reproducir (restricciones de región/edad).' };
            }

            // Añadir metadata
            song.requestedBy = message.author;
            song.addedAt = Date.now();

            // Añadir a la cola
            const guildId = message.guild.id;
            if (!this.queues.has(guildId)) {
                this.queues.set(guildId, []);
            }

            this.queues.get(guildId).push(song);

            return { 
                success: true, 
                message: `Añadido a la cola: **${song.title}**`,
                song: song
            };
        } catch (error) {
            console.error('❌ Error añadiendo a la cola:', error);
            return { success: false, message: 'Error al procesar la canción.' };
        }
    }

    // Verificar si una canción se puede reproducir
    async isPlayable(url) {
        try {
            const info = await play.video_info(url);
            return !info.video_details.live;
        } catch (error) {
            console.log(`⚠️ No se pudo verificar: ${url}, pero intentaremos reproducir`);
            return true;
        }
    }

    async play(guildId) {
        const queue = this.queues.get(guildId);
        const player = this.players.get(guildId);

        if (!queue || queue.length === 0) {
            return { success: false, message: 'La cola está vacía.' };
        }

        const song = queue[0];

        // 🛠 Debug para ver qué está llegando
        console.log("🎯 Canción a reproducir:", JSON.stringify(song, null, 2));

        // 🚫 Si no hay URL, saltar
        if (!song || !song.url || typeof song.url !== "string") {
            console.error(`❌ Canción sin URL válida, saltando:`, song);
            queue.shift();
            return this.playNext(guildId);
        }

        try {
            console.log(`🎵 Reproduciendo: "${song.title}"`);
            const stream = await play.stream(song.url, { quality: 2 });

            const resource = createAudioResource(stream.stream, {
                inputType: stream.type,
                metadata: {
                    title: song.title,
                    artist: song.artist
                }
            });

            player.play(resource);
            this.nowPlaying.set(guildId, song);
            this.paused.set(guildId, false);

            console.log(`✅ Reproduciendo: "${song.title}"`);
            return { success: true, song: song };
        } catch (error) {
            console.error(`❌ Error reproduciendo "${song.title}":`, error);
            queue.shift();
            if (queue.length > 0) {
                console.log('🔄 Intentando siguiente canción...');
                return this.playNext(guildId);
            }
            return { success: false, message: `No se pudo reproducir "${song.title}".` };
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

    // Controles mejorados
    skip(guildId) {
        const player = this.players.get(guildId);
        if (player && player.state.status !== AudioPlayerStatus.Idle) {
            player.stop();
            return { success: true, message: 'Canción saltada.' };
        }
        return { success: false, message: 'No hay música reproduciéndose.' };
    }

    pause(guildId) {
        const player = this.players.get(guildId);
        if (player && player.state.status === AudioPlayerStatus.Playing) {
            player.pause();
            this.paused.set(guildId, true);
            return { success: true, message: 'Música pausada.' };
        }
        return { success: false, message: 'No hay música reproduciéndose.' };
    }

    resume(guildId) {
        const player = this.players.get(guildId);
        if (player && this.paused.get(guildId)) {
            player.unpause();
            this.paused.set(guildId, false);
            return { success: true, message: 'Música reanudada.' };
        }
        return { success: false, message: 'La música no está pausada.' };
    }

    // Otros métodos (mantener igual pero mejorados)
    showQueue(guildId) {
        const queue = this.queues.get(guildId);
        const nowPlaying = this.nowPlaying.get(guildId);

        if (!queue || queue.length === 0) {
            return { success: false, message: 'La cola está vacía.' };
        }

        return {
            success: true,
            nowPlaying: nowPlaying,
            queue: queue.slice(0, 10),
            totalDuration: queue.reduce((total, song) => total + song.duration, 0)
        };
    }

    clearQueue(guildId) {
        this.queues.set(guildId, []);
        return { success: true, message: 'Cola limpiada.' };
    }

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
        this.paused.delete(guildId);

        return { success: true, message: 'Desconectado del canal de voz.' };
    }

    // Crear embed mejorado
    createSongEmbed(song, type = 'nowPlaying') {
        const embed = new EmbedBuilder()
            .setColor(type === 'nowPlaying' ? '#FF0000' : '#00FF00')
            .setThumbnail(song.spotifyInfo?.cover || song.thumbnail)
            .addFields(
                { 
                    name: '🎵 Título', 
                    value: song.spotifyInfo?.title || song.title, 
                    inline: true 
                },
                { 
                    name: '👨‍🎤 Artista', 
                    value: song.spotifyInfo?.artist || song.artist, 
                    inline: true 
                },
                { 
                    name: '⏱️ Duración', 
                    value: this.formatDuration(song.duration), 
                    inline: true 
                },
                { 
                    name: '📱 Solicitado por', 
                    value: song.requestedBy.displayName, 
                    inline: true 
                },
                { 
                    name: '🔗 Fuente', 
                    value: song.spotifyInfo ? 'Spotify → YouTube' : 'YouTube', 
                    inline: true 
                },
                { 
                    name: '👀 Reproducciones', 
                    value: song.views ? this.formatNumber(song.views) : 'N/A', 
                    inline: true 
                }
            );

        if (type === 'nowPlaying') {
            embed.setTitle('🎶 Reproduciendo ahora');
        } else if (type === 'added') {
            embed.setTitle('➕ Añadido a la cola');
        }

        return embed;
    }

    // Crear botones de control
    createControlButtons() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_pause')
                    .setLabel('⏸️ Pausar')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setLabel('⏭️ Saltar')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setLabel('⏹️ Parar')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('music_queue')
                    .setLabel('📋 Cola')
                    .setStyle(ButtonStyle.Success)
            );
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    // Comandos mejorados
    async handlePlay(message, args) {  
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF6B35')
                .setTitle('❌ Error')
                .setDescription('**Uso:** `>play <canción/URL>`')
                .addFields(
                    { 
                        name: 'Ejemplos:', 
                        value: '`>play despacito`\n`>play https://youtu.be/...`\n`>play https://open.spotify.com/track/...`' 
                    }
                );
            return message.reply({ embeds: [embed] });
        }
    
        const loadingEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🔍 Buscando...')
            .setDescription(`Buscando: **${args.join(' ')}**`);
        
        const loadingMsg = await message.reply({ embeds: [loadingEmbed] });
    
        const query = message.content.slice(6).trim(); // Después de ">play "
        console.log(`🎵 Reproducir: ${query} | Usuario: ${message.author.tag}`);
        
        try {
            // Unirse al canal de voz
            const joinResult = await this.joinVoice(message);
            if (!joinResult.success) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Error')
                    .setDescription(joinResult.message);
                return loadingMsg.edit({ embeds: [errorEmbed] });
            }
            
            // Añadir a la cola
            const queueResult = await this.addToQueue(message, query);
            if (!queueResult.success) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Error')
                    .setDescription(queueResult.message);
                return loadingMsg.edit({ embeds: [errorEmbed] });
            }
            
            // Si es la primera canción, reproducir
            const queue = this.queues.get(message.guild.id);
            const isFirst = queue.length === 1;
            
            if (isFirst) {
                const playResult = await this.play(message.guild.id);
                if (playResult.success) {
                    const embed = this.createSongEmbed(playResult.song, 'nowPlaying');
                    const buttons = this.createControlButtons();
                    await loadingMsg.edit({ embeds: [embed], components: [buttons] });
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
            console.error('❌ Error en handlePlay:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error')
                .setDescription(`Error procesando la canción: ${error.message}`);
            await loadingMsg.edit({ embeds: [errorEmbed] });
        }
    }

    // Manejar botones (nuevo)
    async handleButtonInteraction(interaction) {
        const { customId, guildId } = interaction;

        switch (customId) {
            case 'music_pause':
                const pauseResult = this.paused.get(guildId) ? 
                    this.resume(guildId) : this.pause(guildId);
                await interaction.reply({ 
                    content: pauseResult.message, 
                    ephemeral: true 
                });
                break;

            case 'music_skip':
                const skipResult = this.skip(guildId);
                await interaction.reply({ 
                    content: skipResult.message, 
                    ephemeral: true 
                });
                break;

            case 'music_stop':
                const stopResult = this.disconnect(guildId);
                await interaction.reply({ 
                    content: stopResult.message, 
                    ephemeral: true 
                });
                break;

            case 'music_queue':
                const queueResult = this.showQueue(guildId);
                if (queueResult.success) {
                    const embed = new EmbedBuilder()
                        .setColor('#1DB954')
                        .setTitle('📋 Cola de reproducción')
                        .setTimestamp();
                    
                    if (queueResult.nowPlaying) {
                        embed.addFields({
                            name: '🎶 Reproduciendo ahora',
                            value: `**${queueResult.nowPlaying.title}**`,
                            inline: false
                        });
                    }
                    
                    if (queueResult.queue.length > 0) {
                        const queueList = queueResult.queue.map((song, index) => 
                            `${index + 1}. **${song.title}** - ${this.formatDuration(song.duration)}`
                        ).join('\n');
                        
                        embed.addFields({
                            name: '⏳ Siguiente(s)',
                            value: queueList.length > 1024 ? queueList.substring(0, 1021) + '...' : queueList,
                            inline: false
                        });
                        
                        embed.setFooter({
                            text: `${queueResult.queue.length} canción(es) | ${this.formatDuration(queueResult.totalDuration)} total`
                        });
                    }
                    
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } else {
                    await interaction.reply({ 
                        content: queueResult.message, 
                        ephemeral: true 
                    });
                }
                break;
        }
    }

    // Resto de comandos (búsqueda alternativa)
    async handleSearch(message, args) {
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF6B35')
                .setTitle('❌ Error')
                .setDescription('**Uso:** `>search <término>`');
            return message.reply({ embeds: [embed] });
        }

        const query = message.content.slice(8).trim();
        const results = await this.searchYouTube(query, 5);
        
        if (results.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Sin resultados')
                .setDescription('No se encontraron resultados.');
            return message.reply({ embeds: [errorEmbed] });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🔍 Resultados de YouTube')
            .setDescription(`Resultados para: **${query}**`);
        
        results.forEach((track, index) => {
            embed.addFields({
                name: `${index + 1}. ${track.title}`,
                value: `👨‍🎤 **Canal:** ${track.artist}\n⏱️ **Duración:** ${this.formatDuration(track.duration)}\n👀 **Vistas:** ${this.formatNumber(track.views)}`,
                inline: true
            });
        });
        
        embed.setFooter({ text: 'Usa >play <número> o >play <nombre>' });
        
        message.reply({ embeds: [embed] });
    }

    // Procesar comandos
    async processCommand(message) {
        if (message.author.bot) return;

        const args = message.content.trim().split(/ +/);
        const command = args[0].toLowerCase();

        try {
            switch (command) {
                case '>play':
                case '>p':
                    await this.handlePlay(message, args.slice(1));
                    break;
                
                case '>skip':
                case '>s':
                    const result = this.skip(message.guild.id);
                    const embed = new EmbedBuilder()
                        .setColor(result.success ? '#FFA500' : '#FF0000')
                        .setDescription(result.message);
                    message.reply({ embeds: [embed] });
                    break;
                
                case '>search':
                    await this.handleSearch(message, args.slice(1));
                    break;
                
                // ... otros comandos similares
                
                default:
                    break;
            }
        } catch (error) {
            console.error('❌ Error procesando comando:', error);
            await message.reply('❌ Ocurrió un error al procesar el comando.');
        }
    }
}

module.exports = ModernMusicHandler;