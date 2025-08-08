const { EmbedBuilder } = require('discord.js');
require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class BettingSystem {
    constructor(economySystem) {
        this.economy = economySystem;

        this.config = {
            minBet: 100,
            maxBet: 100000,
            betTimeout: 300000,
            maxActiveBets: 3,
            houseFee: 0.05
        };

        this.betsCollection = admin.firestore().collection('bets');
    }

/*    // Inicializar Firebase
    initializeFirebase() {
        try {
            // Verificar que las variables de entorno existan
            if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
                throw new Error('❌ Variables de entorno de Firebase no configuradas. Revisa tu archivo .env');
            }
    
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
    
            console.log('🔥 Firebase inicializado correctamente en bets');
            console.log(`📊 Proyecto: ${process.env.FIREBASE_PROJECT_ID}`);
        } catch (error) {
            console.error('❌ Error inicializando Firebase:', error);
            console.error('💡 Asegúrate de que tu archivo .env esté configurado correctamente');
        }
    }*/

    // Obtener o crear datos de una apuesta
    async getBet(betId) {
        try {
            const betDoc = await this.betsCollection.doc(betId).get();

            if (!betDoc.exists) {
                // Crear nueva apuesta
                const newBet = {
                    id: 0,
                    challenger: 0,
                    opponent: 0,
                    amount: 0,
                    description: "",
                    status: "",
                    createdAt: 0,
                    expiresAt: 0,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    channelId: 0
                };

                await this.betsCollection.doc(betId).set(newBet);
                console.log(`🎲 Nueva apuesta creada en Firebase: ${betId}`);
                return newBet;
            }

            return betDoc.data();
        } catch (error) {
            console.error('❌ Error obteniendo apuesta:', error);
            throw error;
        }
    }

    // Actualizar datos de apuesta
    async updateBet(betId, updateData) {
        try {
            const updateWithTimestamp = {
                ...updateData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await this.betsCollection.doc(betId).update(updateWithTimestamp);
            console.log(`💾 Apuesta ${betId} actualizada en Firebase`);
        } catch (error) {
            console.error('❌ Error actualizando apuesta:', error);
            throw error;
        }
    }

    async getAllBets() {
        try {
            const snapshot = await this.betsCollection.get();

            if (snapshot.empty) return {};

            const bets = {};
            snapshot.forEach(doc => {
                bets[doc.id] = doc.data();
            });

            return bets;
        } catch (error) {
            console.error('❌ Error obteniendo todas las apuestas:', error);
            return {};
        }
    }  

    // Eliminar una apuesta
    async deleteBet(betId) {
        try {
            await this.betsCollection.doc(betId).delete();
            console.log(`🗑️ Apuesta ${betId} eliminada de Firebase`);
        } catch (error) {
            console.error('❌ Error eliminando apuesta:', error);
            throw error;
        }
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

/*        const userActiveBets = await this.getBet(userId);
        if (userActiveBets.challenger.length >= this.config.maxActiveBets || userActiveBets.opponent.length >= this.config.maxActiveBets) {
            await message.reply(`❌ Ya tienes ${this.config.maxActiveBets} apuestas activas. Espera a que se resuelvan.`);
            return;
        }*/

        const description = args.slice(3).join(' ');
        if (description.length > 100) {
            await message.reply('❌ La descripción debe tener menos de 100 caracteres.');
            return;
        }

        const idForBet = userId + targetUser + Date.now();
        const baseId = userId.slice(9) + targetUser.id.slice(9);
        
        //Create The Bet
            await this.getBet(baseId);
        //Create The Bet

        const betData = {
            id: idForBet,
            challenger: userId,
            opponent: targetUser.id,
            amount: amount,
            description: description,
            status: "pending",
            createdAt: Date.now(),
            expiresAt: Date.now() + this.config.betTimeout,
            channelId: message.channel.id
        };

        this.updateBet(baseId, betData);

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
            .setFooter({ text: `ID: ${betData.id}` })
            .setTimestamp();

        await message.reply({
            content: `${targetUser}, tienes una nueva apuesta!`,
            embeds: [embed]
        });

        setTimeout(async () => await this.expireBet(baseId), this.config.betTimeout);
    }

    // Aceptar apuesta
    async acceptBet(message, targetUser) {
        const baseId = targetUser.id.slice(9) + message.author.id.slice(9);
        const bet = await this.getBet(baseId);
        if (!bet) return message.reply({ content: '❌ Esta apuesta ya no existe.', ephemeral: true });
        if (message.user.id !== bet.opponent) return message.reply({ content: '❌ Esta apuesta no es para ti.', ephemeral: true });
        if (bet.status !== 'pending') return message.reply({ content: '❌ Esta apuesta ya fue procesada.', ephemeral: true });

        const challengerData = await this.economy.getUser(bet.challenger);
        const opponentData = await this.economy.getUser(bet.opponent);

        if (challengerData.balance < bet.amount) {
            await this.deleteBet(betId);
            return message.reply({ content: '❌ El retador ya no tiene suficientes fondos.', ephemeral: true });
        }
        if (opponentData.balance < bet.amount) {
            return message.reply({ content: '❌ No tienes suficientes fondos para esta apuesta.', ephemeral: true });
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

        await message.update({ embeds: [embed] });
    }

    // Rechazar apuesta
    async declineBet(message, betId) {
        const bet = await this.getBet(betId);
        if (!bet) return message.reply({ content: '❌ Esta apuesta ya no existe.', ephemeral: true });
        if (message.user.id !== bet.opponent) return message.reply({ content: '❌ Esta apuesta no es para ti.', ephemeral: true });

        await this.deleteBet(betId);

        const embed = new EmbedBuilder()
            .setTitle('❌ Apuesta Rechazada')
            .setDescription(`<@${bet.opponent}> rechazó la apuesta de <@${bet.challenger}>`)
            .setColor('#FF0000')
            .setTimestamp();

        await message.update({ embeds: [embed], components: [] });
    }

    // Resolver apuesta
    async resolveBet(message, betId, winner) {
        const bet = await this.getBet(betId);
        if (!bet) return message.reply({ content: '❌ Esta apuesta ya no existe.', ephemeral: true });
        if (bet.status !== 'active') return message.reply({ content: '❌ Esta apuesta no está activa.', ephemeral: true });
        if (message.user.id !== bet.challenger && message.user.id !== bet.opponent) {
            return message.reply({ content: '❌ Solo los participantes pueden resolver esta apuesta.', ephemeral: true });
        }

        const totalPot = bet.amount * 2;
        const houseFee = Math.floor(totalPot * this.config.houseFee);
        const winnerAmount = totalPot - houseFee;
        const winnerId = winner === 'challenger' ? bet.challenger : bet.opponent;
        const loserId = winner === 'challenger' ? bet.opponent : bet.challenger;

        await this.economy.addMoney(winnerId, winnerAmount, 'bet_win');
        await this.updateBetStats(winnerId, loserId, bet.amount);

/*        bet.status = 'resolved';
        bet.winner = winnerId;
        bet.resolvedAt = Date.now();
        bet.resolvedBy = message.user.id;*/

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

        await this.deleteBet(betId);

        await message.update({ embeds: [embed], components: [] });
    }

    // Cancelar apuesta activa
    async cancelBet(message, betId) {
        const bet = await this.getBet(betId);
        if (!bet) return message.reply({ content: '❌ Esta apuesta ya no existe.', ephemeral: true });
        if (bet.status !== 'active') return message.reply({ content: '❌ Esta apuesta no está activa.', ephemeral: true });
        if (message.user.id !== bet.challenger && message.user.id !== bet.opponent) {
            return message.reply({ content: '❌ Solo los participantes pueden cancelar esta apuesta.', ephemeral: true });
        }

        await this.economy.addMoney(bet.challenger, bet.amount, 'bet_refund');
        await this.economy.addMoney(bet.opponent, bet.amount, 'bet_refund');

/*        bet.status = 'cancelled';
        bet.cancelledAt = Date.now();
        bet.cancelledBy = message.user.id;*/

        const embed = new EmbedBuilder()
            .setTitle('🔄 Apuesta Cancelada')
            .setDescription('La apuesta fue cancelada por mutuo acuerdo')
            .addFields(
                { name: '💰 Fondos Devueltos', value: `${this.formatNumber(bet.amount)} π-b$ a cada participante`, inline: false }
            )
            .setColor('#808080')
            .setTimestamp();

        await this.deleteBet(betId);

        await message.update({ embeds: [embed], components: [] });
    }

    // Expirar apuesta
    async expireBet(betId) {
        const bet = await this.getBet(betId);

        if (!bet || bet.status !== 'pending') return;
        await this.deleteBet(betId);

        console.log(`Apuesta ${betId} expiró`);
        await message.reply('❌ La apuesta ha expirado, vuelve a intentarlo mas tarde!.');
    }

    // Mostrar apuestas activas
    async showActiveBets(message) {
        const userBets = await this.getBet(message.author.id);

        if (!userBets || (userBets.challenger.length === 0 && userBets.opponent.length === 0)) {     
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