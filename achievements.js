const { EmbedBuilder } = require('discord.js');

class AchievementsSystem {
    constructor(economySystem) {
        this.economy = economySystem;
        this.events = null;
        
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
            'lottery_winner': {
                name: '🎰 Ganador de Lotería',
                description: 'Gana al menos una vez en la lotería',
                requirement: { type: 'lottery_wins', value: 1 },
                reward: { money: 1000, xp: 5000 },
                rarity: 'rare',
                emoji: '🎰'
            },
            // Logros especiales
            'ascetic': {
                name: '🧘 Asceta',
                description: 'No uses Work ni Daily por 7 días consecutivos',
                requirement: { type: 'inactive_streak', value: 7 },
                reward: { money: 5000, xp: 1500 },
                rarity: 'epic',
                emoji: '🧘'
            },
            'generous': {
                name: '❤️ Generoso',
                description: 'Transfiere 5,000 π-b$ a otros usuarios',
                requirement: { type: 'money_given', value: 5000 },
                reward: { money: 3000, xp: 500 },
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
                requirement: { type: 'achievements_count', value: 22 }, // Actualizar según total
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

    // NUEVO: Inicializar achievements de un usuario existente
    async initializeUserAchievements(userId) {
        const user = await this.economy.getUser(userId);
        
        if (!user.achievements) {
            const achievements = {};
            // Inicializar todos los achievements como 'not_completed'
            for (const achievementId of Object.keys(this.achievements)) {
                achievements[achievementId] = 'not_completed';
            }
            
            const updateData = {
                achievements: achievements
            };
            
            await this.economy.updateUser(userId, updateData);
            console.log(`🏆 Achievements inicializados para usuario ${userId}`);
        }
    }

    // NUEVO: Detectar y completar logros ya cumplidos
    async detectExistingAchievements(userId, silent = false) {
        await this.initializeUserAchievements(userId);
        const user = await this.economy.getUser(userId);
        const completedAchievements = [];
        const unlockedAchievements = [];
        
        for (const [achievementId, achievement] of Object.entries(this.achievements)) {
            // Si ya está completado, saltarlo
            if (user.achievements[achievementId] === 'completed') continue;
            
            let currentValue = 0;
            const req = achievement.requirement;
            
            // Obtener valor actual según el tipo de logro
            switch (req.type) {
                case 'money_earned':
                    currentValue = user.stats?.totalEarned || 0;
                    break;
                case 'money_balance':
                    currentValue = user.balance || 0;
                    break;
                case 'level':
                    currentValue = user.level || 1;
                    break;
                case 'messages':
                    currentValue = user.messagesCount || 0;
                    break;
                case 'work_count':
                    currentValue = user.stats?.workCount || 0;
                    break;
                case 'daily_streak':
                    currentValue = user.stats?.dailyStreak || 0;
                    break;
                case 'games_played':
                    currentValue = user.stats?.gamesPlayed || 0;
                    break;
                case 'win_streak':
                    currentValue = user.stats?.currentWinStreak || 0;
                    break;
                case 'total_bet':
                    currentValue = user.stats?.totalBet || 0;
                    break;
                case 'money_given':
                    currentValue = user.stats?.moneyGiven || 0;
                    break;
                case 'achievements_count':
                    // Contar achievements completados
                    currentValue = Object.values(user.achievements || {}).filter(status => status === 'completed').length;
                    break;
                case 'lottery_wins':
                    currentValue = user.stats?.lotteryWins || 0;
                    break;
                case 'inactive_streak':
                    // Calcular días sin usar work ni daily
                    const now = Date.now();
                    const dayInMs = 24 * 60 * 60 * 1000;
                    const lastWork = user.lastWork || 0;
                    const lastDaily = user.lastDaily || 0;
                    const lastActivity = Math.max(lastWork, lastDaily);
                    
                    if (lastActivity === 0) {
                        // Si nunca ha usado work ni daily, no cuenta como inactivo
                        currentValue = 0;
                    } else {
                        const daysInactive = Math.floor((now - lastActivity) / dayInMs);
                        currentValue = daysInactive;
                    }
                    break;
            }
            
            // Verificar si completó el logro
            if (currentValue >= req.value) {
                // Marcar como completado en la base de datos
                const updateData = {
                    [`achievements.${achievementId}`]: 'completed'
                };
                
                unlockedAchievements.push(achievementId);
                console.log(`🏆 ${userId} desbloqueó logro: ${achievement.name}`);
                
                // Dar recompensas
                if (achievement.reward.money) {
                    let rewardFinal = achievement.reward.money;

                    if (this.events) {
                        const mod = await this.events.applyMoneyModifiers(userId, rewardFinal, 'achievements');
                        rewardFinal = mod.finalAmount;
                    }

                    updateData.balance = user.balance + rewardFinal;
                    updateData['stats.totalEarned'] = (user.stats.totalEarned || 0) + rewardFinal;
                }
                               
                await this.economy.updateUser(userId, updateData);
                
                // Agregar XP por separado
                if (achievement.reward.xp) {
                    if (this.events) {
                        const finalResult = await this.events.applyXpModifiers(userId, achievement.reward.xp, 'achievement');
                        await this.economy.addXp(userId, finalResult.finalXp);
                    } else {
                        await this.economy.addXp(userId, achievement.reward.xp);
                    }
                }
                
                completedAchievements.push(achievementId);
                console.log(`🏆 ${userId} completó logro existente: ${achievement.name}`);
            }
        }
        
        return { completedAchievements, silent };
    }

    // Verificar logros para un usuario (VERSION MEJORADA)
    async checkAchievements(userId) {
        await this.initializeUserAchievements(userId);
        const user = await this.economy.getUser(userId);
        const unlockedAchievements = [];

        for (const [achievementId, achievement] of Object.entries(this.achievements)) {
            // Si ya está completado, saltarlo
            if (user.achievements[achievementId] === 'completed') continue;
            
            let currentValue = 0;
            const req = achievement.requirement;
            
            // Obtener valor actual según el tipo de logro
            switch (req.type) {
                case 'money_earned':
                    currentValue = user.stats?.totalEarned || 0;
                    break;
                case 'money_balance':
                    currentValue = user.balance || 0;
                    break;
                case 'level':
                    currentValue = user.level || 1;
                    break;
                case 'messages':
                    currentValue = user.messagesCount || 0;
                    break;
                case 'work_count':
                    currentValue = user.stats?.workCount || 0;
                    break;
                case 'daily_streak':
                    currentValue = user.stats?.dailyStreak || 0;
                    break;
                case 'games_played':
                    currentValue = user.stats?.gamesPlayed || 0;
                    break;
                case 'win_streak':
                    currentValue = user.stats?.currentWinStreak || 0;
                    break;
                case 'total_bet':
                    currentValue = user.stats?.totalBet || 0;
                    break;
                case 'money_given':
                    currentValue = user.stats?.moneyGiven || 0;
                    break;
                case 'achievements_count':
                    // Contar achievements completados
                    currentValue = Object.values(user.achievements || {}).filter(status => status === 'completed').length;
                    break;
                case 'lottery_wins':
                    currentValue = user.stats?.lotteryWins || 0;
                    break;
                case 'inactive_streak':
                    // Calcular días sin usar work ni daily
                    const now = Date.now();
                    const dayInMs = 24 * 60 * 60 * 1000;
                    const lastWork = user.lastWork || 0;
                    const lastDaily = user.lastDaily || 0;
                    const lastActivity = Math.max(lastWork, lastDaily);
                    
                    if (lastActivity === 0) {
                        // Si nunca ha usado work ni daily, no cuenta como inactivo
                        currentValue = 0;
                    } else {
                        const daysInactive = Math.floor((now - lastActivity) / dayInMs);
                        currentValue = daysInactive;
                    }
                    break;
            }
            
            // Verificar si completó el logro
            if (currentValue >= req.value) {
                // Marcar como completado en la base de datos
                const updateData = {
                    [`achievements.${achievementId}`]: 'completed'
                };
                
                // Dar recompensas
                if (achievement.reward.money) {
                    let rewardFinal = achievement.reward.money;

                    if (this.events) {
                        const mod = await this.events.applyMoneyModifiers(userId, rewardFinal, 'achievements');
                        rewardFinal = mod.finalAmount;
                    }

                    updateData.balance = user.balance + rewardFinal;
                    updateData['stats.totalEarned'] = (user.stats.totalEarned || 0) + rewardFinal;
                }

                console.log(`🏆 ${userId} completó logro: ${achievement.name}\nRecompensa: ${achievement.reward.money} balance: ${updateData.balance} totalEarned: ${updateData['stats.totalEarned']}`);

                await this.economy.updateUser(userId, updateData);
                
                // Agregar XP por separado
                if (achievement.reward.xp) {
                    if (this.events) {
                        const finalResult = await this.events.applyXpModifiers(userId, achievement.reward.xp, 'achievement');
                        await this.economy.addXp(userId, finalResult.finalXp);
                    } else {
                        await this.economy.addXp(userId, achievement.reward.xp);
                    }
                }
                
                unlockedAchievements.push(achievementId);
                console.log(`🏆 ${userId} desbloqueó logro: ${achievement.name}`);
            }
        }
        
        return unlockedAchievements;
    }

    // Actualizar estadísticas específicas para logros (VERSION MEJORADA)
    async updateStats(userId, statType, value = 1) {
        const user = await this.economy.getUser(userId);
        const updateData = {};
        
        switch (statType) {
            case 'game_played':
                updateData['stats.gamesPlayed'] = (user.stats?.gamesPlayed || 0) + 1;
                break;
            case 'game_won':
                updateData['stats.gamesWon'] = (user.stats?.gamesWon || 0) + 1;
                updateData['stats.currentWinStreak'] = (user.stats?.currentWinStreak || 0) + 1;
                updateData['stats.bestWinStreak'] = Math.max(user.stats?.bestWinStreak || 0, updateData['stats.currentWinStreak']);
                break;
            case 'game_lost':
                updateData['stats.gamesLost'] = (user.stats?.gamesLost || 0) + 1;
                updateData['stats.currentWinStreak'] = 0;
                break;
            case 'money_bet':
                updateData['stats.totalBet'] = (user.stats?.totalBet || 0) + value;
                break;
            case 'money_given':
                updateData['stats.moneyGiven'] = (user.stats?.moneyGiven || 0) + value;
                break;
            case 'daily_claimed':
                const lastDaily = user.lastDaily;
                const now = Date.now();
                const dayInMs = 24 * 60 * 60 * 1000;
                
                // Verificar si es consecutivo (dentro de 48 horas de la última)
                if (lastDaily && (now - lastDaily) <= (dayInMs * 2)) {
                    updateData['stats.dailyStreak'] = (user.stats?.dailyStreak || 0) + 1;
                } else {
                    updateData['stats.dailyStreak'] = 1;
                }
                updateData['stats.bestDailyStreak'] = Math.max(user.stats?.bestDailyStreak || 0, updateData['stats.dailyStreak']);
                break;
        }
        
        await this.economy.updateUser(userId, updateData);
    }

    // NUEVO: Comando para mostrar logros del usuario
    async handleUserAchievements(message, args) {
        let targetUser = null;
        
        // Verificar si mencionó a alguien
        if (message.mentions.users.size > 0) {
            targetUser = message.mentions.users.first();
        } else if (args.length > 1) {
            // Buscar por ID
            try {
                targetUser = await message.client.users.fetch(args[1]);
            } catch (error) {
                await message.reply('❌ Usuario no encontrado.');
                return;
            }
        }
        
        await this.showUserAchievements(message, targetUser);
    }

    // NUEVO: Comando para mostrar todos los logros
    async handleAllAchievements(message) {
        await this.showAllAchievements(message);
    }

    // NUEVO: Comando para detectar logros existentes
    async handleDetectAchievements(message) {
        const userId = message.author.id;
        
        await message.reply('🔍 Detectando logros existentes...');
        
        const result = await this.detectExistingAchievements(userId);
        
        if (result.completedAchievements.length > 0) {
            await message.reply(`✅ Se detectaron **${result.completedAchievements.length}** logros ya cumplidos y se agregaron a tu perfil. ¡Revisa tus recompensas!`);
            
            // Mostrar los logros completados
            for (const achievementId of result.completedAchievements) {
                await this.notifyAchievements(message, [achievementId]);
            }
        } else {
            await message.reply('📊 No se encontraron logros pendientes por detectar.');
        }
    }

    // NUEVO: Comando para admin - detectar logros de todos los usuarios
    async handleDetectAllAchievements(message) {
        // Verificar permisos de admin (puedes personalizar esto)
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            await message.reply('❌ Solo los administradores pueden usar este comando.');
            return;
        }
        
        await message.reply('🔍 Detectando logros para todos los usuarios...');
        
        try {
            const allUsers = await this.economy.getAllUsers();
            let totalDetected = 0;
            let usersProcessed = 0;
            
            for (const userId of Object.keys(allUsers)) {
                try {
                    const result = await this.detectExistingAchievements(userId, true);
                    totalDetected += result.completedAchievements.length;
                    usersProcessed++;
                } catch (error) {
                    console.error(`Error detectando logros para ${userId}:`, error);
                }
            }
            
            await message.reply(`✅ Proceso completado:\n• **${usersProcessed}** usuarios procesados\n• **${totalDetected}** logros detectados en total`);
        } catch (error) {
            console.error('Error en detectar todos los logros:', error);
            await message.reply('❌ Error procesando usuarios.');
        }
    }

    // Mostrar logros de un usuario (VERSION MEJORADA)
    async showUserAchievements(message, targetUser = null) {
        const userId = targetUser ? targetUser.id : message.author.id;
        const displayName = targetUser ? targetUser.displayName : message.author.displayName;
        
        await this.initializeUserAchievements(userId);
        const user = await this.economy.getUser(userId);
        
        if (!user.achievements) {
            await message.reply('❌ Error cargando logros del usuario.');
            return;
        }
        
        const completedAchievements = Object.entries(user.achievements).filter(([id, status]) => status === 'completed');
        const totalAchievements = Object.keys(this.achievements).length;
        const unlockedCount = completedAchievements.length;
        const progressPercentage = ((unlockedCount / totalAchievements) * 100).toFixed(1);
        
        const embed = new EmbedBuilder()
            .setTitle(`🏆 Logros de ${displayName}`)
            .setDescription(`**${unlockedCount}/${totalAchievements}** logros desbloqueados (${progressPercentage}%)`)
            .setColor('#FFD700')
            .setThumbnail((targetUser || message.author).displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        
        // Mostrar logros desbloqueados por rareza
        if (unlockedCount > 0) {
            const rarityGroups = {
                'legendary': [],
                'epic': [],
                'rare': [],
                'uncommon': [],
                'common': []
            };
            
            // Agrupar por rareza
            for (const [achievementId] of completedAchievements) {
                const achievement = this.achievements[achievementId];
                if (achievement) {
                    rarityGroups[achievement.rarity].push(achievement);
                }
            }
            
            let unlockedText = '';
            for (const [rarity, achievements] of Object.entries(rarityGroups)) {
                if (achievements.length > 0) {
                    const rarityEmoji = this.rarityEmojis[rarity];
                    for (const achievement of achievements) {
                        unlockedText += `${rarityEmoji} ${achievement.emoji} **${achievement.name}**\n`;
                    }
                }
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
            if (user.achievements[achievementId] === 'completed') continue;
            
            const progress = this.calculateProgress(user, achievement);
            if (progress && progress.percentage >= 25) {
                nearCompletion.push({
                    id: achievementId,
                    achievement: achievement,
                    progress: progress
                });
            }
        }
        
        if (nearCompletion.length > 0) {
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

    // NUEVO: Calcular progreso de un logro
    calculateProgress(user, achievement) {
        let currentValue = 0;
        const req = achievement.requirement;
        
        switch (req.type) {
            case 'money_earned':
                currentValue = user.stats?.totalEarned || 0;
                break;
            case 'money_balance':
                currentValue = user.balance || 0;
                break;
            case 'level':
                currentValue = user.level || 1;
                break;
            case 'messages':
                currentValue = user.messagesCount || 0;
                break;
            case 'work_count':
                currentValue = user.stats?.workCount || 0;
                break;
            case 'daily_streak':
                currentValue = user.stats?.dailyStreak || 0;
                break;
            case 'games_played':
                currentValue = user.stats?.gamesPlayed || 0;
                break;
            case 'win_streak':
                currentValue = user.stats?.currentWinStreak || 0;
                break;
            case 'total_bet':
                currentValue = user.stats?.totalBet || 0;
                break;
            case 'money_given':
                currentValue = user.stats?.moneyGiven || 0;
                break;
            case 'achievements_count':
                currentValue = Object.values(user.achievements || {}).filter(status => status === 'completed').length;
                break;
        }
        
        return {
            current: currentValue,
            required: req.value,
            percentage: Math.min(100, (currentValue / req.value) * 100)
        };
    }

    // Mostrar todos los logros disponibles (sin cambios)
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

    // Notificar logros desbloqueados (sin cambios)
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
//                .setThumbnail(achievement.emoji)
                .addFields({
                    name: 'Recompensas',
                    value: `${achievement.reward.money ? `+${this.formatNumber(achievement.reward.money)} π-b$` : ''}\n${achievement.reward.xp ? `+${this.formatNumber(achievement.reward.xp)} XP` : ''}`.trim(),
                    inline: true
                })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });
        }
    }
   
    // NUEVO: Procesador de comandos
    async processCommand(message) {
        if (message.author.bot) return;

        const args = message.content.toLowerCase().split(' ');
        const command = args[0];

        try {
            switch (command) {
                case '>achievements':
                case '>logros':
                case '>ach':
                    await this.handleUserAchievements(message, args);
                    break;
                
                case '>allachievements':
                case '>alllogros':
                case '>todoslogros':
                    await this.handleAllAchievements(message);
                    break;
                
                case '>detectachievements':
                case '>detectlogros':
                case '>detect':
                    await this.handleDetectAchievements(message);
                    break;
                
                case '>detectall':
                    await this.handleDetectAllAchievements(message);
                    break;
                
                default:
                    // No es un comando de achievements
                    break;
            }
        } catch (error) {
            console.error('❌ Error en sistema de logros:', error);
            await message.reply('❌ Ocurrió un error en el sistema de logros. Intenta de nuevo.');
        }
    }
        
    // Método para conectar eventos
    connectEventsSystem(eventsSystem) {
        this.events = eventsSystem;
        console.log('🎮 Sistema de eventos conectado a minijuegos');
    }
}

module.exports = AchievementsSystem;