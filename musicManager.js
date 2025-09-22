const { Connectors } = require('shoukaku')
const { Kazagumo, Plugins } = require('kazagumo')

const node = [
    {
        name: 'equisde',
        url: 'lava-v4.ajieblogs.eu.org:443',
        auth : "https://dsc.gg/ajidevserver",
        secure: true 
    }
];

module.exports = (client) => {
    const kazagumo = new Kazagumo(
        {
            defaultSearchEngine: 'youtube',
            plugins: [new Plugins.PlayerMoved(client)],
            send: (guildId, payload) => {
                const guild = client.guilds.cache.get(guildId);
                if (guild) guild.shard.send(payload);
            },
        },
        new Connectors.DiscordJS(client),
        node
    );

    client.kazagumo = kazagumo;
};