const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');

class MusicSystem {
    constructor(client) {
        this.client = client;
        this.kazagumo = null;
        this.playerTimeouts = new Map();
        this.maxSongDuration = 2 * 60 * 60 * 1000; // 2 horas en ms
        this.initialize();
    }

    initialize() {
        const nodes = [
            { name: 'Node1', url: 'lavalink.jirayu.net:13592', auth: 'youshallnotpass', secure: false },
            { name: 'Node2', url: 'lavalink.clxud.dev:2333', auth: 'youshallnotpass', secure: false },
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
            nodes
        );

        // Asignar kazagumo al cliente para acceso global
        this.client.kazagumo = this.kazagumo;

        this.kazagumo.shoukaku.on('ready', (name) => {
            console.log(`✅ Nodo [${name}] conectado!`);
        });

        // Event listeners
        this.setupEventListeners();
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

        this.kazagumo.on('playerEnd', (player, track, reason) => {
            // Verificar si terminó naturalmente (no por skip)
            if (reason !== 'REPLACED' && player.queue.size > 0) {
                // La cola ya se movió automáticamente, solo reproducir
                setTimeout(() => {
                    if (player.queue.current && !player.playing) {
                        player.play();
                    }
                }, 100); // Pequeño delay para asegurar que la cola se actualizó
            } else if (player.queue.size === 0) {
                // No hay más canciones
                if (player.textId) {
                    const channel = this.client.channels.cache.get(player.textId);
                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setTitle('📭 Cola Terminada')
                            .setDescription('No hay más canciones en la cola. Desconectando en 5 minutos por inactividad...')
                            .setColor('#FFA500');
                        
                        channel.send({ embeds: [embed] });
                    }
                }
                
                this.setPlayerTimeout(player.guildId, () => {
                    if (player.queue.size === 0) {
                        player.destroy();
                        if (player.textId) {
                            const channel = this.client.channels.cache.get(player.textId);
                            if (channel) {
                                channel.send('⏹️ Desconectado por inactividad (5 minutos sin música).');
                            }
                        }
                    }
                }, 300000);
            }
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

        const args = message.content.toLowerCase().split(' ');
        const command = args[0];

        // Comandos de música
        if (['>', '>m', '>musica', '>music'].includes(command)) {
            if (!args[1]) {
                await this.showMusicHelp(message);
                return;
            }

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
                        await this.skipCommand(message, guild);
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
                        await this.queueCommand(message, guild);
                        break;
                    
                    case 'nowplaying':
                    case 'np':
                        await this.nowPlayingCommand(message, guild);
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

    async playCommand(message, args, member, channel, guild, author) {
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return message.reply('❌ Debes estar en un canal de voz para usar este comando.');
        }

        if (!args[2]) {
            return message.reply('❌ Proporciona el nombre de la canción.\nEjemplo: `>music play despacito`');
        }

        const query = args.slice(2).join(' ');

        await message.reply({
            content: `🔍 Buscando... \`${query}\``,
        });

        try {
            let player = this.kazagumo.getPlayer(guild.id);

            if (!player) {
                player = await this.kazagumo.createPlayer({
                    guildId: guild.id, // Corregido: era guild.icon
                    textId: channel.id,
                    voiceId: voiceChannel.id,
                });
            }

            this.clearPlayerTimeout(guild.id); // Limpiar timeout si existe

            const result = await this.kazagumo.search(query, { requester: author });

            if (!result.tracks.length) {
                return message.reply('❌ No se encontraron resultados para tu búsqueda.');
            }

            // Antes de player.play():
            if (result.tracks.length > this.maxSongDuration) {
                return message.reply('❌ La canción es muy larga (máximo 2 horas).');
            }


            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTimestamp();

            if (result.type === 'PLAYLIST') {
                player.queue.add(result.tracks);
                embed.setTitle('📂 Playlist Agregada')
                    .setDescription(`**${result.playlistName}**\n${result.tracks.length} canciones agregadas a la cola`)
                    .setThumbnail(result.tracks[0].thumbnail || null);
            } else {
                const track = result.tracks[0];
                player.queue.add(track);
                embed.setTitle('🎵 Canción Agregada a la Cola')
                    .setDescription(`**${track.title}**\nDuración: ${this.formatTime(track.length)}`)
                    .setThumbnail(track.thumbnail || null);
            }

            if (!player.playing && !player.paused) {
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

    async skipCommand(message, guild) {
        const player = this.kazagumo.getPlayer(guild.id);

        if (!player) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        if (player.queue.size === 0) {
            return message.reply('❌ No hay más canciones en la cola.');
        }

        const currentTrack = player.queue.current;
        player.skip();

        const embed = new EmbedBuilder()
            .setTitle('⏭️ Canción Saltada')
            .setDescription(`**${currentTrack.title}** ha sido saltada.`)
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

    async queueCommand(message, guild) {
        const player = this.kazagumo.getPlayer(guild.id);

        if (!player || !player.queue.current) {
            return message.reply('❌ No hay música en la cola.');
        }

        const current = player.queue.current;
        const queue = player.queue;

        const embed = new EmbedBuilder()
            .setTitle('📋 Cola de Reproducción')
            .setColor('#0099FF')
            .setTimestamp();

        let description = `**🎵 Reproduciendo Ahora:**\n${current.title}\n\n`;

        if (queue.size > 0) {
            description += '**📋 En Cola:**\n';
            const upcoming = queue.slice(0, 10); // Mostrar solo las primeras 10
            
            upcoming.forEach((track, index) => {
                description += `${index + 1}. ${track.title}\n`;
            });

            if (queue.size > 10) {
                description += `\n... y ${queue.size - 10} más`;
            }
        } else {
            description += '**📋 En Cola:** Vacía';
        }

        embed.setDescription(description);
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
        
        player.seekTo(targetPosition);
        
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
            .setTitle('🎵 Comandos de Música')
            .setDescription('Lista completa de comandos de música disponibles')
            .addFields(
                { name: '▶️ Reproducción', value: '`>music play <canción>` - Reproduce una canción\n`>music pause` - Pausa la música\n`>music resume` - Reanuda la música\n`>music stop` - Detiene y desconecta', inline: false },
                { name: '⏭️ Control de Cola', value: '`>music skip` - Salta la canción actual\n`>music queue` - Muestra la cola\n`>music shuffle` - Mezcla la cola\n`>music clear` - Limpia la cola', inline: false },
                { name: '🔧 Configuración', value: '`>music volume <1-100>` - Cambia el volumen\n`>music loop [track/queue/off]` - Configura el loop\n`>music nowplaying` - Canción actual', inline: false },
                { name: '📝 Aliases', value: '`>m`, `>musica`, `>music`\n`p` = play, `s` = skip, `q` = queue, `np` = nowplaying', inline: false },
                { name: '⏩ Navegación', value: '`>music seek <tiempo>` - Adelantar/retroceder\nEjemplos: `>m seek 1:30`, `>m seek +30`, `>m seek -15`', inline: false },
            )
            .setColor('#0099FF')
            .setFooter({ text: 'Ejemplo: >music play despacito' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
}

module.exports = MusicSystem;