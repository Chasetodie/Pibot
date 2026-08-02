const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, Events, REST, Routes, Collection, ActivityType } = require('discord.js');
const { Options } = require('discord.js'); // agregar al inicio del archivo si no está
const { iniciarApiServer } = require('./apiServer.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
if (process.env.TESTING === 'true') {
    require('dotenv').config({ path: '.env.testing' });
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('TOKEN:', process.env.TOKEN ? 'cargado' : 'vacío');
}
//nomas
const PORT = process.env.PORT || 3000;
const EconomySystem = require('./src/systems/economy.js'); // Importar el sistema de economia
const EventsSystem = require('./src/systems/events.js');
const TradeSystem = require('./src/systems/trade.js');
const MinigamesSystem = require('./src/systems/minigames.js'); // Importar el sistema de minijuegos
const AchievementsSystem = require('./src/systems/achievements.js');
const BettingSystem = require('./src/systems/betting.js');
const MissionsSystem = require('./src/systems/missions.js');
const ShopSystem = require('./src/systems/shop.js');
const AllCommands = require('./src/commands/all-commands.js');
const LocalDatabase = require('./src/database/database.js');
const MusicSystem = require('./src/systems/musicSystem.js');
const ChatBotSystem = require('./src/systems/chatBot.js');
const GuildConfig = require('./src/systems/guild-config.js');
const ImageGenSystem = require('./src/systems/imageGen.js');
const GuildLevels = require('./src/systems/guild-levels.js');
const MaintenanceSystem = require('./src/systems/maintenance.js')
//const ThingsShop = require('./things-shop');
//require('./admin-panel')(app); // Pasar el servidor express existente
const {
    AuctionSystem,
    CraftingSystem
} = require('./src/systems/things-shop.js');
const NSFWSystem = require('./src/systems/nsfw.js');

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
    makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        MessageManager: 50,      // Pocos mensajes en caché
        UserManager: 200,        // Algunos usuarios
        GuildMemberManager: 200, // Algunos miembros
        // Roles y channels SÍ se cachean (necesario para permisos)
    }),
});

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
client.musicSystem = music;

const imageGen = new ImageGenSystem();

const nsfw = new NSFWSystem();

const database = new LocalDatabase();
database.startCacheCleanup();

const maintenance = new MaintenanceSystem(database);

const chatbot = new ChatBotSystem(database, economy);

const guildConfig = new GuildConfig(database);

const guildLevels = new GuildLevels(database, guildConfig);

//const thingsShop = new ThingsShop();

//Crear instancia del sistema de Eventos
const events = new EventsSystem(economy, client, guildConfig);
shop.connectEventsSystem(events);
missions.connectEventsSystem(events);
achievements.connectEventsSystem(events);
economy.connectEventsSystem(events);
minigames.connectEventsSystem(events);

setTimeout(async () => {
    await events.loadEvents();
    console.log('✅ Sistemas de eventos listo');
}, 2000);

// Keepalive para Lavalink
setInterval(async () => {
    try {
        const response = await fetch('http://http://160.191.77.60:7555/version', {
            headers: { 'Authorization': 'ichangethepasscauseimdumb' }
        });
        if (response.ok) {
            console.log('✅ Lavalink keepalive OK');
        } else {
            console.log('⚠️ Lavalink keepalive falló:', response.status);
        }
    } catch (err) {
        console.log('⚠️ Lavalink keepalive error:', err.message);
    }
}, 4 * 60 * 1000); // cada 4 minutos

setInterval(async () => {
    await economy.database.cleanExpiredTreasureMaps();
    
    // Obtener contratos expirados antes de limpiarlos
    const [expiredContracts] = await economy.database.pool.execute(
        'SELECT * FROM contracts WHERE expires_at <= ? AND active = 1',
        [Date.now()]
    );

    // Notificar a cada contratante
    for (const contract of expiredContracts) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#888888')
                .setTitle('🗡️ Contrato Expirado')
                .setDescription(`Tu contrato de sicario expiró sin activarse.\n💸 El dinero pagado no se recupera.`)
                .addFields(
                    { name: '💰 Pagado', value: `${contract.amount.toLocaleString()} π-b$`, inline: true },
                )
                .setTimestamp();

            let notified = false;
            if (contract.channel_id) {
                const channel = await client.channels.fetch(contract.channel_id).catch(() => null);
                if (channel) {
                    await channel.send({ content: `<@${contract.hired_by}>`, embeds: [embed] });
                    notified = true;
                }
            }
            if (!notified) {
                const hirer = await client.users.fetch(contract.hired_by).catch(() => null);
                if (hirer) await hirer.send({ embeds: [embed] }).catch(() => {});
            }
        } catch {}
    }

    await economy.database.cleanExpiredContracts();
}, 60 * 60 * 1000);

// Checker diario: herencia + aniversarios
setInterval(async () => {
    try {
        await economy.checkInactiveSpouses();
        await economy.checkAnniversaries();
    } catch (e) { console.error('❌ Error checker matrimonios:', e.message); }
}, 24 * 60 * 60 * 1000);

// Checker de plagas en huerto — cada hora
setInterval(async () => {
    try {
        const activeGardens = await economy.database.getActiveGardens();
        for (const garden of activeGardens) {
            const plagued = await economy.checkGardenPlagued(garden.user_id);
            if (plagued.length > 0) {
                const user = await client.users.fetch(garden.user_id).catch(() => null);
                if (user) {
                    user.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff6600')
                            .setTitle('⚠️ ¡Plaga en tu huerto!')
                            .setDescription(`Los slots **${plagued.join(', ')}** de tu huerto fueron plagados.\nUsa \`>huerto fumigar <slot>\` para curarlos (cuesta 500 π-b$).`)
                            .setTimestamp()]
                    }).catch(() => {});
                }
            }
        }
    } catch (e) { console.error('❌ Error checker plagas:', e.message); }
}, 60 * 60 * 1000);

// Checker de enfermedades de mascotas — cada 12h
setInterval(async () => {
    try {
        const allPets = await economy.database.getAllPetsForPlague();
        const usersSickened = new Map();

        for (const pet of allPets) {
            if (!pet.sick && Math.random() < 0.03) {
                await economy.database.updatePet(pet.id, { sick: 1, sick_since: Date.now() });
                if (!usersSickened.has(pet.user_id)) usersSickened.set(pet.user_id, []);
                usersSickened.get(pet.user_id).push(pet.name);
            }
        }

        for (const [userId, names] of usersSickened) {
            const user = await client.users.fetch(userId).catch(() => null);
            if (user) {
                user.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff4444')
                        .setTitle('🤒 ¡Tu mascota está enferma!')
                        .setDescription(`**${names.join(', ')}** se enfermaron.\nUsa \`>mascota curar <id> <medicina>\` antes de que pierda niveles.`)
                        .setTimestamp()]
                }).catch(() => {});
            }
        }

        // Consecuencias de enfermedad prolongada
        const sickPets = await economy.database.getSickPets();
        for (const pet of sickPets) {
            if (!pet.sick_since) continue;
            const sickHours = (Date.now() - pet.sick_since) / 3600000;

            if (sickHours >= 72) {
                await economy.database.deletePet(pet.id);
                const user = await client.users.fetch(pet.user_id).catch(() => null);
                if (user) user.send(`💀 Tu mascota **${pet.name}** murió por no recibir atención médica a tiempo.`).catch(() => {});
            } else if (sickHours >= 48 && pet.form > 1) {
                await economy.database.updatePet(pet.id, { form: pet.form - 1 });
            } else if (sickHours >= 24 && pet.level > 1) {
                await economy.database.updatePet(pet.id, { level: pet.level - 1 });
            }
        }
    } catch (e) { console.error('❌ Error checker mascotas:', e.message); }
}, 12 * 60 * 60 * 1000);

/*setInterval(async () => {
    await economy.database.backup(); // Crear backup cada 6 horas
}, 6 * 60 * 60 * 1000);*/

const betting = new BettingSystem(economy);

const trades = new TradeSystem(shop);

const auctions = new AuctionSystem(shop);

const crafting = new CraftingSystem(shop, client);

