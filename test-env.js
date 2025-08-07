require('dotenv').config();
const admin = require('firebase-admin');

console.log('🧪 Probando inicialización de Firebase...');

try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });

    console.log('✅ Firebase inicializado correctamente');
    console.log('📊 Proyecto:', process.env.FIREBASE_PROJECT_ID);
    
    // Test simple de Firestore
    const db = admin.firestore();
    console.log('✅ Firestore conectado');
    
} catch (error) {
    console.error('❌ Error:', error.message);
}