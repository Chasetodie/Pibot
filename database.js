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
    }

    async init() {
        try {
            // Configuración corregida para mysql2
            this.pool = mysql.createPool({
                host: 'sql3.freesqldatabase.com',
                port: 3306,
                user: 'sql3795651',
                password: 'byPCRPuUN3',
                database: 'sql3795651',
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
                    last_name_work TEXT,
                    messages_count INT DEFAULT 0,
                    items TEXT,
                    stats TEXT,
                    bet_stats TEXT,
                    daily_missions TEXT,
                    daily_missions_date TEXT,
                    daily_stats TEXT,
                    achievements TEXT,
                    missions_reset_today BOOLEAN DEFAULT 0
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
                    completed_at TEXT
                )
            `);

            console.log('🗃️ Tablas MySQL inicializadas');
        } catch (error) {
            console.error('❌ Error creando tablas:', error);
        }
    }

    // Función helper para parsear JSON de manera segura
    safeJsonParse(jsonString, defaultValue = {}) {
        try {
            return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        } catch (error) {
            console.error('❌ Error parseando JSON:', error);
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
                last_name_work: "",
                messages_count: 0,
                items: {},
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
                    message_achievements: ""
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
            };

            await this.pool.execute(`
                INSERT INTO users (
                    id, balance, level, xp, total_xp, last_daily, last_work,
                    last_robbery, last_coinflip, last_dice, last_roulette,
                    last_lotto, last_blackjack, last_name_work, messages_count,
                    items, stats, bet_stats, daily_missions, daily_missions_date,
                    daily_stats, achievements
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    async updateUser(userId, updateData) {
        try {
            const sets = [];
            const values = [];

            for (const [key, value] of Object.entries(updateData)) {
                sets.push(`${key} = ?`);
                
                // Convertir objetos a JSON para MySQL
                if (typeof value === 'object' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }

            values.push(userId);

            const query = `UPDATE users SET ${sets.join(', ')} WHERE id = ?`;
            
            const [result] = await this.pool.execute(query, values);

            const cached = this.userCache.get(userId);
            if (cached) {
                // Actualizar datos en caché
                Object.assign(cached.data, updateData);
                cached.timestamp = Date.now();
            }
            
            return { changes: result.affectedRows };
        } catch (error) {
            console.error('❌ Error actualizando usuario MySQL:', error);
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
                                    current_bid, highest_bidder, bids, ends_at, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                auctionData.id, auctionData.seller, auctionData.item_id,
                auctionData.item_name, auctionData.starting_bid,
                auctionData.current_bid, auctionData.highest_bidder,
                JSON.stringify(auctionData.bids || []), auctionData.ends_at, true
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
                                        phase, pot, processing)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                gameId,
                gameData.channel_id,
                gameData.creator_id,
                gameData.bet_amount,
                JSON.stringify(gameData.players || []),
                gameData.phase || 'waiting',
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
                                    players, phase, game_data)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                gameId,
                gameData.creator_id,
                gameData.channel_id,
                gameData.bet_amount,
                JSON.stringify(gameData.players || []),
                gameData.phase || 'waiting',
                JSON.stringify(gameData.game_data || {})
            ]);
            
            return { id: gameId };
        } catch (error) {
            console.error('❌ Error creando juego UNO:', error);
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
            console.error('❌ Error actualizando juego UNO:', error);
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

    // Método para obtener conexión (para el panel web)
    getConnection() {
        return this.pool;
    }
}

module.exports = LocalDatabase;
