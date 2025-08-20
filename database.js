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

            console.log('🗃️ Tablas SQLite inicializadas');
        });
    }

    // Obtener usuario (compatible con Supabase)
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

    // Actualizar usuario (compatible con Supabase)
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
        const backupPath = `${this.dbPath}.backup.${Date.now()}`;
        return new Promise((resolve, reject) => {
            const source = fs.createReadStream(this.dbPath);
            const destination = fs.createWriteStream(backupPath);
            
            source.pipe(destination);
            destination.on('close', () => {
                console.log(`📦 Backup creado: ${backupPath}`);
                resolve(backupPath);
            });
            destination.on('error', reject);
        });
    }
}

module.exports = LocalDatabase;
