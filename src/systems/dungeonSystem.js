const DungeonCombat = require('./dungeonCombat');
const DungeonRooms = require('./dungeonRooms');

class DungeonSystem {
    constructor(economy) {
        this.economy = economy;
        this.db = economy.database;
        this.currency = 'π-b$';

        // ─── TIPOS DE HABITACIONES ───
        this.ROOM_TYPES = {
            combat:    { emoji: '⚔️', label: 'Combate',         weight: 30 },
            elite:     { emoji: '👹', label: 'Élite',           weight: 12 },
            chest:     { emoji: '📦', label: 'Cofre Común',     weight: 10 },
            rare_chest:{ emoji: '💎', label: 'Cofre Raro',      weight: 5  },
            rest:      { emoji: '💊', label: 'Descanso',        weight: 8  },
            relic:     { emoji: '🏺', label: 'Reliquia',        weight: 7  },
            cursed:    { emoji: '💀', label: 'Sala Maldita',    weight: 6  },
            gamble:    { emoji: '🎰', label: 'Apuestas',        weight: 5  },
            wizard:    { emoji: '🧙', label: 'Mago Errante',    weight: 5  },
            trap:      { emoji: '🪤', label: 'Sala Trampa',     weight: 5  },
            altar:     { emoji: '🔮', label: 'Altar',           weight: 4  },
            abandoned: { emoji: '🏚️', label: 'Sala Abandonada', weight: 3  },
            boss:      { emoji: '👺', label: 'Jefe',            weight: 0  }, // siempre al final
        };

        // ─── ENEMIGOS NORMALES ───
        this.ENEMIES = {
            // Piso 1-3
            goblin:      { name: '👺 Goblin',        hp: 40,  atk: 8,  def: 3,  xp: 20, money: [30, 80],   combat: 'turns',    floor: 1 },
            slime:       { name: '🟢 Slime',         hp: 30,  atk: 5,  def: 6,  xp: 15, money: [20, 60],   combat: 'reaction', floor: 1 },
            skeleton:    { name: '💀 Esqueleto',     hp: 50,  atk: 12, def: 2,  xp: 25, money: [40, 100],  combat: 'timing',   floor: 1 },
            // Piso 3-6
            orc:         { name: '🟤 Orco',          hp: 80,  atk: 18, def: 8,  xp: 40, money: [80, 180],  combat: 'pressure', floor: 3 },
            dark_mage:   { name: '🧙 Mago Oscuro',   hp: 60,  atk: 22, def: 4,  xp: 45, money: [100, 200], combat: 'intent',   floor: 3 },
            werewolf:    { name: '🐺 Hombre Lobo',   hp: 90,  atk: 20, def: 10, xp: 50, money: [120, 220], combat: 'chaos',    floor: 3 },
            // Piso 6+
            demon:       { name: '😈 Demonio',       hp: 120, atk: 28, def: 15, xp: 70, money: [200, 400], combat: 'intent',   floor: 6 },
            vampire:     { name: '🧛 Vampiro',       hp: 100, atk: 25, def: 12, xp: 65, money: [180, 350], combat: 'chaos',    floor: 6 },
            shadow:      { name: '🌑 Sombra',        hp: 80,  atk: 30, def: 8,  xp: 75, money: [220, 450], combat: 'reaction', floor: 6 },
        };

        // ─── ÉLITES ───
        this.ELITES = {
            goblin_king: { name: '👑 Rey Goblin',    hp: 100, atk: 20, def: 10, xp: 80,  money: [200, 400],  combat: 'simon',  floor: 1, drop: 'goblin_helmet' },
            bone_giant:  { name: '🦴 Gigante Óseo',  hp: 140, atk: 28, def: 8,  xp: 100, money: [300, 600],  combat: 'simon',  floor: 3, drop: 'shadow_boots'  },
            orc_warlord: { name: '⚔️ Señor Orco',   hp: 180, atk: 35, def: 18, xp: 130, money: [500, 900],  combat: 'simon',  floor: 6, drop: 'dragon_chest'  },
        };

        // ─── JEFES ───
        this.BOSSES = {
            // Jefes de piso 1-5
            dragon_hatchling: {
                name: '🐲 Dragón Joven',
                floor: 1,
                hp: 200, atk: 25, def: 12,
                xp: 200, money: [500, 1000],
                drop: { item: 'goblin_blade', chance: 0.4 },
                phases: [
                    { hpThreshold: 1.0, combat: 'turns',    message: 'El dragón te observa con curiosidad...' },
                    { hpThreshold: 0.6, combat: 'intent',   message: '¡El dragón muestra sus garras!' },
                    { hpThreshold: 0.3, combat: 'pressure', message: '¡El dragón está furioso! ¡Ataca sin cesar!' },
                ],
                bestiary: { description: 'Un dragón joven que guarda el primer nivel de la mazmorra.', weakness: '💧 Agua' }
            },
            shadow_lord: {
                name: '🌑 Señor de las Sombras',
                floor: 4,
                hp: 350, atk: 40, def: 20,
                xp: 400, money: [1000, 2000],
                drop: { item: 'shadow_dagger', chance: 0.35 },
                phases: [
                    { hpThreshold: 1.0, combat: 'intent',   message: 'El Señor de las Sombras te estudia...' },
                    { hpThreshold: 0.5, combat: 'chaos',    message: '¡Las sombras se vuelven locas!' },
                    { hpThreshold: 0.25, combat: 'reaction', message: '¡El Señor de las Sombras se desvanece y reaparece!' },
                ],
                bestiary: { description: 'Un ser de oscuridad pura que habita en las profundidades.', weakness: '☀️ Luz' }
            },
            demon_king: {
                name: '😈 Rey Demonio',
                floor: 8,
                hp: 600, atk: 60, def: 35,
                xp: 800, money: [2500, 5000],
                drop: { item: 'demon_blade', chance: 0.25 },
                phases: [
                    { hpThreshold: 1.0, combat: 'turns',    message: 'El Rey Demonio ríe ante tu presencia...' },
                    { hpThreshold: 0.7, combat: 'intent',   message: '¡El Rey Demonio invoca su poder!' },
                    { hpThreshold: 0.4, combat: 'chaos',    message: '¡El infierno se desata!' },
                    { hpThreshold: 0.15, combat: 'pressure', message: '¡El Rey Demonio usa todo su poder!' },
                ],
                bestiary: { description: 'El gobernante del infierno. Pocos han llegado a verlo.', weakness: '✨ Sagrado' }
            },
        };

        // ─── RELIQUIAS ───
        this.RELICS = {
            dragon_eye:     { name: '👁️ Ojo de Dragón',    description: 'Revela la intención del enemigo siempre.',   effect: 'reveal_intent',    rarity: 'epic'     },
            iron_will:      { name: '💪 Voluntad de Hierro', description: '+20% de HP máximo en esta run.',            effect: 'hp_boost',         rarity: 'rare'     },
            lucky_coin:     { name: '🪙 Moneda de la Suerte', description: '+15% de dinero en cada habitación.',       effect: 'money_boost',      rarity: 'uncommon' },
            blood_pact:     { name: '🩸 Pacto de Sangre',  description: 'Cada ataque recupera 5% del daño.',           effect: 'lifesteal',        rarity: 'rare'     },
            ghost_boots:    { name: '👻 Botas Fantasma',   description: 'Puedes saltar una habitación por piso.',      effect: 'skip_room',        rarity: 'uncommon' },
            berserker_soul: { name: '😤 Alma Berserker',   description: '+30% ATK pero -15% DEF.',                    effect: 'berserker',        rarity: 'rare'     },
            map_reader:     { name: '🗺️ Lector de Mapas',  description: 'El mapa del piso se revela completo.',       effect: 'reveal_map',       rarity: 'uncommon' },
            cursed_blade:   { name: '⚰️ Hoja Maldita',     description: '+50% ATK pero pierdes 5 HP por turno.',      effect: 'cursed_atk',       rarity: 'epic'     },
            ancient_shield: { name: '🛡️ Escudo Ancestral', description: 'Una vez por piso, absorbe un ataque.',       effect: 'one_block',        rarity: 'epic'     },
            soul_lantern:   { name: '🏮 Linterna del Alma', description: 'Revela el tipo de todas las habitaciones.',  effect: 'reveal_all_rooms', rarity: 'legendary' },
        };

        // ─── DEBUFFS ───
        this.DEBUFFS = {
            poisoned:   { name: '☠️ Veneno',      description: 'Pierdes 5 HP por turno.',            duration: 3 },
            weakened:   { name: '💔 Debilitado',  description: '-20% ATK.',                          duration: 2 },
            slowed:     { name: '🐢 Lentitud',    description: 'Tienes menos tiempo para reaccionar.', duration: 2 },
            cursed:     { name: '👁️ Maldición',   description: '-15% a todos los stats.',            duration: 3 },
            blind:      { name: '🙈 Ceguera',     description: 'La intención del enemigo está oculta.', duration: 2 },
        };

        this.combat = new DungeonCombat(this);
        this.rooms = new DungeonRooms(this);
    }

