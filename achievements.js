const { EmbedBuilder } = require('discord.js');

class AchievementsSystem {
    constructor(economySystem) {
        this.economy = economySystem;
        
        // Definir todos los logros disponibles
        this.achievements = {
            // Logros de dinero
            'first_dollar': {
                name: '💰 Primer Dólar',
                description: 'Gana tu primer π-b Coin',
                requirement: { type: 'money_earned', value: 1 },
                reward: { money: 100, xp: 50 },
                rarity: 'common',
                emoji: '💰'
            },
            'rich_starter': {
                name: '💸 Emprendedor',
                description: 'Acumula 10,000 π-b Coins',
                requirement: { type: 'money_balance', value: 10000 },
                reward: { money: 1000, xp: 200 },
                rarity: 'uncommon',
                emoji: '💸'
            },
            'millionaire': {
                name: '🏆 Millonario',
                description: 'Acumula 1,000,000 π-b Coins',
                requirement: { type: 'money_balance', value: 1000000 },
                reward: { money: 50000, xp: 5000 },
                rarity: 'legendary',
                emoji: '🏆'
            },
            
            // Logros de nivel
            'level_up': {
                name: '📈 Subiendo',
                description: 'Alcanza el nivel 5',
                requirement: { type: 'level', value: 5 },
                reward: { money: 500, xp: 100 },
                rarity: 'common',
                emoji: '📈'
            },
            'experienced': {
                name: '🎖️ Experimentado',
                description: 'Alcanza el nivel 20',
                requirement: { type: 'level', value: 20 },
                reward: { money: 2000, xp: 500 },
                rarity: 'rare',
                emoji: '🎖️'
            },
            'master': {
                name: '👑 Maestro',
                description: 'Alcanza el nivel 50',
                requirement: { type: 'level', value: 50 },
                reward: { money: 10000, xp: 2000 },
                rarity: 'epic',
                emoji: '👑'
            },
            'legend': {
                name: '⭐ Leyenda',
                description: 'Alcanza el nivel 100',
                requirement: { type: 'level', value: 100 },
                reward: { money: 50000, xp: 10000 },
                rarity: 'legendary',
                emoji: '⭐'
            },
            
            // Logros de actividad
            'chatter': {
                name: '💬 Conversador',
                description: 'Envía 100 mensajes',
                requirement: { type: 'messages', value: 100 },
                reward: { money: 200, xp: 100 },
                rarity: 'common',
                emoji: '💬'
            },
            'social_butterfly': {
                name: '🦋 Mariposa Social',
                description: 'Envía 1,000 mensajes',
                requirement: { type: 'messages', value: 1000 },
                reward: { money: 2000, xp: 500 },
                rarity: 'rare',
                emoji: '🦋'
            },
            'no_life': {
                name: '🤖 Sin Vida Social',
                description: 'Envía 10,000 mensajes',
                requirement: { type: 'messages', value: 10000 },
                reward: { money: 25000, xp: 2500 },
                rarity: 'epic',
                emoji: '🤖'
            },
            
            // Logros de trabajo
            'first_job': {
                name: '🛠️ Primer Trabajo',
                description: 'Completa tu primer trabajo',
                requirement: { type: 'work_count', value: 1 },
                reward: { money: 150, xp: 75 },
                rarity: 'common',
                emoji: '🛠️'
            },
            'hard_worker': {
                name: '💪 Trabajador Duro',
                description: 'Completa 100 trabajos',
                requirement: { type: 'work_count', value: 100 },
                reward: { money: 5000, xp: 1000 },
                rarity: 'rare',
                emoji: '💪'
            },
            'workaholic': {
                name: '⚡ Adicto al Trabajo',
                description: 'Completa 500 trabajos',
                requirement: { type: 'work_count', value: 500 },
                reward: { money: 20000, xp: 3000 },
                rarity: 'epic',
                emoji: '⚡'
            },
            
            // Logros de daily
            'daily_starter': {
                name: '📅 Rutinario',
                description: 'Reclama tu daily 7 días seguidos',
                requirement: { type: 'daily_streak', value: 7 },
                reward: { money: 1000, xp: 200 },
                rarity: 'uncommon',
                emoji: '📅'
            },
            'daily_master': {
                name: '🗓️ Maestro de la Rutina',
                description: 'Reclama tu daily 30 días seguidos',
                requirement: { type: 'daily_streak', value: 30 },
                reward: { money: 10000, xp: 1500 },
                rarity: 'epic',
                emoji: '🗓️'
            },
            
            // Logros de gambling
            'first_bet': {
                name: '🎲 Primera Apuesta',
                description: 'Juega cualquier minijuego por primera vez',
                requirement: { type: 'games_played', value: 1 },
                reward: { money: 100, xp: 50 },
                rarity: 'common',
                emoji: '🎲'
            },
            'lucky_streak': {
                name: '🍀 Racha de Suerte',
                description: 'Gana 10 juegos seguidos',
                requirement: { type: 'win_streak', value: 10 },
                reward: { money: 5000, xp: 1000 },
                rarity: 'rare',
                emoji: '🍀'
            },
            'high_roller': {
                name: '💎 Apostador VIP',
                description: 'Apuesta más de 50,000 π-b$ en total',
                requirement: { type: 'total_bet', value: 50000 },
                reward: { money: 10000, xp: 2000 },
                rarity: 'epic',
                emoji: '💎'
            },
            
            // Logros especiales
            'generous': {
                name: '❤️ Generoso',
                description: 'Transfiere 10,000 π-b$ a otros usuarios',
                requirement: { type: 'money_given', value: 10000 },
                reward: { money: 2000, xp: 500 },
                rarity: 'rare',
                emoji: '❤️'
            },
            'collector': {
                name: '📦 Coleccionista',
                description: 'Obtén 10 logros diferentes',
                requirement: { type: 'achievements_count', value: 10 },
                reward: { money: 5000, xp: 1000 },
                rarity: 'epic',
                emoji: '📦'
            },
            'completionist': {
                name: '🏅 Completista',
                description: 'Obtén todos los logros disponibles',
                requirement: { type: 'achievements_count', value: 20 }, // Actualizar según total
                reward: { money: 100000, xp: 10000 },
                rarity: 'legendary',
                emoji: '🏅'
            }
        };
        
        // Colores por rareza
        this.rarityColors = {
            'common': '#FFFFFF',
            'uncommon': '#1EFF00',
            'rare': '#0099FF',
            'epic': '#CC00FF',
            'legendary': '#FF6600'
        };
        
        // Emojis por rareza
        this.rarityEmojis = {
            'common': '⚪',
            'uncommon': '🟢', 
            'rare': '🔵',
            'epic': '🟣',
            'legendary': '🟠'
        };
    }

