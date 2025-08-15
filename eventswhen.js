// ===================================
// MÉTODO CON event.type (RECOMENDADO) ✅
// ===================================

// ===================================
// EVENTO 1: ⚡ DOUBLE XP - Sistema de Mensajes
// ===================================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const userId = message.author.id;
    const baseXp = 10;
    let finalXp = baseXp;
    let eventApplied = null;
    
    // Verificar eventos activos que afecten XP
    for (const event of eventsSystem.getActiveEvents()) {
        if (event.type === 'double_xp' && event.multipliers.xp) {
            // ⚡ SOLO Double XP para mensajes
            finalXp = baseXp * event.multipliers.xp; // x2
            eventApplied = event;
            break; // Solo aplicar un evento de XP
        }
        else if (event.type === 'fever_time' && event.multipliers.xp) {
            // 🔥 Fever Time también da XP bonus en mensajes
            finalXp = Math.floor(baseXp * event.multipliers.xp); // x1.5
            eventApplied = event;
            break;
        }
        else if (event.type === 'server_anniversary' && event.multipliers.xp) {
            // 🎉 Aniversario da mega bonus
            finalXp = Math.floor(baseXp * event.multipliers.xp); // x3
            eventApplied = event;
            break;
        }
    }
    
    await economySystem.addXp(userId, finalXp);
    
    // Reaccionar si hubo evento
    if (eventApplied) {
        message.react(eventApplied.emoji);
    }
});

// ===================================
// EVENTO 2: 💰 MONEY RAIN - Comando !work
// ===================================

async function workCommand(message) {
    const userId = message.author.id;
    const baseEarnings = 500;
    let finalEarnings = baseEarnings;
    let eventMessage = '';
    
    // Verificar eventos que afecten trabajo
    for (const event of eventsSystem.getActiveEvents()) {
        if (event.type === 'money_rain' && event.multipliers.work) {
            // 💰 Money Rain afecta trabajo
            finalEarnings = Math.floor(baseEarnings * event.multipliers.work); // x1.5
            const bonus = finalEarnings - baseEarnings;
            eventMessage = `\n💰 **${event.name}** te dio +${bonus} π-b$ extra!`;
            break;
        }
        else if (event.type === 'fever_time' && event.multipliers.work) {
            // 🔥 Fever Time también afecta trabajo
            finalEarnings = Math.floor(baseEarnings * event.multipliers.work); // x1.3
            const bonus = finalEarnings - baseEarnings;
            eventMessage = `\n🔥 **${event.name}** te dio +${bonus} π-b$ extra!`;
            break;
        }
        else if (event.type === 'market_crash' && event.multipliers.work) {
            // 📉 Market Crash REDUCE las ganancias de trabajo
            finalEarnings = Math.floor(baseEarnings * event.multipliers.work); // x0.7
            const loss = baseEarnings - finalEarnings;
            eventMessage = `\n📉 **${event.name}** redujo tus ganancias en ${loss} π-b$`;
            break;
        }
        else if (event.type === 'server_anniversary' && event.multipliers.work) {
            // 🎉 Aniversario da mega bonus
            finalEarnings = Math.floor(baseEarnings * event.multipliers.work); // x2
            const bonus = finalEarnings - baseEarnings;
            eventMessage = `\n🎉 **${event.name}** ¡Mega bonus de +${bonus} π-b$!`;
            break;
        }
    }
    
    await economySystem.addMoney(userId, finalEarnings);
    message.reply(`💼 Trabajaste y ganaste **${finalEarnings} π-b$**${eventMessage}`);
}

// ===================================
// EVENTO 3: 💰 MONEY RAIN - Comando !daily
// ===================================

