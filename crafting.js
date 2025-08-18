// crafting.js - Sistema de crafteo
const { getUserData, updateUserItems, addItemToInventory, SHOP_ITEMS } = require('./shop');

// Recetas de crafteo
const CRAFTING_RECIPES = {
    1: {
        id: 1,
        name: "Poción Superior",
        description: "Una poción que cura 250 HP",
        emoji: "🧪✨",
        type: "consumable",
        effect: "heal",
        value: 250,
        requirements: {
            1: 3, // 3 Pociones de Vida
            2: 1  // 1 Poción de Maná
        },
        result: {
            itemId: 'crafted_1',
            quantity: 1
        }
    },
    2: {
        id: 2,
        name: "Espada Mágica",
        description: "Aumenta ataque en 50",
        emoji: "⚔️✨",
        type: "weapon",
        effect: "attack_boost",
        value: 50,
        requirements: {
            4: 2, // 2 Espadas de Hierro
            6: 1  // 1 Llave Dorada
        },
        result: {
            itemId: 'crafted_2',
            quantity: 1
        }
    },
    3: {
        id: 3,
        name: "Escudo Reforzado",
        description: "Aumenta defensa en 35",
        emoji: "🛡️✨",
        type: "armor",
        effect: "defense_boost",
        value: 35,
        requirements: {
            5: 2, // 2 Escudos de Madera
            4: 1  // 1 Espada de Hierro (para el metal)
        },
        result: {
            itemId: 'crafted_3',
            quantity: 1
        }
    },
    4: {
        id: 4,
        name: "Mega Boost XP",
        description: "Triplica XP por 2 horas",
        emoji: "⭐💫",
        type: "buff",
        effect: "xp_boost",
        duration: 7200000, // 2 horas en ms
        multiplier: 3,
        requirements: {
            3: 3, // 3 Boosts de XP normales
        },
        result: {
            itemId: 'crafted_4',
            quantity: 1
        }
    }
};

// Agregar items crafteados al catálogo principal (para referencias)
const CRAFTED_ITEMS = {
    'crafted_1': {
        id: 'crafted_1',
        name: "Poción Superior",
        description: "Una poción que cura 250 HP",
        type: "consumable",
        effect: "heal",
        value: 250,
        emoji: "🧪✨"
    },
    'crafted_2': {
        id: 'crafted_2',
        name: "Espada Mágica",
        description: "Aumenta ataque en 50",
        type: "weapon",
        effect: "attack_boost",
        value: 50,
        emoji: "⚔️✨"
    },
    'crafted_3': {
        id: 'crafted_3',
        name: "Escudo Reforzado",
        description: "Aumenta defensa en 35",
        type: "armor",
        effect: "defense_boost",
        value: 35,
        emoji: "🛡️✨"
    },
    'crafted_4': {
        id: 'crafted_4',
        name: "Mega Boost XP",
        description: "Triplica XP por 2 horas",
        type: "buff",
        effect: "xp_boost",
        duration: 7200000,
        multiplier: 3,
        emoji: "⭐💫"
    }
};

// Comando: Mostrar recetas de crafteo
async function showCraftingRecipes(message) {
    try {
        const embed = {
            color: 0x9932cc,
            title: '🔨 **RECETAS DE CRAFTEO**',
            description: 'Usa `>craft <id>` para craftear un item',
            fields: []
        };
        
        Object.values(CRAFTING_RECIPES).forEach(recipe => {
            let requirements = '';
            Object.entries(recipe.requirements).forEach(([itemId, quantity]) => {
                const item = SHOP_ITEMS[itemId];
                if (item) {
                    requirements += `${item.emoji} ${quantity}x ${item.name}\n`;
                }
            });
            
            embed.fields.push({
                name: `${recipe.emoji} ${recipe.name} (ID: ${recipe.id})`,
                value: `${recipe.description}\n\n**Materiales:**\n${requirements}`,
                inline: false
            });
        });
        
        await message.channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error mostrando recetas:', error);
        message.reply('❌ Error al mostrar las recetas.');
    }
}

// Función para verificar si el usuario tiene los materiales necesarios
function hasRequiredMaterials(userItems, requirements) {
    for (const [itemId, requiredQuantity] of Object.entries(requirements)) {
        const userQuantity = userItems[itemId] || 0;
        if (userQuantity < requiredQuantity) {
            return false;
        }
    }
    return true;
}

// Función para consumir materiales del inventario
function consumeMaterials(userItems, requirements) {
    const newItems = { ...userItems };
    
    for (const [itemId, requiredQuantity] of Object.entries(requirements)) {
        newItems[itemId] -= requiredQuantity;
        if (newItems[itemId] <= 0) {
            delete newItems[itemId];
        }
    }
    
    return newItems;
}

// Comando: Craftear item
async function craftItem(message, args) {
    try {
        if (!args[0]) {
            return message.reply('❌ Especifica el ID de la receta: `>craft <id>`');
        }
        
        const recipeId = parseInt(args[0]);
        const recipe = CRAFTING_RECIPES[recipeId];
        
        if (!recipe) {
            return message.reply('❌ Receta no encontrada. Usa `>recipes` para ver las disponibles.');
        }
        
        const userData = await getUserData(message.author.id);
        if (!userData) {
            return message.reply('❌ Usuario no registrado.');
        }
        
        const userItems = userData.items || {};
        
        // Verificar si tiene los materiales necesarios
        if (!hasRequiredMaterials(userItems, recipe.requirements)) {
            let missingMaterials = '';
            Object.entries(recipe.requirements).forEach(([itemId, requiredQuantity]) => {
                const userQuantity = userItems[itemId] || 0;
                const item = SHOP_ITEMS[itemId];
                if (userQuantity < requiredQuantity) {
                    missingMaterials += `${item.emoji} ${item.name}: ${userQuantity}/${requiredQuantity}\n`;
                }
            });
            
            const embed = {
                color: 0xff0000,
                title: '❌ **MATERIALES INSUFICIENTES**',
                description: 'Te faltan los siguientes materiales:',
                fields: [
                    {
                        name: '📦 Materiales Faltantes',
                        value: missingMaterials,
                        inline: false
                    }
                ]
            };
            
            return message.channel.send({ embeds: [embed] });
        }
        
        // Consumir materiales
        const newItems = consumeMaterials(userItems, recipe.requirements);
        
        // Agregar item crafteado
        const craftedItemId = recipe.result.itemId;
        if (newItems[craftedItemId]) {
            newItems[craftedItemId] += recipe.result.quantity;
        } else {
            newItems[craftedItemId] = recipe.result.quantity;
        }
        
        // Actualizar inventario
        const success = await updateUserItems(message.author.id, newItems);
        
        if (success) {
            const embed = {
                color: 0x00ff00,
                title: '🔨 **CRAFTEO EXITOSO**',
                description: `¡Has crafteado **${recipe.name}**! ${recipe.emoji}`,
                fields: [
                    {
                        name: '📝 Descripción',
                        value: recipe.description,
                        inline: false
                    },
                    {
                        name: '📦 Cantidad Obtenida',
                        value: recipe.result.quantity.toString(),
                        inline: true
                    }
                ]
            };
            
            await message.channel.send({ embeds: [embed] });
        } else {
            message.reply('❌ Error al craftear el item.');
        }
        
    } catch (error) {
        console.error('Error crafteando item:', error);
        message.reply('❌ Error al procesar el crafteo.');
    }
}

// Función para obtener información de un item (shop o crafted)
function getItemInfo(itemId) {
    // Primero buscar en items de tienda
    if (SHOP_ITEMS[itemId]) {
        return SHOP_ITEMS[itemId];
    }