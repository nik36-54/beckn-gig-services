# Beckn-Style Decentralized Gig Worker Reputation Network

A runnable, simplified simulation of how Beckn Protocol / ONDC-style networks work,
applied to your idea: portable, verifiable trust scores for gig workers (electricians,
delivery workers, domestic help, etc.) that don't depend on any single platform.

## The core idea

Instead of one company owning a worker's rating (like a single delivery app today),
each worker holds their **own cryptographic keypair**. Their profile and reputation
are *signed* by their own private key before being shown to anyone. A seeker can
verify that signature using the worker's *public key* — fetched independently from
a lightweight registry, not from whoever is hosting the data. So trust comes from
math, not from trusting a platform.

## Architecture (mapped to real Beckn/ONDC roles)

```
   BAP (bap-client)              the "seeker app" — searches & rates
        |
        v
   Gateway (gateway)             broadcasts a search to every relevant BPP
        |
        v
   Registry (registry)           directory of BPPs + public keys (discovery only)
        |
        v
   BPP (bpp-worker-node)         hosts the worker catalog, self-signs each profile
```

- **Registry** — the only centralized piece, and notice it never sees reputation
  data or transactions. It only answers "which BPPs serve category X?" and
  "what is identity Y's public key?" — exactly the role ONDC's registry plays.
- **Gateway** — looks up the registry, fans the search out to every matching BPP,
  aggregates results. This is what lets one search reach many independent
  provider networks.
- **BPP (worker node)** — hosts the actual gig worker catalog and signs every
  profile with that worker's own private key before returning it.
- **BAP (seeker client)** — what a customer/business uses. It verifies every
  signature against the registry's public key, and signs ratings locally with
  its own key before submitting them — the worker's BPP never sees a private key.

### Two simplifications, on purpose
1. **Synchronous search**, not Beckn's real async `/search` → `/on_search`
   callback pattern. Keeps the demo readable; the callback model is the natural
   "phase 2" if you want to go further.
2. **Ratings as a plain endpoint**, not a formal Beckn "issue/feedback" spec.
   Real ONDC layers extra specs on top of the core protocol for this.

## Tech stack

- **Node.js + Express** — one tiny HTTP service per actor (no framework magic)
- **Node's built-in `crypto` module** — RSA-2048 keypairs, SHA256 signing — this
  *is* the decentralized identity layer, no blockchain or external library needed
- **Flat JSON files** — `data/*.json` act as the "database" (intentionally simple,
  swap for SQLite/Postgres later if you want)
- **npm workspaces** — `identity-utils` is a shared local package every service
  imports, so the signing logic lives in exactly one place
- **Node's built-in test runner** (`node --test`) — no extra test framework needed
- **concurrently** — runs all four services with one command in dev

## Folder structure

```
beckn-gig-network/
├── package.json              # root workspace config + scripts
├── packages/
│   └── identity-utils/       # shared: generateKeyPair, signData, verifyData
├── services/
│   ├── registry/             # port 4000 — discovery + public key directory
│   ├── gateway/               # port 4001 — broadcasts search, aggregates
│   ├── bpp-worker-node/       # port 4002 — hosts + signs worker catalog
│   └── bap-client/            # port 4003 — seeker app: search, verify, rate
├── data/
│   ├── workers-seed.json      # 18 fake gig workers (source data)
│   ├── registry-seed.json     # which BPP networks exist, what they serve
│   ├── workers-runtime.json   # generated: live data the BPP reads/writes
│   ├── public-keys.json       # generated: worker_id -> public key
│   ├── seeker-public-keys.json # generated: seeker_id -> public key
│   └── keys/                  # generated: every private/public keypair
├── scripts/
│   ├── generate-keys.js       # creates a real keypair per worker + 1 seeker
│   ├── seed-data.js           # builds the runtime worker store
│   └── test-flow.sh           # curl-based end-to-end smoke test
└── tests/
    └── identity-utils.test.js # unit tests for sign/verify
```

## 1. Install (one-time)

You need **Node.js 18+** (the project was built and tested on Node 22).
Check: `node --version`