async function dailyCommand(message) {
    const userId = message.author.id;
    const baseDaily = 1000;
    let finalDaily = baseDaily;
    let eventMessage = '';
    
    // Verificar eventos que afecten daily
    for (const event of eventsSystem.getActiveEvents()) {
        if (event.type === 'money_rain' && event.multipliers.daily) {
            // 💰 Money Rain da más daily
            finalDaily = Math.floor(baseDaily * event.multipliers.daily); // x1.75
            const bonus = finalDaily - baseDaily;
            eventMessage = `\n💰 **${event.name}** te dio +${bonus} π-b$ extra!`;
            break;
        }
        else if (event.type === 'market_crash' && event.multipliers.daily) {
            // 📉 Market Crash reduce daily
            finalDaily = Math.floor(baseDaily * event.multipliers.daily); // x0.8
            const loss = baseDaily - finalDaily;
            eventMessage = `\n📉 **${event.name}** redujo tu daily en ${loss} π-b$`;
            break;
        }
        else if (event.type === 'server_anniversary' && event.multipliers.daily) {
            // 🎉 Aniversario mega bonus
            finalDaily = Math.floor(baseDaily * event.multipliers.daily); // x2
            const bonus = finalDaily - baseDaily;
            eventMessage = `\n🎉 **${event.name}** ¡Mega daily de +${bonus} π-b$!`;
            break;
        }
    }
    
    await economySystem.addMoney(userId, finalDaily);
    message.reply(`🎁 Daily reclamado: **${finalDaily} π-b$**${eventMessage}`);
}

// ===================================
// EVENTO 4: 🍀 LUCKY HOUR - Juegos de Azar
// ===================================

async function coinflipCommand(message, args) {
    const userId = message.author.id;
    const betAmount = parseInt(args[0]);
    
    let winChance = 0.5; // 50% base
    let luckBonus = false;
    
    // Verificar eventos que afecten suerte
    for (const event of eventsSystem.getActiveEvents()) {
        if (event.type === 'lucky_hour' && event.multipliers.luck) {
            // 🍀 Lucky Hour mejora probabilidades
            winChance *= event.multipliers.luck; // x1.3 = 65%
            luckBonus = true;
            break;
        }
        else if (event.type === 'fever_time') {
            // 🔥 Fever Time podría tener efecto menor en suerte
            winChance *= 1.1; // +10% menor que lucky hour
            luckBonus = true;
            break;
        }
    }
    
    const won = Math.random() < winChance;
    
    if (won) {
        await economySystem.addMoney(userId, betAmount);
        let response = `🎰 ¡Ganaste ${betAmount} π-b$!`;
        if (luckBonus) {
            response += `\n🍀 ¡La suerte estuvo de tu lado! (${Math.round(winChance * 100)}% probabilidad)`;
        }
        message.reply(response);
    } else {
        await economySystem.removeMoney(userId, betAmount);
        message.reply(`💸 Perdiste ${betAmount} π-b$...`);
    }
}

// ===================================
// EVENTO 5: 🔥 FEVER TIME - Cooldowns
// ===================================

async function anyCooldownCommand(message, commandName) {
    const userId = message.author.id;
    const baseCooldown = 600000; // 10 minutos
    let finalCooldown = baseCooldown;
    let cooldownReduced = false;
    
    // Verificar eventos que afecten cooldowns
    for (const event of eventsSystem.getActiveEvents()) {
        if (event.type === 'fever_time' && event.multipliers.cooldown) {
            // 🔥 Fever Time reduce cooldowns
            finalCooldown = Math.floor(baseCooldown * event.multipliers.cooldown); // x0.5
            cooldownReduced = true;
            break;
        }
        // Podrías agregar otros eventos que afecten cooldowns
    }
    
    // Aplicar cooldown
    cooldownSystem.setCooldown(userId, finalCooldown);
    
    if (cooldownReduced) {
        const savedTime = Math.floor((baseCooldown - finalCooldown) / 60000); // en minutos
        message.reply(`🔥 **Fever Time** redujo tu cooldown en ${savedTime} minutos!`);
    }
}

// ===================================
// EVENTO 6: 📉 MARKET CRASH - Gambling Bonus
// ===================================

