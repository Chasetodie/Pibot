const { EmbedBuilder } = require('discord.js');

class CommandHandler {
    // Comando para verificar contadores
    async handleContadores(message) {
        if (!message.member?.permissions.has('Administrator')) {
            await message.reply('❌ No tienes permisos de administrador para usar este comando.');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🔢 Contadores Actuales')
            .addFields(
                { name: '🔵 Pibes', value: this.counters.pibe.toString(), inline: true },
                { name: '🔴 Pibas', value: this.counters.piba.toString(), inline: true },
                { name: '📊 Total', value: (this.counters.pibe + this.counters.piba).toString(), inline: true }
            )
            .setColor('#5865F2')
            .setTimestamp()
            .setFooter({ text: 'También puedes cambiar contadores desde variables de entorno' });
        
        await message.reply({ embeds: [embed] });
    }

    // Comando para resetear contadores
    async handleReset(message) {
        if (!message.member?.permissions.has('Administrator')) {
            await message.reply('❌ No tienes permisos de administrador para usar este comando.');
            return;
        }

        const args = message.content.split(' ');
        
        if (args.length === 3) {
            const pibeCount = parseInt(args[1]);
            const pibaCount = parseInt(args[2]);
            
            if (!isNaN(pibeCount) && !isNaN(pibaCount) && pibeCount >= 0 && pibaCount >= 0) {
                this.counters.pibe = pibeCount;
                this.counters.piba = pibaCount;
                this.saveCounters(this.counters);
                
                const embed = new EmbedBuilder()
                    .setTitle('✅ Contadores Actualizados')
                    .addFields(
                        { name: '🔵 Pibes', value: pibeCount.toString(), inline: true },
                        { name: '🔴 Pibas', value: pibaCount.toString(), inline: true }
                    )
                    .setColor('#00FF00')
                    .setTimestamp();
                
                await message.reply({ embeds: [embed] });
            } else {
                await message.reply('❌ Números inválidos. Usa números positivos: `!reset 18 5`');
            }
        } else {
            const embed = new EmbedBuilder()
                .setTitle('ℹ️ Uso del comando !reset')
                .setDescription('`!reset <numero_pibes> <numero_pibas>`')
                .addFields(
                    { name: 'Ejemplo', value: '`!reset 18 5`' }
                )
                .setColor('#FFFF00');
            
            await message.reply({ embeds: [embed] });
        }
    }

    // Comando para recargar desde variables de entorno
    async handleReload(message) {
        if (!message.member?.permissions.has('Administrator')) {
            await message.reply('❌ No tienes permisos de administrador para usar este comando.');
            return;
        }

        const pibeFromEnv = parseInt(process.env.PIBE_COUNT) || 0;
        const pibaFromEnv = parseInt(process.env.PIBA_COUNT) || 0;
        
        this.counters.pibe = pibeFromEnv;
        this.counters.piba = pibaFromEnv;
        this.saveCounters(this.counters);
        
        const embed = new EmbedBuilder()
            .setTitle('🔄 Contadores Recargados')
            .setDescription('Contadores actualizados desde variables de entorno')
            .addFields(
                { name: '🔵 Pibes', value: pibeFromEnv.toString(), inline: true },
                { name: '🔴 Pibas', value: pibaFromEnv.toString(), inline: true }
            )
            .setColor('#00FFFF')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }

    async handleClear(message) {
        if (!await this.checkAdminPerms(message)) {
            await message.reply('❌ No tienes permisos de administrador para usar este comando.');
            return;
        }

        const args = message.content.split(' ');
        const amount = parseInt(args[1]);

        if (isNaN(amount) || amount < 1 || amount > 1000) {
            await message.reply('❌ Especifica un número válido entre 1 y 1000. Ejemplo: `>clear 50`');
            return;
        }

        // Borrar el mensaje del comando
        await message.delete().catch(() => {});

        const statusMsg = await message.channel.send(`⏳ Borrando ${amount} mensajes...`);

        try {
            let totalDeleted = 0;
            let remaining = amount;
            const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

            while (remaining > 0) {
                const fetchLimit = Math.min(remaining, 100);
                const fetched = await message.channel.messages.fetch({ limit: fetchLimit });
                
                if (fetched.size === 0) break;

                // Separar mensajes nuevos (bulkDelete) y viejos (uno a uno)
                const recent = fetched.filter(m => m.id !== statusMsg.id && m.createdTimestamp > fourteenDaysAgo);
                const old = fetched.filter(m => m.id !== statusMsg.id && m.createdTimestamp <= fourteenDaysAgo);

                // Borrar mensajes recientes en bulk
                if (recent.size > 0) {
                    const bulkChunks = [...recent.values()];
                    // bulkDelete requiere mínimo 2 mensajes o exactamente 1
                    if (bulkChunks.length === 1) {
                        await bulkChunks[0].delete().catch(() => {});
                        totalDeleted++;
                    } else {
                        await message.channel.bulkDelete(recent, true).catch(() => {});
                        totalDeleted += recent.size;
                    }
                }

                // Borrar mensajes viejos uno a uno
                for (const oldMsg of old.values()) {
                    await oldMsg.delete().catch(() => {});
                    totalDeleted++;
                    await new Promise(r => setTimeout(r, 500)); // Rate limit
                }

                remaining -= fetched.size;
                if (fetched.size < fetchLimit) break; // No hay más mensajes
            }

            await statusMsg.edit(`✅ Se borraron **${totalDeleted}** mensajes.`);
            setTimeout(() => statusMsg.delete().catch(() => {}), 4000);

        } catch (error) {
            console.error('Error en clear:', error);
            await statusMsg.edit('❌ Ocurrió un error al borrar los mensajes.').catch(() => {});
        }
    } 

    // Comando de ayuda
    async handleHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Comandos Disponibles')
            .setDescription('Lista de comandos del bot (solo administradores)')
            .addFields(
                // Apodos
                { name: 'Comandos Para Los Apodos', value: '`>contadores` - Muestra los contadores actuales\n`>reset <pibes> <pibas>` - Actualiza los contadores manualmente\n`>reload` - Recarga contadores desde variables de entorno', inline: false },
                // Eventos
                { name: 'Eventos', value: '`>createevent <tipo> [duración]` - Crear evento manual\n`>eventstats` - Estadísticas de eventos', inline: false },
                // Logros
                { name: 'Logros', value: '`>detectall` - Detectar todos los logros desbloqueados', inline: false },               
                // Basicos
                { name: 'Basicos', value: '`>clear <cantidad>` - Borra la cantidad de mensajes indicada en el canal\n`>help-admin` - Muestra todos los comandos de Administrador', inline: false },
           )
            .setColor('#FF6B6B')
            .setTimestamp()
            .setFooter({ text: 'Solo usuarios con permisos de administrador pueden usar estos comandos' });
        
        await message.reply({ embeds: [embed] });
    }

    // Procesador principal de comandos
    async processCommand(message) {
        const command = message.content.toLowerCase().split(' ')[0];

/*const commandName = command.replace('>', '');
        await this.economy.missions.updateMissionProgress(message.author.id, 'unique_commands_used', commandName);*/

        try {
            switch (command) {
                case '>contadores':
                    await this.handleContadores(message);
                    break;
                case '>reset':
                    await this.handleReset(message);
                    break;
                case '>reload':
                    await this.handleReload(message);
                    break;
                case '>clear':
                    await this.handleClear(message);
                    break;
                case '>help-admin':
                    await this.handleHelp(message);
                    break;
                default:
                    // El Comando no Existe
                    break;
            }
        } catch (error) {
            console.error('Error procesando comando:', error);
            await message.reply('❌ Ocurrió un error al procesar el comando. Intenta de nuevo.');
        }
    }
}

module.exports = CommandHandler;
