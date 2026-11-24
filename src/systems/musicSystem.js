const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');
const https = require('https');
const http = require('http');

class MusicSystem {
    constructor(client) {
        this.client = client;
        this.kazagumo = null;
        this.playerTimeouts = new Map();
        this.failedNodes = new Set();
        this.skipVotes = new Map();
        this.metadataNode = 'Lavalink95';
        this.searchSessions = new Map();
        this.spotifySearchSessions = new Map();
        this.queuePages = new Map();
        this.failedNodesSince = new Map();

        this.initialize();

        // Limpieza periódica de sesiones de búsqueda
        setInterval(() => {
            const now = Date.now();
            for (const [key, session] of this.searchSessions.entries()) {
                if (now - session.timestamp > 60000) this.searchSessions.delete(key);
            }
            for (const [key, session] of this.spotifySearchSessions.entries()) {
                if (now - session.timestamp > 60000) this.spotifySearchSessions.delete(key);
            }
            for (const [key, page] of this.queuePages.entries()) {
                if (now - page.timestamp > 60000) this.queuePages.delete(key);
            }
        }, 60000);
    }

    initialize() {
        const nodes = [
            { 
                name: 'Vinster', 
                url: 'freelavalinkvinster.in:443', 
                auth: 'youshallnotpass', 
                secure: true 
            },
            { 
                name: 'Jirayu', 
                url: 'lavalink.jirayu.net:443', 
                auth: 'youshallnotpass', 
                secure: true 
            },
            { 
                name: 'Serenetia-SSL', 
                url: 'lavalinkv4.serenetia.com:443', 
                auth: 'https://seretia.link/discord', 
                secure: true 
            },
            { 
                name: 'Nazha', 
                url: 'lavalink.nazha.online:443', 
                auth: 'nazhafreelava', 
                secure: true 
            },
            { 
                name: 'TriniumHost', 
                url: 'lavalink-v4.triniumhost.com:443', 
                auth: 'free', 
                secure: true 
            },
            { 
                name: 'AneFaiz', 
                url: 'lava-v4.millohost.my.id:443', 
                auth: 'https://discord.gg/mjS5J2K3ep', 
                secure: true 
            },
            { 
                name: 'G3V', 
                url: 'lava.g3v.co.uk:9008', 
                auth: 'lavalinklol', 
                secure: false 
            },
            { 
                name: 'Nexcloud (Kartik)', 
                url: 'n3.nexcloud.in:2026', 
                auth: 'nexcloud', 
                secure: false 
            },
            { 
                name: 'NyxBot (Tapao)', 
                url: 'sg1-nodelink.nyxbot.app:3000', 
                auth: 'nyxbot.app/support', 
                secure: false 
            },
            { 
                name: 'Serenetia-NoSSL', 
                url: 'lavalinkv4.serenetia.com:80', 
                auth: 'https://seretia.link/discord', 
                secure: false 
            },
            { 
                name: 'GDjkhp-NoSSL', 
                url: 'nodelink.gdjkhp.com:3000', 
                auth: 'youshallnotpass', 
                secure: false 
            },
            { 
                name: 'HeavenCloud', 
                url: 'free-lava.heavencloud.in:4000', 
                auth: 'heavencloud.in', 
                secure: false 
            },
            { 
                name: 'Lavalink95', 
                url: 'fr-one.enzonic.com:26026', 
                auth: process.env.LAVAPASS, 
                secure: false 
            }
        ];

        this.kazagumo = new Kazagumo(
            {
                defaultSearchEngine: 'youtube',
                plugins: [new Plugins.PlayerMoved(this.client)],
                send: (guildId, payload) => {
                    const guild = this.client.guilds.cache.get(guildId);
                    if (guild) guild.shard.send(payload);
                },
            },
            new Connectors.DiscordJS(this.client),
            nodes,
            { moveOnDisconnect: false, resumeByLibrary: false, reconnectTries: 5, reconnectInterval: 5 }
        );

        this.client.kazagumo = this.kazagumo;

        const shoukakuConnector = this.kazagumo.shoukaku.connector;
        if (shoukakuConnector?.raw) {
            const originalConnectorRaw = shoukakuConnector.raw.bind(shoukakuConnector);
            shoukakuConnector.raw = (packet) => {
                if (packet?.t === 'VOICE_SERVER_UPDATE' && packet?.d) {
                    console.log(`[Voice] SERVER_UPDATE guild=${packet.d.guild_id} endpoint=${packet.d.endpoint} token=${packet.d.token ? 'sí' : 'NO'}`);
                }
                if (packet?.t === 'VOICE_STATE_UPDATE' && packet?.d?.user_id === this.client.user?.id) {
                    console.log(`[Voice] STATE_UPDATE canal=${packet.d.channel_id} session_id=${packet.d.session_id ? 'sí' : 'NO'}`);
                }

                if (packet?.t === 'VOICE_SERVER_UPDATE' && packet?.d && typeof packet.d.endpoint === 'string') {
                    const original = packet.d.endpoint;
                    const normalized = original.trim()
                        .replace(/^wss?:\/\//i, '')
                        .replace(/^https?:\/\//i, '')
                        .replace(/\/+$/, '');

                    if (normalized !== original) {
                        console.log(`[Voice] Endpoint normalizado: ${original} -> ${normalized}`);
                        packet.d.endpoint = normalized;
                    }
                }
                return originalConnectorRaw(packet);
            };
        }

        this.kazagumo.shoukaku.on('ready', (name, resumed) => {
            console.log(`✅ Nodo ${name} listo! (resumed: ${resumed})`);
            this.failedNodes.delete(name);
            this.failedNodesSince.delete(name);
        });

        this.kazagumo.shoukaku.on('error', (name, error) => {
            const msg = error?.message || String(error);
            if (msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) {
                console.log(`🔇 Nodo ${name} está offline (Error de red)`);
            } else {
                console.error(`❌ Error en nodo ${name}:`, msg);
            }
            if (!this.failedNodes.has(name)) this.failedNodesSince.set(name, Date.now());
            this.failedNodes.add(name);
        });

        this.kazagumo.shoukaku.on('close', (name, code, reason) => {
            if (code === 1006 || String(reason).includes('before a connection')) {
                console.log(`🔇 Nodo ${name} cerró antes de conectar`);
            } else {
                console.warn(`⚠️ Nodo ${name} cerrado. Código: ${code} Razón: ${reason || 'ninguna'}`);
            }
            if (!this.failedNodes.has(name)) this.failedNodesSince.set(name, Date.now());
            this.failedNodes.add(name);
        });

        this.kazagumo.shoukaku.on('disconnect', (name, count) => {
            console.warn(`🔌 Nodo ${name} desconectado (${count} players afectados)`);
        });

        const ensureNodes = () => {
            const sk = this.kazagumo.shoukaku;
            if (!sk.id && this.client.user) sk.id = this.client.user.id;
            for (const n of nodes) {
                if (!sk.nodes.has(n.name)) {
                    console.log(`[Music] Registrando nodo ${n.name} manualmente`);
                    sk.addNode(n);
                }
            }
            console.log('[Music] Nodos registrados:', [...sk.nodes.keys()].join(', ') || 'ninguno');
        };

        if (this.client.isReady()) ensureNodes();
        else {
            this.client.once('ready', ensureNodes);
            this.client.once('clientReady', ensureNodes);
        }

        this.setupEventListeners();
        this.setupFailover();
        this.setupNodeWatchdog(nodes);
    }

    setupEventListeners() {
        this.kazagumo.on('playerStart', async (player, track) => {
            this.skipVotes.delete(player.guildId);

            if (!track) {
                console.warn(`[Music] playerStart sin track en ${player.guildId}. Ignorando.`);
                return;
            }

            console.log(`🎵 Reproduciendo "${track.title}" en ${player.guild?.name || player.guildId}`);
            
            const embed = new EmbedBuilder()
                .setTitle('🎵 Reproduciendo Ahora')
                .setDescription(`**${track.title}**\nDuración: ${this.formatTime(track.length)}`)
                .setThumbnail(track.thumbnail || null)
                .setColor('#00FF00')
                .setTimestamp();

            if (player.textId) {
                const channel = this.client.channels.cache.get(player.textId);
                if (channel) channel.send({ embeds: [embed] }).catch(() => {});
            }
        });

        this.kazagumo.on('playerEmpty', (player) => {
            if (this.failingOver && this.failingOver.has(player.guildId)) {
                console.log(`[Music] playerEmpty ignorado por failover en ${player.guildId}`);
                return;
            }

            const node = this.kazagumo.shoukaku.nodes.get(player.shoukaku?.node?.name);
            if (!node) {
                console.log(`[Music] playerEmpty ignorado por nodo muerto en ${player.guildId}`);
                return;
            }

            if (player.textId) {
                const channel = this.client.channels.cache.get(player.textId);
                if (channel) {
                    const embed = new EmbedBuilder().setTitle('✅ Cola Terminada').setDescription('Se han reproducido todas las canciones.').setColor('#00FF00');
                    channel.send({ embeds: [embed] }).catch(() => {});
                }
            }
            this.setPlayerTimeout(player.guildId, () => {
                if (player.queue.size === 0 && !player.playing) {
                    this.forceDestroyPlayer(player.guildId);
                    const channel = this.client.channels.cache.get(player.textId);
                    if (channel) channel.send('⏹️ Desconectado por inactividad.').catch(() => {});
                }
            }, 300000); // 5 min
        });

        this.kazagumo.on('playerDestroy', (player) => this.clearPlayerTimeout(player.guildId));
    }

    setupNodeWatchdog(nodesConfig) {
        const FAILED_COOLDOWN = 3 * 60 * 1000;

        setInterval(async () => {
            const sk = this.kazagumo?.shoukaku;
            if (!sk || !this.client.isReady()) return;

            for (const config of nodesConfig) {
                const existing = sk.nodes.get(config.name);

                if (!existing) {
                    console.log(`[Watchdog] Re-agregando nodo eliminado: ${config.name}`);
                    this.failedNodes.delete(config.name);
                    this.failedNodesSince.delete(config.name);
                    try {
                        sk.addNode(config);
                    } catch (e) {
                        console.warn(`[Watchdog] addNode(${config.name}) falló:`, e.message);
                    }
                    continue;
                }

                const isUp = existing.state === 1 || existing.state === 'CONNECTED';
                if (!isUp && this.failedNodes.has(config.name)) {
                    const since = this.failedNodesSince.get(config.name) || 0;
                    if (Date.now() - since > FAILED_COOLDOWN) {
                        console.log(`[Watchdog] Reintentando conexión a ${config.name} (cooldown expirado)`);
                        this.failedNodes.delete(config.name);
                        this.failedNodesSince.delete(config.name);
                        try {
                            if (typeof existing.connect === 'function') {
                                await existing.connect();
                            } else if (typeof sk.reconnect === 'function') {
                                await sk.reconnect(config.name);
                            }
                        } catch (e) {
                            console.warn(`[Watchdog] reconnect(${config.name}) falló:`, e.message);
                            this.failedNodes.add(config.name);
                            this.failedNodesSince.set(config.name, Date.now());
                        }
                    }
                }
            }
        }, 60 * 1000);
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

    async forceDestroyPlayer(guildId) {
        try {
            const player = this.kazagumo.getPlayer(guildId);
            if (player) await player.destroy().catch(() => {}); 
        } catch (e) {}
        
        this.kazagumo.players.delete(guildId);
        if (this.kazagumo.shoukaku) {
            this.kazagumo.shoukaku.players.delete(guildId);
        }
        this.clearPlayerTimeout(guildId);
    }

    formatTime(ms) {
        if (!ms || ms <= 0 || !Number.isFinite(ms)) return '0:00';
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    async searchWithTimeout(query, options, timeoutMs = 10000) {
        return Promise.race([
            this.kazagumo.search(query, options),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: El nodo tardó demasiado en responder')), timeoutMs))
        ]);
    }

    getBestNode() {
        for (const [name, node] of this.kazagumo.shoukaku.nodes) {
            if (name === this.metadataNode) continue;
            const isConnected = node.state === 1 || node.state === 'CONNECTED';
            if (isConnected && !this.failedNodes.has(name)) {
                return name;
            }
        }
        return undefined;
    }

    getSpotifyNodeCandidates() {
        const isUp = (n) => n && (n.state === 1 || n.state === 'CONNECTED');
        const names = [];
        if (isUp(this.kazagumo.shoukaku.nodes.get(this.metadataNode))) names.push(this.metadataNode);
        for (const [name, node] of this.kazagumo.shoukaku.nodes) {
            if (name === this.metadataNode) continue;
            if (isUp(node) && !this.failedNodes.has(name)) names.push(name);
        }
        return names;
    }

    setupFailover() {
        this.failingOver = new Set();
        this.failover = new Map();

        this.kazagumo.on('playerStart', (player) => this.failover.delete(player.guildId));

        this.kazagumo.on('playerException', async (player, data) => {
            const guildId = player.guildId;
            if (this.failingOver.has(guildId)) return;

            const track = player.queue.current;
            if (!track) return;

            const currentNode = player.shoukaku?.node?.name;
            let state = this.failover.get(guildId);
            if (!state || state.id !== track.identifier) {
                state = { id: track.identifier, tried: new Set() };
                this.failover.set(guildId, state);
            }
            if (currentNode) state.tried.add(currentNode);

            console.warn(`[Failover] "${track.title}" falló en ${currentNode}: ${data?.exception?.message || 'error desconocido'}`);

            const channel = this.client.channels.cache.get(player.textId);
            const nextNode = state.tried.size >= 3 ? undefined : this.getPlayableNodes().find(n => !state.tried.has(n));

            if (!nextNode) {
                this.failover.delete(guildId);
                if (channel) channel.send(`❌ No pude reproducir **${track.title}** en ningún nodo. La salto.`).catch(() => {});
                return;
            }

            this.failingOver.add(guildId);
            const queue = [...player.queue];
            const saved = {
                position: player.position || 0,
                volume: player.volume,
                loop: player.loop,
                paused: player.paused,
                textId: player.textId,
                voiceId: player.voiceId,
                shardId: this.client.guilds.cache.get(guildId)?.shardId || 0
            };

            try {
                if (channel) channel.send(`⚠️ Falló en \`${currentNode}\`, reintentando en \`${nextNode}\`...`).catch(() => {});
                await this.forceDestroyPlayer(guildId);

                const newPlayer = await this.kazagumo.createPlayer({
                    guildId,
                    textId: saved.textId,
                    voiceId: saved.voiceId,
                    shardId: saved.shardId,
                    nodeName: nextNode
                });
                await newPlayer.setVolume(saved.volume).catch(() => {});
                newPlayer.setLoop(saved.loop);
                await newPlayer.play(track, { replaceCurrent: true, position: saved.position, paused: saved.paused });
                if (queue.length) newPlayer.queue.add(queue);
            } catch (e) {
                console.error('[Failover] Error moviendo la canción a otro nodo:', e?.message || e);
                this.failover.delete(guildId);
                try {
                    const backup = await this.kazagumo.createPlayer({
                        guildId,
                        textId: saved.textId,
                        voiceId: saved.voiceId,
                        shardId: saved.shardId,
                        nodeName: this.getBestNode()
                    });
                    backup.queue.add([track, ...queue]);
                } catch {}
                if (channel) channel.send('❌ No pude mover la canción a otro nodo. La cola quedó guardada; prueba `>m fix`.').catch(() => {});
            } finally {
                this.failingOver.delete(guildId);
            }
        });
        this.kazagumo.shoukaku.on('disconnect', async (name, count) => {
            console.warn(`🔌 Nodo ${name} desconectado (${count} players afectados). Forzando failover...`);
            
            for (const player of this.kazagumo.players.values()) {
                if (player.shoukaku?.node?.name === name && !this.failingOver.has(player.guildId)) {
                    console.log(`[Failover] Moviendo player de ${player.guildId} por caída de nodo...`);
                    this.kazagumo.emit('playerException', player, { 
                        exception: { message: 'Nodo desconectado abruptamente' } 
                    });
                }
            }
        });
    }

    getPlayableNodes(excludeName) {
        const names = [];
        for (const [name, node] of this.kazagumo.shoukaku.nodes) {
            if (name === this.metadataNode || name === excludeName) continue;
            const isConnected = node.state === 1 || node.state === 'CONNECTED';
            if (isConnected && !this.failedNodes.has(name)) names.push(name);
        }
        return names;
    }

    waitForPlayback(guildId, timeoutMs = 8000) {
        return new Promise((resolve) => {
            const finish = (ok) => {
                clearTimeout(timer);
                this.kazagumo.off('playerStart', onStart);
                this.kazagumo.off('playerException', onFail);
                this.kazagumo.off('playerStuck', onFail);
                this.kazagumo.off('playerResolveError', onFail);
                resolve(ok);
            };
            const onStart = (player) => { if (player.guildId === guildId) finish(true); };
            const onFail = (player) => { if (player.guildId === guildId) finish(false); };
            const timer = setTimeout(() => finish(false), timeoutMs);
            this.kazagumo.on('playerStart', onStart);
            this.kazagumo.on('playerException', onFail);
            this.kazagumo.on('playerStuck', onFail);
            this.kazagumo.on('playerResolveError', onFail);
        });
    }

    async recreatePlayer(message, guild, member, forceDifferent = false) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player) return message.reply('❌ No hay música reproduciéndose.');
        if (!member.voice.channel) return message.reply('❌ Debes estar en un canal de voz.');

        const oldNode = player.shoukaku?.node?.name;
        const candidates = this.getPlayableNodes(forceDifferent ? oldNode : undefined).slice(0, 3);
        if (!candidates.length) {
            return message.reply(forceDifferent ? '❌ No hay otro nodo disponible ahora mismo.' : '❌ No hay nodos disponibles ahora mismo.');
        }

        const loading = await message.reply('🔄 Reiniciando el reproductor...');

        const current = player.queue.current;
        const queue = [...player.queue];
        const saved = {
            position: player.position || 0,
            volume: player.volume,
            loop: player.loop,
            paused: player.paused
        };

        const buildPlayer = async (nodeName) => {
            const options = {
                guildId: guild.id,
                textId: message.channel.id,
                voiceId: member.voice.channel.id,
                shardId: guild.shardId || 0,
                nodeName
            };
            const p = await this.kazagumo.createPlayer(options);
            await p.setVolume(saved.volume).catch(() => {});
            p.setLoop(saved.loop);
            return p;
        };

        this.failingOver.add(guild.id);

        try {
            await player.destroy();

            for (const nodeName of candidates) {
                try {
                    console.log(`[Music] Recreando player: ${oldNode || '?'} -> ${nodeName}`);
                    const newPlayer = await buildPlayer(nodeName);

                    if (!current) {
                        if (queue.length) newPlayer.queue.add(queue);
                        if (newPlayer.queue.totalSize) await newPlayer.play();
                        return loading.edit(`✅ Reproductor reiniciado en: \`${nodeName}\``);
                    }

                    const waiter = this.waitForPlayback(guild.id);
                    await newPlayer.play(current, { replaceCurrent: true, position: saved.position, paused: saved.paused });
                    const started = await waiter;

                    if (queue.length) newPlayer.queue.add(queue);

                    if (started) {
                        return loading.edit(`✅ Reproductor reiniciado en: \`${nodeName}\` (posición ${this.formatTime(saved.position)})`);
                    }
                    console.warn(`[Music] ${nodeName} no pudo reproducir, probando otro nodo...`);
                } catch (err) {
                    console.error(`[Music] Falló en ${nodeName}:`, err?.message || err);
                }
                await this.kazagumo.getPlayer(guild.id)?.destroy().catch(() => {});
            }

            const restored = await buildPlayer(candidates[0]);
            if (current) restored.queue.add(current);
            if (queue.length) restored.queue.add(queue);
            return loading.edit('⚠️ Ningún nodo pudo reproducir la canción. La cola quedó guardada; prueba `>m fix` más tarde.');
        } catch (e) {
            console.error('Error en recreatePlayer:', e);
            return loading.edit('❌ Error al reiniciar el reproductor. Revisa la consola.');
        } finally {
            this.failingOver.delete(guild.id);
        }
    }

    async reloadNodes(message, guild, member) {
        return this.recreatePlayer(message, guild, member, true);
    }

    async processCommand(message) {
        if (message.author.bot) return;
        const args = message.content.split(' ');
        const command = args[0].toLowerCase();

        if (['>m', '>musica', '>music'].includes(command)) {
            if (!args[1]) return this.showMusicHelp(message);
            const subcommand = args[1];
            const { member, channel, guild, author } = message;

            try {
                switch (subcommand) {
                    case 'play': case 'p': return await this.playCommand(message, args, member, channel, guild, author);
                    case 'stop': case 'leave': return await this.stopCommand(message, guild, member);
                    case 'skip': case 's': return await this.skipCommand(message, args, guild, member);
                    case 'pause': return await this.pauseCommand(message, guild, member);
                    case 'resume': case 'unpause': return await this.resumeCommand(message, guild, member);
                    case 'queue': case 'q': return await this.queueCommand(message, args, guild);
                    case 'nowplaying': case 'np': return await this.nowPlayingCommand(message, guild);
                    case 'ytsearch': case 'ys': return await this.searchCommand(message, args, member, channel, guild, author, 'youtube');
                    case 'spsearch': case 'ss': return await this.spotifySearchCommand(message, args, member, channel, guild, author);
                    case 'lyrics': case 'letra': return await this.lyricsCommand(message, args);
                    case 'fix': case 'restart': return await this.fixPlayerCommand(message, guild, member);
                    case 'seek': case 'adelantar': return await this.seekCommand(message, args, guild, member);
                    case 'volume': case 'vol': return await this.volumeCommand(message, args, guild, member);
                    case 'loop': case 'repeat': return await this.loopCommand(message, args, guild, member);
                    case 'shuffle': return await this.shuffleCommand(message, guild, member);
                    case 'clear': return await this.clearQueueCommand(message, guild, member);
                    case 'changenode': case 'reloadnode': return await this.reloadNodes(message, guild, member);
                    case 'statusnode': case 'statusnodos': return await this.nodesCommand(message, guild);
                    default: return await this.showMusicHelp(message);
                }
            } catch (error) {
                console.error('Error en comando de música:', error);
                await message.reply('❌ Ocurrió un error ejecutando el comando de música.').catch(() => {});
            }
        }
    }

    async playCommand(message, args, member, channel, guild, author) {
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Debes estar en un canal de voz.');
        if (!args[2]) return message.reply('❌ Proporciona el nombre de la canción.');

        let query = args.slice(2).join(' ');
        const loadingMsg = await message.reply(`🔍 Buscando... \`${query}\``);

        try {
            let player = this.kazagumo.getPlayer(guild.id);
            
            if (player && !this.kazagumo.shoukaku.nodes.get(player.shoukaku?.node?.name)) {
                console.log(`[Music] Player zombi detectado en ${guild.id}. Destruyendo...`);
                await this.forceDestroyPlayer(guild.id);
                player = null;
            }

            if (!player) {
                let bestNode = this.getBestNode();
                let waited = 0;
                while (!bestNode && waited < 10000) { // Esperar hasta 10 segundos
                    console.log(`[Music] Esperando nodo... (${waited / 1000}s)`);
                    await new Promise(r => setTimeout(r, 1000));
                    bestNode = this.getBestNode();
                    waited += 1000;
                }

                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        const finalNode = bestNode || this.getBestNode();
                        console.log(`[Music] Creando player en nodo: ${finalNode || 'Automático'}`);
                        
                        const options = {
                            guildId: guild.id,
                            textId: channel.id,
                            voiceId: voiceChannel.id,
                            shardId: guild.shardId || 0
                        };
                        
                        if (finalNode) options.nodeName = finalNode;

                        player = await this.kazagumo.createPlayer(options);
                        break;
                    } catch (err) {
                        console.error(`[play] createPlayer falló (intento ${attempt}):`, err?.status, err?.message);
                        try { await this.kazagumo.getPlayer(guild.id)?.destroy(); } catch {}
                        if (attempt === 3) throw err;
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            }

            this.clearPlayerTimeout(guild.id);

            let result;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const bestNode = this.getBestNode();                    
                    const searchOpts = { requester: author };
                    if (bestNode) searchOpts.nodeName = bestNode;

                    result = await this.searchWithTimeout(query, searchOpts);
                    break;
                } catch (err) {
                    console.error(`[play] Búsqueda falló (intento ${attempt}):`, err.message);
                    if (attempt === 3) throw err;
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                }
            }

            if (!result || !result.tracks.length) return loadingMsg.edit('❌ No se encontraron resultados.');

            if (result.type === 'PLAYLIST') {
                player.queue.add(result.tracks);
                await loadingMsg.edit({
                    embeds: [new EmbedBuilder().setTitle('📂 Playlist Agregada')
                        .setDescription(`**${result.playlistName}**\n${result.tracks.length} canciones agregadas`)
                        .setColor('#00FF00')]
                });
            } else {
                player.queue.add(result.tracks[0]);
                await loadingMsg.edit({
                    embeds: [new EmbedBuilder().setTitle('🎵 Canción Agregada')
                        .setDescription(`**${result.tracks[0].title}**\nDuración: ${this.formatTime(result.tracks[0].length)}`)
                        .setThumbnail(result.tracks[0].thumbnail || null)
                        .setColor('#00FF00')]
                });
            }

            if (!player.playing && !player.paused) {
                try {
                    await player.play();
                } catch (e) {
                    console.error('Error al iniciar play:', e.message);
                    await loadingMsg.edit('❌ Se agregó la canción, pero el servidor de música falló al intentar reproducirla. Intenta usar `>m fix` o elige otra canción.');
                }
            }
        } catch (error) {
            console.error('Error en play command:', error);
            await loadingMsg.edit('❌ Ocurrió un error al reproducir la música.');
        }
    }

