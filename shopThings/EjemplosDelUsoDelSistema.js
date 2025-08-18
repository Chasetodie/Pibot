// === EJEMPLOS DE USO COMPLETO ===

// 1. En tu procesador principal de mensajes
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const args = message.content.toLowerCase().split(' ');
    const command = args[0];
    
    try {
        // Procesar comandos de economía (modificados con shop)
        switch (command) {
            case '>work':
                await enhancedWorkCommand(message);
                break;
                
            case '>daily':
                await enhancedDailyCommand(message);
                break;
                
            case '>gamble':
            case '>bet':
                if (!args[1]) {
                    await message.reply('❌ Especifica la cantidad. Ejemplo: `>bet 500`');
                    return;
                }
                await enhancedGambleCommand(message, parseInt(args[1]));
                break;
                
            case '>profile':
            case '>perfil':
                let target = message.mentions.users.first() || message.author;
                await enhancedProfileCommand(message, target);
                break;
                
            // Comandos administrativos
            case '>giveitem':
                if (message.member.permissions.has('ADMINISTRATOR')) {
                    await giveItemCommand(message, args);
                }
                break;
                
            case '>shopstats':
                if (message.member.permissions.has('ADMINISTRATOR')) {
                    await shopStatsCommand(message);
                }
                break;
        }
        
        // Procesar comandos de tienda
        await shop.processCommand(message);
        
        // Procesar comandos de misiones
        await missions.processCommand(message);
        
        // Actualizar progreso de misiones por mensaje
        const completedMissions = await missions.updateMissionProgress(message.author.id, 'message');
        await missions.notifyCompletedMissions(message, completedMissions);
        
    } catch (error) {
        console.error('❌ Error procesando comando:', error);
        await message.reply('❌ Ocurrió un error inesperado. Intenta de nuevo.');
    }
});

// 2. Comando de trabajo mejorado con items
async function enhancedWorkCommand(message) {
    const userId = message.author.id;
    const user = await economy.getUser(userId);
    
    // Obtener modificadores de items
    const modifiers = await shop.getActiveMultipliers(userId, 'work');
    
    // Calcular cooldown con reducción por items
    const baseCooldown = 3600000; // 1 hora
    let actualCooldown = baseCooldown * (1 - modifiers.reduction);
    
    // Aplicar reducción permanente de botas de trabajo
    const permanentEffects = user.permanentEffects || {};
    for (const effect of Object.values(permanentEffects)) {
        if (effect.type === 'permanent_cooldown' && effect.targets.includes('work')) {
            actualCooldown *= (1 - effect.reduction);
        }
    }
    
    const now = Date.now();
    const lastWork = user.lastWork || 0;
    
    if (now - lastWork < actualCooldown) {
        const timeLeft = actualCooldown - (now - lastWork);
        const minutes = Math.ceil(timeLeft / 60000);
        await message.reply(`⏰ Debes esperar **${minutes} minutos** antes de trabajar otra vez.`);
        return;
    }
    
    // Generar trabajo aleatorio
    const jobs = [
        { name: 'programar', emoji: '💻', min: 300, max: 800 },
        { name: 'cocinar', emoji: '👨‍🍳', min: 250, max: 600 },
        { name: 'enseñar', emoji: '👨‍🏫', min: 400, max: 700 },
        { name: 'construir', emoji: '👷', min: 350, max: 750 }
    ];
    
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const baseEarnings = Math.floor(Math.random() * (job.max - job.min)) + job.min;
    
    // Aplicar multiplicadores de items
    let finalEarnings = Math.floor(baseEarnings * modifiers.multiplier);
    
    // Aplicar multiplicadores permanentes
    for (const effect of Object.values(permanentEffects)) {
        if (effect.type === 'permanent_multiplier' && 
            (effect.targets.includes('all') || effect.targets.includes('work'))) {
            finalEarnings = Math.floor(finalEarnings * effect.multiplier);
        }
    }
    
    // Consumir efectos de uso limitado
    await shop.consumeUsageEffects(userId, 'work');
    
    // Actualizar usuario
    await economy.updateUser(userId, {
        balance: user.balance + finalEarnings,
        lastWork: now
    });
    
    // XP con multiplicadores
    const xpResult = await economy.addXp(userId, 50);
    
    // Actualizar misiones
    const completedMissions = await missions.updateMissionProgress(userId, 'work');
    await missions.updateMissionProgress(userId, 'money_earned', finalEarnings);
    
    // Crear embed de respuesta
    const embed = new EmbedBuilder()
        .setTitle(`${job.emoji} ¡Trabajo Completado!`)
        .setDescription(`Trabajaste ${job.name} y ganaste dinero.`)
        .setColor('#00FF00')
        .addFields(
            { name: '💰 Ganancias', value: `${finalEarnings.toLocaleString('es-ES')} π-b$`, inline: true },
            { name: '⭐ XP Ganada', value: `+${xpResult.xpGained} XP`, inline: true }
        );
    
    // Mostrar bonificaciones
    if (modifiers.multiplier > 1) {
        const bonus = finalEarnings - baseEarnings;
        embed.addFields({ 
            name: '🍀 Bonificación por Items', 
            value: `+${bonus} π-b$ (x${modifiers.multiplier.toFixed(1)})`, 
            inline: false 
        });
    }
    
    if (modifiers.reduction > 0) {
        embed.addFields({ 
            name: '⚡ Cooldown Reducido', 
            value: `${(modifiers.reduction * 100).toFixed(0)}% menos tiempo de espera`, 
            inline: false 
        });
    }
    
    if (xpResult.levelUp) {
        embed.addFields({ 
            name: '🎉 ¡Subiste de Nivel!', 
            value: `Ahora eres nivel **${xpResult.newLevel}**`, 
            inline: false 
        });
    }
    
    await message.reply({ embeds: [embed] });
    await missions.notifyCompletedMissions(message, completedMissions);
}

