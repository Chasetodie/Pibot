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
    `);
});

// Ruta para verificar el estado (útil para UptimeRobot)
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        counters: counters
    });
});

// Iniciar servidor web
app.listen(PORT, () => {
    console.log(`🌐 Servidor web corriendo en puerto ${PORT}`);
    console.log(`📡 URL del bot: https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:8080'}`);
});

// Configuración del bot de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

// Archivo para guardar los contadores
const countersFile = path.join(__dirname, 'counters.json');

// Función para cargar contadores
function loadCounters() {
    try {
        if (fs.existsSync(countersFile)) {
            const data = fs.readFileSync(countersFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error cargando contadores:', error);
    }
    return { pibe: 0, piba: 0 };
}

// Función para guardar contadores
function saveCounters(counters) {
    try {
        fs.writeFileSync(countersFile, JSON.stringify(counters, null, 2));
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

// Comando para verificar contadores (opcional, para administradores)
client.on('messageCreate', async (message) => {
    if (message.content === '!contadores' && message.member?.permissions.has('Administrator')) {
        const embed = new EmbedBuilder()
            .setTitle('Contadores Actuales')
            .addFields(
                { name: '🔵 Pibes', value: counters.pibe.toString(), inline: true },
                { name: '🔴 Pibas', value: counters.piba.toString(), inline: true }
            )
            .setColor('#5865F2');
        
        await message.reply({ embeds: [embed] });
    }
    
    // Comando para resetear contadores (solo administradores)
    if (message.content.startsWith('!reset') && message.member?.permissions.has('Administrator')) {
        const args = message.content.split(' ');
        if (args.length === 3) {
            const pibeCount = parseInt(args[1]);
            const pibaCount = parseInt(args[2]);
            
            if (!isNaN(pibeCount) && !isNaN(pibaCount)) {
                counters.pibe = pibeCount;
                counters.piba = pibaCount;
                saveCounters(counters);
                
                await message.reply(`✅ Contadores actualizados: Pibe ${pibeCount}, Piba ${pibaCount}`);
            }
        } else {
            await message.reply('Uso: `!reset <numero_pibes> <numero_pibas>`');
        }
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
