const crypto = require('crypto');

// TDI Section 4: AES-256-CBC, PKCS7 padding, key = SHA-256(secret), 16-byte random
// IV prepended to the ciphertext, whole thing Base64-encoded.

function deriveKey(secret) {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function aesEncrypt(plainObj, secret) {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(plainObj), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]).toString('base64');
}

function aesDecrypt(base64Payload, secret) {
  const key = deriveKey(secret);
  const raw = Buffer.from(base64Payload, 'base64');
  const iv = raw.subarray(0, 16);
  const encrypted = raw.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

module.exports = { aesEncrypt, aesDecrypt, deriveKey };
