/** Supabase Auth wrapper for the static PWA. */
const AuthService = (() => {
  const config = window.APP_CONFIG || {};
  const listeners = new Set();
  const client = window.supabase?.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: navigator.onLine,
        detectSessionInUrl: true
      }
    }
  );
  let currentSession = null;
  let initialized = false;

  function redirectUrl() {
    const basePath = location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1);
    return `${location.origin}${basePath}index.html`;
  }

  function notify(session) {
    currentSession = session;
    listeners.forEach(listener => queueMicrotask(() => listener(session)));
  }

  async function init() {
    if (!client) throw new Error('Supabase Auth is not configured.');
    if (!initialized) {
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' && !navigator.onLine) return;
        notify(session);
      });
      addEventListener('online', () => client.auth.startAutoRefresh());
      addEventListener('offline', () => client.auth.stopAutoRefresh());
      initialized = true;
    }
    if (!navigator.onLine) {
      // Reuse Supabase's persisted session; offline startup must not wait for token refresh.
      const saved = JSON.parse(localStorage.getItem(client.storageKey) || 'null');
      currentSession = saved?.user?.id && saved.access_token && saved.refresh_token ? saved : null;
      return currentSession;
    }
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    currentSession = data.session;
    return currentSession;
  }

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    currentSession = data.session;
    return currentSession;
  }

  async function signIn() {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl() }
    });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  const subscribe = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const session = () => currentSession;
  const user = () => currentSession?.user || null;

  return { init, getSession, signIn, signOut, subscribe, session, user, client };
})();
