## 6. OPCIONAL - Sistema de verificación automática para el logro "Asceta"

Para que el logro "Asceta" se verifique automáticamente, puedes agregar una función que se ejecute periódicamente o cada vez que alguien use un comando:

```javascript
// En ACHIEVEMENTS.JS, agregar este método:
async checkInactiveStreak(userId) {
    // Esta función se puede llamar desde cualquier comando para verificar 
    // si el usuario ha completado el logro de inactividad
    const unlockedAchievements = await this.checkAchievements(userId);
    
    if (unlockedAchievements.length > 0) {
        // Si hay logros nuevos, notificarlos
        // (esto se manejaría en tu sistema principal)
        return unlockedAchievements;
    }
    
    return [];
}
```