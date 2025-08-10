const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class MinigamesSystem {
    constructor(economySystem) {
        this.economy = economySystem;
        this.activeGames = new Map(); // Para manejar juegos en progreso
        
        // Configuración de minijuegos
        this.config = {
            coinflip: {
                minBet: 50,
                maxBet: 10000,
                cooldown: 15000, // 15 segundos entre juegos
                winMultiplier: 1.95 // Ganas 95% adicional (casa gana 5%)
            },
            dice: {
                minBet: 50,
                maxBet: 10000,
                cooldown: 30000, // 30 segundos entre juegos
                payouts: {
                    exact: 4.8, // Adivinar número exacto: x5.8
                    high: 1.9,  // 4-6: x1.9
                    low: 1.9    // 1-3: x1.9
                }
            },
            guess: {
                minBet: 100,
                maxBet: 5000,
                cooldown: 15000, // 10 segundos
                payouts: {
                    exact: 50,    // Número exacto: x50
                    close5: 10,   // ±5: x10
                    close10: 5,   // ±10: x5
                    close20: 2    // ±20: x2
                }
            },
            lottery: {
                minBet: 500,
                maxBet: 5000,
                cooldown: 1800000, // 30 minutos (30 * 60 * 1000)
                winMultiplier: 100, // Gana x100 si acierta
                minNumber: 1,
                maxNumber: 100
            },
            blackjack: {
                minBet: 100,
                maxBet: 15000,
                cooldown: 90000,
                blackjackMultiplier: 2.5,
                winMultiplier: 2
            },
            roulette: {
                minBet: 100,
                maxBet: 20000,
                cooldown: 45000, // 45 segundos entre juegos
                payouts: {
                    straight: 35,    // Número exacto: x35
                    red: 1.95,       // Rojo: x1.95
                    black: 1.95,     // Negro: x1.95
                    odd: 1.95,       // Impar: x1.95
                    even: 1.95,      // Par: x1.95
                    low: 1.95,       // 1-18: x1.95
                    high: 1.95,      // 19-36: x1.95
                    dozen1: 2.9,     // 1era docena (1-12): x2.9
                    dozen2: 2.9,     // 2da docena (13-24): x2.9
                    dozen3: 2.9,     // 3era docena (25-36): x2.9
                    column1: 2.9,    // 1era columna: x2.9
                    column2: 2.9,    // 2da columna: x2.9
                    column3: 2.9     // 3era columna: x2.9
                }
            },
            russianRoulette: {
                minBet: 200,
                maxBet: 5000,
                cooldown: 90000, // 5 minutos entre juegos
                minPlayers: 2,
                maxPlayers: 6,
                joinTime: 60000, // 1 minuto segundos para unirse
                turnTime: 20000, // 20 segundos por turno
                winnerMultiplier: 0.85 // El ganador se lleva 85% del pot total
            },
        };
        
        this.cooldowns = new Map(); // Para cooldowns por usuario
    }

    // Verificar cooldown de usuario
    checkCooldown(userId, gameType) {
        const key = `${userId}-${gameType}`;
        const lastPlayed = this.cooldowns.get(key) || 0;
        const cooldown = this.config[gameType].cooldown;
        const now = Date.now();
        
        if (now - lastPlayed < cooldown) {
            return {
                onCooldown: true,
                timeLeft: cooldown - (now - lastPlayed)
            };
        }
        
        return { onCooldown: false };
    }

    // Establecer cooldown
    setCooldown(userId, gameType) {
        const key = `${userId}-${gameType}`;
        this.cooldowns.set(key, Date.now());
    }

    // Formatear tiempo
    formatTime(ms) {
        return `${Math.ceil(ms / 1000)}s`;
    }

    // Formatear números
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
   
    async handleCoinflip(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
        
        // Al inicio de handleCoinflip y handleDice
/*        if (this.events) {
            this.events.applyEventModifiers(userId, 0, 'games');
        }*/

        // Verificar argumentos
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('🪙 Coinflip - Cara o Cruz')
                .setDescription('Apuesta a cara o cruz y duplica tu dinero!')
                .addFields(
                    { name: '📝 Uso', value: '`>coinflip <cara/cruz> <cantidad>`', inline: false },
                    { name: '💡 Ejemplos', value: '`>coinflip cara 500`\n`,>coinflip cruz 1000`', inline: false },
                    { name: '💰 Apuesta', value: `Min: ${this.formatNumber(this.config.coinflip.minBet)} π-b$\nMax: ${this.formatNumber(this.config.coinflip.maxBet)} π-b$`, inline: false },
                    { name: '🎯 Probabilidad', value: '50% de ganar\nGanancia: x1.95', inline: false }
                )
                .setColor('#FFD700');
            
            await message.reply({ embeds: [embed] });
            return;
        }

        const choice = args[1].toLowerCase();
        const betAmount = parseInt(args[2]);

        // Validar elección
        if (!['cara', 'cruz', 'heads', 'tails', 'h', 't', 'c'].includes(choice)) {
            await message.reply('❌ Elige **cara** o **cruz**');
            return;
        }

        // Normalizar elección
        const normalizedChoice = ['cara', 'heads', 'h', 'c'].includes(choice) ? 'cara' : 'cruz';

        // Validar cantidad
        if (isNaN(betAmount) || betAmount < this.config.coinflip.minBet || betAmount > this.config.coinflip.maxBet) {
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.coinflip.minBet)} y ${this.formatNumber(this.config.coinflip.maxBet)} π-b$`);
            return;
        }

        // Verificar fondos
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes π-b Coins. Tu balance: ${this.formatNumber(user.balance)} π-b$`);
            return;
        }

        // Verificar cooldown
        const cooldownCheck = this.checkCooldown(userId, 'coinflip');
        if (cooldownCheck.onCooldown) {
            await message.reply(`⏰ Debes esperar ${this.formatTime(cooldownCheck.timeLeft)} antes de jugar otra vez`);
            return;
        }

        // Realizar el juego
        const result = Math.random() < 0.5 ? 'cara' : 'cruz';
        const won = result === normalizedChoice;
        
        // Establecer cooldown
        this.setCooldown(userId, 'coinflip');

        const updateData = {
            'stats.gamesPlayed': (user.stats.gamesPlayed || 0) + 1
        }

        // Crear embed del resultado
        const embed = new EmbedBuilder()
            .setTitle('🪙 Coinflip - Resultado')
            .setColor(won ? '#00FF00' : '#FF0000')
            .setTimestamp();

        if (won) {
            const winAmount = Math.floor(betAmount * this.config.coinflip.winMultiplier);
            const profit = winAmount - betAmount;
            
            await this.economy.addMoney(userId, profit, 'coinflip_win');            
            await this.economy.updateUser(userId, updateData);

            // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_won');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
            }            
            
            embed.setDescription(`🎉 **¡GANASTE!**`)
                .addFields(
                    { name: '🪙 Resultado', value: result === 'cara' ? '🟡 Cara' : '⚪ Cruz', inline: true },
                    { name: '🎯 Tu Elección', value: normalizedChoice === 'cara' ? '🟡 Cara' : '⚪ Cruz', inline: true },
                    { name: '💰 Ganancia', value: `+${this.formatNumber(profit)} π-b$`, inline: true },
                    { name: '💸 Balance Antiguo', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance + profit)} π-b$`, inline: false }
                );
        } else {
            await this.economy.removeMoney(userId, betAmount, 'coinflip_loss');            
            await this.economy.updateUser(userId, updateData);
        
            // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_lost');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
            }

            embed.setDescription(`💸 **Perdiste...**`)
                .addFields(
                    { name: '🪙 Resultado', value: result === 'cara' ? '🟡 Cara' : '⚪ Cruz', inline: true },
                    { name: '🎯 Tu Elección', value: normalizedChoice === 'cara' ? '🟡 Cara' : '⚪ Cruz', inline: true },
                    { name: '💸 Perdiste', value: `${this.formatNumber(betAmount)} π-b$`, inline: true },
                    { name: '💸 Balance Antiguo', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance - betAmount)} π-b$`, inline: false }
                );
        }

        await message.reply({ embeds: [embed] });
    }

    async handleDice(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);

