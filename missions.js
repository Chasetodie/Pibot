const { EmbedBuilder } = require('discord.js');
const EventsSystem = require('./events');

class MissionsSystem {
    constructor(economySystem) {
        this.economy = economySystem;
        this.events = null;

        this.lastResetDay = null;
        
        // ✅ AGREGAR: Caché para misiones
        this.missionsCache = new Map();
        this.MAX_CACHE_SIZE = 500;
        this.cacheTimeout = 10 * 60 * 1000; // 10 minutos

        // ✅ AGREGAR: Rate limiting para updateMissionProgress
        this.updateCooldowns = new Map();
        
        // Todas las misiones disponibles
        this.availableMissions = {
            // Misiones de mensajes
            'send_messages_10': {
                id: 'send_messages_10',
                name: '💬 Conversador',
                description: 'Envía 10 mensajes en el servidor',
                type: 'messages',
                target: 10,
                reward: { money: 200, xp: 100 },
                rarity: 'common'
            },
            'send_messages_25': {
                id: 'send_messages_25',
                name: '🗣️ Hablador',
                description: 'Envía 25 mensajes en el servidor',
                type: 'messages',
                target: 25,
                reward: { money: 400, xp: 200 },
                rarity: 'uncommon'
            },
            'send_messages_50': {
                id: 'send_messages_50',
                name: '📢 Locutor',
                description: 'Envía 50 mensajes en el servidor',
                type: 'messages',
                target: 50,
                reward: { money: 800, xp: 400 },
                rarity: 'rare'
            },
            
            // Misiones de trabajo
            'work_once': {
                id: 'work_once',
                name: '🛠️ Un Día de Trabajo',
                description: 'Completa un trabajo exitoso',
                type: 'work',
                target: 1,
                reward: { money: 300, xp: 150 },
                rarity: 'common'
            },
            'work_3_times': {
                id: 'work_3_times',
                name: '💪 Trabajador Dedicado',
                description: 'Completa 3 trabajos en el día',
                type: 'work',
                target: 3,
                reward: { money: 700, xp: 350 },
                rarity: 'uncommon'
            },
            'work_5_times': {
                id: 'work_5_times',
                name: '🏭 Trabajador Incansable',
                description: 'Completa 5 trabajos en el día',
                type: 'work',
                target: 5,
                reward: { money: 1200, xp: 600 },
                rarity: 'rare'
            },
            
            // Misiones de dinero
            'earn_1000': {
                id: 'earn_1000',
                name: '💰 Ganador Modesto',
                description: 'Gana 1,000 π-b$ en el día',
                type: 'money_earned_today',
                target: 1000,
                reward: { money: 500, xp: 200 },
                rarity: 'common'
            },
            'earn_5000': {
                id: 'earn_5000',
                name: '💸 Empresario',
                description: 'Gana 5,000 π-b$ en el día',
                type: 'money_earned_today',
                target: 5000,
                reward: { money: 1000, xp: 400 },
                rarity: 'uncommon'
            },
            'earn_10000': {
                id: 'earn_10000',
                name: '🏆 Magnate',
                description: 'Gana 10,000 π-b$ en el día',
                type: 'money_earned_today',
                target: 10000,
                reward: { money: 2000, xp: 800 },
                rarity: 'rare'
            },
            
            // Misiones de juegos
            'play_games_3': {
                id: 'play_games_3',
                name: '🎮 Jugador Casual',
                description: 'Juega 3 minijuegos',
                type: 'games',
                target: 3,
                reward: { money: 400, xp: 200 },
                rarity: 'common'
            },
            'play_games_10': {
                id: 'play_games_10',
                name: '🎯 Jugador Activo',
                description: 'Juega 10 minijuegos',
                type: 'games',
                target: 10,
                reward: { money: 800, xp: 400 },
                rarity: 'uncommon'
            },
            'win_games_5': {
                id: 'win_games_5',
                name: '🏅 Ganador',
                description: 'Gana 5 minijuegos',
                type: 'games_won',
                target: 5,
                reward: { money: 1000, xp: 500 },
                rarity: 'rare'
            },
            
            // Misiones de transferencias
            'transfer_money': {
                id: 'transfer_money',
                name: '🤝 Generoso',
                description: 'Transfiere 1,000 π-b$ a otro usuario',
                type: 'money_transferred',
                target: 1000,
                reward: { money: 600, xp: 300 },
                rarity: 'uncommon'
            },
            'transfer_money_big': {
                id: 'transfer_money_big',
                name: '💝 Filántropo',
                description: 'Transfiere 5,000 π-b$ a otros usuarios',
                type: 'money_transferred',
                target: 5000,
                reward: { money: 1500, xp: 750 },
                rarity: 'rare'
            },
                        
            // Misiones de balance
            'maintain_balance_10k': {
                id: 'maintain_balance_10k',
                name: '💎 Rico Mantenido',
                description: 'Mantén un balance de 10,000 π-b$ o más',
                type: 'balance_check',
                target: 10000,
                reward: { money: 1000, xp: 500 },
                rarity: 'uncommon'
            },
            'maintain_balance_50k': {
                id: 'maintain_balance_50k',
                name: '👑 Millonario Activo',
                description: 'Mantén un balance de 50,000 π-b$ o más',
                type: 'balance_check',
                target: 50000,
                reward: { money: 2500, xp: 1000 },
                rarity: 'epic'
            },
            
            // Misiones de apuestas
            'bet_money': {
                id: 'bet_money',
                name: '🎲 Apostador',
                description: 'Apuesta un total de 2,000 π-b$',
                type: 'money_bet',
                target: 2000,
                reward: { money: 800, xp: 300 },
                rarity: 'common'
            },
            'win_bets': {
                id: 'win_bets',
                name: '🍀 Afortunado',
                description: 'Gana 3 apuestas',
                type: 'bets_won',
                target: 3,
                reward: { money: 1200, xp: 500 },
                rarity: 'uncommon'
            },
            
            // Misiones de robos
            'successful_robbery': {
                id: 'successful_robbery',
                name: '🦹 Ladrón Exitoso',
                description: 'Completa un robo exitoso',
                type: 'successful_robberies',
                target: 1,
                reward: { money: 1000, xp: 400 },
                rarity: 'rare'
            },
            
            // Misiones especiales
            'use_daily': {
                id: 'use_daily',
                name: '📅 Rutinario',
                description: 'Reclama tu daily reward',
                type: 'daily_claimed',
                target: 1,
                reward: { money: 300, xp: 150 },
                rarity: 'common'
            },
            'complete_all_missions': {
                id: 'complete_all_missions',
                name: '🏆 Completista Diario',
                description: 'Completa todas las misiones del día',
                type: 'missions_completed',
                target: 4, // Las otras 4 misiones (esta no se cuenta a sí misma)
                reward: { money: 2000, xp: 1000 },
                rarity: 'epic'
            },
            
            // Misiones de actividad social
            'mention_someone': {
                id: 'mention_someone',
                name: '👥 Social',
                description: 'Menciona a 3 usuarios diferentes',
                type: 'mentions_made',
                target: 3,
                reward: { money: 400, xp: 200 },
                rarity: 'common'
            },
            
            // Misiones de constancia
            'active_hours': {
                id: 'active_hours',
                name: '⏰ Activo Todo El Día',
                description: 'Envía mensajes en 6 horas diferentes del día',
                type: 'active_hours',
                target: 6,
                reward: { money: 1500, xp: 600 },
                rarity: 'rare'
            }
        };
        
        // Colores por rareza
        this.rarityColors = {
            'common': '#FFFFFF',
            'uncommon': '#1EFF00',
            'rare': '#0099FF',
            'epic': '#CC00FF',
            'legendary': '#FF6600'
        };
        
        // Emojis por rareza
        this.rarityEmojis = {
            'common': '⚪',
            'uncommon': '🟢',
            'rare': '🔵',
            'epic': '🟣',
            'legendary': '🟠'
        };

        setInterval(() => {
            const now = Date.now();
            for (const [key, timestamp] of this.updateCooldowns.entries()) {
                if (now - timestamp > 60000) { // Limpiar después de 1 minuto
                    this.updateCooldowns.delete(key);
                }
            }
        }, 60000);

        // Iniciar sistema de reset automático
        this.startDailyReset();
        
        // Limpiar caché periódicamente
        this.startCacheCleanup();
    }
    
