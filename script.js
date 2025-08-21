const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// 🔧 CONFIGURACIÓN
const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_ANON_KEY
};

const RENDER_CONFIG = {
  connectionString: process.env.DATABASE_URL
  // O usa la Internal Database URL completa de Render
};

// 📊 TABLAS A MIGRAR (ajusta según tu esquema)
const TABLES_TO_MIGRATE = [
  'users',
  'auctions', 
  'bets',
  'russian_game',
  'server_events',
  'trades',
  'uno_games'
  // Agrega tus tablas aquí
];

class DatabaseMigrator {
  constructor() {
    this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    this.renderDB = new Pool({ connectionString: RENDER_CONFIG.connectionString });
  }

  async migrate() {
    console.log('🚀 Iniciando migración de Supabase a Render...\n');
    
    try {
      // Probar conexiones
      await this.testConnections();
      
      // Migrar cada tabla
      for (const tableName of TABLES_TO_MIGRATE) {
        await this.migrateTable(tableName);
      }
      
      console.log('✅ ¡Migración completada exitosamente!');
      
    } catch (error) {
      console.error('❌ Error en la migración:', error);
    } finally {
      await this.renderDB.end();
    }
  }

  async testConnections() {
    console.log('🔍 Probando conexiones...');
    
    // Probar Supabase
    const { data, error } = await this.supabase
      .from(TABLES_TO_MIGRATE[0])
      .select('*')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = tabla no encontrada
      throw new Error(`Error conectando a Supabase: ${error.message}`);
    }
    
    // Probar Render PostgreSQL
    await this.renderDB.query('SELECT NOW()');
    
