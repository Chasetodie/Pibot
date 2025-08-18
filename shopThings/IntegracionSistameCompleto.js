// === INTEGRACIÓN FINAL DEL SISTEMA COMPLETO ===

// En tu archivo principal (index.js o bot.js)
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const cron = require('node-cron');

// Importar todos los sistemas
const EconomySystem = require('./economy');
const ShopSystem = require('./shop');
const MissionsSystem = require('./missions');
const EventsSystem = require('./events'); // Si lo tienes
const { 
    AchievementSystem, 
    TradeSystem, 
    AuctionSystem, 
    CraftingSystem 
} = require('./advanced-features');

// Inicializar cliente
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// === INICIALIZACIÓN DE SISTEMAS ===
let economy, shop, missions, events, achievements, trades, auctions, crafting;

client.once('ready', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    
    // Inicializar sistemas en orden
    economy = new EconomySystem();
    shop = new ShopSystem(economy);
    missions = new MissionsSystem(economy);
    events = new EventsSystem(); // Si tienes sistema de eventos
    
    // Sistemas avanzados
    achievements = new AchievementSystem(shop);
    trades = new TradeSystem(shop);
    auctions = new AuctionSystem(shop);
    crafting = new CraftingSystem(shop);
    
    // Conectar sistemas
    economy.shop = shop;
    economy.missions = missions;
    missions.connectEventsSystem(events);
    
    console.log('🎮 Todos los sistemas inicializados correctamente');
    
    // Limpiar efectos expirados al iniciar
    await shop.cleanupExpiredEffects();
});

// === PROCESADOR PRINCIPAL DE MENSAJES ===
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const args = message.content.toLowerCase().split(' ');
    const command = args[0];
    
    try {
        // === COMANDOS DE ECONOMÍA BÁSICA ===
        switch (command) {
            case '>balance':
            case '>bal':
                await showBalance(message);
                break;
                
            case '>work':
                await enhancedWorkCommand(message);
                break;
                
            case '>daily':
                await enhancedDailyCommand(message);
                break;
                
            case '>gamble':
            case '>bet':
                if (!args[1]) {
                    await message.reply('❌ Especifica la cantidad. Ejemplo: `>bet 500`');
                    return;
                }
                await enhancedGambleCommand(message, parseInt(args[1]));
                break;
                
            case '>transfer':
            case '>pay':
                const targetUser = message.mentions.users.first();
                const amount = parseInt(args[2]);
                
                if (!targetUser || !amount) {
                    await message.reply('❌ Uso: `>pay @usuario cantidad`');
                    return;
                }
                
                await transferMoney(message, targetUser, amount);
                break;
                
            case '>profile':
            case '>perfil':
                let target = message.mentions.users.first() || message.author;
                await enhancedProfileCommand(message, target);
                break;
        }
        
        // === COMANDOS DE TIENDA ===
        await shop.processCommand(message);
        
        // === COMANDOS DE MISIONES ===
        await missions.processCommand(message);
        
        // === COMANDOS AVANZADOS ===
        switch (command) {
            case '>achievements':
            case '>logros':
                await showAchievements(message);
                break;
                
            case '>trade':
                if (!args[1] || !message.mentions.users.first()) {
                    await message.reply('❌ Uso: `>trade @usuario item_id:cantidad`');
                    return;
                }
                await initiateTrade(message, args);
                break;
                
            case '>tradeaccept':
                await acceptTrade(message);
                break;
                
            case '>tradecancel':
                await cancelTrade(message);
                break;
                
            case '>auction':
                if (args.length < 3) {
                    await message.reply('❌ Uso: `>auction item_id precio_inicial [duración_en_minutos]`');
                    return;
                }
                const duration = parseInt(args[3]) || 60;
                await auctions.createAuction(message, args[1], parseInt(args[2]), duration * 60000);
                break;
                
            case '>bid':
                if (args.length < 3) {
                    await message.reply('❌ Uso: `>bid auction_id cantidad`');
                    return;
                }
                await auctions.placeBid(message, args[1], parseInt(args[2]));
                break;
                
            case '>auctions':
                await showActiveAuctions(message);
                break;
                
            case '>recipes':
                await crafting.showRecipes(message);
                break;
                
            case '>craft':
                if (!args[1]) {
                    await message.reply('❌ Especifica la receta. Usa `>recipes` para ver las disponibles.');
                    return;
                }
                await crafting.craftItem(message, args[1]);
                break;
                
            case '>vip':
                await vipCommand(message);
                break;
        }
        
        // === COMANDOS ADMINISTRATIVOS ===
        if (message.member?.permissions.has('ADMINISTRATOR')) {
            switch (command) {
                case '>giveitem':
                    await giveItemCommand(message, args);
                    break;
                    
                case '>shopstats':
                    await shopStatsCommand(message);
                    break;
                    
                case '>givemoney':
                    const giveTarget = message.mentions.users.first();
                    const giveAmount = parseInt(args[2]);
                    
                    if (giveTarget && giveAmount) {
                        const user = await economy.getUser(giveTarget.id);
                        await economy.updateUser(giveTarget.id, { balance: user.balance + giveAmount });
                        await message.reply(`✅ Se han dado **${giveAmount.toLocaleString('es-ES')} π-b$** a ${giveTarget.displayName}.`);
                    }
                    break;
                    
                case '>resetuser':
                    const resetTarget = message.mentions.users.first();
                    if (resetTarget) {
                        await economy.updateUser(resetTarget.id, {
                            balance: 0,
                            items: {},
                            activeEffects: {},
                            permanentEffects: {},
                            xp: 0,
                            level: 1
                        });
                        await message.reply(`✅ Usuario ${resetTarget.displayName} ha sido reseteado.`);
                    }
                    break;
            }
        }
        
        // === ACTUALIZAR PROGRESO DE MISIONES ===
        const completedMissions = await missions.updateMissionProgress(message.author.id, 'message');
        await missions.notifyCompletedMissions(message, completedMissions);
        
        // === VERIFICAR LOGROS ===
        const newAchievements = await achievements.checkAchievements(message.author.id);
        for (const achievement of newAchievements) {
            await notifyAchievement(message, achievement);
        }
        
    } catch (error) {
        console.error('❌ Error procesando comando:', error);
        await message.reply('❌ Ocurrió un error inesperado. Intenta de nuevo.');
    }
});

