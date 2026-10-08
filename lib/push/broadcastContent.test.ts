import { describe, expect, it } from 'vitest'
import { buildListingBroadcastPushMessage } from './broadcastContent'

describe('buildListingBroadcastPushMessage', () => {
  it('previews one verified listing and uses its in-app detail path', () => {
    expect(buildListingBroadcastPushMessage([
      { title: ' Decagon Undergraduate Honors Program ', url: 'https://www.scholars.com.ng/scholarship/decagon-honors' },
    ])).toEqual({
      title: 'New verified listings on Scholars',
      body: 'New verified listing: Decagon Undergraduate Honors Program. Tap to view.',
      url: '/scholarship/decagon-honors',
    })
  })

  it('summarizes multiple selected listings and links to discovery', () => {
    const message = buildListingBroadcastPushMessage([
      { title: 'First listing', url: '/scholarship/first' },
      { title: 'Second listing', url: '/opportunity/second' },
      { title: 'Third listing', url: '/scholarship/third' },
    ])

    expect(message.body).toBe('3 new verified listings, including First listing. Tap to explore.')
    expect(message.url).toBe('/discover')
  })

  it('truncates long titles and rejects unsafe destinations', () => {
    const longTitle = 'A'.repeat(140)
    const message = buildListingBroadcastPushMessage([
      { title: longTitle, url: 'javascript:alert(1)' },
    ])

    expect(message.body.length).toBeLessThanOrEqual(140)
    expect(message.url).toBe('/discover')
    expect(message.body).toContain('…')
  })
})
