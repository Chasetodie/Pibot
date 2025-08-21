const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg'); // PostgreSQL client
const path = require('path');
const fs = require('fs');

class LocalDatabase {
    constructor() {
        // Detectar si usar PostgreSQL o SQLite
        this.usePostgres = !!process.env.DATABASE_URL;
        
        if (this.usePostgres) {
            console.log('🐘 Inicializando PostgreSQL...');
            this.initPostgres();
        } else {
            console.log('📁 Inicializando SQLite...');
            this.initSQLite();
        }
        
        this.init();
    }

    initPostgres() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        // Test de conexión
        this.pool.on('connect', () => {
            console.log('✅ PostgreSQL conectado');
        });
    }

    initSQLite() {
        this.dbPath = path.join(__dirname, 'bot_data.db');
        
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
    }

    async init() {
        if (this.usePostgres) {
            await this.initPostgresTables();
        } else {
            this.initSQLiteTables();
        }
    }

    async initPostgresTables() {
        const client = await this.pool.connect();
        
        try {
            // Tabla de usuarios
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    balance INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 1,
                    xp INTEGER DEFAULT 0,
                    total_xp INTEGER DEFAULT 0,
                    last_daily BIGINT DEFAULT 0,
                    last_work BIGINT DEFAULT 0,
                    last_robbery BIGINT DEFAULT 0,
                    last_coinflip BIGINT DEFAULT 0,
                    last_dice BIGINT DEFAULT 0,
                    last_roulette BIGINT DEFAULT 0,
                    last_lotto BIGINT DEFAULT 0,
                    last_blackjack BIGINT DEFAULT 0,
                    last_name_work TEXT DEFAULT '',
                    messages_count INTEGER DEFAULT 0,
                    items JSONB DEFAULT '{}',
                    stats JSONB DEFAULT '{}',
                    bet_stats JSONB DEFAULT '{}',
                    daily_missions JSONB DEFAULT '{}',
                    daily_missions_date TEXT DEFAULT NULL,
                    daily_stats JSONB DEFAULT '{}',
                    achievements JSONB DEFAULT '[]',
                    missions_reset_today BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Tabla shop_items
            await client.query(`
                CREATE TABLE IF NOT EXISTS shop_items (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    price INTEGER NOT NULL,
                    type TEXT DEFAULT 'consumable',
                    category TEXT DEFAULT 'general',
                    effects JSONB DEFAULT '{}',
                    stock INTEGER DEFAULT -1,
                    available BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Tabla trades
            await client.query(`
                CREATE TABLE IF NOT EXISTS trades (
                    id TEXT PRIMARY KEY,
                    initiator TEXT NOT NULL,
                    target TEXT NOT NULL,
                    initiator_items JSONB DEFAULT '{}',
                    target_items JSONB DEFAULT '{}',
                    initiator_money INTEGER DEFAULT 0,
                    target_money INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    initiator_accepted BOOLEAN DEFAULT FALSE,
                    target_accepted BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP DEFAULT NULL
                )
            `);

            // Tabla server_events
            await client.query(`
                CREATE TABLE IF NOT EXISTS server_events (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    emoji TEXT,
                    color TEXT,
                    start_time TIMESTAMP,
                    end_time TIMESTAMP,
                    duration INTEGER,
                    multipliers JSONB DEFAULT '{}',
                    is_special BOOLEAN DEFAULT FALSE,
                    is_negative BOOLEAN DEFAULT FALSE,
                    is_rare BOOLEAN DEFAULT FALSE,
                    triggered_by TEXT,
                    participant_count INTEGER DEFAULT 0,
                    stats JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Tabla auctions
            await client.query(`
                CREATE TABLE IF NOT EXISTS auctions (
                    id TEXT PRIMARY KEY,
                    seller TEXT NOT NULL,
                    item_id TEXT,
                    item_name TEXT NOT NULL,
                    starting_bid INTEGER NOT NULL,
                    current_bid INTEGER,
                    highest_bidder TEXT,
                    bids JSONB DEFAULT '[]',
                    ends_at TIMESTAMP NOT NULL,
                    active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP DEFAULT NULL
                )
            `);

            console.log('🗃️ Tablas PostgreSQL inicializadas');
            
        } catch (error) {
            console.error('❌ Error inicializando tablas PostgreSQL:', error);
        } finally {
            client.release();
        }
    }

    initSQLiteTables() {
        // Tu código SQLite existente (sin cambios)
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

            // Resto de tus tablas SQLite existentes...
            console.log('🗃️ Tablas SQLite inicializadas');
        });
    }

    // Método universal para obtener usuario
    async getUser(userId) {
        if (this.usePostgres) {
            return this.getUserPostgres(userId);
        } else {
            return this.getUserSQLite(userId);
        }
    }

    async getUserPostgres(userId) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
            
            if (result.rows.length > 0) {
                return result.rows[0];
            }
            
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
                achievements: [],
                missions_reset_today: false
            };

            const insertResult = await client.query(`
                INSERT INTO users (
                    id, balance, level, xp, total_xp, last_daily, last_work,
                    last_robbery, last_coinflip, last_dice, last_roulette,
                    last_lotto, last_blackjack, last_name_work, messages_count,
                    items, stats, bet_stats, daily_missions, daily_missions_date,
                    daily_stats, achievements, missions_reset_today
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
                RETURNING *
            `, [
                newUser.id, newUser.balance, newUser.level, newUser.xp, newUser.total_xp,
                newUser.last_daily, newUser.last_work, newUser.last_robbery,
                newUser.last_coinflip, newUser.last_dice, newUser.last_roulette,
                newUser.last_lotto, newUser.last_blackjack, newUser.last_name_work,
                newUser.messages_count, JSON.stringify(newUser.items),
                JSON.stringify(newUser.stats), JSON.stringify(newUser.bet_stats),
                JSON.stringify(newUser.daily_missions), newUser.daily_missions_date,
                JSON.stringify(newUser.daily_stats), JSON.stringify(newUser.achievements),
                newUser.missions_reset_today
            ]);

            console.log(`👤 Nuevo usuario PostgreSQL creado: ${userId}`);
            return insertResult.rows[0];
            
        } catch (error) {
            console.error('❌ Error obteniendo usuario PostgreSQL:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getUserSQLite(userId) {
        // Tu método SQLite existente (sin cambios)
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
                        row.achievements = JSON.parse(row.achievements || '[]');
                        
                        resolve(row);
                    } else {
                        // Crear nuevo usuario SQLite
                        resolve(this.createNewUserSQLite(userId));
                    }
                }
            );
        });
    }

    // Método universal para actualizar usuario
    async updateUser(userId, updateData) {
        if (this.usePostgres) {
            return this.updateUserPostgres(userId, updateData);
        } else {
            return this.updateUserSQLite(userId, updateData);
        }
    }

    async updateUserPostgres(userId, updateData) {
        const client = await this.pool.connect();
        
        try {
            const sets = [];
            const values = [];
            let paramCount = 1;

            // Agregar updated_at automáticamente
            updateData.updated_at = new Date();

            for (const [key, value] of Object.entries(updateData)) {
                sets.push(`${key} = $${paramCount}`);
                
                // PostgreSQL maneja JSON automáticamente
                if (typeof value === 'object' && value !== null && key !== 'updated_at') {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
                paramCount++;
            }

            values.push(userId); // Para el WHERE

            const query = `UPDATE users SET ${sets.join(', ')} WHERE id = $${paramCount}`;
            
            await client.query(query, values);
            console.log(`💾 Usuario PostgreSQL actualizado: ${userId}`);
            
            return { changes: 1 };
        } catch (error) {
            console.error('❌ Error actualizando usuario PostgreSQL:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async updateUserSQLite(userId, updateData) {
        // Tu método SQLite existente
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

    // Obtener conexión (para compatibilidad con panel admin)
    getConnection() {
        if (this.usePostgres) {
            return this.pool;
        } else {
            return this.db;
        }
    }

    // Cerrar conexión
    close() {
        if (this.usePostgres) {
            this.pool.end(() => {
                console.log('✅ PostgreSQL desconectado');
            });
        } else if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Error cerrando SQLite:', err);
                } else {
                    console.log('✅ SQLite desconectado');
                }
            });
        }
    }

    // Resto de métodos (getAllUsers, getBalanceLeaderboard, etc.) 
    // necesitarán implementación dual similar...
}

module.exports = LocalDatabase;