const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class AllCommands {
    constructor(economySystem, shopSystem, tradeSystem, auctionSystem, craftingSystem,  eventsSystem, bettingSystem, achievementsSystem, guildLevels, guildConfig) {
        this.economy = economySystem;
        this.shop = shopSystem;
        this.trades = tradeSystem;
        this.auctions = auctionSystem;
        this.crafting = craftingSystem;
        this.events = eventsSystem;
        this.betting = bettingSystem;
        this.achievements = achievementsSystem;
        this.guildLevels = guildLevels;
        this.guildConfig = guildConfig;
    }

    // FUNCIÓN AUXILIAR: Obtener efectos VIP para mostrar en perfil
    async getVipStatus(userId) {
        const vipInfo = await this.shop.hasActiveVip(userId);
        
        if (!vipInfo.hasVip) {
            return { hasVip: false, display: '' };
        }
        
        const timeLeft = vipInfo.timeLeft;
        const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
        const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        
        return {
            hasVip: true,
            tier: vipInfo.tier,
            display: `${vipInfo.tier} (${days}d ${hours}h restantes)`,
            emoji: '💎'
        };
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

    // VERSIÓN AVANZADA: Con estado VIP también
    async handleBalance(message, targetUser = null) {
        const userId = targetUser ? targetUser.id : message.author.id;
        const displayName = targetUser ? targetUser.displayName : message.author.displayName;
        const user = await this.economy.getUser(userId);
        
        // Calcular información de nivel
        const xpForNextLevel = this.economy.getXpForLevel(user.level + 1);
        const xpForCurrentLevel = this.economy.getXpForLevel(user.level);
        const totalXpForCurrent = this.economy.getXpNeededForLevel(user.level);
        const xpProgress = user.total_xp - totalXpForCurrent;
        const xpNeeded = xpForNextLevel - xpProgress;
        
        // Crear barra de progreso
        const progressBar = this.createProgressBar(xpProgress, xpForNextLevel, 15);
        const progressPercentage = ((xpProgress / xpForNextLevel) * 100).toFixed(1);

        // Avatar
        const avatarUrl = targetUser ? targetUser.displayAvatarURL({ dynamic: true }) : message.author.displayAvatarURL({ dynamic: true });

        // ✅ ARREGLO: Obtener cosméticos correctamente
        const equippedCosmetics = await this.shop.getEquippedCosmetics(userId);
        const vipStatus = await this.getVipStatus(userId);

        // Crear badges string
        let badgesString = '';
        if (equippedCosmetics.length > 0) {
            let badges = [];
            for (const cosmetic of equippedCosmetics) {
                const item = this.shop.shopItems[cosmetic.id];
                if (item) {
                    const emojiMatch = item.name.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u);
                    const emoji = emojiMatch ? emojiMatch[0] : '✨';
                    badges.push(emoji);
                }
            }
            badgesString = badges.length > 0 ? ` ${badges.join('')}` : '';
        }
        
        // ✅ ARREGLO: Crear título más simple
        let decoratedTitle = `💰 ${displayName}${badgesString}`;
        
        // Agregar VIP al título si tiene
        if (vipStatus.hasVip) {
            decoratedTitle = `👑 ${decoratedTitle}`;
        }

        const embed = new EmbedBuilder()
            .setTitle(decoratedTitle)
            .setColor(vipStatus.hasVip ? '#FFD700' : '#0099FF')
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
                    value: `**${this.formatNumber(user.total_xp)}**`, 
                    inline: true 
                },
                { 
                    name: '📈 Progreso al Siguiente Nivel', 
                    value: `\`${progressBar}\` ${progressPercentage}%\n**${this.formatNumber(xpProgress)}** / **${this.formatNumber(xpForNextLevel)}** XP\n*Faltan ${this.formatNumber(xpNeeded)} XP*`, 
                    inline: false 
                },
                { 
                    name: '💬 Mensajes Enviados', 
                    value: `${this.formatNumber(user.messages_count)}`, 
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
            );
        
        // ✅ ARREGLO: Mostrar VIP
        if (vipStatus.hasVip) {
            embed.addFields({
                name: '👑 Estado VIP',
                value: vipStatus.display,
                inline: false
            });
        }
        
        // ✅ ARREGLO: Mostrar cosméticos equipados
        if (equippedCosmetics.length > 0) {
            let cosmeticsText = '';
            let cosmeticLines = [];
            
            for (const cosmetic of equippedCosmetics) {
                const item = this.shop.shopItems[cosmetic.id];
                if (item) {
                    const emojiMatch = item.name.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u);
                    const emoji = emojiMatch ? emojiMatch[0] : '✨';
                    // Formato más compacto: emoji + nombre en la misma línea, separados por •
                    cosmeticLines.push(`${emoji} ${item.name.replace(emoji, '').trim()}`);
                }
            }
            
            if (cosmeticLines.length > 0) {
                cosmeticsText = cosmeticLines.join(' • '); // Separados por bullets
                embed.addFields({
                    name: '🏆 Insignias Equipadas',
                    value: cosmeticsText,
                    inline: false
                });
            }
        }
        
        embed.setFooter({ text: `ID: ${userId}` })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }

    // Comando !daily - Reclamar dinero diario
    async handleDaily(message) {
        const userId = message.author.id;
        const result = await this.economy.useDaily(userId, message.guild?.id);
        
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
                    value: `**+${this.formatNumber(result.finalEarnings)}** ${this.economy.config.currencySymbol}`,
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
                },
                { name: '🎉 Extra por Eventos', value: `${result.eventMessage || "No hay eventos Activos"} `, inline: false },
            )
            .setColor('#00FF00')
            .setFooter({ text: 'Vuelve mañana por más!' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
            // AÑADIR ESTO:
            if (result.hitLimit) {
                await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(this.economy.config.maxBalance)} π-b$).`);
            }
    
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

        // ✅ CAMBIAR ESTA PARTE:
        if (this.economy.missions) {
            const dailyMissions = await this.economy.missions.updateMissionProgress(userId, 'daily_claimed');
            // ✅ AGREGAR ESTA LÍNEA:
            const moneyMissions = await this.economy.missions.updateMissionProgress(userId, 'money_earned_today', result.amount);
            const trinityMissions = await this.economy.missions.checkTrinityCompletion(userId); // ← NUEVO

            // ✅ COMBINAR AMBOS RESULTADOS:
            const allCompleted = [...dailyMissions, ...moneyMissions, ...trinityMissions];
            if (allCompleted.length > 0) {
                await this.economy.missions.notifyCompletedMissions(message, allCompleted);
            }
        }

        // Verificar tesoros al final
        for (const event of this.events.getActiveEvents(message.guild?.id)) {
            if (event.type === 'treasure_hunt') {
                const treasures = await this.events.checkSpecialEvents(userId, 'general');
                    
                for (const treasure of treasures) {
                    if (treasure.type === 'treasure') {
                        message.reply(`🗺️ **¡Tesoro encontrado!**\n${treasure.description}`);
                    }
                }
                break;
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
        const xpProgress = user.total_xp - totalXpForCurrent;
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
                    value: `**${this.formatNumber(user.total_xp)}**`, 
                    inline: true 
                },
                { 
                    name: '📈 Progreso Detallado', 
                    value: `\`${progressBar}\`\n**${progressPercentage}%** completado\n\n**Actual:** ${this.formatNumber(xpProgress)} XP\n**Necesaria:** ${this.formatNumber(xpForNextLevel)} XP\n**Restante:** ${this.formatNumber(xpNeeded)} XP`, 
                    inline: false 
                },
                { 
                    name: '💬 Mensajes', 
                    value: `${this.formatNumber(user.messages_count)}`, 
                    inline: true 
                },
                { 
                    name: '💰 Ganado por Niveles', 
                    value: `${this.formatNumber((user.level - 1) * this.economy.config.levelUpReward)} ${this.economy.config.currencySymbol}`, 
                    inline: true 
                },
                { 
                    name: '⚡ XP por Mensaje', 
                    value: `${this.economy.config.xpPerMessage} + bonus por nivel ± ${this.economy.config.xpVariation}`,
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
                    value: '`>pay @usuario <cantidad>`',
                    inline: false
                }, {
                    name: '💡 Ejemplo',
                    value: '`>pay @usuario 500`',
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

        // Verificar límite dinámico del receptor
        const targetUserData = await this.economy.getUser(targetUser.id);
        const targetLimit = this.economy.shop ? await this.economy.shop.getVipLimit(targetUser.id) : this.economy.config.maxBalance;

        if (targetUserData.balance + amount > targetLimit) {
            const spaceLeft = targetLimit - targetUserData.balance;
            const limitText = targetLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
            await message.reply(`❌ ${targetUser.displayName} alcanzaría su límite máximo de ${limitText}. Solo puedes enviar ${this.formatNumber(spaceLeft)} π-b$ más.`);
            return;
        }
        
        // Realizar transferencia
        const userBalance = await this.economy.getUser(message.author.id);
        const otherUserBalance = await this.economy.getUser(targetUser.id);
        const result = await this.economy.transferMoney(message.author.id, targetUser.id, amount, message.guild?.id);
        
        if (!result.success) {
            if (result.reason === 'being_robbed') {
                return message.reply(`❌ No puedes transferir dinero mientras te están robando! Tiempo restante: ${Math.ceil(result.timeLeft/1000)}s`);
            }
            
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
                { name: '💰 Balance Anterior', value: `${this.formatNumber(userBalance.balance + amount)} ${this.economy.config.currencySymbol}`, inline: true },
                { name: '💰 Tu Balance Actual', value: `${this.formatNumber(result.beforeEvents)} ${this.economy.config.currencySymbol}`, inline: true },
                { name: '💸 Dinero Enviado', value: `${this.formatNumber(amount)} ${this.economy.config.currencySymbol}`, inline: true },
                { name: '💰 Balance Anterior del Destinatario', value: `${this.formatNumber(otherUserBalance.balance - amount)} ${this.economy.config.currencySymbol}`, inline: true },
                { name: '💰 Balance Actual del Destinatario', value: `${this.formatNumber(result.toBalance)} ${this.economy.config.currencySymbol}`, inline: true },
                { name: '🎉 Extra por Eventos', value: `${result.eventMessage || "No hay eventos Activos"} `, inline: false }
            )
            .setColor('#00FF00')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });

        // *** NUEVO: VERIFICAR ACHIEVEMENTS DESPUÉS DE TRANSFERIR ***
        if (this.achievements) {
            try {
                // Verificar logros para quien envía (por dinero dado)
                const senderAchievements = await this.achievements.checkAchievements(message.author.id);
                if (senderAchievements.length > 0) {
                    await this.achievements.notifyAchievements(message, senderAchievements);
                }

                // Verificar logros para quien recibe (por dinero ganado)
                const receiverAchievements = await this.achievements.checkAchievements(targetUser.id);
                if (receiverAchievements.length > 0) {
                    // Notificar en el mismo canal pero mencionando al receptor
                    for (const achievementId of receiverAchievements) {
                        const achievement = this.achievements.achievements[achievementId];
                        if (achievement) {
                            const rarityColor = this.achievements.rarityColors[achievement.rarity];
                            const rarityEmoji = this.achievements.rarityEmojis[achievement.rarity];
                            
                            const embed = new EmbedBuilder()
                                .setTitle('🎉 ¡Logro Desbloqueado!')
                                .setDescription(`${rarityEmoji} ${achievement.emoji} **${achievement.name}**\n\n*${achievement.description}*\n\n<@${targetUser.id}> desbloqueó este logro!`)
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
    async handleTop(message, client) {
        const args = message.content.split(' ');
        const type = args[1]?.toLowerCase() || 'money';
        const scope = args[2]?.toLowerCase(); // 'global' o nada = servidor

        const isGlobal = scope === 'global';
        const isLevel = type === 'level' || type === 'levels' || type === 'lvl';

        // Mensaje de espera solo para servidor (puede tardar)
        let loadingMsg = null;
        if (!isGlobal) {
            loadingMsg = await message.reply('🔍 Buscando miembros del servidor...');
        }

        let leaderboard;
        if (isGlobal) {
            leaderboard = isLevel
                ? await this.economy.getLevelLeaderboard(10)
                : await this.economy.getBalanceLeaderboard(10);
        } else {
            leaderboard = isLevel
                ? await this.economy.getLevelLeaderboardByGuild(10, message.guild.id, client)
                : await this.economy.getBalanceLeaderboardByGuild(10, message.guild.id, client);
        }

        if (!leaderboard || leaderboard.length === 0) {
            await message.reply('❌ No hay usuarios en el leaderboard todavía.');
            return;
        }

        const scopeLabel = isGlobal ? '🌍 Global' : `🏠 ${message.guild.name}`;
        const title = isLevel
            ? `🏆 Top 10 Niveles — ${scopeLabel}`
            : `🏆 Top 10 π-b Coin — ${scopeLabel}`;
        const emoji = isLevel ? '📊' : '💰';

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor('#FFD700')
            .setTimestamp();

        let description = '';
        for (let i = 0; i < leaderboard.length; i++) {
            const user = leaderboard[i];
            let medal;
            switch (i) {
                case 0: medal = '🥇'; break;
                case 1: medal = '🥈'; break;
                case 2: medal = '🥉'; break;
                default: medal = `**${i + 1}.**`; break;
            }

            const value = isLevel
                ? `Nivel ${user.level} (${this.formatNumber(user.totalXp)} XP)`
                : `${this.formatNumber(user.balance)} ${this.economy.config.currencySymbol}`;

            description += `${medal} <@${user.userId}>\n${emoji} ${value}\n\n`;
        }

        embed.setDescription(description);

        const footerParts = [];
        if (isLevel) footerParts.push('Usa >top money para ver dinero');
        else footerParts.push('Usa >top level para ver niveles');
        if (isGlobal) footerParts.push('Usa >top money para ver solo este servidor');
        else footerParts.push('Usa >top money global para ver el ranking global');

        embed.setFooter({ text: footerParts.join(' • ') });

        if (loadingMsg) {
            await loadingMsg.edit({ content: '', embeds: [embed] });
        } else {
            await message.reply({ embeds: [embed] });
        }
    }

    async handleAddMoney(message, client) {        
        if (!message.member?.permissions.has('Administrator')) {
            await message.reply('❌ No tienes permisos de administrador para usar este comando.');
            return;
        }
        if (!await this.validateAdminCommand(message, targetUser, 'addmoney')) return;

        const args = message.content.split(' ');
        
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('💸 Comando Add')
                .setDescription('Da π-b Coins a otro usuario')
                .addFields({
                    name: '📝 Uso',
                    value: '`>addmoney @usuario <cantidad> <razon>`',
                    inline: false
                }, {
                    name: '💡 Ejemplo',
                    value: '`>addmoney @usuario 500 "Por ganar el concurso"`',
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

        const targetUserData = await this.economy.getUser(targetUser.id);
        if (targetUserData.balance + amount > this.economy.config.maxBalance) {
            const spaceLeft = this.economy.config.maxBalance - targetUserData.balance;
            await message.reply(`❌ El usuario alcanzaría el límite máximo. Solo puedes agregar ${this.formatNumber(spaceLeft)} π-b$ más.`);
            return;
        }

        const reason = message.content.split(' ').slice(3).join(' ') || 'No Especificada';

        // Realizar transferencia
        const result = await this.economy.addMoney(targetUser.id, amount, reason);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Se ha Entregado Exitosamente el Dinero')
            .setDescription(`Has dado **${this.formatNumber(amount)}** ${this.economy.config.currencySymbol} a ${targetUser}\nRazón: ${reason}`)
            .addFields(
                { name: '💰 Balance de Destino', value: `${this.formatNumber(result.newBalance - amount)} ${this.economy.config.currencySymbol}`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });

        // ENVIAR LOG POR DM AL PROPIETARIO
        try {
            const ownerId = '488110147265232898'; // Cambia por tu ID de Discord
            
            // Intentar múltiples métodos para obtener el usuario
            let owner;
            try {
                owner = await client.users.fetch(ownerId, { force: true });
            } catch (fetchError) {
                // Si fetch falla, buscar en caché
                owner = client.users.cache.get(ownerId);
            }
            
            if (!owner) {
                console.log('❌ No se pudo encontrar al propietario');
                return;
            }

            const logEmbed = new EmbedBuilder()
                .setTitle('🚨 Log de Comando Admin - AddMoney')
                .setDescription(`Se ha usado el comando \`>addmoney\` en el servidor **${message.guild.name}**`)
                .addFields(
                    { name: '👤 Administrador', value: `${message.author} (${message.author.tag})`, inline: true },
                    { name: '🎯 Usuario Destino', value: `${targetUser} (${targetUser.tag})`, inline: true },
                    { name: '💰 Cantidad', value: `${this.formatNumber(amount)} π-b$`, inline: true },
                    { name: '📝 Razón', value: reason, inline: false }
                )
                .setColor('#FF9900')
                .setTimestamp();

            const dmChannel = await owner.createDM();
            await dmChannel.send({ embeds: [logEmbed] });
            console.log('📨 Log enviado correctamente');

        } catch (error) {
            console.error('❌ Error completo enviando log:', error.stack);
            // Log alternativo en consola si falla el DM
            console.log(`📋 LOG: ${message.author.tag} usó addmoney en ${targetUser.tag} por ${amount} π-b$`);
        }
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
                    value: '`>removemoney @usuario <cantidad> <razon>`',
                    inline: false
                }, {
                    name: '💡 Ejemplo',
                    value: '`>removemoney @usuario 500 "Por mal comportamiento"`',
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
                { name: '💰 Balance de Destino', value: `${this.formatNumber(result + amount)} ${this.economy.config.currencySymbol}`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();
            
        await message.reply({ embeds: [embed] });
        
        // ENVIAR LOG POR DM AL PROPIETARIO
        try {
            const ownerId = '488110147265232898'; // Cambia por tu ID de Discord
            
            const logEmbed = new EmbedBuilder()
                .setTitle('🚨 Log de Comando Admin - RemoveMoney')
                .setDescription(`Se ha usado el comando \`>removemoney\` en el servidor **${message.guild.name}**`)
                .addFields(
                    { name: '👤 Administrador', value: `${message.author} (${message.author.tag})`, inline: true },
                    { name: '🎯 Usuario Destino', value: `${targetUser} (${targetUser.tag})`, inline: true },
                    { name: '💸 Cantidad Removida', value: `${this.formatNumber(amount)} π-b$`, inline: true },
                    { name: '📝 Razón', value: reason, inline: false },
                    { name: '🏦 Balance Anterior', value: `${this.formatNumber(result + amount)} π-b$`, inline: true },
                    { name: '🏦 Balance Nuevo', value: `${this.formatNumber(result)} π-b$`, inline: true },
                    { name: '📍 Canal', value: `${message.channel}`, inline: true }
                )
                .setColor('#FF0000')
                .setTimestamp()
                .setFooter({ text: `ID del Admin: ${message.author.id}` });

            const owner = message.guild.members.cache.get(ownerId)?.user;
            if (!owner) {
                console.log('❌ No se pudo encontrar al propietario en el servidor');
                return;
            }
            await owner.send({ embeds: [logEmbed] });
            console.log(`📨 Log de RemoveMoney enviado al propietario`);
        } catch (error) {
            console.error('❌ Error enviando log por DM:', error);
        }
    }

    async handleAddXp(message) {
        if (!message.member?.permissions.has('Administrator')) {
            await message.reply('❌ No tienes permisos de administrador para usar este comando.');
            return;
        }
        if (!await this.validateAdminCommand(message, targetUser, 'addxp')) return;

        const args = message.content.split(' ');
        
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('💸 Comando AddXP')
                .setDescription('Añade Xp a otro usuario')
                .addFields({
                    name: '📝 Uso',
                    value: '`>addxp @usuario <cantidad> <razon>`',
                    inline: false
                }, {
                    name: '💡 Ejemplo',
                    value: '`>addxp @usuario 500 "Por ganar el concurso"`',
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

        // ENVIAR LOG POR DM AL PROPIETARIO
        try {
            const ownerId = '488110147265232898'; // Cambia por tu ID de Discord
            
            const logEmbed = new EmbedBuilder()
                .setTitle('🚨 Log de Comando Admin - AddXP')
                .setDescription(`Se ha usado el comando \`>addxp\` en el servidor **${message.guild.name}**`)
                .addFields(
                    { name: '👤 Administrador', value: `${message.author} (${message.author.tag})`, inline: true },
                    { name: '🎯 Usuario Destino', value: `${targetUser} (${targetUser.tag})`, inline: true },
                    { name: '⭐ XP Agregado', value: `${this.formatNumber(baseXP)} XP`, inline: true },
                    { name: '📝 Razón', value: reason, inline: false },
                    { name: '🎖️ Nivel Actual', value: `${xpResult.newLevel || 'Sin cambio'}`, inline: true },
                    { name: '🆙 Subió de Nivel', value: xpResult.levelUp ? '✅ Sí' : '❌ No', inline: true },
                    { name: '📍 Canal', value: `${message.channel}`, inline: true }
                )
                .setColor('#9932CC')
                .setTimestamp()
                .setFooter({ text: `ID del Admin: ${message.author.id}` });

            const owner = message.guild.members.cache.get(ownerId)?.user;
            if (!owner) {
                console.log('❌ No se pudo encontrar al propietario en el servidor');
                return;
            }
            await owner.send({ embeds: [logEmbed] });
            console.log(`📨 Log de AddXP enviado al propietario`);
        } catch (error) {
            console.error('❌ Error enviando log por DM:', error);
        }

        // Si subió de nivel, notificar
        if (xpResult && xpResult.levelUp) {
            const levelUpEmbed = new EmbedBuilder()
                .setTitle('🎉 ¡Subiste de Nivel!')
                .setDescription(`${targetUser} alcanzó el **Nivel ${xpResult.newLevel}**`)
                .addFields(
                    { name: '📈 XP Ganada', value: `+${xpResult.xpGained} XP`, inline: true },
                    { name: '🎁 Recompensa Base', value: `+${xpResult.baseReward || xpResult.reward} π-b$`, inline: true },
                    { name: '🏆 Niveles Subidos', value: `${xpResult.levelsGained}`, inline: true }
                )
                .setColor('#FFD700')
                .setTimestamp();
            
            // ✅ AGREGAR - Bonus por nivel
            if (xpResult.levelBonus && xpResult.levelBonus > 0) {
                levelUpEmbed.addFields({
                    name: '⭐ Bonus por Nivel',
                    value: `+${xpResult.levelBonus} π-b$ (${xpResult.newLevel} × 50)`,
                    inline: false
                });
            }
            
            // ✅ Total
            levelUpEmbed.addFields({
                name: '💰 Total Ganado',
                value: `**${xpResult.reward} π-b$**`,
                inline: false
            });
            
            await message.channel.send({ embeds: [levelUpEmbed] });
        }
    }

    formatAllBonuses(result) {
        let bonuses = [];
        
        if (result.eventMessage) bonuses.push(result.eventMessage);
        if (result.pickaxeMessage) bonuses.push(result.pickaxeMessage);
        if (result.equipmentMessage) bonuses.push(result.equipmentMessage);
        if (result.itemMessage) bonuses.push(result.itemMessage);
        if (result.vipMessage) bonuses.push(result.vipMessage);
        
        return bonuses.length > 0 ? bonuses.join('\n') : 'No hay bonificaciones activas';
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
                    value: `**Pago:** ${job.baseReward} - ${job.variation} π-b$\n**Cooldown:** ${cooldownText}${levelText}${job.failChance ? `\n**Riesgo:** ${(job.failChance * 100)}% de fallar` : ''}\n**Comando:** >work ${job.codeName}`,
                    inline: true
                });
            }
            
            embed.addFields({
                name: '💡 Uso',
                value: '`>work <tipo>`\nEjemplo: `>work delivery`',
                inline: false
            });
            
            await message.reply({ embeds: [embed] });
            return;
        }
        
        // Verificar si el trabajo existe
        if (!jobs[jobType]) {
            await message.reply('❌ Trabajo no válido.\nEscribe \`>work\` para ver los Trabajos Disponibles');
            return;
        }
        
        // Intentar trabajar
        const result = await this.economy.doWork(userId, jobType, message.guild?.id);

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
                    .setDescription(`Ya trabajaste como **${result.name}** recientemente, espera un momento para volver a trabajar en otra profesión`)
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

            // AGREGAR ESTO:
            if (result.protectionMessage) {
                embed.addFields({ 
                    name: '🛡️ Protección', 
                    value: result.protectionMessage, 
                    inline: false 
                });
                embed.setColor('#FFA500'); // Color diferente si hay protección
            }
            
            await message.reply({ embeds: [embed] });
            if (result.hitLimit) {
                await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(this.economy.config.maxBalance)} π-b$).`);
            }

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

            // *** NUEVO: NOTIFICAR MISIONES COMPLETADAS ***
            if (this.economy.missions) {
                const workMissions = await this.economy.missions.updateMissionProgress(userId, 'work');
                const moneyMissions = await this.economy.missions.updateMissionProgress(userId, 'money_earned_today', result.amount);
                const trinityMissionss = await this.economy.missions.checkTrinityCompletion(userId); // ← NUEVO

                const allCompleted = [...workMissions, ...moneyMissions, ...trinityMissionss];
                if (allCompleted.length > 0) {
                    await this.economy.missions.notifyCompletedMissions(message, allCompleted);
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
                },
                { name: '🎉 Bonificaciones', value: this.formatAllBonuses(result), inline: false },
                //{ name: '🎉 Bonificaciones', value: this.formatBonusMessages(eventMessage, itemMessage, vipMessage), inline: false }
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

        // *** NUEVO: NOTIFICAR MISIONES COMPLETADAS ***
        if (this.economy.missions) {
            const workMissions = await this.economy.missions.updateMissionProgress(userId, 'work');
            const moneyMissions = await this.economy.missions.updateMissionProgress(userId, 'money_earned_today', result.amount);
            
            const allCompleted = [...workMissions, ...moneyMissions];
            if (allCompleted.length > 0) {
                await this.economy.missions.notifyCompletedMissions(message, allCompleted);
            }
        }

            // Verificar tesoros al final
            for (const event of this.events.getActiveEvents(message.guild?.id)) {
                if (event.type === 'treasure_hunt') {
                    const treasures = await this.events.checkSpecialEvents(userId, 'general');
                    
                    for (const treasure of treasures) {
                        if (treasure.type === 'treasure') {
                            message.reply(`🗺️ **¡Tesoro encontrado!**\n${treasure.description}`);
                        }
                    }
                    break;
                }
            }
    }    

    async handleRobberyCommand(message, args) {
        const robberId = message.author.id;
        
        // Verificar que se mencionó a alguien
        if (!message.mentions.users.first() && !args[0]) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ Error')
                .setDescription('Debes mencionar a un usuario para robar\n**Uso:** `>robar @usuario`')
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }
        
        // Obtener usuario objetivo
        let targetUser = message.mentions.users.first();
        if (!targetUser && args[0]) {
            try {
                targetUser = await message.client.users.fetch(args[0]);
            } catch (error) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('❌ Usuario no encontrado')
                    .setDescription('No se pudo encontrar al usuario especificado')
                    .setTimestamp();
                
                return message.reply({ embeds: [errorEmbed] });
            }
        }
        
        const targetId = targetUser.id;

        console.log(`🐛 DEBUG - Iniciando robo:`, {
            robberId,
            targetId,
            hasShop: !!this.shop,
            hasEconomy: !!this.economy,
            activeRobberiesSize: this.economy.activeRobberies?.size
        });
        
        // Verificar que no sea un bot
        if (targetUser.bot) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('🤖 Error')
                .setDescription('No puedes robar a un bot')
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }
        
        // Verificar si puede robar
        const canRobResult = await this.economy.canRob(robberId, targetId);
        
        if (!canRobResult.canRob) {
            let errorMessage = '';
            
            switch (canRobResult.reason) {
                case 'self_target':
                    errorMessage = 'No puedes robarte a ti mismo 🙄';
                    break;
                case 'level_too_low':
                    errorMessage = `Necesitas ser nivel **${canRobResult.requiredLevel}** para robar`;
                    break;
                case 'target_too_poor':
                    errorMessage = `${targetUser.username} necesita tener al menos **${canRobResult.minBalance}** ${this.economy.config.currencySymbol}`;
                    break;
                case 'cooldown':
                    const timeLeft = Math.ceil(canRobResult.timeLeft / (1000 * 60 * 60));
                    errorMessage = `Debes esperar **${timeLeft}h** antes de robar de nuevo`;
                    break;
                case 'already_robbing':
                    errorMessage = 'Ya tienes un robo en progreso';
                    break;
                case 'robber_rich':
                    errorMessage = 'Limite de dinero alcanzado';
                    break;
                default:
                    errorMessage = 'No puedes robar en este momento';
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('🚫 No puedes robar')
                .setDescription(errorMessage)
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }

        if (this.shop) {
            const user = await this.economy.getUser(robberId);
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            
            for (const [itemId, effects] of Object.entries(activeEffects)) {
                if (!Array.isArray(effects)) continue;

                for (const effect of effects) {
                    if (effect.type === 'robbery_boost' && effect.safe === true && effect.usesLeft > 0) {                       
                        // Ejecutar robo directo sin minijuego
                        const robberyResult = await this.economy.startRobbery(robberId, targetId, message);
                        
                        if (robberyResult.success) {
                            // Simular clicks máximos para garantizar éxito
                            robberyResult.robberyData.clicks = this.economy.robberyConfig.maxClicks;
                            
                            const finishResult = await this.economy.finishRobbery(robberId);
                            
                            // Mostrar resultado
                            if (finishResult.success && finishResult.robberySuccess) {
                                const phantomEmbed = new EmbedBuilder()
                                    .setTitle('👻 Phantom Gloves - Robo Perfecto')
                                    .setDescription(`¡Los guantes fantasma hicieron su magia! Robaste **${finishResult.stolenAmount}** ${this.economy.config.currencySymbol} sin ser detectado.`)
                                    .addFields([
                                        { name: '💰 Cantidad robada', value: `${finishResult.stolenAmount} ${this.economy.config.currencySymbol}`, inline: true },
                                        { name: '👻 Método', value: 'Phantom Gloves', inline: true },
                                        { name: '🎯 Eficiencia', value: '100%', inline: true }
                                    ])
                                    .setColor('#800080');
                                
                                await message.reply({ embeds: [phantomEmbed] });
                            }
                        }
                        
                        return; // CRÍTICO: Salir inmediatamente para evitar el minijuego normal
                    }
                }
            }
        }
        
        // Iniciar el robo
        const robberyResult = await this.economy.startRobbery(robberId, targetId, message);
        
        if (!robberyResult.success) {
            console.log(`❌ Robo falló para ${robberId}:`, robberyResult);
            
            let errorMessage = 'Hubo un problema al iniciar el robo. Inténtalo de nuevo.';
            
            // Mensajes específicos según la razón
            switch (robberyResult.reason) {
                case 'start_error':
                    errorMessage = `Error interno: ${robberyResult.error || 'Desconocido'}`;
                    break;
                case 'already_robbing':
                    errorMessage = 'Ya tienes un robo en progreso';
                    break;
                case 'target_protected':
                    let penaltyText = '';

                    // Verificar si el robber tiene protección
                    if (robberyResult.robberProtection) {
                        penaltyText = `\n\n${robberyResult.robberProtection}`;
                    } else if (robberyResult.penalty > 0) {
                        penaltyText = `\n\n💸**Perdiste**\n${robberyResult.penalty} π-b$`;
                    } else {
                        penaltyText = ''; // Sin penalización y sin mensaje de protección
                    }
                    
                    if (robberyResult.protectionType === 'shield') {
                        errorMessage = `🛡️ ¡Rayos! **${targetUser.displayName}** tiene un **Escudo Antirrobo** activado. Tu intento de robo rebotó como una pelota de goma. 🏀${penaltyText}`;
                    } else if (robberyResult.protectionType === 'vault') {
                        errorMessage = `🏦 **${targetUser.displayName}** guardó su dinero en una **Bóveda Permanente**. Intentaste forzarla pero era más dura que una nuez. 🥜${penaltyText}`;
                    } else if (robberyResult.protectionType === 'condon') {
                        errorMessage = `🧃 **${targetUser.displayName}** tiene un gorrito bien colocado. 💰${penaltyText}`;
                    } else {
                        errorMessage = `🛡️ **${targetUser.displayName}** está muy bien protegido/a. Parece que invirtió sabiamente en seguridad. 💰${penaltyText}`;
                    }
                    break;
                default:
                    errorMessage = `No se pudo iniciar el robo: ${robberyResult.reason || 'Razón desconocida'}`;
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ Error al iniciar robo')
                .setDescription(errorMessage)
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }      
        
        // Crear embed inicial del robo
        const robberyEmbed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('🦹‍♂️ ROBO EN PROGRESO')
            .setDescription(`**${message.author.username}** está intentando robar a **${targetUser.username}**!`)
            .addFields([
                {
                    name: '🎯 Objetivo',
                    value: `${targetUser.username}`,
                    inline: true
                },
                {
                    name: '⏱️ Tiempo límite',
                    value: '30 segundos',
                    inline: true
                },
                {
                    name: '👆 Clicks',
                    value: `0/${this.economy.robberyConfig.maxClicks}`,
                    inline: true
                },
                {
                    name: '💡 Instrucciones',
                    value: 'Haz click en el botón **lo más rápido posible**!\nMientras más clicks hagas, mayor será tu probabilidad de éxito.',
                    inline: false
                }
            ])
            .setFooter({ text: 'Puedes robar entre 5% - 10% del dinero del objetivo' })
            .setTimestamp();
        
        // Crear botón
        const robButton = new ButtonBuilder()
            .setCustomId(`rob_${robberId}_${Date.now()}`)
            .setLabel('🏃‍♂️ ¡ROBAR!')
            .setStyle(ButtonStyle.Danger);
        
        const row = new ActionRowBuilder()
            .addComponents(robButton);
        
        const robberyMessage = await message.reply({ 
            embeds: [robberyEmbed], 
            components: [row] 
        });
        
        // Collector para el botón
        const collector = robberyMessage.createMessageComponentCollector({
            time: this.economy.robberyConfig.buttonTimeLimit + 2000
        });
        
        let lastUpdate = Date.now();
        let robberyFinished = false; // AGREGAR ESTA LÍNEA

        // AGREGAR ESTA FUNCIÓN COMPLETA
        const finishRobberyAndShowResult = async (reason = 'unknown') => {
            if (robberyFinished) {
                console.log(`⚠️ Robo ya fue finalizado, ignorando llamada desde: ${reason}`);
                return;
            }
            
            robberyFinished = true;
            console.log(`🎯 Finalizando robo por: ${reason}`);
            
            const finishResult = await this.economy.finishRobbery(robberId);

            // En lugar de mostrar el resultado inmediatamente, envía un mensaje separado
            if (finishResult.success) {
                // Esperar un poco para que se vea como mensaje separado
                if (finishResult.robberySuccess) {
                    // Mensaje de robo exitoso
                    const successEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                            .setTitle('🦹‍♂️ ¡Robo Exitoso!')
                            .setDescription(`<@${message.author.id}> robó **${finishResult.stolenAmount}** ${this.economy.config.currencySymbol} a <@${finishResult.targetId}>`)
                            .addFields(
                                { name: '💰 Cantidad robada', value: `${finishResult.stolenAmount} ${this.economy.config.currencySymbol}`, inline: true },
                                { name: '🎯 Eficiencia', value: `${finishResult.efficiency}%`, inline: true },
                                { name: '👆 Clicks', value: `${finishResult.clicks}/${finishResult.maxClicks}`, inline: true }
                            );

                        // AGREGAR: Mostrar items usados si los hay
                        if (finishResult.usedItems && finishResult.usedItems.length > 0) {
                            let itemsText = '';
                            for (const item of finishResult.usedItems) {
                                if (item.safe) {
                                    itemsText += `${item.name} (100% éxito)\n`;
                                } else if (item.boost > 0) {
                                    itemsText += `${item.name} (+${Math.round(item.boost * 100)}% éxito)\n`;
                                } else {
                                    itemsText += `${item.name}\n`;
                                }
                            }
                            successEmbed.addFields({ name: '🔧 Items Usados', value: itemsText, inline: false });
                        }
                        
                        await message.channel.send({ embeds: [successEmbed] });
                        
                        if (finishResult.hitLimit) {
                            await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(this.economy.config.maxBalance)} π-b$).`);
                        }
                } else {
                    // Mensaje de robo fallido
                    const failEmbed = new EmbedBuilder()
                        .setColor('#800080')
                        .setTitle('🚨 ¡Robo Fallido!');

                    // Descripción diferente según si hay protección o no
                    if (finishResult.protectionMessage) {
                        failEmbed.setDescription(`<@${message.author.id}> falló el robo pero ${finishResult.protectionMessage}`);
                        failEmbed.addFields(
                            { name: '🛡️ Protección', value: finishResult.protectionMessage, inline: true },
                            { name: '🎯 Eficiencia', value: `${finishResult.efficiency}%`, inline: true },
                            { name: '👆 Clicks', value: `${finishResult.clicks}/${finishResult.maxClicks}`, inline: true }
                        );
                    } else {
                        failEmbed.setDescription(`<@${message.author.id}> falló el robo y perdió **${finishResult.penalty}** ${this.economy.config.currencySymbol}`);
                        failEmbed.addFields(
                            { name: '💸 Penalización', value: `${finishResult.penalty} ${this.economy.config.currencySymbol}`, inline: true },
                            { name: '🎯 Eficiencia', value: `${finishResult.efficiency}%`, inline: true },
                            { name: '👆 Clicks', value: `${finishResult.clicks}/${finishResult.maxClicks}`, inline: true }
                        );
                    }

                    // AGREGAR: Mostrar items usados también en fallos
                    if (finishResult.usedItems && finishResult.usedItems.length > 0) {
                        let itemsText = '';
                        for (const item of finishResult.usedItems) {
                            itemsText += `${item.name} (consumido)\n`;
                        }
                        failEmbed.addFields({ name: '🔧 Items Usados', value: itemsText, inline: false });
                    }
                        
                    await message.channel.send({ embeds: [failEmbed] });
                }
            }              
        };
        
        collector.on('collect', async (interaction) => {
            // Solo el ladrón puede hacer click
            if (interaction.user.id !== robberId) {
                await interaction.reply({
                    content: '❌ Solo el ladrón puede usar este botón',
                    ephemeral: true
                });
                return;
            }
            
            // Procesar click
            const clickResult = await this.economy.processRobberyClick(robberId);

            console.log(`🖱️ Click procesado:`, clickResult);
            
            if (!clickResult.success) {
                console.log(`⚠️ Click falló - Razón: ${clickResult.reason}`);
            }
                
            if (clickResult.reason === 'time_expired') {
                await finishRobberyAndShowResult('time_expired');
                collector.stop('time_expired');
                return;
            }
            
            // Actualizar embed cada 5 clicks o cada 3 segundos para no saturar
            const now = Date.now();
            const shouldUpdate = clickResult.clicks % 5 === 0 || now - lastUpdate > 3000;
            
            if (shouldUpdate) {
                const updatedEmbed = EmbedBuilder.from(robberyEmbed)
                    .spliceFields(2, 1, {
                        name: '👆 Clicks',
                        value: `${clickResult.clicks}/${clickResult.maxClicks}`,
                        inline: true
                    })
                    .addFields([
                        {
                            name: '⚡ Progreso',
                            value: `${'█'.repeat(Math.floor((clickResult.clicks / clickResult.maxClicks) * 20))}${'░'.repeat(20 - Math.floor((clickResult.clicks / clickResult.maxClicks) * 20))}`,
                            inline: false
                        }
                    ]);
                
                await interaction.update({ embeds: [updatedEmbed] });
                lastUpdate = now;
            } else {
                await interaction.deferUpdate();
            }
            
            // Auto-finalizar si llegó al máximo
            if (clickResult.maxReached) {
                await finishRobberyAndShowResult('max_clicks');
                collector.stop('max_clicks');
            }
        });
        
        collector.on('end', async (collected, reason) => {
            console.log(`🔍 Collector terminado - Razón: ${reason}`);
            
            // Solo finalizar si fue por timeout y no se ha finalizado ya
            if (reason === 'time' && !robberyFinished) {
                await finishRobberyAndShowResult('collector_timeout');
            }
        });
    }

    async handleShopInteraction(interaction) {
        const parts = interaction.customId.split('_');

        if (interaction.isStringSelectMenu()) {
            // customId: shop_category_userId
            const userId = parts[2];
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ Esta tienda no es tuya. Usa `>shop` para abrir la tuya.', ephemeral: true });
            }

            const category = interaction.values[0];
            const fakeMessage = {
                author: interaction.user,
                guild: interaction.guild,
                guildId: interaction.guildId,
                reply: async (options) => await interaction.update(options)
            };
            await this.shop.showShop(fakeMessage, category, 1);

        } else if (interaction.isButton()) {
            // customId: shop_prev_category_page_userId  o  shop_next_category_page_userId
            const userId = parts[parts.length - 1];
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ Esta tienda no es tuya. Usa `>shop` para abrir la tuya.', ephemeral: true });
            }

            if (parts[1] === 'prev' || parts[1] === 'next') {
                const category = parts[2];
                const page = parseInt(parts[3]);
                const fakeMessage = {
                    author: interaction.user,
                    guild: interaction.guild,
                    guildId: interaction.guildId,
                    reply: async (options) => await interaction.update(options)
                };
                await this.shop.showShop(fakeMessage, category, page);
            }
        }
    }

    // Comando para dar items a usuarios (solo admins)
    async giveItemCommand(message, args) {
        if (message.author.bot) return;
        
        // Verificar permisos de admin
        if (!message.member?.permissions.has('Administrator') && !message.author.id === '488110147265232898') {
            await message.reply('❌ No tienes permisos para usar este comando.');
            return;
        }
        if (!await this.validateAdminCommand(message, targetUser, 'giveitem')) return;
        
        const targetUser = message.mentions.users.first();
        const itemId = args[2];
        const quantity = parseInt(args[3]) || 1;
        
        if (!targetUser || !itemId) {
            await message.reply('❌ Uso: `>giveitem @usuario item_id cantidad`');
            return;
        }
        
        const item = this.shop.shopItems[itemId];
        if (!item) {
            await message.reply('❌ Item no encontrado.');
            return;
        }
        
        const user = await this.economy.getUser(targetUser.id);
        const userItems = user.items || {};
        const currentQuantity = userItems[itemId] ? userItems[itemId].quantity : 0;
        
        if (!item.stackable && currentQuantity >= 1) {
            await message.reply(`❌ **${item.name}** no es stackeable y ya lo tienes.`);
            return;
        }
        
        if (currentQuantity + quantity > item.maxStack) {
            await message.reply(`❌ No puedes tener más de **${item.maxStack}** de este item.`);
            return;
        }
        
        if (userItems[itemId]) {
            userItems[itemId].quantity += quantity;
        } else {
            userItems[itemId] = {
                id: itemId,
                quantity: quantity,
                purchaseDate: new Date().toISOString()
            };
        }
        
        await this.economy.updateUser(targetUser.id, { items: userItems });
        
        await message.reply(
            `✅ Se ha dado **${item.name} x${quantity}** a ${targetUser.displayName}.`
        );
    }

    // Comando para ver estadísticas de la tienda
    async shopStatsCommand(message) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            await message.reply('❌ No tienes permisos para usar este comando.');
            return;
        }
        
        // Obtener estadísticas de todos los usuarios
        const allUsers = await this.economy.getAllUsers(); // Implementar según tu DB
        
        let totalItems = 0;
        let totalValue = 0;
        let itemCounts = {};
        let activeEffectsCount = 0;
        
        for (const user of allUsers) {
            if (user.items) {
                for (const [itemId, userItem] of Object.entries(user.items)) {
                    const item = this.shop.shopItems[itemId];
                    if (!item) continue;
                    
                    totalItems += userItem.quantity;
                    totalValue += item.price * userItem.quantity;
                    itemCounts[itemId] = (itemCounts[itemId] || 0) + userItem.quantity;
                }
            }
            
            if (user.activeEffects && Object.keys(user.activeEffects).length > 0) {
                activeEffectsCount++;
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Estadísticas de la Tienda')
            .setColor('#FFD700')
            .addFields(
                { name: '👥 Usuarios con Items', value: `${allUsers.filter(u => u.items && Object.keys(u.items).length > 0).length}`, inline: true },
                { name: '📦 Items Totales', value: `${totalItems}`, inline: true },
                { name: '💰 Valor Total', value: `${totalValue.toLocaleString('es-ES')} π-b$`, inline: true },
                { name: '⚡ Usuarios con Efectos Activos', value: `${activeEffectsCount}`, inline: true }
            );
        
        // Top 5 items más comprados
        const topItems = Object.entries(itemCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([itemId, count]) => {
                const item = this.shop.shopItems[itemId];
                return `${item ? item.name : itemId}: ${count}`;
            });
        
        if (topItems.length > 0) {
            embed.addFields({ 
                name: '🏆 Items Más Populares', 
                value: topItems.join('\n'), 
                inline: false 
            });
        }
        
        await message.reply({ embeds: [embed] });
    }

    async checkAdminPerms(message) {
        if (!message.guild) return false;
        if (message.guild.ownerId === message.author.id) return true;
        
        try {
            // Fetchear el member fresco para asegurar que tenga el guild correcto
            const member = await message.guild.members.fetch(message.author.id);
            if (!member) return false;
            return member.permissions.has(8n) || member.permissions.has(32n);
        } catch (e) {
            console.error('Error verificando permisos:', e.message);
            return message.guild.ownerId === message.author.id;
        }
    }

    async validateAdminCommand(message, targetUser, commandType = 'generic') {
        // No puede usarse sobre uno mismo
        if (targetUser.id === message.author.id) {
            await message.reply('❌ No puedes usar este comando sobre ti mismo.');
            return false;
        }

        if (targetUser.bot) {
            await message.reply('❌ No puedes usar este comando sobre bots.');
            return false;
        }

        // Verificar que el target sea miembro del server
        let targetMember;
        try {
            targetMember = await message.guild.members.fetch(targetUser.id);
        } catch {
            await message.reply('❌ El usuario no es miembro de este servidor.');
            return false;
        }

        // Cuenta del target con menos de 30 días → bloqueado
        const accountAge = Date.now() - targetUser.createdTimestamp;
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (accountAge < thirtyDays) {
            const daysOld = Math.floor(accountAge / (24 * 60 * 60 * 1000));
            await message.reply(`❌ La cuenta destino tiene solo **${daysOld} días** de antigüedad (mínimo 30). Bloqueado por seguridad anti-multicuentas.`);
            return false;
        }

        // Contar miembros reales del server (no bots)
        let realMemberCount;
        try {
            const members = await message.guild.members.fetch();
            realMemberCount = members.filter(m => !m.user.bot).size;
        } catch {
            realMemberCount = message.guild.memberCount; // fallback
        }

        const isSmallServer = realMemberCount < 10;

        if (isSmallServer) {
            const today = new Date().toDateString();
            
            // Leer de DB en lugar de memoria
            const rateData = await this.guildConfig?.getRateLimit(
                message.guild.id, message.author.id, commandType
            );

            let currentCount = 0;

            if (rateData && rateData.date === today) {
                currentCount = rateData.count;
            }
            // Si es un día diferente, currentCount queda en 0 (se resetea solo)

            if (currentCount >= 3) {
                await message.reply(
                    `⚠️ Este servidor tiene menos de 10 miembros reales (${realMemberCount} actualmente).\n` +
                    `Has alcanzado el límite de **3 usos diarios** de \`${commandType}\` en servidores pequeños.\n` +
                    `El límite se reinicia mañana.`
                );
                return false;
            }

            // Guardar en DB
            await this.guildConfig?.setRateLimit(
                message.guild.id, message.author.id, commandType,
                { date: today, count: currentCount + 1 }
            );

            const newCount = currentCount + 1;
            await message.channel.send(
                `ℹ️ Server pequeño detectado (${realMemberCount} miembros). Uso ${newCount}/3 de hoy para \`${commandType}\`.`
            ).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        }

        // Anti-spam: mismo admin → mismo target repetidamente (máx 5 veces en 10 min)
        const spamKey = `spam_${message.author.id}_${targetUser.id}_${commandType}`;
        if (!this._spamTracker) this._spamTracker = new Map();

        const spamData = this._spamTracker.get(spamKey) || { count: 0, firstUse: Date.now() };
        const tenMinutes = 10 * 60 * 1000;

        if (Date.now() - spamData.firstUse > tenMinutes) {
            // Resetear ventana
            this._spamTracker.set(spamKey, { count: 1, firstUse: Date.now() });
        } else {
            spamData.count++;
            this._spamTracker.set(spamKey, spamData);

            if (spamData.count > 5) {
                await message.reply(
                    `🚨 Detectado uso excesivo: has usado \`${commandType}\` sobre ${targetUser} **${spamData.count} veces en 10 minutos**.\n` +
                    `Espera un momento antes de continuar.`
                );
                return false;
            }
        }

        return true;
    }

    async handleSetConfig(message, args) {
        if (!await this.checkAdminPerms(message)) {
            return message.reply('❌ Necesitas tener permisos de administrador para usar este comando.');
        }
        if (!this.guildConfig) {
            return message.reply('❌ Sistema de configuración no disponible.');
        }

        const validKeys = {
            'levelup_channel': '📈 Canal de subida de nivel',
            'events_channel': '🎉 Canal de anuncios de eventos',
            'guild_levelup_channel': '📊 Niveles del servidor — anuncios de level up local'
        };

        const subkey = args[1];
        if (!subkey || subkey === 'help' || !validKeys[subkey]) {
            const embed = new EmbedBuilder()
                .setTitle('⚙️ Configuración del Servidor')
                .setColor('#FFA500')
                .setDescription('Usa `>setchannel <clave> #canal` para configurar cada función.\n\n**Claves disponibles:**')
                .addFields(Object.entries(validKeys).map(([k, v]) => ({ name: `\`${k}\``, value: v, inline: true })))
                .addFields({ name: '📝 Ejemplo', value: '`>setchannel levelup_channel #niveles`', inline: false });
            return message.reply({ embeds: [embed] });
        }

        const channel = message.mentions.channels.first();
        if (!channel) {
            return message.reply('❌ Debes mencionar un canal. Ejemplo: `>setchannel levelup_channel #canal`');
        }

        const existing = await this.guildConfig.get(message.guild.id, subkey);
        await this.guildConfig.set(message.guild.id, subkey, channel.id);
        const action = existing ? 'actualizado' : 'configurado';
        return message.reply(`✅ **${validKeys[subkey]}** ${action} como ${channel}.`);
    }

    async handleShowConfig(message) {
        if (!await this.checkAdminPerms(message)) {
            return message.reply('❌ Necesitas tener permisos de administrador para usar este comando.');
        }
        if (!this.guildConfig) {
            return message.reply('❌ Sistema de configuración no disponible.');
        }

        const config = await this.guildConfig.getAll(message.guild.id);
        const labels = {
            'levelup_channel': '📈 Canal de niveles',
            'events_channel': '🎉 Canal de eventos',
            'events_role': '🔔 Rol de eventos',
            'guild_levelup_channel': '📊 Canal de niveles del servidor',
        };

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Configuración actual del servidor')
            .setColor('#00BFFF');

        if (Object.keys(config).length === 0) {
            embed.setDescription('No hay nada configurado aún. Usa `>setchannel help` para ver cómo hacerlo.');
        } else {
            // Claves que son canales
            const channelKeys = ['levelup_channel', 'events_channel', 'welcome_channel'];
            // Claves que son roles  
            const roleKeys = ['events_role'];
            // Claves internas que NO mostrar
            const hiddenKeys = ['events_globally_enabled', 'guild_levels_enabled', 'guild_levelup_channel'];

            const visibleConfig = Object.entries(config).filter(([k]) => 
                !k.startsWith('event_disabled_') && !hiddenKeys.includes(k)
            );

            if (visibleConfig.length === 0) {
                embed.setDescription('No hay nada configurado aún. Usa `>setconfig help` para ver cómo hacerlo.');
            } else {
                embed.addFields(visibleConfig.map(([k, v]) => ({
                    name: labels[k] || k,
                    value: roleKeys.includes(k) ? `<@&${v}>` : channelKeys.includes(k) ? `<#${v}>` : v,
                    inline: true
                })));
            }

            // Agregar estado de eventos al final
            const globallyEnabled = await this.guildConfig.areEventsEnabled(message.guild.id);
            embed.addFields({
                name: '🎉 Eventos',
                value: globallyEnabled ? '🟢 Habilitados (`>toggleevents` para cambiar)' : '🔴 Deshabilitados (`>toggleevents` para activar)',
                inline: false
            });

            const levelsEnabled = this.guildLevels ? await this.guildLevels.isEnabled(message.guild.id) : false;
            const levelChannel = await this.guildConfig.get(message.guild.id, 'guild_levelup_channel');
            embed.addFields({
                name: '📊 Niveles del Servidor',
                value: [
                    levelsEnabled ? '🟢 Activos (`>disablelevels` para desactivar)' : '🔴 Inactivos (`>enablelevels` para activar)',
                    levelChannel ? `📣 Canal de anuncios: <#${levelChannel}>` : '📣 Sin canal configurado (`>ssetlevelchannel #canal`)'
                ].join('\n'),
                inline: false
            });
        }

        return message.reply({ embeds: [embed] });
    }

    async handleSetEventsRole(message, args) {
        if (!await this.checkAdminPerms(message)) {
            return message.reply('❌ Necesitas tener permisos de administrador para usar este comando.');
        }
        const role = message.mentions.roles.first();
        if (!role) {
            return message.reply('❌ Debes mencionar un rol. Ejemplo: `>seteventsrole @Eventos`');
        }
        const existingRole = await this.guildConfig.getEventsRole(message.guild.id);
        await this.guildConfig.setEventsRole(message.guild.id, role.id);
        const actionRole = existingRole ? 'actualizado' : 'configurado';
        return message.reply(`✅ Rol de eventos ${actionRole} como ${role}. Se usará para pings en anuncios de eventos.`);
    }

    async handleToggleEvent(message, args) {
        if (!await this.checkAdminPerms(message)) {
            return message.reply('❌ Necesitas tener permisos de administrador para usar este comando.');
        }
        if (!this.guildConfig) return message.reply('❌ Sistema de configuración no disponible.');

        const eventType = args[1];
        const availableTypes = Object.keys(this.events.eventTypes);

        if (!eventType || !availableTypes.includes(eventType)) {
            const disabledEvents = await this.guildConfig.getDisabledEvents(message.guild.id);
            const embed = new EmbedBuilder()
                .setTitle('🔧 Habilitar/Deshabilitar Eventos')
                .setColor('#FFA500')
                .setDescription('Usa `>toggleevent <tipo>` para activar o desactivar un tipo de evento.')
                .addFields(
                    { name: '🎮 Eventos disponibles', value: availableTypes.map(t => {
                        const ev = this.events.eventTypes[t];
                        const disabled = disabledEvents.includes(t);
                        return `${disabled ? '🔴' : '🟢'} \`${t}\` — ${ev.name}`;
                    }).join('\n'), inline: false },
                    { name: '💡 Ejemplo', value: '`>toggleevent market_crash` — Desactiva/activa la Crisis del Mercado', inline: false }
                );
            return message.reply({ embeds: [embed] });
        }

        const currentlyEnabled = await this.guildConfig.isEventEnabled(message.guild.id, eventType);
        await this.guildConfig.setEventEnabled(message.guild.id, eventType, !currentlyEnabled);
        const ev = this.events.eventTypes[eventType];
        const status = currentlyEnabled ? '🔴 deshabilitado' : '🟢 habilitado';
        return message.reply(`✅ Evento **${ev.emoji} ${ev.name}** ahora está **${status}** en este servidor.`);
    }

    async handleToggleAllEvents(message) {
        if (!await this.checkAdminPerms(message)) {
            return message.reply('❌ Necesitas tener permisos de administrador para usar este comando.');
        }
        if (!this.guildConfig) return message.reply('❌ Sistema de configuración no disponible.');

        const currentlyEnabled = await this.guildConfig.areEventsEnabled(message.guild.id);
        const isFirst = await this.guildConfig.setEventsGloballyEnabled(message.guild.id, !currentlyEnabled);

        if (!currentlyEnabled) {
            return message.reply('✅ **Eventos habilitados** en este servidor. Los eventos automáticos y manuales ya están activos.');
        } else {
            return message.reply('🔴 **Eventos deshabilitados** en este servidor. No se crearán eventos automáticos ni manuales hasta que los reactives con `>toggleevents`.');
        }
    }

    async processCommand(message) {
        // Verificar ingresos pasivos pendientes
        await this.economy.checkPendingPassiveIncome(message.author.id);
        await this.economy.shop.checkAndNotifyExpiredItems(message.author.id, message);
        await this.shop.cleanupExpiredTokens(message.author.id);
        await this.trades.cleanupExpiredTrades();
        await this.economy.missions.updateMissionProgress(message.author.id, 'commands_used');

        const args = message.content.trim().split(/ +/g);
        const command = args[0].toLowerCase();
        const betId = args[1];
/*
const commandName = command.replace('>', '');
        await this.economy.missions.updateMissionProgress(message.author.id, 'unique_commands_used', commandName);*/

        try {
            switch (command) {        
                case '>setchannel':
                    await this.handleSetConfig(message, args);
                    break;
                case '>svconfig':
                    await this.handleShowConfig(message);
                    break;
                case '>seteventsrole':
                    await this.handleSetEventsRole(message, args);
                    break;
                case '>toggleevent':
                    await this.handleToggleEvent(message, args);
                    break;
                case '>toggleevents':
                    await this.handleToggleAllEvents(message);
                    break;
                case '>balance':
                case '>bal':
                case '>money':
                    const targetUserm = message.mentions.members.first();
                    await this.handleBalance(message, targetUserm);
                    break;
                case '>daily':
                    await this.handleDaily(message);
                    break;
                case '>level':
                case '>lvl':
                case '>rank':
                    const levelTargetUser = message.mentions.members.first();
                    await this.handleLevel(message, levelTargetUser);
                    break;
                case '>pay':
                case '>transfer':
                    await this.handlePay(message);
                    break;
                case '>top':
                case '>leaderboard':
                case '>lb':
                    await this.handleTop(message, message.client);
                    break;
                case '>work':
                case '>job':
                    await this.handleWork(message);
                    break;
                case '>robar':
                case '>rob':
                    await this.handleRobberyCommand(message, args)
                    break;
                case '>addmoney':
                case '>givemoney':
                case '>givem':
                case '>addm':
                    await this.handleAddMoney(message);
                    break;
                case '>removemoney':
                case '>removem':
                    await this.handleRemoveMoney(message);
                    break;
                case '>addxp':
                    await this.handleAddXp(message);
                    break;          

                // Betting
                case '>bet':
                case '>apuesta':
                    await this.betting.createBet(message, args);
                    break;
                case '>acceptbet':
                    await this.betting.acceptBet(message);
                    break;
                case '>declinebet':
                    await this.betting.declineBet(message, args);
                    break;
                case '>resolvebet':
                    const winner = args[2];
                    await this.betting.resolveBet(message, betId, winner);
                    break;
                case '>cancelbet':
                    await this.betting.cancelBet(message, betId);
                    break;
                case '>mybets':
                case '>misapuestas':
                    await this.betting.showActiveBets(message);
                    break;
                case '>betstats':
                case '>estadisticasapuestas':
                    const targetUserb = message.mentions.members?.first();
                    await this.betting.showBetStats(message, targetUserb);
                    break;
                case '>events':
                    await this.events.showActiveEvents(message);
                    break;
                case '>createevent':
                    if (!args[1]) {
                        const availableTypes = Object.keys(this.events.eventTypes);
                        const embed = new EmbedBuilder()
                            .setTitle('🎉 Crear Evento Manual')
                            .setColor('#9932CC')
                            .setDescription('Crea un evento manualmente en el servidor.')
                            .addFields(
                                { name: '📝 Uso', value: '`>createevent <tipo> [duración_en_minutos]`', inline: false },
                                { name: '🎮 Tipos disponibles', value: availableTypes.map(t => {
                                    const ev = this.events.eventTypes[t];
                                    return `\`${t}\` — ${ev.emoji} ${ev.name}`;
                                }).join('\n'), inline: false },
                                { name: '💡 Ejemplo', value: '`>createevent double_xp 30` — Activa doble XP por 30 minutos', inline: false },
                                { name: '⏰ Duración', value: 'Si no especificas duración, se usará la duración aleatoria del evento.', inline: false }
                            )
                            .setTimestamp();
                        return message.reply({ embeds: [embed] });
                    }
                    const eventType = args[1];
                    const duration = args[2] ? parseInt(args[2]) : null;
                    // Verificar si eventos están habilitados en este server
                    if (this.guildConfig) {
                        const globallyEnabled = await this.guildConfig.areEventsEnabled(message.guild.id);
                        if (!globallyEnabled) {
                            return message.reply('❌ Los eventos están deshabilitados en este servidor. Usa `>toggleevents` para activarlos primero.');
                        }
                    }
                    await this.events.createManualEvent(message, eventType, duration);
                    break;
                case '>eventstats':
                    await this.events.showEventStats(message);
                    break;
                case '>trade':
                    if (!message.mentions.users.size) {
                        const embed = new EmbedBuilder()
                            .setTitle('🔄 Sistema de Intercambio - Guía')
                            .setDescription('Aprende a intercambiar items y dinero con otros usuarios')
                            .addFields(
                                {
                                    name: '📝 Comandos Básicos',
                                    value: '`>trade @usuario` - Iniciar intercambio\n`>tradeadd <item_id> [cantidad]` - Agregar item\n`>trademoney <cantidad>` - Agregar dinero\n`>tradeaccept` - Aceptar intercambio\n`>tradecancel` - Cancelar intercambio',
                                    inline: false
                                },
                                {
                                    name: '⚠️ Reglas Importantes',
                                    value: '• Ambos usuarios deben ofrecer algo\n• Solo 5 minutos para completar\n• No puedes tener múltiples trades activos\n• Una vez aceptado por ambos, es irreversible',
                                    inline: false
                                },
                                {
                                    name: '🔄 Proceso paso a paso',
                                    value: '1️⃣ Inicia el trade con `>trade @usuario`\n2️⃣ Ambos agregan items/dinero\n3️⃣ Ambos aceptan con `>tradeaccept`\n4️⃣ ¡Intercambio completado!',
                                    inline: false
                                },
                                {
                                    name: '💡 Ejemplos',
                                    value: '`>trade @Juan123`\n`>tradeadd lucky_charm 2`\n`>trademoney 5000`\n`>tradeaccept`',
                                    inline: false
                                }
                            )
                            .setColor('#00FF00')
                            .setFooter({ text: 'Los trades expiran en 5 minutos automáticamente' })
                            .setTimestamp();
                        
                        await message.reply({ embeds: [embed] });
                        return;
                    }
                    const targetUser = message.mentions.users.first();
                    await this.trades.startTrade(message, targetUser);
                    break;
                case '>tradeadd':
                    if (!args[1]) {
                        await message.reply('❌ Especifica el item: `>tradeadd <item_id> [cantidad]`');
                        return;
                    }
                    const quantity = parseInt(args[2]) || 1;
                    await this.trades.addItemToTrade(message, args[1], quantity);
                    break;
                    
                case '>trademoney':
                    if (!args[1]) {
                        await message.reply('❌ Especifica la cantidad: `>trademoney <cantidad>`');
                        return;
                    }
                    const amount = parseInt(args[1]);
                    await this.trades.addMoneyToTrade(message, amount);
                    break;
                    
                case '>tradeaccept':
                    await this.trades.acceptTrade(message);
                    break;
                    
                case '>tradecancel':
                    const tradeData = await this.trades.getActiveTradeByUser(message.author.id);
                    if (tradeData) {
                        await this.trades.cancelTrade(tradeData, 'manual');
                        await message.reply('✅ Intercambio cancelado.');
                    } else {
                        await message.reply('❌ No tienes ningún intercambio activo.');
                    }
                    break;    
                case '>tradeshow':
                case '>tradever':
                    const currentTrade = await this.trades.getActiveTradeByUser(message.author.id);
                    if (!currentTrade) {
                        await message.reply('❌ No tienes ningún intercambio activo.');
                        return;
                    }
                    
                    await this.trades.updateTradeEmbed(message.channel, currentTrade);
                    break;
                case '>auction':
                case '>auctions':
                    if (args.length < 3) {
                        const embed = new EmbedBuilder()
                            .setTitle('🔨 Sistema de Subastas - Guía')
                            .setDescription('Aprende a subastar tus items')
                            .addFields(
                                {
                                    name: '📝 Comandos Básicos',
                                    value: '`>auction item_id precio_inicial duracion_en_minutos` - Iniciar Subasta\n`>auctionshow` - Mostrar Subastas Activas\n`>bid auction_id cantidad` - Agregar dinero a la subasta',
                                    inline: false
                                },
                                {
                                    name: '⚠️ Reglas Importantes',
                                    value: '• La subasta dura lo especificado por el usuario que la crea\n• Una vez terminada la subasta, se le dará el item a quien mas dinero dió',
                                    inline: false
                                },
                                {
                                    name: '🔄 Proceso paso a paso',
                                    value: '1️⃣ Inicia la subasta con `>auction item_id precio_inicial duracion_en_minutos`\n2️⃣ Cualquiera usa `>bid auction_id cantidad` para seguir agregando dinero a la subasta\n4️⃣ ¡Subasta completada!',
                                    inline: false
                                },
                                {
                                    name: '💡 Ejemplos',
                                    value: '`>auction lucky_charm 8000 5`\n`>bid <id> 8500`',
                                    inline: false
                                }
                            )
                            .setColor('#00FF00')
                            .setTimestamp();
                        
                        await message.reply({ embeds: [embed] });
                        return;
                    }
                    const durations = parseInt(args[3]) || 60;
                    await this.auctions.createAuction(message, args[1], parseInt(args[2]), durations * 60000);
                    break;
                    
                case '>bid':
                    if (args.length < 3) {
                        await message.reply('❌ Uso: `>bid auction_id cantidad`');
                        return;
                    }
                    await this.auctions.placeBid(message, args[1], parseInt(args[2]));
                break;
                    
                case '>auctionshow':
                case '>showsubastas':
                    const auctions = await this.economy.database.getActiveAuctions();
                    if (auctions.length === 0) {
                        await message.reply('📋 No hay subastas activas.');
                        return;
                    }
                    
                    const embed = new EmbedBuilder()
                        .setTitle('🔨 Subastas Activas')
                        .setColor('#FF6600');
                    
                    for (const auction of auctions.slice(0, 5)) {
                        const timeLeft = Math.max(0, new Date(auction.ends_at) - Date.now());
                        const minutes = Math.floor(timeLeft / 60000);
                        
                        embed.addFields({
                            name: `${auction.item_name}`,
                            value: `💰 Puja actual: ${auction.current_bid.toLocaleString('es-ES')} π-b$\n⏰ ${minutes}m restantes\n🆔 ${auction.id}`,
                            inline: true
                        });
                    }
                    
                    await message.reply({ embeds: [embed] });
                    break;
                    
                case '>recipes':
                    await this.crafting.showCraftingRecipes(message);
                    break;                    
                case '>craft':
                    if (!args[1]) {
                        await message.reply('❌ Especifica la receta. Usa `>recipes` para ver las disponibles.');
                        return;
                    }
                    await this.crafting.craftItem(message, args.slice(1)); // Pasar array desde el segundo elemento
                    break;
                case '>queue':
                case '>craftqueue':
                    await this.crafting.showCraftingQueue(message);
                    break;
                
                case '>cancelcraft':
                    if (!args[1]) {
                        // Mostrar embed de ayuda
                        const helpEmbed = {
                            color: 0x3498db,
                            title: '🚫 Cancelar Crafteo - Ayuda',
                            description: 'Este comando te permite cancelar crafteos en progreso.',
                            fields: [
                                {
                                    name: '📋 Uso',
                                    value: '`>craftqueue` - Ver lista de crafteos\n`>cancelcraft <número>` - Cancelar crafteo específico',
                                    inline: false
                                },
                                {
                                    name: '⚠️ Importante',
                                    value: 'Solo recibirás el **80%** de los materiales de vuelta.',
                                    inline: false
                                },
                                {
                                    name: '📝 Ejemplos',
                                    value: '`>craftqueue` - Ver tus crafteos\n`>cancelcraft 1` - Cancelar el crafteo #1\n`>cancelcraft 2` - Cancelar el crafteo #2',
                                    inline: false
                                }
                            ],
                            footer: { text: 'Usa >craftqueue para ver todos tus crafteos activos' }
                        };
                        
                        await message.channel.send({ embeds: [helpEmbed] });
                        return;
                    }
                    
                    await this.crafting.cancelCraft(message, args.slice(1));
                    break;

                case '>giveitem':
                    await this.giveItemCommand(message, args);
                    break;
                case '>shopstats':
                    await this.shopStatsCommand(message);
                    break;
                case '>clear':
                    await this.handleClear(message);
                    break;
                case '>hola':
                        await message.reply('Hola, Como estás? \n\nRIP Pibe10 Bot 🥀');
                        break;
                case '>help':
                    await this.showHelp(message);
                    break;
                default:
                    // No es un comando de economía
                    break;
            }
        } catch (error) {
            console.error('❌ Error procesando comando:', error);
            await message.reply('❌ Ocurrió un error al procesar el comando. Intenta de nuevo.');
        }
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

    async showHelp(message, category = 'main') {
        const embed = new EmbedBuilder()
            .setColor('#00BFFF')
            .setTimestamp();
        
        if (category === 'main') {
            embed.setTitle('📖 Menú de Ayuda Principal')
                .setDescription('Selecciona una categoría para ver sus comandos:')
                .addFields(
                    { name: '⚙️ Admin', value: 'Configuración del servidor', inline: true },
                    { name: '💰 Economía', value: 'Dinero, trabajo, daily', inline: true },
                    { name: '🛒 Tienda', value: 'Shop, items, efectos', inline: true },
                    { name: '🎮 Minijuegos', value: 'Gambling y juegos', inline: true },
                    { name: '🎲 Apuestas', value: 'Sistema de apuestas', inline: true },
                    { name: '🔄 Trading', value: 'Intercambios y subastas', inline: true },
                    { name: '⚒️ Crafteo', value: 'Recetas y fabricación', inline: true },
                    { name: '🏆 Progreso', value: 'Logros y misiones', inline: true },
                    { name: '👑 VIP', value: 'Comandos premium', inline: true },
                    { name: '🎵 Música', value: 'Reproductor de música', inline: true },
                    { name: '🎨 Imágenes IA', value: 'Genera imágenes con IA', inline: true },
                );
            
            const eventsEnabled = this.guildConfig 
                ? await this.guildConfig.areEventsEnabled(message.guild?.id)
                : true;

            // Solo agregar botón admin si tiene permisos (evita duplicados)
            const isAdmin = message.member?.permissions?.has('ManageGuild');

            // BOTONES para cada categoría
            const uid = message.author.id;
            const rows = [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`help_economy_${uid}`).setLabel('💰 Economía').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_shop_${uid}`).setLabel('🛒 Tienda').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_games_${uid}`).setLabel('🎮 Minijuegos').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_betting_${uid}`).setLabel('🎲 Apuestas').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_trading_${uid}`).setLabel('🔄 Trading').setStyle(ButtonStyle.Primary)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`help_craft_${uid}`).setLabel('⚒️ Crafteo').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_auctions_${uid}`).setLabel('🔨 Subastas').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_progress_${uid}`).setLabel('🏆 Progreso').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_vip_${uid}`).setLabel('👑 VIP').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_music_${uid}`).setLabel('🎵 Música').setStyle(ButtonStyle.Primary)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`help_nsfw_${uid}`).setLabel('🔞 NSFW').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_events_${uid}`).setLabel(eventsEnabled ? '🎉 Eventos' : '🔴 Eventos').setStyle(eventsEnabled ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`help_chatIA_${uid}`).setLabel('🤖 Chat IA').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_imagine_${uid}`).setLabel('🎨 Imágenes IA').setStyle(ButtonStyle.Primary)
                ),
            ];

            if (isAdmin) {
                rows.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`help_admin_${uid}`).setLabel('🛡️ Admin').setStyle(ButtonStyle.Danger)
                ));
            }

            await message.reply({ embeds: [embed], components: rows });
            return;
        }
        
        // CATEGORÍAS INDIVIDUALES (más cortas)
        const categories = {
            admin: {
                title: '🛡️ Administración',
                fields: [
                    { name: '⚙️ Configuración', value: '─────────────────', inline: false },
                    { name: '>svconfig', value: 'Ver configuración actual del servidor', inline: true },
                    { name: '>setchannel <clave> #canal', value: 'Configurar un canal\n`levelup_channel` `events_channel` `guild_levelup_channel`', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '📊 Niveles del Servidor (Son diferentes a los niveles de Economía)', value: '─────────────────', inline: false },
                    { name: '>enablelevels', value: 'Activar sistema de niveles', inline: true },
                    { name: '>disablelevels', value: 'Desactivar sistema de niveles', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🎉 Eventos', value: '─────────────────', inline: false },
                    { name: '>toggleevents', value: 'Activar/desactivar todos los eventos', inline: true },
                    { name: '>toggleevent [tipo]', value: 'Activar/desactivar un tipo específico', inline: true },
                    { name: '>seteventsrole @rol', value: 'Rol para pings de eventos', inline: true },
                    { name: '>createevent <tipo> [min]', value: 'Crear evento manual', inline: true },
                    { name: '>eventstats', value: 'Estadísticas de eventos', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🔨 Moderación', value: '─────────────────', inline: false },
                    { name: '>clear [cantidad]', value: 'Borrar mensajes del canal', inline: true },
                ]
            },
            economy: {
                title: '💰 Economía',
                fields: [
                    { name: '💳 Dinero', value: '─────────────────', inline: false },
                    { name: '>balance', value: 'Ver tu saldo y nivel', inline: true },
                    { name: '>daily', value: 'Recompensa diaria', inline: true },
                    { name: '>pay @user <cantidad>', value: 'Transferir dinero a alguien', inline: true },

                    { name: '💼 Trabajo', value: '─────────────────', inline: false },
                    { name: '>work [tipo]', value: 'Trabajar para ganar dinero', inline: true },
                    { name: '>robar @user', value: 'Intentar robar dinero', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🏆 Rankings', value: '─────────────────', inline: false },
                    { name: '>top', value: 'Top dinero del servidor', inline: true },
                    { name: '>top level', value: 'Top niveles del servidor', inline: true },
                    { name: '>top global', value: 'Rankings globales', inline: true },
                ]
            },
            shop: {
                title: '🛒 Tienda',
                fields: [
                    { name: '🏪 Comprar', value: '─────────────────', inline: false },
                    { name: '>shop', value: 'Ver la tienda completa', inline: true },
                    { name: '>shop <categoría>', value: 'Filtrar por categoría\n`consumable` `permanent` `trivia` `mystery`', inline: true },
                    { name: '>buy <item_id> [cantidad]', value: 'Comprar un item', inline: true },

                    { name: '🎒 Inventario', value: '─────────────────', inline: false },
                    { name: '>bag', value: 'Ver tu inventario', inline: true },
                    { name: '>useitem <item_id>', value: 'Usar un item consumible', inline: true },
                    { name: '>effects', value: 'Ver efectos activos', inline: true },
                    { name: '>cosmeticos', value: 'Ver cosméticos equipados', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                ]
            },
            vip: {
                title: '👑 VIP',
                fields: [
                    { name: '📋 Info', value: '─────────────────', inline: false },
                    { name: '>vip', value: 'Ver tu estado VIP y beneficios', inline: true },
                    { name: '>viphelp', value: 'Guía completa de VIP', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '⚡ Comandos VIP', value: '─────────────────', inline: false },
                    { name: '>vipwork', value: 'Trabajo exclusivo VIP', inline: true },
                    { name: '>vipdaily', value: 'Daily mejorado VIP', inline: true },
                    { name: '>vipgamble', value: 'Apuestas VIP', inline: true },
                    { name: '>vipboost', value: 'Activar boost VIP', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                ]
            },
            games: {
                title: '🎮 Minijuegos',
                fields: [
                    { name: '📋 Ver Juegos', value: '─────────────────', inline: false },
                    { name: '>games', value: 'Lista completa con límites y premios', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🎰 Azar', value: '─────────────────', inline: false },
                    { name: '>coinflip <cara/cruz> <apuesta>', value: '100 – 5,000 π-b$', inline: true },
                    { name: '>dice <tipo> <apuesta>', value: '100 – 5,000 π-b$', inline: true },
                    { name: '>lottery <número> <apuesta>', value: '500 – 3,000 π-b$', inline: true },
                    { name: '>slots <apuesta>', value: '100 – 8,000 π-b$', inline: true },
                    { name: '>roulette <tipo> <apuesta>', value: '100 – 15,000 π-b$', inline: true },
                    { name: '>vending', value: 'Máquina expendedora (10 π-b$)', inline: true },

                    { name: '🃏 Cartas & Multijugador', value: '─────────────────', inline: false },
                    { name: '>blackjack <apuesta>', value: '100 – 10,000 π-b$', inline: true },
                    { name: '>ujoin <apuesta>', value: 'UNO — 2 a 8 jugadores', inline: true },
                    { name: '>russian <apuesta>', value: 'Ruleta Rusa — 2 a 6 jugadores', inline: true },
                    { name: '>horses <bot/multi> <apuesta>', value: 'Carrera de Caballos', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🧠 Trivia', value: '─────────────────', inline: false },
                    { name: '>trivia [dificultad] [modo] [cat]', value: 'Trivia clásica — Gratis', inline: true },
                    { name: '>triviasurvival start', value: 'Modo supervivencia', inline: true },
                    { name: '>triviacomp <apuesta>', value: 'Competitiva multijugador', inline: true },
                    { name: '>trivialb [tipo]', value: 'Rankings de trivia', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                ]
            },
            betting: {
                title: '🎲 Apuestas',
                fields: [
                    { name: '➕ Crear', value: '─────────────────', inline: false },
                    { name: '>bet @usuario <cantidad> <descripción>', value: 'Crear una apuesta directa', inline: true },
                    { name: '>acceptbet <id>', value: 'Aceptar apuesta pendiente', inline: true },
                    { name: '>declinebet <id>', value: 'Rechazar apuesta', inline: true },

                    { name: '⚙️ Gestionar', value: '─────────────────', inline: false },
                    { name: '>resolvebet <id> @ganador', value: 'Resolver apuesta (declarar ganador)', inline: true },
                    { name: '>cancelbet <id>', value: 'Cancelar y devolver apuestas', inline: true },
                    { name: '>mybets', value: 'Ver tus apuestas activas', inline: true },
                    { name: '>betstats [@usuario]', value: 'Estadísticas de victorias/derrotas', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                ]
            },
            trading: {
                title: '🔄 Intercambios',
                fields: [
                    { name: '🤝 Iniciar', value: '─────────────────', inline: false },
                    { name: '>trade @usuario', value: 'Iniciar intercambio con alguien', inline: true },
                    { name: '>tradeshow', value: 'Ver intercambios activos', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '➕ Ofrecer', value: '─────────────────', inline: false },
                    { name: '>tradeadd <item_id> [cantidad]', value: 'Agregar item a tu oferta', inline: true },
                    { name: '>trademoney <cantidad>', value: 'Agregar dinero a tu oferta', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '✅ Confirmar', value: '─────────────────', inline: false },
                    { name: '>tradeaccept', value: 'Confirmar y ejecutar intercambio', inline: true },
                    { name: '>tradecancel', value: 'Cancelar intercambio activo', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                ]
            },
            auctions: {
                title: '🔨 Subastas',
                fields: [
                    { name: '📦 Subastar', value: '─────────────────', inline: false },
                    { name: '>auction <item_id> <precio> [minutos]', value: 'Poner un item en subasta', inline: true },
                    { name: '>auctions', value: 'Ver subastas activas ahora', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '💰 Pujar', value: '─────────────────', inline: false },
                    { name: '>bid <auction_id> <cantidad>', value: 'Hacer una puja', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                ]
            },
            craft: {
                title: '⚒️ Crafteo',
                fields: [
                    { name: '📖 Recetas', value: '─────────────────', inline: false },
                    { name: '>recipes', value: 'Ver todas las recetas disponibles', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🔨 Craftear', value: '─────────────────', inline: false },
                    { name: '>craft <recipe_id>', value: 'Iniciar crafteo de un item', inline: true },
                    { name: '>craftqueue', value: 'Ver tu cola de crafteo', inline: true },
                    { name: '>cancelcraft <craft_id>', value: 'Cancelar un crafteo en progreso', inline: true },
                ]
            },
            progress: {
                title: '🎯 Progreso',
                fields: [
                    { name: '📋 Misiones', value: '─────────────────', inline: false },
                    { name: '>missions', value: 'Ver misiones diarias activas', inline: true },
                    { name: '>blockmissions', value: 'Silenciar notificaciones', inline: true },
                    { name: '>unblockmissions', value: 'Activar notificaciones', inline: true },

                    { name: '🏆 Logros', value: '─────────────────', inline: false },
                    { name: '>achievements [@usuario]', value: 'Ver logros desbloqueados', inline: true },
                    { name: '>allachievements', value: 'Ver todos los logros posibles', inline: true },
                    { name: '>progress', value: 'Ver progreso de cada logro', inline: true },
                    { name: '>detectachievements', value: 'Revisar logros pendientes', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '📊 Niveles', value: '─────────────────', inline: false },
                    { name: '>level [@usuario]', value: 'Ver nivel global', inline: true },
                    { name: '>slevel', value: 'Ver tu nivel en este servidor', inline: true },
                    { name: '>stop', value: 'Top 10 niveles del servidor', inline: true },
                ]
            },
            events: {
                title: '🎉 Eventos',
                fields: [
                    { name: '📅 Ver Eventos', value: '─────────────────', inline: false },
                    { name: '>events', value: 'Ver eventos activos en este servidor', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                ]
            },
            chatIA: {
                title: '🤖 Chat IA',
                fields: [
                    { name: '💬 Cómo chatear', value: '─────────────────', inline: false },
                    { name: 'Mencionar al bot', value: 'Escríbele directamente con @Pibot', inline: true },
                    { name: 'Responder un mensaje', value: 'Haz reply a cualquier mensaje del bot', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '>chathelp', value: 'Ver todos los comandos de chat', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                ]
            },
            nsfw: {
                title: '🔞 NSFW',
                fields: [
                    { name: '🔍 Buscar', value: '─────────────────', inline: false },
                    { name: '>nsfw <categoría> <cantidad>', value: 'Buscar contenido por categoría', inline: true },
                    { name: '>r34 <tags> <cantidad>', value: 'Buscar por tags\n`>r34 pokemon 5`', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🎞️ Formato', value: '─────────────────', inline: false },
                    { name: '>gifs <categoría> <cantidad>', value: 'Solo GIFs animados', inline: true },
                    { name: '>videos <categoría> <cantidad>', value: 'Solo videos MP4/WEBM', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🎲 Especiales', value: '─────────────────', inline: false },
                    { name: '>fuck [@usuario]', value: 'Requiere mención o reply', inline: true },
                    { name: '>fuckdetect / >fd', value: 'FuckDetect con mención o reply', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                ]
            },
            music: {
                title: '🎵 Música',
                fields: [
                    { name: '🎧 Reproducir', value: '─────────────────', inline: false },
                    { name: '>m play <canción/URL>', value: 'Reproducir canción o playlist', inline: true },
                    { name: '>m search <canción>', value: 'Buscar y elegir canción', inline: true },
                    { name: '>spsearch <canción>', value: 'Buscar en Spotify', inline: true },

                    { name: '⏯️ Controles', value: '─────────────────', inline: false },
                    { name: '>m pause / >m resume', value: 'Pausar / Reanudar', inline: true },
                    { name: '>m skip', value: 'Saltar canción actual', inline: true },
                    { name: '>m stop', value: 'Detener y vaciar cola', inline: true },
                    { name: '>m queue', value: 'Ver cola de reproducción', inline: true },
                    { name: '>m volume <0-100>', value: 'Ajustar volumen', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '📋 Más comandos', value: '─────────────────', inline: false },
                    { name: '>m help', value: 'Ver lista completa de comandos de música', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                ]
            },
            imagine: {
                title: '🎨 Generación de Imágenes IA',
                fields: [
                    { name: '🖼️ Generar', value: '─────────────────', inline: false },
                    { name: '>imagine <descripción>', value: 'Generar imagen con IA', inline: true },
                    { name: '>img <descripción>', value: 'Alias corto de imagine', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '💡 Consejos', value: '─────────────────', inline: false },
                    { name: 'Ejemplo', value: '`>imagine un gato astronauta en la luna al estilo anime`', inline: false },
                    { name: '⏳ Cooldown', value: '15 segundos entre imágenes', inline: true },
                    { name: '📡 Proveedores', value: 'Pixazo → ImageGPT → ModelsLab → Cloudflare', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                ]
            },
        };
        
        const cat = categories[category];
        if (cat) {
            embed.setTitle(cat.title).addFields(...cat.fields);
            
            const backButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`help_main_${message.author.id}`)
                    .setLabel('⬅️ Volver al Menú')
                    .setStyle(ButtonStyle.Secondary)
            );
            
            await message.reply({ embeds: [embed], components: [backButton] });
        }
    }

    // MANEJAR interacciones de botones
    async handleHelpInteraction(interaction) {
        // Extraer categoría y userId del customId (formato: help_categoria_userId)
        const parts = interaction.customId.split('_');
        // El userId es la última parte, la categoría puede tener _ (ej: help_chatIA_123)
        const userId = parts[parts.length - 1];
        const category = parts.slice(1, -1).join('_'); // todo entre "help_" y "_userId"

        // Verificar que es el usuario que invocó el help
        if (interaction.user.id !== userId) {
            return interaction.reply({
                content: '❌ Este menú de ayuda no es tuyo. Usa `>help` para abrir el tuyo.',
                ephemeral: true
            });
        }

        if (category === 'admin' && !await this.checkAdminPerms({ 
            guild: interaction.guild, 
            author: interaction.user, 
            member: interaction.member 
        })) {
            return interaction.reply({ 
                content: '❌ Solo administradores pueden ver esta sección.', 
                ephemeral: true 
            });
        }

        if (category === 'events' && this.guildConfig) {
            const enabled = await this.guildConfig.areEventsEnabled(interaction.guild?.id);
            if (!enabled) {
                return interaction.reply({ 
                    content: '❌ Los eventos están deshabilitados en este servidor.',
                    ephemeral: true 
                });
            }
        }

        const fakeMessage = {
            author: interaction.user,
            member: interaction.member,
            guild: interaction.guild,
            reply: async (options) => {
                await interaction.update(options);
            }
        };

        await this.showHelp(fakeMessage, category);
    }
}

module.exports = AllCommands;
