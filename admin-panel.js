// Instalar: npm install express pg
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

// Crear servidor web
const app = express();
const port = process.env.PORT || 3000;

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

// Manejo de errores globales
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`🌐 Panel de administración PostgreSQL disponible en puerto ${port}`);
    console.log(`🐘 Conectado a PostgreSQL en Render.com`);
});

module.exports = app;