const { EmbedBuilder } = require('discord.js');

class BettingSystem {
    constructor(economySystem) {
        this.economy = economySystem;
        this.activeBets = new Map();
        this.config = {
            minBet: 100,
            maxBet: 100000,
            betTimeout: 300000,
            maxActiveBets: 3,
            houseFee: 0.05
        };
    }

    // Crear apuesta
    async createBet(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);

        if (args.length < 4) {
            await message.reply({ embeds: [this.getUsageEmbed()] });
            return;
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser || targetUser.id === userId || targetUser.bot) {
            await message.reply('❌ Debes mencionar a un usuario válido que no seas tú ni un bot.');
            return;
        }

        const amount = parseInt(args[2]);
        if (isNaN(amount) || amount < this.config.minBet || amount > this.config.maxBet) {
            await message.reply(`❌ La cantidad debe ser entre ${this.formatNumber(this.config.minBet)} y ${this.formatNumber(this.config.maxBet)} π-b$`);
            return;
        }

        if (user.balance < amount) {
            await message.reply(`❌ No tienes suficientes π-b Coins. Tu balance: ${this.formatNumber(user.balance)} π-b$`);
            return;
        }

        const targetUserData = await this.economy.getUser(targetUser.id);
        if (targetUserData.balance < amount) {
            await message.reply(`❌ ${targetUser.displayName} no tiene suficientes π-b Coins para esta apuesta.`);
            return;
        }

        const userActiveBets = Array.from(this.activeBets.values()).filter(bet =>
            bet.challenger === userId || bet.opponent === userId
        );
        if (userActiveBets.length >= this.config.maxActiveBets) {
            await message.reply(`❌ Ya tienes ${this.config.maxActiveBets} apuestas activas. Espera a que se resuelvan.`);
            return;
        }

        const description = args.slice(3).join(' ');
        if (description.length > 100) {
            await message.reply('❌ La descripción debe tener menos de 100 caracteres.');
            return;
        }

        const betId = `${userId}-${Date.now()}`;
        const betData = {
            id: betId,
            challenger: userId,
            opponent: targetUser.id,
            amount,
            description,
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: Date.now() + this.config.betTimeout,
            channelId: message.channel.id
        };

        this.activeBets.set(betId, betData);

        const embed = new EmbedBuilder()
            .setTitle('🎲 Nueva Apuesta Creada')
            .setDescription(`${message.author} desafía a ${targetUser} a una apuesta!`)
            .addFields(
                { name: '💰 Cantidad', value: `${this.formatNumber(amount)} π-b$`, inline: true },
                { name: '🎯 Descripción', value: description, inline: true },
                { name: '💸 Comisión', value: `${this.formatNumber(Math.floor(amount * 2 * this.config.houseFee))} π-b$`, inline: true },
                { name: '⏰ Expira en', value: `${this.config.betTimeout / 60000} minutos`, inline: false }
            )
            .setColor('#FFA500')
            .setFooter({ text: `ID: ${betId}` })
            .setTimestamp();

        await message.reply({
            content: `${targetUser}, tienes una nueva apuesta!`,
            embeds: [embed]
        });

