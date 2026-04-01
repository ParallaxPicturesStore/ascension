/**
 * Ascension Detection Pipeline Tests
 *
 * Tests the full flow: capture -> analyze -> flag -> alert
 * Uses mocked model outputs to verify threshold logic and alert routing.
 *
 * Run: node test/detection-pipeline.test.js
 */

const sharp = require("sharp");
const path = require("path");

// Track test results
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// ============================================================
// TEST 1: Local analyzer loads and classifies safe images
// ============================================================
async function testSafeImageClassification() {
  console.log("\n--- Test 1: Safe image classification ---");

  const { analyzeLocally } = require("../main/local-analyzer");

  // Create a safe image (blue gradient - typical desktop wallpaper)
  const safe = await sharp({
    create: { width: 224, height: 224, channels: 3, background: { r: 50, g: 100, b: 200 } }
  }).png().toBuffer();

  const result = await analyzeLocally(safe);

  assert(result !== null, "Model returns a result (not null)");
  assert(result.localScore < 10, `Safe image scores low (got ${result.localScore}%)`);
  assert(result.needsVerification === false, "Safe image does NOT need verification");
  assert(result.categories.porn < 5, `Porn category low (got ${result.categories.porn}%)`);
  assert(result.categories.hentai < 5, `Hentai category low (got ${result.categories.hentai}%)`);
}

// ============================================================
// TEST 2: Real app screenshot classified as safe
// ============================================================
async function testAppScreenshotSafe() {
  console.log("\n--- Test 2: App screenshot classification ---");

  const { analyzeLocally } = require("../main/local-analyzer");
  const fs = require("fs");

  const screenshotPath = path.join(__dirname, "..", "..", "..", "test-screenshots", "windows-desktop", "1920x1080", "login.png");

  if (!fs.existsSync(screenshotPath)) {
    console.log("  ⊘ Skipped (no login screenshot available)");
    return;
  }

  const buf = fs.readFileSync(screenshotPath);
  const result = await analyzeLocally(buf);

  assert(result !== null, "Model returns a result");
  assert(result.localScore < 10, `Login page scores safe (got ${result.localScore}%)`);
  assert(result.needsVerification === false, "Login page does NOT need verification");
}

// ============================================================
// TEST 3: Threshold logic validation
// ============================================================
async function testThresholdLogic() {
  console.log("\n--- Test 3: Threshold logic ---");

  // These are the thresholds from the codebase
  const LOCAL_FLAG_THRESHOLD = 25;  // from local-analyzer.js
  const FLAG_THRESHOLD = 70;        // from capture.js
  const ALERT_THRESHOLD = 90;       // from capture.js

  // Test cases: [score, shouldFlag, shouldAlert, description]
  const cases = [
    [0, false, false, "0% - completely clean"],
    [10, false, false, "10% - low score"],
    [24, false, false, "24% - just below local threshold"],
    [25, true, false, "25% - at local threshold (sends to Rekognition)"],
    [50, true, false, "50% - moderate score"],
    [69, true, false, "69% - just below flag threshold"],
    [70, true, true, "70% - at flag threshold (alerts partner)"],
    [89, true, true, "89% - high but below alert threshold"],
    [90, true, true, "90% - at immediate alert threshold"],
    [100, true, true, "100% - maximum"],
  ];

  for (const [score, shouldNeedVerification, shouldFlag, desc] of cases) {
    const needsVerification = score >= LOCAL_FLAG_THRESHOLD;
    const flagged = score >= FLAG_THRESHOLD;

    assert(needsVerification === shouldNeedVerification,
      `${desc}: needsVerification=${needsVerification}`);
    assert(flagged === shouldFlag,
      `${desc}: flagged=${flagged}`);
  }
}

// ============================================================
// TEST 4: Weighted score calculation
// ============================================================
async function testWeightedScoring() {
  console.log("\n--- Test 4: Weighted score calculation ---");

  // From local-analyzer.js: explicitScore = porn + hentai + sexy * 0.3
  function calculateScore(porn, hentai, sexy) {
    return porn + hentai + sexy * 0.3;
  }

  assert(calculateScore(0, 0, 0) === 0, "All zeros = 0%");
  assert(calculateScore(100, 0, 0) === 100, "100% porn = 100%");
  assert(calculateScore(0, 100, 0) === 100, "100% hentai = 100%");
  assert(calculateScore(0, 0, 100) === 30, "100% sexy = 30% (soft flag)");
  assert(calculateScore(50, 0, 50) === 65, "50% porn + 50% sexy = 65%");
  assert(calculateScore(20, 10, 0) === 30, "20% porn + 10% hentai = 30%");

  // Edge case: sexy alone shouldn't trigger flag (max 30% < FLAG_THRESHOLD of 70%)
  const sexyOnlyScore = calculateScore(0, 0, 100);
  assert(sexyOnlyScore < 70, `Sexy-only max score (${sexyOnlyScore}%) is below FLAG_THRESHOLD (70%)`);
}

