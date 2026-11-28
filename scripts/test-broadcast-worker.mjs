import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createECDH, randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { convertV4MiniflareOptions, Miniflare, Response } from 'miniflare';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'scholars-broadcast-workerd-'));
const emailJob = '00000000-0000-4000-8000-000000000001';
const pushJob = '00000000-0000-4000-8000-000000000002';
const campaignId = '00000000-0000-4000-8000-000000000003';
const jobs = new Map();
const sends = [];
let requests = 0;
let peak = 0;
let failure = '';
let finalized;
let worker;
let clock = 0;

const key = () => {
  const pair = createECDH('prime256v1');
  pair.generateKeys();
  return pair;
};
const vapid = key();
const subscription = key();
const content = {
  version: 1, baseUrl: 'https://example.invalid',
  items: Array.from({ length: 10 }, (_, i) => ({
    id: String(i), title: 'Synthetic listing ' + i, kind_label: 'Scholarship', provider_name: 'Synthetic',
    amount: null, deadline: null, url: 'https://example.invalid/scholarship/' + i,
  })),
};

function insert(id, channel, count, transport = 'email') {
  jobs.set(id, {
    channel, leased: false, expires: 0, targets: Array.from({ length: count }, (_, i) => ({
      id: channel + '-' + i, state: 'queued', transport, next_provider: null,
      address: 'student' + i + '@example.invalid', first_name: 'Synthetic',
      device: transport === 'web' ? {
        endpoint: 'https://fcm.googleapis.com/send/test-' + i,
        p256dh: subscription.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url'),
      } : { token: 'ExpoPushToken[synthetic' + i + ']' },
    })),
  });
}

function rpc(name, args) {
  const job = jobs.get(args.p_job);
  const target = [...jobs.values()].flatMap((j) => j.targets).find((t) => t.id === args.p_target);
  if (name === 'broadcast_due_jobs') {
    return [...jobs].filter(([, j]) => (!j.leased || j.expires <= clock) &&
      j.targets.some((t) => t.state === 'queued' || t.state === 'deferred' || t.state === 'dispatching'))
      .map(([id, j]) => ({ id, channel: j.channel }));
  }
  if (name === 'broadcast_claim') {
    if (!job || job.channel !== args.p_channel || (job.leased && job.expires > clock)) return null;
    job.leased = true;
    job.expires = clock + 45;
    for (const t of job.targets) {
      if (t.state === 'dispatching') t.state = 'uncertain';
      if (t.state === 'reserved') t.state = 'queued';
    }
    job.target = job.targets.find((t) => t.state === 'queued' || (t.state === 'deferred' && t.resumeAt <= clock));
    if (job.target) job.target.state = 'reserved';
    return { token: String(clock), target: job.target ?? null, campaign: campaignId, content };
  }
  if (name === 'broadcast_begin') {
    assert.equal(target, job.target);
    if (args.p_skip_reason) {
      target.state = 'unattempted';
      return null;
    }
    target.state = 'dispatching';
    return { attempt: target.id, lease_until: new Date(Date.now() + 45_000).toISOString() };
  }
  if (name === 'broadcast_finalize') {
    finalized = args;
    if (failure === 'database_before_commit' || failure === 'interruption_after_acceptance') return new Response(null, { status: 503 });
    if (target.state === 'dispatching') {
      target.state = args.p_outcome === 'fallback' ? 'queued' : args.p_outcome;
      if (args.p_outcome === 'fallback') target.next_provider = 'resend';
      if (target.state === 'deferred') target.resumeAt = clock + args.p_retry_seconds;
    }
    if (failure === 'database_ack_lost') {
      failure = '';
      return new Response(null, { status: 503 });
    }
    return true;
  }
  if (name === 'broadcast_release') {
    assert.notEqual(job.target?.state, 'dispatching');
    job.leased = false;
    return { next_at: job.targets.some((t) => t.state === 'queued') ? new Date().toISOString() : null };
  }
  throw new Error('Unexpected RPC ' + name);
}

