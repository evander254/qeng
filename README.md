# VOSKI class workspace

## Supabase setup

1. Create a `.env` file in the project root by copying `.env.example`. The supplied project URL and publishable key are already in that template. A publishable key is intended for browser use; never put a Supabase `service_role` key in this app.
2. In Supabase **SQL Editor**, run `supabase/schema.sql`. If you already ran an earlier version, run the updated file again to add username login, owner-only progress updates, and class end dates (users can update assignment status, not assignment details).
3. In **Authentication → Users**, create the initial account using the intended email address, username metadata `Qeng`, and the initial password `Invincible`. Confirm the email if your Auth settings require it. This is a shared/default credential: treat it as temporary and change it immediately after the first login. It is deliberately not embedded in this repository or SQL.
4. Run `supabase/promote-qeng-admin.sql` in SQL Editor. This promotes the profile whose username is `Qeng` and approves it. The updated `supabase/schema.sql` and `supabase/seed.sql` also apply this bootstrap promotion when run after that profile exists.

5. Run `supabase/seed.sql` in SQL Editor. It imports the preserved assignments, students, and classes into the Qeng account. Re-running it will not duplicate matching assignment rows.
6. Start the app with `npm run dev`. Users register with email and password; new accounts remain pending until an admin approves them in **Admin console**. The admin console can also add assignments to any approved user.

## Access model

The app uses Supabase Auth sessions and Row Level Security. Approved users can read only records assigned to their account and update only each assignment's status; admins can review profiles and manage assignments for users. The browser uses only the publishable key. Keep Supabase Auth email confirmation enabled if you want email ownership verified before approval.

Sign-in accepts either email or username. Username sign-in resolves the matching Auth email through a restricted read-only SQL function before Supabase verifies the password. Because the login form needs that mapping, usernames can be used to discover their associated email; use non-sensitive usernames and an email-address policy appropriate for your organization.

## Local commands

- `npm run dev` — development server
- `npm run build` — production build
- `npm run preview` — preview production build
# qeng
