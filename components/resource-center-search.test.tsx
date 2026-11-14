import { afterEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ResourceSearch, type SearchableArticle } from "./resource-center-search";

afterEach(() => cleanup());

const BASE_ARTICLES: SearchableArticle[] = [
  {
    id: "a-1",
    slug: "how-to-find-legitimate-scholarships",
    title: "How to find scholarships you can trust",
    excerpt: "A careful search is more than typing into a search box.",
    article_type: "Field guide",
    published_at: "2026-11-11T00:00:00.000Z",
    reading_time_minutes: 8,
    author_name: "Scholars Editorial Desk",
    featured_image_path: null,
    content_markdown: "A trustworthy scholarship has an identifiable provider and a clear way to verify the opportunity.",
    categoryNames: ["Scholarship applications", "Scam awareness"],
  },
  {
    id: "a-2",
    slug: "how-to-write-a-scholarship-motivation-letter",
    title: "How to write a scholarship motivation letter",
    excerpt: "A strong motivation letter connects your direction and evidence.",
    article_type: "Writing guide",
    published_at: "2026-11-11T00:00:00.000Z",
    reading_time_minutes: 9,
    author_name: "Scholars Editorial Desk",
    featured_image_path: null,
    content_markdown: "A motivation letter is not a second CV and it is not a list of impressive adjectives.",
    categoryNames: ["Essays and letters", "Scholarship applications"],
  },
  {
    id: "a-3",
    slug: "prepare-for-scholarship-aptitude-tests-and-interviews",
    title: "How to prepare for scholarship aptitude tests and interviews",
    excerpt: "Selection stages reward preparation that is specific and repeatable.",
    article_type: "Preparation guide",
    published_at: "2026-11-11T00:00:00.000Z",
    reading_time_minutes: 8,
    author_name: "Scholars Editorial Desk",
    featured_image_path: null,
    content_markdown: "Start with the official selection information. Some providers publish a test outline.",
    categoryNames: ["Interviews and tests", "Study techniques"],
  },
];

describe("ResourceSearch with expanded fields", () => {
  it("matches article title", () => {
    render(<ResourceSearch articles={BASE_ARTICLES} />);
    const input = screen.getByLabelText("Search Resource Center");
    fireEvent.change(input, { target: { value: "scholarships" } });
    expect(screen.getByRole("link", { name: /how to find scholarships you can trust/i })).toBeDefined();
  });

  it("matches article excerpt", () => {
    render(<ResourceSearch articles={BASE_ARTICLES} />);
    const input = screen.getByLabelText("Search Resource Center");
    fireEvent.change(input, { target: { value: "direction" } });
    expect(screen.getByRole("link", { name: /motivation letter/i })).toBeDefined();
  });

  it("matches article type", () => {
    render(<ResourceSearch articles={BASE_ARTICLES} />);
    const input = screen.getByLabelText("Search Resource Center");
    fireEvent.change(input, { target: { value: "preparation" } });
    expect(screen.getByRole("link", { name: /aptitude tests/i })).toBeDefined();
  });

  it("matches article body (content_markdown)", () => {
    render(<ResourceSearch articles={BASE_ARTICLES} />);
    const input = screen.getByLabelText("Search Resource Center");
    fireEvent.change(input, { target: { value: "identifiable provider" } });
    expect(screen.getByRole("link", { name: /how to find scholarships you can trust/i })).toBeDefined();
  });

  it("matches category name", () => {
    render(<ResourceSearch articles={BASE_ARTICLES} />);
    const input = screen.getByLabelText("Search Resource Center");
    fireEvent.change(input, { target: { value: "scam awareness" } });
    expect(screen.getByRole("link", { name: /how to find scholarships you can trust/i })).toBeDefined();
  });

  it("is case-insensitive", () => {
    render(<ResourceSearch articles={BASE_ARTICLES} />);
    const input = screen.getByLabelText("Search Resource Center");
    fireEvent.change(input, { target: { value: "SCHOLARSHIPS" } });
    expect(screen.getByRole("link", { name: /how to find scholarships you can trust/i })).toBeDefined();
  });

  it("handles missing content_markdown safely", () => {
    const articlesWithoutBody: SearchableArticle[] = [
      {
        ...BASE_ARTICLES[0],
        content_markdown: undefined,
      },
    ];
    render(<ResourceSearch articles={articlesWithoutBody} />);
    const input = screen.getByLabelText("Search Resource Center");
    fireEvent.change(input, { target: { value: "scholarships" } });
    expect(screen.getByRole("link", { name: /how to find scholarships you can trust/i })).toBeDefined();
  });

  it("handles missing categoryNames safely", () => {
    const articlesWithoutCategories: SearchableArticle[] = [
      {
        ...BASE_ARTICLES[0],
        categoryNames: undefined,
      },
    ];
    render(<ResourceSearch articles={articlesWithoutCategories} />);
    const input = screen.getByLabelText("Search Resource Center");
    fireEvent.change(input, { target: { value: "scholarships" } });
    expect(screen.getByRole("link", { name: /how to find scholarships you can trust/i })).toBeDefined();
  });

  it("returns no results when nothing matches", () => {
    render(<ResourceSearch articles={BASE_ARTICLES} />);
    const input = screen.getByLabelText("Search Resource Center");
    fireEvent.change(input, { target: { value: "zzz no match" } });
    expect(screen.getByText(/No guide matches that search yet./i)).toBeDefined();
  });

  it("clears results when the query is emptied", () => {
    render(<ResourceSearch articles={BASE_ARTICLES} />);
    const input = screen.getByLabelText("Search Resource Center");
    fireEvent.change(input, { target: { value: "scholarships" } });
    expect(screen.getByRole("link", { name: /how to find scholarships you can trust/i })).toBeDefined();
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.queryByRole("link", { name: /how to find scholarships you can trust/i })).toBeNull();
  });

  it("limits results to 6", () => {
    const manyArticles: SearchableArticle[] = Array.from({ length: 10 }, (_, i) => ({
      ...BASE_ARTICLES[0],
      id: `a-${i}`,
      slug: `article-${i}`,
      title: `Scholarships article ${i}`,
    }));
    render(<ResourceSearch articles={manyArticles} />);
    const input = screen.getByLabelText("Search Resource Center");
    fireEvent.change(input, { target: { value: "scholarships" } });
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(6);
  });
});