    console.log('✅ Conexiones establecidas\n');
  }

  async migrateTable(tableName) {
    console.log(`📦 Migrando tabla: ${tableName}`);
    
    try {
      // 1. Obtener datos de Supabase
      const { data: supabaseData, error } = await this.supabase
        .from(tableName)
        .select('*');

      if (error) {
        console.log(`⚠️  Tabla ${tableName} no encontrada en Supabase, saltando...`);
        return;
      }

      if (!supabaseData || supabaseData.length === 0) {
        console.log(`📭 Tabla ${tableName} está vacía`);
        return;
      }

      console.log(`   📊 ${supabaseData.length} registros encontrados`);

      // 2. Crear tabla en Render si no existe
      await this.createTableIfNotExists(tableName, supabaseData[0]);

      // 3. Limpiar tabla destino (opcional)
      await this.renderDB.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);

      // 4. Insertar datos en lotes
      await this.insertDataInBatches(tableName, supabaseData);

      console.log(`✅ Tabla ${tableName} migrada exitosamente\n`);

    } catch (error) {
      console.error(`❌ Error migrando ${tableName}:`, error.message);
    }
  }

  async createTableIfNotExists(tableName, sampleRow) {
    const columns = Object.keys(sampleRow).map(key => {
      const value = sampleRow[key];
      let type = 'TEXT';
      
      if (key === 'id') {
        // Para IDs grandes de Telegram/Discord, usar BIGINT
        if (typeof value === 'string' || (typeof value === 'number' && value > 2147483647)) {
          type = 'BIGINT PRIMARY KEY';
        } else {
          type = 'SERIAL PRIMARY KEY';
        }
      } else if (key.includes('user_id') || key.includes('chat_id') || key.includes('_id')) {
        // IDs externos también pueden ser muy grandes
        type = 'BIGINT';
      } else if (key.includes('is_') || key.includes('has_') || key.includes('active') || key.includes('special')) {
        // Campos booleanos
        type = 'BOOLEAN DEFAULT FALSE';
      } else if (key.includes('_at') || key.includes('date') || key.includes('time')) {
        // Campos de fecha/hora
        type = 'TIMESTAMP';
      } else if (key.includes('amount') || key.includes('balance') || key.includes('price') || key.includes('cost')) {
        // Campos monetarios/numéricos decimales
        type = 'NUMERIC(15,2)';
      } else if (key.includes('count') || key.includes('level') || key.includes('rank')) {
        // Campos enteros
        type = 'INTEGER DEFAULT 0';
      } else if (typeof value === 'number') {
        // Números grandes usar BIGINT, decimales usar NUMERIC
        if (Number.isInteger(value) && value > 2147483647) {
          type = 'BIGINT';
        } else if (Number.isInteger(value)) {
          type = 'INTEGER';
        } else {
          type = 'NUMERIC';
        }
      } else if (typeof value === 'boolean') {
        type = 'BOOLEAN DEFAULT FALSE';
      } else if (value instanceof Date) {
        type = 'TIMESTAMP';
      } else if (typeof value === 'string' && value.length > 255) {
        type = 'TEXT';
      } else if (typeof value === 'string') {
        type = 'VARCHAR(255)';
      }
      
      return `"${key}" ${type}`;
    });

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        ${columns.join(',\n        ')}
      )
    `;

    console.log(`   🏗️  Creando/verificando tabla ${tableName}`);
    console.log(`   🔧  Esquema detectado:`);
    columns.forEach(col => console.log(`      ${col}`));
    await this.renderDB.query(createTableSQL);
  }

  async insertDataInBatches(tableName, data, batchSize = 100) {
    const columns = Object.keys(data[0]);
    const placeholders = columns.map((_, i) => `${i + 1}`).join(', ');
    
    const insertSQL = `
      INSERT INTO ${tableName} (${columns.join(', ')}) 
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET
      ${columns.filter(col => col !== 'id').map(col => `${col} = EXCLUDED.${col}`).join(', ')}
    `;

    console.log(`   💾 Insertando datos en lotes de ${batchSize}...`);

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      for (const row of batch) {
        const values = columns.map(col => {
          let value = row[col];
          
          // Convertir fechas ISO string a objetos Date
          if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
            value = new Date(value);
          }
          
          // Convertir IDs grandes de string a number si es posible
          if (col === 'id' || col.includes('_id') || col.includes('user_id') || col.includes('chat_id')) {
            if (typeof value === 'string' && /^\d+$/.test(value)) {
              value = value; // Mantener como string para BIGINT
            }
          }
          
          // Limpiar valores que no pueden ser integers
          if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') {
            // Solo convertir si parece un número válido
            if (/^\d+$/.test(value.trim())) {
              value = value.trim();
            }
          }
          
          // Manejar valores que no son números pero están en campos numéricos
          if (typeof value === 'string' && col.includes('amount') || col.includes('balance') || col.includes('price')) {
            if (!/^\d+(\.\d+)?$/.test(value)) {
              console.log(`   ⚠️  Valor no numérico en campo ${col}: ${value}, usando 0`);
              value = 0;
            }
          }
          
          return value;
        });
        
        try {
          await this.renderDB.query(insertSQL, values);
        } catch (error) {
          console.error(`   ❌ Error insertando fila:`, error.message);
          console.error(`   📄 Datos problemáticos:`, row);
          
          // Intentar inserción más permisiva sin conflictos
          const simpleInsert = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
          try {
            await this.renderDB.query(simpleInsert, values);
            console.log(`   ✅ Inserción simple exitosa`);
          } catch (simpleError) {
            console.error(`   ❌ Falló inserción simple también:`, simpleError.message);
          }
        }
      }
      
      console.log(`   ⏳ Procesados ${Math.min(i + batchSize, data.length)}/${data.length} registros`);
    }
  }

  // 🔍 MÉTODO OPCIONAL: Verificar migración
  async verifyMigration() {
    console.log('🔍 Verificando migración...\n');
    
    for (const tableName of TABLES_TO_MIGRATE) {
      try {
        // Contar en Supabase
        const { count: supabaseCount } = await this.supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        // Contar en Render
        const renderResult = await this.renderDB.query(`SELECT COUNT(*) FROM ${tableName}`);
        const renderCount = parseInt(renderResult.rows[0].count);

        console.log(`📊 ${tableName}: Supabase=${supabaseCount} | Render=${renderCount} ${supabaseCount === renderCount ? '✅' : '❌'}`);
        
      } catch (error) {
        console.log(`⚠️  Error verificando ${tableName}: ${error.message}`);
      }
    }
  }
}

// 🚀 EJECUTAR MIGRACIÓN
async function runMigration() {
  const migrator = new DatabaseMigrator();
  
  try {
    // Migrar datos
    await migrator.migrate();
    
    // Verificar migración (opcional)
    await migrator.verifyMigration();
  } catch (error) {
    console.error('💥 Error fatal en migración:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { DatabaseMigrator };
module.exports = { DatabaseMigrator };
