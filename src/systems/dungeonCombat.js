class DungeonCombat {
    constructor(dungeonSystem) {
        this.dungeon = dungeonSystem;
        this.economy = dungeonSystem.economy;
        this.currency = 'π-b$';

        // ─── TIPOS DE COMBATE ───
        this.COMBAT_TYPES = {
            turns:    { name: '⚔️ Turnos',       description: 'Combate por turnos clásico.' },
            reaction: { name: '⚡ Reacción',      description: 'Presiona el botón correcto antes de que sea tarde.' },
            chaos:    { name: '🌀 Caos',          description: 'Los botones cambian de posición cada turno.' },
            pressure: { name: '💣 Presión',       description: 'Un contador sube. Si llega a 5, el enemigo ataca con todo.' },
            intent:   { name: '🎭 Intención',     description: 'Lee el estado del enemigo y actúa en consecuencia.' },
            timing:   { name: '🎯 Timing',        description: 'Presiona en el momento exacto para el máximo daño.' },
            cards:    { name: '🃏 Lectura',       description: 'Interpreta las señales del enemigo para contrarrestar.' },
            simon:    { name: '🔵 Simon Says',    description: 'Replica el patrón de botones del enemigo.' },
        };

        // ─── ESTADOS DE INTENCIÓN ───
        this.INTENT_STATES = [
            { emoji: '😤', label: 'Cargando golpe fuerte', hint: 'Defiéndete',    best: 'defend',    damage_mult: 1.8 },
            { emoji: '🏃', label: 'Preparando emboscada',  hint: 'Esquiva',       best: 'dodge',     damage_mult: 1.4 },
            { emoji: '🔮', label: 'Invocando magia',       hint: 'Contraataca',   best: 'counter',   damage_mult: 1.6 },
            { emoji: '💤', label: 'Descansando',           hint: 'Ataca fuerte',  best: 'attack',    damage_mult: 0.5 },
            { emoji: '🛡️', label: 'Fortaleciéndose',      hint: 'Usa un item',   best: 'item',      damage_mult: 0.3 },
        ];

        // ─── ACCIONES DE RESPUESTA A INTENCIÓN ───
        this.INTENT_RESPONSES = {
            defend:  { label: '🛡️ Defender',    emoji: '🛡️' },
            dodge:   { label: '💨 Esquivar',    emoji: '💨' },
            counter: { label: '⚡ Contraatacar', emoji: '⚡' },
            attack:  { label: '⚔️ Atacar',      emoji: '⚔️' },
            item:    { label: '🧪 Usar item',   emoji: '🧪' },
        };

        // ─── BOTONES BASE DE COMBATE ───
        this.BASE_ACTIONS = [
            { id: 'attack',  label: 'Atacar',      emoji: '⚔️', style: 'Primary'   },
            { id: 'defend',  label: 'Defender',    emoji: '🛡️', style: 'Secondary' },
            { id: 'dodge',   label: 'Esquivar',    emoji: '💨', style: 'Secondary' },
            { id: 'item',    label: 'Usar item',   emoji: '🧪', style: 'Success'   },
            { id: 'flee',    label: 'Huir',        emoji: '🏃', style: 'Danger'    },
        ];
    }

    // ─── INICIAR COMBATE ───
    async startCombat(message, userId, enemy, combatType, run, isElite = false, isBoss = false) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const playerStats = await this.economy.equipment.getPlayerStats(userId);
        const modifiedStats = this.dungeon.applyRelicsToStats(playerStats, run.active_relics);

        const state = {
            enemy: { ...enemy, currentHp: enemy.hp },
            player: { ...modifiedStats, currentHp: run.hp },
            turn: 1,
            phase: 0,
            pressure: 0,
            simonPattern: [],
            simonStep: 0,
            currentIntent: null,
            log: [],
            ended: false,
        };

        // Determinar tipo de combate
        const type = isBoss ? 'boss' : combatType;

        // Inicializar estado ANTES del primer embed
        this.initializeCombatState(state, type, run);

        // Simon Says: mostrar patrón 3 segundos antes de los botones
        if (type === 'simon') {
            state.showPattern = true;
            const reply = await message.reply({
                embeds: [this.buildCombatEmbed(state, enemy, type, run, { EmbedBuilder }, isElite, isBoss)],
                components: []
            });
            await new Promise(r => setTimeout(r, 3000));
            state.showPattern = false;
            await reply.edit({
                embeds: [this.buildCombatEmbed(state, enemy, type, run, { EmbedBuilder }, isElite, isBoss)],
                components: this.buildCombatButtons(state, userId, type, { ActionRowBuilder, ButtonBuilder, ButtonStyle })
            });
            return await this.runCombatCollector(reply, message, userId, state, enemy, type, run, isElite, isBoss);
        }

        const reply = await message.reply({
            embeds: [this.buildCombatEmbed(state, enemy, type, run, { EmbedBuilder }, isElite, isBoss)],
            components: this.buildCombatButtons(state, userId, type, { ActionRowBuilder, ButtonBuilder, ButtonStyle })
        });

        return await this.runCombatCollector(reply, message, userId, state, enemy, type, run, isElite, isBoss);
    }

    // ─── COLLECTOR DE COMBATE ───
    async runCombatCollector(reply, message, userId, state, enemy, type, run, isElite, isBoss) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        return new Promise((resolve) => {
            const timeout = type === 'reaction' || type === 'timing' ? 8000 : 60000;

            const collector = reply.createMessageComponentCollector({
                filter: i => i.user.id === userId && i.customId.startsWith(`combat_${userId}_`),
                time: timeout
            });

            // Timer para reacción y timing
            let reactionTimer = null;
            if (type === 'reaction' || type === 'timing') {
                reactionTimer = setTimeout(async () => {
                    if (state.ended) return;
                    // Tiempo agotado — enemigo ataca sin defensa
                    const { damage } = this.dungeon.calculateDamage(
                        Math.ceil(state.enemy.atk * 1.5),
                        0
                    );
                    state.player.currentHp = Math.max(0, state.player.currentHp - damage);
                    state.log = [`⏰ ¡Tiempo agotado! El enemigo te golpea por **${damage}** de daño.`];
                    state.turn++;

                    if (state.player.currentHp <= 0) {
                        state.ended = true;
                        collector.stop('dead');
                        await reply.edit({
                            embeds: [this.buildCombatEmbed(state, enemy, type, run, { EmbedBuilder }, isElite, isBoss)],
                            components: []
                        });
                        resolve({ result: 'dead', state });
                        return;
                    }

                    // Continuar combate
                    await reply.edit({
                        embeds: [this.buildCombatEmbed(state, enemy, type, run, { EmbedBuilder }, isElite, isBoss)],
                        components: this.buildCombatButtons(state, userId, type, { ActionRowBuilder, ButtonBuilder, ButtonStyle })
                    });
                    collector.resetTimer({ time: timeout });
                }, timeout - 2000);
            }

            collector.on('collect', async interaction => {
                await interaction.deferUpdate();
                if (state.ended) return;
                if (reactionTimer) clearTimeout(reactionTimer);

                const action = interaction.customId.replace(`combat_${userId}_`, '');
                const result = await this.processAction(action, state, enemy, type, run, userId);

                if (result.ended) {
                    state.ended = true;
                    collector.stop(result.victory ? 'victory' : 'dead');

                    await reply.edit({
                        embeds: [this.buildCombatEmbed(state, enemy, type, run, { EmbedBuilder }, isElite, isBoss)],
                        components: []
                    });

                    resolve({ result: result.victory ? 'victory' : result.fled ? 'fled' : 'dead', state });
                    return;
                }

                // Simon Says: cuando se completa el patrón, mostrar nuevo patrón brevemente
                if (type === 'simon' && state.simonStep === 0 && !result.ended) {
                    state.showPattern = true;
                    await reply.edit({
                        embeds: [this.buildCombatEmbed(state, enemy, type, run, { EmbedBuilder }, isElite, isBoss)],
                        components: []
                    });
                    await new Promise(r => setTimeout(r, 3000));
                    state.showPattern = false;
                }

                // Reiniciar timer si es reacción
                if (type === 'reaction' || type === 'timing') {
                    reactionTimer = setTimeout(async () => {
                        if (state.ended) return;
                        const { damage } = this.dungeon.calculateDamage(Math.ceil(state.enemy.atk * 1.5), 0);
                        state.player.currentHp = Math.max(0, state.player.currentHp - damage);
                        state.log = [`⏰ ¡Tiempo agotado! El enemigo te golpea por **${damage}** de daño.`];
                        state.turn++;

                        if (state.player.currentHp <= 0) {
                            state.ended = true;
                            collector.stop('dead');
                            await reply.edit({
                                embeds: [this.buildCombatEmbed(state, enemy, type, run, { EmbedBuilder }, isElite, isBoss)],
                                components: []
                            });
                            resolve({ result: 'dead', state });
                            return;
                        }

                        await reply.edit({
                            embeds: [this.buildCombatEmbed(state, enemy, type, run, { EmbedBuilder }, isElite, isBoss)],
                            components: this.buildCombatButtons(state, userId, type, { ActionRowBuilder, ButtonBuilder, ButtonStyle })
                        });
                        collector.resetTimer({ time: timeout });
                    }, timeout - 2000);
                }

                await reply.edit({
                    embeds: [this.buildCombatEmbed(state, enemy, type, run, { EmbedBuilder }, isElite, isBoss)],
                    components: this.buildCombatButtons(state, userId, type, { ActionRowBuilder, ButtonBuilder, ButtonStyle })
                });
            });

            collector.on('end', async (_, reason) => {
                if (state.ended) return;
                if (reason === 'time') {
                    // 1 minuto sin interactuar — penalización y salida
                    const penaltyHp = Math.ceil(run.max_hp * 0.15);
                    const newHp = Math.max(1, run.hp - penaltyHp);

                    await this.dungeon.updateRun(userId, { hp: newHp });
                    await reply.edit({ components: [] }).catch(() => {});
                    resolve({ result: 'inactive', state, penaltyHp });
                }
            });
        });
    }

    // ─── PROCESAR ACCIÓN ───
    async processAction(action, state, enemy, type, run, userId) {
        const log = [];
        let ended = false;
        let victory = false;
        let fled = false;

        // ── Huir ──
        if (action === 'flee') {
            const chance = 0.4 + (run.active_relics.some(r => r.effect === 'ghost_boots') ? 0.3 : 0);
            if (Math.random() < chance) {
                log.push('🏃 ¡Huiste exitosamente!');
                state.log = log;
                return { ended: true, victory: false, fled: true };
            } else {
                log.push('❌ ¡No pudiste huir! El enemigo te ataca.');
                const { damage } = this.dungeon.calculateDamage(state.enemy.atk, state.player.def);
                state.player.currentHp = Math.max(0, state.player.currentHp - damage);
                log.push(`💔 Recibes **${damage}** de daño.`);
                state.log = log;
                if (state.player.currentHp <= 0) return { ended: true, victory: false, fled: false };
                state.turn++;
                return { ended: false };
            }
        }

        // ── Simon Says ──
        if (type === 'simon') {
            if (action.startsWith('simon_')) {
                const btn = action.replace('simon_', '');
                const expected = state.simonPattern[state.simonStep];

                if (btn === expected) {
                    state.simonStep++;
                    log.push(`✅ ¡Correcto! (${state.simonStep}/${state.simonPattern.length})`);

                    if (state.simonStep >= state.simonPattern.length) {
                        // Patrón completado — daño al enemigo
                        const { damage, isCrit } = this.dungeon.calculateDamage(state.player.atk * 1.5, state.enemy.def, state.player.crit);
                        state.enemy.currentHp = Math.max(0, state.enemy.currentHp - damage);
                        log.push(`${isCrit ? '⭐ ¡Crítico! ' : ''}¡Patrón completado! Golpeas por **${damage}** de daño.`);

                        // Nuevo patrón
                        state.simonPattern = this.generateSimonPattern(state.turn + 1);
                        state.simonStep = 0;
                        state.turn++;
                    }
                } else {
                    // Error — enemigo ataca
                    log.push('❌ ¡Patrón incorrecto!');
                    const { damage } = this.dungeon.calculateDamage(state.enemy.atk, state.player.def);
                    state.player.currentHp = Math.max(0, state.player.currentHp - damage);
                    log.push(`💔 El enemigo aprovecha y te golpea por **${damage}** de daño.`);
                    state.simonPattern = this.generateSimonPattern(state.turn + 1);
                    state.simonStep = 0;
                    state.turn++;
                }
            }
        }

        // ── Intención ──
        else if (type === 'intent') {
            const intent = state.currentIntent;
            const isCorrect = action === intent?.best;

            if (isCorrect) {
                const { damage, isCrit } = this.dungeon.calculateDamage(state.player.atk * 1.3, state.enemy.def, state.player.crit);
                state.enemy.currentHp = Math.max(0, state.enemy.currentHp - damage);
                log.push(`${isCrit ? '⭐ ¡Crítico! ' : ''}¡Leíste bien la intención! Golpeas por **${damage}** de daño.`);
                const reducedDamage = Math.ceil(state.enemy.atk * intent.damage_mult * 0.3);
                if (reducedDamage > 0) {
                    state.player.currentHp = Math.max(0, state.player.currentHp - reducedDamage);
                    log.push(`💔 Recibes **${reducedDamage}** de daño reducido.`);
                }
            } else {
                const { damage: playerDmg } = this.dungeon.calculateDamage(state.player.atk, state.enemy.def, state.player.crit);
                state.enemy.currentHp = Math.max(0, state.enemy.currentHp - playerDmg);
                log.push(`⚔️ Atacas por **${playerDmg}** de daño.`);
                const fullDamage = Math.ceil(state.enemy.atk * intent.damage_mult);
                state.player.currentHp = Math.max(0, state.player.currentHp - fullDamage);
                log.push(`💔 ¡Leíste mal la intención! Recibes **${fullDamage}** de daño completo.`);
            }

            // Nueva intención
            state.currentIntent = this.getRandomIntent(run);
            state.turn++;
        }

        // ── Presión ──
        else if (type === 'pressure') {
            if (action === 'attack') {
                const { damage, isCrit } = this.dungeon.calculateDamage(state.player.atk, state.enemy.def, state.player.crit);
                state.enemy.currentHp = Math.max(0, state.enemy.currentHp - damage);
                log.push(`${isCrit ? '⭐ ¡Crítico! ' : ''}⚔️ Atacas por **${damage}** de daño.`);
                state.pressure = Math.max(0, state.pressure - 1);
                log.push(`💨 La presión baja a **${state.pressure}/5**.`);
            } else if (action === 'defend') {
                log.push('🛡️ Te defiendes y reduces el daño entrante.');
                state.pressure++;
                if (state.pressure >= 5) {
                    const devastate = Math.ceil(state.enemy.atk * 2.5);
                    state.player.currentHp = Math.max(0, state.player.currentHp - devastate);
                    log.push(`💥 ¡ATAQUE DEVASTADOR! El enemigo te golpea por **${devastate}** de daño.`);
                    state.pressure = 0;
                } else {
                    log.push(`⚠️ La presión sube a **${state.pressure}/5**.`);
                    const reduced = Math.ceil(state.enemy.atk * 0.4);
                    state.player.currentHp = Math.max(0, state.player.currentHp - reduced);
                    log.push(`💔 Recibes **${reduced}** de daño reducido.`);
                }
            } else if (action === 'item') {
                log.push('🧪 Usas una poción y recuperas HP.');
                const heal = Math.ceil(state.player.currentHp * 0.25);
                state.player.currentHp = Math.min(state.player.hp, state.player.currentHp + heal);
                log.push(`❤️ Recuperas **${heal}** HP.`);
                state.pressure++;
                log.push(`⚠️ La presión sube a **${state.pressure}/5**.`);
            }
            state.turn++;
        }

        // ── Caos ──
        else if (type === 'chaos') {
            if (action === 'attack' || action === 'strong' || action === 'quick') {
                const mult = action === 'strong' ? 1.5 : action === 'quick' ? 0.8 : 1;
                const { damage, isCrit } = this.dungeon.calculateDamage(Math.ceil(state.player.atk * mult), state.enemy.def, state.player.crit);
                state.enemy.currentHp = Math.max(0, state.enemy.currentHp - damage);
                log.push(`${isCrit ? '⭐ ¡Crítico! ' : ''}⚔️ Golpeas por **${damage}** de daño.`);
                const enemyDmg = Math.ceil(state.enemy.atk * 0.7);
                state.player.currentHp = Math.max(0, state.player.currentHp - enemyDmg);
                log.push(`💔 El enemigo contraataca por **${enemyDmg}**.`);
            } else if (action === 'defend') {
                log.push('🛡️ Te defiendes... ¡pero el caos hace que el enemigo ataque de todas formas!');
                const chaos = Math.ceil(state.enemy.atk * (0.3 + Math.random() * 0.5));
                state.player.currentHp = Math.max(0, state.player.currentHp - chaos);
                log.push(`💔 Recibes **${chaos}** de daño caótico.`);
            }
            state.turn++;
        }

        // ── Reacción / Timing / Turnos (lógica base) ──
        else {
            if (action === 'attack') {
                const { damage, isCrit } = this.dungeon.calculateDamage(state.player.atk, state.enemy.def, state.player.crit);
                state.enemy.currentHp = Math.max(0, state.enemy.currentHp - damage);
                log.push(`${isCrit ? '⭐ ¡Crítico! ' : ''}⚔️ Atacas por **${damage}** de daño.`);

                // Lifesteal
                if (run.active_relics.some(r => r.effect === 'lifesteal')) {
                    const heal = Math.ceil(damage * 0.05);
                    state.player.currentHp = Math.min(state.player.hp, state.player.currentHp + heal);
                    log.push(`🩸 Absorbes **${heal}** HP.`);
                }

                // Enemigo contraataca
                if (state.enemy.currentHp > 0) {
                    const { damage: enemyDmg } = this.dungeon.calculateDamage(state.enemy.atk, state.player.def);
                    state.player.currentHp = Math.max(0, state.player.currentHp - enemyDmg);
                    log.push(`💔 El enemigo contraataca por **${enemyDmg}** de daño.`);
                }
            } else if (action === 'defend') {
                const { damage } = this.dungeon.calculateDamage(state.enemy.atk, Math.ceil(state.player.def * 1.5));
                state.player.currentHp = Math.max(0, state.player.currentHp - damage);
                log.push(`🛡️ Te defiendes. Recibes solo **${damage}** de daño.`);
            } else if (action === 'dodge') {
                const dodges = Math.random() < (state.player.evasion + 0.1);
                if (dodges) {
                    log.push('💨 ¡Esquivaste el ataque!');
                    const counter = Math.ceil(state.player.atk * 0.5);
                    const { damage } = this.dungeon.calculateDamage(counter, state.enemy.def);
                    state.enemy.currentHp = Math.max(0, state.enemy.currentHp - damage);
                    log.push(`⚡ Contraatacas por **${damage}** de daño.`);
                } else {
                    log.push('❌ ¡No lograste esquivar!');
                    const { damage } = this.dungeon.calculateDamage(state.enemy.atk, 0);
                    state.player.currentHp = Math.max(0, state.player.currentHp - damage);
                    log.push(`💔 Recibes **${damage}** de daño completo.`);
                }
            } else if (action === 'item') {
                const heal = Math.ceil(state.player.hp * 0.3);
                state.player.currentHp = Math.min(state.player.hp, state.player.currentHp + heal);
                log.push(`🧪 Usas una poción. Recuperas **${heal}** HP.`);
                const { damage } = this.dungeon.calculateDamage(state.enemy.atk, state.player.def);
                state.player.currentHp = Math.max(0, state.player.currentHp - damage);
                log.push(`💔 El enemigo aprovecha y te golpea por **${damage}**.`);
            }
            state.turn++;
        }

        // ── Verificar reliquias de efecto pasivo ──
        if (run.active_relics.some(r => r.effect === 'cursed_atk') && state.enemy.currentHp > 0) {
            state.player.currentHp = Math.max(0, state.player.currentHp - 5);
            log.push('⚰️ La Hoja Maldita te drena **5** HP.');
        }

        // ── Escudo ancestral ──
        const shieldRelic = run.active_relics.find(r => r.effect === 'one_block' && !r.used);
        if (shieldRelic && state.player.currentHp <= 0) {
            state.player.currentHp = 1;
            shieldRelic.used = true;
            log.push('🛡️ ¡El Escudo Ancestral absorbió el golpe mortal!');
        }

        state.log = log;

        // ── Verificar fin de combate ──
        if (state.player.currentHp <= 0) return { ended: true, victory: false, fled: false };
        if (state.enemy.currentHp <= 0) return { ended: true, victory: true, fled: false };

        return { ended: false };
    }

    // ─── GENERAR PATRÓN SIMON ───
    generateSimonPattern(turn) {
        const symbols = ['red', 'yellow', 'blue', 'green'];
        const length = Math.min(3 + Math.floor(turn / 3), 6);
        return Array.from({ length }, () => symbols[Math.floor(Math.random() * symbols.length)]);
    }

    // ─── OBTENER INTENCIÓN ALEATORIA ───
    getRandomIntent(run) {
        const hasBlind = run.active_debuffs.some(d => d.id === 'blind');
        if (hasBlind) return { ...this.INTENT_STATES[Math.floor(Math.random() * this.INTENT_STATES.length)], hidden: true };
        return this.INTENT_STATES[Math.floor(Math.random() * this.INTENT_STATES.length)];
    }

    // ─── BUILD EMBED DE COMBATE ───
    buildCombatEmbed(state, enemy, type, run, { EmbedBuilder }, isElite, isBoss) {
        const hpBar = (current, max) => {
            const pct = Math.max(0, current) / max;
            const filled = Math.round(pct * 8);
            const bar = '█'.repeat(filled) + '░'.repeat(8 - filled);
            const color = pct > 0.5 ? '🟩' : pct > 0.25 ? '🟨' : '🟥';
            return `${color} \`${bar}\` ${Math.max(0, current)}/${max}`;
        };

        const typeLabel = isBoss ? '👺 JEFE' : isElite ? '💀 ÉLITE' : this.COMBAT_TYPES[type]?.name || type;
        const color = isBoss ? 0xe74c3c : isElite ? 0xe67e22 : 0x3498db;

        let desc = `**${typeLabel}**\n━━━━━━━━━━━━━━━━━━━━\n`;

        // Info específica por tipo
        if (type === 'pressure') {
            const bar = '🔴'.repeat(state.pressure) + '⚫'.repeat(5 - state.pressure);
            desc += `💣 **Presión:** ${bar} (${state.pressure}/5)\n`;
            if (state.pressure >= 4) desc += `⚠️ ¡El enemigo está a punto de desatar todo su poder!\n`;
        }

        if (type === 'simon') {
            const emojiMap = { red: '🔴', yellow: '🟡', blue: '🔵', green: '🟢' };
            const progress = state.simonPattern.slice(0, state.simonStep).map(s => emojiMap[s]).join(' ') || '—';
            if (state.showPattern) {
                const pattern = state.simonPattern.map(s => emojiMap[s]).join(' ');
                desc += `🔵 **Patrón:** ${pattern}\n`;
                desc += `⏱️ *¡Memorízalo! Los botones aparecerán en 3 segundos...*\n`;
            } else {
                desc += `🔵 **Patrón:** ???\n`;
                desc += `✅ **Tu progreso:** ${progress}\n`;
            }
        }

        if (type === 'intent' && state.currentIntent) {
            if (state.currentIntent.hidden) {
                desc += `👁️ **Intención:** ??? (Estás cegado)\n`;
            } else {
                desc += `${state.currentIntent.emoji} **Intención:** ${state.currentIntent.label}\n`;
                const hasEye = run.active_relics.some(r => r.effect === 'reveal_intent');
                if (hasEye) desc += `👁️ *Sugerencia: ${state.currentIntent.hint}*\n`;
            }
        }

        if (type === 'reaction' || type === 'timing') {
            desc += `⏱️ *¡Actúa rápido! Tienes pocos segundos.*\n`;
        }

        if (type === 'chaos') {
            desc += `🌀 *Los botones cambian cada turno. ¡Cuidado!*\n`;
        }

        // Log del último turno
        if (state.log.length) {
            desc += `\n${state.log.join('\n')}\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${enemy.name}`)
            .setColor(color)
            .setDescription(desc)
            .addFields(
                {
                    name: `${enemy.name}`,
                    value: hpBar(state.enemy.currentHp, state.enemy.maxHp || enemy.hp),
                    inline: false
                },
                {
                    name: '❤️ Tu HP',
                    value: hpBar(state.player.currentHp, state.player.hp),
                    inline: false
                },
                {
                    name: '📊 Turno',
                    value: `**${state.turn}**`,
                    inline: true
                },
                {
                    name: '⚔️ Tu ATK',
                    value: `**${state.player.atk}**`,
                    inline: true
                },
                {
                    name: '🛡️ Tu DEF',
                    value: `**${state.player.def}**`,
                    inline: true
                }
            )
            .setFooter({ text: 'Elige tu acción' });

        return embed;
    }

    // ─── BUILD BOTONES DE COMBATE ───
    buildCombatButtons(state, userId, type, { ActionRowBuilder, ButtonBuilder, ButtonStyle }) {
        const rows = [];
        const prefix = `combat_${userId}_`;

        if (type === 'simon') {
            const symbols = [
                { emoji: '🔴', id: 'red'    },
                { emoji: '🟡', id: 'yellow' },
                { emoji: '🔵', id: 'blue'   },
                { emoji: '🟢', id: 'green'  },
            ];
            const row = new ActionRowBuilder().addComponents(
                ...symbols.map(s => new ButtonBuilder()
                    .setCustomId(`${prefix}simon_${s.id}`)
                    .setLabel(s.emoji)
                    .setStyle(ButtonStyle.Primary)
                )
            );
            rows.push(row);
        }

        else if (type === 'intent') {
            const actions = Object.entries(this.INTENT_RESPONSES);
            const row = new ActionRowBuilder().addComponents(
                ...actions.map(([id, data]) => new ButtonBuilder()
                    .setCustomId(`${prefix}${id}`)
                    .setLabel(data.label)
                    .setEmoji(data.emoji)
                    .setStyle(ButtonStyle.Primary)
                )
            );
            rows.push(row);
        }

        else if (type === 'chaos') {
            // Botones en orden aleatorio cada turno
            const actions = [
                { id: 'attack', label: 'Atacar',         emoji: '⚔️', style: ButtonStyle.Primary   },
                { id: 'strong', label: 'Golpe Fuerte',   emoji: '💥', style: ButtonStyle.Danger    },
                { id: 'quick',  label: 'Ataque Rápido',  emoji: '⚡', style: ButtonStyle.Success   },
                { id: 'defend', label: 'Defender',       emoji: '🛡️', style: ButtonStyle.Secondary },
                { id: 'flee',   label: 'Huir',           emoji: '🏃', style: ButtonStyle.Secondary },
            ].sort(() => Math.random() - 0.5);

            const row = new ActionRowBuilder().addComponents(
                ...actions.map(a => new ButtonBuilder()
                    .setCustomId(`${prefix}${a.id}`)
                    .setLabel(a.label)
                    .setEmoji(a.emoji)
                    .setStyle(a.style)
                )
            );
            rows.push(row);
        }

        else if (type === 'pressure') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`${prefix}attack`).setLabel('Atacar').setEmoji('⚔️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`${prefix}defend`).setLabel('Defender').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`${prefix}item`).setLabel('Poción').setEmoji('🧪').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`${prefix}flee`).setLabel('Huir').setEmoji('🏃').setStyle(ButtonStyle.Danger),
            );
            rows.push(row);
        }

        else {
            // Turnos, reacción, timing — botones base
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`${prefix}attack`).setLabel('Atacar').setEmoji('⚔️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`${prefix}defend`).setLabel('Defender').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`${prefix}dodge`).setLabel('Esquivar').setEmoji('💨').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`${prefix}item`).setLabel('Poción').setEmoji('🧪').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`${prefix}flee`).setLabel('Huir').setEmoji('🏃').setStyle(ButtonStyle.Danger),
            );
            rows.push(row);
        }

        return rows;
    }

    // ─── INICIALIZAR ESTADO DE COMBATE SEGÚN TIPO ───
    initializeCombatState(state, type, run) {
        if (type === 'simon') {
            state.simonPattern = this.generateSimonPattern(1);
            state.simonStep = 0;
        }
        if (type === 'intent') {
            state.currentIntent = this.getRandomIntent(run);
        }
        if (type === 'pressure') {
            state.pressure = 0;
        }
    }
}

module.exports = DungeonCombat;