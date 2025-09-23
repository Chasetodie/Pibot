const Groq = require('groq-sdk');
const { EmbedBuilder } = require('discord.js');

class ChatBotSystem {
    constructor(database, economy) {
        this.database = database;
        this.groq = new Groq({
            apiKey: process.env.GROQAPI
        });

        // AGREGAR: Lista de modelos con fallback
        this.availableModels = [
            {
                name: "llama-3.1-8b-instant",
                priority: 1,
                active: true,
                description: "Rápido y eficiente"
            },
            {
                name: "llama-3.3-70b-versatile", 
                priority: 2,
                active: true,
                description: "Mejor calidad"
            }
        ];
        
        this.currentModelIndex = 0; // Empezar con el primer modelo
        
        this.economy = economy;

        this.MAX_CONTEXT_MESSAGES = 10;
        this.conversationCache = new Map();
        this.CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000;
        this.startCacheCleanup();
        
        // AGREGAR ESTO - Sistema de cuotas
        this.DAILY_TOTAL_LIMIT = 500; // Límite total de Google
        this.userChatUsage = new Map(); // user_id -> { used: number, lastReset: timestamp }
        this.currentDate = new Date().toDateString(); // Para detectar cambio de día
        
        // Límites por tipo de usuario
        this.USER_LIMITS = {
            admin: 75,      // Admins: 75 mensajes por día
            vip: 150,        // VIP: 150 mensajes por día  
            regular: 20      // Usuarios normales: 20 mensajes por día
        };
        
        this.totalUsedToday = 0;
        this.startDailyReset();
    }

    /**
     * Si necesitas el método parseEffects aquí también
     */
    parseEffects(effectsString) {
        if (!effectsString || effectsString.trim() === '') {
            return {};
        }
        try {
            return JSON.parse(effectsString);
        } catch (error) {
            console.error('❌ Error parseando efectos permanentes:', error);
            return {};
        }
    }

    /**
     * Procesar mensaje de chat y generar respuesta
     */
    async processMessage(userId, message, userDisplayName = 'Usuario') {
        try {
            // 1. Verificar límites del usuario
            const limitCheck = await this.canUserSendMessage(userId);
            if (!limitCheck.canSend) {
                return {
                    success: false,
                    response: limitCheck.reason,
                    limitReached: true
                };
            }
            
            // 2. Obtener contexto de conversación
            const context = await this.getConversationContext(userId);
            
            // 3. Agregar el mensaje del usuario al contexto
            await this.addMessageToContext(userId, 'user', message, userDisplayName);
            
            // 4. Preparar el contexto para el chatbot
            const contextString = this.buildContextString(context, message);
            
            // 5. Obtener respuesta del chatbot
            const botResponse = await this.getBotResponse(contextString);
            
            // 6. Actualizar uso del usuario
            this.updateUserUsage(userId);
            
            // 7. Guardar respuesta del bot al contexto
            await this.addMessageToContext(userId, 'assistant', botResponse, 'Pibot');
            
            // 8. Actualizar cache
            this.updateCache(userId);
            
            // 9. Preparar mensaje de respuesta con alertas
            let responseMessage = botResponse;
            const quotaInfo = await this.getUserQuotaInfo(userId);

            // Agregar alertas según mensajes restantes
            if (quotaInfo.remaining === 0) {
                responseMessage += `\n\n🚫 **¡LÍMITE ALCANZADO!** Has usado todos tus mensajes de hoy (${quotaInfo.used}/${quotaInfo.limit}).`;
                if (quotaInfo.userType === 'regular') {
                    responseMessage += `\n💎 ¡Consigue un **pase VIP** para 150 mensajes diarios!`;
                }
            } else if (quotaInfo.remaining <= 5) {
                responseMessage += `\n\n⚠️ **¡POCOS MENSAJES!** Te quedan solo **${quotaInfo.remaining}** mensajes.`;
            } else if (quotaInfo.remaining <= 15) {
                responseMessage += `\n\n🔔 Te quedan **${quotaInfo.remaining}** mensajes (${quotaInfo.userType.toUpperCase()}).`;
            } else {
                responseMessage += `\n\n📊 Mensajes Restantes: **${quotaInfo.remaining}** (${quotaInfo.userType.toUpperCase()})`;
            }

            // Alerta global si queda poco
            const globalRemaining = this.DAILY_TOTAL_LIMIT - this.totalUsedToday;
            if (globalRemaining <= 100) {
                responseMessage += `\n🌍 **ALERTA GLOBAL:** Solo ${globalRemaining} mensajes restantes para todo el servidor.`;
            }
            
            return {
                success: true,
                response: responseMessage,
                contextLength: context.length + 1
            };
            
        } catch (error) {
            console.error('❌ Error en ChatBot:', error);
            return {
                success: false,
                response: 'Lo siento, tuve un problema al procesar tu mensaje. ¿Podrías intentar de nuevo?',
                error: error.message
            };
        }
    }

