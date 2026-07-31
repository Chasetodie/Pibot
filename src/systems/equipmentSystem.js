// LA COMPRA SE REALIZA DESDE LA TIENDA, EL USO SI SE GESTIONA ACA 

class EquipmentSystem {
    constructor(economy) {
        this.economy = economy;
        this.db = economy.database;
        this.currency = 'π-b$';

        // ─── ITEMS EXCLUSIVOS DE DUNGEON (se dropean en runs) ───
        this.DUNGEON_ITEMS = {
            // Armas
            goblin_blade:    { name: '🗡️ Hoja Goblin',       type: 'weapon',    rarity: 'uncommon', stats: { atk: 18 }, durability: 100 },
            shadow_dagger:   { name: '🌑 Daga Sombría',      type: 'weapon',    rarity: 'rare',     stats: { atk: 30, crit: 0.10 }, durability: 120 },
            dragon_fang:     { name: '🐉 Colmillo Dragón',   type: 'weapon',    rarity: 'epic',     stats: { atk: 50, crit: 0.15 }, durability: 150 },
            demon_blade:     { name: '😈 Hoja Demoníaca',    type: 'weapon',    rarity: 'legendary', stats: { atk: 75, crit: 0.20 }, durability: 200 },

            // Cascos
            goblin_helmet:   { name: '🪖 Casco Goblin',      type: 'helmet', rarity: 'uncommon', stats: { def: 8,  hp: 15 }, durability: 100 },
            shadow_helmet:   { name: '🌑 Casco Sombrío',     type: 'helmet', rarity: 'rare',     stats: { def: 14, hp: 25 }, durability: 120 },
            dragon_helmet:   { name: '🐉 Casco Dragón',      type: 'helmet', rarity: 'epic',     stats: { def: 22, hp: 40 }, durability: 150 },
            demon_helmet:    { name: '😈 Casco Demoníaco',   type: 'helmet', rarity: 'legendary', stats: { def: 35, hp: 60, evasion: 0.05 }, durability: 200 },

            // Petos
            goblin_chest:    { name: '🛡️ Peto Goblin',       type: 'chest', rarity: 'uncommon', stats: { def: 12, hp: 25 }, durability: 100 },
            shadow_chest:    { name: '🌑 Peto Sombrío',      type: 'chest', rarity: 'rare',     stats: { def: 20, hp: 45 }, durability: 120 },
            dragon_chest:    { name: '🐉 Peto Dragón',       type: 'chest', rarity: 'epic',     stats: { def: 35, hp: 70 }, durability: 150 },
            demon_chest:     { name: '😈 Peto Demoníaco',    type: 'chest', rarity: 'legendary', stats: { def: 55, hp: 100, atk: 10 }, durability: 200 },

            // Botas
            goblin_boots:    { name: '👟 Botas Goblin',      type: 'boots', rarity: 'uncommon', stats: { def: 5,  evasion: 0.06 }, durability: 100 },
            shadow_boots:    { name: '🌑 Botas Sombrías',    type: 'boots', rarity: 'rare',     stats: { def: 9,  evasion: 0.10 }, durability: 120 },
            dragon_boots:    { name: '🐉 Botas Dragón',      type: 'boots', rarity: 'epic',     stats: { def: 15, evasion: 0.15 }, durability: 150 },
            demon_boots:     { name: '😈 Botas Demoníacas',  type: 'boots', rarity: 'legendary', stats: { def: 22, evasion: 0.22, atk: 8 }, durability: 200 },

            // Accesorios
            lucky_charm:       { name: '🍀 Amuleto de Suerte',                type: 'accessory', rarity: 'uncommon',  stats: { crit: 0.12, evasion: 0.08 },      durability: 80 },
            berserker_ring:    { name: '💢 Anillo Berserker',                 type: 'accessory', rarity: 'rare',      stats: { atk: 15, hp: -20 },               durability: 100 },
            dragon_eye:        { name: '👁️ Ojo de Dragón',                    type: 'accessory', rarity: 'epic',      stats: { crit: 0.25, atk: 10 },            durability: 120 },
            soul_ring:         { name: '💀 Anillo del Alma',                  type: 'accessory', rarity: 'legendary', stats: { atk: 20, def: 20, hp: 50 },       durability: 180 },
            bunny_suit_pibe12: { name: '🐰 Traje de Conejita de Pibe 12',     type: 'chest',     rarity: 'legendary', stats: { def: 35, hp: 60, evasion: 0.08 }, durability: 150 },
        };

        this.RARITY_COLORS = {
            common:    0x9e9e9e,
            uncommon:  0x4caf50,
            rare:      0x2196f3,
            epic:      0x9c27b0,
            legendary: 0xff9800,
        };

        this.RARITY_LABELS = {
            common:    '⬜ Común',
            uncommon:  '🟩 Poco Común',
            rare:      '🟦 Raro',
            epic:      '🟪 Épico',
            legendary: '🟧 Legendario',
        };

        this.TYPE_LABELS = {
            weapon:    '⚔️ Arma',
            helmet:    '🪖 Casco',
            chest:     '🛡️ Peto',
            boots:     '👟 Botas',
            accessory: '💍 Accesorio',
        };
    }

