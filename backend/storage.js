const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'ratings.json');

async function ensureFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readAll() {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  try { return JSON.parse(raw); } catch { return []; }
}

async function writeAll(list) {
  const tmp = DATA_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
  await fs.rename(tmp, DATA_FILE);
}

module.exports = { readAll, writeAll };
