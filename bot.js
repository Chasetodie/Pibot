const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, Events, REST, Routes, Collection } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const CommandHandler = require('./commands'); // Importar el manejador de comandos
const EconomySystem = require('./economy'); // Importar el sistema de economia
const EventsSystem = require('./events');
const TradeSystem = require('./trade');
const MinigamesSystem = require('./minigames'); // Importar el sistema de minijuegos
const AchievementsSystem = require('./achievements');
const BettingSystem = require('./betting');
const MissionsSystem = require('./missions');
const ShopSystem = require('./shop');
const AllCommands = require('./all-commands');
const LocalDatabase = require('./database');
const MusicSystem = require('./musicSystem.js');
const ChatBotSystem = require('./chatBot.js');
//require('./admin-panel')(app); // Pasar el servidor express existente
const {
    AuctionSystem,
    CraftingSystem
} = require('./things-shop');

if (typeof File === 'undefined') {
  global.File = class File {
    constructor() {
      throw new Error('File is not supported in this environment.');
    }
  };
}

// Configuración del bot de Discord con TODOS los intents necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ],
    makeCache: () => new Map(), // Caché más pequeño
});

// Crear instancia del manejador de comandos
const commandHandler = new CommandHandler();

//Crear instancia del sistema de economia
const economy = new EconomySystem(client);

//Crear instancia del sistema de Misiones
const missions = new MissionsSystem(economy);

//Crear instancia del sistema de Achievements
const achievements = new AchievementsSystem(economy);

//Crear instancia del sistema de Tienda
const shop = new ShopSystem(economy);

//Crear instancia del sistema de Minijuegos
const minigames = new MinigamesSystem(economy, shop, client);

const music = new MusicSystem(client);

const database = new LocalDatabase();
database.startCacheCleanup();

const chatbot = new ChatBotSystem(database, economy);

//Crear instancia del sistema de Eventos
const events = new EventsSystem(economy, client);
shop.connectEventsSystem(events);
missions.connectEventsSystem(events);
achievements.connectEventsSystem(events);
economy.connectEventsSystem(events);
minigames.connectEventsSystem(events);

setTimeout(async () => {
    await events.loadEvents();
    console.log('✅ Sistemas de eventos listo');
}, 2000);

/*setInterval(async () => {
    await economy.database.backup(); // Crear backup cada 6 horas
}, 6 * 60 * 60 * 1000);*/

const betting = new BettingSystem(economy);

const trades = new TradeSystem(shop);

const auctions = new AuctionSystem(shop);

const crafting = new CraftingSystem(shop, client);

// Instancia del sistema de comandos mejorados
const allCommands = new AllCommands(economy, shop, trades, auctions, crafting, events, betting);

economy.achievements = achievements;
minigames.achievements = achievements;

economy.missions = missions;
minigames.missions = missions;

economy.shop = shop;

economy.startCacheCleanup();
trades.startCacheCleanup();
missions.startCacheCleanup();
events.startCacheCleanup();
minigames.startCacheCleanup();
startExpirationMonitor(shop, economy);

const userCooldowns = new Map();
const messageBatch = [];
const PROCESSING_QUEUE = [];

// CONFIGURACIÓN AGRESIVA
const CONFIG = {
    XP_COOLDOWN: 3000,        // 10 segundos (aumentado)
    MAX_MESSAGES_PER_SECOND: 3, // Máximo 3 mensajes procesados por segundo
    MAX_CACHE_SIZE: 500,       // Reducido a 500
    BATCH_SIZE: 5,             // Procesar en lotes de 5
    PROCESSING_INTERVAL: 2000,  // Procesar cada 2 segundos
    MEMORY_LIMIT: 150,         // MB límite antes de parar todo
    EMERGENCY_MODE: false      // Modo emergencia
};

let isProcessing = false;
let messageCount = 0;
let lastSecond = Date.now();

function cleanupCache() {
    if (userCooldowns.size > MAX_CACHE_SIZE) {
        const now = Date.now();
        const entries = Array.from(userCooldowns.entries());
        
        // Ordenar por tiempo y mantener solo los más recientes
        const recent = entries
            .filter(([_, time]) => now - time < COOLDOWN_TIME * 2)
            .slice(-MAX_CACHE_SIZE / 2);
        
        userCooldowns.clear();
        recent.forEach(([userId, time]) => userCooldowns.set(userId, time));
    }
}

function checkMessageRate() {
    const now = Date.now();
    if (now - lastSecond >= 1000) {
        console.log(`📊 Mensajes/segundo: ${messageCount}`);
        if (messageCount > CONFIG.MAX_MESSAGES_PER_SECOND * 3) {
            CONFIG.EMERGENCY_MODE = true;
            console.log('🚨 MODO EMERGENCIA ACTIVADO - Demasiados mensajes');
        }
        messageCount = 0;
        lastSecond = now;
    }
}

