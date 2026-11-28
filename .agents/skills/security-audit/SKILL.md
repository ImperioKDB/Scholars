---
name: security-audit
description: Audit or harden Scholars authentication, authorization, data exposure, webhook trust, abuse controls, or secret handling. Use for defensive security review of a defined surface.
---

Map the affected trust boundary from `middleware.ts` and `app/api/` through `lib/supabase/`, relevant migration policies, and `lib/ratelimit.ts` where applicable. Review server-side identity checks, role enforcement, ownership, response fields, and behavior when dependencies fail. Include job credentials or callback validation when the surface crosses a scheduler or provider.

Keep verification in source and synthetic local or approved isolated environments. Verify denied access and valid access for each relevant role with existing or targeted regression assertions. Inspect logs and error responses for credential or student data exposure.

Record severity, preconditions, affected files, impact, defensive remediation, and verification. When access or evidence is incomplete, mark the finding unverified and identify the specific evidence needed. Escalate suspected exposure through the operator with redacted evidence.
