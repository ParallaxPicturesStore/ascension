const BLOCKLIST_URL = 'https://flrllorqzmbztvtccvab.supabase.co/storage/v1/object/public/blocked%20url/blocklist.txt';

// In-memory cache — lives for the duration of the app session.
// Fetched once on startup, no storage library needed.
let _cached: string[] | null = null;

export async function fetchBlocklist(): Promise<string[]> {
  if (_cached) {
    console.log(`[Blocklist] in-memory (${_cached.length} domains)`);
    return _cached;
  }

  try {
    const res = await fetch(BLOCKLIST_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    const domains = text
      .split('\n')
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    _cached = domains;
    console.log(`[Blocklist] fetched ${domains.length} domains`);
    return domains;
  } catch (err) {
    console.warn('[Blocklist] fetch failed:', err);
    return _cached ?? [];
  }
}
