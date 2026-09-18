#!/usr/bin/env python3
"""Conservative, manual-first scholarship discovery pilot collector.

Only sources explicitly marked enabled and pilot_enabled are returned by the
application. Each pilot adapter also restricts which same-domain links may be
visited. Dry-run is the default; set DRY_RUN=false only for an intentional
manual ingestion run.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser

MAX_BYTES = 1_500_000
KEYWORDS = re.compile(r"scholarship|bursary|undergraduate|award|funding|grant", re.I)
UNDERGRADUATE = re.compile(r"undergraduate|bachelor|first degree|tertiary|university student", re.I)
ADAPTERS = {
    "scholarship.education.gov.ng": ("federal", re.compile(r"scholar|bursary|award|grant", re.I)),
    "scholarship.ptdf.gov.ng": ("ptdf", re.compile(r"scholar|education|award|application", re.I)),
    "www.mtn.ng": ("mtn", re.compile(r"scholar|foundation|education|award", re.I)),
    "www.scholarshipair.com": ("secondary", re.compile(r"scholar|bursary|grant|award", re.I)),
}


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title: list[str] = []
        self.text: list[str] = []
        self.links: list[tuple[str, str]] = []
        self._in_title = False
        self._anchor: str | None = None
        self._anchor_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "title":
            self._in_title = True
        if tag == "a":
            self._anchor = attrs_dict.get("href")
            self._anchor_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        if tag == "a" and self._anchor:
            self.links.append((self._anchor, " ".join(self._anchor_text)))
            self._anchor = None

    def handle_data(self, data: str) -> None:
        clean = " ".join(data.split())
        if not clean:
            return
        if self._in_title:
            self.title.append(clean)
        self.text.append(clean)
        if self._anchor is not None:
            self._anchor_text.append(clean)


def fetch(url: str) -> tuple[str, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "ScholarsDiscovery/0.2 (+public scholarship indexing)"})
    with urllib.request.urlopen(request, timeout=25) as response:
        raw = response.read(MAX_BYTES)
        charset = response.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace"), response.geturl()


def adapter_for(source: dict):
    host = urllib.parse.urlparse(source["base_url"]).netloc.lower()
    return ADAPTERS.get(host, ("generic", KEYWORDS))


def candidate(source: dict, page_url: str, title: str, content: str, adapter_name: str) -> dict:
    normalized = re.sub(r"\s+", " ", content).strip()
    digest = hashlib.sha256(normalized[:200_000].encode()).hexdigest()
    level = "undergraduate" if UNDERGRADUATE.search(normalized) else "unclear"
    evidence = normalized[:1800]
    return {
        "source_id": source["id"],
        "source_url": page_url,
        "application_url": page_url,
        "canonical_url": page_url,
        "title": title[:300] or source["name"],
        "provider_name": source["name"][:300],
        "description": normalized[:5000],
        "amount": None,
        "deadline": None,
        "level": level,
        "discipline": None,
        "eligibility_notes": f"Pilot adapter: {adapter_name}. Public-source extraction; administrator verification required.",
        "evidence_excerpt": evidence,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "content_hash": digest,
        "confidence": 0.6 if level == "undergraduate" else 0.35,
        "idempotency_key": f"discovery:{source['id']}:{digest}",
    }


def collect_source(source: dict) -> list[dict]:
    adapter_name, link_pattern = adapter_for(source)
    raw, final_url = fetch(source["base_url"])
    parser = PageParser()
    parser.feed(raw)
    candidates: list[dict] = []
    page_text = " ".join(parser.text)
    if KEYWORDS.search(page_text):
        candidates.append(candidate(source, final_url, " ".join(parser.title).strip(), page_text, adapter_name))
    root_host = urllib.parse.urlparse(final_url).netloc.lower()
    seen: set[str] = set()
    for href, anchor in parser.links[:120]:
        absolute = urllib.parse.urljoin(final_url, href)
        parsed = urllib.parse.urlparse(absolute)
        if parsed.scheme not in {"http", "https"} or parsed.netloc.lower() != root_host:
            continue
        if absolute in seen or not link_pattern.search(f"{anchor} {absolute}"):
            continue
        seen.add(absolute)
        try:
            page, resolved = fetch(absolute)
            child = PageParser()
            child.feed(page)
            child_text = " ".join(child.text)
            if KEYWORDS.search(child_text):
                candidates.append(candidate(source, resolved, " ".join(child.title).strip(), child_text, adapter_name))
        except Exception as exc:
            print(f"warning: {adapter_name} child fetch failed for {absolute}: {exc}", file=sys.stderr)
    return candidates


def post_candidates(url: str, payload: bytes, secret: str) -> str:
    current_url = url
    for _ in range(4):
        post = urllib.request.Request(
            current_url,
            data=payload,
            headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(post, timeout=45) as response:
                return response.read().decode()
        except urllib.error.HTTPError as exc:
            if exc.code not in {301, 302, 307, 308} or not exc.headers.get("Location"):
                raise
            current_url = urllib.parse.urljoin(current_url, exc.headers["Location"])
    raise RuntimeError("Too many redirects while submitting discovery candidates")


def main() -> int:
    api = os.environ["DISCOVERY_API_URL"].rstrip("/")
    secret = os.environ["CRON_SECRET"]
    dry_run = os.environ.get("DRY_RUN", "true").lower() not in {"0", "false", "no"}
    request = urllib.request.Request(f"{api}/api/integrations/github/scholarship-discovery", headers={"Authorization": f"Bearer {secret}"})
    with urllib.request.urlopen(request, timeout=30) as response:
        sources = json.loads(response.read())
    candidates: list[dict] = []
    for source in sources.get("sources", []):
        try:
            candidates.extend(collect_source(source))
        except Exception as exc:
            print(f"warning: source fetch failed for {source.get('base_url')}: {exc}", file=sys.stderr)
    unique = {item["idempotency_key"]: item for item in candidates}
    result = {"ok": True, "dry_run": dry_run, "sources": len(sources.get("sources", [])), "candidates": len(unique)}
    if dry_run or not unique:
        print(json.dumps(result | {"action": "not_ingested", "preview": list(unique.values())[:3]}))
        return 0
    payload = json.dumps({"candidates": list(unique.values())}).encode()
    print(post_candidates(f"{api}/api/integrations/github/scholarship-discovery", payload, secret))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
