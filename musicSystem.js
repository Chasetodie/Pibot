const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');

class MusicSystem {
    constructor(client) {
        this.client = client;
        this.kazagumo = null;
        this.playerTimeouts = new Map();
        this.maxSongDuration = 7200000;
        this.playThrottle = new Map();
        this.nodeList = [];
        this.failedNodes = new Set();
        this.initialize(); // ← volver a activar esto
    }

    initialize() {
        const nodes = [
            {
                name: 'Lavalink95',
                url: '160.191.77.60:7555',
                auth: process.env.LAVAPASS,
                secure: false
            }
        ];

        this.nodeList = nodes;
        this.failedNodes = new Set();

        this.kazagumo = new Kazagumo(
            {
                defaultSearchEngine: 'ytsearch',
                plugins: [new Plugins.PlayerMoved(this.client)],
                send: (guildId, payload) => {
                    const guild = this.client.guilds.cache.get(guildId);
                    if (guild) guild.shard.send(payload);
                },
            },
            new Connectors.DiscordJS(this.client),
            nodes
        );

        this.client.kazagumo = this.kazagumo;

        // Acceder a shoukaku DESPUÉS de que kazagumo lo inicialice
        this.kazagumo.shoukaku.on('ready', (name) => {
            console.log(`✅ Nodo [${name}] conectado!`);
            this.failedNodes.delete(name);
        });

        this.kazagumo.shoukaku.on('error', (name, error) => {
            console.error(`❌ Error en nodo ${name}: ${error.message}`);
            this.failedNodes.add(name);
        });

/*        this.kazagumo.shoukaku.on('close', (name, code, reason) => {
            console.warn(`⚠️ Nodo ${name} cerrado. Código: ${code}`);
            this.failedNodes.add(name);
        });*/

        this.kazagumo.shoukaku.on('disconnect', async (name, count) => {
            console.warn(`⚠️ Nodo ${name} desconectado. Reconectando en 10 segundos...`);
            this.failedNodes.add(name);
            
            // Evitar múltiples intentos simultáneos
            if (this.reconnecting?.has(name)) return;
            if (!this.reconnecting) this.reconnecting = new Set();
            this.reconnecting.add(name);

            setTimeout(async () => {
                try {
                    const nodeConfig = this.nodeList.find(n => n.name === name);
                    if (nodeConfig) {
                        await this.kazagumo.shoukaku.addNode(nodeConfig);
                        console.log(`✅ Nodo ${name} reconectado!`);
                        this.failedNodes.delete(name);
                    }
                } catch (e) {
                    console.error(`❌ Reconexión fallida para ${name}:`, e.message);
                } finally {
                    this.reconnecting.delete(name);
                }
            }, 10000);
        });

        this.setupEventListeners();
    }

    getBestNode() {
        // Acceder a shoukaku.nodes directamente como Map
        const nodes = this.kazagumo.shoukaku.nodes;
        if (!nodes || nodes.size === 0) return null;

        for (const [name, node] of nodes) {
            // En Shoukaku 4.x el estado conectado es el string 'CONNECTED' o valor 1
            const state = node.state;
            const isConnected = state === 1 || state === 'CONNECTED' || 
                            node.ws?.readyState === 1;
            if (isConnected && !this.failedNodes.has(name)) {
                return name;
            }
        }
        return null;
    }

