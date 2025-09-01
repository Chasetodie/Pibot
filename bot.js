const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, Events, REST, Routes } = require('discord.js');
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
//require('./admin-panel')(app); // Pasar el servidor express existente
const {
    AuctionSystem,
    CraftingSystem
} = require('./things-shop');

// Archivo para guardar los contadores
const countersFile = path.join(__dirname, 'counters.json');

if (typeof File === 'undefined') {
  global.File = class File {
    constructor() {
      throw new Error('File is not supported in this environment.');
    }
  };
}

// Función para cargar contadores (con variables de entorno como respaldo)
function loadCounters() {
    try {
        if (fs.existsSync(countersFile)) {
            const data = fs.readFileSync(countersFile, 'utf8');
            const saved = JSON.parse(data);
            console.log(`📂 Contadores cargados desde archivo: Pibe ${saved.pibe}, Piba ${saved.piba}`);
            return saved;
        }
    } catch (error) {
        console.error('Error cargando contadores desde archivo:', error);
    }
    
    // Si no hay archivo, usar variables de entorno
    const fromEnv = {
        pibe: parseInt(process.env.PIBE_COUNT) || 0,
        piba: parseInt(process.env.PIBA_COUNT) || 0
    };
    
    console.log(`🌍 Usando contadores desde variables de entorno: Pibe ${fromEnv.pibe}, Piba ${fromEnv.piba}`);
    saveCounters(fromEnv); // Guardar en archivo para futuras ocasiones
    return fromEnv;
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
    ],
    makeCache: () => new Map(), // Caché más pequeño
});

// Función para guardar contadores
function saveCounters(counters) {
    try {
        fs.writeFileSync(countersFile, JSON.stringify(counters, null, 2));
        console.log(`💾 Contadores guardados: Pibe ${counters.pibe}, Piba ${counters.piba}`);
    } catch (error) {
        console.error('Error guardando contadores:', error);
    }
}

// Cargar contadores al iniciar
let counters = loadCounters();

// Crear instancia del manejador de comandos
const commandHandler = new CommandHandler(counters, saveCounters);

//Crear instancia del sistema de economia
const economy = new EconomySystem();

//Crear instancia del sistema de Misiones
const missions = new MissionsSystem(economy);

//Crear instancia del sistema de Achievements
const achievements = new AchievementsSystem(economy);

//Crear instancia del sistema de Tienda
const shop = new ShopSystem(economy);

//Crear instancia del sistema de Minijuegos
const minigames = new MinigamesSystem(economy, shop);

const database = new LocalDatabase();
database.startCacheCleanup();

//Crear instancia del sistema de Eventos
const events = new EventsSystem(economy, client);
missions.connectEventsSystem(events);
achievements.connectEventsSystem(events);
economy.connectEventsSystem(events);
minigames.connectEventsSystem(events);

setTimeout(async () => {
    await events.loadEvents();
    console.log('✅ Sistemas de eventos listo');
}, 2000);

setInterval(async () => {
    await economy.database.backup(); // Crear backup cada 6 horas
}, 6 * 60 * 60 * 1000);

const betting = new BettingSystem(economy);

const trades = new TradeSystem(shop);

const auctions = new AuctionSystem(shop);

const crafting = new CraftingSystem(shop);

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
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Slash command registered!');
  } catch (error) {
    console.error(error);
  }
})();