// 4. Perfil mejorado con items equipados
async function enhancedProfileCommand(message, targetUser) {
    const userId = targetUser.id;
    const user = await economy.getUser(userId);
    
    const embed = new EmbedBuilder()
        .setTitle(`👤 Perfil de ${targetUser.displayName}`)
        .setColor('#4CAF50')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: '💰 Balance', value: `${(user.balance || 0).toLocaleString('es-ES')} π-b// === EJEMPLOS DE USO COMPLETO ===

// 1. En tu procesador principal de mensajes
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const args = message.content.toLowerCase().split(' ');
    const command = args[0];
    
    try {
        // Procesar comandos de economía (modificados con shop)
        switch (command) {
            case '>work':
                await enhancedWorkCommand(message);
                break;
                
            case '>daily':
                await enhancedDailyCommand(message);
                break;
                
            case '>gamble':
            case '>bet':
                if (!args[1]) {
                    await message.reply('❌ Especifica la cantidad. Ejemplo: `>bet 500`');
                    return;
                }
                await enhancedGambleCommand(message, parseInt(args[1]));
                break;
                
            case '>profile':
            case '>perfil':
                let target = message.mentions.users.first() || message.author;
                await enhancedProfileCommand(message, target);
                break;
                
            // Comandos administrativos
            case '>giveitem':
                if (message.member.permissions.has('ADMINISTRATOR')) {
                    await giveItemCommand(message, args);
                }
                break;
                
            case '>shopstats':
                if (message.member.permissions.has('ADMINISTRATOR')) {
                    await shopStatsCommand(message);
                }
                break;
        }
        
        // Procesar comandos de tienda
        await shop.processCommand(message);
        
        // Procesar comandos de misiones
        await missions.processCommand(message);
        
        // Actualizar progreso de misiones por mensaje
        const completedMissions = await missions.updateMissionProgress(message.author.id, 'message');
        await missions.notifyCompletedMissions(message, completedMissions);
        
    } catch (error) {
        console.error('❌ Error procesando comando:', error);
        await message.reply('❌ Ocurrió un error inesperado. Intenta de nuevo.');
    }
});

// 2. Comando de trabajo mejorado con items
async function enhancedWorkCommand(message) {
    const userId = message.author.id;
    const user = await economy.getUser(userId);
    
    // Obtener modificadores de items
    const modifiers = await shop.getActiveMultipliers(userId, 'work');
    
    // Calcular cooldown con reducción por items
    const baseCooldown = 3600000; // 1 hora
    let actualCooldown = baseCooldown * (1 - modifiers.reduction);
    
    // Aplicar reducción permanente de botas de trabajo
    const permanentEffects = user.permanentEffects || {};
    for (const effect of Object.values(permanentEffects)) {
        if (effect.type === 'permanent_cooldown' && effect.targets.includes('work')) {
            actualCooldown *= (1 - effect.reduction);
        }
    }
    
    const now = Date.now();
    const lastWork = user.lastWork || 0;
    
    if (now - lastWork < actualCooldown) {
        const timeLeft = actualCooldown - (now - lastWork);
        const minutes = Math.ceil(timeLeft / 60000);
        await message.reply(`⏰ Debes esperar **${minutes} minutos** antes de trabajar otra vez.`);
        return;
    }
    
    // Generar trabajo aleatorio
    const jobs = [
        { name: 'programar', emoji: '💻', min: 300, max: 800 },
        { name: 'cocinar', emoji: '👨‍🍳', min: 250, max: 600 },
        { name: 'enseñar', emoji: '👨‍🏫', min: 400, max: 700 },
        { name: 'construir', emoji: '👷', min: 350, max: 750 }
    ];
    
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const baseEarnings = Math.floor(Math.random() * (job.max - job.min)) + job.min;
    
    // Aplicar multiplicadores de items
    let finalEarnings = Math.floor(baseEarnings * modifiers.multiplier);
    
    // Aplicar multiplicadores permanentes
    for (const effect of Object.values(permanentEffects)) {
        if (effect.type === 'permanent_multiplier' && 
            (effect.targets.includes('all') || effect.targets.includes('work'))) {
            finalEarnings = Math.floor(finalEarnings * effect.multiplier);
        }
    }
    
    // Consumir efectos de uso limitado
    await shop.consumeUsageEffects(userId, 'work');
    
    // Actualizar usuario
    await economy.updateUser(userId, {
        balance: user.balance + finalEarnings,
        lastWork: now
    });
    
    // XP con multiplicadores
    const xpResult = await economy.addXp(userId, 50);
    
    // Actualizar misiones
    const completedMissions = await missions.updateMissionProgress(userId, 'work');
    await missions.updateMissionProgress(userId, 'money_earned', finalEarnings);
    
    // Crear embed de respuesta
    const embed = new EmbedBuilder()
        .setTitle(`${job.emoji} ¡Trabajo Completado!`)
        .setDescription(`Trabajaste ${job.name} y ganaste dinero.`)
        .setColor('#00FF00')
        .addFields(
            { name: '💰 Ganancias', value: `${finalEarnings.toLocaleString('es-ES')} π-b$`, inline: true },
            { name: '⭐ XP Ganada', value: `+${xpResult.xpGained} XP`, inline: true }
        );
    
    // Mostrar bonificaciones
    if (modifiers.multiplier > 1) {
        const bonus = finalEarnings - baseEarnings;
        embed.addFields({ 
            name: '🍀 Bonificación por Items', 
            value: `+${bonus} π-b$ (x${modifiers.multiplier.toFixed(1)})`, 
            inline: false 
        });
    }
    
    if (modifiers.reduction > 0) {
        embed.addFields({ 
            name: '⚡ Cooldown Reducido', 
            value: `${(modifiers.reduction * 100).toFixed(0)}% menos tiempo de espera`, 
            inline: false 
        });
    }
    
, inline: true },
            { name: '⭐ Nivel', value: `${user.level || 1}`, inline: true },
            { name: '🏆 XP', value: `${user.xp || 0}`, inline: true }
        );
    
    // Mostrar items cosméticos equipados
    const cosmetics = [];
    const userItems = user.items || {};
    const permanentEffects = user.permanentEffects || {};
    
    // Insignias y trofeos
    if (userItems['golden_trophy']) cosmetics.push('🏆 Trofeo Dorado');
    if (userItems['rainbow_badge']) cosmetics.push('🌈 Insignia Arcoíris');
    
    // Status VIP
    const hasVip = Object.values(permanentEffects).some(effect => 
        effect.benefits && effect.benefits.includes('vip_commands')
    );
    if (hasVip) cosmetics.push('👑 Usuario VIP');
    
    if (cosmetics.length > 0) {
        embed.addFields({ 
            name: '✨ Elementos Equipados', 
            value: cosmetics.join('\n'), 
            inline: false 
        });
    }
    
    // Mostrar efectos activos
    const activeEffects = user.activeEffects || {};
    const activeList = [];
    
    for (const [itemId, effects] of Object.entries(activeEffects)) {
        const item = shop.shopItems[itemId];
        if (!item) continue;
        
        for (const effect of effects) {
            if (effect.expiresAt && effect.expiresAt < Date.now()) continue;
            
            let timeText = '';
            if (effect.expiresAt) {
                const timeLeft = effect.expiresAt - Date.now();
                const minutes = Math.floor(timeLeft / 60000);
                const hours = Math.floor(minutes / 60);
                timeText = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
            } else if (effect.usesLeft) {
                timeText = `${effect.usesLeft} usos`;
            }
            
            activeList.push(`🔥 ${item.name}${timeText ? ` (${timeText})` : ''}`);
        }
    }
    
    if (activeList.length > 0) {
        embed.addFields({ 
            name: '⚡ Efectos Activos', 
            value: activeList.slice(0, 5).join('\n'), 
            inline: false 
        });
    }
    
    // Mostrar mejoras permanentes
    const permanentList = [];
    for (const [itemId, effect] of Object.entries(permanentEffects)) {
        const item = shop.shopItems[itemId];
        if (!item) continue;
        
        if (effect.type === 'permanent_multiplier') {
            const bonus = ((effect.multiplier - 1) * 100).toFixed(0);
            permanentList.push(`💎 ${item.name} (+${bonus}% ganancias)`);
        } else if (effect.type === 'permanent_cooldown') {
            const reduction = (effect.reduction * 100).toFixed(0);
            permanentList.push(`💎 ${item.name} (-${reduction}% cooldown)`);
        } else {
            permanentList.push(`💎 ${item.name}`);
        }
    }
    
    if (permanentList.length > 0) {
        embed.addFields({ 
            name: '💎 Mejoras Permanentes', 
            value: permanentList.slice(0, 3).join('\n'), 
            inline: false 
        });
    }
    
    embed.setTimestamp();
    await message.reply({ embeds: [embed] });
}

// 5. Sistema de apuestas mejorado con items
async function enhancedGambleCommand(message, amount) {
    const userId = message.author.id;
    const user = await economy.getUser(userId);
    
    if (amount < 100) {
        await message.reply('❌ La apuesta mínima es **100 π-b$**.');
        return;
    }
    
    if (user.balance < amount) {
        await message.reply(`❌ No tienes suficiente dinero. Balance: **${user.balance.toLocaleString('es-ES')} π-b$**.`);
        return;
    }
    
    // Verificar probabilidad base de ganar (45%)
    let winChance = 0.45;
    
    // Aplicar boost de kit de robo (si está disponible)
    const activeEffects = user.activeEffects || {};
    let hasBoost = false;
    
    for (const [itemId, effects] of Object.entries(activeEffects)) {
        for (const effect of effects) {
            if (effect.type === 'success_boost' && effect.targets.includes('robbery') && effect.usesLeft > 0) {
                winChance += effect.boost;
                hasBoost = true;
                break;
            }
        }
        if (hasBoost) break;
    }
    
    const won = Math.random() < winChance;
    let finalAmount = amount;
    
    if (won) {
        // Aplicar multiplicadores si ganó
        const modifiers = await shop.getActiveMultipliers(userId, 'gambling');
        finalAmount = Math.floor(amount * 1.8 * modifiers.multiplier); // Base: 80% ganancia
        
        await economy.updateUser(userId, {
            balance: user.balance + finalAmount - amount
        });
        
        // Actualizar misiones
        await missions.updateMissionProgress(userId, 'bet_won');
        await missions.updateMissionProgress(userId, 'money_earned', finalAmount - amount);
    } else {
        await economy.updateUser(userId, {
            balance: user.balance - amount
        });
    }
    
    // Consumir efectos de uso limitado si se usaron
    if (hasBoost) {
        await shop.consumeUsageEffects(userId, 'robbery');
    }
    
    // Actualizar estadísticas
    await missions.updateMissionProgress(userId, 'money_bet', amount);
    
    const embed = new EmbedBuilder()
        .setTitle(won ? '🎉 ¡Ganaste!' : '💸 Perdiste')
        .setColor(won ? '#00FF00' : '#FF0000')
        .addFields(
            { name: '🎲 Apuesta', value: `${amount.toLocaleString('es-ES')} π-b// === EJEMPLOS DE USO COMPLETO ===

// 1. En tu procesador principal de mensajes
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const args = message.content.toLowerCase().split(' ');
    const command = args[0];
    
    try {
        // Procesar comandos de economía (modificados con shop)
        switch (command) {
            case '>work':
                await enhancedWorkCommand(message);
                break;
                
            case '>daily':
                await enhancedDailyCommand(message);
                break;
                
            case '>gamble':
            case '>bet':
                if (!args[1]) {
                    await message.reply('❌ Especifica la cantidad. Ejemplo: `>bet 500`');
                    return;
                }
                await enhancedGambleCommand(message, parseInt(args[1]));
                break;
                
            case '>profile':
            case '>perfil':
                let target = message.mentions.users.first() || message.author;
                await enhancedProfileCommand(message, target);
                break;
                
            // Comandos administrativos
            case '>giveitem':
                if (message.member.permissions.has('ADMINISTRATOR')) {
                    await giveItemCommand(message, args);
                }
                break;
                
            case '>shopstats':
                if (message.member.permissions.has('ADMINISTRATOR')) {
                    await shopStatsCommand(message);
                }
                break;
        }
        
        // Procesar comandos de tienda
        await shop.processCommand(message);
        
        // Procesar comandos de misiones
        await missions.processCommand(message);
        
        // Actualizar progreso de misiones por mensaje
        const completedMissions = await missions.updateMissionProgress(message.author.id, 'message');
        await missions.notifyCompletedMissions(message, completedMissions);
        
    } catch (error) {
        console.error('❌ Error procesando comando:', error);
        await message.reply('❌ Ocurrió un error inesperado. Intenta de nuevo.');
    }
});

