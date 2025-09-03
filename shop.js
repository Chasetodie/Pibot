const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const heavyUsersCache = new Map();

class ShopSystem {
    constructor(economySystem) {
        this.economy = economySystem;
        
        this.shopItems = {
            // === CONSUMIBLES TEMPORALES ===
            'lucky_charm': {
                id: 'lucky_charm',
                name: '🍀 Amuleto de Suerte',
                description: 'Aumenta tus ganancias en trabajos y juegos por 2 horas',
                price: 100000,
                category: 'consumable',
                rarity: 'uncommon',
                effect: {
                    type: 'multiplier',
                    targets: ['work', 'games'],
                    multiplier: 1.25,
                    duration: 7200
                },
                stackable: true,
                maxStack: 5
            },
            'energy_drink': {
                id: 'energy_drink',
                name: '⚡ Bebida Energética',
                description: 'Reduce el cooldown de trabajos a la mitad por 1 hora',
                price: 75000,
                category: 'consumable',
                rarity: 'common',
                effect: {
                    type: 'cooldown_reduction',
                    targets: ['work'],
                    reduction: 0.5,
                    duration: 3600
                },
                stackable: true,
                maxStack: 10
            },
            'double_xp_potion': {
                id: 'double_xp_potion',
                name: '📚 Poción de Doble XP',
                description: 'Duplica toda la experiencia ganada por 30 minutos',
                price: 250000,
                category: 'consumable',
                rarity: 'rare',
                effect: {
                    type: 'xp_multiplier',
                    targets: ['all'],
                    multiplier: 2.0,
                    duration: 1800
                },
                stackable: true,
                maxStack: 3
            },
            'robbery_kit': {
                id: 'robbery_kit',
                name: '🔧 Kit de Robo',
                description: 'Aumenta 30% probabilidad de éxito en robos por 1 uso',
                price: 120000,
                category: 'consumable',
                rarity: 'uncommon',
                effect: {
                    type: 'success_boost',
                    targets: ['robbery'],
                    boost: 0.2,
                    uses: 1
                },
                stackable: true,
                maxStack: 10
            },

            // Turbo Potion
            'turbo_potion': {
                id: 'turbo_potion',
                name: '⚡🧪 Poción Turbo',
                description: 'Reduce todos los cooldowns en 50% durante 30 minutos',
                category: 'consumable',
                rarity: 'rare',
                price: 1500,
                effect: {
                    type: 'cooldown_reduction',
                    targets: ['all'],
                    reduction: 0.5,
                    duration: 1800
                },
                stackable: true,
                maxStack: 5
            },
            
            // Fortune Shield
            'fortune_shield': {
                id: 'fortune_shield',
                name: '🛡️🍀 Escudo de la Fortuna',
                description: 'Protege contra pérdidas y fallos durante 1 hora',
                category: 'consumable',
                rarity: 'epic',
                price: 2500,
                effect: {
                    type: 'protection',
                    prevents: ['robbery_fail', 'money_loss'],
                    duration: 3600
                },
                stackable: true,
                maxStack: 2
            },
            
            // XP Booster
            'xp_booster': {
                id: 'xp_booster',
                name: '📚✨ XP Booster',
                description: 'Incrementa la experiencia ganada en 50% durante 1 hora',
                category: 'consumable',
                rarity: 'rare',
                price: 1000,
                effect: {
                    type: 'xp_multiplier',
                    multiplier: 1.5,
                    duration: 3600
                },
                stackable: true,
                maxStack: 5
            },            

            // === ITEMS PERMANENTES ===
            'money_magnet': {
                id: 'money_magnet',
                name: '🧲 Imán de Dinero',
                description: '+10% ganancias permanentes en todos los comandos',
                price: 2500000,
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
                price: 500000,
                category: 'permanent',
                rarity: 'uncommon',
                effect: {
                    type: 'permanent_cooldown',
                    targets: ['work'],
                    reduction: 0.15
                },
                stackable: false,
                maxStack: 1
            },

            // === DECORATIVOS ===
            'golden_trophy': {
                id: 'golden_trophy',
                name: '🏆 Trofeo Dorado',
                description: 'Muestra tu estatus de campeón en tu perfil',
                price: 200000,
                category: 'cosmetic',
                rarity: 'uncommon',
                effect: { type: 'cosmetic', display: 'profile_trophy' },
                stackable: false,
                maxStack: 1
            },
            'rainbow_badge': {
                id: 'rainbow_badge',
                name: '🌈 Insignia Arcoíris',
                description: 'Una hermosa insignia que aparece en tu perfil',
                price: 150000,
                category: 'cosmetic',
                rarity: 'common',
                effect: { type: 'cosmetic', display: 'profile_badge' },
                stackable: false,
                maxStack: 1
            },

            // === ESPECIALES ===
            'mystery_box': {
                id: 'mystery_box',
                name: '📦 Caja Misteriosa',
                description: 'Contiene un item aleatorio del valor de 100K-500K π-b$',
                price: 200000,
                category: 'mystery',
                rarity: 'rare',
                effect: { type: 'mystery', minValue: 100000, maxValue: 500000 },
                stackable: true,
                maxStack: 20
            },
            'anti_theft_shield': {
                id: 'anti_theft_shield',
                name: '🛡️ Escudo Antirrobo',
                description: 'Te protege de robos por 24 horas',
                price: 300000,
                category: 'consumable',
                rarity: 'epic',
                effect: {
                    type: 'protection',
                    targets: ['robbery'],
                    duration: 86400
                },
                stackable: true,
                maxStack: 3
            },
            'permanent_vault': {
                id: 'permanent_vault',
                name: '🏦 Bóveda Permanente',
                description: 'Protección permanente contra robos (reduce probabilidad 60%)',
                price: 3000000,
                category: 'permanent',
                rarity: 'legendary',
                effect: {
                    type: 'permanent_protection',
                    targets: ['robbery'],
                    reduction: 0.6 // antes 0.8, nerf
                },
                stackable: false,
                maxStack: 1
            },

            // === NUEVOS CONSUMIBLES TEMPORALES ===
            'mega_luck_potion': {
                id: 'mega_luck_potion',
                name: '🍀 Mega Poción de Suerte',
                description: 'Aumenta la probabilidad de ganar en juegos +25% por 1h 30m',
                price: 300000,
                category: 'consumable',
                rarity: 'epic',
                effect: { type: 'luck_boost', targets: ['games'], boost: 0.2, duration: 3600 },
                stackable: true,
                maxStack: 3
            },
            'speed_boots': {
                id: 'speed_boots',
                name: '👟 Botas de Velocidad',
                description: 'Elimina el cooldown por 30 minutos',
                price: 500000,
                category: 'consumable',
                rarity: 'rare',
                effect: { type: 'cooldown_reduction', targets: ['all'], reduction: 0.7, duration: 1200 },
                stackable: true,
                maxStack: 2
            },
            'xp_tornado': {
                id: 'xp_tornado',
                name: '🌪️ Tornado de XP',
                description: 'x3 XP de todos los mensajes por 20 minutos',
                price: 400000,
                category: 'consumable',
                rarity: 'epic',
                effect: { type: 'xp_multiplier', targets: ['all'], multiplier: 3.0, duration: 900 },
                stackable: true,
                maxStack: 2
            },
            'golden_pickaxe': {
                id: 'golden_pickaxe',
                name: '⛏️ Pico Dorado',
                description: 'Duplica las ganancias de trabajo por 5 usos',
                price: 450000,
                category: 'consumable',
                rarity: 'rare',
                effect: { type: 'work_multiplier', targets: ['work'], multiplier: 2.0, uses: 3 },
                stackable: true,
                maxStack: 5
            },

            // === NUEVOS ITEMS PERMANENTES ===
            'vip_pass': {
                id: 'vip_pass',
                name: '💎 Pase VIP',
                description: 'Acceso a comandos VIP y bonificaciones especiales por 30 días',
                price: 5000000,
                category: 'special',
                rarity: 'legendary',
                effect: {
                    type: 'vip_membership',
                    duration: 30 * 24 * 60 * 60 * 1000,
                    benefits: ['no_cooldowns','double_earnings','luck_boost','priority_support','exclusive_commands','custom_nickname']
                },
                stackable: false,
                maxStack: 1
            },
            'luck_charm_permanent': {
                id: 'luck_charm_permanent',
                name: '🍀 Amuleto de Suerte Permanente',
                description: '+15% suerte permanente en todos los juegos',
                price: 1500000,
                category: 'permanent',
                rarity: 'epic',
                effect: { type: 'permanent_luck', targets: ['games'], boost: 0.1 },
                stackable: false,
                maxStack: 1
            },
            'auto_worker': {
                id: 'auto_worker',
                name: '🤖 Trabajador Automático',
                description: 'Genera dinero pasivo cada hora (5k–15k π-b$)',
                price: 4000000,
                category: 'permanent',
                rarity: 'legendary',
                effect: { type: 'passive_income', minAmount: 5000, maxAmount: 15000, interval: 3600000 },
                stackable: false,
                maxStack: 1
            },

            // === ITEMS ESPECIALES ===
            'custom_nickname_token': {
                id: 'custom_nickname_token',
                name: '🏷️ Token de Apodo Personalizado',
                description: 'Permite cambiar tu apodo una vez',
                price: 200000,
                category: 'special',
                rarity: 'rare',
                effect: { type: 'nickname_change', uses: 1 },
                stackable: true,
                maxStack: 3
            },
            'premium_mystery_box': {
                id: 'premium_mystery_box',
                name: '🎁 Caja Premium Misteriosa',
                description: 'Contiene items raros o legendarios (250K-2M π-b$ valor)',
                price: 500000,
                category: 'mystery',
                rarity: 'epic',
                effect: { type: 'premium_mystery', minValue: 250000, maxValue: 2000000, rarityBonus: true },
                stackable: true,
                maxStack: 10
            },

            // === NUEVOS COSMÉTICOS ===
            'diamond_crown': {
                id: 'diamond_crown',
                name: '👑 Corona de Diamante',
                description: 'Una corona brillante que muestra tu estatus real',
                price: 750000,
                category: 'cosmetic',
                rarity: 'legendary',
                effect: { type: 'cosmetic', display: 'profile_crown', prestige: 10 },
                stackable: false,
                maxStack: 1
            },
            'fire_badge': {
                id: 'fire_badge',
                name: '🔥 Insignia de Fuego',
                description: 'Una insignia ardiente para los más activos',
                price: 250000,
                category: 'cosmetic',
                rarity: 'epic',
                effect: { type: 'cosmetic', display: 'profile_badge', prestige: 5 },
                stackable: false,
                maxStack: 1
            },
            'vip_frame': {
                id: 'vip_frame',
                name: '🖼️ Marco VIP',
                description: 'Un marco dorado para tu perfil que demuestra tu estatus VIP',
                price: 400000,
                category: 'cosmetic',
                rarity: 'epic',
                effect: { type: 'cosmetic', display: 'profile_frame' },
                stackable: false,
                maxStack: 1
            },

            'health_potion': {
                id: 'health_potion',
                name: '💊 Poción de Salud',
                description: 'Protege contra penalizaciones de juegos fallidos por 1 hora',
                price: 2500,
                category: 'consumable',
                rarity: 'uncommon',
                effect: {
                    type: 'penalty_protection',
                    targets: ['games', 'work'],
                    duration: 3600 // 1 hora
                },
                stackable: true,
                maxStack: 10
            },

            'experience_multiplier': {
                id: 'experience_multiplier',
                name: '📈 Multiplicador de EXP',
                description: 'x3 EXP en todos los comandos por 45 minutos',
                price: 4000,
                category: 'consumable',
                rarity: 'rare',
                effect: {
                    type: 'xp_multiplier',
                    targets: ['all'],
                    multiplier: 3.0,
                    duration: 2700 // 45 minutos
                },
                stackable: true,
                maxStack: 5
            },

            'instant_cooldown_reset': {
                id: 'instant_cooldown_reset',
                name: '⚡ Reset Instantáneo',
                description: 'Elimina todos los cooldowns inmediatamente (1 uso)',
                price: 5000,
                category: 'consumable',
                rarity: 'epic',
                effect: {
                    type: 'instant_cooldown_reset',
                    targets: ['all'],
                    uses: 1
                },
                stackable: true,
                maxStack: 3
            },

            // 💰 Bolsa Misteriosa
            'mystery_bag': {
                id: 'mystery_bag',
                price: 50000,
                category: 'special',
                name: '💰 Bolsa Misteriosa',
                description: 'Contiene una cantidad aleatoria de dinero',
                rarity: 'rare',
                effect: {
                    type: 'random_money',
                    min: 500,
                    max: 5000
                },
                stackable: true,
                maxStack: 10
            },

            // ✨ Skin Dorada
            'golden_skin': {
                price: 1000000,
                id: 'golden_skin',
                category: 'cosmetic',
                name: '✨ Golden Skin',
                description: 'Un objeto puramente cosmético para presumir',
                rarity: 'legendary',
                effect: {
                    type: 'cosmetic'
                },
                stackable: false
            },

            // 🎁 Cofre Premium
            'premium_chest': {
                id: 'premium_chest',
                category: 'mistery',
                name: '🎁 Cofre Premium',
                price: 900000,
                description: 'Un cofre misterioso con recompensas valiosas',
                rarity: 'epic',
                effect: {
                    type: 'open_chest',
                    rewards: [
                        { id: 'lucky_charm', chance: 0.25 },
                        { id: 'super_lucky_charm', chance: 0.15 },
                        { id: 'cosmic_charm', chance: 0.08 },
                        { id: 'xp_booster', chance: 0.12 },
                        { id: 'mystery_bag', chance: 0.2 },
                        { id: 'energy_drink', chance: 0.1 },
                        { id: 'golden_pickaxe', chance: 0.05 },
                        { id: 'diamond_pickaxe', chance: 0.02 },
                        { id: 'fortune_shield', chance: 0.03 }
                    ]
                },
                stackable: true,
                maxStack: 10
            },

            // 🏆 Cofre Legendario
            'legendary_chest': {
                id: 'legendary_chest',
                category: 'mistery',
                name: '🏆 Cofre Legendario',
                price: 1000000,
                description: 'Un cofre extremadamente raro con ítems únicos',
                rarity: 'legendary',
                effect: {
                    type: 'open_chest',
                    rewards: [
                        { id: 'cosmic_charm', chance: 0.2 },
                        { id: 'infinity_charm', chance: 0.05 },
                        { id: 'eternal_pickaxe', chance: 0.05 },
                        { id: 'phantom_gloves', chance: 0.05 },
                        { id: 'xp_booster', chance: 0.15 },
                        { id: 'vip_pass', chance: 0.1 },
                        { id: 'golden_skin', chance: 0.05 },
                        { id: 'mystery_bag', chance: 0.15 },
                        { id: 'fortune_shield', chance: 0.2 }
                    ]
                },
                stackable: true,
                maxStack: 5
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

    // 4. Función para consumir efectos de uso limitado
    async consumeUsageEffects(userId, action) {
        const user = await this.getUser(userId);
        const activeEffects = user.activeEffects || {};
        let updated = false;
        
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            for (let i = effects.length - 1; i >= 0; i--) {
                const effect = effects[i];
                
                // Solo procesar efectos que afecten esta acción
                if (!effect.targets.includes(action) && !effect.targets.includes('all')) continue;
                
                // Solo efectos con usos limitados
                if (!effect.usesLeft) continue;
                
                effect.usesLeft--;
                
                if (effect.usesLeft <= 0) {
                    effects.splice(i, 1);
                    updated = true;
                }
            }
            
            // Limpiar arrays vacíos
            if (effects.length === 0) {
                delete activeEffects[itemId];
                updated = true;
            }
        }
        
        if (updated) {
            await this.updateUser(userId, { activeEffects });
        }
    }
    
    // === TIENDA ===
    async showShop(message, category = 'all', page = 1) {
        // Remover esta optimización y usar:
        let items;
        if (category === 'all') {
            items = Object.values(this.shopItems);
        } else {
            // Filtrar automáticamente por categoría
            items = Object.values(this.shopItems).filter(item => item.category === category);
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
                            value: 'special',
                            emoji: '🎁'
                        },
                        {
                            label: 'Cofres',
                            value: 'mystery',
                            emoji: '🗝️'
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

        const cosmeticsDisplay = await this.getCosmeticsDisplay(userId);
        if (cosmeticsDisplay.hasCosmetics) {
            const cosmeticsText = cosmeticsDisplay.equipped.map(cosmetic => {
                const status = cosmetic.equipped ? '✅' : '❌';
                return `${status} **${cosmetic.name}**`;
            }).join('\n');
            
            embed.addFields({ 
                name: '✨ Cosméticos', 
                value: cosmeticsText, 
                inline: false 
            });
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
            // ✅ ARREGLO: Solo reducir cantidad si NO es cosmético
            if (item.category !== 'cosmetic') {
                const newItems = { ...userItems };
                newItems[itemId].quantity -= 1;
                
                if (newItems[itemId].quantity <= 0) {
                    delete newItems[itemId];
                }
                
                await this.economy.updateUser(message.author.id, { items: newItems });
            }
            
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
    
    // 1. ACTUALIZAR processItemUse() - agregar los nuevos casos especiales
    async processItemUse(userId, itemId, item) {
        const user = await this.economy.getUser(userId);
        
        switch (item.category) {
            case 'consumable':
                if (item.effect.type === 'instant_cooldown_reset') {
                    return await this.resetAllCooldowns(userId, item);
                }

                return await this.applyConsumableEffect(userId, itemId, item);
            case 'permanent':
                return await this.applyPermanentEffect(userId, itemId, item);
            case 'special':
                // Casos especiales existentes
                if (item.id === 'vip_pass') {
                    return await this.applyVipPass(userId, itemId, item);
                }
                if (item.effect.type === 'nickname_change') {
                    return await this.handleNicknameChange(userId, item);
                }
                // NUEVOS CASOS
                if (item.effect.type === 'random_money') {
                    return await this.openMoneyBag(userId, item);
                }
                if (item.effect.type === 'open_chest') {
                    return await this.openChest(userId, item);
                }
                return { success: false, message: 'Item especial no implementado.' };
            case 'mystery':
                return await this.openMysteryBox(userId, item);
            case 'cosmetic':
                return await this.applyCosmeticItem(userId, itemId, item);
            default:
                return { success: false, message: 'Este item no se puede usar.' };
        }
    }

    // 2. NUEVA FUNCIÓN: Abrir bolsa misteriosa
    async openMoneyBag(userId, item) {
        const amount = Math.floor(Math.random() * (item.effect.max - item.effect.min + 1)) + item.effect.min;
        
        const user = await this.economy.getUser(userId);
        await this.economy.updateUser(userId, { 
            balance: user.balance + amount 
        });
        
        return {
            success: true,
            message: `💰 ¡Abriste la bolsa misteriosa y encontraste **${amount.toLocaleString('es-ES')} π-b$**!`
        };
    }

    async applyCosmeticItem(userId, itemId, item) {
        const user = await this.economy.getUser(userId);
        
        let cosmetics = user.cosmetics || {};

        // Si cosmetics es string, parsearlo
        if (typeof cosmetics === 'string') {
            try {
                cosmetics = JSON.parse(cosmetics);
            } catch (error) {
                console.log('❌ Error parseando cosmetics, reseteando:', error);
                cosmetics = {};
            }
        }
        
        // Si no es objeto, resetear
        if (typeof cosmetics !== 'object' || Array.isArray(cosmetics)) {
            cosmetics = {};
        }
        
        // Si ya lo tiene equipado, desequiparlo
        if (cosmetics[itemId]) {
            delete cosmetics[itemId];
            await this.economy.updateUser(userId, { cosmetics });
            
            return { 
                success: true, 
                message: `✨ **${item.name}** ha sido desequipado de tu perfil.` 
            };
        }
        
        // Si no lo tiene, equiparlo
        cosmetics[itemId] = {
            id: itemId,
            name: item.name,
            equipped: true,
            obtainedAt: Date.now()
        };
        
        await this.economy.updateUser(userId, { cosmetics });
        
        return {
            success: true,
            message: `✨ **${item.name}** ahora está equipado en tu perfil. ¡Se ve increíble!`
        };
    }

    // 4. NUEVA FUNCIÓN: Abrir cofres con recompensas aleatorias
    async openChest(userId, item) {
        const rewards = item.effect.rewards;
        if (!rewards || rewards.length === 0) {
            return { success: false, message: 'Este cofre está vacío.' };
        }
        
        // Calcular probabilidades acumulativas
        let totalChance = 0;
        const cumulativeRewards = rewards.map(reward => {
            totalChance += reward.chance;
            return {
                ...reward,
                cumulativeChance: totalChance
            };
        });
        
        // Seleccionar recompensa aleatoria
        const roll = Math.random();
        const selectedReward = cumulativeRewards.find(reward => roll <= reward.cumulativeChance);
        
        if (!selectedReward) {
            // Fallback si algo sale mal
            return await this.openMoneyBag(userId, { 
                effect: { min: 1000, max: 10000 } 
            });
        }
        
        // Verificar si el item de recompensa existe
        const rewardItem = this.shopItems[selectedReward.id];
        if (!rewardItem) {
            // Si el item no existe, dar dinero equivalente
            const amount = Math.floor(Math.random() * 5000) + 2000;
            const user = await this.economy.getUser(userId);
            await this.economy.updateUser(userId, { balance: user.balance + amount });
            
            return {
                success: true,
                message: `📦 El cofre contenía **${amount.toLocaleString('es-ES')} π-b$** en lugar del item previsto.`
            };
        }
        
        // Agregar el item al inventario del usuario
        const user = await this.economy.getUser(userId);
        const userItems = user.items || {};
        
        if (userItems[selectedReward.id]) {
            userItems[selectedReward.id].quantity += 1;
        } else {
            userItems[selectedReward.id] = {
                id: selectedReward.id,
                quantity: 1,
                purchaseDate: new Date().toISOString(),
                obtainedFrom: 'chest'
            };
        }
        
        await this.economy.updateUser(userId, { items: userItems });
        
        const rarityEmoji = this.rarityEmojis[rewardItem.rarity] || '⚪';
        
        return {
            success: true,
            message: `🎁 ¡Felicidades! Del cofre obtuviste ${rarityEmoji} **${rewardItem.name}**!\n\n${rewardItem.description}`
        };
    }

    // 5. NUEVA FUNCIÓN: Mostrar cosméticos equipados en perfil
    async getCosmeticsDisplay(userId) {
        const user = await this.economy.getUser(userId);
        
        // ✅ ARREGLO: Manejar cosmetics como string
        let cosmetics = user.cosmetics || {};
        
        if (typeof cosmetics === 'string') {
            try {
                cosmetics = JSON.parse(cosmetics);
            } catch (error) {
                cosmetics = {};
            }
        }
        
        if (typeof cosmetics !== 'object' || Object.keys(cosmetics).length === 0) {
            return { hasCosmetics: false, display: 'No tienes cosméticos equipados.' }; // ✅ Nunca string vacío
        }
        
        let display = '';
        
        for (const [itemId, cosmeticData] of Object.entries(cosmetics)) {
            const item = this.shopItems[itemId];
            if (!item) continue;
            
            const emojiMatch = item.name.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u);
            const emoji = emojiMatch ? emojiMatch[0] : '✨';
            
            const rarityEmoji = this.rarityEmojis[item.rarity] || '⚪';
            const equippedDate = new Date(cosmeticData.obtainedAt).toLocaleDateString('es-ES');
            
            display += `${rarityEmoji} ${emoji} **${item.name}**\n`;
            display += `├ **ID:** \`${itemId}\`\n`;
            display += `└ Equipado el: ${equippedDate}\n\n`;
        }
        
        return { 
            hasCosmetics: true, 
            display: display.trim() || 'Error cargando cosméticos.' // ✅ Fallback si está vacío
        };
    }

    // 6. FUNCIÓN AUXILIAR: Obtener emoji del cosmético
    getCosmeticEmoji(cosmeticId) {
        const emojiMap = {
            'golden_trophy': '🏆',
            'rainbow_badge': '🌈',
            'diamond_crown': '👑',
            'fire_badge': '🔥',
            'vip_frame': '🖼️',
            'golden_skin': '✨'
        };
        
        return emojiMap[cosmeticId] || '⭐';
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

    // Después del método handleNicknameChange(), AGREGAR:
    async resetAllCooldowns(userId, item) {
        const user = await this.economy.getUser(userId);
        
        const updateData = {
            last_daily: 0,
            last_work: 0,
            last_robbery: 0,
            last_coinflip: 0,
            last_dice: 0,
            last_roulette: 0,
            last_lotto: 0,
            last_blackjack: 0
        };
        
        await this.economy.updateUser(userId, updateData);
        
        return {
            success: true,
            message: '⚡ ¡Todos los cooldowns han sido eliminados! Puedes usar cualquier comando ahora.'
        };
    }

    // Método para verificar protección contra penalizaciones
    async hasGameProtection(userId) {
        const user = await this.economy.getUser(userId);
        const activeEffects = user.activeEffects || {};
        
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            for (const effect of effects) {
                if (effect.type === 'penalty_protection' && effect.expiresAt > Date.now()) {
                    return true;
                }
            }
        }
        
        return false;
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
    
    // 3. ACTUALIZAR applyPermanentEffect() - manejar VIP como especial
    async applyPermanentEffect(userId, itemId, item) {
        const user = await this.economy.getUser(userId);
        
        // NUEVO: Manejar VIP Pass como caso especial
        if (item.id === 'vip_pass') {
            const permanentEffects = user.permanentEffects || {};
            
            if (permanentEffects[itemId]) {
                return { success: false, message: 'Ya tienes VIP activo.' };
            }
            
            permanentEffects[itemId] = {
                type: item.effect.type,
                duration: item.effect.duration,
                benefits: item.effect.benefits,
                appliedAt: Date.now()
            };
            
            await this.economy.updateUser(userId, { permanentEffects });
            
            return { 
                success: true, 
                message: `¡VIP activado por 30 días! Disfruta de todos los beneficios premium.` 
            };
        }
        
        // Resto del código permanece igual...
        const permanentEffects = user.permanentEffects || {};
        
        if (permanentEffects[itemId]) {
            return { success: false, message: 'Ya tienes este efecto permanente activo.' };
        }
        
        permanentEffects[itemId] = {
            type: item.effect.type,
            targets: item.effect.targets,
            multiplier: item.effect.multiplier,
            reduction: item.effect.reduction,
            boost: item.effect.boost, // NUEVO: agregar boost para permanent_luck
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

        // AGREGAR AQUÍ (después de seleccionar wonItem, ANTES de updateUser):
        if (item.effect.rarityBonus) {
            // Premium mystery box - chance de items raros
            const rarityRoll = Math.random();
            let selectedRarity = 'common';
            
            if (rarityRoll < 0.05) selectedRarity = 'legendary';      // 5%
            else if (rarityRoll < 0.15) selectedRarity = 'epic';      // 10%
            else if (rarityRoll < 0.35) selectedRarity = 'rare';      // 20%
            else if (rarityRoll < 0.65) selectedRarity = 'uncommon';  // 30%
            
            const rarityItems = possibleItems.filter(i => i.rarity === selectedRarity);
            if (rarityItems.length > 0) {
                const newWonItem = rarityItems[Math.floor(Math.random() * rarityItems.length)];
                console.log(`🎁 Premium box: ${wonItem.name} -> ${newWonItem.name} (${selectedRarity})`);
                wonItem = newWonItem; // Reemplazar el item ganado
            }
        }
        
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

    // Después del método setCustomNickname(), AGREGAR:
    async showVipStatus(message) {
        const userId = message.author.id;
        const vipStatus = await this.hasActiveVip(userId);
        
        if (!vipStatus.hasVip) {
            await message.reply('❌ No tienes membresía VIP activa. ¡Compra una en la tienda!');
            return;
        }
        
        const timeLeft = vipStatus.timeLeft;
        const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
        const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        
        const embed = new EmbedBuilder()
            .setTitle('👑 Estado VIP')
            .setDescription(`¡Tienes membresía **${vipStatus.tier}** activa!`)
            .addFields(
                { name: '⏰ Tiempo Restante', value: `${days} días, ${hours} horas`, inline: true },
                { name: '🎁 Beneficios Activos', value: '• Sin cooldowns\n• Ganancias x2\n• +20% suerte\n• Comandos exclusivos', inline: false }
            )
            .setColor('#FFD700')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }
       
    // 1. ACTUALIZAR getActiveMultipliers() - agregar casos para nuevos tipos
    async getActiveMultipliers(userId, action) {
        let user = heavyUsersCache.get(userId);
        if (!user) {
            user = await this.economy.getUser(userId);
            const itemCount = Object.keys(user.items || {}).length;
            if (itemCount > 5) {
                heavyUsersCache.set(userId, user);
                setTimeout(() => heavyUsersCache.delete(userId), 300000);
            }
        }
        
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
                
                // NUEVO: Manejar work_multiplier específicamente
                if (effect.type === 'work_multiplier' && action === 'work') {
                    totalMultiplier *= effect.multiplier;
                }
            }
        }
        
        // Efectos permanentes
        for (const [itemId, effect] of Object.entries(permanentEffects)) {
            if (!effect.targets || (!effect.targets.includes(action) && !effect.targets.includes('all'))) continue;
            
            if (effect.multiplier) totalMultiplier *= effect.multiplier;
            if (effect.reduction) totalReduction += effect.reduction;
            
            // NUEVO: Manejar permanent_luck
            if (effect.type === 'permanent_luck' && (action === 'games' || action === 'all')) {
                // La suerte se maneja en applyGameEffects, pero podemos trackearla aquí
            }
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

    // 9. VALIDACIÓN: Verificar que items referenciados en cofres existan
    validateChestRewards(item) {
        if (item.effect.type !== 'open_chest') return true;
        
        const invalidItems = [];
        for (const reward of item.effect.rewards) {
            if (!this.shopItems[reward.id]) {
                invalidItems.push(reward.id);
            }
        }
        
        if (invalidItems.length > 0) {
            console.warn(`⚠️  Items no encontrados en ${item.id}:`, invalidItems);
            return false;
        }
        
        return true;
    }    

    // === LIMPIAR EFECTOS EXPIRADOS (ejecutar periódicamente) ===
    async cleanupExpiredEffects(userId) {
        const user = await this.economy.getUser(userId);
        const activeEffects = user.activeEffects || {};
        
        let hasChanges = false;
        const now = Date.now();
        
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            if (!Array.isArray(effects)) continue;
            
            const validEffects = effects.filter(effect => {
                // Mantener efectos sin expiración o que no han expirado
                if (!effect.expiresAt) return true;
                return effect.expiresAt > now;
            });
            
            if (validEffects.length !== effects.length) {
                hasChanges = true;
                if (validEffects.length === 0) {
                    delete activeEffects[itemId];
                } else {
                    activeEffects[itemId] = validEffects;
                }
            }
        }
        
        if (hasChanges) {
            await this.economy.updateUser(userId, { activeEffects });
        }
        
        return hasChanges;
    }

    // === VERIFICAR Y APLICAR EFECTOS EN TRABAJOS ===
    async applyWorkEffects(userId, baseAmount, baseCooldown) {
        await this.cleanupExpiredEffects(userId);
        
        const multipliers = await this.getActiveMultipliers(userId, 'work');
        const finalAmount = Math.floor(baseAmount * multipliers.multiplier);
        const finalCooldown = Math.floor(baseCooldown * (1 - multipliers.reduction));
        
        // Decrementar usos si aplica
        await this.decrementItemUses(userId, 'work');
        
        return {
            amount: finalAmount,
            cooldown: Math.max(finalCooldown, 1000), // Mínimo 1 segundo
            multiplierApplied: multipliers.multiplier > 1
        };
    }

    // 2. ACTUALIZAR applyGameEffects() - agregar soporte para permanent_luck
    async applyGameEffects(userId, baseAmount, baseSuccessRate = 0.5) {
        await this.cleanupExpiredEffects(userId);
        
        const user = await this.economy.getUser(userId);
        const activeEffects = user.activeEffects || {};
        const permanentEffects = user.permanentEffects || {};
        
        let multiplier = 1.0;
        let luckBoost = 0;
        
        // Efectos temporales
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            for (const effect of effects) {
                if (effect.expiresAt && effect.expiresAt < Date.now()) continue;
                if (!effect.targets.includes('games') && !effect.targets.includes('all')) continue;
                
                if (effect.multiplier) multiplier *= effect.multiplier;
                if (effect.boost) luckBoost += effect.boost;
                
                // NUEVO: Manejar luck_boost específicamente
                if (effect.type === 'luck_boost') {
                    luckBoost += effect.boost;
                }
            }
        }
        
        // Efectos permanentes - AGREGAR ESTE BLOQUE
        for (const [itemId, effect] of Object.entries(permanentEffects)) {
            if (effect.type === 'permanent_luck' && effect.targets.includes('games')) {
                luckBoost += effect.boost;
            }
            if (effect.targets && (effect.targets.includes('games') || effect.targets.includes('all'))) {
                if (effect.multiplier) multiplier *= effect.multiplier;
            }
        }
        
        // Aplicar efectos VIP
        const vipEffects = await this.getVipMultipliers(userId, 'games');
        multiplier *= vipEffects.multiplier;
        luckBoost += vipEffects.luckBoost;
        
        const finalAmount = Math.floor(baseAmount * multiplier);
        const finalSuccessRate = Math.min(baseSuccessRate + luckBoost, 0.95);
        
        await this.decrementItemUses(userId, 'games');
        
        return {
            amount: finalAmount,
            successRate: finalSuccessRate,
            multiplierApplied: multiplier > 1,
            luckApplied: luckBoost > 0
        };
    }

    // === APLICAR EFECTOS DE XP ===
    async applyXpEffects(userId, baseXp) {
        await this.cleanupExpiredEffects(userId);
        
        const multipliers = await this.getActiveMultipliers(userId, 'all');
        const user = await this.economy.getUser(userId);
        const activeEffects = user.activeEffects || {};
        
        let xpMultiplier = 1.0;
        
        // Buscar específicamente multiplicadores de XP
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            for (const effect of effects) {
                if (effect.type === 'xp_multiplier' || effect.type === 'xp_tornado') {
                    if (effect.expiresAt && effect.expiresAt < Date.now()) continue;
                    if (effect.multiplier) xpMultiplier *= effect.multiplier;
                }
            }
        }
        
        return Math.floor(baseXp * xpMultiplier);
    }

    // === DECREMENTAR USOS DE ITEMS ===
    async decrementItemUses(userId, action) {
        const user = await this.economy.getUser(userId);
        const activeEffects = user.activeEffects || {};
        
        let hasChanges = false;
        
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            for (let i = effects.length - 1; i >= 0; i--) {
                const effect = effects[i];
                
                // Solo decrementar si el efecto aplica a esta acción
                if (!effect.targets.includes(action) && !effect.targets.includes('all')) continue;
                
                if (effect.usesLeft && effect.usesLeft > 0) {
                    effect.usesLeft -= 1;
                    hasChanges = true;
                    
                    if (effect.usesLeft <= 0) {
                        effects.splice(i, 1);
                        if (effects.length === 0) {
                            delete activeEffects[itemId];
                        }
                    }
                }
            }
        }
        
        if (hasChanges) {
            await this.economy.updateUser(userId, { activeEffects });
        }
    }

    // === VERIFICAR SI TIENE COOLDOWN ACTIVO ===
    async hasNoCooldownActive(userId) {
        const user = await this.economy.getUser(userId);
        const activeEffects = user.activeEffects || {};
        
        // Verificar botas de velocidad
        if (activeEffects['speed_boots']) {
            for (const effect of activeEffects['speed_boots']) {
                if (effect.type === 'no_cooldown' && effect.expiresAt > Date.now()) {
                    return true;
                }
            }
        }
        
        // Verificar VIP
        const vipEffects = await this.getVipMultipliers(userId, 'all');
        return vipEffects.noCooldown;
    }

    // === PROCESAR INGRESOS PASIVOS ===
    async processPassiveIncome(userId) {
        const user = await this.economy.getUser(userId);
        const permanentEffects = user.permanentEffects || {};
        
        if (!permanentEffects['auto_worker']) return { amount: 0, generated: false };
        
        const effect = permanentEffects['auto_worker'];
        const lastClaim = user.lastPassiveIncome || 0;
        const now = Date.now();
        
        // Verificar si ha pasado 1 hora
        if (now - lastClaim < effect.interval) {
            return { amount: 0, generated: false };
        }
        
        const amount = Math.floor(Math.random() * (effect.maxAmount - effect.minAmount + 1)) + effect.minAmount;
        
        await this.economy.updateUser(userId, {
            balance: user.balance + amount,
            lastPassiveIncome: now
        });
        
        return { amount, generated: true };
    }

    // === OBTENER INFO DE EFECTOS ACTIVOS ===
    async getActiveEffectsInfo(userId) {
        await this.cleanupExpiredEffects(userId);
        
        const user = await this.economy.getUser(userId);
        const activeEffects = user.activeEffects || {};
        const permanentEffects = user.permanentEffects || {};
        
        const info = {
            temporary: [],
            permanent: [],
            vip: null
        };
        
        // Efectos temporales
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            const item = this.shopItems[itemId];
            if (!item) continue;
            
            for (const effect of effects) {
                let timeLeft = '';
                if (effect.expiresAt) {
                    const remaining = Math.max(0, effect.expiresAt - Date.now());
                    const minutes = Math.floor(remaining / 60000);
                    const seconds = Math.floor((remaining % 60000) / 1000);
                    timeLeft = `${minutes}m ${seconds}s`;
                } else if (effect.usesLeft) {
                    timeLeft = `${effect.usesLeft} uso${effect.usesLeft > 1 ? 's' : ''}`;
                }
                
                info.temporary.push({
                    name: item.name,
                    timeLeft,
                    type: effect.type
                });
            }
        }
        
        // Efectos permanentes
        for (const [itemId, effect] of Object.entries(permanentEffects)) {
            const item = this.shopItems[itemId];
            if (!item) continue;
            
            if (effect.type === 'vip_membership') {
                const remaining = effect.appliedAt + effect.duration - Date.now();
                if (remaining > 0) {
                    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
                    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                    info.vip = {
                        tier: this.getVipTier(effect.benefits),
                        timeLeft: `${days}d ${hours}h`
                    };
                }
            } else {
                info.permanent.push({
                    name: item.name,
                    type: effect.type
                });
            }
        }
        
        return info;
    }

    // === COMANDO PARA VER EFECTOS ===
    async showActiveEffects(message) {
        const info = await this.getActiveEffectsInfo(message.author.id);
        
        const embed = new EmbedBuilder()
            .setTitle('⚡ Tus Efectos Activos')
            .setColor('#FF6B35')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));
        
        if (info.temporary.length === 0 && info.permanent.length === 0 && !info.vip) {
            embed.setDescription('No tienes efectos activos en este momento.');
            await message.reply({ embeds: [embed] });
            return;
        }
        
        if (info.vip) {
            embed.addFields({
                name: '👑 Estado VIP',
                value: `**${info.vip.tier}**\nTiempo restante: ${info.vip.timeLeft}`,
                inline: false
            });
        }
        
        if (info.temporary.length > 0) {
            const tempText = info.temporary.map(e => 
                `• **${e.name}** - ${e.timeLeft}`
            ).join('\n');
            
            embed.addFields({
                name: '⏱️ Efectos Temporales',
                value: tempText,
                inline: false
            });
        }
        
        if (info.permanent.length > 0) {
            const permText = info.permanent.map(e => 
                `• **${e.name}**`
            ).join('\n');
            
            embed.addFields({
                name: '💎 Efectos Permanentes',
                value: permText,
                inline: false
            });
        }
        
        await message.reply({ embeds: [embed] });
    }
    
