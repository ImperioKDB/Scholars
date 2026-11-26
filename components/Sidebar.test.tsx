import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("student sidebar notification bell", () => {
  it("renders one responsive NotificationBell instance for both layouts", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/Sidebar.tsx"),
      "utf8",
    );

    expect(source.match(/<NotificationBell\s*\/>/g)).toHaveLength(1);
    expect(source).toContain("One responsive instance prevents duplicate polling.");
  });
});
