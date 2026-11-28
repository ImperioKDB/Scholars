import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runDailyPushCampaign } from './campaigns'
import { sendPushForProfile } from './deliver'

vi.mock('./deliver', () => ({ sendPushForProfile: vi.fn() }))

const docker = promisify(execFile)
const container = process.env.NEW_MATCH_TEST_CONTAINER
const accepted = { targets: 1, accepted: 1, failed: 0, retryable: 0, expired: 0 }
const listing = '10000000-0000-0000-0000-000000000001'
const id = (sequence: number) => `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'"

async function db(sql: string) {
  const { stdout } = await docker('docker', [
    'exec', container!, 'psql', '-qAtX', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql,
  ])
  return stdout.trim()
}

// The orchestration uses the same SQL RPC names, named arguments and JSON
// results as PostgREST. Each call opens a separate PostgreSQL session.
async function call(name: string, args: Record<string, unknown>) {
  const parameters = Object.entries(args).map(([key, value]) =>
    `${key} => ${typeof value === 'boolean' ? value : quote(typeof value === 'string' ? value : JSON.stringify(value))}`)
  const result = await db(`set role service_role; select public.${name}(${parameters.join(',')})`)
  return JSON.parse(result)
}

function client(rejectFinish = false) {
  return {
    rpc: (name: string, args: Record<string, unknown>) => ({
      retry: async () => {
        if (rejectFinish && name === 'finish_new_match_batch') return { error: new Error('lost write') }
        try {
          return { data: await call(name, args) }
        } catch (error) {
          return { error }
        }
      },
    }),
  } as unknown as Parameters<typeof runDailyPushCampaign>[0]
}

async function seed(count: number, opts = 'true') {
  await db(`
    insert into public.profiles (id, discipline, nationality)
    select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'Engineering',
      case when i = 2000 then 'Ghanaian' else 'Nigerian' end
    from generate_series(1, ${count}) i;
    insert into public.push_tokens select id, ${opts} from public.profiles;
    insert into public.scholarships (id, title, verified, last_verified_at)
    values ('${listing}', 'Original scholarship', true, now() - interval '1 hour');
    insert into public.scholarship_rules (scholarship_id, field, operator, value)
    values ('${listing}', 'nationality', 'eq', '"Nigerian"');
  `)
}

describe.skipIf(!container)('new-match campaign with disposable PostgreSQL', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    vi.mocked(sendPushForProfile).mockResolvedValue(accepted)
    await db(`
      update public.new_match_worker set owner=null, lease_until=null, window_day=null, phase=null;
      truncate public.new_match_windows, public.new_match_worker, public.notification_deliveries,
        public.notifications, public.scholarship_rules, public.scholarships, public.profiles cascade;
      insert into public.new_match_worker default values
    `)
  })

  it('resumes across sessions and considers all 2,000 opt-in profiles with the original window and rules', async () => {
    await seed(2000)
    const service = client()
    const first = await runDailyPushCampaign(service, true)
    expect(first).toMatchObject({ phase: 'discovery', profilesCheckedForMatches: 100, queued: 100 })
    expect(await db('select last_profile_id from public.new_match_windows')).toBe(id(100))
    const originalWindow = await db("select window_start || '/' || window_end from public.new_match_windows")
    await db(`
      delete from public.notifications where profile_id = '${id(100)}';
      delete from public.push_tokens where profile_id = '${id(100)}';
      delete from public.profiles where id = '${id(100)}';
      update public.scholarship_rules set value = '"Ghanaian"';
      update public.scholarships set last_verified_at = now() - interval '49 hours';
      insert into public.scholarships (title, verified, last_verified_at, id)
      values ('Later scholarship', true, now(), '10000000-0000-0000-0000-000000000002')
    `)

    let considered = 100
    for (let page = 1; page < 20; page += 1) {
      const result = await runDailyPushCampaign(service)
      expect(result).toMatchObject({ phase: 'discovery', more: true, profilesCheckedForMatches: 100 })
      if ('profilesCheckedForMatches' in result) considered += result.profilesCheckedForMatches ?? 0
    }

    expect(considered).toBe(2000)
    expect(await db('select phase || \'/\' || last_profile_id from public.new_match_windows')).toBe('delivery/' + id(2000))
    expect(await db("select window_start || '/' || window_end from public.new_match_windows")).toBe(originalWindow)
    expect(await db(`select count(*) from public.notification_deliveries where scholarship_id = '${listing}'`)).toBe('1998')
    expect(await db(`select count(*) from public.notification_deliveries where scholarship_id <> '${listing}'`)).toBe('0')
    expect(await db(`select count(*) from public.notifications where profile_id = '${id(1999)}'`)).toBe('1')
    expect(await db(`select count(*) from public.notifications where profile_id = '${id(2000)}'`)).toBe('0')
    expect(sendPushForProfile).not.toHaveBeenCalled()

    const next = await runDailyPushCampaign(service)
    expect(next).toMatchObject({ phase: 'delivery', newMatchPushesAccepted: 4, more: true })
    expect(await db("select count(*) from public.notification_deliveries where status = 'accepted'")).toBe('4')
  }, 60000)

  it('moves through an empty opt-in page and suppresses only after a real device check', async () => {
    await seed(101, 'false')
    await db(`update public.push_tokens set enabled = true where profile_id = '${id(101)}'`)
    const service = client()
    await expect(runDailyPushCampaign(service, true)).resolves.toMatchObject({ queued: 0, profilesCheckedForMatches: 0 })
    expect(await db('select last_profile_id from public.new_match_windows')).toBe(id(100))
    await expect(runDailyPushCampaign(service)).resolves.toMatchObject({ queued: 1, profilesCheckedForMatches: 1 })
    await db('update public.push_tokens set enabled = false')
    await expect(runDailyPushCampaign(service)).resolves.toMatchObject({ more: false, suppressedDeliveries: 1 })
    expect(await db('select status from public.notification_deliveries')).toBe('suppressed')
    expect(sendPushForProfile).not.toHaveBeenCalled()
  })

  it('allows one simultaneous discovery owner and rejects a stale cursor commit', async () => {
    await seed(2)
    const a = randomUUID()
    const b = randomUUID()
    const results = await Promise.all([
      call('begin_new_match_step', { p_owner: a, p_start_window: true }),
      call('begin_new_match_step', { p_owner: b, p_start_window: false }),
    ])
    // A continuation can win before maintenance captures its window. Hold
    // its lease while verifying that maintenance still captured the window.
    const winner = results[0].phase === 'busy' ? b : a
    expect(results.filter((result) => result.phase === 'busy')).toHaveLength(1)
    expect(await db('select owner from public.new_match_worker')).toBe(winner)
    expect(await db('select count(*) from public.new_match_windows')).toBe('1')
    const day = await db('select day from public.new_match_windows')
    await db("update public.new_match_worker set lease_until = now() - interval '1 second'")
    const replacement = randomUUID()
    expect(await call('begin_new_match_step', { p_owner: replacement, p_start_window: false })).toMatchObject({ phase: 'discovery' })
    await expect(call('commit_new_match_page', { p_owner: winner, p_day: day, p_matches: [] }))
      .rejects.toThrow('new_match discovery lease lost')
    expect(await db('select owner from public.new_match_worker')).toBe(replacement)
    expect(await db('select last_profile_id is null from public.new_match_windows')).toBe('t')
  })

  it('keeps a new daily window while an older window still owns discovery', async () => {
    await seed(101)
    await runDailyPushCampaign(client(), true)
    // Move the first window back a day without changing its captured contents.
    await db(`
      update public.new_match_worker set window_day = null;
      update public.new_match_windows set day = day - 1;
      insert into public.scholarships (title, verified, last_verified_at, id)
      values ('Later scholarship', true, now(), '10000000-0000-0000-0000-000000000002')
    `)
    await expect(runDailyPushCampaign(client(), true)).resolves.toMatchObject({ queued: 1, profilesCheckedForMatches: 1 })
    expect(await db(`select string_agg(phase, ',' order by day) from public.new_match_windows`)).toBe('delivery,discovery')
    expect(await db(`select string_agg(jsonb_array_length(scholarships)::text, ',' order by day)
      from public.new_match_windows`)).toBe('0,2')
    expect(await db('select count(*) from public.notification_deliveries')).toBe('101')
  })

  it('rolls back cursor and intents if the inbox insert fails', async () => {
    await seed(2)
    await db("alter table public.notifications add constraint simulated_inbox_failure check (type <> 'new_match')")
    try {
      await expect(runDailyPushCampaign(client(), true)).rejects.toThrow('simulated_inbox_failure')
      expect(await db('select last_profile_id is null from public.new_match_windows')).toBe('t')
      expect(await db('select count(*) from public.notification_deliveries')).toBe('0')
    } finally {
      await db(`alter table public.notifications drop constraint simulated_inbox_failure;
        update public.new_match_worker set lease_until = now() - interval '1 second'`)
    }
    await expect(runDailyPushCampaign(client())).resolves.toMatchObject({ queued: 2 })
  })

  it('fences maintenance and continuation during sends and never replays an uncertain acceptance', async () => {
    await seed(3)
    await runDailyPushCampaign(client(), true)

    let allowSend!: () => void
    const sending = new Promise<void>((resolve) => { allowSend = resolve })
    let notifyClaim!: () => void
    const claimed = new Promise<void>((resolve) => { notifyClaim = resolve })
    vi.mocked(sendPushForProfile).mockImplementation(async () => {
      notifyClaim()
      await sending
      return accepted
    })

    const original = runDailyPushCampaign(client(true))
    const failedWrite = expect(original).rejects.toThrow('lost write')
    await claimed
    const owner = await db('select owner from public.new_match_worker')
    try {
      await expect(runDailyPushCampaign(client(), true)).resolves.toMatchObject({ phase: 'busy' })
      expect(await db('select owner from public.new_match_worker')).toBe(owner)
      expect(await db("select count(*) from public.notification_deliveries where status = 'leased'")).toBe('3')
    } finally {
      allowSend()
      await failedWrite
    }

    await db(`update public.new_match_worker set lease_until = now() - interval '1 second';
      update public.notification_deliveries set lease_until = now() - interval '1 second'`)
    const replacement = randomUUID()
    await call('begin_new_match_step', { p_owner: replacement, p_start_window: false })
    await expect(call('finish_new_match_batch', { p_owner: owner, p_outcomes: [] })).rejects.toThrow('new_match outcome lease lost')
    expect(await call('claim_new_match_batch', { p_owner: replacement })).toMatchObject({ bundles: [], unknownDeliveries: 3 })
    await call('finish_new_match_batch', { p_owner: replacement, p_outcomes: [] })
    expect(await db("select count(*) from public.notification_deliveries where status = 'unknown' and attempts = 1")).toBe('3')
    expect(await db('select count(*) from public.notifications')).toBe('3')
    expect(sendPushForProfile).toHaveBeenCalledTimes(3)
  })

  it('reuses legacy dedupe and drains a future retry after the discovery window closes', async () => {
    await seed(2)
    await db(`
      insert into public.notification_deliveries
        (profile_id, scholarship_id, campaign_key, channel, schedule_bucket, dedupe_key, template_version, status, attempts, sent_at)
      values ('${id(1)}', '${listing}', 'new_match', 'push', 'legacy', 'push:new_match:${id(1)}:${listing}', 'legacy', 'accepted', 1, now());
      insert into public.notifications (profile_id, scholarship_id, type, metadata)
      values ('${id(1)}', '${listing}', 'new_match', '{"dedupe_key":"push:new_match:${id(1)}:${listing}"}');
    `)
    await expect(runDailyPushCampaign(client(), true)).resolves.toMatchObject({ queued: 1 })
    vi.mocked(sendPushForProfile).mockResolvedValueOnce({ targets: 1, accepted: 0, failed: 1, retryable: 1, expired: 0 })
    await expect(runDailyPushCampaign(client())).resolves.toMatchObject({ more: false, retryableDeliveries: 1 })
    expect(await db('select phase from public.new_match_windows')).toBe('complete')
    await expect(runDailyPushCampaign(client())).resolves.toMatchObject({ more: false })
    expect(sendPushForProfile).toHaveBeenCalledOnce()

    await db("update public.notification_deliveries set available_at = now() where status = 'retryable'")
    await expect(runDailyPushCampaign(client())).resolves.toMatchObject({ more: false, retryPushesAccepted: 1 })
    expect(await db("select count(*) from public.notification_deliveries where status = 'accepted'")).toBe('2')
    expect(await db('select count(*) from public.notifications')).toBe('2')
  })
})