/*        if (this.events) {
            this.events.applyEventModifiers(userId, 0, 'games');
        }*/

        // Si no hay argumentos, mostrar ayuda
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('🎲 Dados - Juego de Predicción')
                .setDescription('Predice el resultado del dado y gana!')
                .addFields(
                    { name: '📝 Opciones de Apuesta', value: '• `1-6`: Número exacto (x5.8)\n• `alto`: 4, 5 o 6 (x1.9)\n• `bajo`: 1, 2 o 3 (x1.9)', inline: false },
                    { name: '💡 Ejemplos', value: '`>dice 6 500` - Apostar al 6\n`>dice alto 1000` - Apostar alto\n`>dice bajo 750` - Apostar bajo', inline: false },
                    { name: '💰 Límites', value: `Min: ${this.formatNumber(this.config.dice.minBet)} π-b$\nMax: ${this.formatNumber(this.config.dice.maxBet)} π-b$`, inline: false }
                )
                .setColor('#FF6B6B');
            
            await message.reply({ embeds: [embed] });
            return;
        }

        const prediction = args[1].toLowerCase();
        const betAmount = parseInt(args[2]);

        // Validar predicción
        const validPredictions = ['1', '2', '3', '4', '5', '6', 'alto', 'bajo', 'high', 'low'];
        if (!validPredictions.includes(prediction)) {
            await message.reply('❌ Predicción inválida. Usa: `1-6`, `alto`, o `bajo`');
            return;
        }

        // Validar cantidad
        if (isNaN(betAmount) || betAmount < this.config.dice.minBet || betAmount > this.config.dice.maxBet) {
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.dice.minBet)} y ${this.formatNumber(this.config.dice.maxBet)} π-b$`);
            return;
        }

        // Verificar fondos
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes π-b Coins. Tu balance: ${this.formatNumber(user.balance)} π-b$`);
            return;
        }

        // Verificar cooldown
        const cooldownCheck = this.checkCooldown(userId, 'dice');
        if (cooldownCheck.onCooldown) {
            await message.reply(`⏰ Debes esperar ${this.formatTime(cooldownCheck.timeLeft)} antes de jugar otra vez`);
            return;
        }

        // Tirar el dado
        const diceResult = Math.floor(Math.random() * 6) + 1;
        let won = false;
        let multiplier = 0;

        // Determinar si ganó y el multiplicador
        if (['1', '2', '3', '4', '5', '6'].includes(prediction)) {
            // Predicción de número exacto
            won = diceResult === parseInt(prediction);
            multiplier = this.config.dice.payouts.exact;
        } else if (['alto', 'high'].includes(prediction)) {
            // Predicción alto (4-6)
            won = diceResult >= 4;
            multiplier = this.config.dice.payouts.high;
        } else if (['bajo', 'low'].includes(prediction)) {
            // Predicción bajo (1-3)
            won = diceResult <= 3;
            multiplier = this.config.dice.payouts.low;
        }

        // Establecer cooldown
        this.setCooldown(userId, 'dice');
        
        const updateData = {
            'stats.gamesPlayed': (user.stats.gamesPlayed || 0) + 1
        }

        // Emojis del dado
        const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

        // Crear embed del resultado
        const embed = new EmbedBuilder()
            .setTitle('🎲 Dados - Resultado')
            .setColor(won ? '#00FF00' : '#FF0000')
            .addFields(
                { name: '🎲 Resultado', value: `${diceEmojis[diceResult]} **${diceResult}**`, inline: true },
                { name: '🎯 Tu Predicción', value: `**${prediction}**`, inline: true }
            )
            .setTimestamp();

        if (won) {
            const winAmount = Math.floor(betAmount * multiplier);
            const profit = winAmount - betAmount;
            
            await this.economy.addMoney(userId, profit, 'dice_win');
            await this.economy.updateUser(userId, updateData);

            // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_won');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
            }
            
            embed.setDescription(`🎉 **¡GANASTE!**`)
                .addFields(
                    { name: '💰 Multiplicador', value: `x${multiplier}`, inline: true },
                    { name: '💰 Ganancia', value: `+${this.formatNumber(profit)} π-b$`, inline: false },
                    { name: '💸 Balance Antiguo', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance + profit)} π-b$`, inline: false }
                );
        } else {
            await this.economy.removeMoney(userId, betAmount, 'dice_loss');
            await this.economy.updateUser(userId, updateData);
            
            // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_lost');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
            }

            embed.setDescription(`💸 **Perdiste...**`)
                .addFields(
                    { name: '💰 Dinero Apostado', value: `${this.formatNumber(betAmount)} π-b$`, inline: false },
                    { name: '💸 Balance Antiguo', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance - betAmount)} π-b$`, inline: false },
                );
        }

        await message.reply({ embeds: [embed] });
    }

    // Método para manejar la lotería (agregar a la clase MinigamesSystem)
    async handleLottery(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
    
        // Si no hay argumentos suficientes, mostrar ayuda
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('🎰 Lotería - Juego de la Suerte')
                .setDescription('¡Predice el número ganador y multiplica tu dinero x100!')
                .addFields(
                    { name: '📝 Uso', value: '`>lottery <número> <cantidad>`', inline: false },
                    { name: '💡 Ejemplos', value: '`>lottery 50 1000`\n`>lottery 25 2500`', inline: false },
                    { name: '🎯 Rango de Números', value: `${this.config.lottery.minNumber} - ${this.config.lottery.maxNumber}`, inline: true },
                    { name: '💰 Apuesta', value: `Min: ${this.formatNumber(this.config.lottery.minBet)} π-b$\nMax: ${this.formatNumber(this.config.lottery.maxBet)} π-b$`, inline: true },
                    { name: '🏆 Ganancia', value: `x${this.config.lottery.winMultiplier} si aciertas\n(Probabilidad: 1%)`, inline: true },
                    { name: '⏰ Cooldown', value: '30 minutos', inline: false }
                )
                .setColor('#FF1493')
                .setFooter({ text: '¡Un juego de pura suerte! ¿Te sientes con suerte?' });
            
            await message.reply({ embeds: [embed] });
            return;
        }
    
        const predictedNumber = parseInt(args[1]);
        const betAmount = parseInt(args[2]);
    
        // Validar número predicho
        if (isNaN(predictedNumber) || predictedNumber < this.config.lottery.minNumber || predictedNumber > this.config.lottery.maxNumber) {
            await message.reply(`❌ El número debe ser entre ${this.config.lottery.minNumber} y ${this.config.lottery.maxNumber}`);
            return;
        }
    
        // Validar cantidad de apuesta
        if (isNaN(betAmount) || betAmount < this.config.lottery.minBet || betAmount > this.config.lottery.maxBet) {
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.lottery.minBet)} y ${this.formatNumber(this.config.lottery.maxBet)} π-b$`);
            return;
        }
    
        // Verificar fondos
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes π-b Coins. Tu balance: ${this.formatNumber(user.balance)} π-b$`);
            return;
        }
    
        // Verificar cooldown
        const cooldownCheck = this.checkCooldown(userId, 'lottery');
        if (cooldownCheck.onCooldown) {
            const timeLeft = Math.ceil(cooldownCheck.timeLeft / 60000); // Convertir a minutos
            await message.reply(`⏰ Debes esperar ${timeLeft} minutos antes de jugar la lotería otra vez`);
            return;
        }
    
        // Generar número ganador
        const winningNumber = Math.floor(Math.random() * this.config.lottery.maxNumber) + this.config.lottery.minNumber;
        const won = winningNumber === predictedNumber;
        
        // Establecer cooldown
        this.setCooldown(userId, 'lottery');
        
        const updateData = {
            'stats.gamesPlayed': (user.stats.gamesPlayed || 0) + 1
        };
    
        // Crear embed del resultado con animación
        const loadingEmbed = new EmbedBuilder()
            .setTitle('🎰 Lotería - Sorteando...')
            .setDescription('🎲 **Generando número ganador...**\n\n🔄 Espera un momento...')
            .addFields(
                { name: '🎯 Tu Número', value: `**${predictedNumber}**`, inline: true },
                { name: '💰 Apuesta', value: `${this.formatNumber(betAmount)} π-b$`, inline: true }
            )
            .setColor('#FFD700');
    
        const reply = await message.reply({ embeds: [loadingEmbed] });
    
        // Simular suspense con un delay
        await new Promise(resolve => setTimeout(resolve, 3000));
    
        // Crear embed del resultado final
        const resultEmbed = new EmbedBuilder()
            .setTitle('🎰 Lotería - Resultado')
            .setColor(won ? '#00FF00' : '#FF0000')
            .addFields(
                { name: '🎯 Tu Número', value: `**${predictedNumber}**`, inline: true },
                { name: '🏆 Número Ganador', value: `**${winningNumber}**`, inline: true },
                { name: '💰 Apuesta', value: `${this.formatNumber(betAmount)} π-b$`, inline: true }
            )
            .setTimestamp();
    
        if (won) {
            const winAmount = betAmount * this.config.lottery.winMultiplier;
            const profit = winAmount - betAmount;
            
            await this.economy.addMoney(userId, profit, 'lottery_win');     
            // AGREGAR ESTAS LÍNEAS:
            const updateDataLottery = {
                'stats.lotteryWins': (user.stats.lotteryWins || 0) + 1  // ← NUEVA LÍNEA
            };       
            await this.economy.updateUser(userId, updateData);

            // *** ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_won');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
            }
            
            resultEmbed.setDescription(`🎉 **¡JACKPOT! ¡GANASTE LA LOTERÍA!** 🎉`)
                .addFields(
                    { name: '🎊 ¡Increíble!', value: `¡Acertaste el número exacto!`, inline: false },
                    { name: '💎 Multiplicador', value: `x${this.config.lottery.winMultiplier}`, inline: true },
                    { name: '🤑 Ganancia Total', value: `+${this.formatNumber(profit)} π-b$`, inline: true },
                    { name: '💸 Balance Anterior', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance + profit)} π-b$ 🚀`, inline: false }
                );
        } else {
            await this.economy.removeMoney(userId, betAmount, 'lottery_loss');
            await this.economy.updateUser(userId, updateData);

            // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_lost');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
            }
            
            const difference = Math.abs(winningNumber - predictedNumber);
            let encouragement = '';
            
            if (difference === 1) {
                encouragement = '😱 ¡Por solo 1 número! ¡Tan cerca!';
            } else if (difference <= 5) {
                encouragement = '😔 ¡Muy cerca! Solo te faltaron unos números';
            } else if (difference <= 10) {
                encouragement = '🤔 No estuvo mal, ¡sigue intentando!';
            } else {
                encouragement = '🎯 ¡La próxima será tu momento de suerte!';
            }
            
            resultEmbed.setDescription(`💸 **No ganaste esta vez...** ${encouragement}`)
                .addFields(
                    { name: '📊 Diferencia', value: `${difference} números`, inline: true },
                    { name: '💸 Perdiste', value: `${this.formatNumber(betAmount)} π-b$`, inline: true },
                    { name: '💸 Balance Anterior', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance - betAmount)} π-b$`, inline: false },
                    { name: '💡 Consejo', value: 'La lotería es pura suerte. ¡Cada número tiene la misma probabilidad!', inline: false }
                );
        }
    
        await reply.edit({ embeds: [resultEmbed] });
    }

    // Agregar estos métodos a tu clase MinigamesSystem
    
    async handleBlackjack(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
    
        // Si no hay argumentos suficientes, mostrar ayuda
        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setTitle('♠️ Blackjack - Vence al Dealer')
                .setDescription('¡Llega lo más cerca posible a 21 sin pasarte!')
                .addFields(
                    { name: '📝 Uso', value: '`>blackjack <cantidad>`', inline: false },
                    { name: '💡 Ejemplos', value: '`>blackjack 500`\n`>blackjack 2000`', inline: false },
                    { name: '💰 Apuesta', value: `Min: ${this.formatNumber(this.config.blackjack.minBet)} π-b$\nMax: ${this.formatNumber(this.config.blackjack.maxBet)} π-b$`, inline: false },
                    { name: '🎯 Reglas', value: '• Llega a 21 o cerca sin pasarte\n• As vale 1 u 11\n• Figuras valen 10\n• Blackjack natural: x2.5\n• Victoria normal: x2', inline: false },
                    { name: '🎮 Controles', value: '🎯 **Hit** - Pedir carta\n🛑 **Stand** - Plantarse\n🔄 **Double** - Doblar apuesta', inline: false }
                )
                .setColor('#000000')
                .setFooter({ text: 'Cooldown: 3 minutos' });
            
            await message.reply({ embeds: [embed] });
            return;
        }
    
        const betAmount = parseInt(args[1]);
    
        // Validar cantidad de apuesta
        if (isNaN(betAmount) || betAmount < this.config.blackjack.minBet || betAmount > this.config.blackjack.maxBet) {
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.blackjack.minBet)} y ${this.formatNumber(this.config.blackjack.maxBet)} π-b$`);
            return;
        }
    
        // Verificar fondos
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes π-b Coins. Tu balance: ${this.formatNumber(user.balance)} π-b$`);
            return;
        }
    
        // Verificar cooldown
        const cooldownCheck = this.checkCooldown(userId, 'blackjack');
        if (cooldownCheck.onCooldown) {
            const timeLeft = Math.ceil(cooldownCheck.timeLeft / 60000); // Convertir a minutos
            await message.reply(`⏰ Debes esperar ${timeLeft} minutos antes de jugar otra vez`);
            return;
        }
    
        // Verificar si ya hay un juego activo
        if (this.activeGames.has(`blackjack_${userId}`)) {
            await message.reply('❌ Ya tienes un juego de Blackjack activo. Termínalo primero.');
            return;
        }
    
        // Crear nuevo juego
        await this.startBlackjackGame(message, userId, betAmount);
    }
    
    async startBlackjackGame(message, userId, betAmount) {
        // Crear mazo y repartir cartas
        const deck = this.createDeck();
        const playerHand = [this.drawCard(deck), this.drawCard(deck)];
        const dealerHand = [this.drawCard(deck), this.drawCard(deck)];
    
        const gameState = {
            userId,
            betAmount,
            deck,
            playerHand,
            dealerHand,
            doubled: false,
            finished: false
        };
    
        this.activeGames.set(`blackjack_${userId}`, gameState);
    
        // Verificar Blackjack natural
        const playerValue = this.calculateHandValue(playerHand);
        const dealerValue = this.calculateHandValue(dealerHand);
    
        if (playerValue === 21) {
            if (dealerValue === 21) {
                await this.finishBlackjack(message, gameState, 'push');
            } else {
                await this.finishBlackjack(message, gameState, 'blackjack');
            }
            return;
        }
    
        // Mostrar juego con botones
        await this.showBlackjackState(message, gameState);
    }
    
    async showBlackjackState(message, gameState) {
        const { playerHand, dealerHand, betAmount, doubled } = gameState;
        const playerValue = this.calculateHandValue(playerHand);
    
        const embed = new EmbedBuilder()
            .setTitle('♠️ Blackjack - En Juego')
            .setColor('#FFD700')
            .addFields(
                { 
                    name: '🎴 Dealer', 
                    value: `${this.formatHand(dealerHand, true)}\nValor: ?`, 
                    inline: false 
                },
                { 
                    name: '👤 Tu Mano', 
                    value: `${this.formatHand(playerHand)}\nValor: **${playerValue}**`, 
                    inline: false 
                },
                { 
                    name: '💰 Apuesta', 
                    value: `${this.formatNumber(doubled ? betAmount * 2 : betAmount)} π-b$`, 
                    inline: true 
                }
            )
            .setTimestamp();
    
        // Verificar si se pasó
        if (playerValue > 21) {
            await this.finishBlackjack(message, gameState, 'bust');
            return;
        }
    
        // Crear botones
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`bj_hit_${gameState.userId}`)
                    .setLabel('🎯 Hit')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`bj_stand_${gameState.userId}`)
                    .setLabel('🛑 Stand')
                    .setStyle(ButtonStyle.Secondary)
            );
    
        // Botón doblar si es posible
        const user = await this.economy.getUser(gameState.userId);
        if (playerHand.length === 2 && !doubled && user.balance >= betAmount) {
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`bj_double_${gameState.userId}`)
                    .setLabel('🔄 Double')
                    .setStyle(ButtonStyle.Success)
            );
        }
    
        const reply = await message.reply({ embeds: [embed], components: [buttons] });
        gameState.messageId = reply.id;
        gameState.channelId = reply.channel.id;
    
        // Timeout automático
        setTimeout(() => {
            if (this.activeGames.has(`blackjack_${gameState.userId}`)) {
                this.handleBlackjackAction(null, gameState.userId, 'stand');
            }
        }, 60000);
    }
    
    async handleBlackjackAction(interaction, userId, action) {
        const gameState = this.activeGames.get(`blackjack_${userId}`);
        if (!gameState || gameState.finished) {
            if (interaction) {
                await interaction.reply({ content: '❌ Este juego ya terminó.', ephemeral: true });
            }
            return;
        }
    
        if (interaction) {
            await interaction.deferUpdate();
        }
    
        switch (action) {
            case 'hit':
                await this.blackjackHit(interaction, gameState);
                break;
            case 'stand':
                await this.blackjackStand(interaction, gameState);
                break;
            case 'double':
                await this.blackjackDouble(interaction, gameState);
                break;
        }
    }
    
    async blackjackHit(interaction, gameState) {
        const newCard = this.drawCard(gameState.deck);
        gameState.playerHand.push(newCard);
        
        const playerValue = this.calculateHandValue(gameState.playerHand);
        
        if (playerValue > 21) {
            await this.finishBlackjack(interaction, gameState, 'bust');
        } else if (playerValue === 21) {
            await this.blackjackStand(interaction, gameState);
        } else {
            await this.updateBlackjackMessage(interaction, gameState);
        }
    }
    
    async blackjackStand(interaction, gameState) {
        gameState.finished = true;
        
        // Dealer juega
        while (this.calculateHandValue(gameState.dealerHand) < 17) {
            gameState.dealerHand.push(this.drawCard(gameState.deck));
        }
        
        const dealerValue = this.calculateHandValue(gameState.dealerHand);
        const playerValue = this.calculateHandValue(gameState.playerHand);
        
        let result;
        if (dealerValue > 21) {
            result = 'dealer_bust';
        } else if (playerValue > dealerValue) {
            result = 'win';
        } else if (playerValue < dealerValue) {
            result = 'lose';
        } else {
            result = 'push';
        }
        
        await this.finishBlackjack(interaction, gameState, result);
    }
    
    async blackjackDouble(interaction, gameState) {
        const user = await this.economy.getUser(gameState.userId);
        
        if (user.balance < gameState.betAmount) {
            if (interaction) {
                await interaction.followUp({ content: '❌ No tienes suficiente dinero para doblar.', ephemeral: true });
            }
            return;
        }
        
        gameState.doubled = true;
        gameState.playerHand.push(this.drawCard(gameState.deck));
        
        const playerValue = this.calculateHandValue(gameState.playerHand);
        
        if (playerValue > 21) {
            await this.finishBlackjack(interaction, gameState, 'bust');
        } else {
            await this.blackjackStand(interaction, gameState);
        }
    }
    
    async updateBlackjackMessage(interaction, gameState) {
        const { playerHand, dealerHand, betAmount, doubled } = gameState;
        const playerValue = this.calculateHandValue(playerHand);
    
        const embed = new EmbedBuilder()
            .setTitle('♠️ Blackjack - En Juego')
            .setColor('#FFD700')
            .addFields(
                { 
                    name: '🎴 Dealer', 
                    value: `${this.formatHand(dealerHand, true)}\nValor: ?`, 
                    inline: false 
                },
                { 
                    name: '👤 Tu Mano', 
                    value: `${this.formatHand(playerHand)}\nValor: **${playerValue}**`, 
                    inline: false 
                },
                { 
                    name: '💰 Apuesta', 
                    value: `${this.formatNumber(doubled ? betAmount * 2 : betAmount)} π-b$`, 
                    inline: true 
                }
            )
            .setTimestamp();
    
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`bj_hit_${gameState.userId}`)
                    .setLabel('🎯 Hit')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`bj_stand_${gameState.userId}`)
                    .setLabel('🛑 Stand')
                    .setStyle(ButtonStyle.Secondary)
            );
    
        if (interaction && interaction.editReply) {
            await interaction.editReply({ embeds: [embed], components: [buttons] });
        }
    }
    
    async finishBlackjack(messageOrInteraction, gameState, result) {
        gameState.finished = true;
        this.activeGames.delete(`blackjack_${gameState.userId}`);
        
        const { userId, betAmount, playerHand, dealerHand, doubled } = gameState;
        const user = await this.economy.getUser(userId);
        
        const finalBet = doubled ? betAmount * 2 : betAmount;
        const playerValue = this.calculateHandValue(playerHand);
        const dealerValue = this.calculateHandValue(dealerHand);
        
        this.setCooldown(userId, 'blackjack');
        
        const updateData = {
            'stats.gamesPlayed': (user.stats.gamesPlayed || 0) + 1
        };
        
        let profit = 0;
        let resultText = '';
        let color = '#FF0000';
        
        switch (result) {
            case 'blackjack':
                const blackjackWin = Math.floor(betAmount * this.config.blackjack.blackjackMultiplier);
                profit = blackjackWin - betAmount;
                resultText = '🎉 **¡BLACKJACK NATURAL!**';
                color = '#00FF00';
                await this.economy.addMoney(userId, profit, 'blackjack_win');

                // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
                if (this.achievements) {
                    await this.achievements.updateStats(userId, 'game_played');
                    await this.achievements.updateStats(userId, 'game_won');
                    await this.achievements.updateStats(userId, 'money_bet', finalBet);
                }
                break;
            case 'win':
            case 'dealer_bust':
                const normalWin = finalBet * this.config.blackjack.winMultiplier;
                profit = normalWin - finalBet;
                resultText = result === 'dealer_bust' ? '🎉 **¡DEALER SE PASÓ!**' : '🎉 **¡GANASTE!**';
                color = '#00FF00';
                await this.economy.addMoney(userId, profit, 'blackjack_win');

                // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
                if (this.achievements) {
                    await this.achievements.updateStats(userId, 'game_played');
                    await this.achievements.updateStats(userId, 'game_won');
                    await this.achievements.updateStats(userId, 'money_bet', finalBet);
                }
                break;
            case 'push':
                resultText = '🤝 **¡EMPATE!**';
                color = '#FFD700';

                // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
                if (this.achievements) {
                    await this.achievements.updateStats(userId, 'game_played');
                    await this.achievements.updateStats(userId, 'money_bet', finalBet);
                }
                break;
            case 'bust':
                resultText = '💥 **¡TE PASASTE!**';
                profit = -finalBet;
                await this.economy.removeMoney(userId, finalBet, 'blackjack_loss');

                // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
                if (this.achievements) {
                    await this.achievements.updateStats(userId, 'game_played');
                    await this.achievements.updateStats(userId, 'game_lost');
                    await this.achievements.updateStats(userId, 'money_bet', finalBet);
                }
                break;
            case 'lose':
                resultText = '💸 **Perdiste...**';
                profit = -finalBet;
                await this.economy.removeMoney(userId, finalBet, 'blackjack_loss');

                // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
                if (this.achievements) {
                    await this.achievements.updateStats(userId, 'game_played');
                    await this.achievements.updateStats(userId, 'game_lost');
                    await this.achievements.updateStats(userId, 'money_bet', finalBet);
                }
                break;
        }
        
        await this.economy.updateUser(userId, updateData);
        
        const embed = new EmbedBuilder()
            .setTitle('♠️ Blackjack - Resultado')
            .setDescription(resultText)
            .setColor(color)
            .addFields(
                { 
                    name: '🎴 Dealer', 
                    value: `${this.formatHand(dealerHand)}\nValor: **${dealerValue}**`, 
                    inline: true 
                },
                { 
                    name: '👤 Tu Mano', 
                    value: `${this.formatHand(playerHand)}\nValor: **${playerValue}**`, 
                    inline: true 
                },
                { 
                    name: '💰 Apuesta', 
                    value: `${this.formatNumber(finalBet)} π-b$`, 
                    inline: true 
                }
            );
    
        if (profit > 0) {
            embed.addFields(
                { name: '💰 Ganancia', value: `+${this.formatNumber(profit)} π-b$`, inline: true },
                { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance + profit)} π-b$`, inline: true }
            );
        } else if (profit < 0) {
            embed.addFields(
                { name: '💸 Perdiste', value: `${this.formatNumber(Math.abs(profit))} π-b$`, inline: true },
                { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance + profit)} π-b$`, inline: true }
            );
        } else {
            embed.addFields(
                { name: '💳 Balance', value: `${this.formatNumber(user.balance)} π-b$ (Sin cambios)`, inline: true }
            );
        }
        
        if (doubled) {
            embed.addFields({ name: '🔄 Especial', value: 'Apuesta doblada', inline: true });
        }
    
        embed.setTimestamp();
    
        // Enviar resultado
        if (messageOrInteraction && messageOrInteraction.editReply) {
            await messageOrInteraction.editReply({ embeds: [embed], components: [] });
        } else if (messageOrInteraction && messageOrInteraction.reply) {
            await messageOrInteraction.reply({ embeds: [embed] });
        }
    }
    
    // Métodos auxiliares
    createDeck() {
        const suits = ['♠️', '♥️', '♦️', '♣️'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];
    
        for (const suit of suits) {
            for (const rank of ranks) {
                deck.push({ suit, rank });
            }
        }
    
        // Mezclar
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    
        return deck;
    }
    
    drawCard(deck) {
        return deck.pop();
    }
    
    calculateHandValue(hand) {
        let value = 0;
        let aces = 0;
    
        for (const card of hand) {
            if (card.rank === 'A') {
                aces++;
                value += 11;
            } else if (['J', 'Q', 'K'].includes(card.rank)) {
                value += 10;
            } else {
                value += parseInt(card.rank);
            }
        }
    
        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }
    
        return value;
    }
    
    formatHand(hand, hideFirst = false) {
        if (hideFirst) {
            return `🎴 ${hand.slice(1).map(card => `${card.rank}${card.suit}`).join(' ')}`;
        }
        return hand.map(card => `${card.rank}${card.suit}`).join(' ');
    }
    
    // Manejador de botones (agregar a tu sistema principal)
    async handleBlackjackButtons(interaction) {
        if (!interaction.customId.startsWith('bj_')) return;
    
        const [, action, userId] = interaction.customId.split('_');
        
        if (interaction.user.id !== userId) {
            await interaction.reply({ content: '❌ Este no es tu juego.', ephemeral: true });
            return;
        }
    
        await this.handleBlackjackAction(interaction, userId, action);
    }    

    // Método principal para manejar la ruleta
    async handleRoulette(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
    
        // Si no hay argumentos suficientes, mostrar ayuda
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('🎰 Ruleta - Casino Européo')
                .setDescription('¡Apuesta en la ruleta y gana grandes premios!')
                .addFields(
                    { name: '📝 Uso', value: '`>roulette <tipo> <cantidad>`', inline: false },
                    { 
                        name: '🎯 Tipos de Apuesta', 
                        value: '**Números:** `0-36` (x35)\n**Colores:** `rojo`, `negro` (x1.95)\n**Paridad:** `par`, `impar` (x1.95)\n**Rango:** `bajo` (1-18), `alto` (19-36) (x1.95)\n**Docenas:** `1era`, `2da`, `3era` (x2.9)\n**Columnas:** `col1`, `col2`, `col3` (x2.9)', 
                        inline: false 
                    },
                    { 
                        name: '💡 Ejemplos', 
                        value: '`>roulette 7 1000` - Apostar al 7\n`>roulette rojo 500` - Apostar al rojo\n`>roulette par 750` - Apostar a números pares\n`>roulette 1era 2000` - Apostar 1era docena', 
                        inline: false 
                    },
                    { 
                        name: '💰 Límites', 
                        value: `Min: ${this.formatNumber(this.config.roulette.minBet)} π-b$\nMax: ${this.formatNumber(this.config.roulette.maxBet)} π-b$`, 
                        inline: true 
                    },
                    { 
                        name: '⏰ Cooldown', 
                        value: '45 segundos', 
                        inline: true 
                    }
                )
                .setColor('#8B0000')
                .setFooter({ text: '🍀 La suerte está en tus manos' });
            
            await message.reply({ embeds: [embed] });
            return;
        }
    
        const betType = args[1].toLowerCase();
        const betAmount = parseInt(args[2]);
    
        // Validar cantidad de apuesta
        if (isNaN(betAmount) || betAmount < this.config.roulette.minBet || betAmount > this.config.roulette.maxBet) {
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.roulette.minBet)} y ${this.formatNumber(this.config.roulette.maxBet)} π-b$`);
            return;
        }
    
        // Verificar fondos
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes π-b Coins. Tu balance: ${this.formatNumber(user.balance)} π-b$`);
            return;
        }
    
        // Verificar cooldown
        const cooldownCheck = this.checkCooldown(userId, 'roulette');
        if (cooldownCheck.onCooldown) {
            const timeLeft = Math.ceil(cooldownCheck.timeLeft / 1000);
            await message.reply(`⏰ Debes esperar ${timeLeft} segundos antes de jugar otra vez`);
            return;
        }
    
        // Validar tipo de apuesta
        const validBet = this.validateRouletteBet(betType);
        if (!validBet.isValid) {
            await message.reply(`❌ Tipo de apuesta inválido: \`${betType}\`\n💡 Usa: números (0-36), rojo, negro, par, impar, bajo, alto, 1era, 2da, 3era, col1, col2, col3`);
            return;
        }
    
        // Girar la ruleta
        const spinResult = this.spinRoulette();
        const won = this.checkRouletteWin(validBet, spinResult);
        
        // Establecer cooldown
        this.setCooldown(userId, 'roulette');
    
        const updateData = {
            'stats.gamesPlayed': (user.stats.gamesPlayed || 0) + 1
        };
    
        // Crear embed con animación de giro
        const loadingEmbed = new EmbedBuilder()
            .setTitle('🎰 Ruleta - Girando...')
            .setDescription('🌀 **La ruleta está girando...**\n\n🎯 Esperando el resultado...')
            .addFields(
                { name: '🎲 Tu Apuesta', value: `**${validBet.displayName}**`, inline: true },
                { name: '💰 Cantidad', value: `${this.formatNumber(betAmount)} π-b$`, inline: true }
            )
            .setColor('#FFD700');
    
        const reply = await message.reply({ embeds: [loadingEmbed] });
    
        // Simular suspense
        await new Promise(resolve => setTimeout(resolve, 4000));
    
        // Crear embed del resultado
        const resultEmbed = new EmbedBuilder()
            .setTitle('🎰 Ruleta - Resultado')
            .setColor(won ? '#00FF00' : '#FF0000')
            .addFields(
                { name: '🎯 Tu Apuesta', value: `**${validBet.displayName}**`, inline: true },
                { name: '🎰 Número Ganador', value: `${this.formatRouletteNumber(spinResult)}`, inline: true },
                { name: '💰 Apuesta', value: `${this.formatNumber(betAmount)} π-b$`, inline: true }
            )
            .setTimestamp();
    
        if (won) {
            const multiplier = this.config.roulette.payouts[validBet.type];
            const winAmount = Math.floor(betAmount * multiplier);
            const profit = winAmount - betAmount;
            
            await this.economy.addMoney(userId, profit, 'roulette_win');
            await this.economy.updateUser(userId, updateData);
    
            // *** ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_won');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
            }
            
            resultEmbed.setDescription(`🎉 **¡GANASTE!**`)
                .addFields(
                    { name: '🎊 ¡Felicidades!', value: `¡Tu apuesta fue correcta!`, inline: false },
                    { name: '💎 Multiplicador', value: `x${multiplier}`, inline: true },
                    { name: '🤑 Ganancia Total', value: `+${this.formatNumber(profit)} π-b$`, inline: true },
                    { name: '💸 Balance Anterior', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance + profit)} π-b$ 🚀`, inline: false }
                );
    
            // Mensaje especial para números exactos
            if (validBet.type === 'straight') {
                resultEmbed.addFields({ 
                    name: '🌟 ¡Número Exacto!', 
                    value: '¡Increíble suerte! Acertaste el número exacto.', 
                    inline: false 
                });
            }
        } else {
            await this.economy.removeMoney(userId, betAmount, 'roulette_loss');
            await this.economy.updateUser(userId, updateData);
    
            // *** ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_lost');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
            }
            
            let encouragement = '🎯 ¡La próxima será tu momento de suerte!';
            
            // Mensajes especiales según el número
            if (spinResult.number === 0) {
                encouragement = '😱 ¡Salió el 0! La casa siempre gana en este número.';
            } else if (validBet.type === 'straight') {
                const difference = Math.abs(parseInt(betType) - spinResult.number);
                if (difference <= 2) {
                    encouragement = '😔 ¡Muy cerca! Solo te faltaron unos números.';
                }
            }
            
            resultEmbed.setDescription(`💸 **No ganaste esta vez...** ${encouragement}`)
                .addFields(
                    { name: '💸 Perdiste', value: `${this.formatNumber(betAmount)} π-b$`, inline: true },
                    { name: '💸 Balance Anterior', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance - betAmount)} π-b$`, inline: false },
                    { name: '💡 Consejo', value: 'En la ruleta, cada giro es independiente. ¡No te rindas!', inline: false }
                );
        }
    
        await reply.edit({ embeds: [resultEmbed] });
    }
    
    // Métodos auxiliares para la ruleta
    validateRouletteBet(betType) {
        // Números directos (0-36)
        const num = parseInt(betType);
        if (!isNaN(num) && num >= 0 && num <= 36) {
            return { isValid: true, type: 'straight', value: num, displayName: `Número ${num}` };
        }
    
        // Tipos de apuesta especiales
        const betTypes = {
            // Colores
            'rojo': { type: 'red', displayName: '🔴 Rojo' },
            'red': { type: 'red', displayName: '🔴 Rojo' },
            'negro': { type: 'black', displayName: '⚫ Negro' },
            'black': { type: 'black', displayName: '⚫ Negro' },
            
            // Paridad
            'par': { type: 'even', displayName: '🟦 Par' },
            'even': { type: 'even', displayName: '🟦 Par' },
            'impar': { type: 'odd', displayName: '🟨 Impar' },
            'odd': { type: 'odd', displayName: '🟨 Impar' },
            
            // Rangos
            'bajo': { type: 'low', displayName: '📉 Bajo (1-18)' },
            'low': { type: 'low', displayName: '📉 Bajo (1-18)' },
            'alto': { type: 'high', displayName: '📈 Alto (19-36)' },
            'high': { type: 'high', displayName: '📈 Alto (19-36)' },
            
            // Docenas
            '1era': { type: 'dozen1', displayName: '1️⃣ Primera Docena (1-12)' },
            'primera': { type: 'dozen1', displayName: '1️⃣ Primera Docena (1-12)' },
            '1st': { type: 'dozen1', displayName: '1️⃣ Primera Docena (1-12)' },
            '2da': { type: 'dozen2', displayName: '2️⃣ Segunda Docena (13-24)' },
            'segunda': { type: 'dozen2', displayName: '2️⃣ Segunda Docena (13-24)' },
            '2nd': { type: 'dozen2', displayName: '2️⃣ Segunda Docena (13-24)' },
            '3era': { type: 'dozen3', displayName: '3️⃣ Tercera Docena (25-36)' },
            'tercera': { type: 'dozen3', displayName: '3️⃣ Tercera Docena (25-36)' },
            '3rd': { type: 'dozen3', displayName: '3️⃣ Tercera Docena (25-36)' },
            
            // Columnas
            'col1': { type: 'column1', displayName: '📊 Columna 1' },
            'columna1': { type: 'column1', displayName: '📊 Columna 1' },
            'col2': { type: 'column2', displayName: '📊 Columna 2' },
            'columna2': { type: 'column2', displayName: '📊 Columna 2' },
            'col3': { type: 'column3', displayName: '📊 Columna 3' },
            'columna3': { type: 'column3', displayName: '📊 Columna 3' }
        };
    
        if (betTypes[betType]) {
            return { isValid: true, ...betTypes[betType] };
        }
    
        return { isValid: false };
    }
    
    spinRoulette() {
        const number = Math.floor(Math.random() * 37); // 0-36
        
        // Definir colores (ruleta europea)
        const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        const isRed = redNumbers.includes(number);
        const color = number === 0 ? 'green' : (isRed ? 'red' : 'black');
        
        return { number, color };
    }
    
    checkRouletteWin(bet, result) {
        const { type, value } = bet;
        const { number, color } = result;
    
        switch (type) {
            case 'straight':
                return number === value;
            case 'red':
                return color === 'red';
            case 'black':
                return color === 'black';
            case 'even':
                return number !== 0 && number % 2 === 0;
            case 'odd':
                return number !== 0 && number % 2 === 1;
            case 'low':
                return number >= 1 && number <= 18;
            case 'high':
                return number >= 19 && number <= 36;
            case 'dozen1':
                return number >= 1 && number <= 12;
            case 'dozen2':
                return number >= 13 && number <= 24;
            case 'dozen3':
                return number >= 25 && number <= 36;
            case 'column1':
                return number > 0 && (number - 1) % 3 === 0;
            case 'column2':
                return number > 0 && (number - 2) % 3 === 0;
            case 'column3':
                return number > 0 && number % 3 === 0;
            default:
                return false;
        }
    }
    
    formatRouletteNumber(result) {
        const { number, color } = result;
        
        if (number === 0) {
            return '🟢 **0** (Verde)';
        }
        
        const colorEmoji = color === 'red' ? '🔴' : '⚫';
        const colorName = color === 'red' ? 'Rojo' : 'Negro';
        
        return `${colorEmoji} **${number}** (${colorName})`;
    }

    // Método principal para manejar la ruleta rusa
    async handleRussianRoulette(message, args) {
        const userId = message.author.id;
        const channelId = message.channel.id;
        const user = await this.economy.getUser(userId);
    
        // Si no hay argumentos suficientes, mostrar ayuda
        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setTitle('🔫 Ruleta Rusa - Juego Multiplayer')
                .setDescription('¡El último jugador en pie se lleva todo el dinero!')
                .addFields(
                    { name: '📝 Uso', value: '`>russian <cantidad>` - Crear/Unirse a partida', inline: false },
                    { 
                        name: '🎯 Cómo Funciona', 
                        value: '• Cada jugador apuesta la misma cantidad\n• Se carga 1 bala en un revólver de 6 cámaras\n• Los jugadores se turnan para disparar\n• El último vivo gana 85% del pot total\n• La casa se queda con el 15%', 
                        inline: false 
                    },
                    { 
                        name: '👥 Jugadores', 
                        value: `Mínimo: ${this.config.russianRoulette.minPlayers}\nMáximo: ${this.config.russianRoulette.maxPlayers}`, 
                        inline: true 
                    },
                    { 
                        name: '💰 Apuesta', 
                        value: `Min: ${this.formatNumber(this.config.russianRoulette.minBet)} π-b$\nMax: ${this.formatNumber(this.config.russianRoulette.maxBet)} π-b$`, 
                        inline: true 
                    },
                    { 
                        name: '⏰ Tiempos', 
                        value: '30s para unirse\n20s por turno\nCooldown: 5 min', 
                        inline: true 
                    },
                    { 
                        name: '💡 Ejemplo', 
                        value: '`>russian 1000` - Apostar 1000 π-b$', 
                        inline: false 
                    }
                )
                .setColor('#8B0000')
                .setFooter({ text: '⚠️ Juego de alto riesgo - Solo para valientes' });
            
            await message.reply({ embeds: [embed] });
            return;
        }
    
        const betAmount = parseInt(args[1]);
    
        // Validar cantidad de apuesta
        if (isNaN(betAmount) || betAmount < this.config.russianRoulette.minBet || betAmount > this.config.russianRoulette.maxBet) {
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.russianRoulette.minBet)} y ${this.formatNumber(this.config.russianRoulette.maxBet)} π-b$`);
            return;
        }
    
        // Verificar fondos
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes π-b Coins. Tu balance: ${this.formatNumber(user.balance)} π-b$`);
            return;
        }
    
        // Verificar cooldown
        const cooldownCheck = this.checkCooldown(userId, 'russianRoulette');
        if (cooldownCheck.onCooldown) {
            const timeLeft = Math.ceil(cooldownCheck.timeLeft / 60000);
            await message.reply(`⏰ Debes esperar ${timeLeft} minutos antes de jugar otra vez`);
            return;
        }
    
        // Verificar si ya hay una partida activa en el canal
        const gameKey = `russian_${channelId}`;
        let game = this.activeGames.get(gameKey);
    
        if (game) {
            // Unirse a partida existente
            await this.joinRussianRoulette(message, game, userId, betAmount);
        } else {
            // Crear nueva partida
            await this.createRussianRoulette(message, userId, betAmount, channelId);
        }
    }
    
    async createRussianRoulette(message, userId, betAmount, channelId) {
        const gameKey = `russian_${channelId}`;
        
        const game = {
            channelId,
            creatorId: userId,
            betAmount,
            players: [
                {
                    id: userId,
                    username: message.author.username,
                    displayName: message.author.displayName || message.author.username,
                    alive: true,
                    shots: 0
                }
            ],
            phase: 'waiting', // waiting, playing, finished
            currentPlayerIndex: 0,
            bulletPosition: 0, // Se determinará cuando inicie el juego
            currentShot: 0,
            pot: betAmount,
            startTime: Date.now(),
            joinStartTime: Date.now(),
            turnTimeout: null,
            joinTimeout: null,
            manualStart: false
        };
    
        this.activeGames.set(gameKey, game);
    
        // Reservar dinero del creador
        await this.economy.removeMoney(userId, betAmount, 'russian_roulette_bet');
    
        const embed = new EmbedBuilder()
            .setTitle('🔫 Ruleta Rusa - Nueva Partida')
            .setDescription('¡Se ha creado una nueva partida! Otros jugadores pueden unirse.')
            .setColor('#8B0000')
            .addFields(
                { name: '👑 Creador', value: `<@${userId}>`, inline: true },
                { name: '💰 Apuesta por Jugador', value: `${this.formatNumber(betAmount)} π-b$`, inline: true },
                { name: '💎 Pot Actual', value: `${this.formatNumber(game.pot)} π-b$`, inline: true },
                { name: '👥 Jugadores', value: `${game.players.length}/${this.config.russianRoulette.maxPlayers}`, inline: true },
                { name: '⏰ Tiempo para Unirse', value: '30 segundos', inline: true },
                { name: '🎮 Para Unirse', value: `\`>russian ${betAmount}\``, inline: true },       
                { name: '🚀 Para Iniciar', value: `\`>start\` (solo el creador)`, inline: true } // ← NUEVO
            )
            .setTimestamp()
            .setFooter({ text: 'El creador puede iniciar con >start cuando haya mínimo 2 jugadores' });
    
        const reply = await message.reply({ embeds: [embed] });
        game.messageId = reply.id;
    
        // Timer para iniciar el juego automáticamente
/*        game.joinTimeout = setTimeout(async () => {
            if (game.players.length >= this.config.russianRoulette.minPlayers) {
                await this.startRussianRoulette(game, reply);
            } else {
                await this.cancelRussianRoulette(game, reply, 'No se unieron suficientes jugadores');
            }
        }, this.config.russianRoulette.joinTime);*/
    }
    
    async joinRussianRoulette(message, game, userId, betAmount) {
        // Verificar si el juego ya empezó
        if (game.phase !== 'waiting') {
            await message.reply('❌ Esta partida ya comenzó. Espera a que termine para crear una nueva.');
            return;
        }
    
        // Verificar si ya está en el juego
        if (game.players.some(p => p.id === userId)) {
            await message.reply('❌ Ya estás en esta partida.');
            return;
        }
    
        // Verificar si la apuesta coincide
        if (betAmount !== game.betAmount) {
            await message.reply(`❌ La apuesta debe ser exactamente ${this.formatNumber(game.betAmount)} π-b$ para unirse a esta partida.`);
            return;
        }
    
        // Verificar si está lleno
        if (game.players.length >= this.config.russianRoulette.maxPlayers) {
            await message.reply('❌ Esta partida está llena.');
            return;
        }
    
        // Verificar fondos del nuevo jugador
        const user = await this.economy.getUser(userId);
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes π-b Coins. Tu balance: ${this.formatNumber(user.balance)} π-b$`);
            return;
        }
    
        // Agregar jugador
        game.players.push({
            id: userId,
            username: message.author.username,
            displayName: message.author.displayName || message.author.username,
            alive: true,
            shots: 0
        });
    
        game.pot += betAmount;
    
        // Reservar dinero
        await this.economy.removeMoney(userId, betAmount, 'russian_roulette_bet');
    
        // Actualizar embed
        const embed = new EmbedBuilder()
            .setTitle('🔫 Ruleta Rusa - Esperando Jugadores')
            .setDescription('¡Un jugador más se ha unido a la partida!')
            .setColor('#8B0000')
            .addFields(
                { name: '👑 Creador', value: `<@${game.creatorId}>`, inline: true },
                { name: '💰 Apuesta por Jugador', value: `${this.formatNumber(game.betAmount)} π-b$`, inline: true },
                { name: '💎 Pot Actual', value: `${this.formatNumber(game.pot)} π-b$`, inline: true },
                { 
                    name: '👥 Jugadores', 
                    value: game.players.map(p => `• ${p.displayName}`).join('\n'), 
                    inline: false 
                },
                { name: '📊 Estado', value: `${game.players.length}/${this.config.russianRoulette.maxPlayers} jugadores`, inline: true },
                { name: '🎮 Para Unirse', value: `\`>russian ${game.betAmount}\``, inline: true },
                { name: '🚀 Para Iniciar', value: `\`>start\` (solo el creador)`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'El creador puede iniciar con >start cuando esté listo' });
    
