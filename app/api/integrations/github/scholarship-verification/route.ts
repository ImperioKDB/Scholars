import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/ratelimit'
import { z } from 'zod'
import { safeFetch, type SafeFetchResult } from '@/lib/discovery/safeFetch'
import { extractWithAdapter } from '@/lib/discovery/adapters'
import type { Claim } from '@/lib/discovery/extraction'

export const runtime = 'nodejs'

const inputSchema = z.object({ candidate_ids: z.array(z.string().uuid()).min(1).max(100) })
function authorized(request: Request) { const secret = process.env.CRON_SECRET; return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`) }
type SourcePolicy = { id: string; base_url: string; allowed_hosts: string[] | null; application_allowed_hosts: string[] | null; allow_external_application_host: boolean; max_redirects: number; max_fetch_bytes: number; fetch_timeout_ms: number; fetch_policy_version: string; freshness_ttl_hours: number }
type Candidate = { id: string; source_id: string; source_url: string; application_url: string | null; canonical_url: string | null; status: string }

function policyFor(source: SourcePolicy | undefined): SourcePolicy {
  return source ?? { id: '', base_url: '', allowed_hosts: [], application_allowed_hosts: [], allow_external_application_host: false, max_redirects: 5, max_fetch_bytes: 1_500_000, fetch_timeout_ms: 12_000, fetch_policy_version: 'safe-fetch-v1', freshness_ttl_hours: 168 }
}
function attemptStatus(result: SafeFetchResult): 'verified' | 'redirected' | 'unreachable' | 'blocked' | 'error' {
  if (result.status === 'ok') return result.redirectChain.length ? 'redirected' : 'verified'
  if (result.status === 'blocked') return 'blocked'
  if (result.status === 'unreachable') return 'unreachable'
  return 'error'
}
function claimRow(candidateId: string, claim: Claim, inputHash: string, extractorVersion: string) {
  return { candidate_id: candidateId, field: claim.field, value_json: claim.value, operator: claim.operator ?? null, source_url: claim.sourceUrl, evidence_quote: claim.evidenceQuote, confidence: claim.confidence, extraction_method: claim.extractionMethod, extractor_version: extractorVersion, input_hash: inputHash, review_status: 'proposed' }
}
function cleanText(value: string | null | undefined) { return value == null ? value : value.slice(0, 5000) }

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = await checkRateLimit(request, { route: 'github-scholarship-verification', limit: 10 }); if (limited) return limited
  const parsed = inputSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid candidate IDs', issues: parsed.error.issues }, { status: 400 })
  const service = createServiceClient()
  const { data: candidates, error: readError } = await service.from('scholarship_discovery_candidates').select('id,source_id,source_url,application_url,canonical_url,status').in('id', parsed.data.candidate_ids).neq('status', 'rejected').limit(100)
  if (readError) return NextResponse.json({ error: 'Could not load candidates' }, { status: 500 })
  const sourceIds = [...new Set((candidates ?? []).map((candidate) => candidate.source_id))]
  const { data: sourceRows, error: sourceError } = await service.from('discovery_sources').select('id,base_url,allowed_hosts,application_allowed_hosts,allow_external_application_host,max_redirects,max_fetch_bytes,fetch_timeout_ms,fetch_policy_version,freshness_ttl_hours').in('id', sourceIds).limit(100)
  if (sourceError) return NextResponse.json({ error: 'Could not load source fetch policies' }, { status: 500 })
  const { data: previousSnapshots } = await service.from('scholarship_discovery_fetch_snapshots').select('candidate_id,content_hash,fetched_at').in('candidate_id', parsed.data.candidate_ids).order('fetched_at', { ascending: false }).limit(1000)
  const previousByCandidate = new Map<string, { content_hash: string | null; fetched_at: string }>()
  for (const snapshot of previousSnapshots ?? []) if (!previousByCandidate.has(snapshot.candidate_id)) previousByCandidate.set(snapshot.candidate_id, snapshot)
  const sourceById = new Map((sourceRows ?? []).map((source) => [source.id, source as SourcePolicy]))
  const results: Array<Record<string, unknown>> = []

  for (const candidate of (candidates ?? []) as Candidate[]) {
    const source = policyFor(sourceById.get(candidate.source_id))
    const fallbackHost = (() => { try { return new URL(source.base_url || candidate.source_url).hostname } catch { return '' } })()
    const allowedHosts = source.allowed_hosts?.length ? source.allowed_hosts : [fallbackHost]
    const basePolicy = { allowedHosts, maxRedirects: source.max_redirects, maxBytes: source.max_fetch_bytes, timeoutMs: source.fetch_timeout_ms, policyVersion: source.fetch_policy_version }
    const sourceResult = await safeFetch(candidate.canonical_url ?? candidate.source_url, basePolicy)
    const applicationHosts = source.allow_external_application_host && source.application_allowed_hosts?.length ? [...allowedHosts, ...source.application_allowed_hosts] : allowedHosts
    const applicationResult = candidate.application_url ? await safeFetch(candidate.application_url, { ...basePolicy, allowedHosts: applicationHosts }) : null
    const sourceOk = sourceResult.status === 'ok'
    const applicationOk = applicationResult?.status === 'ok'
    const verificationStatus = sourceOk && applicationOk ? (sourceResult.redirectChain.length || applicationResult?.redirectChain.length ? 'redirected' : 'verified') : sourceResult.status === 'blocked' || applicationResult?.status === 'blocked' ? 'unreachable' : 'unreachable'
    const checkedAt = new Date().toISOString()
    const previous = previousByCandidate.get(candidate.id)
    const materialChange = Boolean(sourceResult.contentHash && previous?.content_hash && sourceResult.contentHash !== previous.content_hash)
    const freshnessStatus = sourceResult.status === 'ok' && applicationOk ? materialChange ? 'changed' : 'current' : sourceResult.status === 'blocked' ? 'blocked' : 'stale'
    const staleAfter = sourceResult.status === 'ok' && applicationOk ? new Date(Date.now() + source.freshness_ttl_hours * 60 * 60 * 1000).toISOString() : null
    const notes = [`Source: ${sourceResult.notes ?? sourceResult.status}${sourceResult.finalUrl ? ` (${sourceResult.finalUrl})` : ''}`, applicationResult ? `Application: ${applicationResult.notes ?? applicationResult.status}${applicationResult.finalUrl ? ` (${applicationResult.finalUrl})` : ''}` : 'Application: missing URL'].join(' | ')
    const snapshots = [sourceResult, ...(applicationResult ? [applicationResult] : [])].map((result) => ({ candidate_id: candidate.id, requested_url: result.requestedUrl, final_url: result.finalUrl, redirect_chain: result.redirectChain, http_status: result.httpStatus, content_type: result.contentType, byte_length: result.byteLength, content_hash: result.contentHash, status: result.status, error_code: result.errorCode, policy_version: source.fetch_policy_version, fetched_at: result.fetchedAt }))
    const { error: snapshotError } = await service.from('scholarship_discovery_fetch_snapshots').insert(snapshots)
    const attempts = [sourceResult, ...(applicationResult ? [applicationResult] : [])].map((result) => ({ candidate_id: candidate.id, requested_url: result.requestedUrl, final_url: result.finalUrl, http_status: result.httpStatus, status: attemptStatus(result), notes: result.notes, content_hash: result.contentHash, checked_at: checkedAt }))
    const { error: attemptError } = await service.from('scholarship_discovery_verification_attempts').insert(attempts)

    let extractionStatus: 'complete' | 'partial' | 'unclear' | 'failed' = 'failed'
    let extractionInputHash: string | null = null
    let extractorVersion: string | null = null
    let extractionClaims: Claim[] = []
    let extracted: ReturnType<typeof extractWithAdapter>['result'] | null = null
    if (sourceResult.status === 'ok' && sourceResult.body) {
      const extractedWithAdapter = extractWithAdapter(sourceResult.body, sourceResult.finalUrl ?? candidate.source_url)
      extracted = extractedWithAdapter.result
      extractorVersion = `${extractedWithAdapter.adapter.key}/${extractedWithAdapter.adapter.version}`
      extractionStatus = extracted.status
      extractionInputHash = extracted.inputHash
      const claimKeys = new Set<string>()
      extractionClaims = [extracted.title, extracted.providerName, extracted.description, extracted.applicationUrl, extracted.deadline, extracted.amount, extracted.level, extracted.discipline, ...extracted.claims].filter((claim): claim is Claim => {
        if (!claim) return false
        const key = `${claim.field}:${JSON.stringify(claim.value)}:${claim.operator ?? ''}`
        if (claimKeys.has(key)) return false
        claimKeys.add(key)
        return true
      })
      await service.from('scholarship_discovery_candidate_claims').delete().eq('candidate_id', candidate.id).eq('review_status', 'proposed')
      if (extractionClaims.length) await service.from('scholarship_discovery_candidate_claims').insert(extractionClaims.map((claim) => claimRow(candidate.id, claim, extracted?.inputHash ?? '', extractorVersion ?? 'generic-fallback-v1')))
    }
    const updatePayload: Record<string, unknown> = { verification_status: verificationStatus, verification_http_status: applicationResult?.httpStatus ?? sourceResult.httpStatus, verification_final_url: applicationResult?.finalUrl ?? sourceResult.finalUrl, verification_notes: notes, last_verified_at: checkedAt, last_verified_content_hash: sourceResult.contentHash, freshness_status: freshnessStatus, stale_after: staleAfter, material_change_detected_at: materialChange ? checkedAt : null, extraction_status: extractionStatus, extractor_version: extractorVersion, extraction_input_hash: extractionInputHash, updated_at: checkedAt }
    if (extracted?.deadline?.value && /^\d{4}-\d{2}-\d{2}$/.test(String(extracted.deadline.value))) updatePayload.deadline = extracted.deadline.value
    if (extracted?.amount?.value) updatePayload.amount = cleanText(String(extracted.amount.value))
    if (extracted?.applicationUrl?.value && !candidate.application_url) updatePayload.application_url = extracted.applicationUrl.value
    if (extracted?.level?.value && extracted.level.value !== 'unclear') updatePayload.level = extracted.level.value
    if (extracted?.description?.value) updatePayload.description = cleanText(String(extracted.description.value))
    const { error: updateError } = await service.from('scholarship_discovery_candidates').update(updatePayload).eq('id', candidate.id)
    if (materialChange) await service.from('scholarship_discovery_review_events').insert({ candidate_id: candidate.id, event_type: 'material_change_detected', new_value: { previous_hash: previous?.content_hash, current_hash: sourceResult.contentHash }, notes: 'Source content hash changed since the previous verification.' })
    results.push({ id: candidate.id, verification_status: verificationStatus, extraction_status: extractionStatus, claims: extractionClaims.length, updated: !updateError && !snapshotError && !attemptError })
  }
  return NextResponse.json({ ok: true, checked: results.length, verified: results.filter((item) => item.verification_status === 'verified' || item.verification_status === 'redirected').length, extracted: results.filter((item) => item.extraction_status !== 'failed').length, results })
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data, error } = await service.from('scholarship_discovery_candidates').select('id').in('verification_status', ['unverified', 'stale', 'unreachable']).neq('status', 'rejected').order('created_at', { ascending: true }).limit(100)
  if (error) return NextResponse.json({ error: 'Could not load candidates for verification' }, { status: 500 })
  return NextResponse.json({ candidate_ids: (data ?? []).map((candidate) => candidate.id) })
}