    // === AUTO-LIMPIAR EFECTOS (llamar cada 5 minutos) ===
    async autoCleanupAll() {
        // Esta función debería ser llamada periódicamente
        console.log('🧹 Limpiando efectos expirados...');
        
        // Aquí necesitarías una lista de usuarios activos
        // Por ahora es un placeholder - implementar según tu sistema
    }

    // 5. NUEVA FUNCIÓN: Manejar cooldowns mejorados
    async getCooldownReduction(userId, action) {
        const user = await this.economy.getUser(userId);
        const activeEffects = user.activeEffects || {};
        const permanentEffects = user.permanentEffects || {};
        
        let reduction = 0;
        
        // Efectos temporales
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            for (const effect of effects) {
                if (effect.expiresAt && effect.expiresAt < Date.now()) continue;
                if (!effect.targets.includes(action) && !effect.targets.includes('all')) continue;
                
                if (effect.type === 'cooldown_reduction' && effect.reduction) {
                    reduction += effect.reduction;
                }
            }
        }
        
        // Efectos permanentes
        for (const effect of Object.values(permanentEffects)) {
            if (effect.type === 'permanent_cooldown' && effect.targets && effect.targets.includes(action)) {
                reduction += effect.reduction;
            }
        }
        
        // VIP
        const vipEffects = await this.getVipMultipliers(userId, action);
        if (vipEffects.noCooldown) {
            reduction = 1.0; // 100% reducción = sin cooldown
        }
        
