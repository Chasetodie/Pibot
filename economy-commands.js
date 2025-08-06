const { EmbedBuilder } = require('discord.js');

class EconomyCommands {
    constructor(economySystem) {
        this.economy = economySystem;
    }

    // Formatear tiempo restante para daily
    formatTimeLeft(milliseconds) {
        const hours = Math.floor(milliseconds / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    // Formatear números con comas
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    // Crear barra de progreso visual
    createProgressBar(current, max, length = 10) {
        const percentage = Math.max(0, Math.min(1, current / max));
        const filledLength = Math.floor(percentage * length);
        const emptyLength = length - filledLength;
        
        const filledChar = '█';
        const emptyChar = '░';
        
        return filledChar.repeat(filledLength) + emptyChar.repeat(emptyLength);
    }

    // Comando !balance - Ver dinero y nivel del usuario
    async handleBalance(message, targetUser = null) {
        const userId = targetUser ? targetUser.id : message.author.id;
        const displayName = targetUser ? targetUser.displayName : message.author.displayName;
        const user = this.economy.getUser(userId);
        
        // Calcular información de nivel
        const xpForNextLevel = this.economy.getXpForLevel(user.level + 1);
        const xpForCurrentLevel = this.economy.getXpForLevel(user.level);
        const totalXpForCurrent = this.economy.getXpNeededForLevel(user.level);
        const xpProgress = user.totalXp - totalXpForCurrent;
        const xpNeeded = xpForNextLevel - xpProgress;
        
        // Crear barra de progreso
        const progressBar = this.createProgressBar(xpProgress, xpForNextLevel, 15);
        const progressPercentage = ((xpProgress / xpForNextLevel) * 100).toFixed(1);

        const embed = new EmbedBuilder()
            .setTitle(`💰 ${displayName}`)
            .setColor('#FFD700')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields(
                { 
                    name: `${this.economy.config.currencySymbol} Clarence Dolars`, 
                    value: `**${this.formatNumber(user.balance)}**`, 
                    inline: true 
                },
                { 
                    name: '📊 Nivel', 
                    value: `**${user.level}**`, 
                    inline: true 
                },
                { 
                    name: '⭐ XP Total', 
                    value: `**${this.formatNumber(user.totalXp)}**`, 
                    inline: true 
                },
                { 
                    name: '📈 Progreso al Siguiente Nivel', 
                    value: `\`${progressBar}\` ${progressPercentage}%\n**${this.formatNumber(xpProgress)}** / **${this.formatNumber(xpForNextLevel)}** XP\n*Faltan ${this.formatNumber(xpNeeded)} XP*`, 
                    inline: false 
                },
                { 
                    name: '💬 Mensajes Enviados', 
                    value: `${this.formatNumber(user.messagesCount)}`, 
                    inline: true 
                },
                { 
                    name: '📥 Total Ganado', 
                    value: `${this.formatNumber(user.stats.totalEarned)} ${this.economy.config.currencySymbol}`, 
                    inline: true 
                },
                { 
                    name: '📤 Total Gastado', 
                    value: `${this.formatNumber(user.stats.totalSpent)} ${this.economy.config.currencySymbol}`, 
                    inline: true 
                }
            )
            .setFooter({ text: `ID: ${userId}` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    // Comando !daily - Reclamar dinero diario
    async handleDaily(message) {
        const userId = message.author.id;
        const result = this.economy.useDaily(userId);
        
        if (!result.success) {
            const timeLeft = this.formatTimeLeft(result.timeLeft);
            
            const embed = new EmbedBuilder()
                .setTitle('⏰ Daily ya reclamado')
                .setDescription(`Ya reclamaste tu daily hoy!`)
                .addFields({
                    name: '🕐 Tiempo restante',
                    value: `**${timeLeft}**`,
                    inline: false
                })
                .setColor('#FF6B6B')
                .setFooter({ text: 'Vuelve mañana para más Clarence Dolars!' });
            
            await message.reply({ embeds: [embed] });
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🎁 Daily Reclamado!')
            .setDescription(`¡Has reclamado tu recompensa diaria!`)
            .addFields(
                {
                    name: '💰 Ganaste',
                    value: `**+${this.formatNumber(result.amount)}** ${this.economy.config.currencySymbol}`,
                    inline: true
                },
                {
                    name: '💳 Balance Total',
                    value: `**${this.formatNumber(result.newBalance)}** ${this.economy.config.currencySymbol}`,
                    inline: true
                }
            )
            .setColor('#00FF00')
            .setFooter({ text: 'Vuelve mañana por más!' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }

    // Comando !level - Ver información detallada de nivel
    async handleLevel(message, targetUser = null) {
        const userId = targetUser ? targetUser.id : message.author.id;
        const displayName = targetUser ? targetUser.displayName : message.author.displayName;
        const user = this.economy.getUser(userId);
        
        // Calcular ranking de nivel
        const leaderboard = this.economy.getLevelLeaderboard(1000);
        const userRank = leaderboard.findIndex(u => u.userId === userId) + 1;
        
        // Información de XP
        const xpForNextLevel = this.economy.getXpForLevel(user.level + 1);
        const totalXpForCurrent = this.economy.getXpNeededForLevel(user.level);
        const xpProgress = user.totalXp - totalXpForCurrent;
        const xpNeeded = xpForNextLevel - xpProgress;
        
        // Barra de progreso más detallada
        const progressBar = this.createProgressBar(xpProgress, xpForNextLevel, 20);
        const progressPercentage = ((xpProgress / xpForNextLevel) * 100).toFixed(2);
        
        const embed = new EmbedBuilder()
            .setTitle(`📊 Estadísticas de Nivel - ${displayName}`)
            .setColor('#9932CC')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields(
                { 
                    name: '🏆 Nivel Actual', 
                    value: `**${user.level}**`, 
                    inline: true 
                },
                { 
                    name: '🎯 Ranking', 
                    value: `**#${userRank}**`, 
                    inline: true 
                },
                { 
                    name: '⭐ XP Total', 
                    value: `**${this.formatNumber(user.totalXp)}**`, 
                    inline: true 
                },
                { 
                    name: '📈 Progreso Detallado', 
                    value: `\`${progressBar}\`\n**${progressPercentage}%** completado\n\n**Actual:** ${this.formatNumber(xpProgress)} XP\n**Necesaria:** ${this.formatNumber(xpForNextLevel)} XP\n**Restante:** ${this.formatNumber(xpNeeded)} XP`, 
                    inline: false 
                },
                { 
                    name: '💬 Mensajes', 
                    value: `${this.formatNumber(user.messagesCount)}`, 
                    inline: true 
                },
                { 
                    name: '💰 Ganado por Niveles', 
                    value: `${this.formatNumber((user.level - 1) * this.economy.config.levelUpReward)} ${this.economy.config.currencySymbol}`, 
                    inline: true 
                },
                { 
                    name: '⚡ XP por Mensaje', 
                    value: `${this.economy.config.xpPerMessage}±${this.economy.config.xpVariation}`, 
                    inline: true 
                }
            )
            .setFooter({ text: `Cooldown de XP: ${this.economy.config.xpCooldown / 1000}s` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    // Comando !pay - Transferir dinero a otro usuario
    async handlePay(message) {
        const args = message.content.split(' ');
        
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('💸 Comando Pay')
                .setDescription('Transfiere Clarence Dolars a otro usuario')
                .addFields({
                    name: '📝 Uso',
                    value: '`mon!pay @usuario <cantidad>`',
                    inline: false
                }, {
                    name: '💡 Ejemplo',
                    value: '`mon!pay @usuario 500`',
                    inline: false
                })
                .setColor('#17a2b8');
            
            await message.reply({ embeds: [embed] });
            return;
        }
        
        // Obtener usuario mencionado
        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            await message.reply('❌ Debes mencionar a un usuario válido.');
            return;
        }
        
        if (targetUser.id === message.author.id) {
            await message.reply('❌ No puedes transferirte dinero a ti mismo.');
            return;
        }
        
        if (targetUser.bot) {
            await message.reply('❌ No puedes transferir dinero a bots.');
            return;
        }
        
        // Obtener cantidad
        const amount = parseInt(args[2]);
        if (isNaN(amount) || amount <= 0) {
            await message.reply('❌ La cantidad debe ser un número positivo.');
            return;
        }
        
        if (amount < 10) {
            await message.reply('❌ La cantidad mínima a transferir es 10 Clarence Dolars.');
            return;
        }
        
        // Realizar transferencia
        const result = this.economy.transferMoney(message.author.id, targetUser.id, amount);
        
        if (!result.success) {
            if (result.reason === 'insufficient_funds') {
                const userBalance = this.economy.getUser(message.author.id).balance;
                const embed = new EmbedBuilder()
                    .setTitle('❌ Fondos Insuficientes')
                    .setDescription(`No tienes suficientes Clarence Dolars`)
                    .addFields(
                        { name: '💰 Tu Balance', value: `${this.formatNumber(userBalance)} ${this.economy.config.currencySymbol}`, inline: true },
                        { name: '💸 Intentaste Enviar', value: `${this.formatNumber(amount)} ${this.economy.config.currencySymbol}`, inline: true },
                        { name: '❌ Te Faltan', value: `${this.formatNumber(amount - userBalance)} ${this.economy.config.currencySymbol}`, inline: true }
                    )
                    .setColor('#FF6B6B');
                
                await message.reply({ embeds: [embed] });
                return;
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Transferencia Exitosa')
            .setDescription(`Has enviado **${this.formatNumber(amount)}** ${this.economy.config.currencySymbol} a ${targetUser}`)
            .addFields(
                { name: '💰 Tu Nuevo Balance', value: `${this.formatNumber(result.fromBalance)} ${this.economy.config.currencySymbol}`, inline: true },
                { name: '💰 Balance de Destino', value: `${this.formatNumber(result.toBalance)} ${this.economy.config.currencySymbol}`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }

    // Comando !top - Leaderboards
    async handleTop(message) {
        const args = message.content.split(' ');
        const type = args[1]?.toLowerCase() || 'money';
        
        let leaderboard, title, emoji;
        
        if (type === 'level' || type === 'levels' || type === 'lvl') {
            leaderboard = this.economy.getLevelLeaderboard(10);
            title = '🏆 Top 10 - Niveles';
            emoji = '📊';
        } else {
            leaderboard = this.economy.getMoneyLeaderboard(10);
            title = '🏆 Top 10 - Clarence Dolars';
            emoji = '💰';
        }
        
        if (leaderboard.length === 0) {
            await message.reply('❌ No hay usuarios en el leaderboard todavía.');
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor('#FFD700')
            .setTimestamp();
        
        let description = '';
        
        for (let i = 0; i < leaderboard.length; i++) {
            const user = leaderboard[i];
            let medal = '';
            
            switch (i) {
                case 0: medal = '🥇'; break;
                case 1: medal = '🥈'; break;
                case 2: medal = '🥉'; break;
                default: medal = `**${i + 1}.**`; break;
            }
            
            let value;
            if (type === 'level' || type === 'levels' || type === 'lvl') {
                value = `Nivel ${user.level} (${this.formatNumber(user.totalXp)} XP)`;
            } else {
                value = `${this.formatNumber(user.balance)} ${this.economy.config.currencySymbol}`;
            }
            
            description += `${medal} <@${user.userId}>\n${emoji} ${value}\n\n`;
        }
        
        embed.setDescription(description);
        
        if (type === 'level' || type === 'levels' || type === 'lvl') {
            embed.setFooter({ text: 'Usa !top money para ver el ranking de dinero' });
        } else {
            embed.setFooter({ text: 'Usa !top level para ver el ranking de niveles' });
        }
        
        await message.reply({ embeds: [embed] });
    }

    // Comando !work - Sistema de trabajos
    async handleWork(message) {
        const args = message.content.split(' ');
        const jobType = args[1]?.toLowerCase();
        
        const jobs = this.economy.getWorkJobs();
        
        // Si no especificó trabajo, mostrar lista
        if (!jobType) {
            const user = this.economy.getUser(message.author.id);
            
            const embed = new EmbedBuilder()
                .setTitle('🛠️ Trabajos Disponibles')
                .setDescription('Elige un trabajo para ganar Clarence Dolars')
                .setColor('#28a745');
            
            for (const [key, job] of Object.entries(jobs)) {
                const cooldownHours = job.cooldown / (60 * 60 * 1000);
                const cooldownText = cooldownHours >= 1 ? `${cooldownHours}h` : `${job.cooldown / (60 * 1000)}m`;
                
                const available = user.level >= job.levelRequirement ? '✅' : '🔒';
                const levelText = user.level >= job.levelRequirement ? '' : `\n*Requiere Nivel ${job.levelRequirement}*`;
                
                embed.addFields({
                    name: `${available} ${job.name}`,
                    value: `**Pago:** ${job.baseReward}±${job.variation} C$\n**Cooldown:** ${cooldownText}${levelText}${job.failChance ? `\n**Riesgo:** ${(job.failChance * 100)}% de fallar` : ''}`,
                    inline: true
                });
            }
            
            embed.addFields({
                name: '💡 Uso',
                value: '`!work <tipo>`\nEjemplo: `!work delivery`',
                inline: false
            });
            
            await message.reply({ embeds: [embed] });
            return;
        }
        
        // Verificar si el trabajo existe
        if (!jobs[jobType]) {
            const availableJobs = Object.keys(jobs).join(', ');
            await message.reply(`❌ Trabajo no válido. Trabajos disponibles: ${availableJobs}`);
            return;
        }
        
        // Intentar trabajar
        const result = this.economy.doWork(message.author.id, jobType);
        
        if (!result.canWork) {
            if (result.reason === 'level_too_low') {
                const embed = new EmbedBuilder()
                    .setTitle('🔒 Nivel Insuficiente')
                    .setDescription(`Necesitas ser **Nivel ${result.requiredLevel}** para este trabajo`)
                    .addFields({
                        name: '📊 Tu Nivel Actual',
                        value: `**${this.economy.getUser(message.author.id).level}**`,
                        inline: true
                    })
                    .setColor('#dc3545');
                
                await message.reply({ embeds: [embed] });
                return;
            }
            
            if (result.reason === 'cooldown') {
                const timeLeft = this.formatTimeLeft(result.timeLeft);
                const job = jobs[jobType];
                
                const embed = new EmbedBuilder()
                    .setTitle('⏰ En Cooldown')
                    .setDescription(`Ya trabajaste como **${job.name}** recientemente`)
                    .addFields({
                        name: '🕐 Tiempo restante',
                        value: `**${timeLeft}**`,
                        inline: true
                    })
                    .setColor('#ffc107');
                
                await message.reply({ embeds: [embed] });
                return;
            }
            
            await message.reply('❌ No puedes trabajar en este momento.');
            return;
        }
        
        // Trabajo falló
        if (result.failed) {
            const embed = new EmbedBuilder()
                .setTitle('💥 ¡El trabajo salió mal!')
                .setDescription(`**${jobs[jobType].name}**\n\n${result.message}`)
                .addFields(
                    { name: '💸 Perdiste', value: `${this.formatNumber(result.penalty)} C$`, inline: true },
                    { name: '💰 Balance Actual', value: `${this.formatNumber(result.newBalance)} C$`, inline: true }
                )
                .setColor('#dc3545')
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
            return;
        }
        
        // Trabajo exitoso
        const embed = new EmbedBuilder()
            .setTitle('✅ ¡Trabajo Completado!')
            .setDescription(`**${result.jobName}**\n\n${result.message}`)
            .addFields(
                { name: '💰 Ganaste', value: `+${this.formatNumber(result.amount)} C$`, inline: true },
                { name: '💳 Balance Total', value: `${this.formatNumber(result.newBalance)} C$`, inline: true }
            )
            .setColor('#28a745')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }

    // Comando !ecohelp - Ayuda de comandos de economía
    async handleEcoHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Comandos de Economía')
            .setDescription(`Sistema de **${this.economy.config.currency}** y Niveles`)
            .setColor('#17a2b8')
            .addFields(
                { name: '💰 mon!balance [@usuario]', value: 'Ver tu dinero y nivel (o el de otro usuario)', inline: false },
                { name: '🎁 mon!daily', value: `Reclamar ${this.economy.config.dailyAmount}±${this.economy.config.dailyVariation} ${this.economy.config.currencySymbol} diarios`, inline: false },
                { name: '🛠️ mon!work [tipo]', value: 'Trabajar para ganar dinero (delivery, programmer, doctor, criminal)', inline: false },
                { name: '📊 mon!level [@usuario]', value: 'Ver información detallada de nivel', inline: false },
                { name: '💸 mon!pay @usuario <cantidad>', value: 'Transferir dinero a otro usuario', inline: false },
                { name: '🏆 mon!top [money/level]', value: 'Ver los rankings del servidor', inline: false },
                { name: '📈 Sistema de XP', value: `Ganas ${this.economy.config.xpPerMessage}±${this.economy.config.xpVariation} XP por mensaje\nCada nivel te da ${this.economy.config.levelUpReward} ${this.economy.config.currencySymbol}`, inline: false }
            )
            .setFooter({ text: 'Próximamente: minijuegos, apuestas, tienda y más!' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    // Procesador principal de comandos de economía
    async processCommand(message) {
        // Ignorar mensajes de bots
        if (message.author.bot) return;

        const command = message.content.toLowerCase().split(' ')[0];

        try {
            switch (command) {
                case 'mon!balance':
                case 'mon!bal':
                case 'mon!money':
                    const targetUser = message.mentions.members.first();
                    await this.handleBalance(message, targetUser);
                    break;

                case 'mon!daily':
                    await this.handleDaily(message);
                    break;

                case 'mon!level':
                case 'mon!lvl':
                case 'mon!rank':
                    const levelTargetUser = message.mentions.members.first();
                    await this.handleLevel(message, levelTargetUser);
                    break;

                case 'mon!pay':
                case 'mon!transfer':
                    await this.handlePay(message);
                    break;

                case 'mon!top':
                case 'mon!leaderboard':
                case 'mon!lb':
                    await this.handleTop(message);
                    break;

                case 'mon!work':
                case 'mon!job':
                    await this.handleWork(message);
                    break;

                case 'mon!ecohelp':
                case 'mon!economyhelp':
                    await this.handleEcoHelp(message);
                    break;

                default:
                    // No es un comando de economía
                    break;
            }
        } catch (error) {
            console.error('❌ Error procesando comando de economía:', error);
            await message.reply('❌ Ocurrió un error al procesar el comando. Intenta de nuevo.');
        }
    }
}

module.exports = EconomyCommands;