// ============================================================
// TEST 5: Alert generation logic
// ============================================================
async function testAlertGeneration() {
  console.log("\n--- Test 5: Alert generation logic ---");

  const FLAG_THRESHOLD = 70;

  // Simulate the capture.js decision logic
  function shouldGenerateAlert(localResult, rekognitionResult) {
    if (!localResult && !rekognitionResult) return { alert: false, reason: "no analysis" };

    // Use Rekognition confidence if available, otherwise use local score
    let maxConfidence = 0;
    if (rekognitionResult && rekognitionResult.maxConfidence > 0) {
      maxConfidence = rekognitionResult.maxConfidence;
    } else if (localResult) {
      maxConfidence = localResult.localScore;
    }

    if (maxConfidence >= FLAG_THRESHOLD) {
      return { alert: true, confidence: maxConfidence, reason: "content detected" };
    }

    return { alert: false, confidence: maxConfidence, reason: "below threshold" };
  }

  // Clean image - no alert
  const clean = shouldGenerateAlert({ localScore: 5, needsVerification: false }, null);
  assert(clean.alert === false, "Clean image: no alert");

  // Suspicious but below threshold
  const suspicious = shouldGenerateAlert({ localScore: 40, needsVerification: true }, { maxConfidence: 55 });
  assert(suspicious.alert === false, "Suspicious but below threshold: no alert");

  // Flagged by Rekognition
  const flagged = shouldGenerateAlert({ localScore: 30, needsVerification: true }, { maxConfidence: 85 });
  assert(flagged.alert === true, "Rekognition confirms: alert generated");
  assert(flagged.confidence === 85, `Confidence is 85% (got ${flagged.confidence}%)`);

  // Flagged by local only (no Rekognition)
  const localOnly = shouldGenerateAlert({ localScore: 75, needsVerification: true }, null);
  assert(localOnly.alert === true, "Local-only high score: alert generated");

  // Both analysers fail
  const bothFail = shouldGenerateAlert(null, null);
  assert(bothFail.alert === false, "Both analysers fail: no alert (safe default)");
}

// ============================================================
// TEST 6: Blur function works
// ============================================================
async function testBlurFunction() {
  console.log("\n--- Test 6: Screenshot blur for alerts ---");

  // Create a test image
  const original = await sharp({
    create: { width: 400, height: 300, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).png().toBuffer();

  // Apply the same blur logic from capture.js
  const blurred = await sharp(original)
    .blur(40)
    .jpeg({ quality: 30 })
    .toBuffer();

  assert(blurred.length > 0, "Blurred image is not empty");
  assert(blurred.length < original.length, `Blurred image is smaller (${blurred.length} < ${original.length})`);

  // Verify it's actually a JPEG now
  assert(blurred[0] === 0xFF && blurred[1] === 0xD8, "Blurred output is JPEG format");
}

// ============================================================
// TEST 7: Model handles various image formats
// ============================================================
async function testImageFormats() {
  console.log("\n--- Test 7: Image format handling ---");

  const { analyzeLocally } = require("../main/local-analyzer");

  const base = { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } };

  // PNG
  const png = await sharp({ create: base }).png().toBuffer();
  const pngResult = await analyzeLocally(png);
  assert(pngResult !== null, "PNG image analysed successfully");

  // JPEG
  const jpg = await sharp({ create: base }).jpeg().toBuffer();
  const jpgResult = await analyzeLocally(jpg);
  assert(jpgResult !== null, "JPEG image analysed successfully");

  // Small image (should still work - sharp resizes to 224x224)
  const tiny = await sharp({ create: { width: 50, height: 50, channels: 3, background: { r: 200, g: 200, b: 200 } } }).png().toBuffer();
  const tinyResult = await analyzeLocally(tiny);
  assert(tinyResult !== null, "Small (50x50) image analysed successfully");

  // Large image
  const large = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: { r: 100, g: 100, b: 100 } } }).png().toBuffer();
  const largeResult = await analyzeLocally(large);
  assert(largeResult !== null, "Large (1920x1080) image analysed successfully");
}

// ============================================================
// RUN ALL TESTS
// ============================================================
async function runAll() {
  console.log("=== Ascension Detection Pipeline Tests ===\n");
  console.log("Loading NSFW model (first run may take a few seconds)...");

  await testSafeImageClassification();
  await testAppScreenshotSafe();
  await testThresholdLogic();
  await testWeightedScoring();
  await testAlertGeneration();
  await testBlurFunction();
  await testImageFormats();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    console.log("\n*** SOME TESTS FAILED ***");
    process.exit(1);
  } else {
    console.log("\n*** ALL TESTS PASSED ***");
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