// 2. Comando de trabajo mejorado con items
async function enhancedWorkCommand(message) {
    const userId = message.author.id;
    const user = await economy.getUser(userId);
    
    // Obtener modificadores de items
    const modifiers = await shop.getActiveMultipliers(userId, 'work');
    
    // Calcular cooldown con reducción por items
    const baseCooldown = 3600000; // 1 hora
    let actualCooldown = baseCooldown * (1 - modifiers.reduction);
    
    // Aplicar reducción permanente de botas de trabajo
    const permanentEffects = user.permanentEffects || {};
    for (const effect of Object.values(permanentEffects)) {
        if (effect.type === 'permanent_cooldown' && effect.targets.includes('work')) {
            actualCooldown *= (1 - effect.reduction);
        }
    }
    
    const now = Date.now();
    const lastWork = user.lastWork || 0;
    
    if (now - lastWork < actualCooldown) {
        const timeLeft = actualCooldown - (now - lastWork);
        const minutes = Math.ceil(timeLeft / 60000);
        await message.reply(`⏰ Debes esperar **${minutes} minutos** antes de trabajar otra vez.`);
        return;
    }
    
    // Generar trabajo aleatorio
    const jobs = [
        { name: 'programar', emoji: '💻', min: 300, max: 800 },
        { name: 'cocinar', emoji: '👨‍🍳', min: 250, max: 600 },
        { name: 'enseñar', emoji: '👨‍🏫', min: 400, max: 700 },
        { name: 'construir', emoji: '👷', min: 350, max: 750 }
    ];
    
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const baseEarnings = Math.floor(Math.random() * (job.max - job.min)) + job.min;
    
    // Aplicar multiplicadores de items
    let finalEarnings = Math.floor(baseEarnings * modifiers.multiplier);
    
    // Aplicar multiplicadores permanentes
    for (const effect of Object.values(permanentEffects)) {
        if (effect.type === 'permanent_multiplier' && 
            (effect.targets.includes('all') || effect.targets.includes('work'))) {
            finalEarnings = Math.floor(finalEarnings * effect.multiplier);
        }
    }
    
    // Consumir efectos de uso limitado
    await shop.consumeUsageEffects(userId, 'work');
    
    // Actualizar usuario
    await economy.updateUser(userId, {
        balance: user.balance + finalEarnings,
        lastWork: now
    });
    
    // XP con multiplicadores
    const xpResult = await economy.addXp(userId, 50);
    
    // Actualizar misiones
    const completedMissions = await missions.updateMissionProgress(userId, 'work');
    await missions.updateMissionProgress(userId, 'money_earned', finalEarnings);
    
    // Crear embed de respuesta
    const embed = new EmbedBuilder()
        .setTitle(`${job.emoji} ¡Trabajo Completado!`)
        .setDescription(`Trabajaste ${job.name} y ganaste dinero.`)
        .setColor('#00FF00')
        .addFields(
            { name: '💰 Ganancias', value: `${finalEarnings.toLocaleString('es-ES')} π-b$`, inline: true },
            { name: '⭐ XP Ganada', value: `+${xpResult.xpGained} XP`, inline: true }
        );
    
    // Mostrar bonificaciones
    if (modifiers.multiplier > 1) {
        const bonus = finalEarnings - baseEarnings;
        embed.addFields({ 
            name: '🍀 Bonificación por Items', 
            value: `+${bonus} π-b$ (x${modifiers.multiplier.toFixed(1)})`, 
            inline: false 
        });
    }
    
    if (modifiers.reduction > 0) {
        embed.addFields({ 
            name: '⚡ Cooldown Reducido', 
            value: `${(modifiers.reduction * 100).toFixed(0)}% menos tiempo de espera`, 
            inline: false 
        });
    }
    
, inline: true },
            { name: won ? '💰 Ganancia' : '💸 Pérdida', value: `${Math.abs(finalAmount - amount).toLocaleString('es-ES')} π-b// === EJEMPLOS DE USO COMPLETO ===

// 1. En tu procesador principal de mensajes
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const args = message.content.toLowerCase().split(' ');
    const command = args[0];
    
    try {
        // Procesar comandos de economía (modificados con shop)
        switch (command) {
            case '>work':
                await enhancedWorkCommand(message);
                break;
                
            case '>daily':
                await enhancedDailyCommand(message);
                break;
                
            case '>gamble':
            case '>bet':
                if (!args[1]) {
                    await message.reply('❌ Especifica la cantidad. Ejemplo: `>bet 500`');
                    return;
                }
                await enhancedGambleCommand(message, parseInt(args[1]));
                break;
                
            case '>profile':
            case '>perfil':
                let target = message.mentions.users.first() || message.author;
                await enhancedProfileCommand(message, target);
                break;
                
            // Comandos administrativos
            case '>giveitem':
                if (message.member.permissions.has('ADMINISTRATOR')) {
                    await giveItemCommand(message, args);
                }
                break;
                
            case '>shopstats':
                if (message.member.permissions.has('ADMINISTRATOR')) {
                    await shopStatsCommand(message);
                }
                break;
        }
        
        // Procesar comandos de tienda
        await shop.processCommand(message);
        
        // Procesar comandos de misiones
        await missions.processCommand(message);
        
        // Actualizar progreso de misiones por mensaje
        const completedMissions = await missions.updateMissionProgress(message.author.id, 'message');
        await missions.notifyCompletedMissions(message, completedMissions);
        
    } catch (error) {
        console.error('❌ Error procesando comando:', error);
        await message.reply('❌ Ocurrió un error inesperado. Intenta de nuevo.');
    }
});

// 2. Comando de trabajo mejorado con items
async function enhancedWorkCommand(message) {
    const userId = message.author.id;
    const user = await economy.getUser(userId);
    
    // Obtener modificadores de items
    const modifiers = await shop.getActiveMultipliers(userId, 'work');
    
    // Calcular cooldown con reducción por items
    const baseCooldown = 3600000; // 1 hora
    let actualCooldown = baseCooldown * (1 - modifiers.reduction);
    
    // Aplicar reducción permanente de botas de trabajo
    const permanentEffects = user.permanentEffects || {};
    for (const effect of Object.values(permanentEffects)) {
        if (effect.type === 'permanent_cooldown' && effect.targets.includes('work')) {
            actualCooldown *= (1 - effect.reduction);
        }
    }
    
    const now = Date.now();
    const lastWork = user.lastWork || 0;
    
    if (now - lastWork < actualCooldown) {
        const timeLeft = actualCooldown - (now - lastWork);
        const minutes = Math.ceil(timeLeft / 60000);
        await message.reply(`⏰ Debes esperar **${minutes} minutos** antes de trabajar otra vez.`);
        return;
    }
    
    // Generar trabajo aleatorio
    const jobs = [
        { name: 'programar', emoji: '💻', min: 300, max: 800 },
        { name: 'cocinar', emoji: '👨‍🍳', min: 250, max: 600 },
        { name: 'enseñar', emoji: '👨‍🏫', min: 400, max: 700 },
        { name: 'construir', emoji: '👷', min: 350, max: 750 }
    ];
    
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const baseEarnings = Math.floor(Math.random() * (job.max - job.min)) + job.min;
    
    // Aplicar multiplicadores de items
    let finalEarnings = Math.floor(baseEarnings * modifiers.multiplier);
    
    // Aplicar multiplicadores permanentes
    for (const effect of Object.values(permanentEffects)) {
        if (effect.type === 'permanent_multiplier' && 
            (effect.targets.includes('all') || effect.targets.includes('work'))) {
            finalEarnings = Math.floor(finalEarnings * effect.multiplier);
        }
    }
    
    // Consumir efectos de uso limitado
    await shop.consumeUsageEffects(userId, 'work');
    
    // Actualizar usuario
    await economy.updateUser(userId, {
        balance: user.balance + finalEarnings,
        lastWork: now
    });
    
    // XP con multiplicadores
    const xpResult = await economy.addXp(userId, 50);
    
    // Actualizar misiones
    const completedMissions = await missions.updateMissionProgress(userId, 'work');
    await missions.updateMissionProgress(userId, 'money_earned', finalEarnings);
    
    // Crear embed de respuesta
    const embed = new EmbedBuilder()
        .setTitle(`${job.emoji} ¡Trabajo Completado!`)
        .setDescription(`Trabajaste ${job.name} y ganaste dinero.`)
        .setColor('#00FF00')
        .addFields(
            { name: '💰 Ganancias', value: `${finalEarnings.toLocaleString('es-ES')} π-b$`, inline: true },
            { name: '⭐ XP Ganada', value: `+${xpResult.xpGained} XP`, inline: true }
        );
    
    // Mostrar bonificaciones
    if (modifiers.multiplier > 1) {
        const bonus = finalEarnings - baseEarnings;
        embed.addFields({ 
            name: '🍀 Bonificación por Items', 
            value: `+${bonus} π-b$ (x${modifiers.multiplier.toFixed(1)})`, 
            inline: false 
        });
    }
    
    if (modifiers.reduction > 0) {
        embed.addFields({ 
            name: '⚡ Cooldown Reducido', 
            value: `${(modifiers.reduction * 100).toFixed(0)}% menos tiempo de espera`, 
            inline: false 
        });
    }
    
, inline: true },
            { name: '💳 Balance', value: `${(user.balance + (won ? finalAmount - amount : -amount)).toLocaleString('es-ES')} π-b// === EJEMPLOS DE USO COMPLETO ===

// 1. En tu procesador principal de mensajes
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const args = message.content.toLowerCase().split(' ');
    const command = args[0];
    
    try {
        // Procesar comandos de economía (modificados con shop)
        switch (command) {
            case '>work':
                await enhancedWorkCommand(message);
                break;
                
            case '>daily':
                await enhancedDailyCommand(message);
                break;
                
            case '>gamble':
            case '>bet':
                if (!args[1]) {
                    await message.reply('❌ Especifica la cantidad. Ejemplo: `>bet 500`');
                    return;
                }
                await enhancedGambleCommand(message, parseInt(args[1]));
                break;
                
            case '>profile':
            case '>perfil':
                let target = message.mentions.users.first() || message.author;
                await enhancedProfileCommand(message, target);
                break;
                
            // Comandos administrativos
            case '>giveitem':
                if (message.member.permissions.has('ADMINISTRATOR')) {
                    await giveItemCommand(message, args);
                }
                break;
                
            case '>shopstats':
                if (message.member.permissions.has('ADMINISTRATOR')) {
                    await shopStatsCommand(message);
                }
                break;
        }
        
        // Procesar comandos de tienda
        await shop.processCommand(message);
        
        // Procesar comandos de misiones
        await missions.processCommand(message);
        
        // Actualizar progreso de misiones por mensaje
        const completedMissions = await missions.updateMissionProgress(message.author.id, 'message');
        await missions.notifyCompletedMissions(message, completedMissions);
        
    } catch (error) {
        console.error('❌ Error procesando comando:', error);
        await message.reply('❌ Ocurrió un error inesperado. Intenta de nuevo.');
    }
});

