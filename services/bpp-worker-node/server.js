/**
 * BPP (Beckn Provider Platform) -- "worker node"
 * -----------------------------------------------
 * Hosts the gig worker catalog and answers /search requests from the
 * gateway. The key decentralization idea: every worker profile returned is
 * SIGNED with that worker's own private key before it leaves this server.
 * Anyone holding the worker's public key (fetched from the registry, not
 * from here) can verify the data wasn't altered by this server or anyone
 * in between -- the platform hosting the data doesn't have to be trusted.
 *
 * SIMPLIFICATION: in a real P2P deployment, each worker would run their own
 * node (e.g. on a phone) holding only their own private key. Here we host
 * all worker nodes in one process for ease of running the demo, but each
 * worker's signature is still produced with a key unique to them.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { signData, verifyData } = require('identity-utils');

const app = express();
app.use(express.json());

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const RUNTIME_FILE = path.join(DATA_DIR, 'workers-runtime.json');

function loadWorkers() {
  return JSON.parse(fs.readFileSync(RUNTIME_FILE, 'utf8'));
}

function saveWorkers(workers) {
  fs.writeFileSync(RUNTIME_FILE, JSON.stringify(workers, null, 2));
}

function privateKeyOf(workerId) {
  return fs.readFileSync(path.join(DATA_DIR, 'keys', 'workers', workerId, 'private.pem'), 'utf8');
}

function averageRating(ratings) {
  if (!ratings.length) return null;
  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  return Number((sum / ratings.length).toFixed(2));
}

// POST /search { category, city }
app.post('/search', (req, res) => {
  const { category, city } = req.body;
  const workers = loadWorkers();

  const matches = workers.filter(
    (w) =>
      (!category || w.category === category) &&
      (!city || w.city.toLowerCase() === city.toLowerCase())
  );

  const results = matches.map((w) => {
    const profile = {
      id: w.id,
      name: w.name,
      category: w.category,
      city: w.city,
      skills: w.skills,
      experience_years: w.experience_years,
      base_price_per_hour: w.base_price_per_hour,
      reputation: averageRating(w.ratings),
      total_ratings: w.ratings.length
    };
    const signature = signData(profile, privateKeyOf(w.id));
    return { profile, signature, signed_by: w.id };
  });

  res.json({ results });
});

// POST /rate { worker_id, rating, comment, seeker_id, signature, seeker_public_key }
// The signature must have been produced by the SEEKER's own private key
// (signing happens on the BAP side -- this server never sees a private key).
app.post('/rate', (req, res) => {
  const { worker_id, rating, comment, signature, seeker_id, seeker_public_key } = req.body;

  if (!worker_id || !rating || !signature || !seeker_id || !seeker_public_key) {
    return res.status(400).json({
      error: 'worker_id, rating, seeker_id, signature, and seeker_public_key are required'
    });
  }

  const payload = { worker_id, rating, comment: comment || '', seeker_id };
  const isValid = verifyData(payload, signature, seeker_public_key);
  if (!isValid) {
    return res.status(401).json({ error: 'signature verification failed - rating rejected' });
  }

  const workers = loadWorkers();
  const worker = workers.find((w) => w.id === worker_id);
  if (!worker) return res.status(404).json({ error: 'worker not found' });

  worker.ratings.push({
    rating,
    comment: comment || '',
    seeker_id,
    signature,
    rated_at: new Date().toISOString()
  });
  saveWorkers(workers);

  res.json({
    message: 'rating accepted and verified',
    worker_id,
    new_reputation: averageRating(worker.ratings),
    total_ratings: worker.ratings.length
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'bpp-worker-node' }));

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`[bpp-worker-node] listening on http://localhost:${PORT}`));
