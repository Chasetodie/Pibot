const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');

class MusicSystem {
    constructor(client) {
        this.client = client;
        this.distube = new DisTube(client, {
            plugins: [new YtDlpPlugin({ update: false })],
            emitNewSongOnly: true,
            joinNewVoiceChannel: true,
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.distube
            .on('playSong', (queue, song) => {
                const embed = new EmbedBuilder()
                    .setTitle('🎵 Reproduciendo Ahora')
                    .setDescription(`**${song.name}**\nDuración: ${song.formattedDuration}`)
                    .setThumbnail(song.thumbnail || null)
                    .setColor('#00FF00')
                    .setTimestamp();
                queue.textChannel?.send({ embeds: [embed] });
            })
            .on('addSong', (queue, song) => {
                const embed = new EmbedBuilder()
                    .setTitle('🎵 Canción Agregada a la Cola')
                    .setDescription(`**${song.name}**\nDuración: ${song.formattedDuration}`)
                    .setThumbnail(song.thumbnail || null)
                    .setColor('#00FF00');
                queue.textChannel?.send({ embeds: [embed] });
            })
            .on('addList', (queue, playlist) => {
                const embed = new EmbedBuilder()
                    .setTitle('📂 Playlist Agregada')
                    .setDescription(`**${playlist.name}**\n${playlist.songs.length} canciones agregadas`)
                    .setColor('#00FF00');
                queue.textChannel?.send({ embeds: [embed] });
            })
            .on('finish', queue => {
                const embed = new EmbedBuilder()
                    .setTitle('✅ Cola Terminada')
                    .setDescription('Se han reproducido todas las canciones.')
                    .setColor('#00FF00')
                    .setFooter({ text: 'El bot se desconectará automáticamente.' });
                queue.textChannel?.send({ embeds: [embed] });
            })
            .on('disconnect', queue => {
                queue.textChannel?.send('⏹️ Desconectado del canal de voz.');
            })
            .on('empty', queue => {
                queue.textChannel?.send('⚠️ El canal de voz está vacío. Desconectando...');
            })
            .on('error', (textChannel, error) => {
                console.error('❌ DisTube error:', error);
                textChannel?.send(`❌ Error: ${error.message.slice(0, 200)}`);
            });
    }

    async processCommand(message) {
        if (message.author.bot) return;

        const args = message.content.toLowerCase().split(' ');
        const command = args[0];

        if (!['>', '>m', '>musica', '>music'].includes(command)) return;

        if (!args[1]) {
            await this.showMusicHelp(message);
            return;
        }

        const subcommand = args[1];

        try {
            switch (subcommand) {
                case 'play':
                case 'p':
                    await this.playCommand(message, args);
                    break;
                case 'stop':
                case 'leave':
                case 'disconnect':
                    await this.stopCommand(message);
                    break;
                case 'skip':
                case 's':
                    await this.skipCommand(message);
                    break;
                case 'pause':
                    await this.pauseCommand(message);
                    break;
                case 'resume':
                case 'unpause':
                    await this.resumeCommand(message);
                    break;
                case 'queue':
                case 'q':
                    await this.queueCommand(message);
                    break;
                case 'nowplaying':
                case 'np':
                    await this.nowPlayingCommand(message);
                    break;
                case 'volume':
                case 'vol':
                    await this.volumeCommand(message, args);
                    break;
                case 'loop':
                case 'repeat':
                    await this.loopCommand(message, args);
                    break;
                case 'shuffle':
                    await this.shuffleCommand(message);
                    break;
                case 'clear':
                    await this.clearQueueCommand(message);
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

    async playCommand(message, args) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ Debes estar en un canal de voz.');
        }

        if (!args[2]) {
            return message.reply('❌ Proporciona el nombre de la canción.\nEjemplo: `>m play despacito`');
        }

        const query = args.slice(2).join(' ');
        await message.reply(`🔍 Buscando... \`${query}\``);

        try {
            await this.distube.play(voiceChannel, query, {
                message,
                textChannel: message.channel,
                member: message.member,
            });
        } catch (error) {
            console.error('Error en play:', error);
            await message.channel.send(`❌ Error al reproducir: ${error.message.slice(0, 200)}`);
        }
    }

    async stopCommand(message) {
        const queue = this.distube.getQueue(message);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');

        await this.distube.stop(message);
        const embed = new EmbedBuilder()
            .setTitle('⏹️ Música Detenida')
            .setColor('#FF0000');
        await message.reply({ embeds: [embed] });
    }

    async skipCommand(message) {
        const queue = this.distube.getQueue(message);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');

        const current = queue.songs[0];
        await this.distube.skip(message);

        const embed = new EmbedBuilder()
            .setTitle('⏭️ Canción Saltada')
            .setDescription(`**${current.name}** ha sido saltada.`)
            .setColor('#FFA500');
        await message.reply({ embeds: [embed] });
    }

    async pauseCommand(message) {
        const queue = this.distube.getQueue(message);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');
        if (queue.paused) return message.reply('❌ La música ya está pausada.');

        this.distube.pause(message);
        await message.reply('⏸️ Música pausada.');
    }

    async resumeCommand(message) {
        const queue = this.distube.getQueue(message);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');
        if (!queue.paused) return message.reply('❌ La música no está pausada.');

        this.distube.resume(message);
        await message.reply('▶️ Música reanudada.');
    }

    async queueCommand(message) {
        const queue = this.distube.getQueue(message);
        if (!queue) return message.reply('❌ No hay música en la cola.');

        const songs = queue.songs;
        const current = songs[0];
        const upcoming = songs.slice(1, 11); // Máx 10 siguientes

        const embed = new EmbedBuilder()
            .setTitle('📋 Cola de Reproducción')
            .setColor('#0099FF')
            .addFields({
                name: '🎵 Reproduciendo',
                value: `**${current.name}** (${current.formattedDuration})`,
                inline: false
            });

        if (upcoming.length > 0) {
            embed.addFields({
                name: `📃 Siguiente (${songs.length - 1} canciones)`,
                value: upcoming.map((s, i) => `${i + 1}. **${s.name}** (${s.formattedDuration})`).join('\n'),
                inline: false
            });
        }

        await message.reply({ embeds: [embed] });
    }

    async nowPlayingCommand(message) {
        const queue = this.distube.getQueue(message);
        if (!queue || !queue.songs[0]) return message.reply('❌ No hay música reproduciéndose.');

        const song = queue.songs[0];
        const embed = new EmbedBuilder()
            .setTitle('🎵 Reproduciendo Ahora')
            .setDescription(`**${song.name}**`)
            .addFields(
                { name: '⏱️ Duración', value: song.formattedDuration, inline: true },
                { name: '🔊 Volumen', value: `${queue.volume}%`, inline: true },
                { name: '🔁 Loop', value: queue.repeatMode === 1 ? 'Canción' : queue.repeatMode === 2 ? 'Cola' : 'Off', inline: true }
            )
            .setThumbnail(song.thumbnail || null)
            .setColor('#00FF00');

        await message.reply({ embeds: [embed] });
    }

    async volumeCommand(message, args) {
        const queue = this.distube.getQueue(message);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');

        const vol = parseInt(args[2]);
        if (isNaN(vol) || vol < 1 || vol > 100) {
            return message.reply('❌ El volumen debe ser entre 1 y 100.\nEjemplo: `>m volume 80`');
        }

        this.distube.setVolume(message, vol);
        await message.reply(`🔊 Volumen ajustado a **${vol}%**`);
    }

    async loopCommand(message, args) {
        const queue = this.distube.getQueue(message);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');

        const mode = args[2];
        let repeatMode;
        if (mode === 'song' || mode === 'cancion') repeatMode = 1;
        else if (mode === 'queue' || mode === 'cola') repeatMode = 2;
        else repeatMode = 0;

        this.distube.setRepeatMode(message, repeatMode);
        const modeText = repeatMode === 1 ? '🔂 Canción' : repeatMode === 2 ? '🔁 Cola' : '➡️ Off';
        await message.reply(`Loop: **${modeText}**`);
    }

    async shuffleCommand(message) {
        const queue = this.distube.getQueue(message);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');

        await this.distube.shuffle(message);
        await message.reply('🔀 Cola mezclada aleatoriamente.');
    }

    async clearQueueCommand(message) {
        const queue = this.distube.getQueue(message);
        if (!queue) return message.reply('❌ No hay música reproduciéndose.');

        queue.songs.splice(1);
        await message.reply('🗑️ Cola limpiada. Solo queda la canción actual.');
    }

    formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    async showMusicHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('🎵 Comandos de Música')
            .setColor('#9932CC')
            .addFields(
                { name: '▶️ Reproducir', value: '`>m play <canción/URL>`', inline: true },
                { name: '⏭️ Saltar', value: '`>m skip`', inline: true },
                { name: '⏸️ Pausar', value: '`>m pause`', inline: true },
                { name: '▶️ Reanudar', value: '`>m resume`', inline: true },
                { name: '⏹️ Detener', value: '`>m stop`', inline: true },
                { name: '📋 Cola', value: '`>m queue`', inline: true },
                { name: '🎵 Actual', value: '`>m np`', inline: true },
                { name: '🔊 Volumen', value: '`>m volume <1-100>`', inline: true },
                { name: '🔁 Loop', value: '`>m loop [song/queue]`', inline: true },
                { name: '🔀 Shuffle', value: '`>m shuffle`', inline: true },
                { name: '🗑️ Limpiar cola', value: '`>m clear`', inline: true },
            )
            .setFooter({ text: 'Soporta YouTube, SoundCloud y más' });

        await message.reply({ embeds: [embed] });
    }
}

module.exports = MusicSystem;