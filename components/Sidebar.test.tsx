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

  const navContainerPattern = /<div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">\{navList\}<\/div>/g;

  it("makes the desktop nav region independently scrollable", () => {
    // min-h-0 lets the nav region shrink below its content minimum height;
    // overflow-y-auto lets links scroll when content exceeds the viewport.
    expect(navContainerPattern.test(source)).toBe(true);
  });

  it("makes the mobile drawer nav region independently scrollable", () => {
    const scrollableNavRegions = source.match(navContainerPattern);
    expect(scrollableNavRegions).toHaveLength(2);
  });

  it("provides a scrolling fallback for extremely short viewports", () => {
    // overflow-y-auto on the aside keeps profile, navigation and account
    // controls reachable when the viewport is shorter than the full sidebar.
    expect(source).toMatch(
      /className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-60 border-r border-hairline bg-white overflow-y-auto"/,
    );
  });

  it("keeps the desktop sidebar fixed while content scrolls independently", () => {
    expect(source).toMatch(
      /className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-60 border-r border-hairline bg-white overflow-y-auto"/,
    );
  });

  it("preserves the mobile header controls", () => {
    expect(source).toContain('className="md:hidden fixed top-0 inset-x-0 z-40 h-16 bg-white/95 backdrop-blur-sm border-b border-hairline flex items-center gap-3 px-4"');
  });

  it("preserves the account controls block", () => {
    expect(source).toContain('className="px-3 py-4 border-t border-hairline"');
  });
});
