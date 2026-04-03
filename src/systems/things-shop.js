const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 3. Sistema de subastas
class AuctionSystem {
    constructor(shopSystem) {
        this.shop = shopSystem;
        this.pendingConfirmations = new Map();
        this.activeAuctions = new Map(); // Caché en memoria

        // AGREGAR al final del constructor para limpiar subastas vencidas cada 5 minutos:
        setInterval(async () => {
            try {
                const [rows] = await this.shop.economy.database.pool.execute(
                    "SELECT id FROM auctions WHERE active = 1 AND ends_at < NOW()"
                );
                
                for (const row of rows) {
                    console.log(`🔨 Limpiando subasta vencida: ${row.id}`);
                    await this.endAuction(row.id);
                }
            } catch (error) {
                console.error('Error limpiando subastas vencidas:', error);
            }
        }, 5 * 60 * 1000); // Cada 5 minutos
    }

calculateMinimumIncrement(currentBid) {
    return Math.floor(currentBid * 0.05); // 5% o mínimo 10 coins
}

    async saveAuctionToDb(auction) {
        try {
            await this.shop.economy.database.createAuction({
                id: auction.id,
                seller: auction.seller,
                item_id: auction.itemId,
                item_name: auction.itemName,
                starting_bid: auction.currentBid,
                current_bid: auction.currentBid,
                highest_bidder: auction.highestBidder,
                bids: auction.bids,
                ends_at: new Date(auction.endsAt).toISOString(),
                channel_id: auction.channelId
            });
            return true;
        } catch (error) {
            console.error('Error guardando subasta:', error);
            return false;
        }
    }

    async updateBidInDb(auctionId, auction) {
        try {
            await this.shop.economy.database.updateAuction(auctionId, {
                current_bid: auction.currentBid,
                highest_bidder: auction.highestBidder,
                bids: auction.bids
            });
            return true;
        } catch (error) {
            console.error('Error actualizando puja:', error);
            return false;
        }
    }

    async getAuctionFromDb(auctionId) {
        try {
            const auction = await this.shop.economy.database.getAuction(auctionId);
            if (auction && auction.active) {
                return auction;
            }
            return null;
        } catch (error) {
            console.error('Error obteniendo subasta:', error);
            return null;
        }
    }

    generateAuctionId(itemId) {
        const itemShort = itemId
            .split('_')
            .map(w => w[0])
            .join('')
            .toUpperCase(); // rainbow_badge → RB

        const randomPart = Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase(); // 6 chars

        return `AUC-${itemShort}-${randomPart}`;
    }
    
    async createAuction(message, itemId, startingBid, duration = 3600000) { // 1 hora por defecto
        const userId = message.author.id;
        const user = await this.shop.economy.getUser(userId);
        const userItems = user.items || {};
        
        // ✅ Verificar que el item existe en el inventario
        if (!userItems[itemId] || userItems[itemId].quantity < 1) {
            await message.reply(`❌ No tienes el item **"${itemId}"** para subastar.`);
            return;
        }
        
        const item = this.shop.shopItems[itemId];
        if (!item) {
            await message.reply('❌ Item no válido.');
            return;
        }

        // ✅ NUEVO: Verificar precio mínimo (50% del valor original)
        const minimumPrice = Math.floor(item.price * 0.5);
        if (startingBid < minimumPrice) {
            await message.reply(`❌ El precio inicial debe ser al menos **${minimumPrice.toLocaleString('es-ES')} π-b$** (50% del valor original de **${item.name}**).`);
            return;
        }

        // ✅ NUEVO: Verificar items permanentes ya aplicados
        if (item.category === 'permanent') {
            const hasActiveEffect = await this.hasActivePermanentEffect(userId, itemId);
            if (hasActiveEffect) {
                await message.reply(`❌ No puedes subastar el item **"${item.name}"** porque ya tienes el efecto permanente activo. Solo se pueden subastar items permanentes sin usar.`);
                return;
            }
        }

        // ✅ NUEVO: Verificar si es cosmético equipado
        if (item.category === 'cosmetic') {
            const cosmetics = user.cosmetics || {};
            
            // Si cosmetics es string, parsearlo
            let cosmeticsObj = cosmetics;
            if (typeof cosmetics === 'string') {
                try {
                    cosmeticsObj = JSON.parse(cosmetics);
                } catch (error) {
                    cosmeticsObj = {};
                }
            }
            
            // Verificar si está equipado
            if (cosmeticsObj[itemId] && cosmeticsObj[itemId].equipped) {
                await message.reply(`❌ No puedes subastar **${item.name}** porque lo tienes equipado. Usa \`>useitem ${itemId}\` para desequiparlo primero.`);
                return;
            }
        }
        
        // ✅ NUEVO: Sistema de confirmación para items únicos/importantes
        const importantItems = ['money_magnet', 'work_boots', 'permanent_vault', 'auto_worker', 'luck_charm_permanent'];
        if (importantItems.includes(itemId) || (!item.stackable && item.rarity === 'legendary')) {
            
            // Si ya hay una confirmación pendiente, procesar
            const pendingConfirmation = this.pendingConfirmations.get(userId);
            if (pendingConfirmation && pendingConfirmation.itemId === itemId && pendingConfirmation.startingBid === startingBid) {
                // Limpiar confirmación y proceder
                this.pendingConfirmations.delete(userId);
            } else {
                // Solicitar confirmación
                this.pendingConfirmations.set(userId, {
                    itemId,
                    startingBid,
                    duration,
                    timestamp: Date.now()
                });
                
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ Confirmación Requerida')
                    .setDescription(`Estás a punto de subastar un item único/valioso:`)
                    .addFields(
                        { name: '📦 Item', value: `${this.shop.rarityEmojis[item.rarity]} **${item.name}**`, inline: true },
                        { name: '💰 Precio Inicial', value: `${startingBid.toLocaleString('es-ES')} π-b$`, inline: true },
                        { name: '💎 Valor Original', value: `${item.price.toLocaleString('es-ES')} π-b$`, inline: true },
                        { name: '⚠️ Advertencia', value: `Este es un item ${item.rarity} y ${!item.stackable ? 'único' : 'valioso'}. Una vez subastado, no podrás recuperarlo a menos que lo vuelvas a comprar.`, inline: false }
                    )
                    .setColor('#FF9900')
                    .setFooter({ text: 'Usa el mismo comando otra vez en los próximos 30 segundos para confirmar' });
                
                await message.reply({ embeds: [embed] });
                
                // Limpiar confirmación después de 30 segundos
                setTimeout(() => {
                    this.pendingConfirmations.delete(userId);
                }, 30000);
                
                return;
            }
        }
        
        const auctionId = this.generateAuctionId(itemId);
        const auction = {
            id: auctionId,
            seller: userId,
            itemId: itemId,
            itemName: item.name,
            currentBid: startingBid,
            highestBidder: null,
            endsAt: Date.now() + duration,
            bids: [],
            active: true,
            channelId: message.channel.id
        };
        
        const saved = await this.saveAuctionToDb(auction);
        if (!saved) {
            await message.reply('❌ Error creando la subasta.');
            return;
        }
        
        // Remover item del inventario temporalmente
        const newItems = { ...userItems };
        newItems[itemId].quantity -= 1;
        if (newItems[itemId].quantity <= 0) delete newItems[itemId];
        await this.shop.economy.updateUser(userId, { items: newItems });
        
        const embed = new EmbedBuilder()
            .setTitle('🔨 Nueva Subasta')
            .setDescription(`${message.author.displayName} está subastando:`)
            .addFields(
                { name: '📦 Item', value: `${this.shop.rarityEmojis[item.rarity]} **${item.name}**`, inline: true },
                { name: '💰 Puja Inicial', value: `${startingBid.toLocaleString('es-ES')} π-b$`, inline: true },
                { name: '📈 Incremento Mínimo', value: `${Math.floor(startingBid * 0.05).toLocaleString('es-ES')} π-b$`, inline: true },
                { name: '⏰ Termina en', value: `${Math.floor(duration / 60000)} minutos`, inline: true }
            )
            .setColor('#FF6600')
            .setFooter({ text: `🔨 ¡Nueva subasta! Copia el texto de este mensaje y usa \`>bid ${auctionId} <cantidad>\` para pujar.` });
        
        await message.reply({ 
            content: `${auctionId}`,
            embeds: [embed] 
        });
       
        if (this.shop.economy.achievements) {
            await this.shop.economy.achievements.updateStats(message.author.id, 'auctions_created');
        
            try {
                const newAchievements = await this.shop.economy.achievements.checkAchievements(message.author.id);
                if (newAchievements.length > 0) {
                    await this.shop.economy.achievements.notifyAchievements(message, newAchievements);
                }
            } catch (error) {
                console.error('❌ Error verificando logros después de crear subasta:', error);
            }
        }
    
        if (this.shop.economy.missions) {
            const auctionslol = await this.shop.economy.missions.updateMissionProgress(message.author.id, 'auctions_created_today', 1);
            
            const allCompleted = [...auctionslol];
            if (allCompleted.length > 0) {
                await this.shop.economy.missions.notifyCompletedMissions(message, allCompleted);
            }
        }
        
        // Programar fin de subasta
        setTimeout(() => this.endAuction(auctionId, message.client), duration);
    }

