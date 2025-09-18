const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class AllCommands {
    constructor(economySystem, shopSystem, tradeSystem, auctionSystem, craftingSystem,  eventsSystem, bettingSystem, achievementsSystem) {
        this.economy = economySystem;
        this.shop = shopSystem;
        this.trades = tradeSystem;
        this.auctions = auctionSystem;
        this.crafting = craftingSystem;
        this.events = eventsSystem;
        this.betting = bettingSystem;
        this.achievements = achievementsSystem;
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
            
            // ✅ COMBINAR AMBOS RESULTADOS:
            const allCompleted = [...dailyMissions, ...moneyMissions];
            if (allCompleted.length > 0) {
                await this.economy.missions.notifyCompletedMissions(message, allCompleted);
            }
        }

        // Verificar tesoros al final
        for (const event of this.events.getActiveEvents()) {
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

        // AÑADIR esto:
        const targetUserData = await this.economy.getUser(targetUser.id);
        if (targetUserData.balance + amount > this.economy.config.maxBalance) {
            const spaceLeft = this.economy.config.maxBalance - targetUserData.balance;
            await message.reply(`❌ ${targetUser.displayName} alcanzaría el límite máximo de 10M π-b$. Solo puedes enviar ${this.formatNumber(spaceLeft)} π-b$ más.`);
            return;
        }
        
        // Realizar transferencia
        const userBalance = await this.economy.getUser(message.author.id);
        const otherUserBalance = await this.economy.getUser(targetUser.id);
        const result = await this.economy.transferMoney(message.author.id, targetUser.id, amount);
        
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
            embed.setFooter({ text: 'Usa >top money para ver el ranking de dinero' });
        } else {
            embed.setFooter({ text: 'Usa >top level para ver el ranking de niveles' });
        }
        
        await message.reply({ embeds: [embed] });
    }

    async handleAddMoney(message, client) {        
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
                    { name: '🎁 Recompensa', value: `+${xpResult.reward} π-b$`, inline: true },
                    { name: '🏆 Niveles Subidos', value: `${xpResult.levelsGained}`, inline: true }
                )
                .setColor('#FFD700')
                .setTimestamp();
            await message.channel.send({ embeds: [levelUpEmbed] });
        }
    }

    formatAllBonuses(result) {
        let bonuses = [];
        
        if (result.eventMessage) bonuses.push(result.eventMessage);
        if (result.pickaxeMessage) bonuses.push(result.pickaxeMessage);
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
        const result = await this.economy.doWork(userId, jobType);

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
                
                const allCompleted = [...workMissions, ...moneyMissions];
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
            for (const event of this.events.getActiveEvents()) {
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

        if (this.shop) {
            const user = await this.economy.getUser(robberId);
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            
            for (const [itemId, effects] of Object.entries(activeEffects)) {
                for (const effect of effects) {
                    if (effect.type === 'robbery_boost' && effect.safe === true && effect.usesLeft > 0) {
                        // Auto-ejecutar el robo sin minijuego
                        const autoRobberyResult = await this.economy.startRobbery(robberId, targetId, message);
                        if (autoRobberyResult.success) {
                            // Simular clicks máximos para mejor resultado
                            autoRobberyResult.robberyData.clicks = this.economy.robberyConfig.maxClicks;
                            this.economy.activeRobberies.set(robberId, autoRobberyResult.robberyData);
                            
                            const finishResult = await this.economy.finishRobbery(robberId);
                            
                            // Consumir phantom gloves
                            await this.shop.consumeRobberyItems(robberId);
                            
                            // Mostrar resultado inmediatamente
                            const phantomEmbed = new EmbedBuilder()
                                .setTitle('👻 Robo Fantasma Exitoso')
                                .setDescription(`Los **Phantom Gloves** permitieron a ${message.author.username} robar sin ser detectado!`)
                                .addFields([
                                    { name: '💰 Cantidad robada', value: `${finishResult.stolenAmount} ${this.economy.config.currencySymbol}`, inline: true },
                                    { name: '👻 Método', value: 'Robo fantasma instantáneo', inline: true },
                                ])
                                .setColor('#800080');
                            
                            return message.reply({ embeds: [phantomEmbed] });
                        }
                    }
                }
            }
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
            if (parts[1] === 'category') {
                const category = interaction.values[0];
                
                const fakeMessage = {
                    author: interaction.user,
                    reply: async (options) => {
                        await interaction.update(options);
                    }
                };
                
                await this.shop.showShop(fakeMessage, category, 1);
            }
        } else if (interaction.isButton()) {
            if (parts[1] === 'prev' || parts[1] === 'next') {
                const category = parts[2];
                const page = parseInt(parts[3]);
                
                const fakeMessage = {
                    author: interaction.user,
                    reply: async (options) => {
                        await interaction.update(options);
                    }
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

    // 6. Comando especial VIP
    async vipCommand(message) {
        const userId = message.author.id;
        const hasVipAccess = await this.shop.hasVipAccess(userId);
        
        if (!hasVipAccess) {
            await message.reply('❌ Necesitas ser **VIP** para usar este comando. Compra el **Pase VIP** en la tienda.');
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('👑 Comandos VIP Disponibles')
            .setColor('#FFD700')
            .setDescription('Comandos exclusivos para usuarios VIP:')
            .addFields(
                { name: '💎 >vipwork', value: 'Trabajo especial con mejores recompensas', inline: false },
                { name: '🎁 >vipbonus', value: 'Bonificación adicional cada 12 horas', inline: false },
                { name: '📊 >vipstats', value: 'Estadísticas detalladas de tu progreso', inline: false },
                { name: '⭐ >vipshop', value: 'Acceso a items exclusivos VIP', inline: false }
            )
            .setFooter({ text: '¡Gracias por ser VIP!' });
        
        await message.reply({ embeds: [embed] });
    }

    async processCommand(message) {
        await this.shop.cleanupExpiredTokens(message.author.id);
        await this.trades.cleanupExpiredTrades();
        await this.economy.missions.updateMissionProgress(message.author.id, 'commands_used');

        const args = message.content.trim().split(/ +/g);
        const command = args[0].toLowerCase();
        const betId = args[1];

        try {
            switch (command) {                    
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
                    await this.handleTop(message);
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
                    const eventType = args[1];
                    const duration = args[2] ? parseInt(args[2]) : null;
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

                case '>vip':
                    await this.vipCommand(message);
                    break;
                case '>vipstatus':
                    await this.shop.showVipStatus(message);
                    break;
                case '>giveitem':
                    await this.giveItemCommand(message, args);
                    break;
                case '>shopstats':
                    await this.shopStatsCommand(message);
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

/*    async shopHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('🛒 Comandos de la Tienda')
            .setColor('#9932CC')
            .addFields(
                { name: '🛒 >shop [categoría]', value: 'Ver la tienda y sus categorías', inline: false },
                { name: '💸 >buy <itemId> [cantidad]', value: 'Comprar un item de la tienda', inline: false },
                { name: '⚡ >use <itemId>', value: 'Usar un boost/cosmético', inline: false },
                { name: '🎒 >inventory [@usuario]', value: 'Ver tu inventario o el de otro usuario', inline: false },
                { name: '💰 >sell <itemId> [cantidad]', value: 'Vender items de tu inventario', inline: false }
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
                { name: '🏆 Logros', value: '`>achievements [@usuario]` - Ver logros\n`>allachievements` - Ver todos los logros\n`>detectachievements` - Detectar logros desbloqueados', inline: false },
/*                // Shop
                { name: '🛒 Tienda', value: '`>shop [categoría]`\n`>buy <item> [cantidad]`\n`>use <item>`\n`>inventory [@usuario]`\n`>sell <item> [cantidad]`\n`>shophelp`', inline: false },*/
                // Betting
                { name: '🎲 Apuestas', value: '`>bet [@usuario] <cantidad> <descripción>` - Crear apuesta\n`>mybets` - Ver tus apuestas activas\n`>betstats [@usuario]` - Ver estadísticas de apuestas', inline: false },
                //Economy
                { name: '📋 Economía', value: '`>balance [@usuario]` - Ver tu dinero y nivel (o el de otro usuario)\n`>daily` - Reclamar' + `(${this.economy.config.dailyAmount}±${this.economy.config.dailyVariation} ${this.economy.config.currencySymbol})` + 'diarios\n`>missions` - Mira tus misiones diaras y completalas para ganar dinero\n`>work [tipo]` - Trabajar para ganar dinero (delivery, programmer, doctor, criminal)\n`>level [@usuario]` - Ver información detallada de nivel\n`>pay @usuario <cantidad>` - Transferir dinero a otro usuario\n`>top [money/level]` - Ver los rankings del servidor\n`>robar @usuario` - Robar dinero de otro usuario', inline: false},
                // Minijuegos
                { name: '🎮 Minijuegos', value: '`>games` - Ver lista de minijuegos', inline: false },
                // Eventos
                { name: '🎉 Eventos', value: '`>events` - Ver eventos activos', inline: false },
            )
            .setFooter({ text: 'Usa los comandos para interactuar con el bot.' })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    }
}

module.exports = AllCommands;
