// guild-levels.js
class GuildLevels {
    constructor(database, guildConfig) {
        this.db = database;
        this.guildConfig = guildConfig;
        this.cooldowns = new Map(); // userId_guildId -> timestamp
        this.cache = new Map();     // guildId -> { data, lastSaved }
        this.COOLDOWN = 10000;
        this.XP_PER_MESSAGE = 25;
        this.XP_VARIATION = 10;
        this.SAVE_INTERVAL = 30000; // Guardar en DB cada 30s máximo
    }

    // No necesita initTable — usa guild_config que ya existe

    async isEnabled(guildId) {
        const val = await this.guildConfig.get(guildId, 'guild_levels_enabled');
        return val === 'true';
    }

    async setEnabled(guildId, enabled) {
        await this.guildConfig.set(guildId, 'guild_levels_enabled', enabled ? 'true' : 'false');
    }

    getXpForLevel(level) {
        return Math.floor(30 * Math.pow(level, 1.3));
    }

    // Leer datos del servidor (con caché en memoria)
    async getGuildData(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return cached.data;

        const raw = await this.guildConfig.get(guildId, 'levels_data');
        const data = raw ? JSON.parse(raw) : {};
        this.cache.set(guildId, { data, lastSaved: Date.now() });
        return data;
    }

    // Guardar datos (con throttle para no sobrecargar la DB)
    async saveGuildData(guildId, data, force = false) {
        const cached = this.cache.get(guildId);
        const now = Date.now();

        this.cache.set(guildId, { data, lastSaved: cached?.lastSaved || now });

        // Solo escribir en DB si pasaron 30s o es forzado
        if (force || !cached || now - cached.lastSaved >= this.SAVE_INTERVAL) {
            await this.guildConfig.set(guildId, 'levels_data', JSON.stringify(data));
            this.cache.set(guildId, { data, lastSaved: now });
        }
    }

    // Obtener usuario dentro del JSON del servidor
    async getUser(userId, guildId) {
        const data = await this.getGuildData(guildId);
        if (!data[userId]) {
            data[userId] = { xp: 0, level: 1, total_xp: 0 };
        }
        return data[userId];
    }

    async processMessage(userId, guildId) {
        try {
            if (!await this.isEnabled(guildId)) return null;

            const key = `${userId}_${guildId}`;
            const now = Date.now();
            if ((this.cooldowns.get(key) || 0) + this.COOLDOWN > now) return null;
            this.cooldowns.set(key, now);

            const data = await this.getGuildData(guildId);
            if (!data[userId]) data[userId] = { xp: 0, level: 1, total_xp: 0 };

            const u = data[userId];
            const xpGained = this.XP_PER_MESSAGE + Math.floor(Math.random() * this.XP_VARIATION * 2) - this.XP_VARIATION;
            u.xp += xpGained;
            u.total_xp += xpGained;

            const oldLevel = u.level;
            while (true) {
                const xpNeeded = this.getXpForLevel(u.level + 1);
                if (u.xp < xpNeeded) break;
                u.xp -= xpNeeded;
                u.level++;
                if (u.level >= 500) break;
            }

            await this.saveGuildData(guildId, data);

            if (u.level > oldLevel) {
                return { levelUp: true, oldLevel, newLevel: u.level, xpGained, levelsGained: u.level - oldLevel };
            }
            return { levelUp: false, xpGained };
        } catch (error) {
            console.error('❌ Error en GuildLevels.processMessage:', error.message);
            return null;
        }
    }

    async getLeaderboard(guildId, limit = 10) {
        const data = await this.getGuildData(guildId);
        return Object.entries(data)
            .map(([userId, u]) => ({ userId, ...u }))
            .sort((a, b) => b.total_xp - a.total_xp)
            .slice(0, limit);
    }

    async getRank(userId, guildId) {
        const data = await this.getGuildData(guildId);
        const sorted = Object.entries(data).sort((a, b) => b[1].total_xp - a[1].total_xp);
        const index = sorted.findIndex(([id]) => id === userId);
        return index === -1 ? null : index + 1;
    }

    // Forzar guardado de todos los servidores en caché (llamar al apagar el bot)
    async flushAll() {
        for (const [guildId, { data }] of this.cache.entries()) {
            await this.guildConfig.set(guildId, 'levels_data', JSON.stringify(data));
        }
        console.log('✅ GuildLevels: datos guardados en DB');
    }

