const { EmbedBuilder } = require('discord.js');
const EVENTOS_ROLE_ID = '1409356197722718228'; // ← Reemplazar con el ID real

class EventsSystem {
    constructor(economySystem, client = null) {
        this.economy = economySystem;
        this.client = client;

        this.db = null;
        this.initializeDatabase();
        
        this.activeEvents = {};
        this.announcementChannelId = '1404905496644685834'; // Cambia esto al ID de tu canal de anuncios
        this.guild = null;

        this.eventCache = new Map();
        this.MAX_CACHE_SIZE = 500;
        this.cacheTimeout = 10 * 60 * 1000;
        
        // Definir tipos de eventos disponibles
        this.eventTypes = {
            'double_xp': {
                name: '⚡ Doble XP',
                description: 'Gana el doble de XP por mensajes',
                emoji: '⚡',
                color: '#FFD700',
                multiplier: { xp: 2 },
                minDuration: 1800000, // 30 minutos
                maxDuration: 7200000  // 2 horas
            },
            'money_rain': {
                name: '💰 Lluvia de Dinero',
                description: 'Aumenta las ganancias de trabajo y daily',
                emoji: '💰',
                color: '#00FF00',
                multiplier: { work: 1.5, daily: 1.75 },
                minDuration: 3600000, // 1 hora
                maxDuration: 14400000 // 4 horas
            },
            'lucky_hour': {
                name: '🍀 Hora de la Suerte',
                description: 'Mejores probabilidades en minijuegos',
                emoji: '🍀',
                color: '#32CD32',
                multiplier: { luck: 1.3 },
                minDuration: 1800000, // 30 minutos
                maxDuration: 3600000  // 1 hora
            },
            'fever_time': {
                name: '🔥 Tiempo Fiebre',
                description: 'Reducción de cooldowns y bonificaciones múltiples',
                emoji: '🔥',
                color: '#FF4500',
                multiplier: { 
                    xp: 1.5, 
                    work: 1.3, 
                    cooldown: 0.5, 
                    daily: 1.2, 
                    minigames: 1.5, 
                    missions: 1.4, 
                    achievements: 1.6
                },
                minDuration: 2700000, // 45 minutos
                maxDuration: 5400000  // 1.5 horas
            },
            'charity_event': {
                name: '❤️ Evento de Caridad',
                description: 'Dona dinero y recibe bonificaciones especiales',
                emoji: '❤️',
                color: '#FF69B4',
                minDuration: 900000,  // 15 minutos
                maxDuration: 1800000, // 30 minutos
                special: true
            },
            'treasure_hunt': {
                name: '🗺️ Búsqueda del Tesoro',
                description: 'Encuentra tesoros ocultos en tus actividades',
                emoji: '🗺️',
                color: '#DAA520',
                minDuration: 3600000,  // 1 hora
                maxDuration: 10800000, // 3 horas
                special: true
            },
            'market_crash': {
                name: '📉 Crisis del Mercado',
                description: 'Menores ganancias pero mayores recompensas por riesgo',
                emoji: '📉',
                color: '#DC143C',
                multiplier: { 
                    work: 0.7, 
                    daily: 0.8, 
                    cooldown: 0.4,
                    minigames: 1.5, 
                    missions: 0.8, 
                    achievements: 0.8
                },
                minDuration: 1800000, // 30 minutos
                maxDuration: 3600000, // 1 hora
                negative: true
            },
            'week_end': {
                name: '😎 Evento de Fin de Semana',
                description: 'Todos los items de la tienda tienen **20% de descuento**!',
                emoji: '😎',
                color: '#FF6600',
                multiplier: { 
                    items: 0.2,
                },
                minDuration: 172800000, // 48 horas
                maxDuration: 172800000 // 48 horas
            },
            'server_anniversary': {
                name: '🎉 Aniversario del Servidor',
                description: 'Celebración especial con múltiples bonificaciones',
                emoji: '🎉',
                color: '#9932CC',
                multiplier: { 
                    xp: 3, 
                    work: 2, 
                    daily: 2, 
                    cooldown: 0.3,
                    minigames: 2, 
                    missions: 2, 
                    achievements: 2
                },
                minDuration: 14400000, // 4 horas
                maxDuration: 86400000, // 24 horas
                special: true,
                rare: true
            }
        };
        
        // Probabilidades de eventos (por hora)
        this.eventProbabilities = {
            'double_xp': 0.15,      // 15%
            'money_rain': 0.12,     // 12%
            'lucky_hour': 0.01,     // 1%
            'fever_time': 0.11,     // 11%
            'charity_event': 0.02,  // 2%
            'treasure_hunt': 0.07,  // 7%
            'market_crash': 0.10//,   // 10%
            //'server_anniversary': 0.01 // 1% (muy raro)
        };
        
        // Iniciar sistema después del delay
        setTimeout(() => {
            this.startEventLoop();
            this.cleanExpiredEvents();
        }, 2000);
    }

