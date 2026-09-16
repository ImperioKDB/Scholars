# Scholars Scholarship Discovery Agent Roadmap

**Prepared for:** Scholars

**Objective:** Keep the scholarship catalogue current by discovering Nigerian undergraduate opportunities, verifying their evidence, detecting duplicates, and routing candidates to human review before publication.

## Executive direction

Scholars should begin with a **periodic discovery pipeline**, not an unrestricted autonomous agent. GitHub Actions provides a free execution layer. The crawler collects pages from a curated source registry. Deterministic checks validate URLs, dates, required fields, and duplicates. An optional open-source model may later assist with classification and extraction. Every candidate enters a review queue before it can become public.

This design keeps the application’s existing catalogue, notification outbox, and user-facing experience stable. It also makes every discovery decision auditable.

## Operating principles

1. **No direct publication.** New discoveries are stored as `pending_review` candidates. Only an authenticated administrator can publish them.
2. **Evidence first.** Each candidate must retain a source URL, application URL, retrieval timestamp, and extraction evidence.
3. **Undergraduate focus.** The pipeline must distinguish undergraduate, postgraduate, secondary-school, professional, and unclear opportunities.
4. **Freshness is explicit.** A listing is not considered current merely because it exists. Deadline and last-verified timestamps must be visible to the review process.
5. **Source-specific rules.** The registry records whether a source is official, institutional, provider-owned, or secondary. Secondary sources may discover opportunities but should not be the sole verification evidence for high-risk listings.
6. **Human approval for uncertainty.** Low-confidence, conflicting, expired, or incomplete candidates remain unapproved.
7. **Small batches first.** Start with a few trusted sources and a manual workflow. Increase coverage only after measuring false positives, duplicates, and review time.

## Target architecture

```text
GitHub Actions
  → scheduled or manual discovery run
  → Crawl4AI or a small HTTP/HTML collector
  → source-specific extraction rules
  → normalized candidate payload
  → Scholars ingestion endpoint
  → deterministic validation and deduplication
  → pending-review queue
  → administrator review
  → approved catalogue listing
  → freshness checks and re-verification
```

Crawl4AI is an open-source crawler that supports clean Markdown, structured extraction, browser control, and CSS/XPath or LLM-based extraction [1]. LangGraph is a possible later orchestration layer for durable, stateful, human-in-the-loop agent workflows [2]. Neither library removes the need for hosting, source governance, or model costs.

## Delivery phases

| Phase | Scope | Exit condition |
|---|---|---|
| **Phase 1 — Safe ingestion foundation** | Source registry, candidate table, evidence fields, idempotent ingestion endpoint, and manual review status | A test candidate can be ingested without touching the public catalogue |
| **Phase 2 — Deterministic collector** | GitHub Actions runner, approved source list, HTTP retrieval, content hashing, deadline and URL checks | A scheduled run produces traceable candidates and skips unchanged pages |
| **Phase 3 — Normalization and deduplication** | Field normalization, provider/title matching, canonical URLs, duplicate scores, and conflict flags | Repeated runs do not create duplicate candidates |
| **Phase 4 — Review queue** | Admin list, evidence preview, approve/reject/request-changes actions, and audit log | An administrator can review a candidate from a phone |
| **Phase 5 — Assisted extraction** | Optional open-source model through Ollama or another compatible local endpoint; structured JSON output; confidence thresholds | The model assists extraction but cannot bypass deterministic gates |
| **Phase 6 — Re-verification** | Scheduled freshness checks, deadline transitions, broken-link detection, and stale-listing alerts | Existing listings are rechecked and stale records are visible |
| **Phase 7 — Agentic optimization** | LangGraph-style durable workflow, source prioritization, contradiction resolution, and review recommendations | The system proposes actions with evidence and maintains a resumable audit trail |

## Phase 1 implementation plan

The first implementation should add:

- `discovery_sources`, with source name, URL, source type, trust tier, enabled status, and crawl policy.
- `scholarship_discovery_candidates`, with normalized fields, source evidence, confidence, status, idempotency key, and review metadata.
- A protected ingestion endpoint for the future GitHub Actions collector.
- Strict validation for HTTP(S) URLs, required title/provider/source fields, and candidate status transitions.
- An idempotency key so retries cannot create duplicate candidates.
- No public catalogue writes and no email sends.

## Free execution plan

GitHub Actions can run the collector periodically or manually. It is suitable for batch discovery, but it is not a permanently running process and scheduled jobs can be delayed. The collector should therefore be idempotent and tolerant of delayed runs. GitHub documents workflow execution and event limits that must be considered as source coverage grows [3].

The initial collector should use deterministic extraction wherever possible. This is cheaper and easier to debug than asking a model to browse freely. An open-source model should be introduced only for pages that deterministic selectors cannot parse.

## Verification policy

A candidate should be eligible for administrator approval only when it has a reachable source URL, a reachable application URL when one is required, a future or explicitly open deadline, and evidence that the opportunity is available to Nigerian students. Undergraduate eligibility must be explicit or marked as uncertain. The system should preserve the exact evidence excerpt used for classification.

A source may be used for discovery without being sufficient for final verification. For example, a secondary scholarship directory can point the agent toward an opportunity, while the provider’s official page supplies the approval evidence.

## Metrics

The first dashboard should measure discovery runs, pages fetched, candidates created, duplicates skipped, expired candidates rejected, candidates awaiting review, approval rate, rejection rate, average review time, broken application links, and the age of the last successful verification per published listing.

The key quality metric is not the number of scraped records. It is the number of **accurate, current, undergraduate-relevant opportunities approved per review hour**.

## Risks and controls

| Risk | Control |
|---|---|
| False or expired listings | Evidence capture, deadline checks, review queue, and re-verification |
| Duplicate records | Canonical URL and normalized title/provider matching plus idempotency keys |
| Website layout changes | Source-specific adapters, extraction failures, and run logs |
| Robots, terms, or access restrictions | Crawl only permitted public pages, respect rate limits, and stop when a source disallows access |
| Model hallucination | Structured outputs, evidence requirements, deterministic validation, and human approval |
| Accidental mass publication | Candidate table separated from public catalogue; no automatic approval |
| Hosting interruption | Manual rerun support, bounded batches, and resumable candidate ingestion |

## Immediate user actions after Phase 1

After the branch is reviewed and merged, configure the existing GitHub Actions `CRON_SECRET` and production `APP_URL`. The first discovery run should be manual and limited to a small source set. Review the resulting candidates before enabling any recurring schedule.

## References

[1]: https://docs.crawl4ai.com/ "Crawl4AI open-source crawler documentation"
[2]: https://docs.langchain.com/oss/python/langgraph/overview "LangGraph open-source agent orchestration documentation"
[3]: https://docs.github.com/en/actions/reference/limits "GitHub Actions limits documentation"