    // ─── GENERAR PISO ───
    generateFloor(floorNumber) {
        const roomCount = Math.min(8 + Math.floor(floorNumber / 3), 14);
        const rooms = [];

        // Calcular pesos excluyendo boss
        const types = Object.entries(this.ROOM_TYPES).filter(([key]) => key !== 'boss');
        const totalWeight = types.reduce((sum, [, v]) => sum + v.weight, 0);

        // Generar habitaciones (sin la última que siempre es boss)
        for (let i = 0; i < roomCount - 1; i++) {
            let rand = Math.random() * totalWeight;
            let chosenType = 'combat';

            for (const [type, data] of types) {
                rand -= data.weight;
                if (rand <= 0) { chosenType = type; break; }
            }

            rooms.push({
                index: i,
                type: chosenType,
                emoji: this.ROOM_TYPES[chosenType].emoji,
                visited: false,
                cleared: false,
                revealed: false,
            });
        }

        // Mezclar habitaciones (excepto la primera y última)
        const middle = rooms.slice(0, rooms.length);
        for (let i = middle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [middle[i], middle[j]] = [middle[j], middle[i]];
        }
        // Reasignar índices
        middle.forEach((r, i) => r.index = i);
        rooms.length = 0;
        rooms.push(...middle);

        // Última habitación siempre es jefe
        rooms.push({
            index: roomCount - 1,
            type: 'boss',
            emoji: '👺',
            visited: false,
            cleared: false,
            revealed: false,
        });

        // Generar conexiones (grilla simple)
        const connections = this.generateConnections(rooms, roomCount);

        // Guardar conexiones en cada habitación
        rooms.forEach(r => {
            r.connections = connections[r.index] || [];
        });
        return { rooms, connections, startRoom: 0 };
    }

