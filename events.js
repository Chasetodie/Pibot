const { EmbedBuilder } = require('discord.js');
const admin = require('firebase-admin'); // ← Asegúrate de tener esta línea

class EventsSystem {
    constructor(economySystem) {
        this.economy = economySystem;
        
        // Importar admin directamente desde firebase-admin
        const admin = require('firebase-admin');
        this.admin = admin; // Guardar referencia
        
        // Verificar que Firebase esté inicializado
        try {
            this.eventsCollection = admin.firestore().collection('serverEvents');
            console.log('🔥 Firebase conectado en EventsSystem');
        } catch (error) {
            console.error('❌ Error conectando Firebase en eventos:', error);
            // Fallback: crear colección vacía para evitar crashes
            this.eventsCollection = null;
        }
        
        this.activeEvents = {};

        // Cargar eventos después de un breve delay para asegurar conexión
        setTimeout(() => {
            this.loadEvents();
        }, 1000);
        
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
                multiplier: { xp: 1.5, work: 1.3, cooldown: 0.5 },
                minDuration: 2700000, // 45 minutos
                maxDuration: 5400000  // 1.5 horas
            },
            'charity_event': {
                name: '❤️ Evento de Caridad',
                description: 'Dona dinero y recibe bonificaciones especiales',
                emoji: '❤️',
                color: '#FF69B4',
                minDuration: 7200000,  // 2 horas
                maxDuration: 21600000, // 6 horas
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
                multiplier: { work: 0.7, daily: 0.8, gambling: 1.5 },
                minDuration: 1800000, // 30 minutos
                maxDuration: 3600000, // 1 hora
                negative: true
            },
            'server_anniversary': {
                name: '🎉 Aniversario del Servidor',
                description: 'Celebración especial con múltiples bonificaciones',
                emoji: '🎉',
                color: '#9932CC',
                multiplier: { xp: 3, work: 2, daily: 2, gambling: 1.2 },
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
            'lucky_hour': 0.10,     // 10%
            'fever_time': 0.08,     // 8%
            'charity_event': 0.05,  // 5%
            'treasure_hunt': 0.04,  // 4%
            'market_crash': 0.03,   // 3%
            'server_anniversary': 0.01 // 1% (muy raro)
        };
        