// LIMPIEZA AGRESIVA DE MEMORIA
function aggressiveCleanup() {
    userCooldowns.clear();
    messageBatch.length = 0;
    PROCESSING_QUEUE.length = 0;
    
    if (global.gc) {
        global.gc();
        console.log('🧹 Limpieza agresiva ejecutada');
    }
}

// PROCESADOR DE LOTES (BATCH PROCESSING)
async function processBatch() {
    if (isProcessing || messageBatch.length === 0) return;
    
    isProcessing = true;
    const batch = messageBatch.splice(0, CONFIG.BATCH_SIZE);
    
    console.log(`⚙️ Procesando lote de ${batch.length} mensajes`);
    
    for (const messageData of batch) {
        try {
            await processMessageSafe(messageData);
        } catch (error) {
            console.error('❌ Error en lote:', error.message);
        }
    }
    
    isProcessing = false;
}

// PROCESAMIENTO SEGURO DE MENSAJES
async function processMessageSafe({ message, userId, now }) {
    try {
        // Solo XP, nada más
        const xpResult = await Promise.race([
            economy.processMessageXp(userId),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 3000)
            )
        ]);
        
        // Level up solo si es necesario
        if (xpResult?.levelUp) {
            const channelId = '1402824824971067442';
            const channel = message.guild.channels.cache.get(channelId);
            if (channel) {
                await sendLevelUpSafe(message, xpResult, channel);
            }
        }
        
    } catch (error) {
        console.error('❌ Error procesando mensaje:', error.message);
    }
}

function startExpirationMonitor(shop, economy) {
    setInterval(async () => {
        try {
            console.log('🔍 Verificando expiraciones automáticas...');
            const allUsers = await economy.getAllUsers();
            let processedUsers = 0;
            
            for (const user of allUsers) {
                const activeEffects = shop.parseActiveEffects(user.activeEffects);
                const now = Date.now();
                let hasExpiredItems = false;
                
                // Verificar si hay items expirados
                for (const [itemId, effects] of Object.entries(activeEffects)) {
                    if (!Array.isArray(effects)) continue;
                    
                    for (const effect of effects) {
                        if (effect.expiresAt && effect.expiresAt <= now) {
                            hasExpiredItems = true;
                            break;
                        }
                        // AGREGAR: verificar usos también
                        if (effect.usesLeft !== null && effect.usesLeft <= 0) {
                            hasExpiredItems = true;
                            break;
                        }
                    }
                    if (hasExpiredItems) break;
                }
                
                if (hasExpiredItems) {
                    // Llamar directamente las funciones del shop
                    const cleanupResult = await shop.cleanupExpiredEffects(user.id);
                    if (cleanupResult.expiredItems.length > 0) {
                        try {
                            const discordUser = await economy.client.users.fetch(user.id);
                            
                            const mockMessage = { 
                                reply: (content) => discordUser.send(content) 
                            };
                            
                            await shop.notifyExpiredItems(user.id, cleanupResult.expiredItems, mockMessage);
                            processedUsers++;
                        } catch (error) {
                            console.log(`No se pudo notificar a usuario ${user.id}: ${error.message}`);
                        }
                    }
                }
            }
            
            if (processedUsers > 0) {
                console.log(`⚰️ Notificadas expiraciones a ${processedUsers} usuarios`);
            }
            
        } catch (error) {
            console.error('❌ Error en monitor de expiraciones:', error);
        }
    }, 2 * 60 * 1000);
    
    console.log('🔍 Monitor de expiraciones iniciado (cada 2 minutos)');
}

// LEVEL UP SEGURO Y SIMPLE
async function sendLevelUpSafe(message, xpResult, channel) {
    try {
        const levelUpEmbed = new EmbedBuilder()
            .setTitle('🎉 ¡Nuevo Nivel!')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setDescription(`${message.author} alcanzó el **Nivel ${xpResult.newLevel}**`)
            .addFields(
                { name: '📈 XP Ganada', value: `+${xpResult.xpGained} XP`, inline: true },
                { name: '🎁 Recompensa', value: `+${xpResult.reward} π-b$`, inline: true },
                { name: '🏆 Niveles Subidos', value: `${xpResult.levelsGained}`, inline: true },
                { name: '🎉 Extra por Eventos', value: `${xpResult.eventMessage || "No hay eventos Activos"} `, inline: false }                    
            )
            .setColor('#FFD700')
            .setTimestamp();
        await channel.send({ 
            content: `<@${message.author.id}>`,
            embeds: [levelUpEmbed],
            allowedMentions: { users: [message.author.id] }
        });        
    } catch (error) {
        console.error('❌ Error level up:', error.message);
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor web corriendo en puerto ${PORT} en todas las interfaces`);
    console.log(`🔗 URLs disponibles:`);
    console.log(`   - Salud: http://0.0.0.0:${PORT}/health`);
    console.log(`   - Principal: http://0.0.0.0:${PORT}/`);
    console.log(`   - Admin: http://0.0.0.0:${PORT}/admin`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }
});

