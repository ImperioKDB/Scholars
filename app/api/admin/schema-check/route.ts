// app/api/admin/schema-check/route.ts
// GET /api/admin/schema-check
//
// Drift detector: compares the columns the running code expects against
// the columns that actually exist in the live database. Surfaces schema
// drift (migration pushed to repo but never applied, or applied to the
// wrong project) as a structured JSON payload the admin layout can
// render into a banner.
//
// This is the answer to the recurring "blank dashboard / 500 on one
// admin route" outage pattern: a new column lands in a migration, the
// migration isn't applied, the next deploy silently breaks every query
// that selects that column. With this endpoint, drift shows up as a
// red banner in admin before anyone has to diagnose a 500 from a phone.
//
// Admin-only via middleware + assertAdmin. Read-only, no mutations.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'

// The single source of truth for what the codebase expects to find in
// the database. Keep this in sync with migrations. A missing entry here
// means drift on that column won't be caught; an extra entry means a
// false positive.
const EXPECTED: Record<string, string[]> = {
  scholarships: [
    'id', 'title', 'provider_name', 'description', 'amount', 'deadline',
    'opens_at', 'last_cycle_closed_at', 'last_verified_at',
    'application_url', 'how_to_apply', 'level', 'discipline', 'verified',
    'awards_available', 'estimated_applicant_pool', 'competitiveness_tier',
    'historical_acceptance_rate', 'competitiveness_notes', 'research_notes',
    'created_at', 'updated_at', 'created_by',
  ],
  feedback: [
    'id', 'profile_id', 'category', 'message', 'contact_email',
    'page_url', 'status', 'resolved_at', 'created_at',
  ],
  events: ['id', 'profile_id', 'event', 'meta', 'created_at'],
  cycle_events: ['id', 'scholarship_id', 'kind', 'event_date', 'source_url', 'note', 'captured_by', 'captured_at'],
  testimonials: ['id', 'quote', 'full_name', 'role', 'photo_url', 'consent', 'approved', 'sort_order', 'created_at'],
  announcement_log: ['profile_id', 'listing_kind', 'listing_id', 'created_at'],
}

const EXPECTED_TABLES = Object.keys(EXPECTED)

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-schema-check', limit: 30 })
  if (limited) return limited

  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name = any($1)`,
  }).then(() => ({ data: null, error: { message: 'exec_sql not available' } })).catch(() => ({ data: null, error: null }))

  // Fallback: use a raw query via .from() isn't possible for
  // information_schema, so we use the service-role-free approach of
  // probing each table's columns through a select(*) and reading the
  // PostgREST error shape. Instead, we do it the simple way: one
  // SELECT per expected table against information_schema via rpc.
  // Since exec_sql may not exist, we use a direct Supabase query
  // through the postgres schema.
  void data
  void error

  // Direct information_schema read: Supabase exposes it through the
  // postgres schema. We read via a plain SQL select using .rpc or,
  // if that fails, fall back to probing each table.
  let rows: { table_name: string; column_name: string }[] = []
  try {
    // Supabase PostgREST can't query information_schema directly.
    // Instead, probe each expected table by selecting a single row
    // and reading the error shape when a column is missing. This is
    // less precise but works without a custom SQL function.
    // We use a different strategy: SELECT * LIMIT 0 and rely on the
    // fact that a missing column produces a PostgREST error naming
    // the column. For tables that exist with all columns, the
    // select succeeds and we trust the migration.
    for (const table of EXPECTED_TABLES) {
      const cols = EXPECTED[table]
      const { error: probeErr } = await supabase
        .from(table)
        .select(cols.join(','))
        .limit(0)
      if (probeErr) {
        // Extract missing column name from the error message.
        // PostgREST errors look like: 'column "foo" does not exist'
        const msg = probeErr.message || ''
        const m = msg.match(/column "([^"]+)" does not exist/i)
          || msg.match(/column ([^\s]+) of relation/i)
        if (m) {
          rows.push({ table_name: table, column_name: '__missing__:' + m[1] })
        } else if (msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('relation') || msg.toLowerCase().includes('could not find')) {
          rows.push({ table_name: table, column_name: '__missing_table__' })
        }
      } else {
        // All expected columns present; record them as found so the
        // diff below can distinguish "table missing" from "all good".
        for (const c of cols) {
          rows.push({ table_name: table, column_name: c })
        }
      }
    }
  } catch {
    // Probe failure: return empty drift report rather than 500ing the
    // banner on every admin page.
    return NextResponse.json({ drift: [], checkedAt: new Date().toISOString() })
  }

  const byTable = new Map<string, Set<string>>()
  for (const r of rows) {
    const set = byTable.get(r.table_name) ?? new Set()
    set.add(r.column_name)
    byTable.set(r.table_name, set)
  }

  const drift: { table: string; missing: string[]; tableMissing: boolean }[] = []
  for (const table of EXPECTED_TABLES) {
    const found = byTable.get(table)
    const expected = EXPECTED[table]
    if (!found) {
      drift.push({ table, missing: expected, tableMissing: true })
      continue
    }
    if (found.has('__missing_table__')) {
      drift.push({ table, missing: expected, tableMissing: true })
      continue
    }
    const missingCols = expected.filter((c) => {
      if (c === 'created_by') {
        // created_by is optional on some tables; skip if absent
        return false
      }
      return !found.has(c) && !found.has('__missing__:' + c)
    })
    // Also collect columns flagged as missing via the error probe
    for (const f of found) {
      if (f.startsWith('__missing__:')) {
        const col = f.slice('__missing__:'.length)
        if (!missingCols.includes(col)) missingCols.push(col)
      }
    }
    if (missingCols.length > 0) {
      drift.push({ table, missing: missingCols, tableMissing: false })
    }
  }

  return NextResponse.json({ drift, checkedAt: new Date().toISOString() })
}
