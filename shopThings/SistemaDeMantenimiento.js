// === SISTEMA DE MANTENIMIENTO Y INICIALIZACIÓN ===

// 1. En tu archivo principal (index.js o bot.js)
const cron = require('node-cron');

// Inicializar sistemas
const EconomySystem = require('./economy');
const ShopSystem = require('./shop');
const MissionsSystem = require('./missions');

const economy = new EconomySystem();
const shop = new ShopSystem(economy);
const missions = new MissionsSystem(economy);

// Conectar sistemas
economy.shop = shop;
economy.missions = missions;
missions.connectEventsSystem(events); // Si tienes sistema de eventos

// === TAREAS PROGRAMADAS ===

// Limpiar efectos expirados cada minuto
cron.schedule('* * * * *', async () => {
    try {
        await shop.cleanupExpiredEffects();
    } catch (error) {
        console.error('❌ Error limpiando efectos:', error);
    }
});

// === MANEJO DE INTERACCIONES ===
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
    
    try {
        if (interaction.customId.startsWith('shop_')) {
            await handleShopInteraction(interaction);
        }
    } catch (error) {
        console.error('❌ Error en interacción de tienda:', error);
        await interaction.reply({ content: '❌ Ocurrió un error.', ephemeral: true });
    }
});

async function handleShopInteraction(interaction) {
    const parts = interaction.customId.split('_');
    
    if (interaction.isStringSelectMenu()) {
        // Cambio de categoría
        if (parts[1] === 'category') {
            const category = interaction.values[0];
            const message = interaction.message;
            
            // Simular mensaje original para usar showShop
            const fakeMessage = {
                author: interaction.user,
                reply: async (options) => {
                    await interaction.update(options);
                }
            };
            
            await shop.showShop(fakeMessage, category, 1);
        }
    } else if (interaction.isButton()) {
        // Navegación de páginas
        if (parts[1] === 'prev' || parts[1] === 'next') {
            const category = parts[2];
            const page = parseInt(parts[3]);
            
            const fakeMessage = {
                author: interaction.user,
                reply: async (options) => {
                    await interaction.update(options);
                }
            };
            
            await shop.showShop(fakeMessage, category, page);
        }
    }
}

// === COMANDOS ADMINISTRATIVOS ===

// Comando para dar items a usuarios (solo admins)
async function giveItemCommand(message, args) {
    // Verificar permisos de admin
    if (!message.member.permissions.has('ADMINISTRATOR')) {
        await message.reply('❌ No tienes permisos para usar este comando.');
        return;
    }
    
    const targetUser = message.mentions.users.first();
    const itemId = args[2];
    const quantity = parseInt(args[3]) || 1;
    
    if (!targetUser || !itemId) {
        await message.reply('❌ Uso: `>giveitem @usuario item_id cantidad`');
        return;
    }
    
    const item = shop.shopItems[itemId];
    if (!item) {
        await message.reply('❌ Item no encontrado.');
        return;
    }
    
    const user = await economy.getUser(targetUser.id);
    const userItems = user.items || {};
    
    if (userItems[itemId]) {
        userItems[itemId].quantity += quantity;
    } else {
        userItems[itemId] = {
            id: itemId,
            quantity: quantity,
            purchaseDate: new Date().toISOString()
        };
    }
    
    await economy.updateUser(targetUser.id, { items: userItems });
    
    await message.reply(
        `✅ Se ha dado **${item.name} x${quantity}** a ${targetUser.displayName}.`
    );
}

// Comando para ver estadísticas de la tienda
async function shopStatsCommand(message) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
        await message.reply('❌ No tienes permisos para usar este comando.');
        return;
    }
    
    // Obtener estadísticas de todos los usuarios
    const allUsers = await economy.getAllUsers(); // Implementar según tu DB
    
    let totalItems = 0;
    let totalValue = 0;
    let itemCounts = {};
    let activeEffectsCount = 0;
    
    for (const user of allUsers) {
        if (user.items) {
            for (const [itemId, userItem] of Object.entries(user.items)) {
                const item = shop.shopItems[itemId];
                if (!item) continue;
                
                totalItems += userItem.quantity;
                totalValue += item.price * userItem.quantity;
                itemCounts[itemId] = (itemCounts[itemId] || 0) + userItem.quantity;
            }
        }
        
        if (user.activeEffects && Object.keys(user.activeEffects).length > 0) {
            activeEffectsCount++;
        }
    }
    
    const embed = new EmbedBuilder()
        .setTitle('📊 Estadísticas de la Tienda')
        .setColor('#FFD700')
        .addFields(
            { name: '👥 Usuarios con Items', value: `${allUsers.filter(u => u.items && Object.keys(u.items).length > 0).length}`, inline: true },
            { name: '📦 Items Totales', value: `${totalItems}`, inline: true },
            { name: '💰 Valor Total', value: `${totalValue.toLocaleString('es-ES')} π-b$`, inline: true },
            { name: '⚡ Usuarios con Efectos Activos', value: `${activeEffectsCount}`, inline: true }
        );
    
    // Top 5 items más comprados
    const topItems = Object.entries(itemCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([itemId, count]) => {
            const item = shop.shopItems[itemId];
            return `${item ? item.name : itemId}: ${count}`;
        });
    
    if (topItems.length > 0) {
        embed.addFields({ 
            name: '🏆 Items Más Populares', 
            value: topItems.join('\n'), 
            inline: false 
        });
    }
    
    await message.reply({ embeds: [embed] });
}

// === FUNCIONES DE UTILIDAD ===

// Función para migrar items antiguos (si cambias la estructura)
async function migrateUserItems() {
    console.log('🔄 Migrando items de usuarios...');
    
    const allUsers = await economy.getAllUsers();
    
    for (const user of allUsers) {
        if (!user.items) continue;
        
        let hasChanges = false;
        const newItems = {};
        
        for (const [itemId, itemData] of Object.entries(user.items)) {
            // Si el item es un número (formato antiguo)
            if (typeof itemData === 'number') {
                newItems[itemId] = {
                    id: itemId,
                    quantity: itemData,
                    purchaseDate: new Date().toISOString()
                };
                hasChanges = true;
            } else {
                newItems[itemId] = itemData;
            }
        }
        
        if (hasChanges) {
            await economy.updateUser(user.id, { items: newItems });
            console.log(`✅ Migrado usuario ${user.id}`);
        }
    }
    
    console.log('✅ Migración completada');
}

// === EXPORTAR FUNCIONES ===
module.exports = {
    handleShopInteraction,
    giveItemCommand,
    shopStatsCommand,
    migrateUserItems
};