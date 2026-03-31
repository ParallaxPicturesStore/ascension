/**
 * Generates app icons for Ascension.
 * Run with: npm run generate-icons
 *
 * Outputs:
 *   assets/icon.ico   — Windows installer + taskbar icon
 *   assets/icon.png   — 1024x1024 source (convert to .icns for Mac via cloudconvert.com)
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// Ascension icon: dark navy background, blue upward arrow
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <!-- Dark navy background -->
  <rect width="256" height="256" rx="52" fill="#0f172a"/>

  <!-- Upward arrow in accent blue -->
  <!-- Arrow head (triangle) -->
  <polygon
    points="128,44 210,148 164,148 164,148"
    fill="#3b82f6"
  />

  <!-- Full arrow shape (head + shaft) -->
  <polygon
    points="128,44 212,152 162,152 162,212 94,212 94,152 44,152"
    fill="#3b82f6"
  />

  <!-- Subtle inner highlight on arrow head for depth -->
  <polygon
    points="128,66 192,152 128,152"
    fill="#60a5fa"
    opacity="0.25"
  />
</svg>
`;

async function generateIcons() {
  const assetsDir = path.join(__dirname, "..", "assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  const svgBuffer = Buffer.from(SVG);

  // Generate PNGs at all required sizes
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push(buf);
    console.log(`Generated ${size}x${size} PNG`);
  }

  // Save 256px PNG as reference
  fs.writeFileSync(path.join(assetsDir, "icon-256.png"), pngBuffers[5]);

  // Save 1024px PNG for .icns conversion
  const png1024 = await sharp(svgBuffer).resize(1024, 1024).png().toBuffer();
  fs.writeFileSync(path.join(assetsDir, "icon.png"), png1024);
  console.log("Saved assets/icon.png (1024x1024) — convert to icon.icns at cloudconvert.com/png-to-icns");

  // Build .ico file (multi-resolution)
  const toIco = require("png-to-ico");
  const icoBuffer = await toIco(pngBuffers);
  fs.writeFileSync(path.join(assetsDir, "icon.ico"), icoBuffer);
  console.log("Saved assets/icon.ico");

  console.log("\nDone. For Mac:");
  console.log("  1. Go to https://cloudconvert.com/png-to-icns");
  console.log("  2. Upload assets/icon.png");
  console.log("  3. Save output as assets/icon.icns");
}

generateIcons().catch((err) => {
  console.error("Icon generation failed:", err.message);
  process.exit(1);
});
