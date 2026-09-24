const ACTIVITIES = ['Wash', 'Out', 'Reach', 'Poop', 'OP'];
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);
let currentUser = null;

function today() {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function toast(text) {
  const element = $('#toast');
  element.textContent = text;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2300);
}

async function render() {
  if (!currentUser) return;
  const rows = (await ActivityDB.all(currentUser.id)).filter(record =>
    ACTIVITIES.includes(record.activity)
  );
  const daily = rows.filter(record => record.date === today());
  ACTIVITIES.forEach(activity => {
    const latest = rows.filter(record => record.activity === activity).at(-1);
    const element = document.querySelector(`[data-latest="${activity}"]`);
    if (element) {
      element.textContent = latest
        ? `Latest: ${latest.date === today() ? 'Today' : latest.date} ${latest.time}`
        : 'No records yet';
    }
  });
  $('#todayCount').textContent = `${daily.length} records`;
  $('#summaryList').innerHTML = ACTIVITIES.map(activity => {
    const matches = daily.filter(record => record.activity === activity);
    const value = matches.length ? `${matches.length} · ${matches.at(-1).time}` : '—';
    return `<li><span>${escapeHTML(activity)}</span><b>${value}</b></li>`;
  }).join('');
}

async function record(activity, button) {
  if (!currentUser) return;
  button.disabled = true;
  try {
    const saved = await ActivityDB.add(activity, currentUser.id);
    navigator.vibrate?.(35);
    toast(`✓ ${activity} recorded at ${saved.time}`);
    await render();
    SyncService.sync().then(result => {
      if (result && !result.skipped) updateStatus();
    }).catch(console.warn);
  } finally {
    button.disabled = false;
  }
}

function updateStatus() {
  if (!currentUser) return;
  const online = navigator.onLine;
  $('#statusDot').classList.toggle('offline', !online);
  $('#statusText').textContent = online ? 'Online · private sync' : 'Offline · saved locally';
}

async function applySession(session) {
  currentUser = session?.user || null;
  $('#authGate').hidden = Boolean(currentUser);
  $('#appMain').hidden = !currentUser;
  $('#appNav').hidden = !currentUser;
  if (!currentUser) return;
  $('#accountLabel').textContent = currentUser.email || 'Signed in';
  updateStatus();
  await render();
  if (navigator.onLine) {
    try {
      await SyncService.sync();
      await render();
    } catch (error) {
      console.warn(error);
    }
  }
}

async function init() {
  await ActivityDB.open();
  document.querySelectorAll('.activity').forEach(button =>
    button.addEventListener('click', () => record(button.dataset.activity, button))
  );
  document.querySelectorAll('[data-auth-login]').forEach(button =>
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await AuthService.signIn(); }
      catch (error) { console.error(error); toast('Google sign-in failed. Please try again.'); }
      finally { button.disabled = false; }
    })
  );
  $('#signOutBtn').addEventListener('click', () => AuthService.signOut().catch(console.error));
  $('#resetLocalBtn').addEventListener('click', async () => {
    if (!currentUser || !confirm('Clear local records on this device? Cloud records will return on the next sync.')) return;
    await ActivityDB.clear(currentUser.id);
    await render();
    toast('✓ Local records cleared');
  });
  $('#syncBtn').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      toast('Syncing with Supabase…');
      const result = await SyncService.connect();
      await render();
      toast(result.skipped ? 'Sync unavailable. Records remain local.' : `✓ Synced · ${result.uploaded} uploaded`);
    } catch (error) {
      console.error(error);
      toast('Sync failed. Records remain saved locally.');
    } finally {
      button.disabled = false;
    }
  });
  addEventListener('online', () => {
    updateStatus();
    SyncService.sync().then(render).catch(console.warn);
  });
  addEventListener('offline', updateStatus);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  AuthService.subscribe(session => applySession(session).catch(console.error));
  await applySession(await AuthService.init());
}

document.addEventListener('DOMContentLoaded', init);
