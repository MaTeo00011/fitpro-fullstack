const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json');
console.log('serviceAccountPath', serviceAccountPath);
const rawRequire = require(serviceAccountPath);
const rawFs = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
const logs = [
  { source: 'require', len: rawRequire.private_key.length, slice: rawRequire.private_key.slice(0, 30), ends: rawRequire.private_key.slice(-30) },
  { source: 'fs', len: rawFs.private_key.length, slice: rawFs.private_key.slice(0, 30), ends: rawFs.private_key.slice(-30) },
];
console.log(JSON.stringify(logs, null, 2));
console.log('require first 10 codes', Array.from(rawRequire.private_key.slice(0, 10)).map(c => c.charCodeAt(0)));
console.log('fs first 10 codes', Array.from(rawFs.private_key.slice(0, 10)).map(c => c.charCodeAt(0)));
const key = rawFs.private_key.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
console.log('normalized len', key.length);
const crypto = require('crypto');
try {
  const obj = crypto.createPrivateKey({ key, format: 'pem' });
  console.log('crypto parsed PEM ok', obj.asymmetricKeyType);
} catch (err) {
  console.error('crypto parse pem error', err.message);
}
try {
  const body = key.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\r/g, '').replace(/\n/g, '');
  const buf = Buffer.from(body, 'base64');
  const obj2 = crypto.createPrivateKey({ key: buf, format: 'der', type: 'pkcs8' });
  console.log('crypto parsed DER ok', obj2.asymmetricKeyType);
} catch (err) {
  console.error('crypto parse der error', err.message);
}
