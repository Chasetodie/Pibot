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
                cooldown: /*1800000*/, // 30 minutos (30 * 60 * 1000)
                winMultiplier: 100, // Gana x100 si acierta
                minNumber: 1,
                maxNumber: 100
            },
            blackjack: {
                minBet: 100,
                maxBet: 15000,
                cooldown: 10000,
                blackjackMultiplier: 2.5,
                winMultiplier: 2
            }
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
                    { name: '📝 Uso', value: '`mon!coinflip <cara/cruz> <cantidad>`', inline: false },
                    { name: '💡 Ejemplos', value: '`mon!coinflip cara 500`\n`,mon!coinflip cruz 1000`', inline: false },
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
                    { name: '💡 Ejemplos', value: '`mon!dice 6 500` - Apostar al 6\n`mon!dice alto 1000` - Apostar alto\n`mon!dice bajo 750` - Apostar bajo', inline: false },
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
                    { name: '📝 Uso', value: '`mon!lottery <número> <cantidad>`', inline: false },
                    { name: '💡 Ejemplos', value: '`mon!lottery 50 1000`\n`mon!lottery 25 2500`', inline: false },
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
            await this.economy.updateUser(userId, updateData);
            
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
   
    async processCommand(message) {
        if (message.author.bot) return;

        const args = message.content.toLowerCase().split(' ');
        const command = args[0];

        try {
            switch (command) {
                case 'mon!coinflip':
                case 'mon!cf':
                case 'mon!coin':
                    await this.handleCoinflip(message, args);
                    break;
                case 'mon!dice':
                case 'mon!dado':
                case 'mon!d':
                    await this.handleDice(message, args);
                    break;
                case 'mon!lottery':
                case 'mon!loteria':
                case 'mon!lotto':
                    await this.handleLottery(message, args);
                    break;
                case 'mon!games':
                case 'mon!minigames':
                case 'mon!juegos':
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
                    value: '`mon!coinflip <cara/cruz> <cantidad>`\nApuesta: 50-10,000 π-b$\nGanancia: x1.95\nCooldown: 15 segundos', 
                    inline: false 
                },
                { 
                    name: '🎲 Dados', 
                    value: '`mon!dice <1-6/alto/bajo> <cantidad>`\nApuesta: 50-10,000 π-b$\nGanancia: x1.9 - x5.8\nCooldown: 30 segundos', 
                    inline: false 
                },
                { 
                    name: '🎰 Lotería', 
                    value: '`mon!lottery <número> <cantidad>`\nApuesta: 500-5,000 π-b$\nGanancia: x100 (¡Si aciertas!)\nCooldown: 30 minutos', 
                    inline: false 
                },
                { 
                    name: '🔮 Próximamente', 
                    value: '• Blackjack Simple\n• Ruleta\n• Slots', 
                    inline: false 
                }
            )
            .setFooter({ text: 'Juega responsablemente - La casa siempre tiene ventaja' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
}

module.exports = MinigamesSystem;
