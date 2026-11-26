import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261125044414_restrict_achievement_trigger_rpc_execution.sql",
);
const triggerMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/0008_fix_first_action_achievement_timing.sql",
);

describe("achievement trigger permission hardening", () => {
  it("revokes direct RPC execution without removing trigger execution", () => {
    const migration = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
    const triggerMigration = readFileSync(triggerMigrationPath, "utf8");

    for (const signature of [
      "public.run_achievement_checks(uuid)",
      "public.check_achievements()",
      "public.check_first_action_achievements()",
      "public.check_community_discussion_achievements()",
      "public.check_community_reaction_achievements()",
    ]) {
      expect(migration).toContain(
        `REVOKE EXECUTE ON FUNCTION ${signature}\nFROM PUBLIC, anon, authenticated;`,
      );
    }
    expect(migration).not.toMatch(/drop\s+(trigger|function)|disable\s+trigger/i);

    expect(triggerMigration).toContain("security definer");
    expect(triggerMigration).toContain(
      "create trigger on_saved_scholarship_insert",
    );
    expect(triggerMigration).toContain(
      "create trigger on_application_insert_check_first",
    );
    expect(triggerMigration).toContain(
      "execute function public.check_first_action_achievements();",
    );
  });
});
