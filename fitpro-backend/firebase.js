const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const serviceAccountJsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const firebaseEnabled = Boolean(process.env.FIREBASE_ENABLED === 'true' && (serviceAccountPath || serviceAccountBase64 || serviceAccountJsonEnv));
let db = null;

if (firebaseEnabled) {
  let rawServiceAccount = null;

  if (serviceAccountBase64) {
    try {
      const decoded = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
      rawServiceAccount = JSON.parse(decoded);
    } catch (err) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 no es un JSON base64 válido: ' + err.message);
    }
  } else if (serviceAccountJsonEnv) {
    try {
      rawServiceAccount = JSON.parse(serviceAccountJsonEnv);
    } catch (err) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no contiene JSON válido: ' + err.message);
    }
  } else {
    const resolvedPath = path.resolve(serviceAccountPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH no existe: ${resolvedPath}`);
    }

    rawServiceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }
  const privateKey = rawServiceAccount.private_key
    ? String(rawServiceAccount.private_key).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
    : null;

  if (!privateKey || !privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('FIREBASE service account JSON no contiene una private_key válida. Descarga un nuevo archivo JSON desde Firebase Console.');
  }

  const serviceAccount = {
    ...rawServiceAccount,
    private_key: privateKey,
  };
  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  } catch (err) {
    throw new Error(`Error inicializando Firebase Admin: ${err.message}`);
  }
  db = admin.firestore();
}

function toTimestamp(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date for Firestore timestamp');
  }
  return admin.firestore.Timestamp.fromDate(date);
}

function normalizeFirestoreValue(value) {
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeFirestoreValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, innerValue]) => [key, normalizeFirestoreValue(innerValue)])
    );
  }
  return value;
}

async function getDocumentRefByIdOrLegacyId(collectionName, id) {
  if (!firebaseEnabled) return null;
  const inputId = String(id);
  const directRef = db.collection(collectionName).doc(inputId);
  const directSnap = await directRef.get();
  if (directSnap.exists) return directRef;

  const numericId = Number(id);
  if (!Number.isNaN(numericId)) {
    const querySnapshot = await db.collection(collectionName)
      .where('old_id', '==', numericId)
      .limit(1)
      .get();
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].ref;
    }
  }

  return null;
}

async function getUserByUsername(username) {
  if (!firebaseEnabled) return null;
  const lower = String(username).trim().toLowerCase();
  const usersRef = db.collection('usuarios');
  const fullNameQuery = await usersRef.where('full_name_lower', '==', lower).limit(1).get();
  if (!fullNameQuery.empty) return fullNameQuery.docs[0];
  const firstNameQuery = await usersRef.where('first_name_lower', '==', lower).limit(1).get();
  if (!firstNameQuery.empty) return firstNameQuery.docs[0];
  const lastNameQuery = await usersRef.where('last_name_lower', '==', lower).limit(1).get();
  if (!lastNameQuery.empty) return lastNameQuery.docs[0];
  return null;
}

module.exports = {
  firebaseEnabled,
  admin,
  db,
  toTimestamp,
  normalizeFirestoreValue,
  getDocumentRefByIdOrLegacyId,
  getUserByUsername,
};
