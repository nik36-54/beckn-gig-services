/**
 * BAP (Beckn App Platform) -- "seeker client"
 * --------------------------------------------
 * The app a customer/business would use to find and rate workers.
 *   - /find-workers: calls the gateway, then independently verifies each
 *     worker's signature using the PUBLIC KEY FROM THE REGISTRY (not from
 *     the BPP that served the data) -- that's the trust-without-a-middleman
 *     part of the design.
 *   - /rate-worker: signs the rating locally with the seeker's own private
 *     key before sending it anywhere. The private key never leaves this
 *     process.
 *
 * SIMPLIFICATION: real Beckn ratings/feedback flow through dedicated
 * "issue" or "rating" specs layered on top of the core protocol. We expose
 * it as a plain endpoint here to keep the demo focused.
 */
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { signData, verifyData } = require('identity-utils');

const app = express();
app.use(express.json());

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4001';
const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:4000';
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const SEEKER_ID = 'seeker_demo';
const seekerPrivateKey = fs.readFileSync(
  path.join(DATA_DIR, 'keys', 'seekers', SEEKER_ID, 'private.pem'),
  'utf8'
);
const seekerPublicKey = fs.readFileSync(
  path.join(DATA_DIR, 'keys', 'seekers', SEEKER_ID, 'public.pem'),
  'utf8'
);

// GET /find-workers?category=electrician&city=Patna
app.get('/find-workers', async (req, res) => {
  const { category, city } = req.query;
  try {
    const { data } = await axios.post(`${GATEWAY_URL}/search`, { category, city });

    const verified = await Promise.all(
      data.results.map(async (item) => {
        try {
          const { data: keyData } = await axios.get(
            `${REGISTRY_URL}/public-key/worker/${item.signed_by}`
          );
          const isValid = verifyData(item.profile, item.signature, keyData.public_key);
          return { ...item.profile, provider_network: item.provider_network, signature_valid: isValid };
        } catch {
          return { ...item.profile, provider_network: item.provider_network, signature_valid: false };
        }
      })
    );

    res.json({ count: verified.length, results: verified });
  } catch (err) {
    res.status(502).json({ error: 'could not complete search', detail: err.message });
  }
});

// POST /rate-worker { worker_id, rating, comment }
app.post('/rate-worker', async (req, res) => {
  const { worker_id, rating, comment } = req.body;
  if (!worker_id || !rating) {
    return res.status(400).json({ error: 'worker_id and rating are required' });
  }

  const payload = { worker_id, rating, comment: comment || '', seeker_id: SEEKER_ID };
  const signature = signData(payload, seekerPrivateKey);

  try {
    const { data: lookup } = await axios.get(`${REGISTRY_URL}/lookup`);
    const bppUrl = lookup.participants[0].base_url; // single BPP network in this demo

    const { data } = await axios.post(`${bppUrl}/rate`, {
      ...payload,
      signature,
      seeker_public_key: seekerPublicKey
    });
    res.json(data);
  } catch (err) {
    res.status(502).json(err.response?.data || { error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'bap-client' }));

const PORT = process.env.PORT || 4003;
app.listen(PORT, () => console.log(`[bap-client] listening on http://localhost:${PORT}`));