    async hasActivePermanentEffect(userId, itemId) {
        const user = await this.shop.economy.getUser(userId);
        const permanentEffects = user.permanentEffects || {};
        
        // Verificar si el usuario ya tiene el efecto permanente de este item
        return permanentEffects.hasOwnProperty(itemId);
    }
    
    async isItemEquipped(userId, itemId) {
        const user = await this.shop.economy.getUser(userId);
        const cosmetics = user.cosmetics || {};
        
        let cosmeticsObj = cosmetics;
        if (typeof cosmetics === 'string') {
            try {
                cosmeticsObj = JSON.parse(cosmetics);
            } catch (error) {
                return false;
            }
        }
        
        return cosmeticsObj[itemId] && cosmeticsObj[itemId].equipped;
    }

    async placeBid(message, auctionId, bidAmount) {
        const auction = await this.getAuctionFromDb(auctionId);
        if (!auction || !auction.active) {
            await message.reply('❌ Subasta no encontrada o ya terminada.');
            return;
        }

        auction.currentBid = auction.current_bid;
        auction.highestBidder = auction.highest_bidder;
        auction.itemId = auction.item_id;
        auction.itemName = auction.item_name;
        
        const userId = message.author.id;
        if (userId === auction.seller) {
            await message.reply('❌ No puedes pujar en tu propia subasta.');
            return;
        }
        
        const minimumIncrement = Math.floor(auction.currentBid * 0.05); // 5% o mínimo 10 coins
if (bidAmount < auction.currentBid + minimumIncrement) {
    await message.reply(`❌ Tu puja debe ser al menos **${(auction.currentBid + minimumIncrement).toLocaleString('es-ES')} π-b$** (incremento mínimo: ${minimumIncrement.toLocaleString('es-ES')} π-b$).`);
    return;
}
        
        const user = await this.shop.economy.getUser(userId);
        if (user.balance < bidAmount) {
            await message.reply(`❌ No tienes suficiente dinero. Necesitas **${bidAmount.toLocaleString('es-ES')} π-b$**.`);
            return;
        }
        
        // Devolver dinero al pujador anterior
        if (auction.highestBidder) {
            const previousBidder = await this.shop.economy.getUser(auction.highestBidder);
            await this.shop.economy.updateUser(auction.highestBidder, {
                balance: previousBidder.balance + auction.currentBid
            });
        }
        
        // Reservar dinero del nuevo pujador
        await this.shop.economy.updateUser(userId, {
            balance: user.balance - bidAmount
        });
        
        // Actualizar subasta
        auction.currentBid = bidAmount;
        auction.highestBidder = userId;
        auction.bids.push({
            bidder: userId,
            amount: bidAmount,
            timestamp: Date.now()
        });
        
        await message.reply(`✅ Puja de **${bidAmount.toLocaleString('es-ES')} π-b$** registrada por ${message.author.displayName}!`);
        await this.updateBidInDb(auctionId, auction);
    }
    
    async endAuction(auctionId, client = null) {
        const auctionData = await this.getAuctionFromDb(auctionId);
        if (!auctionData || !auctionData.active) return;

        const auction = {
            ...auctionData,
            currentBid: auctionData.current_bid,
            highestBidder: auctionData.highest_bidder,
            itemId: auctionData.item_id,
            itemName: auctionData.item_name,
            seller: auctionData.seller,
            channelId: auctionData.channel_id
        };
        
        auction.active = false;
        
        if (auction.highestBidder) {
            // Transferir item al ganador
            const winner = await this.shop.economy.getUser(auction.highestBidder);
            const winnerItems = winner.items || {};
            
            if (winnerItems[auction.itemId]) {
                winnerItems[auction.itemId].quantity += 1;
            } else {
                winnerItems[auction.itemId] = {
                    id: auction.itemId,
                    quantity: 1,
                    purchaseDate: new Date().toISOString()
                };
            }
            
            await this.shop.economy.updateUser(auction.highestBidder, { items: winnerItems });
            
            // Dar dinero al vendedor
            const seller = await this.shop.economy.getUser(auction.seller);
            await this.shop.economy.updateUser(auction.seller, {
                balance: seller.balance + auction.currentBid
            });

            if (this.shop.economy.achievements) {
                await this.shop.economy.achievements.updateStats(auction.highestBidder, 'auctions_won');
            
                try {
                    const newAchievements = await this.shop.economy.achievements.checkAchievements(auction.highestBidder);
                    if (newAchievements.length > 0) {
                        await this.shop.economy.achievements.notifyAchievements(message, newAchievements);
                    }
                } catch (error) {
                    console.error('❌ Error verificando logros después de crear subasta:', error);
                }
            }

            if (this.shop.economy.missions) {
                const auctionslol = await this.shop.economy.missions.updateMissionProgress(auction.highestBidder, 'auctions_won_today', 1);
                
                const allCompleted = [...auctionslol];
                if (allCompleted.length > 0) {
                    await this.shop.economy.missions.notifyCompletedMissions(message, allCompleted);
                }
            }

            console.log(`🔨 Subasta ${auctionId} terminada. Ganador: ${auction.highestBidder}`);
        } else {
            // No hubo pujas, devolver item al vendedor
            const seller = await this.shop.economy.getUser(auction.seller);
            const sellerItems = seller.items || {};
            
            if (sellerItems[auction.itemId]) {
                sellerItems[auction.itemId].quantity += 1;
            } else {
                sellerItems[auction.itemId] = {
                    id: auction.itemId,
                    quantity: 1,
                    purchaseDate: new Date().toISOString()
                };
            }
            
            await this.shop.economy.updateUser(auction.seller, { items: sellerItems });

            console.log(`🔨 Subasta ${auctionId} terminada sin pujas.`);
        }
    
        if (client && auction.channelId) {
            try {
                const channel = client.channels.cache.get(auction.channelId);
                const itemData = this.shop.shopItems[auction.itemId];
                const realItemName = itemData ? itemData.name : auction.itemName;
                
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🔨 Subasta Terminada')
                        .setDescription(`Subasta de **${realItemName}** ha finalizado`)
                        .setColor(auction.highestBidder ? '#00FF00' : '#FF6600')
                        .setTimestamp();
                    
                    if (auction.highestBidder) {
                        embed.addFields(
                            { name: '🏆 Ganador', value: `<@${auction.highestBidder}>`, inline: true },
                            { name: '💰 Precio Final', value: `${auction.currentBid.toLocaleString('es-ES')} π-b$`, inline: true }
                        );
                    } else {
                        embed.addFields(
                            { name: '❌ Sin Pujas', value: 'El item fue devuelto al vendedor', inline: false }
                        );
                    }
                    
                    await channel.send({ embeds: [embed] });
                    console.log(`🔨 Embed enviado para subasta ${auctionId}`);
                }
            } catch (error) {
                console.error('Error enviando embed de subasta:', error);
            }
        } else {
            console.log(`ℹ️ Subasta ${auctionId} terminada sin notificación (client: ${!!client}, channelId: ${auction.channelId})`);
        }