async function outbound(request) {
  requests++;
  if (requests > 50) throw new Error('Simulated workerd subrequest ceiling');
  const url = new URL(request.url);
  if (['database.example.invalid', 'aqhktriwaglvvrchxmtd.supabase.co'].includes(url.hostname)) {
    const result = rpc(url.pathname.split('/').pop(), await request.json());
    return result instanceof Response ? result : Response.json(result);
  }
  const body = url.hostname === 'fcm.googleapis.com' ? null : await request.json();
  sends.push({ host: url.hostname, body });
  if (url.hostname === 'api.brevo.com') {
    if (failure === 'rate') return Response.json({ code: 'rate_limit_exceeded' }, { status: 429, headers: { 'Retry-After': '73' } });
    if (failure === 'provider_unavailable') return new Response(null, { status: 503, headers: { 'Retry-After': '180' } });
    if (failure === 'daily_quota') return Response.json({ code: 'not_enough_credits' }, { status: 402 });
    if (failure === 'network') throw new Error('Synthetic network failure');
    if (failure === 'redirect') return new Response(null, { status: 307, headers: { Location: 'https://redirect.example.invalid' } });
    if (failure === 'fallback') return Response.json({}, { status: 401 });
    return Response.json({ messageId: 'synthetic-brevo-receipt' }, { status: 201 });
  }
  if (url.hostname === 'api.resend.com') {
    assert.match(request.headers.get('Idempotency-Key'), /^broadcast\//);
    return Response.json({ id: 'synthetic-resend-id' }, { status: 200 });
  }
  if (url.hostname === 'exp.host') {
    return Response.json({ data: failure === 'missing_ticket' ? [] : [{ status: 'ok', id: 'synthetic-ticket' }] });
  }
  if (url.hostname === 'fcm.googleapis.com') {
    assert.equal(request.headers.get('content-encoding'), 'aes128gcm');
    assert.ok((await request.arrayBuffer()).byteLength > 100);
    return new Response(null, { status: 201 });
  }
  throw new Error('Unexpected network destination ' + url.hostname);
}

async function event(path, id, channel, level) {
  requests = 0;
  clock++;
  const response = await worker.dispatchFetch('https://test.example.invalid/' + path, {
    method: 'POST', body: JSON.stringify({ id, channel, level }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json();
  const operations = requests + result.wakes.length;
  assert.ok(operations <= 32, 'Application ceiling');
  assert.ok(operations <= 50, 'Simulated platform ceiling');
  if (result.used != null) assert.equal(result.used, operations, 'Count every attempted external operation');
  peak = Math.max(peak, operations);
  return result;
}

try {
  const entry = join(temp, 'entry.ts');
  const config = join(temp, 'wrangler.json');
  await writeFile(entry, `
    import { consumeBroadcasts, processBroadcast, scheduleBroadcasts } from ${JSON.stringify(join(root, 'lib/broadcast/worker.ts'))};
    import { BroadcastBudget } from ${JSON.stringify(join(root, 'lib/broadcast/transport.ts'))};
    import { isBroadcastStagingDatabase, stagingBroadcastExecution } from ${JSON.stringify(join(root, 'lib/broadcast/qualification.ts'))};
    export default {
      queue(batch, env) {
        if (!env.TEST_STAGING_RUNTIME) return consumeBroadcasts(batch, env);
        if (!isBroadcastStagingDatabase(env)) throw new Error('Unpinned test staging database');
        const { bindings, qualification } = stagingBroadcastExecution(env);
        return consumeBroadcasts(batch, bindings, qualification);
      },
      scheduled(_event, env) { return scheduleBroadcasts(env); },
      async fetch(request, env) {
        const { id, channel, level } = await request.json();
        const wakes = [];
        const queue = (lane) => ({ async send(body, options) { wakes.push({ ...body, lane, options }); } });
        const bindings = { ...env, BROADCAST_EMAIL_QUEUE: queue('email'), BROADCAST_PUSH_QUEUE: queue('push') };
        const budget = new BroadcastBudget(level ?? 32);
        if (new URL(request.url).pathname === '/cron') {
          await scheduleBroadcasts(bindings, budget);
        } else {
          try { await processBroadcast(bindings, channel, id, budget); } catch {}
        }
        return Response.json({ wakes, used: budget.used });
      }
    };
  `);
  await writeFile(config, JSON.stringify({
    name: 'scholars-broadcast-test', compatibility_date: '2026-11-21', compatibility_flags: ['nodejs_compat'],
    main: entry,
  }));
  const bundle = join(temp, 'bundle');
  const configHome = join(temp, 'config');
  await mkdir(configHome);
  execFileSync(process.execPath, [join(root, 'node_modules/wrangler/bin/wrangler.js'), 'deploy', '--dry-run',
    '--config', config, '--tsconfig', join(root, 'tsconfig.json'), '--outdir', bundle], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', XDG_CONFIG_HOME: configHome }, stdio: 'inherit',
  });
  const script = await readFile(join(bundle, 'entry.js'), 'utf8');
  const startWorker = (staging = false) => new Miniflare({ ...convertV4MiniflareOptions({
    script, modules: true, compatibilityDate: '2026-11-21', compatibilityFlags: ['nodejs_compat'],
    outboundService: outbound,
    bindings: {
      BROADCAST_CONSUMERS_ENABLED: 'true', NEXT_PUBLIC_SUPABASE_URL: 'https://database.example.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic', BREVO_API_KEY: 'synthetic', REMINDER_FROM_EMAIL: 'test@example.invalid',
      RESEND_API_KEY: 'synthetic', RESEND_FROM_EMAIL: 'test@example.invalid',
      NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: vapid.getPublicKey().toString('base64url'),
      WEB_PUSH_VAPID_PRIVATE_KEY: vapid.getPrivateKey().toString('base64url'),
      ...(staging ? {
        TEST_STAGING_RUNTIME: true,
        BROADCAST_STAGING_DROP_FIRST_EMAIL_WAKE: 'true',
        NEXT_PUBLIC_SUPABASE_URL: 'https://aqhktriwaglvvrchxmtd.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: stageKey('anon'),
        SUPABASE_SERVICE_ROLE_KEY: stageKey('service_role'),
        BROADCAST_STAGING_VAPID_PUBLIC_KEY: vapid.getPublicKey().toString('base64url'),
        BROADCAST_STAGING_VAPID_PRIVATE_KEY: vapid.getPrivateKey().toString('base64url'),
      } : {}),
    },
    queueProducers: {
      BROADCAST_EMAIL_QUEUE: queueName('email', staging), BROADCAST_PUSH_QUEUE: queueName('push', staging),
    },
    queueConsumers: {
      [queueName('email', staging)]: { maxBatchSize: 1, maxBatchTimeout: 1 },
      [queueName('push', staging)]: { maxBatchSize: 1, maxBatchTimeout: 1 },
    },
  }), enableDevRegistry: false, resourcePersistencePath: join(temp, 'data'), logRequests: false });
  function queueName(channel, staging) {
    const name = 'scholars-broadcast-' + channel;
    return staging ? name + '-staging' : name;
  }
  function stageKey(role) {
    const claims = Buffer.from(JSON.stringify({ ref: 'aqhktriwaglvvrchxmtd', role })).toString('base64url');
    return 'test.' + claims + '.test';
  }
  worker = startWorker();

  insert(emailJob, 'email', 300);
  insert(pushJob, 'push', 78, 'web');
  const wakes = (await event('cron')).wakes;
  assert.deepEqual(wakes.map((wake) => wake.lane).sort(), ['email', 'push']);
  // Drive only the continuation messages produced by the worker. There is no
  // admin browser, POST or client polling loop involved in this completion.
  while (wakes.length > 0) {
    const wake = wakes.shift();
    const result = await event('consume', wake.id, wake.lane);
    wakes.push(...result.wakes);
  }
  assert.equal(jobs.get(emailJob).targets.filter((t) => t.state === 'accepted').length, 300);
  assert.equal(jobs.get(pushJob).targets.filter((t) => t.state === 'accepted').length, 78);
  assert.equal(sends.length, 378);
  assert.equal(new Set(sends.slice(0).filter(({body}) => body).map(({body}) => body.to[0].email)).size, 300);

  // The exact same finalize call can be retried when the DB commit succeeded
  // but the acknowledgement was lost. There is only one provider request.
  insert(emailJob, 'email', 2);
  failure = 'database_ack_lost';
  const beforeAck = sends.length;
  await event('consume', emailJob, 'email');
  assert.equal(sends.length, beforeAck + 1);
  assert.equal(jobs.get(emailJob).targets[0].state, 'accepted');

  for (const fault of ['database_before_commit', 'interruption_after_acceptance']) {
    insert(emailJob, 'email', 1);
    failure = fault;
    const before = sends.length;
    await event('consume', emailJob, 'email');
    assert.equal(jobs.get(emailJob).targets[0].state, 'dispatching');
    await event('consume', emailJob, 'email');
    assert.equal(sends.length, before + 1, 'overlap must not dispatch');
    if (fault === 'interruption_after_acceptance') {
      await worker.dispose();
      worker = startWorker();
    }
    clock += 46;
    failure = '';
    await event('consume', emailJob, 'email');
    assert.equal(jobs.get(emailJob).targets[0].state, 'uncertain');
    assert.equal(sends.length, before + 1);
  }

  for (const fault of ['network', 'redirect', 'provider_unavailable']) {
    insert(emailJob, 'email', 1);
    failure = fault;
    const before = sends.length;
    await event('consume', emailJob, 'email');
    assert.equal(jobs.get(emailJob).targets[0].state, 'uncertain');
    assert.equal(sends.length, before + 1, 'uncertainty never follows redirects or uses fallback');
    if (fault === 'provider_unavailable') assert.equal(finalized.p_retry_seconds, 180);
  }

  insert(emailJob, 'email', 1);
  failure = 'rate';
  const beforeRate = sends.length;
  await event('consume', emailJob, 'email');
  assert.equal(finalized.p_retry_seconds, 73);
  await event('consume', emailJob, 'email');
  assert.equal(sends.length, beforeRate + 1);
  failure = '';
  clock += 73;
  await event('consume', emailJob, 'email');
  assert.equal(jobs.get(emailJob).targets[0].state, 'accepted');

  insert(emailJob, 'email', 1);
  insert(pushJob, 'push', 1, 'expo');
  failure = 'daily_quota';
  const beforeDailyQuota = sends.length;
  await event('consume', emailJob, 'email');
  assert.equal(finalized.p_reason, 'daily_quota');
  assert.equal(jobs.get(emailJob).targets[0].next_provider, null);
  await event('consume', emailJob, 'email');
  assert.equal(sends.length, beforeDailyQuota + 1);
  await event('consume', pushJob, 'push');
  assert.equal(jobs.get(pushJob).targets[0].state, 'accepted', 'push continues during an email quota hold');

  failure = 'missing_ticket';
  insert(emailJob, 'email', 2);
  insert(pushJob, 'push', 1, 'expo');
  await event('consume', pushJob, 'push');
  assert.equal(jobs.get(pushJob).targets[0].state, 'uncertain');
  await event('consume', emailJob, 'email'); // Drop the continuation to simulate a lost queue wakeup.
  const recovered = (await event('cron')).wakes;
  assert.deepEqual(recovered.map(({ lane }) => lane), ['email']);
  await event('consume', recovered[0].id, recovered[0].lane);
  assert.ok(jobs.get(emailJob).targets.every((target) => target.state === 'accepted'));

  insert(emailJob, 'email', 1);
  failure = 'fallback';
  await event('consume', emailJob, 'email');
  assert.equal(jobs.get(emailJob).targets[0].next_provider, 'resend');
  await event('consume', emailJob, 'email');
  assert.equal(jobs.get(emailJob).targets[0].state, 'accepted');
  assert.equal(sends.at(-1).host, 'api.resend.com');

  insert(emailJob, 'email', 1);
  const beforeBudget = sends.length;
  assert.equal((await event('consume', emailJob, 'email', 6)).used, 1);
  assert.equal(sends.length, beforeBudget, 'provider is untouched if outcome writes cannot be reserved');
  assert.equal(jobs.get(emailJob).targets[0].state, 'reserved');

  // Exercise both actual queue event handlers with Miniflare's queue bindings.
  failure = '';
  insert(emailJob, 'email', 1);
  insert(pushJob, 'push', 1, 'expo');
  requests = 0;
  for (const [binding, id] of [['BROADCAST_EMAIL_QUEUE', emailJob], ['BROADCAST_PUSH_QUEUE', pushJob]]) {
    await (await worker.getQueueProducer(binding)).send({ id });
  }
  for (let i = 0; i < 50 && [...jobs.values()].some((j) => j.targets[0].state !== 'accepted'); i++) {
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.ok([...jobs.values()].every((j) => j.targets[0].state === 'accepted'));
  await worker.dispose();
  worker = startWorker(true);
  insert(emailJob, 'email', 2);
  const stagedEmail = jobs.get(emailJob);
  stagedEmail.targets[0].address = 'broadcast-qualification-001@broadcast.example.invalid';
  stagedEmail.targets[1].address = 'broadcast-qualification-002@broadcast.example.invalid';
  insert(pushJob, 'push', 1, 'web');
  jobs.get(pushJob).targets[0].device.endpoint = 'https://fcm.googleapis.com/send/broadcast-qualification-078';
  const beforeStage = sends.length;
  requests = 0;
  for (const [binding, id] of [['BROADCAST_EMAIL_QUEUE', emailJob], ['BROADCAST_PUSH_QUEUE', pushJob]]) {
    await (await worker.getQueueProducer(binding)).send({ id });
  }
  for (let i = 0; i < 50 && [...jobs.values()].some((j) => j.targets[0].state !== 'accepted'); i++) {
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.ok([...jobs.values()].every((j) => j.targets[0].state === 'accepted'));
  assert.equal(stagedEmail.targets[1].state, 'queued', 'staging deliberately drops the first email continuation');
  const recovery = (await event('cron')).wakes;
  assert.deepEqual(recovery.map(({ lane }) => lane), ['email']);
  await (await worker.getQueueProducer('BROADCAST_EMAIL_QUEUE')).send({ id: recovery[0].id });
  for (let i = 0; i < 50 && stagedEmail.targets[1].state !== 'accepted'; i++) {
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.equal(stagedEmail.targets[1].state, 'accepted', 'Cron recovery completes the staged email lane');
  assert.equal(sends.length, beforeStage, 'staging stubs never make provider subrequests');
  console.log('Workerd passed synthetic 300 email + 78 Web Push campaign, fault injection and native production/staging queue checks.');
  console.log('Maximum counted operations in one simulated event: ' + peak);
} finally {
  await worker?.dispose();
  await rm(temp, { recursive: true, force: true });
}
