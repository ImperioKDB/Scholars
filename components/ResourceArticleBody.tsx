import Link from "next/link";

export type ArticleHeading = { id: string; text: string; level: 2 | 3 };

export function extractArticleHeadings(content: string): ArticleHeading[] {
  const seen = new Map<string, number>();
  return content.split(/\n+/).flatMap((line) => {
    const match = line.match(/^#{2,3}\s+(.+)$/);
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
  const headingIds = new Map<string, string>();
  headings.forEach((heading) => headingIds.set(`${heading.level}:${heading.text}`, heading.id));
  const blocks = content.trim().split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) return <p className="text-navy-light">This article is being prepared.</p>;

  return (
    <div className="resource-article-body space-y-6 text-[1.05rem] leading-8 text-ink">
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const first = lines[0] ?? "";
        const headingMatch = first.match(/^(#{2,3})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length as 2 | 3;
          const text = stripInline(headingMatch[2]);
          const id = headingIds.get(`${level}:${text}`) ?? slugify(text);
          return level === 2
            ? <h2 id={id} key={index} className="scroll-mt-24 pt-5 font-display text-2xl font-semibold leading-tight text-navy">{renderInline(headingMatch[2])}</h2>
            : <h3 id={id} key={index} className="scroll-mt-24 pt-3 font-display text-xl font-semibold leading-tight text-navy">{renderInline(headingMatch[2])}</h3>;
        }
        if (lines.every((line) => /^[-*]\s+/.test(line))) {
          return <ul key={index} className="list-disc space-y-2 pl-6">{lines.map((line, itemIndex) => <li key={itemIndex}>{renderInline(line.replace(/^[-*]\s+/, ""))}</li>)}</ul>;
        }
        if (lines.every((line) => /^\d+[.)]\s+/.test(line))) {
          return <ol key={index} className="list-decimal space-y-2 pl-6">{lines.map((line, itemIndex) => <li key={itemIndex}>{renderInline(line.replace(/^\d+[.)]\s+/, ""))}</li>)}</ol>;
        }
        if (lines.every((line) => /^>\s?/.test(line))) {
          return <blockquote key={index} className="border-l-2 border-emerald pl-5 font-display text-xl italic leading-8 text-navy">{lines.map((line) => renderInline(line.replace(/^>\s?/, "")))}</blockquote>;
        }
        return <p key={index}>{lines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{renderInline(line)}</span>)}</p>;
      })}
    </div>
  );
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

function safeHref(value: string) {
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
