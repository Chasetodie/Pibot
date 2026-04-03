const { EmbedBuilder } = require('discord.js');

class MaintenanceSystem {
    constructor(database) {
        this.database = database;
        this.cache = { maintenance: null, changelog: null, lastCheck: 0 };
        this.CACHE_TTL = 30000;
        // Barrera en memoria para evitar doble envío en la misma sesión
        this.notifiedMaintenance = new Set();
        this.notifiedChangelog = new Set();
    }

    async getStatus() {
        if (Date.now() - this.cache.lastCheck < this.CACHE_TTL) {
            return this.cache;
        }
        const maintenance = await this.database.getActiveMaintenance();
        const changelog = await this.database.getLastChangelog();
        this.cache = { maintenance, changelog, lastCheck: Date.now() };
        return this.cache;
    }

    invalidateCache() {
        this.cache.lastCheck = 0;
        this.notifiedMaintenance.clear();
        this.notifiedChangelog.clear();
    }

    async checkAndNotify(userId, channel) {
        if (this.testMode && userId !== this.testUserId) return;

        const { maintenance, changelog } = await this.getStatus();
        const now = Date.now();

        // — MANTENIMIENTO —
        if (maintenance) {
            if (now >= maintenance.scheduled_at) {
                // Ya pasó la hora, desactivar
                await this.database.disableMaintenance(maintenance.id);
                this.invalidateCache();
            } else {
                const cacheKey = `${userId}_${maintenance.id}`;
                if (!this.notifiedMaintenance.has(cacheKey)) {
                    const userData = await this.database.getUserMaintenanceData(userId);

                    // seeMaintenance: true significa que YA vio este ID
                    const alreadySeen = userData.idMaintenance === maintenance.id && userData.seeMaintenance === true;

                    if (!alreadySeen) {
                        // Marcar ANTES de enviar para evitar race conditions
                        userData.idMaintenance = maintenance.id;
                        userData.seeMaintenance = true;
                        await this.database.updateUserMaintenanceData(userId, userData);
                        this.notifiedMaintenance.add(cacheKey);

                        const embed = new EmbedBuilder()
                            .setTitle('🔧 Mantenimiento Programado')
                            .setDescription(
                                `El bot entrará en mantenimiento <t:${Math.floor(maintenance.scheduled_at / 1000)}:R>\n` +
                                `📅 Hora: <t:${Math.floor(maintenance.scheduled_at / 1000)}:f>\n\n` +
                                `${maintenance.message || 'Se realizarán mejoras y correcciones.'}`
                            )
                            .setColor('#FF6600')
                            .setFooter({ text: 'Durante el mantenimiento algunos comandos pueden no funcionar' })
                            .setTimestamp();

                        await channel.send({ embeds: [embed] }).catch(() => {});
                    } else {
                        this.notifiedMaintenance.add(cacheKey);
                    }
                }
            }
        }

        // — CHANGELOG —
        if (changelog) {
            const cacheKey = `${userId}_${changelog.id}`;
            if (!this.notifiedChangelog.has(cacheKey)) {
                const userData = await this.database.getUserMaintenanceData(userId);

                const alreadySeen = userData.idChangelog === changelog.id && userData.seeChangelog === true;

                if (!alreadySeen) {
                    // Marcar ANTES de enviar
                    userData.idChangelog = changelog.id;
                    userData.seeChangelog = true;
                    await this.database.updateUserMaintenanceData(userId, userData);
                    this.notifiedChangelog.add(cacheKey);

                    const changes = typeof changelog.changelog === 'string'
                        ? JSON.parse(changelog.changelog)
                        : changelog.changelog;

                    const embed = new EmbedBuilder()
                        .setTitle('✨ ¡Pibot fue actualizado!')
                        .setDescription('Aquí están los cambios del último mantenimiento:')
                        .setColor('#00FF88')
                        .setTimestamp(changelog.created_at);

                    for (const [category, items] of Object.entries(changes)) {
                        embed.addFields({
                            name: category,
                            value: items.map(i => `• ${i}`).join('\n'),
                            inline: false
                        });
                    }

                    embed.setFooter({ text: '¡Gracias por usar Pibot! 🎉' });

                    await channel.send({ embeds: [embed] }).catch(() => {});
                } else {
                    this.notifiedChangelog.add(cacheKey);
                }
            }
        }
    }

    async showChangelog(message) {
        const changelog = await this.database.getLastChangelog();

        if (!changelog) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('📋 Changelog')
                    .setDescription('No hay changelogs disponibles aún.')
                    .setColor('#888888')]
            });
        }

        const changes = typeof changelog.changelog === 'string'
            ? JSON.parse(changelog.changelog)
            : changelog.changelog;

        const embed = new EmbedBuilder()
            .setTitle('✨ Último Changelog de Pibot')
            .setDescription('Estos son los cambios más recientes:')
            .setColor('#00FF88')
            .setTimestamp(changelog.created_at);

        for (const [category, items] of Object.entries(changes)) {
            embed.addFields({
                name: category,
                value: items.map(i => `• ${i}`).join('\n'),
                inline: false
            });
        }

        embed.setFooter({ text: '¿Encontraste un bug? Contáctate con chasetodie10' });
        return message.reply({ embeds: [embed] });
    }
}

module.exports = MaintenanceSystem;