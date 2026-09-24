/** Supabase sync layer. Records remain immutable and are reconciled by UUID. */
const SyncService = (() => {
  const CONFIG = window.APP_CONFIG || {};
  const ACTIVITIES = new Set(['Wash', 'Out', 'Reach', 'Poop', 'OP']);
  const PAGE_SIZE = 1000;
  let syncing = false;

  const baseUrl = () => String(CONFIG.supabaseUrl || '').replace(/\/$/, '');
  const configured = () =>
    /^https:\/\/[^/]+\.supabase\.co$/.test(baseUrl()) &&
    String(CONFIG.supabasePublishableKey || '').startsWith('sb_publishable_');

  async function request(path, options = {}) {
    if (!configured()) throw new Error('Supabase is not configured.');
    const session = await AuthService.getSession();
    if (!session) throw new Error('Sign in is required before syncing.');
    const response = await fetch(`${baseUrl()}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: CONFIG.supabasePublishableKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Supabase ${response.status}: ${message}`);
    }
    if (response.status === 204 || options.method === 'POST') return null;
    return response.json();
  }

  async function readRemote() {
    const rows = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const query =
        'activity_records?select=id,user_id,activity,record_date,record_time,recorded_at,source,created_at' +
        `&order=recorded_at.asc&limit=${PAGE_SIZE}&offset=${offset}`;
      const page = await request(query);
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return rows
      .filter(row => row.id && ACTIVITIES.has(row.activity))
      .map(row => ({
        id: String(row.id),
        activity: row.activity,
        date: String(row.record_date).slice(0, 10),
        time: String(row.record_time).slice(0, 5),
        timestamp: row.recorded_at,
        source: 'Supabase',
        syncStatus: 'synced',
        createdAt: Date.parse(row.created_at || row.recorded_at),
        userId: row.user_id
      }));
  }

  async function append(records) {
    const valid = records.filter(record => ACTIVITIES.has(record.activity));
    if (!valid.length) return;
    const payload = valid.map(record => ({
      id: record.id,
      activity: record.activity,
      record_date: record.date,
      record_time: record.time,
      recorded_at: record.timestamp,
      source: record.source || 'PWA',
      user_id: record.userId
    }));
    await request('activity_records?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(payload)
    });
  }

  async function sync() {
    const user = AuthService.user();
    if (syncing || !navigator.onLine || !configured() || !user) return { skipped: true };
    syncing = true;
    try {
      const remote = await readRemote();
      await ActivityDB.merge(remote, user.id);
      const remoteIds = new Set(remote.map(record => record.id));
      const pending = (await ActivityDB.pending(user.id)).filter(
        record => ACTIVITIES.has(record.activity) && !remoteIds.has(record.id)
      );
      await append(pending);
      await ActivityDB.markSynced(pending.map(record => record.id));
      return { uploaded: pending.length, downloaded: remote.length };
    } finally {
      syncing = false;
    }
  }

  const connect = () => sync();
  return { configured, connect, sync, readRemote, append, CONFIG };
})();