    /**
     * Obtener contexto de conversación desde DB
     */
    async getConversationContext(userId) {
        try {
            // Verificar cache primero
            if (this.conversationCache.has(userId)) {
                const cached = this.conversationCache.get(userId);
                if (Date.now() - cached.timestamp < this.CACHE_CLEANUP_INTERVAL) {
                    return cached.context;
                }
            }

            // Obtener desde base de datos
            const [rows] = await this.database.pool.execute(
                `SELECT role, content, display_name, timestamp 
                 FROM chat_conversations 
                 WHERE user_id = ? 
                 ORDER BY timestamp DESC 
                 LIMIT ?`,
                [userId, this.MAX_CONTEXT_MESSAGES]
            );

            // Invertir para orden cronológico
            return rows.reverse();
            
        } catch (error) {
            console.error('❌ Error obteniendo contexto:', error);
            return [];
        }
    }

    /**
     * Agregar mensaje al contexto en DB
     */
    async addMessageToContext(userId, role, content, displayName) {
        try {
            // Agregar a la base de datos
            await this.database.pool.execute(
                `INSERT INTO chat_conversations (user_id, role, content, display_name, timestamp) 
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, role, content, displayName, Date.now()]
            );

            // Limpiar mensajes antiguos (mantener solo los últimos MAX_CONTEXT_MESSAGES)
            await this.database.pool.execute(`
                DELETE FROM chat_conversations 
                WHERE user_id = ? AND id NOT IN (
                    SELECT id FROM (
                        SELECT id FROM chat_conversations 
                        WHERE user_id = ? 
                        ORDER BY timestamp DESC 
                        LIMIT ?
                    ) as recent
                )`,
                [userId, userId, this.MAX_CONTEXT_MESSAGES]
            );

        } catch (error) {
            console.error('❌ Error guardando mensaje:', error);
        }
    }

    /**
     * Construir string de contexto para el chatbot
     */
    buildContextString(context, newMessage) {
        let contextString = '';
        
        // AGREGAR PERSONALIDAD Y GÉNERO AQUÍ
        contextString += 'Eres Pibot, tienes 22 años y personalidad relajada, además de que tu género es femenino. ';
        contextString += 'Te gustan los videojuegos, memes y tecnología. ';
        contextString += 'Hablas de forma casual y amigable. Y adicional, usas emojis en tus respuestas, un gesto super lindo. El unico problema, es que estos emojis son para discord, a lo cual no se si sabes usarlo, pero son algo asi :sob:, :joy:, :star:. Cada uno da un emoji, asi que puedes usar cualquiera que tu quieras, obviamente segun los que existan en discord. ';
        contextString += 'Puedes hacer bromas y usar humor. ';
        
        // El resto del código se mantiene igual
        if (context.length > 0) {
            contextString += 'Contexto de la conversación:\n';
            context.forEach(msg => {
                const role = msg.role === 'user' ? msg.display_name : 'Pibot';
                contextString += `${role}: ${msg.content}\n`;
            });
            contextString += '\n';
        }
        
        contextString += `Usuario: ${newMessage}\nPibot:`;
        
        return contextString;
    }

    /**
     * Obtener respuesta del chatbot con reintentos
     */
    async getBotResponse(contextString, maxRetries = 3) {
        const activeModels = this.availableModels.filter(model => model.active);
        
        for (let modelAttempt = 0; modelAttempt < activeModels.length; modelAttempt++) {
            const currentModel = activeModels[modelAttempt];
            console.log(`🤖 Intentando con modelo: ${currentModel.name} (${currentModel.description})`);
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const completion = await this.groq.chat.completions.create({
                        messages: [
                            {
                                role: "user",
                                content: contextString
                            }
                        ],
                        model: currentModel.name, // Usar el modelo actual
                        temperature: 0.7,
                        max_tokens: 200,
                        top_p: 1,
                        stream: false
                    });
                    
                    const response = completion.choices[0]?.message?.content || '';
                    
                    // El resto del procesamiento se mantiene igual
                    let cleanResponse = response.trim();
                    cleanResponse = cleanResponse.replace(/^(PibBot:|Bot:|Asistente:)/i, '').trim();
                    
                    if (!cleanResponse || cleanResponse.length < 1) {
                        throw new Error('Respuesta vacía del chatbot');
                    }
                    
                    if (cleanResponse.length > 1800) {
                        cleanResponse = cleanResponse.substring(0, 1800) + '...';
                    }
                    
                    console.log(`✅ Éxito con modelo: ${currentModel.name}`);
                    return cleanResponse;
                    
                } catch (error) {
                    console.error(`❌ Modelo ${currentModel.name} - Intento ${attempt} fallido:`, error.message);
                    
                    // Si es error de cuota/límite, marcar modelo como inactivo temporalmente
                    if (error.message.includes('rate_limit') || error.message.includes('quota') || error.message.includes('429')) {
                        console.log(`🚫 Modelo ${currentModel.name} alcanzó límite, cambiando a siguiente...`);
                        break; // Salir del bucle de reintentos y probar siguiente modelo
                    }
                    
                    // Para otros errores, reintentar
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    } else {
                        console.log(`❌ Modelo ${currentModel.name} falló después de ${maxRetries} intentos`);
                    }
                }
            }
        }
        
        // Si todos los modelos fallaron, usar respuesta de fallback
        console.log('❌ Todos los modelos fallaron, usando respuesta predeterminada');
        const fallbackResponses = [
            '¡Ups! Parece que tengo un pequeño problema técnico. ¿Podrías repetir eso? 🤖',
            'Hmm, se me trabó un poco el cerebro. ¿De qué estábamos hablando? 😅',
            'Error 404: Respuesta inteligente no encontrada. ¡Pero estoy aquí para ayudarte! 🔧',
            'Mi procesador necesita un cafecito ☕. ¿Puedes intentar de nuevo?'
        ];
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }

    /**
     * Actualizar cache de conversación
     */
    updateCache(userId) {
        this.getConversationContext(userId).then(context => {
            this.conversationCache.set(userId, {
                context: context,
                timestamp: Date.now()
            });
        }).catch(error => {
            console.error('❌ Error actualizando cache:', error);
        });
    }

    /**
     * Determinar el tipo de usuario usando tu sistema existente
     */
    async getUserType(userId) {
        try {
            console.log('🔍 Verificando usuario VIP:', userId);
            
            // Verificar admin primero
            const adminIds = ['488110147265232898']; // Tu ID como admin para probar
            if (adminIds.includes(userId)) {
                console.log('👑 Usuario es ADMIN');
                return 'admin';
            }
            
            // Debug VIP específico
            if (this.economy && typeof this.economy.getUser === 'function') {
                const user = await this.economy.getUser(userId);
                
                console.log('🔍 ¿Usuario tiene permanentEffects?:', !!user.permanentEffects);
                console.log('🔍 permanentEffects value:', user.permanentEffects);
                
                if (user && user.permanentEffects) {
                    let permanentEffects;
                    
                    // Intentar parsear
                    try {
                        permanentEffects = typeof user.permanentEffects === 'string' 
                            ? JSON.parse(user.permanentEffects) 
                            : user.permanentEffects;
                            
                        console.log('🔍 permanentEffects parseados:', permanentEffects);
                        
                        // Verificar cada efecto
                        for (const [key, effect] of Object.entries(permanentEffects)) {
                            console.log(`🔍 Efecto "${key}":`, effect);
                            
                            if (effect && effect.benefits && Array.isArray(effect.benefits)) {
                                console.log(`🔍 Benefits en "${key}":`, effect.benefits);
                                
                                if (effect.benefits.includes('vip_commands')) {
                                    console.log('💎 ¡VIP ENCONTRADO en efecto:', key);
                                    return 'vip';
                                }
                            }
                        }
                        
                        console.log('❌ No se encontró vip_commands en ningún efecto');
                        
                    } catch (parseError) {
                        console.log('❌ Error parseando permanentEffects:', parseError.message);
                        console.log('❌ permanentEffects raw:', user.permanentEffects);
                    }
                } else {
                    console.log('❌ Usuario no tiene permanentEffects');
                }
            }
            
            console.log('👤 Usuario detectado como REGULAR');
            return 'regular';
            
        } catch (error) {
            console.error('❌ Error verificando tipo de usuario:', error);
            return 'regular';
        }
    }

    /**
     * Verificar si el usuario puede enviar mensajes
     */
    async canUserSendMessage(userId) {
        // Resetear día si es necesario
        this.checkDailyReset();
        
        // Verificar límite global PRIMERO
        if (this.totalUsedToday >= this.DAILY_TOTAL_LIMIT) {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const hoursUntilReset = Math.ceil((tomorrow - now) / (1000 * 60 * 60));
            
            return { 
                canSend: false, 
                reason: `🌍 **LÍMITE GLOBAL ALCANZADO**\n` +
                    `😴 El servidor ha usado todos los mensajes de IA hoy (${this.DAILY_TOTAL_LIMIT}).\n\n` +
                    `🕛 **Se reiniciará a medianoche** (en ~${hoursUntilReset} horas)\n` +
                    `⏰ **Horario de reseteo:** 00:00 cada día\n\n` +
                    `💡 *Tip: ¡Vuelve mañana para chatear de nuevo!*`
            };
        }
        
        // Obtener datos del usuario
        const userType = await this.getUserType(userId);
        const userLimit = this.USER_LIMITS[userType];
        const userUsage = this.userChatUsage.get(userId) || { used: 0, lastReset: Date.now() };
        
        // Verificar límite del usuario
        if (userUsage.used >= userLimit) {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const hoursUntilReset = Math.ceil((tomorrow - now) / (1000 * 60 * 60));
            
            return {
                canSend: false,
                reason: `⏰ **LÍMITE PERSONAL ALCANZADO**\n` +
                    `Has usado todos tus mensajes (${userUsage.used}/${userLimit}) hoy.\n\n` +
                    `🕛 **Se reiniciará a medianoche** (en ~${hoursUntilReset} horas)\n` +
                    `🎭 **Tu tipo:** ${userType.toUpperCase()}\n\n` +
                    `${userType === 'regular' ? '💎 ¡Consigue **pase VIP** para 150 mensajes diarios!' : '💤 ¡Descansa y vuelve mañana!'}`
            };
        }
        
        return {
            canSend: true,
            remaining: userLimit - userUsage.used,
            userType: userType,
            globalRemaining: this.DAILY_TOTAL_LIMIT - this.totalUsedToday
        };
    }

    /**
     * Actualizar el uso del usuario
     */
    updateUserUsage(userId) {
        const userUsage = this.userChatUsage.get(userId) || { used: 0, lastReset: Date.now() };
        userUsage.used += 1;
        userUsage.lastReset = Date.now();
        
        this.userChatUsage.set(userId, userUsage);
        this.totalUsedToday += 1;
        
        // AGREGAR: Guardar en base de datos
        this.saveDailyUsage(userId, userUsage.used);
        
        console.log(`📊 Usuario ${userId}: ${userUsage.used} mensajes | Global: ${this.totalUsedToday}/${this.DAILY_TOTAL_LIMIT}`);
    }

    async saveDailyUsage(userId, messagesUsed) {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            await this.database.pool.execute(`
                INSERT INTO chat_daily_usage (user_id, usage_date, messages_used) 
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE messages_used = ?
            `, [userId, today, messagesUsed, messagesUsed]);
            
        } catch (error) {
            console.error('❌ Error guardando uso diario:', error);
        }
    }

    /**
     * Verificar y resetear límites diarios
     */
    checkDailyReset() {
        const today = new Date().toDateString();
        if (today !== this.currentDate) {
            console.log('🔄 Reseteando límites diarios...');
            this.currentDate = today;
            this.userChatUsage.clear();
            this.totalUsedToday = 0;
        }
    }

    /**
     * Iniciar reseteo automático diario
     */
    startDailyReset() {
        // Verificar cada hora si cambió el día
        setInterval(() => {
            this.checkDailyReset();
        }, 60 * 60 * 1000); // 1 hora
    }

    /**
     * Limpiar contexto de un usuario
     */
    async clearUserContext(userId) {
        try {
            await this.database.pool.execute(
                'DELETE FROM chat_conversations WHERE user_id = ?',
                [userId]
            );
            
            this.conversationCache.delete(userId);
            
            return { success: true, message: 'Contexto de conversación limpiado' };
        } catch (error) {
            console.error('❌ Error limpiando contexto:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtener estadísticas de conversación
     */
    async getConversationStats(userId) {
        try {
            const [rows] = await this.database.pool.execute(
                `SELECT 
                    COUNT(*) as total_messages,
                    COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
                    COUNT(CASE WHEN role = 'assistant' THEN 1 END) as bot_messages,
                    MIN(timestamp) as first_message,
                    MAX(timestamp) as last_message
                 FROM chat_conversations 
                 WHERE user_id = ?`,
                [userId]
            );

            if (rows.length > 0) {
                const stats = rows[0];
                return {
                    totalMessages: stats.total_messages,
                    userMessages: stats.user_messages,
                    botMessages: stats.bot_messages,
                    firstMessage: stats.first_message ? new Date(stats.first_message) : null,
                    lastMessage: stats.last_message ? new Date(stats.last_message) : null
                };
            }
            
            return null;
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return null;
        }
    }

    /**
     * Inicializar tablas de chat en la base de datos
     */
    async initChatTables() {
        try {
            // Tabla existente de conversaciones
            await this.database.pool.execute(`
                CREATE TABLE IF NOT EXISTS chat_conversations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    role ENUM('user', 'assistant') NOT NULL,
                    content TEXT NOT NULL,
                    display_name VARCHAR(100),
                    timestamp BIGINT NOT NULL,
                    INDEX idx_user_timestamp (user_id, timestamp)
                )
            `);
            
            // NUEVA TABLA para cuotas diarias
            await this.database.pool.execute(`
                CREATE TABLE IF NOT EXISTS chat_daily_usage (
                    user_id VARCHAR(255) NOT NULL,
                    usage_date DATE NOT NULL,
                    messages_used INT DEFAULT 0,
                    PRIMARY KEY (user_id, usage_date),
                    INDEX idx_date (usage_date)
                )
            `);
            
            console.log('🗃️ Tablas de chat inicializadas');
            await this.loadDailyUsage();
            
        } catch (error) {
            console.error('❌ Error creando tablas de chat:', error);
        }
    }

    /**
     * Cargar uso diario desde la base de datos al iniciar
     */
    async loadDailyUsage() {
        try {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            
            // Cargar uso diario desde la nueva tabla
            const [rows] = await this.database.pool.execute(
                'SELECT user_id, messages_used FROM chat_daily_usage WHERE usage_date = ?',
                [today]
            );
            
            let totalUsed = 0;
            
            for (const row of rows) {
                this.userChatUsage.set(row.user_id, {
                    used: row.messages_used,
                    lastReset: Date.now()
                });
                totalUsed += row.messages_used;
            }
            
            this.totalUsedToday = totalUsed;
            console.log(`📊 Uso diario cargado: ${totalUsed}/${this.DAILY_TOTAL_LIMIT} mensajes`);
            
        } catch (error) {
            console.error('❌ Error cargando uso diario:', error);
        }
    }

    /**
     * Limpiar cache periódicamente
     */
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            
            for (const [userId, cached] of this.conversationCache.entries()) {
                if (now - cached.timestamp > this.CACHE_CLEANUP_INTERVAL) {
                    this.conversationCache.delete(userId);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                console.log(`🧹 Chat cache: ${cleaned} conversaciones limpiadas`);
            }
        }, this.CACHE_CLEANUP_INTERVAL);
    }

    /**
     * Verificar si un mensaje debería ser procesado por el chatbot
     */
    shouldProcessMessage(message) {
        // No procesar comandos
        if (message.content.startsWith('>')) return false;
        
        // No procesar mensajes de bots
        if (message.author.bot) return false;
        
        // No procesar mensajes muy cortos o spam
        if (message.content.length < 2) return false;
        
        // Procesar si menciona al bot o está en DM
        const botMentioned = message.mentions.has(message.client.user);
        const isDM = message.channel.type === 'DM';
        
        // También procesar mensajes que empiecen con palabras clave de conversación
        const conversationStarters = ['hola', 'hello', 'hi', 'hey', 'que tal', 'como estas'];
        const startsWithConversation = conversationStarters.some(starter => 
            message.content.toLowerCase().startsWith(starter)
        );
        
        return botMentioned || isDM || startsWithConversation || Math.random() < 0.1; // 10% chance para otros mensajes
    }

    /**
     * Obtener información detallada de la cuota del usuario
     */
    async getUserQuotaInfo(userId) {
        this.checkDailyReset();
        
        const userType = await this.getUserType(userId);
        const userLimit = this.USER_LIMITS[userType];
        const userUsage = this.userChatUsage.get(userId) || { used: 0, lastReset: Date.now() };
        
        return {
            userType: userType,
            limit: userLimit,
            used: userUsage.used,
            remaining: Math.max(0, userLimit - userUsage.used),
            globalUsed: this.totalUsedToday,
            globalRemaining: Math.max(0, this.DAILY_TOTAL_LIMIT - this.totalUsedToday)
        };
    }

    async helpCommand(message) {
        // En tu comando >help, agregar esta sección:

        const chatHelpEmbed = new EmbedBuilder()
            .setTitle('🤖 Comandos de Chat IA')
            .setDescription('Chatea con Pibot usando inteligencia artificial')
            .addFields(
                { 
                    name: '💬 Comandos de Chat', 
                    value: `\`>chat <mensaje>\` - Chatear con Pibot
                    \`>chatquota\` - Ver mensajes restantes hoy
                    \`>clearchat\` - Limpiar tu historial de chat
                    \`>chatstats\` - Ver estadísticas de tu chat`, 
                    inline: false 
                },
                { 
                    name: '📊 Límites Diarios', 
                    value: `👤 **Regular:** 50 mensajes por día
                💎 **VIP:** 250 mensajes por día  
                👑 **Admin:** 150 mensajes por día
                🔄 **Reseteo:** Cada medianoche (US Pacific Time)`, 
                    inline: false 
                },
                { 
                    name: '💡 Ejemplos de Uso', 
                    value: `\`>chat Hola, ¿cómo estás?\`
                    \`>chat Cuéntame un chiste\`
                    \`>chat Ayúdame con programación\``, 
                    inline: false 
                }
            )
            .setColor('#00ff88')
            .setFooter({ text: '💎 ¡Consigue pase VIP para más mensajes diarios!' })
            .setTimestamp();

