# Scholars engineering constitution

## Investigation and implementation

- Inspect the current branch, worktree, applicable instructions, and the actual entry point. Trace inputs, callers, data contracts, and failure paths. Establish the root cause with code, a controlled reproduction, or sanitized telemetry before implementing a fix. Record uncertainty and gather evidence when the cause is unresolved.
- Preserve compatibility with existing clients, persisted records, and operational workflows. For contract changes, plan rollout order, mixed-version behavior, and recovery. Keep work bounded through pagination, explicit timeouts and retry limits, and measured concurrency. Choose indexes, caching, and background work from observed bottlenecks and account for infrastructure cost.
- Treat committed migrations as immutable. Make corrections in uniquely versioned follow-up migrations. Preserve the behavior and coverage of existing test assertions. Change an expectation only for an explicitly authorized contract change and explain the evidence for it.

## Security and operational authority

- Apply least privilege and verify authentication, authorization, tenant boundaries, and handling of student data at the server and database. Keep credentials, tokens, student records, and contact details out of diffs, logs, fixtures, and reports. Use synthetic fixtures and redact diagnostics.
- Verify the actual Worker, Supabase project, dependencies, scheduler, and delivery target before credentialed operations. Keep staging and production credentials, data, provider destinations, and schedules isolated. Stop if any target is ambiguous.
- Obtain explicit operator approval before production deployments, any other production mutation, destructive operations, migration execution against any database, or real notification dispatch. Approval must identify the action, target, and scope. Treat workflow dispatches, cron invocations, and pushes that trigger production deploys as subject to the same gates. Confirm rollback or containment and verify the result after an approved action.

## Qualification and delivery

- Use checked-in scripts and the CI workflow as the starting point. Execute the relevant checks against the intended revision and environment. Record commands, outcomes, and skipped or blocked checks. Never fabricate results or represent inspection, mocks, dry runs, or old CI results as execution evidence for another environment.
- Branch from the intended verified base, preserve unrelated work, review the staged diff, and commit only authorized changes. Push only the intended branch. Use PR review and report scope, validation, compatibility, and rollout risks. Obtain authorization before creating or updating a PR, merging, force-pushing, or rewriting shared history.
- Use the project skills in `.agents/skills/` for domain procedures. The existing upstream skills and `SCHOLARS_OPENCODE_POLICY.md` provide supporting guidance. The approval and evidence rules here apply across all skills.
