const {
  RekognitionClient,
  DetectModerationLabelsCommand,
} = require("@aws-sdk/client-rekognition");

// Categories we care about
const FLAGGED_CATEGORIES = [
  "Explicit Nudity",
  "Nudity",
  "Suggestive",
  "Sexual Activity",
  "Graphic Male Nudity",
  "Graphic Female Nudity",
  "Violence",
];

let client = null;

function getClient() {
  if (!client) {
    client = new RekognitionClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

async function analyzeImage(imageBuffer) {
  // If no AWS credentials configured, return clean result (dev mode)
  if (!process.env.AWS_ACCESS_KEY_ID) {
    console.log("[Rekognition] No AWS credentials - skipping analysis (dev mode)");
    return {
      labels: [],
      maxConfidence: 0,
      raw: [],
    };
  }

  try {
    const command = new DetectModerationLabelsCommand({
      Image: { Bytes: imageBuffer },
      MinConfidence: 50,
    });

    const response = await getClient().send(command);
    const labels = response.ModerationLabels || [];

    // Filter to only our flagged categories
    const relevant = labels.filter((label) =>
      FLAGGED_CATEGORIES.some(
        (cat) =>
          label.Name?.includes(cat) || label.ParentName?.includes(cat)
      )
    );

    const maxConfidence =
      relevant.length > 0
        ? Math.max(...relevant.map((l) => l.Confidence || 0))
        : 0;

    return {
      labels: relevant.map((l) => `${l.Name} (${l.Confidence?.toFixed(1)}%)`),
      maxConfidence,
      raw: labels,
    };
  } catch (err) {
    console.error("[Rekognition] Analysis failed:", err.message);
    return {
      labels: [],
      maxConfidence: 0,
      raw: [],
      error: err.message,
    };
  }
}

module.exports = { analyzeImage };
