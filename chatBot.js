const { createDuckDuckGoChat } = require('free-chatbot');

class ChatBotSystem {
    constructor(database) {
        this.database = database;
        this.chatbot = null;
        this.MAX_CONTEXT_MESSAGES = 10; // Límite de mensajes por contexto
        this.conversationCache = new Map(); // Cache en memoria para acceso rápido
        this.CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutos
        this.startCacheCleanup();
    }

    /**
     * Procesar mensaje de chat y generar respuesta
     */
    async processMessage(userId, message, userDisplayName = 'Usuario') {
        try {
            // 1. Obtener contexto de conversación
            const context = await this.getConversationContext(userId);
            
            // 2. Agregar el mensaje del usuario al contexto
            await this.addMessageToContext(userId, 'user', message, userDisplayName);
            
            // 3. Preparar el contexto para el chatbot
            const contextString = this.buildContextString(context, message);
            
            // 4. Obtener respuesta del chatbot
            const botResponse = await this.getBotResponse(contextString);
            
            // 5. Guardar respuesta del bot al contexto
            await this.addMessageToContext(userId, 'assistant', botResponse, 'PibBot');
            
            // 6. Actualizar cache
            this.updateCache(userId);
            
            return {
                success: true,
                response: botResponse,
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
        
        // Agregar instrucciones del sistema
        contextString += 'Eres PibBot, un asistente amigable en un servidor de Discord llamado "Adictos a las píldoras". ';
        contextString += 'Responde de manera casual y divertida, usando emojis ocasionalmente. ';
        contextString += 'Si te preguntan sobre comandos del bot, menciona que pueden usar >help para ver la lista completa.\n\n';
        
        // Agregar contexto de conversación
        if (context.length > 0) {
            contextString += 'Contexto de la conversación:\n';
            context.forEach(msg => {
                const role = msg.role === 'user' ? msg.display_name : 'PibBot';
                contextString += `${role}: ${msg.content}\n`;
            });
            contextString += '\n';
        }
        
        // Agregar mensaje actual
        contextString += `Usuario: ${newMessage}\nPibBot:`;
        
        return contextString;
    }

    /**
     * Obtener respuesta del chatbot con reintentos
     */
    async getBotResponse(contextString, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Crear el chat si no existe
                if (!this.chatbot) {
                    this.chatbot = createDuckDuckGoChat();
                    
                    // DEBUG: Ver qué contiene
                    console.log('🔍 Chatbot creado:', this.chatbot);
                    console.log('🔍 Tipo:', typeof this.chatbot);
                    console.log('🔍 Propiedades:', Object.keys(this.chatbot));
                    console.log('🔍 Es función?', typeof this.chatbot === 'function');
                }
                
                // Probar diferentes formas de usarlo:
                let response;
                
                // Opción 1: Si es función directa
                if (typeof this.chatbot === 'function') {
                    response = await this.chatbot(contextString);
                }
                // Opción 2: Si tiene método 'chat'
                else if (this.chatbot.chat) {
                    response = await this.chatbot.chat(contextString);
                }
                // Opción 3: Si tiene método 'send'
                else if (this.chatbot.send) {
                    response = await this.chatbot.send(contextString);
                }
                // Opción 4: Si tiene método 'ask'
                else if (this.chatbot.ask) {
                    response = await this.chatbot.ask(contextString);
                }
                else {
                    throw new Error('No se pudo determinar cómo usar el chatbot');
                }
                
                // El resto del código se mantiene igual
                let cleanResponse = response.trim();
                cleanResponse = cleanResponse.replace(/^(PibBot:|Bot:|Asistente:)/i, '').trim();
                
                if (!cleanResponse || cleanResponse.length < 1) {
                    throw new Error('Respuesta vacía del chatbot');
                }
                
                if (cleanResponse.length > 1800) {
                    cleanResponse = cleanResponse.substring(0, 1800) + '...';
                }
                
                return cleanResponse;
                
            } catch (error) {
                console.error(`❌ Intento ${attempt} fallido:`, error.message);
                
                if (attempt === maxRetries) {
                    const fallbackResponses = [
                        '¡Ups! Parece que tengo un pequeño problema técnico. ¿Podrías repetir eso? 🤖',
                        'Hmm, se me trabó un poco el cerebro. ¿De qué estábamos hablando? 😅',
                        'Error 404: Respuesta inteligente no encontrada. ¡Pero estoy aquí para ayudarte! 🔧',
                        'Mi procesador necesita un cafecito ☕. ¿Puedes intentar de nuevo?'
                    ];
                    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
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
            
            console.log('🗃️ Tablas de chat inicializadas');
        } catch (error) {
            console.error('❌ Error creando tablas de chat:', error);
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
     * Procesar comando de chat
     */
    async processCommand(message) {
        const args = message.content.toLowerCase().split(' ');
        const command = args[0];

        switch (command) {
            case '>chat':
                if (!args[1]) {
                    await message.reply('❌ Escribe algo después de >chat para hablar conmigo.\nEjemplo: `>chat Hola, ¿cómo estás?`');
                    return;
                }
                
                const chatMessage = message.content.slice(6).trim(); // Remover '>chat '
                const result = await this.processMessage(
                    message.author.id, 
                    chatMessage, 
                    message.author.displayName || message.author.username
                );
                
                if (result.success) {
                    await message.reply(result.response);
                } else {
                    await message.reply('❌ Error procesando mensaje de chat.');
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