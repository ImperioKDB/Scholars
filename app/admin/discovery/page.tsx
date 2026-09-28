'use client'

import { useEffect, useMemo, useState } from 'react'

type Claim = { id: string; field: string; value_json: unknown; operator: string | null; source_url: string; evidence_quote: string; confidence: number | null; review_status: string }
type Source = { id: string; name: string; base_url: string; source_type: string; trust_tier: string; enabled: boolean; pilot_enabled: boolean; crawl_policy: string; last_crawled_at: string | null }
type Candidate = {
  id: string; source_id: string; source_url: string; application_url: string | null; title: string; provider_name: string
  description: string | null; amount: string | null; deadline: string | null; level: string; discipline: string | null
  evidence_excerpt: string; confidence: number | null; status: string; published_scholarship_id: string | null
  verification_status: string; verification_final_url: string | null; verification_notes: string | null; last_verified_at: string | null
  freshness_status: string; stale_after: string | null; extraction_status: string; extractor_version: string | null
  quality_status: string; quality_score: number | null; quality_issues: string[]; eligibility_verdict: string | null
  claims: Claim[]; created_at: string
}

function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString() : '—' }
function confidence(value: number | null) { return value === null ? 'Unscored' : `${Math.round(value * 100)}% confidence` }
function pill(value: string, good = false) { return `rounded-full px-2.5 py-1 text-xs ${good ? 'bg-green-50 text-green-700' : 'bg-parchment text-navy-light'}` }

