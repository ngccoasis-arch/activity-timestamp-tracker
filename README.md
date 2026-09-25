# Activity Timestamp Tracker

## Architecture
- **UI:** `index.html` + `app.js` for wheel-based date/time recording; `report.html` + `charts.js` for analytics.
- **Local data:** `db.js` owns IndexedDB and stores immutable UUID-based records.
- **Authentication:** `auth.js` owns the persisted Google/Supabase session.
- **Cloud sync:** `sync.js` owns authenticated Supabase REST calls. UI/data code does not call Supabase directly.
- **Offline shell:** `sw.js` precaches every runtime asset, including vendored Chart.js.

## Files
`index.html`, `report.html`, `style.css`, `app.js`, `db.js`, `sync.js`, `charts.js`, `sw.js`, `manifest.json`, `vendor/`, and `icons/`.

## Run and install
1. Serve this folder over HTTPS, or use localhost for development. Example: `python -m http.server 8080`.
2. Open `http://localhost:8080` during development. On the phone, deploy to any static HTTPS host.
3. In Chrome on Android, open the site, then choose **Install app** or **Add to Home screen**.
4. Open it once while online so the service worker installs. It then works fully offline.

Do not open `index.html` with a `file://` URL because service workers require a secure web origin.

## GitHub Pages
The production site is designed for `https://ngccoasis-arch.github.io/activity-timestamp-tracker/`. Publish the `main` branch from the repository root. The checked-in `.nojekyll` file disables Jekyll processing.

## Supabase configuration
`config.js` contains the browser-safe Supabase project URL and publishable key. Never place a Google client secret, Supabase secret key, service-role key, or database password in this PWA.

The `public.activity_records` table stores immutable records with these columns: `id`, `user_id`, `activity`, `record_date`, `record_time`, `recorded_at`, `source`, and `created_at`. Run `supabase-auth-setup.sql` once after creating and emptying the table. Row Level Security then permits signed-in users to select and insert only their own records; anonymous access, update, and delete remain blocked.

Enable Google under **Authentication → Providers**. Add the Supabase callback URL to the Google OAuth client. In Supabase URL Configuration, use the deployed GitHub Pages URL as the Site URL and allow both the exact production `index.html` URL and `http://localhost:8080/index.html` for local development.

The five accepted activities are `Wash`, `Out`, `Reach`, `Poop`, and `OP`. Wash, Out, and Reach are shown as time-of-day reports, while Poop and OP are shown as frequency reports.

### Conflicts
Every record receives a UUID at creation and is immutable. Sync reads remote IDs first, merges them locally, and uploads only local IDs absent remotely. Supabase inserts use `ON CONFLICT DO NOTHING`, so retries do not require update permission and do not create duplicates.

### Offline-first flow
A tap always writes to the signed-in user's IndexedDB partition first and updates the screen immediately. When online, authenticated sync runs opportunistically. Failed network calls leave records marked `pending`, so the next online session retries safely.

Database version 4 performs a one-time reset of pre-authentication local records and adds per-user ownership. The **Reset local data** button clears only the current user's device cache; cloud records return on the next sync.

## Mobile optimization
The layout is mobile-first, portrait-oriented, safe-area aware, and one-handed. Each activity has a dedicated add button that opens a themed 24-hour wheel picker. Records default to the current local minute, with an advanced calendar for today or any of the preceding 29 days. Assets are local, rendering is dependency-light, motion is subtle, contrast is high, and vibration feedback is optional.

## Production deployment checks
- Use HTTPS in production.
- Review Supabase Row Level Security and grants before changing the data model.
- Add a Content Security Policy at the hosting layer.
- Test PWA installation and offline mode in Chrome DevTools.
- Keep secret and service-role keys out of all frontend files.

## Future enhancements
Background sync after browser support and token constraints permit it; export/import backup; reminder notifications; editable/undo records; configurable activities; biometric app lock; data-retention controls; richer trend smoothing; accessibility localization; and automated end-to-end tests.
