require('dotenv').config();
const LocalDatabase = require('./database');
const EventsSystem = require('./events');

const richUC = new Map();
const heavyUsersCache = new Map();

class EconomySystem {
    constructor() {
        this.database = null;
        this.initializeDatabase();
        this.events = null;
        
        // Configuración del sistema
        this.config = {
            currency: 'π-b Coins',
            currencySymbol: 'π-b$',
            xpPerMessage: 10, // XP base por mensaje
            xpVariation: 5,  // Variación aleatoria del XP
            xpCooldown: 15000, // 15 segundos entre mensajes que dan XP
            dailyAmount: 2500,  // Cantidad base del daily
            dailyVariation: 1500, // Variación del daily
            levelUpReward: 50, // π-b Coins por subir de nivel
            xpPerLevel: 100,   // XP base necesaria para nivel 1
            levelMultiplier: 1.5, // Multiplicador de XP por nivel
            maxBalance: 10000000, // Limite de 10 millones
        };
        
        this.userCooldowns = new Map(); // Para controlar cooldowns de XP

        // Configuración de robos
        this.robberyConfig = {
            cooldown: 6 * 60 * 60 * 1000, // 6 horas de cooldown
            minStealPercentage: 5, // Mínimo 5%
            maxStealPercentage: 10, // Máximo 10%
            buttonTimeLimit: 30000, // 30 segundos para hacer clicks
            maxClicks: 50, // Máximo de clicks
            failChance: 0.3, // 30% de chance de fallar
            penaltyPercentage: 15, // 15% de penalización si fallas
            levelRequirement: 5, // Nivel mínimo para robar
            minTargetBalance: 500, // El objetivo debe tener al menos 500 coins
        };

        // AGREGAR ESTAS LÍNEAS:
        this.userCache = new Map();
        this.MAX_CACHE_SIZE = 500;
        this.cacheTimeout = 10 * 60 * 1000; // 5 minutos        
        
        // Map para trackear robos activos
        this.activeRobberies = new Map();
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

        const newBalance = Math.min(user.balance + amount, this.config.maxBalance);
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
    async transferMoney(fromUserId, toUserId, amount) {
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
        
        if (fromUser.balance < amount) {
            return { success: false, reason: 'insufficient_funds' };
        }
        
        if (amount <= 0) {
            return { success: false, reason: 'invalid_amount' };
        }

        let finalFrom = 0;
        let eventMessage = '';
        
        for (const event of this.events.getActiveEvents()) {
            if (event.type === 'charity_event') {
                finalFrom = Math.floor(amount * 0.45); // 💰 +45%
                eventMessage = `\n❤️ **Evento de Caridad** (+${finalFrom} π-b$) a quien dió dinero`;
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
        return Math.floor(this.config.xpPerLevel * Math.pow(this.config.levelMultiplier, level - 2));
    }

    // Calcular nivel basado en XP total
    getLevelFromXp(totalXp) {
        let level = 1;
        let xpRequired = 0;
        
        while (xpRequired <= totalXp) {
            level++;
            xpRequired += this.getXpForLevel(level);
        }
        
        return level - 1;
    }

    // Agregar XP a un usuario y verificar subida de nivel
    async addXp(userId, baseXp) {
        const user = await this.getUser(userId); // ← Ahora async
        const variation = Math.floor(Math.random() * (this.config.xpVariation * 2)) - this.config.xpVariation;
        const xpGained = Math.max(1, baseXp + variation);
        const modifiers = await this.shop.getActiveMultipliers(userId, 'all');
        let finalXp = xpGained;

        if (modifiers.multiplier > 1) {
            finalXp = Math.floor(xpGained * modifiers.multiplier);        
        }
        
        const oldLevel = user.level;
        const newXp = user.xp + finalXp;
        const newTotalXp = user.total_xp + finalXp;
        
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
            
            // Agregar campos de level up
            updateData.level = newLevel;
            updateData.balance = user.balance + reward;
            updateData.stats = {
                ...user.stats,
                totalEarned: (user.stats.totalEarned || 0) + reward
            };

            //console.log(`🎉 ${userId} subió ${levelUps} nivel(es)! Nuevo nivel: ${newLevel}, Recompensa: ${reward} ${this.config.currencySymbol}`);

            // *** NUEVO: ACTUALIZAR MISIONES DE LEVEL UP ***
            if (this.missions) {
                await this.missions.updateMissionProgress(userId, 'level_up', levelUps);
            }
            
            await this.updateUser(userId, updateData); // ← Reemplaza saveUsers()
           
            return {
                levelUp: true,
                levelsGained: levelUps,
                newLevel: newLevel,
                xpGained: finalXp,
                reward: reward
            };
        }
        
        await this.updateUser(userId, updateData); // ← Reemplaza saveUsers()
        
        return {
            levelUp: false,
            xpGained: finalXp,
            currentLevel: user.level
        };
    }

    // Procesar XP por mensaje (con cooldown)
    async processMessageXp(userId) {      
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

            const activeEvents = this.events.getActiveEvents();
                
            for (const event of this.events.getActiveEvents()) {
                if (event.type === 'double_xp') {
                    finalXp = this.config.xpPerMessage * 2; // Exactamente x2
                    eventMessage = `\n⚡ **Doble XP** (+${finalXp - this.config.xpPerMessage} XP)`;
                    break;
                }
                else if (event.type === 'fever_time') {
                    finalXp = Math.floor(this.config.xpPerMessage * 1.5); // x1.5
                    eventMessage = `\n🔥 **Tiempo Fiebre** (+${finalXp - this.config.xpPerMessage} XP)`;
                    break;
                }
                else if (event.type === 'server_anniversary') {
                    finalXp = Math.floor(this.config.xpPerMessage * 3); // x3
                    eventMessage = `\n🎉 **Aniversario del Servidor** (+${finalXp - this.config.xpPerMessage} XP)`;
                    break;
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

    // Verificar si puede usar daily
    async canUseDaily(userId) {
        const user = await this.getUser(userId);
        const now = Date.now();
        let dayInMs = 24 * 60 * 60 * 1000;

        // Aplicar reducción de cooldown por eventos
        for (const event of this.events.getActiveEvents()) {
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
    async useDaily(userId) {
        if (!await this.canUseDaily(userId)) {
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

        for (const event of this.events.getActiveEvents()) {
            if (event.type === 'money_rain') {
                finalEarnings = Math.floor(amount * 1.75); // 💰 +50%
                eventMessage = `\n💰 **Lluvia de Dinero** (+${finalEarnings - amount} π-b$)`;
                break;
            }
            else if (event.type === 'fever_time') {
                finalEarnings = Math.floor(amount * 1.2); // 🔥 +30%
                eventMessage = `🔥 **Tiempo Fiebre** (+${finalEarnings - amount} π-b$)`;
                break;
            }
            else if (event.type === 'market_crash') {
                finalEarnings = Math.floor(amount * 0.8); // 📉 -30%
                eventMessage = `📉 **Crisis del Mercado** (-${amount - finalEarnings} π-b$)`;
                break;
            }
            else if (event.type === 'server_anniversary') {
                finalEarnings = Math.floor(amount * 2);
                eventMessage = `🎉 **Aniversario del Servidor** (+${finalEarnings - amount} π-b$)`
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

        // *** NUEVO: ACTUALIZAR MISIONES ***
        if (this.missions) {
            const completedMissions = await this.missions.updateMissionProgress(userId, 'daily_claimed');
            // No notificar aquí porque se hace desde el comando
        }
        
        return {
            success: true,
            amount: amount,
            oldBalance: user.balance,
            newBalance: addResult.newBalance,
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
                cooldown: 60 * 60 * 1000, // 1 hora
                codeName: 'delivery',
                baseReward: 150,
                variation: 100,
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
            'programmer': {
                name: '💻 Programador',
                cooldown: 60 * 60 * 1000, // 1 hora
                codeName: 'programmer',
                baseReward: 250,
                variation: 150,
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
                cooldown: 60 * 60 * 3000, // 3 hora
                codeName: 'abrepuertasoxxo',
                baseReward: 1200,
                variation: 900,
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
                cooldown: 60 * 60 * 1000, // 1 hora
                codeName: 'doctor',
                baseReward: 400,
                variation: 200,
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
                cooldown: 60 * 60 * 1000, // 1 hora
                codeName: 'botargadrsimi',
                baseReward: 700,
                variation: 500,
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
                cooldown: 60 * 60 * 1000, // 1 hora
                codeName: 'criminal',
                baseReward: 600,
                variation: 400,
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
                cooldown: 60 * 60 * 1000, // 1 hora
                codeName: 'vendedordelpunto',
                baseReward: 1200,
                variation: 1500,
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
                cooldown: 60 * 60 * 1000, // 1 hora
                codeName: 'ofseller',
                baseReward: 1000,
                variation: 800,
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
            'paranormalinv': {
                name: '👻 Investigador Paranormal',
                cooldown: 60 * 60 * 1000, // 1 hora
                codeName: 'paranormalinv',
                baseReward: 1500,
                variation: 1300,
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
            }
        };
    }

    // Verificar si puede trabajar
    async canWork(userId, jobType) {
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
        
        // Aplicar reducción de cooldown por eventos
        let effectiveCooldown = job.cooldown * (1 - modifiers.reduction);

        for (const event of this.events.getActiveEvents()) {
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

        if (now - lastWork < effectiveCooldown) {
            const timeLeft = effectiveCooldown - (now - lastWork);
            return { canWork: false, reason: 'cooldown', timeLeft: timeLeft };
        }
        
        return { canWork: true };
    }

    async doWork(userId, jobType) {
        const canWorkResult = await this.canWork(userId, jobType);
        if (!canWorkResult.canWork) 
        {
            return{
                canWork: canWorkResult.canWork,
                reason: canWorkResult.reason,
                requiredLevel: canWorkResult.requiredLevel,
                timeLeft: canWorkResult.timeLeft || 0, // Solo si es cooldown
                canWorkResult: canWorkResult               
            }; 
        }
        const user = await this.getUser(userId);
        const jobs = await this.getWorkJobs();
        const job = jobs[jobType];
        
        // Verificar si falla (solo algunos trabajos tienen chance de fallar)
        const failed = job.failChance && Math.random() < job.failChance;

        const updateData = {
            last_work: Date.now(),
            last_name_work: job.name, // Para mostrar en el embed el nombre del trabajo hecho
            stats: {
                ...user.stats,
                work_count: (user.stats?.work_count || 0) + 1
            }
        }
        
        if (failed) {
            // Trabajo falló
            const failMessage = job.failMessages[Math.floor(Math.random() * job.failMessages.length)];
            const penalty = Math.floor(job.baseReward * 0.2); // Pierde 20% del reward base

            updateData.balance = Math.max(0, user.balance - penalty);
            updateData.stats.totalSpent = (user.stats?.totalSpent || 0) + penalty;

            await this.updateUser(userId, updateData); // ← Reemplaza saveUsers()
           
            return {
                name: job.name,
                success: false,
                failed: true,
                message: failMessage,
                penalty: penalty,
                oldBalance: Math.max(0, user.balance + penalty),
                newBalance: Math.max(0, user.balance),

                canWork: canWorkResult.canWork,
                reason: canWorkResult.reason,
                requiredLevel: canWorkResult.requiredLevel,
                timeLeft: canWorkResult.timeLeft || 0, // Solo si es cooldown
                canWorkResult: canWorkResult  
            };
        }
        
        // Trabajo exitoso
        const variation = Math.floor(Math.random() * (job.variation * 2)) - job.variation;
        let amount = Math.max(50, job.baseReward + variation);
        const message = job.messages[Math.floor(Math.random() * job.messages.length)];
        let eventMessage = '';
        let finalEarnings = amount;

        for (const event of this.events.getActiveEvents()) {
            if (event.type === 'money_rain') {
                finalEarnings = Math.floor(amount * 1.5); // 💰 +50%
                eventMessage = `💰 **Lluvia de Dinero** (+${finalEarnings - amount} π-b$)`;
                break;
            }
            else if (event.type === 'fever_time') {
                finalEarnings = Math.floor(amount * 1.3); // 🔥 +30%
                eventMessage = `🔥 **Tiempo Fiebre** (+${finalEarnings - amount} π-b$)`;
                break;
            }
            else if (event.type === 'market_crash') {
                finalEarnings = Math.floor(amount * 0.7); // 📉 -30%
                eventMessage = `📉 **Crisis del Mercado** (-${amount - finalEarnings} π-b$)`;
                break;
            }
            else if (event.type === 'server_anniversary') {
                finalEarnings = Math.floor(amount * 2);
                eventMessage = `🎉 **Aniversario del Servidor** (+${finalEarnings - amount} π-b$)`
                break;
            }
        }
        
        const addResult = await this.addMoney(userId, finalEarnings, 'work_reward');

        await this.updateUser(userId, updateData); // ← Reemplaza saveUsers()    

        return {
            success: true,
            amount: amount,
            message: message,
            oldBalance: user.balance,
            newBalance: addResult.newBalance,
            jobName: job.name,
            eventMessage: eventMessage,
            finalEarnings: addResult.actualAmount,
            hitLimit: addResult.hitLimit,

            canWork: canWorkResult.canWork,
            reason: canWorkResult.reason,
            requiredLevel: canWorkResult.requiredLevel,
            timeLeft: canWorkResult.timeLeft || 0, // Solo si es cooldown
            canWorkResult: canWorkResult               
        };
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

        const protection = await this.shop.isProtectedFromTheft(targetId);
        if (protection.protected) {
            return message.reply(`🛡️ ${targetUser} está protegido contra robos!`);
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
    
    // 4. Función para consumir efectos de uso limitado
    async consumeUsageEffects(userId, action) {
        const user = await this.getUser(userId);
        const activeEffects = user.activeEffects || {};
        let updated = false;
        
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            for (let i = effects.length - 1; i >= 0; i--) {
                const effect = effects[i];
                
                // Solo procesar efectos que afecten esta acción
                if (!effect.targets.includes(action) && !effect.targets.includes('all')) continue;
                
                // Solo efectos con usos limitados
                if (!effect.usesLeft) continue;
                
                effect.usesLeft--;
                
                if (effect.usesLeft <= 0) {
                    effects.splice(i, 1);
                    updated = true;
                }
            }
            
            // Limpiar arrays vacíos
            if (effects.length === 0) {
                delete activeEffects[itemId];
                updated = true;
            }
        }
        
        if (updated) {
            await this.updateUser(userId, { activeEffects });
        }
    }

    // Iniciar un robo
    async startRobbery(robberId, targetId) {
        const canRobResult = await this.canRob(robberId, targetId);
        
        if (!canRobResult.canRob) {
            return canRobResult;
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
        
        this.activeRobberies.set(robberId, robberyData);
        
        // Auto-cleanup después del tiempo límite
        setTimeout(() => {
            if (this.activeRobberies.has(robberId)) {
                this.activeRobberies.delete(robberId);
            }
        }, this.robberyConfig.buttonTimeLimit + 5000); // +5 segundos de gracia
        
        return {
            success: true,
            robberyData: robberyData
        };
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
    async finishRobbery(robberId) {
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
            
            // Calcular probabilidad de éxito basada en clicks
            const clickEfficiency = Math.min(robberyData.clicks / this.robberyConfig.maxClicks, 1);
            const baseSuccessChance = 1 - this.robberyConfig.failChance;
            const finalSuccessChance = baseSuccessChance + (clickEfficiency * 0.3); // Bonus por clicks

            console.log(`🎲 Probabilidad de éxito: ${finalSuccessChance * 100}%`);
            
            const success = Math.random() < finalSuccessChance;
            
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
                    hitLimit: addResult.hitLimit
                };
                
            } else {
                // ROBO FALLIDO
                console.log(`❌ Robo fallido!`);
                const penalty = Math.floor(robber.balance * (this.robberyConfig.penaltyPercentage / 100));
                
                robberUpdateData.balance = Math.max(0, robber.balance - penalty);
                robberUpdateData.stats = {
                    ...robber.stats,
                    totalSpent: (robber.stats.totalSpent || 0) + penalty,
                };   
                
                await this.updateUser(robberId, robberUpdateData);
                
                console.log(`🚨 Robo fallido: ${robberId} perdió ${penalty} ${this.config.currencySymbol} como penalización`);
                
                return {
                    success: true,
                    robberySuccess: false,
                    penalty: penalty,
                    clicks: robberyData.clicks,
                    maxClicks: this.robberyConfig.maxClicks,
                    efficiency: Math.round(clickEfficiency * 100),
                    robberOldBalance: robber.balance,
                    robberNewBalance: Math.max(0, robber.balance - penalty),
                    targetId: robberyData.targetId
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