async function slotsCommand(message, args) {
    const userId = message.author.id;
    const betAmount = parseInt(args[0]);
    
    // Lógica normal de slots...
    const won = Math.random() < 0.3; // 30% base
    
    if (won) {
        let winnings = betAmount * 2; // Ganancia base
        let crashBonus = false;
        
        // Verificar si Market Crash está activo
        for (const event of eventsSystem.getActiveEvents()) {
            if (event.type === 'market_crash' && event.multipliers.gambling) {
                // 📉 Durante crisis, gambling da más
                winnings = Math.floor(winnings * event.multipliers.gambling); // x1.5
                crashBonus = true;
                break;
            }
        }
        
        await economySystem.addMoney(userId, winnings);
        
        let response = `🎰 ¡Ganaste ${winnings} π-b$!`;
        if (crashBonus) {
            response += `\n📉 **Crisis del Mercado** aumentó tus ganancias de gambling!`;
        }
        message.reply(response);
    }
}

// ===================================
// EVENTO 7: 🗺️ TREASURE HUNT - En Cualquier Comando
// ===================================

async function anyCommand(message) {
    const userId = message.author.id;
    
    // Hacer la lógica normal del comando...
    // ... tu código actual aquí ...
    
    // Al final, verificar si hay treasure hunt
    for (const event of eventsSystem.getActiveEvents()) {
        if (event.type === 'treasure_hunt') {
            // 🗺️ Hay búsqueda de tesoro activa
            const treasures = await eventsSystem.checkSpecialEvents(userId, 'general');
            
            for (const treasure of treasures) {
                if (treasure.type === 'treasure') {
                    message.followUp(`🗺️ **¡Tesoro encontrado!**\n${treasure.description}`);
                }
            }
            break; // Solo verificar una vez
        }
    }
}

// ===================================
// PLANTILLA UNIVERSAL SIMPLIFICADA
// ===================================

function checkEventForCommand(eventsSystem, commandType, valueType, baseValue) {
    let finalValue = baseValue;
    let appliedEvent = null;
    
    for (const event of eventsSystem.getActiveEvents()) {
        switch (event.type) {
            case 'double_xp':
                if (commandType === 'message' && valueType === 'xp') {
                    finalValue = baseValue * 2;
                    appliedEvent = event;
                }
                break;
                
            case 'money_rain':
                if ((commandType === 'work' || commandType === 'daily') && valueType === 'money') {
                    const multiplier = event.multipliers[commandType];
                    if (multiplier) {
                        finalValue = Math.floor(baseValue * multiplier);
                        appliedEvent = event;
                    }
                }
                break;
                
            case 'lucky_hour':
                if (commandType === 'gambling' && valueType === 'luck') {
                    finalValue = baseValue * event.multipliers.luck;
                    appliedEvent = event;
                }
                break;
                
            case 'fever_time':
                // Fever Time tiene múltiples efectos
                if (valueType === 'xp' && event.multipliers.xp) {
                    finalValue = Math.floor(baseValue * event.multipliers.xp);
                    appliedEvent = event;
                } else if (commandType === 'work' && valueType === 'money' && event.multipliers.work) {
                    finalValue = Math.floor(baseValue * event.multipliers.work);
                    appliedEvent = event;
                } else if (valueType === 'cooldown' && event.multipliers.cooldown) {
                    finalValue = Math.floor(baseValue * event.multipliers.cooldown);
                    appliedEvent = event;
                }
                break;
                
            case 'market_crash':
                if (valueType === 'money') {
                    if ((commandType === 'work' && event.multipliers.work) ||
                        (commandType === 'daily' && event.multipliers.daily) ||
                        (commandType === 'gambling' && event.multipliers.gambling)) {
                        finalValue = Math.floor(baseValue * event.multipliers[commandType]);
                        appliedEvent = event;
                    }
                }
                break;
                
            case 'treasure_hunt':
                // Treasure Hunt se maneja por separado con checkSpecialEvents()
                break;
                
            case 'server_anniversary':
                // Aniversario afecta TODO
                if (event.multipliers[valueType]) {
                    finalValue = Math.floor(baseValue * event.multipliers[valueType]);
                    appliedEvent = event;
                }
                break;
        }
        
        // Si ya se aplicó un evento, salir del loop
        if (appliedEvent) break;
    }
    
    return {
        originalValue: baseValue,
        finalValue: finalValue,
        appliedEvent: appliedEvent
    };
}