    cleanCooldowns() {
        const cutoff = Date.now() - this.COOLDOWN * 2;
        for (const [key, ts] of this.cooldowns.entries()) {
            if (ts < cutoff) this.cooldowns.delete(key);
        }
        // Limpiar caché de guilds inactivos (más de 10 min)
        const cacheCutoff = Date.now() - 600000;
        for (const [guildId, { lastSaved }] of this.cache.entries()) {
            if (lastSaved < cacheCutoff) this.cache.delete(guildId);
        }
    }

    async processCommand(message, client) {
        if (!message.content.startsWith('>')) return;
        const args = message.content.trim().split(/ +/);
        const cmd = args[0].toLowerCase();

        switch (cmd) {
            case '>slevel':
            case '>srank':
                await this.handleRank(message);
                break;
            case '>stop':
            case '>stoplevel':
                await this.handleTop(message);
                break;
            case '>enablelevels':
                await this.handleToggle(message, true);
                break;
            case '>disablelevels':
                await this.handleToggle(message, false);
                break;
            case '>ssetlevelchannel':
                await this.handleSetChannel(message);
                break;
        }
    }

    async handleRank(message) {
        const guildId = message.guild.id;
        if (!await this.isEnabled(guildId)) return message.reply('❌ El sistema de niveles del servidor no está activado. Un admin puede activarlo con `>enablelevels`.');

        const { EmbedBuilder } = require('discord.js');
        const userId = message.author.id;
        const u = await this.getUser(userId, guildId);
        const rank = await this.getRank(userId, guildId);
        const xpNeeded = this.getXpForLevel(u.level + 1);
        const progress = Math.min(20, Math.floor((u.xp / xpNeeded) * 20));
        const bar = '█'.repeat(progress) + '░'.repeat(20 - progress);

        const embed = new EmbedBuilder()
            .setTitle(`📊 Nivel en ${message.guild.name}`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setColor('#5865F2')
            .addFields(
                { name: '🏆 Nivel', value: `**${u.level}**`, inline: true },
                { name: '🥇 Rango', value: rank ? `**#${rank}**` : '**#?**', inline: true },
                { name: '✨ XP Total', value: `**${u.total_xp.toLocaleString()}**`, inline: true },
                { name: `📈 Progreso al nivel ${u.level + 1}`, value: `\`${bar}\`\n${u.xp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, inline: false }
            )
            .setFooter({ text: 'Usa >stop para ver el ranking del servidor' });

        await message.reply({ embeds: [embed] });
    }

    async handleTop(message) {
        const guildId = message.guild.id;
        if (!await this.isEnabled(guildId)) return message.reply('❌ El sistema de niveles del servidor no está activado.');

        const { EmbedBuilder } = require('discord.js');
        const loadingMsg = await message.reply('🔍 Cargando ranking...');
        const leaderboard = await this.getLeaderboard(guildId, 10);

        if (!leaderboard.length) return loadingMsg.edit('❌ No hay datos todavía.');

        let description = '';
        for (let i = 0; i < leaderboard.length; i++) {
            const u = leaderboard[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
            const member = message.guild.members.cache.get(u.userId) ||
                           await message.guild.members.fetch(u.userId).catch(() => null);
            const name = member ? member.displayName : `<@${u.userId}>`;
            description += `${medal} ${name} — Nivel **${u.level}** · ${u.total_xp.toLocaleString()} XP\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`🏆 Top Niveles — ${message.guild.name}`)
            .setDescription(description)
            .setColor('#5865F2')
            .setFooter({ text: 'Usa >slevel para ver tu rango' });

        await loadingMsg.edit({ content: '', embeds: [embed] });
    }

    async handleToggle(message, enable) {
        if (!message.member?.permissions.has('Administrator')) return message.reply('❌ Necesitas permisos de administrador.');
        const { EmbedBuilder } = require('discord.js');

        await this.setEnabled(message.guild.id, enable);

        const embed = new EmbedBuilder()
            .setTitle(enable ? '✅ Niveles del servidor activados' : '❌ Niveles del servidor desactivados')
            .setDescription(enable
                ? 'Los miembros ganarán XP al chatear.\nUsa `>ssetlevelchannel #canal` para configurar dónde anunciar los level ups.'
                : 'Los datos existentes se conservan. Puedes reactivarlo con `>enablelevels`.')
            .setColor(enable ? '#00FF00' : '#FF0000');

        await message.reply({ embeds: [embed] });
    }

    async handleSetChannel(message) {
        if (!message.member?.permissions.has('Administrator')) return message.reply('❌ Necesitas permisos de administrador.');
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ Usa: `>ssetlevelchannel #canal`');
        await this.guildConfig.set(message.guild.id, 'guild_levelup_channel', channel.id);
        await message.reply(`✅ Los level ups del servidor se anunciarán en ${channel}`);
    }
}

module.exports = GuildLevels;