// 2. Comando de trabajo mejorado con items
async function enhancedWorkCommand(message) {
    const userId = message.author.id;
    const user = await economy.getUser(userId);
    
    // Obtener modificadores de items
    const modifiers = await shop.getActiveMultipliers(userId, 'work');
    
    // Calcular cooldown con reducción por items
    const baseCooldown = 3600000; // 1 hora
    let actualCooldown = baseCooldown * (1 - modifiers.reduction);
    
    // Aplicar reducción permanente de botas de trabajo
    const permanentEffects = user.permanentEffects || {};
    for (const effect of Object.values(permanentEffects)) {
        if (effect.type === 'permanent_cooldown' && effect.targets.includes('work')) {
            actualCooldown *= (1 - effect.reduction);
        }
    }
    
    const now = Date.now();
    const lastWork = user.lastWork || 0;
    
    if (now - lastWork < actualCooldown) {
        const timeLeft = actualCooldown - (now - lastWork);
        const minutes = Math.ceil(timeLeft / 60000);
        await message.reply(`⏰ Debes esperar **${minutes} minutos** antes de trabajar otra vez.`);
        return;
    }
    
    // Generar trabajo aleatorio
    const jobs = [
        { name: 'programar', emoji: '💻', min: 300, max: 800 },
        { name: 'cocinar', emoji: '👨‍🍳', min: 250, max: 600 },
        { name: 'enseñar', emoji: '👨‍🏫', min: 400, max: 700 },
        { name: 'construir', emoji: '👷', min: 350, max: 750 }
    ];
    
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const baseEarnings = Math.floor(Math.random() * (job.max - job.min)) + job.min;
    
    // Aplicar multiplicadores de items
    let finalEarnings = Math.floor(baseEarnings * modifiers.multiplier);
    
    // Aplicar multiplicadores permanentes
    for (const effect of Object.values(permanentEffects)) {
        if (effect.type === 'permanent_multiplier' && 
            (effect.targets.includes('all') || effect.targets.includes('work'))) {
            finalEarnings = Math.floor(finalEarnings * effect.multiplier);
        }
    }
    
    // Consumir efectos de uso limitado
    await shop.consumeUsageEffects(userId, 'work');
    
    // Actualizar usuario
    await economy.updateUser(userId, {
        balance: user.balance + finalEarnings,
        lastWork: now
    });
    
    // XP con multiplicadores
    const xpResult = await economy.addXp(userId, 50);
    
    // Actualizar misiones
    const completedMissions = await missions.updateMissionProgress(userId, 'work');
    await missions.updateMissionProgress(userId, 'money_earned', finalEarnings);
    
    // Crear embed de respuesta
    const embed = new EmbedBuilder()
        .setTitle(`${job.emoji} ¡Trabajo Completado!`)
        .setDescription(`Trabajaste ${job.name} y ganaste dinero.`)
        .setColor('#00FF00')
        .addFields(
            { name: '💰 Ganancias', value: `${finalEarnings.toLocaleString('es-ES')} π-b$`, inline: true },
            { name: '⭐ XP Ganada', value: `+${xpResult.xpGained} XP`, inline: true }
        );
    
    // Mostrar bonificaciones
    if (modifiers.multiplier > 1) {
        const bonus = finalEarnings - baseEarnings;
        embed.addFields({ 
            name: '🍀 Bonificación por Items', 
            value: `+${bonus} π-b$ (x${modifiers.multiplier.toFixed(1)})`, 
            inline: false 
        });
    }
    
    if (modifiers.reduction > 0) {
        embed.addFields({ 
            name: '⚡ Cooldown Reducido', 
            value: `${(modifiers.reduction * 100).toFixed(0)}% menos tiempo de espera`, 
            inline: false 
        });
    }
    
, inline: true }
        );
    
    if (hasBoost) {
        embed.addFields({ 
            name: '🔧 Boost Aplicado', 
            value: `Probabilidad aumentada por Kit de Robo`, 
            inline: false 
        });
    }
    
    await message.reply({ embeds: [embed] });
}

