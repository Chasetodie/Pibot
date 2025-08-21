const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// 🔧 CONFIGURACIÓN
const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_KEY
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
        type = 'SERIAL PRIMARY KEY';
      } else if (typeof value === 'number') {
        type = Number.isInteger(value) ? 'INTEGER' : 'DECIMAL';
      } else if (typeof value === 'boolean') {
        type = 'BOOLEAN';
      } else if (value instanceof Date) {
        type = 'TIMESTAMP';
      } else if (key.includes('created_at') || key.includes('updated_at')) {
        type = 'TIMESTAMP';
      }
      
      return `${key} ${type}`;
    });

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columns.join(',\n        ')}
      )
    `;

    console.log(`   🏗️  Creando/verificando tabla ${tableName}`);
    await this.renderDB.query(createTableSQL);
  }

  async insertDataInBatches(tableName, data, batchSize = 100) {
    const columns = Object.keys(data[0]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
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
          return value;
        });
        
        await this.renderDB.query(insertSQL, values);
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
  
  // Migrar datos
  await migrator.migrate();
  
  // Verificar migración (opcional)
  await migrator.verifyMigration();
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { DatabaseMigrator };