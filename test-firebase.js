const EconomySystem = require('./economy');

async function testFirebase() {
    console.log('🧪 Probando conexión a Firebase...');
    
    try {
        const economy = new EconomySystem();
        
        // Probar crear usuario
        const testUser = await economy.getUser('test123');
        console.log('✅ Usuario de prueba creado:', testUser);
        
        // Probar dar XP
        const result = await economy.addXp('test123', 50, 'test');
        console.log('✅ XP agregado:', result);
        
        console.log('🎉 ¡Firebase funciona correctamente!');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testFirebase();