// Instancia del sistema de comandos mejorados
const allCommands = new AllCommands(economy, shop, trades, auctions, crafting, events, betting, achievements, guildLevels, guildConfig, maintenance);
//allCommands.maintenance = maintenance;

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
        const [xpResult, guildXpResult] = await Promise.allSettled([
            Promise.race([
                economy.processMessageXp(userId, message.guild?.id),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
            ]),
            guildLevels.processMessage(userId, message.guild?.id)
        ]);

        // Level up global
        if (xpResult.status === 'fulfilled' && xpResult.value?.levelUp) {
            const channelId = await guildConfig.get(message.guild.id, 'levelup_channel');
            const channel = channelId ? message.guild.channels.cache.get(channelId) : null;
            if (channel) await sendLevelUpSafe(message, xpResult.value, channel);

            // Hito de mentoría
            if (xpResult.value?.mentorMilestone) {
                const { mentorMilestone } = xpResult.value;
                const milestoneChannel = channel || message.channel;

                // Anuncio en canal
                milestoneChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle(`🎓 ${mentorMilestone.milestone.label}`)
                        .setDescription(`<@${userId}> alcanzó **Nivel ${xpResult.value.newLevel}** y superó un hito de mentoría!\n💰 **+${mentorMilestone.reward.toLocaleString()} π-b$** para el aprendiz y el mentor.`)
                        .setColor('#5865F2')
                        .setTimestamp()]
                }).catch(() => {});
            }
        }

        // Level up del servidor
        if (guildXpResult.status === 'fulfilled' && guildXpResult.value?.levelUp) {
            const channelId = await guildConfig.get(message.guild.id, 'guild_levelup_channel');
            const channel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;
            if (channel) {
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setTitle('⬆️ ¡Subiste de nivel en el servidor!')
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setDescription(`${message.author} alcanzó el **Nivel ${guildXpResult.value.newLevel}** en **${message.guild.name}**`)
                    .setColor('#5865F2')
                    .setTimestamp();
                channel.send({ embeds: [embed] }).catch(() => {});
            }
        }

        // XP aleatoria para mascotas por mensaje
        if (xpResult.status === 'fulfilled') {
            economy.addPetXP(userId).then(evolutions => {
                if (!evolutions?.length) return;
                for (const evo of evolutions) {
                    message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('✨ ¡Tu mascota evolucionó!')
                            .setDescription(`<@${userId}> ¡**${evo.name}** pasó de Forma ${evo.oldForm} a **Forma ${evo.newForm}**!`)
                            .setColor('#FFD700')]
                    }).catch(() => {});
                }
            }).catch(() => {});
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
                { name: '🎁 Recompensa Base', value: `+${xpResult.baseReward || xpResult.reward} π-b$`, inline: true },
                { name: '🏆 Niveles Subidos', value: `${xpResult.levelsGained}`, inline: true }
            )
            .setColor('#FFD700')
            .setTimestamp();
        
        // ✅ AGREGAR - Mostrar bonus por nivel si existe
        if (xpResult.levelBonus && xpResult.levelBonus > 0) {
            levelUpEmbed.addFields({
                name: '⭐ Bonus por Nivel',
                value: `+${xpResult.levelBonus} π-b$ (Nivel ${xpResult.newLevel} × 50)`,
                inline: false
            });
        }
        
        // ✅ AGREGAR - Total final
        levelUpEmbed.addFields({
            name: '💰 Total Ganado',
            value: `**${xpResult.reward} π-b$**`,
            inline: false
        });
        
        // Si hay mensaje de evento
        if (xpResult.eventMessage) {
            levelUpEmbed.addFields({
                name: '🎉 Extra por Eventos',
                value: xpResult.eventMessage,
                inline: false
            });
        }
        
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