// 6. Comando especial VIP
async function vipCommand(message) {
    const userId = message.author.id;
    const hasVipAccess = await shop.hasVipAccess(userId);
    
    if (!hasVipAccess) {
        await message.reply('❌ Necesitas ser **VIP** para usar este comando. Compra el **Pase VIP** en la tienda.');
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('👑 Comandos VIP Disponibles')
        .setColor('#FFD700')
        .setDescription('Comandos exclusivos para usuarios VIP:')
        .addFields(
            { name: '💎 >vipwork', value: 'Trabajo especial con mejores recompensas', inline: false },
            { name: '🎁 >vipbonus', value: 'Bonificación adicional cada 12 horas', inline: false },
            { name: '📊 >vipstats', value: 'Estadísticas detalladas de tu progreso', inline: false },
            { name: '⭐ >vipshop', value: 'Acceso a items exclusivos VIP', inline: false }
        )
        .setFooter({ text: '¡Gracias por ser VIP!' });
    
    await message.reply({ embeds: [embed] });
}

// 7. Evento especial de fin de semana
cron.schedule('0 0 * * 6', async () => { // Sábado 00:00
    console.log('🎉 Iniciando evento de fin de semana');
    
    // Aplicar descuentos en la tienda
    const announcement = new EmbedBuilder()
        .setTitle('🛍️ ¡Evento de Fin de Semana!')
        .setDescription('¡Todos los items de la tienda tienen **20% de descuento**!')
        .setColor('#FF6600')
        .addFields({ 
            name: '⏰ Duración', 
            value: 'Hasta el domingo a las 23:59', 
            inline: false 
        })
        .setTimestamp();
    
    // Enviar a un canal específico
    const channel = client.channels.cache.get('TU_CANAL_ID');
    if (channel) {
        await channel.send({ embeds: [announcement] });
    }
});

module.exports = {
    enhancedWorkCommand,
    enhancedDailyCommand,  
    enhancedProfileCommand,
    enhancedGambleCommand,
    vipCommand
};pResult.levelUp) {
        embed.addFields({ 
            name: '🎉 ¡Subiste de Nivel!', 
            value: `Ahora eres nivel **${xpResult.newLevel}**`, 
            inline: false 
        });
    }
    
    await message.reply({ embeds: [embed] });
    
    // Notificar misiones completadas
    await missions.notifyCompletedMissions(message, completedMissions);
}

