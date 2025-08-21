const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class LocalDatabase {
    constructor() {
        this.dbPath = path.join(__dirname, 'bot_data.db');
        this.db = null;
        this.init();
    }

    init() {
        // Crear directorio si no existe
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('❌ Error conectando a SQLite:', err);
            } else {
                console.log('✅ SQLite conectado:', this.dbPath);
            }
        });


        this.initTables();
    }

    initTables() {
        this.db.serialize(() => {
            // Tabla de usuarios principal
            this.db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    balance INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 1,
                    xp INTEGER DEFAULT 0,
                    total_xp INTEGER DEFAULT 0,
                    last_daily INTEGER DEFAULT 0,
                    last_work INTEGER DEFAULT 0,
                    last_robbery INTEGER DEFAULT 0,
                    last_coinflip INTEGER DEFAULT 0,
                    last_dice INTEGER DEFAULT 0,
                    last_roulette INTEGER DEFAULT 0,
                    last_lotto INTEGER DEFAULT 0,
                    last_blackjack INTEGER DEFAULT 0,
                    last_name_work TEXT DEFAULT '',
                    messages_count INTEGER DEFAULT 0,
                    items TEXT DEFAULT '{}',
                    stats TEXT DEFAULT '{}',
                    bet_stats TEXT DEFAULT '{}',
                    daily_missions TEXT DEFAULT '{}',
                    daily_missions_date TEXT DEFAULT NULL,
                    daily_stats TEXT DEFAULT '{}',
                    achievements TEXT DEFAULT '[]',
                    missions_reset_today BOOLEAN DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Tabla para items de tienda
            this.db.run(`
                CREATE TABLE IF NOT EXISTS shop_items (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    price INTEGER NOT NULL,
                    type TEXT DEFAULT 'consumable',
                    category TEXT DEFAULT 'general',
                    effects TEXT DEFAULT '{}',
                    stock INTEGER DEFAULT -1,
                    available BOOLEAN DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Tabla para trades
            this.db.run(`
                CREATE TABLE IF NOT EXISTS trades (
                    id TEXT PRIMARY KEY,
                    initiator TEXT NOT NULL,
                    target TEXT NOT NULL,
                    initiator_items TEXT DEFAULT '{}',
                    target_items TEXT DEFAULT '{}',
                    initiator_money INTEGER DEFAULT 0,
                    target_money INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    initiator_accepted BOOLEAN DEFAULT 0,
                    target_accepted BOOLEAN DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    completed_at TEXT DEFAULT NULL
                )
            `);

            this.db.run(`
                CREATE TABLE IF NOT EXISTS russian_games (
                    id TEXT PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    creator_id TEXT NOT NULL,
                    bet_amount INTEGER NOT NULL,
                    players TEXT DEFAULT '[]',
                    phase TEXT DEFAULT 'waiting',
                    current_player_index INTEGER DEFAULT 0,
                    bullet_position INTEGER DEFAULT 0,
                    current_shot INTEGER DEFAULT 0,
                    pot INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Tabla para partidas UNO (si la usas)
            this.db.run(`
                CREATE TABLE IF NOT EXISTS uno_games (
                    id TEXT PRIMARY KEY,
                    creator_id TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    bet_amount INTEGER NOT NULL,
                    players TEXT DEFAULT '[]',
                    phase TEXT DEFAULT 'waiting',
                    game_data TEXT DEFAULT '{}',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            this.db.run(`

                CREATE TABLE IF NOT EXISTS server_events (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    emoji TEXT,
                    color TEXT,
                    start_time TEXT,
                    end_time TEXT,
                    duration INTEGER,
                    multipliers TEXT DEFAULT '{}',
                    is_special BOOLEAN DEFAULT 0,
                    is_negative BOOLEAN DEFAULT 0,
                    is_rare BOOLEAN DEFAULT 0,
                    triggered_by TEXT,
                    participant_count INTEGER DEFAULT 0,
                    stats TEXT DEFAULT '{}',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Tabla para subastas
            this.db.run(`
                CREATE TABLE IF NOT EXISTS auctions (
                    id TEXT PRIMARY KEY,
                    seller TEXT NOT NULL,
                    item_id TEXT,
                    item_name TEXT NOT NULL,
                    starting_bid INTEGER NOT NULL,
                    current_bid INTEGER,
                    highest_bidder TEXT,
                    bids TEXT DEFAULT '[]',
                    ends_at TEXT NOT NULL,
                    active BOOLEAN DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    completed_at TEXT DEFAULT NULL
                )
            `);


            console.log('🗃️ Tablas SQLite inicializadas');
        });
    }


    async getUser(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE id = ?',
                [userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (row) {
                        // Parsear JSON fields
                        row.items = JSON.parse(row.items || '{}');
                        row.stats = JSON.parse(row.stats || '{}');
                        row.bet_stats = JSON.parse(row.bet_stats || '{}');
                        row.daily_missions = JSON.parse(row.daily_missions || '{}');
                        row.daily_stats = JSON.parse(row.daily_stats || '{}');

                        
                        resolve(row);
                    } else {
                        // Crear nuevo usuario
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
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };

                        this.db.run(`
                            INSERT INTO users (
                                id, balance, level, xp, total_xp, last_daily, last_work,
                                last_robbery, last_coinflip, last_dice, last_roulette,
                                last_lotto, last_blackjack, last_name_work, messages_count,
                                items, stats, bet_stats, daily_missions, daily_missions_date,
                                daily_stats, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            newUser.id, newUser.balance, newUser.level, newUser.xp, newUser.total_xp,
                            newUser.last_daily, newUser.last_work, newUser.last_robbery,
                            newUser.last_coinflip, newUser.last_dice, newUser.last_roulette,
                            newUser.last_lotto, newUser.last_blackjack, newUser.last_name_work,
                            newUser.messages_count, JSON.stringify(newUser.items),
                            JSON.stringify(newUser.stats), JSON.stringify(newUser.bet_stats),
                            JSON.stringify(newUser.daily_missions), newUser.daily_missions_date,
                            JSON.stringify(newUser.daily_stats), newUser.created_at, newUser.updated_at
                        ], function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                console.log(`👤 Nuevo usuario SQLite creado: ${userId}`);
                                resolve(newUser);
                            }
                        });
                    }
                }
            );
        });
    }


    async updateUser(userId, updateData) {
        return new Promise((resolve, reject) => {
            const sets = [];
            const values = [];

            // Agregar updated_at automáticamente
            updateData.updated_at = new Date().toISOString();

            for (const [key, value] of Object.entries(updateData)) {
                sets.push(`${key} = ?`);
                
                // Convertir objetos a JSON
                if (typeof value === 'object' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }

            values.push(userId);

            const query = `UPDATE users SET ${sets.join(', ')} WHERE id = ?`;
            
            this.db.run(query, values, function(err) {
                if (err) {
                    console.error('❌ Error actualizando usuario SQLite:', err);
                    reject(err);
                } else {
                    console.log(`💾 Usuario SQLite actualizado: ${userId}`);
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Obtener todos los usuarios
    async getAllUsers() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM users', (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const users = rows.map(row => {
                    row.items = JSON.parse(row.items || '{}');
                    row.stats = JSON.parse(row.stats || '{}');
                    row.bet_stats = JSON.parse(row.bet_stats || '{}');
                    row.daily_missions = JSON.parse(row.daily_missions || '{}');
                    row.daily_stats = JSON.parse(row.daily_stats || '{}');
                    return row;
                });

                resolve(users);
            });
        });
    }

    // Obtener leaderboard por balance
    async getBalanceLeaderboard(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT id, balance, level, total_xp FROM users ORDER BY balance DESC LIMIT ?',
                [limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows.map(row => ({
                            userId: row.id,
                            balance: row.balance,
                            level: row.level,
                            totalXp: row.total_xp
                        })));
                    }
                }
            );
        });
    }

    // Obtener leaderboard por nivel
    async getLevelLeaderboard(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT id, balance, level, total_xp FROM users ORDER BY total_xp DESC LIMIT ?',
                [limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows.map(row => ({
                            userId: row.id,
                            level: row.level,
                            totalXp: row.total_xp,
                            balance: row.balance
                        })));
                    }
                }
            );
        });
    }

    // Métodos para shop_items
    async getShopItems() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM shop_items WHERE available = 1',
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const items = rows.map(row => {
                            row.effects = JSON.parse(row.effects || '{}');
                            return row;
                        });
                        resolve(items);
                    }
                }
            );
        });
    }

    // Métodos para trades
    async createTrade(tradeData) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO trades (id, initiator, target, initiator_items, target_items, 
                                  initiator_money, target_money, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            this.db.run(query, [
                tradeData.id, tradeData.initiator, tradeData.target,
                JSON.stringify(tradeData.initiator_items || {}),
                JSON.stringify(tradeData.target_items || {}),
                tradeData.initiator_money || 0, tradeData.target_money || 0,
                tradeData.status || 'pending', new Date().toISOString()
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: tradeData.id });
                }
            });
        });
    }

    async getTrade(tradeId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM trades WHERE id = ?', [tradeId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    row.initiator_items = JSON.parse(row.initiator_items || '{}');
                    row.target_items = JSON.parse(row.target_items || '{}');
                    resolve(row);
                } else {
                    resolve(null);
                }
            });
        });
    }

    async updateTrade(tradeId, updateData) {
        return new Promise((resolve, reject) => {
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

            this.db.run(
                `UPDATE trades SET ${sets.join(', ')} WHERE id = ?`,
                values,
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    // Cerrar conexión
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Error cerrando SQLite:', err);
                } else {
                    console.log('✅ SQLite desconectado');
                }
            });
        }
    }

    // Backup de la base de datos
    async backup() {
        const timestamp = Date.now();
        const backupPath = `${this.dbPath}.backup.${timestamp}`;
        
        return new Promise((resolve, reject) => {
            try {
                // Crear copia del archivo
                const source = fs.createReadStream(this.dbPath);
                const destination = fs.createWriteStream(backupPath);
                
                source.pipe(destination);
                
                destination.on('close', () => {
                    console.log(`📦 Backup creado: ${backupPath}`);
                    resolve(backupPath);
                });
                
                destination.on('error', (error) => {
                    console.error('❌ Error creando backup:', error);
                    reject(error);
                });
                
                source.on('error', (error) => {
                    console.error('❌ Error leyendo archivo:', error);
                    reject(error);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // Métodos específicos para eventos
    async createServerEvent(eventData) {
        return new Promise((resolve, reject) => {
            this.db.run(`
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
            ], function(err) {
                if (err) reject(err);
                else resolve({ id: eventData.id });
            });
        });
    }

    // Métodos específicos para subastas
    async createAuction(auctionData) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO auctions (
                    id, seller, item_id, item_name, starting_bid,
                    current_bid, highest_bidder, bids, ends_at, active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                auctionData.id, auctionData.seller, auctionData.item_id,
                auctionData.item_name, auctionData.starting_bid,
                auctionData.current_bid, auctionData.highest_bidder,
                JSON.stringify(auctionData.bids), auctionData.ends_at, 1
            ], function(err) {
                if (err) reject(err);
                else resolve({ id: auctionData.id });
            });
        });
    }

    async getAuction(auctionId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM auctions WHERE id = ?', [auctionId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    row.bids = JSON.parse(row.bids || '[]');
                    resolve(row);
                } else {
                    resolve(null);
                }
            });
        });
    }

    async updateAuction(auctionId, updateData) {
        return new Promise((resolve, reject) => {
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

            values.push(auctionId);

            this.db.run(
                `UPDATE auctions SET ${sets.join(', ')} WHERE id = ?`,
                values,
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });
    }

    async getRussianGame(gameId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM russian_games WHERE id = ?', [gameId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        row.players = JSON.parse(row.players || '[]');
                    }
                    resolve(row);
                }
            });
        });
    }

    async createRussianGame(gameId, gameData) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO russian_games (id, channel_id, creator_id, bet_amount, players, 
                                        phase, pot, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            this.db.run(query, [
                gameId,
                gameData.channel_id,
                gameData.creator_id,
                gameData.bet_amount,
                JSON.stringify(gameData.players || []),
                gameData.phase || 'waiting',
                gameData.pot,
                new Date().toISOString()
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: gameId });
                }
            });
        });
    }

    async updateRussianGame(gameId, updateData) {
        return new Promise((resolve, reject) => {
            const sets = [];
            const values = [];


            updateData.updated_at = new Date().toISOString();

            for (const [key, value] of Object.entries(updateData)) {
                sets.push(`${key} = ?`);


                if (typeof value === 'object' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }

            values.push(gameId);

            this.db.run(
                `UPDATE russian_games SET ${sets.join(', ')} WHERE id = ?`,
                values,
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    async deleteRussianGame(gameId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM russian_games WHERE id = ?', [gameId], function(err) {
                if (err) {

                    reject(err);
                } else {

                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Métodos para Russian Roulette
    async getActiveRussianGames() {
        return new Promise((resolve, reject) => {
            this.db.all(
                "SELECT * FROM russian_games WHERE phase IN ('waiting', 'playing')",
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const games = rows.map(row => {
                            row.players = JSON.parse(row.players || '[]');
                            return row;
                        });
                        resolve(games);
                    }
                }
            );
        });
    }

    // Métodos para UNO
    async createUnoGame(gameId, gameData) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO uno_games (id, creator_id, channel_id, bet_amount, 
                                    players, phase, game_data, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            this.db.run(query, [
                gameId,
                gameData.creator_id,
                gameData.channel_id,
                gameData.bet_amount,
                JSON.stringify(gameData.players || []),
                gameData.phase || 'waiting',
                JSON.stringify(gameData.game_data || {}),
                new Date().toISOString()
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: gameId });
                }
            });
        });
    }

    async updateUnoGame(gameId, updateData) {
        return new Promise((resolve, reject) => {
            const sets = [];
            const values = [];

            updateData.updated_at = new Date().toISOString();

            for (const [key, value] of Object.entries(updateData)) {
                sets.push(`${key} = ?`);
                if (typeof value === 'object' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }

            values.push(gameId);

            this.db.run(
                `UPDATE uno_games SET ${sets.join(', ')} WHERE id = ?`,
                values,
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    async deleteUnoGame(gameId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM uno_games WHERE id = ?', [gameId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    async getActiveUnoGames() {
        return new Promise((resolve, reject) => {
            this.db.all(
                "SELECT * FROM uno_games WHERE phase != 'finished'",
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const games = rows.map(row => {
                            row.players = JSON.parse(row.players || '[]');
                            row.game_data = JSON.parse(row.game_data || '{}');
                            return row;
                        });
                        resolve(games);
                    }
                }
            );
        });
    }

    // Método para obtener conexión (para el panel web)
    getConnection() {
        return this.db;
    }
}

module.exports = LocalDatabase;