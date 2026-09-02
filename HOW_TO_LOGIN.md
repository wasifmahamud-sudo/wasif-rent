# কীভাবে নতুন ওয়েবসাইটে ঢুকবেন (How to enter the new website)

নতুন অ্যাপ এখনো আপনার Netlify-এ ডিপ্লয় হয়নি। নিচের ধাপগুলো ফলো করুন।

## ধাপ ১: Supabase প্রজেক্ট তৈরি

1. https://supabase.com এ গিয়ে সাইন আপ / লগইন করুন
2. **New Project** তৈরি করুন (নাম: wasif-rent বা যা খুশি)
3. Database password সেভ করে রাখুন
4. প্রজেক্ট ওপেন হলে বাম দিকে **Project Settings → API** এ যান
5. দুটো জিনিস কপি করুন:
   - **Project URL** (যেমন: https://xxxx.supabase.co)
   - **anon public** key

## ধাপ ২: ডাটাবেস সেটআপ

1. Supabase-এ **SQL Editor** খুলুন
2. `supabase/schema.sql` ফাইলের **পুরো কোড** কপি করে পেস্ট করুন → **Run**
3. Table Editor-এ houses, rooms, tenants, bills ইত্যাদি টেবিল দেখা যাবে

## ধাপ ৩: Admin অ্যাকাউন্ট তৈরি

1. Supabase → **Authentication → Users → Add user**
2. Email + Password দিয়ে ইউজার তৈরি করুন (এটাই আপনার Admin লগইন)
3. ইউজারের **UUID** কপি করুন
4. SQL Editor-এ রান করুন:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'এখানে-UUID-পেস্ট-করুন';
```

## ধাপ ৪: লোকাল বা Netlify-এ চালানো

### লোকাল (টেস্টের জন্য):
```bash
cd rent-app
cp .env.example .env
# .env ফাইলে VITE_SUPABASE_URL এবং VITE_SUPABASE_ANON_KEY বসান
npm install
npm run dev
```
ব্রাউজারে http://localhost:5173 খুলবে → Login পেজ দেখাবে।

### Netlify-এ ডিপ্লয়:
1. GitHub-এ rent-app ফোল্ডার পুশ করুন
2. Netlify → New site from Git
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Environment variables যোগ করুন:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
6. Deploy → নতুন লিংক পাবেন (যেমন wasif-rent-v2.netlify.app)

## ধাপ ৫: লগইন

- নতুন সাইটের লিংকে যান
- Admin email + password দিয়ে Login
- Dashboard দেখাবে

Tenant তৈরি করতে চাইলে পরে Admin থেকে (বা SQL দিয়ে) tenant রেকর্ড + auth user লিংক করতে হবে।

---

**বর্তমান স্ট্যাটাস (আমি যা করেছি):**
- ✅ Database schema + RLS (সিকিউরিটি)
- ✅ Login পেজ (email/password + forgot password)
- ✅ Admin Dashboard (stats + navigation)
- ✅ Tenant Dashboard (read-only bill view)
- ✅ Protected routes (role based)
- ⏳ Bills table, Payments form, Rooms, full CRUD – পরের ধাপে

আপনি Supabase সেটআপ করে দিলে আমি বাকি UI দ্রুত শেষ করে দিতে পারি।
