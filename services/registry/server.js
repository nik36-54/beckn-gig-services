/**
 * REGISTRY
 * --------
 * The one piece of this network that is "central" -- but notice what it
 * does NOT do: it never sees a worker's reputation, work history, or any
 * transaction. It only answers two kinds of questions:
 *   1. "Which provider networks (BPPs) serve this category?" (discovery)
 *   2. "What is this identity's public key?" (trust anchor for verification)
 *
 * This mirrors the real ONDC registry's role in the Beckn network.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const registry = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'registry-seed.json'), 'utf8'));

function loadJSON(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// GET /lookup?category=electrician
app.get('/lookup', (req, res) => {
  const { category } = req.query;
  let participants = registry.participants;
  if (category) {
    participants = participants.filter((p) => p.categories.includes(category));
  }
  res.json({ participants });
});

// GET /public-key/worker/:id
app.get('/public-key/worker/:id', (req, res) => {
  const keys = loadJSON('public-keys.json');
  const key = keys[req.params.id];
  if (!key) return res.status(404).json({ error: 'unknown worker id - run "npm run setup" first' });
  res.json({ worker_id: req.params.id, public_key: key });
});

// GET /public-key/seeker/:id
app.get('/public-key/seeker/:id', (req, res) => {
  const keys = loadJSON('seeker-public-keys.json');
  const key = keys[req.params.id];
  if (!key) return res.status(404).json({ error: 'unknown seeker id - run "npm run setup" first' });
  res.json({ seeker_id: req.params.id, public_key: key });
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'registry' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[registry] listening on http://localhost:${PORT}`));
