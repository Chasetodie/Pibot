const { REST, Routes } = require('discord.js');
require('dotenv').config();

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        const guildCommands = await rest.get(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
        );
        console.log(`📋 Comandos guild-specific restantes: ${guildCommands.length}`);
        guildCommands.forEach(c => console.log(`  - /${c.name}`));

        const globalCommands = await rest.get(
            Routes.applicationCommands(process.env.CLIENT_ID)
        );
        console.log(`🌍 Comandos globales registrados: ${globalCommands.length}`);
        globalCommands.forEach(c => console.log(`  - /${c.name}`));
    } catch (error) {
        console.error('❌ Error consultando comandos:', error);
    }
})();