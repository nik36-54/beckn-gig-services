const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const workers = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'workers-seed.json'), 'utf8'));

const runtime = workers.map((w) => ({ ...w, ratings: [] }));

fs.writeFileSync(
  path.join(DATA_DIR, 'workers-runtime.json'),
  JSON.stringify(runtime, null, 2)
);

console.log(`Seeded runtime store with ${runtime.length} workers -> data/workers-runtime.json`);
console.log('This is the file the BPP node reads from and writes new ratings into.');