    // Generar misiones del día (se ejecuta automáticamente a las 12 PM)
    generateDailyMissions() {
        const allMissions = Object.values(this.availableMissions);
        
        // Asegurar que al menos una misión de cada rareza esté presente
        const missionsByRarity = {
            common: allMissions.filter(m => m.rarity === 'common'),
            uncommon: allMissions.filter(m => m.rarity === 'uncommon'),
            rare: allMissions.filter(m => m.rarity === 'rare'),
            epic: allMissions.filter(m => m.rarity === 'epic')
        };
        
        const selectedMissions = [];
        const usedMissionIds = new Set();
        
        // Función auxiliar para seleccionar misión sin repetir
        const selectUniqueMission = (missionsArray) => {
            const availableMissions = missionsArray.filter(m => !usedMissionIds.has(m.id));
            if (availableMissions.length === 0) {
                // Si no hay misiones disponibles en esta rareza, tomar de cualquier rareza
                const allAvailable = allMissions.filter(m => !usedMissionIds.has(m.id));
                if (allAvailable.length === 0) return null;
                return allAvailable[Math.floor(Math.random() * allAvailable.length)];
            }
            return availableMissions[Math.floor(Math.random() * availableMissions.length)];
        };
        
        // Seleccionar misiones por rareza: 1 common, 2 uncommon, 1 rare, 1 epic
        const rarityPlan = [
            { rarity: 'common', count: 1 },
            { rarity: 'uncommon', count: 2 },
            { rarity: 'rare', count: 1 },
            { rarity: 'epic', count: 1 }
        ];
        
        for (const plan of rarityPlan) {
            for (let i = 0; i < plan.count; i++) {
                const mission = selectUniqueMission(missionsByRarity[plan.rarity]);
                if (mission) {
                    selectedMissions.push(mission);
                    usedMissionIds.add(mission.id);
                }
            }
        }
        
        // Si no llegamos a 5 misiones, completar con misiones aleatorias
        while (selectedMissions.length < 5) {
            const availableMissions = allMissions.filter(m => !usedMissionIds.has(m.id));
            if (availableMissions.length === 0) break; // No hay más misiones disponibles
            
            const randomMission = availableMissions[Math.floor(Math.random() * availableMissions.length)];
            selectedMissions.push(randomMission);
            usedMissionIds.add(randomMission.id);
        }
        
        // Convertir a formato requerido
        return selectedMissions.map(mission => ({
            id: mission.id,
            completed: false
        }));
    }
    
