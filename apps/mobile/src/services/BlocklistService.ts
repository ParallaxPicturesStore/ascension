const BLOCKLIST_URL = 'https://flrllorqzmbztvtccvab.supabase.co/functions/v1/quick-processor';

export async function fetchBlocklist(): Promise<string[]> {
  try {
    const res = await fetch(BLOCKLIST_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json() as { domains: string[] };
    const domains = json.domains ?? [];

    console.log(`[Blocklist] fetched ${domains.length} domains`);
    return domains;
  } catch (err) {
    console.warn('[Blocklist] fetch failed:', err);
    return [];
  }
}
