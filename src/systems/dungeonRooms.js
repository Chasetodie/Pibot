class DungeonRooms {
    constructor(dungeonSystem) {
        this.dungeon = dungeonSystem;
        this.economy = dungeonSystem.economy;
        this.currency = 'π-b$';
    }

    // ─── ENTRAR A UNA HABITACIÓN ───
    async enterRoom(message, userId, roomIndex, run) {
        const room = run.rooms[roomIndex];
        if (!room) return { success: false, message: '❌ Habitación no encontrada.' };

        // Actualizar posición actual
        run.current_room = roomIndex;
        run.rooms[roomIndex].visited = true;

        // Revelar habitaciones adyacentes
        const { connections } = this.dungeon.generateConnectionsFromRooms(run.rooms);
        const hasRevealAll = run.active_relics.some(r => r.effect === 'reveal_all_rooms');
        for (const adj of (connections[roomIndex] || [])) {
            if (!run.rooms[adj].revealed || hasRevealAll) {
                run.rooms[adj].revealed = true;
            }
        }

        await this.dungeon.updateRun(userId, {
            current_room: roomIndex,
            rooms: run.rooms,
        });

        // Habitación ya completada (solo descanso puede revisitarse)
        if (run.completed_rooms.includes(roomIndex) && room.type !== 'rest') {
            return { success: true, message: '🏚️ Esta habitación ya fue explorada. No queda nada aquí.' };
        }

        // Resolver según tipo
        switch (room.type) {
            case 'combat':    return await this.handleCombat(message, userId, run, roomIndex, false, false);
            case 'elite':     return await this.handleCombat(message, userId, run, roomIndex, true,  false);
            case 'boss':      return await this.handleCombat(message, userId, run, roomIndex, false, true);
            case 'chest':     return await this.handleChest(message, userId, run, roomIndex, false);
            case 'rare_chest':return await this.handleChest(message, userId, run, roomIndex, true);
            case 'rest':      return await this.handleRest(message, userId, run, roomIndex);
            case 'relic':     return await this.handleRelic(message, userId, run, roomIndex);
            case 'cursed':    return await this.handleCursed(message, userId, run, roomIndex);
            case 'gamble':    return await this.handleGamble(message, userId, run, roomIndex);
            case 'wizard':    return await this.handleWizard(message, userId, run, roomIndex);
            case 'trap':      return await this.handleTrap(message, userId, run, roomIndex);
            case 'altar':     return await this.handleAltar(message, userId, run, roomIndex);
            case 'abandoned': return await this.handleAbandoned(message, userId, run, roomIndex);
            default:          return { success: false, message: '❌ Tipo de habitación desconocido.' };
        }
    }

    // ─── MARCAR HABITACIÓN COMO COMPLETADA ───
    async completeRoom(userId, run, roomIndex) {
        if (!run.completed_rooms.includes(roomIndex)) {
            run.completed_rooms.push(roomIndex);
        }
        await this.dungeon.updateRun(userId, { completed_rooms: run.completed_rooms });
    }

    // ─── COMBATE ───
    async handleCombat(message, userId, run, roomIndex, isElite, isBoss) {
        const { EmbedBuilder } = require('discord.js');
        let enemy;

        if (isBoss) {
            enemy = await this.dungeon.getBossForFloor(run.floor, userId);
        } else if (isElite) {
            enemy = await this.dungeon.getEliteForFloor(run.floor, userId);
        } else {
            enemy = await this.dungeon.getEnemyForFloor(run.floor, userId);
        }

        const combatType = isBoss ? enemy.phases?.[0]?.combat || 'turns' : enemy.combat || 'turns';

        // Inicializar estado del combate
        const playerStats = await this.economy.equipment.getPlayerStats(userId);
        const modifiedStats = this.dungeon.applyRelicsToStats(playerStats, run.active_relics);
        const state = {
            enemy: { ...enemy, currentHp: enemy.hp, maxHp: enemy.hp },
            player: { ...modifiedStats, currentHp: run.hp },
            turn: 1, phase: 0, pressure: 0,
            simonPattern: [], simonStep: 0,
            currentIntent: null, log: [], ended: false,
        };

        // Embed de inicio
        const startEmbed = new EmbedBuilder()
            .setTitle(isBoss ? `👺 ¡JEFE! ${enemy.name}` : isElite ? `💀 ¡ÉLITE! ${enemy.name}` : `⚔️ ${enemy.name}`)
            .setColor(isBoss ? 0xe74c3c : isElite ? 0xe67e22 : 0x3498db)
            .setDescription(
                isBoss
                    ? `**¡Un jefe poderoso bloquea tu camino!**\n${enemy.phases?.[0]?.message || ''}`
                    : isElite
                    ? `**¡Un enemigo de élite aparece!**`
                    : `**¡Un enemigo aparece!**`
            )
            .addFields(
                { name: '❤️ HP del enemigo', value: `${enemy.hp}`, inline: true },
                { name: '⚔️ ATK', value: `${enemy.atk}`, inline: true },
                { name: '🛡️ DEF', value: `${enemy.def}`, inline: true },
            )
            .setFooter({ text: 'El combate comenzará en un momento...' });

        await message.reply({ embeds: [startEmbed] });

        // Iniciar combate
        const result = await this.dungeon.combat.startCombat(
            message, userId, enemy, combatType, run, isElite, isBoss
        );

        // Procesar resultado
        if (result.result === 'dead') {
            await this.dungeon.killRun(userId);
            return {
                success: true,
                dead: true,
                message: `💀 **Has muerto en combate.**\nLlegaste al piso **${run.floor}**.\nTodo el loot de la run se ha perdido.`
            };
        }

        if (result.result === 'fled') {
            await this.dungeon.updateRun(userId, { hp: result.state.player.currentHp });
            await this.completeRoom(userId, run, roomIndex);
            return { success: true, fled: true, message: '🏃 Huiste del combate. La habitación quedó bloqueada.' };
        }

        if (result.result === 'inactive') {
            await this.dungeon.updateRun(userId, { hp: Math.max(1, run.hp - (result.penaltyHp || 0)) });
            await this.completeRoom(userId, run, roomIndex);
            return { 
                success: true, 
                message: `⏰ **Abandonaste el combate por inactividad.**\n❤️ -${result.penaltyHp} HP como penalización.\nLa habitación quedó bloqueada.` 
            };
        }

        // Victoria
        const xpGained = enemy.xp || 0;
        const moneyGained = Math.floor(
            Math.random() * (enemy.money[1] - enemy.money[0]) + enemy.money[0]
        );
        const moneyBoosted = run.active_relics.some(r => r.effect === 'money_boost')
            ? Math.ceil(moneyGained * 1.15)
            : moneyGained;

        // Aplicar desgaste al equipo
        await this.economy.equipment.applyWear(userId, 1);

        // Actualizar run
        run.hp = result.state.player.currentHp;
        run.floor_money += moneyBoosted;
        run.total_money += moneyBoosted;

        await this.dungeon.updateRun(userId, {
            hp: run.hp,
            floor_money: run.floor_money,
            total_money: run.total_money,
        });

        // XP al jugador
        await this.economy.addXp(userId, xpGained);

        // Drop del jefe
        let dropText = '';
        if (isBoss && enemy.drop) {
            const drops = Math.random() < enemy.drop.chance;
            if (drops) {
                const itemCount = run.temp_inventory.length;
                if (itemCount < 20) {
                    run.temp_inventory.push({ id: enemy.drop.item, obtainedFloor: run.floor });
                    await this.dungeon.updateRun(userId, { temp_inventory: run.temp_inventory });
                    const itemData = this.economy.equipment.DUNGEON_ITEMS[enemy.drop.item];
                    dropText = `\n✨ **Drop:** ${itemData?.name || enemy.drop.item}`;
                }
            }
            // Actualizar bestiario
            await this.dungeon.updateBestiary(userId, enemy.id, enemy);
        }

        // Drop de élite
        if (isElite && enemy.drop) {
            const itemCount = run.temp_inventory.length;
            if (itemCount < 20) {
                run.temp_inventory.push({ id: enemy.drop, obtainedFloor: run.floor });
                await this.dungeon.updateRun(userId, { temp_inventory: run.temp_inventory });
                const itemData = this.economy.equipment.DUNGEON_ITEMS[enemy.drop];
                dropText = `\n✨ **Drop:** ${itemData?.name || enemy.drop}`;
            }
        }

        await this.completeRoom(userId, run, roomIndex);

        // Si era el jefe, marcar piso como completado
        if (isBoss) {
            await this.dungeon.updateRun(userId, { boss_defeated: 1 });
        }

        return {
            success: true,
            victory: true,
            isBoss,
            message: `✅ **¡Victoria!**\n💰 +${moneyBoosted.toLocaleString()} ${this.currency}\n⭐ +${xpGained} XP${dropText}`
        };
    }

    // ─── COFRE ───
    async handleChest(message, userId, run, roomIndex, isRare) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const moneyBase = isRare ? [300, 800] : [100, 350];
        const money = Math.floor(Math.random() * (moneyBase[1] - moneyBase[0]) + moneyBase[0]);
        const moneyBoosted = run.active_relics.some(r => r.effect === 'money_boost')
            ? Math.ceil(money * 1.15) : money;

        // Posibilidad de item
        const itemChance = isRare ? 0.7 : 0.35;
        let itemDrop = null;

        if (Math.random() < itemChance) {
            const rarityPool = isRare
                ? ['rare', 'epic', 'legendary']
                : ['uncommon', 'rare'];
            const eligible = Object.entries(this.economy.equipment.DUNGEON_ITEMS)
                .filter(([, v]) => rarityPool.includes(v.rarity));
            if (eligible.length && run.temp_inventory.length < 20) {
                const [itemId] = eligible[Math.floor(Math.random() * eligible.length)];
                itemDrop = itemId;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(isRare ? '💎 Cofre Raro' : '📦 Cofre Común')
            .setColor(isRare ? 0x9c27b0 : 0xff9800)
            .setDescription(
                `Encuentras un cofre ${isRare ? 'brillante' : ''} en la habitación.\n\n` +
                `💰 **Dinero:** ${moneyBoosted.toLocaleString()} ${this.currency}\n` +
                (itemDrop
                    ? `✨ **Item:** ${this.economy.equipment.DUNGEON_ITEMS[itemDrop]?.name || itemDrop}`
                    : `📦 *Sin items esta vez...*`)
            )
            .setFooter({ text: '¿Abres el cofre?' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`chest_open_${userId}`)
                .setLabel('Abrir cofre')
                .setEmoji('🔓')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`chest_leave_${userId}`)
                .setLabel('Ignorar')
                .setEmoji('🚶')
                .setStyle(ButtonStyle.Secondary),
        );

        const reply = await message.reply({ embeds: [embed], components: [row] });

        return new Promise(resolve => {
            const collector = reply.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 30000, max: 1
            });

            collector.on('collect', async interaction => {
                await interaction.deferUpdate();

                if (interaction.customId === `chest_open_${userId}`) {
                    run.floor_money += moneyBoosted;
                    run.total_money += moneyBoosted;

                    if (itemDrop) {
                        run.temp_inventory.push({ id: itemDrop, obtainedFloor: run.floor });
                        await this.dungeon.updateRun(userId, { temp_inventory: run.temp_inventory });
                    }

                    await this.dungeon.updateRun(userId, {
                        floor_money: run.floor_money,
                        total_money: run.total_money,
                    });

                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    await reply.edit({ components: [] });

                    resolve({
                        success: true,
                        message: `🔓 **Cofre abierto!**\n💰 +${moneyBoosted.toLocaleString()} ${this.currency}` +
                            (itemDrop ? `\n✨ Obtuviste **${this.economy.equipment.DUNGEON_ITEMS[itemDrop]?.name}**` : '')
                    });
                } else {
                    await reply.edit({ components: [] });
                    resolve({ success: true, message: '🚶 Ignoraste el cofre.' });
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await reply.edit({ components: [] }).catch(() => {});
                    resolve({ success: true, message: '⏰ No abriste el cofre a tiempo.' });
                }
            });
        });
    }

    // ─── DESCANSO ───
    async handleRest(message, userId, run, roomIndex) {
        const alreadyVisited = run.completed_rooms.includes(roomIndex);
        const healAmount = alreadyVisited ? Math.ceil(run.max_hp * 0.08) : Math.ceil(run.max_hp * 0.25);
        const newHp = Math.min(run.max_hp, run.hp + healAmount);
        const actualHeal = newHp - run.hp;

        await this.dungeon.updateRun(userId, { hp: newHp });
        run.hp = newHp;

        await this.completeRoom(userId, run, roomIndex);
        await this.dungeon.updateRun(userId, { current_room: roomIndex });

        return {
            success: true,
            message: `💊 **Sala de Descanso**\n${alreadyVisited ? '(Revisita) ' : ''}Recuperas **${actualHeal}** HP.\n❤️ HP: ${newHp}/${run.max_hp}`
        };
    }

    // ─── RELIQUIA ───
    async handleRelic(message, userId, run, roomIndex) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const relics = Object.entries(this.dungeon.RELICS);
        const [relicId, relic] = relics[Math.floor(Math.random() * relics.length)];

        const rarityColors = { uncommon: 0x4caf50, rare: 0x2196f3, epic: 0x9c27b0, legendary: 0xff9800 };

        const embed = new EmbedBuilder()
            .setTitle('🏺 Sala de Reliquia')
            .setColor(rarityColors[relic.rarity] || 0x9e9e9e)
            .setDescription(
                `Encuentras una reliquia en la sala...\n\n` +
                `**${relic.name}**\n*${relic.description}*\n\n` +
                `¿La tomas?`
            )
            .setFooter({ text: 'Las reliquias tienen efecto permanente durante la run.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`relic_take_${userId}`)
                .setLabel('Tomar reliquia')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`relic_leave_${userId}`)
                .setLabel('Dejarla')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Secondary),
        );

        const reply = await message.reply({ embeds: [embed], components: [row] });

        return new Promise(resolve => {
            const collector = reply.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 30000, max: 1
            });

            collector.on('collect', async interaction => {
                await interaction.deferUpdate();

                if (interaction.customId === `relic_take_${userId}`) {
                    run.active_relics.push({ id: relicId, ...relic });

                    // Aplicar efecto inmediato de HP boost
                    if (relic.effect === 'hp_boost') {
                        const bonus = Math.ceil(run.max_hp * 0.2);
                        run.max_hp += bonus;
                        run.hp = Math.min(run.max_hp, run.hp + bonus);
                        await this.dungeon.updateRun(userId, { max_hp: run.max_hp, hp: run.hp });
                    }

                    await this.dungeon.updateRun(userId, { active_relics: run.active_relics });
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    await reply.edit({ components: [] });

                    resolve({
                        success: true,
                        message: `✅ **Reliquia obtenida: ${relic.name}**\n*${relic.description}*`
                    });
                } else {
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    await reply.edit({ components: [] });
                    resolve({ success: true, message: `❌ Dejaste la reliquia atrás.` });
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await reply.edit({ components: [] }).catch(() => {});
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    resolve({ success: true, message: '⏰ El tiempo pasó y la reliquia desapareció.' });
                }
            });
        });
    }

    // ─── SALA MALDITA ───
    async handleCursed(message, userId, run, roomIndex) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const debuffs = Object.entries(this.dungeon.DEBUFFS);
        const [debuffId, debuff] = debuffs[Math.floor(Math.random() * debuffs.length)];

        // Recompensa garantizada
        const money = Math.floor(Math.random() * 400 + 200);
        const moneyBoosted = run.active_relics.some(r => r.effect === 'money_boost')
            ? Math.ceil(money * 1.15) : money;

        const embed = new EmbedBuilder()
            .setTitle('💀 Sala Maldita')
            .setColor(0x6d1b7b)
            .setDescription(
                `Una oscura energía impregna la sala...\n\n` +
                `Si entras, recibirás una recompensa pero también una maldición:\n\n` +
                `💰 **Recompensa:** ${moneyBoosted.toLocaleString()} ${this.currency}\n` +
                `⚠️ **Maldición:** ${debuff.name} — *${debuff.description}* (${debuff.duration} turnos)\n\n` +
                `¿Aceptas el trato?`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`cursed_accept_${userId}`)
                .setLabel('Aceptar')
                .setEmoji('💀')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`cursed_refuse_${userId}`)
                .setLabel('Rechazar')
                .setEmoji('🚶')
                .setStyle(ButtonStyle.Secondary),
        );

        const reply = await message.reply({ embeds: [embed], components: [row] });

        return new Promise(resolve => {
            const collector = reply.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 30000, max: 1
            });

            collector.on('collect', async interaction => {
                await interaction.deferUpdate();
                await reply.edit({ components: [] });

                if (interaction.customId === `cursed_accept_${userId}`) {
                    run.floor_money += moneyBoosted;
                    run.total_money += moneyBoosted;
                    run.active_debuffs.push({ id: debuffId, ...debuff, turnsLeft: debuff.duration });

                    await this.dungeon.updateRun(userId, {
                        floor_money: run.floor_money,
                        total_money: run.total_money,
                        active_debuffs: run.active_debuffs,
                    });
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });

                    resolve({
                        success: true,
                        message: `💀 **Trato aceptado.**\n💰 +${moneyBoosted.toLocaleString()} ${this.currency}\n⚠️ Has recibido: **${debuff.name}**`
                    });
                } else {
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    resolve({ success: true, message: '🚶 Rechazaste el trato de la sala maldita.' });
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await reply.edit({ components: [] }).catch(() => {});
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    resolve({ success: true, message: '⏰ La sala maldita se cerró.' });
                }
            });
        });
    }

    // ─── APUESTAS ───
    async handleGamble(message, userId, run, roomIndex) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const options = [
            { id: 'small',  label: 'Apuesta pequeña', emoji: '🪙', hpCost: 5,  reward: 150,  chance: 0.65 },
            { id: 'medium', label: 'Apuesta media',   emoji: '💰', hpCost: 15, reward: 400,  chance: 0.50 },
            { id: 'large',  label: 'Apuesta grande',  emoji: '💎', hpCost: 30, reward: 900,  chance: 0.35 },
        ];

        const embed = new EmbedBuilder()
            .setTitle('🎰 Sala de Apuestas')
            .setColor(0xf39c12)
            .setDescription(
                `Un duende con dados te mira con una sonrisa...\n\n` +
                `"¿Cuánto arriesgas, aventurero?"\n\n` +
                options.map(o =>
                    `${o.emoji} **${o.label}** — Cuesta **${o.hpCost} HP**, ganas **${o.reward} ${this.currency}** (${Math.round(o.chance * 100)}% éxito)`
                ).join('\n')
            )
            .setFooter({ text: 'Si pierdes, solo pierdes el HP apostado.' });

        const row = new ActionRowBuilder().addComponents(
            ...options.map(o => new ButtonBuilder()
                .setCustomId(`gamble_${o.id}_${userId}`)
                .setLabel(o.label)
                .setEmoji(o.emoji)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(run.hp <= o.hpCost)
            ),
            new ButtonBuilder()
                .setCustomId(`gamble_leave_${userId}`)
                .setLabel('Salir')
                .setEmoji('🚶')
                .setStyle(ButtonStyle.Secondary)
        );

        const reply = await message.reply({ embeds: [embed], components: [row] });

        return new Promise(resolve => {
            const collector = reply.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 30000, max: 1
            });

            collector.on('collect', async interaction => {
                await interaction.deferUpdate();
                await reply.edit({ components: [] });

                if (interaction.customId === `gamble_leave_${userId}`) {
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    return resolve({ success: true, message: '🚶 Saliste de la sala de apuestas.' });
                }

                const betId = interaction.customId.replace(`gamble_`, '').replace(`_${userId}`, '');
                const bet = options.find(o => o.id === betId);
                if (!bet) return resolve({ success: false, message: '❌ Opción inválida.' });

                run.hp = Math.max(1, run.hp - bet.hpCost);
                const won = Math.random() < bet.chance;

                if (won) {
                    run.floor_money += bet.reward;
                    run.total_money += bet.reward;
                    await this.dungeon.updateRun(userId, {
                        hp: run.hp, floor_money: run.floor_money, total_money: run.total_money
                    });
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    resolve({
                        success: true,
                        message: `🎰 **¡Ganaste!**\n💰 +${bet.reward.toLocaleString()} ${this.currency}\n❤️ -${bet.hpCost} HP`
                    });
                } else {
                    await this.dungeon.updateRun(userId, { hp: run.hp });
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    resolve({
                        success: true,
                        message: `🎰 **Perdiste la apuesta.**\n❤️ -${bet.hpCost} HP\nMás suerte la próxima vez.`
                    });
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await reply.edit({ components: [] }).catch(() => {});
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    resolve({ success: true, message: '⏰ El duende se fue.' });
                }
            });
        });
    }

    // ─── MAGO ERRANTE ───
    async handleWizard(message, userId, run, roomIndex) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const offers = [
            { id: 'heal',   label: 'Curación completa',    emoji: '❤️',  cost: 200,  action: 'heal'   },
            { id: 'relic',  label: 'Revelar una reliquia', emoji: '🏺',  cost: 150,  action: 'relic'  },
            { id: 'map',    label: 'Revelar el mapa',      emoji: '🗺️',  cost: 100,  action: 'map'    },
            { id: 'debuff', label: 'Eliminar una maldición',emoji: '✨', cost: 175,  action: 'debuff' },
        ].filter(o => {
            if (o.action === 'debuff' && run.active_debuffs.length === 0) return false;
            return true;
        });

        const embed = new EmbedBuilder()
            .setTitle('🧙 Mago Errante')
            .setColor(0x3498db)
            .setDescription(
                `Un mago misterioso aparece de la nada...\n\n` +
                `"Puedo ofrecerte mis servicios, aventurero. ¿Qué necesitas?"\n\n` +
                offers.map(o =>
                    `${o.emoji} **${o.label}** — ${o.cost.toLocaleString()} ${this.currency}`
                ).join('\n')
            )
            .setFooter({ text: `Dinero disponible: ${run.floor_money.toLocaleString()} ${this.currency}` });

        const row = new ActionRowBuilder().addComponents(
            ...offers.map(o => new ButtonBuilder()
                .setCustomId(`wizard_${o.id}_${userId}`)
                .setLabel(o.label)
                .setEmoji(o.emoji)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(run.floor_money < o.cost)
            ),
            new ButtonBuilder()
                .setCustomId(`wizard_leave_${userId}`)
                .setLabel('Rechazar')
                .setEmoji('🚶')
                .setStyle(ButtonStyle.Secondary)
        );

        const reply = await message.reply({ embeds: [embed], components: [row] });

        return new Promise(resolve => {
            const collector = reply.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 30000, max: 1
            });

            collector.on('collect', async interaction => {
                await interaction.deferUpdate();
                await reply.edit({ components: [] });

                if (interaction.customId === `wizard_leave_${userId}`) {
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    return resolve({ success: true, message: '🚶 Rechazaste los servicios del mago.' });
                }

                const offerId = interaction.customId.replace(`wizard_`, '').replace(`_${userId}`, '');
                const offer = offers.find(o => o.id === offerId);
                if (!offer) return resolve({ success: false, message: '❌ Oferta inválida.' });

                run.floor_money -= offer.cost;
                run.total_money -= offer.cost;
                let resultMsg = '';

                if (offer.action === 'heal') {
                    run.hp = run.max_hp;
                    await this.dungeon.updateRun(userId, { hp: run.hp });
                    resultMsg = `❤️ El mago te restaura toda la vida. HP: ${run.hp}/${run.max_hp}`;
                } else if (offer.action === 'relic') {
                    const relics = Object.entries(this.dungeon.RELICS);
                    const [relicId, relic] = relics[Math.floor(Math.random() * relics.length)];
                    run.active_relics.push({ id: relicId, ...relic });
                    await this.dungeon.updateRun(userId, { active_relics: run.active_relics });
                    resultMsg = `🏺 El mago te entrega: **${relic.name}** — *${relic.description}*`;
                } else if (offer.action === 'map') {
                    run.rooms = run.rooms.map(r => ({ ...r, revealed: true }));
                    await this.dungeon.updateRun(userId, { rooms: run.rooms });
                    resultMsg = `🗺️ El mago revela el mapa completo del piso.`;
                } else if (offer.action === 'debuff') {
                    run.active_debuffs.shift();
                    await this.dungeon.updateRun(userId, { active_debuffs: run.active_debuffs });
                    resultMsg = `✨ El mago elimina una de tus maldiciones.`;
                }

                await this.dungeon.updateRun(userId, {
                    floor_money: run.floor_money,
                    total_money: run.total_money,
                });
                await this.completeRoom(userId, run, roomIndex);
                await this.dungeon.updateRun(userId, { current_room: roomIndex });
                resolve({ success: true, message: `🧙 **Trato hecho.**\n${resultMsg}` });
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await reply.edit({ components: [] }).catch(() => {});
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    resolve({ success: true, message: '⏰ El mago desapareció.' });
                }
            });
        });
    }

    // ─── SALA TRAMPA ───
    async handleTrap(message, userId, run, roomIndex) {
        const trapDamage = Math.ceil(run.max_hp * 0.15);
        run.hp = Math.max(1, run.hp - trapDamage);
        await this.dungeon.updateRun(userId, { hp: run.hp });
        await this.completeRoom(userId, run, roomIndex);
        await this.dungeon.updateRun(userId, { current_room: roomIndex });

        // Después de la trampa hay un combate élite
        return await this.handleCombat(message, userId, run, roomIndex, true, false);
    }

    // ─── ALTAR ───
    async handleAltar(message, userId, run, roomIndex) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const sacrificeHp = Math.ceil(run.max_hp * 0.2);

        const embed = new EmbedBuilder()
            .setTitle('🔮 Altar Antiguo')
            .setColor(0x8e24aa)
            .setDescription(
                `Un altar emana una energía misteriosa...\n\n` +
                `*"Ofrece tu sangre y serás recompensado."*\n\n` +
                `Si sacrificas **${sacrificeHp} HP**, recibirás una reliquia aleatoria.\n\n` +
                `❤️ Tu HP actual: ${run.hp}/${run.max_hp}`
            )
            .setFooter({ text: 'No puedes morir por el sacrificio (mínimo 1 HP).' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`altar_sacrifice_${userId}`)
                .setLabel(`Sacrificar ${sacrificeHp} HP`)
                .setEmoji('🩸')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`altar_leave_${userId}`)
                .setLabel('Alejarse')
                .setEmoji('🚶')
                .setStyle(ButtonStyle.Secondary),
        );

        const reply = await message.reply({ embeds: [embed], components: [row] });

        return new Promise(resolve => {
            const collector = reply.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 30000, max: 1
            });

            collector.on('collect', async interaction => {
                await interaction.deferUpdate();
                await reply.edit({ components: [] });

                if (interaction.customId === `altar_sacrifice_${userId}`) {
                    run.hp = Math.max(1, run.hp - sacrificeHp);
                    const relics = Object.entries(this.dungeon.RELICS);
                    const [relicId, relic] = relics[Math.floor(Math.random() * relics.length)];
                    run.active_relics.push({ id: relicId, ...relic });

                    await this.dungeon.updateRun(userId, {
                        hp: run.hp,
                        active_relics: run.active_relics,
                    });
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });

                    resolve({
                        success: true,
                        message: `🩸 **Sacrificio aceptado.**\n❤️ -${sacrificeHp} HP\n✨ Obtuviste: **${relic.name}** — *${relic.description}*`
                    });
                } else {
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    resolve({ success: true, message: '🚶 Te alejaste del altar.' });
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await reply.edit({ components: [] }).catch(() => {});
                    await this.completeRoom(userId, run, roomIndex);
                    await this.dungeon.updateRun(userId, { current_room: roomIndex });
                    resolve({ success: true, message: '⏰ El altar se apagó.' });
                }
            });
        });
    }

    // ─── SALA ABANDONADA ───
    async handleAbandoned(message, userId, run, roomIndex) {
        const healAmount = Math.ceil(run.max_hp * 0.08);
        const newHp = Math.min(run.max_hp, run.hp + healAmount);
        const actualHeal = newHp - run.hp;

        run.hp = newHp;
        await this.dungeon.updateRun(userId, { hp: newHp });
        await this.completeRoom(userId, run, roomIndex);
        await this.dungeon.updateRun(userId, { current_room: roomIndex });

        return {
            success: true,
            message: `🏚️ **Sala Abandonada**\nNo hay nada de valor aquí, pero el descanso te sienta bien.\n❤️ +${actualHeal} HP`
        };
    }
}

module.exports = DungeonRooms;