const commands = [

    // ── ECONOMÍA ─────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Ver tu balance de monedas')
        .addUserOption(o => o.setName('usuario').setDescription('Usuario a consultar').setRequired(false)),

    new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Reclamar tu recompensa diaria'),

    new SlashCommandBuilder()
        .setName('work')
        .setDescription('Trabajar para ganar monedas')
        .addStringOption(o => o.setName('trabajo').setDescription('Nombre del trabajo (vacío = ver lista)').setRequired(false)),

    new SlashCommandBuilder()
        .setName('robar')
        .setDescription('Intentar robarle a alguien')
        .addUserOption(o => o.setName('usuario').setDescription('Usuario al que robarle').setRequired(true)),

    new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Transferir dinero a otro usuario')
        .addUserOption(o => o.setName('usuario').setDescription('A quién enviarle').setRequired(true))
        .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(true).setMinValue(10)),

    new SlashCommandBuilder()
        .setName('top')
        .setDescription('Ver el ranking del servidor o global')
        .addStringOption(o => o.setName('tipo').setDescription('Qué ranking ver').setRequired(false)
            .addChoices(
                { name: '💰 Dinero', value: 'money' },
                { name: '📊 Nivel', value: 'level' }
            ))
        .addStringOption(o => o.setName('alcance').setDescription('Servidor o global').setRequired(false)
            .addChoices(
                { name: '🏠 Servidor', value: 'server' },
                { name: '🌍 Global', value: 'global' }
            )),

    new SlashCommandBuilder()
        .setName('level')
        .setDescription('Ver tu nivel y XP')
        .addUserOption(o => o.setName('usuario').setDescription('Usuario a consultar').setRequired(false)),

    new SlashCommandBuilder()
        .setName('pacto')
        .setDescription('Pacto del Diablo — gana dinero a cambio de XP'),

    new SlashCommandBuilder()
        .setName('pedir')
        .setDescription('Pedir dinero a otros usuarios (mendicidad)'),

    new SlashCommandBuilder()
        .setName('rachas')
        .setDescription('Ver tu racha de presencia diaria'),

    new SlashCommandBuilder()
        .setName('mapa')
        .setDescription('Ver tu mapa del tesoro activo'),

    new SlashCommandBuilder()
        .setName('excavar')
        .setDescription('Responder la pista del mapa del tesoro')
        .addChannelOption(o => o.setName('canal').setDescription('Canal que crees que es la respuesta').setRequired(false))
        .addUserOption(o => o.setName('usuario').setDescription('Usuario que crees que es la respuesta').setRequired(false)),

    new SlashCommandBuilder()
        .setName('sicario')
        .setDescription('Contratar un sicario contra alguien')
        .addUserOption(o => o.setName('usuario').setDescription('Objetivo').setRequired(true))
        .addIntegerOption(o => o.setName('cantidad').setDescription('Pago').setRequired(true).setMinValue(1)),

    new SlashCommandBuilder()
        .setName('biblioteca')
        .setDescription('Comprar libros para mejoras permanentes')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(false)
            .addChoices(
                { name: '📚 Ver catálogo', value: 'catalogo' },
                { name: '🛒 Comprar libro', value: 'comprar' },
                { name: '📖 Ver estado', value: 'estado' }
            ))
        .addStringOption(o => o.setName('libro_id').setDescription('ID del libro (solo para comprar)').setRequired(false)),

    new SlashCommandBuilder()
        .setName('profesion')
        .setDescription('Ver o elegir tu clase/profesión')
        .addStringOption(o => o.setName('clase').setDescription('ID de la clase (vacío = ver lista)').setRequired(false)),

    new SlashCommandBuilder()
        .setName('huerto')
        .setDescription('Gestionar tu huerto')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(false)
            .addChoices(
                { name: '🌿 Ver huerto', value: 'ver' },
                { name: '🌱 Plantar', value: 'plantar' },
                { name: '🌾 Cosechar', value: 'cosechar' },
                { name: '💧 Regar', value: 'regar' },
                { name: '🧪 Fumigar', value: 'fumigar' }
            ))
        .addStringOption(o => o.setName('slot').setDescription('Número de slot').setRequired(false))
        .addStringOption(o => o.setName('planta').setDescription('ID de planta (para plantar)').setRequired(false)),

    new SlashCommandBuilder()
        .setName('mascota')
        .setDescription('Gestionar tus mascotas')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(false)
            .addChoices(
                { name: '🐾 Ver mascotas', value: 'ver' },
                { name: '🥚 Incubar huevo', value: 'incubar' },
                { name: '⚔️ Equipar', value: 'equipar' },
                { name: '🔓 Desequipar', value: 'desequipar' },
                { name: '🆓 Liberar', value: 'liberar' },
                { name: '✏️ Renombrar', value: 'renombrar' },
                { name: '💊 Curar', value: 'curar' },
                { name: '🗺️ Expedición', value: 'expedicion' },
                { name: '🎁 Reclamar', value: 'reclamar' },
                { name: '❓ Ayuda', value: 'help' }
            ))
        .addStringOption(o => o.setName('id').setDescription('ID de la mascota').setRequired(false))
        .addStringOption(o => o.setName('extra').setDescription('Nombre, medicina, tipo de expedición, etc.').setRequired(false)),

    new SlashCommandBuilder()
        .setName('curar')
        .setDescription('Curar a alguien con un item médico')
        .addUserOption(o => o.setName('usuario').setDescription('Usuario a curar').setRequired(true))
        .addStringOption(o => o.setName('medicina').setDescription('ID del item de medicina').setRequired(true)),

    new SlashCommandBuilder()
        .setName('casar')
        .setDescription('Proponer matrimonio a alguien')
        .addUserOption(o => o.setName('usuario').setDescription('A quién proponerle').setRequired(true)),

    new SlashCommandBuilder()
        .setName('divorcio')
        .setDescription('Divorciarte de tu pareja'),

    new SlashCommandBuilder()
        .setName('pareja')
        .setDescription('Ver info de tu matrimonio actual'),

    new SlashCommandBuilder()
        .setName('mentor')
        .setDescription('Sistema de mentoría')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(false)
            .addChoices(
                { name: '🎓 Ver mentor', value: 'ver' },
                { name: '👤 Aceptar aprendiz', value: 'aceptar' },
                { name: '❌ Abandonar', value: 'abandonar' }
            ))
        .addUserOption(o => o.setName('usuario').setDescription('Usuario (para asignar mentor)').setRequired(false)),

    // ── TIENDA ────────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Ver la tienda')
        .addStringOption(o => o.setName('categoria').setDescription('Categoría a ver').setRequired(false)
            .addChoices(
                { name: '🧪 Consumibles', value: 'consumable' },
                { name: '💎 Permanentes', value: 'permanent' },
                { name: '✨ Cosméticos', value: 'cosmetic' },
                { name: '🎁 Especiales', value: 'special'},
                { name: '⚔️ Equipamiento', value: 'equipment' },
                { name: '🗝️ Cofres', value: 'mystery' },
                { name: '🌱 Semillas', value: 'seed' },
                { name: '🐕 Mascotas', value: 'pet' },
                { name: '🧠 Trivia', value: 'trivia' }
            )),

    new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Comprar un item de la tienda')
        .addStringOption(o => o.setName('item').setDescription('ID del item').setRequired(true))
        .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad (default: 1)').setRequired(false).setMinValue(1)),

    new SlashCommandBuilder()
        .setName('bag')
        .setDescription('Ver tu inventario')
        .addUserOption(o => o.setName('usuario').setDescription('Ver inventario de otro usuario').setRequired(false)),

    new SlashCommandBuilder()
        .setName('useitem')
        .setDescription('Usar un item de tu inventario')
        .addStringOption(o => o.setName('item').setDescription('ID del item').setRequired(true)),

    new SlashCommandBuilder()
        .setName('lanzar')
        .setDescription('Lanzar una maldición a alguien')
        .addUserOption(o => o.setName('usuario').setDescription('Objetivo').setRequired(true)),

    new SlashCommandBuilder()
        .setName('efectos')
        .setDescription('Ver tus efectos activos'),

    new SlashCommandBuilder()
        .setName('quitarefecto')
        .setDescription('Quitar un efecto permanente')
        .addStringOption(o => o.setName('item').setDescription('ID del item').setRequired(true)),

    new SlashCommandBuilder()
        .setName('autoworker')
        .setDescription('Ver el estado de tu auto-worker'),

    new SlashCommandBuilder()
        .setName('cosmeticos')
        .setDescription('Ver tus cosméticos activos'),

    new SlashCommandBuilder()
        .setName('setnickname')
        .setDescription('Cambiar tu apodo cosmético')
        .addStringOption(o => o.setName('apodo').setDescription('Tu nuevo apodo').setRequired(true).setMaxLength(20)),

    new SlashCommandBuilder()
        .setName('rolcreate')
        .setDescription('Crear tu rol personalizado')
        .addStringOption(o => o.setName('color').setDescription('Color hex, ej: #FF0000 (vacío = ver menú)').setRequired(false))
        .addStringOption(o => o.setName('nombre').setDescription('Nombre del rol').setRequired(false)),

    new SlashCommandBuilder()
        .setName('vip')
        .setDescription('Ver info y beneficios VIP'),

    new SlashCommandBuilder()
        .setName('vipwork')
        .setDescription('Activar bonus VIP de trabajo'),

    new SlashCommandBuilder()
        .setName('viphelp')
        .setDescription('Ver todos los comandos VIP'),

    // ── MINIJUEGOS ────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Lanzamiento de moneda')
        .addStringOption(o => o.setName('lado').setDescription('Cara o cruz').setRequired(true)
            .addChoices(
                { name: '👑 Cara', value: 'cara' },
                { name: '⚡ Cruz', value: 'cruz' }
            ))
        .addIntegerOption(o => o.setName('apuesta').setDescription('Cantidad a apostar').setRequired(true).setMinValue(1)),

    new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Jugar a los dados')
        .addIntegerOption(o => o.setName('apuesta').setDescription('Cantidad a apostar').setRequired(true).setMinValue(1))
        .addIntegerOption(o => o.setName('numero').setDescription('Número a predecir (1-6)').setRequired(false).setMinValue(1).setMaxValue(6)),

    new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Jugar al blackjack')
        .addIntegerOption(o => o.setName('apuesta').setDescription('Cantidad a apostar').setRequired(true).setMinValue(1)),

    new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Jugar a la ruleta')
        .addIntegerOption(o => o.setName('apuesta').setDescription('Cantidad a apostar').setRequired(true).setMinValue(1))
        .addStringOption(o => o.setName('opcion').setDescription('En qué apostar (ej: rojo, 7)').setRequired(false)),

    new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Jugar al tragaperras')
        .addIntegerOption(o => o.setName('apuesta').setDescription('Cantidad a apostar').setRequired(true).setMinValue(1)),

    new SlashCommandBuilder()
        .setName('lottery')
        .setDescription('Comprar tickets de lotería')
        .addIntegerOption(o => o.setName('tickets').setDescription('Cantidad (default: 1)').setRequired(false).setMinValue(1)),

    new SlashCommandBuilder()
        .setName('horserace')
        .setDescription('Carrera de caballos')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(false)
            .addChoices(
                { name: '🐴 Crear carrera', value: 'crear' },
                { name: '🏇 Unirse', value: 'join' },
                { name: '🏁 Iniciar', value: 'start' },
                { name: '❌ Cancelar', value: 'cancel' }
            ))
        .addIntegerOption(o => o.setName('apuesta').setDescription('Cantidad a apostar').setRequired(false).setMinValue(1)),

    new SlashCommandBuilder()
        .setName('vending')
        .setDescription('Usar la máquina expendedora'),

    // /russian agrupa: russian, shoot, startrussian, cancelrussian
    new SlashCommandBuilder()
        .setName('russian')
        .setDescription('Ruleta rusa')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(false)
            .addChoices(
                { name: '🔫 Desafiar a alguien', value: 'desafiar' },
                { name: '💥 Disparar', value: 'shoot' },
                { name: '▶️ Iniciar partida', value: 'start' },
                { name: '❌ Cancelar partida', value: 'cancel' }
            ))
        .addUserOption(o => o.setName('usuario').setDescription('Usuario a desafiar').setRequired(false))
        .addIntegerOption(o => o.setName('apuesta').setDescription('Cantidad a apostar').setRequired(false).setMinValue(1)),

    new SlashCommandBuilder()
        .setName('limits')
        .setDescription('Ver tus límites de juegos diarios'),

    new SlashCommandBuilder()
        .setName('games')
        .setDescription('Ver lista de todos los minijuegos'),

    // /uno agrupa: ujoin, ustart, ucancel, uplay, upickup, ushowhand, utable, sayuno, ucallout
    new SlashCommandBuilder()
        .setName('uno')
        .setDescription('Jugar al UNO')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(true)
            .addChoices(
                { name: '🃏 Unirse', value: 'join' },
                { name: '▶️ Iniciar', value: 'start' },
                { name: '❌ Cancelar', value: 'cancel' },
                { name: '🎴 Jugar carta', value: 'play' },
                { name: '🤚 Robar carta', value: 'pickup' },
                { name: '👀 Ver mi mano', value: 'hand' },
                { name: '🏓 Ver mesa', value: 'table' },
                { name: '📢 Decir UNO', value: 'sayuno' },
                { name: '🚨 Acusar a alguien', value: 'callout' }
            ))
        .addIntegerOption(o => o.setName('apuesta').setDescription('Cantidad a apostar - Solo al Unirse').setRequired(false).setMinValue(150))
        .addIntegerOption(o => o.setName('carta').setDescription('Índice de carta a jugar (solo para "jugar carta")').setRequired(false).setMinValue(0))
        .addStringOption(o => o.setName('color').setDescription('Color para comodín').setRequired(false)
            .addChoices(
                { name: '🔴 Rojo', value: 'red' },
                { name: '🔵 Azul', value: 'blue' },
                { name: '🟢 Verde', value: 'green' },
                { name: '🟡 Amarillo', value: 'yellow' }
            ))
        .addUserOption(o => o.setName('usuario').setDescription('Usuario a acusar (solo para "acusar")').setRequired(false)),

    // /trivia agrupa: trivia, triviasurvival, triviamulti, jointrivia, starttrivia, canceltrivia, trivialb, triviacat
    new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Jugar trivia')
        .addStringOption(o => o.setName('modo').setDescription('Modo de juego').setRequired(false)
            .addChoices(
                { name: '🧠 Normal', value: 'normal' },
                { name: '💀 Supervivencia', value: 'survival' },
                { name: '👥 Multijugador', value: 'multi' },
                { name: '🚪 Unirse a multi', value: 'join' },
                { name: '▶️ Iniciar multi', value: 'start' },
                { name: '❌ Cancelar multi', value: 'cancel' },
                { name: '🏆 Ranking', value: 'lb' },
                { name: '📋 Categorías', value: 'cat' }
            ))
        .addStringOption(o => o.setName('dificultad').setDescription('Dificultad (para modo normal)').setRequired(false)
            .addChoices(
                { name: '🟢 Fácil', value: 'easy' },
                { name: '🟡 Medio', value: 'medium' },
                { name: '🔴 Difícil', value: 'hard' }
            ))
        .addStringOption(o => o.setName('categoria').setDescription('Categoría (ej: anime, historia)').setRequired(false))
        .addIntegerOption(o => o.setName('rondas').setDescription('Rondas para modo multi').setRequired(false).setMinValue(1).setMaxValue(20)),

    // /apuesta agrupa: bet, acceptbet, declinebet, mybets, betstats, resolvebet, cancelbet
    new SlashCommandBuilder()
        .setName('apuesta')
        .setDescription('Sistema de apuestas')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(true)
            .addChoices(
                { name: '🎲 Crear apuesta', value: 'crear' },
                { name: '✅ Aceptar', value: 'aceptar' },
                { name: '❌ Rechazar', value: 'rechazar' },
                { name: '📋 Mis apuestas', value: 'mias' },
                { name: '📊 Estadísticas', value: 'stats' },
                { name: '🏆 Resolver', value: 'resolver' },
                { name: '🗑️ Cancelar', value: 'cancelar' }
            ))
        .addUserOption(o => o.setName('usuario').setDescription('Usuario (para crear apuesta)').setRequired(false))
        .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad (para crear)').setRequired(false).setMinValue(1))
        .addStringOption(o => o.setName('descripcion').setDescription('Descripción (para crear)').setRequired(false))
        .addStringOption(o => o.setName('id').setDescription('ID de apuesta (para resolver/cancelar)').setRequired(false))
        .addStringOption(o => o.setName('ganador').setDescription('ID del ganador (para resolver)').setRequired(false)),

    // /trade agrupa: trade, tradeadd, trademoney, tradeaccept, tradecancel, tradeshow
    new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Sistema de intercambios')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(false)
            .addChoices(
                { name: '🔄 Iniciar trade', value: 'iniciar' },
                { name: '📦 Agregar item', value: 'additem' },
                { name: '💰 Agregar dinero', value: 'addmoney' },
                { name: '✅ Aceptar', value: 'aceptar' },
                { name: '❌ Cancelar', value: 'cancelar' },
                { name: '👀 Ver trade', value: 'ver' }
            ))
        .addUserOption(o => o.setName('usuario').setDescription('Con quién tradear').setRequired(false))
        .addStringOption(o => o.setName('item').setDescription('ID del item (para agregar item)').setRequired(false))
        .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad de item o dinero').setRequired(false).setMinValue(1)),

    // /subasta agrupa: auction, bid, auctionshow
    new SlashCommandBuilder()
        .setName('subasta')
        .setDescription('Sistema de subastas')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(false)
            .addChoices(
                { name: '🔨 Crear subasta', value: 'crear' },
                { name: '💰 Pujar', value: 'bid' },
                { name: '📋 Ver subastas', value: 'ver' }
            ))
        .addStringOption(o => o.setName('item').setDescription('ID del item (para crear)').setRequired(false))
        .addIntegerOption(o => o.setName('precio').setDescription('Precio inicial o puja').setRequired(false).setMinValue(1))
        .addIntegerOption(o => o.setName('duracion').setDescription('Duración en minutos (para crear)').setRequired(false).setMinValue(1))
        .addStringOption(o => o.setName('id').setDescription('ID de subasta (para pujar)').setRequired(false)),

    // /craft agrupa: craft, craftqueue, cancelcraft, recipes
    new SlashCommandBuilder()
        .setName('craft')
        .setDescription('Sistema de crafteo')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(false)
            .addChoices(
                { name: '📜 Ver recetas', value: 'recetas' },
                { name: '⚒️ Craftear', value: 'craftear' },
                { name: '📋 Ver cola', value: 'cola' },
                { name: '❌ Cancelar crafteo', value: 'cancelar' }
            ))
        .addStringOption(o => o.setName('receta').setDescription('ID de la receta (para craftear)').setRequired(false))
        .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad a craftear o nº a cancelar').setRequired(false).setMinValue(1))
        .addStringOption(o => o.setName('categoria').setDescription('Categoría de recetas').setRequired(false)),

    // /logros agrupa: achievements, allachievements, progress, detectachievements, missions, blockmissions, unblockmissions
    new SlashCommandBuilder()
        .setName('logros')
        .setDescription('Logros, misiones y progreso')
        .addStringOption(o => o.setName('accion').setDescription('Qué ver').setRequired(false)
            .addChoices(
                { name: '🏆 Mis logros', value: 'logros' },
                { name: '📋 Todos los logros', value: 'todos' },
                { name: '📈 Progreso', value: 'progreso' },
                { name: '🔍 Detectar logros', value: 'detectar' },
                { name: '📅 Misiones', value: 'misiones' },
                { name: '🔕 Silenciar notifs', value: 'silenciar' },
                { name: '🔔 Activar notifs', value: 'activar' }
            )),

    // /chat agrupa: chat, clearchat, chathelp
    new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Chat con IA')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(false)
            .addChoices(
                { name: '💬 Enviar mensaje', value: 'mensaje' },
                { name: '🗑️ Borrar historial', value: 'limpiar' },
                { name: '❓ Ayuda', value: 'ayuda' }
            ))
        .addStringOption(o => o.setName('mensaje').setDescription('Tu mensaje (para chatear)').setRequired(false)),

    // /m agrupa todos los comandos de música
    new SlashCommandBuilder()
        .setName('music')
        .setDescription('Comandos de música')
        .addStringOption(o => o.setName('accion').setDescription('Qué hacer').setRequired(true)
            .addChoices(
                { name: '▶️ Reproducir', value: 'play' },
                { name: '⏹️ Detener', value: 'stop' },
                { name: '⏭️ Saltar', value: 'skip' },
                { name: '⏸️ Pausar', value: 'pause' },
                { name: '▶️ Reanudar', value: 'resume' },
                { name: '📋 Cola', value: 'queue' },
                { name: '🎵 Sonando ahora', value: 'np' },
                { name: '🔍 Buscar YouTube', value: 'ytsearch' },
                { name: '🔍 Buscar Spotify', value: 'spsearch' },
                { name: '📝 Letra', value: 'lyrics' },
                { name: '🔧 Reparar', value: 'fix' },
                { name: '⏩ Adelantar', value: 'seek' },
                { name: '🔊 Volumen', value: 'volume' },
                { name: '🔁 Repetir', value: 'loop' },
                { name: '🔀 Mezclar', value: 'shuffle' },
                { name: '🗑️ Limpiar cola', value: 'clear' }
            ))
        .addStringOption(o => o.setName('query').setDescription('Canción/búsqueda/tiempo (según acción)').setRequired(false))
        .addIntegerOption(o => o.setName('numero').setDescription('Número (para volumen 0-100, skip N, etc.)').setRequired(false)),

    // ── NSFW ──────────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('r34')
        .setDescription('Rule34 (solo canales NSFW)')
        .addStringOption(o => o.setName('tags').setDescription('Tags a buscar').setRequired(false))
        .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad (default: 20)').setRequired(false).setMinValue(1).setMaxValue(20)),

    new SlashCommandBuilder()
        .setName('nsfw')
        .setDescription('Imágenes NSFW (solo canales NSFW)')
        .addStringOption(o => o.setName('tags').setDescription('Tags a buscar').setRequired(false))
        .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(false).setMinValue(1).setMaxValue(20)),

    new SlashCommandBuilder()
        .setName('videos')
        .setDescription('Videos NSFW (solo canales NSFW)')
        .addStringOption(o => o.setName('tags').setDescription('Tags a buscar').setRequired(false))
        .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad (default: 10)').setRequired(false).setMinValue(1).setMaxValue(10)),

    new SlashCommandBuilder()
        .setName('fuck')
        .setDescription('Contenido NSFW con mención (solo canales NSFW)')
        .addUserOption(o => o.setName('usuario').setDescription('Usuario a mencionar').setRequired(true)),

    new SlashCommandBuilder()
        .setName('fuckdetect')
        .setDescription('Versión alternativa de fuck (solo canales NSFW)')
        .addUserOption(o => o.setName('usuario').setDescription('Usuario a mencionar').setRequired(true)),

    // ── IMAGEN IA ─────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('imagine')
        .setDescription('Generar una imagen con IA')
        .addStringOption(o => o.setName('prompt').setDescription('Descripción de la imagen').setRequired(true)),

    // ── NIVELES DEL SERVIDOR ──────────────────────────────────
    new SlashCommandBuilder()
        .setName('srank')
        .setDescription('Ver tu nivel en el servidor'),

    new SlashCommandBuilder()
        .setName('servtop')
        .setDescription('Ver el ranking de niveles del servidor'),

    // ── EVENTOS Y MISC ────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('events')
        .setDescription('Ver eventos activos'),

    new SlashCommandBuilder()
        .setName('potcontribute')
        .setDescription('Contribuir al pozo semanal')
        .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad a contribuir').setRequired(true).setMinValue(1)),

    new SlashCommandBuilder()
        .setName('potstatus')
        .setDescription('Ver el estado del pozo semanal'),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Ver todos los comandos disponibles'),

    new SlashCommandBuilder()
        .setName('changelog')
        .setDescription('Ver las últimas novedades del bot'),

    new SlashCommandBuilder()
        .setName('checkstats')
        .setDescription('Ver tus estadísticas de minijuegos'),

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
    
