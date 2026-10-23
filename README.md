# ActivityTAB

## Current Windows deployment

The live deployment is https://mis-sweetdreams.in/ActivityTAB/ on Windows IIS, with the Node runtime in `windows/`. Build with `node windows/build.mjs`. Windows uses local email/password authentication, private SQLite/uploads, a minute scheduler and a separate push retry worker. The Sites sections below describe the original hosting variant.

Public holidays support inclusive From/To date entry, grouped ranges and single-day entries. Each covered date is stored using the existing daily holiday format, with overlap validation and a total limit of 100 dates. Reminder interval inputs can be cleared and replaced before saving.

The Windows release includes private direct messages and fixed-membership team groups under Chat, plus discussions opened from Task details. Tasks, documents and task discussions are visible only to the assigning person and assigned executive, including for manager and administrator accounts. General administrative permissions do not grant access to unrelated tasks. General chats have no administrator override: only participants can read their messages and files. Completed tasks can share a summary and protected link through the mobile share sheet, email, WhatsApp or clipboard; attachments are not included and no access rights are changed. Groups do not yet support changing participants, message edits/deletion, mentions or voice/video calls.

Chat uses visible-page polling (messages every five seconds; conversation list every fifteen seconds), cursor-based message pages of 50, 5,000-character messages, a per-sender throttle and idempotent send identifiers. PDF, JPEG, PNG, Excel and CSV attachments are limited to 10 MB and downloaded through authenticated requests. Muting a conversation stops its push alerts while retaining unread messages. Notification taps open the specific chat. Push content identifies the conversation without exposing message text on the lock screen. Phone delivery still depends on permission, connectivity and OS settings. Push notifications request sound and vibration; notification tones, Silent mode and Do Not Disturb remain controlled by the phone.

Schema migrations are applied transactionally on Windows startup. The update script stops the process and preserves the old runtime, database/WAL and uploads in private storage before migration. Daily online database backups include both task documents and chat attachments; only verified completed backups count toward retention of 14. Off-server backups and external integrations are not configured.

Windows checks: `node windows/test.mjs` (disposable integration database), `node windows/notification-test.mjs` (isolated provider stub, no real pushes). Build before running these checks.


An installable task management web application for an internal team of about 100 employees.

## Included

- Administrator, manager, and executive permissions enforced on the server.
- Task assignments, deadlines, priorities, acknowledgements, and work status.
- Separate daily, weekly, and monthly occurrences. Month-end dates preserve the original day, with shorter months clamped. Daily tasks can skip weekends.
- Private Excel, CSV, PDF, and JPEG submissions (20 MB per file). PDFs and JPEGs open for review; spreadsheets download for review.
- Submit, approve, and return for correction with a new deadline. Returned tasks can be resubmitted with remarks using an existing attachment; a revised document is optional.
- In-app notifications, encrypted standards-based Web Push, VAPID authentication, delivery logs, expired subscription cleanup, and bounded retries.
- Configurable working hours, pre-deadline reminders, overdue repeats, and escalation to the assigning manager. All workday times use Asia/Kolkata.
- PWA manifest, Android/maskable/iPhone icons, service worker, offline fallback, install instructions, and test notifications.
- Search, status/priority filters, board/list views, a team directory, and document library.

## Sign-in and employee access

Sites supplies authenticated identity. The first visitor on the initially owner-private site becomes the administrator. Employees sign in with their ChatGPT account. Add an employee with that account's email under Team, and separately grant them access through the Sites access policy. Adding a database member does not send any email or change site access. The initial publication is owner-private.

This version is built for one organization. People can access only tasks they assigned or are assigned to, along with those tasks’ documents and discussions. The assigning manager reviews submissions. Administrators can manage employees and reminder settings. Deactivating an employee blocks access and push delivery without deleting history.

## Phone setup

Open the deployed URL on the phone. Install using Chrome's menu on Android or Safari's Share → Add to Home Screen on iPhone. iPhone push requires iOS 16.4 or later. Open the installed app, sign in, and use Settings → Enable notifications → Send test. The app requires an internet connection for reading and submitting work. The offline screen does not cache employee records or documents.

## Background processing

`POST /api/maintenance` generates recurring tasks, creates reminders, escalates overdue work, and retries push deliveries. New assignment and submission notifications are attempted immediately. Maintenance is intended to be called hourly through a linked Sites cloud schedule, with runtime service access supplied by Sites. Reminder timing has hourly granularity and follows configured working hours. Notifications are deduplicated by task/deadline/interval. The last successful check is shown in Settings.

The maintenance endpoint relies on the Sites private access boundary for unattended service calls. Preserve restricted Site access. If converting the Site to public, add an application-level service credential before doing so. Employee account membership is separately checked on all data APIs.

The linked schedule uses a self-contained request and does not need external source data. Each run retrieves the current Site's service access using the native get_site tool, POSTs to the deployed origin's `/api/maintenance` using `OAI-Sites-Authorization: Bearer <runtime token>`, and verifies the returned lastRun. The runtime token must never be written to source, automation prompts, command arguments, or logs. The scheduler is independent of an open browser or the author's laptop.

## Local development

Node 22.13+ and pnpm 11.25 are required.

1. `pnpm install`
2. `pnpm run build`
3. Apply the committed SQL migrations in order using the local D1 commands documented in the Sites starter skill. Use `.wrangler/state` as the persistence directory.
4. `pnpm run dev`
5. Follow the local sign-in link. Local mock sign-in uses `seedy@sites.test` and is excluded from the production build.

Publish through the Sites skill. `.openai/hosting.json` declares the DB and BUCKET bindings. Private task records and file contents remain in D1/R2 and are not in the source repository.

## Verification

- `pnpm exec tsc --noEmit`
- `node tests/recurrence.mjs`: daily/weekly recurrence, month-end recovery, leap years, and IST midnight.
- `node tests/web-push.mjs`: independently decrypts the outgoing Web Push payload and verifies the VAPID signature/audience; rejects untrusted endpoints.
- `node tests/integration.mjs`: 54 assertions against the built local Worker at port 8787. Covers role enforcement, task/document privacy, upload validation, submit/return/resubmit/approve, deactivation, recurring generation, reminder deduplication, and PWA assets. This creates test records and must only run against local test storage.
- Desktop and 390px mobile browser QA covers installation guidance, task creation, and task details.

Actual phone push delivery depends on device permission, connectivity, and operating-system settings. The app records service acceptance rather than claiming the user read the alert. Acknowledgement is a separate executive action.