    async searchCommand(message, args, member, channel, guild, author, engine) {
        const query = args.slice(2).join(' ').trim();
        if (!query) return message.reply(`❌ Escribe algo para buscar.\nEjemplo: \`>m ytsearch la lagartija\``);

        const loadingMsg = await message.reply(`🔍 Buscando **${query}**...`);

        try {
            let result;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const bestNode = this.getBestNode();                    
                    console.log(`[Music] >m ytsearch intentando usar el nodo: ${bestNode || 'Automático'}`);
                    const searchOpts = { requester: author, engine };
                    if (bestNode) searchOpts.nodeName = bestNode;
                    
                    result = await this.searchWithTimeout(query, searchOpts);
                    break;
                } catch (err) {
                    console.error(`[${engine}] Búsqueda falló (intento ${attempt}):`, err.message);
                    if (attempt === 3) throw err;
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                }
            }
            if (!result || !result.tracks.length) return loadingMsg.edit('❌ No se encontraron resultados.');

            const tracks = result.tracks.slice(0, 7);
            const embed = new EmbedBuilder()
                .setTitle(`🎬 ${engine === 'spsearch:' ? 'Spotify' : 'YouTube'} — Resultados para "${query}"`)
                .setColor('#FF0000')
                .setDescription(tracks.map((t, i) => `\`${i + 1}.\` **${t.title}**\n└ ${this.formatTime(t.length)} • ${t.author || 'Desconocido'}`).join('\n\n'))
                .setFooter({ text: 'Selecciona una canción para ver detalles o reproducir' });

