# Scholars email OTP migration

## Existing architecture assessed

- Browser auth uses `@supabase/ssr` browser cookies and `@supabase/supabase-js` `^2.45.0`.
- Signup calls `supabase.auth.signUp()` with `full_name` metadata. The database trigger `public.handle_new_user()` creates the matching `profiles` row idempotently.
- Google OAuth continues through `/auth/callback`, which exchanges the PKCE code and applies referral/campaign attribution.
- Password login remains `signInWithPassword()`.
- The previous signup and unconfirmed-login rescue displayed a confirmation-link screen and used `resend({ type: "signup" })`.
- The previous recovery flow called `resetPasswordForEmail()` with a redirect to `/reset-password/update`, where link/session handling eventually enabled `updateUser()`.
- Middleware protects `/dashboard`, `/onboarding`, and other private routes through `auth.getUser()`. Existing users and profile relationships do not require a schema change for OTP.

## Repository implementation

- `components/AuthOtp.tsx` is the shared mobile OTP screen. It supports six individual inputs, automatic focus movement, complete-code paste, backspace navigation, automatic verification, duplicate-submit prevention, loading/error states, a masked destination email, and a 60-second resend cooldown.
- `app/(auth)/signup/page.tsx` now calls `verifyOtp({ email, token, type: "signup" })` and routes the established session to the existing safe destination.
- `app/(auth)/login/page.tsx` uses the same signup OTP screen when an existing unconfirmed account attempts password login.
- `app/reset-password/page.tsx` now calls `resetPasswordForEmail()`, verifies `type: "recovery"`, and only then renders the password-update form. Password strength and confirmation checks remain in place.
- Google OAuth, normal email/password login, Supabase Auth, Brevo SMTP, profile creation, onboarding, RLS, and existing user IDs are preserved.

## Supabase dashboard changes required

These changes are external to the repository and must be applied in the Supabase dashboard before enabling the review branch for real users.

### Confirm signup email

Subject: `Verify your Scholars account`

The body must include the literal OTP variable `{{ .Token }}` as the six-digit code. Do not use `{{ .ConfirmationURL }}` or any clickable confirmation URL. The email should explain that the code verifies a new Scholars account, state that it expires, warn the recipient not to share it, and say to ignore the email if they did not create an account.

Example minimal HTML content:

```html
<h1>Verify your Scholars account</h1>
<p>Enter this six-digit code in Scholars to verify your email:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;">{{ .Token }}</p>
<p>This code expires soon. Do not share it with anyone.</p>
<p>If you did not create a Scholars account, you can ignore this email.</p>
```

### Reset password email

Subject: `Your Scholars password reset code`

The body must include the literal OTP variable `{{ .Token }}` and must not use `{{ .ConfirmationURL }}` or a reset link. Explain that the code authorizes a password change, state that it expires, warn the recipient not to share it, and say to ignore it if they did not request a reset.

Example minimal HTML content:

```html
<h1>Your Scholars password reset code</h1>
<p>Enter this six-digit code in Scholars to choose a new password:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;">{{ .Token }}</p>
<p>This code expires soon. Do not share it with anyone.</p>
<p>If you did not request a password reset, you can ignore this email.</p>
```

Preserve the existing Scholars branding and Brevo SMTP configuration when applying the final HTML. Do not alter email-change, invitation, reauthentication, or unrelated templates.

### URL configuration

OTP entry itself does not require a confirmation or recovery callback URL. Keep `/auth/callback` in the redirect allowlist because Google OAuth still uses it. Keep the existing Scholars production and preview URLs that are required by Google OAuth and any legacy emails still in circulation.

### Verification settings

Confirm that email confirmation remains enabled. Do not disable “Confirm email,” weaken session security, or change password policy. Supabase must remain responsible for OTP generation, expiry, single use, and rate limiting.

## Security and compatibility notes

The recovery screen does not reveal whether an email exists; it only advances after Supabase accepts the recovery request. Client-side throttling supplements, but does not replace, Supabase limits. Existing verified users continue to log in normally, and Google users continue through the existing callback. No user, password, profile row, database policy, or provider configuration was changed by the repository work.

The old `/reset-password/update` route remains available as a compatibility path for already-issued legacy recovery links. New recovery requests from the migrated UI do not navigate there and instead use the OTP stage in `/reset-password`.

## Required rollout sequence

1. Apply and save the two Supabase Auth template changes above.
2. Confirm the confirmation and recovery templates render `{{ .Token }}` rather than a URL.
3. Validate the review branch in a non-production/staging project or with a controlled internal account.
4. Test signup OTP, recovery OTP, invalid/expired/reused codes, resend cooldown/rate limiting, normal login, Google OAuth, onboarding, protected routes, and session persistence.
5. Obtain explicit production authorization before merging or deploying.

No production deployment or Supabase dashboard change is included in this branch automatically.
