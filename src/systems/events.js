const { EmbedBuilder } = require('discord.js');

class EventsSystem {
    constructor(economySystem, client = null, guildConfig = null) {
        this.economy = economySystem;
        this.client = client;
        this.guildConfig = guildConfig;

        this.db = null;
        this.initializeDatabase();
        
        this.activeEvents = new Map();
        this.guild = null;

        this.eventCache = new Map();
        this.MAX_CACHE_SIZE = 500;
        this.cacheTimeout = 10 * 60 * 1000;
        
        this.eventTypes = {
            'double_xp': {
                name: '⚡ Doble XP',
                description: 'Gana el doble de XP por mensajes',
                emoji: '⚡',
                color: '#FFD700',
                multiplier: { xp: 1.25 },
                minDuration: 1800000,
                maxDuration: 7200000
            },
            'money_rain': {
                name: '💰 Lluvia de Dinero',
                description: 'Aumenta las ganancias de trabajo y daily',
                emoji: '💰',
                color: '#00FF00',
                multiplier: { work: 1.2, daily: 1.3, rewards: 1.2 },
                minDuration: 3600000,
                maxDuration: 14400000
            },
            'lucky_hour': {
                name: '🍀 Hora de la Suerte',
                description: 'Mejores probabilidades en minijuegos',
                emoji: '🍀',
                color: '#32CD32',
                multiplier: { luck: 1.3 },
                minDuration: 300000,
                maxDuration: 600000
            },
            'fever_time': {
                name: '🔥 Tiempo Fiebre',
                description: 'Reducción de cooldowns y bonificaciones múltiples',
                emoji: '🔥',
                color: '#FF4500',
                multiplier: { 
                    xp: 1.25, 
                    work: 1.15, 
                    cooldown: 0.7, 
                    daily: 1.15, 
                    minigames: 1.25,
                    rewards: 1.3
                },
                minDuration: 600000,
                maxDuration: 1200000
            },
            'charity_event': {
                name: '❤️ Evento de Caridad',
                description: 'Dona dinero y recibe bonificaciones especiales',
                emoji: '❤️',
                color: '#FF69B4',
                multiplier: {
                    transfer_bonus: 0.45
                },
                minDuration: 600000,
                maxDuration: 900000,
                special: true
            },
            'treasure_hunt': {
                name: '🗺️ Búsqueda del Tesoro',
                description: 'Encuentra tesoros ocultos en tus actividades',
                emoji: '🗺️',
                color: '#DAA520',
                minDuration: 3600000,
                maxDuration: 10800000,
                special: true
            },
            'market_crash': {
                name: '📉 Crisis del Mercado',
                description: 'Menores ganancias pero mayores recompensas por riesgo',
                emoji: '📉',
                color: '#DC143C',
                multiplier: { 
                    work: 0.6, 
                    daily: 0.7, 
                    cooldown: 0.8,
                    minigames: 1.2,
                    rewards: 0.8
                },
                minDuration: 3600000,
                maxDuration: 7200000,
                negative: true
            },
            'week_end': {
                name: '😎 Evento de Fin de Semana',
                description: 'Todos los items de la tienda tienen **20% de descuento**!',
                emoji: '😎',
                color: '#FF6600',
                multiplier: { 
                    items: 0.1,
                },
                minDuration: 172800000,
                maxDuration: 172800000
            },
            'server_anniversary': {
                name: '🎉 Aniversario del Servidor',
                description: 'Celebración especial con múltiples bonificaciones',
                emoji: '🎉',
                color: '#9932CC',
                multiplier: { 
                    xp: 1.5, 
                    work: 1.5, 
                    daily: 1.5, 
                    cooldown: 0.6,
                    minigames: 1.5,
                    rewards: 1.5
                },
                minDuration: 3600000,
                maxDuration: 14400000,
                special: true,
                rare: true
            }
        };
        
        this.eventProbabilities = {
            'double_xp': 0.08,      
            'money_rain': 0.06,     
            'lucky_hour': 0.005,    
            'fever_time': 0.05,     
            'charity_event': 0.01,  
            'treasure_hunt': 0.03,  
            'market_crash': 0.04    
        };
        
        setTimeout(() => {
            this.startEventLoop();
            this.cleanExpiredEvents();
        }, 2000);
    }

