const { SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');
const { Kazagumo } = require('kazagumo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('Play your music!')
        .addSubcommand((subCommand) => 
            subCommand
                .setName('play')
                .setDescription('Play a song')
                .addStringOption((option) =>
                    option.setName('song-title').setDescription('Type a music title').setRequired(true)
                )
        ).addSubcommand((subCommand) => subCommand.setName('stop').setDescription('Stop the music')),
    /**
     * 
     * @param {ChatInputCommandInteraction} interaction
     * @param {Kazagumo} [kazagumo=client.kazagumo]
     * @param {Client} client
     */
    async execute(interaction, client, kazagumo = client.kazagumo) {
        const { options, member, channel, guild, user } = interaction;

        let player;
        switch (options.getSubcommand()) {
            case 'play':
                const voiceChannel = member.voice.channel;

                if(!voiceChannel) return interaction.reply('No se ha encontrado un canal de voz');
                
                const query = options.getString('song-title');

                await interaction.reply({
                    content: `Buscando... \`${query}\``,
                });

                try {
                    player = await kazagumo.createPlayer({
                        guildId: guild.icon,
                        textId: channel.id,
                        voiceId: voiceChannel.id,
                    })

                    let result = await kazagumo.search(query, { requester: user });

                    if(!result.tracks.length) return interaction.reply('No se han encontrado resultados');

                    if(result.type === 'PLAYLIST') player.queue.add(result.tracks);
                    else player.queue.add(result.tracks[0]);

                    if(!player.playing && !player.paused) player.play();
                    await interaction.followUp({
                        content:
                            result.type === 'PLAYLIST' 
                                ? `Se ha agregado a la lista ${result.playlistName}` 
                                : `Se ha agregado a la lista ${result.tracks[0].title}`
                    });
                } catch (error) {
                    console.log(error)
                }

                break;
            case 'stop':
                player = kazagumo.getPlayer(guild.id);

                if(!player) return interaction.reply('No se esta reproduciendo musica')

                await player.destroy();

                interaction.replied('Listo.');
                break;
            default:
                break;
        }
    },
};