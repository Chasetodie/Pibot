// admin-panel.js - Panel de administración para la base de datos
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

module.exports = (app) => {
    // Middleware
    app.use(require('express').json());

    // Autenticación simple (usa una clave secreta)
    const ADMIN_KEY = process.env.ADMIN_KEY || 'blackoutbc17';

    function authMiddleware(req, res, next) {
        const key = req.headers.authorization || req.query.key;
        if (key !== ADMIN_KEY) {
            return res.status(401).json({ error: 'No autorizado' });
        }
        next();
    }

    // Ruta principal del panel (modificar la existente)
    app.get('/admin', (req, res) => {
        res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bot Admin Panel</title>
            <style>
                body { font-family: Arial; margin: 20px; background: #2c2f33; color: white; }
                .container { max-width: 1200px; margin: 0 auto; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #36393f; }
                th, td { padding: 12px; border: 1px solid #555; text-align: left; }
                th { background: #5865f2; }
                button { padding: 10px 20px; background: #5865f2; color: white; border: none; cursor: pointer; margin: 5px; }
                input { padding: 8px; margin: 5px; background: #40444b; color: white; border: 1px solid #555; }
                .section { margin: 30px 0; padding: 20px; background: #36393f; border-radius: 8px; }
                textarea { width: 100%; height: 100px; background: #40444b; color: white; border: 1px solid #555; padding: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Bot Database Admin Panel</h1>
                
                <div class="section">
                    <h3>Autenticación</h3>
                    <input type="password" id="adminKey" placeholder="Clave de administrador">
                    <button onclick="setAuth()">Conectar</button>
                    <span id="authStatus"></span>
                </div>
                
                <div class="section">
                    <h3>Tablas de la Base de Datos</h3>
                    <button onclick="loadTables()">Cargar Tablas</button>
                    <div id="tablesContainer"></div>
                </div>
                
                <div class="section">
                    <h3>Ejecutar Query SQL</h3>
                    <textarea id="sqlQuery" placeholder="SELECT * FROM users;"></textarea>
                    <br>
                    <button onclick="executeQuery()">Ejecutar</button>
                    <div id="queryResult"></div>
                </div>
                
                <div class="section">
                    <h3>Estadísticas Rápidas</h3>
                    <button onclick="loadStats()">Cargar Estadísticas</button>
                    <div id="statsContainer"></div>
                </div>
            </div>

            <script>
                let authKey = '';
                
                function setAuth() {
                    authKey = document.getElementById('adminKey').value;
                    document.getElementById('authStatus').innerHTML = '✅ Conectado';
                    loadTables();
                }
                
                async function loadTables() {
                    try {
                        const response = await fetch('/api/tables', {
                            headers: { 'Authorization': authKey }
                        });
                        const data = await response.json();
                        
                        let html = '<h4>Tablas disponibles:</h4>';
                        data.tables.forEach(table => {
                            html += \`<button onclick="loadTable('\${table.name}')">\${table.name}</button>\`;
                        });
                        document.getElementById('tablesContainer').innerHTML = html;
                    } catch (error) {
                        alert('Error cargando tablas: ' + error.message);
                    }
                }
                
                async function loadTable(tableName) {
                    try {
                        const response = await fetch(\`/api/table/\${tableName}\`, {
                            headers: { 'Authorization': authKey }
                        });
                        const data = await response.json();
                        
                        let html = \`<h4>Tabla: \${tableName}</h4><table><thead><tr>\`;
                        if (data.rows.length > 0) {
                            Object.keys(data.rows[0]).forEach(key => {
                                html += \`<th>\${key}</th>\`;
                            });
                            html += '</tr></thead><tbody>';
                            
                            data.rows.forEach(row => {
                                html += '<tr>';
                                Object.values(row).forEach(value => {
                                    html += \`<td>\${value}</td>\`;
                                });
                                html += '</tr>';
                            });
                        }
                        html += '</tbody></table>';
                        document.getElementById('tablesContainer').innerHTML += html;
                    } catch (error) {
                        alert('Error cargando tabla: ' + error.message);
                    }
                }
                
                async function executeQuery() {
                    const query = document.getElementById('sqlQuery').value;
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
                        
                        let html = '<h4>Resultado:</h4>';
                        if (data.rows && data.rows.length > 0) {
                            html += '<table><thead><tr>';
                            Object.keys(data.rows[0]).forEach(key => {
                                html += \`<th>\${key}</th>\`;
                            });
                            html += '</tr></thead><tbody>';
                            data.rows.forEach(row => {
                                html += '<tr>';
                                Object.values(row).forEach(value => {
                                    html += \`<td>\${value}</td>\`;
                                });
                                html += '</tr>';
                            });
                            html += '</tbody></table>';
                        } else {
                            html += \`<p>Query ejecutado. Afectó \${data.changes || 0} filas.</p>\`;
                        }
                        document.getElementById('queryResult').innerHTML = html;
                    } catch (error) {
                        alert('Error ejecutando query: ' + error.message);
                    }
                }
                
                async function loadStats() {
                    try {
                        const response = await fetch('/api/stats', {
                            headers: { 'Authorization': authKey }
                        });
                        const data = await response.json();
                        document.getElementById('statsContainer').innerHTML = \`
                            <p><strong>Total de tablas:</strong> \${data.tableCount}</p>
                            <p><strong>Tamaño de DB:</strong> \${data.dbSize}</p>
                            <p><strong>Última actualización:</strong> \${new Date().toLocaleString()}</p>
                        \`;
                    } catch (error) {
                        alert('Error cargando estadísticas: ' + error.message);
                    }
                }
            </script>
        </body>
        </html>
        `);
    });

    // API Routes
    app.get('/api/tables', authMiddleware, (req, res) => {
        const db = new sqlite3.Database('./bot_data.db');
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ tables: rows });
            }
            db.close();
        });
    });

    app.get('/api/table/:name', authMiddleware, (req, res) => {
        const tableName = req.params.name;
        const db = new sqlite3.Database('./bot_data.db');
        db.all(`SELECT * FROM ${tableName} LIMIT 100`, (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ rows });
            }
            db.close();
        });
    });

    app.post('/api/query', authMiddleware, (req, res) => {
        const { query } = req.body;
        const db = new sqlite3.Database('./bot_data.db');
        
        // Determinar si es SELECT o no
        const isSelect = query.trim().toLowerCase().startsWith('select');
        
        if (isSelect) {
            db.all(query, (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    res.json({ rows });
                }
                db.close();
            });
        } else {
            db.run(query, function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    res.json({ changes: this.changes });
                }
                db.close();
            });
        }
    });

    app.get('/api/stats', authMiddleware, (req, res) => {
        const db = new sqlite3.Database('./bot_data.db');
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                const stats = fs.statSync('./bot_data.db');
                res.json({ 
                    tableCount: rows.length,
                    dbSize: `${(stats.size / 1024).toFixed(2)} KB`
                });
            }
            db.close();
        });
    });

    console.log('🌐 Panel de administración disponible en /admin');
};