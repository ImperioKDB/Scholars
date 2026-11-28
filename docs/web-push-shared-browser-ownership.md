# Web Push ownership on a shared browser

## Finding

A valid subscription can display notifications from a previous Scholars account after an account switch in the same browser profile. This follows from the source and schema. Whether production currently has such duplicate endpoint associations was outside this investigation.

- The service worker registration and its PushSubscription belong to the browser origin. Switching accounts in the student sidebar signs out through Supabase and redirects to login. It does not change the subscription or retire its row. See `components/Sidebar.tsx` and `lib/push/browser.ts`.
- Settings can synchronize that same subscription for the next account. The upsert and table uniqueness constraint use `(profile_id, endpoint)`, so both rows can exist with the same endpoint and encryption keys. The existing RLS policies protect each account’s rows from the other and allow this state. See `app/api/push/subscription/route.ts` and `supabase/migrations/0078_add_web_push_subscriptions.sql`.
- Delivery reads enabled rows for the target profile and sends their endpoint and keys with the notification title, body, and URL. The service worker displays those fields without checking which account is signed in. An accepted push for the earlier account can therefore appear on the shared device, including while signed out. Authentication on the inbox cannot protect text already displayed by the operating system. See `lib/push/deliver.ts` and `public/sw.js`.

## Separate remediation proposal

The smallest privacy containment is a generic Web Push title and body with a fixed authenticated inbox destination. Apply this at Web Push delivery and at the service worker display boundary so an updated worker also sanitizes previously queued payloads. Inbox contents and other delivery channels can retain their existing detail. This still allows a generic alert to arrive on the shared device.

To resolve the endpoint association itself in a follow-up, detach the exact current-device subscription during intentional sign-out while the original account is authenticated. Unsubscribe the browser endpoint so existing duplicate rows cannot continue reaching it, then require explicit setup for the next account. Test both partial-failure orders and preserve the other devices on both accounts. Session expiry and account switches outside the sign-out path would still need separate handling. Keep the existing per-account RLS and avoid automatically transferring ownership or deleting other accounts’ rows.

Validate with two synthetic accounts in one browser profile, inspecting stored rows and service-worker display through a fake push provider. Do not use production notifications or capture subscription endpoint URLs in logs.
