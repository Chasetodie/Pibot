const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const EventsSystem = require('./events');

// Colores y tipos de cartas UNO
const UNO_COLORS = ['red', 'yellow', 'green', 'blue'];
const UNO_NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const UNO_SPECIAL_CARDS = ['Skip', 'Reverse', '+2'];
const UNO_WILD_CARDS = ['Wild', 'Wild+4'];
const UNO_DARK_CARDS = ['Skip Everyone', '+5', 'Wild Draw Color', 'Wild+6'];
const UNO_FLIP_CARDS = ['Flip'];
const UNO_NO_MERCY_CARDS = ['+6', '+10', 'Wild Draw Until Color', 'Discard All', '+4 Reverse'];

class MinigamesSystem {
    constructor(economySystem, shopSystem, client) {
        this.economy = economySystem;
        this.shop = shopSystem;
        this.client = client;
        this.events = null;
        this.activeGames = new Map(); // Para manejar juegos en progreso
        this.minigamesCache = new Map();
        this.MAX_CACHE_SIZE = 500;
        this.cacheTimeout = 10 * 60 * 1000;

        this.potConfig = {
            minMoney: 1000,
            maxMoney: 500000,
            maxItemsPerUser: 3,
            weekDuration: 7 * 24 * 60 * 60 * 1000 // 7 dias en ms
        };

        setInterval(() => {
            this.checkWeeklyPotExpiry();
        }, 60 * 60 * 1000);
        
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
                cooldown: 900000, // 30 minutos (30 * 60 * 1000)
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
                    green: 37,       // Verde: x37
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
                minPlayers: 2,
                maxPlayers: 6,
                joinTime: 60000, // 1 minuto segundos para unirse
                turnTime: 20000, // 20 segundos por turno
                winnerMultiplier: 0.85 // El ganador se lleva 85% del pot total
            },
            uno: {
                minBet: 100,
                maxBet: 10000,
                minPlayers: 2,
                maxPlayers: 8,
                joinTime: 60000,
                turnTime: 600000,
                winnerMultiplier: 0.95,
                // NUEVO: Variantes disponibles
                variants: {
                    classic: {
                        name: "Clásico",
                        description: "Reglas tradicionales de UNO",
                        emoji: "🎴",
                        rules: {
                            drawUntilPlayable: false,
                            stackDrawCards: false,
                            jumpIn: false,
                            sevenSwap: false,
                            zeroRotation: false,
                            noMercy: false
                        }
                    },
                    flip: {
                        name: "Flip",
                        description: "Con carta Flip que cambia el lado del juego",
                        emoji: "🔄",
                        rules: {
                            drawUntilPlayable: false,
                            stackDrawCards: true,
                            jumpIn: true,
                            hasFlipCards: true,
                            darkSide: false
                        }
                    },
                    noMercy: {
                        name: "No Mercy",
                        description: "Sin piedad - acumula +2 y +4",
                        emoji: "💀",
                        rules: {
                            drawUntilPlayable: true,
                            stackDrawCards: true,
                            jumpIn: true,
                            forcePlay: true
                        }
                    },
                    house: {
                        name: "Reglas de Casa",
                        description: "7 intercambia manos, 0 rota manos",
                        emoji: "🏠",
                        rules: {
                            drawUntilPlayable: false,
                            stackDrawCards: true,
                            jumpIn: true,
                            sevenSwap: true,
                            zeroRotation: true
                        }
                    }
                }
            }
        };
        
        this.cooldowns = new Map(); // Para cooldowns por usuario
    }

    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            
            // Limpiar por tiempo
            for (const [minigamesId, cached] of this.minigamesCache) {
                if (now - cached.timestamp > this.cacheTimeout) {
                    this.minigamesCache.delete(minigamesId);
                }
            }
            
            // Limpiar por tamaño si excede el límite
            if (this.minigamesCache.size > this.MAX_CACHE_SIZE) {
                const entries = Array.from(this.minigamesCache.entries());
                const toDelete = entries
                    .sort((a, b) => a[1].timestamp - b[1].timestamp)
                    .slice(0, entries.length - this.MAX_CACHE_SIZE);
                    
                for (const [minigamesId] of toDelete) {
                    this.minigamesCache.delete(minigamesId);
                }
            }
            
            console.log(`🧹 Cache cleanup: ${this.minigamesCache.size} minijuegos en memoria`);
        }, 10 * 60 * 1000);
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

    formatTimeLeft(milliseconds) {
        const hours = Math.floor(milliseconds / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    // Formatear números
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    getEffectiveCooldown(baseCooldown) {
        let effectiveCooldown = baseCooldown;
        
        for (const event of this.events.getActiveEvents()) {
            if (event.type === 'fever_time') {
                effectiveCooldown = Math.floor(baseCooldown * 0.5); // 🔥 -50% tiempo
                break;
            }
            else if (event.type === 'market_crash') {
                effectiveCooldown = Math.floor(baseCooldown * 0.4); // 🔥 -40% tiempo
                break;
            }
            else if (event.type === 'server_anniversary') {
                effectiveCooldown = Math.floor(baseCooldown * 0.3); // 🔥 -30% tiempo
                break;
            }
        }
        
        return effectiveCooldown;
    }

    async canCoinflip(userId) {
        const user = await this.economy.getUser(userId);

        if (this.shop) {
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.noCooldown) {
                return { canCoinPlay: true };
            }
        }

        const lastCoin = user.last_coinflip || 0;
        const now = Date.now();
        let effectiveCooldown = this.getEffectiveCooldown(this.config.coinflip.cooldown);

        // Aplicar reducción de items
        if (this.shop) {
            const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
            effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
        }

        if (now - lastCoin < effectiveCooldown) {
            const timeLeft = effectiveCooldown - (now - lastCoin);
            return {
                canCoinPlay: false,
                timeLeft: timeLeft
            };
        }

        return { canCoinPlay: true };
    }

    formatGameBonuses(eventMessage, luckMessage, itemMessage, vipMessage) {
        let bonuses = [];
        
        if (eventMessage) bonuses.push(eventMessage);
        if (luckMessage) bonuses.push(luckMessage);
        if (itemMessage) bonuses.push(itemMessage);
        if (vipMessage) bonuses.push(vipMessage);
        
        return bonuses.length > 0 ? bonuses.join('\n') : 'No hay bonificaciones activas';
    }

    async handleCoinflip(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
               
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

        const canCoinResult = await this.canCoinflip(userId);
        if (!canCoinResult.canCoinPlay) {
            await message.reply(`⏰ Debes esperar ${this.formatTime(canCoinResult.timeLeft)} antes de jugar otra vez`);
            return;
        }

        let winChance = 0.5;
        let luckMessages = []; // Array para acumular mensajes

        // 1. Items de suerte
        if (this.shop) {
            const luckBoost = await this.shop.getActiveMultipliers(userId, 'games');
            if (luckBoost.luckBoost) {
                winChance += luckBoost.luckBoost;
                luckMessages.push(`🍀 **Boost de Suerte** (+${Math.round(luckBoost.luckBoost * 100)}% probabilidad)`);
            }
        }

        // 2. Eventos de suerte
        for (const event of this.events.getActiveEvents()) {
            if (event.type === 'lucky_hour') {
                winChance *= 1.3;
                luckMessages.push(`🍀 **Hora de la Suerte** (${Math.round(winChance * 100)}% probabilidad)`);
                break;
            }
        }

        // 3. VIP suerte
        if (this.shop) {
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            winChance += vipMultipliers.luckBoost;
            if (vipMultipliers.luckBoost > 0) {
                luckMessages.push(`💎 **Boost VIP** (+${Math.round(vipMultipliers.luckBoost * 100)}% suerte)`);
                await this.economy.shop.updateVipStats(userId, 'luckyWins', 1);
            }
        }

        // Combinar todos los mensajes de suerte
        const luckMessage = luckMessages.join('\n');

        // Realizar el juego
        const result = Math.random() < winChance ? 'cara' : 'cruz';
        const won = result === normalizedChoice;
        
        // Establecer cooldown
        this.setCooldown(userId, 'coinflip');

        const updateData = {
            last_coinflip: Date.now(),
            stats: {
                ...user.stats,
                games_played: (user.stats.games_played || 0) + 1
            }
        }

        // Crear embed del resultado
        const embed = new EmbedBuilder()
            .setTitle('🪙 Coinflip - Resultado')
            .setColor(won ? '#00FF00' : '#FF0000')
            .setTimestamp();

        if (this.missions) {
            // Siempre actualizar que jugó y apostó
            const gameMissions = await this.missions.updateMissionProgress(userId, 'game_played');
            const betMissions = await this.missions.updateMissionProgress(userId, 'money_bet', betAmount);
            
            let allCompleted = [...gameMissions, ...betMissions];
                        
            if (allCompleted.length > 0) {
                await this.missions.notifyCompletedMissions(message, allCompleted);
            }
        }

        const winAmount = Math.floor(betAmount * this.config.coinflip.winMultiplier);
        let profit = winAmount - betAmount;
        let finalEarnings = profit;
        let eventMessage = '';
        
        if (won) {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_win');
            await this.economy.missions.updateMissionProgress(userId, 'game_won');

            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                
                // Calcular bonus VIP antes de aplicar multiplicador
                const originalProfit = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                const vipBonus = finalEarnings - originalProfit;
                
                // Si hay bonus VIP, actualizar estadísticas
                if (vipBonus > 0) {
                    await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                }
                            
                // Consumir efectos de uso limitado
                await this.shop.consumeItemUse(userId, 'games');
            }
            
            for (const event of this.events.getActiveEvents()) {
                if (event.type === 'fever_time') {
                    finalEarnings = Math.floor(profit * 1.5); // 🔥 +30%
                    eventMessage = `🔥 **Tiempo Fiebre** (+${finalEarnings - profit} π-b$)`;
                    break;
                }
                else if (event.type === 'market_crash') {
                    finalEarnings = Math.floor(profit * 1.5); // 📉 -30%
                    eventMessage = `📉 **Crisis del Mercado** (-${profit - finalEarnings} π-b$)`;
                    break;
                }
                else if (event.type === 'server_anniversary') {
                    finalEarnings = Math.floor(profit * 2);
                    eventMessage = `🎉 **Aniversario del Servidor** (+${finalEarnings - profit} π-b$)`
                }
            }

            const userData = await this.economy.getUser(userId);
            const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(userId) : this.economy.config.maxBalance;

            if (userData.balance + finalEarnings > userLimit) {
                const spaceLeft = userLimit - userData.balance;
                finalEarnings = Math.min(finalEarnings, spaceLeft);
            }
           
            const addResult = await this.economy.addMoney(userId, finalEarnings, 'coinflip_win');
            finalEarnings = addResult.actualAmount; // Usar cantidad real
            
            await this.economy.updateUser(userId, updateData);

            // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_won');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
                await this.achievements.updateStats(userId, 'bet_win', finalEarnings);
            }            

            if (this.missions) {
                let allCompleted = [];

                const winMissions = await this.missions.updateMissionProgress(userId, 'game_won');
                const betWonMissions = await this.missions.updateMissionProgress(userId, 'bet_won');
                const moneyMissions = await this.missions.updateMissionProgress(userId, 'money_earned_today', finalEarnings);
                    
                allCompleted = [...allCompleted, ...winMissions, ...betWonMissions, ...moneyMissions];
                
                if (allCompleted.length > 0) {
                    await this.missions.notifyCompletedMissions(message, allCompleted);
                }
            }

            // Obtener mensajes de items
            let itemMessage = '';
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                if (modifiers.multiplier > 1) {
                    itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                }
            }

            // Combinar todos los mensajes
            let allMessages = [eventMessage, luckMessage, itemMessage].filter(msg => msg !== '');
            let finalMessage = allMessages.length > 0 ? allMessages.join('\n') : 'No hay bonificaciones activas';
          
            embed.setDescription(`🎉 **¡GANASTE!**`)
                .addFields(
                    { name: '🪙 Resultado', value: result === 'cara' ? '🟡 Cara' : '⚪ Cruz', inline: true },
                    { name: '🎯 Tu Elección', value: normalizedChoice === 'cara' ? '🟡 Cara' : '⚪ Cruz', inline: true },
                    { name: '💰 Ganancia', value: `+${this.formatNumber(profit)} π-b$`, inline: true },
                    { name: '💸 Balance Antiguo', value: `${this.formatNumber(user.balance - profit)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '🎉 Bonificaciones', value: this.formatGameBonuses(eventMessage, luckMessage, itemMessage), inline: false }
                );

            if (addResult.hitLimit) {
                const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
                await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
            }
        } else {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss'); 

            const hasProtection = await this.shop.hasGameProtection(userId);
            let protectionMessage = '🛡️ Tu protección evitó la pérdida de dinero!';

            if (hasProtection) {
                // Determinar qué protección se activó
                const user = await this.economy.getUser(userId);
                const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
                
                
                // Verificar health potion específicamente
                if (activeEffects['health_potion']) {
                    protectionMessage = '💊 Tu Poción de Salud te protegió de las penalizaciones!';
                } else if (activeEffects['fortune_shield']) {
                    protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió!';
                } else if (activeEffects['condon_pibe2']) {
                    protectionMessage = '🧃 En hora buena, el Condon usado de Pibe 2 te protegió!';
                }
                
                await message.reply(protectionMessage);
            } else {
                await this.economy.removeMoney(userId, betAmount, 'coinflip_loss');
            }

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
                );

            if (hasProtection) {
                embed.addFields(
                    { name: '🛡️ Protección', value: `${protectionMessage}`, inline: false }
                );
            } else {
                embed.addFields(
                    { name: '💸 Perdiste', value: `${this.formatNumber(betAmount)} π-b$`, inline: true },
                    { name: '💸 Balance Antiguo', value: `${this.formatNumber(user.balance + betAmount)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$`, inline: false }
                );
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

        await message.reply({ embeds: [embed] });
    }

    async canDice(userId) {
        const user = await this.economy.getUser(userId);

        if (this.shop) {
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.noCooldown) {
                return { canDicePlay: true };
            }
        }

        const lastDice = user.last_dice || 0;
        const now = Date.now();
        let effectiveCooldown = this.getEffectiveCooldown(this.config.dice.cooldown);

        // Aplicar reducción de items
        if (this.shop) {
            const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
            effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
        }

        if (now - lastDice < effectiveCooldown) {
            const timeLeft = effectiveCooldown - (now - lastDice);
            return {
                canDicePlay: false,
                timeLeft: timeLeft
            };
        }

        return { canDicePlay: true };
    }

    async handleDice(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);

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

        const canDiceResult = await this.canDice(userId);
        if (!canDiceResult.canDicePlay) {
            await message.reply(`⏰ Debes esperar ${this.formatTime(canDiceResult.timeLeft)} antes de jugar otra vez`);
            return;
        }
        
        // Tirar el dado
        const diceResult = Math.floor(Math.random() * 6) + 1;
        let won = false;
        let baseWon = false;
        let multiplier = 0;
        let winChance = 1;

        // Determinar si ganó y el multiplicador
        if (['1', '2', '3', '4', '5', '6'].includes(prediction)) {
            // Predicción de número exacto
            baseWon = diceResult === parseInt(prediction);
            multiplier = this.config.dice.payouts.exact;
        } else if (['alto', 'high'].includes(prediction)) {
            // Predicción alto (4-6)
            baseWon = diceResult >= 4;
            multiplier = this.config.dice.payouts.high;
        } else if (['bajo', 'low'].includes(prediction)) {
            // Predicción bajo (1-3)
            baseWon = diceResult <= 3;
            multiplier = this.config.dice.payouts.low;
        }

        // Aplicar hora de la suerte
        let luckMessage = '';
        for (const event of this.events.getActiveEvents()) {
            if (event.type === 'lucky_hour') {
                // Si perdió originalmente, dar 30% chance de ganar igual
                if (!baseWon && Math.random() < 0.3) {
                    won = true;
                    luckMessage = `🍀 **Hora de la Suerte** te salvó!`;
                } else if (baseWon) {
                    won = true;
                }
                break;
            }
        }

        // Si no hay hora de la suerte, usar resultado normal
        if (luckMessage === '') {
            won = baseWon;
        }

        // Aplicar efectos de items de suerte
        let luckMessages = [luckMessage].filter(msg => msg !== ''); // Conservar mensaje de eventos
        if (this.shop) {
            const luckBoost = await this.shop.getActiveMultipliers(userId, 'games');
            if (luckBoost.luckBoost > 0) {
                // Para dice, aplicar boost a la probabilidad base
                if (!won && Math.random() < luckBoost.luckBoost) {
                    won = true;
                    luckMessages.push(`🍀 **Boost de Suerte** te dio una segunda oportunidad!`);
                } else if (luckBoost.luckBoost > 0) {
                    luckMessages.push(`🍀 **Boost de Suerte** (+${Math.round(luckBoost.luckBoost * 100)}% probabilidad)`);
                }
            }

            // VIP suerte
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.luckBoost > 0 && !won && Math.random() < vipMultipliers.luckBoost) {
                won = true;
                luckMessages.push(`💎 **Boost VIP** te salvó!`);
                await this.economy.shop.updateVipStats(userId, 'luckyWins', 1);
            }
        }

        // Combinar todos los mensajes de suerte
        luckMessage = luckMessages.join('\n');

        // Establecer cooldown
        this.setCooldown(userId, 'dice');
        
        const updateData = {
            last_dice: Date.now(),
            stats: {
                ...user.stats,
                games_played: (user.stats.games_played || 0) + 1
            }        
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

        if (this.missions) {
            // Siempre actualizar que jugó y apostó
            const gameMissions = await this.missions.updateMissionProgress(userId, 'game_played');
            const betMissions = await this.missions.updateMissionProgress(userId, 'money_bet', betAmount);
            
            let allCompleted = [...gameMissions, ...betMissions];
                        
            if (allCompleted.length > 0) {
                await this.missions.notifyCompletedMissions(message, allCompleted);
            }
        }

        const winAmount = Math.floor(betAmount * multiplier);
        const profit = winAmount - betAmount;
        let finalEarnings = profit;
        let eventMessage = '';
        
        if (won) {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_win');
            await this.economy.missions.updateMissionProgress(userId, 'game_won');

            for (const event of this.events.getActiveEvents()) {
                if (event.type === 'fever_time') {
                    finalEarnings = Math.floor(profit * 1.5); // 🔥 +30%
                    eventMessage = `🔥 **Tiempo Fiebre** (+${finalEarnings - profit} π-b$)`;
                    break;
                }
                else if (event.type === 'market_crash') {
                    finalEarnings = Math.floor(profit * 1.5); // 📉 -30%
                    eventMessage = `📉 **Crisis del Mercado** (-${profit - finalEarnings} π-b$)`;
                    break;
                }
                else if (event.type === 'server_anniversary') {
                    finalEarnings = Math.floor(profit * 2);
                    eventMessage = `🎉 **Aniversario del Servidor** (+${finalEarnings - profit} π-b$)`
                }
            }

            // Aplicar multiplicadores de items DESPUÉS de los eventos
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                
                // Calcular bonus VIP antes de aplicar multiplicador
                const originalProfit = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                const vipBonus = finalEarnings - originalProfit;
                
                // Si hay bonus VIP, actualizar estadísticas
                if (vipBonus > 0) {
                    await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                }
                            
                // Consumir efectos de uso limitado
                await this.shop.consumeItemUse(userId, 'games');
            }

            let itemMessage = '';
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                if (modifiers.multiplier > 1) {
                    itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                }
            }

            const userData = await this.economy.getUser(userId);
            const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(userId) : this.economy.config.maxBalance;

            if (userData.balance + finalEarnings > userLimit) {
                const spaceLeft = userLimit - userData.balance;
                finalEarnings = Math.min(finalEarnings, spaceLeft);
            }
                       
            const addResult = await this.economy.addMoney(userId, finalEarnings, 'dice_win');
            finalEarnings = addResult.actualAmount;
            await this.economy.updateUser(userId, updateData);

            // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_won');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
                await this.achievements.updateStats(userId, 'bet_win', finalEarnings);
            }

            if (this.missions) {
                let allCompleted = [];

                const winMissions = await this.missions.updateMissionProgress(userId, 'game_won');
                const betWonMissions = await this.missions.updateMissionProgress(userId, 'bet_won');
                const moneyMissions = await this.missions.updateMissionProgress(userId, 'money_earned_today', finalEarnings);
                    
                allCompleted = [...allCompleted, ...winMissions, ...betWonMissions, ...moneyMissions];
                
                if (allCompleted.length > 0) {
                    await this.missions.notifyCompletedMissions(message, allCompleted);
                }
            }

            let finalMessage = ''

            if (eventMessage === '')
                finalMessage = luckMessage;
            else if (luckMessage === '')
                finalMessage = eventMessage;
            else if (luckMessage === '' && eventMessage === '')
                finalMessage = '';
            else
                finalMessage = eventMessage + "\n" + luckMessage;
            
            embed.setDescription(`🎉 **¡GANASTE!**`)
                .addFields(
                    { name: '💰 Multiplicador', value: `x${multiplier}`, inline: true },
                    { name: '💰 Ganancia', value: `+${this.formatNumber(profit)} π-b$`, inline: false },
                    { name: '💸 Balance Antiguo', value: `${this.formatNumber(user.balance - profit)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '🎉 Bonificaciones', value: this.formatGameBonuses(eventMessage, luckMessage, itemMessage), inline: false }
                );
            if (addResult.hitLimit) {
                const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
                await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
            }
        } else {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss'); 

            const hasProtection = await this.shop.hasGameProtection(userId);
            if (hasProtection) {
                let protectionMessage = '🛡️ Tu protección evitó la pérdida de dinero!';
                
                const user = await this.economy.getUser(userId);
                const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
                
                if (activeEffects['health_potion']) {
                    protectionMessage = '💊 Tu Poción de Salud te protegió!';
                } else if (activeEffects['fortune_shield']) {
                    protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió!';
                }
                
                await message.reply(protectionMessage);
            } else {
                await this.economy.removeMoney(userId, betAmount, 'dice_loss');
            }
            
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
                    { name: '💸 Balance Antiguo', value: `${this.formatNumber(user.balance + betAmount)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                );
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

        await message.reply({ embeds: [embed] });
    }

    async canLottery(userId) {
        const user = await this.economy.getUser(userId);

        if (this.shop) {
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.noCooldown) {
                return { canLottery: true };
            }
        }

        const lastLottery = user.last_lotto || 0;
        const now = Date.now();
        let effectiveCooldown = this.getEffectiveCooldown(this.config.lottery.cooldown);

        // Aplicar reducción de items
        if (this.shop) {
            const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
            effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
        }

        if (now - lastLottery < effectiveCooldown) {
            const timeLeft = effectiveCooldown - (now - lastLottery);
            return {
                canLottery: false,
                timeLeft: timeLeft
            };
        }

        return { canLottery: true };
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
                    { name: '⏰ Cooldown', value: '15 minutos', inline: false }
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
    
        const canLotteryResult = await this.canLottery(userId);
        if (!canLotteryResult.canLottery) {
            await message.reply(`⏰ Debes esperar ${this.formatTime(canLotteryResult.timeLeft)} antes de jugar otra vez`);  
            return;
        }
        
        // Generar número ganador
        const winningNumber = Math.floor(Math.random() * this.config.lottery.maxNumber) + this.config.lottery.minNumber;
        let won = winningNumber === predictedNumber;
        let luckMessage = '';

        // Aplicar hora de la suerte
        for (const event of this.events.getActiveEvents()) {
            if (event.type === 'lucky_hour') {
                // Si perdió originalmente, dar 30% chance de ganar igual
                if (!won && Math.random() < 0.3) {
                    won = true;
                    luckMessage = `🍀 **Hora de la Suerte** te dio una segunda oportunidad!`;
                }
                break;
            }
        }

        // Aplicar efectos de items de suerte
        let luckMessages = [luckMessage].filter(msg => msg !== ''); // Conservar mensaje de eventos
        if (this.shop) {
            const luckBoost = await this.shop.getActiveMultipliers(userId, 'games');
            if (luckBoost.luckBoost > 0) {
                // Para dice, aplicar boost a la probabilidad base
                if (!won && Math.random() < luckBoost.luckBoost) {
                    won = true;
                    luckMessages.push(`🍀 **Boost de Suerte** te dio una segunda oportunidad!`);
                } else if (luckBoost.luckBoost > 0) {
                    luckMessages.push(`🍀 **Boost de Suerte** (+${Math.round(luckBoost.luckBoost * 100)}% probabilidad)`);
                }
            }

            // VIP suerte
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.luckBoost > 0 && !won && Math.random() < vipMultipliers.luckBoost) {
                won = true;
                luckMessages.push(`💎 **Boost VIP** te salvó!`);
                await this.economy.shop.updateVipStats(userId, 'luckyWins', 1);
            }
        }

        // Combinar todos los mensajes de suerte
        luckMessage = luckMessages.join('\n');
        
        // Establecer cooldown
        this.setCooldown(userId, 'lottery');
        
        const updateData = {
            last_lotto: Date.now(),
            stats: {
                ...user.stats,
                games_played: (user.stats.games_played || 0) + 1
            }
        };

        await this.economy.updateUser(userId, updateData);
    
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

            if (this.missions) {
                // Siempre actualizar que jugó y apostó
                const gameMissions = await this.missions.updateMissionProgress(userId, 'game_played');
                const betMissions = await this.missions.updateMissionProgress(userId, 'money_bet', betAmount);
                
                let allCompleted = [...gameMissions, ...betMissions];
                            
                if (allCompleted.length > 0) {
                    await this.missions.notifyCompletedMissions(message, allCompleted);
                }
            }

            const winAmount = betAmount * this.config.lottery.winMultiplier;
            const profit = winAmount - betAmount;

            let finalEarnings = profit;
            let eventMessage = '';
        
        if (won) {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_win');
            await this.economy.missions.updateMissionProgress(userId, 'game_won');

            for (const event of this.events.getActiveEvents()) {
                if (event.type === 'fever_time') {
                    finalEarnings = Math.floor(profit * 1.5); // 🔥 +30%
                    eventMessage = `🔥 **Tiempo Fiebre** (+${finalEarnings - profit} π-b$)`;
                    break;
                }
                else if (event.type === 'market_crash') {
                    finalEarnings = Math.floor(profit * 1.5); // 📉 -30%
                    eventMessage = `📉 **Crisis del Mercado** (-${profit - finalEarnings} π-b$)`;
                    break;
                }
                else if (event.type === 'server_anniversary') {
                    finalEarnings = Math.floor(profit * 2);
                    eventMessage = `🎉 **Aniversario del Servidor** (+${finalEarnings - profit} π-b$)`
                }
            }

            // Aplicar multiplicadores de items DESPUÉS de los eventos
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                
                // Calcular bonus VIP antes de aplicar multiplicador
                const originalProfit = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                const vipBonus = finalEarnings - originalProfit;
                
                // Si hay bonus VIP, actualizar estadísticas
                if (vipBonus > 0) {
                    await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                }
                            
                // Consumir efectos de uso limitado
                await this.shop.consumeItemUse(userId, 'games');
            }

            // Obtener mensajes de items
            let itemMessage = '';
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                if (modifiers.multiplier > 1) {
                    itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                }
            }

            const userData = await this.economy.getUser(userId);
            const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(userId) : this.economy.config.maxBalance;

            if (userData.balance + finalEarnings > userLimit) {
                const spaceLeft = userLimit - userData.balance;
                finalEarnings = Math.min(finalEarnings, spaceLeft);
            }
            
            const addResult = await this.economy.addMoney(userId, finalEarnings, 'lottery_win');     
            finalEarnings = addResult.actualAmount;
            
            // AGREGAR ESTAS LÍNEAS:
            const updateDataLottery = {
                stats: {
                    ...user.stats,
                    lottery_wins: (user.stats.lottery_wins || 0) + 1  // ← NUEVA LÍNEA
                }
            };       
            await this.economy.updateUser(userId, updateDataLottery);

            // *** ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_won');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
                await this.achievements.updateStats(userId, 'bet_win', finalEarnings);
            }

            if (this.missions) {
                let allCompleted = [];

                const winMissions = await this.missions.updateMissionProgress(userId, 'game_won');
                const betWonMissions = await this.missions.updateMissionProgress(userId, 'bet_won');
                const moneyMissions = await this.missions.updateMissionProgress(userId, 'money_earned_today', finalEarnings);
                    
                allCompleted = [...allCompleted, ...winMissions, ...betWonMissions, ...moneyMissions];
                
                if (allCompleted.length > 0) {
                    await this.missions.notifyCompletedMissions(message, allCompleted);
                }
            }

            let finalMessage = ''

            if (eventMessage === '')
                finalMessage = luckMessage;
            else if (luckMessage === '')
                finalMessage = eventMessage;
            else if (luckMessage === '' && eventMessage === '')
                finalMessage = '';
            else
                finalMessage = eventMessage + "\n" + luckMessage;

            
            resultEmbed.setDescription(`🎉 **¡JACKPOT! ¡GANASTE LA LOTERÍA!** 🎉`)
                .addFields(
                    { name: '🎊 ¡Increíble!', value: `¡Acertaste el número exacto!`, inline: false },
                    { name: '💎 Multiplicador', value: `x${this.config.lottery.winMultiplier}`, inline: true },
                    { name: '🤑 Ganancia Total', value: `+${this.formatNumber(profit)} π-b$`, inline: true },
                    { name: '💸 Balance Anterior', value: `${this.formatNumber(user.balance - profit)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$ 🚀`, inline: false },
                    { name: '🎉 Bonificaciones', value: this.formatGameBonuses(eventMessage, luckMessage, itemMessage), inline: false }
                );
            if (addResult.hitLimit) {
                const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
                await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
            }
        } else {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss'); 
            
            const hasProtection = await this.shop.hasGameProtection(userId);
            if (hasProtection) {
                let protectionMessage = '🛡️ Tu protección evitó la pérdida de dinero!';
                
                const user = await this.economy.getUser(userId);
                const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
                
                if (activeEffects['health_potion']) {
                    protectionMessage = '💊 Tu Poción de Salud te protegió!';
                } else if (activeEffects['fortune_shield']) {
                    protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió!';
                }
                
                await message.reply(protectionMessage);
            } else {
                await this.economy.removeMoney(userId, betAmount, 'lottery');
            }
            
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
                    { name: '💸 Balance Anterior', value: `${this.formatNumber(user.balance + betAmount)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '💡 Consejo', value: 'La lotería es pura suerte. ¡Cada número tiene la misma probabilidad!', inline: false }
                );
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
    
        await reply.edit({ embeds: [resultEmbed] });
    }

    async canBlackJack(userId) {
        const user = await this.economy.getUser(userId);

        if (this.shop) {
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.noCooldown) {
                return { canBlackJack: true };
            }
        }

        const lastBlackJack = user.last_blackjack || 0;
        const now = Date.now();
        let effectiveCooldown = this.getEffectiveCooldown(this.config.blackjack.cooldown);

        // Aplicar reducción de items
        if (this.shop) {
            const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
            effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
        }

        if (now - lastBlackJack < effectiveCooldown) {
            const timeLeft = effectiveCooldown - (now - lastBlackJack);
            return {
                canBlackJack: false,
                timeLeft: timeLeft
            };
        }

        return { canBlackJack: true };
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
                .setFooter({ text: 'Cooldown: 3 minutos. En este juego no se aplican items de suerte.' });
            
            await message.reply({ embeds: [embed] });
            return;
        }
    
        const betAmount = parseInt(args[1]);
    
        // Validar cantidad de apuesta
        if (isNaN(betAmount) || betAmount < this.config.blackjack.minBet || betAmount > this.config.blackjack.maxBet) {
            console.log(`[BJ DEBUG 4] Apuesta inválida`);
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.blackjack.minBet)} y ${this.formatNumber(this.config.blackjack.maxBet)} π-b$`);
            return;
        }
    
        // Verificar fondos
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes π-b Coins. Tu balance: ${this.formatNumber(user.balance)} π-b$`);
            return;
        }
    
        const canBlackJackResult = await this.canBlackJack(userId);
        if (!canBlackJackResult.canBlackJack) {
            await message.reply(`⏰ Debes esperar ${this.formatTime(canBlackJackResult.timeLeft)} antes de jugar otra vez`);
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

        if (this.missions) {
            // Siempre actualizar que jugó y apostó
            const gameMissions = await this.missions.updateMissionProgress(gameState.userId, 'game_played');
            const betMissions = await this.missions.updateMissionProgress(gameState.userId, 'money_bet', betAmount);
            
            let allCompleted = [...gameMissions, ...betMissions];
                        
            if (allCompleted.length > 0) {
                await this.missions.notifyCompletedMissions(message, allCompleted);
            }
        }
    
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
        console.log(`${messageOrInteraction}`);
        gameState.finished = true;
        this.activeGames.delete(`blackjack_${gameState.userId}`);
        
        const { userId, betAmount, playerHand, dealerHand, doubled } = gameState;
        const user = await this.economy.getUser(userId);
        
        const finalBet = doubled ? betAmount * 2 : betAmount;
        const playerValue = this.calculateHandValue(playerHand);
        const dealerValue = this.calculateHandValue(dealerHand);
        
        this.setCooldown(userId, 'blackjack');
        
        const updateData = {
            last_blackjack: Date.now(),
            stats: {
                ...user.stats,
                games_played: (user.stats.games_played || 0) + 1
            }
        };
        
        let profit = 0;
        let resultText = '';
        let color = '#FF0000';

        let finalEarnings = 0;
        let eventMessage = '';
        let itemMessage = '';
        const hasProtection = await this.shop.hasGameProtection(userId);;

        let addResult;
        let userData;
        
        switch (result) {
            case 'blackjack':
                await this.economy.missions.updateMissionProgress(userId, 'consecutive_win');
                await this.economy.missions.updateMissionProgress(userId, 'game_won');
                
                const blackjackWin = Math.floor(betAmount * this.config.blackjack.blackjackMultiplier);
                profit = blackjackWin - betAmount;
                resultText = '🎉 **¡BLACKJACK NATURAL!**';
                color = '#00FF00';

                finalEarnings = profit

                for (const event of this.events.getActiveEvents()) {
                    if (event.type === 'fever_time') {
                        finalEarnings = Math.floor(profit * 1.5); // 🔥 +30%
                        eventMessage = `🔥 **Tiempo Fiebre** (+${finalEarnings - profit} π-b$)`;
                        break;
                    }
                    else if (event.type === 'market_crash') {
                        finalEarnings = Math.floor(profit * 1.5); // 📉 -30%
                        eventMessage = `📉 **Crisis del Mercado** (-${profit - finalEarnings} π-b$)`;
                        break;
                    }
                    else if (event.type === 'server_anniversary') {
                        finalEarnings = Math.floor(profit * 2);
                        eventMessage = `🎉 **Aniversario del Servidor** (+${finalEarnings - profit} π-b$)`
                    }
                }

                if (this.shop) {
                    const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                    
                    // Calcular bonus VIP antes de aplicar multiplicador
                    const originalProfit = finalEarnings;
                    finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                    const vipBonus = finalEarnings - originalProfit;
                    
                    // Si hay bonus VIP, actualizar estadísticas
                    if (vipBonus > 0) {
                        await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                    }
                                
                    // Consumir efectos de uso limitado
                    await this.shop.consumeItemUse(userId, 'games');
                }

                // Obtener mensajes de items
                if (this.shop) {
                    const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                    if (modifiers.multiplier > 1) {
                        itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                    }
                }

                userData = await this.economy.getUser(userId);
                if (userData.balance + finalEarnings > this.economy.config.maxBalance) {
                    const spaceLeft = this.economy.config.maxBalance - userData.balance;
                    finalEarnings = Math.min(finalEarnings, spaceLeft);
                }

                addResult = await this.economy.addMoney(userId, finalEarnings, 'blackjack_win');
                finalEarnings = addResult.actualAmount;
                
                // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
                if (this.achievements) {
                    await this.achievements.updateStats(userId, 'game_played');
                    await this.achievements.updateStats(userId, 'game_won');
                    await this.achievements.updateStats(userId, 'money_bet', finalBet);
                    await this.achievements.updateStats(userId, 'bet_win', finalEarnings);
                }

                if (this.missions) {
                    let allCompleted = [];

                    const winMissions = await this.missions.updateMissionProgress(userId, 'game_won');
                    const betWonMissions = await this.missions.updateMissionProgress(userId, 'bet_won');
                    const moneyMissions = await this.missions.updateMissionProgress(userId, 'money_earned_today', finalEarnings);
                        
                    allCompleted = [...allCompleted, ...winMissions, ...betWonMissions, ...moneyMissions];
                    
                    if (allCompleted.length > 0) {
                        await this.missions.notifyCompletedMissions(messageOrInteraction, allCompleted);
                    }
                }                
                break;
            case 'win':
            case 'dealer_bust':
                await this.economy.missions.updateMissionProgress(userId, 'consecutive_win');
                await this.economy.missions.updateMissionProgress(userId, 'game_won');
                
                const normalWin = finalBet * this.config.blackjack.winMultiplier;
                profit = normalWin - finalBet;
                resultText = result === 'dealer_bust' ? '🎉 **¡DEALER SE PASÓ!**' : '🎉 **¡GANASTE!**';
                color = '#00FF00';

                finalEarnings = profit

                for (const event of this.events.getActiveEvents()) {
                    if (event.type === 'fever_time') {
                        finalEarnings = Math.floor(profit * 1.5); // 🔥 +30%
                        eventMessage = `🔥 **Tiempo Fiebre** (+${finalEarnings - profit} π-b$)`;
                        break;
                    }
                    else if (event.type === 'market_crash') {
                        finalEarnings = Math.floor(profit * 1.5); // 📉 -30%
                        eventMessage = `📉 **Crisis del Mercado** (-${profit - finalEarnings} π-b$)`;
                        break;
                    }
                    else if (event.type === 'server_anniversary') {
                        finalEarnings = Math.floor(profit * 2);
                        eventMessage = `🎉 **Aniversario del Servidor** (+${finalEarnings - profit} π-b$)`
                    }
                }

                // Aplicar multiplicadores de items DESPUÉS de los eventos
                if (this.shop) {
                    const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                    
                    // Calcular bonus VIP antes de aplicar multiplicador
                    const originalProfit = finalEarnings;
                    finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                    const vipBonus = finalEarnings - originalProfit;
                    
                    // Si hay bonus VIP, actualizar estadísticas
                    if (vipBonus > 0) {
                        await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                    }
                                
                    // Consumir efectos de uso limitado
                    await this.shop.consumeItemUse(userId, 'games');
                }

                if (this.shop) {
                    const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                    if (modifiers.multiplier > 1) {
                        itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                    }
                }

                userData = await this.economy.getUser(userId);
                if (userData.balance + finalEarnings > this.economy.config.maxBalance) {
                    const spaceLeft = this.economy.config.maxBalance - userData.balance;
                    finalEarnings = Math.min(finalEarnings, spaceLeft);
                }
                
                addResult = await this.economy.addMoney(userId, finalEarnings, 'blackjack_win');
                finalEarnings = addResult.actualAmount;
                
                // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
                if (this.achievements) {
                    await this.achievements.updateStats(userId, 'game_played');
                    await this.achievements.updateStats(userId, 'game_won');
                    await this.achievements.updateStats(userId, 'money_bet', finalBet);
                    await this.achievements.updateStats(userId, 'bet_win', finalEarnings);
                }

                if (this.missions) {
                    let allCompleted = [];

                    const winMissions = await this.missions.updateMissionProgress(userId, 'game_won');
                    const betWonMissions = await this.missions.updateMissionProgress(userId, 'bet_won');
                    const moneyMissions = await this.missions.updateMissionProgress(userId, 'money_earned_today', finalEarnings);
                        
                    allCompleted = [...allCompleted, ...winMissions, ...betWonMissions, ...moneyMissions];
                    
                    if (allCompleted.length > 0) {
                        await this.missions.notifyCompletedMissions(messageOrInteraction, allCompleted);
                    }
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
                await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss'); 

                resultText = '💥 **¡TE PASASTE!**';
                profit = -finalBet;

                if (hasProtection) {
                    let protectionMessage = '🛡️ Tu protección evitó la pérdida de dinero!';
                    
                    const user = await this.economy.getUser(userId);
                    const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
                    
                    if (activeEffects['health_potion']) {
                        protectionMessage = '💊 Tu Poción de Salud te protegió!';
                    } else if (activeEffects['fortune_shield']) {
                        protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió!';
                    }
                    
                    await message.reply(protectionMessage);
                } else {
                    await this.economy.removeMoney(userId, finalBet, 'blackjack_loss');
                }

                // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
                if (this.achievements) {
                    await this.achievements.updateStats(userId, 'game_played');
                    await this.achievements.updateStats(userId, 'game_lost');
                    await this.achievements.updateStats(userId, 'money_bet', finalBet);
                }
                break;
            case 'lose':
                await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss'); 

                resultText = '💸 **Perdiste...**';
                profit = -finalBet;

                if (hasProtection) {
                    let protectionMessage = '🛡️ Tu protección evitó la pérdida de dinero!';
                    
                    const user = await this.economy.getUser(userId);
                    const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
                    
                    if (activeEffects['health_potion']) {
                        protectionMessage = '💊 Tu Poción de Salud te protegió!';
                    } else if (activeEffects['fortune_shield']) {
                        protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió!';
                    }
                    
                    await message.reply(protectionMessage);
                } else {
                    await this.economy.removeMoney(userId, finalBet, 'blackjack_loss');
                }

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
                },
            );
    
        if (profit > 0) {
            embed.addFields(
                { name: '💰 Ganancia', value: `+${this.formatNumber(profit)} π-b$`, inline: true },
                { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$`, inline: true },
                { name: '🎉 Bonificaciones', value: this.formatGameBonuses(eventMessage, '', itemMessage), inline: false }
            );
        } else if (profit < 0) {
            embed.addFields(
                { name: '💸 Perdiste', value: `${this.formatNumber(Math.abs(profit))} π-b$`, inline: true },
                { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$`, inline: true }
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

        if (addResult && addResult.hitLimit) {
            const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
            await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
        }

        // Verificar tesoros al final
        for (const event of this.events.getActiveEvents()) {
            if (event.type === 'treasure_hunt') {
                const treasures = await this.events.checkSpecialEvents(userId, 'general');
                    
                for (const treasure of treasures) {
                    if (treasure.type === 'treasure') {
                        messageOrInteraction.reply(`🗺️ **¡Tesoro encontrado!**\n${treasure.description}`);
                    }
                }
                break;
            }
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

    async canRoulette(userId) {
        const user = await this.economy.getUser(userId);

        if (this.shop) {
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.noCooldown) {
                return { canRoulette: true };
            }
        }

        const lastRoulette = user.last_roulette || 0;
        const now = Date.now();
        let effectiveCooldown = this.getEffectiveCooldown(this.config.roulette.cooldown);

        // Aplicar reducción de items
        if (this.shop) {
            const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
            effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
        }

        if (now - lastRoulette < effectiveCooldown) {
            const timeLeft = effectiveCooldown - (now - lastRoulette);
            return {
                canRoulette: false,
                timeLeft: timeLeft
            };
        }

        return { canRoulette: true };
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
                        value: '**Números:** `0-36` (x35)\n**Colores:** `rojo`, `negro` (x1.95)\n**Verde:** `verde` (x37)\n**Paridad:** `par`, `impar` (x1.95)\n**Rango:** `bajo` (1-18), `alto` (19-36) (x1.95)\n**Docenas:** `1era`, `2da`, `3era` (x2.9)\n**Columnas:** `col1`, `col2`, `col3` (x2.9)', 
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
    
        const canRouletteResult = await this.canRoulette(userId);
        if (!canRouletteResult.canRoulette) {
            await message.reply(`⏰ Debes esperar ${this.formatTime(canRouletteResult.timeLeft)} antes de jugar otra vez`);
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
        let won = this.checkRouletteWin(validBet, spinResult);
        let luckMessage = '';

        // Aplicar hora de la suerte
        for (const event of this.events.getActiveEvents()) {
            if (event.type === 'lucky_hour') {
                // Si perdió originalmente, dar 30% chance de ganar igual
                if (!won && Math.random() < 0.3) {
                    won = true;
                    luckMessage = `🍀 **Hora de la Suerte** cambió tu destino!`;
                }
                break;
            }
        }
        
        // Aplicar efectos de items de suerte
        let luckMessages = [luckMessage].filter(msg => msg !== ''); // Conservar mensaje de eventos
        if (this.shop) {
            const luckBoost = await this.shop.getActiveMultipliers(userId, 'games');
            if (luckBoost.luckBoost > 0) {
                // Para dice, aplicar boost a la probabilidad base
                if (!won && Math.random() < luckBoost.luckBoost) {
                    won = true;
                    luckMessages.push(`🍀 **Boost de Suerte** te dio una segunda oportunidad!`);
                } else if (luckBoost.luckBoost > 0) {
                    luckMessages.push(`🍀 **Boost de Suerte** (+${Math.round(luckBoost.luckBoost * 100)}% probabilidad)`);
                }
            }

            // VIP suerte
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.luckBoost > 0 && !won && Math.random() < vipMultipliers.luckBoost) {
                won = true;
                luckMessages.push(`💎 **Boost VIP** te salvó!`);
                await this.economy.shop.updateVipStats(userId, 'luckyWins', 1);
            }
        }

        // Combinar todos los mensajes de suerte
        luckMessage = luckMessages.join('\n');

        // Establecer cooldown
        this.setCooldown(userId, 'roulette');
    
        const updateData = {
            last_roulette: Date.now(),
            stats: {
                ...user.stats,
                games_played: (user.stats.games_played || 0) + 1
            }
        };

        await this.economy.updateUser(userId, updateData);
    
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

            if (this.missions) {
                // Siempre actualizar que jugó y apostó
                const gameMissions = await this.missions.updateMissionProgress(userId, 'game_played');
                const betMissions = await this.missions.updateMissionProgress(userId, 'money_bet', betAmount);
                
                let allCompleted = [...gameMissions, ...betMissions];
                            
                if (allCompleted.length > 0) {
                    await this.missions.notifyCompletedMissions(message, allCompleted);
                }
            }
        
            const multiplier = this.config.roulette.payouts[validBet.type];
            const winAmount = Math.floor(betAmount * multiplier);
            const profit = winAmount - betAmount;

            let finalEarnings = profit;
            let eventMessage = '';
        
        if (won) {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_win');
            await this.economy.missions.updateMissionProgress(userId, 'game_won');

            for (const event of this.events.getActiveEvents()) {
                if (event.type === 'fever_time') {
                    finalEarnings = Math.floor(profit * 1.5); // 🔥 +30%
                    eventMessage = `🔥 **Tiempo Fiebre** (+${finalEarnings - profit} π-b$)`;
                    break;
                }
                else if (event.type === 'market_crash') {
                    finalEarnings = Math.floor(profit * 1.5); // 📉 -30%
                    eventMessage = `📉 **Crisis del Mercado** (-${profit - finalEarnings} π-b$)`;
                    break;
                }
                else if (event.type === 'server_anniversary') {
                    finalEarnings = Math.floor(profit * 2);
                    eventMessage = `🎉 **Aniversario del Servidor** (+${finalEarnings - profit} π-b$)`
                }
            }

            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                
                // Calcular bonus VIP antes de aplicar multiplicador
                const originalProfit = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                const vipBonus = finalEarnings - originalProfit;
                
                // Si hay bonus VIP, actualizar estadísticas
                if (vipBonus > 0) {
                    await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                }
                            
                // Consumir efectos de uso limitado
                await this.shop.consumeItemUse(userId, 'games');
            }

            // AQUÍ VA EL CÓDIGO QUE PREGUNTAS:
            // Obtener mensajes de items
            let itemMessage = '';
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                if (modifiers.multiplier > 1) {
                    itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                }
            }

            const userData = await this.economy.getUser(userId);
            const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(userId) : this.economy.config.maxBalance;

            if (userData.balance + finalEarnings > userLimit) {
                const spaceLeft = userLimit - userData.balance;
                finalEarnings = Math.min(finalEarnings, spaceLeft);
            }
            
            const addResult = await this.economy.addMoney(userId, finalEarnings, 'roulette_win');
            finalEarnings = addResult.actualAmount;
            
            await this.economy.updateUser(userId, updateData);
    
            // *** ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_won');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
                await this.achievements.updateStats(userId, 'bet_win', finalEarnings);
            }

            if (this.missions) {
                let allCompleted = [];

                const winMissions = await this.missions.updateMissionProgress(userId, 'game_won');
                const betWonMissions = await this.missions.updateMissionProgress(userId, 'bet_won');
                const moneyMissions = await this.missions.updateMissionProgress(userId, 'money_earned_today', finalEarnings);
                    
                allCompleted = [...allCompleted, ...winMissions, ...betWonMissions, ...moneyMissions];
                
                if (allCompleted.length > 0) {
                    await this.missions.notifyCompletedMissions(message, allCompleted);
                }
            }

            let finalMessage = ''

            if (eventMessage === '')
                finalMessage = luckMessage;
            else if (luckMessage === '')
                finalMessage = eventMessage;
            else if (luckMessage === '' && eventMessage === '')
                finalMessage = '';
            else
                finalMessage = eventMessage + "\n" + luckMessage;
            
            resultEmbed.setDescription(`🎉 **¡GANASTE!**`)
                .addFields(
                    { name: '🎊 ¡Felicidades!', value: `¡Tu apuesta fue correcta!`, inline: false },
                    { name: '💎 Multiplicador', value: `x${multiplier}`, inline: true },
                    { name: '🤑 Ganancia Total', value: `+${this.formatNumber(profit)} π-b$`, inline: true },
                    { name: '💸 Balance Anterior', value: `${this.formatNumber(user.balance - profit)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$ 🚀`, inline: false },
                    { name: '🎉 Bonificaciones', value: this.formatGameBonuses(eventMessage, luckMessage, itemMessage), inline: false }
                );
    
            // Mensaje especial para números exactos
            if (validBet.type === 'straight') {
                resultEmbed.addFields({ 
                    name: '🌟 ¡Número Exacto!', 
                    value: '¡Increíble suerte! Acertaste el número exacto.', 
                    inline: false 
                });
            } 

            if (addResult.hitLimit) {
                const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
                await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
            }
        } else {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss'); 

            const hasProtection = await this.shop.hasGameProtection(userId);
            if (hasProtection) {
                let protectionMessage = '🛡️ Tu protección evitó la pérdida de dinero!';
                
                const user = await this.economy.getUser(userId);
                const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
                
                if (activeEffects['health_potion']) {
                    protectionMessage = '💊 Tu Poción de Salud te protegió!';
                } else if (activeEffects['fortune_shield']) {
                    protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió!';
                }
                
                await message.reply(protectionMessage);
            } else {
                await this.economy.removeMoney(userId, betAmount, 'roulette_loss');
            }
            
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
                    { name: '💸 Balance Anterior', value: `${this.formatNumber(user.balance + betAmount)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '💡 Consejo', value: 'En la ruleta, cada giro es independiente. ¡No te rindas!', inline: false }
                );
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
            'verde': { type: 'green', displayName: '🟢 Verde'},
            'green': { type: 'green', displayName: '🟢 Verde'},
            
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
            case 'green':
                return color === 'green';
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

    async getRussianGame(gameId) {
        try {
            return await this.economy.database.getRussianGame(gameId);
        } catch (error) {
            console.error('⚠️ Error obteniendo partida:', error);
            return null;
        }
    }

    async createRussianGameInDB(gameId, gameData) {
        try {
            return await this.economy.database.createRussianGame(gameId, gameData);
        } catch (error) {
            console.error('⚠️ Error creando partida:', error);
            throw error;
        }
    }

    async updateRussianGame(gameId, updateData) {
        try {
            await this.economy.database.updateRussianGame(gameId, updateData);
        } catch (error) {
            console.error('⚠️ Error actualizando partida:', error);
        }
    }

    async deleteRussianGame(gameId) {
        try {
            await this.economy.database.deleteRussianGame(gameId);
        } catch (error) {
            console.error('⚠️ Error eliminando partida:', error);
        }
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
                .setFooter({ text: '⚠️ Juego de alto riesgo - Solo para valientes. En este minijuego no se aplica el efecto de ningun item.' });
            
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

        if (this.missions) {
            // Siempre actualizar que jugó y apostó
            const gameMissions = await this.missions.updateMissionProgress(userId, 'game_played');
            const betMissions = await this.missions.updateMissionProgress(userId, 'money_bet', betAmount);
            
            let allCompleted = [...gameMissions, ...betMissions];

            if (allCompleted.length > 0) {
                await this.missions.notifyCompletedMissions(message, allCompleted);
            }
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
            id: gameKey,
            channel_id: channelId,
            creator_id: userId,
            bet_amount: betAmount,
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
            current_player_index: 0,
            bullet_position: 0, // Se determinará cuando inicie el juego
            current_shot: 0,
            pot: betAmount,
            start_time: Date.now(),
            join_start_time: Date.now(),
            turn_timeout: null,
            join_timeout: null,
            manual_start: false
        };

        await this.createRussianGameInDB(gameKey, game);
    
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
                { name: '🚀 Para Iniciar', value: `\`>startrussian\` (solo el creador)`, inline: true }, // ← NUEVO
                { name: '❌ Para Cancelar', value: `\`>cancelrussian\` (solo el creador)`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'El creador puede iniciar con >startrussian cuando haya mínimo 2 jugadores' });
    
        const reply = await message.reply({ embeds: [embed] });
        game.message_id = reply.id;
    
        // Timer para iniciar el juego automáticamente
/*        game.join_timeout = setTimeout(async () => {
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
        if (betAmount !== game.bet_amount) {
            await message.reply(`❌ La apuesta debe ser exactamente ${this.formatNumber(game.bet_amount)} π-b$ para unirse a esta partida.`);
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

        await this.updateRussianGame(game.id, {
            players: game.players,
            pot: game.pot
        });
    
        // Reservar dinero
        await this.economy.removeMoney(userId, betAmount, 'russian_roulette_bet');
    
        // Actualizar embed
        const embed = new EmbedBuilder()
            .setTitle('🔫 Ruleta Rusa - Esperando Jugadores')
            .setDescription('¡Un jugador más se ha unido a la partida!')
            .setColor('#8B0000')
            .addFields(
                { name: '👑 Creador', value: `<@${game.creatorId}>`, inline: true },
                { name: '💰 Apuesta por Jugador', value: `${this.formatNumber(game.bet_amount)} π-b$`, inline: true },
                { name: '💎 Pot Actual', value: `${this.formatNumber(game.pot)} π-b$`, inline: true },
                { 
                    name: '👥 Jugadores', 
                    value: game.players.map(p => `• ${p.displayName}`).join('\n'), 
                    inline: false 
                },
                { name: '📊 Estado', value: `${game.players.length}/${this.config.russianRoulette.maxPlayers} jugadores`, inline: true },
                { name: '🎮 Para Unirse', value: `\`>russian ${game.bet_amount}\``, inline: true },
                { name: '🚀 Para Iniciar', value: `\`>startrussian\` (solo el creador)`, inline: true },
                { name: '❌ Para Cancelar', value: `\`>cancelrussian\` (solo el creador)`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'El creador puede iniciar con >startrussian cuando esté listo' });
    
/*        // Si está lleno, iniciar inmediatamente
        if (game.players.length >= this.config.russianRoulette.maxPlayers) {
            if (game.join_timeout) {
                clearTimeout(game.join_timeout);
            }
            embed.addFields({ name: '🚀 Estado', value: '¡Partida llena! Iniciando...', inline: true });*/
            
            const channel = await message.client.channels.fetch(game.channel_id);
            const gameMessage = await channel.messages.fetch(game.message_id);
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
        
        if (message.author.id !== game.creator_id) {
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
            const channel = await message.client.channels.fetch(game.channel_id);
            const gameMessage = await channel.messages.fetch(game.message_id);
            await this.startRussianRoulette(game, gameMessage);
            await message.reply('🚀 ¡Iniciando la partida de ruleta rusa!');
        } catch (error) {
            console.error('Error iniciando partida:', error);
            await message.reply('❌ Error al iniciar la partida.');
        }
    }
    
    async startRussianRoulette(game, gameMessage) {
        game.phase = 'playing';

        await this.updateRussianGame(game.id, {
            phase: game.phase,
            players: game.players,
            bullet_position: game.bullet_position,
            current_shot: game.current_shot,
            current_player_index: game.current_player_index
        }); 
        
        // Mezclar orden de jugadores
        for (let i = game.players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [game.players[i], game.players[j]] = [game.players[j], game.players[i]];
        }
    
        // Determinar posición de la bala (1-6)
        game.bullet_position = Math.floor(Math.random() * 6) + 1;
        game.current_shot = 0;
        game.current_player_index = 0;
    
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
        while (!game.players[game.current_player_index].alive) {
            game.current_player_index = (game.current_player_index + 1) % game.players.length;
        }
    
        const currentPlayer = game.players[game.current_player_index];
        game.current_shot++;
    
        const embed = new EmbedBuilder()
            .setTitle('🔫 Ruleta Rusa - Turno Actual')
            .setDescription(`🎯 **Es el turno de ${currentPlayer.displayName}**`)
            .setColor('#FFD700')
            .addFields(
                { name: '🔫 Disparo Número', value: `${game.current_shot}/6`, inline: true },
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
            const channel = await client.channels.fetch(game.channel_id);
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error actualizando mensaje del juego:', error);
        }   
    
    
        // Timer para el turno
        game.turn_timeout = setTimeout(async () => {
            if (game.phase === 'playing') {
                await this.forceShoot(game, currentPlayer.id, client);
            }
        }, this.config.russianRoulette.turnTime);
    }
    
    async handleShoot(message, gameKey) {        
        const game = this.activeGames.get(gameKey);
        if (!game || game.phase !== 'playing') {
            await message.reply('❌ No hay ninguna partida activa o no es tu turno.');
            return;
        }
       
        const currentPlayer = game.players[game.current_player_index];
        if (message.author.id !== currentPlayer.id) {
            await message.reply('❌ No es tu turno.');
            return;
        }

        if (game.processing) {
            return;
        }

        game.processing = true;
    
        if (game.turn_timeout) {
            clearTimeout(game.turn_timeout);
            game.turn_timeout = null;
        }

        await this.executeShot(game, message.author.id, message.client);
    }
    
    async executeShot(game, playerId, client) {
        console.log(game.players.find(p => p.id === playerId));
        const currentPlayer = game.players.find(p => p.id === playerId);
        if (!currentPlayer) return;
       
        currentPlayer.shots++;
    
        // Verificar si es la bala
        const isBullet = game.current_shot === game.bullet_position;
    
        const embed = new EmbedBuilder()
            .setTimestamp();
        
        if (isBullet) {
            // ¡BANG! El jugador muere
            currentPlayer.alive = false;

            // MENSAJE ESPECIAL PARA SEXTO DISPARO
            const isLastShot = game.current_shot === 6;
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
                    { name: '🎯 Disparo Fatal', value: `${game.current_shot}/6`, inline: true },
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
            const updateData = {    
                stats: {
                    ...user.stats,
                    games_played: (user.stats.games_played || 0) + 1
                }
            };
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
                    { name: '🎯 Disparo Número', value: `${game.current_shot}/6`, inline: true },
                    { 
                        name: '👥 Siguiente Turno', 
                        value: 'El siguiente jugador tomará el revólver...', 
                        inline: false 
                    }
                );
        }

        try {
            const channel = await client.channels.fetch(game.channel_id);
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error actualizando mensaje del juego: ', error);
        }

        game.processing = false;

        await this.updateRussianGame(game.id, {
            players: game.players,
            current_shot: game.current_shot,
            current_player_index: game.current_player_index,
            bullet_position: game.bullet_position,
            processing: game.processing,
            // Agregar cualquier otro campo que haya cambiado
        });
    
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
        if (game.current_shot === 6 && alivePlayers.length > 1 || !currentPlayer.alive) {
            setTimeout(async () => {
                await this.reloadRevolver(game, client);
            }, 4000);
            return;
        }

        // Pasar al siguiente turno después de un delay
        setTimeout(async () => {
            game.current_player_index = (game.current_player_index + 1) % game.players.length;
            await this.nextTurn(game, client);
        }, 4000);
    }

    async reloadRevolver(game, client) {
        // Reiniciar revólver
        game.bullet_position = Math.floor(Math.random() * 6) + 1;
        game.current_shot = 0;
        
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
            const channel = await client.channels.fetch(game.channel_id);
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error actualizando mensaje del juego:', error);
        }
    
        // Continuar con el siguiente turno después de un delay
        setTimeout(async () => {
            game.current_player_index = (game.current_player_index + 1) % game.players.length;
            await this.nextTurn(game, client);
        }, 4000);
    }
    
    async forceShoot(game, playerId, client) {
        if (game.processing) {
            return;
        }

        game.processing = true;
        
        const currentPlayer = game.players.find(p => p.id === playerId);
        if (!currentPlayer) return;
    
        const embed = new EmbedBuilder()
            .setTitle('⏰ ¡Tiempo Agotado!')
            .setDescription(`${currentPlayer.displayName} no disparó a tiempo. Se dispara automáticamente...`)
            .setColor('#FF8C00');

        try {
            const channel = await client.channels.fetch(game.channel_id);
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error actualizando mensaje del juego:', error);
        }
    
        setTimeout(() => this.executeShot(game, playerId, client), 2000);
    }
    
    async endRussianRoulette(game, client) {
        game.phase = 'finished';
        this.activeGames.delete(`russian_${game.channel_id}`);
    
        const survivors = game.players.filter(p => p.alive);
        const totalPot = game.pot;
        const winnerPrize = Math.floor(totalPot * this.config.russianRoulette.winnerMultiplier);
        const houseCut = totalPot - winnerPrize;
    
        let embed = new EmbedBuilder()
            .setTimestamp();

        let finalEarnings = winnerPrize;
            let eventMessage = '';
    
        if (survivors.length === 1) {
            // Un ganador
            const winner = survivors[0];

            for (const event of this.events.getActiveEvents()) {
                if (event.type === 'fever_time') {
                    finalEarnings = Math.floor(profit * 1.5); // 🔥 +30%
                    eventMessage = `🔥 **Tiempo Fiebre** (+${finalEarnings - profit} π-b$)`;
                    break;
                }
                else if (event.type === 'market_crash') {
                    finalEarnings = Math.floor(profit * 1.5); // 📉 -30%
                    eventMessage = `📉 **Crisis del Mercado** (-${profit - finalEarnings} π-b$)`;
                    break;
                }
                else if (event.type === 'server_anniversary') {
                    finalEarnings = Math.floor(profit * 2);
                    eventMessage = `🎉 **Aniversario del Servidor** (+${finalEarnings - profit} π-b$)`
                }
            }     

            const userData = await this.economy.getUser(userId);
            const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(userId) : this.economy.config.maxBalance;

            if (userData.balance + finalEarnings > userLimit) {
                const spaceLeft = userLimit - userData.balance;
                finalEarnings = Math.min(finalEarnings, spaceLeft);
            }
            
            const addResult = await this.economy.addMoney(winner.id, finalEarnings, 'russian_roulette_win');
            finalEarnings = addResult.actualAmount;
            
            // Establecer cooldown para el ganador
            this.setCooldown(winner.id, 'russianRoulette');
    
            // Actualizar estadísticas del ganador
            const updateData = {   
                stats: {
                    ...winner.id.stats,
                    games_played: ((await this.economy.getUser(winner.id)).stats.games_played || 0) + 1
                }
            };
            await this.economy.updateUser(winner.id, updateData);
    
            if (this.achievements) {
                await this.achievements.updateStats(winner.id, 'game_played');
                await this.achievements.updateStats(winner.id, 'game_won');
                await this.achievements.updateStats(winner.id, 'bet_win', finalEarnings);
            }

            if (this.missions) {
                let allCompleted = [];

                const winMissions = await this.missions.updateMissionProgress(winner.id, 'game_won');
                const betWonMissions = await this.missions.updateMissionProgress(winner.id, 'bet_won');
                const moneyMissions = await this.missions.updateMissionProgress(winner.id, 'money_earned_today', finalEarnings);
                    
                allCompleted = [...allCompleted, ...winMissions, ...betWonMissions, ...moneyMissions];
                
                if (allCompleted.length > 0) {
                    await this.missions.notifyCompletedMissions(message, allCompleted);
                }
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
                    { name: '🔫 Bala Estaba En', value: `Disparo ${game.bullet_position}/6`, inline: true },
                    { name: '🎉 Extra por Eventos', value: `${eventMessage || "No hay eventos Activos"} `, inline: false }
                );

            if (addResult.hitLimit) {
                const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
                await message.reply(`⚠️ **Límite alcanzado para ${winner.id}:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
            }
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
                await this.economy.addMoney(player.id, game.bet_amount, 'russian_roulette_refund');
            }
        }       

        try {
            await this.deleteRussianGame(`russian_${game.channel_id}`);
            const channel = await client.channels.fetch(game.channel_id);
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error actualizando mensaje final del juego:', error);
        }
    }

    async loadActiveRussianGames(client) {
        try {
            const data = await this.economy.database.getActiveRussianGames();
            
            for (const gameData of data) {
                const gameKey = gameData.id;
                
                // Restaurar en cache local
                this.activeGames.set(gameKey, gameData);
                
                // Si estaba en turno, reanudar
                if (gameData.phase === 'playing') {
                    setTimeout(() => this.nextTurn(gameData, client), 5000);
                }
            }
            
            console.log(`🔄 Cargadas ${data.length} partidas de ruleta rusa`);
        } catch (error) {
            console.error('⚠️ Error cargando partidas:', error);
        }
    }
    
    async cancelRussianRoulette(game, gameMessage, reason) {
        game.phase = 'finished';
        this.activeGames.delete(`russian_${game.channel_id}`);
    
        // Devolver dinero a todos los jugadores
        for (const player of game.players) {
            await this.economy.addMoney(player.id, game.bet_amount, 'russian_roulette_refund');
        }
    
        const embed = new EmbedBuilder()
            .setTitle('❌ Partida Cancelada')
            .setDescription(`La partida ha sido cancelada: ${reason}`)
            .setColor('#FF0000')
            .addFields(
                { name: '💰 Devolución', value: 'El dinero ha sido devuelto a todos los jugadores', inline: false }
            )
            .setTimestamp();
    
        await this.deleteRussianGame(`russian_${game.channel_id}`);
        await gameMessage.channel.send({ embeds: [embed] });
    }

    async handleCancelRussian(message) {
        const gameKey = `russian_${message.channel.id}`;
        const game = this.activeGames.get(gameKey);
        
        if (!game) {
            await message.reply('❌ No hay ninguna partida activa en este canal.');
            return;
        }
        
        if (game.phase !== 'waiting') {
            await message.reply('❌ Solo se puede cancelar una partida que esté esperando jugadores.');
            return;
        }
        
        if (message.author.id !== game.creator_id) {
            await message.reply('❌ Solo el creador de la partida puede cancelarla.');
            return;
        }
        
        // Limpiar timeout si existe
        if (game.join_timeout) {
            clearTimeout(game.join_timeout);
        }
        
        await this.cancelRussianRoulette(game, message, 'Cancelada por el creador');
        await message.reply('✅ Partida cancelada exitosamente.');
    }

    // Método principal para manejar UNO
    async handleUno(message, args) {
        const userId = message.author.id;
        const channelId = message.channel.id;
        const user = await this.economy.getUser(userId);
        
        // Si no hay argumentos suficientes, mostrar ayuda
        if (args.length < 2) {
            const variantsList = Object.entries(this.config.uno.variants)
                .map(([key, variant]) => `${variant.emoji} **${variant.name}** - ${variant.description}`)
                .join('\n');

            const embed = new EmbedBuilder()
                .setTitle('🎴 UNO - Juego de Cartas')
                .setDescription('¡El primer jugador en quedarse sin cartas se lleva todo!')
                .addFields(
                    { name: '📝 Uso', value: '`>ujoin <cantidad>` - Crear/Unirse a partida', inline: false },
                    { name: '🎯 Variantes Disponibles', value: variantsList, inline: false },
                    { name: '💡 Ejemplos', value: '`>ujoin 500` - UNO clásico\n`>ujoin 500 flip` - UNO Flip\n`>ujoin 500 noMercy` - No Mercy', inline: false },
                    { 
                        name: '🎯 Cómo Funciona', 
                        value: '• Cada jugador apuesta la misma cantidad\n• Cada uno recibe 7 cartas iniciales\n• Juega cartas que coincidan en color o número\n• Usa cartas especiales para cambiar el juego\n• El primero sin cartas gana 95% del pot\n• La casa se queda con el 5%', 
                        inline: false 
                    },
                    { 
                        name: '👥 Jugadores', 
                        value: `Mínimo: ${this.config.uno.minPlayers}\nMáximo: ${this.config.uno.maxPlayers}`, 
                        inline: true 
                    },
                    { 
                        name: '💰 Apuesta', 
                        value: `Min: ${this.formatNumber(this.config.uno.minBet)} π-b$\nMax: ${this.formatNumber(this.config.uno.maxBet)} π-b$`, 
                        inline: true 
                    },
                    { 
                        name: '⏰ Tiempos', 
                        value: '\n10m por turno, si no juega sera expulsado', 
                        inline: true 
                    },
                    { 
                        name: '🎮 Comandos en Juego', 
                        value: '`>uplay <color> <numero>` - Jugar carta\n`>upickup` - Robar carta\n`>uhand` - Ver tu mano', 
                        inline: false 
                    },
                    { 
                        name: '💡 Ejemplo', 
                        value: '`>ujoin 500` - Apostar 500 π-b$', 
                        inline: false 
                    }
                )
                .setColor('#FF0000')
                .setFooter({ text: '🎴 ¡Que gane el mejor estratega!. En este minijuego no se aplica el efecto de ningun item' });
            
            await message.reply({ embeds: [embed] });
            return;
        }

        const betAmount = parseInt(args[1]);
        let variant = 'classic';

        // Si hay un tercer argumento, es la variante
        if (args.length >= 3) {
            const requestedVariant = args[2].toLowerCase();
            
            // Mapear nombres alternativos a las variantes reales
            const variantMap = {
                'classic': 'classic',
                'clasico': 'classic',
                'nomercy': 'noMercy',
                'no-mercy': 'noMercy',
                'noMercy': 'noMercy',
                'mercy': 'noMercy',
                'flip': 'flip',
                'house': 'house',
                'casa': 'house'
            };
            
            const mappedVariant = variantMap[requestedVariant];
            if (mappedVariant && this.config.uno.variants[mappedVariant]) {
                variant = mappedVariant;
            } else {
                const availableVariants = Object.keys(this.config.uno.variants).join(', ');
                await message.reply(`❌ Variante "${args[2]}" no existe.\n**Disponibles:** ${availableVariants}\n**Aliases:** classic, nomercy, flip, house`);
                return;
            }
        }

        // Validar cantidad de apuesta
        if (isNaN(betAmount) || betAmount < this.config.uno.minBet || betAmount > this.config.uno.maxBet) {
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.uno.minBet)} y ${this.formatNumber(this.config.uno.maxBet)} π-b$`);
            return;
        }

        // Verificar fondos
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes π-b Coins. Tu balance: ${this.formatNumber(user.balance)} π-b$`);
            return;
        }

        if (this.missions) {
            // Siempre actualizar que jugó y apostó
            const gameMissions = await this.missions.updateMissionProgress(userId, 'game_played');
            const betMissions = await this.missions.updateMissionProgress(userId, 'money_bet', betAmount);
            
            let allCompleted = [...gameMissions, ...betMissions];

            if (allCompleted.length > 0) {
                await this.missions.notifyCompletedMissions(message, allCompleted);
            }
        }

        // Verificar si ya hay una partida activa en el canal
        const gameKey = `uno_${channelId}`;
        let game = this.activeGames.get(gameKey);

        if (game) {
            // Unirse a partida existente
            await this.joinUnoGame(message, game, userId, betAmount, variant);
        } else {
            // Crear nueva partida
            await this.createUnoGame(message, userId, betAmount, channelId, variant);
        }
    }

    async handleUnoVariant(message, args, game) {
        const userId = message.author.id;
        
        // Solo el creador puede cambiar la variante
        if (game.creator_id !== userId) {
            await message.reply('❌ Solo el creador puede cambiar la variante');
            return;
        }
        
        // Solo en fase de espera
        if (game.phase !== 'waiting') {
            await message.reply('❌ No se puede cambiar la variante después de iniciar');
            return;
        }
        
        if (args.length < 2) {
            const variantsList = Object.entries(this.config.uno.variants)
                .map(([key, variant]) => `\`${key}\` - ${variant.emoji} ${variant.name}`)
                .join('\n');
            
            await message.reply(`**Variantes disponibles:**\n${variantsList}\n\n**Uso:** \`>uvariant <nombre>\``);
            return;
        }
        
        const variantKey = args[1].toLowerCase();
        const variant = this.config.uno.variants[variantKey];
        
        if (!variant) {
            await message.reply('❌ Variante no encontrada');
            return;
        }
        
        game.variant = variantKey;
        game.variant_config = variant;
        await this.updateUnoGameInDB(game);
        
        await message.reply(`✅ Variante cambiada a: ${variant.emoji} **${variant.name}**\n*${variant.description}*`);
    }

    async createUnoGame(message, userId, betAmount, channelId, variant='classic') {
        const gameKey = `uno_${channelId}`;
        
        const game = {
            id: gameKey,
            channel_id: channelId,
            creator_id: userId,
            bet_amount: betAmount,
            variant: variant,
            variant_config: this.config.uno.variants[variant],
            players: [
                {
                    id: userId,
                    username: message.author.username,
                    displayName: message.author.displayName || message.author.username,
                    hand: [],
                    cardCount: 0
                }
            ],
            phase: 'waiting', // waiting, playing, finished
            current_player_index: 0,
            deck: [],
            discard_pile: [],
            current_color: null,
            direction: 1, // 1 = horario, -1 = antihorario
            draw_count: 0, // Para acumular cartas +2 y +4
            darkSide: false,
            pot: betAmount,
            start_time: Date.now(),
            join_start_time: Date.now(),
            turn_timeout: null,
            join_timeout: null,
            message_id: null
        };

        await this.createUnoGameInDB(gameKey, game);
        this.activeGames.set(gameKey, game);

        // Reservar dinero del creador
        await this.economy.removeMoney(userId, betAmount, 'uno_bet');

        const embed = new EmbedBuilder()
            .setTitle(`${game.variant_config.emoji} UNO - ${game.variant_config.name}`)
            .setDescription(`**Variante:** ${game.variant_config.name}\n${game.variant_config.description}`)
            .setColor('#FF0000')
            .addFields(
                { name: '👑 Creador', value: `<@${userId}>`, inline: true },
                { name: '💰 Apuesta por Jugador', value: `${this.formatNumber(betAmount)} π-b$`, inline: true },
                { name: '💎 Pot Actual', value: `${this.formatNumber(game.pot)} π-b$`, inline: true },
                { name: '👥 Jugadores', value: `${game.players.length}/${this.config.uno.maxPlayers}`, inline: true },
                { name: '⏰ Tiempo para Unirse', value: '60 segundos', inline: true },
                { name: '🎮 Para Unirse', value: `\`>ujoin ${betAmount}\``, inline: true },
                { name: '🚀 Para Iniciar', value: `\`>ustart\` (solo el creador)`, inline: true },
                { name: '❌ Para Cancelar', value: `\`>ucancel\` (solo el creador)`, inline: true },
                { name: '🚪 Abandonar', value: '`>uleave` - Salir de la partida', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'El creador puede iniciar con >ustart cuando haya mínimo 2 jugadores' });

        const reply = await message.reply({ embeds: [embed] });
        game.message_id = reply.id;
    }

    async joinUnoGame(message, game, userId, betAmount, requestedVariant=null) {
        //Verificar que la variante coincida
        if (requestedVariant && requestedVariant !== game.variant)
        {
            await message.reply(`❌ Esta partida es de variante "${game.variant}", no puedes unirte con "${requestedVariant}"`);
            return;
        }
        
        // Verificaciones
        if (game.phase !== 'waiting') {
            await message.reply('❌ Esta partida ya comenzó o terminó');
            return;
        }

        if (game.players.find(p => p.id === userId)) {
            await message.reply('❌ Ya estás en esta partida');
            return;
        }

        if (game.players.length >= this.config.uno.maxPlayers) {
            await message.reply('❌ La partida está llena');
            return;
        }

        if (betAmount !== game.bet_amount) {
            await message.reply(`❌ La apuesta de esta partida es ${this.formatNumber(game.bet_amount)} π-b$`);
            return;
        }

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
            hand: [],
            cardCount: 0
        });

        game.pot += betAmount;
        await this.economy.removeMoney(userId, betAmount, 'uno_bet');
        await this.updateUnoGameInDB(game);

        // Solo mostrar que se puede iniciar, pero NO iniciar automáticamente
        if (game.players.length >= this.config.uno.minPlayers) {
            await message.channel.send(`✅ Ya hay ${this.config.uno.minPlayers} jugadores. El creador <@${game.creator_id}> puede iniciar con \`>ustart\``);
        }     

        const embed = new EmbedBuilder()
            .setTitle(`${game.variant_config.emoji} UNO - ${game.variant_config.name}`)
            .setDescription(`**Variante:** ${game.variant_config.name}\n${game.variant_config.description}`)
            .setColor('#00FF00')
            .addFields(
                { name: '💎 Pot Actual', value: `${this.formatNumber(game.pot)} π-b$`, inline: true },
                { name: '👥 Jugadores', value: `${game.players.length}/${this.config.uno.maxPlayers}`, inline: true },
                { name: '🎮 Para Unirse', value: `\`>ujoin ${game.bet_amount}\``, inline: true }
            );

        await message.reply({ embeds: [embed] });
    }

    // Funciones de manejo de cartas UNO
    createUnoDeck(variant = 'classic', isDarkSide = false) {
        const deck = [];
        
        if (variant === 'flip' && isDarkSide) {
            // DECK DEL LADO OSCURO - cartas completamente diferentes
            for (let color of UNO_COLORS) {
                for (let number of UNO_NUMBERS) {
                    deck.push({ color, value: number, type: 'number', isDark: true });
                    // Agregar una segunda copia (excepto el 0)
                    if (number !== '0') {
                        deck.push({ color, value: number, type: 'number', isDark: true });
                    }
                }
            }
            
            // Cartas especiales del lado oscuro
            for (let color of UNO_COLORS) {
                deck.push({ color, value: '+5', type: 'dark_special', isDark: true });
                deck.push({ color, value: '+5', type: 'dark_special', isDark: true });
                deck.push({ color, value: 'Skip Everyone', type: 'dark_special', isDark: true });
                deck.push({ color, value: 'Skip Everyone', type: 'dark_special', isDark: true });
                deck.push({ color, value: 'Flip', type: 'flip', isDark: true });
            }
            
            // Wild del lado oscuro
            for (let i = 0; i < 4; i++) {
                deck.push({ color: 'black', value: 'Wild Draw Color', type: 'dark_wild', isDark: true });
                deck.push({ color: 'black', value: 'Wild+6', type: 'dark_wild', isDark: true });
            }
            
        } else {
            // DECK NORMAL (lado claro o otras variantes)
            
            // Cartas numeradas (0-9) para cada color
            for (let color of UNO_COLORS) {
                for (let number of UNO_NUMBERS) {
                    deck.push({ color, value: number, type: 'number' });
                    // Agregar una segunda copia (excepto el 0)
                    if (number !== '0') {
                        deck.push({ color, value: number, type: 'number' });
                    }
                }
            }

            // Cartas especiales para cada color
            for (let color of UNO_COLORS) {
                for (let special of UNO_SPECIAL_CARDS) {
                    deck.push({ color, value: special, type: 'special' });
                    deck.push({ color, value: special, type: 'special' });
                }
            }

            // Cartas Wild básicas
            for (let i = 0; i < 4; i++) {
                deck.push({ color: 'black', value: 'Wild', type: 'wild' });
                deck.push({ color: 'black', value: 'Wild+4', type: 'wild' });
            }
            
            // Cartas específicas según variante
            if (variant === 'noMercy') {
                // Cartas Wild especiales No Mercy (SIN COLOR)
                for (let i = 0; i < 2; i++) {
                    deck.push({ color: 'black', value: '+6', type: 'no_mercy_wild' });
                    deck.push({ color: 'black', value: '+10', type: 'no_mercy_wild' });
                    deck.push({ color: 'black', value: 'Wild Draw Until Color', type: 'no_mercy_wild' });
                    deck.push({ color: 'black', value: 'Discard All', type: 'no_mercy_wild' });
                    deck.push({ color: 'black', value: '+4 Reverse', type: 'no_mercy_wild' });
                }
            }

            if (variant === 'flip') {
                // Cartas Flip normales (lado claro)
                for (let color of UNO_COLORS) {
                    deck.push({ color, value: 'Flip', type: 'flip' });
                }            
            }
        }

        return this.shuffleDeck(deck);
    }

    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    getCardImageName(card) {
        // Cartas Wild y especiales (sin color)
        if (card.type === 'wild' || card.type === 'no_mercy_wild' || card.type === 'dark_wild') {
            const valueMap = {
                // Wild clásicas
                'Wild': 'wild',
                'Wild+4': 'wild-draw-4',
                
                // No Mercy Wild (sin color)
                '+6': 'wild+6',
                '+10': 'wild+10',
                'Wild Draw Until Color': 'wild-draw-until-color',
                'Discard All': 'wild-discard-all',
                '+4 Reverse': 'wild+4-reverse',
                
                // Flip Wild del lado oscuro (van en carpeta flip/)
                'Wild Draw Color': 'wild-draw-color',
                'Wild+6': 'wild+6-dark'  // Para diferenciar del +6 de No Mercy
            };
            return valueMap[card.value] || 'wild';
        }
        
        // Cartas con color
        const colorName = card.color; // red, blue, green, yellow
        let valueName = card.value.toString().toLowerCase();
        
        // Mapeo de valores especiales
        const valueMap = {
            // Cartas clásicas
            '+2': 'draw-2',
            'skip': 'skip',
            'reverse': 'reverse',
            
            // Cartas Flip
            'flip': 'flip',
            
            // Lado oscuro del Flip
            '+5': '+5',
            'skip everyone': 'skip-everyone'
        };
        
        valueName = valueMap[valueName] || valueName;
        
        // Para números (0-9), mantener como están
        return `card-${valueName}-${colorName}`;
    }

    // Obtener ruta completa de imagen
    getCardImagePath(card, variant = 'classic') {
        const imageName = this.getCardImageName(card);
        
        // Determinar la carpeta según la variante
        let folder = 'classic'; // carpeta por defecto
        
        if (variant === 'noMercy' && (card.type === 'no_mercy' || card.type === 'no_mercy_wild')) {
            folder = 'nomercy';
        } else if (variant === 'flip' && (card.type === 'flip' || card.type === 'dark_special' || card.type === 'dark_wild')) {
            folder = 'flip';
        }
        
        const fullPath = path.join(__dirname, 'images', 'UnoImages', folder, `${imageName}.png`);
        return fullPath;
    }

    // Verificar si existe la imagen
    cardImageExists(card, variant = 'classic') {
        try {
            const imagePath = this.getCardImagePath(card, variant);
            return fs.existsSync(imagePath);
        } catch {
            return false;
        }
    }

    // Obtener carta como texto
    getCardString(card) {
        if (card.type === 'wild') {
            return card.value === 'Wild' ? 'Wild' : 'Wild+4';
        }
        return `${card.color} ${card.value}`;
    }

    // Crear embed con imagen de carta
    createCardEmbed(card, title = "Carta", description = "", variant = 'classic') {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(this.getCardColor(card));

        if (this.cardImageExists(card, variant)) {
            const imageName = this.getCardImageName(card);
            embed.setImage(`attachment://${imageName}.png`);
        } else {
            embed.addFields({ name: 'Carta', value: this.getCardString(card), inline: true });
        }

        return embed;
    }

    // Obtener color para embed según la carta
    getCardColor(card) {
        const colors = {
            '🔴': 0xFF0000, // Rojo
            '🟡': 0xFFFF00, // Amarillo  
            '🟢': 0x00FF00, // Verde
            '🔵': 0x0000FF, // Azul
            'black': 0x000000 // Negro para Wild
        };
        return colors[card.color] || 0x808080;
    }

    // Crear attachment de imagen si existe
    createCardAttachment(card, variant = 'classic') {
        if (this.cardImageExists(card, variant)) {
            const imagePath = this.getCardImagePath(card, variant);
            const imageName = this.getCardImageName(card);
            return new AttachmentBuilder(imagePath, { name: `${imageName}.png` });
        }
        return null;
    }

    async startUnoGame(game, message) {
        if (game.players.length < this.config.uno.minPlayers) {
            await message.reply(`❌ Se necesitan al menos ${this.config.uno.minPlayers} jugadores para comenzar`);
            return;
        }

        game.phase = 'playing';
        game.deck = this.createUnoDeck(game.variant || 'classic');
        game.discard_pile = [];

        // Repartir 7 cartas a cada jugador
        for (let player of game.players) {
            player.hand = [];
            for (let i = 0; i < 7; i++) {
                player.hand.push(game.deck.pop());
            }
            player.cardCount = player.hand.length;
        }

        // Primera carta del descarte (no puede ser Wild)
        let firstCard;
        do {
            firstCard = game.deck.pop();
        } while (firstCard.type === 'wild');

        game.discard_pile.push(firstCard);
        game.current_color = firstCard.color;
        game.current_player_index = 0;

        await this.updateUnoGameInDB(game);

        // Mostrar carta inicial
        const topCard = game.discard_pile[game.discard_pile.length - 1];
        const embed = this.createCardEmbed(
            topCard,
            '🎴 UNO - ¡Partida Iniciada!',
            `La partida ha comenzado con ${game.players.length} jugadores\n\n**Turno:** <@${game.players[game.current_player_index].id}>\n**Color actual:** ${game.current_color}`
        );

        const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('uno_show_hand')
                .setLabel('🎴 Ver mis cartas')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('uno_draw_card')
                .setLabel('🔄 Robar carta')
                .setStyle(ButtonStyle.Secondary)
        );

        const attachment = this.createCardAttachment(topCard, game.variant || 'classic');
        const messageOptions = { embeds: [embed], components: [row] };
        
        if (attachment) {
            messageOptions.files = [attachment];
        }

        await message.reply(messageOptions);

        // Enviar manos por DM
        await this.sendHandsAsEphemeral(game, message);

        // Iniciar timer del turno
        this.startTurnTimer(game, message);
    }

    async sendHandsAsEphemeral(game, message) {
        for (let player of game.players) {
            const handString = player.hand.map((card, i) => 
                `${i}: ${this.getCardString(card)}`).join('\n');
            
            // Buscar al usuario para mandar mensaje oculto
            try {
                await player.id.send(`🎴 **Tu mano:**\n\`\`\`${handString}\`\`\``);
            } catch (error) {
                console.log(`Error enviando mano a ${player.id}`);
            }
        }
    }

    startTurnTimer(game, message) {
        if (game.turn_timeout) {
            clearTimeout(game.turn_timeout);
        }

/*        // Limpiar ventana de callout si ha expirado
        if (game.unoCalloutWindow) {
            const timeElapsed = Date.now() - game.unoCalloutWindow.startTime;
            if (timeElapsed > game.unoCalloutWindow.duration) {
                game.unoCalloutWindow = null;
            }
        }*/

        game.turn_timeout = setTimeout(async () => {
            await this.kickPlayerFromGame(game, message);
        }, this.config.uno.turnTime);
    }

    async handlePlayCard(message, args, game) {
        const userId = message.author.id;
        
        // Verificar que es el turno del jugador
        if (game.players[game.current_player_index].id !== userId) {
            await message.reply('❌ No es tu turno');
            return;
        }

        // Verificar si hay comando UNO después de la jugada
        const hasUnoCall = args.some(arg => arg.toLowerCase() === '>sayuno!' || arg.toLowerCase() === '>sayuno' ||arg.toLowerCase() === 'sayuno!' || arg.toLowerCase() === 'sayuno');

        // Verificar argumentos (necesita color y valor)
        if (args.length < 3) {
            await message.reply('❌ Uso: `>uplay <color> <valor> [>sayuno!]`\n**Ejemplos:**\n• `>uplay red 5`\n• `>uplay red 5 >sayuno`\n• `>uplay blue skip sayuno`');
            return;
        }

        const color = args[1].toLowerCase();
        const value = args[2].toLowerCase();
        
        // Encontrar el jugador
        const player = game.players.find(p => p.id === userId);
        if (!player) {
            await message.reply('❌ No estás en esta partida');
            return;
        }

        // Buscar la carta en la mano del jugador
        const cardIndex = this.findCardInHand(player, color, value);
        
        if (cardIndex === -1) {
            await message.reply('❌ No tienes esa carta en tu mano\n💡 Usa el botón "Ver mis cartas"');
            return;
        }

        const card = player.hand[cardIndex];
        
        // Verificar si se puede jugar la carta
        if (!this.canPlayCard(card, game)) {
            const topCard = game.discard_pile[game.discard_pile.length - 1];
            await message.reply(`❌ No puedes jugar esta carta\n**Carta actual:** ${this.getCardString(topCard)}\n**Color actual:** ${game.current_color}`);
            return;
        }

        // Para cartas Wild, verificar que se especificó un color válido
        if (card.type === 'wild') {
            // Para wild, el color viene en args[1], el nuevo color en args[2]
            let chosenColor;
            
            if (color.toLowerCase() === 'wild') {
                chosenColor = value.toLowerCase(); // El color está en args[2]
            } else {
                chosenColor = args[2] ? args[2].toLowerCase() : null; // Wild+4 con color en args[3]
            }
            
            const validColors = ['red', 'yellow', 'green', 'blue'];
            
            if (!chosenColor || !validColors.includes(chosenColor)) {
                await message.reply('❌ Para cartas Wild debes especificar un color válido\n**Ejemplos:**\n• `>uplay wild red`\n• `>uplay wild+4 blue`\n**Colores válidos:** red, yellow, green, blue');
                return;
            }
        }

        // Limpiar timeout del turno actual
        if (game.turn_timeout) {
            clearTimeout(game.turn_timeout);
        }

        // Jugar la carta (remover de la mano)
        player.hand.splice(cardIndex, 1);
        player.cardCount = player.hand.length;
        game.discard_pile.push(card);

        // Procesar efectos de la carta
        let chosenColor = null;
        if (card.type === 'wild') {
            // Para wild, el nuevo color está en args[2]
            chosenColor = (color.toLowerCase() === 'wild') ? value : args[2];
            chosenColor = chosenColor ? chosenColor.toLowerCase() : null;
        }

        await this.processCardEffect(card, game, chosenColor, message, userId);

        // AGREGAR esta verificación:
        if (game.pendingSevenSwap) {
            // NO continuar el juego, esperar intercambio
            await this.updateUnoGameInDB(game);
            return;
        }

        // AGREGAR ESTO DESPUÉS DE processCardEffect
        if (game.variant_config?.rules?.forcePlay && player.hand.length > 0) {
            const canPlayAnother = player.hand.some(c => this.canPlayCard(c, game));
            if (canPlayAnother) {
                await message.reply(`⚠️ <@${userId}> DEBE jugar otra carta (No Mercy)`);
                // NO llamar a this.nextPlayer(game) ni this.startTurnTimer
                return;
            }
        }

        // AGREGAR ESTO:
        // Si se jugó +2 o Wild+4, el siguiente jugador debe actuar
        if (card.value === '+2' || card.value === 'Wild+4') {
            // Pequeño delay para que se procese todo
            setTimeout(async () => {
                await this.forceDrawCards(game, message);
            }, 1500);
        }

        // Verificar victoria
        if (player.hand.length === 0) {
            await this.endUnoGame(game, message, userId);
            return;
        }

        // Donde creas la ventana de callout, agrega:
        if (player.hand.length === 1) {
            if (hasUnoCall) {
                // El jugador dijo UNO correctamente
                player.saidUno = true;
                player.unoCallTime = Date.now();
                console.log(`✅ JUGADOR DIJO UNO: ${userId}`);
                await message.reply(`🎴 **¡UNO!** <@${userId}> declaró UNO correctamente y tiene 1 carta`);
            } else {
                // No dijo UNO - marcar para posible callout
                player.saidUno = false;
                player.unoCallTime = null;
                
                game.unoCalloutWindow = {
                    playerId: userId,
                    playerName: message.author.username,
                    startTime: Date.now(),
                    duration: 30000 // 30 segundos
                };
                
                console.log(`🚨 VENTANA CALLOUT CREADA PARA: ${userId}`);
                
                await message.reply(`🎴 <@${userId}> tiene 1 carta... 👀\n*Los otros jugadores tienen 10 segundos para usar \`>ucallout\` si no dijo UNO*`);
            }
        }

        // Pasar al siguiente jugador
        this.nextPlayer(game);
        
        // Actualizar base de datos
        await this.updateUnoGameInDB(game);

        // Mostrar carta jugada
        const embed = this.createCardEmbed(
            card,
            '🎴 Carta Jugada',
            `<@${userId}> jugó: **${this.getCardString(card)}**\n\n` +
            `**Le toca a:** <@${game.players[game.current_player_index].id}>\n` +
            `**Color actual:** ${game.current_color}\n` /*+
            `**Cartas restantes:** ${player.hand.length}`*/
        );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('uno_show_hand')
                    .setLabel('🎴 Ver mis cartas')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('uno_draw_card')
                    .setLabel('🔄 Robar carta')
                    .setStyle(ButtonStyle.Secondary)
            );

        const attachment = this.createCardAttachment(card, game.variant || 'classic');
        const messageOptions = { 
            embeds: [embed], 
            components: [row]
        };
        
        if (attachment) {
            messageOptions.files = [attachment];
        }

        await message.reply(messageOptions);
        this.startTurnTimer(game, message);
    }

    async handleUnoCallout(message, game) {
        const userId = message.author.id;
        const caller = game.players.find(p => p.id === userId);

        console.log(`🔍 CALLOUT INICIADO POR: ${userId}`);
        console.log(`🔍 VENTANA CALLOUT:`, game.unoCalloutWindow);
        console.log(`🔍 ESTADO DEL JUEGO:`, {
            jugadores: game.players.map(p => ({ id: p.id, cartas: p.hand.length, dijoUno: p.saidUno }))
        });
        
        if (!caller) {
            await message.reply('❌ No estás en esta partida');
            return;
        }
    
        // Verificar si hay una ventana de callout activa
        if (!game.unoCalloutWindow) {
            // PENALIZACIÓN: Callout sin razón válida
            for (let i = 0; i < 2; i++) {
                if (game.deck.length === 0) {
                    await this.reshuffleDeck(game);
                }
                caller.hand.push(game.deck.pop());
            }
            caller.cardCount = caller.hand.length;
            
            await message.reply(`❌ **CALLOUT FALSO:** <@${userId}> usó callout sin razón válida y recibe 2 cartas de penalización`);
            await this.updateUnoGameInDB(game);
            await this.sendHandAsEphemeral(message, caller);
            return;
        }
    
        // Verificar si la ventana de callout sigue activa (10 segundos)
        const timeElapsed = Date.now() - game.unoCalloutWindow.startTime;
        if (timeElapsed > game.unoCalloutWindow.duration) {
            game.unoCalloutWindow = null;
            
            // Callout tardío = penalización
            for (let i = 0; i < 2; i++) {
                if (game.deck.length === 0) {
                    await this.reshuffleDeck(game);
                }
                caller.hand.push(game.deck.pop());
            }
            caller.cardCount = caller.hand.length;
            
            await message.reply(`❌ **CALLOUT TARDÍO:** <@${userId}> el tiempo para hacer callout ha expirado y recibe 2 cartas`);
            await this.updateUnoGameInDB(game);
            await this.sendHandAsEphemeral(message, caller);
            return;
        }
    
        const targetPlayerId = game.unoCalloutWindow.playerId;
        const targetPlayer = game.players.find(p => p.id === targetPlayerId);
    
        // VERIFICACIONES EN ORDEN CORRECTO:
        
        // 1. ¿Existe el jugador objetivo?
        if (!targetPlayer) {
            await message.reply('❌ Error: Jugador objetivo no encontrado');
            return;
        }
        
        // 2. ¿El jugador objetivo tiene exactamente 1 carta?
        if (targetPlayer.hand.length !== 1) {
            // EL JUGADOR YA NO TIENE 1 CARTA - Callout inválido
            for (let i = 0; i < 2; i++) {
                if (game.deck.length === 0) {
                    await this.reshuffleDeck(game);
                }
                caller.hand.push(game.deck.pop());
            }
            caller.cardCount = caller.hand.length;
            
            game.unoCalloutWindow = null;
            
            await message.reply(`❌ **CALLOUT FALSO:** <@${userId}> el jugador objetivo tiene ${targetPlayer.hand.length} cartas, no 1. Recibes 2 cartas de penalización`);
            await this.updateUnoGameInDB(game);
            await this.sendHandAsEphemeral(message, caller);
            return;
        }
    
        // 3. ¿Ya declaró UNO correctamente?
        if (targetPlayer.saidUno) {
            // YA DIJO UNO - Callout tardío
            game.unoCalloutWindow = null;
            
            for (let i = 0; i < 2; i++) {
                if (game.deck.length === 0) {
                    await this.reshuffleDeck(game);
                }
                caller.hand.push(game.deck.pop());
            }
            caller.cardCount = caller.hand.length;
            
            await message.reply(`❌ **CALLOUT TARDÍO:** <@${targetPlayerId}> ya declaró UNO correctamente. <@${userId}> recibe 2 cartas`);
            await this.updateUnoGameInDB(game);
            await this.sendHandAsEphemeral(message, caller);
            return;
        }
    
        // 4. ¡CALLOUT EXITOSO! - El jugador tiene 1 carta y NO dijo UNO
        for (let i = 0; i < 2; i++) {
            if (game.deck.length === 0) {
                await this.reshuffleDeck(game);
            }
            targetPlayer.hand.push(game.deck.pop());
        }
        targetPlayer.cardCount = targetPlayer.hand.length;
    
        // Limpiar ventana de callout
        game.unoCalloutWindow = null;
    
        await message.reply(`🚨 **¡CALLOUT EXITOSO!** <@${userId}> cachó a <@${targetPlayerId}> sin decir UNO\n**<@${targetPlayerId}> recibe 2 cartas de penalización**\n*Cartas actuales: ${targetPlayer.hand.length}*`);
    
        await this.updateUnoGameInDB(game);
        
        // Enviar nueva mano al jugador penalizado
        await this.sendHandAsEphemeral(message, targetPlayer);
    }

    async handleUnoCall(message, game) {
        const userId = message.author.id;
        const player = game.players.find(p => p.id === userId);
        
        if (!player) {
            await message.reply('❌ No estás en esta partida');
            return;
        }

        // Verificar si el jugador tiene exactamente 1 carta
        if (player.hand.length === 1) {
            player.saidUno = true;
            player.unoCallTime = Date.now();
            
            // Cancelar ventana de callout si existe
            if (game.unoCalloutWindow && game.unoCalloutWindow.playerId === userId) {
                game.unoCalloutWindow = null;
            }
            
            await message.reply(`🎴 **¡UNO!** <@${userId}> declaró UNO correctamente`);
        } else if (player.hand.length === 0) {
            await message.reply('❌ Ya no tienes cartas');
        } else {
            // Penalización: dar 2 cartas por declarar UNO falsamente
            for (let i = 0; i < 2; i++) {
                if (game.deck.length === 0) {
                    await this.reshuffleDeck(game);
                }
                player.hand.push(game.deck.pop());
            }
            player.cardCount = player.hand.length;
            
            await message.reply(`❌ **PENALIZACIÓN:** <@${userId}> declaró UNO sin tener 1 carta y recibe 2 cartas de castigo\n*Cartas actuales: ${player.hand.length}*`);
            
            await this.updateUnoGameInDB(game);
            
            // Enviar nueva mano por ephemeral
            await this.sendHandAsEphemeral(message, player);
        }
    }

    async sendHandAsEphemeral(message, player) {
        try {
            const handString = player.hand.map((card, i) => 
                `${i}: ${this.getCardString(card)}`).join('\n');
            
            // Enviar cartas por DM
            const user = await message.client.users.fetch(player.id);
            const embed = new EmbedBuilder()
                .setTitle('🎴 Tu mano de UNO')
                .setDescription(`\`\`\`${handString}\`\`\``)
                .setColor('#0099FF')
                .setFooter({ text: 'Usa >uplay <color> <valor> para jugar' });

            await user.send({ embeds: [embed] });
            
            // NO enviar confirmación en canal público
            
        } catch (error) {
            // Si falla el DM, avisar al usuario que abra sus DMs
            /*const errorMsg = await message.channel.send(`❌ <@${player.id}> No puedo enviarte mensaje privado. Activa los DMs en Configuración > Privacidad > Permitir mensajes directos de miembros del servidor.`);
            
            // Borrar el mensaje de error después de 10 segundos
            setTimeout(() => {
                errorMsg.delete().catch(() => {});
            }, 10000);*/
        }
    }

    // Función auxiliar para encontrar carta en la mano
    findCardInHand(player, color, value) {
        console.log(`🔍 Buscando carta: color="${color}", value="${value}"`);
        console.log(`📋 Cartas en mano:`, player.hand.map(c => `${c.color} ${c.value} (type: ${c.type})`));

        const index = player.hand.findIndex(card => {
            // Normalizar valores para comparación
            const cardValue = card.value.toLowerCase();
            const searchValue = value.toLowerCase();
            
            // CASO ESPECIAL: Cartas Wild
            if (card.type === 'wild') {
                // Para Wild normal
                if (cardValue === 'wild' && (searchValue === 'wild' || color.toLowerCase() === 'wild')) {
                    return true;
                }
                // Para Wild+4 - ARREGLAR AQUÍ
                if (cardValue === 'wild+4' && (
                    searchValue === 'wild+4' || 
                    searchValue === 'wild4' || 
                    searchValue === '+4' ||
                    (color.toLowerCase() === 'wild+4') ||
                    (color.toLowerCase() === 'wild' && searchValue === '+4')
                )) {
                    return true;
                }
                if (card.type === 'dark_wild') {
                    if (cardValue === 'wild draw color' && (
                        searchValue === 'wildcolor' || 
                        searchValue === 'drawcolor' ||
                        color.toLowerCase() === 'wild' ||
                        (color.toLowerCase() === 'black' && searchValue === 'wild')
                    )) {
                        return true;
                    }
                }
                if (cardValue === 'discard all' && (
                    searchValue === 'discardall' ||
                    searchValue === 'discard' ||
                    color.toLowerCase() === 'discard'
                )) {
                    return true;
                }
            }
            
            // Para cartas normales
            const cardColor = card.color.toLowerCase();
            const searchColor = color.toLowerCase();
            
            // Cartas especiales (normalizar +2)
            if (cardValue === '+2' && (searchValue === '+2' || searchValue === 'draw2')) {
                return cardColor === searchColor;
            }
            
            // Cartas normales y otras especiales
            return cardColor === searchColor && (cardValue === searchValue || 
                (cardValue === 'skip' && searchValue === 'skip') ||
                (cardValue === 'reverse' && searchValue === 'reverse'));
        });

        console.log(`✅ Resultado: índice ${index}`);
        return index;
    }

    canPlayCard(card, game) {
        if (card.type === 'wild') return true;
        
        const topCard = game.discard_pile[game.discard_pile.length - 1];
        return card.color === game.current_color || 
               card.value === topCard.value ||
               card.color === topCard.color;
    }

    async forceDrawCards(game, message) {
        if (game.draw_count === 0) return;
        
        const currentPlayer = game.players[game.current_player_index];
        const rules = game.variant_config?.rules || {};

        // Para No Mercy: verificar si puede defenderse con otra carta +2/+4/+6/+10
        if (rules.stackDrawCards) {
            const hasDefenseCard = currentPlayer.hand.some(card => 
                card.value === '+2' || card.value === 'Wild+4' || 
                card.value === '+6' || card.value === '+10'
            );
            
            if (hasDefenseCard) {
                await message.channel.send(
                    `⚠️ <@${currentPlayer.id}> debe robar ${game.draw_count} cartas O jugar una carta +2/+4/+6/+10 para defenderse`
                );
                return; // Darle oportunidad de defenderse
            }
        }

        // Robar las cartas
        let totalDrawn = 0;
        
        if (rules.drawUntilPlayable) {
            // No Mercy: robar hasta poder jugar
            while (totalDrawn < game.draw_count) {
                if (game.deck.length === 0) {
                    await this.reshuffleDeck(game);
                }
                
                const card = game.deck.pop();
                currentPlayer.hand.push(card);
                totalDrawn++;
                
                // Si puede jugar esta carta, detenerse
                if (this.canPlayCard(card, game)) {
                    await message.reply(`🎴 <@${currentPlayer.id}> robó ${totalDrawn} cartas y puede jugar`);
                    break;
                }
            }
        } else {
            // Robar normalmente
            for (let i = 0; i < game.draw_count; i++) {
                if (game.deck.length === 0) {
                    await this.reshuffleDeck(game);
                }
                currentPlayer.hand.push(game.deck.pop());
                totalDrawn++;
            }
            
            await message.reply(`🎴 <@${currentPlayer.id}> robó ${totalDrawn} carta(s)`);
        }

        currentPlayer.cardCount = currentPlayer.hand.length;
        game.draw_count = 0;

        // AQUÍ VA LA VERIFICACIÓN DE NO MERCY
        if (game.variant === 'noMercy') {
            await this.checkNoMercyElimination(game, currentPlayer, message);
            if (game.phase === 'finished') {
                return; // El juego terminó
            }
        }

        // Enviar mano actualizada por DM
        await this.sendHandAsEphemeral(message, currentPlayer);

        // Pasar al siguiente turno
        this.nextPlayer(game);
        await this.updateUnoGameInDB(game);
        this.startTurnTimer(game, message);
    }

    async processCardEffect(card, game, chosenColor, message, userId) {
        const rules = game.variant_config.rules;

        switch (card.value) {
            case 'Skip':
                this.nextPlayer(game);
                break;
            case 'Reverse':
                game.direction *= -1;
                if (game.players.length === 2) {
                    this.nextPlayer(game);
                }
                break;
            case '+2':
                if (rules.stackDrawCards) {
                    game.draw_count += 2;
                    // Permitir que el siguiente jugador tambien juegue +2
                    game.canStack = true;
                } else {
                    //Forzar a robar inmediatamente
                    await this.forceDrawCards(game, message);
                }
                break;
            case '7':
                if (game.variant === 'house' && game.variant_config?.rules?.sevenSwap) {
                    game.pendingSevenSwap = {
                        playerId: userId,
                        timeout: setTimeout(() => {
                            // Auto-seleccionar jugador aleatorio si no elige en 30s
                            this.autoSevenSwap(game, userId, message);
                        }, 30000)
                    };
                    
                    await this.showSevenSwapOptions(game, message, userId);
                    return;
                } else {
                    game.current_color = card.color;
                }
                break;
                
            case '0':
                if (game.variant === 'house' && game.variant_config?.rules?.zeroRotation) {
                    await this.rotateHands(game, message);
                }
                game.current_color = card.color;
                break;
            case 'Wild':
                game.current_color = chosenColor || UNO_COLORS[0];
                console.log(`Wild jugada, nuevo color: ${game.current_color}`);
                break;
            case 'Wild+4':
                game.current_color = chosenColor || UNO_COLORS[0];
                game.draw_count += 4;
                console.log(`Wild+4 jugada, nuevo color: ${game.current_color}, cartas acumuladas: ${game.draw_count}`);
                break;
            case '+4 Reverse':
                game.direction *= -1; // Cambiar dirección
                game.draw_count += 4;  // +4 cartas
                game.current_color = chosenColor || UNO_COLORS[0];
                break;
            case 'Flip':
                game.darkSide = !game.darkSide;
                game.current_color = card.color;
                
                // Regenerar deck con el lado correspondiente
                const remainingCards = game.deck.length;
                game.deck = this.createUnoDeck(game.variant, game.darkSide);
                
                // Mantener solo las primeras X cartas para no cambiar mucho el juego
                game.deck = game.deck.slice(0, remainingCards);
                
                await message.reply(`🔄 **FLIP!** Ahora jugamos en el lado ${game.darkSide ? 'OSCURO 💀' : 'CLARO ☀️'}`);
                break;
            case 'Skip Everyone':
                // Saltar TODOS los otros jugadores, el turno regresa al que jugó
                // No cambiar current_player_index
                break;
            case '+5':
                if (game.variant === 'flip' && game.darkSide) {
                    game.draw_count += 5;
                } else {
                    game.current_color = card.color;
                }
                break;
            case 'Wild Draw Color':
                game.current_color = chosenColor || UNO_COLORS[0];
                // El siguiente jugador debe robar hasta conseguir el color elegido
                game.drawUntilColor = game.current_color;
                break;
            case 'Wild+6':
                game.current_color = chosenColor || UNO_COLORS[0];
                game.draw_count += 6;
                break;
            // AGREGAR estos casos en processCardEffect:
            case '+6':
                game.draw_count += 6;
                break;
            case '+10':
                game.draw_count += 10;
                break;
            case 'Wild Draw Until Color':
                game.current_color = chosenColor || UNO_COLORS[0];
                game.drawUntilColor = game.current_color;
                await this.handleDrawUntilColor(game, message);
                break;
            case 'Discard All':
                game.current_color = chosenColor || UNO_COLORS[0];
                await this.handleDiscardAll(game, message);
                break;
            default:
                // Para cartas numeradas normales (0-9)
                if (!isNaN(parseInt(card.value))) {
                    // Manejar 7 y 0 especiales en reglas de casa
                    if (card.value === '7' && game.variant === 'house' && game.variant_config?.rules?.sevenSwap) {
                        game.pendingSevenSwap = {
                            playerId: userId,
                            timeout: setTimeout(() => {
                                this.autoSevenSwap(game, userId, message);
                            }, 30000)
                        };
                        
                        await this.showSevenSwapOptions(game, message, userId);
                        return;
                    }
                    
                    if (card.value === '0' && game.variant === 'house' && game.variant_config?.rules?.zeroRotation) {
                        await this.rotateHands(game, message);
                    }
                    
                    game.current_color = card.color;
                }
                break;
        }
    }

    async flipAllCards(game) {
        for (let player of game.players) {
            player.hand = player.hand.map(card => this.getFlipSide(card, game.darkSide));
        }
        
        // También cambiar las cartas del deck
        game.deck = game.deck.map(card => this.getFlipSide(card, game.darkSide));
    }

    async handleDrawUntilColor(game, message) {
        const currentPlayer = game.players[game.current_player_index];
        let drawnCards = 0;
        
        while (true) {
            if (game.deck.length === 0) {
                await this.reshuffleDeck(game);
            }
            
            const card = game.deck.pop();
            currentPlayer.hand.push(card);
            drawnCards++;
            
            // Si consigue el color, parar
            if (card.color === game.drawUntilColor) {
                break;
            }
            
            // Protección: máximo 15 cartas
            if (drawnCards >= 15) {
                break;
            }
        }
        
        currentPlayer.cardCount = currentPlayer.hand.length;
        game.drawUntilColor = null;
        
        await message.reply(`🎴 <@${currentPlayer.id}> robó ${drawnCards} cartas hasta conseguir color ${game.current_color}`);
        
        // Verificar eliminación por 25+ cartas
        await this.checkNoMercyElimination(game, currentPlayer, message);
    }

    async handleDiscardAll(game, message) {
        const currentPlayer = game.players[game.current_player_index];
        const targetColor = game.current_color;
        
        // Descartar todas las cartas del color actual
        const discarded = currentPlayer.hand.filter(card => card.color === targetColor);
        currentPlayer.hand = currentPlayer.hand.filter(card => card.color !== targetColor);
        currentPlayer.cardCount = currentPlayer.hand.length;
        
        await message.reply(`🗂️ <@${currentPlayer.id}> descartó ${discarded.length} cartas ${targetColor}`);
        
        // Si se quedó sin cartas, ganó
        if (currentPlayer.hand.length === 0) {
            await this.endUnoGame(game, message, currentPlayer.id);
            return;
        }
    }

    async checkNoMercyElimination(game, player, message) {
        if (game.variant !== 'noMercy') return;
        
        if (player.hand.length >= 25) {
            // Eliminar jugador
            const playerIndex = game.players.findIndex(p => p.id === player.id);
            game.players.splice(playerIndex, 1);
            
            await message.reply(`💀 **ELIMINADO!** <@${player.id}> tenía 25+ cartas y fue expulsado del juego`);
            
            // Ajustar índice del turno actual
            if (game.current_player_index >= game.players.length) {
                game.current_player_index = 0;
            } else if (playerIndex < game.current_player_index) {
                game.current_player_index--;
            }
            
            // Si solo queda 1 jugador, terminar juego
            if (game.players.length === 1) {
                await this.endUnoGame(game, message, game.players[0].id);
                return;
            }
        }
    }

    async showSevenSwapOptions(game, message, swapperId) {
        const otherPlayers = game.players.filter(p => p.id !== swapperId).slice(0, 5);
        
        if (otherPlayers.length === 0) {
            // Solo hay otro jugador, intercambiar automáticamente
            const targetId = game.players.find(p => p.id !== swapperId).id;
            await this.handleSevenSwap(game, swapperId, targetId, message);
            return;
        }
        
        const buttons = otherPlayers.map(player => 
            new ButtonBuilder()
                .setCustomId(`seven_swap_${player.id}`)
                .setLabel(`${player.displayName} (${player.cardCount} cartas)`)
                .setStyle(ButtonStyle.Secondary)
        );
        
        const row = new ActionRowBuilder().addComponents(buttons);
        
        const swapMessage = await message.reply({
            content: `🔄 <@${swapperId}> jugaste un 7! Elige con quién intercambiar cartas (30 segundos):`,
            components: [row]
        });

        // AGREGAR: Limpiar botones cuando expire
        setTimeout(async () => {
            if (game.pendingSevenSwap) {
                try {
                    await swapMessage.edit({
                        content: `⏰ Tiempo agotado para intercambio del 7...`,
                        components: []
                    });
                } catch (error) {
                    console.log('Error limpiando botones:', error);
                }
            }
        }, 30000);
    }

    // Agregar listener de botones para jump-in
    async handleJumpInAttempt(message, cardIndex, game) {
        const userId = message.author.id;
        const player = game.players.find(p => p.id === userId);
        
        if (!game.variant_config.rules.jumpIn) {
            await message.reply('❌ Jump-in no está habilitado en esta variante');
            return;
        }
        
        if (game.current_player_index === game.players.findIndex(p => p.id === userId)) {
            await message.reply('❌ Es tu turno, no necesitas jump-in');
            return;
        }
        
        const card = player.hand[cardIndex];
        const topCard = game.discard_pile[game.discard_pile.length - 1];
        
        // Verificar carta idéntica
        if (card.color === topCard.color && card.value === topCard.value) {
            // Ejecutar jump-in
            game.current_player_index = game.players.findIndex(p => p.id === userId);
            await this.handlePlayCard(message, ['uplay', card.color, card.value], game);
        } else {
            await message.reply('❌ Solo puedes hacer jump-in con una carta idéntica');
        }
    }

    async handleStackableCard(game, message, drawAmount) {
        const currentPlayer = game.players[game.current_player_index];
        
        if (game.variant_config.rules.stackDrawCards) {
            const hasStackCard = currentPlayer.hand.some(card => 
                card.value === '+2' || card.value === 'Wild+4' || card.value === '+5'
            );
            
            if (hasStackCard) {
                game.stackTimeout = setTimeout(() => {
                    this.forceDrawCards(game, message);
                }, 20000); // 20 segundos para decidir
                
                await message.reply(`⚠️ <@${currentPlayer.id}> puedes apilar otra carta +2/+4 o robar ${game.draw_count} cartas (20s)`);
                return;
            }
        }
        
        // Si no puede apilar, robar
        await this.forceDrawCards(game, message);
    }

    getFlipSide(card, isDarkSide) {
        if (!isDarkSide) return card;
        
        // Transformaciones al lado oscuro
        const darkSideCard = { ...card };
        
        switch (card.value) {
            case 'Skip':
                darkSideCard.value = 'Skip Everyone';
                darkSideCard.type = 'dark_special';
                break;
            case '+2':
                darkSideCard.value = '+5';
                break;
            case 'Reverse':
                darkSideCard.value = 'Skip Everyone';
                darkSideCard.type = 'dark_special';
                break;
            case 'Wild':
                darkSideCard.value = 'Wild Draw Color';
                darkSideCard.type = 'dark_wild';
                break;
            case 'Wild+4':
                darkSideCard.value = 'Wild+6';
                break;
        }
        
        return darkSideCard;
    }

    async rotateHands(game, message) {
/*        if (game.players.length < 3) {
            await message.reply('🔄 Se necesitan al menos 3 jugadores para rotar manos');
            return;
        }*/
        
        const direction = game.direction;
        const hands = game.players.map(p => [...p.hand]);
        
        for (let i = 0; i < game.players.length; i++) {
            const nextIndex = (i + direction + game.players.length) % game.players.length;
            game.players[i].hand = hands[nextIndex];
            game.players[i].cardCount = hands[nextIndex].length;
        }
        
        await message.reply(`🔄 **Rotación!** Todos los jugadores rotaron sus manos ${direction === 1 ? '➡️' : '⬅️'}`);
        
        // Enviar nuevas manos a todos
        for (let player of game.players) {
            await this.sendHandAsEphemeral(message, player);
        }
    }

    async handleSevenSwap(game, swapperId, targetId, interaction) {
        const swapper = game.players.find(p => p.id === swapperId);
        const target = game.players.find(p => p.id === targetId);
        
        if (!swapper || !target) {
            await interaction.editReply('❌ Error: Jugadores no encontrados');
            return;
        }
        
        // Limpiar timeout
        if (game.pendingSevenSwap?.timeout) {
            clearTimeout(game.pendingSevenSwap.timeout);
        }
        game.pendingSevenSwap = null;
        
        // Intercambiar manos
        const tempHand = [...swapper.hand];
        swapper.hand = [...target.hand];
        target.hand = tempHand;
        
        swapper.cardCount = swapper.hand.length;
        target.cardCount = target.hand.length;
        
        // Responder al intercambio
        await interaction.editReply(`🔄 **Intercambio completado!** <@${swapperId}> y <@${targetId}> intercambiaron cartas`);
        
        // Enviar nuevas manos por DM
        await this.sendHandAsEphemeral({ channel: interaction.channel, client: interaction.client }, swapper);
        await this.sendHandAsEphemeral({ channel: interaction.channel, client: interaction.client }, target);
        
        // AGREGAR: Mostrar el estado actual del juego después del intercambio
        const topCard = game.discard_pile[game.discard_pile.length - 1];
        const embed = this.createCardEmbed(
            topCard,
            '🎴 UNO - Intercambio Completado',
            `**Intercambio realizado**\n\n**Turno:** <@${game.players[game.current_player_index].id}>\n**Color actual:** ${game.current_color}`
        );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('uno_show_hand')
                    .setLabel('🎴 Ver mis cartas')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('uno_draw_card')
                    .setLabel('🔄 Robar carta')
                    .setStyle(ButtonStyle.Secondary)
            );

        const attachment = this.createCardAttachment(topCard, game.variant);
        const messageOptions = { 
            embeds: [embed], 
            components: [row]
        };
        
        if (attachment) {
            messageOptions.files = [attachment];
        }

        await interaction.channel.send(messageOptions);

        // Continuar el juego
        this.nextPlayer(game);
        await this.updateUnoGameInDB(game);
        this.startTurnTimer(game, { channel: interaction.channel });
    }

    // AGREGAR este método nuevo:
    async handleSevenSwapButton(interaction, targetId) {
        const userId = interaction.user.id;
        const channelId = interaction.channelId;
        const gameKey = `uno_${channelId}`;
        const game = this.activeGames.get(gameKey);

        if (!game) {
            await interaction.reply({ content: '❌ No hay partida activa', ephemeral: true });
            return;
        }

        if (!game.pendingSevenSwap || game.pendingSevenSwap.playerId !== userId) {
            await interaction.reply({ content: '❌ No puedes hacer este intercambio', ephemeral: true });
            return;
        }

        // PRIMERO responder/deferir la interacción
        await interaction.deferReply();

        // Realizar intercambio
        await this.handleSevenSwap(game, userId, targetId, interaction);
        
        // Actualizar mensaje original para quitar botones
        try {
            await interaction.editReply({ 
                content: `✅ Intercambio completado entre <@${userId}> y <@${targetId}>`,
                components: [] 
            });
        } catch (error) {
            console.log('Error actualizando mensaje:', error);
        }
    }

    async autoSevenSwap(game, swapperId, message) {
        if (!game.pendingSevenSwap) return;
        
        const otherPlayers = game.players.filter(p => p.id !== swapperId);
        if (otherPlayers.length === 0) return;
        
        // Seleccionar jugador aleatorio
        const randomTarget = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        
        // Limpiar pendingSevenSwap antes del intercambio
        game.pendingSevenSwap = null;
        
        // Hacer intercambio
        const swapper = game.players.find(p => p.id === swapperId);
        const target = randomTarget;
        
        const tempHand = [...swapper.hand];
        swapper.hand = [...target.hand];
        target.hand = tempHand;
        
        swapper.cardCount = swapper.hand.length;
        target.cardCount = target.hand.length;
        
        await message.channel.send(`⏰ **Tiempo agotado!** Intercambio automático: <@${swapperId}> ↔️ <@${randomTarget.id}>`);
        
        // Enviar nuevas manos
        await this.sendHandAsEphemeral(message, swapper);
        await this.sendHandAsEphemeral(message, target);
        
        // AGREGAR: Mostrar el estado actual del juego después del intercambio
        const topCard = game.discard_pile[game.discard_pile.length - 1];
        const embed = this.createCardEmbed(
            topCard,
            '🎴 UNO - Intercambio Completado',
            `**Intercambio realizado**\n\n**Turno:** <@${game.players[game.current_player_index].id}>\n**Color actual:** ${game.current_color}`
        );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('uno_show_hand')
                    .setLabel('🎴 Ver mis cartas')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('uno_draw_card')
                    .setLabel('🔄 Robar carta')
                    .setStyle(ButtonStyle.Secondary)
            );

        const attachment = this.createCardAttachment(topCard, game.variant);
        const messageOptions = { 
            embeds: [embed], 
            components: [row]
        };
        
        if (attachment) {
            messageOptions.files = [attachment];
        }

        await message.channel.send(messageOptions);
        
        // Continuar el juego
        this.nextPlayer(game);
        await this.updateUnoGameInDB(game);
        this.startTurnTimer(game, message);
    }

    async handleJumpIn(game, userId, card) {
        if (!game.variant_config.rules.jumpIn) return false;
        
        // Verificar que la carta sea idéntica (mismo color y valor)
        const topCard = game.discard_pile[game.discard_pile.length - 1];
        if (card.color === topCard.color && card.value === topCard.value) {
            // Permitir que salte el turno
            const playerIndex = game.players.findIndex(p => p.id === userId);
            game.current_player_index = playerIndex;
            return true;
        }
        return false;
    }

    parseColor(colorInput) {
        if (!colorInput) return null;
        
        const colorMap = {
            'red': '🔴', 'rojo': '🔴',
            'yellow': '🟡', 'amarillo': '🟡',
            'green': '🟢', 'verde': '🟢',
            'blue': '🔵', 'azul': '🔵'
        };
        
        return colorMap[colorInput.toLowerCase()] || null;
    }

    nextPlayer(game) {
        // Limpiar ventana de callout al cambiar turno
        //game.unoCalloutWindow = null;
        
        game.current_player_index = (game.current_player_index + game.direction + game.players.length) % game.players.length;
    }

    async drawCardForPlayer(game, userId, message, isTimeout = false) {
        const player = game.players.find(p => p.id === userId);
        const drawCount = game.draw_count > 0 ? game.draw_count : 1;

        for (let i = 0; i < drawCount; i++) {
            if (game.deck.length === 0) {
                await this.reshuffleDeck(game);
            }
            player.hand.push(game.deck.pop());
        }

        player.cardCount = player.hand.length;
        game.draw_count = 0;

        if (!isTimeout) {
            this.nextPlayer(game);
        }

        await this.updateUnoGameInDB(game);

        // Enviar mano actualizada por DM
        try {
            const user = await message.client.users.fetch(userId);
            const handString = player.hand.map((card, i) => `${i}: ${this.getCardString(card)}`).join('\n');
            
            await user.send(`🎴 **Robaste ${drawCount} carta(s)**\n\n**Tu mano:**\n\`\`\`\n${handString}\n\`\`\``);
        } catch (error) {
            console.log(`No se pudo enviar DM a ${userId}`);
        }

        const message_text = isTimeout ? 
            `⏰ <@${userId}> se quedó sin tiempo y robó ${drawCount} carta(s)` :
            `🎴 <@${userId}> robó ${drawCount} carta(s)`;

        await message.reply(message_text);

        // Mostrar carta actual en la mesa después de robar
        const topCard = game.discard_pile[game.discard_pile.length - 1];
        const cardEmbed = this.createCardEmbed(
            topCard,
            '🎴 Carta en Mesa',
            `**Color actual:** ${game.current_color}\n**Siguiente turno:** <@${game.players[game.current_player_index].id}>`
        );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('uno_show_hand')
                    .setLabel('🎴 Ver mis cartas')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('uno_draw_card')
                    .setLabel('🔄 Robar carta')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        const attachment = this.createCardAttachment(topCard, game.variant || 'classic');
        const messageOptions = { 
            embeds: [cardEmbed], 
            components: [row]
        };
        if (attachment) {
            messageOptions.files = [attachment];
        }

        await message.channel.send(messageOptions);

        if (!isTimeout) {
            this.startTurnTimer(game, message);
        }
    }

    async handleLeaveUno(message) {
        const userId = message.author.id;
        const channelId = message.channel.id;
        const gameKey = `uno_${channelId}`;
        const game = this.activeGames.get(gameKey);

        if (!game) {
            await message.reply('❌ No hay partida activa en este canal');
            return;
        }

        const playerIndex = game.players.findIndex(p => p.id === userId);
        if (playerIndex === -1) {
            await message.reply('❌ No estás en esta partida');
            return;
        }

        const player = game.players[playerIndex];
        
        // Si la partida no ha comenzado - DEVOLVER apuesta
        if (game.phase === 'waiting') {
            await this.economy.addMoney(userId, game.bet_amount, 'uno_leave');
            game.pot -= game.bet_amount;
            
            game.players.splice(playerIndex, 1);
            
            if (game.players.length === 0) {
                this.activeGames.delete(gameKey);
                await this.deleteUnoGameFromDB(gameKey);
                await message.reply('🎴 La partida fue cancelada (no quedan jugadores)');
            } else {
                await message.reply(`🚪 <@${userId}> abandonó la partida y se le devolvió la apuesta. Quedan ${game.players.length} jugadores`);
                await this.updateUnoGameInDB(game);
            }
            return;
        }

        // Si la partida ya comenzó - NO DEVOLVER apuesta
        if (game.phase === 'playing') {
            game.players.splice(playerIndex, 1);
            // NO modificamos game.pot aquí - la apuesta se queda en el pot
            
            // Ajustar índice del turno actual
            if (game.current_player_index >= game.players.length) {
                game.current_player_index = 0;
            } else if (playerIndex < game.current_player_index) {
                game.current_player_index--;
            }

            await message.reply(`🚪 <@${userId}> abandonó la partida (apuesta perdida)`);

            // Si solo queda 1 jugador, terminar juego
            if (game.players.length === 1) {
                await this.endUnoGame(game, message, game.players[0].id);
                return;
            }

            await this.updateUnoGameInDB(game);
            
            // Si era el turno del que se fue, continuar con el siguiente
            if (playerIndex === game.current_player_index) {
                this.startTurnTimer(game, message);
            }
        }
    }

    async showGameTable(game, message) {
        const topCard = game.discard_pile[game.discard_pile.length - 1];
        const currentPlayer = game.players[game.current_player_index];
        
        // Info de jugadores
        const playersInfo = game.players.map((player, index) => {
            const indicator = (index === game.current_player_index) ? '👉' : '  ';
            const unoStatus = player.hand.length === 1 ? '🎴 UNO!' : '';
            return `${indicator} <@${player.id}> - ${player.hand.length} cartas ${unoStatus}`;
        }).join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle('🎴 Mesa de UNO')
            .setDescription(`**Carta actual:** ${this.getCardString(topCard)}\n**Color:** ${game.current_color}`)
            .addFields(
                { name: '👥 Jugadores', value: playersInfo, inline: false },
                { name: '📚 Cartas en Deck', value: `${game.deck.length} cartas`, inline: true },
                { name: '🗂️ Cartas Jugadas', value: `${game.discard_pile.length} cartas`, inline: true },
                { name: '🎯 Turno Actual', value: `<@${currentPlayer.id}>`, inline: true }
            )
            .setColor(this.getCardColor(topCard))
            .setFooter({ text: `Pot: ${this.formatNumber(game.pot)} π-b$` });
        
        if (game.draw_count > 0) {
            embed.addFields({ 
                name: '⚠️ Efecto Activo', 
                value: `+${game.draw_count} cartas acumuladas`, 
                inline: true 
            });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('uno_show_hand')
                    .setLabel('🎴 Ver mis cartas')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('uno_draw_card')
                    .setLabel('🔄 Robar carta')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        const attachment = this.createCardAttachment(topCard, game.variant || 'classic');
        const messageOptions = { 
            embeds: [embed], 
            components: [row]
        };
        if (attachment) {
            messageOptions.files = [attachment];
        }

        await message.reply(messageOptions);
    }

    async reshuffleDeck(game) {
        if (game.discard_pile.length <= 1) {
            console.log('⚠️ No hay suficientes cartas para rebarajear');
            return;
        }
        
        console.log(`🔄 Rebarajeando: ${game.discard_pile.length - 1} cartas`);
        
        // Guardar carta superior
        const topCard = game.discard_pile.pop();
        
        // Rebarajear el resto
        game.deck = this.shuffleDeck([...game.discard_pile]);
        game.discard_pile = [topCard];
        
        console.log(`✅ Deck rebarajeado: ${game.deck.length} cartas nuevas`);
    }

    async endUnoGame(game, message, winnerId) {
        game.phase = 'finished';
        
        if (game.turn_timeout) {
            clearTimeout(game.turn_timeout);
        }

        const winnings = Math.floor(game.pot * this.config.uno.winnerMultiplier);
        const house_cut = game.pot - winnings;

        let finalEarnings = winnings;
        let eventMessage = '';

        for (const event of this.events.getActiveEvents()) {
            if (event.type === 'fever_time') {
                finalEarnings = Math.floor(winnings * 1.5); // 🔥 +30%
                eventMessage = `🔥 **Tiempo Fiebre** (+${finalEarnings - winnings} π-b$)`;
                break;
            }
            else if (event.type === 'market_crash') {
                finalEarnings = Math.floor(winnings * 1.5); // 📉 -30%
                eventMessage = `📉 **Crisis del Mercado** (-${winnings - finalEarnings} π-b$)`;
                break;
            }
            else if (event.type === 'server_anniversary') {
                finalEarnings = Math.floor(winnings * 2);
                eventMessage = `🎉 **Aniversario del Servidor** (+${finalEarnings - winnings} π-b$)`
            }
        }        

        const userData = await this.economy.getUser(winnerId);
        const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(winnerId) : this.economy.config.maxBalance;

        if (userData.balance + finalEarnings > userLimit) {
            const spaceLeft = userLimit - userData.balance;
            finalEarnings = Math.min(finalEarnings, spaceLeft);
        }

        const addResult = await this.economy.addMoney(winnerId, finalEarnings, 'uno_win');
        finalEarnings = addResult.actualAmount;

        const embed = new EmbedBuilder()
            .setTitle('🎴 UNO - ¡GANADOR!')
            .setDescription(`🏆 **<@${winnerId}> ha ganado la partida!**`)
            .addFields(
                { name: '💰 Ganancia', value: `${this.formatNumber(winnings)} π-b$`, inline: true },
                { name: '🏠 Comisión Casa', value: `${this.formatNumber(house_cut)} π-b$`, inline: true },
                { name: '👥 Jugadores', value: `${game.players.length}`, inline: true },
                { name: '🎉 Extra por Eventos', value: `${eventMessage || "No hay eventos Activos"} `, inline: false }
            )
            .setColor('#FFD700')
            .setTimestamp();     
            
            if (this.missions) {
                let allCompleted = [];

                const winMissions = await this.missions.updateMissionProgress(winnerId, 'game_won');
                const betWonMissions = await this.missions.updateMissionProgress(winnerId, 'bet_won');
                const moneyMissions = await this.missions.updateMissionProgress(winnerId, 'money_earned_today', finalEarnings);
                    
                allCompleted = [...allCompleted, ...winMissions, ...betWonMissions, ...moneyMissions];
                
                if (allCompleted.length > 0) {
                    await this.missions.notifyCompletedMissions(message, allCompleted);
                }
            }

        await message.reply({ embeds: [embed] });
        if (addResult.hitLimit) {
            const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
            await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
        }
        
        // Limpiar juego
        this.activeGames.delete(game.id);
        await this.deleteUnoGameFromDB(game.id);
    }

    // Función para manejar comando de ver mano
    async handleShowHand(message, game) {
        const userId = message.author.id;
        const player = game.players.find(p => p.id === userId);
        
        if (!player) {
            await message.reply('❌ No estás en esta partida');
            return;
        }

        try {
            const user = await message.client.users.fetch(userId);
            const handString = player.hand.map((card, i) => `${i}: ${this.getCardString(card)}`).join('\n');
            
            const embed = new EmbedBuilder()
                .setTitle('🎴 Tu mano de UNO')
                .setDescription(`\`\`\`\n${handString}\n\`\`\``)
                .setColor('#0099FF');

            await user.send({ embeds: [embed] });
            await message.react('📬');
        } catch (error) {
            await message.reply('❌ No puedo enviarte un mensaje directo. Verifica tu configuración de privacidad.');
        }
    }

    // Funciones de base de datos (adaptar a tu sistema)
    async createUnoGameInDB(gameId, gameData) {
        try {
            const cleanGameData = {
                ...gameData,
                turn_timeout: null,
                join_timeout: null
            };
            
            await this.economy.database.createUnoGame(gameId, {
                creator_id: gameData.creator_id,
                channel_id: gameData.channel_id,
                bet_amount: gameData.bet_amount,
                variant: gameData.variant, // AGREGAR ESTA LÍNEA
                players: gameData.players,
                phase: gameData.phase,
                game_data: cleanGameData
            });
        } catch (error) {
            console.error('Database error:', error);
        }
    }

    // Función para limpiar datos antes de guardar en DB
    cleanGameDataForDB(gameData) {
        const { turn_timeout, join_timeout, ...cleanData } = gameData;
        
        // AGREGAR: Limpiar también pendingSevenSwap timeout
        if (cleanData.pendingSevenSwap?.timeout) {
            cleanData.pendingSevenSwap = {
                ...cleanData.pendingSevenSwap,
                timeout: null
            };
        }
        
        return cleanData;
    }

    // Luego usar así:
    async updateUnoGameInDB(gameData) {
        try {
            const cleanGameData = this.cleanGameDataForDB(gameData);
            
            await this.economy.database.updateUnoGame(gameData.id, {
                variant: gameData.variant, // AGREGAR ESTA LÍNEA
                players: gameData.players,
                phase: gameData.phase,
                game_data: cleanGameData
            });
        } catch (error) {
            console.error('Database error:', error);
        }
    }

    async deleteUnoGameFromDB(gameId) {
        // Implementar según tu sistema
        try {
            await this.economy.database.deleteUnoGame(gameId);
        } catch (error) {
            console.error('Database error:', error);
        }
    }

    async kickPlayerFromGame(game, message) {
        const kickedPlayer = game.players[game.current_player_index];
        
        // Remover jugador
        game.players.splice(game.current_player_index, 1);
        
        // Ajustar índice del turno actual
        if (game.current_player_index >= game.players.length) {
            game.current_player_index = 0;
        }
        
        await message.reply(`⏰ <@${kickedPlayer.id}> fue expulsado por inactividad`);
        
        // Si solo queda 1 jugador, terminar juego
        if (game.players.length === 1) {
            await this.endUnoGame(game, message, game.players[0].id);
            return;
        }
        
        // Continuar con siguiente jugador
        this.startTurnTimer(game, message);
    }

    async cancelUnoGame(game, message) {
        game.phase = 'cancelled';
        
        // Devolver dinero a todos los jugadores
        for (let player of game.players) {
            await this.economy.addMoney(player.id, game.bet_amount, 'uno_refund');
        }
    
        const embed = new EmbedBuilder()
            .setTitle('🎴 UNO - Partida Cancelada')
            .setDescription('La partida ha sido cancelada. Se ha devuelto el dinero a todos los jugadores.')
            .setColor('#FF0000');
    
        await message.reply({ embeds: [embed] });
    
        // Limpiar timeouts
        if (game.join_timeout) {
            clearTimeout(game.join_timeout);
        }
        if (game.turn_timeout) {
            clearTimeout(game.turn_timeout);
        }
    
        // Eliminar juego
        this.activeGames.delete(game.id);
        await this.deleteUnoGameFromDB(game.id);
    }

    async loadActiveUnoGames(client) {
        try {
            const data = await this.economy.database.getActiveUnoGames();

            for (let gameData of data) {
                const game = gameData.game_data;
                
                // AGREGAR: Asegurar que tenga variante
                if (!game.variant) {
                    game.variant = gameData.variant || 'classic';
                    game.variant_config = this.config.uno.variants[game.variant];
                }
                
                this.activeGames.set(game.id, game);
            }

            console.log(`Loaded ${data.length} active UNO games`);
        } catch (error) {
            console.error('Error connecting to database:', error);
        }
    }

    async checkWeeklyPotExpiry() {
        try {
            const currentPot = await this.economy.database.getCurrentWeeklyPot();
            if (!currentPot) return;
            
            const weekEnd = currentPot.week_start + this.potConfig.weekDuration;
            
            if (Date.now() >= weekEnd && currentPot.status === 'active') {
                await this.distributePot(currentPot);
                
                // Crear nuevo pozo inmediatamente después de distribución natural
                console.log('Creando nuevo pozo para la próxima semana...');
                await this.economy.database.getCurrentWeeklyPot();
            }
        } catch (error) {
            console.error('Error verificando expiración del pozo:', error);
        }
    }

    async distributePot(pot) {
        try {
            console.log(`Distribuyendo pozo de la semana ${pot.week_start}`);
            
            // Obtener todos los participantes
            const contributions = await this.economy.database.getPotContributions(pot.week_start);
            const participants = [...new Set(contributions.map(c => c.user_id))];
            
            if (participants.length === 0) {
                console.log('No hay participantes en el pozo');
                await this.economy.database.completePot(pot.week_start, null, []);
                return;
            }
            
            // Seleccionar ganadores aleatorios
            const moneyWinner = participants[Math.floor(Math.random() * participants.length)];
            const itemContributions = contributions.filter(c => c.contribution_type === 'item');
            
            let itemWinners = [];
            for (const item of itemContributions) {
                const winner = participants[Math.floor(Math.random() * participants.length)];
                itemWinners.push({ 
                    winner, 
                    item: item.item_id, 
                    name: item.item_name,
                    contributor: item.user_id
                });
            }
            
            // Distribuir premios
            if (pot.total_money > 0) {
                await this.economy.addMoney(moneyWinner, pot.total_money, 'weekly_pot_prize');
            }
            
            for (const itemWin of itemWinners) {
                const user = await this.economy.getUser(itemWin.winner);
                const userItems = user.items || {};
                
                if (userItems[itemWin.item]) {
                    userItems[itemWin.item].quantity += 1;
                } else {
                    userItems[itemWin.item] = {
                        id: itemWin.item,
                        quantity: 1,
                        purchaseDate: new Date().toISOString(),
                        source: 'weekly_pot'
                    };
                }
                
                await this.economy.updateUser(itemWin.winner, { items: userItems });
            }
            
            // Marcar como completado
            await this.economy.database.completePot(pot.week_start, moneyWinner, itemWinners);
            
            // NUEVO: Anunciar resultados
            await this.announceWeeklyPotResults(pot, moneyWinner, itemWinners, participants.length);
            
            console.log(`Pozo distribuido - Dinero: ${moneyWinner}, Items: ${itemWinners.length}`);
            
        } catch (error) {
            console.error('Error distribuyendo pozo:', error);
        }
    }
    
    async announceWeeklyPotResults(pot, moneyWinner, itemWinners, participantCount) {
        try {
            // Lista de canales donde anunciar (agrega tus IDs de canales aquí)
            const announcementChannels = [
                '1402479944382152714', // Canal principal
                'TU_CHANNEL_ID_2'  // Canal de economía
            ];
            
            const startDate = new Date(pot.week_start);
            const weekNumber = this.getWeekNumber(startDate);
            
            let resultsText = '';
            
            // Resultado del dinero
            if (pot.total_money > 0 && moneyWinner) {
                resultsText += `💰 **${this.formatNumber(pot.total_money)} π-b$** → <@${moneyWinner}>\n`;
            }
            
            // Resultados de items
            if (itemWinners.length > 0) {
                for (const itemWin of itemWinners) {
                    resultsText += `🎁 **${itemWin.name}** → <@${itemWin.winner}>\n`;
                }
            }
            
            if (!resultsText) {
                resultsText = 'No hubo premios que distribuir';
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🏆 POZO SEMANAL DISTRIBUIDO')
                .setDescription(`¡Los ganadores de la semana ${weekNumber} han sido seleccionados!`)
                .addFields(
                    { name: '📊 Estadísticas', value: `💰 Dinero total: ${this.formatNumber(pot.total_money)} π-b$\n🎁 Items: ${itemWinners.length}\n👥 Participantes: ${participantCount}`, inline: false },
                    { name: '🎉 Ganadores', value: resultsText, inline: false },
                    { name: '📅 Próximo Pozo', value: '¡Ya está disponible para contribuciones!', inline: false }
                )
                .setColor('#FFD700')
                .setTimestamp()
                .setFooter({ text: 'Usa >potcontribute para participar en el próximo pozo' });
            
            // Enviar a todos los canales configurados
            for (const channelId of announcementChannels) {
                try {
                    // Necesitas acceso al cliente de Discord
                    const channel = await this.economy.client.channels.fetch(channelId);
                    await channel.send({ embeds: [embed] });
                    console.log(`Anuncio enviado a canal ${channelId}`);
                } catch (error) {
                    console.log(`No se pudo anunciar en canal ${channelId}:`, error.message);
                }
            }            
        } catch (error) {
            console.error('Error anunciando resultados del pozo:', error);
        }
    }

    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    async handlePotContribute(message, args) {
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('🕳️ Contribuir al Pozo Semanal')
                .setDescription('Contribuye dinero o items al pozo semanal y participa en la distribución')
                .addFields(
                    { name: '💰 Contribuir Dinero', value: '`>potcontribute money <cantidad>`', inline: false },
                    { name: '📦 Contribuir Item', value: '`>potcontribute item <item_id>`', inline: false },
                    { name: '💡 Ejemplos', value: '`>potcontribute money 5000`\n`>potcontribute item lucky_charm`', inline: false },
                    { name: '📋 Límites', value: `• Dinero: ${this.formatNumber(this.potConfig.minMoney)} - ${this.formatNumber(this.potConfig.maxMoney)} π-b$\n• Items: Máximo ${this.potConfig.maxItemsPerUser} por usuario por semana`, inline: false }
                )
                .setColor('#8B4513');
            
            await message.reply({ embeds: [embed] });
            return;
        }

        const userId = message.author.id;
        const type = args[1].toLowerCase();
        
        if (type === 'money') {
            await this.contributeMoney(message, userId, args[2]);
        } else if (type === 'item') {
            await this.contributeItem(message, userId, args[2]);
        } else {
            await message.reply('❌ Tipo inválido. Usa `money` o `item`');
        }
    }

    async contributeMoney(message, userId, amountStr) {
        try {
            const amount = parseInt(amountStr);
            
            if (isNaN(amount) || amount < this.potConfig.minMoney || amount > this.potConfig.maxMoney) {
                await message.reply(`❌ La cantidad debe ser entre ${this.formatNumber(this.potConfig.minMoney)} y ${this.formatNumber(this.potConfig.maxMoney)} π-b$`);
                return;
            }

            const user = await this.economy.getUser(userId);
            if (user.balance < amount) {
                await message.reply(`❌ No tienes suficientes π-b Coins. Balance: ${this.formatNumber(user.balance)} π-b$`);
                return;
            }

            const currentPot = await this.economy.database.getCurrentWeeklyPot();
            if (!currentPot) {
                await message.reply('❌ Error obteniendo el pozo actual');
                return;
            }

            // Verificar contribuciones previas del usuario esta semana
            const userContributions = await this.economy.database.getPotContributions(currentPot.week_start, userId);
            const userMoneyContributed = userContributions
                .filter(c => c.contribution_type === 'money')
                .reduce((sum, c) => sum + c.amount, 0);

            if (userMoneyContributed + amount > this.potConfig.maxMoney) {
                await message.reply(`❌ No puedes contribuir más de ${this.formatNumber(this.potConfig.maxMoney)} π-b$ por semana. Ya contribuiste: ${this.formatNumber(userMoneyContributed)} π-b$`);
                return;
            }

            // Procesar contribución
            await this.economy.removeMoney(userId, amount, 'weekly_pot_contribution');
            await this.economy.database.addPotContribution(currentPot.week_start, userId, 'money', amount);

            // Obtener datos actualizados
            const updatedPot = await this.economy.database.getCurrentWeeklyPot();

            const embed = new EmbedBuilder()
                .setTitle('✅ Contribución Exitosa')
                .setDescription(`Has contribuido **${this.formatNumber(amount)} π-b$** al pozo semanal`)
                .addFields(
                    { name: '💰 Tu Contribución Total', value: `${this.formatNumber(userMoneyContributed + amount)} π-b$`, inline: true },
                    { name: '🕳️ Pozo Total', value: `${this.formatNumber(updatedPot.total_money)} π-b$`, inline: true },
                    { name: '👥 Participantes', value: `${updatedPot.participant_count}`, inline: true }
                )
                .setColor('#00FF00')
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error contribuyendo dinero:', error);
            await message.reply('❌ Error procesando la contribución');
        }
    }

    async contributeItem(message, userId, itemId) {
        try {
            const user = await this.economy.getUser(userId);
            const userItems = user.items || {};
            
            if (!userItems[itemId] || userItems[itemId].quantity < 1) {
                await message.reply(`❌ No tienes el item **${itemId}** en tu inventario`);
                return;
            }

            const currentPot = await this.economy.database.getCurrentWeeklyPot();
            if (!currentPot) {
                await message.reply('❌ Error obteniendo el pozo actual');
                return;
            }

            // Verificar límite de items por usuario
            const userContributions = await this.economy.database.getPotContributions(currentPot.week_start, userId);
            const userItemsContributed = userContributions.filter(c => c.contribution_type === 'item').length;

            if (userItemsContributed >= this.potConfig.maxItemsPerUser) {
                await message.reply(`❌ Ya contribuiste el máximo de ${this.potConfig.maxItemsPerUser} items esta semana`);
                return;
            }

            // Verificar que el item existe en la tienda
            const shopItem = this.economy.shop ? this.economy.shop.shopItems[itemId] : null;
            if (!shopItem) {
                await message.reply(`❌ Item **${itemId}** no encontrado en la tienda`);
                return;
            }

            // Remover item del inventario del usuario
            const newItems = { ...userItems };
            newItems[itemId].quantity -= 1;
            if (newItems[itemId].quantity <= 0) {
                delete newItems[itemId];
            }
            await this.economy.updateUser(userId, { items: newItems });

            // Agregar contribución
            await this.economy.database.addPotContribution(
                currentPot.week_start, 
                userId, 
                'item', 
                0, 
                itemId, 
                shopItem.name
            );

            // Obtener datos actualizados
            const updatedPot = await this.economy.database.getCurrentWeeklyPot();

            const embed = new EmbedBuilder()
                .setTitle('✅ Item Contribuido')
                .setDescription(`Has contribuido **${shopItem.name}** al pozo semanal`)
                .addFields(
                    { name: '📦 Tus Items Contribuidos', value: `${userItemsContributed + 1}/${this.potConfig.maxItemsPerUser}`, inline: true },
                    { name: '👥 Participantes', value: `${updatedPot.participant_count}`, inline: true },
                    { name: '💰 Dinero Total en Pozo', value: `${this.formatNumber(updatedPot.total_money)} π-b$`, inline: true }
                )
                .setColor('#00FF00')
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error contribuyendo item:', error);
            await message.reply('❌ Error procesando la contribución');
        }
    }

    async showPotStatus(message) {
        try {
            const currentPot = await this.economy.database.getCurrentWeeklyPot();
            if (!currentPot) {
                await message.reply('❌ Error cargando el pozo semanal');
                return;
            }

            const nextMonday = currentPot.week_start + this.potConfig.weekDuration;
            const timeLeft = nextMonday - Date.now();
            const daysLeft = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
            const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

            // Obtener contribuciones para mostrar detalles
            const contributions = await this.economy.database.getPotContributions(currentPot.week_start);
            const itemContributions = contributions.filter(c => c.contribution_type === 'item');
            
            const embed = new EmbedBuilder()
                .setTitle('🕳️ Estado del Pozo Semanal')
                .setDescription(`Termina en ${daysLeft}d ${hoursLeft}h`)
                .addFields(
                    { name: '💰 Dinero Total', value: `${this.formatNumber(currentPot.total_money)} π-b$`, inline: true },
                    { name: '📦 Items Totales', value: `${itemContributions.length}`, inline: true },
                    { name: '👥 Participantes', value: `${currentPot.participant_count}`, inline: true }
                )
                .setColor('#8B4513')
                .setTimestamp();

            // Mostrar contribuciones recientes
            if (contributions.length > 0) {
                const recentContributions = contributions
                    .sort((a, b) => new Date(b.contributed_at) - new Date(a.contributed_at))
                    .slice(0, 5)
                    .map(c => {
                        if (c.contribution_type === 'money') {
                            return `💰 ${this.formatNumber(c.amount)} π-b$ por <@${c.user_id}>`;
                        } else {
                            return `📦 ${c.item_name} por <@${c.user_id}>`;
                        }
                    })
                    .join('\n');

                embed.addFields({ 
                    name: '🕒 Contribuciones Recientes', 
                    value: recentContributions || 'Ninguna', 
                    inline: false 
                });
            }

            if (currentPot.participant_count === 0) {
                embed.setDescription('El pozo está vacío. ¡Sé el primero en contribuir!\n\nUsa `>potcontribute money <cantidad>` o `>potcontribute item <item_id>`');
            }

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error mostrando estado del pozo:', error);
            await message.reply('❌ Error cargando el estado del pozo');
        }
    }
    
    async processCommand(message) {
        // Verificar ingresos pasivos pendientes
        await this.economy.checkPendingPassiveIncome(message.author.id);
        await this.economy.checkAndNotifyItems(message.author.id, message);

        const args = message.content.toLowerCase().split(' ');
        const command = args[0];
        await this.economy.missions.updateMissionProgress(message.author.id, 'commands_used');

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
                case '>startrussian': // ← NUEVO COMANDO
                case '>iniciarrussian':
                    await this.handleStartRussian(message);
                    break;
                case '>cancelrussian':
                case '>cancelarrussian':
                    await this.handleCancelRussian(message, args);
                    break;
                case '>ujoin':
                    await this.handleUno(message, args);
                    break;
                case '>uplay':
                    const unoGame = this.activeGames.get(`uno_${message.channel.id}`);
                    if (unoGame && unoGame.phase === 'playing') {
                        await this.handlePlayCard(message, args, unoGame);
                    } else {
                        await message.reply('❌ No estás en ninguna partida de UNO activa');
                    }
                    break;
                case '>upickup':
                    const drawGame = this.activeGames.get(`uno_${message.channel.id}`);
                    if (drawGame && drawGame.phase === 'playing') {
                        await this.drawCardForPlayer(drawGame, message.author.id, message);
                    } else {
                        await message.reply('❌ No estás en ninguna partida de UNO activa');
                    }
                    break;
                case '>ushowhand':
                case '>uhand':
                    const handGame = this.activeGames.get(`uno_${message.channel.id}`);
                    const player = handGame.players.find(p => p.id === message.author.id);
                    if (handGame && handGame.phase === 'playing') {
                        await this.sendHandAsEphemeral(message, player);
                        // Reaccionar al mensaje para confirmar (sin texto en canal)
                        await message.react('✅');
                    } else {
                        await message.reply('❌ No estás en ninguna partida de UNO activa');
                    }
                    break;
                case '>ustart':
                    const startGame = this.activeGames.get(`uno_${message.channel.id}`);
                    if (startGame && startGame.phase === 'waiting' && startGame.creator_id === message.author.id) {
                        await this.startUnoGame(startGame, message);
                    } else if (game.creator_id !== message.author.id) {
                        await message.reply('❌ Solo el creador puede iniciar la partida');
                    } else {
                        await message.reply('❌ No estás en ninguna partida de UNO activa');
                    }
                    break;
                case '>utable':
                    const tableGame = this.activeGames.get(`uno_${message.channel.id}`);
                    if (tableGame && tableGame.players.find(p => p.id === message.author.id)) {
                        await this.showGameTable(tableGame, message);
                    } else {
                        await message.reply('❌ No estás en ninguna partida activa');
                    }
                    break;
                case 'uleave':
                    await this.handleLeaveUno(message, args);
                    break;
                case '>ucancel':
                    const cancelGame = this.activeGames.get(`uno_${message.channel.id}`);
                    if (cancelGame && cancelGame.phase === 'waiting' && cancelGame.creator_id === message.author.id) {
                        await this.cancelUnoGame(cancelGame, message);
                    } else {
                        await message.reply('❌ No estás en ninguna partida de UNO activa');
                    }
                    break;
                case '>sayuno!':
                case '>sayuno':
                    const unogame = this.activeGames.get(`uno_${message.channel.id}`);
                    if (unogame && unogame.players.find(p => p.id === message.author.id)) {
                        await this.handleUnoCall(message, unogame);
                    } else {
                        await message.reply('❌ No estás en ninguna partida de UNO activa');
                    }
                    break;
                case '>ucallout':
                    const calloutgame = this.activeGames.get(`uno_${message.channel.id}`);
                    if (calloutgame && calloutgame.players.find(p => p.id === message.author.id)) {
                        await this.handleUnoCallout(message, calloutgame);
                    } else {
                        await message.reply('❌ No estás en ninguna partida de UNO activa');
                    }
                    break;
                case 'uvariant':
                    if (game) await this.minigames.handleUnoVariant(message, args, game);
                    else await message.reply('❌ No hay partida activa');
                    break;

                case 'ujumpin':
                    if (game) await this.minigames.handleJumpIn(message, args, game);
                    break;
                case '>potcontribute':
                case '>contribute':
                    await this.handlePotContribute(message, args);
                    break;
                    
                case '>potcontents':
                case '>potstatus':
                case '>holethings':
                    await this.showPotStatus(message);
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
                    value: '`>russian <cantidad>` - Crear partida\n`>startrussian` - Iniciar (creador)\n`>shoot` - Disparar en tu turno\nApuesta: 200-5,000 π-b$\nJugadores: 2-6\nGanador se lleva 85% del pot', 
                    inline: false 
                },
                {
                    name: '🎴 UNO (Multiplayer)',
                    value: '`>ujoin <cantidad>` - Crear partida\n`>ustart` - Iniciar (creador)\n`>uplay <color> <numero>` - Lanzar una carta\n`>upickup` - Agarra una carta\n`>uhand` - Muestra tu mano\n`>sayuno` - Usalo cuando tengas una carta\n`>ucallout` - El jugador no dijo Uno\n`>utable` - Muestra la mesa\n`>uleave` - Abandona el juego\nApuesta: 100-10,000 π-b$\nJugadores: 2-8\nGanador se lleva 85% del pot',
                    inline: false,
                },
                {
                    name: '🕳️ Pozo Semanal',
                    value: '`>potcontribute money/item <valor>` - Contribuir\n`>holethings` - Ver contenido del pozo\nRango: 100-50k π-b$ | Max 3 items/usuario\nDistribución aleatoria semanal entre participantes',
                    inline: false,
                },
                { 
                    name: '🔮 Próximamente', 
                    value: '• Poker\n• Trivia\n• Memory Game', 
                    inline: false 
                }
            )
            .setFooter({ text: 'Juega responsablemente - La casa siempre tiene ventaja' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    // Método para conectar eventos
    connectEventsSystem(eventsSystem) {
        this.events = eventsSystem;
        console.log('🎮 Sistema de eventos conectado a minijuegos');
    }
}

module.exports = MinigamesSystem;
