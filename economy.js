require('dotenv').config();
const LocalDatabase = require('./database');
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

        // AGREGAR ESTAS LÍNEAS:
        this.userCache = new Map();
        this.MAX_CACHE_SIZE = 500;
        this.cacheTimeout = 10 * 60 * 1000; // 5 minutos        
        
        // Map para trackear robos activos
        this.activeRobberies = new Map();
        this.workStreaks = new Map(); // userId -> { streak, lastJob }
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
        
        await this.missions.updateMissionProgress(fromUserId, 'unique_transfers', toUserId);
        await this.missions.updateMissionProgress(toUserId, 'money_received_today', amount);

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

        await this.missions.updateMissionProgress(userId, 'xp_gained_today', xpGained);
       
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
            
            // Agregar campos de level up
            updateData.level = newLevel;
            updateData.balance = user.balance + totalReward;
            updateData.stats = {
                ...user.stats,
                totalEarned: (user.stats.totalEarned || 0) + totalReward
            };
            
            await this.updateUser(userId, updateData); // ← Reemplaza saveUsers()
           
            return {
                levelUp: true,
                levelsGained: levelUps,
                newLevel: newLevel,
                xpGained: newTotalXp,
                reward: totalReward,
                baseReward: reward,
                levelBonus: levelBonus,
            };
        }
        
        await this.updateUser(userId, updateData); // ← Reemplaza saveUsers()
        
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

        return (now - user.last_daily) >= dayInMs;
    }

    // Usar comando daily
    async useDaily(userId, guildId = null) {
        if (!await this.canUseDaily(userId, guildId)) {
            const user = await this.getUser(userId);
            const timeLeft = 24 * 60 * 60 * 1000 - (Date.now() - user.last_daily);
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

        const addResult = await this.addMoney(userId, finalEarnings, 'daily_reward');
              
        const updateData = {
            last_daily: Date.now(),
            stats: {
                ...user.stats,
                dailyClaims: user.stats.dailyClaims + 1
            }
        }
        
        await this.updateUser(userId, updateData);

        // *** NUEVO: ACTUALIZAR ESTADÍSTICAS DE ACHIEVEMENTS ***
        if (this.achievements) {
            await this.achievements.updateStats(userId, 'daily_claimed');
        }
        
        return {
            success: true,
            amount: amount,
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
                baseReward: 2500,
                variation: 1500,
                levelRequirement: 9,
                failChance: 0.40, // 75% de fallar
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
        };
    }

    async applyWorkResult(userId, jobType, earnedAmount, minigameSuccess) {
        const user = await this.getUser(userId);
        const streakData = this.workStreaks.get(userId) || { streak: 0 };

        const illegalJobs = ['criminal', 'vendedordelpunto', 'damadecomp', 'sicario', 'contador'];
        const bonuses = [
            { streak: 10, bonus: 0.40, label: '🔥🔥🔥 ¡RACHA LEGENDARIA! +40%' },
            { streak: 5,  bonus: 0.25, label: '🔥🔥 ¡Racha increíble! +25%' },
            { streak: 3,  bonus: 0.15, label: '🔥 ¡En racha! +15%' },
        ];

        let finalAmount = earnedAmount;
        let newStreak = streakData.streak;
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
                totalEarned: (user.stats?.totalEarned || 0) + Math.max(0, finalAmount)
            }
        });

        return {
            finalAmount,
            newBalance: addResult.newBalance,
            newStreak,
            streakBonusApplied,
            streakBonusLabel,
            hitLimit: addResult.hitLimit || false,
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
        
        if (now - lastRobbery < this.robberyConfig.cooldown) {
            const timeLeft = this.robberyConfig.cooldown - (now - lastRobbery);
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
            
            // Auto-cleanup después del tiempo límite
            setTimeout(() => {
                if (this.activeRobberies.has(robberId)) {
                    console.log(`🧹 Auto-cleanup de robo expirado: ${robberId}`);
                    this.activeRobberies.delete(robberId);
                }
            }, this.robberyConfig.buttonTimeLimit + 5000); // +5 segundos de gracia
            
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
                
                const stealPercentage = minSteal + (clickEfficiency * (maxSteal - minSteal));
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

    // Método para conectar eventos
    connectEventsSystem(eventsSystem) {
        this.events = eventsSystem;
        console.log('🎮 Sistema de eventos conectado a economia');
    }
}

module.exports = EconomySystem;
