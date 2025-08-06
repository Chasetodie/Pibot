const { EmbedBuilder } = require('discord.js');

class EnhancedCommands {
    constructor(economySystem, achievementsSystem, shopSystem, bettingSystem, eventsSystem) {
        this.economy = economySystem;
        this.achievements = achievementsSystem;
        this.shop = shopSystem;
        this.betting = bettingSystem;
        this.events = eventsSystem;
    }

    async processCommand(message) {
        if (message.author.bot) return;

        const args = message.content.trim().split(/ +/g);
        const command = args[0].toLowerCase();

        try {
            // Achievements
            if (command === 'mon!achievements' || command === 'mon!logros') {
                const achievementTarget = message.mentions.members?.first();
                await this.achievements.showUserAchievements(message, achievementTarget);
                return;
            }
            if (command === 'mon!allachievements' || command === 'mon!todoslogros') {
                await this.achievements.showAllAchievements(message);
                return;
            }
            if (command === 'mon!notifyachievements') {
                const achievementIds = args.slice(1);
                await this.achievements.notifyAchievements(message, achievementIds);
                return;
            }

            // Shop
            if (command === 'mon!shop' || command === 'mon!tienda') {
                const category = args[1];
                await this.shop.showShop(message, category);
                return;
            }
            if (command === 'mon!buy' || command === 'mon!comprar') {
                if (args.length < 2) {
                    await message.reply('❌ Uso: `mon!buy <item> [cantidad]`');
                    return;
                }
                const itemId = args[1];
                const quantity = parseInt(args[2]) || 1;
                await this.shop.buyItem(message, itemId, quantity);
                return;
            }
            if (command === 'mon!use' || command === 'mon!usar') {
                if (args.length < 2) {
                    await message.reply('❌ Uso: `mon!use <item>`');
                    return;
                }
                const itemId = args[1];
                await this.shop.useItem(message, itemId);
                return;
            }
            if (command === 'mon!inventory' || command === 'mon!inv' || command === 'mon!inventario') {
                const targetUser = message.mentions.members?.first();
                await this.shop.showInventory(message, targetUser);
                return;
            }
            if (command === 'mon!sell' || command === 'mon!vender') {
                if (args.length < 2) {
                    await message.reply('❌ Uso: `mon!sell <item> [cantidad]`');
                    return;
                }
                const itemId = args[1];
                const quantity = parseInt(args[2]) || 1;
                await this.shop.sellItem(message, itemId, quantity);
                return;
            }
            if (command === 'mon!shophelp' || command === 'mon!ayudatienda') {
                await this.shopHelp(message);
                return;
            }

            // Betting
            if (command === 'mon!bet' || command === 'mon!apuesta') {
                await this.betting.createBet(message, args);
                return;
            }
            if (command === 'mon!mybets' || command === 'mon!misapuestas') {
                await this.betting.showActiveBets(message);
                return;
            }
            if (command === 'mon!betstats' || command === 'mon!estadisticasapuestas') {
                const targetUser = message.mentions.members?.first();
                await this.betting.showBetStats(message, targetUser);
                return;
            }
            if (command === 'mon!resolve') {
                if (args.length < 3) {
                    await message.reply('❌ Uso: `mon!resolve <betId> <ganador: challenger|opponent>`');
                    return;
                }
                await message.reply('❌ Resolución manual por comando no implementada, usa los botones.');
                return;
            }

            // Help
            if (command === 'mon!help') {
                await this.showHelp(message);
                return;
            }

        } catch (error) {
            console.error('❌ Error procesando comando:', error);
            await message.reply('❌ Ocurrió un error al procesar el comando. Intenta de nuevo.');
        }
    }

    async shopHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('🛒 Comandos de la Tienda')
            .setColor('#9932CC')
            .addFields(
                { name: '🛒 mon!shop [categoría]', value: 'Ver la tienda y sus categorías', inline: false },
                { name: '💸 mon!buy <itemId> [cantidad]', value: 'Comprar un item de la tienda', inline: false },
                { name: '⚡ mon!use <itemId>', value: 'Usar un boost/cosmético', inline: false },
                { name: '🎒 mon!inventory [@usuario]', value: 'Ver tu inventario o el de otro usuario', inline: false },
                { name: '💰 mon!sell <itemId> [cantidad]', value: 'Vender items de tu inventario', inline: false }
            )
            .setFooter({ text: '¡Colecciona, mejora y presume tus objetos!' })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    }

    async showHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('📖 Ayuda - Comandos Principales')
            .setColor('#00BFFF')
            .addFields(
                // Achievements
                { name: '🏆 Logros', value: '`mon!achievements [@usuario]` - Ver logros\n`mon!allachievements` - Ver todos los logros', inline: false },
                { name: '🏅 Notificar Logros', value: '`mon!notifyachievements <id1> <id2> ...` - Notifica logros desbloqueados (admin/test)', inline: false },
                // Shop
                { name: '🛒 Tienda', value: '`mon!shop [categoría]`\n`mon!buy <item> [cantidad]`\n`mon!use <item>`\n`mon!inventory [@usuario]`\n`mon!sell <item> [cantidad]`\n`mon!shophelp`', inline: false },
                // Betting
                { name: '🎲 Apuestas', value: '`mon!bet @usuario <cantidad> <descripción>` - Crear apuesta\n`mon!mybets` - Ver tus apuestas activas\n`mon!betstats [@usuario]` - Ver estadísticas de apuestas', inline: false },
                //Economy
                { name: '📋 Economía', value: '`mon!economyhelp` - Muestra los comandos de economía'},
                // Minijuegos
                { name: '🎮 Minijuegos', value: '`mon!coinflip <cara/cruz> <cantidad>` - Juega cara o cruz\n`mon!dice <1-6/alto/bajo> <cantidad>` - Juega a los dados\n`mon!games` - Ver lista de minijuegos', inline: false },
                // Eventos
                { name: '🎉 Eventos', value: '`mon!events` - Ver eventos activos\n`mon!createevent <tipo> [duración]` - Crear evento manual (admin)\n`mon!eventstats` - Estadísticas de eventos (admin)', inline: false }
           )
            .setFooter({ text: 'Usa los comandos para interactuar con el bot.' })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    }
}

module.exports = EnhancedCommands;