import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolve recipient addresses from Supabase Auth, which is authoritative for
 * login email. Profiles intentionally do not denormalize this field.
 */
export async function getAuthEmailsByUserId(
  supabase: SupabaseClient,
  profileIds?: Iterable<string>,
): Promise<Map<string, string>> {
  const wanted = profileIds ? new Set(profileIds) : null
  const emailById = new Map<string, string>()

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    })
    if (error) throw error

    const users = data?.users ?? []
    for (const user of users) {
      if (!user.id || !user.email) continue
      if (wanted && !wanted.has(user.id)) continue
      emailById.set(user.id, user.email)
    }

    if (users.length < 100 || (wanted && emailById.size >= wanted.size)) break
  }

  return emailById
}

export async function getAuthEmail(
  supabase: SupabaseClient,
  profileId: string,
): Promise<string | null> {
  return (await getAuthEmailsByUserId(supabase, [profileId])).get(profileId) ?? null
}

export function firstName(fullName: string | null | undefined): string {
  return fullName?.trim().split(/\s+/)[0] || 'there'
}