    // Verificar logros para un usuario
    checkAchievements(userId) {
        const user = this.economy.getUser(userId);
        const unlockedAchievements = [];
        
        // Si el usuario no tiene logros inicializados
        if (!user.achievements) {
            user.achievements = {
                unlocked: [],
                progress: {},
                unlockedCount: 0
            };
        }

        for (const [achievementId, achievement] of Object.entries(this.achievements)) {
            // Si ya tiene este logro, saltarlo
            if (user.achievements.unlocked.includes(achievementId)) continue;
            
            let currentValue = 0;
            const req = achievement.requirement;
            
            // Obtener valor actual según el tipo de logro
            switch (req.type) {
                case 'money_earned':
                    currentValue = user.stats.totalEarned;
                    break;
                case 'money_balance':
                    currentValue = user.balance;
                    break;
                case 'level':
                    currentValue = user.level;
                    break;
                case 'messages':
                    currentValue = user.messagesCount;
                    break;
                case 'work_count':
                    currentValue = user.stats.workCount;
                    break;
                case 'daily_streak':
                    currentValue = user.stats.dailyStreak || 0;
                    break;
                case 'games_played':
                    currentValue = user.stats.gamesPlayed || 0;
                    break;
                case 'win_streak':
                    currentValue = user.stats.currentWinStreak || 0;
                    break;
                case 'total_bet':
                    currentValue = user.stats.totalBet || 0;
                    break;
                case 'money_given':
                    currentValue = user.stats.moneyGiven || 0;
                    break;
                case 'achievements_count':
                    currentValue = user.achievements.unlockedCount;
                    break;
            }
            
            // Actualizar progreso
            user.achievements.progress[achievementId] = {
                current: currentValue,
                required: req.value,
                percentage: Math.min(100, (currentValue / req.value) * 100)
            };
            
            // Verificar si completó el logro
            if (currentValue >= req.value) {
                user.achievements.unlocked.push(achievementId);
                user.achievements.unlockedCount++;
                unlockedAchievements.push(achievementId);
                
                // Dar recompensas
                if (achievement.reward.money) {
                    user.balance += achievement.reward.money;
                    user.stats.totalEarned += achievement.reward.money;
                }
                if (achievement.reward.xp) {
                    this.economy.addXp(userId, achievement.reward.xp);
                }
                
                console.log(`🏆 ${userId} desbloqueó logro: ${achievement.name}`);
            }
        }
        
        this.economy.saveUsers();
        return unlockedAchievements;
    }

