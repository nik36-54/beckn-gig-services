const crypto = require('crypto');

/**
 * Generates an RSA-2048 keypair. In this demo, this is what it means for a
 * worker (or a seeker) to "create a decentralized identity": a keypair that
 * lives with them, not with any platform.
 */
function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

/**
 * Deterministic JSON stringify (keys sorted recursively) so the same object
 * always produces the same bytes to sign/verify, regardless of key order.
 */
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeys(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function canonical(data) {
  return JSON.stringify(sortKeys(data));
}

/** Sign a JS object with a PEM private key. Returns a base64 signature. */
function signData(data, privateKeyPem) {
  const signer = crypto.createSign('SHA256');
  signer.update(canonical(data));
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

/** Verify a JS object + base64 signature against a PEM public key. */
function verifyData(data, signatureBase64, publicKeyPem) {
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(canonical(data));
    verifier.end();
    return verifier.verify(publicKeyPem, signatureBase64, 'base64');
  } catch (err) {
    return false;
  }
}

module.exports = { generateKeyPair, signData, verifyData, canonical };
