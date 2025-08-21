const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;
const CommandHandler = require('./commands'); // Importar el manejador de comandos
const EconomySystem = require('./economy'); // Importar el sistema de economia
const EventsSystem = require('./events');
const TradeSystem = require('./trade');
const MinigamesSystem = require('./minigames'); // Importar el sistema de minijuegos
const AchievementsSystem = require('./achievements');
const BettingSystem = require('./betting');
const MissionsSystem = require('./missions');
const ShopSystem = require('./shop');
const AllCommands = require('./all-commands');
//require('./admin-panel')(app); // Pasar el servidor express existente
const {
    AuctionSystem,
    CraftingSystem
} = require('./things-shop');

// Archivo para guardar los contadores
const countersFile = path.join(__dirname, 'counters.json');

if (typeof File === 'undefined') {
  global.File = class File {
    constructor() {
      throw new Error('File is not supported in this environment.');
    }
  };
}


// Función para cargar contadores (con variables de entorno como respaldo)
function loadCounters() {
    try {
        if (fs.existsSync(countersFile)) {
            const data = fs.readFileSync(countersFile, 'utf8');
            const saved = JSON.parse(data);
            console.log(`📂 Contadores cargados desde archivo: Pibe ${saved.pibe}, Piba ${saved.piba}`);
            return saved;
        }
    } catch (error) {
        console.error('Error cargando contadores desde archivo:', error);
    }
    
    // Si no hay archivo, usar variables de entorno
    const fromEnv = {
        pibe: parseInt(process.env.PIBE_COUNT) || 0,
        piba: parseInt(process.env.PIBA_COUNT) || 0
    };
    
    console.log(`🌍 Usando contadores desde variables de entorno: Pibe ${fromEnv.pibe}, Piba ${fromEnv.piba}`);
    saveCounters(fromEnv); // Guardar en archivo para futuras ocasiones
    return fromEnv;
}

// Configuración del bot de Discord con TODOS los intents necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// Función para guardar contadores
function saveCounters(counters) {
    try {
        fs.writeFileSync(countersFile, JSON.stringify(counters, null, 2));
        console.log(`💾 Contadores guardados: Pibe ${counters.pibe}, Piba ${counters.piba}`);
    } catch (error) {
        console.error('Error guardando contadores:', error);
    }
}

// Cargar contadores al iniciar
let counters = loadCounters();

// Crear instancia del manejador de comandos
const commandHandler = new CommandHandler(counters, saveCounters);

//Crear instancia del sistema de economia
const economy = new EconomySystem();
economy.startCacheCleanup();

//Crear instancia del sistema de Minijuegos
const minigames = new MinigamesSystem(economy);

//Crear instancia del sistema de Misiones
const missions = new MissionsSystem(economy);
missions.startCacheCleanup();

//Crear instancia del sistema de Achievements
const achievements = new AchievementsSystem(economy);

//Crear instancia del sistema de Tienda
const shop = new ShopSystem(economy);

//Crear instancia del sistema de Eventos
const events = new EventsSystem(economy, client);
missions.connectEventsSystem(events);
achievements.connectEventsSystem(events);
economy.connectEventsSystem(events);
minigames.connectEventsSystem(events);

setTimeout(async () => {
    await events.loadEvents();
    console.log('✅ Sistemas de eventos listo');
}, 2000);

setInterval(async () => {
    await economy.db.backup(); // Crear backup cada 6 horas
}, 6 * 60 * 60 * 1000);

const betting = new BettingSystem(economy);

const trades = new TradeSystem(shop);
trades.startCacheCleanup();

const auctions = new AuctionSystem(shop);

const crafting = new CraftingSystem(shop);

// Instancia del sistema de comandos mejorados
const allCommands = new AllCommands(economy, shop, trades, auctions, crafting, events, betting);

economy.achievements = achievements;
minigames.achievements = achievements;

economy.missions = missions;
minigames.missions = missions;

economy.shop = shop;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// ✨ CONEXIÓN A POSTGRESQL DE RENDER
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Autenticación simple (usa una clave secreta)
const ADMIN_KEY = process.env.ADMIN_KEY || 'blackoutbc17';

