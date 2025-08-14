const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus,
    VoiceConnectionStatus 
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');

class MusicHandler {
    constructor() {
        this.connections = new Map(); // Guardar conexiones por servidor
        this.players = new Map(); // Guardar reproductores por servidor
        this.queues = new Map(); // Cola de canciones por servidor
    }

    // Unirse a un canal de voz
    async joinChannel(message) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('¡Necesitas estar en un canal de voz!');
        }

        const guildId = message.guild.id;
        
        // Si ya está conectado, usar la conexión existente
        if (this.connections.has(guildId)) {
            return this.connections.get(guildId);
        }

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guildId,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        // Manejar eventos de conexión
        connection.on(VoiceConnectionStatus.Disconnected, () => {
            this.cleanup(guildId);
        });

        this.connections.set(guildId, connection);
        return connection;
    }

    // Reproducir música
    async play(message, url) {
        try {
            // Validar URL de YouTube
            if (!ytdl.validateURL(url)) {
                return message.reply('❌ URL de YouTube no válida');
            }

            const guildId = message.guild.id;
            const connection = await this.joinChannel(message);
            
            if (!connection) return;

            // Crear o obtener reproductor
            let player = this.players.get(guildId);
            if (!player) {
                player = createAudioPlayer();
                this.players.set(guildId, player);
                
                // Eventos del reproductor
                player.on(AudioPlayerStatus.Idle, () => {
                    this.playNext(guildId);
                });

                player.on('error', error => {
                    console.error(`Error en reproductor: ${error.message}`);
                });

                connection.subscribe(player);
            }

            // Obtener info de la canción
            const songInfo = await ytdl.getInfo(url);
            const song = {
                title: songInfo.videoDetails.title,
                url: url,
                duration: songInfo.videoDetails.lengthSeconds,
                requester: message.author.tag
            };

            // Agregar a la cola
            if (!this.queues.has(guildId)) {
                this.queues.set(guildId, []);
            }
            
            const queue = this.queues.get(guildId);
            queue.push(song);

            if (player.state.status === AudioPlayerStatus.Idle) {
                this.playNext(guildId);
                message.reply(`🎵 Reproduciendo: **${song.title}**`);
            } else {
                message.reply(`📝 Agregado a la cola: **${song.title}**`);
            }

        } catch (error) {
            console.error('Error al reproducir:', error);
            message.reply('❌ Error al procesar la canción');
        }
    }

    // Reproducir siguiente canción en la cola
    playNext(guildId) {
        const queue = this.queues.get(guildId);
        const player = this.players.get(guildId);

        if (!queue || queue.length === 0) {
            return; // No hay más canciones
        }

        const song = queue.shift(); // Tomar la primera canción
        const stream = ytdl(song.url, { 
            filter: 'audioonly',
            highWaterMark: 1 << 25 
        });
        
        const resource = createAudioResource(stream);
        player.play(resource);
    }

    // Parar música
    stop(message) {
        const guildId = message.guild.id;
        const player = this.players.get(guildId);

        if (player) {
            player.stop();
            this.queues.set(guildId, []); // Limpiar cola
            message.reply('⏹️ Música detenida y cola limpiada');
        } else {
            message.reply('❌ No hay música reproduciéndose');
        }
    }

    // Saltar canción
    skip(message) {
        const guildId = message.guild.id;
        const player = this.players.get(guildId);

        if (player) {
            player.stop(); // Esto triggereará el evento Idle y reproducirá la siguiente
            message.reply('⏭️ Canción saltada');
        } else {
            message.reply('❌ No hay música reproduciéndose');
        }
    }

    // Mostrar cola
    showQueue(message) {
        const guildId = message.guild.id;
        const queue = this.queues.get(guildId);

        if (!queue || queue.length === 0) {
            return message.reply('📝 La cola está vacía');
        }

        const queueList = queue.slice(0, 10).map((song, index) => {
            return `${index + 1}. **${song.title}** - solicitada por ${song.requester}`;
        }).join('\n');

        message.reply(`📝 **Cola actual:**\n${queueList}`);
    }

    // Desconectar y limpiar
    disconnect(message) {
        const guildId = message.guild.id;
        this.cleanup(guildId);
        message.reply('👋 Desconectado del canal de voz');
    }

    // Limpiar recursos del servidor
    cleanup(guildId) {
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
    }

    async processCommand(message) {
        if (message.author.bot) return;

        const args = message.content.trim().split(/ +/g);
        const command = args[0].toLowerCase();
        const betId = args[1];

        try {
            switch (command) {                    
                case '>play':
                case '>p':
                    if (!args[0]) {
                        return message.reply('❌ Proporciona una URL de YouTube\nEjemplo: `!play https://youtube.com/watch?v=...`');
                    }
                    await this.play(message, args[0]);
                    break;

                case '>stop':
                    this.stop(message);
                    break;

                case '>skip':
                case '>s':
                    this.skip(message);
                    break;

                case '>queue':
                case '>q':
                    this.showQueue(message);
                    break;

                case '>disconnect':
                case '>leave':
                case '>dc':
                    this.disconnect(message);
                    break;

                case '>help':
                    const helpEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('🎵 Comandos de Música')
                        .setDescription('Lista de comandos disponibles:')
                        .addFields(
                            { name: '!play [URL]', value: 'Reproduce una canción de YouTube', inline: true },
                            { name: '!stop', value: 'Para la música y limpia la cola', inline: true },
                            { name: '!skip', value: 'Salta la canción actual', inline: true },
                            { name: '!queue', value: 'Muestra la cola actual', inline: true },
                            { name: '!disconnect', value: 'Desconecta el bot del canal', inline: true },
                            { name: '!help', value: 'Muestra este mensaje', inline: true }
                        )
                        .setFooter({ text: 'Bot de música con Docker 🐳' });
                    
                    message.reply({ embeds: [helpEmbed] });
                    break;
                default:
                    // No es un comando de economía
                    break;
            }

/*          // Shop
            if (command === '>shop' || command === '>tienda') {
                const category = args[1];
                await this.shop.showShop(message, category);
                return;
            }
            if (command === '>buy' || command === '>comprar') {
                if (args.length < 2) {
                    await message.reply('❌ Uso: `>buy <item> [cantidad]`');
                    return;
                }
                const itemId = args[1];
                const quantity = parseInt(args[2]) || 1;
                await this.shop.buyItem(message, itemId, quantity);
                return;
            }
            if (command === '>use' || command === '>usar') {
                if (args.length < 2) {
                    await message.reply('❌ Uso: `>use <item>`');
                    return;
                }
                const itemId = args[1];
                await this.shop.useItem(message, itemId);
                return;
            }
            if (command === '>inventory' || command === '>inv' || command === '>inventario') {
                const targetUser = message.mentions.members?.first();
                await this.shop.showInventory(message, targetUser);
                return;
            }
            if (command === '>sell' || command === '>vender') {
                if (args.length < 2) {
                    await message.reply('❌ Uso: `>sell <item> [cantidad]`');
                    return;
                }
                const itemId = args[1];
                const quantity = parseInt(args[2]) || 1;
                await this.shop.sellItem(message, itemId, quantity);
                return;
            }
            if (command === '>shophelp' || command === '>ayudatienda') {
                await this.shopHelp(message);
                return;
            }

            // Events
            if (command === '>events') {
                await this.events.showActiveEvents(message);
                return;
            }
            if (command === '>createevent') {
                // >createevent <tipo> [duración]
                const eventType = args[1];
                const duration = args[2] ? parseInt(args[2]) : null; // duración en minutos
                await this.events.createManualEvent(message, eventType, duration);
                return;
            }
            if (command === '>eventstats') {
                await this.events.showEventStats(message);
                return;
            }            */



        } catch (error) {
            console.error('❌ Error procesando comando:', error);
            await message.reply('❌ Ocurrió un error al procesar el comando. Intenta de nuevo.');
        }
    }
}

module.exports = MusicHandler;