const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class ShopSystem {
    constructor(economySystem) {
        this.economy = economySystem;
        
        // Catálogo completo de items
        this.shopItems = {
            // === CONSUMIBLES TEMPORALES ===
            'lucky_charm': {
                id: 'lucky_charm',
                name: '🍀 Amuleto de Suerte',
                description: 'Aumenta tus ganancias en trabajos y juegos por 2 horas',
                price: 2500,
                category: 'consumable',
                rarity: 'uncommon',
                effect: {
                    type: 'multiplier',
                    targets: ['work', 'games'],
                    multiplier: 1.5,
                    duration: 7200 // 2 horas en segundos
                },
                stackable: true,
                maxStack: 10
            },
            'energy_drink': {
                id: 'energy_drink',
                name: '⚡ Bebida Energética',
                description: 'Reduce el cooldown de trabajos a la mitad por 1 hora',
                price: 1500,
                category: 'consumable',
                rarity: 'common',
                effect: {
                    type: 'cooldown_reduction',
                    targets: ['work'],
                    reduction: 0.5, // 50% reducción
                    duration: 3600 // 1 hora
                },
                stackable: true,
                maxStack: 15
            },
            'double_xp_potion': {
                id: 'double_xp_potion',
                name: '📚 Poción de Doble XP',
                description: 'Duplica toda la experiencia ganada por 30 minutos',
                price: 3000,
                category: 'consumable',
                rarity: 'rare',
                effect: {
                    type: 'xp_multiplier',
                    targets: ['all'],
                    multiplier: 2.0,
                    duration: 1800 // 30 minutos
                },
                stackable: true,
                maxStack: 5
            },
            'robbery_kit': {
                id: 'robbery_kit',
                name: '🔧 Kit de Robo',
                description: 'Aumenta 30% probabilidad de éxito en robos por 1 uso',
                price: 2000,
                category: 'consumable',
                rarity: 'uncommon',
                effect: {
                    type: 'success_boost',
                    targets: ['robbery'],
                    boost: 0.3,
                    uses: 1 // Solo 1 uso
                },
                stackable: true,
                maxStack: 20
            },
            
            // === ITEMS PERMANENTES ===
            'vip_pass': {
                id: 'vip_pass',
                name: '👑 Pase VIP',
                description: 'Acceso permanente a comandos VIP y bonificaciones especiales',
                price: 25000,
                category: 'permanent',
                rarity: 'epic',
                effect: {
                    type: 'permanent_upgrade',
                    benefits: ['vip_commands', 'daily_bonus', 'priority_support']
                },
                stackable: false,
                maxStack: 1
            },
            'money_magnet': {
                id: 'money_magnet',
                name: '🧲 Imán de Dinero',
                description: '+10% ganancias permanentes en todos los comandos',
                price: 15000,
                category: 'permanent',
                rarity: 'rare',
                effect: {
                    type: 'permanent_multiplier',
                    targets: ['all'],
                    multiplier: 1.1
                },
                stackable: false,
                maxStack: 1
            },
            'work_boots': {
                id: 'work_boots',
                name: '👢 Botas de Trabajo',
                description: 'Reduce permanentemente el cooldown de trabajo en 20%',
                price: 8000,
                category: 'permanent',
                rarity: 'uncommon',
                effect: {
                    type: 'permanent_cooldown',
                    targets: ['work'],
                    reduction: 0.2
                },
                stackable: false,
                maxStack: 1
            },
            
            // === DECORATIVOS ===
            'golden_trophy': {
                id: 'golden_trophy',
                name: '🏆 Trofeo Dorado',
                description: 'Muestra tu estatus de campeón en tu perfil',
                price: 5000,
                category: 'cosmetic',
                rarity: 'uncommon',
                effect: {
                    type: 'cosmetic',
                    display: 'profile_trophy'
                },
                stackable: false,
                maxStack: 1
            },
            'rainbow_badge': {
                id: 'rainbow_badge',
                name: '🌈 Insignia Arcoíris',
                description: 'Una hermosa insignia que aparece en tu perfil',
                price: 3500,
                category: 'cosmetic',
                rarity: 'common',
                effect: {
                    type: 'cosmetic',
                    display: 'profile_badge'
                },
                stackable: false,
                maxStack: 1
            },
            
            // === ESPECIALES ===
            'mystery_box': {
                id: 'mystery_box',
                name: '📦 Caja Misteriosa',
                description: 'Contiene un item aleatorio del valor de 1000-10000 π-b$',
                price: 4000,
                category: 'mystery',
                rarity: 'rare',
                effect: {
                    type: 'mystery',
                    minValue: 1000,
                    maxValue: 10000
                },
                stackable: true,
                maxStack: 50
            },

            'anti_theft_shield': {
                id: 'anti_theft_shield',
                name: '🛡️ Escudo Antirrobo',
                description: 'Te protege de robos por 24 horas',
                price: 8000,
                category: 'consumable',
                rarity: 'epic',
                effect: {
                    type: 'protection',
                    targets: ['robbery'],
                    duration: 86400 // 24 horas en segundos
                },
                stackable: true,
                maxStack: 5
            },

            'permanent_vault': {
                id: 'permanent_vault',
                name: '🏦 Bóveda Permanente',
                description: 'Protección permanente contra robos (reduce probabilidad 80%)',
                price: 25000,
                category: 'permanent',
                rarity: 'legendary',
                effect: {
                    type: 'permanent_protection',
                    targets: ['robbery'],
                    reduction: 0.8 // Reduce 80% probabilidad de ser robado
                },
                stackable: false,
                maxStack: 1
            },

            // === NUEVOS CONSUMIBLES TEMPORALES ===
            'mega_luck_potion': {
                id: 'mega_luck_potion',
                name: '🍀 Mega Poción de Suerte',
                description: 'Aumenta dramáticamente la suerte en todos los juegos por 1 hora',
                price: 5000,
                category: 'consumable',
                rarity: 'epic',
                effect: {
                    type: 'luck_boost',
                    targets: ['games', 'all'],
                    boost: 0.25, // +25% probabilidad de ganar
                    duration: 3600 // 1 hora
                },
                stackable: true,
                maxStack: 5
            },

            'speed_boots': {
                id: 'speed_boots',
                name: '👟 Botas de Velocidad',
                description: 'Elimina todos los cooldowns por 20 minutos',
                price: 7500,
                category: 'consumable',
                rarity: 'rare',
                effect: {
                    type: 'no_cooldown',
                    targets: ['all'],
                    duration: 1200 // 20 minutos
                },
                stackable: true,
                maxStack: 3
            },

            'xp_tornado': {
                id: 'xp_tornado',
                name: '🌪️ Tornado de XP',
                description: 'x5 XP de todos los mensajes por 15 minutos',
                price: 4500,
                category: 'consumable',
                rarity: 'epic',
                effect: {
                    type: 'xp_multiplier',
                    targets: ['all'],
                    multiplier: 5.0,
                    duration: 900 // 15 minutos
                },
                stackable: true,
                maxStack: 3
            },

            'golden_pickaxe': {
                id: 'golden_pickaxe',
                name: '⛏️ Pico Dorado',
                description: 'Triplica las ganancias de trabajo por 3 usos',
                price: 6000,
                category: 'consumable',
                rarity: 'rare',
                effect: {
                    type: 'work_multiplier',
                    targets: ['work'],
                    multiplier: 3.0,
                    uses: 3
                },
                stackable: true,
                maxStack: 10
            },

            // === NUEVOS ITEMS PERMANENTES ===
            'diamond_membership': {
                id: 'diamond_membership',
                name: '💎 Membresía Diamante',
                description: 'Membresía premium por 30 días con beneficios exclusivos',
                price: 50000,
                category: 'permanent',
                rarity: 'legendary',
                effect: {
                    type: 'vip_membership',
                    duration: 30 * 24 * 60 * 60 * 1000, // 30 días en ms
                    benefits: [
                        'no_cooldowns',
                        'double_earnings',
                        'luck_boost',
                        'priority_support',
                        'exclusive_commands',
                        'custom_nickname'
                    ]
                },
                stackable: false,
                maxStack: 1
            },

            'luck_charm_permanent': {
                id: 'luck_charm_permanent',
                name: '🍀 Amuleto de Suerte Permanente',
                description: '+15% suerte permanente en todos los juegos',
                price: 20000,
                category: 'permanent',
                rarity: 'epic',
                effect: {
                    type: 'permanent_luck',
                    targets: ['games', 'all'],
                    boost: 0.15
                },
                stackable: false,
                maxStack: 1
            },

            'auto_worker': {
                id: 'auto_worker',
                name: '🤖 Trabajador Automático',
                description: 'Genera dinero pasivo cada hora (500-1500 π-b$)',
                price: 35000,
                category: 'permanent',
                rarity: 'legendary',
                effect: {
                    type: 'passive_income',
                    minAmount: 500,
                    maxAmount: 1500,
                    interval: 3600000 // 1 hora en ms
                },
                stackable: false,
                maxStack: 1
            },

            // === ITEMS ESPECIALES ===
            'custom_nickname_token': {
                id: 'custom_nickname_token',
                name: '🏷️ Token de Apodo Personalizado',
                description: 'Permite cambiar tu apodo una vez',
                price: 8000,
                category: 'special',
                rarity: 'rare',
                effect: {
                    type: 'nickname_change',
                    uses: 1
                },
                stackable: true,
                maxStack: 5
            },

            'premium_mystery_box': {
                id: 'premium_mystery_box',
                name: '🎁 Caja Premium Misteriosa',
                description: 'Contiene items raros o legendarios (5000-25000 π-b$ valor)',
                price: 12000,
                category: 'mystery',
                rarity: 'epic',
                effect: {
                    type: 'premium_mystery',
                    minValue: 5000,
                    maxValue: 25000,
                    rarityBonus: true
                },
                stackable: true,
                maxStack: 20
            },

            // === NUEVOS COSMÉTICOS ===
            'diamond_crown': {
                id: 'diamond_crown',
                name: '👑 Corona de Diamante',
                description: 'Una corona brillante que muestra tu estatus real',
                price: 15000,
                category: 'cosmetic',
                rarity: 'legendary',
                effect: {
                    type: 'cosmetic',
                    display: 'profile_crown',
                    prestige: 10
                },
                stackable: false,
                maxStack: 1
            },

            'fire_badge': {
                id: 'fire_badge',
                name: '🔥 Insignia de Fuego',
                description: 'Una insignia ardiente para los más activos',
                price: 6000,
                category: 'cosmetic',
                rarity: 'epic',
                effect: {
                    type: 'cosmetic',
                    display: 'profile_badge',
                    prestige: 5
                },
                stackable: false,
                maxStack: 1
            },

            'vip_frame': {
                id: 'vip_frame',
                name: '🖼️ Marco VIP',
                description: 'Un marco dorado para tu perfil que demuestra tu estatus VIP',
                price: 12000,
                category: 'cosmetic',
                rarity: 'epic',
                effect: {
                    type: 'cosmetic',
                    display: 'profile_frame'
                },
                stackable: false,
                maxStack: 1
            }
        };
        
        // Colores por rareza
        this.rarityColors = {
            'common': '#FFFFFF',
            'uncommon': '#1EFF00', 
            'rare': '#0099FF',
            'epic': '#CC00FF',
            'legendary': '#FF6600'
        };
        
        this.rarityEmojis = {
            'common': '⚪',
            'uncommon': '🟢',
            'rare': '🔵', 
            'epic': '🟣',
            'legendary': '🟠'
        };

        // AGREGAR ESTAS LÍNEAS:
        this.itemCache = new Map();
        this.cacheTimeout = 10 * 60 * 1000; // 10 minutos para items        
    }

    // AGREGAR esta función:
    getCachedItems() {
        const cached = this.itemCache.get('shop_items');
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < this.cacheTimeout) {
            return cached.items;
        }
        return null;
    }

    setCachedItems(items) {
        this.itemCache.set('shop_items', {
            items: items,
            timestamp: Date.now()
        });
    }
    
    // === TIENDA ===
    async showShop(message, category = 'all', page = 1) {
        let items = Object.values(this.shopItems);
        
        if (category !== 'all') {
            items = items.filter(item => item.category === category);
        }
        
        const itemsPerPage = 5;
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageItems = items.slice(startIndex, endIndex);
        const totalPages = Math.ceil(items.length / itemsPerPage);
        
        if (pageItems.length === 0) {
            await message.reply('❌ No hay items en esta categoría.');
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🏪 Tienda del Servidor')
            .setDescription(`Página ${page}/${totalPages} - Categoría: ${category === 'all' ? 'Todas' : category}`)
            .setColor('#FFD700')
            .setTimestamp();
        
        for (const item of pageItems) {
            const rarityEmoji = this.rarityEmojis[item.rarity];
            const priceFormatted = item.price.toLocaleString('es-ES');
            
            let effectDesc = '';
            if (item.effect.duration) {
                const hours = Math.floor(item.effect.duration / 3600);
                const minutes = Math.floor((item.effect.duration % 3600) / 60);
                effectDesc = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            } else if (item.effect.uses) {
                effectDesc = `${item.effect.uses} uso${item.effect.uses > 1 ? 's' : ''}`;
            } else if (item.category === 'permanent') {
                effectDesc = 'Permanente';
            }
            
            embed.addFields({
                name: `${rarityEmoji} ${item.name}`,
                value: `${item.description}\n💰 **${priceFormatted} π-b$** ${effectDesc ? `| ⏱️ ${effectDesc}` : ''}\n**item_id:** ${item.id}`,
                inline: false
            });
        }
        
        // Botones de navegación
        const row = new ActionRowBuilder();
        
        if (page > 1) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`shop_prev_${category}_${page - 1}`)
                    .setLabel('◀️ Anterior')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        
        if (page < totalPages) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`shop_next_${category}_${page + 1}`)
                    .setLabel('Siguiente ▶️')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        
        // Menú de categorías
        const categoryRow = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('shop_category')
                    .setPlaceholder('Selecciona una categoría')
                    .addOptions([
                        {
                            label: 'Todas las categorías',
                            value: 'all',
                            emoji: '🛒'
                        },
                        {
                            label: 'Consumibles',
                            value: 'consumable', 
                            emoji: '🧪'
                        },
                        {
                            label: 'Permanentes',
                            value: 'permanent',
                            emoji: '💎'
                        },
                        {
                            label: 'Cosméticos',
                            value: 'cosmetic',
                            emoji: '✨'
                        },
                        {
                            label: 'Especiales',
                            value: 'mystery',
                            emoji: '🎁'
                        }
                    ])
            );
        
        const components = [categoryRow];
        if (row.components.length > 0) {
            components.push(row);
        }
        
        embed.setFooter({ text: 'Usa >buy <item_id> para comprar un item' });
        
        await message.reply({ embeds: [embed], components });
    }
    
    async hasVipAccess(userId) {
        const user = await this.economy.getUser(userId);
        const permanentEffects = user.permanentEffects || {};
        
        for (const effect of Object.values(permanentEffects)) {
            if (effect.benefits && effect.benefits.includes('vip_commands')) {
                return true;
            }
        }
        return false;
    }

    // === COMPRAR ITEM ===
    async buyItem(message, itemId, quantity = 1) {
        const item = this.shopItems[itemId];
        if (!item) {
            await message.reply('❌ Item no encontrado. Usa `>shop` para ver los items disponibles.');
            return;
        }
        
        const user = await this.economy.getUser(message.author.id);
        const totalCost = item.price * quantity;
        
        if (user.balance < totalCost) {
            await message.reply(`❌ No tienes suficiente dinero. Necesitas **${totalCost.toLocaleString('es-ES')} π-b$**.`);
            return;
        }
        
        // Verificar límites de stack
        const userItems = user.items || {};
        const currentQuantity = userItems[itemId] ? userItems[itemId].quantity : 0;
        
        if (!item.stackable && currentQuantity >= 1) {
            await message.reply(`❌ **${item.name}** no es stackeable y ya lo tienes.`);
            return;
        }
        
        if (currentQuantity + quantity > item.maxStack) {
            await message.reply(`❌ No puedes tener más de **${item.maxStack}** de este item.`);
            return;
        }
        
        // Realizar compra
        const newBalance = user.balance - totalCost;
        const newItems = { ...userItems };
        
        if (newItems[itemId]) {
            newItems[itemId].quantity += quantity;
        } else {
            newItems[itemId] = {
                id: itemId,
                quantity: quantity,
                purchaseDate: new Date().toISOString()
            };
        }
        
        await this.economy.updateUser(message.author.id, {
            balance: newBalance,
            items: newItems
        });
        
        const rarityEmoji = this.rarityEmojis[item.rarity];
        const embed = new EmbedBuilder()
            .setTitle('✅ Compra Exitosa')
            .setDescription(`${rarityEmoji} **${item.name}** x${quantity}\n\n${item.description}`)
            .setColor(this.rarityColors[item.rarity])
            .addFields(
                { name: '💰 Costo Total', value: `${totalCost.toLocaleString('es-ES')} π-b$`, inline: true },
                { name: '💳 Balance Restante', value: `${newBalance.toLocaleString('es-ES')} π-b$`, inline: true }
            )
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }
    
    // === VER INVENTARIO ===
    async showBag(message, targetUser = null) {
        const userId = targetUser ? targetUser.id : message.author.id;
        const displayName = targetUser ? targetUser.displayName : message.author.displayName;
        
        const user = await this.economy.getUser(userId);
        const userItems = user.items || {};
        const activeEffects = user.activeEffects || {};
        
        if (Object.keys(userItems).length === 0) {
            await message.reply(`📦 ${displayName} no tiene items en su inventario.`);
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`🎒 Inventario de ${displayName}`)
            .setColor('#4CAF50')
            .setThumbnail((targetUser || message.author).displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        
        let inventoryText = '';
        let totalValue = 0;
        
        for (const [itemId, userItem] of Object.entries(userItems)) {
            const item = this.shopItems[itemId];
            if (!item) continue;
            
            const rarityEmoji = this.rarityEmojis[item.rarity];
            const quantity = userItem.quantity;
            const value = item.price * quantity;
            totalValue += value;
            
            // Verificar si hay efectos activos
            const hasActiveEffect = activeEffects[itemId] && activeEffects[itemId].length > 0;
            const activeText = hasActiveEffect ? ' 🔥' : '';
            
            inventoryText += `${rarityEmoji} **${item.name}**${activeText}\n`;
            inventoryText += `├ Cantidad: x${quantity}\n`;
            inventoryText += `├ Valor: ${value.toLocaleString('es-ES')} π-b$\n`;
            inventoryText += `└ ID: \`${itemId}\`\n\n`;
        }
        
        embed.setDescription(inventoryText || 'No tienes comprado ningun item');
        embed.addFields(
            { name: '💎 Valor Total', value: `${totalValue.toLocaleString('es-ES')} π-b$`, inline: true },
            { name: '📊 Items Únicos', value: `${Object.keys(userItems).length}`, inline: true }
        );
        
        // Mostrar efectos activos
        if (Object.keys(activeEffects).length > 0) {
            let effectsText = '';
            for (const [itemId, effects] of Object.entries(activeEffects)) {
                const item = this.shopItems[itemId];
                if (!item || !effects.length) continue;
                
                for (const effect of effects) {
                    const timeLeft = Math.max(0, effect.expiresAt - Date.now());
                    if (timeLeft <= 0) continue;
                    
                    const minutes = Math.floor(timeLeft / 60000);
                    const seconds = Math.floor((timeLeft % 60000) / 1000);
                    effectsText += `🔥 **${item.name}**: ${minutes}m ${seconds}s restantes\n`;
                }
            }
            
            if (effectsText) {
                embed.addFields({ name: '⚡ Efectos Activos', value: effectsText, inline: false });
            }
        }
        
        embed.setFooter({ text: 'Usa >useitem <id> para usar un item' });
        
        await message.reply({ embeds: [embed] });
    }
    
    // === USAR ITEM ===
    async useItem(message, itemIdentifier) {
        const user = await this.economy.getUser(message.author.id);
        const userItems = user.items || {};
        
        // Buscar item por ID o nombre
        let itemId = itemIdentifier.toLowerCase();
        let item = this.shopItems[itemId];
        
        if (!item) {
            // Buscar por nombre
            const foundItem = Object.values(this.shopItems).find(i => 
                i.name.toLowerCase().includes(itemIdentifier.toLowerCase())
            );
            if (foundItem) {
                itemId = foundItem.id;
                item = foundItem;
            }
        }
        
        if (!item) {
            await message.reply('❌ Item no encontrado. Revisa tu inventario con `>bag`.');
            return;
        }
        
        if (!userItems[itemId] || userItems[itemId].quantity <= 0) {
            await message.reply(`❌ No tienes **${item.name}** en tu inventario.`);
            return;
        }
        
        // Procesar uso del item
        const result = await this.processItemUse(message.author.id, itemId, item);
        
        if (result.success) {
            // Reducir cantidad del item
            const newItems = { ...userItems };
            newItems[itemId].quantity -= 1;
            
            if (newItems[itemId].quantity <= 0) {
                delete newItems[itemId];
            }
            
            await this.economy.updateUser(message.author.id, { items: newItems });
            
            const rarityEmoji = this.rarityEmojis[item.rarity];
            const embed = new EmbedBuilder()
                .setTitle('✅ Item Usado')
                .setDescription(`${rarityEmoji} **${item.name}**\n\n${result.message}`)
                .setColor(this.rarityColors[item.rarity])
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
        } else {
            await message.reply(`❌ ${result.message}`);
        }
    }
    
    // === PROCESAR USO DE ITEM ===
    async processItemUse(userId, itemId, item) {
        const user = await this.economy.getUser(userId);
        
        switch (item.category) {
            case 'consumable':
                return await this.applyConsumableEffect(userId, itemId, item);
            case 'permanent':
                return await this.applyPermanentEffect(userId, itemId, item);
            case 'mystery':
                return await this.openMysteryBox(userId, item);
            case 'cosmetic':
                return { success: true, message: `${item.name} ahora está equipado en tu perfil.` };
            case 'special':
                if (item.effect.type === 'nickname_change') {
                    return await this.handleNicknameChange(userId, item);
                }    
                return { success: false, message: 'Item especial no implementado.' };
            default:
                return { success: false, message: 'Este item no se puede usar.' };
        }
    }

    async handleNicknameChange(userId, item) {
        // Guardar que el usuario tiene un token activo
        const user = await this.economy.getUser(userId);
        const activeTokens = user.activeTokens || {};
        
        activeTokens.nickname_change = {
            expires: Date.now() + 300000, // 5 minutos para usar
            uses: 1
        };
        
        await this.economy.updateUser(userId, { activeTokens });
        
        return {
            success: true,
            message: 'Token de apodo activado! Usa `>setnick <tu_apodo>` en los próximos 5 minutos.'
        };
    }

    async setCustomNickname(message, nickname) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
        const activeTokens = user.activeTokens || {};
        
        if (!activeTokens.nickname_change || activeTokens.nickname_change.expires < Date.now()) {
            await message.reply('❌ No tienes un token de apodo activo. Compra uno en la tienda!');
            return;
        }
        
        if (!nickname || nickname.length > 20) {
            await message.reply('❌ El apodo debe tener entre 1 y 20 caracteres.');
            return;
        }
        
        // Filtro de palabras prohibidas (básico)
        const forbiddenWords = ['admin', 'mod', 'bot', 'discord', 'everyone', 'here'];
        if (forbiddenWords.some(word => nickname.toLowerCase().includes(word))) {
            await message.reply('❌ El apodo contiene palabras no permitidas.');
            return;
        }
        
        try {
            // Obtener número del usuario
            const userNumber = await this.getUserNumber(userId);
            const newNickname = `Pibe ${userNumber} - ${nickname}`;
            
            // Intentar cambiar el nickname en el servidor
            await message.member.setNickname(newNickname);
            
            // Guardar el apodo personalizado
            const newActiveTokens = { ...activeTokens };
            delete newActiveTokens.nickname_change;
            
            const userProfile = user.profile || {};
            userProfile.customNickname = nickname;
            userProfile.nicknameSetAt = Date.now();
            
            await this.economy.updateUser(userId, { 
                activeTokens: newActiveTokens,
                profile: userProfile
            });
            
            const embed = new EmbedBuilder()
                .setTitle('🏷️ Apodo Cambiado!')
                .setDescription(`Tu nuevo apodo es: **${newNickname}**`)
                .setColor('#00FF00')
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error cambiando nickname:', error);
            await message.reply('❌ No pude cambiar tu nickname. Puede que no tenga permisos.');
        }
    }

    async getUserNumber(userId) {
        // Generar un número único basado en el ID del usuario
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir a entero de 32 bits
        }
        return Math.abs(hash) % 9999 + 1; // Número entre 1 y 9999
    }
    
    // === APLICAR EFECTO CONSUMIBLE ===
    async applyConsumableEffect(userId, itemId, item) {
        const user = await this.economy.getUser(userId);
        const activeEffects = user.activeEffects || {};
        
        // Verificar si el efecto ya está activo (para items de 1 uso)
        if (item.effect.uses && activeEffects[itemId] && activeEffects[itemId].length > 0) {
            const remainingUses = activeEffects[itemId][0].usesLeft || 0;
            if (remainingUses > 0) {
                return { success: false, message: 'Este item ya está activo y no puedes usar otro.' };
            }
        }
        
        const now = Date.now();
        const effect = {
            type: item.effect.type,
            targets: item.effect.targets,
            multiplier: item.effect.multiplier,
            reduction: item.effect.reduction,
            boost: item.effect.boost,
            appliedAt: now,
            expiresAt: item.effect.duration ? now + (item.effect.duration * 1000) : null,
            usesLeft: item.effect.uses || null
        };
        
        if (!activeEffects[itemId]) {
            activeEffects[itemId] = [];
        }
        activeEffects[itemId].push(effect);
        
        await this.economy.updateUser(userId, { activeEffects });
        
        let durationText = '';
        if (item.effect.duration) {
            const minutes = Math.floor(item.effect.duration / 60);
            const hours = Math.floor(minutes / 60);
            durationText = hours > 0 ? `por ${hours}h ${minutes % 60}m` : `por ${minutes}m`;
        } else if (item.effect.uses) {
            durationText = `por ${item.effect.uses} uso${item.effect.uses > 1 ? 's' : ''}`;
        }
        
        return { 
            success: true, 
            message: `¡Efecto aplicado! ${item.description} ${durationText}.` 
        };
    }
    
    // === APLICAR EFECTO PERMANENTE ===
    async applyPermanentEffect(userId, itemId, item) {
        const user = await this.economy.getUser(userId);
        const permanentEffects = user.permanentEffects || {};
        
        if (permanentEffects[itemId]) {
            return { success: false, message: 'Ya tienes este efecto permanente activo.' };
        }
        
        permanentEffects[itemId] = {
            type: item.effect.type,
            targets: item.effect.targets,
            multiplier: item.effect.multiplier,
            reduction: item.effect.reduction,
            benefits: item.effect.benefits,
            appliedAt: Date.now()
        };
        
        await this.economy.updateUser(userId, { permanentEffects });
        
        return { 
            success: true, 
            message: `¡Efecto permanente activado! ${item.description}` 
        };
    }
    
    // === ABRIR CAJA MISTERIOSA ===
    async openMysteryBox(userId, item) {
        const possibleItems = Object.values(this.shopItems).filter(i => 
            i.price >= item.effect.minValue && 
            i.price <= item.effect.maxValue &&
            i.id !== 'mystery_box'
        );
        
        if (possibleItems.length === 0) {
            // Dar dinero si no hay items
            const amount = Math.floor(Math.random() * (item.effect.maxValue - item.effect.minValue)) + item.effect.minValue;
            const user = await this.economy.getUser(userId);
            await this.economy.updateUser(userId, { balance: user.balance + amount });
            
            return { 
                success: true, 
                message: `¡Encontraste **${amount.toLocaleString('es-ES')} π-b$** en la caja!` 
            };
        }
        
        const wonItem = possibleItems[Math.floor(Math.random() * possibleItems.length)];
        const user = await this.economy.getUser(userId);
        const userItems = user.items || {};
        
        if (userItems[wonItem.id]) {
            userItems[wonItem.id].quantity += 1;
        } else {
            userItems[wonItem.id] = {
                id: wonItem.id,
                quantity: 1,
                purchaseDate: new Date().toISOString()
            };
        }
        
        await this.economy.updateUser(userId, { items: userItems });
        
        const rarityEmoji = this.rarityEmojis[wonItem.rarity];
        return { 
            success: true, 
            message: `¡Felicidades! Obtuviste ${rarityEmoji} **${wonItem.name}**!` 
        };
    }
       
    // === OBTENER MULTIPLICADORES ACTIVOS ===
    async getActiveMultipliers(userId, action) {
        const user = await this.economy.getUser(userId);
        const activeEffects = user.activeEffects || {};
        const permanentEffects = user.permanentEffects || {};
        
        let totalMultiplier = 1.0;
        let totalReduction = 0.0;
        
        // Efectos temporales
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            for (const effect of effects) {
                if (effect.expiresAt && effect.expiresAt < Date.now()) continue;
                if (!effect.targets.includes(action) && !effect.targets.includes('all')) continue;
                
                if (effect.multiplier) totalMultiplier *= effect.multiplier;
                if (effect.reduction) totalReduction += effect.reduction;
            }
        }
        
        // Efectos permanentes
        for (const [itemId, effect] of Object.entries(permanentEffects)) {
            if (!effect.targets.includes(action) && !effect.targets.includes('all')) continue;
            
            if (effect.multiplier) totalMultiplier *= effect.multiplier;
            if (effect.reduction) totalReduction += effect.reduction;
        }

        const vipMultipliers = await this.getVipMultipliers(userId, action);
        totalMultiplier *= vipMultipliers.multiplier;
        
        return { multiplier: totalMultiplier, reduction: Math.min(totalReduction, 0.9) };
    }

    async cleanupExpiredTokens(userId) {
        const user = await this.economy.getUser(userId);
        const activeTokens = user.activeTokens || {};
        const now = Date.now();
        
        let hasChanges = false;
        for (const [tokenType, tokenData] of Object.entries(activeTokens)) {
            if (tokenData.expires < now) {
                delete activeTokens[tokenType];
                hasChanges = true;
            }
        }
        
        if (hasChanges) {
            await this.economy.updateUser(userId, { activeTokens });
        }
    }

    async isProtectedFromTheft(userId) {
        const user = await this.economy.getUser(userId);
        const activeEffects = user.activeEffects || {};
        const permanentEffects = user.permanentEffects || {};
        
        // Verificar protección temporal (escudo)
        if (activeEffects['anti_theft_shield']) {
            for (const effect of activeEffects['anti_theft_shield']) {
                if (effect.expiresAt && effect.expiresAt > Date.now()) {
                    return { protected: true, type: 'shield' };
                }
            }
        }
        
        // Verificar bóveda permanente
        if (permanentEffects['permanent_vault']) {
            const roll = Math.random();
            if (roll < 0.8) { // 80% probabilidad de protección
                return { protected: true, type: 'vault' };
            }
        }
        
        return { protected: false };
    }

    // Verificar si el usuario tiene VIP activo con tiempo
    async hasActiveVip(userId) {
        const user = await this.economy.getUser(userId);
        const permanentEffects = user.permanentEffects || {};
        
        for (const [itemId, effect] of Object.entries(permanentEffects)) {
            if (effect.type === 'vip_membership') {
                const now = Date.now();
                const expiresAt = effect.appliedAt + effect.duration;
                
                if (now < expiresAt) {
                    const timeLeft = expiresAt - now;
                    return {
                        hasVip: true,
                        timeLeft: timeLeft,
                        tier: this.getVipTier(effect.benefits)
                    };
                } else {
                    // VIP expirado, remover
                    delete permanentEffects[itemId];
                    await this.economy.updateUser(userId, { permanentEffects });
                }
            }
        }
        return { hasVip: false };
    }

    // Obtener tier de VIP basado en beneficios
    getVipTier(benefits) {
        if (benefits.includes('diamond_membership')) return 'Diamond 💎';
        if (benefits.includes('custom_nickname')) return 'Premium 👑';
        return 'VIP ⭐';
    }  
    
    // Obtener multiplicadores VIP
    async getVipMultipliers(userId, action) {
        const vipStatus = await this.hasActiveVip(userId);
        if (!vipStatus.hasVip) return { multiplier: 1.0, luckBoost: 0, noCooldown: false };
        
        const user = await this.economy.getUser(userId);
        const permanentEffects = user.permanentEffects || {};
        
        let multiplier = 1.0;
        let luckBoost = 0;
        let noCooldown = false;
        
        for (const effect of Object.values(permanentEffects)) {
            if (effect.type === 'vip_membership' && effect.benefits) {
                if (effect.benefits.includes('double_earnings')) {
                    multiplier *= 2.0; // VIP duplica ganancias
                }
                if (effect.benefits.includes('luck_boost')) {
                    luckBoost += 0.20; // +20% suerte
                }
                if (effect.benefits.includes('no_cooldowns')) {
                    noCooldown = true; // Sin cooldowns
                }
            }
        }
        
        return { multiplier, luckBoost, noCooldown };
    }

    // Verificar si puede usar comando VIP
    async canUseVipCommand(userId, commandName) {
        const vipStatus = await this.hasActiveVip(userId);
        if (!vipStatus.hasVip) {
            return {
                canUse: false,
                reason: 'Necesitas membresía VIP para usar este comando.'
            };
        }
        
        const user = await this.economy.getUser(userId);
        const permanentEffects = user.permanentEffects || {};
        
        for (const effect of Object.values(permanentEffects)) {
            if (effect.type === 'vip_membership' && effect.benefits) {
                if (effect.benefits.includes('exclusive_commands')) {
                    return { canUse: true };
                }
            }
        }
        
        return {
            canUse: false,
            reason: 'Tu nivel VIP no incluye comandos exclusivos.'
        };
    }
    
    // === COMANDOS ===
    async processCommand(message) {
        if (message.author.bot) return;
        
        const args = message.content.toLowerCase().split(' ');
        const command = args[0];
        
        try {
            switch (command) {
                case '>shop':
                case '>tienda':
                    const category = args[1] || 'all';
                    const page = parseInt(args[2]) || 1;
                    await this.showShop(message, category, page);
                    break;
                    
                case '>buy':
                case '>comprar':
                    if (!args[1]) {
                        await message.reply('❌ Especifica el ID del item. Ejemplo: `>buy lucky_charm`');
                        return;
                    }
                    const quantity = parseInt(args[2]) || 1;
                    await this.buyItem(message, args[1], quantity);
                    break;
                    
                case '>bag':
                case '>inventario':
                case '>inv':
                    let targetUser = null;
                    if (message.mentions.users.size > 0) {
                        targetUser = message.mentions.users.first();
                    }
                    await this.showBag(message, targetUser);
                    break;
                    
                case '>useitem':
                case '>usar':
                case '>use':
                    if (!args[1]) {
                        await message.reply('❌ Especifica el ID o nombre del item. Ejemplo: `>useitem lucky_charm`');
                        return;
                    }
                    await this.useItem(message, args.slice(1).join(' '));
                    break;
            }
        } catch (error) {
            console.error('❌ Error en sistema de tienda:', error);
            await message.reply('❌ Ocurrió un error en la tienda. Intenta de nuevo.');
        }
    }
}

module.exports = ShopSystem;
