# Scholarship Verification Agent — Current-State Architecture and Gap Analysis

**Repository:** `/home/ubuntu/Scholars`  
**Review basis:** Structured area reviews and checked-in repository evidence supplied for this synthesis.  
**Assessment posture:** Repository-only. Applied migrations, live RLS policies, deployed schedules, secrets, external providers, and runtime data were not inspected; statements about them are therefore qualified.

## Executive summary

Scholars has a useful **candidate quarantine ledger and admin-gated publication shell**, but not yet a production Scholarship Verification Agent. The implemented path is: manually/pilot-collected source pages → idempotent candidate ingestion → separate scheduled reachability, deterministic quality, and advisory AI eligibility passes → admin review → scholarship insertion. Candidate provenance, evidence excerpts, confidence, duplicate metadata, verification summary, quality result, eligibility-review JSON, review status, and publication linkage are represented in Supabase migrations.

The largest functional break is an internal contradiction: the collector hard-codes `deadline`, `amount`, and `discipline` as null and caps confidence at `0.6` (or `0.35`), while quality readiness requires a deadline, seven of eight checks, and confidence of at least `0.7`. Thus collector-produced candidates cannot normally become quality-ready without enrichment or mutation. A second contradiction is policy-related: the brief calls for source/content/application verification and human evidence-backed review, but publication checks only `approved` plus `quality_status=ready`, then creates `verified=false`. Verification is only an HTTP `HEAD` reachability check, and the AI eligibility result is advisory and not transferred into matching rules or used as a publication gate.

There are also material operational risks: the admin review client appears inconsistent with the candidate RLS policies as written; publication is two non-transactional writes; duplicate detection is bounded and advisory; there is no durable claim/lease/run history for the enrichment jobs; discovery scheduling is manual-first; and source freshness is not updated by the collector. The recommended path is to retain the candidate ledger, schemas, validation, scorer, workflow patterns, and admin boundary, then add a versioned extraction/verification contract, auditable state machine, safe fetch policy, durable workers, transactional publication, reviewer correction/attestation, and a single enforced readiness function.

## Current architecture

### Logical flow

```text
Configured source rows in Supabase
        |
        | enabled + pilot_enabled (runtime selection)
        v
Manual collector (same-host crawl, broad keyword filter, dry-run by default)
        |
        | CRON_SECRET-protected batch ingestion; sanitize, validate, idempotent upsert
        v
scholarship_discovery_candidates (quarantine ledger)
        |
        +--> duplicate heuristic (newest <=1,000 rows; advisory)
        +--> verification worker (scheduled; HEAD reachability only)
        +--> quality worker (scheduled; deterministic 8-point score)
        +--> eligibility worker (scheduled; Gemini evidence-only advisory JSON)
        v
Admin discovery queue (approve/reject/stale/publish)
        |
        | current gate: approved + quality_status=ready
        v
scholarships row (created verified=false) ---> public catalogue generally selects verified rows
```

### Components and boundaries

- **Source registry:** Runtime discovery selection is based on `discovery_sources` in Supabase. `config/discovery-sources.json` is a duplicate, all-disabled, apparently unused registry; it is not a reliable source of truth.
- **Collector:** `scripts/discovery_collector.py` fetches a source root and up to 120 same-host links, applies broad scholarship keywords, computes content hashes, and emits normalized candidate payloads. It is a pilot extractor, not a source-aware scholarship parser.
- **Ingestion API:** `app/api/integrations/github/scholarship-discovery/route.ts` uses CRON authorization, validation, sanitization, rate limiting, duplicate comparison, and idempotent upsert by `idempotency_key`. It uses the service client, which bypasses RLS.
- **Candidate data model:** Migrations 0042 and 0044–0048 add source, evidence, confidence, review, publication, duplicate, verification, quality, and eligibility-review fields. The candidate ledger is intentionally separate from the public catalogue.
- **Enrichment APIs:** Verification, quality, and eligibility are independent HTTP batch endpoints. They do not form a durable state machine, do not claim/lease rows, and overwrite latest summaries rather than preserving attempt history.
- **Admin review:** The authenticated admin API and page expose a queue and transitions. The UI shows evidence and an AI verdict but omits most decision-support fields and actions.
- **Publication:** The admin route inserts a new `scholarships` row and then updates candidate publication tracking. The two writes are not atomic.
- **Matching/catalogue:** Existing matching considers verified undergraduate/both scholarships and explicit `scholarship_rules`. Discovery AI requirements are not compiled into those rules. Public verified visibility is controlled by the catalogue's `verified` flag, not by discovery quality alone.
- **Automation:** Discovery workflow is manual-only in the checked-in file because its schedule is commented out. Verification, quality, and eligibility workflows are defined with six-hour schedules/manual dispatch, but execution and deployment configuration are unknown. Inngest/cron notification paths are present but intentionally inert or return zero work; these are adjacent automation debt, not a working discovery orchestration layer.

