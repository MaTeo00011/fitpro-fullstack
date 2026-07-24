require('dotenv').config();
const { db, firebaseEnabled, normalizeFirestoreValue } = require('./firebase');

if (!firebaseEnabled) {
  console.error('Firebase no habilitado');
  process.exit(1);
}

(async () => {
  try {
    console.log('Test 1: Query simple sin ordenar');
    const snap1 = await db.collection('productos').get();
    console.log('Total sin orden:', snap1.size);
    snap1.docs.forEach(doc => console.log('  -', doc.id, doc.data()));

    console.log('\nTest 2: Query con orderBy(old_id)');
    try {
      const snap2 = await db.collection('productos').orderBy('old_id').get();
      console.log('Total con orden:', snap2.size);
      snap2.docs.forEach(doc => console.log('  -', doc.id, doc.data()));
    } catch (orderError) {
      console.error('OrderBy error:', orderError.message);
    }

    console.log('\nTest 3: Normalize test');
    const snap3 = await db.collection('productos').limit(1).get();
    if (snap3.size > 0) {
      const raw = snap3.docs[0].data();
      const normalized = normalizeFirestoreValue(raw);
      console.log('Raw:', raw);
      console.log('Normalized:', normalized);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
})();
