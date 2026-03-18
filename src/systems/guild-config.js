// guild-config.js
class GuildConfig {
    constructor(database) {
        this.db = database;
        this.cache = new Map(); // guildId -> { data, lastSaved }
        this.SAVE_INTERVAL = 5000; // 5 segundos de throttle para escrituras
    }

    async initTable() {
        try {
            await this.db.pool.execute(`
                CREATE TABLE IF NOT EXISTS guild_config (
                    guild_id VARCHAR(30) NOT NULL,
                    value LONGTEXT NOT NULL,
                    PRIMARY KEY (guild_id)
                )
            `);
            console.log('✅ Tabla guild_config lista');
        } catch (error) {
            console.error('❌ Error creando tabla guild_config:', error.message);
        }
    }

    // Leer todo el JSON del servidor (con caché)
    async _getData(guildId) {
        if (!guildId) return {};
        const cached = this.cache.get(guildId);
        if (cached) return cached.data;

        try {
            const [rows] = await this.db.pool.execute(
                'SELECT value FROM guild_config WHERE guild_id = ?',
                [guildId]
            );
            const data = rows.length > 0 ? (typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value) : {};
            this.cache.set(guildId, { data, lastSaved: Date.now() });
            return data;
        } catch (error) {
            console.error('❌ Error en GuildConfig._getData:', error.message);
            return {};
        }
    }

    // Guardar con throttle
    async _saveData(guildId, data, force = false) {
        const cached = this.cache.get(guildId);
        const now = Date.now();
        this.cache.set(guildId, { data, lastSaved: cached?.lastSaved || now });

        if (force || !cached || now - cached.lastSaved >= this.SAVE_INTERVAL) {
            try {
                const json = JSON.stringify(data);
                await this.db.pool.execute(
                    'INSERT INTO guild_config (guild_id, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
                    [guildId, json, json]
                );
                this.cache.set(guildId, { data, lastSaved: now });
            } catch (error) {
                console.error('❌ Error en GuildConfig._saveData:', error.message);
            }
        }
    }

    // API pública — igual que antes
    async get(guildId, key) {
        if (!guildId || !key) return null;
        const data = await this._getData(guildId);
        return data[key] ?? null;
    }

    async set(guildId, key, value) {
        if (!guildId || !key) return;
        const data = await this._getData(guildId);
        data[key] = value;
        await this._saveData(guildId, data);
    }

    async getAll(guildId) {
        if (!guildId) return {};
        return await this._getData(guildId);
    }

    // Flush para cierre del bot
    async flushAll() {
        for (const [guildId, { data }] of this.cache.entries()) {
            try {
                const json = JSON.stringify(data);
                await this.db.pool.execute(
                    'INSERT INTO guild_config (guild_id, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
                    [guildId, json, json]
                );
            } catch (error) {
                console.error('❌ Error en flush:', error.message);
            }
        }
        console.log('✅ GuildConfig: datos guardados en DB');
    }

    // Métodos específicos — igual que antes, usan get/set internamente
    async getEventsRole(guildId) {
        return await this.get(guildId, 'events_role');
    }

    async setEventsRole(guildId, roleId) {
        return await this.set(guildId, 'events_role', roleId);
    }

    async isEventEnabled(guildId, eventType) {
        const data = await this._getData(guildId);
        return data[`event_disabled_${eventType}`] !== 'true';
    }

    async setEventEnabled(guildId, eventType, enabled) {
        await this.set(guildId, `event_disabled_${eventType}`, enabled ? 'false' : 'true');
    }

    async getDisabledEvents(guildId) {
        const data = await this._getData(guildId);
        return Object.entries(data)
            .filter(([k, v]) => k.startsWith('event_disabled_') && v === 'true')
            .map(([k]) => k.replace('event_disabled_', ''));
    }

    async areEventsEnabled(guildId) {
        const val = await this.get(guildId, 'events_globally_enabled');
        return val === 'true';
    }

    async setEventsGloballyEnabled(guildId, enabled) {
        const existing = await this.get(guildId, 'events_globally_enabled');
        const wasNull = existing === null;
        await this.set(guildId, 'events_globally_enabled', enabled ? 'true' : 'false');
        return wasNull;
    }

    async getRateLimit(guildId, adminId, commandType) {
        try {
            const val = await this.get(guildId, `ratelimit_${adminId}_${commandType}`);
            return val ? JSON.parse(val) : null;
        } catch { return null; }
    }

    async setRateLimit(guildId, adminId, commandType, data) {
        await this.set(guildId, `ratelimit_${adminId}_${commandType}`, JSON.stringify(data));
    }
}

module.exports = GuildConfig;