            const row1 = new ActionRowBuilder().addComponents(
                tracks.slice(0, 4).map((_, i) => new ButtonBuilder().setCustomId(`msearch_${i}_${message.author.id}_${guild.id}`).setLabel(`${i + 1}`).setStyle(ButtonStyle.Primary))
            );
            const row2 = new ActionRowBuilder().addComponents([
                ...tracks.slice(4).map((_, i) => new ButtonBuilder().setCustomId(`msearch_${i + 4}_${message.author.id}_${guild.id}`).setLabel(`${i + 5}`).setStyle(ButtonStyle.Primary)),
                new ButtonBuilder().setCustomId(`msearch_cancel_${message.author.id}_${guild.id}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
            ]);

            const searchMsg = await loadingMsg.edit({ content: '', embeds: [embed], components: [row1, row2] });

            this.searchSessions.set(`${message.author.id}_${guild.id}`, {
                tracks, member, channel, guild, author, engine, embed, row1, row2, timestamp: Date.now()
            });

        } catch (error) {
            console.error('Error en searchCommand:', error);
            await loadingMsg.edit('❌ Error al buscar. Intenta más tarde.');
        }
    }

    async spotifySearchCommand(message, args, member, channel, guild, author) {
        const query = args.slice(2).join(' ').trim();
        if (!query) return message.reply('❌ Escribe algo para buscar.\nEjemplo: `>m spsearch la lagartija`');

        const loadingMsg = await message.reply(`🔍 Buscando en Spotify **${query}**...`);

        try {
            let result = null;
            const candidates = this.getSpotifyNodeCandidates().slice(0, 3);
            if (!candidates.length) return loadingMsg.edit('❌ No hay nodos disponibles ahora mismo. Intenta en unos segundos.');

            for (const nodeName of candidates) {
                try {
                    console.log(`[Music] >m spsearch intentando en nodo: ${nodeName}`);
                    const res = await this.searchWithTimeout(query, { requester: author, source: 'spsearch:', nodeName }, 6000);
                    if (res && res.tracks && res.tracks.length) { result = res; break; }
                    console.warn(`[spsearch] ${nodeName} no devolvió resultados`);
                } catch (err) {
                    console.error(`[spsearch] ${nodeName} falló:`, err.message);
                }
            }
            
            if (!result || !result.tracks.length) return loadingMsg.edit('❌ No pude buscar en Spotify ahora mismo (el servidor de Spotify no responde). Usa `>m play` o `>m ytsearch`.');

            const tracks = result.tracks.slice(0, 7);
            const embed = new EmbedBuilder()
                .setTitle(`🟢 Spotify — Resultados para "${query}"`)
                .setColor('#1DB954')
                .setDescription(tracks.map((t, i) => `\`${i + 1}.\` **${t.title}**\n└ ${this.formatTime(t.length)} • ${t.author || 'Desconocido'}`).join('\n\n'))
                .setThumbnail(tracks[0]?.thumbnail || null)
                .setFooter({ text: 'Selecciona una canción para ver detalles o reproducir' });

            const row1 = new ActionRowBuilder().addComponents(
                tracks.slice(0, 4).map((_, i) => new ButtonBuilder().setCustomId(`msp_${i}_${message.author.id}_${guild.id}`).setLabel(`${i + 1}`).setStyle(ButtonStyle.Success))
            );
            const row2 = new ActionRowBuilder().addComponents([
                ...tracks.slice(4).map((_, i) => new ButtonBuilder().setCustomId(`msp_${i + 4}_${message.author.id}_${guild.id}`).setLabel(`${i + 5}`).setStyle(ButtonStyle.Success)),
                new ButtonBuilder().setCustomId(`msp_cancel_${message.author.id}_${guild.id}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
            ]);

            await loadingMsg.edit({ content: '', embeds: [embed], components: [row1, row2] });

            this.spotifySearchSessions.set(`${message.author.id}_${guild.id}`, {
                tracks, member, channel, guild, author, embed, row1, row2, timestamp: Date.now()
            });

        } catch (error) {
            console.error('Error en spotifySearchCommand:', error);
            await loadingMsg.edit('❌ Error al buscar en Spotify. Asegúrate de que tu Lavalink propio tenga configurado el plugin de Spotify.');
        }
    }

    async handleSearchInteraction(interaction) {
        try {
            await interaction.deferUpdate().catch(() => {});
            
            const customId = interaction.customId;
            const parts = customId.split('_');

            let userId, guildId;
            if (customId.startsWith('mback_') || customId.startsWith('mspback_')) {
                userId = parts[1]; guildId = parts[2];
            } else {
                userId = parts[2]; guildId = parts[3];
            }

            if (interaction.user.id !== userId) return interaction.followUp({ content: '❌ Este menú no es tuyo.', ephemeral: true });

            if (customId.startsWith('mq_')) {
                const session = this.queuePages.get(`${userId}_${guildId}`);
                if (!session) return interaction.editReply({ content: '❌ Sesión expirada.', embeds: [], components: [] });

                if (customId.startsWith('mq_close_')) {
                    this.queuePages.delete(`${userId}_${guildId}`);
                    return interaction.editReply({ content: '❌ Vista cerrada.', embeds: [], components: [] });
                }

                const player = this.kazagumo.getPlayer(guildId);
                if (!player || !player.queue.current) {
                    this.queuePages.delete(`${userId}_${guildId}`);
                    return interaction.editReply({ content: '❌ No hay música reproduciéndose.', embeds: [], components: [] });
                }

                let newPage = session.page;
                if (customId.startsWith('mq_prev_')) newPage--;
                if (customId.startsWith('mq_next_')) newPage++;

                const current = player.queue.current;
                const songs = player.queue.slice(0, player.queue.size);
                const totalPages = Math.max(1, Math.ceil(songs.length / session.songsPerPage));
                newPage = Math.min(Math.max(1, newPage), totalPages);

                const { embed } = this.buildQueueEmbed(player, songs, current, newPage, session.songsPerPage, interaction.user);

                session.page = newPage;
                session.songs = songs;
                session.current = current;
                session.timestamp = Date.now();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`mq_prev_${userId}_${guildId}`).setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(newPage <= 1),
                    new ButtonBuilder().setCustomId(`mq_close_${userId}_${guildId}`).setEmoji('❌').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`mq_next_${userId}_${guildId}`).setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(newPage >= totalPages),
                );

                return interaction.editReply({ embeds: [embed], components: totalPages > 1 ? [row] : [] });
            }
            
            try {
                const disabledRows = interaction.message.components.map(row => {
                    const builder = ActionRowBuilder.from(row);
                    builder.components.forEach(c => c.setDisabled(true));
                    return builder;
                });
                await interaction.message.edit({ components: disabledRows });
            } catch (e) {
            }

            if (customId.startsWith('msp_') || customId.startsWith('mspplay_') || customId.startsWith('mspback_')) {
                const session = this.spotifySearchSessions.get(`${userId}_${guildId}`);
                if (!session) return interaction.editReply({ content: '❌ Sesión expirada.', embeds: [], components: [] });

                if (customId.includes('cancel')) {
                    this.spotifySearchSessions.delete(`${userId}_${guildId}`);
                    return interaction.editReply({ content: '❌ Búsqueda cancelada.', embeds: [], components: [] });
                }
                if (customId.startsWith('mspback_')) return interaction.editReply({ embeds: [session.embed], components: [session.row1, session.row2] });

                if (customId.startsWith('mspplay_')) {
                    const index = parseInt(parts[1]);
                    const selected = session.tracks[index];
                    const voiceChannel = interaction.member.voice.channel;
                    if (!voiceChannel) return interaction.editReply({ content: '❌ Debes estar en un canal de voz.', embeds: [], components: [] });

                    let player = this.kazagumo.getPlayer(guildId);
                    if (!player) {
                        const bestNode = this.getBestNode();
                        const options = { guildId, textId: interaction.channelId, voiceId: voiceChannel.id, shardId: interaction.guild.shardId || 0 };
                        if (bestNode) options.nodeName = bestNode;
                        player = await this.kazagumo.createPlayer(options);
                    }

                    this.clearPlayerTimeout(guildId);
                    const playNode = this.getBestNode();
                    const found = await this.searchWithTimeout(
                        `${selected.title} ${selected.author || ''}`.trim(),
                        { requester: session.author, ...(playNode ? { nodeName: playNode } : {}) }
                    ).catch(() => null);
                    if (!found || !found.tracks.length) {
                        return interaction.editReply({ content: '❌ No encontré esa canción para reproducir.', embeds: [], components: [] });
                    }
                    player.queue.add(found.tracks[0]);
                    if (!player.playing && !player.paused) await player.play().catch(() => {});

                    this.spotifySearchSessions.delete(`${userId}_${guildId}`);
                    return interaction.editReply({ content: '', embeds: [new EmbedBuilder().setTitle('✅ Canción Agregada').setDescription(`**${selected.title}**`).setColor('#1DB954')], components: [] });
                }

                const index = parseInt(parts[1]);
                const track = session.tracks[index];
                const detailEmbed = new EmbedBuilder()
                    .setTitle('🟢 Canción de Spotify')
                    .setColor('#1DB954')
                    .setThumbnail(track.thumbnail || null)
                    .addFields(
                        { name: '🎵 Título', value: track.title || 'Desconocido', inline: false },
                        { name: '👤 Artista', value: track.author || 'Desconocido', inline: true },
                        { name: '⏱️ Duración', value: this.formatTime(track.length), inline: true }
                    );

                const playRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`mspplay_${index}_${userId}_${guildId}`).setLabel('▶️ Reproducir').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`mspback_${userId}_${guildId}`).setLabel('⬅️ Volver').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`msp_cancel_${userId}_${guildId}`).setLabel('❌ Cerrar').setStyle(ButtonStyle.Danger)
                );
                return interaction.editReply({ embeds: [detailEmbed], components: [playRow] });
            }

            const session = this.searchSessions.get(`${userId}_${guildId}`);
            if (!session) return interaction.editReply({ content: '❌ Sesión expirada.', embeds: [], components: [] });

            if (customId.includes('cancel')) {
                this.searchSessions.delete(`${userId}_${guildId}`);
                return interaction.editReply({ content: '❌ Búsqueda cancelada.', embeds: [], components: [] });
            }
            if (customId.startsWith('mback_')) return interaction.editReply({ embeds: [session.embed], components: [session.row1, session.row2] });

            if (customId.startsWith('mplay_')) {
                const index = parseInt(parts[1]);
                const selected = session.tracks[index];
                const voiceChannel = interaction.member.voice.channel;
                if (!voiceChannel) return interaction.editReply({ content: '❌ Debes estar en un canal de voz.', embeds: [], components: [] });

                let player = this.kazagumo.getPlayer(guildId);
                if (!player) {
                    const bestNode = this.getBestNode();
                    const options = { guildId, textId: interaction.channelId, voiceId: voiceChannel.id, shardId: interaction.guild.shardId || 0 };
                    if (bestNode) options.nodeName = bestNode;
                    player = await this.kazagumo.createPlayer(options);
                }

                this.clearPlayerTimeout(guildId);
                player.queue.add(selected);
                if (!player.playing && !player.paused) await player.play().catch(() => {});

                this.searchSessions.delete(`${userId}_${guildId}`);
                return interaction.editReply({ content: '', embeds: [new EmbedBuilder().setTitle('✅ Canción Agregada').setDescription(`**${selected.title}**`).setColor('#00FF00')], components: [] });
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
                        { name: '⏱️ Duración', value: this.formatTime(selected.length), inline: true }
                    );

                const playRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`mplay_${index}_${userId}_${guildId}`).setLabel('▶️ Reproducir').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`mback_${userId}_${guildId}`).setLabel('⬅️ Volver').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`msearch_cancel_${userId}_${guildId}`).setLabel('❌ Cerrar').setStyle(ButtonStyle.Danger)
                );
                return interaction.editReply({ embeds: [detailEmbed], components: [playRow] });
            }

        } catch (e) {
            console.error('Error en handleSearchInteraction:', e);
            interaction.editReply({ content: '❌ Error procesando la interacción.', embeds: [], components: [] }).catch(() => {});
        }
    }

    async stopCommand(message, guild, member) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player) return message.reply('❌ No hay música reproduciéndose.');
        if (!member.voice.channel) return message.reply('❌ Debes estar en un canal de voz.');
        await player.destroy();
        this.clearPlayerTimeout(guild.id);
        await message.reply({ embeds: [new EmbedBuilder().setTitle('⏹️ Música Detenida').setDescription('El bot se ha desconectado.').setColor('#FF0000')] });
    }

    async skipCommand(message, args, guild, member) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player) return message.reply('❌ No hay música reproduciéndose.');
        if (!member.voice.channel) return message.reply('❌ Debes estar en un canal de voz.');

        const amount = parseInt(args[2]) || 1;
        const currentTrack = player.queue.current;

        if (currentTrack.requester?.id === member.id || member.permissions.has('MoveMembers')) {
            for (let i = 0; i < amount - 1; i++) player.queue.splice(0, 1);
            player.skip();
            return message.reply({ embeds: [new EmbedBuilder().setTitle('⏭️ Saltada').setDescription(`Se saltaron ${amount} canciones.`).setColor('#FFA500')] });
        }

        const membersInVC = member.voice.channel.members.filter(m => !m.user.bot).size;
        if (membersInVC <= 2) {
            player.skip();
            return message.reply({ embeds: [new EmbedBuilder().setTitle('⏭️ Saltada').setDescription('Saltada automáticamente (pocos oyentes).').setColor('#FFA500')] });
        }

        let voteData = this.skipVotes.get(guild.id);
        if (!voteData || voteData.trackId !== currentTrack.identifier) {
            voteData = { trackId: currentTrack.identifier, voters: new Set() };
            this.skipVotes.set(guild.id, voteData);
        }

        if (voteData.voters.has(member.id)) return message.reply(`🗳️ Ya votaste. Votos: **${voteData.voters.size}/${Math.ceil(membersInVC / 2)}**`);
        voteData.voters.add(member.id);

        if (voteData.voters.size >= Math.ceil(membersInVC / 2)) {
            this.skipVotes.delete(guild.id);
            player.skip();
            return message.reply({ embeds: [new EmbedBuilder().setTitle('⏭️ Saltada').setDescription('Saltada por votación.').setColor('#FFA500')] });
        }

        await message.reply({ embeds: [new EmbedBuilder().setTitle('🗳️ Voto Registrado').setDescription(`Votos: **${voteData.voters.size}/${Math.ceil(membersInVC / 2)}**`).setColor('#FFA500')] });
    }

    async pauseCommand(message, guild, member) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player || player.paused) return message.reply('❌ No hay música o ya está pausada.');
        if (!member.voice.channel) return message.reply('❌ Debes estar en un canal de voz.');
        player.pause(true);
        await message.reply({ embeds: [new EmbedBuilder().setTitle('⏸️ Pausada').setColor('#FFA500')] });
    }

    async resumeCommand(message, guild, member) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player || !player.paused) return message.reply('❌ No hay música pausada.');
        if (!member.voice.channel) return message.reply('❌ Debes estar en un canal de voz.');
        player.pause(false);
        await message.reply({ embeds: [new EmbedBuilder().setTitle('▶️ Reanudada').setColor('#00FF00')] });
    }

    buildQueueEmbed(player, songs, current, page, songsPerPage, author) {
        const totalSongs = songs.length;
        const totalPages = Math.max(1, Math.ceil(totalSongs / songsPerPage));
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        const start = (page - 1) * songsPerPage;
        const pageSongs = songs.slice(start, start + songsPerPage);

        const truncate = (str, max) => (str.length > max ? str.slice(0, max - 1) + '…' : str);
        const fmt = (ms) => this.formatTime(ms);

        const progressBar = (pos, total) => {
            const size = 12;
            if (!total || total <= 0) return '🔴 **EN VIVO**';
            const filled = Math.min(size, Math.round((pos / total) * size));
            return '▬'.repeat(filled) + '🔘' + '▬'.repeat(Math.max(0, size - filled - 1));
        };

        const loopEmoji =
            player.loop === 'none' ? '➡️ Off'
            : player.loop === 'track' ? '🔂 Canción'
            : '🔁 Cola';

        const totalDuration = songs.reduce((acc, t) => acc + (t.length || 0), 0) + (current.length || 0);

        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('📋 Cola de Reproducción')
            .setThumbnail(current.thumbnail || null)
            .setFooter({
                text: `Página ${page}/${totalPages} • ${author.username}`,
                iconURL: author.displayAvatarURL({ dynamic: true }),
            })
            .setTimestamp();

        embed.addFields({
            name: '🎵 Reproduciendo Ahora',
            value: [
                `**${truncate(current.title, 60)}**`,
                progressBar(player.position, current.length),
                `\`${fmt(player.position)} / ${fmt(current.length)}\` • 👤 ${current.requester?.username || 'Desconocido'}`,
            ].join('\n'),
            inline: false,
        });

        const node = player.shoukaku?.node;
        const nodeName = node?.name || 'Desconocido';
        const nodeState = node?.state;
        const nodeEmoji = (nodeState === 1 || nodeState === 'CONNECTED') ? '🟢' : '🔴';

        embed.addFields({
            name: '🖥️ Servidor de Música',
            value: `${nodeEmoji} \`${nodeName}\``,
            inline: false,
        });

        if (totalSongs === 0) {
            embed.addFields({
                name: '⏳ Próximas Canciones',
                value: '*La cola está vacía, usa `>m play <canción>` para agregar más.*',
                inline: false,
            });
        } else {
            const list = pageSongs.map((t, i) =>
                `\`${(start + i + 1).toString().padStart(2, '0')}.\` ${truncate(t.title, 48)} \`[${fmt(t.length)}]\``
            ).join('\n');
            embed.addFields({
                name: `⏳ Próximas Canciones (${totalSongs})`,
                value: list,
                inline: false,
            });
        }

        embed.addFields(
            { name: '🔊 Volumen', value: `\`${player.volume}%\``, inline: true },
            { name: '🔄 Loop', value: loopEmoji, inline: true },
            { name: '⏱️ Total', value: `\`${fmt(totalDuration)}\``, inline: true }
        );

        return { embed, page, totalPages };
    }