        setTimeout(() => this.expireBet(betId), this.config.betTimeout);
    }

    // Aceptar apuesta
    async acceptBet(interaction, betId) {
        const bet = this.activeBets.get(betId);
        if (!bet) return interaction.reply({ content: '❌ Esta apuesta ya no existe.', ephemeral: true });
        if (interaction.user.id !== bet.opponent) return interaction.reply({ content: '❌ Esta apuesta no es para ti.', ephemeral: true });
        if (bet.status !== 'pending') return interaction.reply({ content: '❌ Esta apuesta ya fue procesada.', ephemeral: true });

        const challengerData = await this.economy.getUser(bet.challenger);
        const opponentData = await this.economy.getUser(bet.opponent);

        if (challengerData.balance < bet.amount) {
            this.activeBets.delete(betId);
            return interaction.reply({ content: '❌ El retador ya no tiene suficientes fondos.', ephemeral: true });
        }
        if (opponentData.balance < bet.amount) {
            return interaction.reply({ content: '❌ No tienes suficientes fondos para esta apuesta.', ephemeral: true });
        }

        await this.economy.removeMoney(bet.challenger, bet.amount, 'bet_escrow');
        await this.economy.removeMoney(bet.opponent, bet.amount, 'bet_escrow');

        bet.status = 'active';
        bet.acceptedAt = Date.now();

        const embed = new EmbedBuilder()
            .setTitle('✅ Apuesta Aceptada')
            .setDescription('La apuesta está ahora activa!')
            .addFields(
                { name: '⚔️ Retador', value: `<@${bet.challenger}>`, inline: true },
                { name: '🛡️ Oponente', value: `<@${bet.opponent}>`, inline: true },
                { name: '💰 Cantidad', value: `${this.formatNumber(bet.amount)} π-b$ cada uno`, inline: true },
                { name: '🎯 Descripción', value: bet.description, inline: false },
                { name: '📝 Estado', value: 'Esperando resultado...', inline: false }
            )
            .setColor('#00FF00')
            .setFooter({ text: `Usen !resolve ${betId} <ganador> para resolver` })
            .setTimestamp();

        await interaction.update({ embeds: [embed] });
    }

    // Rechazar apuesta
    async declineBet(interaction, betId) {
        const bet = this.activeBets.get(betId);
        if (!bet) return interaction.reply({ content: '❌ Esta apuesta ya no existe.', ephemeral: true });
        if (interaction.user.id !== bet.opponent) return interaction.reply({ content: '❌ Esta apuesta no es para ti.', ephemeral: true });

        this.activeBets.delete(betId);

        const embed = new EmbedBuilder()
            .setTitle('❌ Apuesta Rechazada')
            .setDescription(`<@${bet.opponent}> rechazó la apuesta de <@${bet.challenger}>`)
            .setColor('#FF0000')
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });
    }

    // Resolver apuesta
    async resolveBet(interaction, betId, winner) {
        const bet = this.activeBets.get(betId);
        if (!bet) return interaction.reply({ content: '❌ Esta apuesta ya no existe.', ephemeral: true });
        if (bet.status !== 'active') return interaction.reply({ content: '❌ Esta apuesta no está activa.', ephemeral: true });
        if (interaction.user.id !== bet.challenger && interaction.user.id !== bet.opponent) {
            return interaction.reply({ content: '❌ Solo los participantes pueden resolver esta apuesta.', ephemeral: true });
        }

        const totalPot = bet.amount * 2;
        const houseFee = Math.floor(totalPot * this.config.houseFee);
        const winnerAmount = totalPot - houseFee;
        const winnerId = winner === 'challenger' ? bet.challenger : bet.opponent;
        const loserId = winner === 'challenger' ? bet.opponent : bet.challenger;

        await this.economy.addMoney(winnerId, winnerAmount, 'bet_win');
        await this.updateBetStats(winnerId, loserId, bet.amount);

        bet.status = 'resolved';
        bet.winner = winnerId;
        bet.resolvedAt = Date.now();
        bet.resolvedBy = interaction.user.id;

        const embed = new EmbedBuilder()
            .setTitle('🏆 Apuesta Resuelta')
            .setDescription(`¡<@${winnerId}> ganó la apuesta!`)
            .addFields(
                { name: '🏆 Ganador', value: `<@${winnerId}>`, inline: true },
                { name: '💸 Perdedor', value: `<@${loserId}>`, inline: true },
                { name: '💰 Premio', value: `${this.formatNumber(winnerAmount)} π-b$`, inline: true },
                { name: '🏛️ Comisión', value: `${this.formatNumber(houseFee)} π-b$`, inline: true },
                { name: '🎯 Descripción', value: bet.description, inline: false }
            )
            .setColor('#FFD700')
            .setTimestamp();

        this.activeBets.delete(betId);

        await interaction.update({ embeds: [embed], components: [] });
    }

    // Cancelar apuesta activa
    async cancelBet(interaction, betId) {
        const bet = this.activeBets.get(betId);
        if (!bet) return interaction.reply({ content: '❌ Esta apuesta ya no existe.', ephemeral: true });
        if (bet.status !== 'active') return interaction.reply({ content: '❌ Esta apuesta no está activa.', ephemeral: true });
        if (interaction.user.id !== bet.challenger && interaction.user.id !== bet.opponent) {
            return interaction.reply({ content: '❌ Solo los participantes pueden cancelar esta apuesta.', ephemeral: true });
        }

        await this.economy.addMoney(bet.challenger, bet.amount, 'bet_refund');
        await this.economy.addMoney(bet.opponent, bet.amount, 'bet_refund');

        bet.status = 'cancelled';
        bet.cancelledAt = Date.now();
        bet.cancelledBy = interaction.user.id;

        const embed = new EmbedBuilder()
            .setTitle('🔄 Apuesta Cancelada')
            .setDescription('La apuesta fue cancelada por mutuo acuerdo')
            .addFields(
                { name: '💰 Fondos Devueltos', value: `${this.formatNumber(bet.amount)} π-b$ a cada participante`, inline: false }
            )
            .setColor('#808080')
            .setTimestamp();

        this.activeBets.delete(betId);

        await interaction.update({ embeds: [embed], components: [] });
    }

    // Expirar apuesta
    expireBet(betId) {
        const bet = this.activeBets.get(betId);
        if (!bet || bet.status !== 'pending') return;
        this.activeBets.delete(betId);
        // Aquí podrías notificar en el canal si tienes acceso al cliente
        console.log(`Apuesta ${betId} expiró`);
    }

    // Mostrar apuestas activas
    async showActiveBets(message) {
        const userBets = Array.from(this.activeBets.values()).filter(bet =>
            bet.challenger === message.author.id || bet.opponent === message.author.id
        );

        if (userBets.length === 0) {
            await message.reply('❌ No tienes apuestas activas.');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🎲 Tus Apuestas Activas')
            .setColor('#FFA500')
            .setTimestamp();

        for (const bet of userBets) {
            const isChallenger = bet.challenger === message.author.id;
            const opponent = isChallenger ? bet.opponent : bet.challenger;
            const role = isChallenger ? 'Retador' : 'Oponente';
            let statusText = bet.status === 'pending' ? '⏳ Esperando respuesta' : '🔴 Activa - Esperando resolución';

            embed.addFields({
                name: `${role} vs <@${opponent}>`,
                value: `**Cantidad:** ${this.formatNumber(bet.amount)} π-b$\n**Descripción:** ${bet.description}\n**Estado:** ${statusText}\n**ID:** \`${bet.id}\``,
                inline: false
            });
        }

        await message.reply({ embeds: [embed] });
    }

    // Mostrar estadísticas de apuestas
    async showBetStats(message, targetUser = null) {
        const userId = targetUser ? targetUser.id : message.author.id;
        const displayName = targetUser ? targetUser.displayName : message.author.displayName;
        const user = this.economy.getUser(userId);

        const stats = user.betStats || { wins: 0, losses: 0, totalWon: 0, totalLost: 0, netProfit: 0 };
        const totalBets = stats.wins + stats.losses;
        const winRate = totalBets > 0 ? ((stats.wins / totalBets) * 100).toFixed(1) : 0;

        const embed = new EmbedBuilder()
            .setTitle(`🎲 Estadísticas de Apuestas - ${displayName}`)
            .setColor(stats.netProfit >= 0 ? '#00FF00' : '#FF0000')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🏆 Victorias', value: stats.wins.toString(), inline: true },
                { name: '💸 Derrotas', value: stats.losses.toString(), inline: true },
                { name: '📊 Tasa de Victoria', value: `${winRate}%`, inline: true },
                { name: '💰 Total Ganado', value: `${this.formatNumber(stats.totalWon)} π-b$`, inline: true },
                { name: '💸 Total Perdido', value: `${this.formatNumber(stats.totalLost)} π-b$`, inline: true },
                { name: '📈 Ganancia Neta', value: `${stats.netProfit >= 0 ? '+' : ''}${this.formatNumber(stats.netProfit)} π-b$`, inline: true }
            )
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    // Actualizar estadísticas de apuestas
    async updateBetStats(winnerId, loserId, amount) {
        const winner = await this.economy.getUser(winnerId);
        const loser = await this.economy.getUser(loserId);

        if (!winner.betStats) winner.betStats = { wins: 0, losses: 0, totalWon: 0, totalLost: 0, netProfit: 0 };
        if (!loser.betStats) loser.betStats = { wins: 0, losses: 0, totalWon: 0, totalLost: 0, netProfit: 0 };

        winner.betStats.wins++;
        const winAmount = amount * 2 - Math.floor(amount * 2 * this.config.houseFee);
        winner.betStats.totalWon += winAmount;
        winner.betStats.netProfit += (winAmount - amount);

        loser.betStats.losses++;
        loser.betStats.totalLost += amount;
        loser.betStats.netProfit -= amount;

        this.economy.saveUsers();
    }

    // Utilidad: formatear números
    formatNumber(num) {
        return num.toLocaleString('es-ES');
    }

    // Utilidad: embed de uso
    getUsageEmbed() {
        return new EmbedBuilder()
            .setTitle('🎲 Sistema de Apuestas')
            .setDescription('Crea apuestas contra otros usuarios!')
            .addFields(
                { name: '📝 Uso', value: '`mon!bet @usuario <cantidad> <descripción>`', inline: false },
                { name: '💡 Ejemplo', value: '`mon!bet @usuario 1000 coinflip cara`', inline: false },
                { name: '💰 Límites', value: `Min: ${this.formatNumber(this.config.minBet)} π-b$\nMax: ${this.formatNumber(this.config.maxBet)} π-b$`, inline: false },
                { name: '📊 Comisión', value: `${this.config.houseFee * 100}% del total`, inline: false }
            )
            .setColor('#FF6B6B');
    }
}

module.exports = BettingSystem;