const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

class LocalDatabase {
    constructor() {
        this.pool = null;
        this.userCache = new Map();
        this.cacheTimeout = 10 * 60 * 1000;
        this.MAX_CACHE_SIZE = 500;
        this.init();

        // Limpieza automática cada 24 horas
        setInterval(() => {
            this.cleanOldGameLimits();
            this.cleanOldNotifications();
        }, 24 * 60 * 60 * 1000);
    }

    async init() {
        try {
            // Configuración corregida para mysql2
            this.pool = mysql.createPool({
                host: 'sql3.freesqldatabase.com',
                port: 3306,
                user: 'sql3814346',
                password: 'VFjMPfrHY9',
                database: 'sql3814346',
                connectionLimit: 3,
                waitForConnections: true,
                queueLimit: 0
                // Removidas opciones que causan warnings
            });
            
            console.log('✅ MySQL Pool conectado');
            await this.initTables();
        } catch (err) {
            console.error('❌ Error conectando a MySQL:', err);
        }
    }

    async initTables() {
        try {
            // Tabla de usuarios principal - JSON cambiado a TEXT
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(255) PRIMARY KEY,
                    balance INT DEFAULT 0,
                    level INT DEFAULT 1,
                    xp INT DEFAULT 0,
                    total_xp INT DEFAULT 0,
                    last_daily BIGINT DEFAULT 0,
                    last_work BIGINT DEFAULT 0,
                    last_robbery BIGINT DEFAULT 0,
                    last_coinflip BIGINT DEFAULT 0,
                    last_dice BIGINT DEFAULT 0,
                    last_roulette BIGINT DEFAULT 0,
                    last_lotto BIGINT DEFAULT 0,
                    last_blackjack BIGINT DEFAULT 0,
                    last_slots BIGINT DEFAULT 0,
                    last_name_work TEXT,
                    messages_count INT DEFAULT 0,
                    items TEXT,
                    stats TEXT,
                    bet_stats TEXT,
                    daily_missions TEXT,
                    daily_missions_date TEXT,
                    daily_stats TEXT,
                    achievements TEXT,
                    missions_reset_today BOOLEAN DEFAULT 0,
                    missions_notifications_blocked BOOLEAN DEFAULT 0,
                    cosmetics TEXT,
                    permanentEffects TEXT,
                    activeEffects TEXT,
                    passiveIncomeStats TEXT,
                    vipStats TEXT,
                    lastPassivePayout BIGINT DEFAULT 0
                )
            `);

            // Tabla para trades
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS trades (
                    id VARCHAR(255) PRIMARY KEY,
                    initiator TEXT NOT NULL,
                    target TEXT NOT NULL,
                    initiator_offer TEXT,
                    target_offer TEXT,
                    initiator_money_offer INTEGER DEFAULT 0,
                    target_money_offer INTEGER DEFAULT 0,
                    status TEXT,
                    initiator_accepted BOOLEAN DEFAULT 0,
                    target_accepted BOOLEAN DEFAULT 0
                )
            `);

