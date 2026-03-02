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
}

module.exports = GuildConfig;