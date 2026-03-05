// guild-levels.js
class GuildLevels {
    constructor(database, guildConfig) {
        this.db = database;
        this.guildConfig = guildConfig;
        this.cooldowns = new Map(); // userId_guildId -> timestamp
        this.COOLDOWN = 60000; // 1 minuto entre XP
        this.XP_PER_MESSAGE = 15;
        this.XP_VARIATION = 5;
    }

    async initTable() {
        try {
            await this.db.pool.execute(`
                CREATE TABLE IF NOT EXISTS guild_levels (
                    user_id VARCHAR(30) NOT NULL,
                    guild_id VARCHAR(30) NOT NULL,
                    xp INT DEFAULT 0,
                    level INT DEFAULT 1,
                    total_xp INT DEFAULT 0,
                    last_message BIGINT DEFAULT 0,
                    PRIMARY KEY (user_id, guild_id)
                )
            `);
            console.log('✅ Tabla guild_levels lista');
        } catch (error) {
            console.error('❌ Error creando tabla guild_levels:', error.message);
        }
    }

    // Verificar si el sistema está activo en este servidor
    async isEnabled(guildId) {
        const val = await this.guildConfig.get(guildId, 'guild_levels_enabled');
        return val === 'true';
    }

    async setEnabled(guildId, enabled) {
        await this.guildConfig.set(guildId, 'guild_levels_enabled', enabled ? 'true' : 'false');
    }

    // XP necesaria para subir al siguiente nivel
    getXpForLevel(level) {
        return Math.floor(100 * Math.pow(level, 1.5));
    }

    // Obtener o crear usuario en el servidor
    async getUser(userId, guildId) {
        try {
            const [rows] = await this.db.pool.execute(
                'SELECT * FROM guild_levels WHERE user_id = ? AND guild_id = ?',
                [userId, guildId]
            );
            if (rows.length > 0) return rows[0];

            // Crear si no existe
            await this.db.pool.execute(
                'INSERT INTO guild_levels (user_id, guild_id, xp, level, total_xp, last_message) VALUES (?, ?, 0, 1, 0, 0)',
                [userId, guildId]
            );
            return { user_id: userId, guild_id: guildId, xp: 0, level: 1, total_xp: 0, last_message: 0 };
        } catch (error) {
            console.error('❌ Error en GuildLevels.getUser:', error.message);
            return null;
        }
    }

    // Procesar XP por mensaje
    async processMessage(userId, guildId) {
        try {
            if (!await this.isEnabled(guildId)) return null;

            const key = `${userId}_${guildId}`;
            const now = Date.now();
            const last = this.cooldowns.get(key) || 0;
            if (now - last < this.COOLDOWN) return null;
            this.cooldowns.set(key, now);

            const user = await this.getUser(userId, guildId);
            if (!user) return null;

            const xpGained = this.XP_PER_MESSAGE + Math.floor(Math.random() * this.XP_VARIATION * 2) - this.XP_VARIATION;
            const newXp = user.xp + xpGained;
            const newTotalXp = user.total_xp + xpGained;
            const oldLevel = user.level;

            // Calcular nuevo nivel
            let newLevel = oldLevel;
            let currentXp = newXp;
            while (currentXp >= this.getXpForLevel(newLevel + 1)) {
                currentXp -= this.getXpForLevel(newLevel + 1);
                newLevel++;
            }

            await this.db.pool.execute(
                'UPDATE guild_levels SET xp = ?, level = ?, total_xp = ?, last_message = ? WHERE user_id = ? AND guild_id = ?',
                [currentXp, newLevel, newTotalXp, now, userId, guildId]
            );

            if (newLevel > oldLevel) {
                return { levelUp: true, oldLevel, newLevel, xpGained, levelsGained: newLevel - oldLevel };
            }

            return { levelUp: false, xpGained };
        } catch (error) {
            console.error('❌ Error en GuildLevels.processMessage:', error.message);
            return null;
        }
    }

    // Top del servidor
    async getLeaderboard(guildId, limit = 10) {
        try {
            const [rows] = await this.db.pool.execute(
                'SELECT user_id, level, total_xp FROM guild_levels WHERE guild_id = ? ORDER BY total_xp DESC LIMIT ?',
                [guildId, limit]
            );
            return rows;
        } catch (error) {
            console.error('❌ Error en leaderboard:', error.message);
            return [];
        }
    }

    // Rango del usuario en el servidor
    async getRank(userId, guildId) {
        try {
            const [rows] = await this.db.pool.execute(
                'SELECT COUNT(*) as rank FROM guild_levels WHERE guild_id = ? AND total_xp > (SELECT total_xp FROM guild_levels WHERE user_id = ? AND guild_id = ?)',
                [guildId, userId, guildId]
            );
            return (rows[0]?.rank || 0) + 1;
        } catch (error) {
            return null;
        }
    }

