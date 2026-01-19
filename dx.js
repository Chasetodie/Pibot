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


// ESPADA (para cuando implementes combate)
'iron_sword': {
    id: 'iron_sword',
    name: '⚔️ Espada de Hierro',
    description: 'Una espada básica para combate',
    price: 500000,
    category: 'equipment',
    rarity: 'rare',
    effect: {
        type: 'weapon',
        equipmentType: 'sword',
        attackBonus: 15,
        baseDurability: 80,
        durabilityVariation: 15 // 65-95 usos
    },
    stackable: false,
    maxStack: 1
},

// ARMADURA
'leather_armor': {
    id: 'leather_armor',
    name: '🛡️ Armadura de Cuero',
    description: 'Protección básica contra ataques',
    price: 600000,
    category: 'equipment',
    rarity: 'rare',
    effect: {
        type: 'armor',
        equipmentType: 'armor',
        defenseBonus: 20,
        baseDurability: 120,
        durabilityVariation: 30 // 90-150 usos
    },
    stackable: false,
    maxStack: 1
}