// Evento cuando el bot está listo
client.once('ready', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    console.log(`📊 Contadores actuales: Pibe ${counters.pibe}, Piba ${counters.piba}`);
    console.log(`🌍 Variables de entorno: PIBE_COUNT=${process.env.PIBE_COUNT || 'no definida'}, PIBA_COUNT=${process.env.PIBA_COUNT || 'no definida'}`);
    console.log(`🔧 Comandos disponibles: !contadores, !reset, !reload, !help`);
    await minigames.loadActiveRussianGames(client);
    await minigames.loadActiveUnoGames(client);
    await trades.loadActiveTrades(client);
    await auctions.loadActiveAuctions(client);

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

// Evento cuando un miembro abandona el servidor
client.on('guildMemberRemove', async (member) => {
    try {
        const nickname = member.nickname || member.user.username;
        console.log(`👋 Miembro salió: ${member.user.tag} (Apodo: ${nickname})`);
        
        // Verificar si el apodo era "Pibe X" o "Piba X"
        const pibeMatch = nickname.match(/^Pibe (\d+)$/);
        const pibaMatch = nickname.match(/^Piba (\d+)$/);
        
        if (pibeMatch) {
            // Era un pibe, restar del contador
            const numero = parseInt(pibeMatch[1]);
            if (numero === counters.pibe) {
                // Era el último pibe, reducir contador
                counters.pibe--;
                saveCounters(counters);
                console.log(`🔵 Contador de pibes reducido a: ${counters.pibe}`);
            }
        } else if (pibaMatch) {
            // Era una piba, restar del contador
            const numero = parseInt(pibaMatch[1]);
            if (numero === counters.piba) {
                // Era la última piba, reducir contador
                counters.piba--;
                saveCounters(counters);
                console.log(`🔴 Contador de pibas reducido a: ${counters.piba}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error procesando salida de miembro:', error);
    }
});

// Evento cuando un nuevo miembro se une al servidor
client.on('guildMemberAdd', async (member) => {
    try {
        console.log(`🎉 Nuevo miembro: ${member.user.tag}`);
        
        // Crear el embed para el mensaje directo
        const embed = new EmbedBuilder()
            .setTitle('¡Bienvenido/a a Adictos a las píldoras!')
            .setDescription('Por favor selecciona tu género para asignarte un apodo:')
            .setColor('#5865F2')
            .addFields(
                { name: '🔵 Pibe', value: `Siguiente número: **${counters.pibe + 1}**`, inline: true },
                { name: '🔴 Piba', value: `Siguiente número: **${counters.piba + 1}**`, inline: true }
            )
            .setFooter({ text: 'Haz clic en uno de los botones para continuar' });

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

        // En lugar de todo el bloque de dmSent = false y los try-catch
        try {
            console.log(`📩 Intentando DM con REST API para ${member.user.tag}`);
            
            // Usar REST API directamente
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
            console.log(`❌ DM falló con REST: ${dmError.message}`);
            
            // Fallback al canal del servidor
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
        console.error('❌ Error general procesando nuevo miembro:', error);
    }
});

// Evento para manejar interacciones con botones
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    try {
        if (interaction.customId === 'select_pibe' || interaction.customId === 'select_piba') {
            // Si la interacción viene de un DM, necesitamos encontrar el guild y member
            let member;
            let guild;
            
            if (interaction.guild) {
                // La interacción viene del servidor
                guild = interaction.guild;
                member = interaction.member;
            } else {
                // La interacción viene de un DM, necesitamos encontrar el servidor
                // Buscar en todos los servidores donde está el bot
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
                        // El usuario no está en este servidor, continuar
                        continue;
                    }
                }
                
                if (!member || !guild) {
                    await interaction.reply({
                        content: 'No pude encontrarte en ningún servidor. Asegúrate de estar en el servidor antes de usar los botones.',
                        flags: 64 // ephemeral
                    });
                    return;
                }
            }

            console.log(`✅ Miembro encontrado: ${member.user.tag} en ${guild.name}`);
            
            // Procesar la selección
            let newNickname;
            let selectedType;
            
            if (interaction.customId === 'select_pibe') {
                counters.pibe++;
                newNickname = `Pibe ${counters.pibe}`;
                selectedType = 'Pibe';
                console.log(`🔵 Nuevo pibe: ${newNickname}`);
            } else {
                counters.piba++;
                newNickname = `Piba ${counters.piba}`;
                selectedType = 'Piba';
                console.log(`🔴 Nueva piba: ${newNickname}`);
            }
            
            try {
                // Cambiar el apodo
                await member.setNickname(newNickname);
                
                // Guardar contadores
                saveCounters(counters);
                
                // Responder al usuario
                await interaction.reply({
                    content: `✅ ¡Perfecto! Te asigné el apodo: **${newNickname}**`,
                    flags: 64 // ephemeral
                });
                
                console.log(`✅ Apodo asignado: ${member.user.tag} -> ${newNickname}`);
            } catch (nicknameError) {
                console.error(`❌ Error cambiando apodo:`, nicknameError);
                
                // Verificar si es problema de permisos
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
            missions.updateMissionProgress(userId, 'message')
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

/*// Limpiar efectos expirados cada 5 minutos
setInterval(async () => {
    if (shop && shop.cleanupExpiredEffects) {
        await shop.cleanupExpiredEffects();
    }
}, 5 * 60 * 1000);

// Sistema de ingresos pasivos (cada hora)
setInterval(async () => {
    if (shop) {
        await shop.processPassiveIncome();
    }
}, 60 * 60 * 1000); // Cada hora*/

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
                commandHandler.processCommand(message)
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

async function handleLevelUp(message, xpResult, channel) {
    try {
        const levelUpEmbed = new EmbedBuilder()
            .setTitle('🎉 ¡Nuevo Nivel!')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setDescription(`${message.author} alcanzó el **Nivel ${xpResult.newLevel}**`)
            .addFields(
                { name: '📈 XP Ganada', value: `+${xpResult.xpGained} XP`, inline: true },
                { name: '🎁 Recompensa', value: `+${xpResult.reward} π-b$`, inline: true },
                { name: '🏆 Niveles Subidos', value: `${xpResult.levelsGained}`, inline: true },
                { name: '🎉 Extra por Eventos', value: `${xpResult.eventMessage || "No hay eventos Activos"}`, inline: false }
            )
            .setColor('#FFD700')
            .setTimestamp();
            
        await channel.send({
            content: `<@${message.author.id}>`,
            embeds: [levelUpEmbed],
            allowedMentions: { users: [message.author.id] }
        });
    } catch (error) {
        console.error('❌ Error enviando notificación de nivel:', error);
    }
}

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












