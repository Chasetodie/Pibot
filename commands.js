const { EmbedBuilder } = require('discord.js');

class CommandHandler {
    constructor(counters, saveCountersFunction) {
        this.counters = counters;
        this.saveCounters = saveCountersFunction;
    }

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

    // Comando de ayuda
    async handleHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Comandos Disponibles')
            .setDescription('Lista de comandos del bot (solo administradores)')
            .addFields(
                { name: '!contadores', value: 'Muestra los contadores actuales', inline: false },
                { name: '!reset <pibes> <pibas>', value: 'Actualiza los contadores manualmente', inline: false },
                { name: '!reload', value: 'Recarga contadores desde variables de entorno', inline: false },
                { name: '!help', value: 'Muestra esta lista de comandos', inline: false }
            )
            .setColor('#FF6B6B')
            .setTimestamp()
            .setFooter({ text: 'Solo usuarios con permisos de administrador pueden usar estos comandos' });
        
        await message.reply({ embeds: [embed] });
    }

    // Procesador principal de comandos
    async processCommand(message) {
        // Ignorar mensajes de bots
        if (message.author.bot) return;

        const command = message.content.toLowerCase().split(' ')[0];

        try {
            switch (command) {
                case '!contadores':
                    await this.handleContadores(message);
                    break;
                case '!reset':
                    await this.handleReset(message);
                    break;
                case '!reload':
                    await this.handleReload(message);
                    break;
                case '!help':
                case '!ayuda':
                    await this.handleHelp(message);
                    break;
                default:
                    // No hacer nada si no es un comando reconocido
                    break;
            }
        } catch (error) {
            console.error('Error procesando comando:', error);
            await message.reply('❌ Ocurrió un error al procesar el comando. Intenta de nuevo.');
        }
    }
}

module.exports = CommandHandler;