const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const EventsSystem = require('./events');
const { PlayerState } = require('kazagumo');

// Colores y tipos de cartas UNO
const UNO_COLORS = ['red', 'yellow', 'green', 'blue'];
const UNO_NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const UNO_DARK_COLORS = ['pink', 'teal', 'orange', 'purple']; // Lado oscuro
const UNO_NUMBERS_FLIP = ['1', '2', '3', '4', '5', '6', '7', '8', '9']; // Sin 0 en Flip
const UNO_SPECIAL_CARDS = ['Skip', 'Reverse', '+2'];
const UNO_WILD_CARDS = ['Wild', 'Wild+4'];
const UNO_DARK_CARDS = ['Skip Everyone', '+5', 'Wild Draw Color', 'Wild+6'];
const UNO_FLIP_CARDS = ['Flip'];
const UNO_NO_MERCY_CARDS = ['+6', '+10', 'Wild Draw Until Color', 'Discard All', '+4 Reverse'];
const HORSE_EMOJIS = ['🐎', '🏇', '🦄', '🐴', '🦓', '🐆', '🦌', '🦘', '🦙', '🐫', '🦒', '🐘'];
const TRACK_EMOJI = '▬';
const FINISH_LINE = '🏁';

class MinigamesSystem {
    constructor(economySystem, shopSystem, client) {
        this.economy = economySystem;
        this.shop = shopSystem;
        this.client = client;
        this.events = null;
        this.activeGames = new Map(); // Para manejar juegos en progreso
        this.cooldownCache = new Map();
        this.minigamesCache = new Map();
        this.MAX_CACHE_SIZE = 500;
        this.cacheTimeout = 10 * 60 * 1000;
        this.recentTriviaQuestions = new Map(); // ← AGREGAR ESTO

        this.potConfig = {
            minMoney: 1000,
            maxMoney: 500000,
            maxItemsPerUser: 3,
            weekDuration: 7 * 24 * 60 * 60 * 1000 // 7 dias en ms
        };

        // ✅ AGREGAR ESTO (configuración de límites):
        this.dailyLimits = {
            lottery: {
                perCycle: 3,        // 3 partidas por ciclo
                cycleHours: 4,      // Cada 4 horas
                maxDaily: 18        // Máximo 18 al día (3 × 6 ciclos)
            },
            blackjack: {
                perCycle: 15,       // 15 partidas por ciclo
                cycleHours: 4,      // Cada 4 horas
                maxDaily: 90        // Máximo 90 al día (15 × 6 ciclos)
            },
            roulette: {
                perCycle: 8,        // 8 partidas por ciclo
                cycleHours: 4,      // Cada 4 horas
                maxDaily: 48        // Máximo 48 al día (8 × 6 ciclos)
            },
            slots: {
                perCycle: 10,       // 10 partidas por ciclo
                cycleHours: 4,      // Cada 4 horas
                maxDaily: 60        // Máximo 60 al día (10 × 6 ciclos)
            },
            horses: {
                perCycle: 4,       // 10 partidas por ciclo
                cycleHours: 4,      // Cada 4 horas
                maxDaily: 40        // Máximo 60 al día (10 × 6 ciclos)
            },
        };

        setInterval(() => {
            this.checkWeeklyPotExpiry();
        }, 60 * 60 * 1000);

        // Limpiar registros de límites antiguos cada 1 hora
        setInterval(async () => {
            await this.economy.database.cleanOldGameLimits();
        }, 60 * 60 * 1000); // 1 hora

        // Ejecutar limpieza al iniciar (después de 10 segundos)
        setTimeout(async () => {
            console.log('🧹 Ejecutando limpieza inicial de límites...');
            const deleted = await this.economy.database.cleanOldGameLimits();
            console.log(`✅ Limpiados ${deleted} registros de días anteriores`);
        }, 10000);

        setTimeout(() => {
            this.startNotificationChecker();
        }, 5000);
        
        // Configuración de minijuegos
        this.config = {
            coinflip: {
                minBet: 100,            // Cambiar de 50 a 100
                maxBet: 5000,           // Cambiar de 10000 a 5000
                cooldown: 30000,        // Cambiar de 15000 a 30000 (30 segundos)
                winMultiplier: 1.85     // Cambiar de 1.95 a 1.85
            },
            dice: {
                minBet: 100,            // Cambiar de 50 a 100
                maxBet: 5000,           // Cambiar de 10000 a 5000
                cooldown: 45000,        // Cambiar de 30000 a 45000 (45 segundos)
                payouts: {
                    exact: 4.0,         // Cambiar de 4.8 a 4.0
                    high: 1.85,         // Cambiar de 1.9 a 1.85
                    low: 1.85           // Cambiar de 1.9 a 1.85
                }
            },
            guess: {
                minBet: 100,
                maxBet: 5000,
                cooldown: 15000,
                payouts: {
                    exact: 50,
                    close5: 10,
                    close10: 5,
                    close20: 2
                }
            },
            lottery: {
                minBet: 500,
                maxBet: 3000,           // Cambiar de 5000 a 3000
                cooldown: 300000,      // Cambiar de 900000 a 1800000 (30 minutos)
                winMultiplier: 100,      // Cambiar de 100 a 75
                minNumber: 1,
                maxNumber: 100
            },
            blackjack: {
                minBet: 100,
                maxBet: 10000,          // Cambiar de 15000 a 10000
                cooldown: 30000,       // Cambiar de 90000 a 120000 (2 minutos)
                blackjackMultiplier: 2.3, // Cambiar de 2.5 a 2.3
                winMultiplier: 1.9      // Cambiar de 2 a 1.9
            },
            roulette: {
                minBet: 100,
                maxBet: 15000,          // Cambiar de 20000 a 15000
                cooldown: 20000,        // Cambiar de 45000 a 60000 (1 minuto)
                payouts: {
                    straight: 32,       // Cambiar de 35 a 32
                    red: 1.85,          // Cambiar de 1.95 a 1.85
                    black: 1.85,        // Cambiar de 1.95 a 1.85
                    green: 34,          // Cambiar de 37 a 34
                    odd: 1.85,          // Cambiar de 1.95 a 1.85
                    even: 1.85,         // Cambiar de 1.95 a 1.85
                    low: 1.85,          // Cambiar de 1.95 a 1.85
                    high: 1.85,         // Cambiar de 1.95 a 1.85
                    dozen1: 2.7,        // Cambiar de 2.9 a 2.7
                    dozen2: 2.7,        // Cambiar de 2.9 a 2.7
                    dozen3: 2.7,        // Cambiar de 2.9 a 2.7
                    column1: 2.7,       // Cambiar de 2.9 a 2.7
                    column2: 2.7,       // Cambiar de 2.9 a 2.7
                    column3: 2.7        // Cambiar de 2.9 a 2.7
                }
            },
            slots: {
                minBet: 100,
                maxBet: 8000,
                cooldown: 60000, // 1 minuto
                symbols: {
                    '💎': { weight: 3, payout: 50 },    // Ultra raro (Jackpot)
                    '🍒': { weight: 8, payout: 20 },    // Muy raro
                    '🔔': { weight: 12, payout: 10 },   // Raro
                    '🍋': { weight: 18, payout: 5 },    // Poco común
                    '⭐': { weight: 25, payout: 3 },    // Común
                    '7️⃣': { weight: 34, payout: 2.5 }   // Muy común
                },
                jackpotSymbol: '💎',
                twoMatchMultiplier: 0.5 // 50% de la apuesta si salen 2 iguales
            },
            horseRace: {
                minBet: 200,
                maxBet: 10000,
                cooldown: 120000, // 2 minutos
                minPlayers: 2,
                maxPlayers: 12,
                joinTime: 45000, // 45 segundos para unirse
                raceDistance: 100, // Distancia total de la carrera
                updateInterval: 500, // Actualizar cada 500ms
                payouts: {
                    first: 3.0,   // 1er lugar: x3
                    second: 1.8,  // 2do lugar: x1.8
                    third: 1.2    // 3er lugar: x1.2
                },
                botMode: {
                    botWinChance: 0.45, // 45% de que el bot gane
                    refundOnNoPodium: 0.5 // Devolver 50% si ninguno queda en podio
                }
            },
            trivia: {
                minBet: 0,              // Gratis para jugar
                maxBet: 0,              // Gratis
                cooldown: 60000,       // 2 minutos
                timePerQuestion: 15000, // 15 segundos por pregunta
                questionsPerGame: 5,    // 5 preguntas por partida
                hintsPerGame: 3,
                hintPenalty: 0.4,
                hintsOnlyHard: true,
                rewards: {
                    perfect: { money: 1000, xp: 50 },    // 5/5 correctas
                    good: { money: 600, xp: 30 },         // 4/5 correctas
                    decent: { money: 300, xp: 15 },        // 3/5 correctas
                    participation: { money: 50, xp: 5 }   // Menos de 3
                },
                difficulties: {
                    easy: { multiplier: 1.0, xp: 30 },
                    medium: { multiplier: 1.5, xp: 50 },
                    hard: { multiplier: 2.0, xp: 80 }
                },
                survival: {
                    timePerQuestion: 15000,        // 10 segundos (más rápido)
                    baseReward: 100,               // 100 π-b$ por pregunta correcta
                    baseXP: 10,                    // 10 XP por pregunta correcta
                    difficultyIncrement: 5,        // Cada 5 preguntas sube dificultad
                    multiplierPerLevel: 1.5,       // x1.5 por cada nivel de dificultad
                    cooldown: 300000               // 5 minutos de cooldown
                },
                competitive: {
                    minPlayers: 2,
                    maxPlayers: 6,
                    joinTime: 45000,               // 45 segundos para unirse
                    timePerQuestion: 15000,         // 25 segundos por pregunta
                    questionsPerGame: 5,            // 5 preguntas
                    minBet: 0,                      // Apuesta mínima (0 = gratis)
                    maxBet: 5000,                   // Apuesta máxima
                    winnerMultiplier: 0.85,         // Ganador se lleva 85% del pot
                    speedBonusMax: 50,              // Máximo 50 puntos por velocidad
                    cooldown: 180000                // 3 minutos
                },
            },
            vendingMachine: {
                minBet: 10,
                maxBet: 10,        // Fijo en 10
                cooldown: 900000,  // 15 minutos (15 * 60 * 1000)
                winAmount: 40,
                failChance: 0.55   // 55% de fallo
            },
            russianRoulette: {
                minBet: 300,            // Cambiar de 200 a 300
                maxBet: 4000,           // Cambiar de 5000 a 4000
                minPlayers: 2,
                maxPlayers: 6,
                joinTime: 60000,
                turnTime: 20000,
                winnerMultiplier: 0.80  // Cambiar de 0.85 a 0.80 (casa 20%)
            },
            uno: {
                minBet: 150,
                maxBet: 8000,
                minPlayers: 2,
                maxPlayers: 8,
                joinTime: 60000,
                turnTime: 600000,
                winnerMultiplier: 0.90,
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

    async showMyLimits(message) {
        const userId = message.author.id;
        const embed = new EmbedBuilder()
            .setTitle('⏱️ Tus Límites de Juego')
            .setDescription('Sistema de ciclos de 4 horas\n💡 Usa el botón 🔔 cuando alcances un límite para recibir notificaciones')
            .setColor('#FFD700')
            .setTimestamp();
        
        for (const [gameType, config] of Object.entries(this.dailyLimits)) {
            const status = await this.economy.database.getGameLimitStatus(userId, gameType, config.cycleHours);
            
            const timeLeft = status.cycleReset - Date.now();
            const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            
            const gameName = gameType.charAt(0).toUpperCase() + gameType.slice(1);
            const cycleBar = '█'.repeat(status.cycleCount) + '░'.repeat(config.perCycle - status.cycleCount);
            
            const statusEmoji = status.cycleCount >= config.perCycle ? '🔴' : '🟢';
            
            embed.addFields({
                name: `${statusEmoji} ${gameName}`,
                value: 
                    `**Ciclo:** ${status.cycleCount}/${config.perCycle} ${cycleBar}\n` +
                    `**Hoy:** ${status.dailyCount}/${config.maxDaily}\n` +
                    `⏰ ${hoursLeft}h ${minutesLeft}m`,
                inline: true
            });
        }
        
        embed.setFooter({ text: 'Los ciclos se resetean cada 4 horas • 🔔 Activa notificaciones cuando alcances un límite' });
        
        await message.reply({ embeds: [embed] });
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

    // Método unificado para aplicar CUALQUIER tipo de evento
    async applyEventEffects(userId, baseAmount, context = 'minigames', guildId = null) {
        let finalAmount = baseAmount;
        let eventMessage = '';
        let cooldownMultiplier = 1;
        let luckBonus = 0;
        
        if (!this.events) return { finalAmount, eventMessage, cooldownMultiplier, luckBonus };

        for (const event of (this.events.getActiveEvents(guildId) || [])) {
            const multiplier = event.multipliers?.[context];
            if (multiplier && context !== 'cooldown' && context !== 'luck') {
                const bonus = Math.floor(baseAmount * multiplier) - baseAmount;
                finalAmount = Math.floor(baseAmount * multiplier);
                if (bonus > 0) eventMessage = `${event.emoji} **${event.name}** (+${this.formatNumber(bonus)} π-b$)`;
                else if (bonus < 0) eventMessage = `${event.emoji} **${event.name}** (${this.formatNumber(bonus)} π-b$)`;
            }
            if (context === 'cooldown' && event.multipliers?.cooldown) cooldownMultiplier = event.multipliers.cooldown;
            if (context === 'luck' && event.type === 'lucky_hour') {
                luckBonus = 0.10;
                eventMessage = `${event.emoji} **${event.name}**`;
            }
            if (eventMessage || cooldownMultiplier !== 1 || luckBonus > 0) break;
        }
        
        return { finalAmount, eventMessage, cooldownMultiplier, luckBonus };
    }

    async calculateLuck(userId) {
        // ✅ Verificar si está maldito antes de mostrar boosts
        const user = await this.economy.getUser(userId);
        const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
        const isCursed = this.shop.hasCurseActive(userId, activeEffects);

        const effects = await this.shop.getActiveMultipliers(userId, 'games');

        let totalLuckBonus = 0;
        let luckMessages = [];
        
        // 1. Items de suerte (máximo +8%)
        if (this.shop) {
            const luckBoost = await this.shop.getActiveMultipliers(userId, 'games');
            if (luckBoost.luckBoost !== 0) { // ← Cambiar de > 0 a !== 0
                const itemBonus = Math.min(Math.abs(luckBoost.luckBoost) * 0.4, 0.08);
                
                if (!isCursed && luckBoost.luckBoost > 0) {
                    totalLuckBonus += itemBonus;
                    luckMessages.push(`🍀 **Boost de Suerte** (+${Math.round(itemBonus * 100)}%)`);
                } else if (isCursed && luckBoost.luckBoost < 0) {
                    totalLuckBonus += luckBoost.luckBoost; // ← Ya es negativo
                    luckMessages.push(`☠️ **Maldición Activa** (${Math.round(luckBoost.luckBoost * 100)}%)`);
                }
            }
        }
        
        // 2. Eventos de suerte (+10%)
        const eventLuck = await this.applyEventEffects(userId, 0, 'luck', null);
        if (eventLuck.luckBonus > 0) {
            totalLuckBonus += eventLuck.luckBonus;
            luckMessages.push(`${eventLuck.eventMessage} (+10%)`);
        }
        
        // 3. VIP suerte (máximo +7%)
        if (this.shop) {
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.luckBoost > 0) {
                const vipBonus = Math.min(vipMultipliers.luckBoost * 0.35, 0.07);
                totalLuckBonus += vipBonus;
                luckMessages.push(`💎 **Boost VIP** (+${Math.round(vipBonus * 100)}%)`);
            }
        }
        
        return {
            luckBonus: totalLuckBonus,
            luckMessage: luckMessages.join('\n')
        };
    }

    async applyLuckToGame(baseChance, userId, gameType) {
        const luck = await this.calculateLuck(userId);
        
        // Límites de bonus según juego
        const maxBonusByGame = {
            'lottery': 0.05,           // +5% máximo
            'roulette_straight': 0.08, // +8% máximo
            'dice_exact': 0.10,        // +10% máximo
            'coinflip': 0.12,          // +12% máximo
            'dice_highlow': 0.12,      // +12% máximo
            'roulette_color': 0.10,    // +10% máximo
            'slots': 0.12,             // +12% máximo para slots
            'default': 0.15
        };
        
        const maxBonus = maxBonusByGame[gameType] || maxBonusByGame['default'];
        const rawBonus = luck.luckBoost;
        const cappedBonus = Math.max(-0.50, Math.min(rawBonus, maxBonus)); // ← Limitar entre -50% y +max%
        
        // Límite absoluto de probabilidad de ganar
        const maxWinChance = {
            'lottery': 0.06,           // 6% máximo
            'roulette_straight': 0.12, // 12% máximo
            'dice_exact': 0.28,        // 28% máximo
            'coinflip': 0.62,          // 62% máximo
            'dice_highlow': 0.62,      // 62% máximo
            'roulette_color': 0.58,    // 58% máximo
            'slots': 0.25,             // 25% máximo de ganar en slots
            'default': 0.65
        };
        
        const finalChance = Math.min(
            Math.max(0, baseChance + cappedBonus), 
            maxWinChance[gameType] || maxWinChance['default']
        );
        
        return {
            winChance: finalChance,
            luckMessage: luck.luckMessage,
            luckApplied: cappedBonus !== 0
        };
    }

    async checkTreasureHunt(userId, message) {
        /*const guildId = messageOrInteraction?.guild?.id || messageOrInteraction?.guildId;*/
        for (const event of (this.events?.getActiveEvents() || [])) {
            if (event.type === 'treasure_hunt' && Math.random() < 0.15) {
                const treasureType = Math.random();
                let treasureReward = 0;
                let xpBonus = 0;
                let treasureDescription = '';
                
                if (treasureType < 0.55) {
                    // 55% - Dinero normal
                    treasureReward = Math.floor(Math.random() * 2000) + 500;
                    treasureDescription = `💰 Cofre de monedas: ${this.formatNumber(treasureReward)} π-b$`;
                } else if (treasureType < 0.70) {
                    // 15% - Dinero premium
                    treasureReward = Math.floor(Math.random() * 3000) + 1500;
                    treasureDescription = `🏆 Cofre dorado: ${this.formatNumber(treasureReward)} π-b$`;
                } else {
                    // 30% - XP
                    xpBonus = Math.floor(Math.random() * 1000) + 500;
                    treasureDescription = `📜 Pergamino ancestral: +${xpBonus} XP`;
                }
                
                if (treasureReward > 0) {
                    await this.economy.addMoney(userId, treasureReward, 'treasure_found');
                }
                if (xpBonus > 0) {
                    await this.economy.addXp(userId, xpBonus);
                }
                
                await message.reply(`🗺️ **¡Tesoro encontrado!**\n${treasureDescription}`);
                
                // Actualizar stats del evento
                event.stats.treasuresFound = (event.stats.treasuresFound || 0) + 1;
                event.stats.totalTreasureValue = (event.stats.totalTreasureValue || 0) + treasureReward;
                if (xpBonus > 0) {
                    event.stats.totalXpGiven = (event.stats.totalXpGiven || 0) + xpBonus;
                }
                
                break;
            }
        }
    }

    async showLimitReached(message, userId, gameType, status, limitConfig) {
        const timeLeft = status.cycleReset - Date.now();
        const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        
        const gameName = gameType.charAt(0).toUpperCase() + gameType.slice(1);
        
        const embed = new EmbedBuilder()
            .setTitle('⏳ Límite de Ciclo Alcanzado')
            .setDescription(
                `Has jugado **${status.cycleCount}/${limitConfig.perCycle}** partidas de **${gameName}**.\n\n` +
                `⏰ Próximo reset: **${hoursLeft}h ${minutesLeft}m**\n` +
                `📊 Partidas hoy: ${status.dailyCount}/${limitConfig.maxDaily}`
            )
            .setColor('#FFA500')
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`notify_limit_${gameType}_${userId}`)
                    .setLabel('🔔 Avisarme cuando se recargue')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await message.reply({ embeds: [embed], components: [row] });
    }

    // ==========================================
    // SISTEMA DE NOTIFICACIONES DE LÍMITES
    // ==========================================

    async handleLimitNotificationButton(interaction) {
        if (!interaction.customId.startsWith('notify_limit_')) return;
        
        const [, , gameType, userId] = interaction.customId.split('_');
        
        if (interaction.user.id !== userId) {
            await interaction.reply({ 
                content: '❌ Este botón no es para ti.', 
                ephemeral: true 
            });
            return;
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        const limitConfig = this.dailyLimits[gameType];
        const status = await this.economy.database.getGameLimitStatus(
            userId, 
            gameType, 
            limitConfig.cycleHours
        );
        
        // Crear notificación en la base de datos
        const success = await this.economy.database.createLimitNotification(
            userId,
            gameType,
            interaction.channelId,
            status.cycleReset
        );
        
        if (success) {
            const timeLeft = status.cycleReset - Date.now();
            const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            
            await interaction.editReply({
                content: `✅ **Notificación programada**\n` +
                        `Te avisaré en este canal cuando tus límites de **${gameType}** se recarguen.\n` +
                        `⏰ Tiempo estimado: ${hoursLeft}h ${minutesLeft}m`
            });
            
            // Deshabilitar el botón
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('disabled')
                        .setLabel('✅ Notificación activada')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                );
            
            try {
                await interaction.message.edit({ components: [disabledRow] });
            } catch (error) {
                console.log('No se pudo editar el botón:', error.message);
            }
        } else {
            await interaction.editReply({
                content: '❌ Error al programar la notificación. Intenta de nuevo.'
            });
        }
    }

    startNotificationChecker() {
        // Verificar notificaciones cada 1 minuto
        setInterval(async () => {
            await this.checkPendingNotifications();
        }, 60000);
        
        console.log('🔔 Sistema de notificaciones de límites iniciado');
    }

    async checkPendingNotifications() {
        try {
            const notifications = await this.economy.database.getPendingNotifications();
            
            for (const notif of notifications) {
                try {
                    const channel = await this.client.channels.fetch(notif.channel_id);
                    if (!channel) {
                        await this.economy.database.markNotificationAsSent(notif.id);
                        continue;
                    }
                    
                    const gameName = notif.game_type.charAt(0).toUpperCase() + notif.game_type.slice(1);
                    
                    const embed = new EmbedBuilder()
                        .setTitle('🔔 Límites Recargados')
                        .setDescription(
                            `<@${notif.user_id}>, tus límites de **${gameName}** se han recargado.\n\n` +
                            `✅ Ya puedes volver a jugar!`
                        )
                        .setColor('#00FF00')
                        .setTimestamp();
                    
                    await channel.send({ embeds: [embed] });
                    await this.economy.database.markNotificationAsSent(notif.id);
                    
                    console.log(`✅ Notificación enviada a ${notif.user_id} para ${notif.game_type}`);
                    
                } catch (error) {
                    console.error(`Error enviando notificación ${notif.id}:`, error);
                    // Marcar como enviada para evitar reintento infinito
                    await this.economy.database.markNotificationAsSent(notif.id);
                }
            }
        } catch (error) {
            console.error('Error verificando notificaciones:', error);
        }
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
        const now = Date.now();
        
        // Guardar en memoria inmediatamente
        this.cooldownCache.set(key, now);
        
        // Limpiar cache después de 5 minutos (por si acaso)
        setTimeout(() => {
            this.cooldownCache.delete(key);
        }, 5 * 60 * 1000);
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

    // En minigames.js, REEMPLAZAR getEffectiveCooldown():

    async getEffectiveCooldown(baseCooldown, guildId = null) {
        let effectiveCooldown = baseCooldown;
        if (!this.events) return effectiveCooldown;
        try {
            const activeEvents = this.events?.getActiveEvents(guildId) || [];
            for (const event of activeEvents) {
                if (event.multipliers?.cooldown) {
                    effectiveCooldown = Math.floor(baseCooldown * event.multipliers.cooldown);
                    break;
                }
            }
        } catch (error) {
            console.error('Error aplicando eventos a cooldown:', error);
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

        // ✅ AGREGAR VERIFICACIÓN DE CACHE PRIMERO:
        const cacheKey = `${userId}-coinflip`;
        const cachedCooldown = this.cooldownCache.get(cacheKey);
        const now = Date.now();
        
        let effectiveCooldown = await this.getEffectiveCooldown(this.config.coinflip.cooldown, null);

        if (this.shop) {
            const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
            effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
        }
        
        // Verificar cache primero (más rápido)
        if (cachedCooldown && (now - cachedCooldown < effectiveCooldown)) {
            const timeLeft = effectiveCooldown - (now - cachedCooldown);
            return {
                canCoinPlay: false,
                timeLeft: timeLeft
            };
        }
        
        // Luego verificar base de datos
        const lastCoin = user.last_coinflip || 0;
        if (now - lastCoin < effectiveCooldown) {
            const timeLeft = effectiveCooldown - (now - lastCoin);
            return {
                canCoinPlay: false,
                timeLeft: timeLeft
            };
        }

        return { canCoinPlay: true };
    }

    formatGameBonuses(eventMessage, luckMessage, itemMessage, equipmentMessage, vipMessage) {
        let bonuses = [];
        
        if (eventMessage) bonuses.push(eventMessage);
        if (luckMessage) bonuses.push(luckMessage);
        if (itemMessage) bonuses.push(itemMessage);
        if (vipMessage) bonuses.push(vipMessage);
        if (equipmentMessage) bonuses.push(equipmentMessage);
        
        return bonuses.length > 0 ? bonuses.join('\n') : 'No hay bonificaciones activas';
    }

    async handleCoinflip(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
               
        // Verificar argumentos
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('🪙 Coinflip — Cara o Cruz')
                .setDescription('> Elige cara o cruz, apuesta y duplica tu dinero. Simple y rápido.')
                .addFields(
                    { name: '📝 Uso', value: '`>coinflip <cara/cruz> <cantidad>`', inline: false },
                    { name: '💡 Ejemplos', value: '`>coinflip cara 500`\n`>coinflip cruz 1000`', inline: false },
                    { name: '💰 Apuesta', value: `**Mín:** ${this.formatNumber(this.config.coinflip.minBet)} π-b$\n**Máx:** ${this.formatNumber(this.config.coinflip.maxBet)} π-b$`, inline: true },
                    { name: '🏆 Ganancia', value: '**x1.85** tu apuesta\n50% de probabilidad', inline: true },
                    { name: '⏱️ Cooldown', value: '**30 segundos**', inline: true }
                )
                .setColor('#FFD700')
                .setFooter({ text: '¿Cara o Cruz? La suerte decide.' });
            return message.reply({ embeds: [embed] });
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

        // Probabilidad 3% de recibir maldición aleatoria
        if (Math.random() < 0.03) {
            await this.economy.shop.applyRandomCurse(message.author.id);
            
            const curseNotif = new EmbedBuilder()
                .setTitle('☠️ ¡MALDICIÓN!')
                .setDescription('**La Mano del Muerto** apareció de la nada y te maldijo por 30 minutos.')
                .setColor('#8B0000');
            
            await message.reply({ embeds: [curseNotif] });
        }
        
        console.log('RANDOM:', Math.random());
        const randomRoll = Math.random();
        const result = randomRoll < 0.5 ? 'cara' : 'cruz';

        const luckCalc = await this.applyLuckToGame(0.5, userId, 'coinflip');
        const baseWon = result === normalizedChoice;
        
        let won = baseWon;
        let luckMessage = '';
        
        if (!baseWon) {
            // Si perdió naturalmente, la suerte puede salvarlo
            const luckRoll = Math.random();
            if (luckRoll < luckCalc.winChance - 0.5) { // Solo el bonus de suerte
                won = true;
                luckMessage = luckCalc.luckMessage + '\n🪙 ¡La suerte cambió el resultado!';
            }
        } else {
            // Si ganó naturalmente, mostrar suerte disponible
            luckMessage = luckCalc.luckMessage;
        }

        // Establecer cooldown
        this.setCooldown(userId, 'coinflip');

        const updateData = {
            last_coinflip: Date.now(),
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
	        const trinityLol = await this.missions.checkTrinityCompletion(userId);            

            let allCompleted = [...gameMissions, ...betMissions, trinityLol];
                        
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

            // APLICAR EVENTOS DE DINERO
            const eventBonus = await this.applyEventEffects(userId, profit, 'minigames', message.guild?.id);
            let finalEarnings = eventBonus.finalAmount;
            
            // APLICAR ITEMS
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                const originalProfit = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                const vipBonus = finalEarnings - originalProfit;
                
                if (vipBonus > 0) {
                    await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                }
                await this.shop.consumeItemUse(userId, 'games');
            }

            const equipmentBonus = await this.shop.applyEquipmentBonus(userId);
            let equipmentMessage = '';
            
            if (equipmentBonus.applied && equipmentBonus.money > 0) {
                const extraMoney = Math.floor(finalEarnings * equipmentBonus.money);
                finalEarnings += extraMoney;
                
                // Generar mensaje de equipamiento
                for (const equip of equipmentBonus.items) {
                    equipmentMessage += `\n${equip.wasBroken ? '💔' : '🛡️'} **${equip.name}**: `;
                    
                    if (equip.wasBroken) {
                        equipmentMessage += `¡SE ROMPIÓ! (era ${equip.durabilityLost})`;
                    } else {
                        equipmentMessage += `${equip.durabilityLeft}/${equip.maxDurability} (-${equip.durabilityLost})`;
                    }
                }
                
                if (extraMoney > 0) {
                    equipmentMessage = `💰 +${this.formatNumber(extraMoney)} π-b$ (equipamiento)${equipmentMessage}`;
                }
            }

            const userData = await this.economy.getUser(userId);
            const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(userId) : this.economy.config.maxBalance;

            if (userData.balance + finalEarnings > userLimit) {
                const spaceLeft = userLimit - userData.balance;
                finalEarnings = Math.min(finalEarnings, spaceLeft);
            }

            // ✅ Aplicar penalización de maldición (-25% dinero)
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            const curse = activeEffects['death_hand_curse'];
            let curseMoneyPenalty = 0;

            if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
                const penaltyAmount = Math.floor(finalEarnings * Math.abs(curse[0].moneyPenalty)); // 0.25 = 25%
                curseMoneyPenalty = penaltyAmount;
                finalEarnings -= penaltyAmount;
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
            let allMessages = [eventMessage, luckMessage, itemMessage, equipmentBonus].filter(msg => msg !== '');
            let finalMessage = allMessages.length > 0 ? allMessages.join('\n') : 'No hay bonificaciones activas';
          
            embed.setDescription(`🎉 **¡GANASTE!**`)
                .addFields(
                    { name: '🪙 Resultado', value: result === 'cara' ? '🟡 Cara' : '⚪ Cruz', inline: true },
                    { name: '🎯 Tu Elección', value: normalizedChoice === 'cara' ? '🟡 Cara' : '⚪ Cruz', inline: true },
                    { name: '💰 Ganancia', value: `+${this.formatNumber(profit)} π-b$`, inline: true },
                    { name: '💸 Balance Antiguo', value: `${this.formatNumber(user.balance - profit)} π-b$`, inline: false },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$`, inline: false },
                    { name: '🎉 Bonificaciones', value: this.formatGameBonuses(eventMessage, luckMessage, itemMessage, equipmentMessage), inline: false }
                );

            if (curseMoneyPenalty > 0) {
                embed.addFields({
                    name: '☠️ Penalización de Maldición',
                    value: `-${this.formatNumber(curseMoneyPenalty)} π-b$ (-25% de ganancias)`,
                    inline: false
                });
            }

            if (addResult.hitLimit) {
                const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
                await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
            }
        } else {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss');
            // ✅ NUEVO: Sistema de protección mejorado
            const user = await this.economy.getUser(userId);
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            
            let hasProtected = false;
            let protectionMessage = '';

            // 1️⃣ CONDÓN: 100% garantizado, 1 uso
            if (activeEffects['condon_pibe2']) {
                for (let i = activeEffects['condon_pibe2'].length - 1; i >= 0; i--) {
                    const effect = activeEffects['condon_pibe2'][i];
                    if (effect.type === 'protection' && effect.usesLeft > 0) {
                        hasProtected = true;
                        effect.usesLeft -= 1;
                        
                        if (effect.usesLeft <= 0) {
                            activeEffects['condon_pibe2'].splice(i, 1);
                            if (activeEffects['condon_pibe2'].length === 0) {
                                delete activeEffects['condon_pibe2'];
                            }
                        }
                        
                        await this.economy.updateUser(userId, { activeEffects });
                        protectionMessage = '🧃 ¡El Condón usado de Pibe 2 te protegió! (100% - último uso consumido)';
                        break;
                    }
                }
            }
            
            // 2️⃣ FORTUNE SHIELD: 80% probabilidad
            if (!hasProtected && activeEffects['fortune_shield']) {
                for (const effect of activeEffects['fortune_shield']) {
                    if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                        const roll = Math.random();
                        if (roll < 0.80) {
                            hasProtected = true;
                            protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió (80% de suerte)';
                        } else {
                            protectionMessage = '💔 Tu Escudo de la Fortuna falló esta vez (tenías 80% de protección)';
                        }
                        break;
                    }
                }
            }
            
            // 3️⃣ HEALTH POTION: 40% probabilidad
            if (!hasProtected && activeEffects['health_potion']) {
                for (const effect of activeEffects['health_potion']) {
                    if (effect.type === 'penalty_protection' && effect.expiresAt > Date.now()) {
                        const roll = Math.random();
                        if (roll < 0.40) {
                            hasProtected = true;
                            protectionMessage = '💊 Tu Poción de Salud redujo las penalizaciones (40% de suerte)';
                        } else {
                            protectionMessage = '💔 Tu Poción de Salud no pudo protegerte esta vez (tenías 40% de protección)';
                        }
                        break;
                    }
                }
            }
            
            // ✅ Aplicar protección o pérdida
            if (hasProtected) {
                await message.reply(protectionMessage);
            } else {
                if (protectionMessage) {
                    await message.reply(protectionMessage); // Mostrar que falló
                }
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

            if (hasProtected) {
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
        await this.checkTreasureHunt(userId, message);

        const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
        const curse = activeEffects['death_hand_curse'];
        // Al final, después de crear el embed de resultado
        if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
            embed.addFields({
                name: '☠️ Maldición Activa',
                value: won 
                    ? `Tu ganancia fue reducida por la maldición (-25% dinero)`
                    : `La maldición empeoró tu suerte (-50% probabilidad)`,
                inline: false
            });
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

        // ✅ CACHE:
        const cacheKey = `${userId}-dice`;
        const cachedCooldown = this.cooldownCache.get(cacheKey);
        const now = Date.now();
        
        let effectiveCooldown = await this.getEffectiveCooldown(this.config.dice.cooldown, null);

        if (this.shop) {
            const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
            effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
        }
        
        if (cachedCooldown && (now - cachedCooldown < effectiveCooldown)) {
            const timeLeft = effectiveCooldown - (now - cachedCooldown);
            return {
                canDicePlay: false,
                timeLeft: timeLeft
            };
        }

        const lastDice = user.last_dice || 0;
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
                .setTitle('🎲 Dados — Juego de Predicción')
                .setDescription('> Predice el resultado del dado antes de tirarlo. Más riesgo, más ganancia.')
                .addFields(
                    { name: '📝 Uso', value: '`>dice <predicción> <cantidad>`', inline: false },
                    {
                        name: '🎯 Tipos de Apuesta',
                        value: [
                            '`alto` — Sale 4, 5 o 6 → **x1.85**',
                            '`bajo` — Sale 1, 2 o 3 → **x1.85**',
                            '`1` a `6` — Número exacto → **x4.0**'
                        ].join('\n'),
                        inline: false
                    },
                    { name: '💡 Ejemplos', value: '`>dice alto 1000`\n`>dice bajo 500`\n`>dice 6 750`', inline: false },
                    { name: '💰 Apuesta', value: `**Mín:** ${this.formatNumber(this.config.dice.minBet)} π-b$\n**Máx:** ${this.formatNumber(this.config.dice.maxBet)} π-b$`, inline: true },
                    { name: '⏱️ Cooldown', value: '**45 segundos**', inline: true }
                )
                .setColor('#FF6B6B')
                .setFooter({ text: 'Mayor riesgo = mayor recompensa.' });
            return message.reply({ embeds: [embed] });
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

        // Probabilidad 3% de recibir maldición aleatoria
        if (Math.random() < 0.03) {
            await this.economy.shop.applyRandomCurse(message.author.id);
            
            const curseNotif = new EmbedBuilder()
                .setTitle('☠️ ¡MALDICIÓN!')
                .setDescription('**La Mano del Muerto** apareció de la nada y te maldijo por 30 minutos.')
                .setColor('#8B0000');
            
            await message.reply({ embeds: [curseNotif] });
        }

        
        // Tirar el dado
        const diceResult = Math.floor(Math.random() * 6) + 1;
        let won = false;
        let multiplier = 0;
        let winChance = 1;
        let gameType = '';
        let luckMessage = '';

        // DETERMINAR TIPO DE APUESTA
        if (['1', '2', '3', '4', '5', '6'].includes(prediction)) {
            // NÚMERO EXACTO
            gameType = 'dice_exact';
            multiplier = this.config.dice.payouts.exact;
            const baseWon = diceResult === parseInt(prediction);
            
            if (baseWon) {
                won = true;
            } else {
                // Aplicar suerte solo si perdió
                const luckCalc = await this.applyLuckToGame(0, userId, gameType);
                won = Math.random() < luckCalc.winChance;
                if (won) {
                    luckMessage = luckCalc.luckMessage + '\n🎲 ¡La suerte cambió el resultado!';
                }
            }
            
        } else if (['alto', 'high'].includes(prediction)) {
            // ALTO (4-6)
            gameType = 'dice_highlow';
            multiplier = this.config.dice.payouts.high;
            const baseWon = diceResult >= 4;
            
            if (baseWon) {
                won = true;
            } else {
                const luckCalc = await this.applyLuckToGame(0, userId, gameType);
                won = Math.random() < luckCalc.winChance;
                if (won) {
                    luckMessage = luckCalc.luckMessage + '\n🎲 ¡La suerte te salvó!';
                }
            }
            
        } else if (['bajo', 'low'].includes(prediction)) {
            // BAJO (1-3)
            gameType = 'dice_highlow';
            multiplier = this.config.dice.payouts.low;
            const baseWon = diceResult <= 3;
            
            if (baseWon) {
                won = true;
            } else {
                const luckCalc = await this.applyLuckToGame(0, userId, gameType);
                won = Math.random() < luckCalc.winChance;
                if (won) {
                    luckMessage = luckCalc.luckMessage + '\n🎲 ¡La suerte te salvó!';
                }
            }
        }
        
        // Si no usamos suerte pero ganamos naturalmente, mostrar mensaje de suerte disponible
        if (won && !luckMessage) {
            const luckCalc = await this.applyLuckToGame(0.5, userId, gameType);
            luckMessage = luckCalc.luckMessage;
        }

        // Establecer cooldown
        this.setCooldown(userId, 'dice');
        
        const updateData = {
            last_dice: Date.now(),
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
	        const trinityLol = await this.missions.checkTrinityCompletion(userId);            

            let allCompleted = [...gameMissions, ...betMissions, trinityLol];
                        
            if (allCompleted.length > 0) {
                await this.missions.notifyCompletedMissions(message, allCompleted);
            }
        }

        const winAmount = Math.floor(betAmount * multiplier);
        const profit = winAmount - betAmount;
        let eventMessage = '';
        
        if (won) {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_win');
            await this.economy.missions.updateMissionProgress(userId, 'game_won');

            // APLICAR EVENTOS DE DINERO
            const eventBonus = await this.applyEventEffects(userId, profit, 'minigames', message.guild?.id);
            let finalEarnings = eventBonus.finalAmount;
            
            // APLICAR ITEMS
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                const originalProfit = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                const vipBonus = finalEarnings - originalProfit;
                
                if (vipBonus > 0) {
                    await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                }
                await this.shop.consumeItemUse(userId, 'games');
            }

            const equipmentBonus = await this.shop.applyEquipmentBonus(userId);
            let equipmentMessage = '';
            
            if (equipmentBonus.applied && equipmentBonus.money > 0) {
                const extraMoney = Math.floor(finalEarnings * equipmentBonus.money);
                finalEarnings += extraMoney;
                
                // Generar mensaje de equipamiento
                for (const equip of equipmentBonus.items) {
                    equipmentMessage += `\n${equip.wasBroken ? '💔' : '🛡️'} **${equip.name}**: `;
                    
                    if (equip.wasBroken) {
                        equipmentMessage += `¡SE ROMPIÓ! (era ${equip.durabilityLost})`;
                    } else {
                        equipmentMessage += `${equip.durabilityLeft}/${equip.maxDurability} (-${equip.durabilityLost})`;
                    }
                }
                
                if (extraMoney > 0) {
                    equipmentMessage = `💰 +${this.formatNumber(extraMoney)} π-b$ (equipamiento)${equipmentMessage}`;
                }
            }

            const userData = await this.economy.getUser(userId);
            const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(userId) : this.economy.config.maxBalance;

            if (userData.balance + finalEarnings > userLimit) {
                const spaceLeft = userLimit - userData.balance;
                finalEarnings = Math.min(finalEarnings, spaceLeft);
            }

            let itemMessage = '';
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                if (modifiers.multiplier > 1) {
                    itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                }
            }

            // ✅ Aplicar penalización de maldición (-25% dinero)
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            const curse = activeEffects['death_hand_curse'];
            let curseMoneyPenalty = 0;

            if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
                const penaltyAmount = Math.floor(finalEarnings * Math.abs(curse[0].moneyPenalty)); // 0.25 = 25%
                curseMoneyPenalty = penaltyAmount;
                finalEarnings -= penaltyAmount;
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
                    { name: '🎉 Bonificaciones', value: this.formatGameBonuses(eventMessage, luckMessage, itemMessage, equipmentMessage), inline: false }
                );

            if (curseMoneyPenalty > 0) {
                embed.addFields({
                    name: '☠️ Penalización de Maldición',
                    value: `-${this.formatNumber(curseMoneyPenalty)} π-b$ (-25% de ganancias)`,
                    inline: false
                });
            }

            if (addResult.hitLimit) {
                const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
                await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
            }
        } else {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss');
            
            // ✅ NUEVO: Sistema de protección mejorado
            const user = await this.economy.getUser(userId);
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            
            let hasProtected = false;
            let protectionMessage = '';
            
            // 1️⃣ CONDÓN: 100% garantizado, 1 uso
            if (activeEffects['condon_pibe2']) {
                for (let i = activeEffects['condon_pibe2'].length - 1; i >= 0; i--) {
                    const effect = activeEffects['condon_pibe2'][i];
                    if (effect.type === 'protection' && effect.usesLeft > 0) {
                        hasProtected = true;
                        effect.usesLeft -= 1;
                        
                        if (effect.usesLeft <= 0) {
                            activeEffects['condon_pibe2'].splice(i, 1);
                            if (activeEffects['condon_pibe2'].length === 0) {
                                delete activeEffects['condon_pibe2'];
                            }
                        }
                        
                        await this.economy.updateUser(userId, { activeEffects });
                        protectionMessage = '🧃 ¡El Condón usado de Pibe 2 te protegió! (100% - último uso consumido)';
                        break;
                    }
                }
            }
            
            // 2️⃣ FORTUNE SHIELD: 80% probabilidad
            if (!hasProtected && activeEffects['fortune_shield']) {
                for (const effect of activeEffects['fortune_shield']) {
                    if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                        const roll = Math.random();
                        if (roll < 0.80) {
                            hasProtected = true;
                            protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió (80% de suerte)';
                        } else {
                            protectionMessage = '💔 Tu Escudo de la Fortuna falló esta vez (tenías 80% de protección)';
                        }
                        break;
                    }
                }
            }
            
            // 3️⃣ HEALTH POTION: 40% probabilidad
            if (!hasProtected && activeEffects['health_potion']) {
                for (const effect of activeEffects['health_potion']) {
                    if (effect.type === 'penalty_protection' && effect.expiresAt > Date.now()) {
                        const roll = Math.random();
                        if (roll < 0.40) {
                            hasProtected = true;
                            protectionMessage = '💊 Tu Poción de Salud redujo las penalizaciones (40% de suerte)';
                        } else {
                            protectionMessage = '💔 Tu Poción de Salud no pudo protegerte esta vez (tenías 40% de protección)';
                        }
                        break;
                    }
                }
            }
            
            // ✅ Aplicar protección o pérdida
            if (hasProtected) {
                await message.reply(protectionMessage);
            } else {
                if (protectionMessage) {
                    await message.reply(protectionMessage); // Mostrar que falló
                }
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
        await this.checkTreasureHunt(userId, message);

        const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
        const curse = activeEffects['death_hand_curse'];
        // Al final, después de crear el embed de resultado
        if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
            embed.addFields({
                name: '☠️ Maldición Activa',
                value: won 
                    ? `Tu ganancia fue reducida por la maldición (-25% dinero)`
                    : `La maldición empeoró tu suerte (-50% probabilidad)`,
                inline: false
            });
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

    const cacheKey = `${userId}-lottery`;
    const cachedCooldown = this.cooldownCache.get(cacheKey);
    const now = Date.now();
    
    let effectiveCooldown = await this.getEffectiveCooldown(this.config.lottery.cooldown, null);

    if (this.shop) {
        const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
        effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
    }
    
    if (cachedCooldown && (now - cachedCooldown < effectiveCooldown)) {
        const timeLeft = effectiveCooldown - (now - cachedCooldown);
        return {
            canLottery: false,
            timeLeft: timeLeft
        };
    }

    const lastLottery = user.last_lotto || 0;
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
                .setTitle('🎰 Lotería — Adivina el Número')
                .setDescription('> Elige un número del 1 al 100. Si aciertas, ganas **x75** tu apuesta.')
                .addFields(
                    { name: '📝 Uso', value: '`>lottery <número> <cantidad>`', inline: false },
                    { name: '💡 Ejemplos', value: '`>lottery 50 1000`\n`>lottery 7 2500`', inline: false },
                    { name: '🎯 Rango', value: `**${this.config.lottery.minNumber}** al **${this.config.lottery.maxNumber}**`, inline: true },
                    { name: '🏆 Ganancia', value: `**x${this.config.lottery.winMultiplier}** si aciertas`, inline: true },
                    { name: '📊 Probabilidad', value: '**1%** de ganar', inline: true },
                    { name: '💰 Apuesta', value: `**Mín:** ${this.formatNumber(this.config.lottery.minBet)} π-b$\n**Máx:** ${this.formatNumber(this.config.lottery.maxBet)} π-b$`, inline: true },
                    { name: '⏱️ Cooldown', value: '**5 minutos**', inline: true }
                )
                .setColor('#FF1493')
                .setFooter({ text: '1% de probabilidad, 100% de ganancia. ¿Te sientes con suerte?' });
            return message.reply({ embeds: [embed] });
        }
    
        // VERIFICAR LÍMITES
        const gameType = 'lottery';
        const limitConfig = this.dailyLimits[gameType];
        const status = await this.economy.database.getGameLimitStatus(userId, gameType, limitConfig.cycleHours);
        
        if (status.cycleCount >= limitConfig.perCycle) {
            await this.showLimitReached(message, userId, gameType, status, limitConfig);
            return;
        }
        
        // Verificar límite diario
        if (status.dailyCount >= limitConfig.maxDaily) {
            await message.reply(
                `🚫 **Límite diario alcanzado**\n` +
                `Has alcanzado el máximo de ${limitConfig.maxDaily} partidas de lotería por día.\n` +
                `🌅 Vuelve mañana!`
            );
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
        
        // Probabilidad 3% de recibir maldición aleatoria
        if (Math.random() < 0.03) {
            await this.economy.shop.applyRandomCurse(message.author.id);
            
            const curseNotif = new EmbedBuilder()
                .setTitle('☠️ ¡MALDICIÓN!')
                .setDescription('**La Mano del Muerto** apareció de la nada y te maldijo por 30 minutos.')
                .setColor('#8B0000');
            
            await message.reply({ embeds: [curseNotif] });
        }

        const winningNumber = Math.floor(Math.random() * 100) + 1;
        const baseWon = winningNumber === predictedNumber;
        let won = baseWon;
        let luckMessage = '';
        
        if (!baseWon) {
            // Solo aplicar suerte si perdió
            const luckCalc = await this.applyLuckToGame(0, userId, 'lottery');
            won = Math.random() < luckCalc.winChance;
            if (won) {
                luckMessage = luckCalc.luckMessage + '\n🎰 ¡Un milagro de la suerte!';
            }
        } else {
            // Si ganó naturalmente, mostrar suerte disponible
            const luckCalc = await this.applyLuckToGame(0.01, userId, 'lottery');
            luckMessage = luckCalc.luckMessage;
        }
        
        // Establecer cooldown
        this.setCooldown(userId, 'lottery');
        
        const updateData = {
            last_lotto: Date.now(),
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
                const trinityLol = await this.missions.checkTrinityCompletion(userId);            

                let allCompleted = [...gameMissions, ...betMissions, trinityLol];
                            
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

            // APLICAR EVENTOS DE DINERO
            const eventBonus = await this.applyEventEffects(userId, profit, 'minigames', message.guild?.id);
            let finalEarnings = eventBonus.finalAmount;
            
            // APLICAR ITEMS
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                const originalProfit = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                const vipBonus = finalEarnings - originalProfit;
                
                if (vipBonus > 0) {
                    await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                }
                await this.shop.consumeItemUse(userId, 'games');
            }

            const equipmentBonus = await this.shop.applyEquipmentBonus(userId);
            let equipmentMessage = '';
            
            if (equipmentBonus.applied && equipmentBonus.money > 0) {
                const extraMoney = Math.floor(finalEarnings * equipmentBonus.money);
                finalEarnings += extraMoney;
                
                // Generar mensaje de equipamiento
                for (const equip of equipmentBonus.items) {
                    equipmentMessage += `\n${equip.wasBroken ? '💔' : '🛡️'} **${equip.name}**: `;
                    
                    if (equip.wasBroken) {
                        equipmentMessage += `¡SE ROMPIÓ! (era ${equip.durabilityLost})`;
                    } else {
                        equipmentMessage += `${equip.durabilityLeft}/${equip.maxDurability} (-${equip.durabilityLost})`;
                    }
                }
                
                if (extraMoney > 0) {
                    equipmentMessage = `💰 +${this.formatNumber(extraMoney)} π-b$ (equipamiento)${equipmentMessage}`;
                }
            }

            const userData = await this.economy.getUser(userId);
            const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(userId) : this.economy.config.maxBalance;

            if (userData.balance + finalEarnings > userLimit) {
                const spaceLeft = userLimit - userData.balance;
                finalEarnings = Math.min(finalEarnings, spaceLeft);
            }
            
            // Obtener mensajes de items
            let itemMessage = '';
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                if (modifiers.multiplier > 1) {
                    itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                }
            }

            // ✅ Aplicar penalización de maldición (-25% dinero)
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            const curse = activeEffects['death_hand_curse'];
            let curseMoneyPenalty = 0;

            if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
                const penaltyAmount = Math.floor(finalEarnings * Math.abs(curse[0].moneyPenalty)); // 0.25 = 25%
                curseMoneyPenalty = penaltyAmount;
                finalEarnings -= penaltyAmount;
            }

            await this.economy.database.incrementGameLimit(userId, gameType);

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
                    { name: '🎉 Bonificaciones', value: this.formatGameBonuses(eventMessage, luckMessage, itemMessage, equipmentMessage), inline: false }
                );

            if (curseMoneyPenalty > 0) {
                embed.addFields({
                    name: '☠️ Penalización de Maldición',
                    value: `-${this.formatNumber(curseMoneyPenalty)} π-b$ (-25% de ganancias)`,
                    inline: false
                });
            }

            if (addResult.hitLimit) {
                const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
                await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
            }
        } else {
            await this.economy.database.incrementGameLimit(userId, gameType);
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss');
            
            // ✅ NUEVO: Sistema de protección mejorado
            const user = await this.economy.getUser(userId);
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            
            let hasProtected = false;
            let protectionMessage = '';
            
            // 1️⃣ CONDÓN: 100% garantizado, 1 uso
            if (activeEffects['condon_pibe2']) {
                for (let i = activeEffects['condon_pibe2'].length - 1; i >= 0; i--) {
                    const effect = activeEffects['condon_pibe2'][i];
                    if (effect.type === 'protection' && effect.usesLeft > 0) {
                        hasProtected = true;
                        effect.usesLeft -= 1;
                        
                        if (effect.usesLeft <= 0) {
                            activeEffects['condon_pibe2'].splice(i, 1);
                            if (activeEffects['condon_pibe2'].length === 0) {
                                delete activeEffects['condon_pibe2'];
                            }
                        }
                        
                        await this.economy.updateUser(userId, { activeEffects });
                        protectionMessage = '🧃 ¡El Condón usado de Pibe 2 te protegió! (100% - último uso consumido)';
                        break;
                    }
                }
            }
            
            // 2️⃣ FORTUNE SHIELD: 80% probabilidad
            if (!hasProtected && activeEffects['fortune_shield']) {
                for (const effect of activeEffects['fortune_shield']) {
                    if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                        const roll = Math.random();
                        if (roll < 0.80) {
                            hasProtected = true;
                            protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió (80% de suerte)';
                        } else {
                            protectionMessage = '💔 Tu Escudo de la Fortuna falló esta vez (tenías 80% de protección)';
                        }
                        break;
                    }
                }
            }
            
            // 3️⃣ HEALTH POTION: 40% probabilidad
            if (!hasProtected && activeEffects['health_potion']) {
                for (const effect of activeEffects['health_potion']) {
                    if (effect.type === 'penalty_protection' && effect.expiresAt > Date.now()) {
                        const roll = Math.random();
                        if (roll < 0.40) {
                            hasProtected = true;
                            protectionMessage = '💊 Tu Poción de Salud redujo las penalizaciones (40% de suerte)';
                        } else {
                            protectionMessage = '💔 Tu Poción de Salud no pudo protegerte esta vez (tenías 40% de protección)';
                        }
                        break;
                    }
                }
            }
            
            // ✅ Aplicar protección o pérdida
            if (hasProtected) {
                await message.reply(protectionMessage);
            } else {
                if (protectionMessage) {
                    await message.reply(protectionMessage); // Mostrar que falló
                }
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
        await this.checkTreasureHunt(userId, message);

        const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
        const curse = activeEffects['death_hand_curse'];
        // Al final, después de crear el embed de resultado
        if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
            resultEmbed.addFields({
                name: '☠️ Maldición Activa',
                value: won 
                    ? `Tu ganancia fue reducida por la maldición (-25% dinero)`
                    : `La maldición empeoró tu suerte (-50% probabilidad)`,
                inline: false
            });
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

    const cacheKey = `${userId}-blackjack`;
    const cachedCooldown = this.cooldownCache.get(cacheKey);
    const now = Date.now();
    
    let effectiveCooldown = await this.getEffectiveCooldown(this.config.blackjack.cooldown, null);

    if (this.shop) {
        const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
        effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
    }
    
    if (cachedCooldown && (now - cachedCooldown < effectiveCooldown)) {
        const timeLeft = effectiveCooldown - (now - cachedCooldown);
        return {
            canBlackJack: false,
            timeLeft: timeLeft
        };
    }

    const lastBlackJack = user.last_blackjack || 0;
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

        // VERIFICAR LÍMITES (igual que lottery/roulette)
        const gameType = 'blackjack';
        const limitConfig = this.dailyLimits[gameType];
        const status = await this.economy.database.getGameLimitStatus(userId, gameType, limitConfig.cycleHours);
        
        if (status.cycleCount >= limitConfig.perCycle) {
            await this.showLimitReached(message, userId, gameType, status, limitConfig);
            return;
        }

        if (status.dailyCount >= limitConfig.maxDaily) {
            await message.reply(
                `🚫 **Límite diario alcanzado**\n` +
                `Has alcanzado el máximo de ${limitConfig.maxDaily} partidas de blackjack por día.\n` +
                `🌅 Vuelve mañana!`
            );
            return;
        }

        // Si no hay argumentos suficientes, mostrar ayuda
        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setTitle('♠️ Blackjack — Vence al Dealer')
                .setDescription('> Llega lo más cerca posible a **21** sin pasarte. El clásico juego de cartas.')
                .addFields(
                    { name: '📝 Uso', value: '`>blackjack <cantidad>`', inline: false },
                    { name: '💡 Ejemplos', value: '`>blackjack 500`\n`>blackjack 5000`', inline: false },
                    {
                        name: '📋 Reglas',
                        value: [
                            '• As vale **1** u **11** (lo que convenga)',
                            '• Figuras (J, Q, K) valen **10**',
                            '• Superar 21 = **pierde automáticamente**',
                            '• Empate = **devuelve la apuesta**'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '🏆 Ganancias',
                        value: '**Victoria normal:** x1.9\n**Blackjack natural (21 en 2 cartas):** x2.3',
                        inline: false
                    },
                    {
                        name: '🎮 Controles',
                        value: '🎯 **Hit** — Pedir otra carta\n🛑 **Stand** — Plantarse\n🔄 **Double** — Doblar apuesta y recibir 1 carta',
                        inline: false
                    },
                    { name: '💰 Apuesta', value: `**Mín:** ${this.formatNumber(this.config.blackjack.minBet)} π-b$\n**Máx:** ${this.formatNumber(this.config.blackjack.maxBet)} π-b$`, inline: true },
                    { name: '⏱️ Cooldown', value: '**30 segundos**', inline: true }
                )
                .setColor('#2C2C2C')
                .setFooter({ text: 'Los items de suerte no aplican en este juego.' });
            return message.reply({ embeds: [embed] });
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

const userId = gameState.userId;
    
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
            const gameMissions = await this.missions.updateMissionProgress(userId, 'game_played');
            const betMissions = await this.missions.updateMissionProgress(userId, 'money_bet', betAmount);
	        const trinityLol = await this.missions.checkTrinityCompletion(userId);            

            let allCompleted = [...gameMissions, ...betMissions, trinityLol];
                        
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
        setTimeout(async () => {
            if (this.activeGames.has(`blackjack_${gameState.userId}`)) {
                try {
                    // Crear un objeto fake que simula una interaction para el timeout
                    const channel = await this.client.channels.fetch(gameState.channelId);
                    const originalMessage = await channel.messages.fetch(gameState.messageId);
                    
                    const fakeInteraction = {
                        deferUpdate: async () => {},
                        editReply: async (options) => { await originalMessage.edit(options); },
                        followUp: async (options) => { await channel.send(options); },
                    };
                    
                    this.handleBlackjackAction(fakeInteraction, gameState.userId, 'stand');
                } catch (e) {
                    // Si falla, al menos limpiar el juego
                    this.activeGames.delete(`blackjack_${gameState.userId}`);
                    console.log(`⏰ Blackjack timeout para ${gameState.userId} - juego cancelado`);
                }
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

    async handleHorseRaceButtons(interaction) {
        const gameKey = `horserace_${interaction.channelId}`;
        const game = this.activeGames.get(gameKey);
        
        if (!game) {
            await interaction.reply({ 
                content: '❌ No hay carrera activa en este canal', 
                ephemeral: true 
            });
            return;
        }
        
        if (game.phase !== 'racing') {
            await interaction.reply({ 
                content: '❌ La carrera no está en curso', 
                ephemeral: true 
            });
            return;
        }
        
        const userId = interaction.user.id;
        const player = game.players[userId];
        
        if (!player) {
            await interaction.reply({ 
                content: '❌ No estás participando en esta carrera', 
                ephemeral: true 
            });
            return;
        }
        
        if (player.hasDoubled) {
            await interaction.reply({ 
                content: '❌ Ya doblaste tu apuesta anteriormente', 
                ephemeral: true 
            });
            return;
        }
        
        // ✅ SI EL BOTÓN ESTÁ ACTIVO, DEJAMOS DOBLAR (sin verificar progreso)
        // El botón se deshabilita automáticamente al 75%
        
        // Verificar que tenga suficiente dinero
        const user = await this.economy.getUser(userId);
        if (user.balance < player.bet) {
            await interaction.reply({ 
                content: `❌ No tienes suficiente dinero para doblar\nNecesitas: ${this.formatNumber(player.bet)} π-b$\nTienes: ${this.formatNumber(user.balance)} π-b$`, 
                ephemeral: true 
            });
            return;
        }
        
        // ✅ DOBLAR APUESTA
        await this.economy.removeMoney(userId, player.bet, 'horserace_double');
        player.hasDoubled = true;
        
        if (game.mode === 'multi') {
            game.pot += player.bet;
        }
        
        const newBetAmount = player.bet * 2;
        
        await interaction.reply({ 
            content: `🎲 **¡Apuesta doblada!**\n` +
                    `Apuesta original: ${this.formatNumber(player.bet)} π-b$\n` +
                    `Nueva apuesta total: ${this.formatNumber(newBetAmount)} π-b$\n` +
                    `${game.horses[player.horseIndex].emoji} ¡Vamos!`,
            ephemeral: true 
        });
    }
    
    async blackjackHit(interaction, gameState) {
        const newCard = this.drawCard(gameState.deck);
        gameState.playerHand.push(newCard);
        
        const playerValue = this.calculateHandValue(gameState.playerHand);

        const userId = gameState.userId;
        
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
            last_blackjack: Date.now(),
        };
        
        let profit = 0;
        let resultText = '';
        let color = '#FF0000';

        let finalEarnings = 0;
        let eventMessage = '';
        let itemMessage = '';
        const gameType = 'blackjack';

        let addResult;
        let userData;
        const equipmentBonus = await this.shop.applyEquipmentBonus(userId);
        let equipmentMessage = '';        
        const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
        let hasProtected = false;
        let protectionMessage = '';
        const curse = activeEffects['death_hand_curse'];
        let curseMoneyPenalty = 0;

        switch (result) {
            case 'blackjack':
                await this.economy.missions.updateMissionProgress(userId, 'consecutive_win');
                await this.economy.missions.updateMissionProgress(userId, 'game_won');
                
                const blackjackWin = Math.floor(betAmount * this.config.blackjack.blackjackMultiplier);
                profit = blackjackWin - betAmount;
                resultText = '🎉 **¡BLACKJACK NATURAL!**';
                color = '#00FF00';

                // APLICAR EVENTOS DE DINERO
                const eventBonus = await this.applyEventEffects(userId, profit, 'minigames', message.guild?.id);
                finalEarnings = eventBonus.finalAmount;
                
                // APLICAR ITEMS
                if (this.shop) {
                    const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                    const originalProfit = finalEarnings;
                    finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                    const vipBonus = finalEarnings - originalProfit;
                    
                    if (vipBonus > 0) {
                        await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                    }
                    await this.shop.consumeItemUse(userId, 'games');
                }

                // Obtener mensajes de items
                if (this.shop) {
                    const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                    if (modifiers.multiplier > 1) {
                        itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                    }
                }

                if (equipmentBonus.applied && equipmentBonus.money > 0) {
                    const extraMoney = Math.floor(finalEarnings * equipmentBonus.money);
                    finalEarnings += extraMoney;
                    
                    // Generar mensaje de equipamiento
                    for (const equip of equipmentBonus.items) {
                        equipmentMessage += `\n${equip.wasBroken ? '💔' : '🛡️'} **${equip.name}**: `;
                        
                        if (equip.wasBroken) {
                            equipmentMessage += `¡SE ROMPIÓ! (era ${equip.durabilityLost})`;
                        } else {
                            equipmentMessage += `${equip.durabilityLeft}/${equip.maxDurability} (-${equip.durabilityLost})`;
                        }
                    }
                    
                    if (extraMoney > 0) {
                        equipmentMessage = `💰 +${this.formatNumber(extraMoney)} π-b$ (equipamiento)${equipmentMessage}`;
                    }
                }

                await this.economy.database.incrementGameLimit(userId, gameType);

                userData = await this.economy.getUser(userId);
                if (userData.balance + finalEarnings > this.economy.config.maxBalance) {
                    const spaceLeft = this.economy.config.maxBalance - userData.balance;
                    finalEarnings = Math.min(finalEarnings, spaceLeft);
                }

                if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
                    const penaltyAmount = Math.floor(finalEarnings * Math.abs(curse[0].moneyPenalty)); // 0.25 = 25%
                    curseMoneyPenalty = penaltyAmount;
                    finalEarnings -= penaltyAmount;
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

                // APLICAR EVENTOS DE DINERO
                const eventBonuss = await this.applyEventEffects(userId, profit, 'minigames', message.guild?.id);
                finalEarnings = eventBonuss.finalAmount;
                
                // APLICAR ITEMS
                if (this.shop) {
                    const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                    const originalProfit = finalEarnings;
                    finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                    const vipBonus = finalEarnings - originalProfit;
                    
                    if (vipBonus > 0) {
                        await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                    }
                    await this.shop.consumeItemUse(userId, 'games');
                }

                if (this.shop) {
                    const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                    if (modifiers.multiplier > 1) {
                        itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                    }
                }

                if (equipmentBonus.applied && equipmentBonus.money > 0) {
                    const extraMoney = Math.floor(finalEarnings * equipmentBonus.money);
                    finalEarnings += extraMoney;
                    
                    // Generar mensaje de equipamiento
                    for (const equip of equipmentBonus.items) {
                        equipmentMessage += `\n${equip.wasBroken ? '💔' : '🛡️'} **${equip.name}**: `;
                        
                        if (equip.wasBroken) {
                            equipmentMessage += `¡SE ROMPIÓ! (era ${equip.durabilityLost})`;
                        } else {
                            equipmentMessage += `${equip.durabilityLeft}/${equip.maxDurability} (-${equip.durabilityLost})`;
                        }
                    }
                    
                    if (extraMoney > 0) {
                        equipmentMessage = `💰 +${this.formatNumber(extraMoney)} π-b$ (equipamiento)${equipmentMessage}`;
                    }
                }

                await this.economy.database.incrementGameLimit(userId, gameType);

                userData = await this.economy.getUser(userId);
                if (userData.balance + finalEarnings > this.economy.config.maxBalance) {
                    const spaceLeft = this.economy.config.maxBalance - userData.balance;
                    finalEarnings = Math.min(finalEarnings, spaceLeft);
                }
                
                if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
                    const penaltyAmount = Math.floor(finalEarnings * Math.abs(curse[0].moneyPenalty)); // 0.25 = 25%
                    curseMoneyPenalty = penaltyAmount;
                    finalEarnings -= penaltyAmount;
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

                await this.economy.database.incrementGameLimit(userId, gameType);

                // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
                if (this.achievements) {
                    await this.achievements.updateStats(userId, 'game_played');
                    await this.achievements.updateStats(userId, 'money_bet', finalBet);
                }
                break;
            case 'bust':
                resultText = '💥 **¡TE PASASTE!**';
                profit = -finalBet;

                await this.economy.database.incrementGameLimit(userId, gameType);
                await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss');
                
                // 1️⃣ CONDÓN: 100% garantizado, 1 uso
                if (activeEffects['condon_pibe2']) {
                    for (let i = activeEffects['condon_pibe2'].length - 1; i >= 0; i--) {
                        const effect = activeEffects['condon_pibe2'][i];
                        if (effect.type === 'protection' && effect.usesLeft > 0) {
                            hasProtected = true;
                            effect.usesLeft -= 1;
                            
                            if (effect.usesLeft <= 0) {
                                activeEffects['condon_pibe2'].splice(i, 1);
                                if (activeEffects['condon_pibe2'].length === 0) {
                                    delete activeEffects['condon_pibe2'];
                                }
                            }
                            
                            await this.economy.updateUser(userId, { activeEffects });
                            protectionMessage = '🧃 ¡El Condón usado de Pibe 2 te protegió! (100% - último uso consumido)';
                            break;
                        }
                    }
                }
                
                // 2️⃣ FORTUNE SHIELD: 80% probabilidad
                if (!hasProtected && activeEffects['fortune_shield']) {
                    for (const effect of activeEffects['fortune_shield']) {
                        if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                            const roll = Math.random();
                            if (roll < 0.80) {
                                hasProtected = true;
                                protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió (80% de suerte)';
                            } else {
                                protectionMessage = '💔 Tu Escudo de la Fortuna falló esta vez (tenías 80% de protección)';
                            }
                            break;
                        }
                    }
                }
                
                // 3️⃣ HEALTH POTION: 40% probabilidad
                if (!hasProtected && activeEffects['health_potion']) {
                    for (const effect of activeEffects['health_potion']) {
                        if (effect.type === 'penalty_protection' && effect.expiresAt > Date.now()) {
                            const roll = Math.random();
                            if (roll < 0.40) {
                                hasProtected = true;
                                protectionMessage = '💊 Tu Poción de Salud redujo las penalizaciones (40% de suerte)';
                            } else {
                                protectionMessage = '💔 Tu Poción de Salud no pudo protegerte esta vez (tenías 40% de protección)';
                            }
                            break;
                        }
                    }
                }
                
                // ✅ Aplicar protección o pérdida
                if (hasProtected) {
                    if (messageOrInteraction?.followUp) {
                        await messageOrInteraction.followUp({ content: protectionMessage, ephemeral: false });
                    }
                } else {
                    if (protectionMessage && messageOrInteraction?.followUp) {
                        await messageOrInteraction.followUp({ content: protectionMessage, ephemeral: false });
                    }
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
                resultText = '💸 **Perdiste...**';
                profit = -finalBet;

                await this.economy.database.incrementGameLimit(userId, gameType);
                await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss');
                
                // 1️⃣ CONDÓN: 100% garantizado, 1 uso
                if (activeEffects['condon_pibe2']) {
                    for (let i = activeEffects['condon_pibe2'].length - 1; i >= 0; i--) {
                        const effect = activeEffects['condon_pibe2'][i];
                        if (effect.type === 'protection' && effect.usesLeft > 0) {
                            hasProtected = true;
                            effect.usesLeft -= 1;
                            
                            if (effect.usesLeft <= 0) {
                                activeEffects['condon_pibe2'].splice(i, 1);
                                if (activeEffects['condon_pibe2'].length === 0) {
                                    delete activeEffects['condon_pibe2'];
                                }
                            }
                            
                            await this.economy.updateUser(userId, { activeEffects });
                            protectionMessage = '🧃 ¡El Condón usado de Pibe 2 te protegió! (100% - último uso consumido)';
                            break;
                        }
                    }
                }
                
                // 2️⃣ FORTUNE SHIELD: 80% probabilidad
                if (!hasProtected && activeEffects['fortune_shield']) {
                    for (const effect of activeEffects['fortune_shield']) {
                        if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                            const roll = Math.random();
                            if (roll < 0.80) {
                                hasProtected = true;
                                protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió (80% de suerte)';
                            } else {
                                protectionMessage = '💔 Tu Escudo de la Fortuna falló esta vez (tenías 80% de protección)';
                            }
                            break;
                        }
                    }
                }
                
                // 3️⃣ HEALTH POTION: 40% probabilidad
                if (!hasProtected && activeEffects['health_potion']) {
                    for (const effect of activeEffects['health_potion']) {
                        if (effect.type === 'penalty_protection' && effect.expiresAt > Date.now()) {
                            const roll = Math.random();
                            if (roll < 0.40) {
                                hasProtected = true;
                                protectionMessage = '💊 Tu Poción de Salud redujo las penalizaciones (40% de suerte)';
                            } else {
                                protectionMessage = '💔 Tu Poción de Salud no pudo protegerte esta vez (tenías 40% de protección)';
                            }
                            break;
                        }
                    }
                }
                
                // ✅ Aplicar protección o pérdida
                if (hasProtected) {
                    if (messageOrInteraction?.followUp) {
                        await messageOrInteraction.followUp({ content: protectionMessage, ephemeral: false });
                    }
                } else {
                    if (protectionMessage && messageOrInteraction?.followUp) {
                        await messageOrInteraction.followUp({ content: protectionMessage, ephemeral: false });
                    }
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
                { name: '🎉 Bonificaciones', value: this.formatGameBonuses(eventMessage, '', itemMessage, equipmentMessage), inline: false }
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

        if (curseMoneyPenalty > 0) {
            embed.addFields({
                name: '☠️ Penalización de Maldición',
                value: `-${this.formatNumber(curseMoneyPenalty)} π-b$ (-25% de ganancias)`,
                inline: false
            });
        }
    
        embed.setTimestamp(); 
    
        // Enviar resultado
        if (!messageOrInteraction) {
            // Timeout automático - buscar el canal y editar el mensaje directamente
            try {
                const gameChannel = await this.economy.database.pool.execute
                    ? null : null; // No tenemos referencia al canal aquí
                // El timeout solo hace stand, el resultado igual se muestra vía editReply del mensaje guardado
            } catch {}
        } else if (messageOrInteraction.editReply) {
            await messageOrInteraction.editReply({ embeds: [embed], components: [] });
        } else if (messageOrInteraction.reply) {
            await messageOrInteraction.reply({ embeds: [embed] });
        }

        if (addResult && addResult.hitLimit) {
            const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
            await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
        }

        // Verificar tesoros al final
        const guildId = messageOrInteraction?.guild?.id || messageOrInteraction?.guildId;
        for (const event of this.events.getActiveEvents(guildId)) {
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

    const cacheKey = `${userId}-roulette`;
    const cachedCooldown = this.cooldownCache.get(cacheKey);
    const now = Date.now();
    
    let effectiveCooldown = await this.getEffectiveCooldown(this.config.roulette.cooldown, null);

    if (this.shop) {
        const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
        effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
    }
    
    if (cachedCooldown && (now - cachedCooldown < effectiveCooldown)) {
        const timeLeft = effectiveCooldown - (now - cachedCooldown);
        return {
            canRoulette: false,
            timeLeft: timeLeft
        };
    }

    const lastRoulette = user.last_roulette || 0;
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

        // VERIFICAR LÍMITES (igual que lottery)
        const gameType = 'roulette';
        const limitConfig = this.dailyLimits[gameType];
        const status = await this.economy.database.getGameLimitStatus(userId, gameType, limitConfig.cycleHours);
        
        if (status.cycleCount >= limitConfig.perCycle) {
            await this.showLimitReached(message, userId, gameType, status, limitConfig);
            return;
        }

        if (status.dailyCount >= limitConfig.maxDaily) {
            await message.reply(
                `🚫 **Límite diario alcanzado**\n` +
                `Has alcanzado el máximo de ${limitConfig.maxDaily} partidas de blackjack por día.\n` +
                `🌅 Vuelve mañana!`
            );
            return;
        }

        // Si no hay argumentos suficientes, mostrar ayuda
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setTitle('🎡 Ruleta — Casino Europeo')
                .setDescription('> Apuesta a un número, color o rango. A mayor riesgo, mayor ganancia.')
                .addFields(
                    { name: '📝 Uso', value: '`>roulette <tipo> <cantidad>`', inline: false },
                    {
                        name: '🎯 Tipos de Apuesta',
                        value: [
                            '**Número exacto** `0-36` → **x32**',
                            '**Verde** `verde` → **x34**',
                            '**Color** `rojo` / `negro` → **x1.85**',
                            '**Paridad** `par` / `impar` → **x1.85**',
                            '**Rango** `alto` (19-36) / `bajo` (1-18) → **x1.85**',
                            '**Docena** `1era` / `2da` / `3era` → **x2.7**',
                            '**Columna** `col1` / `col2` / `col3` → **x2.7**'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '💡 Ejemplos',
                        value: '`>roulette 7 1000` — Al número 7\n`>roulette rojo 500` — Al rojo\n`>roulette 1era 2000` — A la 1era docena',
                        inline: false
                    },
                    { name: '💰 Apuesta', value: `**Mín:** ${this.formatNumber(this.config.roulette.minBet)} π-b$\n**Máx:** ${this.formatNumber(this.config.roulette.maxBet)} π-b$`, inline: true },
                    { name: '⏱️ Cooldown', value: '**20 segundos**', inline: true }
                )
                .setColor('#8B0000')
                .setFooter({ text: 'La bola decide. ¿Dónde apostás?' });
            return message.reply({ embeds: [embed] });
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
    
        // Probabilidad 3% de recibir maldición aleatoria
        if (Math.random() < 0.03) {
            await this.economy.shop.applyRandomCurse(message.author.id);
            
            const curseNotif = new EmbedBuilder()
                .setTitle('☠️ ¡MALDICIÓN!')
                .setDescription('**La Mano del Muerto** apareció de la nada y te maldijo por 30 minutos.')
                .setColor('#8B0000');
            
            await message.reply({ embeds: [curseNotif] });
        }

        // GIRAR RULETA
        const spinResult = this.spinRoulette();
        const baseWon = this.checkRouletteWin(validBet, spinResult);
        let won = baseWon;
        let luckMessage = '';
        
        // Determinar tipo para suerte
        const luckGameType = validBet.type === 'straight' ? 'roulette_straight' : 'roulette_color';
        
        if (!baseWon) {
            const luckCalc = await this.applyLuckToGame(0, userId, luckGameType);
            won = Math.random() < luckCalc.winChance;
            if (won) {
                luckMessage = luckCalc.luckMessage + '\n🎰 ¡La suerte cambió tu destino!';
            }
        } else {
            const baseChance = validBet.type === 'straight' ? (1/37) : (18/37);
            const luckCalc = await this.applyLuckToGame(baseChance, userId, luckGameType);
            luckMessage = luckCalc.luckMessage;
        }

        // Establecer cooldown
        this.setCooldown(userId, 'roulette');
    
        const updateData = {
            last_roulette: Date.now(),
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
            .setTitle('🎡 Ruleta - Resultado')
            .setColor(won ? '#00FF00' : '#FF0000')
            .addFields(
                { name: '🎯 Tu Apuesta', value: `**${validBet.displayName}**`, inline: true },
                { name: '🎡 Número Ganador', value: `${this.formatRouletteNumber(spinResult)}`, inline: true },
                { name: '💰 Apuesta', value: `${this.formatNumber(betAmount)} π-b$`, inline: true }
            )
            .setTimestamp();

            if (this.missions) {
                // Siempre actualizar que jugó y apostó
                const gameMissions = await this.missions.updateMissionProgress(userId, 'game_played');
                const betMissions = await this.missions.updateMissionProgress(userId, 'money_bet', betAmount);
                const trinityLol = await this.missions.checkTrinityCompletion(userId);            

                let allCompleted = [...gameMissions, ...betMissions, trinityLol];
                            
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

            // APLICAR EVENTOS DE DINERO
            const eventBonus = await this.applyEventEffects(userId, profit, 'minigames', message.guild?.id);
            let finalEarnings = eventBonus.finalAmount;
            
            // APLICAR ITEMS
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                const originalProfit = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                const vipBonus = finalEarnings - originalProfit;
                
                if (vipBonus > 0) {
                    await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                }
                await this.shop.consumeItemUse(userId, 'games');
            }

            const equipmentBonus = await this.shop.applyEquipmentBonus(userId);
            let equipmentMessage = '';
            
            if (equipmentBonus.applied && equipmentBonus.money > 0) {
                const extraMoney = Math.floor(finalEarnings * equipmentBonus.money);
                finalEarnings += extraMoney;
                
                // Generar mensaje de equipamiento
                for (const equip of equipmentBonus.items) {
                    equipmentMessage += `\n${equip.wasBroken ? '💔' : '🛡️'} **${equip.name}**: `;
                    
                    if (equip.wasBroken) {
                        equipmentMessage += `¡SE ROMPIÓ! (era ${equip.durabilityLost})`;
                    } else {
                        equipmentMessage += `${equip.durabilityLeft}/${equip.maxDurability} (-${equip.durabilityLost})`;
                    }
                }
                
                if (extraMoney > 0) {
                    equipmentMessage = `💰 +${this.formatNumber(extraMoney)} π-b$ (equipamiento)${equipmentMessage}`;
                }
            }

            const userData = await this.economy.getUser(userId);
            const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(userId) : this.economy.config.maxBalance;

            if (userData.balance + finalEarnings > userLimit) {
                const spaceLeft = userLimit - userData.balance;
                finalEarnings = Math.min(finalEarnings, spaceLeft);
            }

            // Obtener mensajes de items
            let itemMessage = '';
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                if (modifiers.multiplier > 1) {
                    itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                }
            }

            await this.economy.database.incrementGameLimit(userId, gameType);

            // ✅ Aplicar penalización de maldición (-25% dinero)
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            const curse = activeEffects['death_hand_curse'];
            let curseMoneyPenalty = 0;

            if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
                const penaltyAmount = Math.floor(finalEarnings * Math.abs(curse[0].moneyPenalty)); // 0.25 = 25%
                curseMoneyPenalty = penaltyAmount;
                finalEarnings -= penaltyAmount;
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
                    { name: '🎉 Bonificaciones', value: this.formatGameBonuses(eventMessage, luckMessage, itemMessage, equipmentMessage), inline: false }
                );
    
            // Mensaje especial para números exactos
            if (validBet.type === 'straight') {
                resultEmbed.addFields({ 
                    name: '🌟 ¡Número Exacto!', 
                    value: '¡Increíble suerte! Acertaste el número exacto.', 
                    inline: false 
                });
            } 

            if (curseMoneyPenalty > 0) {
                resultEmbed.addFields({
                    name: '☠️ Penalización de Maldición',
                    value: `-${this.formatNumber(curseMoneyPenalty)} π-b$ (-25% de ganancias)`,
                    inline: false
                });
            }

            if (addResult.hitLimit) {
                const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
                await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
            }
        } else {
            await this.economy.database.incrementGameLimit(userId, gameType);
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss');
            
            // ✅ NUEVO: Sistema de protección mejorado
            const user = await this.economy.getUser(userId);
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            
            let hasProtected = false;
            let protectionMessage = '';
            
            // 1️⃣ CONDÓN: 100% garantizado, 1 uso
            if (activeEffects['condon_pibe2']) {
                for (let i = activeEffects['condon_pibe2'].length - 1; i >= 0; i--) {
                    const effect = activeEffects['condon_pibe2'][i];
                    if (effect.type === 'protection' && effect.usesLeft > 0) {
                        hasProtected = true;
                        effect.usesLeft -= 1;
                        
                        if (effect.usesLeft <= 0) {
                            activeEffects['condon_pibe2'].splice(i, 1);
                            if (activeEffects['condon_pibe2'].length === 0) {
                                delete activeEffects['condon_pibe2'];
                            }
                        }
                        
                        await this.economy.updateUser(userId, { activeEffects });
                        protectionMessage = '🧃 ¡El Condón usado de Pibe 2 te protegió! (100% - último uso consumido)';
                        break;
                    }
                }
            }
            
            // 2️⃣ FORTUNE SHIELD: 80% probabilidad
            if (!hasProtected && activeEffects['fortune_shield']) {
                for (const effect of activeEffects['fortune_shield']) {
                    if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                        const roll = Math.random();
                        if (roll < 0.80) {
                            hasProtected = true;
                            protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió (80% de suerte)';
                        } else {
                            protectionMessage = '💔 Tu Escudo de la Fortuna falló esta vez (tenías 80% de protección)';
                        }
                        break;
                    }
                }
            }
            
            // 3️⃣ HEALTH POTION: 40% probabilidad
            if (!hasProtected && activeEffects['health_potion']) {
                for (const effect of activeEffects['health_potion']) {
                    if (effect.type === 'penalty_protection' && effect.expiresAt > Date.now()) {
                        const roll = Math.random();
                        if (roll < 0.40) {
                            hasProtected = true;
                            protectionMessage = '💊 Tu Poción de Salud redujo las penalizaciones (40% de suerte)';
                        } else {
                            protectionMessage = '💔 Tu Poción de Salud no pudo protegerte esta vez (tenías 40% de protección)';
                        }
                        break;
                    }
                }
            }
            
            // ✅ Aplicar protección o pérdida
            if (hasProtected) {
                await message.reply(protectionMessage);
            } else {
                if (protectionMessage) {
                    await message.reply(protectionMessage); // Mostrar que falló
                }
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
        await this.checkTreasureHunt(userId, message);

        const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
        const curse = activeEffects['death_hand_curse'];
        // Al final, después de crear el embed de resultado
        if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
            resultEmbed.addFields({
                name: '☠️ Maldición Activa',
                value: won 
                    ? `Tu ganancia fue reducida por la maldición (-25% dinero)`
                    : `La maldición empeoró tu suerte (-50% probabilidad)`,
                inline: false
            });
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

    async canSlots(userId) {
        const user = await this.economy.getUser(userId);

        if (this.shop) {
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.noCooldown) {
                return { canSlots: true };
            }
        }

        const lastSlots = user.last_slots || 0;
        const now = Date.now();
        let effectiveCooldown = await this.getEffectiveCooldown(this.config.slots.cooldown, null);

        if (now - lastSlots < effectiveCooldown) {
            const timeLeft = effectiveCooldown - (now - lastSlots);
            return {
                canSlots: false,
                timeLeft: timeLeft
            };
        }

        return { canSlots: true };
    }

    async handleSlots(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
        
        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setTitle('🎰 Tragaperras — Máquina de la Suerte')
                .setDescription('> Gira la máquina y consigue **3 símbolos iguales** para ganar.')
                .addFields(
                    { name: '📝 Uso', value: '`>slots <cantidad>`', inline: false },
                    {
                        name: '💎 Tabla de Premios',
                        value: [
                            '💎 💎 💎 — **x50** (Jackpot)',
                            '🍒 🍒 🍒 — **x20**',
                            '🔔 🔔 🔔 — **x10**',
                            '🍋 🍋 🍋 — **x5**',
                            '⭐ ⭐ ⭐ — **x3**',
                            '7️⃣ 7️⃣ 7️⃣ — **x2.5**',
                            '2 iguales — **50%** de la apuesta'
                        ].join('\n'),
                        inline: false
                    },
                    { name: '💰 Apuesta', value: `**Mín:** ${this.formatNumber(this.config.slots.minBet)} π-b$\n**Máx:** ${this.formatNumber(this.config.slots.maxBet)} π-b$`, inline: true },
                    { name: '⏱️ Cooldown', value: '**1 minuto**', inline: true }
                )
                .setColor('#FFD700')
                .setFooter({ text: '💎 El Jackpot es ultra raro. ¿Tenés suerte hoy?' });
            return message.reply({ embeds: [embed] });
        }

        const betAmount = parseInt(args[1]);
        
        if (isNaN(betAmount) || betAmount < this.config.slots.minBet || betAmount > this.config.slots.maxBet) {
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.slots.minBet)} y ${this.formatNumber(this.config.slots.maxBet)} π-b$`);
            return;
        }
        
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes π-b Coins. Tu balance: ${this.formatNumber(user.balance)} π-b$`);
            return;
        }

        // VERIFICAR LÍMITES
        const gameType = 'slots';
        const limitConfig = this.dailyLimits[gameType];
        const status = await this.economy.database.getGameLimitStatus(userId, gameType, limitConfig.cycleHours);

        if (status.cycleCount >= limitConfig.perCycle) {
            await this.showLimitReached(message, userId, gameType, status, limitConfig);
            return;
        }

        if (status.dailyCount >= limitConfig.maxDaily) {
            await message.reply(
                `🚫 **Límite diario alcanzado**\n` +
                `Has alcanzado el máximo de ${limitConfig.maxDaily} partidas de slots por día.\n` +
                `🌅 Vuelve mañana!`
            );
            return;
        }

        const canSlotsResult = await this.canSlots(userId);
        if (!canSlotsResult.canSlots) {
            await message.reply(`⏰ Debes esperar ${this.formatTime(canSlotsResult.timeLeft)} antes de jugar otra vez`);
            return;
        }

        // Animación de giro
        await this.spinSlotMachine(message, userId, betAmount);
    }

    async spinSlotMachine(message, userId, betAmount) {
        const user = await this.economy.getUser(userId);
        
        // Generar resultado BASE (sin suerte)
        const baseResult = this.generateSlotResult();
        
        this.setCooldown(userId, 'slots');
        
        // ANIMACIÓN: Crear mensaje inicial
        const spinEmbed = new EmbedBuilder()
            .setTitle('🎰 Tragaperras Girando...')
            .setDescription('```\n🎲 | 🎲 | 🎲\n```')
            .setColor('#FFD700');
        
        const reply = await message.reply({ embeds: [spinEmbed] });
        
        // Simular giros (5 ediciones)
        const symbols = Object.keys(this.config.slots.symbols);
        for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 400));
            
            const random1 = symbols[Math.floor(Math.random() * symbols.length)];
            const random2 = symbols[Math.floor(Math.random() * symbols.length)];
            const random3 = symbols[Math.floor(Math.random() * symbols.length)];
            
            spinEmbed.setDescription(`\`\`\`\n${random1} | ${random2} | ${random3}\n\`\`\``);
            await reply.edit({ embeds: [spinEmbed] });
        }
        
        // APLICAR SUERTE para determinar si gana
        const [slot1, slot2, slot3] = baseResult.symbols;
        
        // Calcular probabilidad base de ganar
        let baseWinChance = 0;
        const isNaturalJackpot = slot1 === slot2 && slot2 === slot3 && slot1 === this.config.slots.jackpotSymbol;
        const isNaturalTriple = slot1 === slot2 && slot2 === slot3;
        const isNaturalDouble = (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) && !isNaturalTriple;
        
        if (isNaturalJackpot) {
            baseWinChance = 0.001; // 0.1% jackpot natural
        } else if (isNaturalTriple) {
            baseWinChance = 0.05; // 5% triple natural
        } else if (isNaturalDouble) {
            baseWinChance = 0.15; // 15% doble natural
        }
        
        // APLICAR SUERTE 🍀
        const luckCalc = await this.applyLuckToGame(baseWinChance, userId, 'slots');
        const wonByLuck = Math.random() < luckCalc.winChance;
        
        let finalResult;
        let luckMessage = '';
        
        if (isNaturalJackpot || isNaturalTriple || isNaturalDouble) {
            // Ganó naturalmente
            finalResult = {
                symbols: baseResult.symbols,
                isJackpot: isNaturalJackpot,
                isTriple: isNaturalTriple,
                isDouble: isNaturalDouble,
                wonByLuck: false
            };
            
            // Mostrar suerte disponible
            if (luckCalc.luckMessage) {
                luckMessage = luckCalc.luckMessage;
            }
        } else if (wonByLuck) {
            // La suerte cambió el resultado 🎰✨
            // Decidir qué tipo de premio dar
            const luckRoll = Math.random();
            
            if (luckRoll < 0.05) {
                // 5% - Jackpot por suerte
                const jackpotSymbol = this.config.slots.jackpotSymbol;
                finalResult = {
                    symbols: [jackpotSymbol, jackpotSymbol, jackpotSymbol],
                    isJackpot: true,
                    isTriple: true,
                    isDouble: false,
                    wonByLuck: true
                };
            } else if (luckRoll < 0.35) {
                // 30% - Triple por suerte
                const luckySymbol = baseResult.symbols[0];
                finalResult = {
                    symbols: [luckySymbol, luckySymbol, luckySymbol],
                    isJackpot: luckySymbol === this.config.slots.jackpotSymbol,
                    isTriple: true,
                    isDouble: false,
                    wonByLuck: true
                };
            } else {
                // 65% - Doble por suerte
                finalResult = {
                    symbols: [baseResult.symbols[0], baseResult.symbols[0], baseResult.symbols[2]],
                    isJackpot: false,
                    isTriple: false,
                    isDouble: true,
                    wonByLuck: true
                };
            }
            
            luckMessage = luckCalc.luckMessage + '\n🎰 ¡La suerte cambió el resultado!';
        } else {
            // Perdió
            finalResult = {
                symbols: baseResult.symbols,
                isJackpot: false,
                isTriple: false,
                isDouble: false,
                wonByLuck: false
            };
        }
        
        // Mostrar resultado final
        await new Promise(resolve => setTimeout(resolve, 800));
        
        spinEmbed.setDescription(`\`\`\`\n${finalResult.symbols[0]} | ${finalResult.symbols[1]} | ${finalResult.symbols[2]}\n\`\`\``);
        
        // Procesar resultado
        await this.processSlotResult(message, userId, betAmount, finalResult, spinEmbed, reply, luckMessage);
    }

    generateSlotResult() {
        const symbols = Object.keys(this.config.slots.symbols);
        const weights = Object.values(this.config.slots.symbols).map(s => s.weight);
        
        // Función para elegir símbolo basado en pesos
        const pickSymbol = () => {
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let random = Math.random() * totalWeight;
            
            for (let i = 0; i < symbols.length; i++) {
                random -= weights[i];
                if (random <= 0) return symbols[i];
            }
            return symbols[symbols.length - 1];
        };
        
        return {
            symbols: [pickSymbol(), pickSymbol(), pickSymbol()]
        };
    }

    async getRussianGame(gameId) {
        try {
            return await this.economy.database.getRussianGame(gameId);
        } catch (error) {
            console.error('⚠️ Error obteniendo partida:', error);
            return null;
        }
    }

    async processSlotResult(message, userId, betAmount, result, embed, reply, luckMessage) {
        const user = await this.economy.getUser(userId);
        
        const updateData = {
            last_slots: Date.now(),
        };
        
        // Misiones
        if (this.missions) {
            const gameMissions = await this.missions.updateMissionProgress(userId, 'game_played');
            const betMissions = await this.missions.updateMissionProgress(userId, 'money_bet', betAmount);
            const trinityLol = await this.missions.checkTrinityCompletion(userId);
            
            let allCompleted = [...gameMissions, ...betMissions, trinityLol];
            if (allCompleted.length > 0) {
                await this.missions.notifyCompletedMissions(message, allCompleted);
            }
        }
        
        // Probabilidad 3% de recibir maldición aleatoria
        if (Math.random() < 0.03) {
            await this.economy.shop.applyRandomCurse(message.author.id);
            
            const curseNotif = new EmbedBuilder()
                .setTitle('☠️ ¡MALDICIÓN!')
                .setDescription('**La Mano del Muerto** apareció de la nada y te maldijo por 30 minutos.')
                .setColor('#8B0000');
            
            await message.reply({ embeds: [curseNotif] });
        }

        let won = false;
        let winAmount = 0;
        let resultText = '';
        // VERIFICAR LÍMITES (igual que lottery)
        const gameType = 'slots';
        
        if (result.isJackpot) {
            // 💎💎💎 JACKPOT
            won = true;
            winAmount = Math.floor(betAmount * this.config.slots.symbols[result.symbols[0]].payout);
            resultText = `🎉 **¡JACKPOT! 💎💎💎**`;
            embed.setColor('#00FF00');

            // ✅ DETECTAR JACKPOT DE DIAMANTES
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'diamond_jackpot');
            }
        } else if (result.isTriple) {
            // 3 iguales
            won = true;
            winAmount = Math.floor(betAmount * this.config.slots.symbols[result.symbols[0]].payout);
            resultText = `🎊 **¡3 IGUALES!** ${result.symbols[0]}${result.symbols[0]}${result.symbols[0]}`;
            embed.setColor('#00FF00');

            // ✅ DETECTAR TRIPLE 7
            if (result.symbols[0] === '7️⃣' && this.achievements) {
                await this.achievements.updateStats(userId, 'triple_seven');
            }
        } else if (result.isDouble) {
            // 2 iguales
            won = true;
            winAmount = Math.floor(betAmount * this.config.slots.twoMatchMultiplier);
            resultText = `😊 **¡2 Iguales!** Recuperaste la mitad`;
            embed.setColor('#FFA500');

            // ✅ DETECTAR DOBLE
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'slots_doubles');
            }
        } else {
            // Perdió
            resultText = `💸 **Sin suerte esta vez...**`;
            embed.setColor('#FF0000');
        }
        
        if (won) {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_win');
            await this.economy.missions.updateMissionProgress(userId, 'game_won');
            // INCREMENTAR LÍMITE
            await this.economy.database.incrementGameLimit(userId, gameType);
            
            // APLICAR EVENTOS
            const eventBonus = await this.applyEventEffects(userId, winAmount - betAmount, 'minigames', message.guild?.id);
            let finalEarnings = eventBonus.finalAmount;
            
            // APLICAR ITEMS
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                const originalProfit = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                const vipBonus = finalEarnings - originalProfit;
                
                if (vipBonus > 0) {
                    await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                }
                await this.shop.consumeItemUse(userId, 'games');
            }

            const equipmentBonus = await this.shop.applyEquipmentBonus(userId);
            let equipmentMessage = '';
            
            if (equipmentBonus.applied && equipmentBonus.money > 0) {
                const extraMoney = Math.floor(finalEarnings * equipmentBonus.money);
                finalEarnings += extraMoney;
                
                // Generar mensaje de equipamiento
                for (const equip of equipmentBonus.items) {
                    equipmentMessage += `\n${equip.wasBroken ? '💔' : '🛡️'} **${equip.name}**: `;
                    
                    if (equip.wasBroken) {
                        equipmentMessage += `¡SE ROMPIÓ! (era ${equip.durabilityLost})`;
                    } else {
                        equipmentMessage += `${equip.durabilityLeft}/${equip.maxDurability} (-${equip.durabilityLost})`;
                    }
                }
                
                if (extraMoney > 0) {
                    equipmentMessage = `💰 +${this.formatNumber(extraMoney)} π-b$ (equipamiento)${equipmentMessage}`;
                }
            }
            
            // LÍMITE DE BALANCE
            const userData = await this.economy.getUser(userId);
            const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(userId) : this.economy.config.maxBalance;
            
            if (userData.balance + finalEarnings > userLimit) {
                const spaceLeft = userLimit - userData.balance;
                finalEarnings = Math.min(finalEarnings, spaceLeft);
            }
            
            const addResult = await this.economy.addMoney(userId, finalEarnings, 'slots_wins');
            finalEarnings = addResult.actualAmount;
            
            // ✅ Aplicar penalización de maldición (-25% dinero)
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            const curse = activeEffects['death_hand_curse'];
            let curseMoneyPenalty = 0;

            if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
                const penaltyAmount = Math.floor(finalEarnings * Math.abs(curse[0].moneyPenalty)); // 0.25 = 25%
                curseMoneyPenalty = penaltyAmount;
                finalEarnings -= penaltyAmount;
            }

            await this.economy.updateUser(userId, updateData);
            
            // Achievements
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_won');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
                await this.achievements.updateStats(userId, 'bet_win', finalEarnings);
                await this.achievements.updateStats(userId, 'slots_wins');
            }
            
            // Misiones win
            if (this.missions) {
                const winMissions = await this.missions.updateMissionProgress(userId, 'game_won');
                const betWonMissions = await this.missions.updateMissionProgress(userId, 'bet_won');
                const moneyMissions = await this.missions.updateMissionProgress(userId, 'money_earned_today', finalEarnings);
                
                let allCompleted = [...winMissions, ...betWonMissions, ...moneyMissions];
                if (allCompleted.length > 0) {
                    await this.missions.notifyCompletedMissions(message, allCompleted);
                }
            }
            
            // Items message
            let itemMessage = '';
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                if (modifiers.multiplier > 1) {
                    itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                }
            }
            
            embed.setTitle('🎰 Tragaperras - ¡GANASTE!')
                .setDescription(embed.data.description + `\n\n${resultText}`)
                .addFields(
                    { name: '💰 Ganancia', value: `+${this.formatNumber(winAmount - betAmount)} π-b$`, inline: true },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(userData.balance)} π-b$`, inline: true },
                    { name: '🎉 Bonificaciones', value: this.formatGameBonuses(eventBonus.eventMessage, luckMessage, itemMessage, equipmentMessage), inline: false }
                );
            
            if (curseMoneyPenalty > 0) {
                embed.addFields({
                    name: '☠️ Penalización de Maldición',
                    value: `-${this.formatNumber(curseMoneyPenalty)} π-b$ (-25% de ganancias)`,
                    inline: false
                });
            }

            if (addResult.hitLimit) {
                await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero (máximo ${this.formatNumber(userLimit)} π-b$)`);
            }
        } else {
            await this.economy.database.incrementGameLimit(userId, gameType);
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss');
            
            // ✅ NUEVO: Sistema de protección mejorado
            const user = await this.economy.getUser(userId);
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            
            let hasProtected = false;
            let protectionMessage = '';
            
            // 1️⃣ CONDÓN: 100% garantizado, 1 uso
            if (activeEffects['condon_pibe2']) {
                for (let i = activeEffects['condon_pibe2'].length - 1; i >= 0; i--) {
                    const effect = activeEffects['condon_pibe2'][i];
                    if (effect.type === 'protection' && effect.usesLeft > 0) {
                        hasProtected = true;
                        effect.usesLeft -= 1;
                        
                        if (effect.usesLeft <= 0) {
                            activeEffects['condon_pibe2'].splice(i, 1);
                            if (activeEffects['condon_pibe2'].length === 0) {
                                delete activeEffects['condon_pibe2'];
                            }
                        }
                        
                        await this.economy.updateUser(userId, { activeEffects });
                        protectionMessage = '🧃 ¡El Condón usado de Pibe 2 te protegió! (100% - último uso consumido)';
                        break;
                    }
                }
            }
            
            // 2️⃣ FORTUNE SHIELD: 80% probabilidad
            if (!hasProtected && activeEffects['fortune_shield']) {
                for (const effect of activeEffects['fortune_shield']) {
                    if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                        const roll = Math.random();
                        if (roll < 0.80) {
                            hasProtected = true;
                            protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió (80% de suerte)';
                        } else {
                            protectionMessage = '💔 Tu Escudo de la Fortuna falló esta vez (tenías 80% de protección)';
                        }
                        break;
                    }
                }
            }
            
            // 3️⃣ HEALTH POTION: 40% probabilidad
            if (!hasProtected && activeEffects['health_potion']) {
                for (const effect of activeEffects['health_potion']) {
                    if (effect.type === 'penalty_protection' && effect.expiresAt > Date.now()) {
                        const roll = Math.random();
                        if (roll < 0.40) {
                            hasProtected = true;
                            protectionMessage = '💊 Tu Poción de Salud redujo las penalizaciones (40% de suerte)';
                        } else {
                            protectionMessage = '💔 Tu Poción de Salud no pudo protegerte esta vez (tenías 40% de protección)';
                        }
                        break;
                    }
                }
            }
            
            // ✅ Aplicar protección o pérdida
            if (hasProtected) {
                await message.reply(protectionMessage);
            } else {
                if (protectionMessage) {
                    await message.reply(protectionMessage); // Mostrar que falló
                }
                await this.economy.removeMoney(userId, betAmount, 'slots_loss');
            }
            
            await this.economy.updateUser(userId, updateData);
            
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_lost');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
            }
            
            embed.setTitle('🎰 Tragaperras - Sin Suerte')
                .setDescription(embed.data.description + `\n\n${resultText}`)
                .addFields(
                    { name: '💸 Perdiste', value: `${this.formatNumber(betAmount)} π-b$`, inline: true },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$`, inline: true }
                );
        }

        // ✅ VERIFICAR LOGROS DE SLOTS
        if (this.achievements) {
            const unlockedAchievements = await this.achievements.checkAchievements(userId);
            if (unlockedAchievements.length > 0) {
                await this.achievements.notifyAchievements(message, unlockedAchievements);
            }
        }

        const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
        const curse = activeEffects['death_hand_curse'];
        // Al final, después de crear el embed de resultado
        if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
            embed.addFields({
                name: '☠️ Maldición Activa',
                value: won 
                    ? `Tu ganancia fue reducida por la maldición (-25% dinero)`
                    : `La maldición empeoró tu suerte (-50% probabilidad)`,
                inline: false
            });
        }

        await reply.edit({ embeds: [embed] });
        
        // Treasure hunt
        await this.checkTreasureHunt(userId, message);
    }

    async handleHorseRace(message, args) {
        const userId = message.author.id;
        const channelId = message.channel.id;
        
        // Mostrar ayuda
        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setTitle('🐎 Carrera de Caballos')
                .setDescription('> Elige un caballo y apuesta. Hay dos modos: contra el bot o contra otros jugadores.')
                .addFields(
                    {
                        name: '🎮 Modos',
                        value: '`>horses bot <cantidad>` — vs Bot (solo)\n`>horses multi <cantidad>` — Multijugador',
                        inline: false
                    },
                    {
                        name: '👥 Multijugador',
                        value: '`>joinrace` — Unirse a carrera activa\n`>startrace` — Iniciar (solo el creador)',
                        inline: false
                    },
                    {
                        name: '🏆 Premios',
                        value: '🥇 **1er lugar** — x3.0\n🥈 **2do lugar** — x1.8\n🥉 **3er lugar** — x1.2',
                        inline: true
                    },
                    {
                        name: '⚡ Extra',
                        value: 'Puedes **doblar tu apuesta** una vez\n(solo antes del **75%** de la carrera)',
                        inline: true
                    },
                    { name: '💰 Apuesta', value: `**Mín:** ${this.formatNumber(this.config.horseRace.minBet)} π-b$\n**Máx:** ${this.formatNumber(this.config.horseRace.maxBet)} π-b$`, inline: true },
                    { name: '⏱️ Cooldown', value: '**2 minutos**', inline: true }
                )
                .setColor('#8B4513')
                .setFooter({ text: '12 caballos compiten. Solo uno gana.' });
            return message.reply({ embeds: [embed] });
        }
        
        const mode = args[1].toLowerCase();
        const betAmount = parseInt(args[2]);
        
        // Validaciones
        if (!['bot', 'multi'].includes(mode)) {
            await message.reply('❌ Modo inválido. Usa: `bot` o `multi`');
            return;
        }

        if ( mode === 'bot' && (isNaN(betAmount) || betAmount < this.config.horseRace.minBet || betAmount > 5000)){
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.horseRace.minBet)} y 5000 π-b$`);
            return;
        }

        if (isNaN(betAmount) || betAmount < this.config.horseRace.minBet || betAmount > this.config.horseRace.maxBet) {
            await message.reply(`❌ La apuesta debe ser entre ${this.formatNumber(this.config.horseRace.minBet)} y ${this.formatNumber(this.config.horseRace.maxBet)} π-b$`);
            return;
        }
       
        const user = await this.economy.getUser(userId);
        if (user.balance < betAmount) {
            await message.reply(`❌ No tienes suficientes π-b Coins. Balance: ${this.formatNumber(user.balance)} π-b$`);
            return;
        }
        
        // Verificar si ya hay carrera activa
        const gameKey = `horserace_${channelId}`;
        if (this.activeGames.has(gameKey)) {
            const game = this.activeGames.get(gameKey);
            if (game.mode === 'multi' && game.phase === 'waiting') {
                await this.joinHorseRace(message, game, userId, betAmount);
            } else {
                await message.reply('❌ Ya hay una carrera activa en este canal');
            }
            return;
        }
        
        // Crear nueva carrera
        if (mode === 'bot') {
            // VERIFICAR LÍMITES
            const gameType = 'horses';
            const limitConfig = this.dailyLimits[gameType];
            const status = await this.economy.database.getGameLimitStatus(userId, gameType, limitConfig.cycleHours);
            
            if (status.cycleCount >= limitConfig.perCycle) {
                await this.showLimitReached(message, userId, gameType, status, limitConfig);
                return;
            }
            
            // Verificar límite diario
            if (status.dailyCount >= limitConfig.maxDaily) {
                await message.reply(
                    `🚫 **Límite diario alcanzado**\n` +
                    `Has alcanzado el máximo de ${limitConfig.maxDaily} partidas de caballos por día.\n` +
                    `🌅 Vuelve mañana!`
                );
                return;
            }

            await this.economy.database.incrementGameLimit(userId, gameType);
            await this.createBotHorseRace(message, userId, betAmount);
        } else {
            await this.createMultiHorseRace(message, userId, betAmount, channelId);
        }
    }

    async createBotHorseRace(message, userId, betAmount) {
        const gameKey = `horserace_${message.channel.id}`;
        
        // Reservar dinero
        await this.economy.removeMoney(userId, betAmount, 'horserace_bet');
        
        // Crear estado del juego
        const game = {
            id: gameKey,
            mode: 'bot',
            channelId: message.channel.id,
            phase: 'selecting', // selecting -> racing -> finished
            betAmount: betAmount,
            horses: this.initializeHorses(),
            players: {
                [userId]: {
                    id: userId,
                    username: message.author.username,
                    bet: betAmount,
                    horseIndex: null,
                    hasDoubled: false
                },
                'bot': {
                    id: 'bot',
                    username: 'Bot',
                    bet: betAmount,
                    horseIndex: null,
                    hasDoubled: false
                }
            },
            raceProgress: 0,
            updateInterval: null,
            messageId: null
        };
        
        this.activeGames.set(gameKey, game);
        
        // Mostrar selección de caballos
        await this.showHorseSelection(message, game, userId);
    }

    initializeHorses() {
        return HORSE_EMOJIS.map((emoji, index) => ({
            emoji: emoji,
            index: index,
            position: 0,  // ✅ ASEGURAR QUE INICIE EN 0
            speed: null,  // ✅ Se asignará en startHorseRace
            totalDistance: this.config.horseRace.raceDistance,
            finished: false,
            finishTime: null,
            finishPosition: null
        }));
    }

    async showHorseSelection(message, game, userId) {
        const horsesDisplay = game.horses.map((h, i) => 
            `${h.emoji}`
        ).join(' ');
        
        const embed = new EmbedBuilder()
            .setTitle('🐎 Selecciona tu Caballo')
            .setDescription(`**Caballos disponibles:**\n${horsesDisplay}`)
            .addFields(
                { name: '🎯 Tu apuesta', value: `${this.formatNumber(game.betAmount)} π-b$`, inline: true },
                { name: '🎮 Modo', value: game.mode === 'bot' ? 'vs Bot' : 'Multijugador', inline: true }
            )
            .setColor('#FFD700')
            .setFooter({ text: 'Haz clic en el caballo que quieras o elige aleatoriamente' });
        
        // ✅ CREAR BOTONES (12 caballos = 3 filas de 4 + 1 fila con botón aleatorio)
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 4; j++) {
                const index = i * 4 + j;
                if (index < game.horses.length) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`select_horse_${game.id}_${index}`)
                            .setLabel(`${game.horses[index].emoji} ${index + 1}`)
                            .setStyle(ButtonStyle.Primary)
                    );
                }
            }
            rows.push(row);
        }
        
        // ✅ FILA EXTRA CON BOTÓN ALEATORIO
        const randomRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`random_horse_${game.id}`)
                    .setLabel('🎲 Caballo Aleatorio')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎲')
            );
        rows.push(randomRow);
        
        const selectionMsg = await message.reply({ 
            embeds: [embed], 
            components: rows 
        });
        
        game.selectionMessageId = selectionMsg.id;
        
        // ✅ TIMEOUT: Si no elige en 30 segundos
        setTimeout(() => {
            if (game.players[userId].horseIndex === null) {
                this.handleCancelRace(message);
            }
        }, 30000);
    }

    async handleHorseSelection(interaction) {
        const parts = interaction.customId.split('_');
        const gameId = parts[2] + '_' + parts[3]; // horserace_channelId
        const horseIndex = parseInt(parts[4]);
        
        const game = this.activeGames.get(gameId);
        
        if (!game) {
            await interaction.reply({ content: '❌ Carrera no encontrada', ephemeral: true });
            return;
        }
        
        const userId = interaction.user.id;
        const player = game.players[userId];
        
        if (!player) {
            await interaction.reply({ content: '❌ No estás en esta carrera', ephemeral: true });
            return;
        }
        
        if (player.horseIndex !== null) {
            await interaction.reply({ 
                content: `❌ Ya elegiste ${game.horses[player.horseIndex].emoji}`, 
                ephemeral: true 
            });
            return;
        }
        
        // ✅ ASIGNAR CABALLO AL JUGADOR
        player.horseIndex = horseIndex;
        
        await interaction.reply({ 
            content: `✅ Elegiste ${game.horses[horseIndex].emoji}!`, 
            ephemeral: true 
        });

        // ✅ ACTUALIZAR EMBED DE SELECCIÓN (si existe la función)
        if (game.updateSelectionEmbed) {
            await game.updateSelectionEmbed();
        }
        
        // ✅ SI ES MODO BOT, EL BOT ELIGE AUTOMÁTICAMENTE
        if (game.mode === 'bot') {
            // Bot elige aleatoriamente (evitando el del jugador)
            let botChoice;
            do {
                botChoice = Math.floor(Math.random() * 12);
            } while (botChoice === horseIndex);
            
            game.players['bot'].horseIndex = botChoice;
            
            // ✅ LIMPIAR TIMEOUT SI EXISTE
            if (game.selectionTimeout) {
                clearTimeout(game.selectionTimeout);
            }
            
            // Deshabilitar botones
            try {
                const selectionMsg = await interaction.channel.messages.fetch(game.selectionMessageId);
                await selectionMsg.edit({ components: [] });
            } catch (error) {
                console.log('No se pudo deshabilitar botones');
            }
            
            await interaction.channel.send(
                `✅ **Elecciones confirmadas:**\n` +
                `👤 <@${userId}> eligió ${game.horses[horseIndex].emoji}\n` +
                `🤖 Bot eligió ${game.horses[botChoice].emoji}\n\n` +
                `🏁 ¡La carrera comenzará en 3 segundos!`
            );
            
            setTimeout(() => this.startHorseRace(game, interaction.channel), 3000);
            return;
        }
        
        // ✅ MODO MULTIJUGADOR: VERIFICAR SI TODOS ELIGIERON
        const allSelected = Object.values(game.players).every(p => p.horseIndex !== null);
        
        if (allSelected) {
            // ✅ LIMPIAR TIMEOUT
            if (game.selectionTimeout) {
                clearTimeout(game.selectionTimeout);
            }
            
            // Deshabilitar botones
            try {
                const selectionMsg = await interaction.channel.messages.fetch(game.selectionMessageId);
                await selectionMsg.edit({ components: [] });
            } catch (error) {
                console.log('No se pudo deshabilitar botones');
            }
            
            // Mostrar elecciones
            let choices = '';
            for (const [playerId, p] of Object.entries(game.players)) {
                choices += `<@${playerId}> eligió ${game.horses[p.horseIndex].emoji}\n`;
            }
            
            await interaction.channel.send(
                `**📋 Todos eligieron:**\n${choices}\n` +
                `🏁 ¡La carrera comenzará en 3 segundos!`
            );
            
            setTimeout(() => this.startHorseRace(game, interaction.channel), 3000);
        } else {
            // ✅ MOSTRAR QUIÉNES FALTAN
            const pending = Object.values(game.players)
                .filter(p => p.horseIndex === null)
                .map(p => `<@${p.id}>`)
                .join(', ');
            
            const selected = Object.values(game.players).filter(p => p.horseIndex !== null).length;
            const total = Object.keys(game.players).length;
            
            await interaction.channel.send(
                `⏳ ${selected}/${total} jugadores eligieron\n` +
                `Esperando: ${pending}`
            );
        }
    }

    async handleRandomHorseSelection(interaction) {
        const parts = interaction.customId.split('_');
        const gameId = parts[2] + '_' + parts[3]; // horserace_channelId
        
        const game = this.activeGames.get(gameId);
        
        if (!game) {
            await interaction.reply({ content: '❌ Carrera no encontrada', ephemeral: true });
            return;
        }
        
        const userId = interaction.user.id;
        const player = game.players[userId];
        
        if (!player) {
            await interaction.reply({ content: '❌ No estás en esta carrera', ephemeral: true });
            return;
        }
        
        if (player.horseIndex !== null) {
            await interaction.reply({ 
                content: `❌ Ya elegiste ${game.horses[player.horseIndex].emoji}`, 
                ephemeral: true 
            });
            return;
        }
        
        // ✅ ELEGIR CABALLO ALEATORIO
        const randomIndex = Math.floor(Math.random() * 12);
        player.horseIndex = randomIndex;
        player.randomSelection = true;
        
        await interaction.reply({ 
            content: `🎲 ¡Caballo aleatorio seleccionado!\nElegiste ${game.horses[randomIndex].emoji} (#${randomIndex + 1})`, 
            ephemeral: true 
        });

        // ✅ ACTUALIZAR EMBED DE SELECCIÓN
        if (game.updateSelectionEmbed) {
            await game.updateSelectionEmbed();
        }
        
        // ✅ SI ES MODO BOT, EL BOT ELIGE AUTOMÁTICAMENTE
        if (game.mode === 'bot') {
            // Bot elige aleatoriamente (evitando el del jugador)
            let botChoice;
            do {
                botChoice = Math.floor(Math.random() * 12);
            } while (botChoice === randomIndex);
            
            game.players['bot'].horseIndex = botChoice;
            
            // ✅ LIMPIAR TIMEOUT SI EXISTE
            if (game.selectionTimeout) {
                clearTimeout(game.selectionTimeout);
            }
            
            // Deshabilitar botones
            try {
                const selectionMsg = await interaction.channel.messages.fetch(game.selectionMessageId);
                await selectionMsg.edit({ components: [] });
            } catch (error) {
                console.log('No se pudo deshabilitar botones');
            }
            
            await interaction.channel.send(
                `✅ **Elecciones confirmadas:**\n` +
                `👤 <@${userId}> eligió ${game.horses[randomIndex].emoji} 🎲\n` +
                `🤖 Bot eligió ${game.horses[botChoice].emoji}\n\n` +
                `🏁 ¡La carrera comenzará en 3 segundos!`
            );
            
            setTimeout(() => this.startHorseRace(game, interaction.channel), 3000);
            return;
        }
        
        // ✅ MODO MULTIJUGADOR: VERIFICAR SI TODOS ELIGIERON
        const allSelected = Object.values(game.players).every(p => p.horseIndex !== null);
        
        if (allSelected) {
            // ✅ LIMPIAR TIMEOUT
            if (game.selectionTimeout) {
                clearTimeout(game.selectionTimeout);
            }
            
            // Deshabilitar botones
            try {
                const selectionMsg = await interaction.channel.messages.fetch(game.selectionMessageId);
                await selectionMsg.edit({ components: [] });
            } catch (error) {
                console.log('No se pudo deshabilitar botones');
            }
            
            // Mostrar elecciones (marcar las aleatorias con 🎲)
            let choices = '';
            for (const [playerId, p] of Object.entries(game.players)) {
                const randomMarker = playerId === userId ? ' 🎲' : '';
                choices += `<@${playerId}> eligió ${game.horses[p.horseIndex].emoji}${randomMarker}\n`;
            }
            
            await interaction.channel.send(
                `**📋 Todos eligieron:**\n${choices}\n` +
                `🏁 ¡La carrera comenzará en 3 segundos!`
            );
            
            setTimeout(() => this.startHorseRace(game, interaction.channel), 3000);
        } else {
            // ✅ MOSTRAR QUIÉNES FALTAN
            const pending = Object.values(game.players)
                .filter(p => p.horseIndex === null)
                .map(p => `<@${p.id}>`)
                .join(', ');
            
            const selected = Object.values(game.players).filter(p => p.horseIndex !== null).length;
            const total = Object.keys(game.players).length;
            
            await interaction.channel.send(
                `⏳ ${selected}/${total} jugadores eligieron\n` +
                `Esperando: ${pending}`
            );
        }
    }

    async startMultiSelection(game, message) {
        game.phase = 'selecting';
        
        const horsesDisplay = game.horses.map((h, i) => 
            `${h.emoji}`
        ).join(' ');
        
        // ✅ FUNCIÓN PARA CREAR LISTA DE JUGADORES CON CHECKMARKS
        const getPlayersList = () => {
            return Object.values(game.players)
                .map(p => {
                    const check = p.horseIndex !== null ? '✅' : '⏳';
                    return `${check} ${p.username}`;
                })
                .join('\n');
        };
        
        const embed = new EmbedBuilder()
            .setTitle('🐎 Selecciona tu Caballo')
            .setDescription(`**Caballos disponibles:**\n${horsesDisplay}`)
            .addFields(
                { name: '👥 Jugadores', value: getPlayersList(), inline: false },
                { name: '💡 Instrucciones', value: 'Haz clic en el botón del caballo que quieras o elige aleatoriamente', inline: false },
                { name: '⏱️ Tiempo límite', value: '1 minuto 30 segundos (auto-selección aleatoria)', inline: false }
            )
            .setColor('#FFD700')
            .setFooter({ text: 'Todos deben elegir para que la carrera comience' });
        
        // Crear botones
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 4; j++) {
                const index = i * 4 + j;
                if (index < game.horses.length) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`select_horse_${game.id}_${index}`)
                            .setLabel(`${game.horses[index].emoji} ${index + 1}`)
                            .setStyle(ButtonStyle.Primary)
                    );
                }
            }
            rows.push(row);
        }
        
        const randomRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`random_horse_${game.id}`)
                    .setLabel('🎲 Caballo Aleatorio')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎲')
            );
        rows.push(randomRow);
        
        const selectionMsg = await message.channel.send({ 
            embeds: [embed], 
            components: rows 
        });
        
        game.selectionMessageId = selectionMsg.id;
        
        // ✅ GUARDAR FUNCIÓN PARA ACTUALIZAR EMBED
        game.updateSelectionEmbed = async () => {
            const updatedEmbed = new EmbedBuilder()
                .setTitle('🐎 Selecciona tu Caballo')
                .setDescription(`**Caballos disponibles:**\n${horsesDisplay}`)
                .addFields(
                    { name: '👥 Jugadores', value: getPlayersList(), inline: false },
                    { name: '💡 Instrucciones', value: 'Haz clic en el botón del caballo que quieras o elige aleatoriamente', inline: false },
                    { name: '⏱️ Tiempo límite', value: '1 minuto 30 segundos (auto-selección aleatoria)', inline: false }
                )
                .setColor('#FFD700')
                .setFooter({ text: 'Todos deben elegir para que la carrera comience' });
            
            try {
                await selectionMsg.edit({ embeds: [updatedEmbed] });
            } catch (error) {
                console.log('No se pudo actualizar embed de selección');
            }
        };
        
        // Timeout de auto-selección
        game.selectionTimeout = setTimeout(async () => {
            const playersWithoutHorse = Object.entries(game.players)
                .filter(([id, p]) => p.horseIndex === null);
            
            if (playersWithoutHorse.length > 0) {
                let autoSelectedText = '🎲 **Auto-selección aleatoria:**\n';
                
                for (const [playerId, player] of playersWithoutHorse) {
                    const randomIndex = Math.floor(Math.random() * 12);
                    player.horseIndex = randomIndex;
                    player.randomSelection = true;
                    
                    const playerName = playerId === 'bot' ? '🤖 Bot' : `<@${playerId}>`;
                    autoSelectedText += `${playerName} → ${game.horses[randomIndex].emoji}\n`;
                }
                
                await message.channel.send(autoSelectedText);
                
                try {
                    await selectionMsg.edit({ components: [] });
                } catch (error) {
                    console.log('No se pudo deshabilitar botones');
                }
                
                let allChoices = '**📋 Elecciones finales:**\n';
                for (const [playerId, p] of Object.entries(game.players)) {
                    const name = playerId === 'bot' ? '🤖 Bot' : `<@${playerId}>`;
                    allChoices += `${name} eligió ${game.horses[p.horseIndex].emoji}\n`;
                }
                
                await message.channel.send(
                    `${allChoices}\n🏁 ¡La carrera comenzará en 3 segundos!`
                );
                
                setTimeout(() => this.startHorseRace(game, message.channel), 3000);
            }
        }, 90000);
    }

    async createMultiHorseRace(message, userId, betAmount, channelId) {
        const gameKey = `horserace_${channelId}`;
        
        await this.economy.removeMoney(userId, betAmount, 'horserace_bet');
        
        const game = {
            id: gameKey,
            mode: 'multi',
            channelId: channelId,
            phase: 'waiting',
            betAmount: betAmount,
            horses: this.initializeHorses(),
            players: {
                [userId]: {
                    id: userId,
                    username: message.author.username,
                    bet: betAmount,
                    horseIndex: null,
                    hasDoubled: false
                }
            },
            pot: betAmount,
            raceProgress: 0,
            updateInterval: null,
            messageId: null,
            creatorId: userId
        };
        
        this.activeGames.set(gameKey, game);
        
        const embed = new EmbedBuilder()
            .setTitle('🐎 Carrera Multijugador - Esperando Jugadores')
            .setDescription('¡Otros jugadores pueden unirse!')
            .addFields(
                { name: '👑 Creador', value: `<@${userId}>`, inline: true },
                { name: '💰 Apuesta', value: `${this.formatNumber(betAmount)} π-b$`, inline: true },
                { name: '💎 Pot', value: `${this.formatNumber(game.pot)} π-b$`, inline: true },
                { name: '👥 Jugadores', value: `1/${this.config.horseRace.maxPlayers}`, inline: true },
                { name: '⏱️ Tiempo', value: '45 segundos o inicio manual', inline: true },
                { name: '📋 Participantes', value: `• ${message.author.username}`, inline: false },
                { name: '🎮 Para Unirse', value: `\`>joinrace\``, inline: true },
                { name: '🚀 Para Iniciar', value: `\`>startrace\` (solo creador)`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp()
            .setFooter({ text: `Mínimo ${this.config.horseRace.minPlayers} jugadores • Varios pueden apostar al mismo caballo` });
        
        const reply = await message.reply({ embeds: [embed] });
        game.messageId = reply.id;
    }

    async joinHorseRace(message, game, userId, betAmount) {
        if (game.players[userId]) {
            await message.reply('❌ Ya estás en esta carrera');
            return;
        }
        
        if (game.phase !== 'waiting') {
            await message.reply('❌ Esta carrera ya comenzó o está en selección de caballos');
            return;
        }
        
        if (betAmount !== game.betAmount) {
            await message.reply(`❌ La apuesta debe ser ${this.formatNumber(game.betAmount)} π-b$`);
            return;
        }
        
        if (Object.keys(game.players).length >= this.config.horseRace.maxPlayers) {
            await message.reply('❌ La carrera está llena');
            return;
        }
        
        const user = await this.economy.getUser(userId);
        if (user.balance < betAmount) {
            await message.reply('❌ No tienes suficiente dinero');
            return;
        }
        
        await this.economy.removeMoney(userId, betAmount, 'horserace_bet');
        
        game.players[userId] = {
            id: userId,
            username: message.author.username,
            bet: betAmount,
            horseIndex: null,
            hasDoubled: false
        };
        
        game.pot += betAmount;
        
        // ✅ ACTUALIZAR EMBED
        const playerCount = Object.keys(game.players).length;
        const playersList = Object.values(game.players)
            .map(p => `• ${p.username}`)
            .join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle('🐎 Carrera Multijugador - Esperando Jugadores')
            .setDescription('¡Otros jugadores pueden unirse!')
            .addFields(
                { name: '👑 Creador', value: `<@${game.creatorId}>`, inline: true },
                { name: '💰 Apuesta', value: `${this.formatNumber(betAmount)} π-b$`, inline: true },
                { name: '💎 Pot', value: `${this.formatNumber(game.pot)} π-b$`, inline: true },
                { name: '👥 Jugadores', value: `${playerCount}/${this.config.horseRace.maxPlayers}`, inline: true },
                { name: '⏱️ Tiempo', value: 'Sin límite (inicio manual)', inline: true },
                { name: '📋 Participantes', value: playersList, inline: false },
                { name: '🎮 Para Unirse', value: `\`>joinrace\``, inline: true },
                { name: '🚀 Para Iniciar', value: `\`>startrace\` (solo creador)`, inline: true },
                { name: '❌ Para Cancelar', value: `\`>cancelrace\` (solo creador)`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp()
            .setFooter({ text: `Mínimo ${this.config.horseRace.minPlayers} jugadores • Varios pueden apostar al mismo caballo` });
        
        try {
            const channel = await message.client.channels.fetch(game.channelId);
            const waitingMsg = await channel.messages.fetch(game.messageId);
            await waitingMsg.edit({ embeds: [embed] });
        } catch (error) {
            console.log('No se pudo actualizar embed de espera');
        }
        
        await message.reply(`✅ ${message.author.username} se unió! (${playerCount}/${this.config.horseRace.maxPlayers})`);
    }

    async handleStartRace(message) {
        const gameKey = `horserace_${message.channel.id}`;
        const game = this.activeGames.get(gameKey);
        
        if (!game) {
            await message.reply('❌ No hay ninguna carrera esperando en este canal');
            return;
        }
        
        if (game.mode !== 'multi') {
            await message.reply('❌ Este comando es solo para carreras multijugador');
            return;
        }
        
        if (game.phase !== 'waiting') {
            await message.reply('❌ Esta carrera ya comenzó o está en selección de caballos');
            return;
        }
        
        if (message.author.id !== game.creatorId) {
            await message.reply('❌ Solo el creador de la carrera puede iniciarla');
            return;
        }
        
        const playerCount = Object.keys(game.players).length;
        
        if (playerCount < this.config.horseRace.minPlayers) {
            await message.reply(`❌ Se necesitan al menos ${this.config.horseRace.minPlayers} jugadores para iniciar (hay ${playerCount})`);
            return;
        }
        
        // Probabilidad 3% de recibir maldición aleatoria
        if (Math.random() < 0.03) {
            await this.economy.shop.applyRandomCurse(message.author.id);
            
            const curseNotif = new EmbedBuilder()
                .setTitle('☠️ ¡MALDICIÓN!')
                .setDescription('**La Mano del Muerto** apareció de la nada y te maldijo por 30 minutos.')
                .setColor('#8B0000');
            
            await message.reply({ embeds: [curseNotif] });
        }

        // ✅ INICIAR LA CARRERA
        game.manualStart = true;
        
        // Deshabilitar el mensaje de espera
        try {
            const waitingMsg = await message.channel.messages.fetch(game.messageId);
            await waitingMsg.edit({ 
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🏁 Carrera Iniciada')
                        .setDescription(`El creador inició la carrera con ${playerCount} jugadores`)
                        .setColor('#FFD700')
                ],
                components: [] 
            });
        } catch (error) {
            console.log('No se pudo actualizar mensaje de espera');
        }
        
        await message.reply(`✅ Iniciando selección de caballos para ${playerCount} jugadores...`);
        
        // ✅ INICIAR SELECCIÓN EN EL MISMO CANAL
        await this.startMultiSelection(game, message);
    }

    async handleCancelRace(message) {
        const gameKey = `horserace_${message.channel.id}`;
        const game = this.activeGames.get(gameKey);
        
        if (!game) {
            await message.reply('❌ No hay ninguna carrera activa en este canal');
            return;
        }
        
        if (message.author.id !== game.creatorId) {
            await message.reply('❌ Solo el creador de la carrera puede cancelarla');
            return;
        }
        
        if (game.phase === 'racing' || game.phase === 'finished') {
            await message.reply('❌ No se puede cancelar una carrera que ya comenzó');
            return;
        }
        
        // ✅ DEVOLVER DINERO A TODOS
        for (const [playerId, player] of Object.entries(game.players)) {
            if (playerId !== 'bot') {
                await this.economy.addMoney(playerId, player.bet, 'horserace_refund');
            }
        }
        
        // ✅ LIMPIAR INTERVALOS Y TIMEOUTS
        if (game.updateInterval) {
            clearInterval(game.updateInterval);
        }
        if (game.selectionTimeout) {
            clearTimeout(game.selectionTimeout);
        }
        
        const embed = new EmbedBuilder()
            .setTitle('❌ Carrera Cancelada')
            .setDescription(`<@${message.author.id}> canceló la carrera\n\nSe ha devuelto el dinero a todos los participantes`)
            .setColor('#FF0000')
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
        // Limpiar juego
        this.activeGames.delete(gameKey);
    }

    async startHorseRace(game, messageOrChannel) {
        game.phase = 'racing';
        
        // ✅ OBTENER EL CANAL CORRECTAMENTE
        const channel = messageOrChannel.channel || messageOrChannel;
        
        // ✅ REINICIAR POSICIONES Y ASIGNAR VELOCIDADES
        game.horses.forEach(horse => {
            horse.position = 0;  // ✅ ASEGURAR QUE INICIE EN 0
            horse.finished = false;
            horse.finishTime = null;
            horse.finishPosition = null;
            horse.speed = this.getRandomSpeed();
        });
        
        // ✅ PROGRESO INICIAL EN 0
        game.raceProgress = 0;
        
        // Mostrar carrera inicial
        const raceEmbed = await this.createRaceEmbed(game);
        const raceMsg = await channel.send({ 
            embeds: [raceEmbed],
            components: [this.createDoubleButton(game)]
        });
        
        game.messageId = raceMsg.id;
        
        // Actualizar carrera cada 500ms
        game.updateInterval = setInterval(async () => {
            await this.updateRaceProgress(game, channel, raceMsg);
        }, this.config.horseRace.updateInterval);
    }

    getRandomSpeed() {
        // ✅ VELOCIDAD ENTRE 0.8 Y 2.5 POR UPDATE
        const baseSpeed = 0.8 + Math.random() * 1.7;
        
        // Retornar función que varía la velocidad ligeramente cada vez
        return () => {
            // Variación de ±20% de la velocidad base
            const variation = baseSpeed * (0.8 + Math.random() * 0.4);
            return variation;
        };
    }

    async updateRaceProgress(game, channel, raceMsg) {
        // Contar cuántos ya terminaron ANTES de actualizar
        let finishCount = game.horses.filter(h => h.finished).length;
        
        console.log(`📊 Update: ${finishCount} caballos han terminado, progreso: ${(game.raceProgress || 0).toFixed(1)}%`);

        // Actualizar posiciones
        game.horses.forEach(horse => {
            if (!horse.finished) {
                // Velocidad variable
                const speedValue = horse.speed();
                horse.position += speedValue;
                
                // Limitar a la distancia total
                if (horse.position >= horse.totalDistance) {
                    horse.position = horse.totalDistance;
                    horse.finished = true;
                    horse.finishTime = Date.now();
                    finishCount++; // Incrementar aquí
                    horse.finishPosition = finishCount;
                }
            }
        });
        
        // Actualizar progreso general
        const maxPosition = Math.max(...game.horses.map(h => h.position));
        game.raceProgress = (maxPosition / this.config.horseRace.raceDistance) * 100;
        
        // ✅ VERIFICAR SI YA LLEGARON 5 CABALLOS
        const finishedHorses = game.horses.filter(h => h.finished);
        
        if (finishedHorses.length >= 5) {
            console.log(`🏁 Ya llegaron ${finishedHorses.length} caballos, terminando carrera...`);
            
            // ✅ ASIGNAR POSICIONES A LOS QUE NO TERMINARON
            const unfinishedHorses = game.horses.filter(h => !h.finished);
            
            if (unfinishedHorses.length > 0) {
                // Ordenar por distancia recorrida (más lejos = mejor posición)
                unfinishedHorses.sort((a, b) => b.position - a.position);
                
                let nextPosition = finishedHorses.length + 1;
                for (const horse of unfinishedHorses) {
                    horse.finished = true;
                    horse.finishPosition = nextPosition++;
                    horse.finishTime = Date.now();
                    console.log(`  📍 ${horse.emoji} clasificado en posición #${horse.finishPosition} (distancia: ${horse.position.toFixed(1)})`);
                }
            }
            
            // ✅ DETENER INTERVALO INMEDIATAMENTE
            clearInterval(game.updateInterval);
            game.updateInterval = null;
            game.phase = 'finished';
            
            // ✅ MOSTRAR RESULTADOS
            setTimeout(async () => {
                await this.finishHorseRace(game, channel, raceMsg);
            }, 1000);
            
            return; // ✅ IMPORTANTE: SALIR AQUÍ
        }
        
        // ✅ SI NO HAN LLEGADO 5, SEGUIR ACTUALIZANDO
        try {
            const updatedEmbed = this.createRaceEmbed(game);
            const components = [this.createDoubleButton(game)];
            
            await raceMsg.edit({ embeds: [updatedEmbed], components });
        } catch (error) {
            console.log('Error actualizando carrera:', error.message);
        }
    }

    createRaceEmbed(game) {
        const trackLength = 20; // Caracteres de pista visual
        
        let raceTrack = '';
        game.horses.forEach((horse, i) => {
            const progress = Math.floor((horse.position / horse.totalDistance) * trackLength);
            const track = TRACK_EMOJI.repeat(progress) + horse.emoji + TRACK_EMOJI.repeat(trackLength - progress);
            
            // Marcar caballos de jugadores
            const playerMarkers = Object.values(game.players)
                .filter(p => p.horseIndex === i)
                .map(p => {
                    if (p.id === 'bot') return '🤖';
                    // Mostrar 💰 si dobló
                    return p.hasDoubled ? '💰' : '👤';
                })
                .join('');
            
            const finishMarker = horse.finished ? ` ${FINISH_LINE} #${horse.finishPosition}` : '';
            
            raceTrack += `${track}${playerMarkers}${finishMarker}\n`;
        });
        
        // ✅ VERIFICAR QUE raceTrack NO ESTÉ VACÍO
        if (!raceTrack || raceTrack.trim() === '') {
            raceTrack = '🏁 Iniciando carrera...\n';
        }
        
        // ✅ CALCULAR POT TOTAL CONSIDERANDO APUESTAS DOBLADAS
        let totalPot = 0;
        if (game.mode === 'bot') {
            totalPot = Object.values(game.players).reduce((sum, p) => 
                sum + (p.hasDoubled ? p.bet * 2 : p.bet), 0
            );
        } else {
            totalPot = game.pot;
        }
        
        // ✅ MOSTRAR CUÁNTOS HAN TERMINADO
        const finishedCount = game.horses.filter(h => h.finished).length;
        const totalHorses = game.horses.length;
        
        const description = `\`\`\`\n${raceTrack}\n\`\`\``;
        
        const embed = new EmbedBuilder()
            .setTitle('🏁 CARRERA DE CABALLOS EN CURSO')
            .setDescription(description || '🏁 Iniciando...')
            .addFields(
                { name: '📊 Progreso', value: `${game.raceProgress.toFixed(0)}%`, inline: true },
                { name: '🏁 Terminaron', value: `${finishedCount}/${totalHorses}`, inline: true },
                { name: '💰 Pot Total', value: `${this.formatNumber(totalPot)} π-b$`, inline: true },
                { name: '🎲 Apuestas x2', value: 
                    game.raceProgress < 75 ? 
                        'Disponible hasta 75%' : 
                        '❌ No disponible', 
                    inline: true 
                }
            )
            .setColor(game.raceProgress < 50 ? '#00FF00' : game.raceProgress < 75 ? '#FFD700' : '#FF4500')
            .setFooter({ text: '👤 = Normal | 💰 = Apuesta x2 | 🤖 = Bot | 🏁 = Llegó' });
        
        return embed;
    }

    createDoubleButton(game) {
        // Verificar cuántos jugadores ya doblaron
        const playersWhoDoubled = Object.values(game.players)
            .filter(p => p.hasDoubled).length;
        const totalPlayers = Object.keys(game.players).length;
        
        // ✅ ASEGURAR QUE game.raceProgress EXISTA
        const currentProgress = game.raceProgress || 0;
        
        const button = new ButtonBuilder()
            .setCustomId('double_bet_race');
        
        // ✅ DESHABILITAR SI YA PASÓ EL 75%
        if (currentProgress >= 75) {
            button.setLabel('🚫 Muy tarde (>75%)')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);
        } else {
            button.setLabel(`🎲 Doblar Apuesta (${playersWhoDoubled}/${totalPlayers})`)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(false);
        }
        
        return new ActionRowBuilder().addComponents(button);
    }

    async finishHorseRace(game, channelOrMessage, raceMsg) {
        // ✅ VERIFICAR QUE NO SE HAYA PROCESADO YA
        if (game.resultsProcessed) {
            return;
        }
        game.resultsProcessed = true;
        
        // ✅ ASEGURARSE DE QUE EL INTERVALO ESTÉ DETENIDO
        if (game.updateInterval) {
            clearInterval(game.updateInterval);
            game.updateInterval = null;
        }
        
        game.phase = 'finished';
        
        // ✅ OBTENER EL CANAL CORRECTAMENTE
        const channel = channelOrMessage.channel || channelOrMessage;
        
        // ✅ VERIFICAR QUE TODOS LOS CABALLOS TENGAN POSICIÓN FINAL
        const unfinishedHorses = game.horses.filter(h => !h.finishPosition);
        if (unfinishedHorses.length > 0) {
            console.log(`⚠️ Hay ${unfinishedHorses.length} caballos sin posición final, asignando...`);
            
            // Ordenar por distancia
            unfinishedHorses.sort((a, b) => b.position - a.position);
            
            // Encontrar la última posición asignada
            const maxPosition = Math.max(...game.horses.filter(h => h.finishPosition).map(h => h.finishPosition));
            let nextPosition = maxPosition + 1;
            
            for (const horse of unfinishedHorses) {
                horse.finished = true;
                horse.finishPosition = nextPosition++;
                horse.finishTime = Date.now();
            }
        }

        // Ordenar caballos por posición final
        const podium = game.horses
            .filter(h => h.finished)
            .sort((a, b) => a.finishPosition - b.finishPosition)
            .slice(0, 3);
        
        const results = new Map();

        // ✅ LÓGICA ESPECIAL PARA MODO BOT
        if (game.mode === 'bot') {
            const playerHorse = game.horses[game.players[Object.keys(game.players).find(id => id !== 'bot')].horseIndex];
            const botHorse = game.horses[game.players['bot'].horseIndex];
            
            const playerInPodium = playerHorse.finishPosition <= 3;
            const botInPodium = botHorse.finishPosition <= 3;
            
            console.log(`🎮 Modo Bot: Jugador=${playerInPodium ? 'En podio' : 'Fuera'}, Bot=${botInPodium ? 'En podio' : 'Fuera'}`);
        }
        
        // ✅ AGRUPAR JUGADORES POR CABALLO
        const playersByHorse = new Map();
        for (const [playerId, player] of Object.entries(game.players)) {
            const horseIndex = player.horseIndex;
            if (!playersByHorse.has(horseIndex)) {
                playersByHorse.set(horseIndex, []);
            }
            playersByHorse.get(horseIndex).push({ playerId, player });
        }
        
        // Calcular premios por caballo y repartir
        for (const [horseIndex, horsePlayers] of playersByHorse.entries()) {
            const horse = game.horses[horseIndex];
            const playersCount = horsePlayers.length;
            
            // Calcular premio base del caballo
            let baseMultiplier = 0;
            let position = 'No clasificó';
            
            if (horse.finishPosition === 1) {
                baseMultiplier = this.config.horseRace.payouts.first;
                position = '🥇 1er lugar';
            } else if (horse.finishPosition === 2) {
                baseMultiplier = this.config.horseRace.payouts.second;
                position = '🥈 2do lugar';
            } else if (horse.finishPosition === 3) {
                baseMultiplier = this.config.horseRace.payouts.third;
                position = '🥉 3er lugar';
            } else {
                // ✅ LÓGICA DE REEMBOLSO MEJORADA PARA MODO BOT
                if (game.mode === 'bot') {
                    // Obtener IDs del jugador y bot en este caballo
                    const playerInThisHorse = horsePlayers.find(hp => hp.playerId !== 'bot');
                    const botInThisHorse = horsePlayers.find(hp => hp.playerId === 'bot');
                    
                    // Verificar si AMBOS están fuera del podio
                    const playerHorseIndex = game.players[Object.keys(game.players).find(id => id !== 'bot')].horseIndex;
                    const botHorseIndex = game.players['bot'].horseIndex;
                    
                    const playerHorse = game.horses[playerHorseIndex];
                    const botHorse = game.horses[botHorseIndex];
                    
                    const bothOutOfPodium = playerHorse.finishPosition > 3 && botHorse.finishPosition > 3;
                    
                    if (bothOutOfPodium) {
                        // Ambos fuera del podio = 50% cada uno
                        baseMultiplier = this.config.horseRace.botMode.refundOnNoPodium;
                        position = '💸 Reembolso parcial (50%) - Ambos fuera del podio';
                    } else {
                        // Uno en podio, otro no = el que perdió pierde todo
                        baseMultiplier = 0;
                        position = `❌ No clasificó (posición #${horse.finishPosition})`;
                    }
                } else {
                    // Modo multijugador: sin premio si no clasificó
                    baseMultiplier = 0;
                    position = `❌ No clasificó (posición #${horse.finishPosition})`;
                }
            }

            // ✅ SI NO HAY MULTIPLICADOR, NO DAR DINERO
            if (baseMultiplier === 0) {
                for (const { playerId, player } of horsePlayers) {
                    const finalBet = player.hasDoubled ? player.bet * 2 : player.bet;
                    const doubledText = player.hasDoubled ? ' (x2 🎲)' : '';
                    const sharedText = playersCount > 1 ? ` [${playersCount} jugadores]` : '';
                    
                    results.set(playerId, { 
                        winnings: 0,
                        position: position + sharedText,
                        horse: horse.emoji, 
                        finalBet,
                        doubled: player.hasDoubled,
                        doubledText,
                        playersOnHorse: playersCount
                    });
                }
                continue; // ✅ SALTAR AL SIGUIENTE CABALLO
            }
            
            // ✅ CALCULAR PREMIO TOTAL DEL CABALLO (suma de todas las apuestas)
            let totalHorseBet = 0;
            for (const { player } of horsePlayers) {
                const finalBet = player.hasDoubled ? player.bet * 2 : player.bet;
                totalHorseBet += finalBet;
            }
            
            const totalHorsePrize = Math.floor(totalHorseBet * baseMultiplier);
            
            // ✅ REPARTIR EQUITATIVAMENTE ENTRE LOS JUGADORES
            for (const { playerId, player } of horsePlayers) {
                const finalBet = player.hasDoubled ? player.bet * 2 : player.bet;
                
                // Proporción de este jugador del premio total
                const playerShare = finalBet / totalHorseBet;
                let winnings = Math.floor(totalHorsePrize * playerShare);
                
                if (game.mode === 'bot'){
                    // ✅ Aplicar penalización de maldición (-25% dinero)
                    const activeEffects = this.shop.parseActiveEffects(player.activeEffects);
                    const curse = activeEffects['death_hand_curse'];
                    let curseMoneyPenalty = 0;

                    if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
                        const penaltyAmount = Math.floor(winnings * Math.abs(curse[0].moneyPenalty)); // 0.25 = 25%
                        curseMoneyPenalty = penaltyAmount;
                        winnings -= penaltyAmount;
                    }
                }
                
                const doubledText = player.hasDoubled ? ' (x2 🎲)' : '';
                const sharedText = playersCount > 1 ? ` [${playersCount} jugadores]` : '';
                
                results.set(playerId, { 
                    winnings, 
                    position: position + sharedText,
                    horse: horse.emoji, 
                    finalBet,
                    doubled: player.hasDoubled,
                    doubledText,
                    playersOnHorse: playersCount
                });
                
                // Dar dinero (excepto al bot)
                if (playerId !== 'bot' && winnings > 0) {
                    await this.economy.addMoney(playerId, winnings, 'horserace_win');
                }
            }
        }
        
        // ✅ DESHABILITAR BOTONES DEL MENSAJE DE CARRERA
        try {
            await raceMsg.edit({ components: [] });
        } catch (error) {
            console.log('No se pudo deshabilitar botones');
        }
        
        // Mostrar resultados
        await this.showRaceResults(game, channel, podium, results);
        
        // ✅ LIMPIAR JUEGO
        this.activeGames.delete(game.id);
    }

    async showRaceResults(game, channelOrMessage, podium, results) {
        const channel = channelOrMessage.channel || channelOrMessage;
        
        const allHorses = game.horses
            .filter(h => h.finishPosition)
            .sort((a, b) => a.finishPosition - b.finishPosition);
        
        let resultsText = '';
        
        for (const horse of allHorses) {
            const position = horse.finishPosition;
            
            // Emoji de posición compacto
            let posEmoji = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
            
            // Encontrar jugadores
            const playersOnHorse = [];
            for (const [playerId, player] of Object.entries(game.players)) {
                if (player.horseIndex === horse.index) {
                    playersOnHorse.push({ playerId, player });
                }
            }
            
            if (playersOnHorse.length === 0) {
                resultsText += `${posEmoji} ${horse.emoji}\n`;
                continue;
            }
            
            // ✅ VERSIÓN COMPACTA: Una línea por jugador
            for (const { playerId, player } of playersOnHorse) {
                const playerName = playerId === 'bot' ? '🤖Bot' : `<@${playerId}>`;
                const finalBet = player.hasDoubled ? player.bet * 2 : player.bet;
                const resultData = results.get(playerId);
                const winnings = resultData ? resultData.winnings : 0;
                const profit = winnings - finalBet;
                
                const profitEmoji = profit > 0 ? '✅' : profit < 0 ? '❌' : '➖';
                const profitText = profit > 0 ? `+${this.formatNumber(profit)}` : this.formatNumber(profit);
                const doubleEmoji = player.hasDoubled ? '💰' : '';
                
                resultsText += `${posEmoji} ${horse.emoji} ${playerName}${doubleEmoji} → ${profitEmoji} ${profitText}\n`;
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🏁 ¡CARRERA FINALIZADA!')
            .setDescription(
                `**🏆 Podio:**\n` +
                `🥇 ${podium[0]?.emoji} | 🥈 ${podium[1]?.emoji} | 🥉 ${podium[2]?.emoji}\n\n` +
                `**📊 Clasificación:**\n${resultsText}`
            )
            .setColor('#FFD700')
            .setTimestamp()
            .setFooter({ text: '💰 = Dobló apuesta | ✅ = Ganó | ❌ = Perdió' });
        
        await channel.send({ embeds: [embed] });
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
                .setTitle('🔫 Ruleta Rusa — Multijugador')
                .setDescription('> El último jugador en pie se lleva el **80%** del pot. Solo para valientes.')
                .addFields(
                    { name: '📝 Uso', value: '`>russian <cantidad>` — Crear o unirse a partida\n`>startrussian` — Iniciar (creador)\n`>shoot` — Disparar en tu turno', inline: false },
                    {
                        name: '⚙️ Cómo funciona',
                        value: [
                            '• Todos apuestan la misma cantidad',
                            '• El revólver tiene **6 cámaras**, **1 bala**',
                            '• Los jugadores se turnan para disparar',
                            '• El último vivo gana **80%** del pot total'
                        ].join('\n'),
                        inline: false
                    },
                    { name: '👥 Jugadores', value: `**Mín:** ${this.config.russianRoulette.minPlayers}\n**Máx:** ${this.config.russianRoulette.maxPlayers}`, inline: true },
                    { name: '💰 Apuesta', value: `**Mín:** ${this.formatNumber(this.config.russianRoulette.minBet)} π-b$\n**Máx:** ${this.formatNumber(this.config.russianRoulette.maxBet)} π-b$`, inline: true },
                    { name: '⏱️ Tiempos', value: '**60s** para unirse\n**20s** por turno', inline: true }
                )
                .setColor('#8B0000')
                .setFooter({ text: '⚠️ Items y efectos no aplican en este juego.' });
            return message.reply({ embeds: [embed] });
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
	        const trinityLol = await this.missions.checkTrinityCompletion(userId);            

            let allCompleted = [...gameMissions, ...betMissions, trinityLol];
                        
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
    
        let embed = new EmbedBuilder()
            .setTimestamp();

        let finalEarnings = winnerPrize;
            let eventMessage = '';
    
        if (survivors.length === 1) {
            // Un ganador
            const winner = survivors[0];

            const eventBonus = await this.applyEventEffects(userId, profit, 'minigames', message.guild?.id);
            finalEarnings = eventBonus.finalAmount;  

            const userData = await this.economy.getUser(winner.id);
            const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(winner.id) : this.economy.config.maxBalance;

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
                .map(([key, v]) => `${v.emoji} **${v.name}** — ${v.description}`)
                .join('\n');
            const embed = new EmbedBuilder()
                .setTitle('🎴 UNO — Juego de Cartas')
                .setDescription('> El primero en quedarse sin cartas gana el **90%** del pot. Estrategia y suerte.')
                .addFields(
                    { name: '📝 Uso', value: '`>ujoin <cantidad>` — Crear o unirse\n`>ustart` — Iniciar (creador)\n`>uleave` — Abandonar', inline: false },
                    { name: '🎮 Durante el juego', value: '`>uplay <color> <número>` — Jugar carta\n`>upickup` — Robar carta\n`>uhand` — Ver tu mano\n`>sayuno` — ¡UNO! (al tener 1 carta)\n`>ucallout` — Acusar a alguien de no decir UNO', inline: false },
                    { name: '🃏 Variantes', value: variantsList, inline: false },
                    { name: '👥 Jugadores', value: `**Mín:** ${this.config.uno.minPlayers}\n**Máx:** ${this.config.uno.maxPlayers}`, inline: true },
                    { name: '💰 Apuesta', value: `**Mín:** ${this.formatNumber(this.config.uno.minBet)} π-b$\n**Máx:** ${this.formatNumber(this.config.uno.maxBet)} π-b$`, inline: true },
                    { name: '⏱️ Turno', value: '**10 minutos** — si no jugás, sos expulsado', inline: true }
                )
                .setColor('#FF0000')
                .setFooter({ text: '⚠️ Items y efectos no aplican en este juego.' });
            return message.reply({ embeds: [embed] });
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
	        const trinityLol = await this.missions.checkTrinityCompletion(userId);            

            let allCompleted = [...gameMissions, ...betMissions, trinityLol];
                        
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
        
        if (variant === 'flip') {
            const deck = [];
            
            // Crear cartas del lado claro (18 de cada color)
            const lightCards = [];
            for (let color of UNO_COLORS) {
                // Números 1-9 (2 de cada uno = 18 cartas por color)
                for (let number of UNO_NUMBERS_FLIP) {
                    lightCards.push({ color, value: number, type: 'number' });
                    lightCards.push({ color, value: number, type: 'number' });
                }
                
                // 8 cartas especiales de cada tipo (2 por color)
                lightCards.push({ color, value: '+1', type: 'special' });
                lightCards.push({ color, value: '+1', type: 'special' });
                lightCards.push({ color, value: 'Skip', type: 'special' });
                lightCards.push({ color, value: 'Skip', type: 'special' });
                lightCards.push({ color, value: 'Reverse', type: 'special' });
                lightCards.push({ color, value: 'Reverse', type: 'special' });
                lightCards.push({ color, value: 'Flip', type: 'flip' });
                lightCards.push({ color, value: 'Flip', type: 'flip' });
            }
            
            // Crear cartas del lado oscuro (18 de cada color)
            const darkCards = [];
            for (let color of UNO_DARK_COLORS) {
                // Números 1-9 (2 de cada uno = 18 cartas por color)
                for (let number of UNO_NUMBERS_FLIP) {
                    darkCards.push({ color, value: number, type: 'number' });
                    darkCards.push({ color, value: number, type: 'number' });
                }
                
                // 8 cartas especiales de cada tipo (2 por color)
                darkCards.push({ color, value: '+5', type: 'dark_special' });
                darkCards.push({ color, value: '+5', type: 'dark_special' });
                darkCards.push({ color, value: 'Skip Everyone', type: 'dark_special' });
                darkCards.push({ color, value: 'Skip Everyone', type: 'dark_special' });
                darkCards.push({ color, value: 'Reverse', type: 'dark_special' });
                darkCards.push({ color, value: 'Reverse', type: 'dark_special' });
                darkCards.push({ color, value: 'Flip', type: 'flip' });
                darkCards.push({ color, value: 'Flip', type: 'flip' });
            }
            
            // Wild cards - 4 de cada tipo
            for (let i = 0; i < 4; i++) {
                lightCards.push({ color: 'black', value: 'Wild', type: 'wild' });
                lightCards.push({ color: 'black', value: 'Wild+2', type: 'wild' });
                darkCards.push({ color: 'black', value: 'Wild', type: 'wild' });
                darkCards.push({ color: 'black', value: 'Wild Draw Until Color', type: 'wild' });
            }
            
            // Mezclar y emparejar
            const shuffledLight = this.shuffleDeck([...lightCards]);
            const shuffledDark = this.shuffleDeck([...darkCards]);
            
            const maxCards = Math.min(shuffledLight.length, shuffledDark.length);
            for (let i = 0; i < maxCards; i++) {
                const flipCard = {
                    light: { ...shuffledLight[i], isDark: false },
                    dark: { ...shuffledDark[i], isDark: true }
                };
                
                const cardToAdd = isDarkSide ? 
                    { ...flipCard.dark, flipData: flipCard } :
                    { ...flipCard.light, flipData: flipCard };
                
                deck.push(cardToAdd);
            }
            
            return deck;
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
        if (card.type === 'wild' || card.type === 'no_mercy_wild') {
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
                'Wild Draw Until Color': 'wild-draw-until-color',
                'Wild': card.isDark ? 'wild-dark' : 'wild',
                'Wild+2': 'wild-draw-2',
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
            '+1': 'draw-1',
            '+5': 'draw-5',
            'skip everyone': 'skip-everyone',            
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
        } else if (variant === 'flip') {
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
        if (!card || !card.value) {
            return 'Carta inválida';
        }

        if (card.type === 'wild' || card.type === 'no_mercy_wild') {
            // Mapear los valores de Wild para mostrarlos correctamente
            const wildNames = {
                'Wild': 'Wild',
                'Wild+2': 'Wild +2',
                'Wild+4': 'Wild +4',
                'Wild Draw Until Color': 'Wild Draw Until Color',
                '+6': 'Wild +6',
                '+10': 'Wild +10',
                'Wild Draw Until Color': 'Wild Draw Until Color',
                'Discard All': 'Wild Discard All',
                '+4 Reverse': 'Wild +4 Reverse'
            };
            
            return wildNames[card.value] || card.value;
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
        let value = args.slice(2).join(" ").toLowerCase();
        
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

        // Para cartas Wild, el color SIEMPRE es el último argumento
        if (card.type === 'wild') {
            let lastArg = args[args.length - 1].toLowerCase();
            
            const validColors = game.darkSide ? 
                ['pink', 'teal', 'orange', 'purple'] : 
                ['red', 'yellow', 'green', 'blue'];
            
            if (!validColors.includes(lastArg)) {
                const colorsText = validColors.join(', ');
                await message.reply(`❌ El ÚLTIMO argumento debe ser un color válido\n**Colores válidos:** ${colorsText}\n**Ejemplos:**\n• \`>uplay wild red\`\n• \`>uplay wild +2 blue\`\n• \`>uplay wild draw until color pink\``);
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
            // El color es SIEMPRE el último argumento
            chosenColor = args[args.length - 1].toLowerCase();
        }

        await this.processCardEffect(card, game, chosenColor, message, userId);

        // Si se jugó Wild Draw Until Color, forzar al siguiente jugador
        if (card.value === 'Wild Draw Until Color' && game.drawUntilColor) {
            this.nextPlayer(game);
            setTimeout(async () => {
                await this.handleDrawUntilColorFlip(game, message);
            }, 1500);
            await this.updateUnoGameInDB(game);
            return;
        }

        // Verificar victoria
        if (player.hand.length === 0) {
            await this.endUnoGame(game, message, userId);
            return;
        }

        // Si es Skip Everyone, NO pasar turno
        if (card.value === 'Skip Everyone' && game.variant === 'flip' && game.darkSide) {
            const embed = this.createCardEmbed(
                card,
                '🎴 Carta Jugada',
                `<@${userId}> jugó: **${this.getCardString(card)}**\n\n` +
                `⏭️ **Skip Everyone!** Todos fueron saltados\n` +
                `**Le toca a:** <@${userId}> (de nuevo)\n` +
                `**Color actual:** ${game.current_color}`,
                game.variant
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

            const attachment = this.createCardAttachment(card, game.variant);
            const messageOptions = { 
                embeds: [embed], 
                components: [row]
            };
            
            if (attachment) {
                messageOptions.files = [attachment];
            }

            await message.reply(messageOptions);
            await this.updateUnoGameInDB(game);
            this.startTurnTimer(game, message);
            return;
        }

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
        if (card.value === '+2' || card.value === 'Wild+4' || card.value === '+5' || 
            card.value === 'Wild+2' || card.value === '+1' || card.value === '+6' || 
            card.value === '+10') {
            setTimeout(async () => {
                await this.forceDrawCards(game, message);
            }, 1500);
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

        if (card.value === 'Flip') {
            return;
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

        // AGREGAR: Limpiar cartas undefined primero
        player.hand = player.hand.filter(c => c !== undefined && c !== null);

        const index = player.hand.findIndex(card => {
            // Normalizar valores para comparación
            const cardValue = card.value.toLowerCase();
            const searchValue = value.toLowerCase();
            
            // CASO ESPECIAL: Cartas Wild
            if (card.type === 'wild') {
                const cardValue = card.value.toLowerCase().replace(/\s+/g, ''); // "wild+2"
                const searchValue = value.toLowerCase().replace(/\s+/g, ''); // "+2" o "2"
                
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

                // Detectar cualquier wild
                if (cardValue === 'wild' && (
                    color.toLowerCase() === 'wild' || 
                    color.toLowerCase() === 'black'
                )) {
                    return true;
                }
                    
                if (cardValue === 'wild+2' && (
                    searchValue === '+2' || 
                    searchValue === '2' ||
                    (color.toLowerCase() === 'wild' && searchValue.includes('2'))
                )) {
                    return true;
                }
                    
                if (cardValue === 'wild draw until color' && (
                    searchValue === 'wildcolor' ||
                    searchValue === 'drawcolor' ||
                    color.toLowerCase() === 'wild'
                )) {
                    return true;
                }

                if (cardValue === 'skip everyone' && (
                    searchValue === 'skip' || 
                    searchValue === 'skipeveryone' ||
                    searchValue === 'everyone' ||
                    searchValue === 'skip everyone'
                )) {
                    return cardColor === searchColor;
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

        // Para variantes con stack: verificar si puede defenderse
        if (rules.stackDrawCards) {
            const hasDefenseCard = currentPlayer.hand.some(card =>
                card.value === '+1' || 
                card.value === '+2' || 
                card.value === 'Wild+4' || 
                card.value === '+5' ||      // AGREGAR
                card.value === 'Wild+2' ||  // AGREGAR
                card.value === '+6' || 
                card.value === '+10'
            );
            
            if (hasDefenseCard) {
                await message.channel.send(
                    `⚠️ <@${currentPlayer.id}> debe robar ${game.draw_count} cartas O jugar una carta +2/+4/+5/+6/+10 para defenderse`
                );
                return;
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
                game.draw_count += 2;
                game.canStack = true;
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
                // Elegir del pool de colores correcto según el lado
                const availableColors = game.darkSide ? UNO_DARK_COLORS : UNO_COLORS;
                game.current_color = chosenColor || availableColors[0];
                
                console.log(`Wild jugada, lado: ${game.darkSide ? 'oscuro' : 'claro'}, color elegido: ${game.current_color}`);
                break;
            case 'Wild+4':
                game.current_color = chosenColor || UNO_COLORS[0];
                game.draw_count += 4;
                console.log(`Wild+4 jugada, nuevo color: ${game.current_color}, cartas acumuladas: ${game.draw_count}`);
                break;

            case '+1':
                if (game.variant === 'flip' && !game.darkSide) {
                    game.draw_count += 1;
                    game.canStack = true;
                }
                break;

            case 'Wild+2':
                if (game.variant === 'flip' && !game.darkSide) {
                    game.current_color = chosenColor || UNO_COLORS[0];
                    game.draw_count += 2;
                    game.canStack = true;
                }
                break;

            case '+5':
                if (game.variant === 'flip' && game.darkSide) {
                    game.draw_count += 5;
                    game.canStack = true;
                } else {
                    game.current_color = card.color;
                }
                break;

            case 'Skip Everyone':
                if (game.variant === 'flip' && game.darkSide) {
                    // NO cambiar current_player_index, el turno vuelve al mismo jugador
                    // Solo actualizar color
                    game.current_color = card.color;
                    
                    await message.reply(`⏭️ **Skip Everyone!** Todos fueron saltados, <@${userId}> juega de nuevo`);
                    
                    // NO llamar a nextPlayer aquí
                    return; // IMPORTANTE: detener aquí para que no pase turno
                }
                game.current_color = card.color;
                break;

            case 'Wild Draw Until Color':
                if (game.variant === 'flip' && game.darkSide) {
                    const availableColors = UNO_DARK_COLORS;
                    game.current_color = chosenColor || availableColors[0];
                    game.drawUntilColor = game.current_color;
                } else {
                    game.current_color = card.color;
                }
                break;

            case 'Flip':
                game.darkSide = !game.darkSide;
                
                // Transformar cartas en las manos de todos los jugadores
                for (let player of game.players) {
                    player.hand = player.hand.map(card => {
                        if (card.flipData) {
                            return game.darkSide ? 
                                { ...card.flipData.dark, flipData: card.flipData } :
                                { ...card.flipData.light, flipData: card.flipData };
                        }
                        return card;
                    });
                    player.cardCount = player.hand.length;
                }
                
                // Transformar deck
                game.deck = game.deck.map(card => {
                    if (card.flipData) {
                        return game.darkSide ? 
                            { ...card.flipData.dark, flipData: card.flipData } :
                            { ...card.flipData.light, flipData: card.flipData };
                    }
                    return card;
                });
                
                // NUEVO: Transformar también la pila de descarte
                game.discard_pile = game.discard_pile.map(card => {
                    if (card.flipData) {
                        return game.darkSide ? 
                            { ...card.flipData.dark, flipData: card.flipData } :
                            { ...card.flipData.light, flipData: card.flipData };
                    }
                    return card;
                });
                
                // Actualizar color actual según la carta superior transformada
                const topCard = game.discard_pile[game.discard_pile.length - 1];
                
                // Si la nueva carta superior es Wild, elegir color automáticamente
                if (topCard.type === 'wild') {
                    // Elegir color aleatorio según el lado
                    const colors = game.darkSide ? UNO_DARK_COLORS : UNO_COLORS;
                    game.current_color = colors[Math.floor(Math.random() * colors.length)];
                    
                    await message.reply(`🔄 **FLIP!** La carta volteada es un Wild. Color elegido automáticamente: **${game.current_color}**`);
                } else {
                    game.current_color = topCard.color;
                    await message.reply(`🔄 **FLIP!** Todas las cartas cambiaron al lado ${game.darkSide ? 'OSCURO 💀' : 'CLARO ☀️'}`);
                }
                
                // Mostrar la nueva carta superior
                const embed = this.createCardEmbed(
                    topCard,
                    '🎴 Nueva carta en mesa tras Flip',
                    `<@${userId}> jugó: **${this.getCardString(card)}**\n\n` +
                    `**Le toca a:** <@${game.players[game.current_player_index].id}>\n` +
                    `**Color actual:** ${game.current_color}\n**Siguiente turno:** <@${game.players[game.current_player_index].id}>`,
                    game.variant
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
                
                // Enviar nuevas manos
                for (let player of game.players) {
                    await this.sendHandAsEphemeral(message, player);
                }
                
                break;
                
/*            case '+4 Reverse':
                game.direction *= -1; // Cambiar dirección
                game.draw_count += 4;  // +4 cartas
                game.current_color = chosenColor || UNO_COLORS[0];
                break;
            case 'Wild+6':
                game.current_color = chosenColor || UNO_COLORS[0];
                game.draw_count += 6;
                break;
            case '+10':
                game.draw_count += 10;
                break;
            case 'Discard All':
                game.current_color = chosenColor || UNO_COLORS[0];
                await this.handleDiscardAll(game, message);
                break;*/
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

    async handleDrawUntilColorFlip(game, message) {
        const currentPlayer = game.players[game.current_player_index];
        let drawnCards = 0;
        const targetColor = game.drawUntilColor;
        
        await message.channel.send(`🎯 <@${currentPlayer.id}> debe robar cartas hasta conseguir el color **${targetColor}**`);
        
        while (true) {
            if (game.deck.length === 0) {
                await this.reshuffleDeck(game);
                if (game.deck.length === 0) {
                    await message.channel.send(`🛑 No quedan más cartas. <@${currentPlayer.id}> robó ${drawnCards} cartas`);
                    break;
                }
            }
            
            const card = game.deck.pop();
            if (!card) break;
            
            currentPlayer.hand.push(card);
            drawnCards++;
            
            if (card.color === targetColor) {
                await message.channel.send(`🎯 <@${currentPlayer.id}> robó ${drawnCards} cartas y consiguió ${targetColor}!`);
                break;
            }
            
            if (drawnCards >= 20) {
                await message.channel.send(`🛑 <@${currentPlayer.id}> robó ${drawnCards} cartas sin conseguir ${targetColor}`);
                break;
            }
        }
        
        currentPlayer.hand = currentPlayer.hand.filter(c => c !== undefined && c !== null);
        currentPlayer.cardCount = currentPlayer.hand.length;
        game.drawUntilColor = null;
        
        await this.sendHandAsEphemeral(message, currentPlayer);
        await this.updateUnoGameInDB(game);
        this.startTurnTimer(game, message);
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
                darkSideCard.type = 'special';
                break;
            case '+2':
                darkSideCard.value = '+5';
                break;
            case 'Reverse':
                darkSideCard.value = 'Skip Everyone';
                darkSideCard.type = 'special';
                break;
            case 'Wild':
                darkSideCard.value = 'Wild Draw Color';
                darkSideCard.type = 'wild';
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

        // Continuar el juego
        this.nextPlayer(game);

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
        
        // Continuar el juego
        this.nextPlayer(game);

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

        const eventBonus = await this.applyEventEffects(userId, profit, 'minigames', message.guild?.id);
        finalEarnings = eventBonus.finalAmount;    

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

        await message.channel.send({ embeds: [embed] });
        
        if (addResult.hitLimit) {
            const limitText = userLimit === 20000000 ? '20M π-b$ (VIP)' : '10M π-b$';
            await message.channel.send(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero porque tienes el máximo permitido (${this.formatNumber(userLimit)} π-b$).`);
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
        
        // CAMBIAR de message.reply a message.channel.send
        await message.channel.send(`⏰ <@${kickedPlayer.id}> fue expulsado por inactividad`);
        
        // Si solo queda 1 jugador, terminar juego
        if (game.players.length === 1) {
            await this.endUnoGame(game, message, game.players[0].id);
            return;
        }
        
        // Continuar con siguiente jugador
        await this.updateUnoGameInDB(game);
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
            if (!currentPot) {
                console.log('⚠️ No hay pozo actual');
                return;
            }
            
            // Solo verificar si está activo
            if (currentPot.status !== 'active') {
                console.log('ℹ️ El pozo actual no está activo, saltando verificación');
                return;
            }
            
            const weekEnd = currentPot.week_start + this.potConfig.weekDuration;
            const now = Date.now();
            
            // Verificar si ya expiró
            if (now >= weekEnd) {
                console.log(`🎯 Pozo expirado, distribuyendo (week_start: ${currentPot.week_start})`);
                
                // Distribuir y esperar a que termine completamente
                await this.distributePot(currentPot);
                
                // Esperar 2 segundos antes de crear el nuevo
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Ahora sí crear el nuevo pozo
                console.log('✅ Creando nuevo pozo semanal...');
                const newPot = await this.economy.database.getCurrentWeeklyPot();
                
                if (newPot) {
                    console.log(`✅ Nuevo pozo creado: week_start=${newPot.week_start}, status=${newPot.status}`);
                }
            }
        } catch (error) {
            console.error('❌ Error verificando expiración del pozo:', error);
        }
    }

    async distributePot(pot) {
        try {
            console.log(`📦 Distribuyendo pozo de la semana ${pot.week_start}`);
            
            // ✅ VERIFICAR QUE REALMENTE ESTÁ ACTIVO
            if (pot.status !== 'active') {
                console.log('⚠️ Este pozo ya fue distribuido, saltando...');
                return;
            }
            
            // Obtener todos los participantes
            const contributions = await this.economy.database.getPotContributions(pot.week_start);
            const participants = [...new Set(contributions.map(c => c.user_id))];
            
            if (participants.length === 0) {
                console.log('ℹ️ No hay participantes en el pozo');
                
                // ✅ MARCAR COMO COMPLETADO
                await this.economy.database.completePot(pot.week_start, null, []);
                
                // ✅ ELIMINAR CONTRIBUCIONES (aunque esté vacío)
                await this.economy.database.deletePotContributions(pot.week_start);
                
                // ✅ ELIMINAR EL POZO COMPLETADO
                await this.economy.database.deleteCompletedPot(pot.week_start);
                
                console.log('🧹 Pozo vacío limpiado de la base de datos');
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
            
            // ✅ MARCAR COMO COMPLETADO PRIMERO (antes de distribuir premios)
            await this.economy.database.completePot(pot.week_start, moneyWinner, itemWinners);
            console.log(`✅ Pozo marcado como completado (week_start: ${pot.week_start})`);
            
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
            
            // Anunciar resultados
            await this.announceWeeklyPotResults(pot, moneyWinner, itemWinners, participants.length);
            
            console.log(`🎉 Pozo distribuido exitosamente - Dinero: ${moneyWinner}, Items: ${itemWinners.length}`);
            
            // ✅ ESPERAR 2 SEGUNDOS ANTES DE LIMPIAR (para que el anuncio se envíe)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // ✅ ELIMINAR CONTRIBUCIONES
            await this.economy.database.deletePotContributions(pot.week_start);
            
            // ✅ ELIMINAR EL POZO COMPLETADO
            await this.economy.database.deleteCompletedPot(pot.week_start);
            
            console.log(`🧹 Pozo ${pot.week_start} eliminado completamente de la base de datos`);
            
        } catch (error) {
            console.error('❌ Error distribuyendo pozo:', error);
            console.error('⚠️ El pozo NO fue eliminado debido al error');
        }
    }
    
    async announceWeeklyPotResults(pot, moneyWinner, itemWinners, participantCount) {
        try {
            // Lista de canales donde anunciar (agrega tus IDs de canales aquí)
            const announcementChannels = [
                '1404905496644685834', // Canal principal
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
                .setTitle('🕳️ Pozo Semanal — Contribuir')
                .setDescription('> Mete dinero o items al pozo. Cada semana se distribuye entre los participantes.')
                .addFields(
                    { name: '💰 Dinero', value: '`>potcontribute money <cantidad>`', inline: true },
                    { name: '📦 Item', value: '`>potcontribute item <item_id>`', inline: true },
                    { name: '👁️ Ver pozo', value: '`>holethings`', inline: true },
                    {
                        name: '📋 Límites',
                        value: `**Dinero:** ${this.formatNumber(this.potConfig.minMoney)} – ${this.formatNumber(this.potConfig.maxMoney)} π-b$\n**Items:** Máx ${this.potConfig.maxItemsPerUser} por usuario por semana`,
                        inline: false
                    },
                    { name: '💡 Ejemplo', value: '`>potcontribute money 5000`\n`>potcontribute item lucky_charm`', inline: false }
                )
                .setColor('#8B4513')
                .setFooter({ text: 'La distribución es aleatoria entre todos los que contribuyeron.' });
            return message.reply({ embeds: [embed] });
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

    async canVendingMachine(userId) {
        const user = await this.economy.getUser(userId);

        if (this.shop) {
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.noCooldown) {
                return { canPlay: true };
            }
        }

        const cacheKey = `${userId}-vending`;
        const cachedCooldown = this.cooldownCache.get(cacheKey);
        const now = Date.now();
        
        let effectiveCooldown = await this.getEffectiveCooldown(this.config.vendingMachine.cooldown, null);

        if (this.shop) {
            const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
            effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
        }
        
        if (cachedCooldown && (now - cachedCooldown < effectiveCooldown)) {
            const timeLeft = effectiveCooldown - (now - cachedCooldown);
            return { canPlay: false, timeLeft };
        }

        const lastPlay = user.last_vending || 0;
        if (now - lastPlay < effectiveCooldown) {
            const timeLeft = effectiveCooldown - (now - lastPlay);
            return { canPlay: false, timeLeft };
        }

        return { canPlay: true };
    }

    async handleVendingMachine(message, args) {
        const userId = message.author.id;
        const user = await this.economy.getUser(userId);
        
        // Mostrar ayuda si no hay args
        if (args.length < 1) {
            const embed = new EmbedBuilder()
                .setTitle('🥤 Máquina Expendedora')
                .setDescription('> Mete **10 π-b$** y cruza los dedos. Si sale algo bueno, ganas **40 π-b$**.')
                .addFields(
                    { name: '🎮 Uso', value: '`>vending`', inline: false },
                    { name: '💰 Costo', value: '**10** π-b$ fijo', inline: true },
                    { name: '🏆 Premio', value: '**40** π-b$', inline: true },
                    { name: '📊 Probabilidad', value: '**45%** de ganar', inline: true },
                    { name: '⏱️ Cooldown', value: '**15 minutos**', inline: true }
                )
                .setColor('#FF6B6B')
                .setFooter({ text: 'Simple y rápido. Solo cuesta 10.' });
            return message.reply({ embeds: [embed] });
        }

        const betAmount = this.config.vendingMachine.minBet;
        
        // Verificar fondos
        if (user.balance < betAmount) {
            await message.reply(`❌ Necesitas ${this.formatNumber(betAmount)} π-b$ para usar la máquina`);
            return;
        }

        // Verificar cooldown
        const canPlay = await this.canVendingMachine(userId);
        if (!canPlay.canPlay) {
            await message.reply(`⏰ Debes esperar ${this.formatTime(canPlay.timeLeft)} antes de usar la máquina otra vez`);
            return;
        }

        // Quitar dinero
        await this.economy.removeMoney(userId, betAmount, 'vending_bet');
        
        // Determinar resultado
        const won = Math.random() > this.config.vendingMachine.failChance;
        
        // Establecer cooldown
        this.setCooldown(userId, 'vending');
        
        const updateData = {
            last_vending: Date.now(),
        };

        await this.economy.updateUser(userId, updateData);

        // Misiones
        if (this.missions) {
            const gameMissions = await this.missions.updateMissionProgress(userId, 'game_played');
            const betMissions = await this.missions.updateMissionProgress(userId, 'money_bet', betAmount);
            const trinityLol = await this.missions.checkTrinityCompletion(userId);
            
            let allCompleted = [...gameMissions, ...betMissions, trinityLol];
            if (allCompleted.length > 0) {
                await this.missions.notifyCompletedMissions(message, allCompleted);
            }
        }

        // Crear embed resultado
        const embed = new EmbedBuilder()
            .setTitle('🥤 Máquina Expendedora')
            .setTimestamp();

        if (won) {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_win');
            await this.economy.missions.updateMissionProgress(userId, 'game_won');

            let finalEarnings = this.config.vendingMachine.winAmount;
            
            // Aplicar eventos
            const eventBonus = await this.applyEventEffects(userId, finalEarnings, 'minigames', message.guild?.id);
            finalEarnings = eventBonus.finalAmount;
            
            // Aplicar items
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                const originalProfit = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                const vipBonus = finalEarnings - originalProfit;
                
                if (vipBonus > 0) {
                    await this.shop.updateVipStats(userId, 'bonusEarnings', vipBonus);
                }
                await this.shop.consumeItemUse(userId, 'games');
            }

            const equipmentBonus = await this.shop.applyEquipmentBonus(userId);
            let equipmentMessage = '';
            
            if (equipmentBonus.applied && equipmentBonus.money > 0) {
                const extraMoney = Math.floor(finalEarnings * equipmentBonus.money);
                finalEarnings += extraMoney;
                
                for (const equip of equipmentBonus.items) {
                    equipmentMessage += `\n${equip.wasBroken ? '💔' : '🛡️'} **${equip.name}**: `;
                    
                    if (equip.wasBroken) {
                        equipmentMessage += `¡SE ROMPIÓ! (era ${equip.durabilityLost})`;
                    } else {
                        equipmentMessage += `${equip.durabilityLeft}/${equip.maxDurability} (-${equip.durabilityLost})`;
                    }
                }
                
                if (extraMoney > 0) {
                    equipmentMessage = `💰 +${this.formatNumber(extraMoney)} π-b$ (equipamiento)${equipmentMessage}`;
                }
            }

            const userData = await this.economy.getUser(userId);
            const userLimit = this.economy.shop ? await this.economy.shop.getVipLimit(userId) : this.economy.config.maxBalance;

            if (userData.balance + finalEarnings > userLimit) {
                const spaceLeft = userLimit - userData.balance;
                finalEarnings = Math.min(finalEarnings, spaceLeft);
            }

            let itemMessage = '';
            if (this.shop) {
                const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
                if (modifiers.multiplier > 1) {
                    itemMessage = `✨ **Items Activos** (x${modifiers.multiplier.toFixed(1)} ganancia)`;
                }
            }

            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            const curse = activeEffects['death_hand_curse'];
            let curseMoneyPenalty = 0;

            if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
                const penaltyAmount = Math.floor(finalEarnings * Math.abs(curse[0].moneyPenalty));
                curseMoneyPenalty = penaltyAmount;
                finalEarnings -= penaltyAmount;
            }

            const addResult = await this.economy.addMoney(userId, finalEarnings, 'vending_win');
            finalEarnings = addResult.actualAmount;
            
            // Achievements
            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_won');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
                await this.achievements.updateStats(userId, 'bet_win', finalEarnings);
                await this.achievements.updateStats(userId, 'vending_plays', 1);
            }

            if (this.missions) {
                const winMissions = await this.missions.updateMissionProgress(userId, 'game_won');
                const betWonMissions = await this.missions.updateMissionProgress(userId, 'bet_won');
                const moneyMissions = await this.missions.updateMissionProgress(userId, 'money_earned_today', finalEarnings);
                
                let allCompleted = [...winMissions, ...betWonMissions, ...moneyMissions];
                if (allCompleted.length > 0) {
                    await this.missions.notifyCompletedMissions(message, allCompleted);
                }
            }

            embed.setDescription('🎉 **¡CAYÓ LA BEBIDA!**')
                .setColor('#00FF00')
                .addFields(
                    { name: '💰 Ganancia', value: `+${this.formatNumber(finalEarnings)} π-b$`, inline: true },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(userData.balance)} π-b$`, inline: true },
                    { name: '🎉 Bonificaciones', value: this.formatGameBonuses(eventBonus.eventMessage, '', itemMessage, equipmentMessage), inline: false }
                );

            if (curseMoneyPenalty > 0) {
                embed.addFields({
                    name: '☠️ Penalización de Maldición',
                    value: `-${this.formatNumber(curseMoneyPenalty)} π-b$ (-25% de ganancias)`,
                    inline: false
                });
            }

            if (addResult.hitLimit) {
                await message.reply(`⚠️ **Límite alcanzado:** No pudiste recibir todo el dinero (${this.formatNumber(userLimit)} π-b$)`);
            }
        } else {
            await this.economy.missions.updateMissionProgress(userId, 'consecutive_loss');
            
            // Sistema de protección
            const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
            let hasProtected = false;
            let protectionMessage = '';
            
            if (activeEffects['condon_pibe2']) {
                for (let i = activeEffects['condon_pibe2'].length - 1; i >= 0; i--) {
                    const effect = activeEffects['condon_pibe2'][i];
                    if (effect.type === 'protection' && effect.usesLeft > 0) {
                        hasProtected = true;
                        effect.usesLeft -= 1;
                        
                        if (effect.usesLeft <= 0) {
                            activeEffects['condon_pibe2'].splice(i, 1);
                            if (activeEffects['condon_pibe2'].length === 0) {
                                delete activeEffects['condon_pibe2'];
                            }
                        }
                        
                        await this.economy.updateUser(userId, { activeEffects });
                        protectionMessage = '🧃 ¡El Condón usado de Pibe 2 te protegió!';
                        break;
                    }
                }
            }
            
            if (!hasProtected && activeEffects['fortune_shield']) {
                for (const effect of activeEffects['fortune_shield']) {
                    if (effect.type === 'protection' && effect.expiresAt > Date.now()) {
                        const roll = Math.random();
                        if (roll < 0.80) {
                            hasProtected = true;
                            protectionMessage = '🛡️ Tu Escudo de la Fortuna te protegió';
                        } else {
                            protectionMessage = '💔 Tu Escudo de la Fortuna falló';
                        }
                        break;
                    }
                }
            }
            
            if (!hasProtected && activeEffects['health_potion']) {
                for (const effect of activeEffects['health_potion']) {
                    if (effect.type === 'penalty_protection' && effect.expiresAt > Date.now()) {
                        const roll = Math.random();
                        if (roll < 0.40) {
                            hasProtected = true;
                            protectionMessage = '💊 Tu Poción de Salud te protegió';
                        } else {
                            protectionMessage = '💔 Tu Poción de Salud falló';
                        }
                        break;
                    }
                }
            }
            
            if (hasProtected) {
                await message.reply(protectionMessage);
                await this.economy.addMoney(userId, betAmount, 'vending_refund');
            } else {
                if (protectionMessage) {
                    await message.reply(protectionMessage);
                }
            }

            if (this.achievements) {
                await this.achievements.updateStats(userId, 'game_played');
                await this.achievements.updateStats(userId, 'game_lost');
                await this.achievements.updateStats(userId, 'money_bet', betAmount);
                await this.achievements.updateStats(userId, 'vending_plays', 1);
            }

            embed.setDescription('💸 **¡SE ATASCÓ!**')
                .setColor('#FF0000')
                .addFields(
                    { name: '💸 Perdiste', value: `${this.formatNumber(betAmount)} π-b$`, inline: true },
                    { name: '💳 Balance Actual', value: `${this.formatNumber(user.balance)} π-b$`, inline: true }
                );
        }

        await this.checkTreasureHunt(userId, message);
        await message.reply({ embeds: [embed] });
    }

    async canTrivia(userId) {
        const user = await this.economy.getUser(userId);

        if (this.shop) {
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.noCooldown) {
                return { canPlay: true };
            }
        }

        const cacheKey = `${userId}-trivia`;
        const cachedCooldown = this.cooldownCache.get(cacheKey);
        const now = Date.now();
        
        let effectiveCooldown = await this.getEffectiveCooldown(this.config.trivia.cooldown, null);

        if (this.shop) {
            const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
            effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
        }
        
        if (cachedCooldown && (now - cachedCooldown < effectiveCooldown)) {
            const timeLeft = effectiveCooldown - (now - cachedCooldown);
            return { canPlay: false, timeLeft };
        }

        const lastPlay = user.last_trivia || 0;
        if (now - lastPlay < effectiveCooldown) {
            const timeLeft = effectiveCooldown - (now - lastPlay);
            return { canPlay: false, timeLeft };
        }

        return { canPlay: true };
    }

    // Limpiar preguntas antiguas del cache (más de 30 minutos)
    cleanOldTriviaQuestions() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutos
        
        for (const [userId, data] of this.recentTriviaQuestions.entries()) {
            if (now - data.timestamp > maxAge) {
                this.recentTriviaQuestions.delete(userId);
            }
        }
    }
    
    async playTrivia(message, args) {
        const userId = message.author.id;

        // Si no hay argumentos, mostrar ayuda
        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setTitle('🧠 Trivia — Pon a prueba tus conocimientos')
                .setDescription('> Responde **5 preguntas** de cultura general. Cuanto más difícil, mayor recompensa.')
                .addFields(
                    { name: '📝 Uso', value: '`>trivia <dificultad> [modo] [categoría]`', inline: false },
                    {
                        name: '🎯 Dificultades',
                        value: '`easy` — x1.0 recompensa\n`medium` — x1.5 recompensa\n`hard` — x2.0 recompensa',
                        inline: true
                    },
                    {
                        name: '🎮 Modos',
                        value: '`multiple` — 4 opciones\n`tof` — Verdadero o Falso (10 preguntas)',
                        inline: true
                    },
                    {
                        name: '💎 Recompensas (Medium)',
                        value: '**5/5** — 1,000 π-b$ + 50 XP\n**4/5** — 600 π-b$ + 30 XP\n**3/5** — 300 π-b$ + 15 XP\n**< 3** — 50 π-b$ + 5 XP',
                        inline: false
                    },
                    {
                        name: '💡 Pistas',
                        value: '**3 pistas** disponibles (Medium y Hard)\nElimina una respuesta incorrecta\n⚠️ Penalización: **-40%** recompensa',
                        inline: true
                    },
                    {
                        name: '⏱️ Tiempo y Cooldown',
                        value: '**15s** por pregunta\nCooldown: **1 minuto**',
                        inline: true
                    },
                    {
                        name: '📚 Categorías',
                        value: '`peliculas` `musica` `deportes` `historia`\n`ciencia` `videojuegos` `anime` `geografia`\nUsa `>triviacat` para ver todas',
                        inline: false
                    },
                    {
                        name: '💡 Ejemplos',
                        value: '`>trivia easy` — Fácil mixto\n`>trivia medium peliculas` — Películas normal\n`>trivia hard tof deportes` — Deportes difícil T/F',
                        inline: false
                    }
                )
                .setColor('#9932CC')
                .setFooter({ text: 'Gratis · ¡Demuestra cuánto sabés!' });
            return message.reply({ embeds: [embed] });
        }
        
        const canTrivia = await this.canTrivia(userId);
        if (!canTrivia.canPlay) {
            await message.reply(`⏰ Debes esperar ${this.formatTime(canTrivia.timeLeft)} antes de jugar otra vez`);
            return;
        }

        // Verificar si ya está en un juego
        if (this.activeGames.has(`trivia_${userId}`)) {
            return message.reply('❌ Ya estás en una partida de trivia.');
        }

        const difficulty = args[1].toLowerCase();

        // Validar dificultad
        if (!['easy', 'medium', 'hard'].includes(difficulty)) {
            return message.reply('❌ Dificultad inválida. Usa: `easy`, `medium` o `hard`');
        }

        // Mapa de categorías
        const categories = {
            'general': 9,
            'libros': 10, 'books': 10,
            'peliculas': 11, 'movies': 11, 'cine': 11,
            'musica': 12, 'music': 12,
            'tv': 14, 'television': 14,
            'videojuegos': 15, 'videogames': 15, 'games': 15,
            'ciencia': 17, 'science': 17, 'naturaleza': 17,
            'computacion': 18, 'computers': 18, 'informatica': 18,
            'matematicas': 19, 'math': 19, 'mates': 19,
            'mitologia': 20, 'mythology': 20,
            'deportes': 21, 'sports': 21,
            'geografia': 22, 'geography': 22, 'geo': 22,
            'historia': 23, 'history': 23,
            'arte': 25, 'art': 25,
            'animales': 27, 'animals': 27,
            'anime': 31, 'manga': 31,
            'cartoons': 32, 'caricaturas': 32
        };

        // Detectar modo y categoría
        let gameMode = 'multiple';  // Por defecto
        let categoryId = null;
        let categoryName = 'Mixto';

        const arg2 = args[2] ? args[2].toLowerCase() : null;
        const arg3 = args[3] ? args[3].toLowerCase() : null;

        // Caso 1: >trivia easy tof peliculas
        // arg2 = tof (modo), arg3 = peliculas (categoría)
        if (arg2 && ['multiple', 'tof', 'truefalse'].includes(arg2)) {
            gameMode = arg2;
            
            // Revisar si hay categoría en arg3
            if (arg3 && categories[arg3]) {
                categoryId = categories[arg3];
                categoryName = arg3.charAt(0).toUpperCase() + arg3.slice(1);
            }
        }
        // Caso 2: >trivia easy peliculas
        // arg2 = peliculas (categoría), NO hay modo (usar default: multiple)
        else if (arg2 && categories[arg2]) {
            categoryId = categories[arg2];
            categoryName = arg2.charAt(0).toUpperCase() + arg2.slice(1);
            // gameMode ya es 'multiple' por defecto
        }
        // Caso 3: >trivia easy xyz (ni modo ni categoría válidos)
        else if (arg2) {
            return message.reply(
                '❌ Modo o categoría inválida.\n\n' +
                '**Modos:** `multiple`, `tof`\n' +
                '**Categorías:** Usa `>triviacat` para ver todas\n\n' +
                '**Ejemplos:**\n' +
                '`>trivia easy` - Fácil mixto\n' +
                '`>trivia easy peliculas` - Fácil de películas\n' +
                '`>trivia easy tof deportes` - Fácil T/F de deportes'
            );
        }

        // Probabilidad 3% de recibir maldición aleatoria
        if (Math.random() < 0.03) {
            await this.economy.shop.applyRandomCurse(message.author.id);
            
            const curseNotif = new EmbedBuilder()
                .setTitle('☠️ ¡MALDICIÓN!')
                .setDescription('**La Mano del Muerto** apareció de la nada y te maldijo por 30 minutos.')
                .setColor('#8B0000');
            
            await message.reply({ embeds: [curseNotif] });
        }

        const isTrueFalse = ['tof', 'truefalse'].includes(gameMode);

        // === ITEMS DE TRIVIA ACTIVOS ===
        const triviaUserData = await this.economy.getUser(userId);
        const triviaActiveEffects = this.shop.parseActiveEffects(triviaUserData.activeEffects);

        let triviaExtraTime = 0;
        let triviaSkipsLeft = 0;
        let triviaEliminatesLeft = 0;
        let triviaDoubleReward = false;
        let triviaWrongShield = false;

        const triviaItemChecks = {
            'trivia_time_boost':    (fx) => { triviaExtraTime += fx.bonus || 10000; },
            'trivia_skip_token':    (fx) => { triviaSkipsLeft += 1; },
            'trivia_audience':      (fx) => { triviaEliminatesLeft += fx.eliminates || 2; },
            'trivia_double_reward': (fx) => { triviaDoubleReward = true; },
            'trivia_shield':        (fx) => { triviaWrongShield = true; },
            'trivia_kit': (fx) => {
                triviaExtraTime += 10000;
                triviaSkipsLeft += 1;
                triviaEliminatesLeft += 2;
                triviaWrongShield = true;
            },
            'trivia_master_pass': (fx) => {
                triviaDoubleReward = true;
                triviaWrongShield = true;
                triviaEliminatesLeft += 2;
            }
        };

        for (const [itemId, applyFn] of Object.entries(triviaItemChecks)) {
            const effects = triviaActiveEffects[itemId];
            if (effects && effects.length > 0) {
                applyFn(effects[0]);
                await this.shop.consumeItemUse(userId, itemId);
            }
        }

        const effectiveTriviaTime = this.config.trivia.timePerQuestion + triviaExtraTime;

        const difficultyMap = {
            'easy': 'easy',
            'medium': 'medium',
            'hard': 'hard'
        };

        // Establecer cooldown
        this.setCooldown(userId, 'trivia');

        const updateData = {
            last_trivia: Date.now(),
        }

        try {
            // Mensaje de carga
            const loadingEmbed = new EmbedBuilder()
                .setTitle('🌐 Preparando Trivia...')
                .setDescription('Estamos traduciendo tus preguntas al español...')
                .setColor('#9932CC');
            
            const loadingMessage = await message.reply({ embeds: [loadingEmbed] });

            // Obtener preguntas de OpenTDB
            const questionType = isTrueFalse ? 'boolean' : 'multiple';
            const questionAmount = isTrueFalse ? 10 : this.config.trivia.questionsPerGame;
            const categoryParam = categoryId ? `&category=${categoryId}` : '';
            const apiUrl = `https://opentdb.com/api.php?amount=${questionAmount}&difficulty=${difficultyMap[difficulty]}&type=${questionType}${categoryParam}`;
            
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.response_code !== 0 || !data.results || data.results.length === 0) {
                await loadingMessage.edit({ 
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Error')
                        .setDescription('No se pudieron obtener preguntas. Intenta de nuevo.')
                        .setColor('#FF0000')
                    ]
                });
                return;
            }

            // Limpiar preguntas antiguas primero
            this.cleanOldTriviaQuestions();

            // Obtener preguntas recientes del usuario (por categoría y dificultad)
            const cacheKeys = `${userId}_${difficulty}_${categoryId || 'all'}`;
            const userRecentQuestions = this.recentTriviaQuestions.get(cacheKeys);
            let availableQuestions = data.results;
            
            // Si el usuario jugó recientemente, filtrar preguntas repetidas
            if (userRecentQuestions && userRecentQuestions.questions.length > 0) {
                console.log(`📝 Usuario tiene ${userRecentQuestions.questions.length} preguntas recientes guardadas`);
                
                const recentQuestionsSet = new Set(userRecentQuestions.questions);
                const uniqueQuestions = data.results.filter(q => !recentQuestionsSet.has(q.question));
                
                console.log(`✅ Preguntas únicas disponibles: ${uniqueQuestions.length}/${data.results.length}`);
                
                // Si hay suficientes preguntas únicas, usar solo esas
                if (uniqueQuestions.length >= questionAmount) {
                    availableQuestions = uniqueQuestions;
                    console.log(`✨ Usando solo preguntas únicas`);
                } else {
                    // Si no hay suficientes, pedir más preguntas a la API
                    console.log(`⚠️ No hay suficientes preguntas únicas, pidiendo más a la API...`);
                    
                    try {
                        const extraAmount = questionAmount * 3; // Pedir 3x para tener más opciones
                        const extraApiUrl = `https://opentdb.com/api.php?amount=${extraAmount}&difficulty=${difficultyMap[difficulty]}&type=${questionType}`;
                        const extraResponse = await fetch(extraApiUrl);
                        const extraData = await extraResponse.json();
                        
                        if (extraData.response_code === 0 && extraData.results) {
                            // Filtrar de nuevo con más preguntas
                            const allQuestions = [...data.results, ...extraData.results];
                            const moreUniqueQuestions = allQuestions.filter(q => !recentQuestionsSet.has(q.question));
                            
                            console.log(`✅ Con preguntas extra: ${moreUniqueQuestions.length} únicas disponibles`);
                            availableQuestions = moreUniqueQuestions.length >= questionAmount 
                                ? moreUniqueQuestions 
                                : allQuestions; // Si aún no hay suficientes, usar todas
                        }
                    } catch (error) {
                        console.error('Error obteniendo preguntas extra:', error);
                        availableQuestions = data.results; // Usar las originales si falla
                    }
                }
            }

            // Tomar solo la cantidad necesaria
            const selectedQuestions = availableQuestions.slice(0, questionAmount);
            
            console.log(`🎯 Preguntas seleccionadas: ${selectedQuestions.length}`);
                        
            // Guardar las preguntas para evitar repetición (por categoría y dificultad)
            const cacheKey = `${userId}_${difficulty}_${categoryId || 'all'}`;
            const existingCache = this.recentTriviaQuestions.get(cacheKey);
            const existingQuestions = existingCache ? existingCache.questions : [];
            const newQuestions = selectedQuestions.map(q => q.question);
            
            // Combinar y limitar a las últimas 100 preguntas por categoría
            const combinedQuestions = [...existingQuestions, ...newQuestions].slice(-100);
            
            this.recentTriviaQuestions.set(cacheKey, {
                questions: combinedQuestions,
                timestamp: Date.now()
            });
            
            console.log(`💾 Cache actualizado para ${difficulty}/${categoryName}: ${combinedQuestions.length} preguntas guardadas`);

            // Traducir preguntas
            const questions = await Promise.all(data.results.map(async (q) => {
                // Decodificar primero
                const decodedQuestion = this.decodeHTML(q.question);
                const decodedCorrect = this.decodeHTML(q.correct_answer);
                const decodedIncorrect = q.incorrect_answers.map(ans => this.decodeHTML(ans));

                // Para True/False, traducir directamente
                if (isTrueFalse) {
                    const translatedQuestion = await this.translateText(decodedQuestion);
                    const translatedCorrect = decodedCorrect === 'True' ? 'Verdadero' : 'Falso';
                    const allAnswers = ['Verdadero', 'Falso'];
                    
                    return {
                        question: translatedQuestion,
                        correct: translatedCorrect,
                        answers: allAnswers,
                        category: await this.translateText(this.decodeHTML(q.category)),
                        isTrueFalse: true
                    };
                }

                const allAnswersOriginal = [decodedCorrect, ...decodedIncorrect];
                
                // Intentar traducción con contexto (todo junto)
                const contextTranslation = await this.translateTriviaQuestion(
                    decodedQuestion, 
                    allAnswersOriginal, 
                    decodedCorrect
                );
                
                if (contextTranslation) {
                    // Traducción exitosa con contexto
                    const translatedCorrect = contextTranslation.answers[allAnswersOriginal.indexOf(decodedCorrect)];
                    
                    return {
                        question: contextTranslation.question,
                        correct: translatedCorrect,
                        answers: contextTranslation.answers.sort(() => Math.random() - 0.5), // Mezclar
                        category: await this.translateText(this.decodeHTML(q.category))
                    };
                } else {
                    // Fallback: traducción individual (método antiguo)
                    console.log('⚠️ Usando traducción individual para esta pregunta');
                    const translatedQuestion = await this.translateText(decodedQuestion);
                    const translatedCorrect = await this.translateText(decodedCorrect);
                    const translatedIncorrect = await Promise.all(
                        decodedIncorrect.map(ans => this.translateText(ans))
                    );

                    const allAnswers = [translatedCorrect, ...translatedIncorrect].sort(() => Math.random() - 0.5);

                    return {
                        question: translatedQuestion,
                        correct: translatedCorrect,
                        answers: allAnswers,
                        category: await this.translateText(this.decodeHTML(q.category))
                    };
                }
            }));

            // Marcar como activo
            this.activeGames.set(`trivia_${userId}`, true);

            // Actualizar mensaje: Iniciando juego
            const modeText = isTrueFalse ? 'Verdadero o Falso' : 'Opción Múltiple';
            const startEmbed = new EmbedBuilder()
                .setTitle('🧠 Iniciando Trivia...')
                .setDescription(
                    `**Categoría:** ${categoryName}\n` +
                    `**Modo:** ${modeText}\n` +
                    `**Dificultad:** ${difficulty.toUpperCase()}\n` +
                    `**Preguntas:** ${questions.length}\n` +
                    `**Tiempo:** ${effectiveTriviaTime / 1000} segundos por pregunta`
                )
                .setColor('#9932CC')
                .setFooter({ text: 'El juego comenzará en 3 segundos...' });

            await loadingMessage.edit({ embeds: [startEmbed] });

            // Esperar 3 segundos
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Variables del juego
            let currentQuestion = 0;
            let correctAnswers = 0;
            let gameMessage = loadingMessage; // Reutilizar el mismo mensaje
            let hintsRemaining = this.config.trivia.hintsPerGame;
            let usedHintThisQuestion = false;
            let questionResults = []; // Para guardar resultados de cada pregunta

            // Función para mostrar pregunta
            const showQuestion = async () => {
                const q = questions[currentQuestion];
                const letters = q.isTrueFalse ? ['V', 'F'] : ['A', 'B', 'C', 'D'];

                // LOG: Mostrar pregunta y respuesta correcta
                console.log(`\n📝 TRIVIA - Pregunta ${currentQuestion + 1}/${questions.length}`);
                console.log(`❓ Pregunta: ${q.question}`);
                console.log(`✅ Respuesta correcta: ${q.correct}`);
                console.log(`📚 Categoría: ${q.category}`);
                console.log(`📊 Opciones: ${q.answers.join(' | ')}\n`);
                
                // Crear texto de opciones (con límite de caracteres)
                let optionsText = '';
                if (q.isTrueFalse) {
                    // Para True/False: sin letras, solo las opciones
                    optionsText = q.answers.map(ans => `${ans}`).join('  •  ');
                } else {
                    // Para Multiple Choice: con letras
                    q.answers.forEach((answer, index) => {
                        const truncatedAnswer = answer.length > 100 ? answer.substring(0, 97) + '...' : answer;
                        optionsText += `**${letters[index]})**  ${truncatedAnswer}\n`;
                    });
                }

                const questionEmbed = new EmbedBuilder()
                    .setTitle(`🧠 Pregunta ${currentQuestion + 1}/${questions.length}`)
                    .setDescription(`<@${userId}>, responde esta pregunta:\n\n**${q.question}**`)
                    .addFields(
                        { name: '📝 Opciones', value: optionsText, inline: false },
                        { name: '📊 Dificultad', value: difficulty.toUpperCase(), inline: true },
                        { name: '📚 Categoría', value: q.category, inline: true },
                        { name: '✅ Correctas', value: `${correctAnswers}`, inline: true }
                    )
                    .setColor('#9932CC')
                    .setFooter({ text: `⏱️ Tienes ${effectiveTriviaTime / 1000} segundos para responder` });

                const buttons = new ActionRowBuilder();
            
                if (q.isTrueFalse) {
                    // Botones para True/False
                    buttons.addComponents(
                        new ButtonBuilder()
                            .setCustomId('trivia_0')
                            .setLabel(q.answers[0] === 'Verdadero' ? 'V - Verdadero' : 'F - Falso')
                            .setStyle(q.answers[0] === 'Verdadero' ? ButtonStyle.Success : ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('trivia_1')
                            .setLabel(q.answers[1] === 'Verdadero' ? 'V - Verdadero' : 'F - Falso')
                            .setStyle(q.answers[1] === 'Verdadero' ? ButtonStyle.Success : ButtonStyle.Danger)
                    );
                } else {
                    // Botones para Multiple Choice
                    letters.forEach((letter, index) => {
                        buttons.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`trivia_${index}`)
                                .setLabel(letter)
                                .setStyle(ButtonStyle.Primary)
                        );
                    });
                }

                // Botón de pista (solo si quedan pistas y NO es easy ni True/False)
                const canUseHint = hintsRemaining > 0 && 
                                difficulty !== 'easy' && 
                                !q.isTrueFalse;
                
                if (canUseHint) {
                    buttons.addComponents(
                        new ButtonBuilder()
                            .setCustomId('trivia_hint')
                            .setLabel(`💡 Pista (${hintsRemaining})`)
                            .setStyle(ButtonStyle.Secondary)
                    );
                }

                if (triviaSkipsLeft > 0 && !isTrueFalse) {
                    buttons.addComponents(
                        new ButtonBuilder()
                            .setCustomId('trivia_skip')
                            .setLabel(`⏭️ Saltar (${triviaSkipsLeft})`)
                            .setStyle(ButtonStyle.Secondary)
                    );
                }

                if (triviaEliminatesLeft > 0 && !isTrueFalse) {
                    buttons.addComponents(
                        new ButtonBuilder()
                            .setCustomId('trivia_eliminate')
                            .setLabel(`👥 Público (${triviaEliminatesLeft})`)
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                await gameMessage.edit({ embeds: [questionEmbed], components: [buttons] });

                // Timeout para esta pregunta
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => resolve('timeout'), effectiveTriviaTime);
                });

                // Esperar respuesta del usuario
                const filter = (i) => i.user.id === userId && i.customId.startsWith('trivia_');
                
                let answered = false;
                while (!answered) {
                    const collectorPromise = gameMessage.awaitMessageComponent({ 
                        filter, 
                        time: effectiveTriviaTime + 5000 // +5 segundos de gracia
                    }).catch((error) => {
                        console.log('⚠️ Collector error:', error.message);
                        return null;
                    });

                    const result = await Promise.race([timeoutPromise, collectorPromise]);

                    if (result === 'timeout' || !result) {
                        // Timeout - Mostrar respuesta correcta
                        const timeoutEmbed = new EmbedBuilder()
                            .setTitle('⏰ ¡Se acabó el tiempo!')
                            .setDescription(
                                `**Pregunta:** ${q.question}\n\n` +
                                `❌ **No respondiste a tiempo**\n\n` +
                                `✅ **Respuesta correcta:** ${q.correct}`
                            )
                            .setColor('#FF0000');

                        await gameMessage.edit({ embeds: [timeoutEmbed], components: [] });
                        await new Promise(resolve => setTimeout(resolve, 5000));

                        // Guardar resultado
                        questionResults.push({
                            question: q.question.length > 100 ? q.question.substring(0, 97) + '...' : q.question,
                            userAnswer: null,
                            correctAnswer: q.correct,
                            correct: false
                        });

                        try {
                            await gameMessage.delete();
                        } catch (error) {
                            console.log('No se pudo borrar el mensaje:', error.message);
                        }

                        currentQuestion++;
                        usedHintThisQuestion = false;
                        
                        if (currentQuestion < questions.length) {
                            const loadingEmbed = new EmbedBuilder()
                                .setDescription('⏳ Preparando siguiente pregunta...')
                                .setColor('#9932CC');
                            gameMessage = await message.channel.send({ embeds: [loadingEmbed] });
                            await showQuestion();
                        } else {
                            await endGame();
                        }
                        return;
                    }

                    const interaction = result;

                    // Si pidió una pista
                    if (interaction.customId === 'trivia_hint') {
                        // No permitir pistas en True/False
                        if (q.isTrueFalse) {
                            await interaction.reply({ 
                                content: '❌ No puedes usar pistas en preguntas de Verdadero/Falso', 
                                ephemeral: true 
                            });
                            continue;
                        }
                        
                        // No permitir pistas en easy (por si acaso)
                        if (difficulty === 'easy') {
                            await interaction.reply({ 
                                content: '❌ Las pistas no están disponibles en dificultad fácil', 
                                ephemeral: true 
                            });
                            continue;
                        }

                        hintsRemaining--;
                        usedHintThisQuestion = true;
                        
                        // Eliminar una respuesta incorrecta
                        const wrongAnswers = q.answers.filter(ans => ans !== q.correct);
                        const toRemove = wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)];
                        const remainingAnswers = q.answers.filter(ans => ans !== toRemove);
                        
                        // Recrear embed con menos opciones
                        let newOptionsText = '';
                        const newLetters = ['A', 'B', 'C'];
                        remainingAnswers.forEach((answer, index) => {
                            const truncatedAnswer = answer.length > 100 ? answer.substring(0, 97) + '...' : answer;
                            newOptionsText += `**${newLetters[index]})**  ${truncatedAnswer}\n`;
                        });

                        const hintEmbed = new EmbedBuilder()
                            .setTitle(`🧠 Pregunta ${currentQuestion + 1}/${questions.length}`)
                            .setDescription(`<@${userId}>, responde esta pregunta:\n\n**${q.question}**`)
                            .addFields(
                                { name: '💡 Pista usada - Eliminé 1 respuesta incorrecta (quedan 3 opciones)', value: newOptionsText, inline: false },
                                { name: '📊 Dificultad', value: difficulty.toUpperCase(), inline: true },
                                { name: '📚 Categoría', value: q.category, inline: true },
                                { name: '✅ Correctas', value: `${correctAnswers}`, inline: true }
                            )
                            .setColor('#FFA500')
                            .setFooter({ text: `⚠️ Recompensa reducida al 40% | ${hintsRemaining} pistas restantes` });

                        const newButtons = new ActionRowBuilder();
                        newLetters.forEach((letter, index) => {
                            newButtons.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`trivia_hint_${index}`)
                                    .setLabel(letter)
                                    .setStyle(ButtonStyle.Primary)
                            );
                        });

                        await interaction.update({ embeds: [hintEmbed], components: [newButtons] });
                        
                        // Actualizar el array de respuestas y continuar esperando
                        q.answers = remainingAnswers;
                        continue; // Volver a esperar respuesta
                    }

                    if (interaction.customId === 'trivia_skip') {
                        if (triviaSkipsLeft <= 0) {
                            await interaction.reply({ content: '❌ No tienes saltos disponibles', ephemeral: true });
                            continue;
                        }
                        triviaSkipsLeft--;

                        const skipEmbed = new EmbedBuilder()
                            .setTitle('⏭️ Pregunta saltada')
                            .setDescription(`Saltaste esta pregunta.\n\n✅ **Respuesta correcta era:** ${q.correct}`)
                            .setColor('#FFA500');

                        await interaction.update({ embeds: [skipEmbed], components: [] });
                        await new Promise(resolve => setTimeout(resolve, 3000));

                        // No contar como correcta ni incorrecta, simplemente avanzar
                        questionResults.push({
                            question: q.question.length > 100 ? q.question.substring(0, 97) + '...' : q.question,
                            userAnswer: '⏭️ Saltada',
                            correctAnswer: q.correct,
                            correct: false,
                            skipped: true
                        });

                        try { await gameMessage.delete(); } catch {}
                        currentQuestion++;
                        usedHintThisQuestion = false;
                        if (currentQuestion < questions.length) {
                            const loadingEmbed = new EmbedBuilder().setDescription('⏳ Preparando siguiente pregunta...').setColor('#9932CC');
                            gameMessage = await message.channel.send({ embeds: [loadingEmbed] });
                            await showQuestion();
                        } else {
                            await endGame();
                        }
                        return;
                    }

                    if (interaction.customId === 'trivia_eliminate') {
                        if (triviaEliminatesLeft <= 0) {
                            await interaction.reply({ content: '❌ No tienes ayudas del público disponibles', ephemeral: true });
                            continue;
                        }
                        triviaEliminatesLeft--;

                        // Eliminar 2 respuestas incorrectas
                        const wrongOpts = q.answers.filter(a => a !== q.correct);
                        const toRemove = wrongOpts.sort(() => Math.random() - 0.5).slice(0, 2);
                        q.answers = q.answers.filter(a => !toRemove.includes(a));

                        // Recrear embed con 2 opciones
                        const newLetters = ['A', 'B'];
                        let newOpts = '';
                        q.answers.forEach((ans, i) => {
                            newOpts += `**${newLetters[i]})** ${ans.length > 100 ? ans.substring(0, 97) + '...' : ans}\n`;
                        });

                        const elimEmbed = new EmbedBuilder()
                            .setTitle(`🧠 Pregunta ${currentQuestion + 1}/${questions.length}`)
                            .setDescription(`<@${userId}>, responde esta pregunta:\n\n**${q.question}**`)
                            .addFields(
                                { name: '👥 Ayuda del Público — 2 opciones eliminadas', value: newOpts, inline: false },
                                { name: '📊 Dificultad', value: difficulty.toUpperCase(), inline: true },
                                { name: '📚 Categoría', value: q.category, inline: true },
                                { name: '✅ Correctas', value: `${correctAnswers}`, inline: true }
                            )
                            .setColor('#00BFFF')
                            .setFooter({ text: `⏱️ Tienes ${effectiveTriviaTime / 1000} segundos` });

                        const newBtns = new ActionRowBuilder();
                        newLetters.forEach((letter, i) => {
                            newBtns.addComponents(new ButtonBuilder().setCustomId(`trivia_${i}`).setLabel(letter).setStyle(ButtonStyle.Primary));
                        });

                        await interaction.update({ embeds: [elimEmbed], components: [newBtns] });
                        continue;
                    }

                    // Si es una respuesta normal
                    answered = true;
                    const answerIndex = parseInt(interaction.customId.split('_')[interaction.customId.split('_').length - 1]);
                    const selectedAnswer = q.answers[answerIndex];
                    const isCorrect = selectedAnswer === q.correct;

                    // Guardar resultado
                    questionResults.push({
                        question: q.question.length > 100 ? q.question.substring(0, 97) + '...' : q.question,
                        userAnswer: selectedAnswer,
                        correctAnswer: q.correct,
                        correct: isCorrect
                    });

                    if (isCorrect) {
                        correctAnswers++;
                        
                        const correctEmbed = new EmbedBuilder()
                            .setTitle('✅ ¡Correcto!')
                            .setDescription(
                                `<@${userId}> respondió correctamente\n\n` +
                                `**Pregunta:** ${q.question}\n\n` +
                                `✅ **Respuesta:** ${selectedAnswer}\n\n` +
                                `¡Bien hecho!${usedHintThisQuestion ? '\n\n⚠️ Usaste pista - Recompensa reducida' : ''}`
                            )
                            .setColor('#00FF00');

                        await interaction.update({ embeds: [correctEmbed], components: [] });
                    } else {
                        const wrongEmbed = new EmbedBuilder()
                            .setTitle('❌ Incorrecto')
                            .setDescription(
                                `<@${userId}> respondió incorrectamente\n\n` +
                                `**Pregunta:** ${q.question}\n\n` +
                                `❌ **Tu respuesta:** ${selectedAnswer}\n` +
                                `✅ **Respuesta correcta:** ${q.correct}`
                            )
                            .setColor('#FF0000');

                        await interaction.update({ embeds: [wrongEmbed], components: [] });
                    }

                    await new Promise(resolve => setTimeout(resolve, 5000));

                    try {
                        await gameMessage.delete();
                    } catch (error) {
                        console.log('No se pudo borrar el mensaje:', error.message);
                    }

                    currentQuestion++;
                    usedHintThisQuestion = false;
                    
                    if (currentQuestion < questions.length) {
                        const loadingEmbed = new EmbedBuilder()
                            .setDescription('⏳ Preparando siguiente pregunta...')
                            .setColor('#9932CC');
                        gameMessage = await message.channel.send({ embeds: [loadingEmbed] });
                        await showQuestion();
                    } else {
                        await endGame();
                    }
                }
            }

            // Función para finalizar el juego
            const endGame = async () => {
                const userId = message.author.id;
                const user = await this.economy.getUser(userId);
                this.activeGames.delete(`trivia_${userId}`);

                // Calcular recompensas
                let reward = this.config.trivia.rewards.participation;
                // Calcular recompensas según preguntas correctas
                const totalQuestions = isTrueFalse ? 10 : 5;
                
                if (correctAnswers === totalQuestions) {
                    // Perfecto (5/5 o 10/10)
                    reward = this.config.trivia.rewards.perfect;

                    // Si fue T/F perfecta, también actualizar stat específica
                    if (isTrueFalse) {
                        await this.economy.achievements.updateStats(userId, 'trivia_tof_perfect');
                    }
                    else
                        await this.economy.achievements.updateStats(userId, 'trivia_perfect');                
                } 
                else if (isTrueFalse) {
                    // Recompensas para True/False (10 preguntas)
                    if (correctAnswers >= 8) reward = this.config.trivia.rewards.good;      // 8-9/10
                    else if (correctAnswers >= 6) reward = this.config.trivia.rewards.decent; // 6-7/10
                    else reward = this.config.trivia.rewards.participation; // menos de 6
                }
                else {
                    // Recompensas para Multiple Choice (5 preguntas)
                    if (correctAnswers === 4) reward = this.config.trivia.rewards.good;      // 4/5
                    else if (correctAnswers === 3) reward = this.config.trivia.rewards.decent; // 3/5
                    else reward = this.config.trivia.rewards.participation; // menos de 3
                }

                const diffMultiplier = this.config.trivia.difficulties[difficulty].multiplier;
                const hintsUsed = this.config.trivia.hintsPerGame - hintsRemaining;
                const hintMultiplier = hintsUsed > 0 ? this.config.trivia.hintPenalty : 1;

                // ✅ Aplicar penalización de maldición (-25% dinero)
                const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
                const curse = activeEffects['death_hand_curse'];
                let curseMoneyPenalty = 0;

                if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
                    const penaltyAmount = Math.floor(reward.money * Math.abs(curse[0].moneyPenalty)); // 0.25 = 25%
                    curseMoneyPenalty = penaltyAmount;
                    reward.money -= penaltyAmount;
                }
                
                // Escudo: absorbe 1 fallo (si tienes 4/5 con escudo = se cuenta como 5/5)
                let effectiveCorrect = correctAnswers;
                if (triviaWrongShield && correctAnswers < questions.length) {
                    effectiveCorrect = Math.min(correctAnswers + 1, questions.length);
                    console.log(`🛡️ Escudo de trivia activado: ${correctAnswers} → ${effectiveCorrect}`);
                }

                // Recalcular reward con effectiveCorrect en lugar de correctAnswers
                if (effectiveCorrect === totalQuestions) {
                    reward = this.config.trivia.rewards.perfect;
                } else if (isTrueFalse) {
                    if (effectiveCorrect >= 8) reward = this.config.trivia.rewards.good;
                    else if (effectiveCorrect >= 6) reward = this.config.trivia.rewards.decent;
                    else reward = this.config.trivia.rewards.participation;
                } else {
                    if (effectiveCorrect === 4) reward = this.config.trivia.rewards.good;
                    else if (effectiveCorrect === 3) reward = this.config.trivia.rewards.decent;
                    else reward = this.config.trivia.rewards.participation;
                }

                const finalMoney = Math.floor(reward.money * diffMultiplier * hintMultiplier);
                const finalXP = Math.floor(reward.xp * diffMultiplier * hintMultiplier);

                // Doble recompensa
                let finalMoneyWithBonus = finalMoney;
                let finalXPWithBonus = finalXP;
                if (triviaDoubleReward) {
                    finalMoneyWithBonus = finalMoney * 2;
                    finalXPWithBonus = finalXP * 2;
                }

                // Otorgar recompensas
                await this.economy.addMoney(userId, finalMoneyWithBonus);
                await this.economy.addXp(userId, finalXPWithBonus);
                await this.economy.updateUser(userId, updateData);

                // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
                if (this.achievements) {
                    await this.achievements.updateStats(userId, 'game_played');
                    await this.achievements.updateStats(userId, 'game_won');
                    await this.achievements.updateStats(userId, 'bet_win', finalMoney);
                }        
                               
                const updateDataTrivia = {
                    stats: {
                        ...user.stats,
                        trivia_played: (user.stats?.trivia_played || 0) + 1,
                        trivia_correct_total: (user.stats?.trivia_correct_total || 0) + correctAnswers,
                        trivia_questions_total: (user.stats?.trivia_questions_total || 0) + questions.length
                    }
                };
                
                await this.economy.updateUser(userId, updateDataTrivia);
            
                // Crear resumen de preguntas
                let questionsReview = '';
                questionResults.forEach((result, index) => {
                    const emoji = result.correct ? '✅' : '❌';
                    questionsReview += `${emoji} **Pregunta ${index + 1}:** ${result.question}\n`;
                    questionsReview += `   **Tu respuesta:** ${result.userAnswer || 'Sin respuesta'}\n`;
                    if (!result.correct) {
                        questionsReview += `   **Correcta:** ${result.correctAnswer}\n`;
                    }
                    questionsReview += '\n';
                });

                const hintsUsedd = this.config.trivia.hintsPerGame - hintsRemaining;
                const modeText = isTrueFalse ? 'Verdadero/Falso' : 'Opción Múltiple';
                
                const resultEmbed = new EmbedBuilder()
                    .setTitle('🎯 ¡Trivia Completada!')
                    .setDescription(
                        `Respondiste **${correctAnswers}/${questions.length}** preguntas correctamente\n` +
                        `${hintsUsedd > 0 ? `💡 Pistas usadas: ${hintsUsedd} (Recompensa -60%)\n` : ''}`
                    )
                    .addFields(
                        { name: '💰 Dinero ganado', value: `${finalMoney} π-b$`, inline: true },
                        { name: '⭐ XP ganada', value: `${finalXP} XP`, inline: true },
                        { name: '📊 Dificultad', value: difficulty.toUpperCase(), inline: true },
                        { name: '🎮 Modo', value: modeText, inline: true },
                        { name: '📚 Categoría', value: categoryName, inline: true }
                    )
                    .setColor(correctAnswers >= 3 ? '#00FF00' : '#FF0000')
                    .setFooter({ text: 'Usa >trivia [easy/medium/hard] [multiple/tof] para jugar de nuevo' });

                const activeItemsList = [];
                if (triviaExtraTime > 0) activeItemsList.push(`⏳ +${triviaExtraTime/1000}s por pregunta`);
                if (triviaDoubleReward) activeItemsList.push('💰 Recompensa x2');
                if (triviaWrongShield && effectiveCorrect > correctAnswers) activeItemsList.push('🛡️ Escudo absorbió 1 fallo');

                if (activeItemsList.length > 0) {
                    resultEmbed.addFields({
                        name: '🎒 Items activos usados',
                        value: activeItemsList.join('\n'),
                        inline: false
                    });
                }

                // Si el resumen es muy largo, dividirlo en múltiples embeds
                if (questionsReview.length > 1024) {
                    // Dividir en chunks de ~900 caracteres
                    const chunks = [];
                    let currentChunk = '';
                    const lines = questionsReview.split('\n\n');
                    
                    for (const line of lines) {
                        if ((currentChunk + line).length > 900) {
                            chunks.push(currentChunk);
                            currentChunk = line + '\n\n';
                        } else {
                            currentChunk += line + '\n\n';
                        }
                    }
                    if (currentChunk) chunks.push(currentChunk);
                    
                    // Primer embed con stats
                    await message.channel.send({ embeds: [resultEmbed] });
                    
                    // Embeds adicionales con preguntas
                    for (let i = 0; i < chunks.length; i++) {
                        const reviewEmbed = new EmbedBuilder()
                            .setTitle(`📝 Resumen de Preguntas (${i + 1}/${chunks.length})`)
                            .setDescription(chunks[i])
                            .setColor('#9932CC');
                        await message.channel.send({ embeds: [reviewEmbed] });
                    }
                } else {
                    resultEmbed.addFields({
                        name: '📝 Resumen de Preguntas',
                        value: questionsReview,
                        inline: false
                    });

                    // Verificar tesoros al final
                    await this.checkTreasureHunt(userId, message);

                    const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
                    const curse = activeEffects['death_hand_curse'];
                    // Al final, después de crear el embed de resultado
                    if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
                        resultEmbed.addFields({
                            name: '☠️ Maldición Activa',
                            value: `Tu ganancia fue reducida por la maldición (-25% dinero)`,
                            inline: false
                        });
                    }

                    await message.channel.send({ embeds: [resultEmbed] });
                }
            };

            // Iniciar el juego
            await showQuestion();

        } catch (error) {
            this.activeGames.delete(`trivia_${userId}`);
            console.error('Error en trivia:', error);
            await message.reply('❌ Ocurrió un error al cargar la trivia. Intenta de nuevo.');
        }
    }

    async canTriviaSurvival(userId) {
        const user = await this.economy.getUser(userId);

        if (this.shop) {
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'games');
            if (vipMultipliers.noCooldown) {
                return { canPlay: true };
            }
        }

        const cacheKey = `${userId}-trivia_survival`;
        const cachedCooldown = this.cooldownCache.get(cacheKey);
        const now = Date.now();
        
        let effectiveCooldown = await this.getEffectiveCooldown(this.config.trivia.survival.cooldown, null);

        if (this.shop) {
            const cooldownReduction = await this.shop.getCooldownReduction(userId, 'games');
            effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
        }
        
        if (cachedCooldown && (now - cachedCooldown < effectiveCooldown)) {
            const timeLeft = effectiveCooldown - (now - cachedCooldown);
            return { canPlay: false, timeLeft };
        }

        const lastPlay = user.last_trivia_survival || 0;
        if (now - lastPlay < effectiveCooldown) {
            const timeLeft = effectiveCooldown - (now - lastPlay);
            return { canPlay: false, timeLeft };
        }

        return { canPlay: true };
    }

    async playTriviaSurvival(message, args) {
        const userId = message.author.id;
        
        // Mostrar ayuda si piden
        if (!args[1] || args[1] !== 'start') {
            const embed = new EmbedBuilder()
                .setTitle('💀 Trivia Survival — Modo Supervivencia')
                .setDescription('> Responde preguntas seguidas sin parar. Un fallo y **terminó todo**. La dificultad sube cada 5 correctas.')
                .addFields(
                    { name: '📝 Uso', value: '`>triviasurvival start` — Iniciar', inline: false },
                    {
                        name: '📈 Sistema de Dificultad',
                        value: '**Nivel 1** (1-5): 100 π-b$ + 10 XP / pregunta\n**Nivel 2** (6-10): 150 π-b$ + 15 XP / pregunta\n**Nivel 3** (11-15): 225 π-b$ + 22 XP / pregunta\n**Nivel 4+**: sigue subiendo x1.5',
                        inline: false
                    },
                    { name: '⏱️ Tiempo', value: '**15s** por pregunta', inline: true },
                    { name: '⏰ Cooldown', value: '**5 minutos**', inline: true },
                    { name: '🚫 Pistas', value: 'No disponibles', inline: true },
                    { name: '🏆 Objetivo', value: 'Sobrevivir la mayor cantidad de preguntas posible y batir el récord del servidor', inline: false }
                )
                .setColor('#FF4500')
                .setFooter({ text: '¡Compite por el récord más alto!' });
            return message.reply({ embeds: [embed] });
        }
        
        const canTrivia = await this.canTriviaSurvival(userId);
        if (!canTrivia.canPlay) {
            await message.reply(`⏰ Debes esperar ${this.formatTime(canTrivia.timeLeft)} antes de jugar otra vez`);
            return;
        }

        // Verificar si ya está en un juego
        if (this.activeGames.has(`trivia_survival_${userId}`)) {
            return message.reply('❌ Ya estás en una partida de supervivencia.');
        }

        // Probabilidad 3% de recibir maldición aleatoria
        if (Math.random() < 0.03) {
            await this.economy.shop.applyRandomCurse(message.author.id);
            
            const curseNotif = new EmbedBuilder()
                .setTitle('☠️ ¡MALDICIÓN!')
                .setDescription('**La Mano del Muerto** apareció de la nada y te maldijo por 30 minutos.')
                .setColor('#8B0000');
            
            await message.reply({ embeds: [curseNotif] });
        }

        try {
            // Marcar como activo
            this.activeGames.set(`trivia_survival_${userId}`, true);

            // Variables del juego
            const categoryName = 'Mixto';
            let correctStreak = 0;
            let totalCorrect = 0;
            let totalEarned = 0;
            let totalXP = 0;
            let currentDifficulty = 'easy';
            let currentLevel = 1;
            let askedQuestions = new Set();

            // Mensaje inicial
            const startEmbed = new EmbedBuilder()
                .setTitle('🏃 ¡Modo Supervivencia Iniciado!')
                .setDescription(
                    `**Categoría:** ${categoryName}\n` +
                    `**Dificultad Inicial:** Easy\n` +
                    `**Tiempo por pregunta:** 15 segundos\n\n` +
                    `¡Responde correctamente para seguir adelante!`
                )
                .setColor('#FF4500')
                .setFooter({ text: 'El juego comenzará en 3 segundos...' });

            let gameMessage = await message.reply({ embeds: [startEmbed] });
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Función para obtener siguiente pregunta
            const getNextQuestion = async () => {
                // Determinar dificultad según racha
                if (correctStreak >= 10) {
                    currentDifficulty = 'hard';
                    currentLevel = 3;
                } else if (correctStreak >= 5) {
                    currentDifficulty = 'medium';
                    currentLevel = 2;
                } else {
                    currentDifficulty = 'easy';
                    currentLevel = 1;
                }

                let q = null;
                let attempts = 0;
                const maxAttempts = 10;
                let apiAttempts = 0;
                const maxApiAttempts = 3; // Reintentar hasta 3 veces si falla la API

                // Intentar obtener pregunta no repetida
                while (attempts < maxAttempts && apiAttempts < maxApiAttempts) {
                    try {
                        // Obtener pregunta de la API (pedir 5 para tener opciones)
                        const apiUrl = `https://opentdb.com/api.php?amount=5&difficulty=${currentDifficulty}&type=multiple`;
                        
                        // Agregar timeout de 15 segundos
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 15000);
                        
                        const response = await fetch(apiUrl, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        
                        const data = await response.json();

                        if (data.response_code !== 0 || !data.results || data.results.length === 0) {
                            throw new Error('No se pudo obtener pregunta');
                        }

                        // Buscar una pregunta que no se haya usado
                        for (const question of data.results) {
                            if (!askedQuestions.has(question.question)) {
                                q = question;
                                askedQuestions.add(question.question);
                                console.log(`✅ Pregunta única #${totalCorrect + 1} (${askedQuestions.size} preguntas usadas)`);
                                break;
                            }
                        }

                        if (q) break; // Si encontró una pregunta única, salir del loop
                        
                        attempts++;
                        console.log(`⚠️ Todas las preguntas ya fueron usadas, intento ${attempts}/${maxAttempts}`);
                        
                    } catch (error) {
                        apiAttempts++;
                        console.error(`❌ Error obteniendo preguntas (intento ${apiAttempts}/${maxApiAttempts}):`, error.message);
                        
                        if (apiAttempts >= maxApiAttempts) {
                            throw new Error('No se pudo conectar con la API de trivia después de varios intentos');
                        }
                        
                        // Esperar 2 segundos antes de reintentar
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                // Si después de intentar no encuentra pregunta única, usar cualquiera
                if (!q) {
                    console.log('⚠️ No se encontró pregunta única, permitiendo repetición');
                    
                    try {
                        const apiUrl = `https://opentdb.com/api.php?amount=1&difficulty=${currentDifficulty}&type=multiple`;
                        
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 15000);
                        
                        const response = await fetch(apiUrl, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        
                        const data = await response.json();
                        
                        if (data.response_code !== 0 || !data.results || data.results.length === 0) {
                            throw new Error('No se pudo obtener pregunta');
                        }
                        
                        q = data.results[0];
                        
                    } catch (error) {
                        console.error('❌ Error crítico obteniendo pregunta:', error);
                        throw new Error('No se pudo obtener pregunta de la API');
                    }
                }

                // Decodificar y traducir
                const decodedQuestion = this.decodeHTML(q.question);
                const decodedCorrect = this.decodeHTML(q.correct_answer);
                const decodedIncorrect = q.incorrect_answers.map(ans => this.decodeHTML(ans));
                const allAnswersOriginal = [decodedCorrect, ...decodedIncorrect];

                // Traducir con contexto
                const contextTranslation = await this.translateTriviaQuestion(
                    decodedQuestion,
                    allAnswersOriginal,
                    decodedCorrect
                );

                let translatedQuestion, translatedCorrect, allAnswers;

                if (contextTranslation) {
                    translatedQuestion = contextTranslation.question;
                    translatedCorrect = contextTranslation.answers[allAnswersOriginal.indexOf(decodedCorrect)];
                    allAnswers = contextTranslation.answers.sort(() => Math.random() - 0.5);
                } else {
                    translatedQuestion = await this.translateText(decodedQuestion);
                    translatedCorrect = await this.translateText(decodedCorrect);
                    const translatedIncorrect = await Promise.all(
                        decodedIncorrect.map(ans => this.translateText(ans))
                    );
                    allAnswers = [translatedCorrect, ...translatedIncorrect].sort(() => Math.random() - 0.5);
                }

                return {
                    question: translatedQuestion,
                    correct: translatedCorrect,
                    answers: allAnswers,
                    category: await this.translateText(this.decodeHTML(q.category))
                };
            };

            // Función para mostrar pregunta
            const showQuestion = async () => {
                const question = await getNextQuestion();
                const letters = ['A', 'B', 'C', 'D'];

                // Calcular recompensa actual
                const multiplier = Math.pow(this.config.trivia.survival.multiplierPerLevel, currentLevel - 1);
                const currentReward = Math.floor(this.config.trivia.survival.baseReward * multiplier);
                const currentXPReward = Math.floor(this.config.trivia.survival.baseXP * multiplier);

                // Crear texto de opciones
                let optionsText = '';
                question.answers.forEach((answer, index) => {
                    const truncatedAnswer = answer.length > 100 ? answer.substring(0, 97) + '...' : answer;
                    optionsText += `**${letters[index]})**  ${truncatedAnswer}\n`;
                });

                const questionEmbed = new EmbedBuilder()
                    .setTitle(`🏃 Supervivencia - Pregunta #${totalCorrect + 1}`)
                    .setDescription(`<@${userId}>, responde esta pregunta:\n\n**${question.question}**`)
                    .addFields(
                        { name: '📝 Opciones', value: optionsText, inline: false },
                        { name: '📊 Nivel', value: `${currentLevel} (${currentDifficulty.toUpperCase()})`, inline: true },
                        { name: '🔥 Racha', value: `${correctStreak}`, inline: true },
                        { name: '💰 Próxima recompensa', value: `${currentReward} π-b$ + ${currentXPReward} XP`, inline: true }
                    )
                    .setColor('#FF4500')
                    .setFooter({ text: `⏱️ Tienes 15 segundos | 💎 Total ganado: ${totalEarned} π-b$` });

                const buttons = new ActionRowBuilder();
                letters.forEach((letter, index) => {
                    buttons.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`survival_${index}`)
                            .setLabel(letter)
                            .setStyle(ButtonStyle.Primary)
                    );
                });

                await gameMessage.edit({ embeds: [questionEmbed], components: [buttons] });

                // Esperar respuesta con flag de control
                let gameEnded = false;
                
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => resolve('timeout'), this.config.trivia.survival.timePerQuestion);
                });

                const collectorPromise = gameMessage.awaitMessageComponent({ 
                    filter: (i) => i.user.id === userId && i.customId.startsWith('survival_'),
                    time: this.config.trivia.survival.timePerQuestion + 2000 
                }).catch(() => null);

                const result = await Promise.race([timeoutPromise, collectorPromise]);

                if (gameEnded) return; // Si ya terminó, no hacer nada

                if (result === 'timeout' || !result) {
                    // ⏰ Timeout - Fin del juego
                    gameEnded = true;
                    await endGame(null, question, null, true);
                    return;
                }

                // Usuario respondió
                const interaction = result;
                const answerIndex = parseInt(interaction.customId.split('_')[1]);
                const selectedAnswer = question.answers[answerIndex];
                const isCorrect = selectedAnswer === question.correct;

                if (isCorrect) {
                    // ✅ Correcto - Continuar
                    correctStreak++;
                    totalCorrect++;
                    totalEarned += currentReward;
                    totalXP += currentXPReward;

                    const correctEmbed = new EmbedBuilder()
                        .setTitle('✅ ¡Correcto!')
                        .setDescription(
                            `**Pregunta:** ${question.question}\n\n` +
                            `✅ **Respuesta:** ${selectedAnswer}\n\n` +
                            `+${currentReward} π-b$ | +${currentXPReward} XP`
                        )
                        .setColor('#00FF00');

                    await interaction.update({ embeds: [correctEmbed], components: [] });
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    if (gameEnded) return; // Verificar de nuevo antes de continuar

                    // Siguiente pregunta
                    await showQuestion();

                } else {
                    // ❌ Incorrecto - Fin del juego
                    gameEnded = true;
                    await endGame(interaction, question, selectedAnswer, false);
                }
            };

            // Función para terminar el juego
            const endGame = async (interaction, question, userAnswer, timeout) => {
                this.activeGames.delete(`trivia_survival_${userId}`);

                const wrongEmbed = new EmbedBuilder()
                    .setTitle(timeout ? '⏰ ¡Se acabó el tiempo!' : '❌ Respuesta Incorrecta')
                    .setDescription(
                        `**Pregunta final:** ${question.question}\n\n` +
                        (timeout ? `❌ **No respondiste a tiempo**\n` : `❌ **Tu respuesta:** ${userAnswer}\n`) +
                        `✅ **Respuesta correcta:** ${question.correct}`
                    )
                    .setColor('#FF0000');

                if (interaction) {
                    await interaction.update({ embeds: [wrongEmbed], components: [] });
                } else {
                    await gameMessage.edit({ embeds: [wrongEmbed], components: [] });
                }

                await new Promise(resolve => setTimeout(resolve, 5000));

                // Borrar el mensaje de la pregunta
                try {
                    await gameMessage.delete();
                } catch (error) {
                    console.log('No se pudo borrar mensaje:', error.message);
                }
               
                // Actualizar stats
                const user = await this.economy.getUser(userId);
                const currentRecord = user.stats?.trivia_survival_record || 0;
                const newRecord = Math.max(currentRecord, totalCorrect);

                const updateDataSurvival = {
                    stats: {
                        ...user.stats,
                        trivia_survival_record: newRecord,
                        trivia_survival_played: (user.stats?.trivia_survival_played || 0) + 1
                    }
                };

                // ✅ Aplicar penalización de maldición (-25% dinero)
                const activeEffectss = this.shop.parseActiveEffects(user.activeEffects);
                const curses = activeEffectss['death_hand_curse'];
                let curseMoneyPenalty = 0;

                if (curses && curses.length > 0 && curses[0].expiresAt > Date.now()) {
                    const penaltyAmount = Math.floor(totalEarned * Math.abs(curses[0].moneyPenalty)); // 0.25 = 25%
                    curseMoneyPenalty = penaltyAmount;
                    totalEarned -= penaltyAmount;
                }

                // Otorgar recompensas acumuladas
                await this.economy.addMoney(userId, totalEarned);
                await this.economy.addXp(userId, totalXP);
                await this.economy.updateUser(userId, updateDataSurvival);

                const resultEmbed = new EmbedBuilder()
                    .setTitle('🏁 ¡Supervivencia Terminada!')
                    .setDescription(
                        `Sobreviviste **${totalCorrect}** preguntas correctas\n` +
                        (newRecord > currentRecord ? `\n🎉 **¡NUEVO RÉCORD PERSONAL!**\n` : '') +
                        `\n💀 **Fallaste en:** ${question.question.substring(0, 100)}${question.question.length > 100 ? '...' : ''}` +
                        `\n✅ **Respuesta correcta:** ${question.correct}`
                    )
                    .addFields(
                        { name: '💰 Total ganado', value: `${totalEarned} π-b$`, inline: true },
                        { name: '⭐ XP ganada', value: `${totalXP} XP`, inline: true },
                        { name: '🏆 Tu récord', value: `${newRecord} preguntas`, inline: true },
                        { name: '📊 Dificultad alcanzada', value: currentDifficulty.toUpperCase(), inline: true },
                        { name: '📚 Categoría', value: categoryName, inline: true }
                    )
                    .setColor(totalCorrect >= 10 ? '#FFD700' : '#FF4500')
                    .setFooter({ text: 'Usa >triviasurv para jugar de nuevo' });

                    // Verificar tesoros al final
                    await this.checkTreasureHunt(userId, message);

                    const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
                    const curse = activeEffects['death_hand_curse'];
                    // Al final, después de crear el embed de resultado
                    if (curse && curse.length > 0 && curse[0].expiresAt > Date.now()) {
                        resultEmbed.addFields({
                            name: '☠️ Maldición Activa',
                            value: `Tu ganancia fue reducida por la maldición (-25% dinero)`,
                            inline: false
                        });
                    }

                await message.channel.send({ embeds: [resultEmbed] });
            };

            // Iniciar el juego
            await showQuestion();

        } catch (error) {
            this.activeGames.delete(`trivia_survival_${userId}`);
            console.error('Error en supervivencia:', error);
            await message.reply('❌ Ocurrió un error en el modo supervivencia. Intenta de nuevo.');
        }
    }

    // ===== MODO COMPETITIVO =====

    async handleTriviaCompetitive(message, args) {
        const userId = message.author.id;
        const channelId = message.channel.id;
        
        // Verificar si ya hay una partida en este canal
        if (this.activeGames.has(`trivia_comp_${channelId}`)) {
            return message.reply('❌ Ya hay una partida competitiva en este canal. Usa `>jt` para unirte.');
        }
        
        // Mostrar ayuda
        if (!args[1] || args[1] === 'help' || args[1] === 'info') {
            const embed = new EmbedBuilder()
                .setTitle('⚔️ Trivia Competitiva — Multijugador')
                .setDescription('> Todos reciben las **mismas preguntas**. El que más puntos acumule gana el pot.')
                .addFields(
                    {
                        name: '📝 Comandos',
                        value: '`>triviacomp <apuesta>` — Crear partida\n`>jointrivia` — Unirse a partida activa\n`>starttrivia` — Iniciar (solo creador)\n`>canceltrivia` — Cancelar (solo creador)',
                        inline: false
                    },
                    {
                        name: '📊 Sistema de Puntos',
                        value: '**Respuesta correcta:** 100 pts base\n**Bonus velocidad:** hasta +50 pts\n⚡ Responder más rápido = más puntos',
                        inline: false
                    },
                    { name: '👥 Jugadores', value: '**Mín:** 2 · **Máx:** 6', inline: true },
                    { name: '❓ Preguntas', value: '**5** por partida — **15s** cada una', inline: true },
                    { name: '⏳ Espera', value: '**45s** para unirse', inline: true },
                    { name: '💰 Apuesta', value: '**0 – 5,000** π-b$ (0 = gratis)', inline: true },
                    { name: '🏆 Premio', value: '**85%** del pot al ganador', inline: true },
                    { name: '⏱️ Cooldown', value: '**3 minutos**', inline: true }
                )
                .setColor('#FF6B35')
                .setFooter({ text: '¡Demuestra quién sabe más y quién responde más rápido!' });
            return message.reply({ embeds: [embed] });
        }
        
        // Validar apuesta
        let betAmount = 0;
        if (args[1]) {
            betAmount = parseInt(args[1]);
            
            if (isNaN(betAmount) || betAmount < this.config.trivia.competitive.minBet || betAmount > this.config.trivia.competitive.maxBet) {
                return message.reply(`❌ La apuesta debe ser entre ${this.config.trivia.competitive.minBet} y ${this.formatNumber(this.config.trivia.competitive.maxBet)} π-b$`);
            }
            
            // Verificar fondos del creador
            const user = await this.economy.getUser(userId);
            if (user.balance < betAmount) {
                return message.reply(`❌ No tienes suficiente dinero. Tu balance: ${this.formatNumber(user.balance)} π-b$`);
            }
        }
        
        // Crear partida
        const game = {
            channelId,
            creatorId: userId,
            betAmount,
            players: [{ id: userId, username: message.author.username, points: 0, bet: betAmount }],
            phase: 'waiting',
            createdAt: Date.now()
        };
        
        this.activeGames.set(`trivia_comp_${channelId}`, game);
        
        // Descontar apuesta del creador
        if (betAmount > 0) {
            await this.economy.removeMoney(userId, betAmount);
        }
        
        const embed = new EmbedBuilder()
            .setTitle('⚔️ Partida Competitiva Creada')
            .setDescription(
                `**Creador:** <@${userId}>\n` +
                `**Apuesta:** ${betAmount > 0 ? `${this.formatNumber(betAmount)} π-b$` : 'Gratis'}\n` +
                `**Jugadores:** 1/${this.config.trivia.competitive.maxPlayers}\n\n` +
                `Usa \`>jt\` para unirte\n` +
                `El creador debe usar \`>st\` para iniciar`
            )
            .setColor('#FF6B35')
            .setFooter({ text: 'La partida se cancelará automáticamente en 3 minutos si no inicia' });
        
        await message.reply({ embeds: [embed] });
        
        // Auto-cancelar después de 3 minutos
        setTimeout(async () => {
            const currentGame = this.activeGames.get(`trivia_comp_${channelId}`);
            if (currentGame && currentGame.phase === 'waiting') {
                await this.cancelTriviaCompetitive(message, true);
            }
        }, 180000);
    }

    async joinTriviaCompetitive(message) {
        const userId = message.author.id;
        const channelId = message.channel.id;
        const game = this.activeGames.get(`trivia_comp_${channelId}`);
        
        if (!game) {
            return message.reply('❌ No hay ninguna partida competitiva en este canal.');
        }
        
        if (game.phase !== 'waiting') {
            return message.reply('❌ Esta partida ya comenzó.');
        }
        
        // Verificar si ya está en la partida
        if (game.players.find(p => p.id === userId)) {
            return message.reply('❌ Ya estás en esta partida.');
        }
        
        // Verificar límite de jugadores
        if (game.players.length >= this.config.trivia.competitive.maxPlayers) {
            return message.reply('❌ La partida está llena.');
        }
        
        // Verificar fondos
        if (game.betAmount > 0) {
            const user = await this.economy.getUser(userId);
            if (user.balance < game.betAmount) {
                return message.reply(`❌ No tienes suficiente dinero. Necesitas ${this.formatNumber(game.betAmount)} π-b$`);
            }
            
            // Descontar apuesta
            await this.economy.removeMoney(userId, game.betAmount);
        }
        
        // Agregar jugador
        game.players.push({
            id: userId,
            username: message.author.username,
            points: 0,
            bet: game.betAmount
        });
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Te uniste a la partida')
            .setDescription(
                `**Jugadores:** ${game.players.length}/${this.config.trivia.competitive.maxPlayers}\n\n` +
                game.players.map(p => `• <@${p.id}>`).join('\n')
            )
            .setColor('#00FF00');
        
        await message.reply({ embeds: [embed] });
    }

    async startTriviaCompetitive(message) {
        const userId = message.author.id;
        const channelId = message.channel.id;
        const game = this.activeGames.get(`trivia_comp_${channelId}`);
        
        if (!game) {
            return message.reply('❌ No hay ninguna partida competitiva en este canal.');
        }
        
        if (game.creatorId !== userId) {
            return message.reply('❌ Solo el creador puede iniciar la partida.');
        }
        
        if (game.phase !== 'waiting') {
            return message.reply('❌ Esta partida ya comenzó.');
        }
        
        if (game.players.length < this.config.trivia.competitive.minPlayers) {
            return message.reply(`❌ Se necesitan al menos ${this.config.trivia.competitive.minPlayers} jugadores para iniciar.`);
        }
        
        game.phase = 'starting';
        
        await message.reply('🎮 Iniciando partida competitiva en 3 segundos...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        await this.runTriviaCompetitive(message, game);
    }

    async cancelTriviaCompetitive(message, auto = false) {
        const userId = message.author.id;
        const channelId = message.channel.id;
        const game = this.activeGames.get(`trivia_comp_${channelId}`);
        
        if (!game) {
            return message.reply('❌ No hay ninguna partida competitiva en este canal.');
        }
        
        if (!auto && game.creatorId !== userId) {
            return message.reply('❌ Solo el creador puede cancelar la partida.');
        }
        
        if (game.phase !== 'waiting') {
            return message.reply('❌ No se puede cancelar una partida en progreso.');
        }
        
        // Devolver apuestas
        for (const player of game.players) {
            if (player.bet > 0) {
                await this.economy.addMoney(player.id, player.bet);
            }
        }
        
        this.activeGames.delete(`trivia_comp_${channelId}`);
        
        await message.channel.send(auto ? '⏰ Partida cancelada automáticamente por inactividad. Apuestas devueltas.' : '❌ Partida cancelada. Apuestas devueltas.');
    }

    async runTriviaCompetitive(message, game) {
        const channelId = message.channel.id;
        
        try {
            game.phase = 'playing';
            
            // Obtener 5 preguntas
            const apiUrl = `https://opentdb.com/api.php?amount=${this.config.trivia.competitive.questionsPerGame}&difficulty=medium&type=multiple`;
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            if (data.response_code !== 0 || !data.results || data.results.length === 0) {
                await message.channel.send('❌ Error obteniendo preguntas. Apuestas devueltas.');
                await this.cancelTriviaCompetitive(message, true);
                return;
            }
            
            // Traducir preguntas
            const questions = await Promise.all(data.results.map(async (q, index) => {
                if (index > 0) await new Promise(resolve => setTimeout(resolve, 1000));
                
                const decodedQuestion = this.decodeHTML(q.question);
                const decodedCorrect = this.decodeHTML(q.correct_answer);
                const decodedIncorrect = q.incorrect_answers.map(ans => this.decodeHTML(ans));
                const allAnswersOriginal = [decodedCorrect, ...decodedIncorrect];
                
                const contextTranslation = await this.translateTriviaQuestion(
                    decodedQuestion,
                    allAnswersOriginal,
                    decodedCorrect
                );
                
                if (contextTranslation) {
                    const translatedCorrect = contextTranslation.answers[allAnswersOriginal.indexOf(decodedCorrect)];
                    return {
                        question: contextTranslation.question,
                        correct: translatedCorrect,
                        answers: contextTranslation.answers.sort(() => Math.random() - 0.5)
                    };
                } else {
                    const translatedQuestion = await this.translateText(decodedQuestion);
                    const translatedCorrect = await this.translateText(decodedCorrect);
                    const translatedIncorrect = await Promise.all(
                        decodedIncorrect.map(ans => this.translateText(ans))
                    );
                    return {
                        question: translatedQuestion,
                        correct: translatedCorrect,
                        answers: [translatedCorrect, ...translatedIncorrect].sort(() => Math.random() - 0.5)
                    };
                }
            }));
            
            // Jugar cada pregunta
            for (let i = 0; i < questions.length; i++) {
                await this.showCompetitiveQuestion(message, game, questions[i], i + 1);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            // Terminar juego
            await this.endCompetitiveGame(message, game);
            
        } catch (error) {
            console.error('Error en trivia competitiva:', error);
            await message.channel.send('❌ Error en la partida. Apuestas devueltas.');
            await this.cancelTriviaCompetitive(message, true);
        }
    }

    async showCompetitiveQuestion(message, game, question, questionNum) {
        const letters = ['A', 'B', 'C', 'D'];
        
        let optionsText = '';
        question.answers.forEach((answer, index) => {
            const truncatedAnswer = answer.length > 100 ? answer.substring(0, 97) + '...' : answer;
            optionsText += `**${letters[index]})**  ${truncatedAnswer}\n`;
        });
        
        const embed = new EmbedBuilder()
            .setTitle(`⚔️ Pregunta ${questionNum}/${this.config.trivia.competitive.questionsPerGame}`)
            .setDescription(`**${question.question}**`)
            .addFields(
                { name: '📝 Opciones', value: optionsText, inline: false },
                { name: '👥 Jugadores', value: game.players.map(p => `<@${p.id}>`).join(', '), inline: false }
            )
            .setColor('#FF6B35')
            .setFooter({ text: '⏱️ Tienes 15 segundos para responder' });
        
        const buttons = new ActionRowBuilder();
        letters.forEach((letter, index) => {
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`comp_${index}`)
                    .setLabel(letter)
                    .setStyle(ButtonStyle.Primary)
            );
        });
        
        const questionMessage = await message.channel.send({ embeds: [embed], components: [buttons] });
        
        const startTime = Date.now();
        const responses = new Map(); // userId -> { answer, time }
        
        let collectorEnded = false;
        
        const collector = questionMessage.createMessageComponentCollector({
            time: this.config.trivia.competitive.timePerQuestion
        });
        
        // Función para actualizar el embed mostrando quién respondió
        const updateQuestionEmbed = async () => {
            let playersStatus = '';
            game.players.forEach(p => {
                const hasResponded = responses.has(p.id);
                const emoji = hasResponded ? '✅' : '⏳';
                playersStatus += `${emoji} <@${p.id}>\n`;
            });
            
            const updatedEmbed = new EmbedBuilder()
                .setTitle(`⚔️ Pregunta ${questionNum}/${this.config.trivia.competitive.questionsPerGame}`)
                .setDescription(`**${question.question}**`)
                .addFields(
                    { name: '📝 Opciones', value: optionsText, inline: false },
                    { name: '👥 Estado de Jugadores', value: playersStatus, inline: false }
                )
                .setColor('#FF6B35')
                .setFooter({ text: `⏱️ ${responses.size}/${game.players.length} respondieron` });
            
            try {
                await questionMessage.edit({ embeds: [updatedEmbed], components: buttons.components });
            } catch (error) {
                // Ignorar si el mensaje ya fue editado
            }
        };
        
        collector.on('collect', async (interaction) => {
            // Solo jugadores de la partida pueden responder
            if (!game.players.find(p => p.id === interaction.user.id)) {
                await interaction.reply({ content: '❌ No estás en esta partida', ephemeral: true });
                return;
            }
            
            // Solo una respuesta por jugador
            if (responses.has(interaction.user.id)) {
                await interaction.reply({ content: '⚠️ Ya respondiste esta pregunta', ephemeral: true });
                return;
            }
            
            const answerIndex = parseInt(interaction.customId.split('_')[1]);
            const responseTime = Date.now() - startTime;
            
            responses.set(interaction.user.id, {
                answer: question.answers[answerIndex],
                answerIndex: answerIndex,
                time: responseTime
            });
            
            await interaction.reply({ content: '✅ Respuesta registrada', ephemeral: true });
            
            // Actualizar embed mostrando quién respondió
            await updateQuestionEmbed();
            
            // Si todos respondieron, terminar inmediatamente
            if (responses.size === game.players.length && !collectorEnded) {
                collectorEnded = true;
                collector.stop('all_answered');
            }
        });
        
        // Esperar hasta timeout o que todos respondan
        await new Promise(resolve => {
            const timeout = setTimeout(() => {
                if (!collectorEnded) {
                    collectorEnded = true;
                    resolve();
                }
            }, this.config.trivia.competitive.timePerQuestion);
            
            collector.on('end', (collected, reason) => {
                clearTimeout(timeout);
                if (!collectorEnded) {
                    collectorEnded = true;
                }
                resolve();
            });
        });
        
        if (!collectorEnded) {
            collector.stop();
        }
        
        // Calcular puntos
        for (const player of game.players) {
            const response = responses.get(player.id);
            
            if (response && response.answer === question.correct) {
                // Puntos base por respuesta correcta
                let points = 100;
                
                // Bonus por velocidad (más rápido = más puntos)
                const speedBonus = Math.floor(
                    this.config.trivia.competitive.speedBonusMax * 
                    (1 - (response.time / this.config.trivia.competitive.timePerQuestion))
                );
                
                points += Math.max(0, speedBonus);
                player.points += points;
                
                // Guardar para historial
                if (!player.history) player.history = [];
                player.history.push({
                    question: question.question.substring(0, 100),
                    userAnswer: response.answer,
                    correct: true
                });
            } else {
                // Guardar para historial (respuesta incorrecta o sin respuesta)
                if (!player.history) player.history = [];
                player.history.push({
                    question: question.question.substring(0, 100),
                    userAnswer: response ? response.answer : 'Sin respuesta',
                    correctAnswer: question.correct,
                    correct: false
                });
            }
        }
        
        // Mostrar resultados de la pregunta con respuestas elegidas
        let resultsText = '';
        const sortedPlayers = [...game.players].sort((a, b) => b.points - a.points);
        
        sortedPlayers.forEach((player, index) => {
            const response = responses.get(player.id);
            const letters = ['A', 'B', 'C', 'D'];
            
            if (response && response.answer === question.correct) {
                // Correcto
                const speedBonus = Math.floor(
                    this.config.trivia.competitive.speedBonusMax * 
                    (1 - (response.time / this.config.trivia.competitive.timePerQuestion))
                );
                resultsText += `${index + 1}. ✅ <@${player.id}>\n` +
                            `   **${letters[response.answerIndex]})** ${response.answer}\n` +
                            `   ${player.points} pts (+${100 + Math.max(0, speedBonus)})\n\n`;
            } else if (response) {
                // Incorrecto
                resultsText += `${index + 1}. ❌ <@${player.id}>\n` +
                            `   **${letters[response.answerIndex]})** ${response.answer}\n` +
                            `   ${player.points} pts\n\n`;
            } else {
                // Sin respuesta
                resultsText += `${index + 1}. ⏰ <@${player.id}>\n` +
                            `   Sin respuesta\n` +
                            `   ${player.points} pts\n\n`;
            }
        });
        
        const resultEmbed = new EmbedBuilder()
            .setTitle(`📊 Resultados - Pregunta ${questionNum}`)
            .setDescription(`✅ **Respuesta correcta:** ${question.correct}\n\n${resultsText}`)
            .setColor('#9932CC');
        
        await questionMessage.edit({ embeds: [resultEmbed], components: [] });
        
        // Esperar 5 segundos y luego borrar
        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
            await questionMessage.delete();
        } catch (error) {
            console.log('No se pudo borrar mensaje:', error.message);
        }
    }

    async endCompetitiveGame(message, game) {
        const channelId = message.channel.id;
        
        // Ordenar jugadores por puntos
        const sortedPlayers = [...game.players].sort((a, b) => b.points - a.points);
        const winner = sortedPlayers[0];
        
        // Calcular premio
        const totalPot = game.players.reduce((sum, p) => sum + p.bet, 0);
        const winnerPrize = Math.floor(totalPot * this.config.trivia.competitive.winnerMultiplier);
        
        // Dar premio al ganador
        if (winnerPrize > 0) {
            await this.economy.addMoney(winner.id, winnerPrize);
        }
        
        // Crear tabla de resultados
        let resultsText = '';
        sortedPlayers.forEach((player, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            resultsText += `${medal} <@${player.id}> - **${player.points} puntos**\n`;
        });
        
        const embed = new EmbedBuilder()
            .setTitle('🏆 ¡Partida Terminada!')
            .setDescription(
                `**🥇 Ganador:** <@${winner.id}>\n` +
                `**💎 Puntos:** ${winner.points}\n` +
                (winnerPrize > 0 ? `**💰 Premio:** ${this.formatNumber(winnerPrize)} π-b$\n\n` : '\n') +
                `**📊 Clasificación Final:**\n${resultsText}`
            )
            .setColor('#FFD700')
            .setFooter({ text: 'Usa >triviac para crear otra partida' });
        
        await message.channel.send({ embeds: [embed] });
        
        // Mostrar historial de cada jugador (si tienen historial)
        for (const player of sortedPlayers) {
            if (player.history && player.history.length > 0) {
                let historyText = '';
                
                player.history.forEach((q, index) => {
                    const emoji = q.correct ? '✅' : '❌';
                    historyText += `${emoji} **${index + 1}.** ${q.question}\n`;
                    historyText += `   Tu respuesta: ${q.userAnswer}\n`;
                    if (!q.correct) {
                        historyText += `   Correcta: ${q.correctAnswer}\n`;
                    }
                    historyText += '\n';
                });
                
                const historyEmbed = new EmbedBuilder()
                    .setTitle(`📝 Historial de <@${player.id}>`)
                    .setDescription(historyText)
                    .setColor('#9932CC')
                    .setFooter({ text: `Puntos totales: ${player.points}` });
                
                await message.channel.send({ embeds: [historyEmbed] });
            }
        }
        
        // Limpiar juego
        this.activeGames.delete(`trivia_comp_${channelId}`);
    }

    async handleTriviaLeaderboard(message, args, client) {
        const type = args[1]?.toLowerCase() || 'perfect';
        const scope = args[2]?.toLowerCase();
        const isGlobal = scope === 'global';

        let leaderboard, title;

        if (type === 'perfect') {
            leaderboard = isGlobal
                ? await this.economy.database.getTriviaLeaderboard(10)
                : await this.economy.getTriviaLeaderboardByGuild(10, message.guild.id, client);
            title = isGlobal ? '🏆 Trivia Global — Partidas Perfectas' : `🏆 Trivia Perfectas — ${message.guild.name}`;
        } else if (type === 'accuracy') {
            leaderboard = isGlobal
                ? await this.economy.getTriviaAccuracyLeaderboard(10)
                : await this.economy.getTriviaAccuracyLeaderboardByGuild(10, message.guild.id, client);
            title = isGlobal ? '🎯 Trivia Global — Mejor Precisión' : `🎯 Trivia Precisión — ${message.guild.name}`;
        } else if (type === 'played') {
            leaderboard = isGlobal
                ? await this.economy.getTriviaPlayedLeaderboard(10)
                : await this.economy.getTriviaPlayedLeaderboardByGuild(10, message.guild.id, client);
            title = isGlobal ? '🎮 Trivia Global — Más Partidas' : `🎮 Trivia Partidas — ${message.guild.name}`;
        } else if (type === 'survival') {
            leaderboard = isGlobal
                ? await this.economy.database.getTriviaSurvivalLeaderboard(10)
                : await this.economy.getTriviaLeaderboardByGuild(10, message.guild.id, client);
            title = isGlobal ? '💀 Trivia Global — Survival Record' : `💀 Trivia Survival — ${message.guild.name}`;
        } else {
            // Tipo desconocido — mostrar ayuda
            const embed = new EmbedBuilder()
                .setTitle('📊 Trivia Rankings — Tipos disponibles')
                .setDescription('> Usa `>trivialb <tipo>` para ver el ranking. Agrega `global` al final para el ranking global.')
                .addFields(
                    { name: '🏆 Perfect', value: '`>trivialb perfect`\nTop de partidas perfectas (5/5)', inline: true },
                    { name: '🎯 Accuracy', value: '`>trivialb accuracy`\nTop de mayor precisión general', inline: true },
                    { name: '🎮 Played', value: '`>trivialb played`\nTop de más partidas jugadas', inline: true },
                    { name: '💀 Survival', value: '`>trivialb survival`\nTop de récords en modo supervivencia', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '🌍 Global', value: 'Agrega `global` al final de cualquier comando:\n`>trivialb perfect global`\n`>trivialb played global`', inline: false }
                )
                .setColor('#9932CC')
                .setFooter({ text: 'Sin argumentos muestra el top de partidas perfectas del servidor.' });
            return message.reply({ embeds: [embed] });
        }

        if (!leaderboard || leaderboard.length === 0) {
            return message.reply('❌ No hay datos de trivia todavía.');
        }

        const scopeLabel = isGlobal ? '🌍 Global' : '🏠 Servidor';
        const embed = new EmbedBuilder()
            .setTitle(`${title} — ${scopeLabel}`)
            .setColor('#9932CC')
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

            let value;
            if (type === 'accuracy') {
                value = `${user.accuracy?.toFixed(1) || 0}% precisión (${user.correct || 0}/${user.total || 0} correctas)`;
            } else if (type === 'played') {
                value = `${user.trivia_played || 0} partidas jugadas`;
            } else if (type === 'survival') {
                value = `${user.trivia_survival_record || 0} preguntas sobrevividas`;
            } else {
                value = `${user.trivia_perfect || 0} partidas perfectas`;
            }

            description += `${medal} <@${user.userId}>\n📊 ${value}\n\n`;
        }

        embed.setDescription(description);
        embed.setFooter({ 
            text: isGlobal 
                ? 'Usa >trivialb para ver solo este servidor' 
                : 'Agrega "global" para ver el ranking global — ej: >trivialb played global' 
        });

        await message.reply({ embeds: [embed] });
    }

    async showTriviaCategories(message) {
        const embed = new EmbedBuilder()
            .setTitle('📚 Categorías de Trivia')
            .setDescription('Elige una categoría para preguntas específicas')
            .setColor('#9932CC')
            .addFields(
                {
                    name: '🎬 Entretenimiento',
                    value: 
                        '`peliculas` / `movies` / `cine`\n' +
                        '`musica` / `music`\n' +
                        '`tv` / `television`\n' +
                        '`videojuegos` / `videogames` / `games`\n' +
                        '`anime` / `manga`\n' +
                        '`cartoons` / `caricaturas`',
                    inline: true
                },
                {
                    name: '📖 Conocimiento',
                    value:
                        '`general`\n' +
                        '`libros` / `books`\n' +
                        '`historia` / `history`\n' +
                        '`geografia` / `geography` / `geo`\n' +
                        '`mitologia` / `mythology`\n' +
                        '`arte` / `art`',
                    inline: true
                },
                {
                    name: '🔬 Ciencias',
                    value:
                        '`ciencia` / `science` / `naturaleza`\n' +
                        '`computacion` / `computers` / `informatica`\n' +
                        '`matematicas` / `math` / `mates`',
                    inline: true
                },
                {
                    name: '⚽ Otros',
                    value:
                        '`deportes` / `sports`\n' +
                        '`animales` / `animals`',
                    inline: true
                },
                {
                    name: '💡 Ejemplos de Uso',
                    value:
                        '`>trivia easy peliculas`\n' +
                        '`>trivia medium tof deportes`\n' +
                        '`>trivia hard anime`',
                    inline: false
                }
            )
            .setFooter({ text: 'Usa >trivia <dificultad> [modo] [categoría]' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }

    /**
     * Traducir pregunta de trivia con contexto mejorado
     */
    async translateTriviaQuestion(question, answers, correctAnswer) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 segundos
            
            const prompt = `Eres un traductor experto especializado en trivias de cultura general. Tu trabajo es traducir preguntas y respuestas del inglés al español de forma NATURAL y CONTEXTUAL.

    REGLAS IMPORTANTES:
    1. Si la pregunta menciona títulos de películas, series, canciones o libros, NO los traduzcas literalmente. Usa el título conocido en español si existe, o déjalo en inglés si es más reconocible.
    2. Si hay nombres propios (personas, lugares, marcas), NO los traduzcas.
    3. Si hay símbolos o caracteres especiales raros, reemplázalos por su equivalente correcto.
    4. Mantén el sentido y contexto original de la pregunta.
    5. Las respuestas deben ser consistentes con la pregunta traducida.
    6. Si una pregunta es muy larga o compleja, tradúcela de forma más concisa manteniendo el sentido, pero NO la cortes a medias.
    7. SIEMPRE traduce la pregunta completa, nunca la dejes incompleta.

    PREGUNTA: ${question}

    RESPUESTAS:
    1. ${answers[0]} ${answers[0] === correctAnswer ? '(CORRECTA)' : ''}
    2. ${answers[1]} ${answers[1] === correctAnswer ? '(CORRECTA)' : ''}
    3. ${answers[2]} ${answers[2] === correctAnswer ? '(CORRECTA)' : ''}
    4. ${answers[3]} ${answers[3] === correctAnswer ? '(CORRECTA)' : ''}

    IMPORTANTE: Responde EXACTAMENTE en este formato (sin agregar texto extra, explicaciones ni markdown):
    PREGUNTA: [traducción natural de la pregunta]
    R1: [traducción de respuesta 1]
    R2: [traducción de respuesta 2]
    R3: [traducción de respuesta 3]
    R4: [traducción de respuesta 4]`;
            
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { 
                            role: 'system', 
                            content: 'Eres un traductor profesional de trivias. Traduces de forma natural y contextual, respetando títulos de obras, nombres propios y contexto cultural. Respondes SOLO en el formato solicitado, sin texto adicional.' 
                        },
                        { 
                            role: 'user', 
                            content: prompt 
                        }
                    ],
                    temperature: 0.1, // Muy baja para consistencia
                    max_tokens: 1000,
                    stream: false
                })
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                const content = data.choices[0].message.content.trim();
                                
                // Parsear la respuesta
                const lines = content.split('\n').filter(line => line.trim());
                const translatedQuestion = lines.find(l => l.startsWith('PREGUNTA:'))?.replace('PREGUNTA:', '').trim();
                const r1 = lines.find(l => l.startsWith('R1:'))?.replace('R1:', '').trim();
                const r2 = lines.find(l => l.startsWith('R2:'))?.replace('R2:', '').trim();
                const r3 = lines.find(l => l.startsWith('R3:'))?.replace('R3:', '').trim();
                const r4 = lines.find(l => l.startsWith('R4:'))?.replace('R4:', '').trim();
                
                if (translatedQuestion && r1 && r2 && r3 && r4) {
                    console.log('✅ Traducción parseada exitosamente');
                    return {
                        question: translatedQuestion,
                        answers: [r1, r2, r3, r4]
                    };
                }
                
                // Si el parsing falla, intentar parsing alternativo
                console.log('⚠️ Parsing estándar falló, intentando parsing alternativo');
                
                // Intentar extraer con regex más flexible
                const qMatch = content.match(/PREGUNTA:\s*(.+?)(?=R1:|$)/s);
                const r1Match = content.match(/R1:\s*(.+?)(?=R2:|$)/s);
                const r2Match = content.match(/R2:\s*(.+?)(?=R3:|$)/s);
                const r3Match = content.match(/R3:\s*(.+?)(?=R4:|$)/s);
                const r4Match = content.match(/R4:\s*(.+?)$/s);
                
                if (qMatch && r1Match && r2Match && r3Match && r4Match) {
                    console.log('✅ Traducción parseada con regex alternativo');
                    return {
                        question: qMatch[1].trim(),
                        answers: [
                            r1Match[1].trim(),
                            r2Match[1].trim(),
                            r3Match[1].trim(),
                            r4Match[1].trim()
                        ]
                    };
                }
                
                console.log('❌ Parsing de trivia falló completamente, usando método individual');
                return null;
                
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('⚠️ Error en traducción de trivia con Groq:', errorData.error?.message || response.status);
                return null;
            }
            
        } catch (error) {
            console.error('❌ Error traduciendo trivia:', error.message);
            return null;
        }
    }

    async translateText(text, sourceLang = 'auto', targetLang = 'es') {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const translationPrompt = sourceLang === 'auto' 
                ? `Traduce el siguiente texto al español de forma NATURAL y CONTEXTUAL. Si hay títulos de obras (películas, series, canciones, libros), NO los traduzcas literalmente - usa el título conocido en español o déjalos en inglés si son más reconocibles así. Si hay nombres propios, NO los traduzcas. Responde SOLO con la traducción, sin explicaciones:\n\n"${text}"`
                : `Translate the following text from ${sourceLang} to ${targetLang} in a NATURAL and CONTEXTUAL way. Do NOT literally translate titles of works (movies, series, songs, books) - use the known title in the target language or leave them in English if more recognizable. Do NOT translate proper nouns. Respond ONLY with the translation, no explanations:\n\n"${text}"`;
            
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { 
                            role: 'system', 
                            content: 'Eres un traductor profesional que traduce de forma natural y contextual, respetando títulos de obras, nombres propios y contexto cultural. Respondes SOLO con la traducción exacta, sin comentarios adicionales.' 
                        },
                        { 
                            role: 'user', 
                            content: translationPrompt 
                        }
                    ],
                    temperature: 0.2, // Baja para traducciones más consistentes
                    max_tokens: 500,
                    stream: false
                })
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                let translatedText = data.choices[0].message.content.trim();
                
                // Limpiar comillas si las agregó
                translatedText = translatedText.replace(/^["']|["']$/g, '');
                
                return translatedText;
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('⚠️ Error en traducción Groq:', errorData.error?.message || response.status);
                
                // Fallback a API externa si Groq falla
                return await this.translateTextFallback(text);
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('⏱️ Timeout en traducción, usando fallback');
            } else {
                console.error('❌ Error traduciendo con Groq:', error.message);
            }
            
            // Fallback a API externa
            return await this.translateTextFallback(text);
        }
    }

    /**
     * Fallback: Traducción con API externa si Groq falla
     */
    async translateTextFallback(text) {
        try {
            console.log('🔄 Usando API de traducción de fallback...');
            
            const encodedText = encodeURIComponent(text);
            const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=en|es`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.responseData && data.responseData.translatedText) {
                console.log('✅ Traducción fallback exitosa');
                return data.responseData.translatedText;
            }
            
            // Si todo falla, devolver texto original
            console.log('⚠️ Fallback también falló, retornando texto original');
            return text;
            
        } catch (error) {
            console.error('❌ Error en traducción fallback:', error.message);
            return text;
        }
    }

    // Decodificar HTML entities
    decodeHTML(html) {
        const entities = {
            '&quot;': '"',
            '&#039;': "'",
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&rsquo;': `'`,
            '&ldquo;': '"',
            '&rdquo;': '"',
            '&apos;': "'",
            '&nbsp;': ' ',
            '&eacute;': 'é',
            '&oacute;': 'ó',
            '&iacute;': 'í',
            '&aacute;': 'á',
            '&uacute;': 'ú',
            '&ntilde;': 'ñ',
            '&aring;': 'å',
            '&ouml;': 'ö',
            '&auml;': 'ä',
            '&uuml;': 'ü',
            '&Aring;': 'Å',
            '&Ouml;': 'Ö',
            '&Auml;': 'Ä',
            '&Uuml;': 'Ü',
            '&euro;': '€',
            '&pound;': '£',
            '&copy;': '©',
            '&reg;': '®',
            '&trade;': '™',
            '&deg;': '°',
            '&plusmn;': '±',
            '&frac12;': '½',
            '&frac14;': '¼',
            '&frac34;': '¾'
        };
        
        let decoded = html;
        
        // Decodificar entidades HTML predefinidas
        for (const [entity, char] of Object.entries(entities)) {
            decoded = decoded.split(entity).join(char);
        }
        
        // Decodificar entidades numéricas decimales (&#123;)
        decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
        
        // Decodificar entidades numéricas hexadecimales (&#x7B;)
        decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
        
        return decoded;
    }

    async processCommand(message) {
        // Verificar ingresos pasivos pendientes
        await this.economy.checkPendingPassiveIncome(message.author.id);
        await this.economy.shop.checkAndNotifyExpiredItems(message.author.id, message);

        const args = message.content.toLowerCase().split(' ');
        const command = args[0];
        await this.economy.missions.updateMissionProgress(message.author.id, 'commands_used');
/*const commandName = command.replace('>', '');
        await this.economy.missions.updateMissionProgress(message.author.id, 'unique_commands_used', commandName);*/

        try {
            switch (command) {
            case '>limits':
            case '>limites':
            case '>mylimits':
                await this.showMyLimits(message);
                break;
                case '>checklimits':
                    const userId = message.author.id;
                    const debugEmbed = new EmbedBuilder()
                        .setTitle('🔍 Estado de Límites')
                        .setColor('#00FF00');
                    
                    for (const [gameType, config] of Object.entries(this.dailyLimits)) {
                        const status = await this.economy.database.getGameLimitStatus(
                            userId, 
                            gameType, 
                            config.cycleHours
                        );
                        
                        const now = Date.now();
                        const timeLeftMs = status.cycleReset - now;
                        const hoursLeft = Math.floor(timeLeftMs / (60 * 60 * 1000));
                        const minutesLeft = Math.floor((timeLeftMs % (60 * 60 * 1000)) / (60 * 1000));
                        
                        debugEmbed.addFields({
                            name: `${gameType}`,
                            value: 
                                `**Ciclo:** ${status.cycleCount}/${config.perCycle}\n` +
                                `**Diario:** ${status.dailyCount}/${config.maxDaily}\n` +
                                `**Reset en:** ${hoursLeft}h ${minutesLeft}m\n` +
                                `**Timestamp reset:** ${status.cycleReset}\n` +
                                `**Timestamp ahora:** ${now}\n` +
                                `**Tipo de dato:** ${typeof status.cycleReset}`,
                            inline: false
                        });
                    }
                    
                    await message.reply({ embeds: [debugEmbed] });
                    break;
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
                case '>slots':
                case '>tragaperras':
                case '>slot':
                    await this.handleSlots(message, args);
                    break;
                case '>horserace':
                case '>horses':
                case '>caballos':
                    await this.handleHorseRace(message, args);
                    break;
                case '>joinrace':
                case '>unirsecaballo':
                    const raceGame = this.activeGames.get(`horserace_${message.channel.id}`);
                    if (raceGame && raceGame.mode === 'multi' && raceGame.phase === 'waiting') {
                        const amount = parseInt(args[1]) || raceGame.betAmount;
                        await this.joinHorseRace(message, raceGame, message.author.id, amount);
                    } else {
                        await message.reply('❌ No hay carrera multijugador esperando jugadores');
                    }
                    break;
                case '>startrace':
                case '>iniciarcarrera':
                    await this.handleStartRace(message);
                    break;
                case '>cancelrace':
                case '>cancelarcarrera':
                    await this.handleCancelRace(message);
                    break;
                case '>vending':
                case '>vendingmachine':
                case '>maquina':
                    await this.handleVendingMachine(message, args);
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
                case '>checkstats':
                    const user = await this.economy.getUser(message.author.id);
                    
                    const embed = new EmbedBuilder()
                        .setTitle('📊 Tus Estadísticas')
                        .addFields(
                            { name: 'Juegos jugados', value: `${user.stats?.games_played || 0}`, inline: true },
                            { name: 'Juegos ganados', value: `${user.stats?.games_won || 0}`, inline: true },
                            { name: 'Juegos perdidos', value: `${user.stats?.games_lost || 0}`, inline: true },
                            { name: 'Dinero apostado', value: `${this.formatNumber(user.stats?.total_bet || 0)} π-b$`, inline: true },
                            { name: 'Racha victorias', value: `${user.stats?.current_win_streak || 0}`, inline: true },
                            { name: 'Mejor racha', value: `${user.stats?.best_win_streak || 0}`, inline: true },
                            { name: 'Mayor ganancia', value: `${this.formatNumber(user.stats?.max_single_bet_win || 0)} π-b$`, inline: true }
                        )
                        .setColor('#FFD700');
                    
                    await message.reply({ embeds: [embed] });
                    break;
                case '>debugpot':
                    if (!message.member.permissions.has('Administrator')) {
                        await message.reply('❌ Solo administradores');
                        return;
                    }
                    
                    try {
                        // Obtener el pozo actual
                        const currentPot = await this.economy.database.getCurrentWeeklyPot();
                        
                        // Contar pozos completados
                        const [completedPots] = await this.economy.database.pool.execute(`
                            SELECT COUNT(*) as count FROM weekly_pot WHERE status = 'completed'
                        `);
                        
                        // Contar contribuciones huérfanas (sin pozo activo)
                        const [orphanContribs] = await this.economy.database.pool.execute(`
                            SELECT COUNT(*) as count FROM pot_contributions pc
                            LEFT JOIN weekly_pot wp ON pc.week_start = wp.week_start
                            WHERE wp.week_start IS NULL OR wp.status = 'completed'
                        `);
                        
                        const embed = new EmbedBuilder()
                            .setTitle('📊 Debug: Pozo Semanal')
                            .setColor('#FFD700');
                        
                        if (!currentPot) {
                            embed.setDescription('❌ No hay pozo activo');
                        } else {
                            const contributions = await this.economy.database.getPotContributions(currentPot.week_start);
                            const participants = [...new Set(contributions.map(c => c.user_id))];
                            
                            const weekStart = new Date(currentPot.week_start);
                            const weekEnd = new Date(currentPot.week_start + this.potConfig.weekDuration);
                            const now = Date.now();
                            const timeLeft = weekEnd - now;
                            
                            const daysLeft = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
                            const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                            
                            embed.addFields(
                                { name: '🆔 Week Start', value: `${currentPot.week_start}`, inline: true },
                                { name: '📅 Fecha Inicio', value: weekStart.toLocaleDateString(), inline: true },
                                { name: '🏁 Fecha Fin', value: weekEnd.toLocaleDateString(), inline: true },
                                { name: '⏰ Tiempo Restante', value: `${daysLeft}d ${hoursLeft}h`, inline: true },
                                { name: '📊 Status', value: currentPot.status, inline: true },
                                { name: '💰 Dinero Total', value: `${this.formatNumber(currentPot.total_money)} π-b$`, inline: true },
                                { name: '👥 Participantes', value: `${participants.length}`, inline: true },
                                { name: '📦 Contribuciones', value: `${contributions.length}`, inline: true },
                                { name: '🔢 Expirado?', value: now >= weekEnd.getTime() ? '✅ SÍ' : '❌ NO', inline: true }
                            );
                        }
                        
                        // ✅ AGREGAR INFO DE BASURA EN DB
                        embed.addFields(
                            { name: '🗑️ Pozos completados en DB', value: `${completedPots[0].count}`, inline: true },
                            { name: '👻 Contribuciones huérfanas', value: `${orphanContribs[0].count}`, inline: true }
                        );
                        
                        if (completedPots[0].count > 0 || orphanContribs[0].count > 0) {
                            embed.setFooter({ text: 'Usa >cleancompletedpots para limpiar' });
                        }
                        
                        await message.reply({ embeds: [embed] });
                    } catch (error) {
                        console.error('Error en debugpot:', error);
                        await message.reply(`❌ Error: ${error.message}`);
                    }
                    break;
                case '>cleancompletedpots':
                    if (!message.member.permissions.has('Administrator')) {
                        await message.reply('❌ Solo administradores');
                        return;
                    }
                    
                    try {
                        await message.reply('🔍 Buscando pozos completados antiguos...');
                        
                        // Eliminar contribuciones de pozos completados
                        const [contribResult] = await this.economy.database.pool.execute(`
                            DELETE pc FROM pot_contributions pc
                            INNER JOIN weekly_pot wp ON pc.week_start = wp.week_start
                            WHERE wp.status = 'completed'
                        `);
                        
                        // Eliminar pozos completados
                        const [potResult] = await this.economy.database.pool.execute(`
                            DELETE FROM weekly_pot WHERE status = 'completed'
                        `);
                        
                        await message.reply(
                            `✅ **Limpieza completada**\n` +
                            `🧹 Contribuciones eliminadas: ${contribResult.affectedRows}\n` +
                            `🗑️ Pozos eliminados: ${potResult.affectedRows}`
                        );
                        
                    } catch (error) {
                        console.error('Error en cleancompletedpots:', error);
                        await message.reply(`❌ Error: ${error.message}`);
                    }
                    break;
                case '>fixoldpots':
                    if (!message.member.permissions.has('Administrator')) {
                        await message.reply('❌ Solo administradores');
                        return;
                    }
                    
                    try {
                        await message.reply('🔍 Buscando pozos antiguos sin distribuir...');
                        
                        // Obtener el pozo actual
                        const currentPot = await this.economy.database.getCurrentWeeklyPot();
                        
                        if (!currentPot) {
                            await message.reply('❌ No hay pozo actual');
                            return;
                        }
                        
                        // Verificar si hay pozos antiguos activos
                        // (Necesitarás agregar este método en database.js - te lo doy abajo)
                        const oldPots = await this.economy.database.getOldActivePots(currentPot.week_start);
                        
                        if (oldPots.length === 0) {
                            await message.reply('✅ No hay pozos antiguos pendientes');
                            return;
                        }
                        
                        await message.reply(`⚠️ Encontrados **${oldPots.length}** pozos antiguos sin distribuir. Procesando...`);
                        
                        let distributed = 0;
                        let errors = 0;
                        
                        for (const oldPot of oldPots) {
                            try {
                                console.log(`📦 Distribuyendo pozo antiguo: ${oldPot.week_start}`);
                                await this.distributePot(oldPot);
                                distributed++;
                                
                                // Esperar 1 segundo entre distribuciones
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                
                            } catch (error) {
                                console.error(`❌ Error distribuyendo pozo ${oldPot.week_start}:`, error);
                                errors++;
                            }
                        }
                        
                        await message.reply(
                            `✅ **Proceso completado**\n` +
                            `📦 Distribuidos: ${distributed}\n` +
                            `❌ Errores: ${errors}\n` +
                            `🆕 Pozo actual: ${currentPot.week_start}`
                        );
                        
                    } catch (error) {
                        console.error('Error en fixoldpots:', error);
                        await message.reply(`❌ Error: ${error.message}`);
                    }
                    break;
                case '>trivia':
                    await this.playTrivia(message, args);
                    break;
                case '>triviasurvival':
                case '>triviasurv':
                case '>survival':
                    await this.playTriviaSurvival(message, args);
                    break;
                case '>triviamultiplayer':
                case '>triviamulti':
                case '>triviam':
                    await this.handleTriviaCompetitive(message, args);
                    break;
                case '>jointrivia':
                case '>jt':
                    await this.joinTriviaCompetitive(message);
                    break;
                case '>starttrivia':
                case '>st':
                    await this.startTriviaCompetitive(message);
                    break;
                case '>canceltrivia':
                case '>ct':
                    await this.cancelTriviaCompetitive(message);
                    break;
                case '>trivialb':
                    await this.handleTriviaLeaderboard(message, args, message.client);
                    break;
                case '>triviacategorias':
                case '>triviacategories':
                case '>triviacat':
                    await this.showTriviaCategories(message);
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
            .setTitle('🎮 Minijuegos — π-b Bot')
            .setDescription([
                '> Usa los comandos para jugar y ganar **π-b Coins**.',
                '> Los cooldowns pueden reducirse con items VIP y eventos.',
                '',
                '─────────────────────────────'
            ].join('\n'))
            .setColor('#9932CC')
            .addFields(
                {
                    name: '🪙 Coinflip',
                    value: [
                        '`>coinflip <cara/cruz> <apuesta>`',
                        '💰 Apuesta: **100 – 5,000** π-b$',
                        '🏆 Ganancia: **x1.85**',
                        '⏱️ Cooldown: **30s**'
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🎲 Dados',
                    value: [
                        '`>dice <1-6 / alto / bajo> <apuesta>`',
                        '💰 Apuesta: **100 – 5,000** π-b$',
                        '🏆 Ganancia: **x1.85** (alto/bajo) · **x4.0** (exacto)',
                        '⏱️ Cooldown: **45s**'
                    ].join('\n'),
                    inline: true
                },
                { name: '\u200b', value: '\u200b', inline: false },
                {
                    name: '🎰 Lotería',
                    value: [
                        '`>lottery <número 1-100> <apuesta>`',
                        '💰 Apuesta: **500 – 3,000** π-b$',
                        '🏆 Ganancia: **x100** si aciertas el número',
                        '⏱️ Cooldown: **5 min**'
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '♠️ Blackjack',
                    value: [
                        '`>blackjack <apuesta>`',
                        '💰 Apuesta: **100 – 10,000** π-b$',
                        '🏆 Ganancia: **x1.9** · **x2.3** con Blackjack natural',
                        '⏱️ Cooldown: **30s**'
                    ].join('\n'),
                    inline: true
                },
                { name: '\u200b', value: '\u200b', inline: false },
                {
                    name: '🎡 Ruleta',
                    value: [
                        '`>roulette <tipo> <apuesta>`',
                        '💰 Apuesta: **100 – 15,000** π-b$',
                        '🏆 Ganancia: **x1.85** (color) hasta **x32** (número)',
                        '⏱️ Cooldown: **20s**'
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🎰 Tragaperras',
                    value: [
                        '`>slots <apuesta>`',
                        '💰 Apuesta: **100 – 8,000** π-b$',
                        '🏆 Ganancia: **x2.5** hasta **x50** 💎',
                        '⏱️ Cooldown: **1 min**'
                    ].join('\n'),
                    inline: true
                },
                { name: '\u200b', value: '\u200b', inline: false },
                {
                    name: '🥤 Máquina Expendedora',
                    value: [
                        '`>vending`',
                        '💰 Costo fijo: **10** π-b$',
                        '🏆 Premio: **40** π-b$ · Probabilidad: **45%**',
                        '⏱️ Cooldown: **15 min**'
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🔫 Ruleta Rusa',
                    value: [
                        '`>russian <apuesta>` · `>startrussian` · `>shoot`',
                        '💰 Apuesta: **300 – 4,000** π-b$',
                        '👥 Jugadores: **2-6** · Ganador lleva **80%** del pot',
                        '⏱️ Cooldown: según ronda'
                    ].join('\n'),
                    inline: true
                },
                { name: '\u200b', value: '\u200b', inline: false },
                {
                    name: '🐎 Carrera de Caballos',
                    value: [
                        '`>horses bot <apuesta>` — vs Bot',
                        '`>horses multi <apuesta>` · `>joinrace` · `>startrace`',
                        '💰 Apuesta: **200 – 10,000** π-b$',
                        '🏆 Premios: 🥇**x3.0** 🥈**x1.8** 🥉**x1.2**',
                        '⚡ Puedes doblar tu apuesta hasta el 75% de la carrera'
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🎴 UNO Multiplayer',
                    value: [
                        '`>ujoin <apuesta>` · `>ustart` · `>uplay <color> <número>`',
                        '`>upickup` robar · `>uhand` ver mano · `>sayuno` ¡UNO!',
                        '💰 Apuesta: **150 – 8,000** π-b$',
                        '👥 Jugadores: **2-8** · Ganador lleva **90%** del pot'
                    ].join('\n'),
                    inline: true
                },
                { name: '\u200b', value: '\u200b', inline: false },
                {
                    name: '🕳️ Pozo Semanal',
                    value: [
                        '`>potcontribute money/item <valor>` · `>holethings`',
                        '💰 Rango: **100 – 50,000** π-b$ · Máx **3 items/usuario**',
                        '🎁 Distribución aleatoria entre participantes cada semana'
                    ].join('\n'),
                    inline: true
                },
                { name: '\u200b', value: '\u200b', inline: false },
                {
                    name: '─── 🧠 Trivia ───────────────',
                    value: '\u200b',
                    inline: false
                },
                {
                    name: '📖 Trivia Clásica',
                    value: [
                        '`>trivia [easy/medium/hard] [modo] [categoría]`',
                        '🎁 **Gratis** · 5 preguntas por partida',
                        '🏆 Recompensa: hasta **1,000** π-b$ + **80** XP',
                        '⏱️ Cooldown: **1 min**'
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '💀 Trivia Survival',
                    value: [
                        '`>triviasurvival [easy/medium/hard] [categoría]`',
                        '🎁 **Gratis** · Sobrevive el mayor número de preguntas',
                        '🏆 **100** π-b$ + **10** XP por pregunta · dificultad sube cada 5',
                        '⏱️ Cooldown: **5 min**'
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🏆 Trivia Competitiva',
                    value: [
                        '`>triviacomp [dificultad] [apuesta]` · `>jointrivia` · `>starttrivia`',
                        '💰 Apuesta: **0 – 5,000** π-b$ · Jugadores: **2-6**',
                        '🏆 Ganador lleva **85%** del pot',
                        '⏱️ Cooldown: **3 min**'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📊 Rankings de Trivia',
                    value: '`>trivialb` · `>trivialb perfect` · `>trivialb accuracy` · `>trivialb played`\n`>trivialb <tipo> global` — Ver ranking global',
                    inline: false
                },
                {
                    name: '🔮 Próximamente',
                    value: '• Poker\n• Memory Game\n• Wordle Musical\n• Cine Quiz\n• Anagramas',
                    inline: false
                },
            )
            .setFooter({ text: 'Juega responsablemente — La casa siempre tiene ventaja 🎰' })
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
