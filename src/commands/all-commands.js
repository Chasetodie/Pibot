const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class AllCommands {
    constructor(economySystem, shopSystem, tradeSystem, auctionSystem, craftingSystem,  eventsSystem, bettingSystem, achievementsSystem, guildLevels, guildConfig, maintenance) {
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
        this.maintenance = maintenance;
        const WorkMinigames = require('../systems/work-minigames');
        this.workMinigames = new WorkMinigames();
        const RobMinigameHandler = require('../systems/rob-minigame-handler');
        this.robMinigames = new RobMinigameHandler();
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

        const equippedCosmetics = await this.shop.getEquippedCosmetics(userId);
        const vipStatus = await this.getVipStatus(userId);

        // Badges de cosméticos
        let badgesString = '';
        if (equippedCosmetics.length > 0) {
            let badges = [];
            for (const cosmetic of equippedCosmetics) {
                const item = this.shop.shopItems[cosmetic.id];
                if (item) {
                    const emojiMatch = item.name.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u);
                    badges.push(emojiMatch ? emojiMatch[0] : '✨');
                }
            }
            badgesString = badges.length > 0 ? ` ${badges.join('')}` : '';
        }

        // Apodo cosmético
        const cosmeticNickname = user.cosmetic_nickname;
        let decoratedTitle = cosmeticNickname
            ? `💰 ${displayName} ✦ ${cosmeticNickname}${badgesString}`
            : `💰 ${displayName}${badgesString}`;

        if (vipStatus.hasVip) decoratedTitle = `👑 ${decoratedTitle}`;

        // Color y rol cosmético
        const cosmeticRole = user.cosmetic_role;
        let embedColor = vipStatus.hasVip ? '#FFD700' : '#0099FF';
        if (cosmeticRole?.color) embedColor = cosmeticRole.color;

        const embed = new EmbedBuilder()
            .setTitle(decoratedTitle)
            .setColor(embedColor)
            .setThumbnail(avatarUrl)
            .addFields(
                { name: `π-b Coins`, value: `**${this.formatNumber(user.balance)}**`, inline: true },
                { name: '📊 Nivel', value: `**${user.level}**`, inline: true },
                { name: '⭐ XP Total', value: `**${this.formatNumber(user.total_xp)}**`, inline: true },
                { name: '📈 Progreso al Siguiente Nivel', value: `\`${progressBar}\` ${progressPercentage}%\n**${this.formatNumber(xpProgress)}** / **${this.formatNumber(xpForNextLevel)}** XP\n*Faltan ${this.formatNumber(xpNeeded)} XP*`, inline: false },
                { name: '💬 Mensajes Enviados', value: `${this.formatNumber(user.messages_count)}`, inline: true },
                { name: '🌱 Racha de Presencia', value: `${user.presence_streak || 0} días`, inline: true },
                { name: '⚔️ Profesión', value: user.profession ? this.economy.PROFESSIONS[user.profession]?.name || 'Ninguna' : 'Ninguna', inline: true },
                { name: '📥 Total Ganado', value: `${this.formatNumber(user.stats.totalEarned)} ${this.economy.config.currencySymbol}`, inline: true },
                { name: '📤 Total Gastado', value: `${this.formatNumber(user.stats.totalSpent)} ${this.economy.config.currencySymbol}`, inline: true }
            );

        // Mostrar rol cosmético si tiene
if (cosmeticRole?.name) {
    embed.addFields({
        name: '\u200b',
        value: `╔════════════════════╗\n✦ **${cosmeticRole.name}**${cosmeticRole.color ? `  —  ${cosmeticRole.color}` : ''}\n╚════════════════════╝`,
        inline: false
    });
}
        
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

    async handleRachas(message) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
        const streak = user.presence_streak || 0;
        const lastPresence = user.last_presence || 0;

        const nextMilestone = [3, 7, 15, 30].find(m => m > streak) || null;
        const daysToNext = nextMilestone ? nextMilestone - streak : null;

        const milestoneText =
            `${streak >= 3  ? '✅' : '⬜'} 3 días — Notificación de racha\n` +
            `${streak >= 7  ? '✅' : '⬜'} 7 días — +500π\n` +
            `${streak >= 15 ? '✅' : '⬜'} 15 días — +2,000π + Energy Drink\n` +
            `${streak >= 30 ? '✅' : '⬜'} 30 días — +10,000π + Mystery Box`;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🌱 Racha de Presencia')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🔥 Racha actual', value: `**${streak}** días`, inline: true },
                { name: '📅 Última conexión', value: lastPresence ? `<t:${Math.floor(lastPresence / 1000)}:R>` : 'Nunca', inline: true },
                { name: '🎯 Próximo hito', value: nextMilestone ? `${nextMilestone} días (faltan **${daysToNext}**)` : '🏆 ¡Completaste todos!', inline: true },
                { name: '🏆 Hitos', value: milestoneText, inline: false }
            )
            .setFooter({ text: 'Si no usas el bot por 48h tu racha se resetea' })
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
        
        if (result.professionBonus && result.professionBonus.mult !== 1.0) {
            const pct = Math.round((result.professionBonus.mult - 1) * 100);
            const sign = pct > 0 ? '+' : '';
            embed.addFields({ name: `${result.professionBonus.name}`, value: `${sign}${pct}% daily`, inline: true });
        }

        // Bonus de libros a minijuegos
        const userMG = await this.economy.getUser(userId);
        const bookBonusesMG = this.economy.getBookBonuses(userMG);

        // Mensaje de bonus de libros
        if (bookBonusesMG.dailyBonus > 0) {
            const pct = Math.round(bookBonusesMG.dailyBonus * 100);
            embed.addFields({ name: `📚 **Biblioteca**`, value: `+${pct}% daily`, inline: true });
        }

        if (result.petBonus?.pet) {
            const r = this.economy.PET_RARITIES[result.petBonus.pet.rarity];
            const pct = Math.round(result.petBonus.amount * 100);
            embed.addFields({ name: `${r.emoji} **${result.petBonus.pet.name}**`, value: `+${pct}% daily`, inline: true });
        }

        // Bonus matrimonial
        const { bonus: marriageBonus, partnerId: marriagePartnerId } = await this.economy.applyMarriageBonus(userId, applyResult.finalAmount);
        if (marriageBonus > 0 && marriagePartnerId) {
            embed.addFields({
                name: '💍 Bonus Matrimonial',
                value: `+${this.formatNumber(marriageBonus)} π-b$ enviados a <@${marriagePartnerId}>`,
                inline: false
            });
        }

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
                const treasures = await this.events.checkSpecialEvents(userId, 'general', message);
                    
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
        const YOUR_ID = '488110147265232898';
        const isOwner = message.author.id === YOUR_ID;
        const isAdmin = message.member?.permissions.has('Administrator');

        if (!isOwner && !isAdmin) {
            await message.reply('❌ No tienes permisos para usar este comando.');
            return;
        }

        const args = message.content.split(' ');

        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('💸 Comando Add')
                .setDescription('Da π-b Coins a otro usuario')
                .addFields(
                    { name: '📝 Uso', value: '`>addmoney @usuario <cantidad> [razon]`', inline: false },
                    { name: '💡 Ejemplo', value: '`>addmoney @usuario 500 Por ganar el concurso`', inline: false }
                )
                .setColor('#17a2b8');
            return message.reply({ embeds: [embed] });
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply('❌ Debes mencionar a un usuario válido.');
        if (targetUser.bot) return message.reply('❌ No puedes dar dinero a bots.');

        // Validar rate limit solo para admins (no para ti)
        if (!isOwner) {
            if (!await this.validateAdminCommand(message, targetUser, 'addmoney')) return;
        }

        const amount = parseInt(args[2]);
        if (isNaN(amount) || amount <= 0) return message.reply('❌ La cantidad debe ser un número positivo.');

        const targetUserData = await this.economy.getUser(targetUser.id);
        const targetLimit = this.economy.shop ? await this.economy.shop.getVipLimit(targetUser.id) : this.economy.config.maxBalance;
        if (targetUserData.balance + amount > targetLimit) {
            const spaceLeft = targetLimit - targetUserData.balance;
            return message.reply(`❌ El usuario alcanzaría su límite. Solo puedes agregar ${this.formatNumber(spaceLeft)} π-b$ más.`);
        }

        const reason = args.slice(3).join(' ') || 'No especificada';
        const result = await this.economy.addMoney(targetUser.id, amount, reason);

        const embed = new EmbedBuilder()
            .setTitle('✅ Dinero Entregado')
            .setDescription(`**+${this.formatNumber(amount)}** ${this.economy.config.currencySymbol} → ${targetUser}\nRazón: ${reason}`)
            .addFields(
                { name: '💰 Balance Anterior', value: `${this.formatNumber(result.newBalance - amount)} π-b$`, inline: true },
                { name: '💳 Balance Actual', value: `${this.formatNumber(result.newBalance)} π-b$`, inline: true },
                { name: '👤 Dado por', value: `${message.author}${isOwner ? ' 👑' : ''}`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Log por DM al owner (solo si no eres tú quien lo usó)
        if (!isOwner) {
            try {
                const owner = await client.users.fetch(YOUR_ID, { force: true }).catch(() => client.users.cache.get(YOUR_ID));
                if (owner) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🚨 Log Admin — AddMoney')
                        .setDescription(`Comando usado en **${message.guild.name}**`)
                        .addFields(
                            { name: '👤 Admin', value: `${message.author} (${message.author.tag})`, inline: true },
                            { name: '🎯 Destino', value: `${targetUser} (${targetUser.tag})`, inline: true },
                            { name: '💰 Cantidad', value: `${this.formatNumber(amount)} π-b$`, inline: true },
                            { name: '📝 Razón', value: reason, inline: false }
                        )
                        .setColor('#FF9900')
                        .setTimestamp();

                    const dm = await owner.createDM();
                    await dm.send({ embeds: [logEmbed] });
                }
            } catch (error) {
                console.error('❌ Error enviando log DM:', error.message);
                console.log(`📋 LOG: ${message.author.tag} → ${targetUser.tag} +${amount} π-b$ | ${reason}`);
            }
        }
    }

    async handleRemoveMoney(message, client) {
        const YOUR_ID = '488110147265232898';
        const isOwner = message.author.id === YOUR_ID;
        const isAdmin = message.member?.permissions.has('Administrator');

        if (!isOwner && !isAdmin) {
            await message.reply('❌ No tienes permisos para usar este comando.');
            return;
        }

        const args = message.content.split(' ');

        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('💸 Comando Remove')
                .setDescription('Quita π-b Coins a otro usuario')
                .addFields(
                    { name: '📝 Uso', value: '`>removemoney @usuario <cantidad> [razon]`', inline: false },
                    { name: '💡 Ejemplo', value: '`>removemoney @usuario 500 Por mal comportamiento`', inline: false }
                )
                .setColor('#17a2b8');
            return message.reply({ embeds: [embed] });
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply('❌ Debes mencionar a un usuario válido.');
        if (targetUser.bot) return message.reply('❌ No puedes quitar dinero a bots.');

        if (!isOwner) {
            if (!await this.validateAdminCommand(message, targetUser, 'removemoney')) return;
        }

        const amount = parseInt(args[2]);
        if (isNaN(amount) || amount <= 0) return message.reply('❌ La cantidad debe ser un número positivo.');

        const reason = args.slice(3).join(' ') || 'No especificada';
        const result = await this.economy.removeMoney(targetUser.id, amount, reason);

        if (result === false) {
            await message.reply('❌ El usuario no tiene esa cantidad de dinero.');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('✅ Dinero Removido')
            .setDescription(`**-${this.formatNumber(amount)}** ${this.economy.config.currencySymbol} → ${targetUser}\nRazón: ${reason}`)
            .addFields(
                { name: '💰 Balance Anterior', value: `${this.formatNumber(result + amount)} π-b$`, inline: true },
                { name: '💳 Balance Actual', value: `${this.formatNumber(result)} π-b$`, inline: true },
                { name: '👤 Removido por', value: `${message.author}${isOwner ? ' 👑' : ''}`, inline: true }
            )
            .setColor('#FF6B6B')
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        if (!isOwner) {
            try {
                const owner = await client.users.fetch(YOUR_ID, { force: true })
                    .catch(() => client.users.cache.get(YOUR_ID));

                if (owner) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🚨 Log Admin — RemoveMoney')
                        .setDescription(`Comando usado en **${message.guild.name}**`)
                        .addFields(
                            { name: '👤 Admin', value: `${message.author} (${message.author.tag})`, inline: true },
                            { name: '🎯 Destino', value: `${targetUser} (${targetUser.tag})`, inline: true },
                            { name: '💸 Cantidad', value: `${this.formatNumber(amount)} π-b$`, inline: true },
                            { name: '📝 Razón', value: reason, inline: false },
                            { name: '🏦 Balance Anterior', value: `${this.formatNumber(result + amount)} π-b$`, inline: true },
                            { name: '🏦 Balance Nuevo', value: `${this.formatNumber(result)} π-b$`, inline: true }
                        )
                        .setColor('#FF0000')
                        .setTimestamp();

                    const dm = await owner.createDM();
                    await dm.send({ embeds: [logEmbed] });
                }
            } catch (error) {
                console.error('❌ Error enviando log DM:', error.message);
                console.log(`📋 LOG: ${message.author.tag} → ${targetUser.tag} -${amount} π-b$ | ${reason}`);
            }
        }
    }

    async handleAddXp(message, client) {
        const YOUR_ID = '488110147265232898';
        const isOwner = message.author.id === YOUR_ID;
        const isAdmin = message.member?.permissions.has('Administrator');

        if (!isOwner && !isAdmin) {
            await message.reply('❌ No tienes permisos para usar este comando.');
            return;
        }

        const args = message.content.split(' ');

        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('⭐ Comando AddXP')
                .setDescription('Añade XP a otro usuario')
                .addFields(
                    { name: '📝 Uso', value: '`>addxp @usuario <cantidad> [razon]`', inline: false },
                    { name: '💡 Ejemplo', value: '`>addxp @usuario 500 Por ganar el concurso`', inline: false }
                )
                .setColor('#17a2b8');
            return message.reply({ embeds: [embed] });
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply('❌ Debes mencionar a un usuario válido.');
        if (targetUser.bot) return message.reply('❌ No puedes dar XP a bots.');

        if (!isOwner) {
            if (!await this.validateAdminCommand(message, targetUser, 'addxp')) return;
        }

        const baseXP = parseInt(args[2]);
        if (isNaN(baseXP) || baseXP <= 0) return message.reply('❌ La cantidad debe ser un número positivo.');

        const reason = args.slice(3).join(' ') || 'No especificada';
        const xpResult = await this.economy.addXp(targetUser.id, baseXP);

        const embed = new EmbedBuilder()
            .setTitle('✅ XP Añadido')
            .setDescription(`**+${this.formatNumber(baseXP)} XP** → ${targetUser}\nRazón: ${reason}`)
            .addFields(
                { name: '⭐ XP Ganado', value: `${this.formatNumber(xpResult.xpGained)}`, inline: true },
                { name: '👤 Dado por', value: `${message.author}${isOwner ? ' 👑' : ''}`, inline: true }
            )
            .setColor('#9932CC')
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });

        if (xpResult?.levelUp) {
            const levelUpEmbed = new EmbedBuilder()
                .setTitle('🎉 ¡Subió de Nivel!')
                .setDescription(`${targetUser} alcanzó el **Nivel ${xpResult.newLevel}**`)
                .addFields(
                    { name: '📈 XP Ganada', value: `+${xpResult.xpGained} XP`, inline: true },
                    { name: '🎁 Recompensa', value: `+${xpResult.baseReward || xpResult.reward} π-b$`, inline: true },
                    { name: '🏆 Niveles Subidos', value: `${xpResult.levelsGained}`, inline: true }
                )
                .setColor('#FFD700')
                .setTimestamp();

            if (xpResult.levelBonus > 0) {
                levelUpEmbed.addFields({
                    name: '⭐ Bonus por Nivel',
                    value: `+${xpResult.levelBonus} π-b$ (${xpResult.newLevel} × 50)`,
                    inline: false
                });
            }

            levelUpEmbed.addFields({ name: '💰 Total Ganado', value: `**${xpResult.reward} π-b$**`, inline: false });
            await message.channel.send({ embeds: [levelUpEmbed] });
        }

        // Anuncio de hito de mentoría
        if (xpResult.mentorMilestone) {
            const { mentorMilestone } = xpResult;
            message.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle(`🎓 ${mentorMilestone.milestone.label}`)
                    .setDescription(
                        `<@${targetUser.id}> superó un hito de mentoría al alcanzar **Nivel ${xpResult.newLevel}**!\n` +
                        `💰 **+${mentorMilestone.reward.toLocaleString()} π-b$** para el aprendiz y el mentor <@${mentorMilestone.mentorId}>.`
                    )
                    .setColor('#5865F2')
                    .setTimestamp()]
            }).catch(() => {});
        }

        if (!isOwner) {
            try {
                const owner = await client.users.fetch(YOUR_ID, { force: true })
                    .catch(() => client.users.cache.get(YOUR_ID));

                if (owner) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🚨 Log Admin — AddXP')
                        .setDescription(`Comando usado en **${message.guild.name}**`)
                        .addFields(
                            { name: '👤 Admin', value: `${message.author} (${message.author.tag})`, inline: true },
                            { name: '🎯 Destino', value: `${targetUser} (${targetUser.tag})`, inline: true },
                            { name: '⭐ XP', value: `${this.formatNumber(baseXP)} XP`, inline: true },
                            { name: '📝 Razón', value: reason, inline: false },
                            { name: '🆙 Subió de Nivel', value: xpResult.levelUp ? `✅ → Nivel ${xpResult.newLevel}` : '❌ No', inline: true }
                        )
                        .setColor('#9932CC')
                        .setTimestamp();

                    const dm = await owner.createDM();
                    await dm.send({ embeds: [logEmbed] });
                }
            } catch (error) {
                console.error('❌ Error enviando log DM:', error.message);
                console.log(`📋 LOG: ${message.author.tag} → ${targetUser.tag} +${baseXP} XP | ${reason}`);
            }
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
    
    async handlePedir(message) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);

        // Verificar cooldown
        const lastPedir = user.last_pedir || 0;
        const cooldownLeft = this.economy.mendicidadConfig.cooldown - (Date.now() - lastPedir);
        if (cooldownLeft > 0) {
            let h = Math.floor(cooldownLeft / (1000 * 60 * 60));
            let m = Math.round((cooldownLeft % (1000 * 60 * 60)) / (1000 * 60));
            if (m === 60) { h += 1; m = 0; }
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('🙏 Mendicidad')
                    .setDescription(`Ya pediste dinero recientemente.\n⏳ Podrás pedir de nuevo en **${h}h ${m}m**`)
                    .setTimestamp()]
            });
        }

        const result = await this.economy.doPedir(userId);

        if (!result.success) {
            const msgs = {
                no_users: 'No hay usuarios activos a quienes pedirles. ¡Vuelve cuando haya más gente!',
            };
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('🙏 Mendicidad')
                    .setDescription(msgs[result.reason] || 'No se pudo procesar la solicitud.')
                    .setTimestamp()]
            });
        }

        await message.reply({
            embeds: [new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🙏 ¡Solicitud enviada!')
                .setDescription(`Enviaste una solicitud de donación a **${result.targets.length}** usuarios.\nLa cantidad donada depende del balance de cada uno.`)
                .setFooter({ text: 'Cooldown: 8 horas' })
                .setTimestamp()]
        });

        // Enviar solicitud a cada usuario seleccionado
        for (const targetId of result.targets) {
            // Verificar que esté en el servidor
            let member;
            try {
                member = await message.guild.members.fetch(targetId);
            } catch { continue; } // No está en el server, saltar

            const targetUser = member.user;

            // Calcular cantidad dinámica según balance del donante
            const donorData = await this.economy.getUser(targetId);
            let donationAmount = 500;
            if (donorData.balance > 200000) donationAmount = 5000;
            else if (donorData.balance > 50000) donationAmount = 2500;
            else if (donorData.balance > 10000) donationAmount = 1000;

            const donateButton = new ButtonBuilder()
                .setCustomId(`pedir_donar_${userId}_${targetId}_${donationAmount}`)
                .setLabel(`💝 Donar ${donationAmount} ${this.economy.config.currencySymbol}`)
                .setStyle(ButtonStyle.Success);

            const ignoreButton = new ButtonBuilder()
                .setCustomId(`pedir_ignorar_${userId}_${targetId}_${donationAmount}`)
                .setLabel('❌ Ignorar')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(donateButton, ignoreButton);

            const requestEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🙏 Alguien te pide dinero')
                .setDescription(
                    `**${message.author.displayName}** está pasando por un mal momento...\n\n` +
                    `*"Por favor, cualquier ayuda cuenta 🥺"*\n\n` +
                    `¿Le donas **${donationAmount} ${this.economy.config.currencySymbol}**?`
                )
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'Esta solicitud expira en 10 minutos' })
                .setTimestamp();

            try {
                await message.channel.send({
                    content: `<@${targetId}>`,
                    embeds: [requestEmbed],
                    components: [row]
                });
            } catch { continue; }
        }
    }

    async handleBiblioteca(message, args) {
        const userId = message.author.id;
        const subcommand = args[1]?.toLowerCase();

        // Ver estado de lectura actual
        if (subcommand === 'estado') {
            const current = await this.economy.database.getCurrentReading(userId);
            if (!current) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B4513')
                        .setTitle('📚 Biblioteca — Estado')
                        .setDescription('No estás leyendo ningún libro actualmente.')
                        .setTimestamp()]
                });
            }
            const book = this.economy.BOOKS[current.book_id];
            const isFinished = current.finishes_at <= Date.now();
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B4513')
                    .setTitle('📚 Biblioteca — Estado')
                    .setDescription(
                        isFinished
                            ? `✅ **${book?.name}** terminado — usa cualquier comando para recibir el bonus`
                            : `📖 Leyendo **${book?.name}**\n⏳ Termina <t:${Math.floor(current.finishes_at / 1000)}:R>`
                    )
                    .setTimestamp()]
            });
        }

        // Comprar libro
        if (subcommand === 'comprar') {
            const bookId = args[2]?.toLowerCase();
            if (!bookId) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff4444')
                        .setTitle('📚 Biblioteca')
                        .setDescription('Debes especificar el ID del libro.\n**Uso:** `>biblioteca comprar <id>`')
                        .setTimestamp()]
                });
            }

            const result = await this.economy.buyBook(userId, bookId);

            if (!result.success) {
                const msgs = {
                    invalid_book:    'Ese libro no existe. Usa `>biblioteca` para ver el catálogo.',
                    already_read:    'Ya leíste ese libro. Sus efectos ya están activos.',
                    already_reading: `Ya estás leyendo **${this.economy.BOOKS[result.book?.book_id]?.name || 'un libro'}**. Termínalo primero.`,
                    cooldown:        `Debes esperar **<t:${Math.floor((Date.now() + result.timeLeft) / 1000)}:R>** antes de leer otro libro.`,
                    too_poor:        `Necesitas **${this.formatNumber(result.price)} ${this.economy.config.currencySymbol}** para comprar este libro.`,
                };
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff4444')
                        .setTitle('📚 Biblioteca')
                        .setDescription(msgs[result.reason] || 'Error desconocido.')
                        .setTimestamp()]
                });
            }

            const effectText = result.book.effect.type === 'recipe'
                ? '📜 Receta secreta de crafteo desbloqueada'
                : `+${Math.round(result.book.effect.value * 100)}% ${
                    result.book.effect.type === 'dailyBonus' ? 'al daily' :
                    result.book.effect.type === 'workBonus' ? 'al trabajo' :
                    result.book.effect.type === 'robBonus' ? 'al robo' :
                    result.book.effect.type === 'workCooldown' ? 'reducción cooldown trabajo' :
                    result.book.effect.type === 'robCooldown' ? 'reducción cooldown robo' :
                    'a minijuegos'
                }`;

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B4513')
                    .setTitle('📚 ¡Empezaste a leer!')
                    .setDescription(
                        `**${result.book.name}**\n\n` +
                        `⏳ Terminarás de leerlo <t:${Math.floor(result.finishesAt / 1000)}:R>\n` +
                        `🎁 Efecto al terminar: ${effectText}\n\n` +
                        `*Usa \`>biblioteca estado\` para ver el progreso*`
                    )
                    .setTimestamp()]
            });
        }

        // Catálogo — sin subcomando
        const readBooks = await this.economy.database.getReadBooks(userId);
        const user = await this.economy.getUser(userId);
        const bookBonuses = this.economy.getBookBonuses(user);
        const BOOKS_PER_PAGE = 6;
        const bookEntries = Object.entries(this.economy.BOOKS);
        const totalPages = Math.ceil(bookEntries.length / BOOKS_PER_PAGE);
        let currentPage = 0;

        const buildEmbed = (page) => {
            const pageBooks = bookEntries.slice(page * BOOKS_PER_PAGE, (page + 1) * BOOKS_PER_PAGE);
            const embed = new EmbedBuilder()
                .setColor('#8B4513')
                .setTitle('📚 Biblioteca')
                .setDescription(
                    `Compra libros para desbloquear mejoras permanentes.\n` +
                    `**Uso:** \`>biblioteca comprar <id>\`\n\n` +
                    `📖 Libros leídos: **${readBooks.length}/${bookEntries.length}**`
                )
                .setFooter({ text: `Página ${page + 1}/${totalPages}` });

            for (const [id, book] of pageBooks) {
                const read = readBooks.includes(id);
                const effectText = book.effect.type === 'recipe'
                    ? '📜 Receta secreta'
                    : `+${Math.round(book.effect.value * 100)}% ${
                        book.effect.type === 'dailyBonus' ? 'daily' :
                        book.effect.type === 'workBonus' ? 'trabajo' :
                        book.effect.type === 'robBonus' ? 'robo' :
                        book.effect.type === 'workCooldown' ? 'cooldown trabajo' :
                        book.effect.type === 'robCooldown' ? 'cooldown robo' : 'minijuegos'
                    }`;
                embed.addFields({
                    name: `${read ? '✅' : '⬜'} ${book.name}`,
                    value: `${effectText}\n💰 ${this.formatNumber(book.price)} π-b$ • ⏱️ ${book.readHours}h\n\`${id}\``,
                    inline: true
                });
            }
            return embed;
        };

        const buildRow = (page) => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`lib_prev_${userId}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
            new ButtonBuilder().setCustomId(`lib_next_${userId}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1)
        );

        const reply = await message.reply({ embeds: [buildEmbed(currentPage)], components: [buildRow(currentPage)] });

        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 60000
        });

        collector.on('collect', async (interaction) => {
            if (interaction.customId === `lib_next_${userId}`) currentPage++;
            else currentPage--;
            await interaction.update({ embeds: [buildEmbed(currentPage)], components: [buildRow(currentPage)] });
        });

        collector.on('end', async () => {
            try { await reply.edit({ components: [] }); } catch {}
        });
    }

    async handleSicario(message, args) {
        const userId = message.author.id;
        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            await message.delete().catch(() => {});
            return message.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('🗡️ Sicario')
                    .setDescription('Debes mencionar al objetivo.\n**Uso:** `>sicario @usuario`')
                    .setTimestamp()]
            });
        }

        const amount = 1000;
        const result = await this.economy.hireSicario(userId, targetUser.id, amount, message.channel.id, message.guild?.id);
        const timeLeft = this.formatTimeLeft(result.timeLeft);
        
        if (!result.success) {
            const msgs = {
                self_target:        'No puedes contratarte contra ti mismo.',
                too_poor:           `No tienes suficiente dinero. Necesitas **${this.formatNumber(amount)} ${this.economy.config.currencySymbol}**.`,
                target_not_found:   'No se encontró al usuario objetivo.',
                already_contracted: `**${targetUser.displayName}** ya tiene un contrato activo en su contra.`,
                cooldown:           `Debes esperar **${timeLeft}** para contratar otro sicario`
            };
            await message.delete().catch(() => {});
            return message.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('🗡️ Sicario')
                    .setDescription(msgs[result.reason] || 'Error desconocido.')
                    .setTimestamp()]
            });
        }

        // Borrar mensaje del usuario
        await message.delete().catch(() => {});

        const deleteButton = new ButtonBuilder()
            .setCustomId(`sicario_delete_${userId}`)
            .setLabel('🗑️ Borrar')
            .setStyle(ButtonStyle.Secondary);

        const deleteRow = new ActionRowBuilder().addComponents(deleteButton);

        const reply = await message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('🗡️ ¡Contrato firmado!')
                .setDescription(
                    `Contrataste un sicario contra **${targetUser.displayName}**.\n\n` +
                    `*La próxima vez que trabaje, hay un **60%** de que falle.*`
                )
                .addFields(
                    { name: '💰 Pagado', value: `${this.formatNumber(amount)} ${this.economy.config.currencySymbol}`, inline: true },
                    { name: '⏳ Expira en', value: '24 horas', inline: true },
                    { name: '🎯 Objetivo', value: targetUser.displayName, inline: true }
                )
                .setFooter({ text: 'Solo tú puedes ver y borrar este mensaje' })
                .setTimestamp()],
            components: [deleteRow]
        });

        // Collector del botón borrar
        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === userId && i.customId === `sicario_delete_${userId}`,
            time: 24 * 60 * 60 * 1000, // 24h
            max: 1
        });

        collector.on('collect', async (interaction) => {
            await reply.delete().catch(() => {});
        });

        collector.on('end', async () => {
            try { await reply.edit({ components: [] }); } catch {}
        });

        return;
    }

    async handleMapa(message) {
        const userId = message.author.id;

        const map = await this.economy.database.getActiveTreasureMap(userId);
        if (!map) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('🗺️ Mapa del Tesoro')
                    .setDescription('No tienes ningún mapa activo.\n*Los mapas se obtienen como drop raro al trabajar (~1%).*')
                    .setTimestamp()]
            });
        }

        const currentClue = map.clues[map.current_clue];
        const rewardText = map.reward.type === 'money'
            ? `${this.formatNumber(map.reward.amount)} ${this.economy.config.currencySymbol}`
            : `${map.reward.amount} XP`;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🗺️ Tu Mapa del Tesoro')
            .setDescription(
                `**Pista ${map.current_clue + 1}/${map.clues.length}:**\n\n` +
                `*${currentClue.text}*\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Usa \`>excavar #canal\` o \`>excavar @usuario\` para responder`
            )
            .addFields(
                { name: '💰 Recompensa', value: rewardText, inline: true },
                { name: '📍 Progreso', value: `${map.current_clue + 1}/${map.clues.length} pistas`, inline: true },
                { name: '⏳ Expira', value: `<t:${Math.floor(map.expires_at / 1000)}:R>`, inline: true },
            )
            .setFooter({ text: 'Si fallas una pista el mapa se destruye' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    async handleExcavar(message, args) {
        const userId = message.author.id;

        const mention = message.mentions.channels.first() || message.mentions.users.first();
        if (!mention) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('🗺️ Excavar')
                    .setDescription('Debes mencionar un canal o usuario.\n**Uso:** `>excavar #canal` o `>excavar @usuario`')
                    .setTimestamp()]
            });
        }

        const isChannel = !!message.mentions.channels.first();
        const answerId = mention.id;
        const answerType = isChannel ? 'channel' : 'user';

        const result = await this.economy.checkTreasureAnswer(userId, answerId, answerType);

        if (!result.success) {
            const msgs = {
                no_map: 'No tienes ningún mapa activo.',
                no_clue: 'Error al procesar la pista.',
            };
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('🗺️ Excavar')
                    .setDescription(msgs[result.reason] || 'Error desconocido.')
                    .setTimestamp()]
            });
        }

        if (!result.correct) {
            // Respuesta incorrecta — destruir mapa
            const map = await this.economy.database.getActiveTreasureMap(userId);
            if (map) await this.economy.database.completeTreasureMap(map.id);

            const embedIncorrect = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ ¡Respuesta incorrecta!')
                .setDescription('*El mapa se quemó en tus manos...*\n\nLa pista era sobre otro lugar. El mapa fue destruido.')                   
                .setFooter({ text: 'Sigue trabajando para encontrar otro mapa' })
                .setTimestamp();

            if (answerType === 'channel') embedIncorrect.addFields({name: 'El lugar correcto era: ', value: `<#${result.correctAnswer}>`});
            else if (answerType === 'user') embedIncorrect.addFields({name: 'El usuario correcto era: ', value: `<@${result.correctAnswer}>`});
                
            return message.reply({
                embeds: [embedIncorrect]
            });
        }

        if (result.finished) {
            const rewardText = result.reward.type === 'money'
                ? `**${this.formatNumber(result.reward.amount)} ${this.economy.config.currencySymbol}**`
                : result.reward.type === 'xp'
                    ? `**${result.reward.amount} XP**`
                    : `**${this.economy.shop?.shopItems[result.reward.itemId]?.name || result.reward.itemId}**`;

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🎉 ¡Tesoro encontrado!')
                    .setDescription(`*Cavaste en el lugar correcto y encontraste el tesoro...*\n\n💰 Recibiste ${rewardText}!`)
                    .addFields({ name: '📍 Pistas resueltas', value: `${result.totalClues}/${result.totalClues}`, inline: true })
                    .setTimestamp()]
            });
        }

        // Respuesta correcta, siguiente pista
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor('#00ff88')
                .setTitle('✅ ¡Correcto!')
                .setDescription(
                    `*Vas por buen camino...*\n\n` +
                    `**Pista ${result.currentClue + 1}/${result.totalClues}:**\n\n` +
                    `*${result.nextClue.text}*`
                )
                .setFooter({ text: 'Usa >excavar #canal o >excavar @usuario para responder' })
                .setTimestamp()]
        });
    }

    async handlePacto(message) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);

        // Verificar cooldown antes de mostrar confirmación
        const lastPacto = user.last_pacto || 0;
        const cooldownLeft = this.economy.pactoConfig.cooldown - (Date.now() - lastPacto);
        if (cooldownLeft > 0) {
            const h = Math.floor(cooldownLeft / (1000 * 60 * 60));
            const m = Math.round((cooldownLeft % (1000 * 60 * 60)) / (1000 * 60));
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('😈 Pacto con el Diablo')
                    .setDescription(`Ya hiciste un pacto recientemente.\n⏳ Podrás hacerlo de nuevo en **${h}h ${m}m**`)
                    .setTimestamp()]
            });
        }

        if (user.balance < this.economy.pactoConfig.minBalance) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('😈 Pacto con el Diablo')
                    .setDescription(`No tienes suficiente dinero para hacer un pacto.\n💰 Mínimo: **${this.economy.pactoConfig.minBalance}** ${this.economy.config.currencySymbol}`)
                    .setTimestamp()]
            });
        }

        const half = Math.floor(user.balance * 0.30);

        // Embed de confirmación
        const confirmEmbed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('😈 Pacto con el Diablo')
            .setDescription(
                `*El diablo te ofrece un trato...*\n\n` +
                `Apuestas el 30% de tu balance:\n` +
                `**${this.formatNumber(half)} ${this.economy.config.currencySymbol}**\n\n` +
                `🟢 **50%** — Ganas y recibes el doble\n` +
                `🔴 **50%** — Pierdes esa mitad para siempre\n\n` +
                `*¿Aceptas el trato?*`
            )
            .setFooter({ text: 'Cooldown: 48 horas tras el pacto' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`pacto_confirm_${userId}`)
                .setLabel('😈 Aceptar el trato')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`pacto_cancel_${userId}`)
                .setLabel('❌ Cancelar')
                .setStyle(ButtonStyle.Secondary)
        );

        const reply = await message.reply({ embeds: [confirmEmbed], components: [row] });

        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 30000,
            max: 1
        });

        collector.on('collect', async (interaction) => {
            if (interaction.customId === `pacto_cancel_${userId}`) {
                await interaction.update({
                    embeds: [new EmbedBuilder()
                        .setColor('#888888')
                        .setTitle('😈 Pacto con el Diablo')
                        .setDescription('*Huiste del trato. El diablo sonríe... por ahora.*')
                        .setTimestamp()],
                    components: []
                });
                return;
            }

            // Ejecutar pacto
            const result = await this.economy.doPacto(userId);

            if (!result.success) {
                await interaction.update({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff4444')
                        .setTitle('😈 Error')
                        .setDescription('No se pudo procesar el pacto. Intenta de nuevo.')
                        .setTimestamp()],
                    components: []
                });
                return;
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(result.won ? '#00ff88' : '#8B0000')
                .setTitle(result.won ? '😈 ¡El diablo cumplió su trato!' : '😈 El diablo se llevó su parte...')
                .setDescription(result.won
                    ? `*Las llamas brillaron a tu favor...*\n\n💰 Ganaste **${this.formatNumber(result.amount)} ${this.economy.config.currencySymbol}**`
                    : `*Una carcajada resuena en la oscuridad...*\n\n💸 Perdiste **${this.formatNumber(result.amount)} ${this.economy.config.currencySymbol}**`
                )
                .addFields(
                    { name: result.won ? '💰 Ganado' : '💸 Perdido', value: `${this.formatNumber(result.amount)} ${this.economy.config.currencySymbol}`, inline: true },
                    { name: '💳 Balance actual', value: `${this.formatNumber(result.newBalance)} ${this.economy.config.currencySymbol}`, inline: true }
                )
                .setFooter({ text: 'Próximo pacto disponible en 48 horas' })
                .setTimestamp();

            await interaction.update({ embeds: [resultEmbed], components: [] });
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                try {
                    await reply.edit({
                        embeds: [new EmbedBuilder()
                            .setColor('#888888')
                            .setTitle('😈 Pacto con el Diablo')
                            .setDescription('*El diablo perdió la paciencia. El trato expiró.*')
                            .setTimestamp()],
                        components: []
                    });
                } catch {}
            }
        });
    }

    async handleProfesion(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
        const profKey = args[1]?.toLowerCase();

        // Sin args → mostrar lista de profesiones
        if (!profKey) {
            const currentProf = user.profession ? this.economy.PROFESSIONS[user.profession] : null;
            const pages = [
                [
                    { key: 'ladron',     p: this.economy.PROFESSIONS.ladron },
                    { key: 'empresario', p: this.economy.PROFESSIONS.empresario },
                    { key: 'apostador',  p: this.economy.PROFESSIONS.apostador },
                    { key: 'artesano',   p: this.economy.PROFESSIONS.artesano },
                    { key: 'aventurero', p: this.economy.PROFESSIONS.aventurero },
                ],
                [
                    { key: 'doctor',   p: this.economy.PROFESSIONS.doctor },
                    { key: 'guardian', p: this.economy.PROFESSIONS.guardian },
                    { key: 'ludopata', p: this.economy.PROFESSIONS.ludopata },
                    //{ key: 'cazador',  p: this.economy.PROFESSIONS.cazador },
                    { key: 'granjero', p: this.economy.PROFESSIONS.granjero },
                ],
            ];

            const profDescriptions = {
                ladron:     '⚔️ +robos rápidos\n💔 -15% trabajo',
                empresario: '⚔️ +25% trabajo\n💔 No puede robar',
                apostador:  '⚔️ +30% minijuegos\n💔 +15% penalizaciones',
                artesano:   '⚔️ -40% tiempo crafteo, recetas exclusivas\n💔 -25% trabajo, -20% daily',
                aventurero: '⚔️ +100% misiones\n💔 Daily cada 26h',
                doctor:     '⚔️ -50% penalizaciones\n💔 Puede curar mano del muerto',
                guardian:   '⚔️ +20% xp, +15% daily\n💔 No puede robar, -20% trabajo',
                ludopata:   '⚔️ +40% minijuegos apuesta\n💔 -30% trabajo, -20% daily',
                //cazador:    '⚔️ +50% recompensa jefes\n💔 -20% trabajo',
                granjero:   '⚔️ +50% huerto\n💔 No puede robar, -15% daily',
            };

            let currentPage = 0;

            const buildEmbed = (page) => {
                const embed = new EmbedBuilder()
                    .setColor('#9B59B6')
                    .setTitle('⚔️ Profesiones')
                    .setDescription(
                        `${currentProf ? `**Tu profesión actual:** ${currentProf.name}` : '**Sin profesión** — elige una para siempre'}\n` +
                        `📊 Nivel requerido: **${this.economy.professionConfig.minLevel}**\n` +
                        `💰 Cambiar profesión: **${this.formatNumber(this.economy.professionConfig.changeCost)} ${this.economy.config.currencySymbol}** (cooldown 30 días)\n\n` +
                        `Usa \`>profesion <nombre>\` para elegir`
                    )
                    .setFooter({ text: `Página ${page + 1}/2` });

                for (const { key, p } of pages[page]) {
                    const isActive = user.profession === key;
                    embed.addFields({
                        name: `${isActive ? '✅' : '⬜'} ${p.name}`,
                        value: profDescriptions[key],
                        inline: true
                    });
                }
                return embed;
            };

            const buildRow = (page) => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`prof_prev_${userId}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId(`prof_next_${userId}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page === 1)
            );

            const reply = await message.reply({ embeds: [buildEmbed(currentPage)], components: [buildRow(currentPage)] });

            const collector = reply.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 60000
            });

            collector.on('collect', async (interaction) => {
                if (interaction.customId === `prof_next_${userId}`) currentPage++;
                else currentPage--;
                await interaction.update({ embeds: [buildEmbed(currentPage)], components: [buildRow(currentPage)] });
            });

            collector.on('end', async () => {
                try { await reply.edit({ components: [] }); } catch {}
            });
            return;
        }

        // Con arg → elegir profesión
        if (user.level < this.economy.professionConfig.minLevel) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('⚔️ Profesiones')
                    .setDescription(`Necesitas ser **Nivel ${this.economy.professionConfig.minLevel}** para elegir una profesión.\n📊 Tu nivel actual: **${user.level}**`)
                    .setTimestamp()]
            });
        }

        const result = await this.economy.setProfession(userId, profKey);

        if (!result.success) {
            const msgs = {
                invalid_profession: `Profesión no válida. Usa \`>profesion\` para ver las disponibles.`,
                cooldown: `Cambiaste de profesión hace poco. Podrás cambiar en **${Math.ceil(result.timeLeft / (1000 * 60 * 60 * 24))} días**.`,
                too_poor: `Necesitas **${this.formatNumber(result.cost)} ${this.economy.config.currencySymbol}** para cambiar de profesión.`,
            };
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('⚔️ Profesiones')
                    .setDescription(msgs[result.reason] || 'Error desconocido.')
                    .setTimestamp()]
            });
        }

        const isChange = !!user.profession;
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle('⚔️ ¡Profesión elegida!')
                .setDescription(
                    `${isChange ? `Cambiaste de **${this.economy.PROFESSIONS[user.profession]?.name}** a` : 'Elegiste la profesión'} **${result.profession.name}**!\n\n` +
                    `*Los efectos se aplican inmediatamente.*`
                )
                .setTimestamp()]
        });
    }

    async handleWork(message) {
        const userId = message.author.id;
        const args = message.content.split(' ');
        const jobType = args[1]?.toLowerCase();
        const jobs = await this.economy.getWorkJobs();

        if (!jobType) {
            const user = await this.economy.getUser(userId);
            const streakData = this.economy.workStreaks?.get(userId) || { streak: 0 };
            const JOBS_PER_PAGE = 5;

            const sortedJobs = Object.entries(jobs).sort((a, b) => a[1].levelRequirement - b[1].levelRequirement);
            const totalPages = Math.ceil(sortedJobs.length / JOBS_PER_PAGE);
            let currentPage = 0;

            const buildEmbed = (page) => {
                const start = page * JOBS_PER_PAGE;
                const pageJobs = sortedJobs.slice(start, start + JOBS_PER_PAGE);

                const embed = new EmbedBuilder()
                    .setTitle('🛠️ Trabajos Disponibles')
                    .setDescription('Elige un trabajo para ganar π-b Coins')
                    .setColor('#28a745');

                for (const [key, job] of pageJobs) {
                    const cooldownHours = job.cooldown / (60 * 60 * 1000);
                    const cooldownText = cooldownHours >= 1 ? `${cooldownHours}h` : `${job.cooldown / (60 * 1000)}m`;
                    const available = user.level >= job.levelRequirement ? '✅' : '🔒';
                    const levelText = user.level < job.levelRequirement ? `\n🔒 *Requiere Nivel ${job.levelRequirement}*` : '';
                    const diffText = job.failChance ? `${Math.round(job.failChance * 100)}% difícil` : 'Variable';

                    embed.addFields({
                        name: `${available} ${job.name}`,
                        value: `💵 ${job.baseReward} – ${job.variation} π-b$\n⏱️ ${cooldownText}  •  🎮 ${diffText}\n\`>work ${job.codeName}\`${levelText}`,
                        inline: true
                    });
                }

                const footerParts = [];
                if (streakData.streak > 0) footerParts.push(`🔥 Racha: ${streakData.streak}`);
                footerParts.push(`Página ${page + 1}/${totalPages}`);
                embed.setFooter({ text: footerParts.join('  •  ') });

                return embed;
            };

            const buildRow = (page) => new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`work_page_prev_${userId}`)
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`work_page_next_${userId}`)
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages - 1)
            );

            const reply = await message.reply({
                embeds: [buildEmbed(currentPage)],
                components: [buildRow(currentPage)]
            });

            const collector = reply.createMessageComponentCollector({
                filter: i => i.user.id === userId && (i.customId === `work_page_prev_${userId}` || i.customId === `work_page_next_${userId}`),
                time: 60000
            });

            collector.on('collect', async (interaction) => {
                if (interaction.customId === `work_page_next_${userId}`) currentPage++;
                else currentPage--;

                await interaction.update({
                    embeds: [buildEmbed(currentPage)],
                    components: [buildRow(currentPage)]
                });
            });

            collector.on('end', async () => {
                try {
                    await reply.edit({ components: [] });
                } catch {}
            });

            return;
        }

        // Trabajo no existe
        if (!jobs[jobType]) {
            await message.reply('❌ Trabajo no válido.\nEscribe `>work` para ver los Trabajos Disponibles');
            return;
        }

        // Intentar trabajar
        const result = await this.economy.doWork(userId, jobType, message.guild?.id);

        // No puede trabajar
        if (!result.canWork) {
            if (result.reason === 'level_too_low') {
                const userLevel = await this.economy.getUser(userId);
                const embed = new EmbedBuilder()
                    .setTitle('🔒 Nivel Insuficiente')
                    .setDescription(`Necesitas ser **Nivel ${result.requiredLevel}** para este trabajo`)
                    .addFields({ name: '📊 Tu Nivel Actual', value: `**${userLevel.level}**`, inline: true })
                    .setColor('#dc3545');
                await message.reply({ embeds: [embed] });
                return;
            }

            if (result.reason === 'cooldown') {
                const timeLeft = this.formatTimeLeft(result.timeLeft);
                const embed = new EmbedBuilder()
                    .setTitle('⏰ En Cooldown')
                    .setDescription(`Ya trabajaste como **${result.name}** recientemente`)
                    .addFields({ name: '🕐 Tiempo restante', value: `**${timeLeft}**`, inline: true })
                    .setColor('#ffc107');
                await message.reply({ embeds: [embed] });
                return;
            }

            await message.reply('❌ No puedes trabajar en este momento.');
            return;
        }

        // ── LANZAR MINIJUEGO ──
        const minigameResult = await this.workMinigames.launch(
            message,
            jobType,
            result.finalEarnings,
            result.currentStreak
        );

        if (!minigameResult) {
            await message.reply('⚠️ Hubo un error al lanzar el minijuego. Inténtalo de nuevo.');
            return;
        }

        let embedTrue = false;
        let falseMapResult;

        // Aplicar resultado
        const applyResult = await this.economy.applyWorkResult(
            userId,
            jobType,
            minigameResult.reward,
            minigameResult.success
        );

        // Drop de mapa del tesoro
        if (minigameResult.success && result.droppedMap && message.guild) {
            const mapResult = await this.economy.generateTreasureMap(userId, message.guild.id, message.guild);           
            falseMapResult = mapResult;

            if (mapResult.success) embedTrue = true;
            else embedTrue = false;
        }

        const sicarioContract = await this.economy.checkSicarioContract(userId, minigameResult.success);
        if (sicarioContract?.activated && minigameResult.success) {
            minigameResult.success = false;
            await this.economy.addMoney(sicarioContract.hiredBy, applyResult.finalAmount, 'sicario_reward');
            await this.economy.removeMoney(userId, applyResult.finalAmount, 'sicario_rob');

            // Transferir mapa si tiene uno activo
            const victimMap = await this.economy.database.getActiveTreasureMap(userId);
            if (victimMap) {
                await this.economy.database.transferTreasureMap(victimMap.id, sicarioContract.hiredBy);
            }
        }
        const hadContract = !!sicarioContract;
        const sabotaged = sicarioContract?.activated || false;
        const sabotageHiredBy = sicarioContract?.hiredBy || null;
        const sabotageChannelId2 = sicarioContract?.channelId || null;

        // Embed final
        const isIllegal = ['criminal', 'vendedordelpunto', 'damadecomp', 'sicario', 'contador'].includes(jobType);
        const color = minigameResult.success ? '#28a745' : (isIllegal ? '#dc3545' : '#ffc107');

        let description = minigameResult.success
            ? `**${result.jobName}**\n\n📖 *${result.message}*`
            : `**${result.jobName}**\n\n📖 *${result.failMessage}*`;

        const embed = new EmbedBuilder()
            .setTitle(minigameResult.success ? '✅ ¡Trabajo Completado!' : '💥 ¡El trabajo salió mal!')
            .setDescription(description)
            .setColor(color)
            .setTimestamp();

        if (minigameResult.success) {           
            embed.addFields(
                { name: '💰 Ganaste', value: `+${this.formatNumber(applyResult.finalAmount)} π-b$`, inline: true },
                { name: '💳 Balance Actual', value: `${this.formatNumber(applyResult.newBalance)} π-b$`, inline: true },
            );
            if (result.allBonusMessages.length > 0) {
                embed.addFields({ name: '🎉 Bonificaciones', value: result.allBonusMessages.join('\n'), inline: false });
            }
            if (applyResult.streakBonusApplied > 0) {
                embed.addFields({ name: applyResult.streakBonusLabel, value: `+${this.formatNumber(applyResult.streakBonusApplied)} π-b$ extra`, inline: false });
            }
            if (applyResult.newStreak > 0) {
                embed.setFooter({ text: `🔥 Racha: ${applyResult.newStreak} éxitos consecutivos` });
            }
            if (applyResult.professionBonus && applyResult.professionBonus.mult !== 1.0) {
                const pct = Math.round((applyResult.professionBonus.mult - 1) * 100);
                const sign = pct > 0 ? '+' : '';
                embed.addFields({ name: `${applyResult.professionBonus.name}`, value: `${sign}${pct}% trabajo`, inline: true });
            }
            // Bonus de libros a minijuegos
            const userMG = await this.economy.getUser(userId);
            const bookBonusesMG = this.economy.getBookBonuses(userMG);

            // Mensaje de bonus de libros
            if (bookBonusesMG.workBonus > 0) {
                const pct = Math.round(bookBonusesMG.workBonus * 100);
                embed.addFields({ name: `📚 **Biblioteca**`, value: `+${pct}% work`, inline: true });
            }
            // Bonus matrimonial
            const { bonus: marriageBonus, partnerId: marriagePartnerId } = await this.economy.applyMarriageBonus(userId, result.finalEarnings);
            if (marriageBonus > 0 && marriagePartnerId) {
                const marriage = await this.economy.getMarriage(userId);
                const partnerId = marriage.user1_id === userId ? marriage.user2_id : marriage.user1_id;
                embed.addFields({ 
                    name: '💍 Bonus Matrimonial', 
                    value: `+${this.formatNumber(marriageBonus)} π-b$ enviados a <@${marriagePartnerId}>`,
                    inline: false 
                });
            }
            if (applyResult.petBonus?.pet) {
                const r = this.economy.PET_RARITIES[applyResult.petBonus.pet.rarity];
                const pct = Math.round(applyResult.petBonus.amount * 100);
                embed.addFields({ name: `${r.emoji} **${applyResult.petBonus.pet.name}**`, value: `+${pct}% trabajo`, inline: true });
            }
            if (applyResult.petEvolutions?.length > 0) {
                for (const evo of applyResult.petEvolutions) {
                    message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('✨ ¡Tu mascota evolucionó!')
                            .setDescription(`**${evo.name}** pasó de Forma ${evo.oldForm} a **Forma ${evo.newForm}**!`)
                            .setColor('#FFD700')]
                    }).catch(() => {});
                }
            }
            if (embedTrue) {
                const rewardText = falseMapResult.reward.type === 'money'
                    ? `${this.formatNumber(falseMapResult.reward.amount)} ${this.economy.config.currencySymbol}`
                    : falseMapResult.reward.type === 'xp'
                    ? `${falseMapResult.reward.amount} XP`
                    : `un ítem especial`;
                embed.addFields({
                    name: '🗺️ ¡Encontraste un Mapa del Tesoro!',
                    value: `Usa \`>mapa\` para ver tu primera pista.\n💰 Recompensa: ${rewardText} en ${falseMapResult.clueCount} pistas`,
                    inline: false
                });
            }

            if (hadContract && !sabotaged && sabotageHiredBy) {
                try {
                    const embed = new EmbedBuilder()
                        .setColor('#ff4444')
                        .setTitle('🗡️ Sicario Fallido')
                        .setDescription(`Tu sicario contra **${message.author.displayName}** falló.\n💸 El dinero pagado no se recupera.`)
                        .setTimestamp();

                    // Intentar canal primero, DM como fallback
                    let notified = false;
                    if (sabotageChannelId2) {
                        const channel = await message.client.channels.fetch(sabotageChannelId2).catch(() => null);
                        if (channel) {
                            await channel.send({ content: `<@${sabotageHiredBy}>`, embeds: [embed] });
                            notified = true;
                        }
                    }
                    if (!notified) {
                        const hirer = await message.client.users.fetch(sabotageHiredBy);
                        await hirer.send({ embeds: [embed] }).catch(() => {});
                    }
                } catch {}
            }
        } else {
            const lostText = applyResult.finalAmount < 0
                ? `${this.formatNumber(Math.abs(applyResult.finalAmount))} π-b$`
                : `0 π-b$ (ganaste ${this.formatNumber(applyResult.finalAmount)} π-b$ de consolación)`;
            embed.addFields(
                { name: '💸 Perdiste', value: lostText, inline: true },
                { name: '💳 Balance Actual', value: `${this.formatNumber(applyResult.newBalance)} π-b$`, inline: true },
            );
            if (sabotaged) {
                embed.addFields({ name: '🗡️ ¡Saboteado!', value: `Alguien contrató un sicario contra ti... **${this.formatNumber(applyResult.finalAmount)} ${this.economy.config.currencySymbol}** serán entregados a quien lo contrató.`, inline: false });
            }
            if (embedTrue) {
                embed.addFields({ name: '🗺️💔 Perdiste un mapa', value: 'El sicario se robó el mapa y se lo entregará a quien lo contrató.', inline: false });                
            }
            embed.setFooter({ text: '💔 Racha reseteada' });
        }

        await message.channel.send({ embeds: [embed] });

        if (applyResult.hitLimit) {
            await message.channel.send(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero.`);
        }

        // Achievements y misiones
        if (minigameResult.success) {
            if (this.achievements) {
                try {
                    const newAchievements = await this.achievements.checkAchievements(userId);
                    if (newAchievements.length > 0) await this.achievements.notifyAchievements(message, newAchievements);
                } catch (error) {
                    console.error('❌ Error verificando logros después del trabajo:', error);
                }
            }

            if (this.economy.missions) {
                const workMissions = await this.economy.missions.updateMissionProgress(userId, 'work');
                const moneyMissions = await this.economy.missions.updateMissionProgress(userId, 'money_earned_today', applyResult.finalAmount);
                const trinityMissions = await this.economy.missions.checkTrinityCompletion(userId);
                const allCompleted = [...workMissions, ...moneyMissions, ...trinityMissions];
                if (allCompleted.length > 0) await this.economy.missions.notifyCompletedMissions(message, allCompleted);
            }

            for (const event of this.events.getActiveEvents(message.guild?.id)) {
                if (event.type === 'treasure_hunt') {
                    const treasures = await this.events.checkSpecialEvents(userId, 'general', message);
                    for (const treasure of treasures) {
                        if (treasure.type === 'treasure') message.reply(`🗺️ **¡Tesoro encontrado!**\n${treasure.description}`);
                    }
                    break;
                }
            }
        }
    }

    async handleRobberyCommand(message, args) {
        const robberId = message.author.id;

        // ── Verificar mención ───────────────────────────────
        if (!message.mentions.users.first() && !args[0]) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('❌ Error')
                    .setDescription('Debes mencionar a un usuario para robar\n**Uso:** `>robar @usuario`')
                    .setTimestamp()]
            });
        }

        // ── Resolver target ─────────────────────────────────
        let targetUser = message.mentions.users.first();
        if (!targetUser && args[0]) {
            try {
                targetUser = await message.client.users.fetch(args[0]);
            } catch {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff4444')
                        .setTitle('❌ Usuario no encontrado')
                        .setDescription('No se pudo encontrar al usuario especificado')
                        .setTimestamp()]
                });
            }
        }

        const targetId = targetUser.id;

        if (targetUser.bot) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('🤖 Error')
                    .setDescription('No puedes robar a un bot')
                    .setTimestamp()]
            });
        }

        // ── canRob ──────────────────────────────────────────
        const canRobResult = await this.economy.canRob(robberId, targetId);
        if (!canRobResult.canRob) {
            let errorMessage = '';
            switch (canRobResult.reason) {
                case 'self_target':      errorMessage = 'No puedes robarte a ti mismo 🙄'; break;
                case 'level_too_low':    errorMessage = `Necesitas ser nivel **${canRobResult.requiredLevel}** para robar`; break;
                case 'target_too_poor':  errorMessage = `${targetUser.username} necesita tener al menos **${canRobResult.minBalance}** ${this.economy.config.currencySymbol}`; break;
                case 'cooldown': {
                    const h = Math.floor(canRobResult.timeLeft / (1000 * 60 * 60));
                    const m = Math.round((canRobResult.timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    errorMessage = h > 0
                        ? `Debes esperar **${h}h ${m}m** antes de robar de nuevo`
                        : `Debes esperar **${m} minutos** antes de robar de nuevo`;
                    break;
                }
                case 'already_robbing':  errorMessage = 'Ya tienes un robo en progreso'; break;
                case 'profession_block': errorMessage = `Tu profesión **${this.economy.getProfession(await this.economy.getUser(robberId))?.name}** no te permite robar`; break;
                case 'robber_rich':      errorMessage = 'Límite de dinero alcanzado'; break;
                default:                 errorMessage = 'No puedes robar en este momento';
            }
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('🚫 No puedes robar')
                    .setDescription(errorMessage)
                    .setTimestamp()]
            });
        }

        // ── PHANTOM GLOVES: bypass total ────────────────────
        if (this.shop) {
            const user = await this.economy.getUser(robberId);
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);

            for (const [, effects] of Object.entries(activeEffects)) {
                if (!Array.isArray(effects)) continue;
                for (const effect of effects) {
                    if (effect.type === 'robbery_boost' && effect.safe === true && effect.usesLeft > 0) {
                        const robberyResult = await this.economy.startRobbery(robberId, targetId, message);
                        if (!robberyResult.success) break;

                        robberyResult.robberyData.clicks = this.economy.robberyConfig.maxClicks;
                        const finishResult = await this.economy.finishRobbery(robberId, null); // null = garantizado

                        if (finishResult.success && finishResult.robberySuccess) {
                            const embed = new EmbedBuilder()
                                .setTitle('👻 Phantom Gloves — Robo Perfecto')
                                .setColor('#800080')
                                .setDescription(
                                    `Los guantes fantasma hicieron su magia.\n` +
                                    `<@${robberId}> robó **${finishResult.stolenAmount}** ${this.economy.config.currencySymbol} ` +
                                    `a <@${targetId}> sin ser detectado.`
                                )
                                .addFields(
                                    { name: '💰 Botín', value: `${finishResult.stolenAmount} ${this.economy.config.currencySymbol}`, inline: true },
                                    { name: '👻 Método', value: 'Phantom Gloves', inline: true },
                                    { name: '🎯 Eficiencia', value: '100%', inline: true }
                                )
                                .setTimestamp()

                            // Bonus de libros a minijuegos
                            const userMG = await this.economy.getUser(robberId);
                            const bookBonusesMG = this.economy.getBookBonuses(userMG);

                            // Mensaje de bonus de libros
                            if (bookBonusesMG.robBonus > 0) {
                                const pct = Math.round(bookBonusesMG.robBonus * 100);
                                embed.addFields({ name: `📚 **Biblioteca**`, value: `+${pct}% robo`, inline: true });
                            }         

                            await message.reply({
                                embeds: [embed]
                            });
                        }
                        return;
                    }
                }
            }
        }

        // ── Iniciar robo ────────────────────────────────────
        const robberyResult = await this.economy.startRobbery(robberId, targetId, message);

        if (!robberyResult.success) {
            let errorMessage = 'Hubo un problema al iniciar el robo.';
            switch (robberyResult.reason) {
                case 'already_robbing':  errorMessage = 'Ya tienes un robo en progreso'; break;
                case 'profession_block': errorMessage = `Tu profesión **${this.economy.getProfession(await this.economy.getUser(robberId))?.name}** no te permite robar`; break;
                case 'target_protected': {
                    const penaltyText = robberyResult.robberProtection
                        ? `\n\n${robberyResult.robberProtection}`
                        : robberyResult.penalty > 0
                            ? `\n\n💸 **Perdiste** ${robberyResult.penalty} ${this.economy.config.currencySymbol}`
                            : '';

                    if (robberyResult.protectionType === 'shield')
                        errorMessage = `🛡️ **${targetUser.displayName}** tiene un **Escudo Antirrobo**. Tu intento rebotó. 🏀${penaltyText}`;
                    else if (robberyResult.protectionType === 'vault')
                        errorMessage = `🏦 **${targetUser.displayName}** tiene una **Bóveda Permanente**. 🥜${penaltyText}`;
                    else
                        errorMessage = `🛡️ **${targetUser.displayName}** está bien protegido/a. 💰${penaltyText}`;
                    break;
                }
                default: errorMessage = `No se pudo iniciar el robo: ${robberyResult.reason || 'Razón desconocida'}`;
            }
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('❌ Error al iniciar robo')
                    .setDescription(errorMessage)
                    .setTimestamp()]
            });
        }

        // ════════════════════════════════════════════════════
        // FASE 1: CLICKS
        // ════════════════════════════════════════════════════

        // Verificar si tiene master_gloves (skip fase 1)
        let skipClicks = false;
        if (this.shop) {
            const user = await this.economy.getUser(robberId);
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            for (const [, effects] of Object.entries(activeEffects)) {
                if (!Array.isArray(effects)) continue;
                for (const effect of effects) {
                    if (effect.type === 'robbery_boost' && effect.safe !== true && effect.usesLeft > 0) {
                        skipClicks = true;
                    }
                }
            }
        }

        let finalClicks = 0;
        let phase1Finished = false;

        if (skipClicks) {
            // Master Gloves: saltar directamente con clicks máximos
            finalClicks = this.economy.robberyConfig.maxClicks;
            phase1Finished = true;

            await message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#4444ff')
                    .setTitle('🧤 Master Gloves Activados')
                    .setDescription(`Tus guantes maestros te saltaron la fase de infiltración.\n**Eficiencia máxima garantizada — el minijuego será Fácil.**`)
                    .setTimestamp()]
            });

            await new Promise(r => setTimeout(r, 1500));
        } else {
            // ── Embed de clicks ─────────────────────────────
            const progressBar = (clicks) => {
                const filled = Math.floor((clicks / this.economy.robberyConfig.maxClicks) * 20);
                return '█'.repeat(filled) + '░'.repeat(20 - filled);
            };

            const clickEmbed = () => new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🦹 INFILTRACIÓN EN PROGRESO')
                .setDescription(
                    `**Objetivo:** @${targetUser.username}\n` +
                    `*Llega al máximo de clicks antes de que se agote el tiempo para asegurar el minijuego más fácil.*`
                )
                .addFields(
                    { name: '⏱️ Tiempo', value: '30 segundos', inline: true },
                    { name: '👆 Clicks', value: `0/${this.economy.robberyConfig.maxClicks}`, inline: true },
                    { name: '📊 Progreso', value: progressBar(0), inline: false },
                    { name: '💡 Tip', value: '**0 clicks = fallo automático.** Más clicks = minijuego más fácil.', inline: false }
                )
                .setFooter({ text: '🧤 Master Gloves saltarían esta fase | 👻 Phantom Gloves saltarían todo' })
                .setTimestamp();

            const robButton = new ButtonBuilder()
                .setCustomId(`rob_${robberId}_${Date.now()}`)
                .setLabel('🏃 ¡INFILTRAR!')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(robButton);
            const clickMsg = await message.reply({ embeds: [clickEmbed()], components: [row] });

            let clicks = 0;
            let lastUpdate = Date.now();
            let clicksDone = false;

            await new Promise((resolve) => {
                const collector = clickMsg.createMessageComponentCollector({
                    time: this.economy.robberyConfig.buttonTimeLimit + 2000
                });

                collector.on('collect', async (interaction) => {
                    if (interaction.user.id !== robberId) {
                        await interaction.reply({ content: '❌ Solo el ladrón puede usar este botón', ephemeral: true });
                        return;
                    }

                    const clickResult = await this.economy.processRobberyClick(robberId);
                    if (!clickResult.success) {
                        if (clickResult.reason === 'time_expired') {
                            collector.stop('time_expired');
                        }
                        await interaction.deferUpdate();
                        return;
                    }

                    clicks = clickResult.clicks;
                    const now = Date.now();
                    const shouldUpdate = clicks % 5 === 0 || now - lastUpdate > 3000;

                    if (shouldUpdate) {
                        const filled = Math.floor((clicks / clickResult.maxClicks) * 20);
                        const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
                        const efficiency = Math.round((clicks / clickResult.maxClicks) * 100);
                        const diffLabel = efficiency >= 70 ? '🟢 Fácil' : efficiency >= 30 ? '🟡 Normal' : '🔴 Difícil';

                        const updatedEmbed = new EmbedBuilder()
                            .setColor('#ffaa00')
                            .setTitle('🦹 INFILTRACIÓN EN PROGRESO')
                            .setDescription(`**Objetivo:** @${targetUser.username}`)
                            .addFields(
                                { name: '⏱️ Tiempo restante', value: `${Math.ceil(clickResult.timeLeft / 1000)}s`, inline: true },
                                { name: '👆 Clicks', value: `${clicks}/${clickResult.maxClicks}`, inline: true },
                                { name: '🎯 Dificultad del minijuego', value: diffLabel, inline: true },
                                { name: '📊 Progreso', value: bar, inline: false }
                            )
                            .setTimestamp();

                        await interaction.update({ embeds: [updatedEmbed] });
                        lastUpdate = now;
                    } else {
                        await interaction.deferUpdate();
                    }

                    if (clickResult.maxReached) {
                        collector.stop('max_clicks');
                    }
                });

                collector.on('end', async (_, reason) => {
                    if (!clicksDone) {
                        clicksDone = true;
                        finalClicks = clicks;

                        // Deshabilitar botón
                        const disabledRow = new ActionRowBuilder().addComponents(
                            ButtonBuilder.from(robButton).setDisabled(true).setLabel('⌛ Fase completada')
                        );
                        try {
                            await clickMsg.edit({ components: [disabledRow] });
                        } catch {}

                        resolve();
                    }
                });
            });

            phase1Finished = true;
        }

        // ── 0 clicks → fallo automático ──────────────────────
        if (finalClicks === 0) {
            const finishResult = await this.economy.finishRobbery(robberId, false);
            const penalty = finishResult.success ? finishResult.penalty : 0;

            return message.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#800080')
                    .setTitle('🚨 Robo Fallido — Sin Infiltración')
                    .setDescription(
                        `<@${robberId}> no hizo ningún click y fue capturado en la entrada.\n` +
                        (penalty > 0
                            ? `💸 Penalización: **${penalty}** ${this.economy.config.currencySymbol}`
                            : '🛡️ Un Fortune Shield te protegió de la penalización.')
                    )
                    .setTimestamp()]
            });
        }

        // ════════════════════════════════════════════════════
        // FASE 2: MINIJUEGO
        // ════════════════════════════════════════════════════

        const clickEfficiency = Math.min(finalClicks / this.economy.robberyConfig.maxClicks, 1);
        const session = await this.robMinigames.createSession(robberId, targetUser.username, clickEfficiency);

        if (!session) {
            // Seguridad extra (no debería llegar aquí con clicks > 0)
            const finishResult = await this.economy.finishRobbery(robberId, false);
            return message.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#800080')
                    .setTitle('🚨 Robo Fallido')
                    .setDescription('Error interno al generar el minijuego.')
                    .setTimestamp()]
            });
        }

        // Pequeña pausa cinematográfica
        await new Promise(r => setTimeout(r, 1200));

        // Anuncio de transición
        await message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#111133')
                .setDescription(`*Sistema de seguridad de @${targetUser.username} detectado...*\n**Iniciando minijuego de intrusión.**`)
                .setTimestamp()]
        });

        await new Promise(r => setTimeout(r, 800));

        const { embed: mgEmbed, rows: mgRows } = this.robMinigames.buildMinigameComponents(session);
        const mgMsg = await message.channel.send({ embeds: [mgEmbed], components: mgRows });

        // ── Collector del minijuego ──────────────────────────
        let mgFinished = false;

        const processMinigameResult = async (minigameSuccess, reason = 'answered') => {
            if (mgFinished) return;
            mgFinished = true;

            // Deshabilitar botones
            const disabledRows = mgRows.map(row =>
                new ActionRowBuilder().addComponents(
                    row.components.map(b => ButtonBuilder.from(b).setDisabled(true))
                )
            );
            try { await mgMsg.edit({ components: disabledRows }); } catch {}

            // Finalizar robo en economy
            const finishResult = await this.economy.finishRobbery(robberId, minigameSuccess);

            if (!finishResult.success) {
                return message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff4444')
                        .setTitle('❌ Error')
                        .setDescription('Error al procesar el resultado del robo.')
                        .setTimestamp()]
                });
            }

            const diffEmoji = { easy: '🟢', normal: '🟡', hard: '🔴' }[session.difficulty] || '⚪';

            if (finishResult.robberySuccess) {
                // ── ÉXITO ──────────────────────────────────────
                const successEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🦹 ¡Robo Exitoso!')
                    .setDescription(
                        `<@${robberId}> superó el sistema de @${targetUser.username} y escapó con el botín.`
                    )
                    .addFields(
                        { name: '💰 Botín', value: `**${finishResult.stolenAmount}** ${this.economy.config.currencySymbol}`, inline: true },
                        { name: '📊 Clicks', value: `${finalClicks}/${this.economy.robberyConfig.maxClicks}`, inline: true },
                        { name: `${diffEmoji} Dificultad`, value: session.difficulty.charAt(0).toUpperCase() + session.difficulty.slice(1), inline: true },
                        { name: '🎮 Minijuego', value: session.minigame.title, inline: true },
                        { name: '📈 % Robado', value: `${finishResult.stealPercentage}% del balance`, inline: true },
                    );

                if (finishResult.usedItems?.length > 0) {
                    successEmbed.addFields({
                        name: '🔧 Items Usados',
                        value: finishResult.usedItems.map(i => `${i.name}`).join('\n'),
                        inline: false
                    });
                }

                // Bonus de libros a minijuegos
                const userMG = await this.economy.getUser(robberId);
                const bookBonusesMG = this.economy.getBookBonuses(userMG);

                // Mensaje de bonus de libros
                if (bookBonusesMG.robBonus > 0) {
                    const pct = Math.round(bookBonusesMG.robBonus * 100);
                    successEmbed.addFields({ name: `📚 **Biblioteca**`, value: `+${pct}% robo`, inline: false });
                }                

                if (reason === 'timeout') {
                    successEmbed.setFooter({ text: '⌛ Se acabó el tiempo del minijuego, pero lo resolviste a tiempo.' });
                }

                await message.channel.send({ embeds: [successEmbed] });

                if (finishResult.hitLimit) {
                    await message.channel.send({ content: `⚠️ **Límite alcanzado:** No pudiste recibir todo el botín porque tienes el máximo permitido.` });
                }

            } else {
                // ── FALLO ──────────────────────────────────────
                const failEmbed = new EmbedBuilder()
                    .setColor('#800080')
                    .setTitle('🚨 ¡Robo Fallido!');

                if (reason === 'timeout') {
                    failEmbed.setDescription(`<@${robberId}> no respondió a tiempo y fue capturado.`);
                } else {
                    failEmbed.setDescription(`<@${robberId}> eligió la opción incorrecta y fue capturado.`);
                }

                if (finishResult.protectionMessage) {
                    failEmbed.addFields(
                        { name: '🛡️ Protección', value: finishResult.protectionMessage, inline: false },
                    );
                } else {
                    failEmbed.addFields(
                        { name: '💸 Penalización', value: `**${finishResult.penalty}** ${this.economy.config.currencySymbol}`, inline: true },
                    );
                }

                failEmbed.addFields(
                    { name: '📊 Clicks', value: `${finalClicks}/${this.economy.robberyConfig.maxClicks}`, inline: true },
                    { name: `${diffEmoji} Dificultad`, value: session.difficulty.charAt(0).toUpperCase() + session.difficulty.slice(1), inline: true },
                    { name: '🎮 Minijuego', value: session.minigame.title, inline: true },
                );

                if (finishResult.usedItems?.length > 0) {
                    failEmbed.addFields({
                        name: '🔧 Items Usados',
                        value: finishResult.usedItems.map(i => `${i.name} (consumido)`).join('\n'),
                        inline: false
                    });
                }

                await message.channel.send({ embeds: [failEmbed] });
            }
        };

        const mgCollector = mgMsg.createMessageComponentCollector({
            time: session.timeLimit + 2000
        });

        mgCollector.on('collect', async (interaction) => {
            if (interaction.user.id !== robberId) {
                await interaction.reply({ content: '❌ Solo el ladrón puede responder este minijuego', ephemeral: true });
                return;
            }

            if (!this.robMinigames.isMinigameButton(interaction.customId, session)) {
                await interaction.deferUpdate();
                return;
            }

            await interaction.deferUpdate();

            const answeredValue = this.robMinigames.extractAnswer(interaction.customId);
            const result = this.robMinigames.processAnswer(robberId, answeredValue);

            if (!result.valid) return;

            mgCollector.stop('answered');
            await processMinigameResult(result.success, 'answered');
        });

        mgCollector.on('end', async (_, reason) => {
            if (reason !== 'answered' && !mgFinished) {
                this.robMinigames.expireSession(robberId);
                await processMinigameResult(false, 'timeout');
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

    async giveItemCommand(message, args) {
        if (message.author.bot) return;

        const YOUR_ID = '488110147265232898';
        const isOwner = message.author.id === YOUR_ID;
        const isAdmin = message.member?.permissions.has('Administrator');

        if (!isOwner && !isAdmin) {
            await message.reply('❌ No tienes permisos para usar este comando.');
            return;
        }

        const targetUser = message.mentions.users.first();
        const itemId = args[2];
        const quantity = parseInt(args[3]) || 1;

        if (!targetUser || !itemId) {
            await message.reply('❌ Uso: `>giveitem @usuario item_id cantidad`');
            return;
        }

        // Validar rate limit solo para admins
        if (!isOwner) {
            if (!await this.validateAdminCommand(message, targetUser, 'giveitem')) return;
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
            await message.reply(`❌ **${item.name}** no es stackeable y el usuario ya lo tiene.`);
            return;
        }

        if (currentQuantity + quantity > item.maxStack) {
            await message.reply(`❌ No puedes darle más de **${item.maxStack}** de este item.`);
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

        await message.reply(`✅ Se ha dado **${item.name} x${quantity}** a ${targetUser.displayName}.`);

        // Log por DM al owner (solo si lo usó un admin)
        if (!isOwner) {
            try {
                const owner = await message.client.users.fetch(YOUR_ID, { force: true })
                    .catch(() => message.client.users.cache.get(YOUR_ID));

                if (owner) {
                    const { EmbedBuilder } = require('discord.js');
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🚨 Log Admin — GiveItem')
                        .setDescription(`Comando usado en **${message.guild.name}**`)
                        .addFields(
                            { name: '👤 Admin', value: `${message.author} (${message.author.tag})`, inline: true },
                            { name: '🎯 Destino', value: `${targetUser} (${targetUser.tag})`, inline: true },
                            { name: '📦 Item', value: `${item.name} (${itemId}) x${quantity}`, inline: true }
                        )
                        .setColor('#FF9900')
                        .setTimestamp();

                    const dm = await owner.createDM();
                    await dm.send({ embeds: [logEmbed] });
                }
            } catch (error) {
                console.error('❌ Error enviando log DM:', error.message);
                console.log(`📋 LOG: ${message.author.tag} → ${targetUser.tag} +${item.name} x${quantity}`);
            }
        }
    }

    // Comando para ver estadísticas de la tienda
    async shopStatsCommand(message) {
        const YOUR_ID = '488110147265232898';
        const isOwner = message.author.id === YOUR_ID;
        const isAdmin = message.member?.permissions.has('Administrator');
        if (!isOwner && !isAdmin) {
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
        
        if (!isOwner) {
            try {
                const owner = await message.client.users.fetch(YOUR_ID);
                const logEmbed = new EmbedBuilder()
                    .setTitle('🚨 Log Admin - Shop Stats')
                    .setDescription(`Se usó \`>shopstats\` en **${message.guild.name}**`)
                    .addFields(
                        { name: '👤 Admin', value: `${message.author} (${message.author.tag})`, inline: true },
                        { name: '🖥️ Servidor', value: message.guild.name, inline: true }
                    )
                    .setColor('#FF9900')
                    .setTimestamp();
                await (await owner.createDM()).send({ embeds: [logEmbed] });
            } catch {}
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
                case '>pacto':
                    await this.handlePacto(message);
                    break;
                case '>mapa':
                    await this.handleMapa(message);
                    break;
                case '>excavar':
                    await this.handleExcavar(message, args);
                    break;
                case '>biblioteca':
                case '>libreria':
                    await this.handleBiblioteca(message, args);
                    break;
                case '>sicario':
                case '>hire':
                    await this.handleSicario(message, args);
                    break;
                case '>profesion':
                case '>profesión':
                case '>clase':
                case '>profesiones':
                case '>prof':
                    await this.handleProfesion(message, args);
                    break;
                case '>pedir':
                case '>mendigar':
                    await this.handlePedir(message);
                    break;
                case '>rachas':
                case '>racha':
                case '>presencia':
                    await this.handleRachas(message);
                    break;
                case '>huerto':
                case '>garden':
                case '>granja':
                    await this.handleHuerto(message, args);
                    break;
                case '>mascota':
                case '>pet':
                case '>mascotas':
                    await this.handleMascota(message, args);
                    break;
                case '>curar':
                case '>cure':
                case '>doctor':
                    await this.handleDoctorCure(message, args);
                    return;
                case '>casar':
                case '>marry':
                case '>proponer':
                    await this.handleCasar(message, args);
                    break;
                case '>divorcio':
                case '>divorce':
                    await this.handleDivorcio(message, args);
                    break;
                case '>pareja':
                case '>matrimonio':
                case '>esposo':
                case '>esposa':
                    await this.handleVerMatrimonio(message);
                    break;
                case '>mentor':
                    await this.handleMentor(message, args);
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
                case '>processrefunds': {
                    const YOUR_ID = '488110147265232898';
                    if (message.author.id !== YOUR_ID && !message.member?.permissions.has('Administrator')) {
                        return message.reply('❌ Sin permisos.');
                    }
                    await message.reply('⏳ Procesando reembolsos...');
                    await this.shop.processItemRefunds(message.channel);
                    break;
                }
                case '>changelog':
                case '>cambios':
                case '>updates':
                    await this.maintenance.showChangelog(message);
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
                    const recipeCat = args[1] || null;
                    const recipePage = parseInt(args[2]) || 1;
                    await this.crafting.showCraftingRecipes(message, recipePage, recipeCat);
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
                case '>maintenanceteston': {
                    if (message.author.id !== '488110147265232898') return;
                    this.maintenance.testMode = true;
                    this.maintenance.testUserId = '788424796366307409';
                    await message.reply('✅ Modo test activado. Solo el usuario de prueba verá los mensajes de mantenimiento.');
                    break;
                }

                case '>maintenancetestoff': {
                    if (message.author.id !== '488110147265232898') return;
                    this.maintenance.testMode = false;
                    this.maintenance.testUserId = null;
                    await message.reply('✅ Modo test desactivado. Todos los usuarios verán los mensajes normalmente.');
                    break;
                }

                case '>resetmaintenancetest': {
                    if (message.author.id !== '488110147265232898') return;
                    await this.economy.database.updateUserMaintenanceData('788424796366307409', {});
                    this.maintenance.invalidateCache();
                    await message.reply('✅ Datos de mantenimiento del usuario de prueba reseteados.');
                    break;
                }
                case '>setmaintenance': {
                    if (message.author.id !== '488110147265232898') return;

                    const timeArg = args[1];
                    if (!timeArg || !/^\d{1,2}:\d{2}$/.test(timeArg)) {
                        return message.reply('❌ Uso: `>setmaintenance HH:MM [mensaje]`\nEjemplo: `>setmaintenance 15:30 Actualización del sistema`');
                    }

                    const [hours, minutes] = timeArg.split(':').map(Number);
                    const scheduled = new Date();

                    // Ajustar a UTC-5 (Ecuador)
                    const utcOffset = -5;
                    scheduled.setUTCHours(hours - utcOffset, minutes, 0, 0);

                    if (scheduled.getTime() <= Date.now()) {
                        scheduled.setDate(scheduled.getDate() + 1);
                    }

                    const maintenanceMsg = args.slice(2).join(' ') || null;
                    const maintenanceId = await this.economy.database.setMaintenance(scheduled.getTime(), maintenanceMsg);
                    this.maintenance.invalidateCache();

                    const embed = new EmbedBuilder()
                        .setTitle('🔧 Mantenimiento Programado')
                        .setDescription(
                            `✅ Mantenimiento activado\n\n` +
                            `📅 Hora: <t:${Math.floor(scheduled.getTime() / 1000)}:f>\n` +
                            `⏰ En: <t:${Math.floor(scheduled.getTime() / 1000)}:R>\n` +
                            `🆔 ID: ${maintenanceId}\n\n` +
                            `${maintenanceMsg ? `📝 Mensaje: ${maintenanceMsg}` : '💡 Sin mensaje adicional'}`
                        )
                        .setColor('#FF6600')
                        .setTimestamp();

                    await message.reply({ embeds: [embed] });
                    break;
                }

                case '>endmaintenance': {
                    if (message.author.id !== '488110147265232898') return;

const maintenance = await this.economy.database.getActiveMaintenance();
const maintenanceId = maintenance?.id || null;
if (maintenance) await this.economy.database.disableMaintenance(maintenanceId);

                    // Leer changelog.json automáticamente
                    let changes = {};
                    try {
                        const fs = require('fs');
                        const raw = fs.readFileSync('./changelog.json', 'utf8');
                        changes = JSON.parse(raw);
                    } catch {
                        changes = { '✨ Actualización': ['Mejoras generales y correcciones de bugs'] };
                    }

                    await this.economy.database.setChangelog(maintenanceId || 0, changes);
                    this.maintenance.invalidateCache();

                    const embed = new EmbedBuilder()
                        .setTitle('✅ Mantenimiento Finalizado')
                        .setDescription('El changelog fue guardado. Los usuarios lo verán la próxima vez que usen un comando.')
                        .setColor('#00FF88')
                        .setTimestamp();

                    for (const [cat, items] of Object.entries(changes)) {
                        embed.addFields({ name: cat, value: items.map(i => `• ${i}`).join('\n'), inline: false });
                    }

                    await message.reply({ embeds: [embed] });
                    break;
                }

                case '>cancelmaintenance': {
                    if (message.author.id !== '488110147265232898') return;

                    const maintenance = await this.economy.database.getActiveMaintenance();
                    if (!maintenance) return message.reply('❌ No hay mantenimiento activo.');

                    await this.economy.database.disableMaintenance(maintenance.id);
                    this.maintenance.invalidateCache();
                    await message.reply('✅ Mantenimiento cancelado.');
                    break;
                }
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
            embed
                .setTitle('🤖 Pibot — Centro de Ayuda')
                .setDescription(
                    '> Usa los botones para explorar los comandos disponibles.\n' +
                    '> Escríbele a Pibot con **@Pibot** para chatear con la IA.\n\n' +
                    '💡 `>changelog` — ver las últimas novedades\n' +
                    '💡 `>profesion` — elige tu clase y desbloquea bonos\n' +
                    '💡 `>recipes` — taller de crafteo con categorías'
                )
                .addFields(
                    { name: '💰 Economía',      value: 'Trabajo, daily, robos, rankings',       inline: true },
                    { name: '🌿 Mundo',          value: 'Huerto, mascotas, expediciones',        inline: true },
                    { name: '💍 Social',         value: 'Matrimonio, mentor, mendicidad',        inline: true },
                    { name: '🛒 Tienda',         value: 'Items, inventario, cosméticos',         inline: true },
                    { name: '⚒️ Crafteo',        value: 'Recetas, materiales, cola de crafteo',  inline: true },
                    { name: '🎮 Minijuegos',     value: 'Coinflip, dados, blackjack y más',      inline: true },
                    { name: '🎲 Apuestas',       value: 'Apuestas directas entre usuarios',      inline: true },
                    { name: '🔄 Trading',        value: 'Intercambios y subastas',               inline: true },
                    { name: '🏆 Progreso',       value: 'Logros, misiones, niveles',             inline: true },
                    { name: '👑 VIP',            value: 'Beneficios y comandos premium',         inline: true },
                    { name: '🎵 Música',         value: 'Reproductor con Spotify y YouTube',     inline: true },
                    { name: '🤖 Chat IA',        value: 'Habla con Pibot mencionándolo',         inline: true },
                )
                .setFooter({ text: 'Pibot • Desarrollado por chasetodie10' })
                .setColor('#5865F2');

            const eventsEnabled = this.guildConfig
                ? await this.guildConfig.areEventsEnabled(message.guild?.id)
                : true;
            const isAdmin = message.member?.permissions?.has('ManageGuild');
            const uid = message.author.id;

            const rows = [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`help_economy_${uid}`).setLabel('💰 Economía').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_world_${uid}`).setLabel('🌿 Mundo').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`help_social_${uid}`).setLabel('💍 Social').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`help_shop_${uid}`).setLabel('🛒 Tienda').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_craft_${uid}`).setLabel('⚒️ Crafteo').setStyle(ButtonStyle.Primary),
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`help_games_${uid}`).setLabel('🎮 Minijuegos').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_betting_${uid}`).setLabel('🎲 Apuestas').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_trading_${uid}`).setLabel('🔄 Trading').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_progress_${uid}`).setLabel('🏆 Progreso').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_vip_${uid}`).setLabel('👑 VIP').setStyle(ButtonStyle.Secondary),
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`help_music_${uid}`).setLabel('🎵 Música').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_chatIA_${uid}`).setLabel('🤖 Chat IA').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_imagine_${uid}`).setLabel('🎨 Imágenes IA').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`help_nsfw_${uid}`).setLabel('🔞 NSFW').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`help_events_${uid}`).setLabel(eventsEnabled ? '🎉 Eventos' : '🔴 Eventos').setStyle(eventsEnabled ? ButtonStyle.Primary : ButtonStyle.Secondary),
                ),
            ];

            if (isAdmin) {
                rows.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`help_admin_${uid}`).setLabel('🛡️ Admin').setStyle(ButtonStyle.Danger)
                ));
            }
            if (message.author.id === '488110147265232898') {
                rows.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`help_dev_${uid}`).setLabel('🔧 Dev').setStyle(ButtonStyle.Danger)
                ));
            }

            await message.reply({ embeds: [embed], components: rows });
            return;
        }
        
        // CATEGORÍAS INDIVIDUALES (más cortas)
        const categories = {
            dev: {
                title: '🔧 Panel de Desarrollador',
                fields: [
                    { name: '💰 Economía Admin', value: '─────────────────', inline: false },
                    { name: '>addmoney @user <cant> <razón>', value: 'Dar dinero a un usuario', inline: true },
                    { name: '>removemoney @user <cant> <razón>', value: 'Quitar dinero a un usuario', inline: true },
                    { name: '>addxp @user <cant> <razón>', value: 'Dar XP a un usuario', inline: true },
                    { name: '>giveitem @user <item_id> <cant>', value: 'Dar item a un usuario', inline: true },
                    { name: '>processrefunds', value: 'Procesar reembolsos de precios', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '📊 Estadísticas', value: '─────────────────', inline: false },
                    { name: '>shopstats', value: 'Estadísticas globales de la tienda', inline: true },
                    { name: '>eventstats', value: 'Estadísticas de eventos activos', inline: true },
                    { name: '>debugpot', value: 'Debug del pozo semanal', inline: true },
                    { name: '>checklimits', value: 'Debug de límites de juegos', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🧹 Mantenimiento', value: '─────────────────', inline: false },
                    { name: '>cleancompletedpots', value: 'Limpiar pozos completados de la DB', inline: true },
                    { name: '>fixoldpots', value: 'Distribuir pozos antiguos sin procesar', inline: true },
                    { name: '>detectall', value: 'Detectar logros para todos los usuarios', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🔧 Mantenimiento Bot', value: '─────────────────', inline: false },
                    { name: '>setmaintenance HH:MM [mensaje]', value: 'Programar aviso de mantenimiento', inline: true },
                    { name: '>endmaintenance', value: 'Finalizar mantenimiento y publicar changelog', inline: true },
                    { name: '>cancelmaintenance', value: 'Cancelar mantenimiento activo', inline: true },
                    { name: '>maintenanceteston', value: 'Activar modo test (solo usuario de prueba)', inline: true },
                    { name: '>maintenancetestoff', value: 'Desactivar modo test', inline: true },
                    { name: '>resetmaintenancetest', value: 'Resetear datos del usuario de prueba', inline: true },

                    { name: '🤖 IA & Chat', value: '─────────────────', inline: false },
                    { name: '>orstatus / >aistatus', value: 'Ver estado de proveedores IA', inline: true },
                    { name: '>orcredits', value: 'Ver créditos y uso de IA', inline: true },
                    { name: '>chatstats', value: 'Estadísticas de conversaciones', inline: true },
                ]
            },
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

                    { name: '🏷️ Niveles Servidor', value: '─────────────────', inline: false },
                    { name: '>enablelevels', value: 'Activar sistema de niveles del servidor', inline: true },
                    { name: '>disablelevels', value: 'Desactivar sistema de niveles del servidor', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🔨 Moderación', value: '─────────────────', inline: false },
                    { name: '>clear [cantidad]', value: 'Borrar mensajes del canal', inline: true },
                ]
            },
            world: {
                title: '🌿 Mundo — Huerto & Mascotas',
                fields: [
                    { name: '🌿 Huerto', value: '─────────────────', inline: false },
                    { name: '>huerto', value: 'Ver estado de tu huerto', inline: true },
                    { name: '>huerto plantar <slot> <semilla>', value: 'Plantar una semilla', inline: true },
                    { name: '>huerto cosechar <slot/todo>', value: 'Cosechar plantas listas', inline: true },
                    { name: '>huerto fumigar <slot>', value: 'Eliminar plaga (500π)', inline: true },
                    { name: '>huerto help', value: 'Ver ayuda completa del huerto', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🐾 Mascotas', value: '─────────────────', inline: false },
                    { name: '>mascota', value: 'Ver tus mascotas', inline: true },
                    { name: '>mascota incubar', value: 'Incubar un 🥚 Huevo Misterioso', inline: true },
                    { name: '>mascota equipar <id>', value: 'Equipar mascota para bonos', inline: true },
                    { name: '>mascota desequipar', value: 'Desequipar mascota actual', inline: true },
                    { name: '>mascota expedicion <id> <tipo>', value: '`money` / `ingredients` / `special`', inline: true },
                    { name: '>mascota reclamar <id>', value: 'Reclamar recompensa de expedición', inline: true },
                    { name: '>mascota curar <id> <medicina>', value: 'Curar mascota enferma', inline: true },
                    { name: '>mascota liberar <id>', value: 'Liberar mascota a cambio de π', inline: true },
                    { name: '>mascota renombrar <id> <nombre>', value: 'Cambiar nombre de mascota', inline: true },
                    { name: '>mascota help', value: 'Ver ayuda completa de mascotas', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🛒 Ítems relacionados', value: '─────────────────', inline: false },
                    { name: '>buy common_seed', value: 'Semilla común (200π)', inline: true },
                    { name: '>buy pet_egg', value: 'Huevo misterioso (5,000π)', inline: true },
                    { name: '>buy pet_slot_extra', value: 'Slot extra de mascota (25,000π)', inline: true },
                ]
            },
            social: {
                title: '💍 Social — Matrimonio & Mentor',
                fields: [
                    { name: '💍 Matrimonio', value: '─────────────────', inline: false },
                    { name: '>casar @usuario', value: 'Proponer matrimonio (50,000π c/u)', inline: true },
                    { name: '>pareja', value: 'Ver estado de tu matrimonio', inline: true },
                    { name: '>divorcio', value: 'Iniciar proceso de divorcio', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '💰 Bonus matrimonial', value: '10% de tus ganancias van a tu pareja\n15% al mes de casados', inline: false },

                    { name: '🎓 Mentor', value: '─────────────────', inline: false },
                    { name: '>mentor', value: 'Ver tu relación de mentoría', inline: true },
                    { name: '>mentor @usuario', value: 'Proponer mentoría (tú nv20+, él nv5-)', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '🏅 Hitos del aprendiz', value: 'Nivel 10 → 5,000π\nNivel 15 → 15,000π\nNivel 20 → 30,000π + Mystery Box', inline: false },

                    { name: '🙏 Otros', value: '─────────────────', inline: false },
                    { name: '>pedir', value: 'Pedir dinero a 3 usuarios aleatorios', inline: true },
                    { name: '>curar @usuario', value: 'Curar maldición (solo Doctores)', inline: true },
                    { name: '>changelog', value: 'Ver las últimas novedades del bot', inline: true },
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
                    { name: '>profesion', value: 'Ver y cambiar tu profesión', inline: true },
                    { name: '>pacto', value: 'Pacto con el diablo (cada 48h)', inline: true },
                    { name: '>mapa', value: 'Mapa del tesoro (1% al trabajar)', inline: true },
                    { name: '>biblioteca', value: 'Libros que mejoran tus stats', inline: true },
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
                    { name: '>checkstats', value: 'Ver tus estadísticas de juego', inline: true },
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
                    { name: '>triviacategorias', value: 'Ver categorías disponibles de trivia', inline: true },
                    { name: '>triviacomp <apuesta>', value: 'Trivia competitiva multijugador', inline: true },                    { name: '>trivialb [tipo]', value: 'Rankings de trivia', inline: true },
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
                title: '⚒️ Crafteo — Taller de Ítems',
                fields: [
                    { name: '📋 Ver Recetas', value: '─────────────────', inline: false },
                    { name: '>recipes', value: 'Ver menú de recetas por categoría', inline: true },
                    { name: '>recipes <categoría>', value: '`potion` `combat` `nature` `economy` `artesano_exclusive`', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🔨 Craftear', value: '─────────────────', inline: false },
                    { name: '>craft <recipe_id>', value: 'Iniciar crafteo de una receta', inline: true },
                    { name: '>queue', value: 'Ver cola de crafteos en progreso', inline: true },
                    { name: '>cancelcraft <número>', value: 'Cancelar crafteo (recuperas 80%)', inline: true },

                    { name: '🛒 Materiales en tienda', value: '─────────────────', inline: false },
                    { name: 'fire_ember', value: '🔥 Brasa Ígnea (1,500π)', inline: true },
                    { name: 'crystal_shard', value: '💎 Fragmento de Cristal (2,000π)', inline: true },
                    { name: 'moon_essence', value: '🌙 Esencia Lunar (5,000π)', inline: true },
                    { name: 'shadow_fiber', value: '🕸️ Fibra de Sombra (4,000π)', inline: true },
                    { name: 'golden_dust', value: '✨ Polvo Dorado (10,000π)', inline: true },
                    { name: 'dragon_scale', value: '🐉 Escama de Dragón (15,000π)', inline: true },
                    { name: '⚗️ Artesano exclusivos', value: 'void_crystal (30,000π) • star_fragment (20,000π) • mythril_shard (25,000π)', inline: false },
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

    async handleVerMatrimonio(message) {
        const userId = message.author.id;
        const marriage = await this.economy.getMarriage(userId);

        if (!marriage) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('💍 Estado Civil')
                    .setDescription('No estás casado/a. Usa `>casar @usuario` para proponer matrimonio.')
                    .setColor('#888888')]
            });
        }

        const partnerId = marriage.user1_id === userId ? marriage.user2_id : marriage.user1_id;
        const monthsMarried = Math.floor((Date.now() - marriage.married_at) / (30 * 24 * 60 * 60 * 1000));
        const milestones = marriage.anniversary_milestones || [];

        const nextMilestone = [1, 3, 6, 12].find(m => !milestones.includes(m));
        const nextLabel = nextMilestone
            ? `${nextMilestone} ${nextMilestone === 1 ? 'mes' : 'meses'}`
            : '¡Todos los hitos alcanzados! 🏆';

        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('💍 Tu Matrimonio')
                .setColor('#ff69b4')
                .addFields(
                    { name: '💑 Pareja', value: `<@${partnerId}>`, inline: true },
                    { name: '📅 Casados desde', value: `<t:${Math.floor(marriage.married_at / 1000)}:D>`, inline: true },
                    { name: '🗓️ Tiempo juntos', value: `${monthsMarried} ${monthsMarried === 1 ? 'mes' : 'meses'}`, inline: true },
                    { name: '🏅 Hitos alcanzados', value: milestones.length > 0 ? milestones.map(m => `${m} mes`).join(', ') : 'Ninguno aún', inline: true },
                    { name: '🎯 Próximo hito', value: nextLabel, inline: true },
                    { name: '💰 Bonus activo', value: `+${milestones.includes(1) ? 15 : 10}% ganancias a tu pareja`, inline: true },
                )]
        });
    }

    async handleCasar(message, args) {
        const userId = message.author.id;
        const target = message.mentions.users.first();

        if (!target) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('💍 Sistema de Matrimonio')
                    .setColor('#ff69b4')
                    .addFields(
                        { name: '📝 Uso', value: '`>casar @usuario`', inline: false },
                        { name: '💰 Costo', value: '50,000π para cada uno', inline: true },
                        { name: '🎁 Bonus', value: '+10% de tus ganancias van a tu pareja\n(+15% al mes de casados)', inline: true },
                        { name: '⚠️ Notas', value: '• Ambos deben tener 50,000π\n• Cooldown de 30 días tras un divorcio', inline: false },
                    )]
            });
        }

        if (target.id === userId) return message.reply('❌ No puedes casarte contigo mismo 💀');
        if (target.bot) return message.reply('❌ No puedes casarte con un bot.');

        const result = await this.economy.proposeMarriage(userId, target.id);

        if (!result.success) {
            const reasons = {
                self: '❌ No puedes casarte contigo mismo.',
                already_married_proposer: '❌ Ya estás casado/a. Usa `>divorcio` primero.',
                already_married_target: `❌ **${target.displayName}** ya está casado/a.`,
                divorce_cooldown: `⏰ Debes esperar **${this.formatTimeLeft(result.timeLeft)}** antes de volver a casarte.`,
                proposer_no_money: `❌ Necesitas **${this.formatNumber(result.cost)} π-b$** para casarte.`,
                target_no_money: `❌ **${target.displayName}** no tiene suficiente dinero (necesita ${this.formatNumber(50000)} π-b$).`,
            };
            return message.reply(reasons[result.reason] || '❌ Error desconocido.');
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`marry_accept_${userId}_${target.id}`).setLabel('💍 Aceptar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`marry_reject_${userId}_${target.id}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger),
        );

        const proposalMsg = await message.channel.send({
            content: `<@${target.id}>`,
            embeds: [new EmbedBuilder()
                .setTitle('💍 ¡Propuesta de Matrimonio!')
                .setDescription(`<@${userId}> quiere casarse contigo 💕`)
                .addFields(
                    { name: '💰 Costo', value: `${this.formatNumber(result.cost)} π-b$ para cada uno`, inline: true },
                    { name: '⏰ Expira', value: 'En 60 segundos', inline: true },
                )
                .setColor('#ff69b4')],
            components: [row]
        });

        const collector = proposalMsg.createMessageComponentCollector({
            filter: i => i.user.id === target.id && (i.customId === `marry_accept_${userId}_${target.id}` || i.customId === `marry_reject_${userId}_${target.id}`),
            time: 60000,
            max: 1
        });

        collector.on('collect', async (interaction) => {
            if (interaction.customId.startsWith('marry_reject_')) {
                await interaction.update({
                    embeds: [new EmbedBuilder().setTitle('💔 Propuesta rechazada').setColor('#888888')],
                    components: []
                });
                return;
            }

            const acceptResult = await this.economy.acceptMarriage(userId, target.id);
            if (!acceptResult.success) {
                await interaction.update({ content: '❌ Error al procesar el matrimonio.', components: [] });
                return;
            }

            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle('💍 ¡Felicidades!')
                    .setDescription(`<@${userId}> y <@${target.id}> ¡ahora están casados! 🎊`)
                    .addFields({ name: '💰 Bonus activo', value: '+10% de tus ganancias irán a tu pareja automáticamente' })
                    .setColor('#ff69b4')],
                components: []
            });
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await proposalMsg.edit({
                    embeds: [new EmbedBuilder().setTitle('💍 Propuesta expirada').setColor('#888888')],
                    components: []
                }).catch(() => {});
            }
        });
    }

    async handleDivorcio(message, args) {
        const userId = message.author.id;

        const result = await this.economy.initiateDivorce(userId);

        if (!result.success) {
            const reasons = {
                not_married: '❌ No estás casado/a.',
                no_money: `❌ Necesitas al menos **${this.formatNumber(result.min)} π-b$** para iniciar un divorcio.`,
            };
            return message.reply(reasons[result.reason] || '❌ Error.');
        }

        const partnerId = result.partnerId;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`divorce_accept_${userId}_${result.marriage.id}`).setLabel('✅ Aceptar divorcio').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`divorce_reject_${userId}_${result.marriage.id}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger),
        );

        // Confirmar al iniciador
        await message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('💔 Solicitud de Divorcio Enviada')
                .setDescription(`Le enviaste la solicitud a <@${partnerId}>.\n\n• Si acepta: **50,000π** cada uno\n• Si no responde en 24h: **100,000π** solo tú`)
                .setColor('#ff4444')]
        });

        const notifMsg = await message.channel.send({
            content: `<@${partnerId}>`,
            embeds: [new EmbedBuilder()
                .setTitle('💔 Solicitud de Divorcio')
                .setDescription(`<@${userId}> quiere divorciarse.\n\n• Si aceptas: **50,000π** cada uno\n• Si rechazas o ignoras (24h): **100,000π** solo para quien lo inició`)
                .setColor('#ff4444')],
            components: [row]
        });

        const collector = notifMsg.createMessageComponentCollector({
            filter: i => i.user.id === partnerId,
            time: 24 * 60 * 60 * 1000,
            max: 1
        });

        collector.on('collect', async (interaction) => {
            const accepted = interaction.customId.startsWith('divorce_accept_');
            const divorceResult = await this.economy.processDivorce(result.marriage.id, userId, accepted);

            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle(accepted ? '💔 Divorcio completado' : '💕 Divorcio rechazado')
                    .setDescription(accepted
                        ? 'El matrimonio ha sido disuelto. Cada uno pagó 50,000π.'
                        : 'El divorcio fue rechazado. El matrimonio continúa.')
                    .setColor(accepted ? '#888888' : '#ff69b4')],
                components: []
            });
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await this.economy.processDivorce(result.marriage.id, userId, false);
                await notifMsg.edit({
                    embeds: [new EmbedBuilder()
                        .setTitle('💔 Divorcio por tiempo')
                        .setDescription(`No hubo respuesta en 24h. Se cobró **100,000π** a <@${userId}>.`)
                        .setColor('#888888')],
                    components: []
                }).catch(() => {});
            }
        });
    }

    async handleMentor(message, args) {
        const userId = message.author.id;
        const target = message.mentions.users.first();

        if (!target) {
            // Ver estado actual
            const mentorship = await this.economy.database.getMentorship(userId);

            if (!mentorship) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('🎓 Sistema de Mentoría')
                        .setColor('#5865F2')
                        .addFields(
                            { name: '📝 Uso', value: '`>mentor @usuario` — proponer mentoría', inline: false },
                            { name: '📋 Requisitos', value: '**Mentor:** Nivel 20+\n**Aprendiz:** Nivel 5 o menos', inline: false },
                            { name: '🏅 Hitos del aprendiz', value: 'Nivel 10 → 5,000π cada uno\nNivel 15 → 15,000π cada uno\nNivel 20 → 30,000π + Mystery Box (graduación)', inline: false },
                        )]
                });
            }

            const isMentor = mentorship.mentor_id === userId;
            const otherId = isMentor ? mentorship.apprentice_id : mentorship.mentor_id;
            const lastMilestone = mentorship.last_milestone || 0;

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🎓 Tu Mentoría — ${mentorship.status === 'completed' ? '✅ Completada' : '🔵 Activa'}`)
                    .setColor('#5865F2')
                    .addFields(
                        { name: isMentor ? '👨‍🎓 Tu Aprendiz' : '👨‍🏫 Tu Mentor', value: `<@${otherId}>`, inline: true },
                        { name: '📅 Iniciada', value: `<t:${Math.floor(mentorship.started_at / 1000)}:D>`, inline: true },
                        { name: '🏅 Último hito', value: lastMilestone > 0 ? `Nivel ${lastMilestone}` : 'Ninguno aún', inline: true },
                    )]
            });
        }

        if (target.id === userId) return message.reply('❌ No puedes ser tu propio mentor.');
        if (target.bot) return message.reply('❌ No puedes tener un bot como aprendiz.');

        // Verificar requisitos ANTES de enviar propuesta
        const mentor = await this.economy.getUser(userId);
        const apprentice = await this.economy.getUser(target.id);

        if (mentor.level < 20) return message.reply(`❌ Necesitas ser **Nivel 20** para ser mentor. (Eres nivel ${mentor.level})`);
        if (apprentice.level > 5) return message.reply(`❌ **${target.displayName}** debe ser nivel 5 o menos. (Es nivel ${apprentice.level})`);

        const mentorRel = await this.economy.database.getMentorship(userId);
        const apprenticeRel = await this.economy.database.getMentorship(target.id);
        if (mentorRel) return message.reply('❌ Ya tienes una mentoría activa.');
        if (apprenticeRel) return message.reply(`❌ **${target.displayName}** ya tiene un mentor activo.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mentor_accept_${userId}_${target.id}`).setLabel('✅ Aceptar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`mentor_reject_${userId}_${target.id}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger),
        );

        const proposalMsg = await message.channel.send({
            content: `<@${target.id}>`,
            embeds: [new EmbedBuilder()
                .setTitle('🎓 ¡Propuesta de Mentoría!')
                .setDescription(`<@${userId}> quiere ser tu mentor 👨‍🏫`)
                .addFields(
                    { name: '🏅 Hitos', value: 'Nivel 10 → 5,000π\nNivel 15 → 15,000π\nNivel 20 → 30,000π + Mystery Box', inline: false },
                    { name: '⏰ Expira', value: 'En 60 segundos', inline: true },
                )
                .setColor('#5865F2')],
            components: [row]
        });

        const collector = proposalMsg.createMessageComponentCollector({
            filter: i => i.user.id === target.id && (i.customId === `mentor_accept_${userId}_${target.id}` || i.customId === `mentor_reject_${userId}_${target.id}`),
            time: 60000,
            max: 1
        });

        collector.on('collect', async (interaction) => {
            if (interaction.customId.startsWith('mentor_reject_')) {
                await interaction.update({
                    embeds: [new EmbedBuilder().setTitle('❌ Propuesta rechazada').setColor('#888888')],
                    components: []
                });
                return;
            }

            const result = await this.economy.startMentorship(userId, target.id);
            if (!result.success) {
                await interaction.update({ content: '❌ Error al crear la mentoría.', components: [] });
                return;
            }

            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle('🎓 ¡Mentoría iniciada!')
                    .setDescription(`<@${userId}> ahora es el mentor de <@${target.id}> 🎉`)
                    .addFields({ name: '🏅 Hitos', value: 'Nivel 10 → 5,000π\nNivel 15 → 15,000π\nNivel 20 → 30,000π + Mystery Box (graduación)' })
                    .setColor('#5865F2')],
                components: []
            });
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await proposalMsg.edit({
                    embeds: [new EmbedBuilder().setTitle('🎓 Propuesta expirada').setColor('#888888')],
                    components: []
                }).catch(() => {});
            }
        });
    }

    async handleDoctorCure(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
        const prof = this.economy.getProfession(user);

        // Verificar profesión antes de cualquier otra cosa
        if (prof?.name !== '🩺 Doctor') {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Solo para Doctores')
                    .setDescription('Este comando es exclusivo de la profesión **🩺 Doctor**.\nUsa `>profesion doctor` para obtenerla.')
                    .setColor('#dc3545')]
            });
        }

        // Sin argumentos: mostrar ayuda del comando
        if (!args[1]) {
            const lastCure = user.stats?.lastDoctorCure || 0;
            const cooldownLeft = this.economy.doctorConfig.cooldown - (Date.now() - lastCure);
            const cdText = cooldownLeft > 0 ? `⏰ Cooldown: **${this.formatTimeLeft(cooldownLeft)}**` : '✅ Listo para curar';

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🩺 Doctor — Curar Maldición')
                    .setDescription('Como Doctor, puedes eliminar la maldición **☠️ Mano del Muerto** de cualquier usuario.')
                    .setColor('#00bcd4')
                    .addFields(
                        { name: '📝 Uso', value: '`>curar @usuario`\n`>curar` (para curarte a ti mismo)', inline: false },
                        { name: '💰 Costo', value: `**${this.formatNumber(this.economy.doctorConfig.cureCost)} π-b$** por curar a otro\n**Gratis** si te curas a ti mismo`, inline: true },
                        { name: '⏱️ Cooldown', value: '2 horas (solo curando a otros)', inline: true },
                        { name: '📍 Estado', value: cdText, inline: false },
                    )]
            });
        }

        // Determinar target
        let targetId = userId; // por defecto se cura a sí mismo
        let targetName = message.member?.displayName || message.author.username;

        const mentioned = message.mentions.users.first();
        if (mentioned) {
            targetId = mentioned.id;
            const member = message.guild?.members.cache.get(targetId);
            targetName = member?.displayName || mentioned.username;
        }

        const result = await this.economy.doctorCure(userId, targetId);

        if (!result.success) {
            const reasons = {
                not_doctor: '❌ No eres Doctor.',
                cooldown: `⏰ Debes esperar **${this.formatTimeLeft(result.timeLeft)}** para volver a curar.`,
                not_cursed: `✅ **${targetName}** no tiene ninguna maldición activa.`,
                no_money: `❌ Necesitas **${this.formatNumber(result.cost)} π-b$** para curar a otro usuario.`,
            };
            return message.reply(reasons[result.reason] || '❌ Error desconocido.');
        }

        if (result.isSelf) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🩺 ¡Autocuración exitosa!')
                    .setDescription('Te has curado la **☠️ Mano del Muerto** usando tus conocimientos médicos.\n\n*El Doctor se receta a sí mismo — clásico.*')
                    .setColor('#00bcd4')]
            });
        }

        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🩺 ¡Curación exitosa!')
                .setDescription(`Curaste la **☠️ Mano del Muerto** de <@${targetId}>`)
                .addFields(
                    { name: '💰 Cobrado', value: `${this.formatNumber(result.cost)} π-b$`, inline: true },
                    { name: '😮‍💨 Paciente', value: targetName, inline: true },
                )
                .setColor('#00bcd4')
                .setFooter({ text: '⏰ Cooldown de 2h activado' })]
        });
    }

    // ===== HUERTO =====
    async handleHuerto(message, args) {
        const userId = message.author.id;
        const sub = args[1];

        // Sin argumentos: mostrar estado del huerto
        if (!sub || sub === 'ver') {
            const garden = await this.economy.database.getGarden(userId);
            const user = await this.economy.getUser(userId);
            const totalSlots = 4 + (garden.extra_slots || 0);
            const now = Date.now();

            const formatTime = (ms) => {
                const h = Math.floor(ms / 3600000);
                const m = Math.floor((ms % 3600000) / 60000);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
            };

            let slotsText = '';
            for (let i = 1; i <= totalSlots; i++) {
                const slot = garden[`slot${i}`];
                if (!slot) {
                    slotsText += `**[Slot ${i}]** 🟫 Vacío\n`;
                } else if (slot.plagued) {
                    const seed = this.economy.SEEDS[slot.seedType];
                    slotsText += `**[Slot ${i}]** ⚠️ ${seed?.emoji || '🌱'} ${slot.seedType} — **PLAGADA** (usa \`>huerto fumigar ${i}\`)\n`;
                } else if (now >= slot.readyAt) {
                    const seed = this.economy.SEEDS[slot.seedType];
                    slotsText += `**[Slot ${i}]** ✅ ${seed?.emoji || '🌱'} ${slot.seedType} — **¡Lista para cosechar!**\n`;
                } else {
                    const seed = this.economy.SEEDS[slot.seedType];
                    slotsText += `**[Slot ${i}]** ${seed?.emoji || '🌱'} ${slot.seedType} — lista en **${formatTime(slot.readyAt - now)}**\n`;
                }
            }

            const prof = this.economy.getProfession(user);
            const isGranjero = prof?.gardenMult > 1;

            const embed = new EmbedBuilder()
                .setTitle('🌿 Tu Huerto')
                .setDescription(slotsText || 'No tienes slots disponibles.')
                .setColor('#4CAF50')
                .addFields({
                    name: '📋 Comandos',
                    value: '`>huerto plantar <slot> <semilla>` • `>huerto cosechar <slot>` • `>huerto cosechar todo` • `>huerto fumigar <slot>`'
                })
                .setFooter({ text: isGranjero ? '🌿 Bonus de Granjero activo: +50% ganancias' : `Slots: ${totalSlots}/8` });

            return message.reply({ embeds: [embed] });
        }

        if (sub === 'plantar') {
            const slot = parseInt(args[2]);
            const seedType = args[3];
            if (!slot || !seedType) return message.reply('❌ Uso: `>huerto plantar <slot> <tipo_semilla>`\nEjemplo: `>huerto plantar 1 common_seed`');

            const result = await this.economy.plantSeed(userId, slot, seedType);
            if (!result.success) {
                const reasons = {
                    invalid_slot: '❌ Slot inválido.',
                    slot_occupied: '❌ Ese slot ya está ocupado.',
                    invalid_seed: '❌ Tipo de semilla inválido.',
                    no_seed: '❌ No tienes esa semilla en el inventario. Cómprala con `>buy common_seed`.',
                };
                return message.reply(reasons[result.reason] || '❌ Error desconocido.');
            }

            const readyDate = new Date(result.readyAt);
            const seed = this.economy.SEEDS[result.seedType];
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🌱 ¡Semilla plantada!')
                    .setDescription(`Plantaste **${seed.emoji} ${result.seedType}** en el slot ${result.slot}`)
                    .addFields({ name: '⏰ Lista en', value: `<t:${Math.floor(result.readyAt / 1000)}:R>` })
                    .setColor('#4CAF50')]
            });
        }

        if (sub === 'cosechar') {
            const arg = args[2];

            if (arg === 'todo') {
                const results = await this.economy.harvestAll(userId);
                if (results.length === 0) return message.reply('❌ No hay plantas listas para cosechar.');

                const total = results.reduce((sum, r) => sum + r.money, 0);
                const ingredients = results.filter(r => r.ingredient).map(r => r.ingredient);

                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('🌾 ¡Cosecha masiva!')
                        .setDescription(`Cosechaste **${results.length}** slots`)
                        .addFields(
                            { name: '💰 Total ganado', value: `${this.formatNumber(total)} π-b$`, inline: true },
                            { name: '🌿 Ingredientes', value: ingredients.length > 0 ? ingredients.join(', ') : 'Ninguno esta vez', inline: true }
                        )
                        .setColor('#FFD700')]
                });
            }

            const slot = parseInt(arg);
            if (!slot) return message.reply('❌ Uso: `>huerto cosechar <slot>` o `>huerto cosechar todo`');

            const result = await this.economy.harvestSlot(userId, slot);
            if (!result.success) {
                const reasons = {
                    empty_slot: '❌ Ese slot está vacío.',
                    plagued: '⚠️ Esa planta está plagada. Fumígala primero.',
                    not_ready: `⏰ Todavía no está lista. Tiempo restante: **${this.formatTimeLeft(result.timeLeft)}**`,
                };
                return message.reply(reasons[result.reason] || '❌ Error.');
            }

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🌾 ¡Cosecha exitosa!')
                    .addFields(
                        { name: '💰 Ganaste', value: `${this.formatNumber(result.money)} π-b$`, inline: true },
                        { name: '🌿 Ingrediente', value: result.ingredient || 'Ninguno esta vez', inline: true }
                    )
                    .setColor('#FFD700')]
            });
        }

        if (sub === 'fumigar') {
            const slot = parseInt(args[2]);
            if (!slot) return message.reply('❌ Uso: `>huerto fumigar <slot>`');

            const result = await this.economy.fumigarSlot(userId, slot);
            if (!result.success) {
                const reasons = {
                    empty_slot: '❌ Ese slot está vacío.',
                    not_plagued: '✅ Esa planta no está plagada.',
                    no_money: `❌ Necesitas **${result.cost} π-b$** para fumigar.`,
                };
                return message.reply(reasons[result.reason] || '❌ Error.');
            }

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🧪 ¡Fumigación exitosa!')
                    .setDescription(`El slot fue fumigado por **${result.cost} π-b$**. La planta puede seguir creciendo.`)
                    .setColor('#4CAF50')]
            });
        }

        if (sub === 'help' || sub === 'ayuda') {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🌿 Ayuda — Huerto')
                    .setColor('#4CAF50')
                    .addFields(
                        { name: '`>huerto`', value: 'Ver el estado de tu huerto', inline: true },
                        { name: '`>huerto plantar <slot> <semilla>`', value: 'Plantar una semilla en un slot', inline: true },
                        { name: '`>huerto cosechar <slot>`', value: 'Cosechar un slot listo', inline: true },
                        { name: '`>huerto cosechar todo`', value: 'Cosechar todos los slots listos', inline: true },
                        { name: '`>huerto fumigar <slot>`', value: 'Fumigar un slot plagado (500 π-b$)', inline: true },
                        { name: '🌱 Semillas disponibles', value: '`common_seed` → 2h\n`rare_seed` → 6h\n`epic_seed` → 12h\n`legendary_seed` → 24h', inline: false },
                        { name: '🪴 Slots extra', value: 'Compra `garden_slot_extra` en la tienda para ampliar de 4 a 8 slots', inline: false },
                        { name: '⚠️ Plagas', value: 'Cada hora hay 5% de que un slot se plague. Si no lo fumigas no puedes cosechar esa planta.', inline: false },
                        { name: '🌿 Granjero', value: 'La profesión Granjero da +50% de ganancias en el huerto', inline: false },
                    )]
            });
        }

        return message.reply('❌ Subcomando inválido. Usa `>huerto help` para ver todos los comandos.');
    }

    // ===== MASCOTAS =====
    async handleMascota(message, args) {
        const userId = message.author.id;
        const sub = args[1];

        const rarityColors = { common: '#aaaaaa', uncommon: '#55aa55', rare: '#5588ff', epic: '#aa55ff', legendary: '#FFD700' };

        if (!sub || sub === 'ver') {
            const pets = await this.economy.database.getUserPets(userId);
            if (pets.length === 0) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('🐾 Tus Mascotas')
                        .setDescription('No tienes mascotas. Consigue un 🥚 **Huevo Misterioso** trabajando o cómpralo en la tienda, luego usa `>mascota incubar`.')
                        .setColor('#888888')]
                });
            }

            const rarityData = this.economy.PET_RARITIES;
            let desc = '';
            for (const pet of pets) {
                const r = rarityData[pet.rarity];
                const statusIcon = pet.sick ? '🤒' : pet.equipped ? '✅' : pet.expedition_end ? '🗺️' : '💤';
                const formLabel = pet.form === 3 ? 'Forma III' : pet.form === 2 ? 'Forma II' : 'Forma I';
                desc += `${statusIcon} **[${pet.id}]** ${r.emoji} **${pet.name}** — ${r.name} | Nv.${pet.level} | ${formLabel}\n`;
            }

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🐾 Tus Mascotas')
                    .setDescription(desc)
                    .setColor('#FFD700')
                    .setFooter({ text: `${pets.length}/5 mascotas | ✅ equipada • 🤒 enferma • 🗺️ expedición • 💤 descansando` })]
            });
        }

        if (sub === 'info') {
            const petId = parseInt(args[2]);
            if (!petId) return message.reply('❌ Uso: `>mascota info <id>`');

            const pet = await this.economy.database.getPet(petId);
            if (!pet || pet.user_id !== userId) return message.reply('❌ Mascota no encontrada.');

            const r = this.economy.PET_RARITIES[pet.rarity];
            const xpNeeded = r.xpToLevel * pet.level;
            const bonusText = r.bonus.type === 'all' ? `+${r.bonus.amount * 100}% a todo` : `+${r.bonus.amount * 100}% a ${r.bonus.type}`;
            const statusText = pet.sick ? '🤒 Enferma' : pet.equipped ? '✅ Equipada' : pet.expedition_end ? `🗺️ En expedición (<t:${Math.floor(pet.expedition_end / 1000)}:R>)` : '💤 Descansando';

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`${r.emoji} ${pet.name}`)
                    .setColor(rarityColors[pet.rarity])
                    .addFields(
                        { name: '⭐ Rareza', value: r.name, inline: true },
                        { name: '📊 Nivel', value: `${pet.level}`, inline: true },
                        { name: '🔮 Forma', value: `${pet.form}/3`, inline: true },
                        { name: '✨ XP', value: `${pet.xp}/${xpNeeded}`, inline: true },
                        { name: '🎁 Bonus', value: bonusText, inline: true },
                        { name: '📍 Estado', value: statusText, inline: true },
                    )]
            });
        }

        if (sub === 'incubar') {
            const user = await this.economy.getUser(userId);
            const items = user.items || {};
            if (!items['pet_egg'] || items['pet_egg'].quantity < 1) {
                return message.reply('❌ No tienes ningún **🥚 Huevo Misterioso**. Trabaja para conseguir uno o cómpralo con `>buy pet_egg`.');
            }

            // Consumir el huevo
            items['pet_egg'].quantity -= 1;
            if (items['pet_egg'].quantity <= 0) delete items['pet_egg'];
            await this.economy.updateUser(userId, { items });

            const waitMsg = await message.reply('🥚 Incubando el huevo...');
            await new Promise(res => setTimeout(res, 1500));
            await waitMsg.edit('🌡️ El huevo empieza a vibrar...');
            await new Promise(res => setTimeout(res, 1500));
            await waitMsg.edit('✨ ¡Algo está saliendo!...');
            await new Promise(res => setTimeout(res, 1000));

            const result = await this.economy.incubateEgg(userId);
            if (!result.success) {
                // Devolver el huevo si falló
                items['pet_egg'] = items['pet_egg'] || { id: 'pet_egg', quantity: 0 };
                items['pet_egg'].quantity += 1;
                await this.economy.updateUser(userId, { items });
                return message.reply(`❌ Ya tienes el máximo de **${result.max}** mascotas. Libera una con \`>mascota liberar <id>\` o compra más espacio con \`>buy pet_slot_extra\`.`);
            }

            const r = this.economy.PET_RARITIES[result.rarity];
            return waitMsg.edit({
                content: '',
                embeds: [new EmbedBuilder()
                    .setTitle('🥚 ¡El huevo eclosionó!')
                    .setDescription(`¡Apareció **${r.emoji} ${result.name}**!\n\nRareza: **${r.name}**\nUsa \`>mascota equipar ${result.petId}\` para equiparla.`)
                    .setColor(rarityColors[result.rarity])]
            });
        }

        if (sub === 'equipar') {
            const petId = parseInt(args[2]);
            if (!petId) return message.reply('❌ Uso: `>mascota equipar <id>`');

            const result = await this.economy.equipPet(userId, petId);
            if (!result.success) {
                const reasons = {
                    not_found: '❌ Mascota no encontrada.',
                    sick: '❌ No puedes equipar una mascota enferma. ¡Cúrala primero!',
                    on_expedition: '❌ Esa mascota está en expedición.',
                };
                return message.reply(reasons[result.reason] || '❌ Error.');
            }

            return message.reply(`✅ ¡**${result.pet.name}** equipada! Ahora te da sus bonos en trabajos y daily.`);
        }

        if (sub === 'liberar') {
            const petId = parseInt(args[2]);
            if (!petId) return message.reply('❌ Uso: `>mascota liberar <id>`');

            const pet = await this.economy.database.getPet(petId);
            if (!pet || pet.user_id !== userId) return message.reply('❌ Mascota no encontrada.');

            const r = this.economy.PET_RARITIES[pet.rarity];
            const rarityRewards = { common: 500, uncommon: 1500, rare: 4000, epic: 10000, legendary: 30000 };
            const baseReward = rarityRewards[pet.rarity] || 500;
            const estimatedReward = baseReward + pet.level * 100;

            // Pedir confirmación
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`pet_release_confirm_${userId}_${petId}`).setLabel('💔 Sí, liberar').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`pet_release_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
            );

            const confirmMsg = await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('⚠️ ¿Seguro que quieres liberar esta mascota?')
                    .setDescription(`Vas a liberar a **${r.emoji} ${pet.name}** (${pet.rarity}, Nv.${pet.level}, Forma ${pet.form})\n\nEsta acción **no se puede deshacer**.`)
                    .addFields(
                        { name: '💰 Recompensa estimada', value: `~${this.formatNumber(estimatedReward)} π-b$`, inline: true },
                        { name: '🥚 Huevo de vuelta', value: pet.form >= 2 ? '✅ Sí (Forma 2+)' : '❌ No (solo Forma 1)', inline: true },
                    )
                    .setColor('#ff4444')],
                components: [row]
            });

            const collector = confirmMsg.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 30000,
                max: 1
            });

            collector.on('collect', async (interaction) => {
                if (interaction.customId.startsWith('pet_release_cancel_')) {
                    return interaction.update({
                        embeds: [new EmbedBuilder().setTitle('❌ Liberación cancelada').setColor('#888888')],
                        components: []
                    });
                }

                const result = await this.economy.liberarMascota(userId, petId);
                if (!result.success) {
                    const reasons = {
                        not_found: '❌ Mascota no encontrada.',
                        equipped: '❌ Desequipa la mascota antes de liberarla.',
                        on_expedition: '❌ La mascota está en expedición.',
                    };
                    return interaction.update({ content: reasons[result.reason] || '❌ Error.', components: [] });
                }

                return interaction.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('💔 Mascota liberada')
                        .setDescription(`**${r.emoji} ${result.petName}** fue liberada. Espero que seas feliz donde vayas... 🌈`)
                        .addFields(
                            { name: '💰 Recibiste', value: `${this.formatNumber(result.reward)} π-b$`, inline: true },
                            { name: '🥚 Huevo', value: result.givesEgg ? '¡Recibiste un huevo de vuelta!' : 'Sin huevo (era Forma 1)', inline: true },
                        )
                        .setColor('#888888')],
                    components: []
                });
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    await confirmMsg.edit({ components: [] }).catch(() => {});
                }
            });

            return;
        }

        if (sub === 'desequipar') {
            const current = await this.economy.database.getEquippedPet(userId);
            if (!current) return message.reply('❌ No tienes ninguna mascota equipada.');

            await this.economy.database.updatePet(current.id, { equipped: 0 });
            return message.reply(`✅ **${current.name}** fue desequipada. Ya puedes enviarla de expedición.`);
        }

        if (sub === 'renombrar') {
            const petId = parseInt(args[2]);
            const newName = args.slice(3).join(' ');
            if (!petId || !newName) return message.reply('❌ Uso: `>mascota renombrar <id> <nuevo nombre>`');
            if (newName.length > 30) return message.reply('❌ El nombre no puede tener más de 30 caracteres.');

            const pet = await this.economy.database.getPet(petId);
            if (!pet || pet.user_id !== userId) return message.reply('❌ Mascota no encontrada.');

            await this.economy.database.updatePet(petId, { name: newName });
            return message.reply(`✅ Tu mascota ahora se llama **${newName}** 🐾`);
        }

        if (sub === 'curar') {
            const petId = parseInt(args[2]);
            const itemId = args[3];
            if (!petId || !itemId) return message.reply('❌ Uso: `>mascota curar <id> <medicina>`\nMedicinas: `medicine_basic`, `medicine_advanced`, `medicine_legendary`');

            const result = await this.economy.curePet(userId, petId, itemId);
            if (!result.success) {
                const reasons = {
                    not_found: '❌ Mascota no encontrada.',
                    not_sick: '✅ Esa mascota no está enferma.',
                    invalid_item: '❌ Ítem de cura inválido.',
                    wrong_medicine: '❌ Esa medicina no sirve para la rareza de tu mascota.',
                    no_item: '❌ No tienes esa medicina. Cómprala en la tienda.',
                };
                return message.reply(reasons[result.reason] || '❌ Error.');
            }

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('💊 ¡Mascota curada!')
                    .setDescription(`**${result.petName}** se recuperó completamente. ¡Ya puede dar bonos de nuevo!`)
                    .setColor('#00ff88')]
            });
        }

        if (sub === 'expedicion' || sub === 'expedición') {
            const petId = parseInt(args[2]);
            const type = args[3];

            if (!petId || !type) return message.reply('❌ Uso: `>mascota expedicion <id> <tipo>`\nTipos: `money` (forma 1+) • `ingredients` (forma 2+) • `special` (forma 3)`');

            const result = await this.economy.sendPetExpedition(userId, petId, type);
            if (!result.success) {
                const reasons = {
                    not_found: '❌ Mascota no encontrada.',
                    sick: '❌ No puedes enviar una mascota enferma.',
                    equipped: '❌ Desequipa la mascota antes de enviarla.',
                    already_on_expedition: '❌ Ya está en una expedición.',
                    invalid_type: '❌ Tipo inválido. Usa `money`, `ingredients` o `special`.',
                    form_required: `❌ Necesitas Forma ${result?.required} para ese tipo de expedición.`,
                };
                return message.reply(reasons[result.reason] || '❌ Error.');
            }

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🗺️ ${result.label}`)
                    .setDescription(`Tu mascota salió de expedición. Regresa <t:${Math.floor(result.expeditionEnd / 1000)}:R> para reclamar la recompensa.`)
                    .addFields({ name: '📋 Reclamar', value: `\`>mascota reclamar ${petId}\`` })
                    .setColor('#5865F2')]
            });
        }

        if (sub === 'reclamar') {
            const petId = parseInt(args[2]);
            if (!petId) return message.reply('❌ Uso: `>mascota reclamar <id>`');

            const result = await this.economy.claimPetExpedition(userId, petId);
            if (!result.success) {
                const reasons = {
                    not_found: '❌ Mascota no encontrada.',
                    not_on_expedition: '❌ Esa mascota no está en expedición.',
                    not_ready: `⏰ La expedición termina <t:${Math.floor((Date.now() + result.timeLeft) / 1000)}:R>.`,
                };
                return message.reply(reasons[result.reason] || '❌ Error.');
            }

            const rewardText = result.reward.money
                ? `💰 **${this.formatNumber(result.reward.money)} π-b$**`
                : result.reward.ingredient
                    ? `🌿 **${result.reward.ingredient}**`
                    : '✨ Recompensa especial';

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🎉 ¡Expedición completada!')
                    .addFields(
                        { name: '🎁 Recompensa', value: rewardText, inline: true },
                        { name: '✨ XP ganada', value: `+${result.xpBonus} XP`, inline: true },
                    )
                    .setColor('#FFD700')]
            });
        }

        if (sub === 'help' || sub === 'ayuda') {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🐾 Ayuda — Mascotas')
                    .setColor('#FFD700')
                    .addFields(
                        { name: '`>mascota`', value: 'Ver todas tus mascotas', inline: true },
                        { name: '`>mascota info <id>`', value: 'Ver detalles de una mascota', inline: true },
                        { name: '`>mascota incubar`', value: 'Incubar un 🥚 Huevo Misterioso', inline: true },
                        { name: '`>mascota equipar <id>`', value: 'Equipar mascota para recibir bonos', inline: true },
                        { name: '`>mascota desequipar`', value: 'Desequipar mascota actual', inline: true },
                        { name: '`>mascota liberar <id>`', value: 'Liberar mascota a cambio de π-b$ y posible huevo', inline: true },
                        { name: '`>mascota renombrar <id> <nombre>`', value: 'Cambiar el nombre de una mascota', inline: true },
                        { name: '`>mascota curar <id> <medicina>`', value: 'Curar mascota enferma', inline: true },
                        { name: '`>mascota expedicion <id> <tipo>`', value: 'Enviar a expedición (`money` / `ingredients` / `special`)', inline: true },
                        { name: '`>mascota reclamar <id>`', value: 'Reclamar recompensa de expedición', inline: true },
                        { name: '💊 Medicinas', value: '`medicine_basic` → común/poco común\n`medicine_advanced` → rara/épica\n`medicine_legendary` → cualquiera', inline: false },
                        { name: '🗺️ Expediciones', value: '`money` → Forma 1+ (2h)\n`ingredients` → Forma 2+ (4h)\n`special` → Forma 3 (8h)', inline: false },
                        { name: '🥚 ¿Cómo conseguir mascotas?', value: 'Compra un huevo con `>buy pet_egg` y luego usa `>mascota incubar`', inline: false },
                    )]
            });
        }

        return message.reply('❌ Subcomando inválido. Usa `>mascota help` para ver todos los comandos.');
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

        if (category === 'dev') {
            if (interaction.user.id !== '488110147265232898') {
                return interaction.reply({
                    content: '❌ Esta sección es solo para el desarrollador.',
                    ephemeral: true
                });
            }

            const embed1 = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🔧 Panel de Desarrollador (1/2)')
                .addFields(
                    { name: '💰 Economía Admin', value: '─────────────────', inline: false },
                    { name: '>addmoney @user <cant> <razón>', value: 'Dar dinero a un usuario', inline: true },
                    { name: '>removemoney @user <cant> <razón>', value: 'Quitar dinero a un usuario', inline: true },
                    { name: '>addxp @user <cant> <razón>', value: 'Dar XP a un usuario', inline: true },
                    { name: '>giveitem @user <item_id> <cant>', value: 'Dar item a un usuario', inline: true },
                    { name: '>processrefunds', value: 'Procesar reembolsos de precios', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '📊 Estadísticas', value: '─────────────────', inline: false },
                    { name: '>shopstats', value: 'Estadísticas globales de la tienda', inline: true },
                    { name: '>eventstats', value: 'Estadísticas de eventos activos', inline: true },
                    { name: '>debugpot', value: 'Debug del pozo semanal', inline: true },
                    { name: '>checklimits', value: 'Debug de límites de juegos', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },

                    { name: '🧹 Mantenimiento DB', value: '─────────────────', inline: false },
                    { name: '>cleancompletedpots', value: 'Limpiar pozos completados', inline: true },
                    { name: '>fixoldpots', value: 'Distribuir pozos antiguos', inline: true },
                    { name: '>detectall', value: 'Detectar logros para todos', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                );

            const embed2 = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🔧 Panel de Desarrollador (2/2)')
                .addFields(
                    { name: '🔧 Mantenimiento Bot', value: '─────────────────', inline: false },
                    { name: '>setmaintenance HH:MM [mensaje]', value: 'Programar aviso de mantenimiento', inline: true },
                    { name: '>endmaintenance', value: 'Finalizar y publicar changelog automático', inline: true },
                    { name: '>cancelmaintenance', value: 'Cancelar mantenimiento activo', inline: true },
                    { name: '>maintenanceteston', value: 'Activar modo test', inline: true },
                    { name: '>maintenancetestoff', value: 'Desactivar modo test', inline: true },
                    { name: '>resetmaintenancetest', value: 'Resetear datos del usuario de prueba', inline: true },

                    { name: '🤖 IA & Chat', value: '─────────────────', inline: false },
                    { name: '>orstatus / >aistatus', value: 'Ver estado de proveedores IA', inline: true },
                    { name: '>orcredits', value: 'Ver créditos y uso de IA', inline: true },
                    { name: '>chatstats', value: 'Estadísticas de conversaciones', inline: true },
                );

            return interaction.reply({
                embeds: [embed1, embed2],
                ephemeral: true
            });
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
