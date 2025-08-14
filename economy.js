require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

class EconomySystem {
    constructor() {
        this.initializeSupabase();
        
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

        // Configuración de robos
        this.robberyConfig = {
            cooldown: 6 * 60 * 60 * 1000, // 6 horas de cooldown
            minStealPercentage: 10, // Mínimo 10%
            maxStealPercentage: 20, // Máximo 20%
            buttonTimeLimit: 30000, // 30 segundos para hacer clicks
            maxClicks: 50, // Máximo de clicks
            failChance: 0.3, // 30% de chance de fallar
            penaltyPercentage: 15, // 15% de penalización si fallas
            levelRequirement: 5, // Nivel mínimo para robar
            minTargetBalance: 500, // El objetivo debe tener al menos 500 coins
        };
        
        // Map para trackear robos activos
        this.activeRobberies = new Map();
        this.events = null;
    }

    // Inicializar Supabase
    initializeSupabase() {
        try {
            // Verificar que las variables de entorno existan
            if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
                throw new Error('❌ Variables de entorno de Supabase no configuradas. Revisa tu archivo .env');
            }

            this.supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_ANON_KEY
            );

            console.log('🚀 Supabase inicializado correctamente');
            console.log(`📊 Proyecto: ${process.env.SUPABASE_URL}`);
        } catch (error) {
            console.error('❌ Error inicializando Supabase:', error);
            console.error('💡 Asegúrate de que tu archivo .env esté configurado correctamente');
        }
    }

    // Obtener o crear datos de un usuario (MIGRADO)
    async getUser(userId) {
        try {
            // Buscar usuario existente
            const { data: existingUser, error: fetchError } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no encontrado
                throw fetchError;
            }

            if (existingUser) {
                return existingUser;
            }

            // Crear nuevo usuario si no existe
            const newUser = {
                id: userId, // En Supabase necesitamos especificar el ID
                balance: 0,
                level: 1,
                xp: 0,
                total_xp: 0, // snake_case para PostgreSQL
                last_daily: 0,
                last_work: 0,
                last_robbery: 0,
                last_coinflip: 0,
                last_dice: 0,
                last_roulette: 0,
                last_lotto: 0,
                last_blackjack: 0,
                last_name_work: "",
                messages_count: 0,
                items: {}, // JSON field en PostgreSQL
                stats: {
                    total_earned: 0,
                    total_spent: 0,
                    daily_claims: 0,
                    work_count: 0,
                    games_played: 0,
                    lottery_wins: 0,
                    robberies: 0,
                    robberies_successful: 0,
                    money_stolen: 0,
                    times_robbed: 0,
                    money_lost_to_robbers: 0
                },
                bet_stats: {
                    wins: 0,
                    losses: 0,
                    total_won: 0,
                    total_lost: 0,
                    net_profit: 0
                },
                daily_missions: {},
                daily_missions_date: null,
                daily_stats: {
                    messages_today: 0,
                    work_today: 0,
                    money_earned_today: 0
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data: createdUser, error: insertError } = await this.supabase
                .from('users')
                .insert([newUser])
                .select()
                .single();

            if (insertError) {
                throw insertError;
            }

            console.log(`👤 Nuevo usuario creado en Supabase: ${userId}`);
            return createdUser;

        } catch (error) {
            console.error('❌ Error obteniendo usuario:', error);
            throw error;
        }
    }

    // Actualizar datos de usuario (MIGRADO)
    async updateUser(userId, updateData) {
        try {
            const updateWithTimestamp = {
                ...updateData,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('users')
                .update(updateWithTimestamp)
                .eq('id', userId)
                .select();

            if (error) {
                throw error;
            }

            console.log(`💾 Usuario ${userId} actualizado en Supabase`);
            return data[0];
        } catch (error) {
            console.error('❌ Error actualizando usuario:', error);
            throw error;
        }
    }

    // Obtener todos los usuarios (MIGRADO)
    async getAllUsers() {
        try {
            const { data: users, error } = await this.supabase
                .from('users')
                .select('*');

            if (error) {
                throw error;
            }

            if (!users || users.length === 0) return {};

            // Convertir array a objeto con ID como key
            const usersObject = {};
            users.forEach(user => {
                usersObject[user.id] = user;
            });

            return usersObject;
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
            stats: {
                ...user.stats,
                totalEarned: (user.stats.totalEarned || 0) + amount
            }
        }
        
        console.log(`💰 +${amount} ${this.config.currencySymbol} para ${userId} (${reason})`);
        await this.updateUser(userId, updateData);
       
        return user.balance;
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
      
        const updateDataFrom = {
            balance: fromUser.balance - amount,
            stats: {
                ...fromUser.stats,
                total_spent: (fromUser.stats.totalSpent || 0) + amount
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
            
            // Agregar campos de level up
            updateData.level = newLevel;
            updateData.balance = user.balance + reward;
            updateData.stats = {
                ...user.stats,
                totalEarned: (user.stats.totalEarned || 0) + reward
            };

            console.log(`🎉 ${userId} subió ${levelUps} nivel(es)! Nuevo nivel: ${newLevel}, Recompensa: ${reward} ${this.config.currencySymbol}`);

            // *** NUEVO: ACTUALIZAR MISIONES DE LEVEL UP ***
            if (this.missions) {
                await this.missions.updateMissionProgress(userId, 'level_up', levelUps);
            }
            
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

    // Procesar XP por mensaje (con cooldown)
    async processMessageXp(userId) {
        const now = Date.now();
        const lastXp = this.userCooldowns.get(userId) || 0;
        // Obtener usuario (ahora async)
        const user = await this.getUser(userId);
        
        // Verificar cooldown
        if (now - lastXp < this.config.xpCooldown) {
            // Actualizar contador de mensajes
            const updateData = {
                messages_count: (user.messages_count || 0) + 1
            };
            await this.updateUser(userId, updateData);
            
            return null; // Aún en cooldown
        }
        
        try {
            this.userCooldowns.set(userId, now);

            
            if (this.events) {
                // Aplicar modificadores de eventos a XP
                const finalResult = await this.events.applyXpModifiers(userId, this.config.xpPerMessage, 'message');

                // Agregar XP (ahora async)
                const result = await this.addXp(userId, finalResult.finalXp);

                return {
                    levelUp: result.levelUp,
                    levelsGained: result.levelsGained,
                    newLevel: result.newLevel,
                    xpGained: result.xpGained,
                    reward: result.reward,
                    appliedEvents: finalResult.appliedEvents || [],
                    result: finalResult
                };
            }

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

    async getBalanceLeaderboard(limit = 10) {
        try {
            const { data: users, error } = await this.supabase
                .from('users')
                .select('id, balance, level, total_xp')
                .order('balance', { ascending: false })
                .limit(limit);

            if (error) {
                throw error;
            }
            
            return users.map(user => ({
                userId: user.id,
                balance: user.balance,
                level: user.level,
                totalXp: user.total_xp
            }));
        } catch (error) {
            console.error('❌ Error obteniendo ranking de balance:', error);
            return [];
        }
    }

    async getLevelLeaderboard(limit = 10) {
        try {
            const { data: users, error } = await this.supabase
                .from('users')
                .select('id, balance, level, total_xp')
                .order('total_xp', { ascending: false })
                .limit(limit);

            if (error) {
                throw error;
            }
            
            return users.map(user => ({
                userId: user.id,
                level: user.level,
                totalXp: user.total_xp,
                balance: user.balance
            }));
        } catch (error) {
            console.error('❌ Error obteniendo ranking de niveles:', error);
            return [];
        }
    }

    // Verificar si puede usar daily
    async canUseDaily(userId) {
        const user = await this.getUser(userId);
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        
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
        let messageEvent = '';

        if (this.events) {
            const mod = await this.events.applyMoneyModifiers(userId, amount, 'daily');
            amount = mod.finalAmount;
            messageEvent = mod.eventMessage || '';
        }
              
        const updateData = {
            last_daily: Date.now(),
            balance: user.balance + amount,
            stats: {
                ...user.stats,
                totalEarned: user.stats.totalEarned + amount,
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
            newBalance: user.balance + amount,
            messageEvent: messageEvent
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
        
        const lastWork = user.last_work || 0;
        const now = Date.now();
        
        if (now - lastWork < job.cooldown) {
            const timeLeft = job.cooldown - (now - lastWork);
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
            updateData.stats.total_spent = (user.stats?.total_spent || 0) + penalty;

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
        let messageEvent = '';

        if (this.events) {
            const mod = await this.events.applyMoneyModifiers(userId, amount, 'work');
            amount = mod.finalAmount;
            messageEvent = mod.eventMessage || '';
        }

        // === INTEGRAR EVENTOS AQUÍ ===
/*        if (this.events) {
            const mod = this.events.applyMoneyModifiers(userId, amount, 'work');
            amount = mod.finalAmount;
        }*/
        // =============================
        
        updateData.balance = user.balance + amount;
        updateData.stats.total_earned = (user.stats?.total_earned || 0) + amount;
        
        await this.updateUser(userId, updateData); // ← Reemplaza saveUsers()
        
        // *** NUEVO: ACTUALIZAR MISIONES ***
        if (this.missions) {
            const completedMissions = await this.missions.updateMissionProgress(userId, 'work');
            const moneyMissions = await this.missions.updateMissionProgress(userId, 'money_earned', amount);
            // Las notificaciones se manejan desde los comandos
        }
        
        return {
            success: true,
            amount: amount,
            message: message,
            oldBalance: user.balance,
            newBalance: user.balance + amount,
            jobName: job.name,
            messageEvent: messageEvent,

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
                
                // Actualizar balances
                robberUpdateData.balance = robber.balance + stolenAmount;
                robberUpdateData['stats.totalEarned'] = (robber.stats.totalEarned || 0) + stolenAmount;
                robberUpdateData['stats.robberiesSuccessful'] = (robber.stats.robberiesSuccessful || 0) + 1;
                robberUpdateData['stats.moneyStolen'] = (robber.stats.moneyStolen || 0) + stolenAmount;
                
                
                const targetUpdateData = {
                    balance: Math.max(0, target.balance - stolenAmount),
                    'stats.totalSpent': (target.stats.totalSpent || 0) + stolenAmount,
                'stats.timesRobbed': (target.stats.timesRobbed || 0) + 1,
                'stats.moneyLostToRobbers': (target.stats.moneyLostToRobbers || 0) + stolenAmount
                
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
                robberNewBalance: robber.balance + stolenAmount,
                targetOldBalance: target.balance,
                targetNewBalance: Math.max(0, target.balance - stolenAmount),
                targetId: robberyData.targetId,
                stealPercentage: Math.round(stealPercentage * 100)
                };
                
            } else {
                // ROBO FALLIDO
                console.log(`❌ Robo fallido!`);
                const penalty = Math.floor(robber.balance * (this.robberyConfig.penaltyPercentage / 100));
                
                robberUpdateData.balance = Math.max(0, robber.balance - penalty);
                robberUpdateData['stats.totalSpent'] = (robber.stats.totalSpent || 0) + penalty;
                
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

    // Método para conectar el sistema de eventos
    connectEventsSystem(eventsSystem) {
        this.events = eventsSystem;
        console.log('🔗 Sistema de eventos conectado a la economía');
    }
}

module.exports = EconomySystem;
