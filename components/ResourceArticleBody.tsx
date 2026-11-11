import React from "react";
import Link from "next/link";

export type ArticleHeading = { id: string; text: string; level: 2 | 3 };
type ArticleBlock =
  | { kind: "heading"; level: 2 | 3; value: string }
  | { kind: "paragraph"; lines: string[] }
  | { kind: "unordered" | "ordered" | "quote"; lines: string[] };

export function extractArticleHeadings(content: string): ArticleHeading[] {
  const seen = new Map<string, number>();
  return content.split(/\n+/).flatMap((line) => {
    const match = line.match(/^#{2,3}\s*(.*)$/);
    if (!match) return [];
    const text = stripInline(match[1]).trim();
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return [{ id: count ? `${base}-${count + 1}` : base, text, level: line.startsWith("###") ? 3 as const : 2 as const }];
  });
}

export function ResourceArticleBody({ content }: { content: string }) {
  const headings = extractArticleHeadings(content);
  let headingIndex = 0;
  const blocks = parseBlocks(content);
  if (blocks.length === 0) return <p className="text-navy-light">This article is being prepared.</p>;

  return (
    <div className="resource-article-body space-y-6 text-[1.05rem] leading-8 text-ink">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          const heading = headings[headingIndex++];
          const id = heading?.id ?? slugify(stripInline(block.value));
          return block.level === 2
            ? <h2 id={id} key={index} className="scroll-mt-24 pt-5 font-display text-2xl font-semibold leading-tight text-navy">{renderInline(block.value)}</h2>
            : <h3 id={id} key={index} className="scroll-mt-24 pt-3 font-display text-xl font-semibold leading-tight text-navy">{renderInline(block.value)}</h3>;
        }
        if (block.kind === "unordered") return <ul key={index} className="list-disc space-y-2 pl-6">{block.lines.map((line, itemIndex) => <li key={itemIndex}>{renderInline(line.replace(/^[-*]\s+/, ""))}</li>)}</ul>;
        if (block.kind === "ordered") return <ol key={index} className="list-decimal space-y-2 pl-6">{block.lines.map((line, itemIndex) => <li key={itemIndex}>{renderInline(line.replace(/^\d+[.)]\s+/, ""))}</li>)}</ol>;
        if (block.kind === "quote") return <blockquote key={index} className="border-l-2 border-emerald pl-5 font-display text-xl italic leading-8 text-navy">{block.lines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{renderInline(line.replace(/^>\s?/, ""))}</span>)}</blockquote>;
        return <p key={index}>{block.lines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{renderInline(line)}</span>)}</p>;
      })}
    </div>
  );
}

function parseBlocks(content: string): ArticleBlock[] {
  const lines = content.split("\n");
  const blocks: ArticleBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    const heading = line.match(/^(#{2,3})\s*(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length as 2 | 3, value: heading[2] });
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const list: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) list.push(lines[index++].trim());
      blocks.push({ kind: "unordered", lines: list });
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const list: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) list.push(lines[index++].trim());
      blocks.push({ kind: "ordered", lines: list });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) quote.push(lines[index++].trim());
      blocks.push({ kind: "quote", lines: quote });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^(#{2,3})\s*/.test(next) || /^[-*]\s+/.test(next) || /^\d+[.)]\s+/.test(next) || /^>\s?/.test(next)) break;
      paragraph.push(next);
      index += 1;
    }
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", lines: paragraph });
    else index += 1;
  }
  return blocks;
}

function renderInline(value: string): React.ReactNode[] {
  const parts = value.split(/(\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g).filter(Boolean);
  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      return href ? <Link key={index} href={href} rel={href.startsWith("http") ? "noreferrer" : undefined}>{link[1]}</Link> : <span key={index}>{link[1]}</span>;
    }
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) return <em key={index}>{part.slice(1, -1)}</em>;
    return <span key={index}>{part}</span>;
  });
}

export function safeHref(value: string) {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function stripInline(value: string) {
  return value.replace(/\[([^\]]+)\]\([^\s)]+\)/g, "$1").replace(/[\*_`]/g, "");
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
}
