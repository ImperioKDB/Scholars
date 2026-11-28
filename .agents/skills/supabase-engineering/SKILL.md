---
name: supabase-engineering
description: Plan and verify Scholars Supabase Auth, Postgres, RLS, grants, RPCs, and migrations. Use when changing or diagnosing these contracts or their client boundaries.
---

Read `lib/supabase/` and trace the caller through its public, session-bound, or service client. Inspect the relevant migrations, SQL tests in `supabase/tests/`, and caller tests. Use the existing `supabase` skill for platform details.

Check grants and RLS together. For RPCs, verify signatures, return types, callers, execution grants, and any definer search path. Account for repeated legacy numeric prefixes when inspecting migration order. Compare the intended target's applied history before an approved rollout and use a uniquely versioned follow-up for corrections.

Use isolated synthetic data to check anonymous, owner, other-user, and privileged access as applicable. Confirm query and RPC compatibility with existing callers and preserve SQL assertions. Follow the root approval gate for execution. If history, privileges, or target identity differs from expectations, stop execution and report the discrepancy and forward recovery options.
