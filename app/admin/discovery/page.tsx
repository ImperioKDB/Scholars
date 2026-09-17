'use client'

import { useEffect, useMemo, useState } from 'react'

type Source = { id: string; name: string; base_url: string; source_type: string; trust_tier: string; enabled: boolean; crawl_policy: string; last_crawled_at: string | null }
type Candidate = { id: string; source_id: string; source_url: string; application_url: string | null; title: string; provider_name: string; description: string | null; amount: string | null; deadline: string | null; level: string; discipline: string | null; eligibility_notes: string | null; evidence_excerpt: string; fetched_at: string; confidence: number | null; status: string; rejection_reason: string | null; reviewed_at: string | null; duplicate_of: string | null; duplicate_score: number | null; duplicate_reason: string | null; created_at: string }

function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString() : '—' }
function confidenceLabel(value: number | null) { return value === null ? 'Unscored' : `${Math.round(value * 100)}% confidence` }

export default function AdminDiscoveryPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [status, setStatus] = useState('Loading discovery data…')
  const [filter, setFilter] = useState('pending_review')
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const response = await fetch('/api/admin/discovery', { cache: 'no-store' })
    if (!response.ok) { setStatus('Could not load discovery data.'); return }
    const data = await response.json()
    setSources(data.sources ?? [])
    setCandidates(data.candidates ?? [])
    setStatus('Updated just now')
  }

  useEffect(() => { void load() }, [])

  async function review(candidateId: string, nextStatus: 'approved' | 'rejected' | 'stale' | 'published') {
    setBusy(candidateId)
    const response = await fetch('/api/admin/discovery', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: candidateId, status: nextStatus, rejection_reason: nextStatus === 'rejected' ? 'Rejected during admin review' : null }) })
    if (response.ok) await load()
    setBusy(null)
  }

  const pendingCount = candidates.filter((candidate) => candidate.status === 'pending_review').length
  const filtered = useMemo(() => filter === 'all' ? candidates : candidates.filter((candidate) => candidate.status === filter), [candidates, filter])
  const sourceById = new Map(sources.map((source) => [source.id, source]))

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-amber">Discovery control room</p>
          <h1 className="font-display text-3xl font-semibold text-navy mt-2">Scholarship discovery</h1>
          <p className="text-sm text-navy-light mt-2 max-w-2xl">Review what the collector found, inspect its evidence, and keep new records separate from the public catalogue.</p>
        </div>
        <button onClick={() => { setStatus('Refreshing…'); void load() }} className="rounded-seal bg-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-light">Refresh</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Pending review', pendingCount],
          ['Total candidates', candidates.length],
          ['Enabled sources', sources.filter((source) => source.enabled).length],
          ['Primary sources', sources.filter((source) => source.trust_tier === 'primary').length],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-hairline bg-white p-4"><p className="font-mono text-2xl font-semibold text-navy">{value}</p><p className="mt-1 text-xs text-navy-light">{label}</p></div>)}
      </div>

      <section className="rounded-xl border border-hairline bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-xl font-semibold text-navy">Source registry</h2><p className="text-sm text-navy-light mt-1">Sources are disabled until you deliberately enable them in Supabase.</p></div><span className="font-mono text-xs text-navy-light">{status}</span></div>
        <div className="mt-5 divide-y divide-hairline">{sources.map((source) => <div key={source.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-navy">{source.name}</p><a href={source.base_url} target="_blank" rel="noreferrer" className="text-xs text-navy-light hover:underline break-all">{source.base_url}</a></div><div className="flex items-center gap-2 text-xs"><span className="rounded-full bg-parchment px-2.5 py-1 text-navy-light">{source.source_type}</span><span className={`rounded-full px-2.5 py-1 ${source.enabled ? 'bg-green-50 text-green-700' : 'bg-amber-light text-amber'}`}>{source.enabled ? 'Enabled' : 'Disabled'}</span></div></div>)}</div>
      </section>

      <section className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-xl font-semibold text-navy">Candidate review queue</h2><p className="text-sm text-navy-light mt-1">Approval here marks a candidate approved for the next publishing step; it does not silently publish it.</p></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-navy"><option value="pending_review">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="stale">Stale</option><option value="all">All candidates</option></select></div>
        {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-hairline bg-white p-8 text-center text-sm text-navy-light">No candidates in this view yet. Run the manual collector after enabling a reviewed source.</div> : <div className="grid gap-4">{filtered.map((candidate) => <article key={candidate.id} className="rounded-xl border border-hairline bg-white p-5"><div className="flex flex-col gap-4 lg:flex-row lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-parchment px-2.5 py-1 text-xs text-navy-light">{candidate.status.replace('_', ' ')}</span><span className="rounded-full bg-parchment px-2.5 py-1 text-xs text-navy-light">{candidate.level}</span><span className="rounded-full bg-parchment px-2.5 py-1 text-xs text-navy-light">{confidenceLabel(candidate.confidence)}</span></div><h3 className="font-display text-xl font-semibold text-navy mt-3">{candidate.title}</h3><p className="text-sm text-navy-light mt-1">{candidate.provider_name} · {sourceById.get(candidate.source_id)?.name ?? 'Unknown source'}</p></div><div className="text-sm text-navy-light lg:text-right"><p>Deadline: <strong className="text-navy">{candidate.deadline ?? 'Not extracted'}</strong></p><p className="mt-1">Fetched {formatDate(candidate.fetched_at)}</p></div></div><p className="text-sm leading-6 text-navy-light mt-4">{candidate.description ?? 'No description extracted.'}</p><details className="mt-4 rounded-lg bg-parchment p-3"><summary className="cursor-pointer text-sm font-medium text-navy">View evidence</summary><p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-navy-light">{candidate.evidence_excerpt}</p><div className="mt-3 flex flex-wrap gap-3 text-xs"><a href={candidate.source_url} target="_blank" rel="noreferrer" className="text-navy underline">Source page</a>{candidate.application_url && <a href={candidate.application_url} target="_blank" rel="noreferrer" className="text-navy underline">Application page</a>}</div></details>{candidate.status === 'pending_review' && <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy === candidate.id} onClick={() => void review(candidate.id, 'approved')} className="rounded-seal bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Approve candidate</button><button disabled={busy === candidate.id} onClick={() => void review(candidate.id, 'rejected')} className="rounded-seal border border-red-200 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">Reject</button><button disabled={busy === candidate.id} onClick={() => void review(candidate.id, 'stale')} className="rounded-seal border border-hairline px-4 py-2 text-sm font-medium text-navy-light disabled:opacity-50">Mark stale</button></div>}{candidate.status === 'approved' && <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy === candidate.id} onClick={() => void review(candidate.id, 'published')} className="rounded-seal bg-amber px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Publish to catalogue</button></div>}</article>)}</div>}
      </section>
    </div>
  )
}
