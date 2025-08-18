// items.js - Sistema para usar items
const { createClient } = require('@supabase/supabase-js');
const { SHOP_ITEMS, getUserData, updateUserItems } = require('./shop');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Efectos activos (se guardará en memoria durante la sesión)
let activeEffects = new Map();

// Función para aplicar efectos de items
async function applyItemEffect(userId, item, message) {
    try {
        switch (item.effect) {
            case 'heal':
                await healUser(userId, item.value, message);
                break;
            
            case 'mana':
                await restoreMana(userId, item.value, message);
                break;
            
            case 'xp_boost':
                await applyXPBoost(userId, item, message);
                break;
            
            case 'attack_boost':
                await applyStatBoost(userId, 'attack', item.value, message);
                break;
            
            case 'defense_boost':
                await applyStatBoost(userId, 'defense', item.value, message);
                break;
            
            case 'unlock_chest':
                await unlockChest(userId, message);
                break;
            
            default:
                message.reply('❌ Este item no se puede usar aún.');
                return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error aplicando efecto:', error);
        return false;
    }
}

// Función para curar al usuario
async function healUser(userId, amount, message) {
    try {
        const userData = await getUserData(userId);
        if (!userData) return;
        
        const maxHp = userData.max_hp || 100;
        const currentHp = userData.hp || maxHp;
        const newHp = Math.min(currentHp + amount, maxHp);
        
        const { error } = await supabase
            .from('users')
            .update({ hp: newHp })
            .eq('user_id', userId);
        
        if (error) throw error;
        
        const embed = {
            color: 0x00ff00,
            title: '💚 **CURACIÓN EXITOSA**',
            description: `Has recuperado ${newHp - currentHp} HP`,
            fields: [
                {
                    name: '❤️ HP Actual',
                    value: `${newHp}/${maxHp}`,
                    inline: true
                }
            ]
        };
        
        await message.channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error curando usuario:', error);
    }
}

// Función para restaurar maná
async function restoreMana(userId, amount, message) {
    try {
        const userData = await getUserData(userId);
        if (!userData) return;
        
        const maxMp = userData.max_mp || 50;
        const currentMp = userData.mp || maxMp;
        const newMp = Math.min(currentMp + amount, maxMp);
        
        const { error } = await supabase
            .from('users')
            .update({ mp: newMp })
            .eq('user_id', userId);
        
        if (error) throw error;
        
        const embed = {
            color: 0x0099ff,
            title: '💙 **MANÁ RESTAURADO**',
            description: `Has recuperado ${newMp - currentMp} MP`,
            fields: [
                {
                    name: '🔮 MP Actual',
                    value: `${newMp}/${maxMp}`,
                    inline: true
                }
            ]
        };
        
        await message.channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error restaurando maná:', error);
    }
}

// Función para aplicar boost de XP
async function applyXPBoost(userId, item, message) {
    try {
        const effectKey = `${userId}_xp_boost`;
        
        // Si ya tiene un boost activo, extender el tiempo
        if (activeEffects.has(effectKey)) {
            const currentEffect = activeEffects.get(effectKey);
            clearTimeout(currentEffect.timeout);
            currentEffect.endTime += item.duration;
            
            currentEffect.timeout = setTimeout(() => {
                activeEffects.delete(effectKey);
                message.channel.send(`⭐ <@${userId}> Tu boost de XP ha expirado.`);
            }, currentEffect.endTime - Date.now());
            
        } else {
            // Crear nuevo boost
            const endTime = Date.now() + item.duration;
            const timeout = setTimeout(() => {
                activeEffects.delete(effectKey);
                message.channel.send(`⭐ <@${userId}> Tu boost de XP ha expirado.`);
            }, item.duration);
            
            activeEffects.set(effectKey, {
                multiplier: item.multiplier,
                endTime: endTime,
                timeout: timeout
            });
        }
        
        const embed = {
            color: 0xffd700,
            title: '⭐ **BOOST DE XP ACTIVADO**',
            description: `XP multiplicado por ${item.multiplier}x durante 1 hora`,
            fields: [
                {
                    name: '⏰ Duración',
                    value: '1 hora',
                    inline: true
                }
            ]
        };
        
        await message.channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error aplicando XP boost:', error);
    }
}

// Función para aplicar boost de estadísticas
async function applyStatBoost(userId, stat, value, message) {
    try {
        const userData = await getUserData(userId);
        if (!userData) return;
        
        const currentValue = userData[stat] || 0;
        const newValue = currentValue + value;
        
        const updateData = {};
        updateData[stat] = newValue;
        
        const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('user_id', userId);
        
        if (error) throw error;
        
        const statNames = {
            attack: 'Ataque',
            defense: 'Defensa'
        };
        
        const embed = {
            color: 0xff6600,
            title: '💪 **ESTADÍSTICA MEJORADA**',
            description: `Tu ${statNames[stat]} ha aumentado en ${value}`,
            fields: [
                {
                    name: `📊 ${statNames[stat]} Actual`,
                    value: newValue.toString(),
                    inline: true
                }
            ]
        };
        
        await message.channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error aplicando stat boost:', error);
    }
}

// Función para desbloquear cofre
async function unlockChest(userId, message) {
    try {
        const rewards = [100, 200, 300, 500]; // Posibles recompensas de monedas
        const reward = rewards[Math.floor(Math.random() * rewards.length)];
        
        const userData = await getUserData(userId);
        if (!userData) return;
        
        const newCoins = userData.coins + reward;
        
        const { error } = await supabase
            .from('users')
            .update({ coins: newCoins })
            .eq('user_id', userId);
        
        if (error) throw error;
        
        const embed = {
            color: 0xffd700,
            title: '🏆 **COFRE DESBLOQUEADO**',
            description: `¡Has encontrado ${reward} monedas!`,
            fields: [
                {
                    name: '💰 Monedas Totales',
                    value: newCoins.toString(),
                    inline: true
                }
            ]
        };
        
        await message.channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error desbloqueando cofre:', error);
    }
}

// Comando principal para usar items
async function useItem(message, args) {
    try {
        if (!args[0]) {
            return message.reply('❌ Especifica el ID o nombre del item: `>useitem <id/nombre>`');
        }
        
        const userData = await getUserData(message.author.id);
        if (!userData) {
            return message.reply('❌ Usuario no registrado.');
        }
        
        const items = userData.items || {};
        let itemId = null;
        let item = null;
        
        // Buscar por ID
        if (!isNaN(args[0])) {
            itemId = parseInt(args[0]);
            item = SHOP_ITEMS[itemId];
        } else {
            // Buscar por nombre
            const itemName = args.join(' ').toLowerCase();
            for (const [id, shopItem] of Object.entries(SHOP_ITEMS)) {
                if (shopItem.name.toLowerCase().includes(itemName)) {
                    itemId = parseInt(id);
                    item = shopItem;
                    break;
                }
            }
        }
        
        if (!item) {
            return message.reply('❌ Item no encontrado.');
        }
        
        if (!items[itemId] || items[itemId] <= 0) {
            return message.reply('❌ No tienes este item en tu inventario.');
        }
        
        // Usar el item
        const effectApplied = await applyItemEffect(message.author.id, item, message);
        
        if (effectApplied) {
            // Reducir cantidad del item si es consumible
            if (item.type === 'consumable' || item.type === 'key') {
                items[itemId] -= 1;
                
                if (items[itemId] <= 0) {
                    delete items[itemId];
                }
                
                await updateUserItems(message.author.id, items);
            }
        }
        
    } catch (error) {
        console.error('Error usando item:', error);
        message.reply('❌ Error al usar el item.');
    }
}

// Función para verificar si un usuario tiene boost de XP activo
function getXPMultiplier(userId) {
    const effectKey = `${userId}_xp_boost`;
    if (activeEffects.has(effectKey)) {
        return activeEffects.get(effectKey).multiplier;
    }
    return 1;
}

// Función para limpiar efectos expirados (llamar periódicamente)
function cleanupExpiredEffects() {
    const now = Date.now();
    for (const [key, effect] of activeEffects.entries()) {
        if (effect.endTime <= now) {
            clearTimeout(effect.timeout);
            activeEffects.delete(key);
        }
    }
}

// Limpiar efectos cada 5 minutos
setInterval(cleanupExpiredEffects, 5 * 60 * 1000);

module.exports = {
    useItem,
    getXPMultiplier,
    activeEffects
};