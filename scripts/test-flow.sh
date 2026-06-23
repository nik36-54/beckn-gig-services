#!/usr/bin/env bash
# Run this AFTER `npm run dev` is up in another terminal.
# Exercises the full flow: search -> verify signatures -> rate -> search again.
set -e

echo "== 1. Searching for electricians in Patna =="
curl -s "http://localhost:4003/find-workers?category=electrician&city=Patna"
echo -e "\n"

echo "== 2. Submitting a signed rating for worker_001 =="
curl -s -X POST http://localhost:4003/rate-worker \
  -H "Content-Type: application/json" \
  -d '{"worker_id":"worker_001","rating":5,"comment":"On time, great work"}'
echo -e "\n"

echo "== 3. Searching again - reputation should now reflect the new rating =="
curl -s "http://localhost:4003/find-workers?category=electrician&city=Patna"
echo -e "\n"

echo "Done. Pipe any of the above through 'jq' for pretty-printed JSON if you have it installed."