    // Actualizar estadísticas específicas para logros
    updateStats(userId, statType, value) {
        const user = this.economy.getUser(userId);
        
        if (!user.stats) user.stats = {};
        
        switch (statType) {
            case 'game_played':
                user.stats.gamesPlayed = (user.stats.gamesPlayed || 0) + 1;
                break;
            case 'game_won':
                user.stats.gamesWon = (user.stats.gamesWon || 0) + 1;
                user.stats.currentWinStreak = (user.stats.currentWinStreak || 0) + 1;
                user.stats.bestWinStreak = Math.max(user.stats.bestWinStreak || 0, user.stats.currentWinStreak);
                break;
            case 'game_lost':
                user.stats.gamesLost = (user.stats.gamesLost || 0) + 1;
                user.stats.currentWinStreak = 0;
                break;
            case 'money_bet':
                user.stats.totalBet = (user.stats.totalBet || 0) + value;
                break;
            case 'money_given':
                user.stats.moneyGiven = (user.stats.moneyGiven || 0) + value;
                break;
            case 'daily_claimed':
                const lastDaily = user.lastDaily;
                const now = Date.now();
                const dayInMs = 24 * 60 * 60 * 1000;
                
                // Verificar si es consecutivo (dentro de 48 horas de la última)
                if (lastDaily && (now - lastDaily) <= (dayInMs * 2)) {
                    user.stats.dailyStreak = (user.stats.dailyStreak || 0) + 1;
                } else {
                    user.stats.dailyStreak = 1;
                }
                user.stats.bestDailyStreak = Math.max(user.stats.bestDailyStreak || 0, user.stats.dailyStreak);
                break;
        }
        
        this.economy.saveUsers();
    }

    // Mostrar logros de un usuario
    async showUserAchievements(message, targetUser = null) {
        const userId = targetUser ? targetUser.id : message.author.id;
        const displayName = targetUser ? targetUser.displayName : message.author.displayName;
        const user = this.economy.getUser(userId);
        
        if (!user.achievements) {
            user.achievements = { unlocked: [], progress: {}, unlockedCount: 0 };
        }
        
        const totalAchievements = Object.keys(this.achievements).length;
        const unlockedCount = user.achievements.unlocked.length;
        const progressPercentage = ((unlockedCount / totalAchievements) * 100).toFixed(1);
        
        const embed = new EmbedBuilder()
            .setTitle(`🏆 Logros de ${displayName}`)
            .setDescription(`**${unlockedCount}/${totalAchievements}** logros desbloqueados (${progressPercentage}%)`)
            .setColor('#FFD700')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        
        // Mostrar logros desbloqueados
        if (unlockedCount > 0) {
            let unlockedText = '';
            for (const achievementId of user.achievements.unlocked) {
                const achievement = this.achievements[achievementId];
                const rarityEmoji = this.rarityEmojis[achievement.rarity];
                unlockedText += `${rarityEmoji} ${achievement.emoji} **${achievement.name}**\n`;
            }
            
            embed.addFields({
                name: '✅ Logros Desbloqueados',
                value: unlockedText || 'Ninguno',
                inline: false
            });
        }
        
        // Mostrar progreso de logros cercanos
        const nearCompletion = [];
        for (const [achievementId, achievement] of Object.entries(this.achievements)) {
            if (user.achievements.unlocked.includes(achievementId)) continue;
            
            const progress = user.achievements.progress[achievementId];
            if (progress && progress.percentage >= 25) { // Mostrar si tiene al menos 25% de progreso
                nearCompletion.push({
                    id: achievementId,
                    achievement: achievement,
                    progress: progress
                });
            }
        }
        
        if (nearCompletion.length > 0) {
            // Ordenar por porcentaje de progreso
            nearCompletion.sort((a, b) => b.progress.percentage - a.progress.percentage);
            
            let progressText = '';
            for (let i = 0; i < Math.min(5, nearCompletion.length); i++) {
                const item = nearCompletion[i];
                const prog = item.progress;
                const rarityEmoji = this.rarityEmojis[item.achievement.rarity];
                
                const progressBar = this.createProgressBar(prog.current, prog.required, 8);
                progressText += `${rarityEmoji} ${item.achievement.emoji} **${item.achievement.name}**\n`;
                progressText += `\`${progressBar}\` ${prog.percentage.toFixed(1)}%\n`;
                progressText += `${this.formatNumber(prog.current)}/${this.formatNumber(prog.required)}\n\n`;
            }
            
            embed.addFields({
                name: '📊 Progreso Actual',
                value: progressText,
                inline: false
            });
        }
        
        await message.reply({ embeds: [embed] });
    }