    // ─── GENERAR CONEXIONES ───
    generateConnections(rooms, count) {
        const connections = {};
        for (let i = 0; i < count; i++) connections[i] = [];

        // Camino principal garantizado (no siempre lineal)
        const path = Array.from({ length: count }, (_, i) => i);
        for (let i = path.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [path[i], path[j]] = [path[j], path[i]];
        }

        // Conectar en cadena el camino mezclado
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i], b = path[i + 1];
            if (!connections[a].includes(b)) connections[a].push(b);
            if (!connections[b].includes(a)) connections[b].push(a);
        }

        // Conexiones extras aleatorias
        for (let i = 0; i < count; i++) {
            if (Math.random() < 0.3) {
                const targets = Array.from({ length: count }, (_, j) => j)
                    .filter(j => j !== i && !connections[i].includes(j));
                if (targets.length) {
                    const t = targets[Math.floor(Math.random() * targets.length)];
                    connections[i].push(t);
                    connections[t].push(i);
                }
            }
        }

        return connections;
    }

    async getEnemyForFloor(floor, userId) {
        const eligible = Object.entries(this.ENEMIES).filter(([, e]) => e.floor <= floor);
        const [id, base] = eligible[Math.floor(Math.random() * eligible.length)];

        const playerStats = await this.combat.economy.equipment.getPlayerStats(userId);
        const playerPower = playerStats.atk + playerStats.def + Math.floor(playerStats.hp / 10);
        const scale = Math.max(1, playerPower / 30) * (1 + (floor - 1) * 0.1);

        return {
            id, ...base,
            hp:    Math.ceil(base.hp  * scale),
            atk:   Math.ceil(base.atk * scale),
            def:   Math.ceil(base.def * scale),
            maxHp: Math.ceil(base.hp  * scale),
        };
    }

    async getEliteForFloor(floor, userId) {
        const eligible = Object.entries(this.ELITES).filter(([, e]) => e.floor <= floor);
        const [id, base] = eligible[Math.floor(Math.random() * eligible.length)];

        const playerStats = await this.combat.economy.equipment.getPlayerStats(userId);
        const playerPower = playerStats.atk + playerStats.def + Math.floor(playerStats.hp / 10);
        const scale = Math.max(1, playerPower / 25) * (1 + (floor - 1) * 0.15);

        return {
            id, ...base,
            hp:    Math.ceil(base.hp  * scale),
            atk:   Math.ceil(base.atk * scale),
            def:   Math.ceil(base.def * scale),
            maxHp: Math.ceil(base.hp  * scale),
        };
    }

    async getBossForFloor(floor, userId) {
        const eligible = Object.entries(this.BOSSES).filter(([, b]) => b.floor <= floor);
        const [id, base] = eligible.reduce((prev, curr) => curr[1].floor > prev[1].floor ? curr : prev);

        const playerStats = await this.combat.economy.equipment.getPlayerStats(userId);
        const playerPower = playerStats.atk + playerStats.def + Math.floor(playerStats.hp / 10);
        const scale = Math.max(1, playerPower / 20) * (1 + (floor - base.floor) * 0.2);

        return {
            id, ...base,
            hp:    Math.ceil(base.hp  * scale),
            atk:   Math.ceil(base.atk * scale),
            def:   Math.ceil(base.def * scale),
            maxHp: Math.ceil(base.hp  * scale),
        };
    }

    // ─── INICIAR RUN ───
    async startRun(userId) {
        // Verificar si ya tiene una run activa
        const existing = await this.getRun(userId);
        if (existing) return { success: false, message: '⚠️ Ya tienes una run activa. Usa `>dungeon continuar` para reanudarla.' };

        const user = await this.economy.getUser(userId);
        const playerStats = await this.economy.equipment.getPlayerStats(userId);

        const { rooms, connections, startRoom } = this.generateFloor(1);

        // Revelar habitaciones adyacentes al inicio
        rooms[startRoom].visited = true;
        rooms[startRoom].revealed = true;
        for (const adj of connections[startRoom]) {
            rooms[adj].revealed = true;
        }

        const runData = {
            floor: 1,
            hp: playerStats.hp,
            max_hp: playerStats.hp,
            status: 'active',
            rooms: JSON.stringify(rooms),
            current_room: startRoom,
            completed_rooms: JSON.stringify([]),
            boss_defeated: 0,
            temp_inventory: JSON.stringify([]),
            active_relics: JSON.stringify([]),
            active_debuffs: JSON.stringify([]),
            floor_money: 0,
            total_money: 0,
        };

        await this.db.pool.execute(
            `INSERT INTO dungeon_runs 
            (user_id, floor, hp, max_hp, status, rooms, current_room, completed_rooms, boss_defeated, temp_inventory, active_relics, active_debuffs, floor_money, total_money)
            VALUES (?, ?, ?, ?, 'active', ?, ?, '[]', 0, '[]', '[]', '[]', 0, 0)`,
            [userId, 1, playerStats.hp, playerStats.hp, runData.rooms, startRoom]
        );

        // Marcar tutorial si es primera vez
        if (!user.stats?.dungeon_tutorial) {
            return { success: true, firstTime: true };
        }

        return { success: true, firstTime: false };
    }

    // ─── OBTENER RUN ACTIVA ───
    async getRun(userId) {
        const [rows] = await this.db.pool.execute(
            'SELECT * FROM dungeon_runs WHERE user_id = ? AND status = "active"',
            [userId]
        );
        if (!rows.length) return null;

        const run = rows[0];
        return {
            ...run,
            rooms:           JSON.parse(run.rooms),
            completed_rooms: JSON.parse(run.completed_rooms),
            temp_inventory:  JSON.parse(run.temp_inventory),
            active_relics:   JSON.parse(run.active_relics),
            active_debuffs:  JSON.parse(run.active_debuffs),
        };
    }

    // ─── ACTUALIZAR RUN ───
    async updateRun(userId, data) {
        const toSave = { ...data };
        if (Array.isArray(toSave.rooms))           toSave.rooms           = JSON.stringify(toSave.rooms);
        if (Array.isArray(toSave.completed_rooms)) toSave.completed_rooms = JSON.stringify(toSave.completed_rooms);
        if (Array.isArray(toSave.temp_inventory))  toSave.temp_inventory  = JSON.stringify(toSave.temp_inventory);
        if (Array.isArray(toSave.active_relics))   toSave.active_relics   = JSON.stringify(toSave.active_relics);
        if (Array.isArray(toSave.active_debuffs))  toSave.active_debuffs  = JSON.stringify(toSave.active_debuffs);

        const fields = Object.keys(toSave).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(toSave), userId];

        await this.db.pool.execute(
            `UPDATE dungeon_runs SET ${fields} WHERE user_id = ?`,
            values
        );
    }

    // ─── TERMINAR RUN ───
    async endRun(userId, status = 'escaped') {
        const run = await this.getRun(userId);
        if (!run) return null;

        // Guardar dinero ganado
        if (run.total_money > 0) {
            await this.economy.addMoney(userId, run.total_money, 'dungeon_reward');
        }

        // Guardar items temporales como permanentes
        const tempInventory = run.temp_inventory;
        for (const item of tempInventory) {
            await this.economy.equipment.addDungeonDrop(userId, item.id);
        }

        // Eliminar run
        await this.db.pool.execute(
            'DELETE FROM dungeon_runs WHERE user_id = ?',
            [userId]
        );

        return {
            money: run.total_money,
            items: tempInventory,
            floor: run.floor,
            status
        };
    }

    // ─── MUERTE ───
    async killRun(userId) {
        await this.db.pool.execute(
            'DELETE FROM dungeon_runs WHERE user_id = ?',
            [userId]
        );
    }

    // ─── CONSTRUIR EMBED DE MAPA ───
    buildMapEmbed(run, { EmbedBuilder }) {
        const rooms = run.rooms;
        const current = run.current_room;
        const completed = run.completed_rooms;
        const hasRevealMap = run.active_relics.some(r => r.effect === 'reveal_map' || r.effect === 'reveal_all_rooms');

        // Construir representación visual del mapa
        const roomCount = rooms.length;
        let mapLines = [];
        const perRow = 4;

        for (let row = 0; row < Math.ceil(roomCount / perRow); row++) {
            let line = '';
            for (let col = 0; col < perRow; col++) {
                const idx = row * perRow + col;
                if (idx >= roomCount) break;

                const room = rooms[idx];
                let display;

                if (idx === current) {
                    display = '🚶';
                } else if (completed.includes(idx)) {
                    display = '✅';
                } else if (room.revealed || hasRevealMap) {
                    display = room.emoji;
                } else {
                    display = '❓';
                }

                line += display;
                if (col < perRow - 1 && idx + 1 < roomCount) line += ' — ';
            }
            mapLines.push(line);
            if (row < Math.ceil(roomCount / perRow) - 1) mapLines.push('　　|');
        }

        const hpBar = () => {
            const pct = run.hp / run.max_hp;
            const filled = Math.round(pct * 8);
            const bar = '█'.repeat(filled) + '░'.repeat(8 - filled);
            const color = pct > 0.5 ? '🟩' : pct > 0.25 ? '🟨' : '🟥';
            return `${color} \`${bar}\` ${run.hp}/${run.max_hp}`;
        };

        const debuffText = run.active_debuffs.length
            ? run.active_debuffs.map(d => d.name).join(' ')
            : 'Ninguno';

        const relicText = run.active_relics.length
            ? run.active_relics.map(r => r.name).join(' ')
            : 'Ninguna';

        const embed = new EmbedBuilder()
            .setTitle(`🏰 Mazmorra — Piso ${run.floor}`)
            .setColor(0x2c2f33)
            .addFields(
                {
                    name: '🗺️ Mapa',
                    value: '```\n' + mapLines.join('\n') + '\n```',
                    inline: false
                },
                {
                    name: '❤️ HP',
                    value: hpBar(),
                    inline: false
                },
                {
                    name: '💰 Dinero del piso',
                    value: `${run.floor_money.toLocaleString()} ${this.currency}`,
                    inline: true
                },
                {
                    name: '✅ Completadas',
                    value: `${run.completed_rooms.length}/${run.rooms.length - 1}`,
                    inline: true
                },
                {
                    name: '⚠️ Debuffs',
                    value: debuffText,
                    inline: true
                },
                {
                    name: '✨ Reliquias',
                    value: relicText,
                    inline: false
                }
            )
            .setFooter({ text: 'Selecciona una habitación para explorar' });

        return embed;
    }

    // ─── CONSTRUIR BOTONES DE HABITACIONES ADYACENTES ───
    buildRoomButtons(run, userId, { ActionRowBuilder, ButtonBuilder, ButtonStyle }) {
        const { connections } = this.generateConnectionsFromRooms(run.rooms);
        const current = run.current_room ?? 0;
        const adjacent = (connections[current] || [])
            .filter(idx => !run.completed_rooms.includes(idx) || run.rooms[idx]?.type === 'rest');

        console.log('current_room:', current, 'adjacent:', adjacent, 'connections:', connections);

        if (!adjacent.length) return [];

        const rows = [];
        const buttons = adjacent.map(idx => {
            const room = run.rooms[idx];
            const hasRevealMap = run.active_relics.some(r => r.effect === 'reveal_map' || r.effect === 'reveal_all_rooms');
            const isRevealed = room.revealed || hasRevealMap;
            const label = isRevealed
                ? `${this.ROOM_TYPES[room.type]?.emoji || '❓'} ${this.ROOM_TYPES[room.type]?.label || 'Misterioso'}`
                : '❓ Misterioso';
            const wasVisited = run.completed_rooms.includes(idx);

            return new ButtonBuilder()
                .setCustomId(`dungeon_room_${userId}_${idx}`)
                .setLabel(label.slice(0, 25))
                .setStyle(wasVisited ? ButtonStyle.Secondary : ButtonStyle.Primary);
        });

        for (let i = 0; i < buttons.length; i += 5) {
            rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)));
        }

        if (run.boss_defeated) {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon_escape_${userId}`)
                    .setLabel('Escapar con el loot')
                    .setEmoji('🏃')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`dungeon_nextfloor_${userId}`)
                    .setLabel('Siguiente piso')
                    .setEmoji('⬇️')
                    .setStyle(ButtonStyle.Success)
            ));
        }

        return rows;
    }

    // ─── RECONSTRUIR CONEXIONES DESDE ROOMS ───
    generateConnectionsFromRooms(rooms) {
        const connections = {};
        rooms.forEach(r => {
            connections[r.index] = r.connections || [];
        });
        return { connections };
    }

    // ─── CALCULAR DAÑO ───
    calculateDamage(attackerAtk, defenderDef, crit = 0.05) {
        const isCrit = Math.random() < crit;
        const base = Math.max(1, attackerAtk - defenderDef + Math.floor(Math.random() * 6) - 2);
        return { damage: isCrit ? Math.ceil(base * 1.5) : base, isCrit };
    }

    // ─── APLICAR RELIQUIAS A STATS ───
    applyRelicsToStats(stats, relics) {
        const modified = { ...stats };
        for (const relic of relics) {
            if (relic.effect === 'hp_boost')    modified.hp  = Math.ceil(modified.hp  * 1.2);
            if (relic.effect === 'berserker')  { modified.atk = Math.ceil(modified.atk * 1.3); modified.def = Math.ceil(modified.def * 0.85); }
            if (relic.effect === 'cursed_atk')   modified.atk = Math.ceil(modified.atk * 1.5);
        }
        return modified;
    }

    // ─── ACTUALIZAR BESTIARIO ───
    async updateBestiary(userId, bossId, boss) {
        const user = await this.economy.getUser(userId);
        const bestiary = user.stats?.bestiary || {};

        if (!bestiary[bossId]) {
            bestiary[bossId] = {
                name: boss.name,
                defeats: 1,
                firstDefeated: new Date().toISOString(),
                description: boss.bestiary?.description || '',
                weakness: boss.bestiary?.weakness || 'Desconocida',
            };
        } else {
            bestiary[bossId].defeats++;
        }

        await this.economy.updateUser(userId, {
            stats: { ...user.stats, bestiary }
        });
    }

    // ─── AVANZAR AL SIGUIENTE PISO ───
    async nextFloor(userId) {
        const run = await this.getRun(userId);
        if (!run) return null;

        const newFloor = run.floor + 1;
        const { rooms, connections, startRoom } = this.generateFloor(newFloor);

        // Revelar adyacentes al inicio
        rooms[startRoom].visited = true;
        rooms[startRoom].revealed = true;
        for (const adj of connections[startRoom]) {
            rooms[adj].revealed = true;
        }

        await this.updateRun(userId, {
            floor: newFloor,
            rooms: rooms,
            current_room: startRoom,
            completed_rooms: [],
            boss_defeated: 0,
            floor_money: 0,
        });

        return newFloor;
    }
}

module.exports = DungeonSystem;