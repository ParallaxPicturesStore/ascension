import {
  LOCAL_FLAG_THRESHOLD,
  ALERT_THRESHOLD,
} from '@ascension/shared';

export interface AnalysisResult {
  labels: string[];
  topCategory: string;
  topScore: number;
  flagged: boolean;
  alert: boolean;
}

export interface AnalysisCredentials {
  supabaseUrl: string;
  userAccessToken: string;
  supabaseAnonKey: string;
  userId: string;
}

export async function loadModel(): Promise<void> {}
export function unloadModel(): void {}

export async function analyzeImage(
  base64: string,
  credentials: AnalysisCredentials,
): Promise<AnalysisResult> {
  try {
    const { supabaseUrl, userAccessToken, supabaseAnonKey } = credentials;

    console.log(`[ContentAnalyzer] → rekognition.analyze (${Math.round(base64.length / 1024)}KB)`);

    const res = await fetch(`${supabaseUrl}/functions/v1/ascension-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        action: 'rekognition.analyze',
        payload: { base64Image: base64 },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`rekognition.analyze failed (${res.status}): ${text}`);
    }

    const data: { labels: string[]; maxConfidence: number } = await res.json();
    const { labels, maxConfidence } = data;

    console.log(
      `[ContentAnalyzer] ✓ labels=${labels.length}`,
      `confidence=${maxConfidence?.toFixed(1)}%`,
      labels.length > 0 ? labels.join(', ') : '(clean)',
    );

    const topCategory =
      labels.length > 0 ? labels[0].replace(/\s*\(\d+\.?\d*%\)$/, '') : 'neutral';
    const topScore = maxConfidence ?? 0;
    const hasContent = labels.length > 0 && topScore > 0;

    return {
      labels,
      topCategory,
      topScore,
      flagged: hasContent && topScore >= LOCAL_FLAG_THRESHOLD,
      alert: hasContent && topScore >= ALERT_THRESHOLD,
    };
  } catch (error) {
    console.warn(`[ContentAnalyzer] ✗ rekognition.analyze failed: ${error}`);
    return {
      labels: [],
      topCategory: 'neutral',
      topScore: 0,
      flagged: false,
      alert: false,
    };
  }
}
