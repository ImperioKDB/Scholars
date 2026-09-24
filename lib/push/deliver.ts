import type { SupabaseClient } from '@supabase/supabase-js'
import { sendExpoPushMessages } from './send'

export async function sendPushForProfile(
  supabase: SupabaseClient,
  profileId: string,
  message: { title: string; body: string; data?: Record<string, string> },
): Promise<void> {
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('id,expo_push_token')
    .eq('profile_id', profileId)
    .eq('enabled', true)
    .limit(100)
  if (error) throw error
  if (!tokens?.length) return

  const result = await sendExpoPushMessages(
    tokens.map((token) => ({
      to: token.expo_push_token as string,
      title: message.title,
      body: message.body,
      data: message.data,
      channelId: 'scholarships',
    })),
  )

  if (result.invalidTokens.length > 0) {
    const { error: disableError } = await supabase
      .from('push_tokens')
      .update({ enabled: false })
      .eq('profile_id', profileId)
      .in('expo_push_token', result.invalidTokens)
    if (disableError) throw disableError
  }
}
