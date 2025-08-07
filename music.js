const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

class MusicBot {
    constructor() {
        this.queues = new Map(); // Map para guardar las colas por servidor
    }

    // Estructura de datos para cada servidor
    createServerQueue(guildId) {
        return {
            songs: [],
            connection: null,
            player: null,
            isPlaying: false,
            currentSong: null,
            volume: 1.0,
            loop: false,
            voiceChannel: null
        };
    }

    // Obtener o crear cola del servidor
    getQueue(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, this.createServerQueue(guildId));
        }
        return this.queues.get(guildId);
    }

    // Comando PLAY - Mejorado
    async handlePlay(message, args) {
        const voiceChannel = message.member.voice.channel;
        
        if (!voiceChannel) {
            return message.reply('❌ ¡Debes estar en un canal de voz!');
        }

        if (!args[0]) {
            return message.reply('❌ ¡Proporciona una URL de YouTube o término de búsqueda!');
        }

        const queue = this.getQueue(message.guild.id);
        let songInfo;

        try {
            // Si es una URL válida de YouTube
            if (ytdl.validateURL(args[0])) {
                songInfo = await ytdl.getInfo(args[0]);
            } else {
                // Buscar por término
                const searchTerm = args.join(' ');
                const searchResults = await ytSearch(searchTerm);
                
                if (!searchResults.videos.length) {
                    return message.reply('❌ No se encontraron resultados');
                }
                
                const firstResult = searchResults.videos[0];
                songInfo = await ytdl.getInfo(firstResult.url);
            }

            const song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url,
                duration: this.formatDuration(songInfo.videoDetails.lengthSeconds),
                thumbnail: songInfo.videoDetails.thumbnails[0]?.url,
                requestedBy: message.author.tag
            };

            queue.songs.push(song);

            if (!queue.isPlaying) {
                await this.playMusic(message, queue, voiceChannel);
            } else {
                message.reply(`🎵 **${song.title}** ha sido añadida a la cola (Posición: ${queue.songs.length})`);
            }

        } catch (error) {
            console.error(error);
            message.reply('❌ Error al procesar la canción');
        }
    }

    // Función principal para reproducir música
    async playMusic(message, queue, voiceChannel) {
        if (queue.songs.length === 0) {
            queue.isPlaying = false;
            if (queue.connection) {
                queue.connection.destroy();
            }
            return message.channel.send('📭 Cola vacía. Saliendo del canal de voz.');
        }

        const song = queue.songs[0];
        queue.currentSong = song;

        try {
            // Conectar al canal de voz si no está conectado
            if (!queue.connection) {
                queue.connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });
                queue.voiceChannel = voiceChannel;
            }

            // Crear stream y reproductor
            const stream = ytdl(song.url, { 
                filter: 'audioonly', 
                highWaterMark: 1 << 25,
                quality: 'highestaudio'
            });
            
            const resource = createAudioResource(stream, { inlineVolume: true });
            resource.volume.setVolume(queue.volume);
            
            queue.player = createAudioPlayer();
            queue.player.play(resource);
            queue.connection.subscribe(queue.player);
            queue.isPlaying = true;

            // Eventos del reproductor
            queue.player.on(AudioPlayerStatus.Playing, () => {
                message.channel.send(`🎵 Reproduciendo: **${song.title}** | Duración: ${song.duration} | Solicitada por: ${song.requestedBy}`);
            });

            queue.player.on(AudioPlayerStatus.Idle, () => {
                if (!queue.loop) {
                    queue.songs.shift(); // Remover canción actual
                }
                this.playMusic(message, queue, voiceChannel);
            });

            queue.player.on('error', error => {
                console.error(error);
                queue.songs.shift();
                this.playMusic(message, queue, voiceChannel);
            });

        } catch (error) {
            console.error(error);
            queue.songs.shift();
            this.playMusic(message, queue, voiceChannel);
        }
    }

    // Comando SKIP
    handleSkip(message) {
        const queue = this.getQueue(message.guild.id);
        
        if (!queue.isPlaying) {
            return message.reply('❌ No hay música reproduciéndose');
        }

        if (queue.player) {
            queue.player.stop();
            message.reply('⏭️ Canción saltada');
        }
    }

    // Comando STOP
    handleStop(message) {
        const queue = this.getQueue(message.guild.id);
        
        if (!queue.isPlaying) {
            return message.reply('❌ No hay música reproduciéndose');
        }

        queue.songs = [];
        queue.isPlaying = false;
        
        if (queue.player) {
            queue.player.stop();
        }
        
        if (queue.connection) {
            queue.connection.destroy();
        }

        message.reply('⏹️ Música detenida y cola limpiada');
    }

    // Comando PAUSE
    handlePause(message) {
        const queue = this.getQueue(message.guild.id);
        
        if (!queue.isPlaying || !queue.player) {
            return message.reply('❌ No hay música reproduciéndose');
        }

        queue.player.pause();
        message.reply('⏸️ Música pausada');
    }

    // Comando RESUME
    handleResume(message) {
        const queue = this.getQueue(message.guild.id);
        
        if (!queue.player) {
            return message.reply('❌ No hay música en pausa');
        }

        queue.player.unpause();
        message.reply('▶️ Música reanudada');
    }

    // Comando QUEUE - Mostrar cola
    handleQueue(message) {
        const queue = this.getQueue(message.guild.id);
        
        if (queue.songs.length === 0) {
            return message.reply('📭 La cola está vacía');
        }

        let queueList = '🎵 **Cola de reproducción:**\n\n';
        
        queue.songs.slice(0, 10).forEach((song, index) => {
            const current = index === 0 && queue.isPlaying ? '🎵 **[Reproduciendo]** ' : `${index + 1}. `;
            queueList += `${current}**${song.title}** | ${song.duration} | ${song.requestedBy}\n`;
        });

        if (queue.songs.length > 10) {
            queueList += `\n*... y ${queue.songs.length - 10} más*`;
        }

        message.channel.send(queueList);
    }

    // Comando VOLUME
    handleVolume(message, args) {
        const queue = this.getQueue(message.guild.id);
        
        if (!args[0]) {
            return message.reply(`🔊 Volumen actual: ${Math.round(queue.volume * 100)}%`);
        }

        const volume = parseInt(args[0]);
        
        if (isNaN(volume) || volume < 0 || volume > 200) {
            return message.reply('❌ El volumen debe ser un número entre 0 y 200');
        }

        queue.volume = volume / 100;
        
        if (queue.player && queue.player.state.resource) {
            queue.player.state.resource.volume.setVolume(queue.volume);
        }

        message.reply(`🔊 Volumen establecido a ${volume}%`);
    }

    // Comando LOOP
    handleLoop(message) {
        const queue = this.getQueue(message.guild.id);
        
        queue.loop = !queue.loop;
        const status = queue.loop ? 'activado' : 'desactivado';
        message.reply(`🔄 Loop ${status}`);
    }

    // Comando NOW PLAYING
    handleNowPlaying(message) {
        const queue = this.getQueue(message.guild.id);
        
        if (!queue.isPlaying || !queue.currentSong) {
            return message.reply('❌ No hay música reproduciéndose');
        }

        const song = queue.currentSong;
        message.channel.send(`🎵 **Reproduciendo ahora:**\n**${song.title}**\nDuración: ${song.duration}\nSolicitada por: ${song.requestedBy}`);
    }

    // Comando CLEAR - Limpiar cola
    handleClear(message) {
        const queue = this.getQueue(message.guild.id);
        
        if (queue.songs.length <= 1) {
            return message.reply('❌ No hay canciones en cola para limpiar');
        }

        const clearedCount = queue.songs.length - 1;
        queue.songs = queue.songs.slice(0, 1); // Mantener solo la canción actual
        
        message.reply(`🗑️ ${clearedCount} canciones removidas de la cola`);
    }

    // Utilidad para formatear duración
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Uso del bot
const musicBot = new MusicBot();

// Ejemplo de manejo de comandos en tu bot principal
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).split(' ');
    const command = args.shift().toLowerCase();

    switch (command) {
        case 'play':
        case 'p':
            await musicBot.handlePlay(message, args);
            break;
        case 'skip':
        case 's':
            musicBot.handleSkip(message);
            break;
        case 'stop':
            musicBot.handleStop(message);
            break;
        case 'pause':
            musicBot.handlePause(message);
            break;
        case 'resume':
        case 'r':
            musicBot.handleResume(message);
            break;
        case 'queue':
        case 'q':
            musicBot.handleQueue(message);
            break;
        case 'volume':
        case 'v':
            musicBot.handleVolume(message, args);
            break;
        case 'loop':
        case 'l':
            musicBot.handleLoop(message);
            break;
        case 'np':
        case 'nowplaying':
            musicBot.handleNowPlaying(message);
            break;
        case 'clear':
        case 'c':
            musicBot.handleClear(message);
            break;
    }
});

module.exports = MusicBot;