## Current state by stage

Status labels: **Implemented** means evidenced in code/schema; **Partial** means a usable slice exists but it does not satisfy the brief; **Missing** means no evidenced capability or no enforceable production path.

### 1. Source discovery and ingestion — **Partial**

**Implemented:** enabled/pilot source selection, same-host bounded crawling, keyword filtering, content hash generation, dry-run, CRON-protected ingestion, schema validation, sanitization, rate limiting, idempotent upsert, and candidate isolation.

**Partial/missing:** source-specific adapters cover four hosts, while a migration-added source lacks a dedicated adapter; the generic fallback is used. The collector stores the fetched page as the description, uses the first 1,800 normalized characters as evidence, sets the page URL as both application and canonical URL, and does not extract deadline, amount, discipline, canonical tags, application links, provider identity, or current-cycle data. It does not update `discovery_sources.last_crawled_at`, create run records, enforce robots/terms, or implement source-level retry/rate policy. The collector's confidence values make the downstream quality gate unreachable.

### 2. Candidate identity and duplicate handling — **Partial**

**Implemented:** idempotency key upsert, content hash field, self-referential duplicate metadata, and an ingestion-time fuzzy title/provider comparison.

**Missing:** normalized canonical URL uniqueness, content-hash constraints, same-batch comparison, scalable similarity search, duplicate disposition/merge workflow, and a publication block for unresolved duplicates. The newest-1,000-row in-memory scan can miss older or concurrent duplicates and can produce false positives.

### 3. Verification — **Partial, materially below brief**

**Implemented:** CRON-protected batch route, UUID validation, followed redirects, recorded status/final URL/HTTP code/notes/timestamp, and a queue including unverified, stale, or unreachable candidates.

**Missing:** substantive verification of provider/program identity, application path, deadline/open state, award facts, eligibility, page content, evidence freshness, and contradictions. Only `HEAD` is performed; redirects count as a positive `verified-or-redirected` result. There is no safe GET fallback, content snapshot/hash comparison, application URL check, source trust policy, freshness TTL/aging transition, attempt history, or human sign-off. `stale` exists in schema/query logic but no inspected worker ages rows into it.

### 4. Eligibility extraction and matching contract — **Partial**

**Implemented:** bounded, schema-validated Gemini advisory output with verdict, confidence, Nigerian/undergraduate flags, requirements, contradictions, reasons, and evidence quotes. Existing matching can evaluate reviewed `scholarship_rules`, report met/not-met/missing/unverifiable states, apply gates, and rank verified undergraduate/both scholarships.

**Missing:** a canonical extraction contract linking each normalized field/rule to typed value, operator, evidence span, source URL, extraction confidence, contradiction, parser/model/prompt version, and review decision. AI output is stored as metadata and not compiled into `scholarship_rules`; publication copies only broad fields. The model is never a source-verification substitute. Rule creation also has two inconsistent contracts: a stronger dedicated endpoint and a weaker inline creation schema.

**Semantic caveat:** matching eligibility labels are not equivalent to verification. Missing data, neutral no-rule scoring, and tier mapping can make a score look eligible without confirmed requirements. `career_goals` is intentionally unverifiable, and the older `opportunities` path remains free-text and outside the rules engine.

### 5. Quality scoring — **Implemented as preflight; insufficient as production gate**

**Implemented:** explainable deterministic eight-point score covering title, provider, description, deadline, application URL, level, evidence length, and confidence; persisted score/status/issues; `ready` threshold of 7/8 (`0.875`), `needs_review` at 5–6/8, and six-hour workflow.

**Partial/missing:** checks are presence/length heuristics, not truth or freshness checks. The scorer has no policy/version identifier, immutable input snapshot, append-only history, reviewer/worker identity, deadline parsing, URL reachability, trust tier, duplicate resolution, contradiction check, or calibration. POST accepts arbitrary candidate IDs without lifecycle predicates. Per-row errors can still yield HTTP 200, and no durable retry/dead-letter/run record exists. The admin page does not render score/issues.

