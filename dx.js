// 🔥 Booster de Experiencia
'xp_booster': {
    id: 'xp_booster',
    category: 'consumable',
    name: '🔥 XP Booster',
    description: 'Multiplica la experiencia x2 durante 24 horas',
    rarity: 'epic',
    effect: {
        type: 'xp_boost',
        multiplier: 2,
        duration: 86400
    },
    stackable: true,
    maxStack: 1
},

// 💰 Bolsa Misteriosa
'mystery_bag': {
    id: 'mystery_bag',
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
    id: 'golden_skin',
    category: 'cosmetic',
    name: '✨ Golden Skin',
    description: 'Un objeto puramente cosmético para presumir',
    rarity: 'legendary',
    effect: {
        type: 'cosmetic'
    },
    stackable: false
}



// 🎁 Cofre Premium
'premium_chest': {
    id: 'premium_chest',
    category: 'special',
    name: '🎁 Cofre Premium',
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
    category: 'special',
    name: '🏆 Cofre Legendario',
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



// 🐉 Dragón de Cristal (Boss)
'crystal_dragon': {
    id: 'crystal_dragon',
    name: '🐉 Dragón de Cristal',
    description: 'Un jefe legendario que protege tesoros ocultos',
    difficulty: 'legendary',
    drops: [
        { id: 'diamond_pickaxe', chance: 0.15 },
        { id: 'eternal_pickaxe', chance: 0.05 },
        { id: 'cosmic_charm', chance: 0.1 },
        { id: 'infinity_charm', chance: 0.02 },
        { id: 'fortune_shield', chance: 0.08 },
        { id: 'xp_tornado', chance: 0.12 },
        { id: 'vip_pass', chance: 0.05 },
        { id: 'golden_skin', chance: 0.03 },
        { id: 'mystery_bag', chance: 0.2 },
        { id: 'money', amountRange: [5000, 20000], chance: 0.5 }
    ]
},

// 👻 Rey Fantasma (Mini-evento)
'phantom_king': {
    id: 'phantom_king',
    name: '👻 Rey Fantasma',
    description: 'Un espíritu vengativo con riquezas ocultas',
    difficulty: 'epic',
    drops: [
        { id: 'phantom_gloves', chance: 0.1 },
        { id: 'cosmic_charm', chance: 0.05 },
        { id: 'xp_booster', chance: 0.15 },
        { id: 'energy_drink', chance: 0.2 },
        { id: 'lucky_charm', chance: 0.25 },
        { id: 'mystery_bag', chance: 0.3 },
        { id: 'money', amountRange: [2000, 10000], chance: 0.6 }
    ]
}