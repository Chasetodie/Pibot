const { createClient } = require('@supabase/supabase-js');
const LocalDatabase = require('./database'); // Tu clase de MySQL

class DataMigration {
    constructor() {
        // Configuración Supabase
        this.supabaseUrl = 'https://jotxxdbjysndrhpbxeox.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdHh4ZGJqeXNuZHJocGJ4ZW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMzM4OTUsImV4cCI6MjA3MDcwOTg5NX0.RnzSBxRNa7lfvhTLKHjMG_y_CAYnOKYweOsDMLwj7sE';
        this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
        
        // Tu base MySQL
        this.mysqlDb = new LocalDatabase();
        
        this.stats = {
            users: { total: 0, migrated: 0, errors: 0 },
            trades: { total: 0, migrated: 0, errors: 0 },
            games: { total: 0, migrated: 0, errors: 0 },
            events: { total: 0, migrated: 0, errors: 0 }
        };
    }

    async startMigration() {
        console.log('🚀 Iniciando migración de Supabase a MySQL...\n');
        
        try {
            // Migrar en orden (usuarios primero por dependencias)
            await this.migrateUsers();
            await this.migrateTrades();
            await this.migrateGames();
            
            this.showFinalStats();
            
        } catch (error) {
            console.error('❌ Error en migración:', error);
        }
    }

    async migrateUsers() {
        console.log('👤 Migrando usuarios...');
        
        try {
            // Obtener todos los usuarios de Supabase
            const { data: supabaseUsers, error } = await this.supabase
                .from('users') // Cambia por el nombre de tu tabla en Supabase
                .select('*');

            if (error) throw error;

            this.stats.users.total = supabaseUsers.length;
            console.log(`📊 Total usuarios en Supabase: ${supabaseUsers.length}`);

            for (const user of supabaseUsers) {
                try {
                    // Convertir formato Supabase → MySQL
                    const mysqlUser = await this.convertUserData(user);
                    
                    // Verificar si ya existe
                    const existingUser = await this.mysqlDb.getUser(user.id);
                    if (existingUser && existingUser.id === user.id) {
                        console.log(`⚠️  Usuario ${user.id} ya existe, actualizando...`);
                        await this.mysqlDb.updateUser(user.id, mysqlUser);
                    } else {
                        // Insertar directamente en MySQL
                        await this.insertUserDirectly(user.id, mysqlUser);
                    }
                    
                    this.stats.users.migrated++;
                    
                    if (this.stats.users.migrated % 10 === 0) {
                        console.log(`✅ Migrados ${this.stats.users.migrated}/${this.stats.users.total} usuarios`);
                    }
                    
                } catch (userError) {
                    console.error(`❌ Error migrando usuario ${user.id}:`, userError.message);
                    this.stats.users.errors++;
                }
            }
            
            console.log(`🎉 Usuarios completados: ${this.stats.users.migrated}/${this.stats.users.total}\n`);
            
        } catch (error) {
            console.error('❌ Error obteniendo usuarios de Supabase:', error);
        }
    }