        return Math.min(reduction, 0.95); // Máximo 95% reducción
    }

    // 4. NUEVA FUNCIÓN: Verificar protección contra robos (actualizada)
    async getTheftProtection(userId) {
        const user = await this.economy.getUser(userId);
        const activeEffects = user.activeEffects || {};
        const permanentEffects = user.permanentEffects || {};
        
        let protection = 0; // 0 = sin protección, 1 = protección completa
        
        // Verificar escudo antirrobo temporal
        if (activeEffects['anti_theft_shield']) {
            for (const effect of activeEffects['anti_theft_shield']) {
                if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                    return { protected: true, type: 'shield', reduction: 1.0 };
                }
            }
        }
        
        // Verificar bóveda permanente (ACTUALIZADO: ahora 60% en vez de 80%)
        if (permanentEffects['permanent_vault']) {
            protection = 0.6; // 60% reducción
        }
        
        if (protection > 0) {
            const roll = Math.random();
            if (roll < protection) {
                return { protected: true, type: 'vault', reduction: protection };
            }
        }
        
        return { protected: false, reduction: 0 };
    }

    // === APLICAR VIP PASS ===
    async applyVipPass(userId, itemId, item) {
        const user = await this.economy.getUser(userId);
        const permanentEffects = user.permanentEffects || {};
        
        // Verificar si ya tiene VIP activo
        if (permanentEffects[itemId]) {
            const now = Date.now();
            const expiresAt = permanentEffects[itemId].appliedAt + permanentEffects[itemId].duration;
            
            if (now < expiresAt) {
                return { success: false, message: 'Ya tienes VIP activo.' };
            } else {
                // VIP expirado, se puede renovar
                delete permanentEffects[itemId];
            }
        }
        
        permanentEffects[itemId] = {
            type: item.effect.type,
            duration: item.effect.duration,
            benefits: item.effect.benefits,
            appliedAt: Date.now()
        };
        
        await this.economy.updateUser(userId, { permanentEffects });
        
        const days = Math.floor(item.effect.duration / (24 * 60 * 60 * 1000));
        return { 
            success: true, 
            message: `¡VIP activado por ${days} días! Disfruta de: sin cooldowns, doble ganancias, +20% suerte y comandos exclusivos.` 
        };
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

    // Después del método processItemUse(), AGREGAR:
    async processPassiveIncome() {
        console.log('💰 Procesando ingresos pasivos...');
        
        try {
            const allUsers = await this.economy.getAllUsers();
            
            for (const user of allUsers) {
                const permanentEffects = user.permanentEffects || {};
                
                for (const [itemId, effect] of Object.entries(permanentEffects)) {
                    if (effect.type === 'passive_income') {
                        const lastPayout = user.lastPassivePayout || 0;
                        const now = Date.now();
                        
                        // Si ha pasado 1 hora (3600000 ms)
                        if (now - lastPayout >= 3600000) {
                            const amount = Math.floor(
                                Math.random() * (effect.maxAmount - effect.minAmount) + effect.minAmount
                            );
                            
                            await this.economy.addMoney(user.id, amount, 'passive_income');
                            await this.economy.updateUser(user.id, { lastPassivePayout: now });
                            
                            console.log(`💰 Ingreso pasivo: ${amount} π-b$ para ${user.id}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error procesando ingresos pasivos:', error);
        }
    }
    
    // === COMANDOS ===
    async processCommand(message) {
        if (message.author.bot) return;

        if (!message.member?.permissions.has('Administrator') && !message.author.id === '488110147265232898') {
            return;
        }
        
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
                case '>efectos':
                case '>effects':
                    await this.showActiveEffects(message);
                    break;
                    
                case '>cosmetics':
                case '>cosmeticos':
                    const cosmeticsDisplay = await this.getCosmeticsDisplay(message.author.id);

                    const embedCF = new EmbedBuilder()
                        .setTitle('✨ Tus Cosméticos Activos')
                        .setColor('#FFD700')
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

                    if (!cosmeticsDisplay.hasCosmetics) {
                        embedCF.setDescription('No tienes cosméticos activos en este momento.\n\n💡 *Compra cosméticos en la tienda con `>shop cosmetic`*');
                        await message.reply({ embeds: [embedCF] });
                        return;
                    }
                    
                    embedCF.setDescription(cosmeticsDisplay.display);
                    embedCF.addFields({
                        name: '📋 Información',
                        value: 'Usa `>useitem <item_id>` para desequipar un cosmético',
                        inline: false
                    });
                    
                    await message.reply({ embeds: [embedCF] });
                    break;
            }
        } catch (error) {
            console.error('❌ Error en sistema de tienda:', error);
            await message.reply('❌ Ocurrió un error en la tienda. Intenta de nuevo.');
        }
    }
}

module.exports = ShopSystem;