        await this.completeAuctionInDb(auctionId);
    }

    // 4. Agregar función para completar subasta:
    async completeAuctionInDb(auctionId) {
        try {
            await this.shop.economy.database.updateAuction(auctionId, {
                active: false
            });
            return true;
        } catch (error) {
            console.error('Error completando subasta:', error);
            return false;
        }
    }

    // AGREGAR después de getActiveAuctions():
    async loadActiveAuctions(client) {
        try {
            const data = await this.shop.economy.database.getActiveAuctions();

            for (let auctionData of data) {
                const auction = {
                    id: auctionData.id,
                    seller: auctionData.seller,
                    itemId: auctionData.item_id,
                    itemName: auctionData.item_name,
                    currentBid: auctionData.current_bid,
                    highestBidder: auctionData.highest_bidder,
                    endsAt: new Date(auctionData.ends_at).getTime(),
                    bids: this.shop.economy.database.safeJsonParse(auctionData.bids, []),
                    active: auctionData.active,
                    channelId: auctionData.channel_id
                };

                // Verificar si la subasta ya debería haber terminado
                const now = Date.now();
                const timeLeft = auction.endsAt - now;

                if (timeLeft <= 0) {
                    // La subasta ya debería haber terminado, terminarla ahora
                    console.log(`🔨 Terminando subasta vencida: ${auction.id}`);
                    await this.endAuction(auction.id, client);
                } else {
                    // Reanudar el timer
                    console.log(`🔨 Reanudando subasta: ${auction.id} (${Math.floor(timeLeft / 60000)}m restantes)`);
                    setTimeout(() => this.endAuction(auction.id, client), timeLeft);
                    
                    // Guardar en caché si lo usas
                    this.activeAuctions.set(auction.id, auction);
                }
            }

            console.log(`🔨 Cargadas ${data.length} subastas activas`);
        } catch (error) {
            console.error('❌ Error cargando subastas activas:', error);
        }
    }
}

