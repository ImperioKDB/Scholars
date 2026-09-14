import 'server-only'

import type { EventMeta, EventName } from '@/lib/analytics'

export function trackServerEvent(
  supabase: any,
  profileId: string,
  event: EventName,
  meta?: EventMeta,
): void {
  try {
    void Promise.resolve(
      supabase.from('events').insert({ profile_id: profileId, event, meta: meta ?? {} }),
    ).catch(() => {})
  } catch {
    // Analytics must never block or break a product action.
  }
}
