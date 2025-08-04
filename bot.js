const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Configuración del servidor web para mantener activo el bot
const app = express();
const PORT = process.env.PORT || 3000;

// Ruta principal para verificar que el bot está funcionando
app.get('/', (req, res) => {
    res.send(`
        <h1>🤖 Bot Pibe/Piba está funcionando!</h1>
        <p>Estado: <strong style="color: green;">ONLINE</strong></p>
        <p>Última verificación: ${new Date().toLocaleString()}</p>
        <p>Contadores actuales: Pibe ${counters.pibe}, Piba ${counters.piba}</p>
        <hr>
        <h3>⚙️ Configuración:</h3>
        <p>Pibe inicial: ${process.env.PIBE_COUNT || 0}</p>
        <p>Piba inicial: ${process.env.PIBA_COUNT || 0}</p>
    `);
});

// Ruta para verificar el estado (útil para monitoreo)
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

// Ruta para resetear contadores (método alternativo)
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
    console.log(`🌐 Servidor web corriendo en puerto ${PORT}`);
    console.log(`📡 URL del bot: ${process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${PORT}`}`);
});

// Configuración del bot de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Archivo para guardar los contadores
const countersFile = path.join(__dirname, 'counters.json');

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

// Evento cuando el bot está listo
client.once('ready', () => {
    console.log(`🤖 Bot conectado como ${client.user.tag}`);
    console.log(`📊 Contadores actuales: Pibe ${counters.pibe}, Piba ${counters.piba}`);
    console.log(`⚙️ Variables de entorno: PIBE_COUNT=${process.env.PIBE_COUNT || 'no definida'}, PIBA_COUNT=${process.env.PIBA_COUNT || 'no definida'}`);
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
                console.log(`📉 Contador de pibes reducido a: ${counters.pibe}`);
            }
        } else if (pibaMatch) {
            // Era una piba, restar del contador
            const numero = parseInt(pibaMatch[1]);
            if (numero === counters.piba) {
                // Era la última piba, reducir contador
                counters.piba--;
                saveCounters(counters);
                console.log(`📉 Contador de pibas reducido a: ${counters.piba}`);
            }
        }
        
    } catch (error) {
        console.error('Error procesando salida de miembro:', error);
    }
});

// Evento cuando un nuevo miembro se une al servidor
client.on('guildMemberAdd', async (member) => {
    try {
        console.log(`🎉 Nuevo miembro: ${member.user.tag}`);
        
        // Crear el embed para el mensaje directo
        const embed = new EmbedBuilder()
            .setTitle('¡Bienvenido/a al servidor! 🎉')
            .setDescription('Por favor selecciona tu categoría para asignarte un apodo:')
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

        console.log(`📨 Mensaje directo enviado a ${member.user.tag}`);
        
    } catch (error) {
        console.error('Error enviando mensaje directo:', error);
        
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
            }
        } catch (channelError) {
            console.error('Error enviando mensaje en canal:', channelError);
        }
    }
});

// Evento para manejar interacciones con botones
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

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
                    content: '❌ No pude encontrarte en ningún servidor. Asegúrate de estar en el servidor antes de usar los botones.',
                    flags: 64 // ephemeral
                });
                return;
            }
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
                .setTitle('¡Apodo asignado! ✅')
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
                .setTitle('¡Apodo asignado! ✅')
                .setDescription(`Tu apodo ha sido cambiado a: **${nickname}**`)
                .setColor('#FF69B4')
                .setFooter({ text: '¡Bienvenida al servidor!' });
            
            await interaction.reply({
                embeds: [successEmbed],
                flags: 64 // ephemeral
            });
            
            console.log(`✅ ${interaction.user.tag} eligió Piba y ahora es ${nickname}`);
        }
        
    } catch (error) {
        console.error('Error procesando selección:', error);
        
        try {
            await interaction.reply({
                content: '❌ Hubo un error al asignar tu apodo. Por favor contacta a un administrador.',
                flags: 64 // ephemeral
            });
        } catch (replyError) {
            console.error('Error enviando mensaje de error:', replyError);
        }
    }
});

// Comandos de Discord (mantienen funcionalidad)
client.on('messageCreate', async (message) => {
    // Comando para verificar contadores
    if (message.content === '!contadores' && message.member?.permissions.has('Administrator')) {
        const embed = new EmbedBuilder()
            .setTitle('Contadores Actuales')
            .addFields(
                { name: '🔵 Pibes', value: counters.pibe.toString(), inline: true },
                { name: '🔴 Pibas', value: counters.piba.toString(), inline: true }
            )
            .setColor('#5865F2')
            .setFooter({ text: 'También puedes cambiar contadores desde variables de entorno' });
        
        await message.reply({ embeds: [embed] });
    }
    
    // Comando para resetear contadores
    if (message.content.startsWith('!reset') && message.member?.permissions.has('Administrator')) {
        const args = message.content.split(' ');
        if (args.length === 3) {
            const pibeCount = parseInt(args[1]);
            const pibaCount = parseInt(args[2]);
            
            if (!isNaN(pibeCount) && !isNaN(pibaCount) && pibeCount >= 0 && pibaCount >= 0) {
                counters.pibe = pibeCount;
                counters.piba = pibaCount;
                saveCounters(counters);
                
                await message.reply(`✅ Contadores actualizados: Pibe ${pibeCount}, Piba ${pibaCount}`);
            } else {
                await message.reply('❌ Números inválidos. Usa números positivos: `!reset 18 5`');
            }
        } else {
            await message.reply('Uso: `!reset <numero_pibes> <numero_pibas>`\nEjemplo: `!reset 18 5`');
        }
    }

    // Comando para reiniciar desde variables de entorno
    if (message.content === '!reload' && message.member?.permissions.has('Administrator')) {
        const pibeFromEnv = parseInt(process.env.PIBE_COUNT) || 0;
        const pibaFromEnv = parseInt(process.env.PIBA_COUNT) || 0;
        
        counters.pibe = pibeFromEnv;
        counters.piba = pibaFromEnv;
        saveCounters(counters);
        
        await message.reply(`🔄 Contadores recargados desde variables de entorno: Pibe ${pibeFromEnv}, Piba ${pibaFromEnv}`);
    }
});

// Manejo de errores
client.on('error', (error) => {
    console.error('Error del cliente:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Iniciar el bot
client.login(process.env.TOKEN);