// 4. Sistema de crafteo
class CraftingSystem {
    constructor(shopSystem, client) {
        setInterval(() => this.checkCompletedCrafts(), 60000);
        this.shop = shopSystem;
        this.client = client;

        this.CRAFTING_RECIPES = {
            'super_lucky_charm': {
                id: 'super_lucky_charm',
                name: '🍀✨ Super Amuleto de Suerte',
                description: 'Versión mejorada del amuleto normal (x2.0 multiplicador, 3 horas)',
                craftTime: 3600000, // 1 hora
                ingredients: [
                    { id: 'lucky_charm', quantity: 5 },
                    { id: 'double_xp_potion', quantity: 2 }
                ],
                result: {
                    id: 'super_lucky_charm',
                    category: 'consumable',
                    rarity: 'epic',
                    effect: {
                        type: 'multiplier',
                        targets: ['work', 'games'],
                        multiplier: 1.5,
                        duration: 10800 // 3 horas
                    },
                    stackable: true,
                    maxStack: 2
                }
            },

            'master_toolkit': {
                id: 'master_toolkit',
                name: '🔧⚡ Kit Maestro',
                description: 'Reduce todos los cooldowns permanentemente en 20%',
                craftTime: 21600000, // 6 horas
                ingredients: [
                    { id: 'work_boots', quantity: 1 },
                    { id: 'energy_drink', quantity: 10 },
                    { id: 'robbery_kit', quantity: 5 },
                    { id: 'golden_pickaxe', quantity: 1 },
                    { id: 'permanent_vault', quantity: 1}
                ],
                result: {
                    id: 'master_toolkit',
                    category: 'permanent',
                    rarity: 'legendary',
                    effect: {
                        type: 'permanent_cooldown',
                        targets: ['all'],
                        reduction: 0.2
                    },
                    stackable: false,
                    maxStack: 1
                }
            },

            'trivia_kit_craft': {
                id: 'trivia_kit_craft',
                name: '🧠 Kit de Trivia',
                description: 'Combina ayudas de trivia en un kit completo: tiempo extra + salto + ayuda del público',
                craftTime: 1800000, // 30 minutos
                ingredients: [
                    { id: 'trivia_time_boost', quantity: 2 },
                    { id: 'trivia_skip_token', quantity: 1 },
                    { id: 'trivia_audience', quantity: 1 }
                ],
                result: {
                    id: 'trivia_kit',
                    category: 'consumable',
                    rarity: 'epic',
                    effect: {
                        type: 'trivia_boost',
                        subtype: 'kit',
                        includes: ['extra_time', 'skip_question', 'eliminate_wrong', 'wrong_shield'],
                        uses: 1
                    },
                    stackable: true,
                    maxStack: 2
                }
            },

            'trivia_master_pass': {
                id: 'trivia_master_pass',
                name: '👑 Pase Maestro de Trivia',
                description: 'El item definitivo de trivia: doble recompensa + escudo + ayuda del público para 3 partidas',
                craftTime: 7200000, // 2 horas
                ingredients: [
                    { id: 'trivia_double_reward', quantity: 2 },
                    { id: 'trivia_shield', quantity: 2 },
                    { id: 'trivia_kit', quantity: 1 }
                ],
                result: {
                    id: 'trivia_master_pass',
                    category: 'consumable',
                    rarity: 'legendary',
                    effect: {
                        type: 'trivia_boost',
                        subtype: 'master_pass',
                        includes: ['double_reward', 'wrong_shield', 'eliminate_wrong'],
                        uses: 3
                    },
                    stackable: false,
                    maxStack: 1
                }
            },

            'mega_luck_craft': {
                id: 'mega_luck_craft',
                name: '🍀✨ Mega Poción de Suerte',
                description: 'Una potente mezcla de suerte concentrada que aumenta la probabilidad de ganar en juegos +25% por 1h 30m',
                craftTime: 3600000, // 1 hora
                ingredients: [
                    { id: 'lucky_charm', quantity: 4 },
                    { id: 'energy_drink', quantity: 3 }
                ],
                result: {
                    id: 'mega_luck_potion',
                    category: 'consumable', 
                    rarity: 'epic',
                    effect: {
                        type: 'luck_boost',
                        targets: ['games', 'all'],
                        boost: 0.25,
                        duration: 5400 // 1h 30m
                    },
                    stackable: true,
                    maxStack: 5
                }
            },

            'nickname_token_craft': {
                id: 'nickname_token_craft',
                name: '🏷️✨ Token de Apodo', // Nombre más claro
                description: 'Permite personalizar tu apodo con estilo. Usa >setnickname <nuevo_apodo>',
                craftTime: 1800000, // 30 minutos
                //guildExclusive: '1270508373732884522',
                ingredients: [
                    { id: 'rainbow_badge', quantity: 2 },
                    { id: 'golden_trophy', quantity: 2 },
                    { id: 'custom_nickname_token', quantity: 1 } // ← NUEVO ingrediente
                ],
                result: {
                    id: 'nickname_token', // ← Cambié el ID para que sea más claro
                    category: 'special',
                    rarity: 'epic', // Subí la rareza ya que requiere más materiales
                    effect: {
                        type: 'nickname_change',
                        uses: 1
                    },
                    stackable: true,
                    maxStack: 3 // Reduje el stack ya que es más valioso
                }
            },

            // 🔮 Amuleto Cósmico (más fuerte que el super lucky charm)
            'cosmic_charm_craft': {
                id: 'cosmic_charm_craft',
                name: '🔮✨ Amuleto Cósmico',
                description: 'Un amuleto místico con poderes cósmicos (x3.0 multiplicador, 2 horas)',
                craftTime: 10800000, // 3 horas
                ingredients: [
                    { id: 'super_lucky_charm', quantity: 1 },
                    { id: 'xp_tornado', quantity: 1 }
                ],
                result: {
                    id: 'cosmic_charm',
                    category: 'consumable',
                    rarity: 'legendary',
                    effect: {
                        type: 'multiplier',
                        targets: ['work', 'games'],
                        multiplier: 2.0,
                        duration: 5400 // 1.5 horas
                    },
                    stackable: true,
                    maxStack: 2
                }
            },

            // 🏆 Cofre Épico
            'epic_chest_craft': {
                id: 'epic_chest_craft',
                name: '📦🏆 Cofre Épico',
                description: 'Un cofre misterioso que contiene recompensas raras',
                craftTime: 3600000, // 1 hora
                ingredients: [
                    { id: 'premium_mystery_box', quantity: 2 },
                    { id: 'golden_trophy', quantity: 1 }
                ],
                result: {
                    id: 'epic_chest',
                    category: 'special',
                    rarity: 'epic',
                    effect: {
                        type: 'open_chest',
                        rewards: [
                            { id: 'lucky_charm', chance: 0.4 },
                            { id: 'double_xp_potion', chance: 0.3 },
                            { id: 'money_magnet', chance: 0.2 },
                            { id: 'golden_pickaxe', chance: 0.1 }
                        ]
                    },
                    stackable: true,
                    maxStack: 5
                }
            },

            // 💀 Guantes del Ladrón Maestro
            'master_gloves_craft': {
                id: 'master_gloves_craft',
                name: '💀🧤 Guantes del Ladrón Maestro',
                description: 'Salta la 1era fase del robo (5 usos)',
                craftTime: 3600000, // 1 hora
                ingredients: [
                    { id: 'robbery_kit', quantity: 5 },
                    { id: 'energy_drink', quantity: 2 }
                ],
                result: {
                    id: 'master_gloves',
                    category: 'consumable',
                    rarity: 'epic',
                    effect: {
                        type: 'robbery_boost',
                        successRate: 0.5,
                        uses: 5,
                        skipClicks: true
                    },
                    stackable: true,
                    maxStack: 2
                }
            },

            // 🍀 Lucky Charm → Super Lucky Charm → Cosmic Charm → Infinity Charm
            'infinity_charm_craft': {
                id: 'infinity_charm_craft',
                name: '♾️🍀 Amuleto Infinito',
                description: 'El amuleto definitivo. (x5.0 multiplicador, 3 horas)',
                craftTime: 43200000, // 12 horas 
                ingredients: [
                    { id: 'cosmic_charm', quantity: 1 },
                    { id: 'xp_tornado', quantity: 2 },
                    { id: 'super_lucky_charm', quantity: 2}
                ],
                result: {
                    id: 'infinity_charm',
                    category: 'consumable',
                    rarity: 'mythic',
                    effect: {
                        type: 'multiplier',
                        targets: ['work', 'games'],
                        multiplier: 3.0,
                        duration: 7200 // 2 horas
                    },
                    stackable: true,
                    maxStack: 1
                }
            },

            // ⚒️ Golden Pickaxe → Diamond Pickaxe → Eternal Pickaxe
            'diamond_pickaxe_craft': {
                id: 'diamond_pickaxe_craft',
                name: '💎⛏️ Pico de Diamante',
                description: 'Un pico mejorado para minería (+50% drops)',
                craftTime: 3600000, // 1 hora
                ingredients: [
                    { id: 'golden_pickaxe', quantity: 1 },
                    { id: 'money_magnet', quantity: 1 }
                ],
                result: {
                    id: 'diamond_pickaxe',
                    category: 'tool',
                    rarity: 'epic',
                    effect: {
                        type: 'mining_boost',
                        multiplier: 1.5,
                        durability: 200
                    },
                    stackable: false
                }
            },

            'eternal_pickaxe_craft': {
                id: 'eternal_pickaxe_craft',
                name: '♾️⛏️ Pico Eterno',
                description: 'El pico definitivo, nunca se rompe',
                craftTime: 21600000, // 6 horas
                ingredients: [
                    { id: 'diamond_pickaxe', quantity: 1 },
                    { id: 'super_lucky_charm', quantity: 2 },
                    { id: 'money_magnet', quantity: 1 }
                ],
                result: {
                    id: 'eternal_pickaxe',
                    category: 'tool',
                    rarity: 'legendary',
                    effect: {
                        type: 'mining_boost',
                        multiplier: 2.0,
                        durability: Infinity
                    },
                    stackable: false
                }
            },

            // ===== 🧪 POCIONES =====
            'fire_potion_craft': {
                id: 'fire_potion_craft',
                name: '🔥 Poción de Fuego',
                description: '+25% trabajo por 2h',
                craftTime: 1800000,
                category: 'potion',
                ingredients: [
                    { id: 'fire_ember', quantity: 3 },
                    { id: 'herb_common', quantity: 2 },
                ],
                result: { id: 'fire_potion', category: 'consumable', rarity: 'uncommon', stackable: true, maxStack: 10 }
            },

            'moon_potion_craft': {
                id: 'moon_potion_craft',
                name: '🌙 Poción Lunar',
                description: '+20% minijuegos por 3h',
                craftTime: 3600000,
                category: 'potion',
                ingredients: [
                    { id: 'moon_essence', quantity: 2 },
                    { id: 'crystal_shard', quantity: 1 },
                ],
                result: { id: 'moon_potion', category: 'consumable', rarity: 'rare', stackable: true, maxStack: 5 }
            },

            'shadow_elixir_craft': {
                id: 'shadow_elixir_craft',
                name: '🕸️ Elixir de Sombra',
                description: '-50% cooldown robo por 1h',
                craftTime: 2700000,
                category: 'potion',
                ingredients: [
                    { id: 'shadow_fiber', quantity: 3 },
                    { id: 'robbery_kit', quantity: 2 },
                ],
                result: { id: 'shadow_elixir', category: 'consumable', rarity: 'rare', stackable: true, maxStack: 5 }
            },

            'crystal_vision_craft': {
                id: 'crystal_vision_craft',
                name: '💎 Visión Cristalina',
                description: '+15% suerte en minijuegos por 2h',
                craftTime: 3600000,
                category: 'potion',
                ingredients: [
                    { id: 'crystal_shard', quantity: 4 },
                    { id: 'double_xp_potion', quantity: 1 },
                ],
                result: { id: 'crystal_vision', category: 'consumable', rarity: 'rare', stackable: true, maxStack: 5 }
            },

/*            // ===== ⚔️ COMBATE =====
            'battle_tonic_craft': {
                id: 'battle_tonic_craft',
                name: '⚔️ Tónico de Batalla',
                description: '+30% ATK en batallas',
                craftTime: 1800000,
                category: 'combat',
                ingredients: [
                    { id: 'fire_ember', quantity: 2 },
                    { id: 'herb_epic', quantity: 1 },
                ],
                result: { id: 'battle_tonic', category: 'consumable', rarity: 'rare', stackable: true, maxStack: 5 }
            },

            'iron_shield_brew_craft': {
                id: 'iron_shield_brew_craft',
                name: '🛡️ Brebaje Escudo',
                description: '+30% DEF en batallas',
                craftTime: 1800000,
                category: 'combat',
                ingredients: [
                    { id: 'refined_metal', quantity: 3 },
                    { id: 'herb_rare', quantity: 2 },
                ],
                result: { id: 'iron_shield_brew', category: 'consumable', rarity: 'rare', stackable: true, maxStack: 5 }
            },

            'dragon_brew_craft': {
                id: 'dragon_brew_craft',
                name: '🐉 Brebaje del Dragón',
                description: '+50% ATK y DEF en batallas por 1h',
                craftTime: 7200000,
                category: 'combat',
                ingredients: [
                    { id: 'dragon_scale', quantity: 1 },
                    { id: 'fire_ember', quantity: 3 },
                    { id: 'refined_metal', quantity: 2 },
                ],
                result: { id: 'dragon_brew', category: 'consumable', rarity: 'epic', stackable: true, maxStack: 3 }
            },*/

            // ===== 🌿 NATURALEZA =====
            'nature_boost_craft': {
                id: 'nature_boost_craft',
                name: '🌿 Impulso Natural',
                description: '+20% a todo por 1h',
                craftTime: 3600000,
                category: 'nature',
                ingredients: [
                    { id: 'herb_common', quantity: 5 },
                    { id: 'herb_rare', quantity: 3 },
                    { id: 'moon_essence', quantity: 1 },
                ],
                result: { id: 'nature_boost', category: 'consumable', rarity: 'rare', stackable: true, maxStack: 5 }
            },

            'garden_fertilizer_craft': {
                id: 'garden_fertilizer_craft',
                name: '🌱 Fertilizante Mágico',
                description: 'Próxima cosecha del huerto da x2',
                craftTime: 5400000,
                category: 'nature',
                ingredients: [
                    { id: 'herb_legendary', quantity: 1 },
                    { id: 'golden_dust', quantity: 1 },
                ],
                result: { id: 'garden_fertilizer', category: 'consumable', rarity: 'epic', stackable: true, maxStack: 3 }
            },

            // ===== 🎲 ECONOMÍA =====
            'golden_touch_craft': {
                id: 'golden_touch_craft',
                name: '👆 Toque Dorado',
                description: '+40% al próximo daily',
                craftTime: 3600000,
                category: 'economy',
                ingredients: [
                    { id: 'golden_dust', quantity: 2 },
                    { id: 'lucky_charm', quantity: 2 },
                ],
                result: { id: 'golden_touch', category: 'consumable', rarity: 'epic', stackable: true, maxStack: 3 }
            },

            'work_frenzy_craft': {
                id: 'work_frenzy_craft',
                name: '💼 Frenesí Laboral',
                description: 'Próximo trabajo da x3',
                craftTime: 5400000,
                category: 'economy',
                ingredients: [
                    { id: 'fire_ember', quantity: 4 },
                    { id: 'energy_drink', quantity: 3 },
                    { id: 'crystal_shard', quantity: 1 },
                ],
                result: { id: 'work_frenzy', category: 'consumable', rarity: 'epic', stackable: true, maxStack: 3 }
            },

            'shadow_contract_craft': {
                id: 'shadow_contract_craft',
                name: '📜 Contrato Sombrío',
                description: '-50% costo próximo sicario',
                craftTime: 7200000,
                category: 'economy',
                ingredients: [
                    { id: 'shadow_fiber', quantity: 5 },
                    { id: 'crystal_shard', quantity: 2 },
                ],
                result: { id: 'shadow_contract', category: 'consumable', rarity: 'epic', stackable: true, maxStack: 2 }
            },

            // ===== 🌟 LEGENDARIO (Artesano) =====
            'void_elixir_craft': {
                id: 'void_elixir_craft',
                name: '🔮 Elixir del Vacío',
                description: '+100% a todo por 1h — Solo Artesano',
                craftTime: 14400000,
                category: 'legendary',
                artesanoOnly: true,
                ingredients: [
                    { id: 'void_crystal', quantity: 1 },
                    { id: 'arcane_dust', quantity: 3 },
                    { id: 'dragon_scale', quantity: 2 },
                ],
                result: { id: 'void_elixir', category: 'consumable', rarity: 'mythic', stackable: true, maxStack: 1 }
            },

            'star_blessing_craft': {
                id: 'star_blessing_craft',
                name: '⭐ Bendición Estelar',
                description: '+50% XP por 24h — Solo Artesano',
                craftTime: 21600000,
                category: 'legendary',
                artesanoOnly: true,
                ingredients: [
                    { id: 'star_fragment', quantity: 2 },
                    { id: 'golden_dust', quantity: 3 },
                    { id: 'moon_essence', quantity: 2 },
                ],
                result: { id: 'star_blessing', category: 'consumable', rarity: 'mythic', stackable: true, maxStack: 1 }
            },

            // ⚗️ RECETAS EXCLUSIVAS DEL ARTESANO
            'artesano_speed_gauntlet': {
                id: 'artesano_speed_gauntlet',
                name: '⚙️ Guantelete de Velocidad',
                description: 'Reduce todos los cooldowns en 35% por 4 horas. Solo Artesanos.',
                craftTime: 3600000, // 1h (con artesano = 36min)
                artesanoOnly: true,
                ingredients: [
                    { id: 'refined_metal', quantity: 5 },
                    { id: 'energy_drink', quantity: 3 },
                    { id: 'work_boots', quantity: 1 },
                ],
                result: {
                    id: 'speed_gauntlet',
                    category: 'consumable',
                    rarity: 'epic',
                    effect: {
                        type: 'cooldown_reduction',
                        targets: ['all'],
                        reduction: 0.35,
                        duration: 14400
                    },
                    stackable: true,
                    maxStack: 3,
                }
            },

            'artesano_arcane_multiplier': {
                id: 'artesano_arcane_multiplier',
                name: '🔮 Multiplicador Arcano',
                description: '+50% a todo durante 2 horas. Creación exclusiva del Artesano.',
                craftTime: 7200000, // 2h (con artesano = ~1h 12min)
                artesanoOnly: true,
                ingredients: [
                    { id: 'arcane_dust', quantity: 4 },
                    { id: 'lucky_charm', quantity: 3 },
                    { id: 'refined_metal', quantity: 2 },
                ],
                result: {
                    id: 'arcane_multiplier',
                    category: 'consumable',
                    rarity: 'legendary',
                    effect: {
                        type: 'multiplier',
                        targets: ['work', 'games'],
                        multiplier: 1.50,
                        duration: 7200
                    },
                    stackable: true,
                    maxStack: 2,
                }
            },

            'artesano_mythril_forge': {
                id: 'artesano_mythril_forge',
                name: '💠 Forja de Mitril',
                description: 'El item definitivo del Artesano. +75% trabajo permanente por 6h + -50% cooldown trabajo.',
                craftTime: 21600000, // 6h (con artesano = ~3h 36min)
                artesanoOnly: true,
                ingredients: [
                    { id: 'mythril_shard', quantity: 3 },
                    { id: 'arcane_dust', quantity: 5 },
                    { id: 'refined_metal', quantity: 8 },
                    { id: 'money_magnet', quantity: 1 },
                ],
                result: {
                    id: 'mythril_forge_item',
                    category: 'consumable',
                    rarity: 'mythic',
                    effect: {
                        type: 'cooldown_reduction',
                        targets: ['work'],
                        reduction: 0.50,
                        duration: 21600,
                        bonusMultiplier: 1.75,
                    },
                    stackable: false,
                    maxStack: 1,
                }
            },

            // 🔩 Recetas intermedias (materiales → materiales mejores, para todos pero útiles al artesano)
            'refined_to_arcane': {
                id: 'refined_to_arcane',
                name: '🔩→✨ Purificación',
                description: 'Convierte metal refinado en polvo arcano.',
                craftTime: 1800000, // 30min (artesano = 18min)
                ingredients: [
                    { id: 'refined_metal', quantity: 5 },
                    { id: 'double_xp_potion', quantity: 1 },
                ],
                result: {
                    id: 'arcane_dust',
                    category: 'ingredient',
                    rarity: 'rare',
                    stackable: true,
                    maxStack: 30,
                }
            },

            // 💀 Robbery Kit → Master Gloves → Phantom Gloves
            'phantom_gloves_craft': {
                id: 'phantom_gloves_craft',
                name: '👻🧤 Guantes Fantasma',
                description: 'Permiten robar sin riesgo de ser atrapado (3 usos)',
                craftTime: 21600000, // 6 horas
                ingredients: [
                    { id: 'master_gloves', quantity: 1 },
                    { id: 'fortune_shield', quantity: 1 },
                    { id: 'robbery_kit', quantity: 5}
                ],
                result: {
                    id: 'phantom_gloves',
                    category: 'consumable',
                    rarity: 'mythic',
                    effect: {
                        type: 'robbery_boost',
                        successRate: 1.0,
                        safe: true,
                        uses: 3
                    },
                    stackable: true,
                    maxStack: 1
                }
            },
            // 🌿 Recetas con ingredientes del huerto
            'herb_potion_craft': {
                id: 'herb_potion_craft',
                name: '🧪 Poción de Hierbas',
                description: 'Una poción básica hecha con hierbas del huerto. +15% trabajo por 1h',
                craftTime: 1800000, // 30 minutos
                ingredients: [
                    { id: 'herb_common', quantity: 3 },
                    { id: 'herb_rare', quantity: 1 }
                ],
                result: {
                    id: 'herb_potion',
                    category: 'consumable',
                    rarity: 'uncommon',
                    effect: {
                        type: 'multiplier',
                        targets: ['work'],
                        multiplier: 1.15,
                        duration: 3600
                    },
                    stackable: true,
                    maxStack: 10
                }
            },

            'epic_herb_elixir_craft': {
                id: 'epic_herb_elixir_craft',
                name: '⚗️ Elixir Épico',
                description: 'Un elixir poderoso. +30% a todo por 2h',
                craftTime: 7200000, // 2 horas
                ingredients: [
                    { id: 'herb_rare', quantity: 2 },
                    { id: 'herb_epic', quantity: 2 },
                    { id: 'energy_drink', quantity: 2 }
                ],
                result: {
                    id: 'epic_elixir',
                    category: 'consumable',
                    rarity: 'epic',
                    effect: {
                        type: 'multiplier',
                        targets: ['work', 'games'],
                        multiplier: 1.30,
                        duration: 7200
                    },
                    stackable: true,
                    maxStack: 5
                }
            },

            'legendary_brew_craft': {
                id: 'legendary_brew_craft',
                name: '✨ Brebaje Legendario',
                description: 'Lo mejor del huerto. +50% a todo por 3h + XP doble',
                craftTime: 21600000, // 6 horas
                ingredients: [
                    { id: 'herb_legendary', quantity: 2 },
                    { id: 'herb_epic', quantity: 2 },
                    { id: 'double_xp_potion', quantity: 2 }
                ],
                result: {
                    id: 'legendary_brew',
                    category: 'consumable',
                    rarity: 'legendary',
                    effect: {
                        type: 'multiplier',
                        targets: ['work', 'games'],
                        multiplier: 1.50,
                        duration: 10800
                    },
                    stackable: true,
                    maxStack: 2
                }
            },

            'pet_treat_craft': {
                id: 'pet_treat_craft',
                name: '🐾 Golosina de Mascota',
                description: 'Da +10 XP extra a todas tus mascotas al usarla',
                craftTime: 3600000, // 1 hora
                ingredients: [
                    { id: 'herb_common', quantity: 5 },
                    { id: 'herb_rare', quantity: 2 }
                ],
                result: {
                    id: 'pet_treat',
                    category: 'pet',
                    rarity: 'rare',
                    effect: {
                        type: 'pet_xp',
                        amount: 10
                    },
                    stackable: true,
                    maxStack: 10
                }
            },
        };
    }