            // Tabla para apuestas
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS bets (
                    id VARCHAR(255) PRIMARY KEY,
                    challenger TEXT NOT NULL,
                    opponent TEXT NOT NULL,
                    amount INTEGER DEFAULT 0,
                    description TEXT,
                    status TEXT,
                    expires_at BIGINT DEFAULT NULL,
                    channel_id TEXT DEFAULT NULL
                )
            `);            

            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS russian_games (
                    id VARCHAR(255) PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    creator_id TEXT NOT NULL,
                    bet_amount INTEGER NOT NULL,
                    players TEXT,
                    phase TEXT,
                    current_player_index INTEGER DEFAULT 0,
                    bullet_position INTEGER DEFAULT 0,
                    current_shot INTEGER DEFAULT 0,
                    pot INTEGER DEFAULT 0,
                    processing BOOLEAN DEFAULT 1
                )
            `);

            // Tabla para partidas UNO
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS uno_games (
                    id VARCHAR(255) PRIMARY KEY,
                    creator_id TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    bet_amount INTEGER NOT NULL,
                    variant VARCHAR(50) DEFAULT 'classic',
                    players TEXT,
                    phase TEXT,
                    game_data TEXT
                )
            `);

            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS server_events (
                    id VARCHAR(255) PRIMARY KEY,
                    type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    emoji TEXT,
                    color TEXT,
                    start_time TEXT,
                    end_time TEXT,
                    duration INTEGER,
                    multipliers TEXT,
                    is_special BOOLEAN DEFAULT 0,
                    is_negative BOOLEAN DEFAULT 0,
                    is_rare BOOLEAN DEFAULT 0,
                    triggered_by TEXT,
                    participant_count INTEGER DEFAULT 0,
                    stats TEXT
                )
            `);

            // Tabla para subastas
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS auctions (
                    id VARCHAR(255) PRIMARY KEY,
                    seller TEXT NOT NULL,
                    item_id TEXT,
                    item_name TEXT NOT NULL,
                    starting_bid INTEGER NOT NULL,
                    current_bid INTEGER,
                    highest_bidder TEXT,
                    bids TEXT,
                    ends_at TEXT NOT NULL,
                    active BOOLEAN DEFAULT 1,
                    channel_id TEXT
                )
            `);

            // Agregar después de la tabla de auctions
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS crafting_queue (
                    id VARCHAR(255) PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    recipe_id TEXT NOT NULL,
                    recipe_name TEXT NOT NULL,
                    completes_at TEXT NOT NULL,
                    status TEXT,
                    result_item_id TEXT NOT NULL,
                    result_quantity INTEGER DEFAULT 1,
                    channel_id TEXT
                )
            `);

            // Tabla para conversaciones de chat
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS chat_conversations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    role ENUM('user', 'assistant') NOT NULL,
                    content TEXT NOT NULL,
                    display_name VARCHAR(100),
                    timestamp BIGINT NOT NULL,
                    INDEX idx_user_timestamp (user_id, timestamp)
                )
            `);

            // Tabla para pozo semanal - NUEVO DISEÑO
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS weekly_pot (
                    week_start BIGINT PRIMARY KEY,
                    total_money INT DEFAULT 0,
                    participant_count INT DEFAULT 0,
                    status ENUM('active', 'completed') DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    distributed_at TIMESTAMP NULL,
                    winner_money VARCHAR(255) NULL,
                    winner_items TEXT NULL
                )
            `);

            // Tabla para contribuciones individuales
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS pot_contributions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    week_start BIGINT NOT NULL,
                    user_id VARCHAR(255) NOT NULL,
                    contribution_type ENUM('money', 'item') NOT NULL,
                    amount INT DEFAULT 0,
                    item_id VARCHAR(255) NULL,
                    item_name VARCHAR(255) NULL,
                    contributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_week_user (week_start, user_id),
                    FOREIGN KEY (week_start) REFERENCES weekly_pot(week_start) ON DELETE CASCADE
                )
            `);

            // Tabla para contadores globales del servidor
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS server_counters (
                    id VARCHAR(50) PRIMARY KEY,
                    value INT DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

            // Inicializar contadores si no existen
            await this.pool.execute(`
                INSERT IGNORE INTO server_counters (id, value) VALUES 
                ('pibe_counter', 0),
                ('piba_counter', 0)
            `);

            // ✅ AGREGAR ESTA TABLA:
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS daily_game_limits (
                    user_id VARCHAR(255) NOT NULL,
                    game_type VARCHAR(50) NOT NULL,
                    date DATE NOT NULL,
                    cycle_count INT DEFAULT 0,
                    daily_count INT DEFAULT 0,
                    cycle_reset BIGINT NOT NULL,
                    PRIMARY KEY (user_id, game_type, date),
                    INDEX idx_date (date)
                )
            `);
            
            // ✅ AGREGAR TABLA DE NOTIFICACIONES:
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS limit_notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    game_type VARCHAR(50) NOT NULL,
                    channel_id VARCHAR(255) NOT NULL,
                    notify_at BIGINT NOT NULL,
                    notified BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_notify (notify_at, notified),
                    INDEX idx_user (user_id)
                )
            `);

            console.log('🗃️ Tablas MySQL inicializadas');
        } catch (error) {
            console.error('❌ Error creando tablas:', error);
        }
    }

    async getGameLimitStatus(userId, gameType, cycleHours) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const now = Date.now();
            
            const [rows] = await this.pool.execute(
                'SELECT * FROM daily_game_limits WHERE user_id = ? AND game_type = ? AND date = ?',
                [userId, gameType, today]
            );
            
            if (rows.length === 0) {
                // Primera jugada del día
                const cycleReset = now + (cycleHours * 60 * 60 * 1000);
                
                await this.pool.execute(`
                    INSERT INTO daily_game_limits (user_id, game_type, cycle_count, daily_count, cycle_reset, date)
                    VALUES (?, ?, 0, 0, ?, ?)
                `, [userId, gameType, cycleReset, today]);
                               
                return { cycleCount: 0, dailyCount: 0, cycleReset };
            }
            
            const record = rows[0];
                       
            // Verificar si el ciclo expiró
            if (now >= record.cycle_reset) {
                // Reset del ciclo
                const newCycleReset = now + (cycleHours * 60 * 60 * 1000);
                
                await this.pool.execute(`
                    UPDATE daily_game_limits 
                    SET cycle_count = 0, cycle_reset = ?
                    WHERE user_id = ? AND game_type = ? AND date = ?
                `, [newCycleReset, userId, gameType, today]);
                                
                return { cycleCount: 0, dailyCount: record.daily_count, cycleReset: newCycleReset };
            }
                        
            return {
                cycleCount: record.cycle_count,
                dailyCount: record.daily_count,
                cycleReset: record.cycle_reset
            };
        } catch (error) {
            console.error('Error obteniendo estado de límites:', error);
            return { cycleCount: 0, dailyCount: 0, cycleReset: Date.now };
        }
    }

    async incrementGameLimit(userId, gameType) {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            await this.pool.execute(`
                UPDATE daily_game_limits 
                SET cycle_count = cycle_count + 1,
                    daily_count = daily_count + 1
                WHERE user_id = ? AND game_type = ? AND date = ?
            `, [userId, gameType, today]);

            return true;
        } catch (error) {
            console.error('Error incrementando límite:', error);
            return false;
        }
    }

    async cleanOldGameLimits() {
        try {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const dateStr = threeDaysAgo.toISOString().split('T')[0];
            
            const [result] = await this.pool.execute(
                'DELETE FROM daily_game_limits WHERE date < ?',
                [dateStr]
            );
            
            console.log(`🗑️ Limpiados ${result.affectedRows} registros antiguos de límites`);
        } catch (error) {
            console.error('Error limpiando límites antiguos:', error);
        }
    }

    async createLimitNotification(userId, gameType, channelId, notifyAt) {
        try {
            // Eliminar notificaciones pendientes anteriores del mismo juego
            await this.pool.execute(
                'DELETE FROM limit_notifications WHERE user_id = ? AND game_type = ? AND notified = 0',
                [userId, gameType]
            );
            
            // Crear nueva notificación
            await this.pool.execute(`
                INSERT INTO limit_notifications (user_id, game_type, channel_id, notify_at)
                VALUES (?, ?, ?, ?)
            `, [userId, gameType, channelId, notifyAt]);
            
            return true;
        } catch (error) {
            console.error('Error creando notificación de límite:', error);
            return false;
        }
    }

    async getPendingNotifications() {
        try {
            const now = Date.now();
            const [rows] = await this.pool.execute(
                'SELECT * FROM limit_notifications WHERE notify_at <= ? AND notified = 0',
                [now]
            );
            return rows;
        } catch (error) {
            console.error('Error obteniendo notificaciones pendientes:', error);
            return [];
        }
    }

    async markNotificationAsSent(notificationId) {
        try {
            await this.pool.execute(
                'UPDATE limit_notifications SET notified = 1 WHERE id = ?',
                [notificationId]
            );
            return true;
        } catch (error) {
            console.error('Error marcando notificación como enviada:', error);
            return false;
        }
    }

    async cleanOldNotifications() {
        try {
            const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
            const [result] = await this.pool.execute(
                'DELETE FROM limit_notifications WHERE notified = 1 AND created_at < FROM_UNIXTIME(?)',
                [twoDaysAgo / 1000]
            );
            console.log(`🗑️ Limpiadas ${result.affectedRows} notificaciones antiguas`);
        } catch (error) {
            console.error('Error limpiando notificaciones:', error);
        }
    }

    // Obtener contador
    async getCounter(counterId) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT value FROM server_counters WHERE id = ?',
                [counterId]
            );
            return rows[0] ? rows[0].value : 0;
        } catch (error) {
            console.error(`❌ Error obteniendo contador ${counterId}:`, error);
            return 0;
        }
    }

    // Incrementar contador y devolver nuevo valor
    async incrementCounter(counterId) {
        try {
            await this.pool.execute(
                'UPDATE server_counters SET value = value + 1 WHERE id = ?',
                [counterId]
            );
            
            const [rows] = await this.pool.execute(
                'SELECT value FROM server_counters WHERE id = ?',
                [counterId]
            );
            
            return rows[0] ? rows[0].value : 0;
        } catch (error) {
            console.error(`❌ Error incrementando contador ${counterId}:`, error);
            return 0;
        }
    }

    // Decrementar contador (para cuando alguien sale del servidor)
    async decrementCounter(counterId) {
        try {
            await this.pool.execute(
                'UPDATE server_counters SET value = GREATEST(0, value - 1) WHERE id = ?',
                [counterId]
            );
            
            const [rows] = await this.pool.execute(
                'SELECT value FROM server_counters WHERE id = ?',
                [counterId]
            );
            
            return rows[0] ? rows[0].value : 0;
        } catch (error) {
            console.error(`❌ Error decrementando contador ${counterId}:`, error);
            return 0;
        }
    }

    // Métodos para Weekly Pot - NUEVO SISTEMA
    async getCurrentWeeklyPot() {
        try {
            const weekStart = this.getWeekStart();
            
            // Crear pozo si no existe
            await this.pool.execute(`
                INSERT IGNORE INTO weekly_pot (week_start) VALUES (?)
            `, [weekStart]);
            
            // Obtener pozo actual
            const [rows] = await this.pool.execute(`
                SELECT * FROM weekly_pot WHERE week_start = ? AND status = 'active'
            `, [weekStart]);
            
            return rows[0] || null;
        } catch (error) {
            console.error('Error obteniendo pozo actual:', error);
            return null;
        }
    }

    async addPotContribution(weekStart, userId, type, amount = 0, itemId = null, itemName = null) {
        try {
            // Insertar contribución
            await this.pool.execute(`
                INSERT INTO pot_contributions (week_start, user_id, contribution_type, amount, item_id, item_name)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [weekStart, userId, type, amount, itemId, itemName]);
            
            // Actualizar totales en weekly_pot
            if (type === 'money') {
                await this.pool.execute(`
                    UPDATE weekly_pot 
                    SET total_money = total_money + ?,
                        participant_count = (
                            SELECT COUNT(DISTINCT user_id) 
                            FROM pot_contributions 
                            WHERE week_start = ?
                        )
                    WHERE week_start = ?
                `, [amount, weekStart, weekStart]);
            } else {
                await this.pool.execute(`
                    UPDATE weekly_pot 
                    SET participant_count = (
                        SELECT COUNT(DISTINCT user_id) 
                        FROM pot_contributions 
                        WHERE week_start = ?
                    )
                    WHERE week_start = ?
                `, [weekStart, weekStart]);
            }
            
            return true;
        } catch (error) {
            console.error('Error agregando contribución:', error);
            return false;
        }
    }

    async getPotContributions(weekStart, userId = null) {
        try {
            let query = `
                SELECT * FROM pot_contributions 
                WHERE week_start = ?
            `;
            let params = [weekStart];
            
            if (userId) {
                query += ' AND user_id = ?';
                params.push(userId);
            }
            
            query += ' ORDER BY contributed_at DESC';
            
            const [rows] = await this.pool.execute(query, params);
            return rows;
        } catch (error) {
            console.error('Error obteniendo contribuciones:', error);
            return [];
        }
    }

    async completePot(weekStart, winnerMoney, winnerItems) {
        try {
            await this.pool.execute(`
                UPDATE weekly_pot 
                SET status = 'completed',
                    distributed_at = NOW(),
                    winner_money = ?,
                    winner_items = ?
                WHERE week_start = ?
            `, [winnerMoney, JSON.stringify(winnerItems), weekStart]);
            
            return true;
        } catch (error) {
            console.error('Error completando pozo:', error);
            return false;
        }
    }

    getWeekStart() {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = domingo, 1 = lunes, etc.
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        const monday = new Date(now);
        monday.setDate(now.getDate() - daysToMonday);
        monday.setHours(0, 0, 0, 0); // Medianoche del lunes
        
        return monday.getTime();
    }

    // En LocalDatabase, agregar este método:
    async getCraftById(craftId) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM crafting_queue WHERE id = ? AND status = ?',
                [craftId, 'in_progress']
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('❌ Error obteniendo craft por ID:', error);
            return null;
        }
    }

    async cancelCraft(craftId) {
        try {
            await this.pool.execute(
                'UPDATE crafting_queue SET status = ? WHERE id = ?',
                ['cancelled', craftId]
            );
            return true;
        } catch (error) {
            console.error('❌ Error cancelando craft:', error);
            return false;
        }
    }

    // Métodos para Crafting System
    async getCraftingQueue(userId) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM crafting_queue WHERE user_id = ? AND status = ? ORDER BY completes_at ASC',
                [userId, 'in_progress']
            );
            return rows;
        } catch (error) {
            console.error('❌ Error obteniendo cola de crafteo:', error);
            return [];
        }
    }

    async getCompletedCrafts() {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM crafting_queue WHERE completes_at <= ? AND status = ?',
                [new Date().toISOString(), 'in_progress']
            );
            return rows;
        } catch (error) {
            console.error('❌ Error obteniendo crafteos completados:', error);
            return [];
        }
    }

    async addCraftToQueue(craftData) {
        try {
            await this.pool.execute(`
                INSERT INTO crafting_queue (id, user_id, recipe_id, recipe_name, completes_at, result_item_id, result_quantity, status, channel_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                craftData.id,
                craftData.user_id,
                craftData.recipe_id,
                craftData.recipe_name,
                craftData.completes_at,
                craftData.result_item_id,
                craftData.result_quantity,
                'in_progress',
                craftData.channel_id
            ]);
            return true;
        } catch (error) {
            console.error('❌ Error agregando craft a cola:', error);
            throw error;
        }
    }

    async completeCraftInDB(craftId) {
        try {
            await this.pool.execute(
                'UPDATE crafting_queue SET status = ? WHERE id = ?',
                ['completed', craftId]
            );
            return true;
        } catch (error) {
            console.error('❌ Error completando craft en DB:', error);
            return false;
        }
    }

    safeJsonParse(jsonString, defaultValue = {}) {
        try {
            // Si no es string o está vacío, devolver defaultValue
            if (typeof jsonString !== 'string' || jsonString.trim() === '') {
                return defaultValue;
            }
            
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('❌ Error parseando JSON:', error);
            console.error('❌ String problemático:', jsonString); // Para debug
            return defaultValue;
        }
    }

    async getUser(userId) {
        const cached = this.userCache.get(userId);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.data;
        }
        
        try {
            if (!this.pool) {
                await this.init();
            }
            
            const [rows] = await this.pool.execute(
                'SELECT * FROM users WHERE id = ?',
                [userId]
            );

            if (rows.length > 0) {
                const user = rows[0];
                // Parsear campos JSON de manera segura
                user.items = this.safeJsonParse(user.items || '{}', {});
                user.stats = this.safeJsonParse(user.stats || '{}', {});
                user.bet_stats = this.safeJsonParse(user.bet_stats || '{}', {});
                user.daily_missions = this.safeJsonParse(user.daily_missions || '{}', {});
                user.daily_stats = this.safeJsonParse(user.daily_stats || '{}', {});
                user.achievements = this.safeJsonParse(user.achievements || '{}', {});

                // Guardar en caché antes de retornar
                this.userCache.set(userId, {
                    data: user, // o newUser
                    timestamp: Date.now()
                });
                
                // Limpiar caché si es muy grande
                if (this.userCache.size > this.MAX_CACHE_SIZE) {
                    const oldest = [...this.userCache.entries()]
                        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
                    this.userCache.delete(oldest[0]);
                }
                
                return user;
            }

            const newUser = {
                id: userId,
                balance: 0,
                level: 1,
                xp: 0,
                total_xp: 0,
                last_daily: 0,
                last_work: 0,
                last_robbery: 0,
                last_coinflip: 0,
                last_dice: 0,
                last_roulette: 0,
                last_lotto: 0,
                last_blackjack: 0,
                last_slots: 0,
                last_name_work: "",
                messages_count: 0,
                items: {},
                vipStats: {},
                stats: {
                    totalEarned: 0,
                    totalSpent: 0,
                    dailyClaims: 0,
                    work_count: 0,
                    games_played: 0,
                    lottery_wins: 0,
                    robberies: 0,
                    robberies_successful: 0,
                    moneyStolen: 0,
                    timesRobbed: 0,
                    money_lost_to_robbers: 0,
                    message_missions: "",
                    message_achievements: "",
                    message_achievements2: "",
                    message_missions2:"",
                    daily_streak: 0,
                    best_daily_streak: 0,
                    games_won: 0,
                    current_win_streak: 0,
                    best_win_streak: 0,
                    total_bet: 0,
                    max_single_bet_win: 0,
                    money_given: 0,
                    games_lost: 0,
                    triple_seven_count: 0,
                    diamond_jackpot_count: 0,
                    slots_doubles: 0,
                    current_loss_streak: 0, 
                    auctions_won: 0, 
                    items_crafted: 0,
                    vending_plays: 0,
                },
                bet_stats: {
                    wins: 0,
                    losses: 0,
                    total_won: 0,
                    total_lost: 0,
                    net_profit: 0
                },
                daily_missions: {},
                daily_missions_date: null,
                daily_stats: {
                    messages_today: 0,
                    work_today: 0,
                    money_earned_today: 0
                },
                achievements: {},
                passiveIncomeStats: {
                    totalEarned: 0,
                    lastPayout: 0,
                    payoutCount: 0
                },
                lastPassivePayout: 0,
                last_vending: 0,
            };

            await this.pool.execute(`
                INSERT INTO users (
                    id, balance, level, xp, total_xp, last_daily, last_work,
                    last_robbery, last_coinflip, last_dice, last_roulette,
                    last_lotto, last_blackjack, last_slots, last_name_work, messages_count,
                    items, stats, bet_stats, daily_missions, daily_missions_date,
                    daily_stats, achievements, passiveIncomeStats, lastPassivePayout,
                    last_vending
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                newUser.id, newUser.balance, newUser.level, newUser.xp, newUser.total_xp,
                newUser.last_daily, newUser.last_work, newUser.last_robbery,
                newUser.last_coinflip, newUser.last_dice, newUser.last_roulette,
                newUser.last_lotto, newUser.last_blackjack, newUser.last_name_work,
                newUser.messages_count, JSON.stringify(newUser.items),
                JSON.stringify(newUser.stats), JSON.stringify(newUser.bet_stats),
                JSON.stringify(newUser.daily_missions), newUser.daily_missions_date,
                JSON.stringify(newUser.daily_stats), JSON.stringify(newUser.achievements)
            ]);

            // Guardar en caché antes de retornar
            this.userCache.set(userId, {
                data: user, // o newUser
                timestamp: Date.now()
            });
                
            // Limpiar caché si es muy grande
            if (this.userCache.size > this.MAX_CACHE_SIZE) {
                const oldest = [...this.userCache.entries()]
                    .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
                this.userCache.delete(oldest[0]);
            }

            console.log(`👤 Nuevo usuario MySQL creado: ${userId}`);
            return newUser;
        } catch (error) {
            console.error('❌ Error obteniendo usuario:', error);
            throw error;
        }
    }

    async getPotHistory(limit = 5) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT week_start, status, total_money, participant_count, money_winner 
                FROM weekly_pots 
                ORDER BY week_start DESC 
                LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    async updateUser(userId, updateData) {
        try {
            // Primero obtener el usuario actual
            const currentUser = await this.getUser(userId);
            
            const sets = [];
            const values = [];

            for (const [key, value] of Object.entries(updateData)) {
                sets.push(`${key} = ?`);
                
                // Para objetos, hacer merge con datos existentes
                if (typeof value === 'object' && value !== null) {
                    let finalValue;
                    
                    // Si es daily_stats, hacer merge
                    if (key === 'daily_stats' && currentUser.daily_stats) {
                        finalValue = { ...currentUser.daily_stats, ...value };
                    } 
                    // Si es stats, hacer merge
                    else if (key === 'stats' && currentUser.stats) {
                        finalValue = { ...currentUser.stats, ...value };
                    }
                    // En el bloque de merge, agregar:
                    else if (key === 'passiveIncomeStats' && currentUser.passiveIncomeStats) {
                        // Parse si es string
                        let currentStats = currentUser.passiveIncomeStats;
                        if (typeof currentStats === 'string') {
                            try {
                                currentStats = JSON.parse(currentStats);
                            } catch {
                                currentStats = {};
                            }
                        }
                        finalValue = { ...currentStats, ...value };
                    }
                    // Otros objetos, usar el valor tal como viene
                    else {
                        finalValue = value;
                    }
                    
                    values.push(JSON.stringify(finalValue));
                } else {
                    values.push(value);
                }
            }

            values.push(userId);

            const query = `UPDATE users SET ${sets.join(', ')} WHERE id = ?`;
            
            const [result] = await this.pool.execute(query, values);

            const cached = this.userCache.get(userId);
            if (cached) {
                // También hacer merge en caché
                if (updateData.daily_stats && cached.data.daily_stats) {
                    cached.data.daily_stats = { ...cached.data.daily_stats, ...updateData.daily_stats };
                }
                if (updateData.stats && cached.data.stats) {
                    cached.data.stats = { ...cached.data.stats, ...updateData.stats };
                }
                Object.assign(cached.data, updateData);
                cached.timestamp = Date.now();
            }
            
            return { changes: result.affectedRows };
        } catch (error) {
            console.error('Error actualizando usuario MySQL:', error);
            throw error;
        }
    }

    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            
            for (const [userId, cached] of this.userCache) {
                if (now - cached.timestamp > this.cacheTimeout) {
                    this.userCache.delete(userId);
                    cleaned++;
                }
            }
            
            console.log(`🧹 Database cache: ${cleaned} usuarios limpiados, ${this.userCache.size} restantes`);
        }, 10 * 60 * 1000); // Cada 10 minutos
    }

    async getAllUsers() {
        try {
            // CAMBIAR: No cargar TODOS los usuarios de una vez
            // const [rows] = await this.pool.execute('SELECT * FROM users');
            
            // POR: Usar paginación
            const [rows] = await this.pool.execute('SELECT * FROM users LIMIT 100');
            
            return rows.map(row => {
                row.items = this.safeJsonParse(row.items, {});
                row.stats = this.safeJsonParse(row.stats, {});
                row.bet_stats = this.safeJsonParse(row.bet_stats, {});
                row.daily_missions = this.safeJsonParse(row.daily_missions, {});
                row.daily_stats = this.safeJsonParse(row.daily_stats, {});
                row.achievements = this.safeJsonParse(row.achievements, {});
                return row;
            });
        } catch (error) {
            console.error('❌ Error obteniendo usuarios:', error);
            return [];
        }
    }

    async getBalanceLeaderboard(limit = 10) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT id, balance, level, total_xp FROM users ORDER BY balance DESC LIMIT ?',
                [limit]
            );
            
            return rows.map(row => ({
                userId: row.id,
                balance: row.balance,
                level: row.level,
                totalXp: row.total_xp
            }));
        } catch (error) {
            console.error('❌ Error obteniendo ranking de balance:', error);
            return [];
        }
    }

    async getLevelLeaderboard(limit = 10) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT id, balance, level, total_xp FROM users ORDER BY total_xp DESC LIMIT ?',
                [limit]
            );
            
            return rows.map(row => ({
                userId: row.id,
                level: row.level,
                totalXp: row.total_xp,
                balance: row.balance
            }));
        } catch (error) {
            console.error('❌ Error obteniendo ranking de niveles:', error);
            return [];
        }
    }

    // Métodos para shop_items
    async getShopItems() {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM shop_items WHERE available = 1'
            );
            
            return rows.map(row => {
                row.effects = this.safeJsonParse(row.effects, {});
                return row;
            });
        } catch (error) {
            console.error('❌ Error obteniendo items de tienda:', error);
            return [];
        }
    }

    async createAuction(auctionData) {
        try {
            await this.pool.execute(`
                INSERT INTO auctions (id, seller, item_id, item_name, starting_bid, 
                                    current_bid, highest_bidder, bids, ends_at, active, channel_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                auctionData.id, auctionData.seller, auctionData.item_id,
                auctionData.item_name, auctionData.starting_bid,
                auctionData.current_bid, auctionData.highest_bidder,
                JSON.stringify(auctionData.bids || []), auctionData.ends_at, true,
                auctionData.channel_id
            ]);
            
            return { id: auctionData.id };
        } catch (error) {
            console.error('❌ Error creando subasta:', error);
            throw error;
        }
    }

    async getAuction(auctionId) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM auctions WHERE id = ?', 
                [auctionId]
            );
            
            if (rows.length > 0) {
                const auction = rows[0];
                auction.bids = this.safeJsonParse(auction.bids, []);
                return auction;
            }
            return null;
        } catch (error) {
            console.error('❌ Error obteniendo subasta:', error);
            return null;
        }
    }

    async updateAuction(auctionId, updateData) {
        try {
            const sets = [];
            const values = [];

            for (const [key, value] of Object.entries(updateData)) {
                sets.push(`${key} = ?`);
                if (key === 'bids' && typeof value === 'object') {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }

            values.push(auctionId);

            const [result] = await this.pool.execute(
                `UPDATE auctions SET ${sets.join(', ')} WHERE id = ?`,
                values
            );
            
            return { changes: result.affectedRows };
        } catch (error) {
            console.error('❌ Error actualizando subasta:', error);
            throw error;
        }
    }

    // Métodos para trades
    async createTrade(tradeData) {
        try {
            await this.pool.execute(`
                INSERT INTO trades (id, initiator, target, initiator_offer, target_offer, 
                                initiator_money_offer, target_money_offer, initiator_accepted, target_accepted, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                tradeData.id, tradeData.initiator, tradeData.target,
                JSON.stringify(tradeData.initiator_offer || {}),
                JSON.stringify(tradeData.target_offer || {}),
                tradeData.initiator_money_offer || 0, tradeData.target_money_offer || 0,
                tradeData.initiator_accepted || false,
                tradeData.target_accepted || false,
                tradeData.status || 'pending'
            ]);
            
            return { id: tradeData.id };
        } catch (error) {
            console.error('❌ Error creando trade:', error);
            throw error;
        }
    }

    async getTrade(tradeId) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM trades WHERE id = ?', 
                [tradeId]
            );
            
            if (rows.length > 0) {
                const trade = rows[0];
                trade.initiator_items = this.safeJsonParse(trade.initiator_items, {});
                trade.target_items = this.safeJsonParse(trade.target_items, {});
                return trade;
            }
            return null;
        } catch (error) {
            console.error('❌ Error obteniendo trade:', error);
            return null;
        }
    }

    async updateBets(betId, updateData) {
        try {
            const sets = [];
            const values = [];

            for (const [key, value] of Object.entries(updateData)) {
                sets.push(`${key} = ?`);
                if (typeof value === 'object' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }

            values.push(betId);

            const [result] = await this.pool.execute(
                `UPDATE bets SET ${sets.join(', ')} WHERE id = ?`,
                values
            );
            
            return { changes: result.affectedRows };
        } catch (error) {
            console.error('❌ Error actualizando trade:', error);
            throw error;
        }
    }

    async updateTrade(tradeId, updateData) {
        try {
            const sets = [];
            const values = [];

            for (const [key, value] of Object.entries(updateData)) {
                sets.push(`${key} = ?`);
                if (typeof value === 'object' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }

            values.push(tradeId);

            const [result] = await this.pool.execute(
                `UPDATE trades SET ${sets.join(', ')} WHERE id = ?`,
                values
            );
            
            return { changes: result.affectedRows };
        } catch (error) {
            console.error('❌ Error actualizando trade:', error);
            throw error;
        }
    }

    // IMPORTANTE: Los siguientes métodos siguen usando sintaxis SQLite (this.pool.run, this.pool.get, this.pool.all)
    // Necesitan ser convertidos a MySQL syntax con this.pool.execute()

    async getRussianGame(gameId) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM russian_games WHERE id = ?', 
                [gameId]
            );
            
            if (rows.length > 0) {
                const game = rows[0];
                game.players = this.safeJsonParse(game.players, []);
                return game;
            }
            return null;
        } catch (error) {
            console.error('❌ Error obteniendo juego ruso:', error);
            return null;
        }
    }

    async createRussianGame(gameId, gameData) {
        try {
            await this.pool.execute(`
                INSERT INTO russian_games (id, channel_id, creator_id, bet_amount, players, 
                                        phase, current_player_index, bullet_position, current_shot, pot, processing)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                gameId,
                gameData.channel_id,
                gameData.creator_id,
                gameData.bet_amount,
                JSON.stringify(gameData.players || []),
                gameData.phase || 'waiting',
                gameData.current_player_index,
                gameData.bullet_position,
                gameData.current_shot,
                gameData.pot,
                gameData.processing || 'true'
            ]);
            
            return { id: gameId };
        } catch (error) {
            console.error('❌ Error creando juego ruso:', error);
            throw error;
        }
    }

    async updateRussianGame(gameId, updateData) {
        try {
            const sets = [];
            const values = [];

            for (const [key, value] of Object.entries(updateData)) {
                sets.push(`${key} = ?`);
                if (typeof value === 'object' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }

            values.push(gameId);

            const [result] = await this.pool.execute(
                `UPDATE russian_games SET ${sets.join(', ')} WHERE id = ?`,
                values
            );
            
            return { changes: result.affectedRows };
        } catch (error) {
            console.error('❌ Error actualizando juego ruso:', error);
            throw error;
        }
    }

    async deleteRussianGame(gameId) {
        try {
            const [result] = await this.pool.execute(
                'DELETE FROM russian_games WHERE id = ?', 
                [gameId]
            );
            
            return { changes: result.affectedRows };
        } catch (error) {
            console.error('❌ Error eliminando juego ruso:', error);
            throw error;
        }
    }

    // Métodos para Russian Roulette
    async getActiveRussianGames() {
        try {
            const [rows] = await this.pool.execute(
                "SELECT * FROM russian_games WHERE phase IN ('waiting', 'playing')"
            );
            
            return rows.map(row => {
                row.players = this.safeJsonParse(row.players, []);
                return row;
            });
        } catch (error) {
            console.error('❌ Error obteniendo juegos rusos activos:', error);
            return [];
        }
    }

    // Métodos para UNO
    async createUnoGame(gameId, gameData) {
        try {
            await this.pool.execute(`
                INSERT INTO uno_games (id, creator_id, channel_id, bet_amount, 
                                    variant, players, phase, game_data)  -- AGREGAR variant
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                gameId,
                gameData.creator_id,
                gameData.channel_id,
                gameData.bet_amount,
                gameData.variant || 'classic',  // AGREGAR ESTA LÍNEA
                JSON.stringify(gameData.players || []),
                gameData.phase || 'waiting',
                JSON.stringify(gameData.game_data || {})
            ]);
            
            return { id: gameId };
        } catch (error) {
            console.error('Error creando juego UNO:', error);
            throw error;
        }
    }

    async updateUnoGame(gameId, updateData) {
        try {
            const sets = [];
            const values = [];

            for (const [key, value] of Object.entries(updateData)) {
                sets.push(`${key} = ?`);
                if (typeof value === 'object' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }

            values.push(gameId);

            const [result] = await this.pool.execute(
                `UPDATE uno_games SET ${sets.join(', ')} WHERE id = ?`,
                values
            );
            
            return { changes: result.affectedRows };
        } catch (error) {
            console.error('Error actualizando juego UNO:', error);
            throw error;
        }
    }

    async deleteUnoGame(gameId) {
        try {
            const [result] = await this.pool.execute(
                'DELETE FROM uno_games WHERE id = ?', 
                [gameId]
            );
            
            return { changes: result.affectedRows };
        } catch (error) {
            console.error('❌ Error eliminando juego UNO:', error);
            throw error;
        }
    }

    // CAMBIAR getActiveAuctions() para que devuelva todos los campos:
    async getActiveAuctions() {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM auctions WHERE active = 1 ORDER BY id DESC'
            );
            return rows.map(auction => ({
                ...auction,
                bids: this.safeJsonParse(auction.bids, [])
            }));
        } catch (error) {
            console.error('Error obteniendo subastas activas:', error);
            return [];
        }
    }

    async getActiveUnoGames() {
        try {
            const [rows] = await this.pool.execute(
                "SELECT * FROM uno_games WHERE phase != 'finished'"
            );
            
            return rows.map(row => {
                row.players = this.safeJsonParse(row.players, []);
                row.game_data = this.safeJsonParse(row.game_data, {});
                return row;
            });
        } catch (error) {
            console.error('❌ Error obteniendo juegos UNO activos:', error);
            return [];
        }
    }

    async getActiveTrades() {
        try {
            const [rows] = await this.pool.execute(
                "SELECT * FROM trades WHERE status = 'pending'"
            );
            
            return rows.map(row => {
                // Parsear JSON fields si es necesario
                row.initiator_offer = this.safeJsonParse(row.initiator_offer, []);
                row.target_offer = this.safeJsonParse(row.target_offer, []);
                return row;
            });
        } catch (error) {
            console.error('❌ Error obteniendo trades activos:', error);
            return [];
        }
    }

    // Cerrar conexión
    async close() {
        if (this.pool) {
            try {
                await this.pool.end();
                console.log('✅ MySQL desconectado');
            } catch (error) {
                console.error('❌ Error cerrando MySQL:', error);
            }
        }
    }

    // Backup de la base de datos
    async backup() {
        try {
            // Para MySQL, hacer backup de datos específicos
            const backupData = {
                users: await this.getAllUsers(),
                timestamp: new Date().toISOString()
            };
            
            const backupPath = `./backup_${Date.now()}.json`;
            require('fs').writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
            
            console.log(`📦 Backup creado: ${backupPath}`);
            return backupPath;
        } catch (error) {
            console.error('❌ Error creando backup:', error);
            throw error;
        }
    }

    // Métodos específicos para eventos - CORREGIDO para MySQL
    async createServerEvent(eventData) {
        try {
            await this.pool.execute(`
                INSERT INTO server_events (
                    id, type, name, description, emoji, color,
                    start_time, end_time, duration, multipliers,
                    is_special, is_negative, is_rare, triggered_by,
                    participant_count, stats
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                eventData.id, eventData.type, eventData.name,
                eventData.description, eventData.emoji, eventData.color,
                eventData.start_time, eventData.end_time, eventData.duration,
                JSON.stringify(eventData.multipliers), eventData.is_special,
                eventData.is_negative, eventData.is_rare, eventData.triggered_by,
                eventData.participant_count, JSON.stringify(eventData.stats)
            ]);
            
            return { id: eventData.id };
        } catch (error) {
            console.error('❌ Error creando evento:', error);
            throw error;
        }
    }

    async createBet(betData) {
        try {
            await this.pool.execute(`
                INSERT INTO bets (
                    id, challenger, opponent, amount, description,
                    status, expires_at, channel_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                betData.id,
                betData.challenger,
                betData.opponent,
                betData.amount,
                JSON.stringify({ bet_description: betData.description }),
                betData.status || 'pending',
                betData.expires_at,
                betData.channel_id
            ]);
            
            return { id: betData.id };
        } catch (error) {
            console.error('❌ Error creando apuesta:', error);
            throw error;
        }
    }

    async getUserBets(userId) {
        try {
            const [rows] = await this.pool.execute(`
                SELECT * FROM bets 
                WHERE (challenger = ? OR opponent = ?) 
                AND status IN ('pending', 'active')
            `, [userId, userId]);
            
            return rows.map(row => ({
                id: row.id,
                challenger: row.challenger,
                opponent: row.opponent,
                amount: row.amount,
                description: this.safeJsonParse(row.amount, {}).bet_description || 'Sin descripción',
                status: row.status,
                expires_at: row.expires_at,
                channel_id: row.channel_id
            }));
        } catch (error) {
            console.error('❌ Error obteniendo apuestas del usuario:', error);
            return [];
        }
    }

    async getBet(betId) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM bets WHERE id = ?', 
                [betId]
            );

            if (rows.length > 0) {
                const bet = rows[0];
                bet.description = this.safeJsonParse(bet.amount, {}).bet_description || 'Sin descripción';
                return bet;
            }
            return null;
        } catch (error) {
            console.error('❌ Error obteniendo apuesta:', error);
            return null;
        }
    }

    async deleteBet(betId) {
        try {
            const [result] = await this.pool.execute(
                'DELETE FROM bets WHERE id = ?', 
                [betId]
            );
            
            return { changes: result.affectedRows };
        } catch (error) {
            console.error('❌ Error eliminando apuesta:', error);
            throw error;
        }
    }

    // Método para obtener conexión (para el panel web)
    getConnection() {
        return this.pool;
    }
}

module.exports = LocalDatabase;
