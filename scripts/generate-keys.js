const fs = require('fs');
const path = require('path');
const { generateKeyPair } = require('../packages/identity-utils');

const DATA_DIR = path.join(__dirname, '..', 'data');
const workers = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'workers-seed.json'), 'utf8'));

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const workerPublicKeys = {};

workers.forEach((w) => {
  const { publicKey, privateKey } = generateKeyPair();
  const dir = path.join(DATA_DIR, 'keys', 'workers', w.id);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'private.pem'), privateKey);
  fs.writeFileSync(path.join(dir, 'public.pem'), publicKey);
  workerPublicKeys[w.id] = publicKey;
});

// One demo "seeker" identity, representing whoever is using the BAP to hire
// and rate workers. In a real deployment, every seeker would have their own.
const SEEKER_ID = 'seeker_demo';
const seekerPair = generateKeyPair();
const seekerDir = path.join(DATA_DIR, 'keys', 'seekers', SEEKER_ID);
ensureDir(seekerDir);
fs.writeFileSync(path.join(seekerDir, 'private.pem'), seekerPair.privateKey);
fs.writeFileSync(path.join(seekerDir, 'public.pem'), seekerPair.publicKey);

fs.writeFileSync(
  path.join(DATA_DIR, 'public-keys.json'),
  JSON.stringify(workerPublicKeys, null, 2)
);
fs.writeFileSync(
  path.join(DATA_DIR, 'seeker-public-keys.json'),
  JSON.stringify({ [SEEKER_ID]: seekerPair.publicKey }, null, 2)
);

console.log(`Generated keypairs for ${workers.length} workers -> data/keys/workers/<id>/`);
console.log(`Generated 1 demo seeker identity -> data/keys/seekers/${SEEKER_ID}/`);
console.log('Published public keys -> data/public-keys.json, data/seeker-public-keys.json');
