#!/usr/bin/env python3
"""Small, dependency-free discovery collector for the first GitHub Actions phase.

It deliberately prefers false negatives over unsafe publishing. It fetches only
sources returned by Scholars, extracts likely scholarship pages and evidence,
and leaves all review and publication decisions to the application.
"""
from __future__ import annotations

import hashlib
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser

KEYWORDS = re.compile(r"scholarship|bursary|undergraduate|award|funding", re.I)
UNDERGRADUATE = re.compile(r"undergraduate|bachelor|first degree|tertiary", re.I)
MAX_BYTES = 1_500_000


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
        if tag == "title": self._in_title = True
        if tag == "a":
            self._anchor = attrs_dict.get("href")
            self._anchor_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title": self._in_title = False
        if tag == "a" and self._anchor:
            self.links.append((self._anchor, " ".join(self._anchor_text)))
            self._anchor = None

    def handle_data(self, data: str) -> None:
        clean = " ".join(data.split())
        if not clean: return
        if self._in_title: self.title.append(clean)
        self.text.append(clean)
        if self._anchor is not None: self._anchor_text.append(clean)


def fetch(url: str) -> tuple[str, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "ScholarsDiscovery/0.1 (+public scholarship indexing)"})
    with urllib.request.urlopen(request, timeout=25) as response:
        raw = response.read(MAX_BYTES)
        charset = response.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace"), response.geturl()


def candidate(source: dict, page_url: str, title: str, text: str, content: str) -> dict:
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
        "eligibility_notes": "Extracted from a public source; administrator verification required.",
        "evidence_excerpt": evidence,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "content_hash": digest,
        "confidence": 0.55 if level == "undergraduate" else 0.35,
        "idempotency_key": f"discovery:{source['id']}:{digest}",
    }


def main() -> int:
    api = os.environ["DISCOVERY_API_URL"].rstrip("/")
    secret = os.environ["CRON_SECRET"]
    request = urllib.request.Request(f"{api}/api/integrations/github/scholarship-discovery", headers={"Authorization": f"Bearer {secret}"})
    with urllib.request.urlopen(request, timeout=30) as response:
        sources = json.loads(response.read())
    candidates: list[dict] = []
    for source in sources.get("sources", []):
        try:
            raw, final_url = fetch(source["base_url"])
            parser = PageParser()
            parser.feed(raw)
            text = " ".join(parser.text)
            if KEYWORDS.search(text):
                title = " ".join(parser.title).strip()
                candidates.append(candidate(source, final_url, title, text, text))
            for href, anchor in parser.links[:100]:
                absolute = urllib.parse.urljoin(final_url, href)
                if urllib.parse.urlparse(absolute).netloc != urllib.parse.urlparse(final_url).netloc: continue
                if KEYWORDS.search(f"{anchor} {absolute}"):
                    try:
                        page, resolved = fetch(absolute)
                        child = PageParser(); child.feed(page)
                        child_text = " ".join(child.text)
                        if KEYWORDS.search(child_text):
                            candidates.append(candidate(source, resolved, " ".join(child.title).strip(), child_text, child_text))
                    except Exception as exc:
                        print(f"warning: child fetch failed for {absolute}: {exc}", file=sys.stderr)
        except Exception as exc:
            print(f"warning: source fetch failed for {source.get('base_url')}: {exc}", file=sys.stderr)
    unique = {item["idempotency_key"]: item for item in candidates}
    payload = json.dumps({"candidates": list(unique.values())}).encode()
    if not unique:
        print(json.dumps({"ok": True, "candidates": 0}))
        return 0
    post = urllib.request.Request(f"{api}/api/integrations/github/scholarship-discovery", data=payload, headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(post, timeout=45) as response:
        print(response.read().decode())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