// ===================================
// IMPLEMENTACIÓN EN COMANDOS ESPECÍFICOS
// ===================================

// 💬 MENSAJES - XP
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const userId = message.author.id;
    const baseXp = 10;
    let finalXp = baseXp;
    let eventEmoji = null;
    
    for (const event of eventsSystem.getActiveEvents()) {
        if (event.type === 'double_xp') {
            finalXp = baseXp * 2; // ⚡ Exactamente x2
            eventEmoji = '⚡';
            break;
        }
        else if (event.type === 'fever_time') {
            finalXp = Math.floor(baseXp * 1.5); // 🔥 x1.5
            eventEmoji = '🔥';
            break;
        }
    }
    
    await economySystem.addXp(userId, finalXp);
    
    if (eventEmoji) {
        message.react(eventEmoji);
    }
});

// 💼 TRABAJO
async function workCommand(message) {
    const userId = message.author.id;
    const baseEarnings = 500;
    let finalEarnings = baseEarnings;
    let eventMessage = '';
    
    for (const event of eventsSystem.getActiveEvents()) {
        if (event.type === 'money_rain') {
            finalEarnings = Math.floor(baseEarnings * 1.5); // 💰 +50%
            eventMessage = `\n💰 **Lluvia de Dinero** (+${finalEarnings - baseEarnings} π-b$)`;
            break;
        }
        else if (event.type === 'fever_time') {
            finalEarnings = Math.floor(baseEarnings * 1.3); // 🔥 +30%
            eventMessage = `\n🔥 **Tiempo Fiebre** (+${finalEarnings - baseEarnings} π-b$)`;
            break;
        }
        else if (event.type === 'market_crash') {
            finalEarnings = Math.floor(baseEarnings * 0.7); // 📉 -30%
            eventMessage = `\n📉 **Crisis del Mercado** (-${baseEarnings - finalEarnings} π-b$)`;
            break;
        }
    }
    
    await economySystem.addMoney(userId, finalEarnings);
    message.reply(`💼 Trabajaste y ganaste **${finalEarnings} π-b$**${eventMessage}`);
}

// 🎁 DAILY
async function dailyCommand(message) {
    const userId = message.author.id;
    const baseDaily = 1000;
    let finalDaily = baseDaily;
    let eventMessage = '';
    
    for (const event of eventsSystem.getActiveEvents()) {
        if (event.type === 'money_rain') {
            finalDaily = Math.floor(baseDaily * 1.75); // 💰 +75%
            eventMessage = `\n💰 **Lluvia de Dinero** (+${finalDaily - baseDaily} π-b$)`;
            break;
        }
        else if (event.type === 'market_crash') {
            finalDaily = Math.floor(baseDaily * 0.8); // 📉 -20%
            eventMessage = `\n📉 **Crisis del Mercado** (-${baseDaily - finalDaily} π-b$)`;
            break;
        }
    }
    
    await economySystem.addMoney(userId, finalDaily);
    message.reply(`🎁 Daily reclamado: **${finalDaily} π-b$**${eventMessage}`);
}

// 🎰 JUEGOS DE AZAR
async function gamblingCommand(message, betAmount) {
    const userId = message.author.id;
    let winChance = 0.5; // 50% base
    let luckMessage = '';
    
    for (const event of eventsSystem.getActiveEvents()) {
        if (event.type === 'lucky_hour') {
            winChance *= 1.3; // 🍀 +30% probabilidad
            luckMessage = `\n🍀 **Hora de la Suerte** (${Math.round(winChance * 100)}% probabilidad)`;
            break;
        }
    }
    
    const won = Math.random() < winChance;
    
    if (won) {
        // Verificar si ganancias se aumentan por otros eventos
        let winnings = betAmount;
        
        for (const event of eventsSystem.getActiveEvents()) {
            if (event.type === 'market_crash') {
                winnings = Math.floor(betAmount * 1.5); // 📉 +50% ganancias en crisis
                luckMessage += `\n📉 **Crisis del Mercado** aumentó tus ganancias!`;
                break;
            }
        }
        
        await economySystem.addMoney(userId, winnings);
        message.reply(`🎰 ¡Ganaste ${winnings} π-b$!${luckMessage}`);
    } else {
        await economySystem.removeMoney(userId, betAmount);
        message.reply(`💸 Perdiste ${betAmount} π-b$...${luckMessage}`);
    }
}