// === FUNCIONES DE COMANDOS ===

async function showBalance(message) {
    const user = await economy.getUser(message.author.id);
    const embed = new EmbedBuilder()
        .setTitle(`💰 Balance de ${message.author.displayName}`)
        .setDescription(`**${(user.balance || 0).toLocaleString('es-ES')} π-b$**`)
        .setColor('#00FF00')
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));
    
    await message.reply({ embeds: [embed] });
}

async function transferMoney(message, targetUser, amount) {
    if (targetUser.id === message.author.id) {
        await message.reply('❌ No puedes transferir dinero a ti mismo.');
        return;
    }
    
    if (amount < 1) {
        await message.reply('❌ La cantidad mínima es **1 π-b$**.');
        return;
    }
    
    const sender = await economy.getUser(message.author.id);
    const receiver = await economy.getUser(targetUser.id);
    
    if (sender.balance < amount) {
        await message.reply(`❌ No tienes suficiente dinero. Balance: **${sender.balance.toLocaleString('es-ES')} π-b$**.`);
        return;
    }
    
    // Realizar transferencia
    await economy.updateUser(message.author.id, { balance: sender.balance - amount });
    await economy.updateUser(targetUser.id, { balance: receiver.balance + amount });
    
    // Actualizar misiones
    await missions.updateMissionProgress(message.author.id, 'money_transferred', amount);
    
    const embed = new EmbedBuilder()
        .setTitle('💸 Transferencia Exitosa')
        .setDescription(`${message.author} transfirió **${amount.toLocaleString('es-ES')} π-b$** a ${targetUser}`)
        .setColor('#00FF00')
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

async function showAchievements(message) {
    const user = await economy.getUser(message.author.id);
    const userAchievements = user.achievements || {};
    
    const embed = new EmbedBuilder()
        .setTitle(`🏆 Logros de ${message.author.displayName}`)
        .setColor('#FFD700')
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));
    
    let achievementsText = '';
    let unlockedCount = 0;
    
    for (const [achievementId, achievement] of Object.entries(achievements.achievements)) {
        const isUnlocked = userAchievements[achievementId];
        const status = isUnlocked ? '✅' : '🔒';
        
        if (isUnlocked) {
            unlockedCount++;
            const date = new Date(isUnlocked.unlockedAt).toLocaleDateString();
            achievementsText += `${status} **${achievement.name}**\n${achievement.description}\n*Desbloqueado: ${date}*\n\n`;
        } else {
            achievementsText += `${status} **${achievement.name}**\n${achievement.description}\n\n`;
        }
    }
    
    embed.setDescription(`**${unlockedCount}/${Object.keys(achievements.achievements).length}** logros desbloqueados\n\n${achievementsText}`);
    
    await message.reply({ embeds: [embed] });
}

