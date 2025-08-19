const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
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
const {
    AuctionSystem,
    CraftingSystem
} = require('./things-shop');

// Configuración del servidor web para mantener activo el bot
const app = express();
const PORT = process.env.PORT || 3000;

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
    ]
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

//Crear instancia del sistema de Minijuegos
const minigames = new MinigamesSystem(economy);

//Crear instancia del sistema de Misiones
const missions = new MissionsSystem(economy);

//Crear instancia del sistema de Achievements
const achievements = new AchievementsSystem(economy);

//Crear instancia del sistema de Tienda
const shop = new ShopSystem(economy);

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

// Rutas del servidor web
app.get('/', (req, res) => {
    res.send(`
        <h1>Monilia Al Habla!</h1>
        <p>Estado: <strong style="color: green;">ONLINE</strong></p>
        <p>Última verificación: ${new Date().toLocaleString()}</p>
        <p>Contadores actuales: Pibe ${counters.pibe}, Piba ${counters.piba}</p>
        <hr>
        <h3>Configuración:</h3>
        <p>Pibe inicial: ${process.env.PIBE_COUNT || 0}</p>
        <p>Piba inicial: ${process.env.PIBA_COUNT || 0}</p>
    `);
});

app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        counters: counters,
        environment: {
            pibe_initial: process.env.PIBE_COUNT || 0,
            piba_initial: process.env.PIBA_COUNT || 0
        }
    });
});

app.get('/reset/:pibe/:piba', (req, res) => {
    const { pibe, piba } = req.params;
    const pibeCount = parseInt(pibe);
    const pibaCount = parseInt(piba);
    
    if (!isNaN(pibeCount) && !isNaN(pibaCount) && pibeCount >= 0 && pibaCount >= 0) {
        counters.pibe = pibeCount;
        counters.piba = pibaCount;
        saveCounters(counters);
        
        res.json({
            success: true,
            message: `Contadores actualizados: Pibe ${pibeCount}, Piba ${pibaCount}`,
            counters: counters
        });
    } else {
        res.status(400).json({
            success: false,
            message: 'Números inválidos. Usa: /reset/18/5'
        });
    }
});