    // ─── OBTENER STATS TOTALES DEL JUGADOR ───
    async getPlayerStats(userId) {
        const user = await this.economy.getUser(userId);
        const equipped = await this.getEquipped(userId);

        const base = {
            hp:     50 + (user.level * 5),
            atk:    5  + (user.level * 2),
            def:    2  + (user.level * 1),
            crit:   0.05,
            evasion: 0.03,
        };

        for (const item of Object.values(equipped)) {
            if (!item) continue;
            const stats = item.stats || {};
            if (stats.atk)    base.atk     += stats.atk;
            if (stats.def)    base.def     += stats.def;
            if (stats.hp)     base.hp      += stats.hp;
            if (stats.crit)   base.crit    += stats.crit;
            if (stats.evasion) base.evasion += stats.evasion;
        }

        base.crit    = Math.min(base.crit, 0.75);
        base.evasion = Math.min(base.evasion, 0.60);

        return base;
    }

    // ─── OBTENER EQUIPO EQUIPADO ───
    async getEquipped(userId) {
        const [rows] = await this.db.pool.execute(
            'SELECT * FROM dungeon_equipment WHERE user_id = ? AND equipped = 1',
            [userId]
        );

        const result = { weapon: null, helmet: null, chest: null, boots: null, accessory: null };
        for (const row of rows) {
            result[row.type] = {
                ...row,
                stats: typeof row.stats === 'string' ? JSON.parse(row.stats) : row.stats,
            };
        }
        return result;
    }

    // ─── OBTENER TODO EL INVENTARIO ───
    async getInventory(userId) {
        const [rows] = await this.db.pool.execute(
            'SELECT * FROM dungeon_equipment WHERE user_id = ? ORDER BY type, equipped DESC',
            [userId]
        );
        return rows.map(r => ({
            ...r,
            stats: typeof r.stats === 'string' ? JSON.parse(r.stats) : r.stats,
        }));
    }

    // ─── AGREGAR ITEM DE DUNGEON (drop) ───
    async addDungeonDrop(userId, itemId) {
        const [countRows] = await this.db.pool.execute(
            'SELECT COUNT(*) as total FROM dungeon_equipment WHERE user_id = ?',
            [userId]
        );
        if (countRows[0].total >= 20) return null; // Inventario lleno, no dropear

        const item = this.DUNGEON_ITEMS[itemId];
        if (!item) return null;

        const [result] = await this.db.pool.execute(
            `INSERT INTO dungeon_equipment (user_id, item_id, type, name, stats, durability, max_durability, equipped, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'dungeon')`,
            [userId, itemId, item.type, item.name, JSON.stringify(item.stats), item.durability, item.durability]
        );

        return { id: result.insertId, ...item };
    }

    async addShopItem(userId, itemId, item) {
        // Verificar límite de inventario
        const [countRows] = await this.db.pool.execute(
            'SELECT COUNT(*) as total FROM dungeon_equipment WHERE user_id = ?',
            [userId]
        );
        if (countRows[0].total >= 20) {
            return { success: false, message: '❌ Tu inventario de equipamiento está lleno (20/20). Vende o descarta items antes de comprar más.' };
        }

        const stats = item.effect.combatStats || {};
        const durability = item.effect.durability || 100;
        const type = item.effect.itemType || 'chest';

        await this.db.pool.execute(
            `INSERT INTO dungeon_equipment (user_id, item_id, type, name, stats, durability, max_durability, equipped, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'shop')`,
            [userId, itemId, type, item.name, JSON.stringify(stats), durability, durability]
        );
    }