/*    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );*/
    console.log('✅ Slash command registrado!');
  } catch (error) {
    console.error('❌ Error registrando slash commands:', error);
  }
})();

// Evento cuando el bot está listo
client.once('ready', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    await guildConfig.initTable();
    await minigames.loadActiveRussianGames(client);
    await minigames.loadActiveUnoGames(client);
    await trades.loadActiveTrades(client);
    await auctions.loadActiveAuctions(client);
    await chatbot.initChatTables();
    console.log('🤖 Sistema de ChatBot inicializado');
    iniciarApiServer(client, economy, guildConfig, 20329);

    client.user.setPresence({
        activities: [{
            type: ActivityType.Custom,
            name: 'custom',
            state: '💬 Escríbeme o usa >help — siempre estoy aquí 🤖',
        }],
        status: 'online'
    });
    
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
    
    // Establecer guilds y arrancar eventos automáticos
    const guildsArray = [...client.guilds.cache.values()];
    console.log('📋 Servidores actuales:');
    guildsArray.forEach(g => {
        console.log(`- ${g.name} (${g.id}) | miembros: ${g.memberCount} | dueño: ${g.ownerId} | bot unido: ${g.joinedAt}`);
    });
    if (guildsArray.length > 0) {
        events.setGuild(guildsArray[0]);
    }
    for (const guild of guildsArray) {
        events.getGuildEvents(guild.id);
    }

    // Iniciar loop de eventos automáticos (faltaba llamarlo)
    events.startEventLoop();
});