    // 2. CAMBIAR LA FUNCIÓN hasRequiredMaterials por:
    hasRequiredMaterials(userItems, ingredients) {
        for (const ingredient of ingredients) {
            const userItem = userItems[ingredient.id];
            const userQuantity = userItem ? userItem.quantity : 0;  // Usar .quantity
            if (userQuantity < ingredient.quantity) {
                return false;
            }
        }
        return true;
    }

    // 3. CAMBIAR LA FUNCIÓN consumeMaterials por:
    consumeMaterials(userItems, ingredients) {
        const newItems = { ...userItems };
        
        for (const ingredient of ingredients) {
            if (newItems[ingredient.id]) {
                newItems[ingredient.id].quantity -= ingredient.quantity;  // Usar .quantity
                if (newItems[ingredient.id].quantity <= 0) {
                    delete newItems[ingredient.id];
                }
            }
        }
        
        return newItems;
    }

    async handleRecipesInteraction(interaction) {
        const parts = interaction.customId.split('_');
        const userId = parts[parts.length - 1];

        if (interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ Estas recetas no son tuyas. Usa `>recipes` para abrir las tuyas.', ephemeral: true });
        }

        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            guildId: interaction.guildId,
            reply: async (options) => await interaction.update(options)
        };

        // recipes_back_menu_userId
        if (interaction.customId.startsWith('recipes_back_menu_')) {
            return await this.showCraftingRecipes(fakeMessage, 1, null);
        }

