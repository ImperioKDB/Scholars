export type BroadcastPushItem = { title: string; url: string }

export type BroadcastPushMessage = {
  title: string
  body: string
  url: string
}

export const INDEPENDENCE_DAY_PUSH_MESSAGE: BroadcastPushMessage = {
  title: 'Happy Independence Day, Nigeria!',
  body: "Celebrate Nigeria's future with us. Keep learning, keep applying, and keep believing in your path.",
  url: '/dashboard',
}

function previewTitle(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return 'A new verified listing'
  return normalized.length > 100 ? `${normalized.slice(0, 99).trimEnd()}…` : normalized
}

function safeListingPath(value: string): string {
  try {
    const path = new URL(value, 'https://scholars.invalid').pathname
    if (path.startsWith('/scholarship/') || path.startsWith('/opportunity/')) return path
  } catch {
    // Fall back to discovery if the listing link is malformed.
  }
  return '/discover'
}

/** A short team-pick summary; it never claims the listings match a student's profile. */
export function buildListingBroadcastPushMessage(items: BroadcastPushItem[]): BroadcastPushMessage {
  if (items.length === 0) {
    return {
      title: 'New verified listings on Scholars',
      body: 'New verified listings are available. Tap to explore.',
      url: '/discover',
    }
  }

  const firstTitle = previewTitle(items[0].title)
  return {
    title: 'New verified listings on Scholars',
    body: items.length === 1
      ? `New verified listing: ${firstTitle}. Tap to view.`
      : `${items.length} new verified listings, including ${firstTitle}. Tap to explore.`,
    url: items.length === 1 ? safeListingPath(items[0].url) : '/discover',
  }
}
