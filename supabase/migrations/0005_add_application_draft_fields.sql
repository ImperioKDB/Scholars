-- Auto-apply v1: AI-drafted, student-reviewed application materials.
-- draft_summary is a structured jsonb blob: { checklist: [{item, have}], facts: [{label, value}] }
-- draft_statement is the AI-drafted personal statement (plain text, student-editable).
-- draft_generated_at / draft_confirmed_at are independent: regenerating clears confirmed_at,
-- so a stale confirmed draft can never be mistaken for a confirmed *current* one.
--
-- Applied live via Supabase MCP on 2026-08-30. This file is a reference
-- record only, per project convention -- do not re-run against the live
-- project.

alter table public.applications
  add column draft_statement text,
  add column draft_summary jsonb,
  add column draft_generated_at timestamptz,
  add column draft_confirmed_at timestamptz;

comment on column public.applications.draft_statement is 'AI-generated personal statement draft, editable by the student before use.';
comment on column public.applications.draft_summary is 'Structured facts + document checklist used to fill the real application, jsonb: {facts:[{label,value}], checklist:[{item,have}]}';
comment on column public.applications.draft_confirmed_at is 'Set when the student confirms they have reviewed/edited the draft and are using it. Cleared whenever the draft is regenerated.';