// Register slash command
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    // ✅ VERIFICAR QUE ESTAS VARIABLES EXISTAN
    if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
      console.error('❌ CLIENT_ID o GUILD_ID no definidos en variables de entorno');
      return;
    }

    console.log(`🔧 Registrando slash commands para ${process.env.GUILD_ID}...`);
    
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash command registrado!');
  } catch (error) {
    console.error('❌ Error registrando slash commands:', error);
  }
})();

// Evento cuando el bot está listo
client.once('ready', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    console.log(`🔧 Comandos disponibles: !contadores, !reset, !reload, !help`);
    await minigames.loadActiveRussianGames(client);
    await minigames.loadActiveUnoGames(client);
    await trades.loadActiveTrades(client);
    await auctions.loadActiveAuctions(client);
    await chatbot.initChatTables();
    console.log('🤖 Sistema de ChatBot inicializado');

    setInterval(() => {
        const used = process.memoryUsage();
        const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
        
        console.log(`🔍 Memoria: ${heapUsedMB}MB | Cache usuarios: ${userCooldowns.size}`);
        
        // Si la memoria está alta, limpiar más agresivamente
        if (heapUsedMB > 200) {
            console.warn('⚠️ Memoria alta - limpiando cache');
            userCooldowns.clear();
            
            // Forzar garbage collection si está disponible
            if (global.gc) {
                global.gc();
                console.log('🧹 Garbage collection ejecutado');
            }
        }
    }, 60000); // Cada minuto
    
    // Establecer el guild para eventos
    const guild = client.guilds.cache.get('1404905496644685834'); // ← Cambiar por tu ID real
    if (guild) {
        events.setGuild(guild); // Asumiendo que events es accesible aquí
    }
});