    async queueCommand(message, args, guild) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player || !player.queue.current) return message.reply('❌ No hay música en la cola.');

        const current = player.queue.current;
        const songs = player.queue.slice(0, player.queue.size);
        const songsPerPage = 10;
        let page = parseInt(args[2]) || 1;

        const { embed, totalPages } = this.buildQueueEmbed(player, songs, current, page, songsPerPage, message.author);

        const sessionKey = `${message.author.id}_${guild.id}`;
        this.queuePages.set(sessionKey, {
            player, songs, current, page, totalPages, songsPerPage, timestamp: Date.now(),
        });

        let components = [];
        if (totalPages > 1) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`mq_prev_${message.author.id}_${guild.id}`).setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
                new ButtonBuilder().setCustomId(`mq_close_${message.author.id}_${guild.id}`).setEmoji('❌').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`mq_next_${message.author.id}_${guild.id}`).setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages),
            );
            components.push(row);
        }

        await message.reply({ embeds: [embed], components });
    }

    async nodesCommand(message, guild) {
        const allNodes = [...this.kazagumo.shoukaku.nodes.values()];
        if (!allNodes.length) return message.reply('❌ No hay nodos registrados.');

        const processingMsg = await message.reply('⚙️ Cargando estado de los nodos...');
        const emojis = ['⏳', '⌛', '🔄', '⚙️'];
        let emojiIndex = 0;
        
        const emojiInterval = setInterval(() => {
            emojiIndex = (emojiIndex + 1) % emojis.length;
            processingMsg.edit(`${emojis[emojiIndex]} Cargando estado de los nodos...`).catch(() => {});
        }, 1500);

        try {
            const isUp = (n) => n?.state === 1 || n?.state === 'CONNECTED';
            const isMetadata = (n) => n.name === this.metadataNode;

            const measurePing = async (node) => {
                const direct = node?.ping ?? node?.stats?.ping;
                if (typeof direct === 'number' && direct > 0) return direct;

                try {
                    let raw = String(node?.url || '');
                    raw = raw.replace(/^(wss?|https?):\/\//i, '');
                    raw = raw.replace(/\/v4\/websocket\/?$/i, '');
                    raw = raw.replace(/\/+$/, '');
                    if (!raw) return null;

                    const portMatch = raw.match(/:(\d+)$/);
                    const port = portMatch ? parseInt(portMatch[1]) : null;
                    const useHttps = !!node.secure || port === 443;
                    let hostPort = raw;
                    if (useHttps && port === 443) hostPort = raw.replace(/:443$/, '');

                    const proto = useHttps ? 'https' : 'http';
                    const endpoints = [`${proto}://${hostPort}/version`, `${proto}://${hostPort}/v4/info`];

                    for (const url of endpoints) {
                        const ping = await new Promise((resolve) => {
                            const mod = useHttps ? https : http;
                            const start = Date.now();
                            
                            const req = mod.get(url, {
                                headers: {
                                    'Authorization': node.auth || '',
                                    'User-Agent': 'Mozilla/5.0 (compatible; Pibot/1.0)',
                                    'Accept': 'application/json',
                                },
                                rejectUnauthorized: false,
                                timeout: 3000,
                            }, (res) => {
                                res.resume();
                                if (res.statusCode >= 200 && res.statusCode < 300) resolve(Date.now() - start);
                                else resolve(null);
                            });
                            
                            req.on('error', () => resolve(null));
                            req.on('timeout', () => { req.destroy(); resolve(null); });
                        });

                        if (ping !== null) return ping;
                    }
                    return null;
                } catch {
                    return null;
                }
            };

            const getPlayers = (n) => {
                const s = n?.stats;
                if (!s || typeof s.players !== 'number' || typeof s.playingPlayers !== 'number') return null;
                return { total: s.players, playing: s.playingPlayers };
            };

            const pingMap = new Map();
            await Promise.all(
                allNodes.filter(n => isUp(n) && !isMetadata(n)).map(async (n) => pingMap.set(n.name, await measurePing(n)))
            );

            const player = this.kazagumo.getPlayer(guild.id);
            const currentPlayerNode = player?.shoukaku?.node?.name;

            const upNodes = allNodes.filter(isUp).sort((a, b) => {
                const aMeta = isMetadata(a);
                const bMeta = isMetadata(b);
                if (aMeta !== bMeta) return aMeta ? 1 : -1;
                return (pingMap.get(a.name) ?? 99999) - (pingMap.get(b.name) ?? 99999);
            });
            const downNodes = allNodes.filter(n => !isUp(n));

            const nonMetadataUp = upNodes.filter(n => !isMetadata(n));
            const fastest = nonMetadataUp.reduce((best, n) => {
                const p = pingMap.get(n.name);
                if (p == null) return best;
                if (!best || p < best.ping) return { name: n.name, ping: p };
                return best;
            }, null);

            const embed = new EmbedBuilder()
                .setTitle('🖥️ Estado de los Nodos')
                .setColor(upNodes.length > 0 ? '#00FF00' : '#FF0000')
                .setFooter({ text: `Total: ${allNodes.length} • Online: ${upNodes.length} • Offline: ${downNodes.length}` })
                .setTimestamp();

            if (upNodes.length > 0) {
                const list = upNodes.map(n => {
                    const tags = [];
                    if (n.name === currentPlayerNode) tags.push('🎵 *aquí*');
                    if (isMetadata(n)) tags.push('⚙️ *metadata*');

                    const parts = [];
                    if (tags.length) parts.push(tags.join(' · '));

                    if (!isMetadata(n)) {
                        const ping = pingMap.get(n.name);
                        if (ping != null) parts.push(`\`${ping}ms\``);
                        const players = getPlayers(n);
                        if (players) parts.push(`👥 \`${players.playing}/${players.total}\``);
                    }

                    const crown = fastest && n.name === fastest.name ? '🏆 ' : '';
                    return `${crown}🟢 **${n.name}**${parts.length ? ' — ' + parts.join(' · ') : ''}`;
                }).join('\n');
                embed.addFields({ name: `✅ Conectados (${upNodes.length})`, value: list, inline: false });
            }

            if (downNodes.length > 0) {
                const list = downNodes.map(n => {
                    const failed = this.failedNodes.has(n.name);
                    return `🔴 **${n.name}**${failed ? ' *(fallando)*' : ''}`;
                }).join('\n');
                embed.addFields({ name: `❌ Caídos (${downNodes.length})`, value: list, inline: false });
            }

            if (currentPlayerNode) {
                embed.addFields({ name: '🎵 Tu Reproductor', value: `Corriendo en: \`${currentPlayerNode}\``, inline: false });
            }

            clearInterval(emojiInterval);
            await processingMsg.edit({ content: '', embeds: [embed] });
        } catch (error) {
            clearInterval(emojiInterval);
            console.error('❌ Error en nodesCommand:', error);
            await processingMsg.edit('❌ Ocurrió un error al cargar el estado de los nodos.').catch(() => {});
        }
    }

    async nowPlayingCommand(message, guild) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player || !player.queue.current) return message.reply('❌ No hay música reproduciéndose.');
        const track = player.queue.current;
        await message.reply({ embeds: [new EmbedBuilder().setTitle('🎵 Reproduciendo Ahora').setDescription(`**${track.title}**`).setThumbnail(track.thumbnail || null).addFields({ name: '⏱️ Duración', value: this.formatTime(track.length), inline: true }, { name: '📍 Posición', value: this.formatTime(player.position), inline: true }, { name: '🔊 Volumen', value: `${player.volume}%`, inline: true }).setColor('#00FF00')] });
    }

    async volumeCommand(message, args, guild, member) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player) return message.reply('❌ No hay música reproduciéndose.');

        if (!this.kazagumo.shoukaku.nodes.get(player.shoukaku?.node?.name)) {
            await this.forceDestroyPlayer(guild.id);
            return message.reply('❌ El reproductor se desconectó (Nodo caído). Ya limpié la memoria, prueba `>m play` de nuevo.');
        }

        if (!args[2]) return message.reply(`🔊 Volumen actual: **${player.volume}%**`);
        if (!member.voice.channel) return message.reply('❌ Debes estar en un canal de voz.');
        const volume = parseInt(args[2]);
        if (isNaN(volume) || volume < 1 || volume > 100) return message.reply('❌ El volumen debe ser entre 1 y 100.');
        player.setVolume(volume);
        await message.reply({ embeds: [new EmbedBuilder().setTitle('🔊 Volumen').setDescription(`Volumen a **${volume}%**`).setColor('#0099FF')] });
    }

    async loopCommand(message, args, guild, member) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player) return message.reply('❌ No hay música reproduciéndose.');
        if (!member.voice.channel) return message.reply('❌ Debes estar en un canal de voz.');
        let newLoop = args[2]?.toLowerCase();
        if (newLoop === 'off') newLoop = 'none';
        if (!['track', 'queue', 'none'].includes(newLoop)) newLoop = player.loop === 'none' ? 'track' : 'none';
        player.setLoop(newLoop);
        switch (newLoop) {
            case 'track':
                newLoop = 'Repetir Canción';
                break;
            case 'queue':
                newLoop = 'Repetir Cola';
                break;
            case 'none':
                newLoop = 'Sin Repetición';
                break;
            default:
                newLoop = 'Modo Desconocido';
        }
        await message.reply({ embeds: [new EmbedBuilder().setTitle('🔄 Loop').setDescription(`Modo: **${newLoop}**`).setColor('#0099FF')] });
    }

    async shuffleCommand(message, guild, member) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player || player.queue.size < 2) return message.reply('❌ No hay suficientes canciones para mezclar.');
        if (!member.voice.channel) return message.reply('❌ Debes estar en un canal de voz.');
        player.queue.shuffle();
        await message.reply({ embeds: [new EmbedBuilder().setTitle('🔀 Mezclada').setDescription(`Se mezclaron **${player.queue.size}** canciones.`).setColor('#0099FF')] });
    }

    async clearQueueCommand(message, guild, member) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player || player.queue.size === 0) return message.reply('❌ La cola ya está vacía.');
        if (!member.voice.channel) return message.reply('❌ Debes estar en un canal de voz.');
        const count = player.queue.size;
        player.queue.clear();
        await message.reply({ embeds: [new EmbedBuilder().setTitle('🗑️ Limpiada').setDescription(`Se eliminaron **${count}** canciones.`).setColor('#FF0000')] });
    }

    async fixPlayerCommand(message, guild, member) {
        return this.recreatePlayer(message, guild, member, false);
    }

    async seekCommand(message, args, guild, member) {
        const player = this.kazagumo.getPlayer(guild.id);
        if (!player || !player.queue.current) return message.reply('❌ No hay música reproduciéndose.');
        if (!args[2]) return message.reply('❌ Especifica el tiempo (ej: `1:30` o `+30`).');
        if (!member.voice.channel) return message.reply('❌ Debes estar en un canal de voz.');
        const input = args[2]; let target = 0;
        if (input.startsWith('+') || input.startsWith('-')) target = player.position + (parseInt(input) * 1000);
        else if (input.includes(':')) { const [min, sec] = input.split(':').map(Number); target = (min * 60 + sec) * 1000; }
        else target = parseInt(input) * 1000;
        if (isNaN(target)) return message.reply('❌ Tiempo inválido. Ejemplo: `1:30` o `+30`.');
        if (target < 0 || target > player.queue.current.length) return message.reply('❌ Tiempo fuera de los límites.');
        player.seek(target);
        await message.reply({ embeds: [new EmbedBuilder().setTitle('⏩ Adelantado').setDescription(`Posición: **${this.formatTime(target)}**`).setColor('#0099FF')] });
    }

    async lyricsCommand(message, args) {
        const query = args.slice(2).join(' ').trim();
        if (!query) return message.reply('❌ Escribe el nombre de la canción.');
        const loadingMsg = await message.reply(`🔍 Buscando letra de **${query}**...`);

        try {
            const lrclibRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(8000) });
            if (lrclibRes.ok) {
                const results = await lrclibRes.json();
                if (results.length > 0) {
                    const song = results[0];
                    let lyrics = song.plainLyrics || song.syncedLyrics;
                    if (lyrics) {
                        lyrics = lyrics.replace(/\[\d+:\d+\.\d+\]/g, '').trim();
                        const lines = lyrics.split('\n'); const chunks = []; let currentChunk = '';
                        for (const line of lines) {
                            if ((currentChunk + '\n' + line).length > 1900) { if (currentChunk) chunks.push(currentChunk.trim()); currentChunk = line; } 
                            else currentChunk += (currentChunk ? '\n' : '') + line;
                        }
                        if (currentChunk) chunks.push(currentChunk.trim());
                        
                        const embed = new EmbedBuilder().setTitle(`🎵 ${song.trackName}`).setDescription(chunks[0] + '\n\u200b').setColor('#9932CC').addFields({ name: '👤 Artista', value: song.artistName, inline: true }, { name: '📖 Fuente', value: 'lrclib', inline: true });
                        if (chunks.length > 1) embed.setFooter({ text: `Página 1/${chunks.length}` });
                        
                        return loadingMsg.edit({ content: '', embeds: [embed] });
                    }
                }
            }
            await loadingMsg.edit(`❌ No se encontró la letra.\nIntenta con: \`>m lyrics Artista - Canción\``);
        } catch (e) {
            await loadingMsg.edit('❌ Error buscando la letra.');
        }
    }

    async showMusicHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('🎵 Sistema de Música')
            .setColor('#9932CC')
            .setDescription('Usa `>m <comando>` para controlar la música.\nDebes estar en un canal de voz.')
            .addFields(
                { 
                    name: '▶️ Reproducción', 
                    value: '`>m play <canción/URL>`\n`>m ytsearch <canción>`\n`>m spsearch <canción>`\n`>m lyrics <artista - canción>`', 
                    inline: true 
                },
                { 
                    name: '⏯️ Controles', 
                    value: '`>m pause` / `>m resume`\n`>m skip [cantidad]`\n`>m stop`', 
                    inline: true 
                },
                { 
                    name: '⚙️ Ajustes', 
                    value: '`>m volume <1-100>`\n`>m loop <track/queue/off>`\n`>m seek <tiempo>`', 
                    inline: true 
                },
                { 
                    name: '📋 Cola', 
                    value: '`>m queue [página]`\n`>m shuffle`\n`>m clear`', 
                    inline: true 
                },
                {
                    name: '🛠️ Herramientas',
                    value:
                        '`>m fix` (Reiniciar player)\n' +
                        '`>m changenode` (Cambiar de servidor)\n' +
                        '`>m statusnode` (Ver estado de nodos)',
                    inline: true
                },
            )
            .setFooter({ text: 'Pibot Music • Servidores públicos (pueden fallar)' });

        await message.reply({ embeds: [embed] });
    }
}

module.exports = MusicSystem;