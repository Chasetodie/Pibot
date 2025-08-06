const { EmbedBuilder } = require('discord.js');

class ShopSystem {
    constructor(economySystem) {
        this.economy = economySystem;

        this.shopItems = {
            xp_boost: {
                name: '⚡ XP Boost',
                description: 'Duplica tu XP por 1 hora',
                price: 2000,
                type: 'boost',
                duration: 3600000,
                category: 'boosts',
                emoji: '⚡',
                stackable: false
            },
            money_boost: {
                name: '💰 Money Boost',
                description: 'Duplica las ganancias de trabajo por 1 hora',
                price: 3000,
                type: 'boost',
                duration: 3600000,
                category: 'boosts',
                emoji: '💰',
                stackable: false
            },
            daily_boost: {
                name: '📅 Daily Boost',
                description: 'Tu próximo daily dará 50% más dinero',
                price: 1500,
                type: 'boost',
                duration: 'next_use',
                category: 'boosts',
                emoji: '📅',
                stackable: true,
                maxStack: 3
            },
            lucky_charm: {
                name: '🍀 Amuleto de la Suerte',
                description: 'Aumenta probabilidades de ganar en minijuegos por 30min',
                price: 5000,
                type: 'boost',
                duration: 1800000,
                category: 'boosts',
                emoji: '🍀',
                stackable: false
            },
            trophy_bronze: {
                name: '🥉 Trofeo de Bronce',
                description: 'Un trofeo básico para tu colección',
                price: 10000,
                type: 'collectible',
                category: 'trophies',
                emoji: '🥉',
                stackable: true,
                maxStack: 10
            },
            trophy_silver: {
                name: '🥈 Trofeo de Plata',
                description: 'Un trofeo elegante para tu colección',
                price: 25000,
                type: 'collectible',
                category: 'trophies',
                emoji: '🥈',
                stackable: true,
                maxStack: 5
            },
            trophy_gold: {
                name: '🥇 Trofeo de Oro',
                description: 'Un trofeo premium para verdaderos ganadores',
                price: 50000,
                type: 'collectible',
                category: 'trophies',
                emoji: '🥇',
                stackable: true,
                maxStack: 3
            },
            gem_ruby: {
                name: '💎 Rubí',
                description: 'Una gema preciosa de color rojo',
                price: 15000,
                type: 'collectible',
                category: 'gems',
                emoji: '💎',
                stackable: true,
                maxStack: 10
            },
            gem_emerald: {
                name: '💚 Esmeralda',
                description: 'Una gema preciosa de color verde',
                price: 20000,
                type: 'collectible',
                category: 'gems',
                emoji: '💚',
                stackable: true,
                maxStack: 10
            },
            gem_diamond: {
                name: '💍 Diamante',
                description: 'La gema más preciosa y brillante',
                price: 100000,
                type: 'collectible',
                category: 'gems',
                emoji: '💍',
                stackable: true,
                maxStack: 5
            },
            name_color: {
                name: '🌈 Color de Nombre',
                description: 'Cambia el color de tu nombre en embeds por 7 días',
                price: 8000,
                type: 'cosmetic',
                duration: 604800000,
                category: 'cosmetics',
                emoji: '🌈',
                stackable: false
            },
            custom_title: {
                name: '📜 Título Personalizado',
                description: 'Establece un título personalizado por 30 días',
                price: 20000,
                type: 'cosmetic',
                duration: 2592000000,
                category: 'cosmetics',
                emoji: '📜',
                stackable: false
            },
            vip_status: {
                name: '⭐ Estado VIP',
                description: 'Obtén beneficios VIP por 30 días',
                price: 50000,
                type: 'status',
                duration: 2592000000,
                category: 'premium',
                emoji: '⭐',
                stackable: false,
                benefits: {
                    xpMultiplier: 1.5,
                    cooldownReduction: 0.5,
                    dailyBonus: 1.25
                }
            }
        };

        this.categories = {
            boosts: { name: '⚡ Boosts Temporales', emoji: '⚡' },
            trophies: { name: '🏆 Trofeos', emoji: '🏆' },
            gems: { name: '💎 Gemas', emoji: '💎' },
            cosmetics: { name: '🎨 Cosméticos', emoji: '🎨' },
            premium: { name: '⭐ Premium', emoji: '⭐' }
        };
    }