        // Iniciar sistema después del delay
        setTimeout(() => {
            this.startEventLoop();
            this.cleanExpiredEvents();
        }, 2000);
    }

    // Cargar eventos desde archivo
    async loadEvents() {
        // Verificar que Firebase esté disponible
        if (!this.eventsCollection) {
            console.log('⚠️ Firebase no disponible para cargar eventos');
            return;
        }
        
        try {
            const snapshot = await this.eventsCollection.get();
            
            if (snapshot.empty) {
                console.log('🆕 No hay eventos en Firebase, creando colección');
                return;
            }
            
            this.activeEvents = {};
            snapshot.forEach(doc => {
                this.activeEvents[doc.id] = doc.data();
            });
            
            console.log(`📅 ${Object.keys(this.activeEvents).length} eventos cargados desde Firebase`);
            
            // Limpiar eventos expirados al cargar
            this.cleanExpiredEvents();
        } catch (error) {
            console.error('❌ Error cargando eventos desde Firebase:', error);
        }
    }

    // Guardar evento individual en Firebase
    async saveEvent(eventId, eventData) {
        // Verificar que Firebase esté disponible
        if (!this.eventsCollection) {
            console.log('⚠️ Firebase no disponible, evento no guardado:', eventId);
            return;
        }
        
        try {
            await this.eventsCollection.doc(eventId).set({
                ...eventData,
                updatedAt: this.admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`💾 Evento ${eventId} guardado en Firebase`);
        } catch (error) {
            console.error('❌ Error guardando evento en Firebase:', error);
        }
    }
    
    // Eliminar evento de Firebase
    async deleteEvent(eventId) {
        // Verificar que Firebase esté disponible
        if (!this.eventsCollection) {
            console.log('⚠️ Firebase no disponible, evento no eliminado:', eventId);
            return;
        }
        
        try {
            await this.eventsCollection.doc(eventId).delete();
            console.log(`🗑️ Evento ${eventId} eliminado de Firebase`);
        } catch (error) {
            console.error('❌ Error eliminando evento de Firebase:', error);
        }
    }

    // Iniciar el loop de eventos automáticos
    startEventLoop() {
        // Verificar cada hora si crear nuevos eventos
        setInterval(async () => {
            await this.tryCreateRandomEvent();
        }, 3600000); // 1 hora
        
        // Limpiar eventos expirados cada 10 minutos
        setInterval(async () => {
            await this.cleanExpiredEvents();
        }, 600000); // 10 minutos
        
        console.log('🔄 Sistema de eventos iniciado');
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
        return event;
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

    // Aplicar modificadores de eventos a XP
    async applyEventModifiers(userId, baseXp, context = 'message') {
        let finalXp = baseXp;
        let appliedEvents = [];
        
        for (const event of this.getActiveEvents()) {
            if (event.multipliers.xp) {
                finalXp = Math.floor(finalXp * event.multipliers.xp);
                appliedEvents.push(event);
                
                // Actualizar estadísticas del evento
                if (context === 'message') {
                    event.stats.messagesAffected++;
                } else if (context === 'games') {
                    event.stats.gamesAffected++;
                }
            }
        }
        
        if (appliedEvents.length > 0) {
            // Guardar eventos modificados en Firebase
            for (const event of appliedEvents) {
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
        
        for (const event of this.getActiveEvents()) {
            let multiplier = 1;
            
            if (context === 'work' && event.multipliers.work) {
                multiplier = event.multipliers.work;
            } else if (context === 'daily' && event.multipliers.daily) {
                multiplier = event.multipliers.daily;
            }
            
            if (multiplier !== 1) {
                finalAmount = Math.floor(finalAmount * multiplier);
                appliedEvents.push(event);
                
                // Actualizar estadísticas
                if (context === 'work') {
                    event.stats.workJobsAffected++;
                } else if (context === 'daily') {
                    event.stats.dailiesAffected++;
                }
            }
        }
        
        if (appliedEvents.length > 0) {
            // Guardar eventos modificados en Firebase
            for (const event of appliedEvents) {
                await this.saveEvent(event.id, event);
            }
        }
        
        return {
            originalAmount: baseAmount,
            finalAmount: finalAmount,
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
            
            if (event.type === 'lucky_hour' && context === 'gambling') {
                // Mejorar probabilidades en minijuegos
                rewards.push({
                    type: 'luck_boost',
                    multiplier: event.multipliers.luck,
                    event: event
                });
            }
        }
        
        if (appliedEvents.length > 0) {
            // Guardar eventos modificados en Firebase
            for (const event of appliedEvents) {
                await this.saveEvent(event.id, event);
            }
        }
        
        return rewards;
    }

    // Mostrar eventos activos
    async showActiveEvents(message) {
        const activeEvents = this.getActiveEvents();
        
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

    // Crear evento manual (admin)
    async createManualEvent(message, eventType, duration = null) {
        if (!message.member?.permissions.has('Administrator')) {
            await message.reply('❌ Solo administradores pueden crear eventos manuales.');
            return;
        }
        
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
        
        // Anunciar en el canal
        const announcement = new EmbedBuilder()
            .setTitle(`${event.emoji} ¡Nuevo Evento Activo!`)
            .setDescription(`**${event.name}**\n\n${event.description}`)
            .addFields({
                name: '⏰ Duración',
                value: this.formatTime(event.duration),
                inline: true
            })
            .setColor(event.color)
            .setFooter({ text: 'Usa >events para ver todos los eventos activos' })
            .setTimestamp();
        
        await message.channel.send({ embeds: [announcement] });
    }

    // Limpiar eventos expirados
    async cleanExpiredEvents() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [eventId, event] of Object.entries(this.activeEvents)) {
            if (event.endTime <= now) {
                delete this.activeEvents[eventId];
                await this.deleteEvent(eventId); // Eliminar de Firebase
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
}

module.exports = EventsSystem;
