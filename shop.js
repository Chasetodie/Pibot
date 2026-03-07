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
                price: 15000,
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
                price: 12000,
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
                price: 30000,
                category: 'consumable',
                rarity: 'rare',
                effect: {
                    type: 'xp_multiplier',
                    targets: ['all'],
                    multiplier: 1.5,
                    duration: 1800
                },
                stackable: true,
                maxStack: 3
            },
            'robbery_kit': {
                id: 'robbery_kit',
                name: '🔧 Kit de Robo',
                description: 'Aumenta 20% probabilidad de éxito en robos por 1 uso',
                price: 18000,
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
                price: 20000,
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
                description: 'Reduce el riesgo contra pérdidas y fallos en un 80% durante 30 minutos',
                category: 'consumable',
                rarity: 'epic',
                price: 60000,
                effect: {
                    type: 'protection',
                    prevents: ['robbery_fail', 'money_loss'],
                    duration: 1800
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
                price: 18000,
                effect: {
                    type: 'xp_multiplier',
                    multiplier: 1.3,
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
                price: 400000,
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
                price: 110000,
                category: 'permanent',
                rarity: 'uncommon',
                effect: {
                    type: 'permanent_cooldown',
                    targets: ['work'],
                    reduction: 0.2
                },
                stackable: true,
                maxStack: 2
            },

            // === ITEMS DE TRIVIA ===
            'trivia_time_boost': {
                id: 'trivia_time_boost',
                name: '⏳ Ampolleta de Tiempo',
                description: 'Añade 10 segundos extra por pregunta en tu próxima partida de trivia',
                price: 8000,
                category: 'trivia',
                rarity: 'uncommon',
                emoji: '⏳',
                effect: {
                    type: 'trivia_boost',
                    subtype: 'extra_time',
                    bonus: 10000, // 10 segundos extra en ms
                    uses: 1
                },
                stackable: true,
                maxStack: 5
            },

            'trivia_skip_token': {
                id: 'trivia_skip_token',
                name: '⏭️ Token de Salto',
                description: 'Permite saltar una pregunta sin penalización en trivia. No cuenta como fallo.',
                price: 10000,
                category: 'trivia',
                rarity: 'uncommon',
                emoji: '⏭️',
                effect: {
                    type: 'trivia_boost',
                    subtype: 'skip_question',
                    uses: 1
                },
                stackable: true,
                maxStack: 3
            },

            'trivia_audience': {
                id: 'trivia_audience',
                name: '👥 Ayuda del Público',
                description: 'Elimina 2 respuestas incorrectas en una pregunta de trivia (múltiple opción)',
                price: 12000,
                category: 'trivia',
                rarity: 'rare',
                emoji: '👥',
                effect: {
                    type: 'trivia_boost',
                    subtype: 'eliminate_wrong',
                    eliminates: 2,
                    uses: 1
                },
                stackable: true,
                maxStack: 3
            },

            'trivia_double_reward': {
                id: 'trivia_double_reward',
                name: '💰 Voucher de Trivia',
                description: 'Duplica las recompensas de tu próxima partida de trivia completada',
                price: 20000,
                category: 'trivia',
                rarity: 'rare',
                emoji: '💰',
                effect: {
                    type: 'trivia_boost',
                    subtype: 'double_reward',
                    multiplier: 2.0,
                    uses: 1
                },
                stackable: true,
                maxStack: 3
            },

            'trivia_shield': {
                id: 'trivia_shield',
                name: '🛡️ Escudo de Trivia',
                description: 'Absorbe 1 respuesta incorrecta sin penalización de recompensa en trivia',
                price: 15000,
                category: 'trivia',
                rarity: 'rare',
                emoji: '🛡️',
                effect: {
                    type: 'trivia_boost',
                    subtype: 'wrong_shield',
                    uses: 1
                },
                stackable: true,
                maxStack: 2
            },

            // === DECORATIVOS ===
            'golden_trophy': {
                id: 'golden_trophy',
                name: '🏆 Trofeo Dorado',
                description: 'Muestra tu estatus de campeón en tu perfil',
                price: 28000,
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
                price: 25000,
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
                price: 70000,
                category: 'mystery',
                rarity: 'rare',
                effect: { type: 'mystery', min: 50000, max: 150000 },
                stackable: true,
                maxStack: 20
            },
            'anti_theft_shield': {
                id: 'anti_theft_shield',
                name: '🛡️ Escudo Antirrobo',
                description: 'Te protege de robos por 3 horas',
                price: 65000,
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
                price: 500000,
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

            'speed_boots': {
                id: 'speed_boots',
                name: '👟 Botas de Velocidad',
                description: 'Reduce un 70% el cooldown por 30 minutos',
                price: 60000,
                category: 'consumable',
                rarity: 'rare',
                effect: { type: 'cooldown_reduction', targets: ['all'], reduction: 0.7, duration: 1800 },
                stackable: true,
                maxStack: 2
            },
            'xp_tornado': {
                id: 'xp_tornado',
                name: '🌪️ Tornado de XP',
                description: 'x2 XP de todos los mensajes por 15 minutos',
                price: 50000,
                category: 'consumable',
                rarity: 'epic',
                effect: { type: 'xp_multiplier', targets: ['all'], multiplier: 1.5, duration: 900 },
                stackable: true,
                maxStack: 2
            },
            'golden_pickaxe': {
                id: 'golden_pickaxe',
                name: '⛏️ Pico Dorado',
                description: 'Duplica las ganancias de trabajo por 3 usos',
                price: 45000,
                category: 'consumable',
                rarity: 'rare',
                effect: { 
                    type: 'mining_limited', 
                    multiplier: 2.0, 
                    uses: 3
                },
                stackable: true,
                maxStack: 5
            },
            'condon_pibe2': {
                id: 'condon_pibe2',
                name: '🧃 Condón usado del Pibe 2**',
                description: 'Un objeto misterioso de dudosa efectividad... pero asegura una protección total (1 uso).',
                price: 67676, // precio meme
                category: 'consumable',
                rarity: 'epic',
                effect: {
                    type: 'protection',
                    prevents: ['game_loss', 'money_loss'],
                    uses: 1,
                    duration: null
                },
                stackable: true,
                maxStack: 5,
                guildExclusive: '1270508373732884522',
            },
            'role_token': {
                id: 'role_token',
                name: '🎭 Token de Rol Personalizado',
                description: 'Usa este token para crear un rol exclusivo y único.',
                price: 350000,
                category: 'special',
                rarity: 'legendary',
                effect: {
                    type: 'custom_role',
                    uses: 1
                },
                stackable: true,
                maxStack: 1,
                //guildExclusive: '1270508373732884522',
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
                    benefits: [
                        'reduced_cooldowns',
                        'earnings_boost',
                        'luck_boost',
                        'exclusive_commands',
                    ]
                },
                stackable: false,
                maxStack: 1
            },
            'luck_charm_permanent': {
                id: 'luck_charm_permanent',
                name: '🍀 Amuleto de Suerte Permanente',
                description: '+15% suerte permanente en todos los juegos',
                price: 250000,
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
                price: 3000000,
                category: 'permanent',
                rarity: 'legendary',
                effect: { 
                    type: 'passive_income', 
                    minAmount: 5000, 
                    maxAmount: 12000, 
                    interval: 3600000 
                },
                stackable: false,
                maxStack: 1
            },
            'death_hand': {
                id: 'death_hand',
                name: '☠️ La Mano del Muerto',
                description: 'Maldición lanzable que reduce suerte -50% y dinero -25%. Desactiva todos los efectos por 30 minutos',
                price: 10000,
                category: 'consumable',
                rarity: 'rare',
                effect: {
                    type: 'curse',
                    luckPenalty: -0.5,
                    moneyPenalty: -0.25,
                    disablesEffects: true,
                    duration: 1800, // 1 hora
                    throwable: true
                },
                stackable: true,
                maxStack: 10
            },
            // === ITEMS ESPECIALES ===
            'custom_nickname_token': {
                id: 'custom_nickname_token',
                name: '🎫 Token de Apodo Básico', // Nombre más claro
                description: 'Componente básico para craftear el Token de Apodo VIP',
                price: 50000,
                category: 'cosmetic',
                rarity: 'rare',
                stackable: true,
                maxStack: 3, // Aumenté porque ahora es ingrediente
                //guildExclusive: '1270508373732884522',
            },
            'premium_mystery_box': {
                id: 'premium_mystery_box',
                name: '🎁 Caja Premium Misteriosa',
                description: 'Contiene items raros o legendarios (250K-2M π-b$ valor)',
                price: 200000,
                category: 'mystery',
                rarity: 'epic',
                effect: { type: 'premium_mystery', min: 100000, max: 400000, rarityBonus: true },
                stackable: true,
                maxStack: 10
            },

            // === NUEVOS COSMÉTICOS ===
            'diamond_crown': {
                id: 'diamond_crown',
                name: '👑 Corona de Diamante',
                description: 'Una corona brillante que muestra tu estatus real',
                price: 90000,
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
                price: 35000,
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
                price: 55000,
                category: 'cosmetic',
                rarity: 'epic',
                effect: { type: 'cosmetic', display: 'profile_frame' },
                stackable: true,
                maxStack: 2
            },

            'health_potion': {
                id: 'health_potion',
                name: '💊 Poción de Salud',
                description: 'Reduce penalizaciones de juegos fallidos en un 40% por 10 minutos',
                price: 70000,
                category: 'consumable',
                rarity: 'uncommon',
                effect: {
                    type: 'penalty_protection',
                    targets: ['games'],
                    duration: 600 // 1 hora
                },
                stackable: true,
                maxStack: 10
            },

            'experience_multiplier': {
                id: 'experience_multiplier',
                name: '📈 Multiplicador de EXP',
                description: 'x2 EXP en todos los comandos por 45 minutos',
                price: 35000,
                category: 'consumable',
                rarity: 'rare',
                effect: {
                    type: 'xp_multiplier',
                    targets: ['all'],
                    multiplier: 1.5,
                    duration: 2700 // 45 minutos
                },
                stackable: true,
                maxStack: 5
            },
            'moby_dick_pibe4': {
                id: 'moby_dick_pibe4',
                name: '🐋 El Moby Dick de Pibe 4',
                description: 'Aumenta ganancias +24% pero reduce suerte -14% por 30 minutos',
                price: 44444,
                category: 'consumable',
                rarity: 'epic',
                effect: {
                    type: 'moby_dick_buff',
                    moneyMultiplier: 1.24,
                    luckPenalty: -0.14,
                    duration: 1800 // 30 minutos
                },
                stackable: true,
                maxStack: 5,
                guildExclusive: '1270508373732884522',
            },
            'bunny_suit_pibe12': {
                id: 'bunny_suit_pibe12',
                name: '🐰 Traje de Conejita de Pibe 12',
                description: 'Un traje legendario que aumenta ganancias y suerte (se desgasta con el uso)',
                price: 850000,
                category: 'equipment', // CAMBIAR de 'tool' a 'equipment'
                rarity: 'legendary',
                effect: {
                    type: 'bunny_suit',
                    equipmentType: 'suit', // NUEVO: tipo de equipamiento
                    moneyMultiplier: 1.20,
                    luckBoost: 0.15,
                    baseDurability: 100, // CAMBIAR de 'durability' a 'baseDurability'
                    durabilityVariation: 20 // ±20 de variación aleatoria
                },
                stackable: false,
                maxStack: 1,
                guildExclusive: '1270508373732884522',
            },
            'pay_to_win': {
                id: 'pay_to_win',
                name: '⚡ Pay To Win',
                description: 'Elimina todos los cooldowns (A excepción del daily) inmediatamente (1 uso)',
                price: 200000,
                category: 'consumable',
                rarity: 'epic',
                effect: {
                    type: 'pay_to_win',
                    targets: ['all'],
                    uses: 1
                },
                stackable: true,
                maxStack: 3
            },

            // 💰 Bolsa Misteriosa
            'mystery_bag': {
                id: 'mystery_bag',
                price: 12000,
                category: 'mystery',
                name: '💰 Bolsa Misteriosa',
                description: 'Contiene una cantidad aleatoria de dinero',
                rarity: 'rare',
                effect: {
                    type: 'random_money',
                    min: 5000,
                    max: 30000
                },
                stackable: true,
                maxStack: 10
            },

            // ✨ Skin Dorada
            'golden_skin': {
                price: 200000,
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
                price: 150000,
                description: 'Un cofre misterioso con recompensas valiosas',
                rarity: 'epic',
                effect: {
                    type: 'open_chest',
                    rewards: [
                        // Tier 1: Items baratos (60%)
                        { id: 'lucky_charm', chance: 0.20 },        // 25k
                        { id: 'energy_drink', chance: 0.15 },       // 20k
                        { id: 'xp_booster', chance: 0.15 },         // 30k
                        { id: 'mystery_bag', chance: 0.10 },        // 20k (gambling)
                        
                        // Tier 2: Items medios (30%)
                        { id: 'double_xp_potion', chance: 0.12 },   // 50k
                        { id: 'golden_pickaxe', chance: 0.10 },     // 60k
                        { id: 'fortune_shield', chance: 0.08 },     // 80k
                        
                        // Tier 3: Items caros (10%) - PERO menores a 150k
                        { id: 'diamond_crown', chance: 0.07 },      // 120k
                        { id: 'fire_badge', chance: 0.03 }          // 50k
                    ]
                },
                stackable: true,
                maxStack: 10
            },

            // === COFRE CARO: Puede dar craftables ===
            'legendary_chest': {
                id: 'legendary_chest',
                name: '🏆 Cofre Legendario',
                description: 'Contiene items raros, legendarios o craftables únicos',
                price: 400000,  // MÁS CARO
                category: 'mystery',
                rarity: 'legendary',
                effect: {
                    type: 'open_chest',
                    rewards: [
                        // Tier 1: Items buenos garantizados (40%)
                        { id: 'pay_to_win', chance: 0.20 }, // 200k
                        { id: 'golden_skin', chance: 0.12 },         // 200k
                        { id: 'diamond_crown', chance: 0.08 },       // 120k
                        
                        // Tier 2: Craftables raros (35%)
                        { id: 'super_lucky_charm', chance: 0.15 },   // Crafteable
                        { id: 'master_gloves', chance: 0.12 },       // Crafteable
                        { id: 'mega_luck_potion', chance: 0.08 },    // Crafteable
                        
                        // Tier 3: Craftables legendarios (20%)
                        { id: 'cosmic_charm', chance: 0.10 },        // Crafteable
                        { id: 'diamond_pickaxe', chance: 0.08 },     // Crafteable
                        { id: 'eternal_pickaxe', chance: 0.02 },     // Crafteable RARO
                        
                        // Tier 4: Craftables mythic (5%)
                        { id: 'phantom_gloves', chance: 0.03 },      // Crafteable
                        { id: 'infinity_charm', chance: 0.02 }       // Crafteable ULTRA RARO
                    ]
                },
                stackable: true,
                maxStack: 5
            },

            // Items para cofres legendarios
            'super_lucky_charm': {
                id: 'super_lucky_charm',
                name: '🍀✨ Super Amuleto de Suerte',
                description: 'Versión mejorada del amuleto normal (x2.0 multiplicador, 3 horas)',
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
                description: 'Reduce todos los cooldowns permanentemente en 20%',
                category: 'permanent',
                rarity: 'legendary',
                effect: {
                    type: 'permanent_cooldown',
                    targets: ['all'],
                    reduction: 0.2
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
                maxStack: 3, // Reduje el stack ya que es más valioso
                //guildExclusive: '1270508373732884522',
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
            'trivia_kit': {
                id: 'trivia_kit',
                name: '🧠 Kit de Trivia',
                description: 'Combina ayudas de trivia en un kit completo: tiempo extra + salto + ayuda del público',
                category: 'consumable',
                rarity: 'epic',
                effect: {
                    type: 'trivia_boost',
                    subtype: 'kit',
                    includes: ['extra_time', 'skip_question', 'eliminate_wrong', 'wrong_shield'],
                    uses: 1
                },
                stackable: true,
                maxStack: 2,
                chestOnly: true,
            },
            'trivia_master_pass': {
                id: 'trivia_master_pass',
                name: '👑 Pase Maestro de Trivia',
                description: 'El item definitivo de trivia: doble recompensa + escudo + ayuda del público para 3 partidas',
                category: 'consumable',
                rarity: 'legendary',
                effect: {
                    type: 'trivia_boost',
                    subtype: 'master_pass',
                    includes: ['double_reward', 'wrong_shield', 'eliminate_wrong'],
                    uses: 3
                },
                stackable: false,
                maxStack: 1,
                chestOnly: true,
            },
            'cosmic_charm': {
                id: 'cosmic_charm',
                name: '🔮✨ Amuleto Cósmico',
                description: 'Un amuleto místico con poderes cósmicos (x3.0 multiplicador, 1 hora 30 minutos)',
                category: 'consumable',
                rarity: 'legendary',
                effect: {
                    type: 'multiplier',
                    targets: ['work', 'games'],
                    multiplier: 2.0,
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
                    multiplier: 3.0,
                    duration: 7200 // 2 horas
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
                    type: 'mining_tool',
                    multiplier: 2.0,
                    durability: 999999,
                    currentDurability: 999999
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
                    type: 'mining_tool',
                    multiplier: 1.5,
                    durability: 200,
                    currentDurability: 200
                },
                chestOnly: true,
                stackable: false
            },
            'phantom_gloves': {
                id: 'phantom_gloves',
                name: '👻🧤 Guantes Fantasma',
                description: 'Permiten robar sin riesgo de ser atrapado (7 usos)',
                category: 'consumable',
                rarity: 'mythic',
                effect: {
                    type: 'robbery_boost',
                    successRate: 1.0,
                    safe: true,
                    uses: 7
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
            'legendary': '#FF6600',
            'mythic': '#000000'
        };
        
        this.rarityEmojis = {
            'common': '⚪',
            'uncommon': '🟢',
            'rare': '🔵', 
            'epic': '🟣',
            'legendary': '🟠',
            'mythic': '⚫'
        };

        // AGREGAR ESTAS LÍNEAS:
        this.itemCache = new Map();
        this.cacheTimeout = 10 * 60 * 1000; // 10 minutos para items        
    }

    // Función para parsear efectos permanentes
    parseEffects(effects, fallback = {}) {
        if (!effects) return fallback;
        
        if (typeof effects === 'string') {
            try {
                return JSON.parse(effects);
            } catch (error) {
                console.log('❌ Error parseando efectos:', error);
                return fallback;
            }
        }
        
        if (typeof effects === 'object' && !Array.isArray(effects)) {
            return effects;
        }
        
        return fallback;
    }

    // Función para parsear efectos activos (que son arrays)
    parseActiveEffects(effects) {
        if (!effects) return {};
        
        if (typeof effects === 'string') {
            try {
                const parsed = JSON.parse(effects);
                return parsed || {};
            } catch (error) {
                console.log('❌ Error parseando efectos activos:', error);
                return {};
            }
        }
        
        if (typeof effects === 'object') {
            return effects;
        }
        
        return {};
    }

    // Agregar después de parseActiveEffects() (línea ~180)
    hasCurseActive(userId, activeEffects = null) {
        if (!activeEffects) return false;
        
        const curse = activeEffects['death_hand_curse'];
        if (curse && curse.length > 0) {
            const curseEffect = curse[0];
            if (curseEffect.expiresAt > Date.now() && curseEffect.disablesEffects) {
                return true;
            }
        }
        return false;
    }

    // Sistema de notificaciones de items expirados (VERSIÓN MEJORADA v2)
    async checkAndNotifyExpiredItems(userId, message) {
        const user = await this.economy.getUser(userId);
        const activeEffects = this.parseActiveEffects(user.activeEffects);
        const now = Date.now();
        
        // Sistema de cooldown para notificaciones (5 minutos)
        const notificationCooldown = 5 * 60 * 1000; // 5 minutos
        if (!this.lastNotification) this.lastNotification = new Map();
        
        // MEJORADO: Sistema de lock por usuario (no por segundo)
        if (!this.notificationLock) this.notificationLock = new Set();
        
        // Si este usuario ya está siendo procesado, salir inmediatamente
        if (this.notificationLock.has(userId)) {
            return;
        }
        
        // Marcar que estamos procesando este usuario
        this.notificationLock.add(userId);
        
        try {
            const lastNotified = this.lastNotification.get(userId) || 0;
            const timeSinceLastNotif = now - lastNotified;
            
            // Usar Set para evitar duplicados automáticamente
            let expiredItemsSet = new Set();
            let soonToExpireMap = new Map();
            let itemsToRemove = [];
            
            // Revisar cada item activo
            for (const [itemId, effects] of Object.entries(activeEffects)) {
                if (!Array.isArray(effects)) continue;
                
                // Obtener información del item
                const item = this.shopItems[itemId];
                let itemName;
                
                // Manejar nombre especial para la maldición
                if (itemId === 'death_hand_curse') {
                    itemName = '☠️ Maldición de la Mano del Muerto';
                } else {
                    itemName = item ? item.name : itemId;
                }
                
                let hasExpiredEffect = false;
                let minTimeLeft = Infinity;
                
                for (let i = effects.length - 1; i >= 0; i--) {
                    const effect = effects[i];
                    
                    // Solo revisar efectos con expiración
                    if (!effect.expiresAt) continue;
                    
                    const timeLeft = effect.expiresAt - now;
                    
                    // Item ya expiró
                    if (timeLeft <= 0) {
                        hasExpiredEffect = true;
                        itemsToRemove.push({ itemId, index: i });
                    }
                    // Item expira en menos de 5 minutos
                    else if (timeLeft <= 300000) {
                        // Guardar el tiempo mínimo de expiración para este item
                        if (timeLeft < minTimeLeft) {
                            minTimeLeft = timeLeft;
                        }
                    }
                }
                
                // Agregar a expiredItems solo una vez por item
                if (hasExpiredEffect) {
                    expiredItemsSet.add(itemName);
                }
                
                // Agregar a soonToExpire solo si no hemos notificado recientemente
                if (minTimeLeft < 300000 && minTimeLeft > 0 && timeSinceLastNotif >= notificationCooldown) {
                    const minutesLeft = Math.ceil(minTimeLeft / 60000);
                    soonToExpireMap.set(itemName, minutesLeft);
                }
            }
            
            // Limpiar items expirados
            for (const { itemId, index } of itemsToRemove) {
                activeEffects[itemId].splice(index, 1);
                if (activeEffects[itemId].length === 0) {
                    delete activeEffects[itemId];
                }
            }
            
            // Guardar cambios si hubo items expirados
            if (itemsToRemove.length > 0) {
                await this.economy.updateUser(userId, { activeEffects });
            }
            
            // Convertir Set y Map a arrays para mostrar
            const expiredItems = Array.from(expiredItemsSet);
            const soonToExpireItems = Array.from(soonToExpireMap).map(([name, minutes]) => ({
                name,
                minutes
            }));
            
            // Enviar notificaciones SOLO si hay algo que notificar
            let notificationSent = false;
            
            // Notificar items expirados (siempre notifica cuando expiran)
            if (expiredItems.length > 0) {
                const embed = new EmbedBuilder()
                    .setTitle('⏰ Efectos Expirados')
                    .setDescription(`Los siguientes efectos han terminado:\n\n${expiredItems.map(name => `❌ ${name}`).join('\n')}`)
                    .setColor('#FF6B6B')
                    .setFooter({ text: 'Compra más items en la tienda con >shop' })
                    .setTimestamp();
                
                try {
                    await message.reply({ embeds: [embed] });
                    notificationSent = true;
                } catch (error) {
                    console.error('Error enviando notificación de expiración:', error);
                }
            }
            
            // Notificar items próximos a expirar (solo si pasó el cooldown)
            if (soonToExpireItems.length > 0 && timeSinceLastNotif >= notificationCooldown) {
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ Efectos Próximos a Expirar')
                    .setDescription(`Estos efectos están por terminar:\n\n${soonToExpireItems.map(item => `⏱️ ${item.name} - **${item.minutes}min** restantes`).join('\n')}`)
                    .setColor('#FFA500')
                    .setFooter({ text: 'Usa tus items antes de que expiren' })
                    .setTimestamp();
                
                try {
                    await message.reply({ embeds: [embed] });
                    notificationSent = true;
                } catch (error) {
                    console.error('Error enviando notificación de advertencia:', error);
                }
            }
            
            // Actualizar timestamp de última notificación si se envió alguna
            if (notificationSent) {
                this.lastNotification.set(userId, now);
            }
            
        } finally {
            // IMPORTANTE: Liberar el lock después de 1 segundo
            setTimeout(() => {
                this.notificationLock.delete(userId);
            }, 1000);
        }
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

    // Agregar esta función en ShopSystem:
    async consumeRobberyItems(userId) {
        const robberyItems = ['master_gloves', 'phantom_gloves', 'robbery_kit'];
        
        for (const itemId of robberyItems) {
            await this.consumeItemUse(userId, itemId);
        }
    }

    // 4. Función para consumir efectos de uso limitado
    async consumeItemUse(userId, itemId) {
        const user = await this.economy.getUser(userId);
        const activeEffects = this.parseActiveEffects(user.activeEffects);
        
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
        const currentGuildId = message.guild?.id || message.guildId;
        
        const guildFilter = (item) => {
            if (item.guildExclusive && item.guildExclusive !== currentGuildId) return false;
            return true;
        };

        let items;
        if (category === 'all') {
            items = Object.values(this.shopItems).filter(item => !item.chestOnly && guildFilter(item));
        } else {
            items = Object.values(this.shopItems).filter(item => item.category === category && guildFilter(item));
        }
        
        const itemsPerPage = 3;
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
            .setDescription(
                `🛒 **Bienvenido a la Tienda**\n` +
                `📄 Página ${page}/${totalPages}\n` +
                `🏷️ Categoría: **${({
    all: 'Todas',
    consumable: 'Consumibles',
    permanent: 'Permanentes',
    cosmetic: 'Cosméticos',
    special: 'Especiales',
    equipment: 'Equipamientos',
    mystery: 'Cofres',
    trivia: 'Trivia',
    tool: 'Herramientas'
})[category] || category}**\n\n` +
                `💡 Usa el menú desplegable para cambiar de categoría`
            )
            .setColor('#FFD700')
            .setTimestamp();

        const discount = this.getWeekendDiscount();
        
        for (const item of pageItems) {            
            const rarityEmoji = this.rarityEmojis[item.rarity];

            let value = `${item.description}\n`;
            value += `💰 **${item.price}**`;           
            value += `\n\`>buy ${item.id}\``;
            
            embed.addFields({
                name: `${rarityEmoji} ${item.name}`,
                value: value,
                inline: false // Cambiar a false para mejor lectura
            });
        }
        
        // Botones de navegación
        const uid = message.author.id;
        const row = new ActionRowBuilder();
        
        if (page > 1) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`shop_prev_${category}_${page - 1}_${uid}`)
                    .setLabel('◀️ Anterior')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        
        if (page < totalPages) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`shop_next_${category}_${page + 1}_${uid}`)
                    .setLabel('Siguiente ▶️')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        
        // Menú de categorías
        const categoryRow = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`shop_category_${uid}`)
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
                            label: 'Equipamientos',
                            value: 'equipment',
                            emoji: '⚔️'
                        },
                        {
                            label: 'Cofres',
                            value: 'mystery',
                            emoji: '🗝️'
                        },
                        {
                            label: 'Trivia',
                            value: 'trivia',
                            emoji: '🧠'
                        },
                    ])
            );
        
        const components = [categoryRow];
        if (row.components.length > 0) {
            components.push(row);
        }
        
        if (discount > 0) {
            let discountText;
            discountText = `\n🎉 ¡Descuento de fin de semana activo! ${Math.round(discount * 100)}% OFF en todos los items`;
            embed.setFooter({ text: `Usa >buy <item_id> para comprar un item / Si activas un item con usos que es superior a otro, se consumirá el item que es superior.${discountText}` });
        } else {
            embed.setFooter({ text: 'Usa >buy <item_id> para comprar un item / Si activas un item con usos que es superior a otro, se consumirá el item que es superior.' });
        }
        
        await message.reply({ embeds: [embed], components });
    }
    
    async hasVipAccess(userId) {
        const user = await this.economy.getUser(userId);
        const permanentEffects = this.parseEffects(user.permanentEffects);
        
        for (const effect of Object.values(permanentEffects)) {
            if (effect.benefits && effect.benefits.includes('vip_commands')) {
                return true;
            }
        }
        return false;
    }

    getWeekendDiscount() {
        // Verificar si hay evento de fin de semana activo
        if (this.economy.events) {
            for (const event of this.economy.events.getActiveEvents()) {
                if (event.type === 'week_end') {
                    return 0.1; // 20% de descuento
                }
            }
        }
        return 0; // Sin descuento
    }

    // === COMPRAR ITEM ===
    async buyItem(message, itemId, quantity = 1) {
        const item = this.shopItems[itemId];
        if (!item) {
            await message.reply('❌ Item no encontrado. Usa `>shop` para ver los items disponibles.');
            return;
        }

        // Verificar exclusividad de servidor
        if (item.guildExclusive && item.guildExclusive !== message.guild?.id) {
            await message.reply('❌ Este item no está disponible en este servidor.');
            return;
        }

        if (item.chestOnly) {
            await message.reply('❌ Este item solo se puede obtener de cofres especiales.');
            return;
        }
        
        // Calcular precio con descuento
        const discount = this.getWeekendDiscount();
        const originalPrice = item.price;
        const discountedPrice = Math.floor(originalPrice * (1 - discount));
        const totalCost = discountedPrice * quantity;
        
        const user = await this.economy.getUser(message.author.id);
        
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
                purchaseDate: new Date().toISOString(),
                paidPrice: item.price
            };
        }
        
        await this.economy.updateUser(message.author.id, {
            balance: newBalance,
            items: newItems
        });

        await this.economy.missions.updateMissionProgress(message.author.id, 'items_bought_today', 1);
        // Actualizar estadística de gasto para misiones VIP
        await this.economy.missions.updateMissionProgress(message.author.id, 'money_spent_today', totalCost);
        
        const rarityEmoji = this.rarityEmojis[item.rarity];
        const embed = new EmbedBuilder()
            .setTitle('✅ Compra Exitosa')
            .setDescription(`${rarityEmoji} **${item.name}** x${quantity}\n\n${item.description}`)
            .setColor(this.rarityColors[item.rarity])
            .setTimestamp();

            if (discount > 0) {
                const savings = (originalPrice - discountedPrice) * quantity;
                embed.addFields(
                    { name: '💰 Precio Original', value: `${(originalPrice * quantity).toLocaleString('es-ES')} π-b$`, inline: true },
                    { name: '🎉 Descuento', value: `${Math.round(discount * 100)}%`, inline: true },
                    { name: '💸 Ahorro', value: `${savings.toLocaleString('es-ES')} π-b$`, inline: true },
                    { name: '💳 Precio Final', value: `${totalCost.toLocaleString('es-ES')} π-b$`, inline: true }
                );
            } else {
                embed.addFields(
                    { name: '💰 Costo Total', value: `${totalCost.toLocaleString('es-ES')} π-b$`, inline: true }
                );
            }
        
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
            
            // En showBag(), después de calcular el valor del item
            if (itemId === 'death_hand') {
                inventoryText += `└ 💡 Uso: \`>throw @usuario\`\n\n`;
            } else {
                inventoryText += `└ ID: \`${itemId}\`\n\n`;
            }
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

        // Bloquear uso de items exclusivos en otros servidores
        if (item.guildExclusive && item.guildExclusive !== message.guild?.id) {
            await message.reply(`❌ **${item.name}** no puede usarse en este servidor.`);
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
        
        const activeEffects = this.parseActiveEffects(user.activeEffects);
        if (this.hasCurseActive(userId, activeEffects)) {
            return {
                success: false,
                message: '☠️ La Mano del Muerto te impide usar items. Todos tus efectos están desactivados.'
            };
        }

        // Prevenir uso directo de items lanzables
        if (item.effect.throwable) {
            return { 
                success: false, 
                message: `❌ Este item no se puede usar directamente. Usa \`>throw @usuario\` para lanzarlo.` 
            };
        }

        switch (item.category) {
            case 'consumable':
                await this.economy.missions.updateMissionProgress(userId, 'consumables_used', 1);

                if (item.effect.type === 'pay_to_win') {
                    return await this.resetAllCooldowns(userId, item);
                }

                return await this.applyConsumableEffect(userId, itemId, item);
            case 'permanent':
                return await this.applyPermanentEffect(userId, itemId, item);
            case 'tool':
                return await this.applyToolEffect(userId, itemId, item);  
            case 'equipment':
                return await this.applyEquipmentEffect(userId, itemId, item);          
            case 'trivia':
                return await this.applyTriviaBoost(userId, itemId, item);
            case 'special':
                // Casos especiales existentes
                if (item.id === 'vip_pass') {
                    return await this.applyVipPass(userId, itemId, item);
                }
                if (item.effect.type === 'nickname_change') {
                    return { success: false, message: 'Para usar este item tienes que usar >setnickname <apodo>.' };                
                }

                if (item.id === 'role_token') {
                    return { success: false, message: 'Para usar este item tienes que usar >rolcreate <#COLOR en hexagesimal> nombre_del_rol.' };
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

    async applyTriviaBoost(userId, itemId, item) {
        const user = await this.economy.getUser(userId);
        const activeEffects = this.parseActiveEffects(user.activeEffects);

        // Verificar si ya tiene un boost activo
        if (activeEffects['trivia_boost']) {
            return { success: false, message: 'Ya tienes un boost de trivia activo.' };
        }

        activeEffects['trivia_boost'] = [{
            itemId: itemId,
            subtype: item.effect.subtype || itemId,
            includes: item.effect.includes || [item.effect.type],
            uses: item.effect.uses || 1,
            appliedAt: Date.now()
        }];

        await this.economy.updateUser(userId, {
            activeEffects: JSON.stringify(activeEffects)
        });

        return {
            success: true,
            message: `✅ Boost de trivia activado. Se aplicará en tu próxima partida de trivia.\n**Incluye:** ${(item.effect.includes || [item.effect.type]).join(', ')}`
        };
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
            //last_daily: 0,
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

    async hasGameProtection(userId) {
        const user = await this.economy.getUser(userId);
        const activeEffects = this.parseActiveEffects(user.activeEffects);
        
        // Verificar maldición
        if (this.hasCurseActive(userId, activeEffects)) {
            return false;
        }
        
        // ✅ CONDÓN: 100% protección, 1 uso, SE CONSUME AQUÍ
        if (activeEffects['condon_pibe2']) {
            for (let i = activeEffects['condon_pibe2'].length - 1; i >= 0; i--) {
                const effect = activeEffects['condon_pibe2'][i];
                if (effect.type === 'protection' && effect.usesLeft > 0) {
                    // Consumir el uso
                    effect.usesLeft -= 1;
                    
                    // Si se acabaron los usos, remover
                    if (effect.usesLeft <= 0) {
                        activeEffects['condon_pibe2'].splice(i, 1);
                        if (activeEffects['condon_pibe2'].length === 0) {
                            delete activeEffects['condon_pibe2'];
                        }
                    }
                    
                    // Actualizar AHORA
                    await this.economy.updateUser(userId, { activeEffects });
                    return true; // 100% garantizado
                }
            }
        }
        
        // ✅ FORTUNE SHIELD: 80% protección (con probabilidad)
        if (activeEffects['fortune_shield']) {
            for (const effect of activeEffects['fortune_shield']) {
                if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                    const roll = Math.random();
                    return roll < 0.80; // 80% de proteger
                }
            }
        }
        
        // ✅ HEALTH POTION: 40% protección (con probabilidad)
        if (activeEffects['health_potion']) {
            for (const effect of activeEffects['health_potion']) {
                if (effect.type === 'penalty_protection' && effect.expiresAt > Date.now()) {
                    const roll = Math.random();
                    return roll < 0.40; // 40% de proteger
                }
            }
        }
        
        return false; // Sin protección
    }
    
    // === APLICAR EFECTO CONSUMIBLE ===
    async applyConsumableEffect(userId, itemId, item) {
        const user = await this.economy.getUser(userId);
        
        const activeEffects = this.parseActiveEffects(user.activeEffects);
                
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
            safe: item.effect.safe,
            successRate: item.effect.successRate,
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

    async applyToolEffect(userId, itemId, item) {
        const user = await this.economy.getUser(userId);
        const userItems = user.items || {};
        
        // Verificar que tiene el item
        if (!userItems[itemId] || userItems[itemId].quantity <= 0) {
            return { success: false, message: 'No tienes este item.' };
        }
        
        // CAMBIAR: En lugar de modificar items, agregar a activeEffects
        const activeEffects = this.parseActiveEffects(user.activeEffects);
        
        // Verificar si ya tiene esta herramienta activa
        if (activeEffects[itemId] && activeEffects[itemId].length > 0) {
            return { success: false, message: 'Ya tienes esta herramienta equipada.' };
        }
        
        const durability = item.id === 'eternal_pickaxe' ? 999999 : item.effect.durability;

        // Agregar herramienta a efectos activos
        const toolEffect = {
            type: 'mining_tool',
            multiplier: item.effect.multiplier,
            durability: durability,
            currentDurability: durability,
            appliedAt: Date.now()
        };
        
        if (!activeEffects[itemId]) {
            activeEffects[itemId] = [];
        }
        activeEffects[itemId].push(toolEffect);
        
        // Consumir el item del inventario
        const newItems = { ...userItems };
        newItems[itemId].quantity -= 1;
        if (newItems[itemId].quantity <= 0) {
            delete newItems[itemId];
        }
        
        await this.economy.updateUser(userId, { 
            activeEffects, 
            items: newItems 
        });
        
        return {
            success: true,
            message: `⛏️ **${item.name}** equipado! Durabilidad: ${item.id === 'eternal_pickaxe' ? '♾️ Infinita' : durability}`
        };
    }

    // === APLICAR EFECTO DE EQUIPAMIENTO (Trajes, Armaduras, Espadas, etc.) ===
    async applyEquipmentEffect(userId, itemId, item) {
        const user = await this.economy.getUser(userId);
        const userItems = user.items || {};
        
        // Verificar que tiene el item
        if (!userItems[itemId] || userItems[itemId].quantity <= 0) {
            return { success: false, message: 'No tienes este item.' };
        }
        
        const activeEffects = this.parseActiveEffects(user.activeEffects);
        
        // Verificar si ya tiene este equipamiento activo
        if (activeEffects[itemId] && activeEffects[itemId].length > 0) {
            return { success: false, message: 'Ya tienes este equipamiento equipado.' };
        }
        
        // CALCULAR DURABILIDAD ALEATORIA
        const baseDurability = item.effect.baseDurability;
        const variation = item.effect.durabilityVariation || 0;
        
        // Durabilidad aleatoria: base ± variation
        const minDurability = baseDurability - variation;
        const maxDurability = baseDurability + variation;
        const randomDurability = Math.floor(Math.random() * (maxDurability - minDurability + 1)) + minDurability;
        
        // Crear efecto del equipamiento
        const equipmentEffect = {
            type: item.effect.type,
            equipmentType: item.effect.equipmentType,
            moneyMultiplier: item.effect.moneyMultiplier,
            luckBoost: item.effect.luckBoost,
            attackBonus: item.effect.attackBonus, // Para futuras espadas
            defenseBonus: item.effect.defenseBonus, // Para futuras armaduras
            maxDurability: randomDurability, // NUEVO: guardar el máximo
            currentDurability: randomDurability,
            appliedAt: Date.now()
        };
        
        if (!activeEffects[itemId]) {
            activeEffects[itemId] = [];
        }
        activeEffects[itemId].push(equipmentEffect);
        
        // Consumir el item del inventario
        const newItems = { ...userItems };
        newItems[itemId].quantity -= 1;
        if (newItems[itemId].quantity <= 0) {
            delete newItems[itemId];
        }
        
        await this.economy.updateUser(userId, { 
            activeEffects, 
            items: newItems 
        });
        
        return {
            success: true,
            message: `✅ ${item.name} equipado!\n🛡️ Durabilidad: ${randomDurability} usos\n📊 Bonus: ${item.effect.moneyMultiplier ? `+${Math.round((item.effect.moneyMultiplier - 1) * 100)}% 💰` : ''}${item.effect.luckBoost ? ` | +${Math.round(item.effect.luckBoost * 100)}% 🍀` : ''}`
        };
    }

    // === APLICAR BONUS DE EQUIPAMIENTO Y CONSUMIR DURABILIDAD ===
    async applyEquipmentBonus(userId, equipmentType = null) {
        const user = await this.economy.getUser(userId);
        const activeEffects = this.parseActiveEffects(user.activeEffects);

        // ✅ AGREGAR ESTO AL INICIO
        if (this.hasCurseActive(userId, activeEffects)) {
            return {
                applied: false,
                money: 0,
                luck: 0,
                attack: 0,
                defense: 0,
                items: []
            };
        }

        let bonusData = {
            applied: false,
            money: 0,
            luck: 0,
            attack: 0,
            defense: 0,
            items: []
        };

        // Buscar equipamiento activo
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            for (const effect of effects) {
                // Verificar que sea equipamiento
                if (!effect.equipmentType) continue;
                
                // Si se especificó un tipo, filtrar por ese tipo
                if (equipmentType && effect.equipmentType !== equipmentType) continue;
                
                // Verificar durabilidad
                if (effect.currentDurability <= 0) continue;
                
                const item = this.shopItems[itemId];
                if (!item) continue;

                // CONSUMIR DURABILIDAD ALEATORIA (1-3)
                const durabilityLoss = Math.floor(Math.random() * 3) + 1; // 1 a 3
                const previousDurability = effect.currentDurability;
                effect.currentDurability = Math.max(0, effect.currentDurability - durabilityLoss);
                
                // Acumular bonificaciones
                if (effect.moneyMultiplier) bonusData.money += (effect.moneyMultiplier - 1);
                if (effect.luckBoost) bonusData.luck += effect.luckBoost;
                if (effect.attackBonus) bonusData.attack += effect.attackBonus;
                if (effect.defenseBonus) bonusData.defense += effect.defenseBonus;
                
                bonusData.items.push({
                    id: itemId,
                    name: item.name,
                    durabilityLeft: effect.currentDurability,
                    maxDurability: effect.maxDurability,
                    durabilityLost: durabilityLoss,
                    wasBroken: effect.currentDurability <= 0
                });
                
                // Si se rompe, remover del array
                if (effect.currentDurability <= 0) {
                    const effectIndex = effects.indexOf(effect);
                    effects.splice(effectIndex, 1);
                    
                    if (effects.length === 0) {
                        delete activeEffects[itemId];
                    }
                }
                
                bonusData.applied = true;
            }
        }
        
        if (bonusData.applied) {
            await this.economy.updateUser(userId, { activeEffects });
        }
        
        return bonusData;
    }
    
    // 3. ACTUALIZAR applyPermanentEffect() - manejar VIP como especial
    async applyPermanentEffect(userId, itemId, item) {
        const user = await this.economy.getUser(userId);

        // ✅ AGREGAR ESTAS LÍNEAS:
        const permanentEffects = this.parseEffects(user.permanentEffects);
               
        // NUEVO: Manejar VIP Pass como caso especial
        if (item.id === 'vip_pass') {
//            const permanentEffects = this.parseEffects(user.permanentEffects);
            
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
//        const permanentEffects = this.parseEffects(user.permanentEffects);
        
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
            minAmount: item.effect.minAmount,
            maxAmount: item.effect.maxAmount,
            interval: item.effect.interval,
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
        const activeEffects = this.parseActiveEffects(user.activeEffects);        

        // ✅ AGREGAR ESTO AL INICIO
        if (this.hasCurseActive(userId, activeEffects)) {
            return { applied: false }; // Maldición desactiva herramientas
        }

        let totalBoost = 0;
        
        // Buscar efectos de success_boost para la acción específica
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            if (!Array.isArray(effects)) continue;
            
            for (const effect of effects) {
                // Verificar que el efecto esté activo
                if (effect.expiresAt && effect.expiresAt < Date.now()) continue;
                if (effect.usesLeft && effect.usesLeft <= 0) continue;

                // AGREGAR: Verificar robbery_boost para robos
                if (action === 'robbery' && effect.type === 'robbery_boost') {
                    totalBoost += effect.successRate || 0;
                }
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
        
        const activeEffects = this.parseActiveEffects(user.activeEffects);

        // ✅ VERIFICAR ESTO ESTÉ AL INICIO, ANTES DE TODO
        const curse = activeEffects['death_hand_curse'];
        if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
            return {
                multiplier: 1 + curse[0].moneyPenalty, // 0.75 (25% menos)
                reduction: 0,
                luckBoost: curse[0].luckPenalty // -0.5 (ya es negativo, no agregar -)
            };
        }

        const permanentEffects = this.parseEffects(user.permanentEffects);       
        
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
                
                const appliesToAction = targets.includes(action) || 
                    (targets.includes('all') && ['work', 'games', 'gambling'].includes(action)) ||
                    (targets.includes('games') && ['coinflip', 'dice', 'roulette'].includes(action));

                if (!appliesToAction) continue;

                // CAMBIAR el check del traje:
                if (effect.equipmentType) {
                    if (effect.moneyMultiplier) totalMultiplier *= effect.moneyMultiplier;
                    if (effect.luckBoost) totalLuckBoost += effect.luckBoost;
                    // Para futuro:
                    // if (effect.attackBonus) totalAttack += effect.attackBonus;
                    // if (effect.defenseBonus) totalDefense += effect.defenseBonus;
                    continue;
                }

                // Después de verificar equipmentType y antes de los otros checks
                if (effect.type === 'moby_dick_buff') {
                    if (effect.moneyMultiplier) totalMultiplier *= effect.moneyMultiplier;
                    if (effect.luckPenalty) totalLuckBoost += effect.luckPenalty; // Suma negativo
                    continue;
                }

                // AGREGAR ESTA LÍNEA - Filtrar efectos que no dan multiplicador de dinero
                if (['penalty_protection', 'cooldown_reduction', 'protection', 'xp_multiplier', 'vip_membership'].includes(effect.type)) continue;
                
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

        // Al final, después de calcular vipMultipliers
        if (vipMultipliers.multiplier > 1.0) {
            // Asincrono para no bloquear
            this.updateVipStats(userId, 'commandsUsed', 1).catch(() => {});
        }
        
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

    async cleanupExpiredEffects(userId) {
            const user = await this.economy.getUser(userId);
            const activeEffects = this.parseActiveEffects(user.activeEffects);
        
            let hasChanges = false;
            const now = Date.now();
            const expiredItems = [];
            
            for (const [itemId, effects] of Object.entries(activeEffects)) {
                if (!Array.isArray(effects)) continue;
                
                const validEffects = effects.filter(effect => {
                    // Verificar expiración por tiempo
                    if (effect.expiresAt && effect.expiresAt <= now) {
                        expiredItems.push({ itemId, reason: 'time_expired' });
                        return false;
                    }
                    
                    // Verificar agotamiento por usos
                    if (effect.usesLeft !== null && effect.usesLeft <= 0) {
                        expiredItems.push({ itemId, reason: 'uses_depleted' });
                        return false;
                    }
                    
                    // Verificar herramientas rotas por durabilidad
                    if (effect.type === 'mining_tool' && effect.currentDurability <= 0) {
                        expiredItems.push({ itemId, reason: 'durability_broken' });
                        return false;
                    }
                    
                    return true;
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
            
            return { hasChanges, expiredItems };
    }

    async checkLowItems(userId) {
        const user = await this.economy.getUser(userId);
        const activeEffects = this.parseActiveEffects(user.activeEffects);
        const lowItems = [];
        const now = Date.now();
        
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            if (!Array.isArray(effects)) continue;
            
            for (const effect of effects) {
                // Verificar usos bajos
                if (effect.usesLeft && effect.usesLeft === 1) {
                    lowItems.push({ itemId, type: 'low_uses', remaining: effect.usesLeft });
                }
                
                // Verificar durabilidad baja (herramientas)
                if (effect.type === 'mining_tool' && effect.currentDurability <= 10 && effect.currentDurability > 0) {
                    lowItems.push({ itemId, type: 'low_durability', remaining: effect.currentDurability });
                }
                
                // Verificar tiempo próximo a expirar (menos de 5 minutos)
                if (effect.expiresAt && (effect.expiresAt - now) <= 300000 && (effect.expiresAt - now) > 0) {
                    lowItems.push({ itemId, type: 'expiring_soon', timeLeft: effect.expiresAt - now });
                }
            }
        }
        
        return lowItems;
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
        const multipliers = await this.getActiveMultipliers(userId, 'all');
        const user = await this.economy.getUser(userId);
        const activeEffects = this.parseActiveEffects(user.activeEffects);

        // ✅ AGREGAR ESTO DESPUÉS DE PARSEAR
        if (this.hasCurseActive(userId, activeEffects)) {
            return baseXp; // Maldición desactiva multiplicadores de XP
        }
        
        let xpMultiplier = 1.0;
        
        // Buscar específicamente multiplicadores de XP
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            for (const effect of effects) {
                if (effect.type === 'xp_multiplier' || effect.type === 'xp_tornado') {
                    if (effect.expiresAt && effect.expiresAt < Date.now()) continue;
                    if (effect.multiplier) xpMultiplier *= effect.multiplier;
                    console.log("esta cosa que w");
                }
            }
        }
        
        return Math.floor(baseXp * xpMultiplier);
    }

    // === DECREMENTAR USOS DE ITEMS ===
    async decrementItemUses(userId, action) {
        const user = await this.economy.getUser(userId);
        const activeEffects = this.parseActiveEffects(user.activeEffects);
        
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

    async showAutoWorkerStatus(message) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
        const permanentEffects = this.parseEffects(user.permanentEffects);
        
        // Verificar si tiene auto_worker activo
        const hasAutoWorker = permanentEffects['auto_worker'];
        
        if (!hasAutoWorker) {
            const embed = new EmbedBuilder()
                .setTitle('🤖 Auto Worker - No Activo')
                .setDescription('No tienes un **Trabajador Automático** activo.')
                .addFields({
                    name: '🛒 ¿Cómo obtenerlo?',
                    value: 'Compra el item `auto_worker` en la tienda por 4,000,000 π-b$',
                    inline: false
                })
                .setColor('#FF0000');
            
            await message.reply({ embeds: [embed] });
            return;
        }
        
        // Calcular estadísticas
        let stats = user.passiveIncomeStats || '{"totalEarned": 0, "lastPayout": 0, "payoutCount": 0}';

        if (typeof stats === 'string') {
            try {
                stats = JSON.parse(stats);
            } catch (error) {
                stats = { totalEarned: 0, lastPayout: 0, payoutCount: 0 };
            }
        }

        const now = Date.now();
        const timeSinceLastPayout = now - (user.lastPassivePayout || stats.lastPayout || 0);

        console.log('🐛 Payout debug:', {
            now: now,
            lastPayout: stats.lastPayout,
            timeSinceLastPayout: timeSinceLastPayout,
            hoursUntilNext: Math.max(0, (3600000 - timeSinceLastPayout) / 3600000)
        });

        const hoursUntilNext = Math.max(0, (3600000 - timeSinceLastPayout) / 3600000);
        const activeSince = new Date(hasAutoWorker.appliedAt);
        
        // Formatear tiempo
        const formatTime = (hours) => {
            const h = Math.floor(hours);
            const m = Math.floor((hours % 1) * 60);
            return h > 0 ? `${h}h ${m}m` : `${m}m`;
        };
        
        const embed = new EmbedBuilder()
            .setTitle('🤖 Estado del Auto Worker')
            .setDescription('Tu trabajador automático está activo y generando dinero cada hora.')
            .addFields(
                {
                    name: '💰 Total Ganado',
                    value: `${stats.totalEarned.toLocaleString('es-ES')} π-b$`,
                    inline: true
                },
                {
                    name: '🔄 Pagos Recibidos',
                    value: `${stats.payoutCount} veces`,
                    inline: true
                },
                {
                    name: '⏱️ Próximo Pago',
                    value: hoursUntilNext <= 0 ? 'Disponible ahora' : `En ${formatTime(hoursUntilNext)}`,
                    inline: true
                },
                {
                    name: '📅 Activo Desde',
                    value: activeSince.toLocaleDateString('es-ES'),
                    inline: true
                },
                {
                    name: '💎 Rango de Ingresos',
                    value: '5,000 - 15,000 π-b$ por hora',
                    inline: true
                },
                {
                    name: '📊 Promedio por Pago',
                    value: stats.payoutCount > 0 ? 
                        `${Math.floor(stats.totalEarned / stats.payoutCount).toLocaleString('es-ES')} π-b$` : 
                        'Sin datos aún',
                    inline: true
                }
            )
            .setColor('#00FF00')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }

    // === PROCESAR INGRESOS PASIVOS ===
    async processPassiveIncome() {
        try {
            const allUsers = await this.economy.getAllUsers();
            let processedCount = 0;
            
            for (const user of allUsers) {
                const permanentEffects = this.parseEffects(user.permanentEffects);
                
                for (const [itemId, effect] of Object.entries(permanentEffects)) {
                    if (effect.type === 'passive_income') {
                        const lastPayout = user.lastPassivePayout || 0;
                        const now = Date.now();
                        
                        if (now - lastPayout >= 3600000) {
                            console.log('🐛 Effect data:', {
                                itemId: itemId,
                                effectType: effect.type,
                                minAmount: effect.minAmount,
                                maxAmount: effect.maxAmount
                            });

                            const amount = Math.floor(
                                Math.random() * (effect.maxAmount - effect.minAmount + 1)
                            ) + effect.minAmount;
                            
                            console.log('🐛 Calculated amount:', amount);

                            if (user.balance + amount <= this.economy.config.maxBalance) {
                                // Actualizar estadísticas
                                const currentStats = user.passiveIncomeStats || { totalEarned: 0, lastPayout: 0, payoutCount: 0 };

                                // Si passiveIncomeStats es string, parsearlo
                                let parsedStats = currentStats;
                                if (typeof currentStats === 'string') {
                                    try {
                                        parsedStats = JSON.parse(currentStats);
                                    } catch (error) {
                                        parsedStats = { totalEarned: 0, lastPayout: 0, payoutCount: 0 };
                                    }
                                }

                                const newStats = {
                                    totalEarned: parsedStats.totalEarned + amount,
                                    lastPayout: now,
                                    payoutCount: parsedStats.payoutCount + 1
                                };

                                await this.economy.updateUser(user.id, {
                                    balance: user.balance + amount,
                                    lastPassivePayout: now,
                                    passiveIncomeStats: newStats  // <- Convertir a string
                                });
                                
                                console.log(`🤖 Ingreso pasivo: ${amount} π-b$ para ${user.id.slice(-4)} (Total: ${newStats.totalEarned})`);
                                processedCount++;
                            }
                        }
                    }
                }

                // AGREGAR: Procesar VIP auto-daily
                const vipStatus = await this.hasActiveVip(user.id);
                if (vipStatus.hasVip) {
                    const lastDaily = user.vip_last_daily || 0;
                    const now = Date.now();
                    
                    if (now - lastDaily >= 86400000) { // 24 horas
                        const dailyAmount = Math.floor(Math.random() * 50000) + 100000; // 100k-150k
                        
                        if (user.balance + dailyAmount <= this.economy.config.maxBalance) {
                            await this.economy.updateUser(user.id, {
                                balance: user.balance + dailyAmount,
                                vip_last_daily: now
                            });
                            
                            console.log(`VIP Auto-Daily: ${dailyAmount} π-b$ para ${user.id.slice(-4)}`);
                            processedCount++;
                        }
                    }
                }                
            }
            
            if (processedCount > 0) {
                console.log(`✅ Procesados ${processedCount} ingresos pasivos`);
            }
            
        } catch (error) {
            console.error('❌ Error procesando ingresos pasivos:', error);
        }
    }

    // === OBTENER INFO DE EFECTOS ACTIVOS ===
    async getActiveEffectsInfo(userId) {
        const user = await this.economy.getUser(userId);
        const activeEffects = this.parseActiveEffects(user.activeEffects);
        const permanentEffects = this.parseEffects(user.permanentEffects);
        
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
        const permanentEffects = this.parseEffects(user.permanentEffects);
        const activeEffects = this.parseActiveEffects(user.activeEffects);

        // Verificar si tiene maldición activa
        const curse = activeEffects['death_hand_curse'];
        if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
            const timeLeft = curse[0].expiresAt - Date.now();
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            
            const curseEmbed = new EmbedBuilder()
                .setTitle('☠️ MALDICIÓN ACTIVA')
                .setDescription('**La Mano del Muerto** está afectándote.')
                .addFields(
                    { name: '💀 Efectos', value: '• Suerte -50%\n• Dinero -25%\n• Todos tus efectos están desactivados', inline: false },
                    { name: '⏰ Tiempo Restante', value: `${minutes}m ${seconds}s`, inline: true },
                    { name: '🔮 Lanzado Por', value: `<@${curse[0].appliedBy}>`, inline: true }
                )
                .setColor('#8B0000')
                .setTimestamp();
            
            await message.reply({ embeds: [curseEmbed] });
            return; // No mostrar otros efectos
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

                    // AGREGAR: Caso para equipamiento
                    if (effect.equipmentType) {
                        description += `${rarityEmoji} **${item.name}**\n`;
                        description += `├ Tipo: ${effect.equipmentType === 'suit' ? '👔 Traje' : effect.equipmentType}\n`;
                        
                        if (effect.moneyMultiplier) {
                            description += `├ Dinero: +${Math.round((effect.moneyMultiplier - 1) * 100)}% 💰\n`;
                        }
                        if (effect.luckBoost) {
                            description += `├ Suerte: +${Math.round(effect.luckBoost * 100)}% 🍀\n`;
                        }
                        if (effect.attackBonus) {
                            description += `├ Ataque: +${effect.attackBonus} ⚔️\n`;
                        }
                        if (effect.defenseBonus) {
                            description += `├ Defensa: +${effect.defenseBonus} 🛡️\n`;
                        }
                        
                        description += `└ Durabilidad: ${effect.currentDurability}/${effect.maxDurability}\n\n`;
                        continue; // Skip el resto para este efecto
                    }

                    // AGREGAR: Caso especial para herramientas
                    if (effect.type === 'mining_tool') {
                        description += `${rarityEmoji} **${item.name}**\n`;
                        if (itemId === 'eternal_pickaxe') {
                            description += `└ Durabilidad: ♾️ Infinita\n\n`;
                        } else {
                            description += `└ Durabilidad: ${effect.currentDurability}/${effect.durability}\n\n`;
                        }
                    }

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
        const activeEffects = this.parseActiveEffects(user.activeEffects);
    
        // ✅ AGREGAR ESTO AL INICIO
        if (this.hasCurseActive(userId, activeEffects)) {
            return 0; // Maldición desactiva reducción de cooldowns
        }

        const permanentEffects = this.parseEffects(user.permanentEffects);
        
        let reduction = 0;
        
        // Efectos temporales
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            for (const effect of effects) {
                if (effect.expiresAt && effect.expiresAt < Date.now()) continue;
                if (!effect.targets || (!effect.targets.includes(action) && !effect.targets.includes('all'))) continue;
                
                if (effect.type === 'cooldown_reduction' && effect.reduction) {
                    reduction += effect.reduction;
                }
            }
        }
        
        // Efectos permanentes
        for (const effect of Object.values(permanentEffects)) {
            if (effect.type === 'permanent_cooldown' && effect.targets && Array.isArray(effect.targets)) {
                // Verificar si el item aplica a esta acción o a todas
                if (effect.targets.includes(action) || effect.targets.includes('all')) {
                    reduction += effect.reduction;
                }
            }
        }
        
        // VIP
        const vipEffects = await this.getVipMultipliers(userId, action);
        if (vipEffects.noCooldown) {
            this.economy.missions.updateMissionProgress(userId, 'vip_commands_used').catch(() => {});
            this.updateVipStats(userId, 'timeSaved', 0.5).catch(() => {});
            reduction = 0.5; // 50% reducción = sin cooldown
        }
        
        return Math.min(reduction, 0.95); // Máximo 95% reducción
    }

    // 4. NUEVA FUNCIÓN: Verificar protección contra robos (actualizada)
    async getTheftProtection(userId) {
        const user = await this.economy.getUser(userId);
        const activeEffects = this.parseActiveEffects(user.activeEffects);
        
        // Verificar maldición
        if (this.hasCurseActive(userId, activeEffects)) {
            return { protected: false, reduction: 0 };
        }
        
        const permanentEffects = this.parseEffects(user.permanentEffects);
        
        let protection = 0;
        
        // ✅ NUEVO: Verificar condón del pibe 2 (100% protección)
        if (activeEffects['condon_pibe2']) {
            for (const effect of activeEffects['condon_pibe2']) {
                if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                    return { protected: true, type: 'condon', reduction: 1.0 }; // 100% garantizado
                }
            }
        }

        // Verificar Fortune Shield (90% protección según descripción)
        if (activeEffects['fortune_shield']) {
            for (const effect of activeEffects['fortune_shield']) {
                if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                    const roll = Math.random();
                    if (roll < 0.9) {
                        return { protected: true, type: 'fortune_shield', reduction: 0.9 };
                    } else {
                        return { protected: false, type: 'fortune_shield_failed', reduction: 0 };
                    }
                }
            }
        }
        
        // Verificar escudo antirrobo temporal (80% protección)
        if (activeEffects['anti_theft_shield']) {
            for (const effect of activeEffects['anti_theft_shield']) {
                console.log(`⏰ Efecto expira en:`, effect.expiresAt, 'Ahora:', Date.now());
                if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                    console.log(`✅ Protección activa!`);
                    // ✅ CAMBIO: Ahora con probabilidad 80%
                    const roll = Math.random();
                    if (roll < 0.8) {
                        return { protected: true, type: 'shield', reduction: 0.8 };
                    } else {
                        return { protected: false, type: 'shield_failed', reduction: 0 };
                    }
                }
            }
        }
        
        // Verificar bóveda permanente (60% protección según tu config)
        if (permanentEffects['permanent_vault']) {
            const vaultEffect = permanentEffects['permanent_vault'];
            if (vaultEffect && vaultEffect.reduction) {
                const roll = Math.random();
                if (roll < vaultEffect.reduction) {
                    return { protected: true, type: 'vault' };
                } else {
                    return { protected: false, type: 'vault_failed', reduction: 0 };
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
        const permanentEffects = this.parseEffects(user.permanentEffects);
        
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
        
        // Inicializar estadísticas VIP
        await this.economy.updateUser(userId, { 
            permanentEffects,
            vipStats: JSON.stringify({
                commandsUsed: 0,
                bonusEarnings: 0,
                luckyWins: 0,
                timeSaved: 0
            })
        });
        
        const days = Math.floor(item.effect.duration / (24 * 60 * 60 * 1000));
        return { 
            success: true, 
            message: `¡VIP activado por ${days} días! Disfruta de: sin cooldowns, doble ganancias, +20% suerte y comandos exclusivos.` 
        };
    }
    
    // Verificar si el usuario tiene VIP activo con tiempo
    async hasActiveVip(userId) {
        const user = await this.economy.getUser(userId);
        const permanentEffects = this.parseEffects(user.permanentEffects);
        
        // ✅ AGREGAR ESTA LÍNEA QUE FALTÓ
        const activeEffects = this.parseActiveEffects(user.activeEffects);

        // ✅ AGREGAR ESTO
        if (this.hasCurseActive(userId, activeEffects)) {
            return { hasVip: false }; // Maldición desactiva VIP temporalmente
        }

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
                    await this.applyNormalLimitOnVipExpiry(userId);

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
        const permanentEffects = this.parseEffects(user.permanentEffects);
        
        let multiplier = 1.0;
        let luckBoost = 0;
        let noCooldown = false;
        
        for (const effect of Object.values(permanentEffects)) {
            if (effect.type === 'vip_membership' && effect.benefits) {
                if (effect.benefits.includes('earnings_boost')) {
                    multiplier *= 1.5; // +50% en lugar de x2
                }
                if (effect.benefits.includes('luck_boost')) {
                    luckBoost += 0.10; // +10% en lugar de +20%
                }
                if (effect.benefits.includes('reduced_cooldowns')) {
                    reduction = 0.5; // -50% cooldowns
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
        const permanentEffects = this.parseEffects(user.permanentEffects);
        
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

    async applyPickaxeBonus(userId) {
        const user = await this.economy.getUser(userId);
        const activeEffects = this.parseActiveEffects(user.activeEffects);

        // ✅ AGREGAR ESTO AL INICIO
        if (this.hasCurseActive(userId, activeEffects)) {
            return { applied: false }; // Maldición desactiva herramientas
        }

        // Buscar herramientas en activeEffects
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            for (const effect of effects) {
                if (effect.type === 'mining_tool' && effect.currentDurability > 0) {
                    const item = this.shopItems[itemId];
                    if (!item) continue;

                    const durabilityLoss = Math.floor(Math.random() * 5) + 1; //1 a 5
                    
                    // Verificar si es pico eterno (no consumir durabilidad)
                    if (itemId === 'eternal_pickaxe') {
                        // No reducir durabilidad para pico eterno
                    } else if (effect.currentDurability > 0) {
                        effect.currentDurability = Math.max(0, effect.currentDurability - durabilityLoss);
                        
                        // Si se rompe, remover del array
                        if (effect.currentDurability <= 0) {
                            const effectIndex = effects.indexOf(effect);
                            effects.splice(effectIndex, 1);
                            
                            if (effects.length === 0) {
                                delete activeEffects[itemId];
                            }
                        }
                    }
                    
                    await this.economy.updateUser(userId, { activeEffects });
                    
                    return {
                        applied: true,
                        itemId: itemId,
                        multiplier: effect.multiplier,
                        name: item.name,
                        durabilityLeft: effect.currentDurability,
                        durabilityLost: itemId === 'eternal_pickaxe' ? 0 : durabilityLoss
                    };
                }
            }
        }
        
        // Verificar picos con usos limitados
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            if (!Array.isArray(effects)) continue;
            
            for (const effect of effects) {
                // Verificar pico dorado
                if (effect.type === 'mining_limited' && effect.usesLeft > 0) {
                    const item = this.shopItems[itemId];
                    if (item) {
                        // Consumir un uso
                        effect.usesLeft -= 1;
                        
                        // Si se acabaron los usos, remover
                        if (effect.usesLeft <= 0) {
                            const effectIndex = effects.indexOf(effect);
                            effects.splice(effectIndex, 1);
                            
                            if (effects.length === 0) {
                                delete activeEffects[itemId];
                            }
                        }
                        
                        await this.economy.updateUser(userId, { activeEffects });
                        
                        return {
                            applied: true,
                            itemId: itemId,
                            multiplier: effect.multiplier,
                            name: item.name,
                            usesLeft: effect.usesLeft
                        };
                    }
                }
            }
        }
        
        return { applied: false };
    }
    
    async removePermanentEffect(message, itemId) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
        const permanentEffects = this.parseEffects(user.permanentEffects);

        // Verificar que el usuario tiene el efecto activo
        if (!permanentEffects[itemId]) {
            await message.reply(`❌ No tienes el efecto de **${itemId}** activo.`);
            return;
        }
        
        const item = this.shopItems[itemId];
        if (!item) {
            await message.reply('❌ Item no encontrado.');
            return;
        }

        // Prevenir remoción de VIP
        if (itemId === 'vip_pass') {
            await message.reply('❌ La membresía VIP no se puede remover manualmente. Expira automáticamente.');
            return;
        }
        
        // ✅ CONFIRMACIÓN para items costosos
        const expensiveItems = ['auto_worker', 'permanent_vault'];
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
        const newPermanentEffects = { ...permanentEffects };
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
                purchaseDate: new Date().toISOString(),
                paidPrice: this.shopItems[itemId]?.price || 0
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

    // 9. MANEJAR INTERACCIONES DE BOTONES
    async handleButtonInteraction(interaction) {
        if (interaction.customId.startsWith('role_')) {
            await this.handleRoleConfirmation(interaction);
            return;
        }
        
        if (interaction.customId.startsWith('nickname_')) {
            await this.handleNicknameConfirmation(interaction);
            return;
        }
        
        // Nuevas interacciones VIP
        if (interaction.customId.startsWith('vip_')) {
            await this.handleVipButtonInteraction(interaction);
            return;
        }    
    }

    async handleVipButtonInteraction(interaction) {
        const [action, subAction, userId] = interaction.customId.split('_');
        
        if (interaction.user.id !== userId) {
            await interaction.reply({ content: '❌ Este botón no es para ti.', ephemeral: true });
            return;
        }
        
        const canUse = await this.canUseVipCommand(userId, 'vip_buttons');
        if (!canUse.canUse) {
            await interaction.reply({ content: `❌ ${canUse.reason}`, ephemeral: true });
            return;
        }
        
        switch (subAction) {
            case 'stats':
                await this.showDetailedVipStats(interaction);
                break;
            case 'extend':
                await this.showVipExtension(interaction);
                break;
        }
    }

    async showDetailedVipStats(interaction) {
        const vipStats = await this.getVipStats(interaction.user.id);
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Estadísticas VIP Detalladas')
            .addFields(
                { name: '⚡ Comandos sin Cooldown', value: `${vipStats.commandsUsed}`, inline: true },
                { name: '💰 Bonus Ganado', value: `${vipStats.bonusEarnings.toLocaleString('es-ES')} π-b$`, inline: true },
                { name: '🍀 Victorias con Suerte VIP', value: `${vipStats.luckyWins}`, inline: true },
                { name: '⏰ Tiempo Ahorrado', value: `${vipStats.timeSaved} horas`, inline: true }
            )
            .setColor('#FFD700');
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async showVipExtension(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('⏰ Extender Membresía VIP')
            .setDescription('Compra otro VIP Pass para extender tu membresía cuando expire.')
            .addFields(
                { name: '💰 Precio', value: '5,000,000 π-b$', inline: true },
                { name: '⏰ Duración', value: '+30 días', inline: true }
            )
            .setColor('#FFD700');
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 7. ESTADÍSTICAS VIP
    async getVipStats(userId) {
        const user = await this.economy.getUser(userId);
        let vipStats = user.vipStats || {};
        
        if (typeof vipStats === 'string') {
            try {
                vipStats = JSON.parse(vipStats);
            } catch {
                vipStats = {};
            }
        }
        
        return {
            commandsUsed: vipStats.commandsUsed || 0,
            bonusEarnings: vipStats.bonusEarnings || 0,
            luckyWins: vipStats.luckyWins || 0,
            timeSaved: vipStats.timeSaved || 0
        };
    }

    async updateVipStats(userId, stat, value) {
        const user = await this.economy.getUser(userId);
        let vipStats = await this.getVipStats(userId);
        
        vipStats[stat] = (vipStats[stat] || 0) + value;
        
        await this.economy.updateUser(userId, { vipStats });
    }

    // 5. VIP INSTANT WORK
    async vipInstantWork(message) {
        const user = await this.economy.getUser(message.author.id);
        
        // CAMBIAR: Sistema de límites diarios
        const today = new Date().toDateString();
        let vipUsage = user.vip_daily_usage || {};
        
        if (typeof vipUsage === 'string') {
            try {
                vipUsage = JSON.parse(vipUsage);
            } catch {
                vipUsage = {};
            }
        }
        
        // Resetear si es un nuevo día
        if (vipUsage.date !== today) {
            vipUsage = {
                date: today,
                vipWork: 0,
                vipGamble: 0
            };
        }
        
        // Verificar límite (3 usos por día)
        if (vipUsage.vipWork >= 3) {
            await message.reply('❌ Has alcanzado el límite diario de VIP Work (3/3). Resetea mañana.');
            return;
        }
        
        const baseEarnings = Math.floor(Math.random() * 5000) + 5000;
        const vipMultiplier = 1.5;
        const earnings = Math.floor(baseEarnings * vipMultiplier);
        
        // Aplicar límite VIP
        const vipLimit = await this.getVipLimit(message.author.id);
        if (user.balance >= vipLimit) {
            await message.reply('❌ Has alcanzado tu límite VIP de balance.');
            return;
        }
        
        const finalEarnings = Math.min(earnings, vipLimit - user.balance);
        
        // Actualizar usos
        vipUsage.vipWork += 1;
        
        await this.economy.updateUser(message.author.id, {
            balance: user.balance + finalEarnings,
            vip_daily_usage: vipUsage
        });
        
        await this.updateVipStats(message.author.id, 'bonusEarnings', finalEarnings - (finalEarnings / vipMultiplier));
        await this.economy.missions.updateMissionProgress(message.author.id, 'vip_commands_used');

        const embed = new EmbedBuilder()
            .setTitle('👑 VIP Instant Work')
            .setDescription(`Trabajo VIP completado exitosamente!`)
            .addFields(
                { name: '💰 Ganancia Base', value: `${Math.floor(finalEarnings / vipMultiplier).toLocaleString('es-ES')} π-b$`, inline: true },
                { name: '👑 Bonus VIP (2.0x)', value: `+${(finalEarnings - Math.floor(finalEarnings / vipMultiplier)).toLocaleString('es-ES')} π-b$`, inline: true },
                { name: '💎 Total Ganado', value: `**${finalEarnings.toLocaleString('es-ES')} π-b$**`, inline: false },
                { name: '📊 Usos Diarios', value: `${vipUsage.vipWork}/3 VIP Works usados hoy`, inline: true }
            )
            .setColor('#FFD700')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }

    async vipMegaGamble(message) {
        const user = await this.economy.getUser(message.author.id);
        
        // CAMBIAR: Sistema de límites diarios
        const today = new Date().toDateString();
        let vipUsage = user.vip_daily_usage || {};
        
        if (typeof vipUsage === 'string') {
            try {
                vipUsage = JSON.parse(vipUsage);
            } catch {
                vipUsage = {};
            }
        }
        
        // Resetear si es un nuevo día
        if (vipUsage.date !== today) {
            vipUsage = {
                date: today,
                vipWork: 0,
                vipGamble: 0
            };
        }
        
        // Verificar límite (2 usos por día)
        if (vipUsage.vipGamble >= 2) {
            await message.reply('❌ Has alcanzado el límite diario de VIP Gamble (2/2). Resetea mañana.');
            return;
        }
        
        const bet = Math.min(user.balance * 0.05, 25000);
        
        if (bet < 5000) {
            await message.reply('❌ Necesitas al menos 50,000 π-b$ para usar VIP Mega Gamble.');
            return;
        }
        
        const vipLuck = 0.52;
        const won = Math.random() < vipLuck;
        const multiplier = won ? 2.0 : 0;
        const result = won ? Math.floor(bet * multiplier) : -bet;
        
        // Actualizar usos
        vipUsage.vipGamble += 1;
        
        await this.economy.updateUser(message.author.id, {
            balance: user.balance + result,
            vip_daily_usage: vipUsage
        });
        
        if (won) {
            await this.updateVipStats(message.author.id, 'luckyWins', 1);
        }
        
        const embed = new EmbedBuilder()
            .setTitle(won ? '🎉 VIP Mega Gamble - ¡GANASTE!' : '💸 VIP Mega Gamble - Perdiste')
            .addFields(
                { name: '🎯 Apuesta', value: `${bet.toLocaleString('es-ES')} π-b$`, inline: true },
                { name: '🍀 Probabilidad VIP', value: '55% (vs 50% normal)', inline: true },
                { name: won ? '💰 Ganancia' : '💸 Pérdida', value: `${Math.abs(result).toLocaleString('es-ES')} π-b$`, inline: true },
                { name: '📊 Usos Diarios', value: `${vipUsage.vipGamble}/2 VIP Gambles usados hoy`, inline: true }
            )
            .setColor(won ? '#00FF00' : '#FF0000')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        await this.economy.missions.updateMissionProgress(message.author.id, 'vip_commands_used');
    }

    // 4. COMANDOS EXCLUSIVOS VIP
    async handleVipCommand(message, command) {
        const canUse = await this.canUseVipCommand(message.author.id, command);
        
        if (!canUse.canUse) {
            await message.reply(`❌ ${canUse.reason}`);
            return;
        }
        
        switch (command) {
            case 'vipwork':
                await this.vipInstantWork(message);
                break;
            case 'vipgamble':
                await this.vipMegaGamble(message);
                break;
            case 'vipboost':
                await this.vipTempBoost(message);
                break;
            case 'vipdaily':
                await this.vipDailyBonus(message);
                break;
        }
    }

    // NUEVO MÉTODO: Obtener límite según status VIP
    async getVipLimit(userId) {
        const vipStatus = await this.hasActiveVip(userId);
        return vipStatus.hasVip ? 20000000 : 10000000; // 20M para VIP, 10M normal
    }

    // NUEVO: Aplicar límite normal cuando expire VIP
    async applyNormalLimitOnVipExpiry(userId) {
        const user = await this.economy.getUser(userId);
        
        if (user.balance > this.economy.config.maxBalance) {
            const excessAmount = user.balance - this.economy.config.maxBalance;
            
            // Notificar al usuario
            const embed = new EmbedBuilder()
                .setTitle('⚠️ VIP Expirado - Límite de Balance Reducido')
                .setDescription(`Tu VIP ha expirado. Tu límite de balance se redujo de 20M a 10M.`)
                .addFields(
                    { name: '💰 Balance Actual', value: `${user.balance.toLocaleString('es-ES')} π-b$`, inline: true },
                    { name: '📉 Exceso Removido', value: `${excessAmount.toLocaleString('es-ES')} π-b$`, inline: true },
                    { name: '💎 Nuevo Balance', value: `${this.economy.config.maxBalance.toLocaleString('es-ES')} π-b$`, inline: true }
                )
                .setColor('#FF6600');
            
            // Reducir balance al límite normal
            await this.economy.updateUser(userId, {
                balance: this.economy.config.maxBalance
            });
            
            // Enviar notificación (necesitarías implementar un sistema de notificaciones)
            console.log(`📉 Usuario ${userId}: VIP expirado, balance reducido de ${user.balance} a ${this.economy.config.maxBalance}`);
        }
    }

    async vipDailyBonus(message) {
        await message.reply('💎 VIP Daily Bonus - Esta función usa el auto-daily automático. ¡Recibes bonus cada 24h automáticamente!');
    }

    /*async vipTempBoost(message) {
        const canUse = await this.canUseVipCommand(message.author.id, 'vipboost');
        if (!canUse.canUse) {
            await message.reply(`❌ ${canUse.reason}`);
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('⚡ VIP Temp Boost')
            .setDescription('Esta funcionalidad estará disponible pronto.')
            .addFields({
                name: '🚧 En Desarrollo',
                value: 'Los VIP Boosts temporales están siendo desarrollados.',
                inline: false
            })
            .setColor('#FFD700');
        
        await message.reply({ embeds: [embed] });
    }*/

    // In a few days plz
    async vipTempBoost(message) {
        const user = await this.economy.getUser(message.author.id);
        
        // Verificar cooldown (1 vez por día)
        const lastBoost = user.vip_last_boost || 0;
        const now = Date.now();
       
        if (now - lastBoost < 86400000) { // 24 horas
            const timeLeft = 86400000 - (now - lastBoost);
            const hours = Math.floor(timeLeft / 3600000);
            await message.reply(`❌ VIP Boost disponible en ${hours} horas.`);
            return;
        }
        
        // Aplicar boost temporal (multiplicador x2 por 1 hora)
        const activeEffects = this.parseActiveEffects(user.activeEffects);
        
        const boostEffect = {
            type: 'multiplier',
            targets: ['all'],
            multiplier: 2.0,
            appliedAt: now,
            expiresAt: now + 3600000 // 1 hora
        };
        
        if (!activeEffects['vip_boost']) {
            activeEffects['vip_boost'] = [];
        }
        activeEffects['vip_boost'].push(boostEffect);

        
        
        await this.economy.updateUser(message.author.id, {
            activeEffects,
            vip_last_boost: now
        });
        
        const embed = new EmbedBuilder()
            .setTitle('⚡ VIP Boost Activado')
            .setDescription('¡Tu boost temporal VIP está activo!')
            .addFields(
                { name: '🔥 Efecto', value: 'Ganancias x2 en todos los comandos', inline: true },
                { name: '⏰ Duración', value: '1 hora', inline: true },
                { name: '🔄 Cooldown', value: '24 horas hasta el próximo', inline: true }
            )
            .setColor('#FFD700')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }

    // 3. MEJORAR SISTEMA VIP - Nuevas funcionalidades
    async showVipDashboard(message) {
        const userId = message.author.id;
        const vipStatus = await this.hasActiveVip(userId);
        
        if (!vipStatus.hasVip) {
            // Mostrar beneficios VIP para no-VIPs
            const promoEmbed = new EmbedBuilder()
                .setTitle('👑 Membresía VIP - No Activa')
                .setDescription('¡Desbloquea beneficios premium con la membresía VIP!')
                .addFields(
                    { name: '🚀 Beneficios VIP', value: '• **Menos cooldowns** en comandos\n• **Ganancias x2** en trabajo y juegos\n• **+20% suerte** en juegos de azar\n• **Comandos exclusivos** VIP\n• **Soporte prioritario**', inline: false },
                    { name: '💰 Precio', value: '5,000,000 π-b$', inline: true },
                    { name: '⏰ Duración', value: '30 días', inline: true },
                    { name: '🛒 Comprar', value: '`>buy vip_pass`', inline: true }
                )
                .setColor('#FFD700')
                .setThumbnail('https://png.pngtree.com/png-vector/20250714/ourmid/pngtree-golden-vip-emblem-with-crown-and-laurel-wreath-png-image_16636155.webp'); // Agregar icono si tienes
            
            await message.reply({ embeds: [promoEmbed] });
            return;
        }
        
        // Dashboard VIP completo
        const user = await this.economy.getUser(userId);
        const vipData = await this.getVipStats(userId);

        // AGREGAR: Obtener usos diarios
        let vipUsage = user.vip_daily_usage || {};
        if (typeof vipUsage === 'string') {
            try {
                vipUsage = JSON.parse(vipUsage);
            } catch {
                vipUsage = {};
            }
        }
        
        const today = new Date().toDateString();
        if (vipUsage.date !== today) {
            vipUsage = { date: today, vipWork: 0, vipGamble: 0 };
        }
        
        const timeLeft = vipStatus.timeLeft;
        const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
        const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        
        const vipEmbed = new EmbedBuilder()
            .setTitle('👑 Dashboard VIP')
            .setDescription(`¡Bienvenido a tu área VIP, **${message.author.displayName}**!`)
            .addFields(
                { name: '⏰ Tiempo Restante', value: `${days} días, ${hours} horas`, inline: true },
                { name: '🎯 Tier VIP', value: vipStatus.tier, inline: true },
                { name: '📊 Comandos Sin Cooldown', value: `${vipData.commandsUsed || 0}`, inline: true },
                { name: '💰 Dinero Extra Ganado', value: `${(vipData.bonusEarnings || 0).toLocaleString('es-ES')} π-b$`, inline: true },
                { name: '🍀 Juegos con Suerte VIP', value: `${vipData.luckyWins || 0}`, inline: true },
                { name: '📈 Ahorro en Cooldowns', value: `~${vipData.timeSaved || 0} horas`, inline: true },
                { name: '🎮 Usos VIP Hoy', value: `VIP Work: ${vipUsage.vipWork}/3\nVIP Gamble: ${vipUsage.vipGamble}/2`, inline: true } // NUEVO
            )
            .setColor('#FFD700')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        
        // Botones VIP
        const vipButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`vip_stats_${userId}`)
                    .setLabel('📊 Estadísticas')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`vip_extend_${userId}`)
                    .setLabel('⏰ Extender VIP')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await message.reply({ embeds: [vipEmbed], components: [vipButtons] });
    }

    // 1. MANEJAR CREACIÓN DE ROL PERSONALIZADO
    async handleRoleCreate(message, args) {
        const userId = message.author.id;
        const input = message.content.trim().split(/ +/g);
        
        // Validar formato: >rolcreate #FFFFFF El Master
        if (input.length < 3) {
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Formato Incorrecto')
                    .setDescription('**Uso correcto:** `>rolcreate <#color> <nombre_del_rol>`\n\n**Ejemplo:** `>rolcreate #FF0000 Rey Supremo`')
                    .addFields({
                        name: '🎨 Colores Válidos',
                        value: '• Usa formato hexadecimal: #FF0000, #00FF00, #0000FF\n• Herramienta: [Selector de colores](https://htmlcolorcodes.com/)',
                        inline: false
                    })
                    .setColor('#FF0000')]
            });
            return;
        }
        
        const colorHex = input[1];
        const roleName = input.slice(2).join(' ');
        
        // Validar color hexadecimal
        if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(colorHex)) {
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Color Inválido')
                    .setDescription(`**${colorHex}** no es un color hexadecimal válido.`)
                    .addFields({
                        name: '✅ Formato Correcto',
                        value: '• `#FF0000` (rojo)\n• `#00FF00` (verde)\n• `#0000FF` (azul)\n• `#FFD700` (dorado)',
                        inline: false
                    })
                    .setColor('#FF0000')]
            });
            return;
        }
        
        // Validar longitud del nombre
        if (roleName.length > 25) {
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Nombre Muy Largo')
                    .setDescription('El nombre del rol no puede tener más de 25 caracteres.')
                    .setColor('#FF0000')]
            });
            return;
        }
        
        // Verificar caracteres prohibidos
        const forbiddenChars = /[<>@#&!]/;
        if (forbiddenChars.test(roleName)) {
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Caracteres No Permitidos')
                    .setDescription('El nombre del rol no puede contener: `< > @ # & !`')
                    .setColor('#FF0000')]
            });
            return;
        }
        
        // Verificar que tiene el token
        const user = await this.economy.getUser(userId);
        const userItems = user.items || {};
        
        if (!userItems['role_token'] || userItems['role_token'].quantity < 1) {
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Token Requerido')
                    .setDescription('Necesitas un **🎭 Token de Rol Personalizado** para crear un rol.')
                    .addFields(
                        { name: '💰 Precio', value: '2,000,000 π-b$', inline: true },
                        { name: '🛒 Comprar', value: '`>buy role_token`', inline: true }
                    )
                    .setColor('#FF0000')]
            });
            return;
        }
        
        // Verificar si ya tiene un rol personalizado
        /*const member = message.guild.members.cache.get(userId);
        const memberRoles = member.roles.cache;
        const hasCustomRole = memberRoles.some(role => 
            role.name.includes('👑') || 
            role.name.includes('⭐') || 
            (role.position > message.guild.roles.everyone.position && !role.managed && role.members.size === 1)
        );
        
        if (hasCustomRole) {
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Ya Tienes Rol Personalizado')
                    .setDescription('Solo puedes tener un rol personalizado a la vez. Contacta a un administrador si quieres cambiarlo.')
                    .setColor('#FF0000')]
            });
            return;
        }*/
        
        // Crear embed de confirmación
        const colorInt = parseInt(colorHex.replace('#', ''), 16);
        
        const confirmEmbed = new EmbedBuilder()
            .setTitle('🎭 Confirmar Creación de Rol')
            .setDescription(`¿Estás seguro de que quieres crear este rol personalizado?`)
            .addFields(
                { name: '📝 Nombre del Rol', value: `**${roleName}**`, inline: true },
                { name: '🎨 Color', value: `\`${colorHex}\``, inline: true },
                { name: '💎 Costo', value: '**1x** 🎭 Token de Rol Personalizado', inline: false },
{ name: '⚠️ Importante', value: '• El token será consumido permanentemente\n• Solo puedes tener un rol personalizado\n• El rol será creado y asignado en este servidor\n• 🎨 El color que elijas también cambiará el borde de tu `>bal` en cualquier servidor', inline: false }
            )
            .setColor(colorInt)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));
        
        // Crear botones
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`role_confirm_${userId}`)
                    .setLabel('✅ Crear Rol')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`role_cancel_${userId}`)
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Danger)
            );
        
        // Guardar datos temporales
        if (!this.pendingRoles) {
            this.pendingRoles = new Map();
        }
        
        this.pendingRoles.set(userId, {
            roleName: roleName,
            colorHex: colorHex,
            colorInt: colorInt,
            timestamp: Date.now()
        });
        
        const confirmMessage = await message.reply({ 
            embeds: [confirmEmbed], 
            components: [row] 
        });
        
        // Limpiar después de 60 segundos
        setTimeout(() => {
            this.pendingRoles.delete(userId);
            row.components.forEach(button => button.setDisabled(true));
            confirmMessage.edit({ components: [row] }).catch(() => {});
        }, 60000);
    }

    // 2. MANEJAR CONFIRMACIÓN DE CREACIÓN DE ROL
    async handleRoleConfirmation(interaction) {
        const userId = interaction.user.id;
        const action = interaction.customId.split('_')[1];
        
        if (!this.pendingRoles || !this.pendingRoles.has(userId)) {
            await interaction.reply({ content: '❌ Esta confirmación ha expirado.', ephemeral: true });
            return;
        }
        
        const roleData = this.pendingRoles.get(userId);
        this.pendingRoles.delete(userId);
        
        if (action === 'cancel') {
            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Creación Cancelada')
                    .setDescription('La creación del rol ha sido cancelada. Tu token no fue consumido.')
                    .setColor('#FF0000')],
                components: []
            });
            return;
        }
        
        if (action === 'confirm') {
            try {
                // Verificar token nuevamente
                const user = await this.economy.getUser(userId);
                const userItems = user.items || {};
                
                if (!userItems['role_token'] || userItems['role_token'].quantity < 1) {
                    await interaction.update({
                        embeds: [new EmbedBuilder()
                            .setTitle('❌ Token No Disponible')
                            .setDescription('Ya no tienes el token requerido.')
                            .setColor('#FF0000')],
                        components: []
                    });
                    return;
                }
                
                // Crear el rol en Discord usando REST API
                const guild = interaction.guild;
                const HOME_GUILD_ID = '1270508373732884522';
                const isHomeGuild = guild.id === HOME_GUILD_ID;
                let newRole = null;
                let member;

                if (isHomeGuild) {
                    try {
                        // Crear rol
                        newRole = await guild.roles.create({
                            name: `${roleData.roleName}`,
                            color: roleData.colorInt,
                            reason: `Rol personalizado creado por ${interaction.user.tag}`
                        });
                        
                        // Obtener miembro y asignar rol usando REST
                        member = await guild.members.fetch(userId);
                        await interaction.guild.members.edit(userId, {
                            roles: [...member.roles.cache.map(r => r.id), newRole.id]
                        });
                        
                    } catch (error) {
                        console.log('Error con método principal, intentando alternativo:', error);
                        
                        // Método alternativo: usar REST client directamente
                        try {
                            const { REST } = require('@discordjs/rest');
                            const rest = new REST({ version: '10' }).setToken(interaction.client.token);
                            
                            await rest.put(
                                `/guilds/${guild.id}/members/${userId}/roles/${newRole.id}`,
                                { reason: 'Token de rol personalizado' }
                            );
                        } catch (restError) {
                            throw new Error('No se pudo asignar el rol: ' + restError.message);
                        }
                    }
                }
                
                // Consumir el token
                const newItems = { ...userItems };
                newItems['role_token'].quantity -= 1;
                if (newItems['role_token'].quantity <= 0) {
                    delete newItems['role_token'];
                }
                
                await this.economy.updateUser(userId, { 
                    items: newItems, 
                    cosmetic_role: JSON.stringify({
                        name: roleData.roleName,
                        color: roleData.colorHex,
                        roleId: newRole?.id || null,
                        guildId: isHomeGuild ? guild.id : null
                    })
                });

                this.economy.database.userCache.delete(userId);
                
                // Confirmar éxito
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Rol Creado Exitosamente')
                    .setDescription(isHomeGuild
                        ? `Tu rol personalizado ha sido creado y asignado.`
                        : `Tu rol cosmético ha sido guardado. Puedes verlo usando >bal`)
                    .addFields(
                        { name: '🎭 Nombre del Rol', value: `**${roleData.roleName}**`, inline: true },
                        { name: '🎨 Color', value: `\`${roleData.colorHex}\``, inline: true },
                        ...(isHomeGuild && newRole ? [{ name: '🏷️ Rol en Discord', value: `<@&${newRole.id}>`, inline: true }] : []),
                        { name: '💎 Token Consumido', value: '1x 🎭 Token de Rol Personalizado', inline: false },
                        { name: '✨ Cosmético', value: 'Tu rol aparecerá en `>bal` en cualquier servidor', inline: false }
                    )
                    .setColor(roleData.colorInt)
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
                
                await interaction.update({ 
                    embeds: [successEmbed], 
                    components: [] 
                });
                
            } catch (error) {
                console.error('Error creando rol personalizado:', error);
                await interaction.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Error al Crear Rol')
                        .setDescription('Hubo un error al crear tu rol. Tu token no fue consumido. Contacta a un administrador.')
                        .addFields({
                            name: '🔧 Posibles Causas',
                            value: '• El bot no tiene permisos suficientes\n• El servidor alcanzó el límite de roles\n• Error temporal de Discord',
                            inline: false
                        })
                        .setColor('#FF0000')],
                    components: []
                });
            }
        }
    }

    async processUserRefund(userId, channel = null) {
        try {
            const user = await this.economy.getUser(userId);
            const items = user.items || {};
            
            let userRefundTotal = 0;
            let refundedItems = [];
            const updatedItems = { ...items };

            for (const [itemId, itemData] of Object.entries(items)) {
                const currentItem = this.shopItems[itemId];
                if (!currentItem || !itemData.paidPrice) continue;

                const diff = itemData.paidPrice - currentItem.price;
                if (diff <= 0) continue; // No bajó

                const refundAmount = diff * itemData.quantity;
                userRefundTotal += refundAmount;
                refundedItems.push({
                    name: currentItem.name,
                    quantity: itemData.quantity,
                    paidPrice: itemData.paidPrice,
                    currentPrice: currentItem.price,
                    refundAmount
                });

                updatedItems[itemId] = { ...itemData, paidPrice: currentItem.price };
            }

            if (userRefundTotal <= 0) return; // Nada que reembolsar

            await this.economy.addMoney(userId, userRefundTotal, 'price_refund');
            await this.economy.updateUser(userId, { items: updatedItems });

            // Notificar en el canal donde escribió
            if (channel) {
                const lines = refundedItems.map(i =>
                    `• **${i.name}** x${i.quantity}: ~~${i.paidPrice.toLocaleString()}~~ → ${i.currentPrice.toLocaleString()} π-b$ (**+${i.refundAmount.toLocaleString()}**)`
                ).join('\n');

                const embed = new EmbedBuilder()
                    .setTitle('💸 ¡Reembolso Automático!')
                    .setDescription(`<@${userId}>, bajaron los precios de algunos de tus items y recibiste la diferencia.`)
                    .addFields(
                        { name: '📦 Items Reembolsados', value: lines, inline: false },
                        { name: '💰 Total Recibido', value: `**+${userRefundTotal.toLocaleString()} π-b$**`, inline: false }
                    )
                    .setColor('#00FF00')
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error(`❌ Error en reembolso para ${userId}:`, error.message);
        }
    }

    async processItemRefunds(notifyChannel = null) {
        console.log('💸 Iniciando proceso de reembolsos...');
        let totalRefunded = 0;
        let usersRefunded = 0;
        const results = [];

        try {
            // Obtener todos los usuarios con items
            const [rows] = await this.economy.database.pool.execute(
                'SELECT id, items FROM users WHERE items IS NOT NULL AND items != "{}"'
            );

            for (const row of rows) {
                let items;
                try {
                    items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
                } catch { continue; }

                if (!items || Object.keys(items).length === 0) continue;

                let userRefundTotal = 0;
                let refundedItems = [];
                const updatedItems = { ...items };

                for (const [itemId, itemData] of Object.entries(items)) {
                    const currentItem = this.shopItems[itemId];
                    if (!currentItem) continue;

                    // Solo si tiene paidPrice guardado
                    const paidPrice = itemData.paidPrice;
                    if (!paidPrice) continue;

                    const currentPrice = currentItem.price;
                    // Solo reembolsar si bajó de precio
                    if (currentPrice >= paidPrice) continue;

                    const diff = paidPrice - currentPrice;
                    const refundAmount = diff * itemData.quantity;

                    userRefundTotal += refundAmount;
                    refundedItems.push({
                        name: currentItem.name,
                        quantity: itemData.quantity,
                        paidPrice,
                        currentPrice,
                        refundAmount
                    });

                    // Actualizar paidPrice al nuevo precio
                    updatedItems[itemId] = { ...itemData, paidPrice: currentPrice };
                }

                if (userRefundTotal > 0) {
                    await this.economy.addMoney(row.id, userRefundTotal, 'price_refund');
                    await this.economy.updateUser(row.id, { items: updatedItems });

                    totalRefunded += userRefundTotal;
                    usersRefunded++;
                    results.push({ userId: row.id, refundAmount: userRefundTotal, items: refundedItems });

                    // Notificar al usuario por DM
                    try {
                        const discordUser = await this.economy.client?.users?.fetch(row.id);
                        if (discordUser) {
                            const lines = refundedItems.map(i =>
                                `• **${i.name}** x${i.quantity}: ${i.paidPrice.toLocaleString()} → ${i.currentPrice.toLocaleString()} π-b$ (+${i.refundAmount.toLocaleString()})`
                            ).join('\n');

                            const dmEmbed = new EmbedBuilder()
                                .setTitle('💸 Reembolso por Bajada de Precio')
                                .setDescription('¡Los precios de algunos items bajaron y recibiste la diferencia!')
                                .addFields(
                                    { name: '📦 Items Reembolsados', value: lines, inline: false },
                                    { name: '💰 Total Recibido', value: `+${userRefundTotal.toLocaleString()} π-b$`, inline: false }
                                )
                                .setColor('#00FF00')
                                .setTimestamp();

                            const dm = await discordUser.createDM();
                            await dm.send({ embeds: [dmEmbed] });
                        }
                    } catch {} // Si no se puede DM, no importa
                }
            }

            console.log(`✅ Reembolsos completados: ${usersRefunded} usuarios, ${totalRefunded.toLocaleString()} π-b$ total`);

            if (notifyChannel) {
                const summaryEmbed = new EmbedBuilder()
                    .setTitle('✅ Proceso de Reembolsos Completado')
                    .addFields(
                        { name: '👥 Usuarios Reembolsados', value: `${usersRefunded}`, inline: true },
                        { name: '💰 Total Devuelto', value: `${totalRefunded.toLocaleString()} π-b$`, inline: true }
                    )
                    .setColor('#00FF00')
                    .setTimestamp();
                await notifyChannel.send({ embeds: [summaryEmbed] });
            }

            return { usersRefunded, totalRefunded, results };

        } catch (error) {
            console.error('❌ Error procesando reembolsos:', error);
            return { usersRefunded: 0, totalRefunded: 0, error: error.message };
        }
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
const HOME_GUILD_ID = '1270508373732884522';
const isHomeGuild = message.guild?.id === HOME_GUILD_ID;

let finalNickname = newNickname;
let baseNickname = '';

if (isHomeGuild) {
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

    baseNickname = `${match[1]} ${match[2]}`;
    finalNickname = `${baseNickname} - ${newNickname}`;

    if (finalNickname.length > 32) {
        const maxCustomLength = 32 - baseNickname.length - 3;
        await message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Apodo Muy Largo')
                .setDescription(`El apodo final sería muy largo.\n\n**Tu base:** ${baseNickname}\n**Máximo:** ${maxCustomLength} caracteres`)
                .setColor('#FF0000')]
        });
        return;
    }
}
        
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
    ...(isHomeGuild ? [
        { name: '📝 Apodo Actual', value: `**${currentNickname}**`, inline: true },
        { name: '✨ Nuevo Apodo', value: `**${finalNickname}**`, inline: true },
    ] : [
        { name: '✨ Tu apodo en >bal', value: `💰 ${currentNickname} ✦ **${newNickname}**`, inline: false },
    ]),
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
            baseNickname: baseNickname || null,
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
                const HOME_GUILD_ID = '1270508373732884522'; // ID de tu server
                if (interaction.guild.id === HOME_GUILD_ID) {
                    const member = interaction.guild.members.cache.get(userId);
                    await member.setNickname(nicknameData.finalNickname);
                }
                
                // Consumir el token
                const newItems = { ...userItems };
                newItems['nickname_token'].quantity -= 1;
                if (newItems['nickname_token'].quantity <= 0) {
                    delete newItems['nickname_token'];
                }
                
                await this.economy.updateUser(userId, { 
                    items: newItems,
                    cosmetic_nickname: nicknameData.newNickname
                });