export default function AdminDiscoveryPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [filter, setFilter] = useState('pending_review')
  const [status, setStatus] = useState('Loading discovery data…')
  const [busy, setBusy] = useState<string | null>(null)
  const [operations, setOperations] = useState<{ jobs?: { counts?: Record<string, number>; oldest_open_job?: string | null }; candidates?: { counts?: Record<string, number> } }>({})

  async function load() {
    const response = await fetch('/api/admin/discovery', { cache: 'no-store' })
    if (!response.ok) { setStatus('Could not load discovery data.'); return }
    const data = await response.json()
    setSources(data.sources ?? [])
    setCandidates(data.candidates ?? [])
    const operationsResponse = await fetch('/api/admin/discovery/operations', { cache: 'no-store' })
    if (operationsResponse.ok) setOperations(await operationsResponse.json())
    setStatus(`Updated ${new Date().toLocaleTimeString()}`)
  }
  useEffect(() => { void load() }, [])

  async function updateCandidate(candidateId: string, nextStatus: 'approved' | 'rejected' | 'stale' | 'published') {
    setBusy(candidateId)
    const response = await fetch('/api/admin/discovery', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: candidateId, status: nextStatus, rejection_reason: nextStatus === 'rejected' ? 'Rejected during admin review' : null }) })
    if (response.ok) await load()
    setBusy(null)
  }

  async function reviewClaim(claim: Claim, reviewStatus: 'confirmed' | 'rejected') {
    setBusy(claim.id)
    const response = await fetch('/api/admin/discovery/claims', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claim_id: claim.id, review_status: reviewStatus, rejection_reason: reviewStatus === 'rejected' ? 'Rejected during evidence review' : null }) })
    if (response.ok) await load()
    setBusy(null)
  }

  const filtered = useMemo(() => filter === 'all' ? candidates : candidates.filter((candidate) => candidate.status === filter), [candidates, filter])
  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const pendingCount = candidates.filter((candidate) => candidate.status === 'pending_review').length

  return <div className="space-y-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-xs uppercase tracking-widest text-amber">Discovery control room</p><h1 className="font-display mt-2 text-3xl font-semibold text-navy">Scholarship discovery</h1><p className="mt-2 max-w-3xl text-sm text-navy-light">Review source evidence, confirm individual claims, and publish only after every trust gate passes.</p></div><button onClick={() => { setStatus('Refreshing…'); void load() }} className="rounded-seal bg-navy px-4 py-2.5 text-sm font-medium text-white">Refresh</button></header>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['Pending review', pendingCount], ['Total candidates', candidates.length], ['Enabled sources', sources.filter((source) => source.enabled).length], ['Primary sources', sources.filter((source) => source.trust_tier === 'primary').length]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-hairline bg-white p-4"><p className="font-mono text-2xl font-semibold text-navy">{value}</p><p className="mt-1 text-xs text-navy-light">{label}</p></div>)}</div>

    <section className="rounded-xl border border-hairline bg-white p-5"><h2 className="font-display text-xl font-semibold text-navy">Pipeline health</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><div><p className="font-mono text-lg font-semibold text-navy">{operations.jobs?.counts?.pending ?? 0}</p><p className="text-xs text-navy-light">Queued jobs</p></div><div><p className="font-mono text-lg font-semibold text-navy">{operations.jobs?.counts?.dead_letter ?? 0}</p><p className="text-xs text-navy-light">Dead-letter jobs</p></div><div><p className="font-mono text-lg font-semibold text-navy">{operations.jobs?.oldest_open_job ? formatDate(operations.jobs.oldest_open_job) : '—'}</p><p className="text-xs text-navy-light">Oldest open job</p></div></div></section>

    <section className="rounded-xl border border-hairline bg-white p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-xl font-semibold text-navy">Source registry</h2><p className="mt-1 text-sm text-navy-light">Only explicitly enabled and pilot-approved sources are crawlable.</p></div><span className="font-mono text-xs text-navy-light">{status}</span></div><div className="mt-4 divide-y divide-hairline">{sources.map((source) => <div key={source.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-navy">{source.name}</p><a href={source.base_url} target="_blank" rel="noreferrer" className="break-all text-xs text-navy-light underline">{source.base_url}</a></div><div className="flex flex-wrap gap-2 text-xs"><span className={pill(source.source_type)}>{source.source_type}</span><span className={pill(source.enabled ? 'Enabled' : 'Disabled', source.enabled)}>{source.enabled ? 'Enabled' : 'Disabled'}</span><span className={pill(source.pilot_enabled ? 'Pilot on' : 'Pilot off', source.pilot_enabled)}>{source.pilot_enabled ? 'Pilot on' : 'Pilot off'}</span></div></div>)}</div></section>

    <section className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-xl font-semibold text-navy">Candidate review queue</h2><p className="mt-1 text-sm text-navy-light">Claims are proposed first; confirmation is a separate auditable action.</p></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-navy"><option value="pending_review">Pending review</option><option value="approved">Approved</option><option value="published">Published</option><option value="rejected">Rejected</option><option value="stale">Stale</option><option value="all">All candidates</option></select></div>
      {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-hairline bg-white p-8 text-center text-sm text-navy-light">No candidates in this view.</div> : <div className="grid gap-4">{filtered.map((candidate) => {
        const confirmed = candidate.claims.filter((claim) => claim.review_status === 'confirmed').length
        const proposed = candidate.claims.filter((claim) => claim.review_status === 'proposed').length
        const ready = candidate.status === 'approved' && candidate.quality_status === 'ready' && ['verified', 'redirected'].includes(candidate.verification_status) && candidate.freshness_status === 'current' && candidate.eligibility_verdict && ['eligible', 'likely_eligible'].includes(candidate.eligibility_verdict) && Boolean(candidate.application_url)
        return <article key={candidate.id} className="rounded-xl border border-hairline bg-white p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap gap-2"><span className={pill(candidate.status)}>{candidate.status.replace('_', ' ')}</span><span className={pill(candidate.level)}>{candidate.level}</span><span className={pill(`URL ${candidate.verification_status}`, ['verified', 'redirected'].includes(candidate.verification_status))}>{`URL ${candidate.verification_status}`}</span><span className={pill(`Freshness ${candidate.freshness_status}`, ['current', 'changed'].includes(candidate.freshness_status))}>{`Freshness ${candidate.freshness_status}`}</span><span className={pill(`Extraction ${candidate.extraction_status}`, candidate.extraction_status === 'complete')}>{`Extraction ${candidate.extraction_status}`}</span><span className={pill(`Claims ${confirmed} confirmed · ${proposed} proposed`, confirmed > 0)}>{`${confirmed} confirmed · ${proposed} proposed`}</span></div><h3 className="mt-3 font-display text-xl font-semibold text-navy">{candidate.title}</h3><p className="mt-1 text-sm text-navy-light">{candidate.provider_name} · {sourceById.get(candidate.source_id)?.name ?? 'Unknown source'}</p></div><div className="text-sm text-navy-light lg:text-right"><p>Deadline: <strong className="text-navy">{candidate.deadline ?? 'Not extracted'}</strong></p><p className="mt-1">Checked {formatDate(candidate.last_verified_at)} · {confidence(candidate.confidence)}</p></div></div><p className="mt-4 text-sm leading-6 text-navy-light">{candidate.description ?? 'No description extracted.'}</p>{candidate.verification_notes && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">{candidate.verification_notes}</p>}
          <details className="mt-4 rounded-lg bg-parchment p-3" open={candidate.status === 'pending_review'}><summary className="cursor-pointer text-sm font-medium text-navy">Evidence and claims</summary><p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-navy-light">{candidate.evidence_excerpt}</p><div className="mt-4 space-y-2">{candidate.claims.length === 0 ? <p className="text-xs text-navy-light">No structured claims extracted yet.</p> : candidate.claims.map((claim) => <div key={claim.id} className="rounded-lg border border-hairline bg-white p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-mono text-xs uppercase tracking-wide text-navy-light">{claim.field} {claim.operator ? `(${claim.operator})` : ''}</p><p className="mt-1 text-sm font-medium text-navy">{String(claim.value_json)}</p><p className="mt-1 text-xs leading-5 text-navy-light">“{claim.evidence_quote}”</p></div><div className="flex shrink-0 items-center gap-2"><span className={pill(claim.review_status, claim.review_status === 'confirmed')}>{claim.review_status}</span>{claim.review_status === 'proposed' && <><button disabled={busy === claim.id} onClick={() => void reviewClaim(claim, 'confirmed')} className="rounded-seal bg-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Confirm</button><button disabled={busy === claim.id} onClick={() => void reviewClaim(claim, 'rejected')} className="rounded-seal border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50">Reject</button></>}</div></div></div>)}</div><div className="mt-4 flex flex-wrap gap-3 text-xs"><a href={candidate.source_url} target="_blank" rel="noreferrer" className="text-navy underline">Source page</a>{candidate.application_url && <a href={candidate.application_url} target="_blank" rel="noreferrer" className="text-navy underline">Application page</a>}{candidate.verification_final_url && <a href={candidate.verification_final_url} target="_blank" rel="noreferrer" className="text-navy underline">Checked destination</a>}</div></details>
          {candidate.status === 'pending_review' && <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy === candidate.id} onClick={() => void updateCandidate(candidate.id, 'approved')} className="rounded-seal bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Approve candidate</button><button disabled={busy === candidate.id} onClick={() => void updateCandidate(candidate.id, 'rejected')} className="rounded-seal border border-red-200 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">Reject</button></div>}{candidate.status === 'approved' && <div className="mt-5 flex flex-wrap items-center gap-2"><button disabled={busy === candidate.id || !ready} onClick={() => void updateCandidate(candidate.id, 'published')} className="rounded-seal bg-amber px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Publish to catalogue</button>{!ready && <span className="text-xs text-navy-light">Requires quality, verified URLs, current evidence, reviewed eligibility, application URL, and confirmed claims.</span>}</div>}</article>
      })}</div>}
    </section>
  </div>
}