    // ─── EQUIPAR ITEM ───
    async equipItem(userId, equipmentId) {
        const [rows] = await this.db.pool.execute(
            'SELECT * FROM dungeon_equipment WHERE id = ? AND user_id = ?',
            [equipmentId, userId]
        );
        if (!rows.length) return { success: false, message: '❌ Item no encontrado en tu inventario.' };

        const item = rows[0];
        if (item.equipped) return { success: false, message: '❌ Ese item ya está equipado.' };
        if (item.durability <= 0) return { success: false, message: '❌ Ese item está roto, no puedes equiparlo.' };

        // Desequipar el del mismo tipo si hay uno
        await this.db.pool.execute(
            'UPDATE dungeon_equipment SET equipped = 0 WHERE user_id = ? AND type = ? AND equipped = 1',
            [userId, item.type]
        );

        // Equipar el nuevo
        await this.db.pool.execute(
            'UPDATE dungeon_equipment SET equipped = 1 WHERE id = ?',
            [equipmentId]
        );

        return { success: true, message: `✅ **${item.name}** equipado!` };
    }

    // ─── DESEQUIPAR ITEM ───
    async unequipItem(userId, type) {
        const validTypes = ['weapon', 'armor', 'accessory'];
        if (!validTypes.includes(type)) return { success: false, message: '❌ Tipo inválido. Usa: `weapon`, `armor` o `accessory`.' };

        const [rows] = await this.db.pool.execute(
            'UPDATE dungeon_equipment SET equipped = 0 WHERE user_id = ? AND type = ? AND equipped = 1',
            [userId, type]
        );

        if (!rows.affectedRows) return { success: false, message: `❌ No tenés ningún **${this.TYPE_LABELS[type]}** equipado.` };
        return { success: true, message: `✅ **${this.TYPE_LABELS[type]}** desequipado.` };
    }

    // ─── APLICAR DESGASTE (se llama desde dungeon después de cada combate) ───
    async applyWear(userId, amount = 1) {
        const equipped = await this.getEquipped(userId);
        const broken = [];

        for (const [type, item] of Object.entries(equipped)) {
            if (!item) continue;

            const newDurability = Math.max(0, item.durability - amount);
            await this.db.pool.execute(
                'UPDATE dungeon_equipment SET durability = ? WHERE id = ?',
                [newDurability, item.id]
            );

            if (newDurability === 0) {
                await this.db.pool.execute(
                    'UPDATE dungeon_equipment SET equipped = 0 WHERE id = ?',
                    [item.id]
                );
                broken.push(item.name);
            }
        }

        return { broken };
    }

    // ─── REPARAR ITEM ───
    async repairItem(userId, equipmentId) {
        const [rows] = await this.db.pool.execute(
            'SELECT * FROM dungeon_equipment WHERE id = ? AND user_id = ?',
            [equipmentId, userId]
        );
        if (!rows.length) return { success: false, message: '❌ Item no encontrado.' };

        const item = rows[0];
        if (item.durability >= item.max_durability) return { success: false, message: '❌ Ese item no necesita reparación.' };

        const missingDurability = item.max_durability - item.durability;
        const repairCost = Math.ceil(missingDurability * 10);

        const user = await this.economy.getUser(userId);
        if (user.balance < repairCost) {
            return { success: false, message: `❌ Necesitás **${repairCost.toLocaleString()} ${this.currency}** para reparar esto.` };
        }

        await this.economy.removeMoney(userId, repairCost, 'equipment_repair');
        await this.db.pool.execute(
            'UPDATE dungeon_equipment SET durability = max_durability WHERE id = ?',
            [item.id]
        );

        return { success: true, message: `🔧 **${item.name}** reparado por **${repairCost.toLocaleString()} ${this.currency}**!` };
    }

