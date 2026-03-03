// guild-config.js
class GuildConfig {
    constructor(database) {
        this.db = database;
    }

    async initTable() {
        try {
            await this.db.pool.execute(`
                CREATE TABLE IF NOT EXISTS guild_config (
                    guild_id VARCHAR(30) NOT NULL,
                    \`key\` VARCHAR(50) NOT NULL,
                    value TEXT,
                    PRIMARY KEY (guild_id, \`key\`)
                )
            `);
            console.log('✅ Tabla guild_config lista');
        } catch (error) {
            console.error('❌ Error creando tabla guild_config:', error.message);
        }
    }

    async get(guildId, key) {
        try {
            const [rows] = await this.db.pool.execute(
                'SELECT value FROM guild_config WHERE guild_id = ? AND `key` = ?',
                [guildId, key]
            );
            return rows.length > 0 ? rows[0].value : null;
        } catch (error) {
            console.error('❌ Error en GuildConfig.get:', error.message);
            return null;
        }
    }

    async set(guildId, key, value) {
        try {
            await this.db.pool.execute(
                'INSERT INTO guild_config (guild_id, `key`, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?',
                [guildId, key, value, value]
            );
        } catch (error) {
            console.error('❌ Error en GuildConfig.set:', error.message);
        }
    }

    async getAll(guildId) {
        try {
            const [rows] = await this.db.pool.execute(
                'SELECT `key`, value FROM guild_config WHERE guild_id = ?',
                [guildId]
            );
            const config = {};
            rows.forEach(r => config[r.key] = r.value);
            return config;
        } catch (error) {
            console.error('❌ Error en GuildConfig.getAll:', error.message);
            return {};
        }
    }

    async getEventsRole(guildId) {
        return await this.get(guildId, 'events_role');
    }

    async setEventsRole(guildId, roleId) {
        return await this.set(guildId, 'events_role', roleId);
    }

    async isEventEnabled(guildId, eventType) {
        const val = await this.get(guildId, `event_disabled_${eventType}`);
        return val !== 'true'; // Por defecto todos habilitados
    }

    async setEventEnabled(guildId, eventType, enabled) {
        await this.set(guildId, `event_disabled_${eventType}`, enabled ? 'false' : 'true');
    }

    async getDisabledEvents(guildId) {
        const all = await this.getAll(guildId);
        return Object.entries(all)
            .filter(([k, v]) => k.startsWith('event_disabled_') && v === 'true')
            .map(([k]) => k.replace('event_disabled_', ''));
    }

    async areEventsEnabled(guildId) {
        const val = await this.get(guildId, 'events_globally_enabled');
        // Por defecto: deshabilitado (null = no configurado = deshabilitado)
        return val === 'true';
    }

    async setEventsGloballyEnabled(guildId, enabled) {
        const wasNull = !(await this.get(guildId, 'events_globally_enabled'));
        await this.set(guildId, 'events_globally_enabled', enabled ? 'true' : 'false');
        return wasNull; // Retorna true si era la primera vez
    }
}

module.exports = GuildConfig;