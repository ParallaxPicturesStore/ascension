const BLOCKLIST_URL = 'https://flrllorqzmbztvtccvab.supabase.co/storage/v1/object/public/blocked%20url/blocklist.txt';

export async function fetchBlocklist(): Promise<string[]> {
  try {
    const res = await fetch(BLOCKLIST_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    const domains = text
      .split('\n')
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    console.log(`[Blocklist] fetched ${domains.length} domains`);
    return domains;
  } catch (err) {
    console.warn('[Blocklist] fetch failed:', err);
    return [];
  }
}
