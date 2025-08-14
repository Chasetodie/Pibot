const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');

// Múltiples librerías como backup
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

class MusicHandler {
    constructor(client) {
        this.client = client;
        this.queues = new Map();
        
        // Rotar User-Agents para evitar bloqueos
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
        ];
        
        // Sin cookies problemáticas - usar headers básicos
        this.cookieSets = [
            '', // Sin cookies
            '', // Sin cookies  
            ''  // Sin cookies
        ];
        
        this.currentUserAgent = 0;
        this.currentCookieSet = 0;
    }

    // Rotar configuraciones para evitar bloqueos
    getRandomConfig() {
        this.currentUserAgent = (this.currentUserAgent + 1) % this.userAgents.length;
        this.currentCookieSet = (this.currentCookieSet + 1) % this.cookieSets.length;
        
        return {
            userAgent: this.userAgents[this.currentUserAgent],
            cookies: this.cookieSets[this.currentCookieSet]
        };
    }

    async processCommand(message) {
        console.log('🔄 processCommand llamado con:', message.content);
        
        const args = message.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        switch (command) {
            case 'play':
            case 'p':
                const query = args.join(' ');
                await this.play(message, query);
                break;
            
            case 'stop':
                this.stop(message);
                break;
                
            case 'pause':
                this.pause(message);
                break;
                
            case 'resume':
                this.resume(message);
                break;
                
            case 'skip':
                this.skip(message);
                break;
                
            case 'queue':
            case 'q':
                this.showQueue(message);
                break;
            
            case 'help':
                this.showHelp(message);
                break;
        }
    }

    async play(message, query) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ ¡Necesitas estar en un canal de voz!');
        }

        if (!query) {
            return message.reply('❌ ¡Necesitas proporcionar una URL o búsqueda!');
        }

        // Intentar múltiples métodos
        const success = await this.tryMultipleMethods(message, query, voiceChannel);
        
        if (!success) {
            message.reply('❌ No se pudo reproducir la música después de intentar múltiples métodos. YouTube puede estar bloqueando todas las solicitudes.');
        }
    }

    async tryMultipleMethods(message, query, voiceChannel) {
        const methods = [
            () => this.tryYtdlCore(message, query, voiceChannel),
            () => this.tryAlternativeSearch(message, query, voiceChannel),
            () => this.tryDirectUrl(message, query, voiceChannel)
        ];

        for (let i = 0; i < methods.length; i++) {
            try {
                console.log(`🔄 Intentando método ${i + 1}...`);
                const result = await methods[i]();
                if (result) {
                    console.log(`✅ Método ${i + 1} exitoso`);
                    return true;
                }
            } catch (error) {
                console.log(`❌ Método ${i + 1} falló:`, error.message);
                continue;
            }
        }
        
        return false;
    }

    async tryYtdlCore(message, query, voiceChannel) {
        let songUrl, songInfo;
        const config = this.getRandomConfig();

        // Buscar si no es URL
        if (!ytdl.validateURL(query)) {
            const searchResults = await ytSearch(query);
            if (!searchResults?.videos?.length) return false;
            
            const video = searchResults.videos[0];
            songUrl = video.url;
            songInfo = {
                title: video.title,
                duration: video.duration.timestamp,
                thumbnail: video.thumbnail
            };
        } else {
            songUrl = query;
            const info = await ytdl.getInfo(songUrl);
            songInfo = {
                title: info.videoDetails.title,
                duration: this.formatDuration(info.videoDetails.lengthSeconds),
                thumbnail: info.videoDetails.thumbnails[0]?.url
            };
        }

        // Configuración SIN cookies problemáticas
        const stream = ytdl(songUrl, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25,
            requestOptions: {
                headers: {
                    'User-Agent': config.userAgent,
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'close',
                    'Upgrade-Insecure-Requests': '1'
                }
            },
            begin: 0,
            liveBuffer: 1 << 25
        });

        return await this.createPlayer(message, voiceChannel, stream, songInfo, songUrl);
    }

    async tryAlternativeSearch(message, query, voiceChannel) {
        // Método alternativo: buscar con términos modificados
        const modifiedQuery = query + ' official audio';
        const searchResults = await ytSearch(modifiedQuery);
        
        if (!searchResults?.videos?.length) return false;
        
        const video = searchResults.videos[0];
        return await this.tryYtdlCore(message, video.url, voiceChannel);
    }

    async tryDirectUrl(message, query, voiceChannel) {
        // Si es URL, intentar con configuración mínima
        if (!ytdl.validateURL(query)) return false;
        
        const stream = ytdl(query, {
            filter: 'audioonly',
            quality: 'lowest' // Usar menor calidad como último recurso
        });

        const songInfo = {
            title: 'Video de YouTube',
            duration: 'Desconocida',
            thumbnail: null
        };

        return await this.createPlayer(message, query, voiceChannel, stream, songInfo, query);
    }

    async createPlayer(message, voiceChannel, stream, songInfo, songUrl) {
        const resource = createAudioResource(stream, {
            inputType: 'arbitrary',
            inlineVolume: true
        });

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        // Obtener o crear cola
        let queue = this.queues.get(message.guild.id);
        if (!queue) {
            queue = {
                connection,
                player,
                textChannel: message.channel,
                songs: [],
                playing: false
            };
            this.queues.set(message.guild.id, queue);
        }

        // Agregar canción a la cola
        queue.songs.push({
            title: songInfo.title,
            url: songUrl,
            duration: songInfo.duration,
            thumbnail: songInfo.thumbnail,
            requester: message.author
        });

        if (!queue.playing) {
            this.playSong(queue, resource, songInfo, songUrl, message);
        } else {
            message.reply(`📋 **${songInfo.title}** agregado a la cola (Posición: ${queue.songs.length})`);
        }

        return true;
    }

    playSong(queue, resource, songInfo, songUrl, message) {
        queue.playing = true;
        queue.player.play(resource);

        // Embed de reproducción
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎵 Reproduciendo ahora')
            .setDescription(`[${songInfo.title}](${songUrl})`)
            .addFields(
                { name: '⏱️ Duración', value: songInfo.duration || 'Desconocida', inline: true },
                { name: '👤 Solicitado por', value: message.author.toString(), inline: true }
            );

        if (songInfo.thumbnail) {
            embed.setThumbnail(songInfo.thumbnail);
        }

        message.reply({ embeds: [embed] });

        // Eventos del reproductor
        queue.player.on(AudioPlayerStatus.Idle, () => {
            queue.songs.shift(); // Remover canción actual
            
            if (queue.songs.length > 0) {
                // Reproducir siguiente canción
                this.playNext(queue);
            } else {
                queue.playing = false;
                message.channel.send('✅ Cola de reproducción terminada.');
            }
        });

        queue.player.on('error', (error) => {
            console.error('❌ Error del reproductor:', error.message);
            message.channel.send('❌ Error durante la reproducción. Saltando a la siguiente canción...');
            queue.songs.shift();
            if (queue.songs.length > 0) {
                this.playNext(queue);
            } else {
                queue.playing = false;
            }
        });
    }

    async playNext(queue) {
        if (queue.songs.length === 0) {
            queue.playing = false;
            return;
        }

        const nextSong = queue.songs[0];
        try {
            const stream = ytdl(nextSong.url, {
                filter: 'audioonly',
                quality: 'highestaudio'
            });

            const resource = createAudioResource(stream);
            queue.player.play(resource);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎵 Reproduciendo ahora')
                .setDescription(`[${nextSong.title}](${nextSong.url})`)
                .addFields(
                    { name: '👤 Solicitado por', value: nextSong.requester.toString(), inline: true }
                );

            queue.textChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Error reproduciendo siguiente canción:', error.message);
            queue.songs.shift();
            this.playNext(queue);
        }
    }

    pause(message) {
        const queue = this.queues.get(message.guild.id);
        if (!queue || !queue.playing) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        queue.player.pause();
        message.reply('⏸️ Música pausada.');
    }

    resume(message) {
        const queue = this.queues.get(message.guild.id);
        if (!queue) {
            return message.reply('❌ No hay música en cola.');
        }

        queue.player.unpause();
        message.reply('▶️ Música reanudada.');
    }

    skip(message) {
        const queue = this.queues.get(message.guild.id);
        if (!queue || !queue.playing) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        queue.player.stop(); // Esto activará el evento 'idle' que reproduce la siguiente
        message.reply('⏭️ Canción saltada.');
    }

    showQueue(message) {
        const queue = this.queues.get(message.guild.id);
        if (!queue || queue.songs.length === 0) {
            return message.reply('❌ No hay canciones en la cola.');
        }

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('📋 Cola de Reproducción')
            .setDescription(
                queue.songs.slice(0, 10).map((song, index) => 
                    `${index + 1}. [${song.title}](${song.url}) - ${song.requester}`
                ).join('\n')
            )
            .setFooter({ text: `${queue.songs.length} canciones en total` });

        message.reply({ embeds: [embed] });
    }

    stop(message) {
        const queue = this.queues.get(message.guild.id);
        if (!queue) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        queue.songs = [];
        queue.player.stop();
        queue.connection.destroy();
        this.queues.delete(message.guild.id);
        
        message.reply('⏹️ Música detenida y desconectado del canal de voz.');
    }

    showHelp(message) {
        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('🎵 Comandos de Música Avanzados')
            .addFields(
                { name: '`>play <url/búsqueda>`', value: 'Reproduce música', inline: true },
                { name: '`>pause`', value: 'Pausa la música', inline: true },
                { name: '`>resume`', value: 'Reanuda la música', inline: true },
                { name: '`>skip`', value: 'Salta la canción actual', inline: true },
                { name: '`>queue`', value: 'Muestra la cola', inline: true },
                { name: '`>stop`', value: 'Para y limpia todo', inline: true }
            )
            .setFooter({ text: 'Bot con múltiples métodos de extracción' });

        message.reply({ embeds: [embed] });
    }

    formatDuration(seconds) {
        if (!seconds) return 'Desconocida';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

module.exports = MusicHandler;