    getRandomMission(missionsArray) {
        return missionsArray[Math.floor(Math.random() * missionsArray.length)];
    }
    
    // Obtener el día actual en formato YYYY-MM-DD
    getCurrentDay() {
        const now = new Date();
        const ecuadorOffset = -5; // UTC-5
        
        // ✅ CAMBIAR: Usar getTimezoneOffset() para ser más preciso
        const ecuadorTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (-5 * 3600000));
        
        const dateString = ecuadorTime.toISOString().split('T')[0];
                
        return dateString;
    }

    isNewDay(lastResetDate) {
        const today = this.getCurrentDay();
        return !lastResetDate || lastResetDate !== today;
    }

    // Agregar esta función después de getCurrentDay()
    resetDailyFlag(user) {
        const now = new Date();
        const ecuadorTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        const today = ecuadorTime.toISOString().split('T')[0];
        const currentHour = ecuadorTime.getHours();
        
        if (user.daily_missions_date !== today) {
            return { missions_reset_today: false };
        }
        return {};
    }
    
    // Verificar si es hora de resetear misiones (12 PM)
    shouldResetMissions(user) {
        const today = this.getCurrentDay();
        const userLastReset = user.daily_missions_date;
               
        // Si es diferente día, necesita reset
        const needsReset = !userLastReset || userLastReset !== today;
        
        return needsReset;
    }

    startDailyReset() {
        // Verificar cada minuto si es medianoche en Ecuador
        setInterval(() => {
            this.checkAndResetAllMissions();
        }, 30000); // 30 segundos en lugar de 60
        
        console.log('🕛 Sistema de reset automático iniciado');
    }

    async checkAndResetAllMissions() {
        const now = new Date();
        const ecuadorTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (-5 * 3600000));
        const currentHour = ecuadorTime.getHours();
        const currentMinute = ecuadorTime.getMinutes();

        const currentDay = ecuadorTime.toISOString().split('T')[0];
        
        // Solo ejecutar a las 00:00 (medianoche)
        if (currentHour === 0 && currentMinute === 0) {
            console.log('🌅 Iniciando reset automático de misiones...');
            
            this.lastResetDay = currentDay;
            this.missionsCache.clear();
            
            console.log('✅ Reset automático completado');
        }
    }
    
    // Inicializar misiones diarias para un usuario

    
    async initializeDailyMissions(userId) {
        const cacheKey = `missions_${userId}`;
        const cached = this.missionsCache.get(cacheKey);
        const now = Date.now();
        
        // Si hay caché válido, usar eso
        if (cached && (now - cached.timestamp) < this.cacheTimeout) {
            // Pero también verificar si es un nuevo día
            const user = cached.data;
            if (!this.shouldResetMissions(user)) {
                return user.daily_missions || {};
            }
        }
        
        // Si no hay caché, obtener de DB normalmente
        const user = await this.economy.getUser(userId);

        console.log(`👤 User ${userId} - Last reset: ${user.daily_missions_date}`);
        console.log(`📅 Current day: ${this.getCurrentDay()}`);
        console.log(`🔄 Should reset: ${this.shouldResetMissions(user)}`);

        // Resetear bandera si es necesario
        const flagReset = this.resetDailyFlag(user);
        if (Object.keys(flagReset).length > 0) {
            await this.economy.updateUser(userId, flagReset);
        }
        
        if (this.shouldResetMissions(user)) {
            console.log(`🔄 Reseteando misiones para usuario ${userId}`);
            
            const newMissions = this.generateDailyMissions();
            const today = this.getCurrentDay();
            
            const updateData = {
                daily_missions: newMissions.reduce((obj, mission) => {
                    obj[mission.id] = 'incomplete';
                    return obj;
                }, {}),
                daily_missions_date: today,
                missions_reset_today: true,
                daily_stats: {
                    messages_today: 0,
                    work_today: 0,
                    money_earned_today: 0,
                    games_today: 0,
                    games_won_today: 0,
                    money_transferred_today: 0,
                    level_ups_today: 0,
                    money_bet_today: 0,
                    bets_won_today: 0,
                    successful_robberies_today: 0,
                    daily_claimed_today: false,
                    mentions_made_today: 0,
                    active_hours_today: []
                }
            };
            
            await this.economy.updateUser(userId, updateData);

            // Actualizar caché
            const updatedUser = { ...user, ...updateData };
            this.missionsCache.set(cacheKey, {
                data: updatedUser,
                timestamp: now
            });
            
            console.log(`🎯 Misiones diarias inicializadas para ${userId}`);
            
            return updateData.daily_missions;
        }

        this.missionsCache.set(cacheKey, {
            data: user,
            timestamp: now
        });
        
        return user.daily_missions || {};
    }

    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            
            // Limpiar por tiempo
            for (const [key, cached] of this.missionsCache) {
                if (now - cached.timestamp > this.cacheTimeout) {
                    this.missionsCache.delete(key);
                }
            }
            
            // Limpiar por tamaño si excede el límite
            if (this.missionsCache.size > this.MAX_CACHE_SIZE) {
                const entries = Array.from(this.missionsCache.entries());
                const toDelete = entries
                    .sort((a, b) => a[1].timestamp - b[1].timestamp)
                    .slice(0, entries.length - this.MAX_CACHE_SIZE);
                    
                for (const [tradeId] of toDelete) {
                    this.missionsCache.delete(tradeId);
                }
            }
            
            console.log(`🧹 Cache cleanup: ${this.missionsCache.size} misiones en memoria`);
        }, 10 * 60 * 1000);
    }
    
    // Actualizar progreso de misiones
    async updateMissionProgress(userId, actionType, value, maxChecks = 3, checkedInSession = new Set()) {        
        const cooldownKey = `mission_update_${userId}`;
        if (this.updateCooldowns.has(cooldownKey)) {
            const lastUpdate = this.updateCooldowns.get(cooldownKey);
            if (Date.now() - lastUpdate < 100) { // 1 segundo de cooldown
                return [];
            }
        }
        this.updateCooldowns.set(cooldownKey, Date.now());

        const cacheKey = `missions_${userId}`;
        let user = this.missionsCache.get(cacheKey);

        const now = Date.now();

        // Siempre obtener datos frescos para evitar problemas de caché
        await this.initializeDailyMissions(userId);
        const freshUser = await this.economy.getUser(userId);
        user = freshUser;

        // Actualizar caché inmediatamente
        this.missionsCache.set(cacheKey, {
            data: user,
            timestamp: now
        });

        if (maxChecks <= 0) {
            console.log(`⚠️ Límite de verificaciones alcanzado para ${userId}`);
            return [];
        }
        
        if (!user.daily_missions || !user.daily_stats) return;
        
        const updateData = {};
        const completedMissions = [];

        updateData.daily_stats = { ...user.daily_stats };
        
        // Actualizar estadísticas diarias según el tipo de acción
        switch (actionType) {
            case 'message':
                updateData.daily_stats.messages_today = (user.daily_stats.messages_today || 0) + 1;
                
                // Agregar hora actual para misión de active_hours
                const currentHour = new Date().getHours();
                const activeHours = user.daily_stats.active_hours_today || [];
                if (!activeHours.includes(currentHour)) {
                    activeHours.push(currentHour);
                    updateData.daily_stats.active_hours_today = activeHours;
                }
                break;
            case 'work':
                updateData.daily_stats.work_today = (user.daily_stats.work_today || 0) + 1;
                break;
            case 'money_earned_today':
                updateData.daily_stats.money_earned_today = (user.daily_stats.money_earned_today || 0) + value;
                break;     
            case 'game_played':
                updateData.daily_stats.games_today = (user.daily_stats.games_today || 0) + 1;
                break;
                
            case 'game_won':
                updateData.daily_stats.games_won_today = (user.daily_stats.games_won_today || 0) + 1;
                break;
                
            case 'money_transferred':
                updateData.daily_stats.money_transferred_today = (user.daily_stats.money_transferred_today || 0) + value;
                break;
                
            case 'level_up':
                updateData.daily_stats.level_ups_today = (user.daily_stats.level_ups_today || 0) + 1;
                break;
                
            case 'money_bet':
                updateData.daily_stats.money_bet_today = (user.daily_stats.money_bet_today || 0) + value;
                break;
                
            case 'bet_won':
                updateData.daily_stats.bets_won_today = (user.daily_stats.bets_won_today || 0) + 1;
                break;
                
            case 'successful_robbery':
                updateData.daily_stats.successful_robberies_today = (user.daily_stats.successful_robberies_today || 0) + 1;
                break;
                
            case 'daily_claimed':
                updateData.daily_stats.daily_claimed_today = true;
                break;

            case 'mention_made':
                updateData.daily_stats.mentions_made_today = (user.daily_stats.mentions_made_today || 0) + value;
                break;
        }
       
        // Verificar progreso de cada misión
        for (const [missionId, status] of Object.entries(user.daily_missions)) {
            if (status === 'completed' || checkedInSession.has(missionId)) continue;
            
            const mission = this.availableMissions[missionId];
            if (!mission) continue;
            
            const currentProgress = this.getCurrentProgress(user, mission);
            
            if (currentProgress >= mission.target && !updateData.daily_missions?.[missionId]) {
                // Marcar como verificado en esta sesion
                checkedInSession.add(missionId);

                if (!updateData.daily_missions) {
                    updateData.daily_missions = { ...user.daily_missions };
                }

                updateData.daily_missions[missionId] = 'completed';
                user.daily_missions[missionId] = 'completed';


                completedMissions.push(missionId);
                
                // Dar recompensas
                if (mission.reward.money && user.balance < this.economy.config.maxBalance) {
                    let finalEarnings = mission.reward.money;
                    let eventMessage = '';

                    for (const event of this.events.getActiveEvents()) {
                        if (event.type === 'fever_time') {
                            finalEarnings = Math.floor(mission.reward.money * 1.4); // 🔥 +30%
                            eventMessage = `🔥 **Tiempo Fiebre** (+${finalEarnings - mission.reward.money} π-b$)`;
                            break;
                        }
                        else if (event.type === 'market_crash') {
                            finalEarnings = Math.floor(mission.reward.money * 0.8); // 📉 -30%
                            eventMessage = `📉 **Crisis del Mercado** (-${mission.reward.money - finalEarnings} π-b$)`;
                            break;
                        }
                        else if (event.type === 'server_anniversary') {
                            finalEarnings = Math.floor(mission.reward.money * 2);
                            eventMessage = `🎉 **Aniversario del Servidor** (+${finalEarnings - mission.reward.money} π-b$)`
                        }
                    }

                    if (user.balance + finalEarnings > this.economy.config.maxBalance) {
                        const spaceLeft = this.economy.config.maxBalance - user.balance;
                        finalEarnings = Math.min(finalEarnings, spaceLeft);
                    }
                    
                    const addResult = await this.economy.addMoney(userId, finalEarnings, 'mission_reward');
                    updateData.balance = addResult.newBalance;
                    finalEarnings = addResult.actualAmount;
                    
                    updateData.stats = {
                        ...user.stats,
                        message_missions: eventMessage
                    };
                }
                else if (mission.reward.money && user.balance >= this.economy.config.maxBalance) {
                    updateData.stats = {
                        ...user.stats,
                        message_missions: '💰 **Límite de balance alcanzado** - Solo se otorgó XP'
                    }
                }
            }
        }
                
        // Agregar XP por separado para las misiones completadas
        for (const missionId of completedMissions) {
            const mission = this.availableMissions[missionId];
            if (mission.reward.xp) {
                let finalXp = mission.reward.xp;
                let eventMessage2 = '';
                
                for (const event of this.events.getActiveEvents()) {
                    if (event.type === 'double_xp') {
                        finalXp = mission.reward.xp * 2; // Exactamente x2
                        eventMessage2 = `\n⚡ **Doble XP** (+${finalXp - mission.reward.xp} XP)`;
                        break;
                    }
                    else if (event.type === 'fever_time') {
                        finalXp = Math.floor(mission.reward.xp * 1.5); // x1.5
                        eventMessage2 = `\n🔥 **Tiempo Fiebre** (+${finalXp - mission.reward.xp} XP)`;
                        break;
                    }
                    else if (event.type === 'server_anniversary') {
                        finalXp = Math.floor(mission.reward.xp * 3); // x3
                        eventMessage2 = `\n🎉 **Aniversario del Servidor** (+${finalXp - mission.reward.xp} XP)`;
                        break;
                    }
                }
                await this.economy.addXp(userId, finalXp);

                updateData.stats = {
                    ...user.stats,
                    message_missions2: eventMessage2
                };
            }
        }

        // Actualizar base de datos
        await this.economy.updateUser(userId, updateData);   
        user = { ...user, ...updateData };
        if (updateData.daily_stats) {
            user.daily_stats = { ...user.daily_stats, ...updateData.daily_stats };
        }
        
        // Actualizar caché con los nuevos datos
        const updatedUser = { ...user, ...updateData};
        this.missionsCache.set(cacheKey, {
            data: updatedUser,
            timestamp: Date.now()
        });
       
        return completedMissions;
    }
    
    // Obtener progreso actual de una misión
    getCurrentProgress(user, mission) {
        const stats = user.daily_stats || {};
        
        switch (mission.type) {
            case 'messages':
                return stats.messages_today || 0;
            case 'work':
                return stats.work_today || 0;
            case 'money_earned_today':
                return stats.money_earned_today || 0;
            case 'games':
                return stats.games_today || 0;
            case 'games_won':
                return stats.games_won_today || 0;
            case 'money_transferred':
                return stats.money_transferred_today || 0;
            case 'level_ups':
                return stats.level_ups_today || 0;
            case 'balance_check':
                return user.balance || 0;
            case 'money_bet':
                return stats.money_bet_today || 0;
            case 'bets_won':
                return stats.bets_won_today || 0;
            case 'successful_robberies':
                return stats.successful_robberies_today || 0;
            case 'daily_claimed':
                return stats.daily_claimed_today ? 1 : 0;
            case 'missions_completed':
                return Object.values(user.daily_missions || {}).filter(status => status === 'completed').length;
            case 'mentions_made':
                return stats.mentions_made_today || 0;
            case 'active_hours':
                return (stats.active_hours_today || []).length;
            default:
                return 0;
        }
    }
    
    // Mostrar misiones del usuario
    async showUserMissions(message, targetUser = null) {
        const userId = targetUser ? targetUser.id : message.author.id;
        const displayName = targetUser ? targetUser.displayName : message.author.displayName;
        
        await this.initializeDailyMissions(userId);
        const user = await this.economy.getUser(userId);
        
        const embed = new EmbedBuilder()
            .setTitle(`🎯 Misiones Diarias de ${displayName}`)
            .setDescription(`Misiones disponibles para hoy`)
            .setColor('#FFD700')
            .setThumbnail((targetUser || message.author).displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        
        if (!user.daily_missions) {
            embed.addFields({
                name: '❌ Sin Misiones',
                value: 'No hay misiones disponibles para hoy.',
                inline: false
            });
            
            await message.reply({ embeds: [embed] });
            return;
        }
        
        let completedCount = 0;
        let missionText = '';
        
        for (const [missionId, status] of Object.entries(user.daily_missions)) {
            const mission = this.availableMissions[missionId];
            if (!mission) continue;
            
            const isCompleted = status === 'completed';
            if (isCompleted) completedCount++;
            
            const currentProgress = this.getCurrentProgress(user, mission);
            const progressPercent = Math.min(100, (currentProgress / mission.target) * 100);
            
            const statusEmoji = isCompleted ? '✅' : '⏳';
            const rarityEmoji = this.rarityEmojis[mission.rarity];
            const progressBar = this.createProgressBar(currentProgress, mission.target, 8);
            
            missionText += `${statusEmoji} ${rarityEmoji} **${mission.name}**\n`;
            missionText += `${mission.description}\n`;
            missionText += `\`${progressBar}\` ${currentProgress}/${mission.target}\n`;
            
            if (isCompleted) {
                missionText += `💰 **Completada** - Recompensa obtenida\n\n`;
            } else {
                const rewards = [];
                if (mission.reward.money) rewards.push(`${mission.reward.money} π-b$`);
                if (mission.reward.xp) rewards.push(`${mission.reward.xp} XP`);
                missionText += `🎁 Recompensa: ${rewards.join(' + ')}\n\n`;
            }
        }
        
        embed.addFields({
            name: `📊 Progreso Total (${completedCount}/5)`,
            value: missionText || 'Sin misiones disponibles',
            inline: false
        });

        const notificationsBlocked = await this.areMissionNotificationsBlocked(userId);
        
        const timeUntilReset = this.getTimeUntilMissionReset();

        let footerText = `⏰ Nuevas misiones en: ${timeUntilReset}`;
        if (notificationsBlocked) {
            footerText += ' | 🔇 Notificaciones desactivadas';
        }
        
        embed.setFooter({ text: footerText });
        
        await message.reply({ embeds: [embed] });
    }

    // ✅ NUEVA FUNCIÓN: Calcular tiempo hasta el próximo reset
    getTimeUntilMissionReset() {
        const now = new Date();
        const ecuadorTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (-5 * 3600000));
        
        // Horas hasta medianoche
        const hoursUntilMidnight = 23 - ecuadorTime.getHours();
        const minutesUntilMidnight = 59 - ecuadorTime.getMinutes();
        
        return `${hoursUntilMidnight}h ${minutesUntilMidnight}m`;
    }
    
    // Crear barra de progreso
    createProgressBar(current, max, length = 8) {
        const percentage = Math.max(0, Math.min(1, current / max));
        const filledLength = Math.floor(percentage * length);
        const emptyLength = length - filledLength;
        
        return '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    }

    async toggleMissionNotifications(userId, block = true) {
        const updateData = {
            missions_notifications_blocked: block
        };
        
        await this.economy.updateUser(userId, updateData);
        return block;
    }
    
    async areMissionNotificationsBlocked(userId) {
        const user = await this.economy.getUser(userId);
        return user.missions_notifications_blocked || false;
    }
    
    // Notificar misiones completadas
    async notifyCompletedMissions(message, completedMissions) {
        if (completedMissions.length === 0) return;

        const userId = message.author?.id || message.user?.id;

        const notificationsBlocked = await this.areMissionNotificationsBlocked(userId);
        if (notificationsBlocked) {
            return;
        }
        
        const user = await this.economy.getUser(userId);
        
        for (const missionId of completedMissions) {
            const mission = this.availableMissions[missionId];
            if (!mission) continue;
            
            const rarityColor = this.rarityColors[mission.rarity];
            const rarityEmoji = this.rarityEmojis[mission.rarity];
            
            const embed = new EmbedBuilder()
                .setTitle('🎉 ¡Misión Completada!')
                .setDescription(`${rarityEmoji} **${mission.name}**\n\n*${mission.description}*`)
                .setColor(rarityColor)
                .setTimestamp();
            
            const rewards = [];
            if (mission.reward.money) rewards.push(`+${mission.reward.money} π-b$`);
            if (mission.reward.xp) rewards.push(`+${mission.reward.xp} XP`);
            
            if (rewards.length > 0) {
                embed.addFields(
                    {
                        name: '🎁 Recompensas',
                        value: rewards.join('\n'),
                        inline: true
                    },
                    { name: '🎉 Extra por Eventos', value: `${user.stats.message_missions && user.stats.message_missions2 || "No hay eventos Activos"} `, inline: false }
                );
            }
            
            await message.channel.send({ 
                content: `<@${userId}>`,
                embeds: [embed],
                allowedMentions: { users: [userId] }
            });
        }
    }
    
    // Procesador de comandos
    async processCommand(message) {
        const args = message.content.toLowerCase().split(' ');
        const command = args[0];
        
        try {
            switch (command) {
                case '>missions':
                case '>misiones':
                case '>dailymissions':
                    let targetUser = null;
                    if (message.mentions.users.size > 0) {
                        targetUser = message.mentions.users.first();
                    }
                    await this.showUserMissions(message, targetUser);
                    break;                    
                case '>blockmissions':
                case '>bloquearnotifs':
                    await this.toggleMissionNotifications(message.author.id, true);
                    await message.reply('🔇 **Notificaciones de misiones bloqueadas**\nSeguirás completando misiones, pero no recibirás notificaciones.\n💡 Usa `>unblockmissions` para reactivarlas.');
                    break;
                case '>unblockmissions':
                case '>desbloquearnotifs':
                    await this.toggleMissionNotifications(message.author.id, false);
                    await message.reply('🔔 **Notificaciones de misiones reactivadas**\nVolverás a recibir notificaciones cuando completes misiones.');
                    break;
            }
        } catch (error) {
            console.error('❌ Error en sistema de misiones:', error);
            await message.reply('❌ Ocurrió un error en el sistema de misiones. Intenta de nuevo.');
        }
    }
        
    // Método para conectar eventos
    connectEventsSystem(eventsSystem) {
        this.events = eventsSystem;
        console.log('🎮 Sistema de eventos conectado a misiones');
    }
}

module.exports = MissionsSystem;
