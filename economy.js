const fs = require('fs');
const path = require('path');

class EconomySystem {
    constructor() {
        this.usersFile = path.join(__dirname, 'users.json');
        this.users = this.loadUsers();
        
        // Configuración del sistema
        this.config = {
            currency: 'π-b Coins',
            currencySymbol: 'π-b$',
            xpPerMessage: 10, // XP base por mensaje
            xpVariation: 5,  // Variación aleatoria del XP
            xpCooldown: 30000, // 1 minuto entre mensajes que dan XP
            dailyAmount: 300,  // Cantidad base del daily
            dailyVariation: 150, // Variación del daily
            levelUpReward: 50, // π-b Coins por subir de nivel
            xpPerLevel: 100,   // XP base necesaria para nivel 1
            levelMultiplier: 1.5 // Multiplicador de XP por nivel
        };
        
        this.userCooldowns = new Map(); // Para controlar cooldowns de XP
    }

    // Cargar usuarios desde el archivo JSON
    loadUsers() {
        try {
            if (fs.existsSync(this.usersFile)) {
                const data = fs.readFileSync(this.usersFile, 'utf8');
                const users = JSON.parse(data);
                console.log(`💾 Datos de ${Object.keys(users).length} usuarios cargados`);
                return users;
            }
        } catch (error) {
            console.error('❌ Error cargando usuarios:', error);
        }
        
        console.log('🆕 Creando nueva base de datos de usuarios');
        return {};
    }

    // Guardar usuarios en el archivo JSON
    saveUsers() {
        try {
            fs.writeFileSync(this.usersFile, JSON.stringify(this.users, null, 2));
            console.log(`💾 Datos de ${Object.keys(this.users).length} usuarios guardados`);
        } catch (error) {
            console.error('❌ Error guardando usuarios:', error);
        }
    }

    // Obtener o crear datos de un usuario
    getUser(userId) {
        if (!this.users[userId]) {
            this.users[userId] = {
                balance: 0, // π-b Coins iniciales
                level: 1,
                xp: 0,
                totalXp: 0,
                lastDaily: 0,
                lastWork: 0,
                messagesCount: 0,
                items: {},
                stats: {
                    totalEarned: 0, // Incluir los iniciales
                    totalSpent: 0,
                    dailyClaims: 0,
                    workCount: 0
                }
            };
            this.saveUsers();
            console.log(`👤 Nuevo usuario creado: ${userId}`);
        }
        return this.users[userId];
    }

    // Agregar dinero a un usuario
    addMoney(userId, amount, reason = 'unknown') {
        const user = this.getUser(userId);
        user.balance += amount;
        user.stats.totalEarned += amount;
        
        console.log(`💰 +${amount} ${this.config.currencySymbol} para ${userId} (${reason})`);
        this.saveUsers();
        return user.balance;
    }

    // Quitar dinero a un usuario
    removeMoney(userId, amount, reason = 'unknown') {
        const user = this.getUser(userId);
        if (user.balance < amount) {
            return false; // No tiene suficiente dinero
        }
        
        user.balance -= amount;
        user.stats.totalSpent += amount;
        
        console.log(`💸 -${amount} ${this.config.currencySymbol} para ${userId} (${reason})`);
        this.saveUsers();
        return user.balance;
    }

