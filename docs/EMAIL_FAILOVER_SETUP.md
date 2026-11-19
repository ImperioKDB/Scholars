# Application Email Failover Setup

This feature covers application-side transactional email sent through `lib/email/send.ts`. Supabase Auth SMTP, signup confirmation, OTP, and password-recovery delivery are separate systems and are not affected.

## Architecture and configuration

The shared sender is the single orchestration layer. Independent native-fetch adapters call Brevo (`https://api.brevo.com/v3/smtp/email`) and Resend (`https://api.resend.com/emails`). Brevo is primary whenever both `BREVO_API_KEY` and `REMINDER_FROM_EMAIL` are configured. A complete Resend configuration consists of `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Resend is used directly if Brevo is not configured. It is used as fallback only after a definitive Brevo rejection. The sender address is always provider-specific; the Brevo address is never substituted for a missing Resend sender. A Resend API key without its sender disables Resend and generates a warning. If neither provider is fully configured, the existing dry-run response is preserved.

Set these server-only variables in the deployment environment before activation:

- `BREVO_API_KEY`
- `REMINDER_FROM_EMAIL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

No credential belongs in source control. Verify the sending domain and sender identity in Resend before production use. Also check Resend's current free-tier sending limits and verified-domain restrictions before using it for a large broadcast; do not assume the fallback can handle the entire student audience.

## Fallback and error classifications

Provider exceptions expose only provider, HTTP status, a constrained stable provider error code when available, and a classification. Raw response bodies, API keys, authorization headers, and recipient data are not included.

Brevo HTTP 400, 401, 402, 403, 404, 405, 406, 422, and 429 are treated as definitive request rejections. In particular, documented `not_enough_credits` errors (commonly HTTP 402) can activate Resend. Brevo's documentation specifies 429 as the response when a rate limit is exceeded; that explicit rejection is therefore eligible for fallback. HTTP 408 and 409, 5xx, network failures, and unknown statuses are uncertain. An uncertain Brevo result never starts a Resend send, because Brevo may already have accepted the email.

Resend is the final provider. Its uncertain results, network errors, 5xx, and all 409 responses—including an idempotent request that may still be in progress—are treated conservatively. No automatic third provider or blind resend follows a Resend failure.

## Idempotency and delivery records

Resend requests carry stable logical-delivery keys: `digest/<notification-delivery-id>`, `profile-nudge/<notification-delivery-id>`, `broadcast/<broadcast-id>/<recipient-user-id>`, and `independence-day/<campaign-id>/<recipient-user-id>`. Keys do not contain email addresses and remain stable when the same logical operation is repeated. Resend documents a 24-hour retention period for these keys; this protects repeated Resend requests within that window, not calls made through Brevo.

Successful digest and profile-nudge deliveries persist the provider's returned message ID in `notification_deliveries.provider_message_id`. Broadcast and Independence Day deliveries persist it in `broadcast_delivery_log.provider_message`. The existing `sent` and `failed` broadcast statuses are retained. A safe diagnostic code distinguishes an uncertain outcome from confirmed non-delivery in the failed log record.

Uncertain digest and profile-nudge provider outcomes become `dead_letter`, so the notification claim function cannot reclaim them as retryable. Definitive provider rejections become terminal `failed`. The broadcast endpoints no longer loop on provider errors. This avoids blindly repeating requests after a timeout or uncertain response.

This is not an exactly-once system. Brevo's used endpoint has no equivalent idempotency guarantee. There is an unavoidable crash window if a provider accepts a message and the process terminates before the application persists that acceptance. An expired lease can then be reclaimed. Resend's key mitigates repeated Resend calls within its retention window, but does not close the cross-provider crash window.

## Testing

Run `npm test` for the Vitest suite. Also run `npm run lint` and `npx tsc --noEmit` where dependencies and the project's environment are available. Provider adapter and orchestration tests use mocked native `fetch`; they do not send email. A manual test requires a controlled recipient and fully configured provider credentials. Never use a production-sized audience for a test send.

## Activation and rollback

After the feature branch is reviewed and merged, configure the desired provider variables in the deployment environment and deploy through the normal release process. Test one controlled transaction, confirm the provider message ID is recorded, and verify logs show only safe diagnostics. Keep Resend's sender domain verified and confirm current account limits before enabling large batches.

To roll back, revert the feature commit and deploy the prior application version. This feature adds no database migration, so there is no schema rollback. Removing the Resend variables also disables the fallback, but if Brevo is configured it remains the primary sender; to disable all application-side sending, remove or unset both complete provider configurations. Do not alter Supabase Auth settings as part of this rollback.

## Provider references

- [Brevo API rate limits](https://developers.brevo.com/docs/api-limits)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Brevo API behavior](https://developers.brevo.com/docs/how-it-works)
