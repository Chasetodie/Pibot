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
            if (command === '!achievements' || command === '!logros') {
                const achievementTarget = message.mentions.members?.first();
                await this.achievements.showUserAchievements(message, achievementTarget);
                return;
            }
            if (command === '!allachievements' || command === '!todoslogros') {
                await this.achievements.showAllAchievements(message);
                return;
            }

            // Notificar logros desbloqueados (solo si lo usas como comando)
            if (command === '!notifyachievements') {
                // Ejemplo de uso: !notifyachievements <achievementId1> <achievementId2> ...
                const achievementIds = args.slice(1);
                await this.achievements.notifyAchievements(message, achievementIds);
                return;
            }

            // Shop
            if (command === '!shop' || command === '!tienda') {
                const category = args[1];
                await this.shop.showShop(message, category);
                return;
            }
            if (command === '!buy' || command === '!comprar') {
                if (args.length < 2) {
                    await message.reply('❌ Uso: `!buy <item> [cantidad]`');
                    return;
                }
                const itemId = args[1];
                const quantity = parseInt(args[2]) || 1;
                await this.shop.buyItem(message, itemId, quantity);
                return;
            }
            if (command === '!use' || command === '!usar') {
                if (args.length < 2) {
                    await message.reply('❌ Uso: `!use <item>`');
                    return;
                }
                const itemId = args[1];
                await this.shop.useItem(message, itemId);
                return;
            }
            if (command === '!inventory' || command === '!inv' || command === '!inventario') {
                const targetUser = message.mentions.members?.first();
                await this.shop.showInventory(message, targetUser);
                return;
            }
            if (command === '!sell' || command === '!vender') {
                if (args.length < 2) {
                    await message.reply('❌ Uso: `!sell <item> [cantidad]`');
                    return;
                }
                const itemId = args[1];
                const quantity = parseInt(args[2]) || 1;
                await this.shop.sellItem(message, itemId, quantity);
                return;
            }
            if (command === '!shophelp' || command === '!ayudatienda') {
                await this.shopHelp(message);
                return;
            }

            // Betting
            if (command === '!bet' || command === '!apuesta') {
                await this.betting.createBet(message, args);
                return;
            }
            if (command === '!mybets' || command === '!misapuestas') {
                await this.betting.showActiveBets(message);
                return;
            }
            if (command === '!betstats' || command === '!estadisticasapuestas') {
                const targetUser = message.mentions.members?.first();
                await this.betting.showBetStats(message, targetUser);
                return;
            }
            // Para resolver/cancelar apuestas por comando (opcional, si usas botones puedes omitir)
            if (command === '!resolve') {
                if (args.length < 3) {
                    await message.reply('❌ Uso: `!resolve <betId> <ganador: challenger|opponent>`');
                    return;
                }
                // Aquí deberías llamar a betting.resolveBet si lo implementas por comando
                await message.reply('❌ Resolución manual por comando no implementada, usa los botones.');
                return;
            }

            // Help
            if (command === '!help' || command === '!ayuda') {
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
                { name: '🛒 !shop [categoría]', value: 'Ver la tienda y sus categorías', inline: false },
                { name: '💸 !buy <itemId> [cantidad]', value: 'Comprar un item de la tienda', inline: false },
                { name: '⚡ !use <itemId>', value: 'Usar un boost/cosmético', inline: false },
                { name: '🎒 !inventory [@usuario]', value: 'Ver tu inventario o el de otro usuario', inline: false },
                { name: '💰 !sell <itemId> [cantidad]', value: 'Vender items de tu inventario', inline: false }
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
                { name: '🏆 Logros', value: '`!achievements [@usuario]` - Ver logros\n`!allachievements` - Ver todos los logros', inline: false },
                { name: '🏅 Notificar Logros', value: '`!notifyachievements <id1> <id2> ...` - Notifica logros desbloqueados (admin/test)', inline: false },
                // Shop
                { name: '🛒 Tienda', value: '`!shop [categoría]`\n`!buy <item> [cantidad]`\n`!use <item>`\n`!inventory [@usuario]`\n`!sell <item> [cantidad]`\n`!shophelp`', inline: false },
                // Betting
                { name: '🎲 Apuestas', value: '`!bet @usuario <cantidad> <descripción>` - Crear apuesta\n`!mybets` - Ver tus apuestas activas\n`!betstats [@usuario]` - Ver estadísticas de apuestas', inline: false }
            )
            .setFooter({ text: 'Usa los comandos para interactuar con el bot.' })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    }
}

module.exports = EnhancedCommands;