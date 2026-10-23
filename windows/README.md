# ActivityTAB on Windows IIS

This variant reuses the task API, recurring-task logic, Web Push encryption, and responsive React application. The build adapts all application, manifest, service-worker, notification, and document links to `/ActivityTAB/`.

## Runtime

- Public address: `https://mis-sweetdreams.in/ActivityTAB/`
- IIS site: `CFO`; dedicated application and pool: `ActivityTAB`
- Runtime files: `C:\inetpub\wwwroot\CFOProject\ActivityTAB`
- Private database and uploads: `C:\ProgramData\ActivityTAB\data`
- Node runtime: `C:\ProgramData\ActivityTAB\runtime`
- Logs: `C:\ProgramData\ActivityTAB\data\server.log`
- Scheduled task: `ActivityTAB Server`, running as Local Service at startup. Its wrapper restarts an exited Node process.
- Node binds only to `127.0.0.1:3187`. Existing IIS ARR and URL Rewrite forward the application's HTTPS traffic.
- Recurrence, reminders, and push retries run every minute inside the server process. They do not depend on an employee leaving the app open. Working-hour and weekday settings use IST.

SQLite uses WAL and atomic SQL claims for durable task, notification, and delivery records. Uploaded files stay outside the web root and are returned only after the task access check. The Node server serves an explicit public asset allowlist, so source, database, and setup files are not web-accessible.

## Build and verification

From the taskflow checkout with Node 24 and project dependencies installed:

```sh
node windows/build.mjs
node windows/test.mjs
node windows/performance.mjs
node tests/recurrence.mjs
node tests/web-push.mjs
```

The Windows integration suite creates a temporary database and disposable credentials. It checks roles, CSRF, sign-in cookies, account setup links, required uploads, review, private data, PWA subpaths, scheduler execution, logout/deactivation, and task/document/session persistence across a process restart. It does not claim delivery to a physical phone.

## Installation

`Install-ActivityTAB.ps1` is intended to run from the dedicated RDP redirected folder `\\tsclient\server-transfer`, alongside the generated `ActivityTAB-Windows.zip` and the official Node Windows ZIP. The installer checks the Node archive SHA-256, confirms the existing IIS prerequisites, backs up runtime/source files, installs the app, applies directory ACLs, registers the startup task, and verifies loopback health. It does not change other IIS applications or enable global ARR settings.

Node release: `v24.22.1`, Windows x64. Official archive SHA-256:

```text
d2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5
```

A successful process start alone does not verify IIS publication. Verify public HTTPS sign-in, assets, unauthenticated API rejection, private file rejection, authenticated workflow, and advancing scheduler timestamps after installation.

## Administrator and employee access

On first startup, a random setup token is created in `data\first-admin-setup.txt`. The installer opens the administrator setup page on the server. The owner must enter and submit their own name, email, and password. Setup stops accepting requests as soon as the first credential exists; no default password is installed.

Add employees in Team, then select **Manage sign-in access** to create a personal setup link. Links are random, stored as SHA-256 digests, expire in 24 hours, and work once. Share a link privately only with its intended employee. A new reset link revokes existing sessions. Employee deactivation is enforced on every authenticated request. Administrators can use Team → Edit to change names, emails, departments, and roles while preserving employee IDs, assignments, documents, and active status. Duplicate emails and self-demotion are rejected.

Passwords use salted scrypt. Sessions use random opaque cookies whose digests are stored in SQLite. Cookies are HttpOnly, Secure, SameSite=Strict, and scoped to `/ActivityTAB/`. **Keep me signed in** selects a persistent 30-day session; unchecked sessions expire after 12 hours and use a browser-session cookie. Signing out revokes that session server-side. The sign-in page performs a same-origin session check so launcher navigations that omit a Strict cookie can resume an existing saved session. Restored sign-in pages also recheck on pageshow.

## PWA and mobile alerts

Install the Windows URL as the PWA; a PWA installed from the former `chatgpt.site` URL belongs to that different origin and must be installed again from the Windows URL. Task data and push subscriptions in the original cloud deployment are separate; this installer does not silently migrate or delete them.

On Android, use Chrome's Install app option. On iPhone/iPad, use Safari → Share → Add to Home Screen, then open the installed app. In Settings, enable notifications and use Send test. iOS/iPadOS 16.4 or later is required for Web Push. A permission grant and actual alert receipt must be checked on a physical phone.

Document download buttons fetch the file inside the signed-in app before saving a temporary blob, avoiding Android handoffs of a protected API URL to a different browser context. Authentication errors are shown in the app instead of downloaded as documents. Temporary object URLs are released after one minute.

The service worker caches only the offline page and icon. Tasks, documents, and session responses use network requests and are not cached. Cache cleanup and notification window selection are scoped to ActivityTAB, preserving other applications on this domain.

## Backup and recovery

Runtime/source backups made during installation are in `C:\ProgramData\ActivityTAB\backups`. They are not database backups. Include the complete private `data` directory in the server backup policy, including `activitytab.sqlite`, its WAL files, and `uploads`. For a simple consistent manual backup, stop the scheduled task and its ActivityTAB Node process, copy the full directory to a protected backup location, then start the scheduled task. Do not copy only the main SQLite file while the app is running. Preserve directory ACLs when restoring. Session records and VAPID keys are inside the database and must remain private.

## Upload and volume performance

Uploads are limited to 20 MB per document. Two uploads are processed concurrently, with eight additional requests allowed to wait under HTTP backpressure. Document writes are asynchronous, downloads are streamed, and task metadata responses use streaming gzip when supported. Task and document lists render in batches of 100; file bytes are fetched only when a document is opened. New task notifications are queued durably before the API responds, with delivery continuing independently of the task form. Supporting database indexes cover task documents, activity, subscriptions, and the delivery queue.

A disposable local load test on macOS with 20,000 tasks, 5,000 document records, and four simultaneous 20 MB uploads returned metadata in 121 ms; health requests during uploads had a 4 ms p95 and 54 ms maximum in that run. These numbers measure the local application process, not the Windows server or a phone network. Run the included performance script after changes rather than assuming identical latency on other hardware.

Returned tasks can reuse an existing supporting document when resubmitting with remarks. Initial required-document submissions still require an attachment. Resubmissions have a distinct reviewer notification; work-start and document-added events notify the assigning manager. New assignment previews include the assigner, IST deadline and priority. Push previews are shortened to fit payload limits while full remarks remain in task history.

## Working calendar

Settings → Reminder rules includes a working-day schedule, an optional Saturday working day, and up to 100 named public-holiday dates. Administrators add/remove dates then save the calendar. Daily recurrence and timed reminders use IST dates and skip excluded days and public holidays. Existing deadlines and weekly/monthly recurrence are not moved automatically; immediate task-update push alerts remain immediate. Unsaved calendar edits survive background refreshes until saved.

Managers can add executives from Team and create their initial account setup links from Manage sign-in access. Managers cannot add managers/administrators, edit or deactivate members, or reset established accounts. Only administrators can reset passwords.
