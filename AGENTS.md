# SCHOLARS — AI ENGINEERING OPERATING RULES

## 1. Project Context
Scholars is a production scholarship discovery and eligibility-matching platform.
Repository: ImperioKDB/Scholars.
Production domain: https://scholars.com.ng

The platform uses Next.js, React, TypeScript, Supabase, Vercel and related services.

Understand the existing architecture before proposing or implementing changes.
Do not assume the documentation or previous audit reports are perfectly current.

## 2. Mandatory Operating Principles
- Inspect before modifying.
- Understand the full execution path of a feature before changing it.
- Prefer minimal, targeted changes over unnecessary rewrites.
- Preserve existing functionality and backward compatibility.
- Do not introduce unnecessary dependencies.
- Do not duplicate existing utilities, components, hooks or services.
- Never claim a task is complete without verification.

## 3. Production Safety — STRICT
Never perform these actions without explicit approval from the user:
- Deploy to production.
- Merge pull requests into main.
- Push commits directly to main.
- Modify production database records.
- Execute destructive SQL or database migrations.
- Delete user records, scholarship records or uploaded files.
- Change production environment variables or secrets.
- Modify authentication, authorization or RLS policies in production.
- Disable security controls.
- Change billing, hosting or subscription settings.

Prefer a feature branch for all code modifications.

Do not assume that permission to investigate a problem also grants permission to fix it.

Do not assume that permission to fix a problem grants permission to deploy it.

## 4. Database and Supabase Safety
- Inspect existing schemas, migrations, constraints, indexes, triggers and RLS policies before proposing database changes.
- Never execute destructive SQL.
- Never expose service-role keys or database credentials.
- Never bypass RLS as a workaround for an authorization problem.
- Distinguish clearly between local, development, staging and production environments.
- Do not modify production data during testing.
- Prefer synthetic test data and isolated test environments.

## 5. Authentication and Security
Treat authentication, authorization, account recovery, email verification and access control as security-critical.

For changes in these areas:
- Trace the complete authentication and authorization flow.
- Check middleware, server routes, client components and Supabase policies.
- Consider unauthenticated users, authenticated users and administrators separately.
- Test unauthorized access and redirect behaviour.
- Never log passwords, tokens, OTPs, cookies or private user information.
- Do not weaken security to make a test pass.

## 6. Engineering and Testing
Before changing code:
1. Inspect the relevant files.
2. Identify dependencies and affected functionality.
3. Explain the intended change.
4. Check for existing tests.

After changing code:
1. Run relevant tests.
2. Run TypeScript checks where applicable.
3. Run lint checks where applicable.
4. Run a production build when appropriate.
5. Inspect the final diff.
6. Report any checks that could not be completed.

Do not hide failed tests or warnings.

Never report a test as passed if it was not actually executed.

## 7. Change Management
- Do not overwrite unrelated user changes.
- Do not reset, clean or discard uncommitted changes without approval.
- Do not force-push.
- Do not amend or rewrite existing commits without approval.
- Keep changes focused and reviewable.
- Use descriptive branch names and commit messages.

## 8. Research and Investigation
When investigating a bug:
- Reproduce it where possible.
- Trace its root cause instead of treating symptoms.
- Separate confirmed findings from hypotheses.
- Cite exact file paths and relevant code locations.
- Identify the evidence supporting each conclusion.
- Do not invent implementation details.

When information is uncertain, label it clearly as unverified.

## 9. Documentation and Reporting
For substantial tasks, create a Markdown report containing:
- Objective
- Scope
- Investigation performed
- Confirmed findings
- Files inspected
- Files changed
- Tests executed and results
- Risks and unresolved issues
- Recommended next steps

When requested, publish reports to the separate repository:
ImperioKDB/Updates

Do not publish secrets, credentials, personal data or sensitive production information.

## 10. Communication
- Explain technical decisions in clear language.
- Distinguish investigation, implementation, verification and deployment.
- Ask before taking actions with production impact.
- Do not claim access to a service or resource that has not been verified.
- Give precise instructions that can be followed in GitHub Codespaces on a mobile device.

## 11. Final Rule
The priority order is:

1. User data safety
2. Platform security
3. Production stability
4. Correctness
5. Maintainability
6. Performance
7. Convenience

A smaller verified change is preferable to a broad unverified rewrite.
