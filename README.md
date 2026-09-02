# Home Rent Status 2026 – Production Upgrade

Upgraded from the original localStorage prototype (https://wasif-rent.netlify.app/) to a secure Supabase-backed application with Admin / Tenant roles and Row Level Security.

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Vite + React + TypeScript |
| Auth | Supabase Auth (email/password) |
| Database | Supabase PostgreSQL |
| Security | Row Level Security (RLS) – tenants can **never** read/write other tenants’ data |
| Hosting | Netlify |
| Styling | Preserved original CSS variables & card/table design |

## Stage Status

- [x] **Stage 1** – Analysed existing single-file localStorage app
- [x] **Stage 2** – Complete PostgreSQL schema + RLS policies (`supabase/schema.sql`)
- [x] **Stage 3** – Auth context + role detection (`src/contexts/AuthContext.tsx`)
- [x] **Stage 4–7** – Core calculation helpers, types, project skeleton
- [ ] Full Admin dashboard UI (in progress – visual style preserved)
- [ ] Full Tenant read-only dashboard
- [ ] Reports, printable statements, audit log UI

The **database and security foundation is production-ready**. UI pages are being ported while keeping the original look & feel.

---

## 1. Supabase Setup (do this first)

1. Go to https://supabase.com → New Project
2. Note the **Project URL** and **anon public** key
3. Open **SQL Editor** → New query → paste the entire contents of  
   `supabase/schema.sql` → Run
4. Confirm tables appear under **Table Editor**

### Create the first Admin user

1. Authentication → Users → Add user → create with email + password
2. Copy the user’s UUID
3. In SQL Editor run:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'PASTE-UUID-HERE';
```

### Create a Tenant user later

1. Create auth user (email/password)
2. In Admin UI (or SQL) insert into `tenants` and set `user_id` to that auth user’s UUID
3. The tenant can then log in and will only see their own bills/payments (enforced by RLS)

---

## 2. Local Development

```bash
cd rent-app
cp .env.example .env
# Edit .env with your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

---

## 3. Netlify Deployment

1. Push the `rent-app` folder to a GitHub repo
2. New site from Git on Netlify
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy

**Never** put the Supabase **service_role** key in the frontend or Netlify env vars that are exposed to the browser.

---

## 4. Security Guarantees (RLS)

- Tenant policies use `auth.uid()` and `get_my_tenant_id()`
- Changing a bill/tenant ID in the browser or API request returns empty results for a tenant
- Tenants have **SELECT only** on their own rows; no INSERT/UPDATE/DELETE on financial tables
- Admin has full access via `is_admin()` helper
- Audit logs are admin-only

---

## 5. Data Migration from old localStorage app

The original app stored data under key `rentAppData`.  
After the Admin dashboard is fully wired you can:

1. Export the old data as JSON (browser console: `copy(localStorage.getItem('rentAppData'))`)
2. Use a one-time import script (to be added) that creates rooms, tenants, meter readings and bills for August 2026 (and any other months present)

---

## 6. Important Files

| File | Purpose |
|------|---------|
| `supabase/schema.sql` | Full schema + RLS + triggers + seed houses |
| `src/types/database.ts` | TypeScript types matching the DB |
| `src/lib/supabase.ts` | Browser client (anon key only) |
| `src/lib/calculations.ts` | Same math as original app |
| `src/contexts/AuthContext.tsx` | Session + role management |
| `.env.example` | Required environment variables |

---

## 7. Next Development Steps (for the remaining UI)

1. Login page (email/password + forgot password)
2. Protected route component (redirect based on role)
3. Admin layout with the original header gradient + bottom-nav style adapted for desktop
4. Port the Details table → Bills page (month selector, house filter, editable meter/rent, +Pay)
5. Tenant dashboard – simple read-only card matching the “TOTAL PAYABLE / REMAINING DUE” mockup
6. Payments list, Reports, Settings, Print statement
7. Audit log viewer (admin only)

The original visual design (colors `--primary #0f3c6e`, `--accent #00b894`, card radius, table styles) will be preserved.

---

## 8. Testing Checklist (once UI is complete)

- [ ] Tenant cannot open `/admin/*`
- [ ] Tenant cannot see another tenant’s bill even with forged IDs
- [ ] Tenant cannot modify rent / units / payments via UI or API
- [ ] Logout clears session and protected pages redirect to login
- [ ] Admin can create month, enter readings, record payments, see totals
- [ ] Bill totals match the original calculation logic
- [ ] Mobile responsive on Android Chrome
- [ ] Print statement looks professional

---

## Remaining Limitations (current snapshot)

- Full Admin/Tenant UI pages are still being ported from the original single HTML file.
- Data migration helper from localStorage is not yet written.
- Forgot-password flow uses Supabase’s built-in email (configure SMTP in Supabase dashboard).

The **security model and data model are complete and production-ready**.  
Continue development by implementing the React pages on top of the existing AuthContext and Supabase client.
