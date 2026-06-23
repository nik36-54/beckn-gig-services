const test = require('node:test');
const assert = require('node:assert');
const { generateKeyPair, signData, verifyData } = require('../packages/identity-utils');

test('sign and verify round-trip succeeds with the correct key', () => {
  const { publicKey, privateKey } = generateKeyPair();
  const payload = { worker_id: 'worker_001', rating: 5 };
  const signature = signData(payload, privateKey);
  assert.strictEqual(verifyData(payload, signature, publicKey), true);
});

test('verification fails if the payload is tampered with after signing', () => {
  const { publicKey, privateKey } = generateKeyPair();
  const payload = { worker_id: 'worker_001', rating: 5 };
  const signature = signData(payload, privateKey);
  const tampered = { worker_id: 'worker_001', rating: 1 };
  assert.strictEqual(verifyData(tampered, signature, publicKey), false);
});

test('verification fails when checked against the wrong public key', () => {
  const pairA = generateKeyPair();
  const pairB = generateKeyPair();
  const payload = { worker_id: 'worker_002', rating: 4 };
  const signature = signData(payload, pairA.privateKey);
  assert.strictEqual(verifyData(payload, signature, pairB.publicKey), false);
});

test('canonical signing is independent of key order in the object', () => {
  const { publicKey, privateKey } = generateKeyPair();
  const a = { rating: 5, worker_id: 'worker_003' };
  const b = { worker_id: 'worker_003', rating: 5 };
  const signature = signData(a, privateKey);
  assert.strictEqual(verifyData(b, signature, publicKey), true);
});