    getGuildEvents(guildId) {
        if (!this.activeEvents.has(guildId)) {
            this.activeEvents.set(guildId, {});
        }
        return this.activeEvents.get(guildId);
    }

    async initializeDatabase() {
            setTimeout(async () => {
                if (this.economy && this.economy.database) {
                    this.db = this.economy.database;
                    console.log('🎮 Base de datos de eventos inicializada');
                    await this.loadEvents(); // Mover aquí
                } else {
                    console.log('⚠️ Economy no disponible, usando eventos en memoria');
                }
            }, 5000);
    }

    getEcuadorTime() {
        const now = new Date();
        return new Date(now.toLocaleString("en-US", {timeZone: "America/Guayaquil"}));
    }

    checkWeekendStart() {
        const ecuadorTime = this.getEcuadorTime();
        const dayOfWeek = ecuadorTime.getDay();
        const hour = ecuadorTime.getHours();
        const minute = ecuadorTime.getMinutes();
        
        return dayOfWeek === 5 && hour === 0 && minute < 30;
    }

    checkWeekendEnd() {
        const ecuadorTime = this.getEcuadorTime();
        const dayOfWeek = ecuadorTime.getDay();
        const hour = ecuadorTime.getHours();
        const minute = ecuadorTime.getMinutes();
        
        return dayOfWeek === 0 && hour === 23 && minute >= 30;
    }

    async checkWeekendEvents() {
        const targetGuild = this.guild || (this.client ? this.client.guilds.cache.first() : null);
        if (!targetGuild) return;

        const hasWeekendEvent = this.hasActiveEvent('week_end', targetGuild.id);
        
        if (this.checkWeekendStart() && !hasWeekendEvent) {
            const weekendDuration = 2 * 24 * 60 * 60 * 1000; 
            await this.createEvent('week_end', weekendDuration);
            console.log(`🎉 Evento de fin de semana iniciado (Global)`);
        }
        
        if (this.checkWeekendEnd() && hasWeekendEvent) {
            const weekendEvent = hasWeekendEvent;
            weekendEvent.endTime = Date.now();
            
            await this.saveEvent(weekendEvent.id, weekendEvent);
            await this.deleteEvent(weekendEvent.id);
            
            const guildEvents = this.getGuildEvents(targetGuild.id);
            delete guildEvents[weekendEvent.id];
            
            await this.announceEvent(weekendEvent, 'expired', targetGuild);
            console.log(`🏁 Evento de fin de semana terminado (Global)`);
        }
    }
    
    async loadEvents() {
        if (!this.db) {
            console.log('⚠️ Base de datos no disponible para cargar eventos');
            return;
        }
        
        try {
            const [rows] = await this.db.pool.execute(
                'SELECT * FROM server_events WHERE end_time > ?',
                [new Date().toISOString()]
            );
            
            this.activeEvents = new Map();

            if (rows && rows.length > 0) {
                rows.forEach(event => {
                    const gId = event.guild_id || this.guild?.id;
                    if (!gId) return;
                    const guildEvents = this.getGuildEvents(gId);
                    guildEvents[event.id] = {
                        ...event,
                        startTime: new Date(event.start_time).getTime(),
                        endTime: new Date(event.end_time).getTime(),
                        multipliers: JSON.parse(event.multipliers || '{}'),
                        stats: JSON.parse(event.stats || '{}')
                    };
                });
            }

            let totalEvents = 0;
            for (const events of this.activeEvents.values()) totalEvents += Object.keys(events).length;
            console.log(`📅 ${totalEvents} eventos cargados desde MySQL`);
            
            this.cleanExpiredEvents();
        } catch (error) {
            console.error('❌ Error cargando eventos desde MySQL:', error);
        }
    }

