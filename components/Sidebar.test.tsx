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

describe("student sidebar vertical scrolling", () => {
  const source = readFileSync(
    resolve(process.cwd(), "components/Sidebar.tsx"),
    "utf8",
  );

  it("makes the desktop nav region independently scrollable", () => {
    // The desktop navigation region needs min-h-0 so it can shrink below
    // its content's minimum height, and overflow-y-auto so links remain
    // reachable when content exceeds the viewport.
    expect(source).toContain('className="min-h-0 flex-1 overflow-y-auto px-3 py-4">{navList}</div>');
  });

  it("makes the mobile drawer nav region independently scrollable", () => {
    // The mobile drawer navigation region shares the same navList
    // container class pattern as the desktop region. Both must carry
    // min-h-0 and overflow-y-auto so links remain reachable on short
    // displays and at increased browser zoom.
    const scrollableNavRegions = source.match(/<div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">\{navList\}<\/div>/g);
    expect(scrollableNavRegions).toHaveLength(2);
  });

  it("keeps the desktop sidebar fixed while content scrolls independently", () => {
    expect(source).toContain('className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-60 border-r border-hairline bg-white"');
  });
});
