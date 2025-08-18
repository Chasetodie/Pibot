// === MODIFICACIONES PARA TU SISTEMA DE ECONOMÍA ===

// 1. En tu comando de trabajo (>work)
async workCommand(message) {
    const userId = message.author.id;
    const user = await this.getUser(userId);
    
    // Verificar cooldown con reducción por items
    const modifiers = await this.shop.getActiveMultipliers(userId, 'work');
    const baseCooldown = 3600000; // 1 hora base
    const actualCooldown = baseCooldown * (1 - modifiers.reduction);
    
    const now = Date.now();
    const lastWork = user.lastWork || 0;
    
    if (now - lastWork < actualCooldown) {
        const timeLeft = actualCooldown - (now - lastWork);
        const minutes = Math.ceil(timeLeft / 60000);
        await message.reply(`⏰ Debes esperar ${minutes} minutos antes de trabajar otra vez.`);
        return;
    }
    
    // Calcular ganancias con multiplicadores
    const baseEarnings = Math.floor(Math.random() * 500) + 200; // 200-700
    const finalEarnings = Math.floor(baseEarnings * modifiers.multiplier);
    
    // Consumir efectos de "usos limitados"
    await this.consumeUsageEffects(userId, 'work');
    
    // Actualizar usuario
    await this.updateUser(userId, {
        balance: user.balance + finalEarnings,
        lastWork: now
    });
    
    // Actualizar misiones
    await this.missions.updateMissionProgress(userId, 'work');
    await this.missions.updateMissionProgress(userId, 'money_earned', finalEarnings);
    
    let effectMessage = '';
    if (modifiers.multiplier > 1) {
        const bonus = finalEarnings - baseEarnings;
        effectMessage = `\n🍀 **Bonificación por items**: +${bonus} π-b$`;
    }
    
    await message.reply(
        `💼 Trabajaste y ganaste **${finalEarnings} π-b$**!${effectMessage}`
    );
}

// 2. En tu comando de juegos
async gameCommand(message, gameType) {
    const userId = message.author.id;
    const modifiers = await this.shop.getActiveMultipliers(userId, 'games');
    
    // Tu lógica de juego aquí...
    const gameWon = Math.random() > 0.5; // Ejemplo
    let earnings = 0;
    
    if (gameWon) {
        const baseEarnings = 300;
        earnings = Math.floor(baseEarnings * modifiers.multiplier);
        
        const user = await this.getUser(userId);
        await this.updateUser(userId, {
            balance: user.balance + earnings
        });
        
        // Actualizar misiones
        await this.missions.updateMissionProgress(userId, 'game_played');
        await this.missions.updateMissionProgress(userId, 'game_won');
        await this.missions.updateMissionProgress(userId, 'money_earned', earnings);
    } else {
        await this.missions.updateMissionProgress(userId, 'game_played');
    }
    
    // Consumir efectos de uso limitado
    await this.consumeUsageEffects(userId, 'games');
}

// 3. Sistema para añadir XP con multiplicadores
async addXp(userId, baseXp) {
    const modifiers = await this.shop.getActiveMultipliers(userId, 'all');
    const finalXp = Math.floor(baseXp * modifiers.multiplier);
    
    const user = await this.getUser(userId);
    const newXp = (user.xp || 0) + finalXp;
    const newLevel = Math.floor(newXp / 1000) + 1;
    const oldLevel = Math.floor((user.xp || 0) / 1000) + 1;
    
    await this.updateUser(userId, { xp: newXp, level: newLevel });
    
    // Si subió de nivel
    if (newLevel > oldLevel) {
        await this.missions.updateMissionProgress(userId, 'level_up');
        return { levelUp: true, newLevel, xpGained: finalXp };
    }
    
    return { levelUp: false, xpGained: finalXp };
}

// 4. Función para consumir efectos de uso limitado
async consumeUsageEffects(userId, action) {
    const user = await this.getUser(userId);
    const activeEffects = user.activeEffects || {};
    let updated = false;
    
    for (const [itemId, effects] of Object.entries(activeEffects)) {
        for (let i = effects.length - 1; i >= 0; i--) {
            const effect = effects[i];
            
            // Solo procesar efectos que afecten esta acción
            if (!effect.targets.includes(action) && !effect.targets.includes('all')) continue;
            
            // Solo efectos con usos limitados
            if (!effect.usesLeft) continue;
            
            effect.usesLeft--;
            
            if (effect.usesLeft <= 0) {
                effects.splice(i, 1);
                updated = true;
            }
        }
        
        // Limpiar arrays vacíos
        if (effects.length === 0) {
            delete activeEffects[itemId];
            updated = true;
        }
    }
    
    if (updated) {
        await this.updateUser(userId, { activeEffects });
    }
}

// 5. Limpiar efectos expirados (ejecutar cada minuto)
async cleanupExpiredEffects() {
    console.log('🧹 Limpiando efectos expirados...');
    
    // Obtener todos los usuarios con efectos activos
    const users = await this.getAllUsersWithEffects(); // Implementar según tu DB
    
    for (const user of users) {
        const activeEffects = user.activeEffects || {};
        let hasChanges = false;
        
        for (const [itemId, effects] of Object.entries(activeEffects)) {
            const validEffects = effects.filter(effect => {
                if (!effect.expiresAt) return true; // Efectos permanentes o por usos
                return effect.expiresAt > Date.now(); // No expirados
            });
            
            if (validEffects.length !== effects.length) {
                if (validEffects.length === 0) {
                    delete activeEffects[itemId];
                } else {
                    activeEffects[itemId] = validEffects;
                }
                hasChanges = true;
            }
        }
        
        if (hasChanges) {
            await this.updateUser(user.id, { activeEffects });
        }
    }
}

// 6. Verificar si el usuario tiene VIP (para comandos especiales)
async hasVipAccess(userId) {
    const user = await this.getUser(userId);
    const permanentEffects = user.permanentEffects || {};
    
    for (const effect of Object.values(permanentEffects)) {
        if (effect.benefits && effect.benefits.includes('vip_commands')) {
            return true;
        }
    }
    return false;
}

// 7. Bonificación diaria para VIP
async getDailyReward(userId) {
    const baseReward = 500;
    let finalReward = baseReward;
    let bonusText = '';
    
    // Verificar beneficios permanentes
    const user = await this.getUser(userId);
    const permanentEffects = user.permanentEffects || {};
    
    for (const effect of Object.values(permanentEffects)) {
        if (effect.benefits && effect.benefits.includes('daily_bonus')) {
            finalReward = Math.floor(baseReward * 1.5); // 50% más
            bonusText = '\n👑 **Bonificación VIP**: +' + (finalReward - baseReward) + ' π-b$';
            break;
        }
    }
    
    return { reward: finalReward, bonusText };
}