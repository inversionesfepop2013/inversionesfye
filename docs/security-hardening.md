# Security hardening follow-up

This change adds `api/admin-secure.js` and `supabase/security-hardening.sql` on `main`.

Before deploying:
1. Review and resolve duplicate profile email/phone/document values; unique indexes intentionally fail rather than silently choose a duplicate.
2. Apply the migration in Supabase SQL Editor.
3. Set private Vercel variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `PUBLIC_SITE_URL`. Never use the service role key in browser code.
4. Add a restricted administrative UI that calls `POST /api/admin-secure` with the signed-in Supabase access token and `{ action, user_id, reason? }`. Actions supported: approve, reject, block, reset_password. Admin privileges are resolved from the server-read `profiles.role`; request-supplied email/role is ignored.
5. The password reset action asks Supabase Auth to send its official recovery email. It never reads or sets the customer's password.
6. Configure Supabase Auth's built-in email/password rate limits and CAPTCHA for public login/sign-up/recovery in the Supabase dashboard; these flows must not rely on browser-only throttles.

The current endpoint audits administrative actions with timestamp and request IP. Do not expose service-role credentials, and do not use an administrator password shared in Vercel environment as a substitute for individual Supabase admin accounts.

Session timeout belongs in the admin UI: track user activity and call `supabase.auth.signOut()` after the chosen idle period; server endpoints still validate the access token on every request.

Remaining UI/legal work: edit the existing `index.html` contract text to remove its historic third-party account details and specify that deposits are accepted only in person at the office; correct its home link; add the password-reset button; configure real admin idle logout. Deploy this branch/commit to Vercel before these changes affect the live site.
