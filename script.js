const { createClient } = require('@supabase/supabase-js');
const LocalDatabase = require('./database');

async function migrateFromSupabase() {
    console.log('🚀 Iniciando migración...');
    
    // Conectar a ambas bases
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const sqlite = new LocalDatabase();
    
    try {
        // 1. Migrar USUARIOS
        console.log('👥 Migrando usuarios...');
        const { data: users } = await supabase.from('users').select('*');
        
        for (const user of users || []) {
            await sqlite.db.run(`
                INSERT OR REPLACE INTO users (
                    id, balance, level, xp, total_xp, last_daily, last_work,
                    last_robbery, last_coinflip, last_dice, last_roulette,
                    last_lotto, last_blackjack, last_name_work, messages_count,
                    items, stats, bet_stats, daily_missions, daily_missions_date,
                    daily_stats, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                user.id, user.balance, user.level, user.xp, user.total_xp,
                user.last_daily, user.last_work, user.last_robbery,
                user.last_coinflip, user.last_dice, user.last_roulette,
                user.last_lotto, user.last_blackjack, user.last_name_work,
                user.messages_count, JSON.stringify(user.items || {}),
                JSON.stringify(user.stats || {}), JSON.stringify(user.bet_stats || {}),
                JSON.stringify(user.daily_missions || {}), user.daily_missions_date,
                JSON.stringify(user.daily_stats || {}), user.created_at, user.updated_at
            ]);
        }
               
        // 3. Migrar EVENTOS
        console.log('🎮 Migrando eventos...');
        const { data: events } = await supabase.from('server_events').select('*');
        
        for (const event of events || []) {
            await sqlite.db.run(`
                INSERT OR REPLACE INTO server_events (
                    id, type, name, description, emoji, color,
                    start_time, end_time, duration, multipliers,
                    is_special, is_negative, is_rare, triggered_by,
                    participant_count, stats, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                event.id, event.type, event.name, event.description,
                event.emoji, event.color, event.start_time, event.end_time,
                event.duration, JSON.stringify(event.multipliers || {}),
                event.is_special, event.is_negative, event.is_rare,
                event.triggered_by, event.participant_count,
                JSON.stringify(event.stats || {}), event.updated_at
            ]);
        }
        
        console.log('✅ ¡Migración completada!');
        
    } catch (error) {
        console.error('❌ Error en migración:', error);
    } finally {
        sqlite.close();
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    migrateFromSupabase();
}