    async waitForNode(timeoutMs = 10000) {
        // Esperar hasta que haya al menos un nodo conectado
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (this.getBestNode()) return true;
            await new Promise(r => setTimeout(r, 500));
        }
        return false;
    }

    setupEventListeners() {
        this.kazagumo.on('playerStart', (player, track) => {
            const embed = new EmbedBuilder()
                .setTitle('🎵 Reproduciendo Ahora')
                .setDescription(`**${track.title}**\nDuración: ${this.formatTime(track.length)}`)
                .setThumbnail(track.thumbnail || null)
                .setColor('#00FF00')
                .setTimestamp();

            if (player.textId) {
                const channel = this.client.channels.cache.get(player.textId);
                if (channel) channel.send({ embeds: [embed] });
            }
        });

        this.kazagumo.on('playerEmpty', (player) => {
            console.log(`🎵 Cola vacía en ${player.guildId}`);
            
            if (player.textId) {
                const channel = this.client.channels.cache.get(player.textId);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle('✅ Cola Terminada')
                        .setDescription('Se han reproducido todas las canciones.')
                        .setColor('#00FF00')
                        .setFooter({ text: 'El bot se desconectará en 5 minutos si no hay más música.' });
                    channel.send({ embeds: [embed] });
                }
            }

            this.setPlayerTimeout(player.guildId, () => {
                if (player.queue.size === 0 && !player.playing) {
                    player.destroy();
                    const channel = this.client.channels.cache.get(player.textId);
                    if (channel) channel.send('⏹️ Desconectado por inactividad.');
                }
            }, 300000);
        });

        this.kazagumo.on('playerEnd', (player) => {
            console.log(`🎵 Canción terminada en ${player.guildId} | Cola restante: ${player.queue.size}`);
        });

        this.kazagumo.on('playerDestroy', (player) => {
            this.clearPlayerTimeout(player.guildId);
        });

        // AGREGAR ESTO:
        this.kazagumo.on('playerResumed', (player) => {
            console.log(`🔄 Player resumido en ${player.guildId}`);
        });
        
        this.kazagumo.on('playerMoved', (player, oldChannel, newChannel) => {
            console.log(`🔄 Bot movido de canal`);
            player.pause(false); // Forzar resume
        });
    }

    setPlayerTimeout(guildId, callback, delay) {
        this.clearPlayerTimeout(guildId);
        this.playerTimeouts.set(guildId, setTimeout(callback, delay));
    }

    clearPlayerTimeout(guildId) {
        const timeout = this.playerTimeouts.get(guildId);
        if (timeout) {
            clearTimeout(timeout);
            this.playerTimeouts.delete(guildId);
        }
    }

    formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    async processCommand(message) {
        if (message.author.bot) return;

        const args = message.content.split(' ');
        const command = args[0].toLowerCase();

        // Comandos de música
        if (['>', '>m', '>musica', '>music'].includes(command)) {
            if (!args[1]) {
                await this.showMusicHelp(message);
                return;
            }

/*const commandName = command.replace('>', '');
        await this.economy.missions.updateMissionProgress(message.author.id, 'unique_commands_used', commandName);*/

            const subcommand = args[1];
            const { member, channel, guild, author } = message;

            try {
                switch (subcommand) {
                    case 'play':
                    case 'p':
                        await this.playCommand(message, args, member, channel, guild, author);
                        break;
                    
                    case 'stop':
                    case 'leave':
                    case 'disconnect':
                        await this.stopCommand(message, guild);
                        break;
                    
                    case 'skip':
                    case 's':
                        await this.skipCommand(message, args, guild);
                        break;
                    
                    case 'pause':
                        await this.pauseCommand(message, guild);
                        break;
                    
                    case 'resume':
                    case 'unpause':
                        await this.resumeCommand(message, guild);
                        break;
                    
                    case 'queue':
                    case 'q':
                        await this.queueCommand(message, args, guild);
                        break;
                    
                    case 'nowplaying':
                    case 'np':
                        await this.nowPlayingCommand(message, guild);
                        break;

                    case 'ytsearch':
                    case 'ys':
                        await this.searchCommand(message, args, member, channel, guild, author, 'ytsearch');
                        break;
                    case 'spsearch':
                    case 'ss':
                        await this.searchCommand(message, args, member, channel, guild, author, 'spsearch');
                        break;
                    case 'lyrics':
                    case 'letra':
                        await this.lyricsCommand(message, args);
                        break;

                    case 'fix':
                    case 'restart':
                        await this.fixPlayerCommand(message, guild);
                        break;
                    case 'seek':
                    case 'adelantar':
                    case 'forward':
                        await this.seekCommand(message, args, guild);
                        break;
                    
                    case 'volume':
                    case 'vol':
                        await this.volumeCommand(message, args, guild);
                        break;
                    
                    case 'loop':
                    case 'repeat':
                        await this.loopCommand(message, args, guild);
                        break;
                    
                    case 'shuffle':
                        await this.shuffleCommand(message, guild);
                        break;
                    
                    case 'clear':
                        await this.clearQueueCommand(message, guild);
                        break;
                    
                    default:
                        await this.showMusicHelp(message);
                        break;
                }
            } catch (error) {
                console.error('Error en comando de música:', error);
                await message.reply('❌ Ocurrió un error ejecutando el comando de música.');
            }
        }
    }

    // ─── SEARCH COMMAND ───────────────────────────────────────────────────────────
    async searchCommand(message, args, member, channel, guild, author, engine) {
        const query = args.slice(2).join(' ').trim();
        if (!query) {
            const prefix = engine === 'ytsearch' ? 'ytsearch' : 'spsearch';
            return message.reply(`❌ Escribe algo para buscar.\nEjemplo: \`>m ${prefix} la lagartija\``);
        }

        const loadingMsg = await message.reply(`🔍 Buscando **${query}**...`);

        try {
            const result = await this.kazagumo.search(query, { requester: author, engine });

            if (!result || !result.tracks.length) {
                return loadingMsg.edit('❌ No se encontraron resultados.');
            }

            const tracks = result.tracks.slice(0, 7);
            const platform = engine === 'ytsearch' ? '🎬 YouTube' : '🟢 Spotify';

            const embed = new EmbedBuilder()
                .setTitle(`${platform} — Resultados para "${query}"`)
                .setColor(engine === 'ytsearch' ? '#FF0000' : '#1DB954')
                .setDescription(
                    tracks.map((t, i) =>
                        `\`${i + 1}.\` **${t.title}**\n└ ${this.formatTime(t.length)} • ${t.author || 'Desconocido'}`
                    ).join('\n\n')
                )
                .setFooter({ text: 'Selecciona una canción para ver detalles o reproducir' })
                .setTimestamp();

            // Botones de selección — máx 5 por row, así que 2 rows
            const row1 = new ActionRowBuilder().addComponents(
                tracks.slice(0, 4).map((_, i) =>
                    new ButtonBuilder()
                        .setCustomId(`msearch_${i}_${message.author.id}_${guild.id}`)
                        .setLabel(`${i + 1}`)
                        .setStyle(ButtonStyle.Primary)
                )
            );
            const row2 = new ActionRowBuilder().addComponents(
                tracks.slice(4).map((_, i) =>
                    new ButtonBuilder()
                        .setCustomId(`msearch_${i + 4}_${message.author.id}_${guild.id}`)
                        .setLabel(`${i + 5}`)
                        .setStyle(ButtonStyle.Primary)
                )
            );
            row2.components.push(
                new ButtonBuilder()
                    .setCustomId(`msearch_cancel_${message.author.id}`)
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Danger)
            );

            const searchMsg = await loadingMsg.edit({ content: '', embeds: [embed], components: [row1, row2] });

            // Guardar tracks temporalmente para el collector
            if (!this.searchSessions) this.searchSessions = new Map();
            this.searchSessions.set(`${message.author.id}_${guild.id}`, {
                tracks,
                member,
                channel,
                guild,
                author,
                engine,
                message: searchMsg
            });

            // Auto-limpiar sesión después de 60 segundos
            setTimeout(() => {
                if (this.searchSessions?.has(`${message.author.id}_${guild.id}`)) {
                    this.searchSessions.delete(`${message.author.id}_${guild.id}`);
                    searchMsg.edit({ components: [] }).catch(() => {});
                }
            }, 60000);
            
            // Collector de botones — 60 segundos
            const collector = searchMsg.createMessageComponentCollector({
                filter: i => i.user.id === message.author.id,
                time: 60000
            });

            collector.on('collect', async interaction => {
                await interaction.deferUpdate();
                collector.stop();

                const customId = interaction.customId;
                if (customId.includes('cancel')) {
                    return searchMsg.edit({ content: '❌ Búsqueda cancelada.', embeds: [], components: [] });
                }

                const index = parseInt(customId.split('_')[1]);
                const selected = tracks[index];
                const session = this.searchSessions.get(`${message.author.id}_${guild.id}`);
                if (!session) return;

                // Mostrar detalles de la canción con botón Reproducir
                const detailEmbed = new EmbedBuilder()
                    .setTitle('🎵 Detalles de la Canción')
                    .setColor('#9932CC')
                    .setThumbnail(selected.thumbnail || null)
                    .addFields(
                        { name: '🎵 Título', value: selected.title, inline: false },
                        { name: '👤 Artista', value: selected.author || 'Desconocido', inline: true },
                        { name: '⏱️ Duración', value: this.formatTime(selected.length), inline: true },
                        { name: '📡 Plataforma', value: engine === 'ytsearch' ? 'YouTube' : 'Spotify', inline: true },
                        { name: '🔗 URL', value: selected.uri || 'No disponible', inline: false }
                    )
                    .setTimestamp();

                const playRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`mplay_${index}_${message.author.id}_${guild.id}`)
                        .setLabel('▶️ Reproducir')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`mback_${message.author.id}_${guild.id}`)
                        .setLabel('⬅️ Volver')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`msearch_cancel_${message.author.id}`)
                        .setLabel('❌ Cerrar')
                        .setStyle(ButtonStyle.Danger)
                );

                await searchMsg.edit({ embeds: [detailEmbed], components: [playRow] });

                // Collector para botones de detalle
                const detailCollector = searchMsg.createMessageComponentCollector({
                    filter: i => i.user.id === message.author.id,
                    time: 60000
                });

                detailCollector.on('collect', async interaction2 => {
                    await interaction2.deferUpdate();
                    detailCollector.stop();

                    if (interaction2.customId.includes('cancel')) {
                        return searchMsg.edit({ content: '❌ Cerrado.', embeds: [], components: [] });
                    }

                    if (interaction2.customId.startsWith('mback_')) {
                        return searchMsg.edit({ content: '', embeds: [embed], components: [row1, row2] });
                    }

                    if (interaction2.customId.startsWith('mplay_')) {
                        // Verificar que está en VC
                        const voiceChannel = session.member.voice.channel;
                        if (!voiceChannel) {
                            return searchMsg.edit({
                                content: '❌ Debes estar en un canal de voz para reproducir.',
                                embeds: [],
                                components: []
                            });
                        }

                        await searchMsg.edit({ content: '▶️ Agregando a la cola...', embeds: [], components: [] });

                        try {
                            let player = this.kazagumo.getPlayer(session.guild.id);
                            if (!player) {
                                player = await this.kazagumo.createPlayer({
                                    guildId: session.guild.id,
                                    textId: session.channel.id,
                                    voiceId: voiceChannel.id,
                                    shardId: session.guild.shardId || 0,
                                });
                            }
                            this.clearPlayerTimeout(session.guild.id);

                            player.queue.add(selected);
                            if (!player.playing && !player.paused) {
                                await new Promise(r => setTimeout(r, 500));
                                player.play();
                            }

                            const addedEmbed = new EmbedBuilder()
                                .setTitle('✅ Canción Agregada')
                                .setDescription(`**${selected.title}**\nDuración: ${this.formatTime(selected.length)}`)
                                .setThumbnail(selected.thumbnail || null)
                                .setColor('#00FF00');

                            await searchMsg.edit({ content: '', embeds: [addedEmbed], components: [] });
                        } catch (e) {
                            await searchMsg.edit({ content: `❌ Error al reproducir: ${e.message}`, embeds: [], components: [] });
                        }
                    }
                });

                detailCollector.on('end', (_, reason) => {
                    if (reason === 'time') searchMsg.edit({ components: [] }).catch(() => {});
                });
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') searchMsg.edit({ components: [] }).catch(() => {});
                this.searchSessions?.delete(`${message.author.id}_${guild.id}`);
            });

        } catch (error) {
            console.error('Error en searchCommand:', error);
            await loadingMsg.edit('❌ Error al buscar. Intenta más tarde.');
        }
    }

    // ─── LYRICS COMMAND ───────────────────────────────────────────────────────────
    async lyricsCommand(message, args) {
        const query = args.slice(2).join(' ').trim();
        if (!query) {
            return message.reply('❌ Escribe el nombre de la canción.\nEjemplo: `>m lyrics la lagartija`');
        }

        const loadingMsg = await message.reply(`🔍 Buscando letra de **${query}**...`);

        // Intentar lyrics.ovh primero, luego Genius
        let lyrics = null;
        let source = null;

        // ── lyrics.ovh ──
        try {
            const hasDash = query.includes(' - ');
            let artist, title;

            if (hasDash) {
                const dashParts = query.split(' - ');
                artist = dashParts[0].trim();
                title = dashParts.slice(1).join(' - ').trim();
            } else {
                artist = query;
                title = query;
            }

            const lyricsRes = await fetch(
                `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
                { signal: AbortSignal.timeout(8000) }
            );

            if (lyricsRes.ok) {
                const data = await lyricsRes.json();
                if (data.lyrics && data.lyrics.length > 50) {
                    lyrics = data.lyrics;
                    source = 'lyrics.ovh';
                }
            }
        } catch (e) {
            console.warn('lyrics.ovh falló:', e.message);
        }

        console.log('lyrics después de ovh:', lyrics ? 'ENCONTRADA' : 'NO encontrada');
        console.log('GENIUS_TOKEN existe:', !!process.env.GENIUS_TOKEN);

        // ── Genius ──
        if (!lyrics && process.env.GENIUS_TOKEN) {
            try {
                // Buscar la canción en Genius
                const searchRes = await fetch(
                    `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
                    {
                        headers: { 
                            'Authorization': `Bearer ${process.env.GENIUS_TOKEN}`,
                            'User-Agent': 'Mozilla/5.0'
                        },
                        signal: AbortSignal.timeout(8000)
                    }
                );

                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    console.log('Genius hits:', searchData.response?.hits?.length);
                    const hit = searchData.response?.hits?.[0]?.result;
                    console.log('Genius hit:', hit?.title, hit?.url);
                    
                    if (hit) {
                        // Scrapear con headers correctos
                        const pageRes = await fetch(hit.url, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml',
                                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
                            },
                            signal: AbortSignal.timeout(10000)
                        });

                        if (pageRes.ok) {
                            const html = await pageRes.text();
                            
                            // Genius guarda la letra en JSON dentro del HTML
                            const match = html.match(/window\.__PRELOADED_STATE__ = JSON\.parse\('(.+?)'\);/s);
                            if (match) {
                                try {
                                    const decoded = match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
                                    const state = JSON.parse(decoded);
                                    const lyricsData = state?.entities?.songs;
                                    if (lyricsData) {
                                        const songKey = Object.keys(lyricsData)[0];
                                        const rawLyrics = lyricsData[songKey]?.lyrics?.body?.plain;
                                        if (rawLyrics && rawLyrics.length > 50) {
                                            lyrics = rawLyrics;
                                            source = 'Genius';
                                        }
                                    }
                                } catch (parseErr) {
                                    console.warn('Genius parse falló:', parseErr.message);
                                }
                            }

                            // Fallback: regex directo sobre el HTML
                            if (!lyrics) {
                                const lyricsDivs = html.match(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g);
                                if (lyricsDivs) {
                                    const raw = lyricsDivs
                                        .join('\n')
                                        .replace(/<br\s*\/?>/gi, '\n')
                                        .replace(/<[^>]+>/g, '')
                                        .replace(/&amp;/g, '&')
                                        .replace(/&quot;/g, '"')
                                        .replace(/&#x27;/g, "'")
                                        .trim();
                                    if (raw.length > 50) {
                                        lyrics = raw;
                                        source = 'Genius';
                                    }
                                }
                            }

                            if (!lyrics) {
                                lyrics = `No pude extraer la letra.\nVer en Genius: ${hit.url}`;
                                source = 'Genius';
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('Genius falló:', e.message);
            }
        }

        if (!lyrics) {
            return loadingMsg.edit(
                `❌ No se encontró la letra.\n` +
                `Intenta con el formato: \`>m lyrics Artista - Canción\`\n` +
                `Ejemplo: \`>m lyrics Gorillaz - Clint Eastwood\``
            );
        }

        // Dividir letra en chunks de 4000 chars (límite de Discord embed)
        const chunks = [];
        let remaining = lyrics;
        while (remaining.length > 0) {
            chunks.push(remaining.slice(0, 1900));
            remaining = remaining.slice(1900);
        }

        const embed = new EmbedBuilder()
            .setTitle(`🎵 Letra — ${query}`)
            .setDescription(chunks[0])
            .setColor('#9932CC')
            .setFooter({ text: `Fuente: ${source}${chunks.length > 1 ? ` • Página 1/${chunks.length}` : ''}` })
            .setTimestamp();

        if (chunks.length === 1) {
            return loadingMsg.edit({ content: '', embeds: [embed] });
        }

        // Paginación si la letra es larga
        let currentPage = 0;
        const navRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`lyrics_prev_${message.author.id}`)
                .setLabel('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`lyrics_next_${message.author.id}`)
                .setLabel('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(chunks.length <= 1)
        );

        const lyricsMsg = await loadingMsg.edit({ content: '', embeds: [embed], components: [navRow] });

        const collector = lyricsMsg.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 120000
        });

        collector.on('collect', async interaction => {
            await interaction.deferUpdate();
            if (interaction.customId.startsWith('lyrics_next')) currentPage++;
            if (interaction.customId.startsWith('lyrics_prev')) currentPage--;

            const pageEmbed = new EmbedBuilder()
                .setTitle(`🎵 Letra — ${query}`)
                .setDescription(chunks[currentPage])
                .setColor('#9932CC')
                .setFooter({ text: `Fuente: ${source} • Página ${currentPage + 1}/${chunks.length}` });

            const updatedRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`lyrics_prev_${message.author.id}`)
                    .setLabel('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`lyrics_next_${message.author.id}`)
                    .setLabel('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === chunks.length - 1)
            );

            await lyricsMsg.edit({ embeds: [pageEmbed], components: [updatedRow] });
        });

        collector.on('end', () => {
            lyricsMsg.edit({ components: [] }).catch(() => {});
        });
    }

    async handleSearchInteraction(interaction) {
        try {
            try {
                await interaction.deferUpdate();
            } catch (deferErr) {
                console.warn('deferUpdate falló (interacción expirada?):', deferErr.message);
                return; // Si ya expiró no podemos hacer nada
            }

            const customId = interaction.customId;
            const parts = customId.split('_');
            const userId = parts[2];
            const guildId = parts[3];

            // Verificar que es el usuario correcto
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ Este menú no es tuyo.', ephemeral: true });
            }

            const session = this.searchSessions?.get(`${userId}_${guildId}`);
            if (!session) {
                return interaction.editReply({ content: '❌ La sesión expiró. Busca de nuevo.', embeds: [], components: [] });
            }

            if (customId.startsWith('msearch_cancel')) {
                this.searchSessions.delete(`${userId}_${guildId}`);
                return interaction.editReply({ content: '❌ Búsqueda cancelada.', embeds: [], components: [] });
            }

            if (customId.startsWith('msearch_')) {
                const index = parseInt(parts[1]);
                const selected = session.tracks[index];

                const detailEmbed = new EmbedBuilder()
                    .setTitle('🎵 Detalles de la Canción')
                    .setColor('#9932CC')
                    .setThumbnail(selected.thumbnail || null)
                    .addFields(
                        { name: '🎵 Título', value: selected.title, inline: false },
                        { name: '👤 Artista', value: selected.author || 'Desconocido', inline: true },
                        { name: '⏱️ Duración', value: this.formatTime(selected.length), inline: true },
                        { name: '📡 Plataforma', value: session.engine === 'ytsearch' ? 'YouTube' : 'Spotify', inline: true },
                        { name: '🔗 URL', value: selected.uri || 'No disponible', inline: false }
                    )
                    .setTimestamp();

                const playRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`mplay_${index}_${userId}_${guildId}`)
                        .setLabel('▶️ Reproducir')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`mback_${userId}_${guildId}`)
                        .setLabel('⬅️ Volver')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`msearch_cancel_${userId}_${guildId}`)
                        .setLabel('❌ Cerrar')
                        .setStyle(ButtonStyle.Danger)
                );

                return interaction.editReply({ embeds: [detailEmbed], components: [playRow] });
            }

            if (customId.startsWith('mplay_')) {
                const index = parseInt(parts[1]);
                const selected = session.tracks[index];
                const voiceChannel = interaction.member.voice.channel;

                if (!voiceChannel) {
                    return interaction.editReply({
                        content: '❌ Debes estar en un canal de voz para reproducir.',
                        embeds: [], components: []
                    });
                }

                try {
                    let player = this.kazagumo.getPlayer(guildId);
                    if (!player) {
                        player = await this.kazagumo.createPlayer({
                            guildId,
                            textId: interaction.channelId,
                            voiceId: voiceChannel.id,
                            shardId: interaction.guild.shardId || 0,
                        });
                    }
                    this.clearPlayerTimeout(guildId);
                    player.queue.add(selected);

                    if (!player.playing && !player.paused) {
                        await new Promise(r => setTimeout(r, 500));
                        player.play();
                    }

                    const addedEmbed = new EmbedBuilder()
                        .setTitle('✅ Canción Agregada')
                        .setDescription(`**${selected.title}**\nDuración: ${this.formatTime(selected.length)}`)
                        .setThumbnail(selected.thumbnail || null)
                        .setColor('#00FF00');

                    this.searchSessions.delete(`${userId}_${guildId}`);
                    return interaction.editReply({ content: '', embeds: [addedEmbed], components: [] });

                } catch (e) {
                    return interaction.editReply({ content: `❌ Error al reproducir: ${e.message}`, embeds: [], components: [] });
                }
            }

            if (customId.startsWith('mback_')) {
                // Reconstruir la lista original
                const tracks = session.tracks;
                const platform = session.engine === 'ytsearch' ? '🎬 YouTube' : '🟢 Spotify';

                const embed = new EmbedBuilder()
                    .setTitle(`${platform} — Resultados`)
                    .setColor(session.engine === 'ytsearch' ? '#FF0000' : '#1DB954')
                    .setDescription(
                        tracks.map((t, i) =>
                            `\`${i + 1}.\` **${t.title}**\n└ ${this.formatTime(t.length)} • ${t.author || 'Desconocido'}`
                        ).join('\n\n')
                    )
                    .setFooter({ text: 'Selecciona una canción' });

                const row1 = new ActionRowBuilder().addComponents(
                    tracks.slice(0, 4).map((_, i) =>
                        new ButtonBuilder()
                            .setCustomId(`msearch_${i}_${userId}_${guildId}`)
                            .setLabel(`${i + 1}`)
                            .setStyle(ButtonStyle.Primary)
                    )
                );
                const row2 = new ActionRowBuilder().addComponents(
                    [
                        ...tracks.slice(4).map((_, i) =>
                            new ButtonBuilder()
                                .setCustomId(`msearch_${i + 4}_${userId}_${guildId}`)
                                .setLabel(`${i + 5}`)
                                .setStyle(ButtonStyle.Primary)
                        ),
                        new ButtonBuilder()
                            .setCustomId(`msearch_cancel_${userId}_${guildId}`)
                            .setLabel('❌ Cancelar')
                            .setStyle(ButtonStyle.Danger)
                    ]
                );

                return interaction.editReply({ embeds: [embed], components: [row1, row2] });
            }

        } catch (e) {
            console.error('Error en handleSearchInteraction:', e);
            try {
                await interaction.editReply({ content: '❌ Error procesando la interacción.', embeds: [], components: [] });
            } catch (_) {}
        }
    }

    async getSpotifyPlaylistThumbnail(spotifyUrl) {
        try {
            // Extraer playlist ID de la URL
            const match = spotifyUrl.match(/playlist\/([a-zA-Z0-9]+)/);
            if (!match) return null;
            const playlistId = match[1];

            // Obtener token de Spotify
            const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')
                },
                body: 'grant_type=client_credentials'
            });
            const tokenData = await tokenRes.json();

            // Obtener info de la playlist
            const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=images`, {
                headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
            });
            const data = await res.json();
            return data.images?.[0]?.url || null;
        } catch (e) {
            return null;
        }
    }

    async playCommand(message, args, member, channel, guild, author) {
        // AGREGAR THROTTLE:
        const lastPlay = this.playThrottle.get(guild.id) || 0;
        if (Date.now() - lastPlay < 2000) { // 2 segundos entre plays
            return message.reply('⏳ Espera un momento antes de agregar más canciones.');
        }
        this.playThrottle.set(guild.id, Date.now());

        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return message.reply('❌ Debes estar en un canal de voz para usar este comando.');
        }

        if (!args[2]) {
            return message.reply('❌ Proporciona el nombre de la canción.\nEjemplo: `>music play despacito`');
        }

        let query = args.slice(2).join(' ');

        await message.reply({
            content: `🔍 Buscando... \`${query}\``,
        });

        try {
            let player = this.kazagumo.getPlayer(guild.id);

            if (!player) {
                let bestNode = this.getBestNode();
                if (!bestNode) {
                    await message.reply('⏳ Conectando al servidor de música, espera un momento...');
                    const connected = await this.waitForNode(10000);
                    if (!connected) {
                        return message.channel.send('❌ No se pudo conectar a ningún servidor de música. Intenta más tarde.');
                    }
                    bestNode = this.getBestNode();
                }
                
                player = await this.kazagumo.createPlayer({
                    guildId: guild.id,
                    textId: channel.id,
                    voiceId: voiceChannel.id,
                    shardId: guild.shardId || 0,
                });
            }

            this.clearPlayerTimeout(guild.id); // Limpiar timeout si existe

            // Limpiar URLs de Spotify
            if (query.includes('spotify.com')) {
                query = query
                    .replace('/intl-es/', '/')
                    .split('?')[0];
            }

            let searchQuery = query;
            let searchEngine = 'ytsearch';

            if (searchQuery.startsWith('http')) {
                searchEngine = null; // URLs directas — LavaSrc y plugin de YT detectan automáticamente
            } else if (searchQuery.startsWith('spsearch:')) {
                searchEngine = 'spsearch';
                searchQuery = searchQuery.slice(9);
            } else if (searchQuery.startsWith('scsearch:')) {
                searchEngine = 'scsearch';
                searchQuery = searchQuery.slice(9);
            }

            const result = await this.kazagumo.search(
                searchQuery,
                searchEngine
                    ? { requester: author, engine: searchEngine }
                    : { requester: author }
            );


            if (!result.tracks.length) {
                return message.reply('❌ No se encontraron resultados para tu búsqueda.');
            }

            // Antes de player.play():
            const track = result.tracks[0];
            if (track.length > this.maxSongDuration) {
                return message.reply('❌ La canción es muy larga (máximo 2 horas).');
            }

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTimestamp();

                if (result.type === 'PLAYLIST') {
                    player.queue.add(result.tracks);
                    
                    // Intentar obtener thumbnail real de Spotify
                    let playlistThumb = result.tracks.find(t => t.thumbnail)?.thumbnail || null;
                    if (searchQuery.includes('spotify.com/playlist')) {
                        playlistThumb = await this.getSpotifyPlaylistThumbnail(searchQuery) || playlistThumb;
                    }

                    embed.setTitle('📂 Playlist Agregada')
                        .setDescription(`**${result.playlistName}**\n${result.tracks.length} canciones agregadas`)
                        .setThumbnail(playlistThumb);
                } else {
                const track = result.tracks[0];
                player.queue.add(track);
                embed.setTitle('🎵 Canción Agregada a la Cola')
                    .setDescription(`**${track.title}**\nDuración: ${this.formatTime(track.length)}`)
                    .setThumbnail(track.thumbnail || null);
            }

            if (!player.playing && !player.paused) {
                await new Promise(resolve => setTimeout(resolve, 500));
                player.play();
            }

            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error en play command:', error);
            
            if (error.status === 429) {
                return message.reply('⏳ El servidor de música está sobrecargado. Intenta en unos segundos o usa `>m fix` para cambiar de nodo.');
            }
            
            await message.reply('❌ Ocurrió un error al reproducir la música.');
        }
    }

    async stopCommand(message, guild) {
        const player = this.kazagumo.getPlayer(guild.id);

        if (!player) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        await player.destroy();
        this.clearPlayerTimeout(guild.id);

        const embed = new EmbedBuilder()
            .setTitle('⏹️ Música Detenida')
            .setDescription('La música se ha detenido y el bot se ha desconectado del canal de voz.')
            .setColor('#FF0000');

        await message.reply({ embeds: [embed] });
    }

    async skipCommand(message, args, guild) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player) return message.reply('❌ No hay música reproduciéndose.');

        const amount = parseInt(args[2]) || 1;
        if (amount < 1) return message.reply('❌ La cantidad debe ser mayor a 0.');

        const totalDisponible = player.queue.size + 1;
        if (amount > totalDisponible) {
            return message.reply(`❌ Solo hay ${totalDisponible} canciones disponibles para saltar.`);
        }

        const currentTrack = player.queue.current;

        // Eliminar canciones extra de la cola antes de skipear
        for (let i = 0; i < amount - 1; i++) {
            player.queue.splice(0, 1);
        }
        player.skip();

        const embed = new EmbedBuilder()
            .setTitle('⏭️ Canciones Saltadas')
            .setDescription(amount === 1
                ? `**${currentTrack.title}** ha sido saltada.`
                : `Se saltaron **${amount}** canciones.`)
            .setColor('#FFA500');

        await message.reply({ embeds: [embed] });
    }

    async pauseCommand(message, guild) {
        const player = this.kazagumo.getPlayer(guild.id);

        if (!player) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        if (player.paused) {
            return message.reply('❌ La música ya está pausada.');
        }

        player.pause(true);

        const embed = new EmbedBuilder()
            .setTitle('⏸️ Música Pausada')
            .setDescription('La música ha sido pausada.')
            .setColor('#FFA500');

        await message.reply({ embeds: [embed] });
    }

    async resumeCommand(message, guild) {
        const player = this.kazagumo.getPlayer(guild.id);
        
        if (!player) {
            return message.reply('❌ No hay música reproduciéndose.');
        }
        
        if (!player.paused) {
            return message.reply('❌ La música no está pausada.');
        }
        
        player.pause(false);
        player.setVolume(player.volume); // "Kick" al player
        
        const embed = new EmbedBuilder()
            .setTitle('▶️ Música Reanudada')
            .setDescription('La música ha sido reanudada.')
            .setColor('#00FF00');
        
        await message.reply({ embeds: [embed] });
    }

    async queueCommand(message, args, guild) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player || !player.queue.current) {
            return message.reply('❌ No hay música en la cola.');
        }

        const current = player.queue.current;
        const songs = player.queue.slice(0, player.queue.size);
        const totalSongs = songs.length;
        const songsPerPage = 10;
        const totalPages = Math.max(1, Math.ceil(totalSongs / songsPerPage));

        let page = parseInt(args[2]) || 1;
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        const start = (page - 1) * songsPerPage;
        const pageSongs = songs.slice(start, start + songsPerPage);

        let description = `**🎵 Reproduciendo Ahora:**\n${current.title} (${this.formatTime(current.length)})\n\n`;

        if (totalSongs === 0) {
            description += '**📋 En Cola:** Vacía';
        } else {
            description += `**📋 En Cola — ${totalSongs} canciones:**\n`;
            pageSongs.forEach((track, i) => {
                description += `\`${start + i + 1}.\` ${track.title} (${this.formatTime(track.length)})\n`;
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Cola de Reproducción')
            .setDescription(description)
            .setColor('#0099FF')
            .setFooter({ text: `Página ${page}/${totalPages} • >m queue <página> para navegar` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    async nowPlayingCommand(message, guild) {
        const player = this.kazagumo.getPlayer(guild.id);

        if (!player || !player.queue.current) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        const track = player.queue.current;
        const position = player.position;
        const duration = track.length;

        const embed = new EmbedBuilder()
            .setTitle('🎵 Reproduciendo Ahora')
            .setDescription(`**${track.title}**`)
            .setThumbnail(track.thumbnail || null)
            .addFields(
                { name: '⏱️ Duración', value: this.formatTime(duration), inline: true },
                { name: '📍 Posición', value: this.formatTime(position), inline: true },
                { name: '🔊 Volumen', value: `${player.volume}%`, inline: true },
                { name: '🔄 Loop', value: player.loop || 'Desactivado', inline: true },
                { name: '👤 Solicitado por', value: track.requester.tag, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    async volumeCommand(message, args, guild) {
        const player = this.kazagumo.getPlayer(guild.id);

        if (!player) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        if (!args[2]) {
            return message.reply(`🔊 Volumen actual: **${player.volume}%**\nUsa \`>music volume <1-100>\` para cambiar el volumen.`);
        }

        const volume = parseInt(args[2]);

        if (isNaN(volume) || volume < 1 || volume > 100) {
            return message.reply('❌ El volumen debe ser un número entre 1 y 100.');
        }

        player.setVolume(volume);

        const embed = new EmbedBuilder()
            .setTitle('🔊 Volumen Cambiado')
            .setDescription(`Volumen establecido a **${volume}%**`)
            .setColor('#0099FF');

        await message.reply({ embeds: [embed] });
    }

    async fixPlayerCommand(message, guild) {
        const player = this.kazagumo.getPlayer(guild.id);
        
        if (!player) {
            return message.reply('❌ No hay música reproduciéndose.');
        }
        
        const queue = [...player.queue];
        const current = player.queue.current;
        
        await player.destroy();
        
        // Recrear player
        const newPlayer = await this.kazagumo.createPlayer({
            guildId: guild.id,
            textId: message.channel.id,
            voiceId: message.member.voice.channel.id
        });
        
        if (current) newPlayer.queue.add(current);
        newPlayer.queue.add(queue);
        newPlayer.play();
        
        await message.reply('✅ Player reiniciado correctamente.');
    }

    async seekCommand(message, args, guild) {
        const player = this.kazagumo.getPlayer(guild.id);
        
        if (!player || !player.queue.current) {
            return message.reply('❌ No hay música reproduciéndose.');
        }
        
        if (!args[2]) {
            return message.reply('❌ Especifica el tiempo.\nEjemplos:\n• `>m seek 1:30` (1 min 30 seg)\n• `>m seek 30` (30 segundos)\n• `>m seek +30` (adelantar 30 seg)\n• `>m seek -15` (retroceder 15 seg)');
        }
        
        const input = args[2];
        const currentPosition = player.position;
        const duration = player.queue.current.length;
        let targetPosition;
        
        // Formato: +30 o -30 (relativo)
        if (input.startsWith('+') || input.startsWith('-')) {
            const seconds = parseInt(input) * 1000;
            targetPosition = currentPosition + seconds;
        }
        // Formato: 1:30 (minutos:segundos)
        else if (input.includes(':')) {
            const [min, sec] = input.split(':').map(Number);
            targetPosition = (min * 60 + sec) * 1000;
        }
        // Formato: 30 (segundos absolutos)
        else {
            targetPosition = parseInt(input) * 1000;
        }
        
        // Validar límites
        if (targetPosition < 0) {
            return message.reply('❌ No puedes retroceder antes del inicio.');
        }

        if (targetPosition > duration) {
            return message.reply('❌ El tiempo especificado excede la duración de la canción.');
        }

        // CAMBIAR AQUÍ:
        player.seek(targetPosition);

        const embed = new EmbedBuilder()
            .setTitle('⏩ Posición Cambiada')
            .setDescription(`Posición: **${this.formatTime(targetPosition)}** / ${this.formatTime(duration)}`)
            .setColor('#0099FF');
        
        await message.reply({ embeds: [embed] });
    }

    async loopCommand(message, args, guild) {
        const player = this.kazagumo.getPlayer(guild.id);

        if (!player) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        const loopMode = args[2] ? args[2].toLowerCase() : null;
        let newLoop;

        switch (loopMode) {
            case 'track':
            case 'cancion':
                newLoop = 'track';
                break;
            case 'queue':
            case 'cola':
                newLoop = 'queue';
                break;
            case 'off':
            case 'disable':
            case 'desactivar':
                newLoop = 'none';
                break;
            default:
                // Toggle entre none y track
                newLoop = player.loop === 'none' ? 'track' : 'none';
                break;
        }

        player.setLoop(newLoop);

        const loopText = {
            'none': 'Desactivado',
            'track': 'Canción Actual',
            'queue': 'Cola Completa'
        };

        const embed = new EmbedBuilder()
            .setTitle('🔄 Modo Loop Cambiado')
            .setDescription(`Loop establecido a: **${loopText[newLoop]}**`)
            .setColor('#0099FF');

        await message.reply({ embeds: [embed] });
    }

    async shuffleCommand(message, guild) {
        const player = this.kazagumo.getPlayer(guild.id);

        if (!player) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        if (player.queue.size < 2) {
            return message.reply('❌ Necesitas al menos 2 canciones en la cola para mezclar.');
        }

        player.queue.shuffle();

        const embed = new EmbedBuilder()
            .setTitle('🔀 Cola Mezclada')
            .setDescription(`Se han mezclado **${player.queue.size}** canciones en la cola.`)
            .setColor('#0099FF');

        await message.reply({ embeds: [embed] });
    }

    async clearQueueCommand(message, guild) {
        const player = this.kazagumo.getPlayer(guild.id);

        if (!player) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        if (player.queue.size === 0) {
            return message.reply('❌ La cola ya está vacía.');
        }

        const clearedCount = player.queue.size;
        player.queue.clear();

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Cola Limpiada')
            .setDescription(`Se han eliminado **${clearedCount}** canciones de la cola.`)
            .setColor('#FF0000');

        await message.reply({ embeds: [embed] });
    }

    async showMusicHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('🎵 Sistema de Música')
            .setColor('#9932CC')
            .setDescription('Reproduce música de YouTube y Spotify')
            .addFields(
                {
                    name: '▶️ Reproducir',
                    value: '`>m play <canción/URL>`\n`>m p <canción>`',
                    inline: true
                },
                {
                    name: '⏭️ Saltar',
                    value: '`>m skip`\n`>m s`',
                    inline: true
                },
                {
                    name: '⏸️ Pausar/Reanudar',
                    value: '`>m pause`\n`>m resume`',
                    inline: true
                },
                {
                    name: '⏹️ Detener',
                    value: '`>m stop`\n`>m leave`',
                    inline: true
                },
                {
                    name: '📋 Cola',
                    value: '`>m queue`\n`>m q`',
                    inline: true
                },
                {
                    name: '🎵 Reproduciendo',
                    value: '`>m nowplaying`\n`>m np`',
                    inline: true
                },
                {
                    name: '🔊 Volumen',
                    value: '`>m volume <1-100>`\n`>m vol <1-100>`',
                    inline: true
                },
                {
                    name: '🔁 Loop',
                    value: '`>m loop song` — Repite canción\n`>m loop queue` — Repite cola\n`>m loop off` — Sin loop',
                    inline: true
                },
                {
                    name: '🔀 Shuffle',
                    value: '`>m shuffle` — Mezclar cola',
                    inline: true
                },
                {
                    name: '🗑️ Limpiar cola',
                    value: '`>m clear` — Vaciar cola',
                    inline: true
                },
                {
                    name: '🔧 Arreglar',
                    value: '`>m fix` — Reiniciar player',
                    inline: true
                },
                {
                    name: '🎬 Buscar YouTube',
                    value: '`>m ytsearch <canción>` — Ver resultados y reproducir\n`>m ys <canción>`',
                    inline: true
                },
                {
                    name: '🟢 Buscar Spotify',
                    value: '`>m spsearch <canción>` — Ver resultados y reproducir\n`>m ss <canción>`',
                    inline: true
                },
                {
                    name: '🎵 Letra',
                    value: '`>m lyrics <canción>` — Ver letra\n`>m letra artista - canción`',
                    inline: true
                },
                {
                    name: '📱 Plataformas soportadas',
                    value: '🎵 YouTube\n🟢 Spotify',
                    inline: false
                },
                {
                    name: '💡 Ejemplos',
                    value: [
                        '`>m play bad guy` — Busca en YouTube',
                        '`>m play https://open.spotify.com/track/...` — Link Spotify',
                        '`>m play ` - Link Album Spotify',
                        '`>m play ` - Link Playlist Spotify (La Playlist debe ser Pública)',
                        '`>m play https://youtube.com/watch?v=...` — Link YouTube',
                        '`>m play ` - Link Playlist YouTube',
                        '`>m ytsearch la lagartija` — Buscar en YouTube con selección',
                        '`>m lyrics Gorillaz - Clint Eastwood` — Ver letra de canción',
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Debes estar en un canal de voz para usar estos comandos' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
}

module.exports = MusicSystem;