    // ✅ AGREGAR: Inicializar base de datos
    async initializeDatabase() {
        // Esperar a que economy esté listo
            setTimeout(async () => {
                if (this.economy && this.economy.database) {
                    this.db = this.economy.database;
                    console.log('🎮 Base de datos de eventos inicializada');
                    await this.loadEvents(); // Mover aquí
                } else {
                    console.log('⚠️ Economy no disponible, usando eventos en memoria');
                }
            }, 1000);
    }
    
    // QUITAR todo el bloque de Supabase y REEMPLAZAR por:
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
            
            this.activeEvents = {};
            
            if (rows && rows.length > 0) {
                rows.forEach(event => {
                    this.activeEvents[event.id] = {
                        ...event,
                        startTime: new Date(event.start_time).getTime(),
                        endTime: new Date(event.end_time).getTime(),
                        multipliers: JSON.parse(event.multipliers || '{}'),
                        stats: JSON.parse(event.stats || '{}')
                    };
                });
            }
            
            console.log(`📅 ${Object.keys(this.activeEvents).length} eventos cargados desde MySQL`);
            this.cleanExpiredEvents();
        } catch (error) {
            console.error('❌ Error cargando eventos desde MySQL:', error);
        }
    }

    // ✅ REEMPLAZAR: saveEvent() para SQLite
    async saveEvent(eventId, eventData) {
        if (!this.db) {
            console.log('⚠️ Base de datos no disponible, evento no guardado:', eventId);
            return;
        }
        
        try {
            // PRIMERO: Verificar si existe
            const [existing] = await this.db.pool.execute(
                'SELECT id FROM server_events WHERE id = ?',
                [eventId]
            );
            
            if (existing.length > 0) {
                // ACTUALIZAR evento existente (incluyendo estadísticas)
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
                // CREAR nuevo evento
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
                    stats: eventData.stats || {}
                };
                
                await this.db.createServerEvent(mappedData);
            }
            
            console.log(`💾 Evento ${eventId} guardado/actualizado en MySQL`);
        } catch (error) {
            console.error('❌ Error guardando evento en MySQL:', error);
        }
    }
    
    // ✅ REEMPLAZAR: deleteEvent() para SQLite
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

    // Iniciar el loop de eventos automáticos
    startEventLoop() {
        // Verificar cada hora si crear nuevos eventos
        setInterval(async () => {
            await this.tryCreateRandomEvent();
            console.log('🔄 Verificando eventos automáticos...');
        }, 1800000); // 30 minutos

        // Limpiar eventos expirados cada 1 minutos
        setInterval(async () => {
            await this.cleanExpiredEvents();
        }, 60000); // 1 minuto

        console.log('🔄 Sistema de eventos iniciado');
    }

    // ✅ OPTIMIZACIÓN: Caché para reducir consultas
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
            
            // Limpiar por tiempo
            for (const [key, cached] of this.eventCache) {
                if (now - cached.timestamp > this.cacheTimeout) {
                    this.eventCache.delete(key);
                }
            }
            
            // Limpiar por tamaño si excede el límite
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
    
    // Intentar crear un evento aleatorio
    async tryCreateRandomEvent() {
        // No crear eventos si ya hay muchos activos
        const activeCount = Object.keys(this.activeEvents).length;
        if (activeCount >= 3) return;
        
        // Calcular si crear evento
        const totalProbability = Object.values(this.eventProbabilities).reduce((sum, prob) => sum + prob, 0);
        const randomValue = Math.random();
        
        if (randomValue > totalProbability) return; // No crear evento
        
        // Seleccionar tipo de evento
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
        }
    }

    // Crear un evento específico
    async createEvent(eventType, customDuration = null, triggeredBy = null) {
        const eventData = this.eventTypes[eventType];
        if (!eventData) return false;
        
        // Verificar si ya hay un evento del mismo tipo activo
        for (const [id, event] of Object.entries(this.activeEvents)) {
            if (event.type === eventType && event.endTime > Date.now()) {
                return false; // Ya hay uno activo
            }
        }
        
        const now = Date.now();
        const duration = customDuration || this.getRandomDuration(eventData);
        const eventId = `${eventType}_${now}`;
        
        const event = {
            id: eventId,
            type: eventType,
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
                treasuresFound: 0,           // ✨ NUEVO
                totalTreasureValue: 0,       // ✨ NUEVO  
                totalXpGiven: 0              // ✨ NUEVO
            }
        };
        
        this.activeEvents[eventId] = event;
        await this.saveEvent(eventId, event); // Ahora async
        
        console.log(`🎉 Evento creado: ${eventData.name} (${this.formatTime(duration)})`);
        console.log(`triggeredBy: ${triggeredBy}, guild: ${this.guild ? 'disponible' : 'no disponible'}`); // ← Agregar esta línea
        if (!triggeredBy) {
            console.log('Enviando anuncio de evento automático...'); // ← Y esta también
            await this.announceEvent(event, 'created');
        }

        return event;
    }

    // Agregar este método en la clase EventsSystem
    setGuild(guild) {
        this.guild = guild;
        console.log(`🏠 Guild establecido para eventos: ${guild.name}`);
    }

    // Obtener duración aleatoria para un evento
    getRandomDuration(eventData) {
        const min = eventData.minDuration;
        const max = eventData.maxDuration;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Verificar si hay un evento activo de cierto tipo
    hasActiveEvent(eventType) {
        for (const event of Object.values(this.activeEvents)) {
            if (event.type === eventType && event.endTime > Date.now()) {
                return event;
            }
        }
        return null;
    }

    // Obtener todos los eventos activos
    getActiveEvents() {
        const now = Date.now();
        return Object.values(this.activeEvents).filter(event => event.endTime > now);
    }

    // ✅ OPTIMIZACIÓN: Rate limiting para aplicar modificadores
    async applyXpModifiers(userId, baseXp, context = 'message') {
        // Caché para evitar recálculos constantes
        const cacheKey = `xp_${context}_${baseXp}`;
        const cached = this.getCachedEventData(cacheKey);
        
        if (cached) {
            // Solo actualizar estadísticas si hay eventos aplicados
            if (cached.appliedEvents.length > 0) {
                for (const cachedEvent of cached.appliedEvents) {
                    const realEvent = this.activeEvents[cachedEvent.id];
                    if (realEvent) {
                        realEvent.stats.messagesAffected = (realEvent.stats.messagesAffected || 0) + 1;
                        await this.saveEvent(realEvent.id, realEvent);
                    }
                }
            }
            
            return {
                originalXp: baseXp,
                finalXp: cached.finalXp,
                appliedEvents: cached.appliedEvents
            };
        }

        // Calcular modificadores normalmente si no está en caché
        let finalXp = baseXp;
        let appliedEvents = [];
        
        for (const event of this.getActiveEvents()) {
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
        
        // Guardar en caché
        this.setCachedEventData(cacheKey, { finalXp, appliedEvents });
        
        // Batch update de estadísticas
        if (appliedEvents.length > 0) {
            const updates = appliedEvents.map(event => ({
                eventId: event.id,
                stats: {
                    ...event.stats,
                    messagesAffected: (event.stats.messagesAffected || 0) + 1
                }
            }));
            
            // Actualizar inmediatamente en memoria y base de datos
            for (const event of appliedEvents) {
                event.stats.messagesAffected = (event.stats.messagesAffected || 0) + 1;
                this.activeEvents[event.id] = event;
                await this.saveEvent(event.id, event);
            }
        }
        
        return {
            originalXp: baseXp,
            finalXp: finalXp,
            appliedEvents: appliedEvents
        };
    }

    // Aplicar modificadores de eventos a dinero (trabajo/daily)
    async applyMoneyModifiers(userId, baseAmount, context = 'work') {
        let finalAmount = baseAmount;
        let appliedEvents = [];
        let eventMessage = '';
        let multiplier = 1;      
        let bonus = 0;
        let loss = 0;     
        
        for (const event of this.getActiveEvents()) {
            if (event.multipliers.work || event.multipliers.daily || event.multipliers.minigames || event.multipliers.missions || event.multipliers.achievements)  // Verificar si hay modificadores de dinero
            {
                if(event.multipliers.work && context === 'work') {
                    multiplier = event.multipliers.work;
                }
                else if(event.multipliers.daily && context === 'daily') {
                    multiplier = event.multipliers.daily;
                }
                else if(event.multipliers.minigames && context === 'minigames') {
                    multiplier = event.multipliers.minigames;
                }
                else if(event.multipliers.missions && context === 'missions') {
                    multiplier = event.multipliers.missions;
                }
                else if(event.multipliers.achievements && context === 'achievements') {
                    multiplier = event.multipliers.achievements;
                }

                switch (event.type) {
                    case 'money_rain':
                        finalAmount = Math.floor(baseAmount * multiplier); // x1.5
                        bonus = finalAmount - baseAmount;
                        eventMessage = `\n💰 **${event.name}** te dio +${bonus} π-b$ extra!`;
 
                        appliedEvents.push(event);                
                        // Actualizar estadísticas
                        if (context === 'work') event.stats.workJobsAffected++;
                        else if (context === 'daily') event.stats.dailiesAffected++;

                        break;
                    case 'fever_time':
                        finalAmount = Math.floor(baseAmount * multiplier); // x1.3
                        bonus = finalAmount - baseAmount;
                        eventMessage = `\n🔥 **${event.name}** te dio +${bonus} π-b$ extra!`;
                        
                        appliedEvents.push(event);
                        
                        // Actualizar estadísticas
                        if (context === 'work') event.stats.workJobsAffected++;
                        else if (context === 'daily') event.stats.dailiesAffected++;
                        else if (context == 'minigames') event.stats.gamesAffected++;
                                                
                        break;
                    case 'market_crash':
                        finalAmount = Math.floor(baseAmount * multiplier); // x0.7
                        loss = baseAmount - finalAmount;
                        eventMessage = `\n📉 **${event.name}** redujo tus ganancias en ${loss} π-b$`;

                        appliedEvents.push(event);
                        
                        // Actualizar estadísticas
                        if (context === 'work') event.stats.workJobsAffected++;
                        else if (context === 'daily') event.stats.dailiesAffected++;
                        else if (context == 'minigames') event.stats.gamesAffected++;

                        break;                        
                    case 'server_anniversary':
                        finalAmount = Math.floor(baseAmount * multiplier); // x2
                        bonus = finalAmount - baseAmount;
                        eventMessage = `\n🎉 **${event.name}** ¡Mega bonus de +${bonus} π-b$!`;

                        appliedEvents.push(event);
                        
                        // Actualizar estadísticas
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
                // Actualizar el evento en memoria también
                this.activeEvents[event.id] = event;
                await this.saveEvent(event.id, event);
            }
        }
        
        return {
            originalAmount: baseAmount,
            finalAmount: finalAmount,
            eventMessage: eventMessage,
            appliedEvents: appliedEvents
        };
    }

    // Aplicar modificadores a cooldowns
    applyCooldownModifiers(baseCooldown) {
        let finalCooldown = baseCooldown;
        let appliedEvents = [];
        
        for (const event of this.getActiveEvents()) {
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

    // Verificar eventos especiales para contextos específicos
    async checkSpecialEvents(userId, context, data = {}) {
        let rewards = [];
        let appliedEvents = [];
        
        for (const event of this.getActiveEvents()) {
            if (event.type === 'treasure_hunt' && Math.random() < 0.15) { // 15% chance
                // DIFERENTES TIPOS DE TESORO
                const treasureType = Math.random();
                let treasureReward = 0;
                let xpBonus = 0;
                let treasureDescription = '';
                let rewardType = 'money';
                
                if (treasureType < 0.6) {
                    // 60% - Tesoro de dinero normal
                    treasureReward = Math.floor(Math.random() * 2000) + 500; // 500-2500
                    treasureDescription = `Cofre de monedas: ${treasureReward} π-b$`;
                    rewardType = 'money';
                } else if (treasureType < 0.85) {
                    // 25% - Tesoro de dinero premium
                    treasureReward = Math.floor(Math.random() * 3000) + 1500; // 1500-4500
                    treasureDescription = `Cofre dorado: ${treasureReward} π-b$`;
                    rewardType = 'premium_money';
                } else {
                    // 15% - Tesoro de XP
                    xpBonus = Math.floor(Math.random() * 100) + 50; // 50-150 XP
                    treasureDescription = `Pergamino ancestral: +${xpBonus} XP`;
                    rewardType = 'xp';
                }
                
                // Dar recompensas
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
                
                // Estadísticas mejoradas
                event.stats.gamesAffected++;
                event.stats.treasuresFound = (event.stats.treasuresFound || 0) + 1;
                event.stats.totalTreasureValue = (event.stats.totalTreasureValue || 0) + treasureReward;
                if (xpBonus > 0) {
                    event.stats.totalXpGiven = (event.stats.totalXpGiven || 0) + xpBonus;
                }
            }
        }
        
        if (appliedEvents.length > 0) {
            for (const event of appliedEvents) {
                await this.saveEvent(event.id, event);
            }
        }
        
        return rewards;
    }

    // Mostrar eventos activos
    async showActiveEvents(message) {
        const activeEvents = this.getActiveEvents();
        const eventsFromCode = this.eventTypes[eventType];
        
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
                name: `${eventsFromCode.emoji} ${event.name}`,
                value: `${effectsText}\n⏰ **Tiempo restante:** ${timeLeftText}`,
                inline: false
            });
        }
        
        await message.reply({ embeds: [embed] });
    }

    // Crear evento manual (admin)
    async createManualEvent(message, eventType, duration = null) {
        if (!message.member?.permissions.has('Administrator')) {
            await message.reply('❌ Solo administradores pueden crear eventos manuales.');
            return;
        }

        if (!this.guild) this.guild = message.guild;
        
        if (!this.eventTypes[eventType]) {
            const availableTypes = Object.keys(this.eventTypes).join(', ');
            await message.reply(`❌ Tipo de evento inválido. Disponibles: ${availableTypes}`);
            return;
        }
        
        const customDuration = duration ? duration * 60000 : null; // Convertir minutos a ms
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
    }

    // Limpiar eventos expirados
    async cleanExpiredEvents() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [eventId, event] of Object.entries(this.activeEvents)) {
            if (event.endTime <= now) {
                delete this.activeEvents[eventId];
                await this.deleteEvent(eventId);
                await this.announceEvent(event, 'expired');
                cleaned++;
                console.log(`🧹 Evento expirado limpiado: ${event.name}`);
            }
        }
    }

    // Obtener nombre legible del multiplicador
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

    // Formatear tiempo
    formatTime(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        
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

    // Mostrar estadísticas de eventos
    async showEventStats(message) {
        if (!message.member?.permissions.has('Administrator')) {
            await message.reply('❌ Solo administradores pueden ver estadísticas de eventos.');
            return;
        }
        
        const activeEvents = this.getActiveEvents();
        
        if (activeEvents.length === 0) {
            await message.reply('❌ No hay eventos activos para mostrar estadísticas.');
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Estadísticas de Eventos')
            .setColor('#9932CC')
            .setTimestamp();
        
        for (const event of activeEvents) {
            const stats = event.stats;
            const totalInteractions = stats.messagesAffected + stats.workJobsAffected + 
                                    stats.dailiesAffected + stats.gamesAffected;
            
            let statsText = `**Interacciones totales:** ${totalInteractions}\n` +
                            `• Mensajes: ${stats.messagesAffected}\n` +
                            `• Trabajos: ${stats.workJobsAffected}\n` +
                            `• Dailies: ${stats.dailiesAffected}\n` +
                            `• Juegos: ${stats.gamesAffected}`;
            
            // ✨ ESTADÍSTICAS ESPECIALES PARA TREASURE HUNT
            if (event.type === 'treasure_hunt') {
                statsText += `\n**🗺️ Tesoros:**\n` +
                             `• Encontrados: ${stats.treasuresFound || 0}\n` +
                             `• Valor total: ${stats.totalTreasureValue || 0} π-b$`;
                if (stats.totalXpGiven > 0) {
                    statsText += `\n• XP dado: ${stats.totalXpGiven}`;
                }
            }
            
            embed.addFields({
                name: `${event.emoji} ${event.name}`,
                value: statsText,
                inline: true
            });
        }
        
        await message.reply({ embeds: [embed] });
    }

    // Anunciar eventos en canal específico
    async announceEvent(event, action, passedGuild = null) {
        console.log(`📢 Intentando anunciar evento: ${event.name}, action: ${action}`);
        if (!this.announcementChannelId) return;    

        let targetGuild = passedGuild || this.guild;
        
        // Si no hay guild disponible, intentar obtenerlo del cliente
        if (!targetGuild && this.client) {
            try {
                const channel = await this.client.channels.fetch(this.announcementChannelId);
                targetGuild = channel?.guild;
                console.log(`🔍 Guild obtenido del cliente: ${targetGuild ? targetGuild.name : 'null'}`);
            } catch (error) {
                console.error('❌ Error obteniendo guild del canal:', error);
                return;
            }
        }
        
        if (!targetGuild) {
            console.log('⚠️ No se pudo obtener el guild para anunciar evento');
            return;
        }
        
        try {
            const channel = await targetGuild.channels.fetch(this.announcementChannelId);
            if (!channel) return;
            
            let embed;
            let shouldPing = false;
            
            if (action === 'created') {
                embed = new EmbedBuilder()
                    .setTitle(`${event.emoji} ¡Nuevo Evento Activo!`)
                    .setDescription(`**${event.name}**\n\n${event.description}`)
                    .setColor(event.color)
                    .addFields({
                        name: '⏰ Duración',
                        value: this.formatTime(event.duration),
                        inline: true
                    })
                    .setTimestamp();
                
                shouldPing = true; // Ping solo al crear
                
            } else if (action === 'expired') {
                const stats = event.stats;
                const totalInteractions = stats.messagesAffected + stats.workJobsAffected + 
                                        stats.dailiesAffected + stats.gamesAffected;
                
                embed = new EmbedBuilder()
                    .setTitle(`${event.emoji} Evento Finalizado`)
                    .setDescription(`**${event.name}** ha terminado.\n\n¡Gracias por participar!`)
                    .setColor('#808080')
                    .addFields({
                        name: '📊 Participación Total',
                        value: `${totalInteractions} interacciones`,
                        inline: true
                    })
                    .setTimestamp();
                
                shouldPing = false; // Sin ping al expirar
            }
                        
            await channel.send({
                content: shouldPing ? `<@&${EVENTOS_ROLE_ID}>` : '',
                embeds: [embed],
                allowedMentions: shouldPing ? { parse: ['roles'] } : { parse: [] }
            });
        } catch (error) {
            console.error('❌ Error enviando anuncio de evento:', error);
        }
    }
}

module.exports = EventsSystem;