        // Y enviar el embed:
        await message.reply({ embeds: [chatHelpEmbed] });
    }

    /**
     * Procesar comando de chat
     */
    async processCommand(message) {
        const args = message.content.toLowerCase().split(' ');
        const command = args[0];

        switch (command) {
            case '>chathelp':
                await this.helpCommand(message);
                break;
            case '>chatquota':
            case '>chatmensajes':
                const quotaInfo = await this.getUserQuotaInfo(message.author.id);
                
                const embed = new (require('discord.js').EmbedBuilder)()
                    .setTitle('📊 Estado de Mensajes de Chat')
                    .addFields(
                        { name: '👤 Tu Tipo', value: `**${quotaInfo.userType.toUpperCase()}**`, inline: true },
                        { name: '💬 Usados Hoy', value: `${quotaInfo.used}/${quotaInfo.limit}`, inline: true },
                        { name: '✨ Restantes', value: `**${quotaInfo.remaining}**`, inline: true },
                        { name: '🌍 Global Usado', value: `${this.totalUsedToday}/${this.DAILY_TOTAL_LIMIT}`, inline: true },
                        { name: '🌍 Global Restante', value: `**${this.DAILY_TOTAL_LIMIT - this.totalUsedToday}**`, inline: true },
                        { name: '🔄 Resetea', value: 'Medianoche', inline: true }
                    )
                    .setColor(quotaInfo.userType === 'admin' ? '#ff6b6b' : quotaInfo.userType === 'vip' ? '#ffd93d' : '#6bcf7f')
                    .setFooter({ text: quotaInfo.userType === 'regular' ? '💎 ¡Consigue pase VIP para más mensajes!' : '¡Disfruta chateando!' })
                    .setTimestamp();
                
                await message.reply({ embeds: [embed] });
                break;
            case '>chat':
                if (!args[1]) {
                    await message.reply('❌ Escribe algo después de >chat para hablar conmigo.\nEjemplo: `>chat Hola, ¿cómo estás?`');
                    return;
                }
                
                const chatMessage = message.content.slice(6).trim(); // Remover '>chat '
                
                // ENVIAR MENSAJE DE "PENSANDO" PRIMERO
                const thinkingMessages = [
                    '🤔 Pensando...',
                    '💭 Procesando tu mensaje...',
                    '🧠 Generando respuesta...',
                    '⚡ Consultando mi base de conocimientos...',
                    '🔄 Analizando tu pregunta...'
                ];
                
                const thinkingMsg = await message.reply(thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)]);
                
                try {
                    const result = await this.processMessage(
                        message.author.id, 
                        chatMessage, 
                        message.author.displayName || message.author.username
                    );
                    
                    if (result.success) {
                        // EDITAR el mensaje de "pensando" con la respuesta real
                        await thinkingMsg.edit(result.response);
                    } else {
                        // EDITAR con error si hay problema
                        await thinkingMsg.edit(result.response);
                    }
                } catch (error) {
                    await thinkingMsg.edit('❌ Error procesando mensaje de chat.');
                }
                break;

            case '>clearchat':
                const clearResult = await this.clearUserContext(message.author.id);
                if (clearResult.success) {
                    await message.reply('✅ Tu historial de chat ha sido limpiado.');
                } else {
                    await message.reply('❌ Error limpiando historial de chat.');
                }
                break;
            // Agregar en processCommand:
            case '>chatmodels':
                let modelStatus = '🤖 **Estado de Modelos IA:**\n\n';
                this.availableModels.forEach((model, index) => {
                    const status = model.active ? '✅ Activo' : '❌ Inactivo';
                    const current = index === this.currentModelIndex ? ' **(ACTUAL)**' : '';
                    modelStatus += `**${model.name}**${current}\n`;
                    modelStatus += `└ ${status} - ${model.description}\n\n`;
                });
                
                await message.reply(modelStatus);
                break;

            case '>chatstats':
                const stats = await this.getConversationStats(message.author.id);
                if (stats && stats.totalMessages > 0) {
                    const embed = new (require('discord.js').EmbedBuilder)()
                        .setTitle('📊 Estadísticas de Chat')
                        .addFields(
                            { name: '💬 Mensajes Totales', value: `${stats.totalMessages}`, inline: true },
                            { name: '👤 Tus Mensajes', value: `${stats.userMessages}`, inline: true },
                            { name: '🤖 Mis Respuestas', value: `${stats.botMessages}`, inline: true }
                        )
                        .setColor('#0099ff')
                        .setTimestamp();
                    
                    await message.reply({ embeds: [embed] });
                } else {
                    await message.reply('📝 No tienes historial de chat aún. ¡Usa `>chat` para empezar una conversación!');
                }
                break;
        }
    }
}

module.exports = ChatBotSystem;