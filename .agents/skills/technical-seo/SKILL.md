---
name: technical-seo
description: Work on Scholars crawlability, canonicals, metadata, structured data, robots, or sitemap correctness. Use for technical SEO changes and audits of public routes.
---

Reuse the existing `seo` skill for general audit methods. Trace public routes, `app/robots.ts`, `app/sitemap.ts`, and `lib/sitemap-data.ts`. Review route metadata and redirect behavior together. Keep canonical, sitemap, and structured-data URLs aligned with the repository's canonical host and public visibility rules.

Verify the sitemap at request time. Preserve CI builds with placeholder Supabase values and exclude private or ineligible records according to the public catalog rules. Treat robots directives as crawl guidance and enforce private content access at the application and database boundaries.

Run the sitemap and sitemap-data tests. Inspect rendered metadata, redirect response, robots output, and sitemap entries in a suitable environment as relevant. If public data or edge behavior cannot be checked, report the affected checks and avoid claiming crawl or indexing outcomes.
