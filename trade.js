// 3. SISTEMA DE INTERCAMBIO COMPLETO - Crear archivo TradeSystem.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

class TradeSystem {
    constructor(shopSystem) {
        this.shop = shopSystem;
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
        this.tradeTimeout = 300000; // 5 minutos timeout
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
                const embed = new EmbedBuilder()
                    .setTitle('🔄 Sistema de Intercambio - Guía')
                    .setDescription('Aprende a intercambiar items y dinero con otros usuarios')
                    .addFields(
                        {
                            name: '📝 Comandos Básicos',
                            value: '`>trade @usuario` - Iniciar intercambio\n`>tradeadd <item_id> [cantidad]` - Agregar item\n`>trademoney <cantidad>` - Agregar dinero\n`>tradeaccept` - Aceptar intercambio\n`>tradecancel` - Cancelar intercambio',
                            inline: false
                        },
                        {
                            name: '⚠️ Reglas Importantes',
                            value: '• Ambos usuarios deben ofrecer algo\n• Solo 5 minutos para completar\n• No puedes tener múltiples trades activos\n• Una vez aceptado por ambos, es irreversible',
                            inline: false
                        },
                        {
                            name: '🔄 Proceso paso a paso',
                            value: '1️⃣ Inicia el trade con `>trade @usuario`\n2️⃣ Ambos agregan items/dinero\n3️⃣ Ambos aceptan con `>tradeaccept`\n4️⃣ ¡Intercambio completado!',
                            inline: false
                        },
                        {
                            name: '💡 Ejemplos',
                            value: '`>trade @Juan123`\n`>tradeadd lucky_charm 2`\n`>trademoney 5000`\n`>tradeaccept`',
                            inline: false
                        }
                    )
                    .setColor('#00FF00')
                    .setFooter({ text: 'Los trades expiran en 5 minutos automáticamente' })
                    .setTimestamp();
                
                await message.reply({ embeds: [embed] });
                return { success: false };
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
            
            const { error } = await this.supabase
                .from('trades')
                .update({ status: 'expired' })
                .eq('status', 'pending')
                .lt('created_at', fiveMinutesAgo.toISOString());
                
            if (error) console.error('Error limpiando trades:', error);
        } catch (error) {
            console.error('Error en cleanup:', error);
        }
    }

    async saveTradeToDb(tradeData) {
        const { data, error } = await this.supabase
            .from('trades')
            .insert({
                id: tradeData.id,
                initiator: tradeData.initiator,
                target: tradeData.target,
                initiator_offer: tradeData.initiatorOffer,
                target_offer: tradeData.targetOffer,
                initiator_money_offer: tradeData.initiatorMoneyOffer,
                target_money_offer: tradeData.targetMoneyOffer,
                channel_id: tradeData.channel,
                status: tradeData.status,
                expires_at: new Date(Date.now() + this.tradeTimeout).toISOString()
            });
        
        if (error) console.error('Error guardando trade:', error);
        return !error;
    }

    async updateTradeInDb(tradeData) {
        const { error } = await this.supabase
            .from('trades')
            .update({
                initiator_offer: tradeData.initiatorOffer,
                target_offer: tradeData.targetOffer,
                initiator_money_offer: tradeData.initiatorMoneyOffer,
                target_money_offer: tradeData.targetMoneyOffer,
                initiator_accepted: tradeData.initiatorAccepted,
                target_accepted: tradeData.targetAccepted,
                status: tradeData.status
            })
            .eq('id', tradeData.id);
        
        return !error;
    }

    async getActiveTradeByUser(userId) {
        const { data } = await this.supabase
            .from('trades')
            .select('*')
            .or(`initiator.eq.${userId},target.eq.${userId}`)
            .eq('status', 'pending')
            .single();
        
        return data;
    }

    async completeTradeInDb(tradeId) {
        const { error } = await this.supabase
            .from('trades')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', tradeId);
        
        return !error;
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
                const { data: stillActive } = await this.supabase
                    .from('trades')
                    .select('status')
                    .eq('id', tradeId)
                    .single();
                
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
        
        // Reset acceptance
        tradeData.initiatorAccepted = false;
        tradeData.targetAccepted = false;
        
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
        } else {
            tradeData.targetMoneyOffer += amount;
        }
        
        // Reset acceptance
        tradeData.initiatorAccepted = false;
        tradeData.targetAccepted = false;

        tradeData.initiatorOffer = tradeData.initiator_offer || [];
        tradeData.targetOffer = tradeData.target_offer || [];
        tradeData.initiatorMoneyOffer = tradeData.initiator_money_offer || 0;
        tradeData.targetMoneyOffer = tradeData.target_money_offer || 0;
        
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
        try {
            const user1 = await this.shop.economy.getUser(tradeData.initiator);
            const user2 = await this.shop.economy.getUser(tradeData.target);
            
            // Verificar que ambos usuarios tengan los items/dinero prometidos
            if (!this.validateTradeResources(user1, tradeData.initiatorOffer, tradeData.initiatorMoneyOffer) ||
                !this.validateTradeResources(user2, tradeData.targetOffer, tradeData.targetMoneyOffer)) {
                await this.cancelTrade(tradeData, 'insufficient_resources');
                return false;
            }
            
            // Realizar el intercambio
            const user1Items = { ...user1.items };
            const user2Items = { ...user2.items };
            
            // Transferir items del iniciador al objetivo
            for (const offer of tradeData.initiatorOffer) {
                user1Items[offer.id].quantity -= offer.quantity;
                if (user1Items[offer.id].quantity <= 0) delete user1Items[offer.id];
                
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
            for (const offer of tradeData.targetOffer) {
                user2Items[offer.id].quantity -= offer.quantity;
                if (user2Items[offer.id].quantity <= 0) delete user2Items[offer.id];
                
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
            
            // Transferir dinero
            const newUser1Balance = user1.balance - tradeData.initiatorMoneyOffer + tradeData.targetMoneyOffer;
            const newUser2Balance = user2.balance - tradeData.targetMoneyOffer + tradeData.initiatorMoneyOffer;
            
            // Actualizar base de datos
            await this.shop.economy.updateUser(tradeData.initiator, { 
                items: user1Items, 
                balance: newUser1Balance 
            });
            await this.shop.economy.updateUser(tradeData.target, { 
                items: user2Items, 
                balance: newUser2Balance 
            });
            
            // Limpiar intercambio
            this.activeTrades.delete(tradeData.initiator);
            this.activeTrades.delete(tradeData.target);
            
            return true;
        } catch (error) {
            console.error('Error completando intercambio:', error);
            return false;
        }

        await this.completeTradeInDb(tradeData.id);
    }
    
    async cancelTradeInDb(tradeId, reason = 'manual') {
        const { error } = await this.supabase
            .from('trades')
            .update({
                status: 'cancelled',
                completed_at: new Date().toISOString()
            })
            .eq('id', tradeId);
        
        return !error;
    }

    // Validar recursos para intercambio
    validateTradeResources(user, itemOffers, moneyOffer) {
        const userItems = user.items || {};
        
        // Verificar items
        for (const offer of itemOffers) {
            if (!userItems[offer.id] || userItems[offer.id].quantity < offer.quantity) {
                return false;
            }
        }
        
        // Verificar dinero
        if (user.balance < moneyOffer) {
            return false;
        }
        
        return true;
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
            
            // Enviar nuevo embed
            await channel.send({ embeds: [embed] });
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
