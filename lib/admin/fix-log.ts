export type AutonomousFixLog = {
  sha: string;
  shortSha: string;
  url: string;
  message: string;
  author: string;
  committedAt: string;
};

type GitHubCommit = {
  sha?: unknown;
  html_url?: unknown;
  commit?: {
    message?: unknown;
    author?: { name?: unknown; date?: unknown } | null;
  } | null;
};

const REPOSITORY = "ImperioKDB/Scholars";
const FIX_COMMIT_PATTERN = /^(?:fix|bugfix|hotfix)(?:\([^\n)]+\))?:\s|auto(?:nomous)?[- ]monitor|repair/i;

export async function getAutonomousFixLogs(limit = 30): Promise<AutonomousFixLog[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPOSITORY}/commits?per_page=100`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "scholars-admin-fix-report",
        },
        next: { revalidate: 60 },
      }
    );
    if (!response.ok) return [];

    const commits = (await response.json()) as GitHubCommit[];
    return commits
      .filter((item) => {
        const message = typeof item.commit?.message === "string" ? item.commit.message : "";
        return Boolean(item.sha && item.html_url && FIX_COMMIT_PATTERN.test(message));
      })
      .slice(0, limit)
      .map((item) => {
        const message = String(item.commit?.message ?? "").split("\n")[0].slice(0, 240);
        const date = String(item.commit?.author?.date ?? "");
        return {
          sha: String(item.sha),
          shortSha: String(item.sha).slice(0, 7),
          url: String(item.html_url),
          message,
          author: String(item.commit?.author?.name ?? "Unknown author").slice(0, 120),
          committedAt: date,
        };
      });
  } catch {
    return [];
  }
}
