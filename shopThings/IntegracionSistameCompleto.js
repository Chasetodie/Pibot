// Limpiar efectos expirados cada minuto
cron.schedule('* * * * *', async () => {
    try {
        await this.economy.cleanupExpiredEffects();
    } catch (error) {
        console.error('❌ Error limpiando efectos:', error);
    }
});