client.on('guildMemberRemove', async (member) => {
    try {
        const nickname = member.nickname || member.user.username;
        console.log(`👋 Miembro salió: ${member.user.tag} (Apodo: ${nickname})`);
        
        const pibeMatch = nickname.match(/^Pibe (\d+)$/);
        const pibaMatch = nickname.match(/^Piba (\d+)$/);
        
        if (pibeMatch) {
            // ✅ OBTENER CONTADOR ACTUAL
            const currentCount = await economy.database.getCounter('pibe_counter');
            const numero = parseInt(pibeMatch[1]);
            
            if (numero === currentCount) {
                // Era el último, decrementar
                const newCount = await economy.database.decrementCounter('pibe_counter');
                console.log(`🔵 Contador de pibes reducido a: ${newCount}`);
            }
        } else if (pibaMatch) {
            const currentCount = await economy.database.getCounter('piba_counter');
            const numero = parseInt(pibaMatch[1]);
            
            if (numero === currentCount) {
                const newCount = await economy.database.decrementCounter('piba_counter');
                console.log(`🔴 Contador de pibas reducido a: ${newCount}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error procesando salida de miembro:', error);
    }
});

client.on('guildMemberAdd', async (member) => {
    try {
        console.log(`🎉 Nuevo miembro: ${member.user.tag}`);
        
        // Crear el embed para el mensaje directo
        const embed = new EmbedBuilder()
            .setTitle('¡Bienvenido/a a Los Pibes del Átomo!')
            .setDescription('Por favor selecciona tu género para asignarte un apodo:')
            .setColor('#5865F2');
        
        // ✅ OBTENER CONTADORES DESDE LA BASE DE DATOS
        const pibeCount = await economy.database.getCounter('pibe_counter');
        const pibaCount = await economy.database.getCounter('piba_counter');
        
        embed.addFields(
            { name: '🔵 Pibe', value: `Siguiente número: **${pibeCount + 1}**`, inline: true },
            { name: '🔴 Piba', value: `Siguiente número: **${pibaCount + 1}**`, inline: true }
        );
        
        embed.setFooter({ text: 'Haz clic en uno de los botones para continuar' });

        // Crear los botones
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('select_pibe')
                    .setLabel('Pibe')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔵'),
                new ButtonBuilder()
                    .setCustomId('select_piba')
                    .setLabel('Piba')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔴')
            );

        // Enviar DM...
        try {
            console.log(`📩 Intentando DM con REST API para ${member.user.tag}`);
            
            const dmChannelResponse = await client.rest.post('/users/@me/channels', {
                body: { recipient_id: member.user.id }
            });
            
            await client.rest.post(`/channels/${dmChannelResponse.id}/messages`, {
                body: {
                    embeds: [embed.toJSON()],
                    components: [row.toJSON()]
                }
            });
            
            console.log(`✅ DM enviado exitosamente a ${member.user.tag}`);
            
        } catch (dmError) {
            console.log(`❌ DM falló: ${dmError.message}`);
            
            const guild = member.guild;
            const systemChannel = guild.systemChannel;
            
            if (systemChannel) {
                await systemChannel.send({
                    content: `${member.user}, no pude enviarte un mensaje directo. Selecciona tu categoría aquí:`,
                    embeds: [embed],
                    components: [row]
                });
            }
        }
    } catch (error) {
        console.error('❌ Error procesando nuevo miembro:', error);
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    console.log(`🔍 Reacción detectada de ${user.tag} en mensaje ${reaction.message.id}`);
    
    if (user.bot) {
        console.log('❌ Usuario es bot, ignorando');
        return;
    }
    
    try {
        // Asegurarse de que la reacción esté completamente cargada
        if (reaction.partial) {
            console.log('📦 Reacción parcial, cargando...');
            try {
                await reaction.fetch();
                console.log('✅ Reacción cargada completamente');
            } catch (error) {
                console.log('❌ No se pudo obtener la reacción completa:', error);
                return;
            }
        }

        // Verificar que el sistema de misiones esté disponible
        if (!economy || !economy.missions) {
            console.log('❌ Sistema de economy o missions no disponible');
            return;
        }

        console.log(`🎯 Actualizando progreso de misiones para ${user.id}`);

        // Actualizar progreso de misiones
        const completedMissions = await economy.missions.updateMissionProgress(
            user.id, 
            'reactions_given'
        );

        console.log(`📊 Misiones completadas: ${completedMissions.length}`);

        // Notificar misiones completadas si hay alguna
        if (completedMissions.length > 0) {
            console.log('🎉 Notificando misiones completadas');
            const fakeMessage = {
                author: user,
                user: user,
                channel: reaction.message.channel,
                guild: reaction.message.guild
            };
            
            await economy.missions.notifyCompletedMissions(fakeMessage, completedMissions);
        }
    } catch (error) {
        console.error('❌ Error en messageReactionAdd para misiones:', error);
    }
});

// Evento para manejar interacciones con botones
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    try {
        if (interaction.customId === 'select_pibe' || interaction.customId === 'select_piba') {
            let member;
            let guild;
            
            if (interaction.guild) {
                guild = interaction.guild;
                member = interaction.member;
            } else {
                const guilds = client.guilds.cache;
                
                for (const [guildId, guildObj] of guilds) {
                    try {
                        const foundMember = await guildObj.members.fetch(interaction.user.id);
                        if (foundMember) {
                            guild = guildObj;
                            member = foundMember;
                            break;
                        }
                    } catch (error) {
                        continue;
                    }
                }
                
                if (!member || !guild) {
                    await interaction.reply({
                        content: 'No pude encontrarte en ningún servidor.',
                        flags: 64
                    });
                    return;
                }
            }

            console.log(`✅ Miembro encontrado: ${member.user.tag} en ${guild.name}`);
            
            let newNickname;
            let selectedType;
            
            // ✅ INCREMENTAR CONTADOR EN LA BASE DE DATOS
            if (interaction.customId === 'select_pibe') {
                const newCount = await economy.database.incrementCounter('pibe_counter');
                newNickname = `Pibe ${newCount}`;
                selectedType = 'Pibe';
                console.log(`🔵 Nuevo pibe: ${newNickname}`);
            } else {
                const newCount = await economy.database.incrementCounter('piba_counter');
                newNickname = `Piba ${newCount}`;
                selectedType = 'Piba';
                console.log(`🔴 Nueva piba: ${newNickname}`);
            }
            
            try {
                await member.setNickname(newNickname);
                
                await interaction.reply({
                    content: `✅ ¡Perfecto! Te asigné el apodo: **${newNickname}**`,
                    flags: 64
                });
                
                console.log(`✅ Apodo asignado: ${member.user.tag} -> ${newNickname}`);
            } catch (nicknameError) {
                console.error(`❌ Error cambiando apodo:`, nicknameError);
                
                if (nicknameError.code === 50013) {
                    await interaction.reply({
                        content: `❌ No tengo permisos para cambiar apodos. Contacta a un admin.`,
                        flags: 64
                    });
                } else {
                    await interaction.reply({
                        content: `❌ Error asignando apodo. Inténtalo de nuevo.`,
                        flags: 64
                    });
                }
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('role_') || 
                interaction.customId.startsWith('nickname_') || 
                interaction.customId.startsWith('vip_')) {
                await shop.handleButtonInteraction(interaction);
            }
        }

        // AGREGAR ESTO: Manejo de botones del blackjack
        if (interaction.customId.startsWith('bj_')) {
            await minigames.handleBlackjackButtons(interaction);
            return; // Importante: return para no continuar con otros botones
        }

        if (interaction.customId.startsWith('shop_')) {
            await allCommands.handleShopInteraction(interaction);
            return;
        }

        if (interaction.customId.startsWith('trade_accept_')) {
            try {
                // Evitar spam
                await interaction.deferReply({ ephemeral: true });
                
                const tradeId = interaction.customId.replace('trade_accept_', '');
                
                // Obtener trade de la DB
                const tradeData = await trades.database.getTrade(tradeId);
                    
                if (!tradeData) {
                    await interaction.editReply({ content: '❌ Intercambio no encontrado o ya finalizado.' });
                    return;
                }
                
                // Verificar que el usuario es parte del trade
                if (interaction.user.id !== tradeData.initiator && interaction.user.id !== tradeData.target) {
                    await interaction.editReply({ content: '❌ No puedes participar en este intercambio.' });
                    return;
                }
                
                // Crear objeto mensaje falso para usar la función existente
                const fakeMessage = {
                    author: interaction.user,
                    channel: interaction.channel,
                    reply: async (content) => {
                        // No hacer nada, usaremos editReply después
                    }
                };
                
                // Usar la función de aceptar trade existente
                const result = await trades.acceptTradeButton(interaction.user.id, tradeData);
                
                if (result.success) {
                    await interaction.editReply({ content: result.message });
                    
                    if (result.completed) {
                        // Editar mensaje original para mostrar completado
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Intercambio Completado')
                            .setDescription('¡El intercambio se ha completado exitosamente!')
                            .setColor('#00FF00')
                            .setTimestamp();
                        
                        await interaction.message.edit({ 
                            embeds: [embed], 
                            components: [] 
                        });
                    }
                } else {
                    await interaction.editReply({ content: result.message });
                }
                
            } catch (error) {
                console.error('Error procesando aceptación:', error);
                await interaction.editReply({ content: '❌ Error procesando la aceptación.' });
            }
        }
        
        if (interaction.customId.startsWith('trade_cancel_')) {
            try {
                // Defer la respuesta inmediatamente para evitar spam
                await interaction.deferReply({ ephemeral: true });
                
                const tradeId = interaction.customId.replace('trade_cancel_', '');
                
                // Verificar que el trade existe y está activo
                const tradeData = await trades.database.getTrade(tradeId);
                    
                if (!tradeData) {
                    await interaction.editReply({ content: '❌ Intercambio no encontrado o ya finalizado.' });
                    return;
                }
                
                // Verificar que el usuario puede cancelar
                if (interaction.user.id !== tradeData.initiator && interaction.user.id !== tradeData.target) {
                    await interaction.editReply({ content: '❌ No puedes cancelar este intercambio.' });
                    return;
                }
                
                // Cancelar en la base de datos
                await trades.cancelTradeInDb(tradeId, 'button_cancel');
                                  
                // Responder exitosamente
                await interaction.editReply({ content: '✅ Intercambio cancelado exitosamente.' });
                
                // Editar el mensaje original para mostrar que fue cancelado
                try {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Intercambio Cancelado')
                        .setDescription(`Intercambio cancelado por ${interaction.user}`)
                        .setColor('#FF0000')
                        .setTimestamp();
                    
                    await interaction.message.edit({ 
                        embeds: [embed], 
                        components: [] // Quitar botones
                    });
                } catch (err) {
                    console.log('No se pudo editar el mensaje original');
                }
                
            } catch (error) {
                console.error('Error procesando cancelación:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Error procesando la cancelación.', ephemeral: true });
                } else {
                    await interaction.editReply({ content: '❌ Error procesando la cancelación.' });
                }
            }
        }

        try {
            if (interaction.customId === 'uno_show_hand') {
                const gameKey = `uno_${interaction.channelId}`;
                const game = minigames.activeGames.get(gameKey);
                
                if (!game) {
                    await interaction.reply({ content: '❌ No hay partida activa', ephemeral: true });
                    return;
                }
                
                const player = game.players.find(p => p.id === interaction.user.id);
                if (!player) {
                    await interaction.reply({ content: '❌ No estás en esta partida', ephemeral: true });
                    return;
                }

                const handString = player.hand.map((card, i) => 
                    `${i}: ${minigames.getCardString(card)}`).join('\n');
                    
                // Confirmar en canal (ephemeral real porque es interaction)
                await interaction.reply({
                    content: `🎴 **Tu mano:**\n\`\`\`${handString}\`\`\``, 
                    ephemeral: true 
                });
            }

            if (interaction.customId.startsWith('seven_swap_')) {
                const targetId = interaction.customId.replace('seven_swap_', '');
                await minigames.handleSevenSwapButton(interaction, targetId);
            }
            
            if (interaction.customId === 'uno_draw_card') {
                const gameKey = `uno_${interaction.channelId}`;
                const game = minigames.activeGames.get(gameKey);
                
                if (!game) {
                    await interaction.reply({ content: '❌ No hay partida activa', ephemeral: true });
                    return;
                }
                
                if (game.players[game.current_player_index].id !== interaction.user.id) {
                    await interaction.reply({ content: '❌ No es tu turno', ephemeral: true });
                    return;
                }
                
                await interaction.deferReply();
                
                // Crear un mensaje fake para usar la función existente
                const fakeMessage = {
                    author: interaction.user,
                    channel: interaction.channel,
                    client: interaction.client,
                    reply: async (content) => {
                        await interaction.editReply(content);
                    }
                };
                
                await minigames.drawCardForPlayer(game, interaction.user.id, fakeMessage);
            }
            
        } catch (error) {
            console.error('Error en interacción de botón:', error);
            await interaction.reply({ content: '❌ Error al procesar la acción', ephemeral: true });
        }        
    } catch (error) {
        console.error('❌ Error procesando selección:', error);
        
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Hubo un error al procesar tu acción. Por favor contacta a un administrador.',
                    flags: 64 // ephemeral
                });
            }
        } catch (replyError) {
            console.error('❌ Error enviando mensaje de error:', replyError);
        }
    }
});

