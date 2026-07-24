require('dotenv').config();
const { db, firebaseEnabled } = require('./firebase');

if (!firebaseEnabled) {
  console.error('Firebase no habilitado');
  process.exit(1);
}

(async () => {
  try {
    const snapshot = await db.collection('productos').get();
    console.log('Total documentos en productos:', snapshot.size);
    
    if (snapshot.size > 0) {
      console.log('\nPrimeros 5 documentos:');
      snapshot.docs.slice(0, 5).forEach(doc => {
        console.log(`ID: ${doc.id}`, doc.data());
      });
    }

    const usuariosSnap = await db.collection('usuarios').get();
    console.log('\nTotal documentos en usuarios:', usuariosSnap.size);

    const ventasSnap = await db.collection('ventas').get();
    console.log('Total documentos en ventas:', ventasSnap.size);
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
})();