client.on('guildMemberRemove', async (member) => {
    try {
        if (member.guild.id !== '1270508373732884522') return;

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
        if (member.guild.id !== '1270508373732884522') return;
        if (member.user.bot) return;

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

client.on('guildCreate', async (guild) => {
    try {
        const embed = new EmbedBuilder()
            .setTitle('¡Hola! Soy Pibot 🤖')
            .setDescription('Gracias por agregarme a tu servidor. Aquí te cuento qué puedo hacer:')
            .setColor('#00BFFF')
            .setThumbnail(guild.client.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '💰 Economía', value: 'Sistema de monedas, niveles, XP y rankings', inline: true },
                { name: '🎮 Minijuegos', value: 'Coinflip, dados, blackjack, ruleta y más', inline: true },
                { name: '🛒 Tienda', value: 'Items, cosméticos, VIP y crafteo', inline: true },
                { name: '🎯 Misiones y Logros', value: 'Sistema de progresión con recompensas', inline: true },
                { name: '🎉 Eventos', value: 'Eventos automáticos con bonificaciones', inline: true },
                { name: '🤖 Chat IA', value: 'Habla con Pibot respondiéndole mensajes', inline: true },
                { name: '⚙️ Configuración inicial', value: 'Un admin puede configurar todo desde el [Dashboard Web](https://chasetodie.github.io/Pibot/dashboard), o usar `>svconfig` para ver el estado actual.', inline: false },
                { name: '📖 Comandos', value: 'Usa `>help` para ver todos los comandos disponibles.', inline: false }
            )
            .setFooter({ text: 'Pi-Bot • Usa >help para empezar' })
            .setTimestamp();

        const systemChannel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages'));
        if (systemChannel) {
            await systemChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('❌ Error enviando mensaje de bienvenida al servidor:', error);
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
    // ── SLASH COMMANDS ────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
        const cmd = interaction.commandName;
 
        const fakeMessage = {
            author:   interaction.user,
            member:   interaction.member,
            guild:    interaction.guild,
            channel:  interaction.channel,
            client:   interaction.client,
            mentions: {
                users:    new Map(),
                members:  new Map(),
                channels: new Map(),
                everyone: false,
            },
            content: `>${cmd}`,
            reply: async (data) => {
                if (interaction.replied || interaction.deferred) {
                    return interaction.editReply(data).catch(() => {});
                }
                return interaction.reply(data).catch(() => {});
            }
        };
        fakeMessage.mentions.users.first    = () => fakeMessage.mentions.users.values().next().value   || null;
        fakeMessage.mentions.members.first  = () => fakeMessage.mentions.members.values().next().value || null;
        fakeMessage.mentions.channels.first = () => fakeMessage.mentions.channels.values().next().value || null;
 
        const addUser    = (u) => { if (u) { fakeMessage.mentions.users.set(u.id, u); } };
        const addMember  = (m) => { if (m) { fakeMessage.mentions.members.set(m.id, m); addUser(m.user || m); } };
        const addChannel = (c) => { if (c) { fakeMessage.mentions.channels.set(c.id, c); } };
 
        await interaction.deferReply();
 
        try {
            switch (cmd) {
 
                // ── ECONOMÍA ──────────────────────────────────
                case 'balance': {
                    const t = interaction.options.getMember('usuario');
                    if (t) addMember(t);
                    await allCommands.processCommand(fakeMessage);
                    break;
                }
                case 'daily':
                    await allCommands.processCommand(fakeMessage);
                    break;
 
                case 'work': {
                    const trabajo = interaction.options.getString('trabajo') || '';
                    fakeMessage.content = `>work ${trabajo}`.trim();
                    await allCommands.processCommand(fakeMessage);
                    break;
                }
                case 'robar': {
                    const t = interaction.options.getUser('usuario');
                    addUser(t);
                    fakeMessage.content = `>robar <@${t.id}>`;
                    await allCommands.processCommand(fakeMessage);
                    break;
                }
                case 'pay': {
                    const t = interaction.options.getUser('usuario');
                    const amt = interaction.options.getInteger('cantidad');
                    addUser(t);
                    fakeMessage.content = `>pay <@${t.id}> ${amt}`;
                    await allCommands.processCommand(fakeMessage);
                    break;
                }
                case 'top': {
                    const tipo    = interaction.options.getString('tipo')    || 'money';
                    const alcance = interaction.options.getString('alcance') || 'server';
                    fakeMessage.content = `>top ${tipo} ${alcance === 'global' ? 'global' : ''}`.trim();
                    await allCommands.processCommand(fakeMessage);
                    break;
                }
                case 'level': {
                    const t = interaction.options.getMember('usuario');
                    if (t) addMember(t);
                    fakeMessage.content = '>level';
                    await allCommands.processCommand(fakeMessage);
                    break;
                }
                case 'pacto':
                case 'pedir':
                case 'rachas':
                case 'mapa':
                    await allCommands.processCommand(fakeMessage);
                    break;
 
                case 'excavar': {
                    const canal   = interaction.options.getChannel('canal');
                    const usuario = interaction.options.getUser('usuario');
                    if (canal) {
                        addChannel(canal);
                        fakeMessage.content = `>excavar <#${canal.id}>`;
                    } else if (usuario) {
                        addUser(usuario);
                        fakeMessage.content = `>excavar <@${usuario.id}>`;
                    } else {
                        await interaction.editReply('❌ Debes mencionar un canal o usuario.');
                        break;
                    }
                    await allCommands.processCommand(fakeMessage);
                    break;
                }
                case 'sicario': {
                    const t   = interaction.options.getUser('usuario');
                    const amt = interaction.options.getInteger('cantidad');
                    addUser(t);
                    fakeMessage.content = `>sicario <@${t.id}> ${amt}`;
                    await allCommands.processCommand(fakeMessage);
                    break;
                }
                case 'biblioteca': {
                    const accion  = interaction.options.getString('accion')   || '';
                    const libroId = interaction.options.getString('libro_id') || '';
                    if (accion === 'comprar' && libroId) fakeMessage.content = `>biblioteca comprar ${libroId}`;
                    else if (accion === 'estado')        fakeMessage.content = '>biblioteca estado';
                    else                                 fakeMessage.content = '>biblioteca';
                    await allCommands.handleBiblioteca(fakeMessage, fakeMessage.content.split(/ +/));
                    break;
                }
                case 'profesion': {
                    const clase = interaction.options.getString('clase') || '';
                    fakeMessage.content = `>profesion ${clase}`.trim();
                    await allCommands.handleProfesion(fakeMessage, fakeMessage.content.split(/ +/));
                    break;
                }
                case 'huerto': {
                    const accion = interaction.options.getString('accion') || '';
                    const slot   = interaction.options.getString('slot')   || '';
                    const planta = interaction.options.getString('planta') || '';
                    fakeMessage.content = `>huerto ${accion} ${slot} ${planta}`.trim().replace(/ +/g, ' ');
                    await allCommands.handleHuerto(fakeMessage, fakeMessage.content.split(/ +/));
                    break;
                }
                case 'mascota': {
                    const accion = interaction.options.getString('accion') || '';
                    const id     = interaction.options.getString('id')     || '';
                    const extra  = interaction.options.getString('extra')  || '';
                    fakeMessage.content = `>mascota ${accion} ${id} ${extra}`.trim().replace(/ +/g, ' ');
                    await allCommands.handleMascota(fakeMessage, fakeMessage.content.split(/ +/));
                    break;
                }
                case 'curar': {
                    const t   = interaction.options.getUser('usuario');
                    const med = interaction.options.getString('medicina');
                    addUser(t);
                    fakeMessage.content = `>curar <@${t.id}> ${med}`;
                    await allCommands.handleDoctorCure(fakeMessage, fakeMessage.content.split(/ +/));
                    break;
                }
                case 'casar': {
                    const t = interaction.options.getUser('usuario');
                    addUser(t);
                    fakeMessage.content = `>casar <@${t.id}>`;
                    await allCommands.handleCasar(fakeMessage, fakeMessage.content.split(/ +/));
                    break;
                }
                case 'divorcio':
                    await allCommands.handleDivorcio(fakeMessage, ['>divorcio']);
                    break;
                case 'pareja':
                    await allCommands.handleVerMatrimonio(fakeMessage);
                    break;
                case 'mentor': {
                    const accion  = interaction.options.getString('accion') || '';
                    const usuario = interaction.options.getUser('usuario');
                    if (usuario) addUser(usuario);
                    fakeMessage.content = `>mentor ${accion} ${usuario ? `<@${usuario.id}>` : ''}`.trim();
                    await allCommands.handleMentor(fakeMessage, fakeMessage.content.split(/ +/));
                    break;
                }
 
                // ── TIENDA ────────────────────────────────────
                case 'shop': {
                    const cat = interaction.options.getString('categoria') || '';
                    fakeMessage.content = `>shop ${cat}`.trim();
                    await shop.processCommand(fakeMessage);
                    break;
                }
                case 'buy': {
                    const item = interaction.options.getString('item');
                    const cant = interaction.options.getInteger('cantidad') || 1;
                    fakeMessage.content = `>buy ${item} ${cant}`;
                    await shop.processCommand(fakeMessage);
                    break;
                }
                case 'bag': {
                    const t = interaction.options.getMember('usuario');
                    if (t) addMember(t);
                    fakeMessage.content = '>bag';
                    await shop.processCommand(fakeMessage);
                    break;
                }
                case 'useitem': {
                    fakeMessage.content = `>useitem ${interaction.options.getString('item')}`;
                    await shop.processCommand(fakeMessage);
                    break;
                }
                case 'lanzar': {
                    const t = interaction.options.getUser('usuario');
                    addUser(t);
                    fakeMessage.content = `>lanzar <@${t.id}>`;
                    await shop.processCommand(fakeMessage);
                    break;
                }
                case 'efectos':
                    fakeMessage.content = '>efectos';
                    await shop.processCommand(fakeMessage);
                    break;
                case 'quitarefecto': {
                    fakeMessage.content = `>quitarefecto ${interaction.options.getString('item')}`;
                    await shop.processCommand(fakeMessage);
                    break;
                }
                case 'autoworker':
                    fakeMessage.content = '>autoworker';
                    await shop.processCommand(fakeMessage);
                    break;
                case 'cosmeticos':
                    fakeMessage.content = '>cosmetics';
                    await shop.processCommand(fakeMessage);
                    break;
                case 'setnickname': {
                    const apodo = interaction.options.getString('apodo');
                    fakeMessage.content = `>setnickname ${apodo}`;
                    await shop.processCommand(fakeMessage);
                    break;
                }
                case 'rolcreate': {
                    const color  = interaction.options.getString('color')  || '';
                    const nombre = interaction.options.getString('nombre') || '';
                    fakeMessage.content = `>rolcreate ${color} ${nombre}`.trim();
                    await shop.processCommand(fakeMessage);
                    break;
                }
                case 'vip':
                    fakeMessage.content = '>vip';
                    await shop.processCommand(fakeMessage);
                    break;
                case 'vipwork':
                    fakeMessage.content = '>vipwork';
                    await shop.processCommand(fakeMessage);
                    break;
                case 'viphelp':
                    fakeMessage.content = '>viphelp';
                    await shop.processCommand(fakeMessage);
                    break;
 
                // ── MINIJUEGOS ────────────────────────────────
                case 'coinflip': {
                    const lado    = interaction.options.getString('lado');
                    const apuesta = interaction.options.getInteger('apuesta');
                    fakeMessage.content = `>coinflip ${lado} ${apuesta}`;
                    await minigames.processCommand(fakeMessage);
                    break;
                }
                case 'dice': {
                    const apuesta = interaction.options.getInteger('apuesta');
                    const numero  = interaction.options.getInteger('numero') || '';
                    fakeMessage.content = `>dice ${apuesta} ${numero}`.trim();
                    await minigames.processCommand(fakeMessage);
                    break;
                }
                case 'blackjack': {
                    fakeMessage.content = `>blackjack ${interaction.options.getInteger('apuesta')}`;
                    await minigames.processCommand(fakeMessage);
                    break;
                }
                case 'roulette': {
                    const apuesta = interaction.options.getInteger('apuesta');
                    const opcion  = interaction.options.getString('opcion') || '';
                    fakeMessage.content = `>roulette ${apuesta} ${opcion}`.trim();
                    await minigames.processCommand(fakeMessage);
                    break;
                }
                case 'slots': {
                    fakeMessage.content = `>slots ${interaction.options.getInteger('apuesta')}`;
                    await minigames.processCommand(fakeMessage);
                    break;
                }
                case 'lottery': {
                    fakeMessage.content = `>lottery ${interaction.options.getInteger('tickets') || 1}`;
                    await minigames.processCommand(fakeMessage);
                    break;
                }
                case 'horserace': {
                    const accion  = interaction.options.getString('accion') || '';
                    const apuesta = interaction.options.getInteger('apuesta') || '';
                    if (accion === 'join') {
                        fakeMessage.content = `>joinrace ${apuesta}`.trim();
                    } else if (accion === 'start') {
                        fakeMessage.content = '>startrace';
                    } else if (accion === 'cancel') {
                        fakeMessage.content = '>cancelrace';
                    } else {
                        // 'crear' o vacío = crear carrera
                        fakeMessage.content = `>horserace ${apuesta}`.trim();
                    }
                    await minigames.processCommand(fakeMessage);
                    break;
                }
                case 'joinrace': {
                    const apuesta = interaction.options.getInteger('apuesta') || '';
                    fakeMessage.content = `>joinrace ${apuesta}`.trim();
                    await minigames.processCommand(fakeMessage);
                    break;
                }
                case 'startrace':
                    fakeMessage.content = '>startrace';
                    await minigames.processCommand(fakeMessage);
                    break;
                case 'cancelrace':
                    fakeMessage.content = '>cancelrace';
                    await minigames.processCommand(fakeMessage);
                    break;
                case 'vending':
                    fakeMessage.content = '>vending';
                    await minigames.processCommand(fakeMessage);
                    break;
                case 'russian': {
                    const accion  = interaction.options.getString('accion') || '';
                    const t       = interaction.options.getUser('usuario');
                    const apuesta = interaction.options.getInteger('apuesta') || '';
                    if (accion === 'shoot') {
                        fakeMessage.content = '>shoot';
                    } else if (accion === 'start') {
                        fakeMessage.content = '>startrussian';
                    } else if (accion === 'cancel') {
                        fakeMessage.content = '>cancelrussian';
                    } else {
                        // 'desafiar' o vacío
                        if (t) addUser(t);
                        fakeMessage.content = `>russian ${t ? `<@${t.id}>` : ''} ${apuesta}`.trim();
                    }
                    await minigames.processCommand(fakeMessage);
                    break;
                }
                case 'limits':
                    fakeMessage.content = '>limits';
                    await minigames.processCommand(fakeMessage);
                    break;
                case 'games':
                    fakeMessage.content = '>games';
                    await minigames.processCommand(fakeMessage);
                    break;
 
                // ── TRIVIA ────────────────────────────────────
                case 'trivia': {
                    const modo  = interaction.options.getString('modo') || 'normal';
                    const dif   = interaction.options.getString('dificultad') || '';
                    const cat   = interaction.options.getString('categoria')  || '';
                    const rondas = interaction.options.getInteger('rondas')   || '';
                    switch (modo) {
                        case 'survival': fakeMessage.content = '>triviasurvival'; break;
                        case 'multi':    fakeMessage.content = `>triviamulti ${rondas}`.trim(); break;
                        case 'join':     fakeMessage.content = '>jointrivia'; break;
                        case 'start':    fakeMessage.content = '>starttrivia'; break;
                        case 'cancel':   fakeMessage.content = '>canceltrivia'; break;
                        case 'lb':       fakeMessage.content = '>trivialb'; break;
                        case 'cat':      fakeMessage.content = '>triviacategorias'; break;
                        default:         fakeMessage.content = `>trivia ${dif} ${cat}`.trim(); break;
                    }
                    await minigames.processCommand(fakeMessage);
                    break;
                }
 
                // ── UNO ───────────────────────────────────────
                case 'uno': {
                    const accion = interaction.options.getString('accion');
                    const apuesta = interaction.options.getInteger('apuesta') || 150;
                    const carta  = interaction.options.getInteger('carta');
                    const color  = interaction.options.getString('color') || '';
                    const t      = interaction.options.getUser('usuario');
                    switch (accion) {
                        case 'join':    fakeMessage.content = `>ujoin ${apuesta}`.trim();   break;
                        case 'start':   fakeMessage.content = '>ustart';  break;
                        case 'cancel':  fakeMessage.content = '>ucancel'; break;
                        case 'pickup':  fakeMessage.content = '>upickup'; break;
                        case 'hand':    fakeMessage.content = '>ushowhand'; break;
                        case 'table':   fakeMessage.content = '>utable';  break;
                        case 'sayuno':  fakeMessage.content = '>sayuno!'; break;
                        case 'callout':
                            if (t) addUser(t);
                            fakeMessage.content = `>ucallout <@${t?.id}>`; break;
                        case 'play':
                            fakeMessage.content = `>uplay ${color} ${carta ?? 0}`.trim(); break;
                    }
                    await minigames.processCommand(fakeMessage);
                    break;
                }
 
                // ── APUESTAS ──────────────────────────────────
                case 'apuesta': {
                    const accion = interaction.options.getString('accion');
                    const t      = interaction.options.getUser('usuario');
                    const amt    = interaction.options.getInteger('cantidad');
                    const desc   = interaction.options.getString('descripcion') || '';
                    const id     = interaction.options.getString('id') || '';
                    const ganador = interaction.options.getString('ganador') || '';
                    switch (accion) {
                        case 'crear':
                            if (t) addUser(t);
                            fakeMessage.content = `>bet <@${t?.id}> ${amt} ${desc}`;
                            break;
                        case 'aceptar':  fakeMessage.content = '>acceptbet'; break;
                        case 'rechazar': fakeMessage.content = '>declinebet'; break;
                        case 'mias':     fakeMessage.content = '>mybets'; break;
                        case 'stats':
                            if (t) addMember(await interaction.guild.members.fetch(t.id).catch(() => null));
                            fakeMessage.content = '>betstats'; break;
                        case 'resolver': fakeMessage.content = `>resolvebet ${id} ${ganador}`.trim(); break;
                        case 'cancelar': fakeMessage.content = `>cancelbet ${id}`.trim(); break;
                    }
                    await allCommands.processCommand(fakeMessage);
                    break;
                }
 
                // ── TRADING ───────────────────────────────────
                case 'trade': {
                    const accion = interaction.options.getString('accion') || 'iniciar';
                    const t      = interaction.options.getUser('usuario');
                    const item   = interaction.options.getString('item') || '';
                    const cant   = interaction.options.getInteger('cantidad') || 1;
                    switch (accion) {
                        case 'iniciar':
                            if (t) { addUser(t); fakeMessage.content = `>trade <@${t.id}>`; }
                            else   { fakeMessage.content = '>trade'; }
                            break;
                        case 'additem':   fakeMessage.content = `>tradeadd ${item} ${cant}`; break;
                        case 'addmoney':  fakeMessage.content = `>trademoney ${cant}`;        break;
                        case 'aceptar':   fakeMessage.content = '>tradeaccept';               break;
                        case 'cancelar':  fakeMessage.content = '>tradecancel';               break;
                        case 'ver':       fakeMessage.content = '>tradeshow';                 break;
                    }
                    await allCommands.processCommand(fakeMessage);
                    break;
                }
                case 'subasta': {
                    const accion  = interaction.options.getString('accion') || 'ver';
                    const item    = interaction.options.getString('item')    || '';
                    const precio  = interaction.options.getInteger('precio') || 0;
                    const dur     = interaction.options.getInteger('duracion') || 60;
                    const id      = interaction.options.getString('id')      || '';
                    const cant    = interaction.options.getInteger('precio') || 0; // reusa precio para bid
                    switch (accion) {
                        case 'crear':
                            fakeMessage.content = (item && precio) ? `>auction ${item} ${precio} ${dur}` : '>auction';
                            break;
                        case 'bid':
                            fakeMessage.content = `>bid ${id} ${cant}`;
                            break;
                        case 'ver':
                        default:
                            fakeMessage.content = '>auctionshow';
                    }
                    await allCommands.processCommand(fakeMessage);
                    break;
                }
 
                // ── CRAFTEO ───────────────────────────────────
                case 'craft': {
                    const accion   = interaction.options.getString('accion') || 'recetas';
                    const receta   = interaction.options.getString('receta') || '';
                    const cantidad = interaction.options.getInteger('cantidad') || '';
                    const cat      = interaction.options.getString('categoria') || '';
                    switch (accion) {
                        case 'recetas':  fakeMessage.content = `>recipes ${cat} ${cantidad}`.trim(); break;
                        case 'craftear': fakeMessage.content = `>craft ${receta} ${cantidad}`.trim(); break;
                        case 'cola':     fakeMessage.content = '>craftqueue'; break;
                        case 'cancelar': fakeMessage.content = `>cancelcraft ${cantidad}`.trim(); break;
                    }
                    await allCommands.processCommand(fakeMessage);
                    break;
                }
 
                // ── MISIONES Y LOGROS ─────────────────────────
                case 'logros': {
                    const accion = interaction.options.getString('accion') || 'logros';
                    switch (accion) {
                        case 'logros':   fakeMessage.content = '>achievements';      await achievements.processCommand(fakeMessage); break;
                        case 'todos':    fakeMessage.content = '>allachievements';   await achievements.processCommand(fakeMessage); break;
                        case 'progreso': fakeMessage.content = '>progress';          await achievements.processCommand(fakeMessage); break;
                        case 'detectar': fakeMessage.content = '>detectachievements'; await achievements.processCommand(fakeMessage); break;
                        case 'misiones': fakeMessage.content = '>missions';          await missions.processCommand(fakeMessage); break;
                        case 'silenciar': fakeMessage.content = '>blockmissions';    await missions.processCommand(fakeMessage); break;
                        case 'activar':  fakeMessage.content = '>unblockmissions';   await missions.processCommand(fakeMessage); break;
                    }
                    break;
                }
                // ── NIVELES DEL SERVIDOR ──────────────────────
                case 'srank':
                    fakeMessage.content = '>srank';
                    await guildLevels.processCommand(fakeMessage, interaction.client);
                    break;
                case 'servtop':
                    fakeMessage.content = '>stop';
                    await guildLevels.processCommand(fakeMessage, interaction.client);
                    break;
 
                // ── MÚSICA ────────────────────────────────────
                case 'music': {
                    const accion = interaction.options.getString('accion');
                    const query  = interaction.options.getString('query') || '';
                    const numero = interaction.options.getInteger('numero') || '';
                    // Mapear acciones del choice al subcomando real
                    const subMap = {
                        'play': 'play', 'stop': 'stop', 'skip': 'skip',
                        'pause': 'pause', 'resume': 'resume', 'queue': 'queue',
                        'np': 'nowplaying', 'ytsearch': 'ytsearch', 'spsearch': 'spsearch',
                        'lyrics': 'lyrics', 'fix': 'fix', 'seek': 'seek',
                        'volume': 'volume', 'loop': 'loop', 'shuffle': 'shuffle', 'clear': 'clear'
                    };
                    const sub = subMap[accion] || accion;
                    // Para volume y skip el número va en query si no hay query
                    const param = query || numero || '';
                    fakeMessage.content = `>m ${sub} ${param}`.trim();
                    await music.processCommand(fakeMessage);
                    break;
                }
 
                // ── CHAT IA ───────────────────────────────────
                case 'chat': {
                    const accion  = interaction.options.getString('accion')  || 'mensaje';
                    const mensaje = interaction.options.getString('mensaje') || '';
                    switch (accion) {
                        case 'mensaje': fakeMessage.content = `>chat ${mensaje}`; break;
                        case 'limpiar': fakeMessage.content = '>clearchat'; break;
                        case 'ayuda':   fakeMessage.content = '>chathelp'; break;
                    }
                    await chatbot.processCommand(fakeMessage);
                    break;
                }
 
                // ── NSFW ──────────────────────────────────────
                case 'r34': {
                    const tags = interaction.options.getString('tags')       || '';
                    const cant = interaction.options.getInteger('cantidad')  || '';
                    fakeMessage.content = `>r34 ${tags} ${cant}`.trim();
                    await nsfw.processCommand(fakeMessage);
                    break;
                }
                case 'nsfw': {
                    const tags = interaction.options.getString('tags')      || '';
                    const cant = interaction.options.getInteger('cantidad') || '';
                    fakeMessage.content = `>nsfw ${tags} ${cant}`.trim();
                    await nsfw.processCommand(fakeMessage);
                    break;
                }
                case 'videos': {
                    const tags = interaction.options.getString('tags')      || '';
                    const cant = interaction.options.getInteger('cantidad') || '';
                    fakeMessage.content = `>videos ${tags} ${cant}`.trim();
                    await nsfw.processCommand(fakeMessage);
                    break;
                }
                case 'fuck': {
                    const t = interaction.options.getMember('usuario');
                    addMember(t);
                    fakeMessage.content = `>fuck <@${t.id}>`;
                    await nsfw.processCommand(fakeMessage);
                    break;
                }
                case 'fuckdetect': {
                    const t = interaction.options.getMember('usuario');
                    addMember(t);
                    fakeMessage.content = `>fuckdetect <@${t.id}>`;
                    await nsfw.processCommand(fakeMessage);
                    break;
                }
 
                // ── IMAGEN IA ─────────────────────────────────
                case 'imagine': {
                    fakeMessage.content = `>imagine ${interaction.options.getString('prompt')}`;
                    await imageGen.processCommand(fakeMessage);
                    break;
                }
 
                // ── EVENTOS ───────────────────────────────────
                case 'events':
                    fakeMessage.content = '>events';
                    await allCommands.processCommand(fakeMessage);
                    break;
 
                // ── POZO SEMANAL ──────────────────────────────
                case 'potcontribute': {
                    fakeMessage.content = `>potcontribute ${interaction.options.getInteger('cantidad')}`;
                    await minigames.processCommand(fakeMessage);
                    break;
                }
                case 'potstatus':
                    fakeMessage.content = '>potstatus';
                    await minigames.processCommand(fakeMessage);
                    break;
 
                // ── AYUDA Y MISC ──────────────────────────────
                case 'help':
                    fakeMessage.content = '>help';
                    await allCommands.processCommand(fakeMessage);
                    break;
                case 'changelog':
                    fakeMessage.content = '>changelog';
                    await allCommands.processCommand(fakeMessage);
                    break;
                case 'checkstats':
                    fakeMessage.content = '>checkstats';
                    await minigames.processCommand(fakeMessage);
                    break;
 
                default:
                    await interaction.editReply('❌ Comando no reconocido.');
            }
        } catch (err) {
            console.error(`❌ Error en slash /${cmd}:`, err.message);
            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply('❌ Ocurrió un error ejecutando el comando.');
                }
            } catch {}
        }
        return;
    }

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
                        content: `❌ No tengo permisos para cambiar apodos. Contacta a un admin o a mi creador (chasetodie10).`,
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

        // Botones de búsqueda de música
        if (interaction.customId?.startsWith('msearch_') || interaction.customId?.startsWith('mplay_') || 
            interaction.customId?.startsWith('mback_') || interaction.customId?.startsWith('msp_') || 
            interaction.customId?.startsWith('mspplay_') || interaction.customId?.startsWith('mspback_')) {
            client.musicSystem.handleSearchInteraction(interaction).catch(e => {
                console.error('handleSearchInteraction error:', e.message);
            });
            return;
        }

        if (interaction.customId?.startsWith('help_')) {
            await allCommands.handleHelpInteraction(interaction);
        }
        if (interaction.customId?.startsWith('ach_')) {
            await achievements.handleAchievementPagination(interaction);
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('role_') || 
                interaction.customId.startsWith('nickname_') || 
                interaction.customId.startsWith('vip_')) {
                await shop.handleButtonInteraction(interaction);
            }
        }

        if (interaction.customId.startsWith('notify_limit_')) {
            await minigames.handleLimitNotificationButton(interaction);
            return;
        }

        if (interaction.customId.startsWith('progress_prev_') || interaction.customId.startsWith('progress_next_')) {
            await achievements.handleProgressPagination(interaction);
        }

        if (interaction.customId.startsWith('recipes_')) {
            await crafting.handleRecipesInteraction(interaction);
            return;
        }

        if (interaction.customId?.startsWith('work_') && !interaction.customId.startsWith('work_page_')) {
            await allCommands.workMinigames.handleInteraction(interaction);
            return;
        }

        if (interaction.customId.startsWith('sicario_delete_')) {
            const ownerId = interaction.customId.replace('sicario_delete_', '');
            if (interaction.user.id !== ownerId) {
                await interaction.reply({ content: '❌ Solo quien contrató puede borrar este mensaje.', ephemeral: true });
                return;
            }
            await interaction.message.delete().catch(() => {});
            return;
        } 

        if (interaction.customId.startsWith('pedir_donar_') || interaction.customId.startsWith('pedir_ignorar_')) {
            const parts = interaction.customId.split('_');
            const requesterId = parts[2];
            const donorId = interaction.user.id;
            const donationAmount = parseInt(parts[4]) || 500;

            if (donorId !== parts[3]) {
                await interaction.reply({ content: '❌ Este botón no es para ti.', ephemeral: true });
                return;
            }

            if (interaction.customId.startsWith('pedir_ignorar_')) {
                await interaction.update({
                    embeds: [new EmbedBuilder()
                        .setColor('#888888')
                        .setTitle('❌ Solicitud ignorada')
                        .setDescription('Decidiste no donar esta vez.')
                        .setTimestamp()],
                    components: []
                });
                return;
            }

            // Procesar donación
            const result = await economy.processDonation(donorId, requesterId, donationAmount);

            if (!result.success) {
                await interaction.reply({ content: `❌ No tienes suficiente dinero para donar.`, ephemeral: true });
                return;
            }

            await interaction.update({
                content: `<@${requesterId}>`,
                embeds: [new EmbedBuilder()
                    .setColor('#00ff88')
                    .setTitle('💝 ¡Donación enviada!')
                    .setDescription(`Donaste **${donationAmount} ${economy.config.currencySymbol}** a <@${requesterId}> 🥺`)
                    .setTimestamp()],
                components: []
            });

            return;
        }
                
        if (interaction.customId.startsWith('bj_')) {
            await minigames.handleBlackjackButtons(interaction);
            return; // Importante: return para no continuar con otros botones
        }

        if (interaction.customId === 'double_bet_race') {
            await minigames.handleHorseRaceButtons(interaction);
            return;
        }

        if (interaction.customId.startsWith('select_horse_')) {
            await minigames.handleHorseSelection(interaction);
            return;
        }

        if (interaction.customId.startsWith('random_horse_')) {
            await minigames.handleRandomHorseSelection(interaction);
            return;
        }

        if (interaction.customId.startsWith('rolecolor_')) {
        await shop.handleRoleColorSelect(interaction);
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
                    content: 'Hubo un error al procesar tu acción. Por favor contacta a mi creador (chasetodie10).',
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

    // ← AGREGAR: Verificar reembolsos pendientes (máx 1 vez cada 24h por usuario)
    if (shop) {
        const lastRefundCheck = shop.refundCheckCache?.get(userId) || 0;
        if (Date.now() - lastRefundCheck > 86400000) { // 24h
            if (!shop.refundCheckCache) shop.refundCheckCache = new Map();
            shop.refundCheckCache.set(userId, Date.now());
            // No await — que corra en background sin bloquear
            shop.processUserRefund(userId, message.channel).catch(() => {});
        }
    }
    
    if (message.content.startsWith('>') && !message.author.bot) {
        await maintenance.checkAndNotify(message.author.id, message.channel);
    }

    await processUserActivityOptimized(userId, message);

    // Racha de presencia — una vez por día por usuario
    const presenceResult = await economy.checkPresenceStreak(userId).catch(() => null);
    if (presenceResult?.streakLost) {
        const lostEmbed = new EmbedBuilder()
            .setColor('#ff4444')
            .setTitle('💔 ¡Perdiste tu racha!')
            .setDescription(
                `No te conectaste por más de 48 horas y perdiste tu racha de **${presenceResult.streakLost} días**.\n\n` +
                `*Vuelve mañana para empezar de nuevo desde 1.*`
            )
            .setFooter({ text: 'Conéctate cada día para mantener tu racha' })
            .setTimestamp();
        message.channel.send({ embeds: [lostEmbed] }).catch(() => {});
    }
    if (presenceResult?.milestone) {
        const { milestone } = presenceResult;
        const streakEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🌱 ¡Racha de Presencia!')
            .setDescription(`${milestone.label}`)
            .addFields(
                { name: '🔥 Racha actual', value: `${presenceResult.streak} días`, inline: true },
            )
            .setFooter({ text: 'Conéctate cada día para mantener tu racha' })
            .setTimestamp();
        message.channel.send({ embeds: [streakEmbed] }).catch(() => {});
    }

    // Verificar libros completados
    const completedBooks = await economy.checkCompletedBooks(userId).catch(() => []);
    if (completedBooks.length > 0) {
        for (const book of completedBooks) {
            const effectText = book.effect.type === 'recipe'
                ? '📜 Receta secreta de crafteo desbloqueada'
                : `+${Math.round(book.effect.value * 100)}% ${
                    book.effect.type === 'dailyBonus' ? 'al daily' :
                    book.effect.type === 'workBonus' ? 'al trabajo' :
                    book.effect.type === 'robBonus' ? 'al robo' :
                    book.effect.type === 'workCooldown' ? 'reducción cooldown trabajo' :
                    book.effect.type === 'robCooldown' ? 'reducción cooldown robo' :
                    'a minijuegos'
                }`;
            message.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('📚 ¡Libro terminado!')
                    .setDescription(
                        `<@${userId}> terminó de leer **${book.name}**\n\n` +
                        `✨ ${effectText} desbloqueado permanentemente`
                    )
                    .setTimestamp()]
            }).catch(() => {});
        }
    }

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
                chatbot.processCommand(message),
                nsfw.processCommand(message),
                imageGen.processCommand(message),
                guildLevels.processCommand(message, client),
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
    
    // Ignorar @everyone y @here
    if (message.mentions.everyone) return;

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
                const cleanMessage = message.content
                    .replace(/<@!?\d+>/g, '')
                    .trim();

                // Detectar si hay imagen adjunta
                let imageBase64 = null;
                let imageMimeType = null;

                if (message.attachments.size > 0) {
                    const attachment = message.attachments.first();
                    if (attachment.contentType?.startsWith('image/')) {
                        try {
                            const imgResponse = await fetch(attachment.url);
                            const arrayBuffer = await imgResponse.arrayBuffer();
                            imageBase64 = Buffer.from(arrayBuffer).toString('base64');
                            imageMimeType = attachment.contentType;
                            console.log(`🖼️ Imagen detectada: ${attachment.contentType}`);
                        } catch (e) {
                            console.log('❌ Error procesando imagen:', e.message);
                        }
                    }
                }

                const result = await chatbot.processMessage(
                    message.author.id,
                    cleanMessage,
                    message.member?.displayName || message.author.globalName || message.author.username,
                    botContext,
                    repliedToMessage,
                    imageBase64,
                    imageMimeType
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

async function sendCrashDM(error, type = 'CRASH') {
    try {
        const user = await client.users.fetch("488110147265232898");
        if (!user) return;

        await user.send(`
🚨 **${type}**
🕒 ${new Date().toISOString()}

📛 ${error?.message || error}

\`\`\`
${error?.stack?.slice(0, 1900) || 'No stack'}
\`\`\`
        `);

    } catch (err) {
        console.error('No se pudo enviar DM:', err.message);
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

setInterval(() => guildLevels.cleanCooldowns(), 300000); // cada 5 min

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

process.on('unhandledRejection', async (error) => {
    console.error(error);
    await sendCrashDM(error, 'UNHANDLED_REJECTION');
});

process.on('uncaughtException', async (error) => {
    console.error(error);
    await sendCrashDM(error, 'UNCAUGHT_EXCEPTION');

    // Intentar limpiar antes de morir
    aggressiveCleanup();
    
    setTimeout(() => {
        process.exit(1);
    }, 2000);
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



















