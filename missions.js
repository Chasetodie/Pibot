const { EmbedBuilder } = require('discord.js');

class MissionsSystem {
    constructor(economySystem) {
        this.economy = economySystem;
        
        // Todas las misiones disponibles
        this.availableMissions = {
            // Misiones de mensajes
            'send_messages_10': {
                id: 'send_messages_10',
                name: '💬 Conversador',
                description: 'Envía 10 mensajes en el servidor',
                type: 'messages',
                target: 10,
                reward: { money: 200, xp: 100 },
                rarity: 'common'
            },
            'send_messages_25': {
                id: 'send_messages_25',
                name: '🗣️ Hablador',
                description: 'Envía 25 mensajes en el servidor',
                type: 'messages',
                target: 25,
                reward: { money: 400, xp: 200 },
                rarity: 'uncommon'
            },
            'send_messages_50': {
                id: 'send_messages_50',
                name: '📢 Locutor',
                description: 'Envía 50 mensajes en el servidor',
                type: 'messages',
                target: 50,
                reward: { money: 800, xp: 400 },
                rarity: 'rare'
            },
            
            // Misiones de trabajo
            'work_once': {
                id: 'work_once',
                name: '🛠️ Un Día de Trabajo',
                description: 'Completa un trabajo exitoso',
                type: 'work',
                target: 1,
                reward: { money: 300, xp: 150 },
                rarity: 'common'
            },
            'work_3_times': {
                id: 'work_3_times',
                name: '💪 Trabajador Dedicado',
                description: 'Completa 3 trabajos en el día',
                type: 'work',
                target: 3,
                reward: { money: 700, xp: 350 },
                rarity: 'uncommon'
            },
            'work_5_times': {
                id: 'work_5_times',
                name: '🏭 Trabajador Incansable',
                description: 'Completa 5 trabajos en el día',
                type: 'work',
                target: 5,
                reward: { money: 1200, xp: 600 },
                rarity: 'rare'
            },
            
            // Misiones de dinero
            'earn_1000': {
                id: 'earn_1000',
                name: '💰 Ganador Modesto',
                description: 'Gana 1,000 π-b$ en el día',
                type: 'money_earned_today',
                target: 1000,
                reward: { money: 500, xp: 200 },
                rarity: 'common'
            },
            'earn_5000': {
                id: 'earn_5000',
                name: '💸 Empresario',
                description: 'Gana 5,000 π-b$ en el día',
                type: 'money_earned_today',
                target: 5000,
                reward: { money: 1000, xp: 400 },
                rarity: 'uncommon'
            },
            'earn_10000': {
                id: 'earn_10000',
                name: '🏆 Magnate',
                description: 'Gana 10,000 π-b$ en el día',
                type: 'money_earned_today',
                target: 10000,
                reward: { money: 2000, xp: 800 },
                rarity: 'rare'
            },
            
            // Misiones de juegos
            'play_games_3': {
                id: 'play_games_3',
                name: '🎮 Jugador Casual',
                description: 'Juega 3 minijuegos',
                type: 'games',
                target: 3,
                reward: { money: 400, xp: 200 },
                rarity: 'common'
            },
            'play_games_10': {
                id: 'play_games_10',
                name: '🎯 Jugador Activo',
                description: 'Juega 10 minijuegos',
                type: 'games',
                target: 10,
                reward: { money: 800, xp: 400 },
                rarity: 'uncommon'
            },
            'win_games_5': {
                id: 'win_games_5',
                name: '🏅 Ganador',
                description: 'Gana 5 minijuegos',
                type: 'games_won',
                target: 5,
                reward: { money: 1000, xp: 500 },
                rarity: 'rare'
            },
            
            // Misiones de transferencias
            'transfer_money': {
                id: 'transfer_money',
                name: '🤝 Generoso',
                description: 'Transfiere 1,000 π-b$ a otro usuario',
                type: 'money_transferred',
                target: 1000,
                reward: { money: 600, xp: 300 },
                rarity: 'uncommon'
            },
            'transfer_money_big': {
                id: 'transfer_money_big',
                name: '💝 Filántropo',
                description: 'Transfiere 5,000 π-b$ a otros usuarios',
                type: 'money_transferred',
                target: 5000,
                reward: { money: 1500, xp: 750 },
                rarity: 'rare'
            },
            
            // Misiones de nivel
            'level_up_once': {
                id: 'level_up_once',
                name: '📈 Crecimiento',
                description: 'Sube de nivel al menos una vez',
                type: 'level_ups',
                target: 1,
                reward: { money: 800, xp: 400 },
                rarity: 'uncommon'
            },
            
            // Misiones de balance
            'maintain_balance_10k': {
                id: 'maintain_balance_10k',
                name: '💎 Rico Mantenido',
                description: 'Mantén un balance de 10,000 π-b$ o más',
                type: 'balance_check',
                target: 10000,
                reward: { money: 1000, xp: 500 },
                rarity: 'uncommon'
            },
            'maintain_balance_50k': {
                id: 'maintain_balance_50k',
                name: '👑 Millonario Activo',
                description: 'Mantén un balance de 50,000 π-b$ o más',
                type: 'balance_check',
                target: 50000,
                reward: { money: 2500, xp: 1000 },
                rarity: 'epic'
            },
            
            // Misiones de apuestas
            'bet_money': {
                id: 'bet_money',
                name: '🎲 Apostador',
                description: 'Apuesta un total de 2,000 π-b$',
                type: 'money_bet',
                target: 2000,
                reward: { money: 800, xp: 300 },
                rarity: 'common'
            },
            'win_bets': {
                id: 'win_bets',
                name: '🍀 Afortunado',
                description: 'Gana 3 apuestas',
                type: 'bets_won',
                target: 3,
                reward: { money: 1200, xp: 500 },
                rarity: 'uncommon'
            },
            
            // Misiones de robos
            'successful_robbery': {
                id: 'successful_robbery',
                name: '🦹 Ladrón Exitoso',
                description: 'Completa un robo exitoso',
                type: 'successful_robberies',
                target: 1,
                reward: { money: 1000, xp: 400 },
                rarity: 'rare'
            },
            
            // Misiones especiales
            'use_daily': {
                id: 'use_daily',
                name: '📅 Rutinario',
                description: 'Reclama tu daily reward',
                type: 'daily_claimed',
                target: 1,
                reward: { money: 300, xp: 150 },
                rarity: 'common'
            },
            'complete_all_missions': {
                id: 'complete_all_missions',
                name: '🏆 Completista Diario',
                description: 'Completa todas las misiones del día',
                type: 'missions_completed',
                target: 4, // Las otras 4 misiones (esta no se cuenta a sí misma)
                reward: { money: 2000, xp: 1000 },
                rarity: 'epic'
            },
            
            // Misiones de actividad social
            'mention_someone': {
                id: 'mention_someone',
                name: '👥 Social',
                description: 'Menciona a 3 usuarios diferentes',
                type: 'mentions_made',
                target: 3,
                reward: { money: 400, xp: 200 },
                rarity: 'common'
            },
            
            // Misiones de constancia
            'active_hours': {
                id: 'active_hours',
                name: '⏰ Activo Todo El Día',
                description: 'Envía mensajes en 6 horas diferentes del día',
                type: 'active_hours',
                target: 6,
                reward: { money: 1500, xp: 600 },
                rarity: 'rare'
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
    
    // Generar misiones del día (se ejecuta automáticamente a las 12 PM)
    generateDailyMissions() {
        const allMissions = Object.values(this.availableMissions);
        const dailyMissions = [];
        
        // Asegurar que al menos una misión de cada rareza esté presente
        const missionsByRarity = {
            common: allMissions.filter(m => m.rarity === 'common'),
            uncommon: allMissions.filter(m => m.rarity === 'uncommon'),
            rare: allMissions.filter(m => m.rarity === 'rare'),
            epic: allMissions.filter(m => m.rarity === 'epic')
        };
        
        // Seleccionar 1 common, 2 uncommon, 1 rare, 1 epic
        const selections = [
            this.getRandomMission(missionsByRarity.common),
            this.getRandomMission(missionsByRarity.uncommon),
            this.getRandomMission(missionsByRarity.uncommon),
            this.getRandomMission(missionsByRarity.rare),
            this.getRandomMission(missionsByRarity.epic)
        ];
        
        // Asegurar que no hay duplicados
        const uniqueSelections = [...new Set(selections.map(m => m.id))];
        while (uniqueSelections.length < 5) {
            const randomMission = allMissions[Math.floor(Math.random() * allMissions.length)];
            if (!uniqueSelections.includes(randomMission.id)) {
                uniqueSelections.push(randomMission.id);
                selections.push(randomMission);
            }
        }
        
        return selections.slice(0, 5).map(mission => ({
            id: mission.id,
            completed: false
        }));
    }
    
    getRandomMission(missionsArray) {
        return missionsArray[Math.floor(Math.random() * missionsArray.length)];
    }
    
    // Obtener el día actual en formato YYYY-MM-DD
    getCurrentDay() {
        const now = new Date();
        // Convertir a zona horaria de Ecuador (UTC-5)
        const ecuadorTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        return ecuadorTime.toISOString().split('T')[0]; // Formato YYYY-MM-DD
    }

    // Agregar esta función después de getCurrentDay()
    resetDailyFlag(user) {
        const now = new Date();
        const ecuadorTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        const today = ecuadorTime.toISOString().split('T')[0];
        const currentHour = ecuadorTime.getHours();
        
        if (user.daily_missions_date !== today) {
            return { missions_reset_today: false };
        }
        return {};
    }
    
    // Verificar si es hora de resetear misiones (12 PM)
    shouldResetMissions(user) {
        const now = new Date();
        // Convertir a zona horaria de Ecuador (UTC-5)
        const ecuadorTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        const today = ecuadorTime.toISOString().split('T')[0];
        
        const userMissionsDate = user.daily_missions_date;
        
        // Solo resetear si es un día diferente Y ya pasaron las 12 PM, o si es el mismo día pero aún no se han reseteado hoy después de las 12 PM
        if (!userMissionsDate) return true; // Primera vez del usuario
        if (userMissionsDate !== today) return true; // Día diferente
        return false; // Mismo día, no resetear
    }
    
    // Inicializar misiones diarias para un usuario

    
    async initializeDailyMissions(userId) {
        const user = await this.economy.getUser(userId);

        // Resetear bandera si es necesario
        const flagReset = this.resetDailyFlag(user);
        if (Object.keys(flagReset).length > 0) {
            await this.economy.updateUser(userId, flagReset);
        }
        
        if (this.shouldResetMissions(user)) {
            const newMissions = this.generateDailyMissions();
            const today = this.getCurrentDay();
            
            const updateData = {
                daily_missions: newMissions.reduce((obj, mission) => {
                    obj[mission.id] = 'incomplete';
                    return obj;
                }, {}),
                daily_missions_date: today,
                missions_reset_today: true,
                daily_stats: {
                    messages_today: 0,
                    work_today: 0,
                    money_earned_today: 0,
                    games_today: 0,
                    games_won_today: 0,
                    money_transferred_today: 0,
                    level_ups_today: 0,
                    money_bet_today: 0,
                    bets_won_today: 0,
                    successful_robberies_today: 0,
                    daily_claimed_today: false,
                    mentions_made_today: 0,
                    active_hours_today: []
                }
            };
            
            await this.economy.updateUser(userId, updateData);
            console.log(`🎯 Misiones diarias inicializadas para ${userId}`);
            
            return newMissions;
        }
        
        return user.daily_missions || {};
    }
    
    // Actualizar progreso de misiones
    async updateMissionProgress(userId, actionType, value = 1) {
        await this.initializeDailyMissions(userId);
        const user = await this.economy.getUser(userId);
        
        if (!user.daily_missions || !user.daily_stats) return;
        
        const updateData = {};
        const completedMissions = [];
        
        // Actualizar estadísticas diarias según el tipo de acción
        switch (actionType) {
            case 'message':
                updateData.daily_stats = {
                    ...user.daily_stats,
                    messages_today: (user.daily_stats.messages_today || 0) + 1
                };
                
                // Agregar hora actual para misión de active_hours
                const currentHour = new Date().getHours();
                const activeHours = user.daily_stats.active_hours_today || [];
                if (!activeHours.includes(currentHour)) {
                    activeHours.push(currentHour);
                    updateData.daily_stats = {
                        ...user.daily_stats,
                        active_hours_today: activeHours
                    };
                }
                break;
            case 'work':
                updateData.daily_stats = {
                    ...user.daily_stats,
                    work_today: (user.daily_stats.work_today || 0) + 1
                };
                break;
            case 'money_earned':
                updateData.daily_stats = {
                    ...user.daily_stats,
                    money_earned_today: (user.daily_stats.money_earned_today || 0) + value
                };
                break;                
            case 'game_played':
                updateData.daily_stats = {
                    ...user.daily_stats,
                    games_today: (user.daily_stats.games_today || 0) + 1
                };
                break;
                
            case 'game_won':
                updateData.daily_stats = {
                    ...user.daily_stats,
                    games_won_today: (user.daily_stats.games_won_today || 0) + 1
                };
                break;
                
            case 'money_transferred':
                updateData.daily_stats = {
                    ...user.daily_stats,
                    money_transferred_today: (user.daily_stats.money_transferred_today || 0) + value
                };
                break;
                
            case 'level_up':
                updateData.daily_stats = {
                    ...user.daily_stats,
                    level_ups_today: (user.daily_stats.level_ups_today || 0) + 1
                };
                break;
                
            case 'money_bet':
                updateData.daily_stats = {
                    ...user.daily_stats,
                    money_bet_today: (user.daily_stats.money_bet_today || 0) + value
                };
                break;
                
            case 'bet_won':
                updateData.daily_stats = {
                    ...user.daily_stats,
                    bets_won_today: (user.daily_stats.bets_won_today || 0) + 1
                };
                break;
                
            case 'successful_robbery':
                updateData.daily_stats = {
                    ...user.daily_stats,
                    successful_robberies_today: (user.daily_stats.successful_robberies_today || 0) + 1
                };
                break;
                
            case 'daily_claimed':
                updateData.daily_stats = {
                    ...user.daily_stats,
                    daily_claimed_today: true
                };
                break;
                
            case 'mention_made':
                updateData.daily_stats = {
                    ...user.daily_stats,
                    mentions_made_today: (user.daily_stats.mentions_made_today || 0) + 1
                };
                break;
        }
        
        // Verificar progreso de cada misión
        for (const [missionId, status] of Object.entries(user.daily_missions)) {
            if (status === 'completed') continue;
            
            const mission = this.availableMissions[missionId];
            if (!mission) continue;
            
            const currentProgress = this.getCurrentProgress(user, mission);
            
            if (currentProgress >= mission.target) {
                updateData.daily_missions = {
                    ...user.daily_missions,
                    [missionId]: 'completed'
                };
                completedMissions.push(missionId);
                
                // Dar recompensas
                if (mission.reward.money) {
                    let rewardFinal = mission.reward.money;
                    
                    updateData.balance = user.balance + rewardFinal;
                    updateData.stats = {
                        ...user.stats,
                        total_earned: (user.stats.total_earned || 0) + rewardFinal
                    };
                }
            }
        }
        
        // Actualizar base de datos
        await this.economy.updateUser(userId, updateData);
        
        // Agregar XP por separado para las misiones completadas
        for (const missionId of completedMissions) {
            const mission = this.availableMissions[missionId];
            if (mission.reward.xp) {
                await this.economy.addXp(userId, mission.reward.xp);
            }
        }
        
        return completedMissions;
    }
    
    // Obtener progreso actual de una misión
    getCurrentProgress(user, mission) {
        const stats = user.daily_stats || {};
        
        switch (mission.type) {
            case 'messages':
                return stats.messages_today || 0;
            case 'work':
                return stats.work_today || 0;
            case 'money_earned_today':
                return stats.money_earned_today || 0;
            case 'games':
                return stats.games_today || 0;
            case 'games_won':
                return stats.games_won_today || 0;
            case 'money_transferred':
                return stats.money_transferred_today || 0;
            case 'level_ups':
                return stats.level_ups_today || 0;
            case 'balance_check':
                return user.balance || 0;
            case 'money_bet':
                return stats.money_bet_today || 0;
            case 'bets_won':
                return stats.bets_won_today || 0;
            case 'successful_robberies':
                return stats.successful_robberies_today || 0;
            case 'daily_claimed':
                return stats.daily_claimed_today ? 1 : 0;
            case 'missions_completed':
                return Object.values(user.daily_missions || {}).filter(status => status === 'completed').length;
            case 'mentions_made':
                return stats.mentions_made_today || 0;
            case 'active_hours':
                return (stats.active_hours_today || []).length;
            default:
                return 0;
        }
    }
    
    // Mostrar misiones del usuario
    async showUserMissions(message, targetUser = null) {
        const userId = targetUser ? targetUser.id : message.author.id;
        const displayName = targetUser ? targetUser.displayName : message.author.displayName;
        
        await this.initializeDailyMissions(userId);
        const user = await this.economy.getUser(userId);
        
        const embed = new EmbedBuilder()
            .setTitle(`🎯 Misiones Diarias de ${displayName}`)
            .setDescription(`Misiones disponibles para hoy`)
            .setColor('#FFD700')
            .setThumbnail((targetUser || message.author).displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        
        if (!user.daily_missions) {
            embed.addFields({
                name: '❌ Sin Misiones',
                value: 'No hay misiones disponibles para hoy.',
                inline: false
            });
            
            await message.reply({ embeds: [embed] });
            return;
        }
        
        let completedCount = 0;
        let missionText = '';
        
        for (const [missionId, status] of Object.entries(user.daily_missions)) {
            const mission = this.availableMissions[missionId];
            if (!mission) continue;
            
            const isCompleted = status === 'completed';
            if (isCompleted) completedCount++;
            
            const currentProgress = this.getCurrentProgress(user, mission);
            const progressPercent = Math.min(100, (currentProgress / mission.target) * 100);
            
            const statusEmoji = isCompleted ? '✅' : '⏳';
            const rarityEmoji = this.rarityEmojis[mission.rarity];
            const progressBar = this.createProgressBar(currentProgress, mission.target, 8);
            
            missionText += `${statusEmoji} ${rarityEmoji} **${mission.name}**\n`;
            missionText += `${mission.description}\n`;
            missionText += `\`${progressBar}\` ${currentProgress}/${mission.target}\n`;
            
            if (isCompleted) {
                missionText += `💰 **Completada** - Recompensa obtenida\n\n`;
            } else {
                const rewards = [];
                if (mission.reward.money) rewards.push(`${mission.reward.money} π-b$`);
                if (mission.reward.xp) rewards.push(`${mission.reward.xp} XP`);
                missionText += `🎁 Recompensa: ${rewards.join(' + ')}\n\n`;
            }
        }
        
        embed.addFields({
            name: `📊 Progreso Total (${completedCount}/5)`,
            value: missionText || 'Sin misiones disponibles',
            inline: false
        });
        
        // Mostrar tiempo restante para reset (12 PM Ecuador)
        const now = new Date();
        const ecuadorTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        
        // CAMBIAR: Calcular próximo reset a medianoche
        let nextReset = new Date(ecuadorTime);
        nextReset.setDate(nextReset.getDate() + 1); // Próximo día
        nextReset.setHours(0, 0, 0, 0); // A las 00:00
        
        // Convertir de vuelta a UTC para comparar con 'now'
        const nextResetUTC = new Date(nextReset.getTime() + (5 * 60 * 60 * 1000));
        const timeLeft = nextResetUTC.getTime() - now.getTime();
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        embed.setFooter({ 
            text: `⏰ Nuevas misiones en: ${hoursLeft}h ${minutesLeft}m`
        });
        
        await message.reply({ embeds: [embed] });
    }
    
    // Crear barra de progreso
    createProgressBar(current, max, length = 8) {
        const percentage = Math.max(0, Math.min(1, current / max));
        const filledLength = Math.floor(percentage * length);
        const emptyLength = length - filledLength;
        
        return '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    }
    
    // Notificar misiones completadas
    async notifyCompletedMissions(message, completedMissions) {
        if (completedMissions.length === 0) return;
        
        for (const missionId of completedMissions) {
            const mission = this.availableMissions[missionId];
            if (!mission) continue;
            
            const rarityColor = this.rarityColors[mission.rarity];
            const rarityEmoji = this.rarityEmojis[mission.rarity];
            
            const embed = new EmbedBuilder()
                .setTitle('🎉 ¡Misión Completada!')
                .setDescription(`${rarityEmoji} **${mission.name}**\n\n*${mission.description}*`)
                .setColor(rarityColor)
                .setTimestamp();
            
            const rewards = [];
            if (mission.reward.money) rewards.push(`+${mission.reward.money} π-b$`);
            if (mission.reward.xp) rewards.push(`+${mission.reward.xp} XP`);
            
            if (rewards.length > 0) {
                embed.addFields({
                    name: '🎁 Recompensas',
                    value: rewards.join('\n'),
                    inline: true
                });
            }
            
            await message.channel.send({ embeds: [embed] });
        }
    }
    
    // Procesador de comandos
    async processCommand(message) {
        if (message.author.bot) return;
        
        const args = message.content.toLowerCase().split(' ');
        const command = args[0];
        
        try {
            switch (command) {
                case '>missions':
                case '>misiones':
                case '>dailymissions':
                    let targetUser = null;
                    if (message.mentions.users.size > 0) {
                        targetUser = message.mentions.users.first();
                    }
                    await this.showUserMissions(message, targetUser);
                    break;
            }
        } catch (error) {
            console.error('❌ Error en sistema de misiones:', error);
            await message.reply('❌ Ocurrió un error en el sistema de misiones. Intenta de nuevo.');
        }
    }
}

module.exports = MissionsSystem;
