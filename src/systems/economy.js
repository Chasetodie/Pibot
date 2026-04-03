require('dotenv').config();
const LocalDatabase = require('../database/database');
const EventsSystem = require('./events');

const richUC = new Map();
const heavyUsersCache = new Map();

class EconomySystem {
    constructor(client) {
        this.database = null;
        this.client = client;
        this.initializeDatabase();
        this.events = null;
        this.processingPassiveIncome = new Set();
        
        // Configuración del sistema
        this.config = {
            currency: 'π-b Coins',
            currencySymbol: 'π-b$',
            xpPerMessage: 10, // XP base por mensaje
            xpVariation: 5,  // Variación aleatoria del XP
            xpCooldown: 10000, // 15 segundos entre mensajes que dan XP
            dailyAmount: 500,  // Cantidad base del daily
            dailyVariation: 300, // Variación del daily
            levelUpReward: 50, // π-b Coins por subir de nivel
            xpPerLevel: 100,   // XP base necesaria para nivel 1
            levelMultiplier: 1.5, // Multiplicador de XP por nivel
            maxBalance: 10000000, // Limite de 10 millones
        };
        
        this.userCooldowns = new Map(); // Para controlar cooldowns de XP

        // Configuración de robos
        this.robberyConfig = {
            cooldown: 6 * 60 * 60 * 1000,     // 6 horas de cooldown
            minStealPercentage: 15,           // Mínimo 15%
            maxStealPercentage: 25,           // Máximo 25%
            buttonTimeLimit: 30000,           // 30 segundos para hacer clicks
            maxClicks: 50,                    // Máximo de clicks
            penaltyPercentage: 15,            // 15% de penalización si fallas el minijuego
            levelRequirement: 5,              // Nivel mínimo para robar
            minTargetBalance: 500,            // El objetivo debe tener al menos 500 coins
        };

        this.pactoConfig = {
            cooldown: 48 * 60 * 60 * 1000, // 72 horas
            minBalance: 100,                // mínimo para hacer pacto
        };

        this.PROFESSIONS = {
            ladron:      { name: '🗡️ Ladrón',      workMult: 0.85, robCooldownMult: 0.5,  robAlwaysFail: false, dailyMult: 1.0,  minigameMult: 1.0,  missionMult: 1.0  },
            empresario:  { name: '💼 Empresario',   workMult: 1.25, robCooldownMult: 1.0,  robAlwaysFail: true,  dailyMult: 1.0,  minigameMult: 1.0,  missionMult: 1.0  },
            apostador:   { name: '🎲 Apostador',    workMult: 1.0,  robCooldownMult: 1.0,  robAlwaysFail: false, dailyMult: 1.0,  minigameMult: 1.3,  missionMult: 1.0, minigameFail: 1.15},
            artesano:    { name: '⚗️ Artesano',     workMult: 0.75, robCooldownMult: 1.0,  robAlwaysFail: false, dailyMult: 0.8,  minigameMult: 1.0,  missionMult: 1.0, craftSpeedMult: 0.6  },
            aventurero:  { name: '🌟 Aventurero',   workMult: 1.0,  robCooldownMult: 1.0,  robAlwaysFail: false, dailyMult: 1.0,  minigameMult: 1.0,  missionMult: 2.0, dailyExtraHours: true },
            doctor:      { name: '🩺 Doctor',       workMult: 1.0,  robCooldownMult: 1.0,  robAlwaysFail: false, dailyMult: 1.0,  minigameMult: 1.0,  missionMult: 1.0, penaltyMult: 0.5  },
            guardian:    { name: '🛡️ Guardián',     workMult: 0.8,  robCooldownMult: 1.0,  robAlwaysFail: true,  dailyMult: 1.15, minigameMult: 1.0,  missionMult: 1.0, xpMult: 1.20 },
            ludopata:    { name: '🎰 Ludópata',     workMult: 0.7,  robCooldownMult: 1.0,  robAlwaysFail: false, dailyMult: 0.8,  minigameMult: 1.4,  missionMult: 1.0  },
//            cazador:     { name: '🏹 Cazador',      workMult: 0.8,  robCooldownMult: 1.0,  robAlwaysFail: false, dailyMult: 1.0,  minigameMult: 1.0,  missionMult: 1.0, bossMult: 1.5     },
            granjero:    { name: '🌿 Granjero',     workMult: 1.0,  robCooldownMult: 1.0,  robAlwaysFail: true,  dailyMult: 0.85, minigameMult: 1.0,  missionMult: 1.0, gardenMult: 1.5   },
        };

        this.professionConfig = {
            minLevel: 10,
            changeCost: 150000,
            changeCooldown: 30 * 24 * 60 * 60 * 1000, // 30 días
        };

        this.doctorConfig = {
            cureCost: 5000,
            cooldown: 2 * 60 * 60 * 1000,
        };

        this.mendicidadConfig = {
            cooldown: 8 * 60 * 60 * 1000,  // 8 horas
            donationAmount: 500,            // cantidad fija a donar
            usersToMention: 3,              // usuarios a mencionar
            requestExpiry: 10 * 60 * 1000, // 10 minutos para que expire
        };

        this.BOOKS = {
            // Daily
            tomo_finanzas:      { name: '📘 Tomo Básico de Finanzas',      price: 5000,  readHours: 1, effect: { type: 'dailyBonus',      value: 0.02 } },
            tratado_economia:   { name: '📗 Tratado de Economía',          price: 15000, readHours: 1, effect: { type: 'dailyBonus',      value: 0.03 } },
            arte_prosperidad:   { name: '📙 Arte de la Prosperidad',       price: 40000, readHours: 3, effect: { type: 'dailyBonus',      value: 0.05 } },
            // Trabajo
            manual_trabajador:  { name: '📘 Manual del Trabajador',        price: 8000,  readHours: 1, effect: { type: 'workBonus',       value: 0.02 } },
            guia_productividad: { name: '📗 Guía de Productividad',        price: 20000, readHours: 3, effect: { type: 'workBonus',       value: 0.03 } },
            secretos_gremio:    { name: '📙 Secretos del Gremio',          price: 50000, readHours: 6, effect: { type: 'workBonus',       value: 0.05 } },
            // Robo
            intro_sigilo:       { name: '📘 Introducción al Sigilo',       price: 10000, readHours: 1, effect: { type: 'robBonus',        value: 0.02 } },
            arte_engano:        { name: '📗 Arte del Engaño',              price: 25000, readHours: 3, effect: { type: 'robBonus',        value: 0.03 } },
            codigo_ladron:      { name: '📙 Código del Ladrón',            price: 60000, readHours: 6, effect: { type: 'robBonus',        value: 0.05 } },
            // Cooldown trabajo
            tecnicas_eficiencia:{ name: '📘 Técnicas de Eficiencia',       price: 20000, readHours: 3, effect: { type: 'workCooldown',    value: 0.10 } },
            maestria_laboral:   { name: '📙 Maestría Laboral',             price: 60000, readHours: 6, effect: { type: 'workCooldown',    value: 0.20 } },
            // Cooldown robo
            tacticas_escape:    { name: '📘 Tácticas de Escape',           price: 25000, readHours: 3, effect: { type: 'robCooldown',     value: 0.10 } },
            sombras_silencios:  { name: '📙 Sombras y Silencios',          price: 70000, readHours: 6, effect: { type: 'robCooldown',     value: 0.20 } },
            // Minijuegos
            teoria_azar:        { name: '📗 Teoría del Azar',              price: 30000, readHours: 3, effect: { type: 'minigameBonus',   value: 0.03 } },
            probabilidades_av:  { name: '📙 Probabilidades Avanzadas',     price: 80000, readHours: 6, effect: { type: 'minigameBonus',   value: 0.05 } },
            // Recetas
            pergamino_i:        { name: '📜 Pergamino Antiguo I',          price: 15000, readHours: 2, effect: { type: 'recipe',          recipeId: 'secret_recipe_1' } },
            pergamino_ii:       { name: '📜 Pergamino Antiguo II',         price: 35000, readHours: 2, effect: { type: 'recipe',          recipeId: 'secret_recipe_2' } },
            pergamino_iii:      { name: '📜 Pergamino Antiguo III',        price: 75000, readHours: 6, effect: { type: 'recipe',          recipeId: 'secret_recipe_3' } },
        };

        // AGREGAR ESTAS LÍNEAS:
        this.userCache = new Map();
        this.MAX_CACHE_SIZE = 500;
        this.cacheTimeout = 10 * 60 * 1000; // 5 minutos        
        
        // Map para trackear robos activos
        this.activeRobberies = new Map();
        this.workStreaks = new Map(); // userId -> { streak, lastJob }

        this.SEEDS = {
            common_seed:    { time: 2,  moneyMin: 100,   moneyMax: 500,   ingredient: 'herb_common',    emoji: '🌱' },
            rare_seed:      { time: 6,  moneyMin: 500,   moneyMax: 2000,  ingredient: 'herb_rare',      emoji: '🌿' },
            epic_seed:      { time: 12, moneyMin: 2000,  moneyMax: 8000,  ingredient: 'herb_epic',      emoji: '🌺' },
            legendary_seed: { time: 24, moneyMin: 8000,  moneyMax: 25000, ingredient: 'herb_legendary', emoji: '🌸' },
        };

        this.PET_RARITIES = {
            common:    { name: 'Común', emoji: '⚪', bonus: { type: 'daily',     amount: 0.02 }, xpToLevel: 50,  evolutionLevel: [11, 31] },
            uncommon:  { name: 'Poco Común', emoji: '🟢', bonus: { type: 'work',      amount: 0.03 }, xpToLevel: 80,  evolutionLevel: [11, 31] },
            rare:      { name: 'Raro', emoji: '🔵', bonus: { type: 'minigames', amount: 0.05 }, xpToLevel: 120, evolutionLevel: [11, 31] },
            epic:      { name: 'Épico', emoji: '🟣', bonus: { type: 'all',       amount: 0.08 }, xpToLevel: 200, evolutionLevel: [11, 31] },
            legendary: { name: 'Legendario', emoji: '🟡', bonus: { type: 'all',       amount: 0.15, special: true }, xpToLevel: 300, evolutionLevel: [11, 31] },
        };

        this.PET_NAMES = {
            common:    ['Sandia', 'Chiflón', 'Polvorín', 'Grisáceo'],
            uncommon:  ['Verdoso', 'Hojín', 'Trebol', 'Musgo'],
            rare:      ['Zafiro', 'Marino', 'Celeste', 'Aguamiel'],
            epic:      ['Sombra', 'Nebula', 'Vórtex', 'Eclipse'],
            legendary: ['Aurum', 'Solaris', 'Nexus', 'Infinito'],
        };

        this.ANNIVERSARY_MILESTONES = {
            1:  { type: 'bonus_percent', amount: 0.05, label: '💕 +5% ganancias compartidas' },
            3:  { type: 'item',          itemId: 'lucky_charm', label: '🎁 Amuleto de Ganancias de aniversario' },
            6:  { type: 'money',         amount: 50000, label: '💰 50,000π de bono' },
            12: { type: 'title',         label: '💍 Título "Eterno" desbloqueado' },
        };


        this.MENTOR_MILESTONES = {
            10: { reward: 5000,  label: '🎓 Nivel 10 alcanzado' },
            15: { reward: 15000, label: '🎓 Nivel 15 alcanzado' },
            20: { reward: 30000, itemId: 'mystery_box', label: '🎓 ¡Graduado! Nivel 20' },
        };
    }

    async initializeDatabase() {
        try {
            this.database = new LocalDatabase();
            console.log('🗄️ Base de datos MySQL inicializada correctamente');
        } catch (error) {
            console.error('❌ Error inicializando base de datos MySQL:', error);
            this.database = null;
        }
    }

    async getUser(userId) {
        // Verificar cache primero
        const cached = this.userCache.get(userId);
        const now = Date.now();

        if (!this.database) {
            throw new Error('❌ Base de datos no inicializada');
        }        

        if (cached && (now - cached.timestamp) < this.cacheTimeout) {
            return cached.user;
        }
        
        try {
            // ✅ NUEVO: Usar LocalDatabase
            const user = await this.database.getUser(userId);

            // Guardar en cache
            this.userCache.set(userId, {
                user: user,
                timestamp: now
            });

            return user;
        } catch (error) {
            console.error('❌ Error obteniendo usuario:', error);
            throw error;
        }
    }

    async checkPendingPassiveIncome(userId) {
        if (this.processingPassiveIncome.has(userId)) {
            return; // Ya se está procesando para este usuario
        }
        
        this.processingPassiveIncome.add(userId);
        
        try {
            const user = await this.getUser(userId);
            const permanentEffects = this.shop.parseEffects(user.permanentEffects);
            
            for (const [itemId, effect] of Object.entries(permanentEffects)) {
                if (!effect || typeof effect !== 'object') continue;
                
                if (effect.type === 'passive_income') {
                    const lastPayout = user.lastPassivePayout || 0;
                    const now = Date.now();
                    
                    if (now - lastPayout >= 3600000) {
                        // ✅ PROCESAR SOLO ESTE USUARIO
                        const amount = Math.floor(
                            Math.random() * (effect.maxAmount - effect.minAmount + 1)
                        ) + effect.minAmount;
                        
                        if (user.balance + amount <= this.config.maxBalance) {
                            const currentStats = user.passiveIncomeStats || { 
                                totalEarned: 0, 
                                lastPayout: 0, 
                                payoutCount: 0 
                            };
                            
                            let parsedStats = currentStats;
                            if (typeof currentStats === 'string') {
                                try {
                                    parsedStats = JSON.parse(currentStats);
                                } catch {
                                    parsedStats = { totalEarned: 0, lastPayout: 0, payoutCount: 0 };
                                }
                            }
                            
                            const newStats = {
                                totalEarned: parsedStats.totalEarned + amount,
                                lastPayout: now,
                                payoutCount: parsedStats.payoutCount + 1
                            };
                            
                            await this.updateUser(userId, {
                                balance: user.balance + amount,
                                lastPassivePayout: now,
                                passiveIncomeStats: newStats
                            });
                            
                            console.log(`🤖 Ingreso pasivo: ${amount} π-b$ para ${userId.slice(-4)}`);
                        }
                        break;
                    }
                }
            }
        } finally {
            this.processingPassiveIncome.delete(userId);
        }
    }

    // Actualizar datos de usuario (MIGRADO)
    async updateUser(userId, updateData) {
        try {
            // ✅ NUEVO: Usar LocalDatabase
            await this.database.updateUser(userId, updateData);
            
            // Obtener usuario actualizado para cache
            const updatedUser = await this.database.getUser(userId);
            
            // Actualizar cache
            this.userCache.set(userId, {
                user: updatedUser,
                timestamp: Date.now()
            });

            return updatedUser;
        } catch (error) {
            console.error('❌ Error actualizando usuario:', error);
            throw error;
        }
    }

    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            
            // Limpiar por tiempo
            for (const [userId, cached] of this.userCache) {
                if (now - cached.timestamp > this.cacheTimeout) {
                    this.userCache.delete(userId);
                }
            }
            
            // Limpiar por tamaño si excede el límite
            if (this.userCache.size > this.MAX_CACHE_SIZE) {
                const entries = Array.from(this.userCache.entries());
                const toDelete = entries
                    .sort((a, b) => a[1].timestamp - b[1].timestamp)
                    .slice(0, entries.length - this.MAX_CACHE_SIZE);
                    
                for (const [tradeId] of toDelete) {
                    this.userCache.delete(tradeId);
                }
            }
            
