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
            betTimeout: 180000, // 3 minutos
            maxActiveBets: 3,
            houseFee: 0.05
        };

        this.betsCollection = admin.firestore().collection('bets');
    }

    // ✅ CORREGIDO: Solo obtener apuesta existente, no crear una vacía
    async getBet(betId) {
        try {
            const betDoc = await this.betsCollection.doc(betId).get();
            
            if (!betDoc.exists) {
                return null; // Retornar null si no existe
            }

            return betDoc.data();
        } catch (error) {
            console.error('❌ Error obteniendo apuesta:', error);
            return null;
        }
    }

    // ✅ NUEVO: Crear apuesta específicamente
    async createBetInDB(betId, betData) {
        try {
            const betWithTimestamp = {
                ...betData,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await this.betsCollection.doc(betId).set(betWithTimestamp);
            console.log(`🎲 Nueva apuesta creada en Firebase: ${betId}`);
            return betWithTimestamp;
        } catch (error) {
            console.error('❌ Error creando apuesta:', error);
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

    // ✅ CORREGIDO: Obtener apuestas activas de un usuario específico
    async getUserActiveBets(userId) {
        try {
            const userBets = [];
            
            // Buscar apuestas donde el usuario es challenger
            const challengerQuery = await this.betsCollection
                .where('challenger', '==', userId)
                .where('status', 'in', ['pending', 'active'])
                .get();
            
            challengerQuery.forEach(doc => {
                userBets.push({ id: doc.id, ...doc.data() });
            });

            // Buscar apuestas donde el usuario es opponent
            const opponentQuery = await this.betsCollection
                .where('opponent', '==', userId)
                .where('status', 'in', ['pending', 'active'])
                .get();
            
            opponentQuery.forEach(doc => {
                userBets.push({ id: doc.id, ...doc.data() });
            });

            return userBets;
        } catch (error) {
            console.error('❌ Error obteniendo apuestas del usuario:', error);
            return [];
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

    // ✅ CORREGIDO: Generar ID único para apuesta
    generateBetId(challengerId, opponentId) {
        // Ordenar IDs para que siempre sea el mismo ID sin importar quién inicie
        const sortedIds = [challengerId, opponentId].sort();
        return `${sortedIds[0].slice(-6)}_${sortedIds[1].slice(-6)}_${Date.now()}`;
    }

    // ✅ CORREGIDO: Crear apuesta
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

        // ✅ CORREGIDO: Verificar apuestas activas del usuario
        const userActiveBets = await this.getUserActiveBets(userId);
        if (userActiveBets.length >= this.config.maxActiveBets) {
            await message.reply(`❌ Ya tienes ${this.config.maxActiveBets} apuestas activas. Espera a que se resuelvan.`);
            return;
        }

        const description = args.slice(3).join(' ');
        if (description.length > 100) {
            await message.reply('❌ La descripción debe tener menos de 100 caracteres.');
            return;
        }

        // ✅ CORREGIDO: Generar ID único
        const betId = this.generateBetId(userId, targetUser.id);
        
        const betData = {
            id: betId,
            challenger: userId,
            opponent: targetUser.id,
            amount: amount,
            description: description,
            status: "pending",
            expiresAt: Date.now() + this.config.betTimeout,
            channelId: message.channel.id
        };

        // ✅ CORREGIDO: Crear la apuesta en la base de datos
        await this.createBetInDB(betId, betData);

        const embed = new EmbedBuilder()
            .setTitle('🎲 Nueva Apuesta Creada')
            .setDescription(`${message.author} desafía a ${targetUser} a una apuesta!`)
            .addFields(
                { name: '💰 Cantidad', value: `${this.formatNumber(amount)} π-b$`, inline: true },
                { name: '🎯 Descripción', value: description, inline: true },
                { name: '💸 Comisión', value: `${this.formatNumber(Math.floor(amount * 2 * this.config.houseFee))} π-b$`, inline: true },
                { name: '⏰ Expira en', value: `${this.config.betTimeout / 60000} minutos`, inline: false },
                { name: '✅ Aceptar', value: `\`>acceptbet @${message.author.username}\``, inline: true },
                { name: '❌ Rechazar', value: `\`>declinebet @${message.author.username}\``, inline: true }
            )
            .setColor('#FFA500')
            .setFooter({ text: `ID: ${betId}` })
            .setTimestamp();

        await message.reply({
            content: `${targetUser}, tienes una nueva apuesta!`,
            embeds: [embed]
        });

        // Al hacer una apuesta
        if (this.economy.missions) {
            await this.economy.missions.updateMissionProgress(userId, 'money_bet', betData.amount);
        }

        // ✅ CORREGIDO: Configurar expiración
        setTimeout(async () => {
            await this.expireBet(message, betId);
        }, this.config.betTimeout);
    }

    // ✅ CORREGIDO: Aceptar apuesta
    async acceptBet(message) {
        const challengerUser = message.mentions.users.first();
        const opponentId = message.author.id;

        if (!challengerUser) {
            await message.reply('❌ Debes mencionar al usuario que te retó. Ejemplo: `>acceptbet @usuario`');
            return;
        }
        
        if (challengerUser.id === message.author.id) {
            await message.reply('❌ No puedes aceptar tu propia apuesta.');
            return;
        }
        
        if (challengerUser.bot) {
            await message.reply('❌ Los bots no pueden hacer apuestas.');
            return;
        }
        
        // ✅ CORREGIDO: Buscar apuesta pendiente entre estos usuarios
        const pendingBets = await this.betsCollection
            .where('challenger', '==', challengerUser.id)
            .where('opponent', '==', opponentId)
            .where('status', '==', 'pending')
            .get();

        if (pendingBets.empty) {
            await message.reply('❌ No hay apuestas pendientes de este usuario hacia ti.');
            return;
        }

        // Tomar la primera apuesta pendiente
        const betDoc = pendingBets.docs[0];
        const bet = betDoc.data();
        const betId = betDoc.id;

        const challengerData = await this.economy.getUser(bet.challenger);
        const opponentData = await this.economy.getUser(bet.opponent);

        if (challengerData.balance < bet.amount) {
            await this.deleteBet(betId);
            return message.reply('❌ El retador ya no tiene suficientes fondos.');
        }
        if (opponentData.balance < bet.amount) {
            return message.reply('❌ No tienes suficientes fondos para esta apuesta.');
        }

        // Retirar dinero de ambos usuarios
        await this.economy.removeMoney(bet.challenger, bet.amount, 'bet_escrow');
        await this.economy.removeMoney(bet.opponent, bet.amount, 'bet_escrow');

        // Actualizar estado de la apuesta
        await this.updateBet(betId, {
            status: 'active',
            acceptedAt: Date.now()
        });

        const embed = new EmbedBuilder()
            .setTitle('✅ Apuesta Aceptada')
            .setDescription('La apuesta está ahora activa!')
            .addFields(
                { name: '⚔️ Retador', value: `<@${bet.challenger}>`, inline: true },
                { name: '🛡️ Oponente', value: `<@${bet.opponent}>`, inline: true },
                { name: '💰 Cantidad', value: `${this.formatNumber(bet.amount)} π-b$ cada uno`, inline: true },
                { name: '🎯 Descripción', value: bet.description, inline: false },
                { name: '📝 Resolución', value: `\`>resolvebet ${betId} challenger\` o \`>resolvebet ${betId} opponent\``, inline: false },
                { name: '🔄 Cancelar', value: `\`>cancelbet ${betId}\``, inline: false }
            )
            .setColor('#00FF00')
            .setFooter({ text: `ID: ${betId}` })
            .setTimestamp();

        await message.reply({ 
            content: `ID: ${betId}`,
            embeds: [embed],
        });
    }

    // ✅ CORREGIDO: Rechazar apuesta
    async declineBet(message) {
        const challengerUser = message.mentions.users.first();
        const opponentId = message.author.id;

        if (!challengerUser) {
            await message.reply('❌ Debes mencionar al usuario que te retó. Ejemplo: `>declinebet @usuario`');
            return;
        }
        
        // Buscar apuesta pendiente
        const pendingBets = await this.betsCollection
            .where('challenger', '==', challengerUser.id)
            .where('opponent', '==', opponentId)
            .where('status', '==', 'pending')
            .get();

        if (pendingBets.empty) {
            await message.reply('❌ No hay apuestas pendientes de este usuario hacia ti.');
            return;
        }

        const betDoc = pendingBets.docs[0];
        const bet = betDoc.data();
        const betId = betDoc.id;

        await this.deleteBet(betId);

        const embed = new EmbedBuilder()
            .setTitle('❌ Apuesta Rechazada')
            .setDescription(`<@${bet.opponent}> rechazó la apuesta de <@${bet.challenger}>`)
            .setColor('#FF0000')
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    // ✅ CORREGIDO: Resolver apuesta
    async resolveBet(message, betId, winner) {
        const bet = await this.getBet(betId);
        
        if (!bet) {
            return message.reply('❌ Esta apuesta no existe.');
        }
        
        if (bet.status !== 'active') {
            return message.reply('❌ Esta apuesta no está activa.');
        }
        
        if (message.author.id !== bet.challenger && message.author.id !== bet.opponent) {
            return message.reply('❌ Solo los participantes pueden resolver esta apuesta.');
        }

        if (winner !== 'challenger' && winner !== 'opponent') {
            return message.reply('❌ El ganador debe ser "challenger" o "opponent".');
        }

        const totalPot = bet.amount * 2;
        const houseFee = Math.floor(totalPot * this.config.houseFee);
        const winnerAmount = totalPot - houseFee;
        const winnerId = winner === 'challenger' ? bet.challenger : bet.opponent;
        const loserId = winner === 'challenger' ? bet.opponent : bet.challenger;

        // Dar premio al ganador
        await this.economy.addMoney(winnerId, winnerAmount, 'bet_win');
        
        // Actualizar estadísticas
        await this.updateBetStats(winnerId, loserId, bet.amount);

        // Si gana la apuesta
        if (this.economy.missions) {
            await this.economy.missions.updateMissionProgress(userId, 'bet_won');
        }

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
        await message.reply({ embeds: [embed] });
    }

    // ✅ CORREGIDO: Cancelar apuesta
    async cancelBet(message, betId) {
        const bet = await this.getBet(betId);

        if (!bet) {
            return message.reply('❌ Esta apuesta no existe.');
        }
        
        if (bet.status !== 'active') {
            return message.reply('❌ Esta apuesta no está activa.');
        }
        
        if (message.author.id !== bet.challenger && message.author.id !== bet.opponent) {
            return message.reply('❌ Solo los participantes pueden cancelar esta apuesta.');
        }

        // Devolver dinero a ambos participantes
        await this.economy.addMoney(bet.challenger, bet.amount, 'bet_refund');
        await this.economy.addMoney(bet.opponent, bet.amount, 'bet_refund');

        const embed = new EmbedBuilder()
            .setTitle('🔄 Apuesta Cancelada')
            .setDescription('La apuesta fue cancelada y los fondos devueltos')
            .addFields(
                { name: '💰 Fondos Devueltos', value: `${this.formatNumber(bet.amount)} π-b$ a cada participante`, inline: false }
            )
            .setColor('#808080')
            .setTimestamp();

        await this.deleteBet(betId);
        await message.reply({ embeds: [embed] });
    }

    // ✅ CORREGIDO: Expirar apuesta
    async expireBet(message, betId) {
        const bet = await this.getBet(betId);

        if (!bet || bet.status !== 'pending') return;
        
        await this.deleteBet(betId);
        await message.reply(`❌ Tu Apuesta Ha Expirado, vuelve a intentarlo mas tarde!`);
        console.log(`🕒 Apuesta ${betId} expiró`);
    }

    // ✅ CORREGIDO: Mostrar apuestas activas
    async showActiveBets(message) {
        const userBets = await this.getUserActiveBets(message.author.id);

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
            const opponentId = isChallenger ? bet.opponent : bet.challenger;
            const role = isChallenger ? 'Retador' : 'Oponente';
            let statusText = bet.status === 'pending' ? '⏳ Esperando respuesta' : '🔴 Activa - Esperando resolución';

            // ✅ OBTENER NOMBRE DEL USUARIO
            let opponentName = 'Usuario desconocido';
            try {
                const opponentUser = await message.client.users.fetch(opponentId);
                opponentName = opponentUser.displayName || opponentUser.username;
            } catch (error) {
                console.log(`No se pudo obtener información del usuario ${opponentId}`);
                opponentName = `<@${opponentId}>`; // Fallback a mención
            }

            embed.addFields({
                name: `${role} vs ${opponentName}`,
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
        const user = await this.economy.getUser(userId);

        const stats = user.betStats || { wins: 0, losses: 0, totalWon: 0, totalLost: 0, netProfit: 0 };
        const totalBets = stats.wins + stats.losses;
        const winRate = totalBets > 0 ? (((stats.wins || 0) / totalBets) * 100).toFixed(1) : 0;

        // Avatar
        const avatarUrl = targetUser ? targetUser.displayAvatarURL({ dynamic: true }) : message.author.displayAvatarURL({ dynamic: true });
        
        const embed = new EmbedBuilder()
            .setTitle(`🎲 Estadísticas de Apuestas - ${displayName}`)
            .setColor(stats.netProfit >= 0 ? '#00FF00' : '#FF0000')
            .setThumbnail(avatarUrl)
            .addFields(
                { name: '🏆 Victorias', value: (stats.wins.toString() || 0), inline: true },
                { name: '💸 Derrotas', value: (stats.losses.toString() || 0), inline: true },
                { name: '📊 Tasa de Victoria', value: `${winRate}%`, inline: true },
                { name: '💰 Total Ganado', value: `${this.formatNumber((stats.totalWon || 0))} π-b$`, inline: true },
                { name: '💸 Total Perdido', value: `${this.formatNumber((stats.totalLost || 0))} π-b$`, inline: true },
                { name: '📈 Ganancia Neta', value: `${stats.netProfit >= 0 ? '+' : ''}${this.formatNumber((stats.netProfit || 0))} π-b$`, inline: true }
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

        const winAmount = amount * 2 - Math.floor(amount * 2 * this.config.houseFee);

        const updateDataWinner = {
            'betStats.wins': (winner.betStats.wins || 0) + 1,
            'betStats.totalWon': (winner.betStats.totalWon || 0) + winAmount,
            'betStats.netProfit': (winner.betStats.netProfit || 0) + (winAmount - amount),

            'betStats.losses': (winner.betStats.losses || 0),
            'betStats.totalLost': (winner.betStats.totalLost || 0),
            'betStats.netProfit': (winner.betStats.netProfit || 0)
        }
        
        const updateDataLoser = {
            'betStats.losses': (loser.betStats.losses || 0) + 1,
            'betStats.totalLost': (loser.betStats.totalLost || 0) + amount,
            'betStats.netProfit': (loser.betStats.netProfit || 0) - amount,

            'betStats.wins': (loser.betStats.wins || 0),
            'betStats.totalWon': (loser.betStats.totalWon || 0),
            'betStats.netProfit': (loser.betStats.netProfit || 0)
        }

        await this.economy.updateUser(winnerId, updateDataWinner);
        await this.economy.updateUser(loserId, updateDataLoser);
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
                { name: '📝 Crear Apuesta', value: '`>bet @usuario <cantidad> <descripción>`', inline: false },
                { name: '✅ Aceptar Apuesta', value: '`>accept @usuario`', inline: false },
                { name: '❌ Rechazar Apuesta', value: '`>decline @usuario`', inline: false },
                { name: '🏆 Resolver Apuesta', value: '`>resolve <ID> challenger/opponent`', inline: false },
                { name: '🔄 Cancelar Apuesta', value: '`>cancel <ID>`', inline: false },
                { name: '📊 Ver Apuestas Activas', value: '`>bets`', inline: false },
                { name: '📈 Ver Estadísticas', value: '`>betstats [@usuario]`', inline: false },
                { name: '💰 Límites', value: `Min: ${this.formatNumber(this.config.minBet)} π-b$\nMax: ${this.formatNumber(this.config.maxBet)} π-b$`, inline: false },
                { name: '📊 Comisión', value: `${this.config.houseFee * 100}% del total`, inline: false }
            )
            .setColor('#FF6B6B');
    }
}

module.exports = BettingSystem;