// Iniciar servidor web
app.listen(PORT, () => {
    console.log(`Servidor web corriendo en puerto ${PORT}`);
    console.log(`URL del bot: ${process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${PORT}`}`);
});

// Evento cuando el bot está listo
client.once('ready', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    console.log(`📊 Contadores actuales: Pibe ${counters.pibe}, Piba ${counters.piba}`);
    console.log(`🌍 Variables de entorno: PIBE_COUNT=${process.env.PIBE_COUNT || 'no definida'}, PIBA_COUNT=${process.env.PIBA_COUNT || 'no definida'}`);
    console.log(`🔧 Comandos disponibles: !contadores, !reset, !reload, !help`);
    await minigames.loadActiveRussianGames(client);
    await minigames.loadActiveUnoGames(client);
  
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
            .setTitle('¡Bienvenido/a a Prófugos del crotolamo!')
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

        // Enviar mensaje directo al usuario
        await member.send({
            embeds: [embed],
            components: [row]
        });

        console.log(`📩 Mensaje directo enviado a ${member.user.tag}`);
        
    } catch (error) {
        console.error('❌ Error enviando mensaje directo:', error);
        
        // Si no se puede enviar DM, intentar enviar mensaje en un canal del servidor
        try {
            const guild = member.guild;
            const systemChannel = guild.systemChannel;
            
            if (systemChannel) {
                await systemChannel.send({
                    content: `${member.user}, no pude enviarte un mensaje directo. Por favor, selecciona tu categoría aquí:`,
                    embeds: [embed],
                    components: [row]
                });
                console.log(`📢 Mensaje enviado en canal del sistema para ${member.user.tag}`);
            }
        } catch (channelError) {
            console.error('❌ Error enviando mensaje en canal:', channelError);
        }
    }
});

// Evento para manejar interacciones con botones
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    try {
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
            const tradeId = interaction.customId.replace('trade_accept_', '');
            
            // Obtener trade por ID específico
            const { data: tradeData } = await trades.supabase
                .from('trades')
                .select('*')
                .eq('id', tradeId)
                .eq('status', 'pending')
                .single();
                
            if (!tradeData) {
                await interaction.reply({ content: '❌ Intercambio no encontrado.', ephemeral: true });
                return;
            }
            
            // Verificar que el usuario sea parte del trade
            if (interaction.user.id !== tradeData.initiator && interaction.user.id !== tradeData.target) {
                await interaction.reply({ content: '❌ No puedes aceptar este intercambio.', ephemeral: true });
                return;
            }
            
            // Simular mensaje para acceptTrade
            const fakeMessage = {
                author: interaction.user,
                channel: interaction.channel,
                reply: (content) => interaction.reply(content)
            };
            
            await trades.acceptTrade(fakeMessage);
        }
        
        if (interaction.customId.startsWith('trade_cancel_')) {
            // Similar lógica para cancelar
            const tradeId = interaction.customId.replace('trade_cancel_', '');
            await trades.cancelTradeInDb(tradeId, 'manual');
            await interaction.reply('✅ Intercambio cancelado.');
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
                
                try {
                    const handString = player.hand.map((card, i) => 
                        `${i}: ${minigames.getCardString(card)}`).join('\n');
                    
                    // Enviar por DM
                    const user = await interaction.user;
                    const embed = new EmbedBuilder()
                        .setTitle('🎴 Tu mano de UNO')
                        .setDescription(`\`\`\`${handString}\`\`\``)
                        .setColor('#0099FF')
                        .setFooter({ text: 'Usa >uplay <color> <valor> para jugar' });                    
                    
                    await user.send({ embeds: [embed] });

//                    await user.send(`🎴 **Tu mano:**\n\`\`\`${handString}\`\`\``);
                    
                    // Confirmar en canal (ephemeral real porque es interaction)
                    await interaction.reply({
                        content: `🎴 **Tu mano:**\n\`\`\`${handString}\`\`\``, 
                        ephemeral: true 
                    });
                    
                } catch (error) {
                    await interaction.reply({ 
                        content: '❌ No puedo enviarte mensaje privado. Activa los DMs en tu configuración de privacidad.', 
                        ephemeral: true 
                    });
                }
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
        
        if (interaction.customId === 'select_pibe') {
            // Incrementar contador de pibes
            counters.pibe++;
            const nickname = `Pibe ${counters.pibe}`;
            
            // Cambiar apodo
            await member.setNickname(nickname);
            
            // Guardar contadores
            saveCounters(counters);
            
            // Responder al usuario
            const successEmbed = new EmbedBuilder()
                .setTitle('¡Apodo asignado!')
                .setDescription(`Tu apodo ha sido cambiado a: **${nickname}**`)
                .setColor('#00FF00')
                .setFooter({ text: '¡Bienvenido al servidor!' });
            
            await interaction.reply({
                embeds: [successEmbed],
                flags: 64 // ephemeral
            });
            
            console.log(`✅ ${interaction.user.tag} eligió Pibe y ahora es ${nickname}`);
            
        } else if (interaction.customId === 'select_piba') {
            // Incrementar contador de pibas
            counters.piba++;
            const nickname = `Piba ${counters.piba}`;
            
            // Cambiar apodo
            await member.setNickname(nickname);
            
            // Guardar contadores
            saveCounters(counters);
            
            // Responder al usuario
            const successEmbed = new EmbedBuilder()
                .setTitle('¡Apodo asignado!')
                .setDescription(`Tu apodo ha sido cambiado a: **${nickname}**`)
                .setColor('#FF69B4')
                .setFooter({ text: '¡Bienvenida al servidor!' });
            
            await interaction.reply({
                embeds: [successEmbed],
                flags: 64 // ephemeral
            });
            
            console.log(`✅ ${interaction.user.tag} eligió Piba y ahora es ${nickname}`);
        }

        if (interaction.customId.startsWith('bj_')) {
          await minigamesSystem.handleBlackjackButton(interaction);
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

// Manejar mensajes (COMANDOS + XP + ECONOMÍA)
client.on('messageCreate', async (message) => {
    // Ignorar mensajes de bots
    if (message.author.bot) return;
    
    // AGREGAR ESTO AL INICIO:
    const userId = message.author.id;  
    const user = await economy.getUser(userId);
  
    // Procesar XP por mensaje (solo en servidores, no en DMs)
    if (message.guild) {
        // Aplicar modificadores de eventos a XP
        //const xpMod = events.applyEventModifiers(message.author.id, economy.config.xpPerMessage, 'message');
        
        const channelId = '1402824824971067442'; // ID del canal de XP (puedes cambiarlo)
        const channel = message.guild.channels.cache.get(channelId);

        const xpResult = await economy.processMessageXp(message.author.id/*, economy.config.xpPerMessage*/);
        
        // Si subió de nivel, notificar
        if (xpResult && xpResult.levelUp && channel) {
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
        }

        // *** NUEVO: VERIFICAR ACHIEVEMENTS DESPUÉS DE GANAR XP ***
        try {
            const newAchievements = await achievements.checkAchievements(userId);
            if (newAchievements.length > 0) {
                await achievements.notifyAchievements(message, newAchievements);
            }
        } catch (error) {
            console.error('❌ Error verificando logros:', error);
        }

        // *** NUEVO: ACTUALIZAR PROGRESO DE MISIONES ***
        try {
            const completedMissions = await missions.updateMissionProgress(userId, 'message');
            if (completedMissions.length > 0) {
                await missions.notifyCompletedMissions(message, completedMissions);
            }
        } catch (error) {
            console.error('❌ Error actualizando misiones:', error);
        }

        if (message.mentions.users.size > 0) {
            try {
                const mentionsCount = message.mentions.users.size;
                const completedMissions = await missions.updateMissionProgress(userId, 'mention_made', mentionsCount);
                if (completedMissions.length > 0) {
                    await missions.notifyCompletedMissions(message, completedMissions);
                }
            } catch (error) {
                console.error('❌ Error procesando menciones para misiones:', error);
            }
        }
    }

    // Procesar comandos de logros
    await achievements.processCommand(message);

    // Procesar comandos de misiones
    await missions.processCommand(message);

    // Procesar comandos mejorados (shop, betting, etc.)
    await allCommands.processCommand(message);

    // Procesar comandos de tienda
    await shop.processCommand(message);
   
    //Procesar comandos de minijuegos
    await minigames.processCommand(message);
    
    // Luego procesar comandos normales (como !contadores, !reset, etc.)
    await commandHandler.processCommand(message);
});

// Manejo de errores
client.on('error', (error) => {
    console.error('❌ Error del cliente:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled promise rejection:', error);
});

// Proceso de cierre limpio
process.on('SIGINT', () => {
    console.log('\n🔄 Cerrando bot...');
    saveCounters(counters);
    client.destroy();
    process.exit(0);
});

// Iniciar el bot
client.login(process.env.TOKEN).then(() => {
    console.log('🚀 Proceso de login iniciado...');
}).catch(error => {
    console.error('❌ Error en el login:', error);


});