    // Limpiar cooldowns viejos
    cleanCooldowns() {
        const cutoff = Date.now() - this.COOLDOWN * 2;
        for (const [key, ts] of this.cooldowns.entries()) {
            if (ts < cutoff) this.cooldowns.delete(key);
        }
    }

    // Comandos
    async processCommand(message, client) {
        if (!message.content.startsWith('>')) return;
        const args = message.content.split(' ');
        const cmd = args[0].toLowerCase();

        switch (cmd) {
            case '>slevel':
            case '>srank':
                await this.handleRank(message);
                break;
            case '>stop':
            case '>stoplevel':
                await this.handleTop(message, client);
                break;
            case '>enablelevels':
            case '>disablelevels':
                await this.handleToggle(message, cmd === '>enablelevels');
                break;
            case '>ssetlevelchannel':
                await this.handleSetChannel(message);
                break;
        }
    }

    async handleRank(message) {
        const guildId = message.guild.id;
        if (!await this.isEnabled(guildId)) {
            return message.reply('❌ El sistema de niveles del servidor no está activado.');
        }

        const { EmbedBuilder } = require('discord.js');
        const userId = message.author.id;
        const user = await this.getUser(userId, guildId);
        if (!user) return message.reply('❌ No tienes datos en este servidor todavía.');

        const rank = await this.getRank(userId, guildId);
        const xpNeeded = this.getXpForLevel(user.level + 1);
        const progress = Math.floor((user.xp / xpNeeded) * 20);
        const bar = '█'.repeat(progress) + '░'.repeat(20 - progress);

        const embed = new EmbedBuilder()
            .setTitle(`📊 Nivel en ${message.guild.name}`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setColor('#5865F2')
            .addFields(
                { name: '🏆 Nivel', value: `**${user.level}**`, inline: true },
                { name: '🥇 Rango', value: `**#${rank}**`, inline: true },
                { name: '✨ XP Total', value: `**${user.total_xp.toLocaleString()}**`, inline: true },
                { name: `📈 Progreso al nivel ${user.level + 1}`, value: `\`${bar}\`\n${user.xp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, inline: false }
            )
            .setFooter({ text: `Usa >stop para ver el ranking del servidor` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    async handleTop(message, client) {
        const guildId = message.guild.id;
        if (!await this.isEnabled(guildId)) {
            return message.reply('❌ El sistema de niveles del servidor no está activado.');
        }

        const { EmbedBuilder } = require('discord.js');
        const loadingMsg = await message.reply('🔍 Cargando ranking...');
        const leaderboard = await this.getLeaderboard(guildId, 10);

        if (!leaderboard.length) {
            return loadingMsg.edit('❌ No hay datos todavía.');
        }

        let description = '';
        for (let i = 0; i < leaderboard.length; i++) {
            const u = leaderboard[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
            const member = message.guild.members.cache.get(u.user_id) ||
                           await message.guild.members.fetch(u.user_id).catch(() => null);
            const name = member ? member.displayName : `<@${u.user_id}>`;
            description += `${medal} ${name}\n📊 Nivel **${u.level}** · ${u.total_xp.toLocaleString()} XP\n\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`🏆 Top Niveles — ${message.guild.name}`)
            .setDescription(description)
            .setColor('#5865F2')
            .setFooter({ text: 'Usa >slevel para ver tu rango' })
            .setTimestamp();

        await loadingMsg.edit({ content: '', embeds: [embed] });
    }

    async handleToggle(message, enable) {
        if (!message.member?.permissions.has('Administrator')) {
            return message.reply('❌ Necesitas permisos de administrador.');
        }

        const guildId = message.guild.id;
        await this.setEnabled(guildId, enable);

        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle(enable ? '✅ Niveles activados' : '❌ Niveles desactivados')
            .setDescription(enable
                ? `El sistema de niveles del servidor está ahora **activo**.\nLos miembros ganarán XP al chatear.\n\nUsa \`>ssetlevelchannel #canal\` para configurar dónde anunciar los level ups.`
                : `El sistema de niveles del servidor está ahora **desactivado**.\nLos datos existentes se conservan.`)
            .setColor(enable ? '#00FF00' : '#FF0000');

        await message.reply({ embeds: [embed] });
    }

    async handleSetChannel(message) {
        if (!message.member?.permissions.has('Administrator')) {
            return message.reply('❌ Necesitas permisos de administrador.');
        }

        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ Menciona el canal: `>ssetlevelchannel #canal`');

        await this.guildConfig.set(message.guild.id, 'guild_levelup_channel', channel.id);
        await message.reply(`✅ Los level ups del servidor se anunciarán en ${channel}`);
    }
}

module.exports = GuildLevels;