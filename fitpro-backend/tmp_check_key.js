const fs = require('fs');
const path = require('path');
const keyFile = path.join(__dirname, 'serviceAccountKey.json');
const data = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
const key = data.private_key;
console.log('length', key.length);
console.log('containsCR', key.includes('\r'));
console.log('startsWith', key.slice(0, 30));
console.log('endsWith', key.slice(-30));
const crypto = require('crypto');
for (const type of ['pkcs8', 'pkcs1']) {
  try {
    const obj = crypto.createPrivateKey({ key, format: 'pem', type });
    console.log(`parsed algorithm (${type})`, obj.asymmetricKeyType);
  } catch (err) {
    console.error(`parse error (${type})`, err.message);
  }
}
const keyBody = key.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\r/g, '').replace(/\n/g, '');
const buf = Buffer.from(keyBody, 'base64');
console.log('decoded bytes len', buf.length);
console.log('decoded bytes prefix', buf.slice(0, 20).toString('hex'));
console.log('first 5 chars codes', Array.from(key.slice(0, 5)).map(c => c.charCodeAt(0)));
console.log('header line length', key.split('\n')[0].length);
console.log('trimming equal?', key.slice(0, 26) === '-----BEGIN PRIVATE KEY-----');
console.log('has weird chars at start', key.slice(0, 10).split('').map(c => c.charCodeAt(0)));
try {
  const obj2 = crypto.createPrivateKey({ key: Buffer.from(keyBody, 'base64'), format: 'der', type: 'pkcs8' });
  console.log('parsed der pkcs8', obj2.asymmetricKeyType);
} catch (err) {
  console.error('parse der pkcs8 error', err.message);
}
try {
  const obj3 = crypto.createPrivateKey({ key: Buffer.from(keyBody, 'base64'), format: 'der', type: 'pkcs1' });
  console.log('parsed der pkcs1', obj3.asymmetricKeyType);
} catch (err) {
  console.error('parse der pkcs1 error', err.message);
}
