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
                cooldown: 5000, // 5 segundos entre juegos
                winMultiplier: 1.95 // Ganas 95% adicional (casa gana 5%)
            },
            dice: {
                minBet: 50,
                maxBet: 10000,
                cooldown: 5000,
                payouts: {
                    exact: 5.8, // Adivinar número exacto: x5.8
                    high: 1.9,  // 4-6: x1.9
                    low: 1.9    // 1-3: x1.9
                }
            },
            guess: {
                minBet: 100,
                maxBet: 5000,
                cooldown: 10000, // 10 segundos
                payouts: {
                    exact: 50,    // Número exacto: x50
                    close5: 10,   // ±5: x10
                    close10: 5,   // ±10: x5
                    close20: 2    // ±20: x2
                }
            },
            blackjack: {
                minBet: 100,
                maxBet: 10000,
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

    // ===================
    // COINFLIP
    // ===================
    
    async handleCoinflip(message, args) {
        const userId = message.author.id;
        const user = this.economy.getUser(userId);
        
        // Verificar argumentos
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('🪙 Coinflip - Cara o Cruz')
                .setDescription('Apuesta a cara o cruz y duplica tu dinero!')
                .addFields(
                    { name: '📝 Uso', value: '`!coinflip <cara/cruz> <cantidad>`', inline: false },
                    { name: '💡 Ejemplos', value: '`!coinflip cara 500`\n`!coinflip cruz 1000`', inline: false },
                    { name: '💰 Apuesta', value: `Min: ${this.formatNumber(this.config.coinflip.minBet)} C$\nMax: ${this.formatNumber(this.config.coinflip.maxBet)} C$`, inline: false },
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
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.coinflip.minBet)} y ${this.formatNumber(this.config.coinflip.maxBet)} C$`);
            return;
        }

        // Verificar fondos
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes Clarence Dolars. Tu balance: ${this.formatNumber(user.balance)} C$`);
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

        // Crear embed del resultado
        const embed = new EmbedBuilder()
            .setTitle('🪙 Coinflip - Resultado')
            .setColor(won ? '#00FF00' : '#FF0000')
            .setTimestamp();

        if (won) {
            const winAmount = Math.floor(betAmount * this.config.coinflip.winMultiplier);
            const profit = winAmount - betAmount;
            
            this.economy.addMoney(userId, profit, 'coinflip_win');
            
            embed.setDescription(`🎉 **¡GANASTE!**`)
                .addFields(
                    { name: '🪙 Resultado', value: result === 'cara' ? '🟡 Cara' : '⚪ Cruz', inline: true },
                    { name: '🎯 Tu Elección', value: normalizedChoice === 'cara' ? '🟡 Cara' : '⚪ Cruz', inline: true },
                    { name: '💰 Ganancia', value: `+${this.formatNumber(profit)} C$`, inline: true },
                    { name: '💳 Nuevo Balance', value: `${this.formatNumber(user.balance + profit)} C$`, inline: false }
                );
        } else {
            this.economy.removeMoney(userId, betAmount, 'coinflip_loss');
            
            embed.setDescription(`💸 **Perdiste...**`)
                .addFields(
                    { name: '🪙 Resultado', value: result === 'cara' ? '🟡 Cara' : '⚪ Cruz', inline: true },
                    { name: '🎯 Tu Elección', value: normalizedChoice === 'cara' ? '🟡 Cara' : '⚪ Cruz', inline: true },
                    { name: '💸 Perdiste', value: `${this.formatNumber(betAmount)} C$`, inline: true },
                    { name: '💳 Nuevo Balance', value: `${this.formatNumber(user.balance - betAmount)} C$`, inline: false }
                );
        }

        await message.reply({ embeds: [embed] });
    }

    // ===================
    // DADOS
    // ===================
    
    async handleDice(message, args) {
        const userId = message.author.id;
        const user = this.economy.getUser(userId);
        
        // Si no hay argumentos, mostrar ayuda
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('🎲 Dados - Juego de Predicción')
                .setDescription('Predice el resultado del dado y gana!')
                .addFields(
                    { name: '📝 Opciones de Apuesta', value: '• `1-6`: Número exacto (x5.8)\n• `alto`: 4, 5 o 6 (x1.9)\n• `bajo`: 1, 2 o 3 (x1.9)', inline: false },
                    { name: '💡 Ejemplos', value: '`!dice 6 500` - Apostar al 6\n`!dice alto 1000` - Apostar alto\n`!dice bajo 750` - Apostar bajo', inline: false },
                    { name: '💰 Límites', value: `Min: ${this.formatNumber(this.config.dice.minBet)} C$\nMax: ${this.formatNumber(this.config.dice.maxBet)} C$`, inline: false }
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
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.dice.minBet)} y ${this.formatNumber(this.config.dice.maxBet)} C$`);
            return;
        }

        // Verificar fondos
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes Clarence Dolars. Tu balance: ${this.formatNumber(user.balance)} C$`);
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
            
            this.economy.addMoney(userId, profit, 'dice_win');
            
            embed.setDescription(`🎉 **¡GANASTE!**`)
                .addFields(
                    { name: '💰 Multiplicador', value: `x${multiplier}`, inline: true },
                    { name: '💰 Ganancia', value: `+${this.formatNumber(profit)} C$`, inline: false },
                    { name: '💳 Nuevo Balance', value: `${this.formatNumber(user.balance + profit)} C$`, inline: false }
                );
        } else {
            this.economy.removeMoney(userId, betAmount, 'dice_loss');
            
            embed.setDescription(`💸 **Perdiste...**`)
                .addFields(
                    { name: '💸 Perdiste', value: `${this.formatNumber(user.balance - betAmount)} C$`, inline: false },
                    { name: '💳 Dinero Apostado', value: `${this.formatNumber(betAmount)} C$`, inline: false }
                );
        }

        await message.reply({ embeds: [embed] });
    }

    // ===================
    // PROCESADOR PRINCIPAL
    // ===================
    
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
            .setDescription('¡Diviértete y gana Clarence Dolars!')
            .setColor('#9932CC')
            .addFields(
                { 
                    name: '🪙 Coinflip', 
                    value: '`mon!coinflip <cara/cruz> <cantidad>`\nApuesta: 50-10,000 C$\nGanancia: x1.95', 
                    inline: false 
                },
                { 
                    name: '🎲 Dados', 
                    value: '`mon!dice <1-6/alto/bajo> <cantidad>`\nApuesta: 50-10,000 C$\nGanancia: x1.9 - x5.8', 
                    inline: false 
                },
                { 
                    name: '🔮 Próximamente', 
                    value: '• Adivinanza (1-100)\n• Blackjack Simple\n• Ruleta\n• Slots', 
                    inline: false 
                }
            )
            .setFooter({ text: 'Juega responsablemente - La casa siempre tiene ventaja' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
}

module.exports = MinigamesSystem;