    // Transferir dinero entre usuarios
    transferMoney(fromUserId, toUserId, amount) {
        const fromUser = this.getUser(fromUserId);
        const toUser = this.getUser(toUserId);
        
        if (fromUser.balance < amount) {
            return { success: false, reason: 'insufficient_funds' };
        }
        
        if (amount <= 0) {
            return { success: false, reason: 'invalid_amount' };
        }
        
        fromUser.balance -= amount;
        fromUser.stats.totalSpent += amount;
        
        toUser.balance += amount;
        toUser.stats.totalEarned += amount;
        
        this.saveUsers();
        
        console.log(`💸 Transferencia: ${fromUserId} -> ${toUserId}, ${amount} ${this.config.currencySymbol}`);
        
        return { 
            success: true, 
            fromBalance: fromUser.balance, 
            toBalance: toUser.balance 
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
    addXp(userId, baseXp) {
        const user = this.getUser(userId);
        const variation = Math.floor(Math.random() * (this.config.xpVariation * 2)) - this.config.xpVariation;
        const xpGained = Math.max(1, baseXp + variation);
        
        const oldLevel = user.level;
        user.xp += xpGained;
        user.totalXp += xpGained;
        
        // Calcular nuevo nivel
        const newLevel = this.getLevelFromXp(user.totalXp);
        const levelUps = newLevel - oldLevel;
        
        if (levelUps > 0) {
            user.level = newLevel;
            const reward = levelUps * this.config.levelUpReward;
            user.balance += reward;
            user.stats.totalEarned += reward;
            
            console.log(`🎉 ${userId} subió ${levelUps} nivel(es)! Nuevo nivel: ${newLevel}, Recompensa: ${reward} ${this.config.currencySymbol}`);
            
            this.saveUsers();
            return {
                levelUp: true,
                levelsGained: levelUps,
                newLevel: newLevel,
                xpGained: xpGained,
                reward: reward
            };
        }
        
        this.saveUsers();
        return {
            levelUp: false,
            xpGained: xpGained,
            currentLevel: user.level
        };
    }

    // Procesar XP por mensaje (con cooldown)
    processMessageXp(userId) {
        const now = Date.now();
        const lastXp = this.userCooldowns.get(userId) || 0;
        
        // Verificar cooldown
        if (now - lastXp < this.config.xpCooldown) {
            return null; // Aún en cooldown
        }
        
        this.userCooldowns.set(userId, now);
        const user = this.getUser(userId);
        user.messagesCount++;
        
        return this.addXp(userId, this.config.xpPerMessage);
    }

    // Obtener estadísticas de un usuario
    /*getUserStats(userId) {
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
    }*/

    // Calcular XP total necesaria para alcanzar un nivel
    getXpNeededForLevel(level) {
        let totalXp = 0;
        for (let i = 2; i <= level; i++) {
            totalXp += this.getXpForLevel(i);
        }
        return totalXp;
    }

    // Obtener leaderboard de dinero
    getMoneyLeaderboard(limit = 10) {
        return Object.entries(this.users)
            .map(([userId, userData]) => ({ userId, ...userData }))
            .sort((a, b) => b.balance - a.balance)
            .slice(0, limit);
    }

    // Obtener leaderboard de niveles
    getLevelLeaderboard(limit = 10) {
        return Object.entries(this.users)
            .map(([userId, userData]) => ({ userId, ...userData }))
            .sort((a, b) => {
                if (b.level !== a.level) return b.level - a.level;
                return b.totalXp - a.totalXp;
            })
            .slice(0, limit);
    }

    // Verificar si puede usar daily
    canUseDaily(userId) {
        const user = this.getUser(userId);
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        
        return (now - user.lastDaily) >= dayInMs;
    }

    // Usar comando daily
    useDaily(userId) {
        if (!this.canUseDaily(userId)) {
            const user = this.getUser(userId);
            const timeLeft = 24 * 60 * 60 * 1000 - (Date.now() - user.lastDaily);
            return {
                success: false,
                timeLeft: timeLeft
            };
        }
        
        const user = this.getUser(userId);
        const variation = Math.floor(Math.random() * (this.config.dailyVariation * 2)) - this.config.dailyVariation;
        let amount = Math.max(100, this.config.dailyAmount + variation);
       
        // Aplicar modificadores de eventos a dinero de daily
        if (this.events) {
            const mod = this.events.applyMoneyModifiers(userId, amount, 'daily');
            amount = mod.finalAmount;
        }

        user.lastDaily = Date.now();
        user.balance += amount;
        user.stats.totalEarned += amount;
        user.stats.dailyClaims++;
        
        this.saveUsers();
        
        return {
            success: true,
            amount: amount,
            newBalance: user.balance
        };
    }

    // Sistema de trabajos
/*    getWorkJobs() {
        return {
            'delivery': {
                name: '🚚 Delivery',
                cooldown: 30 * 60 * 1000, // 30 minutos
                baseReward: 150,
                variation: 100,
                levelRequirement: 1,
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
                cooldown: 45 * 60 * 1000, // 45 minutos
                baseReward: 250,
                variation: 150,
                levelRequirement: 5,
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
            'doctor': {
                name: '👨‍⚕️ Doctor',
                cooldown: 60 * 60 * 1000, // 1 hora
                baseReward: 400,
                variation: 200,
                levelRequirement: 10,
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
            'criminal': {
                name: '🕵️ Actividad Sospechosa',
                cooldown: 90 * 60 * 1000, // 1.5 horas
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
            }
        };
    }

    // Verificar si puede trabajar
    canWork(userId, jobType) {
        const user = this.getUser(userId);
        const jobs = this.getWorkJobs();
        const job = jobs[jobType];
        
        if (!job) return { canWork: false, reason: 'invalid_job' };
        
        if (user.level < job.levelRequirement) {
            return { canWork: false, reason: 'level_too_low', requiredLevel: job.levelRequirement };
        }
        
        const lastWork = user.lastWork || 0;
        const now = Date.now();
        
        if (now - lastWork < job.cooldown) {
            const timeLeft = job.cooldown - (now - lastWork);
            return { canWork: false, reason: 'cooldown', timeLeft: timeLeft };
        }
        
        return { canWork: true };
    }*/

    // Ejecutar trabajo
/*    doWork(userId, jobType) {
        const canWorkResult = this.canWork(userId, jobType);
        if (!canWorkResult.canWork) return canWorkResult;
        
        const user = this.getUser(userId);
        const jobs = this.getWorkJobs();
        const job = jobs[jobType];
        
        // Verificar si falla (solo algunos trabajos tienen chance de fallar)
        const failed = job.failChance && Math.random() < job.failChance;
        
        user.lastWork = Date.now();
        user.stats.workCount++;
        
        if (failed) {
            // Trabajo falló
            const failMessage = job.failMessages[Math.floor(Math.random() * job.failMessages.length)];
            const penalty = Math.floor(job.baseReward * 0.2); // Pierde 20% del reward base
            
            user.balance = Math.max(0, user.balance - penalty);
            user.stats.totalSpent += penalty;
            
            this.saveUsers();
            
            return {
                success: false,
                failed: true,
                message: failMessage,
                penalty: penalty,
                newBalance: user.balance
            };
        }
        
        // Trabajo exitoso
        const variation = Math.floor(Math.random() * (job.variation * 2)) - job.variation;
        let amount = Math.max(50, job.baseReward + variation);
        const message = job.messages[Math.floor(Math.random() * job.messages.length)];

        // === INTEGRAR EVENTOS AQUÍ ===
        if (this.events) {
            const mod = this.events.applyMoneyModifiers(userId, amount, 'work');
            amount = mod.finalAmount;
        }
        // =============================        
        user.balance += amount;
        user.stats.totalEarned += amount;
        
        this.saveUsers();
        
        return {
            success: true,
            amount: amount,
            message: message,
            newBalance: user.balance,
            jobName: job.name
        };
    }*/
}

module.exports = EconomySystem;