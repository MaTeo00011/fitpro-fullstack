/*
Script de migración PostgreSQL -> Firestore
Uso:
  1. Coloca el service account JSON en la ruta indicada por `FIREBASE_SERVICE_ACCOUNT_PATH` en tu `.env`.
  2. Instala dependencias: `npm install firebase-admin dotenv`
  3. Ejecuta desde `fitpro-backend`: `node scripts/migrate_pg_to_firestore.js`

Advertencia: Ejecuta en un entorno de pruebas primero y mantén backup de PostgreSQL.
*/

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../db');
const { db, toTimestamp, firebaseEnabled } = require('../firebase');

if (!firebaseEnabled) {
  console.error('Firebase no está habilitado. Ajusta FIREBASE_ENABLED=true y configura FIREBASE_SERVICE_ACCOUNT_PATH en .env');
  process.exit(1);
}

async function batchWrite(collectionRef, docs) {
  const BATCH_SIZE = 400; // margen a 500
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = docs.slice(i, i + BATCH_SIZE);
    slice.forEach(doc => {
      const id = doc._id || String(doc.old_id || doc.id || collectionRef.doc().id);
      const docRef = collectionRef.doc(String(id));
      const copy = Object.assign({}, doc);
      delete copy._id; delete copy.id; delete copy.old_id;
      batch.set(docRef, copy, { merge: true });
    });
    await batch.commit();
  }
}

async function migrateGimnasios() {
  console.log('Migrando gimnasios...');
  const res = await pool.query('SELECT * FROM gimnasios');
  const docs = res.rows.map(r => ({
    old_id: r.id,
    nombre: r.nombre,
    email: r.email,
    password_hash: r.password_hash,
    plan: r.plan,
    trial_end: toTimestamp(r.trial_end),
    activo: r.activo,
    created_at: toTimestamp(r.created_at),
    updated_at: toTimestamp(r.updated_at),
  }));
  await batchWrite(db.collection('gimnasios'), docs);
}

async function migrateUsuarios() {
  console.log('Migrando usuarios...');
  const res = await pool.query('SELECT * FROM usuarios');
  for (const r of res.rows) {
    const firstName = r.first_name || '';
    const lastName = r.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const uid = String(r.id);
    const docRef = db.collection('usuarios').doc(uid);
    await docRef.set({
      old_id: r.id,
      gimnasio_id: r.gimnasio_id,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      first_name_lower: firstName.toLowerCase(),
      last_name_lower: lastName.toLowerCase(),
      full_name_lower: fullName.toLowerCase(),
      age: r.age,
      phone: r.phone,
      training_type: r.training_type,
      personalized_type: r.personalized_type,
      payment_type: r.payment_type,
      payment_start: toTimestamp(r.payment_start),
      payment_end: toTimestamp(r.payment_end),
      status: r.status,
      created_at: toTimestamp(r.created_at),
      updated_at: toTimestamp(r.updated_at),
    }, { merge: true });
  }
}

async function migrateProductos() {
  console.log('Migrando productos...');
  const res = await pool.query('SELECT * FROM productos');
  const docs = res.rows.map(r => ({
    old_id: r.id,
    gimnasio_id: r.gimnasio_id,
    name: r.name,
    description: r.description,
    price: Number(r.price),
    currency: r.currency,
    stock: r.stock,
    icon: r.icon,
    image: r.image,
    category: r.category,
    created_at: toTimestamp(r.created_at),
    updated_at: toTimestamp(r.updated_at),
  }));
  await batchWrite(db.collection('productos'), docs);
}

async function migrateRutinasAndEjercicios() {
  console.log('Migrando rutinas y ejercicios...');
  const res = await pool.query('SELECT * FROM rutinas');
  for (const r of res.rows) {
    const rutinaDoc = {
      old_id: r.id,
      usuario_id: r.usuario_id,
      name: r.name,
      description: r.description,
      fecha: toTimestamp(r.fecha),
      created_at: toTimestamp(r.created_at),
      updated_at: toTimestamp(r.updated_at),
    };
    // guardar en subcolección de usuario: usuarios/{uid}/rutinas/{rid}
    const uid = String(r.usuario_id);
    const rutRef = db.collection('usuarios').doc(uid).collection('rutinas').doc(String(r.id));
    await rutRef.set(rutinaDoc);

    // migrar ejercicios asociados
    const ejerRes = await pool.query('SELECT * FROM ejercicios WHERE rutina_id = $1', [r.id]);
    const batch = db.batch();
    ejerRes.rows.forEach(e => {
      const eRef = rutRef.collection('ejercicios').doc(String(e.id));
      batch.set(eRef, {
        old_id: e.id,
        name: e.name,
        series: e.series,
        repeticiones: e.repeticiones,
        peso: e.peso !== null ? Number(e.peso) : null,
        fecha: toTimestamp(e.fecha),
        created_at: toTimestamp(e.created_at),
        updated_at: toTimestamp(e.updated_at),
      });
    });
    if (ejerRes.rows.length) await batch.commit();
  }
}

async function migrateProgreso() {
  console.log('Migrando progreso...');
  const res = await pool.query('SELECT * FROM progreso');
  for (const p of res.rows) {
    const uid = String(p.usuario_id);
    const coll = db.collection('usuarios').doc(uid).collection('progreso');
    await coll.doc(String(p.id)).set({
      old_id: p.id,
      peso: Number(p.peso),
      fecha: toTimestamp(p.fecha),
      created_at: toTimestamp(p.created_at),
    });
  }
}

async function migrateVentas() {
  console.log('Migrando ventas y venta_items...');
  const res = await pool.query('SELECT * FROM ventas');
  for (const v of res.rows) {
    const vid = String(v.id);
    const vRef = db.collection('ventas').doc(vid);
    await vRef.set({
      old_id: v.id,
      usuario_id: v.usuario_id,
      customer_email: v.customer_email,
      customer_name: v.customer_name,
      phone: v.phone,
      city: v.city,
      address: v.address,
      payment_method: v.payment_method,
      total: Number(v.total),
      shipping_cost: Number(v.shipping_cost),
      currency: v.currency,
      created_at: toTimestamp(v.created_at),
    });
    const itemsRes = await pool.query('SELECT * FROM venta_items WHERE venta_id = $1', [v.id]);
    if (itemsRes.rows.length) {
      const batch = db.batch();
      itemsRes.rows.forEach(it => {
        const itRef = vRef.collection('venta_items').doc(String(it.id));
        batch.set(itRef, {
          old_id: it.id,
          producto_id: it.producto_id,
          name: it.name,
          quantity: it.quantity,
          price: Number(it.price),
          currency: it.currency,
          created_at: toTimestamp(it.created_at),
        });
      });
      await batch.commit();
    }
  }
}

async function main() {
  try {
    await migrateGimnasios();
    await migrateUsuarios();
    await migrateProductos();
    await migrateRutinasAndEjercicios();
    await migrateProgreso();
    await migrateVentas();
    console.log('Migración completada.');
    process.exit(0);
  } catch (err) {
    console.error('Error en migración:', err);
    process.exit(1);
  }
}

main();