/*        // Si está lleno, iniciar inmediatamente
        if (game.players.length >= this.config.russianRoulette.maxPlayers) {
            if (game.joinTimeout) {
                clearTimeout(game.joinTimeout);
            }
            embed.addFields({ name: '🚀 Estado', value: '¡Partida llena! Iniciando...', inline: true });*/
            
            const channel = await message.client.channels.fetch(game.channelId);
            const gameMessage = await channel.messages.fetch(game.messageId);
            await gameMessage.edit({ embeds: [embed] });
            
/*            setTimeout(() => this.startRussianRoulette(game, gameMessage), 3000);
        } else {
            const timeLeft = Math.max(0, Math.ceil((game.joinStartTime + this.config.russianRoulette.joinTime - Date.now()) / 1000));

            embed.addFields({ 
                name: '🎮 Para Unirse', 
                value: `\`>russian ${game.betAmount}\`\nTiempo restante: ${timeLeft}s`, 
                inline: true 
            });
            
            const channel = await message.client.channels.fetch(game.channelId);
            const gameMessage = await channel.messages.fetch(game.messageId);
            await gameMessage.edit({ embeds: [embed] });
        }*/
    
        await message.reply(`✅ Te has unido a la partida! Pot actual: ${this.formatNumber(game.pot)} π-b$`);
    }

    async handleStartRussian(message) {
        const gameKey = `russian_${message.channel.id}`;
        const game = this.activeGames.get(gameKey);
        
        if (!game) {
            await message.reply('❌ No hay ninguna partida de ruleta rusa esperando en este canal.');
            return;
        }
        
        if (game.phase !== 'waiting') {
            await message.reply('❌ Esta partida ya comenzó o terminó.');
            return;
        }
        
        if (message.author.id !== game.creatorId) {
            await message.reply('❌ Solo el creador de la partida puede iniciarla.');
            return;
        }
        
        if (game.players.length < this.config.russianRoulette.minPlayers) {
            await message.reply(`❌ Se necesitan mínimo ${this.config.russianRoulette.minPlayers} jugadores para iniciar.`);
            return;
        }
        
        game.manualStart = true;
        
        // Buscar el mensaje del juego
        try {
            const channel = await message.client.channels.fetch(game.channelId);
            const gameMessage = await channel.messages.fetch(game.messageId);
            await this.startRussianRoulette(game, gameMessage);
            await message.reply('🚀 ¡Iniciando la partida de ruleta rusa!');
        } catch (error) {
            console.error('Error iniciando partida:', error);
            await message.reply('❌ Error al iniciar la partida.');
        }
    }
    
    async startRussianRoulette(game, gameMessage) {
        game.phase = 'playing';
        
        // Mezclar orden de jugadores
        for (let i = game.players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [game.players[i], game.players[j]] = [game.players[j], game.players[i]];
        }
    
        // Determinar posición de la bala (1-6)
        game.bulletPosition = Math.floor(Math.random() * 6) + 1;
        game.currentShot = 0;
        game.currentPlayerIndex = 0;
    
        const embed = new EmbedBuilder()
            .setTitle('🔫 Ruleta Rusa - ¡EL JUEGO COMIENZA!')
            .setDescription('🎲 **El revólver ha sido cargado con una bala...**\n🔄 **Los jugadores han sido mezclados...**')
            .setColor('#FF0000')
            .addFields(
                { name: '💎 Pot Total', value: `${this.formatNumber(game.pot)} π-b$`, inline: true },
                { name: '🏆 Premio para el Ganador', value: `${this.formatNumber(Math.floor(game.pot * this.config.russianRoulette.winnerMultiplier))} π-b$`, inline: true },
                { 
                    name: '👥 Orden de Juego', 
                    value: game.players.map((p, i) => `${i + 1}. ${p.displayName} ${p.alive ? '💚' : '💀'}`).join('\n'), 
                    inline: false 
                }
            )
            .setTimestamp()
            .setFooter({ text: 'El primer jugador tiene 20 segundos para disparar...' });
    
        await gameMessage.reply({ embeds: [embed] });
        
        setTimeout(() => this.nextTurn(game, gameMessage.client), 3000);
    }
    
    async nextTurn(game, client) {
        if (game.phase !== 'playing') return;
    
        // Verificar si el juego terminó
        const alivePlayers = game.players.filter(p => p.alive);
        if (alivePlayers.length <= 1) {
            await this.endRussianRoulette(game, client);
            return;
        }
    
        // Encontrar el siguiente jugador vivo
        while (!game.players[game.currentPlayerIndex].alive) {
            game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        }
    
        const currentPlayer = game.players[game.currentPlayerIndex];
        game.currentShot++;
    
        const embed = new EmbedBuilder()
            .setTitle('🔫 Ruleta Rusa - Turno Actual')
            .setDescription(`🎯 **Es el turno de ${currentPlayer.displayName}**`)
            .setColor('#FFD700')
            .addFields(
                { name: '🔫 Disparo Número', value: `${game.currentShot}/6`, inline: true },
                { name: '💎 Pot', value: `${this.formatNumber(game.pot)} π-b$`, inline: true },
                { name: '👥 Jugadores Vivos', value: `${alivePlayers.length}`, inline: true },
                { 
                    name: '🎲 Estado de Jugadores', 
                    value: game.players.map(p => `${p.alive ? '💚' : '💀'} ${p.displayName}${p.id === currentPlayer.id ? ' **← TURNO**' : ''}`).join('\n'), 
                    inline: false 
                },
                { name: '⏰ Tiempo Límite', value: '20 segundos', inline: true },
                { name: '🎮 Acción', value: `<@${currentPlayer.id}> escribe \`>shoot\` para disparar`, inline: true }
            )
            .setTimestamp();

        try {
            const channel = await client.channels.fetch(game.channelId);
            const gameMessage = await channel.messages.fetch(game.messageId);
            await gameMessage.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error actualizando mensaje del juego:', error);
        }   
    
    
        // Timer para el turno
        game.turnTimeout = setTimeout(async () => {
            if (game.phase === 'playing') {
                await this.forceShoot(game, currentPlayer.id, client);
            }
        }, this.config.russianRoulette.turnTime);
    }
    
    async handleShoot(message, gameKey) {
        console.log('🔫 handleShoot llamado:');
        console.log('- gameKey:', gameKey);
        console.log('- Juego existe:', !!this.activeGames.get(gameKey));
        console.log('- Usuario:', message.author.id);
        
        const game = this.activeGames.get(gameKey);
        if (!game || game.phase !== 'playing') {
            await message.reply('❌ No hay ninguna partida activa o no es tu turno.');
            return;
        }

        console.log('alive in 1');
        
        const currentPlayer = game.players[game.currentPlayerIndex];
        if (message.author.id !== currentPlayer.id) {
            await message.reply('❌ No es tu turno.');
            return;
        }

        console.log('alive in 2');
    
        if (game.turnTimeout) {
            clearTimeout(game.turnTimeout);
        }

        console.log('alive in 3');
    
        await this.executeShot(game, message.author.id, message.client);
        console.log('alive in 4');
    }
    
    async executeShot(game, playerId, client) {
        console.log(game.players.find(p => p.id === playerId));
        const currentPlayer = game.players.find(p => p.id === playerId);
        if (!currentPlayer) return;

        console.log('ez');
        
        currentPlayer.shots++;
    
        // Verificar si es la bala
        const isBullet = game.currentShot === game.bulletPosition;
    
        const embed = new EmbedBuilder()
            .setTimestamp();
    
        if (isBullet) {
            // ¡BANG! El jugador muere
            currentPlayer.alive = false;

            // MENSAJE ESPECIAL PARA SEXTO DISPARO
            const isLastShot = game.currentShot === 6;
            const bangTitle = isLastShot ? '💥 ¡ÚLTIMO DISPARO FATAL! 💥' : '💥 ¡BANG! 💥';
            const bangDesc = isLastShot 
                ? `💀 **${currentPlayer.displayName} recibió la bala asegurada del último disparo...**`
                : `💀 **${currentPlayer.displayName} ha sido eliminado...**`;
            
            embed.setTitle(bangTitle)
                .setDescription(bangDesc)
                .setColor('#8B0000')
                .addFields(
                    { name: '🔫 Resultado', value: isLastShot ? '💥 ¡Era el último disparo - bala asegurada!' : '💥 ¡La bala estaba en esta cámara!', inline: false },
                    { name: '💀 Jugador Eliminado', value: currentPlayer.displayName, inline: true },
                    { name: '🎯 Disparo Fatal', value: `${game.currentShot}/6`, inline: true },
                    { 
                        name: '👥 Jugadores Restantes', 
                        value: game.players.filter(p => p.alive).map(p => `💚 ${p.displayName}`).join('\n') || 'Ninguno', 
                        inline: false 
                    }
            );
    
            // Establecer cooldown para el jugador eliminado
            this.setCooldown(playerId, 'russianRoulette');
    
            // Actualizar estadísticas
            const user = await this.economy.getUser(playerId);
            const updateData = { 'stats.gamesPlayed': (user.stats.gamesPlayed || 0) + 1 };
            await this.economy.updateUser(playerId, updateData);
            
            if (this.achievements) {
                await this.achievements.updateStats(playerId, 'game_played');
                await this.achievements.updateStats(playerId, 'game_lost');
            }
        } else {
            // ¡CLICK! Está vivo
            embed.setTitle('🔄 ¡CLICK! 🔄')
                .setDescription(`😅 **${currentPlayer.displayName} está a salvo... por ahora**`)
                .setColor('#00FF00')
                .addFields(
                    { name: '🔫 Resultado', value: '🔄 Cámara vacía - ¡Qué suerte!', inline: false },
                    { name: '😌 Jugador Salvado', value: currentPlayer.displayName, inline: true },
                    { name: '🎯 Disparo Número', value: `${game.currentShot}/6`, inline: true },
                    { 
                        name: '👥 Siguiente Turno', 
                        value: 'El siguiente jugador tomará el revólver...', 
                        inline: false 
                    }
                );
        }

        try {
            const channel = await client.channels.fetch(game.channelId);
            const gameMessage = await channel.messages.fetch(game.messageId);
            await gameMessage.edit({ embeds: [embed] });
        } catch (error) {
            console.error('Error actualizando mensaje del juego: ', error);
        }
    
        // VERIFICAR SI EL JUEGO DEBE TERMINAR
        const alivePlayers = game.players.filter(p => p.alive);
        
        // Si solo queda 1 jugador vivo, terminar
        if (alivePlayers.length <= 1) {
            setTimeout(async () => {
                await this.endRussianRoulette(game, client);
            }, 4000);
            return;
        }
        
        // Si llegamos al 6to disparo y hay 2+ jugadores, recargar revólver
        if (game.currentShot === 6 && alivePlayers.length > 1) {
            setTimeout(async () => {
                await this.reloadRevolver(game, client);
            }, 4000);
            return;
        }
    }

    async reloadRevolver(game, client) {
        // Reiniciar revólver
        game.bulletPosition = Math.floor(Math.random() * 6) + 1;
        game.currentShot = 0;
        
        const alivePlayers = game.players.filter(p => p.alive);
        
        const embed = new EmbedBuilder()
            .setTitle('🔄 ¡REVÓLVER RECARGADO!')
            .setDescription('📦 **Nueva bala cargada - El juego continúa...**')
            .setColor('#FFD700')
            .addFields(
                { name: '🔫 Nueva Ronda', value: 'Se ha colocado una nueva bala en el revólver', inline: false },
                { name: '👥 Jugadores Restantes', value: alivePlayers.map(p => `💚 ${p.displayName}`).join('\n'), inline: false },
                { name: '🎯 Siguiente', value: 'El juego continúa con el siguiente jugador...', inline: false }
            )
            .setTimestamp();
    
        try {
            const channel = await client.channels.fetch(game.channelId);
            const gameMessage = await channel.messages.fetch(game.messageId);
            await gameMessage.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error actualizando mensaje del juego:', error);
        }
    
        // Continuar con el siguiente turno después de un delay
        setTimeout(async () => {
            game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
            await this.nextTurn(game, client);
        }, 4000);
    }
    
    async forceShoot(game, playerId, client) {
        const currentPlayer = game.players.find(p => p.id === playerId);
        if (!currentPlayer) return;
    
        const embed = new EmbedBuilder()
            .setTitle('⏰ ¡Tiempo Agotado!')
            .setDescription(`${currentPlayer.displayName} no disparó a tiempo. Se dispara automáticamente...`)
            .setColor('#FF8C00');

        try {
            const channel = await client.channels.fetch(game.channelId);
            const gameMessage = await channel.messages.fetch(game.messageId);
            await gameMessage.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error actualizando mensaje del juego:', error);
        }
    
        setTimeout(() => this.executeShot(game, playerId, client), 2000);
    }
    
    async endRussianRoulette(game, client) {
        game.phase = 'finished';
        this.activeGames.delete(`russian_${game.channelId}`);
    
        const survivors = game.players.filter(p => p.alive);
        const totalPot = game.pot;
        const winnerPrize = Math.floor(totalPot * this.config.russianRoulette.winnerMultiplier);
        const houseCut = totalPot - winnerPrize;
    
        let embed = new EmbedBuilder()
            .setTimestamp();
    
        if (survivors.length === 1) {
            // Un ganador
            const winner = survivors[0];
            
            await this.economy.addMoney(winner.id, winnerPrize, 'russian_roulette_win');
            
            // Establecer cooldown para el ganador
            this.setCooldown(winner.id, 'russianRoulette');
    
            // Actualizar estadísticas del ganador
            const updateData = { 'stats.gamesPlayed': ((await this.economy.getUser(winner.id)).stats.gamesPlayed || 0) + 1 };
            await this.economy.updateUser(winner.id, updateData);
    
            if (this.achievements) {
                await this.achievements.updateStats(winner.id, 'game_played');
                await this.achievements.updateStats(winner.id, 'game_won');
            }
    
            embed.setTitle('🏆 ¡TENEMOS UN GANADOR! 🏆')
                .setDescription(`🎉 **¡${winner.displayName} sobrevivió a la ruleta rusa!**`)
                .setColor('#FFD700')
                .addFields(
                    { name: '👑 GANADOR', value: `<@${winner.id}>`, inline: false },
                    { name: '💰 Premio', value: `${this.formatNumber(winnerPrize)} π-b$`, inline: true },
                    { name: '💎 Pot Total', value: `${this.formatNumber(totalPot)} π-b$`, inline: true },
                    { name: '🏦 Casa', value: `${this.formatNumber(houseCut)} π-b$ (15%)`, inline: true },
                    { 
                        name: '📊 Resultado Final', 
                        value: game.players.map(p => `${p.alive ? '🏆' : '💀'} ${p.displayName} (${p.shots} disparos)`).join('\n'), 
                        inline: false 
                    },
                    { name: '🔫 Bala Estaba En', value: `Disparo ${game.bulletPosition}/6`, inline: true }
                );
        } else {
            // Todos murieron (teóricamente imposible, pero por seguridad)
            embed.setTitle('💀 ¡TODOS ELIMINADOS!')
                .setDescription('¡Increíble! Todos los jugadores fueron eliminados.')
                .setColor('#8B0000')
                .addFields(
                    { name: '💰 Devolución', value: 'Dinero devuelto a todos los jugadores', inline: false }
                );
    
            // Devolver dinero a todos
            for (const player of game.players) {
                await this.economy.addMoney(player.id, game.betAmount, 'russian_roulette_refund');
            }
        }

        try {
            const channel = await client.channels.fetch(game.channelId);
            const gameMessage = await channel.messages.fetch(game.messageId);
            await gameMessage.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error actualizando mensaje final del juego:', error);
        }
    }
    
    async cancelRussianRoulette(game, gameMessage, reason) {
        game.phase = 'finished';
        this.activeGames.delete(`russian_${game.channelId}`);
    
        // Devolver dinero a todos los jugadores
        for (const player of game.players) {
            await this.economy.addMoney(player.id, game.betAmount, 'russian_roulette_refund');
        }
    
        const embed = new EmbedBuilder()
            .setTitle('❌ Partida Cancelada')
            .setDescription(`La partida ha sido cancelada: ${reason}`)
            .setColor('#FF0000')
            .addFields(
                { name: '💰 Devolución', value: 'El dinero ha sido devuelto a todos los jugadores', inline: false }
            )
            .setTimestamp();
    
        await gameMessage.reply({ embeds: [embed] });
    }
    
    async processCommand(message) {
        if (message.author.bot) return;

        const args = message.content.toLowerCase().split(' ');
        const command = args[0];

        try {
            switch (command) {
                case '>coinflip':
                case '>cf':
                case '>coin':
                    await this.handleCoinflip(message, args);
                    break;
                case '>dice':
                case '>dado':
                case '>d':
                    await this.handleDice(message, args);
                    break;
                case '>lottery':
                case '>loteria':
                case '>lotto':
                    await this.handleLottery(message, args);
                    break;
                case '>blackjack':
                case '>bj':
                case '>21':
                    await this.handleBlackjack(message, args);
                    break;
                case '>roulette':
                case '>ruleta':
                case '>wheel':
                    await this.handleRoulette(message, args);
                    break;
                case '>russian':
                case '>rr':
                case '>ruleta-rusa':
                    await this.handleRussianRoulette(message, args);
                    break;
                case '>shoot':
                case '>disparar':
                    const gameKey = `russian_${message.channel.id}`;
                    await this.handleShoot(message, gameKey);
                    break;
                case '>start': // ← NUEVO COMANDO
                case '>iniciar':
                    await this.handleStartRussian(message);
                    break;
                case '>games':
                case '>minigames':
                case '>juegos':
                    await this.showGamesList(message);
                    break;
                default:
                    // No es un comando de minijuegos
                    break;
            }
        } catch (error) {
            console.error('❌ Error en minijuegos:', error);
            await message.reply('❌ Ocurrió un error en el juego. Intenta de nuevo.');
        }
    }

    // Mostrar lista de juegos disponibles
    async showGamesList(message) {
        const embed = new EmbedBuilder()
            .setTitle('🎮 Minijuegos Disponibles')
            .setDescription('¡Diviértete y gana π-b Coins!')
            .setColor('#9932CC')
            .addFields(
                { 
                    name: '🪙 Coinflip', 
                    value: '`>coinflip <cara/cruz> <cantidad>`\nApuesta: 50-10,000 π-b$\nGanancia: x1.95\nCooldown: 15 segundos', 
                    inline: false 
                },
                { 
                    name: '🎲 Dados', 
                    value: '`>dice <1-6/alto/bajo> <cantidad>`\nApuesta: 50-10,000 π-b$\nGanancia: x1.9 - x5.8\nCooldown: 30 segundos', 
                    inline: false 
                },
                { 
                    name: '🎰 Lotería', 
                    value: '`>lottery <número> <cantidad>`\nApuesta: 500-5,000 π-b$\nGanancia: x100 (¡Si aciertas!)\nCooldown: 30 minutos', 
                    inline: false 
                },
                { 
                    name: '♠️ Blackjack', 
                    value: '`>blackjack <cantidad>`\nApuesta: 100-15,000 π-b$\nGanancia: x2 (x2.5 con Blackjack natural)\nCooldown: 3 minutos', 
                    inline: false 
                },
                { 
                    name: '🎰 Ruleta', 
                    value: '`>roulette <tipo> <cantidad>`\nApuesta: 100-20,000 π-b$\nGanancia: x1.95 - x35\nCooldown: 45 segundos', 
                    inline: false 
                },
                { 
                    name: '🔫 Ruleta Rusa (Multiplayer)', 
                    value: '`>russian <cantidad>` - Crear partida\n`>start` - Iniciar (creador)\n`>shoot` - Disparar en tu turno\nApuesta: 200-5,000 π-b$\nJugadores: 2-6\nGanador se lleva 85% del pot\nCooldown: 45 segundos', 
                    inline: false 
                },
                { 
                    name: '🔮 Próximamente', 
                    value: '\n• Slots\n• Poker', 
                    inline: false 
                }
            )
            .setFooter({ text: 'Juega responsablemente - La casa siempre tiene ventaja' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
}

module.exports = MinigamesSystem;