    // Mostrar todos los logros disponibles
    async showAllAchievements(message) {
        const rarityGroups = {
            'common': [],
            'uncommon': [],
            'rare': [],
            'epic': [],
            'legendary': []
        };
        
        // Agrupar logros por rareza
        for (const [id, achievement] of Object.entries(this.achievements)) {
            rarityGroups[achievement.rarity].push({ id, ...achievement });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🏆 Todos los Logros Disponibles')
            .setDescription(`Total: **${Object.keys(this.achievements).length}** logros`)
            .setColor('#FFD700')
            .setTimestamp();
        
        // Añadir cada grupo de rareza
        for (const [rarity, achievements] of Object.entries(rarityGroups)) {
            if (achievements.length === 0) continue;
            
            const rarityEmoji = this.rarityEmojis[rarity];
            const rarityName = rarity.charAt(0).toUpperCase() + rarity.slice(1);
            
            let text = '';
            for (const achievement of achievements) {
                const moneyReward = achievement.reward.money ? `${this.formatNumber(achievement.reward.money)} π-b$` : '';
                const xpReward = achievement.reward.xp ? `${this.formatNumber(achievement.reward.xp)} XP` : '';
                const rewards = [moneyReward, xpReward].filter(r => r).join(' + ');
                
                text += `${achievement.emoji} **${achievement.name}**\n`;
                text += `${achievement.description}\n`;
                text += `*Recompensa: ${rewards}*\n\n`;
            }
            
            embed.addFields({
                name: `${rarityEmoji} ${rarityName} (${achievements.length})`,
                value: text,
                inline: false
            });
        }
        
        await message.reply({ embeds: [embed] });
    }

    // Crear barra de progreso
    createProgressBar(current, max, length = 10) {
        const percentage = Math.max(0, Math.min(1, current / max));
        const filledLength = Math.floor(percentage * length);
        const emptyLength = length - filledLength;
        
        const filledChar = '█';
        const emptyChar = '░';
        
        return filledChar.repeat(filledLength) + emptyChar.repeat(emptyLength);
    }

    // Formatear números
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    // Notificar logros desbloqueados
    async notifyAchievements(message, achievementIds) {
        if (achievementIds.length === 0) return;
        
        for (const achievementId of achievementIds) {
            const achievement = this.achievements[achievementId];
            if (!achievement) {
                await message.reply(`❌ El logro con ID \`${achievementId}\` no existe.`);
                continue;
            }
            const rarityColor = this.rarityColors[achievement.rarity];
            const rarityEmoji = this.rarityEmojis[achievement.rarity];
            
            const embed = new EmbedBuilder()
                .setTitle('🎉 ¡Logro Desbloqueado!')
                .setDescription(`${rarityEmoji} ${achievement.emoji} **${achievement.name}**\n\n*${achievement.description}*`)
                .setColor(rarityColor)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .addFields({
                    name: '🎁 Recompensa',
                    value: `${achievement.reward.money ? `+${this.formatNumber(achievement.reward.money)} π-b$` : ''}\n${achievement.reward.xp ? `+${this.formatNumber(achievement.reward.xp)} XP` : ''}`.trim(),
                    inline: true
                })
                .setTimestamp();
            
            await message.channel.send({ embeds: [embed] });
        }
    }
}

module.exports = AchievementsSystem;