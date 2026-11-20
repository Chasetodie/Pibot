const { EmbedBuilder } = require('discord.js');

class MaintenanceSystem {
    constructor(database) {
        this.database = database;
        this.cache = { maintenance: null, changelog: null, lastCheck: 0 };
        this.CACHE_TTL = 30000;
        this.notifiedMaintenance = new Set();
        this.notifiedChangelog = new Set();

        this.testMode = false;
        this.testUserId = null;
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

        if (maintenance) {
            if (now >= maintenance.scheduled_at) {
                await this.database.disableMaintenance(maintenance.id);
                this.invalidateCache();
            } else {
                const cacheKey = `${userId}_${maintenance.id}`;
                if (!this.notifiedMaintenance.has(cacheKey)) {
                    const userData = await this.database.getUserMaintenanceData(userId);

                    const alreadySeen = userData.idMaintenance === maintenance.id && userData.seeMaintenance === true;

                    if (!alreadySeen) {
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

        if (changelog) {
            const cacheKey = `${userId}_${changelog.id}`;
            if (!this.notifiedChangelog.has(cacheKey)) {
                const userData = await this.database.getUserMaintenanceData(userId);

                if (userData.idChangelog === undefined) {
                    userData.idChangelog = changelog.id;
                    userData.seeChangelog = true;
                    await this.database.updateUserMaintenanceData(userId, userData);
                    this.notifiedChangelog.add(cacheKey);
                    return;
                }

                const alreadySeen = userData.idChangelog === changelog.id && userData.seeChangelog === true;

                if (!alreadySeen) {
                    userData.idChangelog = changelog.id;
                    userData.seeChangelog = true;
                    await this.database.updateUserMaintenanceData(userId, userData);
                    this.notifiedChangelog.add(cacheKey);

                    let changes;
                    try {
                        changes = typeof changelog.changelog === 'string'
                            ? JSON.parse(changelog.changelog)
                            : changelog.changelog;
                    } catch (error) {
                        console.error('❌ Changelog corrupto:', error.message);
                        return channel.send({
                            embeds: [new EmbedBuilder()
                                .setTitle('❌ Error')
                                .setDescription('El changelog está corrupto. Contacta al desarrollador.')
                                .setColor('#FF0000')]
                        }).catch(() => {});
                    }

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

        const userId = message.author.id;
        const userData = await this.database.getUserMaintenanceData(userId);
        if (userData.idChangelog !== changelog.id) {
            userData.idChangelog = changelog.id;
            userData.seeChangelog = true;
            await this.database.updateUserMaintenanceData(userId, userData);
        }

        let changes;
        try {
            changes = typeof changelog.changelog === 'string'
                ? JSON.parse(changelog.changelog)
                : changelog.changelog;
        } catch (error) {
            console.error('❌ Changelog corrupto:', error.message);
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Error')
                    .setDescription('El changelog está corrupto. Contacta al desarrollador.')
                    .setColor('#FF0000')]
            });
        }

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

        embed.setFooter({ text: '¿Encontraste un bug? Contacta a chasetodie10' });
        return message.reply({ embeds: [embed] });
    }
}

module.exports = MaintenanceSystem;