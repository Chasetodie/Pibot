// 2. Sistema de intercambio entre usuarios
class TradeSystem {
    constructor(shopSystem) {
        this.shop = shopSystem;
        this.activeTrades = new Map(); // userId -> tradeData
    }
    
    async startTrade(message, targetUser, offerItems) {
        const userId = message.author.id;
        const targetId = targetUser.id;
        
        if (this.activeTrades.has(userId) || this.activeTrades.has(targetId)) {
            await message.reply('❌ Uno de los usuarios ya tiene un intercambio activo.');
            return;
        }
        
        const tradeId = `${userId}_${targetId}_${Date.now()}`;
        const tradeData = {
            id: tradeId,
            initiator: userId,
            target: targetId,
            initiatorOffer: offerItems,
            targetOffer: [],
            initiatorAccepted: false,
            targetAccepted: false,
            createdAt: Date.now(),
            channel: message.channel.id
        };
        
        this.activeTrades.set(userId, tradeData);
        this.activeTrades.set(targetId, tradeData);
        
        const embed = new EmbedBuilder()
            .setTitle('🔄 Intercambio Iniciado')
            .setDescription(`${message.author} quiere intercambiar con ${targetUser}`)
            .addFields(
                { name: '📦 Oferta de ' + message.author.displayName, value: this.formatItems(offerItems), inline: true },
                { name: '📦 Oferta de ' + targetUser.displayName, value: 'Esperando...', inline: true }
            )
            .setColor('#FFA500');
        
        await message.reply({ 
            content: `${targetUser}, tienes un intercambio pendiente. Usa \`>tradeadd <item>\` para agregar items.`,
            embeds: [embed] 
        });
    }
    
    formatItems(items) {
        if (items.length === 0) return 'Nada';
        return items.map(item => {
            const itemData = this.shop.shopItems[item.id];
            return `${itemData ? itemData.name : item.id} x${item.quantity}`;
        }).join('\n');
    }
    
    async completeTrade(tradeData) {
        const user1 = await this.shop.economy.getUser(tradeData.initiator);
        const user2 = await this.shop.economy.getUser(tradeData.target);
        
        // Transferir items
        const user1Items = { ...user1.items };
        const user2Items = { ...user2.items };
        
        // Remover items del iniciador y darlos al objetivo
        for (const offer of tradeData.initiatorOffer) {
            user1Items[offer.id].quantity -= offer.quantity;
            if (user1Items[offer.id].quantity <= 0) delete user1Items[offer.id];
            
            if (user2Items[offer.id]) {
                user2Items[offer.id].quantity += offer.quantity;
            } else {
                user2Items[offer.id] = { ...offer, purchaseDate: new Date().toISOString() };
            }
        }
        
        // Remover items del objetivo y darlos al iniciador
        for (const offer of tradeData.targetOffer) {
            user2Items[offer.id].quantity -= offer.quantity;
            if (user2Items[offer.id].quantity <= 0) delete user2Items[offer.id];
            
            if (user1Items[offer.id]) {
                user1Items[offer.id].quantity += offer.quantity;
            } else {
                user1Items[offer.id] = { ...offer, purchaseDate: new Date().toISOString() };
            }
        }
        
        // Actualizar base de datos
        await this.shop.economy.updateUser(tradeData.initiator, { items: user1Items });
        await this.shop.economy.updateUser(tradeData.target, { items: user2Items });
        
        // Limpiar intercambio
        this.activeTrades.delete(tradeData.initiator);
        this.activeTrades.delete(tradeData.target);
        
        return true;
    }
}

// 3. Sistema de subastas
class AuctionSystem {
    constructor(shopSystem) {
        this.shop = shopSystem;
        this.activeAuctions = new Map();
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
        
        this.activeAuctions.set(auctionId, auction);
        
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
        const auction = this.activeAuctions.get(auctionId);
        if (!auction || !auction.active) {
            await message.reply('❌ Subasta no encontrada o ya terminada.');
            return;
        }
        
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
    }
    
    async endAuction(auctionId) {
        const auction = this.activeAuctions.get(auctionId);
        if (!auction || !auction.active) return;
        
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
        
        this.activeAuctions.delete(auctionId);
    }
}

// 4. Sistema de crafteo
class CraftingSystem {
    constructor(shopSystem) {
        this.shop = shopSystem;
        
        this.recipes = {
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
            }
        };
    }
    
    async showRecipes(message) {
        const embed = new EmbedBuilder()
            .setTitle('🔨 Recetas de Crafteo')
            .setDescription('Combina items para crear otros más poderosos')
            .setColor('#8B4513');
        
        for (const recipe of Object.values(this.recipes)) {
            const ingredients = recipe.ingredients.map(ing => {
                const item = this.shop.shopItems[ing.id];
                return `${item ? item.name : ing.id} x${ing.quantity}`;
            }).join('\n');
            
            embed.addFields({
                name: `${this.shop.rarityEmojis[recipe.result.rarity]} ${recipe.name}`,
                value: `**Ingredientes:**\n${ingredients}\n\n${recipe.description}`,
                inline: false
            });
        }
        
        embed.setFooter({ text: 'Usa >craft <recipe_id> para craftear' });
        await message.reply({ embeds: [embed] });
    }
    
    async craftItem(message, recipeId) {
        const recipe = this.recipes[recipeId];
        if (!recipe) {
            await message.reply('❌ Receta no encontrada. Usa `>recipes` para ver las disponibles.');
            return;
        }
        
        const userId = message.author.id;
        const user = await this.shop.economy.getUser(userId);
        const userItems = user.items || {};
        
        // Verificar ingredientes
        for (const ingredient of recipe.ingredients) {
            const userItem = userItems[ingredient.id];
            if (!userItem || userItem.quantity < ingredient.quantity) {
                const item = this.shop.shopItems[ingredient.id];
                await message.reply(`❌ Te falta **${item ? item.name : ingredient.id} x${ingredient.quantity}**.`);
                return;
            }
        }
        
        // Consumir ingredientes
        const newItems = { ...userItems };
        for (const ingredient of recipe.ingredients) {
            newItems[ingredient.id].quantity -= ingredient.quantity;
            if (newItems[ingredient.id].quantity <= 0) {
                delete newItems[ingredient.id];
            }
        }
        
        // Crear item resultante
        if (newItems[recipe.id]) {
            newItems[recipe.id].quantity += 1;
        } else {
            newItems[recipe.id] = {
                id: recipe.id,
                quantity: 1,
                purchaseDate: new Date().toISOString()
            };
        }
        
        // Agregar receta a la tienda temporalmente
        this.shop.shopItems[recipe.id] = {
            ...recipe.result,
            name: recipe.name,
            description: recipe.description,
            price: 0 // No se puede comprar, solo craftear
        };
        
        await this.shop.economy.updateUser(userId, { items: newItems });
        
        const embed = new EmbedBuilder()
            .setTitle('🔨 ¡Crafteo Exitoso!')
            .setDescription(`Has creado: ${this.shop.rarityEmojis[recipe.result.rarity]} **${recipe.name}**`)
            .setColor(this.shop.rarityColors[recipe.result.rarity])
            .addFields({ name: '📝 Descripción', value: recipe.description, inline: false })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    }
}

// 5. Exportar todos los sistemas
module.exports = {
    TradeSystem,
    AuctionSystem,
    CraftingSystem
};