// guild-config.js
class GuildConfig {
    constructor(database) {
        this.db = database;
        this.initTable();
    }

    async initTable() {
        await this.db.run(`
            CREATE TABLE IF NOT EXISTS guild_config (
                guild_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT,
                PRIMARY KEY (guild_id, key)
            )
        `);
    }

    async get(guildId, key) {
        const row = await this.db.get(
            'SELECT value FROM guild_config WHERE guild_id = ? AND key = ?',
            [guildId, key]
        );
        return row ? row.value : null;
    }

    async set(guildId, key, value) {
        await this.db.run(
            'INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)',
            [guildId, key, value]
        );
    }

    async getAll(guildId) {
        const rows = await this.db.all(
            'SELECT key, value FROM guild_config WHERE guild_id = ?',
            [guildId]
        );
        const config = {};
        rows.forEach(r => config[r.key] = r.value);
        return config;
    }
}

module.exports = GuildConfig;