### 6. Admin review and publication — **Partial and unsafe for production**

**Implemented:** authenticated admin GET/PATCH, rate limiting, status values, evidence links, approve/reject/stale/publish actions, candidate/catalogue separation, and a publication linkage field. Publication prevents an existing linkage and requires approved plus quality-ready.

**Contradictions/risks:** migrations show admin SELECT policies for candidates/sources but no candidate UPDATE policy; the admin route uses the normal session client for PATCH and scholarship insertion even though the initial schema describes scholarship writes as service-role-only. Actual live behavior is unknown, but the checked-in contracts are inconsistent. Publication inserts the catalogue row before updating candidate tracking, allowing an orphan row on the second-write failure (reported as 207). State transitions do not enforce a server-side current-state machine. The gate ignores verification status, source trust, duplicate disposition, eligibility verdict, current deadline, evidence completeness, and application-path validity. A separate generic admin verified toggle can bypass the discovery checklist.

**UI gaps:** no quality details, verification result, final URL/HTTP/notes, freshness, duplicate rationale, full eligibility report/quotes, source management, request-changes state, custom rejection reason, field correction, re-verification, search, pagination, or published filter.

### 7. Database and provenance — **Partial foundation**

**Implemented:** candidate quarantine tables, source relationship, status/index fields, idempotency, JSONB quality/eligibility fields, verification summary, publication linkage, verified catalogue indexes, and expiry policy support.

**Missing/technical debt:** append-only candidate event/audit history, verification attempt table, extraction/model/prompt provenance, source snapshots, run/job ledger integration, typed eligibility claims, database-level canonical URL/content hash invariants, publication uniqueness/locking, and clear ownership of source configuration. Migration numbering has duplicate/ambiguous 0052 files; `last_verified_at` has overlapping historical migrations. The generic `workflow_jobs` foundation exists but is not connected to these workers.

### 8. Automation and operations — **Partial/dead paths**

**Implemented:** GitHub Actions definitions with batching, schedule/manual dispatch, and concurrency groups; reusable CRON-secret route patterns; a more complete notification outbox/lease schema elsewhere in the repository.

**Missing:** end-to-end discovery scheduling, durable run records, claim leases, retries/backoff, continuation cursors, dead-letter/manual replay, metrics, alerts, source health updates, and explicit sequencing from discovery through verification, quality, eligibility, and review. Independent six-hour jobs can process out of order. Live schedule, `APP_URL`, secrets, migrations, and API keys cannot be established from static inspection. Inngest and notification cron handlers that return `skipped`/zero work should not be treated as active automation.

## Gap analysis

### Critical functional gaps

1. **Pipeline dead-end:** collector confidence (`<=0.6`) and null deadline conflict with quality readiness (`>=0.7` confidence plus deadline and 7/8 checks).
2. **No substantive verification:** reachability is not verification and does not satisfy the researcher brief.
3. **Publication policy is too weak:** approved + quality-ready can publish without verified source/application, eligibility evidence, freshness, duplicate resolution, or human verification attestation.
4. **Eligibility does not reach the matching engine:** advisory AI requirements and evidence are not normalized, reviewed, or persisted as `scholarship_rules`.
5. **No reliable review transaction:** RLS/client mismatch may block updates; non-atomic publication can create orphan scholarships; generic verified toggle can bypass policy.
6. **No freshness/change model:** no content snapshots, source-dependent TTL, material-change decision, deadline-triggered recheck, or automatic escalation/unverification.

### Technical debt and bottlenecks

- Duplicate source registries and unclear live migration/source state.
- Duplicate rule-write contracts and overlapping migration history.
- Bounded in-memory duplicate scan and sequential child/candidate processing.
- Batch caps (10 sources, 50/100 candidates, 25 AI reviews, 1,000 duplicate comparisons) without cursors or leases.
- In-place result overwrites and HTTP 200 responses despite per-row failures.
- Disabled/manual-first schedules and inert adjacent worker paths.
- UI/API mismatch: fields are selected/typed but not shown or actionable.
- No evidenced unit/integration tests for URL policy, extraction, scoring boundaries, concurrency, RLS, publication races, or matching semantics.
- Cache invalidation for admin scholarship/rule edits is TTL-based rather than explicit; matches may remain stale for up to the documented cache period.

### Reuse versus new components

