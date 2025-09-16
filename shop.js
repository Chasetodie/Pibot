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
                stackable: true,
                maxStack: 2
            },
            'rainbow_badge': {
                id: 'rainbow_badge',
                name: '🌈 Insignia Arcoíris',
                description: 'Una hermosa insignia que aparece en tu perfil',
                price: 150000,
                category: 'cosmetic',
                rarity: 'common',
                effect: { type: 'cosmetic', display: 'profile_badge' },
                stackable: true,
                maxStack: 2
            },

            // === ESPECIALES ===
            'mystery_box': {
                id: 'mystery_box',
                name: '📦 Caja Misteriosa',
                description: 'Contiene un item aleatorio del valor de 100K-500K π-b$',
                price: 200000,
                category: 'mystery',
                rarity: 'rare',
                effect: { type: 'mystery', min: 100000, max: 500000 },
                stackable: true,
                maxStack: 20
            },
            'anti_theft_shield': {
                id: 'anti_theft_shield',
                name: '🛡️ Escudo Antirrobo',
                description: 'Te protege de robos por 3 horas',
                price: 500000,
                category: 'consumable',
                rarity: 'epic',
                effect: {
                    type: 'protection',
                    targets: ['robbery'],
                    duration: 10800
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
                    reduction: 0.8 // antes 0.8, nerf
                },
                stackable: false,
                maxStack: 1
            },

            'speed_boots': {
                id: 'speed_boots',
                name: '👟 Botas de Velocidad',
                description: 'Elimina el cooldown por 30 minutos',
                price: 500000,
                category: 'consumable',
                rarity: 'rare',
                effect: { type: 'cooldown_reduction', targets: ['all'], reduction: 0.7, duration: 1800 },
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
                effect: { 
                    type: 'permanent_luck', 
                    targets: ['games', 'gambling'], 
                    boost: 0.15 
                },
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
                name: '🎫 Token de Apodo Básico', // Nombre más claro
                description: 'Componente básico para craftear el Token de Apodo VIP',
                price: 200000,
                category: 'cosmetic',
                rarity: 'rare',
                stackable: true,
                maxStack: 3 // Aumenté porque ahora es ingrediente
            },
            'premium_mystery_box': {
                id: 'premium_mystery_box',
                name: '🎁 Caja Premium Misteriosa',
                description: 'Contiene items raros o legendarios (250K-2M π-b$ valor)',
                price: 500000,
                category: 'mystery',
                rarity: 'epic',
                effect: { type: 'premium_mystery', min: 250000, max: 2000000, rarityBonus: true },
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
                stackable: true,
                maxStack: 2
            },
            'fire_badge': {
                id: 'fire_badge',
                name: '🔥 Insignia de Fuego',
                description: 'Una insignia ardiente para los más activos',
                price: 250000,
                category: 'cosmetic',
                rarity: 'epic',
                effect: { type: 'cosmetic', display: 'profile_badge', prestige: 5 },
                stackable: true,
                maxStack: 2
            },
            'vip_frame': {
                id: 'vip_frame',
                name: '🖼️ Marco VIP',
                description: 'Un marco dorado para tu perfil que demuestra tu estatus VIP',
                price: 400000,
                category: 'cosmetic',
                rarity: 'epic',
                effect: { type: 'cosmetic', display: 'profile_frame' },
                stackable: true,
                maxStack: 2
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
                price: 1500000,
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
                category: 'mystery',
                name: '💰 Bolsa Misteriosa',
                description: 'Contiene una cantidad aleatoria de dinero',
                rarity: 'rare',
                effect: {
                    type: 'random_money',
                    min: 5000,
                    max: 50000
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
                stackable: true,
                maxStack: 2
            },

            // 🎁 Cofre Premium
            'premium_chest': {
                id: 'premium_chest',
                category: 'mystery',
                name: '🎁 Cofre Premium',
                price: 1500000,
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
                category: 'mystery',
                name: '🏆 Cofre Legendario',
                price: 2000000,
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
                        { id: 'instant_cooldown_reset', chance: 0.1 },
                        { id: 'golden_skin', chance: 0.05 },
                        { id: 'mystery_bag', chance: 0.15 },
                        { id: 'fortune_shield', chance: 0.2 }
                    ]
                },
                stackable: true,
                maxStack: 5
            },

            // Items para cofres legendarios
            'super_lucky_charm': {
                id: 'super_lucky_charm',
                name: '🍀✨ Super Amuleto de Suerte',
                description: 'Versión mejorada del amuleto normal (x2.0 multiplicador, 4 horas)',
                category: 'consumable',
                rarity: 'epic',
                effect: {
                    type: 'multiplier',
                    targets: ['work', 'games'],
                    multiplier: 1.5,
                    duration: 10800 // 3 horas
                },
                chestOnly: true,
                stackable: true,
                maxStack: 2
            },
            'master_toolkit': {
                id: 'master_toolkit',
                name: '🔧⚡ Kit Maestro',
                description: 'Reduce todos los cooldowns permanentemente en 30%',
                category: 'permanent',
                rarity: 'legendary',
                effect: {
                    type: 'permanent_cooldown',
                    targets: ['all'],
                    reduction: 0.3
                },
                chestOnly: true,
                stackable: false,
                maxStack: 1
            },            
            'mega_luck_potion': {
                id: 'mega_luck_potion',
                name: '🍀✨ Mega Poción de Suerte',
                description: 'Una potente mezcla de suerte concentrada que aumenta la probabilidad de ganar en juegos +25% por 1h 30m',
                category: 'consumable', 
                rarity: 'epic',
                effect: {
                    type: 'luck_boost',
                    targets: ['games', 'all'],
                    boost: 0.25,
                    duration: 5400 // 1h 30m
                },
                chestOnly: true,
                stackable: true,
                maxStack: 5
            },           
            'nickname_token': {
                id: 'nickname_token',
                name: '🏷️✨ Token de Apodo', // Nombre más claro
                description: 'Permite personalizar tu apodo con estilo. Usa >setnickname <nuevo_apodo>',
                category: 'special',
                rarity: 'epic', // Subí la rareza ya que requiere más materiales
                effect: {
                    type: 'nickname_change',
                    uses: 1
                },
                chestOnly: true,
                stackable: true,
                maxStack: 3 // Reduje el stack ya que es más valioso
            },    
            'epic_chest': {
                id: 'epic_chest',
                name: '📦🏆 Cofre Épico',
                description: 'Un cofre misterioso que contiene recompensas raras',
                category: 'mystery',
                rarity: 'epic',
                effect: {
                    type: 'open_chest',
                    rewards: [
                        { id: 'lucky_charm', chance: 0.4 },
                        { id: 'double_xp_potion', chance: 0.3 },
                        { id: 'money_magnet', chance: 0.2 },
                        { id: 'golden_pickaxe', chance: 0.1 }
                    ]
                },
                chestOnly: true,
                stackable: true,
                maxStack: 5
            },             
            'master_gloves': {
                id: 'master_gloves',
                name: '💀🧤 Guantes del Ladrón Maestro',
                description: 'Mejora la efectividad de los robos (+50% éxito, 10 usos)',
                category: 'consumable',
                rarity: 'epic',
                effect: {
                    type: 'robbery_boost',
                    successRate: 0.5,
                    uses: 10
                },
                chestOnly: true,
                stackable: true,
                maxStack: 2
            },      
            'cosmic_charm': {
                id: 'cosmic_charm',
                name: '🔮✨ Amuleto Cósmico',
                description: 'Un amuleto místico con poderes cósmicos (x3.0 multiplicador, 2 horas)',
                category: 'consumable',
                rarity: 'legendary',
                effect: {
                    type: 'multiplier',
                    targets: ['work', 'games'],
                    multiplier: 2.5,
                    duration: 5400 // 1.5 horas
                },
                chestOnly: true,
                stackable: true,
                maxStack: 2
            },
            'infinity_charm': {
                id: 'infinity_charm',
                name: '♾️🍀 Amuleto Infinito',
                description: 'El amuleto definitivo. (x5.0 multiplicador, 3 horas)',
                category: 'consumable',
                rarity: 'mythic',
                effect: {
                    type: 'multiplier',
                    targets: ['work', 'games'],
                    multiplier: 5.0,
                    duration: 10800 // 3 horas
                },
                chestOnly: true,
                stackable: true,
                maxStack: 1
            },
            'eternal_pickaxe': {
                id: 'eternal_pickaxe',
                name: '♾️⛏️ Pico Eterno',
                description: 'El pico definitivo, nunca se rompe',
                category: 'tool',
                rarity: 'legendary',
                effect: {
                    type: 'mining_boost',
                    multiplier: 2.5,
                    durability: Infinity
                },
                chestOnly: true,
                stackable: false
            },
            'diamond_pickaxe': {
                id: 'diamond_pickaxe',
                name: '💎⛏️ Pico de Diamante',
                description: 'Un pico mejorado para minería (+50% drops)',
                category: 'tool',
                rarity: 'epic',
                effect: {
                    type: 'mining_boost',
                    multiplier: 1.5,
                    durability: 200
                },
                chestOnly: true,
                stackable: false
            },
            'phantom_gloves': {
                id: 'phantom_gloves',
                name: '👻🧤 Guantes Fantasma',
                description: 'Permiten robar sin riesgo de ser atrapado (15 usos)',
                category: 'consumable',
                rarity: 'mythic',
                effect: {
                    type: 'robbery_boost',
                    successRate: 1.0,
                    safe: true,
                    uses: 15
                },
                chestOnly: true,
                stackable: true,
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

    async getEquippedCosmetics(userId) {
        const user = await this.economy.getUser(userId);
        
        // ✅ Manejar cosmetics como string o objeto
        let cosmetics = user.cosmetics || {};
        
        if (typeof cosmetics === 'string') {
            try {
                cosmetics = JSON.parse(cosmetics);
            } catch (error) {
                cosmetics = {};
            }
        }
        
        if (typeof cosmetics !== 'object') {
            return [];
        }
        
        // Devolver array de cosméticos equipados
        return Object.values(cosmetics).filter(cosmetic => cosmetic.equipped);
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
    async consumeItemUse(userId, itemId) {
        const user = await this.economy.getUser(userId);
        
        let activeEffects = user.activeEffects || {};
        if (typeof activeEffects === 'string') {
            try {
                activeEffects = JSON.parse(activeEffects);
            } catch (error) {
                activeEffects = {};
            }
        }
        
        if (!activeEffects[itemId] || !activeEffects[itemId].length) {
            return false; // No hay efectos activos
        }
        
        // Reducir usos del primer efecto activo
        const effect = activeEffects[itemId][0];
        if (effect.usesLeft && effect.usesLeft > 0) {
            effect.usesLeft -= 1;
            
            // Si se acabaron los usos, remover el efecto
            if (effect.usesLeft <= 0) {
                activeEffects[itemId].shift(); // Remover primer elemento
                
                // Si no quedan más efectos, remover el array completo
                if (activeEffects[itemId].length === 0) {
                    delete activeEffects[itemId];
                }
            }
            
            await this.economy.updateUser(userId, { activeEffects });
            return true;
        }
        
        return false;
    }
    
    // === TIENDA ===
    async showShop(message, category = 'all', page = 1) {
        // Remover esta optimización y usar:
        let items;
        if (category === 'all') {
            items = Object.values(this.shopItems).filter(item => !item.chestOnly);
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
            if (item.effect && item.effect.duration) {
                const hours = Math.floor(item.effect.duration / 3600);
                const minutes = Math.floor((item.effect.duration % 3600) / 60);
                effectDesc = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            } else if (item.effect && item.effect.uses) {
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

        if (item.chestOnly) {
            await message.reply('❌ Este item solo se puede obtener de cofres especiales.');
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
            
            // Verificar si el item tiene precio
            const itemPrice = item.price || 0;
            const value = itemPrice * quantity;
            
            // Solo sumar al total si tiene precio
            if (itemPrice > 0) {
                totalValue += value;
            }

            inventoryText += `${rarityEmoji} **${item.name}**\n`;                       
            inventoryText += `├ Cantidad: x${quantity}\n`;
            
            // Mostrar precio o "Sin valor"
            if (itemPrice > 0) {
                inventoryText += `├ Valor: ${value.toLocaleString('es-ES')} π-b$\n`;
            } else {
                inventoryText += `├ Valor: Sin valor\n`;
            }
            
            inventoryText += `└ ID: \`${itemId}\`\n\n`;
        }
        
        embed.setDescription(inventoryText || 'No tienes comprado ningun item');
        embed.addFields(
            { name: '💎 Valor Total', value: `${totalValue.toLocaleString('es-ES')} π-b$`, inline: true },
            { name: '📊 Items Únicos', value: `${Object.keys(userItems).length}`, inline: true }
        );
        
        // ✅ ARREGLO: Usar getEquippedCosmetics en lugar de getCosmeticsDisplay
        const equippedCosmetics = await this.getEquippedCosmetics(userId);
        if (equippedCosmetics.length > 0) {
            let cosmeticsText = '';
            for (const cosmetic of equippedCosmetics) {
                const item = this.shopItems[cosmetic.id];
                if (item) {
                    const emojiMatch = item.name.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u);
                    const emoji = emojiMatch ? emojiMatch[0] : '✨';
                    cosmeticsText += `✅ ${emoji} **${item.name}** \`${cosmetic.id}\`\n`;
                }
            }
        
            if (cosmeticsText) {
                embed.addFields({ 
                    name: '✨ Cosméticos Equipados', 
                    value: cosmeticsText.trim(), 
                    inline: false 
                });
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
                    return { success: false, message: 'Para usar este item tienes que usar >setnickname <apodo>.' };                
                }
                return { success: false, message: 'Item especial no implementado.' };
            case 'mystery':
                if (item.effect.type === 'random_money') {
                    return await this.openMoneyBag(userId, item);
                }
                if (item.effect.type === 'open_chest') {
                    return await this.openChest(userId, item);
                }
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
    
    // === APLICAR EFECTO CONSUMIBLE ===
    async applyConsumableEffect(userId, itemId, item) {
        const user = await this.economy.getUser(userId);
        
        let activeEffects = user.activeEffects || {};
        
        if (typeof activeEffects === 'string') {
            try {
                activeEffects = JSON.parse(activeEffects);
            } catch (error) {
                activeEffects = {};
            }
        }
        
        if (typeof activeEffects !== 'object' || Array.isArray(activeEffects)) {
            activeEffects = {};
        }
        
        // ✅ NUEVO: Verificar si ya hay UN EFECTO ACTIVO del mismo item
        if (activeEffects[itemId] && activeEffects[itemId].length > 0) {
            // Limpiar efectos expirados primero
            activeEffects[itemId] = activeEffects[itemId].filter(effect => {
                if (effect.expiresAt && effect.expiresAt < Date.now()) {
                    return false; // Remover expirados
                }
                if (effect.usesLeft && effect.usesLeft <= 0) {
                    return false; // Remover sin usos
                }
                return true; // Mantener activos
            });
            
            // Si aún hay efectos activos después de limpiar
            if (activeEffects[itemId].length > 0) {
                const activeEffect = activeEffects[itemId][0];
                const itemName = item.name;
                
                if (activeEffect.usesLeft && activeEffect.usesLeft > 0) {
                    return { 
                        success: false, 
                        message: `Ya tienes **${itemName}** activo con ${activeEffect.usesLeft} uso${activeEffect.usesLeft > 1 ? 's' : ''} restante${activeEffect.usesLeft > 1 ? 's' : ''}.` 
                    };
                } else if (activeEffect.expiresAt && activeEffect.expiresAt > Date.now()) {
                    const timeLeft = activeEffect.expiresAt - Date.now();
                    const minutes = Math.floor(timeLeft / 60000);
                    const seconds = Math.floor((timeLeft % 60000) / 1000);
                    
                    return { 
                        success: false, 
                        message: `Ya tienes **${itemName}** activo. Tiempo restante: ${minutes}m ${seconds}s.` 
                    };
                }
            }
        }
        
        // Resto del código igual...
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

        // ✅ AGREGAR ESTAS LÍNEAS:
        let permanentEffects = user.permanentEffects || {};
        
        if (typeof permanentEffects === 'string') {
            try {
                permanentEffects = JSON.parse(permanentEffects);
            } catch (error) {
                permanentEffects = {};
            }
        }
        
        // NUEVO: Manejar VIP Pass como caso especial
        if (item.id === 'vip_pass') {
//            const permanentEffects = user.permanentEffects || {};
            
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
//        const permanentEffects = user.permanentEffects || {};
        
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
            i.price >= item.effect.min && 
            i.price <= item.effect.max &&
            i.id !== 'mystery_box'
        );
        
        if (possibleItems.length === 0) {
            // Dar dinero si no hay items
            const amount = Math.floor(Math.random() * (item.effect.max - item.effect.min)) + item.effect.min;
            const user = await this.economy.getUser(userId);
            console.log(amount);
            await this.economy.updateUser(userId, { balance: user.balance + amount });
            
            return { 
                success: true, 
                message: `¡Encontraste **${amount.toLocaleString('es-ES')} π-b$** en la caja!` 
            };
        }
        
        const user = await this.economy.getUser(userId);
        const userItems = user.items || {};

        // ✅ ARREGLO: Filtrar items que el usuario ya tiene y no son stackeables
        const availableItems = possibleItems.filter(possibleItem => {
            // Si el item es stackeable, siempre está disponible
            if (possibleItem.stackable) {
                return true;
            }
            
            // Si no es stackeable, verificar que el usuario no lo tenga
            return !userItems[possibleItem.id] || userItems[possibleItem.id].quantity <= 0;
        });
        
        // Si no hay items disponibles (todos los no-stackeables ya los tiene), dar dinero
        if (availableItems.length === 0) {
            const amount = Math.floor(Math.random() * (item.effect.max - item.effect.min)) + item.effect.min;
            await this.economy.updateUser(userId, { balance: user.balance + amount });
            
            return { 
                success: true, 
                message: `¡Ya tienes todos los items únicos disponibles! En su lugar obtuviste **${amount.toLocaleString('es-ES')} π-b$**!` 
            };
        }

        // AGREGAR AQUÍ (después de seleccionar wonItem, ANTES de updateUser):
        let wonItem = availableItems[Math.floor(Math.random() * availableItems.length)];
        const newItems = { ...userItems };

        // ✅ VERIFICACIÓN EXTRA: Double-check para cosméticos
        if (wonItem.category === 'cosmetic' && !wonItem.stackable) {
            if (newItems[wonItem.id] && newItems[wonItem.id].quantity > 0) {
                // Si por alguna razón llegamos aquí, dar dinero en su lugar
                const amount = wonItem.price;
                await this.economy.updateUser(userId, { balance: user.balance + amount });
                
                return { 
                    success: true, 
                    message: `¡Ya tienes **${wonItem.name}**! En su lugar obtuviste **${amount.toLocaleString('es-ES')} π-b$**!` 
                };
            }
        }

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

    async getSuccessBoost(userId, action) {
        const user = await this.economy.getUser(userId);
        
        let activeEffects = user.activeEffects || {};
        if (typeof activeEffects === 'string') {
            try {
                activeEffects = JSON.parse(activeEffects);
            } catch (error) {
                activeEffects = {};
            }
        }
        
        let totalBoost = 0;
        
        // Buscar efectos de success_boost para la acción específica
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            if (!Array.isArray(effects)) continue;
            
            for (const effect of effects) {
                // Verificar que el efecto esté activo
                if (effect.expiresAt && effect.expiresAt < Date.now()) continue;
                if (effect.usesLeft && effect.usesLeft <= 0) continue;
                
                // Verificar que sea el tipo correcto y para la acción correcta
                if (effect.type === 'success_boost') {
                    const targets = effect.targets || [];
                    if (targets.includes(action) || targets.includes('all')) {
                        totalBoost += effect.boost || 0;
                    }
                }
            }
        }
        
        return Math.min(totalBoost, 0.95); // Máximo 95% boost
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
        
        let activeEffects = user.activeEffects || {};
        if (typeof activeEffects === 'string') {
            try {
                activeEffects = JSON.parse(activeEffects);
            } catch (error) {
                activeEffects = {};
            }
        }
        
        let permanentEffects = user.permanentEffects || {};
        if (typeof permanentEffects === 'string') {
            try {
                permanentEffects = JSON.parse(permanentEffects);
            } catch (error) {
                permanentEffects = {};
            }
        }

        
        let totalMultiplier = 1.0;
        let totalReduction = 0.0;
        let totalLuckBoost = 0.0;
        
        // Efectos temporales
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            if (!Array.isArray(effects)) continue;
            
            for (const effect of effects) {
                if (effect.expiresAt && effect.expiresAt < Date.now()) continue;

                const targets = effect.targets || [];
                if (!Array.isArray(targets)) continue;
                
                if (!targets.includes(action) && !targets.includes('all')) continue;
                
                if (effect.multiplier) totalMultiplier *= effect.multiplier;
                if (effect.reduction) totalReduction += effect.reduction;
                if (effect.boost) totalLuckBoost += effect.boost;
                
                // NUEVO: Manejar work_multiplier específicamente
                if (effect.type === 'work_multiplier' && action === 'work') {
                    totalMultiplier *= effect.multiplier;
                }
            }
        }
        
        // Efectos permanentes
        for (const [itemId, effect] of Object.entries(permanentEffects)) {
            const targets = effect.targets || [];
            if (!Array.isArray(targets)) continue;
            
            if (!targets.includes(action) && !targets.includes('all')) continue;
            
            if (effect.multiplier) totalMultiplier *= effect.multiplier;
            if (effect.reduction) totalReduction += effect.reduction;
            
            // NUEVO: Manejar permanent_luck
            if (effect.type === 'permanent_luck') {
                if (action === 'games' || action === 'gambling' || action === 'all') {
                    totalLuckBoost += effect.boost || 0.15;
                }
            }
        }
    
        const vipMultipliers = await this.getVipMultipliers(userId, action);
        totalMultiplier *= vipMultipliers.multiplier;
        totalLuckBoost += vipMultipliers.luckBoost || 0;
        
        return { 
            multiplier: totalMultiplier, 
            reduction: Math.min(totalReduction, 0.9),
            luckBoost: Math.min(totalLuckBoost, 0.95)
        };
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
        let activeEffects = user.activeEffects || {};

        if (typeof activeEffects === 'string') {
            try {
                activeEffects = JSON.parse(activeEffects);
            } catch (error) {
                activeEffects = {};
            }
        }       
        
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
    async applyGameEffects(userId, baseChance = 0.5) {
        const effects = await this.getActiveMultipliers(userId, 'games');
        
        // Aplicar luck boost a la probabilidad
        let finalChance = baseChance + effects.luckBoost;
        
        // Límite máximo de suerte (no más de 95%)
        finalChance = Math.min(finalChance, 0.95);
        
        return {
            chance: finalChance,
            multiplier: effects.multiplier,
            luckBoost: effects.luckBoost
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

    async showActiveEffects(message) {
        const user = await this.economy.getUser(message.author.id);
        
        // Parsear efectos
        let permanentEffects = user.permanentEffects || {};
        let activeEffects = user.activeEffects || {};
        
        if (typeof permanentEffects === 'string') {
            try {
                permanentEffects = JSON.parse(permanentEffects);
            } catch (error) {
                permanentEffects = {};
            }
        }
        
        if (typeof activeEffects === 'string') {
            try {
                activeEffects = JSON.parse(activeEffects);
            } catch (error) {
                activeEffects = {};
            }
        }
        
        const hasPermanent = Object.keys(permanentEffects).length > 0;
        const hasTemporary = Object.keys(activeEffects).length > 0;
        
        if (!hasPermanent && !hasTemporary) {
            await message.reply('📝 No tienes efectos activos.');
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('⚡ Tus Efectos Activos')
            .setColor('#9932CC')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        
        let description = '';
        
        // ✅ EFECTOS PERMANENTES (removibles)
        if (hasPermanent) {
            description += '**🔒 EFECTOS PERMANENTES**\n';
            for (const [itemId, effect] of Object.entries(permanentEffects)) {
                const item = this.shopItems[itemId];
                if (!item) continue;
                
                const rarityEmoji = this.rarityEmojis[item.rarity];
                const appliedDate = new Date(effect.appliedAt).toLocaleDateString('es-ES');
                
                description += `${rarityEmoji} **${item.name}**\n`;
                description += `├ Aplicado: ${appliedDate}\n`;
                description += `└ Remover: \`>removeeffect ${itemId}\`\n\n`;
            }
        }
        
        // ✅ EFECTOS TEMPORALES (solo visualizar)
        if (hasTemporary) {
            description += '**⏰ EFECTOS TEMPORALES**\n';
            for (const [itemId, effects] of Object.entries(activeEffects)) {
                if (!Array.isArray(effects)) continue;
                
                const item = this.shopItems[itemId];
                if (!item) continue;
                
                for (const effect of effects) {
                    const rarityEmoji = this.rarityEmojis[item.rarity];
                    
                    // ✅ NUEVO: Verificar si tiene usos o tiempo
                    if (effect.usesLeft && effect.usesLeft > 0) {
                        // Items con usos (como robbery_kit)
                        description += `${rarityEmoji} **${item.name}**\n`;
                        description += `└ Usos restantes: ${effect.usesLeft}\n\n`;
                    } else if (effect.expiresAt) {
                        // Items con tiempo
                        const timeLeft = Math.max(0, effect.expiresAt - Date.now());
                        if (timeLeft <= 0) continue;
                        
                        const hours = Math.floor(timeLeft / 3600000);
                        const minutes = Math.floor((timeLeft % 3600000) / 60000);
                        const seconds = Math.floor((timeLeft % 60000) / 1000);
                        
                        description += `${rarityEmoji} **${item.name}**\n`;
                        if (hours > 0) {
                            description += `└ Tiempo restante: ${hours}h ${minutes}m ${seconds}s\n\n`;
                        } else if (minutes > 0) {
                            description += `└ Tiempo restante: ${minutes}m ${seconds}s\n\n`;
                        } else {
                            description += `└ Tiempo restante: ${seconds}s\n\n`;
                        }
                    }
                }
            }
        }
        
        if (!description.trim()) {
            await message.reply('📝 No tienes efectos válidos activos.');
            return;
        }
        
        embed.setDescription(description);
        
        // Footer diferente según lo que tenga
        let footerText = '';
        if (hasPermanent && hasTemporary) {
            footerText = 'Usa >removeeffect <item_id> para quitar efectos permanentes';
        } else if (hasPermanent) {
            footerText = 'Usa >removeeffect <item_id> para desactivar un efecto';
        } else {
            footerText = 'Los efectos temporales expiran automáticamente';
        }
        
        embed.setFooter({ text: footerText });
        
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

        let activeEffects = user.activeEffects || {};
        if (typeof activeEffects === 'string') {
            try {
                activeEffects = JSON.parse(activeEffects);
            } catch (error) {
                activeEffects = {};
            }
        }

        let permanentEffects = user.permanentEffects || {};
        if (typeof permanentEffects === 'string') {
            try {
                permanentEffects = JSON.parse(permanentEffects);
            } catch (error) {
                permanentEffects = {};
            }
        }
        
        let protection = 0; // 0 = sin protección, 1 = protección completa
        
        // Verificar escudo antirrobo temporal
        if (activeEffects['anti_theft_shield']) {
            
            for (const effect of activeEffects['anti_theft_shield']) {
                console.log(`⏰ Efecto expira en:`, effect.expiresAt, 'Ahora:', Date.now());
                if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                    console.log(`✅ Protección activa!`);
                    return { protected: true, type: 'shield', reduction: 1.0 };
                }
            }
        }
        
        // Verificar bóveda permanente
        if (permanentEffects['permanent_vault']) {
            const vaultEffect = permanentEffects['permanent_vault'];
            if (vaultEffect && vaultEffect.reduction) {
                const roll = Math.random();
                if (roll < vaultEffect.reduction) { // Usar el valor del item (0.8 = 80%)
                    return { protected: true, type: 'vault' };
                }
            }
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
    
    async removePermanentEffect(message, itemId) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
        const permanentEffects = user.permanentEffects || {};

        // Parsear efectos si vienen como string desde la DB
        let parsedPermanentEffects = permanentEffects;
        if (typeof permanentEffects === 'string') {
            try {
                parsedPermanentEffects = JSON.parse(permanentEffects);
            } catch (error) {
                parsedPermanentEffects = {};
            }
        }
       
        // Verificar que el usuario tiene el efecto activo
        if (!parsedPermanentEffects[itemId]) {
            await message.reply(`❌ No tienes el efecto de **${itemId}** activo.`);
            return;
        }
        
        const item = this.shopItems[itemId];
        if (!item) {
            await message.reply('❌ Item no encontrado.');
            return;
        }
        
        // ✅ CONFIRMACIÓN para items costosos
        const expensiveItems = ['diamond_membership', 'auto_worker', 'permanent_vault'];
        if (expensiveItems.includes(itemId) || item.price > 20000) {
            
            // Sistema de confirmación similar al de subastas
            if (!this.removalConfirmations) {
                this.removalConfirmations = new Map();
            }
            
            const pendingConfirmation = this.removalConfirmations.get(userId);
            if (pendingConfirmation && pendingConfirmation.itemId === itemId) {
                // Confirmar y proceder
                this.removalConfirmations.delete(userId);
            } else {
                // Solicitar confirmación
                this.removalConfirmations.set(userId, {
                    itemId: itemId,
                    timestamp: Date.now()
                });
                
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ Confirmación de Remoción')
                    .setDescription(`¿Estás seguro de que quieres remover el efecto permanente?`)
                    .addFields(
                        { name: '📦 Item', value: `${this.rarityEmojis[item.rarity]} **${item.name}**`, inline: true },
                        { name: '💎 Valor Original', value: `${item.price.toLocaleString('es-ES')} π-b$`, inline: true },
                        { name: '⚠️ Importante', value: `Al remover este efecto, el item volverá a tu inventario y podrás venderlo/subastarlo, pero perderás todos los beneficios permanentes.`, inline: false },
                        { name: '🔄 Para Reactivar', value: `Tendrás que usar el item otra vez con \`>useitem ${itemId}\``, inline: false }
                    )
                    .setColor('#FF6600')
                    .setFooter({ text: 'Usa el mismo comando otra vez en 30 segundos para confirmar' });
                
                await message.reply({ embeds: [embed] });
                
                // Limpiar confirmación después de 30 segundos
                setTimeout(() => {
                    this.removalConfirmations.delete(userId);
                }, 30000);
                
                return;
            }
        }
        
        // ✅ Remover el efecto permanente
        const newPermanentEffects = { ...parsedPermanentEffects };
        delete newPermanentEffects[itemId];
        
        // ✅ Devolver el item al inventario
        const userItems = user.items || {};
        const newItems = { ...userItems };
        
        if (newItems[itemId]) {
            newItems[itemId].quantity += 1;
        } else {
            newItems[itemId] = {
                id: itemId,
                quantity: 1,
                purchaseDate: new Date().toISOString()
            };
        }
        
        // Actualizar usuario
        await this.economy.updateUser(userId, { 
            permanentEffects: newPermanentEffects,
            items: newItems
        });
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Efecto Removido')
            .setDescription(`El efecto permanente de **${item.name}** ha sido desactivado.`)
            .addFields(
                { name: '📦 Item Devuelto', value: `**${item.name}** ha vuelto a tu inventario.`, inline: true },
                { name: '🔄 Reactivar', value: `Usa \`>useitem ${itemId}\` para reactivar el efecto.`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }

    async handleSetNickname(message, args) {
        const userId = message.author.id;       
        const newNickname = /*args.join(' ').trim()*/args[1];
        
        // Validar que proporcionó un apodo
        if (!newNickname) {
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Apodo Requerido')
                    .setDescription('Debes proporcionar un apodo.\n\n**Uso:** `>setnickname <tu_apodo>`')
                    .setColor('#FF0000')]
            });
            return;
        }
        
        // Validar longitud del apodo
        if (newNickname.length > 20) {
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Apodo Muy Largo')
                    .setDescription('El apodo no puede tener más de 20 caracteres.')
                    .setColor('#FF0000')]
            });
            return;
        }
        
        // Validar caracteres permitidos (opcional)
        const forbiddenChars = /[<>@#&!]/;
        if (forbiddenChars.test(newNickname)) {
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Caracteres No Permitidos')
                    .setDescription('El apodo no puede contener: `< > @ # & !`')
                    .setColor('#FF0000')]
            });
            return;
        }
        
        // Verificar que tiene el item
        const user = await this.economy.getUser(userId);
        const userItems = user.items || {};
        
        if (!userItems['nickname_token'] || userItems['nickname_token'].quantity < 1) {
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Token Requerido')
                    .setDescription('Necesitas un **🏷️✨ Token de Apodo** para cambiar tu apodo.')
                    .addFields(
                        { name: '💡 ¿Cómo Obtenerlo?', value: '1. Compra un 🎫 Token de Apodo Básico\n2. Consigue materiales (badges/trophies)\n3. Craftéalo con `>craft nickname_token_craft`', inline: false }
                    )
                    .setColor('#FF0000')]
            });
            return;
        }
        
        // Obtener el apodo actual del usuario en el servidor
        const member = message.guild.members.cache.get(userId);
        if (!member) {
            await message.reply('❌ No se pudo encontrar tu información en el servidor.');
            return;
        }
        
        const currentNickname = member.displayName;
        
        // Extraer el formato base (Pibe/Piba + número)
        const basePattern = /^(Pibe|Piba)\s+(\d+)/i;
        const match = currentNickname.match(basePattern);
        
        if (!match) {
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Formato de Apodo Inválido')
                    .setDescription('Tu apodo actual no sigue el formato requerido: **Pibe/Piba + número**\n\nContacta a un administrador para corregir tu apodo base.')
                    .setColor('#FF0000')]
            });
            return;
        }
        
        const baseNickname = `${match[1]} ${match[2]}`; // "Pibe 123" o "Piba 456"
        const finalNickname = `${baseNickname} - ${newNickname}`;
        
        // Verificar que el nuevo apodo no exceda el límite de Discord (32 caracteres)
        if (finalNickname.length > 32) {
            const maxCustomLength = 32 - baseNickname.length - 3; // -3 por " - "
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Apodo Muy Largo')
                    .setDescription(`El apodo final sería muy largo para Discord.\n\n**Tu base:** ${baseNickname}\n**Máximo para tu apodo:** ${maxCustomLength} caracteres\n**Tu apodo:** ${newNickname} (${newNickname.length} caracteres)`)
                    .setColor('#FF0000')]
            });
            return;
        }
        
        // Crear embed de confirmación
        const confirmEmbed = new EmbedBuilder()
            .setTitle('🏷️ Confirmar Cambio de Apodo')
            .setDescription(`¿Estás seguro de que quieres cambiar tu apodo?`)
            .addFields(
                { name: '📝 Apodo Actual', value: `**${currentNickname}**`, inline: true },
                { name: '✨ Nuevo Apodo', value: `**${finalNickname}**`, inline: true },
                { name: '💎 Costo', value: '**1x** 🏷️✨ Token de Apodo', inline: false },
                { name: '⚠️ Importante', value: 'El token será consumido permanentemente. Para cambiar el apodo otra vez necesitarás otro token.', inline: false }
            )
            .setColor('#FFD700')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));
        
        // Crear botones
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`nickname_confirm_${userId}`)
                    .setLabel('✅ Confirmar')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`nickname_cancel_${userId}`)
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Danger)
            );
        
        // Guardar datos temporales para la confirmación
        if (!this.pendingNicknames) {
            this.pendingNicknames = new Map();
        }
        
        this.pendingNicknames.set(userId, {
            newNickname: newNickname,
            finalNickname: finalNickname,
            baseNickname: baseNickname,
            timestamp: Date.now()
        });
        
        // Enviar mensaje de confirmación
        const confirmMessage = await message.reply({ 
            embeds: [confirmEmbed], 
            components: [row] 
        });
        
        // Limpiar datos después de 60 segundos
        setTimeout(() => {
            this.pendingNicknames.delete(userId);
            // Desactivar botones si el mensaje aún existe
            row.components.forEach(button => button.setDisabled(true));
            confirmMessage.edit({ components: [row] }).catch(() => {});
        }, 60000);
    }

    // Método para manejar la confirmación/cancelación
    async handleNicknameConfirmation(interaction) {
        const userId = interaction.user.id;
        const action = interaction.customId.split('_')[1]; // confirm o cancel
        
        if (!this.pendingNicknames || !this.pendingNicknames.has(userId)) {
            await interaction.reply({ content: '❌ Esta confirmación ha expirado.', ephemeral: true });
            return;
        }
        
        const nicknameData = this.pendingNicknames.get(userId);
        this.pendingNicknames.delete(userId);
        
        if (action === 'cancel') {
            await interaction.update({ 
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Cambio Cancelado')
                    .setDescription('El cambio de apodo ha sido cancelado. Tu token no fue consumido.')
                    .setColor('#FF0000')],
                components: []
            });
            return;
        }
        
        if (action === 'confirm') {
            try {
                // Verificar nuevamente que tiene el token (por si acaso)
                const user = await this.economy.getUser(userId);
                const userItems = user.items || {};
                
                if (!userItems['nickname_token'] || userItems['nickname_token'].quantity < 1) {
                    await interaction.update({
                        embeds: [new EmbedBuilder()
                            .setTitle('❌ Token No Disponible')
                            .setDescription('Ya no tienes el token requerido.')
                            .setColor('#FF0000')],
                        components: []
                    });
                    return;
                }
                
                // Cambiar el apodo en Discord
                const member = interaction.guild.members.cache.get(userId);
                await member.setNickname(nicknameData.finalNickname);
                
                // Consumir el token
                const newItems = { ...userItems };
                newItems['nickname_token'].quantity -= 1;
                if (newItems['nickname_token'].quantity <= 0) {
                    delete newItems['nickname_token'];
                }
                
                await this.economy.updateUser(userId, { items: newItems });
                
                // Confirmar éxito
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Apodo Cambiado Exitosamente')
                    .setDescription(`Tu apodo ha sido actualizado correctamente.`)
                    .addFields(
                        { name: '✨ Nuevo Apodo', value: `**${nicknameData.finalNickname}**`, inline: true },
                        { name: '💎 Token Consumido', value: '1x 🏷️✨ Token de Apodo', inline: true },
                        { name: '🔄 Para Cambiar Otra Vez', value: 'Necesitarás craftear otro token y usar `>setnickname <nuevo_apodo>`', inline: false }
                    )
                    .setColor('#00FF00')
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
                
                await interaction.update({ 
                    embeds: [successEmbed], 
                    components: [] 
                });
                
            } catch (error) {
                console.error('Error cambiando apodo:', error);
                await interaction.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Error al Cambiar Apodo')
                        .setDescription('Hubo un error al cambiar tu apodo. Tu token no fue consumido. Contacta a un administrador.')
                        .setColor('#FF0000')],
                    components: []
                });
            }
        }
    }

    // === COMANDOS ===
    async processCommand(message) {
        if (message.author.bot) return;

        if ((!message.author.id === '488110147265232898') || (!message.author.id === '788424796366307409')) {
            return;
        }
        
        const args = message.content.toLowerCase().split(' ');
        const command = args[0];
        await this.economy.missions.updateMissionProgress(message.author.id, 'command_used');
        
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
                
                case '>removeeffect':
                case '>quitarefecto':
                    if (!args[1]) {
                        await message.reply('❌ Especifica el ID del item cuyo efecto quieres quitar. Ejemplo: `>removeeffect auto_worker`');
                        return;
                    }
                    await this.removePermanentEffect(message, args[1]);
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
                case '>setnickname':
                    const theotherargs = message.content.trim().split(/ +/g);
                    await this.handleSetNickname(message, theotherargs);
                    break;
            }
        } catch (error) {
            console.error('❌ Error en sistema de tienda:', error);
            await message.reply('❌ Ocurrió un error en la tienda. Intenta de nuevo.');
        }
    }
}

module.exports = ShopSystem;
