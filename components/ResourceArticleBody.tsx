export function ResourceArticleBody({ content }: { content: string }) {
  const blocks = content.trim().split(/\n{2,}/).filter(Boolean);
  return (
    <div className="space-y-5 text-[1.05rem] leading-8 text-ink">
      {blocks.length === 0 ? (
        <p className="text-navy-light">This article is being prepared.</p>
      ) : (
        blocks.map((block, index) => {
          const lines = block.split("\n");
          const first = lines[0].trim();
          const rest = lines.slice(1).join("\n");
          if (first.startsWith("### ")) {
            return <h3 key={index} className="pt-3 font-display text-xl font-semibold leading-tight text-navy">{first.slice(4)}</h3>;
          }
          if (first.startsWith("## ")) {
            return <h2 key={index} className="pt-4 font-display text-2xl font-semibold leading-tight text-navy">{first.slice(3)}</h2>;
          }
          if (first.startsWith("# ")) {
            return <h2 key={index} className="pt-4 font-display text-2xl font-semibold leading-tight text-navy">{first.slice(2)}</h2>;
          }
          if (lines.every((line) => line.trim().startsWith("- "))) {
            return (
              <ul key={index} className="list-disc space-y-2 pl-6">
                {lines.map((line, itemIndex) => <li key={itemIndex}>{line.trim().slice(2)}</li>)}
              </ul>
            );
          }
          return <p key={index} className="whitespace-pre-wrap">{rest ? `${first}\n${rest}` : first}</p>;
        })
      )}
    </div>
  );
}