**Reuse:** `scholarship_discovery_candidates` as quarantine/work ledger; `discovery_sources`; evidence/source URL fields; idempotency and duplicate metadata; quality columns and explainable issues; eligibility report schema as advisory input; `assertAdmin`, Zod/http URL validation, sanitization, rate limiting, CRON workflow patterns; existing matching evaluator and `RuleBuilder`; `workflow_jobs` lease/retry fields; publication linkage; verified catalogue/expiry indexes; existing outbox lease primitives after choosing one authoritative worker.

**Build or materially change:** one versioned source/adapter contract; canonical extraction and claim schema; safe fetch/redirect/egress policy; verification attempts and snapshots; durable pipeline run/claim/state machine; append-only audit/attestation records; database/RPC transactional publication; scalable duplicate constraints/index; shared rule validator; reviewer correction and evidence UI; readiness policy service used by UI and publication; metrics/alerts/dead-letter operations.

Do **not** create a parallel public catalogue or a second independent eligibility system. The candidate ledger and existing matching model should be strengthened and connected.

## Prioritized implementation plan

### Phase 0 — Correctness and containment (highest priority)

- Confirm applied migrations/RLS, route authorization, deployed workflow configuration, secrets, and runtime URLs; add tests for the observed policy contracts.
- Disable or clearly label publication until a server-side readiness function enforces verification, freshness, evidence, duplicate disposition, eligibility handling, and human attestation.
- Fix candidate UPDATE and scholarship write paths through explicit admin policies or a narrowly scoped server-side transaction/RPC.
- Make publication atomic/idempotent with a row lock or compare-and-set, unique publication invariant, reviewer identity, and audit event.
- Resolve collector/quality contradiction by adding a controlled enrichment path or temporarily lowering/rewriting the gate only with an explicit policy decision; do not silently fabricate missing fields.

### Phase 1 — Production verification core

- Define normalized source, program, application, award, deadline, level, geography, and material eligibility fields with per-claim provenance.
- Add source/application URL validation, host allowlists, redirect policy, SSRF defenses, bounded GET fallback, content-type/size/time budgets, and content/metadata hashes.
- Add versioned verification decision and append-only attempts with error class, retry count, checked time, parser/check version, and evidence excerpts.
- Implement source-dependent freshness, deadline-window checks, stale transitions, material-change escalation, and published-listing re-verification.

### Phase 2 — Extraction and review contract

- Replace pilot extraction with source adapters plus generic fallback under a versioned contract and adapter tests; preserve unknowns as null.
- Store model/provider/version/prompt hash/input hash for advisory AI. Treat `unclear` and `not_eligible` as review outcomes, never automatic authorization.
- Let reviewers edit/confirm normalized fields and compile approved requirements into the shared, validated `scholarship_rules` model. Define unknown, OR, exclusion, and conditional semantics.
- Consolidate rule validation and eliminate the weaker inline create contract.

### Phase 3 — Durable operations and admin control room

- Connect discovery and enrichment to `workflow_jobs` or an equivalent run/claim/lease abstraction with cursors, retries/backoff, bounded concurrency, dead-letter/replay, and per-row outcomes.
- Record source runs and update source health/freshness. Add metrics/alerts for queue age, success/error rate, stale published listings, duplicate rate, and zero-work schedules.
- Complete the admin UI: searchable/paginated queue, source controls, quality/verification/eligibility/duplicate detail, evidence links, field correction, request changes, retry/reverify, attestation, and published filter.

### Phase 4 — Scale and governance

- Add database-enforced canonical URL/content-hash invariants and indexed similarity/deduplication; define merge behavior.
- Add property/integration/security tests and migration validation. Introduce scoped worker identity/OIDC or equivalent, secret rotation, replay controls, and audit dashboards.
- Only then enable recurring discovery for a small trusted source tier, expand adapters gradually, and measure false-positive/false-negative rates and reviewer throughput.

## Security review