    async convertUserData(supabaseUser) {
        // Convertir estructura Supabase → MySQL
        // Ajusta estos campos según tu estructura de Supabase
        
        return {
            balance: supabaseUser.balance || 0,
            level: supabaseUser.level || 1,
            xp: supabaseUser.xp || 0,
            total_xp: supabaseUser.total_xp || 0,
            last_daily: supabaseUser.last_daily || 0,
            last_work: supabaseUser.last_work || 0,
            last_robbery: supabaseUser.last_robbery || 0,
            last_coinflip: supabaseUser.last_coinflip || 0,
            last_dice: supabaseUser.last_dice || 0,
            last_roulette: supabaseUser.last_roulette || 0,
            last_lotto: supabaseUser.last_lotto || 0,
            last_blackjack: supabaseUser.last_blackjack || 0,
            last_name_work: supabaseUser.last_name_work || '',
            messages_count: supabaseUser.messages_count || 0,
            
            // Convertir objetos JSON
            items: supabaseUser.items || {},
            stats: supabaseUser.stats || {},
            bet_stats: supabaseUser.bet_stats || {},
            daily_missions: supabaseUser.daily_missions || {},
            daily_missions_date: supabaseUser.daily_missions_date || null,
            daily_stats: supabaseUser.daily_stats || {},
            achievements: supabaseUser.achievements || {},
            missions_reset_today: supabaseUser.missions_reset_today || false,
            
            // Fechas
            created_at: supabaseUser.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    async insertUserDirectly(userId, userData) {
        // Inserción directa en MySQL
        await this.mysqlDb.pool.execute(`
            INSERT INTO users (
                id, balance, level, xp, total_xp, last_daily, last_work,
                last_robbery, last_coinflip, last_dice, last_roulette,
                last_lotto, last_blackjack, last_name_work, messages_count,
                items, stats, bet_stats, daily_missions, daily_missions_date,
                daily_stats, achievements, missions_reset_today, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userId, userData.balance, userData.level, userData.xp, userData.total_xp,
            userData.last_daily, userData.last_work, userData.last_robbery,
            userData.last_coinflip, userData.last_dice, userData.last_roulette,
            userData.last_lotto, userData.last_blackjack, userData.last_name_work,
            userData.messages_count, JSON.stringify(userData.items),
            JSON.stringify(userData.stats), JSON.stringify(userData.bet_stats),
            JSON.stringify(userData.daily_missions), userData.daily_missions_date,
            JSON.stringify(userData.daily_stats), JSON.stringify(userData.achievements),
            userData.missions_reset_today, userData.created_at, userData.updated_at
        ]);
    }

    async migrateTrades() {
        console.log('🤝 Migrando trades...');
        
        try {
            const { data: trades, error } = await this.supabase
                .from('trades') // Ajusta el nombre de la tabla
                .select('*');

            if (error) throw error;

            this.stats.trades.total = trades.length;
            console.log(`📊 Total trades en Supabase: ${trades.length}`);

            for (const trade of trades) {
                try {
                    await this.mysqlDb.createTrade({
                        id: trade.id,
                        initiator: trade.initiator,
                        target: trade.target,
                        initiator_items: trade.initiator_items || {},
                        target_items: trade.target_items || {},
                        initiator_money: trade.initiator_money || 0,
                        target_money: trade.target_money || 0,
                        status: trade.status || 'pending'
                    });
                    
                    this.stats.trades.migrated++;
                } catch (error) {
                    console.error(`❌ Error migrando trade ${trade.id}:`, error.message);
                    this.stats.trades.errors++;
                }
            }
            
            console.log(`🎉 Trades completados: ${this.stats.trades.migrated}/${this.stats.trades.total}\n`);
            
        } catch (error) {
            console.error('❌ Error obteniendo trades de Supabase:', error);
        }
    }

    async migrateGames() {
        console.log('🎮 Migrando juegos...');
        
        try {
            // Migrar Russian Roulette
            await this.migrateRussianGames();
            // Migrar UNO
            await this.migrateEvents();
            
        } catch (error) {
            console.error('❌ Error migrando juegos:', error);
        }
    }

    async migrateRussianGames() {
        const { data: games, error } = await this.supabase
            .from('russian_games') // Ajusta el nombre
            .select('*');

        if (error) {
            console.log('⚠️  No se encontraron juegos de ruleta rusa en Supabase');
            return;
        }

        for (const game of games) {
            try {
                await this.mysqlDb.createRussianGame(game.id, {
                    channel_id: game.channel_id,
                    creator_id: game.creator_id,
                    bet_amount: game.bet_amount,
                    players: game.players || [],
                    phase: game.phase || 'waiting',
                    pot: game.pot || 0
                });
                
                this.stats.games.migrated++;
            } catch (error) {
                console.error(`❌ Error migrando juego ${game.id}:`, error.message);
                this.stats.games.errors++;
            }
        }
    }

    async migrateEvents() {
        const { data: events, error } = await this.supabase
            .from('server_events') // o el nombre de tu tabla de eventos
            .select('*');

        if (error) {
            console.log('⚠️  No se encontraron eventos en Supabase');
            return;
        }

        this.stats.events = { total: events.length, migrated: 0, errors: 0 };
        console.log(`📊 Total eventos en Supabase: ${events.length}`);

        for (const event of events) {
            try {
                await this.mysqlDb.createServerEvent({
                    id: event.id,
                    type: event.type,
                    name: event.name,
                    description: event.description,
                    emoji: event.emoji,
                    color: event.color,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    duration: event.duration,
                    multipliers: event.multipliers || {},
                    is_special: event.is_special || false,
                    is_negative: event.is_negative || false,
                    is_rare: event.is_rare || false,
                    triggered_by: event.triggered_by,
                    participant_count: event.participant_count || 0,
                    stats: event.stats || {}
                });
                
                this.stats.events.migrated++;
            } catch (error) {
                console.error(`❌ Error migrando evento ${event.id}:`, error.message);
                this.stats.events.errors++;
            }
        }

        console.log(`🎉 Eventos completados: ${this.stats.events.migrated}/${this.stats.events.total}`);
    }

    showFinalStats() {
        console.log('\n📊 RESUMEN DE MIGRACIÓN:');
        console.log('=========================');
        console.log(`👤 Usuarios: ${this.stats.users.migrated}/${this.stats.users.total} (${this.stats.users.errors} errores)`);
        console.log(`🤝 Trades: ${this.stats.trades.migrated}/${this.stats.trades.total} (${this.stats.trades.errors} errores)`);
        console.log(`🎮 Juegos: ${this.stats.games.migrated}/${this.stats.games.total} (${this.stats.games.errors} errores)`);
        console.log(`📅 Eventos: ${this.stats.events.migrated}/${this.stats.events.total} (${this.stats.events.errors} errores)`);
        
        const totalMigrated = this.stats.users.migrated + this.stats.trades.migrated + this.stats.games.migrated + this.stats.events.migrated;
        const totalRecords = this.stats.users.total + this.stats.trades.total + this.stats.games.total + this.stats.events.total;
        const totalErrors = this.stats.users.errors + this.stats.trades.errors + this.stats.games.errors + this.stats.events.errors;
        
        console.log(`\n🎉 TOTAL: ${totalMigrated}/${totalRecords} registros migrados`);
        
        if (totalErrors > 0) {
            console.log(`⚠️  Total errores: ${totalErrors}`);
        } else {
            console.log('✅ ¡Migración completada sin errores!');
        }
    }

    // Método para hacer backup antes de migrar
    async createBackup() {
        console.log('💾 Creando backup de Supabase...');
        
        try {
            const { data: users } = await this.supabase.from('users').select('*');
            const { data: trades } = await this.supabase.from('trades').select('*');
            
            const backup = {
                timestamp: new Date().toISOString(),
                users: users || [],
                trades: trades || [],
                total_records: (users?.length || 0) + (trades?.length || 0)
            };
            
            const fs = require('fs');
            const backupPath = `./supabase_backup_${Date.now()}.json`;
            fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
            
            console.log(`✅ Backup creado: ${backupPath}`);
            return backupPath;
            
        } catch (error) {
            console.error('❌ Error creando backup:', error);
        }
    }
}

// Ejecutar migración
async function runMigration() {
    const migration = new DataMigration();
    
    // Opcional: crear backup primero
    // await migration.createBackup();
    
    await migration.startMigration();
    process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    runMigration();
}

module.exports = DataMigration;