/**
 * Rekognition module — image analysis is routed through the Edge Function.
 * No AWS credentials are needed on the client.
 */

const { callEdgeFunction, getAccessToken } = require("./api-client");

async function analyzeImage(imageBuffer) {
  const token = getAccessToken();
  if (!token) {
    console.log("[Rekognition] No access token - skipping analysis");
    return { labels: [], maxConfidence: 0, raw: [] };
  }

  try {
    // Convert buffer to base64 for transport
    const base64Image = imageBuffer.toString("base64");

    const result = await callEdgeFunction("rekognition.analyze", {
      base64Image,
    }, token);

    return {
      labels: result.labels || [],
      maxConfidence: result.maxConfidence || 0,
      raw: result.raw || [],
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