- **Worker authorization:** CRON_SECRET protects integration routes, but it is a shared bearer credential. Scope identities per job where possible, rotate secrets, add replay/run identifiers, audit invocations, and avoid user reachability of service-role routes.
- **RLS/client boundary:** service-role routes bypass RLS by design; the admin session-client path conflicts with the checked-in candidate SELECT-only policies and initial scholarship write description. Verify live policies and use least privilege.
- **SSRF and egress:** stored URLs are fetched server-side and redirects are followed. Enforce HTTPS, source/application host allowlists, post-redirect validation, DNS rebinding/private-IP protection, content-type/size/time limits, and safe outbound request budgets.
- **Crawl safety:** add robots/terms policy, per-source rate limits, retries with backoff, and final-host restrictions. Do not let a redirect expand a source's crawl scope.
- **Prompt injection/data handling:** scraped text is hostile model input. Use explicit delimiters and instructions, no browsing, strict structured output, input/output size limits, model/provider/prompt provenance, and human review. Do not expose raw untrusted text in privileged admin contexts without escaping.
- **Publication trust:** a public `verified` flag and “Verified by our team” date must be derived from an enforced decision and attestation, not a generic checkbox. Revoke or escalate when content materially changes or becomes unreachable.
- **Integrity/audit:** append immutable review, verification, publication, and rule-change events; retain who/when/what/version; make retries idempotent and prevent concurrent double publication.
- **Secrets and provider controls:** add provider timeout/circuit-breaker/budget policies for Gemini and any email provider. The repository does not establish that secrets or schedules are configured.

## Scalability review

- Current sequential crawling and sequential 25/100-item enrichment batches are acceptable for a pilot but create backlog and workflow-duration risk.
- Hard limits without cursors silently omit work at scale. Replace list-and-process with deterministic pagination plus atomic claim leases and continuation tokens.
- In-memory duplicate comparison is bounded but O(batch × 1,000), stale under concurrency, and not durable. Use normalized keys, database uniqueness, indexed hashes, and a similarity strategy appropriate to catalogue size.
- Independent cron jobs can overlap and run out of order. A durable run/state model should make stages resumable and idempotent, with bounded concurrency rather than unbounded fan-out.
- Store latest summaries for fast reads but retain append-only attempts/events for audit and reconstruction. Partition/archive snapshots and events if volume warrants it.
- Make read APIs paginated and filterable; current source/candidate caps and absent published filter are operational bottlenecks for reviewers.
- Add queue-age, throughput, retry, failure, stale, duplicate, model-cost, and reviewer-SLA metrics. A scheduled job returning HTTP 200 with per-row failures is not adequate observability.
- Existing verified-only indexes and TTL caches are useful, but catalogue/rule changes need deliberate invalidation for correctness rather than relying only on a 10-minute match TTL.

## Minimal production-ready scope

A defensible first production release should be deliberately narrow:

1. One or two trusted official source adapters, with a versioned fetch/extraction contract and tests.
2. Candidate quarantine ledger retained; no direct collector-to-public publication.
3. Safe source/application fetching with allowlists, redirect policy, SSRF protection, timeouts, GET fallback, content hash, and evidence snapshots.
4. Structured fields for provider/program identity, application URL/how-to-apply, current deadline/open state, award facts, Nigerian undergraduate eligibility, and unknown/contradiction states—each with source evidence.
5. Durable verification attempt history and freshness policy; no candidate is “verified” from reachability alone.
6. Deterministic quality as a preflight signal, with a versioned policy and visible issues; it must no longer be impossible for valid collector output to pass.
7. AI eligibility review remains advisory, provenance-recorded, fail-closed on errors/unclear outcomes, and requires human confirmation before rule compilation.
8. A single server-side readiness function and atomic publication transaction requiring: approved reviewer decision, duplicate disposition, current evidence, verified source/application path, current deadline/open state, required eligibility evidence, quality threshold, and audit/attestation. Published discovery rows remain `verified=false` until the separate final verification/publication policy is satisfied.
9. Admin UI showing every gate and evidence item, with correction, request-changes, retry/reverify, notes, attestation, and published filtering.
10. One durable worker mechanism with scoped credentials, leases, retries, dead-letter/replay, run IDs, metrics, alerts, and an explicit small-source rollout. Do not claim the existing GitHub schedules are active until deployment is verified.

This scope is enough to publish a small, trustworthy catalogue while keeping unsupported automation and speculative extraction out of the trust path.

## Evidence and caveats

Key checked-in evidence includes `scripts/discovery_collector.py`; discovery, verification, quality, eligibility, and admin routes under `app/api`; migrations 0042–0048 and related catalogue/workflow migrations; the discovery and enrichment GitHub workflows; `docs/scholarship-researcher-brief.md`; and matching modules under `lib/matching`. The report intentionally distinguishes repository-defined behavior from live behavior. In particular, it does not assert that migrations, RLS policies, cron schedules, `APP_URL`, `CRON_SECRET`, Gemini credentials, or workflows are currently deployed or operational.