const userLastProcessed = new Map();
const THROTTLE_TIME = 2000;

async function processUserActivityOptimized(userId, message) {
    // Throttling - evita procesamiento excesivo
    const now = Date.now();
    const lastTime = userLastProcessed.get(userId);
    
    if (lastTime && now - lastTime < THROTTLE_TIME) {
        return; // Skip - ahorra RAM y CPU
    }
    
    userLastProcessed.set(userId, now);
    
    // 2. Procesamiento en paralelo (no secuencial)
    const mentionsCount = message.mentions.users.size;
    
    try {
        // ✅ Ejecutar siempre las dos principales
        const [achievementsResult, messageResult] = await Promise.allSettled([
            achievements.checkAchievements(userId),
            missions.updateMissionProgress(userId, 'message', message.content)
        ]);
        
        // ✅ Ejecutar menciones por separado si es necesario
        let mentionResult = { status: 'fulfilled', value: [] };
        if (mentionsCount > 0) {
            mentionResult = await Promise.allSettled([
                missions.updateMissionProgress(userId, 'mention_made', mentionsCount)
            ]).then(results => results[0]);
        }
        
        // Procesar solo resultados exitosos
        const newAchievements = achievementsResult.status === 'fulfilled' ? achievementsResult.value : [];
        const allMissions = [
            ...(messageResult.status === 'fulfilled' ? messageResult.value : []),
            ...(mentionResult.status === 'fulfilled' ? mentionResult.value : [])
        ];
        
        // Notificaciones (sin await para no bloquear)
        if (newAchievements.length > 0) {
            achievements.notifyAchievements(message, newAchievements).catch(console.error);
        }
        
        if (allMissions.length > 0) {
            missions.notifyCompletedMissions(message, allMissions).catch(console.error);
        }
        
    } catch (error) {
        console.error('Error procesando actividad:', error);
    }
}