    async saveEvent(eventId, eventData) {
        if (!this.db) {
            console.log('⚠️ Base de datos no disponible, evento no guardado:', eventId);
            return;
        }
        
        try {
            const [existing] = await this.db.pool.execute(
                'SELECT id FROM server_events WHERE id = ?',
                [eventId]
            );
            
            if (existing.length > 0) {
                await this.db.pool.execute(`
                    UPDATE server_events SET 
                        participant_count = ?, 
                        stats = ?
                    WHERE id = ?
                `, [
                    eventData.participantCount || 0,
                    JSON.stringify(eventData.stats || {}),
                    eventId
                ]);
            } else {
                const mappedData = {
                    id: eventData.id,
                    type: eventData.type,
                    name: eventData.name,
                    description: eventData.description,
                    emoji: eventData.emoji,
                    color: eventData.color,
                    start_time: new Date(eventData.startTime).toISOString(),
                    end_time: new Date(eventData.endTime).toISOString(),
                    duration: eventData.duration,
                    multipliers: eventData.multipliers || {},
                    is_special: eventData.isSpecial || false,
                    is_negative: eventData.isNegative || false,
                    is_rare: eventData.isRare || false,
                    triggered_by: eventData.triggeredBy || null,
                    participant_count: eventData.participantCount || 0,
                    stats: eventData.stats || {},
                    guild_id: eventData.guildId || this.guild?.id
                };
                
                await this.db.createServerEvent(mappedData);
            }
            
            console.log(`💾 Evento ${eventId} guardado/actualizado en MySQL`);
        } catch (error) {
            console.error('❌ Error guardando evento en MySQL:', error);
        }
    }
    
    async deleteEvent(eventId) {
        if (!this.db) {
            console.log('⚠️ Base de datos no disponible, evento no eliminado:', eventId);
            return;
        }
        
        try {
            await this.db.pool.execute(
                'DELETE FROM server_events WHERE id = ?',
                [eventId]
            );
            console.log(`🗑️ Evento ${eventId} eliminado de MySQL`);
        } catch (error) {
            console.error('❌ Error eliminando evento de MySQL:', error);
        }
    }

    startEventLoop() {
        setInterval(async () => {
            await this.checkWeekendEvents();
        }, 30 * 60 * 1000); 
        
        setInterval(async () => {
            await this.tryCreateRandomEvent();
            console.log('🔄 Verificando eventos automáticos...');
        }, 2 * 60 * 60 * 1000); 

        setInterval(async () => {
            await this.cleanExpiredEvents();
        }, 60000); 

        setInterval(async () => {
            let savedCount = 0;
            for (const [guildId, guildEvents] of this.activeEvents.entries()) {
                for (const event of Object.values(guildEvents)) {
                    await this.saveEvent(event.id, event);
                    savedCount++;
                }
            }
            if (savedCount > 0) {
                console.log(`💾 Estadísticas de ${savedCount} eventos guardadas en DB (Batch)`);
            }
        }, 15 * 60 * 1000); 

        console.log('🔄 Sistema de eventos iniciado');
    }

