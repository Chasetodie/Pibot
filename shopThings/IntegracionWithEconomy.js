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