    // ─── VENDER ITEM ───
    async sellItem(userId, equipmentId) {
        const [rows] = await this.db.pool.execute(
            'SELECT * FROM dungeon_equipment WHERE id = ? AND user_id = ?',
            [equipmentId, userId]
        );
        if (!rows.length) return { success: false, message: '❌ Item no encontrado.' };

        const item = rows[0];
        if (item.equipped) return { success: false, message: '❌ Desequipá el item antes de venderlo.' };

        // Precio de venta: 30% del precio original si es de tienda, valor fijo según rareza si es de dungeon
        let sellPrice;
        if (item.source === 'shop') {
            const shopItem = this.economy.shop?.shopItems[item.item_id];
            if (shopItem) {
                sellPrice = Math.ceil(shopItem.price * 0.30);
            } else {
                const rarityPrices = { common: 150, uncommon: 450, rare: 1200, epic: 3000, legendary: 7500 };
                const dungeonData = this.DUNGEON_ITEMS[item.item_id];
                sellPrice = rarityPrices[dungeonData?.rarity || 'common'];
            }
        } else {
            const dungeonItem = this.DUNGEON_ITEMS[item.item_id];
            const rarityPrices = { common: 500, uncommon: 1500, rare: 4000, epic: 10000, legendary: 25000 };
            sellPrice = rarityPrices[dungeonItem?.rarity || 'common'];
        }

        // Ajuste por durabilidad
        const stats = typeof item.stats === 'string' ? JSON.parse(item.stats) : item.stats;
        const durabilityRatio = item.durability / item.max_durability;
        sellPrice = Math.ceil(sellPrice * durabilityRatio);

        await this.db.pool.execute('DELETE FROM dungeon_equipment WHERE id = ?', [item.id]);
        await this.economy.addMoney(userId, sellPrice, 'equipment_sell');

        return { success: true, message: `💰 Vendiste **${item.name}** por **${sellPrice.toLocaleString()} ${this.currency}**.` };
    }

    // ─── FORMATEAR STATS PARA MOSTRAR ───
    formatStats(stats) {
        const parts = [];
        if (stats.atk)    parts.push(`⚔️ +${stats.atk} ATK`);
        if (stats.def)    parts.push(`🛡️ +${stats.def} DEF`);
        if (stats.hp)     parts.push(`❤️ ${stats.hp > 0 ? '+' : ''}${stats.hp} HP`);
        if (stats.crit)   parts.push(`🎯 +${Math.round(stats.crit * 100)}% Crítico`);
        if (stats.evasion) parts.push(`💨 +${Math.round(stats.evasion * 100)}% Evasión`);
        return parts.join(' | ') || 'Sin stats';
    }

    // ─── BUILD EMBED DE EQUIPO ACTUAL ───
    async buildEquipEmbed(userId, { EmbedBuilder }) {
        const user = await this.economy.getUser(userId);
        const equipped = await this.getEquipped(userId);
        const stats = await this.getPlayerStats(userId);

        const durabilityBar = (current, max) => {
            const pct = current / max;
            const filled = Math.round(pct * 6);
            const bar = '█'.repeat(filled) + '░'.repeat(6 - filled);
            const color = pct > 0.5 ? '🟩' : pct > 0.25 ? '🟨' : '🟥';
            return `${color}\`${bar}\` ${current}/${max}`;
        };

        const formatSlot = (item, emoji, label) => {
            if (!item) return `${emoji} **${label}**\n┗ *Vacío*\n`;
            const stats = typeof item.stats === 'string' ? JSON.parse(item.stats) : item.stats;
            const dungeonData = this.DUNGEON_ITEMS[item.item_id];
            const rarity = dungeonData ? ` • ${this.RARITY_LABELS[dungeonData.rarity]}` : '';
            return `${emoji} **${label}** — ${item.name}${rarity}\n┣ ${this.formatStats(stats)}\n┗ ${durabilityBar(item.durability, item.max_durability)}\n`;
        };

        const equipDesc = [
            formatSlot(equipped.weapon,    '⚔️', 'Arma'),
            formatSlot(equipped.helmet,    '🪖', 'Casco'),
            formatSlot(equipped.chest,     '🛡️', 'Peto'),
            formatSlot(equipped.boots,     '👟', 'Botas'),
            formatSlot(equipped.accessory, '💍', 'Accesorio'),
        ].join('');

        const statsDesc =
            `❤️ **HP:** ${stats.hp}　` +
            `⚔️ **ATK:** ${stats.atk}　` +
            `🛡️ **DEF:** ${stats.def}\n` +
            `🎯 **Crítico:** ${Math.round(stats.crit * 100)}%　` +
            `💨 **Evasión:** ${Math.round(stats.evasion * 100)}%`;

        const embed = new EmbedBuilder()
            .setTitle(`⚔️ Equipamiento de ${user.username || 'Jugador'}`)
            .setColor(0x5865f2)
            .addFields(
                { name: '🎽 Equipo Actual', value: equipDesc, inline: false },
                { name: '📊 Stats Totales', value: statsDesc, inline: false },
            )
            .setFooter({ text: '>equipo inventario' });

        return embed;
    }
}

module.exports = EquipmentSystem;