function authMiddleware(req, res, next) {
    const key = req.headers.authorization || req.query.key;
    if (key !== ADMIN_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
}

// Ruta principal
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>🐘 PostgreSQL Admin Panel - Render</title>
        <style>
            body { font-family: Arial; margin: 20px; background: #2c2f33; color: white; }
            .container { max-width: 1200px; margin: 0 auto; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #36393f; }
            th, td { padding: 12px; border: 1px solid #555; text-align: left; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            th { background: #5865f2; }
            button { padding: 10px 20px; background: #5865f2; color: white; border: none; cursor: pointer; margin: 5px; border-radius: 4px; }
            input { padding: 8px; margin: 5px; background: #40444b; color: white; border: 1px solid #555; }
            .section { margin: 30px 0; padding: 20px; background: #36393f; border-radius: 8px; }
            .status { padding: 5px 10px; background: #43b581; border-radius: 4px; margin-left: 10px; }
            .error { background: #f04747; }
            .info { background: #7289da; color: white; padding: 10px; border-radius: 4px; margin: 10px 0; }
            textarea { width: 100%; height: 100px; background: #40444b; color: white; border: 1px solid #555; padding: 10px; border-radius: 4px; }
            .table-row:hover { background: #40444b; }
            .connection-info { background: #43b581; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🐘 PostgreSQL Database Admin Panel</h1>
            <div class="connection-info">
                <h4>📡 Conectado a: Render.com PostgreSQL</h4>
                <p>Host: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.match(/@([^:]+)/)?.[1] || 'render-host' : 'No configurado'}</p>
            </div>
            
            <div class="section">
                <h3>🔐 Autenticación</h3>
                <input type="password" id="adminKey" placeholder="Clave de administrador">
                <button onclick="setAuth()">Conectar</button>
                <span id="authStatus"></span>
            </div>
            
            <div class="section">
                <h3>📊 Tablas de la Base de Datos</h3>
                <button onclick="loadTables()">Cargar Tablas</button>
                <button onclick="loadSchemaInfo()">Info del Schema</button>
                <div id="tablesContainer"></div>
            </div>
            
            <div class="section">
                <h3>⚡ Ejecutar Query SQL</h3>
                <div class="info">
                    <strong>Ejemplos de queries:</strong><br>
                    • SELECT * FROM usuarios LIMIT 10;<br>
                    • SELECT COUNT(*) FROM mensajes;<br>
                    • SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';<br>
                </div>
                <textarea id="sqlQuery" placeholder="SELECT * FROM usuarios LIMIT 10;"></textarea>
                <br>
                <button onclick="executeQuery()">Ejecutar Query</button>
                <button onclick="clearResult()">Limpiar</button>
                <div id="queryResult"></div>
            </div>
            
            <div class="section">
                <h3>📈 Estadísticas de la Base de Datos</h3>
                <button onclick="loadStats()">Cargar Estadísticas</button>
                <button onclick="loadConnectionInfo()">Info de Conexión</button>
                <div id="statsContainer"></div>
            </div>
        </div>

        <script>
            let authKey = '';
            
            function setAuth() {
                authKey = document.getElementById('adminKey').value;
                document.getElementById('authStatus').innerHTML = '<span class="status">✅ Conectado</span>';
                loadTables();
            }
            
            async function loadTables() {
                try {
                    const response = await fetch('/api/tables', {
                        headers: { 'Authorization': authKey }
                    });
                    const data = await response.json();
                    
                    let html = '<h4>📋 Tablas disponibles:</h4>';
                    if (data.tables && data.tables.length > 0) {
                        data.tables.forEach(table => {
                            html += \`
                                <button onclick="loadTable('\${table.table_name}')" style="margin: 2px;">
                                    📄 \${table.table_name}
                                </button>
                            \`;
                        });
                    } else {
                        html += '<p>No se encontraron tablas públicas.</p>';
                    }
                    document.getElementById('tablesContainer').innerHTML = html;
                } catch (error) {
                    document.getElementById('tablesContainer').innerHTML = 
                        \`<div class="error">❌ Error cargando tablas: \${error.message}</div>\`;
                }
            }
            
            async function loadTable(tableName) {
                try {
                    const response = await fetch(\`/api/table/\${tableName}\`, {
                        headers: { 'Authorization': authKey }
                    });
                    const data = await response.json();
                    
                    let html = \`<h4>📋 Tabla: \${tableName} (\${data.rows.length} registros)</h4>\`;
                    
                    if (data.rows.length > 0) {
                        html += '<div style="overflow-x: auto;"><table><thead><tr>';
                        Object.keys(data.rows[0]).forEach(key => {
                            html += \`<th>\${key}</th>\`;
                        });
                        html += '</tr></thead><tbody>';
                        
                        data.rows.forEach(row => {
                            html += '<tr class="table-row">';
                            Object.values(row).forEach(value => {
                                let displayValue = value;
                                if (value === null) displayValue = '<em style="color: #888;">NULL</em>';
                                if (typeof value === 'string' && value.length > 50) {
                                    displayValue = value.substring(0, 50) + '...';
                                }
                                html += \`<td title="\${value}">\${displayValue}</td>\`;
                            });
                            html += '</tr>';
                        });
                        html += '</tbody></table></div>';
                    } else {
                        html += '<p>📭 Tabla vacía</p>';
                    }
                    
                    document.getElementById('tablesContainer').innerHTML += html;
                } catch (error) {
                    alert('❌ Error cargando tabla: ' + error.message);
                }
            }
            
            async function loadSchemaInfo() {
                try {
                    const response = await fetch('/api/schema', {
                        headers: { 'Authorization': authKey }
                    });
                    const data = await response.json();
                    
                    let html = '<h4>🏗️ Información del Schema:</h4><table><thead><tr>';
                    html += '<th>Tabla</th><th>Columna</th><th>Tipo</th><th>Nullable</th><th>Default</th>';
                    html += '</tr></thead><tbody>';
                    
                    data.schema.forEach(col => {
                        html += \`<tr>
                            <td>\${col.table_name}</td>
                            <td>\${col.column_name}</td>
                            <td>\${col.data_type}</td>
                            <td>\${col.is_nullable}</td>
                            <td>\${col.column_default || 'N/A'}</td>
                        </tr>\`;
                    });
                    html += '</tbody></table>';
                    
                    document.getElementById('tablesContainer').innerHTML += html;
                } catch (error) {
                    alert('❌ Error cargando schema: ' + error.message);
                }
            }
            
            async function executeQuery() {
                const query = document.getElementById('sqlQuery').value.trim();
                if (!query) {
                    alert('⚠️ Ingresa un query SQL');
                    return;
                }
                
                try {
                    const response = await fetch('/api/query', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': authKey
                        },
                        body: JSON.stringify({ query })
                    });
                    const data = await response.json();
                    
                    let html = '<h4>✅ Resultado del Query:</h4>';
                    if (data.rows && data.rows.length > 0) {
                        html += \`<p><strong>📊 \${data.rows.length} registros encontrados</strong></p>\`;
                        html += '<div style="overflow-x: auto;"><table><thead><tr>';
                        Object.keys(data.rows[0]).forEach(key => {
                            html += \`<th>\${key}</th>\`;
                        });
                        html += '</tr></thead><tbody>';
                        data.rows.forEach(row => {
                            html += '<tr>';
                            Object.values(row).forEach(value => {
                                let displayValue = value;
                                if (value === null) displayValue = '<em style="color: #888;">NULL</em>';
                                if (typeof value === 'string' && value.length > 100) {
                                    displayValue = value.substring(0, 100) + '...';
                                }
                                html += \`<td title="\${value}">\${displayValue}</td>\`;
                            });
                            html += '</tr>';
                        });
                        html += '</tbody></table></div>';
                    } else if (data.rowCount !== undefined) {
                        html += \`<p>✅ Query ejecutado correctamente. Filas afectadas: <strong>\${data.rowCount}</strong></p>\`;
                    } else {
                        html += '<p>✅ Query ejecutado sin resultados</p>';
                    }
                    document.getElementById('queryResult').innerHTML = html;
                } catch (error) {
                    document.getElementById('queryResult').innerHTML = 
                        \`<div class="error">❌ Error: \${error.message}</div>\`;
                }
            }
            
            function clearResult() {
                document.getElementById('queryResult').innerHTML = '';
            }
            
            async function loadStats() {
                try {
                    const response = await fetch('/api/stats', {
                        headers: { 'Authorization': authKey }
                    });
                    const data = await response.json();
                    document.getElementById('statsContainer').innerHTML = \`
                        <div class="info">
                            <h4>📊 Estadísticas de la Base de Datos</h4>
                            <p><strong>🗂️ Total de tablas:</strong> \${data.tableCount}</p>
                            <p><strong>🔗 Total de conexiones activas:</strong> \${data.connections}</p>
                            <p><strong>📅 Versión de PostgreSQL:</strong> \${data.version}</p>
                            <p><strong>🕐 Última consulta:</strong> \${new Date().toLocaleString()}</p>
                        </div>
                    \`;
                } catch (error) {
                    document.getElementById('statsContainer').innerHTML = 
                        \`<div class="error">❌ Error cargando estadísticas: \${error.message}</div>\`;
                }
            }
            
            async function loadConnectionInfo() {
                try {
                    const response = await fetch('/api/connection', {
                        headers: { 'Authorization': authKey }
                    });
                    const data = await response.json();
                    document.getElementById('statsContainer').innerHTML += \`
                        <div class="info">
                            <h4>🔌 Información de Conexión</h4>
                            <p><strong>Host:</strong> \${data.host}</p>
                            <p><strong>Puerto:</strong> \${data.port}</p>
                            <p><strong>Base de datos:</strong> \${data.database}</p>
                            <p><strong>Usuario:</strong> \${data.user}</p>
                            <p><strong>SSL:</strong> \${data.ssl ? '🔒 Habilitado' : '❌ Deshabilitado'}</p>
                        </div>
                    \`;
                } catch (error) {
                    alert('❌ Error cargando info de conexión: ' + error.message);
                }
            }
        </script>
    </body>
    </html>
    `);
});

// 🔌 API Routes para PostgreSQL
app.get('/api/tables', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        res.json({ tables: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/table/:name', authMiddleware, async (req, res) => {
    const tableName = req.params.name;
    // Validar nombre de tabla para prevenir SQL injection
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        return res.status(400).json({ error: 'Nombre de tabla inválido' });
    }
    
    try {
        const result = await pool.query(`SELECT * FROM "${tableName}" LIMIT 100`);
        res.json({ rows: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/schema', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                table_name,
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            ORDER BY table_name, ordinal_position
        `);
        res.json({ schema: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/query', authMiddleware, async (req, res) => {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query inválido' });
    }
    
    // Prevenir queries peligrosos
    const dangerousKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER'];
    const upperQuery = query.toUpperCase();
    const hasDangerous = dangerousKeywords.some(keyword => upperQuery.includes(keyword));
    
    if (hasDangerous) {
        return res.status(403).json({ 
            error: 'Queries destructivos no permitidos. Solo SELECT permitido.' 
        });
    }
    
    try {
        const result = await pool.query(query);
        res.json({ 
            rows: result.rows, 
            rowCount: result.rowCount 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats', authMiddleware, async (req, res) => {
    try {
        const tablesResult = await pool.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        const connectionsResult = await pool.query('SELECT COUNT(*) as count FROM pg_stat_activity');
        const versionResult = await pool.query('SELECT version()');
        
        res.json({ 
            tableCount: parseInt(tablesResult.rows[0].count),
            connections: parseInt(connectionsResult.rows[0].count),
            version: versionResult.rows[0].version
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/connection', authMiddleware, async (req, res) => {
    try {
        const connectionString = process.env.DATABASE_URL;
        const url = new URL(connectionString);
        
        res.json({
            host: url.hostname,
            port: url.port,
            database: url.pathname.slice(1),
            user: url.username,
            ssl: true
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor web corriendo en puerto ${PORT} en todas las interfaces`);
    console.log(`🔗 URLs disponibles:`);
    console.log(`   - Salud: http://0.0.0.0:${PORT}/health`);
    console.log(`   - Principal: http://0.0.0.0:${PORT}/`);
    console.log(`   - Admin: http://0.0.0.0:${PORT}/admin`);
});

// Evento cuando el bot está listo
client.once('ready', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    console.log(`📊 Contadores actuales: Pibe ${counters.pibe}, Piba ${counters.piba}`);
    console.log(`🌍 Variables de entorno: PIBE_COUNT=${process.env.PIBE_COUNT || 'no definida'}, PIBA_COUNT=${process.env.PIBA_COUNT || 'no definida'}`);
    console.log(`🔧 Comandos disponibles: !contadores, !reset, !reload, !help`);
    await minigames.loadActiveRussianGames(client);
    await minigames.loadActiveUnoGames(client);
  
    // Establecer el guild para eventos
    const guild = client.guilds.cache.get('1404905496644685834'); // ← Cambiar por tu ID real
    if (guild) {
        events.setGuild(guild); // Asumiendo que events es accesible aquí
    }
});

// Evento cuando un miembro abandona el servidor
client.on('guildMemberRemove', async (member) => {
    try {
        const nickname = member.nickname || member.user.username;
        console.log(`👋 Miembro salió: ${member.user.tag} (Apodo: ${nickname})`);
        
        // Verificar si el apodo era "Pibe X" o "Piba X"
        const pibeMatch = nickname.match(/^Pibe (\d+)$/);
        const pibaMatch = nickname.match(/^Piba (\d+)$/);
        
        if (pibeMatch) {
            // Era un pibe, restar del contador
            const numero = parseInt(pibeMatch[1]);
            if (numero === counters.pibe) {
                // Era el último pibe, reducir contador
                counters.pibe--;
                saveCounters(counters);
                console.log(`🔵 Contador de pibes reducido a: ${counters.pibe}`);
            }
        } else if (pibaMatch) {
            // Era una piba, restar del contador
            const numero = parseInt(pibaMatch[1]);
            if (numero === counters.piba) {
                // Era la última piba, reducir contador
                counters.piba--;
                saveCounters(counters);
                console.log(`🔴 Contador de pibas reducido a: ${counters.piba}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error procesando salida de miembro:', error);
    }
});

// Evento cuando un nuevo miembro se une al servidor
client.on('guildMemberAdd', async (member) => {
    try {
        console.log(`🎉 Nuevo miembro: ${member.user.tag}`);
        
        // Crear el embed para el mensaje directo
        const embed = new EmbedBuilder()
            .setTitle('¡Bienvenido/a a Adictos a las píldoras!')
            .setDescription('Por favor selecciona tu género para asignarte un apodo:')
            .setColor('#5865F2')
            .addFields(
                { name: '🔵 Pibe', value: `Siguiente número: **${counters.pibe + 1}**`, inline: true },
                { name: '🔴 Piba', value: `Siguiente número: **${counters.piba + 1}**`, inline: true }
            )
            .setFooter({ text: 'Haz clic en uno de los botones para continuar' });

        // Crear los botones
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('select_pibe')
                    .setLabel('Pibe')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔵'),
                new ButtonBuilder()
                    .setCustomId('select_piba')
                    .setLabel('Piba')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔴')
            );

        // Enviar mensaje directo al usuario
        await member.send({
            embeds: [embed],
            components: [row]
        });

        console.log(`📩 Mensaje directo enviado a ${member.user.tag}`);
        
    } catch (error) {
        console.error('❌ Error enviando mensaje directo:', error);
        
        // Si no se puede enviar DM, intentar enviar mensaje en un canal del servidor
        try {
            const guild = member.guild;
            const systemChannel = guild.systemChannel;
            
            if (systemChannel) {
                await systemChannel.send({
                    content: `${member.user}, no pude enviarte un mensaje directo. Por favor, selecciona tu categoría aquí:`,
                    embeds: [embed],
                    components: [row]
                });
                console.log(`📢 Mensaje enviado en canal del sistema para ${member.user.tag}`);
            }
        } catch (channelError) {
            console.error('❌ Error enviando mensaje en canal:', channelError);
        }
    }
});

// Evento para manejar interacciones con botones
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    try {
        // Si la interacción viene de un DM, necesitamos encontrar el guild y member
        let member;
        let guild;
        
        if (interaction.guild) {
            // La interacción viene del servidor
            guild = interaction.guild;
            member = interaction.member;
        } else {
            // La interacción viene de un DM, necesitamos encontrar el servidor
            // Buscar en todos los servidores donde está el bot
            const guilds = client.guilds.cache;
            
            for (const [guildId, guildObj] of guilds) {
                try {
                    const foundMember = await guildObj.members.fetch(interaction.user.id);
                    if (foundMember) {
                        guild = guildObj;
                        member = foundMember;
                        break;
                    }
                } catch (error) {
                    // El usuario no está en este servidor, continuar
                    continue;
                }
            }
            
            if (!member || !guild) {
                await interaction.reply({
                    content: 'No pude encontrarte en ningún servidor. Asegúrate de estar en el servidor antes de usar los botones.',
                    flags: 64 // ephemeral
                });
                return;
            }
        }

        // AGREGAR ESTO: Manejo de botones del blackjack
        if (interaction.customId.startsWith('bj_')) {
            await minigames.handleBlackjackButtons(interaction);
            return; // Importante: return para no continuar con otros botones
        }

        if (interaction.customId.startsWith('shop_')) {
            await allCommands.handleShopInteraction(interaction);
            return;
        }

        if (interaction.customId.startsWith('trade_accept_')) {
            try {
                // Evitar spam
                await interaction.deferReply({ ephemeral: true });
                
                const tradeId = interaction.customId.replace('trade_accept_', '');
                
                // Obtener trade de la DB
                const tradeData = await trades.db.getTrade(tradeId);
                    
                if (!tradeData) {
                    await interaction.editReply({ content: '❌ Intercambio no encontrado o ya finalizado.' });
                    return;
                }
                
                // Verificar que el usuario es parte del trade
                if (interaction.user.id !== tradeData.initiator && interaction.user.id !== tradeData.target) {
                    await interaction.editReply({ content: '❌ No puedes participar en este intercambio.' });
                    return;
                }
                
                // Crear objeto mensaje falso para usar la función existente
                const fakeMessage = {
                    author: interaction.user,
                    channel: interaction.channel,
                    reply: async (content) => {
                        // No hacer nada, usaremos editReply después
                    }
                };
                
                // Usar la función de aceptar trade existente
                const result = await trades.acceptTradeButton(interaction.user.id, tradeData);
                
                if (result.success) {
                    await interaction.editReply({ content: result.message });
                    
                    if (result.completed) {
                        // Editar mensaje original para mostrar completado
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Intercambio Completado')
                            .setDescription('¡El intercambio se ha completado exitosamente!')
                            .setColor('#00FF00')
                            .setTimestamp();
                        
                        await interaction.message.edit({ 
                            embeds: [embed], 
                            components: [] 
                        });
                    }
                } else {
                    await interaction.editReply({ content: result.message });
                }
                
            } catch (error) {
                console.error('Error procesando aceptación:', error);
                await interaction.editReply({ content: '❌ Error procesando la aceptación.' });
            }
        }
        
        if (interaction.customId.startsWith('trade_cancel_')) {
            try {
                // Defer la respuesta inmediatamente para evitar spam
                await interaction.deferReply({ ephemeral: true });
                
                const tradeId = interaction.customId.replace('trade_cancel_', '');
                
                // Verificar que el trade existe y está activo
                const tradeData = await trades.db.getTrade(tradeId);
                    
                if (!tradeData) {
                    await interaction.editReply({ content: '❌ Intercambio no encontrado o ya finalizado.' });
                    return;
                }
                
                // Verificar que el usuario puede cancelar
                if (interaction.user.id !== tradeData.initiator && interaction.user.id !== tradeData.target) {
                    await interaction.editReply({ content: '❌ No puedes cancelar este intercambio.' });
                    return;
                }
                
                // Cancelar en la base de datos
                await trades.db.updateTrade(tradeId, {
                    status: 'cancelled',
                    completed_at: new Date().toISOString()
                });
                    
                if (error) {
                    console.error('Error cancelando trade:', error);
                    await interaction.editReply({ content: '❌ Error al cancelar el intercambio.' });
                    return;
                }
                
                // Responder exitosamente
                await interaction.editReply({ content: '✅ Intercambio cancelado exitosamente.' });
                
                // Editar el mensaje original para mostrar que fue cancelado
                try {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Intercambio Cancelado')
                        .setDescription(`Intercambio cancelado por ${interaction.user}`)
                        .setColor('#FF0000')
                        .setTimestamp();
                    
                    await interaction.message.edit({ 
                        embeds: [embed], 
                        components: [] // Quitar botones
                    });
                } catch (err) {
                    console.log('No se pudo editar el mensaje original');
                }
                
            } catch (error) {
                console.error('Error procesando cancelación:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Error procesando la cancelación.', ephemeral: true });
                } else {
                    await interaction.editReply({ content: '❌ Error procesando la cancelación.' });
                }
            }
        }

        try {
            if (interaction.customId === 'uno_show_hand') {
                const gameKey = `uno_${interaction.channelId}`;
                const game = minigames.activeGames.get(gameKey);
                
                if (!game) {
                    await interaction.reply({ content: '❌ No hay partida activa', ephemeral: true });
                    return;
                }
                
                const player = game.players.find(p => p.id === interaction.user.id);
                if (!player) {
                    await interaction.reply({ content: '❌ No estás en esta partida', ephemeral: true });
                    return;
                }
                
                try {
                    const handString = player.hand.map((card, i) => 
                        `${i}: ${minigames.getCardString(card)}`).join('\n');
                    
                    // Enviar por DM
                    const user = await interaction.user;
                    const embed = new EmbedBuilder()
                        .setTitle('🎴 Tu mano de UNO')
                        .setDescription(`\`\`\`${handString}\`\`\``)
                        .setColor('#0099FF')
                        .setFooter({ text: 'Usa >uplay <color> <valor> para jugar' });                    
                    
                    await user.send({ embeds: [embed] });

//                    await user.send(`🎴 **Tu mano:**\n\`\`\`${handString}\`\`\``);
                    
                    // Confirmar en canal (ephemeral real porque es interaction)
                    await interaction.reply({
                        content: `🎴 **Tu mano:**\n\`\`\`${handString}\`\`\``, 
                        ephemeral: true 
                    });
                    
                } catch (error) {
                    await interaction.reply({ 
                        content: '❌ No puedo enviarte mensaje privado. Activa los DMs en tu configuración de privacidad.', 
                        ephemeral: true 
                    });
                }
            }
            
            if (interaction.customId === 'uno_draw_card') {
                const gameKey = `uno_${interaction.channelId}`;
                const game = minigames.activeGames.get(gameKey);
                
                if (!game) {
                    await interaction.reply({ content: '❌ No hay partida activa', ephemeral: true });
                    return;
                }
                
                if (game.players[game.current_player_index].id !== interaction.user.id) {
                    await interaction.reply({ content: '❌ No es tu turno', ephemeral: true });
                    return;
                }
                
                await interaction.deferReply();
                
                // Crear un mensaje fake para usar la función existente
                const fakeMessage = {
                    author: interaction.user,
                    channel: interaction.channel,
                    client: interaction.client,
                    reply: async (content) => {
                        await interaction.editReply(content);
                    }
                };
                
                await minigames.drawCardForPlayer(game, interaction.user.id, fakeMessage);
            }
            
        } catch (error) {
            console.error('Error en interacción de botón:', error);
            await interaction.reply({ content: '❌ Error al procesar la acción', ephemeral: true });
        }
        
        if (interaction.customId === 'select_pibe') {
            // Incrementar contador de pibes
            counters.pibe++;
            const nickname = `Pibe ${counters.pibe}`;
            
            // Cambiar apodo
            await member.setNickname(nickname);
            
            // Guardar contadores
            saveCounters(counters);
            
            // Responder al usuario
            const successEmbed = new EmbedBuilder()
                .setTitle('¡Apodo asignado!')
                .setDescription(`Tu apodo ha sido cambiado a: **${nickname}**`)
                .setColor('#00FF00')
                .setFooter({ text: '¡Bienvenido al servidor!' });
            
            await interaction.reply({
                embeds: [successEmbed],
                flags: 64 // ephemeral
            });
            
            console.log(`✅ ${interaction.user.tag} eligió Pibe y ahora es ${nickname}`);
            
        } else if (interaction.customId === 'select_piba') {
            // Incrementar contador de pibas
            counters.piba++;
            const nickname = `Piba ${counters.piba}`;
            
            // Cambiar apodo
            await member.setNickname(nickname);
            
            // Guardar contadores
            saveCounters(counters);
            
            // Responder al usuario
            const successEmbed = new EmbedBuilder()
                .setTitle('¡Apodo asignado!')
                .setDescription(`Tu apodo ha sido cambiado a: **${nickname}**`)
                .setColor('#FF69B4')
                .setFooter({ text: '¡Bienvenida al servidor!' });
            
            await interaction.reply({
                embeds: [successEmbed],
                flags: 64 // ephemeral
            });
            
            console.log(`✅ ${interaction.user.tag} eligió Piba y ahora es ${nickname}`);
        }

        if (interaction.customId.startsWith('bj_')) {
          await minigamesSystem.handleBlackjackButton(interaction);
        }
        
    } catch (error) {
        console.error('❌ Error procesando selección:', error);
        
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Hubo un error al procesar tu acción. Por favor contacta a un administrador.',
                    flags: 64 // ephemeral
                });
            }
        } catch (replyError) {
            console.error('❌ Error enviando mensaje de error:', replyError);
        }
    }
});

// Manejar mensajes (COMANDOS + XP + ECONOMÍA)
client.on('messageCreate', async (message) => {
    // Ignorar mensajes de bots
    if (message.author.bot) return;
    
    // AGREGAR ESTO AL INICIO:
    const userId = message.author.id;  
        
    // Procesar XP por mensaje (solo en servidores, no en DMs)
    if (message.guild) {
        // Aplicar modificadores de eventos a XP
        //const xpMod = events.applyEventModifiers(message.author.id, economy.config.xpPerMessage, 'message');
        
        const channelId = '1402824824971067442'; // ID del canal de XP (puedes cambiarlo)
        const channel = message.guild.channels.cache.get(channelId);

        const xpResult = await economy.processMessageXp(message.author.id/*, economy.config.xpPerMessage*/);
        
        // Si subió de nivel, notificar
        if (xpResult && xpResult.levelUp && channel) {
            const levelUpEmbed = new EmbedBuilder()
                .setTitle('🎉 ¡Nuevo Nivel!')
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setDescription(`${message.author} alcanzó el **Nivel ${xpResult.newLevel}**`)
                .addFields(
                    { name: '📈 XP Ganada', value: `+${xpResult.xpGained} XP`, inline: true },
                    { name: '🎁 Recompensa', value: `+${xpResult.reward} π-b$`, inline: true },
                    { name: '🏆 Niveles Subidos', value: `${xpResult.levelsGained}`, inline: true },
                    { name: '🎉 Extra por Eventos', value: `${xpResult.eventMessage || "No hay eventos Activos"} `, inline: false }                    
                )
                .setColor('#FFD700')
                .setTimestamp();
                await channel.send({ 
                    content: `<@${message.author.id}>`,
                    embeds: [levelUpEmbed],
                    allowedMentions: { users: [message.author.id] }
                });
        }

        // *** NUEVO: VERIFICAR ACHIEVEMENTS DESPUÉS DE GANAR XP ***
        try {
            const newAchievements = await achievements.checkAchievements(userId);
            if (newAchievements.length > 0) {
                await achievements.notifyAchievements(message, newAchievements);
            }
        } catch (error) {
            console.error('❌ Error verificando logros:', error);
        }

        // *** NUEVO: ACTUALIZAR PROGRESO DE MISIONES ***
        try {
            const completedMissions = await missions.updateMissionProgress(userId, 'message');
            if (completedMissions.length > 0) {
                await missions.notifyCompletedMissions(message, completedMissions);
            }
        } catch (error) {
            console.error('❌ Error actualizando misiones:', error);
        }

        if (message.mentions.users.size > 0) {
            try {
                const mentionsCount = message.mentions.users.size;
                const completedMissions = await missions.updateMissionProgress(userId, 'mention_made', mentionsCount);
                if (completedMissions.length > 0) {
                    await missions.notifyCompletedMissions(message, completedMissions);
                }
            } catch (error) {
                console.error('❌ Error procesando menciones para misiones:', error);
            }
        }
    }

    // Procesar comandos de logros
    await achievements.processCommand(message);

    // Procesar comandos de misiones
    await missions.processCommand(message);

    // Procesar comandos mejorados (shop, betting, etc.)
    await allCommands.processCommand(message);

    // Procesar comandos de tienda
    await shop.processCommand(message);
   
    //Procesar comandos de minijuegos
    await minigames.processCommand(message);
    
    // Luego procesar comandos normales (como !contadores, !reset, etc.)
    await commandHandler.processCommand(message);
});

// Manejo de errores
client.on('error', (error) => {
    console.error('❌ Error del cliente:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled promise rejection:', error);
});

// Proceso de cierre limpio
process.on('SIGINT', () => {
    console.log('\n🔄 Cerrando bot...');
    saveCounters(counters);

    if (economy.db) {
        economy.db.close();
    }
    
    client.destroy();
    process.exit(0);
});

// Iniciar el bot
client.login(process.env.TOKEN).then(() => {
    console.log('🚀 Proceso de login iniciado...');
}).catch(error => {
    console.error('❌ Error en el login:', error);
});