    getCachedEventData(key) {
        const cached = this.eventCache.get(key);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCachedEventData(key, data) {
        this.eventCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            
            for (const [key, cached] of this.eventCache) {
                if (now - cached.timestamp > this.cacheTimeout) {
                    this.eventCache.delete(key);
                }
            }
            
            if (this.eventCache.size > this.MAX_CACHE_SIZE) {
                const entries = Array.from(this.eventCache.entries());
                const toDelete = entries
                    .sort((a, b) => a[1].timestamp - b[1].timestamp)
                    .slice(0, entries.length - this.MAX_CACHE_SIZE);
                    
                for (const [tradeId] of toDelete) {
                    this.eventCache.delete(tradeId);
                }
            }
            
            console.log(`🧹 Cache cleanup: ${this.eventCache.size} eventos en memoria`);
        }, 10 * 60 * 1000);
    }
    
    async tryCreateRandomEvent() {
        const targetGuild = this.guild || (this.client ? this.client.guilds.cache.first() : null);
        if (!targetGuild) return;

        const guildEvents = this.getGuildEvents(targetGuild.id);
        const activeCount = Object.values(guildEvents).filter(e => e.endTime > Date.now()).length;
        if (activeCount >= 3) return;

        const totalProbability = Object.values(this.eventProbabilities).reduce((sum, p) => sum + p, 0);
        const randomValue = Math.random();
        if (randomValue > totalProbability) return;

        let cumulativeProbability = 0;
        let selectedEventType = null;
        for (const [eventType, probability] of Object.entries(this.eventProbabilities)) {
            cumulativeProbability += probability;
            if (randomValue <= cumulativeProbability) {
                selectedEventType = eventType;
                break;
            }
        }

        if (selectedEventType) {
            await this.createEvent(selectedEventType);
            console.log(`🎲 Evento global automático creado en ${targetGuild.name}`);
        }
    }

    async createEvent(eventType, customDuration = null, triggeredBy = null) {
        const eventData = this.eventTypes[eventType];
        if (!eventData) return false;
       
        const targetGuildId = this.guild?.id;
        if (targetGuildId) {
            const guildEvents = this.getGuildEvents(targetGuildId);
            for (const event of Object.values(guildEvents)) {
                if (event.type === eventType && event.endTime > Date.now()) {
                    return false;
                }
            }
        }
        
        const now = Date.now();
        const duration = customDuration || this.getRandomDuration(eventData);
        const eventId = `${eventType}_${now}`;
        
        const event = {
            id: eventId,
            type: eventType,
            guildId: targetGuildId,
            name: eventData.name,
            description: eventData.description,
            emoji: eventData.emoji,
            color: eventData.color,
            startTime: now,
            endTime: now + duration,
            duration: duration,
            multipliers: eventData.multiplier || {},
            isSpecial: eventData.special || false,
            isNegative: eventData.negative || false,
            isRare: eventData.rare || false,
            triggeredBy: triggeredBy,
            participantCount: 0,
            stats: {
                messagesAffected: 0,
                workJobsAffected: 0,
                dailiesAffected: 0,
                gamesAffected: 0,
                treasuresFound: 0,
                totalTreasureValue: 0,
                totalXpGiven: 0
            }
        };
        
        if (targetGuildId) {
            const guildEvents = this.getGuildEvents(targetGuildId);
            guildEvents[eventId] = event;
        }
        await this.saveEvent(eventId, event);
        
        console.log(`🎉 Evento creado: ${eventData.name} (${this.formatTime(duration)})`);
        if (!triggeredBy) {
            await this.announceEvent(event, 'created');
        }

        return event;
    }

    setGuild(guild) {
        this.guild = guild;
        console.log(`🏠 Guild establecido para eventos: ${guild.name}`);
    }

    getRandomDuration(eventData) {
        const min = eventData.minDuration;
        const max = eventData.maxDuration;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    hasActiveEvent(eventType, guildId = null) {
        const targetId = guildId || this.guild?.id;
        if (!targetId) return null;
        const guildEvents = this.getGuildEvents(targetId);
        for (const event of Object.values(guildEvents)) {
            if (event.type === eventType && event.endTime > Date.now()) {
                return event;
            }
        }
        return null;
    }

    getActiveEvents(guildId = null) {
        const now = Date.now();
        const targetId = this.guild?.id; 
        if (!targetId) return [];
        const guildEvents = this.getGuildEvents(targetId);
        return Object.values(guildEvents).filter(event => event.endTime > now);
    }

    async applyXpModifiers(userId, baseXp, context = 'message', guildId = null) {
        const cacheKey = `xp_${context}_${baseXp}`;
        const cached = this.getCachedEventData(cacheKey);
        
        const targetGuildId = this.guild?.id; 
        const guildEvents = this.getGuildEvents(targetGuildId);
        
        if (cached) {
            if (cached.appliedEvents.length > 0) {
                for (const cachedEvent of cached.appliedEvents) {
                    const realEvent = guildEvents[cachedEvent.id];
                    if (realEvent) {
                        realEvent.stats.messagesAffected = (realEvent.stats.messagesAffected || 0) + 1;
                    }
                }
            }
            
            return {
                originalXp: baseXp,
                finalXp: cached.finalXp,
                appliedEvents: cached.appliedEvents
            };
        }

        let finalXp = baseXp;
        let appliedEvents = [];
        
        for (const event of this.getActiveEvents(targetGuildId)) {
            if (event.multipliers.xp) {
                switch (event.type) {
                    case 'double_xp':
                        if (context === 'message') {
                            finalXp = Math.floor(finalXp * event.multipliers.xp);
                            appliedEvents.push(event);
                        }
                        break;
                    case 'fever_time':
                        if (['message', 'games', 'mission', 'achievement'].includes(context)) {
                            finalXp = Math.floor(finalXp * event.multipliers.xp);
                            appliedEvents.push(event);
                        }
                        break;
                    case 'server_anniversary':
                        if (['message', 'games', 'mission', 'achievement'].includes(context)) {
                            finalXp = Math.floor(finalXp * event.multipliers.xp);
                            appliedEvents.push(event);
                        }
                        break;
                }
            }
        }
        
        this.setCachedEventData(cacheKey, { finalXp, appliedEvents });
        
        if (appliedEvents.length > 0) {
            for (const event of appliedEvents) {
                event.stats.messagesAffected = (event.stats.messagesAffected || 0) + 1;
                guildEvents[event.id] = event;
            }
        }
        
        return {
            originalXp: baseXp,
            finalXp: finalXp,
            appliedEvents: appliedEvents
        };
    }

    async applyMoneyModifiers(userId, baseAmount, context = 'work', guildId = null) {
        let finalAmount = baseAmount;
        let appliedEvents = [];
        let eventMessage = '';
        let multiplier = 1;      
        let bonus = 0;
        let loss = 0;     
        
        const targetGuildId = this.guild?.id;
        const guildEvents = this.getGuildEvents(targetGuildId);
        
        for (const event of this.getActiveEvents(targetGuildId)) {
            if (event.multipliers.work || event.multipliers.daily || event.multipliers.minigames) {
                if(event.multipliers.work && context === 'work') {
                    multiplier = event.multipliers.work;
                }
                else if(event.multipliers.daily && context === 'daily') {
                    multiplier = event.multipliers.daily;
                }
                else if(event.multipliers.minigames && context === 'minigames') {
                    multiplier = event.multipliers.minigames;
                }

                switch (event.type) {
                    case 'money_rain':
                        finalAmount = Math.floor(baseAmount * multiplier);
                        bonus = finalAmount - baseAmount;
                        eventMessage = `\n💰 **${event.name}** te dio +${bonus} π-b$ extra!`;
                        appliedEvents.push(event);                
                        if (context === 'work') event.stats.workJobsAffected++;
                        else if (context === 'daily') event.stats.dailiesAffected++;
                        break;
                    case 'fever_time':
                        finalAmount = Math.floor(baseAmount * multiplier);
                        bonus = finalAmount - baseAmount;
                        eventMessage = `\n🔥 **${event.name}** te dio +${bonus} π-b$ extra!`;
                        appliedEvents.push(event);
                        if (context === 'work') event.stats.workJobsAffected++;
                        else if (context === 'daily') event.stats.dailiesAffected++;
                        else if (context == 'minigames') event.stats.gamesAffected++;
                        break;
                    case 'market_crash':
                        finalAmount = Math.floor(baseAmount * multiplier);
                        loss = baseAmount - finalAmount;
                        eventMessage = `\n📉 **${event.name}** redujo tus ganancias en ${loss} π-b$`;
                        appliedEvents.push(event);
                        if (context === 'work') event.stats.workJobsAffected++;
                        else if (context === 'daily') event.stats.dailiesAffected++;
                        else if (context == 'minigames') event.stats.gamesAffected++;
                        break;                        
                    case 'server_anniversary':
                        finalAmount = Math.floor(baseAmount * multiplier);
                        bonus = finalAmount - baseAmount;
                        eventMessage = `\n🎉 **${event.name}** ¡Mega bonus de +${bonus} π-b$!`;
                        appliedEvents.push(event);
                        if (context === 'work') event.stats.workJobsAffected++;
                        else if (context === 'daily') event.stats.dailiesAffected++;
                        else if (context == 'minigames') event.stats.gamesAffected++;
                        break;
                    default:
                        break;
                }
            }
        }
        
        if (appliedEvents.length > 0) {
            for (const event of appliedEvents) {
                guildEvents[event.id] = event;
            }
        }
        
        return {
            originalAmount: baseAmount,
            finalAmount: finalAmount,
            eventMessage: eventMessage,
            appliedEvents: appliedEvents
        };
    }

    applyCooldownModifiers(baseCooldown, guildId = null) {
        let finalCooldown = baseCooldown;
        let appliedEvents = [];
        const targetGuildId = guildId || this.guild?.id;
        
        for (const event of this.getActiveEvents(targetGuildId)) {
            if (event.multipliers.cooldown) {
                finalCooldown = Math.floor(finalCooldown * event.multipliers.cooldown);
                appliedEvents.push(event);
            }
        }
        
        return {
            originalCooldown: baseCooldown,
            finalCooldown: finalCooldown,
            appliedEvents: appliedEvents
        };
    }

    async checkSpecialEvents(userId, context, message, data = {}) {
        let rewards = [];
        let appliedEvents = [];
        
        for (const event of this.getActiveEvents(message.guild?.id)) {
            if (event.type === 'treasure_hunt' && Math.random() < 0.05) {
                const treasureType = Math.random();
                let treasureReward = 0;
                let xpBonus = 0;
                let treasureDescription = '';
                let rewardType = 'money';
                
                if (treasureType < 0.55) {
                    treasureReward = Math.floor(Math.random() * 800) + 200;
                    treasureDescription = `Cofre de monedas: ${treasureReward} π-b$`;
                    rewardType = 'money';
                } else if (treasureType < 0.70) {
                    treasureReward = Math.floor(Math.random() * 1500) + 500;
                    treasureDescription = `Cofre dorado: ${treasureReward} π-b$`;
                    rewardType = 'premium_money';
                } else {
                    xpBonus = Math.floor(Math.random() * 400) + 200;
                    treasureDescription = `Pergamino ancestral: +${xpBonus} XP`;
                    rewardType = 'xp';
                }
                
                if (treasureReward > 0) {
                    await this.economy.addMoney(userId, treasureReward, 'treasure_found');
                }
                if (xpBonus > 0) {
                    await this.economy.addXp(userId, xpBonus);
                }
                
                rewards.push({
                    type: 'treasure',
                    subType: rewardType,
                    amount: treasureReward,
                    xpAmount: xpBonus,
                    description: treasureDescription,
                    event: event
                });
                
                event.stats.gamesAffected++;
                event.stats.treasuresFound = (event.stats.treasuresFound || 0) + 1;
                event.stats.totalTreasureValue = (event.stats.totalTreasureValue || 0) + treasureReward;
                if (xpBonus > 0) {
                    event.stats.totalXpGiven = (event.stats.totalXpGiven || 0) + xpBonus;
                }
            }
        }
               
        return rewards;
    }

    async showActiveEvents(message) {
        const activeEvents = this.getActiveEvents(message.guild?.id);
        
        if (activeEvents.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('📅 Eventos Activos')
                .setDescription('No hay eventos activos en este momento.')
                .setColor('#808080')
                .setFooter({ text: 'Los eventos aparecen automáticamente. ¡Mantente atento!' })
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📅 Eventos Activos')
            .setDescription(`${activeEvents.length} evento(s) activo(s)`)
            .setColor('#9932CC')
            .setTimestamp();
        
        for (const event of activeEvents) {
            const timeLeft = event.endTime - Date.now();
            const timeLeftText = this.formatTime(timeLeft);
            
            let effectsText = event.description;
            if (Object.keys(event.multipliers).length > 0) {
                effectsText += '\n**Efectos:**\n';
                for (const [type, multiplier] of Object.entries(event.multipliers)) {
                    const percentage = ((multiplier - 1) * 100).toFixed(0);
                    const sign = multiplier > 1 ? '+' : '';
                    effectsText += `• ${this.getMultiplierName(type)}: ${sign}${percentage}%\n`;
                }
            }
            
            embed.addFields({
                name: `${event.emoji} ${event.name}`,
                value: `${effectsText}\n⏰ **Tiempo restante:** ${timeLeftText}`,
                inline: false
            });
        }
        
        await message.reply({ embeds: [embed] });
    }

    async createManualEvent(message, eventType, duration = null) {
        const OWNER_ID = '488110147265232898';
        if (message.author.id !== OWNER_ID) {
            await message.reply('❌ Solo mi creador puede crear eventos manuales. Los eventos automáticos se generan solos.');
            return;
        }

        const originalGuild = this.guild;
        
        if (!this.eventTypes[eventType]) {
            const availableTypes = Object.keys(this.eventTypes).join(', ');
            await message.reply(`❌ Tipo de evento inválido. Disponibles: ${availableTypes}`);
            return;
        }
        
        const customDuration = duration ? duration * 60000 : null;
        const event = await this.createEvent(eventType, customDuration, message.author.id);
        
        if (!event) {
            await message.reply('❌ No se pudo crear el evento. Puede que ya haya uno del mismo tipo activo.');
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🎉 Evento Creado Manualmente')
            .setDescription(`**${event.name}** ha sido activado!`)
            .addFields(
                { name: '📝 Descripción', value: event.description, inline: false },
                { name: '⏰ Duración', value: this.formatTime(event.duration), inline: true },
                { name: '👤 Creado por', value: message.author.displayName, inline: true }
            )
            .setColor(event.color)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        await this.announceEvent(event, 'created', message.guild);
    
        this.guild = originalGuild;
    }

    async cleanExpiredEvents() {
        const now = Date.now();
        let cleaned = 0;

        if (!(this.activeEvents instanceof Map)) {
            this.activeEvents = new Map();
            return;
        }

        for (const [guildId, guildEvents] of this.activeEvents.entries()) {
            if (!guildEvents || typeof guildEvents !== 'object') continue;
            
            for (const [eventId, event] of Object.entries(guildEvents)) {
                if (event.endTime <= now) {
                    await this.saveEvent(eventId, event); 
                    
                    delete guildEvents[eventId];
                    await this.deleteEvent(eventId);
                    
                    const guild = this.client?.guilds.cache.get(guildId) || this.guild;
                    await this.announceEvent(event, 'expired', guild);
                    
                    cleaned++;
                    console.log(`🧹 Evento expirado limpiado: ${event.name} (guild: ${guildId})`);
                }
            }
        }
    }

    getMultiplierName(type) {
        const names = {
            'xp': 'XP',
            'work': 'Trabajo',
            'daily': 'Daily',
            'cooldown': 'Cooldowns',
            'luck': 'Suerte',
            'gambling': 'Apuestas'
        };
        return names[type] || type;
    }

    formatTime(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    async announceEvent(event, action, passedGuild = null) {
        console.log(`📢 Anunciando evento global: ${event.name}, action: ${action}`);

        const guilds = this.client ? [...this.client.guilds.cache.values()] : (this.guild ? [this.guild] : []);

        for (const guild of guilds) {
            let channelId = null;
            if (this.guildConfig) {
                channelId = await this.guildConfig.get(guild.id, 'events_channel');
            }
            
            if (!channelId) continue;

            try {
                const channel = await guild.channels.fetch(channelId);
                if (!channel) continue;
                
                let eventsRoleId = null;
                if (this.guildConfig) {
                    eventsRoleId = await this.guildConfig.getEventsRole(guild.id);
                }
                
                let embed;
                let shouldPing = false;
                
                if (action === 'created') {
                    embed = new EmbedBuilder()
                        .setTitle(`${event.emoji} ¡Nuevo Evento Global Activo!`)
                        .setDescription(`**${event.name}**\n\n${event.description}`)
                        .setColor(event.color)
                        .addFields({ name: '⏰ Duración', value: this.formatTime(event.duration), inline: true })
                        .setTimestamp();
                    shouldPing = true;               
                } else if (action === 'expired') {
                    const stats = event.stats;
                    const totalInteractions = stats.messagesAffected + stats.workJobsAffected + 
                                            stats.dailiesAffected + stats.gamesAffected;
                    
                    embed = new EmbedBuilder()
                        .setTitle(`${event.emoji} Evento Global Finalizado`)
                        .setDescription(`**${event.name}** ha terminado.\n\n¡Gracias por participar!`)
                        .setColor('#808080')
                        .addFields({ name: '📊 Participación Total', value: `${totalInteractions} interacciones`, inline: true })
                        .setTimestamp();
                    shouldPing = false;
                }
                            
                await channel.send({
                    content: shouldPing && eventsRoleId ? `<@&${eventsRoleId}>` : '',
                    embeds: [embed],
                    allowedMentions: shouldPing ? { parse: ['roles'] } : { parse: [] }
                });
            } catch (error) {
                console.error(`❌ Error enviando anuncio en ${guild.name}:`, error.message);
            }
        }
    }
}

module.exports = EventsSystem;