// Limpieza automática
setInterval(() => {
    const cutoff = Date.now() - THROTTLE_TIME * 2;
    for (const [userId, timestamp] of userLastProcessed.entries()) {
        if (timestamp < cutoff) {
            userLastProcessed.delete(userId);
        }
    }
}, 60000);

// Manejar mensajes (COMANDOS + XP + ECONOMÍA)
client.on('messageCreate', async (message) => {
    // Ignorar mensajes de bots
    if (message.author.bot) return;
    
    // AGREGAR ESTO AL INICIO:
    const userId = message.author.id;
    const now = Date.now();

    await processUserActivityOptimized(userId, message);

    messageCount++;
    checkMessageRate();

    // COMANDOS - SIN DELAYS ni restricciones
    if (message.content.startsWith('>')) {
        // Procesar comandos inmediatamente, sin cooldowns ni lotes
        try {
            await Promise.allSettled([
                achievements.processCommand(message),
                missions.processCommand(message), 
                allCommands.processCommand(message),
                shop.processCommand(message),
                minigames.processCommand(message),
                music.processCommand(message),
                commandHandler.processCommand(message),
                chatbot.processCommand(message)
            ]);
        } catch (error) {
            console.error('❌ Error comando:', error.message);
        }
        return; // Salir aquí para que no procese XP
    }
    
    // MODO EMERGENCIA - Solo comandos críticos
    if (CONFIG.EMERGENCY_MODE) {
        console.log('🚨 Modo emergencia - ignorando mensaje normal');
        
        // Solo procesar comandos administrativos
        if (message.content.startsWith('>emergency') && message.author.id === '488110147265232898') {
            if (message.content.includes('reset')) {
                CONFIG.EMERGENCY_MODE = false;
                aggressiveCleanup();
                await message.reply('✅ Modo emergencia desactivado');
            }
            if (message.content.includes('status')) {
                const used = process.memoryUsage();
                await message.reply(`📊 Memoria: ${Math.round(used.heapUsed / 1024 / 1024)}MB | Cola: ${messageBatch.length}`);
            }
        }
        return;
    }

    // CHATBOT - Solo cuando mencionen al bot
    if (message.mentions.has(message.client.user)) {
        // ✅ ENVIAR MENSAJE INMEDIATO Y PROCESAR EN SEGUNDO PLANO
        const processingMsg = await message.reply('⚙️ Pibot está pensando...');
        
        // 🚀 PROCESAR DE FORMA ASÍNCRONA (no bloquea el bot)
        (async () => {
            const emojis = ['⏳', '⌛', '🔄', '⚙️'];
            let emojiIndex = 0;
            
            const emojiInterval = setInterval(async () => {
                emojiIndex = (emojiIndex + 1) % emojis.length;
                processingMsg.edit(`${emojis[emojiIndex]} Pibot está pensando...`).catch(() => {});
            }, 1500);

            try {
                let botContext = null;
                let repliedToMessage = null;

                // Detectar si está respondiendo a un mensaje
                if (message.reference) {
                    try {
                        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);

                        // Si responde a un mensaje del bot
                        if (repliedMessage.author.id === message.client.user.id) {
                            const repliedContent = repliedMessage.content.toLowerCase();
                            const repliedEmbed = repliedMessage.embeds[0];

                            // Guardar contenido del mensaje
                            repliedToMessage = repliedMessage.content || repliedEmbed?.description || '';

                            // Detectar tipo de juego/comando
                            if (repliedContent.includes('coinflip') || repliedEmbed?.title?.toLowerCase().includes('coinflip')) {
                                botContext = 'El usuario acaba de jugar coinflip y está reaccionando al resultado';
                            } else if (repliedContent.includes('dice') || repliedEmbed?.title?.toLowerCase().includes('dados')) {
                                botContext = 'El usuario acaba de jugar dados y está reaccionando al resultado';
                            } else if (repliedContent.includes('roulette') || repliedEmbed?.title?.toLowerCase().includes('ruleta')) {
                                botContext = 'El usuario acaba de jugar ruleta y está reaccionando al resultado';
                            } else if (repliedContent.includes('blackjack') || repliedEmbed?.title?.toLowerCase().includes('blackjack')) {
                                botContext = 'El usuario acaba de jugar blackjack y está reaccionando al resultado';
                            } else if (repliedContent.includes('ganaste') || repliedContent.includes('perdiste')) {
                                botContext = 'El usuario está reaccionando al resultado de un juego (ganó o perdió)';
                            } else if (repliedContent.includes('balance') || repliedContent.includes('monedas')) {
                                botContext = 'El usuario está viendo su balance o dinero';
                            } else {
                                botContext = `El usuario está respondiendo a tu mensaje anterior`;
                            }
                        }
                    } catch (fetchError) {
                        console.log('No se pudo obtener mensaje referenciado');
                    }
                }

                // Procesar mensaje con contexto Y mensaje referenciado
                const result = await chatbot.processMessage(
                    message.author.id,
                    message.content,
                    message.member?.displayName || message.author.globalName || message.author.username,
                    botContext,
                    repliedToMessage
                );

                // Detener animación
                clearInterval(emojiInterval);
                
                // Borrar mensaje de "pensando" y enviar respuesta nueva
                await processingMsg.delete().catch(() => {});
                
                if (result.success) {
                    // Dividir mensajes largos si es necesario
                    if (result.response.length > 2000) {
                        const chunks = result.response.match(/[\s\S]{1,1900}/g) || [];
                        for (const chunk of chunks) {
                            await message.reply(chunk);
                        }
                    } else {
                        await message.reply(result.response);
                    }
                } else {
                    await message.reply(result.response);
                }
                
            } catch (error) {
                clearInterval(emojiInterval);
                console.error('❌ Error en chatbot:', error);
                await processingMsg.edit('❌ Ups, tuve un problema procesando tu mensaje.').catch(() => {});
            }
        })(); // ← Ejecutar inmediatamente pero sin esperar
        
        // ✅ El bot continúa ejecutándose sin bloquearse
    }
    
    // Verificar memoria antes de procesar
    const memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    
    if (memoryMB > CONFIG.MEMORY_LIMIT) {
        console.log(`🚨 Memoria crítica: ${memoryMB}MB - Activando modo emergencia`);
        CONFIG.EMERGENCY_MODE = true;
        aggressiveCleanup();
        return;
    }
    
    // Verificar cooldown ESTRICTO
    const lastProcessed = userCooldowns.get(userId);
    if (lastProcessed && (now - lastProcessed) < CONFIG.XP_COOLDOWN) {
        return; // Ignorar completamente
    }
    
    // Solo en servidores y con cooldown
    if (message.guild) {
        userCooldowns.set(userId, now);
        
        // Añadir a cola de procesamiento por lotes
        messageBatch.push({ message, userId, now });
        
        // Limitar tamaño de cola
        if (messageBatch.length > CONFIG.BATCH_SIZE * 3) {
            messageBatch.shift(); // Eliminar el más antiguo
        }
    }
});

