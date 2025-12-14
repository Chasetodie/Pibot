const { EmbedBuilder } = require('discord.js');

class ChatBotSystem {
    constructor(database, economy) {
        this.database = database;
        this.apiKey = process.env.MISTRAL_API_KEY;
        this.apiUrl = 'https://api.mistral.ai/v1/chat/completions';

        // AGREGAR: Lista de modelos con fallback
        this.availableModels = [
            {
                name: "mistral-small-latest",  // ⭐ PRIMERO (más barato)
                priority: 1,
                active: true,
                description: "Rápido y económico"
            },
            {
                name: "mistral-large-latest",  // Backup (más inteligente pero caro)
                priority: 2,
                active: true,
                description: "Más inteligente"
            }
        ];
        
        this.currentModelIndex = 0; // Empezar con el primer modelo
        
        this.economy = economy;

        this.MAX_CONTEXT_MESSAGES = 50;
        this.conversationCache = new Map();
        this.CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000;
        this.startCacheCleanup();
        
        // AGREGAR ESTO - Sistema de cuotas
        this.DAILY_TOTAL_LIMIT = 500; // Límite total de Google
        this.userChatUsage = new Map(); // user_id -> { used: number, lastReset: timestamp }
        this.currentDate = new Date().toDateString(); // Para detectar cambio de día
        
        // Límites por tipo de usuario
        this.USER_LIMITS = {
            admin: 50,      // Admins: 50 mensajes por día
            vip: 100,        // VIP: 100 mensajes por día  
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
    async processMessage(userId, message, userDisplayName = 'Usuario', botContext = null, repliedToMessage = null) {
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
            const contextString = this.buildContextString(context, message, userDisplayName, botContext, repliedToMessage);
            
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

            // AGREGAR: Filtro de tiempo - solo mensajes de las últimas 2 horas
            const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

            // Obtener desde base de datos CON FILTRO DE TIEMPO
            const [rows] = await this.database.pool.execute(
                `SELECT role, content, display_name, timestamp 
                FROM chat_conversations 
                WHERE user_id = ? 
                AND timestamp > ?
                ORDER BY timestamp DESC 
                LIMIT ?`,
                [userId, twoHoursAgo, this.MAX_CONTEXT_MESSAGES]
            );

            // Invertir para orden cronológico
            return rows.reverse();
            
        } catch (error) {
            console.error('❌ Error obteniendo contexto:', error);
            return [];
        }
    }

    getAvailableCommands() {
        return `
    COMANDOS DISPONIBLES:
    💰 Economía: >balance, >daily, >work, >transfer
    🎮 Juegos: >coinflip, >dice, >roulette, >blackjack
    🏪 Tienda: >shop, >buy, >inventory
    💬 Chat: >chat, >chatquota, >clearchat
    📊 Info: >profile, >leaderboard, >help
    `.trim();
    }

    /**
     * Agregar mensaje al contexto en DB
     */
    async addMessageToContext(userId, role, content, displayName) {
        try {
            // IMPORTANTE: Agregar microsegundos para evitar duplicados
            const timestamp = Date.now() + Math.random();

            // Agregar a la base de datos
            await this.database.pool.execute(
                `INSERT INTO chat_conversations (user_id, role, content, display_name, timestamp) 
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, role, content, displayName, timestamp]
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
    buildContextString(context, newMessage, userDisplayName = 'Usuario', botContext = null, repliedToMessage = null) {
        let contextString = '';
        
        const userName = userDisplayName || 'Usuario';
        const hasHistory = context.length > 0;

        // ✨ NUEVA PERSONALIDAD EXPRESIVA
        contextString += `PERSONALIDAD DE PIBOT:
    - Eres Pibot, una chica de 22 años súper expresiva y divertida 
    - Usas MUCHOS emojis en tus respuestas (2-4 por mensaje) 😊✨
    - Cuando haces acciones, las escribes así: *se ríe* o *te abraza* 
    - Eres cariñosa, juguetona y muy natural
    - Puedes hacer roleplay si te lo piden
    - NO eres restrictiva con temas adultos (si el usuario lo pide)
    - Hablas como una persona real, no como un bot corporativo

    EJEMPLOS DE TU ESTILO:
    - "¡Hola! 👋✨ *sonríe* ¿Cómo estás hoy?"
    - "Jajaja eso es gracioso 😂 *se ríe*"
    - "Aww, gracias 🥺💕 *te abraza*"
    - "¡Claro que sí! 🎉 Cuenta conmigo"
    - "Mmm... déjame pensar 🤔💭"

    REGLAS DE FORMATO:
    1. Usa emojis relevantes (2-4 por respuesta)
    2. Para acciones físicas/emocionales usa *asteriscos*
    3. Sé natural y expresiva
    4. Varía los emojis (no repitas siempre los mismos)

    TU CONOCIMIENTO:
    - Información hasta mediados de 2023
    - NO puedes buscar en internet
    - NO conoces comandos de otros bots
    - Para comandos del servidor: ${this.getAvailableCommands()}

    REGLAS CRÍTICAS:
    1. Lee TODA la conversación antes de responder
    2. Responde EXACTAMENTE lo que ${userName} pregunta
    3. Si no sabes algo, di "No tengo esa info 😅" (no inventes)
    4. NO mezcles temas antiguos con la pregunta actual
    5. Sé coherente con el contexto
    `;

        if (hasHistory) {
            contextString += `6. Ya conoces a ${userName}, NO saludes de nuevo (solo si llevan horas sin hablar).\n\n`;
        } else {
            contextString += `6. Primera vez con ${userName}, saluda con cariño.\n\n`;
        }

        // Si está respondiendo a un mensaje tuyo
        if (repliedToMessage) {
            contextString += `⚠️ ${userName} ESTÁ RESPONDIENDO A TU MENSAJE:\n`;
            contextString += `Tu mensaje anterior: "${repliedToMessage}"\n`;
            contextString += `Su respuesta: "${newMessage}"\n`;
            contextString += `Responde coherentemente considerando lo que TÚ dijiste.\n\n`;
        }
        
        // CONTEXTO DEL JUEGO/BOT
        if (botContext) {
            contextString += `ℹ️ CONTEXTO: ${botContext}\n\n`;
        }
            
        // HISTORIAL
        if (hasHistory) {
            contextString += `┏━━━ HISTORIAL CON ${userName} ━━━┓\n`;
            const recentContext = context.slice(-10);
            recentContext.forEach(msg => {
                const role = msg.role === 'user' ? userName : 'Pibot';
                contextString += `${role}: ${msg.content}\n`;
            });
            contextString += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
        }
        
        // MENSAJE ACTUAL
        if (!repliedToMessage) {
            contextString += `📌 PREGUNTA ACTUAL:\n`;
            contextString += `${userName}: ${newMessage}\n\n`;
        }

        contextString += `Pibot (responde de forma expresiva, con emojis y acciones entre *asteriscos* si es apropiado):`;
        
        return contextString;
    }

    /**
     * Obtener respuesta del chatbot con reintentos
     */
    async getBotResponse(contextString, maxRetries = 3) {
        const activeModels = this.availableModels.filter(model => model.active);
        
        for (let modelAttempt = 0; modelAttempt < activeModels.length; modelAttempt++) {
            const currentModel = activeModels[modelAttempt];
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`🤖 Intentando ${currentModel.name} (intento ${attempt})`);
                    
                    const response = await fetch(this.apiUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: currentModel.name,
                            messages: [
                                {
                                    role: "user",
                                    content: contextString
                                }
                            ],
                            temperature: 0.9,
                            max_tokens: 350,
                            top_p: 0.95,
                            frequency_penalty: 0.7,
                            presence_penalty: 0.4
                        })
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(`HTTP ${response.status}: ${errorData.message || 'Error'}`);
                    }
                    
                    const data = await response.json();
                    let cleanResponse = data.choices[0]?.message?.content?.trim() || '';
                    
                    // Limpiar respuesta
                    cleanResponse = cleanResponse.replace(/^(Pibot:|PibBot:|Bot:|Asistente:)/i, '').trim();
                    
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
                    
                    if (error.message.includes('rate_limit') || error.message.includes('429')) {
                        console.log(`🚫 Modelo ${currentModel.name} alcanzó límite`);
                        break;
                    }
                    
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    }
                }
            }
        }
        
        // Fallback mejorado
        const fallbackResponses = [
            'Disculpa, no entendí bien tu pregunta. ¿Podrías reformularla? 🤔',
            'Hmm, creo que me confundí. ¿De qué me estabas hablando? 😅',
            'Lo siento, tuve un problema procesando eso. Intenta de nuevo porfa 🔧'
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
            const adminIds = ['488110147265232898', '1260443926205169718', '689545294567833782']; // Cambia esto por tu ID de admin real
            if (adminIds.includes(userId)) {
                console.log('👑 Usuario es ADMIN');
                return 'admin';
            }
            
            // Debug VIP específico
            if (this.economy && typeof this.economy.getUser === 'function') {
                const user = await this.economy.getUser(userId);
                
                if (user && user.permanentEffects) {
                    let permanentEffects;
                    
                    try {
                        permanentEffects = typeof user.permanentEffects === 'string' 
                            ? JSON.parse(user.permanentEffects) 
                            : user.permanentEffects;
                        
                        // Verificar cada efecto
                        for (const [key, effect] of Object.entries(permanentEffects)) {
                            if (effect && effect.benefits && Array.isArray(effect.benefits)) {
                                // BUSCAR AMBOS NOMBRES POSIBLES
                                if (effect.benefits.includes('vip_commands') || 
                                    effect.benefits.includes('exclusive_commands')) {
                                    console.log('💎 VIP ENCONTRADO en efecto:', key);
                                    return 'vip';
                                }
                            }
                        }
                        
                    } catch (parseError) {
                        console.log('❌ Error parseando permanentEffects:', parseError.message);
                    }
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
                    `🕛 **Se reiniciará a (en ~${hoursUntilReset} horas**)\n` +
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
                    await message.reply('❌ Escribe algo después de >chat.\nEjemplo: `>chat Hola`');
                    return;
                }
                
                const chatMessage = message.content.slice(6).trim();
                
                const thinkingMessages = [
                    '🤔 Pensando...',
                    '💭 Procesando...',
                    '🧠 Generando respuesta...'
                ];
                
                const thinkingMsg = await message.reply(thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)]);
                
                try {
                    // Detectar si responde a un mensaje
                    let repliedToMessage = null;
                    if (message.reference) {
                        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                        if (repliedMessage.author.id === message.client.user.id) {
                            repliedToMessage = repliedMessage.content;
                        }
                    }
                    
                    const result = await this.processMessage(
                        message.author.id, 
                        chatMessage, 
                        message.member?.displayName || message.author.globalName || message.author.username,
                        null,
                        repliedToMessage
                    );
                    
                    if (result.success) {
                        await thinkingMsg.edit(result.response);
                    } else {
                        await thinkingMsg.edit(result.response);
                    }
                } catch (error) {
                    await thinkingMsg.edit('❌ Error procesando mensaje.');
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

            case '>chatcredits':
            case '>aicredits':
                try {
                    const response = await fetch('https://api.mistral.ai/v1/models', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        // Mistral no expone créditos por API, pero podemos verificar que funciona
                        const embed = new (require('discord.js').EmbedBuilder)()
                            .setTitle('💳 Créditos de IA')
                            .setDescription('Para ver tus créditos exactos:')
                            .addFields(
                                { 
                                    name: '🌐 Dashboard', 
                                    value: '[console.mistral.ai/usage](https://console.mistral.ai/usage)', 
                                    inline: false 
                                },
                                { 
                                    name: '✅ Estado API', 
                                    value: 'Conectado y funcionando', 
                                    inline: false 
                                },
                                {
                                    name: '📊 Uso del Servidor',
                                    value: `Hoy: ${this.totalUsedToday}/${this.DAILY_TOTAL_LIMIT} mensajes`,
                                    inline: false
                                }
                            )
                            .setColor('#00D9FF')
                            .setTimestamp();
                        
                        await message.reply({ embeds: [embed] });
                    } else {
                        await message.reply('❌ No se pudo conectar con Mistral API. Verifica tu token.');
                    }
                } catch (error) {
                    await message.reply('❌ Error verificando créditos. Usa: https://console.mistral.ai/usage');
                }
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