    async showShop(message, category = null) {
        const user = this.economy.getUser(message.author.id);
        if (!category) {
            const embed = new EmbedBuilder()
                .setTitle('🛒 Tienda de Clarence')
                .setDescription('¡Bienvenido a la tienda! Selecciona una categoría:')
                .setColor('#9932CC')
                .setTimestamp();

            for (const [catId, catInfo] of Object.entries(this.categories)) {
                const itemsInCategory = Object.values(this.shopItems).filter(item => item.category === catId);
                embed.addFields({
                    name: `${catInfo.emoji} ${catInfo.name}`,
                    value: `${itemsInCategory.length} items disponibles\nUsa \`!shop ${catId}\``,
                    inline: true
                });
            }
            embed.addFields({
                name: '💰 Tu Balance',
                value: `${this.formatNumber(user.balance)} C$`,
                inline: false
            });
            await message.reply({ embeds: [embed] });
            return;
        }

        if (!this.categories[category]) {
            await message.reply('❌ Categoría no válida. Usa `!shop` para ver todas las categorías.');
            return;
        }

        const categoryItems = Object.entries(this.shopItems).filter(([id, item]) => item.category === category);
        if (categoryItems.length === 0) {
            await message.reply('❌ No hay items en esta categoría.');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${this.categories[category].emoji} ${this.categories[category].name}`)
            .setDescription(`${categoryItems.length} items disponibles`)
            .setColor('#9932CC')
            .setTimestamp();

        for (const [itemId, item] of categoryItems) {
            const owned = (user.inventory && user.inventory[itemId]) || 0;
            const ownedText = owned > 0 ? `\n*Tienes: ${owned}*` : '';
            const canAfford = user.balance >= item.price ? '✅' : '❌';
            embed.addFields({
                name: `${canAfford} ${item.emoji} ${item.name}`,
                value: `${item.description}\n**Precio:** ${this.formatNumber(item.price)} C${ownedText}\n*Usa: \`!buy ${itemId}\`*`,
                inline: true
            });
        }
        await message.reply({ embeds: [embed] });
    }

    async buyItem(message, itemId, quantity = 1) {
        const user = this.economy.getUser(message.author.id);
        const item = this.shopItems[itemId];
        if (!item) return message.reply('❌ Item no encontrado.');
        if (quantity < 1 || quantity > 10) return message.reply('❌ Cantidad debe ser entre 1 y 10.');
        if (!item.stackable && quantity > 1) return message.reply('❌ Este item no se puede comprar en cantidades mayores a 1.');

        const totalPrice = item.price * quantity;
        if (user.balance < totalPrice) return message.reply(`❌ No tienes suficiente dinero. Te faltan ${this.formatNumber(totalPrice - user.balance)} C$`);

        if (item.stackable && item.maxStack) {
            const currentAmount = (user.inventory && user.inventory[itemId]) || 0;
            if (currentAmount + quantity > item.maxStack) {
                const canBuy = item.maxStack - currentAmount;
                if (canBuy <= 0) return message.reply(`❌ Ya tienes el máximo de este item (${item.maxStack})`);
                return message.reply(`❌ Solo puedes comprar ${canBuy} más de este item (límite: ${item.maxStack})`);
            }
        }

        if (item.type === 'boost' && !item.stackable) {
            if (user.activeBoosts && user.activeBoosts[itemId] && user.activeBoosts[itemId].expiresAt > Date.now()) {
                return message.reply('❌ Ya tienes este boost activo. Espera a que expire para comprar otro.');
            }
        }

        this.economy.removeMoney(message.author.id, totalPrice, 'shop_purchase');
        if (!user.inventory) user.inventory = {};
        user.inventory[itemId] = (user.inventory[itemId] || 0) + quantity;
        this.economy.saveUsers();

        const embed = new EmbedBuilder()
            .setTitle('✅ Compra Exitosa')
            .setDescription(`Has comprado **${quantity}x ${item.emoji} ${item.name}**`)
            .addFields(
                { name: '💸 Gastado', value: `${this.formatNumber(totalPrice)} C$`, inline: true },
                { name: '💰 Balance Restante', value: `${this.formatNumber(user.balance)} C$`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();

        if (item.type === 'boost') {
            embed.addFields({ name: '📝 Nota', value: `Usa \`!use ${itemId}\` para activar tu boost`, inline: false });
        }
        await message.reply({ embeds: [embed] });
    }

    async useItem(message, itemId) {
        const user = this.economy.getUser(message.author.id);
        const item = this.shopItems[itemId];
        if (!item) return message.reply('❌ Item no encontrado.');
        if (!user.inventory || !user.inventory[itemId] || user.inventory[itemId] <= 0) return message.reply('❌ No tienes este item en tu inventario.');
        if (item.type === 'collectible') return message.reply('❌ Los items coleccionables no se pueden usar, solo coleccionar.');

        if (item.type === 'boost') {
            if (!user.activeBoosts) user.activeBoosts = {};
            if (user.activeBoosts[itemId] && user.activeBoosts[itemId].expiresAt > Date.now()) {
                const timeLeft = user.activeBoosts[itemId].expiresAt - Date.now();
                return message.reply(`❌ Ya tienes este boost activo. Tiempo restante: ${this.formatTime(timeLeft)}`);
            }
            if (item.duration === 'next_use') {
                user.activeBoosts[itemId] = { activatedAt: Date.now(), type: 'next_use' };
            } else {
                user.activeBoosts[itemId] = { activatedAt: Date.now(), expiresAt: Date.now() + item.duration, type: 'timed' };
            }
            user.inventory[itemId]--;
            if (user.inventory[itemId] <= 0) delete user.inventory[itemId];
            this.economy.saveUsers();

            const embed = new EmbedBuilder()
                .setTitle('✅ Boost Activado')
                .setDescription(`${item.emoji} **${item.name}** está ahora activo!`)
                .addFields({ name: '⏰ Duración', value: item.duration === 'next_use' ? 'Próximo uso' : this.formatTime(item.duration), inline: true })
                .setColor('#00FF00')
                .setTimestamp();
            await message.reply({ embeds: [embed] });
        }
    }

    async showInventory(message, targetUser = null) {
        const userId = targetUser ? targetUser.id : message.author.id;
        const displayName = targetUser ? targetUser.displayName : message.author.displayName;
        const user = this.economy.getUser(userId);

        if (!user.inventory || Object.keys(user.inventory).length === 0) {
            await message.reply(`${targetUser ? displayName : 'Tu'} inventario está vacío. Usa \`!shop\` para comprar items.`);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`🎒 Inventario de ${displayName}`)
            .setColor('#8A2BE2')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        const categories = {};
        for (const [itemId, quantity] of Object.entries(user.inventory)) {
            const item = this.shopItems[itemId];
            if (!item) continue;
            if (!categories[item.category]) categories[item.category] = [];
            categories[item.category].push({ item, quantity });
        }

        let totalValue = 0;
        for (const [category, items] of Object.entries(categories)) {
            const categoryInfo = this.categories[category];
            let text = '';
            for (const { item, quantity } of items) {
                const value = item.price * quantity;
                totalValue += value;
                text += `${item.emoji} **${item.name}** x${quantity}\nValor: ${this.formatNumber(value)} C$\n\n`;
            }
            embed.addFields({ name: `${categoryInfo.emoji} ${categoryInfo.name}`, value: text, inline: true });
        }
        embed.addFields({ name: '💰 Valor Total del Inventario', value: `${this.formatNumber(totalValue)} C$`, inline: false });

        // Boosts activos
        if (user.activeBoosts) {
            let activeBoostsText = '';
            const now = Date.now();
            for (const [boostId, boostData] of Object.entries(user.activeBoosts)) {
                const item = this.shopItems[boostId];
                if (!item) continue;
                if (boostData.type === 'next_use') {
                    activeBoostsText += `${item.emoji} **${item.name}** - Próximo uso\n`;
                } else if (boostData.expiresAt > now) {
                    const timeLeft = boostData.expiresAt - now;
                    activeBoostsText += `${item.emoji} **${item.name}** - ${this.formatTime(timeLeft)}\n`;
                }
            }
            if (activeBoostsText) {
                embed.addFields({ name: '⚡ Boosts Activos', value: activeBoostsText, inline: false });
            }
        }
        await message.reply({ embeds: [embed] });
    }

    async sellItem(message, itemId, quantity = 1) {
        const user = this.economy.getUser(message.author.id);
        const item = this.shopItems[itemId];
        if (!item) return message.reply('❌ Item no encontrado.');
        if (!user.inventory || !user.inventory[itemId] || user.inventory[itemId] < quantity) return message.reply('❌ No tienes suficientes items para vender.');

        const sellPrice = Math.floor(item.price * 0.7);
        const totalEarned = sellPrice * quantity;
        user.inventory[itemId] -= quantity;
        if (user.inventory[itemId] <= 0) delete user.inventory[itemId];
        this.economy.addMoney(message.author.id, totalEarned, 'item_sale');

        const embed = new EmbedBuilder()
            .setTitle('✅ Venta Exitosa')
            .setDescription(`Has vendido **${quantity}x ${item.emoji} ${item.name}**`)
            .addFields(
                { name: '💰 Ganado', value: `${this.formatNumber(totalEarned)} C$`, inline: true },
                { name: '💳 Nuevo Balance', value: `${this.formatNumber(user.balance)} C$`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    }

    formatTime(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    formatNumber(num) {
        return num.toLocaleString('es-ES');
    }
}

module.exports = ShopSystem;