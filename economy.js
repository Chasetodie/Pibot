require('dotenv').config();
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

class EconomySystem {
    constructor() {
        this.initializeFirebase();
        
        // Configuración del sistema
        this.config = {
            currency: 'π-b Coins',
            currencySymbol: 'π-b$',
            xpPerMessage: 10, // XP base por mensaje
            xpVariation: 5,  // Variación aleatoria del XP
            xpCooldown: 15000, // 15 segundos entre mensajes que dan XP
            dailyAmount: 300,  // Cantidad base del daily
            dailyVariation: 150, // Variación del daily
            levelUpReward: 50, // π-b Coins por subir de nivel
            xpPerLevel: 100,   // XP base necesaria para nivel 1
            levelMultiplier: 1.5 // Multiplicador de XP por nivel
        };
        
        this.userCooldowns = new Map(); // Para controlar cooldowns de XP

        // Referencia a la colección de usuarios
        this.usersCollection = admin.firestore().collection('users');    
    }

    // Inicializar Firebase
    initializeFirebase() {
        try {
            // Verificar que las variables de entorno existan
            if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
                throw new Error('❌ Variables de entorno de Firebase no configuradas. Revisa tu archivo .env');
            }

            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });

            console.log('🔥 Firebase inicializado correctamente');
            console.log(`📊 Proyecto: ${process.env.FIREBASE_PROJECT_ID}`);
        } catch (error) {
            console.error('❌ Error inicializando Firebase:', error);
            console.error('💡 Asegúrate de que tu archivo .env esté configurado correctamente');
        }
    }

    // Obtener o crear datos de un usuario
    async getUser(userId) {
        try {
            const userDoc = await this.usersCollection.doc(userId).get();
            
            if (!userDoc.exists) {
                // Crear nuevo usuario
                const newUser = {
                    balance: 0, // π-b Coins iniciales
                    level: 1,
                    xp: 0,
                    totalXp: 0,
                    lastDaily: 0,
                    lastWork: 0,
                    lastNameWork: "",
                    messagesCount: 0,
                    items: {},
                    stats: {
                        totalEarned: 0, // Incluir los iniciales
                        totalSpent: 0,
                        dailyClaims: 0,
                        workCount: 0,
                        gamesPlayed: 0
                    },
                    betStats: {
                        wins: 0,
                        losses: 0,
                        totalWon: 0,
                        totalLost: 0,
                        netProfit: 0
                    },
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                
                await this.usersCollection.doc(userId).set(newUser);
                console.log(`👤 Nuevo usuario creado en Firebase: ${userId}`);
                return newUser;
            }
            
            return userDoc.data();
        } catch (error) {
            console.error('❌ Error obteniendo usuario:', error);
            throw error;
        }
    }

    // Actualizar datos de usuario
    async updateUser(userId, updateData) {
        try {
            const updateWithTimestamp = {
                ...updateData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await this.usersCollection.doc(userId).update(updateWithTimestamp);
            console.log(`💾 Usuario ${userId} actualizado en Firebase`);
        } catch (error) {
            console.error('❌ Error actualizando usuario:', error);
            throw error;
        }
    }

    async getAllUsers() {
        try {
            const snapshot = await this.usersCollection.get();
            
            if (snapshot.empty) return {};
            
            const users = {};
            snapshot.forEach(doc => {
                users[doc.id] = doc.data();
            });
            
            return users;
        } catch (error) {
            console.error('❌ Error obteniendo todos los usuarios:', error);
            return {};
        }
    }  

    // Agregar dinero a un usuario
    async addMoney(userId, amount, reason = 'unknown') {
        const user = await this.getUser(userId);

        const updateData = {
            balance: user.balance + amount,
            'stats.totalEarned': (user.stats.totalEarned || 0) + amount
        }

/*        user.balance += amount;
        user.stats.totalEarned += amount;*/
        
        console.log(`💰 +${amount} ${this.config.currencySymbol} para ${userId} (${reason})`);
        await this.updateUser(userId, updateData);
        return user.balance;
    }

    // Quitar dinero a un usuario
    async removeMoney(userId, amount, reason = 'unknown') {
        const user = await this.getUser(userId);
        if (user.balance < amount) {
            return false; // No tiene suficiente dinero
        }

        const updateData = {
            balance: user.balance - amount,
            'stats.totalSpent': (user.stats.totalSpent || 0) + amount
        }
        
        /*user.balance -= amount;
        user.stats.totalSpent += amount;*/
        
        console.log(`💸 -${amount} ${this.config.currencySymbol} para ${userId} (${reason})`);
        await this.updateUser(userId, updateData);
        return user.balance;
    }

    // Transferir dinero entre usuarios
    async transferMoney(fromUserId, toUserId, amount) {
        const fromUser = await this.getUser(fromUserId);
        const toUser = await this.getUser(toUserId);
        
        if (fromUser.balance < amount) {
            return { success: false, reason: 'insufficient_funds' };
        }
        
        if (amount <= 0) {
            return { success: false, reason: 'invalid_amount' };
        }

        const updateDataFrom = {
            balance: fromUser.balance - amount,
            'stats.totalSpent': (fromUser.stats.totalSpent || 0) + amount,
        };

        const updateDataTo = {
            balance: toUser.balance + amount,
            'stats.totalEarned': (toUser.stats.totalEarned || 0) + amount
        };

/*        fromUser.balance -= amount;
        fromUser.stats.totalSpent += amount;
        
        toUser.balance += amount;
        toUser.stats.totalEarned += amount;*/

        await this.updateUser(fromUserId, updateDataFrom);
        await this.updateUser(toUserId, updateDataTo);

        console.log(`💸 Transferencia: ${fromUserId} -> ${toUserId}, ${amount} ${this.config.currencySymbol}`);
        console.log(`💸 TotalEarned: ${updateDataTo['stats.totalEarned']} && TotalSpent: ${updateDataFrom['stats.totalSpent']}`);

        return {
            success: true,
            fromBalance: updateDataFrom.balance,
            toBalance: updateDataTo.balance
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
        
        const oldLevel = user.level;
        const newXp = user.xp + xpGained;
        const newTotalXp = user.totalXp + xpGained;
        
        // Calcular nuevo nivel
        const newLevel = this.getLevelFromXp(newTotalXp);
        const levelUps = newLevel - oldLevel;
        
        // Preparar datos para actualizar
        const updateData = {
            xp: newXp,
            totalXp: newTotalXp
        };
        
        if (levelUps > 0) {
            const reward = levelUps * this.config.levelUpReward;
            
            // Agregar campos de level up
            updateData.level = newLevel;
            updateData.balance = user.balance + reward;
            updateData['stats.totalEarned'] = user.stats.totalEarned + reward;
            
            console.log(`🎉 ${userId} subió ${levelUps} nivel(es)! Nuevo nivel: ${newLevel}, Recompensa: ${reward} ${this.config.currencySymbol}`);
            
            await this.updateUser(userId, updateData); // ← Reemplaza saveUsers()
            
            return {
                levelUp: true,
                levelsGained: levelUps,
                newLevel: newLevel,
                xpGained: xpGained,
                reward: reward
            };
        }
        
        await this.updateUser(userId, updateData); // ← Reemplaza saveUsers()
        
        return {
            levelUp: false,
            xpGained: xpGained,
            currentLevel: user.level
        };
    }

    // Procesar XP por mensaje (con cooldown) - VERSIÓN FIREBASE
    async processMessageXp(userId) {
        const now = Date.now();
        const lastXp = this.userCooldowns.get(userId) || 0;
        // Obtener usuario (ahora async)
        const user = await this.getUser(userId);
        
        // Verificar cooldown
        if (now - lastXp < this.config.xpCooldown) {
            // Actualizar contador de mensajes
            const updateData = {
                messagesCount: (user.messagesCount || 0) + 1
            };
            await this.updateUser(userId, updateData);
            
            return null; // Aún en cooldown
        }
        
        try {
            this.userCooldowns.set(userId, now);
                    
            // Agregar XP (ahora async)
            const result = await this.addXp(userId, this.config.xpPerMessage);
            
            return {
                levelUp: result.levelUp,
                levelsGained: result.levelsGained,
                newLevel: result.newLevel,
                xpGained: result.xpGained,
                reward: result.reward,
                result: result
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

    // Obtener leaderboard de dinero
    async getBalanceLeaderboard(limit = 10) {
        try {
            const snapshot = await this.usersCollection
                .orderBy('balance', 'desc')
                .limit(limit)
                .get();
            
            if (snapshot.empty) return [];
            
            const leaderboard = [];
            snapshot.forEach(doc => {
                const userData = doc.data();
                if (userData && typeof userData.balance === 'number') {
                    leaderboard.push({
                        userId: doc.id,
                        ...userData
                    });
                }
            });
            
            return leaderboard;
        } catch (error) {
            console.error('❌ Error obteniendo ranking de balance:', error);
            return [];
        }
    }

    // Obtener leaderboard de niveles
    async getLevelLeaderboard(limit = 10) {
        try {
            const snapshot = await this.usersCollection
                .orderBy('totalXp', 'desc')
                .limit(limit)
                .get();
            
            if (snapshot.empty) {
                console.log('📊 No hay usuarios en la base de datos');
                return [];
            }
            
            const leaderboard = [];
            snapshot.forEach(doc => {
                const userData = doc.data();
                // Validar que userData existe y tiene propiedades necesarias
                if (userData && typeof userData.totalXp === 'number') {
                    leaderboard.push({
                        userId: doc.id,
                        level: this.getLevelFromXp(userData.totalXp),
                        totalXp: userData.totalXp,
                        balance: userData.balance || 0,
                        ...userData
                    });
                }
            });
            
            return leaderboard;
        } catch (error) {
            console.error('❌ Error obteniendo ranking de niveles:', error);
            // Retornar array vacío en caso de error para evitar crashes
            return [];
        }
    }

    // Verificar si puede usar daily
    async canUseDaily(userId) {
        const user = await this.getUser(userId);
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        
        return (now - user.lastDaily) >= dayInMs;
    }

    // Usar comando daily
    async useDaily(userId) {
        if (!await this.canUseDaily(userId)) {
            const user = await this.getUser(userId);
            const timeLeft = 24 * 60 * 60 * 1000 - (Date.now() - user.lastDaily);
            return {
                success: false,
                timeLeft: timeLeft
            };
        }
        
        const user = await this.getUser(userId);
        const variation = Math.floor(Math.random() * (this.config.dailyVariation * 2)) - this.config.dailyVariation;
        let amount = Math.max(100, this.config.dailyAmount + variation);
       
        // Aplicar modificadores de eventos a dinero de daily
/*        if (this.events) {
            const mod = this.events.applyMoneyModifiers(userId, amount, 'daily');
            amount = mod.finalAmount;
        }*/

        const updateData = {
            lastDaily: Date.now(),
            balance: user.balance + amount,
            'stats.totalEarned': user.stats.totalEarned + amount,
            'stats.dailyClaims': user.stats.dailyClaims + 1
        }

        /*user.lastDaily = Date.now();
        user.balance += amount;
        user.stats.totalEarned += amount;
        user.stats.dailyClaims++;*/
        
        await this.updateUser(userId, updateData);
        
        return {
            success: true,
            amount: amount,
            oldBalance: user.balance,
            newBalance: user.balance + amount
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
                cooldown: 60 * 60 * 1000, // 1 hora
                codeName: 'abrepuertasoxxo',
                baseReward: 1200,
                variation: 900,
                levelRequirement: 9,
                failChance: 0.75, // 75% de fallar
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
            }
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
        
        const lastWork = user.lastWork || 0;
        const now = Date.now();
        
        if (now - lastWork < job.cooldown) {
            const timeLeft = job.cooldown - (now - lastWork);
            return { canWork: false, reason: 'cooldown', timeLeft: timeLeft };
        }
        
        return { canWork: true };
    }

    // Ejecutar trabajo
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
            lastWork: Date.now(),
            'stats.workCount': user.stats.workCount + 1
        }
        
/*        user.lastWork = Date.now();
        user.stats.workCount++;*/
        
        if (failed) {
            // Trabajo falló
            const failMessage = job.failMessages[Math.floor(Math.random() * job.failMessages.length)];
            const penalty = Math.floor(job.baseReward * 0.2); // Pierde 20% del reward base
            
            updateData.balance = Math.max(0, user.balance - penalty);
            updateData['stats.totalSpent'] = user.stats.totalSpent + penalty;
            updateData.lastNameWork = job.name; // Para mostrar en el embed el nombre del trabajo hecho

/*            user.balance = Math.max(0, user.balance - penalty);
            user.stats.totalSpent += penalty;*/
            
//            this.saveUsers();
            await this.updateUser(userId, updateData); // ← Reemplaza saveUsers()
 
            return {
                success: false,
                failed: true,
                message: failMessage,
                penalty: penalty,
                oldBalance: user.balance,
                newBalance: Math.max(0, user.balance - penalty),

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

        // === INTEGRAR EVENTOS AQUÍ ===
/*        if (this.events) {
            const mod = this.events.applyMoneyModifiers(userId, amount, 'work');
            amount = mod.finalAmount;
        }*/
        // =============================  
        
        updateData.balance = user.balance + amount;
        updateData['stats.totalEarned'] = (user.stats.totalEarned || 0) + amount;
        updateData.lastNameWork = job.name; // Para mostrar en el embed el nombre del trabajo hecho

        console.log(`Amount ${amount}\nLastWork ${updateData.lastWork}\nworkCount ${updateData.workCount}\nBalance ${updateData.balance}\nStats.TotalEarned ${updateData['stats.totalEarned']}`);

/*        user.balance += amount;
        user.stats.totalEarned += amount;*/
        
//        this.saveUsers();
        await this.updateUser(userId, updateData); // ← Reemplaza saveUsers()

        return {
            success: true,
            amount: amount,
            message: message,
            oldBalance: user.balance,
            newBalance: user.balance + amount,
            jobName: job.name,

            canWork: canWorkResult.canWork,
            reason: canWorkResult.reason,
            requiredLevel: canWorkResult.requiredLevel,
            timeLeft: canWorkResult.timeLeft || 0, // Solo si es cooldown
            canWorkResult: canWorkResult               
        };
    }
}

module.exports = EconomySystem;