async function notifyAchievement(message, achievement) {
    const embed = new EmbedBuilder()
        .setTitle('🎉 ¡Logro Desbloqueado!')
        .setDescription(`**${achievement.name}**\n\n${achievement.description}`)
        .setColor('#FFD700')
        .addFields({ name: '🎁 Recompensa', value: `+${achievement.reward.money} π-b$`, inline: true })
        .setTimestamp();
    
    await message.channel.send({
        content: `<@${message.author.id}>`,
        embeds: [embed],
        allowedMentions: { users: [message.author.id] }
    });
}

async function showActiveAuctions(message) {
    const activeAuctions = Array.from(auctions.activeAuctions.values())
        .filter(auction => auction.active)
        .slice(0, 10); // Mostrar máximo 10
    
    if (activeAuctions.length === 0) {
        await message.reply('❌ No hay subastas activas en este momento.');
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('🔨 Subastas Activas')
        .setColor('#FF6600');
    
    for (const auction of activeAuctions) {
        const item = shop.shopItems[auction.itemId];
        const timeLeft = Math.max(0, auction.endsAt - Date.now());
        const minutesLeft = Math.floor(timeLeft / 60000);
        
        const rarityEmoji = item ? shop.rarityEmojis[item.rarity] : '❓';
        
        embed.addFields({
            name: `${rarityEmoji} ${auction.itemName}`,
            value: `**Puja actual:** ${auction.currentBid.toLocaleString('es-ES')} π-b$\n**Termina en:** ${minutesLeft} minutos\n**ID:** \`${auction.id}\``,
            inline: true
        });
    }
    
    embed.setFooter({ text: 'Usa >bid <auction_id> <cantidad> para pujar' });
    
    await message.reply({ embeds: [embed] });
}

// === TAREAS PROGRAMADAS ===

// Limpiar efectos expirados cada minuto
cron.schedule('* * * * *', async () => {
    try {
        await shop.cleanupExpiredEffects();
    } catch (error) {
        console.error('❌ Error limpiando efectos:', error);
    }
});

// Reset de misiones diarias a medianoche (Ecuador)
cron.schedule('0 0 * * *', async () => {
    console.log('🌅 Nuevo día - Las misiones se resetearán cuando los usuarios interactúen');
});

// Evento de fin de semana
cron.schedule('0 0 * * 6', async () => { // Sábado 00:00
    console.log('🎉 Iniciando evento de fin de semana');
    
    const embed = new EmbedBuilder()
        .setTitle('🛍️ ¡Evento de Fin de Semana!')
        .setDescription('¡Todos los items de la tienda tienen **20% de descuento**!')
        .setColor('#FF6600')
        .addFields({ 
            name: '⏰ Duración', 
            value: 'Hasta el domingo a las 23:59', 
            inline: false 
        })
        .setTimestamp();
    
    // Enviar a canal específico (reemplazar con tu canal ID)
    const channel = client.channels.cache.get('TU_CANAL_ANUNCIOS_ID');
    if (channel) {
        await channel.send({ embeds: [embed] });
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
        console.error('❌ Error en interacción:', error);
        await interaction.reply({ content: '❌ Ocurrió un error.', ephemeral: true });
    }
});

async function handleShopInteraction(interaction) {
    const parts = interaction.customId.split('_');
    
    if (interaction.isStringSelectMenu()) {
        if (parts[1] === 'category') {
            const category = interaction.values[0];
            
            const fakeMessage = {
                author: interaction.user,
                reply: async (options) => {
                    await interaction.update(options);
                }
            };
            
            await shop.showShop(fakeMessage, category, 1);
        }
    } else if (interaction.isButton()) {
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

// === INICIAR BOT ===
client.login('TU_TOKEN_DEL_BOT');

// === MANEJO DE ERRORES ===
process.on('unhandledRejection', error => {
    console.error('❌ Error no manejado:', error);
});

client.on('error', error => {
    console.error('❌ Error del cliente Discord:', error);
});

console.log('🚀 Bot iniciando...');