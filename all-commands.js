const { EmbedBuilder } = require('discord.js');

class AllCommands {
    constructor(economySystem, achievementsSystem/*, shopSystem*/, bettingSystem/*, eventsSystem*/) {
        this.economy = economySystem;
        this.achievements = achievementsSystem;
/*        this.shop = shopSystem;*/
        this.betting = bettingSystem;
/*        this.events = eventsSystem;*/
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
    formatNumber(number) {
        if (number === undefined || number === null || isNaN(number)) {
            return "0"; // Valor por defecto
        }
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
        const user = await this.economy.getUser(userId);
        
        // Calcular información de nivel
        const xpForNextLevel = this.economy.getXpForLevel(user.level + 1);
        const xpForCurrentLevel = this.economy.getXpForLevel(user.level);
        const totalXpForCurrent = this.economy.getXpNeededForLevel(user.level);
        const xpProgress = user.totalXp - totalXpForCurrent;
        const xpNeeded = xpForNextLevel - xpProgress;
        
        // Crear barra de progreso
        const progressBar = this.createProgressBar(xpProgress, xpForNextLevel, 15);
        const progressPercentage = ((xpProgress / xpForNextLevel) * 100).toFixed(1);

        // Avatar
        const avatarUrl = targetUser ? targetUser.displayAvatarURL({ dynamic: true }) : message.author.displayAvatarURL({ dynamic: true });

        const embed = new EmbedBuilder()
            .setTitle(`💰 ${displayName}`)
            .setColor('#FFD700')
            .setThumbnail(avatarUrl)
            .addFields(
                { 
                    name: `π-b Coins`, 
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
        const result = await this.economy.useDaily(userId);
        
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
                .setFooter({ text: 'Vuelve mañana para más π-b Coins!' });

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
                    name: '💸 Balance Anterior',
                    value: `**${this.formatNumber(result.oldBalance)}** ${this.economy.config.currencySymbol}`,
                    inline: true
                },
                {
                    name: '💳 Balance Actual',
                    value: `**${this.formatNumber(result.newBalance)}** ${this.economy.config.currencySymbol}`,
                    inline: true
                }
            )
            .setColor('#00FF00')
            .setFooter({ text: 'Vuelve mañana por más!' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    
        // *** NUEVO: VERIFICAR ACHIEVEMENTS DESPUÉS DEL DAILY ***
        if (this.achievements) {
            try {
                const newAchievements = await this.achievements.checkAchievements(userId);
                if (newAchievements.length > 0) {
                    await this.achievements.notifyAchievements(message, newAchievements);
                }
            } catch (error) {
                console.error('❌ Error verificando logros después del daily:', error);
            }
        }
    }

    // Comando !level - Ver información detallada de nivel
    async handleLevel(message, targetUser = null) {
        const userId = targetUser ? targetUser.id : message.author.id;
        const displayName = targetUser ? targetUser.displayName : message.author.displayName;
        const user = await this.economy.getUser(userId);
        
        // Calcular ranking de nivel
        const leaderboard = await this.economy.getLevelLeaderboard(1000);
        const userRank = leaderboard.findIndex(u => u.userId === userId) + 1;
        
        // Información de XP
        const xpForNextLevel = this.economy.getXpForLevel(user.level + 1);
        const totalXpForCurrent = this.economy.getXpNeededForLevel(user.level);
        const xpProgress = user.totalXp - totalXpForCurrent;
        const xpNeeded = xpForNextLevel - xpProgress;
        
        // Barra de progreso más detallada
        const progressBar = this.createProgressBar(xpProgress, xpForNextLevel, 20);
        const progressPercentage = ((xpProgress / xpForNextLevel) * 100).toFixed(2);

        // Avatar
        const avatarUrl = targetUser ? targetUser.displayAvatarURL({ dynamic: true }) : message.author.displayAvatarURL({ dynamic: true });
        
        const embed = new EmbedBuilder()
            .setTitle(`📊 Estadísticas de Nivel - ${displayName}`)
            .setColor('#9932CC')
            .setThumbnail(avatarUrl)
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
                .setDescription('Transfiere π-b Coins a otro usuario')
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
            await message.reply('❌ La cantidad mínima a transferir es 10 π-b Coins.');
            return;
        }
        
        // Realizar transferencia
        const userBalance = await this.economy.getUser(message.author.id);
        const otherUserBalance = await this.economy.getUser(targetUser.id);
        const result = await this.economy.transferMoney(message.author.id, targetUser.id, amount);
        
        if (!result.success) {
            if (result.reason === 'insufficient_funds') {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Fondos Insuficientes')
                    .setDescription(`No tienes suficientes π-b Coins para transferir.`)
                    .addFields(
                        { name: '💰 Tu Balance', value: `${this.formatNumber(userBalance.balance)} ${this.economy.config.currencySymbol}`, inline: true },
                        { name: '💸 Intentaste Enviar', value: `${this.formatNumber(amount)} ${this.economy.config.currencySymbol}`, inline: true },
                        { name: '❌ Te Faltan', value: `${this.formatNumber(amount - userBalance.balance)} ${this.economy.config.currencySymbol}`, inline: true }
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
                { name: '💰 Balance Anterior', value: `${this.formatNumber(userBalance.balance)} ${this.economy.config.currencySymbol}`, inline: true },
                { name: '💰 Tu Balance Actual', value: `${this.formatNumber(result.fromBalance)} ${this.economy.config.currencySymbol}`, inline: true },
                { name: '💸 Dinero Enviado', value: `${this.formatNumber(amount)} ${this.economy.config.currencySymbol}`, inline: true },
                { name: '💰 Balance Anterior del Destinatario', value: `${this.formatNumber(otherUserBalance.balance)} ${this.economy.config.currencySymbol}`, inline: true },
                { name: '💰 Balance Actual del Destinatario', value: `${this.formatNumber(result.toBalance)} ${this.economy.config.currencySymbol}`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });

        // *** NUEVO: VERIFICAR ACHIEVEMENTS DESPUÉS DE TRANSFERIR ***
        if (this.achievements) {
            try {
                // Verificar logros para quien envía (por dinero dado)
                const senderAchievements = await this.achievements.checkAchievements(fromUserId);
                if (senderAchievements.length > 0) {
                    await this.achievements.notifyAchievements(message, senderAchievements);
                }

                // Verificar logros para quien recibe (por dinero ganado)
                const receiverAchievements = await this.achievements.checkAchievements(toUserId);
                if (receiverAchievements.length > 0) {
                    // Notificar en el mismo canal pero mencionando al receptor
                    for (const achievementId of receiverAchievements) {
                        const achievement = this.achievements.achievements[achievementId];
                        if (achievement) {
                            const rarityColor = this.achievements.rarityColors[achievement.rarity];
                            const rarityEmoji = this.achievements.rarityEmojis[achievement.rarity];
                            
                            const embed = new EmbedBuilder()
                                .setTitle('🎉 ¡Logro Desbloqueado!')
                                .setDescription(`${rarityEmoji} ${achievement.emoji} **${achievement.name}**\n\n*${achievement.description}*\n\n<@${toUserId}> desbloqueó este logro!`)
                                .setColor(rarityColor)
                                .addFields({
                                    name: '🎁 Recompensa',
                                    value: `${achievement.reward.money ? `+${this.achievements.formatNumber(achievement.reward.money)} π-b$` : ''}\n${achievement.reward.xp ? `+${this.achievements.formatNumber(achievement.reward.xp)} XP` : ''}`.trim(),
                                    inline: true
                                })
                                .setTimestamp();
                            
                            await message.channel.send({ embeds: [embed] });
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Error verificando logros después de la transferencia:', error);
            }
        }
    }

    // Comando !top - Leaderboards
    async handleTop(message) {
        const args = message.content.split(' ');
        const type = args[1]?.toLowerCase() || 'money';
        
        let leaderboard, title, emoji;
        
        if (type === 'level' || type === 'levels' || type === 'lvl') {
            leaderboard = await this.economy.getLevelLeaderboard(10);
            title = '🏆 Top 10 - Niveles';
            emoji = '📊';
        } else {
            leaderboard = await this.economy.getBalanceLeaderboard(10);
            title = '🏆 Top 10 - π-b Coin';
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
            embed.setFooter({ text: 'Usa mon!top money para ver el ranking de dinero' });
        } else {
            embed.setFooter({ text: 'Usa mon!top level para ver el ranking de niveles' });
        }
        
        await message.reply({ embeds: [embed] });
    }

    async handleAddMoney(message) {
        if (!message.member?.permissions.has('Administrator')) {
            await message.reply('❌ No tienes permisos de administrador para usar este comando.');
            return;
        }

        const args = message.content.split(' ');
        
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('💸 Comando Add')
                .setDescription('Da π-b Coins a otro usuario')
                .addFields({
                    name: '📝 Uso',
                    value: '`mon!addmoney @usuario <cantidad> <razon>`',
                    inline: false
                }, {
                    name: '💡 Ejemplo',
                    value: '`mon!addmoney @usuario 500 "Por ganar el concurso"`',
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
              
        if (targetUser.bot) {
            await message.reply('❌ No puedes dar dinero a bots.');
            return;
        }
        
        // Obtener cantidad
        const amount = parseInt(args[2]);
        if (isNaN(amount) || amount <= 0) {
            await message.reply('❌ La cantidad debe ser un número positivo.');
            return;
        }

        const reason = message.content.split(' ').slice(3).join(' ') || 'No Especificada';

        // Realizar transferencia
        const result = await this.economy.addMoney(targetUser.id, amount, reason);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Se ha Entregado Exitosamente el Dinero')
            .setDescription(`Has dado **${this.formatNumber(amount)}** ${this.economy.config.currencySymbol} a ${targetUser}\nRazón: ${reason}`)
            .addFields(
                { name: '💰 Balance de Destino', value: `${this.formatNumber(result)} ${this.economy.config.currencySymbol}`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }

    async handleRemoveMoney(message) {
        if (!message.member?.permissions.has('Administrator')) {
            await message.reply('❌ No tienes permisos de administrador para usar este comando.');
            return;
        }

        const args = message.content.split(' ');
        
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('💸 Comando Remove')
                .setDescription('Quita π-b Coins a otro usuario')
                .addFields({
                    name: '📝 Uso',
                    value: '`mon!removemoney @usuario <cantidad> <razon>`',
                    inline: false
                }, {
                    name: '💡 Ejemplo',
                    value: '`mon!removemoney @usuario 500 "Por mal comportamiento"`',
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
              
        if (targetUser.bot) {
            await message.reply('❌ No puedes quitar dinero a bots.');
            return;
        }
        
        // Obtener cantidad
        const amount = parseInt(args[2]);
        if (isNaN(amount) || amount <= 0) {
            await message.reply('❌ La cantidad debe ser un número positivo.');
            return;
        }

        const reason = message.content.split(' ').slice(3).join(' ') || 'No Especificada';        

        const result = await this.economy.removeMoney(targetUser.id, amount, reason);

        if( result === false ) 
        {
            await message.reply('❌ El usuario no tiene esa cantidad de dinero.');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('✅ Se ha Quitado Exitosamente el Dinero')
            .setDescription(`Has quitado **${this.formatNumber(amount)}** ${this.economy.config.currencySymbol} a ${targetUser}\nRazón: ${reason}`)
            .addFields(
                { name: '💰 Balance de Destino', value: `${this.formatNumber(result)} ${this.economy.config.currencySymbol}`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();
            
        await message.reply({ embeds: [embed] });      
    }

    async handleAddXp(message) {
        if (!message.member?.permissions.has('Administrator')) {
            await message.reply('❌ No tienes permisos de administrador para usar este comando.');
            return;
        }

        const args = message.content.split(' ');
        
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('💸 Comando AddXP')
                .setDescription('Añade Xp a otro usuario')
                .addFields({
                    name: '📝 Uso',
                    value: '`mon!addxp @usuario <cantidad> <razon>`',
                    inline: false
                }, {
                    name: '💡 Ejemplo',
                    value: '`mon!addxp @usuario 500 "Por ganar el concurso"`',
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
              
        if (targetUser.bot) {
            await message.reply('❌ No puedes dar dinero a bots.');
            return;
        }

        // Obtener cantidad
        const baseXP = parseInt(args[2]);
        if (isNaN(baseXP) || baseXP <= 0) {
            await message.reply('❌ La cantidad debe ser un número positivo.');
            return;
        }
        
        const reason = message.content.split(' ').slice(3).join(' ') || 'No Especificada';

        const xpResult = await this.economy.addXp(targetUser.id, baseXP, reason);

        const embed = new EmbedBuilder()
            .setTitle('✅ Se Aumentado Exitosamente el XP')
            .setDescription(`Has Aumentado **${this.formatNumber(baseXP)}** de XP a ${targetUser}\nRazón: ${reason}`)
            .addFields(
                { name: 'XP Total', value: `${this.formatNumber(xpResult.xpGained)}`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();
        await message.channel.send({ embeds: [embed] });

        // Si subió de nivel, notificar
        if (xpResult && xpResult.levelUp) {
            const levelUpEmbed = new EmbedBuilder()
                .setTitle('🎉 ¡Subiste de Nivel!')
                .setDescription(`${targetUser} alcanzó el **Nivel ${xpResult.newLevel}**`)
                .addFields(
                    { name: '📈 XP Ganada', value: `+${xpResult.xpGained} XP`, inline: true },
                    { name: '🎁 Recompensa', value: `+${xpResult.reward} π-b$`, inline: true },
                    { name: '🏆 Niveles Subidos', value: `${xpResult.levelsGained}`, inline: true }
                )
                .setColor('#FFD700')
                .setTimestamp();
            await message.channel.send({ embeds: [levelUpEmbed] });
        }
    }
    
    // Comando !work - Sistema de trabajos
    async handleWork(message) {
        const userId = message.author.id;
        const args = message.content.split(' ');
        const jobType = args[1]?.toLowerCase();
        
        const jobs = await this.economy.getWorkJobs();
        
        // Si no especificó trabajo, mostrar lista
        if (!jobType) {
            const user = await this.economy.getUser(message.author.id);
            
            const embed = new EmbedBuilder()
                .setTitle('🛠️ Trabajos Disponibles')
                .setDescription('Elige un trabajo para ganar π-b Coins')
                .setColor('#28a745');
            
            for (const [key, job] of Object.entries(jobs)) {
                const cooldownHours = job.cooldown / (60 * 60 * 1000);
                const cooldownText = cooldownHours >= 1 ? `${cooldownHours}h` : `${job.cooldown / (60 * 1000)}m`;
                
                const available = user.level >= job.levelRequirement ? '✅' : '🔒';
                const levelText = user.level >= job.levelRequirement ? '' : `\n*Requiere Nivel ${job.levelRequirement}*`;
                
                embed.addFields({
                    name: `${available} ${job.name}`,
                    value: `**Pago:** ${job.baseReward} - ${job.variation} π-b$\n**Cooldown:** ${cooldownText}${levelText}${job.failChance ? `\n**Riesgo:** ${(job.failChance * 100)}% de fallar` : ''}\n**Comando:** mon!work ${job.codeName}`,
                    inline: true
                });
            }
            
            embed.addFields({
                name: '💡 Uso',
                value: '`mon!work <tipo>`\nEjemplo: `mon!work delivery`',
                inline: false
            });
            
            await message.reply({ embeds: [embed] });
            return;
        }
        
        // Verificar si el trabajo existe
        if (!jobs[jobType]) {
            await message.reply('❌ Trabajo no válido.\nEscribe \`mon!work\` para ver los Trabajos Disponibles');
            return;
        }
        
        // Intentar trabajar
        const result = await this.economy.doWork(userId, jobType);

        console.log(`canWork: ${result.canWork}\nreason: ${result.reason}\nrequiredLevel: ${result.requiredLevel}\ncanWorkResult: ${result.canWorkResult}`);

        if (!result.canWork) {
            if (result.reason === 'level_too_low') {
                const userLevel = await this.economy.getUser(userId);
                const embed = new EmbedBuilder()
                    .setTitle('🔒 Nivel Insuficiente')
                    .setDescription(`Necesitas ser **Nivel ${result.requiredLevel}** para este trabajo`)
                    .addFields({
                        name: '📊 Tu Nivel Actual',
                        value: `**${userLevel.level}**`,
                        inline: true
                    })
                    .setColor('#dc3545');
                
                await message.reply({ embeds: [embed] });
                return;
            }
            
            if (result.reason === 'cooldown') {
                const timeLeft = this.formatTimeLeft(result.timeLeft);
                const userJob = await this.economy.getUser(userId);

                const embed = new EmbedBuilder()
                    .setTitle('⏰ En Cooldown')
                    .setDescription(`Ya trabajaste como **${userJob.lastNameWork}** recientemente, espera un momento para volver a trabajar en otra profesión`)
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
                    { name: '💸 Perdiste', value: `${this.formatNumber(result.penalty)} π-b$`, inline: true },
                    {
                        name: '💸 Balance Anterior',
                        value: `${this.formatNumber(result.oldBalance)} π-b$`,
                        inline: true
                    },
                    {
                        name: '💳 Balance Actual',
                        value: `${this.formatNumber(result.newBalance)} π-b$`,
                        inline: true
                    }
                )
                .setColor('#dc3545')
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });

            // *** NUEVO: VERIFICAR ACHIEVEMENTS DESPUÉS DE TRABAJAR ***
            if (result.success && this.achievements) {
                try {
                    const newAchievements = await this.achievements.checkAchievements(userId);
                    if (newAchievements.length > 0) {
                        await this.achievements.notifyAchievements(message, newAchievements);
                    }
                } catch (error) {
                    console.error('❌ Error verificando logros después del trabajo:', error);
                }
            }

            return;
        }
        
        // Trabajo exitoso
        const embed = new EmbedBuilder()
            .setTitle('✅ ¡Trabajo Completado!')
            .setDescription(`**${result.jobName}**\n\n${result.message}`)
            .addFields(
                { name: '💰 Ganaste', value: `+${this.formatNumber(result.amount)} π-b$`, inline: true },
                {
                    name: '💸 Balance Anterior',
                    value: `${this.formatNumber(result.oldBalance)} π-b$`,
                    inline: true
                },
                {
                    name: '💳 Balance Actual',
                    value: `${this.formatNumber(result.newBalance)} π-b$`,
                    inline: true
                }
            )
            .setColor('#28a745')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });

        // *** NUEVO: VERIFICAR ACHIEVEMENTS DESPUÉS DE TRABAJAR ***
        if (result.success && this.achievements) {
            try {
                const newAchievements = await this.achievements.checkAchievements(userId);
                if (newAchievements.length > 0) {
                    await this.achievements.notifyAchievements(message, newAchievements);
                }
            } catch (error) {
                console.error('❌ Error verificando logros después del trabajo:', error);
            }
        }
    }    

    async processCommand(message) {
        if (message.author.bot) return;

        const args = message.content.trim().split(/ +/g);
        const command = args[0].toLowerCase();
        const betId = args[1];

        try {
            switch (command) {                    
                case 'mon!balance':
                case 'mon!bal':
                case 'mon!money':
                    const targetUserm = message.mentions.members.first();
                    await this.handleBalance(message, targetUserm);
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
                case 'mon!addmoney':
                case 'mon!givemoney':
                case 'mon!givem':
                case 'mon!addm':
                    await this.handleAddMoney(message);
                    break;
                case 'mon!removemoney':
                case 'mon!removem':
                    await this.handleRemoveMoney(message);
                    break;
                case 'mon!addxp':
                    await this.handleAddXp(message);
                    break;          

                // Betting
                case 'mon!bet':
                case 'mon!apuesta':
                    await this.betting.createBet(message, args);
                    break;
                case 'mon!acceptbet':
                    await this.betting.acceptBet(message);
                    break;
                case 'mon!declinebet':
                    await this.betting.declineBet(message, args);
                    break;
                case 'mon!resolvebet':
                    const winner = args[2];
                    await this.betting.resolveBet(message, betId, winner);
                    break;
                case 'mon!cancelbet':
                    await this.betting.cancelBet(message, betId);
                    break;
                case 'mon!mybets':
                case 'mon!misapuestas':
                    await this.betting.showActiveBets(message);
                    break;
                case 'mon!betstats':
                case 'mon!estadisticasapuestas':
                    const targetUserb = message.mentions.members?.first();
                    await this.betting.showBetStats(message, targetUserb);
                    break;
                case 'mon!help':
                    await this.showHelp(message);
                    break;
                default:
                    // No es un comando de economía
                    break;
            }

/*          // Shop
            if (command === 'mon!shop' || command === 'mon!tienda') {
                const category = args[1];
                await this.shop.showShop(message, category);
                return;
            }
            if (command === 'mon!buy' || command === 'mon!comprar') {
                if (args.length < 2) {
                    await message.reply('❌ Uso: `mon!buy <item> [cantidad]`');
                    return;
                }
                const itemId = args[1];
                const quantity = parseInt(args[2]) || 1;
                await this.shop.buyItem(message, itemId, quantity);
                return;
            }
            if (command === 'mon!use' || command === 'mon!usar') {
                if (args.length < 2) {
                    await message.reply('❌ Uso: `mon!use <item>`');
                    return;
                }
                const itemId = args[1];
                await this.shop.useItem(message, itemId);
                return;
            }
            if (command === 'mon!inventory' || command === 'mon!inv' || command === 'mon!inventario') {
                const targetUser = message.mentions.members?.first();
                await this.shop.showInventory(message, targetUser);
                return;
            }
            if (command === 'mon!sell' || command === 'mon!vender') {
                if (args.length < 2) {
                    await message.reply('❌ Uso: `mon!sell <item> [cantidad]`');
                    return;
                }
                const itemId = args[1];
                const quantity = parseInt(args[2]) || 1;
                await this.shop.sellItem(message, itemId, quantity);
                return;
            }
            if (command === 'mon!shophelp' || command === 'mon!ayudatienda') {
                await this.shopHelp(message);
                return;
            }

            // Events
            if (command === 'mon!events') {
                await this.events.showActiveEvents(message);
                return;
            }
            if (command === 'mon!createevent') {
                // mon!createevent <tipo> [duración]
                const eventType = args[1];
                const duration = args[2] ? parseInt(args[2]) : null; // duración en minutos
                await this.events.createManualEvent(message, eventType, duration);
                return;
            }
            if (command === 'mon!eventstats') {
                await this.events.showEventStats(message);
                return;
            }            */



        } catch (error) {
            console.error('❌ Error procesando comando:', error);
            await message.reply('❌ Ocurrió un error al procesar el comando. Intenta de nuevo.');
        }
    }

/*    async shopHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('🛒 Comandos de la Tienda')
            .setColor('#9932CC')
            .addFields(
                { name: '🛒 mon!shop [categoría]', value: 'Ver la tienda y sus categorías', inline: false },
                { name: '💸 mon!buy <itemId> [cantidad]', value: 'Comprar un item de la tienda', inline: false },
                { name: '⚡ mon!use <itemId>', value: 'Usar un boost/cosmético', inline: false },
                { name: '🎒 mon!inventory [@usuario]', value: 'Ver tu inventario o el de otro usuario', inline: false },
                { name: '💰 mon!sell <itemId> [cantidad]', value: 'Vender items de tu inventario', inline: false }
            )
            .setFooter({ text: '¡Colecciona, mejora y presume tus objetos!' })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    }*/

    async showHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('📖 Ayuda - Comandos Principales')
            .setColor('#00BFFF')
            .addFields(
                // Achievements
                { name: '🏆 Logros', value: '`mon!achievements [@usuario]` - Ver logros\n`mon!allachievements` - Ver todos los logros\n`mon!detectachievements` - Detectar logros desbloqueados\n`mon!detectall` - Detectar todos los logros desbloqueados', inline: false },
/*                // Shop
                { name: '🛒 Tienda', value: '`mon!shop [categoría]`\n`mon!buy <item> [cantidad]`\n`mon!use <item>`\n`mon!inventory [@usuario]`\n`mon!sell <item> [cantidad]`\n`mon!shophelp`', inline: false },*/
                // Betting
                { name: '🎲 Apuestas', value: '`mon!bet [@usuario] <cantidad> <descripción>` - Crear apuesta\n`mon!mybets` - Ver tus apuestas activas\n`mon!betstats [@usuario]` - Ver estadísticas de apuestas', inline: false },
                //Economy
                { name: '📋 Economía', value: '`mon!balance [@usuario]` - Ver tu dinero y nivel (o el de otro usuario)\n`mon!daily` - Reclamar' + `(${this.economy.config.dailyAmount}±${this.economy.config.dailyVariation} ${this.economy.config.currencySymbol})` + 'diarios\n`mon!work [tipo]` - Trabajar para ganar dinero (delivery, programmer, doctor, criminal)\n`mon!level [@usuario]` - Ver información detallada de nivel\n`mon!pay @usuario <cantidad>` - Transferir dinero a otro usuario\n`mon!top [money/level]` - Ver los rankings del servidor', inline: false},
                // Minijuegos
                { name: '🎮 Minijuegos', value: '`mon!games` - Ver lista de minijuegos', inline: false },
/*                // Eventos
                { name: '🎉 Eventos', value: '`mon!events` - Ver eventos activos', inline: false },*/
                // Musica
//                { name: '🎵 Música', value: '`mon!play <url>` - Reproducir música\n`mon!skip` - Saltar canción actual\n`mon!stop` - Detener reproducción\n`mon!pause` - Pausar reproducción\n`mon!resume` - Reanudar reproducción\n`mon!queue` - Ver cola de reproducción\n`mon!search` - Busca una canción junto a sus datos\n`mon!nowplaying` - Ver canción actual\n`mon!clearmusic` - Limpiar cola de reproducción', inline: false }
            )
            .setFooter({ text: 'Usa los comandos para interactuar con el bot.' })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    }
}

module.exports = AllCommands;