            console.log(`🧹 Cache cleanup: ${this.userCache.size} users? en memoria`);
        }, 10 * 60 * 1000);
    }

    // Obtener todos los usuarios (MIGRADO)
    async getAllUsers() {
        try {
            // ✅ NUEVO: Usar LocalDatabase
            const users = await this.database.getAllUsers();
            return users;
        } catch (error) {
            console.error('❌ Error obteniendo todos los usuarios:', error);
            return [];
        }
    }

    // Agregar dinero a un usuario
    async addMoney(userId, amount, reason = 'unknown') {
        const user = await this.getUser(userId);

        let maxBalance = this.config.maxBalance;

        if (this.shop) {
            maxBalance = await this.shop.getVipLimit(userId);
        }

        const newBalance = Math.min(user.balance + amount, maxBalance);
        const actualAmount = newBalance - user.balance;
        
        const updateData = {
            balance: newBalance,
            stats: {
                ...user.stats,
                totalEarned: (user.stats.totalEarned || 0) + amount
            }
        }

        if (actualAmount < amount) {
            console.log(`💰 Usuario ${userId} alcanzó límite: quería ${amount}, solo se agregó ${actualAmount}`);
        }        
        
        //console.log(`💰 +${amount} ${this.config.currencySymbol} para ${userId} (${reason})`);
        await this.updateUser(userId, updateData);
       
        // Al final de addMoney(), después de updateUser()
        await this.missions.updateMissionProgress(userId, 'balance_milestone_today');

        return {
            newBalance,
            actualAmount,
            hitLimit: actualAmount < amount
        };
    }

    // Quitar dinero a un usuario
    async removeMoney(userId, amount, reason = 'unknown') {
        const user = await this.getUser(userId);
        if (user.balance < amount) {
            const updateDataWithout = {
                balance: 0,
                stats: {
                    ...user.stats,
                    totalSpent: (user.stats.totalSpent || 0) + amount
                }
            }

            console.log(`💸 -${amount} ${this.config.currencySymbol} para ${userId} (${reason})`);
            await this.updateUser(userId, updateDataWithout);
            
            return user.balance; // No tiene suficiente dinero
        }

        const updateData = {
            balance: user.balance - amount,
            stats: {
                ...user.stats,
                totalSpent: (user.stats.totalSpent || 0) + amount
            }
        }
                
        console.log(`💸 -${amount} ${this.config.currencySymbol} para ${userId} (${reason})`);
        await this.updateUser(userId, updateData);
        return user.balance;
    }

    // Transferir dinero entre usuarios
    async transferMoney(fromUserId, toUserId, amount, guildId = null) {
        const robberyCheck = this.isBeingRobbed(fromUserId);
        if (robberyCheck.beingRobbed) {
            return { 
                success: false, 
                reason: 'being_robbed',
                timeLeft: robberyCheck.timeLeft,
                robberId: robberyCheck.robberId
            };
        }
        
        const fromUser = await this.getUser(fromUserId);
        const toUser = await this.getUser(toUserId);

        let toMaxBalance = this.config.maxBalance;

        if (this.shop) {
            toMaxBalance = await this.shop.getVipLimit(toUserId);
        }
        
        if (toUser.balance + amount > toMaxBalance) {
            return {
                success: false,
                reason: 'recipient_limit_exceeded',
                maxBalance: toMaxBalance
            }
        }

        if (fromUser.balance < amount) {
            return { success: false, reason: 'insufficient_funds' };
        }
        
        if (amount <= 0) {
            return { success: false, reason: 'invalid_amount' };
        }

        let finalFrom = 0;
        let eventMessage = '';
        
        for (const event of (this.events?.getActiveEvents(guildId) || [])) {
            const transferBonus = event.multipliers?.transfer_bonus || 0;
            
            if (transferBonus > 0) {
                finalFrom = Math.floor(amount * transferBonus);
                eventMessage = `\n${event.emoji} **${event.name}** (+${finalFrom} π-b$) a quien dio dinero`;
                break;
            }
        }

        let beforeMoney = fromUser.balance - amount;
      
        const updateDataFrom = {
            balance: (fromUser.balance - amount) + finalFrom,
            stats: {
                ...fromUser.stats,
                totalSpent: (fromUser.stats.totalSpent || 0) - amount,
                totalEarned: (fromUser.stats.totalEarned || 0) + finalFrom
            }
        };

        const updateDataTo = {
            balance: toUser.balance + amount,
            stats: {
                ...toUser.stats,
                totalEarned: (toUser.stats.totalEarned || 0) + amount
            }
        };

        await this.updateUser(fromUserId, updateDataFrom);
        await this.updateUser(toUserId, updateDataTo);

        if (this.achievements) {
            await this.achievements.updateStats(fromUserId, 'money_given', amount);
        }

        console.log(`💸 Transferencia: ${fromUserId} -> ${toUserId}, ${amount} ${this.config.currencySymbol}`);

        // *** NUEVO: ACTUALIZAR MISIONES ***
        if (this.missions) {
            await this.missions.updateMissionProgress(fromUserId, 'money_transferred', amount);
            await this.missions.updateMissionProgress(fromUserId, 'unique_transfers', toUserId);
            await this.missions.updateMissionProgress(toUserId, 'money_received_today', amount);

            await this.missions.updateMissionProgress(fromUserId, 'balance_milestone_today');
            await this.missions.updateMissionProgress(toUserId, 'balance_milestone_today');
        }
       
        return {
            success: true,
            amount: amount,
            beforeEvents: beforeMoney,
            fromBalance: updateDataFrom.balance,
            toBalance: updateDataTo.balance,
            eventMessage: eventMessage
        };
    }

    // Calcular XP necesaria para un nivel específico
    getXpForLevel(level) {
        if (level <= 1) return 0;
        
        // Fórmula más suave: base * (nivel ^ 1.5) en lugar de (nivel ^ exponente alto)
        return Math.floor(100 * Math.pow(level - 1, 1.5));
    }

    calculateScaledXp(user, baseXp = this.config.xpPerMessage) {
        const level = user.level;
        
        // Sistema escalonado más suave
        if (level <= 10) {
            return baseXp + Math.floor(level * 1.2); // +1-12 XP (niveles 1-10)
        } else if (level <= 25) {
            return baseXp + Math.floor(12 + (level - 10) * 1.5); // +12-34 XP (niveles 11-25)
        } else if (level <= 50) {
            return baseXp + Math.floor(34 + (level - 25) * 2); // +34-84 XP (niveles 26-50)
        } else if (level <= 75) {
            return baseXp + Math.floor(84 + (level - 50) * 2.5); // +84-146 XP (niveles 51-75)
        } else {
            return baseXp + Math.floor(146 + (level - 75) * 3); // +146+ XP (nivel 76+)
        }
    }

    // Calcular nivel basado en XP total
    getLevelFromXp(totalXp) {
        let level = 1;
        let xpNeeded = 0;
        
        // Acumular XP necesaria hasta que supere el XP total
        while (true) {
            const xpForNextLevel = this.getXpForLevel(level + 1);
            if (xpNeeded + xpForNextLevel > totalXp) {
                break; // Ya no puede subir más niveles
            }
            xpNeeded += xpForNextLevel;
            level++;
            
            // Límite de seguridad
            if (level >= 200) break;
        }
        
        return level;
    }

    // Agregar XP a un usuario y verificar subida de nivel
    async addXp(userId, baseXp) {
        const user = await this.getUser(userId); // ← Ahora async
        const variation = Math.floor(Math.random() * (this.config.xpVariation * 2)) - this.config.xpVariation;
        
        let xpGained = Math.max(1, baseXp + variation);

        if (this.shop) {
            xpGained = await this.shop.applyXpEffects(userId, xpGained);
        }

        // Multiplicador de profesión (Guardián +20% XP)
        const profXp = this.getProfession(user);
        if (profXp?.xpMult && profXp.xpMult !== 1.0) {
            const bonus = Math.floor(xpGained * (profXp.xpMult - 1));
            xpGained += bonus;
        }
       
        const oldLevel = user.level;
        const newXp = user.xp + xpGained;
        const newTotalXp = user.total_xp + xpGained;

        // Calcular nuevo nivel
        const newLevel = this.getLevelFromXp(newTotalXp);
        const levelUps = newLevel - oldLevel;
        
        // Preparar datos para actualizar
        const updateData = {
            xp: newXp,
            total_xp: newTotalXp
        };
        
        if (levelUps > 0) {
            const reward = levelUps * this.config.levelUpReward;

            const levelBonus = newLevel * 75;
            const totalReward = reward + levelBonus;
            
            updateData.level = newLevel;
            updateData.balance = user.balance + totalReward;
            updateData.stats = {
                ...user.stats,
                totalEarned: (user.stats.totalEarned || 0) + totalReward
            };
            
            await this.updateUser(userId, updateData);
            await this.missions.updateMissionProgress(userId, 'xp_gained_today', xpGained);

            // Verificar hitos de mentoría
            const mentorMilestone = await this.checkMentorMilestone(userId, newLevel).catch(() => null);

            return {
                levelUp: true,
                levelsGained: levelUps,
                newLevel: newLevel,
                xpGained: newTotalXp,
                reward: totalReward,
                baseReward: reward,
                levelBonus: levelBonus,
                mentorMilestone,
            };
        }
        
        await this.updateUser(userId, updateData); // ← Reemplaza saveUsers()

        await this.missions.updateMissionProgress(userId, 'xp_gained_today', xpGained);


        return {
            levelUp: false,
            xpGained: newTotalXp,
            currentLevel: user.level
        };
    }

    // Procesar XP por mensaje (con cooldown)
    async processMessageXp(userId, guildId = null) {      
        // LOGGING TEMPORAL - añadir al inicio
        const startMemory = process.memoryUsage().heapUsed;
        const startTime = Date.now();
        
        console.log(`🔍 Procesando usuario: ${userId.slice(-4)}`);
               
        const now = Date.now();
        const lastXp = this.userCooldowns.get(userId) || 0;

        // Verificar cooldown
        if (now - lastXp < this.config.xpCooldown) {
            return null; // Aún en cooldown
        }

        // Cache para usuarios con muchos items
        let userData = heavyUsersCache.get(userId);
        if (!userData) {
            userData = await this.getUser(userId); // UNA SOLA CARGA
            
            const itemCount = Object.keys(userData.items || {}).length;
            if (userData.money > 1000000 || itemCount > 5) { // Rico O muchos items
                heavyUsersCache.set(userId, userData);
                setTimeout(() => heavyUsersCache.delete(userId), 300000);
            }
        }        

        this.userCooldowns.set(userId, now);
        
/*        // Obtener usuario (ahora async)
        const user = await this.getUser(userId);*/

        const user = userData;
        
        try {
            // Agregar XP (ahora async)
            let finalXp = this.config.xpPerMessage;
            let eventMessage = '';
                
            for (const event of (this.events?.getActiveEvents(guildId) || [])) {
                const xpMultiplier = event.multipliers?.xp || 1.0;
                
                if (xpMultiplier > 1.0) {
                    const baseXp = this.config.xpPerMessage;
                    finalXp = Math.floor(baseXp * xpMultiplier);
                    const bonus = finalXp - baseXp;
                    eventMessage = `\n${event.emoji} **${event.name}** (+${bonus} XP)`;
                    break; // Solo aplicar un evento
                }
            }

            const result = await this.addXp(userId, finalXp);
            
            // Actualizar contador de mensajes
            const updateData = {
                messages_count: (user.messages_count || 0) + 1
            };

            await this.updateUser(userId, updateData);

            // LOGGING AL FINAL - antes del return
            const endMemory = process.memoryUsage().heapUsed;
            const memoryDiff = endMemory - startMemory;
            const timeDiff = Date.now() - startTime;
            
            if (memoryDiff > 1024 * 1024 || timeDiff > 500) { // >1MB o >500ms
                console.log(`🚨 USUARIO PROBLEMÁTICO:
                - ID: ${userId.slice(-4)}
                - Memoria: +${Math.round(memoryDiff / 1024)}KB
                - Tiempo: ${timeDiff}ms
                - Items: ${Object.keys(user.items || {}).length}
                - Dinero: ${user.balance || 0}`);
            }
            
            return {
                levelUp: result.levelUp,
                levelsGained: result.levelsGained,
                newLevel: result.newLevel,
                xpGained: result.xpGained,
                reward: result.reward,
                result: result,
                eventMessage: eventMessage
            };
        } catch (error) {
            console.error('❌ Error procesando XP del mensaje:', error);
            // Remover del cooldown si hubo error
            this.userCooldowns.delete(userId);
            return null;
        }
    }

    // Obtener estadísticas de un usuario
    getUserStats(userId) {
        const user = this.getUser(userId);
        const xpForNextLevel = this.getXpForLevel(user.level + 1);
        const xpForCurrentLevel = this.getXpForLevel(user.level);
        const xpProgress = user.totalXp - this.getXpNeededForLevel(user.level);
        const xpNeeded = xpForNextLevel;
        
        return {
            ...user,
            xpForNextLevel: xpNeeded,
            xpProgress: xpProgress,
            xpNeeded: Math.max(0, xpNeeded - xpProgress)
        };
    }

    // Calcular XP total necesaria para alcanzar un nivel
    getXpNeededForLevel(level) {
        let totalXp = 0;
        for (let i = 2; i <= level; i++) {
            totalXp += this.getXpForLevel(i);
        }
        return totalXp;
    }

    async getBalanceLeaderboard(limit = 10) {
        try {
            // ✅ NUEVO: Usar LocalDatabase
            return await this.database.getBalanceLeaderboard(limit);
        } catch (error) {
            console.error('❌ Error obteniendo ranking de balance:', error);
            return [];
        }
    }

    async getLevelLeaderboard(limit = 10) {
        try {
            // ✅ NUEVO: Usar LocalDatabase
            return await this.database.getLevelLeaderboard(limit);
        } catch (error) {
            console.error('❌ Error obteniendo ranking de niveles:', error);
            return [];
        }
    }

    async getBalanceLeaderboardByGuild(limit = 10, guildId, client) {
        try {
            const allUsers = await this.database.getBalanceLeaderboard(limit * 5);
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return allUsers.slice(0, limit);
            
            const filtered = [];
            for (const user of allUsers) {
                const member = guild.members.cache.get(user.userId) || 
                            await guild.members.fetch(user.userId).catch(() => null);
                if (member) filtered.push(user);
                if (filtered.length >= limit) break;
            }
            return filtered;
        } catch (error) {
            console.error('❌ Error en leaderboard por servidor:', error);
            return [];
        }
    }

    async getLevelLeaderboardByGuild(limit = 10, guildId, client) {
        try {
            const allUsers = await this.database.getLevelLeaderboard(limit * 5);
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return allUsers.slice(0, limit);
            
            const filtered = [];
            for (const user of allUsers) {
                const member = guild.members.cache.get(user.userId) || 
                            await guild.members.fetch(user.userId).catch(() => null);
                if (member) filtered.push(user);
                if (filtered.length >= limit) break;
            }
            return filtered;
        } catch (error) {
            console.error('❌ Error en leaderboard por servidor:', error);
            return [];
        }
    }

    async getTriviaLeaderboardByGuild(limit = 10, guildId, client) {
        try {
            const allUsers = await this.database.getTriviaLeaderboard(limit * 5);
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return allUsers.slice(0, limit);
            
            const filtered = [];
            for (const user of allUsers) {
                const member = guild.members.cache.get(user.userId) || 
                            await guild.members.fetch(user.userId).catch(() => null);
                if (member) filtered.push(user);
                if (filtered.length >= limit) break;
            }
            return filtered;
        } catch (error) {
            console.error('❌ Error en leaderboard por servidor:', error);
            return [];
        }
    }

    async getTriviaAccuracyLeaderboardByGuild(limit = 10, guildId, client) {
        try {
            const allUsers = await this.database.getTriviaAccuracyLeaderboard(limit * 5);
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return allUsers.slice(0, limit);
            
            const filtered = [];
            for (const user of allUsers) {
                const member = guild.members.cache.get(user.userId) || 
                            await guild.members.fetch(user.userId).catch(() => null);
                if (member) filtered.push(user);
                if (filtered.length >= limit) break;
            }
            return filtered;
        } catch (error) {
            console.error('❌ Error en leaderboard por servidor:', error);
            return [];
        }
    }

    async getTriviaPlayedLeaderboardByGuild(limit = 10, guildId, client) {
        try {
            const allUsers = await this.database.getTriviaPlayedLeaderboard(limit * 5);
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return allUsers.slice(0, limit);
            const filtered = [];
            for (const user of allUsers) {
                const member = guild.members.cache.get(user.userId) ||
                            await guild.members.fetch(user.userId).catch(() => null);
                if (member) filtered.push(user);
                if (filtered.length >= limit) break;
            }
            return filtered;
        } catch (error) {
            console.error('❌ Error en trivia played leaderboard por servidor:', error);
            return [];
        }
    }

    async getTriviaLeaderboard(limit = 10) {
        try {
            return await this.database.getTriviaLeaderboard(limit);
        } catch (error) {
            console.error('❌ Error obteniendo ranking de trivia:', error);
            return [];
        }
    }

    async getTriviaAccuracyLeaderboard(limit = 10) {
        try {
            return await this.database.getTriviaAccuracyLeaderboard(limit);
        } catch (error) {
            console.error('❌ Error obteniendo ranking de accuracy:', error);
            return [];
        }
    }

    async getTriviaPlayedLeaderboard(limit = 10) {
        try {
            return await this.database.getTriviaPlayedLeaderboard(limit);
        } catch (error) {
            console.error('❌ Error obteniendo ranking de partidas:', error);
            return [];
        }
    }

    async getTriviaSurvivalLeaderboard(limit = 10) {
        try {
            return await this.database.getTriviaSurvivalLeaderboard(limit);
        } catch (error) {
            console.error('❌ Error obteniendo ranking de supervivencia:', error);
            return [];
        }
    }

    // Verificar si puede usar daily
    async canUseDaily(userId, guildId = null) {
        const user = await this.getUser(userId);
        const now = Date.now();
        let dayInMs = 24 * 60 * 60 * 1000;
        let dayInMsAv = 26 * 60 * 60 * 1000;
        const prof = this.getProfession(user);

        // Aplicar reducción de cooldown por eventos
        for (const event of (this.events?.getActiveEvents(guildId) || [])) {
            if (event.type === 'fever_time') {
                dayInMs = Math.floor(dayInMs * 0.5); // 🔥 -50% tiempo
                break;
            }
            else if (event.type === 'market_crash') {
                dayInMs = Math.floor(dayInMs * 0.4); // 🔥 -40% tiempo
                break;
            }
            else if (event.type === 'server_anniversary') {
                dayInMs = Math.floor(dayInMs * 0.3); // 🔥 -30% tiempo
                break;
            }
        }

        // Aventurero: daily cada 26h
        if (prof?.dailyExtraHours) {
            return (now - user.last_daily) >= dayInMsAv;           
        }
        else
            return (now - user.last_daily) >= dayInMs;
    }

    // Usar comando daily
    async useDaily(userId, guildId = null) {
        if (!await this.canUseDaily(userId, guildId)) {
            const user = await this.getUser(userId);
            let timeLeft = 24 * 60 * 60 * 1000 - (Date.now() - user.last_daily);
            const prof = this.getProfession(user);

            if (prof?.dailyExtraHours) {
                timeLeft = 26 * 60 * 60 * 1000 - (Date.now() - user.last_daily);
            }

            return {
                success: false,
                timeLeft: timeLeft
            };
        }
        
        const user = await this.getUser(userId);
        const variation = Math.floor(Math.random() * (this.config.dailyVariation * 2)) - this.config.dailyVariation;
        let amount = Math.max(100, this.config.dailyAmount + variation);
        let eventMessage = '';
        let finalEarnings = amount;

        for (const event of (this.events?.getActiveEvents(guildId) || [])) {
            const dailyMultiplier = event.multipliers?.daily || 1.0;
            
            if (dailyMultiplier !== 1.0) {
                const baseAmount = amount;
                finalEarnings = Math.floor(baseAmount * dailyMultiplier);
                const diff = finalEarnings - baseAmount;
                
                if (diff > 0) {
                    eventMessage = `\n${event.emoji} **${event.name}** (+${diff} π-b$)`;
                } else {
                    eventMessage = `\n${event.emoji} **${event.name}** (${diff} π-b$)`; // Negativo
                }
                break;
            }
        }

        // Aplicar multiplicador de profesión al daily
        const prof = this.getProfession(user);
        if (prof?.dailyMult && prof.dailyMult !== 1.0) {
            finalEarnings = Math.floor(finalEarnings * prof.dailyMult);
        }

        // Toque Dorado (next daily boost)
        if (user.stats?.nextDailyBoost) {
            finalEarnings = Math.floor(finalEarnings * user.stats.nextDailyBoost);
            await this.updateUser(userId, {
                stats: { ...user.stats, nextDailyBoost: null }
            });
        }

        // Bonus de libros
        const bookBonuses = this.getBookBonuses(user);
        if (bookBonuses.dailyBonus > 0) {
            const bonus = Math.floor(finalEarnings * bookBonuses.dailyBonus);
            finalEarnings += bonus;
        }

        const addResult = await this.addMoney(userId, finalEarnings, 'daily_reward');
              
        const updateData = {
            last_daily: Date.now(),
            stats: {
                ...user.stats,
                dailyClaims: (user.stats?.dailyClaims || 0) + 1
            }
        }
        
        await this.updateUser(userId, updateData);

        // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
        if (this.achievements) {
            await this.achievements.updateStats(userId, 'daily_claimed');
        }
       
        await this.addPetXP(userId);

        const petBonus = await this.getPetBonus(userId, 'daily');

        return {
            success: true,
            amount: finalEarnings,
            professionBonus: prof ? { name: prof.name, mult: prof.dailyMult } : null,
            petBonus: petBonus > 0 ? { amount: petBonus, pet: await this.database.getEquippedPet(userId) } : null,
            oldBalance: user.balance - finalEarnings,
            newBalance: user.balance,
            eventMessage: eventMessage,
            finalEarnings: addResult.actualAmount,
            hitLimit: addResult.hitLimit
        };
    }

    // Sistema de trabajos
    async getWorkJobs() {
        return {
            'delivery': {
                name: '🚚 Delivery',
                cooldown: 2 * 60 * 60 * 1000, // 1 hora
                codeName: 'delivery',
                baseReward: 300,
                variation: 200,
                levelRequirement: 1,
                failChance: 0.05, // 5% de fallar
                messages: [
                    'Entregaste pizzas por toda la ciudad',
                    'Llevaste paquetes de Amazon sin perder ninguno',
                    'Hiciste delivery en bicicleta bajo la lluvia',
                    'Entregaste comida china en tiempo récord',
                    'Salvaste el día entregando medicinas'
                ],
                failMessages: [
                    'Te perdiste y llegaste tarde',
                    'Se te cayó la comida en el camino',
                    'El cliente no estaba en casa'
                ]
            },
            'barista_casino': {
                name: '🎰☕ Barista del Casino',
                cooldown: 2 * 60 * 60 * 1000, // 2 horas
                codeName: 'barista_casino',
                baseReward: 400,
                variation: 300,
                levelRequirement: 4,
                failChance: 0.18, // 18% de fallar
                messages: [
                    'Preparaste cafés VIP para jugadores de alto nivel',
                    'Un millonario dejó una enorme propina tras ganar el jackpot',
                    'Hiciste cócteles energéticos para toda la mesa de póker',
                    'Atendiste la barra durante una racha de suerte',
                    'Serviste café premium con oro comestible'
                ],
                failMessages: [
                    'Derramaste café sobre la mesa de blackjack',
                    'Un cliente perdió todo y se desquitó contigo',
                    'Te equivocaste en un pedido VIP y te descontaron del sueldo',
                    'Confundiste sal con azúcar en el café'
                ]
            },
            'pizzero': {
                name: '🍕 Pizzero',
                cooldown: 1.5 * 60 * 60 * 1000, // 1 hora y media
                codeName: 'pizzero',
                baseReward: 250,
                variation: 150,
                levelRequirement: 2,
                failChance: 0.08, // 8% de fallar
                messages: [
                    'Preparaste pizzas familiares sin quemarlas',
                    'Amasaste la masa perfectamente',
                    'Inventaste una nueva pizza especial del chef',
                    'Trabajaste en hora pico sin errores',
                    'Atendiste a clientes exigentes con éxito'
                ],
                failMessages: [
                    'Se te quemó la pizza en el horno',
                    'Olvidaste ponerle queso',
                    'Confundiste un pedido vegetariano con uno de pepperoni'
                ]
            },
            'programmer': {
                name: '💻 Programador',
                cooldown: 2 * 60 * 60 * 1000, // 1 hora
                codeName: 'programmer',
                baseReward: 500,
                variation: 300,
                levelRequirement: 5,
                failChance: 0.1, // 10% de fallar
                messages: [
                    'Desarrollaste una app exitosa',
                    'Solucionaste un bug crítico',
                    'Hiciste un bot de Discord increíble',
                    'Optimizaste una base de datos',
                    'Creaste un algoritmo eficiente'
                ],
                failMessages: [
                    'Tu código no compiló',
                    'Borraste la base de datos por accidente',
                    'El cliente odiló tu diseño'
                ]
            },
            'abrepuertasoxxo': {
                name: '🚪 Abre Puertas Oxxo',
                cooldown: 2 * 60 * 60 * 1000, // 3 hora
                codeName: 'abrepuertasoxxo',
                baseReward: 1500,
                variation: 1200,
                levelRequirement: 9,
                failChance: 0.55, // 55% de fallar
                messages: [
                    'Abriste las puertas correctamente',
                    'Apertura de puertas sin contratiempos',
                    'El mecanismo de apertura funcionó perfectamente.',
                    'Puertas abiertas y funcionamiento verificado'
                ],
                failMessages: [
                    'Abriste mal la puerta, ahora te llevaran los narcos',
                    'No abriste posible abrir las puertas del OXXO',
                    'Las puertas del OXXO permanecieron cerradas por falla del sistema'
                ]
            },
            'doctor': {
                name: '👨‍⚕️ Doctor',
                cooldown: 3 * 60 * 60 * 1000, // 1 hora
                codeName: 'doctor',
                baseReward: 800,
                variation: 400,
                levelRequirement: 10,
                failChance: 0.15, // 15% de fallar
                messages: [
                    'Salvaste vidas en el hospital',
                    'Realizaste una cirugía exitosa',
                    'Curaste a pacientes con tu experiencia',
                    'Trabajaste en urgencias toda la noche',
                    'Descubriste un nuevo tratamiento'
                ],
                failMessages: [
                    'Tuviste un día difícil en el hospital',
                    'El paciente no siguió tus instrucciones',
                    'Hubo complicaciones menores'
                ]
            },
            'botargadrsimi': {
                name: '🥼 Botarga de Doctor Simi',
                cooldown: 3 * 60 * 60 * 1000, // 1 hora
                codeName: 'botargadrsimi',
                baseReward: 1400,
                variation: 1000,
                levelRequirement: 12,
                failChance: 0.2, // 20% de fallar
                messages: [
                    'Animaste al público como estaba previsto',
                    'Presentación con la botarga realizada sin inconvenientes',
                    'La botarga de Doctor Simi estuvo en funcionamiento todo el evento',
                    'La botarga cumplió con el objetivo de animación y presencia'
                ],
                failMessages: [
                    'No se pudo realizar la presentación con la botarga de Doctor Simi por inconvenientes imprevistos',
                    'La botarga no estuvo disponible para el evento',
                    'La presentación con la botarga fue cancelada por problemas técnicos',
                    'No cumpliste el objetivo con la botarga de Doctor Simi'
                ]
            },        
            'criminal': {
                name: '🕵️ Actividad Sospechosa',
                cooldown: 4 * 60 * 60 * 1000, // 1 hora
                codeName: 'criminal',
                baseReward: 1200,
                variation: 800,
                levelRequirement: 15,
                failChance: 0.3, // 30% de fallar
                messages: [
                    'Encontraste un tesoro escondido',
                    'Tuviste un día de suerte en negocios turbios',
                    'Alguien te pagó por información valiosa',
                    'Ganaste en el mercado negro',
                    'Encontraste dinero perdido en la calle'
                ],
                failMessages: [
                    'Te pilló la policía y pagaste multa',
                    'El negocio salió mal',
                    'Te estafaron a ti primero',
                    'Tuviste que huir sin nada'
                ]
            },
            'vendedordelpunto': {
                name: '🚬 Vendedor del Punto',
                cooldown: 4 * 60 * 60 * 1000, // 1 hora
                codeName: 'vendedordelpunto',
                baseReward: 2500,
                variation: 3000,
                levelRequirement: 15,
                failChance: 0.35, // 35% de fallar
                messages: [
                    '¡Venta concretada con éxito! Cliente satisfecho y producto entregado',
                    'Excelente trabajo, lograste superar la meta del día',
                    'El cliente quedó encantado con tu atención, ¡muy bien hecho!',
                    'Transacción realizada sin inconvenientes, todo salió perfecto',
                    'Cerraste la venta de manera rápida y efectiva'
                ],
                failMessages: [
                    'La venta no se concretó: el cliente decidió no continuar',
                    'No se logró cerrar la transacción debido a falta de interés del cliente',
                    'El cliente pospuso la compra, será necesario hacer seguimiento',
                    'Problema en el proceso de pago, la venta no pudo finalizar',
                    'El cliente rechazó la propuesta'
                ]
            },
            'ofseller': {
                name: '👙 Vendedora de Nudes',
                cooldown: 4 * 60 * 60 * 1000, // 1 hora
                codeName: 'ofseller',
                baseReward: 2000,
                variation: 1600,
                levelRequirement: 20,
                failChance: 0.2, // 20% de fallar
                messages: [
                    'Vendiste contenido exclusivo a un cliente',
                    'Recibiste una propina generosa',
                    'Tuviste una sesión privada muy exitosa',
                    'Te contrataron para un evento especial',
                    'Recibiste elogios por tu trabajo'
                ],
                failMessages: [
                    'Un cliente se quejó de la calidad',
                    'Tuviste problemas técnicos durante la sesión',
                    'Un rival intentó sabotearte',
                    'Te quedaste dormida y el cliente se fue sin pagar'
                ]
            },
            'damadecomp': {
                name: '💋 Dama de Compañía',
                cooldown: 2 * 60 * 60 * 1000, // 2 horas
                codeName: 'damadecomp',
                baseReward: 2150,
                variation: 2400, // para que el pago vaya aprox. de 2150 a 2400
                levelRequirement: 23,
                failChance: 0.15, // 15% de fallar
                messages: [
                    'Atendiste a un cliente muy generoso',
                    'La noche fue larga, pero valió la pena',
                    'Te recomendaron con nuevos clientes',
                    'Cobraste extra por un servicio especial',
                    'Saliste del motel con los bolsillos llenos'
                ],
                failMessages: [
                    'El cliente se negó a pagar',
                    'Hubo una redada policial',
                    'El cliente desapareció sin dejar rastro'
                ]
            },
            'paranormalinv': {
                name: '👻 Investigador Paranormal',
                cooldown: 4 * 60 * 60 * 1000, // 1 hora
                codeName: 'paranormalinv',
                baseReward: 3000,
                variation: 2600,
                levelRequirement: 25,
                failChance: 0.30, // 30% de fallar
                messages: [
                    'Descubriste un fenómeno paranormal',
                    'Realizaste una investigación exitosa',
                    'Capturaste evidencia de lo sobrenatural',
                    'Tuviste una experiencia inquietante pero reveladora'
                ],
                failMessages: [
                    'No encontraste pruebas suficientes',
                    'Tuviste que abandonar la investigación',
                    'El fenómeno resultó ser un engaño',
                    'No lograste captar nada inusual'
                ]
            },

            'limpiador': {
                name: '🧹 Limpiador de Oficinas',
                cooldown: 1.5 * 60 * 60 * 1000,
                codeName: 'limpiador',
                baseReward: 200,
                variation: 100,
                levelRequirement: 1,
                failChance: 0.05,
                messages: [
                    'El gerente quedó tan impresionado que te dio propina',
                    'Limpiaste el edificio entero en tiempo récord',
                    'Encontraste y devolviste un objeto valioso, te recompensaron',
                    'El encargado te dio un bono por trabajo impecable',
                    'Terminaste temprano y te pagaron las horas extra'
                ],
                failMessages: [
                    'Volcaste el balde en la oficina del CEO',
                    'Perdiste las llaves del edificio',
                    'Rayaste el piso de mármol del lobby'
                ]
            },

            'paseador': {
                name: '🐕 Paseador de Perros',
                cooldown: 1.5 * 60 * 60 * 1000,
                codeName: 'paseador',
                baseReward: 280,
                variation: 150,
                levelRequirement: 2,
                failChance: 0.08,
                messages: [
                    'Todos los perros llegaron felices y sanos',
                    'Un dueño te dejó propina extra por cuidar tan bien a su mascota',
                    'Los perros te adoraron, te contrataron fijo',
                    'Evitaste que un perro se peleara, los dueños te felicitaron',
                    'Paseaste un perro famoso, saliste en redes sociales'
                ],
                failMessages: [
                    'Un perro se soltó y tardaste horas en encontrarlo',
                    'El Golden se revolcó en el lodo recién bañado',
                    'Te enredaste con 5 correas y caíste'
                ]
            },

            'streamer': {
                name: '🎮 Streamer',
                cooldown: 1.5 * 60 * 60 * 1000,
                codeName: 'streamer',
                baseReward: 350,
                variation: 200,
                levelRequirement: 3,
                failChance: 0.10,
                messages: [
                    'Tus viewers rompieron récord histórico',
                    'Una marca te ofreció sponsorship en pleno stream',
                    'Viral en Twitter por tu reacción épica',
                    'Raid sorpresa de otro streamer famoso',
                    'Donations llovieron durante toda la sesión'
                ],
                failMessages: [
                    'Tu internet se cayó a mitad del stream',
                    'Dijiste algo que te ganó un ban temporal',
                    'Nadie entró al stream hoy'
                ]
            },

            'bartender': {
                name: '🍺 Bartender',
                cooldown: 2 * 60 * 60 * 1000,
                codeName: 'bartender',
                baseReward: 450,
                variation: 250,
                levelRequirement: 6,
                failChance: 0.10,
                messages: [
                    'Una celebridad en el bar te dejó una propina enorme',
                    'Inventaste un cóctel que se hizo viral',
                    'Noche de viernes: propinas a tope',
                    'El dueño del bar te ofreció aumento por tu trabajo',
                    'Cerraste el bar con la mejor recaudación del mes'
                ],
                failMessages: [
                    'Derramaste una botella cara de whisky',
                    'Confundiste un pedido sin alcohol con uno con alcohol',
                    'Le serviste a alguien menor de edad sin verificar'
                ]
            },

            'uber': {
                name: '🚗 Taxista Uber',
                cooldown: 1.5 * 60 * 60 * 1000,
                codeName: 'uber',
                baseReward: 320,
                variation: 180,
                levelRequirement: 7,
                failChance: 0.08,
                messages: [
                    'Conseguiste 5 estrellas de todos tus pasajeros',
                    'Un ejecutivo te dejó propina de $50',
                    'Completaste el doble de viajes gracias a la zona de surge',
                    'Un pasajero te recomendó con todos sus contactos',
                    'Noche de concierto: viajes sin parar con surge pricing'
                ],
                failMessages: [
                    'Un pasajero te dio 1 estrella sin razón aparente',
                    'Te perdiste y el pasajero llegó tarde a su vuelo',
                    'Multa por estacionar mal frente al aeropuerto'
                ]
            },

            'croupier': {
                name: '🎲 Croupier',
                cooldown: 2.5 * 60 * 60 * 1000,
                codeName: 'croupier',
                baseReward: 600,
                variation: 350,
                levelRequirement: 8,
                failChance: 0.12,
                messages: [
                    'La mesa fue la más rentable del casino esta noche',
                    'Detectaste a un tramposo y ganaste un bono',
                    'Trabajaste en la mesa VIP con apuestas enormes',
                    'El casino tuvo una noche excelente gracias a tu gestión',
                    'Un jugador famoso estuvo en tu mesa y todo salió perfecto'
                ],
                failMessages: [
                    'Cometiste un error en el pago y el casino perdió dinero',
                    'No detectaste a alguien contando cartas',
                    'Tuviste un malentendido con un jugador VIP'
                ]
            },

            'mecanico': {
                name: '🔧 Mecanico',
                cooldown: 3 * 60 * 60 * 1000,
                codeName: 'mecanico',
                baseReward: 750,
                variation: 400,
                levelRequirement: 11,
                failChance: 0.12,
                messages: [
                    'Reparaste el auto más rápido de lo esperado',
                    'Diagnosticaste un problema que otros talleres no vieron',
                    'El cliente te trajo 3 carros más de sus familiares',
                    'Resolviste una emergencia en carretera, te pagaron el doble',
                    'Reparaste un auto de lujo y el dueño quedó impresionado'
                ],
                failMessages: [
                    'Una pieza que instalaste falló y tuviste que rehacer el trabajo',
                    'Olvidaste apretar un tornillo importante',
                    'El cliente reclamó por un problema que no existía'
                ]
            },

            'contador': {
                name: '📊 Contador',
                cooldown: 4 * 60 * 60 * 1000,
                codeName: 'contador',
                baseReward: 3500,
                variation: 2500,
                levelRequirement: 28,
                failChance: 0.35,
                messages: [
                    'Los libros cuadraron perfectamente... esta vez',
                    'Encontraste una deducción que nadie más había visto',
                    'La auditoría pasó sin problemas gracias a tu preparación',
                    'El cliente ahorró una fortuna en impuestos legalmente',
                    'Cerraste el año fiscal con todos los números en verde'
                ],
                failMessages: [
                    'La auditoría encontró irregularidades',
                    'Los libros no cuadraron y tuviste que pagar la diferencia',
                    'Un error en la declaración generó una multa'
                ]
            },

            'joyero': {
                name: '💎 Joyero',
                cooldown: 3.5 * 60 * 60 * 1000,
                codeName: 'joyero',
                baseReward: 2800,
                variation: 2000,
                levelRequirement: 30,
                failChance: 0.15,
                messages: [
                    'Valuaste un diamante rarísimo que resultó valer una fortuna',
                    'Diseñaste una joya personalizada que el cliente pagó premium',
                    'Reparaste una joya familiar de valor sentimental incalculable',
                    'Un coleccionista llegó con piezas únicas y pagó bien',
                    'Vendiste el collar más caro de tu carrera'
                ],
                failMessages: [
                    'Rayaste un diamante valioso con el equipo',
                    'Confundiste un rubí con granate y el cliente se molestó',
                    'Perdiste una gema pequeña en el taller'
                ]
            },

            'actor_porno': {
                name: '🎬 Actor',
                cooldown: 5 * 60 * 60 * 1000,
                codeName: 'actor_porno',
                baseReward: 4500,
                variation: 3000,
                levelRequirement: 35,
                failChance: 0.20,
                messages: [
                    'La escena quedó perfecta al primer intento',
                    'El director quedó tan satisfecho que duplicó tu pago',
                    'Tu actuación fue la más vista del mes en la plataforma',
                    'Te nominaron al premio del año en tu categoría',
                    'Una marca premium quiso patrocinarte'
                ],
                failMessages: [
                    'Tuviste un bloqueo creativo en el momento más importante',
                    'El director no quedó satisfecho con tu actuación',
                    'Problemas técnicos arruinaron toda la sesión de grabación'
                ]
            },

            'sicario': {
                name: '🎯 Sicario',
                cooldown: 6 * 60 * 60 * 1000,
                codeName: 'sicario',
                baseReward: 8000,
                variation: 5000,
                levelRequirement: 40,
                failChance: 0.45,
                messages: [
                    'Contrato completado sin dejar rastro',
                    'Operacion perfecta, el cliente quedo satisfecho',
                    'Trabajo limpio, pago inmediato',
                    'Nadie supo que estuviste ahi',
                    'Mision cumplida antes del tiempo acordado'
                ],
                failMessages: [
                    'Te detectaron y tuviste que abandonar la operacion',
                    'El objetivo tenia proteccion adicional no prevista',
                    'Algo salio muy mal y perdiste parte del anticipo',
                    'Tuviste que sobornar a alguien para escapar'
                ]
            }
        };
    }

    // Verificar si puede trabajar
    async canWork(userId, jobType, guildId = null) {
        const user = await this.getUser(userId);
        const jobs = await this.getWorkJobs();
        const job = jobs[jobType];
        
        if (!job) return { canWork: false, reason: 'invalid_job' };
        
        if (user.level < job.levelRequirement) {
            return { canWork: false, reason: 'level_too_low', requiredLevel: job.levelRequirement };
        }
       
        const modifiers = await this.shop.getActiveMultipliers(userId, 'work');
        const lastWork = user.last_work || 0;
        const now = Date.now();

        // Usar el cooldown del trabajo que realmente hizo, no el que intenta usar
        const lastJobType = user.last_job_type || jobType;
        const lastJob = jobs[lastJobType] || job;

        let effectiveCooldown = lastJob.cooldown * (1 - modifiers.reduction);

        for (const event of (this.events?.getActiveEvents(guildId) || [])) {
            if (event.type === 'fever_time') {
                effectiveCooldown = Math.floor(job.cooldown * 0.5); // 🔥 -50% tiempo
                break;
            }
            else if (event.type === 'market_crash') {
                effectiveCooldown = Math.floor(job.cooldown * 0.4); // 🔥 -40% tiempo
                break;
            }
            else if (event.type === 'server_anniversary') {
                effectiveCooldown = Math.floor(job.cooldown * 0.3); // 🔥 -30% tiempo
                break;
            }
        }

        if (this.shop) {
            // En lugar de agregar hasNoCooldownActive, usa getCooldownReduction
            const cooldownReduction = await this.shop.getCooldownReduction(userId, 'work');
            effectiveCooldown = Math.floor(effectiveCooldown * (1 - cooldownReduction));
        }

        // Reducción de cooldown por libros
        const bookBonusesWork = this.getBookBonuses(user);
        if (bookBonusesWork.workCooldown > 0) {
            effectiveCooldown = Math.floor(effectiveCooldown * (1 - bookBonusesWork.workCooldown));
        }

        if (now - lastWork < effectiveCooldown) {
            const timeLeft = effectiveCooldown - (now - lastWork);
            // Usar el nombre del último trabajo hecho, no el que se intenta usar
            const lastJobName = user.last_name_work || job.name;
            return { canWork: false, reason: 'cooldown', timeLeft: timeLeft, name: lastJobName };
        }
        
        return { canWork: true };
    }

    // Después del método canWork(), AGREGAR:
    async applyWorkItemEffects(userId, baseAmount, jobCooldown) {
        if (!this.shop) return { amount: baseAmount, cooldown: jobCooldown };
        
        let finalAmount = baseAmount;
        let finalCooldown = jobCooldown;
        
        const modifiers = await this.shop.getActiveMultipliers(userId, 'work');
        
        // Aplicar multiplicadores de dinero
        finalAmount = Math.floor(finalAmount * modifiers.multiplier);
        
        // Aplicar reducción de cooldown
        finalCooldown = Math.floor(finalCooldown * (1 - modifiers.reduction));
        
        // Consumir efectos de uso limitado
        await this.shop.consumeItemUse(userId, 'work');
        
        return { amount: finalAmount, cooldown: finalCooldown };
    }

    async doWork(userId, jobType, guildId = null) {
        const canWorkResult = await this.canWork(userId, jobType, guildId);
        if (!canWorkResult.canWork) {
            return {
                name: canWorkResult.name,
                canWork: canWorkResult.canWork,
                reason: canWorkResult.reason,
                requiredLevel: canWorkResult.requiredLevel,
                timeLeft: canWorkResult.timeLeft || 0,
                canWorkResult: canWorkResult
            };
        }

        const user = await this.getUser(userId);
        const jobs = await this.getWorkJobs();
        const job = jobs[jobType];

        // Guardar cooldown inmediatamente
        const updateData = {
            last_work: Date.now(),
            last_job_type: jobType,
            last_name_work: job.name,
            stats: {
                ...user.stats,
                work_count: (user.stats?.work_count || 0) + 1
            }
        };
        await this.updateUser(userId, updateData);

        // Calcular recompensa base
        const variation = Math.floor(Math.random() * job.variation) - Math.floor(job.variation * 0.3);
        let amount = Math.max(job.baseReward * 0.5, job.baseReward + variation);
        const message = job.messages[Math.floor(Math.random() * job.messages.length)];
        const failMessage = job.failMessages[Math.floor(Math.random() * job.failMessages.length)];
        let finalEarnings = amount;
        let eventMessage = '';

        // Aplicar eventos
        for (const event of (this.events?.getActiveEvents(guildId) || [])) {
            const workMultiplier = event.multipliers?.work || 1.0;
            if (workMultiplier !== 1.0) {
                const baseAmount = amount;
                finalEarnings = Math.floor(baseAmount * workMultiplier);
                const diff = finalEarnings - baseAmount;
                eventMessage = diff > 0
                    ? `${event.emoji} **${event.name}** (+${diff} π-b$)`
                    : `${event.emoji} **${event.name}** (${diff} π-b$)`;
                break;
            }
        }

        // Aplicar picos
        let pickaxeMessage = '';
        if (this.shop) {
            const pickaxeBonus = await this.shop.applyPickaxeBonus(userId);
            if (pickaxeBonus.applied) {
                const beforePickaxe = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * pickaxeBonus.multiplier);
                const item = this.shop.shopItems[pickaxeBonus.itemId];
                if (item?.category === 'tool') {
                    pickaxeMessage = pickaxeBonus.itemId === 'eternal_pickaxe'
                        ? `**${pickaxeBonus.name}** (+${finalEarnings - beforePickaxe} π-b$) | Durabilidad: ♾️ Infinita`
                        : `**${pickaxeBonus.name}** (+${finalEarnings - beforePickaxe} π-b$) | Durabilidad: ${pickaxeBonus.durabilityLeft}/${item.effect.durability} (-${pickaxeBonus.durabilityLost})`;
                } else {
                    pickaxeMessage = `**${pickaxeBonus.name}** (+${finalEarnings - beforePickaxe} π-b$) | Usos restantes: ${pickaxeBonus.usesLeft}`;
                }
            }
        }

        // Aplicar equipamiento
        let equipmentMessage = '';
        if (this.shop) {
            const equipmentBonus = await this.shop.applyEquipmentBonus(userId);
            if (equipmentBonus.applied) {
                const extraMoney = Math.floor(finalEarnings * equipmentBonus.money);
                finalEarnings += extraMoney;
                for (const equip of equipmentBonus.items) {
                    equipmentMessage += `\n${equip.wasBroken ? '💔' : '🛡️'} **${equip.name}**: `;
                    equipmentMessage += equip.wasBroken
                        ? `¡SE ROMPIÓ! (era ${equip.durabilityLost})`
                        : `Durabilidad: ${equip.durabilityLeft}/${equip.maxDurability} (-${equip.durabilityLost})`;
                }
                if (extraMoney > 0) {
                    equipmentMessage = `\n💰 Bonus equipamiento: +${this.formatNumber(extraMoney)} π-b$${equipmentMessage}`;
                }
            }
        }

        // Aplicar multiplicadores de items
        let itemMessage = '';
        if (this.shop) {
            const modifiers = await this.shop.getActiveMultipliers(userId, 'work');
            if (modifiers.multiplier > 1) {
                const beforeItems = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * modifiers.multiplier);
                itemMessage = `✨ **Items Activos** (+${finalEarnings - beforeItems} π-b$)`;
            }
            await this.shop.consumeItemUse(userId, 'work');
        }

        // Aplicar VIP
        let vipMessage = '';
        if (this.shop) {
            const vipMultipliers = await this.shop.getVipMultipliers(userId, 'work');
            if (vipMultipliers.multiplier > 1) {
                const beforeVip = finalEarnings;
                finalEarnings = Math.floor(finalEarnings * vipMultipliers.multiplier);
                vipMessage = `👑 **VIP Activo** (+${finalEarnings - beforeVip} π-b$)`;
                await this.shop.updateVipStats(userId, 'bonusEarnings', finalEarnings - beforeVip);
            }
        }

        const allBonusMessages = [eventMessage, pickaxeMessage, equipmentMessage, itemMessage, vipMessage].filter(msg => msg !== '');

        // Drop raro del mapa del tesoro (~1%)
        let droppedMap = false;
        if (Math.random() < 0.01) {
            droppedMap = true;
        }

        return {
            canWork: true,
            needsMinigame: true,
            success: true,
            jobName: job.name,
            jobType: jobType,
            message: message,
            failMessage: failMessage,
            amount: amount,
            finalEarnings: finalEarnings,
            currentStreak: this.workStreaks?.get(userId)?.streak || 0,
            eventMessage: eventMessage,
            pickaxeMessage: pickaxeMessage,
            equipmentMessage: equipmentMessage,
            itemMessage: itemMessage,
            vipMessage: vipMessage,
            allBonusMessages: allBonusMessages,
            droppedMap: droppedMap,
        };
    }

    async applyWorkResult(userId, jobType, earnedAmount, minigameSuccess) {
        const user = await this.getUser(userId);
        const streakData = this.workStreaks.get(userId) || { streak: user.stats?.workStreak || 0 };

        const illegalJobs = ['criminal', 'vendedordelpunto', 'damadecomp', 'sicario', 'contador'];
        const bonuses = [
            { streak: 10, bonus: 0.40, label: '🔥🔥🔥 ¡RACHA LEGENDARIA! +40%' },
            { streak: 5,  bonus: 0.25, label: '🔥🔥 ¡Racha increíble! +25%' },
            { streak: 3,  bonus: 0.15, label: '🔥 ¡En racha! +15%' },
        ];

        let finalAmount = earnedAmount;
        let newStreak = streakData.streak;
        // Aplicar multiplicador de profesión
        const prof = this.getProfession(user);
        if (prof?.workMult && prof.workMult !== 1.0) {
            finalAmount = Math.floor(finalAmount * prof.workMult);
        }

        // Frenesí Laboral (next work boost)
        if (user.stats?.nextWorkBoost && minigameSuccess) {
            finalAmount = Math.floor(finalAmount * user.stats.nextWorkBoost);
            await this.updateUser(userId, {
                stats: { ...user.stats, nextWorkBoost: null }
            });
        }

        // Bonus de libros
        const bookBonuses = this.getBookBonuses(user);
        if (bookBonuses.workBonus > 0) {
            finalAmount = Math.floor(finalAmount * (1 + bookBonuses.workBonus));
        }
        let streakBonusApplied = 0;
        let streakBonusLabel = '';

        if (minigameSuccess) {     
            newStreak = (streakData.streak || 0) + 1;
            for (const b of bonuses) {
                if (newStreak >= b.streak) {
                    streakBonusApplied = Math.floor(finalAmount * b.bonus);
                    finalAmount += streakBonusApplied;
                    streakBonusLabel = b.label;
                    break;
                }
            }
        } else {
            newStreak = 0;
        }

        this.workStreaks.set(userId, { streak: newStreak, lastJob: jobType });

        let addResult;
        if (finalAmount >= 0) {
            addResult = await this.addMoney(userId, finalAmount, 'work_reward');
        } else {
            await this.removeMoney(userId, Math.abs(finalAmount), 'work_penalty');
            const updatedUser = await this.getUser(userId);
            addResult = { newBalance: updatedUser.balance, actualAmount: finalAmount, hitLimit: false };
        }

        await this.updateUser(userId, {
            stats: {
                ...user.stats,
                totalEarned: (user.stats?.totalEarned || 0) + Math.max(0, finalAmount),
                workStreak: newStreak
            }
        });

        // XP para mascotas
        const petEvolutions = await this.addPetXP(userId);
        const petBonus = await this.getPetBonus(userId, 'work');

        return {
            finalAmount,
            newBalance: addResult.newBalance,
            newStreak,
            streakBonusApplied,
            streakBonusLabel,
            hitLimit: addResult.hitLimit || false,
            professionBonus: prof ? { name: prof.name, mult: prof.workMult } : null,
            petEvolutions,
            petBonus: petBonus > 0 ? { amount: petBonus, pet: await this.database.getEquippedPet(userId) } : null,
        };
    }
    
    
    // Después del método getUserNumber(), AGREGAR:
    formatBonusMessages(eventMsg, itemMsg, vipMsg) {
        const messages = [eventMsg, itemMsg, vipMsg].filter(msg => msg && msg.trim() !== '');
        
        if (messages.length === 0) {
            return "No hay bonificaciones activas";
        }
        
        return messages.join('\n');
    }

    // PROBLEMA 1: Prevenir transferencias durante robos activos
    // Agrega este método a tu clase EconomySystem:

    // Verificar si un usuario está siendo robado
    isBeingRobbed(userId) {
        for (const [robberId, robberyData] of this.activeRobberies) {
            if (robberyData.targetId === userId) {
                const now = Date.now();
                const timeElapsed = now - robberyData.startTime;
                
                // Solo si el robo está dentro del tiempo límite
                if (timeElapsed <= this.robberyConfig.buttonTimeLimit) {
                    return {
                        beingRobbed: true,
                        robberId: robberId,
                        timeLeft: this.robberyConfig.buttonTimeLimit - timeElapsed
                    };
                }
            }
        }
        return { beingRobbed: false };
    }
    
    // Verificar si puede robar
    async canRob(robberId, targetId) {
        const robber = await this.getUser(robberId);
        const target = await this.getUser(targetId);
        
        // No puede robarse a sí mismo
        if (robberId === targetId) {
            return { canRob: false, reason: 'self_target' };
        }
        
        // Verificar nivel mínimo
        if (robber.level < this.robberyConfig.levelRequirement) {
            return { 
                canRob: false, 
                reason: 'level_too_low', 
                requiredLevel: this.robberyConfig.levelRequirement 
            };
        }
        
        // Verificar que el objetivo tenga suficiente dinero
        if (target.balance < this.robberyConfig.minTargetBalance) {
            return { 
                canRob: false, 
                reason: 'target_too_poor', 
                minBalance: this.robberyConfig.minTargetBalance 
            };
        }

        if (robber.balance >= this.config.maxBalance) {
            return {
                canRob: false,
                reason: 'robber_rich',
                maxBalance: this.config.maxBalance
            }
        }
       
        // Verificar cooldown
        const lastRobbery = robber.last_robbery || 0;
        const now = Date.now();
        
        // Aplicar cooldown de profesión
        const robberProf = this.getProfession(robber);
        if (robberProf?.robAlwaysFail) {
            return { canRob: false, reason: 'profession_block' };
        }
        const bookBonuses = this.getBookBonuses(robber);
        const robCooldown = Math.floor(
            this.robberyConfig.cooldown * 
            (1 - (bookBonuses?.robCooldown || 0)) *
            (robberProf?.robCooldownMult || 1.0)
        );
        if (now - lastRobbery < robCooldown) {
            const timeLeft = robCooldown - (now - lastRobbery);
            return { canRob: false, reason: 'cooldown', timeLeft: timeLeft };
        }
        
        // Verificar si ya hay un robo activo para este usuario
        if (this.activeRobberies.has(robberId)) {
            return { canRob: false, reason: 'already_robbing' };
        }
       
        return { canRob: true };
    }

    // 5. Limpiar efectos expirados (ejecutar cada minuto)
    async cleanupExpiredEffects() {
        console.log('🧹 Limpiando efectos expirados...');
        
        // Obtener todos los usuarios con efectos activos
        const users = await this.getAllUsersWithEffects(); // Implementar según tu DB
        
        for (const user of users) {
            const activeEffects = user.activeEffects || {};
            let hasChanges = false;
            
            for (const [itemId, effects] of Object.entries(activeEffects)) {
                const validEffects = effects.filter(effect => {
                    if (!effect.expiresAt) return true; // Efectos permanentes o por usos
                    return effect.expiresAt > Date.now(); // No expirados
                });
                
                if (validEffects.length !== effects.length) {
                    if (validEffects.length === 0) {
                        delete activeEffects[itemId];
                    } else {
                        activeEffects[itemId] = validEffects;
                    }
                    hasChanges = true;
                }
            }
            
            if (hasChanges) {
                await this.updateUser(user.id, { activeEffects });
            }
        }
    }

    // Iniciar un robo
    async startRobbery(robberId, targetId, message) {
        try {
            console.log(`🎯 Intentando iniciar robo: ${robberId} -> ${targetId}`);
            
            const canRobResult = await this.canRob(robberId, targetId);
            console.log(`🔍 Resultado de canRob:`, canRobResult);
            
            if (!canRobResult.canRob) {
                console.log(`❌ No puede robar - Razón: ${canRobResult.reason}`);
                return canRobResult;
            }

            // Verificar si ya hay un robo activo (doble verificación)
            if (this.activeRobberies.has(robberId)) {
                console.log(`❌ Ya hay robo activo para ${robberId}`);
                return { success: false, reason: 'already_robbing' };
            }

            // AGREGAR ESTA VERIFICACIÓN:
            if (this.shop) {
                const protection = await this.shop.getTheftProtection(targetId);
                const robber = await this.getUser(robberId);

                if (protection.protected) {
                    const robberProtection = await this.shop.hasGameProtection(robberId);

                    let actualPenalty = 0;
                    let protectionMessage = '';

                    if (robberProtection) {
                        protectionMessage = '🛡️ Tu Fortune Shield te protegió de la penalización!';
                    } else {
                        actualPenalty = Math.floor(robber.balance * (this.robberyConfig.penaltyPercentage / 100));
                    }

                    const robberUpdateData = {
                        last_robbery: Date.now(),
                        balance: Math.max(0, robber.balance - actualPenalty),
                        stats: {
                            ...robber.stats,
                            robberies: (robber.stats.robberies || 0) + 1,
                            totalSpent: (robber.stats.totalSpent || 0) + actualPenalty,
                        },
                    };
                    
                    await this.updateUser(robberId, robberUpdateData);
                    
                    return { 
                        canRob: false,  // ← Está bien
                        reason: 'target_protected',  // ← Está bien 
                        protectionType: protection.type,  // ← Está bien
                        penalty: actualPenalty,  // ← CAMBIAR penaltyBal por penalty
                        robberProtection: protectionMessage  // ← Verificar que se esté guardando
                    };
                } else {
                    if (protection.type === 'vault_failed') {
                        // Mostrar mensaje de bóveda fallida
                        await message.channel.send('🏦💥 **¡La bóveda de seguridad falló!** El robo continúa...');
                    }
                }
            }
            
            // Crear datos del robo activo
            const robberyData = {
                robberId: robberId,
                targetId: targetId,
                startTime: Date.now(),
                clicks: 0,
                maxClicks: this.robberyConfig.maxClicks,
                timeLimit: this.robberyConfig.buttonTimeLimit
            };
            
            console.log(`📊 Datos del robo creados:`, robberyData);
            
            this.activeRobberies.set(robberId, robberyData);
            console.log(`✅ Robo agregado al Map. Total activos: ${this.activeRobberies.size}`);
            
            // Auto-cleanup — cubre fase 1 (clicks 30s) + fase 2 (minijuego hasta 25s) + margen
            setTimeout(() => {
                if (this.activeRobberies.has(robberId)) {
                    console.log(`🧹 Auto-cleanup de robo expirado: ${robberId}`);
                    this.activeRobberies.delete(robberId);
                }
            }, this.robberyConfig.buttonTimeLimit + 30000); // 30s extra para el minijuego
            
            console.log(`🎉 Robo iniciado exitosamente para ${robberId}`);
            return {
                success: true,
                robberyData: robberyData
            };
            
        } catch (error) {
            console.error(`❌ ERROR en startRobbery:`, error);
            return { 
                success: false, 
                reason: 'start_error',
                error: error.message 
            };
        }
    }
    
    // Procesar click en botón de robo
    async processRobberyClick(robberId) {
        const robberyData = this.activeRobberies.get(robberId);
        
        if (!robberyData) {
            console.log(`⚠️ No hay robo activo para ${robberId}`);
            return { success: false, reason: 'no_active_robbery' };
        }
        
        const now = Date.now();
        const timeElapsed = now - robberyData.startTime;
        
        // Verificar si se acabó el tiempo
        if (timeElapsed > this.robberyConfig.buttonTimeLimit) {
            console.log(`⏰ Tiempo expirado para robo de ${robberId}`);
            return { success: false, reason: 'time_expired' };
        }
        
        // Incrementar clicks
        robberyData.clicks++;
        console.log(`👆 Click ${robberyData.clicks}/${this.robberyConfig.maxClicks} para ${robberId}`);

        
        // Verificar si llegó al máximo
        if (robberyData.clicks >= this.robberyConfig.maxClicks) {
            // Finalizar robo automáticamente
            console.log(`🎯 Máximo de clicks alcanzado para ${robberId}`);

            return {
                success: true,
                clicks: robberyData.clicks,
                maxClicks: robberyData.maxClicks,
                timeLeft: this.robberyConfig.buttonTimeLimit - timeElapsed,
                maxReached: true
            }
        }
        
        return {
            success: true,
            clicks: robberyData.clicks,
            maxClicks: robberyData.maxClicks,
            timeLeft: this.robberyConfig.buttonTimeLimit - timeElapsed,
            maxReached: false
        };
    }
    
    // Finalizar robo y calcular resultado
    async finishRobbery(robberId, minigameSuccess = null) {
        console.log(`🎯 Finalizando robo para usuario: ${robberId}`);

        const robberyData = this.activeRobberies.get(robberId);
        
        if (!robberyData) {
            console.log(`⚠️ No se encontró robo activo para ${robberId}`);
            return { success: false, reason: 'no_active_robbery' };
        }

        console.log(`📊 Datos del robo:`, robberyData);
        
        this.activeRobberies.delete(robberId);

        try {
            const robber = await this.getUser(robberId);
            const target = await this.getUser(robberyData.targetId);

            console.log(`👤 Robber balance: ${robber.balance}, Target balance: ${target.balance}`);

            // *** VERIFICACIÓN ADICIONAL: El target aún tiene dinero suficiente ***
            if (target.balance < this.robberyConfig.minTargetBalance) {
                console.log(`⚠️ Target ya no tiene suficiente dinero para robar`);
                return { 
                    success: false, 
                    reason: 'target_too_poor_now',
                    targetBalance: target.balance,
                    minRequired: this.robberyConfig.minTargetBalance
                };
            }
            
            const clickEfficiency = Math.min(robberyData.clicks / this.robberyConfig.maxClicks, 1);

            // Obtener items usados (solo para mostrar en resultado)
            let usedItems = [];
            if (this.shop) {
                const user = await this.getUser(robberId);
                const activeEffects = this.shop.parseActiveEffects(user.activeEffects);
                const robberyItems = ['master_gloves', 'phantom_gloves', 'robbery_kit'];
                for (const itemId of robberyItems) {
                    if (activeEffects[itemId] && activeEffects[itemId].length > 0) {
                        for (const effect of activeEffects[itemId]) {
                            if (effect.usesLeft > 0 || effect.safe === true) {
                                const item = this.shop.shopItems[itemId];
                                if (item) {
                                    usedItems.push({
                                        id: itemId,
                                        name: item.name,
                                        boost: effect.successRate || effect.boost || 0,
                                        safe: effect.safe || false
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Consumir usos de items de robo
            if (this.shop) {
                await this.shop.consumeRobberyItems(robberId);
            }

            // El éxito lo determina el minijuego (pasado como parámetro)
            // Si minigameSuccess es null, significa que fue phantom_gloves (éxito garantizado)
            const success = minigameSuccess === null ? true : minigameSuccess;

            console.log(`✅ Resultado del minijuego: ${success ? 'ÉXITO' : 'FALLO'} | Clicks efficiency: ${Math.round(clickEfficiency * 100)}%`);
            
            // Actualizar cooldown del ladrón
            const robberUpdateData = {
                last_robbery: Date.now(),
                stats: {
                    ...robber.stats,
                    robberies: (robber.stats.robberies || 0) + 1,
                },
            };
            
            if (success) {
                // ROBO EXITOSO
                // Calcular cantidad robada basada en clicks
                const minSteal = this.robberyConfig.minStealPercentage / 100;
                const maxSteal = this.robberyConfig.maxStealPercentage / 100;
             
                // Bonus de libros al robo
                const bookBonuses = this.getBookBonuses(robber);
                const adjustedMaxSteal = maxSteal + (bookBonuses.robBonus || 0);

                const stealPercentage = minSteal + (clickEfficiency * (adjustedMaxSteal - minSteal));
                const stolenAmount = Math.floor(target.balance * stealPercentage);
                
                if (stolenAmount <= 0) {
                    console.log(`⚠️ Cantidad robada es 0, target muy pobre`);
                    return { success: false, reason: 'target_too_poor_now' };
                }

                const addResult = await this.addMoney(robberId, stolenAmount, 'rob_reward');
                
                // Actualizar balances
                robberUpdateData.stats = {
                    ...robber.stats,
                    robberies_successful: (robber.stats.robberies_successful || 0) + 1,
                    moneyStolen: (robber.stats.moneyStolen || 0) + stolenAmount,
                };                
                
                const targetUpdateData = {
                    balance: Math.max(0, target.balance - stolenAmount),
                    stats: {
                        ...target.stats,
                        totalSpent: (target.stats.totalSpent || 0) + stolenAmount,
                        timesRobbed: (target.stats.timesRobbed || 0) + 1,
                        money_lost_to_robbers: (target.stats.money_lost_to_robbers || 0) + stolenAmount
                    }                
                };
                
                await this.updateUser(robberId, robberUpdateData);
                await this.updateUser(robberyData.targetId, targetUpdateData);
                
                console.log(`🦹 Robo exitoso: ${robberId} robó ${stolenAmount} ${this.config.currencySymbol} a ${robberyData.targetId}`);

                // *** NUEVO: ACTUALIZAR MISIONES ***
                if (this.missions) {
                    await this.missions.updateMissionProgress(robberId, 'successful_robbery');
                }
                
                return {
                    success: true,
                    robberySuccess: true,
                    stolenAmount: stolenAmount,
                    clicks: robberyData.clicks,
                    maxClicks: this.robberyConfig.maxClicks,
                    efficiency: Math.round(clickEfficiency * 100),
                    robberOldBalance: robber.balance,
                    robberNewBalance: addResult.newBalance,
                    targetOldBalance: target.balance,
                    targetNewBalance: Math.max(0, target.balance - stolenAmount),
                    targetId: robberyData.targetId,
                    stealPercentage: Math.round(stealPercentage * 100),
                    hitLimit: addResult.hitLimit,
                    usedItems: usedItems
                };
                
            } else {
                // ROBO FALLIDO
                console.log(`❌ Robo fallido!`);

                // Verificar protección contra penalizaciones
                let actualPenalty = 0;
                let protectionMessage = '';

                const hasProtection = await this.shop.hasGameProtection(robberId);
                if (hasProtection) {
                    protectionMessage = '🛡️ Tu Fortune Shield te protegió de la penalización!';
                    console.log(`🛡️ ${robberId} protegido por Fortune Shield`);
                } else {
                    actualPenalty = Math.floor(robber.balance * (this.robberyConfig.penaltyPercentage / 100));
                    robberUpdateData.balance = Math.max(0, robber.balance - actualPenalty);
                    robberUpdateData.stats = {
                        ...robber.stats,
                        totalSpent: (robber.stats.totalSpent || 0) + actualPenalty,
                    };
                }

                await this.updateUser(robberId, robberUpdateData);
                
                console.log(`🚨 Robo fallido: ${robberId} perdió ${actualPenalty} ${this.config.currencySymbol} como penalización`);
                
                return {
                    success: true,
                    robberySuccess: false,
                    penalty: actualPenalty,
                    protectionMessage: protectionMessage,
                    clicks: robberyData.clicks,
                    maxClicks: this.robberyConfig.maxClicks,
                    efficiency: Math.round(clickEfficiency * 100),
                    robberOldBalance: robber.balance,
                    robberNewBalance: Math.max(0, robber.balance - actualPenalty),
                    targetId: robberyData.targetId,
                    usedItems: usedItems
                };
            }
        } catch (error) {
            console.error(`❌ Error procesando robo:`, error);
            // Volver a agregar al Map si hubo error
            this.activeRobberies.set(robberId, robberyData);
            return { success: false, reason: 'processing_error', error: error.message };
        }
    }
    
    getBookBonuses(user) {
        return user.stats?.bookBonuses || {
            dailyBonus: 0,
            workBonus: 0,
            robBonus: 0,
            workCooldown: 0,
            robCooldown: 0,
            minigameBonus: 0,
            recipes: []
        };
    }

    async buyBook(userId, bookId) {
        const book = this.BOOKS[bookId];
        if (!book) return { success: false, reason: 'invalid_book' };

        const user = await this.getUser(userId);

        // Verificar si ya lo leyó
        const readBooks = await this.database.getReadBooks(userId);
        if (readBooks.includes(bookId)) return { success: false, reason: 'already_read' };

        // Verificar si está leyendo algo
        const current = await this.database.getCurrentReading(userId);
        if (current) return { success: false, reason: 'already_reading', book: current };

        // Verificar cooldown (12h desde último libro completado)
        const lastCompleted = await this.database.getLastCompleted(userId);
        if (lastCompleted) {
            const cooldownLeft = (lastCompleted.finishes_at + 12 * 60 * 60 * 1000) - Date.now();
            if (cooldownLeft > 0) return { success: false, reason: 'cooldown', timeLeft: cooldownLeft };
        }

        // Verificar balance
        if (user.balance < book.price) return { success: false, reason: 'too_poor', price: book.price };

        // Cobrar y empezar lectura
        await this.removeMoney(userId, book.price, 'library_book');
        const finishesAt = Date.now() + /*book.readHours * 60 * 60 * 1000*/20000;
        await this.database.startReading(userId, bookId, finishesAt);

        return { success: true, book, finishesAt };
    }

    async checkCompletedBooks(userId) {
        const completed = await this.database.getCompletedUnnotified(userId);
        if (completed.length === 0) return [];

        const user = await this.getUser(userId);
        const bookBonuses = this.getBookBonuses(user);
        const notifications = [];

        for (const reading of completed) {
            const book = this.BOOKS[reading.book_id];
            if (!book) continue;

            // Aplicar efecto
            if (book.effect.type === 'recipe') {
                if (!bookBonuses.recipes) bookBonuses.recipes = [];
                if (!bookBonuses.recipes.includes(book.effect.recipeId)) {
                    bookBonuses.recipes.push(book.effect.recipeId);
                }
            } else {
                bookBonuses[book.effect.type] = (bookBonuses[book.effect.type] || 0) + book.effect.value;
            }

            await this.database.completeReading(reading.id);
            notifications.push(book);
        }

        await this.updateUser(userId, {
            stats: { ...user.stats, bookBonuses }
        });

        return notifications;
    }

    getProfession(user) {
        if (!user.profession) return null;
        return this.PROFESSIONS[user.profession] || null;
    }

    async setProfession(userId, professionKey) {
        const user = await this.getUser(userId);

        // Verificar nivel mínimo
        if (user.level < this.professionConfig.minLevel) {
            return { success: false, reason: 'level_too_low', required: this.professionConfig.minLevel };
        }

        // Verificar que la profesión exista
        if (!this.PROFESSIONS[professionKey]) {
            return { success: false, reason: 'invalid_profession' };
        }

        // Si ya tiene profesión, verificar cooldown y costo de cambio
        if (user.profession) {
            const lastChange = user.last_profession_change || 0;
            const cooldownLeft = this.professionConfig.changeCooldown - (Date.now() - lastChange);
            if (cooldownLeft > 0) {
                return { success: false, reason: 'cooldown', timeLeft: cooldownLeft };
            }
            if (user.balance < this.professionConfig.changeCost) {
                return { success: false, reason: 'too_poor', cost: this.professionConfig.changeCost };
            }
            await this.removeMoney(userId, this.professionConfig.changeCost, 'profession_change');
        }

        await this.updateUser(userId, {
            profession: professionKey,
            last_profession_change: Date.now(),
        });

        return { success: true, profession: this.PROFESSIONS[professionKey] };
    }
    
    // Verificar si puede usar daily
    async canUseHire(userId, guildId = null) {
        const user = await this.getUser(userId);
        const now = Date.now();
        let dayInMs = 24 * 60 * 60 * 1000;

        // Aplicar reducción de cooldown por eventos
        for (const event of (this.events?.getActiveEvents(guildId) || [])) {
            if (event.type === 'fever_time') {
                dayInMs = Math.floor(dayInMs * 0.5); // 🔥 -50% tiempo
                break;
            }
            else if (event.type === 'market_crash') {
                dayInMs = Math.floor(dayInMs * 0.4); // 🔥 -40% tiempo
                break;
            }
            else if (event.type === 'server_anniversary') {
                dayInMs = Math.floor(dayInMs * 0.3); // 🔥 -30% tiempo
                break;
            }
        }

        return (now - user.last_hire) >= dayInMs;
    }

    async hireSicario(userId, targetId, amount, channelId = null, guildId = null) {
        if (!await this.canUseHire(userId, guildId)) {
            const user = await this.getUser(userId);
            const timeLeft = 3 * 60 * 60 * 1000 - (Date.now() - user.last_hire);

            return {
                success: false,
                timeLeft: timeLeft,
                reason: 'cooldown'
            };
        }

        const user = await this.getUser(userId);
        const target = await this.getUser(targetId);

        if (userId === targetId)
            return { success: false, reason: 'self_target' };
        if (user.balance < amount)
            return { success: false, reason: 'too_poor' };
        if (!target)
            return { success: false, reason: 'target_not_found' };

        // Verificar si ya hay contrato activo contra ese target
        const existing = await this.database.getActiveContract(targetId);
        if (existing)
            return { success: false, reason: 'already_contracted' };

        // Descuento de Contrato Sombrío
        if (user.stats?.sicarioDiscount) {
            amount = Math.floor(amount * (1 - user.stats.sicarioDiscount));
            await this.updateUser(userId, {
                stats: { ...user.stats, sicarioDiscount: null }
            });
        }

        await this.removeMoney(userId, amount, 'sicario_hire');
        await this.database.createContract(userId, targetId, amount, channelId);

        const updateData = { last_hire: Date.now() }
        
        await this.updateUser(userId, updateData);

        return { success: true, amount, targetId, channelId };
    }

    async checkSicarioContract(targetId, minigameSucess) {
        const contract = await this.database.getActiveContract(targetId);
        if (!contract) return null;

        if(!minigameSucess) return null;

        // 60% de activarse, 40% falla
        const activated = Math.random() < 0.60;

        await this.database.deactivateContract(contract.id);

        return {
            activated,
            hiredBy: contract.hired_by,
            amount: contract.amount,
            contractId: contract.id,
            channelId: contract.channel_id,
        };
    }

    async generateTreasureMap(userId, guildId, guild) {
        // Verificar que no tenga mapa activo
        const existing = await this.database.getActiveTreasureMap(userId);
        if (existing) return { success: false, reason: 'already_active' };

        if (!process.env.GROQ_API_KEY) return { success: false, reason: 'no_api' };

        // Determinar recompensa aleatoria y cantidad de pistas
        const rewardRoll = Math.random();
        let reward, clueCount;

        if (rewardRoll < 0.50) {
            const amount = Math.floor(1000 + Math.random() * 4000);
            reward = { type: 'money', amount };
            clueCount = 2;
        } else if (rewardRoll < 0.80) {
            const amount = Math.floor(5000 + Math.random() * 20000);
            reward = { type: 'money', amount };
            clueCount = 3;
        } else if (rewardRoll < 0.95) {
            const amount = Math.floor(25000 + Math.random() * 75000);
            reward = { type: 'money', amount };
            clueCount = 4;
        } else if (rewardRoll < 0.95) {
            const xp = Math.floor(500 + Math.random() * 1500);
            reward = { type: 'xp', amount: xp };
            clueCount = 5;
        } else {
            // Ítem raro
            const itemPool = ['anti_theft_shield', 'robbery_kit', 'mystery_box'];
            const itemId = itemPool[Math.floor(Math.random() * itemPool.length)];
            reward = { type: 'item', itemId };
            clueCount = 4;
        }

        // Obtener canales y usuarios del servidor
        const channels = guild.channels.cache
            .filter(c => c.type === 0) // Solo text channels
            .map(c => ({ id: c.id, name: c.name }))
            .slice(0, 20);

        const members = guild.members.cache
            .filter(m => !m.user.bot)
            .map(m => ({ id: m.id, name: m.displayName }))
            .slice(0, 20);

        if (channels.length + members.length < clueCount) {
            return { success: false, reason: 'not_enough_targets' };
        }

        // Mezclar canales y usuarios y elegir targets para pistas
        const allTargets = [
            ...channels.map(c => ({ ...c, type: 'channel' })),
            ...members.map(m => ({ ...m, type: 'user' }))
        ].sort(() => Math.random() - 0.5).slice(0, clueCount);

        // Generar pistas con Groq
        const clues = [];
        for (const target of allTargets) {
            try {
                const targetDesc = target.type === 'channel'
                    ? `canal de Discord llamado "${target.name}"`
                    : `usuario de Discord llamado "${target.name}"`;

                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'llama-3.1-8b-instant',
                        max_tokens: 100,
                        temperature: 0.8,
                        messages: [
                            { role: 'system', content: 'Eres un generador de acertijos para un juego. Respondes SOLO con el acertijo, sin explicaciones ni texto adicional. El acertijo debe ser en español, creativo pero no demasiado difícil, máximo 2 oraciones.' },
                            { role: 'user', content: `Genera un acertijo que describa sin mencionar directamente este ${targetDesc}. El acertijo debe dar pistas sobre su nombre o función pero sin decirlo explícitamente.` }
                        ]
                    }),
                    signal: AbortSignal.timeout(5000)
                });

                if (!response.ok) throw new Error('API error');
                const data = await response.json();
                const clueText = data.choices?.[0]?.message?.content?.trim();
                if (!clueText) throw new Error('No content');

                clues.push({
                    text: clueText,
                    targetId: target.id,
                    targetType: target.type,
                    targetName: target.name,
                });
            } catch {
                // Fallback genérico
                clues.push({
                    text: target.type === 'channel'
                        ? `Busca donde la gente habla sobre "${target.name.replace(/-/g, ' ')}"...`
                        : `Encuentra a quien se hace llamar "${target.name}"...`,
                    targetId: target.id,
                    targetType: target.type,
                    targetName: target.name,
                });
            }
        }

        const mapId = await this.database.createTreasureMap(userId, guildId, clues, reward);
        return { success: true, mapId, clues, reward, clueCount };
    }

    async checkTreasureAnswer(userId, answerId, answerType) {
        const map = await this.database.getActiveTreasureMap(userId);
        if (!map) return { success: false, reason: 'no_map' };

        const currentClue = map.clues[map.current_clue];
        if (!currentClue) return { success: false, reason: 'no_clue' };

        // Verificar respuesta
        const isCorrect = currentClue.targetId === answerId && currentClue.targetType === answerType;

        if (!isCorrect) {
            return {
                success: true,
                correct: false,
                clue: currentClue,
                currentClue: map.current_clue,
                totalClues: map.clues.length,
                correctAnswer: currentClue.targetId
            };
        }

        const nextClue = map.current_clue + 1;
        const isFinished = nextClue >= map.clues.length;

        if (isFinished) {
            // Completar mapa y dar recompensa
            await this.database.completeTreasureMap(map.id);

            if (map.reward.type === 'money') {
                await this.addMoney(userId, map.reward.amount, 'treasure_map');
            } else if (map.reward.type === 'xp') {
                await this.addXp(userId, map.reward.amount);
            } else if (map.reward.type === 'item') {
                const user = await this.getUser(userId);
                const userItems = user.items || {};
                if (userItems[map.reward.itemId]) {
                    userItems[map.reward.itemId].quantity += 1;
                } else {
                    userItems[map.reward.itemId] = { id: map.reward.itemId, quantity: 1, purchaseDate: new Date().toISOString() };
                }
                await this.updateUser(userId, { items: userItems });
            }

            return {
                success: true,
                correct: true,
                finished: true,
                reward: map.reward,
                currentClue: map.current_clue,
                totalClues: map.clues.length,
            };
        }

        // Avanzar a siguiente pista
        await this.database.advanceTreasureMap(map.id, nextClue);
        const nextClueData = map.clues[nextClue];

        return {
            success: true,
            correct: true,
            finished: false,
            nextClue: nextClueData,
            currentClue: nextClue,
            totalClues: map.clues.length,
        };
    }

    async checkPresenceStreak(userId) {
        const user = await this.getUser(userId);
        const now = Date.now();
        const lastPresence = user.last_presence || 0;
        const timeSinceLast = now - lastPresence;
        const oneDay = 24 * 60 * 60 * 1000;
        const twoDays = 48 * 60 * 60 * 1000;

        // Si ya se chequeó hoy, no hacer nada
        if (timeSinceLast < oneDay) return null;

        let newStreak = user.presence_streak || 0;
        let milestone = null;

        // Si pasaron más de 48h, resetear racha
        let streakLost = null;
        if (timeSinceLast > twoDays && user.presence_streak > 0) {
            streakLost = user.presence_streak; // guardar racha perdida para notificar
            newStreak = 1;
        } else {
            newStreak += 1;
        }

        // Verificar hitos
        const milestones = {
            3:  { bonus: 0,     item: null,             label: '🔥 ¡3 días seguidos!' },
            7:  { bonus: 500,   item: null,             label: '🔥 ¡Una semana seguida! +500π' },
            15: { bonus: 2000,  item: 'energy_drink',   label: '🔥 ¡15 días seguidos! +2000π + Energy Drink' },
            30: { bonus: 10000, item: 'mystery_box',    label: '🔥 ¡30 días seguidos! +10000π + Mystery Box' },
        };

        if (milestones[newStreak]) {
            milestone = { ...milestones[newStreak], streak: newStreak };
            if (milestone.bonus > 0) {
                await this.addMoney(userId, milestone.bonus, 'presence_streak');
            }
            if (milestone.item) {
                const userItems = user.items || {};
                const item = this.shop.shopItems[milestone.item];
                
                if (item) {
                    if (userItems[milestone.item]) {
                        userItems[milestone.item].quantity += 1;
                    } else {
                        userItems[milestone.item] = {
                            id: milestone.item,
                            quantity: 1,
                            purchaseDate: new Date().toISOString()
                        };
                    }
                    await this.updateUser(userId, { items: userItems });
                }
            }
        }

        await this.updateUser(userId, {
            presence_streak: newStreak,
            last_presence: now,
        });

        return { streak: newStreak, milestone, streakLost };
    }

    async doPedir(userId) {
        const user = await this.getUser(userId);

        const lastPedir = user.last_pedir || 0;
        const cooldownLeft = this.mendicidadConfig.cooldown - (Date.now() - lastPedir);
        if (cooldownLeft > 0) {
            return { success: false, reason: 'cooldown', timeLeft: cooldownLeft };
        }

        // Obtener usuarios activos aleatorios (excluyendo al que pide)
        const allUsers = await this.getAllUsers();
        const activeUsers = allUsers
            .filter(u => 
                u.id !== userId && 
                u.last_presence > Date.now() - 7 * 24 * 60 * 60 * 1000 &&
                u.balance >= this.mendicidadConfig.donationAmount
            )
            .sort(() => Math.random() - 0.5)
            .slice(0, this.mendicidadConfig.usersToMention);

        if (activeUsers.length === 0) {
            return { success: false, reason: 'no_users' };
        }

        await this.updateUser(userId, { last_pedir: Date.now() });

        return { success: true, targets: activeUsers.map(u => u.id) };
    }

    async processDonation(donorId, recipientId, amount) {
        const donor = await this.getUser(donorId);
        if (donor.balance < amount) {
            return { success: false, reason: 'too_poor' };
        }
        await this.removeMoney(donorId, amount, 'mendicidad_donate');
        await this.addMoney(recipientId, amount, 'mendicidad_receive');
        return { success: true, amount };
    }

    async doPacto(userId) {
        const user = await this.getUser(userId);

        // Verificar cooldown
        const lastPacto = user.last_pacto || 0;
        const cooldownLeft = this.pactoConfig.cooldown - (Date.now() - lastPacto);
        if (cooldownLeft > 0) {
            return { success: false, reason: 'cooldown', timeLeft: cooldownLeft };
        }

        // Verificar balance mínimo
        if (user.balance < this.pactoConfig.minBalance) {
            return { success: false, reason: 'too_poor', minBalance: this.pactoConfig.minBalance };
        }

        const half = Math.floor(user.balance * 0.30);
        const won = Math.random() < 0.5;

        if (won) {
            await this.addMoney(userId, half, 'pacto_win');
        } else {
            await this.removeMoney(userId, half, 'pacto_lose');
        }

        const updatedUser = await this.getUser(userId);

        await this.updateUser(userId, {
            last_pacto: Date.now(),
            stats: { ...user.stats }
        });

        return {
            success: true,
            won,
            amount: half,
            newBalance: updatedUser.balance,
        };
    }

    // Obtener estadísticas de robo activo
    getRobberyStats(robberId) {
        const robberyData = this.activeRobberies.get(robberId);
        
        if (!robberyData) {
            return null;
        }
        
        const now = Date.now();
        const timeElapsed = now - robberyData.startTime;
        const timeLeft = Math.max(0, this.robberyConfig.buttonTimeLimit - timeElapsed);
        
        return {
            clicks: robberyData.clicks,
            maxClicks: robberyData.maxClicks,
            timeLeft: timeLeft,
            efficiency: Math.round((robberyData.clicks / robberyData.maxClicks) * 100)
        };
    }
    
    // Cancelar robo activo (útil para comandos de administrador)
    cancelRobbery(robberId) {
        if (this.activeRobberies.has(robberId)) {
            this.activeRobberies.delete(robberId);
            return true;
        }
        return false;
    }

    // ===== HUERTO =====

    async plantSeed(userId, slot, seedType) {
        const garden = await this.database.getGarden(userId);
        const totalSlots = 4 + (garden.extra_slots || 0);
        
        if (slot < 1 || slot > totalSlots) return { success: false, reason: 'invalid_slot' };

        const slotData = garden[`slot${slot}`];
        if (slotData) return { success: false, reason: 'slot_occupied' };

        const seed = this.SEEDS[seedType];
        if (!seed) return { success: false, reason: 'invalid_seed' };

        // Verificar que tiene la semilla en inventario
        const user = await this.getUser(userId);
        const items = user.items || {};
        if (!items[seedType] || items[seedType].quantity < 1) {
            return { success: false, reason: 'no_seed' };
        }

        // Multiplicador de granjero
        const prof = this.getProfession(user);
        const gardenMult = prof?.gardenMult || 1.0;

        const now = Date.now();
        const readyAt = now + seed.time * 60 * 60 * 1000;

        // Descontar semilla del inventario
        items[seedType].quantity -= 1;
        if (items[seedType].quantity <= 0) delete items[seedType];
        await this.updateUser(userId, { items });

        await this.database.updateGardenSlot(userId, slot, {
            seedType,
            plantedAt: now,
            readyAt,
            watered: false,
            plagued: false,
            harvested: false,
            gardenMult,
        });

        return { success: true, seedType, slot, readyAt };
    }

    async harvestSlot(userId, slot) {
        const garden = await this.database.getGarden(userId);
        const slotData = garden[`slot${slot}`];

        if (!slotData) return { success: false, reason: 'empty_slot' };
        if (slotData.plagued) return { success: false, reason: 'plagued' };
        if (Date.now() < slotData.readyAt) return { success: false, reason: 'not_ready', timeLeft: slotData.readyAt - Date.now() };

        const seed = this.SEEDS[slotData.seedType];
        const user = await this.getUser(userId);
        let mult = slotData.gardenMult || 1.0;

        // Fertilizante
        if (user.stats?.gardenFertilizer) {
            mult *= 2.0;
            await this.updateUser(userId, {
                stats: { ...user.stats, gardenFertilizer: false }
            });
        }

        const money = Math.floor((Math.random() * (seed.moneyMax - seed.moneyMin) + seed.moneyMin) * mult);

        await this.addMoney(userId, money, 'garden_harvest');
        await this.database.updateGardenSlot(userId, slot, null);

        // Drop de ingrediente (60% chance)
        let ingredient = null;
        if (Math.random() < 0.6) {
            ingredient = seed.ingredient;
            const user = await this.getUser(userId);
            const items = user.items || {};
            if (items[ingredient]) {
                items[ingredient].quantity += 1;
            } else {
                items[ingredient] = { id: ingredient, quantity: 1, purchaseDate: new Date().toISOString() };
            }
            await this.updateUser(userId, { items });
        }

        return { success: true, money, ingredient, seedType: slotData.seedType };
    }

    async harvestAll(userId) {
        const garden = await this.database.getGarden(userId);
        const totalSlots = 4 + (garden.extra_slots || 0);
        const results = [];

        for (let i = 1; i <= totalSlots; i++) {
            const slot = garden[`slot${i}`];
            if (slot && !slot.plagued && Date.now() >= slot.readyAt) {
                const res = await this.harvestSlot(userId, i);
                if (res.success) results.push({ slot: i, ...res });
            }
        }
        return results;
    }

    async fumigarSlot(userId, slot) {
        const garden = await this.database.getGarden(userId);
        const slotData = garden[`slot${slot}`];

        if (!slotData) return { success: false, reason: 'empty_slot' };
        if (!slotData.plagued) return { success: false, reason: 'not_plagued' };

        const FUMIGATION_COST = 500;
        const user = await this.getUser(userId);
        if (user.balance < FUMIGATION_COST) return { success: false, reason: 'no_money', cost: FUMIGATION_COST };

        await this.removeMoney(userId, FUMIGATION_COST, 'fumigation');
        slotData.plagued = false;
        await this.database.updateGardenSlot(userId, slot, slotData);

        return { success: true, cost: FUMIGATION_COST };
    }

    async checkGardenPlagued(userId) {
        const garden = await this.database.getGarden(userId);
        const totalSlots = 4 + (garden.extra_slots || 0);
        const plagued = [];

        for (let i = 1; i <= totalSlots; i++) {
            const slot = garden[`slot${i}`];
            if (slot && !slot.plagued && !slot.harvested) {
                if (Math.random() < 0.05) {
                    slot.plagued = true;
                    await this.database.updateGardenSlot(userId, i, slot);
                    plagued.push(i);
                }
            }
        }
        return plagued;
    }

    // ===== MASCOTAS =====

    async liberarMascota(userId, petId) {
        const pet = await this.database.getPet(petId);
        if (!pet || pet.user_id !== userId) return { success: false, reason: 'not_found' };
        if (pet.equipped) return { success: false, reason: 'equipped', msg: 'Desequipa la mascota antes de liberarla.' };
        if (pet.expedition_end) return { success: false, reason: 'on_expedition', msg: 'La mascota está en expedición, espera a que regrese.' };

        // Recompensa según rareza y nivel
        const rarityRewards = { common: 500, uncommon: 1500, rare: 4000, epic: 10000, legendary: 30000 };
        const baseReward = rarityRewards[pet.rarity] || 500;
        const levelBonus = pet.level * 100;
        const totalReward = baseReward + levelBonus;

        // Si tiene forma 2 o 3 da un huevo de vuelta también
        const givesEgg = pet.form >= 2;

        await this.database.deletePet(petId);
        await this.addMoney(userId, totalReward, 'pet_released');

        if (givesEgg) {
            const user = await this.getUser(userId);
            const items = user.items || {};
            items['pet_egg'] = items['pet_egg'] || { id: 'pet_egg', quantity: 0 };
            items['pet_egg'].quantity += 1;
            await this.updateUser(userId, { items });
        }

        return {
            success: true,
            petName: pet.name,
            rarity: pet.rarity,
            reward: totalReward,
            givesEgg,
            form: pet.form,
        };
    }
    
    async incubateEgg(userId) {
        const pets = await this.database.getUserPets(userId);
        const user = await this.getUser(userId);
        const maxPets = user.stats?.petSlots || 5;
        if (pets.length >= maxPets) return { success: false, reason: 'max_pets', current: pets.length, max: maxPets };

        const rarityRoll = Math.random();
        let rarity;
        if      (rarityRoll < 0.50) rarity = 'common';
        else if (rarityRoll < 0.78) rarity = 'uncommon';
        else if (rarityRoll < 0.93) rarity = 'rare';
        else if (rarityRoll < 0.99) rarity = 'epic';
        else                        rarity = 'legendary';

        const namesPool = this.PET_NAMES[rarity];
        const name = namesPool[Math.floor(Math.random() * namesPool.length)];

        const petId = await this.database.createPet(userId, name, rarity);
        return { success: true, petId, name, rarity, emoji: this.PET_RARITIES[rarity].emoji };
    }

    async equipPet(userId, petId) {
        const pet = await this.database.getPet(petId);
        if (!pet || pet.user_id !== userId) return { success: false, reason: 'not_found' };
        if (pet.sick) return { success: false, reason: 'sick' };
        if (pet.expedition_end) return { success: false, reason: 'on_expedition' };

        // Desequipar actual
        const current = await this.database.getEquippedPet(userId);
        if (current) await this.database.updatePet(current.id, { equipped: 0 });

        await this.database.updatePet(petId, { equipped: 1 });
        return { success: true, pet };
    }

    async addPetXP(userId, amount = null) {
        const xp = amount ?? (Math.floor(Math.random() * 5) + 1);
        const pets = await this.database.getUserPets(userId);
        const evolutions = [];

        for (const pet of pets) {
            if (pet.sick) continue;

            const rarityData = this.PET_RARITIES[pet.rarity];
            const xpNeeded = rarityData.xpToLevel;
            let newXp = pet.xp + xp;
            let newLevel = pet.level;
            let newForm = pet.form;

            while (newXp >= xpNeeded * newLevel) {
                newXp -= xpNeeded * newLevel;
                newLevel++;
            }

            // Evolución
            if (newLevel >= 31 && newForm < 3) {
                newForm = 3;
                evolutions.push({ petId: pet.id, name: pet.name, oldForm: pet.form, newForm: 3 });
            } else if (newLevel >= 11 && newForm < 2) {
                newForm = 2;
                evolutions.push({ petId: pet.id, name: pet.name, oldForm: pet.form, newForm: 2 });
            }

            await this.database.updatePet(pet.id, { xp: newXp, level: newLevel, form: newForm });
        }

        return evolutions;
    }

    async getPetBonus(userId, type) {
        const pet = await this.database.getEquippedPet(userId);
        if (!pet || pet.sick) return 0;

        const rarityData = this.PET_RARITIES[pet.rarity];
        const bonus = rarityData.bonus;
        const formMult = pet.form === 3 ? 1.5 : pet.form === 2 ? 1.2 : 1.0;

        if (bonus.type === 'all' || bonus.type === type) {
            return bonus.amount * formMult;
        }
        return 0;
    }

    async checkPetSickness(userId) {
        const pets = await this.database.getUserPets(userId);
        const sickened = [];

        for (const pet of pets) {
            if (!pet.sick && Math.random() < 0.03) {
                await this.database.updatePet(pet.id, { sick: 1, sick_since: Date.now() });
                sickened.push(pet);
            }
        }
        return sickened;
    }

    async curePet(userId, petId, itemId) {
        const pet = await this.database.getPet(petId);
        if (!pet || pet.user_id !== userId) return { success: false, reason: 'not_found' };
        if (!pet.sick) return { success: false, reason: 'not_sick' };

        const CURE_ITEMS = {
            medicine_basic:    ['common', 'uncommon'],
            medicine_advanced: ['rare', 'epic'],
            medicine_legendary: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
        };

        const allowed = CURE_ITEMS[itemId];
        if (!allowed) return { success: false, reason: 'invalid_item' };
        if (!allowed.includes(pet.rarity)) return { success: false, reason: 'wrong_medicine' };

        const user = await this.getUser(userId);
        const items = user.items || {};
        if (!items[itemId] || items[itemId].quantity < 1) return { success: false, reason: 'no_item' };

        items[itemId].quantity -= 1;
        if (items[itemId].quantity <= 0) delete items[itemId];
        await this.updateUser(userId, { items });
        await this.database.updatePet(petId, { sick: 0, sick_since: null });

        return { success: true, petName: pet.name };
    }

    async sendPetExpedition(userId, petId, type) {
        const pet = await this.database.getPet(petId);
        if (!pet || pet.user_id !== userId) return { success: false, reason: 'not_found' };
        if (pet.sick) return { success: false, reason: 'sick' };
        if (pet.equipped) return { success: false, reason: 'equipped' };
        if (pet.expedition_end) return { success: false, reason: 'already_on_expedition' };

        const EXPEDITION_TYPES = {
            money:       { form: 1, hours: 2,  label: '💰 Expedición de dinero' },
            ingredients: { form: 2, hours: 4,  label: '🌿 Expedición de ingredientes' },
            special:     { form: 3, hours: 8,  label: '✨ Expedición especial' },
        };

        const exp = EXPEDITION_TYPES[type];
        if (!exp) return { success: false, reason: 'invalid_type' };
        if (pet.form < exp.form) return { success: false, reason: 'form_required', required: exp.form };

        const expeditionEnd = Date.now() + exp.hours * 60 * 60 * 1000;
        await this.database.updatePet(petId, { expedition_end: expeditionEnd, expedition_type: type });

        return { success: true, expeditionEnd, label: exp.label };
    }

    async claimPetExpedition(userId, petId) {
        const pet = await this.database.getPet(petId);
        if (!pet || pet.user_id !== userId) return { success: false, reason: 'not_found' };
        if (!pet.expedition_end) return { success: false, reason: 'not_on_expedition' };
        if (Date.now() < pet.expedition_end) return { success: false, reason: 'not_ready', timeLeft: pet.expedition_end - Date.now() };

        const type = pet.expedition_type;
        const rarityMult = { common: 1, uncommon: 1.2, rare: 1.5, epic: 2.0, legendary: 3.0 };
        const mult = rarityMult[pet.rarity] || 1;
        let reward = {};
        let xpBonus = 5;
        const needsMinigame = Math.random() < 0.3;

        if (type === 'money') {
            reward.money = Math.floor((500 + Math.random() * 1500) * mult);
            await this.addMoney(userId, reward.money, 'pet_expedition');
        } else if (type === 'ingredients') {
            const ingredientPool = ['herb_common', 'herb_rare', 'herb_epic'];
            reward.ingredient = ingredientPool[Math.floor(Math.random() * ingredientPool.length)];
            const user = await this.getUser(userId);
            const items = user.items || {};
            items[reward.ingredient] = items[reward.ingredient] || { id: reward.ingredient, quantity: 0 };
            items[reward.ingredient].quantity += 1;
            await this.updateUser(userId, { items });
        } else if (type === 'special') {
            reward.money = Math.floor((2000 + Math.random() * 5000) * mult);
            await this.addMoney(userId, reward.money, 'pet_expedition_special');
        }

        if (needsMinigame) xpBonus = 8;

        await this.addPetXP(userId, xpBonus);
        await this.database.updatePet(petId, { expedition_end: null, expedition_type: null });

        return { success: true, reward, needsMinigame, xpBonus };
    }

    async doctorCure(doctorId, targetId) {
        const doctor = await this.getUser(doctorId);
        const prof = this.getProfession(doctor);

        if (prof?.name !== '🩺 Doctor') {
            return { success: false, reason: 'not_doctor' };
        }

        const isSelf = doctorId === targetId;

        // Cooldown (solo aplica curando a otros)
        if (!isSelf) {
            const lastCure = doctor.stats?.lastDoctorCure || 0;
            const cooldownLeft = this.doctorConfig.cooldown - (Date.now() - lastCure);
            if (cooldownLeft > 0) {
                return { success: false, reason: 'cooldown', timeLeft: cooldownLeft };
            }
        }

        const target = await this.getUser(targetId);
        const activeEffects = this.shop.parseActiveEffects(target.activeEffects);

        if (!activeEffects['death_hand_curse'] || activeEffects['death_hand_curse'].length === 0) {
            return { success: false, reason: 'not_cursed' };
        }

        // Verificar que la maldición no esté expirada ya
        const curse = activeEffects['death_hand_curse'][0];
        if (curse.expiresAt <= Date.now()) {
            return { success: false, reason: 'not_cursed' };
        }

        // Cobrar si no es autocuración
        if (!isSelf) {
            if (doctor.balance < this.doctorConfig.cureCost) {
                return { success: false, reason: 'no_money', cost: this.doctorConfig.cureCost };
            }
            await this.removeMoney(doctorId, this.doctorConfig.cureCost, 'doctor_cure');
        }

        // Eliminar maldición
        delete activeEffects['death_hand_curse'];
        await this.updateUser(targetId, { activeEffects });

        // Guardar cooldown del doctor
        if (!isSelf) {
            await this.updateUser(doctorId, {
                stats: {
                    ...doctor.stats,
                    lastDoctorCure: Date.now(),
                }
            });
        }

        return {
            success: true,
            isSelf,
            cost: isSelf ? 0 : this.doctorConfig.cureCost,
        };
    }

    // ===== MATRIMONIO =====

    async getMarriage(userId) {
        return await this.database.getMarriage(userId);
    }

    async proposeMarriage(proposerId, targetId) {
        if (proposerId === targetId) return { success: false, reason: 'self' };

        const [proposer, target] = await Promise.all([
            this.getUser(proposerId),
            this.getUser(targetId)
        ]);

        const [proposerMarriage, targetMarriage] = await Promise.all([
            this.database.getMarriage(proposerId),
            this.database.getMarriage(targetId)
        ]);

        if (proposerMarriage) return { success: false, reason: 'already_married_proposer' };
        if (targetMarriage) return { success: false, reason: 'already_married_target' };

        // Cooldown de divorcio (30 días)
        const lastDivorce = proposer.stats?.lastDivorce || 0;
        if (Date.now() - lastDivorce < 30 * 24 * 60 * 60 * 1000) {
            return { success: false, reason: 'divorce_cooldown', timeLeft: (30 * 24 * 60 * 60 * 1000) - (Date.now() - lastDivorce) };
        }

        const COST = 50000;
        if (proposer.balance < COST) return { success: false, reason: 'proposer_no_money', cost: COST };
        if (target.balance < COST) return { success: false, reason: 'target_no_money', cost: COST };

        return { success: true, cost: COST };
    }

    async acceptMarriage(proposerId, targetId) {
        const COST = 50000;
        await this.removeMoney(proposerId, COST, 'marriage_cost');
        await this.removeMoney(targetId, COST, 'marriage_cost');
        const id = await this.database.createMarriage(proposerId, targetId);
        return { success: true, id };
    }

    async applyMarriageBonus(userId, amount, isLoss = false) {
        const marriage = await this.database.getMarriage(userId);
        if (!marriage) return { bonus: 0, partnerId: null };

        const partnerId = marriage.user1_id === userId ? marriage.user2_id : marriage.user1_id;

        const milestones = marriage.anniversary_milestones || [];
        const hasPercentBonus = milestones.includes(1);
        const pct = hasPercentBonus ? 0.15 : 0.10;

        const bonus = Math.floor(Math.abs(amount) * pct);
        if (bonus <= 0) return { bonus: 0, partnerId };

        if (isLoss) {
            await this.removeMoney(partnerId, bonus, 'marriage_loss_share');
        } else {
            await this.addMoney(partnerId, bonus, 'marriage_bonus');
        }

        return { bonus, partnerId };
    }

    async initiateDivorce(userId) {
        const marriage = await this.database.getMarriage(userId);
        if (!marriage) return { success: false, reason: 'not_married' };

        const user = await this.getUser(userId);
        if (user.balance < 50000) return { success: false, reason: 'no_money', min: 50000 };

        const partnerId = marriage.user1_id === userId ? marriage.user2_id : marriage.user1_id;
        return { success: true, marriage, partnerId };
    }

    async processDivorce(marriageId, initiatorId, partnerAccepted) {
        const COST_MUTUAL = 50000;
        const COST_UNILATERAL = 100000;

        const initiator = await this.getUser(initiatorId);

        if (partnerAccepted) {
            const marriage = await this.database.pool.execute('SELECT * FROM marriages WHERE id = ?', [marriageId]);
            const m = marriage[0][0];
            if (!m) return { success: false };
            await this.removeMoney(initiatorId, COST_MUTUAL, 'divorce_cost');
            const partnerId = m.user1_id === initiatorId ? m.user2_id : m.user1_id;
            await this.removeMoney(partnerId, COST_MUTUAL, 'divorce_cost');
        } else {
            if (initiator.balance < COST_UNILATERAL) {
                return { success: false, reason: 'no_money_unilateral' };
            }
            await this.removeMoney(initiatorId, COST_UNILATERAL, 'divorce_unilateral');
        }

        await this.database.dissolveMarriage(marriageId, initiatorId);
        return { success: true };
    }

    async checkInactiveSpouses() {
        const marriages = await this.database.getActiveMarriages();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;

        for (const marriage of marriages) {
            const [u1, u2] = await Promise.all([
                this.getUser(marriage.user1_id),
                this.getUser(marriage.user2_id)
            ]);

            const u1inactive = (Date.now() - (u1.last_presence || 0)) > thirtyDays;
            const u2inactive = (Date.now() - (u2.last_presence || 0)) > thirtyDays;

            if (u1inactive && !u2inactive) {
                const transfer = Math.floor(u1.balance * 0.40);
                if (transfer > 0) await this.addMoney(marriage.user2_id, transfer, 'inheritance');
                await this.database.dissolveMarriage(marriage.id, marriage.user1_id);
                try {
                    const user = await this.client.users.fetch(marriage.user2_id);
                    user.send(`💝 Tu pareja estuvo inactiva 30 días. Recibiste **${transfer.toLocaleString()} π-b$** de herencia y el matrimonio fue disuelto automáticamente.`).catch(() => {});
                } catch {}
            } else if (u2inactive && !u1inactive) {
                const transfer = Math.floor(u2.balance * 0.40);
                if (transfer > 0) await this.addMoney(marriage.user1_id, transfer, 'inheritance');
                await this.database.dissolveMarriage(marriage.id, marriage.user2_id);
                try {
                    const user = await this.client.users.fetch(marriage.user1_id);
                    user.send(`💝 Tu pareja estuvo inactiva 30 días. Recibiste **${transfer.toLocaleString()} π-b$** de herencia y el matrimonio fue disuelto automáticamente.`).catch(() => {});
                } catch {}
            }
        }
    }

    async checkAnniversaries() {
        const marriages = await this.database.getActiveMarriages();

        for (const marriage of marriages) {
            const monthsMarried = Math.floor((Date.now() - marriage.married_at) / (30 * 24 * 60 * 60 * 1000));
            const achieved = marriage.anniversary_milestones || [];

            for (const [months, reward] of Object.entries(this.ANNIVERSARY_MILESTONES)) {
                const m = parseInt(months);
                if (monthsMarried >= m && !achieved.includes(m)) {
                    achieved.push(m);
                    await this.database.updateMarriageMilestones(marriage.id, achieved);

                    for (const uid of [marriage.user1_id, marriage.user2_id]) {
                        if (reward.type === 'money') {
                            await this.addMoney(uid, reward.amount, 'anniversary_bonus');
                        } else if (reward.type === 'item') {
                            const user = await this.getUser(uid);
                            const items = user.items || {};
                            items[reward.itemId] = items[reward.itemId] || { id: reward.itemId, quantity: 0 };
                            items[reward.itemId].quantity += 1;
                            await this.updateUser(uid, { items });
                        }

                        try {
                            const discordUser = await this.client.users.fetch(uid);
                            discordUser.send(`💍 **¡Aniversario de ${m} ${m === 1 ? 'mes' : 'meses'}!**\n🎁 Recompensa: ${reward.label}`).catch(() => {});
                        } catch {}
                    }
                }
            }
        }
    }

    // ===== MENTOR =====

    async startMentorship(mentorId, apprenticeId) {
        if (mentorId === apprenticeId) return { success: false, reason: 'self' };

        const [mentor, apprentice] = await Promise.all([
            this.getUser(mentorId),
            this.getUser(apprenticeId)
        ]);

        if (mentor.level < 20) return { success: false, reason: 'mentor_level', required: 20, current: mentor.level };
        if (apprentice.level > 5) return { success: false, reason: 'apprentice_level', max: 5, current: apprentice.level };

        const [mentorRel, apprenticeRel] = await Promise.all([
            this.database.getMentorship(mentorId),
            this.database.getMentorship(apprenticeId)
        ]);

        if (mentorRel) return { success: false, reason: 'mentor_busy' };
        if (apprenticeRel) return { success: false, reason: 'apprentice_busy' };

        await this.database.createMentorship(mentorId, apprenticeId);
        return { success: true };
    }

    async checkMentorMilestone(apprenticeId, newLevel) {
        const mentorship = await this.database.getMentorship(apprenticeId);
        if (!mentorship || mentorship.apprentice_id !== apprenticeId) return null;
        if (mentorship.status !== 'active') return null;

        // Buscar si hay algún hito en los niveles alcanzados que aún no se haya dado
        const milestoneLevel = Object.keys(this.MENTOR_MILESTONES)
            .map(Number)
            .filter(m => m <= newLevel && m > (mentorship.last_milestone || 0))
            .sort((a, b) => b - a)[0]; // El más alto pendiente

        if (!milestoneLevel) return null;
        const milestone = this.MENTOR_MILESTONES[milestoneLevel];

        await this.database.updateMentorshipMilestone(mentorship.id, newLevel);

        // Dar recompensas a ambos
        await this.addMoney(apprenticeId, milestone.reward, 'mentor_milestone');
        await this.addMoney(mentorship.mentor_id, milestone.reward, 'mentor_milestone');

        if (milestone.itemId) {
            for (const uid of [apprenticeId, mentorship.mentor_id]) {
                const user = await this.getUser(uid);
                const items = user.items || {};
                items[milestone.itemId] = items[milestone.itemId] || { id: milestone.itemId, quantity: 0 };
                items[milestone.itemId].quantity += 1;
                await this.updateUser(uid, { items });
            }
        }

        // Completar si llegó a nivel 20
        if (newLevel >= 20) {
            await this.database.completeMentorship(mentorship.id);
        }

        return { milestone, mentorId: mentorship.mentor_id, reward: milestone.reward };
    }

    // Método para conectar eventos
    connectEventsSystem(eventsSystem) {
        this.events = eventsSystem;
        console.log('🎮 Sistema de eventos conectado a economia');
    }
}

module.exports = EconomySystem;
