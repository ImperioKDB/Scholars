---
name: performance-engineering
description: Investigate or improve measured Scholars latency, Core Web Vitals, query cost, Worker limits, or throughput. Use when the task has a performance or capacity goal.
---

Trace the slow path through `app/`, `lib/`, `lib/monitoring.ts`, database calls, and the runtime where the symptom occurs. Record route or job, runtime, sample size, data scale, cache state, and baseline. Use representative synthetic volume and bounded load against an isolated target.

Identify which resource limits throughput before tuning. Check query shape and indexes, request fan-out, client bundle and hydration cost, and external call budgets as applicable. Treat user-specific caching, authorization, and delivery correctness as invariants.

Repeat baseline conditions after the change and report latency percentiles, work per request or batch, and cost or load signals relevant to the bottleneck. Distinguish estimates from measured capacity. When a safe workload or representative measurement is unavailable, report the gap and the next measurement needed. Stop a load run if isolation or its agreed limits fail.
