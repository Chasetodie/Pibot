// migration-script.js
// Ejecuta esto cuando Firebase se resetee mañana

require('dotenv').config(); // ← AGREGAR ESTA LÍNEA

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Configurar Firebase con verificación
try {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error('❌ Variables de Firebase no encontradas. Agrega las credenciales a tu .env');
    }

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
    
    console.log('🔥 Firebase conectado para migración');
} catch (error) {
    console.error('❌ Error conectando Firebase:', error.message);
    console.log('💡 Asegúrate de tener estas variables en tu .env:');
    console.log('   FIREBASE_PROJECT_ID=tu-project-id');
    console.log('   FIREBASE_CLIENT_EMAIL=tu-client-email');
    console.log('   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..."');
    process.exit(1);
}

// Configurar Supabase
const supabase = createClient(
    'https://jotxxdbjysndrhpbxeox.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdHh4ZGJqeXNuZHJocGJ4ZW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMzM4OTUsImV4cCI6MjA3MDcwOTg5NX0.RnzSBxRNa7lfvhTLKHjMG_y_CAYnOKYweOsDMLwj7sE'
);

console.log('🚀 Supabase conectado para migración');

async function migrarUsuarios() {
    try {
        console.log('🔄 Iniciando migración...');
        
        // Verificar conexión a Supabase
        const { data: testConnection } = await supabase.from('users').select('count', { count: 'exact', head: true });
        console.log('✅ Conexión a Supabase verificada');
        
        // Obtener todos los usuarios de Firebase
        const snapshot = await admin.firestore().collection('users').get();
        console.log(`📊 Encontrados ${snapshot.size} usuarios en Firebase`);
        
        if (snapshot.empty) {
            console.log('⚠️ No hay usuarios para migrar');
            return;
        }
        
        const usuariosParaMigrar = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            console.log(`👤 Procesando usuario: ${doc.id}`);
            
            // Convertir formato Firebase → Supabase
            const usuarioSupabase = {
                id: doc.id,
                balance: data.balance || 0,
                level: data.level || 1,
                xp: data.xp || 0,
                total_xp: data.totalXp || 0,
                last_daily: data.lastDaily || 0,
                last_work: data.lastWork || 0,
                last_robbery: data.lastRobbery || 0,
                last_coinflip: data.lastCoinflip || 0,
                last_dice: data.lastDice || 0,
                last_roulette: data.lastRoulette || 0,
                last_lotto: data.lastLotto || 0,
                last_blackjack: data.lastBlackJack || 0,
                last_name_work: data.lastNameWork || "",
                messages_count: data.messagesCount || 0,
                items: data.items || {},
                stats: data.stats || {},
                bet_stats: data.betStats || {},
                daily_missions: data.daily_missions || {},
                daily_missions_date: data.daily_missions_date || null,
                daily_stats: data.daily_stats || {},
                created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                updated_at: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
            };
            
            usuariosParaMigrar.push(usuarioSupabase);
        });
        
        console.log(`📦 Preparando ${usuariosParaMigrar.length} usuarios para migrar`);
        
        // Migrar en lotes de 50 (más pequeño para evitar errores)
        const loteSize = 50;
        let migradosTotal = 0;
        
        for (let i = 0; i < usuariosParaMigrar.length; i += loteSize) {
            const lote = usuariosParaMigrar.slice(i, i + loteSize);
            const numeroLote = Math.floor(i/loteSize) + 1;
            
            console.log(`📤 Migrando lote ${numeroLote} (${lote.length} usuarios)...`);
            
            try {
                const { data, error } = await supabase
                    .from('users')
                    .insert(lote);
                    
                if (error) {
                    console.error(`❌ Error en lote ${numeroLote}:`, error);
                    
                    // Intentar insertar uno por uno para identificar el problemático
                    console.log('🔍 Intentando inserción individual...');
                    for (const usuario of lote) {
                        try {
                            const { error: individualError } = await supabase
                                .from('users')
                                .insert([usuario]);
                            
                            if (individualError) {
                                console.error(`❌ Error con usuario ${usuario.id}:`, individualError);
                            } else {
                                console.log(`✅ Usuario ${usuario.id} migrado individualmente`);
                                migradosTotal++;
                            }
                        } catch (individualError) {
                            console.error(`❌ Error grave con usuario ${usuario.id}:`, individualError);
                        }
                    }
                } else {
                    console.log(`✅ Lote ${numeroLote} migrado exitosamente (${lote.length} usuarios)`);
                    migradosTotal += lote.length;
                }
            } catch (loteError) {
                console.error(`❌ Error grave en lote ${numeroLote}:`, loteError);
            }
            
            // Pequeña pausa entre lotes
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`🎉 ¡Migración completada!`);
        console.log(`📊 Total migrados: ${migradosTotal}/${usuariosParaMigrar.length} usuarios`);
        
        // Verificar migración
        const { count } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });
            
        console.log(`✅ Verificación: ${count} usuarios en Supabase`);
        
    } catch (error) {
        console.error('❌ Error general en la migración:', error);
    }
}

// Ejecutar migración
migrarUsuarios();