        // recipes_cat_<category>_<page>_userId
        if (interaction.customId.startsWith('recipes_cat_')) {
            const category = parts[2];
            const page = parseInt(parts[3]) || 1;
            return await this.showCraftingRecipes(fakeMessage, page, category);
        }

        // Fallback legacy (prev/next sin categoría)
        const page = parseInt(parts[2]) || 1;
        await this.showCraftingRecipes(fakeMessage, page, null);
    }

    async addToCraftingQueue(craftId, userId, recipeId, recipe, completesAt, channelId) {
        await this.shop.economy.database.addCraftToQueue({
            id: craftId,
            user_id: userId,
            recipe_id: recipeId,
            recipe_name: recipe.name,
            completes_at: new Date(completesAt).toISOString(),
            result_item_id: recipe.result.id,
            result_quantity: 1,
            channel_id: channelId
        });
    }

    async completeCraft(craftId) {
        // Obtener datos del craft
        const crafts = await this.shop.economy.database.getCompletedCrafts();
        const craft = crafts.find(c => c.id === craftId);
        
        if (!craft) return;
        
        // Dar el item al usuario
        const user = await this.shop.economy.getUser(craft.user_id);
        const newItems = { ...user.items || {} };
        
        if (newItems[craft.result_item_id]) {
            newItems[craft.result_item_id].quantity += craft.result_quantity;
        } else {
            newItems[craft.result_item_id] = {
                id: craft.result_item_id,
                quantity: craft.result_quantity,
                purchaseDate: new Date().toISOString()
            };
        }
        
        await this.shop.economy.updateUser(craft.user_id, { items: newItems });
        
        // Marcar como completado
        await this.shop.economy.database.completeCraftInDB(craftId);
        
        // Notificar en el canal donde se inició el craft
        try {
            const channel = await this.client.channels.fetch(craft.channel_id);
            if (channel) {

                const recipe = this.CRAFTING_RECIPES[craft.recipe_id];
                const realItemName = recipe ? recipe.name : craft.recipe_name;

                const embed = {
                    color: 0x00ff00,
                    title: '🔨 ¡Crafteo Completado!',
                    description: `<@${craft.user_id}> tu **${realItemName}** está listo!\n\nRevisa tu inventario con \`>bag\``,
                    fields: [
                        {
                            name: '📦 Item Obtenido',
                            value: realItemName,
                            inline: true
                        }
                    ],
                    timestamp: new Date().toISOString()
                };
                
                await channel.send({
                    content: `<@${craft.user_id}>`,
                    embeds: [embed],
                    allowedMentions: { users: [craft.user_id]}
                });

                console.log(`✅ Craft completado: ${realItemName} para usuario ${craft.user_id}`);
            }
        } catch (error) {
            console.log(`Error notificando crafteo completado: ${error.message}`);
        }        

        if (this.shop.economy.achievements) {
            await this.shop.economy.achievements.updateStats(craft.user_id, 'items_crafted');
        
            try {
                const newAchievements = await this.shop.economy.achievements.checkAchievements(craft.user_id);
                if (newAchievements.length > 0) {
                    await this.shop.economy.achievements.notifyAchievements(channel, newAchievements);
                }
            } catch (error) {
                console.error('❌ Error verificando logros después de crear subasta:', error);
            }
        }

        // *** NUEVO: NOTIFICAR MISIONES COMPLETADAS ***
        if (this.shop.economy.missions) {
            const craftinglol = await this.shop.economy.missions.updateMissionProgress(craft.user_id, 'items_crafted_today', 1);
                
            const allCompleted = [...craftinglol];
                if (allCompleted.length > 0) {
                await this.shop.economy.missions.notifyCompletedMissions(channel, allCompleted);
            }
        }
    }

    async showCraftingRecipes(message, page = 1, filterCategory = null) {
        try {
            const userId = message.author.id;
            const user = await this.shop.economy.getUser(userId);
            const prof = this.shop.economy.getProfession(user);
            const isArtesano = prof?.name === '⚗️ Artesano';
            const currentGuildId = message.guild?.id;

            const CATEGORIES = {
                potion:            { label: '🧪 Pociones',           color: '#9B59B6' },
                combat:            { label: '⚔️ Combate',            color: '#E74C3C' },
                nature:            { label: '🌿 Naturaleza',         color: '#2ECC71' },
                economy:           { label: '🎲 Economía',           color: '#F39C12' },
                tool:              { label: '🔨 Herramientas',       color: '#95A5A6' },
                artesano_exclusive:{ label: '⚗️ Exclusivas Artesano',color: '#00BCD4' },
                general:           { label: '📦 General',            color: '#7F8C8D' },
            };

            const formatTime = (ms) => {
                const m = Math.floor(ms / 60000);
                const h = Math.floor(m / 60);
                const rem = m % 60;
                if (h > 0) return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
                return `${m}m`;
            };

            const rarityEmojis = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟠', mythic: '🔴' };

            // Agrupar recetas por categoría
            const allRecipes = Object.values(this.CRAFTING_RECIPES)
                .filter(r => !r.guildExclusive || r.guildExclusive === currentGuildId);

            const grouped = {};
            for (const recipe of allRecipes) {
            const cat = recipe.artesanoOnly ? 'artesano_exclusive' :
                        (recipe.category || 'general');
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(recipe);
            }

            // Si hay filtro de categoría activo
            const activeCategory = filterCategory && CATEGORIES[filterCategory] ? filterCategory : null;

            if (!activeCategory) {
                // Mostrar menú de categorías
                const embed = new EmbedBuilder()
                    .setTitle('⚒️ Taller de Crafteo')
                    .setDescription(
                        `Bienvenido al taller. Selecciona una categoría para ver las recetas.\n\n` +
                        `📋 Usa \`>recipes <categoría>\` para ir directo.\n` +
                        `⚗️ Las recetas **🌟 Legendario** son exclusivas del Artesano.`
                    )
                    .setColor('#9932CC')
                    .setTimestamp();

                for (const [catId, catInfo] of Object.entries(CATEGORIES)) {
                    const catRecipes = grouped[catId] || [];
                    if (catRecipes.length === 0) continue;

                    const locked = catId === 'artesano_exclusive' && !isArtesano;
                    embed.addFields({
                        name: `${catInfo.label} ${locked ? '🔒' : ''}`,
                        value: `${catRecipes.length} receta${catRecipes.length !== 1 ? 's' : ''} • \`>recipes ${catId}\``,
                        inline: true,
                    });
                }

                if (isArtesano) {
                    embed.setFooter({ text: '⚗️ Artesano activo — -40% tiempo de crafteo en todas las recetas' });
                } else {
                    embed.setFooter({ text: 'Usa >recipes <categoría> para ver las recetas de esa sección' });
                }

                // Botones de categoría
                const rows = [];
                const catEntries = Object.entries(CATEGORIES).filter(([id]) => (grouped[id] || []).length > 0);

                for (let i = 0; i < catEntries.length; i += 4) {
                    const row = new ActionRowBuilder();
                    for (const [catId, catInfo] of catEntries.slice(i, i + 4)) {
                        const locked = catId === 'artesano_exclusive' && !isArtesano;
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`recipes_cat_${catId}_1_${userId}`)
                                .setLabel(catInfo.label.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim())
                                .setEmoji(catInfo.label.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu)?.[0] || '📦')
                                .setStyle(locked ? ButtonStyle.Secondary : ButtonStyle.Primary)
                                .setDisabled(locked)
                        );
                    }
                    if (row.components.length > 0) rows.push(row);
                }

                return message.reply({ embeds: [embed], components: rows.slice(0, 5) });
            }

            // Mostrar recetas de una categoría
            const catRecipes = grouped[activeCategory] || [];
            const catInfo = CATEGORIES[activeCategory];
            const RECIPES_PER_PAGE = 3;
            const totalPages = Math.ceil(catRecipes.length / RECIPES_PER_PAGE);
            const currentPage = Math.max(1, Math.min(page, totalPages));
            const pageRecipes = catRecipes.slice((currentPage - 1) * RECIPES_PER_PAGE, currentPage * RECIPES_PER_PAGE);

            const embed = new EmbedBuilder()
                .setTitle(`${catInfo.label} — Recetas de Crafteo`)
                .setDescription(`Página **${currentPage}/${totalPages}** • ${catRecipes.length} recetas\n\`>craft <recipe_id>\` para craftear`)
                .setColor(catInfo.color)
                .setTimestamp();

            for (const recipe of pageRecipes) {
                const rEmoji = rarityEmojis[recipe.result.rarity] || '⚪';
                const craftSpeedMult = isArtesano ? (this.shop.economy.getProfession(user)?.craftSpeedMult || 1.0) : 1.0;
                const effectiveTime = Math.floor(recipe.craftTime * craftSpeedMult);

                const timeText = isArtesano && craftSpeedMult < 1.0
                    ? `~~${formatTime(recipe.craftTime)}~~ → **${formatTime(effectiveTime)}** ⚗️`
                    : formatTime(recipe.craftTime);

                // Verificar si el usuario tiene los materiales
                const userItems = user.items || {};
                const hasMaterials = this.hasRequiredMaterials(userItems, recipe.ingredients);

                const ingredients = recipe.ingredients.map(ing => {
                    const item = this.shop.shopItems[ing.id];
                    const userQty = userItems[ing.id]?.quantity || 0;
                    const hasIt = userQty >= ing.quantity;
                    return `${hasIt ? '✅' : '❌'} ${item?.name || ing.id}: ${userQty}/${ing.quantity}`;
                }).join('\n');

                embed.addFields({
                    name: `${rEmoji} ${recipe.name} ${hasMaterials ? '✅' : ''} ${recipe.artesanoOnly ? '🔒⚗️' : ''}`,
                    value: [
                        `*${recipe.description}*`,
                        `📦 **Materiales:**\n${ingredients}`,
                        `⏱️ **Tiempo:** ${timeText}`,
                        `\`>craft ${recipe.id}\``,
                    ].join('\n'),
                    inline: false,
                });
            }

            if (isArtesano) {
                embed.setFooter({ text: `⚗️ Artesano — -40% tiempo de crafteo activo • Página ${currentPage}/${totalPages}` });
            } else {
                embed.setFooter({ text: `Página ${currentPage}/${totalPages} • ✅ = tienes los materiales` });
            }

            // Botones de navegación
            const navRow = new ActionRowBuilder();
            navRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`recipes_back_menu_${userId}`)
                    .setLabel('⬅️ Categorías')
                    .setStyle(ButtonStyle.Secondary),
            );
            if (currentPage > 1) {
                navRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`recipes_cat_${activeCategory}_${currentPage - 1}_${userId}`)
                        .setLabel('◀️ Anterior')
                        .setStyle(ButtonStyle.Primary)
                );
            }
            if (currentPage < totalPages) {
                navRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`recipes_cat_${activeCategory}_${currentPage + 1}_${userId}`)
                        .setLabel('Siguiente ▶️')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            return message.reply({ embeds: [embed], components: [navRow] });

        } catch (error) {
            console.error('Error mostrando recetas:', error);
            await message.reply('❌ Error al mostrar las recetas.');
        }
    }

    async showCraftingQueue(message) {
        const userId = message.author.id;
        const crafts = await this.shop.economy.database.getCraftingQueue(userId);
        
        if (crafts.length === 0) {
            return message.reply('📭 No tienes crafteos en progreso.');
        }
        
        let queueText = '';
        crafts.forEach((craft, index) => {
            const completesAt = new Date(craft.completes_at).getTime();
            const now = Date.now();
            const timeLeft = completesAt - now;

            // Obtener nombre real con emojis
            const recipe = this.CRAFTING_RECIPES[craft.recipe_id];
            const realItemName = recipe ? recipe.name : craft.recipe_name;
            
            if (timeLeft <= 0) {
                queueText += `**${index + 1}.** 🔨 **${realItemName}** ✅ **COMPLETADO**\n\n`;
            } else {
                const minutes = Math.floor(timeLeft / 60000);
                const seconds = Math.floor((timeLeft % 60000) / 1000);
                const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                queueText += `**${index + 1}.** 🔨 **${realItemName}**\n`;
                queueText += `└ Completa en: ${timeString}\n\n`;
            }
        });
        
        const embed = {
            color: 0xffaa00,
            title: '🔨 **COLA DE CRAFTEO**',
            description: queueText,
            footer: { text: 'Usa >cancelcraft <número> para cancelar un crafteo' }
        };
        
        await message.channel.send({ embeds: [embed] });
    }

    getRarityEmoji(rarity) {
        const rarityEmojis = {
            'common': '⚪',
            'uncommon': '🟢',
            'rare': '🔵',
            'epic': '🟣',
            'legendary': '🟠'
        };
        return rarityEmojis[rarity] || '⚪';
    }
    
    async craftItem(message, args) {
        try {
            if (!args[0]) {
                return message.reply('❌ Especifica el ID de la receta: `>craft <recipe_id>`');
            }
            
            const recipeId = args[0];
            const recipe = this.CRAFTING_RECIPES[recipeId];
            
            if (!recipe) {
                return message.reply('❌ Receta no encontrada. Usa `>recipes` para ver las disponibles.');
            }

            if (recipe.guildExclusive && recipe.guildExclusive !== message.guild?.id) {
                return message.reply('❌ Esta receta no está disponible en este servidor.');
            }
                        
            if (recipe.artesanoOnly) {
                const prof = this.shop.economy.getProfession(userData);
                if (prof?.name !== '⚗️ Artesano') {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setTitle('🔒 Receta Exclusiva')
                            .setDescription(`**${recipe.name}** solo puede ser crafteada por la profesión **⚗️ Artesano**.\n\nUsa \`>profesion artesano\` para cambiar tu profesión.`)
                            .setColor('#E74C3C')]
                    });
                }
            }

            const userData = await this.shop.economy.getUser(message.author.id);
            if (!userData) {
                return message.reply('❌ Usuario no registrado.');
            }
            
            const userItems = userData.items || {};
            
            // Verificar materiales usando el nuevo formato
            if (!this.hasRequiredMaterials(userItems, recipe.ingredients)) {
                let missingMaterials = '';
                recipe.ingredients.forEach(ingredient => {
                    const userItem = userItems[ingredient.id];
                    const userQuantity = userItem ? userItem.quantity : 0;  // Usar .quantity
                    const item = this.shop.shopItems[ingredient.id];
                    if (userQuantity < ingredient.quantity) {
                        const itemName = item ? item.name : ingredient.id;
                        const emoji = item ? item.emoji || '📦' : '📦';
                        const needed = ingredient.quantity - userQuantity;
                        missingMaterials += `${emoji} ${itemName}: ${userQuantity}/${ingredient.quantity} (faltan ${needed})\n`;
                    }
                });
                
                const embed = {
                    color: 0xff0000,
                    title: '❌ **MATERIALES INSUFICIENTES**',
                    description: 'Te faltan los siguientes materiales:',
                    fields: [
                        {
                            name: '📦 Materiales Faltantes',
                            value: missingMaterials,
                            inline: false
                        }
                    ]
                };
                
                return message.channel.send({ embeds: [embed] });
            }

            // Verificar límites de stack del item a craftear
            const resultItem = recipe.result;
            const currentQuantity = userItems[resultItem.id] ? userItems[resultItem.id].quantity : 0;

            // Verificar si es stackeable
            if (!resultItem.stackable && currentQuantity >= 1) {
                return message.reply(`❌ **${recipe.name}** no es stackeable y ya tienes uno.`);
            }

            // Verificar límite máximo
            if (resultItem.maxStack && currentQuantity >= resultItem.maxStack) {
                return message.reply(`❌ Ya tienes el máximo permitido de **${recipe.name}** (${resultItem.maxStack}/${resultItem.maxStack}).`);
            }

            // Verificar si al craftear uno más se excede el límite
            if (resultItem.maxStack && (currentQuantity + 1) > resultItem.maxStack) {
                return message.reply(`❌ Craftear **${recipe.name}** excedería el límite máximo (${currentQuantity + 1}/${resultItem.maxStack}).`);
            }
            
            // Consumir materiales usando el nuevo formato
            const newItems = this.consumeMaterials(userItems, recipe.ingredients);
            
            // Agregar item crafteado
            // En lugar de dar el item inmediatamente, agregarlo a la cola
            const craftId = `${message.author.id}_${Date.now()}`;
            const prof = this.shop.economy.getProfession(userData);
            const craftSpeedMult = prof?.craftSpeedMult || 1.0;
            const effectiveCraftTime = Math.floor(recipe.craftTime * craftSpeedMult);
            const completesAt = Date.now() + effectiveCraftTime;

            // Actualizar inventario (consumir materiales)
            await this.shop.economy.updateUser(message.author.id, { items: newItems });

            try {
                await this.addToCraftingQueue(craftId, message.author.id, recipeId, recipe, completesAt, message.channel.id);
                
                const minutes = Math.floor(recipe.craftTime / 60000);
                const embed = {
                    color: 0xffaa00,
                    title: '🔨 **CRAFTEO INICIADO**',
                    description: `Comenzaste a craftear **${recipe.name}**`,
                    fields: [
                        {
                            name: '⏱️ Tiempo de Crafteo',
                            value: craftSpeedMult < 1.0
                                ? `~~${Math.floor(recipe.craftTime / 60000)}m~~ → **${Math.floor(effectiveCraftTime / 60000)}m** ⚗️ Artesano`
                                : `${Math.floor(effectiveCraftTime / 60000)} minutos`,
                            inline: true
                        },
                        {
                            name: '🎯 Se completará',
                            value: `<t:${Math.floor(completesAt/1000)}:t>`,
                            inline: true
                        }
                    ]
                };
                
                await message.channel.send({ embeds: [embed] });
                
                // Programar finalización
                setTimeout(() => this.completeCraft(craftId), effectiveCraftTime);
            } catch (error) {
                console.error('Error iniciando crafteo:', error);
                message.reply('❌ Error iniciando el crafteo.');
            }
            
            // Actualizar inventario
            /*const success = await updateUserItems(message.author.id, newItems);
            
            if (success) {
                const rarityEmoji = getRarityEmoji(recipe.result.rarity);
                
                const embed = {
                    color: 0x00ff00,
                    title: '🔨 **CRAFTEO EXITOSO**',
                    description: `¡Has crafteado **${recipe.name}**! ${rarityEmoji}`,
                    fields: [
                        {
                            name: '📝 Descripción',
                            value: recipe.description,
                            inline: false
                        },
                        {
                            name: '⭐ Rareza',
                            value: `${rarityEmoji} ${recipe.result.rarity}`,
                            inline: true
                        },
                        {
                            name: '📦 Cantidad Obtenida',
                            value: quantity.toString(),
                            inline: true
                        }
                    ]
                };
                
                await message.channel.send({ embeds: [embed] });
            } else {
                message.reply('❌ Error al craftear el item.');
            }*/
            
        } catch (error) {
            console.error('Error crafteando item:', error);
            message.reply('❌ Error al procesar el crafteo.');
        }
    }

    async cancelCraft(message, args) {
        try {
            const userId = message.author.id;
            const therecipe = this.CRAFTING_RECIPES[craft.recipe_id];
            const realItemName = therecipe ? therecipe.name : craft.recipe_name;
            
            // Si no especifica ID, mostrar lista para cancelar
            if (!args[0]) {
                const crafts = await this.shop.economy.database.getCraftingQueue(userId);
                
                if (crafts.length === 0) {
                    return message.reply('❌ No tienes crafteos en progreso para cancelar.');
                }
                
                let craftList = '';
                crafts.forEach((craft, index) => {
                    const timeLeft = new Date(craft.completes_at).getTime() - Date.now();
                    const minutes = Math.max(0, Math.floor(timeLeft / 60000));
                    
                    craftList += `**${index + 1}.** ${realItemName} (${minutes} min restantes)\n`;
                });
                
                const embed = {
                    color: 0xffaa00,
                    title: '🔨 Crafteos en Progreso',
                    description: `${craftList}\nUsa \`>cancelcraft <número>\` para cancelar uno.`,
                    footer: { text: '⚠️ Cancelar devolverá el 80% de los materiales' }
                };
                
                return message.channel.send({ embeds: [embed] });
            }
            
            // Obtener crafteos del usuario
            const crafts = await this.shop.economy.database.getCraftingQueue(userId);
            const craftIndex = parseInt(args[0]) - 1;
            
            if (isNaN(craftIndex) || craftIndex < 0 || craftIndex >= crafts.length) {
                return message.reply('❌ Número de craft inválido. Usa `>craftqueue` para ver la lista.');
            }
            
            const craftToCancel = crafts[craftIndex];
            const recipe = this.CRAFTING_RECIPES[craftToCancel.recipe_id];
            
            if (!recipe) {
                return message.reply('❌ Error: receta no encontrada.');
            }
            
            // Cancelar en la base de datos
            const success = await this.shop.economy.database.cancelCraft(craftToCancel.id);
            
            if (!success) {
                return message.reply('❌ Error cancelando el crafteo.');
            }
            
            // Devolver materiales (80% para evitar abuso)
            const user = await this.shop.economy.getUser(userId);
            const userItems = { ...user.items || {} };
            
            const materialsReturned = [];
            recipe.ingredients.forEach(ingredient => {
                const returnQuantity = Math.floor(ingredient.quantity * 0.8); // 80% de devolución
                
                if (returnQuantity > 0) {
                    if (userItems[ingredient.id]) {
                        userItems[ingredient.id].quantity += returnQuantity;
                    } else {
                        userItems[ingredient.id] = {
                            id: ingredient.id,
                            quantity: returnQuantity,
                            purchaseDate: new Date().toISOString()
                        };
                    }
                    
                    const item = this.shop.shopItems[ingredient.id];
                    const itemName = item ? item.name : ingredient.id;
                    materialsReturned.push(`${returnQuantity}x ${itemName}`);
                }
            });
            
            // Actualizar inventario
            await this.shop.economy.updateUser(userId, { items: userItems });
            
            const embed = {
                color: 0xff6600,
                title: '🚫 Crafteo Cancelado',
                description: `**${realItemName}** ha sido cancelado.`,
                fields: [
                    {
                        name: '📦 Materiales Devueltos (80%)',
                        value: materialsReturned.join('\n') || 'Ninguno',
                        inline: false
                    }
                ]
            };
            
            await message.channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error cancelando craft:', error);
            message.reply('❌ Error al cancelar el crafteo.');
        }
    }

    async checkCompletedCrafts() {
        const completedCrafts = await this.shop.economy.database.getCompletedCrafts();
        
        for (const craft of completedCrafts) {
            await this.completeCraft(craft.id);
        }
    }
}

// 5. Exportar todos los sistemas
module.exports = {
    AuctionSystem,
    CraftingSystem
};
