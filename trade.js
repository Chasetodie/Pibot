const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class TradeSystem {
    constructor(shopSystem) {
        this.shop = shopSystem;
        this.db = this.shop.economy.db;
        this.tradeTimeout = 300000; // 5 minutos timeout

        // ✅ AGREGAR: Caché para trades activos
        this.activeTradesCache = new Map();
        this.cacheTimeout = 2 * 60 * 1000; // 2 minutos        
    }

    async acceptTradeButton(userId, tradeData) {
        try {
            // Convertir datos de DB
            tradeData.initiatorOffer = tradeData.initiator_offer || [];
            tradeData.targetOffer = tradeData.target_offer || [];
            tradeData.initiatorMoneyOffer = tradeData.initiator_money_offer || 0;
            tradeData.targetMoneyOffer = tradeData.target_money_offer || 0;
            tradeData.initiatorAccepted = tradeData.initiator_accepted || false;
            tradeData.targetAccepted = tradeData.target_accepted || false;
            
            // Verificar que ambos ofrecen algo
            const initiatorHasOffer = tradeData.initiatorOffer.length > 0 || tradeData.initiatorMoneyOffer > 0;
            const targetHasOffer = tradeData.targetOffer.length > 0 || tradeData.targetMoneyOffer > 0;
            
            if (!initiatorHasOffer || !targetHasOffer) {
                return { 
                    success: false,
                    message: '❌ Ambos usuarios deben ofrecer algo para completar el intercambio.' 
                };
            }
            
            // Marcar como aceptado
            if (tradeData.initiator === userId) {
                tradeData.initiatorAccepted = true;
            } else {
                tradeData.targetAccepted = true;
            }
            
            // Actualizar en DB
            await this.updateTradeInDb(tradeData);
            
            if (tradeData.initiatorAccepted && tradeData.targetAccepted) {
                // Completar trade
                const success = await this.completeTrade(tradeData);
                return {
                    success: success,
                    completed: true,
                    message: success ? '✅ ¡Intercambio completado exitosamente!' : '❌ Error completando el intercambio.'
                };
            } else {
                return {
                    success: true,
                    completed: false,
                    message: '✅ Has aceptado el intercambio. Esperando al otro usuario...'
                };
            }
            
        } catch (error) {
            console.error('Error en acceptTradeButton:', error);
            return { success: false, message: '❌ Error procesando la aceptación.' };
        }
    }
    
    async cleanupExpiredTrades() {
        try {
            const fiveMinutesAgo = new Date(Date.now() - this.tradeTimeout);
            
            await new Promise((resolve, reject) => {
                this.db.db.run(`
                    UPDATE trades 
                    SET status = 'expired' 
                    WHERE status = 'pending' 
                    AND created_at < ?
                `, [fiveMinutesAgo.toISOString()], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            // Limpiar caché de trades expirados
            for (const [tradeId, cached] of this.activeTradesCache) {
                if (Date.now() - cached.timestamp > this.tradeTimeout) {
                    this.activeTradesCache.delete(tradeId);
                }
            }
            
        } catch (error) {
            console.error('❌ Error limpiando trades:', error);
        }
    }

    async saveTradeToDb(tradeData) {
        try {
            const tradeForDB = {
                id: tradeData.id,
                initiator: tradeData.initiator,
                target: tradeData.target,
                initiator_items: JSON.stringify(tradeData.initiatorOffer || []),
                target_items: JSON.stringify(tradeData.targetOffer || []),
                initiator_money: tradeData.initiatorMoneyOffer || 0,
                target_money: tradeData.targetMoneyOffer || 0,
                status: tradeData.status || 'pending',
                created_at: new Date().toISOString()
            };
            
            await this.db.createTrade(tradeForDB);
            
            // Agregar al caché
            this.activeTradesCache.set(tradeData.id, {
                data: tradeData,
                timestamp: Date.now()
            });
            
            console.log(`💾 Trade ${tradeData.id} guardado en SQLite`);
            return true;
        } catch (error) {
            console.error('❌ Error guardando trade:', error);
            return false;
        }
    }

    async updateTradeInDb(tradeData) {
        try {
            const updateData = {
                initiator_items: JSON.stringify(tradeData.initiatorOffer || tradeData.initiator_offer || []),
                target_items: JSON.stringify(tradeData.targetOffer || tradeData.target_offer || []),
                initiator_money: tradeData.initiatorMoneyOffer || tradeData.initiator_money_offer || 0,
                target_money: tradeData.targetMoneyOffer || tradeData.target_money_offer || 0,
                initiator_accepted: tradeData.initiatorAccepted || tradeData.initiator_accepted || false,
                target_accepted: tradeData.targetAccepted || tradeData.target_accepted || false,
                status: tradeData.status || 'pending'
            };
            
            await this.db.updateTrade(tradeData.id, updateData);
            
            // Actualizar caché
            this.activeTradesCache.set(tradeData.id, {
                data: tradeData,
                timestamp: Date.now()
            });
            
            return true;
        } catch (error) {
            console.error('❌ Error actualizando trade:', error);
            return false;
        }
    }

    async getActiveTradeByUser(userId) {
        try {
            // Verificar caché primero
            for (const [tradeId, cached] of this.activeTradesCache) {
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    const trade = cached.data;
                    if ((trade.initiator === userId || trade.target === userId) && 
                        trade.status === 'pending') {
                        return trade;
                    }
                }
            }
            
            // Si no está en caché, consultar DB
            const trade = await new Promise((resolve, reject) => {
                this.db.db.get(`
                    SELECT * FROM trades 
                    WHERE (initiator = ? OR target = ?) 
                    AND status = 'pending'
                    ORDER BY created_at DESC
                    LIMIT 1
                `, [userId, userId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (trade) {
                // Convertir formato DB a formato JavaScript
                const tradeData = {
                    id: trade.id,
                    initiator: trade.initiator,
                    target: trade.target,
                    initiator_offer: JSON.parse(trade.initiator_items || '[]'),
                    target_offer: JSON.parse(trade.target_items || '[]'),
                    initiator_money_offer: trade.initiator_money || 0,
                    target_money_offer: trade.target_money || 0,
                    initiator_accepted: trade.initiator_accepted || false,
                    target_accepted: trade.target_accepted || false,
                    status: trade.status,
                    created_at: trade.created_at
                };
                
                // Agregar al caché
                this.activeTradesCache.set(trade.id, {
                    data: tradeData,
                    timestamp: Date.now()
                });
                
                return tradeData;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Error obteniendo trade activo:', error);
            return null;
        }
    }

    async completeTradeInDb(tradeId) {
        try {
            await this.db.updateTrade(tradeId, {
                status: 'completed',
                completed_at: new Date().toISOString()
            });
            
            // Remover del caché
            this.activeTradesCache.delete(tradeId);
            
            return true;
        } catch (error) {
            console.error('❌ Error completando trade en DB:', error);
            return false;
        }
    }
    
    // Iniciar intercambio
    async startTrade(message, targetUser) {
        const userId = message.author.id;
        const targetId = targetUser.id;
        
        if (userId === targetId) {
            await message.reply('❌ No puedes intercambiar contigo mismo.');
            return;
        }
        
        const existingTrade = await this.getActiveTradeByUser(userId);
        if (existingTrade) {
            await message.reply('❌ Ya tienes un intercambio activo.');
            return;
        }

        const targetExistingTrade = await this.getActiveTradeByUser(targetId);
        if (targetExistingTrade) {
            await message.reply('❌ Ese usuario ya tiene un intercambio activo.');
            return;
        }
        
        const tradeId = `${userId}_${targetId}_${Date.now()}`;
        const tradeData = {
            id: tradeId,
            initiator: userId,
            target: targetId,
            initiatorOffer: [],
            targetOffer: [],
            initiatorMoneyOffer: 0,
            targetMoneyOffer: 0,
            initiatorAccepted: false,
            targetAccepted: false,
            createdAt: Date.now(),
            channel: message.channel.id,
            status: 'pending'
        };
        
        const saved = await this.saveTradeToDb(tradeData);
        if (!saved) {
            await message.reply('❌ Error guardando el intercambio.');
            return;
        }
        
        // Timeout automático - cancelar después de 5 minutos
        setTimeout(async () => {
            try {
                // Verificar si el trade aún está activo
                const stillActive = await this.db.getTrade(tradeId);
                
                if (stillActive && stillActive.status === 'pending') {
                    await this.cancelTradeInDb(tradeId, 'timeout');
                    
                    // Notificar en el canal
                    try {
                        const channel = await message.client.channels.fetch(tradeData.channel);
                        await channel.send(`⏰ El intercambio entre ${message.author} y ${targetUser} ha expirado por inactividad.`);
                    } catch (err) {
                        console.log('No se pudo notificar la expiración del trade');
                    }
                }
            } catch (error) {
                console.error('Error cancelando trade automáticamente:', error);
            }
        }, this.tradeTimeout);
        
        const embed = new EmbedBuilder()
            .setTitle('🔄 Intercambio Iniciado')
            .setDescription(`${message.author} quiere intercambiar con ${targetUser}`)
            .addFields(
                { name: `📦 Oferta de ${message.author.displayName}`, value: 'Nada', inline: true },
                { name: `📦 Oferta de ${targetUser.displayName}`, value: 'Nada', inline: true }
            )
            .setColor('#FFA500')
            .setFooter({ text: 'Usa >tradeadd, >trademoney, >tradeaccept, >tradecancel' });
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`trade_accept_${tradeId}`)
                    .setLabel('✅ Aceptar')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`trade_cancel_${tradeId}`)
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Danger)
            );
        
        await message.reply({ 
            content: `${targetUser}, tienes una propuesta de intercambio!`,
            embeds: [embed],
            components: [buttons]
        });
        
        return tradeData;
    }

    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [tradeId, cached] of this.activeTradesCache) {
                if (now - cached.timestamp > this.cacheTimeout) {
                    this.activeTradesCache.delete(tradeId);
                }
            }
        }, 5 * 60 * 1000); // Limpiar cada 5 minutos
    }
    
    // Agregar item al intercambio
    async addItemToTrade(message, itemId, quantity = 1) {
        const userId = message.author.id;
        const tradeData = await this.getActiveTradeByUser(userId);
        
        if (!tradeData) {
            await message.reply('❌ No tienes ningún intercambio activo.');
            return;
        }
        
        // Convertir arrays de JSON a JavaScript
        tradeData.initiatorOffer = Array.isArray(tradeData.initiator_offer) ? tradeData.initiator_offer : [];
        tradeData.targetOffer = Array.isArray(tradeData.target_offer) ? tradeData.target_offer : [];
        tradeData.initiatorMoneyOffer = tradeData.initiator_money_offer || 0;
        tradeData.targetMoneyOffer = tradeData.target_money_offer || 0;
            
        // Verificar que el usuario tenga el item
        const user = await this.shop.economy.getUser(userId);
        const userItems = user.items || {};
        
        if (!userItems[itemId] || userItems[itemId].quantity < quantity) {
            await message.reply(`❌ No tienes suficientes **${itemId}** (Tienes: ${userItems[itemId]?.quantity || 0})`);
            return;
        }
        
        // Determinar qué array usar
        const isInitiator = tradeData.initiator === userId;
        const offerArray = isInitiator ? tradeData.initiatorOffer : tradeData.targetOffer;
        
        // Verificar si ya está en la oferta
        const existingIndex = offerArray.findIndex(item => item.id === itemId);
        if (existingIndex !== -1) {
            offerArray[existingIndex].quantity += quantity;
        } else {
            offerArray.push({ id: itemId, quantity: quantity });
        }
        
        // IMPORTANTE: Sincronizar con campos de DB
        if (isInitiator) {
            tradeData.initiator_offer = tradeData.initiatorOffer;
        } else {
            tradeData.target_offer = tradeData.targetOffer;
        }
        
        // Reset acceptance
        tradeData.initiatorAccepted = false;
        tradeData.targetAccepted = false;
        // IMPORTANTE: También en formato DB
        tradeData.initiator_accepted = false;
        tradeData.target_accepted = false;
        
        await this.updateTradeEmbed(message.channel, tradeData);
        await message.reply(`✅ Agregado **${itemId}** x${quantity} a tu oferta.`);
        await this.updateTradeInDb(tradeData);
    }
    
    // Agregar dinero al intercambio
    async addMoneyToTrade(message, amount) {
        const userId = message.author.id;
        const tradeData = await this.getActiveTradeByUser(userId);
        
        if (!tradeData) {
            await message.reply('❌ No tienes ningún intercambio activo.');
            return;
        }
        
        // Convertir campos de DB
        tradeData.initiatorOffer = Array.isArray(tradeData.initiator_offer) ? tradeData.initiator_offer : [];
        tradeData.targetOffer = Array.isArray(tradeData.target_offer) ? tradeData.target_offer : [];
        tradeData.initiatorMoneyOffer = tradeData.initiator_money_offer || 0;
        tradeData.targetMoneyOffer = tradeData.target_money_offer || 0;
        
        if (amount <= 0) {
            await message.reply('❌ La cantidad debe ser mayor a 0.');
            return;
        }
        
        // Verificar fondos
        const user = await this.shop.economy.getUser(userId);
        if (user.balance < amount) {
            await message.reply(`❌ No tienes suficiente dinero. Balance: ${user.balance.toLocaleString('es-ES')} π-b$`);
            return;
        }
        
        // Agregar dinero a la oferta
        if (tradeData.initiator === userId) {
            tradeData.initiatorMoneyOffer += amount;
            // IMPORTANTE: También actualizar el campo para DB
            tradeData.initiator_money_offer = tradeData.initiatorMoneyOffer;
        } else {
            tradeData.targetMoneyOffer += amount;
            // IMPORTANTE: También actualizar el campo para DB  
            tradeData.target_money_offer = tradeData.targetMoneyOffer;
        }
        
        // Reset acceptance
        tradeData.initiatorAccepted = false;
        tradeData.targetAccepted = false;
        // IMPORTANTE: También resetear en formato DB
        tradeData.initiator_accepted = false;
        tradeData.target_accepted = false;

        tradeData.initiatorOffer = tradeData.initiator_offer || [];
        tradeData.targetOffer = tradeData.target_offer || [];
        tradeData.initiatorMoneyOffer = tradeData.initiator_money_offer || 0;
        tradeData.targetMoneyOffer = tradeData.target_money_offer || 0;

        console.log('Después de agregar dinero:');
        console.log('tradeData.initiatorMoneyOffer:', tradeData.initiatorMoneyOffer);
        console.log('tradeData.targetMoneyOffer:', tradeData.targetMoneyOffer);
        console.log('tradeData.initiator_money_offer:', tradeData.initiator_money_offer);
        console.log('tradeData.target_money_offer:', tradeData.target_money_offer);
        
        await this.updateTradeEmbed(message.channel, tradeData);
        await message.reply(`✅ Agregado **${amount.toLocaleString('es-ES')} π-b$** a tu oferta.`);
        await this.updateTradeInDb(tradeData);
    }
    
    // En TradeSystem.js, reemplazar acceptTrade:
    async acceptTrade(message) {
        const userId = message.author.id;
        const tradeData = await this.getActiveTradeByUser(userId);
        
        if (!tradeData) {
            await message.reply('❌ No tienes ningún intercambio activo.');
            return;
        }
        
        // Convertir datos de DB a formato JavaScript
        tradeData.initiatorOffer = tradeData.initiator_offer || [];
        tradeData.targetOffer = tradeData.target_offer || [];
        tradeData.initiatorMoneyOffer = tradeData.initiator_money_offer || 0;
        tradeData.targetMoneyOffer = tradeData.target_money_offer || 0;
        tradeData.initiatorAccepted = tradeData.initiator_accepted || false;
        tradeData.targetAccepted = tradeData.target_accepted || false;
        
        // VERIFICACIÓN: Ambos deben ofrecer algo
        const initiatorHasOffer = tradeData.initiatorOffer.length > 0 || tradeData.initiatorMoneyOffer > 0;
        const targetHasOffer = tradeData.targetOffer.length > 0 || tradeData.targetMoneyOffer > 0;
        
        if (!initiatorHasOffer || !targetHasOffer) {
            await message.reply('❌ Ambos usuarios deben ofrecer algo para completar el intercambio.');
            return;
        }
        
        // Marcar como aceptado
        if (tradeData.initiator === userId) {
            tradeData.initiatorAccepted = true;
        } else {
            tradeData.targetAccepted = true;
        }
        
        // Actualizar en base de datos
        await this.updateTradeInDb(tradeData);
        
        if (tradeData.initiatorAccepted && tradeData.targetAccepted) {
            // Completar intercambio
            const success = await this.completeTrade(tradeData);
            if (success) {
                await message.reply('✅ ¡Intercambio completado exitosamente!');
            } else {
                await message.reply('❌ Error al completar el intercambio.');
            }
        } else {
            await this.updateTradeEmbed(message.channel, tradeData);
            await message.reply('✅ Has aceptado el intercambio. Esperando al otro usuario...');
        }
    }
    
    // Cancelar intercambio
    async cancelTrade(tradeData, reason = 'manual') {
        await this.cancelTradeInDb(tradeData.id, reason);
        
        const reasonText = reason === 'timeout' ? 'por timeout' : 'manualmente';
        // Notificar en el canal si es posible
    }
    
    // Completar intercambio
    async completeTrade(tradeData) {
        console.log('=== INICIANDO COMPLETE TRADE ===');
        console.log('Trade Data:', {
            id: tradeData.id,
            initiator: tradeData.initiator,
            target: tradeData.target,
            initiatorOffer: tradeData.initiatorOffer || tradeData.initiator_offer,
            targetOffer: tradeData.targetOffer || tradeData.target_offer,
            initiatorMoney: tradeData.initiatorMoneyOffer || tradeData.initiator_money_offer,
            targetMoney: tradeData.targetMoneyOffer || tradeData.target_money_offer
        });
        
        try {
            const user1 = await this.shop.economy.getUser(tradeData.initiator);
            const user2 = await this.shop.economy.getUser(tradeData.target);
            
            // Asegurar que los arrays existen
            const initiatorOffer = tradeData.initiatorOffer || tradeData.initiator_offer || [];
            const targetOffer = tradeData.targetOffer || tradeData.target_offer || [];
            const initiatorMoney = tradeData.initiatorMoneyOffer || tradeData.initiator_money_offer || 0;
            const targetMoney = tradeData.targetMoneyOffer || tradeData.target_money_offer || 0;
            
            // Verificar recursos antes de proceder
            if (!this.validateTradeResources(user1, initiatorOffer, initiatorMoney) ||
                !this.validateTradeResources(user2, targetOffer, targetMoney)) {
                await this.cancelTradeInDb(tradeData.id, 'insufficient_resources');
                return false;
            }
            
            // Copiar inventarios
            const user1Items = JSON.parse(JSON.stringify(user1.items || {}));
            const user2Items = JSON.parse(JSON.stringify(user2.items || {}));
            
            // Transferir items del iniciador al objetivo
            for (const offer of initiatorOffer) {
                // Remover del iniciador
                if (user1Items[offer.id]) {
                    user1Items[offer.id].quantity -= offer.quantity;
                    if (user1Items[offer.id].quantity <= 0) {
                        delete user1Items[offer.id];
                    }
                }
                
                // Agregar al objetivo
                if (user2Items[offer.id]) {
                    user2Items[offer.id].quantity += offer.quantity;
                } else {
                    user2Items[offer.id] = { 
                        id: offer.id, 
                        quantity: offer.quantity, 
                        purchaseDate: new Date().toISOString() 
                    };
                }
            }
            
            // Transferir items del objetivo al iniciador
            for (const offer of targetOffer) {
                // Remover del objetivo
                if (user2Items[offer.id]) {
                    user2Items[offer.id].quantity -= offer.quantity;
                    if (user2Items[offer.id].quantity <= 0) {
                        delete user2Items[offer.id];
                    }
                }
                
                // Agregar al iniciador
                if (user1Items[offer.id]) {
                    user1Items[offer.id].quantity += offer.quantity;
                } else {
                    user1Items[offer.id] = { 
                        id: offer.id, 
                        quantity: offer.quantity, 
                        purchaseDate: new Date().toISOString() 
                    };
                }
            }
            
            // Calcular nuevos balances
            const newUser1Balance = user1.balance - initiatorMoney + targetMoney;
            const newUser2Balance = user2.balance - targetMoney + initiatorMoney;
            
            // Verificar que los balances no sean negativos
            if (newUser1Balance < 0 || newUser2Balance < 0) {
                console.error('Balance negativo detectado en trade');
                return false;
            }
            
            // Actualizar base de datos
            await this.shop.economy.updateUser(tradeData.initiator, { 
                items: user1Items, 
                balance: newUser1Balance 
            });
            await this.shop.economy.updateUser(tradeData.target, { 
                items: user2Items, 
                balance: newUser2Balance 
            });
            
            // Marcar trade como completado
            await this.completeTradeInDb(tradeData.id);
            
            console.log(`✅ Trade ${tradeData.id} completado exitosamente`);
            return true;
            
        } catch (error) {
            console.error('Error en completeTrade:', error);
            console.error('Stack trace:', error.stack);
            return false;
        }
    }
    
    async cancelTradeInDb(tradeId, reason = 'manual') {
        try {
            await this.db.updateTrade(tradeId, {
                status: 'cancelled',
                completed_at: new Date().toISOString()
            });
            
            // Remover del caché
            this.activeTradesCache.delete(tradeId);
            
            return true;
        } catch (error) {
            console.error('❌ Error cancelando trade:', error);
            return false;
        }
    }

    // Validar recursos para intercambio
    validateTradeResources(user, itemOffers, moneyOffer) {
        try {
            const userItems = user.items || {};
            const offers = Array.isArray(itemOffers) ? itemOffers : [];
            const money = moneyOffer || 0;
            
            // Verificar items
            for (const offer of offers) {
                if (!offer || !offer.id || !offer.quantity) continue;
                
                const userItem = userItems[offer.id];
                if (!userItem || userItem.quantity < offer.quantity) {
                    console.log(`❌ Usuario no tiene suficiente ${offer.id}:`, {
                        required: offer.quantity,
                        available: userItem?.quantity || 0
                    });
                    return false;
                }
            }
            
            // Verificar dinero
            if (user.balance < money) {
                console.log(`❌ Usuario no tiene suficiente dinero:`, {
                    required: money,
                    available: user.balance
                });
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('Error validando recursos:', error);
            return false;
        }
    }
    
    // En TradeSystem.js, reemplazar updateTradeEmbed:
    async updateTradeEmbed(channel, tradeData) {
        try {
            const initiator = await channel.client.users.fetch(tradeData.initiator);
            const target = await channel.client.users.fetch(tradeData.target);
            
            // Asegurar que los datos estén en formato correcto
            const initiatorOffer = tradeData.initiatorOffer || tradeData.initiator_offer || [];
            const targetOffer = tradeData.targetOffer || tradeData.target_offer || [];
            const initiatorMoney = tradeData.initiatorMoneyOffer || tradeData.initiator_money_offer || 0;
            const targetMoney = tradeData.targetMoneyOffer || tradeData.target_money_offer || 0;
            const initiatorAccepted = tradeData.initiatorAccepted || tradeData.initiator_accepted || false;
            const targetAccepted = tradeData.targetAccepted || tradeData.target_accepted || false;
            
            const embed = new EmbedBuilder()
                .setTitle('🔄 Intercambio en Progreso')
                .setDescription(`${initiator} ↔️ ${target}`)
                .addFields(
                    { 
                        name: `📦 Oferta de ${initiator.displayName} ${initiatorAccepted ? '✅' : '⏳'}`, 
                        value: this.formatOffer(initiatorOffer, initiatorMoney), 
                        inline: true 
                    },
                    { 
                        name: `📦 Oferta de ${target.displayName} ${targetAccepted ? '✅' : '⏳'}`, 
                        value: this.formatOffer(targetOffer, targetMoney), 
                        inline: true 
                    }
                )
                .setColor('#FFA500')
                .setFooter({ text: 'Ambos usuarios deben aceptar para completar el intercambio' });

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`trade_accept_${tradeData.id}`)
                        .setLabel('✅ Aceptar')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`trade_cancel_${tradeData.id}`)
                        .setLabel('❌ Cancelar')
                        .setStyle(ButtonStyle.Danger)
                );
                        
            // Enviar nuevo embed
            await channel.send({ 
                embeds: [embed],
                components: [buttons]
            });
        } catch (error) {
            console.error('Error actualizando embed de trade:', error);
        }
    }
    
    // En TradeSystem.js, reemplazar la función formatOffer completamente:
    formatOffer(itemOffers, moneyOffer) {
        let text = '';
        
        // Asegurar que itemOffers sea un array válido
        const offers = Array.isArray(itemOffers) ? itemOffers : [];
        const money = moneyOffer || 0;
        
        if (offers.length === 0 && money === 0) {
            return 'Nada';
        }
        
        if (offers.length > 0) {
            text += offers.map(offer => {
                const item = this.shop.shopItems[offer.id];
                const itemName = item ? item.name : offer.id;
                return `${itemName} x${offer.quantity}`;
            }).join('\n');
        }
        
        if (money > 0) {
            if (text) text += '\n';
            text += `💰 ${money.toLocaleString('es-ES')} π-b$`;
        }
        
        return text || 'Nada';
    }
}

module.exports = TradeSystem;