// Manejo de errores
client.on('error', (error) => {
    console.error('❌ Error del cliente:', error);
});

// PROCESADOR DE LOTES AUTOMÁTICO
setInterval(() => {
    if (!CONFIG.EMERGENCY_MODE) {
        processBatch();
    }
}, CONFIG.PROCESSING_INTERVAL);

// MONITOR DE SISTEMA MÁS FRECUENTE
setInterval(() => {
    const used = process.memoryUsage();
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    
    console.log(`🔍 Memoria: ${heapUsedMB}MB | Cola: ${messageBatch.length} | Cache: ${userCooldowns.size} | Emergencia: ${CONFIG.EMERGENCY_MODE}`);
    
    // Limpieza preventiva
    if (heapUsedMB > CONFIG.MEMORY_LIMIT * 0.8) {
        console.log('⚠️ Limpieza preventiva');
        
        // Limpiar cache más agresivamente
        if (userCooldowns.size > CONFIG.MAX_CACHE_SIZE / 2) {
            const entries = Array.from(userCooldowns.entries());
            const recent = entries.slice(-CONFIG.MAX_CACHE_SIZE / 4);
            userCooldowns.clear();
            recent.forEach(([id, time]) => userCooldowns.set(id, time));
        }
        
        // Reducir cola
        if (messageBatch.length > CONFIG.BATCH_SIZE) {
            messageBatch.splice(0, messageBatch.length - CONFIG.BATCH_SIZE);
        }
    }
    
    if (heapUsedMB > CONFIG.MEMORY_LIMIT) {
        CONFIG.EMERGENCY_MODE = true;
        aggressiveCleanup();
    }
    
}, 30000); // Cada 30 segundos