this.economy.database.userCache.delete(userId);
                
                // Confirmar éxito
                const isHomeGuild = interaction.guild.id === HOME_GUILD_ID;

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Apodo Guardado Exitosamente')
                    .setDescription(isHomeGuild
                        ? `Tu apodo ha sido actualizado correctamente.`
                        : `Tu apodo cosmético fue guardado. Puedes verlo usando >bal`)
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

    // Función para notificar items expirados/agotados
    async notifyExpiredItems(userId, expiredItems, message) {
        if (expiredItems.length === 0) return;
        
        let notificationText = '';
        
        for (const expired of expiredItems) {
            const item = this.shopItems[expired.itemId];
            if (!item) continue;
            
            const rarityEmoji = this.rarityEmojis[item.rarity];
            
            if (expired.reason === 'time_expired') {
                notificationText += `${rarityEmoji} **${item.name}** ha expirado por tiempo\n`;
            } else if (expired.reason === 'uses_depleted') {
                notificationText += `${rarityEmoji} **${item.name}** se agotó (sin usos restantes)\n`;
            } else if (expired.reason === 'durability_broken') {
                notificationText += `⚒️ **${item.name}** se rompió por falta de durabilidad\n`;
            }
        }
        
        if (notificationText.trim()) {
            const embed = new EmbedBuilder()
                .setTitle('⚰️ Items Expirados')
                .setDescription(notificationText)
                .setColor('#666666')
                .setFooter({ text: 'Puedes comprar nuevos items en >shop' });
            
            await message.reply({ embeds: [embed] });
        }
    }

    // Función para notificar advertencias de items por agotarse
    async notifyLowItems(userId, lowItems, message) {
        if (lowItems.length === 0) return;
        
        let warningText = '';
        
        for (const warning of lowItems) {
            const item = this.shopItems[warning.itemId];
            if (!item) continue;
            
            const rarityEmoji = this.rarityEmojis[item.rarity];
            
            if (warning.type === 'low_uses') {
                warningText += `⚠️ ${rarityEmoji} **${item.name}**: ${warning.remaining} uso${warning.remaining > 1 ? 's' : ''} restante${warning.remaining > 1 ? 's' : ''}\n`;
            } else if (warning.type === 'low_durability') {
                warningText += `🔧 ${rarityEmoji} **${item.name}**: ${warning.remaining} durabilidad restante\n`;
            } else if (warning.type === 'expiring_soon') {
                const timeLeft = warning.timeLeft;
                const minutes = Math.floor(timeLeft / 60000);
                warningText += `⏰ ${rarityEmoji} **${item.name}**: expira en ${minutes} minuto${minutes > 1 ? 's' : ''}\n`;
            }
        }
        
        if (warningText.trim()) {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Items por Agotarse')
                .setDescription(warningText)
                .setColor('#FFA500')
                .setFooter({ text: 'Considera comprar reemplazos pronto' });
            
            await message.reply({ embeds: [embed] });
        }
    }

    async showVipHelp(message) {
        const canUse = await this.canUseVipCommand(message.author.id, 'vip_help');
        
        if (!canUse.canUse) {
            await message.reply(`❌ ${canUse.reason}`);
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('👑 Comandos VIP Disponibles')
            .setDescription('Lista completa de comandos exclusivos para miembros VIP')
            .addFields(
                { name: '📊 Dashboard y Estado', value: '`>vip` - Ver tu dashboard VIP completo', inline: false },
                { name: '💼 Comandos de Trabajo VIP', value: '`>vipwork` - Trabajo instantáneo con bonus x2.5', inline: false },
                { name: '🎲 Comandos de Juegos VIP', value: '`>vipgamble` - Mega apuesta con 65% de ganar y x3 multiplicador', inline: false },
                { name: '⚡ Beneficios Automáticos', value: '• Sin cooldowns en comandos normales\n• Ganancias x2 automáticas\n• +20% suerte en juegos\n• Auto-daily cada 24h', inline: false },
                { name: '🆘 Soporte', value: '`>viphelp` - Mostrar esta ayuda', inline: false }
            )
            .setColor('#FFD700')
            .setFooter({ text: 'Los beneficios se aplican automáticamente mientras tengas VIP activo' });
        
        await message.reply({ embeds: [embed] });
    }

    async throwCurse(message, targetUserId) {
        const user = await this.economy.getUser(message.author.id);
        const userItems = user.items || {};
        
        if (!userItems['death_hand'] || userItems['death_hand'].quantity < 1) {
            await message.reply('❌ No tienes **☠️ La Mano del Muerto** para lanzar.');
            return;
        }
        
        // Consumir el item
        const newItems = { ...userItems };
        newItems['death_hand'].quantity -= 1;
        if (newItems['death_hand'].quantity <= 0) {
            delete newItems['death_hand'];
        }
        
        await this.economy.updateUser(message.author.id, { items: newItems });
        
        // Aplicar maldición al objetivo
        const targetUser = await this.economy.getUser(targetUserId);
        const activeEffects = this.parseActiveEffects(targetUser.activeEffects);
        
        const curseEffect = {
            type: 'death_hand_curse',
            luckPenalty: -0.5,
            moneyPenalty: -0.25,
            disablesEffects: true,
            appliedAt: Date.now(),
            expiresAt: Date.now() + 1800000, // 1 hora
            appliedBy: message.author.id
        };
        
        if (!activeEffects['death_hand_curse']) {
            activeEffects['death_hand_curse'] = [];
        }
        activeEffects['death_hand_curse'].push(curseEffect);
        
        await this.economy.updateUser(targetUserId, { activeEffects });
        
        const embed = new EmbedBuilder()
            .setTitle('☠️ Maldición Lanzada')
            .setDescription(`<@${message.author.id}> lanzó **La Mano del Muerto** a <@${targetUserId}>!`)
            .addFields(
                { name: '💀 Efectos', value: '• Suerte -50%\n• Dinero -25%\n• Efectos desactivados', inline: true },
                { name: '⏰ Duración', value: '30 minutos', inline: true }
            )
            .setColor('#8B0000')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }

    async applyRandomCurse(userId) {
        const user = await this.economy.getUser(userId);
        const activeEffects = this.parseActiveEffects(user.activeEffects);
        
        const curseEffect = {
            type: 'death_hand_curse',
            luckPenalty: -0.5,
            moneyPenalty: -0.25,
            disablesEffects: true,
            appliedAt: Date.now(),
            expiresAt: Date.now() + 900000, // 15 minutos
            appliedBy: 'random' // Identificar que fue aleatorio
        };
        
        if (!activeEffects['death_hand_curse']) {
            activeEffects['death_hand_curse'] = [];
        }
        activeEffects['death_hand_curse'].push(curseEffect);
        
        await this.economy.updateUser(userId, { activeEffects });
    }

    // === COMANDOS ===
    async processCommand(message){
        if (message.author.bot) return;

        // Verificar ingresos pasivos pendientes
        await this.economy.checkPendingPassiveIncome(message.author.id);
        await this.checkAndNotifyExpiredItems(message.author.id, message);

        const args = message.content.toLowerCase().split(' ');
        const command = args[0];
        await this.economy.missions.updateMissionProgress(message.author.id, 'commands_used');
/*const commandName = command.replace('>', '');
        await this.economy.missions.updateMissionProgress(message.author.id, 'unique_commands_used', commandName);*/

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
                case '>throw':
                case '>lanzar':
                    if (!args[1]) {
                        await message.reply('❌ Menciona a quién lanzar la maldición. Ejemplo: `>throw @usuario`');
                        return;
                    }
                    const targetUserId = message.mentions.users.first()?.id;
                    if (!targetUserId) {
                        await message.reply('❌ Debes mencionar un usuario válido.');
                        return;
                    }
                    await this.throwCurse(message, targetUserId);
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
                case '>autoworkerbal':
                case '>autoworker':
                case '>awbal':
                    await this.showAutoWorkerStatus(message);
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
                case '>rolcreate':
                case '>createrol':
                    const roleArgs = message.content.trim().split(/ +/g);
                    await this.handleRoleCreate(message, roleArgs);
                    break;
                case '>vip':
                case '>vipdashboard':
                    await this.showVipDashboard(message);
                    break;
                    
                case '>vipwork':
                case '>vipgamble':
                case '>vipboost':
                case '>vipdaily':
                    await this.handleVipCommand(message, command.replace('>', ''));
                    break;
                case '>viphelp':
                case '>helpvip':
                case '>comandosvip':
                    await this.showVipHelp(message);
                    break;
            }
        } catch (error) {
            console.error('❌ Error en sistema de tienda:', error);
            await message.reply('❌ Ocurrió un error en la tienda. Intenta de nuevo.');
        }
    }

    // Método para conectar eventos
    connectEventsSystem(eventsSystem) {
        this.events = eventsSystem;
        console.log('🎮 Sistema de eventos conectado a economia');
    }
}

module.exports = ShopSystem;
