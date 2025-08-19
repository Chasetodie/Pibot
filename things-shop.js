const { EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// 3. Sistema de subastas
class AuctionSystem {
    constructor(shopSystem) {
        this.shop = shopSystem;
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
    }

    async saveAuctionToDb(auction) {
        const { error } = await this.supabase
            .from('auctions')
            .insert({
                id: auction.id,
                seller: auction.seller,
                item_id: auction.itemId,
                item_name: auction.itemName,
                starting_bid: auction.currentBid,
                current_bid: auction.currentBid,
                highest_bidder: auction.highestBidder,
                bids: auction.bids,
                ends_at: new Date(auction.endsAt).toISOString()
            });
        
        return !error;
    }

    async updateBidInDb(auctionId, auction) {
        const { error } = await this.supabase
            .from('auctions')
            .update({
                current_bid: auction.currentBid,
                highest_bidder: auction.highestBidder,
                bids: auction.bids
            })
            .eq('id', auctionId);
        
        return !error;
    }

    async getAuctionFromDb(auctionId) {
        const { data } = await this.supabase
            .from('auctions')
            .select('*')
            .eq('id', auctionId)
            .eq('active', true)
            .single();
        
        return data;
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
            active: true
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
            .setFooter({ text: `ID: ${auctionId}` });
        
        await message.reply({ 
            content: `🔨 ¡Nueva subasta! Usa \`>bid ${auctionId} <cantidad>\` para pujar.`,
            embeds: [embed] 
        });
        
        // Programar fin de subasta
        setTimeout(() => this.endAuction(auctionId), duration);
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
    
    async endAuction(auctionId) {
        const auctionData = await this.getAuctionFromDb(auctionId);
        if (!auctionData || !auctionData.active) return;

        const auction = {
            ...auctionData,
            currentBid: auctionData.current_bid,
            highestBidder: auctionData.highest_bidder,
            itemId: auctionData.item_id,
            itemName: auctionData.item_name,
            seller: auctionData.seller
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
        
        await this.completeAuctionInDb(auctionId);
    }

    // 4. Agregar función para completar subasta:
    async completeAuctionInDb(auctionId) {
        const { error } = await this.supabase
            .from('auctions')
            .update({
                active: false,
                completed_at: new Date().toISOString()
            })
            .eq('id', auctionId);
        
        return !error;
    }

    // 5. Agregar función para listar subastas activas:
    async getActiveAuctions() {
        const { data } = await this.supabase
            .from('auctions')
            .select('*')
            .eq('active', true)
            .lt('ends_at', new Date().toISOString())
            .order('created_at', { ascending: false });
        
        return data || [];
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
                    { id: 'lucky_charm', quantity: 3 },
                    { id: 'double_xp_potion', quantity: 1 }
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
                    maxStack: 5
                }
            },
            'master_toolkit': {
                id: 'master_toolkit',
                name: '🔧⚡ Kit Maestro',
                description: 'Reduce todos los cooldowns permanentemente en 30%',
                ingredients: [
                    { id: 'work_boots', quantity: 1 },
                    { id: 'energy_drink', quantity: 5 },
                    { id: 'robbery_kit', quantity: 3 }
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
                description: 'Combina 3 amuletos de suerte para crear algo más poderoso',
                ingredients: [
                    { id: 'lucky_charm', quantity: 3 },
                    { id: 'energy_drink', quantity: 2 }
                ],
                result: {
                    id: 'mega_luck_potion',
                    category: 'consumable', 
                    rarity: 'epic',
                    effect: {
                        type: 'luck_boost',
                        targets: ['games', 'all'],
                        boost: 0.25,
                        duration: 3600
                    },
                    stackable: true,
                    maxStack: 5
                }
            },

            'speed_boots_craft': {
                id: 'speed_boots_craft',
                name: '👟⚡ Botas de Velocidad Supremas',
                description: 'Combina varios items para crear las botas definitivas',
                ingredients: [
                    { id: 'work_boots', quantity: 1 },
                    { id: 'energy_drink', quantity: 5 },
                    { id: 'robbery_kit', quantity: 3 }
                ],
                result: {
                    id: 'speed_boots',
                    category: 'consumable',
                    rarity: 'rare',
                    effect: {
                        type: 'no_cooldown',
                        targets: ['all'],
                        duration: 1200
                    },
                    stackable: true,
                    maxStack: 3
                }
            },

            'diamond_membership_craft': {
                id: 'diamond_membership_craft',
                name: '💎👑 Membresía Diamante',
                description: 'El item más exclusivo - requiere muchos recursos',
                ingredients: [
                    { id: 'vip_pass', quantity: 1 },
                    { id: 'money_magnet', quantity: 1 },
                    { id: 'golden_trophy', quantity: 2 },
                    { id: 'premium_mystery_box', quantity: 3 }
                ],
                result: {
                    id: 'diamond_membership',
                    category: 'permanent',
                    rarity: 'legendary',
                    effect: {
                        type: 'vip_membership',
                        duration: 30 * 24 * 60 * 60 * 1000,
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
                    { id: 'double_xp_potion', quantity: 4 },
                    { id: 'lucky_charm', quantity: 2 }
                ],
                result: {
                    id: 'xp_tornado',
                    category: 'consumable',
                    rarity: 'epic',
                    effect: {
                        type: 'xp_multiplier',
                        targets: ['all'],
                        multiplier: 5.0,
                        duration: 900
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
                    { id: 'work_boots', quantity: 2 },
                    { id: 'money_magnet', quantity: 1 },
                    { id: 'lucky_charm', quantity: 3 }
                ],
                result: {
                    id: 'golden_pickaxe',
                    category: 'consumable',
                    rarity: 'rare',
                    effect: {
                        type: 'work_multiplier',
                        targets: ['work'],
                        multiplier: 3.0,
                        uses: 3
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
                    { id: 'golden_trophy', quantity: 1 }
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

            'master_toolkit': {
                id: 'master_toolkit',
                name: '🔧⚡ Kit Maestro',
                description: 'Reduce todos los cooldowns permanentemente en 30%',
                ingredients: [
                    { id: 'work_boots', quantity: 1 },
                    { id: 'energy_drink', quantity: 5 },
                    { id: 'robbery_kit', quantity: 3 }
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
                    name: `${rarityEmoji} ${recipe.name} (ID: ${recipe.id})`,
                    value: `${recipe.description}\n**Materiales:**\n${requirements}\n`,
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
