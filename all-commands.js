const { EmbedBuilder } = require('discord.js');

class AllCommands {
    constructor(economySystem, musicHandler/*, achievementsSystem, shopSystem, bettingSystem, eventsSystem*/) {
        this.economy = economySystem;
        this.musicBot = musicHandler;
/*        this.achievements = achievementsSystem;
        this.shop = shopSystem;
        this.betting = bettingSystem;
        this.events = eventsSystem;*/
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
        const result = await this.economy.transferMoney(message.author.id, targetUser.id, amount);
        
        if (!result.success) {
            if (result.reason === 'insufficient_funds') {
                const userBalance = await this.economy.getUser(message.author.id).balance;
                const embed = new EmbedBuilder()
                    .setTitle('❌ Fondos Insuficientes')
                    .setDescription(`No tienes suficientes π-b Coins para transferir.`)
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

    // Funciones para manejar comandos

    async handlePlay(message) {      
        const query = message.options.getString('cancion');
        
        // Unirse al canal de voz
        const joinResult = await this.musicBot.joinVoice(message);
        if (!joinResult.success) {
            return await message.editReply(joinResult.message);
        }
        
        // Añadir a la cola
        const queueResult = await this.musicBot.addToQueue(message, query);
        if (!queueResult.success) {
            return await message.editReply(queueResult.message);
        }
        
        // Si es la primera canción, reproducir inmediatamente
        const queue = this.musicBot.queues.get(message.guild.id);
        const isFirst = queue.length === 1;
        
        if (isFirst) {
            const playResult = await this.musicBot.play(message.guild.id);
            if (playResult.success) {
                const embed = this.musicBot.createSongEmbed(playResult.song, 'nowPlaying');
                await message.editReply({ embeds: [embed] });
            } else {
                await message.editReply('❌ Error al reproducir la canción.');
            }
        } else {
            const embed = this.musicBot.createSongEmbed(queueResult.song, 'added');
            embed.addFields({
                name: '📋 Posición en cola',
                value: `${queue.length}`,
                inline: true
            });
            await message.editReply({ embeds: [embed] });
        }
    }

    async handleSkip(message) {
        const result = this.musicBot.skip(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor(result.success ? '#FFA500' : '#FF0000')
            .setTitle(result.success ? '⏭️ Canción saltada' : '❌ Error')
            .setDescription(result.message);
        
        await message.reply({ embeds: [embed] });
    }

    async handlePause(message) {
        const result = this.musicBot.pause(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor(result.success ? '#FFA500' : '#FF0000')
            .setTitle(result.success ? '⏸️ Música pausada' : '❌ Error')
            .setDescription(result.message);
        
        await message.reply({ embeds: [embed] });
    }

    async handleResume(message) {
        const result = this.musicBot.resume(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor(result.success ? '#00FF00' : '#FF0000')
            .setTitle(result.success ? '▶️ Música reanudada' : '❌ Error')
            .setDescription(result.message);
        
        await message.reply({ embeds: [embed] });
    }

    async handleQueue(message) {
        const result = this.musicBot.showQueue(message.guild.id);
        
        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('📋 Cola de reproducción')
                .setDescription(result.message);
            
            return await message.reply({ embeds: [embed] });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle('📋 Cola de reproducción');
        
        if (result.nowPlaying) {
            embed.addFields({
                name: '🎶 Reproduciendo ahora',
                value: `**${result.nowPlaying.deezer.title}** - ${result.nowPlaying.deezer.artist}`,
                inline: false
            });
        }
        
        if (result.queue.length > 0) {
            const queueList = result.queue.map((song, index) => 
                `${index + 1}. **${song.deezer.title}** - ${song.deezer.artist}`
            ).join('\n');
            
            embed.addFields({
                name: '⏳ Siguiente(s)',
                value: queueList,
                inline: false
            });
            
            embed.setFooter({
                text: `Total: ${result.queue.length} canción(es) en cola`
            });
        }
        
        await message.reply({ embeds: [embed] });
    }

    async handleNowPlaying(message) {
        const nowPlaying = this.musicBot.nowPlaying.get(message.guild.id);
        
        if (!nowPlaying) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error')
                .setDescription('No hay música reproduciéndose.');
            
            return await message.reply({ embeds: [embed] });
        }
        
        const embed = this.musicBot.createSongEmbed(nowPlaying, 'nowPlaying');
        await message.reply({ embeds: [embed] });
    }

    async handleClear(message) {
        const result = this.musicBot.clearQueue(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🗑️ Cola limpiada')
            .setDescription(result.message);
        
        await message.reply({ embeds: [embed] });
    }

    async handleStop(message) {
        const result = this.musicBot.disconnect(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⏹️ Música detenida')
            .setDescription(result.message);
        
        await message.reply({ embeds: [embed] });
    }

    async handleSearch(message) {
        const query = message.options.getString('query');
        const results = await this.musicBot.searchDeezer(query, 5);
        
        if (results.length === 0) {
            return await message.editReply('❌ No se encontraron resultados.');
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF6B35')
            .setTitle('🔍 Resultados de búsqueda en Deezer')
            .setDescription(`Resultados para: **${query}**`);
        
        results.forEach((track, index) => {
            embed.addFields({
                name: `${index + 1}. ${track.title}`,
                value: `👨‍🎤 **Artista:** ${track.artist}\n💿 **Álbum:** ${track.album}\n⏱️ **Duración:** ${this.musicBot.formatDuration(track.duration)}`,
                inline: true
            });
        });
        
        embed.setFooter({
            text: 'Usa /play <nombre de canción> para reproducir una canción'
        });
        
        await message.editReply({ embeds: [embed] });
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
                .setDescription('Elige un trabajo para ganar π-b Coins')
                .setColor('#28a745');
            
            for (const [key, job] of Object.entries(jobs)) {
                const cooldownHours = job.cooldown / (60 * 60 * 1000);
                const cooldownText = cooldownHours >= 1 ? `${cooldownHours}h` : `${job.cooldown / (60 * 1000)}m`;
                
                const available = user.level >= job.levelRequirement ? '✅' : '🔒';
                const levelText = user.level >= job.levelRequirement ? '' : `\n*Requiere Nivel ${job.levelRequirement}*`;
                
                embed.addFields({
                    name: `${available} ${job.name}`,
                    value: `**Pago:** ${job.baseReward}±${job.variation} π-b$\n**Cooldown:** ${cooldownText}${levelText}${job.failChance ? `\n**Riesgo:** ${(job.failChance * 100)}% de fallar` : ''}`,
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
                    { name: '💸 Perdiste', value: `${this.formatNumber(result.penalty)} π-b$`, inline: true },
                    { name: '💰 Balance Actual', value: `${this.formatNumber(result.newBalance)} π-b$`, inline: true }
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
                { name: '💰 Ganaste', value: `+${this.formatNumber(result.amount)} π-b$`, inline: true },
                { name: '💳 Balance Total', value: `${this.formatNumber(result.newBalance)} π-b$`, inline: true }
            )
            .setColor('#28a745')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }    

    async processCommand(message) {
        if (message.author.bot) return;

        const args = message.content.trim().split(/ +/g);
        const command = args[0].toLowerCase();

        try {
            switch (command) {
                case 'mon!play':
                    await this.handlePlay(message);
                    break;
                case 'mon!skip':
                    await this.handleSkip(message);
                    break;
                case 'mon!pause':
                    await this.handlePause(message);
                    break;
                case 'mon!resume':
                    await this.handleResume(message);
                    break;
                case 'mon!queue':
                    await this.handleQueue(message);
                    break;
                case 'mon!nowplaying':
                    await this.handleNowPlaying(message);
                    break;
                case 'mon!clear':
                    await this.handleClear(message);
                    break;
                case 'mon!stop':
                    await this.handleStop(message);
                    break;
                case 'mon!search':
                    await this.handleSearch(message);
                    break;                
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
                
                // Help
                case 'mon!help':
                    await this.showHelp(message);
                    break;
                default:
                    // No es un comando de economía
                    break;
            }

/*            // Achievements
            if (command === 'mon!achievements' || command === 'mon!logros') {
                const achievementTarget = message.mentions.members?.first();
                await this.achievements.showUserAchievements(message, achievementTarget);
                return;
            }
            if (command === 'mon!allachievements' || command === 'mon!todoslogros') {
                await this.achievements.showAllAchievements(message);
                return;
            }
            if (command === 'mon!notifyachievements') {
                const achievementIds = args.slice(1);
                await this.achievements.notifyAchievements(message, achievementIds);
                return;
            }

            // Shop
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

            // Betting
            if (command === 'mon!bet' || command === 'mon!apuesta') {
                await this.betting.createBet(message, args);
                return;
            }
            if (command === 'mon!mybets' || command === 'mon!misapuestas') {
                await this.betting.showActiveBets(message);
                return;
            }
            if (command === 'mon!betstats' || command === 'mon!estadisticasapuestas') {
                const targetUser = message.mentions.members?.first();
                await this.betting.showBetStats(message, targetUser);
                return;
            }
            if (command === 'mon!resolve') {
                if (args.length < 3) {
                    await message.reply('❌ Uso: `mon!resolve <betId> <ganador: challenger|opponent>`');
                    return;
                }
                await message.reply('❌ Resolución manual por comando no implementada, usa los botones.');
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
/*                // Achievements
                { name: '🏆 Logros', value: '`mon!achievements [@usuario]` - Ver logros\n`mon!allachievements` - Ver todos los logros', inline: false },
                // Shop
                { name: '🛒 Tienda', value: '`mon!shop [categoría]`\n`mon!buy <item> [cantidad]`\n`mon!use <item>`\n`mon!inventory [@usuario]`\n`mon!sell <item> [cantidad]`\n`mon!shophelp`', inline: false },
                // Betting
                { name: '🎲 Apuestas', value: '`mon!bet [@usuario] <cantidad> <descripción>` - Crear apuesta\n`mon!mybets` - Ver tus apuestas activas\n`mon!betstats [@usuario]` - Ver estadísticas de apuestas', inline: false },*/
                //Economy
                { name: '📋 Economía', value: '`mon!balance [@usuario]` - Ver tu dinero y nivel (o el de otro usuario)\n`mon!daily` - Reclamar' + `(${this.economy.config.dailyAmount}±${this.economy.config.dailyVariation} ${this.economy.config.currencySymbol})` + 'diarios\n`mon!work [tipo]` - Trabajar para ganar dinero (delivery, programmer, doctor, criminal)\n`mon!level [@usuario]` - Ver información detallada de nivel\n`mon!pay @usuario <cantidad>` - Transferir dinero a otro usuario\n`mon!top [money/level]` - Ver los rankings del servidor', inline: false},
                // Minijuegos
                { name: '🎮 Minijuegos', value: '`mon!coinflip <cara/cruz> <cantidad>` - Juega cara o cruz\n`mon!dice <1-6/alto/bajo> <cantidad>` - Juega a los dados\n`mon!games` - Ver lista de minijuegos', inline: false },
/*                // Eventos
                { name: '🎉 Eventos', value: '`mon!events` - Ver eventos activos', inline: false },*/
                // Musica
                { name: '🎵 Música', value: '`mon!play <url>` - Reproducir música\n`mon!skip` - Saltar canción actual\n`mon!stop` - Detener reproducción\n`mon!pause` - Pausar reproducción\n`mon!resume` - Reanudar reproducción\n`mon!queue` - Ver cola de reproducción\n`mon!volume` - Ajustar volumen\n`mon!loop` - Repetir canción actual\n`mon!nowplaying` - Ver canción actual\n`mon!clear` - Limpiar cola de reproducción', inline: false }
            )
            .setFooter({ text: 'Usa los comandos para interactuar con el bot.' })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    }
}

module.exports = AllCommands;
