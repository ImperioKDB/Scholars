# Online-triggered install and push prompts

## Implementation

- Add nullable account-level timestamps on `profiles`: `pwa_installed_at` and `push_enable_clicked_at`.
- Expose only the signed-in user's prompt state through `/api/onboarding/prompts`; PATCH accepts only the two whitelisted actions and relies on existing owner-only RLS plus column grants.
- Keep `beforeinstallprompt` collection in the root layout, but expose its custom modal through a small client-side controller so the student shell can request it only after a successful presence transition.
- Make the presence hook report only genuine online transitions: first successful authenticated response, and recovery after a failed response or hidden-tab gap. Remove the older duplicate heartbeat from `Sidebar`.
- On each transition, the student shell checks account state and standalone mode, shows install first when available, then requests the push modal. The push modal checks permission, browser support, VAPID configuration, and existing subscription before opening.
- Native install and notification permission calls remain inside explicit button handlers. Dismissal leaves account timestamps unset; in-memory transition guards prevent repeats until a later genuine transition.

## Project structure

- `components/InstallAppPrompt.tsx`: early browser event collector and controlled install UI.
- `components/PushNotificationPrompt.tsx`: controlled push consent UI and action persistence.
- `components/Sidebar.tsx`: authenticated student coordinator and presence transition consumer.
- `lib/presence.ts`: HTTP-success-based presence transition hook.
- `lib/onboarding-prompts.ts`: pure eligibility and sequencing rules with unit tests.
- `app/api/onboarding/prompts/route.ts`: self-only account-state read/write endpoint.
- `supabase/migrations/0080_add_prompt_action_state.sql`: additive schema and column grants.