process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Error crítico:', error.message);
    
    // Intentar limpiar antes de morir
    aggressiveCleanup();
    
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// COMANDO DE EMERGENCIA PARA ADMINS
process.on('SIGUSR1', () => {
    console.log('📊 Estado de emergencia:');
    console.log(`- Memoria: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.log(`- Cola: ${messageBatch.length}`);
    console.log(`- Cache: ${userCooldowns.size}`);
    console.log(`- Modo emergencia: ${CONFIG.EMERGENCY_MODE}`);
    aggressiveCleanup();
});

console.log('🚀 Bot iniciado con configuración anti-crash');
console.log(`📋 Configuración:
- XP Cooldown: ${CONFIG.XP_COOLDOWN/1000}s
- Max mensajes/s: ${CONFIG.MAX_MESSAGES_PER_SECOND}
- Límite memoria: ${CONFIG.MEMORY_LIMIT}MB
- Tamaño lote: ${CONFIG.BATCH_SIZE}
`);

// Proceso de cierre limpio
process.on('SIGINT', () => {
    console.log('\n🔄 Cerrando bot...');
    saveCounters(counters);

    if (economy.database) {
        economy.database.close();
    }
    
    client.destroy();
    process.exit(0);
});

// En bot.js, donde tienes client.login()
async function loginWithRetry(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await client.login(process.env.TOKEN);
            console.log('✅ Bot conectado exitosamente');
            return;
        } catch (error) {
            console.error(`❌ Intento ${i + 1} fallido:`, error.message);
            
            if (i < maxRetries - 1) {
                console.log(`⏳ Reintentando en 5 segundos...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    
    console.error('❌ No se pudo conectar después de varios intentos');
    process.exit(1);
}

// Usar esta función en lugar de client.login() directo
loginWithRetry();

/*// Iniciar el bot
client.login(process.env.TOKEN).then(() => {
    console.log('🚀 Proceso de login iniciado...');
}).catch(error => {
    console.error('❌ Error en el login:', error);
});*/