In VS Code, open this folder (`File > Open Folder...`), then open a terminal
(`` Ctrl+` ``) and run:

```bash
npm install
```

This installs dependencies for every service at once, thanks to npm workspaces.

## 2. Generate identities + seed data (one-time, or whenever you want a fresh start)

```bash
npm run setup
```

This does two things:
- `generate-keys.js` — creates a real RSA keypair for each of the 18 workers
  (simulating each one creating their own decentralized identity) plus one
  demo "seeker" identity, under `data/keys/`
- `seed-data.js` — builds `data/workers-runtime.json`, the live store the BPP
  reads from and writes new ratings into

> Re-run `npm run setup` any time to wipe ratings and regenerate fresh keys.

## 3. Run all four services

```bash
npm run dev
```

This uses `concurrently` to start all 4 services in one terminal, color-coded:
- registry → http://localhost:4000
- gateway → http://localhost:4001
- bpp-worker-node → http://localhost:4002
- bap-client → http://localhost:4003

Leave this running. Open a **second terminal** in VS Code for testing.

(If you'd rather run them separately for clarity, use `npm run dev:registry`,
`npm run dev:gateway`, `npm run dev:bpp`, `npm run dev:bap` each in its own terminal.)

## 4. Try it

**Search for workers** (talks to the BAP, which goes through the gateway,
which talks to the BPP, with every result signature-verified along the way):

```bash
curl "http://localhost:4003/find-workers?category=electrician&city=Patna"
```

You'll see each worker's profile with `"signature_valid": true` — proof the
BAP independently verified the data using the registry's public key, not by
trusting the BPP.

**Submit a rating** (signed locally by the demo seeker identity before it's sent):

```bash
curl -X POST http://localhost:4003/rate-worker \
  -H "Content-Type: application/json" \
  -d '{"worker_id":"worker_001","rating":5,"comment":"On time, great work"}'
```

**Search again** — the worker's reputation now reflects the new rating:

```bash
curl "http://localhost:4003/find-workers?category=electrician&city=Patna"
```

**Or run the whole flow as one script** (in the second terminal, while `npm run dev` is running):

```bash
bash scripts/test-flow.sh
```

**Try other categories/cities** from `data/workers-seed.json`: `plumber`,
`domestic_help`, `delivery`, `painter`, `carpenter`, `mechanic`, `mason` across
Patna, Delhi, Mumbai, Bengaluru, Lucknow, Kolkata, Pune, Hyderabad.

**Confirm tampering gets rejected** — post a rating with a garbage signature
straight to the BPP and you should get a 401:

```bash
curl -X POST http://localhost:4002/rate \
  -H "Content-Type: application/json" \
  -d '{"worker_id":"worker_001","rating":1,"seeker_id":"seeker_demo","signature":"bogus","seeker_public_key":"fake"}'
```

## 5. Run the unit tests

```bash
npm test
```

This runs `tests/identity-utils.test.js` using Node's built-in test runner —
no extra dependency needed. It checks that:
- a valid signature verifies correctly
- a tampered payload fails verification
- the wrong public key fails verification
- signing is independent of object key order (so JSON re-ordering can't break trust)

## Where to go next

This is intentionally the smallest version of the idea that's still real
end-to-end. Natural next steps, roughly in order of effort:

1. **Add a second BPP** (copy `bpp-worker-node`, give it a different port and
   a different slice of workers, add it to `registry-seed.json`) — this is
   what actually demonstrates "many independent networks, one search," the
   core promise of ONDC.
2. **Swap flat JSON for SQLite** once you want concurrent writes to be safe.
3. **Move to async callbacks** (`/search` → `/on_search` to a callback_url)
   to match the real Beckn spec more closely.
4. **Add a minimal web UI** (a single HTML page hitting the BAP's endpoints)
   so this stops being curl-only.
5. **Use the real Beckn Protocol JSON schemas** (context/message envelope)
   instead of the simplified bodies used here, once you're ready to actually
   register on an ONDC sandbox.
6. **Switch RSA for Ed25519** (smaller, faster signatures) and look at W3C DID
   formats if you want this to look more like a standards-track decentralized
   identity system.
