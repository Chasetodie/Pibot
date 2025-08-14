const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const play = require('play-dl');
const ytpl = require('ytpl');
const axios = require('axios');

class MusicHandler {
    constructor() {
        // Configuración del bot
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates,
            ]
        });

        // Datos de música por servidor
        this.serverData = new Map();
        
        // Caches
        this.cache = new Map();
        this.searchCache = new Map();
        
        // User agents rotativos
        this.userAgents = [
            'Mozilla/5.0 (Android 12; Mobile; rv:102.0) Gecko/102.0 Firefox/102.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        ];
        this.currentUserAgentIndex = 0;

        this.setupEventHandlers();
    }

    // Inicializar bot
    async start(token) {
        try {
            await this.client.login(token);
            console.log(`🎵 Bot RiMusic-Style iniciado como ${this.client.user.tag}`);
            
            // Limpiar cache cada 30 minutos
            setInterval(() => this.cleanCache(), 30 * 60 * 1000);
            
        } catch (error) {
            console.error('❌ Error iniciando el bot:', error);
        }
    }

    // Configurar eventos del bot
    setupEventHandlers() {
        this.client.once('ready', () => {
            console.log(`🎵 Bot conectado - Servidores: ${this.client.guilds.cache.size}`);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const prefix = '>';
            if (!message.content.startsWith(prefix)) return;

            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            await this.processCommand(message, command, args);
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;
            await this.handleButtonInteraction(interaction);
        });

        this.client.on('voiceStateUpdate', (oldState, newState) => {
            // Auto-desconectar si el bot se queda solo
            if (oldState.channelId && !newState.channelId) {
                const channel = oldState.channel;
                if (channel && channel.members.size === 1 && channel.members.has(this.client.user.id)) {
                    const serverMusic = this.getServerData(oldState.guild.id);
                    setTimeout(() => {
                        if (serverMusic.connection) {
                            this.cleanup(serverMusic);
                            console.log(`🚪 Auto-desconectado de ${oldState.guild.name} (canal vacío)`);
                        }
                    }, 30000); // 30 segundos de gracia
                }
            }
        });
    }

    // Datos del servidor
    getServerData(guildId) {
        if (!this.serverData.has(guildId)) {
            this.serverData.set(guildId, {
                guildId,
                connection: null,
                player: null,
                queue: [],
                currentTrack: null,
                isPlaying: false,
                isPaused: false,
                volume: 50,
                radioMode: false,
                searchResults: [],
                textChannel: null,
                playlists: new Map()
            });
        }
        return this.serverData.get(guildId);
    }

    // User Agent rotativo
    getRandomUserAgent() {
        const agent = this.userAgents[this.currentUserAgentIndex];
        this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
        return agent;
    }

    // Formatear duración en segundos a MM:SS
    formatDuration(seconds) {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // FUNCIONES DE BÚSQUEDA (como RiMusic)
    async searchMusic(query, limit = 10, useCache = true) {
        try {
            const cacheKey = `search_${query}_${limit}`;
            if (useCache && this.searchCache.has(cacheKey)) {
                const cached = this.searchCache.get(cacheKey);
                if (Date.now() - cached.timestamp < 300000) {
                    return cached.results;
                }
            }

            console.log(`🔍 Buscando: "${query}"`);
            console.log('📡 Haciendo request a YouTube Music API...');

            // Intentar YouTube Music primero
            console.log('🎵 Intentando YouTube Music...');
            let results = await this.searchYouTubeMusic(query, limit);
            console.log(`🎵 YouTube Music devolvió: ${results.length} resultados`);            

            // Fallback a YouTube regular
            if (results.length === 0) {
                results = await this.searchYouTube(query, limit);
            }

            // Cache
            if (useCache) {
                this.searchCache.set(cacheKey, {
                    results,
                    timestamp: Date.now()
                });
            }

            return results;

        } catch (error) {
            console.error('❌ Error en búsqueda:', error.message);
            try {
                return await this.searchYouTube(query, limit);
            } catch (fallbackError) {
                console.error('❌ Error en fallback:', fallbackError.message);
                return [];
            }
        }
    }

    async searchYouTubeMusic(query, limit = 10) {
        try {
            const payload = {
                context: {
                    client: {
                        clientName: 'WEB_REMIX',
                        clientVersion: '1.20230724.00.00',
                        hl: 'es',
                        gl: 'ES'
                    }
                },
                query: query,
                params: 'Eg-KAQwIARAAGAAgACgAMABqChAEEAUQAxAKEAk%3D'
            };

            const response = await axios.post(
                'https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30',
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': this.getRandomUserAgent(),
                        'Accept': 'application/json',
                        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                        'Origin': 'https://music.youtube.com',
                        'Referer': 'https://music.youtube.com/search'
                    },
                    timeout: 10000
                }
            );

            console.log('📋 Parseando respuesta de YouTube Music...');
            const parsedResults = this.parseYouTubeMusicResponse(response.data, limit);
            console.log(`📋 Parsed results: ${parsedResults.length}`);
            return parsedResults;
        } catch (error) {
            console.error('❌ Error YouTube Music:', error.message);
            return [];
        }
    }

    parseYouTubeMusicResponse(data, limit) {
        const results = [];
        console.log('🔍 Datos recibidos:', data?.contents ? 'Contenido encontrado' : 'Sin contenido');

        try {
            const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
            
            if (!contents) return results;

            for (const section of contents) {
                if (results.length >= limit) break;

                const items = section?.musicShelfRenderer?.contents || [];
                
                for (const item of items) {
                    if (results.length >= limit) break;

                    const musicItem = item?.musicResponsiveListItemRenderer;
                    if (!musicItem) continue;

                    const videoId = musicItem.playNavigationEndpoint?.videoPlaybackEndpoint?.videoId;
                    if (!videoId) continue;

                    const flexColumns = musicItem.flexColumns || [];
                    const title = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
                    const artistColumn = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
                    
                    let artist = 'Artista desconocido';
                    if (artistColumn && artistColumn.length > 0) {
                        artist = artistColumn[0].text;
                    }

                    const duration = musicItem.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.simpleText;
                    const thumbnail = musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url ||
                                    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

                    results.push({
                        id: videoId,
                        title: title || 'Título desconocido',
                        artist: artist,
                        duration: duration,
                        url: `https://www.youtube.com/watch?v=${videoId}`,
                        thumbnail: thumbnail,
                        type: 'youtube-music',
                        source: 'YouTube Music'
                    });
                }
            }

        } catch (error) {
            console.error('❌ Error parseando YouTube Music:', error.message);
        }

        return results;
    }

    async searchYouTube(query, limit = 10) {
        try {
            console.log(`🔍 Buscando en YouTube: "${query}"`);
            
            // Usar play-dl que es más confiable
            const results = await play.search(query, {
                limit: limit,
                source: { youtube: 'video' }
            });

            if (!results || results.length === 0) {
                console.log('❌ No se encontraron resultados');
                return [];
            }

            const formattedResults = results.map(item => ({
                id: item.id,
                title: item.title,
                artist: item.channel?.name || 'Canal desconocido',
                duration: item.durationRaw || 'N/A',
                thumbnail: item.thumbnails?.[0]?.url,
                url: item.url,
                type: 'youtube',
                source: 'YouTube',
                views: item.views
            }));

            console.log(`✅ YouTube: ${formattedResults.length} resultados encontrados`);
            return formattedResults;

        } catch (error) {
            console.error('❌ Error en búsqueda de YouTube:', error.message);
            return [];
        }
    }

    async getAudioStream(videoId) {
        try {
            console.log(`🎵 Creando stream para: ${videoId}`);
            
            // Usar play-dl para obtener el stream
            const stream = await play.stream(`https://www.youtube.com/watch?v=${videoId}`, {
                quality: 2, // Alta calidad
            });

            return createAudioResource(stream.stream, {
                inputType: stream.type,
                inlineVolume: true
            });

        } catch (error) {
            console.error(`❌ Error creando stream para ${videoId}:`, error.message);
            
            // Fallback a ytdl si play-dl falla
            try {
                const url = `https://www.youtube.com/watch?v=${videoId}`;
                const ytdlStream = ytdl(url, {
                    filter: 'audioonly',
                    quality: 'highestaudio',
                    highWaterMark: 1 << 25,
                    requestOptions: {
                        headers: {
                            'User-Agent': this.getRandomUserAgent(),
                        }
                    }
                });

                return createAudioResource(ytdlStream, {
                    inputType: StreamType.Arbitrary,
                    inlineVolume: true
                });
            } catch (fallbackError) {
                console.error('❌ Fallback también falló:', fallbackError.message);
                throw error;
            }
        }
    }

    async getRelatedTracks(videoId, limit = 20) {
        try {
            const info = await ytdl.getBasicInfo(`https://www.youtube.com/watch?v=${videoId}`);
            const title = info.videoDetails.title;
            const artist = info.videoDetails.author.name;

            const searchTerms = [
                `${artist}`,
                `${title.split(' ').slice(0, 3).join(' ')}`,
                `${artist} ${title.split(' ')[0]}`
            ];

            const relatedTracks = [];
            
            for (const term of searchTerms) {
                if (relatedTracks.length >= limit) break;
                
                const results = await this.searchMusic(term, Math.ceil(limit / searchTerms.length), false);
                const filtered = results.filter(track => 
                    track.id !== videoId && 
                    !relatedTracks.some(existing => existing.id === track.id)
                );
                
                relatedTracks.push(...filtered);
            }

            return relatedTracks.slice(0, limit);

        } catch (error) {
            console.error(`❌ Error tracks relacionados:`, error.message);
            return [];
        }
    }

    // COMANDOS DEL BOT
    async processCommand(message, command, args) {
        const serverMusic = this.getServerData(message.guild.id);
        serverMusic.textChannel = message.channel;

        switch (command) {
            case 'search':
            case 's':
                await this.handleSearch(message, args, serverMusic);
                break;
            case 'play':
            case 'p':
                await this.handlePlay(message, args, serverMusic);
                break;
            case 'skip':
            case 'next':
                await this.handleSkip(message, serverMusic);
                break;
            case 'stop':
                await this.handleStop(message, serverMusic);
                break;
            case 'pause':
                await this.handlePause(message, serverMusic);
                break;
            case 'resume':
                await this.handleResume(message, serverMusic);
                break;
            case 'queue':
            case 'q':
                await this.handleQueue(message, serverMusic);
                break;
            case 'radio':
                await this.handleRadio(message, serverMusic);
                break;
            case 'volume':
            case 'vol':
                await this.handleVolume(message, args, serverMusic);
                break;
            case 'current':
            case 'np':
                await this.handleNowPlaying(message, serverMusic);
                break;
            case 'clear':
                await this.handleClear(message, serverMusic);
                break;
            case 'leave':
                await this.handleLeave(message, serverMusic);
                break;
            case 'help':
                await this.handleHelp(message);
                break;
        }
    }

    async handleSearch(message, args, serverMusic) {
        if (!args.length) {
            return message.reply('❌ Uso: `!search nombre de canción`');
        }

        const query = args.join(' ');
        const loadingMsg = await message.reply('🔍 Buscando música...');

        try {
            const results = await this.searchMusic(query, 5);
            
            if (results.length === 0) {
                return loadingMsg.edit('❌ No se encontraron resultados.');
            }

            serverMusic.searchResults = results;

            const embed = new EmbedBuilder()
                .setTitle('🎵 Resultados de búsqueda')
                .setColor('#FF0000')
                .setDescription(`**"${query}"**\nUsa \`!play <número>\` para reproducir`)
                .setFooter({ text: `${results.length} resultados` });

            results.forEach((track, index) => {
                embed.addFields({
                    name: `${index + 1}. ${track.title}`,
                    value: `👤 **${track.artist}**\n⏱️ ${track.duration || 'N/A'} | 📱 ${track.source}`,
                    inline: false
                });
            });

            await loadingMsg.edit({ content: '', embeds: [embed] });

        } catch (error) {
            console.error('Error búsqueda:', error);
            await loadingMsg.edit('❌ Error en la búsqueda.');
        }
    }

    async handlePlay(message, args, serverMusic) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ Únete a un canal de voz primero.');
        }

        let trackToPlay;

        if (args.length === 1 && !isNaN(args[0])) {
            const index = parseInt(args[0]) - 1;
            if (index < 0 || index >= serverMusic.searchResults.length) {
                return message.reply('❌ Número inválido. Haz una búsqueda con `!search`');
            }
            trackToPlay = serverMusic.searchResults[index];
        } else if (args.length > 0) {
            const query = args.join(' ');
            const searchMsg = await message.reply('🔍 Buscando...');
            
            const results = await this.searchMusic(query, 1);
            if (results.length === 0) {
                return searchMsg.edit('❌ No se encontró la canción.');
            }
            trackToPlay = results[0];
            await searchMsg.delete();
        } else {
            return message.reply('❌ Uso: `!play canción` o `!play número`');
        }

        try {
            await this.setupVoiceConnection(voiceChannel, serverMusic);

            if (serverMusic.isPlaying) {
                serverMusic.queue.push(trackToPlay);
                
                const embed = new EmbedBuilder()
                    .setTitle('✅ Agregado a la cola')
                    .setDescription(`**${trackToPlay.title}**\n👤 ${trackToPlay.artist}`)
                    .setColor('#00FF00')
                    .setThumbnail(trackToPlay.thumbnail)
                    .addFields({ name: '📍 Posición', value: `${serverMusic.queue.length}`, inline: true });

                return message.reply({ embeds: [embed] });
            }

            await this.playTrack(trackToPlay, serverMusic);

            const embed = new EmbedBuilder()
                .setTitle('🎵 Reproduciendo ahora')
                .setDescription(`**${trackToPlay.title}**\n👤 ${trackToPlay.artist}`)
                .setColor('#00FF00')
                .setThumbnail(trackToPlay.thumbnail)
                .addFields(
                    { name: '📱 Fuente', value: trackToPlay.source, inline: true },
                    { name: '⏱️ Duración', value: trackToPlay.duration || 'N/A', inline: true },
                    { name: '🎧 Calidad', value: 'Alta', inline: true }
                )
                .setFooter({ text: `Solicitado por ${message.author.username}` });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('play_pause')
                        .setLabel('⏯️')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('skip')
                        .setLabel('⏭️')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('stop')
                        .setLabel('⏹️')
                        .setStyle(ButtonStyle.Danger)
                );

            message.reply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Error play:', error);
            message.reply('❌ Error al reproducir.');
        }
    }

    async setupVoiceConnection(voiceChannel, serverMusic) {
        if (!serverMusic.connection) {
            serverMusic.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            serverMusic.connection.on(VoiceConnectionStatus.Disconnected, () => {
                this.cleanup(serverMusic);
            });
        }

        if (!serverMusic.player) {
            serverMusic.player = createAudioPlayer();
            serverMusic.connection.subscribe(serverMusic.player);

            serverMusic.player.on(AudioPlayerStatus.Idle, () => {
                this.playNext(serverMusic);
            });

            serverMusic.player.on('error', (error) => {
                console.error('Player error:', error);
                this.playNext(serverMusic);
            });
        }
    }

    async playTrack(track, serverMusic) {
        const resource = await this.getAudioStream(track.id);
        resource.volume?.setVolume(serverMusic.volume / 100);
        
        serverMusic.player.play(resource);
        serverMusic.currentTrack = track;
        serverMusic.isPlaying = true;
        serverMusic.isPaused = false;

        console.log(`🎵 Playing: ${track.title}`);
    }

    async playNext(serverMusic) {
        let nextTrack = serverMusic.queue.shift();

        if (!nextTrack && serverMusic.radioMode && serverMusic.currentTrack) {
            const suggestions = await this.getRelatedTracks(serverMusic.currentTrack.id, 5);
            if (suggestions.length > 0) {
                nextTrack = suggestions[Math.floor(Math.random() * suggestions.length)];
                
                if (serverMusic.textChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('📻 Radio automática')
                        .setDescription(`**${nextTrack.title}**\n👤 ${nextTrack.artist}`)
                        .setColor('#FF6600')
                        .setThumbnail(nextTrack.thumbnail);
                    
                    serverMusic.textChannel.send({ embeds: [embed] });
                }
            }
        }

        if (nextTrack) {
            try {
                await this.playTrack(nextTrack, serverMusic);
            } catch (error) {
                console.error('Error next track:', error);
                this.playNext(serverMusic);
            }
        } else {
            serverMusic.isPlaying = false;
            serverMusic.currentTrack = null;
            
            if (serverMusic.textChannel) {
                serverMusic.textChannel.send('🎵 Cola terminada.');
            }
        }
    }

    async handleSkip(message, serverMusic) {
        if (!serverMusic.isPlaying) {
            return message.reply('❌ No hay música reproduciéndose.');
        }
        
        serverMusic.player.stop();
        message.reply('⏭️ Canción saltada.');
    }

    async handleStop(message, serverMusic) {
        if (!serverMusic.isPlaying) {
            return message.reply('❌ No hay música reproduciéndose.');
        }
        
        serverMusic.queue = [];
        serverMusic.player.stop();
        serverMusic.isPlaying = false;
        message.reply('⏹️ Música detenida y cola limpiada.');
    }

    async handlePause(message, serverMusic) {
        if (!serverMusic.isPlaying || serverMusic.isPaused) {
            return message.reply('❌ No hay música reproduciéndose o ya está pausada.');
        }
        
        serverMusic.player.pause();
        serverMusic.isPaused = true;
        message.reply('⏸️ Música pausada.');
    }

    async handleResume(message, serverMusic) {
        if (!serverMusic.isPaused) {
            return message.reply('❌ La música no está pausada.');
        }
        
        serverMusic.player.unpause();
        serverMusic.isPaused = false;
        message.reply('▶️ Música reanudada.');
    }

    async handleQueue(message, serverMusic) {
        if (!serverMusic.currentTrack && serverMusic.queue.length === 0) {
            return message.reply('❌ La cola está vacía.');
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Cola de reproducción')
            .setColor('#0099ff');

        if (serverMusic.currentTrack) {
            embed.addFields({
                name: '🎵 Reproduciendo ahora',
                value: `**${serverMusic.currentTrack.title}**\n👤 ${serverMusic.currentTrack.artist}`,
                inline: false
            });
        }

        if (serverMusic.queue.length > 0) {
            const queueList = serverMusic.queue.slice(0, 10).map((track, index) => 
                `${index + 1}. **${track.title}** - ${track.artist}`
            ).join('\n');

            embed.addFields({
                name: `📋 Próximas (${serverMusic.queue.length})`,
                value: queueList + (serverMusic.queue.length > 10 ? `\n... y ${serverMusic.queue.length - 10} más` : ''),
                inline: false
            });
        }

        if (serverMusic.radioMode) {
            embed.setFooter({ text: '📻 Modo radio activado' });
        }

        message.reply({ embeds: [embed] });
    }

    async handleRadio(message, serverMusic) {
        serverMusic.radioMode = !serverMusic.radioMode;
        
        const status = serverMusic.radioMode ? 'activado' : 'desactivado';
        const emoji = serverMusic.radioMode ? '📻' : '❌';
        
        message.reply(`${emoji} Modo radio ${status}`);
    }

    async handleVolume(message, args, serverMusic) {
        if (!args.length) {
            return message.reply(`🔊 Volumen actual: ${serverMusic.volume}%`);
        }

        const volume = parseInt(args[0]);
        if (isNaN(volume) || volume < 0 || volume > 100) {
            return message.reply('❌ El volumen debe ser un número entre 0 y 100.');
        }

        serverMusic.volume = volume;
        
        if (serverMusic.player && serverMusic.player.state.resource) {
            serverMusic.player.state.resource.volume?.setVolume(volume / 100);
        }

        message.reply(`🔊 Volumen ajustado a ${volume}%`);
    }

    async handleNowPlaying(message, serverMusic) {
        if (!serverMusic.currentTrack) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        const track = serverMusic.currentTrack;
        const embed = new EmbedBuilder()
            .setTitle('🎵 Reproduciendo ahora')
            .setDescription(`**${track.title}**\n👤 ${track.artist}`)
            .setColor('#00FF00')
            .setThumbnail(track.thumbnail)
            .addFields(
                { name: '📱 Fuente', value: track.source, inline: true },
                { name: '⏱️ Duración', value: track.duration || 'N/A', inline: true },
                { name: '🔊 Volumen', value: `${serverMusic.volume}%`, inline: true }
            );

        if (serverMusic.radioMode) {
            embed.setFooter({ text: '📻 Modo radio activado' });
        }

        message.reply({ embeds: [embed] });
    }

    async handleClear(message, serverMusic) {
        serverMusic.queue = [];
        message.reply('🗑️ Cola limpiada.');
    }

    async handleLeave(message, serverMusic) {
        this.cleanup(serverMusic);
        message.reply('👋 Desconectado.');
    }

    async handleHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('🎵 Comandos del Bot RiMusic-Style')
            .setColor('#FF0000')
            .setDescription('Comandos disponibles:')
            .addFields(
                { name: '🔍 Búsqueda', value: '`!search <canción>` - Buscar música\n`!play <canción/número>` - Reproducir', inline: false },
                { name: '⏯️ Control', value: '`!pause` - Pausar\n`!resume` - Reanudar\n`!skip` - Saltar\n`!stop` - Detener', inline: false },
                { name: '📋 Cola', value: '`!queue` - Ver cola\n`!clear` - Limpiar cola\n`!radio` - Modo radio', inline: false },
                { name: '🔧 Configuración', value: '`!volume <0-100>` - Ajustar volumen\n`!current` - Canción actual\n`!leave` - Desconectar', inline: false }
            )
            .setFooter({ text: 'Prefijo: ! | Ejemplo: !play despacito' });

        message.reply({ embeds: [embed] });
    }

    async handleButtonInteraction(interaction) {
        const serverMusic = this.getServerData(interaction.guild.id);
        
        switch (interaction.customId) {
            case 'play_pause':
                if (serverMusic.isPlaying && !serverMusic.isPaused) {
                    serverMusic.player.pause();
                    serverMusic.isPaused = true;
                    await interaction.reply({ content: '⏸️ Pausado', ephemeral: true });
                } else if (serverMusic.isPaused) {
                    serverMusic.player.unpause();
                    serverMusic.isPaused = false;
                    await interaction.reply({ content: '▶️ Reanudado', ephemeral: true });
                }
                break;
            case 'skip':
                if (serverMusic.player) {
                    serverMusic.player.stop();
                    await interaction.reply({ content: '⏭️ Saltado', ephemeral: true });
                }
                break;
            case 'stop':
                serverMusic.queue = [];
                if (serverMusic.player) {
                    serverMusic.player.stop();
                }
                await interaction.reply({ content: '⏹️ Detenido', ephemeral: true });
                break;
        }
    }

    cleanup(serverMusic) {
        if (serverMusic.connection) {
            serverMusic.connection.destroy();
        }
        if (serverMusic.player) {
            serverMusic.player.stop();
        }
        
        serverMusic.connection = null;
        serverMusic.player = null;
        serverMusic.isPlaying = false;
        serverMusic.currentTrack = null;
        serverMusic.queue = [];
    }

    cleanCache() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000;

        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > maxAge) {
                this.cache.delete(key);
            }
        }

        for (const [key, value] of this.searchCache.entries()) {
            if (now - value.timestamp > maxAge) {
                this.searchCache.delete(key);
            }
        }

        console.log(`🧹 Cache limpiado. Entradas restantes: ${this.cache.size + this.searchCache.size}`);
    }

    // Estadísticas del bot
    getStats() {
        return {
            servers: this.client.guilds.cache.size,
            activeConnections: Array.from(this.serverData.values()).filter(s => s.connection).length,
            cacheSize: this.cache.size,
            searchCacheSize: this.searchCache.size,
            totalTracks: Array.from(this.serverData.values()).reduce((acc, s) => acc + s.queue.length, 0)
        };
    }

    // Funciones adicionales similares a RiMusic
    
    // Obtener letras de una canción
    async getLyrics(query) {
        try {
            // Implementación básica de búsqueda de letras
            // En una implementación real podrías usar APIs como Genius o Musixmatch
            const response = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(query)}`);
            return response.data.lyrics || 'Letras no encontradas';
        } catch (error) {
            console.error('Error obteniendo letras:', error);
            return 'Letras no disponibles';
        }
    }

    // Obtener playlists trending (simulado)
    async getTrendingPlaylists() {
        const trendingQueries = [
            'top hits 2024',
            'música latina trending',
            'pop internacional',
            'reggaeton nuevo',
            'rock alternativo'
        ];

        const playlists = [];
        for (const query of trendingQueries) {
            try {
                const results = await this.searchMusic(query, 10, false);
                if (results.length > 0) {
                    playlists.push({
                        name: query,
                        tracks: results,
                        thumbnail: results[0]?.thumbnail
                    });
                }
            } catch (error) {
                console.error(`Error obteniendo playlist ${query}:`, error);
            }
        }

        return playlists;
    }

    // Crear playlist personalizada
    createCustomPlaylist(guildId, name, userId) {
        const serverMusic = this.getServerData(guildId);
        const playlistId = Date.now().toString();
        
        const playlist = {
            id: playlistId,
            name: name,
            creator: userId,
            tracks: [],
            created: new Date(),
            thumbnail: null
        };

        serverMusic.playlists.set(playlistId, playlist);
        return playlist;
    }

    // Agregar canción a playlist
    addToPlaylist(guildId, playlistId, track) {
        const serverMusic = this.getServerData(guildId);
        const playlist = serverMusic.playlists.get(playlistId);
        
        if (!playlist) return false;
        
        playlist.tracks.push(track);
        if (!playlist.thumbnail && track.thumbnail) {
            playlist.thumbnail = track.thumbnail;
        }
        
        return true;
    }

    // Obtener información de una playlist
    getPlaylistInfo(guildId, playlistId) {
        const serverMusic = this.getServerData(guildId);
        return serverMusic.playlists.get(playlistId);
    }

    // Comandos adicionales de playlist
    async handlePlaylistCommand(message, args, serverMusic) {
        const subcommand = args[0];
        
        switch (subcommand) {
            case 'create':
                if (args.length < 2) {
                    return message.reply('❌ Uso: `!playlist create <nombre>`');
                }
                
                const playlistName = args.slice(1).join(' ');
                const playlist = this.createCustomPlaylist(message.guild.id, playlistName, message.author.id);
                
                const embed = new EmbedBuilder()
                    .setTitle('✅ Playlist creada')
                    .setDescription(`**${playlist.name}**\nID: \`${playlist.id}\``)
                    .setColor('#00FF00')
                    .addFields({ name: '👤 Creador', value: message.author.username, inline: true });
                
                message.reply({ embeds: [embed] });
                break;
                
            case 'add':
                if (args.length < 2) {
                    return message.reply('❌ Uso: `!playlist add <playlist_id>`');
                }
                
                if (!serverMusic.currentTrack) {
                    return message.reply('❌ No hay canción reproduciéndose para agregar.');
                }
                
                const playlistId = args[1];
                const success = this.addToPlaylist(message.guild.id, playlistId, serverMusic.currentTrack);
                
                if (success) {
                    message.reply(`✅ **${serverMusic.currentTrack.title}** agregada a la playlist.`);
                } else {
                    message.reply('❌ Playlist no encontrada.');
                }
                break;
                
            case 'list':
                const playlists = Array.from(serverMusic.playlists.values());
                if (playlists.length === 0) {
                    return message.reply('❌ No hay playlists creadas.');
                }
                
                const listEmbed = new EmbedBuilder()
                    .setTitle('📋 Playlists del servidor')
                    .setColor('#0099ff');
                
                playlists.forEach(pl => {
                    listEmbed.addFields({
                        name: pl.name,
                        value: `ID: \`${pl.id}\`\n🎵 ${pl.tracks.length} canciones`,
                        inline: true
                    });
                });
                
                message.reply({ embeds: [listEmbed] });
                break;
                
            case 'play':
                if (args.length < 2) {
                    return message.reply('❌ Uso: `!playlist play <playlist_id>`');
                }
                
                const targetPlaylist = this.getPlaylistInfo(message.guild.id, args[1]);
                if (!targetPlaylist) {
                    return message.reply('❌ Playlist no encontrada.');
                }
                
                if (targetPlaylist.tracks.length === 0) {
                    return message.reply('❌ La playlist está vacía.');
                }
                
                // Agregar todas las canciones a la cola
                serverMusic.queue.push(...targetPlaylist.tracks);
                
                message.reply(`✅ **${targetPlaylist.name}** agregada a la cola (${targetPlaylist.tracks.length} canciones)`);
                
                // Si no hay música reproduciéndose, empezar
                if (!serverMusic.isPlaying && message.member.voice.channel) {
                    await this.setupVoiceConnection(message.member.voice.channel, serverMusic);
                    this.playNext(serverMusic);
                }
                break;
                
            default:
                message.reply('❌ Subcomandos: `create`, `add`, `list`, `play`');
        }
    }

    // Función para manejar comando de letras
    async handleLyricsCommand(message, args, serverMusic) {
        let query;
        
        if (args.length > 0) {
            query = args.join(' ');
        } else if (serverMusic.currentTrack) {
            query = `${serverMusic.currentTrack.artist} ${serverMusic.currentTrack.title}`;
        } else {
            return message.reply('❌ Especifica una canción o reproduce una para obtener sus letras.');
        }
        
        const loadingMsg = await message.reply('🔍 Buscando letras...');
        
        try {
            const lyrics = await this.getLyrics(query);
            
            // Dividir letras si son muy largas
            if (lyrics.length > 2000) {
                const chunks = lyrics.match(/.{1,2000}/g) || [];
                
                for (let i = 0; i < Math.min(chunks.length, 3); i++) {
                    const embed = new EmbedBuilder()
                        .setTitle(i === 0 ? `🎤 Letras: ${query}` : `🎤 Letras (continuación ${i + 1})`)
                        .setDescription(chunks[i])
                        .setColor('#FF69B4');
                    
                    if (i === 0) {
                        await loadingMsg.edit({ embeds: [embed] });
                    } else {
                        await message.channel.send({ embeds: [embed] });
                    }
                }
            } else {
                const embed = new EmbedBuilder()
                    .setTitle(`🎤 Letras: ${query}`)
                    .setDescription(lyrics)
                    .setColor('#FF69B4');
                
                await loadingMsg.edit({ embeds: [embed] });
            }
            
        } catch (error) {
            console.error('Error letras:', error);
            await loadingMsg.edit('❌ No se pudieron obtener las letras.');
        }
    }

    // Método para que bot.js pueda procesar comandos
    async processMessage(message) {
        if (message.author.bot) return;
        
        const prefix = '>';
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        await this.processCommand(message, command, args);
    }
}

// Exportar clase para uso
module.exports = MusicHandler;