/**
 * GATEWAY
 * -------
 * Looks up the registry for BPPs (provider networks) matching a category,
 * then broadcasts the search to all of them in parallel and aggregates the
 * results. This is what lets a BAP search ONE network and reach MANY
 * independent provider platforms.
 *
 * SIMPLIFICATION: real Beckn networks call back asynchronously
 * (BPP -> POST /on_search on the BAP's callback_url) so a search can fan out
 * to slow or offline providers without blocking. We use a synchronous
 * request/response here to keep the demo easy to run and read.
 */
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:4000';

app.post('/search', async (req, res) => {
  const { category, city } = req.body;
  try {
    const { data } = await axios.get(`${REGISTRY_URL}/lookup`, { params: { category } });
    const participants = data.participants || [];

    const calls = participants.map((p) =>
      axios
        .post(`${p.base_url}/search`, { category, city })
        .then((r) => ({ subscriber_id: p.subscriber_id, results: r.data.results }))
        .catch(() => ({ subscriber_id: p.subscriber_id, results: [] }))
    );

    const responses = await Promise.all(calls);
    const aggregated = responses.flatMap((r) =>
      r.results.map((item) => ({ ...item, provider_network: r.subscriber_id }))
    );

    res.json({ results: aggregated });
  } catch (err) {
    res.status(502).json({ error: 'gateway could not reach registry/providers', detail: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gateway' }));

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`[gateway] listening on http://localhost:${PORT}`));