// 3. Comando daily mejorado con VIP
async function enhancedDailyCommand(message) {
    const userId = message.author.id;
    const user = await economy.getUser(userId);
    
    const now = Date.now();
    const lastDaily = user.lastDaily || 0;
    const dailyCooldown = 24 * 60 * 60 * 1000; // 24 horas
    
    if (now - lastDaily < dailyCooldown) {
        const timeLeft = dailyCooldown - (now - lastDaily);
        const hours = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        
        await message.reply(`⏰ Ya reclamaste tu recompensa diaria. Vuelve en **${hours}h ${minutes}m**.`);
        return;
    }
    
    // Calcular recompensa con bonificaciones VIP
    let baseReward = 500;
    let finalReward = baseReward;
    let bonusText = '';
    
    // Verificar beneficios permanentes (VIP)
    const permanentEffects = user.permanentEffects || {};
    for (const effect of Object.values(permanentEffects)) {
        if (effect.benefits && effect.benefits.includes('daily_bonus')) {
            finalReward = Math.floor(baseReward * 1.5); // 50% más
            bonusText = '\n👑 **Bonificación VIP**: +' + (finalReward - baseReward) + ' π-b$';
            break;
        }
    }
    
    // Actualizar usuario
    await economy.updateUser(userId, {
        balance: user.balance + finalReward,
        lastDaily: now
    });
    
    // XP
    const xpResult = await economy.addXp(userId, 100);
    
    // Actualizar misiones
    const completedMissions = await missions.updateMissionProgress(userId, 'daily_claimed');
    await missions.updateMissionProgress(userId, 'money_earned', finalReward);
    
    const embed = new EmbedBuilder()
        .setTitle('🎁 Recompensa Diaria Reclamada')
        .setDescription(`¡Recibiste tu recompensa diaria!${bonusText}`)
        .setColor('#FFD700')
        .addFields(
            { name: '💰 Dinero', value: `+${finalReward.toLocaleString('es-ES')} π-b$`, inline: true },
            { name: '⭐ XP', value: `+${xpResult.xpGained} XP`, inline: true }
        )
        .setTimestamp();
    
    if (x