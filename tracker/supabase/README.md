# Supabase setup for a new project

Use this when the original Supabase project isn't available. It creates everything the app reads and writes through Supabase:

| What | Used for |
|---|---|
| `user_data` | Each member's synced app data |
| `queue_items` | Form Check, lab check, unmatched food and coach requests |
| `email_prefs` | Email reminder settings |
| `billing`, `pay_*`, `app_meta` | Plans and payments (written only by `/api/pay` and `/api/pay-webhook`) |
| `delete_my_account()` | Account → Delete account |
| Storage bucket `form-videos` | Form Check uploads, private, one folder per member, 150 MB limit |
| Edge function `signup` | Email + password sign-up, confirmed straight away |

Every table has row-level security, so a member can only read and change their own rows. Billing is read-only for members.

## 1. Create the project

supabase.com → New project. Region: Mumbai (ap-south-1). Save the database password somewhere safe.

## 2. Run the SQL

SQL Editor → New query. Paste and run each file **in this order**:

1. `migrations/20261018_core.sql`
2. `migrations/20261019_payments_billing.sql`

(Or with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.)

## 3. Deploy the sign-up function

Edge Functions → Deploy a new function → name it `signup` → paste `functions/signup/index.ts` → **turn off "Verify JWT"** (the app calls it before anyone is signed in) → Deploy.

CLI alternative: `supabase functions deploy signup --no-verify-jwt`

It accepts browser calls from `https://www.peakx.in` and `https://peakx.in`. To allow another origin (for example a Vercel preview URL), add an Edge Function secret `ALLOWED_ORIGINS` with a comma-separated list.

## 4. Authentication settings

- **URL Configuration:** Site URL `https://www.peakx.in/app`; Redirect URLs `https://www.peakx.in/app` and `https://www.peakx.in/app/**`.
- **Providers → Email:** on. "Confirm email" can stay on: the sign-up function confirms accounts itself.
- **Providers → Google** (optional): needs a Google OAuth client (Web application) with the redirect URI Supabase shows on that page and `https://www.peakx.in` as an authorised JavaScript origin. Then set `VITE_SUPABASE_GOOGLE=true` in Vercel.

## 5. Vercel environment variables

From Project Settings → API Keys (or API):

| Vercel variable | Value |
|---|---|
| `VITE_SUPABASE_URL` and `SUPABASE_URL` | Project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_…`) or legacy anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (`sb_secret_…`) or legacy service_role key. Server only. |
| `VITE_SUPABASE_GOOGLE` | `true` once Google sign-in is set up, otherwise `false` |

`VITE_` variables are read when the site builds, so redeploy after changing them.

## Not covered by Supabase yet

The app is partway through moving from Firebase to Supabase. These server features still read Firebase (Firestore) through `FIREBASE_SERVICE_ACCOUNT`, and won't see members whose data lives in Supabase:

- Weekly report and daily nudge emails (`/api/cron/*`)
- Coach desk (`/api/ops`) and the usage collector (`/api/events`)
- Wearables (`/api/devices`) and the calendar feed / unsubscribe links (`/api/feed`)
- The Pro check for the AI Coach when `ENFORCE_PLANS=true`

Everything members do in the app (sign-up, sync, plans and payments, Form Check uploads, coach requests, email settings) works on Supabase alone. Coaches can review `queue_items` and uploaded videos in the Supabase dashboard until the coach desk is moved over.