// ⏰ COOLDOWNS
function setCooldownWithEvents(userId, baseCooldown, commandName) {
    let finalCooldown = baseCooldown;
    let cooldownReduced = false;
    
    for (const event of eventsSystem.getActiveEvents()) {
        if (event.type === 'fever_time' && event.multipliers.cooldown) {
            finalCooldown = Math.floor(baseCooldown * 0.5); // 🔥 -50% tiempo
            cooldownReduced = true;
            break;
        }
    }
    
    cooldownSystem.setCooldown(userId, finalCooldown);
    
    if (cooldownReduced) {
        const savedMinutes = Math.floor((baseCooldown - finalCooldown) / 60000);
        return `🔥 **Fever Time** redujo tu cooldown en ${savedMinutes} minutos!`;
    }
    
    return null;
}

// 🗺️ TREASURE HUNT (se verifica automáticamente)
async function anyCommandWithTreasures(message, userId) {
    // Tu lógica normal del comando...
    
    // Verificar tesoros al final
    for (const event of eventsSystem.getActiveEvents()) {
        if (event.type === 'treasure_hunt') {
            const treasures = await eventsSystem.checkSpecialEvents(userId, 'general');
            
            for (const treasure of treasures) {
                if (treasure.type === 'treasure') {
                    message.followUp(`🗺️ **¡Tesoro encontrado!**\n${treasure.description}`);
                }
            }
            break;
        }
    }
}

// ===================================
// EJEMPLO DE USO COMPLETO
// ===================================

client.on('messageCreate', async (message) => {
    if (message.content === '!work') {
        const userId = message.author.id;
        const baseEarnings = 500;
        let finalEarnings = baseEarnings;
        let eventMessages = [];
        
        // Verificar TODOS los eventos activos uno por uno
        for (const event of eventsSystem.getActiveEvents()) {
            if (event.type === 'money_rain' && event.multipliers.work) {
                finalEarnings = Math.floor(baseEarnings * event.multipliers.work);
                eventMessages.push(`💰 **Lluvia de Dinero** (+${finalEarnings - baseEarnings} π-b$)`);
            }
            else if (event.type === 'fever_time' && event.multipliers.work) {
                finalEarnings = Math.floor(baseEarnings * event.multipliers.work);
                eventMessages.push(`🔥 **Tiempo Fiebre** (+${finalEarnings - baseEarnings} π-b$)`);
            }
            else if (event.type === 'market_crash' && event.multipliers.work) {
                finalEarnings = Math.floor(baseEarnings * event.multipliers.work);
                eventMessages.push(`📉 **Crisis del Mercado** (-${baseEarnings - finalEarnings} π-b$)`);
            }
            
            // Verificar treasure hunt por separado
            if (event.type === 'treasure_hunt') {
                const treasures = await eventsSystem.checkSpecialEvents(userId, 'work');
                for (const treasure of treasures) {
                    if (treasure.type === 'treasure') {
                        eventMessages.push(`🗺️ **¡Tesoro encontrado!** ${treasure.description}`);
                    }
                }
            }
        }
        
        await economySystem.addMoney(userId, finalEarnings);
        
        let response = `💼 Trabajaste y ganaste **${finalEarnings} π-b$**`;
        if (eventMessages.length > 0) {
            response += `\n\n${eventMessages.join('\n')}`;
        }
        
        message.reply(response);
    }
});