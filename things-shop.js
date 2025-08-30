const { EmbedBuilder } = require('discord.js');

// 3. Sistema de subastas
class AuctionSystem {
    constructor(shopSystem) {
        this.shop = shopSystem;
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
    
    async createAuction(message, itemId, startingBid, duration = 3600000) { // 1 hora por defecto
        const userId = message.author.id;
        const user = await this.shop.economy.getUser(userId);
        const userItems = user.items || {};
        
        if (!userItems[itemId] || userItems[itemId].quantity < 1) {
            await message.reply(`❌ No tienes **${itemId}** para subastar.`);
            return;
        }
        
        const item = this.shop.shopItems[itemId];
        if (!item) {
            await message.reply('❌ Item no válido.');
            return;
        }
        
        const auctionId = `${userId}_${itemId}_${Date.now()}`;
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
                { name: '⏰ Termina en', value: `${Math.floor(duration / 60000)} minutos`, inline: true }
            )
            .setColor('#FF6600')
            .setFooter({ text: `🔨 ¡Nueva subasta! Copia el texto de este mensaje y usa \`>bid ${auctionId} <cantidad>\` para pujar.` });
        
        await message.reply({ 
            content: `${auctionId}`,
            embeds: [embed] 
        });
        
        // Programar fin de subasta
        setTimeout(() => this.endAuction(auctionId, message.client), duration);
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
        
        if (bidAmount <= auction.currentBid) {
            await message.reply(`❌ Tu puja debe ser mayor a **${auction.currentBid.toLocaleString('es-ES')} π-b$**.`);
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
                
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🔨 Subasta Terminada')
                        .setDescription(`Subasta de **${auction.itemName}** ha finalizado`)
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
    constructor(shopSystem) {
        this.shop = shopSystem;

        this.CRAFTING_RECIPES = {
            'super_lucky_charm': {
                id: 'super_lucky_charm',
                name: '🍀✨ Super Amuleto de Suerte',
                description: 'Versión mejorada del amuleto normal (x2.0 multiplicador, 4 horas)',
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
                        multiplier: 2.0,
                        duration: 14400 // 4 horas
                    },
                    stackable: true,
                    maxStack: 3
                }
            },

            'master_toolkit': {
                id: 'master_toolkit',
                name: '🔧⚡ Kit Maestro',
                description: 'Reduce todos los cooldowns permanentemente en 30%',
                ingredients: [
                    { id: 'work_boots', quantity: 2 },
                    { id: 'energy_drink', quantity: 10 },
                    { id: 'robbery_kit', quantity: 5 },
                    { id: 'golden_pickaxe', quantity: 1 }
                ],
                result: {
                    id: 'master_toolkit',
                    category: 'permanent',
                    rarity: 'legendary',
                    effect: {
                        type: 'permanent_cooldown',
                        targets: ['all'],
                        reduction: 0.3
                    },
                    stackable: false,
                    maxStack: 1
                }
            },

            'mega_luck_craft': {
                id: 'mega_luck_craft',
                name: '🍀✨ Mega Poción de Suerte',
                description: 'Una potente mezcla de suerte concentrada',
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

            'speed_boots_craft': {
                id: 'speed_boots_craft',
                name: '👟⚡ Botas de Velocidad Supremas',
                description: 'Reduce todos los cooldowns a cero temporalmente',
                ingredients: [
                    { id: 'work_boots', quantity: 2 },
                    { id: 'energy_drink', quantity: 8 },
                    { id: 'lucky_charm', quantity: 2 }
                ],
                result: {
                    id: 'speed_boots',
                    category: 'consumable',
                    rarity: 'epic',
                    effect: {
                        type: 'no_cooldown',
                        targets: ['all'],
                        duration: 1800 // 30 min
                    },
                    stackable: true,
                    maxStack: 2
                }
            },

            'diamond_membership_craft': {
                id: 'diamond_membership_craft',
                name: '💎👑 Membresía Diamante',
                description: 'El item más exclusivo - requiere muchos recursos',
                ingredients: [
                    { id: 'vip_pass', quantity: 1 },
                    { id: 'money_magnet', quantity: 2 },
                    { id: 'golden_trophy', quantity: 3 },
                    { id: 'premium_mystery_box', quantity: 5 }
                ],
                result: {
                    id: 'diamond_membership',
                    category: 'permanent',
                    rarity: 'legendary',
                    effect: {
                        type: 'vip_membership',
                        duration: 30 * 24 * 60 * 60 * 1000, // 30 días
                        benefits: [
                            'no_cooldowns',
                            'double_earnings', 
                            'luck_boost',
                            'priority_support',
                            'exclusive_commands',
                            'custom_nickname'
                        ]
                    },
                    stackable: false,
                    maxStack: 1
                }
            },

            'xp_tornado_craft': {
                id: 'xp_tornado_craft',
                name: '🌪️📚 Tornado de XP',
                description: 'Fusiona pociones de XP para algo épico',
                ingredients: [
                    { id: 'double_xp_potion', quantity: 5 },
                    { id: 'lucky_charm', quantity: 3 }
                ],
                result: {
                    id: 'xp_tornado',
                    category: 'consumable',
                    rarity: 'epic',
                    effect: {
                        type: 'xp_multiplier',
                        targets: ['all'],
                        multiplier: 3.0,
                        duration: 1200 // 20 min
                    },
                    stackable: true,
                    maxStack: 3
                }
            },

            'golden_pickaxe_craft': {
                id: 'golden_pickaxe_craft', 
                name: '⛏️💎 Pico Dorado Legendario',
                description: 'El mejor tool para trabajar',
                ingredients: [
                    { id: 'work_boots', quantity: 3 },
                    { id: 'money_magnet', quantity: 1 },
                    { id: 'lucky_charm', quantity: 4 }
                ],
                result: {
                    id: 'golden_pickaxe',
                    category: 'consumable',
                    rarity: 'rare',
                    effect: {
                        type: 'work_multiplier',
                        targets: ['work'],
                        multiplier: 3.0,
                        uses: 5
                    },
                    stackable: true,
                    maxStack: 10
                }
            },

            'nickname_token_craft': {
                id: 'nickname_token_craft',
                name: '🏷️✨ Token de Apodo VIP',
                description: 'Permite personalizar tu apodo con estilo',
                ingredients: [
                    { id: 'rainbow_badge', quantity: 2 },
                    { id: 'golden_trophy', quantity: 2 }
                ],
                result: {
                    id: 'custom_nickname_token',
                    category: 'special',
                    rarity: 'rare',
                    effect: {
                        type: 'nickname_change',
                        uses: 1
                    },
                    stackable: true,
                    maxStack: 5
                }
            },

            // 🔮 Amuleto Cósmico (más fuerte que el super lucky charm)
            'cosmic_charm_craft': {
                id: 'cosmic_charm_craft',
                name: '🔮✨ Amuleto Cósmico',
                description: 'Un amuleto místico con poderes cósmicos (x3.0 multiplicador, 2 horas)',
                ingredients: [
                    { id: 'super_lucky_charm', quantity: 2 },
                    { id: 'xp_tornado', quantity: 1 }
                ],
                result: {
                    id: 'cosmic_charm',
                    category: 'consumable',
                    rarity: 'legendary',
                    effect: {
                        type: 'multiplier',
                        targets: ['work', 'games'],
                        multiplier: 3.0,
                        duration: 7200 // 2 horas
                    },
                    stackable: true,
                    maxStack: 3
                }
            },

            // 🛡️ Escudo de Fortuna
            'fortune_shield_craft': {
                id: 'fortune_shield_craft',
                name: '🛡️🍀 Escudo de Fortuna',
                description: 'Protege contra pérdidas en robos durante 1 hora',
                ingredients: [
                    { id: 'robbery_kit', quantity: 2 },
                    { id: 'lucky_charm', quantity: 1 }
                ],
                result: {
                    id: 'fortune_shield',
                    category: 'consumable',
                    rarity: 'rare',
                    effect: {
                        type: 'anti_robbery',
                        duration: 3600
                    },
                    stackable: true,
                    maxStack: 5
                }
            },

            // 🏆 Cofre Épico
            'epic_chest_craft': {
                id: 'epic_chest_craft',
                name: '📦🏆 Cofre Épico',
                description: 'Un cofre misterioso que contiene recompensas raras',
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

            // ⚡ Poción Turbo
            'turbo_potion_craft': {
                id: 'turbo_potion_craft',
                name: '⚡🥤 Poción Turbo',
                description: 'Reduce cooldowns en 50% por 20 minutos',
                ingredients: [
                    { id: 'energy_drink', quantity: 3 },
                    { id: 'work_boots', quantity: 1 }
                ],
                result: {
                    id: 'turbo_potion',
                    category: 'consumable',
                    rarity: 'epic',
                    effect: {
                        type: 'cooldown_reduction',
                        reduction: 0.5,
                        duration: 1200
                    },
                    stackable: true,
                    maxStack: 5
                }
            },

            // 💀 Guantes del Ladrón Maestro
            'master_gloves_craft': {
                id: 'master_gloves_craft',
                name: '💀🧤 Guantes del Ladrón Maestro',
                description: 'Mejora la efectividad de los robos (+50% éxito, 10 usos)',
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
                        uses: 10
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
                ingredients: [
                    { id: 'cosmic_charm', quantity: 2 },
                    { id: 'xp_tornado', quantity: 2 }
                ],
                result: {
                    id: 'infinity_charm',
                    category: 'consumable',
                    rarity: 'mythic',
                    effect: {
                        type: 'multiplier',
                        targets: ['work', 'games'],
                        multiplier: 5.0,
                        duration: 10800 // 3 horas
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
                ingredients: [
                    { id: 'diamond_pickaxe', quantity: 1 },
                    { id: 'super_lucky_charm', quantity: 2 }
                ],
                result: {
                    id: 'eternal_pickaxe',
                    category: 'tool',
                    rarity: 'legendary',
                    effect: {
                        type: 'mining_boost',
                        multiplier: 2.5,
                        durability: Infinity
                    },
                    stackable: false
                }
            },

            // 💀 Robbery Kit → Master Gloves → Phantom Gloves
            'phantom_gloves_craft': {
                id: 'phantom_gloves_craft',
                name: '👻🧤 Guantes Fantasma',
                description: 'Permiten robar sin riesgo de ser atrapado (15 usos)',
                ingredients: [
                    { id: 'master_gloves', quantity: 1 },
                    { id: 'fortune_shield', quantity: 1 }
                ],
                result: {
                    id: 'phantom_gloves',
                    category: 'consumable',
                    rarity: 'mythic',
                    effect: {
                        type: 'robbery_boost',
                        successRate: 1.0,
                        safe: true,
                        uses: 15
                    },
                    stackable: true,
                    maxStack: 1
                }
            }
        };
    }

    // 2. CAMBIAR LA FUNCIÓN hasRequiredMaterials por:
    hasRequiredMaterials(userItems, ingredients) {
        for (const ingredient of ingredients) {
            const userQuantity = userItems[ingredient.id] || 0;
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
            newItems[ingredient.id] -= ingredient.quantity;
            if (newItems[ingredient.id] <= 0) {
                delete newItems[ingredient.id];
            }
        }
        
        return newItems;
    }
    
    async showCraftingRecipes(message) {
        try {
            const embed = {
                color: 0x9932cc,
                title: '🔨 **RECETAS DE CRAFTEO**',
                description: 'Usa `>craft <recipe_id>` para craftear un item',
                fields: []
            };
            
            Object.values(this.CRAFTING_RECIPES).forEach(recipe => {
                let requirements = '';
                recipe.ingredients.forEach(ingredient => {
                    const item = this.shop.shopItems[ingredient.id];
                    if (item) {
                        requirements += `${item.emoji || '📦'} ${ingredient.quantity}x ${item.name}\n`;
                    } else {
                        requirements += `📦 ${ingredient.quantity}x ${ingredient.id}\n`;
                    }
                });
                
                const rarityEmoji = this.getRarityEmoji(recipe.result.rarity);
                
                embed.fields.push({
                    name: `\n${rarityEmoji} ${recipe.name} (ID: ${recipe.id})`,
                    value: `${recipe.description}\n**Materiales:**\n${requirements}\n\n`,
                    inline: false
                });
            });
            
            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error mostrando recetas:', error);
            message.reply('❌ Error al mostrar las recetas.');
        }
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
            
            const userData = await getUserData(message.author.id);
            if (!userData) {
                return message.reply('❌ Usuario no registrado.');
            }
            
            const userItems = userData.items || {};
            
            // Verificar materiales usando el nuevo formato
            if (!this.hasRequiredMaterials(userItems, recipe.ingredients)) {
                let missingMaterials = '';
                recipe.ingredients.forEach(ingredient => {
                    const userQuantity = userItems[ingredient.id] || 0;
                    const item = this.shop.shopItems[ingredient.id];
                    if (userQuantity < ingredient.quantity) {
                        const itemName = item ? item.name : ingredient.id;
                        const emoji = item ? item.emoji || '📦' : '📦';
                        missingMaterials += `${emoji} ${itemName}: ${userQuantity}/${ingredient.quantity}\n`;
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
            
            // Consumir materiales usando el nuevo formato
            const newItems = this.consumeMaterials(userItems, recipe.ingredients);
            
            // Agregar item crafteado
            const resultId = recipe.result.id;
            const quantity = 1; // Por defecto 1, pero podrías agregarlo al result si quieres
            
            if (newItems[resultId]) {
                newItems[resultId] += quantity;
            } else {
                newItems[resultId] = quantity;
            }
            
            // Actualizar inventario
            const success = await updateUserItems(message.author.id, newItems);
            
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
            }
            
        } catch (error) {
            console.error('Error crafteando item:', error);
            message.reply('❌ Error al procesar el crafteo.');
        }
    }
}

// 5. Exportar todos los sistemas
module.exports = {
    AuctionSystem,
    CraftingSystem
};
