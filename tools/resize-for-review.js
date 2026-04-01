/**
 * Resize test screenshots for AI review sessions.
 * - Reads from test-screenshots/
 * - Writes downsized copies to test-screenshots-review/
 * - Max dimension: 1000px (width or height), maintains aspect ratio
 * - Original full-res screenshots are untouched
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'test-screenshots');
const OUT_DIR = path.join(__dirname, '..', 'test-screenshots-review');
const MAX_DIM = 1000;

async function getAllPngs(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await getAllPngs(full));
    } else if (entry.name.toLowerCase().endsWith('.png')) {
      results.push(full);
    }
  }
  return results;
}

async function run() {
  const files = await getAllPngs(SRC_DIR);
  console.log(`Found ${files.length} screenshots to resize`);

  let resized = 0;
  let skipped = 0;

  for (const src of files) {
    const rel = path.relative(SRC_DIR, src);
    const dest = path.join(OUT_DIR, rel);

    // Create output directory
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    // Check if already resized and up to date
    if (fs.existsSync(dest)) {
      const srcStat = fs.statSync(src);
      const destStat = fs.statSync(dest);
      if (destStat.mtimeMs >= srcStat.mtimeMs) {
        skipped++;
        continue;
      }
    }

    await sharp(src)
      .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
      .png({ quality: 80 })
      .toFile(dest);

    resized++;
  }

  console.log(`Done: ${resized} resized, ${skipped} skipped (already up to date)`);
  console.log(`Review screenshots at: ${OUT_DIR}`);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
